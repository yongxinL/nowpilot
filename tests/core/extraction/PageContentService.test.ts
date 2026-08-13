// tests/core/extraction/PageContentService.test.ts — 04a-08 §18 orchestrator
// suite (P4a-1, D-4a-03/04/05/10/19/22). Proves:
//   Test 1  extractLayered defuddle-success → sourceUsed 'defuddle',
//           fallbacksTried [] (Appendix O.12 verbatim acceptance)
//   Test 2  boilerplate → the Readability fallback INSIDE DefuddleStrategy wins →
//           sourceUsed 'readability' + the defuddle attempt recorded (D-4a-19)
//   Test 3  empty page → typed CONTENT_EXTRACT_FAILED carrier with the tried
//           strategies (CAT-01 — never a silent-empty result, D-4a-19/22)
//   Test 4  two concurrent same-tab extract() → ONE bridge request (D-4a-03
//           per-tab in-flight coalescing)
//   Test 5  invalidate then getContent → awaits the in-flight extraction, never
//           the stale pre-navigation entry (Pitfall 7 / T-4a-22)
//   Test 6  a never-resolving bridge request → after the injected short timeout
//           the typed CONTENT_EXTRACT_FAILED carrier surfaces (single 5 s cap,
//           §22.1 — EXTRACTION_TIMEOUT_MS pinned here, D-4a-03)
//   Test 7  LRU eviction cap + deterministic order + pinned/in-flight protection
//           (P4a-1, D-4a-04; injectable clock)
//   Test 8  a successful extraction writes currentPageContext via the store
//           draft (D-4a-05 primary-writer — inert field, D-18/RESEARCH Q3)
//   Test 9  a secret-shaped string in the fixture page is absent from the served
//           content + the lazily-built index (D-4a-10 redaction-before-index,
//           CAT-03)
//   Test 10 chrome.tabs.onRemoved drops cache+index; the bridge nav signal
//           re-extracts subscribed tabs (D-4a-01/04 wiring; fakeBrowser stubs)
//
// Fixtures come from the SHARED module only (D-4a-24 — never per-test HTML).
// Default jsdom-align env (DOMParser required by the real strategy pipeline).
// Mock bridge + injectable clock + fakeBrowser chrome.tabs stubs (the
// ContentScriptHost.test.ts flushRuntime precedent, L27-30).
import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

import {
  EXTRACTION_TIMEOUT_MS,
  PageContentService,
  extractLayered,
  isContentExtractFailed,
  type ContentExtractFailedCarrier,
  type PageContentBridgeLike,
} from '@/core/extraction/PageContentService';
import { PAGE_CACHE_MAX_TABS, PageContentCache } from '@/core/extraction/PageContentCache';
import { DefuddleStrategy } from '@/core/extraction/strategies/DefuddleStrategy';
import { ApcLiteStrategy } from '@/core/extraction/strategies/ApcLiteStrategy';
import type { IExtractionStrategy, StrategyResult } from '@/core/extraction/strategies/IExtractionStrategy';
import type { ExtractionPayload } from '@/core/content/PageContextBridge';
import { MessageType } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import {
  FIXED_TITLE,
  buildArticleFixture,
  buildBoilerplateFixture,
  buildEmptyPageFixture,
  buildSecretPageFixture,
} from '../../fixtures/pageContent';

/** Fixture payload the mock bridge resolves with (the 04a-07 ExtractionPayload shape). */
function payloadFor(html: string, baseUrl: string): ExtractionPayload {
  return { html, baseUrl, truncated: false };
}

/** Instant strategy for the eviction/wiring tests — no DOMParser, no defuddle. */
class FakeStrategy implements IExtractionStrategy {
  id = 'defuddle' as const;
  canHandle(): boolean {
    return true;
  }
  async run(): Promise<StrategyResult> {
    return {
      source: 'defuddle',
      markdown: '# Fake\n\nDeterministic strategy output.',
      meta: { title: 'Fake Page' },
      approxTokens: 10,
      truncated: false,
    };
  }
}

/**
 * Controllable bridge fake (the D-4a-03 coalescing seam): counts
 * requestExtraction calls, resolves the configured payload (with optional
 * latency), can hang forever (timeout test) or reject typed, and can emit
 * inbound bridge messages (the D-4a-01 nav-signal wiring test).
 */
