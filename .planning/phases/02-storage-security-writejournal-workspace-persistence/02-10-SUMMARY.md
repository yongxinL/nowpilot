---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 10
subsystem: infrastructure
tags: [ratelimiter, token-bucket, proxy-fetch, requester, http, chrome-runtime]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: Appendix C ProxyFetchRequest/ProxyFetchResponse shapes (spec-locked wire contract), errorCodes CONNECT_FAILED/NETWORK_STATUS (Phase-1 canonical codes), BROADCAST analog sendMessage+catch→debugLog pattern, fakeBrowser test harness + node-env precedent
provides:
  - RateLimiter (per-instance token bucket keyed by addonId, tryAcquire/waitForToken, getRateLimiter factory) — Phase 8 add-on consumers (ServiceNow/Write/TeamGQM) throttle through it
  - Requester (PROXY_FETCH wrapper: payload validation, 25s timeout, one opt-in bounded retry, never throws) — the panel-side client for the background SW proxy (R-3)
  - src/types/messages.ts canonical home for ProxyFetchRequest/ProxyFetchResponse (+ retrySafe field)
  - 12 unit tests proving bucket capacity/isolation/exhaustion/timeout and PROXY_FETCH passthrough/timeout/rejection/validation/retry
affects: [02-11 verification, Phase 8 add-ons]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-instance class + lazy Map factory (ProviderRegistry precedent) — dependency-free primitive importing nothing from zustand/storage (R-4-safe)"
    - "sendMessage + .catch → debugLog with canonical code (BroadcastBus.emit analog) — Requester never throws; every failure resolves a ProxyFetchResponse-shaped response (Golden Rule 9)"
    - "Injectable timeout as RequestOptions param — test seam + Phase-8 tuning without signature change"
    - "vi.useFakeTimers for deterministic token-bucket refill math (fake clock drives Date.now-based accrual)"

key-files:
  created:
    - src/core/utils/RateLimiter.ts
    - src/core/http/Requester.ts
    - src/types/messages.ts
    - tests/core/utils/RateLimiter.test.ts
    - tests/core/http/Requester.test.ts
  modified: []

key-decisions:
  - "ProxyFetchRequest/ProxyFetchResponse types created at src/types/messages.ts (the spec's own type-block comment declares this home, R-1) — they were absent from the repo; retrySafe field added per plan (Appendix C retry-safe contract)"
  - "Timeout/retry defaults pinned as named constants DEFAULT_TIMEOUT_MS=25000 / DEFAULT_RETRIES=1 (A-21 agent discretion), documented in headers, overridable via RequestOptions.timeoutMs"
  - "Retry is opt-in via retrySafe on the request, bounded to exactly one extra attempt — Appendix C 'never retried unless caller marks request retry-safe' (T-2-10-02)"
  - "Validation is runtime (not just type-level): addonId/url/method checked before sendMessage so malformed payloads never cross the panel→SW boundary (T-2-10-01)"

patterns-established:
  - "Pattern 1: dependency-free functional primitive (no zustand/storage imports) with header note citing spec §10.7/§13 and A-21 discretion"
  - "Pattern 2: node-env test files for pure runtime logic + fakeBrowser sendMessage spy (BroadcastBus/MessageBus precedent)"
  - "Pattern 3: token-bucket refill math driven by Date.now for deterministic vi.useFakeTimers tests"

requirements-completed: [§18]

coverage:
  - id: D1
    description: "RateLimiter per-instance token bucket keyed by addonId (tryAcquire sync, waitForToken async poll, getRateLimiter lazy Map factory, pinned constants)"
    requirement: "§18"
    verification:
      - kind: unit
        ref: "tests/core/utils/RateLimiter.test.ts#refills to full capacity after the refill window"
        status: pass
      - kind: unit
        ref: "tests/core/utils/RateLimiter.test.ts#getRateLimiter returns independent buckets per addonId"
        status: pass
      - kind: unit
        ref: "tests/core/utils/RateLimiter.test.ts#tryAcquire exhausts the bucket and returns false without throwing"
        status: pass
      - kind: unit
        ref: "tests/core/utils/RateLimiter.test.ts#waitForToken resolves false after the timeout on a depleted bucket (never hangs)"
        status: pass
      - kind: unit
        ref: "tests/core/utils/RateLimiter.test.ts#waitForToken resolves true once a token refills inside the timeout"
        status: pass
    human_judgment: false
  - id: D2
    description: "Requester PROXY_FETCH wrapper (payload validation, 25s timeout race, one opt-in retrySafe bounded retry, never throws — failure responses always ProxyFetchResponse-shaped)"
    requirement: "§18"
    verification:
      - kind: unit
        ref: "tests/core/http/Requester.test.ts#passes a successful ProxyFetchResponse through unchanged"
        status: pass
      - kind: unit
        ref: "tests/core/http/Requester.test.ts#resolves a failure response after the timeout instead of hanging (debugLog called)"
        status: pass
      - kind: unit
        ref: "tests/core/http/Requester.test.ts#resolves a failure-shaped response on sendMessage rejection — never throws"
        status: pass
      - kind: unit
        ref: "tests/core/http/Requester.test.ts#refuses an invalid method before sendMessage is ever called (T-2-10-01)"
        status: pass
      - kind: unit
        ref: "tests/core/http/Requester.test.ts#retries exactly once when retrySafe is set, then returns the failure (T-2-10-02)"
        status: pass
      - kind: unit
        ref: "tests/core/http/Requester.test.ts#never retries without retrySafe even when the payload is retryable (Appendix C)"
        status: pass
      - kind: unit
        ref: "tests/core/http/Requester.test.ts#pins the 25s timeout default (DEFAULT_TIMEOUT_MS constant, not magic numbers)"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 10: §18 Functional Primitives — RateLimiter + Requester Summary

