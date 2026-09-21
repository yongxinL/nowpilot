import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { syncStorageAdapter, flushPendingWrites } from './chromeStorageAdapter';
import { getColorTheme, DEFAULT_COLOR_THEME_ID, type ThemeMode } from './ThemeConfig';
import { applyClaudePlusCssVars } from '../../theme/packs/claudePlus';
import { debugLog } from '../log/debugLog';

// `ThemeMode` lives in `ThemeConfig.ts` (the pure module); re-exported here so
// the store stays the familiar import site for consumers and tests.
export type { ThemeMode };

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

export type ThemeWriteResult = { ok: true } | { ok: false; error: string };

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

/**
 * Apply the resolved mode to the document root.
 *
 * H-3 / OQ2: the `.dark` class stays scoped to the **hand-written** selectors
 * in `src/index.css`; AntD never reads it (its switch is the CSS-variable
 * derivation in `getAntdConfig`). This function is the only writer of the
 * class and the `--np-*` / Claude Plus variables.
 */
export function applyThemeDom(mode: ThemeMode, colorThemeId: string): void {
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

  if (themeObj.id === 'system' || themeObj.id === 'claude-plus') {
    applyClaudePlusCssVars(isDark);
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    immer((set, get) => ({
      mode: 'auto' as ThemeMode,
      colorTheme: DEFAULT_COLOR_THEME_ID,
      pack: 'default',

      setMode: (mode: ThemeMode) => {
        // Idempotency (T-1-21): a same-value write produces no state change,
        // so it schedules no persist write and no cross-surface propagation.
        if (get().mode === mode) return;
        set((state) => {
          state.mode = mode;
        });

        applyThemeDom(mode, get().colorTheme);
        // No BroadcastBus publish: `chrome.storage.onChanged` (sync area) is
        // the only cross-surface propagation path (D-15 / § Theme Contract).
      },

      setColorTheme: (colorTheme: string) => {
        if (get().colorTheme === colorTheme) return;
        set((state) => {
          state.colorTheme = colorTheme;
        });

        applyThemeDom(get().mode, colorTheme);
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

/**
 * Advance the mode through the canonical cycle (`auto → light → dark → auto`),
 * write it through the single writer (`ThemeStore.setMode`) and return the new
 * mode. Plan `01-08` wires the `Toggle theme` palette command to this function;
 * no module registers a command here.
 */
const THEME_MODE_CYCLE: readonly ThemeMode[] = ['auto', 'light', 'dark'];

export function cycleThemeMode(): ThemeMode {
  const current = useThemeStore.getState().mode;
  const index = THEME_MODE_CYCLE.indexOf(current);
  const next = THEME_MODE_CYCLE[(index + 1) % THEME_MODE_CYCLE.length];
  useThemeStore.getState().setMode(next);
  return next;
}

/**
 * Re-issue the canonical `np_theme` write with the store's **own** persist
 * config (`partialize` + `version`) and settle the debounced adapter, so a
 * rejected `chrome.storage.sync.set` is observable instead of silently
 * swallowed.
 *
 * Owned by `ThemeStore` because it is the single writer of the key: there is no
 * second representation here, only an explicit settle of the same write. The
 * visible mode is never rolled back — the caller surfaces
 * `theme.syncFailed` / `theme.syncRetry` and leaves the display as-is
 * (local-first, T-1-21).
 */
export async function persistThemeNow(): Promise<ThemeWriteResult> {
  const options = useThemeStore.persist.getOptions();
  const partialize = options.partialize;
  if (!partialize) {
    return { ok: false, error: 'THEME_PERSIST_CONFIG_MISSING' };
  }

  const value = JSON.stringify({
    state: partialize(useThemeStore.getState()),
    version: options.version,
  });

  try {
    await syncStorageAdapter.setItem(THEME_STORAGE_KEY, value);
    await flushPendingWrites();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debugLog('THEME_SYNC_WRITE_FAILED', message);
    return { ok: false, error: message };
  }
}
