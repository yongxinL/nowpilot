// src/core/context/ModelContextTier.ts — Source: PRODUCT_SPEC §2.1 "Model Context
// Tiers" (lines 415-433, verbatim) / §18 Phase-4 create-list (line 2668). P-3b:
// canonical home for ModelContextTier + classifyModelContext. R-1: single
// declaration — src/core/ai/types.ts imports (never re-declares) these; Phase-4
// ContextOptimizer/TokenBudget import from here.

export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';

export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096) return 'tiny';
  if (contextWindow <= 16384) return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}
