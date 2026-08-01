import { describe, it, expect } from 'vitest';
import { getNoteGraph, NoteGraph, tokenize, cosineSimilarity, jaccardSimilarity, computeSimilarity, STOP_WORDS } from '../../../src/core/notes/NoteGraph';
import type { Note } from '../../../src/core/notes/NoteSchema';

function note(overrides: Partial<Note> & { id: string }): Note {
  return {
    title: 'Note',
    content: '',
    tags: [],
    categoryPath: '',
    createdAt: 0,
    updatedAt: 0,
    version: 1,
    provenance: { source: 'user-created' },
    links: [],
    unresolvedLinks: [],
    ...overrides,
  };
}

describe('NoteGraph', () => {
  it('getBacklinks returns IDs of notes that link to the target — computed, never stored', () => {
    const graph = getNoteGraph();
    const allNotes = [
      note({ id: 'a', links: ['target'] }),
      note({ id: 'b', links: ['other'] }),
      note({ id: 'c', links: ['target', 'x'] }),
    ];
    expect(graph.getBacklinks('target', allNotes)).toEqual(['a', 'c']);
    expect(graph.getBacklinks('missing', allNotes)).toEqual([]);
  });

  it('backlinks are dynamic — changing links[] changes getBacklinks output', () => {
    const graph = getNoteGraph();
    const mutable = note({ id: 'a', links: [] });
    expect(graph.getBacklinks('target', [mutable])).toEqual([]);

    mutable.links = ['target'];
    expect(graph.getBacklinks('target', [mutable])).toEqual(['a']);
  });

  it('getRelatedNotes ranks by hybrid similarity (50/20/30) descending, capped at limit', () => {
    const graph = getNoteGraph();
    const source = note({
      id: 'src',
      title: 'Source',
      content: 'alpha beta gamma delta',
      tags: ['work', 'ai'],
      links: ['l1', 'l2', 'l3'],
    });
    const close = note({
      id: 'c1',
      title: 'Close',
      content: 'alpha beta gamma delta epsilon',
      tags: ['work', 'ai', 'extra'],
      links: ['l1', 'l2', 'l3', 'l4'],
    });
    const far = note({
      id: 'f1',
      title: 'Far',
      content: 'completely unrelated topic matter',
      tags: ['cooking'],
      links: ['zzz'],
    });
    const other = note({
      id: 'o1',
      title: 'Other',
      content: 'alpha beta gamma delta',
      tags: ['work'],
      links: ['l1'],
    });

    const results = graph.getRelatedNotes('src', [source, close, far, other], 2);
    expect(results).toHaveLength(2);
    expect(results[0].noteId).toBe('c1');
    expect(results[1].noteId).toBe('o1');
    for (const r of results) {
      expect(r).toHaveProperty('noteId');
      expect(r).toHaveProperty('score');
      expect(r).toHaveProperty('sharedLinks');
      expect(r).toHaveProperty('sharedTags');
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
    // shared link/tag counts
    expect(results[0].sharedLinks).toBe(3);
    expect(results[0].sharedTags).toBe(2);
  });

  it('getRelatedNotes excludes the source note itself and handles unknown source', () => {
    const graph = getNoteGraph();
    const source = note({ id: 'src', content: 'alpha beta', links: [], tags: [] });
    const results = graph.getRelatedNotes('src', [source]);
    expect(results).toEqual([]);
    expect(graph.getRelatedNotes('missing', [source])).toEqual([]);
  });

  it('computeSimilarity combines linkOverlap (50%) + tagOverlap (20%) + contentCosine (30%)', () => {
    // share 2 of 3 links, 1 of 2 tags → identical text
    const a = note({
      id: 'a',
      title: 'Alpha',
      content: 'alpha beta gamma',
      tags: ['work', 'ai'],
      links: ['l1', 'l2', 'l3'],
    });
    const b = note({
      id: 'b',
      title: 'Alpha',
      content: 'alpha beta gamma',
      tags: ['work', 'other'],
      links: ['l1', 'l2', 'zzz'],
    });
    const score = computeSimilarity(a, b);
    const expected = 2 / 3 * 0.5 + 1 / 2 * 0.2 + 1 * 0.3;
    expect(score).toBeCloseTo(expected, 6);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('computeSimilarity returns 0 for notes with no shared links, tags, or content', () => {
    const a = note({ id: 'a', title: 'Alpha', content: 'alpha beta gamma', tags: ['work'], links: ['l1'] });
    const b = note({ id: 'b', title: 'Zeta', content: 'zzz zzz zzz', tags: ['cooking'], links: ['zz'] });
    expect(computeSimilarity(a, b)).toBe(0);
  });

  it('computeEdges returns wikilink edges (strength 1.0) and backlink edges', () => {
    const graph = getNoteGraph();
    const a = note({ id: 'a', links: ['b'] });
    const b = note({ id: 'b', links: [] });

    const edges = graph.computeEdges('a', [a, b]);
    expect(edges).toContainEqual({
      sourceNoteId: 'a',
      targetNoteId: 'b',
      edgeType: 'wikilink',
      strength: 1.0,
    });
    // b has no incoming links from others beyond a's forward link → no backlinks
    const edgesB = graph.computeEdges('b', [a, b]);
    expect(edgesB).toContainEqual({
      sourceNoteId: 'a',
      targetNoteId: 'b',
      edgeType: 'backlink',
      strength: 1.0,
    });
  });

  it('recompute is a safe stateless no-op wrapper', () => {
    const graph = getNoteGraph();
    const notes = [note({ id: 'src', content: 'alpha beta', links: [] })];
    expect(() => graph.recompute('src', notes)).not.toThrow();
  });
});

describe('similarity helpers', () => {
  it('jaccardSimilarity returns 0 for disjoint sets and 1 for identical sets', () => {
    expect(jaccardSimilarity(new Set(['a']), new Set(['b']))).toBe(0);
    expect(jaccardSimilarity(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
    expect(jaccardSimilarity(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3, 6);
  });

  it('cosineSimilarity handles empty text, identical text, and no shared terms', () => {
    expect(cosineSimilarity('', 'hello world')).toBe(0);
    expect(cosineSimilarity('hello world', '')).toBe(0);
    expect(cosineSimilarity('hello world', 'hello world')).toBeCloseTo(1, 6);
    expect(cosineSimilarity('alpha beta', 'gamma delta')).toBe(0);
  });

  it('tokenize lowercases, keeps tokens of 3+ chars, filters STOP_WORDS', () => {
    expect(tokenize('The quick brown fox jumps')).toEqual(['quick', 'brown', 'fox', 'jumps']);
    expect(tokenize('the and for')).toEqual([]);
    expect(tokenize('')).toEqual([]);
    expect(tokenize('ab')).toEqual([]);
  });

  it('STOP_WORDS contains the core English stop words', () => {
    for (const word of ['the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are']) {
      expect(STOP_WORDS.has(word)).toBe(true);
    }
  });
});
