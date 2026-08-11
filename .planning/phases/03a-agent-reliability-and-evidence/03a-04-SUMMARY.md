---
phase: 03a-agent-reliability-and-evidence
plan: 04
subsystem: ai
tags: [agent-reliability, agent-turn-outcome, status-mapping, d-3a-19, d-20-fence-inversion, test-migration, streaming-hook]

# Dependency graph
requires:
  - phase: 03a-agent-reliability-and-evidence (03a-01)
    provides: C.1 AgentTurnOutcome (4-value status union), AgentTurnOutcomeSchema
  - phase: 03a-agent-reliability-and-evidence (03a-03)
    provides: runAgentTurn → AgentTurnOutcome rewire (streamedText/toolResults left the struct; trajectory, buildOutcome, replan, pause seam), buildOutcome terminal authority (partial/cap_exhausted, failed/planner_failed, failed/provider_unconfigured)
provides:
  - src/components/pages/useStreamingLLM.ts — the D-3a-19 honest status mapping: completed → completed; partial|failed → failed (partial text retained + Retry, never completed); aborted → idle; provider_unconfigured stays a failed terminal
  - tests/core/ai/AgentOrchestrator.test.ts — D-20 fence INVERTED (source must reference AgentTurnOutcome|OutcomeVerifier|trajectory); AgentTurnOutput→AgentTurnOutcome shape flips; cap reasonCodes → status partial + cap_exhausted; ask_clarification reworked to the pause seam
  - tests/core/ai/AgentOrchestrator.budget.test.ts — { reasonCode:'success' } → { status:'completed' }; CR-01 regression intent preserved (renderer ran, streamText ×1, retryCount 0/1)
  - tests/components/pages/useStreamingLLM.test.tsx — 4 new D-3a-19 mapping tests (partial→failed text-retained, failed→failed, aborted→idle, completed→completed)
affects: [03a-05, Phase 7 RICH stage indicators (rich presentation of partial/aborted), Phase 8 PermissionDialog + TOL-02/03]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies — pure in-repo TypeScript on the approved stack
  patterns:
    - "Honest terminal mapping (D-3a-19): the UI state machine reads AgentTurnOutcome.status, never reasonCode-as-terminal; a capped turn is surfaced as failed (partial text + Retry) — AGT-03 honesty at the hook boundary"
    - "Migrate-don't-discard (O3): enumerated deltas only — shape flips, fence inversion, status semantics; every preserved assertion (cost-of-2-calls, onStreamDelta ordering, AbortError propagation, resolver-failure paths, CR-01 budget invariants) left untouched"

key-files:
  created: []
  modified:
    - src/components/pages/useStreamingLLM.ts
    - tests/core/ai/AgentOrchestrator.test.ts
    - tests/core/ai/AgentOrchestrator.budget.test.ts
    - tests/components/pages/useStreamingLLM.test.tsx

key-decisions:
  - "Hook mapping is status-first (D-3a-19) with the provider_unconfigured reasonCode guard retained in place: partial|failed → failed (partial text + Retry), aborted → idle, completed → completed. ChatStreamState (idle/streaming/completed/failed/offline) is unchanged — only the mapping source flipped."
  - "The D-20 fence test is INVERTED, not deleted (Pitfall 1): the orchestrator source must now match /AgentTurnOutcome|OutcomeVerifier|trajectory/ — the Phase-3 zero-tokens contract is the exact wrong contract to assert post-03a-03."
  - "ask_clarification is no longer a terminal under the 3a rewire — it pauses (waiting-for-permission, turn stays open, D-3a-15/16). The legacy consumer test was reworked to assert the onInputRequired payload + abort-wins instead of the removed 'ask_clarification' reasonCode (Rule 3 deviation)."
  - "Tool results are asserted at the render input (renderMock.mock.calls[0][0].toolResults) since they left the output struct (D-3a-18) — the renderer is where the tool result lands for narration."

patterns-established:
  - "Outcome-shape migration recipe (O3): for each legacy assertion, map AgentTurnOutput fields to their new home — streamedText → onStreamDelta ordering + render seam; toolResults → render input; reasonCode-as-terminal → status (+ reasonCode where meaningful, e.g. cap_exhausted/planner_failed/provider_unconfigured)"
  - "Consumer-fixture updates: test helpers (resolveTurn) now return the C.1 AgentTurnOutcome shape so the hook's real status mapping is what the tests exercise"

