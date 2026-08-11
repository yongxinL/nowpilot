# Phase 3a: Agent Reliability and Evidence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 3a-Agent Reliability and Evidence
**Areas discussed:** GATES (G0, D1-D4), CheckpointRecorder scope, Replan policy mechanics, Commit-confirm barrier, Output migration + hook

---

## GATES (must-answer-first)

The user opened the discussion with a structured set of gates to resolve before area-level discussion, then confirmed all five with the recommended options.

### G0 — AGT numbering reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| Spec-authoritative | Phase 3a = spec §28.2's four AGT items; CheckpointRecorder folds into AGT-02; AGT-05 commit-confirm defers to Phase 8 (TOL-03); REQUIREMENTS.md gets an AI-07-style re-map note | ✓ |
| ROADMAP-authoritative | Phase 3a = all 5 ROADMAP/REQUIREMENTS items; new ADRs define them into §28.2 | |

**User's choice:** Spec-authoritative
**Notes:** AI-07 precedent (D-06, 03-CONTEXT) applies. ROADMAP criterion #5 reduces to evidence/false-completion tests (which stay in 3a).

### D1 — OutcomeVerifier: deterministic vs model call

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic | Pure postcondition check over ToolExecutionResult (O.2 verbatim); zero model calls; preserves 2 calls/turn cost truth | ✓ |
| Model-based verifier | LLM judges success; 3rd model call per verified turn; needs verifier PipelineStage/cap/persona | |

**User's choice:** Deterministic
**Notes:** Cost truth (planner + renderer per healthy turn) is a hard through-line the user repeated.

### D2 — Evidence gating scope

| Option | Description | Selected |
|--------|-------------|----------|
| Tool-turns only | Pure answer turn = completed with evidence: []; only tool-executing turns gate on evidence | ✓ |
| Every turn | Whole-turn tax; would require synthesizing evidence for turns with no tools | |

**User's choice:** Tool-turns only
**Notes:** Matches O.2 buildOutcome (verifiers run only over results).

### D3 — Completion-gate location

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm layering | Verifier=verdict, Orchestrator=terminal decision, Renderer=display only; no double-verification, no renderer override | ✓ |
| Renderer re-verifies too | Renderer independently checks evidence; duplicates the gate | |

**User's choice:** Confirm layering

### D4 — Verifier-throws / malformed evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-closed | Verifier throw, malformed/absent evidence → verification_failed, never silent complete (R-8) | ✓ |
| Fail-open | Best-effort trust of tool result on verifier error | |

**User's choice:** Fail-closed
**Notes:** Canonical codes: TOOL_POSTCONDITION_FAILED / COMPLETION_EVIDENCE_MISSING / AGENT_STATE_INVALID.

---

## CheckpointRecorder scope

### Module home

| Option | Description | Selected |
|--------|-------------|----------|
| Own module | src/core/ai/CheckpointRecorder.ts; clean fixture seam (O1); matches one-file-per-responsibility pattern | ✓ |
| Inside AgentOrchestrator | Fewer files; bloats the loop | |

**User's choice:** Own module

### Rollback semantics (C2)

| Option | Description | Selected |
|--------|-------------|----------|
| Loop-state rewind | Restore pre-tool state (toolResults, plannerCalls, toolCalls, trajectory phase) keyed by operationId; discard failed result; re-run failed tool once | ✓ |
| Side-effect compensation | Attempt to undo external side effects; unsafe without per-tool compensation functions | |

**User's choice:** Loop-state rewind
**Notes:** Compensation/idempotency is Phase 8 (TOL-05), explicitly out of scope for v0.1.

### O2 trajectory-length cap

| Option | Description | Selected |
|--------|-------------|----------|
| Tier-derived cap | Hard ceiling derived from tier caps (plannerCap + toolCap + slack); force-terminate on exceed | ✓ |
| Rely on existing caps | No explicit trajectory cap | |

**User's choice:** Tier-derived cap

---

## Replan policy mechanics (AGT-04)

### Replan trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Failed tool only | Tool execution failure (ok:false retryable) re-invokes planner once with F-4 sections-in failure feedback; planner-side failures keep planner_failed fallback | ✓ |
| Any failure | Also replan on planner decision rejections; doubles planner calls, breaks planner_failed contract | |

