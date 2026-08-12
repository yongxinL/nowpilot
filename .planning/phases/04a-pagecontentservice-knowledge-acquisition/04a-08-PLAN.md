---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 08
type: execute
wave: 5
depends_on: ["04a-04", "04a-05", "04a-07"]
files_modified:
  - src/core/extraction/PageContentService.ts
  - tests/core/extraction/PageContentService.test.ts
autonomous: true
requirements: [CAT-01, CAT-02, CAT-03, CAT-05]
must_haves:
  truths:
    - "`src/core/extraction/PageContentService.ts` (NEW) exports `extractLayered(input, strategies): Promise<ExtractionOutcome>` — Appendix O.12 VERBATIM adapted per D-4a-22 (PATTERNS L37-72): tries the ordered strategies (Defuddle → Readability — INSIDE DefuddleStrategy — → APC-lite), accepts the first with usable content (markdown.length > 0 || root), records `sourceUsed` + `fallbacksTried`, debugLogs each failed strategy with ERROR_CODES.CONTENT_EXTRACT_FAILED (GR-9 — the canonical key from 04a-02, NEVER the non-canonical O.12 string), and on total failure throws the typed carrier: `code: ERROR_CODES.CONTENT_EXTRACT_FAILED` + `fallbacksTried` (D-4a-19/22)."
    - "PageContentService (the class) implements the D-4a-03 orchestrator: `extract(tabId, mode)` coalesces concurrent extractions per tab (in-flight promise dedup by tabId), threads a SINGLE AbortController with the exported `EXTRACTION_TIMEOUT_MS = 5000` hard cap (§22.1 line 3564 — 5 s), falls back through the layered chain on timeout/failure, and throws typed CONTENT_EXTRACT_FAILED — never a silent empty result (D-4a-03/19)."
    - "Stale-safe reads (D-4a-03): `getContent(tabId)` after invalidation but before re-extract completes AWAITS the in-flight extraction — never returns the stale entry; the per-tab promise map + cache cooperate (PageContentCache.setInFlight primitive from 04a-05)."
    - "Redaction-before-index/log (D-4a-10, CAT-03, R-10): TraceRedactor runs PANEL-SIDE on the extraction result BEFORE any index build / cache write / debugLog persist — the content script never imports it (Appendix G)."
    - "Delivery (D-4a-05/06): extraction results land in PageContentCache + the ephemeral PageIndexBuilder index + `WorkspaceStore.currentPageContext` via the existing primary-writer election (§13 — the primary surface writes, the secondary mirrors via BroadcastBus WORKSPACE_UPDATED; the draft write uses `useWorkspaceStore.getState().update(draft => { draft.currentPageContext = ctx })` — the inert field is never journaled/serialized per D-18/§21.5, matching RESEARCH Q3). The model-facing `ContextOptimizerInput.pageContext` feed stays UNPLUGGED → Phase 4b (D-4a-06)."
    - "Invalidation (D-4a-01/04): the service subscribes to the bridge's navigation signal (SPANavigationWatcher→host→bridge, 04a-07) + chrome.tabs.onUpdated/onRemoved (panel-side listener, R-3 forward-only — background never extracts): subscribed tabs re-extract (coalesced), unsubscribed tabs mark-stale only; onRemoved drops cache + index together."
    - "`tests/core/extraction/PageContentService.test.ts` (NEW, §18 required) proves: the defuddle-success outcome (sourceUsed 'defuddle', fallbacksTried []), the readability-fallback record (boilerplate fixture → sourceUsed 'readability', fallbacksTried ['defuddle'] — D-4a-19), the empty-page fixture → typed CONTENT_EXTRACT_FAILED (CAT-01 empty probe), coalescing (two concurrent same-tab extracts → ONE bridge request), stale-safe read (invalidate → read awaits in-flight, never stale — Pitfall 7), the 5 s timeout → typed CONTENT_EXTRACT_FAILED carrier with fallbacksTried, LRU eviction cap + deterministic order + pinned/in-flight never evicted (P4a-1, D-4a-04), the currentPageContext draft write (D-4a-05), and the redaction assertion (a secret-shaped string in a fixture page is absent from the served content — D-4a-10, CAT-03)."
    - "UI-SPEC covered-row truth (delivery boundary): the ONLY store mutation 4a adds is the currentPageContext inert-field draft write (D-18 — never journaled/serialized); the WorkspacePageSkeleton card (Phase-1 existing, display-only) renders ONLY when `currentPageContext !== undefined` (existing conditional), shows `currentPageContext.title` only via `Typography.Text ellipsis` + tooltip (single-line, never wraps), and its presence is binary (undefined → absent; defined → present) — the 4a delivery path populates the existing card, it does NOT modify the component (UI-SPEC E2 covered rows; no new UI in 4a)."
    - "On extraction failure (typed CONTENT_EXTRACT_FAILED / timeout), the workspace write does NOT occur — the card retains the previous successful context (or stays absent); never a silent-empty or half-styled card (UI-SPEC E2 error row — stale-safe, D-4a-03)."
    - "In-flight extraction is silent by contract: 5 s AbortController cap + per-tab coalescing, no spinner/skeleton/stage indicator anywhere in 4a (UI-SPEC E1 loading row; STR.rich.stageReading is canonical-but-unrendered — Phase 7)."
  artifacts:
    - "src/core/extraction/PageContentService.ts"
    - "tests/core/extraction/PageContentService.test.ts"
  key_links:
    - "extractLayered is O.12 VERBATIM (PATTERNS L37-72) with the D-4a-22 canonical code — the strategies array is injected (ordered: DefuddleStrategy → ApcLiteStrategy; the Readability fallback is INSIDE DefuddleStrategy per PATTERNS L162)."
    - "The service consumes: PageContentCache (04a-05, setInFlight/setPinned/setSubscribed primitives), PageIndexBuilder (04a-05, lazy per-tab index), PageContextBridge.requestExtraction (04a-07, ExtractionPayload), TraceRedactor (existing, R-10), WorkspaceStore (existing, D-4a-05 primary-writer)."
    - "EXTRACTION_TIMEOUT_MS = 5000 is the §22.1 hard cap — the single AbortController threads through the bridge roundtrip (D-4a-03)."
  flagged_assumptions:
    - "CAT-01 [unresolved — spec-less probe, empty]: empty/single-element/null page → all strategies yield nothing → extractLayered throws typed CONTENT_EXTRACT_FAILED (never silent empty — D-4a-19); the empty-fixture test pins it."
    - "CAT-01 [unresolved — spec-less probe, encoding]: PAGE_HTML_MAX_BYTES truncation is string-length based (UTF-16 code units) with element-boundary walk-back — document this in the test; no byte-level custom counting."
    - "CAT-02 [unresolved — spec-less probe, unclassified]: the tabs.onUpdated/onRemoved listener is panel-side (chrome.tabs available in the side panel/standalone contexts); fakeBrowser stubs cover the wiring in tests; the background NEVER extracts (R-3 — forward-only)."
    - "D-4a-05 [discretion]: the primary-writer write is the `update(draft)` inert-field draft (RESEARCH Q3) — currentPageContext is NOT in the D-18 ACTIVE_FIELDS list, so it is never serialized/journaled; the BroadcastBus WORKSPACE_UPDATED mirror carries it to the secondary surface (existing Phase-1 mechanism — no new coordination path)."
    - "CAT-03 [unresolved — spec-less probe, unclassified]: TraceRedactor's redactSensitive + the existing REDACTION_PATTERNS are applied to the markdown/html BEFORE index build — the test asserts the index contains no secret-shaped substring from a fixture page."
  prohibitions:
    - "No silent empty result — total failure throws the typed CONTENT_EXTRACT_FAILED carrier (D-4a-19/22), never returns undefined/empty."
    - "No stale reads — a read after invalidation MUST await the in-flight promise (Pitfall 7, D-4a-03)."
    - "No nested retries/timeouts — ONE AbortController + ONE 5 s cap per round-trip (R-2, §22.1)."
    - "No model-facing feed — ContextOptimizerInput.pageContext stays unplugged (D-4a-06 — Phase 4b owns it)."
    - "No TraceRedactor import content-side (D-4a-10 — panel-side only, Appendix G)."
    - "No persistence of the cache or index (D-4a-02/15 — never IndexedDB)."
    - "No re-implementation of primary-writer election — the existing §13/Phase-1 mechanism is reused (D-4a-05)."
