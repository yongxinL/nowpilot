import type { StateStorage } from 'zustand/middleware';

const hasChromeStorageLocal = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);
const hasChromeStorageSync = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.sync);

/**
 * D-22: trailing-debounce window for chrome.storage writes (ms). Single
 * source of truth (M5). Steady-state streaming must stay ≤30 writes/min
 * (well under chrome.storage's ~120 writes/min throttle boundary per
 * PITFALLS P2). The value is exported so tests can drive `vi.advanceTimersByTime`
 * without hard-coding 300 elsewhere.
 */
export const STORAGE_DEBOUNCE_MS = 300;

/**
 * REQ-R07 / D-38/D-39: classify a chrome.storage write failure into one
 * of the two new canonical codes (`STORAGE_QUOTA`, `STORAGE_RATE_LIMIT`)
 * or the debugLog-only fallback (`STORAGE_DEBOUNCE_FLUSH_FAILED`).
 *
 * chrome.storage rejects with `runtime.lastError` message text — there
 * is no typed error object (RESEARCH Pitfall 6). The classifier is
 * pure (no side effects) so it can be unit-tested in isolation and
 * reused by callers that want to log/map the same errors.
 *
 * Boundary contract (REQ-R07 probe row, verbatim):
 *   - `/QUOTA|QUOTA_BYTES/i` → `STORAGE_QUOTA`
 *     (covers both `QUOTA_BYTES` and `QUOTA_BYTES_PER_ITEM`).
 *   - `/MAX_WRITE_OPERATIONS/i` → `STORAGE_RATE_LIMIT`
 *     (covers both `MAX_WRITE_OPERATIONS_PER_MINUTE` and `_PER_HOUR`).
 *   - else → `STORAGE_DEBOUNCE_FLUSH_FAILED` (fallback never dropped).
 *   - Case-insensitive; QUOTA checked before MAX_WRITE_OPERATIONS
 *     (precedence rule).
 */
export function classifyStorageError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/QUOTA|QUOTA_BYTES/i.test(message)) return 'STORAGE_QUOTA';
  if (/MAX_WRITE_OPERATIONS/i.test(message)) return 'STORAGE_RATE_LIMIT';
  return 'STORAGE_DEBOUNCE_FLUSH_FAILED';
}

/**
 * REQ-R07 / D-39 ownership rule: the adapter emits typed errors
 * through a single reporter hook — exactly one ErrorStore entry is
 * recorded by the registered reporter per failed flush. The adapter
 * does NOT import ErrorStore (the boot wiring in plan 02-07 registers
 * the reporter = `ErrorStore.record` + debugLog; tests register spies).
 *
 * Default is no-op (null) so the adapter remains import-safe and the
 * zustand persist path never throws on missing reporter wiring.
 */
