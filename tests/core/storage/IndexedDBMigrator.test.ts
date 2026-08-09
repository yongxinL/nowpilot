// tests/core/storage/IndexedDBMigrator.test.ts — D-13 synthetic v1→v2 fixture
// (add-store + add-index + data-carry + idempotency + throws→degraded) + the
// D-12 degraded-mode contract + the Pitfall-3 original-error capture + the D-12
// IDB_MIGRATION_FAILED ErrorStore sink. Built on the buildMigrationFixture
// builder from 02-01 (D-20/21: the SAME deterministic builder the integration
// path uses). Runs in the default jsdom-align environment with a fresh
// IDBFactory per test (RESEARCH Pattern 8).
//
// THE LANDMINE REGRESSION GUARD (RESEARCH Pitfall 1, T-2-06-01): this file
// exercises the raw-open migrator — NEVER idb openDB with a throwing upgrade.
// A leaked unhandled rejection from the failure path would make `vitest run`
// exit non-zero; this suite passing green IS the exit-0 proof.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { openDB, unwrap, type DBSchema } from 'idb';
import { buildMigrationFixture, type LegacyRow } from '../../fixtures/index';
import {
  assertWritable,
  DegradedDBError,
  getDegradedDbs,
  isDbDegraded,
  runMigrations,
  type DBVersionMigration,
  type IndexedDBMigration,
} from '@/core/storage/IndexedDBMigrator';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { getErrors } from '@/core/storage/ErrorStore';

/** The fixture DB schema — v1 'legacy' + v2 'notes_v2' (fixture expectedV2). */
interface MigrationDBSchema extends DBSchema {
  legacy: { key: string; value: LegacyRow; indexes: { by_title: string } };
  notes_v2: { key: string; value: LegacyRow };
}

