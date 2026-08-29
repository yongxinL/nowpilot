// DefuddleStrategy — the PRIMARY read path (mode 'default'), panel-side.
//
// Runs the real defuddle engine on a DETACHED DOMParser document with an
// injected <base href> (spec 3726-3740 canonical shape, ADR-P6-01). Two
// RESEARCH corrections are embedded:
//   1. `import Defuddle from 'defuddle/full'` — the DEFAULT export; spec
//      3721's named import shape fails TS2305 (verified against the published
//      0.19.3 dist).
//   2. `useAsync: false` is EXPLICIT — the option defaults to TRUE in 0.19.x
//      and would allow async extractors to fetch third-party APIs (T-P6-05,
//      §0.2 privacy). parse() is synchronous; async extractors never run.
//
// Readability is this strategy's INTERNAL low-confidence fallback (D-80) —
// never a separate strategy file; it appears only as StrategyResult.source
// provenance ('readability'). Any engine failure records the failed-fallback
// shape (markdown undefined) and is never rethrown — the service decides the
// typed CONTENT_EXTRACT_FAILED error (D-91). The fallback may mutate the doc;
// the detached doc is disposable, so no clone is needed.
import Defuddle from 'defuddle/full';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

import { countTokensHeuristic } from '../../context/TokenBudget';
import type { IExtractionStrategy, StrategyInput, StrategyResult } from './IExtractionStrategy';

/** Agent's-discretion low-confidence threshold (RESEARCH Pattern 2): fires the
 * Readability fallback when defuddle yields fewer words than this. Sits below
 * defuddle's internal 200-word auto-retry so the strategy-level fallback only
 * engages when defuddle itself produced almost nothing. */
export const DEFUDDLE_LOW_CONFIDENCE_WORD_COUNT = 50;

export class DefuddleStrategy implements IExtractionStrategy {
  readonly id = 'defuddle' as const;

  canHandle(i: { url: string; mode: 'default' | 'actionable' }): boolean {
    return i.mode === 'default';
  }

  async run(input: StrategyInput): Promise<StrategyResult> {
    try {
      return this.parseDetached(input);
    } catch {
      // Never rethrow — the service decides the typed error. Any engine
      // failure records the failed-fallback shape with source 'readability'
      // (provenance: the fallback was attempted and exhausted).
      return { source: 'readability', markdown: undefined, approxTokens: 0, truncated: true };
    }
  }

  private parseDetached(input: StrategyInput): StrategyResult {
    const doc = new DOMParser().parseFromString(input.html ?? '', 'text/html');
    // Spec 3726-3740 canonical shape: the panel injects the payload's
    // effective base URL into the detached doc (StrategyInput.baseUrl — the
    // documented additive field), falling back to `url` when absent.
    const base = input.baseUrl ?? input.url;
    if (!doc.querySelector('base')) {
      const baseEl = doc.createElement('base');
      baseEl.setAttribute('href', base);
      doc.head?.prepend(baseEl);
    }

    const result = new Defuddle(doc, {
      url: base,
      markdown: true,
      useAsync: false, // PRIVACY-CRITICAL: default is TRUE in 0.19.x — must be explicit
    }).parse();

    const markdown = result.content ?? '';
    const wordCount = result.wordCount ?? 0;
    if (!markdown.trim() || wordCount < DEFUDDLE_LOW_CONFIDENCE_WORD_COUNT) {
      return this.readabilityFallback(doc, input);
    }

    return {
      source: 'defuddle',
      markdown,
      meta: { title: result.title ?? input.title, wordCount: String(wordCount) },
      approxTokens: countTokensHeuristic(markdown),
      truncated: input.truncated ?? false,
    };
  }

  private readabilityFallback(doc: Document, input: StrategyInput): StrategyResult {
    // parse() may mutate the doc — the detached doc is disposable (RESEARCH
    // Pattern 4; no clone needed since this is the final attempt).
    const article = new Readability(doc).parse();
    if (!article || !article.content || !article.textContent?.trim()) {
      // Fallback exhausted — record provenance and let the service surface
      // the typed error; never a silent empty result (D-91).
      return { source: 'readability', markdown: undefined, approxTokens: 0, truncated: true };
    }
    const markdown = new TurndownService({ headingStyle: 'atx' }).turndown(article.content);
    return {
      source: 'readability',
      markdown,
      meta: { title: article.title ?? input.title },
      approxTokens: countTokensHeuristic(markdown),
      truncated: input.truncated ?? false,
    };
  }
}

/** Singleton registered by PageContentService at module load (openaiProvider precedent). */
export const defuddleStrategy = new DefuddleStrategy();