export interface StorageErrorEntry {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

let errorReporter: ((entry: StorageErrorEntry) => void) | null = null;

/**
 * Register the reporter hook. Pass `null` to disable reporting
 * (the adapter still swallows failures via the no-op default — no
 * rethrow into the calling persist path).
 */
export function setStorageErrorReporter(
  fn: ((entry: StorageErrorEntry) => void) | null,
): void {
  errorReporter = fn;
}

type StorageTarget = 'local' | 'sync';

interface PendingWrite {
  value: string;
  target: StorageTarget;
}

/**
 * Pending writes, keyed by chrome.storage key name. Each entry tags the
 * chrome.storage area (`local` vs `sync`) it MUST land on so the
 * debounced flush routes ThemeStore (sync) writes to chrome.storage.sync
 * and useExtensionStore / WorkspaceStore (local) writes to
 * chrome.storage.local — sharing a single debounce map is safe because
 * the flush function reads the per-entry `target` tag.
 */
const pendingWrites = new Map<string, PendingWrite>();

/** Single trailing timer — coalesces all pending writes across targets. */
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/** Test seam: lets unit tests inject the timer used by the debounce. */
let timerFactory: (cb: () => void, ms: number) => ReturnType<typeof setTimeout> =
  (cb, ms) => setTimeout(cb, ms);

/** Test seam: lets unit tests cancel the timer used by the debounce. */
let timerClear: (handle: ReturnType<typeof setTimeout>) => void =
  (handle) => clearTimeout(handle);

/**
 * Internal: flushes pending writes to their TARGETED chrome.storage
 * area, splitting a mixed `pendingWrites` map into per-area batches so
 * ThemeStore (sync) does not accidentally land on chrome.storage.local
 * and vice versa.
 *
 * Returns a Promise that resolves when both per-area writes complete.
 * The in-memory `pendingWrites` map is cleared synchronously inside this
 * function (before the await) so a parallel `setItem` call mid-flush is
 * not lost — the new entry lands in a fresh `pendingWrites` map for the
 * next debounce window.
 *
 * REQ-R07 / D-38/D-39: on flush failure, the catch handler classifies
 * the error via `classifyStorageError` and invokes the registered
 * `errorReporter` exactly once per failed flush (no duplicate
 * persistence). The adapter does NOT import ErrorStore — the boot
 * wiring in plan 02-07 registers the reporter = `ErrorStore.record` +
 * debugLog; tests register spies.
 */
function performFlush(): Promise<void> {
  if (pendingTimer) {
    timerClear(pendingTimer);
    pendingTimer = null;
  }
  if (pendingWrites.size === 0) return Promise.resolve();

  // Snapshot + clear atomically (single-threaded JS). A re-entrant
  // setItem() during the await below lands in a fresh `pendingWrites`
  // map for the next debounce window, never lost.
  const snapshot = Array.from(pendingWrites.entries()).map(([key, pw]) => [key, pw] as const);
  pendingWrites.clear();

  const localBatch: Record<string, string> = {};
  const syncBatch: Record<string, string> = {};
  for (const [key, pw] of snapshot) {
    if (pw.target === 'sync') syncBatch[key] = pw.value;
    else localBatch[key] = pw.value;
  }

  // Capture the keys being flushed for error context (D-39: the
  // reporter receives the batch keys so ErrorStore entries are
  // actionable — "which keys failed?").
  const allFlushedKeys = Array.from(snapshot).map(([k]) => k);

  const writes: Promise<void>[] = [];

  if (hasChromeStorageLocal && Object.keys(localBatch).length > 0) {
    writes.push(chrome.storage.local.set(localBatch as unknown as Record<string, unknown>));
  } else if (Object.keys(localBatch).length > 0) {
    for (const [k, v] of Object.entries(localBatch)) localStorage.setItem(k, v);
  }

  if (hasChromeStorageSync && Object.keys(syncBatch).length > 0) {
    writes.push(chrome.storage.sync.set(syncBatch as unknown as Record<string, unknown>));
  } else if (Object.keys(syncBatch).length > 0) {
    for (const [k, v] of Object.entries(syncBatch)) localStorage.setItem(k, v);
  }

  if (writes.length === 0) return Promise.resolve();

  const flushPromise = Promise.all(writes).then(() => undefined);

  // REQ-R07 / D-39: classify the failure and surface via the
  // registered reporter exactly once. No `debugLog` swallowing, no
  // rethrow — failures are best-effort and the calling zustand persist
  // path never sees a rejection (test 6 contract).
  flushPromise.catch((err: unknown) => {
    const code = classifyStorageError(err);
    const message = err instanceof Error ? err.message : String(err);
    if (errorReporter) {
      errorReporter({ code, message, context: { keys: allFlushedKeys } });
    }
  });

  // Return a promise that resolves regardless of flush outcome — the
  // reporter is the canonical surface (D-39 ownership rule), the
  // caller never sees the rejection.
  return flushPromise.catch(() => undefined);
}

/**
 * Public flush hook (M5): called on `beforeunload` and
 * `visibilitychange → hidden` so the final ≤300 ms of writes don't get
 * dropped on tab close / SW eviction. T-01-12: a hard browser crash
 * (no flush event fires) remains an accepted residual risk — this hook
 * covers the documented chrome.storage termination semantics.
 */
export function flushPendingWrites(): Promise<void> {
  return performFlush();
}

// --- One-time lifecycle wiring -------------------------------------------------
// Guarded by `typeof window !== 'undefined'` so the adapter is still
// import-safe from the background service worker (no `document` there).
let _lifecycleInstalled = false;
function installLifecycleFlush(): void {
  if (_lifecycleInstalled) return;
  if (typeof window === 'undefined') return;
  _lifecycleInstalled = true;

  const flush = () => {
    // Fire-and-forget — beforeunload has no useful await semantics; the
    // chrome.storage write completes on its own.
    void flushPendingWrites();
  };

  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export const chromeStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (hasChromeStorageLocal) {
      // If there's a pending write for this key, the in-memory pending
      // map IS the latest value the debounce intends to land. Returning
      // it directly avoids a stale-read on the just-pending key.
      if (pendingWrites.has(name)) {
        return pendingWrites.get(name)?.value ?? null;
      }
      const result = await chrome.storage.local.get(name);
      return (result[name] as string | undefined) ?? null;
    }
    return localStorage.getItem(name);
  },

