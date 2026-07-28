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

    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.storage.local.set({ onboardingComplete: false });
      } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
        chrome.storage.local.set({ onboardingComplete: true });
      }
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    });
  },
});
