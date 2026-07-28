export default defineBackground({
  type: 'module',
  persistent: false,
  main() {
    // eslint-disable-next-line no-console
    console.log('NowPilot Background Service Worker initialized');

    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
      // side panel may not be available in all contexts
    });

    chrome.runtime.onStartup.addListener(() => {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    });

    chrome.runtime.onInstalled.addListener(() => {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    });
  },
});
