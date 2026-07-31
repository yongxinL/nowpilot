---
phase: 03a-agent-reliability-evidence
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/ai/types.ts
  - src/core/ai/AgentTurnOutcome.ts
  - src/core/ai/AgentTrajectoryMachine.ts
  - src/core/ai/RenderingOutcomePolicy.ts
  - src/core/ai/AgentOrchestrator.ts
  - src/core/ai/RendererService.ts
  - tests/core/ai/trajectory/tracer.test.ts
autonomous: false
requirements:
  - AGT-01
  - AGT-03

must_haves:
  truths:
    - "TRUTH-01: `agentOrchestrator.runTurn(input)` returns `AgentTurnOutcome` (not `string`) — `typeof result === 'object' && 'terminalState' in result` holds for the answer path"
    - "TRUTH-02: `AgentTurnOutcome.trajectory` contains >=2 entries (`assembling-context` --> ... --> `completed`/`failed`/`aborted`) — no turn returns an empty or single-entry trajectory"
    - "TRUTH-03: An invalid state transition (e.g. `completed` --> `planning`) throws `AGENT_STATE_INVALID` — the transition map is closed and enforced"
    - "TRUTH-04: `agentOrchestrator.runTurnText(input)` returns the same string as `(await runTurn(input)).renderedAnswer` for the answer path — backward compatibility preserved"
    - "TRUTH-05: An aborted turn via `AbortController.abort()` produces `AgentTurnOutcome.terminalState === 'aborted'` and `renderedAnswer === null` — abort is distinct from failure"
    - "TRUTH-06: RenderingOutcomePolicy is derived from CompletionEvidence by the orchestrator — RendererService.synthesize() accepts `policy` parameter and never independently determines evidence sufficiency (per D-11)"
  artifacts:
    - src/core/ai/AgentTurnOutcome.ts
    - src/core/ai/AgentTrajectoryMachine.ts
    - src/core/ai/RenderingOutcomePolicy.ts
  key_links:
    - "AgentOrchestrator.runTurn() --> AgentTrajectoryMachine.transitionTo() — every state change flows through the allowlist"
    - "AgentOrchestrator.runTurn() --> AgentTurnOutcome — every exit path (answer/error/abort/cap-exhaustion) builds an outcome"
    - "AgentTurnOutcome.renderedAnswer — must NOT be a non-null string when terminalState is 'aborted'"

# Artifacts this phase produces (Plan 01)

| Symbol | Kind | File |
|--------|------|------|
| `AgentTurnOutcome` | interface | src/core/ai/AgentTurnOutcome.ts |
| `AgentTerminalState` | type ('completed'\|'partial'\|'failed'\|'aborted') | src/core/ai/AgentTurnOutcome.ts |
| `AgentTurnReasonCode` | type | src/core/ai/AgentTurnOutcome.ts |
| `AgentTurnOutcomeSchema` | Zod schema | src/core/ai/AgentTurnOutcome.ts |
| `createAgentTurnOutcome` | factory function | src/core/ai/AgentTurnOutcome.ts |
| `AgentTrajectoryState` | type | src/core/ai/types.ts |
| `TrajectoryStateEntry` | interface | src/core/ai/types.ts |
| `ALLOWED_TRANSITIONS` | const (Record<AgentTrajectoryState, Set<AgentTrajectoryState>>) | src/core/ai/types.ts |
| `ToolSideEffect` | type ('none'\|'read'\|'write'\|'irreversible') | src/core/ai/types.ts |
| `ToolIdempotency` | type ('not-required'\|'supported'\|'required') | src/core/ai/types.ts |
| `ToolEvidencePolicy` | interface | src/core/ai/types.ts |
| `CompletionEvidence` | discriminated union type | src/core/ai/types.ts |
| `CompletionEvidenceCheck` | interface | src/core/ai/types.ts |
| `ReplanDisposition` | type | src/core/ai/types.ts |
| `ReplanContext` | interface | src/core/ai/types.ts |
| `RenderingOutcomePolicy` | interface | src/core/ai/types.ts |
| `AgentTrajectoryMachine` | class | src/core/ai/AgentTrajectoryMachine.ts |
| `buildRenderingOutcomePolicy` | function | src/core/ai/RenderingOutcomePolicy.ts |
| `RegisteredTool` (extended) | interface + sideEffect?/evidence?/idempotency? | src/core/ai/types.ts |
| `ToolExecutionResult` (extended) | interface + toolCallId?/evidence? | src/core/ai/types.ts |
| `AgentTurnInput` (extended) | interface + onTrajectoryTransition? | src/core/ai/types.ts |
---

