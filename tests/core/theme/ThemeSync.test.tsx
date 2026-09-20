import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntdApp } from 'antd';
import { ThemeToggle } from '../../../src/components/common/ThemeToggle';
import { useThemeStore } from '../../../src/core/theme/ThemeStore';
import { startThemeOnChangedSync, applyThemeToSync } from '../../../src/core/theme/ThemeSync';

function renderWithAntd(ui: React.ReactElement) {
  return render(
    <ConfigProvider>
      <AntdApp>{ui}</AntdApp>
    </ConfigProvider>,
  );
}

// --- chrome.storage.onChanged mock -------------------------------------------------
type OnChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;
let onChangedListeners: OnChangedListener[] = [];

beforeEach(() => {
  // Reset store between tests
  useThemeStore.getState().setMode('auto');
  useThemeStore.getState().setPack('default');

  // Reset chrome.storage.onChanged mock
  onChangedListeners = [];

  // Mock chrome.storage.onChanged since the production module guards
  // behind typeof chrome !== 'undefined' && chrome.storage?.onChanged.
  if (!chrome.storage.onChanged) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.storage as any).onChanged = {
      addListener: (cb: OnChangedListener) => {
        onChangedListeners.push(cb);
      },
      removeListener: (cb: OnChangedListener) => {
        onChangedListeners = onChangedListeners.filter((l) => l !== cb);
      },
    };
  }
});

describe('ThemeToggle (Plan 01-07 — D-10 UI half, REQ-F12)', () => {
  it('renders the AntD Segmented control with 3 options Auto / Light / Dark', () => {
    renderWithAntd(<ThemeToggle />);

    expect(screen.getByText('Auto')).toBeTruthy();
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
  });

  it('selecting "Dark" updates the ThemeStore mode to "dark" (local-first, no remount)', () => {
    renderWithAntd(<ThemeToggle />);

    fireEvent.click(screen.getByText('Dark'));

    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('selecting "Light" updates the ThemeStore mode to "light"', () => {
    renderWithAntd(<ThemeToggle />);

    fireEvent.click(screen.getByText('Light'));

    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('selecting "Auto" updates the ThemeStore mode to "auto"', () => {
    useThemeStore.getState().setMode('dark');
    renderWithAntd(<ThemeToggle />);

    fireEvent.click(screen.getByText('Auto'));

    expect(useThemeStore.getState().mode).toBe('auto');
  });

  it('the local surface mode is updated even when the cross-surface sync write fails', async () => {
    // Force chrome.storage.sync.set to reject
    const syncSetSpy = vi
      .spyOn(chrome.storage.sync, 'set')
      .mockRejectedValueOnce(new Error('sync write failed'));

    renderWithAntd(<ThemeToggle />);

    fireEvent.click(screen.getByText('Dark'));

    // Local state updated immediately (local-first, propagation-retry-is-separate)
    expect(useThemeStore.getState().mode).toBe('dark');

    // Wait for the async sync write to fail
    await waitFor(() => {
      expect(syncSetSpy).toHaveBeenCalled();
    });

    syncSetSpy.mockRestore();
  });
});

describe('startThemeOnChangedSync (Plan 01-07 — chrome.storage.onChanged propagation)', () => {
  it('a np_theme chrome.storage.onChanged event with a new mode updates the store', () => {
    useThemeStore.getState().setMode('light');
    const unsubscribe = startThemeOnChangedSync();

    // Simulate another surface changing np_theme to 'dark'
    act(() => {
      for (const listener of onChangedListeners) {
        listener(
          {
            np_theme: { oldValue: 'light', newValue: 'dark' },
          },
          'sync',
        );
      }
    });

    expect(useThemeStore.getState().mode).toBe('dark');
    unsubscribe();
  });

  it('a np_theme_pack chrome.storage.onChanged event with a new pack updates the store', () => {
    useThemeStore.getState().setPack('default');
    const unsubscribe = startThemeOnChangedSync();

    act(() => {
      for (const listener of onChangedListeners) {
        listener(
          {
            np_theme_pack: { oldValue: 'default', newValue: 'midnight' },
          },
          'sync',
        );
      }
    });

    expect(useThemeStore.getState().pack).toBe('midnight');
    unsubscribe();
  });

  it('a np_theme onChanged event with the SAME mode does NOT re-call setMode (no loop)', () => {
    useThemeStore.getState().setMode('light');
    const setModeSpy = vi.spyOn(useThemeStore.getState(), 'setMode');
    const unsubscribe = startThemeOnChangedSync();

    act(() => {
      for (const listener of onChangedListeners) {
        listener(
          {
            np_theme: { oldValue: 'light', newValue: 'light' },
          },
          'sync',
        );
      }
    });

    expect(setModeSpy).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('unmount removes the chrome.storage.onChanged listener (no leaked listeners)', () => {
    const unsubscribe = startThemeOnChangedSync();

    const beforeUnmount = onChangedListeners.length;
    expect(beforeUnmount).toBeGreaterThan(0);

    unsubscribe();

    expect(onChangedListeners.length).toBe(beforeUnmount - 1);
  });
});

describe('applyThemeToSync (Plan 01-07 — explicit cross-surface sync write)', () => {
  it('writes BOTH np_theme and np_theme_pack to chrome.storage.sync on success', async () => {
    const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set').mockResolvedValueOnce(undefined);

    const closeable = applyThemeToSync('dark', 'midnight');

    await closeable;
    expect(syncSetSpy).toHaveBeenCalledWith({
      np_theme: 'dark', // zustand JSON-serializes the value
      np_theme_pack: 'midnight',
    });
    syncSetSpy.mockRestore();
  });

  it('returns { ok: false } when chrome.storage.sync.set rejects — caller can show toast', async () => {
    const syncSetSpy = vi
      .spyOn(chrome.storage.sync, 'set')
      .mockRejectedValueOnce(new Error('quota exceeded'));

    const closeable = applyThemeToSync('light', 'default');
    const result = await closeable;

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toContain('quota exceeded');
    }
    syncSetSpy.mockRestore();
  });
});
