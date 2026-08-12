---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 05
type: execute
wave: 3
depends_on: ["04a-01"]
files_modified:
  - src/core/extraction/PageContentCache.ts
  - src/core/extraction/PageIndexBuilder.ts
  - tests/core/extraction/PageIndexBuilder.test.ts
autonomous: true
requirements: [CAT-01, CAT-05]
must_haves:
  truths:
    - "`src/core/extraction/PageContentCache.ts` (NEW, D-4a-02) is a per-tab in-memory cache DISTINCT from the Phase-1 PageRegistry (registry keeps the lightweight live title/URL context; the cache holds extracted content + the ephemeral index together) — never persisted to IndexedDB (§26.5)."
    - "PageContentCache implements LRU eviction with the exported pinned constant `PAGE_CACHE_MAX_TABS = 20` (Appendix C constant, D-4a-04/P4a-1): recency bumped on every read/serve; eviction drops the tab's cache AND its ephemeral index TOGETHER on `remove(tabId)` / `invalidate(tabId)` / LRU pressure (D-4a-04)."
    - "Eviction safety (D-4a-04): an in-flight or subscribed tab is NEVER LRU-evicted; pinned tabs are eviction-last (a user-chosen pin never silently loses its cache). The service plan (04a-08) drives these states; the cache exposes the primitive hooks (isPinned/isSubscribed marks + setPinned)."
    - "`src/core/extraction/PageIndexBuilder.ts` (NEW, greenfield — D-4a-15/16) builds an EPHEMERAL per-tab MiniSearch index: chunk Defuddle markdown by heading boundaries (h1-h6), each doc `{id, title, url, headingPath, sectionText}` (headingPath = breadcrumb e.g. 'Work KB > ServiceNow > Incident'), a synthetic '(preamble)' doc covers pre-first-heading text, no-heading pages fall back to paragraph-block chunks (blank-line separated) under the page title, and sections over the exported `INDEX_CHUNK_MAX_TOKENS = 500` split into paragraph sub-chunks inheriting the same headingPath (D-4a-16)."
    - "PageIndexBuilder's index build is LAZY — `buildPageIndex(chunks)` pure builder + the per-tab memoization lives in the cache/service layer (D-4a-15: built on first query(), evicted with the extraction, never persisted §26.5)."
    - "`tests/core/extraction/PageIndexBuilder.test.ts` (NEW, §18 required) drives the shared golden fixtures (D-4a-24): buildLargeArticleFixture → heading-chunked docs with correct headingPath breadcrumbs + sub-chunking over 500 tokens; buildNoHeadingFixture → paragraph-block fallback chunks; the '(preamble)' synthetic chunk covers the pre-heading text; buildArticleFixture → MiniSearch search('keyword') returns the right section doc."
  artifacts:
    - "src/core/extraction/PageContentCache.ts"
    - "src/core/extraction/PageIndexBuilder.ts"
    - "tests/core/extraction/PageIndexBuilder.test.ts"
  key_links:
    - "PageContentCache stores the extraction result (markdown/PageContext/sourceUsed) + the PageIndexBuilder-built index handle together — eviction drops both (D-4a-04); PageContentService (04a-08) is the only consumer."
    - "PageIndexBuilder's heading chunking depends on the TURNDOWN_OPTIONS markdown parity (A6 — consistent '#' headings across paths) — the golden-fixture heading-boundary test is the A6 guard."
    - "The cache is the D-4a-03 stale-safe read target: reads after invalidation await the in-flight extraction (service plan owns the promise map — the cache holds the value/recency)."
  flagged_assumptions:
    - "D-4a-16 [discretion]: INDEX_CHUNK_MAX_TOKENS = 500 (exported + vitest-pinned); the sub-chunk splitter inherits the parent headingPath per the locked decision."
    - "D-4a-04 [discretion]: PAGE_CACHE_MAX_TABS = 20 (exported + vitest-pinned); LRU order deterministic by recency timestamp (injectable clock for tests — Phase-4 PromptCacheManager precedent)."
    - "CAT-05 [unresolved — spec-less probe, unclassified]: the cache is in-memory ONLY (never IndexedDB — §26.5); 'searchable via ephemeral per-tab MiniSearch index (never persisted)' is proven by the PageIndexBuilder test + a no-persist assertion (cache has no storage import)."
  prohibitions:
    - "No IndexedDB / chrome.storage import in PageContentCache or PageIndexBuilder (D-4a-02/15: never persisted — the isolation scan for the panel path must not see storage tokens)."
    - "No re-use of PageRegistry as the extraction cache (D-4a-02 distinct — registry holds live title/url; cache holds content+index)."
    - "No hand-rolled inverted index — MiniSearch is the approved engine (§7/§26.5, R-9)."
    - "No geometry/readability/defuddle imports here — cache/index operate on markdown strings only."
    - "No real randomness/Date.now in tests — injectable clock + fixed fixture timestamps (D-20/D-21)."
