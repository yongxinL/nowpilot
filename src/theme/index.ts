import { ThemeConfig, theme } from 'antd';
import { getColorTheme } from '../core/theme/ThemeConfig';

export function getLightTheme(colorThemeId?: string): ThemeConfig {
  const themeObj = getColorTheme(colorThemeId);
  return {
    algorithm: theme.defaultAlgorithm,
    cssVar: { key: 'antd' },
    token: {
      colorPrimary: themeObj.primary,
      colorPrimaryBg: '#d3ecfc',
      colorPrimaryBgHover: '#bce1fa',
      colorPrimaryBorder: '#9bd2f7',
      colorPrimaryHover: '#2ab1ee',
      colorPrimaryActive: '#148ec4',
      colorPrimaryText: '#00324e',
      colorBgContainer: '#ffffff',
      colorBgLayout: '#fafcfd',
      colorBgElevated: '#ffffff',
      colorBorder: '#dadfe1',
      colorBorderSecondary: '#ebeff2',
      colorText: '#12171a',
      colorTextSecondary: '#536068',
      colorTextTertiary: '#8a99a4',
      colorTextQuaternary: '#b4bec5',
      colorFillSecondary: '#ebeff2',
      colorFillTertiary: '#eff2f4',
      colorFillQuaternary: '#f4f7f9',
      borderRadius: 6,
      borderRadiusSM: 4,
      borderRadiusLG: 8,
      borderRadiusXS: 2,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    components: {
      Menu: {
        itemSelectedBg: '#d3ecfc',
        itemSelectedColor: '#00324e',
        itemHoverBg: 'rgba(27, 161, 221, 0.08)',
        itemHoverColor: '#1ba1dd',
        itemBorderRadius: 8,
      },
      Segmented: {
        itemSelectedBg: '#ffffff',
        itemSelectedColor: '#12171a',
        itemHoverBg: 'rgba(0, 0, 0, 0.04)',
        trackBg: '#eff2f4',
        borderRadius: 8,
        borderRadiusSM: 6,
      },
      Button: {
        colorPrimary: themeObj.primary,
        colorPrimaryHover: '#2ab1ee',
        colorPrimaryActive: '#148ec4',
        primaryColor: '#ffffff',
        defaultBorderColor: '#dadfe1',
        defaultBg: '#ffffff',
        defaultColor: '#12171a',
        borderRadius: 6,
        borderRadiusSM: 4,
        borderRadiusLG: 8,
      },
      Select: {
        selectorBg: '#ffffff',
        optionSelectedBg: '#d3ecfc',
        optionSelectedColor: '#00324e',
        borderRadius: 6,
      },
      Input: {
        colorBgContainer: '#ffffff',
        colorBorder: '#dadfe1',
        borderRadius: 6,
      },
      Card: {
        colorBgContainer: '#ffffff',
        colorBorderSecondary: '#dadfe1',
        borderRadiusLG: 12,
      },
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
      colorPrimaryBg: '#022d41',
      colorPrimaryBgHover: '#033b56',
      colorPrimaryBorder: '#055073',
      colorPrimaryHover: '#6dd0fd',
      colorPrimaryActive: '#3ab5fb',
      colorPrimaryText: '#9dd6f9',
      colorBgContainer: '#15191b',
      colorBgLayout: '#0b0e0f',
      colorBgElevated: '#1c2023',
      colorBorder: '#292f32',
      colorBorderSecondary: '#191e20',
      colorText: '#eceff1',
      colorTextSecondary: '#8d9ba3',
      colorTextTertiary: '#66757f',
      colorTextQuaternary: '#424e56',
      colorFillSecondary: '#1e2225',
      colorFillTertiary: '#191e20',
      colorFillQuaternary: '#131719',
      borderRadius: 6,
      borderRadiusSM: 4,
      borderRadiusLG: 8,
      borderRadiusXS: 2,
      fontFamily: 'Segoe UI, Helvetica Neue, Helvetica, Lucida Grande, Arial, sans-serif',
    },
    components: {
      Menu: {
        itemSelectedBg: '#022d41',
        itemSelectedColor: '#9dd6f9',
        itemHoverBg: 'rgba(80, 193, 252, 0.08)',
        itemHoverColor: '#50c1fc',
        itemBorderRadius: 8,
      },
      Segmented: {
        itemSelectedBg: '#1c2023',
        itemSelectedColor: '#eceff1',
        itemHoverBg: 'rgba(255, 255, 255, 0.06)',
        trackBg: '#191e20',
        borderRadius: 8,
        borderRadiusSM: 6,
      },
      Button: {
        colorPrimary: themeObj.darkPrimary,
        colorPrimaryHover: '#6dd0fd',
        colorPrimaryActive: '#3ab5fb',
        primaryColor: '#110c0d',
        defaultBorderColor: '#292f32',
        defaultBg: '#15191b',
        defaultColor: '#eceff1',
        borderRadius: 6,
        borderRadiusSM: 4,
        borderRadiusLG: 8,
      },
      Select: {
        selectorBg: '#15191b',
        optionSelectedBg: '#022d41',
        optionSelectedColor: '#9dd6f9',
        borderRadius: 6,
      },
      Input: {
        colorBgContainer: '#15191b',
        colorBorder: '#292f32',
        borderRadius: 6,
      },
      Card: {
        colorBgContainer: '#15191b',
        colorBorderSecondary: '#292f32',
        borderRadiusLG: 12,
      },
    },
  };
}

export const lightTheme: ThemeConfig = getLightTheme();
export const darkTheme: ThemeConfig = getDarkTheme();

