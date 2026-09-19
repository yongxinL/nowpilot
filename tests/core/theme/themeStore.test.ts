import { describe, expect, it, vi } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createThemeStore } from '@/core/theme/ThemeStore';

describe('theme store', () => {
  it('returns canonical defaults for a fresh profile', async () => {
    const store = createThemeStore(createValidatedStorage(createChromeStorageMock()));
    await expect(store.read()).resolves.toEqual({ mode: 'auto', pack: 'default' });
  });

  it('returns canonical defaults for invalid stored values', async () => {
    const chromeStorage = createChromeStorageMock();
    chromeStorage.sync._setRaw('np_theme', 'sepia');
    chromeStorage.sync._setRaw('np_theme_pack', 'solarized');
    const store = createThemeStore(createValidatedStorage(chromeStorage));
    await expect(store.read()).resolves.toEqual({ mode: 'auto', pack: 'default' });
  });

  it('persists mode and pack to chrome.storage.sync', async () => {
    const chromeStorage = createChromeStorageMock();
    const store = createThemeStore(createValidatedStorage(chromeStorage));
    await store.writeMode('dark');
    await store.writePack('liquid-glass');
    await expect(store.read()).resolves.toEqual({ mode: 'dark', pack: 'liquid-glass' });
    expect(chromeStorage.sync.set).toHaveBeenCalledWith({ np_theme: 'dark' });
    expect(chromeStorage.sync.set).toHaveBeenCalledWith({ np_theme_pack: 'liquid-glass' });
    expect(chromeStorage.local.set).not.toHaveBeenCalled();
  });

  it('logs THEME_PERSIST_FAILED and rejects when a write fails', async () => {
    const chromeStorage = createChromeStorageMock();
    vi.mocked(chromeStorage.sync.set).mockRejectedValueOnce(new Error('quota'));
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const store = createThemeStore(createValidatedStorage(chromeStorage));
    await expect(store.writeMode('dark')).rejects.toThrow();
    expect(debug.mock.calls.flat().join(' ')).toContain('THEME_PERSIST_FAILED');
    debug.mockRestore();
  });

  it('emits combined preferences when a theme key changes', async () => {
    const chromeStorage = createChromeStorageMock();
    const store = createThemeStore(createValidatedStorage(chromeStorage));
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    chromeStorage.sync._setRaw('np_theme', 'dark');
    chromeStorage.emitStorageChange({ np_theme: { newValue: 'dark' } }, 'sync');
    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith({ mode: 'dark', pack: 'default' }),
    );
    unsubscribe();
  });
});
