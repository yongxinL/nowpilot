---
phase: 03a-agent-reliability-evidence
plan: 02
type: execute
wave: 2
depends_on:
  - 03a-01
files_modified:
  - src/core/ai/verifier/VerifierTypes.ts
  - src/core/ai/verifier/OutcomeVerifier.ts
  - src/core/ai/ReplanPolicy.ts
  - tests/core/ai/verifier/OutcomeVerifier.test.ts
  - tests/core/ai/ReplanPolicy.test.ts
autonomous: true
requirements:
  - AGT-02
  - AGT-04
  - TOL-03
user_setup: []
must_haves:
  truths:
    - "OutcomeVerifier returns a typed evidence record for every tool result; required side-effecting tools cannot receive implicit verified status when their verifier is missing or fails."
    - "Every evidence record maps to the exact operationId, toolCallId, and toolName, contains only bounded structured checks and safe references, and distinguishes verified, postcondition failure, timeout, verifier error, unavailable evidence, and abort."
    - "ReplanPolicy is a pure function with only continue-planning, replan, render, or terminate dispositions; it never mutates counters or PipelineError and gives permission/auth/schema failures terminal priority."
    - "A single replan is one additional recovery planner pass; verification timeout or retryable failed-before-effect may replan once, while an irreversible action, unknown effect state, denial, cancellation, or a second recovery request cannot replan."
  artifacts:
    - path: "src/core/ai/verifier/VerifierTypes.ts"
      provides: "Closed verifier descriptor, safe check callback, timeout result, and redaction-safe evidence helpers."
      exports: ["CompletionVerifierType", "VerifierCheck", "VerifierRegistry"]
    - path: "src/core/ai/verifier/OutcomeVerifier.ts"
      provides: "Dedicated verifier service under the ratified verifier directory with bounded timeout and abort normalization."
      exports: ["OutcomeVerifier", "outcomeVerifier"]
    - path: "src/core/ai/ReplanPolicy.ts"
      provides: "Stateless evaluateReplan(ReplanContext) implementation."
      exports: ["evaluateReplan"]
  key_links:
    - from: "src/core/ai/verifier/OutcomeVerifier.ts"
      to: "src/core/ai/types.ts"
      via: "verify consumes RegisteredTool.evidence and returns CompletionEvidence keyed to ToolExecutionResult.toolCallId"
    - from: "src/core/ai/ReplanPolicy.ts"
      to: "src/core/ai/types.ts"
      via: "evaluateReplan consumes the immutable ReplanContext and returns only the closed ReplanDisposition union"
    - from: "tests/core/ai/verifier/OutcomeVerifier.test.ts"
      to: "src/core/ai/verifier/OutcomeVerifier.ts"
       via: "fixtures prove exact ID association, safe output, timeout, missing verifier, failed checks, and abort behavior"
---

<objective>
Create the standalone postcondition verifier and pure deterministic replan policy that the orchestrator will consume in Wave 3. This plan deliberately does not modify AgentOrchestrator, RendererService, ExecutorService, or shared contracts owned by Plan 01.

The verifier follows D-08 through D-11 and the corrected Phase 3a scope: it uses the verifier supplied by the registered tool's evidence policy, never exposes raw verifier output, and returns unverified evidence instead of throwing. The policy follows D-12 through D-15, keeps PipelineError's technical retryability classification separate, and treats permission waiting as control flow rather than replanning.
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
@src/core/ai/types.ts
@src/core/ai/AgentTurnOutcome.ts
@src/core/ai/PipelineError.ts
@src/core/ai/ExecutorService.ts
</context>

