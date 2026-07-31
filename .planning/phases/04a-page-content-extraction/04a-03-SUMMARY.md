---
phase: 04a-page-content-extraction
plan: 03
subsystem: extraction
tags: [minisearch, bm25, heading-chunking, ephemeral-index, page-content]

requires:
  - phase: 04a-page-content-extraction
    provides: Extraction pipeline (Defuddle/Readability/ApcLite strategies), PageContext types, PageContentCache
provides:
  - Ephemeral per-tab MiniSearch page index with heading-aware BM25 retrieval
  - Automatic index population after extraction (PageContentService integration)
  - SPA-nav and tab-close index cleanup lifecycle
affects: [04-context-optimization-pipeline, 08-mcp-tools, page-content]

tech-stack:
  added: []
  patterns:
    - "MiniSearch in-memory BM25 with field boosting for heading-aware relevance"
    - "Per-tab chunk storage with removeAll for immediate index cleanup (not discard)"
    - "Module-level singleton for index builder (pattern: PromptCacheManager analog)"
    - "Index-before-cache ordering: MiniSearch populated before result reaches cache"

key-files:
  created:
    - src/core/extraction/PageIndexBuilder.ts - Heading-aware MiniSearch chunking, BM25 retrieval, tab-scoped lifecycle
    - tests/core/extraction/PageIndexBuilder.test.ts - 19 tests: chunking, breadcrumbs, budget, tab isolation, Pitfall 5
  modified:
    - src/core/extraction/PageContentService.ts - Index integration + SPA-nav/tab-close cleanup wiring
    - tests/core/extraction/PageContentService.test.ts - Added chrome.tabs.onRemoved mock

key-decisions:
  - "Used MiniSearch.removeAll(chunks) over discard(id) for immediate inverted index cleanup — discard defers vacuuming which left stale search results"
  - "Stored full IndexedChunk objects in per-tab Map (not just IDs) to support removeAll's full-document requirement"
  - "Heading breadcrumb includes full hierarchy (h1 → h2 → h3); preamble content before first heading gets '(preamble)' path"
  - "Budget estimation uses ~4 chars/token as rough approximation — CJK-aware token counting deferred to ContextOptimizer (D-16)"

patterns-established:
  - "MiniSearch constructor: fields + storeFields + searchOptions with boost { headingText: 2.0, headingPath: 1.5, prefix: true }"
  - "PageIndexBuilder design: in-memory singleton with tabChunks Map, no persistence, no serialization API"
  - "Lifecycle: index built after extraction (before cache), cleared on SPA nav (before cache invalidation), destroyed on tab close"

requirements-completed: [PAGE-01]

coverage:
  - id: D1
    description: "PageIndexBuilder — MiniSearch with heading-aware chunking, breadcrumb paths, BM25 retrieval with budget"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageIndexBuilder.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "PageContentService index integration — auto-build after extraction, cleanup on SPA-nav and tab-close"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts"
        status: pass
    human_judgment: false

duration: 12 min
completed: 2026-07-31
status: complete
---

# Phase 04a Plan 03: MiniSearch Page Index Summary

**Ephemeral per-tab MiniSearch index with heading-aware BM25 chunking, budget-bounded retrieval, and full extraction-pipeline lifecycle integration**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-31T06:37:43Z
- **Completed:** 2026-07-31T06:50:42Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- PageIndexBuilder creates per-tab MiniSearch instances with heading-aware field boosting (headingText: 2.0×, headingPath: 1.5×) and prefix search
- buildFromText chunks markdown by heading hierarchy — breadcrumb paths like "Introduction → Getting Started → Prerequisites"; preamble content gets "(preamble)" path
- buildFromTree flattens APCLiteNode trees into indexed chunks with role-based breadcrumb paths
- selectRelevant(query, budget) performs BM25 retrieval with greedy budget enforcement (~4 chars/token estimate)
- removeTab(tabId) clears all chunks via MiniSearch.removeAll for immediate inverted index cleanup (Pitfall 5)
- PageContentService auto-builds index after successful extraction — index populated BEFORE cache storage
- SPA_NAVIGATION handler: removeTab before invalidateIfChanged — old index entries cleared before re-extraction
- tabs.onRemoved listener: removeTab + cache.invalidate on tab close — memory released, data never persisted (D-14)
- reExtract(tabId): index cleared before cache invalidation
- 60 extraction tests pass (19 PageIndexBuilder + 21 PageContentService + 20 others)

## Task Commits

1. **Task 1: PageIndexBuilder — MiniSearch with Heading-Aware Chunking and BM25 Retrieval** - `2fe020f` (feat)
2. **Task 2: PageContentService Index Integration + SPA-nav/Tab-close Cleanup Wiring** - `48f7c17` (feat)

## Files Created/Modified

