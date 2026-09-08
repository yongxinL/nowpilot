import { theme, type ConfigProviderProps } from 'antd';
import enUS from 'antd/locale/en_US';
import type { ThemeMode, ThemePack } from './ThemeStore';

export interface AntdConfigOptions {
  mode: ThemeMode;
  pack: ThemePack;
  compact: boolean;
}

const PACK_TOKEN_OVERLAY: Record<ThemePack, Record<string, unknown>> = {
  default: {},
  'liquid-glass': { colorBgContainer: 'rgba(255,255,255,0.68)' },
  'claude-warm': { colorBgBase: '#FAF7F2' },
};

export function getAntdConfig(opts: AntdConfigOptions): ConfigProviderProps {
  const isDark =
    opts.mode === 'dark' ||
    (opts.mode === 'auto' &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const algorithm = [
    isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    ...(opts.compact ? [theme.compactAlgorithm] : []),
  ];
  const packToken = PACK_TOKEN_OVERLAY[opts.pack] ?? {};
  return {
    locale: enUS,
    theme: {
      algorithm,
      token: {
        colorPrimary: '#3B82F6',
        colorInfo: '#3B82F6',
        colorSuccess: '#10B981',
        colorWarning: '#F59E0B',
        colorError: '#EF4444',
        borderRadius: 8,
        fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
        fontSize: opts.compact ? 13 : 14,
        controlHeight: opts.compact ? 30 : 32,
        ...packToken,
      },
      components: {
        Layout: {
          headerBg: isDark ? '#141414' : '#FFFFFF',
          siderBg: isDark ? '#141414' : '#FAFAFA',
          headerHeight: opts.compact ? 44 : 56,
        },
        Menu: {
          itemHeight: opts.compact ? 32 : 40,
          itemMarginInline: opts.compact ? 4 : 8,
          collapsedIconSize: 16,
        },
        Button: {
          controlHeight: opts.compact ? 28 : 32,
          borderRadius: 6,
        },
        Input: {
          controlHeight: opts.compact ? 30 : 32,
        },
        Card: {
          bodyPadding: opts.compact ? 12 : 20,
        },
        Table: {
          cellPaddingBlock: opts.compact ? 8 : 12,
          cellPaddingInline: opts.compact ? 8 : 16,
        },
        Modal: {
          titleFontSize: opts.compact ? 15 : 16,
        },
        Notification: {
          width: opts.compact ? 320 : 384,
        },
      },
    },
  };
}
