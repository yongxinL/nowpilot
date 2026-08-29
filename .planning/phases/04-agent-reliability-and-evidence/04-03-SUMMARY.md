---
phase: 04-agent-reliability-and-evidence
plan: 03
subsystem: ai
tags: [agent-orchestrator, agt-04, replan-policy, trajectory, retry-bounding, d-67]

# Dependency graph
requires:
  - phase: 04-01
    provides: "canonical C.1 types + trajectory tracker + OutcomeVerifier + AgentTurnOutcome return contract (D-61/D-62/D-63)"
  - phase: 04-02
    provides: "renderer completion guard wiring in finish() (D-65/AGT-02) + false-completion test case (j)"
provides:
  - "AGT-04 deterministic replan/terminal policy inside the bounded loop — at most one replan per failed tool (failureIdentities map + replannedTools set)"
  - "Repeated-identical-failure terminal → status 'failed' / reasonCode 'repeated_failure' (never a silent retry loop, T-4-07)"
  - "Replan-budget-consumed terminal → status 'failed' / reasonCode 'replan_exhausted'"
  - "Cap path unified to O.2 reasonCode 'cap_exhausted' with status 'partial' (AGT-03; replaces preserved Phase-3 literal)"
  - "Trajectory 'replanning' entry on first failure, validated against the closed TRAJECTORY_TRANSITIONS table (AGT-01)"
  - "Re-scripted case (b) (Pitfall 2 — distinct tool names per iteration) + new case groups (k)/(l)/(m) proving replan/terminal semantics"
affects: [04-04 (abort outcome — boundary catch consumes the same finish() mapping), phase-11 (trajectory persistence), phase-18 (verifier registration)]

# Actuals (#2632) — pairs with the plan's `estimate` (22000 tokens) to calibrate future estimates.
actuals:
  tokens: 4241    # chars/4 over the realized diff (16966 chars across AgentOrchestrator.ts + test)
  tasks: 2        # tasks completed
  commits: 2      # production commits (Task 1 feat + Task 2 test)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic failure-identity keying: toolName → stable signal (code first per §21.6, error string only as fallback — Pitfall 7), never the raw message alone"
    - "Per-tool replan budget via Set (replannedTools) — ≤1 replan per failed tool; repeated identity via Map (failureIdentities) — terminal on match"
    - "Policy terminal reasonCodes ('repeated_failure'/'replan_exhausted') forced to status 'failed' in finish() — capHit remains the ONLY path to 'partial' (AGT-03)"
    - "Finish() normalizes a cap check firing while parked in 'replanning' → 'planning' (the only legal forward edge into rendering, AGT-01)"

key-files:
  created: []
  modified:
    - src/core/ai/AgentOrchestrator.ts
    - tests/core/ai/AgentOrchestrator.test.ts

key-decisions:
  - "AGT-04 policy slots immediately after toolResults.push(result): identity = result.code ?? (result.error ?? 'ERROR'), keyed per toolName"
  - "Loop-top trajectory hook guarded with `trajectory.phase !== 'replanning'` — the policy itself enters 'replanning' on first failure (continue), preventing the illegal 'replanning' → 'replanning' double entry (AGT-01)"
  - "finish() computes effectiveStatus/effectiveReasonCode: guard downgrade wins (D-65 ordering), then policy terminals force 'failed', then capHit → 'partial'/'cap_exhausted'"
  - "Case (b) re-scripted with distinct tool names per iteration (search_kb → write_note → create_incident) so the loop legitimately exhausts plannerCap (Pitfall 2 closed)"

patterns-established:
  - "Terminal status mapping precedence: D-65 guard > AGT-04 policy terminals > AGT-03 capHit > buildOutcome computed status"
  - "D-67 compliance: every replan/terminal test injects failing results via vi.spyOn(ExecutorService, 'execute') — zero ToolRegistry.register calls (grep-asserted)"

