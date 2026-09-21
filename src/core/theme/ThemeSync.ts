import { useEffect, useState, createElement } from 'react';
import { App as AntdApp, Typography } from 'antd';
import {
  useThemeStore,
  applyThemeDom,
  type ThemeMode,
  type ThemeWriteResult,
} from './ThemeStore';
import { resolveThemePack, resolveSystem, type ThemePack } from './antdConfig';
import { isThemeMode } from './ThemeConfig';
import { t } from '../i18n/strings';

const THEME_STORAGE_KEY = 'np_theme';
const THEME_PACK_STORAGE_KEY = 'np_theme_pack';
const THEME_SYNC_TOAST_KEY = 'theme-sync-failed';

/**
 * Tolerant read of a `chrome.storage.sync.np_theme` value (T-1-20).
 *
 * Accepts exactly two representations:
 *   - the canonical persist envelope (an object, or the JSON string zustand
 *     actually stores) whose `state.mode` is `auto` | `light` | `dark`;
 *   - a legacy bare mode string written by an installed prototype.
 *
 * Everything else — numbers, `null`, arrays, envelopes with an unrecognised
 * mode, malformed JSON — returns `null` so the caller ignores it. The value is
 * never cast into `ThemeMode`.
 */
export function readThemeValue(raw: unknown): { mode: ThemeMode; pack: ThemePack } | null {
  if (typeof raw === 'string') {
    if (isThemeMode(raw)) {
      return { mode: raw, pack: 'default' };
    }
    try {
      return readThemeValue(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const state = (raw as { state?: unknown }).state;
    if (state && typeof state === 'object' && !Array.isArray(state)) {
      const mode = (state as { mode?: unknown }).mode;
      if (isThemeMode(mode)) {
        const pack = (state as { pack?: unknown }).pack;
        return {
          mode,
          pack: typeof pack === 'string' ? resolveThemePack(pack) : 'default',
        };
      }
    }
  }

  return null;
}

/**
 * Subscribe to `chrome.storage.onChanged` (sync area) — the only cross-surface
 * propagation path (D-15 / APPR-04).
 *
 * When the other surface writes `np_theme`, this handler re-derives state
 * locally: a different mode is applied, a same-value event does nothing (the
 * idempotency guarantee that prevents a write/notify loop), and an
 * unrecognised value is ignored outright. `np_theme_pack` is handled on its own
 * key, so a mode-only write never has to invent pack state.
 *
 * Returns an unsubscribe function; call it on unmount.
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

    const themeChange = changes[THEME_STORAGE_KEY];
    if (themeChange?.newValue !== undefined) {
      const parsed = readThemeValue(themeChange.newValue);
      // Unrecognised shape: ignore it rather than casting an unknown value
      // into `ThemeMode` (T-1-20).
      if (!parsed) return;

      const store = useThemeStore.getState();
      if (store.mode !== parsed.mode) {
        store.setMode(parsed.mode);
      }
      // The persisted envelope carries the pack alongside the mode; applying
      // it here keeps a cold reader converged without a second copy. The
      // bare-string legacy shape resolves to `default` (the prototype default)
      // and `setPack` is a no-op when the value already matches.
      if (store.pack !== parsed.pack) {
        store.setPack(parsed.pack);
      }
    }

    const packChange = changes[THEME_PACK_STORAGE_KEY];
    if (packChange && typeof packChange.newValue === 'string') {
      const store = useThemeStore.getState();
      if (store.pack !== packChange.newValue) {
        store.setPack(packChange.newValue);
      }
    }
  };

  chrome.storage.onChanged.addListener(handler);
  return () => {
    chrome.storage.onChanged.removeListener(handler);
  };
}

/**
 * Surface lifecycle hook (called once per surface root).
 *
 * Keeps the document root in step with the store for the **hand-written**
 * selectors in `src/index.css` (H-3 / OQ2) and subscribes this surface to the
 * `chrome.storage.onChanged` propagation path. No BroadcastBus channel, no
 * polling, no per-surface copy of the mode.
 */
export function useThemeSync(): void {
  const mode = useThemeStore((s) => s.mode);
  const colorTheme = useThemeStore((s) => s.colorTheme);

  // Track the system preference so `mode === 'auto'` re-applies on change.
  const [systemIsDark, setSystemIsDark] = useState(() => resolveSystem() === 'dark');

  useEffect(() => startThemeOnChangedSync(), []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    applyThemeDom(mode, colorTheme);
  }, [mode, colorTheme, systemIsDark]);
}

/**
 * Surface the pinned local-first failure pair through the surface's
 * `App.useApp()` message API: `theme.syncFailed` (the problem **and** the local
 * outcome) plus the `theme.syncRetry` action, which re-invokes the failed
 * write and re-toasts only while the write keeps failing. The visible mode is
 * never rolled back (UI-SPEC § Theme Contract).
 */
export function showThemeSyncFailure(
  message: ReturnType<typeof AntdApp.useApp>['message'],
  retry: () => Promise<ThemeWriteResult>,
): void {
  const retryLink = createElement(
    Typography.Link,
    {
      onClick: () => {
        void retry().then((result) => {
          if (result.ok) {
            message.destroy(THEME_SYNC_TOAST_KEY);
            return;
          }
          showThemeSyncFailure(message, retry);
        });
      },
    },
    t('theme.syncRetry'),
  );

  message.error({
    key: THEME_SYNC_TOAST_KEY,
    duration: 4,
    content: createElement('span', null, t('theme.syncFailed'), ' ', retryLink),
  });
}
