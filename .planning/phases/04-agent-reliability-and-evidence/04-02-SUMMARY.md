---
phase: 04-agent-reliability-and-evidence
plan: 02
subsystem: ai
tags: [completion-guard, missing-evidence, agt-02, r-8, d-65, outcome-downgrade, agent-orchestrator]

# Dependency graph
requires:
  - phase: 04-agent-reliability-and-evidence
    provides: guardMissingEvidence helper + O.2 buildOutcome + effective-verifier seam from plan 04-01
provides:
  - finish() completion guard wiring (D-65): ok side-effecting result without CompletionEvidence forces status 'partial' + reasonCode 'missing_evidence', unconditionally overriding buildOutcome's status
  - False-completion test (AGT-02 DONE-when): injected ok-without-evidence result → 'partial', never 'completed'; with-evidence control → 'completed'
affects: [04-03 (cap reasonCode unification + replan policy — guard stays in place), 04-04 (abort outcome), phase-11 (trajectory persistence), phase-18 (verifier registration)]

actuals:
  tokens: 1780    # chars/4 over realized diff (7118 diff chars across 2 commits)
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Unconditional guard-after-buildOutcome ordering: the completion guard evaluates AFTER buildOutcome and OVERRIDES its status, so 'never a clean success' holds even when the registered verifier itself passes (research A5 / D-65)"
    - "Status-only downgrade: the guard changes outcome status/reasonCode while evidence/counters/operationId/trajectory/streamedText stay as buildOutcome + render produced (D-65 — the downgrade is on the outcome STATUS, not the rendered text)"

key-files:
  created: []
  modified:
    - src/core/ai/AgentOrchestrator.ts — guardMissingEvidence import + finish() guard evaluation + unconditional status/reasonCode override + ORCHESTRATOR_GUARD_MISSING_EVIDENCE debugLog
    - tests/core/ai/AgentOrchestrator.test.ts — case group (j): false-completion guard tests (D-65/AGT-02)

key-decisions:
  - "Guard placement: evaluated after buildOutcome (line ~308), applied in the output assembly (status/reasonCode override at lines ~369-370) — BEFORE the outcome returns and before the persistTurn seam fires; the override wins over buildOutcome's 'completed'/'failed' status unconditionally (D-65 / research A5 ordering)"
  - "reasonCode 'missing_evidence' is a descriptive literal, NOT an exported §21.6 error-code constant (D-38) — matching the O.2 reasonCode precedent"
  - "Guard exercised by injected fixtures only (D-67): vi.spyOn(ExecutorService, 'execute') mock + input.verifiers fake verifier; zero ToolRegistry.register calls; zero VerifierRegistry registrations (D-64 vacuity in production)"
  - "The with-evidence control test proves the guard is vacuous when the result carries evidence — 'completed' remains reachable, so the downgrade targets only the R-8 hole"

patterns-established:
  - "Guard ordering contract: buildOutcome → guardMissingEvidence → render → output assembly (override applied) → persist → return"
  - "False-completion proof pattern: inject ok:true result with NO evidence field + a PASSING fake verifier → assert 'partial', never 'completed' (AGT-02 DONE-when; RESEARCH Pitfall 4)"

requirements-completed: [AGT-02]

coverage:
  - id: D1
    description: "finish() completion guard wiring — ok side-effecting result (verifier registered) without CompletionEvidence forces status 'partial' + reasonCode 'missing_evidence', unconditionally overriding buildOutcome's status (D-65, AGT-02 / risk R-8); vacuous in production with zero verifiers (D-64)"
    requirement: AGT-02
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(j) ok side-effecting result without evidence → status 'partial' / 'missing_evidence', never 'completed'"
        status: pass
    human_judgment: false
  - id: D2
    description: "With-evidence control — injected ok result carrying CompletionEvidence → status 'completed' (guard vacuous when evidence present); the R-8 downgrade targets only evidence-less side effects"
    requirement: AGT-02
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(j) ok side-effecting result WITH evidence → status 'completed'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Guard seam discipline — exercised via ExecutorService.execute mock + input.verifiers injection (D-67), zero fake tool registrations, zero VerifierRegistry registrations (D-64); verify:phase-4 stays GREEN (19 files / 180 tests)"
    requirement: AGT-02
    verification:
      - kind: other
        ref: "pnpm run verify:phase-4 (tsc strict-clean + 19 files / 180 tests pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-29
status: complete
---

# Phase 04 Plan 02: Renderer Completion Guard Wiring + False-Completion Test Summary

