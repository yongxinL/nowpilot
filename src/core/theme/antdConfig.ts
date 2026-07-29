import type { ThemeConfig } from 'antd';
import { theme } from 'antd';

export interface AntdConfigOptions {
  compact?: boolean;
  isDark?: boolean;
}

export function getAntdConfig(opts?: AntdConfigOptions): ThemeConfig {
  return {
    token: {
      colorPrimary: '#1677ff',
      borderRadius: 6,
      controlHeight: 32,
    },
    algorithm: opts?.isDark
      ? theme.darkAlgorithm
      : opts?.compact
        ? [theme.defaultAlgorithm, theme.compactAlgorithm]
        : theme.defaultAlgorithm,
  };
}
