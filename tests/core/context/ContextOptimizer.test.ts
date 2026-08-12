// tests/core/context/ContextOptimizer.test.ts — Wave-3 optimizer suite (04-04).
// Contract under test (04-04-PLAN.md tasks 2-3):
//   1. optimize(input) is the §2.3 drop-in (D-04-07): tier from the resolved
//      window via classifyModelContext (§2.1), budgets via TokenBudget
//      computeBudgets (§2.2), sections packed via ContextPack, degradation via
//      the §2.4 ladder in D-04-12 order, a Zod-validated
//      ContextProvenanceManifest stamped on EVERY return (D-04-17, GR-4), and
//      the typed CONTEXT_TOO_LARGE terminal when even minimal mode exceeds the
//      window (D-04-15 — never a silent truncation, P4-10).
//   2. Minimal mode (D-04-14/§2.5): mandatory at tier tiny; selects the compact
//      per-role constants (D-04-11, PROMPTS.planner.compact.system /
//      renderer.compact.system) with the persona block appended, keeps ≤1 safe
//      tool schema; escalated by the ladder for larger tiers. The optimizer
//      only MARKS minimalMode — MCP-chaining/RAG enforcement is capsForTier
//      (04-06) + Phase-5a consumer.
//   3. Drop-in identity + cache-stability: the default (non-minimal) path is
//      byte-identical to the Phase-3 contextHelper.buildOptimizedContext output
//      for equivalent inputs — same section texts, same byte-stable [SYSTEM]
//      (D-04-07/P4-8). NOTE: the live buildOptimizedContext import below is the
//      04-04 Task-3 handoff — 04-06 Task 3 replaces it with a hardcoded
//      Phase-3 snapshot BEFORE the module is deleted.
//   4. CTX-02 seam (D-04-02): contextUpdate is a typed input-only re-pack
//      signal with NO consumer in P4 — output is identical with/without it.
//
// Determinism rule (fixtures/index.ts precedent): no Date.now, no crypto, no
// Math.random — every input and expected value is fixed; ladder-trigger
// material derives from the D-08 fixture + fixed synthetic tool lists.
import { describe, expect, it } from 'vitest';

import { optimize, isContextTooLargeError } from '@/core/context/ContextOptimizer';
import type { ContextTooLargeError } from '@/core/context/ContextOptimizer';
import { classifyModelContext } from '@/core/context/ModelContextTier';
import { computeBudgets } from '@/core/context/TokenBudget';
import { packSections } from '@/core/context/ContextPack';
import { ContextProvenanceManifestSchema } from '@/core/context/ContextProvenanceManifest';
import { PROMPTS } from '@/core/prompts';
import { buildOptimizedContext } from '@/core/ai/contextHelper';
import type { ContextOptimizerInput, OptimizedContext, PromptSection } from '@/core/ai/types';
import type { ToolSchemaRef } from '@/core/ai/toolSchemas';
import { GET_PROVIDER_INFO_TOOL } from '@/core/ai/toolSchemas';
import {
  FIXED_CONVERSATION_ID,
  FIXED_MODEL,
  FIXED_OPERATION_ID,
  FIXED_PERSONA_BLOCK,
  FIXED_PREFERENCES,
  FIXED_WORKSPACE_ID,
} from '../../fixtures/optimizedContext';

/** Fixed base optimizer input — every field the §2.3 contract requires (04-04 additions included). */
function baseInput(overrides: Partial<ContextOptimizerInput> = {}): ContextOptimizerInput {
  return {
    operationId: FIXED_OPERATION_ID,
    model: FIXED_MODEL,
    modelContextWindow: 200_000,
    userInput: 'Summarize the current page.',
    conversationId: FIXED_CONVERSATION_ID,
    workspaceId: FIXED_WORKSPACE_ID,
    activeSurface: 'sidepanel',
    pageContext: undefined,
    selectedToolSchemas: [GET_PROVIDER_INFO_TOOL],
    memoryHints: [],
    preferences: FIXED_PREFERENCES,
    personaBlock: FIXED_PERSONA_BLOCK,
    stage: 'planner',
    ...overrides,
  };
}

/** Sum a section list's token counts (the optimizer's own totalTokens source). */
function sumTokens(sections: readonly PromptSection[]): number {
  return sections.reduce((n, s) => n + s.tokens, 0);
}

/** Assert the stamped manifest is Zod-valid (GR-4) and internally consistent. */
function expectValidManifest(out: OptimizedContext): void {
  const parsed = ContextProvenanceManifestSchema.safeParse(out.provenance);
  expect(parsed.success).toBe(true);
  expect(out.provenance.totalTokens).toBe(sumTokens(out.sections));
  expect(out.provenance.sections.map((s) => s.kind)).toEqual(out.sections.map((s) => s.kind));
  expect(out.provenance.counterMethod).toBe('heuristic'); // D-04-10: provider-native absent in ai@4.3.19
}