requirements-completed: [AGT-04, AGT-03]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "AGT-04 deterministic replan/terminal policy in AgentOrchestrator.ts — ≤1 replan per failed tool, repeated-identical and replan-budget terminals → 'failed', cap → 'partial'/'cap_exhausted', trajectory 'replanning' on first failure"
    requirement: AGT-04
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(k) REPEATED IDENTICAL FAILURE → terminal failed (AGT-04)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(l) ONE REPLAN THEN COMPLETED (AGT-04)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(m) REPLAN BUDGET CONSUMED → terminal failed (AGT-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AGT-03 cap semantics — cap exhaustion reports 'partial' + O.2 reasonCode 'cap_exhausted', never 'completed'; case (b) re-scripted with distinct tool names (Pitfall 2)"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(b) planner_cap_reached — §1.4 cap enforcement (T-3-18 / AGT-03)"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-08-29
status: complete
---

# Phase 04 Plan 03: AGT-04 Deterministic Replan/Terminal Policy Summary

**AGT-04 deterministic replan/terminal policy in the bounded loop — at most one replan per failed tool (failureIdentities + replannedTools), repeated-identical-failure and replan-budget terminals forced to 'failed', cap unified to 'partial'/'cap_exhausted', exercised entirely via injected executor results (D-67)**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-29T10:12:40Z
- **Completed:** 2026-08-29T10:28:00Z
- **Tasks:** 2 (2 auto)
- **Files modified:** 2

## Accomplishments
- AGT-04 policy encoded in `AgentOrchestrator.ts`: `failureIdentities` Map (toolName → stable identity) + `replannedTools` Set (replan budget) declared before the loop, policy applied immediately after `toolResults.push(result)`
- Terminal mapping in `finish()`: repeated-identical failure → `failed`/`repeated_failure`; replan budget consumed → `failed`/`replan_exhausted`; cap → `partial`/`cap_exhausted` (O.2 unification, replacing the 04-01 preserved Phase-3 literal)
- Trajectory 'replanning' entered on first failure via `trajectory.enter('replanning')` — validated against the closed TRAJECTORY_TRANSITIONS table (AGT-01)
- Case (b) re-scripted with distinct tool names per iteration (Pitfall 2 closed) — the loop legitimately exhausts plannerCap → `partial`/`cap_exhausted`
- New case groups (k)/(l)/(m) prove the full AGT-04 contract: repeated-identity terminal, one-replan-then-completed, and replan-budget-consumed terminal
- Full phase-4 gate green: 19 test files, 183 tests, `tsc --noEmit` clean, zero new NP-STRICT markers, zero `ToolRegistry.register` calls (D-67)

## Task Commits

Each task was committed atomically:

1. **Task 1: AGT-04 deterministic replan/terminal policy in the loop** - `6d09d98` (feat)
2. **Task 2: Re-script case (b) with distinct tool names + new replan/terminal test cases** - `fd37e0e` (test)

**Plan metadata:** `04-03-SUMMARY.md` (docs, committed after this file)

## Files Created/Modified
- `src/core/ai/AgentOrchestrator.ts` - AGT-04 policy block in the loop (identity computation, repeated-identity/replan-budget terminals, first-failure replan with trajectory entry), finish() effective status/reasonCode mapping, loop-top trajectory guard, 'replanning' normalization in finish(), ORCHESTRATOR_REPLAN/TERMINAL_* debugLog entries
- `tests/core/ai/AgentOrchestrator.test.ts` - case (b) re-script (distinct tools, cap_exhausted), new case groups (k)/(l)/(m), header comment updated

## Decisions Made
- **Identity keying (Pitfall 7):** stable identity = `result.code ?? (result.error ?? 'ERROR')` — the §21.6 code (e.g. TOOL_REJECTED) is the primary signal; the error string is used ONLY as fallback, so a provider rewording the message cannot reset the identity to evade the repeated-failure terminal (T-4-08)
- **Loop-top guard:** the existing D-63 loop-top `trajectory.enter('replanning')` hook is now guarded by `trajectory.phase !== 'replanning'` — the policy itself enters 'replanning' on first failure and `continue`s, so the loop-top must not double-enter (illegal per AGT-01 closed table)
- **finish() normalization:** a cap check can fire while the machine is parked in 'replanning' (policy continue → loop-top plannerCap check) — finish() now normalizes 'replanning' → 'planning' (the only legal forward edge into rendering) before building the outcome
- **Terminal status precedence:** guard downgrade (D-65) > AGT-04 policy terminals (forced 'failed') > AGT-03 capHit ('partial'/'cap_exhausted') > buildOutcome computed status
- **Cap reasonCode unification (AGT-03):** finish() maps 'planner_cap_reached'/'tool_cap_reached' to the O.2 reasonCode 'cap_exhausted', replacing the Phase-3 literals 04-01 deliberately preserved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] finish() needed a 'replanning' → 'planning' normalization for the cap path**
- **Found during:** Task 1 (AGT-04 policy) — while tracing Task 2's re-scripted case (b)
- **Issue:** Under AGT-04, a first failure enters 'replanning' and `continue`s the loop. If the next loop-top plannerCap check fires (the replan's planner call never happens because the cap check runs first), finish('planner_cap_reached') is called while the trajectory machine is parked in 'replanning'. The closed TRAJECTORY_TRANSITIONS table allows no 'replanning' → 'rendering' edge — finish() would throw `illegal trajectory transition: replanning -> rendering` on every cap-breach-after-replan turn.
- **Fix:** Added an `else if (trajectory.phase === 'replanning') trajectory.enter('planning')` branch to finish()'s existing D-63 normalization block — 'replanning' → 'planning' is the legal forward edge into rendering.
- **Files modified:** src/core/ai/AgentOrchestrator.ts
- **Verification:** Re-scripted case (b) passes — the distinct-tool loop exhausts plannerCap with status 'partial'/'cap_exhausted' and trajectory terminates 'completed' (partial renders its answer); full suite green.
- **Committed in:** 6d09d98 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The normalization is required for the AGT-04 policy + re-scripted cap test to function; it preserves the closed-table invariant (AGT-01) while allowing the cap path to render. No scope creep.

## Issues Encountered
- Case (b) was RED immediately after Task 1 (expected — documented in the plan's acceptance criteria: its same-tool mock terminates 'failed' before the cap under the new policy; the re-script in Task 2 restored green with the 'cap_exhausted' assertion). No unexpected failures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- **Ready for 04-04 (abort outcome conversion):** the finish() effectiveStatus/effectiveReasonCode mapping is the single choke point the boundary catch (04-04) will extend to status 'aborted'; the 'replanning' normalization covers the cap path; policy terminals land as returned outcomes (not throws), matching the outcome-based contract 04-04 extends to abort
- **Ready for phase verification:** `pnpm run verify:phase-4` green (19 files / 183 tests), `pnpm run lint` clean, D-67 grep guard satisfied
- **Threat register:** T-4-07 (DoS retry amplification) mitigated — N×N×N fan-out impossible, calls stay under §1.4 caps; T-4-08 (identity tampering) mitigated via code-first keying; T-4-09 (silent success) mitigated via forced 'failed' on policy terminals; T-4-SC (package legitimacy) N/A — zero new dependencies

## Self-Check: PASSED

- [x] `.planning/phases/04-agent-reliability-and-evidence/04-03-SUMMARY.md` exists on disk
- [x] Task 1 commit `6d09d98` exists (`feat(04-03): AGT-04 deterministic replan/terminal policy`)
- [x] Task 2 commit `fd37e0e` exists (`test(04-03): re-script case (b) + cases (k)(l)(m)`)
- [x] `pnpm run lint` green (final state)
- [x] `pnpm run verify:phase-4` green — 19 test files / 183 tests
- [x] Grep guard: `failureIdentities`/`replannedTools` declared before loop, used after `toolResults.push`; zero `ToolRegistry.register` calls (D-67)

---
*Phase: 04-agent-reliability-and-evidence*
*Completed: 2026-08-29*