---

<!-- 04a-08 (2026-08-12): Wave-5 orchestrator. PageContentService = O.12 extractLayered
     (adapted per D-4a-22: canonical CONTENT_EXTRACT_FAILED) wrapped by the D-4a-03
     coalescing + 5 s single-AbortController round-trip + stale-safe reads + D-4a-04
     eviction orchestration + D-4a-10 redaction-before-index + D-4a-05 primary-writer
     currentPageContext delivery. The model feed stays unplugged (D-4a-06). The
     test file carries the cap/order/eviction suite (P4a-1) per the research test map. -->

<objective>
Build the extraction orchestrator: `extractLayered` (Appendix O.12 verbatim, D-4a-22 canonical code) and the `PageContentService` class implementing D-4a-03 coalescing + 5 s single-AbortController cap + stale-safe reads, D-4a-04 eviction orchestration, D-4a-10 redaction-before-index, D-4a-05 primary-writer currentPageContext delivery, and D-4a-01 invalidation wiring — plus the §18-required service test (defuddle-success, fallback record, empty-typed failure, coalescing, timeout, eviction cap/order, currentPageContext write, redaction).

Purpose: CAT-01/02/03/05 converge here — the service is the single extraction owner for every surface (Chat/Summarize/agent/add-ons, §26.1), delivering to cache + bridge + workspace + ephemeral index only (D-4a-06), never silent, never stale, never persisted.

