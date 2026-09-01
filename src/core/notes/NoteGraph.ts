// NoteGraph — D-111 / §22.3 verbatim graph core (spec 3508-3514).
//
// Pure-function module (TokenBudget.ts style): bag-of-words cosine similarity
// over note content + a reverse-index backlinks map over links[]. No storage-area
// imports — operates on Note[] passed in (grep-assertable).
//
// §22.3 verbatim:
//   tokenise: content.toLowerCase().match(/[a-z0-9]{3,}/g)
//   stop-list: fixed 50-word English list shipped inline (spec 3511)
//   per-note term-frequency map (normalised by total tokens)
//   cosine = dot(a,b) / (||a|| * ||b||)
//   ties broken by updated desc then id asc (spec 3508-3514; contextItems.ts sort)
//
// Pitfall 8: STOP_WORDS count is the contract (exactly 50); vocabulary is
// executor discretion bounded by a length-50 test. No lemma/POS filtering.

import type { Note } from '../../types/notes';

/**
 * Fixed 50-word English stop-word list (spec 3511 — count + inline location;
 * vocabulary is executor discretion bounded by `expect(STOP_WORDS).toHaveLength(50)`).
 * Exactly 50 entries — pinned by NoteGraph.test.ts.
 */
export const STOP_WORDS: readonly string[] = [
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by',
  'for', 'from', 'has', 'have', 'he', 'her', 'his', 'i', 'in',
  'is', 'it', 'its', 'of', 'on', 'or', 'she', 'that', 'the',
  'their', 'them', 'they', 'this', 'to', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'who', 'will', 'with', 'you',
  'your', 'not', 'so', 'do', 'no', 'if', 'can',
];

const STOP_SET = new Set(STOP_WORDS);

/**
 * Tokeniser (spec 3508 verbatim): lowercase, match [a-z0-9]{3,}, drop stop-words.
 */
export function tokenise(content: string): string[] {
  const tokens = content.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return tokens.filter((t) => !STOP_SET.has(t));
}

/**
 * Build a normalised term-frequency map from tokens (count / total tokens).
 * Zero-length input → empty map (zero-norm guard lives in cosine).
 */
export function buildTf(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  if (tokens.length === 0) return tf;
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  const total = tokens.length;
  for (const [k, v] of tf) {
    tf.set(k, v / total);
  }
  return tf;
}

/** Cosine similarity between two TF maps. Zero-norm → 0 (no crash). */
export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [k, va] of a) {
    normA += va * va;
    const vb = b.get(k);
    if (vb !== undefined) dot += va * vb;
  }
  for (const [, vb] of b) {
    normB += vb * vb;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/** A note + its similarity score (topKSimilar result element). */
export interface SimilarNote {
  note: Note;
  score: number;
}

/**
 * Top-k most similar notes to `note` among `allNotes` (§22.3 verbatim).
 * Cosine over TF maps; ties broken by updated desc then id asc (spec 3508-3514).
 * The target note itself is excluded. k defaults to 5.
 */
export function topKSimilar(note: Note, allNotes: Note[], k = 5): SimilarNote[] {
  const targetTf = buildTf(tokenise(note.content));
  const results: SimilarNote[] = [];
  for (const other of allNotes) {
    if (other.id === note.id) continue;
    const otherTf = buildTf(tokenise(other.content));
    const score = cosine(targetTf, otherTf);
    results.push({ note: other, score });
  }
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.note.updated !== a.note.updated) return b.note.updated - a.note.updated;
    return a.note.id < b.note.id ? -1 : a.note.id > b.note.id ? 1 : 0;
  });
  return results.slice(0, k);
}

/**
 * Reverse index over links[] (D-111): for each note, for each id in note.links,
 * map id → referencing note ids (deduplicated).
 *
 * WIKI-ID-04 semantics: membership is computed against the LIVE note set
 * passed in — notes not in the set contribute nothing (their dangling links
 * are not re-added; demotion lives in LinkParser.demoteDangling).
 */
export function computeBacklinks(notes: Note[]): Map<string, string[]> {
  const backlinks = new Map<string, string[]>();
  const liveIds = new Set(notes.map((n) => n.id));
  for (const note of notes) {
    for (const targetId of note.links) {
      // WIKI-ID-04: only live targets get backlink entries — a link to a
      // note not in the set contributes nothing (demotion lives in
      // LinkParser.demoteDangling; here we just don't re-add the edge).
      if (!liveIds.has(targetId)) continue;
      const existing = backlinks.get(targetId);
      if (existing) {
        if (!existing.includes(note.id)) existing.push(note.id);
      } else {
        backlinks.set(targetId, [note.id]);
      }
    }
  }
  return backlinks;
}
