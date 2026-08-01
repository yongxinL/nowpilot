import type { Note } from './NoteSchema';

/**
 * Graph edge contract for downstream UI (UI-SPEC §Data-Type Contracts).
 * wikilink = explicit [[link]] in content; backlink = reverse of links[].
 */
export interface NoteGraphEdge {
  sourceNoteId: string;
  targetNoteId: string;
  edgeType: 'wikilink' | 'backlink';
  strength: number;
}

/**
 * Related-note contract (UI-SPEC) — hybrid similarity per D-13:
 * 50% linkOverlap (Jaccard) + 20% tagOverlap (Jaccard) + 30% contentCosine.
 */
export interface RelatedNote {
  noteId: string;
  score: number;
  sharedLinks: number;
  sharedTags: number;
}

/** Inline 50-word English stop-word list (RESEARCH §Similarity & Graph Computation). */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are', 'was',
  'not', 'but', 'you', 'all', 'can', 'had', 'her', 'one', 'our', 'out',
  'has', 'been', 'were', 'some', 'its', 'who', 'when', 'may', 'more', 'would',
  'will', 'there', 'their', 'what', 'about', 'into', 'than', 'them', 'other',
  'could', 'said', 'also', 'over', 'after', 'where', 'only', 'very', 'these',
  'between',
]);

/**
 * Tokenize text for bag-of-words similarity: lowercase, alphanumeric tokens
 * of 3+ chars, stop words removed (RESEARCH §22.3).
 */
export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return raw.filter((t) => !STOP_WORDS.has(t));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return freq;
}

/**
 * Bag-of-words cosine similarity: dot(freqA, freqB) / (||freqA|| * ||freqB||).
 * Returns 0 when either text is empty (RESEARCH §22.3).
 */
export function cosineSimilarity(a: string, b: string): number {
  const freqA = termFrequency(tokenize(a));
  const freqB = termFrequency(tokenize(b));

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  const allTerms = new Set([...freqA.keys(), ...freqB.keys()]);
  for (const term of allTerms) {
    const aVal = freqA.get(term) ?? 0;
    const bVal = freqB.get(term) ?? 0;
    dotProduct += aVal * bVal;
    magA += aVal * aVal;
    magB += bVal * bVal;
  }

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Standard Jaccard set similarity — returns 0 when both sets are empty. */
export function jaccardSimilarity<T>(setA: Set<T>, setB: Set<T>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const x of setA) {
    if (setB.has(x)) intersection++;
  }
  const union = new Set([...setA, ...setB]);
  return intersection / union.size;
}

/**
 * Hybrid similarity per D-13: 50% linkOverlap + 20% tagOverlap + 30%
 * contentCosine over `${title} ${content}`.
 */
export function computeSimilarity(noteA: Note, noteB: Note): number {
  const linkOverlap = jaccardSimilarity(new Set(noteA.links), new Set(noteB.links));
  const tagOverlap = jaccardSimilarity(new Set(noteA.tags), new Set(noteB.tags));
  const contentSim = cosineSimilarity(
    `${noteA.title} ${noteA.content}`,
    `${noteB.title} ${noteB.content}`,
  );
  return linkOverlap * 0.5 + tagOverlap * 0.2 + contentSim * 0.3;
}

/**
 * NoteGraph — in-memory graph computations over note snapshots (D-01, D-13).
 * Backlinks are NEVER stored: they are derived from links[] on demand.
 * No IndexedDB storage — all computation is stateless over the provided notes.
 */
export class NoteGraph {
  private static _instance: NoteGraph | null = null;

  private constructor() {}

  /** Singleton accessor (RESEARCH Pattern 1). */
  static getInstance(): NoteGraph {
    if (!NoteGraph._instance) {
      NoteGraph._instance = new NoteGraph();
    }
    return NoteGraph._instance;
  }

  /** Test isolation: drop the cached singleton. */
  static resetInstance(): void {
    NoteGraph._instance = null;
  }

  /** IDs of all notes whose links[] contains noteId (D-01: computed, never stored). */
  getBacklinks(noteId: string, allNotes: Note[]): string[] {
    return allNotes.filter((n) => n.links.includes(noteId)).map((n) => n.id);
  }

  /**
   * Related notes ranked by hybrid similarity (D-13), excluding the source
   * note itself, capped at `limit` (default 10) — computed on demand (T-05-04).
   */
  getRelatedNotes(noteId: string, allNotes: Note[], limit = 10): RelatedNote[] {
    const source = allNotes.find((n) => n.id === noteId);
    if (!source) return [];

    return allNotes
      .filter((n) => n.id !== noteId)
      .map((n) => ({
        noteId: n.id,
        score: computeSimilarity(source, n),
        sharedLinks: n.links.filter((l) => source.links.includes(l)).length,
        sharedTags: n.tags.filter((t) => source.tags.includes(t)).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Triggers recomputation after a note save. In Phase 5 this is a no-op
   * wrapper (computation is stateless); Phase 5a/7 may add caching here.
   */
  recompute(noteId: string, allNotes: Note[]): void {
    this.getRelatedNotes(noteId, allNotes);
  }

  /**
   * Graph edges for a note: wikilink edges from links[] (strength 1.0) plus
   * backlink edges computed from all other notes' links[] (strength 1.0).
   */
  computeEdges(noteId: string, allNotes: Note[]): NoteGraphEdge[] {
    const note = allNotes.find((n) => n.id === noteId);
    if (!note) return [];

    const edges: NoteGraphEdge[] = [];
    for (const targetId of note.links) {
      edges.push({
        sourceNoteId: noteId,
        targetNoteId: targetId,
        edgeType: 'wikilink',
        strength: 1.0,
      });
    }
    for (const sourceId of this.getBacklinks(noteId, allNotes)) {
      edges.push({
        sourceNoteId: sourceId,
        targetNoteId: noteId,
        edgeType: 'backlink',
        strength: 1.0,
      });
    }
    return edges;
  }
}

/** Singleton accessor. */
export function getNoteGraph(): NoteGraph {
  return NoteGraph.getInstance();
}

/** Module-level singleton instance. */
export const noteGraph = getNoteGraph();
