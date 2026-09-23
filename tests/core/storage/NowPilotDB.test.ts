import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DB_NAME,
  DB_VERSION,
  closeDb,
  getDb,
  __test__,
} from '../../../src/core/storage/NowPilotDB';
import {
  MIGRATIONS,
  getLastMigrationResult,
  v1InitialPhase2Stores,
  __test__ as migratorTest,
} from '../../../src/core/storage/IndexedDBMigrator';
import type { ChatSessionRecord } from '../../../src/core/storage/ChatHistoryDB';
import { clearLogs } from '../../../src/core/log/debugLog';

/**
 * NowPilotDB schema suite — plan 02-02 Task 3 (D2-24 / D2-25).
 *
 * The topology lock asserted as fact: one database `np_db` at `DB_VERSION = 1`
 * holding exactly `sessions`, `messages`, `entries`, `errors` with the canonical
 * indexes — and **no** Memory or Notes store (D2-21). Versions are integers,
 * ordered and contiguous, and a repeated open neither recreates nor corrupts
 * anything.
 */

function session(id: string): ChatSessionRecord {
  return { id, title: `Conversation ${id}`, created: 1, updated: 2, starred: true };
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

describe('NowPilotDB — canonical schema and version contract', () => {
  it('creates np_db at the locked version on first open', async () => {
    const db = await getDb();

    expect(DB_NAME).toBe('np_db');
    expect(DB_VERSION).toBe(1);
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
  });

  it('creates the four Phase 2 stores with their canonical indexes', async () => {
    const db = await getDb();
    const tx = db.transaction(['sessions', 'messages', 'entries', 'errors'], 'readonly');

    const sessions = tx.objectStore('sessions');
    expect(sessions.keyPath).toBe('id');
    expect(Array.from(sessions.indexNames)).toEqual(['by-updated']);
    expect(sessions.index('by-updated').keyPath).toBe('updated');

    const messages = tx.objectStore('messages');
    expect(messages.keyPath).toEqual(['sessionId', 'seq']);
    expect(Array.from(messages.indexNames)).toEqual(['by-session']);
    expect(messages.index('by-session').keyPath).toBe('sessionId');

    const entries = tx.objectStore('entries');
    expect(entries.keyPath).toBe('id');
    expect(Array.from(entries.indexNames)).toEqual(['by-status']);
    expect(entries.index('by-status').keyPath).toBe('status');

    const errors = tx.objectStore('errors');
    expect(errors.keyPath).toBe('id');
    expect(Array.from(errors.indexNames)).toEqual(['by-occurred']);
    expect(errors.index('by-occurred').keyPath).toBe('occurredAt');

    await tx.done;
  });

  it('creates no Memory or Notes store (D2-21)', async () => {
    const db = await getDb();
    const names = Array.from(db.objectStoreNames);

    expect([...names].sort()).toEqual(['entries', 'errors', 'messages', 'sessions']);
    for (const name of names) {
      expect(name).not.toMatch(/note/i);
      expect(name).not.toMatch(/memory/i);
    }
  });

  it('declares exactly one production migration — the Phase 2 initial entry', () => {
    expect(MIGRATIONS).toHaveLength(1);
    expect(MIGRATIONS[0]).toBe(v1InitialPhase2Stores);
    expect(MIGRATIONS[0].fromVersion).toBe(0);
    expect(MIGRATIONS[0].toVersion).toBe(1);
    for (const migration of MIGRATIONS) {
      expect(migration.description).not.toMatch(/note/i);
      expect(migration.description).not.toMatch(/memory/i);
    }
  });

  it('declares integer, ordered and contiguous schema versions', () => {
    expect(Number.isInteger(DB_VERSION)).toBe(true);

    let expectedFrom = 0;
    for (const migration of MIGRATIONS) {
      expect(Number.isInteger(migration.fromVersion)).toBe(true);
      expect(Number.isInteger(migration.toVersion)).toBe(true);
      expect(migration.toVersion).toBeGreaterThan(migration.fromVersion);
      expect(migration.fromVersion).toBe(expectedFrom);
      expectedFrom = migration.toVersion;
    }

    // The production version is the top of the migration table.
    expect(expectedFrom).toBe(DB_VERSION);
  });

  it('a repeated open is a no-op that neither recreates nor corrupts the stores', async () => {
    const db = await getDb();
    await db.put('sessions', session('s-reopen'));
    closeDb();

    migratorTest.resetLastMigrationResult();
    const reopened = await getDb();

    expect(getLastMigrationResult()).toBeNull();
    expect(reopened.version).toBe(DB_VERSION);
    expect(Array.from(reopened.objectStoreNames).sort()).toEqual([
      'entries',
      'errors',
      'messages',
      'sessions',
    ]);
    expect(await reopened.get('sessions', 's-reopen')).toEqual(session('s-reopen'));
  });
});
