---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 16
subsystem: ai-runtime
tags: [timeout, retry, abort-signal, provider-router, structured-output, vitest]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: "03-11 (TimeoutError carrier + classifyProviderError TIMEOUT mapping, WR-03) and 03-05 (buildCallProviderJsonMode closure / D-17 retry)"
provides:
  - "The D-17 retry on TIMEOUT now fires on the PRODUCTION path: the timeout-origin abort carries the typed carrier as signal.reason; the router closure recovers it with the environment-independent isTimeoutError(signal.reason) guard, records the failed TIMEOUT attempt + votes the breaker BEFORE rethrowing, and runs each attempt — including the retry — on a fresh derived controller"
  - "tests/core/ai/StructuredOutput.timeoutRetry.test.ts — permanent end-to-end regression through requestJson + a REAL Router (25 ms timeout, production arrival pattern)"
  - "ProviderRouter.test.ts L354-373 reframed from the defective direct-carrier-injection pattern to the production abort-with-carrier-reason pattern"
affects: [phase-03 verification (gap 3 / WR-03A closure), any future plan touching the router retry / structured-output timeout path]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Timeout-origin carrier rides the abort reason: ac.abort(timeoutError(...)) makes signal.reason the typed carrier — the SDK drops the reason and rejects a bare AbortError, so the closure recovers the carrier from the incoming signal (never an instanceof conjunct on the rejection: production Chrome rejects with a DOMException, NOT instanceof Error)"
    - "Per-attempt derived AbortController: each attempt re-parents the incoming signal into its own controller with a finally cleanup — the D-17 retry runs on a fresh non-aborted signal (the parent is already aborted at retry time, so its 'abort' event never re-fires), making a futile retry impossible by construction"
    - "Ledger-correctness ordering: recordAttempt + voteBreaker BEFORE the rethrow inside the recovery guard — attempts[0] carries the TIMEOUT errorCode so the outer classification sees TIMEOUT/retryable"

key-files:
  created:
    - tests/core/ai/StructuredOutput.timeoutRetry.test.ts
  modified:
    - src/core/ai/StructuredOutput.ts
    - src/core/ai/ProviderRouter.ts
    - tests/core/ai/ProviderRouter.test.ts
    - .planning/phases/03-cost-effective-ai-runtime-persona-seed/03-VALIDATION.md

key-decisions:
  - "Locked fix option (b) from VERIFICATION.md gap 3 / REVIEW WR-03A: the timeout-origin carrier rides the abort reason (ac.abort(carrier) → signal.reason), the closure recovers it with the SINGLE environment-independent guard, records + votes before the rethrow, and each attempt derives a fresh controller — the D-17 retry on TIMEOUT becomes real on the production path"

patterns-established:
  - "Real-Router end-to-end regression pattern (AgentOrchestrator.budget.test.ts precedent): vi.mock('ai') with importOriginal spread stubs ONLY the SDK call sites; the REAL resolveTier + REAL closure run; assertions land on the router's ledger state"

requirements-completed: [AI-04]

coverage:
  - id: D1
    description: "The WR-03A source fix — timeout-origin aborts carry the typed carrier as signal.reason (StructuredOutput), and the router closure recovers it with the environment-independent single guard, records the failed TIMEOUT attempt + votes the breaker before rethrowing, and runs each attempt on a fresh derived controller so the D-17 retry is never futile"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#retries EXACTLY once on a production timeout — abort with the carrier reason, SDK rejects AbortError (WR-03A, D-17)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.test.ts#aborts the per-attempt call after ctx.timeoutMs with a typed TimeoutError (WR-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The defective carrier-injection unit test reframed to the production arrival pattern — the test drives a real timeout-origin abort (controller aborted WITH the carrier as the reason), the SDK mock rejects bare AbortError on signal abort, and it asserts retryCount 1 + the retried call's abortSignal.aborted === false (a futile same-signal retry regression fails it)"
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#retries EXACTLY once on a production timeout — abort with the carrier reason, SDK rejects AbortError (WR-03A, D-17)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Permanent end-to-end regression (StructuredOutput.timeoutRetry.test.ts) through requestJson + a REAL Router: 25 ms timeout → D-17 retry fires exactly once on a fresh non-aborted signal (generateObject 2x, retryCount 1, ledger attempts[0] TIMEOUT); retry-also-fails rejects with the TimeoutError carrier (planner_failed source intact); healthy call never retries"
    verification:
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.timeoutRetry.test.ts#the D-17 retry fires END-TO-END on a production timeout — 2 SDK calls, retryCount 1, ledger TIMEOUT, fresh retry signal"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.timeoutRetry.test.ts#when the D-17 retry ALSO fails, requestJson rejects with the TimeoutError carrier — the planner_failed fallback source is intact"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.timeoutRetry.test.ts#a healthy first call never retries — 1 SDK call, retryCount 0"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-08-11
status: complete
---

# Phase 3 Plan 16: WR-03A — Timeout-Origin Carrier Rides the Abort Reason Summary

