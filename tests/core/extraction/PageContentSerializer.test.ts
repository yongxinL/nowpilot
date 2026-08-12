// tests/core/extraction/PageContentSerializer.test.ts — 04a-03 Task 3 behavior
// pin (RESEARCH Pitfall 1): defuddle's browser-bundle markdown option is a
// NO-OP, so turndown (approved stack) is the single HTML→markdown converter.
//   1. htmlToMarkdown('<h1>Hello</h1>') === '# Hello' — atx heading conversion
//      works at the pinned TURNDOWN_OPTIONS.
//   2. TURNDOWN_OPTIONS is exported with the verified defuddle markdown.js
//      parity keys (headingStyle atx, hr '---', bulletListMarker '-',
//      codeBlockStyle 'fenced', emDelimiter '*', preformattedCode true — A6).
import { describe, expect, it } from 'vitest';

import { TURNDOWN_OPTIONS, htmlToMarkdown } from '@/core/extraction/PageContentSerializer';

describe('PageContentSerializer (04a-03 — single turndown converter)', () => {
  it("converts '<h1>Hello</h1>' to '# Hello' (atx heading)", () => {
    expect(htmlToMarkdown('<h1>Hello</h1>')).toBe('# Hello');
  });

  it('exports TURNDOWN_OPTIONS with the defuddle markdown.js parity keys (A6)', () => {
    expect(TURNDOWN_OPTIONS).toMatchObject({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      preformattedCode: true,
    });
  });
});
