import { describe, it, expect } from 'vitest';
import {
  assemble,
  isFeatureAllowedInMinimalMode,
  BLOCKED_IN_MINIMAL_MODE,
  type ContextOptimizerInput,
} from '@/core/context/ContextOptimizer';
import { ContextProvenanceManifestSchema } from '@/core/context/ContextProvenanceManifest';
import type { PageContext, RetrievedMemory, ToolSchemaRef } from '@/core/context/types';

/**
 * ContextOptimizer contract tests (plan 05-02, Task 3) — §18-required
 * tests/core/context/ContextOptimizer.test.ts (spec 2596). Pure unit tests, no
 * chrome mocks (OutcomeVerifier.test.ts style): the DONE-2/3/4 proofs —
 * §2.4 stepwise degradation in order with the never-oversized guarantee, the
 * returned CONTEXT_TOO_LARGE terminal (never thrown), the §2.5 minimal-mode
 * predicate verbatim (D-74), and the §2.6 manifest on every OptimizedContext
 * (DONE-4) — all exercised through the single pure assemble() call (D-69/D-76).
 */

const defaultPageContext: PageContext = {
  url: 'https://example.com',
  origin: 'https://example.com',
  hostname: 'example.com',
  title: 'Example',
  markdown: 'body text',
  meta: {},
  extractedAt: 0,
};

/** Input-builder mirroring OutcomeVerifier.test.ts:23-32 — REQUIRED defaults, overrides merge. */
function makeInput(overrides: Partial<ContextOptimizerInput> = {}): ContextOptimizerInput {
  return {
    operationId: 'op-test',
    model: 'fixture-model',
    modelContextWindow: 16384,
    userInput: 'Summarize the current incident',
    conversationId: 'conv-1',
    workspaceId: 'ws-1',
    activeSurface: 'sidepanel',
    pageContext: defaultPageContext,
    selectedToolSchemas: [
      { name: 'toolA', description: 'a', jsonSchema: {}, dangerous: false, source: 'builtin' },
    ],
    memoryHints: [
      { id: 'm1', content: 'user prefers concise', type: 'preference', tags: [], score: 0.9 },
    ],
    preferences: {},
    ...overrides,
  };
}

function manyHints(count: number, contentLength: number): RetrievedMemory[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    content: 'x'.repeat(contentLength),
    type: 'preference' as const,
    tags: [],
    score: 0.5,
  }));
}

function manyTools(count: number, descriptionLength: number): ToolSchemaRef[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `tool${String.fromCharCode(65 + i)}`,
    description: 'x'.repeat(descriptionLength),
    jsonSchema: {},
    dangerous: false,
    source: 'builtin' as const,
  }));
}

