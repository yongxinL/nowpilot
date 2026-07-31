---
phase: 03a-agent-reliability-evidence
plan: 02
type: execute
wave: 2
depends_on:
  - 03a-01
files_modified:
  - src/core/ai/OutcomeVerifier.ts
  - src/core/ai/verifier/VerifierTypes.ts
  - src/core/ai/verifier/SchemaVerifier.ts
  - src/core/ai/verifier/EnvironmentVerifier.ts
  - src/core/ai/ReplanPolicy.ts
  - src/core/ai/AgentOrchestrator.ts
autonomous: false
requirements:
  - AGT-02
  - AGT-04
  - TOL-03

must_haves:
  truths:
    - "TRUTH-07: OutcomeVerifier.verify() for a tool with sideEffect: 'write' and evidence.required=true returns VerifiedCompletionEvidence (verified:true) when postconditions pass — per D-09/D-10"
    - "TRUTH-08: OutcomeVerifier.verify() for a tool with evidence.required=true but failing postconditions returns UnverifiedCompletionEvidence (verified:false, retryable=false) — evidence shapes are discriminated on 'verified'"
    - "TRUTH-09: ReplanPolicy.evaluateReplan() returns 'terminate' when lastTool.sideEffect === 'irreversible' — per D-13, irreversibility blocks all replanning"
    - "TRUTH-10: ReplanPolicy.evaluateReplan() returns 'replan' for a retryable error on first failure (replanCount === 0), then 'render' on second failure (replanCount > 0) — per D-14/D-15, one replan max"
    - "TRUTH-11: AgentOrchestrator.runTurn() calls OutcomeVerifier.verify() after executing a tool with evidence.required=true, then calls ReplanPolicy.evaluateReplan() — the evidence-aware loop is wired (per D-10/D-12)"
  artifacts:
    - src/core/ai/OutcomeVerifier.ts
    - src/core/ai/verifier/VerifierTypes.ts
    - src/core/ai/verifier/SchemaVerifier.ts
    - src/core/ai/verifier/EnvironmentVerifier.ts
    - src/core/ai/ReplanPolicy.ts
  key_links:
    - "AgentOrchestrator.runTurn() → OutcomeVerifier.verify() — called after ExecutorService.execute() for tools with evidence.required=true"
    - "OutcomeVerifier.verify() → ReplanPolicy.evaluateReplan() — verification result feeds the replan decision"
    - "ReplanPolicy.evaluateReplan() → AgentOrchestrator control flow — disposition determines next state (continue/replan/render/terminate)"

# Artifacts this phase produces (Plan 02)

| Symbol | Kind | File |
|--------|------|------|
| `VerifierType` | type ('schema'\|'environment'\|'read-after-write'\|'tool-provided') | src/core/ai/verifier/VerifierTypes.ts |
| `VerifierFn` | type | src/core/ai/verifier/VerifierTypes.ts |
| `VerifierRegistry` | interface | src/core/ai/verifier/VerifierTypes.ts |
| `schemaVerifier` | VerifierFn | src/core/ai/verifier/SchemaVerifier.ts |
| `environmentVerifier` | VerifierFn | src/core/ai/verifier/EnvironmentVerifier.ts |
| `OutcomeVerifier` | class | src/core/ai/OutcomeVerifier.ts |
| `outcomeVerifier` | singleton | src/core/ai/OutcomeVerifier.ts |
| `OutcomeVerifier.verify()` | method → `Promise<CompletionEvidence>` | src/core/ai/OutcomeVerifier.ts |
| `evaluateReplan()` | pure function → `ReplanDisposition` | src/core/ai/ReplanPolicy.ts |
| `AgentOrchestrator.runTurn()` (evidence + replan integration) | modified method | src/core/ai/AgentOrchestrator.ts |
---

<objective>
Integrate evidence-backed completion and deterministic replanning into the AgentOrchestrator. After this plan, every side-effecting tool execution passes through OutcomeVerifier.verify() before the orchestrator decides the next step, and ReplanPolicy deterministically governs retry/render/terminate decisions. The orchestrator now accumulates CompletionEvidence[] and builds RenderingOutcomePolicy from verified evidence before rendering.

