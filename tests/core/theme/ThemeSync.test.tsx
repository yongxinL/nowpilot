import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { useThemeSync, publishThemeChange } from '../../../src/core/theme/ThemeSync';
import { useThemeStore } from '../../../src/core/theme/ThemeStore';
import * as BroadcastBus from '../../../src/core/runtime/BroadcastBus';

describe('ThemeSync', () => {
  beforeEach(() => {
    useThemeStore.getState().setMode('auto');
    vi.clearAllMocks();
  });

  it('useThemeSync subscribes to np_theme and applies THEME_CHANGED messages', () => {
    // Mount the hook via a wrapper
    function Wrapper() {
      useThemeSync();
      return null;
    }
    render(<Wrapper />);

    // Simulate a THEME_CHANGED broadcast from the other surface
    act(() => {
      (globalThis as any).__broadcast('np_theme', {
        type: 'THEME_CHANGED',
        mode: 'dark',
      });
    });

    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('publishThemeChange broadcasts THEME_CHANGED on np_theme channel', () => {
    const publishSpy = vi.spyOn(BroadcastBus, 'publish');

    publishThemeChange('dark');

    expect(publishSpy).toHaveBeenCalledWith('np_theme', {
      type: 'THEME_CHANGED',
      mode: 'dark',
    });
  });

  it('ignores non-THEME_CHANGED messages on np_theme channel', () => {
    useThemeStore.getState().setMode('light');

    function Wrapper() {
      useThemeSync();
      return null;
    }
    render(<Wrapper />);

    act(() => {
      (globalThis as any).__broadcast('np_theme', {
        type: 'OTHER',
        mode: 'dark',
      });
    });

    // Mode should remain 'light' because the message type didn't match
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('unmount cleanup removes the listener', () => {
    useThemeStore.getState().setMode('light');

    function Wrapper() {
      useThemeSync();
      return null;
    }
    const { unmount } = render(<Wrapper />);

    // Unmount the hook
    unmount();

    act(() => {
      (globalThis as any).__broadcast('np_theme', {
        type: 'THEME_CHANGED',
        mode: 'dark',
      });
    });

    // Mode should remain 'light' because the listener was cleaned up
    expect(useThemeStore.getState().mode).toBe('light');
  });
});
