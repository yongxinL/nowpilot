import { generateText } from 'ai';
import type { ProviderAdapter } from '../ai/providers/ProviderAdapter';
import type { ModelContextTier, PromptSection } from '../ai/types';
import { tokenBudget } from './TokenBudget';

interface CompressionStepContext {
  tier: ModelContextTier;
}

interface DegradationStep {
  name: string;
  apply: (sections: PromptSection[], ctx: CompressionStepContext) => PromptSection[];
}

/**
 * Degradation pipeline (spec §2.4, D-06/D-07/D-08): when the assembled
 * context exceeds the token budget, this compressor applies 7 ordered
 * degradation steps (product policy — never reordered), re-checks the
 * budget after every step, and stops at the first step that brings the
 * total under budget. If local techniques fail, a single AI summarization
 * call (cheapest available provider via ProviderRouter.getCompressionModel,
 * D-08) is attempted. The compressor never throws CONTEXT_TOO_LARGE
 * itself — the caller (ContextOptimizer) decides after the final budget
 * check.
 *
 * All section mutations create NEW section objects (shallow clones) —
 * the input array and its elements are never mutated, preserving the
 * original sections for provenance comparison. The `stable` flag is
 * read-only metadata (D-14) and is never modified.
 */
export class ContextCompressor {
  /**
   * The 7-step degradation sequence is product policy per D-07 — a
   * private readonly constant so no external input can reorder or skip
   * steps (T-04-07).
   */
  private static readonly STEPS: readonly DegradationStep[] = [
    { name: 'drop-debug', apply: dropDebug },
    { name: 'drop-secondary', apply: dropSecondary },
    { name: 'summarise-history', apply: summariseHistory },
    { name: 'compress-page', apply: compressPage },
    { name: 'trim-tools', apply: trimTools },
    { name: 'reduce-memory', apply: reduceMemory },
    { name: 'minimal-mode', apply: minimalMode },
  ];

  async compress(
    sections: PromptSection[],
    budget: number,
    tier: ModelContextTier,
    compressionModelProvider?: () => Promise<ProviderAdapter | null>,
  ): Promise<{ sections: PromptSection[]; stepsApplied: string[] }> {
    let currentSections = sections.map((s) => ({ ...s }));
    const stepsApplied: string[] = [];

    // Degradation loop (Pattern 3): check the budget BEFORE each step,
    // apply the step, record it, and let the next iteration's check stop
    // the pipeline at the first step that satisfies the budget (D-07).
    for (const step of ContextCompressor.STEPS) {
      const totalBefore = currentSections.reduce((sum, s) => sum + s.tokens, 0);
      if (totalBefore <= budget) break;
      currentSections = step.apply(currentSections, { tier });
      stepsApplied.push(step.name);
    }

    // AI summarization overflow (D-06, D-08): only when all local
    // degradation steps failed to bring the context under budget. The
    // compression model selection is independent of the user's
    // conversation tier. Single call — never iterative (T-04-08).
    const finalTotal = currentSections.reduce((sum, s) => sum + s.tokens, 0);
    if (finalTotal > budget && compressionModelProvider) {
      const outcome = await this.tryAiSummarization(currentSections, compressionModelProvider);
      currentSections = outcome.sections;
      if (outcome.attempted) stepsApplied.push('ai-summarisation');
    }

    // If still over budget, the caller (ContextOptimizer) throws
    // CONTEXT_TOO_LARGE — the compressor only reports the result.
    return { sections: currentSections, stepsApplied };
  }

