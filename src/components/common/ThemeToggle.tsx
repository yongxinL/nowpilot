import React from 'react';
import { Segmented, theme } from 'antd';
import type { ThemeMode } from '../../core/theme/ThemeStore';
import { isThemeMode } from '../../core/theme/ThemeConfig';

export interface ThemeToggleProps {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
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
        aria-label="Theme mode"
        value={mode}
        onChange={handleChange}
        options={THEME_OPTIONS}
        size="small"
        style={{
          background: token.colorFillTertiary,
        }}
      />
    </div>
  );
};
