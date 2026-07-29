import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWorkspaceStore } from '../../../src/core/workspace/WorkspaceStore';

describe('WorkspaceStore persistence', () => {
  beforeEach(() => {
    // Clear chrome.storage.local mock
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();

    vi.clearAllMocks();
  });

  it('should persist workspace state to chrome.storage.local via chromeStorageAdapter', async () => {
    const store = useWorkspaceStore.getState();
    store.setConversationId('test-conv-123');

    // Wait for persist middleware to flush to chrome.storage.local
    await vi.waitFor(() => {
      const map = (globalThis as any).__chromeStorageMap;
      const storedRaw = map.get('np_workspace_store');
      expect(storedRaw).toBeDefined();
    });

    const map = (globalThis as any).__chromeStorageMap;
    const storedRaw = map.get('np_workspace_store');
    const parsed = JSON.parse(storedRaw);
    expect(parsed.state.conversationId).toBe('test-conv-123');
  });

  it('should survive simulated page reload (rehydrate from persisted data)', async () => {
    // Set some state and wait for persist
    const store1 = useWorkspaceStore.getState();
    store1.setConversationId('survive-test-conv');
    store1.setActiveSurface('full-app');

    await vi.waitFor(() => {
      const map = (globalThis as any).__chromeStorageMap;
      expect(map.has('np_workspace_store')).toBe(true);
    });

    // Simulate page reload by triggering rehydration
    await useWorkspaceStore.persist.rehydrate();

    // After rehydration, state should match what was persisted
    const state = useWorkspaceStore.getState();
    expect(state.conversationId).toBe('survive-test-conv');
    expect(state.activeSurface).toBe('full-app');
  });

  it('should persist setActiveSurface changes', async () => {
    const store = useWorkspaceStore.getState();
    store.setActiveSurface('full-app');

    await vi.waitFor(() => {
      const map = (globalThis as any).__chromeStorageMap;
      const storedRaw = map.get('np_workspace_store');
      expect(storedRaw).toBeDefined();
    });

    const map = (globalThis as any).__chromeStorageMap;
    const storedRaw = map.get('np_workspace_store');
    const parsed = JSON.parse(storedRaw);
    expect(parsed.state.activeSurface).toBe('full-app');

    // Change again and verify
    store.setActiveSurface('sidepanel');
    await vi.waitFor(() => {
      const map = (globalThis as any).__chromeStorageMap;
      const storedRaw = map.get('np_workspace_store');
      const parsed = JSON.parse(storedRaw);
      expect(parsed.state.activeSurface).toBe('sidepanel');
    });
  });

  it('should rehydrate persisted state on store creation (simulated fresh load)', async () => {
    // Manually seed chrome.storage.local with workspace state
    const seedData = JSON.stringify({
      state: {
        conversationId: 'seeded-conv',
        activeSurface: 'full-app',
        version: 42,
        workspaceId: crypto.randomUUID(),
        activeProvider: 'openai',
        selectedModel: 'gpt-4',
        pinnedTabs: [],
        openedFullAppTabId: null,
      },
      version: 0,
    });
    const map = (globalThis as any).__chromeStorageMap;
    map.set('np_workspace_store', seedData);

    // Rehydrate from the seeded data
    await useWorkspaceStore.persist.rehydrate();

    const state = useWorkspaceStore.getState();
    expect(state.conversationId).toBe('seeded-conv');
    expect(state.activeSurface).toBe('full-app');
    expect(state.version).toBe(42);
    expect(state.activeProvider).toBe('openai');
    expect(state.selectedModel).toBe('gpt-4');
  });
});
