---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 05
subsystem: extraction
tags: [minisearch, lru-cache, ephemeral-index, heading-chunking, page-content]

# Dependency graph
requires:
  - phase: 04a-01
    provides: four extraction libraries installed (defuddle/readability/turndown/minisearch), verify:phase-4a script
  - phase: 04a-03
    provides: PageContentSerializer (single turndown converter — TURNDOWN_OPTIONS A6 parity) + shared golden fixtures (D-4a-24)
provides:
  - PageContentCache — per-tab in-memory cache, LRU-20, pin/in-flight/subscribed eviction protection, injectable clock (D-4a-02/04)
  - PageIndexBuilder — ephemeral MiniSearch index: heading-boundary chunking, (preamble), headingPath breadcrumbs, 500-token sub-chunking (D-4a-15/16)
  - Cache-level LRU smoke test + fixture-driven chunking/index test
affects: [04a-08 (PageContentService — sole consumer), 04a-09, 04a-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-tab ephemeral store: cache + index evicted TOGETHER, never persisted (§26.5), type-only MiniSearch handle keeps the cache dependency-free"
    - "Injectable now-clock for deterministic LRU tests (Phase-4 PromptCacheManager precedent)"
    - "MiniSearch v7 as the approved engine (fields + storeFields addAll) — first consumer this phase"
    - "Heading-stack breadcrumb chunking (h1 > h2 > h3) with greedy paragraph sub-chunking under INDEX_CHUNK_MAX_TOKENS"

key-files:
  created:
    - src/core/extraction/PageContentCache.ts
    - src/core/extraction/PageIndexBuilder.ts
    - tests/core/extraction/PageContentCache.test.ts
    - tests/core/extraction/PageIndexBuilder.test.ts
  modified: []

key-decisions:
  - "PAGE_CACHE_MAX_TABS = 20 pinned/exported; LRU eviction skips in-flight+subscribed entries entirely, pinned entries eviction-last (any non-pinned evictable candidate wins)"
  - "set() preserves existing pinned/subscribed/inFlight marks on re-upsert — a pin survives re-extraction; marks set via setPinned/setSubscribed/setInFlight hooks"
  - "INDEX_CHUNK_MAX_TOKENS = 500 pinned/exported; sections over budget split into blank-line paragraph sub-chunks inheriting the parent headingPath"
  - "PageChunk ids deterministic `${tabId}:${sectionPath}:${chunkIndex}`; preamble chunk id `${tabId}:(preamble):0`; no-heading fallback id `${tabId}:${title}:${i}`"
  - "MiniSearch index built on demand (pure builder); per-tab memoization + eviction delegated to the 04a-08 service layer (D-4a-15 lazy build)"

patterns-established:
  - "Eviction discipline: recency bumped on every read/serve; invalidate/remove drop the entry (indexHandle lives inside it — cache+index go together)"
  - "Greedy paragraph grouping keeps every sub-chunk under the 500-token budget"

requirements-completed: [CAT-01, CAT-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "PageContentCache — per-tab in-memory LRU-20 cache (D-4a-02/04): deterministic eviction order via injectable clock, invalidate/remove drop, pinned eviction-last, in-flight/subscribed never evicted, marks preserved on re-upsert"
    requirement: CAT-05
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentCache.test.ts#PageContentCache (04a-05 — per-tab LRU + eviction discipline, D-4a-02/04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PageIndexBuilder — ephemeral MiniSearch index over heading-chunked markdown (D-4a-15/16): headingPath breadcrumbs, (preamble) chunk, paragraph-block fallback for no-heading pages, 500-token sub-chunking, deterministic ids, field indexing verified by search"
    requirement: CAT-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageIndexBuilder.test.ts#PageIndexBuilder (04a-05 — heading chunking + (preamble) + headingPath, D-4a-16)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-12
status: complete
---

# Phase 04a: PageContentService (Knowledge Acquisition) — Plan 5 Summary

**Ephemeral per-tab store layer: LRU-20 PageContentCache (pin/in-flight eviction discipline) + MiniSearch PageIndexBuilder (heading-chunked markdown with (preamble) and headingPath breadcrumbs) — both in-memory only, never persisted (§26.5)**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-12T20:19:47Z
- **Completed:** 2026-08-12T20:44:49Z
- **Tasks:** 2 (both TDD — RED+GREEN each, plus one style pass)
- **Files modified:** 4 (2 source, 2 test)

## Accomplishments

- `PageContentCache` (D-4a-02/04): per-tab `Map<number, CacheEntry>` holding `{pageContext, markdown, sourceUsed, indexHandle, recency, pinned, subscribed, inFlight}` — LRU-20 via `PAGE_CACHE_MAX_TABS = 20` exported constant + injectable `now` clock. Recency bumped on every read/serve; `invalidate`/`remove` drop the entry (indexHandle lives inside the entry, so cache+index evict together); in-flight and subscribed tabs are NEVER evicted; pinned tabs eviction-last.
- `PageIndexBuilder` (D-4a-15/16): `chunkMarkdown()` splits markdown at atx heading boundaries (h1-h6), builds `headingPath` breadcrumbs from the heading stack ('A > B > C'), emits a synthetic `(preamble)` chunk for pre-first-heading text, falls back to blank-line paragraph blocks under the page title when no headings exist, and sub-chunks sections over `INDEX_CHUNK_MAX_TOKENS = 500` (via the shared `estimateTokens` counter) into paragraph sub-chunks inheriting the same headingPath. `buildPageIndex()` wraps MiniSearch v7 (fields + storeFields). Ids are deterministic `${tabId}:${sectionPath}:${chunkIndex}`.
- Both §18-required test files green: cache-level LRU smoke (9 tests) + fixture-driven chunking/index suite (5 tests) driving the shared golden fixtures (D-4a-24) through the single turndown converter (A6 parity guard).

## Task Commits

Each task was committed atomically (TDD RED → GREEN per task):

1. **Task 1: PageContentCache — per-tab LRU + eviction discipline** — `324ec92` (test, RED) + `5fdc890` (feat, GREEN)
2. **Task 2: PageIndexBuilder — heading chunking + (preamble) + headingPath** — `1f4a63d` (test, RED) + `053b2eb` (feat, GREEN)
3. **Style pass (phase gate prettier --check .)** — `122a394` (style)

**Plan metadata:** pending (final docs commit)

## Files Created/Modified

- `src/core/extraction/PageContentCache.ts` - Per-tab LRU-20 cache: set/get/invalidate/remove/setPinned/setSubscribed/setInFlight/clear; D-4a-04 eviction discipline; injectable clock; type-only MiniSearch handle (dependency-free)
- `src/core/extraction/PageIndexBuilder.ts` - Heading-chunked ephemeral MiniSearch index: chunkMarkdown + buildPageIndex + PageChunk interface
- `tests/core/extraction/PageContentCache.test.ts` - 9 cache-level smoke tests (LRU order, recency bump, invalidate, pinned eviction-last, in-flight/subscribed protection, mark preservation, clear); full service-driven suite deferred to 04a-08 by design
- `tests/core/extraction/PageIndexBuilder.test.ts` - 5 fixture-driven chunking/index tests (breadcrumbs+sub-chunks, no-heading fallback, MiniSearch keyword search, deterministic ids)

## Decisions Made

- **Eviction ordering:** in-flight/subscribed are excluded from candidates entirely; pinned entries are only evicted when no non-pinned evictable entry remains — "eviction-last" rather than "never" (matches D-4a-04: a user-chosen pin never silently loses its cache while alternatives exist).
- **Marks preserved on re-upsert:** `set()` keeps existing pinned/subscribed/inFlight flags, so a re-extraction upsert does not silently drop a pin (the service drives the marks via the primitive hooks).
- **Sub-chunk granularity:** blank-line paragraph blocks, greedily grouped so each sub-chunk stays ≤ INDEX_CHUNK_MAX_TOKENS — paragraph-level split per D-4a-16, never mid-paragraph.
- **Cache holds the value/recency; service owns the promise map:** the cache exposes `setInFlight(tabId, promise)` as the D-4a-03 primitive; the stale-safe read (await-in-flight) is delegated to the 04a-08 service per plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's `<verify>` command flag `-x` is unknown in vitest 4.1.10**
- **Found during:** Task 1 verification (and all plan-level verifications)
- **Issue:** The plan's automated verify commands (`pnpm vitest run tests/core/extraction/PageContentCache.test.ts -x`) hard-fail with `CACError: Unknown option '-x'` — vitest 4.1.10 has no `-x` bail shorthand (`--bail <number>` is the supported flag).
- **Fix:** Ran the equivalent `--bail=1` (stop on first failure) for every invocation of the plan's verify commands.
- **Files modified:** none (command-line substitution only)
- **Verification:** All 14 plan tests + full suite (639 tests / 72 files) green.
- **Committed in:** N/A (verification-only; not a source change)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Command-line only — same stop-on-first-failure semantics; no behavioral impact. All plan success criteria met.

## Issues Encountered

- Prettier normalization pass required after implementation (3 files) to satisfy the phase-gate `prettier --check .` — routine, committed as `122a394`.
- `.planning/config.json` shows an uncommitted modification and `04a-PATTERNS.md` is untracked — both pre-existing before this plan started (not part of 04a-05's file set); left untouched per scope boundary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The ephemeral store layer (cache + index builder) is ready for the 04a-08 `PageContentService` orchestrator to consume: `PageContentCache.set/get/invalidate` + the mark hooks, and `PageIndexBuilder.chunkMarkdown/buildPageIndex` for lazy per-tab index build.
- The full cap/order/pin integration suite (service-driven, incl. `get(tabId, {allowStale: false})` promise-map semantics) is deliberately deferred to 04a-08 — the cache-level smoke proves the primitives; the service plan owns the coalescing/stale-safe read assertions.
- D-4a-04's "drop cache AND index together" is structurally guaranteed (indexHandle lives inside CacheEntry) but the service-level `tabs.onRemoved`/SPA-nav wiring lands with 04a-08/09.

## Self-Check: PASSED

- `src/core/extraction/PageContentCache.ts` — FOUND
- `src/core/extraction/PageIndexBuilder.ts` — FOUND
- `tests/core/extraction/PageContentCache.test.ts` — FOUND
- `tests/core/extraction/PageIndexBuilder.test.ts` — FOUND
- Commits `324ec92` (test), `5fdc890` (feat), `1f4a63d` (test), `053b2eb` (feat), `122a394` (style) — all FOUND in git log
- Full suite: 639 tests / 72 files green; tsc --noEmit green; prettier --check green on new files; eslint green

## Threat Flags

None — no new security-relevant surface beyond the plan's `<threat_model>`. T-4a-13 (redaction-before-index, delegated to 04a-08 ordering), T-4a-14 (eviction drops cache+index together, pinned eviction-last), T-4a-15 (PAGE_CACHE_MAX_TABS=20 hard cap) all implemented per mitigation plan. No storage/network/chrome imports in either source file.

---
*Phase: 04a-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-12*
