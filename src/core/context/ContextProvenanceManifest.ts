// src/core/context/ContextProvenanceManifest.ts — Source: PRODUCT_SPEC §2.6
// "Context Provenance Manifest" (lines 516-534, verbatim) / §18 Phase-4
// create-list (line 2673). P-3b: canonical home for ContextProvenanceManifest.
// R-1: single declaration — src/core/ai/types.ts imports (never re-declares) it;
// CTX-03 (Phase 4b) extends this shape into a context receipt.
//
// 04-03 (D-04-17/18/19): extended IN PLACE with the full provenance
// enumeration (tier, model, window, stepsFired, counterMethod) + the co-located
// ContextProvenanceManifestSchema Zod boundary gate (GR-4 — ProviderConfigSchema
// precedent in src/core/ai/types.ts). sections[].kind mirrors
// PromptSection['kind'] (src/core/ai/types.ts) INCLUDING the 03a-01
// 'tool_result' member (F-4 replan-feedback kind); the D-04-18 runtime
// union-parity test (tests/core/context/ContextProvenanceManifest.test.ts) fails
// CI if the two unions ever drift. D-04-19: the manifest is in-memory per-turn,
// redacted via TraceRedactor if ever logged, NEVER persisted (durable trace =
// Phase 6 AITransactionLog).
import { z } from 'zod';
import type { ModelContextTier } from './ModelContextTier';

/**
 * §2.4 degradation-ladder step names (D-04-12) — the vocabulary `stepsFired`
 * records. Mirrors ContextCompressor.LADDER_STEPS (04-02) so the manifest and
 * the ladder stay in lockstep; declared here as the manifest's single source.
 */
export const LADDER_STEP_NAMES = [
  'drop-debug',
  'drop-secondary',
  'summarise-history',
  'compress-page',
  'trim-tools',
  'reduce-topk',
  'minimal-mode',
  'too-large',
] as const;

export type LadderStepName = (typeof LADDER_STEP_NAMES)[number];

export interface ContextProvenanceManifest {
  sections: Array<{
    // 03a-01: mirrors PromptSection['kind'] (src/core/ai/types.ts) — gained
    // 'tool_result' with the F-4 replan-feedback section kind (D-3a-11) so the
    // manifest stays a faithful provenance record of every emitted section.
    kind:
      | 'system'
      | 'tool_schemas'
      | 'preferences'
      | 'memory'
      | 'context'
      | 'task'
      | 'user_input'
      | 'tool_result';
    sourceId: string;
    tokens: number;
    truncated: boolean;
    compressionApplied?: 'summarise' | 'structural' | 'topk';
  }>;
  totalTokens: number;
  minimalMode: boolean;
  workspaceId: string; // NEW in v0.1
  activeSurface: 'sidepanel' | 'standalone'; // NEW in v0.1
  // 04-03 (D-04-17): the remaining provenance enumeration — PromptInspector-ready.
  tier: ModelContextTier;
  model: string;
  /** The model's context window that drove tier classification + budgets. */
  window: number;
  /** D-04-10: 'heuristic' in P4 (the provider-native counter does not exist in ai@4.3.19); 'native' reserved for a future SDK surface. */
  counterMethod: 'native' | 'heuristic';
  /** The §2.4 ladder steps that fired this turn (empty when no degradation). */
  stepsFired: ReadonlyArray<LadderStepName>;
}

/**
 * The Zod boundary gate (GR-4) for every stamped manifest: ContextOptimizer
 * (04-04) runs each produced manifest through safeParse before it leaves the
 * context layer (T-04-13 — unknown kinds rejected). Mirrors
 * ContextProvenanceManifest exactly; the kind enum is the D-04-18 runtime
 * counterpart of the interface union above (both include 'tool_result').
 */
export const ContextProvenanceManifestSchema = z.object({
  sections: z.array(
    z.object({
      kind: z.enum([
        'system',
        'tool_schemas',
        'preferences',
        'memory',
        'context',
        'task',
        'user_input',
        'tool_result',
      ]),
      sourceId: z.string(),
      tokens: z.number().int().nonnegative(),
      truncated: z.boolean(),
      compressionApplied: z.enum(['summarise', 'structural', 'topk']).optional(),
    }),
  ),
  totalTokens: z.number().int().nonnegative(),
  minimalMode: z.boolean(),
  workspaceId: z.string(),
  activeSurface: z.enum(['sidepanel', 'standalone']),
  tier: z.enum(['tiny', 'small', 'medium', 'large']),
  model: z.string(),
  window: z.number().int().nonnegative(),
  counterMethod: z.enum(['native', 'heuristic']),
  stepsFired: z.array(z.enum(LADDER_STEP_NAMES)),
});
