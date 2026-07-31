---
phase: 03a-agent-reliability-evidence
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/ai/types.ts
  - src/core/ai/PipelineError.ts
  - src/core/ai/AgentTurnOutcome.ts
  - src/core/ai/AgentTrajectoryMachine.ts
  - src/core/ai/ExecutorService.ts
  - tests/core/ai/types.test.ts
  - tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts
  - tests/core/ai/ExecutorService.test.ts
autonomous: true
requirements:
  - AGT-01
  - AGT-03
  - TOL-03
user_setup: []
must_haves:
  truths:
    - "The public contracts represent the ten trajectory states, the four terminal outcome states, the closed Phase 3a reason-code union, and the exact three RegisteredTool reliability metadata fields without any Phase 8a manifest fields."
    - "AgentTrajectoryMachine rejects every transition not in the explicit allowlist, rejects transitions after completed, failed, or aborted, finalizes timestamps, and isolates histories between instances."
    - "A required-idempotency tool uses one operation-scoped logical key, returns a previously completed validated result without executing again, permits at most one explicitly marked failed-before-effect recovery, and never re-executes an unknown or started effect."
    - "AgentTurnOutcomeSchema accepts immutable comprehensive outcomes and rejects invalid terminal states, reason codes, evidence variants, and incomplete timestamps."
  artifacts:
    - path: "src/core/ai/types.ts"
      provides: "AgentTurnInput permission/abort signal callback, selected-tool metadata handoff, trajectory/evidence/idempotency contracts, PipelineErrorCode additions, and RegisteredTool reliability metadata."
      exports: ["AgentTrajectoryState", "ALLOWED_TRANSITIONS", "CompletionEvidence", "RegisteredTool", "ToolExecutionResult", "ReplanContext", "ToolSchemaInfo"]
    - path: "src/core/ai/AgentTurnOutcome.ts"
      provides: "Readonly AgentTurnOutcome contract, closed reason codes, Zod schemas, and outcome factory."
      exports: ["AgentTurnOutcome", "AgentTurnReasonCode", "AgentTurnOutcomeSchema", "createAgentTurnOutcome"]
    - path: "src/core/ai/AgentTrajectoryMachine.ts"
      provides: "Operation-scoped strict state machine with immutable transition snapshots and callback isolation."
      exports: ["AgentTrajectoryMachine"]
    - path: "src/core/ai/ExecutorService.ts"
      provides: "Tool-call IDs and in-memory operation-scoped idempotency ledger with completed, failed-before-effect, and unknown states."
      exports: ["ExecutorService", "executorService"]
  key_links:
    - from: "src/core/ai/AgentTrajectoryMachine.ts"
      to: "src/core/ai/types.ts"
      via: "transitionTo reads the exported ALLOWED_TRANSITIONS map and raises PipelineError code AGENT_STATE_INVALID for rejected edges"
    - from: "src/core/ai/ExecutorService.ts"
      to: "src/core/ai/types.ts"
      via: "execute derives the logical key from operationId, toolName, and canonical serialized input while returning a distinct toolCallId"
    - from: "src/core/ai/AgentTurnOutcome.ts"
      to: "src/core/ai/types.ts"
      via: "Outcome schemas validate trajectory entries, CompletionEvidence variants, ToolExecutionResult references, limits, abort metadata, diagnostics, and timestamps"
---

<objective>
Establish the stable Phase 3a contracts and the operation-scoped idempotency primitive before any orchestrator integration. This plan owns all shared type and executor changes so later plans consume complete, compiling interfaces rather than modifying them concurrently.

The contracts follow D-01 through D-09 and D-16/D-17. `runTurn()` will later return the immutable comprehensive `AgentTurnOutcome`; this plan defines that record, the strict trajectory machine, exact tool-call identity, and bounded in-memory duplicate protection without adding Phase 8a capability-manifest fields or persistence.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md
@.planning/phases/03a-agent-reliability-evidence/03a-RESEARCH.md
@.planning/PRODUCT_SPEC_v0_1.md
@.planning/PRODUCT_REQUIREMENTS_AGENT_HARNESS.md
@src/core/ai/types.ts
@src/core/ai/PipelineError.ts
@src/core/ai/AgentTurnInput.ts
@src/core/ai/ExecutorService.ts
@tests/core/ai/ExecutorService.test.ts
</context>