**The D-65 completion guard wired unconditionally into `finish()` — an ok side-effecting tool result without CompletionEvidence now forces `status: 'partial'` / `reasonCode: 'missing_evidence'` (never `'completed'`, AGT-02 / risk R-8) — proven by the false-completion test with an injected evidence-less side effect plus a with-evidence control.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-29T10:09:00Z
- **Completed:** 2026-08-29T10:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `AgentOrchestrator.ts` `finish()` now imports and evaluates `guardMissingEvidence(toolResults, effectiveVerifiers)` AFTER `buildOutcome` computes the base outcome and BEFORE the outcome is returned / the persistTurn seam fires (D-65). When the guard fires, the output assembly forces `status: 'partial'` + `reasonCode: 'missing_evidence'` — an unconditional override that wins over buildOutcome's 'completed'/'failed' status (research A5 ordering), so "never silently claims success" holds even when the registered verifier itself passes. The renderer still renders the final answer — the downgrade is on the outcome STATUS only, not the streamed text.
- The guard reads `ToolExecutionResult.evidence` (the spec 4339 seam shipped in 04-01) on each `ok` result via the same effective verifier set passed to buildOutcome (`{...VerifierRegistry.getAll(), ...input.verifiers}`). With zero verifiers registered in Phase 4 (D-64) the guard is vacuous in production — it fires only for injected fixtures (D-67).
- A `debugLog('ORCHESTRATOR_GUARD_MISSING_EVIDENCE', ...)` entry fires on downgrade with `{operationId, toolNames[], reasonCode: 'missing_evidence'}` — code-style SCREAMING_SNAKE, never console.log.
- `reasonCode: 'missing_evidence'` is a descriptive literal, not an exported §21.6 error-code constant (D-38) — consistent with the O.2 reasonCode precedent.
- Case group `(j)` in `AgentOrchestrator.test.ts` proves the AGT-02 DONE-when: an injected `{toolName: 'side_effect_tool', ok: true, ...}` result with NO evidence field (the R-8 hole), a PASSING fake verifier via `input.verifiers`, and a scripted planner (run_tool → answer) yields `status: 'partial'` + `reasonCode: 'missing_evidence'` — while `evidence` has length 1 (buildOutcome ran the verifier — the guard overrode the status), `operationId` stays correlated, and `streamedText` is still the rendered answer. The with-evidence control (evidence field present) yields `'completed'` — the guard is vacuous when evidence exists.
- Zero fake tool registrations (D-67): no `ToolRegistry.register` calls in the test file; zero `VerifierRegistry` registrations (D-64). NP-STRICT ceiling 0 maintained.

## Task Commits

Each task was committed atomically:

1. **Task 1: Renderer completion guard wiring** - `3eacc9e` (feat)
2. **Task 2: False-completion test** - `d0b1242` (test)

## Files Created/Modified

- `src/core/ai/AgentOrchestrator.ts` - `guardMissingEvidence` import, finish() guard evaluation after buildOutcome, unconditional status/reasonCode override in output assembly, ORCHESTRATOR_GUARD_MISSING_EVIDENCE debugLog
- `tests/core/ai/AgentOrchestrator.test.ts` - case group (j): false-completion guard tests (ok-without-evidence → 'partial'/'missing_evidence'; ok-with-evidence → 'completed')

## Decisions Made

- **Guard ordering (research A5):** the guard evaluates after `buildOutcome` and its override is applied in the output assembly — unconditional, before the outcome returns and before the persist seam fires. This is what makes "never a clean success" hold even when the verifier itself passes (D-65).
- **Status-only downgrade:** the guard changes `status`/`reasonCode` while `evidence`, counters, `operationId`, trajectory, and `streamedText` remain whatever buildOutcome + render produced — the downgrade is on the outcome STATUS, not the rendered text (the renderer still renders the final answer; UI "Done" surfacing is Phase 15).
- **`missing_evidence` is a literal, not a constant:** consistent with D-38 and the O.2 reasonCode precedent — no §21.6 code invented, nothing exported.
- **Injection-only exercise (D-67):** the guard path is proven via `vi.spyOn(ExecutorService, 'execute')` + the `input.verifiers` test seam, never fake tool registration — matching the plan's prohibition.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **`debugLog` signature (resolved inline):** the first draft passed the payload object as the second `debugLog` argument; the LSP flagged it — `debugLog(code, message, context?)` takes a string message second. Fixed the call to the `(code, message, payload)` form (same ORCHESTRATOR_GUARD_MISSING_EVIDENCE code + payload). One-line fix during Task 1, not a plan issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 04-03 (replan policy + cap reasonCode unification):** the guard is wired and stays in place; the loop's replan/terminal policy (AGT-04) and the case-(b) 'cap_exhausted' re-script land on top of this outcome layer without touching the guard ordering.
- **Ready for 04-04 (abort outcome):** the abort throw contract (three DOMException sites) and trajectory `assembling-context → aborted` boundary are unchanged by this plan — 04-04's Q1 conversion proceeds independently.
- **Ready for later phases:** the guard is vacuous in production until Phase 18 registers verifiers (TOL-03); trajectory stays in-memory (Phase 11 persists); `verify:phase-4` gate GREEN (19 files / 180 tests).

---
*Phase: 04-agent-reliability-and-evidence*
*Completed: 2026-08-29*