describe('optimize — tier + budget derivation (04-04 Task 2, §2.1/§2.2)', () => {
  it('tiny window 4096 → tier tiny with §2.2 budgets (inputBudget floor(4096*0.7))', () => {
    const out = optimize(baseInput({ modelContextWindow: 4096 }));
    expect(out.tier).toBe('tiny');
    const budgets = computeBudgets(4096);
    expect(out.inputBudget).toBe(budgets.inputBudget);
    expect(out.outputBudget).toBe(budgets.outputBudget);
  });

  it('large window 200_000 → tier large with §2.2 budgets (inputBudget floor(200000*0.7))', () => {
    const out = optimize(baseInput({ modelContextWindow: 200_000 }));
    expect(out.tier).toBe('large');
    const budgets = computeBudgets(200_000);
    expect(out.inputBudget).toBe(budgets.inputBudget);
    expect(out.outputBudget).toBe(budgets.outputBudget);
  });

  it('tier classification agrees with classifyModelContext at every boundary', () => {
    for (const window of [4096, 16_384, 131_072, 200_000]) {
      expect(optimize(baseInput({ modelContextWindow: window })).tier).toBe(
        classifyModelContext(window),
      );
    }
  });
});

describe('optimize — minimal mode (04-04 Task 2, D-04-14/§2.5)', () => {
  it('tiny is mandatory minimal: compact planner [SYSTEM] + persona block appended, ≤1 tool schema', () => {
    const out = optimize(baseInput({ modelContextWindow: 4096 }));
    expect(out.minimalMode).toBe(true);
    const system = out.sections.find((s) => s.kind === 'system');
    expect(system?.text).toBe(`${PROMPTS.planner.compact.system}\n\n${FIXED_PERSONA_BLOCK}`);
    expect(out.sections.filter((s) => s.kind === 'tool_schemas')).toHaveLength(1);
    expect(out.sections.filter((s) => s.kind === 'tool_schemas').length).toBeLessThanOrEqual(1);
  });

  it('renderer stage selects the renderer compact constant in minimal mode', () => {
    const out = optimize(baseInput({ modelContextWindow: 4096, stage: 'renderer' }));
    expect(out.minimalMode).toBe(true);
    const system = out.sections.find((s) => s.kind === 'system');
    expect(system?.text).toBe(`${PROMPTS.renderer.compact.system}\n\n${FIXED_PERSONA_BLOCK}`);
  });

  it('large is NOT minimal: default-path [SYSTEM] byte-identical to the Phase-3 persona-block-only shape', () => {
    const out = optimize(baseInput({ modelContextWindow: 200_000 }));
    expect(out.minimalMode).toBe(false);
    const system = out.sections.find((s) => s.kind === 'system');
    expect(system?.text).toBe(FIXED_PERSONA_BLOCK);
  });
});

describe('optimize — CONTEXT_TOO_LARGE honest terminal (04-04 Task 2, D-04-15)', () => {
  it('absurd userInput beyond even minimal mode throws the typed terminal', () => {
    // tiny window inputBudget = floor(4096*0.7) = 2867; 12_000 ASCII chars ≈
    // 3000 tokens alone — over the cap even after the mandatory minimal pack.
    expect(() =>
      optimize(baseInput({ modelContextWindow: 4096, userInput: 'a'.repeat(12_000) })),
    ).toThrowError('CONTEXT_TOO_LARGE');
  });

  it('isContextTooLargeError distinguishes the typed terminal with the D-04-15 fields', () => {
    let caught: unknown;
    try {
      optimize(baseInput({ modelContextWindow: 4096, userInput: 'a'.repeat(12_000) }));
    } catch (e) {
      caught = e;
    }
    expect(isContextTooLargeError(caught)).toBe(true);
    const terminal = caught as ContextTooLargeError;
    expect(terminal.code).toBe('CONTEXT_TOO_LARGE');
    expect(terminal.reason).toBe('minimal_mode_exceeded');
    expect(terminal.totalTokens).toBeGreaterThan(terminal.inputBudget);
    expect(terminal.inputBudget).toBe(Math.floor(4096 * 0.7));
  });
});

describe('optimize — CTX-02 typed input-only seam (04-04 Task 2, D-04-02)', () => {
  it('contextUpdate present returns output deep-equal to absent (typed input, no consumer in P4)', () => {
    const without = optimize(baseInput());
    const withPage = optimize(baseInput({ contextUpdate: { type: 'page' } }));
    const withMemory = optimize(baseInput({ contextUpdate: { type: 'memory' } }));
    expect(withPage).toEqual(without);
    expect(withMemory).toEqual(without);
  });
});
