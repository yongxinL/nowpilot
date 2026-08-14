// tests/core/notes/NoteGraph.test.ts — 05-05 Task 3 (D-05-17, KNW-02): derived
// graph pins. edges() from stored links[] with self-loop skip; backlinkIndex()
// in-link buckets in iteration order; resolveDanglingOnDelete (WIKI-ID-04 —
// deleted id moves back to the caller for unresolvedLinks[] re-promotion);
// topKSimilar §22.3 verbatim bag-of-words cosine (tokenise /[a-z0-9]{3,}/g +
// fixed stop-word list, rank desc, ties by updated desc then id asc, k default
// 5, zero-cosine excluded); determinism (identical inputs → identical arrays).
// Pure graph logic — node env.
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  STOP_WORDS,
  backlinkIndex,
  edges,
  resolveDanglingOnDelete,
  tokenise,
  topKSimilar,
} from '@/core/notes/NoteGraph';

describe('NoteGraph (05-05 — derived edges + WIKI-ID-04 + §22.3 cosine, D-05-17)', () => {
  it('ships the fixed 50-word STOP_WORDS set inline (§22.3)', () => {
    expect(STOP_WORDS.size).toBe(50);
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has('some')).toBe(true);
    expect(STOP_WORDS.has('nowpilot')).toBe(false);
  });

  it('tokenise lowercases, keeps [a-z0-9]{3,} tokens, removes stop words', () => {
    expect(tokenise('The Quick Brown Fox jumps!')).toEqual(['quick', 'brown', 'fox', 'jumps']);
    expect(tokenise('')).toEqual([]);
    expect(tokenise('a an the')).toEqual([]); // all stop words
  });

  it('edges derives exact { source, target } pairs from links[], skipping self-loops', () => {
    const notes = [
      { id: 'A', links: ['B', 'C'] },
      { id: 'B', links: ['A'] },
      { id: 'C', links: ['C'] }, // self-loop — must be skipped
    ];
    expect(edges(notes)).toEqual([
      { source: 'A', target: 'B' },
      { source: 'A', target: 'C' },
      { source: 'B', target: 'A' },
    ]);
  });

  it('edges returns [] for empty links', () => {
    expect(
      edges([
        { id: 'A', links: [] },
        { id: 'B', links: [] },
      ]),
    ).toEqual([]);
  });

  it('backlinkIndex buckets in-links in notes iteration order', () => {
    const notes = [
      { id: 'B', links: ['A'] },
      { id: 'C', links: ['A'] },
      { id: 'D', links: [] },
    ];
    const index = backlinkIndex(notes);
    expect(index.get('A')).toEqual(['B', 'C']); // iteration order preserved
    expect(index.get('D')).toBeUndefined(); // no in-links → no bucket
  });

  it('resolveDanglingOnDelete returns the dangling id + remaining links (WIKI-ID-04 pin)', () => {
    const notes = [
      { id: 'X', links: ['A', 'B'], unresolvedLinks: ['Ghost'] },
      { id: 'Y', links: ['B'], unresolvedLinks: [] },
    ];
    const result = resolveDanglingOnDelete(notes, 'A');
    expect(result).toEqual([{ noteId: 'X', dangling: ['A'], remaining: ['B'] }]);
    // Y's links[] does not contain A — untouched, absent from the result.
  });

  it('topKSimilar ranks shared-token notes first (§22.3 cosine)', () => {
    const notes = [
      { id: 'n1', title: 'One', content: 'quantum entanglement teleportation', updated: 100 },
      { id: 'n2', title: 'Two', content: 'quantum entanglement computation', updated: 200 },
      { id: 'n3', title: 'Three', content: 'garden watering schedule', updated: 300 },
    ];
    const result = topKSimilar(notes, 'n1', 2);
    expect(result[0]).toBe('n2'); // shares quantum+entanglement; n3 shares nothing
    expect(result).not.toContain('n1'); // the query note itself is excluded
    // n3 has zero shared tokens — excluded entirely (only n2 qualifies).
    expect(result).toEqual(['n2']);
  });

  it('topKSimilar breaks cosine ties by updated desc then id asc', () => {
    // All three share the same two content words → identical cosine (1.0).
    // Tie-break: updated desc → n3 (300) first, then n1/n2 tie → id asc (n1).
    const notes = [
      { id: 'n2', title: 'Two', content: 'shared words here', updated: 200 },
      { id: 'n1', title: 'One', content: 'shared words here', updated: 100 },
      { id: 'n3', title: 'Three', content: 'shared words here', updated: 300 },
    ];
    const result = topKSimilar(notes, 'n2', 5);
    expect(result[0]).toBe('n3'); // identical cosine → newer updated first
    expect(result.slice(1)).toEqual(['n1']); // remaining tie → id asc
  });

  it('topKSimilar defaults to k=5 and excludes zero-cosine notes', () => {
    const notes = [
      { id: 'n1', title: 'One', content: 'alpha beta gamma', updated: 100 },
      { id: 'n2', title: 'Two', content: 'alpha beta delta', updated: 100 },
      { id: 'n3', title: 'Three', content: 'epsilon zeta eta', updated: 100 },
    ];
    const result = topKSimilar(notes, 'n1');
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result).toEqual(['n2']); // n3 shares nothing → excluded
  });

  it('topKSimilar is deterministic: identical inputs → identical arrays', () => {
    const notes = [
      { id: 'n1', title: 'One', content: 'quantum entanglement teleportation', updated: 100 },
      { id: 'n2', title: 'Two', content: 'quantum entanglement computation', updated: 200 },
      { id: 'n3', title: 'Three', content: 'garden watering schedule', updated: 300 },
    ];
    const a = topKSimilar(notes, 'n1', 5);
    const b = topKSimilar(notes, 'n1', 5);
    expect(a).toEqual(b);
  });

  it('topKSimilar returns [] for an unknown noteId', () => {
    const notes = [{ id: 'n1', title: 'One', content: 'alpha beta', updated: 100 }];
    expect(topKSimilar(notes, 'missing', 5)).toEqual([]);
  });
});
