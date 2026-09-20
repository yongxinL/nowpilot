import { defineContentScript } from 'wxt/utils/define-content-script';
import { createEnvelope } from '../../src/core/runtime/RuntimeEnvelope';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    // v0.1: extraction only — no UI rendering, no Shadow DOM.

    // Note: the content script's adjacent `entrypoints/` and `src/` paths are
    // and must stay adjacent (D-07a: entrypoints/ at repo root). WXT does not
    // typecheck content scripts through tsconfig.json (matches are handled by
    // the build), so a runtime-only import is fine here. Do NOT add a fetch(.)
    // call in this file (Pitfall P3 / Plan 01-05 isolation gate).

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
