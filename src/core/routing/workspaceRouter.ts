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
  await openOrFocusTab(url);
}

/**
 * Opens or focuses the standalone tab with query parameters.
 * Used for deep-linking (e.g. from error toast to diagnostics).
 */
export async function openStandaloneWithParams(params: Record<string, string>): Promise<void> {
  const base = getStandaloneUrl();
  const qs = new URLSearchParams(params).toString();
  const url = `${base}${base.includes('?') ? '&' : '?'}${qs}`;
  await openOrFocusTab(url);
}

async function openOrFocusTab(url: string): Promise<void> {
  const baseUrl = url.split('?')[0];
  // Match any standalone tab regardless of query params
  const existingTabs = await chrome.tabs.query({ url: baseUrl });

  if (existingTabs.length > 0) {
    const tab = existingTabs[0];
    if (tab.id != null) {
      await chrome.tabs.update(tab.id, { active: true, url });
      await chrome.windows.update(tab.windowId, { focused: true });
      debugLog('info', 'WorkspaceRouter: focused existing Standalone tab', { tabId: tab.id, url });
      return;
    }
  }

  const newTab = await chrome.tabs.create({ url });
  debugLog('info', 'WorkspaceRouter: created new Standalone tab', { tabId: newTab.id, url });
}
