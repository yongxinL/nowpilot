declare const chrome: any;

// Extension service worker background script
export default defineBackground(() => {
  console.log('NowPilot Background Service Worker initialized');

  // Handle Chrome extension sidepanel open action
  if (typeof chrome !== 'undefined' && chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
  }

  // Listen for extension messages
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_ACTIVE_TAB_CONTEXT') {
        sendResponse({
          title: sender.tab?.title || 'Current Webpage',
          url: sender.tab?.url || window.location.href,
        });
      }
      return true;
    });
  }
});

function defineBackground(fn: () => void) {
  return fn;
}
