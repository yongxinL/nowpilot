import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { serializePage, type SerializedPage } from '../../../src/core/content/DomSerializer';
import { PageContentService } from '../../../src/core/extraction/PageContentService';
import type { IExtractionStrategy } from '../../../src/core/extraction/strategies/IExtractionStrategy';

/**
 * Tracer-level PageContentService tests: mocked chrome.tabs.sendMessage
 * stands in for the content-script EXTRACT_PAGE_CONTENT round-trip.
 */

const FIXTURE_BODY = `
<article>
  <h1>Extraction Tracer Fixture</h1>
  <p>${'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore. '.repeat(10)}</p>
  <p>${'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua, ut enim ad minim veniam quis nostrud. '.repeat(8)}</p>
  <ul>
    <li>First item in the fixture list</li>
    <li>Second item in the fixture list</li>
    <li>Third item in the fixture list</li>
  </ul>
</article>`;

function buildFixtureDocument(): Document {
  const dom = new JSDOM(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Extraction Tracer Fixture</title>
  <meta name="author" content="Jane Doe">
  <meta name="description" content="A comprehensive fixture article for extraction testing.">
</head>
<body>${FIXTURE_BODY}</body>
</html>`,
    { url: 'https://example.com/article' },
  );
  return dom.window.document;
}

function makeSerializedPage(): SerializedPage {
  return serializePage(buildFixtureDocument());
}

let sendMessageMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sendMessageMock = vi.fn();
  (globalThis as any).chrome.tabs = {
    sendMessage: sendMessageMock,
    onUpdated: { addListener: vi.fn() },
  };
});

describe('PageContentService (tracer)', () => {
  it('returns a typed PageContext with mode=default from a mocked content script response', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const service = new PageContentService();

    const result = await service.extract(1, 'default', 'https://example.com/article');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.pageContext.mode).toBe('default');
    if (result.pageContext.mode !== 'default') throw new Error('expected default mode');
    expect(result.pageContext.markdown.length).toBeGreaterThan(500);
    expect(result.pageContext.url).toBe('https://example.com/article');
    expect(result.pageContext.title).toBe('Extraction Tracer Fixture');
    expect(result.pageContext.source).toBe('defuddle');
    expect(result.pageContext.capturedAt).toBeGreaterThan(0);
    expect(result.pageContext.size).toBeGreaterThan(0);
    expect(result.pageContext.truncated).toBe(false);
    expect(result.pageContext.extractionLevel).toBe('full');

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    const sentEnvelope = sendMessageMock.mock.calls[0][1] as Record<string, unknown>;
    expect(sentEnvelope.type).toBe('EXTRACT_PAGE_CONTENT');
    expect(sentEnvelope.source).toBe('sidepanel');
  });

  it('returns the cached result on a second extract for the same tab+url (no re-extraction)', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const service = new PageContentService();

    const first = await service.extract(1, 'default', 'https://example.com/article');
    const second = await service.extract(1, 'default', 'https://example.com/article');

    expect(first).toBe(second);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });

  it('reExtract(tabId) invalidates the cache; the next extract triggers fresh extraction', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const service = new PageContentService();

    await service.extract(1, 'default', 'https://example.com/article');
    service.reExtract(1);
    await service.extract(1, 'default', 'https://example.com/article');

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
  });

  it('coalesces two concurrent extract calls into a single extraction', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const service = new PageContentService();
    const doExtractSpy = vi.spyOn(service as unknown as { doExtract: () => unknown }, 'doExtract');

    const [a, b] = await Promise.all([
      service.extract(1, 'default', 'https://example.com/article'),
      service.extract(1, 'default', 'https://example.com/article'),
    ]);

    expect(doExtractSpy).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });

  it('enforces the 5s global timeout budget with strategiesAttempted populated', async () => {
    vi.useFakeTimers();
    try {
      sendMessageMock.mockResolvedValue(makeSerializedPage());
      const hangingStrategy: IExtractionStrategy = {
        id: 'defuddle',
        canHandle: () => true,
        run: () => new Promise(() => {}), // never settles
      };
      const service = new PageContentService([hangingStrategy]);

      const pending = service.extract(1, 'default', 'https://example.com/article');
      await vi.advanceTimersByTimeAsync(5000);
      const result = await pending;

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected failure result');
      expect(result.error.code).toBe('TIMEOUT');
      expect(result.error.strategiesAttempted).toEqual(['defuddle']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('redacts secrets from extracted markdown before PageContext construction', async () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><head><title>Secrets</title></head><body>
<article>
  <h1>Secrets Fixture</h1>
  <p>${'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure. '.repeat(6)}</p>
  <p>Inline key: sk-abc123xyz</p>
  <p>Token: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U</p>
</article>
</body></html>`,
      { url: 'https://example.com/secrets' },
    );
    sendMessageMock.mockResolvedValue(serializePage(dom.window.document));
    const service = new PageContentService();

    const result = await service.extract(1, 'default', 'https://example.com/secrets');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    if (result.pageContext.mode !== 'default') throw new Error('expected default mode');
    expect(result.pageContext.markdown).not.toContain('sk-abc123xyz');
    expect(result.pageContext.markdown).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(result.pageContext.markdown).toContain('***REDACTED***');
  });

  it('runs the full tracer pipeline (DomSerializer → DefuddleStrategy → PageContext) with ContextOptimizer-compatible shape', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const service = new PageContentService();

    const result = await service.extract(1, 'default', 'https://example.com/article');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');

    // buildPageContextSection (ContextOptimizer) stringifies the pageContext
    // into a PromptSection with sourceId 'context.page.current' — the shape
    // contract is a JSON-serializable object carrying these fields.
    const json = JSON.parse(JSON.stringify(result.pageContext)) as Record<string, unknown>;
    expect(json.url).toBe('https://example.com/article');
    expect(typeof json.title).toBe('string');
    expect(typeof json.capturedAt).toBe('number');
    expect(typeof json.size).toBe('number');
    expect(json.source).toBe('defuddle');
    expect(json.mode).toBe('default');
    expect(typeof json.markdown).toBe('string');
    expect((json.markdown as string).length).toBeGreaterThan(0);
  });
});
