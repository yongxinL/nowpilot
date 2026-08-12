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
//      (D-04-07/P4-8). 04-06 Task 3 (Pitfall 1): the live buildOptimizedContext
//      import was replaced with the hardcoded Phase-3 snapshot BELOW (captured
//      while the module still existed) so the byte-identity regression survives
//      the contextHelper deletion.
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
import type { ModelContextTier } from '@/core/context/ModelContextTier';
import { computeBudgets } from '@/core/context/TokenBudget';
import { packSections } from '@/core/context/ContextPack';
import { ContextProvenanceManifestSchema } from '@/core/context/ContextProvenanceManifest';
import { PROMPTS } from '@/core/prompts';
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

// ---------------------------------------------------------------------------
// 04-04 Task 3 — the completed suite (extended in place; Task 2 owns the
// behavior cases above, this block adds the exact boundaries, the ladder
// order, the drop-in identity regression, the granularity invariants, and the
// manifest-validity guarantee on every return).
// ---------------------------------------------------------------------------

/** Eight long safe tool schemas — the §2.4 ladder trigger material for a small window. */
const EIGHT_LONG_TOOLS: ToolSchemaRef[] = Array.from({ length: 8 }, (_, i) => ({
  name: `long-tool-${i}`,
  description: 'd'.repeat(5800), // ~1453 tokens per schema at divisor 4 (English)
  jsonSchema: {},
  dangerous: false,
  source: 'builtin',
}));

describe('optimize — exact §2.1/§2.2 boundaries (04-04 Task 3)', () => {
  it('classifies every boundary window exactly with the §2.2 floored budgets', () => {
    const cases: Array<[number, ModelContextTier]> = [
      [4096, 'tiny'],
      [16_384, 'small'],
      [131_072, 'medium'],
      [200_000, 'large'],
    ];
    for (const [window, tier] of cases) {
      const out = optimize(baseInput({ modelContextWindow: window }));
      expect(out.tier).toBe(tier);
      expect(out.inputBudget).toBe(Math.floor(window * 0.7));
      expect(out.outputBudget).toBe(Math.floor(window * 0.2));
    }
  });

  it('stamps a Zod-valid ContextProvenanceManifest on every return (D-04-17/GR-4, T-04-19)', () => {
    for (const window of [4096, 16_384, 131_072, 200_000]) {
      expectValidManifest(optimize(baseInput({ modelContextWindow: window })));
    }
    // a ladder-fired turn and a minimal-mode renderer turn must stay valid too
    expectValidManifest(
      optimize(
        baseInput({
          modelContextWindow: 16_384,
          selectedToolSchemas: EIGHT_LONG_TOOLS,
          userInput: 'hi',
        }),
      ),
    );
    expectValidManifest(optimize(baseInput({ modelContextWindow: 4096, stage: 'renderer' })));
  });
});

describe('optimize — §2.4 ladder order + degradation (04-04 Task 3, D-04-12)', () => {
  it('an over-budget small-window turn steps the ladder: stepsFired + totalTokens dropping', () => {
    const inputBudget = Math.floor(16_384 * 0.7); // 11_468
    // The pre-ladder §1.3 pack (non-minimal — small tier starts NOT minimal):
    const before = sumTokens(
      packSections({
        personaBlock: FIXED_PERSONA_BLOCK,
        userInput: 'hi',
        toolSchemaRefs: EIGHT_LONG_TOOLS,
      }),
    );
    expect(before).toBeGreaterThan(inputBudget); // ladder must fire

    const out = optimize(
      baseInput({
        modelContextWindow: 16_384,
        selectedToolSchemas: EIGHT_LONG_TOOLS,
        userInput: 'hi',
      }),
    );
    expect(out.minimalMode).toBe(true); // escalated by the ladder (small tier)
    expect([...out.provenance.stepsFired]).toEqual(['minimal-mode']); // D-04-12 order — the only real P4 step that fires here
    expect(out.provenance.totalTokens).toBeLessThan(before); // degradation dropped tokens
    expect(out.provenance.totalTokens).toBeLessThan(inputBudget); // back under budget
    expect(out.sections.filter((s) => s.kind === 'tool_schemas')).toHaveLength(1); // ≤1 safe tool after minimal
    const system = out.sections.find((s) => s.kind === 'system');
    expect(system?.text).toBe(`${PROMPTS.planner.compact.system}\n\n${FIXED_PERSONA_BLOCK}`);
  });

  it('an under-budget turn fires no ladder steps (stepsFired empty — no degradation)', () => {
    const out = optimize(baseInput({ modelContextWindow: 200_000 }));
    expect([...out.provenance.stepsFired]).toEqual([]);
    expect(out.minimalMode).toBe(false);
    expectValidManifest(out);
  });

  it('tiny-mode [SYSTEM] starts with the compact constant text (D-04-11 selection)', () => {
    const out = optimize(baseInput({ modelContextWindow: 4096 }));
    const system = out.sections.find((s) => s.kind === 'system');
    expect(system?.text.startsWith(PROMPTS.planner.compact.system)).toBe(true);
  });
});

