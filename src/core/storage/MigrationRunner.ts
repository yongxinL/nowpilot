import { openDB, type IDBPDatabase } from 'idb';

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
    transaction: IDBTransaction,
  ): void {
    const store = transaction.objectStore('entries');
    if (!store.indexNames.contains('by-operation')) {
      store.createIndex('by-operation', 'operation');
    }
  }

  private async migrateV4(
    transaction: IDBTransaction,
  ): Promise<void> {
    const db = (transaction as any).db as IDBPDatabase;

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
