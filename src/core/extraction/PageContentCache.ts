import type { ExtractionResult } from './types';

/**
 * Per-tab in-memory page content cache (D-17).
 *
 * Keyed by tabId; entries carry the URL they were extracted for plus an
 * indexedAt timestamp. Cache misses return null and the caller triggers lazy
 * re-extraction. Invalidation happens on URL change (SPA navigation) and via
 * the explicit reExtract() API.
 */
interface CacheEntry {
  url: string;
  result: ExtractionResult;
  indexedAt: number;
}

export class PageContentCache {
  private readonly entries = new Map<number, CacheEntry>();

  /** Returns the cached result when the stored URL matches; null otherwise. */
  get(tabId: number, url: string): ExtractionResult | null {
    const entry = this.entries.get(tabId);
    if (!entry || entry.url !== url) return null;
    return entry.result;
  }

  /** Updates the cache entry for the given tab. */
  set(tabId: number, url: string, result: ExtractionResult): void {
    this.entries.set(tabId, { url, result, indexedAt: Date.now() });
  }

  /** Deletes the entry for the given tab; used by reExtract and navigation. */
  invalidate(tabId: number): void {
    this.entries.delete(tabId);
  }

  /**
   * Invalidates only when the cached URL differs from the given URL
   * (SPA_NAVIGATION handling). Same-URL navigations keep the cache hot.
   *
   * @returns true when the entry was invalidated.
   */
  invalidateIfChanged(tabId: number, url: string): boolean {
    const entry = this.entries.get(tabId);
    if (entry && entry.url !== url) {
      this.entries.delete(tabId);
      return true;
    }
    return false;
  }
}

/** Module-level singleton for consumers that don't need their own instance. */
export const pageContentCache = new PageContentCache();
