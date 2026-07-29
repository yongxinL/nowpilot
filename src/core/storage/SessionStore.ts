/** SessionStore — Zustand store for session tokens in chrome.storage.session
 *
 * Per D-04/STORAGE-02:
 * - Session tokens stored ONLY in chrome.storage.session (cleared on browser close)
 * - Tokens NEVER written to chrome.storage.local or localStorage
 * - Persist middleware uses sessionStorageAdapter (chrome.storage.session + sessionStorage fallback)
 * - partialize ensures only tokens record is persisted (no action methods)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { sessionStorageAdapter } from './sessionStorageAdapter';

interface SessionState {
  tokens: Record<string, string>;
}

interface SessionActions {
  setToken: (name: string, value: string) => void;
  getToken: (name: string) => string | null;
  removeToken: (name: string) => void;
  clearTokens: () => void;
}

type SessionStore = SessionState & SessionActions;

const initialState: SessionState = {
  tokens: {},
};

export const useSessionStore = create<SessionStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      setToken: (name: string, value: string) => {
        set((state) => {
          state.tokens[name] = value;
        });
      },

      getToken: (name: string): string | null => {
        return get().tokens[name] ?? null;
      },

      removeToken: (name: string) => {
        set((state) => {
          delete state.tokens[name];
        });
      },

      clearTokens: () => {
        set((state) => {
          state.tokens = {};
        });
      },
    })),
    {
      name: 'np_session',
      storage: createJSONStorage(() => sessionStorageAdapter),
      partialize: (state) => ({ tokens: state.tokens }),
    },
  ),
);
