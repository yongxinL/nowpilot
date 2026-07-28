import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedMode: () => 'light' | 'dark';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    immer((set, get) => ({
      mode: 'auto' as ThemeMode,

      setMode: (mode: ThemeMode) => {
        set((state) => {
          state.mode = mode;
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
      partialize: (state) => ({ mode: state.mode }),
    },
  ),
);
