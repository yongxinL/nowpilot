// src/core/notes/NoteGraph.ts — 05-05 Task 3 (D-05-17, KNW-02): the derived
// note graph. edges()/backlinkIndex() derive on demand from each note's stored
// links[] (WIKI-ID-01: edges are ID-based, never titles) — NEVER a graph store,
// NEVER parse-at-render (§22.3 / RESEARCH Pattern 4 anti-pattern). All edges are
// note IDs (WIKI-ID-01); delete reconciliation moves the removed note's id from
// others' links[] back into unresolvedLinks[] (WIKI-ID-04). topKSimilar is the
// §22.3 bag-of-words cosine (verbatim: tokenise /[a-z0-9]{3,}/g, fixed 50-word
// stop-word list, cosine = dot/(||a||·||b||), ties by updated desc then id asc).
//
// Determinism rule (contextFeed.ts L13 precedent): pure + deterministic — no
// wall-clock reads, no random number generation, no native RNG/entropy
// primitives. Edges/backlinks are derived on demand (D-05-17); the UI (05-07/08)
// consumes derived data only.
import type { Note } from '@/core/storage/NotesDB';

/** §22.3 / WIKI-ID-01 — an edge between two note IDs (never titles). */
export interface GraphEdge {
  source: string;
  target: string;
}

/** §22.3 verbatim — the fixed 50-word English stop-word list, shipped inline. */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
  'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'once', 'here',
  'there', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
]);

/** §22.3 tokenisation — lowercase, [a-z0-9]{3,} tokens, stop-words removed. */
export function tokenise(content: string): string[] {
  const tokens = content.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return tokens.filter((t) => !STOP_WORDS.has(t));
}

/**
 * D-05-17: derive edges on demand from stored links[] — one GraphEdge per
 * links[] entry. Self-loops (target === the note's own id) are skipped.
 * Never a graph store, never parse-at-render.
 */
export function edges(notes: readonly Pick<Note, 'id' | 'links'>[]): GraphEdge[] {
  const result: GraphEdge[] = [];
  for (const note of notes) {
    for (const target of note.links) {
      if (target === note.id) continue; // self-loop — skip
      result.push({ source: note.id, target });
    }
  }
  return result;
}

/**
 * D-05-17: in-link index — Map<noteId, noteId[]> of notes whose links[] point
 * at the key. Bucket order = notes iteration order (deterministic).
 */
export function backlinkIndex(
  notes: readonly Pick<Note, 'id' | 'links'>[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const note of notes) {
    for (const target of note.links) {
      const bucket = index.get(target);
      if (bucket) bucket.push(note.id);
      else index.set(target, [note.id]);
    }
  }
  return index;
}

/**
 * WIKI-ID-04: dangling-edge reconciliation on delete — the removed note's id is
 * a dangling edge on every note whose links[] contains it; the caller moves
 * that id from links[] back into unresolvedLinks[] (as the raw title — the
 * title string is the caller's lookup). Returns, per affected note, the
 * dangling ids (caller removes from links[]) and the remaining links[].
 * Pure — the caller (05-07 delete path) persists the rewritten arrays.
 */
export function resolveDanglingOnDelete(
  notes: readonly Pick<Note, 'id' | 'links' | 'unresolvedLinks'>[],
  deletedId: string,
): Array<{ noteId: string; dangling: string[]; remaining: string[] }> {
  const results: Array<{ noteId: string; dangling: string[]; remaining: string[] }> = [];
  for (const note of notes) {
    const dangling = note.links.filter((id) => id === deletedId);
    if (dangling.length === 0) continue; // untouched — not in the result set
    const remaining = note.links.filter((id) => id !== deletedId);
    results.push({ noteId: note.id, dangling, remaining });
  }
  return results;
}

interface ScoredNote {
  id: string;
  cosine: number;
  updated: number;
}

/**
 * §22.3 VERBATIM bag-of-words cosine: tokenise each note's content, per-note
 * term-frequency map, cosine = dot(a,b) / (||a||·||b||) (0 when either norm is
 * 0). Rank desc; ties by updated desc then id asc; returns the top-k OTHER
 * note ids (noteId itself excluded). Default k = 5. Pure + deterministic.
 */
export function topKSimilar(
  notes: readonly Pick<Note, 'id' | 'title' | 'content' | 'updated'>[],
  noteId: string,
  k = 5,
): string[] {
  const target = notes.find((n) => n.id === noteId);
  if (!target) return [];

  const termFreqs = new Map<string, Map<string, number>>();
  for (const note of notes) {
    const freq = new Map<string, number>();
    for (const token of tokenise(note.content)) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
    termFreqs.set(note.id, freq);
  }

  const targetFreq = termFreqs.get(noteId)!;
  const targetNorm = norm(targetFreq);

  const scored: ScoredNote[] = [];
  for (const note of notes) {
    if (note.id === noteId) continue; // exclude the query note itself
    const freq = termFreqs.get(note.id)!;
    const cosine = cosineBetween(targetFreq, targetNorm, freq, norm(freq));
    if (cosine === 0) continue; // no shared tokens — excluded (§22.3)
    scored.push({ id: note.id, cosine, updated: note.updated });
  }

  scored.sort(
    (a, b) => b.cosine - a.cosine || b.updated - a.updated || (a.id < b.id ? -1 : 1),
  );
  return scored.slice(0, k).map((s) => s.id);
}

/** L2 norm of a term-frequency map. */
function norm(freq: Map<string, number>): number {
  let sum = 0;
  for (const count of freq.values()) sum += count * count;
  return Math.sqrt(sum);
}

/** dot(a,b) / (||a||·||b||) — 0 when either norm is 0 (§22.3). */
function cosineBetween(
  a: Map<string, number>,
  aNorm: number,
  b: Map<string, number>,
  bNorm: number,
): number {
  if (aNorm === 0 || bNorm === 0) return 0;
  let dot = 0;
  for (const [token, count] of a) {
    const bCount = b.get(token);
    if (bCount !== undefined) dot += count * bCount;
  }
  return dot / (aNorm * bNorm);
}
