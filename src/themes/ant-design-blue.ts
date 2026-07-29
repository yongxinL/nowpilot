import { theme } from 'antd';
import { NowPilotThemeDefinition } from './types';

export const antDesignBlueTheme: NowPilotThemeDefinition = {
  id: 'liquid-glass',
  label: 'Ant Design Blue',
  description: 'Classic Ant Design blue primary theme with clean contrast.',
  light: {
    algorithm: theme.defaultAlgorithm,
    token: {
      colorPrimary: '#1677ff',
      colorInfo: '#1677ff',
      borderRadius: 12,
      borderRadiusLG: 16,
      borderRadiusSM: 8,
      colorBgContainer: '#ffffff',
      colorBgLayout: '#f5f5f5',
      colorBorderSecondary: '#f0f0f0',
      colorText: '#000000e0',
      colorTextSecondary: '#000000a6',
    },
    components: {
      Button: {
        borderRadius: 10,
        fontWeight: 500,
        colorPrimary: '#1677ff',
        colorPrimaryHover: '#4096ff',
      },
      Input: {
        borderRadius: 10,
        colorBgContainer: '#ffffff',
      },
      Card: {
        borderRadiusLG: 16,
      },
      Modal: {
        borderRadiusLG: 20,
      },
      Dropdown: {
        borderRadiusSM: 10,
      },
      Select: {
        borderRadius: 10,
      },
      Segmented: {
        borderRadius: 10,
      },
    },
  },
  dark: {
    algorithm: theme.darkAlgorithm,
    token: {
      colorPrimary: '#1677ff',
      colorInfo: '#1677ff',
      borderRadius: 12,
      borderRadiusLG: 16,
      borderRadiusSM: 8,
      colorBgContainer: '#141414',
      colorBgLayout: '#000000',
      colorBorderSecondary: '#303030',
      colorText: '#ffffffd9',
      colorTextSecondary: '#ffffffa6',
    },
    components: {
      Button: {
        borderRadius: 10,
        fontWeight: 500,
        colorPrimary: '#1677ff',
        colorPrimaryHover: '#4096ff',
      },
      Input: {
        borderRadius: 10,
        colorBgContainer: '#1f1f1f',
      },
      Card: {
        borderRadiusLG: 16,
      },
      Modal: {
        borderRadiusLG: 20,
      },
      Dropdown: {
        borderRadiusSM: 10,
      },
      Select: {
        borderRadius: 10,
      },
      Segmented: {
        borderRadius: 10,
      },
    },
  },
  cssVars: {
    light: {
      '--np-bg': '#f5f5f5',
      '--np-fg': '#000000e0',
      '--np-card': '#ffffff',
      '--np-card-fg': '#000000e0',
      '--np-muted': '#f0f0f0',
      '--np-muted-fg': '#000000a6',
      '--np-accent': '#e6f4ff',
      '--np-accent-fg': '#0958d9',
      '--np-border': '#d9d9d9',
      '--np-input': '#d9d9d9',
      '--np-ring': '#1677ff',
      '--np-sidebar': '#f5f5f5',
      '--np-sidebar-fg': '#000000e0',
      '--np-radius': '16px',
      '--np-shadow': '0 1px 2px rgba(0, 0, 0, 0.06)',
    },
    dark: {
      '--np-bg': '#000000',
      '--np-fg': '#ffffffd9',
      '--np-card': '#141414',
      '--np-card-fg': '#ffffffd9',
      '--np-muted': '#1f1f1f',
      '--np-muted-fg': '#ffffffa6',
      '--np-accent': '#111d2c',
      '--np-accent-fg': '#1668dc',
      '--np-border': '#303030',
      '--np-input': '#303030',
      '--np-ring': '#1677ff',
      '--np-sidebar': '#000000',
      '--np-sidebar-fg': '#ffffffd9',
      '--np-radius': '16px',
      '--np-shadow': '0 4px 12px rgba(0, 0, 0, 0.4)',
    },
  },
};
