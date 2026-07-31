# Phase 3a: Agent Reliability & Evidence - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade `AgentOrchestrator.runTurn()` with a typed trajectory state machine, structured `AgentTurnOutcome` on every exit path, `OutcomeVerifier` for evidence-backed completion, and `ReplanPolicy` for deterministic replanning. Wraps the existing planner loop (`AgentOrchestrator.ts:84-197`) — trajectory states emit at each pipeline stage, invalid transitions are rejected via a strict allowlist, and `RendererService` renders from a `RenderingOutcomePolicy` that prevents claiming write success without verified `CompletionEvidence`.

This is a core reliability upgrade — no UI changes, no new tools. New modules in `src/core/ai/`: `AgentTurnOutcome.ts`, `AgentTrajectoryMachine.ts`, `OutcomeVerifier.ts`, `ReplanPolicy.ts`, `RegisteredTool` extensions. Existing `AgentOrchestrator.runTurn()` return type changes from `Promise<string>` to `Promise<AgentTurnOutcome>` with `runTurnText()` compatibility wrapper. Downstream consumers (Phase 6 AITransactionLog, Phase 7 stage indicators) consume trajectory events and outcomes.
</domain>

<decisions>
## Implementation Decisions

### Trajectory State Machine & Return Type
- **D-01:** `AgentOrchestrator.runTurn()` returns `AgentTurnOutcome` as the canonical Phase 3a API. `runTurnText()` is a deprecated compatibility wrapper that calls `runTurn()` and returns `renderedAnswer` for existing consumers during migration. No `getLastOutcome()` — shared mutable snapshots are unsafe across concurrent turns and surfaces — **Reversibility:** one-way — `runTurn()` return type is the API contract consumed by all callers; changing it back to string would require undoing all downstream outcome consumers.
- **D-02:** `AgentTurnOutcome` is comprehensive — carries: `operationId`, `terminalState` (`completed`|`partial`|`failed`|`aborted`), `reasonCode`, `renderedAnswer` (`string|null`), `trajectory` (readonly `TrajectoryStateEntry[]`), `evidence` (readonly `CompletionEvidence[]`), `toolResults` (readonly `ToolExecutionResult[]`), `limits` (`plannerCalls`/`plannerCap`/`plannerCapReached`, `toolCalls`/`toolCap`/`toolCapReached`), `abort` (`requested`/`requestedAt`/`stage`), `usage` (`inputTokens`/`outputTokens`/`totalTokens`/`estimatedCost`/`currency`), `diagnostics` (`errors`/`warnings`), `startedAt`, `endedAt`, `durationMs` — **Reversibility:** costly — adding or removing fields from the outcome contract affects every consumer (diagnostics, UI, collaboration traces); fields should only grow.
- **D-03:** Hybrid trajectory state machine — `AgentOrchestrator` owns an internal, operation-scoped state machine that validates every transition and accumulates immutable `TrajectoryStateEntry` records. An optional `onTrajectoryTransition` callback (passed via `AgentTurnInput`) fires after each successful transition for live consumers (Phase 7 stage indicators, Phase 6 `AITransactionLog`). The callback must not approve/reject transitions, modify state, or cause turn failure if the consumer throws. `AgentTurnOutcome.trajectory` is the authoritative final record — **Reversibility:** costly — changing the callback contract affects every live consumer that subscribes to trajectory events.
- **D-04:** Strict transition map (`ALLOWED_TRANSITIONS`) validates every state change via explicit allowlist. `assembling-context→{planning,failed,aborted}`, `planning→{waiting-for-permission,executing,rendering,failed,aborted}`, `waiting-for-permission→{executing,rendering,failed,aborted}`, `executing→{verifying,replanning,rendering,failed,aborted}`, `verifying→{replanning,rendering,failed,aborted}`, `replanning→{planning,rendering,failed,aborted}`, `rendering→{completed,failed,aborted}`. Terminal states (`completed`/`failed`/`aborted`) have empty allowlists. Every legal path is visible, reviewable, and independently testable — **Reversibility:** one-way — the transition map is the runtime contract for all trajectory consumers; changing transitions breaks audit trails and any diagnostics that depend on the sequence.
- **D-05:** `AgentTurnReasonCode` is a closed, outcome-oriented set distinguishing: planner termination, clarification, planner-cap exhaustion, tool-cap exhaustion, permission termination, verification failure, pipeline failure, and user abort. Detailed technical errors remain in `AgentTurnOutcome.diagnostics.errors` — **Reversibility:** one-way — reason codes appear in diagnostics logs and are the primary classification for success/failure analysis; renaming or removing codes orphans historical records.
- **D-06:** Explicit abort handling — `AgentOrchestrator` checks the shared `AbortSignal` before and after each awaited pipeline stage. Abort transitions to `aborted` (never `failed`), stops starting new stages, records abort metadata (`requestedAt`, `stage`), skips rendering and verification, returns `terminalState: 'aborted'`. `AbortError` from sub-services is normalized through the same abort finaliser — **Reversibility:** one-way — conflating abort with failure would break Phase 7 cancellation UX and Phase 6 abort telemetry.
- **D-07:** `TrajectoryStateEntry` records `state` (`AgentTrajectoryState`), `enteredAt`, `exitedAt`, `durationMs`, optional `reasonCode`, `plannerCall`, `toolCall`, `toolName` — **Reversibility:** costly — adding retrospective metadata fields to trajectory entries requires replaying or extrapolating from partial records.

