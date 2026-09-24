import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isLegacyNpStoreSource,
  npStoreStorage,
} from '../../../src/core/storage/npStoreWriteGuard';
import {
  __test__ as adapterTest,
  flushPendingWrites,
} from '../../../src/core/theme/chromeStorageAdapter';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';

/**
 * The `np_store` write guard (CR-01 / D2-07/D2-12/D2-14).
 *
 * The case that matters is the first one: a stored v2 blob (a legacy source with
 * message bodies) must not be replaced by the store's body-free projection,
 * because the migration has not read it yet. The guard's own unit surface is
 * asserted here with the real `chrome.storage.local` mock and the real debounced
 * adapter, so "held back" means what it says: nothing was queued, and nothing
 * landed after a flush.
 */

const localMap = () =>
  (globalThis as unknown as { __chromeStorageMap: Map<string, string> }).__chromeStorageMap;

const KEY = 'np_store';

const v2Blob = (body: string): string =>
  JSON.stringify({
    state: {
      config: { language: 'English' },
      sessions: [{ id: 's1', messages: [{ id: 'm1', role: 'user', content: body }] }],
      activeSessionId: 's1',
    },
    version: 2,
  });

const v3Blob = (): string =>
  JSON.stringify({
    state: { config: { language: 'English' } },
    version: 3,
  });

beforeEach(async () => {
  await flushPendingWrites();
  adapterTest.resetPendingState();
  localMap().clear();
  clearLogs();
});

afterEach(() => {
  adapterTest.resetPendingState();
  vi.restoreAllMocks();
});

describe('npStoreWriteGuard — the pre-v3 source predicate', () => {
  it('treats an absent or sanitised value as writable and every legacy shape as owned by the migration', () => {
    // Nothing to protect.
    expect(isLegacyNpStoreSource(null)).toBe(false);
    expect(isLegacyNpStoreSource('')).toBe(false);
    expect(isLegacyNpStoreSource(v3Blob())).toBe(false);

    // A legacy source with (potential) bodies.
    expect(isLegacyNpStoreSource(v2Blob('synthetic body'))).toBe(true);
    expect(isLegacyNpStoreSource(JSON.stringify({ state: {}, version: 1 }))).toBe(true);
    expect(isLegacyNpStoreSource(JSON.stringify({ state: {} }))).toBe(true); // version 0

    // Shapes the migration itself refuses to guess at are preserved too (D2-13).
    expect(isLegacyNpStoreSource('not json at all')).toBe(true);
    expect(isLegacyNpStoreSource('"a bare string"')).toBe(true);
    expect(isLegacyNpStoreSource('[]')).toBe(true);
    expect(isLegacyNpStoreSource(JSON.stringify({ state: {}, version: '3' }))).toBe(true);
  });
});

describe('npStoreWriteGuard — a legacy source is never replaced', () => {
  it('holds the write back, queues nothing and leaves the stored body byte-identical', async () => {
    const legacy = v2Blob('synthetic-body-DO-NOT-LOSE');
    localMap().set(KEY, legacy);

    await npStoreStorage.setItem(KEY, JSON.stringify({ state: { prompts: [] }, version: 3 }));

    // Nothing was queued for the debounced flush...
    expect(adapterTest.getPendingSize()).toBe(0);
    // ...and a flush cannot land a write that was never queued.
    await flushPendingWrites();
    expect(localMap().get(KEY)).toBe(legacy);
    expect(localMap().get(KEY)).toContain('synthetic-body-DO-NOT-LOSE');
    expect(getRecentLogs().some((entry) => entry.code === 'NP_STORE_WRITE_HELD')).toBe(true);
  });

  it('holds the write back when the stored source cannot be read at all', async () => {
    localMap().set(KEY, v2Blob('synthetic-body-DO-NOT-LOSE'));
    const getSpy = vi
      .spyOn(chrome.storage.local, 'get')
      .mockRejectedValueOnce(new Error('synthetic-storage-read-failure'));

    try {
      await npStoreStorage.setItem(KEY, JSON.stringify({ state: {}, version: 3 }));
    } finally {
      getSpy.mockRestore();
    }

    expect(adapterTest.getPendingSize()).toBe(0);
    await flushPendingWrites();
    expect(localMap().get(KEY)).toContain('synthetic-body-DO-NOT-LOSE');
  });
});

describe('npStoreWriteGuard — after the cutover the adapter is transparent', () => {
  it('passes a write through once the stored blob is v3', async () => {
    localMap().set(KEY, v3Blob());
    const next = JSON.stringify({ state: { config: { language: 'English' } }, version: 3 });

    await npStoreStorage.setItem(KEY, next);

    expect(adapterTest.getPendingSize()).toBe(1);
    await flushPendingWrites();
    expect(localMap().get(KEY)).toBe(next);
  });

  it('passes a write through when no source exists and delegates reads and removals', async () => {
    await npStoreStorage.setItem(KEY, v3Blob());
    await flushPendingWrites();
    expect(localMap().get(KEY)).toBe(v3Blob());

    // Reads and removals are the adapter's own (positive controls: the
    // delegation is real, not a stub that returns null).
    expect(await npStoreStorage.getItem(KEY)).toBe(v3Blob());
    await npStoreStorage.removeItem?.(KEY);
    expect(localMap().has(KEY)).toBe(false);
  });
});
