import { createEnvelope } from '../runtime/RuntimeEnvelope';
import { register } from '../messaging/MessageBus';
import { redactSensitive } from '../security/redactSensitive';
import type { SerializedPage } from '../content/DomSerializer';
import { DefuddleStrategy } from './strategies/DefuddleStrategy';
import { ReadabilityFallback } from './strategies/ReadabilityFallback';
import { ApcLiteStrategy } from './strategies/ApcLiteStrategy';
import type { IExtractionStrategy } from './strategies/IExtractionStrategy';
import { PageContentCache } from './PageContentCache';
import { buildPageContext } from './PageContentSerializer';
import { pageIndexBuilder } from './PageIndexBuilder';
import type { ExtractionError, ExtractionMode, ExtractionResult, StrategyResult } from './types';

/**
 * Page extraction orchestrator (D-07, D-10, D-11, D-13, D-14, D-16, D-18).
 *
 * Owns the full extraction pipeline: content-script capture request →
 * strategy fallback chain under a shared 5s global timeout → redaction →
 * typed PageContext construction → MiniSearch index population.
 * Operational failures are returned as `{ ok: false, error: ExtractionError }`
 * — never thrown (D-11).
 */
const GLOBAL_TIMEOUT_MS = 5000;

/** Sentinel rejected by the per-strategy timeout race. */
const STRATEGY_TIMEOUT = Symbol('strategy-timeout');

type ContentRequestResult = { ok: true; data: SerializedPage } | { ok: false; error: string };

export class PageContentService {
  private readonly strategies: IExtractionStrategy[];
  private readonly inFlight = new Map<string, Promise<ExtractionResult>>();
  private readonly pageContentCache = new PageContentCache();
  private _initialized = false;

  constructor(
    strategies: IExtractionStrategy[] = [
      new DefuddleStrategy(),
      new ReadabilityFallback(),
      new ApcLiteStrategy(),
    ],
  ) {
    this.strategies = strategies;
    this.registerSpaNavigationHandler();
  }

