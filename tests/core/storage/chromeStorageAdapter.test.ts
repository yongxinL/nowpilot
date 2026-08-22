import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  chromeStorageAdapter,
  syncStorageAdapter,
  flushPendingWrites,
  __test__,
  STORAGE_DEBOUNCE_MS,
} from '../../../src/core/theme/chromeStorageAdapter';

describe('chromeStorageAdapter — D-22 trailing debounce', () => {
  beforeEach(() => {
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
    __test__.resetPendingState();
  });

  it('rapid successive setItem calls coalesce into a single chrome.storage.local.set', async () => {
    const setSpy = vi.spyOn(chrome.storage.local, 'set');

    await chromeStorageAdapter.setItem('key_a', '"v1"');
    await chromeStorageAdapter.setItem('key_a', '"v2"');
    await chromeStorageAdapter.setItem('key_a', '"v3"');

    expect(setSpy).not.toHaveBeenCalled();
    expect(__test__.getPendingSize()).toBe(1);

    await flushPendingWrites();

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith({ key_a: '"v3"' });
  });

  it('different keys batch into a single set call', async () => {
    const setSpy = vi.spyOn(chrome.storage.local, 'set');

    await chromeStorageAdapter.setItem('key_a', '"a"');
    await chromeStorageAdapter.setItem('key_b', '"b"');
    await chromeStorageAdapter.setItem('key_c', '"c"');

    await flushPendingWrites();

    expect(setSpy).toHaveBeenCalledTimes(1);
    const arg = setSpy.mock.calls[0]?.[0] as Record<string, string>;
    expect(arg.key_a).toBe('"a"');
    expect(arg.key_b).toBe('"b"');
    expect(arg.key_c).toBe('"c"');
  });

  it('sync adapter writes route to chrome.storage.sync, not local', async () => {
    const localSetSpy = vi.spyOn(chrome.storage.local, 'set');
    const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set');

    await syncStorageAdapter.setItem('np_theme', '"dark"');

    expect(syncSetSpy).not.toHaveBeenCalled();
    expect(localSetSpy).not.toHaveBeenCalled();

    await flushPendingWrites();

    expect(syncSetSpy).toHaveBeenCalledTimes(1);
    expect(syncSetSpy).toHaveBeenCalledWith({ np_theme: '"dark"' });
    expect(localSetSpy).not.toHaveBeenCalled();
  });

  it('mixed local + sync writes route to correct areas, never cross', async () => {
    const localSetSpy = vi.spyOn(chrome.storage.local, 'set');
    const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set');

    await chromeStorageAdapter.setItem('np_store', '"local-data"');
    await syncStorageAdapter.setItem('np_theme', '"sync-data"');
    await chromeStorageAdapter.setItem('np_workspace_store', '"ws-data"');

    await flushPendingWrites();

    expect(localSetSpy).toHaveBeenCalledTimes(1);
    const localArg = localSetSpy.mock.calls[0]?.[0] as Record<string, string>;
    expect(localArg.np_store).toBe('"local-data"');
    expect(localArg.np_workspace_store).toBe('"ws-data"');
    expect(localArg.np_theme).toBeUndefined();

    expect(syncSetSpy).toHaveBeenCalledTimes(1);
    const syncArg = syncSetSpy.mock.calls[0]?.[0] as Record<string, string>;
    expect(syncArg.np_theme).toBe('"sync-data"');
  });

  it('flush is a no-op when pendingWrites is empty', async () => {
    const setSpy = vi.spyOn(chrome.storage.local, 'set');
    const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set');

    await flushPendingWrites();

    expect(setSpy).not.toHaveBeenCalled();
    expect(syncSetSpy).not.toHaveBeenCalled();
  });

  it('removeItem is NOT debounced — immediate chrome write', async () => {
    const localRemoveSpy = vi.spyOn(chrome.storage.local, 'remove');

    await chromeStorageAdapter.removeItem('key_a');

    expect(localRemoveSpy).toHaveBeenCalledWith('key_a');
  });

  it('STORAGE_DEBOUNCE_MS is the documented 300ms value', () => {
    expect(STORAGE_DEBOUNCE_MS).toBe(300);
  });
});