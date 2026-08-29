---
phase: 04-agent-reliability-and-evidence
plan: 01
subsystem: ai
tags: [harness-types, trajectory, outcome-verifier, agent-turn-outcome, appendix-c1, appendix-o2, agt-01, agt-02, agt-03]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: AgentOrchestrator bounded loop (AgentTurnOutput, plannerCalls/toolCalls counters, D-45 persist seam, D-54a configuration-required), ExecutorService zero-tool contract, ToolExecutionResult
provides:
  - Canonical C.1 reliability types (AgentTrajectoryPhase / AgentTrajectoryState / CompletionEvidence / AgentTurnOutcome) in @/types/harness (D-60)
  - TrajectoryTracker + closed TRAJECTORY_TRANSITIONS table (D-62/63, AGT-01)
  - OutcomeVerifier framework: Verifier + buildOutcome (O.2 verbatim) + VerifierRegistry + guardMissingEvidence (D-64/65)
  - AgentTurnOutcome return contract end-to-end through the loop (D-61) with operationId re-threaded and status/evidence/counters/trajectory on every outcome
  - ToolExecutionResult.evidence seam typed against the canonical home (spec 4339)
  - verify:phase-4 re-pointed at tests/core/ai/trajectory + OutcomeVerifier.test.ts + tests/core/ai and GREEN (D-68)
affects: [04-02 (guard wiring), 04-03 (cap reasonCode unification + replan policy), 04-04 (abort outcome), phase-11 (trajectory persistence), phase-18 (verifier registration)]

actuals:
  tokens: 9624
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Canonical type home + alias seam: spec-verbatim C.1 types declared once in @/types/harness, referenced via import('@/types/harness') (spec 4339)"
    - "Transition-table state machine: data-driven Record<Phase, Phase[]> + runtime throw on illegal transitions (AGT-01)"
    - "Declare-now / populate-later registry: VerifierRegistry mirrors ToolRegistry, starts EMPTY (D-64)"
    - "Additive contract evolution: C.1 AgentTurnOutcome & {streamedText, toolResults, trajectory} — consumers keep reading reasonCode/streamedText untouched (D-61)"

