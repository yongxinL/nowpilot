import { debugLog } from '../utils/debugLog';

let _standaloneUrl: string | undefined;

export function getStandaloneUrl(): string {
  if (!_standaloneUrl) {
    _standaloneUrl = chrome.runtime.getURL('/standalone.html');
  }
  return _standaloneUrl;
}

export async function openStandalone(): Promise<void> {
  const url = getStandaloneUrl();
  const existingTabs = await chrome.tabs.query({ url });

  if (existingTabs.length > 0) {
    const tab = existingTabs[0];
    if (tab.id != null) {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      debugLog('info', 'WorkspaceRouter: focused existing Standalone tab', { tabId: tab.id });
      return;
    }
  }

  const newTab = await chrome.tabs.create({ url });
  debugLog('info', 'WorkspaceRouter: created new Standalone tab', { tabId: newTab.id });
}
