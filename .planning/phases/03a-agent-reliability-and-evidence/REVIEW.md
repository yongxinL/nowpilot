---
phase: 03a-agent-reliability-and-evidence
reviewed: 2026-08-12T00:45:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/types/harness.ts
  - src/core/error/errorCodes.ts
  - src/core/ai/types.ts
  - src/core/ai/ProviderRouter.ts
  - src/core/ai/StructuredOutput.ts
  - src/core/ai/OutcomeVerifier.ts
  - src/core/ai/CheckpointRecorder.ts
  - src/core/ai/AgentOrchestrator.ts
  - src/core/ai/RendererService.ts
  - src/components/pages/useStreamingLLM.ts
  - package.json
  - pnpm-workspace.yaml
findings:
  critical: 1
  warning: 3
  info: 7
  total: 11
status: issues_found
---

# Phase 03a: Code Review Report

**Reviewed:** 2026-08-12
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the Phase 3a reliability/evidence layer: the C.1 trajectory state machine (`harness.ts`), `buildOutcome` evidence gate, `CheckpointRecorder`, the rewritten `runAgentTurn` loop (trajectory transitions, replan policy, pause seam, terminal authority), the renderer evidence guard, the hook's status mapping, and the F-4 `tool_result` section plumbing through Router/StructuredOutput.

Overall: the architecture follows the documented decisions (D-3a-01..20) faithfully — fail-closed terminals for `!ok` tool results, `capHit ⇒ partial` never `completed`, single terminal authority in the orchestrator, display-only renderer. Security posture is sound: no secrets logged, feedback sections carry only toolName + canonical error code, no new background/content imports (AI layer stays Side Panel). However, **one critical defect in the replan accounting** (the phase's own summary documents it and the tests were adjusted around it instead of fixing it), plus three warnings around evidence-gate fail-open behavior, unhandled verifier throws, and a trajectory transition stream that violates the phase's own `LEGAL_TRANSITIONS` table.

## Critical Issues

### CR-01: Replan double-counts plannerCalls — AGT-04 replan is dead on tiny/small tiers and guarantees `partial` on the default medium tier

**File:** `src/core/ai/AgentOrchestrator.ts:267` (with `:200` loop-top increment)

**Issue:** Each replan increments `plannerCalls` twice: once at line 267 (`plannerCalls++` in the replan branch) and once at the loop top (line 200) for the same replan's `planOnce`. The line 263-265 comment claims "each replan consumes one plannerCalls++ slot (the replan's planOnce consumes the next loop-top slot)" — but the loop-top increment already accounts for every `planOnce`, so the replan's call is charged twice. Consequences, traced concretely:

- **tiny (1/1) and small (2/1) tiers:** after a retryable failure, `plannerCalls` reaches the `plannerCap` at the next loop top before the replan's `planOnce` ever runs — the replan's planOnce is **unreachable dead code**. A retryable tool failure on these tiers immediately yields `partial`/`cap_exhausted` with no replan at all.
- **medium (3/2) — the hook's production default (`DEFAULT_CONTEXT_TIER = 'medium'`, `useStreamingLLM.ts:45`):** one replan + successful re-run + answer = 2 real planner calls, but accounting shows 3 → the loop-top check `plannerCalls >= plannerCap` fires before the answer can be planned. **Every turn that replans and then succeeds terminates `partial`/`cap_exhausted` instead of `completed`** — the renderer renders the answer but the hook surfaces the failed bubble.
- `plannerCalls` reported in the outcome is inflated (e.g., 3 for 2 actual calls in the replan tests), corrupting the cost-truth telemetry D-3a-13 depends on.

This was **known and papered over**: `03a-03-SUMMARY.md` deviation #3 documents "With the default 3/2 tier, the replan slot pushes plannerCalls to the cap before the final answer can be planned, terminating `partial` instead of completing" — and the fix was to change the test to `plannerCap: 4` rather than correct the accounting. The trajectory-cap test (b) also only passes because the double-count makes the cascade hit the ceiling "in time"; with corrected accounting its expectations change (planMock 3/executeMock 3).

**Fix:** Remove the `plannerCalls++` at line 267 — the restore already rewinds `plannerCalls` to the value that included the original (failed) planOnce, and the loop-top increment (line 200) charges the replan's own `planOnce`, exactly one slot per replan per D-3a-13. Then update the two affected tests to the corrected accounting (replan test (a) can revert from `plannerCap: 4` back to the production 3/2 tier, and the trajectory-cap test (b) expects one more planner/executor call before the ceiling fires). With the fix, medium (3/2) fits original + replan + answer in exactly 3 slots and completes.

