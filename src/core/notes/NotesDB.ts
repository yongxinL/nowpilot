import { openDB, type IDBPDatabase } from 'idb';
import { migrationRunner } from '../storage/MigrationRunner';
import { createEntry, commitEntry, getEntry } from '../storage/WriteJournal';
import { emit } from '../events/EventBus';
import { NoteSchema, type Note } from './NoteSchema';
import { parseWikilinks, resolveLinks } from './LinkParser';
import { toIndexDoc, noteSearchIndex } from './MiniSearchNoteIndex';
import type { NoteFindResult, NoteSaveResult } from './types';

// ── Database connection (WriteJournal pattern: module-level cached promise) ──

let dbPromise: Promise<IDBPDatabase> | null = null;

async function openNotesDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    await migrationRunner.migrate('NotesDB', 5);
    dbPromise = openDB('NotesDB', 5);
  }
  return dbPromise;
}

/**
 * Reset the NotesDB connection and delete the database.
 * Used by tests to ensure isolation between test cases.
 */
export async function resetNotesDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('NotesDB');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // Force close
  });
}

/**
 * NotesDB — idb-backed CRUD for atomic notes (D-01, D-02, D-03, D-16, D-17).
 *
 * `content` is the single source of truth: every save re-parses wikilinks
 * via LinkParser, re-resolves them to note IDs, and derives the `links[]` /
 * `unresolvedLinks[]` arrays. Writes go through WriteJournal
 * ('save-note-with-links' operation) for crash consistency, and a
 * `note:saved` EventBus event is emitted after a successful commit.
 */
export class NotesDB {
  /**
   * Validate + persist a note. On success returns the note ID; operational
   * errors are returned as discriminated unions, never thrown.
   */
  async save(note: Note): Promise<NoteSaveResult> {
    let parsed: Note;
    try {
      parsed = NoteSchema.parse(note);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        code: 'VALIDATION_ERROR',
      };
    }

    try {
      // D-01: derive links from content on every save
      const titles = parseWikilinks(parsed.content);
      const { links, unresolvedLinks } = await resolveLinks(titles, this);

      // D-17: version counter increments on update, overwrite semantics
      const existing = await this.get(parsed.id);
      const version = existing.success ? existing.note.version + 1 : parsed.version;

      // D-11: never reset lastSyncedAt on a re-save. The UI re-saves the
      // full note object after enrichment acceptance (D-18); if the payload
      // omits the sync timestamp, keep the persisted one — otherwise every
      // re-save would look like an external change to NoteFileSync.
      const lastSyncedAt =
        parsed.lastSyncedAt !== undefined
          ? parsed.lastSyncedAt
          : existing.success
            ? existing.note.lastSyncedAt
            : undefined;

      const finalNote: Note = {
        ...parsed,
        lastSyncedAt,
        links,
        unresolvedLinks,
        version,
        updatedAt: Date.now(),
      };

      // WriteJournal: write-note + update-index as journaled steps (key_links).
      // The fully-derived finalNote is persisted as the entry payload so an
      // interrupted write-note step can be replayed after a crash (WR-05).
      const steps: Array<{ name: string; executor: () => Promise<void> }> = [
        {
          name: 'write-note',
          executor: async () => {
            const db = await openNotesDb();
            await db.put('notes', finalNote);
          },
        },
        {
          name: 'update-index',
          executor: async () => {
            noteSearchIndex.replace(toIndexDoc(finalNote));
            // WR-01: persist the index after every mutation so search
            // survives extension reloads (persist/load round-trip).
            await noteSearchIndex.persist();
          },
        },
      ];

      // createEntry resolves the journal ENTRY (not an id) — use entry.id
      const entry = await createEntry(
        'save-note-with-links',
        { noteId: parsed.id },
        steps,
        { note: finalNote },
      );
      await commitEntry(entry.id, steps);

      const persisted = await getEntry(entry.id);
      if (persisted && persisted.status !== 'completed') {
        return {
          success: false,
          error: `Journal entry ${persisted.status}: note was not committed`,
          code: 'JOURNAL_ERROR',
        };
      }

      // D-12: canonical trigger for downstream index sync / graph recompute.
      // version rides the payload (D-07) so NoteTagger can run the staleness
      // check without a pre-call DB read.
      emit('note:saved', { noteId: parsed.id, version: finalNote.version });
      return { success: true, noteId: parsed.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        code: 'DB_ERROR',
      };
    }
  }

  /** Fetch a single note by immutable UUID identity (D-02). */
  async get(id: string): Promise<NoteFindResult> {
    try {
      const db = await openNotesDb();
      const note = await db.get('notes', id);
      if (!note) {
        return { success: false, error: `Note ${id} not found`, code: 'NOT_FOUND' };
      }
      return { success: true, note: note as Note };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        code: 'DB_ERROR',
      };
    }
  }

  /** All notes — returns [] when the store is empty (UI-SPEC empty state). */
  async getAll(): Promise<Note[]> {
    const db = await openNotesDb();
    return (await db.getAll('notes')) as Note[];
  }

  /** Find notes by title via the by-title index (non-unique — used for link resolution). */
  async findByTitle(title: string): Promise<Note[]> {
    const db = await openNotesDb();
    return (await db.getAllFromIndex('notes', 'by-title', title)) as Note[];
  }

  /**
   * Read the lastSyncedAt field for a note — used by NoteFileSync for
   * external-change detection (D-11). Returns undefined for notes without
   * the field or notes that do not exist.
   */
  async getByLastSyncedAt(id: string): Promise<number | undefined> {
    const existing = await this.get(id);
    if (existing.success) {
      return existing.note.lastSyncedAt;
    }
    return undefined;
  }

  /** Update only the lastSyncedAt field after a successful file write (D-11). */
  async updateLastSyncedAt(id: string, timestamp: number): Promise<void> {
    const db = await openNotesDb();
    const existing = await this.get(id);
    if (!existing.success) return;
    const updated: Note = { ...existing.note, lastSyncedAt: timestamp };
    await db.put('notes', updated);
  }

  /** Delete a note. */
  async remove(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const db = await openNotesDb();
      await db.delete('notes', id);
      noteSearchIndex.remove(id);
      // WR-01: keep the persisted index in sync with deletions too.
      await noteSearchIndex.persist();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Merge partial changes into an existing note and re-save (re-derives links). */
  async update(id: string, changes: Partial<Note>): Promise<NoteSaveResult> {
    const existing = await this.get(id);
    if (!existing.success) {
      return { success: false, error: existing.error, code: 'DB_ERROR' };
    }
    const merged: Note = { ...existing.note, ...changes, id };
    return this.save(merged);
  }

  /**
   * Non-journaled raw put — recovery path used by WriteJournal replay
   * (WR-05). Unlike save(), this does not re-derive links, bump the
   * version, create a journal entry, or touch the search index; it
   * restores a note payload that was already fully derived at original
   * write time (the update-index step rebuilds the index afterwards).
   */
  async restore(note: Note): Promise<void> {
    const db = await openNotesDb();
    await db.put('notes', note);
  }
}

/** Module-level singleton (PageIndexBuilder pattern). */
export const notesDb = new NotesDB();

/** Accessor for the singleton. */
export function getNotesDb(): NotesDB {
  return notesDb;
}