- `src/core/extraction/PageIndexBuilder.ts` — MiniSearch-based page index: IndexedChunk interface, buildFromText/buildFromTree/selectRelevant/removeTab, in-memory singleton, chunkMarkdown and flattenTree helpers
- `tests/core/extraction/PageIndexBuilder.test.ts` — 19 tests covering chunking with breadcrumb paths, preamble handling, tab isolation, budget enforcement, Pitfall 5 re-indexing, APCLite tree flattening, module-level singleton export
- `src/core/extraction/PageContentService.ts` — Added index population in doExtract (after redaction, before cache), SPA nav index cleanup, tabs.onRemoved listener, reExtract index cleanup
- `tests/core/extraction/PageContentService.test.ts` — Added `chrome.tabs.onRemoved` mock to beforeEach

## Decisions Made

- Used `MiniSearch.removeAll(chunks)` over `discard(id)` because `discard` defers inverted index cleanup to the next auto-vacuum cycle — stale search results appeared on the first re-query after removal. `removeAll` with full document objects cleans the inverted index immediately.
- Stored full `IndexedChunk[]` arrays in `tabChunks` Map (not just string IDs) to support `removeAll`'s requirement for full document references. Memory overhead is bounded by per-tab extraction content.
- Heading breadcrumb paths include the full hierarchy (e.g., "Introduction → Getting Started → Prerequisites") — this matches the RESEARCH.md analog and provides the richest navigational context for downstream consumers.
- Replaced the `buildFromMarkdown` method name from the research example with `buildFromText` per the plan's explicit method signature, which takes an `ExtractionMode` parameter for future mode-aware chunking.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MiniSearch.discard() left stale inverted index entries across re-indexing**
- **Found during:** Task 1
- **Issue:** Plan specified `this.index.removeById(id)` but MiniSearch v7 has no `removeById` method. Used `discard(id)` as the closest API match, but `discard` defers cleanup to auto-vacuum — stale entries persisted on the first search after re-indexing.
- **Fix:** Changed to store full `IndexedChunk[]` in `tabChunks` Map and call `this.index.removeAll(chunks)` which performs immediate inverted index cleanup. Updated `tabChunkIds` Set<string> to `tabChunks` Map<number, IndexedChunk[]>.
- **Files modified:** `src/core/extraction/PageIndexBuilder.ts`
- **Verification:** 19 unit tests pass, including "second buildFromText on same tab clears old chunks first (Pitfall 5)" and "chunks are isolated per tabId"
- **Committed in:** `2fe020f` (Task 1 commit)

**2. [Rule 3 - Blocking] Test mock missing chrome.tabs.onRemoved**
- **Found during:** Task 2
- **Issue:** `PageContentService.init()` now registers `chrome.tabs.onRemoved.addListener(...)` but the test mock only had `onUpdated`. Two init-related tests threw `TypeError: Cannot read properties of undefined (reading 'addListener')`.
- **Fix:** Added `onRemoved: { addListener: vi.fn() }` to the `chrome.tabs` mock in `beforeEach`.
- **Files modified:** `tests/core/extraction/PageContentService.test.ts`
- **Verification:** All 21 PageContentService tests pass
- **Committed in:** `48f7c17` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes essential for correctness. No scope creep.

## Issues Encountered

- Test fixture content accidentally contained the same search keywords as the assertions (e.g., "replaced the old one" contained "old" — causing false negatives in remove-tab verification). Fixed by using unique marker keywords (GammaUnique789, DeltaNew999) per test content.

## Threat Model Compliance

All three STRIDE threats from the plan's threat model are mitigated:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-04a-10 (Index persistence) | MiniSearch is strictly in-memory; never written to IndexedDB/chrome.storage; no serialization API on PageIndexBuilder | Mitigated |
| T-04a-11 (Stale data across navigations) | SPA_NAVIGATION calls removeTab() BEFORE invalidate(); buildFromText/buildFromTree always call removeTab() first as defense-in-depth | Mitigated |
| T-04a-12 (Unbounded memory growth) | Per-tab index bounded by extracted content (2MB DomSerializer cap); tab close destroys index; independent per-tab instances | Mitigated |

## Known Stubs

None — all created files are production-ready implementations with full test coverage.

## Next Phase Readiness

- Plan 04a-03 complete — MiniSearch index is ready for Plan 04a-04 (re-extraction + advanced slot tests)
- PageIndexBuilder.selectRelevant() exposes the interface consumed by ContextOptimizer in Phase 4 (budget → top-K chunks)
- SPA-nav + tab-close cleanup is fully integrated — no stale index accumulation across navigations
- All 49 prior plan tests + 19 new tests + modified PageContentService tests pass

---
*Phase: 04a-page-content-extraction*
*Completed: 2026-07-31*
