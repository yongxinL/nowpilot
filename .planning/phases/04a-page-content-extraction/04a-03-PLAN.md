---
phase: 04a-page-content-extraction
plan: 03
type: execute
wave: 3
depends_on: [04a-02]
files_modified:
  - src/core/extraction/PageIndexBuilder.ts
  - src/core/extraction/PageContentService.ts
  - tests/core/extraction/PageIndexBuilder.test.ts
autonomous: true
requirements: [PAGE-01]
must_haves:
  truths:
    - "PageIndexBuilder creates ephemeral per-tab MiniSearch instance over extracted content with heading-aware chunking and BM25 ranking — index never persisted to IndexedDB or chrome.storage (D-14)"
    - "Extracted markdown is chunked by heading hierarchy (h1→h2→h3 breadcrumb path); each chunk carries headingPath metadata with 'preamble' path for content before the first heading"
    - "selectRelevant(query, budget) performs BM25 retrieval with heading-aware field boosting (headingText: 2.0×, headingPath: 1.5×); returns top-K chunks within token budget"
    - "PageContentService integrates index building: after successful extraction, PageContext feeds PageIndexBuilder.buildFromText(mode, content) automatically"
    - "SPA_NAVIGATION event triggers index cleanup for the tab: PageIndexBuilder.removeTab(tabId) called before cache invalidation; old chunks never accumulate across navigations (Pitfall 5)"
    - "Tab close (via tabs.onRemoved or cleanup hook) destroys the per-tab MiniSearch index — memory released, data never persisted (D-14)"
    - "MiniSearch field boosting on headingText (2.0) and headingPath (1.5) sufficiently implements D-15 heading-aware scoring; boost weights are reasonable defaults per the agent's discretion"
  artifacts:
    - src/core/extraction/PageIndexBuilder.ts
    - tests/core/extraction/PageIndexBuilder.test.ts
  key_links:
    - "PageContentService.extract() → PageContext → PageIndexBuilder.buildFromText(tabId, mode, content) → MiniSearch index populated"
    - "SPA_NAVIGATION → PageIndexBuilder.removeTab(tabId) → PageContentCache.invalidate(tabId) — index cleanup BEFORE cache invalidation"
    - "tabs.onRemoved → PageIndexBuilder.removeTab(tabId) — index destroyed on tab close"
    - "ContextOptimizer (future consumer) → PageIndexBuilder.selectRelevant(query, budget) → top-K chunks within token budget → injected as pageContext with compressionApplied: 'topk'"
---

<objective>
Build the ephemeral per-tab MiniSearch page index — heading-aware chunking, BM25 ranking with field boosting, and integration with the extraction pipeline for automatic index population and SPA-nav/tab-close cleanup.

Purpose: The extraction pipeline produces PageContext but doesn't yet index it for selective retrieval. This plan adds the PageIndexBuilder so consumers (ContextOptimizer in Phase 4, future MCP tools in Phase 8) can retrieve relevant chunks within a token budget via `selectRelevant(query, budget)`.

Output: PageIndexBuilder class with MiniSearch instance, buildFromText/selectRelevant/removeTab methods, and integration into PageContentService's extraction flow; full test coverage.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/04a-page-content-extraction/04a-CONTEXT.md (D-14 ephemeral, D-15 heading-aware chunks, D-16 budget in ContextOptimizer)
@.planning/phases/04a-page-content-extraction/04a-RESEARCH.md (lines 431–495: MiniSearch patterns, Pitfall 5: unbounded index)
@.planning/phases/04a-page-content-extraction/04a-PATTERNS.md (lines 343–367: PageIndexBuilder analog from PromptCacheManager)
@src/core/extraction/PageContentService.ts (from Plans 04a-01/02 — extract method; needs index integration)
@src/core/extraction/PageContentCache.ts (from Plan 04a-01 — invalidate method)
@src/core/extraction/types.ts (PageContext, BaseMetadata — fields consumed by index)
</context>

