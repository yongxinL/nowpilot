/**
 * Claude Plus Theme — Semantic Tokens
 *
 * Translated for Ant Design v6 from the Claude + tweakcn visual design system:
 * - Warm neutral surfaces (parchment/warm stone in light, deep charcoal in dark)
 * - Restrained terracotta / warm clay primary accent
 * - Subtle, low-contrast 1px hairline borders
 * - Refined typographic hierarchy and density
 * - Soft warm elevations without glow or aggressive blur
 */

export interface SemanticPalette {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryBg: string;
  primaryBgHover: string;
  primaryBorder: string;
  primaryText: string;

  bgLayout: string;
  bgContainer: string;
  bgElevated: string;
  bgSubtle: string;
  bgMuted: string;

  border: string;
  borderSecondary: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  textQuaternary: string;

  success: string;
  warning: string;
  error: string;
  info: string;

  shadowLow: string;
  shadowMedium: string;
  shadowHigh: string;
}

export const CLAUDE_PLUS_LIGHT: SemanticPalette = {
  // Claude signature terracotta / warm clay accent
  primary: '#cc6b49',
  primaryHover: '#da7756',
  primaryActive: '#b85837',
  primaryBg: '#faf0eb',
  primaryBgHover: '#f5e4dc',
  primaryBorder: '#ecc9bc',
  primaryText: '#7d341b',

  // Warm neutral surfaces (editorial warm off-white / parchment)
  bgLayout: '#fbfaf7',
  bgContainer: '#ffffff',
  bgElevated: '#ffffff',
  bgSubtle: '#f5f3ee',
  bgMuted: '#eeebe3',

  // Subtle warm stone hairline borders
  border: '#e6e2da',
  borderSecondary: '#efece6',

  // Deep warm graphite/ink text (avoiding pure #000)
  text: '#262422',
  textSecondary: '#6e685f',
  textTertiary: '#9a9387',
  textQuaternary: '#bfb9af',

  // Semantic feedback colors with warm grounding
  success: '#2e7d32',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',

  // Warm diffused elevation shadows
  shadowLow: '0 1px 2px rgba(40, 32, 24, 0.05)',
  shadowMedium: '0 4px 12px rgba(40, 32, 24, 0.08), 0 1px 3px rgba(40, 32, 24, 0.04)',
  shadowHigh: '0 12px 28px rgba(40, 32, 24, 0.12), 0 2px 6px rgba(40, 32, 24, 0.04)',
};

export const CLAUDE_PLUS_DARK: SemanticPalette = {
  // Claude warm terracotta accent adjusted for dark contrast
  primary: '#da7756',
  primaryHover: '#e28a6c',
  primaryActive: '#cc6b49',
  primaryBg: '#2d1c15',
  primaryBgHover: '#38221a',
  primaryBorder: '#543124',
  primaryText: '#f5c6b6',

  // Warm obsidian / deep charcoal surfaces
  bgLayout: '#181715',
  bgContainer: '#21201d',
  bgElevated: '#282723',
  bgSubtle: '#1d1c1a',
  bgMuted: '#2a2925',

  // Restrained warm dark borders
  border: '#33312b',
  borderSecondary: '#282622',

  // Warm ivory / pearl text
  text: '#ece8de',
  textSecondary: '#a39d91',
  textTertiary: '#736d62',
  textQuaternary: '#4d483f',

  // Semantic feedback colors in dark context
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',

  // Soft dark elevation shadows
  shadowLow: '0 1px 3px rgba(0, 0, 0, 0.4)',
  shadowMedium: '0 6px 16px rgba(0, 0, 0, 0.5), 0 1px 4px rgba(0, 0, 0, 0.3)',
  shadowHigh: '0 16px 36px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 0, 0, 0.4)',
};
