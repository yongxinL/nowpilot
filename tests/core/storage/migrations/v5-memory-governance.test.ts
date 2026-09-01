/**
 * v5 migration idempotency (D-131, MEM-01/02/05, spec §20.4).
 *
 * Proves the v1→v5 migration:
 *   1. Idempotent — opening MemoryDB twice at v5 does not throw or duplicate stores.
 *   2. Fresh-open-at-v5 — memory_records + procedural_experiences stores exist.
 *   3. Backward-compatible — v1 data (messages, userFacts, conversationSummaries) retained.
 *   4. memory_records store has correct indexes (byKind, byStatus, byConfidence).
 *   5. Note links[] provenance migration — string[] → {noteId, source: 'explicit'}[].
 *   6. Note links[] NOT overwritten if already in new shape.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  openMemoryDB,
  MEMORY_DB,
  MEMORY_DB_VERSION,
  type MemoryDBV5,
} from '../../../../src/core/storage/MemoryDB';
import type { MemoryMessage } from '../../../../src/core/storage/MemoryDB';
import type { UserMemoryFact } from '../../../../src/core/memory/types';
import type { Note } from '../../../../src/types/notes';
import { openNotesDB } from '../../../../src/core/storage/NotesDB';

/** Minimal v1 MemoryDB schema for creating a pre-migration DB in tests. */
interface MemoryDBV1Minimal extends DBSchema {
  messages: {
    key: [string, number];
    value: MemoryMessage;
  };
  userFacts: {
    key: string;
    value: UserMemoryFact;
  };
  conversationSummaries: {
    key: string;
    value: { conversationId: string; summary: string };
  };
}

/**
 * Create a v1 MemoryDB with sample data, then close it. The next openMemoryDB()
 * call opens at v5 and triggers the registered migration.
 */
async function createV1MemoryDB(data: {
  messages?: MemoryMessage[];
  userFacts?: UserMemoryFact[];
}): Promise<void> {
  const db = await openDB<MemoryDBV1Minimal>(MEMORY_DB, 1, {
    upgrade(database) {
      database.createObjectStore('messages', { keyPath: ['conversationId', 'seq'] });
      database.createObjectStore('userFacts', { keyPath: 'id' });
      database.createObjectStore('conversationSummaries', { keyPath: 'conversationId' });
    },
  });
  if (data.messages) {
    for (const msg of data.messages) {
      await db.put('messages', msg);
    }
  }
  if (data.userFacts) {
    for (const fact of data.userFacts) {
      await db.put('userFacts', fact);
    }
  }
  db.close();
}

function makeMessage(conversationId: string, seq: number): MemoryMessage {
  return {
    conversationId,
    seq,
    role: 'user',
    content: `Message ${seq}`,
    timestamp: 1700000000000 + seq,
  };
}

function makeFact(id: string): UserMemoryFact {
  return {
    id,
    content: `Fact ${id}`,
    type: 'fact',
    tags: ['test'],
    confidence: 0.9,
    source: 'explicit',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    useCount: 0,
  };
}

