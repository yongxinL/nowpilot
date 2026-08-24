/**
 * IndexedDBMigrator — shared versioning framework for NowPilot's five
 * production IndexedDB databases (D-41, D-42, spec §20.4).
 *
 * Provides:
 *   - `IndexedDBMigration` interface (fromVersion/toVersion/description/migrate)
 *   - Per-DB migration registry (Map<dbName, IndexedDBMigration[]>)
 *   - `openVersionedDB` — wraps `idb.openDB` with conditional migration
 *     application + blocked callback propagation
 *   - `bootstrap` — opens all five production DBs at v1, recording
 *     `IDB_BLOCKED` and `IDB_MIGRATION_FAILED` to ErrorStore + entering
 *     degraded mode on per-DB failure
 *
 * Migration policy (spec §20.4 verbatim, RESEARCH Pitfall 8):
 *   - Every DB declares numeric `DB_VERSION`
 *   - Every bump includes an `IndexedDBMigration` entry
 *   - Migrations deterministic + idempotent (conditional `if (oldVersion < N)`
 *     blocks + skip-if-present guards)
 *   - Failures → `IDB_MIGRATION_FAILED` in ErrorStore + degraded mode
 *   - The v1→v2 fixture (ROADMAP criterion 4) uses a fixture DB name +
 *     in-test migration pair to prove the framework
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { debugLog } from '../log/debugLog';
import type { WriteJournalEntry } from '../../types/storage';

/**
 * Structural type accepted by the upgrade/migration callback.
 *
 * Migrations operate on the un-typed (`unknown` schema) shape — by
 * definition, a migration defines the schema, so it cannot constrain
 * itself to a known set of store names. `idb`'s `StoreNames<unknown>`
 * resolves to `string`, allowing arbitrary `createObjectStore('foo')`
 * and `createIndex('bar', 'baz')` calls. The runtime invariants are
 * upheld by `idb` itself (ConstraintError on duplicate names).
 *
 * Inline per-DB `open*DB()` callers use the typed schema
 * (`openVersionedDB<ChatHistoryDBV1>`) so the rest of the codebase
 * stays schema-aware.
 */
export type UpgradeDatabase = IDBPDatabase<unknown>;
/**
 * @deprecated Use `UpgradeDatabase` directly. Kept for backward
 * compatibility with the planned Module pattern (per-DB open path).
 */
export type AnyDBSchema = unknown;

/**
 * One migration step — spec §20.4 verbatim.
 */
export interface IndexedDBMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  /**
   * Migration callback. Receives an `UpgradeDatabase` (a structurally
   * permissive view of `IDBPDatabase<T>`) so migrations don't need to
   * know the exact schema type.
   */
  migrate: (db: UpgradeDatabase, oldVersion: number) => Promise<void> | void;
}

/**
 * Per-DB migration registry. Follows the CommandRegistry Map pattern
 * (Registry.ts lines 3-23). Keyed by database name; values are
 * IndexedDBMigration records. Migrations apply in order; multiple
 * migrations targeting the same (fromVersion → toVersion) range are
 * supported as long as the intervals are non-overlapping.
 */
const migrationRegistry = new Map<string, IndexedDBMigration[]>();

export function registerMigration(dbName: string, migration: IndexedDBMigration): void {
  const existing = migrationRegistry.get(dbName) ?? [];
  existing.push(migration);
  existing.sort((a, b) => a.fromVersion - b.fromVersion);
  migrationRegistry.set(dbName, existing);
}

export function getMigrations(dbName: string): IndexedDBMigration[] {
  return migrationRegistry.get(dbName) ?? [];
}

export function clearMigrations(dbName?: string): void {
  if (dbName) {
    migrationRegistry.delete(dbName);
  } else {
    migrationRegistry.clear();
  }
}

/**
 * Open a versioned IndexedDB database. The migration registry's
 * entries are applied in `upgrade()` with conditional blocks
 * (`if (oldVersion < N)`) so the same callback handles both fresh
 * opens (oldVersion === 0) and bump-from-v1 opens.
 *
 * Per idb README + spec §20.4: NEVER await non-IDB work (fetch/crypto)
 * inside the upgrade callback — derive keys / read network BEFORE
 * `db.transaction(...)`.
 */
