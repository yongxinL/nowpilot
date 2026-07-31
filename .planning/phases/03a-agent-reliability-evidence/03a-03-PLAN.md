---
phase: 03a-agent-reliability-evidence
plan: 03
type: execute
wave: 3
depends_on:
  - 03a-02
files_modified:
  - src/core/ai/RenderingOutcomePolicy.ts
  - src/core/ai/AgentOrchestrator.ts
  - src/core/ai/PlannerService.ts
  - src/core/ai/RendererService.ts
  - src/core/ai/ProviderRouter.ts
  - src/core/context/ContextOptimizer.ts
  - tests/core/ai/AgentOrchestrator.test.ts
  - tests/core/ai/integration.test.ts
  - tests/core/ai/tracer.test.ts
  - tests/core/context/ContextOptimizer.test.ts
autonomous: true
requirements:
  - AGT-01
  - AGT-02
  - AGT-03
  - AGT-04
  - TOL-03
user_setup: []
must_haves:
  truths:
    - "AgentOrchestrator.runTurn() returns an AgentTurnOutcome on answer, clarification, tool success, tool failure, permission denial, cap exhaustion, renderer failure, state failure, and abort paths; no path returns a bare string or throws a normal pipeline error."
    - "ContextOptimizer.optimize() runs exactly once per turn, the same AbortSignal reaches optimizer/provider/planner/permission/executor/verifier/renderer stages, and abort at every await boundary returns aborted with no normal render, retry, or replan."
    - "A permission-required tool enters waiting-for-permission before execution; grant resumes the same validated decision without a planner call, denial terminates, and cancellation becomes user_aborted or caller_aborted without bypass through replan."
    - "After execution, required side effects enter verifying before any render; the orchestrator builds RenderingOutcomePolicy, blocks completion wording for unverified/failed evidence, detects contradictory generated text, records RENDERER_EVIDENCE_CONTRADICTION, and uses the policy's deterministic fallback."
    - "Recovery makes exactly one additional PlannerService call with a structured redacted observation, does not rerun ContextOptimizer, reset counters, renew the deadline, or replay an irreversible/unknown operation."
    - "Every current runTurn caller and test consumes AgentTurnOutcome or the deprecated runTurnText wrapper, and every current generated RegisteredTool explicitly receives sideEffect, idempotency, and evidence metadata through the existing selected-tool adapter."
  artifacts:
    - path: "src/core/ai/AgentOrchestrator.ts"
      provides: "Only owner of operation-scoped trajectory, terminal outcome assembly, permission sequencing, verifier/replan wiring, abort finalization, and renderer contradiction fallback."
      exports: ["AgentOrchestrator", "agentOrchestrator"]
    - path: "src/core/ai/RenderingOutcomePolicy.ts"
      provides: "Pure evidence-to-policy derivation and deterministic contradiction/fallback enforcement."
      exports: ["buildRenderingOutcomePolicy", "enforceRenderingOutcomePolicy"]
    - path: "src/core/ai/PlannerService.ts"
      provides: "Optional redacted recovery observation input without changing the planner decision union or raw prompt boundary."
      exports: ["PlannerService", "plannerService", "PlannerDecisionSchema"]
    - path: "src/core/ai/RendererService.ts"
      provides: "Required RenderingOutcomePolicy input for synthesize and stream; renderer cannot create or upgrade evidence."
      exports: ["RendererService", "rendererService"]
  key_links:
    - from: "src/core/ai/AgentOrchestrator.ts"
      to: "src/core/ai/AgentTrajectoryMachine.ts"
      via: "Fresh machine per runTurn and every transition routed through the strict allowlist"
    - from: "src/core/ai/AgentOrchestrator.ts"
      to: "src/core/ai/verifier/OutcomeVerifier.ts"
      via: "Successful side-effect execution transitions to verifying and awaits the shared-signal verifier before continuation/render"
    - from: "src/core/ai/AgentOrchestrator.ts"
      to: "src/core/ai/ReplanPolicy.ts"
      via: "Execution and verification checkpoints pass immutable redacted ReplanContext and obey one recovery pass"
    - from: "src/core/ai/AgentOrchestrator.ts"
      to: "src/core/ai/RenderingOutcomePolicy.ts"
      via: "Policy is built before synthesize/stream and generated output is enforced before entering AgentTurnOutcome"
    - from: "src/core/ai/PlannerService.ts"
      to: "src/core/ai/AgentOrchestrator.ts"
       via: "Recovery planner call receives only tool name, bounded status, safe error code, and evidence summary; ContextOptimizer output is reused"
