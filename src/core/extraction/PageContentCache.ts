// PageContentCache — §26.4a normative extraction lifecycle (D-88/D-89).
//
// Per-tab LRU cache of extracted page content implementing the §26.4a
// lifecycle verbatim: invalidation (SPA-nav wxt:locationchange +
// chrome.tabs.onUpdated), eviction (chrome.tabs.onRemoved), bounded LRU
// (PAGE_CACHE_MAX_TABS = 20, access-recency bumping), in-flight coalescing
// (dedup on the promise keyed by tabId), read-after-invalidation awaits the
// in-flight re-extract (never a stale entry), pinned eviction-last, never
// evict an in-flight or subscribed tab, and the always-evict-together
// guarantee (extraction + index — the index eviction hook is registered by
// PageIndexBuilder in 06-04; this module does NOT own the index, D-87).
//
// EPHEMERAL BY SPEC (§26.4a): keyed by tabId, SEPARATE from the Phase-1
// PageRegistry (which registers surface pages, not page content), and NEVER
// persisted — zero storage imports here (grep-assertable).
//
// Subscription model (D-88/D-89): subscribed = surface active on tab OR pinned
// via WorkspaceState.pinnedTabs. The API is DECLARED here (subscribe/
// unsubscribe/markStale); the surface call-sites that subscribe arrive with
// their owning phases (7/15) — create-only (D-81). The cache takes numeric
// tabIds only and never imports WorkspaceStore types.
//
// Redaction (D-90): PageContentService.extract() already redacts before the
// result leaves the service; this cache stores only the redacted context and
// logs tabId-level metadata only (never raw context).
import { debugLog } from '../log/debugLog';
import type { PageContext } from '../content/PageContext';
import {
  PageContentService,
  type ExtractionMetrics,
  type ExtractInput,
  type ExtractResult,
} from './PageContentService';
import { PAGE_CACHE_MAX_TABS } from './strategies/IExtractionStrategy';
import { isEnvelope } from '../runtime/RuntimeEnvelope';

/** One tab's cache record (§26.4a). `context`/`metrics` are absent while an
 * extraction is in flight or after invalidation (content dropped — never a
 * stale serve). `lastInput` is the ADDITIVE replay source for the D-89
 * subscription-gated auto re-extract (a subscribed tab's invalidation
 * re-extracts the last demanded input; fresh payloads arrive via
 * getOrExtract in production). The 06-04 index handle attaches through the
 * eviction hook, not this record. */
export interface CacheEntry {
  tabId: number;
  context?: PageContext;
  metrics?: ExtractionMetrics;
  /** ADDITIVE (D-89): last demand input — replay source for subscription auto re-extract. */
  lastInput?: ExtractInput;
  subscribed: boolean;
  pinned: boolean;
  /** Content is stale (invalidated) — never served; re-extract on demand. */
  stale: boolean;
  /** In-flight extraction promise (the §26.4a coalescing handle). */
  inFlight?: Promise<ExtractResult>;
  /** Access-recency stamp — bumped on every read/serve (LRU ordering). */
  lastAccessed: number;
}

export interface CachedContent {
  context: PageContext;
  metrics: ExtractionMetrics;
}

// ---------------------------------------------------------------------------
// Module state (single cache per surface — UI contexts only; ProviderRegistry
// module-Map style)
// ---------------------------------------------------------------------------

const entries = new Map<number, CacheEntry>();
const indexEvictionHooks = new Set<(tabId: number) => void>();
let initialized = false;

function createEntry(tabId: number): CacheEntry {
  return {
    tabId,
    subscribed: false,
    pinned: false,
    stale: true,
    lastAccessed: Date.now(),
  };
}

/** Fire the index-eviction hook (06-04's PageIndexBuilder.evict) so an
 * extraction eviction always drops the index too (§26.4a — never orphan an
 * index). Hook errors are isolated and logged, never propagated. */
