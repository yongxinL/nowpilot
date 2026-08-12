// tests/core/extraction/PageContentCache.test.ts — 04a-05 Task 1 cache-level LRU
// smoke file (D-4a-02/04): proves the deterministic LRU eviction order (injectable
// clock), invalidate drop, and pinned eviction-last at the CACHE level. The full
// cap/order/pin integration suite (service-driven — in-flight/subscribed mark
// semantics via the D-4a-03 promise map, allowStale delegation) lands with the
// 04a-08 service plan by design; this file holds the minimal node-env smoke.
// Pure Map logic — node env avoids the jsdom 30 TextEncoder/esbuild invariant
// break (PageRegistry.test.ts L8 precedent).
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { PageContext } from '@/core/content/PageContext';
import { PAGE_CACHE_MAX_TABS, PageContentCache } from '@/core/extraction/PageContentCache';
import type { PageCacheEntryInput } from '@/core/extraction/PageContentCache';

function makeEntry(tabId: number): PageCacheEntryInput {
  const pageContext: PageContext = {
    url: `https://example.com/tab-${tabId}`,
    origin: 'https://example.com',
    hostname: 'example.com',
    title: `Tab ${tabId}`,
    meta: {},
    extractedAt: 1_700_000_000_000,
  };
  return { pageContext, markdown: `# Tab ${tabId}`, sourceUsed: 'defuddle', indexHandle: null };
}

describe('PageContentCache (04a-05 — per-tab LRU + eviction discipline, D-4a-02/04)', () => {
  it('exports the pinned PAGE_CACHE_MAX_TABS = 20 constant', () => {
    expect(PAGE_CACHE_MAX_TABS).toBe(20);
  });

  it('evicts the least-recently-upserted entry beyond PAGE_CACHE_MAX_TABS (deterministic clock)', () => {
    let tick = 0;
    const cache = new PageContentCache({ now: () => ++tick });
    for (let i = 1; i <= PAGE_CACHE_MAX_TABS; i++) cache.set(i, makeEntry(i));
    // N+1 upsert — the entry with the earliest recency (tab 1, tick 1) is evicted.
    cache.set(PAGE_CACHE_MAX_TABS + 1, makeEntry(PAGE_CACHE_MAX_TABS + 1));
    expect(cache.get(1)).toBeUndefined();
    expect(cache.get(2)).toBeDefined();
    expect(cache.get(PAGE_CACHE_MAX_TABS + 1)).toBeDefined();
    // Cache stays at the cap.
    expect(cache.get(20)).toBeDefined();
  });

  it('bumps recency on every read — a served entry survives the next eviction', () => {
    let tick = 0;
    const cache = new PageContentCache({ now: () => ++tick });
    for (let i = 1; i <= PAGE_CACHE_MAX_TABS; i++) cache.set(i, makeEntry(i));
    // Serve tab 1 — its recency is bumped past all other entries.
    cache.get(1);
    cache.set(PAGE_CACHE_MAX_TABS + 1, makeEntry(PAGE_CACHE_MAX_TABS + 1));
    // Now the least-recently-served is tab 2 (recency 2), not tab 1.
    expect(cache.get(1)).toBeDefined();
    expect(cache.get(2)).toBeUndefined();
  });

  it('invalidate(tabId) drops the entry — subsequent get returns undefined', () => {
    const cache = new PageContentCache({ now: () => 1 });
    cache.set(7, makeEntry(7));
    expect(cache.get(7)).toBeDefined();
    cache.invalidate(7);
    expect(cache.get(7)).toBeUndefined();
  });

  it('remove(tabId) drops the entry (tabs.onRemoved path)', () => {
    const cache = new PageContentCache({ now: () => 1 });
    cache.set(7, makeEntry(7));
    cache.set(9, makeEntry(9));
    cache.remove(7);
    expect(cache.get(7)).toBeUndefined();
    expect(cache.get(9)).toBeDefined();
  });

  it('a pinned tab is eviction-last — LRU pressure evicts non-pinned entries first', () => {
    let tick = 0;
    const cache = new PageContentCache({ now: () => ++tick });
    for (let i = 1; i <= PAGE_CACHE_MAX_TABS; i++) cache.set(i, makeEntry(i));
    cache.setPinned(1, true);
    // Push 5 more entries past the cap — every eviction must skip the pinned tab.
    for (let i = PAGE_CACHE_MAX_TABS + 1; i <= PAGE_CACHE_MAX_TABS + 5; i++) {
      cache.set(i, makeEntry(i));
    }
    expect(cache.get(1)).toBeDefined(); // pinned survives all pressure
    expect(cache.get(2)).toBeUndefined(); // non-pinned evicted first
    expect(cache.get(3)).toBeUndefined();
    expect(cache.get(4)).toBeUndefined();
    expect(cache.get(5)).toBeUndefined();
  });

  it('never LRU-evicts an in-flight or subscribed entry (D-4a-04)', () => {
    let tick = 0;
    const cache = new PageContentCache({ now: () => ++tick });
    for (let i = 1; i <= PAGE_CACHE_MAX_TABS; i++) cache.set(i, makeEntry(i));
    cache.setInFlight(1, Promise.resolve());
    cache.setSubscribed(2, true);
    for (let i = PAGE_CACHE_MAX_TABS + 1; i <= PAGE_CACHE_MAX_TABS + 2; i++) {
      cache.set(i, makeEntry(i));
    }
    expect(cache.get(1)).toBeDefined(); // in-flight survives
    expect(cache.get(2)).toBeDefined(); // subscribed survives
    expect(cache.get(3)).toBeUndefined(); // least-recent unprotected evicted
    expect(cache.get(4)).toBeUndefined();
  });

  it('set() preserves existing pinned/subscribed/inFlight marks on re-upsert', () => {
    const cache = new PageContentCache({ now: () => 1 });
    cache.set(7, makeEntry(7));
    cache.setPinned(7, true);
    cache.set(7, makeEntry(7)); // re-extraction upsert
    expect(cache.get(7)?.pinned).toBe(true); // the pin survives re-extraction
    expect(cache.get(7)?.markdown).toBe('# Tab 7');
  });

  it('clear() empties the cache', () => {
    const cache = new PageContentCache({ now: () => 1 });
    cache.set(7, makeEntry(7));
    cache.set(9, makeEntry(9));
    cache.clear();
    expect(cache.get(7)).toBeUndefined();
    expect(cache.get(9)).toBeUndefined();
  });
});
