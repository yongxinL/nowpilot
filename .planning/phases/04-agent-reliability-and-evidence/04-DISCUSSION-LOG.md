# Phase 4: Agent Reliability and Evidence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 4-agent-reliability-and-evidence
**Areas discussed:** canonical types home + outcome shape, trajectory state machine, OutcomeVerifier + CompletionEvidence, renderer completion guard, replan/terminal policy, verification gate

---

## Session Mode

`--auto` mode — all gray areas auto-selected; recommended options chosen autonomously per `modes/auto.md`. No interactive prompts. Logged for audit.

## Canonical types home + outcome shape

| Option | Description | Selected |
|--------|-------------|----------|
| `@/types/harness` canonical home (Appendix C.1 verbatim) | Create `src/types/harness.ts` as single source of truth for AgentTrajectoryState/CompletionEvidence/AgentTurnOutcome; resolves the existing `ToolExecutionResult.evidence` seam | ✓ |
| Evolve AgentTurnOutput → AgentTurnOutcome (additive) | Keep streamedText/reasonCode consumable by chat; add status/evidence/counters per Appendix C.1 | ✓ |

**User's choice:** [auto] — recommended defaults (D-60, D-61).
**Notes:** Phase-3 `AgentTurnOutput` (`AgentOrchestrator.ts:90`) is the shape being superseded; `useChatStreaming` reads `streamedText`/`reasonCode` — no consumer breakage.

## Trajectory state machine

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit trajectory tracker, closed transitions | Dedicated module owning per-turn AgentTrajectoryState; transitions asserted against the closed machine (§28.2 AGT-01) | ✓ |
| Per-turn record, not persisted | In-memory per turn; surfaces on the outcome; persistence deferred to Phase 11 (AITransactionLog) | ✓ |

**User's choice:** [auto] — recommended defaults (D-62, D-63).
**Notes:** Trajectory (turn-level evidence) is distinct from `ActiveStreamState` (§20.6, surface-level streaming UI) — do not conflate.

## OutcomeVerifier + CompletionEvidence

| Option | Description | Selected |
|--------|-------------|----------|
| Ship Appendix O.2 framework, zero registered verifiers | Verifier interface + buildOutcome per O.2; matches D-46 zero tools; real verifiers land with owning phases / Phase 18 | ✓ |
| Renderer completion guard | No "Done" for side-effecting results lacking evidence (AGT-02 / risk R-8) | ✓ |

**User's choice:** [auto] — recommended defaults (D-64, D-65).
**Notes:** `ToolExecutionResult.evidence` seam already declared in toolSchemas/types; O.2 `buildOutcome` maps cap→partial/`cap_exhausted`, side-effect failure→failed/`postcondition_failed`, else completed/ok.

## Replan/terminal policy

| Option | Description | Selected |
|--------|-------------|----------|
| AGT-04 in AgentOrchestrator loop | One replan per failed tool within planner cap; repeated identical failure / cap breach / abort → terminal partial/failed/aborted; never silent success | ✓ |
| Framework-exercised via injected results | Zero registered tools → tests inject ToolExecutionResults to exercise replan (mirrors ExecutorService test pattern) | ✓ |

**User's choice:** [auto] — recommended defaults (D-66, D-67).
**Notes:** Retry layering bounded (§1.6.1: ProviderRouter §1.5 + AGT-04 replan + one per-stage retry). No new error codes — closed status set (D-38 / §21.6).

## Verification gate

| Option | Description | Selected |
|--------|-------------|----------|
| Re-point verify:phase-4 at phase's own tests | Currently mis-points at `tests/core/context` (Phase 5); re-point to `tests/core/ai/trajectory` + `tests/core/ai/OutcomeVerifier.test.ts` | ✓ |

**User's choice:** [auto] — recommended default (D-68).
**Notes:** package.json script edit; keeps existing `tests/core/ai` suite if AgentOrchestrator changes need full coverage.

## the agent's Discretion

- Exact trajectory tracking mechanism (transition-table validator vs type-level encoding).
- How `streamedText` composes with Appendix C.1 `AgentTurnOutcome` (field addition vs composed wrapper).
- Mapping existing terminal reasons (`configuration_required`, `ask_clarification`, `planner_cap_reached`, `tool_cap_reached`) onto the closed status set.
- Trajectory module file layout (single file vs directory; mirror the test dir).
- `@/types/harness` physical landing spot against existing `src/types/` layout.

## Deferred Ideas

- ToolCapabilityManifest + registered postcondition verifiers — Phase 18 (§28.5 / TOL-01).
- AITransactionLog + trajectory persistence — Phase 11.
- Diagnostics panel surfacing trajectory/evidence — Phase 11.
- ContextOptimizer / OptimizedContext / TokenBudget — Phase 5 (owns `tests/core/context`).
- Trust-aware context + receipts — Phase 7.
- Real tools with verifier-able side effects — owning phases; Phase 4 replan is injection-exercised only.

None of these belong in Phase 4 — discussion stayed within phase scope.