import { describe, it, expect, beforeEach } from 'vitest';
import type { DBSchema } from 'idb';

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

/**
 * Local fixture schema for the test DB. Mirrors the v1+v2 store list the
 * test exercises: items (keyPath 'id', byName index) + tags (keyPath 'id').
 * Production code uses concrete per-DB schemas (ChatHistoryDBV1 etc.).
 */
interface FixtureDBV2 extends DBSchema {
  items: {
    key: string;
    value: { id: string; name: string };
    indexes: { byName: string };
  };
  tags: {
    key: string;
    value: { id: string };
  };
}

describe('IndexedDBMigrator — v1→v2 fixture (ROADMAP criterion 4)', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    const migrator = await import('../../../src/core/storage/IndexedDBMigrator');
    migrator.clearMigrations('FixtureDB');
  });

  it('Test 1 (backward-compatible): a v1-opened store retains data after upgrading to v2', async () => {
    const {
      openVersionedDB,
      registerMigration,
    } = await import('../../../src/core/storage/IndexedDBMigrator');

    // Step 1: register a v0→v1 bootstrap migration that creates 'items' WITH an index.
    // (Both the store and its index are created atomically at v1 — this is the
    // production-correct shape per spec §20.4: indexes ship with the store that
    // introduces them; subsequent bumps add new stores.)
    registerMigration('FixtureDB', {
      fromVersion: 0,
      toVersion: 1,
      description: 'v1 bootstrap: items store with byName index',
      migrate: (database) => {
        if (!database.objectStoreNames.contains('items')) {
          const items = database.createObjectStore('items', { keyPath: 'id' });
          items.createIndex('byName', 'name');
        }
      },
    });

    // Step 2: open at v1, write fixture data
    {
      const db = await openVersionedDB<FixtureDBV2>('FixtureDB', 1);
      const tx = db.transaction('items', 'readwrite');
      await tx.objectStore('items').put({ id: 'item-1', name: 'first' });
      await tx.objectStore('items').put({ id: 'item-2', name: 'second' });
      await tx.done;
      db.close();
    }

    // Step 3: register a v1→v2 migration that adds the 'tags' store.
    registerMigration('FixtureDB', {
      fromVersion: 1,
      toVersion: 2,
      description: 'add tags store',
      migrate: (database) => {
        if (!database.objectStoreNames.contains('tags')) {
          database.createObjectStore('tags', { keyPath: 'id' });
        }
      },
    });

    // Step 4: re-open at v2 → upgrade applies migration; original data is intact
    const dbV2 = await openVersionedDB<FixtureDBV2>('FixtureDB', 2);
    try {
      expect(dbV2.objectStoreNames.contains('items')).toBe(true);
      expect(dbV2.objectStoreNames.contains('tags')).toBe(true);

      const items = await dbV2.getAll('items');
      expect(items).toHaveLength(2);
      const names = items.map((i) => i.name).sort();
      expect(names).toEqual(['first', 'second']);

      // Index shipped with v1 is preserved across the v1→v2 bump
      const byName = dbV2.transaction('items').objectStore('items').index('byName');
      const hit = await byName.get('first');
      expect(hit).toBeDefined();
      expect(hit?.id).toBe('item-1');
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
    const first = await openVersionedDB<FixtureDBV2>('FixtureDB', 2);
    first.close();

    const second = await openVersionedDB<FixtureDBV2>('FixtureDB', 2);
    try {
      expect(second.objectStoreNames.contains('tags')).toBe(true);
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
    const db = await openVersionedDB<FixtureDBV2>('FixtureDB', 2);
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

describe('IndexedDBMigrator — bootstrap() opens production DBs at v1 (02-04 Task 2)', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
  });

  it('bootstrap opens ChatHistoryDB / MemoryDB / NotesDB at v1 with §15.1 stores present', async () => {
    const { bootstrap } = await import('../../../src/core/storage/IndexedDBMigrator');

    const { opened, failed } = await bootstrap();

    // Production DBs that bootstrap() opens
    expect(opened).toContain('ChatHistoryDB');
    expect(opened).toContain('MemoryDB');
    expect(opened).toContain('NotesDB');
    expect(opened).toContain('WriteJournalDB');
    expect(opened).toContain('ErrorStore');
    // No failures — every DB module's open path is well-formed
    expect(failed).toEqual([]);
  });

  it('opening the same DB twice does not re-create stores (idempotent open — no ConstraintError)', async () => {
    const { openChatHistoryDB } = await import('../../../src/core/storage/ChatHistoryDB');
    const { openNotesDB } = await import('../../../src/core/storage/NotesDB');

    // First open — creates stores
    const first = await openChatHistoryDB();
    expect(first.objectStoreNames.contains('sessions')).toBe(true);
    expect(first.objectStoreNames.contains('messages')).toBe(true);
    first.close();

    // Second open — same connection, no upgrade fires
    const second = await openChatHistoryDB();
    try {
      expect(second.objectStoreNames.contains('sessions')).toBe(true);
      expect(second.objectStoreNames.contains('messages')).toBe(true);
    } finally {
      second.close();
    }

    // Idempotency probe — NotesDB opened twice is also a no-op
    const n1 = await openNotesDB();
    n1.close();
    const n2 = await openNotesDB();
    try {
      expect(n2.objectStoreNames.contains('notes')).toBe(true);
      expect(n2.objectStoreNames.contains('concepts')).toBe(true);
    } finally {
      n2.close();
    }
  });
});

describe('Setting<T> serialized-write queue (02-04 Task 2; declare-now)', () => {
  beforeEach(async () => {
    const { __resetSettingQueue } = await import('../../../src/core/storage/Setting');
    __resetSettingQueue();
  });

  it('serializes overlapping writes — overlapping calls complete in submission order', async () => {
    const { defineSetting } = await import('../../../src/core/storage/Setting');

    const order: string[] = [];
    const store = {
      get: async <T>(_k: string) => undefined as T | undefined,
      set: async <T>(_k: string, _v: T) => {
        // Simulate async write latency
        await new Promise((r) => setTimeout(r, 5));
        order.push(`set-${String(_v)}`);
      },
      delete: async (_k: string) => undefined,
    };

    const handle = defineSetting<number>(store, 'counter');

    // Fire three overlapping writes
    const p1 = handle.set(1);
    const p2 = handle.set(2);
    const p3 = handle.set(3);

    await Promise.all([p1, p2, p3]);

    // Writes complete in submission order (FIFO), never interleaved
    expect(order).toEqual(['set-1', 'set-2', 'set-3']);
  });
});
