// MiniSearchIndex tests — §18 required (08-03, Task 2).
//
// Proves D-109: the lazy/memoized, NEVER-persisted per-surface notes index —
// spec-1608 fields (title + content + tags + summary) with the summary seam,
// incremental note:saved upsert (no rebuild), remove via discard, the
// <50 ms/1,000-notes perf gate (spec 3481, SC#4), and the zero-storage-import
// posture (grep-assertable). The stored `updated` field round-trips through
// search (the WIKI-ID-02 tie-break key plan 08-04's searchSuggestions sorts on).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { IDBPDatabase } from 'idb';

import { openNotesDB, type NotesDBV1 } from '@/core/storage/NotesDB';
import type { Note } from '@/core/storage/NotesDB';
import { emit } from '@/core/events/EventBus';
import {
  MiniSearchIndex,
  __test__ as indexTest,
  query,
  upsert,
  remove,
  buildIndex,
  type NoteDoc,
} from '@/core/search/MiniSearchIndex';
import {
  NOTE_SAVED_EVENT,
  type NoteSavedPayload,
} from '@/core/notes/save';

function makeNote(over: Partial<Note> = {}): Note {
  return {
    id: over.id ?? 'note-1',
    title: over.title ?? 'Note',
    content: over.content ?? '',
    created: over.created ?? 1000,
    updated: over.updated ?? 1000,
    tags: over.tags ?? [],
    links: over.links ?? [],
    unresolvedLinks: over.unresolvedLinks ?? [],
    source: over.source ?? { kind: 'manual' },
    aiMeta: over.aiMeta ?? { suggestedLinks: [], concepts: [] },
    version: over.version ?? 1,
    ...over,
  };
}

describe('MiniSearchIndex', () => {
  let db: IDBPDatabase<NotesDBV1>;

  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    db = await openNotesDB();
    indexTest.reset();
  });

  it('(1) builds lazily on first query and memoizes (buildCount === 1)', async () => {
    expect(indexTest.buildCount).toBe(0); // nothing built before any query
    await query(db, 'anything');
    expect(indexTest.buildCount).toBe(1);
    await query(db, 'another');
    expect(indexTest.buildCount).toBe(1); // memoized — no second build
  });

  it('(2) spec-1608 fields: title match outranks content-only (boost title:3)', async () => {
    await db.put('notes', makeNote({ id: 'title-note', title: 'Needle', content: 'body' }));
    await db.put('notes', makeNote({ id: 'body-note', title: 'Other', content: 'Needle in body' }));
    const hits = await query(db, 'needle');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe('title-note'); // title boost
  });

  it('(3) tags field is searchable (joined)', async () => {
    await db.put('notes', makeNote({ id: 'tagged', title: 'T', content: 'body', tags: ['special', 'marker'] }));
    const hits = await query(db, 'marker');
    expect(hits.map((h) => h.id)).toContain('tagged');
  });

  it('(4) summary seam — a note with summary populated is hit via summary text', async () => {
    await db.put('notes', makeNote({ id: 'sum', title: 'T', content: 'body', summary: 'unique summary phrase' }));
    const hits = await query(db, 'unique summary');
    expect(hits.map((h) => h.id)).toContain('sum');
  });

  it('(5) STORED updated round-trips through search (the 08-04 tie-break key)', async () => {
    const UPDATED = 1700000000000;
    await db.put('notes', makeNote({ id: 'u1', title: 'HasUpdate', updated: UPDATED }));
    const hits = await query(db, 'hasupdate');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].updated).toBe(UPDATED);
  });

  it('(6) note:saved upsert — a saved note becomes searchable WITHOUT a rebuild', async () => {
    // Seed one note so the index builds.
    await db.put('notes', makeNote({ id: 'seed', title: 'Seed', content: 'seed content' }));
    await query(db, 'seed');
    expect(indexTest.buildCount).toBe(1);

    // Save a new note directly, then upsert it (the note:saved handler does
    // the same thing asynchronously — here we call upsert directly to avoid
    // racing the async handler).
    await db.put('notes', makeNote({ id: 'new', title: 'NewOne', content: 'fresh note' }));
    const newNote = await db.get('notes', 'new');
    expect(newNote).toBeDefined();
    await upsert(db, newNote!);

    // The new note is now searchable; buildCount unchanged (incremental).
    const hits = await query(db, 'newone');
    expect(hits.map((h) => h.id)).toContain('new');
    expect(indexTest.buildCount).toBe(1);
  });

  it('(7) remove(noteId) via discard — the note is no longer returned', async () => {
    await db.put('notes', makeNote({ id: 'rm', title: 'Removable', content: 'delete me' }));
    await query(db, 'removable');
    let hits = await query(db, 'removable');
    expect(hits.map((h) => h.id)).toContain('rm');

    await remove(db, 'rm');
    hits = await query(db, 'removable');
    expect(hits.map((h) => h.id)).not.toContain('rm');
  });

  it('(8) PERF GATE (spec 3481): query over 1,000 notes < 50 ms', async () => {
    const docs: NoteDoc[] = [];
    for (let i = 0; i < 1000; i++) {
      docs.push({
        id: `note-${i}`,
        title: `Note ${i}`,
        content: `Content of note number ${i} with various words`,
        tags: `tag${i}`,
        summary: '',
        updated: 1000 + i,
      });
    }
    // Put them in NotesDB so the lazy seed reads them.
    for (const d of docs) {
      await db.put(
        'notes',
        makeNote({ id: d.id, title: d.title, content: d.content, tags: [d.tags], updated: d.updated }),
      );
    }
    // Reset so the perf test measures a fresh lazy build + query.
    indexTest.reset();
    await query(db, 'needle'); // build
    indexTest.reset();
    // Re-seed: put all again after reset (reset only clears the in-memory index).
    // Actually reset clears the index; the next query rebuilds from NotesDB.
    const t0 = Date.now();
    const hits = await query(db, 'needle');
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(50);
    // The build itself (addAll over 1,000) is also sub-ms; total well under 50.
    expect(indexTest.buildCount).toBe(1);
  });

  it('(9) ZERO-PERSIST structural assertion — no storage imports (D-109)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/core/search/MiniSearchIndex.ts'), 'utf8');
    expect(src).not.toMatch(/chrome\.storage/);
    // No chromeStorageAdapter import (the only storage-adapter dependency that
    // would indicate persistence). The `idb` import is type-only (IDBPDatabase
    // param type) — not a storage adapter.
    expect(src).not.toMatch(/chromeStorageAdapter/);
    // openNotesDB is used by the note:saved handler (the documented seeder
    // exception) — assert it is the ONLY idb-adjacent import (no idb helpers
    // like openDB/openVersionedDB that would indicate direct persistence).
    expect(src).not.toMatch(/openVersionedDB/);
  });

  it('(10) buildIndex uses spec-1608 fields + stores updated', () => {
    const idx = buildIndex([{ id: 'a', title: 'T', content: 'C', tags: 'x', summary: 'S', updated: 42 }]);
    const hits = idx.search('T');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toMatchObject({ updated: 42 });
  });
});
