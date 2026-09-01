/**
 * NotesDB — Phase 2 IDB foundation (D-41/D-42, §15.1), Phase 9 v4 migration
 * (D-125, SYNC-01, spec §20.4/3156).
 *
 * Persists user-authored notes, the concept graph, and the filesystem-backup
 * handle configuration. Bootstrap at v1 with the §15.1 store list; v4 adds
 * the `notes_backup_config` store via registered migration.
 *
 * §15.1 store list (verbatim):
 *   - notes     keyPath 'id'; fields per §15.1
 *   - concepts  keyPath 'slug'; fields per §15.1
 *
 * v4 addition (SYNC-01/D-125):
 *   - notes_backup_config  keyPath 'key'; value { key, handle }
 *
 * `getNoteByTitle` is declared per §15.1 (the spec calls it out
 * explicitly as a v1 affordance for the notes panel); the cursor
 * implementation lives here so it ships with the schema.
 *
 * Idb @jakearchibald/idb v8 — `DBSchema` typing + conditional migration
 * blocks (Pitfall 8). The store schema is a forward-compatible contract
 * (D-41 forward-migration contract).
 *
 * D-107: canonical Note re-exported from the Phase-8 home (spec 4721-4741).
 * NotesDB's put/get value shape is now the canonical Note.
 */

import type { DBSchema, IDBPDatabase } from 'idb';
import { openVersionedDB, registerMigration } from './IndexedDBMigrator';

export const NOTES_DB = 'NotesDB';
export const NOTES_DB_VERSION = 4;

/** D-107: canonical Note imported from + re-exported to the Phase-8 home (spec 4721-4741). */
import type { Note } from '../../types/notes';
/** D-107: canonical Note re-exported from the Phase-8 home (spec 4721-4741). */
export type { Note };

export interface Concept {
  slug: string;
  label: string;
  summary: string;
  noteIds: string[];
  aliases: string[];
  updatedAt: number;
}

/** SYNC-01: persisted FileSystemDirectoryHandle (non-serializable — IDB only, never chrome.storage). */
export interface NotesBackupConfig {
  key: string;
  handle: FileSystemDirectoryHandle;
}

export interface NotesDBV1 extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { byTitle: string; byUpdated: number };
  };
  concepts: {
    key: string;
    value: Concept;
    indexes: { byLabel: string };
  };
  notes_backup_config: {
    key: string;
    value: NotesBackupConfig;
  };
}

/**
 * v1→v4 migration (D-125, SYNC-01, spec §20.4/3156).
 *
 * Creates the `notes_backup_config` store. The Note.type population
 * (also part of D-125) is performed by {@link populateNoteTypeDefaults}
 * AFTER the DB is fully opened — IndexedDB's versionchange transaction
 * does not permit opening a new readwrite transaction on existing stores.
 *
 * Idempotent: opening the migrated DB twice does not throw or duplicate
 * stores. The `objectStoreNames.contains` guard ensures the store is only
 * created once.
 */
registerMigration('NotesDB', {
  fromVersion: 1,
  toVersion: 4,
  description: 'Add notes_backup_config store (Note.type population deferred to post-open)',
  migrate: (db) => {
    // Create notes_backup_config store (idempotent — skip if exists).
    if (!db.objectStoreNames.contains('notes_backup_config')) {
      db.createObjectStore('notes_backup_config', { keyPath: 'key' });
    }
  },
});

/**
 * Populate Note.type with 'Note' default where missing (D-125).
 *
 * Idempotent: only updates notes where `type` is undefined/null/empty.
 * An existing value (e.g. 'Concept') is never overwritten.
 *
 * This runs AFTER the DB is opened (not inside the versionchange
 * transaction) because IndexedDB forbids opening a new transaction on
 * existing stores during upgrade.
 *
 * @param db — an opened NotesDB instance.
 */
export async function populateNoteTypeDefaults(db: IDBPDatabase<NotesDBV1>): Promise<void> {
  const tx = db.transaction('notes', 'readwrite');
  const store = tx.objectStore('notes');
  let cursor = await store.openCursor();
  while (cursor) {
    const note = cursor.value;
    if (!note.type) {
      await cursor.update({ ...note, type: 'Note' });
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function openNotesDB(): Promise<IDBPDatabase<NotesDBV1>> {
  const db = await openVersionedDB<NotesDBV1>(NOTES_DB, NOTES_DB_VERSION, {
    upgrade(database, oldVersion) {
      // Conditional block per spec §20.4 / Pitfall 8 — fresh DB
      // (oldVersion === 0) creates the v1 stores.
      if (oldVersion < 1) {
        const notes = database.createObjectStore('notes', { keyPath: 'id' });
        notes.createIndex('byTitle', 'title', { unique: false });
        notes.createIndex('byUpdated', 'updated');
        const concepts = database.createObjectStore('concepts', { keyPath: 'slug' });
        concepts.createIndex('byLabel', 'label');
      }
      // Fresh DB at v4: create notes_backup_config store (idempotent guard
      // — the registered migration also creates it, but a fresh DB has no
      // prior version so the inline path is the only one that runs).
      if (!database.objectStoreNames.contains('notes_backup_config')) {
        database.createObjectStore('notes_backup_config', { keyPath: 'key' });
      }
    },
    blocked() {
      // IDB_BLOCKED — bootstrap() handles degraded-mode recording.
    },
  });

  // Post-open: populate Note.type defaults (D-125). Idempotent — safe to
  // run every open; only touches notes where type is missing.
  await populateNoteTypeDefaults(db);

  return db;
}

/**
 * §15.1 declares a `getNoteByTitle` affordance for the notes panel.
 * Implemented here against the live connection (caller-supplied) so
 * the function does not own connection state.
 */
export async function getNoteByTitle(
  db: IDBPDatabase<NotesDBV1>,
  title: string,
): Promise<Note | undefined> {
  const hit = await db.getFromIndex('notes', 'byTitle', title);
  return hit;
}
