import {
  unwrap,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from 'idb';
import { debugLog } from '../log/debugLog';

/**
 * IndexedDBMigrator — the ordered, integer-version migration framework (D2-22).
 *
 * One physical database holds every Phase 2 store, so schema changes happen on
 * a single monotonic integer axis: Phase 2 ships `DB_VERSION = 1`, Phase 8 adds
 * the Memory stores at a later version, Phase 9 the Notes stores (D2-21/D2-24).
 * A later phase **extends** this table; it never rewrites an applied migration.
 *
 * Four rules this module exists to keep (RESEARCH § Pattern 2, Pitfalls 4/5/8):
 *   1. **One transaction.** IndexedDB runs a single `versionchange` transaction
 *      for a multi-version jump, so every applicable step runs in the `tx`
 *      supplied by `openDB`'s `upgrade` callback. A step never opens its own
 *      transaction.
 *   2. **Existence checks are mandatory.** `createObjectStore` throws
 *      `ConstraintError` if the store already exists and `createIndex` throws
 *      the same for an index, so both are guarded by `contains(...)` — that is
 *      what makes a re-run idempotent.
 *   3. **A failure is recorded before it is rethrown.** `runMigrations` captures
 *      a redacted result (`getLastMigrationResult()`) and then rethrows so the
 *      versionchange transaction aborts deliberately. The caller must handle the
 *      returned promise **synchronously** and abort the transaction: an async
 *      `upgrade` callback is not awaited by `idb`, so a rejection from one would
 *      neither reject `openDB` nor be caught (probe-verified).
 *   4. **Below-current opens are never retried.** A `VersionError` means the
 *      stored schema is newer than this build understands; it maps to a typed
 *      unsupported-version result and the caller fails closed.
 *
 * The failure isolation cost of the single-database topology is deliberate and
 * recorded in D2-24/OQ-1: when the database cannot open, the ErrorStore is
 * unavailable too, so the degraded path is `debugLog` plus the caller's notice
 * and in-memory operation (§19.10) — never an ErrorStore write that cannot land.
 */

/** The canonical §20.4 migration interface (verbatim). */
export interface IndexedDBMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(db: IDBPDatabase, tx: IDBPTransaction): Promise<void>;
}

/** A redacted migration outcome. Never carries an exception payload. */
export type IndexedDBMigrationResult =
  | { ok: true; applied: number[] }
  | { ok: false; code: string };

/** Why an open failed, mapped from the underlying IndexedDB error name. */
export type IndexedDBOpenFailureCode =
  | 'IDB_UNSUPPORTED_VERSION'
  | 'IDB_MIGRATION_FAILED'
  | 'IDB_OPEN_FAILED';

/**
 * Test seam: called immediately before a migration step runs. Throwing from
 * here fails that step *inside* the migrator's own try/catch, so a failure test
 * never throws from `upgrade` (which would produce both an `AbortError`
 * rejection and a separate unhandled rejection — RESEARCH Pitfall 4).
 */
export type MigrationFailureInjector = (migration: IndexedDBMigration) => void;

export interface RunMigrationsOptions {
  /** Override the migration table. The D2-23 v1→v2 fixture uses this. */
  migrations?: readonly IndexedDBMigration[];
  /** Test seam — see `MigrationFailureInjector`. */
  injectFailure?: MigrationFailureInjector;
}

const MIGRATION_FAILED_CODE = 'IDB_MIGRATION_FAILED';
const UNSUPPORTED_VERSION_CODE = 'IDB_UNSUPPORTED_VERSION';
const OPEN_FAILED_CODE = 'IDB_OPEN_FAILED';

interface StoreIndexSpec {
  name: string;
  keyPath: string | string[];
}

/** The bare §20.4 types erase the transaction mode, so narrow it for `createIndex`. */
function asVersionChangeTransaction(tx: IDBPTransaction): IDBTransaction {
  // The `tx` handed to `upgrade` by `openDB` is always a `versionchange`
  // transaction; the bare §20.4 interface just cannot express that.
  return unwrap(tx);
}

/**
 * The redacted reason string for a caught error. IndexedDB rejects with a
 * `DOMException`, which is not `instanceof Error` in every environment, so the
 * name is read structurally — never the message, which can carry a value.
 */
function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return typeof error;
}

/**
 * `idb` types a schema-typed handle invariantly: `IDBPDatabase<NowPilotDB>` is
 * not assignable to the schema-erased `IDBPDatabase` of the §20.4 interface.
 * The runtime object is identical — this is the single place that boundary is
 * crossed, so every migration step can keep the canonical signature.
 */
function asSchemaErasedDb<DBTypes extends DBSchema | unknown>(
  db: IDBPDatabase<DBTypes>,
): IDBPDatabase {
  return db as unknown as IDBPDatabase;
}

function asSchemaErasedTx<DBTypes extends DBSchema | unknown>(
  tx: IDBPTransaction<DBTypes, StoreNames<DBTypes>[], 'versionchange'>,
): IDBPTransaction {
  return tx as unknown as IDBPTransaction;
}

