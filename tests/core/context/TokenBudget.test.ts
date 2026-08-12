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

const CANONICAL_FIVE = [
  'claude-haiku-4-latest',
  'deepseek-chat',
  'gemini-2.5-flash',
  'llama3.2:3b',
  'qwen2.5:7b',
] as const;

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