function fireIndexEvictionHook(tabId: number): void {
  for (const hook of indexEvictionHooks) {
    try {
      hook(tabId);
    } catch (error) {
      debugLog('CACHE_EVICT', 'index eviction hook threw', {
        tabId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/** Settle wiring shared by getOrExtract and the __test__.seedEntry seam:
 * clears inFlight, stores the fresh redacted result, or marks the entry stale
 * on failure (never a silent stale serve — D-91). */
function attachSettleHandler(tabId: number, promise: Promise<ExtractResult>): void {
  promise.then(
    (result) => {
      const current = entries.get(tabId);
      if (current === undefined || current.inFlight !== promise) return;
      current.inFlight = undefined;
      if (result.ok) {
        current.context = result.context;
        current.metrics = result.metrics;
        current.stale = false;
      } else {
        current.context = undefined;
        current.metrics = undefined;
        current.stale = true;
      }
    },
    () => {
      const current = entries.get(tabId);
      if (current === undefined || current.inFlight !== promise) return;
      current.inFlight = undefined;
      current.context = undefined;
      current.metrics = undefined;
      current.stale = true;
    },
  );
}

/** §26.4a bounded LRU: while over the cap, evict the least-recently-accessed
 * entry EXCEPT in-flight or subscribed entries; pinned entries are
 * eviction-last (evicted only after all unpinned candidates are gone). When
 * every evictable entry is pinned, the least-recently-accessed pinned one is
 * evicted. Extraction and its index are always evicted together (evictEntry
 * fires the index hook). */
function enforceLru(): void {
  while (entries.size > PAGE_CACHE_MAX_TABS) {
    const evictable = Array.from(entries.values()).filter((e) => !e.inFlight && !e.subscribed);
    if (evictable.length === 0) break; // all protected — bounded by the protected set
    const unpinned = evictable.filter((e) => !e.pinned);
    const pool = unpinned.length > 0 ? unpinned : evictable;
    pool.sort((a, b) => a.lastAccessed - b.lastAccessed);
    const victim = pool[0];
    if (victim === undefined) break;
    evictEntry(victim.tabId);
  }
}

function evictEntry(tabId: number): void {
  fireIndexEvictionHook(tabId); // index evicted together — never orphaned (§26.4a)
  entries.delete(tabId);
  debugLog('CACHE_EVICT', 'tab cache entry evicted', { tabId });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** §26.4a coalescing wrapper: concurrent getOrExtract(tabId) calls share one
 * extract() invocation (dedup on the in-flight promise keyed by tabId — the
 * concurrency guard). A fresh entry is created on demand; access recency is
 * bumped on insert; LRU is enforced past the cap. */
function getOrExtract(tabId: number, input: ExtractInput): Promise<ExtractResult> {
  const existing = entries.get(tabId);
  if (existing?.inFlight !== undefined) {
    return existing.inFlight; // coalesce — §26.4a concurrency guard
  }
  const promise = PageContentService.extract(input);
  const entry: CacheEntry = existing ?? createEntry(tabId);
  entry.lastInput = input;
  entry.lastAccessed = Date.now();
  entry.inFlight = promise;
  entries.set(tabId, entry);
  attachSettleHandler(tabId, promise);
  enforceLru();
  return promise;
}

/** Serve + bump access-recency (LRU ordering). After an invalidation, a read
 * arriving while the re-extract is in flight AWAITS the in-flight extraction
 * — never a stale entry (§26.4a). A stale entry with no in-flight extraction
 * is never served (undefined — the demand path is getOrExtract, D-89). */
async function get(tabId: number): Promise<CachedContent | undefined> {
  const entry = entries.get(tabId);
  if (entry === undefined) return undefined;
  entry.lastAccessed = Date.now(); // access-recency bumping (§26.4a)
  if (entry.inFlight !== undefined) {
    const result = await entry.inFlight;
    if (!result.ok) return undefined;
    return { context: result.context, metrics: result.metrics };
  }
  if (entry.stale || entry.context === undefined || entry.metrics === undefined) {
    return undefined;
  }
  return { context: entry.context, metrics: entry.metrics };
}

/** Unsubscribed-tab invalidation path (D-89): the entry stays but its content
 * is dropped and flagged stale — re-extract happens only on next demand
 * (getOrExtract), never automatically. The index is evicted together. */
function markStale(tabId: number): void {
  const entry = entries.get(tabId);
  if (entry === undefined) return;
  fireIndexEvictionHook(tabId);
  entry.context = undefined;
  entry.metrics = undefined;
  entry.stale = true;
  debugLog('CACHE_INVALIDATE', 'tab cache marked stale', { tabId });
}

/** Invalidate on SPA-nav (wxt:locationchange) / tabs.onUpdated (§26.4a):
 * drop the entry's content AND trigger the index eviction hook. Subscribed
 * tabs auto re-extract (D-89, coalescing with any in-flight); unsubscribed
 * tabs are mark-stale only. */
function invalidate(tabId: number): void {
  const entry = entries.get(tabId);
  if (entry === undefined) return;
  fireIndexEvictionHook(tabId);
  entry.context = undefined;
  entry.metrics = undefined;
  entry.stale = true;
  if (entry.subscribed && entry.lastInput !== undefined) {
    // D-89 subscription-gated auto re-extract (dedups on any in-flight).
    void getOrExtract(tabId, entry.lastInput);
  }
  debugLog('CACHE_INVALIDATE', 'tab cache invalidated', { tabId });
}

/** Eviction alias for the tabs.onRemoved path (§26.4a wording keeps both
 * names) — the entry is fully removed (index evicted together). */
function evict(tabId: number): void {
  evictEntry(tabId);
}

/** Declared subscription API (D-88): subscribed tabs are auto re-extracted on
 * invalidation signals and never LRU-evicted. Surface call-sites that
 * subscribe (surface active on tab / pinned via WorkspaceState.pinnedTabs)
 * are Phase 7/15 — create-only here (D-81). */
function subscribe(tabId: number): void {
  const entry = entries.get(tabId) ?? createEntry(tabId);
  entry.subscribed = true;
  entries.set(tabId, entry);
}

function unsubscribe(tabId: number): void {
  const entry = entries.get(tabId);
  if (entry !== undefined) entry.subscribed = false;
}

/** Idempotent boot (D-84 feed, D-81 create-only — surface boot call-sites
 * arrive in Phase 7/15): subscribes chrome.runtime.onMessage (SPA_NAVIGATION
 * → invalidate the sender tab; malformed messages ignored — T-P6-14) and
 * chrome.tabs.onUpdated (status 'complete' → invalidate) +
 * chrome.tabs.onRemoved (→ evict). */
function init(): void {
  if (initialized) return;
  initialized = true;
  chrome.runtime.onMessage.addListener((message: unknown, sender: chrome.runtime.MessageSender) => {
    if (!isEnvelope(message)) return; // T-P6-14: type-guard before use
    if (message.type !== 'SPA_NAVIGATION') return;
    const senderTabId = sender.tab?.id;
    const payloadTabId = (message.payload as { tabId?: unknown } | undefined)?.tabId;
    const tabId =
      typeof senderTabId === 'number' ? senderTabId : typeof payloadTabId === 'number' ? payloadTabId : undefined;
    if (tabId !== undefined) invalidate(tabId);
  });
  chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
    if (changeInfo.status === 'complete') invalidate(tabId);
  });
  chrome.tabs.onRemoved.addListener((tabId: number) => {
    evict(tabId);
  });
}

/** Eviction-together hook registration — 06-04's PageIndexBuilder wires its
 * evict() here so extraction+index are always evicted together (§26.4a, D-87).
 * Returns an unsubscribe function. */
function onIndexEvicted(hook: (tabId: number) => void): () => void {
  indexEvictionHooks.add(hook);
  return () => {
    indexEvictionHooks.delete(hook);
  };
}

// ---------------------------------------------------------------------------
// Test seams — exported only for unit tests. `__test__` prefix matches the
// ProviderRegistry / chromeStorageAdapter convention. Production code must
// NOT use these.
// ---------------------------------------------------------------------------

export const __test__ = {
  reset(): void {
    entries.clear();
    indexEvictionHooks.clear();
    initialized = false;
  },
  /** Seed a lifecycle fixture entry (LRU-enforced like a real insert; an
   * inFlight promise gets the same settle wiring as getOrExtract). */
  seedEntry(tabId: number, entry: Partial<CacheEntry>): void {
    const seeded: CacheEntry = {
      tabId,
      context: entry.context,
      metrics: entry.metrics,
      lastInput: entry.lastInput,
      subscribed: entry.subscribed ?? false,
      pinned: entry.pinned ?? false,
      stale: entry.stale ?? false,
      lastAccessed: entry.lastAccessed ?? Date.now(),
    };
    if (entry.inFlight !== undefined) {
      seeded.inFlight = entry.inFlight;
      attachSettleHandler(tabId, entry.inFlight);
    }
    entries.set(tabId, seeded);
    enforceLru();
  },
  get size(): number {
    return entries.size;
  },
  has(tabId: number): boolean {
    return entries.has(tabId);
  },
  peek(tabId: number): CacheEntry | undefined {
    return entries.get(tabId);
  },
};

/** Object-form namespace export for callers (ProviderRegistry precedent). */
export const PageContentCache = {
  getOrExtract,
  get,
  markStale,
  invalidate,
  evict,
  subscribe,
  unsubscribe,
  init,
  onIndexEvicted,
  __test__,
};

export {
  getOrExtract,
  get,
  markStale,
  invalidate,
  evict,
  subscribe,
  unsubscribe,
  init,
  onIndexEvicted,
};