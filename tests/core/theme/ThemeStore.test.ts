import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore } from '../../../src/core/theme/ThemeStore';
import { chromeStorageAdapter } from '../../../src/core/theme/chromeStorageAdapter';

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

describe('chromeStorageAdapter', () => {
  beforeEach(() => {
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
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
