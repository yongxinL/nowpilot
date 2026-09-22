import { describe, it, expect, beforeEach, vi } from 'vitest';
import { theme } from 'antd';
import { useThemeStore, themeMigrate } from '../../../src/core/theme/ThemeStore';
import { DEFAULT_COLOR_THEME_ID } from '../../../src/core/theme/ThemeConfig';
import { chromeStorageAdapter, syncStorageAdapter, flushPendingWrites, __test__ } from '../../../src/core/theme/chromeStorageAdapter';
import { getAntdConfig } from '../../../src/core/theme/antdConfig';
import { useExtensionStore } from '../../../src/store/useExtensionStore';

function themeWritesOf(
  spy: { mock: { calls: unknown[][] } },
): Record<string, unknown>[] {
  return spy.mock.calls
    .map((call) => call[0] as Record<string, unknown> | undefined)
    .filter((items): items is Record<string, unknown> => Boolean(items && 'np_theme' in items));
}

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

  // D-10 — pack field is required by Appendix F; defaults to 'default' on first hydration.
  it('initializes with pack="default"', () => {
    expect(useThemeStore.getState().pack).toBe('default');
  });

  // D-10 — setPack action writes pack and survives a re-hydrate.
  it('setPack updates pack', () => {
    useThemeStore.getState().setPack('midnight');
    expect(useThemeStore.getState().pack).toBe('midnight');
  });
});

describe('chromeStorageAdapter', () => {
  beforeEach(() => {
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
    // D-22: clear any pending debounced writes from prior tests so
    // each test asserts on an empty starting state.
    __test__.resetPendingState();
  });

  it('getItem returns null for missing key', async () => {
    const result = await chromeStorageAdapter.getItem('missing_key');
    expect(result).toBeNull();
  });

  it('setItem stores JSON-stringified value', async () => {
    await chromeStorageAdapter.setItem('test_key', '{"mode":"dark"}');
    const result = await chromeStorageAdapter.getItem('test_key');
    expect(result).toBe('{"mode":"dark"}');
  });

  it('getItem returns stored value', async () => {
    await chromeStorageAdapter.setItem('theme_pref', '"light"');
    const result = await chromeStorageAdapter.getItem('theme_pref');
    expect(result).toBe('"light"');
  });

  it('removeItem deletes key', async () => {
    await chromeStorageAdapter.setItem('temp_key', '"value"');
    await chromeStorageAdapter.removeItem('temp_key');
    const result = await chromeStorageAdapter.getItem('temp_key');
    expect(result).toBeNull();
  });

  it('round-trips complex data', async () => {
    const data = { mode: 'auto', version: 2, nested: { a: 1 } };
    await chromeStorageAdapter.setItem('complex', JSON.stringify(data));
    const raw = await chromeStorageAdapter.getItem('complex');
    expect(raw).toBe(JSON.stringify(data));
    expect(JSON.parse(raw!)).toEqual(data);
  });

  it('delegates to chrome.storage.local.set', async () => {
    const setSpy = vi.spyOn(chrome.storage.local, 'set');
    await chromeStorageAdapter.setItem('spy_key', '"value"');
    // D-22: setItem is trailing-debounced; force the flush so the spy
    // assertion sees the call without waiting on real wall-clock time.
    await flushPendingWrites();
    expect(setSpy).toHaveBeenCalledWith({ spy_key: '"value"' });
  });

  it('delegates to chrome.storage.local.get', async () => {
    const getSpy = vi.spyOn(chrome.storage.local, 'get');
    await chromeStorageAdapter.getItem('some_key');
    expect(getSpy).toHaveBeenCalledWith('some_key');
  });

  it('delegates to chrome.storage.local.remove', async () => {
    const removeSpy = vi.spyOn(chrome.storage.local, 'remove');
    await chromeStorageAdapter.removeItem('delete_me');
    expect(removeSpy).toHaveBeenCalledWith('delete_me');
  });
});

describe('syncStorageAdapter (D-10 — chrome.storage.sync target for ThemeStore)', () => {
  beforeEach(() => {
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
    __test__.resetPendingState();
  });

  it('delegates to chrome.storage.sync.set', async () => {
    const setSpy = vi.spyOn(chrome.storage.sync, 'set');
    await syncStorageAdapter.setItem('np_theme', '"value"');
    // D-22: setItem is trailing-debounced — force flush for the spy
    // assertion (otherwise spy.toHaveBeenCalledWith runs against an
    // empty mock).
    await flushPendingWrites();
    expect(setSpy).toHaveBeenCalledWith({ np_theme: '"value"' });
  });

  it('delegates to chrome.storage.sync.get', async () => {
    const getSpy = vi.spyOn(chrome.storage.sync, 'get');
    await syncStorageAdapter.getItem('np_theme');
    expect(getSpy).toHaveBeenCalledWith('np_theme');
  });

  it('delegates to chrome.storage.sync.remove', async () => {
    const removeSpy = vi.spyOn(chrome.storage.sync, 'remove');
    await syncStorageAdapter.removeItem('np_theme');
    expect(removeSpy).toHaveBeenCalledWith('np_theme');
  });

  it('round-trips through sync store', async () => {
    await syncStorageAdapter.setItem('np_theme', '"light"');
    // getItem short-circuits to the pending map before the debounce fires,
    // so this assertion holds without an explicit flush.
    const raw = await syncStorageAdapter.getItem('np_theme');
    expect(raw).toBe('"light"');
  });
});

