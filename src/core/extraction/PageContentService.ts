// src/core/extraction/PageContentService.ts — 04a-08 the extraction orchestrator
// (§26.1 core infrastructure). Appendix O.12 extractLayered (spec L6736-6768)
// VERBATIM, adapted per D-4a-22: debugLog + the typed throw use the canonical
// ERROR_CODES.CONTENT_EXTRACT_FAILED (errorCodes.ts — NEVER the non-canonical
// O.12 'EXTRACTION_FAILED' string) and the import path is @/core/error/debugLog.
// The PageContentService class wraps extractLayered with:
//   D-4a-03  per-tab in-flight coalescing (the promise map lives here — the cache
//            holds value/recency, 04a-05 decision) + stale-safe reads (Pitfall 7:
//            a read after invalidation AWAITS the in-flight extraction, never
//            serves the stale entry) + ONE AbortController + the exported
//            EXTRACTION_TIMEOUT_MS = 5000 hard cap (§22.1 L3564) per round-trip —
//            never nested retries/timeouts (R-2)
//   D-4a-04  eviction orchestration: the per-tab cache (LRU-20) protects pinned /
//            subscribed / in-flight entries; tabs.onRemoved drops cache + index
//            together
//   D-4a-10  TraceRedactor runs PANEL-SIDE on the result BEFORE any index build /
//            cache write / debugLog persist — the content script never imports it
//            (Appendix G); the redaction test (CAT-03) pins secret absence
//   D-4a-15  the ephemeral per-tab MiniSearch index is built lazily on first query
//            (memoized in the cache entry) and evicted with the extraction
//   D-4a-05  delivery via the EXISTING primary-writer mechanism: the default
//            deliverContext writes WorkspaceStore.currentPageContext through the
//            update(draft) inert-field path (D-18 — never journaled/serialized,
//            RESEARCH Q3); the secondary surface mirrors via the existing
//            BroadcastBus WORKSPACE_UPDATED path — no new coordination. The model
//            feed (ContextOptimizerInput.pageContext) stays UNPLUGGED (D-4a-06 —
//            Phase 4b owns it): this module never imports ai/ or storage/.
//   R-3      panel/standalone-side only — the background never extracts
//            (forward-only: the panel drives the bridge round-trips).
import type MiniSearch from 'minisearch';

import { ApcLiteStrategy } from './strategies/ApcLiteStrategy';
import { DefuddleStrategy } from './strategies/DefuddleStrategy';
import type {
  IExtractionStrategy,
  StrategyInput,
  StrategyResult,
} from './strategies/IExtractionStrategy';
import { PageContentCache, type PageCacheEntryInput } from './PageContentCache';
import { buildPageIndex, chunkMarkdown } from './PageIndexBuilder';
import { PageContextBridge } from '@/core/content/PageContextBridge';
import type { ExtractionPayload } from '@/core/content/PageContextBridge';
import type { PageContext } from '@/core/content/PageContext';
import type { BridgeMessageListener } from '@/core/messaging/MessageBusBridge';
import { MessageType } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { redact } from '@/core/security/TraceRedactor';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import type { RawNode } from '@/core/extraction/apcLite.types';

/** D-4a-03 / §22.1 hard cap on one extraction round-trip (spec L3564 — 5 s). */
export const EXTRACTION_TIMEOUT_MS = 5000;

/**
 * Appendix O.12 (L6736-6746) — the layered-extraction outcome: the winning
 * StrategyResult + provenance (which layer won + every layer tried before it).
 */
export interface ExtractionOutcome {
  result: StrategyResult;
  sourceUsed: StrategyResult['source']; // provenance — which layer won
  fallbacksTried: string[];
}

/**
 * The typed CONTENT_EXTRACT_FAILED carrier (D-4a-19/22) — modeled on the
 * StructuredOutputFailedError precedent (src/core/ai/StructuredOutput.ts L79-90).
 * extractLayered, the bridge timeout path, and any wrapped bridge failure all
 * surface this carrier — never a bare Error, never a silent-empty result.
 */
export interface ContentExtractFailedCarrier extends Error {
  code: 'CONTENT_EXTRACT_FAILED';
  fallbacksTried: string[];
}

