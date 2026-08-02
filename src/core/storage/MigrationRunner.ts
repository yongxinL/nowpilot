import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';

/** The transaction handed to the idb `upgrade` callback. */
type VersionChangeTransaction = IDBPTransaction<unknown, string[], 'versionchange'>;

/**
 * MigrationRunner orchestrates idb versioned upgrades with step isolation
 * and idempotency guards. Each version step uses `oldVersion < N` guards
 * so only the steps needed for the current upgrade path execute.
 */
export class MigrationRunner {
  /**
   * Migrate a database to the target version.
   * Idempotent: running with the same target version twice is a no-op
   * (existing stores/indexes are checked before creation).
   */
  async migrate(dbName: string, targetVersion: number): Promise<void> {
    const db = await openDB(dbName, targetVersion, {
      upgrade: async (db, oldVersion, _newVersion, transaction) => {
        if (oldVersion < 1) {
          this.createV1Schema(db);
        }
        if (oldVersion < 2) {
          this.createV2Schema(db);
        }
        if (oldVersion < 3) {
          this.createV3Schema(transaction);
        }
        if (oldVersion < 4) {
          await this.migrateV4(transaction);
        }
        if (oldVersion < 5) {
          await this.migrateV5(transaction);
        }
      },
      blocked: () => {
        console.warn(`${dbName} upgrade blocked by another connection`);
      },
      blocking: () => {
        db.close();
      },
    });
    // Close the connection after migration so tests can reopen at lower versions
    db.close();
  }

  private createV1Schema(db: IDBPDatabase): void {
    if (!db.objectStoreNames.contains('entries')) {
      const store = db.createObjectStore('entries', { keyPath: 'id' });
      store.createIndex('by-status', 'status');
    }
  }

  private createV2Schema(db: IDBPDatabase): void {
    if (!db.objectStoreNames.contains('auditLog')) {
      db.createObjectStore('auditLog', { keyPath: 'id', autoIncrement: true });
    }
  }

  private createV3Schema(
    transaction: VersionChangeTransaction,
  ): void {
    const store = transaction.objectStore('entries');
    if (!store.indexNames.contains('by-operation')) {
      store.createIndex('by-operation', 'operation');
    }
  }

  private async migrateV4(
    transaction: VersionChangeTransaction,
  ): Promise<void> {
    const db = transaction.db;

    // Create the 'migrated' store if it doesn't exist
    if (!db.objectStoreNames.contains('migrated')) {
      db.createObjectStore('migrated', { keyPath: 'id' });
    }

    // Data migration: read all entries from old store and copy to new store
    const oldStore = transaction.objectStore('entries');
    const migratedStore = transaction.objectStore('migrated');

    const allEntries = await oldStore.getAll();
    for (const entry of allEntries) {
      // Transform: copy entry data with any needed field changes
      const migratedEntry = {
        id: entry.id,
        operation: entry.operation,
        status: entry.status,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        attempts: entry.attempts,
        targetIds: entry.targetIds,
        steps: entry.steps,
        // Mark as migrated for provenance
        migratedAt: Date.now(),
      };
      await migratedStore.put(migratedEntry);
    }

    // ── NotesDB schema (Phase 5) ───────────────────────────────────────────
    // notes store: atomic notes with by-title / by-updated / by-tag indexes
    if (!db.objectStoreNames.contains('notes')) {
      const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
      notesStore.createIndex('by-title', 'title');
      notesStore.createIndex('by-updated', 'updatedAt');
      notesStore.createIndex('by-tag', 'tags', { multiEntry: true });
    }

    // concepts store: schema-only in Phase 5 (D-14), populated by Phase 5a
    if (!db.objectStoreNames.contains('concepts')) {
      const conceptsStore = db.createObjectStore('concepts', { keyPath: 'slug' });
      conceptsStore.createIndex('by-noteId', 'noteIds', { multiEntry: true });
    }

    // index store: serialized MiniSearch JSON blob (RESEARCH §Pattern 3)
    if (!db.objectStoreNames.contains('index')) {
      db.createObjectStore('index', { keyPath: 'id' });
    }

    // ── MemoryDB schema (Phase 5) — schema-only skeletons ─────────────────
    // Populated by MemoryEngine in Plan 05-02.
    if (!db.objectStoreNames.contains('memory_messages')) {
      // Compound key: messages are scoped per conversation in seq order
      db.createObjectStore('memory_messages', { keyPath: ['conversationId', 'seq'] });
    }

    if (!db.objectStoreNames.contains('user_facts')) {
      const factsStore = db.createObjectStore('user_facts', { keyPath: 'id' });
      factsStore.createIndex('by-tag', 'tags', { multiEntry: true });
      factsStore.createIndex('by-confidence', 'confidence');
    }

    if (!db.objectStoreNames.contains('conversation_summaries')) {
      db.createObjectStore('conversation_summaries', { keyPath: 'conversationId' });
    }
  }

  /**
   * Phase 5a (D-09): backup_config store for the persisted
   * FileSystemDirectoryHandle. Holds exactly one record keyed by `id`
   * (the `'backup_folder'` handle survives extension restarts via
   * IndexedDB's structured clone).
   */
  private async migrateV5(
    transaction: VersionChangeTransaction,
  ): Promise<void> {
    const db = transaction.db;

    if (!db.objectStoreNames.contains('backup_config')) {
      db.createObjectStore('backup_config', { keyPath: 'id' });
    }
  }
}

/**
 * Reset a database for test isolation: close all connections and delete.
 */
export async function resetMigrationDb(dbName: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // Force close
  });
}

export const migrationRunner = new MigrationRunner();
