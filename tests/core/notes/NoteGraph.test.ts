// NoteGraph.test.ts — §22.3 verbatim cosine core (D-111).
// STOP_WORDS length-50 pin, cosine ordering, tie-break, backlinks, live-set.

import { describe, it, expect } from 'vitest';
import {
  STOP_WORDS,
  tokenise,
  buildTf,
  cosine,
  topKSimilar,
  computeBacklinks,
} from '@/core/notes/NoteGraph';
import type { Note } from '@/types/notes';

/** Minimal Note fixture (only the fields NoteGraph uses). */
function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'Test Note',
    content: 'default content',
    created: 1000,
    updated: 1000,
    tags: [],
    links: [],
    unresolvedLinks: [],
    source: { kind: 'manual' },
    aiMeta: { suggestedLinks: [], concepts: [] },
    version: 1,
    ...overrides,
  };
}

describe('NoteGraph — §22.3 verbatim cosine core (D-111)', () => {
  it('STOP_WORDS has exactly 50 entries (Pitfall 8 pin)', () => {
    expect(STOP_WORDS).toHaveLength(50);
  });

  it('tokenise drops stop words and short tokens', () => {
    const tokens = tokenise('the quick brown fox');
    expect(tokens).toContain('quick');
    expect(tokens).toContain('brown');
    expect(tokens).toContain('fox');
    expect(tokens).not.toContain('the');
  });

  it('tokenise matches [a-z0-9]{3,} verbatim (spec 3508)', () => {
    const tokens = tokenise('ab abc abcd 12 123 ABcDeF');
    expect(tokens).toContain('abc');
    expect(tokens).toContain('abcd');
    expect(tokens).toContain('123');
    expect(tokens).toContain('abcdef');
    expect(tokens).not.toContain('ab');
    expect(tokens).not.toContain('12');
  });

  it('tokenise returns empty for empty/nullish input', () => {
    expect(tokenise('')).toEqual([]);
    expect(tokenise('   ')).toEqual([]);
  });

  it('buildTf normalises term frequencies', () => {
    const tf = buildTf(['a', 'a', 'b']);
    expect(tf.get('a')).toBeCloseTo(2 / 3);
    expect(tf.get('b')).toBeCloseTo(1 / 3);
  });

  it('buildTf returns empty map for empty tokens', () => {
    expect(buildTf([]).size).toBe(0);
  });

  it('cosine = 1 for identical TF maps', () => {
    const tf = buildTf(['a', 'b', 'c']);
    expect(cosine(tf, tf)).toBeCloseTo(1);
  });

  it('cosine = 0 for disjoint TF maps', () => {
    const a = buildTf(['a']);
    const b = buildTf(['b']);
    expect(cosine(a, b)).toBe(0);
  });

  it('cosine = 0 when one side is empty (zero-norm guard)', () => {
    const a = buildTf(['a']);
    const b = buildTf([]);
    expect(cosine(a, b)).toBe(0);
  });

  it('cosine = 0 when both sides are empty (zero-norm guard)', () => {
    expect(cosine(buildTf([]), buildTf([]))).toBe(0);
  });

  it('COSINE ORDERING: returns the most overlapping note first', () => {
    const target = makeNote({ id: 't', content: 'sql database indexing performance tuning queries' });
    const similar = makeNote({ id: 'a', content: 'sql database indexing performance tuning queries optimization' });
    const different = makeNote({ id: 'b', content: 'cooking recipes italian pasta homemade sauce' });
    const result = topKSimilar(target, [target, similar, different], 5);
    expect(result[0].note.id).toBe('a');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('TIE-BREAK: identical cosine → newer updated first', () => {
    const target = makeNote({ id: 't', content: 'sql database' });
    const older = makeNote({ id: 'old', content: 'sql database', updated: 1000 });
    const newer = makeNote({ id: 'new', content: 'sql database', updated: 2000 });
    const result = topKSimilar(target, [target, older, newer], 5);
    expect(result[0].note.id).toBe('new');
    expect(result[1].note.id).toBe('old');
  });

  it('TIE-BREAK: identical cosine + identical updated → lower id first', () => {
    const target = makeNote({ id: 't', content: 'sql database' });
    const a = makeNote({ id: 'bravo', content: 'sql database', updated: 1000 });
    const b = makeNote({ id: 'alpha', content: 'sql database', updated: 1000 });
    const result = topKSimilar(target, [target, a, b], 5);
    expect(result[0].note.id).toBe('alpha');
    expect(result[1].note.id).toBe('bravo');
  });

  it('ZERO-NORM: empty content note → cosine 0, no crash', () => {
    const target = makeNote({ id: 't', content: 'sql database' });
    const empty = makeNote({ id: 'e', content: '' });
    const result = topKSimilar(target, [target, empty], 5);
    expect(result[0].note.id).toBe('e');
    expect(result[0].score).toBe(0);
  });

  it('excludes the target note itself from results', () => {
    const target = makeNote({ id: 't', content: 'sql database' });
    const other = makeNote({ id: 'o', content: 'sql database' });
    const result = topKSimilar(target, [target, other], 5);
    expect(result.some((r) => r.note.id === 't')).toBe(false);
    expect(result).toHaveLength(1);
  });

  it('k default is 5', () => {
    const target = makeNote({ id: 't', content: 'sql database' });
    const others = Array.from({ length: 10 }, (_, i) =>
      makeNote({ id: `n${i}`, content: `sql database topic${i}`, updated: 1000 + i }),
    );
    const result = topKSimilar(target, [target, ...others]);
    expect(result).toHaveLength(5);
  });

  it('explicit k is respected', () => {
    const target = makeNote({ id: 't', content: 'sql database' });
    const others = Array.from({ length: 10 }, (_, i) =>
      makeNote({ id: `n${i}`, content: `sql database topic${i}`, updated: 1000 + i }),
    );
    const result = topKSimilar(target, [target, ...others], 3);
    expect(result).toHaveLength(3);
  });

  it('backlinks: notes A(l→B), C(l→B), D(l→none) → B:[A,C], D:[]', () => {
    const a = makeNote({ id: 'A', links: [{ noteId: 'B', source: 'explicit' }] });
    const b = makeNote({ id: 'B', links: [] });
    const c = makeNote({ id: 'C', links: [{ noteId: 'B', source: 'explicit' }] });
    const d = makeNote({ id: 'D', links: [] });
    const backlinks = computeBacklinks([a, b, c, d]);
    expect(backlinks.get('B')).toEqual(['A', 'C']);
    expect(backlinks.get('D')).toBeUndefined();
  });

  it('backlinks: deduplicates multiple links to the same target', () => {
    const a = makeNote({ id: 'A', links: [{ noteId: 'B', source: 'explicit' }, { noteId: 'B', source: 'explicit' }] });
    const b = makeNote({ id: 'B', links: [] });
    const backlinks = computeBacklinks([a, b]);
    expect(backlinks.get('B')).toEqual(['A']);
  });

  it('LIVE-SET: a note whose links reference an absent id → edge not in backlinks', () => {
    const a = makeNote({ id: 'A', links: [{ noteId: 'GONE', source: 'explicit' }] });
    const backlinks = computeBacklinks([a]);
    // GONE is not in the live set → no backlink entry for it
    expect(backlinks.get('GONE')).toBeUndefined();
  });

  it('backlinks: empty notes array → empty map', () => {
    const backlinks = computeBacklinks([]);
    expect(backlinks.size).toBe(0);
  });
});
