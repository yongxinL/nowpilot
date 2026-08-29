// PageContentService tests — §18 required test.
//
// Proves the panel-side round-trip end-to-end (D-82): fixture HTML + stamped
// baseUrl → extract() → canonical PageContext (url/origin/hostname/title/
// markdown/meta/extractedAt) with metrics.source === 'defuddle', plus every
// CONTENT_EXTRACT_FAILED path (D-91 — never a silent empty result): no-handler,
// strategy throw, internal 5 s timeout (PAGE_EXTRACTION_TIMEOUT_MS), caller
// abort, fallback exhaustion — and the D-90 redaction seam. The service is
// pure orchestration; no chrome mocks needed (the envelope round-trip is
// 06-04). Fixtures are the same synthesized shapes as DefuddleStrategy.test.ts.
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  extract,
  redactExtractedContent,
  registerStrategy,
  __test__,
} from '@/core/extraction/PageContentService';
import type { PageContext } from '@/core/content/PageContext';
import type { IExtractionStrategy } from '@/core/extraction/strategies/IExtractionStrategy';

// ---------------------------------------------------------------------------
// 06-03: PageContentCache — §26.4a lifecycle (LRU cap, invalidation sources,
// coalescing, await-not-stale, subscription gating, eviction-together hook).
// APPEND-ONLY: the extract()/redaction describes above stay untouched.
// ---------------------------------------------------------------------------
import { PageContentCache, __test__ as cacheTest } from '@/core/extraction/PageContentCache';
import {
  PageContentService,
  type ExtractionMetrics,
  type ExtractInput,
  type ExtractResult,
} from '@/core/extraction/PageContentService';
import { PAGE_CACHE_MAX_TABS } from '@/core/extraction/strategies/IExtractionStrategy';
import { createEnvelope } from '@/core/runtime/RuntimeEnvelope';

// setup.ts has no chrome.runtime mock — 06-03 provides a test-local captured
// listener stub so PageContentCache.init() can subscribe SPA_NAVIGATION
// (D-84 feed). Test-local only; do NOT edit setup.ts again.
const runtimeMessageListeners = new Set<(message: unknown, sender?: unknown) => void>();
if (!(globalThis as any).chrome.runtime) {
  (globalThis as any).chrome.runtime = {};
}
(globalThis as any).chrome.runtime.onMessage = {
  addListener: (handler: (message: unknown, sender?: unknown) => void) => {
    runtimeMessageListeners.add(handler);
  },
  removeListener: (handler: (message: unknown, sender?: unknown) => void) => {
    runtimeMessageListeners.delete(handler);
  },
};

function fireRuntimeMessage(message: unknown, sender?: unknown): void {
  for (const listener of runtimeMessageListeners) listener(message, sender);
}

const CACHE_URL = 'https://support.servicenow.com/kb/cache/1';

function makeContext(seed: string): PageContext {
  return {
    url: CACHE_URL,
    origin: BASE_URL,
    hostname: 'support.servicenow.com',
    title: seed,
    markdown: `# ${seed}`,
    meta: {},
    extractedAt: 1,
  };
}

function makeMetrics(): ExtractionMetrics {
  return { durationMs: 1, source: 'defuddle', truncated: false, charCount: 10 };
}

function makeInput(tabId: number): ExtractInput {
  return { tabId, url: CACHE_URL, title: `tab-${tabId}`, mode: 'default' };
}

