import { theme, type ThemeConfig } from 'antd';
import { resolveColorScheme, type ThemeMode, type ThemePack } from './themeTypes';

export const NOWPILOT_SEED = {
  colorPrimary: '#3B82F6',
  colorSuccess: '#10B981',
  colorWarning: '#F59E0B',
  colorError: '#EF4444',
  colorInfo: '#3B82F6',
  colorTextBase: '#1F2430',
  colorBgBase: '#FCFCFD',
  borderRadius: 8,
  wireframe: false,
} as const;

export const NOWPILOT_COMPONENTS = {
  Card: { borderRadiusLG: 12 },
  Button: { borderRadius: 8, controlHeight: 32 },
  Layout: { headerHeight: 52 },
  Menu: { itemBorderRadius: 8 },
  Modal: { borderRadiusLG: 16 },
} as const;

export const NOWPILOT_PACK_OVERLAYS: Record<
  ThemePack,
  { token?: ThemeConfig['token']; components?: ThemeConfig['components'] }
> = {
  default: {},
  'liquid-glass': { token: { colorBgContainer: 'rgba(255,255,255,0.68)' } },
  'claude-warm': { token: { colorBgBase: '#FAF7F2' } },
};

export interface AntdConfigInput {
  mode: ThemeMode;
  pack: ThemePack;
  compact: boolean;
  prefersDark?: boolean;
}

export function getAntdConfig({
  mode,
  pack,
  compact,
  prefersDark = false,
}: AntdConfigInput): ThemeConfig {
  const scheme = resolveColorScheme(mode, prefersDark);
  const overlay = NOWPILOT_PACK_OVERLAYS[pack];
  const baseAlgorithm = scheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm;
  return {
    cssVar: { key: 'nowpilot' },
    hashed: false,
    algorithm: compact ? [baseAlgorithm, theme.compactAlgorithm] : baseAlgorithm,
    token: { ...NOWPILOT_SEED, ...overlay.token },
    components: { ...NOWPILOT_COMPONENTS, ...overlay.components },
  };
}