/** Guard: distinguishes the canonical extraction failure from other errors. */
export function isContentExtractFailed(err: unknown): err is ContentExtractFailedCarrier {
  return (
    err instanceof Error &&
    (err as ContentExtractFailedCarrier).code === ERROR_CODES.CONTENT_EXTRACT_FAILED
  );
}

/**
 * Appendix O.12 VERBATIM (spec L6747-6768) adapted per D-4a-22: the throw and
 * every debugLog use ERROR_CODES.CONTENT_EXTRACT_FAILED (never 'EXTRACTION_FAILED')
 * and the import path is @/core/error/debugLog. Tries the ordered strategies,
 * accepts the first with usable content (markdown.length > 0 || root), records
 * sourceUsed + fallbacksTried, and on total failure throws the typed carrier.
 *
 * D-4a-19 provenance refinement (the plan's Test 2 contract): when a strategy
 * internally fell back to a different source (the Readability fallback INSIDE
 * DefuddleStrategy — PATTERNS L162), the strategy id is recorded in
 * fallbacksTried — the layer's primary mode was attempted and did not win.
 */
export async function extractLayered(
  input: StrategyInput,
  strategies: IExtractionStrategy[], // ordered: Defuddle → APC-lite (Readability lives inside DefuddleStrategy)
): Promise<ExtractionOutcome> {
  const tried: string[] = [];
  for (const s of strategies) {
    if (!s.canHandle({ url: input.url, mode: input.mode })) continue;
    try {
      const result = await s.run(input);
      // Accept the first strategy that returns usable content.
      if ((result.markdown && result.markdown.length > 0) || result.root) {
        // D-4a-19: an internal fallback (result.source !== s.id) records the layer
        // whose primary mode was tried and did not win.
        if (result.source !== s.id && !tried.includes(s.id)) tried.push(s.id);
        return { result, sourceUsed: result.source, fallbacksTried: tried };
      }
      tried.push(s.id);
    } catch (e: unknown) {
      tried.push(s.id);
      debugLog(
        ERROR_CODES.CONTENT_EXTRACT_FAILED,
        e instanceof Error ? e.message : 'strategy error',
        {
          module: 'PageContentService',
          extra: { strategy: s.id, url: input.url },
        },
      );
    }
  }
  // Typed failure — never a bare error; the caller shows a user-facing message.
  throw contentExtractFailedCarrier('no strategy produced content', tried);
}

/**
 * The subset of PageContextBridge the service compiles against — injectable for
 * tests (the mock bridge implements exactly this surface).
 */
export interface PageContentBridgeLike {
  requestExtraction<TData = ExtractionPayload>(
    tabId: number,
    mode: 'default' | 'actionable',
    options?: { timeoutMs?: number },
  ): Promise<TData>;
  onMessage(cb: BridgeMessageListener): () => void;
}

export interface PageContentServiceOptions {
  /** 04a-07 bridge — injectable for tests; defaults to the real PageContextBridge. */
  bridge?: PageContentBridgeLike;
  /** 04a-05 per-tab cache — injectable for tests (deterministic clock). */
  cache?: PageContentCache;
  /** Ordered strategy chain for extractLayered — injectable for tests. */
  strategies?: IExtractionStrategy[];
  /** D-4a-05 delivery seam; defaults to the WorkspaceStore primary-writer draft. */
  deliverContext?: (ctx: PageContext) => void;
  /** D-4a-03 round-trip cap — defaults to EXTRACTION_TIMEOUT_MS (tests inject short). */
  timeoutMs?: number;
  /** The surface's active tab — the nav-signal / tabs-wiring anchor. */
  tabId?: number;
}

/**
 * D-4a-05 default delivery: the ONLY store mutation Phase 4a adds — the INERT
 * currentPageContext field via update(draft) (D-18: never journaled/serialized,
 * RESEARCH Q3). The existing primary-writer election + BroadcastBus
 * WORKSPACE_UPDATED mirror carry it to the secondary surface — no new
 * coordination path (T-4a-24 same-surface boundary, panel/standalone only).
 */
function defaultDeliverContext(ctx: PageContext): void {
  useWorkspaceStore.getState().update((draft) => {
    draft.currentPageContext = ctx;
  });
}

