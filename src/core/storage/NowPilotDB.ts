import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  classifyOpenError,
  getLastMigrationResult,
  runMigrations,
  type IndexedDBMigrationResult,
  type IndexedDBOpenFailureCode,
  type MigrationFailureInjector,
} from './IndexedDBMigrator';
import { debugLog } from '../log/debugLog';
import type { ChatSessionRecord, MessageRecord } from './ChatHistoryDB';
import type { WriteJournalEntry } from './WriteJournal';
import type { ErrorRecord } from './ErrorStore';

/**
 * NowPilotDB — the single physical IndexedDB handle for the extension origin
 * (D2-24 topology lock, RESEARCH § Pattern 1 / OQ-1).
 *
 * **Topology decision (locked here, recorded as a documentation follow-up).**
 * ChatHistoryDB, WriteJournalDB and ErrorStore are **named object stores inside
 * one database**, not three physical databases:
 *
 * | Criterion (D2-24) | Why one database wins |
 * |---|---|
 * | Transaction boundaries | `sessions` + `messages` commit in one `readwrite` transaction (§13, D2-20); a journal entry can join a destination transaction later |
 * | Upgrade coordination | one `versionchange` event, one ordered migration table, one `blocked` path |
 * | Blocked upgrades | one window; §19.10's degrade covers every store at once |
 * | Migration ordering | one monotonic integer axis — §20.4's "add an object store" and D2-22's "Phase 8 adds Memory stores in a new version" are only coherent on one axis |
 * | Failure isolation | **weaker** — a failed open also loses the ErrorStore. Accepted and mitigated: `debugLog` + in-memory operation + the caller's notice (§19.10), never an ErrorStore write that cannot land |
 *
 * The database name and the store names are locked here because
 * `PRODUCT_SPEC.md` names no database anywhere (verified by the research pass)
 * while §15.1 does name the store-level units (`sessions`, `messages`,
 * `entries`). `np_db` follows the project's `np_` storage namespace; this naming
 * decision is a documentation follow-up in the spirit of D2-29 — the spec is
 * **not** edited during Phase 2.
 *
 * **Version axis.** `DB_VERSION = 1` is Phase 2's initial version. v2/v3 are
 * reserved for Phase 8's Memory stores and v4 for §20.4's `notes_backup_config`
 * + Note-field migration (Phase 9). Later phases append to `MIGRATIONS`.
 *
 * **The background service worker must never import this module** (§0.2 —
 * IndexedDB is a surface-only capability; the SW is not a database or election
 * participant). The import boundary is asserted by
 * `tests/isolation/background-no-indexeddb.test.ts`, which resolves the SW's
 * transitive import graph from `src/entrypoints/background.ts` and fails on any
 * `src/core/storage/**` module (outside its documented IndexedDB-free
 * exception), the `idb` package or an IndexedDB global.
 */

/** The single Phase 2 database (see the topology note above). */
export const DB_NAME = 'np_db';

/** Phase 2's initial integer schema version. */
export const DB_VERSION = 1;

/**
 * The `errors` store record (ErrorStore). The store is created here because the
 * Phase 2 store set is locked by D2-24/D2-21; its record shape, strict schema,
 * retention policy and resolution flow belong to `ErrorStore.ts`, which owns
 * the repository. The type is imported from there rather than restated here —
 * the same reason `ChatSessionRecord`/`MessageRecord` come from
 * `ChatHistoryDB` — so the DB schema and the record schema cannot drift.
 */
export type { ErrorRecord };

/** The Phase 2 schema. Every record crossing this boundary is Zod-validated. */
export interface NowPilotDB extends DBSchema {
  sessions: {
    key: string;
    value: ChatSessionRecord;
    indexes: { 'by-updated': number };
  };
  messages: {
    key: [string, number];
    value: MessageRecord;
    indexes: { 'by-session': string };
  };
  entries: {
    key: string;
    value: WriteJournalEntry;
    indexes: { 'by-status': string };
  };
  errors: {
    key: string;
    value: ErrorRecord;
    indexes: { 'by-occurred': number };
  };
}

/** A typed open failure. `code` is the redacted, retryable-or-terminal signal. */
export class NowPilotDbOpenError extends Error {
  readonly code: IndexedDBOpenFailureCode;

  constructor(
    code: IndexedDBOpenFailureCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'NowPilotDbOpenError';
    this.code = code;
  }
}

/** The last observed blocked-open signal (§19.10 `IDB_BLOCKED`). */
export interface BlockedOpenSignal {
  currentVersion: number;
  blockedVersion: number | null;
  at: number;
}

let dbPromise: Promise<IDBPDatabase<NowPilotDB>> | null = null;
let handle: IDBPDatabase<NowPilotDB> | null = null;
let permanentOpenFailure: IndexedDBOpenFailureCode | null = null;
let blockedSignal: BlockedOpenSignal | null = null;
let failureInjector: MigrationFailureInjector | null = null;
let versionChangeCloses = 0;
let terminatedConnections = 0;

const blockedOpenListeners: Array<(signal: BlockedOpenSignal) => void> = [];

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

