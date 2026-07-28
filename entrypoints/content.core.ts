export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    // v0.1: extraction only — no UI rendering, no Shadow DOM

    if (!document.body) return;

    let lastUrl = location.href;

    function detectNavigation(): void {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        chrome.runtime.sendMessage({
          type: 'SPA_NAVIGATION',
          url: location.href,
          timestamp: Date.now(),
        }).catch(() => {});
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

    chrome.runtime.sendMessage({
      type: 'CONTENT_SCRIPT_READY',
      url: location.href,
      timestamp: Date.now(),
    }).catch(() => {});

    // Cleanup on content script unload
    return () => {
      observer.disconnect();
      document.removeEventListener('wxt:locationchange', onLocationChange);
    };
  },
});
