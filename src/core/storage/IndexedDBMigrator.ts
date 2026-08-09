// src/core/storage/IndexedDBMigrator.ts — D-12/D-13/D-14 + §20.4 IndexedDB
// migration framework. Source: RESEARCH Pattern 2 — the phase's ONE critical
// pattern, empirically verified under this project's vitest stack.
//
// WHY RAW indexedDB.open (never idb openDB for version-change opens): idb's
// openDB with a THROWING upgrade leaks an unhandled rejection from
// fake-indexeddb's internal double-settle (the upgrade aborts twice — once via
// the error event idb consumes, once via an internal cb nobody listens to) and
// `vitest run` exits 1, failing verify:phase-2 (RESEARCH Pitfall 1). The
// raw-open runner dispatches migrations SYNCHRONOUSLY inside onupgradeneeded:
// a sync throw aborts the upgrade transaction ATOMICALLY and surfaces as an
// AbortError on the open request — verified exit 0 on BOTH happy and failure
// paths (probe: version stays v(n-1), data intact, no partial schema).
//
// D-12 degraded mode: a migration failure records IDB_MIGRATION_FAILED in
// ErrorStore (via the injected onMigrationFailed, default =
// handleMigrationFailed) and marks the DB read-only — module-level degraded
// state { db, reason } feeds the Phase-7 persistent banner; reads still work at
// v(n-1) (the runner never deletes data). In-memory fallback is explicitly
// REJECTED: a silent shadow-write would split-brain with on-disk state.
// assertWritable(dbName) throws the typed DegradedDBError write-block gate.
//
// D-14 registry: real stores declare their current version + future migrations
// in a DBVersionMigration and open via runMigrations (e.g. Phase 5a's v4
// notes_backup_config extends the registry) — never hand-patch stores again.
// D-13 fixture: the synthetic v1→v2 proof (add-store + add-index + data-carry
// + idempotency + throws→degraded) lives in
// tests/core/storage/IndexedDBMigrator.test.ts.
//
// Pitfall 2: migrations are dispatched WITHOUT await — data-carry is
// IDBRequest/promise-chaining (an awaited non-IDB promise closes the upgrade
// tx). Pitfall 3: the ORIGINAL error is captured inside the upgrade callback
// (try/catch + promise .catch) before the abort swallows it — onMigrationFailed
// receives the real cause, not a generic AbortError.
//
// Golden Rule 9: every catch calls debugLog with a canonical §C.2 code
// (IDB_MIGRATION_FAILED, 02-01).
import { wrap, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { redactSensitive } from '@/core/security/redactSensitive';
import { recordMigrationFailure } from '@/core/storage/ErrorStore';

/** §20.4 (lines 3211-3218) — VERBATIM IndexedDBMigration interface. */
export interface IndexedDBMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(db: IDBPDatabase, tx: IDBPTransaction): Promise<void>;
}

/** D-14 per-DB migration registry: a DB's target version + the migrations to run. */
export interface DBVersionMigration {
  dbName: string;
  dbVersion: number;
  migrations: IndexedDBMigration[];
}

/** D-12 module-level degraded state — feeds the Phase-7 persistent banner. */
const degradedDbs: Array<{ db: string; reason: string }> = [];

/** D-12: read-only degraded DBs (defensive copies), for the Phase-7 banner. */
export function getDegradedDbs(): Array<{ db: string; reason: string }> {
  return degradedDbs.map((d) => ({ ...d }));
}

/** D-12: true when the DB is degraded (read-only) — stores gate writes on this. */
export function isDbDegraded(dbName: string): boolean {
  return degradedDbs.some((d) => d.db === dbName);
}

/** Typed write-block error thrown by assertWritable when the DB is degraded (D-12). */
export class DegradedDBError extends Error {
  readonly dbName: string;

  constructor(dbName: string) {
    super(
      `Storage failed to upgrade — data is read-only for '${dbName}'. Use Import/Export to back up.`,
    );
    this.name = 'DegradedDBError';
    this.dbName = dbName;
  }
}

/**
 * D-12 write-block gate: throws DegradedDBError when the DB is degraded.
 * In-memory fallback is REJECTED — a degraded DB stays read-only at v(n-1)
 * rather than silently shadow-writing to memory (split-brain hazard).
 */
export function assertWritable(dbName: string): void {
  if (isDbDegraded(dbName)) throw new DegradedDBError(dbName);
}

/** Failure callback contract — receives the ORIGINAL migration error (Pitfall 3). */
export type MigrationFailedHandler = (
  dbName: string,
  originalError: unknown,
) => void | Promise<void>;

function toReason(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'string') return cause;
  return String(cause);
}

/**
 * Default failure handler (D-12): record IDB_MIGRATION_FAILED in ErrorStore
 * (redacted cause) + debugLog + mark the DB degraded. Never throws.
 */
export async function handleMigrationFailed(dbName: string, originalError: unknown): Promise<void> {
  const reason = toReason(originalError);
  if (!degradedDbs.some((d) => d.db === dbName)) {
    degradedDbs.push({ db: dbName, reason });
  }
  debugLog(
    ERROR_CODES.IDB_MIGRATION_FAILED,
    'IndexedDB migration failed — DB degraded to read-only',
    {
      module: 'IndexedDBMigrator',
      extra: { dbName, reason: redactSensitive(reason) as string },
    },
  );
  await recordMigrationFailure(dbName, reason);
}

