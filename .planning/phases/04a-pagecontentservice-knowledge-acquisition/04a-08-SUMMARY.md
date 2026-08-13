---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 08
subsystem: extraction
tags: [extraction, orchestrator, coalescing, abort-controller, trace-redactor, lru, current-page-context, minisearch]

# Dependency graph
requires:
  - phase: 04a-04
    provides: DefuddleStrategy (primary + Readability fallback, D-4a-14/18/08), ApcLiteStrategy (actionable), IExtractionStrategy/StrategyInput/StrategyResult (Appendix C.1 verbatim)
  - phase: 04a-05
    provides: PageContentCache (per-tab LRU-20, setInFlight/setPinned/setSubscribed), PageIndexBuilder (lazy MiniSearch chunking)
  - phase: 04a-07
    provides: PageContextBridge.requestExtraction (ExtractionPayload {html, baseUrl, truncated}, opId correlation, typed CONTENT_EXTRACT_FAILED bridge carrier), SPANavigationWatcher→host→bridge nav signal
  - phase: 04a-02
    provides: ERROR_CODES.CONTENT_EXTRACT_FAILED (D-4a-22 canonical code)
provides:
  - extractLayered — Appendix O.12 verbatim with D-4a-22 canonical CONTENT_EXTRACT_FAILED + D-4a-19 fallback provenance
  - PageContentService class — D-4a-03 coalescing + 5 s single-AbortController cap + stale-safe reads, D-4a-04 eviction orchestration, D-4a-10 redaction-before-index, D-4a-15 lazy index, D-4a-05 currentPageContext primary-writer delivery, D-4a-01/04 invalidation wiring (bridge nav + tabs.onUpdated/onRemoved)
  - isContentExtractFailed typed-carrier guard
  - tests/fixtures/pageContent.ts extended with empty-page + secret-page fixtures (D-4a-24)
affects: [04a-09, 04a-10, 04b (model feed — D-4a-06 unplugged), Phase 7 (WorkspacePageSkeleton card consumer), Phase 8 (service surfaces)]

# Tech tracking
tech-stack:
  added: [none — defuddle/readability/turndown/minisearch already approved]
  patterns:
    - "Typed-error carrier + type guard (StructuredOutputFailedError precedent) for CONTENT_EXTRACT_FAILED"
    - "Per-tab in-flight promise map (service-owned) cooperating with cache.setInFlight marks"
    - "Single AbortController + injectable timeoutMs per round-trip; injected clock for deterministic LRU tests"
    - "Redaction seam: TraceRedactor.redact before any cache write / index build / log"
    - "Injectable seams (bridge/cache/strategies/deliverContext/timeoutMs) for the full orchestration test matrix"

key-files:
  created:
    - src/core/extraction/PageContentService.ts
    - tests/core/extraction/PageContentService.test.ts
  modified:
    - tests/fixtures/pageContent.ts (empty-page + secret-page builders added)

key-decisions:
  - "extractLayered keeps O.12's accept-first-with-usable-content loop verbatim; D-4a-19 provenance records a strategy id in fallbacksTried when the winning result's source differs from the strategy's own id (the Readability fallback INSIDE DefuddleStrategy) — the plan's Test 2 contract"
  - "The service owns the per-tab promise map; the cache holds value/recency + in-flight/subscribed/pinned marks (04a-05 locked decision) — setInFlight on the existing entry protects it from LRU pressure mid-extraction"
  - "Timeout: the service passes the same cap to bridge.requestExtraction; its own AbortController timer is the backstop covering a hung bridge — ONE cap per round-trip (R-2), late payloads discarded (never cached/delivered post-timeout)"
  - "PageContext.url for default mode = the bridge-injected baseUrl sibling field (D-4a-08); the strategy stamps the detached doc from input.url (04a-04 decision — no baseUrl field on StrategyInput)"
  - "Wiring test (Test 10) added beyond the plan's nine behaviors to pin the D-4a-01/04 must-have (tabs.onRemoved eviction + nav-signal re-extract) — chrome.tabs event stubs on fakeBrowser"

patterns-established:
  - "D-4a-03 promise-map + stale-safe read (Pitfall 7): getContent awaits the in-flight promise after invalidation, never serves the stale entry"
  - "D-4a-05 primary-writer: the ONLY Phase-4a store mutation is the inert currentPageContext draft write (D-18 — never journaled/serialized); secondary surface mirrors via existing WORKSPACE_UPDATED BroadcastBus"