/**
 * Create a store (and its indexes) if absent, and add any missing index to an
 * existing store. Both branches are guarded by an existence check so a re-run
 * is a no-op rather than a `ConstraintError`.
 */
function ensureObjectStore(
  db: IDBPDatabase,
  tx: IDBPTransaction,
  name: string,
  options: IDBObjectStoreParameters,
  indexes: readonly StoreIndexSpec[],
): void {
  if (!db.objectStoreNames.contains(name)) {
    const created = db.createObjectStore(name, options);
    for (const index of indexes) {
      created.createIndex(index.name, index.keyPath);
    }
    return;
  }

  const store = asVersionChangeTransaction(tx).objectStore(name);
  for (const index of indexes) {
    if (!store.indexNames.contains(index.name)) {
      store.createIndex(index.name, index.keyPath);
    }
  }
}

/**
 * The Phase 2 initial migration: the four stores D2-21 authorises, with the
 * canonical indexes. `messages` uses the composite key path
 * `['sessionId', 'seq']`, which is §20.2's idempotency key for a chat message
 * and keeps message ordering on an integer sequence — never a string sort.
 */
export const v1InitialPhase2Stores: IndexedDBMigration = {
  fromVersion: 0,
  toVersion: 1,
  description: 'Phase 2 initial stores: sessions, messages, entries, errors',
  async migrate(db, tx) {
    ensureObjectStore(db, tx, 'sessions', { keyPath: 'id' }, [
      { name: 'by-updated', keyPath: 'updated' },
    ]);
    ensureObjectStore(db, tx, 'messages', { keyPath: ['sessionId', 'seq'] }, [
      { name: 'by-session', keyPath: 'sessionId' },
    ]);
    ensureObjectStore(db, tx, 'entries', { keyPath: 'id' }, [
      { name: 'by-status', keyPath: 'status' },
    ]);
    ensureObjectStore(db, tx, 'errors', { keyPath: 'id' }, [
      { name: 'by-occurred', keyPath: 'occurredAt' },
    ]);
  },
};

/**
 * The production migration table. **Exactly one entry** in Phase 2 (D2-21: no
 * Memory or Notes store may exist here), and its `toVersion` equals the
 * production `DB_VERSION`. A later phase appends; it never edits v1.
 */
export const MIGRATIONS: readonly IndexedDBMigration[] = [v1InitialPhase2Stores];

let lastMigrationResult: IndexedDBMigrationResult | null = null;

/** The redacted result of the most recent migration run (null = none ran yet). */
export function getLastMigrationResult(): IndexedDBMigrationResult | null {
  return lastMigrationResult;
}

/**
 * Run every migration whose `toVersion` is newer than `oldVersion`, in table
 * order, inside the supplied versionchange `tx`.
 *
 * On failure the redacted result is recorded (so the failure is observable even
 * though the caller only sees a rejected `openDB`) and the original error is
 * rethrown so the transaction aborts deliberately.
 */
export async function runMigrations<DBTypes extends DBSchema | unknown = unknown>(
  db: IDBPDatabase<DBTypes>,
  tx: IDBPTransaction<DBTypes, StoreNames<DBTypes>[], 'versionchange'>,
  oldVersion: number,
  newVersion: number | null,
  options: RunMigrationsOptions = {},
): Promise<IndexedDBMigrationResult> {
  const table = options.migrations ?? MIGRATIONS;
  const applied: number[] = [];
  const migrationDb = asSchemaErasedDb(db);
  const migrationTx = asSchemaErasedTx(tx);

  try {
    for (const migration of table) {
      // Already applied at `oldVersion` — skip, never re-run.
      if (migration.toVersion <= oldVersion) continue;
      options.injectFailure?.(migration);
      await migration.migrate(migrationDb, migrationTx);
      applied.push(migration.toVersion);
    }
  } catch (error) {
    lastMigrationResult = { ok: false, code: MIGRATION_FAILED_CODE };
    debugLog(MIGRATION_FAILED_CODE, 'IndexedDB migration failed; the upgrade is aborted', {
      fromVersion: oldVersion,
      toVersion: newVersion ?? null,
      reason: errorName(error),
    });
    throw error;
  }

  lastMigrationResult = { ok: true, applied };
  return lastMigrationResult;
}

/**
 * Map an `openDB` rejection to a typed failure code.
 *
 * `VersionError` (the stored schema is newer than the requested version) is
 * terminal: it maps to an unsupported-version result the caller must never
 * retry. An `AbortError` is the deliberate migration abort. Anything else is an
 * unexpected open failure.
 */
export function classifyOpenError(error: unknown): IndexedDBOpenFailureCode {
  const name = errorName(error);
  if (name === 'VersionError') return UNSUPPORTED_VERSION_CODE;
  if (name === 'AbortError') return MIGRATION_FAILED_CODE;
  return OPEN_FAILED_CODE;
}

/** Test seams. Production code must never import this namespace. */
export const __test__ = {
  resetLastMigrationResult(): void {
    lastMigrationResult = null;
  },
};
