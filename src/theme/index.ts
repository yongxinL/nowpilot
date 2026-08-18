import { ThemeConfig, theme } from 'antd';
import { getColorTheme } from '../core/theme/ThemeConfig';

export function getLightTheme(colorThemeId?: string): ThemeConfig {
  const themeObj = getColorTheme(colorThemeId);
  return {
    algorithm: theme.defaultAlgorithm,
    cssVar: { key: 'antd' },
    token: {
      colorPrimary: themeObj.primary,
      colorBgContainer: '#ffffff',
      colorBgLayout: '#fafcfd',
      colorBgElevated: '#ffffff',
      colorBorder: '#dadfe1',
      colorBorderSecondary: '#ebeff2',
      colorText: '#12171a',
      colorTextSecondary: '#536068',
      borderRadius: 6,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
  };
}

export function getDarkTheme(colorThemeId?: string): ThemeConfig {
  const themeObj = getColorTheme(colorThemeId);
  return {
    algorithm: theme.darkAlgorithm,
    cssVar: { key: 'antd' },
    token: {
      colorPrimary: themeObj.darkPrimary,
      colorBgContainer: '#15191b',
      colorBgLayout: '#0b0e0f',
      colorBgElevated: '#1c2023',
      colorBorder: '#292f32',
      colorBorderSecondary: '#191e20',
      colorText: '#eceff1',
      colorTextSecondary: '#8d9ba3',
      borderRadius: 6,
      fontFamily: 'Segoe UI, Helvetica Neue, Helvetica, Lucida Grande, Arial, sans-serif',
    },
  };
}

export const lightTheme: ThemeConfig = getLightTheme();
export const darkTheme: ThemeConfig = getDarkTheme();

