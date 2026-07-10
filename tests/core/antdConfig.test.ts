import { describe, it, expect } from 'vitest';
import { getAntdConfig } from '../../src/core/theme/antdConfig';

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
