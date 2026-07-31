---
phase: 04a-page-content-extraction
plan: 05
subsystem: content-extraction
tags: password-redaction, spa-navigation, minisearch, wxt, isolation-tests, vitest, cache-invalidation

# Dependency graph
requires:
  - phase: 04a-page-content-extraction
    provides: Defuddle→Readability→ApcLite pipeline, typed PageContext, per-tab cache, MiniSearch index (plans 04a-01..04)
provides:
  - D-02 password name-heuristic contract restored (contains-match regex) — compound/suffix names redacted at capture
  - SPA_NAVIGATION cache-invalidation path wired end-to-end (init() called from side panel entrypoint; tests non-vacuous)
  - tabs.onRemoved tab-close index destruction covered by a real listener test (behavior-unverified item resolved)
  - Isolation enforcement operational: bundle-size <50KB and banned-string assertions run against .output/chrome-mv3/content.js
affects: 05-sidepanel-ui, phase verification (verify:phase-4a), PAGE-01 requirement closure

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contains-match sensitive-name heuristic (/pass(word|wd)?|pwd/i) for defense-in-depth redaction — err on false positives (D-02)"
    - "Test listener capture: record mock.calls.length before init(), use the newly-registered listener (init()-order independent)"

key-files:
  created: []
  modified:
    - src/core/content/DomSerializer.ts
    - tests/core/extraction/PageContentService.test.ts
    - tests/isolation/no-content-script-ui.test.ts
    - entrypoints/sidepanel/main.tsx

key-decisions:
  - "Restore the D-02 contains-match regex (revert WR-04 narrowing): compound/suffix password names (user_pwd, user_passwd, db_pwd, user_pass) are redacted; false-positive omission is the stated privacy policy"
  - "Wire pageContentService.init() at module scope in sidepanel/main.tsx — idempotent guard makes repeated calls no-ops; listeners registered before any user interaction"
  - "Isolation Tests 2+3 target the single-file WXT output .output/chrome-mv3/content.js instead of the non-existent content-scripts/ directory"

patterns-established:
  - "Pattern: sensitive field-name heuristics use contains-match, not exact-match lists — exact lists rot as page conventions drift"
  - "Pattern: chrome.tabs listener tests capture the call index before init() so the fired listener belongs to the test's own service instance"

