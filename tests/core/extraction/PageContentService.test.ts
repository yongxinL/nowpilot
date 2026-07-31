import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createEnvelope } from '../../../src/core/runtime/RuntimeEnvelope';
import { dispatch } from '../../../src/core/messaging/MessageBus';
import { serializePage, type SerializedPage } from '../../../src/core/content/DomSerializer';
import { PageContentService } from '../../../src/core/extraction/PageContentService';
import type { IExtractionStrategy } from '../../../src/core/extraction/strategies/IExtractionStrategy';

/**
 * PageContentService tests: mocked chrome.tabs.sendMessage stands in for the
 * content-script EXTRACT_PAGE_CONTENT round-trip.
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
    onRemoved: { addListener: vi.fn() },
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

describe('PageContentService (hardening)', () => {
  const LONG_MARKDOWN = 'x'.repeat(600);

  it('returns CAPTURE_FAILED when the content script request rejects', async () => {
    sendMessageMock.mockRejectedValue(new Error('Receiving end does not exist'));
    const service = new PageContentService();

    const result = await service.extract(1, 'default', 'https://example.com/article');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure result');
    expect(result.error.code).toBe('CAPTURE_FAILED');
    expect(result.error.strategiesAttempted).toEqual([]);
  });

  it('returns CAPTURE_FAILED when the content script response is malformed', async () => {
    sendMessageMock.mockResolvedValue({ not: 'a SerializedPage' });
    const service = new PageContentService();

    const result = await service.extract(1, 'default', 'https://example.com/article');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure result');
    expect(result.error.code).toBe('CAPTURE_FAILED');
    expect(result.error.message).toContain('invalid response');
  });

  it('returns NO_CONTENT when all strategies produce low-confidence content', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const lowConfidenceStrategy: IExtractionStrategy = {
      id: 'defuddle',
      canHandle: () => true,
      run: async () => ({
        source: 'defuddle',
        markdown: 'short snippet under the confidence threshold',
        approxTokens: 10,
        truncated: false,
      }),
    };
    const service = new PageContentService([lowConfidenceStrategy]);

    const result = await service.extract(1, 'default', 'https://example.com/article');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure result');
    expect(result.error.code).toBe('NO_CONTENT');
    expect(result.error.strategiesAttempted).toEqual(['defuddle']);
  });

  it('returns PARSE_ERROR when a strategy throws', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const throwingStrategy: IExtractionStrategy = {
      id: 'defuddle',
      canHandle: () => true,
      run: async () => {
        throw new Error('strategy crashed');
      },
    };
    const service = new PageContentService([throwingStrategy]);

    const result = await service.extract(1, 'default', 'https://example.com/article');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure result');
    expect(result.error.code).toBe('PARSE_ERROR');
    expect(result.error.strategiesAttempted).toEqual(['defuddle']);
  });

  it('continues the fallback chain to the next strategy when the first throws', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const throwingStrategy: IExtractionStrategy = {
      id: 'defuddle',
      canHandle: () => true,
      run: async () => {
        throw new Error('strategy crashed');
      },
    };
    const succeedingStrategy: IExtractionStrategy = {
      id: 'readability',
      canHandle: () => true,
      run: async () => ({
        source: 'readability',
        markdown: LONG_MARKDOWN,
        approxTokens: 150,
        truncated: false,
      }),
    };
    const service = new PageContentService([throwingStrategy, succeedingStrategy]);

    const result = await service.extract(1, 'default', 'https://example.com/article');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.pageContext.source).toBe('readability');
    expect(result.pageContext.mode).toBe('default');
  });

  it('falls back from a low-confidence defuddle result to the readability strategy (D-07)', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const lowConfidenceStrategy: IExtractionStrategy = {
      id: 'defuddle',
      canHandle: () => true,
      run: async () => ({
        source: 'defuddle',
        markdown: 'short snippet under the confidence threshold',
        approxTokens: 10,
        truncated: false,
      }),
    };
    const fallbackStrategy: IExtractionStrategy = {
      id: 'readability',
      canHandle: () => true,
      run: async () => ({
        source: 'readability',
        markdown: 'x'.repeat(600),
        approxTokens: 150,
        truncated: false,
      }),
    };
    const service = new PageContentService([lowConfidenceStrategy, fallbackStrategy]);

    const result = await service.extract(1, 'default', 'https://example.com/article');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.pageContext.source).toBe('readability');
    if (result.pageContext.mode !== 'default') throw new Error('expected default mode');
    expect(result.pageContext.markdown.length).toBeGreaterThanOrEqual(500);
  });

  it('selects only ApcLiteStrategy for mode=actionable and records single attempt', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const defuddleRan = vi.fn();
    const actionableRan = vi.fn();
    const defuddleStrategy: IExtractionStrategy = {
      id: 'defuddle',
      canHandle: (input) => input.mode === 'default',
      run: async () => {
        defuddleRan();
        return { source: 'defuddle', markdown: LONG_MARKDOWN, approxTokens: 150, truncated: false };
      },
    };
    const apcLiteStrategy: IExtractionStrategy = {
      id: 'apc-lite',
      canHandle: (input) => input.mode === 'actionable',
      run: async () => {
        actionableRan();
        return {
          source: 'apc-lite',
          root: { role: 'document', id: 'document-root' },
          meta: { title: 't' },
          approxTokens: 8,
          truncated: false,
        };
      },
    };
    const service = new PageContentService([defuddleStrategy, apcLiteStrategy]);

    const result = await service.extract(1, 'actionable', 'https://example.com/article');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.pageContext.mode).toBe('actionable');
    if (result.pageContext.mode !== 'actionable') throw new Error('expected actionable mode');
    expect(result.pageContext.source).toBe('apc-lite');
    expect(result.pageContext.apcLiteTree.id).toBe('document-root');
    expect(defuddleRan).not.toHaveBeenCalled(); // mode filter excludes default-only strategies
    expect(actionableRan).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cache when SPA_NAVIGATION announces a different URL', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const service = new PageContentService();
    service.init();

    await service.extract(1, 'default', 'https://example.com/article');
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    await dispatch(
      createEnvelope(
        'SPA_NAVIGATION',
        { url: 'https://example.com/other-page', timestamp: Date.now() },
        'content',
      ),
      { tab: { id: 1 } } as chrome.runtime.MessageSender,
    );

    await service.extract(1, 'default', 'https://example.com/article');
    expect(sendMessageMock).toHaveBeenCalledTimes(2); // cache miss → fresh extraction
  });

  it('keeps the cache hot when SPA_NAVIGATION announces the same URL', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const service = new PageContentService();
    service.init();

    await service.extract(1, 'default', 'https://example.com/article');
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    await dispatch(
      createEnvelope(
        'SPA_NAVIGATION',
        { url: 'https://example.com/article', timestamp: Date.now() },
        'content',
      ),
      { tab: { id: 1 } } as chrome.runtime.MessageSender,
    );

    const result = await service.extract(1, 'default', 'https://example.com/article');
    expect(result.ok).toBe(true);
    expect(sendMessageMock).toHaveBeenCalledTimes(1); // cache hit — no re-extraction
  });

  it('invalidates the cache when tabs.onUpdated fires with a complete navigation', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const addListenerMock = (globalThis as any).chrome.tabs.onUpdated
      .addListener as ReturnType<typeof vi.fn>;
    // Capture the listener registered by THIS init() call — earlier tests
    // (SPA_NAVIGATION) already registered listeners on their own instances.
    const listenerIndex = addListenerMock.mock.calls.length;
    const service = new PageContentService();
    service.init();

    await service.extract(1, 'default', 'https://example.com/article');
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    const listener = addListenerMock.mock.calls[listenerIndex][0];
    listener(1, { status: 'complete', url: 'https://example.com/next' });

    await service.extract(1, 'default', 'https://example.com/article');
    expect(sendMessageMock).toHaveBeenCalledTimes(2); // invalidated → fresh extraction
  });

  it('does not invalidate the cache on non-complete or URL-less tabs.onUpdated events', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const addListenerMock = (globalThis as any).chrome.tabs.onUpdated
      .addListener as ReturnType<typeof vi.fn>;
    const listenerIndex = addListenerMock.mock.calls.length;
    const service = new PageContentService();
    service.init();

    await service.extract(1, 'default', 'https://example.com/article');
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    const listener = addListenerMock.mock.calls[listenerIndex][0];
    listener(1, { status: 'loading', url: 'https://example.com/next' }); // not complete
    listener(1, { status: 'complete' }); // no URL in changeInfo

    const result = await service.extract(1, 'default', 'https://example.com/article');
    expect(result.ok).toBe(true);
    expect(sendMessageMock).toHaveBeenCalledTimes(1); // still cached
  });

  it('removes tab index and invalidates cache when tabs.onRemoved fires', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const addListenerMock = (globalThis as any).chrome.tabs.onRemoved
      .addListener as ReturnType<typeof vi.fn>;
    // Capture the listener registered by THIS init() call — earlier tests
    // (SPA_NAVIGATION + tabs.onUpdated) already registered their own.
    const listenerIndex = addListenerMock.mock.calls.length;
    const service = new PageContentService();
    service.init();

    await service.extract(1, 'default', 'https://example.com/article');
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    const listener = addListenerMock.mock.calls[listenerIndex][0];
    listener(1);

    await service.extract(1, 'default', 'https://example.com/article');
    expect(sendMessageMock).toHaveBeenCalledTimes(2); // invalidated → fresh extraction
  });

  it('reExtract(tabId) invalidates; the next extract performs a fresh capture', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const service = new PageContentService();

    await service.extract(1, 'default', 'https://example.com/article');
    service.reExtract(1);
    await service.extract(1, 'default', 'https://example.com/article');

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
  });

  it('redacts secrets from extracted markdown (script + visible text) leaving placeholders', async () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><head><title>Secrets</title></head><body>
<article>
  <h1>Secrets Integration</h1>
  <p>${'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. '.repeat(6)}</p>
  <p>Dashboard key: sk-abc123xyz789</p>
  <p>Auth header: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U</p>
  <p>Session: JSESSIONID=abc123def456</p>
  <script>
    window.__config = {
      api_key: 'sk-abc123xyz789',
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    };
  </script>
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
    const markdown = result.pageContext.markdown;
    expect(markdown).not.toContain('sk-abc123xyz789');
    expect(markdown).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(markdown).not.toContain('abc123def456');
    expect(markdown).toContain('***REDACTED***');
  });

  it('produces the data shape consumed by ContextOptimizer.buildPageContextSection', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const service = new PageContentService();

    const result = await service.extract(1, 'default', 'https://example.com/article');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');

    // buildPageContextSection does JSON.stringify(pageContext) into a
    // PromptSection { kind: 'context', sourceId: 'context.page.current' }.
    // The serialized form must carry the fields the section relies on.
    const section = JSON.stringify(result.pageContext);
    const parsed = JSON.parse(section) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      mode: 'default',
      url: 'https://example.com/article',
      title: 'Extraction Tracer Fixture',
      source: 'defuddle',
    });
    for (const key of ['capturedAt', 'size', 'markdown']) {
      expect(parsed[key]).toBeDefined();
    }
    expect(section.length).toBeGreaterThan(0);
  });

  // ── Plan 04a-04 additional coverage ─────────────────────────────────

  it('returns full pipeline result with all BaseMetadata fields populated (default mode)', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const service = new PageContentService();

    const result = await service.extract(1, 'default', 'https://example.com/article');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    if (result.pageContext.mode !== 'default') throw new Error('expected default mode');

    // All BaseMetadata fields must be present and well-typed
    expect(typeof result.pageContext.mode).toBe('string');
    expect(typeof result.pageContext.markdown).toBe('string');
    expect(result.pageContext.markdown.length).toBeGreaterThan(0);
    expect(typeof result.pageContext.url).toBe('string');
    expect(typeof result.pageContext.title).toBe('string');
    expect(typeof result.pageContext.capturedAt).toBe('number');
    expect(result.pageContext.capturedAt).toBeGreaterThan(0);
    expect(typeof result.pageContext.size).toBe('number');
    expect(typeof result.pageContext.source).toBe('string');
    expect(typeof result.pageContext.extractionLevel).toBe('string');
    expect(typeof result.pageContext.truncated).toBe('boolean');
  });

  it('returns actionable mode PageContext with apcLiteTree (not embedded in markdown)', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    // Use a strategy that produces apcLiteTree for actionable mode
    const apcLiteStrategy: IExtractionStrategy = {
      id: 'apc-lite',
      canHandle: (input) => input.mode === 'actionable',
      run: async () => ({
        source: 'apc-lite' as const,
        root: { role: 'document', id: 'root-id', children: [] },
        meta: { title: 'Actionable Page' },
        approxTokens: 5,
        truncated: false,
      }),
    };
    const service = new PageContentService([apcLiteStrategy]);

    const result = await service.extract(1, 'actionable', 'https://example.com/actionable');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.pageContext.mode).toBe('actionable');
    if (result.pageContext.mode !== 'actionable') throw new Error('expected actionable mode');
    // apcLiteTree must be present and shaped like an APCLiteNode
    expect(result.pageContext.apcLiteTree).toBeDefined();
    expect(result.pageContext.apcLiteTree.role).toBe('document');
    expect(result.pageContext.apcLiteTree.id).toBe('root-id');
    // metadata from the SerializedPage is preserved (title from captured doc, not strategy meta)
    expect(result.pageContext.title).toBe('Extraction Tracer Fixture');
    expect(result.pageContext.source).toBe('apc-lite');
    // url comes from the SerializedPage (the content-script capture), not the extract call arg
    expect(result.pageContext.url).toBe('https://example.com/article');
  });

  it('records strategiesAttempted on the error path when all strategies fail (D-07 audit trail)', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const firstStrategy: IExtractionStrategy = {
      id: 'defuddle',
      canHandle: () => true,
      run: async () => {
        throw new Error('first crash');
      },
    };
    const secondStrategy: IExtractionStrategy = {
      id: 'readability',
      canHandle: () => true,
      run: async () => {
        throw new Error('second crash');
      },
    };
    const service = new PageContentService([firstStrategy, secondStrategy]);

    const result = await service.extract(1, 'default', 'https://example.com/article');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure result');
    expect(result.error.code).toBe('PARSE_ERROR');
    expect(result.error.strategiesAttempted).toEqual(['defuddle', 'readability']);
  });

  it('returns mode-specific cached results — actionable extraction after default is a fresh extraction (CR-01)', async () => {
    sendMessageMock.mockResolvedValue(makeSerializedPage());
    const service = new PageContentService(); // full three-strategy registry

    const defaultFirst = await service.extract(1, 'default', 'https://example.com/article');
    expect(defaultFirst.ok).toBe(true);
    if (!defaultFirst.ok) throw new Error('expected ok result');
    expect(defaultFirst.pageContext.mode).toBe('default');
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    // A default-mode cache entry must NOT satisfy an actionable request —
    // this is a fresh extraction (pre-fix: mode === 'default' returned here).
    const actionable = await service.extract(1, 'actionable', 'https://example.com/article');
    expect(actionable.ok).toBe(true);
    if (!actionable.ok) throw new Error('expected ok result');
    expect(actionable.pageContext.mode).toBe('actionable');
    if (actionable.pageContext.mode !== 'actionable') throw new Error('expected actionable mode');
    expect(actionable.pageContext.source).toBe('apc-lite');
    expect(sendMessageMock).toHaveBeenCalledTimes(2);

    // The actionable entry is now cached — repeat call reuses it.
    const actionableAgain = await service.extract(1, 'actionable', 'https://example.com/article');
    expect(actionableAgain.ok).toBe(true);
    if (!actionableAgain.ok) throw new Error('expected ok result');
    expect(actionableAgain.pageContext.mode).toBe('actionable');
    expect(sendMessageMock).toHaveBeenCalledTimes(2);

    // The default entry survived the actionable extraction — no cross-mode eviction.
    const defaultAgain = await service.extract(1, 'default', 'https://example.com/article');
    expect(defaultAgain.ok).toBe(true);
    if (!defaultAgain.ok) throw new Error('expected ok result');
    expect(defaultAgain.pageContext.mode).toBe('default');
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
  });
});