requirements-completed: [CAT-01, CAT-02, CAT-03, CAT-05]

# Coverage metadata (#1602) — per-deliverable verification proof
coverage:
  - id: D1
    description: "extractLayered layered strategy chain (Appendix O.12 verbatim, D-4a-22 canonical CONTENT_EXTRACT_FAILED, D-4a-19 fallback provenance) — defuddle success, readability-fallback record, empty-typed failure"
    requirement: CAT-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#Test 1 — defuddle success"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#Test 2 — boilerplate fallback provenance"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#Test 3 — empty page typed failure"
        status: pass
    human_judgment: false
  - id: D2
    description: "PageContentService D-4a-03 orchestrator — per-tab coalescing (one bridge request), stale-safe reads (Pitfall 7), 5 s single-cap timeout with typed carrier"
    requirement: CAT-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#Test 4 — coalescing"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#Test 5 — stale-safe read"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#Test 6 — timeout + EXTRACTION_TIMEOUT_MS=5000 pin"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-4a-04 eviction orchestration — LRU cap + deterministic order + pinned/in-flight protection (P4a-1)"
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#Test 7 — LRU eviction"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-4a-05 currentPageContext primary-writer delivery via WorkspaceStore.update(draft) inert-field write"
    requirement: CAT-05
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#Test 8 — delivery"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-4a-10 redaction-before-index — secret-shaped string absent from served cache content and the lazily-built MiniSearch index (CAT-03, R-10)"
    requirement: CAT-03
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#Test 9 — redaction"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-4a-01/04 invalidation wiring — tabs.onRemoved drops cache+index together; bridge nav signal re-extracts subscribed tabs (panel-side, R-3)"
    requirement: CAT-02
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#Test 10 — wiring"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-13
status: complete
---

# Phase 04a Plan 8: PageContentService Summary

**The extraction orchestrator — Appendix O.12 extractLayered (D-4a-22 canonical typed CONTENT_EXTRACT_FAILED) wrapped by the PageContentService class: per-tab in-flight coalescing, a single 5 s AbortController cap, stale-safe reads (Pitfall 7), deterministic LRU eviction orchestration, redaction-before-index (R-10), and currentPageContext primary-writer delivery — the single extraction owner for every surface (§26.1), model feed unplugged (D-4a-06).**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-13T06:33:00Z
- **Completed:** 2026-08-13T06:53:14Z
- **Tasks:** 1 (TDD — RED + GREEN, no REFACTOR needed)
- **Files modified:** 3 (1 new source, 1 new test, 1 fixture extension)

## Accomplishments

