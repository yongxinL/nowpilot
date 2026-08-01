import { RetrievedMemorySchema, type RetrievedMemory, type UserMemoryFact } from './MemoryRecord';

/**
 * D-08 retrieval scoring weights — relevance-primary: keyword 35% + tag 25%
 * (60% relevance), recency 20%, confidence 10%, useCount 10%.
 */
export const WEIGHTS = {
  keyword: 0.35,
  tag: 0.25,
  recency: 0.2,
  confidence: 0.1,
  useCount: 0.1,
} as const;

/** D-09 minimum retrieval score — facts below this are excluded even within top-K. */
export const MIN_SCORE = 0.3;

/** Cap for the useCount sub-score (useCount/20 → [0,1]). */
export const USE_COUNT_CAP = 20;

/** D-09 tier-gated limits — count is a maximum, not a guarantee. */
export const TIER_LIMITS: Record<string, number> = { tiny: 3, small: 5, medium: 5, large: 5 };

/** Recency linear-decay window: 30 days (D-08). */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Tokenize a query for matching: lowercase, split on whitespace, drop empty
 * terms, require minimum 2 characters per term.
 */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/**
 * D-08 weighted composite score for a single user fact. All sub-scores are
 * normalized to [0,1]: keywordMatch = matched query terms / query terms,
 * tagMatch = matched tags / fact tags, recency = linear decay over 30 days,
 * useCount = min(1, useCount/20), confidenceScore = immutable fact confidence.
 * Pure function — no side effects, reads confidence but never writes it (D-07).
 */
export function scoreFact(fact: UserMemoryFact, queryTerms: string[], now: number = Date.now()): number {
  // keywordMatch: proportion of query terms found in content
  const content = fact.content.toLowerCase();
  const matchedTerms = queryTerms.filter((t) => content.includes(t));
  const keywordScore = queryTerms.length > 0 ? matchedTerms.length / queryTerms.length : 0;

  // tagMatch: proportion of fact tags matched by query terms
  const queryTagSet = new Set(queryTerms);
  const matchedTags = fact.tags.filter((t) => queryTagSet.has(t.toLowerCase()));
  const tagScore = fact.tags.length > 0 ? matchedTags.length / fact.tags.length : 0;

  // recency: linear decay over 30 days
  const recencyScore = Math.max(0, Math.min(1, 1 - (now - fact.updatedAt) / THIRTY_DAYS_MS));

  // useCount: capped at USE_COUNT_CAP
  const useCountScore = Math.min(1, fact.useCount / USE_COUNT_CAP);

  // D-08 weighted composite
  return (
    keywordScore * WEIGHTS.keyword +
    tagScore * WEIGHTS.tag +
    recencyScore * WEIGHTS.recency +
    fact.confidence * WEIGHTS.confidence +
    useCountScore * WEIGHTS.useCount
  );
}

function relevanceReasons(fact: UserMemoryFact, queryTerms: string[]): string[] {
  const reasons: string[] = [];
  const content = fact.content.toLowerCase();
  for (const term of queryTerms) {
    if (content.includes(term)) {
      reasons.push(`keyword-match: '${term}'`);
    }
  }
  const tagSet = new Set(fact.tags.map((t) => t.toLowerCase()));
  for (const term of queryTerms) {
    if (tagSet.has(term)) {
      reasons.push(`tag-match: '${term}'`);
    }
  }
  return reasons;
}

/**
 * D-09 tier-gated retrieval: score all facts, drop those below MIN_SCORE,
 * sort descending, cap at TIER_LIMITS[tier], wrap in RetrievedMemory with
 * human-readable relevance reasons. Pure function — deterministic output.
 */
export function getTopFacts(facts: UserMemoryFact[], query: string, tier: string): RetrievedMemory[] {
  const queryTerms = tokenizeQuery(query);

  const scored = facts
    .map((fact) => ({
      fact,
      score: scoreFact(fact, queryTerms),
      reasons: relevanceReasons(fact, queryTerms),
    }))
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.small;
  return scored.slice(0, limit).map((s) =>
    RetrievedMemorySchema.parse({
      record: s.fact,
      retrievalScore: s.score,
      relevanceReasons: s.reasons,
    }),
  );
}
