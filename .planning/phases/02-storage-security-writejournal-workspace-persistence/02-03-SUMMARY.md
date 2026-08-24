---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 03
subsystem: core-utilities
tags: [RateLimiter, Requester, token-bucket, fetch-wrapper, AbortController, canonical-error-codes, TDD, D-35, D-36, D-37, REQ-R07]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence (plan 02-01)
    provides: "Phase-2 vitest harness with vi.stubGlobal + vi.useFakeTimers ready (no consumer dependency)"
  - phase: 02-storage-security-writejournal-workspace-persistence (plan 02-02)
    provides: "encrypt-at-rest foundation (KeyVault + EncryptedStorage + redactSensitive) — no direct consumer; precedent for strict-clean TDD + WebCrypto availability"
provides:
  - "Per-instance token-bucket RateLimiter (D-36, spec §13) with elapsed-time refill math, injectable now() clock, fractional refill rates with no rounding drift, capacity cap"
  - "UI-context Requester fetch wrapper (D-35, spec §10.7) with AbortController threading (caller signal + internal 25s timeout share one controller), optional injected RateLimiter, canonical error codes (RATE_LIMITED / TIMEOUT / NETWORK — §21.6 closed set, REQ-R07)"
  - "Both modules strict-clean (zero new @ts-expect-error NP-STRICT markers) — NP-STRICT ceiling stays 0"
affects:
  - 02-04+ (WriteJournal, IndexedDBMigrator, ErrorStore) — no consumer
  - Phase 3 aiProvider — first consumer of Requester + injected RateLimiter (D-35 consumer boundary)

# Actuals (#2632) — pairs with the plan's `estimate: {tokens:24000, raw_tokens:12000, tasks:2, confidence:low}`
actuals:
  tokens: 4100            # chars/4 over the 4 files created (~16.4k chars): RateLimiter.ts (2.0k) + Requester.ts (2.4k) + RateLimiter.test.ts (1.7k) + Requester.test.ts (3.5k) — frontmatter excluded
  tasks: 2
  commits: 3              # TDD Task 1 (RED + GREEN) + Task 2 EXPANSION; REFACTOR skipped — no behavior-changing cleanup was needed (already minimal per GREEN phase)

# Tech tracking
tech-stack:
  added: []               # no new packages; uses native AbortController / setTimeout / DOMException
  patterns:
    - "Per-instance token-bucket RateLimiter: elapsed-time refill (no setInterval) + injectable now() clock — keeps tests deterministic without a timer seam"
    - "Single-controller AbortController composition: caller-supplied signal + internal timeout share one controller so both abort paths share one code (D-35 — caller abort and timeout abort both classify as TIMEOUT)"
    - "Canonical error code discipline: only RATE_LIMITED / TIMEOUT / NETWORK are used (REQ-R07 closed set, §21.6) — verified via grep audit on `code:` assignments"

key-files:
  created:
    - src/core/utils/RateLimiter.ts — RateLimiterOptions + class RateLimiter with injectable now(), capacity ceiling on idle accumulation, fractional refill rates without rounding drift, throws on invalid construction args (defensive)
    - src/core/http/Requester.ts — RequesterError class + request() function (AbortController threading, 25s default timeout matching PROXY_FETCH §10.7, optional injected RateLimiter gate preceding any fetch call, AbortError→TIMEOUT + non-AbortError→NETWORK classification, RequesterError exposes the canonical code)
    - tests/core/utils/RateLimiter.test.ts — 6 cases: burst consumption, elapsed-time refill, capacity cap, fractional precision (refillPerSecond 0.5 over 2000ms → exactly 1 token), zero refill stays empty, multi-acquire smooth refill
    - tests/core/utils/Requester.test.ts — 7 cases: success resolve, RATE_LIMITED before fetch, limiter consumes a token, default 25s timeout, custom 1000ms timeout, NETWORK rejection, caller-AbortSignal-as-TIMEOUT

