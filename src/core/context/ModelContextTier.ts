// src/core/context/ModelContextTier.ts — Source: PRODUCT_SPEC §2.1 "Model Context
// Tiers" (lines 415-433, verbatim) / §18 Phase-4 create-list (line 2668). P-3b:
// canonical home for ModelContextTier + classifyModelContext. R-1: single
// declaration — src/core/ai/types.ts imports (never re-declares) these; Phase-4
// ContextOptimizer/TokenBudget import from here.
//
// 04-01 (D-04-04/D-04-06): MODEL_CONTEXT_WINDOWS is the ONE canonical
// model→window source. The ai SDK exposes no window and getModels() is a
// throwing stub (verified @ai-sdk/provider 1.1.3) — the map below is the only
// source; there is never an async/network lookup (zero model calls in
// optimization). The five keys mirror the VERIFIED TierResolver static-map
// precedent (src/core/ai/TierResolver.ts L19-31, Appendix D). Values are
// flagged [ASSUMED] A2..A6 (04-01-PLAN flagged_assumptions — user confirmation
// gates): A2 claude-haiku-4-latest=200K, A3 deepseek-chat=64K, A4
// gemini-2.5-flash=1M, A5/A6 ollama llama3.2:3b + qwen2.5:7b default num_ctx=4K.
// D-04-06: an UNLISTED model resolves to the conservative tiny window (4096,
// windowKnown:false) — never assume large. resolveModelContextWindow is the
// D-04-04 window source stamped onto StageInvocation.modelContextWindow (04-05).

export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';

export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096) return 'tiny';
  if (contextWindow <= 16384) return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}

/** Canonical model→context-window map (D-04-04/06, R-1 — single declaration). */
export const MODEL_CONTEXT_WINDOWS: Readonly<Record<string, number>> = {
  'claude-haiku-4-latest': 200_000, // [ASSUMED A2] anthropic haiku — large
  'deepseek-chat': 65_536, // [ASSUMED A3] openai — medium
  'gemini-2.5-flash': 1_048_576, // [ASSUMED A4] gemini — large (1M)
  'llama3.2:3b': 4_096, // [ASSUMED A5] ollama default num_ctx — tiny
  'qwen2.5:7b': 4_096, // [ASSUMED A6] ollama default num_ctx — tiny
} as const;

/**
 * Resolve a modelId's context window. Known models return their map entry;
 * ANY unlisted model returns the conservative tiny window with
 * windowKnown:false (D-04-06 — a wrong window mis-sizes every downstream
 * budget, so unknown means smallest, never largest). Synchronous + pure.
 */
export function resolveModelContextWindow(modelId: string): {
  contextWindow: number;
  windowKnown: boolean;
} {
  const contextWindow = MODEL_CONTEXT_WINDOWS[modelId];
  if (contextWindow === undefined) {
    return { contextWindow: 4096, windowKnown: false };
  }
  return { contextWindow, windowKnown: true };
}
