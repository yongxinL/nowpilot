import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Surface = 'sidepanel' | 'fullapp' | 'popup';

export interface WorkspaceState {
  workspaceId: string | null;
  conversationId: string | null;
  activeProvider: string | null;
  activeSurface: Surface;
  setWorkspaceId: (id: string) => void;
  setConversationId: (id: string) => void;
  setActiveProvider: (provider: string) => void;
  setActiveSurface: (surface: Surface) => void;
}

const chromeSessionStorage = createJSONStorage<WorkspaceState>(() => ({
  getItem: (name: string) =>
    chrome.storage.session.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.session.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.session.remove(name),
}));

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaceId: null,
      conversationId: null,
      activeProvider: null,
      activeSurface: 'sidepanel',
      setWorkspaceId: (workspaceId: string) => set({ workspaceId }),
      setConversationId: (conversationId: string) => set({ conversationId }),
      setActiveProvider: (activeProvider: string) => set({ activeProvider }),
      setActiveSurface: (activeSurface: Surface) => set({ activeSurface }),
    }),
    {
      name: 'nowpilot-workspace',
      storage: chromeSessionStorage,
    },
  ),
);
