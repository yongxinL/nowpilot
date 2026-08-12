// tests/core/extraction/DefuddleStrategy.test.ts — 04a-04 Task 1 behavior pin
// (D-4a-14/18/08), driven by the SHARED golden fixtures (D-4a-24 — import from
// the fixtures module, NEVER re-declare HTML):
//   1. buildArticleFixture → source 'defuddle' + markdown carries the article
//      body (heading structure survives — the D-4a-16 chunker depends on it) +
//      meta.title is the fixture title (D-4a-21 provenance) + approxTokens > 0
//      + truncated === false.
//      NOTE (0.19.2 behavior delta): defuddle's standardize step dedups an h1
//      whose text equals the <title> into result.title, so the literal title
//      text lives in meta.title, NOT the markdown — asserted via meta (the
//      plan's "markdown contains the article title" intent is proven by heading
//      + body text + meta.title).
//   2. buildBoilerplateFixture → source 'readability' (the D-4a-18 threshold
//      fires: extracted-text char floor AND density ratio — never a bare-length
//      heuristic; the fallback ran on a FRESH CLONE, Pitfall 2).
//   3. relative links resolve to absolute against the stamped base URL (A2 gate,
//      D-4a-08) — asserted in meta.defuddleHtml.
//   4. canHandle({mode:'actionable'}) → false (D-4a-14 mode gating).
import { describe, expect, it } from 'vitest';

import {
  DefuddleStrategy,
  MIN_CONTENT_DENSITY,
  MIN_EXTRACTED_CHARS,
} from '@/core/extraction/strategies/DefuddleStrategy';
import {
  FIXED_TITLE,
  buildArticleFixture,
  buildBoilerplateFixture,
} from '../../fixtures/pageContent';

describe('DefuddleStrategy (04a-04 — primary + Readability fallback)', () => {
  it('extracts the article via defuddle with heading structure + provenance meta (Test 1)', async () => {
    const fixture = buildArticleFixture();
    const strategy = new DefuddleStrategy();
    const result = await strategy.run({
      url: fixture.url,
      title: fixture.title,
      mode: 'default',
      html: fixture.html,
    });

    expect(result.source).toBe('defuddle');
    // The article body survives: atx heading + body prose (D-4a-16 chunker input).
    expect(result.markdown).toContain('## Architecture');
    expect(result.markdown).toContain('NowPilot extracts pages with a layered strategy');
    // Title is extracted (D-4a-21) — 0.19.2 dedups the h1 into meta.title.
    expect(result.meta?.title).toBe(FIXED_TITLE);
    expect(result.approxTokens).toBeGreaterThan(0);
    expect(result.truncated).toBe(false);
  });

  it('falls back to Readability on a clone when the D-4a-18 threshold fires (Test 2)', async () => {
    const fixture = buildBoilerplateFixture();
    const strategy = new DefuddleStrategy();
    const result = await strategy.run({
      url: fixture.url,
      title: fixture.title,
      mode: 'default',
      html: fixture.html,
    });

    expect(result.source).toBe('readability');
    expect(result.markdown && result.markdown.length).toBeGreaterThan(0);
  });

  it('resolves relative links against the stamped base URL (A2 gate, D-4a-08) (Test 3)', async () => {
    const fixture = buildArticleFixture();
    const strategy = new DefuddleStrategy();
    const result = await strategy.run({
      url: fixture.url,
      title: fixture.title,
      mode: 'default',
      html: fixture.html,
    });

    // meta.defuddleHtml is the defuddle clean HTML — the relative hrefs from the
    // fixture (/guide/quickstart, /assets/pipeline.png) must be absolute here.
    expect(result.meta?.defuddleHtml).toContain('https://docs.example.com/guide/quickstart');
    expect(result.meta?.defuddleHtml).toContain('https://docs.example.com/assets/pipeline.png');
    expect(result.meta?.defuddleHtml).not.toContain('href="/guide/quickstart"');
  });

  it('gates the mode: canHandle is true only for default (D-4a-14) (Test 4)', () => {
    const strategy = new DefuddleStrategy();
    expect(strategy.canHandle({ url: 'https://example.com/', mode: 'default' })).toBe(true);
    expect(strategy.canHandle({ url: 'https://example.com/', mode: 'actionable' })).toBe(false);
  });

  it('exports the D-4a-18 pinned threshold constants (vitest-pinned, Phase-4 precedent)', () => {
    expect(MIN_EXTRACTED_CHARS).toBe(500); // Readability charThreshold parity
    expect(MIN_CONTENT_DENSITY).toBe(0.2); // textLength/htmlLength ratio
  });
});
