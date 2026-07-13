import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../../src/core/stores/workspaceStore';

// Mock WriteJournal to avoid IndexedDB dependency in tests
vi.mock('../../src/core/storage/WriteJournal', () => ({
  writeJournal: {
    begin: vi.fn().mockResolvedValue({ id: 'test-entry-id' }),
    markStepStart: vi.fn().mockResolvedValue(undefined),
    markStepComplete: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
    markStepFailed: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('WorkspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaceId: null,
      conversationId: null,
      activeProvider: null,
      activeSurface: 'sidepanel',
      pinnedTabs: [],
      currentPageContext: null,
      selectedNotes: [],
      activeAddonContext: null,
      activeSkillRun: null,
    });
    vi.clearAllMocks();
  });

  it('default state has all nullable fields as null and activeSurface as sidepanel', () => {
    const state = useWorkspaceStore.getState();
    expect(state.workspaceId).toBeNull();
    expect(state.conversationId).toBeNull();
    expect(state.activeProvider).toBeNull();
    expect(state.activeSurface).toBe('sidepanel');
    expect(state.pinnedTabs).toEqual([]);
    expect(state.currentPageContext).toBeNull();
    expect(state.selectedNotes).toEqual([]);
    expect(state.activeAddonContext).toBeNull();
    expect(state.activeSkillRun).toBeNull();
  });

  it('setActiveProvider persists to chrome.storage.local', () => {
    useWorkspaceStore.getState().setActiveProvider('openai');
    expect(useWorkspaceStore.getState().activeProvider).toBe('openai');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('setActiveSurface updates to standalone and persists', () => {
    useWorkspaceStore.getState().setActiveSurface('standalone');
    expect(useWorkspaceStore.getState().activeSurface).toBe('standalone');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('Surface values restricted to sidepanel/standalone/popup', () => {
    const valid: Array<'sidepanel' | 'standalone' | 'popup'> = ['sidepanel', 'standalone', 'popup'];
    for (const s of valid) {
      useWorkspaceStore.getState().setActiveSurface(s);
      expect(useWorkspaceStore.getState().activeSurface).toBe(s);
    }
  });

  it('state shape contains lightweight metadata fields plus future-facing fields', () => {
    const state = useWorkspaceStore.getState() as unknown as Record<string, unknown>;
    const keys = Object.keys(state).filter(
      (k) => k !== 'setWorkspaceId' && k !== 'setConversationId' && k !== 'setActiveProvider' && k !== 'setActiveSurface'
        && k !== 'setPinnedTabs' && k !== 'setCurrentPageContext' && k !== 'setSelectedNotes' && k !== 'setActiveAddonContext' && k !== 'setActiveSkillRun'
        && k !== 'setDraft' && k !== 'clearDraft',
    );
    // Should have 4 metadata fields + 5 future-facing fields + 1 drafts field
    expect(keys).toEqual([
      'workspaceId', 'conversationId', 'activeProvider', 'activeSurface',
      'pinnedTabs', 'currentPageContext', 'selectedNotes', 'activeAddonContext', 'activeSkillRun', 'drafts',
    ]);
  });

  it('setPinnedTabs updates pinnedTabs', () => {
    useWorkspaceStore.getState().setPinnedTabs(['tab1', 'tab2']);
    expect(useWorkspaceStore.getState().pinnedTabs).toEqual(['tab1', 'tab2']);
  });

  it('setCurrentPageContext updates currentPageContext', () => {
    useWorkspaceStore.getState().setCurrentPageContext('https://example.com');
    expect(useWorkspaceStore.getState().currentPageContext).toBe('https://example.com');
  });

  it('setSelectedNotes updates selectedNotes', () => {
    useWorkspaceStore.getState().setSelectedNotes(['note1']);
    expect(useWorkspaceStore.getState().selectedNotes).toEqual(['note1']);
  });

  it('setActiveAddonContext updates activeAddonContext', () => {
    useWorkspaceStore.getState().setActiveAddonContext('addon-context');
    expect(useWorkspaceStore.getState().activeAddonContext).toBe('addon-context');
  });

  it('setActiveSkillRun updates activeSkillRun', () => {
    useWorkspaceStore.getState().setActiveSkillRun('skill-run-1');
    expect(useWorkspaceStore.getState().activeSkillRun).toBe('skill-run-1');
  });
});
