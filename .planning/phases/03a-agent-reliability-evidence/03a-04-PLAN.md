---
phase: 03a-agent-reliability-evidence
plan: 04
type: execute
wave: 3
depends_on:
  - 03a-02
  - 03a-03
files_modified:
  - tests/core/ai/integration.test.ts
  - tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts
  - package.json
autonomous: true
requirements:
  - AGT-01
  - AGT-02
  - AGT-03
  - AGT-04
  - TOL-03

must_haves:
  truths:
    - "TRUTH-16: A full integration test exercises the complete pipeline: trajectory → execute → verify → replan decision → render with evidence-aware policy — all five requirements (AGT-01 through TOL-03) verified in one flow"
    - "TRUTH-17: Cap exhaustion produces AgentTurnOutcome with terminalState: 'partial' (not 'completed') and reasonCode: 'planner_cap_exhausted' or 'tool_cap_exhausted' — per D-02/AGT-03"
    - "TRUTH-18: `pnpm run verify:phase-3a` runs all Phase 3a tests and exits 0 — phase verification script exists and is green"
  artifacts:
    - "package.json (verify:phase-3a script)"
    - tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts
  key_links:
    - "verify:phase-3a → all test files — the phase gate script that downstream phases depend on"
---

<objective>
Tie the entire Phase 3a reliability architecture together with integration tests and a phase verification script. After this plan, every exit path of the AgentOrchestrator is tested end-to-end, and `pnpm run verify:phase-3a` serves as the phase gate for downstream consumers.