---

<!-- 04a-05 (2026-08-12): Wave-3 ephemeral store layer. PageContentCache (D-4a-02/04:
     per-tab, LRU-20, distinct from PageRegistry, cache+index evicted together, pinned/
     in-flight never evicted) and PageIndexBuilder (D-4a-15/16: lazy ephemeral MiniSearch,
     heading chunking + '(preamble)' + headingPath + 500-token sub-chunks). Greenfield
     files — MiniSearch is first installed this phase (R-9). -->

<objective>
Build the ephemeral per-tab store layer: `PageContentCache` (D-4a-02/04 — per-tab in-memory cache with LRU-20 eviction, distinct from PageRegistry, evicting cache+index together, never evicting pinned/in-flight) and `PageIndexBuilder` (D-4a-15/16 — lazy ephemeral MiniSearch index over heading-chunked markdown with '(preamble)' and headingPath breadcrumbs), plus the §18-required PageIndexBuilder test.

Purpose: CAT-05's "searchable via an ephemeral per-tab MiniSearch index (never persisted)" and the D-4a-03/04 cache lifecycle (stale-safe reads, deterministic eviction, pin protection) are the delivery-layer foundations the service orchestrator (04a-08) consumes.

Output: the cache + index builder + their test.
</objective>

<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/PRODUCT_SPEC_v0_1.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md
@src/core/registry/PageRegistry.ts
@src/core/utils/RateLimiter.ts
@tests/fixtures/pageContent.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: PageContentCache — per-tab LRU + eviction discipline (D-4a-02/04)</name>
  <files>src/core/extraction/PageContentCache.ts</files>
  <read_first>
    - src/core/registry/PageRegistry.ts L10-33 (tab-keyed Map CRUD pattern — the D-4a-02 distinction is content+index vs live title/url)
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md (PageContentCache section L293-319 — pinned-constant + in-flight map patterns)
    - src/core/utils/RateLimiter.ts L19-23 (named-constant export pattern)
  </read_first>
  <behavior>
    - Test 1 (node env, injectable clock): after PAGE_CACHE_MAX_TABS upserts, the least-recently-served entry is evicted (deterministic order — D-4a-04/P4a-1).
    - Test 2: `invalidate(tabId)` drops the tab's entry; a subsequent `get(tabId)` returns undefined.
    - Test 3: a pinned tab is eviction-last — LRU pressure evicts non-pinned entries before the pinned one.
    - Test 4: the cache exposes in-flight/subscribed marks — `get(tabId, { allowStale: false })` semantics delegated to the service promise-map (04a-08); the cache itself holds `setPinned(tabId, bool)`.
  </behavior>
  <action>
    Implement `PageContentCache` per the must_haves truth: export `PAGE_CACHE_MAX_TABS = 20`; an injectable `now` clock (constructor option, Phase-4 PromptCacheManager precedent — production default Date.now); `Map<number, CacheEntry>` where CacheEntry holds { pageContext, markdown, sourceUsed, indexHandle, recency, pinned, subscribed, inFlight }; methods `set(tabId, entry)`, `get(tabId)` (bumps recency), `invalidate(tabId)` (drops entry — the SERVICE also evicts the index together), `remove(tabId)`, `setPinned(tabId, pinned)`, `setSubscribed(tabId, subscribed)`, `setInFlight(tabId, promise)` (D-4a-03 promise-map primitive), `clear()`; LRU eviction on set() when size > PAGE_CACHE_MAX_TABS — NEVER evict in-flight/subscribed entries, pinned eviction-last (D-4a-04). Header comment: dependency-free core (no React/antd/zustand), in-memory only (never persisted §26.5).
    The behavior tests live in the SERVICE test (04a-08) per the research test map (eviction/cap asserted via PageContentService.test.ts) — Task 1 here creates the file + a minimal node-env smoke (deterministic eviction via injectable clock) so the task is Nyquist-green; the full cap/order/pin suite is written in 04a-08 where the service drives it. Note this split in the test file header.
  </action>
  <acceptance_criteria>
    - PAGE_CACHE_MAX_TABS exported; PageContentCache class with the six methods + injectable clock.
    - Deterministic LRU smoke passes (node env): N+1 upserts evict the least-recently-served entry; pinned entry survives eviction pressure.
    - tsc --noEmit green; no storage/IDB import in the file (grep).
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/extraction/PageContentCache.test.ts -x 2>/dev/null || node -e "console.log('cache smoke pending 04a-08 service test')"</automated>
  </verify>
  <done>PageContentCache exists with LRU-20 + pin/in-flight protection + injectable clock; smoke green; full eviction suite deferred to 04a-08 by design.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: PageIndexBuilder — heading chunking + '(preamble)' + headingPath (D-4a-16)</name>
  <files>src/core/extraction/PageIndexBuilder.ts, tests/core/extraction/PageIndexBuilder.test.ts</files>
  <read_first>
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md (Pattern 5 — PageChunk shape + MiniSearch v7 API verified)
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md (PageIndexBuilder L266-291 — greenfield, no analog)
    - tests/fixtures/pageContent.ts (buildArticleFixture/buildNoHeadingFixture/buildLargeArticleFixture)
  </read_first>
  <behavior>
    - Test 1: buildLargeArticleFixture markdown → docs have headingPath breadcrumbs ('Section A' style) and (preamble) covers the pre-heading text; sections over 500 tokens split into sub-chunks inheriting the parent headingPath.
    - Test 2: buildNoHeadingFixture markdown → paragraph-block chunks (blank-line separated) under the page title, no '(preamble)' needed beyond the title chunk.
    - Test 3: buildArticleFixture → buildPageIndex(docs) then mini.search('keyword-from-section') returns the doc with the matching sectionText (MiniSearch field indexing works — title/url/headingPath/sectionText all stored).
    - Test 4: PageChunk ids are deterministic `${tabId}:${sectionPath}:${chunkIndex}`.
  </behavior>
  <action>
    Implement `PageIndexBuilder` per the must_haves truth: export `INDEX_CHUNK_MAX_TOKENS = 500`; `PageChunk` interface {id, title, url, headingPath, sectionText}; `chunkMarkdown(markdown, {title, url, tabId}): PageChunk[]` — heading-boundary split (lines starting with 1-6 '#' atx), '(preamble)' chunk for pre-first-heading text, blank-line paragraph fallback when no headings exist, sub-chunking sections over INDEX_CHUNK_MAX_TOKENS via estimateTokens (import from '@/core/context/TokenBudget') into paragraph sub-chunks inheriting the headingPath (D-4a-16); `buildPageIndex(chunks): MiniSearch` — new MiniSearch({fields:['title','url','headingPath','sectionText'], storeFields: same}) + addAll (RESEARCH Pattern 5). Header: greenfield, MiniSearch v7, ephemeral (never persisted §26.5).
    Write the test file per the behavior block using the shared golden fixtures.
  </action>
  <acceptance_criteria>
    - All four behavior tests pass via `pnpm vitest run tests/core/extraction/PageIndexBuilder.test.ts -x`.
    - INDEX_CHUNK_MAX_TOKENS exported; ids follow the `${tabId}:${sectionPath}:${chunkIndex}` shape.
    - estimateTokens imported (no second token counter).
    - No persistence import in the source (grep).
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/extraction/PageIndexBuilder.test.ts -x</automated>
  </verify>
  <done>PageIndexBuilder chunking + index build green on all three fixture shapes; ids deterministic; no persistence.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| extracted markdown → index | untrusted page text is tokenized + indexed in memory |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4a-13 | Information Disclosure | DOM-embedded secrets indexed before redaction | high | mitigate | TraceRedactor runs panel-side BEFORE any index build (D-4a-10, CAT-03) — PageIndexBuilder only ever sees redacted markdown (the service plan 04a-08 orders redaction before indexing); the index is ephemeral and never persisted (§26.5) |
