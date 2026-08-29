# Phase 4: Agent Reliability and Evidence - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 makes the agent's execution **reliable and honest**: every turn produces an explicit structured `AgentTurnOutcome` (§28.2 AGT-03), the turn tracks a closed **trajectory state machine** (AGT-01), side-effecting tool success requires **CompletionEvidence** (AGT-02), and replanning follows a **deterministic retry/terminal policy** that never silently claims success (AGT-04). The pipeline from Phase 3 (Planner → Executor → Renderer in AgentOrchestrator) gains reliability framing without changing provider routing.

**Scope is per spec §18 Phase 4.** Create/modify: `AgentTrajectoryState`, `OutcomeVerifier`, `CompletionEvidence`, `AgentTurnOutcome`, `AgentOrchestrator` integration, Renderer completion guard. Required tests: `tests/core/ai/trajectory/**`, `tests/core/ai/OutcomeVerifier.test.ts`. Canonical types live in `@/types/harness` (Appendix C.1); the worked OutcomeVerifier reference implementation is **Appendix O.2** (verbatim shape for `buildOutcome`).

**DONE-when (from §18 + §28.2):** trajectory transitions asserted against the closed state machine (AGT-01); side-effecting tools without `CompletionEvidence` cannot render a "Done" message (AGT-02); cap exhaustion produces `AgentTurnOutcome: partial`, never a successful state (AGT-03); repeated identical tool failure → terminal `partial`/`failed`; abort produces `aborted` (AGT-04). Tests: `tests/core/ai/trajectory/**`, `tests/core/ai/OutcomeVerifier.test.ts`. Gate: `pnpm run verify:phase-4`.

**Out of scope (verified in spec §18 / PROJECT.md / REQUIREMENTS.md):** ContextOptimizer/TokenBudget/OptimizedContext (Phase 5 — note `verify:phase-4` currently mis-points at `tests/core/context`, which is Phase 5 territory; Phase 4 must re-point the gate at its own test dirs), page extraction (Phase 6), trust-aware context + receipts (Phase 7), ToolCapabilityManifest / risk matrix / verifier registry / tool governance (Phase 18 — `OutcomeVerifier` framework + evidence shape land in Phase 4, but registered verifiers and manifests are Phase 18), AITransactionLog / trajectory persistence (Phase 11), RICH persona UI (Phase 15).

**Research-driven note:** §1.6.1 / §1.5 "Retries do not multiply" — only three retry layers exist (ProviderRouter §1.5, AGT-04 replan, one per-stage retry), bounded by §1.4 tier caps. Risk R-8 ("Skips the verifier and marks a write done") is the security threat this phase closes via postcondition verifier + CompletionEvidence (§28.2).

</domain>

<decisions>
## Implementation Decisions

### Canonical types home + outcome shape
- **D-60 (`@/types/harness` canonical home):** Create `src/types/harness.ts` (or matching alias target) holding `AgentTrajectoryState`, `CompletionEvidence`, `AgentTurnOutcome` **verbatim from Appendix C.1** — the spec's single source of truth for these types. `ToolExecutionResult.evidence` (already declared as `import('@/types/harness').CompletionEvidence` in `src/core/ai/types`/toolSchemas) resolves against it. No parallel copy in `src/core/ai`. — **Reversibility:** `reversible` — rationale: a new module; moving types later is an import-path edit.
- **D-61 (Evolve `AgentTurnOutput` → `AgentTurnOutcome`, additive):** Phase 3's `AgentTurnOutput` (`streamedText` + `toolResults` + `reasonCode` in `AgentOrchestrator.ts`) is superseded by the Appendix C.1 `AgentTurnOutcome` (adds `operationId`, `status: 'completed'|'partial'|'failed'|'aborted'`, `evidence: CompletionEvidence[]`, `plannerCalls`, `toolCalls`). The existing fields are retained additively — `AgentTurnOutcome` gains the streamed answer as the turn's rendered output (or is composed with the existing return shape). Chat consumers (`useChatStreaming`) keep reading `streamedText`/`reasonCode`; no consumer breakage. — **Reversibility:** `costly` — rationale: changes the pipeline's public return contract consumed by both chat hooks; re-shaping later is a re-wire.

