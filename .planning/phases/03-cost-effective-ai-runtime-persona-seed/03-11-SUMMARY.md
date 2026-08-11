---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 11
subsystem: ai-runtime
tags: [timeout, structured-output, provider-router, wr-03, typed-error-carrier, retry, vitest]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: 03-04 StructuredOutput (requestJson per-attempt controller) + 03-05 ProviderRouter (classifyProviderError, D-17 retry) + 03-10 (retryCount/R-2 budget semantics this plan's tests depend on)
provides:
  - "src/core/error/TimeoutError.ts — shared typed timeout-origin carrier (interface + isTimeoutError guard + timeoutError(timeoutMs) factory), leaf module importable by both consumers without a cycle"
  - "WR-03 fix chain: StructuredOutput.attempt() separates the timeout abort from the user abort (timedOut flag set BEFORE ac.abort(); catch rethrows TimeoutError for timeout-origin, originals otherwise) → classifyProviderError maps the carrier to { code: 'TIMEOUT', retryable: true } BEFORE the isAbortError branch"
  - "TIMEOUT is now producible and classifiable: a planner timeout surfaces the deterministic planner_failed fallback answer (never a silent 'idle'); the D-17 retry fires exactly once; user cancels stay AbortError/UNKNOWN (never conflated)"
affects: [03-12, 03-13, 03-14, phase-3 verification re-run, verify-work UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed error carriers as leaf modules in src/core/error/ — importable by thrower and classifier without an import cycle (TimeoutError extends the ProviderUnavailableError/StreamFailedError/StructuredOutputFailedError shape)"
    - "Origin discrimination via flag-set-before-abort: a timeout callback sets timedOut BEFORE ac.abort(), making a timeout-origin rejection distinguishable from a user abort at the catch site"

key-files:
  created:
    - src/core/error/TimeoutError.ts
  modified:
    - src/core/ai/StructuredOutput.ts
    - src/core/ai/ProviderRouter.ts
    - tests/core/ai/StructuredOutput.test.ts
    - tests/core/ai/ProviderRouter.test.ts

key-decisions:
  - "TimeoutError carries ONLY timeoutMs (R-10, T-03-11-03) — never prompt bodies, provider keys, or raw output; the JSDoc contract names both consumers and the factory is the only creation site"
  - "isTimeoutError guard is name-match (err.name === 'TimeoutError'), prototype-chain agnostic — the isAbortError precedent; T-03-11-04 accepts the residual tampering risk bounded by the single D-17 retry + breaker"
  - "TIMEOUT classification branch sits BEFORE the isAbortError branch: user cancels (AbortError, no carrier) still land on UNKNOWN/never-retried"

patterns-established:
  - "Timeout-origin errors travel as a typed carrier through the SDK boundary; classification happens by carrier shape (name-match), not by message regex — the regex fallback stays as a secondary net"

requirements-completed: [AI-04]

coverage:
  - id: D1
    description: "Shared TimeoutError carrier leaf module — TimeoutError interface, isTimeoutError name-match guard, timeoutError(timeoutMs) factory carrying only timeoutMs (R-10)"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#classifies the typed TimeoutError carrier as TIMEOUT/retryable (WR-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Timeout-origin separation in StructuredOutput.attempt() — timedOut flag set before ac.abort(); catch rethrows TimeoutError for timeout-origin, originals otherwise; user aborts stay AbortError"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.test.ts#aborts the per-attempt call after ctx.timeoutMs with a typed TimeoutError (WR-03)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.test.ts#a never-resolving responder hits the per-attempt timeout: TimeoutError + signal aborted (WR-03)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.test.ts#re-parents the outer abortSignal into the per-attempt call"
        status: pass
    human_judgment: false
  - id: D3
    description: "TIMEOUT classifiable and D-17-retryable — classifyProviderError maps the TimeoutError carrier to TIMEOUT/retryable before the isAbortError branch; exactly ONE router retry on a timeout (2 SDK calls, never 3+); user cancel stays UNKNOWN"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#retries EXACTLY once on a TimeoutError carrier (WR-03, D-17) then succeeds"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#a user cancel (AbortError) stays UNKNOWN/never-retried (WR-03)"
        status: pass
    human_judgment: true
    rationale: "The plan's composite grep verification (`grep -c isTimeoutError` on both source files) cannot be satisfied as written: StructuredOutput.ts uses only the timeoutError factory per Task 2's exact spec (it has no classification responsibility), so the guard name appears there 0 times. All task-level acceptance criteria pass and the full verify:phase-3 gate is green — the grep is a semantic-intent artifact, not an implementation gap. Verifier confirms the intent (carrier thrown by one consumer, classified by the other) is met by the passing unit tests."
---

# Phase 03 Plan 11: WR-03 Timeout-Origin Classification — Summary

**Timeout-origin aborts now travel as a typed TimeoutError carrier from StructuredOutput.attempt() to ProviderRouter.classifyProviderError, which maps them to TIMEOUT/retryable before the isAbortError branch — a planner timeout surfaces a visible planner_failed fallback answer instead of a silent 'idle', the D-17 retry fires exactly once, and user cancels stay AbortError/UNKNOWN (never conflated)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-11T01:53:00Z
- **Completed:** 2026-08-11T02:01:30Z
- **Tasks:** 4
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- New leaf module `src/core/error/TimeoutError.ts` — typed carrier (interface + `isTimeoutError` name-match guard + `timeoutError(timeoutMs)` factory) following the ProviderUnavailableError/StreamFailedError/StructuredOutputFailedError shape, with zero runtime imports so both consumers import it without a cycle (03-PATTERNS.md "Typed error carriers" + WR-03 planner note honored)
- `StructuredOutput.attempt()` rewritten per 03-REVIEW.md WR-03: `timedOut` flag set by the setTimeout callback BEFORE `ac.abort()`, catch rethrows `timeoutError(ctx.timeoutMs)` for timeout-origin failures and the original error otherwise — user aborts (outer signal) still propagate as AbortError (T-03-11-01)
- `classifyProviderError` inserts `isTimeoutError(err) → { code: 'TIMEOUT', retryable: true }` as the first branch, before the isAbortError branch — TIMEOUT (a RETRYABLE_CODES member, §20.10) is now producible, so the D-17 retry fires exactly once and BREAKER_VOTES.TIMEOUT (1) stays honest (T-03-11-02); no changes to RETRYABLE_CODES/BREAKER_VOTES/status mapping/regex fallback
- Regression tests in both suites pin the new semantics: timeout → typed TimeoutError (name + isTimeoutError + timeoutMs), outer-abort stays AbortError and is asserted NOT to be a timeout-origin error, a never-resolving responder proves the per-attempt signal was aborted, classifier maps the carrier to TIMEOUT/retryable and a user DOMException AbortError to UNKNOWN/never-retried, and the D-17 retry suite proves exactly 2 SDK calls on a TimeoutError (first + one router retry)
- Full `verify:phase-3` gate green: eslint + prettier --check + tsc --noEmit + wxt build + vitest run (57 files / 465 tests) + content-bundle isolation check

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-03 — create the shared TimeoutError carrier** - `86fe69b` (feat)
2. **Task 2: WR-03 — separate timeout origin from user abort in StructuredOutput.attempt()** - `93dabfa` (fix)
3. **Task 3: WR-03 — classify timeout-origin errors as TIMEOUT (retryable)** - `5548c3e` (fix)
4. **Task 4: WR-03 — regression tests (both suites)** - `87f460a` (test)

## Files Created/Modified

- `src/core/error/TimeoutError.ts` - New typed carrier: `TimeoutError` interface (name 'TimeoutError', timeoutMs), `isTimeoutError` name-match guard, `timeoutError(timeoutMs)` factory; leaf module (zero runtime imports); carries only timeoutMs (R-10)
- `src/core/ai/StructuredOutput.ts` - `attempt()` rewritten: `timedOut` flag set before `ac.abort()`; catch rethrows `timeoutError(ctx.timeoutMs)` for timeout-origin, originals otherwise; imports `timeoutError` from `@/core/error/TimeoutError`; threat-register comment T-03-04-04 updated
- `src/core/ai/ProviderRouter.ts` - `classifyProviderError` first branch: `isTimeoutError(err)` → `{ code: 'TIMEOUT', retryable: true }`; imports `isTimeoutError` from `@/core/error/TimeoutError`; isAbortError branch unchanged (UNKNOWN/never-retried)
- `tests/core/ai/StructuredOutput.test.ts` - Timeout test re-asserted to `name: 'TimeoutError'` + `isTimeoutError(caught)` + `timeoutMs === 10`; outer re-parenting test hardened (`isTimeoutError(err) === false` after user abort); new never-resolving-responder test (TimeoutError + `signal.aborted === true`)
- `tests/core/ai/ProviderRouter.test.ts` - Classifier cases: `timeoutError(5_000)` → TIMEOUT/retryable, user `DOMException('aborted','AbortError')` → UNKNOWN/never-retried; D-17 end-to-end case: TimeoutError first call → exactly ONE retry (2 SDK calls), success, ledger `errorCode === 'TIMEOUT'`

## Decisions Made

- `TimeoutError` is a name-match carrier (`err.name === 'TimeoutError'`), not a code-literal carrier — the isAbortError precedent (ProviderRouter.ts) is prototype-chain agnostic, and T-03-11-04 accepts the residual tampering risk as bounded by the single D-17 retry + breaker
- The TIMEOUT branch precedes the isAbortError branch — ordering is load-bearing: a user cancel carries no TimeoutError, so the guard cannot shadow it; the two origins stay disjoint
- StructuredOutput throws the factory (`timeoutError`), ProviderRouter classifies with the guard (`isTimeoutError`) — each consumer imports only the symbol it needs from the shared leaf

## Deviations from Plan

None - plan executed exactly as written. (See the coverage D3 note and the verification observation below for the single composite-grep wording artifact.)

## Issues Encountered

- **Plan composite verification grep artifact (non-blocking):** the plan-level `<verification>` command `grep -c "isTimeoutError" src/core/ai/ProviderRouter.ts src/core/ai/StructuredOutput.ts` expects at least one hit per file, but StructuredOutput.ts correctly uses only the `timeoutError` **factory** (Task 2's spec: "import `{ timeoutError }` from `@/core/error/TimeoutError`" and "rethrow the typed carrier") — it has no classification responsibility, so the guard name appears there 0 times (ProviderRouter.ts: 2 hits). Every task-level acceptance criterion passes, and the full `verify:phase-3` gate is green (465 tests). No code change was made: re-exporting the guard from StructuredOutput would be an invented-export for grep compliance. Documented in coverage D3 with `human_judgment: true` so verify-work confirms intent.
- The pre-existing dirty files at plan start (`README.md`, `tests/isolation/check-content-bundle.mjs`) were left untouched — out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-03 closed: TIMEOUT is producible (StructuredOutput throws the typed carrier) and classifiable (ProviderRouter maps it retryable) — a planner timeout now surfaces the deterministic planner_failed fallback answer, never a silent 'idle'
- User cancels remain AbortError/UNKNOWN — the two origins are never conflated (T-03-11-01), with regression tests pinning both directions
- D-17 retry fires exactly once on a TIMEOUT-classified error (2 SDK calls, never 3+; R-2 budget via 03-10 retryCount semantics) — cost-bounded per T-03-11-02
- Full `verify:phase-3` gate green — ready for the remaining wave-8 plans (03-12/03-13/03-14) and the phase-3 verification re-run

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 5 planned files verified on disk; all 4 task commits verified in git history.