<tasks>
  <task type="auto" tdd="true">
    <name>Define outcome, trajectory, evidence, permission, and idempotency contracts</name>
    <files>src/core/ai/types.ts, src/core/ai/PipelineError.ts, src/core/ai/AgentTurnOutcome.ts, tests/core/ai/types.test.ts</files>
    <behavior>
      - A valid AgentTurnOutcome parses with terminalState completed, partial, failed, or aborted and the canonical reason codes planner_answer, planner_clarification, planner_cap_reached, tool_cap_reached, tool_completed, tool_failed, permission_denied, completion_verified, completion_unverified, verification_failed, planner_failed, renderer_failed, pipeline_failed, invalid_state_transition, irreversible_action_executed, user_aborted, or caller_aborted.
      - AgentTurnOutcomeSchema rejects an unknown terminalState, unknown reasonCode, missing operationId, malformed trajectory entry, mismatched evidence discriminator, or non-null renderedAnswer for an aborted outcome.
      - ALLOWED_TRANSITIONS contains every valid edge from D-04 and no terminal-state edges; the optional permission callback returns granted, denied, or cancelled with an attributable user/caller origin when known.
      - RegisteredTool exposes only sideEffect, idempotency, and evidence as new Phase 3a reliability metadata; CompletionEvidence is keyed by operationId, toolCallId, and toolName and checks contain safe bounded references rather than raw tool output.
      - A PipelineError containing secret-bearing input or exception text produces a safe public diagnostic with only a code-allowlisted message.
    </behavior>
    <read_first>
      - src/core/ai/types.ts — existing AgentTurnInput, PlannerDecision, RegisteredTool, ToolExecutionResult, PipelineErrorCode, TIER_CAPS
      - src/core/ai/PipelineError.ts — existing retryable/terminal mapping that must remain the technical classification authority
      - src/core/ai/AgentTurnInput.ts — factory defaults and re-export boundary
      - .planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md — D-01 through D-09 and D-16/D-17
      - .planning/PRODUCT_SPEC_v0_1.md — §§28.2, 31.2, and 31.3
      - .planning/PRODUCT_REQUIREMENTS_AGENT_HARNESS.md — AGT-01 through AGT-04 and TOL-03
    </read_first>
    <action>
      Add the exact readonly public contracts in the existing core AI type boundary. Keep PipelineError as the technical error type and add the canonical Rev. C technical codes AGENT_STATE_INVALID, TOOL_POSTCONDITION_FAILED, COMPLETION_EVIDENCE_MISSING, and TOOL_IDEMPOTENCY_CONFLICT as terminal classifications; do not use these codes as AgentTurnReasonCode values. D-12 remains intact: PipelineError continues to own technical retryable/terminal classification, while these additive canonical codes carry technical diagnostics. RENDERER_EVIDENCE_CONTRADICTION is a bounded outcome warning, not a new PipelineError classification.

      Define AgentTrajectoryState, TrajectoryStateEntry, ALLOWED_TRANSITIONS, ToolSideEffect, ToolIdempotency, CompletionEvidenceCheck, VerifiedCompletionEvidence, UnverifiedCompletionEvidence, and RenderingOutcomePolicy. Make evidence checks safe: use check name, passed, expected scalar/reference, actualRef, and bounded message; never carry unrestricted output, secrets, or an idempotency key in public diagnostics.

      Extend RegisteredTool only with optional sideEffect, idempotency, and evidence fields. The evidence policy has required plus an optional typed verifier descriptor whose type is schema, environment, read-after-write, or tool-provided and whose checker returns safe CompletionEvidenceCheck values. Add the same three optional reliability fields to ToolSchemaInfo solely as the existing selected-tool adapter handoff; no category, risk, permissions, dataScopes, timeout, costClass, schema hashes, or discovery fields are allowed. Add abortSignal to both AgentTurnInput and ContextOptimizerInput, and validate that optional signal as a runtime pass-through field rather than prompt data. Add toolCallId to ToolExecutionResult, preserving optionality until ExecutorService supplies it. Add the operation-scoped permission callback and redacted ReplanContext observation types without adding a PermissionGate file that does not exist in this repository.

      Define AgentTurnOutcome with all D-02 fields plus abort origin when known, readonly arrays, a Zod schema, and a factory. The schema must enforce the aborted-answer invariant and the exact closed reason-code union above. Export a safe PipelineError projection that preserves code, category, retryable flag, timestamp, and a code-allowlisted user-facing message while removing the original arbitrary message, raw input/output, exception text, secrets, and idempotency keys before a PipelineError enters public outcome diagnostics. Do not retain stale reason names from the existing research examples.
    </action>
    <verify>
      <automated>pnpm vitest run tests/core/ai/types.test.ts</automated>
    </verify>
    <acceptance_criteria>
      - `src/core/ai/types.ts` exports the ten trajectory states, exact D-04 allowlist, evidence union, permission decision/request, ReplanContext, and the three RegisteredTool reliability fields only.
      - `ToolSchemaInfo` carries only the same three reliability metadata fields as an adapter handoff and both AgentTurnInput.abortSignal and ContextOptimizerInput.abortSignal are available to the optimizer/orchestrator path.
      - `src/core/ai/AgentTurnOutcome.ts` exports AgentTurnOutcome, AgentTerminalState, AgentTurnReasonCode, AgentTurnOutcomeSchema, CompletionEvidenceSchema, and createAgentTurnOutcome.
      - `PipelineError.ts` maps every newly added technical code to terminal and leaves existing retryable codes unchanged.
      - `PipelineError.ts` exports a safe diagnostic projection that preserves technical classification and code-allowlisted messages while removing raw input/output, arbitrary exception text, secrets, and logical idempotency keys.
      - `types.test.ts` contains positive and negative schema cases and checks every canonical reason code and every valid/invalid transition.
      - `pnpm vitest run tests/core/ai/types.test.ts` executes at least one test and exits 0.
    </acceptance_criteria>
    <done>Shared contracts compile, validate the canonical Phase 3a surface, and explicitly exclude Phase 8a manifest fields and persistent replay guarantees.</done>
  </task>

  <task type="auto" tdd="true">
    <name>Implement trajectory machine and operation-scoped idempotency ledger</name>
    <files>src/core/ai/AgentTrajectoryMachine.ts, src/core/ai/ExecutorService.ts, tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts, tests/core/ai/ExecutorService.test.ts</files>
    <behavior>
      - The machine starts at assembling-context, records closed entries with enteredAt, exitedAt, and durationMs, and invokes a throwing observer without failing the transition or mutating the observer's snapshot.
      - Every legal D-04 path, terminal protection, invalid transition, concurrent instance isolation, and callback failure isolation is tested.
      - A required-idempotency call marks its logical key started before execution; a completed duplicate returns the validated output and prior evidence without running the tool, with a new toolCallId; a failed-before-effect duplicate is allowed once; started or unknown state throws TOOL_IDEMPOTENCY_CONFLICT and never runs the tool again.
    </behavior>
    <read_first>
      - src/core/ai/types.ts — ALLOWED_TRANSITIONS, PipelineErrorCode, RegisteredTool, ToolExecutionResult, and idempotency status contracts from Task 1
      - src/core/ai/PipelineError.ts — constructor and technical conflict code
      - src/core/ai/AgentTrajectoryMachine.ts — include this path only if a previous partial attempt created it; otherwise create the exact export named below
      - src/core/ai/ExecutorService.ts — existing execute and executeBatch signatures and timeout/error behavior
      - tests/core/ai/ExecutorService.test.ts — existing mock-tool fixtures and test conventions
      - .planning/phases/03a-agent-reliability-evidence/03a-RESEARCH.md — FSM and idempotency patterns, with D-17 corrected for failed-before-effect versus unknown state
    </read_first>
    <action>
      Create AgentTrajectoryMachine as an operation-scoped class. `transitionTo` must consult ALLOWED_TRANSITIONS, throw PipelineError AGENT_STATE_INVALID for an illegal edge or any post-terminal transition, close the current immutable entry, open the next entry, and invoke the optional callback inside an isolated try/catch. `history` returns a readonly copy and `finalize()` closes the final entry exactly once for the current turn.

      Modify ExecutorService without changing its closed-tool validation or timeout semantics. Generate a distinct toolCallId for each logical call, require a non-empty operationId whenever a tool declares idempotency required, and propagate operationId through executeBatch. Derive a deterministic logical key from operationId, tool name, and canonical recursively sorted JSON input; never expose this key in public outcome diagnostics. Store only operation-scoped in-memory ledger data. A caught error is failed-before-effect only when its diagnostic explicitly says effectStarted is false; all other started, aborted, timeout, and unknown states are unresolved and must not be re-executed. Permit one bounded recovery attempt for failed-before-effect, then treat further failure as unresolved. Export the exact typed method `attachEvidence(toolCallId: string, evidence: CompletionEvidence): void`; it must locate the ledger entry by toolCallId and accept the evidence only when evidence.operationId and evidence.toolName exactly match the entry, otherwise throw TOOL_POSTCONDITION_FAILED without overwriting the entry. This is the later orchestrator's validated cache seam; do not persist the ledger across turns or restarts.

      Update the existing executor tests and create the trajectory test file. Use real public behavior, not private-field assertions, and include completed duplicate, failed-before-effect recovery, unknown-state suppression, distinct tool-call IDs, canonical key ordering, operation isolation, all valid/invalid transitions, terminal protection, immutable history, concurrent machine isolation, and callback failure isolation.
    </action>
    <verify>
      <automated>pnpm vitest run tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts tests/core/ai/ExecutorService.test.ts</automated>
    </verify>
    <acceptance_criteria>
      - AgentTrajectoryMachine tests cover every valid transition and every invalid transition category, including all three terminal states.
      - ExecutorService tests prove a duplicate completed call does not invoke the tool, failed-before-effect recovery is bounded, unknown final state is never replayed, distinct logical calls do not collide, and a fresh ExecutorService has no prior ledger state.
      - ExecutorService rejects a required-idempotency call with no operationId and executeBatch propagates the same rejection; no direct caller can bypass the required ledger.
      - `attachEvidence(toolCallId, evidence)` is a typed public integration seam and tests prove a completed duplicate reuses the attached evidence without exposing the logical key.
      - A spoofed operationId or toolName passed to `attachEvidence` is rejected and cannot overwrite the cached ledger evidence.
      - Existing ExecutorService tests continue to pass and abort/timeout errors remain PipelineError values.
      - No ledger persistence, cross-turn guarantee, raw idempotency key, or Phase 8a manifest property is added.
      - Both explicit test files execute nonzero test counts and exit 0.
    </acceptance_criteria>
    <done>Plan 01 exports compiling contracts and owns the complete executor/FSM primitive that later plans consume without modifying these files.</done>
  </task>