Purpose: Prove that the agent reliability architecture works as a cohesive system — not just individual units.
Output: Comprehensive integration test suite, complete AgentTrajectoryMachine unit tests, and a `verify:phase-3a` npm script.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md
@.planning/phases/03a-agent-reliability-evidence/03a-RESEARCH.md
@.planning/ROADMAP.md
@src/core/ai/AgentOrchestrator.ts
@src/core/ai/AgentTrajectoryMachine.ts
@src/core/ai/OutcomeVerifier.ts
@src/core/ai/ReplanPolicy.ts
@src/core/ai/RenderingOutcomePolicy.ts
@src/core/ai/ExecutorService.ts
@src/core/ai/types.ts
@src/core/ai/AgentTurnOutcome.ts
@tests/core/ai/integration.test.ts
@tests/core/ai/trajectory/tracer.test.ts
@package.json
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Complete AgentTrajectoryMachine unit tests + full integration test suite</name>
  <files>tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts, tests/core/ai/integration.test.ts</files>
  <behavior>
    - Test: "AgentTrajectoryMachine full pipeline: assembling-context → planning → executing → verifying → rendering → completed" — 6 states, verify all entries have exitedAt and durationMs, history length = 6, final state = completed
    - Test: "AgentTrajectoryMachine replanning loop: assembling-context → planning → executing → verifying → replanning → planning → rendering → completed" — verify history contains both planning entries and replanning entry
    - Test: "AgentTrajectoryMachine abort mid-execution: assembling-context → planning → executing → aborted" — verify final state is aborted, not failed
    - Test: "Integration: full pipeline with evidence — planner returns run_tool, executor executes, verification passes, replanPolicy says continue, renderer renders with evidence-aware policy"
    - Test: "Integration: replanning after tool failure — planner returns run_tool, executor fails with retryable error, replanPolicy returns replan, planner called again, renders with partial results"
    - Test: "Integration: irreversible tool blocks replanning — execute irreversible tool, verify outcome has terminalState based on replan termination"
    - Test: "Integration: cap exhaustion produces partial outcome — FAST tier planner=3, loop through 3 run_tool decisions, verify terminalState: 'partial', reasonCode: 'planner_cap_exhausted'"
    - Test: "Integration: abort during tool execution — AbortController.abort() during executor call, verify outcome.terminalState: 'aborted'"
    - Test: "Integration: evidence accumulation — two tool executions, both with evidence.required, verify AgentTurnOutcome.evidence has 2 entries"
    - Test: "Integration: runTurnText backward compatibility — runTurnText() returns string matching runTurn().renderedAnswer for answer path"
  </behavior>
  <read_first>
    - src/core/ai/AgentTrajectoryMachine.ts — class API: `constructor`, `transitionTo()`, `finalize()`, `current`, `history`, `isTerminal`
    - src/core/ai/AgentOrchestrator.ts — `runTurn()` full implementation (trajectory + evidence + replan + abort)
    - src/core/ai/OutcomeVerifier.ts — `outcomeVerifier.verify()` method
    - src/core/ai/ReplanPolicy.ts — `evaluateReplan()` function
    - src/core/ai/ExecutorService.ts — `execute()` with idempotency
    - tests/core/ai/trajectory/tracer.test.ts — existing tracer test patterns
    - tests/core/ai/integration.test.ts — existing integration test patterns with mock setup
    - tests/core/ai/AgentOrchestrator.test.ts — existing mock patterns for ProviderRouter, PlannerService, ExecutorService, RendererService
    - RESEARCH.md "Validation Architecture" section — test map and phase gate requirements
  </read_first>
  <action>
    **1. Create `tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts`** — comprehensive FSM tests:

    Import `AgentTrajectoryMachine` from source. No mocks needed — the class is self-contained.

    Test cases:
    - "initializes at assembling-context" — `new AgentTrajectoryMachine()` → `current === 'assembling-context'`
    - "initializes at custom state" — `new AgentTrajectoryMachine('planning')` → `current === 'planning'`
    - "transitionTo planning from assembling-context" — `machine.transitionTo('planning')` → `current === 'planning'`, `history[0].state === 'assembling-context'`, `history[0].exitedAt` is non-null, `history[0].durationMs` is >= 0
    - "full successful pipeline: assembling-context → planning → executing → verifying → rendering → completed" — 6 transitions, verify `history.length === 6` (after finalize), `isTerminal === true`, each entry has `enteredAt`, `exitedAt`, `durationMs`
    - "replanning loop: ... → verifying → replanning → planning → rendering → completed" — 8 transitions (2 planning entries), verify `history` contains both planning entries with different `enteredAt` times
    - "abort path: assembling-context → planning → executing → aborted" — verify `isTerminal === true` after aborted, `history[3].state === 'aborted'`
    - "invalid transition throws AGENT_STATE_INVALID" — from `assembling-context`, `transitionTo('completed')` throws error with 'AGENT_STATE_INVALID'
    - "terminal state rejects all transitions" — after reaching `completed`, any `transitionTo()` throws
    - "terminal state isTerminal returns true" — after `completed`/`failed`/`aborted`, `isTerminal === true`
    - "finalize() includes current entry" — after 3 transitions, `finalize()` returns 3 entries (NOT 2 — the current entry is included)
    - "finalize() sets exitedAt and durationMs on last entry" — verify last entry in `finalize()` result has non-null `exitedAt` and `durationMs`
    - "transitionTo carries metadata" — `transitionTo('planning', { plannerCall: 1 })` → verify `history` entry has `plannerCall: 1`
    - "onTransition callback fires with closed entry" — pass `vi.fn()` as callback, verify called with the entry that was just closed (NOT the newly opened one)
    - "onTransition callback failure swallowed" — pass callback that throws, verify `transitionTo()` still completes without error
    - "history is immutable from outside" — verify that modifying the returned `history` array does not affect internal state (TypeScript's `readonly` ensures this at compile time)
    - "ALLOWED_TRANSITIONS from assembling-context" — verify `ALLOWED_TRANSITIONS['assembling-context'].has('planning')` is true, `has('completed')` is false
    - "ALLOWED_TRANSITIONS terminal states empty" — verify `ALLOWED_TRANSITIONS['completed'].size === 0`, same for failed and aborted
    - Use `vi.useFakeTimers()` only if timing-dependent assertions are needed; otherwise prefer real timestamps.

    **2. Extend `tests/core/ai/integration.test.ts`** — full orchestration integration tests:

    Use the existing mock pattern from the file: `vi.mock` for ProviderRouter, PlannerService, ExecutorService, RendererService. The key addition: the REAL `AgentOrchestrator`, `OutcomeVerifier`, and `ReplanPolicy` are used (not mocked) so the full integration is tested.

    New integration test cases:
    - "full pipeline with evidence: plan→execute→verify→continue→render" — mock planner to return `run_tool` then `answer`, mock executor to succeed, verify `outcome.evidence` has entries, `outcome.terminalState === 'completed'`, `outcome.trajectory` includes `verifying` state, `rendererService.synthesize` was called with a `policy` parameter where `policy.canClaimWriteSuccess` reflects evidence
    - "replanning after retryable tool failure" — mock planner: run_tool → answer. Mock executor: first call fails with retryable PipelineError, second call succeeds. Verify `plannerService.plan` is called 3 times (initial + replan + final answer), `outcome.trajectory` includes `replanning` state, `replanCount` was incremented
    - "irreversible tool blocks replanning" — create mock tool with `sideEffect: 'irreversible'`, `evidence: { required: false }`. Mock executor succeeds. Then mock another tool call that fails. Verify `evaluateReplan` returns `terminate`, `outcome.terminalState` reflects termination
    - "cap exhaustion produces partial: FAST tier (planner=3)" — mock planner to always return `run_tool`. FAST tier cap is 3 planner calls. After 3 iterations, verify `outcome.terminalState === 'partial'`, `outcome.reasonCode === 'planner_cap_exhausted'`
    - "abort during tool execution" — create `AbortController`, pass `signal` in AgentTurnInput, call `controller.abort()` during executor's first call (use mock that checks signal). Verify `outcome.terminalState === 'aborted'`, `outcome.renderedAnswer === null`
    - "evidence accumulation — two tools" — planner returns run_tool twice then answer. Both tools have `evidence: { required: true }`. Verify `outcome.evidence.length === 2`, both evidence entries are verified
    - "runTurnText backward compatibility" — call both `runTurn()` and `runTurnText()` with answer-path input, verify `runTurnText()` returns the same string as `outcome.renderedAnswer`

    Import patterns: use dynamic `import()` inside test cases (after `vi.mock` setup) to ensure module resolution order is correct. Follow the existing pattern in integration.test.ts:
    `const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');`

    Each test creates its own `AgentTurnInput` using `createAgentTurnInput()` with appropriate overrides.

    ALL tests must pass.
  </action>
  <verify>
    <automated>npx vitest run tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts tests/core/ai/integration.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts` — ≥16 test cases (all states, transitions, terminal lock, metadata, callback, finalize), all passing
    - `tests/core/ai/integration.test.ts` — existing tests still pass + ≥7 new integration tests (evidence, replanning, irreversible, cap exhaustion, abort, evidence accumulation, runTurnText compat), all passing
    - Integration tests use real `AgentOrchestrator`, `OutcomeVerifier`, `ReplanPolicy` — not mocked
    - `npx vitest run` on both files exits 0
    - All assertable behaviors from D-01 through D-17 are covered by at least one passing test
  </acceptance_criteria>
  <done>AgentTrajectoryMachine unit tests (>=16 cases) and integration tests (>=7 new cases) all pass; full pipeline from trajectory through evidence to rendering verified</done>
</task>

<task type="auto">
  <name>Phase verification script + final regression check</name>
  <files>package.json</files>
  <read_first>
    - package.json — existing `"scripts"` section to find pattern for `"verify:phase-*"` scripts
    - ROADMAP.md Phase 3a Success Criteria (4 items) — must verify against these
    - RESEARCH.md "Validation Architecture" — test map, full suite command, phase gate requirement
    - All test files from Plans 01-03 and this plan
  </read_first>
  <action>
    **1. Add `verify:phase-3a` script to `package.json`:**

    Read `package.json` to find existing `verify:phase-*` script patterns. Add the following script:

    ```json
    "verify:phase-3a": "npx vitest run tests/core/ai/trajectory/ --reporter=verbose && npx vitest run tests/core/ai/verifier/ --reporter=verbose && npx vitest run tests/core/ai/ReplanPolicy.test.ts --reporter=verbose && npx vitest run tests/core/ai/RenderingOutcomePolicy.test.ts --reporter=verbose && npx vitest run tests/core/ai/ExecutorService.test.ts --reporter=verbose && npx vitest run tests/core/ai/types.test.ts --reporter=verbose && npx vitest run tests/core/ai/integration.test.ts --reporter=verbose && npx vitest run tests/core/ai/AgentOrchestrator.test.ts --reporter=verbose && npx tsc --noEmit"
    ```

    This runs ALL Phase 3a test files in order, with verbose output, then type-checks. If any test file fails, the `&&` chain stops.

    **Simplified version if the full chain is too verbose:**
    ```json
    "verify:phase-3a": "npx vitest run tests/core/ai/trajectory tests/core/ai/verifier tests/core/ai/ReplanPolicy.test.ts tests/core/ai/RenderingOutcomePolicy.test.ts tests/core/ai/ExecutorService.test.ts tests/core/ai/types.test.ts tests/core/ai/integration.test.ts tests/core/ai/AgentOrchestrator.test.ts && npx tsc --noEmit"
    ```

    Match the existing style of `verify:phase-*` scripts in `package.json`. If no existing `verify:phase-*` scripts exist, establish the pattern here.

    **2. Run full Phase 3a test suite as final regression check:**

    Execute `pnpm run verify:phase-3a` (or `npm run verify:phase-3a`) and verify it exits 0. All test files from Plans 01, 02, 03, and 04 must pass. Fix any failures before considering this plan complete.

    **3. Verify against ROADMAP.md Phase 3a Success Criteria:**
    - SC1: `AgentOrchestrator` emits typed trajectory states → verified by AgentTrajectoryMachine tests + tracer tests + integration tests
    - SC2: Side-effecting tool results verified via OutcomeVerifier → verified by OutcomeVerifier tests + integration tests with evidence
    - SC3: AgentTurnOutcome on every exit path → verified by integration tests for cap exhaustion (partial), abort (aborted), error (failed), answer (completed)
    - SC4: Replanning follows deterministic policy → verified by ReplanPolicy unit tests + integration tests for replanning loop

    All 4 success criteria are covered by passing tests.
  </action>
  <verify>
    <automated>pnpm run verify:phase-3a</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` contains `"verify:phase-3a"` script that runs ALL Phase 3a test files + `tsc --noEmit`
    - `pnpm run verify:phase-3a` exits 0 — all tests pass, no type errors
    - All 4 ROADMAP Phase 3a Success Criteria are test-verified (each SC maps to passing test cases)
    - Test output shows all test files executed (AgentTrajectoryMachine, OutcomeVerifier, ReplanPolicy, RenderingOutcomePolicy, ExecutorService, types, integration, AgentOrchestrator, tracer)
    - `tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>`pnpm run verify:phase-3a` added to package.json and exits 0; all Phase 3a tests pass; type-check passes; all 4 ROADMAP success criteria verified</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test assertions → Production code | Tests exercise real orchestrator, verifier, replan policy — no mocks at integration level |
| Phase gate → Downstream phases | `verify:phase-3a` must be green before Phase 4b/5 can depend on the reliability contracts |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03a-12 | Tampering | verify:phase-3a script | medium | mitigate | Script runs ALL test files in sequence with `&&` — failure in any file stops the chain; includes `tsc --noEmit` for type safety; the script is committed to version control |
</threat_model>

<verification>
## Phase Gate Verification

```bash
# The one command that proves Phase 3a is complete
pnpm run verify:phase-3a
```

This must exit 0. All test files run, all passing, no type errors.
</verification>

<success_criteria>
1. `tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts` — ≥16 passing tests covering all FSM behaviors
2. `tests/core/ai/integration.test.ts` — existing + ≥7 new integration tests covering full pipeline
3. `package.json` has `verify:phase-3a` script
4. `pnpm run verify:phase-3a` exits 0 — all tests pass, no type errors
5. All 4 ROADMAP Phase 3a Success Criteria map to passing tests
</success_criteria>

<output>
Create `.planning/phases/03a-agent-reliability-evidence/03a-04-SUMMARY.md` when done
</output>