### CompletionEvidence & OutcomeVerifier
- **D-08:** `RegisteredTool` extends with forward-compatible evidence fields: `sideEffect` (`none`|`read`|`write`|`irreversible`), `evidence` (`ToolEvidencePolicy` with `required` boolean and optional `verifier` function), `idempotency` (`not-required`|`supported`|`required`). Phase 8a evolves these into full `ToolCapabilityManifest` without changing their meaning — **Reversibility:** one-way — the `RegisteredTool` interface is the contract for every tool registration across all phases; changing field semantics would require updating every tool implementation.
- **D-09:** `CompletionEvidence` is a structured discriminated union: `VerifiedCompletionEvidence` (`verified: true`, `verifierType: 'schema'|'environment'|'read-after-write'|'tool-provided'`, `checks: CompletionEvidenceCheck[]`, `resultRef?: CompletionResultRef`) and `UnverifiedCompletionEvidence` (`verified: false`, `failureReason: 'postcondition_failed'|'evidence_unavailable'|'verification_timeout'|'verification_error'|'aborted'`, `retryable: boolean`). Shared: `id`, `operationId`, `toolCallId`, `toolName`, `verifiedAt`, `durationMs` — **Reversibility:** costly — the evidence shape is consumed by RendererService rendering policy, diagnostics display, and evolution candidate pipelines; changing it touches all three.
- **D-10:** Dedicated `OutcomeVerifier` service in `src/core/ai/verifier/` — called by `AgentOrchestrator` after tool execution. Returns `CompletionEvidence`. Owns postcondition checking, verifier type routing, timeout handling, and evidence formatting. Independently testable and reusable across future phases — **Reversibility:** costly — moving verification logic in or out of the orchestrator would require refactoring the verification call site and the test isolation boundary.
- **D-11:** `AgentOrchestrator` builds `RenderingOutcomePolicy` from `CompletionEvidence` before calling `RendererService`. `RendererService` renders from that policy — never independently decides evidence sufficiency. Must not claim write success without matching verified evidence. Produces evidence-constrained wording. The orchestrator is the gatekeeper, not the renderer — **Reversibility:** one-way — inverting the responsibility (renderer as gatekeeper) would make every answer vulnerable to model hallucination bypassing verification.

### Replanning Policy
- **D-12:** `ReplanPolicy` is a separate, pure, independently testable function — independent of `PipelineError`. Called by `AgentOrchestrator` at two checkpoints: after tool execution fails, and after outcome verification completes. `PipelineError` taxonomy stays as-is — **Reversibility:** costly — merging replanning logic into the error taxonomy would couple infrastructure errors (provider timeouts) with agent-level decisions (should we retry this tool?), making both harder to test.
- **D-13:** `sideEffect: 'irreversible'` blocks replanning — after executing an irreversible tool, `ReplanPolicy` returns `terminate` for any subsequent failures. The classification is in the tool manifest, not inferred from execution context — **Reversibility:** one-way — changing how irreversibility is detected would alter replay safety guarantees and could allow replanning after operations the user expected to be one-shot.
- **D-14:** `ReplanDisposition` is `continue-planning` | `replan` | `render` | `terminate`. `continue-planning`: tool succeeded, loop continues. `replan`: bounded one-additional PlannerService call with failed/partial attempt as structured redacted observation. `render`: skip to rendering. `terminate`: stop immediately, no retry — **Reversibility:** one-way — the disposition enum is the output contract of ReplanPolicy consumed by the orchestrator's control flow; removing a disposition would orphan its corresponding code path.
- **D-15:** One replan = one additional recovery `PlannerService` call within the same turn. `ContextOptimizer` does NOT run again; planner/tool counters do NOT reset; previous tool results and evidence remain available; overall deadline unchanged. `replanCount` increments once — subsequent replan requests rejected. `waiting-for-permission` is NOT a replan — permission approval resumes the existing validated tool decision, denial terminates without allowing automatic bypass — **Reversibility:** one-way — changing what counts as a replan would affect whether turns that currently succeed could fail, and vice versa, altering the agent's reliability guarantees.