requirements-completed: [PAGE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Password name-heuristic redaction restored — compound/suffix field names (user_pwd, user_passwd, db_pwd, user_pass) omitted from SerializedPage.html"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/content/DomSerializer.test.ts#omits values for inputs matching the password name heuristic and keeps other inputs"
        status: pass
      - kind: unit
        ref: "tests/core/content/PageContextBridge.test.ts#omits values for inputs matching the password name heuristic"
        status: pass
      - kind: unit
        ref: "tests/core/content/PageContextBridge.test.ts#omits values for inputs with name containing pwd"
        status: pass
    human_judgment: false
  - id: D2
    description: "SPA-nav cache invalidation operational — SPA_NAVIGATION handler registered via init(); different-URL invalidates (2x sendMessage), same-URL keeps cache hot (non-vacuous)"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#invalidates the cache when SPA_NAVIGATION announces a different URL"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#keeps the cache hot when SPA_NAVIGATION announces the same URL"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tab-close index destruction verified — tabs.onRemoved listener fires removeTab + cache.invalidate, proven by cache-miss re-extraction (behavior-unverified item resolved)"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#removes tab index and invalidates cache when tabs.onRemoved fires"
        status: pass
    human_judgment: false
  - id: D4
    description: "Isolation enforcement operational — bundle-size (<50KB) and banned-string assertions actually read .output/chrome-mv3/content.js (2,986 bytes, 0 banned strings)"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/isolation/no-content-script-ui.test.ts#has a built content script bundle under 50KB"
        status: pass
      - kind: unit
        ref: "tests/isolation/no-content-script-ui.test.ts#contains no banned package names in the built content bundle"
        status: pass
    human_judgment: false
  - id: D5
    description: "pageContentService.init() wired into the side panel entrypoint — SPA_NAVIGATION + tabs.onUpdated/onRemoved listeners active in production at startup"
    requirement: PAGE-01
    verification:
      - kind: other
        ref: "tsc --noEmit — zero errors in entrypoints/sidepanel or src/core/extraction"
        status: pass
    human_judgment: true
    rationale: "Module-scope init() call in main.tsx is not imported by any test — production listener registration requires a live extension run to confirm startup behavior"

# Metrics
duration: 5min
completed: 2026-07-31
status: complete
---

# Phase 04a Plan 05: Gap-Closure Summary

**Restored D-02 contains-match password redaction, wired pageContentService.init() into the side panel (SPA-nav + tab-lifecycle invalidation operational), and made the isolation bundle checks assert on the real WXT output — phase vitest suite green at 86/86.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-31T08:23:30Z
- **Completed:** 2026-07-31T08:27:13Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **Password redaction contract restored (Gap 2):** `PASSWORD_NAME_PATTERN` reverted from the WR-04 exact-match list to the D-02 contains-match regex `/pass(word|wd)?|pwd/i`. The 3 previously-leaking fixtures (`user_pwd`, `user_passwd`, `db_pwd`) are redacted again — 18/18 content tests pass.
- **SPA-nav cache invalidation wired end-to-end (Gap 1):** the two SPA_NAVIGATION tests now call `service.init()` (different-URL invalidation passes with 2× sendMessage; same-URL test is non-vacuous with the handler registered), and `entrypoints/sidepanel/main.tsx` calls `pageContentService.init()` at module scope before React render — the invalidation path is operational in production, not just in tests.
- **Tab-close index destruction covered (behavior-unverified item):** new test fires the `tabs.onRemoved` listener callback and proves `removeTab` + cache invalidation via cache-miss re-extraction (2× sendMessage).
- **Isolation enforcement operational (Gap 3):** Tests 2+3 now assert on `.output/chrome-mv3/content.js` (single file, the real WXT output) — <50KB and banned-string assertions run for real (2,986-byte bundle, 0 banned strings). Vitest phase gate: 86/86 pass, 0 failures.

## Task Commits

Each task was committed atomically:

1. **Task 1: Restore PASSWORD_NAME_PATTERN to contains-match regex** - `53674f6` (fix)
2. **Task 2: Fix SPA-nav cache invalidation test regression + add tabs.onRemoved test** - `e26566f` (test)
3. **Task 3: Fix isolation test output path + wire pageContentService.init() into side panel entrypoint** - `6235d6d` (fix)

**Plan metadata:** `(docs commit follows this summary)`

## Files Created/Modified

- `src/core/content/DomSerializer.ts` - `PASSWORD_NAME_PATTERN` line 16 restored to contains-match `/pass(word|wd)?|pwd/i` (single-line change; selector redaction untouched)
- `tests/core/extraction/PageContentService.test.ts` - `service.init()` added to both SPA tests; new `tabs.onRemoved` listener test; onUpdated tests capture their own listener index
- `tests/isolation/no-content-script-ui.test.ts` - Tests 2+3 target `.output/chrome-mv3/content.js` single-file check; updated skip messages
- `entrypoints/sidepanel/main.tsx` - imports `pageContentService`, calls `init()` at module scope before React render

## Decisions Made

- **D-02 contains-match regex restored** (revert of WR-04): compound/suffix password names must be redacted; per RESEARCH Pitfall 4, omitting a value is safer than capturing a password — false positives are the accepted trade-off.
- **Test listener capture made init-order-independent:** record `mock.calls.length` before `init()`, then take the newly-registered listener — the tests no longer depend on which test registered the first listener (important now that multiple tests call `init()`).
- **Isolation checks target the real WXT output file** (`.output/chrome-mv3/content.js`), matching the cross-entrypoint isolation suite's output conventions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] onUpdated tests broke from listener-call-index shift**
- **Found during:** Task 2 (SPA test init() additions)
- **Issue:** Adding `service.init()` to the SPA tests made them the first `init()` callers in the file. The two existing `tabs.onUpdated` tests fired `addListenerMock.mock.calls[0][0]` — which now pointed at the SPA test's listener bound to a *different* service instance. Firing it would invalidate the wrong instance's cache, keeping the current test's cache hot → both onUpdated tests would fail (expected 2× sendMessage, got 1×).
- **Fix:** Both onUpdated tests (and the new onRemoved test) capture the listener index before their own `init()` call and fire the listener registered by that call — init-order independent.
- **Files modified:** tests/core/extraction/PageContentService.test.ts
- **Verification:** full file passes 25/25
- **Committed in:** e26566f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was a necessary consequence of the plan's own init() additions — without it the suite would have stayed red. No scope creep.

## Issues Encountered

- `pnpm run verify:phase-4a` runs `tsc --noEmit && vitest ...`; tsc exits 2 on the 9 pre-existing `src/core/storage` errors (documented out-of-scope in VERIFICATION.md line 36 and deferred-items.md item 1), which short-circuits the vitest portion via `&&`. The plan's verification section anticipated this exact state. Vitest run directly: **86/86 passed, 0 failures** across tests/core/extraction, tests/core/content, and tests/isolation/no-content-script-ui.test.ts. The storage errors are untouched per scope boundary.
- Defuddle stderr noise (`DOMException {}`) during PageContentService tests is pre-existing library output on jsdom documents — not a failure (all tests pass).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase verification gate (vitest portion) green: 86/86 tests, 0 failures — up from 81/85 with 4 failing.
- All 4 verification gaps closed: SPA-nav invalidation (truth 22), password name-heuristic (truth 27), isolation enforcement (truths 25+28), and the tab-close behavior-unverified item (truth 23).
- PAGE-01 requirement marked complete (all 5 phase plans now have SUMMARYs).
- Ready for phase re-verification; the only remaining red is the pre-existing, out-of-scope `src/core/storage` tsc errors tracked in deferred-items.md.

---
*Phase: 04a-page-content-extraction*
*Completed: 2026-07-31*

## Self-Check: PASSED

- All 4 modified files exist on disk (DomSerializer.ts, PageContentService.test.ts, no-content-script-ui.test.ts, sidepanel/main.tsx) ✓
- SUMMARY.md exists at `.planning/phases/04a-page-content-extraction/04a-05-SUMMARY.md` ✓
- All 4 commits present in git log: `53674f6` (Task 1), `e26566f` (Task 2), `6235d6d` (Task 3), `38ff04e` (docs) ✓
- Phase vitest gate: 86/86 pass, 0 failures ✓
- PAGE-01 marked complete in REQUIREMENTS.md ✓
