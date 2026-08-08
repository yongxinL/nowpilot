// src/core/theme/antdConfig.ts — Appendix F.2 canonical: derives the antd
// ConfigProviderProps (algorithm + token + per-component overrides) from
// { mode, pack, compact }. Consumed by the XProvider mounts in 01-09 — exactly
// ONE ConfigProvider per surface (Appendix F.3; never nest ConfigProvider inside
// XProvider). No React imports here — only the antd `theme` import. Pitfall 6
// guard: matchMedia is only touched when typeof window !== 'undefined'. The
// pack's seed tokens come from the ThemePackRegistry; PACK_TOKEN_OVERLAY merges
// last-wins on top. A pack missing from the registry falls back to the default
// pack tokens (debugLog REGISTRY_INIT silent:true) — never throws (Golden Rule 9).
import { theme, type ConfigProviderProps } from 'antd';
import enUS from 'antd/locale/en_US';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { getThemePackRegistry } from '@/core/registry/ThemePackRegistry';
import { PACK_TOKEN_OVERLAY, THEME_PACKS } from '@/core/theme/themePacks';
import type { ThemeMode, ThemePack } from '@/core/theme/themePacks';

export interface AntdConfigOptions {
  mode: ThemeMode;
  pack: ThemePack;
  /** compact only on the side panel (RUNTIME-04). */
  compact: boolean;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function getAntdConfig(opts: AntdConfigOptions): ConfigProviderProps {
  const isDark =
    opts.mode === 'dark' ||
    (opts.mode === 'auto' &&
      typeof window !== 'undefined' &&
      window.matchMedia(DARK_QUERY).matches);
  const algorithm = [
    isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    ...(opts.compact ? [theme.compactAlgorithm] : []),
  ];

  const registry = getThemePackRegistry();
  const packDef = registry.get(opts.pack);
  if (packDef === undefined) {
    debugLog(
      ERROR_CODES.REGISTRY_INIT,
      `theme pack "${opts.pack}" missing from registry; using default pack`,
      {
        silent: true,
        module: 'antdConfig',
      },
    );
  }
  const tokens = packDef?.tokens ?? THEME_PACKS.default.tokens;
  const packToken = PACK_TOKEN_OVERLAY[opts.pack] ?? {};

  return {
    locale: enUS,
    theme: {
      algorithm,
      token: {
        colorPrimary: tokens.colorPrimary,
        colorInfo: tokens.colorPrimary,
        colorSuccess: '#10B981',
        colorWarning: '#F59E0B',
        colorError: '#EF4444',
        borderRadius: tokens.borderRadius,
        fontFamily: tokens.fontFamily,
        fontSize: opts.compact ? 13 : 14,
        controlHeight: opts.compact ? 30 : 32,
        ...packToken, // §17.1a APPR-06 pack overlay (last-wins)
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
