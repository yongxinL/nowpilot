import { openDB, type IDBPDatabase } from 'idb';
import { migrationRunner } from '../storage/MigrationRunner';
import { MemoryRecordSchema, type MemoryRecord } from './MemoryRecord';
import type { MemoryWriteResult } from './types';

// ── Database connection (WriteJournal pattern: module-level cached promise) ──

let dbPromise: Promise<IDBPDatabase> | null = null;

async function openMemoryDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    await migrationRunner.migrate('NotesDB', 4);
    dbPromise = openDB('NotesDB', 4);
  }
  return dbPromise;
}

/**
 * Close this module's connection. Used by tests before deleting the DB.
 */
export async function resetPreferenceMemoryDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

/**
 * PreferenceMemoryStore — behavioral settings + persona config (D-05:
 * preferences only via explicit user settings/confirmation).
 *
 * Preferences are stored as MemoryRecords with memoryType='preference' in
 * the shared `user_facts` store (keyPath id). Each preference's content is
 * JSON.stringify({ key, value }). Persona config (`np_persona`) lives here,
 * never in UserMemoryStore (locked R2 reconciliation decision).
 */
export class PreferenceMemoryStore {
  private async readAllRecords(): Promise<MemoryRecord[]> {
    const db = await openMemoryDb();
    const all = await db.getAll('user_facts');
    return all.filter((r) => r.memoryType === 'preference') as MemoryRecord[];
  }

  /** Find the stored record for a preference key (parses JSON content). */
  private findRecord(records: MemoryRecord[], key: string): MemoryRecord | null {
    for (const record of records) {
      try {
        const parsed = JSON.parse(record.content) as { key?: unknown };
        if (parsed && parsed.key === key) return record;
      } catch {
        // malformed content — skip
      }
    }
    return null;
  }

  /** Read one preference value, or null when not set. */
  async get(key: string): Promise<unknown | null> {
    const records = await this.readAllRecords();
    const record = this.findRecord(records, key);
    if (!record) return null;
    try {
      const parsed = JSON.parse(record.content) as { value?: unknown };
      return parsed.value ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Upsert a preference (explicit-user source, immutable confidence 1.0).
   * Re-uses the existing record's id/createdAt when the key is already set.
   */
  async set(key: string, value: unknown): Promise<MemoryWriteResult> {
    const existing = this.findRecord(await this.readAllRecords(), key);
    const now = Date.now();

    const record: MemoryRecord = {
      id: existing ? existing.id : crypto.randomUUID(),
      content: JSON.stringify({ key, value }),
      memoryType: 'preference',
      tags: ['preference', key],
      confidence: 1.0, // explicit user setting (D-07)
      source: 'explicit-user',
      useCount: existing ? existing.useCount : 0,
      sensitivity: 'private',
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    let parsed: MemoryRecord;
    try {
      parsed = MemoryRecordSchema.parse(record);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        code: 'VALIDATION_ERROR',
      };
    }

    try {
      const db = await openMemoryDb();
      await db.put('user_facts', parsed);
      return { success: true, recordId: record.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        code: 'DB_ERROR',
      };
    }
  }

  /** All preferences as a { [key]: value } record. */
  async getAll(): Promise<Record<string, unknown>> {
    const records = await this.readAllRecords();
    const result: Record<string, unknown> = {};
    for (const record of records) {
      try {
        const parsed = JSON.parse(record.content) as { key?: string; value?: unknown };
        if (parsed && typeof parsed.key === 'string') {
          result[parsed.key] = parsed.value;
        }
      } catch {
        // malformed content — skip
      }
    }
    return result;
  }

  /** Convenience accessor for the persona configuration. */
  async getPersona(): Promise<Record<string, unknown> | null> {
    const value = await this.get('np_persona');
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }
}
