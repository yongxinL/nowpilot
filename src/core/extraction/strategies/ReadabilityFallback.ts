import { Readability } from '@mozilla/readability';
import type { IExtractionStrategy } from './IExtractionStrategy';
import type { ExtractionMode, StrategyInput, StrategyResult } from '../types';

/**
 * Mozilla Reader View fallback strategy (D-07).
 *
 * Runs when Defuddle yields low-confidence output (< LOW_CONFIDENCE_CHAR_THRESHOLD
 * chars) for mode 'default'. Parses the serialized HTML in the extension-page
 * context (never in the content script — D-05) via a DOMParser sandbox and
 * extracts the article's plain textContent.
 *
 * Pitfall 3 guard: Readability mutates the DOM in place during scoring
 * (it removes/reorders candidate nodes). The document is therefore CLONED
 * before being handed to Readability so the original parsed document is
 * never corrupted (T-04a-06).
 *
 * Confidence is signaled by throwing 'Readability low confidence' — the
 * orchestrator (PageContentService) records the failed attempt in
 * strategiesAttempted and continues the chain.
 */
export class ReadabilityFallback implements IExtractionStrategy {
  readonly id = 'readability' as const;

  /** D-07 confidence threshold — content below this is not worth surfacing. */
  static readonly LOW_CONFIDENCE_CHAR_THRESHOLD = 500;

  canHandle(input: { url: string; mode: ExtractionMode }): boolean {
    return input.mode === 'default';
  }

  async run(input: StrategyInput): Promise<StrategyResult> {
    if (!input.html) {
      throw new Error('ReadabilityFallback: no HTML provided');
    }

    const doc = new DOMParser().parseFromString(input.html, 'text/html');
    // Pitfall 3 (T-04a-06): Readability mutates the DOM during scoring —
    // parse against a clone so the original document stays intact.
    const clone = doc.cloneNode(true) as Document;
    const reader = new Readability(clone, {
      charThreshold: ReadabilityFallback.LOW_CONFIDENCE_CHAR_THRESHOLD,
    });
    const article = reader.parse();

    if (
      !article ||
      !article.textContent ||
      article.textContent.length < ReadabilityFallback.LOW_CONFIDENCE_CHAR_THRESHOLD
    ) {
      throw new Error('Readability low confidence');
    }

    return {
      source: 'readability',
      markdown: article.textContent,
      meta: {
        title: article.title || '',
        author: article.byline || '',
        description: article.excerpt || '',
        language: article.lang || '',
        siteName: article.siteName || '',
        publishDate: article.publishedTime || '',
      },
      approxTokens: Math.ceil(article.textContent.length / 4),
      truncated: false,
    };
  }
}
