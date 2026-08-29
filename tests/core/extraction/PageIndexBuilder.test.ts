// PageIndexBuilder tests — §18 required test (06-04, Task 1).
//
// Proves the ROADMAP SC-4 retrieval guarantee: heading-chunked ephemeral
// per-tab MiniSearch index built lazily on first query(), memoized thereafter,
// evicted together with its extraction via the 06-03 cache hook, and NEVER
// persisted (D-87 / §26.5). The chunker follows the verbatim §26.5 rules:
// preamble → synthetic '(preamble)' chunk; no headings → paragraph-block
// chunks under the page title; sections > INDEX_CHUNK_MAX_TOKENS (500) split
// into paragraph sub-chunks inheriting the same headingPath. selectRelevant
// returns top-k chunks under the 2,000-token webpage budget (§22.2) and
// records compressionApplied: 'topk' (the Phase-5 CompressionType literal).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  chunkMarkdown,
  buildIndex,
  query,
  selectRelevant,
  evict,
  PREAMBLE_CHUNK,
  WEBPAGE_TOKEN_BUDGET,
  __test__ as indexTest,
  type PageChunk,
} from '@/core/extraction/PageIndexBuilder';
import { countTokensHeuristic } from '@/core/context/TokenBudget';
import { INDEX_CHUNK_MAX_TOKENS } from '@/core/extraction/strategies/IExtractionStrategy';
import { PageContentCache, __test__ as cacheTest } from '@/core/extraction/PageContentCache';

