/**
 * WriteJournalDB — Phase 2 IDB foundation (D-41/D-42, §15.1).
 *
 * Persists WriteJournal entry records — metadata only (no message
 * bodies; bodies belong to ChatHistoryDB / MemoryDB — D-33).
 *
 * §15.1 store list (verbatim):
 *   - entries   keyPath 'id'; value: WriteJournalEntry (from @/types/storage)
 *
 * The `entries` store holds journal metadata used by WriteJournal
 * (plan 02-05) for crash-safe update-workspace ordering and replay
 * semantics. Entries are kept forever (no TTL); the owning journal
 * decides when to evict completed entries via the workspace journal
 * maintenance pass.
 *
 * Idb @jakearchibald/idb v8 — `DBSchema` typing + conditional migration
 * blocks (Pitfall 8). The store schema is a forward-compatible contract
 * (D-41 forward-migration contract).
 */

import type { DBSchema } from 'idb';
import { openVersionedDB } from './IndexedDBMigrator';
import type { WriteJournalEntry } from '../../types/storage';

export const WRITE_JOURNAL_DB = 'WriteJournalDB';
export const WRITE_JOURNAL_DB_VERSION = 1;

export interface WriteJournalDBV1 extends DBSchema {
  entries: {
    key: string;
    value: WriteJournalEntry;
    indexes: { byStatus: string; byCreated: number };
  };
}

export async function openWriteJournalDB() {
  return openVersionedDB<WriteJournalDBV1>(WRITE_JOURNAL_DB, WRITE_JOURNAL_DB_VERSION, {
    upgrade(database, oldVersion) {
      // Conditional block per spec §20.4 / Pitfall 8 — fresh DB
      // (oldVersion === 0) creates the store; existing v1 DB is
      // untouched.
      if (oldVersion < 1) {
        const entries = database.createObjectStore('entries', { keyPath: 'id' });
        entries.createIndex('byStatus', 'status');
        entries.createIndex('byCreated', 'createdAt');
      }
      // Future: if (oldVersion < 2) { ... } — the forward-migration
      // contract (D-41).
    },
    blocked() {
      // IDB_BLOCKED — bootstrap() handles degraded-mode recording.
    },
  });
}