/** Factory for the typed CONTENT_EXTRACT_FAILED carrier (D-4a-22 canonical code). */
function contentExtractFailedCarrier(
  message: string,
  fallbacksTried: string[],
): ContentExtractFailedCarrier {
  const err = new Error(message) as ContentExtractFailedCarrier;
  err.name = 'ContentExtractFailedError';
  err.code = ERROR_CODES.CONTENT_EXTRACT_FAILED;
  err.fallbacksTried = fallbacksTried;
  return err;
}

/** D-4a-08 base-URL origin (PageContext.origin). Never throws — '' on malformed. */
function pageOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/** D-4a-08 base-URL hostname (PageContext.hostname). Never throws — '' on malformed. */
function pageHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * The D-4a-03 orchestrator. Per-tab in-flight coalescing, stale-safe reads,
 * eviction orchestration, redaction-before-index, and currentPageContext
 * delivery — the single extraction owner for every surface (§26.1), delivering
 * to cache + bridge + workspace + ephemeral index only (D-4a-06).
 */
export class PageContentService {
  private readonly bridge: PageContentBridgeLike;
  private readonly cache: PageContentCache;
  private readonly strategies: IExtractionStrategy[];
  private readonly deliverContext: (ctx: PageContext) => void;
  private readonly timeoutMs: number;
  private readonly tabId: number;
  /** D-4a-03 per-tab in-flight promise map (dedup — the service owns the map). */
  private readonly inFlight = new Map<number, Promise<ExtractionOutcome>>();
  /** D-4a-01 subscribed tabs — invalidation re-extracts them (coalesced). */
  private readonly subscribedModes = new Map<number, 'default' | 'actionable'>();
  /** D-4a-01 lightweight live contexts (title/url) from the host nav updates. */
  private readonly liveContexts = new Map<number, PageContext>();
  private detachBridge: (() => void) | null = null;

  constructor(options: PageContentServiceOptions = {}) {
    this.bridge = options.bridge ?? new PageContextBridge();
    this.cache = options.cache ?? new PageContentCache();
    this.strategies = options.strategies ?? [new DefuddleStrategy(), new ApcLiteStrategy()];
    this.deliverContext = options.deliverContext ?? defaultDeliverContext;
    this.timeoutMs = options.timeoutMs ?? EXTRACTION_TIMEOUT_MS;
    this.tabId = options.tabId ?? 0;
  }

  /**
   * D-4a-03 coalesced extraction: concurrent same-tab calls share ONE bridge
   * round-trip (the per-tab promise map dedups); the existing cache entry is
   * marked in-flight so LRU pressure never evicts it mid-extraction (D-4a-04).
   * Throws the typed CONTENT_EXTRACT_FAILED carrier on timeout/failure — never
   * a silent-empty result (D-4a-19).
   */
  extract(tabId: number, mode: 'default' | 'actionable'): Promise<ExtractionOutcome> {
    const existing = this.inFlight.get(tabId);
    if (existing) return existing;
    const extraction = this.runExtraction(tabId, mode);
    this.inFlight.set(tabId, extraction);
    this.cache.setInFlight(tabId, extraction);
    const settle = (): void => {
      if (this.inFlight.get(tabId) === extraction) {
        this.inFlight.delete(tabId);
        this.cache.setInFlight(tabId, null);
      }
    };
    void extraction.then(settle, settle);
    return extraction;
  }

  /**
   * Stale-safe read (Pitfall 7 / D-4a-03): after invalidation, a read AWAITS the
   * in-flight extraction and serves its fresh result — never the stale
   * pre-navigation entry. No in-flight extraction → undefined (no silent-empty).
   */
  async getContent(tabId: number): Promise<PageContext | undefined> {
    const entry = this.cache.get(tabId);
    if (entry) return entry.pageContext;
    const pending = this.inFlight.get(tabId);
    if (pending) {
      try {
        await pending;
      } catch {
        // Extraction failed (already debugLogged) — nothing fresh to serve.
        return undefined;
      }
      return this.cache.get(tabId)?.pageContext;
    }
    return undefined;
  }

  /**
   * D-4a-01/04 invalidation: drop the cache + index together (never a stale
   * serve); subscribed tabs re-extract (coalesced), unsubscribed mark-stale only
   * (no wasted round-trips for inactive surfaces — T-4a-25).
   */
  invalidate(tabId: number): void {
    this.cache.invalidate(tabId);
    if (this.subscribedModes.has(tabId)) {
      const mode = this.subscribedModes.get(tabId) ?? 'default';
      void this.extract(tabId, mode).catch(() => {
        // The typed CONTENT_EXTRACT_FAILED carrier was already debugLogged by
        // runExtraction; the workspace write is skipped — the card retains the
        // previous successful context (UI-SPEC E2 error row).
      });
    }
  }