requirements-completed: [AGT-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "useStreamingLLM.ts D-3a-19 honest status mapping — completed → completed; partial/failed → failed (partial text retained + Retry, never completed); aborted → idle; provider_unconfigured stays a failed terminal"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx#useStreamingLLM — D-3a-19 honest status mapping (AGT-03) (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-20 fence test inverted — the orchestrator source must reference the reliability machinery (AgentTurnOutcome|OutcomeVerifier|trajectory); the stale zero-tokens assertion is gone (Pitfall 1)"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#AgentOrchestrator — D-20 source invariant (INVERTED by 3a, D-3a-18)"
        status: pass
      - kind: other
        ref: "grep: 0 matches of 'not.toMatch(/CompletionEvidence|OutcomeVerifier|trajectory/' in tests/"
        status: pass
    human_judgment: false
  - id: D3
    description: "AgentOrchestrator.test.ts migrated to AgentTurnOutcome (O3 enumerated) — streamedText reads removed, toolResults asserted via render input, cap reasonCodes → status partial + cap_exhausted, planner_failed/provider_unconfigured → status failed; ask_clarification reworked to the pause seam; all other invariants preserved"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts (17 tests pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "AgentOrchestrator.budget.test.ts status semantics — { reasonCode:'success' } → { status:'completed' }; the CR-01 regression intent (renderer ran, streamText ×1, generateObject counts, router retryCount 0/1) preserved and re-asserted"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.budget.test.ts (3 tests pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-08-11
status: complete
---

# Phase 3a Plan 04: Enumerated Consumer Migration Summary

**useStreamingLLM.ts reads AgentTurnOutcome.status (D-3a-19 honest partial mapping — a capped turn surfaces as failed, never completed), the D-20 fence test is inverted, and the two orchestrator suites + hook suite migrate to AgentTurnOutcome shape/status semantics with the CR-01 regression intact — full tests/core/ai/** + tests/components/** green again (the 03a-03 breakage is resolved)**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-11T23:34:29Z
- **Completed:** 2026-08-11T23:51:20Z
- **Tasks:** 6
- **Files modified:** 4 (1 source, 3 test)

## Accomplishments

- The hook's terminal mapping flipped from reasonCode-as-terminal to the D-3a-19 status mapping: `completed → { state:'completed' }`, `partial|failed → { state:'failed' }` (partial text retained + Retry — AGT-03 honesty, never 'completed'), `aborted → { state:'idle' }`; the `provider_unconfigured` guard is retained in place as a failed terminal (unchanged UX). ChatStreamState (idle/streaming/completed/failed/offline) is untouched — only the mapping source changed.
- The D-20 fence test (tests/core/ai/AgentOrchestrator.test.ts) is **inverted**, not silently removed (Pitfall 1): it now asserts the orchestrator source DOES reference the reliability machinery (`/AgentTurnOutcome|OutcomeVerifier|trajectory/`). Grep-verified: no stale `not.toMatch(...)` anywhere in tests/.
- `AgentOrchestrator.test.ts` migrated with enumerated deltas only (O3): `streamedText` reads removed (deltas flow via `onStreamDelta`; the seam test now proves ordering + render-seam instead), `toolResults` asserted at the render input (their new home in the D-3a-18 struct), `planner_cap_reached`/`tool_cap_reached` → `status 'partial'` + `reasonCode 'cap_exhausted'` (AGT-03), `planner_failed` → `status 'failed'`, `provider_unconfigured` → `status 'failed'` + `reasonCode 'provider_unconfigured'` (no model call). All other invariants preserved: cost-of-2-calls, onStreamDelta ordering, AbortError propagation, resolver-failure paths, capsForTier verbatim shape, §1.4 loop bounds.
- `AgentOrchestrator.budget.test.ts` flips `{ reasonCode: 'success' }` → `{ status: 'completed' }` at all three outcome assertions; the CR-01 regression intent is preserved and re-asserted (renderer ran — streamText ×1, generateObject counts, router retryCount 0/1).
- `useStreamingLLM.test.tsx` gains 4 new D-3a-19 mapping tests: cap-exhausted partial → `{ state:'failed' }` with partial text retained (never completed), failed → failed, aborted → idle, completed → completed. The `resolveTurn` helper now returns the C.1 AgentTurnOutcome shape.

## Task Commits

Each task was committed atomically:

1. **Task 1: useStreamingLLM.ts reads AgentTurnOutcome.status (D-3a-19)** - `a1c85ce` (feat)
2. **Task 2: D-20 fence test inverted** - `e44b252` (test)
3. **Task 3: AgentOrchestrator.test.ts shape migration (enumerated)** - `b49fe1e` (test)
4. **Task 4: budget suite status semantics (enumerated)** - `88c9ffd` (test)
5. **Task 5: D-3a-19 hook mapping tests** - `8401767` (test)
6. **Task 6: verify green + lint/format fixes** - `3fbe83f` (test)

**Plan metadata:** pending (docs: complete plan — final commit)

## Files Created/Modified

- `src/components/pages/useStreamingLLM.ts` - Terminal mapping rewritten to read `result.status` per D-3a-19 (completed → completed; partial|failed → failed; aborted → idle; provider_unconfigured guard retained as failed).
- `tests/core/ai/AgentOrchestrator.test.ts` - Header + D-20 fence inverted; AgentTurnOutput→AgentTurnOutcome shape flips; cap reasonCodes → partial/cap_exhausted; ask_clarification reworked to the pause seam; streamedText reads removed.
- `tests/core/ai/AgentOrchestrator.budget.test.ts` - Three outcome assertions flipped to `{ status: 'completed' }`; CR-01 regression invariants preserved.
- `tests/components/pages/useStreamingLLM.test.tsx` - resolveTurn helper returns AgentTurnOutcome; StageResolver test updated; 4 new D-3a-19 mapping tests.

## Decisions Made

- **Status-first mapping with the guard retained (D-3a-19):** the hook branches on `result.status` (completed/aborted → dedicated states; partial|failed fall through to failed) and keeps the `provider_unconfigured` reasonCode check as an explicit failed terminal — the guard's placement and UX are unchanged, the mapping source is what moved.
- **Fence inversion over deletion (Pitfall 1):** the D-20 test asserts the new ownership contract (`toMatch(/AgentTurnOutcome|OutcomeVerifier|trajectory/)`) rather than being deleted — a deleted fence would silently stop guarding the contract.
- **ask_clarification pause rework:** under 03a-03 the decision no longer terminates; the migrated test asserts the onInputRequired payload (roleId/question/options/reason) and that abort wins the wait (O4) — the turn-stays-open behavior is proven by the 03a-03 trajectory suite.
- **toolResults asserted at the render input:** the D-3a-18 struct no longer carries them; `renderMock.mock.calls[0][0].toolResults` is where "the tool result lands" is now observable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ask_clarification legacy test no longer terminates under the 3a rewire**
- **Found during:** Task 3 (AgentOrchestrator.test.ts shape migration)
- **Issue:** The legacy test asserted `output.reasonCode === 'ask_clarification'` as a terminal. 03a-03 made ask_clarification a within-turn pause (waiting-for-permission + onInputRequired + turn stays open until resumed/aborted — D-3a-15/16); under the new contract `runAgentTurn` never resolves on that path, so the test hung until the vitest timeout (the only test in the plan whose BEHAVIOR — not just shape — changed).
- **Fix:** Reworked the test to assert the pause-seam contract: onInputRequired fires with `{ roleId:'user', question, options, reason:'clarification' }`, abort cancels the wait (AbortError), and the renderer never runs. The transition behavior itself (planning → waiting-for-permission) is already proven by 03a-03's trajectory suite.
- **Files modified:** tests/core/ai/AgentOrchestrator.test.ts
- **Verification:** 17/17 tests pass; abort-wins assertion green; no hang.
- **Committed in:** b49fe1e (part of task commit)

**2. [Rule 1 - Bug] Unused bindings left by the migration tripped eslint**
- **Found during:** Task 6 (verify green — eslint gate)
- **Issue:** Removing the `output.streamedText` assertion left the `output` binding unused in the onStreamDelta test; removing `plannerResolved`/`rendererResolved` from the StageResolver mock return left `planner`/`renderer` locals unused.
- **Fix:** Dropped the unused `output` binding (the ordering + render-seam assertions carry the claim); the StageResolver mock now invokes `input.invocation?.('planner'/'renderer')` for their side effect (the per-stage maxTokens assertions below) without unused locals. Prettier --write applied to the migrated file.
- **Files modified:** tests/core/ai/AgentOrchestrator.test.ts, tests/components/pages/useStreamingLLM.test.tsx
- **Verification:** eslint + prettier clean on all four touched files; 527/527 full-suite green.
- **Committed in:** 3fbe83f (part of task commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking behavioral change, 1 Rule 1 lint bug from the migration)
**Impact on plan:** Both are direct consequences of the 03a-03 contract change this plan exists to migrate — no scope creep, no behavior beyond the plan's decisions.

## Issues Encountered

- None beyond the two auto-fixed deviations. The 03a-03 breakage (14 failing tests across the two legacy orchestrator suites) was the plan's own target and is fully resolved: 65 test files / 527 tests green, tsc exit 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The enumerated consumer migration is complete: `useStreamingLLM.ts` reads `AgentTurnOutcome.status` (D-3a-19), the D-20 fence is inverted, and both legacy orchestrator suites assert the new contract with the CR-01 regression intact. The full test suite is green again (the acceptance signal for this plan).
- Ready for **03a-05** (the final plan in the phase). The hook's partial/aborted states are honest at the mapping level now; the rich stage presentation (RICH) is deferred to Phase 7 and the PermissionDialog resume UI to Phase 8 — both remain wired to the seams this phase completed.

---
*Phase: 03a-agent-reliability-and-evidence*
*Completed: 2026-08-11*

## Self-Check: PASSED

- Created/modified files verified on disk: src/components/pages/useStreamingLLM.ts, tests/components/pages/useStreamingLLM.test.tsx, tests/core/ai/AgentOrchestrator.test.ts, tests/core/ai/AgentOrchestrator.budget.test.ts, 03a-04-SUMMARY.md
- Commits verified in git log: a1c85ce (feat), e44b252 (test), b49fe1e (test), 88c9ffd (test), 8401767 (test), 3fbe83f (test)
- tsc --noEmit exit 0; full vitest suite 65 files / 527 tests green (03a-03 breakage resolved); prettier + eslint clean on all four touched files
- Grep gates: `result.status` present in useStreamingLLM.ts (2 matches); 0 matches of stale `not.toMatch(/CompletionEvidence|OutcomeVerifier|trajectory/` in tests/; budget suite still asserts streamText ×1 + retryCount 0/1

