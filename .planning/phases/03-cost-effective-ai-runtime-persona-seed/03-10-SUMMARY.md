---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 10
subsystem: ai-runtime
tags: [provider-router, retry-budget, r-2, d-17, cr-01, vitest, circuit-breaker]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: 03-05 ProviderRouter (createStageInvocation, D-17 retry, R-2 budget) + 03-06 AgentOrchestrator (runAgentTurn, Appendix-I loop)
provides:
  - "retryCount field on RouterAttemptState — the R-2 budget is scoped to router-owned (D-17) retries only; legitimate sequential stage calls and structured-output repairs never consume it"
  - "permanent orchestrator-level CR-01 regression (tests/core/ai/AgentOrchestrator.budget.test.ts): real Router + real budget, medium-tier 2-tool turn completes with an answer"
  - "updated ProviderRouter unit budget test asserting retry-scoped exhaustion + a companion assertion that a first call leaves retryCount at 0"
affects: [03-11, 03-12, 03-13, 03-14, phase-3 verification re-run, verify-work UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Retry-scoped budget: observability ledger (attempts: ProviderAttempt[]) and the R-2 retry budget (retryCount) are distinct RouterAttemptState fields; gates read retryCount only"
    - "Regression tests must exercise the REAL budget interplay — real Router + real resolveTier + real stage services with only ai-sdk call sites stubbed (vi.mock('ai') keeping real error classes)"

key-files:
  created:
    - tests/core/ai/AgentOrchestrator.budget.test.ts
  modified:
    - src/core/ai/ProviderRouter.ts
    - tests/core/ai/ProviderRouter.test.ts

key-decisions:
  - "R-2 budget counts ONLY D-17 router-owned retried calls: attempt(isRetry) param — first call per stage/repair passes false, the retried call passes true; recordAttempt increments retryCount only when isRetry"
  - "attemptCount accessor removed (became unused once both budget gates switched to retryCount)"
  - "Regression test 3 uses a 2-provider resolver: the D-17 retry leaves a failed ledger entry, and the (unchanged) fallback-chain failed-provider skip advances the next planner stage — a single-provider config cannot complete a retried multi-stage turn post-fix"

patterns-established:
  - "Budget gates live at BOTH entry points (createStageInvocation + the inner attempt closure) and share the same retryCount accessor"

requirements-completed: [AI-02, AI-04, AI-07]

coverage:
  - id: D1
    description: "R-2 retry budget scoped to router-owned retries — RouterAttemptState.retryCount, attempt(isRetry), recordAttempt(..., isRetry), both budget gates on retryCount"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#terminates with no_candidate ONLY after 3 router-owned retries exhaust the R-2 budget (CR-01)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#a legitimate FIRST call of a stage never consumes the R-2 retry budget (CR-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Permanent orchestrator-level CR-01 regression: a legitimate medium-tier 2-tool turn completes with an answer (never no_candidate); repair and D-17-retry turns complete too"
    requirement: AI-02
    verification:
      - kind: integration
        ref: "tests/core/ai/AgentOrchestrator.budget.test.ts#a medium-tier 2-tool turn completes with an answer — the renderer runs, never no_candidate"
        status: pass
      - kind: integration
        ref: "tests/core/ai/AgentOrchestrator.budget.test.ts#a 1-tool turn whose first planner call needs a structured-output repair still completes"
        status: pass
      - kind: integration
        ref: "tests/core/ai/AgentOrchestrator.budget.test.ts#a D-17 retried planner call consumes the retry budget but the turn still answers"
        status: pass
    human_judgment: false
  - id: D3
    description: "Housekeeping — the throwaway zz-verify-cr01.test.ts temp reproduction is absent and the permanent regression replaces it"
    verification:
      - kind: unit
        ref: "test ! -f tests/core/ai/zz-verify-cr01.test.ts && ! grep -rn 'zz-verify-cr01' tests/ src/"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-08-11
status: complete
---

# Phase 3 Plan 10: CR-01 — R-2 Budget Scoped to Router-Owned Retries Summary

**retryCount field on RouterAttemptState + retry-scoped budget gates in ProviderRouter.ts, an updated retry-scoped unit budget test, and a permanent orchestrator-level regression (real Router + real budget) proving a medium-tier 2-tool turn completes with an answer**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-11T00:56:00Z
- **Completed:** 2026-08-11T01:12:00Z
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- **CR-01 closed:** `RouterAttemptState` gains `retryCount`; both R-2 budget gates (`createStageInvocation` + `buildCallProviderJsonMode`'s inner `attempt()`) now check `retryCount >= ROUTER_MAX_ATTEMPTS` instead of the total per-operation SDK-call ledger — legitimate sequential stage calls and structured-output repairs never consume the budget; exactly the D-17 retried call does.
- **Permanent regression replaces the throwaway:** `tests/core/ai/AgentOrchestrator.budget.test.ts` runs a REAL `ProviderRouter` (default budget), REAL `resolveTier` (openai/deepseek-chat resolves for haiku+flash), and REAL Planner/Executor/Renderer services — only the three ai-sdk call sites are stubbed (real error classes kept via `importOriginal`). Three tests reproduce the VERIFICATION.md failure and prove the fix: 2-tool medium turn → answer; 1-tool turn with structured-output repair → answer (repair never consumes the budget); D-17 retried planner call → retryCount=1, still answers.
- **Pre-fix reproduction confirmed:** with the pre-fix router temporarily restored, all 3 regression tests fail with `PROVIDER_UNAVAILABLE: no_candidate (router attempt budget exhausted)` at the renderer resolution — the exact CR-01 signature; the fix was restored and the suite re-verified.
- **Housekeeping done:** `tests/core/ai/zz-verify-cr01.test.ts` verified absent (never tracked, zero code references) — no stale temp reproduction remains.
- **Full gate green:** `verify:phase-3` (eslint + prettier + tsc --noEmit + wxt build + vitest + isolation) exits 0 — 57 files / 450 tests pass (was 56/446; +3 from the new regression file, +1 from the budget-test rewrite).

## Task Commits

Each task was committed atomically:

1. **Task 1: Housekeeping — remove the leftover zz-verify-cr01.test.ts throwaway** - no commit (verification-only: file absent, never tracked, zero references; nothing to delete)
2. **Task 2: CR-01 — scope the R-2 budget to router-owned retries** - `5833452` (feat)
3. **Task 3: CR-01 — permanent orchestrator-level regression test** - `9a4dfe9` (test)

_Note: Task 1 required no commit — the plan's mandate was to verify/ensure the throwaway's absence, which held (the file was already gone and never tracked)._

## Files Created/Modified

- `src/core/ai/ProviderRouter.ts` - `retryCount` field on `RouterAttemptState`; private `retryCount(operationId)` accessor; both budget gates (createStageInvocation + inner attempt) now check retryCount; `attempt(isRetry)` closure param; `recordAttempt(..., isRetry)` increments retryCount only when true; `attemptCount` accessor removed (unused)
- `tests/core/ai/ProviderRouter.test.ts` - the budget-exhaustion test rewritten to retry-scoped semantics: a 3-provider chain (all native jsonMode) drives 3 retry cycles so the BUDGET GATE (not chain exhaustion) terminates with `no_candidate` + detail `router attempt budget exhausted`; companion test asserts a legitimate first call leaves `retryCount === 0`; all other tests untouched and passing
- `tests/core/ai/AgentOrchestrator.budget.test.ts` - NEW permanent CR-01 regression (3 tests): real Router + real budget + real stage services; medium-tier 2-tool turn resolves `reasonCode: 'success'` with `streamText` called once; repair turn resolves; D-17 retry turn resolves with `retryCount === 1`

## Decisions Made

- **R-2 budget = router-owned retries only** (03-REVIEW.md CR-01 fix sketch, verbatim): the observability ledger (`attempts`) and the retry budget (`retryCount`) are separate `RouterAttemptState` fields; a structured-output repair or a stage's first invocation passes `isRetry=false`.
- **`attemptCount` removed** — the plan allowed removing it if it became unused; both gates switched to `retryCount`, leaving it dead.
- **Regression test 3 uses a 2-provider resolver** — the D-17 retry leaves a `failed` ledger entry and the unchanged fallback-chain failed-provider skip advances the next planner stage; a single-provider config cannot complete a retried multi-stage turn post-fix (see deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Regression test 3's single-provider resolver cannot complete a retried turn post-fix**
- **Found during:** Task 3 (D-17 retry regression test)
- **Issue:** The plan's `makeResolver` sketch configures only `openai`. After a retryable failure, the D-17 retry leaves a `failed` ledger entry for openai, and the (correctly unchanged) fallback-chain failed-provider skip in `createStageInvocation` means the NEXT planner stage resolution throws plain `no_candidate` (chain exhaustion) — so a retried turn can never reach the renderer with a single configured provider, and the test's own assertion ("the turn still completes with an answer") is unsatisfiable with the literal sketch.
- **Fix:** Parameterized `makeResolver(router, providers)` and test 3 passes a second provider (`anthropic`, priority 2). The retried call still consumes `retryCount=1`; the second planner stage falls back to anthropic; the renderer resolution then exercises the retry+renderer interplay against the budget exactly as the plan intended (pre-fix this fails at the renderer with the budget `no_candidate`).
- **Files modified:** tests/core/ai/AgentOrchestrator.budget.test.ts
- **Verification:** test 3 passes post-fix; fails pre-fix at the renderer resolution with the budget detail (confirmed during the pre-fix reproduction run)
- **Committed in:** 9a4dfe9 (Task 3 commit)

**2. [Rule 3 - Blocking] Prettier gate failure on ProviderRouter.ts after Task 2**
- **Found during:** plan-level verification (`verify:phase-3` prettier check)
- **Issue:** the added `recordAttempt(..., 'success', undefined, isRetry)` call exceeded prettier's print width.
- **Fix:** `npx prettier --write src/core/ai/ProviderRouter.ts` (wrap only; no logic change).
- **Files modified:** src/core/ai/ProviderRouter.ts
- **Verification:** `verify:phase-3` re-run exits 0
- **Committed in:** 5833452 (folded into the Task 2 commit via restructure)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes were necessary to satisfy the plan's own acceptance criteria. No scope creep; the R-2 semantic (retryCount only) is exactly the CR-01 fix sketch.

## Issues Encountered

- **Amend landed on the wrong commit** — after the prettier fix I ran `git commit --amend` while HEAD pointed at the Task 3 commit, folding the router formatting fix into the test commit. Resolved by `git reset --soft HEAD~2 && git reset` (working tree untouched) and re-committing in the correct order: Task 2 (`5833452`), Task 3 (`9a4dfe9`). Final tree and history are clean; both commits pass all checks.
- **Pre-fix reproduction used `git checkout HEAD~1 --` instead of `git stash`** — the plan's verification step says "git stash the ProviderRouter.ts change", but the fix was already committed by the time the regression existed, so a stash of the committed file is a no-op. Temporarily restored the pre-fix router from `HEAD~1`, ran the regression (3/3 fail with the exact `no_candidate (router attempt budget exhausted)` signature at the renderer resolution), then restored the fix.
- **Initial 3-test failure in ProviderRouter.test.ts (mock-queue pollution)** — my first version of the rewritten budget test used an `ollama` third provider, which routes through the `generateText` prompt-mode path (never queued), and a persistent `generateTextMock` implementation leaked across tests via `vi.clearAllMocks()` not clearing persistent implementations. Fixed by switching the chain to all-native providers (openai → anthropic → gemini).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-01 is closed: `planner_cap_reached` / `tool_cap_reached` / `answer` terminals are reachable in the integrated path (the regression proves the 2-tool turn resolves with `answer`).
- The `retryCount` field is the observable surface for the remaining waves: 03-11 (WR-01 registry gate), 03-12 (WR-02 breaker wiring), 03-13 (WR-03 timeout classification), 03-14 (WR-04 retry targeting) proceed independently — no RouterAttemptState shape changes are expected from them.
- Remaining gaps for phase re-verification: WR-01..WR-04 are addressed by plans 03-11..03-14; the phase's `verify:phase-3` gate remains the acceptance mechanism.

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: tests/core/ai/AgentOrchestrator.budget.test.ts (created)
- FOUND: src/core/ai/ProviderRouter.ts (modified, committed in 5833452)
- FOUND: tests/core/ai/ProviderRouter.test.ts (modified, committed in 5833452)
- FOUND: .planning/phases/03-cost-effective-ai-runtime-persona-seed/03-10-SUMMARY.md
- FOUND: commit 5833452 (feat(03-10): scope R-2 budget to router-owned retries)
- FOUND: commit 9a4dfe9 (test(03-10): permanent CR-01 regression)
- FOUND: tests/core/ai/zz-verify-cr01.test.ts absent + zero tests/ src/ references
- PASS: verify:phase-3 full gate exits 0 (57 files / 450 tests + isolation clean)
