---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 12
subsystem: ai-runtime
tags: [circuit-breaker, stream-freeze, provider-router, renderer, streaming, wr-02]

requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: ProviderRouter breaker/stream-freeze contracts (03-05) — recordFailure / markStreamedFirstToken / isAbortError
provides:
  - WR-02 closed: RendererService.render() votes the breaker on provider-originated stream failures (catch + non-stop finish) and freezes the provider on the first streamed token
  - The §1.5 stream_frozen guard in createStageInvocation is now reachable (D-14 no-switch invariant enforced on the only production streaming path)
  - 4 regression tests pin the four streaming outcomes: fail, clean stop, user abort, non-stop finish
affects: [03-13, 03-14, phase-3 verification, verify-work UAT]

tech-stack:
  added: []
  patterns:
    - "Prototype-chain-agnostic isAbortError name-match (AgentOrchestrator L204-211 canonical pattern) — DOMException is not instanceof Error in the jsdom-align test realm"
    - "vi.mock with importOriginal spread for a module that exports BOTH real helpers (buildStageMessages/CACHED_KINDS/joinSections) and a stubbed singleton accessor (getProviderRouter) — ProviderRouter.test.ts L46-53 precedent"

key-files:
  created: []
  modified:
    - src/core/ai/RendererService.ts
    - tests/core/ai/RendererService.test.ts

key-decisions:
  - "Non-stop finish branch calls recordFailure WITHOUT the err argument: the plan sketch's `err` is out of scope there (no error object exists for a finishReason !== 'stop' terminal); the third param is optional (err?: unknown) and passing nothing avoids fabricating error state (T-03-12-03 keeps the log lean)"
  - "isAbortError uses the prototype-chain-agnostic name-match (typeof err === 'object' && err.name === 'AbortError') instead of the plan's literal `err instanceof Error && err.name === 'AbortError'` — the instanceof form fails in the jsdom-align test realm where DOMException does not extend Error, and the codebase canonical pattern (AgentOrchestrator L204-211) is already name-only"
  - "Header doc comment reworded to avoid the literal tokens recordFailure/markStreamedFirstToken — the acceptance-criteria greps require exactly 2/1 occurrences in the file and the comment would have inflated the counts"

patterns-established:
  - "Breaker voting originates ONLY from provider-originated failures: catch guards with isAbortError (user aborts never vote); non-stop finish (content-filter/length) is a provider behavior and votes unguarded (T-03-12-01)"
  - "firstTokenMarked boolean flag guarantees exactly ONE markStreamedFirstToken per render — the D-14 stream_frozen invariant (T-03-12-02)"

requirements-completed: [AI-03, AI-04]

coverage:
  - id: D1
    description: "Mid-stream provider failures vote the breaker — catch + non-stop finish branches call getProviderRouter().recordFailure(providerId, STREAM_FAILED)"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#a mid-stream rejection votes the breaker with the provider id + STREAM_FAILED, and the first delta froze the operation"
        status: pass
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#a non-stop finish (content-filter/length) votes the breaker — a provider behavior, never a user abort"
        status: pass
    human_judgment: false
  - id: D2
    description: "First streamed token freezes the provider — markStreamedFirstToken(operationId) called exactly once per render, making the §1.5 stream_frozen guard in createStageInvocation reachable"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#the first streamed delta marks the provider frozen (never switches) — clean stop path does not vote"
        status: pass
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#a user abort does NOT vote the breaker (isAbortError guard), but the first token still froze the op"
        status: pass
    human_judgment: false
  - id: D3
    description: "User aborts never vote the breaker — isAbortError guard in the catch discriminates user-origin aborts from provider-originated failures before recordFailure"
    requirement: AI-03
    verification:
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#a user abort does NOT vote the breaker (isAbortError guard), but the first token still froze the op"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-08-11
status: complete
---

# Phase 3 Plan 12: WR-02 Breaker + Stream-Freeze Wiring in RendererService Summary

**RendererService.render() now votes the circuit breaker on provider-originated mid-stream failures (catch + non-stop finish branches) and freezes the provider on the first streamed token — the §1.5 stream_frozen guard is reachable on the only production streaming path, closing VERIFICATION.md gap WR-02.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-11T01:15:35Z
- **Completed:** 2026-08-11T01:24:00Z
- **Tasks:** 2 (2 auto)
- **Files modified:** 2

## Accomplishments

- WR-02 closed: `RendererService.render()` catch + non-stop `finishReason !== 'stop'` branches call `getProviderRouter().recordFailure(providerId, ERROR_CODES.STREAM_FAILED, ...)` — a provider failing mid-stream now accrues breaker votes instead of being retried every turn
- D-14/§1.5 stream-freeze wiring: the delta loop calls `markStreamedFirstToken(operationId)` exactly once (firstTokenMarked flag) — `hasStreamedFirstToken` is no longer permanently false, so `createStageInvocation`'s stream_frozen guard can fire and the never-switch-after-first-token invariant is enforced in production
- Abort discrimination (T-03-12-01): a local `isAbortError` guard (codebase-canonical prototype-chain-agnostic name-match) prevents user aborts from ever voting the breaker — only provider-originated failures vote
- 4 regression tests pin the four streaming outcomes: mid-stream rejection votes, clean stop freezes without voting, user abort does not vote but still freezes, non-stop finish votes
- Full `verify:phase-3` gate green: eslint + prettier + tsc --noEmit + wxt build + vitest run (57 files / 454 tests) + isolation check — all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-02 — wire recordFailure + markStreamedFirstToken into RendererService.render()** - `3d51ba6` (feat)
2. **Task 2: WR-02 — regression tests (breaker votes + first-token freeze + abort exclusion)** - `eb66eb5` (test)
3. **Task 1 follow-up: prettier reformat of the WR-02 wiring (line wraps) + isAbortError pattern alignment** - `e3ba218` (style)