<objective>
Wire the full trajectory state machine and structured outcome contract end-to-end through one answer path: types --> AgentTrajectoryMachine --> AgentOrchestrator.runTurn() --> AgentTurnOutcome. After this plan, `runTurn()` returns a typed outcome with trajectory history, abort is handled distinctly from failure, and `runTurnText()` provides backward compatibility. The answer path is production-quality; error/abort/cap-exhaustion paths are complete.

Purpose: Prove the trajectory FSM architecture and return-type contract in a single working slice before expanding into evidence verification and replanning.
Output: New types module (AgentTurnOutcome.ts), trajectory FSM (AgentTrajectoryMachine.ts), rendering policy (RenderingOutcomePolicy.ts), refactored orchestrator, updated renderer, and passing tracer test.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md
@.planning/phases/03a-agent-reliability-evidence/03a-RESEARCH.md
@src/core/ai/types.ts
@src/core/ai/AgentTurnInput.ts
@src/core/ai/AgentOrchestrator.ts
@src/core/ai/RendererService.ts
@src/core/ai/PipelineError.ts
</context>

<tasks>

<task type="checkpoint:decision" gate="blocking">
  <name>Confirm one-way contract decisions before implementation</name>
  <decision>Phase 3a type contracts (D-01, D-03, D-04, D-05, D-07, D-08, D-09, D-14, D-16) are one-way doors — changing field semantics later would require updating every downstream consumer. All decisions were locked by the user in CONTEXT.md.</decision>
  <context>This checkpoint confirms the type contracts specified in CONTEXT.md sections D-01 through D-16 are accepted as-is before any code is written. The executor will implement these contracts exactly.</context>
  <options>
    <option id="proceed">
      <name>Proceed — implement all 17 locked decisions as specified</name>
      <pros>Matches user intent exactly; no divergence from CONTEXT.md</pros>
      <cons>One-way contract change; downstream consumers must follow</cons>
    </option>
    <option id="amend">
      <name>Amend — adjust specific contracts before implementation</name>
      <pros>Flexibility if research reveals issues</pros>
      <cons>Requires re-gathering context; delays phase</cons>
    </option>
  </options>
  <resume-signal>Type "proceed" to implement as specified, or "amend: [details]" to adjust</resume-signal>
</task>