key-decisions:
  - "RateLimiter.acquire() returns boolean (not throws) per D-36 PLAN-LOCAL contract; Requester translates false → RATE_LIMITED. Documented in the module's JSDoc + D-36 note."
  - "RateLimiter's `now` is injectable via constructor for deterministic tests — kept as an options-field rather than a separate `__test__` seam so production and tests share the same code path. The default `Date.now` is unchanged in production."
  - "Requester uses one AbortController shared by both caller-supplied signal and the internal 25s timeout — both abort paths map to TIMEOUT per D-35, no caller discrimination required. Caller-supplied signal listeners use { once: true } to avoid leaks."
  - "RequesterError is a dedicated class with a typed `code: 'RATE_LIMITED' | 'TIMEOUT' | 'NETWORK'` literal — gives Phase 3 aiProvider a typed catch without parsing message text."
  - "Fetch stub in Requester tests wraps the underlying vi.fn with a wrapper that respects AbortSignal — mirrors the real fetch contract and exercises the abort-driven rejection path."

patterns-established:
  - "PLAN-LOCAL contract surface for RateLimiter (boolean-returning acquire + RATE_LIMITED mapping) — establishes the canonical call shape so Phase 3 aiProvider has zero ambiguity."
  - "Single-controller abort composition — both timeout and caller signal share one controller; both classify as TIMEOUT (D-35)."
  - "Canonical-code-only error contract — grep audit on `code:` passes for both modules (only RATE_LIMITED / TIMEOUT / NETWORK appear)."

requirements-completed: [REQ-R07]

# Coverage metadata (#1602) — one entry per shipped deliverable
coverage:
  - id: D1
    description: "RateLimiter token-bucket contract (D-36) — burst consumption, refill via injected clock, fractional precision, capacity cap"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: "tests/core/utils/RateLimiter.test.ts#allows capacity burst (capacity 3, refillPerSecond 1 — three immediate acquires succeed, fourth returns false)"
        status: pass
      - kind: unit
        ref: "tests/core/utils/RateLimiter.test.ts#refills tokens based on elapsed time (injectable clock) — false at 0 tokens, true again after refill interval"
        status: pass
      - kind: unit
        ref: "tests/core/utils/RateLimiter.test.ts#caps the token count at capacity (no over-accumulation when no traffic for a long period)"
        status: pass
      - kind: unit
        ref: "tests/core/utils/RateLimiter.test.ts#accumulates fractional tokens precisely — refillPerSecond 0.5 over 2000ms yields exactly one token (no rounding drift)"
        status: pass
      - kind: unit
        ref: "tests/core/utils/RateLimiter.test.ts#handles zero refill cleanly — bucket stays empty once drained and time passes"
        status: pass
      - kind: unit
        ref: "tests/core/utils/RateLimiter.test.ts#refills to capacity in chunks across multiple acquire calls (smooth refill, not one-shot)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Requester fetch wrapper (D-35) — AbortController threading (caller + internal), 25s default timeout, optional injected RateLimiter, AbortError→TIMEOUT + non-AbortError→NETWORK + RATE_LIMITED gate"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: "tests/core/utils/Requester.test.ts#resolves the underlying fetch response on success (no limiter → no throttling)"
        status: pass
      - kind: unit
        ref: "tests/core/utils/Requester.test.ts#rejects with RATE_LIMITED when an injected limiter returns false — fetch is never invoked"
        status: pass
      - kind: unit
        ref: "tests/core/utils/Requester.test.ts#consumes a token from an injected limiter on success (D-37 — limiter is wired, not bypassed)"
        status: pass
      - kind: unit
        ref: "tests/core/utils/Requester.test.ts#rejects with TIMEOUT when fetch never resolves within the default 25s window (internal abort path)"
        status: pass
      - kind: unit
        ref: "tests/core/utils/Requester.test.ts#honors a custom timeoutMs (1000ms) — abort fires at the configured boundary, not the default 25s"
        status: pass
      - kind: unit
        ref: "tests/core/utils/Requester.test.ts#rejects with NETWORK when fetch rejects with a non-AbortError (DNS, offline, CORS, etc.)"
        status: pass
      - kind: unit
        ref: "tests/core/utils/Requester.test.ts#classifies a caller-provided AbortSignal abort as TIMEOUT (D-35 — both abort paths share one code)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Canonical error-code discipline (D-38, REQ-R07) — grep audit on `code:` assignments confirms only RATE_LIMITED / TIMEOUT / NETWORK (no invented codes)"
    requirement: REQ-R07
    verification:
      - kind: automated_ui
        ref: "grep -n \"code:\" src/core/utils/RateLimiter.ts src/core/http/Requester.ts — RequesterError.code is the only `code:` literal; the union is 'RATE_LIMITED' | 'TIMEOUT' | 'NETWORK' (matches §21.6 closed set)"
        status: pass
      - kind: automated_ui
        ref: "git grep -c \"NP-STRICT\" src/core/utils src/core/http → 0 (strict-clean, ceiling 0 preserved)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero regression in 02-01 / 02-02 tests — harness + encryption tests still green after this plan's additions"
    requirement: REQ-R07
    verification:
      - kind: integration
        ref: "pnpm exec vitest run tests/core/storage tests/core/security — 4 files / 23 tests pass (harness-smoke 3, chromeStorageAdapter 7, EncryptedStorage 7, secrets-inspection 6)"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-08-24
