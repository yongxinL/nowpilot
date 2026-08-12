// tests/core/context/TokenBudget.test.ts — Wave-1 core-context suite (04-01).
// Contract under test (04-01-PLAN.md tasks 1-3):
//   1. MODEL_CONTEXT_WINDOWS is the canonical model→window map (D-04-04/06) —
//      five Appendix-D modelIds, Readonly, single declaration (R-1);
//      resolveModelContextWindow resolves known entries and falls back to the
//      conservative tiny window (4096, windowKnown:false) for anything unlisted
//      (D-04-06 — never assume large).
//   2. TokenBudget.estimateTokens is the ONLY token counter (Pitfall 1) — a
//      pure CJK-aware heuristic (D-04-10): Unicode-range ratio >= 0.3 → divisor
//      3, else 4; zero-length → 0. Never a tokenizer, never a model call.
//   3. computeBudgets applies the §2.2 verbatim 70/20/10 formula.
//   4. PER_TIER_DISTRIBUTION mirrors the §2.2 six-column table exactly;
//      SECTION_CAP_MAPPING is the canonical column→kind mapping (Pitfall 3);
//      computeSectionCaps derives per-kind caps = column% × inputBudget.
//      Caps DRIVE the §2.4 degradation ladder — they are never truncation
//      (D-04-13): this suite asserts finite numeric caps, never text slices.
//
// Determinism rule (fixtures/index.ts precedent): no Date.now, no crypto, no
// Math.random — every input and expected value is fixed.
import { describe, expect, it } from 'vitest';

import {
  classifyModelContext,
  resolveModelContextWindow,
} from '@/core/context/ModelContextTier';
import {
  PER_TIER_DISTRIBUTION,
  SECTION_CAP_MAPPING,
  computeBudgets,
  computeSectionCaps,
  estimateTokens,
} from '@/core/context/TokenBudget';
import { FIXED_MODEL_CONTEXT_WINDOWS } from '../../fixtures/optimizedContext';
import { CJK_TEXT, ENGLISH_TEXT, MIXED_TEXT, OVER_BUDGET_SECTIONS } from '../../fixtures/optimizedContext';

const CANONICAL_FIVE = [
  'claude-haiku-4-latest',
  'deepseek-chat',
  'gemini-2.5-flash',
  'llama3.2:3b',
  'qwen2.5:7b',
] as const;