### Tool Governance (Phase 3a scope)
- **D-16:** Phase 3a adds only evidence-essential fields to `RegisteredTool`: `sideEffect` (`none`|`read`|`write`|`irreversible`), `evidence` (`ToolEvidencePolicy`), `idempotency` (`not-required`|`supported`|`required`). The full `ToolCapabilityManifest` (category, risk, permissions, dataScopes, timeout, costClass, schema hashes, active discovery) remains Phase 8a responsibility — **Reversibility:** one-way — defining partial or speculative fields now would create a two-phase migration burden when 8a ships the complete manifest.
- **D-17:** Idempotency enforced in Phase 3a for tools with `idempotency: 'required'`. `ExecutorService` accepts or derives a stable logical-operation key and uses an operation-scoped ledger to prevent duplicate execution within the current turn. Duplicate completed call returns prior validated result and evidence. Duplicate with unknown final state is not executed again. Durable cross-turn, restart-safe, and external-system idempotency are Phase 8a responsibilities — **Reversibility:** costly — adding persistence to the in-memory idempotency ledger changes the durability guarantee; until then, SW restart resets the ledger.

### the agent's Discretion
No areas were deferred to the agent — all 4 gray areas had explicit decisions from the user.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Specification (Rev. C)
- `.planning/PRODUCT_SPEC_v0_1.md` §28.2 — Agent Reliability: trajectory states, evidence-backed completion, structured outcomes, deterministic replanning
- `.planning/PRODUCT_SPEC_v0_1.md` §28.5 — Tool Governance: ToolCapabilityManifest, risk-based execution, postcondition verification (TOL-03 spans Phase 3a/8a)

### Project & Roadmap
- `.planning/ROADMAP.md` Phase 3a — Goal, success criteria (4 items), depends on Phase 3
- `.planning/PROJECT.md` — Constraints (MV3 rules, cost-effective runtime), Key Decisions (agent harness stays bounded, evidence-backed completion required, no self-modification, deterministic replanning)
- `.planning/REQUIREMENTS.md` — AGT-01 (trajectory states), AGT-02 (evidence-backed completion), AGT-03 (structured outcomes), AGT-04 (deterministic replanning), TOL-03 (postcondition verification)

### Prior Phase Context
- `.planning/phases/03-ai-core-pipeline/03-CONTEXT.md` — D-05 (planner-controlled termination via PlannerDecision), D-06 (tier cap as safety net), D-10 (PipelineError taxonomy), D-11 (AgentOrchestrator dispatch table), D-12 (PlannerContext assembly). Integration points: AgentOrchestrator.runTurn(), PlannerService.plan(), ExecutorService.execute(), RendererService.synthesize()/stream()
- `.planning/phases/04-context-optimization-pipeline/04-CONTEXT.md` — D-01 (ContextOptimizer runs once per turn before planner loop), D-02 (OptimizedContext reused across planner/renderer), D-03 (AgentTurnInput replaces PlannerContext), D-04 (PlannerService and RendererService accept OptimizedContext directly)

### Research
- `.planning/research/PITFALLS.md` — Critical: `@ai-sdk/*` v1→v4 migration, `ai` core v7 (`system`→`instructions` rename), `zod` v4

