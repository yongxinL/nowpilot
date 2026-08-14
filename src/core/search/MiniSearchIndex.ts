// src/core/search/MiniSearchIndex.ts — 05-05 Task 1 (D-05-11/12): the
// PERSISTENT notes index (§26.5/§27) over Note title+content+tags+summary+
// categoryPath. A DISTINCT instance from the ephemeral page index
// (PageIndexBuilder) — the two never share storage (§26.5 note). In-memory by
// design (MiniSearch is in-memory): rebuilt from NotesDB on Notes-view mount
// (D-05-12 — cheap at ≤ 5,000 notes), incremental add/remove on note CRUD.
// Pure module — no chrome APIs, no IndexedDB, no settings: it consumes plain
// Note[] / Note objects and returns { id, score } results only.
//
// Assumption A1 (05-RESEARCH.md L245): MiniSearch v7 raw scores are unbounded
// BM25-style — searchNotes NORMALIZES to [0,1] by dividing by the top result
// score (ranking order unchanged, top result === 1). That [0,1] contract is
// the §9.8 search-notes tool seam (D-05-11) — Phase 8 consumes it.
//
// minisearch 7.2.0 verified API (node_modules/minisearch/dist/es/index.d.ts):
// new MiniSearch({ fields, storeFields, idField }) + addAll/add/discard +
// search(query, { prefix, fuzzy, boost }) — pattern-matched from
// PageIndexBuilder.buildPageIndex (src/core/extraction/PageIndexBuilder.ts
// L132-139). NOTE: 7.2.0 SearchOptions has NO `limit` key — the result cap is
// applied as a slice AFTER search (Rule 3 API-shape deviation from the plan's
// inline-limit sketch).
import MiniSearch from 'minisearch';

import type { Note } from '@/core/storage/NotesDB';

/** D-05-11 doc shape — the minisearch document for a note. id = note UUID (WIKI-ID-01). */
export interface NoteSearchDoc {
  id: string;
  title: string;
  content: string;
  /** Indexed as a single text field per MiniSearch array semantics. */
  tags: string[];
  /** LLM-generated (LLM-WIKI-03) — indexed when present. */
  summary?: string;
  /** e.g. 'InfoTech/Database/MySQL' (CAT-01) — included now, populated by 5a (D-05-11). */
  categoryPath?: string;
}

/** Map a Note to its searchable document — shared by build + incremental add. */
export function docFor(note: Note): NoteSearchDoc {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    tags: note.tags,
    summary: note.summary,
    categoryPath: note.categoryPath,
  };
}

/**
 * D-05-11/12: build (or rebuild) the persistent notes index from NotesDB notes.
 * Fields indexed: title+content+tags+summary+categoryPath; stored:
 * title+content+tags+summary; idField 'id' (note UUID, WIKI-ID-01). Rebuild is
 * cheap at ≤ 5,000 notes — called on Notes-view mount.
 */
export function buildNotesIndex(notes: readonly Note[]): MiniSearch<NoteSearchDoc> {
  const mini = new MiniSearch<NoteSearchDoc>({
    fields: ['title', 'content', 'tags', 'summary', 'categoryPath'],
    storeFields: ['title', 'content', 'tags', 'summary'],
    idField: 'id',
  });
  mini.addAll(notes.map(docFor));
  return mini;
}

/** Incremental add on note CRUD (note:saved handler — D-05-12). Idempotent per id. */
export function addToNotesIndex(index: MiniSearch<NoteSearchDoc>, note: Note): void {
  index.add(docFor(note));
}

/** Incremental remove on note delete (D-05-12 / WIKI-ID-04 delete path). */
export function removeFromNotesIndex(index: MiniSearch<NoteSearchDoc>, noteId: string): void {
  index.discard(noteId);
}

/**
 * D-05-11/§9.8: prefix+fuzzy search over the notes index with title/tags boost.
 * Scores NORMALIZED to [0,1] (Assumption A1): divide by the top result score —
 * ranking order unchanged, top result === 1 exactly. Empty/whitespace query →
 * []. The result cap (opts.limit ?? 10) is applied AFTER search — minisearch
 * 7.2.0 has no `limit` search option.
 */
export function searchNotes(
  index: MiniSearch<NoteSearchDoc>,
  query: string,
  opts?: { limit?: number },
): Array<{ id: string; score: number }> {
  if (!query || query.trim().length === 0) return [];
  const results = index.search(query, {
    prefix: true,
    fuzzy: 0.2,
    boost: { title: 2, tags: 1.5 },
  });
  const top = results[0]?.score ?? 1;
  return results.slice(0, opts?.limit ?? 10).map((r) => ({
    id: r.id as string,
    score: top > 0 ? r.score / top : 0,
  }));
}