---

<objective>
Integrate the complete bounded reliability harness in one owner-controlled production slice and migrate every existing caller/test of the old string API. This is the only plan allowed to modify AgentOrchestrator, PlannerService, RendererService, or their integration tests.

Implement D-01 through D-07 and D-10 through D-17 as a coherent runTurn state machine. Preserve the existing Planner -> Executor -> Renderer and ContextOptimizer-once architecture, add the operation-scoped permission callback because the repository has no PermissionGate implementation despite the specification referring to one, and never invent a Phase 8a manifest or persistence layer.
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
@.planning/phases/03a-agent-reliability-evidence/03a-01-SUMMARY.md
@.planning/phases/03a-agent-reliability-evidence/03a-02-SUMMARY.md
@src/core/ai/types.ts
@src/core/ai/AgentTurnInput.ts
@src/core/ai/AgentOrchestrator.ts
@src/core/ai/PlannerService.ts
@src/core/ai/RendererService.ts
@src/core/ai/ExecutorService.ts
@src/core/ai/PipelineError.ts
@src/core/ai/ProviderRouter.ts
@src/core/context/ContextOptimizer.ts
@tests/core/ai/AgentOrchestrator.test.ts
@tests/core/ai/integration.test.ts
@tests/core/ai/tracer.test.ts
@tests/core/context/ContextOptimizer.test.ts
</context>