describe('ThemeStore persist — D-10 storage key + version/migrate', () => {
  beforeEach(() => {
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
    __test__.resetPendingState();
  });

  // D-10 — setMode must persist via the sync adapter under key 'np_theme',
  // not via chrome.storage.local under the old key 'np_theme_store'.
  it('setMode persists via chrome.storage.sync under key "np_theme"', async () => {
    const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set');
    const localSetSpy = vi.spyOn(chrome.storage.local, 'set');

    useThemeStore.getState().setMode('dark');
    // Zustand's persist middleware schedules the chrome.storage write
    // asynchronously (one microtask + the adapter's 300ms debounce). Let
    // the microtask reach `syncStorageAdapter.setItem` first, THEN flush.
    await new Promise((r) => setTimeout(r, 0));
    await flushPendingWrites();

    const syncCalls = syncSetSpy.mock.calls.flatMap(([items]) => Object.keys(items ?? {}));
    expect(syncCalls).toContain('np_theme');

    const localCalls = localSetSpy.mock.calls.flatMap(([items]) => Object.keys(items ?? {}));
    expect(localCalls).not.toContain('np_theme');
    expect(localCalls).not.toContain('np_theme_store');
  });

  // D-10 — ThemeStore persist config is version:1 and migrate is throw-free on
  // pre-Phase-1 unversioned legacy payload (T-01-01 backstop).
  it('migrate(persistedWithoutVersion, 0) returns shape with pack="default" and no throw', () => {
    const legacy = { mode: 'dark', colorTheme: 'system' };
    let result: ReturnType<typeof themeMigrate> | undefined;
    expect(() => {
      result = themeMigrate(legacy, 0);
    }).not.toThrow();
    expect(result).toMatchObject({
      mode: 'dark',
      colorTheme: 'system',
      pack: 'default',
    });
  });

  it('migrate(currentShape, 1) is a no-op (v1 IS the schema per D-22)', () => {
    const v1 = { mode: 'light', colorTheme: 'system', pack: 'midnight' };
    const result = themeMigrate(v1, 1);
    expect(result).toMatchObject({
      mode: 'light',
      colorTheme: 'system',
      pack: 'midnight',
    });
  });

  // WR-03: the rehydrate path is the only one a prototype's blob takes, and it
  // used to cast instead of narrowing — a non-union mode or a numeric pack
  // landed in the store and every consumer mis-read it.
  it('migrate narrows a corrupt blob: a non-union mode and a numeric pack fall back to defaults', () => {
    const corrupt = { mode: 'purple', colorTheme: 'system', pack: 7 };
    expect(themeMigrate(corrupt, 1)).toEqual({
      mode: 'auto',
      colorTheme: 'system',
      pack: 'default',
    });

    const numericMode = { mode: 42, colorTheme: 3, pack: 'claude-warm' };
    expect(themeMigrate(numericMode, 1)).toEqual({
      mode: 'auto',
      colorTheme: DEFAULT_COLOR_THEME_ID,
      pack: 'claude-warm',
    });
  });
});

describe('ThemeStore — single writer and idempotent writes (D-15 / T-1-21)', () => {
  beforeEach(() => {
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
    __test__.resetPendingState();
    useThemeStore.getState().setMode('auto');
  });

  it('writing the same mode twice produces one np_theme write and no second propagation', async () => {
    const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set');

    useThemeStore.getState().setMode('light');
    await flushPendingWrites();
    useThemeStore.getState().setMode('light');
    await flushPendingWrites();

    const themeWrites = themeWritesOf(syncSetSpy);
    expect(themeWrites).toHaveLength(1);
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('stores one canonical representation under np_theme (the persist envelope, never a bare string)', async () => {
    useThemeStore.getState().setMode('dark');
    await flushPendingWrites();

    const stored = (globalThis as any).__chromeStorageMap?.get('np_theme') as string | undefined;
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored as string) as { state?: { mode?: string }; version?: number };
    expect(parsed.state?.mode).toBe('dark');
    expect(parsed.version).toBe(1);
  });

  it('AntD config follows the store mode with the `.dark` class absent (H-3 / OQ2)', () => {
    useThemeStore.getState().setMode('light');
    document.documentElement.classList.remove('dark');
    const lightCfg = getAntdConfig({
      mode: useThemeStore.getState().mode,
      pack: 'default',
      compact: true,
    });

    useThemeStore.getState().setMode('dark');
    // The class is deliberately removed: the AntD derivation must not read it.
    document.documentElement.classList.remove('dark');
    const darkCfg = getAntdConfig({
      mode: useThemeStore.getState().mode,
      pack: 'default',
      compact: true,
    });

    expect(lightCfg.theme.algorithm).toEqual([theme.defaultAlgorithm, theme.compactAlgorithm]);
    expect(darkCfg.theme.algorithm).toEqual([theme.darkAlgorithm, theme.compactAlgorithm]);
  });
});

describe('useExtensionStore — D-10 delete duplicate theme bridge', () => {
  beforeEach(() => {
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
    useThemeStore.getState().setMode('auto');
  });

  // D-10 / D-15 — updateConfig is a plain Object.assign with no theme bridge
  // into useThemeStore.setMode, and plan `01-11` removed the legacy field
  // outright: the store is not a second theme source, so there is no
  // `themeMode` left for a bridge to read back.
  it('carries no theme mode at all and updateConfig never reaches useThemeStore.setMode', () => {
    const setModeSpy = vi.spyOn(useThemeStore.getState(), 'setMode');
    useExtensionStore.getState().updateConfig({ fontSize: 'Small' });
    expect(setModeSpy).not.toHaveBeenCalled();
    expect('themeMode' in (useExtensionStore.getState().config as unknown as object)).toBe(false);
    // The active theme mode in ThemeStore is unchanged — D-10 single source of truth.
    expect(useThemeStore.getState().mode).toBe('auto');
  });
});