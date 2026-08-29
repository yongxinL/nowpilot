import { defineContentScript } from 'wxt/utils/define-content-script';
import { createEnvelope } from '../../src/core/runtime/RuntimeEnvelope';
import { startWatcher } from '../../src/core/content/SPANavigationWatcher';
import { initBridge } from '../../src/core/content/PageContextBridge';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main(ctx) {
    // v0.1: extraction only — no UI rendering, no Shadow DOM.

    // Note: the content script's adjacent `entrypoints/` and `src/` paths are
    // and must stay adjacent (D-07a: entrypoints/ at repo root). WXT does not
    // typecheck content scripts through tsconfig.json (matches are handled by
    // the build), so runtime-only relative imports are fine here. Do NOT add a
    // fetch(.) call in this file (Pitfall P3 / Plan 01-05 isolation gate).

    if (!document.body) return;

    // D-85 thin delegation: the shells own serialization (ContentScriptHost),
    // SPA-nav detection (SPANavigationWatcher) and the envelope round-trip
    // (PageContextBridge). The shell-level onNavigate seam is a no-op today —
    // the bridge's own watcher sends SPA_NAVIGATION/PAGE_LIVE_CONTEXT; future
    // surface call-sites (Phase 7/15) attach here.
    const onNavigate = (_newUrl: string, _oldUrl: string): void => {};

    const cleanupBridge = initBridge(ctx, { onNavigate });
    const cleanupWatcher = startWatcher(ctx, onNavigate);

    chrome.runtime
      .sendMessage(createEnvelope('CONTENT_SCRIPT_READY', { url: location.href }, 'content'))
      .catch(() => {});

    // Cleanup on content script unload
    return () => {
      cleanupWatcher();
      cleanupBridge();
    };
  },
});