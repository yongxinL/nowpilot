import { ThemeConfig, theme } from 'antd';
import { getColorTheme } from '../core/theme/ThemeConfig';
import { claudePlusLight, claudePlusDark, applyClaudePlusCssVars } from './packs/claudePlus';

export * from './semanticTokens';
export * from './componentTokens';
export * from './algorithms';
export * from './packs/claudePlus';

export function getLightTheme(_colorThemeId?: string): ThemeConfig {
  return claudePlusLight;
}

export function getDarkTheme(_colorThemeId?: string): ThemeConfig {
  return claudePlusDark;
}

export const lightTheme: ThemeConfig = claudePlusLight;
export const darkTheme: ThemeConfig = claudePlusDark;


