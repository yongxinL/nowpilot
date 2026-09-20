import { ThemeConfig } from 'antd';
import { CLAUDE_PLUS_LIGHT, CLAUDE_PLUS_DARK } from '../semanticTokens';
import { buildComponentTokens } from '../componentTokens';
import { claudePlusLightAlgorithm, claudePlusDarkAlgorithm } from '../algorithms';

/**
 * Claude Plus Light Theme for Ant Design v6
 */
export const claudePlusLight: ThemeConfig = {
  algorithm: claudePlusLightAlgorithm,
  cssVar: { key: 'antd' },
  token: {
    colorPrimary: CLAUDE_PLUS_LIGHT.primary,
    colorPrimaryHover: CLAUDE_PLUS_LIGHT.primaryHover,
    colorPrimaryActive: CLAUDE_PLUS_LIGHT.primaryActive,
    colorPrimaryBg: CLAUDE_PLUS_LIGHT.primaryBg,
    colorPrimaryBgHover: CLAUDE_PLUS_LIGHT.primaryBgHover,
    colorPrimaryBorder: CLAUDE_PLUS_LIGHT.primaryBorder,
    colorPrimaryText: CLAUDE_PLUS_LIGHT.primaryText,

    colorBgLayout: CLAUDE_PLUS_LIGHT.bgLayout,
    colorBgContainer: CLAUDE_PLUS_LIGHT.bgContainer,
    colorBgElevated: CLAUDE_PLUS_LIGHT.bgElevated,

    colorBorder: CLAUDE_PLUS_LIGHT.border,
    colorBorderSecondary: CLAUDE_PLUS_LIGHT.borderSecondary,

    colorText: CLAUDE_PLUS_LIGHT.text,
    colorTextSecondary: CLAUDE_PLUS_LIGHT.textSecondary,
    colorTextTertiary: CLAUDE_PLUS_LIGHT.textTertiary,
    colorTextQuaternary: CLAUDE_PLUS_LIGHT.textQuaternary,

    borderRadius: 8,
    borderRadiusSM: 6,
    borderRadiusLG: 12,
    borderRadiusXS: 4,

    controlHeight: 34,
    controlHeightSM: 32,
    controlHeightLG: 40,

    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 13,
  },
  components: buildComponentTokens(CLAUDE_PLUS_LIGHT, false),
};

/**
 * Claude Plus Dark Theme for Ant Design v6
 */
export const claudePlusDark: ThemeConfig = {
  algorithm: claudePlusDarkAlgorithm,
  cssVar: { key: 'antd' },
  token: {
    colorPrimary: CLAUDE_PLUS_DARK.primary,
    colorPrimaryHover: CLAUDE_PLUS_DARK.primaryHover,
    colorPrimaryActive: CLAUDE_PLUS_DARK.primaryActive,
    colorPrimaryBg: CLAUDE_PLUS_DARK.primaryBg,
    colorPrimaryBgHover: CLAUDE_PLUS_DARK.primaryBgHover,
    colorPrimaryBorder: CLAUDE_PLUS_DARK.primaryBorder,
    colorPrimaryText: CLAUDE_PLUS_DARK.primaryText,

    colorBgLayout: CLAUDE_PLUS_DARK.bgLayout,
    colorBgContainer: CLAUDE_PLUS_DARK.bgContainer,
    colorBgElevated: CLAUDE_PLUS_DARK.bgElevated,

    colorBorder: CLAUDE_PLUS_DARK.border,
    colorBorderSecondary: CLAUDE_PLUS_DARK.borderSecondary,

    colorText: CLAUDE_PLUS_DARK.text,
    colorTextSecondary: CLAUDE_PLUS_DARK.textSecondary,
    colorTextTertiary: CLAUDE_PLUS_DARK.textTertiary,
    colorTextQuaternary: CLAUDE_PLUS_DARK.textQuaternary,

    borderRadius: 8,
    borderRadiusSM: 6,
    borderRadiusLG: 12,
    borderRadiusXS: 4,

    controlHeight: 34,
    controlHeightSM: 32,
    controlHeightLG: 40,

    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 13,
  },
  components: buildComponentTokens(CLAUDE_PLUS_DARK, true),
};

/**
 * Applies scoped CSS variables matching Claude Plus tokens to the document root,
 * ensuring backwards compatibility with any remaining CSS variable references.
 */
export function applyClaudePlusCssVars(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  const p = isDark ? CLAUDE_PLUS_DARK : CLAUDE_PLUS_LIGHT;
  const root = document.documentElement;

  root.style.setProperty('--background', p.bgLayout);
  root.style.setProperty('--foreground', p.text);
  root.style.setProperty('--card', p.bgContainer);
  root.style.setProperty('--card-foreground', p.text);
  root.style.setProperty('--popover', p.bgElevated);
  root.style.setProperty('--popover-foreground', p.text);
  root.style.setProperty('--primary', p.primary);
  root.style.setProperty('--primary-foreground', isDark ? '#141311' : '#ffffff');
  root.style.setProperty('--secondary', p.bgSubtle);
  root.style.setProperty('--secondary-foreground', p.text);
  root.style.setProperty('--muted', p.bgSubtle);
  root.style.setProperty('--muted-foreground', p.textSecondary);
  root.style.setProperty('--accent', p.primaryBg);
  root.style.setProperty('--accent-foreground', p.primaryText);
  root.style.setProperty('--border', p.border);
  root.style.setProperty('--input', p.border);
  root.style.setProperty('--np-primary', p.primary);
  root.style.setProperty('--np-primary-light', `${p.primary}20`);
}
