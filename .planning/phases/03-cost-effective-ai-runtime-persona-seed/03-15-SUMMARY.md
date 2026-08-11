---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 15
subsystem: ai-runtime
tags: [circuit-breaker, streaming, provider-router, renderer, vitest]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: "03-05 (buildStageMessages / F-5 messages[]+providerOptions shape) and 03-12 (WR-02 breaker + stream-freeze wiring, recordFailure/isAbortError guards)"
provides:
  - "BREAKER_VOTES.STREAM_FAILED = 1 — the streaming-path breaker vote is LIVE (voteBreaker no longer early-returns 0 on a streaming failure)"
  - "Classifier-mapped catch voting in RendererService.render — the mid-stream catch classifies the underlying provider error and votes its mapped code (03-12 accounting intent: never a hardcoded double-count)"
  - "tests/core/ai/RendererService.streamBreakdown.test.ts — permanent real-Router regression asserting breaker STATE (only ai-sdk streamText stubbed, fresh real ProviderRouter per test)"
affects: [phase-03 verification (gap 2 / WR-02A closure), any future plan touching the streaming-path breaker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real-Router regression pattern (AgentOrchestrator.budget.test.ts precedent): partial vi.mock with importOriginal spread + vi.hoisted holder; the mocked getProviderRouter returns a FRESH real ProviderRouter per test; assertions run on holder.current (breaker STATE, not invocation)"
    - "Delegating a real this-free method into a vi.fn() mock field via vi.fn(realMethod) — satisfies strict tsc (a bare method reference is not assignable to Mock<Procedure>) while keeping call recording"

key-files:
  created:
    - tests/core/ai/RendererService.streamBreakdown.test.ts
  modified:
    - src/core/ai/ProviderRouter.ts
    - src/core/ai/RendererService.ts
    - tests/core/ai/RendererService.test.ts

key-decisions:
  - "Delegation implemented as vi.fn(new ProviderRouter().classifyProviderError) instead of a bare method reference — strict tsc rejected the plain assignment (TS2322), and the double-cast alternative spanned two lines (breaking the plan's grep=3 acceptance count); vi.fn(realMethod) preserves the call-recording Mock surface AND the real this-free classifier delegation"
  - "Regression file uses unique per-render operationIds (opSeq counter) so router operation state stays fully isolated across renders"

patterns-established:
  - "Permanent real-Router regression: only ai-sdk call sites stubbed, never the Router singleton — a regression back to a 0-vote BREAKER_VOTES table fails the suite immediately"

requirements-completed: [AI-04]

coverage:
  - id: D1
    description: "BREAKER_VOTES.STREAM_FAILED = 1 and the mid-stream catch votes the classifier's mapped code (03-12 intent: never a hardcoded double-count)"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/RendererService.streamBreakdown.test.ts#3 mid-stream PROVIDER_5XX failures open the breaker"
        status: pass
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#a mid-stream provider error votes the breaker with the classifier-mapped code"
        status: pass
    human_judgment: false
  - id: D2
    description: "Permanent real-Router regression asserting breaker STATE: 3 non-stop finishes open (single does not), 3 mid-stream 5XX open, user aborts never open, clean stop never votes"
    verification:
      - kind: unit
        ref: "tests/core/ai/RendererService.streamBreakdown.test.ts (4 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "WR-02 wiring tests assert the mapped-code vote (PROVIDER_5XX) flows through the real classifier and that classifyProviderError is called exactly once"
    verification:
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#a mid-stream provider error votes the breaker with the classifier-mapped code"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-11
status: complete
---

# Phase 3 Plan 15: WR-02A — Live Streaming-Path Breaker Summary

**Streaming-path circuit breaker made live: BREAKER_VOTES gains STREAM_FAILED: 1, the mid-stream catch votes the real classifier's mapped code, and a permanent real-Router regression pins the observable consequence (3 provider-originated streaming failures within 60 s now open the breaker; user aborts never do)**

## Performance

- **Duration:** 20 min (plan-span, first Task-1 commit 08:01Z → summary 08:21Z; continuation session ~10 min)
- **Started:** 2026-08-11T08:01:46Z (Task 1 commit timestamp)
- **Completed:** 2026-08-11T08:21:32Z
- **Tasks:** 3
- **Files modified:** 4 (2 source, 2 test)

## Accomplishments

- **BREAKER_VOTES.STREAM_FAILED = 1** (ProviderRouter.ts, after `NETWORK`, before `RATE_LIMITED`) — the no-error non-stop finish branch's vote is now real; `voteBreaker` can no longer early-return 0 on a streaming failure. Table otherwise untouched (`RATE_LIMITED: 0` etc. intact); `STREAM_FAILED` stays OUT of RETRYABLE_CODES (§1.5 — the streaming path never retries).
- **Classifier-mapped catch voting** (RendererService.ts mid-stream catch): the underlying provider error is classified via `getProviderRouter().classifyProviderError(err)` into a local `cls`, then `recordFailure(providerId, cls.code, err)` — honoring 03-12's stated intent ("votes per the classifier's mapped code, never a hardcoded double-count"). 5XX/NETWORK/TIMEOUT map to 1-vote codes; UNKNOWN-classifiable stream errors vote 0 by design. The `isAbortError` guard still runs before any classification/vote (T-03-15-03).
- **New permanent real-Router regression** (`RendererService.streamBreakdown.test.ts`): reproduces VERIFICATION.md gap 2 / WR-02A exactly (3×STREAM_FAILED → `isBreakerOpen === false` pre-fix). Only the ai-sdk `streamText` call site is stubbed; a FRESH real `ProviderRouter` is injected per test via a vi.hoisted holder, and all 4 tests assert breaker STATE on that instance: 3 non-stop finishes open (and a single one does not — threshold), 3 mid-stream APICallError(500) failures open via the real classifier's mapped code, user aborts (3×) never open, clean stop never votes.
- **WR-02 wiring tests updated** (`RendererService.test.ts`): `routerMock.classifyProviderError` delegates to the real `this`-free classifier; the mid-stream vote test now throws a classifiable `APICallError` (500) and asserts `recordFailure('anthropic', 'PROVIDER_5XX', expect.any(Error))` plus `classifyProviderError` called exactly once — a 0-vote regression is detectable again. User-abort / clean-stop / non-stop-finish tests untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-02A source change (BREAKER_VOTES.STREAM_FAILED + classifier-mapped catch voting)** - `70e75d1` (fix) — committed by the prior executor; re-verified in this continuation (table entry, catch region, non-stop branch, ProviderRouter suite green)
2. **Task 2: WR-02A wiring-test update (classifier delegate + mapped-code assertion)** - `80b64a7` (test)
3. **Task 3: permanent real-Router regression (streamBreakdown.test.ts)** - `0e54f71` (test)

**Plan metadata:** `(docs: complete plan — see final metadata commit)`

## Files Created/Modified

- `src/core/ai/ProviderRouter.ts` - BREAKER_VOTES gains `STREAM_FAILED: 1` (L197); JSDoc + module header document the live streaming-path vote (WR-02A)
- `src/core/ai/RendererService.ts` - mid-stream catch (L132-134) classifies and votes the mapped code; non-stop branch (L148) keeps `ERROR_CODES.STREAM_FAILED` (now a real 1-vote); WR-02A header comment
- `tests/core/ai/RendererService.test.ts` - `classifyProviderError: vi.fn()` stub field + `vi.fn(realMethod)` delegation; mid-stream vote test asserts mapped-code flow; WR-02 describe header notes WR-02A
- `tests/core/ai/RendererService.streamBreakdown.test.ts` - NEW permanent real-Router breaker-STATE regression (4 tests)

## Decisions Made

- **Delegation via `vi.fn(realMethod)` rather than a bare method reference** — strict tsc rejects assigning a plain `(err: unknown) => ClassifiedProviderError` to the vi.fn() Mock field (TS2322); the double-cast workaround spanned two lines and would have broken the plan's `grep -c "classifyProviderError"` = 3 acceptance count. `vi.fn(new ProviderRouter().classifyProviderError)` keeps the real this-free classifier as the mock implementation with call recording intact, on one line.
- **Unique per-render operationIds in the regression file** — `baseInput` defaults to `op-stream-breakdown-${++opSeq}` so operation state stays isolated across renders (defensive; the router is also fresh per test).
- Followed the plan's line-region grep semantics at **current** line numbers (the plan's fixed ranges drifted — see Issues Encountered).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Delegation line failed strict tsc (TS2322)**
- **Found during:** Task 2 (WR-02 wiring-test update)
- **Issue:** The plan's literal step — `routerMock.classifyProviderError = new ProviderRouter().classifyProviderError;` — does not typecheck: a plain function is not structurally assignable to the `vi.fn()` Mock field type (`Type '(err: unknown) => ClassifiedProviderError' is not assignable to type 'Mock<Procedure>'`), blocking `tsc --noEmit` and the Task-2 gate.
- **Fix:** Wrapped the real method as the mock implementation: `routerMock.classifyProviderError = vi.fn(new ProviderRouter().classifyProviderError);`. This preserves the plan's intent exactly (delegation to the REAL this-free classifier — the mid-stream test still exercises real 5XX→PROVIDER_5XX classification), keeps the call-recording Mock surface the assertions use, satisfies strict tsc without a cast, and fits on one line (keeping the `grep -c classifyProviderError` = 3 acceptance count: stub field + delegation line + assertion).
- **Files modified:** tests/core/ai/RendererService.test.ts
- **Verification:** `tsc --noEmit` exit 0; `grep -c "classifyProviderError"` = 3; full suite green.
- **Committed in:** `80b64a7` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking/typing)
**Impact on plan:** Auto-fix was purely mechanical (test-side typing); no behavior or scope change. All plan intent preserved.

