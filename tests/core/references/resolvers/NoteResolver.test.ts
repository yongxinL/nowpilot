import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNotes = [
  { id: 'n1', title: 'My Note', content: 'Some content about things', tags: [], categoryPath: '', created: 0, updated: 0 },
  { id: 'n2', title: 'Another Note', content: 'Different content', tags: [], categoryPath: '', created: 0, updated: 0 },
];

const mockSearchResults = [
  { id: 'n1', title: 'My Note', score: 0.9, snippet: 'Some content...' },
];

vi.mock('../../../../src/core/storage/stores/NotesDB', () => ({
  notesDB: {
    getNote: vi.fn(async (id: string) => {
      if (id === 'deleted-n1') return undefined;
      return mockNotes.find((n) => n.id === id);
    }),
  },
}));

vi.mock('../../../../src/core/notes/LinkParser', () => ({
  linkParser: {
    search: vi.fn((query: string) => {
      if (query === 'my') return mockSearchResults;
      return [];
    }),
  },
}));

import { noteResolver } from '../../../../src/core/references/resolvers/NoteResolver';

describe('NoteResolver', () => {
  it('getType returns "note"', () => {
    expect(noteResolver.getType()).toBe('note');
  });

  it('search returns results with type="note"', async () => {
    const results = await noteResolver.search('my');
    expect(results).toHaveLength(1);
    expect(results[0].token.type).toBe('note');
    expect(results[0].token.title).toBe('My Note');
    expect(results[0].icon).toBe('FileTextOutlined');
  });

  it('search returns empty array for no matches', async () => {
    const results = await noteResolver.search('zzz');
    expect(results).toHaveLength(0);
  });

  it('validate returns { valid: false } for deleted note', async () => {
    const result = await noteResolver.validate({ type: 'note', id: 'deleted-n1', title: 'Gone', displayLabel: '@note:Gone' });
    expect(result.valid).toBe(false);
  });

  it('validate returns { valid: true } for existing note', async () => {
    const result = await noteResolver.validate({ type: 'note', id: 'n1', title: 'My Note', displayLabel: '@note:My Note' });
    expect(result.valid).toBe(true);
  });

  it('resolve returns title + content for existing note', async () => {
    const result = await noteResolver.resolve({ type: 'note', id: 'n1', title: 'My Note', displayLabel: '@note:My Note' });
    expect(result).toEqual({ title: 'My Note', content: 'Some content about things' });
  });

  it('resolve returns null for missing note', async () => {
    const result = await noteResolver.resolve({ type: 'note', id: 'missing-n1', title: 'Missing', displayLabel: '@note:Missing' });
    expect(result).toBeNull();
  });
});
