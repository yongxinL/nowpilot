import { debugLog } from '../utils/debugLog';
import type { IDBPDatabase } from 'idb';
import type { NowPilotDB } from './IndexedDBManager';

export interface IndexedDBMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(
    db: IDBPDatabase<NowPilotDB>,
    oldVersion: number,
    newVersion: number,
  ): Promise<void>;
}

export class IndexedDBMigrator {
  private migrations = new Map<number, IndexedDBMigration>();

  register(migration: IndexedDBMigration): void {
    if (this.migrations.has(migration.toVersion)) {
      throw new Error(
        `Migration for version ${migration.toVersion} is already registered`,
      );
    }
    this.migrations.set(migration.toVersion, migration);
  }

  getMigrationsBetween(
    fromVersion: number,
    toVersion: number,
  ): IndexedDBMigration[] {
    return Array.from(this.migrations.values())
      .filter(
        (m) => m.toVersion > fromVersion && m.toVersion <= toVersion,
      )
      .sort((a, b) => a.toVersion - b.toVersion);
  }

  getAllMigrations(): IndexedDBMigration[] {
    return Array.from(this.migrations.values()).sort(
      (a, b) => a.toVersion - b.toVersion,
    );
  }

  async boot(): Promise<void> {
    debugLog('info', 'IndexedDBMigrator: boot started');
  }
}

export const indexedDBMigrator = new IndexedDBMigrator();
