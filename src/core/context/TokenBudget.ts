// TokenBudget — §2.2 budget formula + per-tier dynamic distribution
// (PRODUCT_SPEC_v0_1.md:444-461) + the D-71 TokenCounter seam.
//
// inputBudget = floor(window * 0.70); outputBudget = floor(window * 0.20);
// safetyMargin = floor(window * 0.10). The distribution table splits inputBudget
// across six categories (each tier sums to 100 — verified).
//
// LOCKED budget→section mapping (Assumption A2 — the spec never joins §2.2 to
// §1.3): system→[SYSTEM] (Phase-7 caller's buildSystemPrompt output), tools→
// [TOOL SCHEMAS], memory→[MEMORY], context→[CONTEXT] (page/case), history→older
// turns INSIDE [CONTEXT] (the manifest has no 'history' kind), user→[USER
// PREFERENCES]+[USER INPUT]. Phase-5 assemble enforces the AGGREGATE inputBudget
// (never oversized, §19.3); per-category enforcement is Phase-7 caller policy.
import type { ModelContextTier } from './ModelContextTier';

/** D-71 token-counting seam — provider-native counters plug in later. */
export interface TokenCounter {
  count(text: string): number;
}

/** D-71 CJK-density gate: switch to ceil(len/3) at/above this CJK share of non-space chars (Pitfall 8). */
export const CJK_DENSITY_THRESHOLD = 0.3;

/** CJK code-point ranges (D-71 / Assumption A1) — code-point aware (Pitfall 7). */
export const CJK_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0x3400, 0x4dbf], // CJK Unified Ideographs Extension A
  [0x3040, 0x309f], // Hiragana
  [0x30a0, 0x30ff], // Katakana
  [0xac00, 0xd7af], // Hangul Syllables
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
];

function isCjkCodePoint(codePoint: number): boolean {
  return CJK_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

/**
 * §2.2 heuristic counter (spec 461): ceil(len/4) English / ceil(len/3) CJK.
 * Code-point-aware (Array.from — surrogate pairs count as 1, Pitfall 7);
 * CJK-density-gated (a stray CJK token in English text must not flip the
 * section to len/3, Pitfall 8). Empty text → 0; always an integer ≥ 0 (Pitfall 5).
 */
export function countTokensHeuristic(text: string): number {
  const codePoints = Array.from(text);
  if (codePoints.length === 0) return 0;
  const nonWhitespace = codePoints.filter((cp) => !/\s/u.test(cp));
  const cjkCount = nonWhitespace.filter((cp) => isCjkCodePoint(cp.codePointAt(0) ?? 0)).length;
  const density = nonWhitespace.length === 0 ? 0 : cjkCount / nonWhitespace.length;
  if (density >= CJK_DENSITY_THRESHOLD) return Math.ceil(codePoints.length / 3);
  return Math.ceil(codePoints.length / 4);
}

/** D-71 default counter — the heuristic; a caller may supply a provider-native one. */
export const heuristicTokenCounter: TokenCounter = { count: countTokensHeuristic };

/** §2.2 budgets (spec 447-449) — floor-based, so the aggregate can never overshoot (T-05-01). */
export function computeBudgets(modelContextWindow: number): {
  inputBudget: number;
  outputBudget: number;
  safetyMargin: number;
} {
  return {
    inputBudget: Math.floor(modelContextWindow * 0.7),
    outputBudget: Math.floor(modelContextWindow * 0.2),
    safetyMargin: Math.floor(modelContextWindow * 0.1),
  };
}

/** §2.2 distribution categories (spec 454). */
export type BudgetCategory = 'system' | 'tools' | 'memory' | 'context' | 'history' | 'user';

/** §2.2 dynamic distribution verbatim (spec 456-459) — every tier sums to 100. */
export const DISTRIBUTION: Record<ModelContextTier, Record<BudgetCategory, number>> = {
  tiny: { system: 15, tools: 20, memory: 10, context: 20, history: 15, user: 20 },
  small: { system: 10, tools: 15, memory: 10, context: 25, history: 20, user: 20 },
  medium: { system: 8, tools: 12, memory: 10, context: 30, history: 25, user: 15 },
  large: { system: 5, tools: 10, memory: 10, context: 35, history: 25, user: 15 },
};

/** §2.2 per-category share of inputBudget: floor(inputBudget * pct / 100). */
export function budgetForCategory(
  tier: ModelContextTier,
  inputBudget: number,
  category: BudgetCategory,
): number {
  return Math.floor((inputBudget * DISTRIBUTION[tier][category]) / 100);
}