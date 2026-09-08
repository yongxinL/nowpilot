import { beforeEach, describe, expect, it } from 'vitest';
import { useThemeStore } from '@/core/theme/ThemeStore';

describe('ThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'auto', pack: 'default', effectiveDark: false });
  });

  it('switches to dark mode', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().effectiveDark).toBe(true);
  });

  it('switches to light mode', () => {
    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().mode).toBe('light');
    expect(useThemeStore.getState().effectiveDark).toBe(false);
  });

  it('sets a theme pack', () => {
    useThemeStore.getState().setPack('liquid-glass');
    expect(useThemeStore.getState().pack).toBe('liquid-glass');
  });

  it('propagates a theme change from chrome.storage.onChanged', () => {
    const onChanged = chrome.storage.onChanged as unknown as {
      callListeners: (changes: unknown, area: string) => void;
    };
    const changes = { np_theme: { newValue: { state: { mode: 'dark', pack: 'default' } } } };
    onChanged.callListeners(changes, 'sync');
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().effectiveDark).toBe(true);
  });
});
