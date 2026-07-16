import { type ThemeConfig, theme } from 'antd';
import type { ThemeMode } from '../stores/themeStore';

const { defaultAlgorithm, darkAlgorithm, compactAlgorithm } = theme;

export interface AntdConfigOptions {
  mode: ThemeMode;
  compact: boolean;
}

export type XProviderThemeConfig = Omit<ThemeConfig, 'components'>;

export function getAntdConfig(options: AntdConfigOptions): ThemeConfig {
  const { mode, compact } = options;
  let isDark = mode === 'dark';
  if (mode === 'auto' && typeof window !== 'undefined') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  const algorithm = isDark ? [darkAlgorithm] : [defaultAlgorithm];
  if (compact) {
    algorithm.push(compactAlgorithm);
  }
  return {
    algorithm,
    token: {
      colorPrimary: '#e0582e',
      colorInfo: '#e0582e',
    },
  };
}

export function getXProviderConfig(options: AntdConfigOptions): XProviderThemeConfig {
  const cfg = getAntdConfig(options);
  return {
    algorithm: cfg.algorithm,
    token: cfg.token,
  };
}
