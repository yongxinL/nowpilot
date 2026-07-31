// @vitest-environment happy-dom
//
// happy-dom (not jsdom) for this file: defuddle's internal cleaning pipeline
// uses `:has()` selectors (e.g. `video:not(:has(source))`) which jsdom's
// nwsapi cannot compile — in jsdom the parse degrades to unstripped HTML and
// the markdown conversion fails. happy-dom's CSS engine supports `:has()`,
// so this file exercises the exact production pipeline (including markdown
// output and metadata extraction) end-to-end. The real target environment is
// a Chrome extension page, where `:has()` is fully supported.
import { describe, expect, it } from 'vitest';
import { DefuddleStrategy } from '../../../src/core/extraction/strategies/DefuddleStrategy';

const FIXTURE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Defuddle Fixture Article</title>
  <meta name="author" content="Jane Doe">
  <meta name="description" content="A fixture article for defuddle markdown extraction testing.">
  <meta property="og:site_name" content="Example News">
</head>
<body>
  <article>
    <h1>Defuddle Fixture Article</h1>
    <p>
      Defuddle is an article extraction engine. This fixture provides a
      substantial amount of readable body copy so the strategy has real
      content to convert into markdown. The quick brown fox jumps over the
      lazy dog while the article pipeline measures tokens and confidence.
    </p>
    <p>
      A second paragraph adds more depth: extraction quality depends on
      semantic HTML structure, meaningful headings, and paragraph text that
      survives the cleaning pass. Lists and emphasis are also expected to
      round-trip through the markdown converter faithfully.
    </p>
    <ul>
      <li>First list item describing extraction inputs</li>
      <li>Second list item describing markdown output</li>
      <li>Third list item describing metadata provenance</li>
    </ul>
  </article>
</body>
</html>`;

const strategy = new DefuddleStrategy();

describe('DefuddleStrategy', () => {
  it('canHandle returns true only for default mode', () => {
    expect(strategy.canHandle({ url: 'https://example.com/article', mode: 'default' })).toBe(true);
    expect(strategy.canHandle({ url: 'https://example.com/article', mode: 'actionable' })).toBe(
      false,
    );
  });

  it('extracts markdown and metadata from a fixture HTML document', async () => {
    const result = await strategy.run({
      url: 'https://example.com/article',
      title: 'Defuddle Fixture Article',
      mode: 'default',
      html: FIXTURE_HTML,
    });

    expect(result.source).toBe('defuddle');
    expect(result.markdown).toBeDefined();
    const markdown = result.markdown ?? '';
    expect(markdown.length).toBeGreaterThan(0);
    // Note: defuddle removes the <h1> that duplicates the document title
    // (duplicate-title cleaning), so assert on body copy that survives.
    expect(markdown).toContain('Defuddle is an article extraction engine');
    expect(markdown).not.toContain('<article>');
    expect(markdown).not.toContain('<h1>');

    expect(result.meta?.author).toBe('Jane Doe');
    expect(result.meta?.language).toBe('en');
    expect(result.meta?.siteName).toBe('Example News');
    expect(result.meta?.description).toBe(
      'A fixture article for defuddle markdown extraction testing.',
    );

    expect(result.approxTokens).toBeGreaterThan(0);
    expect(result.truncated).toBe(false);
  });

  it('throws when no HTML is provided', async () => {
    await expect(
      strategy.run({ url: 'https://example.com/article', title: 't', mode: 'default' }),
    ).rejects.toThrow(/no HTML/i);
  });
});