Purpose: Move from "fire and hope" tool execution to verified completion — the agent cannot claim a write succeeded without evidence.
Output: OutcomeVerifier service, verifier strategy modules, ReplanPolicy pure function, evidence-aware orchestrator loop, and unit tests.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md
@.planning/phases/03a-agent-reliability-evidence/03a-RESEARCH.md
@src/core/ai/types.ts
@src/core/ai/AgentTurnOutcome.ts
@src/core/ai/RenderingOutcomePolicy.ts
@src/core/ai/AgentOrchestrator.ts
@src/core/ai/PipelineError.ts
@src/core/ai/ExecutorService.ts
</context>

<tasks>

<task type="auto">
  <name>Create OutcomeVerifier service with verifier types</name>
  <files>src/core/ai/OutcomeVerifier.ts, src/core/ai/verifier/VerifierTypes.ts, src/core/ai/verifier/SchemaVerifier.ts, src/core/ai/verifier/EnvironmentVerifier.ts</files>
  <read_first>
    - src/core/ai/types.ts — `RegisteredTool` (with `sideEffect`, `evidence`, `idempotency`), `ToolExecutionResult` (with `toolCallId`, `evidence`), `CompletionEvidence`, `CompletionEvidenceCheck`, `ToolEvidencePolicy`
    - src/core/ai/AgentTurnOutcome.ts — `createAgentTurnOutcome`, `AgentTurnOutcome`
    - RESEARCH.md Pattern 2 (CompletionEvidence discriminated union) and the "OutcomeVerifier" section for verifier routing logic
    - CONTEXT.md D-08, D-09, D-10 — exact contracts for evidence fields, OutcomeVerifier, and discriminated union
  </read_first>
  <action>
    <!-- scope note: 4 files below are logically one module — VerifierTypes.ts defines the contract consumed by SchemaVerifier, EnvironmentVerifier, and OutcomeVerifier; splitting the type definition from its consumers would require cross-task context coordination without benefit -->
    **1. Create `src/core/ai/verifier/VerifierTypes.ts`** — new file in new directory:
    - `VerifierType` type = `'schema' | 'environment' | 'read-after-write' | 'tool-provided'` (from D-09)
    - `VerifierFn` type = `(result: ToolExecutionResult, expectedSchema?: Record<string, unknown>) => Promise<CompletionEvidenceCheck[]>`
    - `VerifierRegistry` interface = `{ schema: VerifierFn; environment: VerifierFn; 'read-after-write': VerifierFn; 'tool-provided': VerifierFn }`

    **2. Create `src/core/ai/verifier/SchemaVerifier.ts`** — schema-based postcondition verifier:
    - Export `schemaVerifier: VerifierFn` — takes `ToolExecutionResult` and optional expected schema. Validates `result.output` against the expected shape using `z.object()` or structural check. Returns `CompletionEvidenceCheck[]` with name, passed, actual, expected, message per check.
    - Default implementation: checks that `result.output` is not null/undefined and is an object (not a primitive). One check: `{ name: 'output-is-defined', passed: result.output !== null && result.output !== undefined, actual: typeof result.output, expected: 'object' }`.

    **3. Create `src/core/ai/verifier/EnvironmentVerifier.ts`** — environment state verifier:
    - Export `environmentVerifier: VerifierFn` — placeholder verifier that checks basic properties of the execution context. Returns an empty check array (verification not applicable by default). Stub for future DOM/chrome API checks.
    - One check: `{ name: 'environment-check-skipped', passed: true, message: 'Environment verification not configured for this tool.' }`.

    **4. Create `src/core/ai/OutcomeVerifier.ts`** — main verifier service:
    - Module-level singleton pattern (follow existing `PlannerService`, `RendererService` pattern — `export const outcomeVerifier = new OutcomeVerifier()`)
    - `OutcomeVerifier` class with a single public method:
      ```
      async verify(
        toolResult: ToolExecutionResult,
        tool: RegisteredTool,
        operationId: string,
        signal?: AbortSignal,
      ): Promise<CompletionEvidence>
      ```
    - **Entry logic (per D-10):**
      - If `tool.evidence` is undefined or `tool.evidence.required === false` → return `VerifiedCompletionEvidence` with `verifierType: 'tool-provided'`, empty checks, `verified: true` (tools without evidence requirements are implicitly trusted)
      - If `tool.evidence.required === true` → proceed with verification
    - **Verification logic:**
      - Generate unique `id` via `crypto.randomUUID()`
      - Select verifier function from registry based on `tool.evidence.verifier ?? 'schema'` (default to schema verifier)
      - Execute verifier with timeout of 5000ms (VERIFICATION_TIMEOUT_MS constant)
      - On success → return `VerifiedCompletionEvidence` with `verified: true`, verifierType from policy, checks from verifier, resultRef = `\`tool-result:${toolResult.toolCallId ?? toolResult.toolName}\``
      - On timeout → return `UnverifiedCompletionEvidence` with `verified: false`, `failureReason: 'verification_timeout'`, `retryable: true`
      - On error → return `UnverifiedCompletionEvidence` with `verified: false`, `failureReason: 'verification_error'`, `retryable: false`
    - **Abort support:** if `signal?.aborted` during verification, return `UnverifiedCompletionEvidence` with `verified: false`, `failureReason: 'aborted'`, `retryable: false`
    - **Shared fields on all evidence:** `id`, `operationId`, `toolCallId` (from result.toolCallId ?? ''), `toolName`, `verifiedAt: Date.now()`, `durationMs` (measured from verify start)

    IMPORTANT: The verifier does NOT throw — it always returns a `CompletionEvidence` object (either verified or unverified). The orchestrator is responsible for acting on the evidence.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `src/core/ai/OutcomeVerifier.ts` exports `OutcomeVerifier` class with `verify()` method and module-level singleton `outcomeVerifier`
    - `src/core/ai/verifier/VerifierTypes.ts` exports `VerifierType`, `VerifierFn`, `VerifierRegistry`
    - `src/core/ai/verifier/SchemaVerifier.ts` exports `schemaVerifier`
    - `src/core/ai/verifier/EnvironmentVerifier.ts` exports `environmentVerifier`
    - `outcomeVerifier.verify(result, tool, opId)` returns `CompletionEvidence` — never throws
    - Tool with `evidence.required: false` returns `VerifiedCompletionEvidence` with empty checks and `verifierType: 'tool-provided'`
    - Tool with `evidence.required: true` and valid output returns `VerifiedCompletionEvidence` with `verified: true`
    - Tool with no evidence policy returns `VerifiedCompletionEvidence` (implicit trust for non-evidence tools)
    - Verification timeout (5s) returns `UnverifiedCompletionEvidence` with `failureReason: 'verification_timeout'` and `retryable: true`
    - AbortSignal.aborted during verification returns `UnverifiedCompletionEvidence` with `failureReason: 'aborted'`
    - `tsc --noEmit` passes for all new files
  </acceptance_criteria>
  <done>OutcomeVerifier service created with 4 verifier types; verify() always returns CompletionEvidence (never throws); verifier routing and timeout handling work; module-level singleton exported</done>
  <reversibility rating="costly">D-10 — moving verification logic out of the orchestrator later would require refactoring both the call site and test isolation boundary; the service boundary is cheap to extend but expensive to relocate</reversibility>
