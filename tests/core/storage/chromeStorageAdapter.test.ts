import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  chromeStorageAdapter,
  syncStorageAdapter,
  flushPendingWrites,
  __test__,
  STORAGE_DEBOUNCE_MS,
  classifyStorageError,
  setStorageErrorReporter,
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

/**
 * chromeStorageAdapter — REQ-R07 error surfacing (D-38/D-39).
 *
 * The adapter surfaces chrome.storage write failures as typed errors
 * (STORAGE_QUOTA / STORAGE_RATE_LIMIT / STORAGE_DEBOUNCE_FLUSH_FAILED
 * fallback) via a registered reporter hook — never swallowed, never
 * added to the canonical registry beyond the two REQ-R07 additions.
 */
describe('chromeStorageAdapter — REQ-R07 error classification (D-38/D-39)', () => {
  let reporterSpy: ReturnType<typeof vi.fn>;
  let reporterCalls: Array<{ code: string; message: string; context?: Record<string, unknown> }>;

  beforeEach(() => {
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
    __test__.resetPendingState();

    // Register a fresh reporter spy for each test.
    reporterCalls = [];
    reporterSpy = vi.fn((entry: { code: string; message: string; context?: Record<string, unknown> }) => {
      reporterCalls.push(entry);
    });
    setStorageErrorReporter(reporterSpy);
  });

  afterEach(() => {
    // Restore the reporter to no-op so other tests aren't affected.
    setStorageErrorReporter(null);
  });

  it('Test 1 (QUOTA_BYTES): chrome.storage.local.set rejection → reporter receives code STORAGE_QUOTA', async () => {
    vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(
      new Error('QUOTA_BYTES quota exceeded'),
    );

    await chromeStorageAdapter.setItem('key_quota', '"v"');
    await flushPendingWrites();

    // Allow the microtask queue to drain.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(reporterSpy).toHaveBeenCalledTimes(1);
    expect(reporterCalls[0].code).toBe('STORAGE_QUOTA');
    expect(reporterCalls[0].message).toContain('QUOTA_BYTES');
    expect(reporterCalls[0].context?.key).toContain('key_quota');
  });

  it('Test 2 (MAX_WRITE_OPERATIONS): chrome.storage.local.set rejection → reporter receives code STORAGE_RATE_LIMIT', async () => {
    vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(
      new Error('MAX_WRITE_OPERATIONS_PER_MINUTE exceeded'),
    );

    await chromeStorageAdapter.setItem('key_rate', '"v"');
    await flushPendingWrites();

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(reporterSpy).toHaveBeenCalledTimes(1);
    expect(reporterCalls[0].code).toBe('STORAGE_RATE_LIMIT');
    expect(reporterCalls[0].message).toContain('MAX_WRITE_OPERATIONS');
  });

  it('Test 3 (fallback): unrelated rejection → reporter receives code STORAGE_DEBOUNCE_FLUSH_FAILED (debugLog-only, never dropped)', async () => {
    vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(
      new Error('Some unrelated chrome.storage failure'),
    );

    await chromeStorageAdapter.setItem('key_other', '"v"');
    await flushPendingWrites();

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(reporterSpy).toHaveBeenCalledTimes(1);
    expect(reporterCalls[0].code).toBe('STORAGE_DEBOUNCE_FLUSH_FAILED');
    expect(reporterCalls[0].message).toContain('unrelated');
  });

  it('Test 4 (exactly-one invocation): one failed flush → exactly one reporter call (no duplicate persistence)', async () => {
    // Set up two pending writes that fail.
    vi.spyOn(chrome.storage.local, 'set').mockRejectedValue(
      new Error('QUOTA_BYTES quota exceeded'),
    );

    await chromeStorageAdapter.setItem('key_a', '"a"');
    await chromeStorageAdapter.setItem('key_b', '"b"');

    await flushPendingWrites();

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    // Two keys → one batched set call → one reporter invocation.
    expect(reporterSpy).toHaveBeenCalledTimes(1);
    expect(reporterSpy).not.toHaveBeenCalledTimes(2);
  });

  it('Test 5 (sync adapter): chrome.storage.sync.set rejection → reporter receives STORAGE_RATE_LIMIT', async () => {
    vi.spyOn(chrome.storage.sync, 'set').mockRejectedValueOnce(
      new Error('MAX_WRITE_OPERATIONS_PER_HOUR exceeded'),
    );

    await syncStorageAdapter.setItem('np_theme', '"dark"');
    await flushPendingWrites();

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(reporterSpy).toHaveBeenCalledTimes(1);
    expect(reporterCalls[0].code).toBe('STORAGE_RATE_LIMIT');
  });

  it('Test 6 (no reporter registered): flush failures never throw — they remain best-effort', async () => {
    setStorageErrorReporter(null); // clear the spy

    vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(
      new Error('QUOTA_BYTES quota exceeded'),
    );

    await chromeStorageAdapter.setItem('key_solo', '"v"');
    await expect(flushPendingWrites()).resolves.not.toThrow();
  });
});

