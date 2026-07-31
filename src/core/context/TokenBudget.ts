import type { ModelContextTier } from '../ai/types';

export interface BudgetAllocation {
  inputBudget: number;
  outputBudget: number;
  safetyMargin: number;
  sections: Record<'system' | 'tools' | 'memory' | 'context' | 'history' | 'user', number>;
}

const ALLOCATION_TABLE: Record<ModelContextTier, Record<string, number>> = {
  tiny: { system: 0.15, tools: 0.20, memory: 0.10, context: 0.20, history: 0.15, user: 0.20 },
  small: { system: 0.10, tools: 0.15, memory: 0.10, context: 0.25, history: 0.20, user: 0.20 },
  medium: { system: 0.08, tools: 0.12, memory: 0.10, context: 0.30, history: 0.25, user: 0.15 },
  large: { system: 0.05, tools: 0.10, memory: 0.10, context: 0.35, history: 0.25, user: 0.15 },
};

const VALID_TIERS: readonly ModelContextTier[] = ['tiny', 'small', 'medium', 'large'];

/**
 * Token estimation and budget allocation service (D-09, D-10, D-11).
 * The single canonical service for token estimation — ContextOptimizer must
 * not inline counting logic (D-09 prohibition).
 */
export class TokenBudget {
  /**
   * Character-based token estimation per D-10: >50% CJK characters →
   * Math.ceil(text.length / 3), otherwise Math.ceil(text.length / 4).
   * Empty or malformed input yields 0 tokens (T-04-01).
   */
  estimateTokens(text: string): number {
    if (typeof text !== 'string' || text.length === 0) return 0;

    let cjkCount = 0;
    let totalCount = 0;
    for (const char of text) {
      totalCount++;
      const code = char.codePointAt(0)!;
      if (
        (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
        (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
        (code >= 0x20000 && code <= 0x2a6df) || // CJK Extension B
        (code >= 0xf900 && code <= 0xfaff) // CJK Compatibility
      ) {
        cjkCount++;
      }
    }

    const cjkRatio = cjkCount / Math.max(totalCount, 1);
    if (cjkRatio > 0.5) return Math.ceil(text.length / 3);
    return Math.ceil(text.length / 4);
  }

  /**
   * Per-tier budget allocation per spec §2.2: 70/20/10 split for
   * input/output/safety, with per-section caps from the tier table (D-11).
   * Invalid tiers or non-positive windows return all-zero budgets (T-04-06).
   */
  allocateBudget(tier: ModelContextTier, modelContextWindow: number): BudgetAllocation {
    if (
      !VALID_TIERS.includes(tier) ||
      !Number.isFinite(modelContextWindow) ||
      modelContextWindow <= 0
    ) {
      return {
        inputBudget: 0,
        outputBudget: 0,
        safetyMargin: 0,
        sections: { system: 0, tools: 0, memory: 0, context: 0, history: 0, user: 0 },
      };
    }

    const inputBudget = Math.floor(modelContextWindow * 0.7);
    const outputBudget = Math.floor(modelContextWindow * 0.2);
    const safetyMargin = Math.floor(modelContextWindow * 0.1);
    const ratios = ALLOCATION_TABLE[tier];

    return {
      inputBudget,
      outputBudget,
      safetyMargin,
      sections: {
        system: Math.floor(modelContextWindow * ratios.system),
        tools: Math.floor(modelContextWindow * ratios.tools),
        memory: Math.floor(modelContextWindow * ratios.memory),
        context: Math.floor(modelContextWindow * ratios.context),
        history: Math.floor(modelContextWindow * ratios.history),
        user: Math.floor(modelContextWindow * ratios.user),
      },
    };
  }

  /**
   * Native counting path (D-09): delegates to a provider-supplied counter
   * when available, falling back to character heuristics on error or
   * malformed results. TokenBudget orchestrates — the caller provides the
   * counter function.
   */
  async estimateTokensFromNative(
    text: string,
    nativeCounter: (text: string) => Promise<number>,
  ): Promise<number> {
    try {
      const count = await nativeCounter(text);
      if (Number.isFinite(count) && count >= 0) return Math.floor(count);
      return this.estimateTokens(text);
    } catch {
      return this.estimateTokens(text);
    }
  }
}

export const tokenBudget = new TokenBudget();
