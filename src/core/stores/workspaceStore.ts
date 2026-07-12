import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Surface } from '../navigation/navigationTypes';
import { writeJournal } from '../storage/WriteJournal';

export type { Surface } from '../navigation/navigationTypes';

export interface WorkspaceState {
  workspaceId: string | null;
  conversationId: string | null;
  activeProvider: string | null;
  activeSurface: Surface;
  pinnedTabs: string[];
  currentPageContext: string | null;
  selectedNotes: string[];
  activeAddonContext: string | null;
  activeSkillRun: string | null;
  setWorkspaceId: (id: string) => void;
  setConversationId: (id: string) => void;
  setActiveProvider: (provider: string) => void;
  setActiveSurface: (surface: Surface) => void;
  setPinnedTabs: (pinnedTabs: string[]) => void;
  setCurrentPageContext: (currentPageContext: string | null) => void;
  setSelectedNotes: (selectedNotes: string[]) => void;
  setActiveAddonContext: (activeAddonContext: string | null) => void;
  setActiveSkillRun: (activeSkillRun: string | null) => void;
}

const chromeLocalStorage = createJSONStorage<WorkspaceState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: async (name: string, value: string) => {
    // D-17: Route all workspace persists through WriteJournal
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
      activeSurface: 'sidepanel',
      pinnedTabs: [],
      currentPageContext: null,
      selectedNotes: [],
      activeAddonContext: null,
      activeSkillRun: null,
      setWorkspaceId: (workspaceId: string) => set({ workspaceId }),
      setConversationId: (conversationId: string) => set({ conversationId }),
      setActiveProvider: (activeProvider: string) => set({ activeProvider }),
      setActiveSurface: (activeSurface: Surface) => set({ activeSurface }),
      setPinnedTabs: (pinnedTabs: string[]) => set({ pinnedTabs }),
      setCurrentPageContext: (currentPageContext: string | null) => set({ currentPageContext }),
      setSelectedNotes: (selectedNotes: string[]) => set({ selectedNotes }),
      setActiveAddonContext: (activeAddonContext: string | null) => set({ activeAddonContext }),
      setActiveSkillRun: (activeSkillRun: string | null) => set({ activeSkillRun }),
    }),
    {
      name: 'np_workspace',
      storage: chromeLocalStorage,
    },
  ),
);
