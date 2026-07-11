import { describe, it, expect } from 'vitest';
import { formatTokenCount } from '../../src/components/common/WorkspaceStatusBarLeft';
import { workspaceStoreSidepanelSurface } from '../../src/core/navigation/navigationTypes';

describe('WorkspaceStatusBar formatting', () => {
  it('formats sub-1000 numbers as plain digits', () => {
    expect(formatTokenCount(0)).toBe('0');
    expect(formatTokenCount(128)).toBe('128');
    expect(formatTokenCount(999)).toBe('999');
  });

  it('formats thousands with one decimal', () => {
    expect(formatTokenCount(1000)).toBe('1.0k');
    expect(formatTokenCount(1234)).toBe('1.2k');
    expect(formatTokenCount(2400)).toBe('2.4k');
  });

  it('formats 10k+ rounded to integer k', () => {
    expect(formatTokenCount(9999)).toBe('10.0k');
    expect(formatTokenCount(15000)).toBe('15k');
    expect(formatTokenCount(23456)).toBe('23k');
  });

  it('formats millions with one decimal', () => {
    expect(formatTokenCount(1_000_000)).toBe('1.0M');
    expect(formatTokenCount(2_500_000)).toBe('2.5M');
  });
});

describe('WorkspaceStatusBar surface typing', () => {
  it('sidepanel surface is a known valid surface', () => {
    expect(workspaceStoreSidepanelSurface).toBe('sidepanel');
  });
});
