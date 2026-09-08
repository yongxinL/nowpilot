import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ProviderId } from '@/core/ai/types';
import type { PageContext, TabContext } from '@/core/content/PageContext';

export type ActiveSurface = 'sidepanel' | 'standalone';

export interface WorkspaceState {
  workspaceId: string;
  conversationId: string;
  activeProvider?: ProviderId;
  selectedModel?: string;
  pinnedTabs: TabContext[];
  currentPageContext?: PageContext;
  selectedNotes: string[];
  activeAddonContext?: {
    addonId: string;
    contextKey: string;
    payload: unknown;
  };
  activeSkillRun?: {
    skillId: string;
    operationId: string;
    startedAt: number;
    status: 'running' | 'completed' | 'failed' | 'aborted';
  };
  activeSurface: ActiveSurface;
  openedStandaloneTabId?: number;
  version: number;
  updatedAt: number;
}

export interface WorkspaceStoreShape {
  state: WorkspaceState;
  setState(patch: Partial<WorkspaceState>): void;
  reset(): void;
  hydrateFromStorage(): Promise<void>;
  hydrateFromURL(): Promise<void>;
  persist(): Promise<void>;
}

function defaultState(): WorkspaceState {
  return {
    workspaceId: crypto.randomUUID(),
    conversationId: crypto.randomUUID(),
    pinnedTabs: [],
    selectedNotes: [],
    activeSurface: 'sidepanel',
    version: 0,
    updatedAt: Date.now(),
  };
}

export const useWorkspaceStore = create<WorkspaceStoreShape>()(
  subscribeWithSelector((set, get) => ({
    state: defaultState(),
    setState: (patch) => {
      const next = {
        ...get().state,
        ...patch,
        version: get().state.version + 1,
        updatedAt: Date.now(),
      };
      set({ state: next });
      void get().persist();
    },
    reset: () => set({ state: defaultState() }),
    hydrateFromStorage: async () => {
      const v = await chrome.storage.local.get('np_workspace');
      if (v.np_workspace) set({ state: v.np_workspace as WorkspaceState });
    },
    hydrateFromURL: async () => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const workspaceId = params.get('workspaceId');
      const conversationId = params.get('conversationId');
      if (workspaceId) {
        await get().hydrateFromStorage();
        if (get().state.workspaceId !== workspaceId) {
          get().setState({ workspaceId, conversationId: conversationId ?? crypto.randomUUID() });
        }
      }
    },
    persist: async () => {
      await chrome.storage.local.set({ np_workspace: get().state });
    },
  })),
);
