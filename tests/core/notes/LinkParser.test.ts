// tests/core/notes/LinkParser.test.ts — 05-05 Task 2 (WIKI-ID-02/03, KNW-01):
// pure wikilink parser pins. parseLinks() inline [[Title]] extraction (+ trim,
// empty, no-bracket cases); resolveLinks() VERBATIM tie-break (exact title →
// updated desc → id asc — newer updated wins, EQUAL updated → lower id wins);
// mixed resolved/unresolved output; < 20 ms over 1,000 notes (§22.1);
// promoteUnresolvedLinks() save-time reconciliation (WIKI-ID-03, D-05-14).
// Pure string logic — node env.
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { parseLinks, promoteUnresolvedLinks, resolveLinks } from '@/core/notes/LinkParser';

describe('LinkParser (05-05 — wikilink extraction + verbatim tie-break, WIKI-ID-02/03)', () => {
  it('parseLinks extracts inline [[Title]] targets, trimmed', () => {
    expect(parseLinks('See [[Alpha]] and [[Beta]] and plain text')).toEqual(['Alpha', 'Beta']);
    expect(parseLinks('See [[ Alpha ]] here')).toEqual(['Alpha']); // trims whitespace inside [[ ]]
  });

  it('parseLinks returns [] for no brackets and for empty input', () => {
    expect(parseLinks('plain text with no wikilinks')).toEqual([]);
    expect(parseLinks('')).toEqual([]);
  });

  it('resolveLinks tie-break: newer updated wins for equal titles (WIKI-ID-02 pin)', () => {
    const notes = [
      { id: 'older', title: 'Alpha', updated: 1_000 },
      { id: 'newer', title: 'Alpha', updated: 2_000 },
    ];
    const result = resolveLinks(['Alpha'], notes);
    expect(result.links).toEqual(['newer']);
    expect(result.unresolvedLinks).toEqual([]);
  });

  it('resolveLinks tie-break: EQUAL updated → lower id wins (id asc)', () => {
    const notes = [
      { id: 'zebra', title: 'Alpha', updated: 1_000 },
      { id: 'apple', title: 'Alpha', updated: 1_000 },
    ];
    const result = resolveLinks(['Alpha'], notes);
    expect(result.links).toEqual(['apple']);
  });

  it('resolveLinks: a target with no matching title lands in unresolvedLinks', () => {
    const notes = [{ id: 'n1', title: 'Alpha', updated: 1_000 }];
    const result = resolveLinks(['Ghost'], notes);
    expect(result.links).toEqual([]);
    expect(result.unresolvedLinks).toEqual(['Ghost']);
  });

  it('resolveLinks mixed: resolved + unresolved in one call, preserving target order', () => {
    const notes = [{ id: 'idAlpha', title: 'Alpha', updated: 1_000 }];
    const result = resolveLinks(['Alpha', 'Ghost'], notes);
    expect(result.links).toEqual(['idAlpha']);
    expect(result.unresolvedLinks).toEqual(['Ghost']);
  });

  it('resolveLinks completes < 20 ms over 1,000 distinct-title notes + 10 targets (§22.1)', () => {
    const notes = Array.from({ length: 1000 }, (_, i) => ({
      id: `n${i}`,
      title: `Note ${i}`,
      updated: 1_000 + i,
    }));
    const targets = ['Note 0', 'Note 250', 'Note 500', 'Note 750', 'Note 999', 'Ghost-1', 'Ghost-2', 'Note 1', 'Note 2', 'Note 3'];
    const t0 = performance.now();
    const result = resolveLinks(targets, notes);
    const elapsed = performance.now() - t0;

    expect(result.links.length).toBe(8);
    expect(result.unresolvedLinks).toEqual(['Ghost-1', 'Ghost-2']);
    // §22.1 bound; generous CI headroom — a linear scan of 1,000 notes is ~µs.
    expect(elapsed).toBeLessThan(20);
  });

  it('promoteUnresolvedLinks promotes matching titles and leaves the rest (WIKI-ID-03 / D-05-14)', () => {
    const notes = [
      { id: 'ref1', unresolvedLinks: ['Ghost', 'Other'] },
      { id: 'ref2', unresolvedLinks: ['Unrelated'] },
    ];
    const result = promoteUnresolvedLinks(notes, { id: 'newNoteId', title: 'Ghost' });

    expect(result).toEqual([
      { noteId: 'ref1', promoted: ['Ghost'], remaining: ['Other'] },
    ]);
    // ref2 has no matching unresolved target — untouched, absent from the result.
  });

  it('promoteUnresolvedLinks returns [] when no referencing note holds the title', () => {
    const notes = [{ id: 'ref1', unresolvedLinks: ['Other'] }];
    expect(promoteUnresolvedLinks(notes, { id: 'newNoteId', title: 'Ghost' })).toEqual([]);
  });
});