<tasks>
  <task type="auto" tdd="true">
    <name>Implement evidence-constrained rendering policy and renderer contract</name>
    <files>src/core/ai/RenderingOutcomePolicy.ts, src/core/ai/RendererService.ts, src/core/ai/ProviderRouter.ts, src/core/context/ContextOptimizer.ts</files>
    <behavior>
      - Verified write evidence permits completion wording only for the matching toolCallId; submitted-but-unverified evidence permits submission-only wording with a caveat; failed verification permits no completion claim; aborted turns do not call the normal renderer.
      - A generated answer that contains a completion claim forbidden by the policy is replaced by the deterministic policy fallback and exposes a technical contradiction record for the orchestrator; the renderer never upgrades evidence or outcome state.
      - RendererService.synthesize() and stream() require the typed policy and shared AbortSignal and include only its bounded evidence instruction in the generated prompt.
    </behavior>
    <read_first>
      - src/core/ai/RenderingOutcomePolicy.ts — create only if absent
      - src/core/ai/RendererService.ts — existing synthesize and stream signatures, buildSystemPrompt, abort/error behavior
      - src/core/ai/ProviderRouter.ts — current selectProvider(preferred) signature and awaited key/adapter selection
      - src/core/context/ContextOptimizer.ts — current optimize input validation and the single compression await
      - src/core/ai/types.ts — RenderingOutcomePolicy, CompletionEvidence, AgentTerminalState from Plan 01
      - src/core/ai/AgentTurnOutcome.ts — canonical reason and outcome contract
      - .planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md — D-09 and D-11
      - tests/core/ai/tracer.test.ts — existing renderer test/mocking style
    </read_first>
    <action>
      Create a pure RenderingOutcomePolicy derivation that matches evidence by exact toolCallId and operationId. It must expose whether verified write completion is allowed, whether only submission wording is allowed, the safe verified/unverified references, a deterministic fallback answer for each blocked terminal condition, and a bounded prompt summary. Do not include raw evidence checks, tool outputs, secrets, or model-generated text in the policy.

      Add `enforceRenderingOutcomePolicy(generatedText, policy)` as a deterministic pure post-render check. Detect only the explicit completion-claim patterns defined in the test fixtures; if a forbidden claim appears, return the policy fallback and a `RENDERER_EVIDENCE_CONTRADICTION` signal for AgentOrchestrator diagnostics. Do not attempt to repair the model text or infer new evidence.

      Change RendererService.synthesize and stream to accept final policy and AbortSignal parameters, initially handling an omitted policy defensively only to keep the pre-integration orchestrator runtime testable during this task. Append policy.evidenceSummary when present and retain provider, persona, stream, and PipelineError behavior. Task 2 supplies the required policy and signal at every call. RendererService must not inspect CompletionEvidence or make terminal-state decisions.

      Update ProviderRouter.selectProvider(preferred, signal?) to check the shared signal before and after awaited API-key and adapter construction work. Update ContextOptimizer.optimize's existing input path to accept abortSignal, check it before and after compression, and pass it to ContextCompressor.compress; Plan 04 owns the nested compressor implementation. These are signal-boundary changes only and do not alter provider order or optimization policy.
    </action>
    <verify>
      <automated>pnpm vitest run tests/core/ai/tracer.test.ts</automated>
    </verify>
    <acceptance_criteria>
      - Policy tests in the existing tracer suite prove verified, unverified, failed, mixed, empty, and aborted cases and exact tool-call matching.
      - Renderer signatures expose the final policy and AbortSignal parameters and preserve the current callers until Task 2 supplies them at every call site.
      - ProviderRouter and ContextOptimizer expose the shared signal boundary without changing provider order or once-per-turn optimization.
      - Contradiction handling returns a deterministic fallback and a technical signal without mutating evidence or outcome.
      - The named test file executes tests and exits 0.
    </acceptance_criteria>
    <done>Rendering policy and renderer contract are complete and ready for the orchestrator owner to enforce.</done>
  </task>

  <task type="auto" tdd="true">
    <name>Integrate AgentOrchestrator outcomes, trajectory, permission, abort, evidence, and replanning</name>
    <files>src/core/ai/AgentOrchestrator.ts, src/core/ai/PlannerService.ts, tests/core/ai/AgentOrchestrator.test.ts</files>
    <behavior>
      - Answer, clarification, successful read, verified write, unverified write, failed tool, permission denial, permission cancellation, planner failure, renderer failure, cap exhaustion, invalid transition, and user/caller abort each return a terminal AgentTurnOutcome with the canonical reason code and complete finalized trajectory.
      - Every await stage checks the same AbortSignal before and after; abort finalization is idempotent, skips verification/retry/replan/normal rendering, and distinguishes user_aborted from caller_aborted when the callback supplies origin.
      - Grant resumes the exact validated tool decision, denial never invokes the executor, and replan cannot turn denial/cancellation into execution.
      - Successful side-effect execution verifies before rendering; one retry-safe recovery planner call reuses the optimized context and does not reset planner/tool/replan counters or deadline.
    </behavior>
    <read_first>
      - src/core/ai/AgentOrchestrator.ts — current runTurn implementation, buildRegisteredTools, cache preparation, and all existing exit paths
      - src/core/ai/PlannerService.ts — current three-argument plan signature and prompt construction
      - src/core/ai/RendererService.ts — required policy signature from Task 1
      - src/core/ai/ExecutorService.ts — toolCallId, ledger, evidence attachment, and operationId signature from Plan 01
      - src/core/ai/AgentTurnInput.ts — factory and permission callback type
      - src/core/ai/types.ts — outcome, trajectory, permission, evidence, replan, cap, and tool metadata contracts
      - src/core/ai/verifier/OutcomeVerifier.ts — verifier result and abort behavior from Plan 02
      - src/core/ai/ReplanPolicy.ts — pure disposition priority from Plan 02
      - src/core/ai/RenderingOutcomePolicy.ts — policy derivation/enforcement from Task 1
      - .planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md — D-01 through D-07 and D-10 through D-17
    </read_first>
    <action>
      Refactor runTurn to create a fresh AgentTrajectoryMachine and immutable per-turn accumulators at entry. Keep ContextOptimizer.optimize exactly once before planner calls. Pass input.abortSignal through the signal-aware optimizer/provider/renderer boundaries established by Task 1, pass it to PlannerService.plan(adapter, tier, optimized, signal, recoveryObservation), and check it before and after permission callback, executor, verifier, recovery planner, and renderer awaits. Normalize AbortError and signal state through one idempotent finalizer that transitions to aborted, sets renderedAnswer null, records origin/stage/timestamp, and never performs normal render, replan, or retry.

      Transition through assembling-context, planning, waiting-for-permission, executing, verifying, replanning, rendering, and a terminal state using only the allowlist. Build AgentTurnOutcome for every return path with operationId, terminalState, canonical reasonCode, rendered answer, readonly trajectory/evidence/tool results, cap counters and flags, abort metadata, zero/available usage, diagnostics, and timestamps. Catch invalid state transitions as failed invalid_state_transition with AGENT_STATE_INVALID diagnostics.

      Use the existing selected-tool adapter as the closed registry boundary. Read the three reliability fields from ToolSchemaInfo, reject a missing field with SCHEMA_INVALID rather than silently defaulting, and construct RegisteredTool with explicit sideEffect, idempotency, and evidence values. Do not add category, risk, permissions, dataScopes, timeout, costClass, schema hashes, or discovery. For write/irreversible tools, invoke the operation-scoped permission callback before executor start. Grant resumes the same decision; denial returns permission_denied; cancellation finalizes caller/user abort. Tool call count increments only immediately before actual executor start.

      After execution, invoke OutcomeVerifier for required side effects, call the typed ExecutorService.attachEvidence(toolCallId, evidence) seam, evaluate ReplanPolicy at execution-failure and verification-complete checkpoints, and obey its disposition. A replan increments once and calls PlannerService exactly once with a bounded redacted observation containing only tool name, execution/evidence status, safe error code, and safe evidence summary. Do not pass raw output, PipelineError diagnostics, secrets, or idempotency keys. Before storing any PipelineError in AgentTurnOutcome, pass it through the Plan 01 safe diagnostic projection. Build RenderingOutcomePolicy before every render, enforce generated output, append the bounded warning RENDERER_EVIDENCE_CONTRADICTION to diagnostics when needed, and classify completed/partial/failed according to evidence and caps. Add the deprecated runTurnText wrapper over runTurn without adding getLastOutcome.

      Do not alter PipelineError retryability semantics, ContextOptimizer behavior, provider selection, tier caps, or add a persistent ledger.

      Update the existing AgentOrchestrator.test.ts in this same task with focused public-behavior tests for answer/clarification, failed/planner/renderer paths, planner/tool caps, abort at stage boundaries, permission grant/deny/cancel, verified/unverified evidence, one recovery pass, irreversible/unknown suppression, and runTurnText compatibility. These tests are the task's RED/GREEN behavioral gate; the broader integration suite remains owned by Task 3.
    </action>
    <verify>
      <automated>pnpm vitest run tests/core/ai/AgentOrchestrator.test.ts && pnpm lint</automated>
    </verify>
    <acceptance_criteria>
      - AgentOrchestrator.test.ts exercises the structured outcome contract, cap/abort/permission/evidence/replan paths, and the typed ExecutorService.attachEvidence seam.
      - PlannerService accepts the shared AbortSignal plus only the optional structured redacted recovery observation and never receives raw tool output or PipelineError diagnostics.
      - RendererService requires both RenderingOutcomePolicy and the shared AbortSignal at synthesize and stream call sites.
      - `pnpm vitest run tests/core/ai/AgentOrchestrator.test.ts` and `pnpm lint` both exit 0.
    </acceptance_criteria>
    <done>AgentOrchestrator is the sole owner of the complete bounded reliability control flow and returns AgentTurnOutcome for every exit.</done>
  </task>

  <task type="auto">
    <name>Migrate legacy callers and existing context/tracer assertions</name>
    <files>tests/core/ai/integration.test.ts, tests/core/ai/tracer.test.ts, tests/core/context/ContextOptimizer.test.ts</files>
    <read_first>
      - tests/core/ai/integration.test.ts — existing pipeline integration assertions and selected-tool fixtures
      - tests/core/ai/tracer.test.ts — existing response string assertions and throw expectations
      - tests/core/context/ContextOptimizer.test.ts — existing runTurn consumer at the integration assertion
      - src/core/ai/AgentOrchestrator.ts — runTurn and deprecated runTurnText exports
      - src/core/ai/AgentTurnInput.ts — factory used by migrated tests
      - src/core/ai/AgentTurnOutcome.ts — renderedAnswer and terminalState fields
      - .planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md — D-01 compatibility rule
    </read_first>
    <action>
      Search every source and test caller of AgentOrchestrator.runTurn. New callers must assert AgentTurnOutcome fields. A legacy text-only caller may call runTurnText and must be marked as compatibility usage; do not add a second outcome accessor. Update integration, tracer, and ContextOptimizer integration assertions to inspect renderedAnswer, terminalState, diagnostics, trajectory, and cap/abort fields rather than treating the result as a string or expecting a bare thrown PipelineError. The AgentOrchestrator.test.ts migration and focused behavior coverage belongs to Task 2, its sole owner.

      Add a regression assertion that runTurnText returns the same renderedAnswer as runTurn for a deterministic answer path and that no source caller outside the wrapper assumes the old return type. Keep all ContextOptimizer tests unrelated to orchestration behavior unchanged except for the required outcome assertion and explicit tool reliability metadata in their selected-tool fixtures.
    </action>
    <verify>
      <automated>pnpm vitest run tests/core/ai/AgentOrchestrator.test.ts tests/core/ai/integration.test.ts tests/core/ai/tracer.test.ts tests/core/context/ContextOptimizer.test.ts</automated>
    </verify>
    <acceptance_criteria>
      - A repository search finds no old string-return assertion for runTurn and no caller that destructures a string result.
      - Integration, tracer, and ContextOptimizer suites pass with the structured outcome contract.
      - Integration.test.ts and ContextOptimizer.test.ts explicitly declare the three Phase 3a reliability values at the selected-tool boundary.
      - The compatibility wrapper is the only text-returning API and is visibly deprecated in source documentation.
      - All three named test files execute tests and exit 0.
    </acceptance_criteria>
    <done>All existing callers are migrated or explicitly isolated behind runTurnText, with no legacy API ambiguity.</done>
  </task>
