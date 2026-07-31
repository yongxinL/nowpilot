import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ReadabilityFallback } from '../../../../src/core/extraction/strategies/ReadabilityFallback';

/**
 * ReadabilityFallback tests: @mozilla/readability is stubbed (vi.mock) so the
 * strategy's contract — DOM-clone guard, confidence threshold, metadata
 * mapping — is exercised deterministically. jsdom provides the DOMParser the
 * strategy uses to construct the parsed document.
 */

const { ReadabilityMock } = vi.hoisted(() => ({ ReadabilityMock: vi.fn() }));

vi.mock('@mozilla/readability', () => ({ Readability: ReadabilityMock }));

const FIXTURE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Readability Fixture Article</title>
  <meta name="author" content="Jane Doe">
</head>
<body>
  <article>
    <h1>Readability Fixture Article</h1>
    <p>${'Readability extracted body copy. '.repeat(40)}</p>
    <p>A second paragraph keeps the article substantial for the parser.</p>
  </article>
</body>
</html>`;

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Readability Fixture Article',
    byline: 'Jane Doe',
    lang: 'en',
    content: '<p>processed html</p>',
    textContent: 'Readability extracted body copy. '.repeat(40), // 1320 chars ≥ 500
    length: 1320,
    excerpt: 'A short excerpt of the fixture article.',
    siteName: 'Example News',
    publishedTime: '2026-07-31T00:00:00Z',
    ...overrides,
  };
}

let articleToReturn: unknown;

beforeEach(() => {
  articleToReturn = makeArticle();
  ReadabilityMock.mockReset();
  ReadabilityMock.mockImplementation(function (
    this: any,
    doc: Document,
    options?: { charThreshold?: number },
  ) {
    this.doc = doc;
    this.options = options;
    this.parse = () => articleToReturn;
  });
});

const strategy = new ReadabilityFallback();

describe('ReadabilityFallback', () => {
  it('canHandle returns true only for default mode', () => {
    expect(strategy.canHandle({ url: 'https://example.com/article', mode: 'default' })).toBe(true);
    expect(strategy.canHandle({ url: 'https://example.com/article', mode: 'actionable' })).toBe(
      false,
    );
  });

  it('returns a StrategyResult with markdown + metadata for substantial article content', async () => {
    const result = await strategy.run({
      url: 'https://example.com/article',
      title: 'Readability Fixture Article',
      mode: 'default',
      html: FIXTURE_HTML,
    });

    expect(result.source).toBe('readability');
    expect(result.markdown).toBe('Readability extracted body copy. '.repeat(40));
    expect(result.markdown!.length).toBeGreaterThanOrEqual(
      ReadabilityFallback.LOW_CONFIDENCE_CHAR_THRESHOLD,
    );
    expect(result.meta?.title).toBe('Readability Fixture Article');
    expect(result.approxTokens).toBe(Math.ceil(1320 / 4));
    expect(result.truncated).toBe(false);

    // The constructor must receive the confidence threshold so Readability
    // bails early on low-content pages.
    expect(ReadabilityMock.mock.calls[0][1]).toEqual({
      charThreshold: ReadabilityFallback.LOW_CONFIDENCE_CHAR_THRESHOLD,
    });
  });

  it('throws "Readability low confidence" when textContent is below the 500-char threshold', async () => {
    articleToReturn = makeArticle({ textContent: 'tiny snippet', length: 13 });

    await expect(
      strategy.run({
        url: 'https://example.com/article',
        title: 't',
        mode: 'default',
        html: FIXTURE_HTML,
      }),
    ).rejects.toThrow('Readability low confidence');
  });

  it('throws when Readability returns null (no article content)', async () => {
    articleToReturn = null;

    await expect(
      strategy.run({
        url: 'https://example.com/article',
        title: 't',
        mode: 'default',
        html: FIXTURE_HTML,
      }),
    ).rejects.toThrow('Readability low confidence');
  });

  it('clones the document before parsing — the original DOM is never mutated (Pitfall 3)', async () => {
    ReadabilityMock.mockImplementation(function (this: any, doc: Document) {
      this.parse = () => {
        // Simulate Readability's destructive in-place scoring: strip the body.
        while (doc.body && doc.body.firstChild) {
          doc.body.removeChild(doc.body.firstChild);
        }
        return makeArticle();
      };
    });

    const original = new JSDOM(FIXTURE_HTML, { url: 'https://example.com/article' }).window
      .document;
    const bodyChildrenBefore = original.body.children.length;
    expect(bodyChildrenBefore).toBeGreaterThan(0);

    const result = await strategy.run({
      url: 'https://example.com/article',
      title: 'Readability Fixture Article',
      mode: 'default',
      html: original.documentElement.outerHTML,
    });

    expect(result.source).toBe('readability');
    expect(original.body.children.length).toBe(bodyChildrenBefore); // original untouched

    const parsedDoc = ReadabilityMock.mock.calls[0][0] as Document;
    expect(parsedDoc).not.toBe(original); // strategy passed a clone, not the original
    expect(parsedDoc.body.children.length).toBe(0); // mock's mutation hit the clone only
  });

  it('maps Readability article fields into result metadata (byline→author, excerpt→description, lang→language, publishedTime→publishDate, siteName)', async () => {
    const result = await strategy.run({
      url: 'https://example.com/article',
      title: 'Readability Fixture Article',
      mode: 'default',
      html: FIXTURE_HTML,
    });

    expect(result.meta?.author).toBe('Jane Doe'); // byline
    expect(result.meta?.description).toBe('A short excerpt of the fixture article.'); // excerpt
    expect(result.meta?.language).toBe('en'); // lang
    expect(result.meta?.siteName).toBe('Example News');
    expect(result.meta?.publishDate).toBe('2026-07-31T00:00:00Z'); // publishedTime
  });

  it('throws when no HTML is provided', async () => {
    await expect(
      strategy.run({ url: 'https://example.com/article', title: 't', mode: 'default' }),
    ).rejects.toThrow(/no HTML/i);
  });
});