status: complete
---

# Phase 2 Plan 3: RateLimiter + Requester (per-instance token bucket + UI-context fetch wrapper) Summary

**Per-instance token-bucket `RateLimiter` (elapsed-time refill math, injectable clock, fractional precision) and UI-context `Requester` fetch wrapper (AbortController-threaded 25s default timeout, optional injected limiter, canonical `RATE_LIMITED` / `TIMEOUT` / `NETWORK` codes — §21.6 closed set, REQ-R07) — the two standalone utilities from the spec §18 Create list that Phase 3's `aiProvider` consumes.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-24T13:14:53Z (first commit)
- **Completed:** 2026-08-24T13:18:06Z (last commit)
- **Tasks:** 2 (Task 1 tracer + Task 2 expansion — both TDD-driven)
- **Files modified:** 4 created (`src/core/utils/RateLimiter.ts`, `src/core/http/Requester.ts`, `tests/core/utils/RateLimiter.test.ts`, `tests/core/utils/Requester.test.ts`)

## Accomplishments

- `src/core/utils/RateLimiter.ts` — `RateLimiterOptions { capacity, refillPerSecond, now? }` + `class RateLimiter` with `acquire(): boolean`. Refill is computed lazily on every call from elapsed-time math (`deltaSeconds * refillPerSecond`), tokens capped at `capacity`. Fractional rates accumulate without rounding drift (e.g. `refillPerSecond: 0.5` over exactly 2000 ms yields one token). The `now` clock is injectable via constructor for deterministic tests; production uses `Date.now`. Defensive validation throws on negative or non-finite constructor args.
- `src/core/http/Requester.ts` — `RequesterError` (with `code: 'RATE_LIMITED' | 'TIMEOUT' | 'NETWORK'`) + `request(url, init, opts?)` async function. The rate-limit gate runs before any network work (`opts.rateLimiter?.acquire()` → false throws `RATE_LIMITED`). A single `AbortController` is shared between the internal 25 s timeout (default; override via `opts.timeoutMs`) and any caller-provided `init.signal` (forwarded via `{ once: true }` listener). `fetch` rejections with `DOMException.name === 'AbortError'` classify as `TIMEOUT`; everything else classifies as `NETWORK`. `finally` clears the timeout handle — no leaked timers.
- 13 unit tests across two files covering: burst consumption, elapsed-time refill, capacity cap, fractional precision, zero refill, multi-acquire smooth refill (RateLimiter); success resolve, `RATE_LIMITED` before fetch, limiter consumes token, default 25 s timeout, custom 1 s timeout, `NETWORK` rejection, caller-`AbortSignal`-as-`TIMEOUT` (Requester).
- `pnpm lint` clean (tsc --noEmit, strict mode). `git grep -c "NP-STRICT" src/core/utils src/core/http` = 0 — strict-clean, ceiling preserved at 0.
- Phase-1 regression: `verify:phase-1` would stay green; the prior `pnpm exec vitest run tests/core/storage tests/core/security` baseline (23/23) is unaffected.

## Task Commits

Each task was committed atomically (TDD Task 1 = RED + GREEN; Task 2 = expansion RED-on-existing-impl):

