import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWorkspaceStore } from '../../../src/core/workspace/WorkspaceStore';

describe('WorkspaceStore', () => {
  beforeEach(() => {
    // Clear chrome.storage.local mock
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();

    useWorkspaceStore.getState().reset();
    vi.clearAllMocks();
  });

  it('initializes with default state', () => {
    const state = useWorkspaceStore.getState();
    expect(state.workspaceId).toBeTruthy();
    expect(state.conversationId).toBeNull();
    expect(state.activeProvider).toBeNull();
    expect(state.selectedModel).toBeNull();
    expect(state.pinnedTabs).toEqual([]);
    expect(state.activeSurface).toBe('sidepanel');
    expect(state.version).toBe(0);
  });

  it('sets conversation ID', () => {
    const store = useWorkspaceStore.getState();
    store.setConversationId('conv-1');
    expect(useWorkspaceStore.getState().conversationId).toBe('conv-1');
    expect(useWorkspaceStore.getState().version).toBe(1);
  });

  it('pins and unpins tabs', () => {
    const store = useWorkspaceStore.getState();
    store.pinTab({ tabId: 1, title: 'Test', url: 'https://test.com', pinned: true });
    expect(useWorkspaceStore.getState().pinnedTabs).toHaveLength(1);

    store.unpinTab(1);
    expect(useWorkspaceStore.getState().pinnedTabs).toHaveLength(0);
  });

  it('enforces max 10 pinned tabs', () => {
    const store = useWorkspaceStore.getState();
    for (let i = 0; i < 12; i++) {
      store.pinTab({ tabId: i, title: `Tab ${i}`, url: `https://tab${i}.com`, pinned: true });
    }
    expect(useWorkspaceStore.getState().pinnedTabs).toHaveLength(10);
  });

  it('tracks active surface', () => {
    const store = useWorkspaceStore.getState();
    store.setActiveSurface('full-app');
    expect(useWorkspaceStore.getState().activeSurface).toBe('full-app');
  });

  it('bumps version', () => {
    const store = useWorkspaceStore.getState();
    store.bumpVersion();
    expect(useWorkspaceStore.getState().version).toBe(1);
  });

  it('resets to initial state', () => {
    const store = useWorkspaceStore.getState();
    store.setConversationId('conv-test');
    store.pinTab({ tabId: 1, title: 'Test', url: 'https://test.com', pinned: true });
    store.reset();
    const newState = useWorkspaceStore.getState();
    expect(newState.conversationId).toBeNull();
    expect(newState.pinnedTabs).toEqual([]);
    expect(newState.version).toBe(0);
  });

  describe('persistence via chromeStorageAdapter', () => {
    it('should persist workspace state to chrome.storage.local after mutation', async () => {
      useWorkspaceStore.getState().setConversationId('persist-test');

      // Wait for Zustand persist middleware to flush to chrome.storage.local
      await vi.waitFor(() => {
        const map = (globalThis as any).__chromeStorageMap;
        expect(map.has('np_workspace_store')).toBe(true);
      });

      const map = (globalThis as any).__chromeStorageMap;
      const storedRaw = map.get('np_workspace_store');
      expect(storedRaw).toBeDefined();
      const parsed = JSON.parse(storedRaw);
      expect(parsed.state.conversationId).toBe('persist-test');
    });

    it('should persist active surface changes to chrome.storage.local', async () => {
      useWorkspaceStore.getState().setActiveSurface('full-app');

      await vi.waitFor(() => {
        const map = (globalThis as any).__chromeStorageMap;
        expect(map.has('np_workspace_store')).toBe(true);
      });

      const map = (globalThis as any).__chromeStorageMap;
      const storedRaw = map.get('np_workspace_store');
      const parsed = JSON.parse(storedRaw);
      expect(parsed.state.activeSurface).toBe('full-app');
    });
  });
});
