// tests/core/memory/MemoryScorer.test.ts — D-05-05 KNW-04 (required by §18):
// §3.4 verbatim weight pinning + [0,1] sub-score normalisation + injectable
// clock. Pure module → @vitest-environment node (no chrome APIs).
//
// Cases:
//   1. Weight pinning: full keyword+tag match with max recency/useCount and
//      confidence 1 → score 1.0 exactly; zero match with 31d-old updatedAt,
//      useCount 0, confidence 0 → 0.0 exactly (all sub-scores at their floor).
//   2. Sub-score proportions: ONLY a tag match on 1-of-2 tags → tagScore 0.5
//      alone → 0.25 * 0.5 = 0.125 exactly (everything else 0).
//   3. Recency clamp: updatedAt = nowMs − 15d → recencyScore 0.5; nowMs − 31d →
//      0 (clamped); nowMs (fresh) → 1. nowMs is a fixed literal (injectable
//      clock — no wall clock in the module).
//   4. Use-count cap: useCount 20 vs 100 → identical useCountScore 1.0
//      (min(1, count/20) cap).
//   5. [0,1] invariant: 50 deterministic pseudo-random fixtures (fixed-seed LCG
//      — NO Math.random) → every returned score within [0,1].
//   6. Empty queryTerms → keywordScore 0/max(1,0) = 0, no divide-by-zero.
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { RECENCY_WINDOW_MS, scoreMemoryFact } from '@/core/memory/MemoryScorer';
import type { UserMemoryFact } from '@/core/memory/types';

const NOW_MS = 1_752_000_000_000; // fixed literal — deterministic (injectable clock)

function makeFact(overrides: Partial<UserMemoryFact> = {}): UserMemoryFact {
  return {
    id: 'f-1',
    content: 'prefers concise answers',
    type: 'fact',
    tags: ['prefers', 'concise'],
    confidence: 1,
    source: 'explicit',
    createdAt: NOW_MS - 1,
    updatedAt: NOW_MS,
    lastUsedAt: undefined,
    useCount: 20,
    ...overrides,
  };
}

/** Deterministic pseudo-random generator (fixed seed) — never Math.random. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('scoreMemoryFact — §3.4 verbatim weights (D-05-05)', () => {
  it('pins the weights: full keyword+tag match with all sub-scores at max → 1.0 exactly', () => {
    // queryTerms ⊆ content AND ⊆ tags; updatedAt = nowMs (recency 1);
    // useCount ≥ 20 (useCountScore 1); confidence 1.
    const fact = makeFact({ tags: ['prefers', 'concise'], updatedAt: NOW_MS, useCount: 20 });
    const score = scoreMemoryFact(fact, ['prefers', 'concise'], NOW_MS);
    expect(score).toBe(1.0); // 1*0.45 + 1*0.25 + 1*0.15 + 1*0.10 + 1*0.05
  });

  it('pins the weights: zero match + stale recency + 0 useCount + 0 confidence → 0.0 exactly', () => {
    const fact = makeFact({
      content: 'unrelated text',
      tags: [],
      confidence: 0,
      updatedAt: NOW_MS - 31 * 86_400_000, // beyond the 30d window → recency 0
      useCount: 0,
    });
    expect(scoreMemoryFact(fact, ['prefers', 'concise'], NOW_MS)).toBe(0.0);
  });

  it('sub-score proportions: ONLY a tag match on 1-of-2 tags → 0.25 * 0.5 = 0.125 exactly', () => {
    const fact = makeFact({
      content: 'no keyword overlap whatsoever',
      tags: ['alpha', 'beta'],
      confidence: 0,
      updatedAt: NOW_MS - 31 * 86_400_000, // recency 0
      useCount: 0,
    });
    // keywordScore 0; tagScore = 1/2 (only 'alpha' is a query term); rest 0.
    expect(scoreMemoryFact(fact, ['alpha'], NOW_MS)).toBe(0.125);
  });

  it('recency clamp: 15d → 0.5, 31d → 0 (clamped), fresh → 1', () => {
    const base = { content: 'x', tags: [], confidence: 0, useCount: 0 };
    const half = scoreMemoryFact(
      makeFact({ ...base, updatedAt: NOW_MS - 15 * 86_400_000 }),
      ['no-match-term'],
      NOW_MS,
    );
    // Only recency contributes: 0.5 * 0.15 = 0.075.
    expect(half).toBe(0.5 * 0.15);

    const stale = scoreMemoryFact(
      makeFact({ ...base, updatedAt: NOW_MS - 31 * 86_400_000 }),
      ['no-match-term'],
      NOW_MS,
    );
    expect(stale).toBe(0);

    const fresh = scoreMemoryFact(
      makeFact({ ...base, updatedAt: NOW_MS }),
      ['no-match-term'],
      NOW_MS,
    );
    expect(fresh).toBe(1 * 0.15);
  });

  it('recency window constant is exactly 30 days', () => {
    expect(RECENCY_WINDOW_MS).toBe(30 * 86_400_000);
  });

  it('use-count cap: useCount 20 vs 100 → identical useCountScore 1.0', () => {
    const base = { content: 'x', tags: [], confidence: 0, updatedAt: NOW_MS - 31 * 86_400_000 };
    const atCap = scoreMemoryFact(makeFact({ ...base, useCount: 20 }), ['no-match'], NOW_MS);
    const farOver = scoreMemoryFact(makeFact({ ...base, useCount: 100 }), ['no-match'], NOW_MS);
    expect(atCap).toBe(1 * 0.1); // useCountScore 1 * weight 0.10
    expect(farOver).toBe(atCap);
  });

  it('[0,1] invariant holds for 50 deterministic pseudo-random fixtures', () => {
    const rand = lcg(42); // fixed seed — reproducible, never Math.random
    const contents = ['alpha beta', 'gamma delta', 'epsilon zeta', 'eta theta', 'iota kappa'];
    const tagsets = [[], ['alpha'], ['beta', 'gamma'], ['zeta', 'eta', 'theta'], ['iota']];
    for (let i = 0; i < 50; i++) {
      const fact = makeFact({
        id: `r-${i}`,
        content: contents[Math.floor(rand() * contents.length)],
        tags: tagsets[Math.floor(rand() * tagsets.length)],
        confidence: rand(),
        updatedAt: NOW_MS - Math.floor(rand() * 60 * 86_400_000),
        useCount: Math.floor(rand() * 40),
      });
      const score = scoreMemoryFact(fact, ['alpha', 'gamma', 'unknown'], NOW_MS);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('empty queryTerms → keywordScore 0/max(1,0) = 0, no divide-by-zero', () => {
    const score = scoreMemoryFact(makeFact({ useCount: 0, confidence: 0 }), [], NOW_MS);
    // Nothing can contribute: keywordScore 0, tagScore 0, recency from the
    // makeFact default updatedAt = nowMs → recencyScore 1 … wait: recency is 1
    // for a fresh fact, so this is 0.15. The guard is: the score is finite and
    // within [0,1] — no NaN from max(1, 0) = 1.
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
    // And with a stale fact the ONLY sub-score is zero → 0 exactly.
    const stale = scoreMemoryFact(
      makeFact({ useCount: 0, confidence: 0, updatedAt: NOW_MS - 31 * 86_400_000 }),
      [],
      NOW_MS,
    );
    expect(stale).toBe(0);
  });
});