describe('PageIndexBuilder', () => {
  beforeEach(() => {
    // The 06-03 cache test seam clears the index-eviction hook set — re-wire
    // the builder's eviction-together registration (module-load wiring is
    // idempotent via __test__.reset()).
    cacheTest.reset();
    indexTest.reset();
  });

  it('(1) chunks markdown by heading with preamble + headingPath breadcrumbs', () => {
    const md = [
      'This is the intro paragraph before any heading.',
      'It should become the synthetic preamble chunk.',
      '',
      '# Incident Management',
      '',
      'Content under the first heading.',
      '',
      '## Triage',
      '',
      'Triage content.',
      '',
      '## Escalation',
      '',
      'Escalation content.',
    ].join('\n');

    const chunks = chunkMarkdown(md, 42, 'Title', 'https://example.com');

    // One chunk per heading (with content) + the preamble chunk.
    expect(chunks.map((c) => c.headingPath)).toEqual([
      PREAMBLE_CHUNK,
      'H1',
      'H1 > H2',
      'H1 > H2',
    ]);
    expect(chunks[0].sectionText).toContain('intro paragraph');
    expect(chunks[1].sectionText).toContain('Content under the first heading');
    expect(chunks[2].sectionText).toContain('Triage content.');
    expect(chunks[3].sectionText).toContain('Escalation content.');
    // Every chunk carries the index-wide tabId.
    expect(chunks.every((c) => c.tabId === 42)).toBe(true);
  });

  it('(2) no-heading pages fall back to paragraph-block chunks under the page title', () => {
    const md = [
      'First paragraph of the page.',
      '',
      'Second paragraph block with more detail.',
      '',
      'Third block.',
    ].join('\n');

    const chunks = chunkMarkdown(md, 7, 'No Headings Page', 'https://example.com/nh');

    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.headingPath === 'No Headings Page')).toBe(true);
    expect(chunks[0].sectionText).toBe('First paragraph of the page.');
    expect(chunks[1].sectionText).toBe('Second paragraph block with more detail.');
    expect(chunks[2].sectionText).toBe('Third block.');
  });

  it('(3) oversized sections (> INDEX_CHUNK_MAX_TOKENS) split into paragraph sub-chunks inheriting the headingPath', () => {
    const para = 'The incident management process begins when a user reports an issue and the ticket enters the queue for triage.';
    const sectionBody = Array.from({ length: 30 }, (_, i) => `${para} Paragraph ${i}.`).join('\n\n');
    // 30 paragraphs ≈ 30 × ~35 tokens ≈ 1050 tokens — far over the 500 ceiling.
    const md = `# Oversized\n\n${sectionBody}`;

    const chunks = chunkMarkdown(md, 1, 't', 'u');
    const overs = chunks.filter((c) => c.headingPath === 'H1');

    expect(overs.length).toBeGreaterThan(1);
    expect(overs.every((c) => c.headingPath === 'H1')).toBe(true);
    // Each sub-chunk is a paragraph block within the token ceiling.
    expect(overs.every((c) => countTokensHeuristic(c.sectionText) <= INDEX_CHUNK_MAX_TOKENS)).toBe(true);
    // The document content is preserved across the sub-chunks.
    const joined = overs.map((c) => c.sectionText).join(' ');
    expect(joined).toContain('Paragraph 0.');
    expect(joined).toContain('Paragraph 29.');
  });

  it('(4) synthesizes ids (`${headingPath}:${index}`) + index-wide tabId; MiniSearch addAll does not throw (Pitfall 5)', () => {
    const md = [
      'Intro.',
      '',
      '# A',
      '',
      'Alpha content.',
      '',
      '## B',
      '',
      'Beta content.',
    ].join('\n');

    const chunks = chunkMarkdown(md, 99, 'T', 'U');

    expect(chunks.map((c) => c.id)).toEqual(['(preamble):0', 'H1:1', 'H1 > H2:2']);
    expect(chunks.every((c) => c.tabId === 99)).toBe(true);
    // MiniSearch's default idField is 'id' — the synthesized ids must make
    // addAll succeed (Pitfall 5).
    expect(() => buildIndex(chunks)).not.toThrow();
  });

  it('(5) query returns hits with stored fields; title matches outrank sectionText matches (boost)', () => {
    const chunks: PageChunk[] = [
      { id: 'docA:0', tabId: 1, title: 'ServiceNow Incident Handling', url: 'u1', headingPath: 'H1', sectionText: 'Steps to triage an incident.' },
      { id: 'docB:0', tabId: 2, title: 'KB Article', url: 'u2', headingPath: 'H1', sectionText: 'ServiceNow incident escalation and SLAs.' },
    ];

    const index = buildIndex(chunks);
    const hits = index.search('ServiceNow');

    expect(hits.length).toBeGreaterThan(0);
    // boost { title: 3 } — the title match ranks first.
    expect(hits[0].id).toBe('docA:0');
    // Stored fields ride along with the results.
    expect(hits[0]).toMatchObject({
      title: 'ServiceNow Incident Handling',
      headingPath: 'H1',
      sectionText: 'Steps to triage an incident.',
    });
  });

  it('(6) selectRelevant returns top-k chunks + compressionApplied "topk" over the 2,000-token budget', () => {
    const para = 'The ServiceNow platform provides incident management, problem management, and change management capabilities for enterprise IT operations teams.';
    const md = Array.from({ length: 60 }, (_, i) => `# Section ${i}\n\n${para} Number ${i}.`).join('\n\n');
    // 60 sections × ~45 tokens ≈ 2700 — over the WEBPAGE_TOKEN_BUDGET.
    expect(countTokensHeuristic(md)).toBeGreaterThan(WEBPAGE_TOKEN_BUDGET);

    const sel = selectRelevant(3, 'ServiceNow', { markdown: md, title: 'Long Page', url: 'https://example.com/long' });

    expect(sel.compressionApplied).toBe('topk');
    expect(sel.chunks.length).toBeGreaterThan(0);
    const totalTokens = sel.chunks.reduce((sum, c) => sum + countTokensHeuristic(c.sectionText), 0);
    expect(totalTokens).toBeLessThanOrEqual(WEBPAGE_TOKEN_BUDGET);
    // The returned chunks are full PageChunks (searchable sectionText).
    expect(sel.chunks[0].headingPath).toBeDefined();
    expect(sel.chunks[0].sectionText).toContain('Number');
  });

  it('(7) builds lazily on first query() and reuses the memoized index on the second (never persisted)', () => {
    expect(indexTest.indexCount).toBe(0); // lazy — nothing built before any query

    const sourceA = { markdown: '# Alpha\n\nAlpha content here.', title: 'A', url: 'u-a' };
    const first = query(5, 'alpha', sourceA);
    expect(first.length).toBeGreaterThan(0);
    expect(indexTest.indexCount).toBe(1);

    // Memoized: a second query with a DIFFERENT source reuses the index built
    // from sourceA — 'beta' is not in it.
    const sourceB = { markdown: '# Beta\n\nBeta content only.', title: 'B', url: 'u-b' };
    const second = query(5, 'beta', sourceB);
    expect(second.length).toBe(0);
    expect(indexTest.indexCount).toBe(1);
  });

  it('(7b) the chunker runs exactly once per tab — the index is built lazily and reused (memoized)', () => {
    const source = { markdown: '# Gamma\n\nGamma content.', title: 'G', url: 'u-g' };
    query(6, 'gamma', source);
    query(6, 'gamma', source);
    expect(indexTest.buildCount).toBe(1); // built once, reused on the second call
  });

  it('(8) evict(tabId) drops the memoized index; the builder evict is wired into the cache eviction hook (eviction-together)', () => {
    query(7, 'alpha', { markdown: '# Alpha\n\nAlpha content.', title: 'A', url: 'u' });
    expect(indexTest.indexCount).toBe(1);

    evict(7);
    expect(indexTest.hasIndex(7)).toBe(false);
    expect(indexTest.indexCount).toBe(0);

    // Eviction-together (§26.4a): a cache eviction must drop the index too.
    query(8, 'gamma', { markdown: '# Gamma\n\nGamma content.', title: 'G', url: 'u-g' });
    expect(indexTest.hasIndex(8)).toBe(true);
    PageContentCache.evict(8);
    expect(indexTest.hasIndex(8)).toBe(false);
  });

  it('never persists the index — zero storage imports (D-87 / §26.5 ephemeral)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/core/extraction/PageIndexBuilder.ts'), 'utf8');
    expect(source).not.toMatch(/chrome\.storage|indexedDB|['"]idb['"]/);
  });
});