function openNowPilotDb(version: number): Promise<IDBPDatabase<NowPilotDB>> {
  const promise = openDB<NowPilotDB>(DB_NAME, version, {
    upgrade(database, oldVersion, newVersion, tx) {
      // Deliberately synchronous. `idb` does not await this callback, so an
      // async rejection here would neither reject `openDB` nor be caught — the
      // open would succeed over a half-applied schema (probe-verified).
      const run = runMigrations(database, tx, oldVersion, newVersion, {
        injectFailure: failureInjector ?? undefined,
      });
      run.catch(() => {
        // `runMigrations` has already recorded the redacted result. Abort the
        // versionchange transaction so a partially applied schema never
        // commits, and mark `tx.done` handled: `idb` caches that promise, and
        // without this the deliberate abort also surfaces as an unhandled
        // rejection alongside `openDB`'s AbortError (RESEARCH Pitfall 4).
        tx.done.catch(() => undefined);
        tx.abort();
      });
    },
    blocked(currentVersion, blockedVersion) {
      blockedSignal = {
        currentVersion,
        blockedVersion: blockedVersion ?? null,
        at: Date.now(),
      };
      // §19.10: a blocked upgrade surfaces a typed signal and degrades to
      // in-memory operation. This module owns the signal; surfacing a notice is
      // the caller's job, and the plan deliberately adds no UI here.
      debugLog('IDB_BLOCKED', 'IndexedDB upgrade is blocked by an open older connection', {
        currentVersion,
        blockedVersion: blockedVersion ?? null,
      });
      for (const listener of [...blockedOpenListeners]) {
        try {
          listener(blockedSignal);
        } catch {
          // Fail-safe: one throwing listener must not stop the rest.
        }
      }
    },
    blocking() {
      versionChangeCloses += 1;
      // Release this connection so the newer version can proceed. The next
      // `getDb()` call reopens at the new version (D2-25 "version-change
      // connections close/recover correctly").
      closeDb();
    },
    terminated() {
      terminatedConnections += 1;
      // The browser closed the connection (for example after a storage
      // eviction). Mark it dead so the next `getDb()` call reopens.
      dbPromise = null;
      handle = null;
    },
  });

  return promise.then((db) => {
    handle = db;
    return db;
  });
}

/**
 * The single lazily opened handle. Concurrent callers share one `openDB` call.
 *
 * A `VersionError` (the stored schema is newer than this build supports) is
 * terminal: it is cached and re-rejected without a second open attempt. Any
 * other failure clears the cached promise so a later call retries
 * deterministically.
 */
export function getDb(): Promise<IDBPDatabase<NowPilotDB>> {
  if (permanentOpenFailure) {
    return Promise.reject(
      new NowPilotDbOpenError(
        permanentOpenFailure,
        'The stored IndexedDB schema is newer than this build supports; the open is never retried.',
      ),
    );
  }

  if (!dbPromise) {
    dbPromise = openNowPilotDb(DB_VERSION).catch((error: unknown) => {
      dbPromise = null;
      const code = classifyOpenError(error);
      if (code === 'IDB_UNSUPPORTED_VERSION') permanentOpenFailure = code;
      debugLog(code, 'IndexedDB open failed', { version: DB_VERSION, reason: errorName(error) });
      throw new NowPilotDbOpenError(code, `IndexedDB open failed: ${code}`, { cause: error });
    });
  }

  return dbPromise;
}

/** Close the cached handle and forget it, so the next `getDb()` reopens. */
export function closeDb(): void {
  const current = handle;
  handle = null;
  dbPromise = null;
  if (current) current.close();
}

/** Subscribe to blocked-open signals. Returns the unsubscribe function. */
export function onBlockedOpen(listener: (signal: BlockedOpenSignal) => void): () => void {
  blockedOpenListeners.push(listener);
  return () => {
    const index = blockedOpenListeners.indexOf(listener);
    if (index >= 0) blockedOpenListeners.splice(index, 1);
  };
}

/** Test seams. Production code must never import this namespace. */
export const __test__ = {
  /** Close the handle and clear every observability record this module holds. */
  reset(): void {
    closeDb();
    permanentOpenFailure = null;
    blockedSignal = null;
    blockedOpenListeners.length = 0;
    versionChangeCloses = 0;
    terminatedConnections = 0;
    failureInjector = null;
  },
  /**
   * Fail the next migration step from inside the migrator's own try/catch.
   * Never throw from `upgrade` in a test — that produces two failure signals
   * (RESEARCH Pitfall 4).
   */
  setMigrationFailure(failure: MigrationFailureInjector | null): void {
    failureInjector = failure;
  },
  /**
   * Open with the production callbacks at an arbitrary version. Returns its own
   * connection and does not touch the cached handle — used by the blocked /
   * blocking / unsupported-version cases.
   */
  openWithVersion(version: number): Promise<IDBPDatabase<NowPilotDB>> {
    return openNowPilotDb(version);
  },
  getObservability(): {
    blocked: BlockedOpenSignal | null;
    permanentOpenFailure: IndexedDBOpenFailureCode | null;
    versionChangeCloses: number;
    terminatedConnections: number;
    lastMigration: IndexedDBMigrationResult | null;
  } {
    return {
      blocked: blockedSignal,
      permanentOpenFailure,
      versionChangeCloses,
      terminatedConnections,
      lastMigration: getLastMigrationResult(),
    };
  },
};