Output: PageContentService + its test.
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
@src/core/extraction/strategies/IExtractionStrategy.ts
@src/core/extraction/strategies/DefuddleStrategy.ts
@src/core/extraction/strategies/ApcLiteStrategy.ts
@src/core/extraction/PageContentCache.ts
@src/core/extraction/PageIndexBuilder.ts
@src/core/content/PageContextBridge.ts
@src/core/error/debugLog.ts
@src/core/error/errorCodes.ts
@src/core/security/TraceRedactor.ts
@src/core/workspace/WorkspaceStore.ts
@tests/fixtures/pageContent.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: extractLayered (O.12 verbatim, D-4a-22) + PageContentService class + the §18 orchestrator suite (P4a-1, D-4a-04)</name>
  <files>src/core/extraction/PageContentService.ts, tests/core/extraction/PageContentService.test.ts</files>
  <read_first>
    - .planning/PRODUCT_SPEC_v0_1.md Appendix O.12 L6736-6768 (the verbatim extractLayered to adapt) + §20.7 TabExtractionState (L3262-3270 — the state vocabulary)
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md (PageContentService section L33-115 — O.12 pattern + typed-error carrier + timeout pattern from StructuredOutput L79-118)
    - src/core/ai/StructuredOutput.ts L79-118 (typed-error carrier + AbortController precedent)
    - src/core/security/TraceRedactor.ts (redactSensitive — the panel-side redaction seam)
    - src/core/workspace/WorkspaceStore.ts (update(draft) — the D-18 inert-field write path, RESEARCH Q3)
    - tests/core/ai/StructuredOutput.timeoutRetry.test.ts (timeout/abort test pattern)
    - tests/core/content/ContentScriptHost.test.ts L27-30 (flushRuntime pattern)
    - tests/fixtures/pageContent.ts (buildArticleFixture, buildBoilerplateFixture, buildEmptyPageFixture — ADD the empty-page fixture to tests/fixtures/pageContent.ts if absent (04a-02 extension — the fixtures module is owned by 04a-02), per D-4a-24 shared-guard)
  </read_first>
  <behavior>
    - Test 1: extractLayered with a Defuddle-success fixture → ExtractionOutcome {sourceUsed: 'defuddle', fallbacksTried: []}.
    - Test 2: a fixture that fails Defuddle's threshold → the Readability fallback inside DefuddleStrategy wins → sourceUsed 'readability', fallbacksTried ['defuddle'] (D-4a-19 record).
    - Test 3: a totally-empty page → extractLayered throws an error whose code === ERROR_CODES.CONTENT_EXTRACT_FAILED with fallbacksTried populated (D-4a-19/22 — never silent empty).
    - Test 4 (class): two concurrent extract(tabId) calls → ONE bridge request (coalesced per tab, D-4a-03).
    - Test 5: invalidate(tabId) then getContent(tabId) → awaits the in-flight extraction, never returns stale (Pitfall 7).
    - Test 6: a bridge request that never resolves → after EXTRACTION_TIMEOUT_MS the typed CONTENT_EXTRACT_FAILED carrier surfaces (5 s hard cap, §22.1; injected short timeout for the test — D-4a-03).
    - Test 7 (eviction, P4a-1): PAGE_CACHE_MAX_TABS+1 extractions → least-recently-served evicted; pinned + in-flight never evicted; deterministic order (D-4a-04; injectable clock).
    - Test 8 (delivery): a successful extraction writes currentPageContext via the store draft (D-4a-05 primary-writer).
    - Test 9 (redaction): a fixture page containing a secret-shaped string (e.g. 'JSESSIONID=abc') → the index/cache does NOT contain it after extraction (D-4a-10, CAT-03).
  </behavior>
  <action>
    Implement per the must_haves truths:
    1) `extractLayered(input, strategies)` — copy O.12 VERBATIM (PATTERNS L37-72) with the D-4a-22 adaptation: debugLog uses ERROR_CODES.CONTENT_EXTRACT_FAILED and the throw uses `code: ERROR_CODES.CONTENT_EXTRACT_FAILED` + `fallbacksTried`; import path `@/core/error/debugLog`.
    2) `PageContentService` class: constructor takes { bridge, cache, strategies, deliverContext? } (injectable seams for tests); `extract(tabId, mode)` — per-tab in-flight promise map (D-4a-03 dedup; cache.setInFlight), single AbortController + EXTRACTION_TIMEOUT_MS timer, bridge.requestExtraction(tabId, mode, {timeoutMs: EXTRACTION_TIMEOUT_MS}), DOMParser + `<base href>` stamp (D-4a-08 — panel injects the sibling baseUrl field), extractLayered over the ordered strategies, TraceRedactor on the result BEFORE index/cache/log (D-4a-10), cache.set + lazy index memo (D-4a-15), deliverContext → the default writes WorkspaceStore.currentPageContext via `useWorkspaceStore.getState().update(draft => { draft.currentPageContext = ctx })` (D-4a-05 inert-field draft — never journaled/serialized; RESEARCH Q3); `getContent(tabId)` — stale-safe (await in-flight when invalidated); `invalidate(tabId)`; subscribe to bridge nav signals + chrome.tabs.onUpdated/onRemoved (D-4a-01/04 — subscribed re-extract, unsubscribed mark-stale, onRemoved evicts cache+index).
    Export `EXTRACTION_TIMEOUT_MS = 5000`. Header comment: §26.1 core infrastructure; model feed unplugged (D-4a-06).
    3) Write `tests/core/extraction/PageContentService.test.ts` per the behavior block: fakeBrowser + flushRuntime for chrome.* paths (tabs.onUpdated/onRemoved stubs), injectable seams (mock bridge with controllable request latency, mock strategies or the real ones from 04a-04 with fixtures), injectable clock for LRU determinism (04a-05 pattern). If the 04a-02 builders don't cover the empty page, extend tests/fixtures/pageContent.ts with the empty-page fixture (extend the shared module — D-4a-24; never per-test HTML). Wire every catch through debugLog with the canonical code (GR-9) where the code under test throws.
  </action>
  <acceptance_criteria>
    - All nine behavior tests pass via `pnpm vitest run tests/core/extraction/PageContentService.test.ts -x`.
    - extractLayered throws the typed carrier with code === ERROR_CODES.CONTENT_EXTRACT_FAILED on total failure (assert).
    - EXTRACTION_TIMEOUT_MS exported and === 5000.
    - The eviction test asserts deterministic LRU order + pin/in-flight protection (P4a-1/D-4a-04).
    - The redaction test asserts the secret-shaped string is absent from the served content (CAT-03).
    - The default deliverContext uses WorkspaceStore.update(draft) (grep 'currentPageContext' in PageContentService.ts).
    - TraceRedactor import panel-side only; no storage/IDB import; no ContextOptimizer/ai import (D-4a-06 unplugged — grep).
    - No per-test fixture HTML — everything from the shared module (D-4a-24).
    - tsc --noEmit green.
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/extraction/PageContentService.test.ts -x</automated>
  </verify>
  <done>PageContentService (extractLayered + class) implemented with coalescing/timeout/stale-safe/redaction/delivery; the full §18 orchestrator suite green (9 tests: defuddle-success, fallback record, empty-typed, coalescing, stale-safe, timeout, eviction, delivery, redaction).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| bridge payload → PageContentService | untrusted serialized page HTML enters the panel pipeline |