**User's choice:** Failed tool only

### Repeated-identical identity

| Option | Description | Selected |
|--------|-------------|----------|
| Tool + error code | Same toolName + same error code; after one replan, identical failure is terminal | ✓ |
| Same tool only | Any second failure of same tool is terminal regardless of code | |

**User's choice:** Tool + error code

### Replan bound

| Option | Description | Selected |
|--------|-------------|----------|
| Counts vs plannerCap | Each replan consumes plannerCap slot; at most one replan per failed tool; never nested | ✓ |
| Separate replan budget | New counter not in spec; risks exceeding tier cap | |

**User's choice:** Counts vs plannerCap

### Replan render timing

| Option | Description | Selected |
|--------|-------------|----------|
| Render once at end | Loop continues, final answer renders once at finish(); replan = loop iteration, not concurrency | ✓ |
| Render per attempt | Extra model calls per replan | |

**User's choice:** Render once at end

---

## Commit-confirm barrier (AGT-05)

### Scope per G0

| Option | Description | Selected |
|--------|-------------|----------|
| Core seam only | waiting-for-permission trajectory state + within-turn pause seam; no UI, no gated tools; Phase 8 ships full barrier | ✓ |
| Full UI now | Confirmation UI with no consumer yet; ahead of phase | |

**User's choice:** Core seam only

### Renderer completion guard role

| Option | Description | Selected |
|--------|-------------|----------|
| Evidence-aware render | Renderer receives terminal verdict + evidence set; never claims tool 'done' without evidence; orchestrator owns terminal decision | ✓ |
| Renderer re-verifies | Duplicates the gate; D3 rejected | |

**User's choice:** Evidence-aware render

### Pause seam surface

| Option | Description | Selected |
|--------|-------------|----------|
| Input-only seam | Optional input-only callback/signal mirroring onStreamDelta; abort wins mid-wait; Phase 8 wires UI dialog | ✓ |
| No seam | Hard-coded pause, can't be exercised or surfaced | |

**User's choice:** Input-only seam

---

## Output migration + hook

### Output shape (C6)

| Option | Description | Selected |
|--------|-------------|----------|
| Return AgentTurnOutcome | Swap AgentTurnOutput → AgentTurnOutcome (status/evidence/plannerCalls/toolCalls); streamedText stays via onStreamDelta; documented D-20 fence inversion | ✓ |
| Extend AgentTurnOutput | Bolt evidence onto existing shape; violates §18 create/modify list | |

**User's choice:** Return AgentTurnOutcome

### Partial in UI

| Option | Description | Selected |
|--------|-------------|----------|
| Wire honest mapping now | partial/failed → failed (partial text + Retry), aborted → idle; no new UI surface | ✓ |
| Defer to Phase 7 | Masking cap-exhaustion as success violates AGT-03 | |

**User's choice:** Wire honest mapping now

### Verdict types home (C6)

| Option | Description | Selected |
|--------|-------------|----------|
| harness.ts + Zod | Extend src/types/harness.ts (lines 1-13) with AgentTrajectoryState + AgentTurnOutcome, Zod-validated at boundary (GR-4) | ✓ |
| ai/types.ts | Splits the C.1 home; violates R-1 | |

**User's choice:** harness.ts + Zod

---

## the agent's Discretion

- F-4 tool_result section shape for replan feedback (planner picks, consistent with 03-07 sections-in).
- Trajectory transition observability mechanism (callback vs post-turn read) — must be test-observable; illegal transition throws AGENT_STATE_INVALID (C5).
- Exact tier-derived trajectory-cap formula (plannerCap + toolCap + small deterministic slack).
- verify:phase-3a script shape (follow §24 pattern).

## Deferred Ideas

- AGT-05 commit-confirm barrier UI + permission gating → Phase 8 (TOL-02/03, PermissionDialog).
- Side-effect compensation / rollback idempotency → Phase 8 (TOL-05).
- Reliability telemetry counters / durable trace → Phase 6 (AITransactionLog; parallel to AI-04 budget deferral D-16).
- Trajectory/checkpoint persistence + cross-session suspend/resume → v0.2+ (§17.7.7).
- RICH stage indicators / trajectory UI → Phase 7 (RICH-03).
