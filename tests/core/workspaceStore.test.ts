import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../../src/core/stores/workspaceStore';
import type { TabContext, PageContext } from '../../src/core/content/PageContext';

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

// Helper: creates a minimal PageContext fixture for tests
function makePageContext(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com',
    origin: 'https://example.com',
    hostname: 'example.com',
    title: 'Example Page',
    meta: {},
    extractedAt: Date.now(),
    extractionType: 'readability',
    extractionQuality: 'article',
    ...overrides,
  };
}

// Helper: creates a minimal TabContext fixture for tests
function makeTabContext(tabId: number, overrides: Partial<TabContext> = {}): TabContext {
  return {
    tabId,
    windowId: 1,
    page: makePageContext({ url: `https://example.com/tab/${tabId}`, title: `Tab ${tabId}` }),
    pinnedAt: Date.now(),
    active: true,
    url: `https://example.com/tab/${tabId}`,
    title: `Tab ${tabId}`,
    ...overrides,
  };
}

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
        && k !== 'setDraft' && k !== 'clearDraft'
        && k !== 'setActiveModel' && k !== 'setInputTokens' && k !== 'setSessionTokens'
        && k !== 'addPinnedTab' && k !== 'removePinnedTab'
        && k !== 'setPageContextForTab' && k !== 'clearPageContextForTab',
    );
    // Should have 4 metadata fields + 5 future-facing fields + 1 drafts field + 3 model/token fields + 1 per-tab cache field
    expect(keys).toEqual([
      'workspaceId', 'conversationId', 'activeProvider', 'activeModel', 'inputTokens', 'sessionTokens', 'activeSurface',
      'pinnedTabs', 'currentPageContext', 'pageContextByTab', 'selectedNotes', 'activeAddonContext', 'activeSkillRun', 'drafts',
    ]);
  });

  it('setPinnedTabs updates pinnedTabs with TabContext[] array', () => {
    const tab1 = makeTabContext(1);
    const tab2 = makeTabContext(2);
    useWorkspaceStore.getState().setPinnedTabs([tab1, tab2]);
    expect(useWorkspaceStore.getState().pinnedTabs).toEqual([tab1, tab2]);
  });

  it('setCurrentPageContext accepts a full PageContext object', () => {
    const ctx = makePageContext({ url: 'https://example.com/page', title: 'Test Page' });
    useWorkspaceStore.getState().setCurrentPageContext(ctx);
    expect(useWorkspaceStore.getState().currentPageContext).toEqual(ctx);
    expect(useWorkspaceStore.getState().currentPageContext?.url).toBe('https://example.com/page');
    expect(useWorkspaceStore.getState().currentPageContext?.title).toBe('Test Page');
  });

  it('setCurrentPageContext accepts null to clear context', () => {
    useWorkspaceStore.getState().setCurrentPageContext(makePageContext());
    useWorkspaceStore.getState().setCurrentPageContext(null);
    expect(useWorkspaceStore.getState().currentPageContext).toBeNull();
  });

  // ---- addPinnedTab / removePinnedTab ----

  it('addPinnedTab appends a TabContext to pinnedTabs array', () => {
    const tab = makeTabContext(1);
    useWorkspaceStore.getState().addPinnedTab(tab);
    expect(useWorkspaceStore.getState().pinnedTabs).toEqual([tab]);
  });

  it('addPinnedTab rejects at 10 (no-op, returns unchanged state)', () => {
    // Fill to 10
    for (let i = 1; i <= 10; i++) {
      useWorkspaceStore.getState().addPinnedTab(makeTabContext(i));
    }
    const stateBefore = useWorkspaceStore.getState().pinnedTabs;
    expect(stateBefore).toHaveLength(10);

    // 11th should be rejected
    useWorkspaceStore.getState().addPinnedTab(makeTabContext(11));
    expect(useWorkspaceStore.getState().pinnedTabs).toHaveLength(10);
    expect(useWorkspaceStore.getState().pinnedTabs).toEqual(stateBefore);
  });

  it('addPinnedTab deduplicates by tabId', () => {
    const tab = makeTabContext(1);
    useWorkspaceStore.getState().addPinnedTab(tab);
    // Same tabId, different page content
    const updatedTab = makeTabContext(1, { title: 'Updated Tab 1' });
    useWorkspaceStore.getState().addPinnedTab(updatedTab);

    // Should still be the original, not updated
    expect(useWorkspaceStore.getState().pinnedTabs).toHaveLength(1);
    expect(useWorkspaceStore.getState().pinnedTabs[0]).toEqual(tab);
  });

  it('removePinnedTab removes the matching tabId', () => {
    useWorkspaceStore.getState().addPinnedTab(makeTabContext(1));
    useWorkspaceStore.getState().addPinnedTab(makeTabContext(2));
    useWorkspaceStore.getState().addPinnedTab(makeTabContext(3));
    expect(useWorkspaceStore.getState().pinnedTabs).toHaveLength(3);

    useWorkspaceStore.getState().removePinnedTab(2);
    expect(useWorkspaceStore.getState().pinnedTabs).toHaveLength(2);
    expect(useWorkspaceStore.getState().pinnedTabs.map((t) => t.tabId)).toEqual([1, 3]);
  });

  it('removePinnedTab does nothing for unknown tabId', () => {
    useWorkspaceStore.getState().addPinnedTab(makeTabContext(1));
    const stateBefore = useWorkspaceStore.getState().pinnedTabs;
    useWorkspaceStore.getState().removePinnedTab(999);
    expect(useWorkspaceStore.getState().pinnedTabs).toEqual(stateBefore);
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
