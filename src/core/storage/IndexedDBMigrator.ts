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
 * Structural type accepted by the upgrade/migration callback. We use
 * this (instead of `IDBPDatabase<unknown>`) so the parameter is
 * structurally compatible with `IDBPDatabase<T>` from `idb.openDB<T>`.
 *
 * The cast at the call site (`database as IDBPDatabase<AnyDBSchema>`)
 * is safe because migrations only use schema-invariant operations
 * (objectStoreNames, createObjectStore, transaction().objectStore()).
 */
export type AnyDBSchema = DBSchema & Record<string, never>;
export type UpgradeDatabase = IDBPDatabase<AnyDBSchema>;

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
     * callback (before registered migrations). Use this for the initial
     * schema bootstrap; registered migrations handle subsequent bumps.
     */
    upgrade?: (db: IDBPDatabase<unknown>, oldVersion: number) => Promise<void> | void;
  },
): Promise<IDBPDatabase<T>> {
  const migrations = getMigrations(dbName);

  return openDB<T>(dbName, targetVersion, {
    async upgrade(database, oldVersion) {
      // Cast `database` to `UpgradeDatabase` so we can hand it to the
      // generic migrate / bootstrap callbacks. Migrations only use
      // schema-invariant operations (objectStoreNames, createObjectStore,
      // transaction().objectStore()), so the cast is safe.
      const db = database as unknown as UpgradeDatabase;
      try {
        // Step 1: inline bootstrap (v1 schema, conditional blocks per
        // spec §20.4 / Pitfall 8).
        if (opts?.upgrade) {
          await opts.upgrade(db, oldVersion);
        }
        // Step 2: registered migrations (v1→v2, v2→v3, etc.).
        for (const m of migrations) {
          if (m.toVersion > oldVersion && m.fromVersion <= oldVersion + 1) {
            await m.migrate(db, oldVersion);
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