  setItem: async (name: string, value: string): Promise<void> => {
    installLifecycleFlush();

    // D-22: trailing debounce keyed by `name`. Re-setting the same key
    // coalesces (last-write-wins in `pendingWrites`).
    pendingWrites.set(name, { value, target: 'local' });

    if (pendingTimer) timerClear(pendingTimer);
    pendingTimer = timerFactory(() => {
      pendingTimer = null;
      // REQ-R07 / D-39: performFlush's internal catch classifies the
      // error and invokes the registered reporter exactly once — no
      // swallowing. The adapter does NOT import ErrorStore (the boot
      // wiring in plan 02-07 registers the reporter = ErrorStore.record
      // + debugLog; tests register spies).
      void performFlush();
    }, STORAGE_DEBOUNCE_MS);
  },

  removeItem: async (name: string): Promise<void> => {
    // D-22: removeItem is NOT debounced — deletions are infrequent and
    // a stale "still present" read after a debounce window would be a
    // correctness bug (e.g. logout must take effect immediately).
    if (pendingWrites.has(name)) pendingWrites.delete(name);
    if (hasChromeStorageLocal) {
      await chrome.storage.local.remove(name);
    } else {
      localStorage.removeItem(name);
    }
  },
};

/**
 * chrome.storage.sync-backed StateStorage adapter (D-10).
 *
 * Used by ThemeStore so the active theme survives reload across surfaces and
 * (eventually) across devices via chrome.storage.sync. Falls back to
 * localStorage when chrome.storage.sync is unavailable (e.g. unit tests
 * without the mock). The pack field is persisted to a SEPARATE key
 * (`np_theme_pack`) per spec §15.1 / §17.1a APPR-06 — keeping it distinct
 * avoids a Phase-15 migration when pack-specific logic lands.
 *
 * chrome.storage.sync has a tighter per-key write quota than
 * chrome.storage.local (~180 writes/min/user vs ~120 writes/min/total).
 * We apply the same 300ms trailing debounce here so ThemeStore writes
 * stay well within the sync quota. Pending writes are tagged
 * `{target: 'sync'}` in the shared `pendingWrites` map so the flush
 * correctly routes them to chrome.storage.sync (NOT local).
 */
export const syncStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (pendingWrites.has(name)) {
      return pendingWrites.get(name)?.value ?? null;
    }
    if (hasChromeStorageSync) {
      const result = await chrome.storage.sync.get(name);
      return (result[name] as string | undefined) ?? null;
    }
    return localStorage.getItem(name);
  },

  setItem: async (name: string, value: string): Promise<void> => {
    installLifecycleFlush();

    pendingWrites.set(name, { value, target: 'sync' });

    if (pendingTimer) timerClear(pendingTimer);
    pendingTimer = timerFactory(() => {
      pendingTimer = null;
      // REQ-R07 / D-39: see chromeStorageAdapter.setItem comment.
      void performFlush();
    }, STORAGE_DEBOUNCE_MS);
  },

  removeItem: async (name: string): Promise<void> => {
    if (pendingWrites.has(name)) pendingWrites.delete(name);
    if (hasChromeStorageSync) {
      await chrome.storage.sync.remove(name);
    } else {
      localStorage.removeItem(name);
    }
  },
};

// ---------------------------------------------------------------------------
// Test seams — exported only for unit tests. Production code must NOT use
// these (they reach into the debounce timer). The `__test__` prefix is the
// convention used by other adapters in this codebase for test-only exports.
// ---------------------------------------------------------------------------
export const __test__ = {
  setTimerFactory(factory: typeof timerFactory): void {
    timerFactory = factory;
  },
  setTimerClear(clear: typeof timerClear): void {
    timerClear = clear;
  },
  resetPendingState(): void {
    if (pendingTimer) timerClear(pendingTimer);
    pendingTimer = null;
    pendingWrites.clear();
    _lifecycleInstalled = false;
  },
  getPendingSize(): number {
    return pendingWrites.size;
  },
};