  /**
   * Single AI summarization call per T-04-08. Any failure (provider
   * unavailable, malformed/empty output, call error) degrades gracefully
   * per T-04-09: keep the pre-summarization sections and let the caller's
   * final budget check surface CONTEXT_TOO_LARGE.
   */
  private async tryAiSummarization(
    sections: PromptSection[],
    compressionModelProvider: () => Promise<ProviderAdapter | null>,
  ): Promise<{ sections: PromptSection[]; attempted: boolean }> {
    let adapter: ProviderAdapter | null = null;
    try {
      adapter = await compressionModelProvider();
    } catch (err) {
      console.warn(
        '[ContextCompressor] compression model unavailable; falling through to CONTEXT_TOO_LARGE',
        err,
      );
      return { sections, attempted: false };
    }
    if (adapter === null) {
      return { sections, attempted: false };
    }

    try {
      const model = adapter.createLanguageModel(adapter.getDefaultModelForTier('FAST'));
      const result = await generateText({ model, prompt: buildSummarizationPrompt(sections) });
      const summary = result?.text;
      if (typeof summary !== 'string' || summary.trim().length === 0) {
        console.warn(
          '[ContextCompressor] AI summarization returned empty output; keeping pre-summarization sections (T-04-09)',
        );
        return { sections, attempted: true };
      }
      return { sections: applyAiSummary(sections, summary), attempted: true };
    } catch (err) {
      console.warn(
        '[ContextCompressor] AI summarization failed; keeping pre-summarization sections (T-04-09)',
        err,
      );
      return { sections, attempted: true };
    }
  }
}

export const contextCompressor = new ContextCompressor();

// ---------------------------------------------------------------------------
// Degradation step implementations (module-private — the STEPS array is the
// only entry point, keeping the policy order unmodifiable from outside)
// ---------------------------------------------------------------------------

const TOOL_CAPS: Record<ModelContextTier, number | 'all'> = {
  tiny: 1,
  small: 3,
  medium: 5,
  large: 'all',
};

const MEMORY_CAPS: Record<ModelContextTier, number> = {
  tiny: 1,
  small: 3,
  medium: 5,
  large: 5,
};

const HISTORY_MAX_CHARS = 500;
const HISTORY_MARKER = '\n[... history summarized]';
const MINIMAL_SYSTEM_TOKENS = 200;
const MINIMAL_SUMMARY_TOKENS = 200;
const PREFERENCES_COMPACT_TOKENS = 50;

/** 1. drop-debug: remove sections whose sourceId starts with 'debug.'. */
function dropDebug(sections: PromptSection[]): PromptSection[] {
  return sections.filter((s) => !s.sourceId.startsWith('debug.'));
}

/** 2. drop-secondary: remove sections carrying secondary/optional context. */
function dropSecondary(sections: PromptSection[]): PromptSection[] {
  return sections.filter(
    (s) => !s.sourceId.includes('secondary') && !s.sourceId.includes('optional'),
  );
}

/** 3. summarise-history: truncate history sections to ~500 chars, preserving the most recent turns. */
function summariseHistory(sections: PromptSection[]): PromptSection[] {
  return sections.map((s) => {
    if (s.kind !== 'context' || !s.sourceId.includes('history')) return s;
    if (s.text.length <= HISTORY_MAX_CHARS) return s;
    const truncated = keepRecentTurns(s.text, HISTORY_MAX_CHARS) ?? s.text.slice(-HISTORY_MAX_CHARS);
    const next = `${truncated}${HISTORY_MARKER}`;
    return { ...s, text: next, tokens: tokenBudget.estimateTokens(next) };
  });
}

/** 4. compress-page: replace page body text with a structured metadata summary. */
function compressPage(sections: PromptSection[]): PromptSection[] {
  return sections.map((s) => {
    if (!(s.kind === 'context' && s.sourceId === 'context.page.current')) return s;
    const summary = buildPageSummary(s.text);
    if (summary === null || summary === s.text) return s;
    return { ...s, text: summary, tokens: tokenBudget.estimateTokens(summary) };
  });
}