/** Seed a v1 DB with the fixture's initial 'legacy' store + rows (raw open at version 1). */
function seedV1(dbName: string, rows: LegacyRow[] = buildMigrationFixture().v1Rows): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('legacy', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('legacy', 'readwrite');
      for (const row of rows) tx.objectStore('legacy').put(row);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * The D-13 v1→v2 migration: add-store + add-index + data-carry. Data-carry via
 * RAW IDBRequest chaining on the unwrapped upgrade tx (RESEARCH Pattern 2 —
 * verified): awaiting inside the upgrade callback would close the transaction
 * (Pitfall 2). The runner dispatches it synchronously.
 */
function buildV1ToV2Migration(
  fixture: ReturnType<typeof buildMigrationFixture>,
): IndexedDBMigration {
  return {
    fromVersion: 1,
    toVersion: 2,
    description: 'synthetic v1→v2 fixture (D-13): add-store + add-index + data-carry',
    migrate(db, tx) {
      db.createObjectStore(fixture.expectedV2.addStore, { keyPath: 'id' });
      const rawTx = unwrap(tx);
      rawTx
        .objectStore(fixture.expectedV2.addIndex.store)
        .createIndex(fixture.expectedV2.addIndex.name, fixture.expectedV2.addIndex.keyPath);
      const rowsRequest = rawTx.objectStore(fixture.expectedV2.addIndex.store).getAll();
      rowsRequest.onsuccess = () => {
        const target = rawTx.objectStore(fixture.expectedV2.addStore);
        for (const row of rowsRequest.result) target.put(row);
      };
      return Promise.resolve();
    },
  };
}

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  indexedDB = new IDBFactory(); // RESEARCH Pattern 8: fresh IndexedDB per test
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe('IndexedDBMigrator — synthetic v1→v2 (D-13 fixture)', () => {
  it('migrates v1 → v2: adds a store, adds an index, and carries the fixture rows', async () => {
    const fixture = buildMigrationFixture();
    await seedV1(fixture.dbName);
    // fixture fields are plain strings — pin them to the typed schema names
    const addStore = fixture.expectedV2.addStore as 'notes_v2';
    const legacyStore = fixture.expectedV2.addIndex.store as 'legacy';
    const byTitleIndex = fixture.expectedV2.addIndex.name as 'by_title';

    const db = await runMigrations<MigrationDBSchema>({
      dbName: fixture.dbName,
      dbVersion: 2,
      migrations: [buildV1ToV2Migration(fixture)],
    });

    expect(db.version).toBe(2);
    // the added store exists
    expect(db.objectStoreNames.contains(addStore)).toBe(true);
    // carried rows are readable (data survives the transition)
    const carried = await db.getAll(addStore);
    expect(carried.map((row) => row.id).sort()).toEqual([...fixture.expectedV2.carriedIds].sort());
    expect(carried.map((row) => row.title).sort()).toEqual(['second', 'survivor']);
    // the added index exists and works (by_title on the legacy store)
    const byTitle = await db.getAllFromIndex(legacyStore, byTitleIndex, 'survivor');
    expect(byTitle).toHaveLength(1);
    expect(byTitle[0].id).toBe('r1');
    // original rows still intact in the legacy store
    const legacy = await db.getAll('legacy');
    expect(legacy).toHaveLength(2);
    db.close();
  });

  it('is idempotent: re-running the runner at the target version is a no-op', async () => {
    const fixture = buildMigrationFixture();
    await seedV1(fixture.dbName);
    const spec = {
      dbName: fixture.dbName,
      dbVersion: 2,
      migrations: [buildV1ToV2Migration(fixture)],
    };

    const first = await runMigrations<MigrationDBSchema>(spec);
    expect(first.version).toBe(2);
    first.close();

    const second = await runMigrations<MigrationDBSchema>(spec);
    expect(second.version).toBe(2); // no version bump
    expect(second.objectStoreNames.contains(fixture.expectedV2.addStore as 'notes_v2')).toBe(true);
    const carried = await second.getAll(fixture.expectedV2.addStore as 'notes_v2');
    expect(carried).toHaveLength(2); // no double-store
    second.close();
  });
});

describe('IndexedDBMigrator — throws→degraded (D-12)', () => {
  function throwingSpec(dbName: string): DBVersionMigration {
    return {
      dbName,
      dbVersion: 2,
      migrations: [
        {
          fromVersion: 1,
          toVersion: 2,
          description: 'throws on purpose (D-12 failure path)',
          migrate() {
            throw new Error('boom');
          },
        },
      ],
    };
  }

  it('rejects with an AbortError, keeps the DB read-only at v(n-1), data intact, writes blocked', async () => {
    const fixture = buildMigrationFixture();
    await seedV1('fixture-throws-db', fixture.v1Rows);

    let rejection: unknown = null;
    try {
      await runMigrations(throwingSpec('fixture-throws-db'));
    } catch (err) {
      rejection = err;
    }
    expect((rejection as DOMException).name).toBe('AbortError');

    // D-12 degraded mode: module-level state + typed write-block gate
    expect(isDbDegraded('fixture-throws-db')).toBe(true);
    expect(getDegradedDbs().some((d) => d.db === 'fixture-throws-db' && d.reason === 'boom')).toBe(
      true,
    );
    expect(() => assertWritable('fixture-throws-db')).toThrow(DegradedDBError);

    // atomic rollback: version stays v(n-1), reads still work, data intact
    const reopened = await openDB<MigrationDBSchema>('fixture-throws-db');
    expect(reopened.version).toBe(1);
    const survivor = await reopened.get('legacy', 'r1');
    expect(survivor?.title).toBe('survivor');
    expect(survivor?.body).toBe('carried row one');
    reopened.close();
  });

  it('passes the ORIGINAL migration error — not the swallowed AbortError — to the callback (Pitfall 3)', async () => {
    await seedV1('fixture-callback-db');
    const handler = vi.fn(async (_dbName: string, _cause: unknown) => {});

    let rejection: unknown = null;
    try {
      await runMigrations(throwingSpec('fixture-callback-db'), handler);
    } catch (err) {
      rejection = err;
    }
    expect((rejection as DOMException).name).toBe('AbortError');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBe('fixture-callback-db');
    expect((handler.mock.calls[0][1] as Error).message).toBe('boom'); // original cause, not AbortError
  });

  it('the default failure handler records IDB_MIGRATION_FAILED in ErrorStore (D-12 sink)', async () => {
    await seedV1('fixture-sink-db');

    try {
      await runMigrations(throwingSpec('fixture-sink-db'));
    } catch {
      /* expected AbortError */
    }

    // The runner awaits onMigrationFailed before rejecting, so the entry exists.
    const errors = await getErrors();
    const entry = errors.find(
      (e) => e.code === ERROR_CODES.IDB_MIGRATION_FAILED && e.message.includes('fixture-sink-db'),
    );
    expect(entry).toBeDefined();
    expect(entry?.message).toContain('boom'); // the ORIGINAL cause, not the generic AbortError
  });
});