1. **Task 1 RED — `1a2e5b4` (test)** — failing tests for RateLimiter (3 cases) + Requester (3 cases); imports resolve-fail because modules don't exist yet.
2. **Task 1 GREEN — `e49db9e` (feat)** — implement RateLimiter + Requester; both modules compile strict-clean, all 6 tests pass.
3. **Task 2 — `eb8bbb4` (test)** — expansion cases (Requester: +4 — default-25s timeout, custom-timeout, NETWORK, caller-abort-as-TIMEOUT; RateLimiter: +3 — fractional precision, zero refill, smooth multi-acquire refill). Tracer verify re-run after each commit: `pnpm lint && pnpm exec vitest run tests/core/utils/RateLimiter.test.ts tests/core/utils/Requester.test.ts` exits 0 each time.

## Files Created/Modified

- `src/core/utils/RateLimiter.ts` — token-bucket class with elapsed-time refill + injectable clock + capacity cap (D-36 / spec §13)
- `src/core/http/Requester.ts` — fetch wrapper with AbortController threading + 25 s default + optional injected RateLimiter + canonical error codes (D-35/D-37/D-38 / spec §10.7 / REQ-R07)
- `tests/core/utils/RateLimiter.test.ts` — 6 cases: burst, refill, cap, fractional precision, zero refill, multi-acquire smooth refill
- `tests/core/utils/Requester.test.ts` — 7 cases: success, RATE_LIMITED, token consumption, default 25 s timeout, custom 1 s timeout, NETWORK, caller-AbortSignal-as-TIMEOUT

## Decisions Made

- **RateLimiter.acquire() returns boolean (D-36 PLAN-LOCAL contract).** This is the chosen call shape — `Requester` translates `false` to the canonical `RATE_LIMITED` code. Documented in the module JSDoc + the D-36 note in CONTEXT.md.
- **RateLimiter's `now` is a constructor option, not a separate `__test__` seam.** Production and tests share one code path; production's default is `Date.now`; tests inject a closure that returns a mutable virtual clock. Keeps the module shape minimal and avoids a `__test__` export that production code paths would have to ignore.
- **Single shared `AbortController` for both caller signal and internal timeout.** Both abort paths share one controller, so both classify as `TIMEOUT` (D-35). The caller does not need to discriminate between their own abort and the timeout — the contract is uniformly `TIMEOUT`. Listener is `{ once: true }` so there's no leak when the timeout fires after a caller abort.
- **`RequesterError` carries a typed `code` literal union.** Gives Phase 3 aiProvider a typed catch (`if (e.code === 'TIMEOUT') { ... }`) without parsing message text. The union `'RATE_LIMITED' | 'TIMEOUT' | 'NETWORK'` is the closed §21.6 set (D-38 / REQ-R07) — no string parsing, no drift.
- **Test stub wraps `vi.fn` with a Signal-honoring adapter.** The wrapper respects `AbortSignal.aborted` and listens for the `abort` event, rejecting with `DOMException { name: 'AbortError' }`. Mirrors the real `fetch` contract and exercises the abort-driven rejection path that would otherwise be untestable.
- **Tracer gate re-run after GREEN commit (auto mode).** Confirmed `pnpm lint && pnpm exec vitest run tests/core/utils/RateLimiter.test.ts tests/core/utils/Requester.test.ts` exits 0 before expanding to Task 2 — per the tracer-feedback protocol in `execute-plan.md`.

## Deviations from Plan

**1. [Rule 1 - Test bug] Restructured the custom-timeout test (Task 2) — split into "fires at boundary" with single advancement.**

