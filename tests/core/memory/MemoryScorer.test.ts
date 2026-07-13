import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { UserMemoryFact } from '../../../src/core/memory/memoryTypes';
import { MemoryScorer } from '../../../src/core/memory/MemoryScorer';

const T0 = 1_000_000_000_000;
const DAY_MS = 86400000;

function makeFact(overrides: Partial<UserMemoryFact> = {}): UserMemoryFact {
  return {
    id: `fact-${Math.random().toString(36).slice(2, 8)}`,
    fact: 'some fact content',
    category: 'general',
    confidence: 0.8,
    created: T0,
    updated: T0,
    source: 'test',
    status: 'active',
    tags: ['test'],
    useCount: 0,
    lastUsedAt: T0,
    ...overrides,
  };
}

describe('MemoryScorer', () => {
  let scorer: MemoryScorer;

  beforeEach(() => {
    scorer = new MemoryScorer();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('score', () => {
    it('should give a fact with high keyword relevance, matching tags, recent timestamp, high use count, and high confidence a score near 1.0', () => {
      const fact = makeFact({
        id: 'high-1',
        fact: 'Typescript is a typed superset of JavaScript',
        category: 'programming',
        confidence: 1.0,
        tags: ['typescript', 'javascript', 'programming', 'language'],
        useCount: 50,
        updated: T0,
      });

      const kwScore = scorer.score(
        { fact, keywordScore: 1.0 },
        'typescript',
        ['typescript', 'javascript', 'programming', 'language'],
      );

      // All sub-scores are 1.0: 1.0*0.45 + 1.0*0.25 + 1.0*0.15 + 1.0*0.10 + 1.0*0.05 = 1.0
      expect(kwScore).toBeCloseTo(1.0, 4);
    });

    it('should give an old, low-confidence fact with no matching tags a score near 0.0', () => {
      const thirtyOneDaysAgo = T0 - 31 * DAY_MS;
      const fact = makeFact({
        id: 'low-1',
        fact: 'obsolete information',
        category: 'general',
        confidence: 0.05,
        tags: ['old', 'deprecated'],
        useCount: 0,
        updated: thirtyOneDaysAgo,
      });

      const lowScore = scorer.score(
        { fact, keywordScore: 0.0 },
        'something',
        [],
      );

      // keywordScore = 0, tagScore = 0/2 = 0, recencyScore = 1 - 31/30 = negative → 0
      // useCountScore = 0, confidenceScore = 0.05
      // Expected: 0*0.45 + 0*0.25 + 0*0.15 + 0*0.10 + 0.05*0.05 = 0.0025
      expect(lowScore).toBeCloseTo(0.0025, 4);
    });

    it('should give keywordScore factor exactly 0.45 weight', () => {
      const thirtyOneDaysAgo = T0 - 31 * DAY_MS;
      const fact = makeFact({
        id: 'weight-1',
        fact: 'keyword match',
        category: 'general',
        confidence: 0.0,
        tags: ['unrelated', 'other'],
        useCount: 0,
        updated: thirtyOneDaysAgo,
      });

      const weightScore = scorer.score(
        { fact, keywordScore: 1.0 },
        'keyword',
        [],
      );

      // 1.0*0.45 + 0*0.25 + 0*0.15 + 0*0.10 + 0*0.05 = 0.45
      expect(weightScore).toBeCloseTo(0.45, 4);
    });

    it('should clamp tagScore to [0,1] — matchedTags cannot exceed fact.tags.length', () => {
      const fact = makeFact({
        id: 'tag-1',
        fact: 'tagged content',
        category: 'general',
        confidence: 0.0,
        tags: ['only-one-tag'],
        useCount: 0,
      });

      const clampedTagScore = scorer.score(
        { fact, keywordScore: 0.0 },
        'content',
        ['extra-tag', 'another-tag', 'unrelated'],
      );

      // Math.min(3, 1) / Math.max(1, 1) = 1/1 = 1.0
      // 0 + 1.0*0.25 + 1*0.15 + 0 + 0 = 0.40
      expect(clampedTagScore).toBeCloseTo(0.40, 4);
    });

    it('should compute recencyScore=0.5 for a fact updated 15 days ago', () => {
      const fifteenDaysAgo = T0 - 15 * DAY_MS;
      const fact = makeFact({
        id: 'recency-1',
        fact: 'moderately recent fact',
        category: 'general',
        confidence: 0.0,
        tags: ['recent'],
        useCount: 0,
        updated: fifteenDaysAgo,
      });

      const recencyScore = scorer.score(
        { fact, keywordScore: 0.0 },
        'test',
        [],
      );

      // recencyScore = 1 - (T0 - fifteenDaysAgo) / (30*DAY_MS) = 1 - 15/30 = 0.5
      // 0 + 0 + 0.5*0.15 + 0 + 0 = 0.075
      expect(recencyScore).toBeCloseTo(0.075, 4);
    });

    it('should compute useCountScore=0.5 for useCount=10, and cap useCount=30 at 1.0', () => {
      const fact10 = makeFact({
        id: 'use-10',
        fact: 'moderately used fact',
        category: 'general',
        confidence: 0.0,
        tags: ['used'],
        useCount: 10,
      });
      const score10 = scorer.score(
        { fact: fact10, keywordScore: 0.0 },
        'test',
        [],
      );

      // useCountScore = 10/20 = 0.5, recency=1
      // 0 + 0.25*0 + recency = 1 → 1*0.15 = 0.15 + 0.5*0.10 = 0.05 → total 0.20
      // Actually tagScore = 0/1 = 0
      // 0 + 0 + 1*0.15 + 0.5*0.10 + 0 = 0.20
      expect(score10).toBeCloseTo(0.20, 4);

      const fact30 = makeFact({
        id: 'use-30',
        fact: 'heavily used fact',
        category: 'general',
        confidence: 0.0,
        tags: ['used'],
        useCount: 30,
      });
      const score30 = scorer.score(
        { fact: fact30, keywordScore: 0.0 },
        'test',
        [],
      );

      // useCountScore = min(30/20, 1) = 1.0
      // 0 + 0 + 1*0.15 + 1.0*0.10 + 0 = 0.25
      expect(score30).toBeCloseTo(0.25, 4);
    });

    it('should handle facts with useCount=0 (equivalent to missing optional fields)', () => {
      const fact = makeFact({
        id: 'missing-1',
        fact: 'fact with no use count',
        category: 'general',
        confidence: 0.0,
        tags: ['test'],
        useCount: 0,
      });

      const missingScore = scorer.score(
        { fact, keywordScore: 0.0 },
        'test',
        ['test'], // tag match with fact's only tag
      );

      // tagScore = min(1, 1) / max(1, 1) = 1.0, recency=1, useCountScore=0/20=0
      // 0 + 1.0*0.25 + 1*0.15 + 0 + 0 = 0.40
      expect(missingScore).toBeCloseTo(0.40, 4);
    });
  });

  describe('tieBreak', () => {
    it('should sort 4 facts with identical scores by confidence then recency then useCount then id', () => {
      const now = T0;

      const factA = makeFact({
        id: 'A',
        fact: 'fact A',
        category: 'general',
        confidence: 0.9,
        tags: ['test'],
        useCount: 20,
        updated: now,
      });
      const factB = makeFact({
        id: 'B',
        fact: 'fact B',
        category: 'general',
        confidence: 0.9,
        tags: ['test'],
        useCount: 10,
        updated: now,
      });
      const factC = makeFact({
        id: 'C',
        fact: 'fact C',
        category: 'general',
        confidence: 0.7,
        tags: ['test'],
        useCount: 20,
        updated: now,
      });
      const factD = makeFact({
        id: 'D',
        fact: 'fact D',
        category: 'general',
        confidence: 0.9,
        tags: ['test'],
        useCount: 20,
        updated: now - DAY_MS,
      });

      const results = [
        { fact: factC, finalScore: 0.5 },
        { fact: factB, finalScore: 0.5 },
        { fact: factD, finalScore: 0.5 },
        { fact: factA, finalScore: 0.5 },
      ];

      const sorted = scorer.tieBreak(results);

      // Expected order: A > B > D > C
      // A: confidence=0.9, updated=now, useCount=20  (highest)
      // B: confidence=0.9, updated=now, useCount=10  (same conf/recency, fewer uses)
      // D: confidence=0.9, updated=now-1d, useCount=20 (same conf, less recent)
      // C: confidence=0.7  (lowest confidence)
      expect(sorted[0].fact.id).toBe('A');
      expect(sorted[1].fact.id).toBe('B');
      expect(sorted[2].fact.id).toBe('D');
      expect(sorted[3].fact.id).toBe('C');
    });
  });
});
