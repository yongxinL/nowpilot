import React from 'react';
import { Segmented, theme } from 'antd';
import { isThemeMode, type ThemeMode } from '../../core/theme/ThemeConfig';
import { t } from '../../core/i18n/strings';

export interface ThemeToggleProps {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

/** Label → mode, resolved from the canonical string map (no inline copy). */
export const THEME_TOGGLE_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: t('theme.auto'), value: 'auto' },
  { label: t('theme.light'), value: 'light' },
  { label: t('theme.dark'), value: 'dark' },
];

/**
 * The theme-mode control, preserved as an **unmounted, typed presentation
 * component** (D-15 / UI-SPEC § Theme Contract) — the same treatment
 * `MirrorBanner` receives.
 *
 * Phase 1's only theme UI surface is the `Toggle theme` palette command, so
 * this component is deliberately not mounted anywhere. It takes `mode` and
 * `onChange` as props and depends on no Chrome API, no `BroadcastBus`, no
 * store and no `getAntdConfig`, so a later phase (APPR-06 / Phase 15) can mount
 * it unchanged and a test can render it without a provider.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ mode, onChange }) => {
  const { token } = theme.useToken();

  const handleChange = (value: string | number) => {
    // No cast: the Segmented value is narrowed through the canonical guard.
    if (isThemeMode(value)) onChange(value);
  };

  return (
    <div
      data-testid="theme-toggle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: token.paddingXXS,
      }}
    >
      <Segmented
        aria-label={t('a11y.themeMode')}
        value={mode}
        onChange={handleChange}
        options={THEME_TOGGLE_OPTIONS}
        size="small"
        style={{
          background: token.colorFillTertiary,
        }}
      />
    </div>
  );
};
