import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from './chromeStorageAdapter';
import { publish } from '../runtime/BroadcastBus';
import { getColorTheme, DEFAULT_COLOR_THEME_ID } from './ThemeConfig';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  mode: ThemeMode;
  colorTheme: string;
  setMode: (mode: ThemeMode) => void;
  setColorTheme: (colorTheme: string) => void;
  resolvedMode: () => 'light' | 'dark';
}

function applyThemeDom(mode: ThemeMode, colorThemeId: string) {
  if (typeof document === 'undefined') return;
  const isDark =
    mode === 'dark' ||
    (mode === 'auto' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', isDark);

  const themeObj = getColorTheme(colorThemeId);
  const activeColor = isDark ? themeObj.darkPrimary : themeObj.primary;

  document.documentElement.style.setProperty('--np-primary', activeColor);
  document.documentElement.style.setProperty('--np-primary-light', `${activeColor}20`);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    immer((set, get) => ({
      mode: 'auto' as ThemeMode,
      colorTheme: DEFAULT_COLOR_THEME_ID,

      setMode: (mode: ThemeMode) => {
        if (get().mode === mode) return;
        set((state) => {
          state.mode = mode;
        });

        applyThemeDom(mode, get().colorTheme);

        if (typeof BroadcastChannel !== 'undefined') {
          publish('np_theme', { type: 'THEME_CHANGED', mode });
        }
      },

      setColorTheme: (colorTheme: string) => {
        if (get().colorTheme === colorTheme) return;
        set((state) => {
          state.colorTheme = colorTheme;
        });

        applyThemeDom(get().mode, colorTheme);

        if (typeof BroadcastChannel !== 'undefined') {
          publish('np_theme', { type: 'COLOR_THEME_CHANGED', colorTheme });
        }
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
      partialize: (state) => ({ mode: state.mode, colorTheme: state.colorTheme }),
    },
  ),
);
