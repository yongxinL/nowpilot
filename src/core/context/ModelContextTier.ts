// ModelContextTier — §2.1 context-window classification (PRODUCT_SPEC_v0_1.md:425-443).
//
// This is the CONTEXT-WINDOW axis ('tiny'|'small'|'medium'|'large') that drives
// budgets, minimal mode, and the §1.4 caps table. It is DISTINCT from the
// Phase-3 runtime tier ModelTier ('fast'|'balanced', src/core/ai/types.ts:27-28)
// carried by AgentTier.modelTier (D-70): do NOT import ModelTier here, do NOT
// touch AgentOrchestrator/TierResolver. Appendix I owns cap enforcement; the
// caller supplies caps (AgentTier.plannerCap/toolCap).
import { z } from 'zod';

/** Context-window tiers — closed 4-value union (§2.1, spec 428). */
export const ModelContextTierSchema = z.enum(['tiny', 'small', 'medium', 'large']);
export type ModelContextTier = z.infer<typeof ModelContextTierSchema>;

/** §2.1 verbatim (spec 429-434): 4096→tiny, 16384→small, 131072→medium, else large. */
export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096) return 'tiny';
  if (contextWindow <= 16384) return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}

/**
 * §1.4 Agent Step Limits caps table (spec 356-359): tiny {1,1} · small {2,1} ·
 * medium {3,2} · large {5,3}.
 *
 * UNWIRED helper (D-70): Appendix I owns cap enforcement — AgentOrchestrator
 * receives caps as caller-supplied AgentTier and is the only module allowed to
 * enforce them (spec 361). Zero production call sites this phase; Phase-7
 * callers consume this table directly.
 */
export function contextTierCaps(tier: ModelContextTier): { plannerCap: number; toolCap: number } {
  switch (tier) {
    case 'tiny':
      return { plannerCap: 1, toolCap: 1 };
    case 'small':
      return { plannerCap: 2, toolCap: 1 };
    case 'medium':
      return { plannerCap: 3, toolCap: 2 };
    case 'large':
      return { plannerCap: 5, toolCap: 3 };
  }
}