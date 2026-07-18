import { debugLog } from '../../utils/debugLog';
import type { ProviderRouter } from '../router/ProviderRouter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FollowUpSuggestion {
  text: string;
  source: 'heuristic' | 'llm';
}

export interface FollowUpContext {
  hostname: string;
  userMessage?: string;
}

// ---------------------------------------------------------------------------
// Eligibility keywords
// ---------------------------------------------------------------------------

const ELIGIBLE_KEYWORDS = [
  'summary', 'summarize', 'summarizing',
  'code', 'function', 'class', 'import', 'def ',
  'steps', 'step ',
  'analysis', 'analyze',
  'report',
  'list',
  'plan',
  'research',
  'script',
  'error',
  'solution',
  'explain',
  'overview',
  'findings',
  'result',
  'conclusion',
  'recommend',
  'implement',
];

const SKIP_PATTERNS = [
  /^(hi|hello|hey|thanks|thank you|great|okay?|sure|yes|no)\b/i,
  /^I (don't|do not|can't|cannot) /i,
  /error/i,
  /sorry/i,
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class FollowUpService {
  constructor(private router: ProviderRouter) {}

  /**
   * Generate follow-up suggestions based on the AI response.
   *
   * Step 1 — Eligibility check (fast heuristic)
   * Step 2 — Generate heuristic suggestions based on response characteristics
   * Step 3 — Optional Haiku-tier LLM enhancement (3s timeout, non-blocking)
   *
   * Never throws. Always returns an array (empty if nothing to suggest).
   */
  async generateSuggestions(
    response: string,
    context: FollowUpContext,
  ): Promise<FollowUpSuggestion[]> {
    try {
      // Step 1 — Eligibility check
      if (!this.#isEligible(response)) {
        return [];
      }

      // Step 2 — Heuristic suggestions
      const heuristics = this.#generateHeuristics(response);
      if (heuristics.length === 0) {
        return [];
      }

      // Step 3 — Optional Haiku-tier enhancement (for high-value responses)
      const llmSuggestions = await this.#tryLLMEnhancement(response, context);

      // Merge: LLM suggestions first, then heuristics. Cap at 3 total.
      const merged: FollowUpSuggestion[] = [];
      if (llmSuggestions.length > 0) {
        merged.push(...llmSuggestions.slice(0, 2));
      }
      // Add heuristic suggestions, but don't exceed 3 total
      const remaining = 3 - merged.length;
      if (remaining > 0) {
        // Pick heuristics that don't duplicate LLM suggestions
        const llmTexts = new Set(llmSuggestions.map((s) => s.text.toLowerCase()));
        const nonDuplicate = heuristics.filter(
          (h) => !llmTexts.has(h.text.toLowerCase()),
        );
        merged.push(...nonDuplicate.slice(0, remaining));
      }

      return merged.slice(0, 3);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      debugLog('error', '[FollowUpService] generateSuggestions failed', { error: errorMsg });
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // Private: Eligibility
  // -----------------------------------------------------------------------

  #isEligible(response: string): boolean {
    if (!response || response.length < 100) {
      return false;
    }

    // Check skip patterns
    for (const pattern of SKIP_PATTERNS) {
      if (pattern.test(response.trim())) {
        return false;
      }
    }

    // Check for eligible keywords
    const lower = response.toLowerCase();
    for (const keyword of ELIGIBLE_KEYWORDS) {
      if (lower.includes(keyword)) {
        return true;
      }
    }

    return false;
  }

  // -----------------------------------------------------------------------
  // Private: Heuristic generation
  // -----------------------------------------------------------------------

  #generateHeuristics(response: string): FollowUpSuggestion[] {
    const suggestions: FollowUpSuggestion[] = [];
    const lower = response.toLowerCase();
    const added = new Set<string>();

    const addIfNew = (text: string) => {
      const key = text.toLowerCase();
      if (!added.has(key)) {
        added.add(key);
        suggestions.push({ text, source: 'heuristic' });
      }
    };

    // Contains summary/summarize keywords
    if (lower.includes('summary') || lower.includes('summarize')) {
      addIfNew('Expand on key points');
      addIfNew('Translate this summary');
    }

    // Contains code fences or code-related keywords
    if (
      lower.includes('```') ||
      lower.includes('function') ||
      lower.includes('class ') ||
      lower.includes('import ')
    ) {
      addIfNew('Explain this code line by line');
      addIfNew('Add error handling');
    }

    // Contains numbered list or bullet points
    if (
      lower.includes('1.') ||
      lower.includes('2.') ||
      lower.includes('- ') ||
      lower.includes('* ')
    ) {
      addIfNew('Elaborate on step 1');
      addIfNew('Turn into a checklist');
    }

    // Contains analysis/research content
    if (
      lower.includes('analysis') ||
      lower.includes('analyze') ||
      lower.includes('research') ||
      lower.includes('findings')
    ) {
      addIfNew('Save as note');
      addIfNew('Find related information');
    }

    // Contains plan/planning
    if (lower.includes('plan') || lower.includes('recommend')) {
      addIfNew('Save as note');
      addIfNew('Tell me more about this');
    }

    // Generic fallback — only if no other suggestions matched
    if (suggestions.length === 0) {
      addIfNew('Tell me more about this');
      addIfNew('Save to note');
    }

    return suggestions.slice(0, 2);
  }

  // -----------------------------------------------------------------------
  // Private: LLM enhancement (optional, Haiku-tier, 3s timeout)
  // -----------------------------------------------------------------------

  async #tryLLMEnhancement(
    response: string,
    _context: FollowUpContext,
  ): Promise<FollowUpSuggestion[]> {
    // Only for high-value responses: >300 chars AND research/planning/analysis keywords
    if (response.length < 300) {
      return [];
    }

    const lower = response.toLowerCase();
    const highValueKeywords = ['research', 'analysis', 'analyze', 'plan', 'report', 'findings', 'summary', 'recommend', 'solution', 'overview'];
    const hasHighValue = highValueKeywords.some((kw) => lower.includes(kw));
    if (!hasHighValue) {
      return [];
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const model = await this.router.selectModel('haiku', []);
      clearTimeout(timeout);

      if (!model) {
        return [];
      }

      const { generateText } = await import('ai');
      const result = await generateText({
        model: model.instance as Parameters<typeof generateText>[0]['model'],
        prompt: `Given this AI response: "${response.slice(0, 500)}..." Suggest 1-2 natural follow-up questions a user might ask. Return as JSON array of strings.`,
        maxTokens: 100,
        temperature: 0.3,
        abortSignal: controller.signal,
      });

      if (!result.text) {
        return [];
      }

      // Parse JSON response
      const parsed = JSON.parse(result.text);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item): item is string => typeof item === 'string' && item.length > 0)
        .slice(0, 2)
        .map((text) => ({
          text,
          source: 'llm' as const,
        }));
    } catch (err) {
      const isTimeout =
        err instanceof DOMException &&
        (err.name === 'AbortError' || err.name === 'TimeoutError');
      if (isTimeout) {
        debugLog('warn', '[FollowUpService] LLM call timed out — returning heuristic suggestions');
      } else {
        const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
        debugLog('warn', '[FollowUpService] LLM call failed — returning heuristic suggestions', { error: errorMsg });
      }
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

import { providerRouter } from '../router/ProviderRouter';

export const followUpService = new FollowUpService(providerRouter);
