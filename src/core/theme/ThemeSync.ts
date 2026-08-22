import { useEffect, useState } from 'react';
import { subscribe, publish } from '../runtime/BroadcastBus';
import { useThemeStore, type ThemeMode } from './ThemeStore';
import { getColorTheme } from './ThemeConfig';
import { debugLog } from '../log/debugLog';

type ThemeSyncMessage =
  | { type: 'THEME_CHANGED'; mode: ThemeMode }
  | { type: 'COLOR_THEME_CHANGED'; colorTheme: string };

export type ThemeSyncResult = { ok: true } | { ok: false; error: string };

const THEME_STORAGE_KEY = 'np_theme';
const THEME_PACK_STORAGE_KEY = 'np_theme_pack';

/**
 * Hook that subscribes to the 'np_theme' BroadcastChannel and applies
 * theme changes broadcast from other extension surfaces (Side Panel ↔ Full App Tab ↔ Options).
 *
 * Must be called in surface shells for bidirectional theme sync.
 */
export function useThemeSync(): void {
  const mode = useThemeStore((s) => s.mode);
  const colorTheme = useThemeStore((s) => s.colorTheme);

  // Monitor system dark mode media query
  const [systemIsDark, setSystemIsDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // 1. Subscribe to broadcasted theme changes from other windows/tabs
  useEffect(() => {
    const unsubscribe = subscribe<ThemeSyncMessage>('np_theme', (msg) => {
      if (msg.type === 'THEME_CHANGED') {
        if (useThemeStore.getState().mode !== msg.mode) {
          useThemeStore.getState().setMode(msg.mode);
        }
      } else if (msg.type === 'COLOR_THEME_CHANGED') {
        if (useThemeStore.getState().colorTheme !== msg.colorTheme) {
          useThemeStore.getState().setColorTheme(msg.colorTheme);
        }
      }
    });
    return unsubscribe;
  }, []);

  // 2. Apply 'dark' class & CSS variables to document.documentElement whenever mode, systemIsDark, or colorTheme changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const isDark = mode === 'dark' || (mode === 'auto' && systemIsDark);
      document.documentElement.classList.toggle('dark', isDark);

      const themeObj = getColorTheme(colorTheme);
      const activeColor = isDark ? themeObj.darkPrimary : themeObj.primary;
      document.documentElement.style.setProperty('--np-primary', activeColor);
      document.documentElement.style.setProperty('--np-primary-light', `${activeColor}20`);
    }
  }, [mode, systemIsDark, colorTheme]);
}

/**
 * Publish a theme change to the 'np_theme' BroadcastChannel so other
 * surfaces can react immediately.
 */
export function publishThemeChange(mode: ThemeMode): void {
  publish('np_theme', { type: 'THEME_CHANGED', mode });
}

export function publishColorThemeChange(colorTheme: string): void {
  publish('np_theme', { type: 'COLOR_THEME_CHANGED', colorTheme });
}

/**
 * Plan 01-07 (D-10 UI half): write BOTH `np_theme` (mode) AND
 * `np_theme_pack` (pack) to chrome.storage.sync so the cross-surface
 * propagation path is consistent. The ThemeStore's own persist config
 * already debounces mode writes via `syncStorageAdapter` — this helper
 * is the explicit, "I'm intentionally syncing" path used by the
 * ThemeToggle Segmented control.
 *
 * Returns a Promise resolving to:
 *   - `{ ok: true }` on success
 *   - `{ ok: false, error: string }` on failure (caller surfaces an
 *     actionable "Couldn't apply theme to other surface" toast — the
 *     local mode change is NOT rolled back, per local-first)
 */
export async function applyThemeToSync(mode: ThemeMode, pack: string): Promise<ThemeSyncResult> {
  if (typeof chrome === 'undefined' || !chrome?.storage?.sync) {
    // No chrome.storage (e.g. dev shell running outside an extension) —
    // treat as a soft success since the local state already updated.
    return { ok: true };
  }
  try {
    await chrome.storage.sync.set({
      [THEME_STORAGE_KEY]: mode,
      [THEME_PACK_STORAGE_KEY]: pack,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debugLog('THEME_SYNC_WRITE_FAILED', message);
    return { ok: false, error: message };
  }
}

/**
 * Plan 01-07 (D-10 UI half): register a chrome.storage.onChanged listener
 * for the `np_theme` (mode) and `np_theme_pack` (pack) keys. When the
 * other surface writes a new value, apply it locally. The `!==` guard
 * matches the established `ThemeStore.setMode`/`setColorTheme` pattern
 * (PATTERNS :37-48) — without it, this listener + the writer would form
 * a write/notify loop on every toggle.
 *
 * Returns an unsubscribe function. Must be called once per surface mount;
 * call the returned cleanup on unmount.
 */
export function startThemeOnChangedSync(): () => void {
  if (typeof chrome === 'undefined' || !chrome?.storage?.onChanged) {
    return () => {};
  }
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'sync') return;

    const modeChange = changes[THEME_STORAGE_KEY];
    if (modeChange?.newValue !== undefined) {
      const newMode = modeChange.newValue as ThemeMode;
      if (useThemeStore.getState().mode !== newMode) {
        useThemeStore.getState().setMode(newMode);
      }
    }

    const packChange = changes[THEME_PACK_STORAGE_KEY];
    if (packChange?.newValue !== undefined) {
      const newPack = String(packChange.newValue);
      if (useThemeStore.getState().pack !== newPack) {
        useThemeStore.getState().setPack(newPack);
      }
    }
  };

  chrome.storage.onChanged.addListener(handler);
  return () => {
    chrome.storage.onChanged.removeListener(handler);
  };
}

