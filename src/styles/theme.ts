import { ThemeConfig } from 'antd';
import { resolveNowPilotTheme } from '../themes/theme-resolver';
import { DisplayMode, ThemeId } from '../themes/types';

export type ThemeModeOption = 'light' | 'dark' | 'auto' | 'liquid-glass' | 'claude';

export const getAppTheme = (isDarkMode: boolean, appTheme?: string): ThemeConfig => {
  let themeId: ThemeId = 'liquid-glass';
  if (appTheme === 'Claude' || appTheme === 'claude') {
    themeId = 'claude';
  } else {
    themeId = 'liquid-glass';
  }

  const displayMode: DisplayMode = isDarkMode ? 'dark' : 'light';

  const res = resolveNowPilotTheme({
    displayMode,
    themeId,
    systemPrefersDark: isDarkMode,
  });

  return res.config;
};