### Trajectory state machine
- **D-62 (Explicit trajectory tracker with closed transitions):** A dedicated `trajectory` module (mirroring the `tests/core/ai/trajectory/**` test dir) owns `AgentTrajectoryState` transitions per turn: `assembling-context → planning → waiting-for-permission → executing → verifying → replanning → rendering → completed|failed|aborted`. Transitions are asserted against the **closed state machine** (§28.2 AGT-01) — the tracker either validates a step against a transition table or records steps in a type-safe way that makes illegal transitions unrepresentable. It coexists with `ActiveStreamState` (§20.6, stream-level UI state) — the trajectory is turn-level agent evidence, the stream state is surface-level streaming UI; do NOT conflate them. — **Reversibility:** `reversible` — rationale: additive module; later phases surface it in diagnostics.
- **D-63 (Per-turn trajectory recorded, not persisted):** Each `runAgentTurn` builds its own `AgentTrajectoryState` record (operationId from the turn's OperationId, phase, `plannerCalls`, `toolCalls`, `updatedAt`) and it surfaces on/with the `AgentTurnOutcome`. No persistence to storage in Phase 4 (AITransactionLog is Phase 11) — trajectory is in-memory per turn, testable via the outcome's counters. — **Reversibility:** `reversible` — rationale: in-memory record; persistence later is additive.

### OutcomeVerifier + CompletionEvidence
- **D-64 (OutcomeVerifier ships the Appendix O.2 framework, zero registered verifiers):** `OutcomeVerifier.ts` implements the O.2 contract — `Verifier` interface (`postconditionId`, `verify(result)`) + `buildOutcome(operationId, results, verifiers, caps)` returning the `AgentTurnOutcome`. Phase 4 registers ZERO verifiers (matching D-46 zero tools; real tools + their postcondition verifiers land with owning phases / Phase 18). The framework is exercised by fixtures that inject `ToolExecutionResult`s with/without side effects. — **Reversibility:** `reversible` — rationale: additive framework; verifier registration later is a table entry.
- **D-65 (Renderer completion guard — no "Done" without evidence):** The Renderer path MUST NOT emit a completion/"Done" claim for any side-effecting tool result lacking matching `CompletionEvidence` (AGT-02 / risk R-8). Concretely: when assembling the final answer, if `toolResults` contains a side-effecting tool whose `ok` is true but `evidence` is absent, the renderer output is suppressed or flagged (`status: partial`/a guard reason), never a clean success. The guard is testable with an injected fake side-effecting result. — **Reversibility:** `costly` — rationale: sits inside the renderer completion path; relaxing later is a one-line change but the AGT-02 contract is the point of the phase.

### Deterministic replan/terminal policy
- **D-66 (AGT-04 in the AgentOrchestrator loop, capped by tier caps):** Replanning follows the deterministic policy verbatim: at most **one replan per failed tool** within the tier's planner cap (§1.4); a **repeated identical failure** (same tool, same error identity), a **cap breach**, or an **abort** is terminal → `AgentTurnOutcome: partial` (cap exhaustion) or `failed` (repeated failure) or `aborted` (abort). Never a silent success. The loop's existing `plannerCalls`/`toolCalls` counters (already tracked in `runAgentTurn`) feed the cap checks; the policy keys repeated-failure identity off the tool name + a stable error signal. Retry layering stays bounded (§1.6.1: ProviderRouter §1.5 + AGT-04 replan + one per-stage retry, all under tier caps). — **Reversibility:** `costly` — rationale: modifies the core bounded loop; reverting to the Phase-3 single-pass loop later is a behavioral change.
- **D-67 (Replan exercises the framework, not real tools):** With zero registered tools (D-46), the replan path is exercised via injected `ToolExecutionResult`s in tests (a failing injected tool triggers one replan then terminal), exactly as the ExecutorService zero-tool contract is tested today. No fake tools are registered. — **Reversibility:** `reversible` — rationale: test-only exercise path; real replans arrive with real tools.

### Verification gate
- **D-68 (Re-point the phase-4 verification gate):** The package.json `verify:phase-4` script currently targets `tests/core/context` (Phase 5 territory, dir does not exist yet). Phase 4 re-points it to the §18 required tests — `tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts` (plus existing `tests/core/ai` if the AgentOrchestrator changes need the whole AI suite; keep the trajectory/OutcomeVerifier dirs mandatory). — **Reversibility:** `reversible` — rationale: package.json script edit.

### the agent's Discretion
- Exact `AgentTrajectoryState` tracking mechanism (transition-table validator vs type-level encoding) — either is fine as long as AGT-01 is asserted.
- How `streamedText` composes with the Appendix C.1 `AgentTurnOutcome` (field addition vs composed wrapper) — must keep `useChatStreaming` consumers working.
- `AgentTurnOutcome.status` mapping for the existing `configuration_required` / `ask_clarification` terminal reasons (they are legitimate terminal outcomes, not failures — planner's call to map them onto the closed status set without inventing new statuses).
- Whether the trajectory module lives in `src/core/ai/trajectory.ts` or a `src/core/ai/trajectory/` directory (mirror the test dir).
- Where `@/types/harness` physically lands (`src/types/harness.ts` vs `src/types/harness/index.ts`) — resolve against the existing `src/types/` layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec / scoping
- `.planning/PRODUCT_SPEC_v0_1.md` §18 (Phase 4 block — Create/modify list, Required tests `tests/core/ai/trajectory/**` + `tests/core/ai/OutcomeVerifier.test.ts`, DONE-when) — sole authority on the Phase-4 file inventory and gates.
- `.planning/PRODUCT_SPEC_v0_1.md` §28.2 — AGT-01…04 verbatim (trajectory states, CompletionEvidence, structured AgentTurnOutcome, deterministic replan policy).
- `.planning/PRODUCT_SPEC_v0_1.md` §1.4 — tier caps (plannerCap/toolCap) that bound the replan policy; cap exhaustion → `partial`.
- `.planning/PRODUCT_SPEC_v0_1.md` §1.5 + §1.6.1 — retry layering ("only three retry layers… never nest"), risk R-8 (skips verifier → write "done").
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 — canonical `AgentTrajectoryState`, `CompletionEvidence`, `AgentTurnOutcome` (in `@/types/harness`).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix O.2 — worked OutcomeVerifier + `buildOutcome` reference implementation (verbatim shape).
- `.planning/PRODUCT_SPEC_v0_1.md` §21.6 — closed error-code set (no invented codes, D-38); status set for AgentTurnOutcome is closed by C.1.
- `.planning/PRODUCT_SPEC_v0_1.md` §20.6 — ActiveStreamState (stream-level UI state; distinct from turn-level trajectory — do not conflate).
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 / §5.2 — MV3 boundaries: AI runs in UI contexts only.

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 4: Agent Reliability and Evidence" — goal + success criteria + verification gate.
- `.planning/REQUIREMENTS.md` AGT-01…04 rows (lines ~205-213) + phase table.
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-CONTEXT.md` — D-44…59 (pipeline, D-46 zero tools, D-45 persist seam, D-54a configuration-required, D-59 single choke-point); the Phase-3 `AgentTurnOutput` this phase evolves (D-61).
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-06-PLAN.md` / `03-06-SUMMARY.md` — the AgentOrchestrator bounded loop this phase modifies.
- `.planning/STATE.md` — decisions 12 (D-12 DEMO_MODE), 17 (D-21 strict ceiling → new code strict-clean), retry-layering watch.

### Codebase maps (refreshed 2026-08-18)
- `.planning/codebase/ARCHITECTURE.md` — per-surface module singletons; AgentOrchestrator instantiation.
- `.planning/codebase/STACK.md` — exact version table (zod ^4; Appendix L pins zod-to-json-schema for structured output).
- `.planning/codebase/CONCERNS.md` — scaffold defects already fixed in Phase 3.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/ai/AgentOrchestrator.ts` — the Appendix I bounded loop (`runAgentTurn`) with `plannerCalls`/`toolCalls` counters, tier-cap checks (`planner_cap_reached`/`tool_cap_reached`), the `AgentTurnOutput` shape this phase evolves (D-61), and the `configuration_required` typed non-error outcome (D-54a). The replan/terminal policy (D-66) slots into this loop.
- `src/core/ai/types.ts` / `toolSchemas.ts` — `ToolExecutionResult` already carries `evidence?: import('@/types/harness').CompletionEvidence` (declared for §28.2); `ExecutorService` already returns typed `ToolRejectedResult`. The evidence seam exists — Phase 4 fills the `@/types/harness` target it references.
- `src/core/ai/RendererService.ts` — the renderer completion guard (D-65) attaches here; current `render` streams the final answer with a 512-token cap.
- `src/core/ai/ExecutorService.ts` — zero-tool registry + `TOOL_REJECTED`; the injected-result fixture pattern for replan tests (D-67) mirrors its test approach.
- `src/core/runtime/workerState.ts` — `ActiveStreamState` (§20.6) — the stream-level UI machine; keep separate from turn-level trajectory (D-62).
- `src/types/` (`index.ts`, `storage.ts`) — where `@/types/harness` lands (D-60); path alias `@/*` → project root already configured.
- `src/core/runtime/RuntimeEnvelope.ts` — `OperationId` for the trajectory/outcome `operationId` field.

### Established Patterns
- **Typed discriminated unions / Zod** — `PlannerDecisionSchema`, `StageEvent`, canonical stream events; `AgentTurnOutcome.status` is a closed union the same way.
- **Declare-now/populate-later** — toolSchemas (D-46) and now the verifier framework (D-64): framework + contract ship, registrations arrive with owning phases.
- **Fixture-driven tests** — Phase-3 fixture library (`tests/core/ai/fixtures/`) covers normal/failure/fallback/abort; trajectory + OutcomeVerifier tests extend the same style.
- **Per-surface module singleton** — AgentOrchestrator instantiated per surface (side panel / standalone).

### Integration Points
- `useChatStreaming` → `runAgentTurn` → `AgentTurnOutput` (becomes `AgentTurnOutcome`, D-61) → `streamedText`/`reasonCode` still consumed.
- `runAgentTurn` loop → trajectory tracker (D-62/D-63) → `AgentTurnOutcome` (status + counters + evidence).
- `ExecutorService.execute` → `ToolExecutionResult` (with `evidence` seam) → `OutcomeVerifier.buildOutcome` (D-64) → `AgentTurnOutcome.evidence` → renderer completion guard (D-65).
- Tier caps (§1.4) + AGT-04 replan/terminal policy (D-66) — both enforced inside the single bounded loop.

</code_context>

<specifics>
## Specific Ideas

- **"Never silently claims success"** is the phase's spine — the user's core expectation (AGT-03/04): cap exhaustion = `partial`, repeated failure = `failed`, abort = `aborted`; a "Done" message only ever appears with evidence.
- **Trajectory is evidence, not UI state** — the closed state machine (AGT-01) is asserted in tests and recorded per turn; it is distinct from `ActiveStreamState`. Diagnostics surfacing is Phase 11.
- **O.2 is the verbatim reference** — implement `OutcomeVerifier.buildOutcome` per Appendix O.2 (cap → `partial` with `reasonCode: 'cap_exhausted'`; side-effect failure → `failed`/`postcondition_failed`; else `completed`/`ok`).
- **No new error codes** — the outcome status set is closed by Appendix C.1; existing Phase-3 terminal reasons (`configuration_required`, `ask_clarification`, `planner_cap_reached`, `tool_cap_reached`) map onto it without inventing statuses (D-38 / §21.6).
- **NP-STRICT ceiling → 0** — new Phase-4 code must be strict-clean (STATE.md decision 17); zero new `@ts-expect-error NP-STRICT` markers.

</specifics>

<deferred>
## Deferred Ideas

- **ToolCapabilityManifest + registered postcondition verifiers** — Phase 18 (§28.5 / TOL-01, risk matrix, idempotency); Phase 4 ships the framework + evidence shape, zero registrations (D-64).
- **AITransactionLog + trajectory persistence** — Phase 11; Phase 4 keeps trajectory in-memory per turn (D-63).
- **Diagnostics panel surfacing trajectory / evidence** — Phase 11; the types are the future substrate.
- **ContextOptimizer / OptimizedContext / TokenBudget** — Phase 5 (which owns `tests/core/context` — do not mis-place Phase-4 tests there).
- **Trust-aware context + receipts** — Phase 7.
- **Real tools with verifier-able side effects** — owning phases; Phase 4 replan is framework-exercised via injection only (D-67).

None of these belong in Phase 4 — discussion stayed within phase scope.

</deferred>

---
*Phase: 4-Agent Reliability and Evidence*
*Context gathered: 2026-08-28*