---
phase: 06-pagecontentservice-knowledge-acquisition
plan: 03
subsystem: extraction
tags: [pagecontentcache, lru, lifecycle, coalescing, invalidation, subscription, ephemeral, indexing-hook]

# Dependency graph
requires:
  - phase: 06-pagecontentservice-knowledge-acquisition (plan 06-01)
    provides: PageContentService.extract() + ExtractResult/ExtractionMetrics/ExtractInput types, redaction seam (D-90), PAGE_CACHE_MAX_TABS tunable in IExtractionStrategy, isEnvelope guard, chrome.tabs mock + __fireTabEvent in tests/setup.ts, the §18 PageContentService.test.ts file
provides:
  - PageContentCache — §26.4a normative extraction lifecycle: per-tab LRU (PAGE_CACHE_MAX_TABS=20, access-recency bumping), invalidation (SPA_NAVIGATION + chrome.tabs.onUpdated), eviction (chrome.tabs.onRemoved), in-flight coalescing (promise dedup keyed by tabId), read-after-invalidation awaits the in-flight re-extract (never a stale entry), pinned eviction-last, never evicts in-flight/subscribed tabs, always-evict-together via the onIndexEvicted hook, declared subscription API (subscribe/unsubscribe/markStale)
  - Ten §26.4a cache-lifecycle behavior groups appended to tests/core/extraction/PageContentService.test.ts (26 total tests green)
affects: [06-04 (PageIndexBuilder wires its evict() into onIndexEvicted — eviction-together contract), Phase 7 (surface subscribe call-sites: pinnedTabs/WorkspaceStore), Phase 15 (surface subscribe call-sites: active tab), Phase 11 (Diagnostics consumes extraction metrics)]

actuals:
  tokens: 7209      # chars/4 over the realized diff (28,837 diff chars across the 3 plan commits)
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Module-singleton per ProviderRegistry precedent: module-level Map + namespace export + named exports + __test__ reset/seed seam"
    - "Coalescing guard: getOrExtract returns the in-flight promise keyed by tabId — one extract() per concurrent demand (dedup)"
    - "Never-serve-stale: stale flag + in-flight await in get() — content dropped on invalidation, re-extracted on demand or subscription auto re-extract (D-89)"
    - "Eviction-together hook: onIndexEvicted(() => ...) registration so the index (06-04) evicts with its extraction — cache owns no index (D-87)"
    - "Additive lastInput replay source: subscription-gated auto re-extract re-demands the last ExtractInput (D-89)"

key-files:
  created:
    - src/core/extraction/PageContentCache.ts
  modified:
    - tests/core/extraction/PageContentService.test.ts

key-decisions:
  - "CacheEntry carries lastInput (the last demanded ExtractInput) as the replay source for the D-89 subscription-gated auto re-extract — subscribed tabs re-extract what was last demanded rather than guessing"
  - "markStale vs invalidate vs evict are distinct: markStale = unsubscribed-tab path (content dropped, stale flag, no auto re-extract); invalidate = SPA-nav/tabs.onUpdated (subscribed tabs auto re-extract); evict = tabs.onRemoved (full removal) — both names kept per §26.4a wording"
  - "The index-eviction hook is a separate Set of handlers (fireIndexEvictionHook isolates + logs hook errors) — the cache guarantees eviction-together without owning the index (D-87)"
  - "subscribe() on a never-seen tab creates a protected shell entry (survives LRU pressure) — subscription is a property of the tab, not of having extracted yet"

patterns-established:
  - "§26.4a lifecycle verbatim as a self-contained module: bounded LRU, invalidation/eviction sources, concurrency guard, subscription API — all unit-proven in the §18 test file"
  - "Ephemeral by construction: zero chrome.storage/idb/indexedDB imports (grep-assertable) — cache is memory-only (§26.4a ROADMAP SC-4)"
  - "Never a silent stale serve (D-91): failed extraction leaves the entry stale; get() returns undefined rather than stale content"

