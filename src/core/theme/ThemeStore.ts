import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from '../storage/chromeStorageAdapter';
import { publish } from '../runtime/BroadcastBus';
import type { ThemeId } from '../../themes/types';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  mode: ThemeMode;
  themeId: ThemeId;
  setMode: (mode: ThemeMode) => void;
  setThemeId: (themeId: ThemeId) => void;
  resolvedMode: () => 'light' | 'dark';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    immer((set, get) => ({
      mode: 'auto' as ThemeMode,
      themeId: 'system' as ThemeId,

      setMode: (mode: ThemeMode) => {
        set((state) => {
          state.mode = mode;
        });

        // Apply dark class to documentElement immediately
        if (typeof document !== 'undefined') {
          const isDark = mode === 'dark' || (mode === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          document.documentElement.classList.toggle('dark', isDark);
        }

        if (typeof BroadcastChannel !== 'undefined') {
          publish('np_theme', { type: 'THEME_CHANGED', mode });
        }
      },

      setThemeId: (themeId: ThemeId) => {
        set((state) => {
          state.themeId = themeId;
        });
      },

      resolvedMode: () => {
        const { mode } = get();
        if (mode !== 'auto') return mode;
        if (typeof window !== 'undefined' && window.matchMedia) {
          return window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
        }
        return 'light';
      },
    })),
    {
      name: 'np_theme_store',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({ mode: state.mode, themeId: state.themeId }),
    },
  ),
);

