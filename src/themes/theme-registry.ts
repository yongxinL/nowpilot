import { NowPilotThemeDefinition, ThemeId } from './types';
import { liquidGlassTheme } from './liquid-glass';
import { claudeTheme } from './claude';

export const THEME_REGISTRY: Record<ThemeId, NowPilotThemeDefinition> = {
  'liquid-glass': liquidGlassTheme,
  'claude': claudeTheme,
};

export const ALL_THEMES: NowPilotThemeDefinition[] = [
  liquidGlassTheme,
  claudeTheme,
];

export function getThemeDefinition(id: ThemeId): NowPilotThemeDefinition {
  if (id && THEME_REGISTRY[id]) {
    return THEME_REGISTRY[id];
  }
  // Fallbacks for legacy config values if present
  if ((id as string) === 'Claude' || (id as string) === 'claude') return claudeTheme;
  if ((id as string) === 'Liquid Glass' || (id as string) === 'liquid-glass') return liquidGlassTheme;
  return liquidGlassTheme;
}