</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Untrusted input or authority | Control |
|---|---|---|
| Planner -> orchestrator | Model-selected action/tool/input | Closed registry, schema validation, immutable operation state, permission before execution |
| Permission callback -> executor | User/caller decision and cancellation | Waiting state, attributable decision, no execution on denial/cancel, no replan bypass |
| Executor/verifier -> renderer | Tool result, evidence, generated text | Exact evidence mapping, policy input, post-generation contradiction fallback |
| Concurrent runTurn calls | Shared singleton service instances | Fresh machine and accumulators per operation, no getLastOutcome or shared mutable snapshot |

## STRIDE Register

| ID | Category | Threat | Control and automated test |
|---|---|---|---|
| T-03a-13 | Spoofing | A result/evidence record is attributed to another call or operation | Exact IDs, closed selected-tool adapter, integration mapping tests |
| T-03a-14 | Tampering | Renderer or callback changes outcome/evidence or invalid state silently continues | Policy is derived by orchestrator, callback isolation, invalid transition tests, readonly outcome assertions |
| T-03a-15 | Repudiation | Permission, abort, state, and terminal reason cannot be audited | operation/tool-call IDs, timestamps, callback origin, trajectory, redacted diagnostics, exit-path tests |
| T-03a-16 | Information disclosure | Recovery prompt or render prompt receives raw tool/error data | Redacted observation tests, bounded policy summary, no raw output assertions |
| T-03a-17 | Denial of service | Abort/replan/cap loops continue indefinitely | Shared signal checks, one replan, unchanged deadline/counters, cap flag tests |
| T-03a-18 | Elevation of privilege | Denial is bypassed, unverified write is upgraded, or irreversible action is replayed | Permission tests, contradiction fallback tests, irreversible/unknown idempotency integration tests |
</threat_model>

<verification>
```bash
pnpm vitest run tests/core/ai/AgentOrchestrator.test.ts tests/core/ai/integration.test.ts tests/core/ai/tracer.test.ts tests/core/context/ContextOptimizer.test.ts
pnpm lint
```

 The first command must run all integration and migrated caller suites. The phase gate in Plan 05 consumes these exact files plus the Plan 01/02 unit suites, nested compression suite, and security suite.
</verification>

<success_criteria>
1. All AgentOrchestrator exits return immutable AgentTurnOutcome with canonical reasons and finalized trajectory.
2. ContextOptimizer runs once; abort, permission, evidence, cap, replan, idempotency, and renderer policies are enforced on every path.
3. Renderer cannot upgrade evidence and contradiction fallback is deterministic.
4. All current callers/tests are migrated and explicit reliability metadata is present at the selected-tool adapter boundary.
5. All named tests and `pnpm lint` pass.
</success_criteria>

<output>
Create `.planning/phases/03a-agent-reliability-evidence/03a-03-SUMMARY.md` with the outcome API, exit-path matrix, caller migration list, and downstream consumption notes.
</output>