/** 5. trim-tools: keep only essential tool schemas (dangerous first dropped, then top-N by priority). */
function trimTools(sections: PromptSection[], ctx: CompressionStepContext): PromptSection[] {
  return sections.map((s) => {
    if (s.kind !== 'tool_schemas') return s;
    try {
      const parsed = JSON.parse(s.text);
      if (!Array.isArray(parsed)) return s;
      const safe = parsed.filter(
        (t) =>
          t === null || typeof t !== 'object' || (t as Record<string, unknown>).dangerous !== true,
      );
      const ranked = safe
        .map((t, index) => ({
          t,
          priority:
            typeof (t as Record<string, unknown>).priority === 'number'
              ? ((t as Record<string, unknown>).priority as number)
              : index,
        }))
        .sort((a, b) => a.priority - b.priority)
        .map((x) => x.t);
      const cap = TOOL_CAPS[ctx.tier];
      const kept = cap === 'all' ? ranked : ranked.slice(0, cap);
      if (kept.length === parsed.length) return s; // nothing dropped — no rewrite
      const next = JSON.stringify(kept);
      return { ...s, text: next, tokens: tokenBudget.estimateTokens(next) };
    } catch {
      return s;
    }
  });
}

/** 6. reduce-memory: keep top-K memory entries per tier; skip already-small sections (≤3 entries). */
function reduceMemory(sections: PromptSection[], ctx: CompressionStepContext): PromptSection[] {
  return sections.map((s) => {
    if (s.kind !== 'memory') return s;
    try {
      const parsed = JSON.parse(s.text);
      if (!Array.isArray(parsed)) return s;
      if (parsed.length <= 3) return s; // already small — skip
      const kept = parsed.slice(0, MEMORY_CAPS[ctx.tier]);
      const next = JSON.stringify(kept);
      return { ...s, text: next, tokens: tokenBudget.estimateTokens(next) };
    } catch {
      return s;
    }
  });
}

/**
 * 7. minimal-mode: enforce the §2.5 restrictions — compact system prompt
 * (≤200 tokens), compact preferences, top-3 memories, at most one safe
 * tool schema, last 1-2 turns with a ≤200-token conversation summary, and
 * page context dropped entirely.
 */
