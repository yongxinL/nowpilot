// src/core/content/ContentScriptHost.ts — the ONLY content-script runtime
// (D-16). Extraction-only: it reads the page's title/URL to keep a live
// PageContext and wires bridge messages to the tab-keyed PageRegistry — it NEVER
// mutates the DOM and NEVER mounts UI (R-5, T-1-15). All messaging goes through
// PageContextBridge (the single content message path); no direct chrome API
// calls here. Dependency-free core (Pitfall 4): no React, no antd, no zustand.
//
// 04a-07 (D-4a-07/08/09/01/12): the host now serializes the page for
// panel-side extraction (clone/strip/stamp/truncate — RESEARCH Pattern 2
// verbatim), replies to EXTRACT_PAGE_CONTENT with a mode-discriminated payload
// ('default' → serialized HTML, 'actionable' → walked RawNode tree), and wires
// SPANavigationWatcher so SPA navs rebuild the live context + upsert + publish
// the lightweight live-context update (D-4a-01). Extraction-only throughout —
// serialization reads the live DOM, never writes to it.
import { PageRegistry } from '@/core/registry/PageRegistry';
import { PageContextBridge } from '@/core/content/PageContextBridge';
import type {
  ContentCapabilities,
  ExtractionPayload,
  ExtractionRequest,
} from '@/core/content/PageContextBridge';
import { MessageType } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import type { PageContext } from '@/core/content/PageContext';
import { walkAxDom } from '@/core/content/AxDomWalker';
import { SPANavigationWatcher } from '@/core/content/SPANavigationWatcher';
import type { SPANavigationWatcherDeps } from '@/core/content/SPANavigationWatcher';

/**
 * D-4a-09 hard size cap on the serialized extraction payload (~2 MB). The host
 * truncates at an element boundary past this and flags provenance via the
 * `truncated` field — no chunk/assembly protocol in v0.1. String-length based
 * (UTF-16 code units) per the 04a-01 CAT-01 encoding note.
 */
export const PAGE_HTML_MAX_BYTES = 2_097_152;

export interface ContentScriptHostOptions {
  bridge?: PageContextBridge;
  registry?: PageRegistry;
  /** Tab id this content script lives in (fed to PageRegistry.upsert). */
  tabId?: number;
  /**
   * SPANavigationWatcher deps (D-4a-01). Production passes the wxt content-script
   * ctx (ctx.addEventListener auto-cleans on invalidation — never a bare
   * window.addEventListener); tests inject plain-window deps. Absent → no watcher.
   */
  watcherDeps?: SPANavigationWatcherDeps;
  /**
   * Resolved namespaced event name for tests (RESEARCH Pitfall 4). Production
   * omits it — the watcher defaults to 'wxt:locationchange' and wxt's ctx maps
   * it to the unique namespaced name at runtime.
   */
  watcherEventName?: string;
}

export class ContentScriptHost {
  private readonly bridge: PageContextBridge;
  private readonly registry: PageRegistry;
  private readonly tabId: number;
  private readonly watcherDeps?: SPANavigationWatcherDeps;
  private readonly watcherEventName?: string;
  private unsubscribe: (() => void) | null = null;
  private watcher: SPANavigationWatcher | null = null;
  private currentPage: PageContext;

  constructor(options: ContentScriptHostOptions = {}) {
    this.bridge = options.bridge ?? new PageContextBridge();
    this.registry = options.registry ?? new PageRegistry();
    this.tabId = options.tabId ?? 0;
    this.watcherDeps = options.watcherDeps;
    this.watcherEventName = options.watcherEventName;
    this.currentPage = this.buildLiveContext();
  }

  /** The tab-keyed registry this host feeds (test/consumer access). */
  getPageRegistry(): PageRegistry {
    return this.registry;
  }

  /**
   * Install the bridge listener, wire EXTRACT_PAGE_CONTENT → PageRegistry.upsert
   * + the mode-discriminated extraction reply, reply to PING /
   * GET_CONTENT_CAPABILITIES, keep the live PageContext of the current page
   * (document.title/URL), and watch SPA navigation (D-4a-01). NO DOM mutation,
   * NO UI mount — R-5.
   */
  start(): void {
    this.currentPage = this.buildLiveContext();
    this.unsubscribe = this.bridge.onMessage((message) => this.handleMessage(message));
    if (this.watcherDeps) {
      this.watcher = new SPANavigationWatcher(
        this.watcherDeps,
        (newUrl) => this.handleNavigate(newUrl),
        { eventName: this.watcherEventName },
      );
    }
  }

