import { useWorkspaceStore } from './WorkspaceStore';

export const WorkspaceRouter = {
  async openStandalone(opts?: { page?: string }): Promise<void> {
    const store = useWorkspaceStore.getState();
    await store.persist();
    const state = store.state;
    const url = new URL(chrome.runtime.getURL('standalone.html'));
    url.searchParams.set('workspaceId', state.workspaceId);
    url.searchParams.set('conversationId', state.conversationId);
    if (opts?.page) url.searchParams.set('page', opts.page);
    const existing = await chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html') + '*' });
    const currentWindow = await chrome.windows.getCurrent();
    const inCurrent = existing.find((t) => t.windowId === currentWindow.id);
    if (inCurrent && inCurrent.id !== undefined) {
      await chrome.tabs.update(inCurrent.id, { active: true, url: url.toString() });
      store.setState({ openedStandaloneTabId: inCurrent.id });
    } else {
      const created = await chrome.tabs.create({ url: url.toString() });
      if (created.id !== undefined) store.setState({ openedStandaloneTabId: created.id });
    }
  },
  async focusSidePanel(): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (tabId !== undefined) {
      await chrome.sidePanel.open({ tabId });
    }
  },
};
