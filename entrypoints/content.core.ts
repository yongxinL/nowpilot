import { createEnvelope } from '../src/core/runtime/RuntimeEnvelope';
import { init, register } from '../src/core/messaging/MessageBus';
import { extractPageContentHandler } from '../src/core/content/PageContextBridge';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    // v0.1: extraction only — no UI rendering, no Shadow DOM

    if (!document.body) return;

    // MessageBus must be initialized before handlers are registered (D-04).
    // The EXTRACT_PAGE_CONTENT handler's synchronous SerializedPage return
    // value is forwarded to sendResponse by MessageBus.init().
    init();
    register('EXTRACT_PAGE_CONTENT', extractPageContentHandler);

    let lastUrl = location.href;

    // D-03: SPA navigation detection → outbound RuntimeEnvelope event.
    // Shares the URL-change check between MutationObserver and
    // `wxt:locationchange` (both fire on SPA route changes).
    function notifyNavigation(): void {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      const envelope = createEnvelope(
        'SPA_NAVIGATION',
        { url: location.href, timestamp: Date.now() },
        'content',
      );
      chrome.runtime.sendMessage(envelope).catch(() => {});
    }

    const observer = new MutationObserver(() => {
      notifyNavigation();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener('wxt:locationchange', notifyNavigation);

    // Cleanup on content script unload
    return () => {
      observer.disconnect();
      document.removeEventListener('wxt:locationchange', notifyNavigation);
    };
  },
});
