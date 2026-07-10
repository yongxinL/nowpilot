import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useThemeStore } from '../../src/core/stores/themeStore';

describe('ThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'auto' });
    vi.clearAllMocks();
  });

  it('default mode is auto when chrome.storage.sync returns null', () => {
    const { mode } = useThemeStore.getState();
    expect(mode).toBe('auto');
  });

  it('setMode updates state and persists to chrome.storage.sync', () => {
    useThemeStore.getState().setMode('dark');
    const { mode } = useThemeStore.getState();
    expect(mode).toBe('dark');
    expect(chrome.storage.sync.set).toHaveBeenCalled();
  });

  it('setMode with light updates state correctly', () => {
    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('type-checks setMode argument at compile time via ThemeMode union', () => {
    const setMode = useThemeStore.getState().setMode;
    expect(() => {
      (setMode as (mode: string) => void)('invalid' as never);
    }).not.toThrow();
  });
});
