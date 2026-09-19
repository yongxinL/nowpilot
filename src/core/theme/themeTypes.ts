import { z } from 'zod';

export const THEME_MODES = ['auto', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export const ThemeModeSchema = z.enum(THEME_MODES);

export const THEME_PACKS = ['default', 'liquid-glass', 'claude-warm'] as const;
export type ThemePack = (typeof THEME_PACKS)[number];
export const ThemePackSchema = z.enum(THEME_PACKS);

export const DEFAULT_THEME_MODE: ThemeMode = 'auto';
export const DEFAULT_THEME_PACK: ThemePack = 'default';

export type ResolvedColorScheme = 'light' | 'dark';

export function resolveColorScheme(mode: ThemeMode, prefersDark: boolean): ResolvedColorScheme {
  if (mode === 'auto') return prefersDark ? 'dark' : 'light';
  return mode;
}
