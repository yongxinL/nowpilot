import { defineContentScript } from 'wxt/utils/define-content-script';
import { createEnvelope } from '../../core/runtime/RuntimeEnvelope';

/**
 * Pilot content script — extraction only.
 *
 * Phase-1 decision (operator, 2026-09-22 · `01-MIGRATION-INVENTORY.md`
 * § Resolved hand-off decisions item 1, Option C): this entrypoint is KEPT
 * but deliberately EXCLUDED from the Phase-1 build. The filename
 * `core.content.ts` matches none of WXT's content-script globs
 * (`content.[jt]s?(x)`, `content/index.[jt]s?(x)`, `*.content.[jt]s?(x)`,
 * `*.content/index.[jt]s?(x)` — WXT's `*` does not cross `/`), so the
 * generated manifest carries no `content_scripts` key and Phase 1 grants no
 * host access through it. The structure stays canonical: the directory
 * `src/entrypoints/content/` is what §5.1 describes.
 *
 * Do NOT rename this file to `index.ts` in Phase 1 — the name IS the
 * discovery switch. The removal condition is owned by Phase 6
 * (PageContentService), which restores `index.ts` and records the extraction
 * scope in a decision of its own, flipping
 * `tests/isolation/generated-manifest.test.ts` from the absence assertion to
 * a presence assertion in the same change.
 *
 * `matches` is pinned to the already-authorised ServiceNow host set instead
 * of the prototype's `<all_urls>`, so a future restore cannot silently widen
 * host access (T-1-12 / §16.4); the manifest gate asserts the declared array.
 */
export default defineContentScript({
  matches: ['*://*.service-now.com/*', '*://support.servicenow.com/*'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    // v0.1: extraction only — no UI rendering, no Shadow DOM.

    // WXT does not typecheck content scripts through tsconfig.json (matches
    // are handled by the build), so a runtime-only import is fine here. Do
    // NOT add a fetch(.) call in this file (Pitfall P3 / Plan 01-05
    // isolation gate).

    if (!document.body) return;

    let lastUrl = location.href;

    function detectNavigation(): void {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        chrome.runtime
          .sendMessage(
            createEnvelope(
              'SPA_NAVIGATION',
              { url: location.href },
              'content',
            ),
          )
          .catch(() => {});
      }
    }

    const observer = new MutationObserver(() => {
      detectNavigation();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    function onLocationChange(): void {
      detectNavigation();
    }

    document.addEventListener('wxt:locationchange', onLocationChange);

    chrome.runtime
      .sendMessage(
        createEnvelope(
          'CONTENT_SCRIPT_READY',
          { url: location.href },
          'content',
        ),
      )
      .catch(() => {});

    // Cleanup on content script unload
    return () => {
      observer.disconnect();
      document.removeEventListener('wxt:locationchange', onLocationChange);
    };
  },
});
