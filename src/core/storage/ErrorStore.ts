/**
 * ErrorStore — Phase 2 IDB foundation (D-39, §15.1).
 *
 * Persistent, typed, debug-only error sink for the runtime. Mirrors
 * the in-memory `debugLog` FIFO pattern (debugLog.ts lines 11-27) but
 * with a 100-entry ceiling (vs 200 for the in-memory log) and writes
 * to IndexedDB so errors survive service-worker restarts.
 *
 * §15.1 contract:
 *   - 'errors' store, autoIncrement key
 *   - FIFO eviction at 100 entries (oldest-first cursor delete)
 *   - Sensitive context redaction at the write boundary
 *   - NEVER rethrow into the caller (best-effort — RESEARCH Open Question 4)
 *   - NEVER surfaces in the user UI; debug-only (Phase 11 Diagnostics
 *     reads it via `queryRecent`)
 *
 * The blocked callback for the underlying migration is intentionally
 * a no-op — its own failure falls back to debugLog. Circular imports
 * are avoided by NOT importing the migrator here (open path uses the
 * migrator's `openVersionedDB` which is cycle-safe).
 */

import type { DBSchema } from 'idb';
import { openVersionedDB } from './IndexedDBMigrator';
import { redactSensitive } from '../security/redactSensitive';
import { debugLog } from '../log/debugLog';

export const ERROR_STORE = 'ErrorStore';
export const ERROR_STORE_VERSION = 1;
const MAX_ERROR_ENTRIES = 100;

export interface NowPilotErrorRecord {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
}

export interface ErrorStoreInput {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface ErrorStoreDBV1 extends DBSchema {
  errors: {
    key: number;
    value: NowPilotErrorRecord;
  };
}

export async function openErrorStore() {
  return openVersionedDB<ErrorStoreDBV1>(ERROR_STORE, ERROR_STORE_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('errors', { autoIncrement: true });
      }
    },
    blocked() {
      // No-op: ErrorStore's own failure is best-effort — circular import
      // would risk a recursion if we tried to record here. The caller
      // catches at the seam and falls back to debugLog.
    },
  });
}

async function writeRecord(input: ErrorStoreInput): Promise<void> {
  const db = await openErrorStore();
  try {
    const tx = db.transaction('errors', 'readwrite');
    const store = tx.objectStore('errors');
    const record: NowPilotErrorRecord = {
      code: input.code,
      message: input.message,
      context: redactSensitive(input.context),
      timestamp: Date.now(),
    };
    await store.add(record);
    const count = await store.count();
    if (count > MAX_ERROR_ENTRIES) {
      const cursor = await store.openCursor();
      if (cursor) {
        await cursor.delete();
      }
    }
    await tx.done;
  } finally {
    db.close();
  }
}

/**
 * Best-effort error recorder. NEVER rethrows into the caller — the
 * internal try/catch falls back to `debugLog` so the persist path can
 * stay exception-free.
 */
export async function record(input: ErrorStoreInput): Promise<void> {
  try {
    await writeRecord(input);
  } catch (error) {
    debugLog('ERROR_STORE_WRITE_FAILED', input.message, {
      code: input.code,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Read-only diagnostics surface. Phase-11 reads this for the
 * Diagnostics panel; Phase-2 ships it as a foundation primitive.
 */
export async function queryRecent(limit: number): Promise<NowPilotErrorRecord[]> {
  const db = await openErrorStore();
  try {
    const tx = db.transaction('errors', 'readonly');
    const store = tx.objectStore('errors');
    const all = await store.getAll();
    await tx.done;
    return all.slice(-limit);
  } finally {
    db.close();
  }
}

export const ErrorStore = {
  record,
  queryRecent,
  open: openErrorStore,
};