| extraction result → cache/index/workspace | parsed content is served/redacted/persisted-mirrored |
| workspace write → BroadcastBus | currentPageContext mirrors to the secondary surface |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4a-02 | Information Disclosure | DOM-embedded secrets leaking to index/log | high | mitigate | TraceRedactor runs panel-side BEFORE any index/cache/log (D-4a-10, CAT-03); the redaction test pins secret absence (Test 9); the content script never imports TraceRedactor (Appendix G) |
| T-4a-03 | Spoofing | malicious page content reaching the model (prompt injection) | high | accept | OUT OF SCOPE for 4a (D-4a-06) — the model feed stays unplugged; trust/authority labeling + quarantine is Phase 4b (TRUST-01/02); the service delivers to cache/index/workspace only |
| T-4a-22 | Tampering | stale/wrong-page content served post-navigation | high | mitigate | D-4a-03 stale-safe reads (await in-flight, never stale — Pitfall 7) + D-4a-01 invalidation wiring; the stale-read test pins it |
| T-4a-23 | Tampering | cache poisoning via id-spoofed bridge reply | medium | mitigate | requestExtraction correlates by opId (04a-07); MessageBus whitelist (Pitfall 5) |
| T-4a-24 | Information Disclosure | page content leaked via workspace mirror to secondary surface | low | accept | currentPageContext mirror is the LOCKED D-4a-05 mechanism (§13 primary-writer + BroadcastBus) — same-surface trust boundary, panel/standalone only (R-3) |
| T-4a-25 | DoS | unbounded re-extraction storm (nav spam) | medium | mitigate | Per-tab coalescing (D-4a-03) + 5 s cap + subscribed-only re-extract (D-4a-01) + LRU-20 eviction (D-4a-04) |
</threat_model>

