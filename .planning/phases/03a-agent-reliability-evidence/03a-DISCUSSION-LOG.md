# Phase 3a: Agent Reliability & Evidence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 3a-Agent Reliability & Evidence
**Areas discussed:** Trajectory State Machine & Return Type, CompletionEvidence & OutcomeVerifier, Replanning Policy, Tool Governance Scope for Phase 3a vs 8a

---

## Trajectory State Machine & Return Type

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| How should runTurn() evolve its return type? | New return type — AgentTurnOutcome replaces string; Dual path — runTurnWithOutcome() + legacy; Event emitter | New return type + runTurnText() wrapper + operation-scoped callback |
| What fields does AgentTurnOutcome carry? | Minimal; Comprehensive; Layered | Comprehensive — full turn record |
| How should trajectory states be tracked? | Internal state machine; Event callback; Hybrid | Hybrid — internal machine + optional callback |
| How should transitions be validated? | Strict transition map; Phase gating | Strict ALLOWED_TRANSITIONS map |
| What AgentTurnReasonCode values? | Full set; Minimal set | Closed outcome-oriented set |
| Abort handling? | Explicit abort handling; Error-driven | Explicit — abort→aborted never failed |

**User's choice:** runTurn() returns AgentTurnOutcome. runTurnText() compatibility wrapper for migration. Operation-scoped optional callback for live events. No getLastOutcome(). Abort is explicit terminal state.

**Notes:** AgentTurnOutcome carries operationId, terminalState, reasonCode, renderedAnswer, trajectory, evidence, toolResults, limits, abort, usage, diagnostics, and timing metadata. Strict transition map covers non-linear pipeline with permission waits, direct rendering, verification, replanning, failure, and abort from any non-terminal state.

---

## CompletionEvidence & OutcomeVerifier

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| How to mark tools requiring evidence? | Extend RegisteredTool; Separate registry; Inline execution | Extend RegisteredTool — forward-compatible |
| Shape of CompletionEvidence? | Structured; Minimal | Structured typed discriminated union |
| Where does OutcomeVerifier live? | AgentOrchestrator; ExecutorService; Dedicated OutcomeVerifier | Dedicated OutcomeVerifier service |
| How does RendererService use evidence? | Renderer checks array; Orchestrator blocks; Qualified answer | Orchestrator builds RenderingOutcomePolicy |

**User's choice:** RegisteredTool extended with sideEffect, evidence (ToolEvidencePolicy), and idempotency. CompletionEvidence is Verified/Unverified discriminated union with checks, verifierType, and resultRef. Orchestrator determines outcome and builds RenderingOutcomePolicy — RendererService never independently decides evidence sufficiency.

**Notes:** OutcomeVerifier is a dedicated service in src/core/ai/verifier/. Renderer must not claim write success without verified evidence. Evidence-constrained wording, not [pending verification] caveats.

---

## Replanning Policy

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| New error taxonomy or separate policy? | Extend PipelineError; Separate ReplanPolicy | Separate ReplanPolicy |
| How to identify irreversible actions? | sideEffect:'irreversible'; Any write blocks replan | sideEffect:'irreversible' in tool manifest |
| How does ReplanPolicy integrate? | Policy function; Baked into switch cases | Pure function at two checkpoints |
| ReplanDisposition values? | Three dispositions; Four dispositions | continue-planning | replan | render | terminate |
| What counts as one replan? | One extra planner pass; Planner re-evaluates with result | One additional PlannerService call with context |

**User's choice:** ReplanPolicy is pure function called after tool failure and after verification. One replan = one additional PlannerService call, no context re-optimization, no counter reset. waiting-for-permission is NOT a replan.

**Notes:** ReplanCount max 1 per turn. Recovery call receives failed/partial attempt as structured redacted observation. Irreversible tool execution blocks all subsequent replanning.

---

## Tool Governance Scope for Phase 3a vs 8a

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| How much ToolCapabilityManifest in Phase 3a? | Evidence-essential only; Full interface with stubs | Evidence-essential only |
| Idempotency enforcement level? | Enforced in executor; Declared only | Enforced for idempotency:'required' |

**User's choice:** Phase 3a adds sideEffect, evidence, and idempotency to RegisteredTool. Full ToolCapabilityManifest (category, risk, permissions, dataScopes, timeout, costClass, schema hashes, active discovery) stays Phase 8a. Idempotency enforced with operation-scoped ledger for required tools.

**Notes:** In-memory idempotency only — no cross-turn durability. Duplicate completed returns prior result. Duplicate unknown state is not re-executed. Phase 8a adds persistent replay protection.

---

## the agent's Discretion

No areas were deferred to the agent — all 4 gray areas had explicit decisions from the user.

## Deferred Ideas

None — discussion stayed within phase scope. No scope creep was raised.
