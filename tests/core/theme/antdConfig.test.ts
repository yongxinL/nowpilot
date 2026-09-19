import { theme } from 'antd';
import { describe, expect, it } from 'vitest';
import { NOWPILOT_SEED, getAntdConfig } from '@/core/theme/antdConfig';

describe('getAntdConfig', () => {
  it('uses the default algorithm for light and dark algorithm for dark', () => {
    expect(getAntdConfig({ mode: 'light', pack: 'default', compact: false }).algorithm).toBe(
      theme.defaultAlgorithm,
    );
    expect(getAntdConfig({ mode: 'dark', pack: 'default', compact: false }).algorithm).toBe(
      theme.darkAlgorithm,
    );
  });

  it('appends the compact algorithm when compact is true', () => {
    const config = getAntdConfig({ mode: 'light', pack: 'default', compact: true });
    expect(Array.isArray(config.algorithm)).toBe(true);
    expect(config.algorithm).toEqual([theme.defaultAlgorithm, theme.compactAlgorithm]);
  });

  it('resolves auto mode from prefersDark', () => {
    expect(
      getAntdConfig({ mode: 'auto', pack: 'default', compact: false, prefersDark: true }).algorithm,
    ).toBe(theme.darkAlgorithm);
  });

  it('applies the seed and pack overlays in order', () => {
    const base = getAntdConfig({ mode: 'light', pack: 'default', compact: false });
    expect(base.token?.colorPrimary).toBe(NOWPILOT_SEED.colorPrimary);
    const warm = getAntdConfig({ mode: 'light', pack: 'claude-warm', compact: false });
    expect(warm.token?.colorBgBase).toBe('#FAF7F2');
    const glass = getAntdConfig({ mode: 'light', pack: 'liquid-glass', compact: false });
    expect(glass.token?.colorBgContainer).toBe('rgba(255,255,255,0.68)');
  });

  it('enables stable CSS variables for live theme switching', () => {
    expect(getAntdConfig({ mode: 'light', pack: 'default', compact: false }).cssVar).toEqual({
      key: 'nowpilot',
    });
  });
});
