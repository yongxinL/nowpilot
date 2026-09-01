import { describe, it, expect } from 'vitest';
import {
  scoreMemory,
  MEMORY_SCORE_KEYWORD,
  MEMORY_SCORE_TAG,
  MEMORY_SCORE_RECENCY,
  MEMORY_SCORE_USE_COUNT,
  MEMORY_SCORE_CONFIDENCE,
  MEMORY_RECENCY_WINDOW_DAYS,
} from '../../../src/core/memory/MemoryScorer';
import type { UserMemoryFact } from '../../../src/core/memory/types';

/** Helper: build a minimal UserMemoryFact with overrides for scoring fields. */
function makeFact(overrides: Partial<UserMemoryFact> = {}): UserMemoryFact {
  return {
    id: 'f1',
    content: 'test content',
    type: 'fact',
    tags: ['javascript', 'testing'],
    confidence: 0.8,
    source: 'explicit',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    useCount: 5,
    ...overrides,
  };
}

describe('MemoryScorer — §3.4 verbatim (D-113)', () => {
  it('VERBATIM WEIGHTS: exported constants match spec 618-628', () => {
    expect(MEMORY_SCORE_KEYWORD).toBe(0.45);
    expect(MEMORY_SCORE_TAG).toBe(0.25);
    expect(MEMORY_SCORE_RECENCY).toBe(0.15);
    expect(MEMORY_SCORE_USE_COUNT).toBe(0.1);
    expect(MEMORY_SCORE_CONFIDENCE).toBe(0.05);
    expect(MEMORY_RECENCY_WINDOW_DAYS).toBe(30);
  });

  it('PERFECT HIT: keyword+tag+recency+useCount+confidence all max → ≈1.0', () => {
    const now = 1_700_000_000_000;
    const fact = makeFact({
      tags: ['javascript', 'testing'],
      updatedAt: now,
      useCount: 20,
      confidence: 1.0,
    });
    const score = scoreMemory(fact, ['javascript', 'testing'], now);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('ZERO HIT: no keyword/tag match, old, no use, zero confidence → ≈0.0', () => {
    const now = 1_700_000_000_000;
    const fact = makeFact({
      tags: ['javascript', 'testing'],
      updatedAt: now - 40 * 24 * 60 * 60 * 1000, // 40 days ago
      useCount: 0,
      confidence: 0,
    });
    const score = scoreMemory(fact, ['python', 'ml'], now);
    expect(score).toBeCloseTo(0.0, 5);
  });

  it('SUB-SCORE BOUNDS: any input → score ∈ [0,1] (ROADMAP SC#3)', () => {
    const now = 1_700_000_000_000;
    const cases: Array<{ tags: string[]; updatedAt: number; useCount: number; confidence: number }> = [
      { tags: [], updatedAt: now, useCount: 0, confidence: 0 },
      { tags: ['a', 'b', 'c'], updatedAt: now - 100 * 86400000, useCount: 999, confidence: 1 },
      { tags: ['x'], updatedAt: now, useCount: 10, confidence: 0.5 },
    ];
    for (const c of cases) {
      const fact = makeFact(c);
      const score = scoreMemory(fact, ['a', 'x', 'nomatch'], now);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('RECENCY: updatedAt = now-1d → ≈1, updatedAt = now-40d → 0 (30-day window)', () => {
    const now = 1_700_000_000_000;
    const fact1 = makeFact({ updatedAt: now - 1 * 86400000, useCount: 0, confidence: 0, tags: [] });
    const score1 = scoreMemory(fact1, ['nomatch'], now);
    // Only recency contributes (≈0.15 * 0.967)
    expect(score1).toBeGreaterThan(0.14);
    expect(score1).toBeLessThanOrEqual(0.15);

    const fact2 = makeFact({ updatedAt: now - 40 * 86400000, useCount: 0, confidence: 0, tags: [] });
    const score2 = scoreMemory(fact2, ['nomatch'], now);
    expect(score2).toBeCloseTo(0.0, 5);
  });

  it('USE COUNT: 0 → 0, 20 → 1, 50 → clamped 1', () => {
    const now = 1_700_000_000_000;
    // Zero out recency (40d old) + confidence + tags so useCount is the
    // only contributor.
    const base = { updatedAt: now - 40 * 86400000, confidence: 0, tags: [] };

    const s0 = scoreMemory(makeFact({ ...base, useCount: 0 }), ['nomatch'], now);
    expect(s0).toBeCloseTo(0.0, 5);

    const s20 = scoreMemory(makeFact({ ...base, useCount: 20 }), ['nomatch'], now);
    expect(s20).toBeCloseTo(MEMORY_SCORE_USE_COUNT, 5); // 0.10

    const s50 = scoreMemory(makeFact({ ...base, useCount: 50 }), ['nomatch'], now);
    expect(s50).toBeCloseTo(MEMORY_SCORE_USE_COUNT, 5); // clamped
  });

  it('TAG MATCHING: partial tag overlap → proportional tagScore', () => {
    const now = 1_700_000_000_000;
    // 2 tags, query matches 1 → tagScore = 0.5 → contributes 0.25 * 0.5 = 0.125.
    // Zero out recency (40d old) + useCount + confidence so keyword + tag
    // are the only contributors.
    const fact = makeFact({
      tags: ['javascript', 'python'],
      updatedAt: now - 40 * 86400000,
      useCount: 0,
      confidence: 0,
    });
    const score = scoreMemory(fact, ['javascript'], now);
    // keywordScore = 1 (1/1), tagScore = 0.5 (1/2)
    const expected = MEMORY_SCORE_KEYWORD * 1 + MEMORY_SCORE_TAG * 0.5;
    expect(score).toBeCloseTo(expected, 5);
  });

  it('DETERMINISM: same inputs → same score', () => {
    const now = 1_700_000_000_000;
    const fact = makeFact();
    const s1 = scoreMemory(fact, ['javascript'], now);
    const s2 = scoreMemory(fact, ['javascript'], now);
    expect(s1).toBe(s2);
  });

  it('EMPTY QUERY: no query terms → keywordScore 0, tagScore 0', () => {
    const now = 1_700_000_000_000;
    const fact = makeFact({ updatedAt: now, useCount: 20, confidence: 1.0, tags: ['a', 'b'] });
    const score = scoreMemory(fact, [], now);
    // Only recency (1) + useCount (1) + confidence (1) contribute
    const expected =
      MEMORY_SCORE_RECENCY * 1 + MEMORY_SCORE_USE_COUNT * 1 + MEMORY_SCORE_CONFIDENCE * 1;
    expect(score).toBeCloseTo(expected, 5);
  });
});
