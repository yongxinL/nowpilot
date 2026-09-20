import { theme, MappingAlgorithm } from 'antd';
import { CLAUDE_PLUS_LIGHT, CLAUDE_PLUS_DARK } from './semanticTokens';

/**
 * Custom algorithm extensions for Claude Plus theme in Ant Design v6.
 * Blends base Ant Design algorithms with warm neutral tones.
 */
export const claudePlusLightAlgorithm: MappingAlgorithm = (seedToken, mapToken) => {
  const baseTokens = theme.defaultAlgorithm(seedToken);
  const p = CLAUDE_PLUS_LIGHT;

  return {
    ...baseTokens,
    ...mapToken,
    colorPrimary: p.primary,
    colorPrimaryHover: p.primaryHover,
    colorPrimaryActive: p.primaryActive,
    colorPrimaryBg: p.primaryBg,
    colorPrimaryBgHover: p.primaryBgHover,
    colorPrimaryBorder: p.primaryBorder,
    colorPrimaryText: p.primaryText,

    colorBgLayout: p.bgLayout,
    colorBgContainer: p.bgContainer,
    colorBgElevated: p.bgElevated,

    colorBorder: p.border,
    colorBorderSecondary: p.borderSecondary,

    colorText: p.text,
    colorTextSecondary: p.textSecondary,
    colorTextTertiary: p.textTertiary,
    colorTextQuaternary: p.textQuaternary,

    colorFillSecondary: p.bgSubtle,
    colorFillTertiary: p.bgMuted,

    boxShadow: p.shadowLow,
    boxShadowSecondary: p.shadowMedium,
  };
};

export const claudePlusDarkAlgorithm: MappingAlgorithm = (seedToken, mapToken) => {
  const baseTokens = theme.darkAlgorithm(seedToken);
  const p = CLAUDE_PLUS_DARK;

  return {
    ...baseTokens,
    ...mapToken,
    colorPrimary: p.primary,
    colorPrimaryHover: p.primaryHover,
    colorPrimaryActive: p.primaryActive,
    colorPrimaryBg: p.primaryBg,
    colorPrimaryBgHover: p.primaryBgHover,
    colorPrimaryBorder: p.primaryBorder,
    colorPrimaryText: p.primaryText,

    colorBgLayout: p.bgLayout,
    colorBgContainer: p.bgContainer,
    colorBgElevated: p.bgElevated,

    colorBorder: p.border,
    colorBorderSecondary: p.borderSecondary,

    colorText: p.text,
    colorTextSecondary: p.textSecondary,
    colorTextTertiary: p.textTertiary,
    colorTextQuaternary: p.textQuaternary,

    colorFillSecondary: p.bgSubtle,
    colorFillTertiary: p.bgMuted,

    boxShadow: p.shadowLow,
    boxShadowSecondary: p.shadowMedium,
  };
};
