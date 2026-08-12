// src/core/extraction/PageContentCache.ts — D-4a-02/04: the per-tab in-memory
// cache DISTINCT from the Phase-1 PageRegistry (registry keeps the lightweight
// live title/url context; the cache holds the extracted content + the ephemeral
// MiniSearch index together). NEVER persisted to IndexedDB (§26.5) — in-memory
// only. Dependency-free core: no React/antd/zustand, no storage imports — the
// MiniSearch handle is a type-only reference (the PageIndexBuilder builds it;
// PageContentService 04a-08 is the only consumer).
//
// D-4a-04 eviction discipline: recency bumped on every read/serve; eviction
// drops the tab's cache AND its ephemeral index TOGETHER (the indexHandle lives
// inside the entry); an in-flight or subscribed tab is NEVER LRU-evicted;
// pinned tabs are eviction-last (a user-chosen pin never silently loses its
// cache — any non-pinned evictable candidate wins over a pinned one).
import type { PageContext } from '@/core/content/PageContext';
import type MiniSearch from 'minisearch';

/** D-4a-04 / Appendix C constant — hard per-tab cap (exported + vitest-pinned). */
export const PAGE_CACHE_MAX_TABS = 20;

/** One tab's cached extraction + its ephemeral index handle + eviction marks. */
export interface PageCacheEntry {
  pageContext: PageContext;
  markdown: string;
  sourceUsed: string;
  indexHandle: MiniSearch | null;
  /** Last-served timestamp — LRU order (injectable clock for deterministic tests). */
  recency: number;
  /** User-chosen pin — eviction-last (never silently lost while evictable alternatives exist). */
  pinned: boolean;
  /** A surface is active on this tab — never LRU-evicted (D-4a-04). */
  subscribed: boolean;
  /** D-4a-03 promise-map primitive — a running extraction; never LRU-evicted. */
  inFlight: Promise<unknown> | null;
}

/**
 * Input for {@link PageContentCache.set} — content + index handle; the cache
 * stamps recency and preserves/derives the eviction marks.
 */
export type PageCacheEntryInput = Omit<
  PageCacheEntry,
  'recency' | 'pinned' | 'subscribed' | 'inFlight'
>;

export class PageContentCache {
  private readonly entries = new Map<number, PageCacheEntry>();
  private readonly now: () => number;

  /**
   * Injectable clock — deterministic tests (Phase-4 PromptCacheManager
   * precedent); production default Date.now.
   */
  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? Date.now;
  }

  /** Upsert — stamps recency; preserves existing pinned/subscribed/inFlight marks; LRU-evicts past the cap. */
  set(tabId: number, input: PageCacheEntryInput): void {
    const existing = this.entries.get(tabId);
    this.entries.set(tabId, {
      ...input,
      recency: this.now(),
      pinned: existing?.pinned ?? false,
      subscribed: existing?.subscribed ?? false,
      inFlight: existing?.inFlight ?? null,
    });
    this.evictIfNeeded();
  }

  /** Read — bumps recency on every serve (D-4a-04). */
  get(tabId: number): PageCacheEntry | undefined {
    const entry = this.entries.get(tabId);
    if (entry) entry.recency = this.now();
    return entry;
  }

  /** Invalidation path (SPA-nav / tabs.onUpdated) — drops cache + index together. */
  invalidate(tabId: number): void {
    this.entries.delete(tabId);
  }

  /** tabs.onRemoved path — drops cache + index together (D-4a-04). */
  remove(tabId: number): void {
    this.entries.delete(tabId);
  }

  /** Pin hook — eviction-last protection for a user-chosen pin (no-op on unknown tab). */
  setPinned(tabId: number, pinned: boolean): void {
    const entry = this.entries.get(tabId);
    if (entry) entry.pinned = pinned;
  }

  /** Subscription hook — active surface on this tab, never LRU-evicted (no-op on unknown tab). */
  setSubscribed(tabId: number, subscribed: boolean): void {
    const entry = this.entries.get(tabId);
    if (entry) entry.subscribed = subscribed;
  }

  /** D-4a-03 in-flight promise primitive — never LRU-evicted while set (no-op on unknown tab). */
  setInFlight(tabId: number, inFlight: Promise<unknown> | null): void {
    const entry = this.entries.get(tabId);
    if (entry) entry.inFlight = inFlight;
  }

  clear(): void {
    this.entries.clear();
  }

  /**
   * D-4a-04 LRU pressure: while past the cap, evict the least-recently-served
   * EVICTABLE entry. In-flight/subscribed are never candidates; pinned entries
   * are eviction-last (only evicted when no non-pinned evictable entry remains).
   */
  private evictIfNeeded(): void {
    while (this.entries.size > PAGE_CACHE_MAX_TABS) {
      const victim = this.findEvictionVictim();
      if (victim === undefined) break; // all remaining protected — never evict them
      this.entries.delete(victim);
    }
  }

  private findEvictionVictim(): number | undefined {
    let leastRecent: { tabId: number; recency: number } | undefined;
    let leastRecentPinned: { tabId: number; recency: number } | undefined;
    for (const [tabId, entry] of this.entries) {
      if (entry.inFlight || entry.subscribed) continue; // NEVER evict
      if (entry.pinned) {
        if (!leastRecentPinned || entry.recency < leastRecentPinned.recency) {
          leastRecentPinned = { tabId, recency: entry.recency };
        }
      } else if (!leastRecent || entry.recency < leastRecent.recency) {
        leastRecent = { tabId, recency: entry.recency };
      }
    }
    // Pinned eviction-last: prefer any non-pinned candidate over pinned ones.
    return leastRecent?.tabId ?? leastRecentPinned?.tabId;
  }
}
