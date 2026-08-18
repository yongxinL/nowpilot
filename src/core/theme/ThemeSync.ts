import { useEffect, useState } from 'react';
import { subscribe, publish } from '../runtime/BroadcastBus';
import { useThemeStore, type ThemeMode } from './ThemeStore';
import { getColorTheme } from './ThemeConfig';

type ThemeSyncMessage =
  | { type: 'THEME_CHANGED'; mode: ThemeMode }
  | { type: 'COLOR_THEME_CHANGED'; colorTheme: string };

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


