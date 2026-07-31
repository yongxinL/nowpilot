import Defuddle from 'defuddle/full';
import type { IExtractionStrategy } from './IExtractionStrategy';
import type { ExtractionMode, StrategyInput, StrategyResult } from '../types';

/**
 * Defuddle-based article extraction strategy (D-07).
 *
 * Parses the serialized HTML in the extension-page context (never in the
 * content script — D-05) via a DOMParser sandbox, then runs Defuddle's
 * extraction pipeline with markdown output.
 *
 * Confidence is NOT decided here: the orchestrator (PageContentService)
 * checks `content.length < 500` to decide whether to fall back (D-07).
 */
export class DefuddleStrategy implements IExtractionStrategy {
  readonly id = 'defuddle' as const;

  canHandle(input: { url: string; mode: ExtractionMode }): boolean {
    return input.mode === 'default';
  }

  async run(input: StrategyInput): Promise<StrategyResult> {
    if (!input.html) {
      throw new Error('DefuddleStrategy: no HTML provided');
    }

    const doc = new DOMParser().parseFromString(input.html, 'text/html');
    const parsed = new Defuddle(doc, {
      markdown: true,
      // Local extraction only — never fetch third-party content (extraction
      // is on-demand and must not make network calls from the extension page).
      useAsync: false,
      url: input.url,
    }).parse();

    const markdown = parsed.content ?? '';
    return {
      source: 'defuddle',
      markdown,
      meta: {
        author: parsed.author || '',
        description: parsed.description || '',
        language: parsed.language || '',
        siteName: parsed.site || '',
        publishDate: parsed.published || '',
      },
      approxTokens: Math.ceil(markdown.length / 4),
      truncated: false,
    };
  }
}