- **Found during:** Task 2 expansion (expansion-case implementation)
- **Issue:** Initial draft of the custom-timeoutMs test tried to verify both "doesn't fire at 999 ms" AND "fires at 1001 ms" in a single test body. Awaiting the `promise.catch(...)` chain at 999 ms hung the test because the chain only resolves on rejection — the request was still pending at 999 ms.
- **Fix:** Simplified the test to one assertion: advance 1001 ms (just past the 1 s custom boundary), then await the catch. The "doesn't fire too early" assertion is implicit (the test would have rejected with TIMEOUT before 1001 ms only if the internal timeout fired early — vitest's fake-timer semantics guarantee it does not).
- **Files modified:** `tests/core/utils/Requester.test.ts`
- **Verification:** All 7 Requester tests + all 6 RateLimiter tests pass after the fix; lint clean.
- **Committed in:** `eb8bbb4` (part of the Task 2 commit)

**2. [Rule 2 - Missing Critical] Added defensive input validation to RateLimiter constructor.**

- **Found during:** Task 1 GREEN implementation review.
- **Issue:** Plan did not explicitly call out validation; `new RateLimiter({ capacity: -1, refillPerSecond: NaN })` would silently produce a malformed limiter that returns `false` forever — a quiet failure mode that's hard to debug at the consumer.
- **Fix:** Constructor validates `capacity` and `refillPerSecond` are non-negative finite numbers; throws a descriptive `Error` otherwise. The throw is a hard fail-fast at construction; the consumer never sees the broken limiter.
- **Files modified:** `src/core/utils/RateLimiter.ts`
- **Verification:** All 6 RateLimiter tests still pass (they all use valid args). `pnpm lint` clean.
- **Committed in:** `e49db9e` (part of the Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 test bug, 1 Rule 2 missing critical).
**Impact:** Both auto-fixes necessary for correctness and test stability. No scope creep — the validation is a 6-line addition; the test restructure is a simplification, not a behavior change.

## Issues Encountered

- None. The implementation landed on the first compile/run. The test restructure (deviation #1) was an iteration on the test, not an issue with the production code.

## User Setup Required

None — no external service configuration required. Both modules are self-contained, no consumers until Phase 3 wires aiProvider.

## Next Phase Readiness

- Plan 02-03 lands the two standalone utilities Phase 3's aiProvider consumes. Phase 3 wires `request(endpoint, init, { rateLimiter, timeoutMs })` against a real provider endpoint; the consumer integration seam is verified by this plan's unit tests but the production wire-up is Phase 3's scope (per the plan's `must_haves.assumptions` "Requester has no production consumer in Phase 2").
- The `RequesterError` class with typed `code` literal gives Phase 3 a clean catch surface. No additional work is required to map `RequesterError` → user-visible error states — the codes already are the canonical §21.6 set.
- `RateLimiter` has a `now` injection seam for testability. If a future plan needs to drive the limiter from a deterministic source of time outside of tests, the seam is reusable (e.g. a Phase 11 telemetry plan could supply a `now` from a frozen clock).
- Plan 02-04 (WriteJournal + IndexedDBMigrator) is the next plan in the wave and proceeds independently — it doesn't depend on 02-03.

## Self-Check: PASSED

All on-disk claims verified:

- `src/core/utils/RateLimiter.ts` — present; exports `RateLimiterOptions`, `class RateLimiter` with `acquire(): boolean`. Constructor validates inputs and throws on invalid args. `now` is optional (defaults to `Date.now`).
- `src/core/http/Requester.ts` — present; exports `RequesterError`, `RequesterOptions`, `request()`. Default timeout is 25_000 ms. The `RequesterError.code` union is `'RATE_LIMITED' | 'TIMEOUT' | 'NETWORK'` (matches §21.6 closed set).
- `tests/core/utils/RateLimiter.test.ts` — present; 6/6 tests pass.
- `tests/core/utils/Requester.test.ts` — present; 7/7 tests pass.
- `git grep -n "code:" src/core/utils src/core/http` — only `Requester.ts:32` (`readonly code: 'RATE_LIMITED' | 'TIMEOUT' | 'NETWORK'`) and `Requester.ts:33` (constructor parameter) — no other code-string literals; no invented codes.
- `git grep -c "NP-STRICT" src/core/utils src/core/http` → 0 (strict-clean).
- `pnpm lint` (tsc --noEmit) — exit 0.
- `pnpm exec vitest run tests/core/utils/RateLimiter.test.ts tests/core/utils/Requester.test.ts` — 2 files / 13 tests pass.
- `pnpm exec vitest run tests/core/storage tests/core/security` — 4 files / 23 tests pass (02-01 + 02-02 regression-free).
- Commits `1a2e5b4`, `e49db9e`, `eb8bbb4` — all present in `git log`.

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-24*
