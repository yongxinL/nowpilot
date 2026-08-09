// tests/core/storage/NotesDB.test.ts — STORAGE-01 NotesDB contract tests
// (§21.2 notes + concepts, §15.1 notes/concepts stores + getNoteByTitle).
// Uses the fake-indexeddb harness (RESEARCH Pattern 8): a fresh IDBFactory per
// test so the 'NotesDB' database starts empty every time. Cases:
//   1. putNote/getNote/listNotes round-trip (full §21.2 Note shape incl. the
//      LLM-Wiki optional fields + aiMeta)
//   2. getNoteByTitle finds by exact title (§15.1 lookup contract)
//   3. deleteNote removes
//   4. putConcept/getConcept/listConcepts round-trip (Concept keyPath slug)
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { IDBPDatabase } from 'idb';
import {
  deleteNote,
  getConcept,
  getNote,
  getNoteByTitle,
  listConcepts,
  listNotes,
  openNotesDB,
  putConcept,
  putNote,
  type Concept,
  type Note,
  type NotesDBSchema,
} from '@/core/storage/NotesDB';

function makeNote(id: string, title: string, overrides: Partial<Note> = {}): Note {
  return {
    id,
    title,
    content: `content of ${title}`,
    created: 1,
    updated: 2,
    tags: ['tag-a', 'tag-b'],
    links: [],
    unresolvedLinks: [],
    source: { kind: 'manual' },
    aiMeta: { suggestedLinks: [], concepts: [] },
    version: 1,
    ...overrides,
  };
}

function makeConcept(slug: string, label: string): Concept {
  return { slug, label, summary: `summary of ${label}`, noteIds: [], aliases: [], updatedAt: 3 };
}

describe('NotesDB — notes + concepts stores', () => {
  let db: IDBPDatabase<NotesDBSchema>;

  beforeEach(() => {
    // RESEARCH Pattern 8: fresh factory per test — documented fake-indexeddb reset.
    indexedDB = new IDBFactory();
  });

  afterEach(() => {
    db?.close();
  });

  it('round-trips putNote/getNote/listNotes with the full §21.2 Note shape', async () => {
    db = await openNotesDB();

    const llmWikiNote = makeNote('n1', 'MySQL tuning', {
      summary: 'index selection basics',
      categoryPath: 'InfoTech/Database/MySQL',
      summaryGeneratedAt: 100,
      tagsGeneratedAt: 101,
      tags: ['mysql', 'index'],
    });
    await putNote(db, llmWikiNote);

    const stored = await getNote(db, 'n1');
    expect(stored).toEqual(llmWikiNote);
    expect(stored?.summary).toBe('index selection basics');
    expect(stored?.categoryPath).toBe('InfoTech/Database/MySQL');
    expect(stored?.aiMeta).toEqual({ suggestedLinks: [], concepts: [] });

    const all = await listNotes(db);
    expect(all.map((n) => n.id)).toEqual(['n1']);
  });

  it('getNoteByTitle finds by exact title (missing → undefined)', async () => {
    db = await openNotesDB();

    await putNote(db, makeNote('n1', 'The Exact Title'));
    await putNote(db, makeNote('n2', 'Another Note'));

    const found = await getNoteByTitle(db, 'The Exact Title');
    expect(found?.id).toBe('n1');

    // Title lookup is exact — a substring or wrong case must not match.
    expect(await getNoteByTitle(db, 'the exact title')).toBeUndefined();
    expect(await getNoteByTitle(db, 'Exact')).toBeUndefined();
    expect(await getNoteByTitle(db, 'missing')).toBeUndefined();
  });

  it('deleteNote removes the note', async () => {
    db = await openNotesDB();

    await putNote(db, makeNote('n1', 'To delete'));
    await putNote(db, makeNote('n2', 'Kept'));

    await deleteNote(db, 'n1');

    expect(await getNote(db, 'n1')).toBeUndefined();
    expect((await listNotes(db)).map((n) => n.id)).toEqual(['n2']);
  });

  it('round-trips putConcept/getConcept/listConcepts keyed by slug', async () => {
    db = await openNotesDB();

    await putConcept(db, makeConcept('mysql', 'MySQL'));
    await putConcept(db, makeConcept('llm', 'LLM'));

    expect(await getConcept(db, 'mysql')).toEqual(makeConcept('mysql', 'MySQL'));
    expect(await getConcept(db, 'absent')).toBeUndefined();

    const all = await listConcepts(db);
    expect(all.map((c) => c.slug)).toEqual(['mysql', 'llm']);
  });
});
