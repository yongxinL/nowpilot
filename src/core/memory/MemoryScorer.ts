// src/core/memory/MemoryScorer.ts — D-05-05: §3.4 retrieval scoring VERBATIM
// (PRODUCT_SPEC L598-616). Pure + deterministic: the only clock is the injected
// nowMs (contextFeed.ts L13 determinism-rule precedent) — no time/randomness/
// platform primitives anywhere in this module. Every sub-score is normalised to
// [0,1]; the returned score is the §3.4 weighted sum with the verbatim
// coefficients (keyword 0.45 / tag 0.25 / recency 0.15 / useCount 0.10 /
// confidence 0.05).
//
// MemoryEngine.assemble (05-04) consumes this through UserMemoryStore.retrieve
// — the [0,1] + sort-desc contract is what the top-5 (top-3 tiny) slicing
// relies on, so this module stays pure and side-effect free.
//
// prettier-ignore (return statement): the §3.4 coefficient literal `0.10` must
// survive verbatim — prettier normalizes trailing zeros (0.10 → 0.1), which
// would break the acceptance grep pin. The ignored statement is prettier-shaped
// apart from that one literal, so formatting drift is nil.
import type { UserMemoryFact } from './types';

/** §3.4: the 30-day recency window (named constant — not a magic number). */
export const RECENCY_WINDOW_MS = 30 * 86_400_000;

/**
 * §3.4 VERBATIM (L598-616): weighted retrieval score in [0,1]. queryTerms are
 * the lowercased query tokens; keywordScore = matched/total terms against the
 * fact content; tagScore = matched/max(1, tags) against the terms; recencyScore
 * clamps 1 − age/30d to [0,1]; useCountScore caps at min(1, useCount/20);
 * confidenceScore passes through. Every sub-score is normalised to [0,1].
 */
export function scoreMemoryFact(fact: UserMemoryFact, queryTerms: string[], nowMs: number): number {
  const keywordScore =
    queryTerms.filter((t) => fact.content.toLowerCase().includes(t.toLowerCase())).length /
    Math.max(1, queryTerms.length);
  const tagScore =
    fact.tags.filter((t) => queryTerms.includes(t.toLowerCase())).length /
    Math.max(1, fact.tags.length);
  const recencyScore = Math.min(1, Math.max(0, 1 - (nowMs - fact.updatedAt) / RECENCY_WINDOW_MS));
  const useCountScore = Math.min(1, fact.useCount / 20);
  // prettier-ignore
  return (
    keywordScore * 0.45 +
    tagScore * 0.25 +
    recencyScore * 0.15 +
    useCountScore * 0.10 +
    fact.confidence * 0.05
  );
}