  /** Detach the bridge listener + watcher (content script invalidated / stopped). */
  stop(): void {
    this.watcher?.stop();
    this.watcher = null;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /** Capabilities handshake roundtrip (delegates to the bridge). */
  getCapabilities(): Promise<ContentCapabilities> {
    return this.bridge.getCapabilities();
  }

  /** Current live page context (title/URL read at start, extraction-only). */
  getCurrentPage(): PageContext {
    return this.currentPage;
  }

  /**
   * D-4a-07/08/09 — serialize the live document for panel-side extraction:
   * clone, strip script/style/noscript/svg + cross-origin iframes (T-4a-20) +
   * form-action attributes (inputs kept), stamp the absolute baseUrl, serialize
   * ONE string, truncate at an element boundary past PAGE_HTML_MAX_BYTES
   * (truncated:true). Extraction-only (R-5) — reads the live DOM, never mutates.
   */
  serializeForExtraction(): ExtractionPayload {
    if (typeof document === 'undefined' || !document.documentElement) {
      return { html: '', baseUrl: '', truncated: false };
    }
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    // D-4a-07 strip set — script/style/noscript/svg markup never reaches the payload.
    clone.querySelectorAll('script, style, noscript, svg').forEach((n) => n.remove());
    // T-4a-20: cross-origin iframes are REMOVED — foreign-site content never
    // enters the payload (origin check in try/catch: cross-origin access throws).
    clone.querySelectorAll('iframe').forEach((n) => {
      try {
        if (n.contentWindow?.location.origin !== location.origin) n.remove();
      } catch {
        n.remove(); // cross-origin access throws — treat as cross-origin
      }
    });
    // D-4a-07: form-action attributes removed (submission disarmed); inputs kept.
    clone.querySelectorAll('[formaction]').forEach((n) => n.removeAttribute('formaction'));
    const html = clone.outerHTML;
    return {
      html:
        html.length > PAGE_HTML_MAX_BYTES
          ? truncateAtElementBoundary(html, PAGE_HTML_MAX_BYTES)
          : html,
      baseUrl: document.baseURI, // D-4a-08 stamp — absolute, resolves relative links panel-side
      truncated: html.length > PAGE_HTML_MAX_BYTES,
    };
  }

  private handleMessage(message: RuntimeEnvelope<unknown>): void {
    switch (message.type) {
      case MessageType.EXTRACT_PAGE_CONTENT: {
        // Keep the live-context upsert; the reply shape is discriminated by mode
        // (D-4a-12): 'actionable' → walked RawNode tree (D-4a-20 password values
        // omitted at capture), 'default' (and unknown modes) → serialized HTML.
        this.registry.upsert(this.tabId, this.currentPage);
        const request = message.payload as Partial<ExtractionRequest> | undefined;
        if (request?.mode === 'actionable') {
          this.bridge.replyExtracted(message.id, walkAxDom(document));
        } else {
          this.bridge.replyExtracted(message.id, this.serializeForExtraction());
        }
        break;
      }
      case MessageType.PING:
        this.bridge.replyPong(message.id);
        break;
      case MessageType.GET_CONTENT_CAPABILITIES:
        this.bridge.replyCapabilities(message.id, this.capabilities());
        break;
      default:
        // Unknown types never reach subscribers (MessageBus whitelist, T-1-04).
        break;
    }
  }

  /**
   * D-4a-01: a SPA navigation (wxt:locationchange) — rebuild the live context,
   * upsert the registry, and publish the lightweight live-context update
   * (mark-stale signal). Full re-extraction happens only when a surface
   * requests it (subscribed-only).
   */
  private handleNavigate(_newUrl: string): void {
    this.currentPage = this.buildLiveContext();
    this.registry.upsert(this.tabId, this.currentPage);
    this.bridge.publishContext(this.currentPage);
  }

  /** D-16 skeleton capability flags (real extraction lands in Phase 4a). */
  private capabilities(): ContentCapabilities {
    return { extraction: true, domAccess: 'isolated' };
  }

  /** Read-only live context — document.title/URL, never a DOM mutation. */
  private buildLiveContext(): PageContext {
    const hasDom = typeof document !== 'undefined';
    const url = hasDom ? document.URL : '';
    return {
      url,
      origin: hasDom ? document.location.origin : '',
      hostname: hasDom ? document.location.hostname : '',
      title: hasDom ? document.title : '',
      meta: {},
      extractedAt: Date.now(),
    };
  }
}

/**
 * D-4a-09: truncate a serialized doc past PAGE_HTML_MAX_BYTES at an element
 * boundary — walk back to the last COMPLETE CLOSING TAG (`</...>`) before the
 * cap so the payload never splits a tag and never dangles an unclosed element
 * (an opening-tag `>` is a tag boundary but not an element boundary).
 */
function truncateAtElementBoundary(html: string, maxBytes: number): string {
  if (html.length <= maxBytes) return html;
  let scan = maxBytes - 1;
  while (scan > 0) {
    const closeStart = html.lastIndexOf('</', scan);
    if (closeStart === -1) {
      // No closing tag before the cap — fall back to the last complete tag close.
      const gt = html.lastIndexOf('>', scan);
      return html.slice(0, gt === -1 ? maxBytes : gt + 1);
    }
    const gt = html.indexOf('>', closeStart);
    if (gt !== -1 && gt < maxBytes) {
      return html.slice(0, gt + 1); // ends at a complete closing tag — no dangling element
    }
    // The closing tag straddles the cap (long tag name) — walk further back.
    scan = closeStart - 1;
  }
  return html.slice(0, maxBytes);
}
