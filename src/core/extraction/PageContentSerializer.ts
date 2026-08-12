// src/core/extraction/PageContentSerializer.ts — the single HTML→markdown converter (RESEARCH: defuddle@0.6.6 browser-bundle markdown:true is a NO-OP — turndown is the approved-stack converter every prose path routes through). TURNDOWN_OPTIONS verified byte-identical to defuddle's own markdown.js (A6).
// Module-level singleton + exported pure function (TraceRedactor.ts L10-29 pattern).
import TurndownService from 'turndown';

/**
 * Verified: identical to the config defuddle's own markdown.js uses internally
 * (headingStyle atx, hr ---, bulletListMarker -, codeBlockStyle fenced,
 * emDelimiter *, preformattedCode true) — consistent markdown across the
 * Defuddle/Readability/APC-lite layers keeps the heading chunker (04a-05)
 * reliable on every path (A6 parity guard).
 */
export const TURNDOWN_OPTIONS = {
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  preformattedCode: true,
} as const;

const turndown = new TurndownService(TURNDOWN_OPTIONS);

/** The ONLY HTML→markdown path — do not hand-roll a second converter. */
export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}