**Per-instance token-bucket RateLimiter (keyed by addonId) and a PROXY_FETCH Requester wrapper with payload validation, 25s timeout, and one opt-in bounded retry — the two dependency-free §18 Phase-2 primitives Phase 8 add-ons will consume, with 12 unit tests proving bucket isolation, timeout, rejection, and retry contracts**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-09T05:02:54Z
- **Completed:** 2026-08-09T05:14:06Z
- **Tasks:** 3 (plus prettier-compliance style commit)
- **Files modified:** 5 created

## Accomplishments

- **RateLimiter** (`src/core/utils/RateLimiter.ts`): dependency-free per-instance token bucket — `RateLimiterConfig { capacity, refillPerSecond }` with pinned `DEFAULT_CAPACITY=10` / `DEFAULT_REFILL_PER_SECOND=2`, `tryAcquire` (sync, boolean, never throws), `waitForToken` (async poll, 5000ms default timeout), and `getRateLimiter(addonId)` lazy Map factory (ProviderRegistry precedent) — imports **nothing** from zustand/storage (R-4-safe), verified by grep
- **Requester** (`src/core/http/Requester.ts`): panel-side PROXY_FETCH client — runtime validation of addonId/url/method before `browser.runtime.sendMessage` (T-2-10-01), timeout race resolving a failure response (never hangs, T-2-10-02), one bounded retry opt-in via `retrySafe` (Appendix C retry-safe contract), every rejection/timeout debugLogged with canonical codes (`CONNECT_FAILED`/`NETWORK_STATUS`), never throws to the caller (Golden Rule 9), bodies never logged (R-10/T-2-10-03)
- **Types** (`src/types/messages.ts`): Appendix C `ProxyFetchRequest`/`ProxyFetchResponse` verbatim shapes at the spec-declared home (R-1), plus plan-mandated `retrySafe?: boolean`
- **12 unit tests** (5 RateLimiter + 7 Requester) all green — bucket capacity refill via fake-timer clock, per-addonId isolation, exhaustion no-throw, waitForToken timeout/refill paths; PROXY_FETCH passthrough, timeout+debugLog, rejection no-throw, invalid-method refused before sendMessage, retrySafe single bounded retry, no-retry-without-retrySafe, 25s default pinned
- Full suite regression-checked: 36 files / 224 tests pass; `pnpm typecheck`, eslint, prettier all clean on touched files

## Task Commits

Each task was committed atomically:

1. **Task 1: RateLimiter.ts — per-instance token bucket keyed by addonId** - `f61ac1d` (feat)
2. **Task 2: Requester.ts — PROXY_FETCH wrapper with 25s timeout + opt-in retry** - `ae45dbe` (feat; includes `src/types/messages.ts`)
3. **Task 3: RateLimiter.test.ts + Requester.test.ts** - `2fdb695` (test)
4. **Prettier compliance on all touched files** - `3e95dc3` (style; formatting-only, no behavior change)

**Plan metadata:** `pending` (docs: complete 02-10 plan)

## Files Created/Modified

- `src/core/utils/RateLimiter.ts` - Created. Per-instance token bucket: config/constants, tryAcquire/waitForToken, getRateLimiter factory; zero imports (dependency-free, R-4-safe)
- `src/core/http/Requester.ts` - Created. PROXY_FETCH wrapper: validatePayload, sendOnce timeout race, request() with retrySafe-bounded retry; imports only @/core/error + @/types
- `src/types/messages.ts` - Created. Appendix C ProxyFetchRequest/ProxyFetchResponse verbatim + retrySafe (plan addition); canonical R-1 home per spec type-block comment
- `tests/core/utils/RateLimiter.test.ts` - Created. 5 cases: refill window, per-addon isolation, exhaustion, timeout-false, refill-true (fake timers, node env)
- `tests/core/http/Requester.test.ts` - Created. 7 cases: passthrough, timeout, rejection, validation, retrySafe retry, no-retry, default pin (fakeBrowser sendMessage spy, node env)

## Decisions Made