const KB_ARTICLE_HTML = `<!doctype html>
<html>
<head><title>How to reset a user password in ServiceNow</title></head>
<body>
<article>
<h1>How to reset a user password in ServiceNow</h1>
<p>This article explains the password reset procedure for ServiceNow administrators. It covers impersonation, unlocking locked accounts, and setting temporary passwords for users who cannot authenticate.</p>
<h2>Before you begin</h2>
<p>You need the admin role on the instance, the user's employee number or login, and a temporary password that meets the password policy requirements.</p>
<h2>Steps</h2>
<ol>
<li>Open the User Management module from the application navigator.</li>
<li>Search for the affected user account by name, employee number, or user ID.</li>
<li>Open the user record and select Reset Password from the context menu.</li>
<li>Enter a temporary password and confirm it, then save the record.</li>
<li>Communicate the temporary password to the user through a secure channel.</li>
</ol>
<p>Related articles: <a href="/kb/incident-management/123">Incident Management overview</a>.</p>
</article>
</body>
</html>`;

// Fallback-exhaustion fixture: no text at all — defuddle yields 0 words and
// Readability.parse() returns null on an empty body.
const THIN_HTML = `<!doctype html>
<html>
<head><title>Empty page</title></head>
<body></body>
</html>`;

const URL = 'https://support.servicenow.com/kb/article/123';
const BASE_URL = 'https://support.servicenow.com';
const TITLE = 'How to reset a user password in ServiceNow';

function hangingStrategy(): IExtractionStrategy {
  return {
    id: 'apc-lite',
    canHandle: ({ mode }) => mode === 'actionable',
    run: () => new Promise<never>(() => {}),
  };
}

function throwingStrategy(): IExtractionStrategy {
  return {
    id: 'apc-lite',
    canHandle: ({ mode }) => mode === 'actionable',
    run: async () => {
      throw new Error('boom');
    },
  };
}

function metaStrategy(): IExtractionStrategy {
  return {
    id: 'apc-lite',
    canHandle: ({ mode }) => mode === 'actionable',
    run: async () => ({
      source: 'apc-lite' as const,
      root: { id: 'r1', role: 'root' },
      meta: { apiKey: 'sk-123', title: 'T' },
      approxTokens: 5,
      truncated: false,
    }),
  };
}

describe('PageContentService.extract', () => {
  beforeEach(() => {
    __test__.reset();
  });

  it('(a) round-trips fixture html + baseUrl → PageContext with source defuddle (D-82)', async () => {
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'default', html: KB_ARTICLE_HTML, baseUrl: BASE_URL });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.url).toBe(URL);
    expect(result.context.origin).toBe(BASE_URL);
    expect(result.context.hostname).toBe('support.servicenow.com');
    expect(result.context.title).toBe(TITLE);
    expect(result.context.markdown?.length).toBeGreaterThan(0);
    expect(result.context.meta.title).toBeDefined();
    expect(result.context.extractedAt).toBeGreaterThan(0);
    expect(result.metrics.source).toBe('defuddle');
    expect(result.metrics.charCount).toBeGreaterThan(0);
    expect(result.metrics.truncated).toBe(false);
  });

  it('(b) malformed/empty html → ok:false CONTENT_EXTRACT_FAILED (never silent-empty)', async () => {
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'default', html: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('no-handler mode → ok:false CONTENT_EXTRACT_FAILED', async () => {
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'actionable', html: KB_ARTICLE_HTML });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
  });

  it('(c) strategy throw → ok:false CONTENT_EXTRACT_FAILED', async () => {
    registerStrategy(throwingStrategy());
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'actionable' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
  });

  it('(d) never-resolving strategy → internal 5 s timeout → CONTENT_EXTRACT_FAILED', async () => {
    vi.useFakeTimers();
    try {
      registerStrategy(hangingStrategy());
      const pending = extract({ tabId: 1, url: URL, title: TITLE, mode: 'actionable' });
      await vi.advanceTimersByTimeAsync(5_000);
      const result = await pending;
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
    } finally {
      vi.useRealTimers();
    }
  });

  it('(d2) caller-signal abort also classifies as CONTENT_EXTRACT_FAILED', async () => {
    registerStrategy(hangingStrategy());
    const controller = new AbortController();
    const pending = extract({ tabId: 1, url: URL, title: TITLE, mode: 'actionable', signal: controller.signal });
    controller.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
  });

  it('(e) redaction seam empties apiKey-shaped meta keys, keeps content through (D-90)', async () => {
    registerStrategy(metaStrategy());
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'actionable' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.meta.apiKey).toBe('');
    expect(result.context.meta.title).toBe('T');
  });

  it('(f) fallback-exhaustion end-to-end → ok:false (never an empty ok:true)', async () => {
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'default', html: THIN_HTML });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
  });
});

