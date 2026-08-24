/**
 * NotesDB — Phase 2 IDB foundation (D-41/D-42, §15.1).
 *
 * Persists user-authored notes and the concept graph. Bootstrap at v1
 * with the §15.1 store list.
 *
 * §15.1 store list (verbatim):
 *   - notes     keyPath 'id'; fields per §15.1
 *   - concepts  keyPath 'slug'; fields per §15.1
 *
 * `getNoteByTitle` is declared per §15.1 (the spec calls it out
 * explicitly as a v1 affordance for the notes panel); the cursor
 * implementation lives here so it ships with the schema.
 *
 * Idb @jakearchibald/idb v8 — `DBSchema` typing + conditional migration
 * blocks (Pitfall 8). The store schema is a forward-compatible contract
 * (D-41 forward-migration contract).
 */

import type { DBSchema, IDBPDatabase } from 'idb';
import { openVersionedDB } from './IndexedDBMigrator';

export const NOTES_DB = 'NotesDB';
export const NOTES_DB_VERSION = 1;

export interface Note {
  id: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  tags: string[];
  links: string[];
  source: string;
  aiMeta?: Record<string, unknown>;
  version: number;
}

export interface Concept {
  slug: string;
  label: string;
  summary: string;
  noteIds: string[];
  aliases: string[];
  updatedAt: number;
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
}

export async function openNotesDB(): Promise<IDBPDatabase<NotesDBV1>> {
  return openVersionedDB<NotesDBV1>(NOTES_DB, NOTES_DB_VERSION, {
    upgrade(database, oldVersion) {
      // Conditional block per spec §20.4 / Pitfall 8 — fresh DB
      // (oldVersion === 0) creates the stores; existing v1 DB is
      // untouched.
      if (oldVersion < 1) {
        const notes = database.createObjectStore('notes', { keyPath: 'id' });
        notes.createIndex('byTitle', 'title', { unique: false });
        notes.createIndex('byUpdated', 'updated');
        const concepts = database.createObjectStore('concepts', { keyPath: 'slug' });
        concepts.createIndex('byLabel', 'label');
      }
      // Future: if (oldVersion < 2) { ... } — the forward-migration
      // contract (D-41).
    },
    blocked() {
      // IDB_BLOCKED — bootstrap() handles degraded-mode recording.
    },
  });
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
