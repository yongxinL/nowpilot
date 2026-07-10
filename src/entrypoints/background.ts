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
    debugLog('debug', 'message received', { message });
    return true;
  });
});
