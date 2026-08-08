// tests/core/workspace/WorkspaceRouter.test.ts — Pitfall 1 guard tests (WSPC-02):
// openSidePanel runs a CALLBACK-STYLE chrome.tabs.query chain and never awaits it,
// so the user-gesture flag survives into chrome.sidePanel.open (crbug 1478648);
// openStandalone dedupes via update-or-create (W-12: never a second standalone
// surface, no popup window) and records the opened tab id on the store. fakeBrowser
// does not implement tabs/sidePanel/runtime.getURL, so the tests mock them
// (01-03 precedent) — the router source drives the global chrome which WxtVitest
// maps to fakeBrowser.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { WorkspaceRouter } from '@/core/workspace/WorkspaceRouter';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import type { WorkspaceState } from '@/types/workspace';

const STANDALONE_URL = 'chrome-extension://abcdefghijkl/standalone.html';

function freshWorkspace(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    workspaceId: 'ws-router',
    conversationId: 'conv-router',
    pinnedTabs: [],
    selectedNotes: [],
    activeSurface: 'sidepanel',
    version: 0,
    updatedAt: 1000,
    ...overrides,
  };
}

let sidePanelOpen: ReturnType<typeof vi.fn>;

/** Callback-style tabs.query mock — the router passes its gesture callback here. */
function mockTabsQuery(tabs: Array<Partial<chrome.tabs.Tab>>): ReturnType<typeof vi.fn> {
  const querySpy = vi.spyOn(fakeBrowser.tabs, 'query');
  querySpy.mockImplementation(((_info: unknown, callback: (result: chrome.tabs.Tab[]) => void) => {
    const result = tabs as chrome.tabs.Tab[];
    callback(result);
    return Promise.resolve(result);
  }) as unknown as typeof fakeBrowser.tabs.query);
  return querySpy;
}

beforeEach(() => {
  useWorkspaceStore.setState({ workspace: freshWorkspace(), isReady: true });
  vi.spyOn(fakeBrowser.runtime, 'getURL').mockReturnValue(STANDALONE_URL);
  sidePanelOpen = vi.fn().mockResolvedValue(undefined);
  (fakeBrowser as unknown as Record<string, unknown>).sidePanel = { open: sidePanelOpen };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WorkspaceRouter.openSidePanel (Pitfall 1 guard)', () => {
  it('calls tabs.query then sidePanel.open with the resolved tabId (callback chain)', async () => {
    const querySpy = mockTabsQuery([{ id: 7, windowId: 3 }]);

    await WorkspaceRouter.openSidePanel();

    expect(querySpy).toHaveBeenCalledWith(
      { active: true, currentWindow: true },
      expect.any(Function),
    );
    expect(sidePanelOpen).toHaveBeenCalledWith({ tabId: 7 });
  });

  it('falls back to triggerTabId when no active tab resolves', async () => {
    mockTabsQuery([]);

    await WorkspaceRouter.openSidePanel(99);

    expect(sidePanelOpen).toHaveBeenCalledWith({ tabId: 99 });
  });

  it('uses windowId when neither a tab id nor triggerTabId is available', async () => {
    mockTabsQuery([{ windowId: 5 }]);

    await WorkspaceRouter.openSidePanel();

    expect(sidePanelOpen).toHaveBeenCalledWith({ windowId: 5 });
  });

  it('logs debugLog and does not throw when tabs.query fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation((() => {
      throw new Error('query boom');
    }) as unknown as typeof fakeBrowser.tabs.query);

    await expect(WorkspaceRouter.openSidePanel()).resolves.toBeUndefined();

    expect(sidePanelOpen).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('WorkspaceRouter.openStandalone (update-or-create dedupe, W-12)', () => {
  it('updates + focuses an existing standalone tab and never creates a second one', async () => {
    mockTabsQuery([{ id: 42, windowId: 8 }]);
    vi.spyOn(fakeBrowser.tabs, 'update').mockImplementation(((
      tabId: number,
      props: { active?: boolean },
    ) =>
      Promise.resolve({
        id: tabId,
        ...props,
      } as chrome.tabs.Tab)) as unknown as typeof fakeBrowser.tabs.update);
    const windowsUpdateSpy = vi.spyOn(fakeBrowser.windows, 'update').mockResolvedValue({
      id: 8,
    } as unknown as Awaited<ReturnType<typeof fakeBrowser.windows.update>>);
    const createSpy = vi.spyOn(fakeBrowser.tabs, 'create');

    await WorkspaceRouter.openStandalone();

    expect(createSpy).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().workspace.openedStandaloneTabId).toBe(42);
    expect(windowsUpdateSpy).toHaveBeenCalledWith(8, { focused: true });
  });

  it('creates a standalone tab when none exists and records its id in the store', async () => {
    mockTabsQuery([]);
    const createSpy = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({
      id: 77,
      url: STANDALONE_URL,
    } as unknown as Awaited<ReturnType<typeof fakeBrowser.tabs.create>>);
    const updateSpy = vi.spyOn(fakeBrowser.tabs, 'update');

    await WorkspaceRouter.openStandalone();

    expect(createSpy).toHaveBeenCalledWith({ url: STANDALONE_URL });
    expect(updateSpy).not.toHaveBeenCalled();
    // The tab id is recorded after the create promise resolves.
    await Promise.resolve();
    await Promise.resolve();
    expect(useWorkspaceStore.getState().workspace.openedStandaloneTabId).toBe(77);
  });

  it('logs debugLog and does not throw when tabs.query fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation((() => {
      throw new Error('query boom');
    }) as unknown as typeof fakeBrowser.tabs.query);

    await expect(WorkspaceRouter.openStandalone()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