<task type="tracer">
  <name>End-to-end tracer — "Answer path produces AgentTurnOutcome with trajectory history"</name>
  <files>src/core/ai/AgentTurnOutcome.ts, src/core/ai/AgentTrajectoryMachine.ts, src/core/ai/types.ts</files>
  <read_first>
    - src/core/ai/types.ts — existing `RegisteredTool`, `ToolExecutionResult`, `PipelineErrorCode`, `AgentTurnInput`
    - RESEARCH.md Patterns 1 and 2 (AgentTrajectoryMachine FSM, CompletionEvidence discriminated union)
    - CONTEXT.md D-01 through D-07, D-09, D-14, D-16 — exact contract definitions for every type field
  </read_first>
  <action>
    Create ALL core types for Phase 3a in two files:

    **1. Create `src/core/ai/AgentTurnOutcome.ts`** — new file with:
    - `AgentTerminalState` type = `'completed' | 'partial' | 'failed' | 'aborted'` (per D-02)
    - `AgentTurnReasonCode` type = `'direct_answer' | 'planner_terminated' | 'clarification_requested' | 'user_declined' | 'planner_cap_exhausted' | 'tool_cap_exhausted' | 'permission_terminated' | 'verification_failed' | 'pipeline_failure' | 'user_aborted'` (per D-05)
    - `AgentTurnOutcome` interface with ALL fields from D-02: `operationId`, `terminalState`, `reasonCode`, `renderedAnswer`, `trajectory`, `evidence`, `toolResults`, `limits` (plannerCalls/plannerCap/plannerCapReached/toolCalls/toolCap/toolCapReached), `abort` (requested/requestedAt/stage), `usage` (inputTokens/outputTokens/totalTokens/estimatedCost/currency), `diagnostics` (errors/warnings), `startedAt`, `endedAt`, `durationMs`. ALL fields are `readonly`.
    - Zod schema `AgentTurnOutcomeSchema` using `z.strictObject()` — validate every field.
    - `createAgentTurnOutcome()` factory function that fills defaults: `startedAt: Date.now()`, empty arrays for trajectory/evidence/toolResults/diagnostics, zeroed usage, `abort.requested: false`.
    - Export type AND schema AND factory.

    **2. Extend `src/core/ai/types.ts`** — modify existing file:
    - Add `AgentTrajectoryState` type (per D-04)
    - Add `TrajectoryStateEntry` interface (per D-07)
    - Add `ToolSideEffect`, `ToolIdempotency`, `ToolEvidencePolicy` types (per D-08/D-16)
    - Extend `RegisteredTool` with `sideEffect?`, `evidence?`, `idempotency?` — ONLY these 3 fields (per D-16)
    - Extend `ToolExecutionResult` with `toolCallId?`, `evidence?`
    - Add `ReplanDisposition` type (per D-14)
    - Add `ReplanContext` interface (per RESEARCH.md Pattern 5)
    - Add `CompletionEvidence` discriminated union: `VerifiedCompletionEvidence` (verified:true) and `UnverifiedCompletionEvidence` (verified:false) (per D-09)
    - Add `CompletionEvidenceCheck` interface
    - Add `RenderingOutcomePolicy` interface (per D-11)
    - Add `ALLOWED_TRANSITIONS` constant with exact transitions from D-04
    - Extend `AgentTurnInput` with optional `onTrajectoryTransition?` callback (per D-03)
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `src/core/ai/AgentTurnOutcome.ts` exports `AgentTurnOutcome`, `AgentTerminalState`, `AgentTurnReasonCode`, `AgentTurnOutcomeSchema`, `createAgentTurnOutcome`
    - `src/core/ai/types.ts` exports all new types: `AgentTrajectoryState`, `TrajectoryStateEntry`, `ToolSideEffect`, `ToolIdempotency`, `ToolEvidencePolicy`, `ReplanDisposition`, `ReplanContext`, `CompletionEvidence`, `CompletionEvidenceCheck`, `RenderingOutcomePolicy`, `ALLOWED_TRANSITIONS`
    - `RegisteredTool` has `sideEffect?`, `evidence?`, `idempotency?` in addition to existing fields
    - `ToolExecutionResult` has `toolCallId?`, `evidence?` in addition to existing fields
    - `AgentTurnInput` has optional `onTrajectoryTransition?` field
    - `ALLOWED_TRANSITIONS` has all 10 states with correct transition sets; terminal states have empty sets
    - `AgentTurnOutcomeSchema.parse()` validates a well-formed outcome object without throwing
    - `tsc --noEmit` passes
  </acceptance_criteria>
  <done>All Phase 3a types compile, AgentTurnOutcome.ts and types.ts are created/modified, ALLOWED_TRANSITIONS covers all 10 states, Zod schemas parse valid outcomes</done>
</task>

