import { ThemeConfig, theme as antdTheme } from 'antd';
import { DisplayMode, ThemeId, ResolvedThemeMode } from './types';
import { getThemeDefinition } from './theme-registry';

export interface ResolveThemeParams {
  displayMode: DisplayMode;
  themeId: ThemeId;
  systemPrefersDark: boolean;
  accentColor?: string;
}

export interface ResolveThemeResult {
  config: ThemeConfig;
  resolvedMode: ResolvedThemeMode;
  themeId: ThemeId;
}

export function resolveNowPilotTheme({
  displayMode,
  themeId,
  systemPrefersDark,
  accentColor,
}: ResolveThemeParams): ResolveThemeResult {
  const themeDef = getThemeDefinition(themeId);

  const resolvedMode: ResolvedThemeMode =
    displayMode === 'light'
      ? 'light'
      : displayMode === 'dark'
      ? 'dark'
      : systemPrefersDark
      ? 'dark'
      : 'light';

  const baseConfig = resolvedMode === 'dark' ? themeDef.dark : themeDef.light;

  const config: ThemeConfig = {
    ...baseConfig,
    algorithm: resolvedMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    cssVar: { key: 'np' },
    token: {
      ...baseConfig.token,
      ...(accentColor ? { colorPrimary: accentColor, colorInfo: accentColor } : {}),
    },
  };

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('data-display-mode', resolvedMode);
    root.setAttribute('data-theme', themeDef.id);
    root.classList.toggle('dark', resolvedMode === 'dark');

    const vars = themeDef.cssVars?.[resolvedMode];
    if (vars) {
      Object.entries(vars).forEach(([key, val]) => {
        root.style.setProperty(key, val);
      });
    }
  }

  return {
    config,
    resolvedMode,
    themeId: themeDef.id,
  };
}
