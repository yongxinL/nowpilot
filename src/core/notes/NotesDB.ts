import { openDB, type IDBPDatabase } from 'idb';
import { migrationRunner } from '../storage/MigrationRunner';
import { createEntry, commitEntry, getEntry } from '../storage/WriteJournal';
import { emit } from '../events/EventBus';
import { NoteSchema, type Note } from './NoteSchema';
import { parseWikilinks, resolveLinks } from './LinkParser';
import { toIndexDoc, noteSearchIndex } from './MiniSearchNoteIndex';
import type { NoteFindResult, NoteSaveResult } from './types';

/**
 * WR-02: payload of the `note:deleted` event emitted by NotesDB.remove().
 * Carries the note identity read BEFORE deletion so NoteFileSync can compute
 * the exact old file path (T-05a-06: identity fields only, never a
 * fabricated path).
 */
export interface NoteDeletedEvent {
  noteId: string;
  title: string;
  categoryPath: string;
}

/**
 * WR-02: payload of the `note:renamed` event emitted by NotesDB.save() when
 * the persisted note's title or categoryPath changed. Carries the OLD values
 * so NoteFileSync can remove the orphaned .md at the previous path.
 */
export interface NoteRenamedEvent {
  noteId: string;
  oldTitle: string;
  oldCategoryPath: string;
}

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

      // D-11/WR-04: never reset the sync state on a re-save. The UI re-saves
      // the full note object after enrichment acceptance (D-18); if the
      // payload omits the sync fields, keep the persisted ones — otherwise
      // every re-save would look like an external change to NoteFileSync
      // (lastSyncedAt) and lose owned-file reuse (lastSyncedFileName).
      const lastSyncedAt =
        parsed.lastSyncedAt !== undefined
          ? parsed.lastSyncedAt
          : existing.success
            ? existing.note.lastSyncedAt
            : undefined;
      const lastSyncedFileName =
        parsed.lastSyncedFileName !== undefined
          ? parsed.lastSyncedFileName
          : existing.success
            ? existing.note.lastSyncedFileName
            : undefined;

      // WR-03: staleness timestamp diff-writer — stamp
      // tagsGeneratedAt/summaryGeneratedAt ONLY when the incoming payload
      // changes the enrichment fields vs the persisted note. Timestamps
      // mark APPLIED (persisted) enrichment changes (D-05): the NoteTagger
      // suggestion path never reaches save(), so version-based stale-
      // suggestion discard (D-07) is unaffected. Preserve the parsed/
      // persisted timestamps otherwise so a plain edit does not reset the
      // 'enriched' marker (LLM-WIKI-08: getStaleNotes() distinguishes
      // 'enriched then edited' from 'never enriched' — a brand-new note
      // stays never-enriched because create leaves the fields unset).
      const tagsChanged =
        existing.success && JSON.stringify(existing.note.tags) !== JSON.stringify(parsed.tags);
      const summaryChanged =
        existing.success && (existing.note.summary ?? null) !== (parsed.summary ?? null);
      const tagsGeneratedAt = tagsChanged
        ? Date.now()
        : parsed.tagsGeneratedAt ??
          (existing.success ? existing.note.tagsGeneratedAt : undefined);
      const summaryGeneratedAt = summaryChanged
        ? Date.now()
        : parsed.summaryGeneratedAt ??
          (existing.success ? existing.note.summaryGeneratedAt : undefined);

      const finalNote: Note = {
        ...parsed,
        lastSyncedAt,
        lastSyncedFileName,
        tagsGeneratedAt,
        summaryGeneratedAt,
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

      // WR-02: when the persisted note's title or categoryPath changed, emit
      // note:renamed with the OLD values so NoteFileSync can clean up the
      // orphaned .md at the previous path. Diff is computed against the
      // persisted note inside this single write path — no duplicate/missing
      // events (T-05a-07); nothing emitted when unchanged.
      if (existing.success) {
        const renamed =
          existing.note.title !== parsed.title ||
          existing.note.categoryPath !== parsed.categoryPath;
        if (renamed) {
          emit<NoteRenamedEvent>('note:renamed', {
            noteId: parsed.id,
            oldTitle: existing.note.title,
            oldCategoryPath: existing.note.categoryPath,
          });
        }
      }
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

  /**
   * Update sync-state fields after a successful file write (D-11 / WR-04):
   * a raw put merging state into the persisted note, mirroring the
   * updateLastSyncedAt pattern. `lastSyncedAt` and `lastSyncedFileName`
   * are persisted atomically so owned-file reuse (WR-04) never sees a
   * stripped tracking field.
   */
  async updateSyncState(
    id: string,
    state: { lastSyncedAt?: number; lastSyncedFileName?: string },
  ): Promise<void> {
    const db = await openNotesDb();
    const existing = await this.get(id);
    if (!existing.success) return;
    const updated: Note = { ...existing.note, ...state };
    await db.put('notes', updated);
  }

  /** Update only the lastSyncedAt field after a successful file write (D-11). */
  async updateLastSyncedAt(id: string, timestamp: number): Promise<void> {
    await this.updateSyncState(id, { lastSyncedAt: timestamp });
  }

  /** Delete a note. */
  async remove(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      // WR-02 / T-05a-06: read the note BEFORE deleting — its identity
      // fields (title/categoryPath) drive the event payload used to compute
      // the exact old file path for cleanup.
      const found = await this.get(id);
      if (!found.success) return { success: false, error: found.error };

      const db = await openNotesDb();
      await db.delete('notes', id);
      noteSearchIndex.remove(id);
      // WR-01: keep the persisted index in sync with deletions too.
      await noteSearchIndex.persist();

      // WR-02: D-12 cleanup trigger — NoteFileSync deletes the orphaned .md
      // and empty parent folders via this event (never direct invocation).
      emit<NoteDeletedEvent>('note:deleted', {
        noteId: id,
        title: found.note.title,
        categoryPath: found.note.categoryPath,
      });
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