<task type="auto">
  <name>AgentTrajectoryMachine class + AgentOrchestrator.runTurn() full refactor</name>
  <files>src/core/ai/AgentTrajectoryMachine.ts, src/core/ai/AgentOrchestrator.ts</files>
  <read_first>
    - src/core/ai/types.ts — new types from Task 1
    - src/core/ai/AgentTurnOutcome.ts — `AgentTurnOutcome`, `createAgentTurnOutcome`
    - src/core/ai/AgentOrchestrator.ts — existing `runTurn()` method (lines 84-197)
    - src/core/ai/PipelineError.ts — existing error taxonomy
    - RESEARCH.md Pattern 1 (AgentTrajectoryMachine) and Pattern 4 (abort-aware pipeline)
    - CONTEXT.md D-01, D-03, D-04, D-06, D-07, D-15
  </read_first>
  <action>
    **1. Create `src/core/ai/AgentTrajectoryMachine.ts`** per RESEARCH.md Pattern 1:
    - `TERMINAL_STATES` Set for `completed`/`failed`/`aborted`
    - `AgentTrajectoryMachine` class: `transitionTo(next, metadata?)` validates against `ALLOWED_TRANSITIONS`, throws `AGENT_STATE_INVALID` on invalid, closes current entry, pushes to history, fires `onTransition` callback wrapped in try/catch
    - `finalize()` closes current entry and returns complete history
    - `current`, `history`, `isTerminal` getters

    **2. Refactor `src/core/ai/AgentOrchestrator.ts`:**
    - `runTurn()` returns `Promise<AgentTurnOutcome>` (NOT `Promise<string>`) per D-01
    - Create fresh `AgentTrajectoryMachine` at top of `runTurn()` — NOT as instance property (per RESEARCH.md Pitfall 3)
    - Track `startedAt`, `replanCount = 0`
    - Insert `signal?.throwIfAborted()` before each pipeline stage
    - Transition states: assembling-context (start) --> planning (each loop iteration) --> executing (run_tool) --> rendering --> completed (answer) / failed (error) / aborted (abort)
    - `buildAbortedOutcome()`: transitions to `aborted`, returns outcome with `terminalState: 'aborted'`, `renderedAnswer: null` per D-06
    - `buildFailedOutcome(error)`: transitions to `failed`, returns outcome with error message
    - Cap exhaustion: `terminalState: 'partial'` and `reasonCode: 'planner_cap_exhausted'` per D-02
    - **Add `runTurnText()`** marked `@deprecated`: calls `this.runTurn()` and returns `outcome.renderedAnswer ?? dispatchError(...)`
    - Evidence and replan integration are NOT added in this plan — those are Plan 02 additions
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `src/core/ai/AgentTrajectoryMachine.ts` exports `AgentTrajectoryMachine` class
    - `agentOrchestrator.runTurn(input)` returns `Promise<AgentTurnOutcome>`
    - Answer path: `outcome.terminalState === 'completed'`, trajectory has >=2 entries, renderedAnswer non-null
    - Error path: `outcome.terminalState === 'failed'`, renderedAnswer has error message
    - Abort path: `outcome.terminalState === 'aborted'`, renderedAnswer === null
    - `runTurnText()` returns same string as `runTurn().renderedAnswer` for answer path
    - Invalid FSM transitions throw `AGENT_STATE_INVALID`
    - Trajectory is fresh per `runTurn()` call (no leakage across calls)
  </acceptance_criteria>
  <done>AgentTrajectoryMachine class works with strict transition validation; runTurn() returns AgentTurnOutcome with trajectory for answer/error/abort paths; runTurnText() is a working backward-compat wrapper</done>
  <reversibility rating="one-way">D-01 — runTurn() return type is the API contract consumed by all callers; changing back to string would require undoing all downstream outcome consumers</reversibility>
</task>