/**
 * Pure classifier unit tests — no chrome.storage interaction. The
 * classifier is the contract surface (REQ-R07 boundary/precision).
 */
describe('classifyStorageError — pure classifier (REQ-R07 contract)', () => {
  it('returns STORAGE_QUOTA for QUOTA_BYTES message text', () => {
    expect(classifyStorageError(new Error('QUOTA_BYTES exceeded'))).toBe('STORAGE_QUOTA');
  });

  it('returns STORAGE_QUOTA for QUOTA_BYTES_PER_ITEM message text', () => {
    expect(classifyStorageError(new Error('QUOTA_BYTES_PER_ITEM exceeded'))).toBe('STORAGE_QUOTA');
  });

  it('returns STORAGE_RATE_LIMIT for MAX_WRITE_OPERATIONS message text', () => {
    expect(classifyStorageError(new Error('MAX_WRITE_OPERATIONS_PER_MINUTE exceeded'))).toBe('STORAGE_RATE_LIMIT');
  });

  it('returns STORAGE_RATE_LIMIT for MAX_WRITE_OPERATIONS_PER_HOUR (regex is substring match)', () => {
    expect(classifyStorageError(new Error('MAX_WRITE_OPERATIONS_PER_HOUR exceeded'))).toBe('STORAGE_RATE_LIMIT');
  });

  it('QUOTA is checked before MAX_WRITE_OPERATIONS (precedence)', () => {
    // Even if both substrings appeared, QUOTA wins.
    expect(classifyStorageError(new Error('QUOTA_BYTES_MAX_WRITE_OPERATIONS'))).toBe('STORAGE_QUOTA');
  });

  it('case-insensitive matching (lowercase "quota_bytes")', () => {
    expect(classifyStorageError(new Error('quota_bytes quota exceeded'))).toBe('STORAGE_QUOTA');
  });

  it('case-insensitive matching (mixed case "Max_Write_Operations")', () => {
    expect(classifyStorageError(new Error('Max_Write_Operations exceeded'))).toBe('STORAGE_RATE_LIMIT');
  });

  it('returns STORAGE_DEBOUNCE_FLUSH_FAILED for unrelated message text (fallback never dropped)', () => {
    expect(classifyStorageError(new Error('NetworkError when fetching'))).toBe('STORAGE_DEBOUNCE_FLUSH_FAILED');
  });

  it('returns STORAGE_DEBOUNCE_FLUSH_FAILED for null/undefined error', () => {
    expect(classifyStorageError(null)).toBe('STORAGE_DEBOUNCE_FLUSH_FAILED');
    expect(classifyStorageError(undefined)).toBe('STORAGE_DEBOUNCE_FLUSH_FAILED');
  });

  it('returns STORAGE_DEBOUNCE_FLUSH_FAILED for string error (uses String(err))', () => {
    expect(classifyStorageError('plain string error')).toBe('STORAGE_DEBOUNCE_FLUSH_FAILED');
  });

  it('returns STORAGE_DEBOUNCE_FLUSH_FAILED for an Error with no message', () => {
    expect(classifyStorageError(new Error())).toBe('STORAGE_DEBOUNCE_FLUSH_FAILED');
  });
});