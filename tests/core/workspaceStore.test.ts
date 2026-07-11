import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../../src/core/stores/workspaceStore';

describe('WorkspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaceId: null,
      conversationId: null,
      activeProvider: null,
      activeSurface: 'sidepanel',
    });
    vi.clearAllMocks();
  });

  it('default state has all nullable fields as null and activeSurface as sidepanel', () => {
    const state = useWorkspaceStore.getState();
    expect(state.workspaceId).toBeNull();
    expect(state.conversationId).toBeNull();
    expect(state.activeProvider).toBeNull();
    expect(state.activeSurface).toBe('sidepanel');
  });

  it('setActiveProvider persists to chrome.storage.session', () => {
    useWorkspaceStore.getState().setActiveProvider('openai');
    expect(useWorkspaceStore.getState().activeProvider).toBe('openai');
    expect(chrome.storage.session.set).toHaveBeenCalled();
  });

  it('setActiveSurface updates to standalone and persists', () => {
    useWorkspaceStore.getState().setActiveSurface('standalone');
    expect(useWorkspaceStore.getState().activeSurface).toBe('standalone');
    expect(chrome.storage.session.set).toHaveBeenCalled();
  });

  it('Surface values restricted to sidepanel/standalone/popup', () => {
    const valid: Array<'sidepanel' | 'standalone' | 'popup'> = ['sidepanel', 'standalone', 'popup'];
    for (const s of valid) {
      useWorkspaceStore.getState().setActiveSurface(s);
      expect(useWorkspaceStore.getState().activeSurface).toBe(s);
    }
  });

  it('state shape contains only lightweight metadata fields', () => {
    const state = useWorkspaceStore.getState() as unknown as Record<string, unknown>;
    const keys = Object.keys(state).filter(
      (k) => k !== 'setWorkspaceId' && k !== 'setConversationId' && k !== 'setActiveProvider' && k !== 'setActiveSurface',
    );
    // Should only have the 4 metadata fields (no message bodies or trees)
    expect(keys).toEqual(['workspaceId', 'conversationId', 'activeProvider', 'activeSurface']);
  });
});
