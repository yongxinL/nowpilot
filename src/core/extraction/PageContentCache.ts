import type { ExtractionMode, ExtractionResult } from './types';

/**
 * Per-tab in-memory page content cache (D-17).
 *
 * Keyed by tabId + mode + url; entries carry the URL they were extracted for
 * plus an indexedAt timestamp. Cache misses return null and the caller
 * triggers lazy re-extraction. Invalidation happens on URL change (SPA
 * navigation) and via the explicit reExtract() API.
 */
interface CacheEntry {
  url: string;
  result: ExtractionResult;
  indexedAt: number;
}

/** Composite cache key: one entry per (tabId, mode, url) triple (CR-01). */
function cacheKey(tabId: number, mode: ExtractionMode, url: string): string {
  return `${tabId}:${mode}:${url}`;
}

export class PageContentCache {
  private readonly entries = new Map<string, CacheEntry>();

  /** Returns the cached result when the stored URL matches; null otherwise. */
  get(tabId: number, mode: ExtractionMode, url: string): ExtractionResult | null {
    const entry = this.entries.get(cacheKey(tabId, mode, url));
    if (!entry || entry.url !== url) return null;
    return entry.result;
  }

  /** Updates the cache entry for the given tab, mode and URL. */
  set(tabId: number, mode: ExtractionMode, url: string, result: ExtractionResult): void {
    this.entries.set(cacheKey(tabId, mode, url), { url, result, indexedAt: Date.now() });
  }

  /** Deletes every entry for the given tab (all modes); used by reExtract and navigation. */
  invalidate(tabId: number): void {
    const prefix = `${tabId}:`;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  /**
   * Invalidates only when a cached URL differs from the given URL
   * (SPA_NAVIGATION handling). SPA navigation invalidates the tab across all
   * modes. Same-URL navigations keep the cache hot.
   *
   * @returns true when any entry was invalidated.
   */
  invalidateIfChanged(tabId: number, url: string): boolean {
    const prefix = `${tabId}:`;
    let exists = false;
    let allMatch = true;
    for (const [key, entry] of this.entries) {
      if (!key.startsWith(prefix)) continue;
      exists = true;
      if (entry.url !== url) allMatch = false;
    }
    if (!exists || allMatch) return false;
    // At least one entry held a stale URL — drop the whole tab across modes.
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
    return true;
  }
}

/** Module-level singleton for consumers that don't need their own instance. */
export const pageContentCache = new PageContentCache();
