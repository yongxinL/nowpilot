import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDB } from 'idb';
import {
  MIGRATIONS,
  classifyOpenError,
  getLastMigrationResult,
  runMigrations,
  v1InitialPhase2Stores,
  __test__ as migratorTest,
  type IndexedDBMigration,
} from '../../../src/core/storage/IndexedDBMigrator';
import {
  DB_NAME,
  DB_VERSION,
  NowPilotDbOpenError,
  closeDb,
  getDb,
  onBlockedOpen,
  __test__,
  type BlockedOpenSignal,
} from '../../../src/core/storage/NowPilotDB';
import type { ChatSessionRecord } from '../../../src/core/storage/ChatHistoryDB';
import { clearLogs } from '../../../src/core/log/debugLog';

/**
 * IndexedDBMigrator suite — plan 02-02 Task 3 (D2-22 / D2-23 / D2-25).
 *
 * Seven named cases: fresh create, no-op reopen, the below-current open, the
 * deliberately failing step, the blocked/blocking pair (both sides observed),
 * and the test-only v1→v2 future-store fixture that proves a later phase can add
 * a store without editing the Phase 2 migration.
 *
 * The failure-injection case never throws from `upgrade`: it goes through
 * `__test__.setMigrationFailure`, so the abort is deliberate and the run output
 * carries no unhandled rejection (RESEARCH Pitfall 4).
 */

const CANONICAL_STORES = ['entries', 'errors', 'messages', 'sessions'];

function session(id: string): ChatSessionRecord {
  return { id, title: `Conversation ${id}`, created: 1_700_000_000_000, updated: 1_700_000_000_001, starred: false };
}

beforeEach(() => {
  (globalThis as unknown as { __resetIndexedDB: () => void }).__resetIndexedDB();
  clearLogs();
  __test__.reset();
  migratorTest.resetLastMigrationResult();
});

afterEach(() => {
  closeDb();
});