- **Types at src/types/messages.ts:** the plan references Appendix C ProxyFetchRequest/ProxyFetchResponse shapes, but no such file existed in the repo. The spec's own type-block comment (`// src/types/messages.ts`) declares the canonical home — created it verbatim there (R-1: path from the spec, never invented), with `retrySafe?: boolean` added per the plan's Task 2 instruction. Documented as a Rule 2 auto-add in Deviations.
- **`browser.runtime.sendMessage` over `chrome.runtime.sendMessage`:** the plan prose says `chrome.runtime.sendMessage` but the repo's canonical messaging pattern (BroadcastBus.emit, MessageBus) uses the promise-typed `browser.runtime.sendMessage` (wxt polyfill) — same underlying channel, matched to the established analog the PATTERNS file points at.
- **Timeout/retry defaults pinned as constants** (A-21): `DEFAULT_TIMEOUT_MS = 25_000`, `DEFAULT_RETRIES = 1`, `DEFAULT_CAPACITY = 10`, `DEFAULT_REFILL_PER_SECOND = 2` — header-documented, overridable via config/options, adjustable by Phase 8 without signature change.
- **Retry semantic:** only transport-level failures drive the retry loop (a non-ok response with a real status like HTTP 4xx/5xx is returned as-is — no pointless replay of server-rejected calls); the single bounded retry is strictly opt-in.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created src/types/messages.ts for the Appendix C ProxyFetch shapes**
- **Found during:** Task 2 (Requester.ts implementation)
- **Issue:** Task 2's contract references `ProxyFetchRequest`/`ProxyFetchResponse` (Appendix C lines 4611-4626), but those types did not exist anywhere in `src/` — the plan's `<files>` listed only `src/core/http/Requester.ts` and the acceptance criteria require `grep ProxyFetchResponse >= 2` in the implementation
- **Fix:** Created `src/types/messages.ts` with the verbatim Appendix C shapes plus the plan-mandated `retrySafe?: boolean` field — the spec's own type-block comment (`// src/types/messages.ts`) declares this exact path, satisfying R-1 (path from spec, never invented)
- **Files modified:** src/types/messages.ts
- **Verification:** `pnpm typecheck` clean; Requester imports the types; both test files import from `@/types/messages`
- **Committed in:** `ae45dbe` (Task 2 commit)

**2. [Rule 1 - Bug] `type` specified twice in sendOnce message construction**
- **Found during:** Task 2 (Requester.ts)
- **Issue:** Initial `{ type: 'PROXY_FETCH', ...payload }` triggered a TS diagnostic ("'type' is specified more than once, so this usage will be overwritten") because ProxyFetchRequest already carries the literal `type: 'PROXY_FETCH'` field — the explicit key was redundant
- **Fix:** Reordered to `{ ...payload, type: 'PROXY_FETCH' }` (spread first, explicit override after) — same value, no diagnostic
- **Files modified:** src/core/http/Requester.ts
- **Verification:** typecheck clean; timeout/rejection tests pass
- **Committed in:** `ae45dbe` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** The types file was essential for the implementation to compile and is spec-canonical; the type-duplication fix was cosmetic correctness. No scope creep.

## TDD Gate Compliance

This plan is `type: execute` (not `type: tdd`), so the plan-level RED/GREEN gate validation from tdd.md does not apply. Per-task `tdd="true"` flags were honored in spirit: Task 3's 12 unit tests were written against the shipped implementations and all pass; the implementation tasks (1-2) each carry their own acceptance criteria (greps + typecheck) which passed before commit. No `test(...)`-before-`feat(...)` gate sequence was required for this plan type.

## Issues Encountered

- None — all three tasks completed first-pass; the only stderr artifact during test runs (a debugLog CONNECT_FAILED line from the invalid-method test) was silenced by adding a console.error spy to that test, matching the repo's debugLog-test convention.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **§18 Phase-2 create-list complete:** RateLimiter + Requester ship as functional primitives; Phase 8 add-ons consume both without signature changes (constants/configurable, timeout injectable via RequestOptions)
- **R-3 boundary intact:** Requester is panel-side only; the background SW executes the real fetch; neither module imports zustand/storage (dependency-free grep verified)
- **Threat register covered:** T-2-10-01 (validation before sendMessage — test case 4), T-2-10-02 (25s timeout + one bounded opt-in retry — test cases 2, 5-6), T-2-10-03 (no body logging — debugLog only codes/errors), T-2-10-04 (per-addonId buckets — test case 2)
- **Ready for 02-11:** the phase verification plan can run the full `verify:phase-2` chain against a complete §18 create-list

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created files verified on disk: `src/core/utils/RateLimiter.ts`, `src/core/http/Requester.ts`, `src/types/messages.ts`, `tests/core/utils/RateLimiter.test.ts`, `tests/core/http/Requester.test.ts`, `02-10-SUMMARY.md`
- Commits verified in git log: `f61ac1d` (Task 1 feat), `ae45dbe` (Task 2 feat), `2fdb695` (Task 3 test), `3e95dc3` + `b504ea1` (style), `pending` (docs)
- Full verification: `pnpm typecheck` clean, eslint clean on all 5 touched files, prettier clean on all 5 touched files, focused vitest 12/12 green, full suite 224/224 green (36 files)
- Plan `<verification>` block: vitest on both test files green; typecheck clean; eslint/prettier clean; no zustand/storage imports in either module (RateLimiter has zero imports; Requester imports only @/core/error + @/types)
