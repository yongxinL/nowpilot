export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    // v0.1: extraction only — no UI rendering, no Shadow DOM

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

    document.addEventListener('wxt:locationchange', () => {
      detectNavigation();
    });

    chrome.runtime.sendMessage({
      type: 'CONTENT_SCRIPT_READY',
      url: location.href,
      timestamp: Date.now(),
    }).catch(() => {});
  },
});