## Warnings

### WR-01: Evidence gate is fail-open for side-effecting tools with no registered verifier

**File:** `src/core/ai/OutcomeVerifier.ts:45-46` (interacting with `src/core/ai/AgentOrchestrator.ts:328`)

**Issue:** `if (!v) continue` treats "tool has no registered verifier" identically to "tool is read-only". The production hook never passes `verifiers` (`useStreamingLLM.ts:152-160` has no `verifiers` field), so the registry is `{}` — **any** tool result with `ok: true` produces `status: 'completed'` with `evidence: []`. The orchestrator's fail-closed guard at line 328 only catches `!r.ok` results; an `ok: true` side-effecting result with a forgotten verifier sails through as `completed` with zero evidence. This is exactly the false completion AGT-02/R-8 ("a side-effecting tool is 'done' only with matching CompletionEvidence") exists to prevent. It is latent today only because the production tool inventory (`get-provider-info`) is entirely read-only; the module header's claim "a side-effecting tool without ok:true evidence is never 'completed'" is not mechanically enforced. The `dangerous: true` flag already exists on `BuiltinTool` (fixture `tests/fixtures/trajectory.ts:45`) but is not consulted anywhere in this path.

Note: the `if (!v) continue` line is Appendix O.2 verbatim (spec lines 6362-6393), so this is a spec-level gap — but the orchestrator owns terminal authority (D-3a-05) and the fix belongs in the wiring, not necessarily in `buildOutcome`.

**Fix:** Thread the tool inventory's side-effect classification into the gate — e.g., have the orchestrator pass a `sideEffectingTools: ReadonlySet<string>` (derived from the tool schema `dangerous` flag / future ToolCapabilityManifest) alongside `verifiers`, and have `buildOutcome` (or the orchestrator's terminal logic) treat an `ok: true` result for a side-effecting tool with no evidence as `verification_failed` using `COMPLETION_EVIDENCE_MISSING`. At minimum, document the invariant on `AgentTurnInput.verifiers` and enforce it in Phase 8 before any dangerous tool is registered.

### WR-02: A throwing verifier escapes as an unhandled rejection instead of the `verification_failed` terminal

**File:** `src/core/ai/OutcomeVerifier.ts:47` (no try/catch around `await v.verify(r)`)

**Issue:** D-3a-06 specifies "Verifier throw, malformed evidence, or absent evidence ⇒ `verification_failed` — never a silent `completed`". But `v.verify(r)` throwing propagates out of `buildOutcome` → out of `finish()` (`AgentOrchestrator.ts:308-314` has no try/catch) → out of `runTurn` → `runAgentTurn` rethrows. The hook then classifies the raw verifier error via `classifyProviderError` (likely `UNKNOWN`) and shows the generic failed bubble — the structured `AgentTurnOutcome` contract is never produced, `TOOL_POSTCONDITION_FAILED`/`COMPLETION_EVIDENCE_MISSING` are never logged (they are defined in `errorCodes.ts:74-75` but never used), and the trajectory stream ends at `'rendering'` with no terminal phase emitted. It fails safe, but it fails the phase's own terminal contract.

**Fix:** Wrap the verifier invocation in `buildOutcome` — on throw, record `{ ok: false, detail: 'postcondition threw' }` evidence (or let the orchestrator catch and map to `verification_failed` + `debugLog(ERROR_CODES.TOOL_POSTCONDITION_FAILED, ...)`). The turn must terminate as `failed`/`verification_failed`, never a bare rejection.

### WR-03: Emitted trajectory stream contains the illegal edge `verifying → replanning` (violates the phase's own LEGAL_TRANSITIONS)

**File:** `src/core/ai/AgentOrchestrator.ts:243, 256-262, 278`

**Issue:** C5/R-1 declares `LEGAL_TRANSITIONS` "the SINGLE definition of reachable trajectory transitions", and `verifying: ['planning', 'rendering']` — `verifying → replanning` is illegal per the table. On every replan path the checkpoint restore silently rewinds the internal `phase` to `'executing'` (the captured value) **without emitting**, so `onTransition` observers see the raw sequence `executing → verifying → replanning` — an illegal edge. The phase's own `transitionAssert` fixture (`tests/fixtures/trajectory.ts:92-96`) exists precisely to reject such sequences, but no test applies it to the orchestrator's emitted stream (the trajectory tests only assert `toContain`/last-phase). The internal state machine stays legal only because of the unobservable rewind; the observable record contradicts the table, and a Phase-7 trajectory UI replaying `onTransition` would hit the same assertion.

