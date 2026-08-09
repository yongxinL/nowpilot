// src/core/theme/ThemeStore.ts — Canonical theme store (D-13). The single
// writer and reader of np_theme + np_theme_pack — deliberately NOT zustand's
// storage middleware (Pitfall 7: storage-backed middleware writes localStorage,
// which does not cross surfaces; the plan pins the storage adapter +
// chrome.storage.onChanged instead). D-15 rewire (02-08): persistence now flows
// through Setting.ts sync-first (settingReadSync / settingWriteSync) with the
// local shadow fallback for chrome.storage.sync quota/rate failures — ThemeStore
// stays the read-validate owner (T-1-10). init() hydrates from storage,
// subscribes to chrome.storage.onChanged for both keys AND both areas (sync =
// the canonical store, local = a transient shadow; foreign writes from either
// surface propagate atomically) and to matchMedia for 'auto' mode (D-11).
// T-1-10: stored values are read-validated on every load — unknown values fall
// back to 'auto'/'default' (never trust raw storage). Every error path calls
// debugLog with a canonical THEME_* code (Golden Rule 9).
import { create } from 'zustand';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { settingReadSync, settingWriteSync } from '@/core/storage/Setting';
import { isThemePackId } from '@/core/theme/themePacks';
import type { ThemeMode, ThemePack } from '@/core/theme/themePacks';

export interface ThemeState {
  pack: ThemePack;
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  isReady: boolean;
  /** Hydrate from chrome.storage.local and wire the sync listeners (idempotent). */
  init(): Promise<void>;
  /** Write np_theme then update state (D-13). */
  setMode(mode: ThemeMode): Promise<void>;
  /** Write np_theme_pack then update state. Exists for D-10; no UI calls it in Phase 1 (D-14). */
  setPack(pack: ThemePack): Promise<void>;
  /** Resolve the effective scheme: dark when mode==='dark' or auto matches the OS scheme. */
  getResolved(): 'light' | 'dark';
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function resolveScheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  // 'auto' — D-11: follow the OS scheme via matchMedia (Pitfall 6 guard).
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
    ? 'dark'
    : 'light';
}

function isValidMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

type OnChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

// remove-then-add keeps exactly ONE active listener per chrome instance — the
// T-1-11 "registered once" guard — while surviving a chrome mock swap (the
// fakeBrowser reset in tests clears all listeners; a plain boolean flag would
// leak the registration state and silently lose onChanged propagation).
let onChangedListener: OnChangedListener | null = null;
let mediaListener: (() => void) | null = null;

export const useThemeStore = create<ThemeState>()((set, get) => ({
  pack: 'default',
  mode: 'auto',
  resolved: resolveScheme('auto'),
  isReady: false,

  init: async () => {
    let mode: ThemeMode = 'auto';
    let pack: ThemePack = 'default';
    try {
      // D-15 rewire: hydrate sync-first through Setting (local shadow fallback);
      // the read-validate idiom (T-1-10) still gates every stored value.
      mode = await settingReadSync('np_theme', (v: unknown) => (isValidMode(v) ? v : null), 'auto');
      pack = await settingReadSync(
        'np_theme_pack',
        (v: unknown) => (isThemePackId(v) ? v : null),
        'default',
      );
    } catch (err) {
      // T-1-10 / Golden Rule 9: never throw — fall back to 'auto'/'default'.
      debugLog(ERROR_CODES.THEME_INIT, 'failed to read theme via Setting (sync-first)', {
        error: err instanceof Error ? err : undefined,
        module: 'ThemeStore',
      });
    }
    set({ mode, pack, resolved: resolveScheme(mode), isReady: true });

    // chrome.storage.onChanged — foreign writes propagate to this surface (D-13).
    // D-15 rewire: the change may arrive from EITHER area — 'sync' (the
    // canonical store) or 'local' (a transient shadow) — both go through the
    // same read-validate gate.
    const handleChanged: OnChangedListener = (changes, area) => {
      if (area === 'sync' || area === 'local') {
        const modeChange = changes.np_theme;
        if (modeChange !== undefined && isValidMode(modeChange.newValue)) {
          set({ mode: modeChange.newValue, resolved: resolveScheme(modeChange.newValue) });
        }
        const packChange = changes.np_theme_pack;
        if (packChange !== undefined && isThemePackId(packChange.newValue)) {
          set({ pack: packChange.newValue });
        }
        debugLog(ERROR_CODES.THEME_ON_CHANGED, 'theme storage change propagated', {
          silent: true,
          module: 'ThemeStore',
        });
      }
    };
    if (onChangedListener !== null) {
      chrome.storage.onChanged.removeListener(onChangedListener);
    }
    onChangedListener = handleChanged;
    chrome.storage.onChanged.addListener(handleChanged);

    // matchMedia — recompute 'auto' when the OS scheme flips (D-11, Pitfall 6 guard).
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia(DARK_QUERY);
      const handleMedia: () => void = () => {
        if (get().mode === 'auto') {
          set({ resolved: resolveScheme('auto') });
          debugLog(ERROR_CODES.THEME_MATCH_MEDIA, 'OS color-scheme change recomputed auto mode', {
            silent: true,
            module: 'ThemeStore',
          });
        }
      };
      if (mediaListener !== null && mql.removeEventListener) {
        mql.removeEventListener('change', mediaListener);
      }
      mediaListener = handleMedia;
      if (mql.addEventListener) mql.addEventListener('change', handleMedia);
    }
  },

  setMode: async (mode) => {
    try {
      // D-15 rewire: sync-first through Setting; the shadow machinery handles
      // quota/rate failure — the write must still never throw to the UI.
      await settingWriteSync('np_theme', mode);
    } catch (err) {
      debugLog(ERROR_CODES.THEME_WRITE, 'failed to write np_theme', {
        error: err instanceof Error ? err : undefined,
        module: 'ThemeStore',
      });
    }
    set({ mode, resolved: resolveScheme(mode) });
  },

  setPack: async (pack) => {
    try {
      await settingWriteSync('np_theme_pack', pack);
    } catch (err) {
      debugLog(ERROR_CODES.THEME_WRITE, 'failed to write np_theme_pack', {
        error: err instanceof Error ? err : undefined,
        module: 'ThemeStore',
      });
    }
    set({ pack });
  },

  getResolved: () => resolveScheme(get().mode),
}));
