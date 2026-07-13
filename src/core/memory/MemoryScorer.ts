import type { UserMemoryFact } from './memoryTypes';

const DAY_MS = 86400000;
const RECENCY_WINDOW_DAYS = 30;

export interface ScoredFact {
  fact: UserMemoryFact;
  finalScore: number;
}

export class MemoryScorer {
  score(
    candidate: { fact: UserMemoryFact; keywordScore: number },
    _query: string,
    matchedTags: string[],
  ): number {
    const now = Date.now();

    const keywordScore = candidate.keywordScore;
    const tagScore =
      Math.min(matchedTags.length, candidate.fact.tags.length) /
      Math.max(1, candidate.fact.tags.length);
    const recencyScore = Math.max(
      0,
      Math.min(1, 1 - (now - candidate.fact.updated) / (RECENCY_WINDOW_DAYS * DAY_MS)),
    );
    const useCountScore = Math.min(1, (candidate.fact.useCount ?? 0) / 20);
    const confidenceScore = candidate.fact.confidence;

    return (
      keywordScore * 0.45 +
      tagScore * 0.25 +
      recencyScore * 0.15 +
      useCountScore * 0.10 +
      confidenceScore * 0.05
    );
  }

  tieBreak(results: ScoredFact[]): ScoredFact[] {
    return results.sort((a, b) => {
      return (
        b.finalScore - a.finalScore ||
        b.fact.confidence - a.fact.confidence ||
        (b.fact.updated - a.fact.updated) ||
        ((b.fact.useCount ?? 0) - (a.fact.useCount ?? 0)) ||
        a.fact.id.localeCompare(b.fact.id)
      );
    });
  }
}

export const memoryScorer = new MemoryScorer();