describe('redactExtractedContent (D-90 seam)', () => {
  it('empties secret-shaped meta/addonFields keys, passes content through unchanged', () => {
    const context: PageContext = {
      url: URL,
      origin: BASE_URL,
      hostname: 'support.servicenow.com',
      title: 'T',
      markdown: '# Hello',
      html: '<p>Hello</p>',
      meta: { apiKey: 'secret', note: 'keep' },
      extractedAt: 1,
      addonFields: { authorization: 'Bearer x', visible: true },
    };
    const redacted = redactExtractedContent(context);
    expect(redacted.meta.apiKey).toBe('');
    expect(redacted.meta.note).toBe('keep');
    expect(redacted.addonFields?.authorization).toBe('');
    expect(redacted.addonFields?.visible).toBe(true);
    expect(redacted.markdown).toBe('# Hello');
    expect(redacted.title).toBe('T');
    expect(redacted).not.toBe(context); // deep-clone, no mutation
  });
});

describe('PageContentCache (06-03 §26.4a lifecycle)', () => {
  beforeEach(() => {
    cacheTest.reset();
    vi.restoreAllMocks();
  });

  it('(1) LRU cap: seeding PAGE_CACHE_MAX_TABS+1 evicts the least-recently-accessed unpinned unsubscribed entry', () => {
    for (let i = 1; i <= PAGE_CACHE_MAX_TABS + 1; i++) {
      cacheTest.seedEntry(i, {
        context: makeContext(`tab-${i}`),
        metrics: makeMetrics(),
        lastAccessed: i,
      });
    }
    expect(cacheTest.size).toBe(PAGE_CACHE_MAX_TABS);
    expect(cacheTest.has(1)).toBe(false);
    expect(cacheTest.has(PAGE_CACHE_MAX_TABS + 1)).toBe(true);
  });

  it('(2) access-recency bumping: a served read protects the entry from the next eviction', async () => {
    for (let i = 1; i <= PAGE_CACHE_MAX_TABS; i++) {
      cacheTest.seedEntry(i, {
        context: makeContext(`tab-${i}`),
        metrics: makeMetrics(),
        lastAccessed: i,
      });
    }
    const served = await PageContentCache.get(1);
    expect(served?.context.title).toBe('tab-1');
    expect(served?.metrics.charCount).toBe(10);
    cacheTest.seedEntry(PAGE_CACHE_MAX_TABS + 1, {
      context: makeContext('tab-21'),
      metrics: makeMetrics(),
      lastAccessed: 9999,
    });
    expect(cacheTest.size).toBe(PAGE_CACHE_MAX_TABS);
    expect(cacheTest.has(1)).toBe(true);
    expect(cacheTest.has(2)).toBe(false);
  });

  it('(3) pinned eviction-last: pinned entries survive LRU pressure while unpinned are evicted first', () => {
    for (let i = 1; i <= PAGE_CACHE_MAX_TABS - 1; i++) {
      cacheTest.seedEntry(i, {
        context: makeContext(`tab-${i}`),
        metrics: makeMetrics(),
        lastAccessed: i,
      });
    }
    cacheTest.seedEntry(100, {
      context: makeContext('pinned'),
      metrics: makeMetrics(),
      pinned: true,
      lastAccessed: 50,
    });
    expect(cacheTest.size).toBe(PAGE_CACHE_MAX_TABS);
    cacheTest.seedEntry(200, {
      context: makeContext('tab-200'),
      metrics: makeMetrics(),
      lastAccessed: 1000,
    });
    expect(cacheTest.size).toBe(PAGE_CACHE_MAX_TABS);
    expect(cacheTest.has(100)).toBe(true);
    expect(cacheTest.has(1)).toBe(false);
  });

  it('(3b) when only pinned entries remain, the least-recently-accessed pinned entry is evicted', () => {
    for (let i = 1; i <= PAGE_CACHE_MAX_TABS; i++) {
      cacheTest.seedEntry(i, {
        context: makeContext(`pinned-${i}`),
        metrics: makeMetrics(),
        pinned: true,
        lastAccessed: i,
      });
    }
    cacheTest.seedEntry(PAGE_CACHE_MAX_TABS + 1, {
      context: makeContext('pinned-21'),
      metrics: makeMetrics(),
      pinned: true,
      lastAccessed: 9999,
    });
    expect(cacheTest.size).toBe(PAGE_CACHE_MAX_TABS);
    expect(cacheTest.has(1)).toBe(false);
    expect(cacheTest.has(PAGE_CACHE_MAX_TABS + 1)).toBe(true);
  });

  it('(4) in-flight never evicted: pending extraction skipped by LRU; evictable after settle', async () => {
    for (let i = 1; i <= PAGE_CACHE_MAX_TABS - 1; i++) {
      cacheTest.seedEntry(i, {
        context: makeContext(`tab-${i}`),
        metrics: makeMetrics(),
        lastAccessed: i,
      });
    }
    let resolveExtract!: (result: ExtractResult) => void;
    const pending = new Promise<ExtractResult>((resolve) => {
      resolveExtract = resolve;
    });
    cacheTest.seedEntry(100, {
      context: makeContext('inflight'),
      metrics: makeMetrics(),
      inFlight: pending,
      lastAccessed: 0,
    });
    expect(cacheTest.size).toBe(PAGE_CACHE_MAX_TABS);
    cacheTest.seedEntry(200, {
      context: makeContext('tab-200'),
      metrics: makeMetrics(),
      lastAccessed: 1000,
    });
    expect(cacheTest.has(100)).toBe(true);
    expect(cacheTest.has(1)).toBe(false);
    cacheTest.seedEntry(300, {
      context: makeContext('tab-300'),
      metrics: makeMetrics(),
      lastAccessed: 2000,
    });
    expect(cacheTest.has(100)).toBe(true);
    expect(cacheTest.has(2)).toBe(false);
    resolveExtract({ ok: true, context: makeContext('fresh'), metrics: makeMetrics() });
    await pending;
    cacheTest.seedEntry(400, {
      context: makeContext('tab-400'),
      metrics: makeMetrics(),
      lastAccessed: 3000,
    });
    expect(cacheTest.has(100)).toBe(false);
  });

  it('(5) coalescing: concurrent getOrExtract(tabId) calls share one extract() invocation', async () => {
    const spy = vi.spyOn(PageContentService, 'extract').mockImplementation(async (input) => ({
      ok: true,
      context: makeContext(`c-${input.tabId}`),
      metrics: makeMetrics(),
    }));
    const [a, b] = await Promise.all([
      PageContentCache.getOrExtract(9, makeInput(9)),
      PageContentCache.getOrExtract(9, makeInput(9)),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('(6) read-after-invalidation awaits the in-flight re-extract — never a stale entry', async () => {
    const OLD = makeContext('OLD');
    cacheTest.seedEntry(7, {
      context: OLD,
      metrics: makeMetrics(),
      subscribed: true,
      lastInput: makeInput(7),
      lastAccessed: 1,
    });
    let resolveExtract!: (result: ExtractResult) => void;
    const spy = vi
      .spyOn(PageContentService, 'extract')
      .mockReturnValue(new Promise<ExtractResult>((resolve) => { resolveExtract = resolve; }));
    PageContentCache.invalidate(7);
    const servedPromise = PageContentCache.get(7);
    resolveExtract({ ok: true, context: makeContext('NEW'), metrics: makeMetrics() });
    const served = await servedPromise;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(served?.context.title).toBe('NEW');
    expect(served?.context).not.toBe(OLD);
  });

  it('(7) tabs.onUpdated invalidation: subscribed tabs auto re-extract, unsubscribed mark-stale only', async () => {
    PageContentCache.init();
    const spy = vi.spyOn(PageContentService, 'extract');
    cacheTest.seedEntry(5, {
      context: makeContext('s5'),
      metrics: makeMetrics(),
      lastInput: makeInput(5),
      lastAccessed: 1,
    });
    (globalThis as any).__fireTabEvent('onUpdated', 5, { status: 'complete' }, { id: 5 });
    expect(spy).not.toHaveBeenCalled();
    expect(cacheTest.peek(5)?.stale).toBe(true);
    expect(await PageContentCache.get(5)).toBeUndefined();
    cacheTest.seedEntry(6, {
      context: makeContext('s6'),
      metrics: makeMetrics(),
      subscribed: true,
      lastInput: makeInput(6),
      lastAccessed: 1,
    });
    (globalThis as any).__fireTabEvent('onUpdated', 6, { status: 'complete' }, { id: 6 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('(8) SPA_NAVIGATION envelope through init() invalidates the sender tab; malformed messages ignored', () => {
    PageContentCache.init();
    cacheTest.seedEntry(11, { context: makeContext('s11'), metrics: makeMetrics(), lastAccessed: 1 });
    fireRuntimeMessage(createEnvelope('SPA_NAVIGATION', { url: CACHE_URL }, 'content'), { tab: { id: 11 } });
    expect(cacheTest.peek(11)?.stale).toBe(true);
    cacheTest.seedEntry(12, { context: makeContext('s12'), metrics: makeMetrics(), lastAccessed: 1 });
    fireRuntimeMessage({ type: 'SPA_NAVIGATION' }, { tab: { id: 12 } });
    expect(cacheTest.peek(12)?.stale).toBe(false);
  });

  it('(9) tabs.onRemoved evicts the tab entry', () => {
    PageContentCache.init();
    cacheTest.seedEntry(13, { context: makeContext('s13'), metrics: makeMetrics(), lastAccessed: 1 });
    (globalThis as any).__fireTabEvent('onRemoved', 13, {});
    expect(cacheTest.has(13)).toBe(false);
  });

  it('(10) subscription gating: subscribe → auto re-extract on invalidation; unsubscribe → mark-stale only', () => {
    PageContentCache.init();
    const spy = vi.spyOn(PageContentService, 'extract').mockImplementation(async (input) => ({
      ok: true,
      context: makeContext(`fresh-${input.tabId}`),
      metrics: makeMetrics(),
    }));
    cacheTest.seedEntry(14, {
      context: makeContext('s14'),
      metrics: makeMetrics(),
      lastInput: makeInput(14),
      lastAccessed: 1,
    });
    PageContentCache.subscribe(14);
    (globalThis as any).__fireTabEvent('onUpdated', 14, { status: 'complete' }, { id: 14 });
    expect(spy).toHaveBeenCalledTimes(1);
    PageContentCache.unsubscribe(14);
    (globalThis as any).__fireTabEvent('onUpdated', 14, { status: 'complete' }, { id: 14 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(cacheTest.peek(14)?.stale).toBe(true);
  });

  it('index-evicted-together: a registered eviction hook fires on invalidate/evict (06-04 registers the index eviction)', () => {
    const hook = vi.fn();
    PageContentCache.onIndexEvicted(hook);
    cacheTest.seedEntry(20, { context: makeContext('s20'), metrics: makeMetrics(), lastAccessed: 1 });
    PageContentCache.invalidate(20);
    expect(hook).toHaveBeenCalledWith(20);
    PageContentCache.evict(21);
    expect(hook).toHaveBeenCalledWith(21);
  });
});