requirements-completed: []   # infra phase — no spec-native v1 IDs (ROADMAP Phase 6 note)

coverage:
  - id: D1
    description: "PageContentCache implements the §26.4a lifecycle — per-tab LRU (cap PAGE_CACHE_MAX_TABS=20, access-recency bumping), invalidation on SPA_NAVIGATION + chrome.tabs.onUpdated, eviction on chrome.tabs.onRemoved, in-flight coalescing with await-not-stale reads, pinned eviction-last, never evicts in-flight/subscribed tabs, index-evicted-together hook, declared subscribe/unsubscribe/markStale API, ephemeral (zero storage imports)"
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#PageContentCache (06-03 §26.4a lifecycle)"
        status: pass
      - kind: other
        ref: "pnpm run lint (tsc --noEmit strict-clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ten §26.4a behavior groups proven in the expanded §18 test file — LRU cap, recency bumping, pinned eviction-last, in-flight never evicted, coalescing, await-not-stale, tabs.onUpdated invalidation, SPA_NAVIGATION invalidation, tabs.onRemoved eviction, subscription gating — plus eviction-together hook firing, markStale semantics, evict-vs-invalidate distinction, protected shell subscription, and failed-extraction staleness"
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#PageContentCache (06-03 §26.4a lifecycle) (15 cache-lifecycle tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "06-01 extract()/error-path tests stay green alongside the new cache blocks (26/26 total in the §18 file)"
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#PageContentService.extract"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-08-30
status: complete
---

# Phase 6 Plan 3: PageContentCache — the §26.4a extraction lifecycle

**Per-tab LRU extraction cache (cap 20, access-recency bumping) with SPA-nav + tabs.onUpdated invalidation, tabs.onRemoved eviction, in-flight coalescing, await-not-stale reads, pinned eviction-last, index-evicted-together hook, and the declared subscribe/unsubscribe/markStale subscription API — ephemeral by construction, proven by ten §26.4a behavior groups appended to the §18 test file**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-30T08:04:00Z
- **Completed:** 2026-08-30T08:08:36Z
- **Tasks:** 2 (both TDD — RED/GREEN pairs)
- **Files modified:** 2 (1 source + 1 test, +704 lines)

## Accomplishments

- **PageContentCache** (src/core/extraction/PageContentCache.ts, 352 lines): the §26.4a normative lifecycle as a module-singleton (ProviderRegistry precedent). `getOrExtract` coalesces concurrent demands on the in-flight promise keyed by tabId; `get` bumps access-recency and — after invalidation — AWAITS the in-flight re-extract, never serving stale content; `invalidate` (SPA_NAVIGATION + tabs.onUpdated 'complete') drops content + fires the index hook and auto re-extracts subscribed tabs via the additive `lastInput` replay source (D-89); `evict` (tabs.onRemoved) fully removes; `markStale` is the unsubscribed-tab path (no auto re-extract); LRU enforcement never evicts in-flight/subscribed tabs and treats pinned as eviction-last; the `onIndexEvicted` hook guarantees extraction+index evict together (D-87); `init()` is idempotent with type-guarded envelope handling (T-P6-14). **Ephemeral by construction — zero storage imports (grep-assertable, ROADMAP SC-4).**
- **Subscription API declared (D-88/D-89):** `subscribe`/`unsubscribe`/`markStale` are implemented; a never-seen subscribed tab creates a protected shell entry that survives LRU pressure; surface call-sites that subscribe arrive with their owning phases (7/15) — create-only (D-81).
- **Ten §26.4a behavior groups green** in the expanded §18 `PageContentService.test.ts` (26/26 total incl. the 06-01 extract/error tests): LRU cap, recency bumping, pinned eviction-last (+ pinned-only fallback), in-flight never evicted, coalescing (one extract per concurrent demand), read-after-invalidation awaits the fresh extraction, tabs.onUpdated invalidation, SPA_NAVIGATION invalidation, tabs.onRemoved eviction, subscription gating — plus eviction-together hook firing, markStale never-serves-never-auto-extracts, evict-vs-invalidate distinction, protected shell subscription, and failed-extraction staleness (D-91).

