// src/core/extraction/strategies/DefuddleStrategy.ts — 04a-04 primary read path
// (D-4a-14/18/08). Implements IExtractionStrategy for mode 'default':
//   parseDetached → new Defuddle(doc, { url, useAsync: false }).parse() → the
//   D-4a-18 threshold (MIN_EXTRACTED_CHARS char floor AND MIN_CONTENT_DENSITY
//   text/html ratio — never a bare-length heuristic) → Readability fallback on
//   a FRESH CLONE (Pitfall 2 — parse() mutates) → markdown ALWAYS via
//   PageContentSerializer.htmlToMarkdown (Pitfall 1 — defuddle's browser-bundle
//   markdown option is a no-op; the h1 whose text equals the <title> is deduped
//   into result.title by standardize, so the title text lives in meta.title).
//
// A5 (ACTIVE at the installed version): defuddle is installed at 0.19.2 (USER
// DEVIATION from the spec's ^0.6/0.6.6 pin, approved at the 04a-01 blocking-
// human gate). At 0.19.2 the `useAsync` option EXISTS and DEFAULTS TO TRUE —
// parseAsync()/fetchAsyncVariables() may fetch third-party APIs (YouTube
// transcripts, Reddit comments) when local content is thin, which would
// exfiltrate nothing but WOULD break the R-10 zero-network-call privacy
// guarantee. We therefore ALWAYS pass `useAsync: false` explicitly, and this
// strategy uses the sync parse() only. A future upgrade MUST keep useAsync:
// false (the ^0.6 pin had no useAsync at all — the guard comment travels with
// the upgrade).
//
// Base-URL stamp (D-4a-08): StrategyInput (R-1 verbatim, Appendix C.1 L4680)
// has no baseUrl field — the page URL (input.url) is the stamp source. The
// 04a-07 bridge supplies the page's effective base URL via the url field
// (document.baseURI resolution; root-relative hrefs resolve identically, proven
// by the A2 fixture). Defuddle 0.19.2 additionally resolves relative URLs
// internally, honoring <base href> first — both mechanisms agree.
import { Readability } from '@mozilla/readability';
import Defuddle from 'defuddle';

import { estimateTokens } from '@/core/context/TokenBudget';
import { htmlToMarkdown } from '@/core/extraction/PageContentSerializer';
import type { IExtractionStrategy, StrategyInput, StrategyResult } from './IExtractionStrategy';

/** D-4a-18 char floor — Readability charThreshold parity (exported + vitest-pinned). */
export const MIN_EXTRACTED_CHARS = 500;
/** D-4a-18 density ratio — extracted-text length / clean-HTML length (exported + vitest-pinned). */
export const MIN_CONTENT_DENSITY = 0.2;

/** Readability fallback constructor constant (D-4a-18 parity reference). */
const READABILITY_CHAR_THRESHOLD = 500;

/**
 * D-4a-08: DOMParser docs have baseURI === 'about:blank' — Readability (and
 * defuddle's own URL resolver) resolve relative links/images via the base URL,
 * so inject the real base as an absolute <base href> stamped at the head.
 */
function parseDetached(html: string, baseUrl: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const base = doc.createElement('base');
  base.href = baseUrl;
  doc.head.prepend(base);
  return doc;
}

/**
 * D-4a-18 extracted-text length heuristic: strip tags + collapse whitespace.
 * Feeds both the char floor and the density ratio (deterministic; never a
 * per-page calibration).
 */
function extractedTextLength(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
}

/**
 * D-4a-18 evaluation — the fallback fires when EITHER the char floor or the
 * content/boilerplate density ratio fails. Both constants exported + pinned.
 */
function belowThreshold(cleanHtml: string): boolean {
  const textLength = extractedTextLength(cleanHtml);
  const htmlLength = cleanHtml.length;
  if (textLength < MIN_EXTRACTED_CHARS) return true;
  if (htmlLength === 0) return true; // empty output — never a silent success
  return textLength / htmlLength < MIN_CONTENT_DENSITY;
}

export class DefuddleStrategy implements IExtractionStrategy {
  id = 'defuddle' as const;

  /** D-4a-14 mode gating — prose path only; 'actionable' routes to ApcLiteStrategy. */
  canHandle({ mode }: { url: string; mode: 'default' | 'actionable' }): boolean {
    return mode === 'default';
  }

  async run(input: StrategyInput): Promise<StrategyResult> {
    // canHandle gates the mode, but a defensive check keeps a bad call from
    // silently producing an empty result (PATTERNS L189).
    if (!input.html) throw new Error('DefuddleStrategy requires html');
    const doc = parseDetached(input.html, input.url);
    // A5: useAsync MUST stay false — 0.19.2 defaults it to true (network fetches).
    const defuddle = new Defuddle(doc, { url: input.url, useAsync: false });
    const result = defuddle.parse();

    // D-4a-18: below threshold → Readability on a FRESH CLONE (Pitfall 2 —
    // never the same doc defuddle parsed; parse() mutates).
    if (belowThreshold(result.content)) {
      const documentClone = doc.cloneNode(true) as Document;
      const article = new Readability(documentClone, {
        charThreshold: READABILITY_CHAR_THRESHOLD,
      }).parse();
      if (article) {
        return {
          source: 'readability',
          markdown: htmlToMarkdown(article.content),
          meta: {
            defuddleHtml: article.content,
            title: article.title,
            wordCount: String(article.textContent.trim().split(/\s+/).length),
          },
          approxTokens: estimateTokens(article.content),
          truncated: false,
        };
      }
      // CAT-01: Readability also yielded nothing — return the unusable (empty)
      // result; extractLayered (04a-08) tries the next strategy and eventually
      // throws typed CONTENT_EXTRACT_FAILED (D-4a-19). Never silent success.
      return {
        source: 'readability',
        markdown: '',
        meta: { defuddleHtml: result.content, title: result.title, wordCount: '0' },
        approxTokens: 0,
        truncated: false,
      };
    }

    return {
      source: 'defuddle',
      // Pitfall 1: markdown ALWAYS from the serializer (turndown) — the
      // browser bundle ignores defuddle's markdown option entirely.
      markdown: htmlToMarkdown(result.content),
      meta: {
        defuddleHtml: result.content,
        title: result.title,
        wordCount: String(result.wordCount),
      },
      approxTokens: estimateTokens(result.content),
      truncated: false,
    };
  }
}