</task>

<task type="auto">
  <name>Create ReplanPolicy pure function</name>
  <files>src/core/ai/ReplanPolicy.ts</files>
  <read_first>
    - src/core/ai/types.ts — `ReplanDisposition`, `ReplanContext`, `ToolSideEffect` types
    - src/core/ai/AgentTurnOutcome.ts — `CompletionEvidence`, `VerifiedCompletionEvidence`, `UnverifiedCompletionEvidence`
    - src/core/ai/PipelineError.ts — `PipelineError` class with `.retryable`, `.category`, `.code` properties
    - RESEARCH.md Pattern 5 — full implementation code for `evaluateReplan()` function
    - CONTEXT.md D-12, D-13, D-14, D-15 — exact contracts for replan policy behavior
  </read_first>
  <action>
    Create `src/core/ai/ReplanPolicy.ts` — new file with the pure function implementing RESEARCH.md Pattern 5 EXACTLY:

    - Export `evaluateReplan(context: ReplanContext): ReplanDisposition` — a pure, synchronous, no-side-effects function. Import NOTHING beyond type imports from `./types` and `./AgentTurnOutcome`.
    - Decision logic (in priority order, first match returns):
      1. `if (context.isAborted) return 'terminate'` — per D-06, abort overrides everything
      2. `if (context.lastTool.sideEffect === 'irreversible') return 'terminate'` — per D-13
      3. `if (context.lastTool.success) return 'continue-planning'` — tool succeeded, loop continues
      4. `if (context.replanCount > 0) return 'render'` — per D-15, already replanned once
      5. `if (context.error?.retryable) return 'replan'` — per D-14, one replan for retryable errors
      6. `if (context.error?.category === 'terminal') return 'render'` — terminal errors render with caveats
      7. Check specific error codes (per D-14): `if (context.error?.code === 'SCHEMA_INVALID' || context.error?.code === 'NO_SUCH_TOOL' || context.error?.code === 'INVALID_TOOL_INPUT') return 'render'` — schema/permission/auth errors are terminal
      8. `if (context.caps.plannerCapReached) return 'render'` — per D-15, cap exhaustion renders, not replans
      9. Default: `return 'render'` — when no other rule matches, render with partial results

    - The function is PURE — no mutable state, no module-level variables, no imports from services. It takes ReplanContext and returns ReplanDisposition.
    - Export both the function and the types it uses (re-export for convenience).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `src/core/ai/ReplanPolicy.ts` exports `evaluateReplan` function
    - `evaluateReplan({ lastTool: { sideEffect: 'irreversible', success: false, toolName: 'delete' }, replanCount: 0, isAborted: false, caps: { plannerCalls: 1, plannerCap: 3, plannerCapReached: false } })` returns `'terminate'` (per D-13)
    - `evaluateReplan({ lastTool: { sideEffect: 'read', success: true, toolName: 'search' }, replanCount: 0, isAborted: false, caps: { plannerCalls: 1, plannerCap: 3, plannerCapReached: false } })` returns `'continue-planning'`
    - `evaluateReplan({ lastTool: { sideEffect: 'read', success: false, toolName: 'search' }, error: { retryable: true }, replanCount: 0, isAborted: false, caps: { plannerCalls: 1, plannerCap: 3, plannerCapReached: false } })` returns `'replan'` (per D-14/D-15)
    - `evaluateReplan({ ...same but replanCount: 1 })` returns `'render'` (one replan max per D-15)
    - `evaluateReplan({ lastTool: { sideEffect: 'read', success: false, toolName: 'search' }, isAborted: true, replanCount: 0, caps: { plannerCalls: 1, plannerCap: 3, plannerCapReached: false } })` returns `'terminate'` (abort priority per D-06)
    - Function is pure — no side effects, no service imports, deterministic output for same input
  </acceptance_criteria>
  <done>ReplanPolicy pure function created; evaluateReplan() returns correct disposition for all 7 priority-ordered cases (abort/irreversible/success/replanCount/retryable/terminal/schema/cap/default)</done>
  <reversibility rating="one-way">D-14 — the disposition enum is the output contract of ReplanPolicy consumed by the orchestrator's control flow; removing a disposition would orphan its corresponding code path</reversibility>