<tasks>
  <task type="auto" tdd="true">
    <name>Implement OutcomeVerifier with safe evidence and bounded cancellation</name>
    <files>src/core/ai/verifier/VerifierTypes.ts, src/core/ai/verifier/OutcomeVerifier.ts, tests/core/ai/verifier/OutcomeVerifier.test.ts</files>
    <behavior>
      - A successful required verifier produces verified evidence with the exact operationId, toolCallId, toolName, verifier type, safe checks, result reference, timestamp, and duration.
      - A write or irreversible tool with required evidence but no verifier, a missing toolCallId, a failed check, a verifier exception, a five-second timeout, or an abort produces unverified evidence with the correct explicit reason and no raw output.
      - A non-side-effecting result may use tool-provided verified evidence only when its policy does not require a postcondition; side-effecting tools never receive implicit verification.
    </behavior>
    <read_first>
      - src/core/ai/verifier/VerifierTypes.ts — create only if absent; this file is the contract owner for verifier descriptors and safe checks
      - src/core/ai/verifier/OutcomeVerifier.ts — include this path only if a previous partial attempt created it
      - src/core/ai/types.ts — CompletionEvidence, RegisteredTool, ToolExecutionResult, ToolEvidencePolicy, and PipelineError codes from Plan 01
      - src/core/ai/AgentTurnOutcome.ts — CompletionEvidenceSchema and shared outcome contract
      - src/core/ai/ExecutorService.ts — toolCallId and evidence attachment behavior
      - .planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md — D-08, D-09, D-10, D-11, D-16
    </read_first>
    <action>
      Create VerifierTypes.ts with the closed verifier type union schema, a verifier callback contract receiving only the validated ToolExecutionResult and AbortSignal, a safe check shape, and a registry type. Do not create separate placeholder SchemaVerifier or EnvironmentVerifier files: the registered verifier descriptor is the extension point and this plan must provide concrete default schema checking for defined object-like results plus explicit unavailable evidence when a required verifier is absent.

      Create OutcomeVerifier under `src/core/ai/verifier/OutcomeVerifier.ts`. Its `verify(toolResult, tool, operationId, signal)` method always resolves to CompletionEvidence. For required evidence, validate the toolCallId and operation ID, invoke the declared verifier with a 5000 ms timeout and the shared AbortSignal, validate returned checks against the safe schema, and build either verified evidence or an explicit unverified variant. Redact or discard raw actual values, error messages, input, output, and any key-like strings before storing checks. For sideEffect write or irreversible with no required evidence policy, return unverified evidence with evidence_unavailable and a COMPLETION_EVIDENCE_MISSING diagnostic hook rather than treating transport success as completion. Normalize AbortSignal and AbortError to failureReason aborted without retry permission.

      Add focused tests with a controllable verifier callback. Cover exact tool-call mapping, every evidence variant, verifier type routing, safe output rejection, missing verifier, failed checks, callback throw, timeout using fake timers or a bounded deferred promise, abort, and side-effecting no-verifier behavior. Tests must inspect public evidence, not private registry state.
    </action>
    <verify>
      <automated>pnpm vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts</automated>
    </verify>
    <acceptance_criteria>
      - OutcomeVerifier lives at `src/core/ai/verifier/OutcomeVerifier.ts` and exports the class and singleton named in the artifacts list.
      - `verify()` never throws for verifier failure, timeout, missing verifier, or abort; it returns the appropriate discriminated evidence variant.
      - Every returned record has exact operationId/toolCallId/toolName association and no unrestricted raw output or secret-bearing diagnostic.
      - Required side-effecting tools cannot be marked verified without a declared, schema-valid checker.
      - The named test file exists, executes tests, and exits 0.
    </acceptance_criteria>
    <done>OutcomeVerifier is independently testable, bounded, abort-aware, safe-output constrained, and ready for orchestrator integration.</done>
  </task>

  <task type="auto" tdd="true">
    <name>Implement pure ReplanPolicy and exhaustive disposition tests</name>
    <files>src/core/ai/ReplanPolicy.ts, tests/core/ai/ReplanPolicy.test.ts</files>
    <behavior>
      - Abort and caller/user cancellation terminate before every other rule; permission denial, auth, schema, unknown-tool, invalid-input, and unresolved idempotency state terminate without bypass.
      - An irreversible tool that has started or may have taken effect terminates on failure or unverified evidence; no retry or replan is permitted.
      - A successful tool reaches verification and then normal continuation/rendering without incrementing replanCount; a retryable execution failure or retryable evidence failure replans only when replanCount is zero and the effect is known not to have started.
      - A second recovery request, planner/tool cap, failed verification without retry permission, or terminal technical failure returns render or terminate according to the explicit context, never an ambiguous disposition.
    </behavior>
    <read_first>
      - src/core/ai/ReplanPolicy.ts — include this path only if a previous partial attempt created it
      - src/core/ai/types.ts — ReplanContext, ReplanDisposition, effect status, CompletionEvidence, and PipelineError contracts from Plan 01
      - src/core/ai/PipelineError.ts — retryable/terminal categories remain authoritative and are not changed here
      - .planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md — D-12 through D-15
      - .planning/phases/03a-agent-reliability-evidence/03a-RESEARCH.md — policy priority guidance; do not copy its stale reason codes or implicit retry behavior
    </read_first>
    <action>
      Create `evaluateReplan(context: ReplanContext): ReplanDisposition` as a pure synchronous function with no service imports, mutations, timers, or hidden counters. Evaluate in this order: aborted/cancelled; permission or terminal technical failure; irreversible started/unknown/completed effect; second replan; planner/tool cap; verified success or ordinary continuation; retryable failed-before-effect or retryable verifiable failure; otherwise render partial. Keep `continue-planning`, `replan`, `render`, and `terminate` as the only outputs. A permission grant is not passed to this function because it resumes the same validated decision in the orchestrator.

      Define tests through a factory that builds a complete ReplanContext. Cover every output, all canonical permission/auth/schema/idempotency cases, verification timeout/failure, irreversible action, failed-before-effect versus unknown effect, one-replan cap, planner and tool caps, abort priority, and purity by deep-freezing the input and calling the function twice. Do not assert implementation helper names.
    </action>
    <verify>
      <automated>pnpm vitest run tests/core/ai/ReplanPolicy.test.ts</automated>
    </verify>
    <acceptance_criteria>
      - ReplanPolicy imports only type contracts and returns no value outside the four-item disposition union.
      - Tests prove no counter/context mutation, one additional replan maximum, no permission bypass, and no replay after irreversible/unknown effect.
      - The named test file exists, executes tests, and exits 0.
    </acceptance_criteria>
    <done>Pure ReplanPolicy deterministically governs continuation, one recovery pass, rendering, and termination without changing PipelineError or permission state.</done>
  </task>
