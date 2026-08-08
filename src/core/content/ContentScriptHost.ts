// src/core/content/ContentScriptHost.ts — the ONLY content-script runtime
// (D-16). Extraction-only: it reads the page's title/URL to keep a live
// PageContext and wires bridge messages to the tab-keyed PageRegistry — it NEVER
// mutates the DOM and NEVER mounts UI (R-5, T-1-15). All messaging goes through
// PageContextBridge (the single content message path); no direct chrome API
// calls here. Dependency-free core (Pitfall 4): no React, no antd, no zustand.
import { PageRegistry } from '@/core/registry/PageRegistry';
import { PageContextBridge } from '@/core/content/PageContextBridge';
import type { ContentCapabilities } from '@/core/content/PageContextBridge';
import { MessageType } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import type { PageContext } from '@/core/content/PageContext';

export interface ContentScriptHostOptions {
  bridge?: PageContextBridge;
  registry?: PageRegistry;
  /** Tab id this content script lives in (fed to PageRegistry.upsert). */
  tabId?: number;
}

export class ContentScriptHost {
  private readonly bridge: PageContextBridge;
  private readonly registry: PageRegistry;
  private readonly tabId: number;
  private unsubscribe: (() => void) | null = null;
  private currentPage: PageContext;

  constructor(options: ContentScriptHostOptions = {}) {
    this.bridge = options.bridge ?? new PageContextBridge();
    this.registry = options.registry ?? new PageRegistry();
    this.tabId = options.tabId ?? 0;
    this.currentPage = this.buildLiveContext();
  }

  /** The tab-keyed registry this host feeds (test/consumer access). */
  getPageRegistry(): PageRegistry {
    return this.registry;
  }

  /**
   * Install the bridge listener, wire EXTRACT_PAGE_CONTENT → PageRegistry.upsert,
   * reply to PING / GET_CONTENT_CAPABILITIES, and keep the live PageContext of
   * the current page (document.title/URL). NO DOM mutation, NO UI mount — R-5.
   */
  start(): void {
    this.currentPage = this.buildLiveContext();
    this.unsubscribe = this.bridge.onMessage((message) => this.handleMessage(message));
  }

  /** Detach the bridge listener (content script invalidated / stopped). */
  stop(): void {
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

  private handleMessage(message: RuntimeEnvelope<unknown>): void {
    switch (message.type) {
      case MessageType.EXTRACT_PAGE_CONTENT:
        this.registry.upsert(this.tabId, this.currentPage);
        break;
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
      origin: hasDom ? document.origin : '',
      hostname: hasDom ? document.location.hostname : '',
      title: hasDom ? document.title : '',
      meta: {},
      extractedAt: Date.now(),
    };
  }
}