  /**
   * Initializes extension-page-side listeners (tabs.onUpdated navigation
   * invalidation, tabs.onRemoved cleanup). Call from the side panel / full
   * app entry point at startup — NOT from the service worker or content
   * script.
   */
  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'complete' && changeInfo.url) {
        this.reExtract(tabId);
      }
    });
    // D-14: destroy per-tab MiniSearch index on tab close — memory released,
    // data never persisted.
    chrome.tabs.onRemoved.addListener((tabId) => {
      pageIndexBuilder.removeTab(tabId);
      this.pageContentCache.invalidate(tabId);
    });
  }

  /**
   * Extracts page content for the given tab, mode and URL.
   *
   * Cache-first (D-17); concurrent calls for the same tab/url/mode coalesce
   * into a single in-flight extraction (D-18).
   */
  async extract(tabId: number, mode: ExtractionMode, url: string): Promise<ExtractionResult> {
    const cached = this.pageContentCache.get(tabId, url);
    if (cached) return cached;

    const key = `${tabId}:${url}:${mode}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = this.doExtract(tabId, mode, url);
    this.inFlight.set(key, promise);
    try {
      const result = await promise;
      if (result.ok) {
        this.pageContentCache.set(tabId, url, result);
      }
      return result;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /** Explicit cache + index invalidation API (D-13, D-14); the next extract is fresh. */
  reExtract(tabId: number): void {
    // Pitfall 5: clear old index entries before cache invalidation
    pageIndexBuilder.removeTab(tabId);
    this.pageContentCache.invalidate(tabId);
  }

  /**
   * D-03, D-14 wiring: SPA_NAVIGATION events from the content script
   * invalidate the index and cache for the sending tab when the announced
   * URL differs from the cached URL. Index cleanup happens BEFORE cache
   * invalidation so old index entries are gone before the next extraction
   * builds new ones (Pitfall 5: no stale chunk accumulation). Same-URL
   * navigations keep the cache hot.
   */
  private registerSpaNavigationHandler(): void {
    register<{ url: string; timestamp: number }>('SPA_NAVIGATION', (envelope, sender) => {
      const tabId = sender.tab?.id;
      if (tabId === undefined) return;
      // ORDER MATTERS: index cleanup before cache invalidation (Pitfall 5)
      pageIndexBuilder.removeTab(tabId);
      this.pageContentCache.invalidateIfChanged(tabId, envelope.payload.url);
    });
  }

  private async doExtract(
    tabId: number,
    mode: ExtractionMode,
    url: string,
  ): Promise<ExtractionResult> {
    const capture = await this.requestContentFromTab(tabId);
    if (!capture.ok) {
      return {
        ok: false,
        error: { code: 'CAPTURE_FAILED', message: capture.error, strategiesAttempted: [] },
      };
    }

    const serialized = capture.data;
    const deadline = Date.now() + GLOBAL_TIMEOUT_MS;
    const strategiesAttempted: string[] = [];
    const applicable = this.strategies.filter((s) => s.canHandle({ url, mode }));
    let lastFailureCode: ExtractionError['code'] = 'NO_CONTENT';

    for (const strategy of applicable) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return {
          ok: false,
          error: {
            code: 'TIMEOUT',
            message: 'Global extraction timeout exceeded',
            strategiesAttempted,
          },
        };
      }

      let result: StrategyResult;
      try {
        result = await Promise.race([
          strategy.run({ url, title: serialized.title, mode, html: serialized.html }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(STRATEGY_TIMEOUT), remaining);
          }),
        ]);
      } catch (err) {
        strategiesAttempted.push(strategy.id);
        lastFailureCode = err === STRATEGY_TIMEOUT ? 'TIMEOUT' : 'PARSE_ERROR';
        continue;
      }
      strategiesAttempted.push(strategy.id);

      // D-07: confidence gate at orchestrator level — a low-confidence Defuddle
      // result (< 500 chars) falls through to ReadabilityFallback. Readability
      // self-throws below the same threshold, so only defuddle results need
      // the explicit gate here.
      if (mode === 'default' && result.source === 'defuddle' && (result.markdown ?? '').length < 500) {
        continue;
      }

      try {
        // D-19: redact secrets from extracted markdown BEFORE PageContext
        // construction — redacted text enters the AI pipeline via pageContext.
        const markdown = result.markdown !== undefined ? redactSensitive(result.markdown) : undefined;
        const pageContext = buildPageContext(mode, serialized, { ...result, markdown });

        // D-14: auto-build the MiniSearch index after successful extraction.
        // Index is built BEFORE the result is cached — cache hits return
        // pre-built results with the index already populated.
        if (pageContext.mode === 'default') {
          pageIndexBuilder.buildFromText(tabId, 'default', pageContext.markdown);
        } else {
          pageIndexBuilder.buildFromTree(tabId, pageContext.apcLiteTree);
        }

        return { ok: true, pageContext };
      } catch {
        lastFailureCode = 'PARSE_ERROR';
        continue;
      }
    }

    return {
      ok: false,
      error: {
        code: lastFailureCode,
        message: 'All strategies failed to extract content',
        strategiesAttempted,
      },
    };
  }

  /**
   * Requests the serialized page from the content script (D-04):
   * EXTRACT_PAGE_CONTENT envelope → MessageBus handler in the content script →
   * synchronous SerializedPage return → sendResponse via MessageBus.init().
   */
  private async requestContentFromTab(tabId: number): Promise<ContentRequestResult> {
    try {
      const envelope = createEnvelope('EXTRACT_PAGE_CONTENT', {}, 'sidepanel');
      const response = (await chrome.tabs.sendMessage(tabId, envelope)) as
        | SerializedPage
        | undefined;
      if (
        response &&
        typeof response === 'object' &&
        typeof response.html === 'string' &&
        typeof response.url === 'string'
      ) {
        return { ok: true, data: response };
      }
      return { ok: false, error: 'Content script returned an invalid response' };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Module-level singleton for extension-page consumers. */
export const pageContentService = new PageContentService();