describe('optimize — drop-in identity + cache-stability (04-04 Task 3, D-04-07/P4-8)', () => {
  // 04-06 Task 3 (Pitfall 1 seal): the Phase-3 buildOptimizedContext output
  // for THIS exact input, captured while src/core/ai/contextHelper.ts still
  // existed (04-06 execution). Replaces the live import so the byte-identity
  // regression survives the deletion (D-04-07/P4-8 prompt-cache stability).
  // Texts: FIXED_PERSONA_BLOCK + buildToolSchemasText([GET_PROVIDER_INFO_TOOL])
  // + the fixed userInput; tokens = the Phase-3 ceil(chars/4) counter.
  const PHASE3_SNAPSHOT_SECTIONS: PromptSection[] = [
    {
      kind: 'system',
      text: 'persona.name=Fixture Persona\npersona.tone=professional-warm\npersona.brevity=balanced',
      tokens: 21,
      stable: true,
      sourceId: 'system',
    },
    {
      kind: 'tool_schemas',
      text: 'get-provider-info: Active provider + model + limits',
      tokens: 13,
      stable: true,
      sourceId: 'tool-schemas',
    },
    {
      kind: 'user_input',
      text: 'Summarize the current page.',
      tokens: 7,
      stable: false,
      sourceId: 'user-input',
    },
  ];

  it('default path deep-equals the hardcoded Phase-3 snapshot (byte-identity survives the deletion)', () => {
    const optimizerOut = optimize(baseInput({ modelContextWindow: 200_000 }));
    // Same section texts, same byte-stable [SYSTEM] (the persona block), same
    // token counts (English-equivalent inputs — the 04-01 CJK counting rule is
    // a deliberate change, not a drop-in regression).
    expect(optimizerOut.sections).toEqual(PHASE3_SNAPSHOT_SECTIONS);
    expect(optimizerOut.tier).toBe('large');
    expect(optimizerOut.inputBudget).toBe(Math.floor(200_000 * 0.7));
    expect(optimizerOut.outputBudget).toBe(Math.floor(200_000 * 0.2));
    const system = optimizerOut.sections.find((s) => s.kind === 'system');
    expect(system?.text).toBe(FIXED_PERSONA_BLOCK);
  });

  it('cache-stability: identical inputs produce deep-equal outputs (deterministic, no Date.now/crypto)', () => {
    expect(optimize(baseInput())).toEqual(optimize(baseInput()));
    expect(optimize(baseInput({ modelContextWindow: 4096 }))).toEqual(
      optimize(baseInput({ modelContextWindow: 4096 })),
    );
  });
});

describe('optimize — section-granularity invariants (04-04 Task 3, D-04-13/D-04-15)', () => {
  it('never modifies user_input and emits only byte-identical known texts across tiers', () => {
    const compactPlannerSystem = `${PROMPTS.planner.compact.system}\n\n${FIXED_PERSONA_BLOCK}`;
    const knownTexts = new Set([
      FIXED_PERSONA_BLOCK,
      compactPlannerSystem,
      'get-provider-info: Active provider + model + limits',
      'Summarize the current page.',
    ]);
    for (const window of [4096, 16_384, 200_000]) {
      const out = optimize(baseInput({ modelContextWindow: window }));
      const userInputSection = out.sections.find((s) => s.kind === 'user_input');
      expect(userInputSection?.text).toBe('Summarize the current page.'); // never touched (P4-10)
      for (const section of out.sections) {
        expect(knownTexts.has(section.text)).toBe(true); // no slice/substring anywhere (D-04-13)
      }
    }
  });
});