  /** D-4a-01 subscription — active surface on this tab; invalidation re-extracts it. */
  subscribe(tabId: number, mode: 'default' | 'actionable' = 'default'): void {
    this.subscribedModes.set(tabId, mode);
    this.cache.setSubscribed(tabId, true);
  }

  /** D-4a-01 unsubscribe — invalidation falls back to mark-stale only. */
  unsubscribe(tabId: number): void {
    this.subscribedModes.delete(tabId);
    this.cache.setSubscribed(tabId, false);
  }

  /**
   * D-4a-15 lazy per-tab index: the ephemeral MiniSearch index over the
   * heading-chunked markdown is built on first query and memoized in the cache
   * entry (evicted with the extraction — never persisted). The chunks come from
   * the REDACTED markdown (D-4a-10).
   */
  queryIndex(tabId: number, query: string): ReturnType<MiniSearch['search']> {
    const entry = this.cache.get(tabId);
    if (!entry) return [];
    if (entry.indexHandle === null) {
      entry.indexHandle = buildPageIndex(
        chunkMarkdown(entry.markdown, {
          title: entry.pageContext.title,
          url: entry.pageContext.url,
          tabId,
        }),
      );
    }
    return entry.indexHandle.search(query, { prefix: true, boost: { title: 2, headingPath: 1.5 } });
  }

  /**
   * D-4a-01/04 wiring (panel-side, R-3): the bridge nav signal
   * (SPANavigationWatcher→host→bridge, 04a-07) + chrome.tabs.onUpdated/onRemoved.
   * The background never extracts — these listeners run in the side
   * panel/standalone surface only.
   */
  start(): void {
    if (this.detachBridge !== null) return;
    this.detachBridge = this.bridge.onMessage((message) => this.handleBridgeMessage(message));
    const tabs = typeof chrome !== 'undefined' ? chrome.tabs : undefined;
    if (tabs?.onUpdated?.addListener) tabs.onUpdated.addListener(this.handleTabUpdated);
    if (tabs?.onRemoved?.addListener) tabs.onRemoved.addListener(this.handleTabRemoved);
  }

  /** Detach the bridge listener + tabs listeners. */
  stop(): void {
    if (this.detachBridge !== null) {
      this.detachBridge();
      this.detachBridge = null;
    }
    const tabs = typeof chrome !== 'undefined' ? chrome.tabs : undefined;
    if (tabs?.onUpdated?.removeListener) tabs.onUpdated.removeListener(this.handleTabUpdated);
    if (tabs?.onRemoved?.removeListener) tabs.onRemoved.removeListener(this.handleTabRemoved);
  }

  /**
   * D-4a-01 nav signal: the host publishes the lightweight live-context update
   * (EXTRACT_PAGE_CONTENT with a `page` payload — never a request envelope).
   * Store the live context, then invalidate (mark stale; re-extract if the tab
   * is subscribed — coalesced).
   */
  private handleBridgeMessage(message: RuntimeEnvelope<unknown>): void {
    if (message.type !== MessageType.EXTRACT_PAGE_CONTENT) return;
    const payload = message.payload as { page?: PageContext } | undefined;
    if (typeof payload !== 'object' || payload === null || typeof payload.page !== 'object') return;
    this.liveContexts.set(this.tabId, payload.page as PageContext);
    this.invalidate(this.tabId);
  }

  /**
   * tabs.onUpdated (panel-side): a completed load marks the tab stale (D-4a-01).
   * The changeInfo is typed structurally — the installed @types/chrome exposes
   * no TabChangeInfo export; the runtime shape ({status, url}) is what the
   * listener contract carries.
   */
  private readonly handleTabUpdated = (
    tabId: number,
    changeInfo: { status?: string; url?: string },
  ): void => {
    if (changeInfo.status !== 'complete') return;
    this.invalidate(tabId);
  };

  /** tabs.onRemoved: drop cache + index together, forget subscription/live state. */
  private readonly handleTabRemoved = (tabId: number): void => {
    this.cache.remove(tabId);
    this.inFlight.delete(tabId);
    this.subscribedModes.delete(tabId);
    this.liveContexts.delete(tabId);
  };