describe('IndexedDBMigrator — upgrade, abort, blocked/blocking and the future-store fixture', () => {
  it('applies the v1 migration exactly once on a fresh database', async () => {
    const db = await getDb();

    expect(getLastMigrationResult()).toEqual({ ok: true, applied: [1] });
    expect(Array.from(db.objectStoreNames).sort()).toEqual(CANONICAL_STORES);
  });

  it('a second open at the current version runs no migration and keeps the data', async () => {
    const db = await getDb();
    await db.put('sessions', session('s-kept'));
    closeDb();

    migratorTest.resetLastMigrationResult();
    const reopened = await getDb();

    // The upgrade callback did not run: nothing was recorded.
    expect(getLastMigrationResult()).toBeNull();
    expect(await reopened.get('sessions', 's-kept')).toEqual(session('s-kept'));
  });

  it('rejects a below-current open with a typed unsupported-version result and never retries', async () => {
    // Bring the stored schema to a newer version than this build knows.
    const future = await __test__.openWithVersion(DB_VERSION + 1);
    future.close();
    migratorTest.resetLastMigrationResult();

    await expect(getDb()).rejects.toBeInstanceOf(NowPilotDbOpenError);
    await expect(getDb()).rejects.toMatchObject({ code: 'IDB_UNSUPPORTED_VERSION' });

    expect(__test__.getObservability().permanentOpenFailure).toBe('IDB_UNSUPPORTED_VERSION');
    // Terminal: the retry never opened, so no migration ran a second time.
    expect(getLastMigrationResult()).toBeNull();
    expect(classifyOpenError(new DOMException('x', 'VersionError'))).toBe('IDB_UNSUPPORTED_VERSION');
  });

  it('records IDB_MIGRATION_FAILED and aborts the upgrade when a step fails, then retries deterministically', async () => {
    __test__.setMigrationFailure(() => {
      throw new Error('injected migration failure');
    });

    await expect(getDb()).rejects.toMatchObject({ code: 'IDB_MIGRATION_FAILED' });
    expect(getLastMigrationResult()).toEqual({ ok: false, code: 'IDB_MIGRATION_FAILED' });
    expect(classifyOpenError(new DOMException('x', 'AbortError'))).toBe('IDB_MIGRATION_FAILED');

    // A non-terminal failure is not cached: the retry succeeds and migrates.
    __test__.setMigrationFailure(null);
    const db = await getDb();

    expect(getLastMigrationResult()).toEqual({ ok: true, applied: [1] });
    expect(Array.from(db.objectStoreNames).sort()).toEqual(CANONICAL_STORES);
  });

  it('records the blocked signal while an older connection holds the database, and completes once it closes', async () => {
    await getDb();
    closeDb();

    // A raw older connection with no `versionchange` handler blocks the upgrade.
    const rawHolder = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const signals: BlockedOpenSignal[] = [];
    const blocked = new Promise<BlockedOpenSignal>((resolve) => {
      onBlockedOpen((signal) => {
        signals.push(signal);
        resolve(signal);
      });
    });

    const pending = __test__.openWithVersion(DB_VERSION + 1);
    const signal = await blocked;

    expect(signal.currentVersion).toBe(DB_VERSION);
    expect(signal.blockedVersion).toBe(DB_VERSION + 1);
    expect(__test__.getObservability().blocked).toEqual(signal);

    rawHolder.close();
    const requester = await pending;

    expect(requester.version).toBe(DB_VERSION + 1);
    expect(signals).toHaveLength(1);
    requester.close();
  });

  it('closes the older connection through the blocking callback so a newer version can proceed', async () => {
    const holder = await getDb();
    expect(holder.version).toBe(DB_VERSION);

    const requester = await __test__.openWithVersion(DB_VERSION + 1);

    expect(__test__.getObservability().versionChangeCloses).toBe(1);
    expect(requester.version).toBe(DB_VERSION + 1);

    // The holder released its handle, so the next open starts fresh and fails
    // closed against the newer stored schema (D2-25 close/recover).
    await expect(getDb()).rejects.toMatchObject({ code: 'IDB_UNSUPPORTED_VERSION' });

    requester.close();
  });

  it('the test-only v1→v2 fixture adds a store without editing the Phase 2 migration', async () => {
    const kept = session('s-fixture');

    // v1: the production migration table, with real data.
    const v1 = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, tx) {
        runMigrations(db, tx, oldVersion, newVersion).catch(() => undefined);
      },
    });
    await v1.put('sessions', kept);
    v1.close();

    // v2: the fixture table — the v1 entry is reused verbatim, not edited.
    const fixtureTable: IndexedDBMigration[] = [
      v1InitialPhase2Stores,
      {
        fromVersion: 1,
        toVersion: 2,
        description: 'fixture: a later phase adds a synthetic store',
        async migrate(db) {
          if (!db.objectStoreNames.contains('future_probe')) {
            db.createObjectStore('future_probe', { keyPath: 'id' });
          }
        },
      },
    ];

    const v2 = await openDB(DB_NAME, DB_VERSION + 1, {
      upgrade(db, oldVersion, newVersion, tx) {
        runMigrations(db, tx, oldVersion, newVersion, { migrations: fixtureTable }).catch(
          () => undefined,
        );
      },
    });

    // The synthetic store appears and every v1 store survives with its data.
    expect(Array.from(v2.objectStoreNames).sort()).toEqual([...CANONICAL_STORES, 'future_probe'].sort());
    const readTx = v2.transaction('sessions', 'readonly');
    const rows = await readTx.store.getAll();
    await readTx.done;
    expect(rows).toEqual([kept]);
    v2.close();

    // The production table is untouched and still has no v2 entry.
    expect(MIGRATIONS).toHaveLength(1);
    expect(MIGRATIONS[0]).toBe(v1InitialPhase2Stores);

    // A second open at v2 runs no migration at all.
    migratorTest.resetLastMigrationResult();
    const reopened = await openDB(DB_NAME, DB_VERSION + 1, {
      upgrade(db, oldVersion, newVersion, tx) {
        runMigrations(db, tx, oldVersion, newVersion, { migrations: fixtureTable }).catch(
          () => undefined,
        );
      },
    });
    expect(getLastMigrationResult()).toBeNull();
    reopened.close();
  });
});
