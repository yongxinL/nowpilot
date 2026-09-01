/**
 * v4 migration idempotency (D-125, SYNC-01, spec §20.4/3156).
 *
 * Proves the v1→v4 migration:
 *   1. Idempotent — opening the migrated DB twice does not throw or duplicate stores.
 *   2. Fresh-open-at-v4 — notes_backup_config store exists.
 *   3. Backward-compatible — v1 data retained after upgrade to v4.
 *   4. Note.type populated with default 'Note' when missing.
 *   5. Note.type NOT overwritten when already set.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  openNotesDB,
  NOTES_DB,
  NOTES_DB_VERSION,
  type NotesDBV1,
} from '../../../../src/core/storage/NotesDB';
import type { Note } from '../../../../src/types/notes';

/** Minimal v1 schema for creating a pre-migration DB in tests. */
interface NotesDBV1Minimal extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { byTitle: string; byUpdated: number };
  };
  concepts: {
    key: string;
    value: { slug: string };
  };
}

/**
 * Create a v1 DB with the given notes, then close it. The next openNotesDB()
 * call opens at v4 and triggers the registered migration.
 */
async function createV1DB(notes: Note[]): Promise<void> {
  const db = await openDB<NotesDBV1Minimal>(NOTES_DB, 1, {
    upgrade(database) {
      const notesStore = database.createObjectStore('notes', { keyPath: 'id' });
      notesStore.createIndex('byTitle', 'title', { unique: false });
      notesStore.createIndex('byUpdated', 'updated');
      database.createObjectStore('concepts', { keyPath: 'slug' });
    },
  });
  // Seed notes (some without type, some with type already set).
  for (const note of notes) {
    await db.put('notes', note);
  }
  db.close();
}

const baseNote = (id: string, overrides: Partial<Note> = {}): Note => ({
  id,
  title: `Note ${id}`,
  content: `Content for ${id}`,
  created: 1700000000000,
  updated: 1700000000001,
  tags: [],
  links: [],
  unresolvedLinks: [],
  source: { kind: 'manual' },
  aiMeta: { suggestedLinks: [], concepts: [] },
  version: 1,
  ...overrides,
});

describe('v4 migration — notes_backup_config store + Note.type population (D-125/SYNC-01)', () => {
  beforeEach(() => {
    (globalThis as any).__resetIndexedDB();
  });

  it('idempotent: opening the migrated DB twice does not throw or duplicate stores', async () => {
    // Seed a v1 DB with one note missing type.
    await createV1DB([baseNote('n1')]);

    // First open at v4 — migration fires.
    const db1 = await openNotesDB();
    expect(db1.objectStoreNames.contains('notes_backup_config')).toBe(true);
    db1.close();

    // Second open at v4 — migration is a no-op (idempotent guard).
    const db2 = await openNotesDB();
    expect(db2.objectStoreNames.contains('notes_backup_config')).toBe(true);
    // Store count is stable (no duplicate stores thrown).
    expect(db2.objectStoreNames.length).toBe(3); // notes, concepts, notes_backup_config
    db2.close();
  });

  it('fresh-open-at-v4: notes_backup_config store exists with no prior version', async () => {
    // No v1 DB created — fresh open at v4.
    const db = await openNotesDB();
    expect(NOTES_DB_VERSION).toBe(4);
    expect(db.objectStoreNames.contains('notes_backup_config')).toBe(true);
    expect(db.objectStoreNames.contains('notes')).toBe(true);
    expect(db.objectStoreNames.contains('concepts')).toBe(true);
    db.close();
  });

  it('backward-compatible: v1 data retained after upgrade to v4', async () => {
    const note = baseNote('n1', { title: 'Retained Note', content: 'Original content' });
    await createV1DB([note]);

    const db = await openNotesDB();
    const fetched = await db.get('notes', 'n1');
    expect(fetched).toBeDefined();
    expect(fetched!.title).toBe('Retained Note');
    expect(fetched!.content).toBe('Original content');
    expect(fetched!.id).toBe('n1');
    db.close();
  });

  it('Note.type populated with default "Note" when missing', async () => {
    const note = baseNote('n1'); // no type field
    expect(note.type).toBeUndefined();
    await createV1DB([note]);

    const db = await openNotesDB();
    const fetched = await db.get('notes', 'n1');
    expect(fetched).toBeDefined();
    expect(fetched!.type).toBe('Note');
    db.close();
  });

  it('Note.type NOT overwritten when already set', async () => {
    const note = baseNote('n1', { type: 'Concept' });
    await createV1DB([note]);

    const db = await openNotesDB();
    const fetched = await db.get('notes', 'n1');
    expect(fetched).toBeDefined();
    expect(fetched!.type).toBe('Concept'); // preserved, not overwritten to 'Note'
    db.close();
  });
});
