import { beforeEach, describe, expect, it, type Mock } from 'vitest';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';

describe('WorkspaceStore', () => {
  let storageLocalGet: Mock;
  let storageLocalSet: Mock;

  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    storageLocalGet = chrome.storage.local.get as unknown as Mock;
    storageLocalSet = chrome.storage.local.set as unknown as Mock;
  });

  it('has a default state', () => {
    const s = useWorkspaceStore.getState().state;
    expect(s.activeSurface).toBe('sidepanel');
    expect(s.version).toBe(0);
    expect(s.workspaceId).toBeTruthy();
    expect(s.conversationId).toBeTruthy();
    expect(s.pinnedTabs).toEqual([]);
  });

  it('setState bumps version and persists', () => {
    const before = useWorkspaceStore.getState().state.version;
    useWorkspaceStore.getState().setState({ conversationId: 'conv-2' });
    const after = useWorkspaceStore.getState().state;
    expect(after.version).toBe(before + 1);
    expect(after.conversationId).toBe('conv-2');
    expect(storageLocalSet).toHaveBeenCalled();
  });

  it('reset restores a default state', () => {
    useWorkspaceStore.getState().setState({ conversationId: 'conv-x' });
    useWorkspaceStore.getState().reset();
    expect(useWorkspaceStore.getState().state.conversationId).toBeTruthy();
    expect(useWorkspaceStore.getState().state.version).toBe(0);
  });

  it('hydrates from storage', async () => {
    const stored = {
      workspaceId: 'ws-1',
      conversationId: 'conv-hydrated',
      pinnedTabs: [],
      selectedNotes: [],
      activeSurface: 'standalone' as const,
      version: 5,
      updatedAt: 100,
    };
    storageLocalGet.mockResolvedValue({ np_workspace: stored });
    await useWorkspaceStore.getState().hydrateFromStorage();
    expect(useWorkspaceStore.getState().state.conversationId).toBe('conv-hydrated');
    expect(useWorkspaceStore.getState().state.activeSurface).toBe('standalone');
  });
});