## Task Commits

Each task was committed atomically with TDD discipline:

1. **Task 1: PageContentCache — §26.4a lifecycle module**
   - `6a2f1ba` (feat): implement PageContentCache §26.4a lifecycle module
2. **Task 2: Cache lifecycle tests — expand tests/core/extraction/PageContentService.test.ts**
   - `cb5aa5f` (test): add failing cache-lifecycle tests for PageContentCache
   - `396fc3b` (test): expand cache lifecycle coverage — markStale, evict, shell subscription, failed-extraction staleness

**Plan metadata:** pending (docs commit after SUMMARY)

## Files Created/Modified

- `src/core/extraction/PageContentCache.ts` — §26.4a lifecycle module (created): per-tab LRU cap 20, invalidation/eviction signals, coalescing, await-not-stale, pinned eviction-last, subscription API, onIndexEvicted hook, `__test__` seam, `init()`
- `tests/core/extraction/PageContentService.test.ts` — APPENDED 15 cache-lifecycle tests (06-01 extract/error tests untouched and green)

## Decisions Made

- **`lastInput` as replay source:** the CacheEntry stores the last demanded `ExtractInput` so a subscribed tab's invalidation auto re-extracts what was last demanded — no guessing, coalescing with any in-flight (D-89).
- **markStale / invalidate / evict as distinct operations:** markStale (unsubscribed path — drop content, flag stale, no auto re-extract), invalidate (SPA-nav/tabs.onUpdated — subscribed tabs auto re-extract), evict (tabs.onRemoved — full removal). Both invalidate/evict names kept per the §26.4a wording.
- **Separate hook Set for eviction-together:** the cache fires registered index hooks (isolating hook errors) rather than owning an index handle — eviction-together guaranteed without the cache building/searching an index (D-87).
- **subscribe() creates a protected shell entry** even before extraction — subscription is a tab property, and the shell survives LRU pressure by definition.

## Deviations from Plan

None - plan executed exactly as written. Both tasks implemented per the plan's `<action>` blocks; the ten behavior groups were proven, plus the additional markStale/evict/shell/failed-extraction cases in the second test commit (natural completion of Task 2's coverage, within scope).

## Issues Encountered

- The cache's `subscribe()`-on-never-seen-tab behavior wasn't explicitly in the plan's test list — resolved by committing the protected-shell test as part of Task 2's coverage expansion (396fc3b), consistent with the declared API semantics.

## Known Stubs

None — the module is fully implemented; the only deferred wiring is the surface boot/subscribe call-sites (Phase 7/15, D-81) and the PageIndexBuilder eviction registration (06-04).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-04 (content shells + PageContextBridge): the bridge and PageIndexBuilder register `PageContentCache.onIndexEvicted(builderEvict)` so extraction+index always evict together (§26.4a, D-87) — the hook API and its subscription semantics are proven here.
- Phase 7 / Phase 15: the subscription API (`subscribe`/`unsubscribe`/`markStale`) is declared and unit-proven — surface call-sites (active-tab / pinnedTabs) wire in when their phases own the surfaces.
- 06-05 (isolation grep): the cache imports only runtime/content/extraction modules — no storage, no UI, no index code; content-bundle cleanliness is unaffected.

## Self-Check: PASSED

- [x] `src/core/extraction/PageContentCache.ts` exists (352 lines)
- [x] Commits cb5aa5f, 6a2f1ba, 396fc3b all present in `git log`
- [x] `npx vitest run tests/core/extraction/PageContentService.test.ts` → 26/26 pass (06-01 extract/error tests + 15 cache-lifecycle tests)
- [x] `pnpm run lint` strict-clean
- [x] Grep guards: zero chrome.storage/idb/indexedDB imports in PageContentCache (ephemeral); PAGE_CACHE_MAX_TABS imported from IExtractionStrategy; zero NP-STRICT in src/core/extraction + the test file

---
*Phase: 06-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-30*