describe('assemble — §2.3 contract happy path (D-76, Pitfall 4)', () => {
  it('classifies the tier, applies the 70/20/10 budgets, and emits the sourced five in §1.3 order', () => {
    const result = assemble(makeInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const context = result.context;

    // §2.1/§2.2: 16384 → small; floor(16384*0.70)=11468, floor(16384*0.20)=3276.
    expect(context.tier).toBe('small');
    expect(context.inputBudget).toBe(11468);
    expect(context.outputBudget).toBe(3276);
    // §1.3 canonical order via assemble — NOT alphabetical (Pitfall 4).
    expect(context.sections.map((s) => s.kind)).toEqual([
      'TOOL SCHEMAS',
      'USER PREFERENCES',
      'MEMORY',
      'CONTEXT',
      'USER INPUT',
    ]);
    expect(context.minimalMode).toBe(false);
    // D-76 pack tally: provenance.totalTokens = Σ section tokens.
    const sectionSum = context.sections.reduce((sum, s) => sum + s.tokens, 0);
    expect(context.provenance.totalTokens).toBe(sectionSum);
  });
});

describe('provenance manifest — §2.6 on every OptimizedContext (DONE-4, D-77)', () => {
  it('every context carries a schema-parsed manifest with 7 records (5 shipped + system/task omissions)', () => {
    const result = assemble(makeInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const manifest = result.context.provenance;

    // Cross-boundary shapes are zod-validated (CLAUDE.md convention).
    expect(ContextProvenanceManifestSchema.safeParse(manifest).success).toBe(true);

    // 5 shipped + the two by-design omission records (Q3: system/task have no
    // input source — truncated:true, 0 tokens).
    expect(manifest.sections).toHaveLength(7);
    expect(manifest.sections.map((s) => s.kind)).toEqual([
      'tool_schemas',
      'preferences',
      'memory',
      'context',
      'user_input',
      'system',
      'task',
    ]);
    const system = manifest.sections.find((s) => s.kind === 'system');
    const task = manifest.sections.find((s) => s.kind === 'task');
    expect(system?.truncated).toBe(true);
    expect(system?.tokens).toBe(0);
    expect(task?.truncated).toBe(true);
    expect(task?.tokens).toBe(0);

    // Q6 fields flow through verbatim.
    expect(manifest.workspaceId).toBe('ws-1');
    expect(manifest.activeSurface).toBe('sidepanel');
  });
});

describe('trace surface — D-77 derived from manifest truncated sections', () => {
  it('happy path: no truncation — truncated false, truncatedSources empty, contextTier mirrors tier', () => {
    const result = assemble(makeInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The 'system'/'task' omission records are EXCLUDED from the degradation trace.
    expect(result.context.truncated).toBe(false);
    expect(result.context.truncatedSources).toEqual([]);
    expect(result.context.contextTier).toBe('small');
  });
});

describe('minimal mode — DONE-3', () => {
  it('tiny tier forces minimalMode (mandatory, spec 506)', () => {
    const result = assemble(makeInput({ modelContextWindow: 4096 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.tier).toBe('tiny');
    expect(result.context.minimalMode).toBe(true);
  });

  it('the §2.5 blocked set is asserted verbatim (7 kebab-case literals → false, D-74)', () => {
    const blocked: string[] = [
      'multi-step-agent',
      'mcp-chaining',
      'code-search-skill',
      'full-note-graph-injection',
      'large-research-synthesis',
      'llm-wiki-bulk',
      'llm-wiki-rag',
    ];
    expect(BLOCKED_IN_MINIMAL_MODE).toEqual(blocked);
    for (const feature of blocked) {
      expect(isFeatureAllowedInMinimalMode(feature)).toBe(false);
    }
  });

  it('allowed behaviors and unknown strings return true (§2.5 allowed list verbatim + closed-set default)', () => {
    const allowed: string[] = [
      'compact-system-prompt',
      'compact-preference-profile',
      'top-3-memories',
      'conversation-summary-200',
      'last-1-2-turns',
      'one-safe-tool-schema',
    ];
    for (const feature of allowed) {
      expect(isFeatureAllowedInMinimalMode(feature)).toBe(true);
    }
    expect(isFeatureAllowedInMinimalMode('anything-else')).toBe(true);
  });
});

describe('stepwise degradation — §2.4 in order (DONE-2, D-73)', () => {
  it('rung 4 (structural-compress page/case): CONTEXT record truncated with compressionApplied structural; trace carries the page URL', () => {
    const result = assemble(
      makeInput({
        pageContext: { ...defaultPageContext, markdown: 'x'.repeat(60000) },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const context = result.context;

    expect(context.minimalMode).toBe(false); // small tier, rung 7 never needed
    const contextRecord = context.provenance.sections.find((s) => s.kind === 'context');
    expect(contextRecord?.truncated).toBe(true);
    expect(contextRecord?.compressionApplied).toBe('structural');
    expect(context.truncated).toBe(true);
    // truncatedSources carries the manifest sourceId — the page URL, never the body.
    expect(context.truncatedSources).toContain('https://example.com');
  });

  it('rung 6 (reduce memory top-k): MEMORY record truncated with compressionApplied topk; trace carries the memory ids', () => {
    const hints = manyHints(240, 200);
    const result = assemble(makeInput({ pageContext: undefined, memoryHints: hints }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const context = result.context;

    const memoryRecord = context.provenance.sections.find((s) => s.kind === 'memory');
    expect(memoryRecord?.truncated).toBe(true);
    expect(memoryRecord?.compressionApplied).toBe('topk');
    expect(context.truncated).toBe(true);
    expect(context.truncatedSources).toContain(hints.map((h) => h.id).join(','));
  });
});

describe('minimal mode is the penultimate degradation step (DONE-3, §2.4 order)', () => {
  it('tiny tier: overflow degrades through rungs 4/5/6 and returns ok:true with minimalMode active', () => {
    const result = assemble(
      makeInput({
        modelContextWindow: 4096, // tiny → inputBudget floor(4096*0.70) = 2867
        pageContext: { ...defaultPageContext, markdown: 'x'.repeat(20000) },
        selectedToolSchemas: manyTools(4, 500),
        memoryHints: manyHints(100, 100),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const context = result.context;

    expect(context.tier).toBe('tiny');
    expect(context.minimalMode).toBe(true); // mandatory for tiny AND degradation-degraded
    expect(context.provenance.totalTokens).toBeLessThanOrEqual(context.inputBudget);

    // Rungs 4/5/6 observables: structural on CONTEXT, tool cut to ≤ 1 line, memory cut below initial 100.
    expect(
      context.provenance.sections.find((s) => s.kind === 'context')?.compressionApplied,
    ).toBe('structural');
    const toolSection = context.sections.find((s) => s.kind === 'TOOL SCHEMAS');
    expect(toolSection?.text.split('\n').filter((l) => l.length > 0).length).toBeLessThanOrEqual(1);
    const memorySection = context.sections.find((s) => s.kind === 'MEMORY');
    expect(memorySection?.text.split('\n').length).toBeLessThan(100);
    expect(context.truncated).toBe(true);
  });

  it('small tier: overflow past rungs 4/5/6 enters minimal mode BEFORE the CONTEXT_TOO_LARGE terminal', () => {
    const hints = manyHints(200, 200);
    const result = assemble(
      makeInput({
        pageContext: { ...defaultPageContext, markdown: 'x'.repeat(40000) },
        userInput: 'x'.repeat(40000),
        selectedToolSchemas: manyTools(8, 2000),
        memoryHints: hints,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;

    // Minimal mode was entered (rung 7) immediately before the terminal — the
    // penultimate rung. The terminal carries the flag for the caller.
    expect(result.code).toBe('CONTEXT_TOO_LARGE');
    expect(result.minimalMode).toBe(true);
    // Rungs 4 + 6 observables flow into the terminal's manifest-derived trace.
    expect(result.truncatedSources).toContain('https://example.com');
    expect(result.truncatedSources).toContain(hints.map((h) => h.id).join(','));
  });
});

describe('never oversized — every ok:true context stays within inputBudget (DONE-2, T-05-01)', () => {
  it('loops every success fixture in the suite: provenance.totalTokens <= inputBudget', () => {
    const hints = manyHints(240, 200);
    const fixtures: ContextOptimizerInput[] = [
      makeInput(),
      makeInput({ modelContextWindow: 4096 }),
      makeInput({ modelContextWindow: 131073 }), // large tier
      makeInput({ pageContext: { ...defaultPageContext, markdown: 'x'.repeat(60000) } }),
      makeInput({ pageContext: undefined, memoryHints: hints }),
      makeInput({
        modelContextWindow: 4096,
        pageContext: { ...defaultPageContext, markdown: 'x'.repeat(20000) },
        selectedToolSchemas: manyTools(4, 500),
        memoryHints: manyHints(100, 100),
      }),
    ];

    for (const input of fixtures) {
      const result = assemble(input);
      if (!result.ok) continue; // terminals are asserted elsewhere
      expect(result.context.provenance.totalTokens).toBeLessThanOrEqual(
        result.context.inputBudget,
      );
    }
  });
});

describe('CONTEXT_TOO_LARGE terminal — RETURNED, never thrown (DONE-2/Q4, T-05-03)', () => {
  it('returns the typed union variant with a content-free message when even minimal mode cannot fit', () => {
    const hugeInput = 'y'.repeat(12000); // ceil(12000/4) = 3000 > tiny inputBudget 2867
    const result = assemble(makeInput({ modelContextWindow: 4096, userInput: hugeInput }));

    // Plain expect, no try/catch — the terminal is a return value, not an exception.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONTEXT_TOO_LARGE');
    expect(result.message.length).toBeGreaterThan(0);
    // The message is a fixed user-facing explanation naming budgets only —
    // never raw user/page/memory content (V6/TraceRedactor discipline).
    expect(result.message).not.toContain(hugeInput);
    expect(result.totalTokens).toBeGreaterThanOrEqual(result.inputBudget);
    expect(result.inputBudget).toBe(2867);
    expect(result.minimalMode).toBe(true);
    expect(Array.isArray(result.truncatedSources)).toBe(true);
  });
});