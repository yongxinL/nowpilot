import { ThemeConfig, theme } from 'antd';

export const getAppTheme = (isDarkMode: boolean): ThemeConfig => ({
  algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: '#6366f1',
    colorInfo: '#6366f1',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    fontSize: 14,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    colorBgContainer: isDarkMode ? '#1e1e24' : '#ffffff',
    colorBgLayout: isDarkMode ? '#121216' : '#f8fafc',
    colorBorderSecondary: isDarkMode ? '#2e2e38' : '#f1f5f9',
  },
  components: {
    Button: {
      borderRadius: 10,
      fontWeight: 500,
    },
    Input: {
      borderRadius: 10,
    },
    Card: {
      borderRadiusLG: 16,
    },
    Modal: {
      borderRadiusLG: 20,
    },
    Dropdown: {
      borderRadiusSM: 10,
    }
  },
});
