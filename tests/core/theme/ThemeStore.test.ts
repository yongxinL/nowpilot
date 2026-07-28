import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../../../src/core/theme/ThemeStore';

describe('ThemeStore', () => {
  beforeEach(() => {
    useThemeStore.getState().setMode('auto');
  });

  it('initializes with auto mode', () => {
    expect(useThemeStore.getState().mode).toBe('auto');
  });

  it('sets mode to light', () => {
    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('sets mode to dark', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('sets mode to auto', () => {
    useThemeStore.getState().setMode('dark');
    useThemeStore.getState().setMode('auto');
    expect(useThemeStore.getState().mode).toBe('auto');
  });

  it('resolvedMode returns light by default in test env', () => {
    useThemeStore.getState().setMode('auto');
    expect(useThemeStore.getState().resolvedMode()).toBe('light');
  });

  it('resolvedMode returns explicit mode when not auto', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().resolvedMode()).toBe('dark');

    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().resolvedMode()).toBe('light');
  });
});