function minimalMode(sections: PromptSection[]): PromptSection[] {
  return sections.flatMap((s) => {
    switch (s.kind) {
      case 'system': {
        const next = truncateToTokens(s.text, MINIMAL_SYSTEM_TOKENS);
        if (next === s.text) return [s];
        return [{ ...s, text: next, tokens: tokenBudget.estimateTokens(next) }];
      }
      case 'preferences': {
        if (s.tokens < PREFERENCES_COMPACT_TOKENS) return [s]; // already compact
        const next = truncateToTokens(s.text, PREFERENCES_COMPACT_TOKENS);
        return [{ ...s, text: next, tokens: tokenBudget.estimateTokens(next) }];
      }
      case 'memory': {
        try {
          const parsed = JSON.parse(s.text);
          if (!Array.isArray(parsed)) return [s];
          const kept = parsed.slice(0, 3);
          if (kept.length >= parsed.length) return [s];
          const next = JSON.stringify(kept);
          return [{ ...s, text: next, tokens: tokenBudget.estimateTokens(next) }];
        } catch {
          return [s];
        }
      }
      case 'tool_schemas': {
        try {
          const parsed = JSON.parse(s.text);
          if (!Array.isArray(parsed) || parsed.length <= 1) return [s];
          const safe = parsed.filter(
            (t) =>
              t === null || typeof t !== 'object' || (t as Record<string, unknown>).dangerous !== true,
          );
          const kept = safe.length > 0 ? safe.slice(0, 1) : parsed.slice(0, 1);
          const next = JSON.stringify(kept);
          return [{ ...s, text: next, tokens: tokenBudget.estimateTokens(next) }];
        } catch {
          return [s];
        }
      }
      case 'context':
        if (s.sourceId.startsWith('history.')) {
          const next = minimalHistory(s.text);
          if (next === s.text) return [s];
          return [{ ...s, text: next, tokens: tokenBudget.estimateTokens(next) }];
        }
        if (s.sourceId.startsWith('context.page')) return []; // page context dropped (§2.5)
        return [s];
      default:
        // user_input and task sections are never touched by degradation.
        return [s];
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Keep the most recent turns of a JSON turn array that fit within maxChars. */
function keepRecentTurns(text: string, maxChars: number): string | null {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    let kept: unknown[] = [];
    for (let i = parsed.length - 1; i >= 0; i--) {
      const candidate = [parsed[i], ...kept];
      if (kept.length > 0 && JSON.stringify(candidate).length > maxChars) break;
      kept = candidate;
    }
    if (kept.length >= parsed.length) return null; // nothing dropped
    return JSON.stringify(kept);
  } catch {
    return null;
  }
}

/** Extract title/URL/headings from page context JSON and drop the body text. */
function buildPageSummary(text: string): string | null {
  try {
    const page = JSON.parse(text) as Record<string, unknown>;
    if (page === null || typeof page !== 'object') return null;
    const title = typeof page.title === 'string' ? page.title : '';
    const url = typeof page.url === 'string' ? page.url : '';
    const headings = Array.isArray(page.headings)
      ? page.headings.filter((h): h is string => typeof h === 'string').join(', ')
      : typeof page.headings === 'string'
        ? page.headings
        : '';
    return `Page: ${title}\nURL: ${url}\nKey headings: ${headings}\n[content compressed]`;
  } catch {
    // Not JSON — treat the whole text as a plain page description.
    return `Page: unknown\nURL: unknown\nKey headings: none\n[content compressed]`;
  }
}

/**
 * Minimal-mode history: keep the last 1-2 turns with a conversation summary
 * of at most MINIMAL_SUMMARY_TOKENS tokens (§2.5).
 */
function minimalHistory(text: string): string {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const lastTwo = JSON.stringify(parsed.slice(-2));
      if (tokenBudget.estimateTokens(lastTwo) <= MINIMAL_SUMMARY_TOKENS) return lastTwo;
      const lastOne = JSON.stringify(parsed.slice(-1));
      if (tokenBudget.estimateTokens(lastOne) <= MINIMAL_SUMMARY_TOKENS) return lastOne;
      return truncateToTokens(lastOne, MINIMAL_SUMMARY_TOKENS);
    }
  } catch {
    // fall through to plain-text handling
  }
  return truncateToTokens(text, MINIMAL_SUMMARY_TOKENS);
}

/**
 * Largest text prefix whose estimated token count is ≤ maxTokens.
 * Uses the same TokenBudget.estimateTokens() as everywhere else so
 * pre-compression and post-compression estimation stay consistent (T-04-11).
 */
function truncateToTokens(text: string, maxTokens: number): string {
  if (text.length === 0 || tokenBudget.estimateTokens(text) <= maxTokens) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (tokenBudget.estimateTokens(text.slice(0, mid)) <= maxTokens) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo);
}

/** Prompt for the single AI summarization call (T-04-08: one call, no retry loop). */
function buildSummarizationPrompt(sections: PromptSection[]): string {
  const content = sections
    .filter((s) => !s.stable && s.kind !== 'user_input' && s.kind !== 'task')
    .map((s) => s.text)
    .join('\n\n');
  return (
    'Condense the following context into a concise summary under 200 tokens. ' +
    'Preserve key facts, names, URLs, and decisions.\n\n' +
    content.slice(-8000)
  );
}

/**
 * Replace the non-stable content sections (memory/context) with a single
 * AI-generated summary section; stable sections (system, tool_schemas,
 * preferences), user input, and the task slot are preserved.
 */
function applyAiSummary(sections: PromptSection[], summary: string): PromptSection[] {
  const summarySection: PromptSection = {
    kind: 'context',
    text: summary,
    tokens: tokenBudget.estimateTokens(summary),
    stable: false,
    sourceId: 'ai.compression.summary',
  };
  return [
    ...sections.filter((s) => s.stable || s.kind === 'user_input' || s.kind === 'task'),
    summarySection,
  ];
}