</task>

<task type="auto">
  <name>Integrate OutcomeVerifier + ReplanPolicy into AgentOrchestrator.runTurn()</name>
  <files>src/core/ai/AgentOrchestrator.ts</files>
  <read_first>
    - src/core/ai/AgentOrchestrator.ts — current state from Plan 01 (trajectory machine + AgentTurnOutcome return + abort handling)
    - src/core/ai/OutcomeVerifier.ts — `outcomeVerifier.verify()` method signature
    - src/core/ai/ReplanPolicy.ts — `evaluateReplan()` function signature
    - src/core/ai/RenderingOutcomePolicy.ts — `buildRenderingOutcomePolicy()` function signature
    - src/core/ai/types.ts — `ReplanContext`, `ReplanDisposition`, `ToolSideEffect`, `CompletionEvidence`, `ToolEvidencePolicy`, `ToolExecutionResult`
    - CONTEXT.md D-10, D-11, D-12, D-13, D-14, D-15 — exact integration contracts
  </read_first>
  <action>
    Modify `src/core/ai/AgentOrchestrator.ts` to integrate evidence verification and replanning into the `runTurn()` method established in Plan 01.

    **New imports to add:**
    ```typescript
    import { outcomeVerifier } from './OutcomeVerifier';
    import { evaluateReplan } from './ReplanPolicy';
    import { buildRenderingOutcomePolicy } from './RenderingOutcomePolicy';
    import type { ReplanContext, ReplanDisposition } from './types';
    import type { CompletionEvidence } from './AgentTurnOutcome';
    ```

    **New scoped variables at top of runTurn():**
    - `let replanCount = 0;` — tracks number of replans within this turn (per D-15)
    - `const evidenceAccumulator: CompletionEvidence[] = [];` — accumulates all evidence records

    **Refactor the `run_tool` case** in the planner loop:
    - After `executorService.execute()` succeeds:
      - Extract `sideEffect` from the tool manifest: `const tool = tools.find(t => t.name === decision.toolName); const sideEffect = tool?.sideEffect ?? 'none';`
      - **D-10: Verify if evidence required** — `if (tool?.evidence?.required) { const evidence = await outcomeVerifier.verify(result, tool, input.operationId, signal); evidenceAccumulator.push(evidence); }`
      - Build `ReplanContext` for the replan decision:
        ```
        const replanContext: ReplanContext = {
          lastTool: { toolName: decision.toolName, sideEffect, success: true },
          evidence: evidenceAccumulator[evidenceAccumulator.length - 1],
          caps: { plannerCalls: stepCount, plannerCap: caps.planner, plannerCapReached: stepCount >= caps.planner },
          replanCount,
          isAborted: signal?.aborted ?? false,
        };
        ```
      - `const disposition = evaluateReplan(replanContext);`
      - **Switch on disposition:**
        - `'continue-planning'` → loop continues (existing behavior)
        - `'replan'` → (see replan logic below)
        - `'render'` → break out of loop to render
        - `'terminate'` → return `buildFailedOutcome()` with reason code `'pipeline_failure'`
      - When disposition is `'replan'` (NOT `'continue-planning'`): increment `replanCount`, skip rendering, call `plannerService.plan()` ONE MORE TIME with the current `cacheOptimized` context (per D-15: ContextOptimizer does NOT re-run). The planner receives the tool history which includes the failed attempt. This is a single recovery call — after it returns, process the new decision (answer/run_tool/ask_clarification) normally. If the new decision is `run_tool` again, the replanCount guards against infinite loops.

    **After `executorService.execute()` fails** (catch block):
      - Build `ReplanContext` with `lastTool.success: false` and the `error` set to the caught `PipelineError`
      - `const disposition = evaluateReplan(replanContext);`
      - If `'replan'` and `replanCount === 0`: increment `replanCount`, call `plannerService.plan()` for recovery. Do NOT re-run ContextOptimizer. Do NOT reset planner/tool counters. Do NOT reset tool call history.
      - If `'render'` or already replanned: break to rendering with partial results
      - If `'terminate'`: return with `terminalState: 'failed'`

    **Before calling RendererService** (both in-loop answer path and post-loop cap exhaustion):
      - `const policy = buildRenderingOutcomePolicy(evidenceAccumulator);`
      - Pass `policy` to `rendererService.synthesize(adapter, tier, decision, cacheOptimized, policy)` (per D-11)
      - Include accumulated evidence in the returned `AgentTurnOutcome.evidence` field

    **Tool result tracking:**
      - For each tool execution, add `toolCallId: crypto.randomUUID()` to the `ToolExecutionResult` before storing in `toolCallHistory`. This enables evidence cross-referencing via `resultRef`.
      - Accumulate ALL tool results in the outcome's `toolResults` field.

    **waiting-for-permission state (D-15):**
      - The `waiting-for-permission` state is NOT a replan. It is a pause. If the planner returns a permission-required decision, the orchestrator transitions to `waiting-for-permission` and awaits approval. Approval resumes the existing validated tool decision. Denial terminates. This is handled in Plan 01's state transitions — no changes needed here beyond recording the state.

    **Evidence accumulation on outcome:**
      - `AgentTurnOutcome.evidence: evidenceAccumulator` — the complete list of evidence records for this turn
      - `AgentTurnOutcome.toolResults: allToolResultsAccumulator` — all tool execution results regardless of evidence status

    Key invariants:
    - ContextOptimizer runs ONCE at the top of `runTurn()`. Replanning does NOT re-invoke it (per D-15).
    - Planner counters and tool counters do NOT reset on replan (per D-15).
    - `replanCount` increments at most once per turn (per D-15).
    - Irreversible tools block ALL replanning for the rest of the turn (per D-13).
    - The orchestrator builds RenderingOutcomePolicy; the renderer never independently inspects evidence (per D-11).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `agentOrchestrator.runTurn()` imports `outcomeVerifier`, `evaluateReplan`, `buildRenderingOutcomePolicy`
    - After tool execution with `evidence.required: true`, `outcomeVerifier.verify()` is called and result is accumulated in `evidenceAccumulator`
    - After tool execution failure, `evaluateReplan()` is called with the error context and its disposition determines the next step
    - `replanCount` increments on first replan; subsequent replan requests are blocked (max 1 per turn)
    - ContextOptimizer is NOT re-run during replanning
    - `buildRenderingOutcomePolicy(evidenceAccumulator)` is called before every `rendererService.synthesize()` call and the resulting policy is passed as a parameter
    - `AgentTurnOutcome.evidence` contains accumulated evidence records
    - `AgentTurnOutcome.toolResults` contains ALL tool execution results
    - Existing tracer tests from Plan 01 still pass (runTurn for answer path, error path, abort path)
    - `tsc --noEmit` passes
  </acceptance_criteria>
  <done>AgentOrchestrator.runTurn() fully wired: calls OutcomeVerifier.verify() after tool execution, calls evaluateReplan() at every decision point, builds RenderingOutcomePolicy before each render call, evidence accumulated in outcome</done>
  <reversibility rating="one-way">D-11 — inverting the responsibility (renderer as gatekeeper) would make every answer vulnerable to model hallucination bypassing verification; D-13 — changing how irreversibility is detected would alter replay safety guarantees</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Tool output → OutcomeVerifier | Untrusted tool outputs cross this boundary; postcondition checks verify expected shape |
