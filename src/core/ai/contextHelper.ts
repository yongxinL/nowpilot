// src/core/ai/contextHelper.ts — D-02 (§18 addendum: +1 documented file, Phase-4
// DELETION TARGET — ContextOptimizer replaces it). Golden Rule 3: this is the
// ONLY place a Phase-3 call builds an OptimizedContext; NO React component or
// hook assembles prompts (the hook imports contextHelper, never PROMPTS).
//
// buildOptimizedContext() produces the §2.3 OptimizedContext (src/core/ai/types.ts,
// D-07 canonical home) from Phase-3 inputs: operationId, tier, budgets, userInput,
// the byte-stable persona block, and tool schema refs. It emits PromptSection[]
// (kinds per '@/core/ai/types', P-3) in the §1.3 canonical order:
//   [SYSTEM cached]      — the persona block (stable: true, cache-eligible)
//   [TOOL SCHEMAS cached] — from toolSchemaRefs (stable: true; omitted when empty)
//   [USER INPUT current]  — userInput (stable: false — never cache-eligible)
//
// The system-kind persona section is what 03-05's F-5 messages[]+providerOptions
// path caches on anthropic (PromptCacheAdapter, 03-03, hashes the stable
// sections); byte-stability of that section text is the cache-hit invariant
// (T-03-07-02). T-03-07-01: user input lives ONLY in the user_input section —
// a persona-injection attempt can never interpolate into the cached [SYSTEM].
//
// Token counts use a pure deterministic estimator (ceil(chars/4)) — the Phase-3
// seed keeps sections ≤ inputBudget BY CONSTRUCTION (small fixed sections);
// real budgeting/truncation/degradation is Phase 4 (§2.4, TokenBudget).
import type { ModelContextTier } from '@/core/context/ModelContextTier';
import type { ToolSchemaRef } from './toolSchemas';
import type { OptimizedContext, PromptSection } from '@/core/ai/types';

/** Phase-3 seed token estimate: ~4 chars per token (English), pure + deterministic. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface ContextHelperInput {
  /** Threaded from the hook's single operationId (03-08) — same value feeds runAgentTurn. */
  operationId: string;
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  userInput: string;
  /** Byte-stable block from PersonaInjector.buildPersonaBlock (D-10 config-provider seam). */
  personaBlock: string;
  toolSchemaRefs: readonly ToolSchemaRef[];
  workspaceId: string;
  activeSurface: 'sidepanel' | 'standalone';
  /** Phase-3 seed: false (degradation machinery is Phase 4 §2.4). */
  minimalMode?: boolean;
}

/** Deterministic §1.3 tool-schemas text (fixed field order — Pitfall 5). */
function buildToolSchemasText(refs: readonly ToolSchemaRef[]): string {
  return refs.map((t) => `${t.name}: ${t.description}`).join('\n');
}

/**
 * Build the §2.3-shaped OptimizedContext. Pure + deterministic: two calls with
 * identical input deep-equal (hash-equality over the stable sections proven in
 * tests). Sections are emitted in §1.3 order; the persona block is the
 * stable:true system section; user input is the stable:false user_input section.
 */
export function buildOptimizedContext(input: ContextHelperInput): OptimizedContext {
  const sections: PromptSection[] = [
    {
      kind: 'system',
      text: input.personaBlock,
      tokens: estimateTokens(input.personaBlock),
      stable: true,
      sourceId: 'system',
    },
  ];
  if (input.toolSchemaRefs.length > 0) {
    const schemasText = buildToolSchemasText(input.toolSchemaRefs);
    sections.push({
      kind: 'tool_schemas',
      text: schemasText,
      tokens: estimateTokens(schemasText),
      stable: true,
      sourceId: 'tool-schemas',
    });
  }
  sections.push({
    kind: 'user_input',
    text: input.userInput,
    tokens: estimateTokens(input.userInput),
    stable: false,
    sourceId: 'user-input',
  });

  const totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);
  const minimalMode = input.minimalMode ?? false;

  return {
    tier: input.tier,
    inputBudget: input.inputBudget,
    outputBudget: input.outputBudget,
    sections,
    provenance: {
      sections: sections.map((s) => ({
        kind: s.kind,
        sourceId: s.sourceId,
        tokens: s.tokens,
        truncated: false, // Phase-3 seed: small by construction; degradation is Phase 4
      })),
      totalTokens,
      minimalMode,
      workspaceId: input.workspaceId,
      activeSurface: input.activeSurface,
      // placeholder values — contextHelper is DELETED in 04-06 (D-04-08); the
      // optimizer (04-04) stamps the real D-04-17 enumeration on every manifest
      tier: input.tier,
      model: '',
      window: 0,
      counterMethod: 'heuristic',
      stepsFired: [],
    },
    minimalMode,
  };
}