</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Untrusted input or authority | Control |
|---|---|---|
| AgentTurnInput -> contracts | Caller-supplied IDs, callback, tool metadata | Zod validation, closed unions, operation scope, no public mutable snapshots |
| Tool input -> ExecutorService | Planner-selected name and JSON input | Closed registry validation, deterministic key, toolCallId, no raw key disclosure |
| ExecutorService -> trajectory observer | Consumer callback | Callback receives a copy and cannot approve transitions; callback failures are isolated |

## STRIDE Register

| ID | Category | Threat | Control and automated test |
|---|---|---|---|
| T-03a-01 | Spoofing | Evidence or replay record is associated with another operation/tool call | Required operationId/toolCallId fields and exact-key tests in types and ExecutorService suites |
| T-03a-02 | Tampering | A caller rewrites trajectory history or bypasses the allowlist | Readonly copies, strict ALLOWED_TRANSITIONS, invalid/terminal transition tests |
| T-03a-03 | Repudiation | A turn cannot attribute a state or tool execution | operationId, toolCallId, timestamps, and immutable finalized entries are asserted in trajectory tests |
| T-03a-04 | Information disclosure | Raw output, secrets, or idempotency keys leak through evidence/diagnostics | Safe check fields and negative schema fixtures reject unrestricted fields and public keys |
| T-03a-05 | Denial of service | Duplicate execution or unbounded replay consumes tool budget | started/unknown suppression and one failed-before-effect recovery are tested |
| T-03a-06 | Elevation of privilege | Planner invents an executable tool or bypasses operation identity | Executor validates against the closed RegisteredTool list and requires operation-scoped ledger identity |
</threat_model>

<verification>
Run the contract and primitive tests after both tasks:

```bash
pnpm vitest run tests/core/ai/types.test.ts tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts tests/core/ai/ExecutorService.test.ts
pnpm lint
```

The first command must execute all three named files and the second must pass TypeScript compilation. Later plans consume the exported contracts and do not modify these files.
</verification>

<success_criteria>
1. All public Phase 3a contract schemas and exact closed unions are present.
2. All ten states and invalid/terminal transition behavior are tested.
3. Idempotency duplicate completed, failed-before-effect, and unknown-state behavior is tested and operation-scoped.
4. `pnpm lint` and all named Vitest files pass.
5. No Phase 8a fields, persistence, or cross-turn replay claim appears in the implementation.
</success_criteria>

<output>
Create `.planning/phases/03a-agent-reliability-evidence/03a-01-SUMMARY.md` with the exported contracts, test commands, and the D-17 durability boundary.
</output>
