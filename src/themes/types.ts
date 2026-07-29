import type { ThemeConfig } from 'antd';

export type DisplayMode = 'auto' | 'light' | 'dark';

export type ThemeId = 'liquid-glass' | 'claude';

export type ResolvedThemeMode = 'light' | 'dark';

export interface NowPilotThemeDefinition {
  id: ThemeId;
  label: string;
  description?: string;
  light: ThemeConfig;
  dark: ThemeConfig;
  cssVars?: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
}
