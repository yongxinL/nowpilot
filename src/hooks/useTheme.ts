import { useThemeStore } from '../core/stores/themeStore';
import type { ThemeMode } from '../core/stores/themeStore';

export type { ThemeMode } from '../core/stores/themeStore';

export interface UseThemeReturn {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

/**
 * Convenience hook that extracts theme state from useThemeStore
 * using individual selector functions to prevent unnecessary re-renders.
 */
export function useTheme(): UseThemeReturn {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return { mode, setMode };
}