**Fix:** Make the emitted stream a legal walk. Cleanest: keep `phase = 'verifying'` after the restore (don't rewind `phase` to the captured `'executing'`) and add `'replanning'` to `verifying`'s legal targets in `harness.ts:136` — then the emitted `verifying → replanning` edge is legal and the internal machine and the observer agree. Update the `LEGAL_TRANSITIONS` test expectations accordingly, and add a test that runs the orchestrator's recorded phases through `transitionAssert`.

## Info

### IN-01: `status: 'aborted'` is never produced — the hook's aborted branch is unreachable

**File:** `src/components/pages/useStreamingLLM.ts:180-183`; `src/core/ai/AgentOrchestrator.ts:188`

The orchestrator never returns `status: 'aborted'` — abort always throws `AbortError` (line 188, and inside `waitForAbortOrResume`), which the hook catches at line 189 and maps to `idle`. The `result.status === 'aborted'` branch (and the 'aborted' member of the outcome union, exercised only by the mocked `useStreamingLLM.test.tsx:275-276`) is dead in production. Harmless but misleading; either document that abort travels as a rejection, or delete the branch.

### IN-02: `hasUnverifiedSideEffects` is exported but never used (src or tests)

**File:** `src/core/ai/RendererService.ts:124-130`

The function implements the "missing evidence" check the renderer guard would need, but `render()` uses `evidenceDoneTools` directly (line 145). Dead export; remove or wire it in.

### IN-03: `ask_clarification` in production leaves the turn suspended indefinitely

**File:** `src/core/ai/AgentOrchestrator.ts:422-436`

`waitForAbortOrResume` never resolves (`void resolve;` is dead code) and there is no resume path until Phase 8. The planner *can* emit `ask_clarification` today; the user then sees a permanently-`streaming` turn with no way to answer, recoverable only by a new send (which aborts the previous). Documented as a seam, but worth a debugLog note or a phase guard so production planners don't emit it.

### IN-04: Redundant casts on checkpoint restore

**File:** `src/core/ai/AgentOrchestrator.ts:261`; `src/core/ai/CheckpointRecorder.ts:33`

`restored` is already `LoopState` — the `as LoopState` cast is redundant, and `LoopState.phase` being `string` forces an unchecked `as AgentTrajectoryPhase` cast. Type `phase` as `AgentTrajectoryPhase` in `LoopState` (capture only ever stores `'executing'`) and drop both casts.

### IN-05: The 'verifying' phase is recorded without verification actually happening

**File:** `src/core/ai/AgentOrchestrator.ts:243, 247`

`emit('verifying')` fires after every tool execution, but `buildOutcome` runs only at `finish()`; a successful tool result immediately transitions `verifying → planning` with the verifier never consulted, and a tool that later fails postcondition verification at `finish` is recorded in the stream as having passed `verifying`. The safety property holds (terminal authority), but the recorded phase semantics are misleading for a future trajectory UI. Either run lightweight per-tool verdicts at the transition or rename/document the phase as "post-execution".

### IN-06: `replannedTools` keyed by toolName only — `replan_identical_failure` fires for any second failure, even a different error code

**File:** `src/core/ai/AgentOrchestrator.ts:254, 284-285`

D-3a-12 defines "identical" as same `toolName` + same error `code`; the Set keys on `toolName` alone, so a second failure with a *different* code is still terminal with reasonCode `replan_identical_failure`. This is the conservative reading of D-3a-11 ("at most one replan per failed tool") and is fail-safe, but the reasonCode overstates "identical" — consider keying on `toolName|code` and using a distinct reasonCode for "replan budget exhausted" so diagnostics aren't misleading.

### IN-07: `spawn-sync@1.0.15` build scripts enabled

**File:** `pnpm-workspace.yaml:3-5`

`allowBuilds` now allows `spawn-sync` (pulled transitively by `fx-runner` ← web-ext). `spawn-sync` is a deprecated/abandoned package with a checkered npm history (tarball unpublish/registry confusion). It is a legit transitive chain here, but confirm nothing newer replaces it before the next dependency bump; at minimum pin/verify its integrity in the lockfile.

---

_Reviewed: 2026-08-12_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
