/**
 * WXT Content Script Entrypoint — page extraction pipeline.
 *
 * Composes four modules (PageExtractor, PageContextBridge, SPANavigationWatcher,
 * ContentChangeWatcher) into a single extraction pipeline per D-01.
 *
 * ## Key invariants
 * - ISOLATED world only (D-05) — no MAIN world access in v7.2
 * - URL blocklist check runs FIRST before any extraction or observation (D-26)
 * - Three extraction triggers: DOMContentLoaded, SPA nav (300ms debounced),
 *   visibilitychange (hidden → visible) per D-03, D-25
 * - chrome.runtime.onMessage handler returns true for async sendResponse
 *   (RESEARCH.md Pitfall 3: SW termination risk)
 * - Cleanup via ctx.onInvalidated() (WXT lifecycle)
 *
 * Pattern: WXT defineContentScript entrypoint (PATTERNS.md §6)
 */
import { defineContentScript } from 'wxt/utils/define-background';
import { PageExtractor } from '../core/content/PageExtractor';
import { PageContextBridge } from '../core/content/PageContextBridge';
import { SPANavigationWatcher } from '../core/content/SPANavigationWatcher';
import { ContentChangeWatcher } from '../core/content/ContentChangeWatcher';
import { debugLog } from '../core/utils/debugLog';
import type { PageContext } from '../core/content/PageContext';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED', // D-05: ISOLATED only for v7.2

  main(ctx: ContentScriptContext) {
    // --- Module composition (D-01: single entrypoint, four modules) ---
    const extractor = new PageExtractor();
    const bridge = new PageContextBridge();
    const navWatcher = new SPANavigationWatcher();
    const changeWatcher = new ContentChangeWatcher(); // dormant

    // --- URL blocklist check FIRST (D-26) ---
    if (!shouldExtract(location.href)) {
      debugLog('info', '[content.ts] Skipping extraction for blocked URL', {
        url: location.href,
      });
      return;
    }

    // --- Extract & send helper (D-03) ---
    async function extractAndSend(): Promise<void> {
      try {
        const pageContext: PageContext = extractor.extract(document);
        await bridge.sendPageContextUpdate(pageContext);
      } catch (err) {
        debugLog('error', '[content.ts] Extraction failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // --- Trigger 1: DOMContentLoaded (initial injection) ---
    if (document.readyState !== 'loading') {
      // DOM already fully parsed (document_idle means at least interactive)
      extractAndSend();
    } else {
      document.addEventListener('DOMContentLoaded', extractAndSend, { once: true });
    }

    // --- Trigger 2: SPA navigation (D-03, D-23, D-24: 300ms debounce) ---
    navWatcher.watch((_url: string, _title: string) => {
      // Re-check blocklist on SPA navigation (URL may have changed)
      if (!shouldExtract(location.href)) {
        debugLog('info', '[content.ts] Skipping extraction after SPA nav to blocked URL', {
          url: location.href,
        });
        return;
      }
      extractAndSend();
    });

    // --- Trigger 3: Tab visibility change (D-25: hidden → visible) ---
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Re-check blocklist on visibility restore
        if (!shouldExtract(location.href)) return;
        extractAndSend();
      }
    });

    // --- Message handler: explicit extraction request from SW (D-03) ---
    // Pattern from background.ts: chrome.runtime.onMessage with return true for async
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (
        message &&
        typeof message === 'object' &&
        (message as { type?: string }).type === 'GET_PAGE_CONTEXT_REQUEST'
      ) {
        extractAndSend()
          .then(() => {
            // Re-extract for the response (ensures latest content)
            const pageContext = extractor.extract(document);
            sendResponse({ success: true, pageContext });
          })
          .catch((err: Error) => {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        return true; // async response (RESEARCH.md Pitfall 3)
      }
    });

    // --- Cleanup on content script invalidation (WXT lifecycle) ---
    ctx.onInvalidated(() => {
      navWatcher.destroy();
      changeWatcher.destroy();
      debugLog('debug', '[content.ts] Content script invalidated — cleanup complete');
    });
  },
});

/**
 * URL blocklist helper (D-26).
 * Rejects sensitive protocols and NowPilot-owned pages.
 * Must run BEFORE any extraction or observer registration.
 */
function shouldExtract(url: string): boolean {
  if (!url) return false;

  // Block sensitive protocols
  const blocked = /^(chrome|chrome-extension|edge|about|view-source|devtools|file):\/\//i;
  if (blocked.test(url)) return false;

  // Block NowPilot-owned pages (Side Panel, Options, Standalone)
  try {
    const extId = chrome?.runtime?.id;
    if (extId && url.startsWith(`chrome-extension://${extId}`)) {
      return false;
    }
  } catch {
    // chrome.runtime not available (test environment) — allow extraction
  }

  return true;
}