<task type="auto">
  <name>RenderingOutcomePolicy + RendererService update + tracer test suite</name>
  <files>src/core/ai/RenderingOutcomePolicy.ts, src/core/ai/RendererService.ts, tests/core/ai/trajectory/tracer.test.ts</files>
  <read_first>
    - src/core/ai/RendererService.ts — existing `synthesize()` and `stream()` signatures
    - src/core/ai/types.ts — `RenderingOutcomePolicy` type
    - src/core/ai/AgentTurnOutcome.ts — outcome type for test assertions
    - RESEARCH.md code: `buildRenderingOutcomePolicy()` function
    - CONTEXT.md D-11 — orchestrator builds policy, renderer consumes it
    - tests/core/ai/AgentOrchestrator.test.ts — existing test patterns
  </read_first>
  <action>
    **1. Create `src/core/ai/RenderingOutcomePolicy.ts`:**
    - `buildRenderingOutcomePolicy(evidence)` — filters into verified/unverified, derives `canClaimWriteSuccess = verified.length > 0 && unverified.length === 0`
    - `evidenceSummary` text: verified → "may reference verified results"; unverified → "do not claim write operations succeeded"
    - Export function and re-export type from types.ts

    **2. Update `src/core/ai/RendererService.ts`:**
    - Add `policy?: RenderingOutcomePolicy` as optional final param to `synthesize()` and `stream()`
    - When policy provided, append `policy.evidenceSummary` to system prompt
    - All existing logic unchanged

    **3. Create `tests/core/ai/trajectory/tracer.test.ts`** — >=10 test cases:
    - FSM: valid transitions, invalid rejection, terminal lock, finalize(), callback fire-and-forget
    - RenderingOutcomePolicy: empty/verified/mixed evidence
    - Orchestrator: answer path, abort path, error path, runTurnText() compat
    - Use existing vi.mock patterns from AgentOrchestrator.test.ts
  </action>
  <verify>
    <automated>npx vitest run tests/core/ai/trajectory/tracer.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `tests/core/ai/trajectory/tracer.test.ts` contains >=10 passing test cases
    - `src/core/ai/RenderingOutcomePolicy.ts` exports `buildRenderingOutcomePolicy`
    - `RendererService.synthesize()` and `stream()` accept optional `policy?` parameter
    - Tracer tests prove FSM + orchestrator + outcome end-to-end
    - `tsc --noEmit` passes
  </acceptance_criteria>
  <done>RenderingOutcomePolicy created, RendererService updated with policy parameter, >=10 tracer tests pass proving full answer/abort/error paths</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| AgentTurnInput --> AgentOrchestrator | Untrusted user input, tool schemas, abort signal cross this boundary |
| AgentOrchestrator --> RendererService | RenderingOutcomePolicy constrains what the renderer may claim |
| Trajectory state machine internals | State transitions validated by ALLOWED_TRANSITIONS; external callbacks are fire-and-forget |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03a-01 | Tampering | AgentTrajectoryMachine.transitionTo() | high | mitigate | ALLOWED_TRANSITIONS is a compile-time constant; transitionTo() validates every state change and throws AGENT_STATE_INVALID on invalid transitions |
| T-03a-02 | Spoofing | AgentTurnOutcome.terminalState | high | mitigate | terminalState set ONLY by orchestrator exit-path helpers; no external code can set it |
| T-03a-03 | Information Disclosure | RendererService answer text | high | mitigate | RenderingOutcomePolicy.evidenceSummary injected into renderer system prompt to constrain claims |
| T-03a-04 | Denial of Service | AgentOrchestrator abort handling | high | mitigate | signal?.throwIfAborted() before each pipeline stage; abort produces 'aborted' not 'failed' |
| T-03a-05 | Denial of Service | AgentOrchestrator planner loop | medium | accept | Cap enforcement via TierCapForTier produces terminalState: 'partial' per D-02 |
| T-03a-SC | Tampering | npm/pip/cargo installs | low | accept | No new packages added in this phase |
</threat_model>

<verification>
## Tracer Verification

```bash
npx vitest run tests/core/ai/trajectory/tracer.test.ts
npx tsc --noEmit
```
</verification>

<success_criteria>
1. `agentOrchestrator.runTurn()` returns `AgentTurnOutcome` (not `string`) with trajectory array of 2+ entries
2. Answer path: `terminalState === 'completed'`, `renderedAnswer` is non-null string
3. Error path: `terminalState === 'failed'`, `renderedAnswer` has error message
4. Abort path: `terminalState === 'aborted'`, `renderedAnswer === null`
5. `runTurnText()` returns same string as `runTurn().renderedAnswer` for answer path
6. Invalid FSM transitions throw `AGENT_STATE_INVALID`
7. All tracer tests pass (>=10 tests, `npx vitest run` exits 0)
8. `tsc --noEmit` passes
</success_criteria>

<output>
Create `.planning/phases/03a-agent-reliability-evidence/03a-01-SUMMARY.md` when done
</output>