describe('estimateTokens (04-01 Task 2 — D-04-10 CJK-aware heuristic)', () => {
  it('returns 0 for a zero-length string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('counts English text at ceil(len/4) (divisor 4)', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateTokens('a')).toBe(1);
  });

  it('counts a >=0.3 CJK-ratio string at ceil(len/3) (divisor 3)', () => {
    // 4 of 9 chars are CJK (你好世界hello) → ratio ≈ 0.44 ≥ 0.3 → ceil(9/3) = 3
    expect(estimateTokens('你好世界hello')).toBe(3);
    // 60% CJK string → ceil(len/3)
    expect(estimateTokens('你好你好ab')).toBe(2);
  });

  it('counts a low-CJK-ratio string at ceil(len/4) (divisor 4)', () => {
    // 1 of 10 chars is CJK → ratio 0.1 < 0.3 → ceil(10/4) = 3
    expect(estimateTokens('abcdefghij你')).toBe(3);
  });

  it('uses the higher-cost divisor for mixed script (P4-13)', () => {
    // Exactly at the 0.3 boundary (3 of 10 CJK) → divisor 3 (>= threshold)
    expect(estimateTokens('你好好abcdefg')).toBe(4);
    // Just under the boundary (2 of 10 CJK = 0.2) → divisor 4
    expect(estimateTokens('你好abcdefgh')).toBe(3);
  });

  it('returns a non-negative integer for every input', () => {
    for (const sample of ['', 'x', '你好', 'hello world 你好', ' \n\t ']) {
      expect(Number.isInteger(estimateTokens(sample))).toBe(true);
      expect(estimateTokens(sample)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('computeBudgets (04-01 Task 2 — §2.2 70/20/10 formula)', () => {
  it('applies the verbatim 70/20/10 formula with floor', () => {
    expect(computeBudgets(200_000)).toEqual({
      inputBudget: 140_000,
      outputBudget: 40_000,
      safetyMargin: 20_000,
    });
  });

  it('computes a small window exactly', () => {
    expect(computeBudgets(4096)).toEqual({
      inputBudget: 2867,
      outputBudget: 819,
      safetyMargin: 409,
    });
  });
});

describe('PER_TIER_DISTRIBUTION (04-01 Task 2 — §2.2 L444-449 verbatim)', () => {
  it('mirrors the tiny row exactly (15/20/10/20/15/20)', () => {
    expect(PER_TIER_DISTRIBUTION.tiny).toEqual({
      system: 0.15,
      tools: 0.2,
      memory: 0.1,
      context: 0.2,
      history: 0.15,
      user: 0.2,
    });
  });

  it('mirrors the small row exactly (10/15/10/25/20/20)', () => {
    expect(PER_TIER_DISTRIBUTION.small).toEqual({
      system: 0.1,
      tools: 0.15,
      memory: 0.1,
      context: 0.25,
      history: 0.2,
      user: 0.2,
    });
  });

  it('mirrors the medium row exactly (8/12/10/30/25/15)', () => {
    expect(PER_TIER_DISTRIBUTION.medium).toEqual({
      system: 0.08,
      tools: 0.12,
      memory: 0.1,
      context: 0.3,
      history: 0.25,
      user: 0.15,
    });
  });

  it('mirrors the large row exactly (5/10/10/35/25/15)', () => {
    expect(PER_TIER_DISTRIBUTION.large).toEqual({
      system: 0.05,
      tools: 0.1,
      memory: 0.1,
      context: 0.35,
      history: 0.25,
      user: 0.15,
    });
  });
});

describe('SECTION_CAP_MAPPING + computeSectionCaps (04-01 Task 2 — Pitfall 3, D-04-13/16)', () => {
  it('maps the six distribution columns to their canonical kinds', () => {
    expect(SECTION_CAP_MAPPING.system).toEqual(['system', 'preferences']);
    expect(SECTION_CAP_MAPPING.tools).toEqual(['tool_schemas']);
    expect(SECTION_CAP_MAPPING.memory).toEqual(['memory']);
    expect(SECTION_CAP_MAPPING.context).toEqual(['context']);
    expect(SECTION_CAP_MAPPING.history).toEqual([]); // reserved-unfilled (D-04-16)
    expect(SECTION_CAP_MAPPING.user).toEqual(['user_input', 'task']);
  });

  it('derives the medium User cap as 15% of the input budget (behavior block)', () => {
    const caps = computeSectionCaps('medium', 16_384);
    expect(caps.user_input).toBe(Math.floor(16_384 * 0.15));
    expect(caps.user_input).toBe(2457);
  });

  it('derives per-kind caps = column% × inputBudget for every tier', () => {
    for (const tier of ['tiny', 'small', 'medium', 'large'] as const) {
      const inputBudget = 10_000;
      const caps = computeSectionCaps(tier, inputBudget);
      const dist = PER_TIER_DISTRIBUTION[tier];
      expect(caps.system).toBe(dist.system * inputBudget);
      expect(caps.tool_schemas).toBe(dist.tools * inputBudget);
      expect(caps.memory).toBe(dist.memory * inputBudget);
      expect(caps.context).toBe(dist.context * inputBudget);
      expect(caps.user_input).toBe(dist.user * inputBudget);
      expect(caps.task).toBe(dist.user * inputBudget);
    }
  });

  it('returns finite positive numbers — caps DRIVE degradation, never truncate (D-04-13)', () => {
    const caps = computeSectionCaps('large', 100_000);
    for (const value of Object.values(caps)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});

describe('resolveModelContextWindow (04-01 Task 1)', () => {
  it('resolves every canonical Appendix-D modelId to its known window', () => {
    for (const modelId of CANONICAL_FIVE) {
      const resolved = resolveModelContextWindow(modelId);
      expect(resolved.windowKnown).toBe(true);
      expect(resolved.contextWindow).toBe(FIXED_MODEL_CONTEXT_WINDOWS[modelId]);
    }
  });

  it('resolves known windows to numbers > 0 and consistent with their tier', () => {
    expect(resolveModelContextWindow('claude-haiku-4-latest').contextWindow).toBe(200_000);
    expect(resolveModelContextWindow('deepseek-chat').contextWindow).toBe(65_536);
    expect(resolveModelContextWindow('gemini-2.5-flash').contextWindow).toBe(1_048_576);
    expect(resolveModelContextWindow('llama3.2:3b').contextWindow).toBe(4_096);
    expect(resolveModelContextWindow('qwen2.5:7b').contextWindow).toBe(4_096);
  });

  it('falls back to conservative tiny (4096) with windowKnown:false for unknown models (D-04-06)', () => {
    expect(resolveModelContextWindow('some-custom-model')).toEqual({
      contextWindow: 4096,
      windowKnown: false,
    });
    expect(resolveModelContextWindow('')).toEqual({ contextWindow: 4096, windowKnown: false });
  });

  it('classifyModelContext seed is byte-identical (tiny <= 4096, large >= 200K)', () => {
    expect(classifyModelContext(4096)).toBe('tiny');
    expect(classifyModelContext(16384)).toBe('small');
    expect(classifyModelContext(131072)).toBe('medium');
    expect(classifyModelContext(200_000)).toBe('large');
  });

  it('never assumes large for an unlisted model', () => {
    const resolved = resolveModelContextWindow('unlisted-custom-model');
    expect(classifyModelContext(resolved.contextWindow)).toBe('tiny');
  });
});

describe('fixture material (04-01 Task 3 — P4-15/WR-13)', () => {
  it('FIXED_MODEL_CONTEXT_WINDOWS mirrors the five canonical map keys', () => {
    expect(FIXED_MODEL_CONTEXT_WINDOWS['claude-haiku-4-latest']).toBe(200_000);
    expect(FIXED_MODEL_CONTEXT_WINDOWS['deepseek-chat']).toBe(65_536);
    expect(FIXED_MODEL_CONTEXT_WINDOWS['gemini-2.5-flash']).toBe(1_048_576);
    expect(FIXED_MODEL_CONTEXT_WINDOWS['llama3.2:3b']).toBe(4_096);
    expect(FIXED_MODEL_CONTEXT_WINDOWS['qwen2.5:7b']).toBe(4_096);
    expect(Object.keys(FIXED_MODEL_CONTEXT_WINDOWS)).toHaveLength(5);
  });

  it('estimates the fixed English/CJK/mixed samples at the heuristic boundaries', () => {
    expect(estimateTokens(ENGLISH_TEXT)).toBe(Math.ceil(ENGLISH_TEXT.length / 4));
    expect(estimateTokens(CJK_TEXT)).toBe(Math.ceil(CJK_TEXT.length / 3));
    // Mixed ratio < 0.3 → divisor 4 (higher-cost divisor already won via CJK_TEXT)
    expect(estimateTokens(MIXED_TEXT)).toBe(Math.ceil(MIXED_TEXT.length / 4));
  });

  it('OVER_BUDGET_SECTIONS exceeds the medium-tier per-kind caps (ladder trigger material)', () => {
    const caps = computeSectionCaps('medium', 16_384);
    for (const section of OVER_BUDGET_SECTIONS) {
      const cap = caps[section.kind];
      // tool_result is uncapped-but-counted (Pitfall 3) — skip the cap comparison
      if (cap === undefined) continue;
      expect(section.tokens).toBeGreaterThan(cap);
    }
  });

  it('tool_result is uncapped but still counted in totalTokens (Pitfall 3)', () => {
    const total = OVER_BUDGET_SECTIONS.reduce((sum, s) => sum + s.tokens, 0);
    const expected = 2000 + 6000 + 3000 + 999;
    expect(total).toBe(expected);
    const toolResult = OVER_BUDGET_SECTIONS.find((s) => s.kind === 'tool_result');
    expect(toolResult).toBeDefined();
    expect(toolResult!.tokens).toBe(999);
  });

  it('caps are finite numbers that drive degradation — never truncation (D-04-13)', () => {
    for (const tier of ['tiny', 'small', 'medium', 'large'] as const) {
      const caps = computeSectionCaps(tier, 100_000);
      for (const [kind, cap] of Object.entries(caps)) {
        expect(Number.isFinite(cap)).toBe(true);
        expect(cap).toBeGreaterThan(0);
        // The optimizer consumes these numeric caps; a cap is never a text slice
        expect(kind.length).toBeGreaterThan(0);
      }
    }
  });
});
