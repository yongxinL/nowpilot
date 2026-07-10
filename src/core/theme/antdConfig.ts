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
  const algorithm = mode === 'dark' ? [darkAlgorithm] : [defaultAlgorithm];
  if (compact) {
    algorithm.push(compactAlgorithm);
  }
  return { algorithm };
}

export function getXProviderConfig(options: AntdConfigOptions): XProviderThemeConfig {
  const cfg = getAntdConfig(options);
  return { algorithm: cfg.algorithm };
}
