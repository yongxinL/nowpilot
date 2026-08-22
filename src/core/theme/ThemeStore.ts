import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { syncStorageAdapter } from './chromeStorageAdapter';
import { publish } from '../runtime/BroadcastBus';
import { getColorTheme, DEFAULT_COLOR_THEME_ID } from './ThemeConfig';

export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Persisted shape written to chrome.storage.sync under the `np_theme` key.
 * The `pack` field is persisted to a SEPARATE key `np_theme_pack` per spec
 * §15.1 / §17.1a APPR-06 — keeping it distinct avoids a Phase-15 migration
 * when pack-specific logic lands.
 */
export interface ThemePersisted {
  mode: ThemeMode;
  colorTheme: string;
  pack: string;
}

interface ThemeState extends ThemePersisted {
  setMode: (mode: ThemeMode) => void;
  setColorTheme: (colorTheme: string) => void;
  setPack: (pack: string) => void;
  resolvedMode: () => 'light' | 'dark';
}

const THEME_STORAGE_KEY = 'np_theme';
const THEME_PACK_STORAGE_KEY = 'np_theme_pack';

/**
 * Pure, throw-free migration for ThemeStore persist config (D-10 / T-01-01).
 * Fills in `pack` for pre-Phase-1 legacy blobs missing it. v1 IS the current
 * schema, so a v1 payload returns unchanged.
 */
export function themeMigrate(persisted: unknown, version: number): ThemePersisted {
  const defaults: ThemePersisted = {
    mode: 'auto',
    colorTheme: DEFAULT_COLOR_THEME_ID,
    pack: 'default',
  };
  if (persisted && typeof persisted === 'object') {
    return { ...defaults, ...(persisted as Partial<ThemePersisted>) };
  }
  // Unparseable persisted blob — return defaults rather than throwing.
  return defaults;
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
      pack: 'default',

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

      setPack: (pack: string) => {
        if (get().pack === pack) return;
        set((state) => {
          state.pack = pack;
        });
        // Persist pack to its own SEPARATE key (APPR-06) so the spec's
        // mode-only `np_theme` blob remains forward-compatible.
        if (typeof chrome !== 'undefined' && chrome?.storage?.sync) {
          chrome.storage.sync.set({ [THEME_PACK_STORAGE_KEY]: pack }).catch(() => {});
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
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => syncStorageAdapter),
      partialize: (state) => ({
        mode: state.mode,
        colorTheme: state.colorTheme,
        pack: state.pack,
      }),
      version: 1,
      migrate: themeMigrate,
    },
  ),
);