</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Untrusted input or authority | Control |
|---|---|---|
| Tool result -> OutcomeVerifier | Tool output and verifier callback output | Safe schema, bounded checks, exact IDs, timeout, abort normalization |
| Evidence -> ReplanPolicy | Verified/unverified status and technical error classification | Pure function, closed dispositions, irreversible and permission precedence |
| Verifier -> future renderer | Evidence may be mistaken for permission or success | Required side-effect verifier, no implicit write verification, tests for missing evidence |

## STRIDE Register

| ID | Category | Threat | Control and automated test |
|---|---|---|---|
| T-03a-07 | Spoofing | Evidence is attached to a different tool call | Exact operation/toolCall/toolName fixtures and discriminated schema validation |
| T-03a-08 | Tampering | Verifier returns arbitrary raw output or changes policy | Safe check schema rejects unrestricted values; policy is not mutable |
| T-03a-09 | Repudiation | Verification or permission-related failure cannot be reconstructed | Evidence ID, operation/tool-call IDs, timestamps, duration, and explicit failure reason are tested |
| T-03a-10 | Information disclosure | Verifier output exposes secrets or full tool responses | Redaction-safe fields and negative fixtures for raw output/key-like strings |
| T-03a-11 | Denial of service | Slow verifier or repeated recovery loops consume the turn | Five-second verifier timeout, shared abort, and one-replan tests |
| T-03a-12 | Elevation of privilege | Unverified success or denied permission is upgraded into a retry | Missing-verifier failure, permission terminal priority, and irreversible termination tests |
</threat_model>

<verification>
```bash
pnpm vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts tests/core/ai/ReplanPolicy.test.ts
pnpm lint
```

The first command must execute both named suites. The type check must pass before Plan 03 consumes these exports.
</verification>

<success_criteria>
1. Required side-effecting outcomes are evidence-gated and safe to inspect.
2. OutcomeVerifier handles valid, invalid, missing, timed-out, failed, and aborted verification deterministically.
3. ReplanPolicy covers all four dispositions, one-replan cap, permission behavior, and irreversible/unknown-state replay protection.
4. Both test suites and `pnpm lint` pass without modifying Plan 01 files.
</success_criteria>

<output>
Create `.planning/phases/03a-agent-reliability-evidence/03a-02-SUMMARY.md` with verifier/replan contracts and the explicit no-persistence boundary.
</output>