**The D-17 retry on TIMEOUT now fires on the production path: the timeout-origin abort carries the typed TimeoutError carrier as signal.reason, the router closure recovers it with an environment-independent single guard, records the failed TIMEOUT attempt + votes the breaker before rethrowing, and every attempt (including the retry) runs on a fresh derived non-aborted controller — pinned end-to-end by a new real-Router regression**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-11T08:44:12Z
- **Completed:** 2026-08-11T08:57:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 source, 1 test modified, 1 test created, 1 planning doc)

## Accomplishments

- **`ac.abort(timeoutError(ctx.timeoutMs))` in StructuredOutput** (attempt's setTimeout callback) — the timeout-origin abort now carries the typed carrier as `ac.signal.reason` (previously a bare abort whose reason the SDK dropped). The `timedOut` flag still precedes the abort, so the L100-102 catch's `if (timedOut) throw timeoutError(...)` behavior is unchanged.
- **Closure timeout-awareness in ProviderRouter** — `attempt()`'s catch checks `isTimeoutError(signal.reason)` FIRST (the SINGLE environment-independent guard; no instanceof conjunct on the SDK rejection, which in production Chrome is a DOMException, NOT `instanceof Error`). Inside the guard, BEFORE the rethrow (the ledger-correctness ordering — throwing first would bypass `recordAttempt` and leave the failed attempt out of the ledger): `recordAttempt(..., 'failed', 'TIMEOUT', isRetry)` then `voteBreaker(providerId, 'TIMEOUT', signal.reason)` then `throw signal.reason`. The outer classification maps the rethrown carrier to TIMEOUT/retryable → the D-17 retry fires exactly once.
- **Fresh-signal per-attempt controller** — each `attempt()` invocation derives its own `AbortController` re-parented to the incoming signal (`onParentAbort = () => derived.abort(signal.reason)`), passed to `invokeJsonMode` instead of the parent signal, with a `finally` `removeEventListener` (no listener leaks across the first + repair closure invocations). For the retried call the parent signal is ALREADY aborted — the 'abort' event never re-fires, so the retry runs on a fresh non-aborted signal (never the futile same-signal retry).
- **Reframed unit test** (ProviderRouter.test.ts L354-373) — no more direct `timeoutError()` mock injection; the test aborts its controller WITH the carrier as the reason, the SDK mock rejects bare AbortError on signal abort (DOMException), and it asserts `retryCount === 1` AND the retried call's `abortSignal.aborted === false` (a regression to the same-aborted-signal futile retry now fails it).
- **New permanent end-to-end regression** (`StructuredOutput.timeoutRetry.test.ts`) — reproduces VERIFICATION.md gap 3 / WR-03A EXACTLY (real requestJson + real Router closure, 25 ms timeout; pre-fix: generateObject 1×, retryCount 0, ledger UNKNOWN). Post-fix contract pinned: 2× calls, retryCount 1, ledger attempts[0] = `{ outcome: 'failed', errorCode: 'TIMEOUT' }`, retry signal non-aborted; retry-also-fails rejects with the TimeoutError carrier (the `planner_failed` fallback source, AgentOrchestrator L188-201, intact — never a silent idle, never a re-invocation, R-2); healthy first call never retries.
- **03-VALIDATION.md Per-Task Verification Map** updated with the 03-15-01..03-16-03 rows (03-10-01 stays).

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-03A source change (carrier-as-abort-reason + closure recovery + fresh-signal retry)** - `d03dacd` (fix)
2. **Task 2: WR-03A unit-test reframe to the production arrival pattern** - `d1a3490` (test)
3. **Task 3: end-to-end regression + VALIDATION.md map rows** - `2023a7b` (test)

**Plan metadata:** pending (docs commit after STATE/ROADMAP updates)

## Files Created/Modified

- `src/core/ai/StructuredOutput.ts` - the timeout callback aborts WITH the typed carrier as the reason; WR-03A comment block in `attempt`
- `src/core/ai/ProviderRouter.ts` - `attempt()` gains the per-attempt derived controller + the `isTimeoutError(signal.reason)` recovery guard (record + vote + rethrow ordering); WR-03A lines in the module header and the D-17 closure JSDoc
- `tests/core/ai/ProviderRouter.test.ts` - the WR-03 timeout-retry test reframed to the production arrival pattern (abort-with-carrier → SDK bare AbortError → recovery → one retry on a fresh signal; asserts retryCount 1 + non-aborted retry signal)
- `tests/core/ai/StructuredOutput.timeoutRetry.test.ts` - NEW end-to-end regression (3 tests)
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-VALIDATION.md` - Per-Task Verification Map rows 03-15-01..03-16-03 added

## Decisions Made

- **Locked fix option (b)** (per VERIFICATION.md gap 3 missing / REVIEW WR-03A): make the router closure timeout-aware by riding the carrier on the abort reason — `ac.abort(carrier)` → `signal.reason` → the closure's single environment-independent guard recovers it inside the retry decision point; each attempt derives a fresh controller so the retried call gets a non-aborted signal. Option (a) (accept fallback-answer semantics + correct framing) was rejected — the §20.10 single-retry intent is now REAL, not documented-away.
- **Single guard, no conjunct on the SDK rejection** — an `instanceof Error`-based abort check on the rejection object is false in production Chrome (DOMException), which would silently dead-end the recovery in production while passing in jsdom — the exact test-realm-only failure mode WR-03A closes.
- **Post-timeout retry failures are recovered as the carrier** (parent permanently aborted-with-carrier) and the ledger records the retry attempt as TIMEOUT — accepted (T-03-16-02): surfacing the carrier keeps the `planner_failed` contract deterministic (test b pins it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused `generateText`/`streamText` imports in the new regression file tripped eslint**
- **Found during:** Task 3 (end-to-end regression file)
- **Issue:** The plan's step 1 module mock stubs all three SDK call sites (`generateObject`/`generateText`/`streamText`), and the initial import mirrored the budget-test import line — but the file never references `generateText`/`streamText` outside the `vi.mock` factory, so `@typescript-eslint/no-unused-vars` failed the eslint gate (2 errors).
- **Fix:** Dropped `generateText`/`streamText` from the top-level `import { ... } from 'ai'` (keeping `APICallError` + `generateObject`). The `vi.mock('ai')` factory still stubs all three call sites via `vi.fn()` — the plan's mock shape is unchanged.
- **Files modified:** tests/core/ai/StructuredOutput.timeoutRetry.test.ts
- **Verification:** `eslint` exit 0 on the file; `tsc --noEmit` exit 0; the 3-test suite green.
- **Committed in:** `2023a7b` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/lint)
**Impact on plan:** Purely mechanical test-file hygiene; no behavior or mock-shape change. All plan intent preserved.

## Issues Encountered

- **Acceptance-grep line-region drift (documentation artifact, no code impact):** Task 1's own mandated edits (the WR-03A comment lines in StructuredOutput `attempt` and the ProviderRouter module header + D-17 JSDoc) shifted the plan's fixed sed regions (StructuredOutput L94-97, ProviderRouter L611-655) down by 3 and ~8 lines respectively. Prettier also reformats the multi-arg `recordAttempt` call one-arg-per-line (printWidth 100), so the plan's single-line grep literal `'failed', 'TIMEOUT'` is not produced by the formatted source. All content criteria were re-verified at current line numbers and PASS:
  - StructuredOutput.ts L97-103: `timeoutError` count 1 (the carrier abort), `timedOut = true` count 1 (flag precedes the abort)
  - ProviderRouter.ts: `isTimeoutError(signal.reason)` count 1 (single guard, no conjunct); `isAbortError(e)` count 0 (instanceof conjunct absent from the module); recovery region L672-690 shows the record (`'failed'` + `'TIMEOUT'` adjacent args) → `voteBreaker(cand.providerId, 'TIMEOUT', ...)` → `throw signal.reason` ordering; `new AbortController()` at L639 (inside the closure); `removeEventListener` at L700 (finally cleanup)
- Pre-fix the D-17 retry on TIMEOUT never fired (generateObject 1×, retryCount 0, ledger 'UNKNOWN' — VERIFICATION.md WR-03A probe); the WR-03A gap is now closed with the end-to-end suite proving 2× / retryCount 1 / ledger TIMEOUT.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **03-16 is the LAST plan in phase 03** (16 plans, 15 summaries after this one) — phase complete after this metadata commit.
- WR-03A is closed — the D-17 timeout retry is live on the production path and permanently pinned by the new real-Router end-to-end suite; the `planner_failed` fallback semantics (WR-03's primary user-visible fix) are unchanged.
- Remaining residuals for the phase verification report to reconcile: none of WR-02A/WR-03A remain — the two empirically-confirmed gaps are both closed (WR-02A by 03-15, WR-03A by 03-16). AI-07 stays ACCOUNTED-DEFERRED (Phase 8 D-06, recorded in 03-10) and is never re-opened.

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-11*

## Self-Check: PASSED

- Created files verified on disk: `tests/core/ai/StructuredOutput.timeoutRetry.test.ts`, `03-16-SUMMARY.md`
- Commits verified in `git log --all`: `d03dacd`, `d1a3490`, `2023a7b`
- Task 1 acceptance (current line numbers): StructuredOutput.ts L97-103 `timeoutError` count 1 + `timedOut = true` count 1; ProviderRouter.ts `isTimeoutError(signal.reason)` count 1, `isAbortError(e)` count 0, `new AbortController()` at L639 (closure), `removeEventListener` at L700 (finally)
- Task 2 acceptance: `mockRejectedValueOnce(timeoutError` = 0 lines; `setTimeout(() => ac.abort(timeoutError(3_000)), 0)` present; asserts retryCount 1 + retry signal non-aborted
- Task 3 acceptance: real `new ProviderRouter()` through `requestJson` with `timeoutMs: 25`; `retryCount` count 7 (≥2); `TIMEOUT` count 5 (≥1); tests a/b/c assertions present; 3/3 suite green
- Verification gate: 59 files / 472 tests passed; eslint ., prettier --check ., tsc --noEmit, wxt build (23.4 s), isolation check all exit 0
- 03-VALIDATION.md map: 03-15-0[123] count 3, 03-16-0[123] count 3
