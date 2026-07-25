import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Surface } from '../navigation/navigationTypes';
import type { PageContext, TabContext } from '../content/PageContext';
import { writeJournal } from '../storage/WriteJournal';

export type { Surface } from '../navigation/navigationTypes';

export interface PageContextCacheEntry {
  page: PageContext;
  updatedAt: number;
}

// Safety ceiling on cached tab entries — bounds chrome.storage.local growth
// across long sessions with many tabs visited. Mirrors the D-30 pinnedTabs
// cap and D-07 per-entry size ceiling already applied to PageContext.
const MAX_PAGE_CONTEXT_TAB_ENTRIES = 30;

export interface WorkspaceState {
  workspaceId: string | null;
  conversationId: string | null;
  activeProvider: string | null;
  activeModel: string | null;
  inputTokens: number | null;
  sessionTokens: number | null;
  activeSurface: Surface;
  pinnedTabs: TabContext[];
  currentPageContext: PageContext | null;
  pageContextByTab: Record<number, PageContextCacheEntry>;
  selectedNotes: string[];
  activeAddonContext: string | null;
  activeSkillRun: string | null;
  drafts: Record<string, string>;
  setWorkspaceId: (id: string) => void;
  setConversationId: (id: string) => void;
  setActiveProvider: (provider: string) => void;
  setActiveModel: (model: string | null) => void;
  setActiveSurface: (surface: Surface) => void;
  setInputTokens: (inputTokens: number | null) => void;
  setSessionTokens: (sessionTokens: number | null) => void;
  setPinnedTabs: (pinnedTabs: TabContext[]) => void;
  setCurrentPageContext: (currentPageContext: PageContext | null) => void;
  setPageContextForTab: (tabId: number, page: PageContext) => void;
  clearPageContextForTab: (tabId: number) => void;
  addPinnedTab: (tab: TabContext) => void;
  removePinnedTab: (tabId: number) => void;
  setSelectedNotes: (selectedNotes: string[]) => void;
  setActiveAddonContext: (activeAddonContext: string | null) => void;
  setActiveSkillRun: (activeSkillRun: string | null) => void;
  setDraft: (conversationId: string, text: string) => void;
  clearDraft: (conversationId: string) => void;
}

const chromeLocalStorage = createJSONStorage<WorkspaceState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: async (name: string, value: string) => {
    // D-17: Route all workspace persists through WriteJournal.
    // Wrap in try-catch so unavailability (e.g., test env without IndexedDB)
    // degrades gracefully to direct persistence.
    try {
      const entry = await writeJournal.begin(
        'update-workspace',
        { workspace: name },
        [{ name: 'persist-workspace' }],
      );
      await writeJournal.markStepStart(entry.id, 0);
      try {
        await chrome.storage.local.set({ [name]: value });
        await writeJournal.markStepComplete(entry.id, 0);
        await writeJournal.markCompleted(entry.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await writeJournal.markStepFailed(entry.id, 0, msg);
        await writeJournal.markFailed(entry.id);
        throw err;
      }
    } catch {
      // WriteJournal unavailable — persist directly without journaling
      await chrome.storage.local.set({ [name]: value });
    }
    // BroadcastBus picks up the chrome.storage.local change via
    // chrome.storage.onChanged('local') listener (see Task 3)
    // and emits WORKSPACE_UPDATED — satisfying the D-17 emit step.
  },
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaceId: null,
      conversationId: null,
      activeProvider: null,
      activeModel: null,
      inputTokens: null,
      sessionTokens: null,
      activeSurface: 'sidepanel',
      pinnedTabs: [] as TabContext[],
      currentPageContext: null as PageContext | null,
      pageContextByTab: {} as Record<number, PageContextCacheEntry>,
      selectedNotes: [],
      activeAddonContext: null,
      activeSkillRun: null,
      drafts: {},
      setWorkspaceId: (workspaceId: string) => set({ workspaceId }),
      setConversationId: (conversationId: string) => set({ conversationId }),
      setActiveProvider: (activeProvider: string) => set({ activeProvider }),
      setActiveModel: (activeModel: string | null) => set({ activeModel }),
      setActiveSurface: (activeSurface: Surface) => set({ activeSurface }),
      setInputTokens: (inputTokens: number | null) => set({ inputTokens }),
      setSessionTokens: (sessionTokens: number | null) => set({ sessionTokens }),
      setPinnedTabs: (pinnedTabs: TabContext[]) => set({ pinnedTabs }),
      setCurrentPageContext: (currentPageContext: PageContext | null) => set({ currentPageContext }),
      setPageContextForTab: (tabId: number, page: PageContext) =>
        set((state) => {
          const next: Record<number, PageContextCacheEntry> = {
            ...state.pageContextByTab,
            [tabId]: { page, updatedAt: Date.now() },
          };
          const ids = Object.keys(next);
          if (ids.length > MAX_PAGE_CONTEXT_TAB_ENTRIES) {
            const oldestFirst = ids
              .map((id) => Number(id))
              .sort((a, b) => next[a].updatedAt - next[b].updatedAt);
            for (const id of oldestFirst.slice(0, ids.length - MAX_PAGE_CONTEXT_TAB_ENTRIES)) {
              delete next[id];
            }
          }
          return { pageContextByTab: next };
        }),
      clearPageContextForTab: (tabId: number) =>
        set((state) => {
          const { [tabId]: _removed, ...rest } = state.pageContextByTab;
          return { pageContextByTab: rest };
        }),
      setSelectedNotes: (selectedNotes: string[]) => set({ selectedNotes }),
      setActiveAddonContext: (activeAddonContext: string | null) => set({ activeAddonContext }),
      setActiveSkillRun: (activeSkillRun: string | null) => set({ activeSkillRun }),
      addPinnedTab: (tab: TabContext) =>
        set((state) => {
          if (state.pinnedTabs.length >= 10) return state; // D-30: reject at limit
          if (state.pinnedTabs.some((t) => t.tabId === tab.tabId)) return state; // deduplicate
          return { pinnedTabs: [...state.pinnedTabs, tab] };
        }),
      removePinnedTab: (tabId: number) =>
        set((state) => ({
          pinnedTabs: state.pinnedTabs.filter((t) => t.tabId !== tabId),
        })),
      setDraft: (conversationId: string, text: string) =>
        set((state) => ({ drafts: { ...state.drafts, [conversationId]: text } })),
      clearDraft: (conversationId: string) =>
        set((state) => {
          const { [conversationId]: _, ...rest } = state.drafts;
          return { drafts: rest };
        }),
    }),
    {
      name: 'np_workspace',
      storage: chromeLocalStorage,
    },
  ),
);