key-files:
  created:
    - src/types/harness.ts — canonical C.1 reliability types (D-60)
    - src/core/ai/trajectory.ts — TrajectoryTracker + TRAJECTORY_TRANSITIONS (D-62/63)
    - src/core/ai/OutcomeVerifier.ts — Verifier, buildOutcome, VerifierRegistry, guardMissingEvidence (O.2, D-64/65)
    - tests/core/ai/trajectory/TrajectoryTracker.test.ts — AGT-01 closed-machine unit tests (§18)
    - tests/core/ai/OutcomeVerifier.test.ts — AGT-02/03 buildOutcome + guard unit tests (§18)
  modified:
    - src/core/ai/types.ts — ToolExecutionResult.evidence seam (spec 4339)
    - src/core/ai/AgentOrchestrator.ts — AgentTurnOutcome return contract + trajectory hooks + buildOutcome integration
    - tests/core/ai/AgentOrchestrator.test.ts — outcome-contract assertions on cases (a)/(b)/(c)/(h)
    - package.json — verify:phase-4 re-pointed (D-68)
    - tsconfig.json — @/* alias fixed to ./src/* (Rule 3)
    - vitest.config.ts — @ alias fixed to src (Rule 3)

key-decisions:
  - "finish() preserves the loop's Phase-3 reasonCode literal on capHit ('planner_cap_reached'/'tool_cap_reached') — the O.2 'cap_exhausted' reasonCode unification is deferred to 04-03's re-script of case (b) (AGT-03 status 'partial' ships now)"
  - "Trajectory cycle edge: after each tool result the machine enters 'replanning' (executing → replanning → planning) — the closed table's only legal continuation for multi-iteration turns; AGT-04 identity checks refine it in 04-03"
  - "finish() enters 'verifying' only from 'executing' (the closed table's only edge into it) — cap-hit turns verify their results; direct-answer/clarification/tool-cap paths enter 'rendering' directly from 'planning' (legal edge)"
  - "configuration_required → status 'failed' (A3); ask_clarification → status 'completed' (A3 — the question IS the output); terminal trajectory phase matches outcome status ('completed' also for 'partial' cap-hit turns — the honesty lives on the outcome status)"
  - "Cap-0-at-turn-start edge (plannerCap 0) normalized through 'planning' — the only legal forward edge out of 'assembling-context'"
  - "Abort throw contract UNCHANGED this plan (three DOMException sites) — the returned 'aborted' outcome is 04-04's Q1 conversion"

patterns-established:
  - "Trajectory is turn-level agent evidence, in-memory per turn (D-63) — distinct from ActiveStreamState (§20.6 stream UI state); never persisted until Phase 11"
  - "Verifier framework exercised by injected fixtures only (D-67): input.verifiers seam on runAgentTurn mirrors providerSecrets"

requirements-completed: [AGT-01, AGT-02, AGT-03]

coverage:
  - id: D1
    description: "Canonical C.1 reliability types (AgentTrajectoryPhase, AgentTrajectoryState, CompletionEvidence, AgentTurnOutcome) in @/types/harness — verbatim from Appendix C.1, no parallel copy in core/ai"
    requirement: AGT-01
    verification:
      - kind: unit
        ref: "tests/core/ai/trajectory/TrajectoryTracker.test.ts#closed-machine completeness: all 10 C.1 phases exist as keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "ToolExecutionResult.evidence seam typed as import('@/types/harness').CompletionEvidence (spec 4339) — additive, data/error/code untouched"
    requirement: AGT-02
    verification:
      - kind: unit
        ref: "tests/core/ai/OutcomeVerifier.test.ts#returns true for an ok result with a registered verifier but no evidence — the AGT-02 proof"
        status: pass
    human_judgment: false
  - id: D3
    description: "TrajectoryTracker closed transition machine — legal chains pass, illegal transitions throw at runtime (AGT-01); snapshot carries counters + updatedAt; operationId correlated (D-63)"
    requirement: AGT-01
    verification:
      - kind: unit
        ref: "tests/core/ai/trajectory/TrajectoryTracker.test.ts#legal chain / illegal transition / snapshot / operationId"
        status: pass
    human_judgment: false
  - id: D4
    description: "OutcomeVerifier framework — buildOutcome (O.2 verbatim status rule: capHit→partial, side-effect-fail→failed, else completed), VerifierRegistry (declare-now, zero registrations), guardMissingEvidence (D-65 guard condition)"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/core/ai/OutcomeVerifier.test.ts#buildOutcome — O.2 status/reasonCode rules + guardMissingEvidence — the false-completion guard"
        status: pass
    human_judgment: false
  - id: D5
    description: "AgentTurnOutcome return contract end-to-end through the loop — every runAgentTurn resolves with operationId == input.operationId, closed status, evidence, counters, and the additive streamedText/toolResults/trajectory (D-61); existing consumers untouched (zero test edits on cases a-i)"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(a) happy path / (b) planner_cap_reached / (c) ask_clarification / (h) configuration-required — outcome-contract assertions"
        status: pass
    human_judgment: false
  - id: D6
    description: "verify:phase-4 re-pointed at tests/core/ai/trajectory + tests/core/ai/OutcomeVerifier.test.ts + tests/core/ai and GREEN for the first time (D-68 — gate stops being RED)"
    verification:
      - kind: other
        ref: "pnpm run verify:phase-4 (tsc strict-clean + 19 files / 178 tests pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-29
status: complete
---

# Phase 04 Plan 01: Canonical Reliability Types + End-to-End AgentTurnOutcome Summary

**The C.1 reliability types (verbatim in `@/types/harness`), a closed TrajectoryTracker state machine, the O.2 OutcomeVerifier framework, and the additive AgentTurnOutcome return contract wired end-to-end through the AgentOrchestrator loop — with `verify:phase-4` re-pointed and GREEN (D-68) for the first time.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-29T09:55:30Z
- **Completed:** 2026-08-29T10:07:30Z
- **Tasks:** 2 (1 tracer + 1 auto)
- **Files modified:** 11 (5 new, 6 modified)

## Accomplishments

- `src/types/harness.ts` — the single canonical home for `AgentTrajectoryPhase`, `AgentTrajectoryState`, `CompletionEvidence`, `AgentTurnOutcome` verbatim from Appendix C.1 (spec 4849-4876); no parallel copy in `src/core/ai` (D-60, spec 4833).
- `ToolExecutionResult.evidence` seam added (spec 4339) typed as `import('@/types/harness').CompletionEvidence` — additive; `data`/`error`/`code` untouched (Pitfall 5).
- `src/core/ai/trajectory.ts` — `TrajectoryTracker` + closed `TRAJECTORY_TRANSITIONS` table (10 C.1 phases); illegal transitions throw at runtime (AGT-01); the `assembling-context` row is amended to `[planning, aborted]` for 04-04's pre-aborted boundary catch.
- `src/core/ai/OutcomeVerifier.ts` — `Verifier` + `buildOutcome` (O.2 verbatim, spec 6330-6361: capHit → 'partial', side-effect fail → 'failed', else 'completed') + `VerifierRegistry` (declare-now, zero registrations, D-64) + `guardMissingEvidence` (D-65 guard condition, ships unwired — wiring is 04-02).
- `AgentOrchestrator.ts` (D-61 additive) — `runAgentTurn` returns `AgentTurnOutcome` = C.1 & {streamedText, toolResults, trajectory}; `operationId` re-threaded from `input.operationId` (Pitfall 8); per-turn `TrajectoryTracker` spans the loop (planning/executing/replanning cycle, verifying/rendering, status-matched terminal phase); `finish()` computes status/evidence via `buildOutcome` with capHit derived from the loop reasonCode while PRESERVING the Phase-3 reasonCode literal on capHit (case (b) stays green with zero test edits; O.2 'cap_exhausted' unification is 04-03); `configurationRequiredOutcome()` → status 'failed' (A3); abort throw contract unchanged (Q1 conversion is 04-04). NP-STRICT ceiling 0.
- Both §18-required test files land: `tests/core/ai/trajectory/TrajectoryTracker.test.ts` (AGT-01 closed-machine) and `tests/core/ai/OutcomeVerifier.test.ts` (AGT-02/03). Outcome-contract assertions added to existing orchestrator cases (a)/(b)/(c)/(h).
- `verify:phase-4` re-pointed from `tests/core/context` (Phase-5 territory, gate RED) to `tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts tests/core/ai` — GREEN for the first time (19 files, 178 tests). Full suite: 48 files, 420 tests pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Canonical types + trajectory tracker + OutcomeVerifier framework + AgentTurnOutcome return contract** - `d564213` (feat)
2. **Task 2: Wave-0 §18 test files + verify:phase-4 re-point + outcome-contract assertions** - `ee5aef0` (test)

**Plan metadata:** `docs(04-01): complete plan` (pending — committed with this SUMMARY)

## Files Created/Modified

- `src/types/harness.ts` - Canonical C.1 reliability types (D-60), verbatim from Appendix C.1 with spec citation
- `src/core/ai/trajectory.ts` - TrajectoryTracker + closed TRAJECTORY_TRANSITIONS table (D-62/63, AGT-01)
- `src/core/ai/OutcomeVerifier.ts` - Verifier + buildOutcome (O.2 verbatim) + VerifierRegistry + guardMissingEvidence (D-64/65)
- `src/core/ai/types.ts` - Additive ToolExecutionResult.evidence seam (spec 4339)
- `src/core/ai/AgentOrchestrator.ts` - AgentTurnOutcome return contract, trajectory hooks, buildOutcome integration, config-required → failed
- `tests/core/ai/trajectory/TrajectoryTracker.test.ts` - AGT-01 closed-machine unit tests (new dir, §18)
- `tests/core/ai/OutcomeVerifier.test.ts` - AGT-02/03 buildOutcome + guard unit tests (§18)
- `tests/core/ai/AgentOrchestrator.test.ts` - Outcome-contract assertions on cases (a)/(b)/(c)/(h)
- `package.json` - verify:phase-4 re-pointed (D-68)
- `tsconfig.json` - @/* alias fixed to ./src/* (Rule 3)
- `vitest.config.ts` - @ alias fixed to src (Rule 3)

## Decisions Made

- **Cap-exhaustion reasonCode contract:** the loop's Phase-3 literals ('planner_cap_reached'/'tool_cap_reached') are preserved on the outcome this plan so case (b) stays green with ZERO test edits; the O.2 'cap_exhausted' unification is 04-03's re-script. The computed status ('partial' on capHit) and evidence array come from buildOutcome verbatim (AGT-03).
- **Trajectory cycle edge (D-63 resolution):** after each tool result the machine enters 'replanning' — the closed table's only forward continuation edge out of 'executing'. AGT-04's repeated-identity policy (04-03) refines when replanning becomes terminal.
- **Verifying-enter is phase-conditional:** finish() enters 'verifying' only when the machine is at 'executing' (the table's only edge into it) — cap-hit turns verify their results; direct-answer/clarification/tool-cap paths enter 'rendering' directly from 'planning' (legal edge).
- **Status mappings (A3):** configuration_required → 'failed' (no output produced); ask_clarification → 'completed' (the question IS the output); terminal trajectory phase matches outcome status — 'completed' also for 'partial' cap-hit turns (the 'partial' honesty lives on the outcome status, not the machine).
- **`@/*` alias alignment (Rule 3):** tsconfig paths + vitest alias were mapping `@` → project root while vite mapped `@` → src. The spec-mandated `import('@/types/harness')` seam (spec 4339) only resolves with the src mapping. Aligned all three to `@` → `src/`. Zero existing `@/` imports made the change risk-free (verified by full-suite run).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@/*` path-alias mismatch blocked the spec-mandated `@/types/harness` seam**
- **Found during:** Task 1 (immediately after creating `src/types/harness.ts`)
- **Issue:** `tsconfig.json` `paths` and `vitest.config.ts` mapped `@/*` → project root (`./*`), while `vite.config.ts` mapped `@` → `src/`. The spec-mandated `import('@/types/harness').CompletionEvidence` (spec 4339) resolved only under vite — tsc and vitest both failed with TS2307. No existing `@/` import existed anywhere in src/tests/entrypoints (verified by grep), so the root mapping was never previously exercised.
- **Fix:** Aligned tsconfig `paths` (`@/*` → `./src/*`) and vitest alias (`@` → `src`) to vite's semantic. `~/*` left untouched (unused).
- **Files modified:** tsconfig.json, vitest.config.ts
- **Verification:** `pnpm run lint` green; full suite (48 files, 420 tests) green — no collateral impact.
- **Committed in:** d564213 (Task 1 commit)

**2. [Rule 3 - Blocking] Trajectory hook placement required the `replanning` cycle edge for a legal closed machine**
- **Found during:** Task 1 (designing the loop hooks against the closed transition table)
- **Issue:** Task 1's literal hook list (enter 'planning' before each planner call, enter 'executing' before execute, enter 'verifying'+'rendering' in finish) produces ILLEGAL transitions on any multi-iteration turn: the closed table has NO `executing → planning` edge, so iteration 2's `enter('planning')` would throw after the first tool execution. Similarly `finish()` entering 'verifying' is only legal from 'executing' — never from 'planning'/'replanning'/'assembling-context'.
- **Fix:** After each tool result the loop enters 'replanning' (executing → replanning → planning — the table's only forward continuation), and finish() enters 'verifying' conditionally from 'executing' only; direct-answer/clarification/tool-cap paths enter 'rendering' from 'planning' (legal edge); the cap-0-at-turn-start edge normalizes through 'planning'. This is the documented D-63 cycle substrate — 04-03's AGT-04 identity checks refine the failure side.
- **Files modified:** src/core/ai/AgentOrchestrator.ts
- **Verification:** all 10 existing orchestrator tests pass with ZERO test edits (Task 1 acceptance); verify:phase-4 GREEN (178 tests); full suite GREEN (420 tests).
- **Committed in:** d564213 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 3 blocking)
**Impact on plan:** Both fixes were required for correctness — the first makes the spec-mandated import path resolve across all three tools (vite/tsc/vitest); the second makes the closed trajectory machine legal for real multi-iteration turns. No scope creep; both are explicitly documented in-code for the follow-on plans (04-02/03/04).

## Issues Encountered

- **`@/types/harness` TS2307 (resolved):** the alias mismatch described in deviation 1 — surfaced immediately on first `pnpm run lint`, fixed before any test run.
- **Test import path depth (resolved):** `tests/core/ai/trajectory/TrajectoryTracker.test.ts` initially used a 3-level relative import (`../../../src/...`), which resolves one level short from the deeper `trajectory/` subdir; corrected to 4 levels (`../../../../src/...`). One-line fix in the new test file during writing, not a plan issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 04-02 (guard wiring):** `guardMissingEvidence` ships and is tested (the AGT-02 proof); the D-65 finish() wiring consumes it. The effective-verifier seam (`{...VerifierRegistry.getAll(), ...input.verifiers}`) is already live in `runAgentTurn`.
- **Ready for 04-03 (replan policy + cap reasonCode):** the `replanning` cycle edge and the loop counters are in place for AGT-04's repeated-identity refinement; case (b) awaits its 'cap_exhausted' re-script.
- **Ready for 04-04 (abort outcome):** the trajectory machine supports `assembling-context → aborted` (amended row) and 'aborted' terminal; the three DOMException throw sites + case (e) await the Q1 boundary conversion.
- **Ready for later phases:** zero verifiers registered (Phase 18 registers); trajectory stays in-memory (Phase 11 persists); `verify:phase-4` gate is GREEN and owns its §18 test dirs.

---
*Phase: 04-agent-reliability-and-evidence*
*Completed: 2026-08-29*

## Self-Check: PASSED

- Created files verified on disk: `src/types/harness.ts`, `src/core/ai/trajectory.ts`, `src/core/ai/OutcomeVerifier.ts`, `tests/core/ai/trajectory/TrajectoryTracker.test.ts`, `tests/core/ai/OutcomeVerifier.test.ts` — all FOUND.
- Commits verified in git log: `d564213` (Task 1), `ee5aef0` (Task 2) — both FOUND.
- Final gate re-run at close-out: `pnpm run lint` strict-clean; `pnpm run verify:phase-4` GREEN (19 files / 178 tests).
- No deletions introduced by either task commit.