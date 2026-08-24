import { describe, it, expect, beforeEach } from 'vitest';
import { openDB } from 'idb';

/**
 * Phase-2 IndexedDB foundation: the shared versioning framework +
 * WriteJournalEntry type home (02-04 Plan, Task 1).
 *
 * Covers ROADMAP success criterion 4 (v1→v2 fixture):
 *   - Test 1: backward-compatible — a DB opened at v1 with data, then
 *     opened at v2 via the framework's migrations, retains the v1 data
 *     intact.
 *   - Test 2: idempotent — running the migration path twice is a no-op
 *     (no ConstraintError, no duplicate stores).
 *   - Test 3: fresh-open-at-v2 — a DB never opened before, opened
 *     directly at v2, has both the v1 and v2 stores/fields
 *     (conditional-block correctness).
 *   - Test 4: type fidelity — WriteJournalEntry carries
 *     id/operation/status/attempts/steps/createdAt with the locked
 *     status union.
 *
 * The fixture uses an in-test DB ('FixtureDB') + an in-test migration
 * pair (v1: create 'items' store; v2: create 'tags' store + an index on
 * items) — production DBs stay at v1 (D-42).
 */

describe('IndexedDBMigrator — v1→v2 fixture (ROADMAP criterion 4)', () => {
  beforeEach(() => {
    (globalThis as any).__resetIndexedDB();
  });

  it('Test 1 (backward-compatible): a v1-opened store retains data after upgrading to v2', async () => {
    const {
      openVersionedDB,
      registerMigration,
    } = await import('../../../src/core/storage/IndexedDBMigrator');

    // Step 1: open at v1, write fixture data
    {
      const db = await openVersionedDB('FixtureDB', 1);
      const tx = db.transaction('items', 'readwrite');
      await tx.objectStore('items').put({ id: 'item-1', name: 'first' });
      await tx.objectStore('items').put({ id: 'item-2', name: 'second' });
      await tx.done;
      db.close();
    }

    // Step 2: register a v1→v2 migration that creates 'tags' store + an index on 'items'
    registerMigration('FixtureDB', {
      fromVersion: 1,
      toVersion: 2,
      description: 'add tags store + index on items.name',
      migrate: (database) => {
        if (!database.objectStoreNames.contains('tags')) {
          database.createObjectStore('tags', { keyPath: 'id' });
        }
        const itemsStore = database.transaction('items').objectStore('items');
        if (!itemsStore.indexNames.contains('byName')) {
          itemsStore.createIndex('byName', 'name');
        }
      },
    });

    // Step 3: re-open at v2 → upgrade applies migration; original data is intact
    const dbV2 = await openVersionedDB('FixtureDB', 2);
    try {
      expect(dbV2.objectStoreNames.contains('items')).toBe(true);
      expect(dbV2.objectStoreNames.contains('tags')).toBe(true);

      const items = await dbV2.getAll('items');
      expect(items).toHaveLength(2);
      const names = items.map((i: any) => i.name).sort();
      expect(names).toEqual(['first', 'second']);

      // Index exists and is queryable
      const byName = dbV2.transaction('items').objectStore('items').index('byName');
      const hit = await byName.get('first');
      expect(hit).toBeDefined();
      expect((hit as any).id).toBe('item-1');
    } finally {
      dbV2.close();
    }
  });

  it('Test 2 (idempotent): opening the migrated DB twice does not throw or duplicate stores', async () => {
    const {
      openVersionedDB,
      registerMigration,
    } = await import('../../../src/core/storage/IndexedDBMigrator');

    registerMigration('FixtureDB', {
      fromVersion: 1,
      toVersion: 2,
      description: 'idempotent re-run probe',
      migrate: (database) => {
        if (!database.objectStoreNames.contains('tags')) {
          database.createObjectStore('tags', { keyPath: 'id' });
        }
      },
    });

    // Open at v2 twice — second open should be a no-op (idb fires upgrade only when
    // the version has never been opened; the framework must not re-run the migration
    // unconditionally).
    const first = await openVersionedDB('FixtureDB', 2);
    first.close();

    const second = await openVersionedDB('FixtureDB', 2);
    try {
      expect(second.objectStoreNames.contains('tags')).toBe(true);
      // 'tags' store must be a single store, not duplicated
      expect(Array.from(second.objectStoreNames)).toEqual(
        expect.arrayContaining(['tags']),
      );
    } finally {
      second.close();
    }
  });

  it('Test 3 (fresh-open-at-v2): a never-opened DB at v2 has both v1 and v2 stores (conditional-block correctness)', async () => {
    const {
      openVersionedDB,
      registerMigration,
    } = await import('../../../src/core/storage/IndexedDBMigrator');

    registerMigration('FixtureDB', {
      fromVersion: 1,
      toVersion: 2,
      description: 'v1+v2 fresh-open probe',
      migrate: (database, oldVersion) => {
        // Conditional blocks per spec §20.4 / Pitfall 8
        if (oldVersion < 1) {
          database.createObjectStore('items', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          database.createObjectStore('tags', { keyPath: 'id' });
        }
      },
    });

    // Fresh open at v2 — never opened before. Both v1 and v2 stores must exist.
    const db = await openVersionedDB('FixtureDB', 2);
    try {
      expect(db.objectStoreNames.contains('items')).toBe(true);
      expect(db.objectStoreNames.contains('tags')).toBe(true);
    } finally {
      db.close();
    }
  });

  it('Test 4 (type fidelity): WriteJournalEntry carries id/operation/status/attempts/steps/createdAt with the locked status union', async () => {
    const { WriteJournalEntrySchema } = await import('../../../src/types/storage');

    // Status union is locked at 'pending' | 'applying' | 'completed' | 'rolled-back'
    const sample = {
      id: 'op-123',
      operation: 'update-workspace',
      status: 'pending' as const,
      attempts: 0,
      steps: [] as { name: string; status: 'completed' | 'rolled-back' }[],
      createdAt: Date.now(),
    };

    expect(() => WriteJournalEntrySchema.parse(sample)).not.toThrow();
    const parsed = WriteJournalEntrySchema.parse(sample);
    expect(parsed.id).toBe('op-123');
    expect(parsed.status).toBe('pending');
    expect(parsed.attempts).toBe(0);
    expect(parsed.createdAt).toBe(sample.createdAt);

    // Negative case: invalid status must be rejected
    expect(() =>
      WriteJournalEntrySchema.parse({ ...sample, status: 'invalid' }),
    ).toThrow();
  });
});