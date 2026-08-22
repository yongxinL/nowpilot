import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from '../theme/chromeStorageAdapter';

export type ActiveSurface = 'sidepanel' | 'full-app';

export interface TabContext {
  tabId: number;
  title: string;
  url: string;
  pinned: boolean;
}

export interface WorkspaceStateData {
  workspaceId: string;
  conversationId: string | null;
  activeProvider: string | null;
  selectedModel: string | null;
  pinnedTabs: TabContext[];
  activeSurface: ActiveSurface;
  openedFullAppTabId: number | null;
  version: number;
}

interface WorkspaceActions {
  setConversationId: (id: string) => void;
  setActiveProvider: (provider: string) => void;
  setSelectedModel: (model: string) => void;
  pinTab: (tab: TabContext) => void;
  unpinTab: (tabId: number) => void;
  setActiveSurface: (surface: ActiveSurface) => void;
  setOpenedFullAppTabId: (tabId: number | null) => void;
  bumpVersion: () => void;
  reset: () => void;
}

type WorkspaceStore = WorkspaceStateData & WorkspaceActions;

const initialState: WorkspaceStateData = {
  workspaceId: crypto.randomUUID(),
  conversationId: null,
  activeProvider: null,
  selectedModel: null,
  pinnedTabs: [],
  activeSurface: 'sidepanel' as ActiveSurface,
  openedFullAppTabId: null,
  version: 0,
};

/**
 * D-22 / H1: throw-free no-op migration for the WorkspaceStore persist
 * config. v1 IS the current schema — a v1 blob (or an unversioned legacy
 * blob from before Plan 01-04 adopted chromeStorageAdapter) is returned
 * unchanged so existing user data hydrates without disruption.
 *
 * This is the third and final persisted store to gain the
 * version/migrate scaffold (`useExtensionStore` and `ThemeStore` landed
 * it in Plan 01-01). The shape of `WorkspaceStateData` is unchanged, so
 * the no-op is genuinely a no-op.
 */
export function workspaceMigrate(persisted: unknown, version: number): unknown {
  if (persisted && typeof persisted === 'object') {
    return persisted;
  }
  return {};
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    immer((set) => ({
      ...initialState,

      setConversationId: (id: string) =>
        set((state) => {
          state.conversationId = id;
          state.version++;
        }),

      setActiveProvider: (provider: string) =>
        set((state) => {
          state.activeProvider = provider;
        }),

      setSelectedModel: (model: string) =>
        set((state) => {
          state.selectedModel = model;
        }),

      pinTab: (tab: TabContext) =>
        set((state) => {
          const existing = state.pinnedTabs.find((t) => t.tabId === tab.tabId);
          if (!existing && state.pinnedTabs.length < 10) {
            state.pinnedTabs.push({ ...tab, pinned: true });
          }
          if (existing) {
            existing.pinned = true;
          }
        }),

      unpinTab: (tabId: number) =>
        set((state) => {
          state.pinnedTabs = state.pinnedTabs.filter((t) => t.tabId !== tabId);
        }),

      setActiveSurface: (surface: ActiveSurface) =>
        set((state) => {
          state.activeSurface = surface;
        }),

      setOpenedFullAppTabId: (tabId: number | null) =>
        set((state) => {
          state.openedFullAppTabId = tabId;
        }),

      bumpVersion: () =>
        set((state) => {
          state.version++;
        }),

      reset: () =>
        set((state) => {
          Object.assign(state, { ...initialState, workspaceId: crypto.randomUUID() });
        }),
    })),
    {
      name: 'np_workspace_store',
      // H1: WorkspaceStore previously had NO `storage:` key — zustand's
      // implicit default is a `localStorage`-backed adapter, which is
      // wrong for an extension: it (a) loses data when the service worker
      // is the only context writing, (b) bypasses the debounced
      // chromeStorageAdapter that useExtensionStore + ThemeStore now
      // share. This line puts WorkspaceStore on the same choke point.
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({
        workspaceId: state.workspaceId,
        conversationId: state.conversationId,
        activeProvider: state.activeProvider,
        selectedModel: state.selectedModel,
        pinnedTabs: state.pinnedTabs,
        activeSurface: state.activeSurface,
        openedFullAppTabId: state.openedFullAppTabId,
        version: state.version,
      }),
      // D-22: zustand-persist schema version. SEPARATE axis from
      // IndexedDB `DB_VERSION` (§20.4) — do not conflate when numbering
      // later migrations (A5).
      version: 1,
      migrate: workspaceMigrate,
    },
  ),
);
