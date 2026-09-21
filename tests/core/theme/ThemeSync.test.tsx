import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntdApp } from 'antd';
import { ThemeToggle } from '../../../src/components/common/ThemeToggle';
import { useThemeStore } from '../../../src/core/theme/ThemeStore';
import { startThemeOnChangedSync } from '../../../src/core/theme/ThemeSync';
import { flushPendingWrites, __test__ } from '../../../src/core/theme/chromeStorageAdapter';

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

/** Emit one chrome.storage.onChanged event to every registered listener. */
function emitChange(
  changes: Record<string, chrome.storage.StorageChange>,
  area = 'sync',
): void {
  act(() => {
    for (const listener of onChangedListeners) listener(changes, area);
  });
}

beforeEach(() => {
  // Reset store between tests
  useThemeStore.getState().setMode('auto');
  useThemeStore.getState().setPack('default');

  // Reset chrome.storage.onChanged mock
  onChangedListeners = [];

  const map = (globalThis as any).__chromeStorageMap;
  if (map) map.clear();
  __test__.resetPendingState();

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

/**
 * Capture the value the store actually writes to `chrome.storage.sync.np_theme`
 * — the repository's real persisted representation — rather than hand-rolling a
 * fixture blob that could drift from the store's persist config.
 */
async function capturePersistedThemeValue(): Promise<unknown> {
  const setSpy = vi.spyOn(chrome.storage.sync, 'set');
  useThemeStore.getState().setMode(useThemeStore.getState().mode === 'dark' ? 'light' : 'dark');
  await flushPendingWrites();
  const calls = setSpy.mock.calls.filter(([items]) => items && 'np_theme' in items);
  const value = calls.at(-1)?.[0]?.np_theme;
  setSpy.mockRestore();
  return value;
}

describe('startThemeOnChangedSync — shape-detecting propagation (D-15 / APPR-03)', () => {
  it('accepts a legacy bare mode string from an installed prototype', () => {
    useThemeStore.getState().setMode('light');
    const unsubscribe = startThemeOnChangedSync();

    emitChange({ np_theme: { oldValue: 'light', newValue: 'dark' } });

    expect(useThemeStore.getState().mode).toBe('dark');
    unsubscribe();
  });

  it('accepts the real persisted blob (the zustand JSON envelope) and applies its mode', async () => {
    const persisted = await capturePersistedThemeValue();
    // Sanity: the captured value must be the JSON envelope, not a bare string.
    expect(typeof persisted).toBe('string');
    expect(persisted as string).toContain('"state"');

    useThemeStore.getState().setMode('light');
    const unsubscribe = startThemeOnChangedSync();

    emitChange({ np_theme: { oldValue: persisted, newValue: persisted } });

    expect(useThemeStore.getState().mode).toBe('dark');
    unsubscribe();
  });

  it('ignores an unrecognised newValue instead of casting it into the mode', () => {
    const unsubscribe = startThemeOnChangedSync();

    emitChange({ np_theme: { oldValue: 'auto', newValue: 42 } });
    emitChange({ np_theme: { oldValue: 'auto', newValue: null } });
    emitChange({ np_theme: { oldValue: 'auto', newValue: ['light'] } });
    emitChange({ np_theme: { oldValue: 'auto', newValue: { state: { mode: 'nope' } } } });

    expect(useThemeStore.getState().mode).toBe('auto');
    unsubscribe();
  });

  it('offers no second write path in this module: the handler only reads', () => {
    const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set');
    const unsubscribe = startThemeOnChangedSync();

    emitChange({ np_theme: { oldValue: 'auto', newValue: 42 } });

    expect(syncSetSpy).not.toHaveBeenCalled();
    syncSetSpy.mockRestore();
    unsubscribe();
  });

  it('a np_theme_pack onChanged event with a new pack updates the store', () => {
    useThemeStore.getState().setPack('default');
    const unsubscribe = startThemeOnChangedSync();

    emitChange({ np_theme_pack: { oldValue: 'default', newValue: 'liquid-glass' } });

    expect(useThemeStore.getState().pack).toBe('liquid-glass');
    unsubscribe();
  });

  it('a np_theme onChanged event with the SAME mode does NOT re-call setMode (no loop)', () => {
    useThemeStore.getState().setMode('light');
    const setModeSpy = vi.spyOn(useThemeStore.getState(), 'setMode');
    const unsubscribe = startThemeOnChangedSync();

    emitChange({ np_theme: { oldValue: 'light', newValue: 'light' } });

    expect(setModeSpy).not.toHaveBeenCalled();
    setModeSpy.mockRestore();
    unsubscribe();
  });

  it('ignores changes outside the sync area', () => {
    const unsubscribe = startThemeOnChangedSync();

    emitChange({ np_theme: { oldValue: 'auto', newValue: 'dark' } }, 'local');

    expect(useThemeStore.getState().mode).toBe('auto');
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

describe('two-surface round trip through the real persisted representation', () => {
  it('a mode written by surface A reaches surface B with no reload and no per-surface copy', async () => {
    // Surface A: the user toggles to dark; the store persists the canonical blob.
    useThemeStore.getState().setMode('dark');
    await flushPendingWrites();
    const stored = (globalThis as any).__chromeStorageMap?.get('np_theme') as string | undefined;
    expect(stored).toBeDefined();
    expect(stored).toContain('"mode":"dark"');

    // Surface B starts from a different mode and receives the onChanged event.
    useThemeStore.getState().setMode('light');
    const unsubscribe = startThemeOnChangedSync();
    emitChange({ np_theme: { oldValue: 'light', newValue: stored } });

    expect(useThemeStore.getState().mode).toBe('dark');
    unsubscribe();
  });

  it('re-delivering the same stored value converges without a second re-derive', async () => {
    useThemeStore.getState().setMode('dark');
    await flushPendingWrites();
    const stored = (globalThis as any).__chromeStorageMap?.get('np_theme') as string | undefined;

    const unsubscribe = startThemeOnChangedSync();
    emitChange({ np_theme: { oldValue: 'light', newValue: stored } });

    const setModeSpy = vi.spyOn(useThemeStore.getState(), 'setMode');
    const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set');
    emitChange({ np_theme: { oldValue: stored, newValue: stored } });
    await flushPendingWrites();

    expect(setModeSpy).not.toHaveBeenCalled();
    const themeWrites = syncSetSpy.mock.calls.filter(([items]) => items && 'np_theme' in items);
    expect(themeWrites).toHaveLength(0);

    setModeSpy.mockRestore();
    syncSetSpy.mockRestore();
    unsubscribe();
  });
});

describe('ThemeToggle (D-15 — preserved but unmounted in Phase 1)', () => {
  it('renders the AntD Segmented control with 3 options Auto / Light / Dark', () => {
    renderWithAntd(<ThemeToggle />);

    expect(screen.getByText('Auto')).toBeTruthy();
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
  });

  it('selecting "Dark" updates the ThemeStore mode (local-first, no remount)', () => {
    renderWithAntd(<ThemeToggle />);

    fireEvent.click(screen.getByText('Dark'));

    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('surfaces the pinned theme.syncFailed toast with the theme.syncRetry action when the sync write fails', async () => {
    const syncSetSpy = vi
      .spyOn(chrome.storage.sync, 'set')
      .mockRejectedValueOnce(new Error('sync write failed'));

    renderWithAntd(<ThemeToggle />);

    fireEvent.click(screen.getByText('Dark'));

    // Local-first: the visible mode is never rolled back by a failed sync write.
    expect(useThemeStore.getState().mode).toBe('dark');

    await waitFor(() => {
      expect(syncSetSpy).toHaveBeenCalled();
    });

    expect(
      await screen.findByText('Theme sync failed — your display mode is still applied.'),
    ).toBeTruthy();
    expect(await screen.findByText('Retry sync')).toBeTruthy();

    syncSetSpy.mockRestore();
  });
});