<verification>
- `pnpm vitest run tests/core/extraction -x` — service suite green (9 tests).
- tsc --noEmit green.
- Grep: no ai/ContextOptimizer import (D-4a-06 unplugged), no storage/IDB import, no content-side TraceRedactor.
- EXTRACTION_TIMEOUT_MS === 5000 pinned.
</verification>

<success_criteria>
- extractLayered is O.12-verbatim with the canonical D-4a-22 code and recorded fallback (D-4a-19).
- The service coalesces, times out at 5 s, reads stale-safe, evicts deterministically, redacts before index, and delivers currentPageContext via primary-writer (D-4a-01..06, 10).
- The §18 PageContentService.test.ts is green with the full behavior matrix.
</success_criteria>

<output>
Create `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-08-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- src/core/extraction/PageContentService.ts — `EXTRACTION_TIMEOUT_MS` (5000), `ExtractionOutcome` interface, `extractLayered()`, `isContentExtractFailed()` guard (typed carrier, D-4a-22), `PageContentService` class (extract/getContent/invalidate + bridge/tabs wiring + deliverContext default → WorkspaceStore)
- tests/core/extraction/PageContentService.test.ts — 9 tests (defuddle-success, readability-fallback record, empty-typed, coalescing, stale-safe, timeout, eviction, delivery, redaction)
- tests/fixtures/pageContent.ts — extended with the empty-page fixture (D-4a-24 shared guard)
