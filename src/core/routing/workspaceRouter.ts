import { debugLog } from '../utils/debugLog';

let _fullAppUrl: string | undefined;

export function getFullAppUrl(): string {
  if (!_fullAppUrl) {
    _fullAppUrl = chrome.runtime.getURL('/standalone.html');
  }
  return _fullAppUrl;
}

export async function openFullApp(): Promise<void> {
  const url = getFullAppUrl();
  const existingTabs = await chrome.tabs.query({ url });

  if (existingTabs.length > 0) {
    const tab = existingTabs[0];
    if (tab.id != null) {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      debugLog('info', 'WorkspaceRouter: focused existing Full App tab', { tabId: tab.id });
      return;
    }
  }

  const newTab = await chrome.tabs.create({ url });
  debugLog('info', 'WorkspaceRouter: created new Full App tab', { tabId: newTab.id });
}