<tasks>

<task type="auto">
  <name>Task 1: PageIndexBuilder — MiniSearch with Heading-Aware Chunking and BM25 Retrieval</name>
  <files>
    src/core/extraction/PageIndexBuilder.ts,
    tests/core/extraction/PageIndexBuilder.test.ts
  </files>
  <action>
    **Create PageIndexBuilder** in `src/core/extraction/PageIndexBuilder.ts` (per D-14, D-15; analog: `src/core/context/PromptCacheManager.ts` — in-memory service with internal state):

    - Import `MiniSearch` from `minisearch` (extension-page bundle only)
    - Define `IndexedChunk` interface: `{ id: string; tabId: number; headingPath: string; chunkText: string; headingText: string }`
    - Class with internal `index: MiniSearch<IndexedChunk>` and `tabChunkIds: Map<number, Set<string>>` (secondary index for fast tab-scoped removal)

    - Constructor: initialize `MiniSearch` with config:
      - `fields: ['chunkText', 'headingText', 'headingPath']`
      - `storeFields: ['tabId', 'headingPath', 'chunkText', 'headingText']`
      - `searchOptions: { boost: { headingText: 2.0, headingPath: 1.5 }, prefix: true }` (D-15: heading-aware boost; weights are reasonable defaults per the agent's discretion — headingText gets highest boost for direct heading-match relevance)

    - **`buildFromText(tabId: number, mode: ExtractionMode, content: string): void`** (for mode='default'):
      - First call `removeTab(tabId)` to clear stale entries (Pitfall 5: never append without clearing)
      - Split markdown by heading hierarchy using regex: `/^(#{1,6})\s+(.+)$/gm` to detect headings
      - Chunk content between headings: each heading starts a new chunk with breadcrumb path
      - Heading breadcrumb: maintain a stack of heading levels — when encountering h3 after h2, breadcrumb = "h2 text → h3 text"
      - Leading content before first heading → headingPath = `"(preamble)"`, headingText = `"(preamble)"` (RESEARCH.md Open Question 3: lower boost for preamble; it gets same boost config but headingPath/headingText are literal strings so preamble chunks score lower naturally)
      - Assign IDs: `${tabId}-${chunkIndex}`; add to MiniSearch via `this.index.addAll()`
      - Track chunk IDs in `tabChunkIds` Map for fast removal

    - **`buildFromTree(tabId: number, tree: APCLiteNode): void`** (for mode='actionable'):
      - Flatten APCLiteNode tree into text chunks — extract `name`, `role`, and `attributes` as searchable text
      - Each node becomes an IndexedChunk with headingPath = `node.role` breadcrumb
      - Add to MiniSearch; track in tabChunkIds

    - **`selectRelevant(query: string, budget: number): IndexedChunk[]`** (D-15):
      - Run `this.index.search(query)` — BM25 ranking with heading boost already configured
      - Greedily take chunks in score-descending order until cumulative `chunkText.length` reaches `budget` tokens (using simple char-count estimate: ~4 chars/token as a rough approximation — PageContentService doesn't need CJK-aware token estimation; ContextOptimizer does that downstream per D-16)
      - Return top-K chunks as `IndexedChunk[]`

    - **`removeTab(tabId: number): void`**:
      - Get chunk IDs from `tabChunkIds.get(tabId)`
      - For each ID: `this.index.removeById(id)`
      - Delete tabChunkIds entry
      - This is called: before re-indexing (SPA nav), on tab close

    - Export as class + module-level singleton: `export const pageIndexBuilder = new PageIndexBuilder()`

    **Write PageIndexBuilder tests** in `tests/core/extraction/PageIndexBuilder.test.ts` (analog: `tests/core/context/PromptCacheManager.test.ts` — in-memory service):

    - Test: `buildFromText` with markdown containing h1/h2/h3 → verify chunks created with correct headingPath breadcrumbs (e.g., "Introduction → Overview → Details")
    - Test: `buildFromText` with content before first heading → preamble chunk with headingPath = "(preamble)"
    - Test: `removeTab` → all chunks for tabId removed; `selectRelevant` returns empty for that tab
    - Test: second `buildFromText` on same tabId → old chunks cleared first (verify via chunk count)
    - Test: `selectRelevant(query, budget)` → returns chunks matching query; heading-matched chunks rank higher
    - Test: `selectRelevant` respects budget → total chunkText length ≤ budget * 4
    - Test: `buildFromTree` with APCLiteNode fixture → flattened chunks with role-based heading paths
    - Test: multiple tabs → chunks isolated per tabId; removing one tab doesn't affect others

    Use dynamic `import()` for the module under test. No mocks needed — MiniSearch is in-memory and fast. Use real markdown fixtures.
  </action>
  <read_first>
    - npmjs.com/package/minisearch — MiniSearch constructor options (fields, storeFields, searchOptions.boost, prefix)
    - src/core/context/PromptCacheManager.ts — in-memory Map-based service + module-level singleton pattern
    - .planning/phases/04a-page-content-extraction/04a-RESEARCH.md lines 468–485 (PageIndexBuilder code example with MiniSearch config + selectRelevant)
    - .planning/phases/04a-page-content-extraction/04a-RESEARCH.md lines 561–569 (Pitfall 5: unbounded index — must clear before re-indexing)
    - src/core/extraction/types.ts (ExtractionMode, APCLiteNode reference)
  </read_first>
  <verify>
    <automated>pnpm exec vitest run tests/core/extraction/PageIndexBuilder.test.ts</automated>
  </verify>
  <done>
    PageIndexBuilder created with MiniSearch instance configured for heading-aware BM25.
    buildFromText chunks markdown by heading hierarchy with breadcrumb paths; preamble content before first heading uses "(preamble)" path.
    selectRelevant(query, budget) returns top-K chunks within budget via BM25 + heading boost.
    removeTab(tabId) clears all chunks for tab; second buildFromText on same tab clears old entries first (Pitfall 5 fixed).
    buildFromTree flattens APCLiteNode tree into indexed chunks.
    Multiple tabs isolated — removing one tab doesn't affect others.
    Module-level singleton exported: pageIndexBuilder.
    All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: PageContentService Index Integration + SPA-nav/Tab-close Cleanup Wiring</name>
  <files>
    src/core/extraction/PageContentService.ts
  </files>
  <action>
    **Integrate PageIndexBuilder into PageContentService** (modify `src/core/extraction/PageContentService.ts`):

    - Import `pageIndexBuilder` from `./PageIndexBuilder`
    - After successful extraction in `doExtract()` (right after `redactSensitive` call):
      - For mode='default': call `pageIndexBuilder.buildFromText(tabId, 'default', pageContext.markdown)` with the redacted markdown
      - For mode='actionable': call `pageIndexBuilder.buildFromTree(tabId, pageContext.apcLiteTree)` with the APCLiteNode tree
    - **Index before cache**: build the index BEFORE storing in cache — ensures the index is always populated when a cached result is reused (cache hit returns pre-built result, index was already built)
    - **SPA_NAVIGATION cleanup (Pitfall 5)**: in the SPA_NAVIGATION MessageBus handler:
      - FIRST: call `pageIndexBuilder.removeTab(tabId)` — clear old chunk entries
      - SECOND: call `pageContentCache.invalidate(tabId)` — invalidate cache
      - ORDER MATTERS: index cleanup must happen before cache invalidation so the old index entries are gone before the next extraction builds new ones
    - **tabs.onRemoved cleanup (D-14)**: register `chrome.tabs.onRemoved.addListener((tabId) => { pageIndexBuilder.removeTab(tabId); pageContentCache.invalidate(tabId); })` in PageContentService initialization — ensures memory released on tab close, no data persisted
    - **reExtract(tabId)**: update to also call `pageIndexBuilder.removeTab(tabId)` before cache invalidation (consistent cleanup)

    **Index lifecycle summary:**
    - Extraction succeeds → index built → cached
    - Cache hit → index already populated (no rebuild needed)
    - SPA nav → index cleared → cache invalidated → lazy re-extract → index rebuilt
    - Tab close → index destroyed (memory freed)
    - reExtract → index cleared → cache invalidated → next extract rebuilds
  </action>
  <read_first>
    - src/core/extraction/PageContentService.ts (from Plans 04a-01/02 — extract/doExtract/reExtract methods, SPA_NAVIGATION handler)
    - src/core/extraction/PageIndexBuilder.ts (from Task 1 — buildFromText, buildFromTree, removeTab signatures)
  </read_first>
  <verify>
    <automated>pnpm exec vitest run tests/core/extraction/PageContentService.test.ts</automated>
  </verify>
  <done>
    After successful 'default' extraction, pageIndexBuilder.buildFromText called with redacted markdown.
    After successful 'actionable' extraction, pageIndexBuilder.buildFromTree called with APCLiteNode tree.
    Index built BEFORE cache storage — cache hits return results with index already populated.
    SPA_NAVIGATION handler: index cleared (removeTab) before cache invalidation.
    tabs.onRemoved listener: index destroyed (removeTab) + cache invalidated.
    reExtract(tabId): index cleared before cache invalidation.
    Updated PageContentService tests pass with index integration verified.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Extracted text → MiniSearch (in-memory index) | Redacted text enters in-memory search index — must never be persisted to disk |
| MiniSearch instance → Tab lifecycle | Per-tab index must be destroyed on tab close; no stale data retained across sessions |
| SPA navigation → Index rebuild | Old index entries must be fully cleared before new ones are added (Pitfall 5) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04a-10 | Information Disclosure | PageIndexBuilder (index persistence) | high | mitigate | MiniSearch is strictly in-memory; never written to IndexedDB or chrome.storage; `tabs.onRemoved` listener calls `removeTab()` to release memory; no serialization/deserialization API exposed on PageIndexBuilder |
| T-04a-11 | Information Disclosure | PageIndexBuilder (stale data across navigations) | medium | mitigate | SPA_NAVIGATION handler calls `removeTab()` BEFORE `invalidate()` — old index entries cleared before new extraction rebuilds; `buildFromText()` always calls `removeTab()` first as defense-in-depth (Pitfall 5) |
| T-04a-12 | Denial of Service | PageIndexBuilder (unbounded memory growth) | low | mitigate | Per-tab index size bounded by extracted content size (2MB size cap from DomSerializer limits input); tab close destroys index; multiple tabs each have independent bounded indexes |

Note: T-04a-01 through T-04a-09 and T-04a-SC are addressed in prior plans' threat models.
</threat_model>

<verification>
- `vitest run tests/core/extraction/PageIndexBuilder.test.ts` — all pass
- `vitest run tests/core/extraction/PageContentService.test.ts` — all pass (including index integration tests)
- Manual verification: open a page, extract, verify index populated; SPA navigate, verify old index cleared before re-extraction
</verification>

<success_criteria>
1. PageIndexBuilder creates MiniSearch with heading-aware field boosting
2. buildFromText chunks markdown by heading hierarchy with breadcrumb paths
3. selectRelevant(query, budget) returns BM25-ranked, budget-bounded chunks
4. removeTab(tabId) fully clears all chunks for a tab
5. PageContentService auto-builds index after extraction; auto-clears on SPA nav and tab close
6. Index never persisted — in-memory only; destroyed on tab close
7. SPA navigation cleanup happens before cache invalidation (Pitfall 5: no stale chunk accumulation)
</success_criteria>

<output>
Create `.planning/phases/04a-page-content-extraction/04a-03-SUMMARY.md` when done
</output>
