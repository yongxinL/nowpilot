import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type TabType = 'context' | 'notes' | 'tools';
export type PaneWidth = 'compact' | 'expanded';

export interface RightPaneState {
  // Persisted UI layout state
  activeTab: TabType;
  visible: boolean;
  width: PaneWidth;
  // Transient (not persisted)
  searchQuery: string;
  selectedNoteId: string | null;
  expandedToolId: string | null;
  // Actions
  setActiveTab: (tab: TabType) => void;
  setVisible: (v: boolean) => void;
  toggleWidth: () => void;
  setSearchQuery: (q: string) => void;
  setSelectedNoteId: (id: string | null) => void;
  setExpandedToolId: (id: string | null) => void;
}

const chromeLocalStorage = createJSONStorage<RightPaneState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.local.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));

export const useRightPaneStore = create<RightPaneState>()(
  persist(
    (set) => ({
      // Persisted UI layout state
      activeTab: 'context',
      visible: true,
      width: 'compact',
      // Transient (not persisted)
      searchQuery: '',
      selectedNoteId: null,
      expandedToolId: null,
      // Actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setVisible: (v) => set({ visible: v }),
      toggleWidth: () => set((s) => ({ width: s.width === 'compact' ? 'expanded' : 'compact' })),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
      setExpandedToolId: (id) => set({ expandedToolId: id }),
    }),
    {
      name: 'np_right_pane',
      storage: chromeLocalStorage as any,
      // Only persist UI layout state — search/selection is ephemeral
      partialize: (state) => ({
        activeTab: state.activeTab,
        visible: state.visible,
        width: state.width,
      }),
    },
  ),
);