export async function openVersionedDB<T extends DBSchema>(
  dbName: string,
  targetVersion: number,
  opts?: {
    blocked?: () => void;
    onMigrationFailed?: (err: unknown) => void;
    /**
     * Inline v1 bootstrap upgrade — runs at the start of the upgrade
     * callback (before registered migrations). Receives the typed
     * `IDBPDatabase<T>` so callers can use schema-aware helpers
     * (createObjectStore etc.) without casts.
     */
    upgrade?: (db: IDBPDatabase<T>, oldVersion: number) => Promise<void> | void;
  },
): Promise<IDBPDatabase<T>> {
  const migrations = getMigrations(dbName);

  return openDB<T>(dbName, targetVersion, {
    async upgrade(database, oldVersion) {
      // `database` is `IDBPDatabase<T>` — typed schema preserved so
      // inline opts.upgrade can use createObjectStore('sessions', ...)
      // etc. without runtime casts. Cast to `UpgradeDatabase` only for
      // the generic registered-migration path (which is intentionally
      // schema-agnostic by design).
      try {
        // Step 1: inline bootstrap (v1 schema, conditional blocks per
        // spec §20.4 / Pitfall 8).
        if (opts?.upgrade) {
          await opts.upgrade(database, oldVersion);
        }
        // Step 2: registered migrations (v1→v2, v2→v3, etc.).
        const migrationDb = database as unknown as UpgradeDatabase;
        for (const m of migrations) {
          if (m.toVersion > oldVersion && m.fromVersion <= oldVersion + 1) {
            await m.migrate(migrationDb, oldVersion);
          }
        }
      } catch (err) {
        // Migration failure → caller records IDB_MIGRATION_FAILED + enters
        // degraded mode (D-41 degraded-mode contract).
        opts?.onMigrationFailed?.(err);
        debugLog('IDB_MIGRATION_FAILED', `Migration failed for ${dbName}`, {
          fromVersion: oldVersion,
          toVersion: targetVersion,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    blocked() {
      // Blocked → another connection holds an older version open. The
      // caller records `IDB_BLOCKED` to ErrorStore per D-41.
      opts?.blocked?.();
    },
  });
}

/**
 * Bootstrap all five production databases at v1 (D-41, D-42). Each DB's
 * own `open*DB()` function is responsible for the conditional `if
 * (oldVersion < 1)` block that creates its §15.1 store list. A failed
 * open disables only that DB for the session — other DBs continue
 * operating (degraded mode per D-41).
 *
 * NOTE: The concrete `open*DB()` functions live in their respective
 * DB modules (ChatHistoryDB, MemoryDB, NotesDB, WriteJournalDB, ErrorStore)
 * and are imported lazily here to keep this file dependency-cycle-free.
 */
export async function bootstrap(): Promise<{
  opened: string[];
  failed: { dbName: string; error: unknown }[];
}> {
  const chatHistory = await import('./ChatHistoryDB');
  const memory = await import('./MemoryDB');
  const notes = await import('./NotesDB');
  const writeJournal = await import('./WriteJournalDB');
  const errorStore = await import('./ErrorStore');

  const targets: Array<{ dbName: string; open: () => Promise<unknown> }> = [
    { dbName: chatHistory.CHAT_HISTORY_DB, open: () => chatHistory.openChatHistoryDB() },
    { dbName: memory.MEMORY_DB, open: () => memory.openMemoryDB() },
    { dbName: notes.NOTES_DB, open: () => notes.openNotesDB() },
    { dbName: writeJournal.WRITE_JOURNAL_DB, open: () => writeJournal.openWriteJournalDB() },
    { dbName: errorStore.ERROR_STORE, open: () => errorStore.openErrorStore() },
  ];

  const opened: string[] = [];
  const failed: { dbName: string; error: unknown }[] = [];

  for (const t of targets) {
    try {
      await t.open();
      opened.push(t.dbName);
    } catch (error) {
      failed.push({ dbName: t.dbName, error });
      // Lazy import to avoid cycle — best-effort record; if ErrorStore
      // itself is the failing DB, the inner try/catch swallows the throw.
      try {
        await errorStore.record({
          code: 'IDB_MIGRATION_FAILED',
          message: `Bootstrap failed for ${t.dbName}`,
          context: {
            dbName: t.dbName,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } catch {
        // ErrorStore itself is broken — fall back to debugLog.
        debugLog('IDB_MIGRATION_FAILED', `Bootstrap failed for ${t.dbName} (ErrorStore also unavailable)`, {
          dbName: t.dbName,
        });
      }
    }
  }

  return { opened, failed };
}

/**
 * Helper: extract the `operation` type from a WriteJournalEntry for
 * use cases that need to discriminate on the operation field without
 * pulling the full WriteJournal type.
 */
export type EntryOperation = WriteJournalEntry['operation'];