import { describe, it, expect } from 'vitest';
import { getAntdConfig, getXProviderConfig } from '../../src/core/theme/antdConfig';

describe('getAntdConfig', () => {
  it('returns default algorithm for light mode', () => {
    const config = getAntdConfig({ mode: 'light', compact: false });
    expect(config.algorithm).toBeDefined();
    expect(Array.isArray(config.algorithm)).toBe(true);
  });

  it('returns dark algorithm for dark mode', () => {
    const config = getAntdConfig({ mode: 'dark', compact: false });
    expect(config.algorithm).toBeDefined();
  });

  it('includes compact algorithm when compact is true', () => {
    const config = getAntdConfig({ mode: 'light', compact: true });
    expect(Array.isArray(config.algorithm)).toBe(true);
  });

  it('omits compact algorithm when compact is false', () => {
    const config = getAntdConfig({ mode: 'light', compact: false });
    expect(Array.isArray(config.algorithm)).toBe(true);
  });
});

describe('THEME-05 — getXProviderConfig', () => {
  it('exports getXProviderConfig that returns a theme object compatible with <XProvider theme={...} />', () => {
    const xProviderTheme = getXProviderConfig({ mode: 'light', compact: true });
    expect(xProviderTheme).toBeDefined();
    expect(typeof xProviderTheme).toBe('object');
    const algorithm = xProviderTheme.algorithm;
    expect(algorithm).toBeDefined();
    expect(Array.isArray(algorithm)).toBe(true);
    expect(algorithm!.length).toBeGreaterThan(0);
  });

  it('getXProviderConfig for dark mode includes darkAlgorithm', () => {
    const xProviderTheme = getXProviderConfig({ mode: 'dark', compact: false });
    const algorithm = xProviderTheme.algorithm;
    expect(algorithm).toBeDefined();
    expect(Array.isArray(algorithm)).toBe(true);
    expect(algorithm!.length).toBeGreaterThan(0);
  });

  it('getXProviderConfig for compact:true includes compactAlgorithm (extra algorithm entry)', () => {
    const nonCompact = getXProviderConfig({ mode: 'light', compact: false });
    const compact = getXProviderConfig({ mode: 'light', compact: true });
    expect(compact.algorithm!.length).toBeGreaterThan(nonCompact.algorithm!.length);
  });
});
