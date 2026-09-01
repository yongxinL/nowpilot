// MemoryScorer — D-113 §3.4 verbatim scoring (PRODUCT_SPEC_v0_1.md:618-628).
//
// Pure-function module: scoreMemory(memory, queryTerms, now) returns a
// weighted blend in [0,1]. Every sub-score is independently normalised to
// [0,1] (ROADMAP SC#3). No invented fields/weights (D-38).
//
// Spec formula (verbatim):
//   keywordScore    = matchedQueryTerms / totalQueryTerms
//   tagScore        = matchedTags / max(1, memoryTags.length)
//   recencyScore    = clamp(1 - (now - updatedAt) / (30 * DAY), 0, 1)
//   useCountScore   = min(1, useCount / 20)
//   confidenceScore = confidence (0..1)
//   score = keyword*0.45 + tag*0.25 + recency*0.15 + useCount*0.10 + confidence*0.05
import type { UserMemoryFact } from './types';

/** ms per day — used by the 30-day recency window. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** §3.4 verbatim weight: keyword relevance (spec 618-628). */
export const MEMORY_SCORE_KEYWORD = 0.45;
/** §3.4 verbatim weight: tag overlap (spec 618-628). */
export const MEMORY_SCORE_TAG = 0.25;
/** §3.4 verbatim weight: recency decay (spec 618-628). */
export const MEMORY_SCORE_RECENCY = 0.15;
/** §3.4 verbatim weight: use-count popularity (spec 618-628). */
export const MEMORY_SCORE_USE_COUNT = 0.1;
/** §3.4 verbatim weight: extraction confidence (spec 618-628). */
export const MEMORY_SCORE_CONFIDENCE = 0.05;
/** §3.4 verbatim recency window = 30 days (spec 618). */
export const MEMORY_RECENCY_WINDOW_DAYS = 30;

/**
 * Score a single memory fact against a query (§3.4 verbatim).
 *
 * @param memory      — subset of UserMemoryFact fields needed by the formula
 *                      (tags for keyword/tag scoring; updatedAt, useCount,
 *                      confidence for the remaining sub-scores).
 * @param queryTerms  — tokenised query terms (lowercased inside).
 * @param now         — current epoch ms (injectable for deterministic tests).
 * @returns weighted blend in [0,1] (ROADMAP SC#3).
 */
export function scoreMemory(
  memory: Pick<UserMemoryFact, 'tags' | 'updatedAt' | 'useCount' | 'confidence'>,
  queryTerms: string[],
  now: number,
): number {
  const tags = memory.tags.map((t) => t.toLowerCase());
  const terms = queryTerms.map((t) => t.toLowerCase());

  // keywordScore: fraction of query terms that are substrings of at least
  // one tag (case-insensitive). Empty query → 0 (no signal).
  const matchedQueryTerms = terms.filter((term) =>
    tags.some((tag) => tag.includes(term)),
  ).length;
  const keywordScore = terms.length === 0 ? 0 : matchedQueryTerms / terms.length;

  // tagScore: fraction of the fact's tags that contain at least one query
  // term as a substring (case-insensitive). No tags → 0.
  const matchedTags = tags.filter((tag) =>
    terms.some((term) => tag.includes(term)),
  ).length;
  const tagScore = tags.length === 0 ? 0 : matchedTags / tags.length;

  // recencyScore: linear decay over MEMORY_RECENCY_WINDOW_DAYS, clamped to
  // [0,1]. Fresh (updatedAt == now) → 1; older than 30 days → 0.
  const elapsed = now - memory.updatedAt;
  const recencyScore = Math.max(
    0,
    Math.min(1, 1 - elapsed / (MEMORY_RECENCY_WINDOW_DAYS * DAY_MS)),
  );

  // useCountScore: saturates at 20 uses → 1.
  const useCountScore = Math.min(1, memory.useCount / 20);

  // confidenceScore: the fact's own confidence, clamped to [0,1].
  const confidenceScore = Math.max(0, Math.min(1, memory.confidence));

  return (
    keywordScore * MEMORY_SCORE_KEYWORD +
    tagScore * MEMORY_SCORE_TAG +
    recencyScore * MEMORY_SCORE_RECENCY +
    useCountScore * MEMORY_SCORE_USE_COUNT +
    confidenceScore * MEMORY_SCORE_CONFIDENCE
  );
}
