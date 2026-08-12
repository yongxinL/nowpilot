// tests/core/extraction/PageIndexBuilder.test.ts — 04a-05 Task 2 fixture-driven
// chunking/index tests (D-4a-15/16, A6 guard): heading-boundary chunking with
// '(preamble)' + headingPath breadcrumbs, 500-token sub-chunking, no-heading
// paragraph fallback, deterministic `${tabId}:${sectionPath}:${chunkIndex}` ids,
// and MiniSearch field indexing over the shared golden fixtures (D-4a-24).
// Markdown is produced via PageContentSerializer.htmlToMarkdown (the single
// turndown converter — the A6 parity guard: consistent '#' headings on every
// path). MiniSearch v7 (approved engine §7/§26.5 — never a hand-rolled index).
// Pure string/MiniSearch logic — node env (PageRegistry.test.ts L8 precedent).
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { estimateTokens } from '@/core/context/TokenBudget';
import { htmlToMarkdown } from '@/core/extraction/PageContentSerializer';
import {
  INDEX_CHUNK_MAX_TOKENS,
  buildPageIndex,
  chunkMarkdown,
} from '@/core/extraction/PageIndexBuilder';
import {
  buildArticleFixture,
  buildLargeArticleFixture,
  buildNoHeadingFixture,
} from '../../fixtures/pageContent';

describe('PageIndexBuilder (04a-05 — heading chunking + (preamble) + headingPath, D-4a-16)', () => {
  it('exports the pinned INDEX_CHUNK_MAX_TOKENS = 500 constant', () => {
    expect(INDEX_CHUNK_MAX_TOKENS).toBe(500);
  });

  it('chunks the large article into heading sections with breadcrumb headingPath + (preamble) + sub-chunks', () => {
    const { html, title, url } = buildLargeArticleFixture();
    const markdown = htmlToMarkdown(html);
    const chunks = chunkMarkdown(markdown, { title, url, tabId: 7 });

    // (preamble) covers the pre-heading text (the rendered <title> line before h1).
    const preamble = chunks.find((c) => c.id.startsWith('7:(preamble):'));
    expect(preamble).toBeDefined();
    expect(preamble!.headingPath).toBe('');
    expect(preamble!.sectionText).toContain('Deep Dive: Extraction Internals');

    // h2 sections carry the h1 > h2 breadcrumb.
    const sectionPath = 'Deep Dive: Extraction Internals > Content Script Contract';
    const sectionChunks = chunks.filter((c) => c.headingPath === sectionPath);
    // Each h2 body is ~556 tokens (> INDEX_CHUNK_MAX_TOKENS) → split into paragraph sub-chunks.
    expect(sectionChunks.length).toBeGreaterThan(1);
    for (const c of sectionChunks) {
      expect(c.headingPath).toBe(sectionPath); // sub-chunks inherit the parent headingPath
      expect(estimateTokens(c.sectionText)).toBeLessThanOrEqual(INDEX_CHUNK_MAX_TOKENS);
    }
    // The other two h2 sections exist with the same breadcrumb shape.
    expect(
      chunks.some(
        (c) => c.headingPath === 'Deep Dive: Extraction Internals > Layered Strategy Order',
      ),
    ).toBe(true);
    expect(
      chunks.some(
        (c) => c.headingPath === 'Deep Dive: Extraction Internals > Ephemeral Index Lifecycle',
      ),
    ).toBe(true);
  });

  it('falls back to paragraph-block chunks under the page title for no-heading markdown', () => {
    const { html, title, url } = buildNoHeadingFixture();
    const markdown = htmlToMarkdown(html);
    const chunks = chunkMarkdown(markdown, { title, url, tabId: 7 });

    expect(chunks.length).toBeGreaterThanOrEqual(5);
    for (const c of chunks) {
      expect(c.headingPath).toBe(title); // under the page title
      expect(c.id).not.toContain('(preamble)'); // no synthetic preamble chunk
    }
    // Paragraph content is preserved across the blank-line-separated blocks.
    expect(chunks.some((c) => c.sectionText.includes('incident timeline'))).toBe(true);
    expect(chunks.some((c) => c.sectionText.includes('remediation steps'))).toBe(true);
  });

  it('builds a MiniSearch index where a section keyword finds the right doc with stored fields', () => {
    const { html, title, url } = buildArticleFixture();
    const markdown = htmlToMarkdown(html);
    const chunks = chunkMarkdown(markdown, { title, url, tabId: 7 });
    const mini = buildPageIndex(chunks);

    // 'quickstart' appears only in the Detached parsing section body.
    const results = mini.search('quickstart');
    expect(results.length).toBeGreaterThan(0);
    const hit = results[0];
    expect(hit.sectionText).toContain('quickstart');
    expect(hit.headingPath).toBe(
      'How NowPilot Extracts Page Content > Architecture > Detached parsing',
    );
    // storeFields are populated on results (title/url/headingPath/sectionText).
    expect(hit.title).toBe(title);
    expect(hit.url).toBe(url);
  });

  it('produces deterministic `${tabId}:${sectionPath}:${chunkIndex}` ids', () => {
    const { html, title, url } = buildLargeArticleFixture();
    const markdown = htmlToMarkdown(html);

    const a = chunkMarkdown(markdown, { title, url, tabId: 7 });
    const b = chunkMarkdown(markdown, { title, url, tabId: 7 });
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));

    for (const c of a) {
      expect(c.id).toMatch(/^7:.+:\d+$/); // tabId:sectionPath:chunkIndex
    }
    // A different tabId changes every id (no cross-tab collisions).
    const c = chunkMarkdown(markdown, { title, url, tabId: 9 });
    expect(c.map((chunk) => chunk.id)).not.toEqual(a.map((chunk) => chunk.id));
  });
});
