import { describe, it, expect } from 'vitest';
import type { UserMemoryFact } from '../../../src/core/memory/memoryTypes';
import { resolve, computeCumulativeConfidence } from '../../../src/core/memory/conflictResolver';

const T0 = 1_000_000_000_000;

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

describe('conflictResolver', () => {
  describe('resolve', () => {
    it('should return a new fact as active if it does not match any existing fact', () => {
      const newFact: Partial<UserMemoryFact> = {
        id: 'new-1',
        fact: 'Python is dynamically typed',
        category: 'programming',
        confidence: 0.6,
        tags: ['python'],
      };

      const existing: UserMemoryFact[] = [
        makeFact({
          id: 'ex-1',
          fact: 'TypeScript is statically typed',
          category: 'programming',
        }),
      ];

      const result = resolve(newFact, existing, 1);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
      expect(result[0].fact.fact).toBe('Python is dynamically typed');
    });

    it('should NOT supersede when a contradictory fact has fewer than 2 observations', () => {
      const existing = [
        makeFact({
          id: 'ex-1',
          fact: 'JavaScript uses single threaded model for concurrency',
          category: 'programming',
          confidence: 0.7,
        }),
      ];

      // High word overlap (>0.7) with existing but different meaning
      const newFact: Partial<UserMemoryFact> = {
        id: 'new-1',
        fact: 'JavaScript uses multi threaded model for concurrency',
        category: 'programming',
        confidence: 0.6,
        tags: ['javascript'],
      };

      // Only 1 observation — doesn't meet D-16's 2+ threshold
      const result = resolve(newFact, existing, 1);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
      expect(result[0].fact.id).toBe('ex-1');
    });

    it('should supersede when a contradictory fact has 2+ observations and higher cumulative confidence', () => {
      const existing = [
        makeFact({
          id: 'ex-1',
          fact: 'JavaScript uses single threaded model for concurrency',
          category: 'programming',
          confidence: 0.7,
        }),
      ];

      const newFact: Partial<UserMemoryFact> = {
        id: 'new-1',
        fact: 'JavaScript uses multi threaded model for concurrency',
        category: 'programming',
        confidence: 0.6,
        tags: ['javascript'],
      };

      // 3 observations with confidences [0.6, 0.5, 0.4] → cumulative = 1 - 0.4*0.5*0.6 = 1 - 0.12 = 0.88
      // 0.88 > existing.confidence (0.7) AND observationCount (3) >= 2 → supersede
      const result = resolve(newFact, existing, 3, [0.6, 0.5, 0.4]);
      expect(result).toHaveLength(2);

      const superseded = result.find((r) => r.status === 'superseded');
      const active = result.find((r) => r.status === 'active');

      expect(superseded).toBeDefined();
      expect(superseded!.fact.id).toBe('ex-1');

      expect(active).toBeDefined();
      expect(active!.fact.id).toBe('new-1');
    });

    it('should accumulate confidence when a new fact matches an existing fact (same content, same category)', () => {
      const existing = [
        makeFact({
          id: 'ex-1',
          fact: 'Python supports first-class functions',
          category: 'programming',
          confidence: 0.5,
        }),
      ];

      const newFact: Partial<UserMemoryFact> = {
        id: 'new-1',
        fact: 'Python supports first-class functions',
        category: 'programming',
        confidence: 0.4,
        tags: ['python'],
      };

      // Same text — confidence should accumulate
      // cumulative = 1 - (1-0.5)*(1-0.4) = 1 - 0.3 = 0.7
      const result = resolve(newFact, existing, 2, [0.5, 0.4]);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
      expect(result[0].fact.confidence).toBeCloseTo(0.7, 4);
    });

    it('should treat a new fact that matches a superseded fact as a new fact (no conflict with superseded)', () => {
      const existing = [
        makeFact({
          id: 'ex-1',
          fact: 'Rust has an ownership model',
          category: 'programming',
          confidence: 0.9,
          status: 'superseded',
        }),
      ];

      const newFact: Partial<UserMemoryFact> = {
        id: 'new-1',
        fact: 'Rust has an ownership model',
        category: 'programming',
        confidence: 0.8,
        tags: ['rust'],
      };

      // Existing fact is superseded — no conflict; treat as new
      const result = resolve(newFact, existing, 1);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
      expect(result[0].fact.id).toBe('new-1');
    });
  });

  describe('computeCumulativeConfidence', () => {
    it('should aggregate [0.4, 0.5, 0.3] into 1 - 0.6*0.5*0.7 = 0.79', () => {
      const result = computeCumulativeConfidence([0.4, 0.5, 0.3]);
      // 1 - (0.6 * 0.5 * 0.7) = 1 - 0.21 = 0.79
      expect(result).toBeCloseTo(0.79, 4);
    });

    it('should return the value itself for a single confidence', () => {
      const result = computeCumulativeConfidence([0.6]);
      expect(result).toBeCloseTo(0.6, 4);
    });

    it('should return 0 for empty array', () => {
      const result = computeCumulativeConfidence([]);
      expect(result).toBe(0);
    });
  });
});