## Issues Encountered

- **Acceptance-grep line-region drift (documentation artifact, no code impact):** Task 1's own mandated edits (BREAKER_VOTES JSDoc line, the `STREAM_FAILED: 1` entry, WR-02A header/JSDoc lines) shifted line numbers ~6-7 lines, so the plan's fixed sed ranges (ProviderRouter.ts L186-196, RendererService.ts L127-133) no longer enclose the changed content. All content criteria were re-verified at current line numbers and PASS:
  - ProviderRouter.ts L193-203: `STREAM_FAILED: 1` count 1, `RATE_LIMITED: 0` count 1 (table otherwise untouched)
  - RendererService.ts L132-134: `isAbortError` guard + `const cls = getProviderRouter().classifyProviderError(err)` + `recordFailure(input.invocation.providerId, cls.code, err)` (mapped-code vote)
  - RendererService.ts L148/L151: non-stop branch keeps `ERROR_CODES.STREAM_FAILED` (2 occurrences in the branch region — recordFailure code arg + adjacent debugLog code arg)
- Pre-existing untracked `.planning/tmp/` probe artifacts from the prior verification session (edge-probe-*.json, plan-pre-contributions.txt) were left untracked; `.planning/tmp/` added to `.gitignore` so generated probe output never pollutes git (housekeeping, folded into the metadata commit).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **03-16** is the only remaining PLAN in phase 03 (per init context: 16 plans, 14 summaries, 2 incomplete).
- WR-02A is closed — the streaming-path breaker is live and permanently pinned by the new real-Router suite.
- Remaining phase-03 residual: **WR-03A** (TIMEOUT D-17 retry never fires on the production path) — outside this plan's scope; per 03-15 must_haves, AI-07 stays ACCOUNTED-DEFERRED (Phase 8 D-06, recorded in 03-10) and is never re-opened here.

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-11*

## Self-Check: PASSED

- Created files verified on disk: `tests/core/ai/RendererService.streamBreakdown.test.ts`, `03-15-SUMMARY.md`
- Commits verified in `git log --all`: `70e75d1`, `80b64a7`, `0e54f71`
- Task 1 acceptance (current line numbers): `STREAM_FAILED: 1` count 1, `RATE_LIMITED: 0` count 1, catch has `classifyProviderError` 1 + `cls.code` 1, non-stop region `STREAM_FAILED` count 2
- Task 2 acceptance: `grep -c "classifyProviderError" tests/core/ai/RendererService.test.ts` = 3; mid-stream test asserts `recordFailure('anthropic', 'PROVIDER_5XX', expect.any(Error))`
- Task 3 acceptance: `grep -c "isBreakerOpen"` = 6 (≥ 4); `getProviderRouter: () => holder.current` (real per-test router, never a vi.fn() recordFailure mock)
- Verification suites: RendererService.test.ts + streamBreakdown.test.ts 17 passed; ProviderRouter.test.ts 33 passed; AgentOrchestrator.budget.test.ts 3 passed; `tsc --noEmit` exit 0; `prettier --check` pass on both modified test files