describe('v5 migration — memory_records + procedural_experiences stores (D-131)', () => {
  beforeEach(() => {
    (globalThis as any).__resetIndexedDB();
  });

  it('idempotent: opening the migrated DB twice does not throw or duplicate stores', async () => {
    // Seed a v1 DB.
    await createV1MemoryDB({
      messages: [makeMessage('conv-1', 0), makeMessage('conv-1', 1)],
      userFacts: [makeFact('f-1')],
    });

    // First open at v5 — migration fires.
    const db1 = await openMemoryDB();
    expect(db1.objectStoreNames.contains('memory_records')).toBe(true);
    expect(db1.objectStoreNames.contains('procedural_experiences')).toBe(true);
    db1.close();

    // Second open at v5 — migration is a no-op (idempotent guard).
    const db2 = await openMemoryDB();
    expect(db2.objectStoreNames.contains('memory_records')).toBe(true);
    expect(db2.objectStoreNames.contains('procedural_experiences')).toBe(true);
    // Store count is stable (5 stores: messages, userFacts, conversationSummaries,
    // memory_records, procedural_experiences).
    expect(db2.objectStoreNames.length).toBe(5);
    db2.close();
  });

  it('fresh-open-at-v5: memory_records + procedural_experiences stores exist', async () => {
    // No v1 DB created — fresh open at v5.
    const db = await openMemoryDB();
    expect(MEMORY_DB_VERSION).toBe(5);
    expect(db.objectStoreNames.contains('memory_records')).toBe(true);
    expect(db.objectStoreNames.contains('procedural_experiences')).toBe(true);
    db.close();
  });

  it('backward-compatible: v1 data retained after upgrade to v5', async () => {
    await createV1MemoryDB({
      messages: [makeMessage('conv-1', 0), makeMessage('conv-1', 1)],
      userFacts: [makeFact('f-1')],
    });

    const db = await openMemoryDB();

    // Messages retained.
    const messages = await db.getAll('messages');
    expect(messages.length).toBe(2);

    // User facts retained.
    const facts = await db.getAll('userFacts');
    expect(facts.length).toBe(1);
    expect(facts[0].id).toBe('f-1');

    db.close();
  });

  it('memory_records store has correct indexes (byKind, byStatus, byConfidence)', async () => {
    const db = await openMemoryDB();

    // The store exists and has indexes — we can verify by checking the store's
    // indexNames (the idb library exposes this).
    const tx = db.transaction('memory_records', 'readonly');
    const store = tx.objectStore('memory_records');
    expect(store.indexNames.contains('byKind')).toBe(true);
    expect(store.indexNames.contains('byStatus')).toBe(true);
    expect(store.indexNames.contains('byConfidence')).toBe(true);
    await tx.done;

    db.close();
  });
});

describe('v5 migration — Note links[] provenance migration (KNW-01)', () => {
  beforeEach(() => {
    (globalThis as any).__resetIndexedDB();
  });

  it('Note links[] provenance migration — existing string[] links transformed to {noteId, source: explicit}[]', async () => {
    // Create a note with old-shape links (strings) by directly writing to IDB.
    const db = await openNotesDB();
    const oldNote = {
      id: 'old-1',
      title: 'Old Note',
      content: 'Content',
      created: 1700000000000,
      updated: 1700000000001,
      tags: [],
      links: ['target-1', 'target-2'], // Old shape: string[]
      unresolvedLinks: [],
      source: { kind: 'manual' },
      aiMeta: { suggestedLinks: [], concepts: [] },
      version: 1,
    };
    await db.put('notes', oldNote as any);
    db.close();

    // Re-open triggers populateLinkProvenanceDefaults.
    const db2 = await openNotesDB();
    const fetched = await db2.get('notes', 'old-1');
    expect(fetched).toBeDefined();
    expect(fetched!.links).toEqual([
      { noteId: 'target-1', source: 'explicit' },
      { noteId: 'target-2', source: 'explicit' },
    ]);
    db2.close();
  });

  it('Note links[] NOT overwritten if already in new shape', async () => {
    const db = await openNotesDB();
    const newNote: Note = {
      id: 'new-1',
      title: 'New Note',
      content: 'Content',
      created: 1700000000000,
      updated: 1700000000001,
      tags: [],
      links: [{ noteId: 'x', source: 'suggested' }],
      unresolvedLinks: [],
      source: { kind: 'manual' },
      aiMeta: { suggestedLinks: [], concepts: [] },
      version: 1,
    };
    await db.put('notes', newNote);
    db.close();

    // Re-open — should NOT change the source.
    const db2 = await openNotesDB();
    const fetched = await db2.get('notes', 'new-1');
    expect(fetched).toBeDefined();
    expect(fetched!.links).toEqual([{ noteId: 'x', source: 'suggested' }]);
    db2.close();
  });
});
