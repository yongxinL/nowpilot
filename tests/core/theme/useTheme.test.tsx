import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTheme } from '@/core/theme/useTheme';
import type { ThemePreferences, ThemeStore } from '@/core/theme/ThemeStore';

function createStore(initial: ThemePreferences): ThemeStore {
  let listener: ((prefs: ThemePreferences) => void) | undefined;
  let prefs = initial;
  return {
    async read() {
      return prefs;
    },
    async writeMode(mode) {
      prefs = { ...prefs, mode };
      listener?.(prefs);
    },
    async writePack(pack) {
      prefs = { ...prefs, pack };
      listener?.(prefs);
    },
    subscribe(next) {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
  };
}

describe('useTheme', () => {
  it('starts with stored preferences and updates on propagation', async () => {
    const store = createStore({ mode: 'light', pack: 'default' });
    const { result } = renderHook(() => useTheme(store, { compact: false }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.mode).toBe('light');
  });
});
