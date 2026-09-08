import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { WorkspaceRouter } from '@/core/workspace/WorkspaceRouter';

describe('WorkspaceRouter.openStandalone', () => {
  let getURL: Mock;
  let tabsQuery: Mock;
  let windowsGetCurrent: Mock;
  let tabsCreate: Mock;
  let tabsUpdate: Mock;

  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    getURL = chrome.runtime.getURL as unknown as Mock;
    tabsQuery = chrome.tabs.query as unknown as Mock;
    windowsGetCurrent = chrome.windows.getCurrent as unknown as Mock;
    tabsCreate = chrome.tabs.create as unknown as Mock;
    tabsUpdate = chrome.tabs.update as unknown as Mock;
    getURL.mockReturnValue('chrome-extension://test/standalone.html');
  });

  it('creates a new tab when no standalone tab exists', async () => {
    tabsQuery.mockResolvedValue([]);
    windowsGetCurrent.mockResolvedValue({ id: 1 });
    tabsCreate.mockResolvedValue({ id: 100 });

    await WorkspaceRouter.openStandalone();

    expect(tabsCreate).toHaveBeenCalled();
    expect(tabsUpdate).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().state.openedStandaloneTabId).toBe(100);
  });

  it('updates the existing tab instead of duplicating it', async () => {
    tabsQuery.mockResolvedValue([{ id: 100, windowId: 1 }]);
    windowsGetCurrent.mockResolvedValue({ id: 1 });
    tabsUpdate.mockResolvedValue({ id: 100 });

    await WorkspaceRouter.openStandalone();

    expect(tabsUpdate).toHaveBeenCalled();
    expect(tabsCreate).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().state.openedStandaloneTabId).toBe(100);
  });

  it('passes the page query param when provided', async () => {
    tabsQuery.mockResolvedValue([]);
    windowsGetCurrent.mockResolvedValue({ id: 1 });
    tabsCreate.mockResolvedValue({ id: 101 });

    await WorkspaceRouter.openStandalone({ page: 'options' });

    const createCall = tabsCreate.mock.calls[0][0] as { url: string };
    expect(createCall.url).toContain('page=options');
  });
});
