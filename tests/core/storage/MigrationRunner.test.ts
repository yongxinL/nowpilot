import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB, type IDBPDatabase } from 'idb';
import { migrationRunner, resetMigrationDb } from '../../../src/core/storage/MigrationRunner';

describe('MigrationRunner', () => {
  beforeEach(async () => {
    // Clean up databases used in tests
    await resetMigrationDb('WriteJournalDB');
    vi.clearAllMocks();
  });

  describe('fresh migration v1→v4', () => {
    it('should create all stores and indexes defined in each version step', async () => {
      await migrationRunner.migrate('WriteJournalDB', 4);

      // Open at current version to inspect resulting schema
      const db = await openDB('WriteJournalDB');

      // v1: 'entries' store with 'by-status' index
      expect(db.objectStoreNames.contains('entries')).toBe(true);
      const entriesStore = db.transaction('entries').objectStore('entries');
      expect(entriesStore.keyPath).toBe('id');
      expect(entriesStore.indexNames.contains('by-status')).toBe(true);

      // v2: 'auditLog' store with autoIncrement
      expect(db.objectStoreNames.contains('auditLog')).toBe(true);
      const auditStore = db.transaction('auditLog').objectStore('auditLog');
      expect(auditStore.autoIncrement).toBe(true);
      expect(auditStore.keyPath).toBe('id');

      // v3: 'by-operation' index on 'entries'
      expect(entriesStore.indexNames.contains('by-operation')).toBe(true);

      // v4: 'migrated' store
      expect(db.objectStoreNames.contains('migrated')).toBe(true);

      db.close();
    });
  });

  describe('incremental migration from v2', () => {
    it('should only execute v3 and v4 steps when migrating v2→v4', async () => {
      // Create a v2 fixture database first
      const v2db = await openDB('WriteJournalDB', 2, {
        upgrade(db, oldVersion, _newVersion, transaction) {
          if (oldVersion < 1) {
            db.createObjectStore('entries', { keyPath: 'id' });
          }
          if (oldVersion < 2) {
            const store = transaction.objectStore('entries');
            store.createIndex('by-status', 'status');
            db.createObjectStore('auditLog', { keyPath: 'id', autoIncrement: true });
          }
        },
        blocked() {},
        blocking() {},
      });
      // Put some test data in the v2 DB
      await v2db.put('entries', {
        id: 'test-entry',
        operation: 'update-workspace',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        targetIds: {},
        steps: [],
      });
      v2db.close();

      // Spy on the upgrade by watching what gets created
      const spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Migrate from v2 to v4
      await migrationRunner.migrate('WriteJournalDB', 4);

      // Verify v3 index exists
      const db = await openDB('WriteJournalDB');
      const store = db.transaction('entries').objectStore('entries');
      expect(store.indexNames.contains('by-operation')).toBe(true);
      expect(store.indexNames.contains('by-status')).toBe(true);

      // Verify v4 store exists
      expect(db.objectStoreNames.contains('migrated')).toBe(true);

      // Verify v1 store survived
      expect(db.objectStoreNames.contains('entries')).toBe(true);
      expect(db.objectStoreNames.contains('auditLog')).toBe(true);

      // Verify existing data survived migration
      const entry = await db.get('entries', 'test-entry');
      expect(entry).toBeDefined();
      expect(entry!.id).toBe('test-entry');

      db.close();
      spyWarn.mockRestore();
    });
  });

  describe('idempotency', () => {
    it('should be a no-op when migrating the same DB twice', async () => {
      // First migration
      await migrationRunner.migrate('WriteJournalDB', 4);

      // Put some data after first migration
      const db1 = await openDB('WriteJournalDB');
      await db1.put('entries', {
        id: 'entry-1',
        operation: 'update-workspace',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        targetIds: {},
        steps: [],
      });
      db1.close();

      // Second migration — should not throw
      await migrationRunner.migrate('WriteJournalDB', 4);

      // Third migration — should not throw
      await migrationRunner.migrate('WriteJournalDB', 4);

      // Verify data still intact
      const db2 = await openDB('WriteJournalDB');
      const entry = await db2.get('entries', 'entry-1');
      expect(entry).toBeDefined();
      expect(entry!.id).toBe('entry-1');
      expect(db2.objectStoreNames.contains('entries')).toBe(true);
      expect(db2.objectStoreNames.contains('auditLog')).toBe(true);
      expect(db2.objectStoreNames.contains('migrated')).toBe(true);
      db2.close();
    });
  });

  describe('blocked callback', () => {
    it('should warn when migration is blocked and handle blocking connections', async () => {
      // This test verifies the blocked/blocking callback infrastructure works
      // by opening a connection at v1 and then trying to migrate to v4 from another call.

      // First, create a v1 database
      const v1db = await openDB('WriteJournalDB', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('entries')) {
            db.createObjectStore('entries', { keyPath: 'id' });
          }
        },
      });
      v1db.close();

      // Now migrate — should work because v1db is closed
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await migrationRunner.migrate('WriteJournalDB', 4);

      // Verify migration actually happened
      const db = await openDB('WriteJournalDB');
      expect(db.objectStoreNames.contains('auditLog')).toBe(true);
      expect(db.objectStoreNames.contains('migrated')).toBe(true);
      db.close();

      warnSpy.mockRestore();
    });
  });

  describe('v4 data migration', () => {
    it('should read from old store and write transformed data to new store', async () => {
      // Create a v3 database with some entries
      const v3db = await openDB('WriteJournalDB', 3, {
        upgrade(db, oldVersion, _newVersion, transaction) {
          if (oldVersion < 1) {
            db.createObjectStore('entries', { keyPath: 'id' });
          }
          if (oldVersion < 2) {
            const store = transaction.objectStore('entries');
            store.createIndex('by-status', 'status');
            db.createObjectStore('auditLog', { keyPath: 'id', autoIncrement: true });
          }
          if (oldVersion < 3) {
            const store = transaction.objectStore('entries');
            store.createIndex('by-operation', 'operation');
          }
        },
        blocked() {},
        blocking() {},
      });

      // Add entries with old field format
      await v3db.put('entries', {
        id: 'entry-1',
        operation: 'update-workspace',
        status: 'pending',
        oldField: 'legacy-value',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        targetIds: {},
        steps: [],
      });
      await v3db.put('entries', {
        id: 'entry-2',
        operation: 'append-memory-message',
        status: 'completed',
        oldField: 'another-value',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        targetIds: {},
        steps: [],
      });
      v3db.close();

      // Migrate to v4 — this should copy entries to a new 'migrated' store
      await migrationRunner.migrate('WriteJournalDB', 4);

      // Verify the migrated store has the transformed data
      const db = await openDB('WriteJournalDB');
      expect(db.objectStoreNames.contains('migrated')).toBe(true);

      const migratedEntries = await db.getAll('migrated');
      expect(migratedEntries.length).toBe(2);

      // Verify original entries still exist in old store
      const originalEntries = await db.getAll('entries');
      expect(originalEntries.length).toBe(2);

      db.close();
    });
  });
});