**Plan metadata:** `docs(03-12)` (commit after SUMMARY)

## Files Created/Modified

- `src/core/ai/RendererService.ts` - render() catch votes via recordFailure (abort-guarded); non-stop finish branch votes; delta loop marks first token once via firstTokenMarked; local isAbortError helper; module header doc updated with WR-02 wiring notes
- `tests/core/ai/RendererService.test.ts` - partial `vi.mock('@/core/ai/ProviderRouter')` with importOriginal spread + vi.hoisted routerMock (stubs ONLY getProviderRouter, keeps real buildStageMessages/CACHED_KINDS/joinSections); beforeEach clears routerMock; 4 new regression tests

## Decisions Made

- **recordFailure err arg omitted in the non-stop branch:** the plan sketch's `err` is out of scope there — a `finishReason !== 'stop'` terminal has no error object. The third param is optional (`err?: unknown`); passing nothing avoids fabricating error state and keeps T-03-12-03's redaction lean.
- **isAbortError pattern aligned to the codebase canonical form:** the plan's literal `err instanceof Error && err.name === 'AbortError'` fails in the jsdom-align test realm (DOMException is not instanceof Error there — verified: test c's DOMException produced a breaker vote before the fix). Switched to the prototype-chain-agnostic name-match used by AgentOrchestrator L204-211 (typeof object + name === 'AbortError').
- **Header comment kept token-free:** plan instruction 8 (document the wiring in the header) conflicts with the acceptance-criteria greps (exactly 2 `recordFailure` / 1 `markStreamedFirstToken` occurrences in the file) — the comment documents the wiring without the literal token names.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] isAbortError instanceof form fails in the jsdom test realm — user aborts would vote the breaker**
- **Found during:** Task 2 (test c 'a user abort does NOT vote the breaker' — failed with `recordFailure` called once)
- **Issue:** The plan's literal sketch `err instanceof Error && err.name === 'AbortError'` returns false for `new DOMException('aborted', 'AbortError')` in the jsdom-align environment (DOMException does not extend Error across realms), so the catch's guard failed to exclude the user abort and `recordFailure` was invoked — violating T-03-12-01 (user aborts never vote).
- **Fix:** Switched to the codebase-canonical prototype-chain-agnostic name-match (`typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'`), identical to AgentOrchestrator L204-211 / the PATTERNS.md shared pattern.
- **Files modified:** src/core/ai/RendererService.ts
- **Verification:** `pnpm vitest run tests/core/ai/RendererService.test.ts` — 13/13 pass (test c now asserts recordFailure NOT called)
- **Committed in:** e3ba218 (bundled with the prettier reformat)

**2. [Rule 1 - Bug] Header doc comment inflated the acceptance-criteria greps**
- **Found during:** Task 1 verification (grep counts read 3 `recordFailure` / 2 `markStreamedFirstToken` instead of the required 2/1)
- **Issue:** The module header comment added per plan instruction 8 contained the literal tokens `recordFailure` and `markStreamedFirstToken`, breaking the task's exact-count acceptance criteria.
- **Fix:** Reworded the comment to describe the WR-02 wiring (breaker votes through the Router singleton, isAbortError guard, first-delta freeze) without the literal token names.
- **Files modified:** src/core/ai/RendererService.ts
- **Verification:** `grep -c 'recordFailure'` = 2, `grep -c 'markStreamedFirstToken'` = 1 — matching the acceptance criteria exactly
- **Committed in:** 3d51ba6 (part of the Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for correctness — the isAbortError form fix is what makes the abort-exclusion test pass (T-03-12-01's core guarantee), and the comment reword keeps the plan's own acceptance greps satisfiable. No scope creep.

## Issues Encountered

- Prettier flagged `src/core/ai/RendererService.ts` in the full gate after the Task 1 commit — fixed with `prettier --write` (line wraps only, no behavior change) and committed as `e3ba218`.
- Pre-existing uncommitted wave files in the working tree (`.planning/STATE.md`, `README.md`, `tests/isolation/check-content-bundle.mjs`) were left untouched — only plan-owned files were staged per commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-02 closed — the circuit breaker and stream-freeze guard now protect the streaming path as VERIFICATION.md required. The grep `recordFailure|markStreamedFirstToken` now shows `src/core/ai/RendererService.ts` as the production caller.
- Next plans in wave 7: 03-13, 03-14 (WR-01/WR-03/WR-04/WR-05/WR-06/WR-07 gap fixes per the 03-PATTERNS.md replan).
- After the remaining gap-closure plans land, re-running the phase verifier should move SC3 from `✗ FAILED` to verified (CR-01 already closed by 03-10; WR-02 closed here; WR-01/WR-03/WR-04 pending).

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-12-SUMMARY.md`
- FOUND: `src/core/ai/RendererService.ts` (modified — recordFailure ×2, markStreamedFirstToken ×1, isAbortError helper)
- FOUND: `tests/core/ai/RendererService.test.ts` (modified — partial router mock + 4 regression tests)
- Commits verified in git log: `3d51ba6` (feat), `eb66eb5` (test), `e3ba218` (style), `b043bb1` (docs)
- `pnpm vitest run tests/core/ai/RendererService.test.ts` → 13/13 pass
- `pnpm run verify:phase-3` → exit 0 (57 files / 454 tests, isolation clean)