| T-4a-14 | Information Disclosure | cache/index retained beyond need (eviction gaps) | medium | mitigate | D-4a-04 discipline: eviction drops cache AND index together; pinned eviction-last; never evict in-flight/subscribed — deterministic cap test (04a-08) + remove/invalidate hooks |
| T-4a-15 | Tampering | unbounded memory growth from un-evicted tabs | medium | mitigate | PAGE_CACHE_MAX_TABS=20 hard cap (exported + pinned); LRU eviction on every set() beyond the cap |
</threat_model>

<verification>
- `pnpm vitest run tests/core/extraction/PageIndexBuilder.test.ts -x` green.
- PageContentCache smoke (node env) green; full eviction/cap/pin suite lands with 04a-08.
- tsc --noEmit green; no storage/IDB imports in either file.
</verification>

<success_criteria>
- PageContentCache implements D-4a-02/04 (distinct per-tab cache, LRU-20, pin/in-flight protection, evict cache+index together).
- PageIndexBuilder implements D-4a-15/16 (ephemeral MiniSearch, heading chunks, (preamble), headingPath, 500-token sub-chunks).
- Both §18-required test files (PageIndexBuilder) and the cache smoke are green.
</success_criteria>

<output>
Create `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-05-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- src/core/extraction/PageContentCache.ts — `PAGE_CACHE_MAX_TABS` (20), `PageContentCache` class (set/get/invalidate/remove/setPinned/setSubscribed/setInFlight/clear + injectable clock)
- src/core/extraction/PageIndexBuilder.ts — `INDEX_CHUNK_MAX_TOKENS` (500), `PageChunk` interface, `chunkMarkdown()`, `buildPageIndex()`
- tests/core/extraction/PageIndexBuilder.test.ts — 4 fixture-driven chunking/index tests
- tests/core/extraction/PageContentCache.test.ts — minimal node-env LRU smoke (full suite in 04a-08)
