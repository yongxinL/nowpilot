import { describe, it, expect, beforeEach } from 'vitest';
import { MiniSearchNoteIndex } from '../../../src/core/notes/MiniSearchNoteIndex';
import { resetNotesDb } from '../../../src/core/notes/NotesDB';
import type { NoteIndexDoc } from '../../../src/core/notes/types';
import type { Note } from '../../../src/core/notes/NoteSchema';

function makeDoc(overrides: Partial<NoteIndexDoc> = {}): NoteIndexDoc {
  return {
    id: 'doc-1',
    title: 'Alpha',
    content: 'alpha beta gamma',
    tags: ['work'],
    wikilinkTargets: [],
    updatedAt: 1000,
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Alpha',
    content: 'alpha beta gamma',
    tags: ['work'],
    categoryPath: '',
    createdAt: 1000,
    updatedAt: 1000,
    version: 1,
    provenance: { source: 'user-created' },
    links: [],
    unresolvedLinks: [],
    ...overrides,
  };
}

describe('MiniSearchNoteIndex', () => {
  beforeEach(async () => {
    await resetNotesDb();
  });

  it('returns BM25-ranked results with <mark>-wrapped snippet highlights', () => {
    const index = new MiniSearchNoteIndex();
    index.replace(makeDoc({ id: 'a', title: 'Apple pie recipe', content: 'flour sugar butter' }));
    index.replace(makeDoc({ id: 'b', title: 'Fruit list', content: 'apple banana orange' }));

    const results = index.search('apple');
    expect(results.length).toBe(2);
    // Title match is boosted 2.0x — doc 'a' ranks above content-only match doc 'b'
    expect(results[0].noteId).toBe('a');
    expect(results[0].matchedFields).toContain('title');
    expect(results[0].snippet).toContain('<mark>');
  });

  it('search on an empty index returns []', () => {
    const index = new MiniSearchNoteIndex();
    expect(index.search('anything')).toEqual([]);
  });

  it('replace updates the index for an existing document', () => {
    const index = new MiniSearchNoteIndex();
    index.replace(makeDoc({ id: 'n1', title: 'Old Title', content: 'old content' }));
    index.replace(makeDoc({ id: 'n1', title: 'New Title', content: 'fresh material' }));

    const results = index.search('fresh');
    expect(results.map((r) => r.noteId)).toEqual(['n1']);
    expect(index.search('old')).toEqual([]);
  });

  it('remove deletes a document from the index', () => {
    const index = new MiniSearchNoteIndex();
    index.replace(makeDoc({ id: 'n1', title: 'Keep', content: 'keep me' }));
    index.replace(makeDoc({ id: 'n2', title: 'Drop', content: 'drop me' }));

    index.remove('n2');
    const results = index.search('me');
    expect(results.map((r) => r.noteId)).toEqual(['n1']);
  });

  it('rebuild replaces the full index from a note set', async () => {
    const index = new MiniSearchNoteIndex();
    index.replace(makeDoc({ id: 'stale', title: 'Stale', content: 'stale data' }));

    const notes = [
      makeNote({ id: 'note-1', title: 'Alpha', content: 'alpha beta gamma' }),
      makeNote({ id: 'note-2', title: 'Omega', content: 'omega zeta' }),
    ];
    await index.rebuild(notes);

    expect(index.search('alpha').map((r) => r.noteId)).toEqual(['note-1']);
    expect(index.search('stale')).toEqual([]);
  });

  it('persist() + load() round-trip preserves search output identity', async () => {
    const index = new MiniSearchNoteIndex();
    index.replace(makeDoc({ id: 'a', title: 'Apple pie recipe', content: 'flour sugar butter' }));
    index.replace(makeDoc({ id: 'b', title: 'Fruit list', content: 'apple banana orange' }));
    const before = index.search('apple');
    expect(before.length).toBeGreaterThan(0);

    await index.persist();

    const restored = new MiniSearchNoteIndex();
    await restored.load();
    const after = restored.search('apple');

    expect(after).toEqual(before);
  });
});
