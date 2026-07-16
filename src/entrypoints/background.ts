import '../core/utils/chromePolyfill';
import { defineBackground } from 'wxt/utils/define-background';
import { debugLog } from '../core/utils/debugLog';

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
    }
  });

  chrome.commands.onCommand.addListener((command) => {
    debugLog('info', 'command received', { command });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && typeof message === 'object' && message.type === 'FETCH_PROXY') {
      const { url, options } = message as { type: string; url: string; options?: RequestInit };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      fetch(url, { ...options, signal: controller.signal })
        .then(async (response) => {
          clearTimeout(timeoutId);
          const body = await response.text();
          sendResponse({ ok: response.ok, status: response.status, body });
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          sendResponse({ ok: false, status: 0, body: err instanceof Error ? err.message : String(err) });
        });
      return true; // Keep channel open for async response
    }
    debugLog('debug', 'message received', { message });
    return true;
  });
});
