/**
 * WXT Content Script Entrypoint — page extraction pipeline.
 *
 * Phase 8.1: Replaced Readability-primary extraction with AxDomWalker DOM+ARIA tree
 * as primary engine. PageExtractor (Readability+Turndown) retained as fallback.
 *
 * Composes AxDomWalker, PageExtractor (fallback), PageContextBridge, SPANavigationWatcher,
 * ContentChangeWatcher into a single extraction pipeline.
 *
 * ## Key invariants
 * - ISOLATED world only (D-05) — no MAIN world access
 * - URL blocklist check runs FIRST before any extraction or observation (D-26)
 * - Three extraction triggers: DOMContentLoaded, SPA nav (300ms debounced),
 *   visibilitychange (hidden → visible) per D-03, D-25
 * - AxDomWalker primary extraction; Readability fallback for article-heavy pages
 * - chrome.runtime.onMessage handler returns true for async sendResponse
 *   (RESEARCH.md Pitfall 3: SW termination risk)
 * - Cleanup via ctx.onInvalidated() (WXT lifecycle)
 *
 * Pattern: WXT defineContentScript entrypoint (PATTERNS.md §6)
 */
import { defineContentScript } from 'wxt/utils/define-content-script';
import { walk as walkDom, resetIdCounter } from '../core/content/AxDomWalker';
import { hydratePageContext } from '../core/extraction/hydratePageContext';
import { PageExtractor } from '../core/content/PageExtractor';
import { PageContextBridge } from '../core/content/PageContextBridge';
import { SPANavigationWatcher } from '../core/content/SPANavigationWatcher';
import { ContentChangeWatcher } from '../core/content/ContentChangeWatcher';
import { debugLog } from '../core/utils/debugLog';
import { GET_PAGE_CONTEXT_REQUEST, EXTRACT_PAGE_CONTENT_TREE } from '../core/messaging/pageMessages';
import type { PageContext } from '../core/content/PageContext';
import type { RawNode } from '../core/extraction/apcLite.types';
import type { ExtractionTraceStep } from '../core/messaging/pageMessages';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',

  main(ctx: ContentScriptContext) {
    if ((window as unknown as Record<string, boolean>).__nowpilotContentScriptActive) {
      debugLog('debug', '[content.ts] Re-entry guard triggered — content script already active', { url: location.href });
      return;
    }
    (window as unknown as Record<string, boolean>).__nowpilotContentScriptActive = true;
    debugLog('debug', '[content.ts] Content script activated', { url: location.href, readyState: document.readyState });

    const readabilityExtractor = new PageExtractor();
    const bridge = new PageContextBridge();
    const navWatcher = new SPANavigationWatcher();
    const changeWatcher = new ContentChangeWatcher();

    if (!shouldExtract(location.href)) {
      debugLog('info', '[content.ts] Skipping extraction for blocked URL', { url: location.href });
      return;
    }

    function extractPageContext(traceSteps?: ExtractionTraceStep[]): PageContext {
      const start = performance.now();

      try {
        resetIdCounter();
        const rawNode = walkDom(document.body);
        const walkDuration = Math.round(performance.now() - start);
        traceSteps?.push({ step: 'axdom_walk', status: 'ok', durationMs: walkDuration, detail: `DOM+ARIA tree built`, url: location.href });

        return hydratePageContext(rawNode, location.href, document.title);
      } catch (walkErr) {
        const walkMsg = walkErr instanceof Error ? walkErr.message : String(walkErr);
        debugLog('warn', '[content.ts] AxDomWalker failed, falling back to Readability', { error: walkMsg, url: location.href });
        traceSteps?.push({ step: 'axdom_walk', status: 'fail', durationMs: Math.round(performance.now() - start), detail: walkMsg, url: location.href });

        return readabilityExtractor.extract(document, traceSteps);
      }
    }

    async function extractAndSend(trigger: string): Promise<void> {
      const overallStart = performance.now();
      const traceSteps: ExtractionTraceStep[] = [];
      traceSteps.push({ step: `trigger_${trigger}`, status: 'start', durationMs: 0, detail: `triggered by ${trigger}`, url: location.href });

      debugLog('debug', '[content.ts] Extraction triggered', { trigger, url: location.href });
      try {
        const pageContext = extractPageContext(traceSteps);
        const bridgeStart = performance.now();
        await bridge.sendPageContextUpdate(pageContext);
        traceSteps.push({ step: 'bridge_send', status: 'ok', durationMs: Math.round(performance.now() - bridgeStart), detail: `${pageContext.extractionType}/${pageContext.extractionQuality}`, url: location.href });

        const totalDuration = Math.round(performance.now() - overallStart);
        debugLog('info', '[content.ts] Extraction complete', {
          trigger,
          url: location.href,
          extractionType: pageContext.extractionType,
          extractionQuality: pageContext.extractionQuality,
          markdownLength: pageContext.markdown?.length ?? 0,
          totalDurationMs: totalDuration,
          steps: traceSteps.length,
        });

        const traceId = crypto.randomUUID();
        try {
          await chrome.storage.session.set({
            [`np_ext_${traceId}`]: {
              traceId,
              url: location.href,
              steps: traceSteps,
              totalDurationMs: totalDuration,
              extractionType: pageContext.extractionType,
              extractionQuality: pageContext.extractionQuality,
              timestamp: Date.now(),
            },
          });
          debugLog('debug', '[content.ts] Extraction trace written to session storage', {
            traceId,
            steps: traceSteps.length,
            durationMs: totalDuration,
          });
        } catch (traceErr) {
          debugLog('error', '[content.ts] Failed to write extraction trace', {
            error: traceErr instanceof Error ? traceErr.message : String(traceErr),
          });
        }
      } catch (err) {
        debugLog('error', '[content.ts] Extraction failed', {
          trigger,
          error: err instanceof Error ? err.message : String(err),
          url: location.href,
        });
        traceSteps.push({ step: 'extraction_error', status: 'fail', durationMs: Math.round(performance.now() - overallStart), detail: err instanceof Error ? err.message : String(err), url: location.href });

        const failTraceId = crypto.randomUUID();
        try {
          await chrome.storage.session.set({
            [`np_ext_${failTraceId}`]: {
              traceId: failTraceId,
              url: location.href,
              steps: traceSteps,
              totalDurationMs: Math.round(performance.now() - overallStart),
              timestamp: Date.now(),
              failed: true,
            },
          });
        } catch {
        }
      }
    }

    if (document.readyState !== 'loading') {
      debugLog('debug', '[content.ts] Trigger: immediate extraction (document already loaded)', { url: location.href });
      extractAndSend('dom_loaded');
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        debugLog('debug', '[content.ts] Trigger: DOMContentLoaded', { url: location.href });
        extractAndSend('dom_content_loaded');
      }, { once: true });
    }

    navWatcher.watch((_url: string, _title: string) => {
      if (!shouldExtract(location.href)) {
        debugLog('info', '[content.ts] Skipping extraction after SPA nav to blocked URL', { url: location.href });
        return;
      }
      debugLog('debug', '[content.ts] Trigger: SPA navigation', { url: location.href });
      extractAndSend('spa_nav');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (!shouldExtract(location.href)) {
          debugLog('info', '[content.ts] Skipping extraction on visibility restore for blocked URL', { url: location.href });
          return;
        }
        extractAndSend('visibility_restore');
      }
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== 'object') return false;

      const msgType = (message as { type?: string }).type;

      if (msgType === GET_PAGE_CONTEXT_REQUEST) {
        debugLog('debug', '[content.ts] Trigger: GET_PAGE_CONTEXT_REQUEST', { url: location.href });
        try {
          const pageContext = extractPageContext();
          sendResponse({ success: true, page: pageContext });
          bridge.sendPageContextUpdate(pageContext).catch(() => {});
        } catch (err: unknown) {
          sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
        return true;
      }

      if (msgType === EXTRACT_PAGE_CONTENT_TREE) {
        debugLog('info', '[content.ts] EXTRACT_PAGE_CONTENT_TREE handler fired', { url: location.href });
        try {
          resetIdCounter();
          const raw = walkDom(document.body);
          debugLog('info', '[content.ts] DOM tree walk complete', {
            nodeCount: raw.children?.length ?? 0,
            url: location.href,
          });
          sendResponse({
            ok: true,
            data: { raw, url: location.href, title: document.title },
          });
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          debugLog('error', '[content.ts] EXTRACT_PAGE_CONTENT_TREE walk failed', { error: errMsg, url: location.href });
          sendResponse({
            ok: false,
            error: { code: 'CONTENT_EXTRACT_FAILED', message: errMsg, retryable: false },
          });
        }
        return true;
      }

      return false;
    });

    ctx.onInvalidated(() => {
      navWatcher.destroy();
      changeWatcher.destroy();
      debugLog('debug', '[content.ts] Content script invalidated — cleanup complete');
    });
  },
});

function shouldExtract(url: string): boolean {
  if (!url) {
    debugLog('debug', '[content.ts] shouldExtract: empty URL', { url });
    return false;
  }

  const blocked = /^(chrome|chrome-extension|edge|about|view-source|devtools|file):\/\//i;
  if (blocked.test(url)) {
    debugLog('debug', '[content.ts] shouldExtract: blocked protocol', { url: url.slice(0, 50) });
    return false;
  }

  try {
    const extId = chrome?.runtime?.id;
    if (extId && url.startsWith(`chrome-extension://${extId}`)) {
      debugLog('debug', '[content.ts] shouldExtract: own extension page', { url: url.slice(0, 80) });
      return false;
    }
  } catch {
  }

  debugLog('debug', '[content.ts] shouldExtract: allowed', { url: url.slice(0, 80) });
  return true;
}
