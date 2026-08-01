import { openDB, type IDBPDatabase } from 'idb';
import { migrationRunner } from '../storage/MigrationRunner';
import {
  UserMemoryFactSchema,
  CONFIDENCE_MAP,
  type ConfidenceSource,
  type UserMemoryFact,
} from './MemoryRecord';
import type { MemoryWriteResult } from './types';

/**
 * Input to upsert: everything except the derived fields. `id` is optional —
 * a UUID is generated when absent. `confidence` is derived from `source` via
 * the D-07 CONFIDENCE_MAP and is immutable after creation.
 */
export type UserFactUpsertInput = Omit<
  UserMemoryFact,
  'id' | 'confidence' | 'createdAt' | 'updatedAt' | 'useCount'
> & { id?: string; source: ConfidenceSource };

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
export async function resetUserMemoryDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

/**
 * UserMemoryStore — persistent cross-session user facts (MEM-01).
 * Records live in the `user_facts` store (keyPath id, by-tag / by-confidence
 * indexes). Confidence is assigned ONCE from the D-07 source mapping and is
 * never modified afterwards — useCount is the only retrieval-frequency
 * counter (D-07).
 */
export class UserMemoryStore {
  /**
   * Insert or update a fact. Generates a UUID when no id is given; derives
   * confidence from `source` via CONFIDENCE_MAP on creation; on update keeps
   * the original confidence (immutable), createdAt, and useCount.
   */
  async upsert(input: UserFactUpsertInput): Promise<MemoryWriteResult> {
    const id = input.id ?? crypto.randomUUID();
    const existing = await this.get(id);
    const now = Date.now();

    const record: UserMemoryFact = {
      ...input,
      id,
      confidence: existing ? existing.confidence : CONFIDENCE_MAP[input.source],
      useCount: existing ? existing.useCount : 0,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    let parsed: UserMemoryFact;
    try {
      parsed = UserMemoryFactSchema.parse(record);
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
      return { success: true, recordId: id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        code: 'DB_ERROR',
      };
    }
  }

  /** All stored records (facts and preference records share the store). */
  async getAll(): Promise<UserMemoryFact[]> {
    const db = await openMemoryDb();
    return (await db.getAll('user_facts')) as UserMemoryFact[];
  }

  /** Fetch one record by id, or null. */
  async get(id: string): Promise<UserMemoryFact | null> {
    const db = await openMemoryDb();
    const record = await db.get('user_facts', id);
    return record ? (record as UserMemoryFact) : null;
  }

  /** Delete one record. */
  async remove(id: string): Promise<void> {
    const db = await openMemoryDb();
    await db.delete('user_facts', id);
  }

  /**
   * Increment useCount by 1 and refresh lastUsedAt for retrieval ranking.
   * Confidence is NOT modified (D-07 immutability). Throws when the id
   * does not exist.
   */
  async incrementUseCount(id: string): Promise<void> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Fact ${id} not found`);
    }
    const db = await openMemoryDb();
    await db.put('user_facts', {
      ...existing,
      useCount: existing.useCount + 1,
      lastUsedAt: Date.now(),
    });
  }

  /** Find records by tag via the by-tag multiEntry index. */
  async findByTag(tag: string): Promise<UserMemoryFact[]> {
    const db = await openMemoryDb();
    return (await db.getAllFromIndex('user_facts', 'by-tag', tag)) as UserMemoryFact[];
  }
}
