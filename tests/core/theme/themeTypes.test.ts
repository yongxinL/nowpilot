import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PACK,
  THEME_MODES,
  THEME_PACKS,
  ThemeModeSchema,
  ThemePackSchema,
  resolveColorScheme,
} from '@/core/theme/themeTypes';

describe('theme types', () => {
  it('declares the three display modes and three packs in order', () => {
    expect(THEME_MODES).toEqual(['auto', 'light', 'dark']);
    expect(THEME_PACKS).toEqual(['default', 'liquid-glass', 'claude-warm']);
    expect(DEFAULT_THEME_MODE).toBe('auto');
    expect(DEFAULT_THEME_PACK).toBe('default');
  });

  it('rejects unknown theme values', () => {
    expect(ThemeModeSchema.safeParse('sepia').success).toBe(false);
    expect(ThemePackSchema.safeParse('solarized').success).toBe(false);
  });

  it('resolves auto by prefers-color-scheme and passes explicit modes through', () => {
    expect(resolveColorScheme('auto', true)).toBe('dark');
    expect(resolveColorScheme('auto', false)).toBe('light');
    expect(resolveColorScheme('light', true)).toBe('light');
    expect(resolveColorScheme('dark', false)).toBe('dark');
  });
});
