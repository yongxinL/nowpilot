import { OverrideToken } from 'antd/es/theme/interface';
import { SemanticPalette } from './semanticTokens';

/**
 * Builds Ant Design v6 component-level tokens for Claude Plus theme.
 * Enforces:
 * - Minimum control hit targets of 32px (Button, Select, Input)
 * - Restrained 1px warm borders without harsh contrast
 * - Seamless selection states with warm terracotta tint
 * - Soft elevated surfaces for cards and modals
 */
export function buildComponentTokens(p: SemanticPalette, isDark: boolean): OverrideToken {
  return {
    Button: {
      colorPrimary: p.primary,
      colorPrimaryHover: p.primaryHover,
      colorPrimaryActive: p.primaryActive,
      primaryColor: isDark ? '#141311' : '#ffffff',

      defaultBg: p.bgContainer,
      defaultColor: p.text,
      defaultBorderColor: p.border,
      defaultHoverBg: p.bgSubtle,
      defaultHoverColor: p.text,
      defaultHoverBorderColor: p.primary,

      textHoverBg: p.bgSubtle,
      textTextColor: p.textSecondary,

      controlHeight: 34,
      controlHeightSM: 32, // Minimum 32px touch/click target
      controlHeightLG: 40,

      borderRadius: 8,
      borderRadiusSM: 6,
      borderRadiusLG: 10,
      paddingInline: 14,
      paddingInlineSM: 12,
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: p.textSecondary,
      itemHoverColor: p.text,
      itemHoverBg: p.bgSubtle,
      itemSelectedColor: p.primaryText,
      itemSelectedBg: p.primaryBg,
      itemBorderRadius: 8,
      itemMarginInline: 4,
      itemHeight: 36,
      iconSize: 16,
    },
    Segmented: {
      trackBg: p.bgSubtle,
      trackPadding: 3,
      itemSelectedBg: p.bgContainer,
      itemSelectedColor: p.text,
      itemHoverBg: 'rgba(0, 0, 0, 0.04)',
      itemHoverColor: p.text,
      itemColor: p.textSecondary,
      borderRadius: 8,
      borderRadiusSM: 6,
      controlHeight: 32,
      controlHeightSM: 28,
    },
    Select: {
      selectorBg: p.bgContainer,
      colorBorder: p.border,
      colorPrimaryHover: p.primary,
      colorPrimary: p.primary,
      optionSelectedBg: p.primaryBg,
      optionSelectedColor: p.primaryText,
      optionActiveBg: p.bgSubtle,
      controlHeight: 34,
      controlHeightSM: 32,
      borderRadius: 8,
    },
    Input: {
      colorBgContainer: p.bgContainer,
      colorBorder: p.border,
      colorPrimaryHover: p.primary,
      colorPrimary: p.primary,
      colorText: p.text,
      colorTextPlaceholder: p.textTertiary,
      controlHeight: 34,
      controlHeightSM: 32,
      borderRadius: 8,
      paddingInline: 12,
    },
    Card: {
      colorBgContainer: p.bgContainer,
      colorBorderSecondary: p.border,
      borderRadiusLG: 12,
      boxShadowTertiary: p.shadowLow,
      paddingLG: 20,
    },
    Modal: {
      contentBg: p.bgElevated,
      headerBg: p.bgElevated,
      titleColor: p.text,
      borderRadiusLG: 16,
      boxShadow: p.shadowHigh,
    },
    Dropdown: {
      colorBgElevated: p.bgElevated,
      borderRadiusLG: 10,
      boxShadowSecondary: p.shadowMedium,
      controlItemBgHover: p.bgSubtle,
      controlItemBgActive: p.primaryBg,
      paddingXXS: 4,
    },
    Tooltip: {
      colorBgSpotlight: isDark ? '#33312b' : '#262422',
      colorTextLightSolid: isDark ? '#ece8de' : '#ffffff',
      borderRadius: 6,
    },
    Popover: {
      colorBgElevated: p.bgElevated,
      borderRadiusLG: 10,
      boxShadowSecondary: p.shadowMedium,
    },
    Tag: {
      borderRadiusSM: 6,
      defaultBg: p.bgSubtle,
      defaultColor: p.textSecondary,
    },
    Alert: {
      borderRadiusLG: 10,
    },
    Divider: {
      colorSplit: p.borderSecondary,
    },
  };
}
