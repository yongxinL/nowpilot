// MiniSearchIndex — D-109 persistent per-surface notes index.
//
// A LAZY/MEMOIZED MiniSearch wrapper over NotesDB: built lazily on first
// query, upserted incrementally on note:saved, remove(noteId) via discard,
// NEVER persisted (zero storage-area imports — grep-assertable, §26.5).
//
// Mirrors PageIndexBuilder.ts:145-261 (the Phase-6 ephemeral page index) but
// over the notes store with the search-notes field contract (spec 1608).
// The two indexes are DISTINCT instances that never share storage (spec 3774).
//
// MiniSearch 7.2.0 has no `upsert` — new documents use `add`; updates use
// `replace` (which discards the old version and adds the new one by ID).

import MiniSearch from 'minisearch';

import type { IDBPDatabase } from 'idb';

import { on } from '../events/EventBus';
import type { NotesDBV1 } from '../storage/NotesDB';
import { openNotesDB } from '../storage/NotesDB';
import type { Note } from '../../types/notes';
import { NOTE_SAVED_EVENT, type NoteSavedPayload } from '../notes/save';

/** Search-notes document (A2: tags joined, summary '' seam, updated STORED). */
export interface NoteDoc {
  id: string;
  title: string;
  content: string;
  tags: string;
  summary: string;
  /** STORED (not searched) — the WIKI-ID-02 tie-break key plan 08-04 sorts on. */
  updated: number;
}

/** A MiniSearch hit with the stored NoteDoc fields merged in (Pitfall 5). */
export type NoteHit = { id: string; score: number } & NoteDoc;

/** Spec-1608 searchable field set — title + content + tags + summary. */
export const NOTE_SEARCH_FIELDS: readonly string[] = ['title', 'content', 'tags', 'summary'];

function noteToDoc(note: Note): NoteDoc {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    tags: note.tags.join(' '),
    summary: note.summary ?? '',
    updated: note.updated,
  };
}

/** Build a fresh index from NoteDocs (spec-1608 fields + stored `updated`). */
export function buildIndex(docs: NoteDoc[]): MiniSearch<NoteDoc> {
  const index = new MiniSearch<NoteDoc>({
    fields: ['title', 'content', 'tags', 'summary'],
    storeFields: ['title', 'content', 'tags', 'summary', 'updated'],
    searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.2 },
  });
  index.addAll(docs);
  return index;
}

// ---------------------------------------------------------------------------
// Module state (per-surface lazy singleton)
// ---------------------------------------------------------------------------

let index: MiniSearch<NoteDoc> | null = null;
let lazyBuildCount = 0;

/** Read all notes from NotesDB and map to NoteDoc[] (the seed). */
async function seedFromNotesDB(db: IDBPDatabase<NotesDBV1>): Promise<NoteDoc[]> {
  const notes = await db.getAll('notes');
  return notes.map(noteToDoc);
}

/** Lazily build (once) the index from NotesDB; memoized thereafter. */
async function getIndex(db: IDBPDatabase<NotesDBV1>): Promise<MiniSearch<NoteDoc>> {
  if (index !== null) return index;
  index = buildIndex(await seedFromNotesDB(db));
  lazyBuildCount += 1;
  return index;
}

/** Query the notes index (builds lazily on first call). */
export async function query(db: IDBPDatabase<NotesDBV1>, q: string): Promise<NoteHit[]> {
  const idx = await getIndex(db);
  // MiniSearch spreads stored fields onto results at runtime; its static
  // SearchResult type only declares { id, terms, queryTerms, score, match }.
  return idx.search(q) as unknown as NoteHit[];
}

/** Incrementally add a note to the index (no full rebuild on save, D-109). */
export async function upsert(db: IDBPDatabase<NotesDBV1>, note: Note): Promise<void> {
  const idx = await getIndex(db);
  idx.add(noteToDoc(note));
}

/** Remove a note by ID via discard (by-ID lazy vacuum — Open Q4, no new event). */
export async function remove(db: IDBPDatabase<NotesDBV1>, noteId: string): Promise<void> {
  const idx = await getIndex(db);
  idx.discard(noteId);
}

// ---------------------------------------------------------------------------
// note:saved subscription (Pitfall 6 — module load, re-invocable via __test__)
// ---------------------------------------------------------------------------

let noteSavedUnsubscribe: (() => void) | undefined;

function wireNoteSaved(): void {
  noteSavedUnsubscribe?.();
  noteSavedUnsubscribe = on<NoteSavedPayload>(NOTE_SAVED_EVENT, (payload: NoteSavedPayload) => {
    // Fire-and-forget: fetch the note by id and add it to the index. EventBus
    // swallows handler errors by design (Pitfall 6) — a failing upsert must
    // never crash the emitter.
    void (async () => {
      try {
        const db = await openNotesDB();
        const note = await db.get('notes', payload.noteId);
        if (note) {
          const idx = await getIndex(db);
          // `add` is safe here: note:saved fires after NotesDB.put, and a note
          // that was already in the index (updated) is re-added via replace.
          if (idx.has(note.id)) {
            idx.replace(noteToDoc(note));
          } else {
            idx.add(noteToDoc(note));
          }
        }
      } catch {
        // Swallow — EventBus handlers must not throw.
      }
    })();
  });
}

wireNoteSaved();

// ---------------------------------------------------------------------------
// Test seams + namespace export
// ---------------------------------------------------------------------------

export const __test__ = {
  reset(): void {
    index = null;
    lazyBuildCount = 0;
    wireNoteSaved();
  },
  get buildCount(): number {
    return lazyBuildCount;
  },
};

/** Object-form namespace export (ProviderRegistry precedent). */
export const MiniSearchIndex = { query, upsert, remove, __test__ };
