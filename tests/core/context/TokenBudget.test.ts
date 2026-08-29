import { describe, it, expect } from 'vitest';
import { classifyModelContext, contextTierCaps } from '@/core/context/ModelContextTier';
import {
  computeBudgets,
  DISTRIBUTION,
  budgetForCategory,
  heuristicTokenCounter,
  CJK_DENSITY_THRESHOLD,
} from '@/core/context/TokenBudget';

/**
 * TokenBudget contract tests (plan 05-02, Task 1) — §18-required
 * tests/core/context/TokenBudget.test.ts (spec 2598). Pure math tests, no
 * chrome mocks, no providers (PromptCacheManager.test.ts style): the DONE-1
 * proofs — §2.1 tier boundary fixtures verbatim (spec 430-434), the §1.4 caps
 * table (spec 356-359), the §2.2 70/20/10 floor budgets (spec 447-449), the
 * per-tier dynamic distribution verbatim + sums-to-100 (spec 456-459), and the
 * D-71 CJK-aware heuristic counter (spec 461) with the density gate (Pitfall 8)
 * and code-point awareness (Pitfall 7).
 */

describe('classifyModelContext — §2.1 tier boundaries verbatim (DONE-1)', () => {
  it('maps the locked boundary fixtures exactly (spec 430-434)', () => {
    expect(classifyModelContext(4096)).toBe('tiny');
    expect(classifyModelContext(4097)).toBe('small');
    expect(classifyModelContext(16384)).toBe('small');
    expect(classifyModelContext(16385)).toBe('medium');
    expect(classifyModelContext(131072)).toBe('medium');
    expect(classifyModelContext(131073)).toBe('large');
    expect(classifyModelContext(200000)).toBe('large');
  });
});

describe('contextTierCaps — §1.4 agent step caps table (DONE-1)', () => {
  it('returns the §1.4 caps verbatim (spec 356-359): tiny 1/1 · small 2/1 · medium 3/2 · large 5/3', () => {
    expect(contextTierCaps('tiny')).toEqual({ plannerCap: 1, toolCap: 1 });
    expect(contextTierCaps('small')).toEqual({ plannerCap: 2, toolCap: 1 });
    expect(contextTierCaps('medium')).toEqual({ plannerCap: 3, toolCap: 2 });
    expect(contextTierCaps('large')).toEqual({ plannerCap: 5, toolCap: 3 });
  });
});

describe('computeBudgets — §2.2 70/20/10 formula with floor semantics (DONE-1, Pitfall 5)', () => {
  it('splits a 10000-token window into 7000/2000/1000', () => {
    expect(computeBudgets(10000)).toEqual({
      inputBudget: 7000,
      outputBudget: 2000,
      safetyMargin: 1000,
    });
  });

  it('floors each share for a non-divisible window (4096 → 2867/819/409)', () => {
    expect(computeBudgets(4096)).toEqual({
      inputBudget: 2867,
      outputBudget: 819,
      safetyMargin: 409,
    });
  });
});

describe('DISTRIBUTION — §2.2 dynamic distribution verbatim (DONE-1, Pitfall 6)', () => {
  it('tiny: System 15 · Tools 20 · Memory 10 · Context 20 · History 15 · User 20', () => {
    expect(DISTRIBUTION.tiny).toEqual({
      system: 15,
      tools: 20,
      memory: 10,
      context: 20,
      history: 15,
      user: 20,
    });
  });

  it('small: System 10 · Tools 15 · Memory 10 · Context 25 · History 20 · User 20', () => {
    expect(DISTRIBUTION.small).toEqual({
      system: 10,
      tools: 15,
      memory: 10,
      context: 25,
      history: 20,
      user: 20,
    });
  });

  it('medium: System 8 · Tools 12 · Memory 10 · Context 30 · History 25 · User 15', () => {
    expect(DISTRIBUTION.medium).toEqual({
      system: 8,
      tools: 12,
      memory: 10,
      context: 30,
      history: 25,
      user: 15,
    });
  });

  it('large: System 5 · Tools 10 · Memory 10 · Context 35 · History 25 · User 15', () => {
    expect(DISTRIBUTION.large).toEqual({
      system: 5,
      tools: 10,
      memory: 10,
      context: 35,
      history: 25,
      user: 15,
    });
  });

  it('every tier\'s six categories sum to 100 (the budget is never over-allocated)', () => {
    for (const tier of ['tiny', 'small', 'medium', 'large'] as const) {
      const sum = Object.values(DISTRIBUTION[tier]).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    }
  });
});

describe('budgetForCategory — §2.2 per-category share of inputBudget (floor)', () => {
  it('context share of a tiny 7000 input budget = floor(7000*0.20) = 1400', () => {
    expect(budgetForCategory('tiny', 7000, 'context')).toBe(1400);
  });

  it('system share of a large 100000 input budget = floor(100000*0.05) = 5000', () => {
    expect(budgetForCategory('large', 100000, 'system')).toBe(5000);
  });
});

describe('heuristicTokenCounter — §2.2 D-71 heuristic (spec 461)', () => {
  it('counts English text at ceil(len/4) — "hello world" (11 chars) → 3', () => {
    expect(heuristicTokenCounter.count('hello world')).toBe(Math.ceil(11 / 4));
    expect(heuristicTokenCounter.count('hello world')).toBe(3);
  });

  it('counts CJK-heavy text at ceil(len/3) — a 12-char all-CJK string (density 1.0 ≥ 0.30) → 4', () => {
    // 12 CJK Unified Ideographs (U+4E00-U+9FFF), no spaces.
    const cjk12 = Array.from({ length: 12 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join('');
    expect(heuristicTokenCounter.count(cjk12)).toBe(Math.ceil(12 / 3));
    expect(heuristicTokenCounter.count(cjk12)).toBe(4);
  });

  it('stays on ceil(len/4) for English-heavy text with a stray CJK char (density < 0.30, Pitfall 8)', () => {
    const text = 'This is an English sentence that contains a single stray 中 character inside.';
    expect(heuristicTokenCounter.count(text)).toBe(Math.ceil(text.length / 4));
  });

  it('counts a supplementary-plane char (U+20000) as ONE code point, not two (Pitfall 7)', () => {
    // Array.from('\u{20000}') yields one element — the surrogate pair is not
    // double-counted, so the heuristic is ceil(1/4) = 1, not ceil(2/4).
    expect(heuristicTokenCounter.count('\u{20000}')).toBe(1);
  });

  it('returns 0 for the empty string', () => {
    expect(heuristicTokenCounter.count('')).toBe(0);
  });

  it('exposes the locked CJK density threshold (Assumption A1: 0.30)', () => {
    expect(CJK_DENSITY_THRESHOLD).toBe(0.3);
  });
});