- `extractLayered(input, strategies)` — Appendix O.12 (spec L6736-6768) VERBATIM with the D-4a-22 adaptation: every debugLog and the typed throw use the canonical `ERROR_CODES.CONTENT_EXTRACT_FAILED` (never the O.12 non-canonical `EXTRACTION_FAILED` string), import path `@/core/error/debugLog`. D-4a-19 provenance refinement: a strategy whose internal fallback won (Defuddle→Readability) is recorded in `fallbacksTried`.
- `PageContentService` class — D-4a-03 coalescing (per-tab promise map, dedup → one bridge request), single AbortController + `EXTRACTION_TIMEOUT_MS = 5000` hard cap (§22.1), stale-safe `getContent` (awaits the in-flight promise after invalidation — never stale, Pitfall 7), D-4a-04 eviction orchestration (in-flight/pinned/subscribed never LRU-evicted; `tabs.onRemoved` drops cache+index together), D-4a-10 redaction before any index/cache/log (panel-side TraceRedactor), D-4a-15 lazy per-tab MiniSearch index (memoized on first query from the redacted markdown), D-4a-05 delivery via `useWorkspaceStore.getState().update(draft => { draft.currentPageContext = ctx })` (inert field, D-18 — never journaled/serialized), D-4a-01/04 invalidation wiring (bridge nav signal + `chrome.tabs.onUpdated/onRemoved` panel-side listeners).
- `isContentExtractFailed` typed-carrier guard (D-4a-22) + `ContentExtractFailedCarrier` interface.
- `tests/core/extraction/PageContentService.test.ts` — 10 tests (the plan's 9 behaviors + 1 wiring pin): defuddle-success, readability-fallback record, empty-typed failure, coalescing, stale-safe read, timeout + 5000 pin, LRU eviction (cap/order/pin/in-flight), currentPageContext draft write, redaction-before-index, tabs/nav wiring.
- `tests/fixtures/pageContent.ts` extended with `buildEmptyPageFixture` (CAT-01 empty probe) + `buildSecretPageFixture` (JSESSIONID redaction fixture) — shared module only (D-4a-24).

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: failing PageContentService orchestrator tests** - `69f58b6` (test)
2. **Task 1 GREEN: PageContentService implementation** - `e54f28e` (feat)

**Plan metadata:** pending (docs commit)

_Note: the plan's `-x` verify flag is unknown in vitest 4.1.10 — executed with a plain run (recorded 04a-05 decision, same stop-on-failure semantics not required)._

## Files Created/Modified

- `src/core/extraction/PageContentService.ts` - `EXTRACTION_TIMEOUT_MS` (5000), `ExtractionOutcome`, `ContentExtractFailedCarrier` + `isContentExtractFailed`, `extractLayered`, `PageContentBridgeLike`, `PageContentService` (extract/getContent/invalidate/subscribe/unsubscribe/queryIndex/start/stop + bridge/tabs wiring + default deliverContext → WorkspaceStore)
- `tests/core/extraction/PageContentService.test.ts` - 10-test §18 orchestrator suite (MockBridge, FakeStrategy, injectable clock, fakeBrowser tabs stubs)
- `tests/fixtures/pageContent.ts` - added `buildEmptyPageFixture` + `buildSecretPageFixture` (D-4a-24 shared guard)

## Decisions Made

- **D-4a-19 provenance interpretation:** `extractLayered` records a strategy id in `fallbacksTried` when the winning result's `source` differs from the strategy's own id — the plan's Test 2 requires `['defuddle']` for the boilerplate (Readability-inside-Defuddle) case; a one-line provenance refinement over O.12's bare accept, matching the plan's test contract.
- **Timeout ownership:** the service passes its cap to `bridge.requestExtraction` (the 04a-07 bridge already rejects typed on its own timer) AND keeps its own AbortController timer as the backstop for a hung bridge — one cap per round-trip (R-2); late payloads after a timeout are discarded (never cached/delivered).
- **In-flight mark semantics:** `extract()` calls `cache.setInFlight(tabId, promise)` on the existing entry so LRU pressure mid-extraction cannot evict it (the cache-level primitive from 04a-05, exercised service-side in Test 7c).
- **Test 10 added** (10th test beyond the plan's nine behaviors) to pin the D-4a-01/04 wiring must-have — chrome.tabs event stubs + the bridge nav-signal re-extract path; the plan's "(9 tests)" describes the behavior matrix, the wiring pin is a Rule-2 verification addition.
- **No REFACTOR commit:** prettier/eslint/tsc fixes were folded into the GREEN commit (test-side fixes: no-op deliverContext injection for non-delivery tests, corrected Test 9 html assertion, release mechanism for the hung bridge); tests pass without further cleanup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 9 asserted `pageContext.html` was undefined**
- **Found during:** Task 1 GREEN (test run)
- **Issue:** The secret fixture passes through the Readability fallback, which populates `meta.defuddleHtml` → the redacted html IS served; the assertion was wrong, not the implementation.
- **Fix:** Assert the served html does not contain the secret (the actual CAT-03 contract) instead of asserting absence.
- **Files modified:** tests/core/extraction/PageContentService.test.ts
- **Verification:** Test 9 passes; the redaction proof (secret absent from markdown/html/meta/index) holds.
- **Committed in:** e54f28e (GREEN)

**2. [Rule 1 - Bug] Test 7(c) hung on the never-resolving in-flight extraction**
- **Found during:** Task 1 GREEN (test run — 5 s vitest timeout)
- **Issue:** The in-flight extraction's bridge promise never resolved; `await inFlight` at the test end hung.
- **Fix:** MockBridge gained a `release()` mechanism resolving hung requests; the test releases the extraction before awaiting it (the in-flight-eviction assertions run before the release).
- **Files modified:** tests/core/extraction/PageContentService.test.ts
- **Verification:** Test 7 passes in ~1 s; eviction assertions unchanged.
- **Committed in:** e54f28e (GREEN)

**3. [Rule 3 - Blocking] tsc errors in the first implementation pass**
- **Found during:** Task 1 GREEN (tsc --noEmit)
- **Issue:** (a) `unsubscribe` field collided with the public `unsubscribe(tabId)` method (TS2300); (b) `chrome.tabs.TabChangeInfo` is not exported by the installed @types/chrome (TS2694); (c) the optional-value `finish` signature made `resolve(value)` accept `undefined` (TS2345).
- **Fix:** Renamed the private listener-detach field to `detachBridge`; typed the onUpdated changeInfo structurally (`{ status?: string; url?: string }`); split `finish` into `finishOk`/`finishErr` (also resolved the ESLint `prefer-const` on the timer).
- **Files modified:** src/core/extraction/PageContentService.ts
- **Verification:** tsc --noEmit green; eslint clean; 10/10 tests pass.
- **Committed in:** e54f28e (GREEN)

**4. [Rule 2 - Missing Critical] BroadcastBus noise in non-delivery tests**
- **Found during:** Task 1 GREEN (test run)
- **Issue:** Every extraction invoked the default deliverContext → the journaled workspace write → `BroadcastBus.emit: runtime send failed` stderr spam (no runtime listeners in the test env — handled by the store, but noisy and slow).
- **Fix:** Injected a no-op `deliverContext` into the six tests that don't exercise delivery (4, 5, 6, 7, 9, 10); Test 8 keeps the real default and asserts the store draft write.
- **Files modified:** tests/core/extraction/PageContentService.test.ts
- **Verification:** Clean test output; Test 8 still proves the primary-writer path end-to-end.
- **Committed in:** e54f28e (GREEN)

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing-critical-in-tests)
**Impact on plan:** All fixes were within the task's own files (implementation + its test). No scope creep, no pre-existing-code changes. The plan's behaviors are proven by the full suite.

## TDD Gate Compliance

- RED gate: `69f58b6` `test(04a-08): add failing PageContentService orchestrator tests` — the suite failed at RED for the right reason (greenfield module absent — the 04a-04/05 precedent).
- GREEN gate: `e54f28e` `feat(04a-08): implement PageContentService orchestrator` — 10/10 pass.
- REFACTOR: none — the GREEN commit absorbed the prettier/eslint/tsc + test-side corrections; no further cleanup warranted.
- **Compliant:** test(...) precedes feat(...), both present.

## Verification Results

- `pnpm vitest run tests/core/extraction` — **6 files, 35 tests passed** (service suite 10/10; plan's `-x` flag replaced per the recorded vitest-4.1.10 deviation).
- `tsc --noEmit` — **green**.
- Greps: no `ai/`/`ContextOptimizer` import (D-4a-06 unplugged) ✅; no storage/IndexedDB import (D-4a-02/15) ✅; TraceRedactor imported panel-side only (Appendix G) ✅; `currentPageContext` draft write present (5 refs in PageContentService.ts) ✅.
- `EXTRACTION_TIMEOUT_MS === 5000` — exported + vitest-pinned (Test 6) ✅.
- eslint on the three touched files — **clean**; prettier — applied.

## Issues Encountered

- The previous executor's residue: the working-tree `.planning/STATE.md` had drifted to "Plan: 1 of 10" (uncommitted); corrected to the true position (8 of 10) before the advance-plan state update. Documented in this summary's state handling; no source impact.
- `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md` remains untracked (pre-existing, already logged in deferred-items.md — plan-phase cleanup / phase close-out captures it; out of this plan's scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The extraction orchestrator is complete and proven: CAT-01/02/03/05 converge here — the service is the single extraction owner (D-4a-06), delivering to cache + bridge + workspace + ephemeral index only.
- **Ready for 04a-09** (next plan in wave sequence). The model-facing feed (`ContextOptimizerInput.pageContext`) remains unplugged by design — Phase 4b owns it (D-4a-06).
- The WorkspacePageSkeleton card (Phase-1 existing) will render `currentPageContext` via the UI-SPEC E2 contract — no component changes in 4a (display-only, binary presence).

---
*Phase: 04a-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-13*

## Self-Check: PASSED

- Created files verified on disk: `src/core/extraction/PageContentService.ts`, `tests/core/extraction/PageContentService.test.ts`, `04a-08-SUMMARY.md` ✅
- Commits verified in git log: `69f58b6` (RED), `e54f28e` (GREEN) ✅
