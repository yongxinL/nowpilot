import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWorkspaceStore } from '../../../src/core/workspace/WorkspaceStore';

// Mock chrome API — callback-style (matches WorkspaceRouter.ts convention)
const chromeApi = {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    lastError: undefined as { message: string } | undefined,
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  windows: {
    update: vi.fn(),
  },
};

vi.stubGlobal('chrome', chromeApi);

// Import AFTER stubbing chrome so WorkspaceRouter.ts sees the mock
import { openStandalone, hydrateFromURL } from '../../../src/core/workspace/WorkspaceRouter';

describe('WorkspaceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeApi.runtime.lastError = undefined;
    // Reset store between tests
    useWorkspaceStore.getState().reset();
  });

  describe('openStandalone — tab dedup + URL shape (D-04, D-07)', () => {
    it('queries by standalone.html (not the legacy app.html)', () => {
      chromeApi.tabs.query.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([]),
      );
      chromeApi.tabs.create.mockImplementation(
        (opts: chrome.tabs.CreateProperties, cb: (tab: chrome.tabs.Tab) => void) =>
          cb({ id: 42, windowId: 1 } as chrome.tabs.Tab),
      );

      openStandalone('ws1');

      // Must have queried with the standalone URL pattern (NOT app.html).
      const queryArg = chromeApi.tabs.query.mock.calls[0]?.[0] as { url?: string };
      expect(queryArg.url).toContain('standalone.html');
      expect(queryArg.url).not.toContain('app.html');
    });

    it('creates a new tab when no existing standalone tab is found (no existing-tab update)', () => {
      chromeApi.tabs.query.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([]),
      );
      chromeApi.tabs.create.mockImplementation(
        (opts: chrome.tabs.CreateProperties, cb: (tab: chrome.tabs.Tab) => void) =>
          cb({ id: 99, windowId: 7 } as chrome.tabs.Tab),
      );

      openStandalone('ws1');

      expect(chromeApi.tabs.create).toHaveBeenCalledTimes(1);
      const createdOpts = chromeApi.tabs.create.mock.calls[0]?.[0] as {
        url: string;
      };
      expect(createdOpts.url).toContain('standalone.html?workspaceId=ws1');
      // Cross-window focus must NOT happen on the create path.
      expect(chromeApi.windows.update).not.toHaveBeenCalled();
    });

    it('focuses the existing tab (no duplicate create) and cross-window focuses when found', () => {
      const existingTab = { id: 123, windowId: 5 } as chrome.tabs.Tab;
      chromeApi.tabs.query.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([existingTab]),
      );
      chromeApi.tabs.update.mockImplementation(
        (_id: number, _props: chrome.tabs.UpdateProperties, cb?: () => void) => cb?.(),
      );
      chromeApi.windows.update.mockImplementation(
        (_id: number, _props: chrome.windows.UpdateInfo, cb?: (w: chrome.windows.Window) => void) => cb?.({} as chrome.windows.Window),
      );

      openStandalone('ws1');

      expect(chromeApi.tabs.update).toHaveBeenCalledWith(123, { active: true }, expect.any(Function));
      expect(chromeApi.windows.update).toHaveBeenCalledWith(5, { focused: true }, expect.any(Function));
      expect(chromeApi.tabs.create).not.toHaveBeenCalled();
    });

    it('records openedStandaloneTabId (not openedFullAppTabId) on the store', () => {
      chromeApi.tabs.query.mockImplementation((_q: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) =>
        cb([]),
      );
      chromeApi.tabs.create.mockImplementation(
        (opts: chrome.tabs.CreateProperties, cb: (tab: chrome.tabs.Tab) => void) =>
          cb({ id: 77, windowId: 1 } as chrome.tabs.Tab),
      );

      openStandalone('ws1');

      // Store now exposes openedStandaloneTabId (D-07) — and only that.
      const state = useWorkspaceStore.getState() as unknown as Record<string, unknown>;
      expect(state.openedStandaloneTabId).toBe(77);
      expect('openedFullAppTabId' in state).toBe(false);
    });
  });

  describe('hydrateFromURL — must route through set(), not Object.assign (H2, T-01-16)', () => {
    it('goes through setWorkspaceId (persistence + subscribers fire)', () => {
      const subscriber = vi.fn();
      const unsubscribe = useWorkspaceStore.subscribe(subscriber);
      subscriber.mockClear(); // drop the initial subscribe-call

      hydrateFromURL(new URLSearchParams('workspaceId=ws2&conversationId=c1'));

      const state = useWorkspaceStore.getState();
      expect(state.workspaceId).toBe('ws2');
      expect(state.conversationId).toBe('c1');

      // The key assertion: a subscriber registered BEFORE hydrateFromURL fires
      // at least once — proving the path goes through zustand's set().
      // (Object.assign on getState() would silently bypass this.)
      expect(subscriber).toHaveBeenCalled();

      unsubscribe();
    });

    it('no-op when both params are absent', () => {
      const beforeWsId = useWorkspaceStore.getState().workspaceId;
      const beforeConvId = useWorkspaceStore.getState().conversationId;

      hydrateFromURL(new URLSearchParams(''));

      // Initial workspaceId is a UUID; empty-string URLSearchParams must NOT clobber it.
      expect(useWorkspaceStore.getState().workspaceId).toBe(beforeWsId);
      expect(useWorkspaceStore.getState().conversationId).toBe(beforeConvId);
    });
  });
});