class MockBridge implements PageContentBridgeLike {
  calls = 0;
  latency = 0;
  hang = false;
  payload: unknown;
  rejectWith: unknown | undefined;
  private readonly subscribers = new Set<(message: RuntimeEnvelope<unknown>) => void>();

  constructor(payload: unknown, latency = 0, rejectWith?: unknown) {
    this.payload = payload;
    this.latency = latency;
    this.rejectWith = rejectWith;
  }

  requestExtraction<TData = ExtractionPayload>(
    _tabId: number,
    _mode: 'default' | 'actionable',
    _options?: { timeoutMs?: number },
  ): Promise<TData> {
    this.calls++;
    if (this.hang) return new Promise<TData>(() => {});
    if (this.rejectWith !== undefined) return Promise.reject(this.rejectWith);
    if (this.latency === 0) return Promise.resolve(this.payload as TData);
    return new Promise<TData>((resolve) =>
      setTimeout(() => resolve(this.payload as TData), this.latency),
    );
  }

  onMessage(cb: (message: RuntimeEnvelope<unknown>) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  emit(message: RuntimeEnvelope<unknown>): void {
    this.subscribers.forEach((cb) => cb(message));
  }
}

/** Flush the mock-bridge promise chain (async trigger — ContentScriptHost.test.ts L27-30). */
async function flushRuntime(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function realStrategies(): IExtractionStrategy[] {
  return [new DefuddleStrategy(), new ApcLiteStrategy()];
}

describe('extractLayered (Appendix O.12 verbatim, D-4a-22)', () => {
  it('Test 1 — defuddle success: sourceUsed defuddle, no fallbacks tried', async () => {
    const fixture = buildArticleFixture();
    const outcome = await extractLayered(
      { url: fixture.url, title: fixture.title, mode: 'default', html: fixture.html },
      realStrategies(),
    );
    expect(outcome.sourceUsed).toBe('defuddle');
    expect(outcome.fallbacksTried).toEqual([]);
    expect(outcome.result.markdown?.length).toBeGreaterThan(0);
  });

  it('Test 2 — boilerplate: the Readability fallback inside DefuddleStrategy wins and records the attempt (D-4a-19)', async () => {
    const fixture = buildBoilerplateFixture();
    const outcome = await extractLayered(
      { url: fixture.url, title: fixture.title, mode: 'default', html: fixture.html },
      realStrategies(),
    );
    expect(outcome.sourceUsed).toBe('readability');
    expect(outcome.fallbacksTried).toEqual(['defuddle']);
  });

  it('Test 3 — empty page: typed CONTENT_EXTRACT_FAILED with fallbacksTried (CAT-01, never silent-empty)', async () => {
    const fixture = buildEmptyPageFixture();
    try {
      await extractLayered(
        { url: fixture.url, title: fixture.title, mode: 'default', html: fixture.html },
        realStrategies(),
      );
      throw new Error('extractLayered must throw on a totally-empty page');
    } catch (err) {
      expect(isContentExtractFailed(err)).toBe(true);
      expect((err as ContentExtractFailedCarrier).code).toBe(ERROR_CODES.CONTENT_EXTRACT_FAILED);
      expect((err as ContentExtractFailedCarrier).fallbacksTried).toEqual(['defuddle']);
    }
  });
});

describe('PageContentService (D-4a-03/04/05/10 orchestrator)', () => {
  it('Test 4 — two concurrent same-tab extractions coalesce into ONE bridge request', async () => {
    const fixture = buildArticleFixture();
    const bridge = new MockBridge(payloadFor(fixture.html, fixture.url), 5);
    const service = new PageContentService({
      bridge,
      cache: new PageContentCache(),
      strategies: realStrategies(),
    });
    const [a, b] = await Promise.all([service.extract(1, 'default'), service.extract(1, 'default')]);
    expect(bridge.calls).toBe(1);
    expect(a).toBe(b);
    expect(a.sourceUsed).toBe('defuddle');
  });

  it('Test 5 — invalidate then getContent awaits the in-flight extraction, never the stale entry (Pitfall 7)', async () => {
    const fixture = buildArticleFixture();
    const NEW_URL = 'https://docs.example.com/updated';
    const bridge = new MockBridge(payloadFor(fixture.html, fixture.url));
    const service = new PageContentService({
      bridge,
      cache: new PageContentCache(),
      strategies: realStrategies(),
    });

    // First extraction completes — the cache holds the OLD (pre-navigation) content.
    await service.extract(1, 'default');
    expect((await service.getContent(1))?.url).toBe(fixture.url);

    // Second extraction is slow; invalidate drops the old entry while it is in flight.
    bridge.payload = payloadFor(fixture.html, NEW_URL);
    bridge.latency = 40;
    const p2 = service.extract(1, 'default');
    service.invalidate(1);

    // The read MUST await the in-flight extraction — never serve the old entry.
    const fresh = await service.getContent(1);
    expect(fresh).toBeDefined();
    expect(fresh?.url).toBe(NEW_URL);
    await p2;
  });

  it('Test 6 — a hanging bridge request surfaces typed CONTENT_EXTRACT_FAILED at the 5 s cap (injected short timeout; §22.1)', async () => {
    expect(EXTRACTION_TIMEOUT_MS).toBe(5000);
    const bridge = new MockBridge(null);
    bridge.hang = true;
    const service = new PageContentService({
      bridge,
      cache: new PageContentCache(),
      strategies: realStrategies(),
      timeoutMs: 25,
    });
    try {
      await service.extract(1, 'default');
      throw new Error('extract must reject on a never-resolving bridge request');
    } catch (err) {
      expect(isContentExtractFailed(err)).toBe(true);
      expect((err as ContentExtractFailedCarrier).code).toBe(ERROR_CODES.CONTENT_EXTRACT_FAILED);
      expect((err as ContentExtractFailedCarrier).fallbacksTried).toEqual([]);
    }
  });

  it('Test 7 — LRU eviction: cap + deterministic order + pinned/in-flight never evicted (P4a-1, D-4a-04)', async () => {
    let tick = 0;
    const bridge = new MockBridge(payloadFor('<p>x</p>', 'https://example.com/tab'));
    const fake = new FakeStrategy();
    const makeService = (): { service: PageContentService; cache: PageContentCache } => {
      tick = 0;
      const cache = new PageContentCache({ now: () => ++tick });
      const service = new PageContentService({ bridge, cache, strategies: [fake] });
      return { service, cache };
    };

    // (a) Deterministic order — serving a tab protects it from the next eviction.
    {
      const { service, cache } = makeService();
      for (let i = 1; i <= PAGE_CACHE_MAX_TABS; i++) await service.extract(i, 'default');
      await service.getContent(1); // recency bump — tab 1 is now the most recent
      await service.extract(PAGE_CACHE_MAX_TABS + 1, 'default');
      expect(cache.get(1)).toBeDefined();
      expect(cache.get(2)).toBeUndefined(); // the least-recently-served entry
      expect(cache.get(PAGE_CACHE_MAX_TABS + 1)).toBeDefined();
    }

    // (b) A pinned tab is eviction-last.
    {
      const { service, cache } = makeService();
      for (let i = 1; i <= PAGE_CACHE_MAX_TABS; i++) await service.extract(i, 'default');
      cache.setPinned(1, true);
      for (let i = PAGE_CACHE_MAX_TABS + 1; i <= PAGE_CACHE_MAX_TABS + 5; i++) {
        await service.extract(i, 'default');
      }
      expect(cache.get(1)).toBeDefined();
    }

    // (c) An in-flight extraction is never LRU-evicted (D-4a-04 mark semantics).
    {
      const { service, cache } = makeService();
      await service.extract(1, 'default'); // cached entry exists
      bridge.hang = true;
      const inFlight = service.extract(1, 'default'); // marks the entry in-flight
      bridge.hang = false;
      for (let i = 2; i <= PAGE_CACHE_MAX_TABS + 1; i++) await service.extract(i, 'default');
      expect(cache.get(1)).toBeDefined(); // in-flight entry survived 20 further upserts
      expect(cache.get(2)).toBeUndefined(); // the eviction pressure hit tab 2 instead
      await inFlight;
    }
  });

  it('Test 8 — delivery: successful extraction writes currentPageContext via the store draft (D-4a-05 primary-writer)', async () => {
    useWorkspaceStore.setState((s) => ({
      workspace: { ...s.workspace, currentPageContext: undefined },
    }));
    const fixture = buildArticleFixture();
    const bridge = new MockBridge(payloadFor(fixture.html, fixture.url));
    const service = new PageContentService({
      bridge,
      cache: new PageContentCache(),
      strategies: realStrategies(),
    });
    await service.extract(1, 'default');
    const ctx = useWorkspaceStore.getState().workspace.currentPageContext;
    expect(ctx).toBeDefined();
    expect(ctx?.url).toBe(fixture.url);
    expect(ctx?.title).toBe(FIXED_TITLE);
  });

  it('Test 9 — redaction: a secret-shaped string never reaches the cache or the lazily-built index (D-4a-10, CAT-03)', async () => {
    const fixture = buildSecretPageFixture();
    const bridge = new MockBridge(payloadFor(fixture.html, fixture.url));
    const cache = new PageContentCache();
    const service = new PageContentService({
      bridge,
      cache,
      strategies: realStrategies(),
    });
    await service.extract(1, 'default');
    const entry = cache.get(1);
    expect(entry).toBeDefined();
    expect(entry?.markdown).not.toContain('JSESSIONID=abc123def456');
    expect(entry?.markdown).toContain('[REDACTED]');
    expect(entry?.pageContext.markdown).not.toContain('JSESSIONID=abc123def456');
    expect(entry?.pageContext.html).toBeUndefined();
    expect(Object.values(entry?.pageContext.meta ?? {}).join(' ')).not.toContain(
      'JSESSIONID=abc123def456',
    );
    // The ephemeral index is built lazily from the REDACTED markdown (D-4a-15/10).
    expect(service.queryIndex(1, 'jsessionid')).toEqual([]);
    expect(service.queryIndex(1, 'session')).not.toEqual([]);
  });

  it('Test 10 — wiring: tabs.onRemoved drops cache+index; the bridge nav signal re-extracts subscribed tabs (D-4a-01/04)', async () => {
    const tabListeners: Record<string, (...args: unknown[]) => void> = {};
    (fakeBrowser.tabs as unknown as Record<string, unknown>).onUpdated = {
      addListener: (cb: (...args: unknown[]) => void) => {
        tabListeners.onUpdated = cb;
      },
      removeListener: () => {
        delete tabListeners.onUpdated;
      },
    };
    (fakeBrowser.tabs as unknown as Record<string, unknown>).onRemoved = {
      addListener: (cb: (...args: unknown[]) => void) => {
        tabListeners.onRemoved = cb;
      },
      removeListener: () => {
        delete tabListeners.onRemoved;
      },
    };

    const fixture = buildArticleFixture();
    const bridge = new MockBridge(payloadFor(fixture.html, fixture.url));
    const cache = new PageContentCache();
    const service = new PageContentService({
      bridge,
      cache,
      strategies: realStrategies(),
      tabId: 7,
    });
    service.start();
    await service.extract(7, 'default');
    expect(cache.get(7)).toBeDefined();

    // tabs.onRemoved drops the cache + index together (D-4a-04).
    tabListeners.onRemoved?.(7);
    expect(cache.get(7)).toBeUndefined();

    // Re-extract so the cache holds content again, then subscribe.
    await service.extract(7, 'default');
    service.subscribe(7, 'default');
    expect(cache.get(7)).toBeDefined();

    // The host's nav signal (EXTRACT_PAGE_CONTENT with a page payload — the
    // D-4a-01 lightweight live-context update) marks stale + re-extracts the
    // subscribed tab (coalesced).
    const before = bridge.calls;
    bridge.emit({
      id: 'nav-1',
      type: MessageType.EXTRACT_PAGE_CONTENT,
      createdAt: 1,
      source: 'content',
      payload: {
        page: {
          url: 'https://docs.example.com/after-nav',
          origin: 'https://docs.example.com',
          hostname: 'docs.example.com',
          title: 'After Nav',
          meta: {},
          extractedAt: 1,
        },
      },
    });
    await flushRuntime();
    await flushRuntime();
    expect(bridge.calls).toBeGreaterThan(before);

    service.stop();
    expect(tabListeners.onUpdated).toBeUndefined();
    expect(tabListeners.onRemoved).toBeUndefined();
  });
});
