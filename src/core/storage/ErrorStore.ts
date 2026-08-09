// src/core/storage/ErrorStore.ts — §15.1 ErrorStore (line 1963): debug-only,
// FIFO max 100 IndexedDB store. The IDB_MIGRATION_FAILED sink (D-12) and the
// read surface for the Phase-7 Diagnostics panel.
//
// R-10 / D-16: EVERY write routes through redactSensitive BEFORE put (RESEARCH
// Pattern 6) — a raw secret (sk-…, Bearer …, JSESSIONID=…, §16.5 patterns)
// never lands in the store (T-2-06-02). Password-like fields would be DROPPED
// by the hook; apiKey-style values are scrubbed to the literal [REDACTED] token.
//
// FIFO mechanics (agent discretion, RESEARCH Q4): entries are keyed by a
// lexicographically-increasing id (`<ts>.<seq>` — seq zero-padded so 99 < 100),
// making primary-key order == insertion order even for same-millisecond writes;
// after each put the oldest entries beyond the 100 cap are deleted by id.
// getErrors() reverses to newest-first for the diagnostics surface.
//
// Golden Rule 9: every catch calls debugLog with a canonical §C.2 code; write
// paths never throw (PATTERNS Shared Pattern 1). If ErrorStore itself cannot
// open, recordMigrationFailure falls back to the debugLog console sink
// (redacted) while the migrator's degraded state stays in-memory (RESEARCH Q4
// answer — the D-12 write gate still holds).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { redactSensitive } from '@/core/security/redactSensitive';

/** §15.1 ErrorStore entry shape (debug-only; internal shape is agent discretion). */
export interface ErrorEntry {
  id: string;
  ts: number;
  code: string;
  message: string;
  module?: string;
}

/** §15.1 ErrorStore schema — single 'errors' store keyed by id. */
export interface ErrorStoreSchema extends DBSchema {
  errors: { key: string; value: ErrorEntry };
}

const ERROR_STORE_DB_NAME = 'ErrorStore';
const ERROR_STORE_DB_VERSION = 1;

/** §15.1 FIFO cap — the store never exceeds this many entries (debug-only). */
export const ERROR_STORE_MAX_ENTRIES = 100;

/** Monotonic per-session sequence so same-millisecond entries keep insertion order. */
let sequence = 0;

/**
 * Open the ErrorStore with a NON-throwing upgrade (no migration history yet —
 * RESEARCH note: idb openDB is fine for the initial create; future schema
 * changes register a DBVersionMigration with the 02-06 IndexedDBMigrator).
 */
export function openErrorStore(): Promise<IDBPDatabase<ErrorStoreSchema>> {
  return openDB<ErrorStoreSchema>(ERROR_STORE_DB_NAME, ERROR_STORE_DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('errors', { keyPath: 'id' });
    },
  });
}

/**
 * Write a redacted error entry (D-16 — redactSensitive BEFORE put), then trim
 * the store to the FIFO 100 cap by deleting the oldest beyond it. Never throws
 * (Golden Rule 9).
 */
export async function writeError(code: string, message: string, module?: string): Promise<void> {
  try {
    const safe = redactSensitive({ code, message, module }) as {
      code: string;
      message: string;
      module?: string;
    };
    const ts = Date.now();
    const entry: ErrorEntry = {
      id: `${ts}.${String(sequence++).padStart(4, '0')}`,
      ts,
      code: safe.code,
      message: safe.message,
      module: safe.module,
    };
    const db = await openErrorStore();
    await db.put('errors', entry);
    await trimToMax(db);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to write error entry', {
      error: err instanceof Error ? err : undefined,
      module: 'ErrorStore',
    });
  }
}

/** FIFO trim: delete the oldest entries (primary-key ascending) beyond the 100 cap. */
async function trimToMax(db: IDBPDatabase<ErrorStoreSchema>): Promise<void> {
  const all = await db.getAll('errors');
  const excess = all.length - ERROR_STORE_MAX_ENTRIES;
  if (excess <= 0) return;
  const tx = db.transaction('errors', 'readwrite');
  for (const oldest of all.slice(0, excess)) {
    await tx.objectStore('errors').delete(oldest.id);
  }
  await tx.done;
}

/**
 * Read the stored errors, newest-first, for the Phase-7 Diagnostics surface
 * (read-only). `limit` caps the result; [] on read failure (never throws).
 */
export async function getErrors(limit?: number): Promise<ErrorEntry[]> {
  try {
    const db = await openErrorStore();
    const all = await db.getAll('errors'); // primary-key ascending == insertion order
    all.reverse(); // newest first
    return typeof limit === 'number' && limit >= 0 ? all.slice(0, limit) : all;
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to get error entries', {
      error: err instanceof Error ? err : undefined,
      module: 'ErrorStore',
    });
    return [];
  }
}

/**
 * D-12 IDB_MIGRATION_FAILED sink: writes a code 'IDB_MIGRATION_FAILED' entry
 * whose cause is redacted (D-16). If ErrorStore itself fails to open, falls
 * back to the debugLog console sink (redacted) — the migrator's degraded
 * in-memory state still gates writes (RESEARCH Q4 answer). Never throws.
 */
export async function recordMigrationFailure(dbName: string, cause: string): Promise<void> {
  try {
    const safe = redactSensitive({ dbName, cause }) as { dbName: string; cause: string };
    await writeError(
      ERROR_CODES.IDB_MIGRATION_FAILED,
      `migration failed for ${safe.dbName}: ${safe.cause}`,
      'IndexedDBMigrator',
    );
  } catch (err) {
    debugLog(ERROR_CODES.IDB_MIGRATION_FAILED, 'ErrorStore unavailable — migration failure on console sink', {
      error: err instanceof Error ? err : undefined,
      module: 'ErrorStore',
      extra: { dbName },
    });
  }
}