/**
 * D-14 runner: opens the DB at spec.dbVersion via RAW indexedDB.open (RESEARCH
 * Pattern 2) and dispatches the FULL migration chain from the current version
 * to the target — every migration whose fromVersion is in [oldVersion,
 * newVersion), sorted by fromVersion (WR-07: chained 1→2→3 upgrades and fresh
 * installs 0→N run EVERY step, never just the exact-transition match). The
 * dispatch is called SYNCHRONOUSLY inside onupgradeneeded (never awaited; a
 * sync throw aborts atomically). On success, resolves with the idb-wrapped
 * DB. On a migration failure (AbortError), runs onMigrationFailed with the
 * ORIGINAL error (Pitfall 3) then rejects with the request error.
 */
export function runMigrations<T extends DBSchema = DBSchema>(
  spec: DBVersionMigration,
  onMigrationFailed: MigrationFailedHandler = handleMigrationFailed,
): Promise<IDBPDatabase<T>> {
  return new Promise<IDBPDatabase<T>>((resolve, reject) => {
    let capturedError: unknown = null;
    const request = indexedDB.open(spec.dbName, spec.dbVersion);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = wrap(request.result); // idb-wrapped for the §20.4 interface
      const tx = wrap(request.transaction!);
      // idb's wrap() registers a done-promise abort/error listener
      // (cacheDonePromiseForTransaction, wrap-idb-value.js): when the upgrade
      // aborts, that promise rejects — if unconsumed it leaks an unhandled
      // rejection under fake-indexeddb and fails `vitest run` (RESEARCH
      // Pitfall 1). The request.onerror path owns the real failure handling.
      void tx.done.catch(() => {
        /* consumed — the aborted upgrade surfaces via request.onerror */
      });
      const fromVersion = event.oldVersion;
      const toVersion = event.newVersion ?? 0;
      try {
        // WR-07: run the FULL migration chain from oldVersion → newVersion —
        // every migration whose fromVersion is in [oldVersion, newVersion),
        // sorted by fromVersion so chained upgrades (1→2 then 2→3 opening at 3)
        // execute BOTH steps, and a fresh install (oldVersion 0 → N) runs every
        // registered step from 0 (including a fromVersion: 0 'create initial
        // schema' migration when one is registered). The old exact-match
        // dispatch silently skipped chained steps and ran nothing on fresh
        // installs (the DB would open at version N with zero object stores).
        const chain = spec.migrations
          .filter(
            (migration) =>
              migration.fromVersion >= fromVersion && migration.fromVersion < toVersion,
          )
          .sort((a, b) => a.fromVersion - b.fromVersion);
        for (const migration of chain) {
          // SYNC dispatch — never await inside the upgrade callback (Pitfall 2:
          // an awaited non-IDB promise closes the transaction mid-migration).
          const result = migration.migrate(db, tx);
          if (result != null && typeof (result as Promise<void>).catch === 'function') {
            // Async-rejection capture (Pitfall 3): record the original error so
            // it is never an unhandled rejection. NO tx.abort() here — aborting
            // a wrapped transaction leaks the same fake-indexeddb double-settle
            // (empirically probed; the sync-throw path is the abort mechanism).
            void (result as Promise<void>).catch((err: unknown) => {
              if (capturedError === null) capturedError = err;
              debugLog(ERROR_CODES.IDB_MIGRATION_FAILED, 'async migration rejected', {
                module: 'IndexedDBMigrator',
                extra: { dbName: spec.dbName, migration: migration.description },
              });
            });
          }
        }
      } catch (err) {
        // Pitfall 3: capture the ORIGINAL error BEFORE the abort swallows it.
        if (capturedError === null) capturedError = err;
        // TEMP DEBUG
        throw err; // sync throw → upgrade aborts atomically → onerror(AbortError)
      }
    };

    request.onsuccess = () => {
      if (capturedError !== null) {
        // An async migration rejected but the upgrade already committed — degrade
        // conservatively (D-12: writes blocked, error recorded) while reads work.
        void Promise.resolve()
          .then(() => onMigrationFailed(spec.dbName, capturedError))
          .catch((err: unknown) => {
            debugLog(ERROR_CODES.IDB_MIGRATION_FAILED, 'migration failure handler threw', {
              error: err instanceof Error ? err : undefined,
              module: 'IndexedDBMigrator',
            });
          });
      }
      resolve(wrap(request.result) as IDBPDatabase<T>);
    };

    request.onerror = () => {
      // TEMP DEBUG
      const requestError = request.error ?? new Error(`indexedDB.open failed for ${spec.dbName}`);
      if (capturedError !== null || requestError.name === 'AbortError') {
        // A migration failure (sync throw, async rejection, or upgrade abort) →
        // record + degrade (D-12). Other open failures (VersionError, quota) are
        // programming errors → log + reject WITHOUT degrading.
        void Promise.resolve()
          .then(() => onMigrationFailed(spec.dbName, capturedError ?? requestError))
          .catch((err: unknown) => {
            debugLog(ERROR_CODES.IDB_MIGRATION_FAILED, 'migration failure handler threw', {
              error: err instanceof Error ? err : undefined,
              module: 'IndexedDBMigrator',
            });
          })
          .then(() => reject(requestError));
      } else {
        debugLog(ERROR_CODES.IDB_MIGRATION_FAILED, 'indexedDB.open failed', {
          module: 'IndexedDBMigrator',
          extra: { dbName: spec.dbName },
        });
        reject(requestError);
      }
    };

    request.onblocked = () => {
      debugLog(ERROR_CODES.IDB_MIGRATION_FAILED, 'migration blocked by an open connection', {
        module: 'IndexedDBMigrator',
        extra: { dbName: spec.dbName },
      });
    };
  });
}