| OutcomeVerifier → ReplanPolicy | Verified/unverified evidence feeds into the replan decision |
| ReplanPolicy → AgentOrchestrator control flow | Disposition determines whether to retry, render, or terminate |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03a-06 | Spoofing | OutcomeVerifier.verify() | high | mitigate | Evidence is a discriminated union on `verified: boolean`; only OutcomeVerifier sets `verified: true`; orchestrator is the only code path that calls OutcomeVerifier; unverified evidence is explicitly marked with `failureReason` and `retryable` |
| T-03a-07 | Denial of Service | ReplanPolicy evaluateReplan | medium | mitigate | `replanCount` increments once and blocks subsequent replans; irreversible tools block all replanning; abort terminates replan-first; cap exhaustion renders instead of replans |
| T-03a-08 | Tampering | AgentOrchestrator evidence accumulation | medium | mitigate | Evidence accumulator is scoped to a single `runTurn()` call; evidence records are `readonly` in the outcome; no external code can inject evidence — only OutcomeVerifier.verify() can create it |
| T-03a-09 | Information Disclosure | RendererService with policy | high | mitigate | `buildRenderingOutcomePolicy()` derives `canClaimWriteSuccess` from verified evidence only; `evidenceSummary` text instructs the renderer to NOT claim write success when unverified; the orchestrator always passes the policy before rendering (per D-11) |
| T-03a-R2 | Repudiation | OutcomeVerifier evidence records | high | mitigate | Every `CompletionEvidence` record carries `id` (UUID), `operationId`, `toolCallId`, `verifiedAt` (timestamp), and `durationMs` — the evidence trail is cryptographically identifiable and timestamped. The `verified: boolean` discriminator makes it impossible to later claim a verification did or did not occur. `AgentTurnOutcome.evidence` is `readonly` and accumulated by the orchestrator (not the tool or verifier). |
| T-03a-E1 | Elevation of Privilege | OutcomeVerifier as sole evidence authority (per D-10/D-11) | high | mitigate | Only `OutcomeVerifier.verify()` can produce `VerifiedCompletionEvidence`. The `AgentOrchestrator` is the sole caller of `OutcomeVerifier.verify()`. `RendererService` receives a derived `RenderingOutcomePolicy` — it cannot create evidence, upgrade unverified to verified, or independently determine evidence sufficiency (per D-11). No other module imports the `VerifiedCompletionEvidence` factory. |
</threat_model>

<verification>
## Plan Verification

```bash
# Type check (Plan 02 creates source files only; tests are created in Plan 03)
npx tsc --noEmit

# Ensure existing tracer tests still pass (regression check)
npx vitest run tests/core/ai/trajectory/tracer.test.ts
```
</verification>

<success_criteria>
1. `outcomeVerifier.verify()` returns `CompletionEvidence` for every invocation — never throws
2. `evaluateReplan()` returns correct disposition for all 7 priority-ordered cases
3. AgentOrchestrator calls verifier after side-effecting tool execution and replan policy for every tool outcome
4. `replanCount` caps at 1 — no infinite replan loops
5. RenderingOutcomePolicy is built and passed to RendererService for every render call
6. All unit tests pass (verifier, replan policy, rendering policy)
7. Existing tracer tests still pass (no regression)
8. `tsc --noEmit` passes
</success_criteria>

<output>
Create `.planning/phases/03a-agent-reliability-evidence/03a-02-SUMMARY.md` when done
</output>
