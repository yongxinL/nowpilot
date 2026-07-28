import type { ThemeConfig } from 'antd';
import { theme } from 'antd';
import { useThemeStore } from './ThemeStore';

export interface AntdConfigOptions {
  compact: boolean;
}

export function getAntdConfig(opts: AntdConfigOptions): ThemeConfig {
  const mode = useThemeStore.getState().resolvedMode();
  const isDark = mode === 'dark';

  const algorithm = isDark
    ? opts.compact
      ? [theme.darkAlgorithm, theme.compactAlgorithm]
      : theme.darkAlgorithm
    : opts.compact
      ? [theme.defaultAlgorithm, theme.compactAlgorithm]
      : theme.defaultAlgorithm;

  return {
    algorithm,
    token: {
      colorPrimary: '#6366f1',
      colorInfo: '#6366f1',
      borderRadius: 12,
      borderRadiusLG: 16,
      borderRadiusSM: 8,
      fontSize: 14,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
    },
  };
}
