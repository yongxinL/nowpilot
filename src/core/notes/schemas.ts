/**
 * schemas.ts — LLM-Wiki Zod schemas + suggestion gating (LLM-WIKI-11,
 * Appendix C.1 spec 4764-4786).
 *
 * Canonical validation shapes for the three LLM-enrichment call sites:
 *   - NoteTagResult  — auto-tag / categorize / summarize / extract facts
 *   - NoteQAResult   — RAG "Ask notes" synthesis with citations
 *   - NoteDraft      — chat/page → structured note draft
 *
 * `gateSuggestions()` enforces the LLM-WIKI-11 confidence threshold +
 * per-save caps. Pure function — no I/O, no side effects.
 */

import { z } from 'zod';
import {
  NOTE_SUGGESTION_DISPLAY_THRESHOLD,
  NOTE_SUGGESTION_MAX_TAGS_PER_SAVE,
  NOTE_SUGGESTION_MAX_FACTS_PER_SAVE,
} from '../../types/notes';

// ---------------------------------------------------------------------------
// NoteTagResult — single fast-tier structured JSON call (D-115, LLM-WIKI-01)
// ---------------------------------------------------------------------------

export const NoteTagResultSchema = z.object({
  tags: z.array(
    z.object({
      value: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ).max(10),
  categoryPath: z.string().nullable(),
  summary: z.string(),
  memoryFacts: z.array(
    z.object({
      content: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ).max(10).default([]),
});

export type NoteTagResult = z.infer<typeof NoteTagResultSchema>;

// ---------------------------------------------------------------------------
// NoteQAResult — RAG synthesis with citations (LLM-WIKI-06)
// ---------------------------------------------------------------------------

export const NoteQAResultSchema = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({
      noteId: z.string(),
      title: z.string(),
      snippet: z.string(),
    }),
  ).max(5),
  confidence: z.number().min(0).max(1),
});

export type NoteQAResult = z.infer<typeof NoteQAResultSchema>;

// ---------------------------------------------------------------------------
// NoteDraft — chat/page → structured note draft (LLM-WIKI-07)
// ---------------------------------------------------------------------------

export const NoteDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  wikilinks: z.array(z.string()).default([]),
  categoryPath: z.string().nullable(),
  summary: z.string().optional(),
});

export type NoteDraft = z.infer<typeof NoteDraftSchema>;

// ---------------------------------------------------------------------------
// gateSuggestions — LLM-WIKI-11 confidence gating + per-save caps
// ---------------------------------------------------------------------------

export interface GatedSuggestions {
  tags: string[];
  memoryFacts: string[];
}

/**
 * Filter + cap LLM suggestions per LLM-WIKI-11:
 *   - Discard items below NOTE_SUGGESTION_DISPLAY_THRESHOLD (0.60).
 *   - Sort descending confidence.
 *   - Cap at NOTE_SUGGESTION_MAX_TAGS_PER_SAVE (5) / NOTE_SUGGESTION_MAX_FACTS_PER_SAVE (3).
 *
 * @param r — validated NoteTagResult from the LLM call.
 * @returns Gated tags (string values) and memoryFacts (content strings).
 */
export function gateSuggestions(r: NoteTagResult): GatedSuggestions {
  const pick = <T extends { confidence: number }>(arr: T[], cap: number): T[] =>
    arr
      .filter((x) => x.confidence >= NOTE_SUGGESTION_DISPLAY_THRESHOLD)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, cap);

  return {
    tags: pick(r.tags, NOTE_SUGGESTION_MAX_TAGS_PER_SAVE).map((t) => t.value),
    memoryFacts: pick(r.memoryFacts, NOTE_SUGGESTION_MAX_FACTS_PER_SAVE).map((f) => f.content),
  };
}

// ---------------------------------------------------------------------------
// categoryPath normalization (CAT-01/05)
// ---------------------------------------------------------------------------

/**
 * Normalize a categoryPath per CAT-01/05:
 *   - Strip leading/trailing slashes.
 *   - Collapse duplicate '/' separators.
 *   - Trim each segment.
 *   - Reject empty, '.', '..' segments (dropped).
 *   - Return null for null/empty/whitespace-only input.
 *
 * @param path — raw categoryPath (e.g. "  foo//bar/  ").
 * @returns Normalized path (e.g. "foo/bar") or null.
 */
export function normalizeCategoryPath(path: string | null): string | null {
  if (path === null || path.trim() === '') return null;
  const segments = path
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s !== '' && s !== '.' && s !== '..');
  if (segments.length === 0) return null;
  return segments.join('/');
}