### Existing Code — Phase 3/4 Pipeline
- `src/core/ai/AgentOrchestrator.ts` — `runTurn()` (lines 84-197): existing planner loop, context optimization, provider selection, tool execution, rendering. Will be refactored with trajectory machine + outcome + evidence
- `src/core/ai/ExecutorService.ts` — `execute()` (lines 53-115): tool validation, timed execution, error classification. Gains idempotency ledger and evidence-aware tool interface
- `src/core/ai/PlannerService.ts` — `plan()` (lines 90-123): dual-mode structured output. Gains replanning context in recovery calls
- `src/core/ai/RendererService.ts` — `synthesize()` and `stream()`: both gain `RenderingOutcomePolicy` input from orchestrator
- `src/core/ai/PipelineError.ts` — Existing error taxonomy with `retryable`/`terminal`: stays as-is, `ReplanPolicy` is separate
- `src/core/ai/types.ts` — `AgentTurnInput`, `PlannerDecision`, `RegisteredTool`, `ToolExecutionResult`: `RegisteredTool` extended; `AgentTurnOutcome` and related types added
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **AgentOrchestrator** (`src/core/ai/AgentOrchestrator.ts`): Singleton orchestrator with planner loop. Trajectory machine, outcome verifier, and replan policy hook into `runTurn()`. Existing `buildOptimizerInput`, `buildRegisteredTools`, `dispatchError` stay.
- **PlannerService** (`src/core/ai/PlannerService.ts`): Dual-mode plan() with structured output + JSON fallback. Recovery replan calls use the same method with additional context.
- **ExecutorService** (`src/core/ai/ExecutorService.ts`): Tool validation + timeout enforcement. Gains idempotency ledger (in-memory Map) and evidence-aware `RegisteredTool` interface.
- **RendererService** (`src/core/ai/RendererService.ts`): `synthesize()` and `stream()`. Gains `RenderingOutcomePolicy` parameter.
- **PipelineError** (`src/core/ai/PipelineError.ts`): Standardized error codes, retryable/terminal categories, diagnostic metadata. Stays unchanged.
- **ProviderRouter** (`src/core/ai/ProviderRouter.ts`): Provider selection with fallback/circuit-breaker. No changes needed.
- **ContextOptimizer** (`src/core/context/`): Already runs once per turn — replanning does NOT re-optimize.

### Established Patterns
- **Module-level singletons**: `AgentOrchestrator`, `ProviderRouter`, `PlannerService` are module-level singletons. `OutcomeVerifier` and `ReplanPolicy` follow this pattern.
- **Core module isolation**: `src/core/ai/` does not import from `src/components/`. New modules follow the same boundary.
- **Zod validation**: Phase 3 uses Zod for `PlannerDecisionSchema`. New types (`AgentTurnOutcome`, `CompletionEvidence`, etc.) follow this pattern.
- **Structured error codes**: Phase 3's `PipelineError` pattern is reused for any new error types.
- **Zustand stores**: Domain-specific stores with chrome.storage.local persistence. Not needed for Phase 3a (all state is operation-scoped).

### Integration Points
- **AgentOrchestrator.runTurn()** — Primary refactoring target. Trajectory machine wraps the entire method. Outcome built at every exit point.
- **ExecutorService.execute()** — Gains idempotency ledger and `RegisteredTool` evidence fields.
- **RendererService.synthesize()/stream()** — New `RenderingOutcomePolicy` parameter.
- **Future consumers**: Phase 6 `AITransactionLog` consumes trajectory events and outcomes. Phase 7 stage indicators consume `onTrajectoryTransition` callback. Phase 8a `ToolCapabilityManifest` extends Phase 3a's `RegisteredTool` evidence fields.
</code_context>

<specifics>
## Specific Ideas

- `AgentTurnOutcome` is the authoritative immutable result of one agent turn — must explain terminal state, why the turn ended, cap exhaustion, abort status, rendered answer, tools executed, evidence verified, trajectory states, and errors/warnings.
- `RenderingOutcomePolicy` is derived from `CompletionEvidence` by the orchestrator, not the renderer. Renderer must not independently decide evidence sufficiency.
- Trajectory callbacks are fire-and-forget — consumer failures do not affect the turn. Internal state machine is the authority.
- `waiting-for-permission` is a pause, not a replan. Permission approval resumes the existing decision. Denial terminates without bypass.
- ContextOptimizer does NOT re-run on replan. Planner counters do not reset. One additional PlannerService call is the replan budget.
- Idempotency is operation-scoped and in-memory for Phase 3a. Cross-turn durability is Phase 8a.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No scope creep was raised.
</deferred>

---

*Phase: 3a-Agent Reliability & Evidence*
*Context gathered: 2026-07-31*
