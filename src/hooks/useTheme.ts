import { useEffect, useState } from 'react';
import { useThemeStore } from '../core/stores/themeStore';
import type { ThemeMode } from '../core/stores/themeStore';

export type { ThemeMode } from '../core/stores/themeStore';

export interface UseThemeReturn {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

/**
 * Convenience hook that extracts theme state from useThemeStore
 * and resolves the actual dark/light display mode (including system auto detection) reactively.
 */
export function useTheme(): UseThemeReturn {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const [isSystemDark, setIsSystemDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setIsSystemDark(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isDark = mode === 'dark' || (mode === 'auto' && isSystemDark);

  return { mode, setMode, isDark };
}