  /**
   * One extraction round-trip: a single AbortController + EXTRACTION_TIMEOUT_MS
   * cap (the bridge's own timeout uses the same cap; the service timer is the
   * backstop that also covers a hung bridge). On timeout/failure the typed
   * CONTENT_EXTRACT_FAILED carrier surfaces — never a silent-empty result.
   */
  private runExtraction(tabId: number, mode: 'default' | 'actionable'): Promise<ExtractionOutcome> {
    const ac = new AbortController();
    return new Promise<ExtractionOutcome>((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        ac.abort();
        finishErr(
          contentExtractFailedCarrier(`extraction timed out after ${this.timeoutMs}ms`, []),
        );
      }, this.timeoutMs);
      const finishOk = (value: ExtractionOutcome): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      };
      const finishErr = (err: unknown): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        debugLog(
          ERROR_CODES.CONTENT_EXTRACT_FAILED,
          err instanceof Error ? err.message : 'extraction failed',
          {
            error: err instanceof Error ? err : undefined,
            module: 'PageContentService',
            extra: { tabId, mode },
          },
        );
        reject(err);
      };

      void this.bridge
        .requestExtraction<ExtractionPayload | RawNode[]>(tabId, mode, {
          timeoutMs: this.timeoutMs,
        })
        .then(async (data) => {
          if (done) return; // timed out — discard the late payload (never cache/deliver late)
          const outcome = await this.processPayload(tabId, mode, data);
          if (!done) finishOk(outcome);
        })
        .catch((err: unknown) => {
          // Preserve the 04a-07 typed bridge carrier (its own cap / malformed
          // reply); wrap anything else in the canonical carrier.
          if (isContentExtractFailed(err)) {
            finishErr(err);
          } else {
            finishErr(
              contentExtractFailedCarrier(
                err instanceof Error ? err.message : 'extraction failed',
                [],
              ),
            );
          }
        });
    });
  }

  /**
   * Bridge payload → StrategyInput → extractLayered → redact → cache → deliver.
   * D-4a-10: TraceRedactor runs BEFORE the cache write / index build — the
   * served markdown/html/meta and the lazily-built index never carry secrets.
   */
  private async processPayload(
    tabId: number,
    mode: 'default' | 'actionable',
    data: ExtractionPayload | RawNode[],
  ): Promise<ExtractionOutcome> {
    const live = this.liveContexts.get(tabId);
    let input: StrategyInput;
    let baseUrl: string;
    if (mode === 'actionable') {
      const root = (data as RawNode[])[0];
      baseUrl = live?.url ?? '';
      input = { url: baseUrl, title: live?.title ?? '', mode, raw: root };
    } else {
      const payload = data as ExtractionPayload;
      baseUrl = payload.baseUrl;
      // D-4a-08: the bridge supplies the effective base URL as a sibling field;
      // the strategy stamps the detached doc from input.url (04a-04 decision).
      input = { url: payload.baseUrl, title: live?.title ?? '', mode, html: payload.html };
    }

    const outcome = await extractLayered(input, this.strategies);

    // D-4a-10 redaction seam — panel-side, before any index/cache/log persist.
    const markdown = redact(outcome.result.markdown ?? '');
    const html =
      outcome.result.meta?.defuddleHtml !== undefined
        ? redact(outcome.result.meta.defuddleHtml)
        : undefined;
    const meta: Record<string, string> = {};
    for (const [k, v] of Object.entries(outcome.result.meta ?? {})) meta[k] = redact(v);

    const pageContext: PageContext = {
      url: baseUrl,
      origin: pageOrigin(baseUrl),
      hostname: pageHostname(baseUrl),
      title: meta.title ?? live?.title ?? '',
      markdown,
      html,
      meta,
      extractedAt: Date.now(),
    };
    this.cache.set(tabId, {
      pageContext,
      markdown,
      sourceUsed: outcome.sourceUsed,
      indexHandle: null,
    } satisfies PageCacheEntryInput);
    // D-4a-05: the primary-surface draft write — currentPageContext is inert
    // (D-18), never journaled/serialized; the secondary surface mirrors via the
    // existing WORKSPACE_UPDATED BroadcastBus path.
    this.deliverContext(pageContext);
    return outcome;
  }
}
