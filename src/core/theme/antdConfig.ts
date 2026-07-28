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
      colorPrimary: '#1677ff',
      borderRadius: 6,
      controlHeight: 32,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
  };
}
