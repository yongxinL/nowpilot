// src/core/theme/ThemeStore.ts — Canonical theme store (D-13). The single
// writer and reader of np_theme + np_theme_pack in chrome.storage.local —
// deliberately NOT zustand's storage middleware (Pitfall 7: storage-backed
// middleware writes localStorage, which does not cross surfaces; the plan pins
// the storage adapter + chrome.storage.onChanged instead). init() hydrates from
// storage, subscribes to chrome.storage.onChanged for both keys (foreign writes
// from the other surface propagate atomically) and to matchMedia for 'auto'
// mode (D-11). T-1-10: stored values are read-validated on every load — unknown
// values fall back to 'auto'/'default' (never trust raw storage). Every error
// path calls debugLog with a canonical THEME_* code (Golden Rule 9).
import { create } from 'zustand';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
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
const STORAGE_KEYS = ['np_theme', 'np_theme_pack'];

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
      const stored = await chrome.storage.local.get(STORAGE_KEYS);
      if (isValidMode(stored.np_theme)) mode = stored.np_theme;
      if (isThemePackId(stored.np_theme_pack)) pack = stored.np_theme_pack;
    } catch (err) {
      // T-1-10 / Golden Rule 9: never throw — fall back to 'auto'/'default'.
      debugLog(ERROR_CODES.THEME_INIT, 'failed to read theme from chrome.storage.local', {
        error: err instanceof Error ? err : undefined,
        module: 'ThemeStore',
      });
    }
    set({ mode, pack, resolved: resolveScheme(mode), isReady: true });

    // chrome.storage.onChanged — foreign writes propagate to this surface (D-13).
    const handleChanged: OnChangedListener = (changes, area) => {
      if (area !== 'local') return;
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
      await chrome.storage.local.set({ np_theme: mode });
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
      await chrome.storage.local.set({ np_theme_pack: pack });
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
