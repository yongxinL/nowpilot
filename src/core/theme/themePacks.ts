// src/core/theme/themePacks.ts — Canonical theme-pack + display-mode homes
// (W1: ONE canonical ThemeMode name from Appendix F.1; W-9: the theme-pack id
// must NOT be 'light'|'dark'|'system'; D-11: display mode is a SEPARATE axis
// from theme pack — 'auto' has no pack entry, it resolves via matchMedia at the
// ThemeStore level). Packs carry a `ready` flag per D-12: the default pack is
// ready; liquid-glass/claude-warm are registered but NOT implemented. This file
// is antd-import-free by design — `algorithm` uses string literals that
// antdConfig maps to antd theme algorithms, keeping the pack definitions
// testable without pulling antd into the module graph.

/** Theme pack id — Appendix F.1 / §17.1a APPR-06 (W-9: never a display-mode id). */
export type ThemePack = 'default' | 'liquid-glass' | 'claude-warm';

/** Display mode — the ONE canonical name from Appendix F.1 (W1, no alias). */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** Seed + identifier fields for one theme pack. */
export interface ThemePackDef {
  id: ThemePack;
  label: string;
  /** D-12: true only for fully implemented packs (default); others register not-ready. */
  ready: boolean;
  /** antd algorithm name as a string literal — antdConfig owns the antd import. */
  algorithm: 'default' | 'darkAlgorithm';
  /** UI-SPEC seed tokens per pack (colorPrimary #3B82F6, borderRadius 8, system font stack). */
  tokens: {
    colorPrimary: string;
    borderRadius: number;
    fontFamily: string;
  };
}

/**
 * PACK_TOKEN_OVERLAY — PATTERNS lines 5164-5168. Per-pack token overrides merged
 * last-wins on top of the pack seed tokens by antdConfig. Non-default packs
 * register their overlay even though the packs themselves are not-ready (D-12).
 */
export const PACK_TOKEN_OVERLAY: Record<ThemePack, Record<string, string>> = {
  default: {},
  'liquid-glass': { colorBgContainer: 'rgba(255,255,255,0.68)' },
  'claude-warm': { colorBgBase: '#FAF7F2' },
};

/** THEME_PACKS — the canonical pack set. default is ready; the other two are D-12 not-ready. */
export const THEME_PACKS: Record<ThemePack, ThemePackDef> = {
  default: {
    id: 'default',
    label: 'Default',
    ready: true,
    algorithm: 'default',
    tokens: {
      colorPrimary: '#3B82F6',
      borderRadius: 8,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
  },
  'liquid-glass': {
    id: 'liquid-glass',
    label: 'Liquid Glass',
    ready: false,
    algorithm: 'default',
    tokens: {
      colorPrimary: '#3B82F6',
      borderRadius: 8,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
  },
  'claude-warm': {
    id: 'claude-warm',
    label: 'Claude Warm',
    ready: false,
    algorithm: 'default',
    tokens: {
      colorPrimary: '#3B82F6',
      borderRadius: 8,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
  },
};

export const THEME_PACK_IDS = Object.keys(THEME_PACKS) as ThemePack[];

/** Runtime guard for the ThemePack id shape (registry rejects unknown ids). */
export function isThemePackId(value: unknown): value is ThemePack {
  return typeof value === 'string' && (THEME_PACK_IDS as string[]).includes(value);
}
