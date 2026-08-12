// src/core/context/TokenBudget.ts — Source: PRODUCT_SPEC §2.2 "Token Budget
// Formula" (lines 434-451, verbatim) + D-04-09/D-04-10 + §2.4 degradation
// ladder trigger material. 04-01: the deterministic budget-math half of CTX-01.
// Pure module — no imports beyond the ModelContextTier type; no ai SDK, no
// providers, no storage, no network (zero model calls in optimization, R-3).
//
// estimateTokens is the ONLY token counter (Pitfall 1 — AgentOrchestrator
// L33/L278 re-points its import here in the same wave as the contextHelper
// deletion, 04-06). D-04-10 counting rule: per-section Unicode-range ratio
// (CJK ranges U+3040–U+30FF, U+3400–U+4DBF, U+4E00–U+9FFF, U+AC00–U+D7AF,
// U+F900–U+FAFF, U+FF00–U+FFEF); divisor 3 when cjk/len >= 0.3, else 4
// (mixed script → higher-cost divisor, P4-13); zero-length → 0. No custom
// tokenizer / BPE — the heuristic IS the counter (provider-native counters are
// consumed only if the SDK exposes one; ai@4.3.19 does not).
//
// computeBudgets applies the §2.2 verbatim formula (70/20/10 with floor).
// PER_TIER_DISTRIBUTION mirrors the §2.2 six-column table (L444-449) exactly.
// SECTION_CAP_MAPPING is the canonical column→kind resolution (Pitfall 3):
// System→system+preferences, Tools→tool_schemas, Memory→memory, Context→context,
// History→reserved-unfilled (D-04-16 — a budget-column reservation, never a new
// PromptSection kind, R-1/R-2), User→user_input+task. `tool_result` is
// uncapped-but-counted in totalTokens. computeSectionCaps derives per-kind caps
// = column% × inputBudget — caps DRIVE the §2.4 degradation ladder; a cap is
// NEVER a license to slice section text (D-04-13, CTX-04). No text.slice /
// substring anywhere in this module by construction.
import type { ModelContextTier } from './ModelContextTier';

/** D-04-10 CJK unicode-range class (single-char test per loop iteration). */
const CJK_RE = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;

/**
 * The ONLY token counter (Pitfall 1). Pure + deterministic: counts characters
 * matching the CJK class, then divides by 3 (ratio >= 0.3) or 4. Zero-length
 * input → 0. Returns an integer.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  let cjk = 0;
  for (let i = 0; i < text.length; i++) {
    if (CJK_RE.test(text[i])) cjk++;
  }
  const divisor = cjk / text.length >= 0.3 ? 3 : 4;
  return Math.ceil(text.length / divisor);
}

/** §2.2 verbatim: 70/20/10 of the model context window, floored. */
export function computeBudgets(contextWindow: number): {
  inputBudget: number;
  outputBudget: number;
  safetyMargin: number;
} {
  return {
    inputBudget: Math.floor(contextWindow * 0.7),
    outputBudget: Math.floor(contextWindow * 0.2),
    safetyMargin: Math.floor(contextWindow * 0.1),
  };
}

/** §2.2 distribution columns (L444-449) — one key per table column. */
export interface DistributionRow {
  system: number;
  tools: number;
  memory: number;
  context: number;
  history: number;
  user: number;
}

/** §2.2 six-column table, verbatim (tiny 15/20/10/20/15/20 … large 5/10/10/35/25/15). */
export const PER_TIER_DISTRIBUTION: Record<ModelContextTier, DistributionRow> = {
  tiny: { system: 0.15, tools: 0.2, memory: 0.1, context: 0.2, history: 0.15, user: 0.2 },
  small: { system: 0.1, tools: 0.15, memory: 0.1, context: 0.25, history: 0.2, user: 0.2 },
  medium: { system: 0.08, tools: 0.12, memory: 0.1, context: 0.3, history: 0.25, user: 0.15 },
  large: { system: 0.05, tools: 0.1, memory: 0.1, context: 0.35, history: 0.25, user: 0.15 },
};

/**
 * Canonical column→kind mapping (Pitfall 3 resolution, tested). Each
 * distribution column budgets a set of PromptSection kinds. `history` maps to
 * [] — the §2.2 History column is a budget reservation (D-04-16) that the
 * optimizer leaves unfilled in v0.1, never a new section kind (R-1/R-2).
 * `tool_result` is intentionally absent (uncapped-but-counted in totalTokens).
 */
export const SECTION_CAP_MAPPING: Readonly<{
  system: readonly string[];
  tools: readonly string[];
  memory: readonly string[];
  context: readonly string[];
  history: readonly string[];
  user: readonly string[];
}> = {
  system: ['system', 'preferences'],
  tools: ['tool_schemas'],
  memory: ['memory'],
  context: ['context'],
  history: [], // reserved-unfilled (D-04-16)
  user: ['user_input', 'task'],
};

/** Per-kind cap = column% × inputBudget (floored to an integer). Caps drive the §2.4 ladder — never truncation. */
export function computeSectionCaps(
  tier: ModelContextTier,
  inputBudget: number,
): Record<string, number> {
  const dist = PER_TIER_DISTRIBUTION[tier];
  const caps: Record<string, number> = {};
  for (const column of Object.keys(SECTION_CAP_MAPPING) as Array<
    keyof typeof SECTION_CAP_MAPPING
  >) {
    const kinds = SECTION_CAP_MAPPING[column];
    const columnBudget = Math.floor(dist[column] * inputBudget);
    for (const kind of kinds) {
      caps[kind] = columnBudget;
    }
  }
  return caps;
}
