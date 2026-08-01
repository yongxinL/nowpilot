---
phase: 03a-agent-reliability-evidence
status: issues
depth: standard
reviewed: 2026-08-01T10:56:00Z
files_reviewed: 17
files_reviewed_list:
  - src/core/ai/types.ts
  - src/core/ai/PipelineError.ts
  - src/core/ai/AgentTurnOutcome.ts
  - src/core/ai/AgentTrajectoryMachine.ts
  - src/core/ai/ExecutorService.ts
  - src/core/ai/verifier/VerifierTypes.ts
  - src/core/ai/verifier/OutcomeVerifier.ts
  - src/core/ai/ReplanPolicy.ts
  - src/core/ai/RenderingOutcomePolicy.ts
  - src/core/ai/AgentOrchestrator.ts
  - src/core/ai/PlannerService.ts
  - src/core/ai/RendererService.ts
  - src/core/ai/ProviderRouter.ts
  - src/core/context/ContextOptimizer.ts
  - src/core/context/ContextCompressor.ts
  - tests/security/agent-harness.test.ts
  - package.json
findings:
  critical: 0
  warning: 7
  info: 4
  total: 11
---

# Phase 03a: Code Review Report

**Reviewed:** 2026-08-01T10:56:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues

## Summary

Reviewed all 17 Phase 3a source files at standard depth: the D-04 trajectory state machine, AgentTurnOutcome contract, ExecutorService idempotency ledger, OutcomeVerifier/VerifierTypes, ReplanPolicy, RenderingOutcomePolicy, the rebuilt AgentOrchestrator state machine, abort propagation through ProviderRouter/ContextOptimizer/ContextCompressor, the STRIDE security suite, and the `verify:phase-3a` gate. All 209 gate tests pass (spot-verified: 70 tests across the orchestrator/security/verifier suites).

The core reliability machinery is genuinely solid: the allowlist FSM is exhaustive and correctly enforces the `executing/verifying → replanning → planning` loopback, abort finalization is idempotent, the one-replan budget and irreversibility/unknown-state replay protection hold under trace, evidence redaction (checks/diagnostics/observations) is effective, and the gate is non-vacuous. No BLOCKER-level defect was found.

The highest-risk issues are the two LLM call sites that pass `signal` instead of ai SDK v7's `abortSignal` (renderer + planner), so a user abort does not cancel the final provider requests (cost/latency exposure the phase's own T-03a-29 control targets), followed by four semantic/defense-in-depth gaps: partial outcomes recorded as trajectory `completed`, `attachEvidence` not validating `evidence.toolCallId`, fail-open permission behavior when no callback is wired, and a `completion_unverified` reason code for cap-exhausted *verified* writes.

## Warnings

### WR-01: `RendererService.synthesize` passes `signal` instead of `abortSignal` — renderer LLM request is never cancelled on abort

**File:** `src/core/ai/RendererService.ts:74`
**Issue:** `generateText` receives `...(signal ? { signal } : {})`. The installed `ai@7.0.42` runtime reads `options.abortSignal` only and silently drops `signal` (verified in `node_modules/ai/dist/index.js`; the phase's own 03a-04 summary documents this for ContextCompressor). Because `synthesize()` awaits `generateText` without cancellation, a user abort during final rendering does not stop the most expensive call of the turn: the orchestrator's post-await `signal.aborted` check (AgentOrchestrator.ts:264) eventually returns an aborted outcome, but only after the provider finishes the full generation — consuming tokens/quota and adding tens of seconds of latency. This violates the phase's own T-03a-29 cancellation control for the renderer call site. Note the asymmetry: `stream()` (RendererService.ts:102) correctly passes `abortSignal`, and the 03a-04 summary's claim that "Plan 03 RendererService … already passed `abortSignal`" is only true for `stream()`.
**Fix:**
```ts
const { text } = await generateText({
  model,
  messages: buildMessages(decision, optimized, systemPrompt),
  ...(signal ? { abortSignal: signal } : {}),
});
```

### WR-02: `PlannerService.plan` passes `signal` instead of `abortSignal` — planner LLM request is never cancelled on abort

**File:** `src/core/ai/PlannerService.ts:142,149`
**Issue:** Both `generateText` call sites spread `{ signal }` into options, which ai SDK v7 silently ignores (same mechanism as WR-01). A mid-plan abort leaves the planner request running to completion; the orchestrator's post-await check preserves outcome correctness but not bounded cancellation. This is tracked as an open deferred item (`deferred-items.md`) with the fix explicitly scoped to "a future plan touching PlannerService" — but PlannerService is a Phase 3a-reviewed file and the defect is a Phase 3a reliability gap (AGT-03's end-to-end signal claim excludes exactly this call), so it warrants a finding here.
**Fix:**
```ts
...(signal ? { abortSignal: signal } : {}),
```

### WR-03: Partial outcomes end the trajectory at state `completed` — trajectory/outcome contradiction for capped and failed turns

**File:** `src/core/ai/AgentOrchestrator.ts:271`
**Issue:** `renderAndFinish` maps every non-`failed` terminal state to trajectory `completed` (`machine.transitionTo(terminalState === 'failed' ? 'failed' : 'completed', ...)`), and the D-04 machine has no `partial` state. Consequently every `partial` outcome — `tool_cap_reached`, `planner_cap_reached`, `tool_failed`, `completion_unverified` — carries a trajectory whose final entry says `completed`. An outcome whose reason code is `tool_failed` and terminal state `partial` is recorded as trajectory-completed; Phase 6 telemetry and Phase 7 stage indicators consuming `outcome.trajectory` will misreport capped/failed turns as successful completions. The schema (`AgentTurnOutcomeSchema`) has no cross-field refinement tying `terminalState` to the trajectory's final state, so this passes validation silently.
**Fix:** Map partial/failed outcome semantics explicitly — e.g. transition to `failed` (or a documented terminal marker) for `partial` terminal states, and add a schema refinement asserting the final trajectory entry is consistent with `terminalState`:
```ts
.refine((o) => {
  const last = o.trajectory[o.trajectory.length - 1]?.state;
  if (o.terminalState === 'partial') return last === 'completed' || last === 'failed';
  return true;
})
```

### WR-04: `attachEvidence` does not validate `evidence.toolCallId` against the recorded entry

**File:** `src/core/ai/ExecutorService.ts:262-280`
**Issue:** The seam validates only `entry.operationId === evidence.operationId` and `entry.toolName === evidence.toolName`. The `toolCallId` argument is used solely for ledger lookup — an evidence record carrying a *different* (forged) `toolCallId` is accepted, cached on the entry, and served to later completed-duplicates. The STRIDE suite (agent-harness.test.ts:261-281) tests spoofed operationId/toolName but not spoofed toolCallId; the phase's "exact operationId/toolCallId evidence association" control is therefore only half-enforced at the seam (policy-build-time matching in RenderingOutcomePolicy catches it downstream, but the seam itself is the documented trust boundary). Defense-in-depth gap.
**Fix:**
```ts
if (
  entry.operationId !== evidence.operationId ||
  entry.toolName !== evidence.toolName ||
  entry.toolCallId !== evidence.toolCallId
) {
  throw new PipelineError('TOOL_POSTCONDITION_FAILED', 'Evidence does not match the recorded tool call.', { toolCallId });
}
```
(Verifier flow always attaches immediately after execution, so `entry.toolCallId` equals `result.toolCallId` at attach time.)

### WR-05: Permission gate fails open when no `requestPermission` callback is supplied

**File:** `src/core/ai/AgentOrchestrator.ts:384-414`
**Issue:** For write/irreversible tools, the permission gate is consulted only `if (input.requestPermission)`; when the callback is absent, side-effecting tools transition straight to `executing` with no consent check. The phase enforces reliability *metadata* fail-closed (`buildRegisteredTools` throws `SCHEMA_INVALID` when sideEffect/idempotency/evidence are missing — AgentOrchestrator.ts:74-92), but the permission control — the actual authorization gate — silently auto-grants when a caller forgets to wire the callback. Given the STRIDE suite's elevation-of-privilege claims ("permission enforced before execution", agent-harness.test.ts:755-771) only ever test with the callback present, a production caller that omits it loses the entire consent control without any error or warning. Fail-open default for a security control.
**Fix:** Fail closed — reject side-effecting execution when no callback is provided (or require it at input validation):
```ts
if (isSideEffecting && !input.requestPermission) {
  return failTurn('pipeline_failed', 'PERMISSION_GATE_MISSING');
}
```
…or explicitly document the auto-grant semantics as a deliberate caller choice.

### WR-06: Verified writes at cap exhaustion are reported with reason code `completion_unverified`

**File:** `src/core/ai/ReplanPolicy.ts:72-74`, `src/core/ai/AgentOrchestrator.ts:493-528`
**Issue:** At the verification checkpoint, `evaluateReplan` returns `render` when `caps.toolCapReached` (the cap rule precedes the continue-planning rule, per the documented priority), and the orchestrator maps every `render` disposition from that checkpoint to `partial` + `completion_unverified`. Trace: FAST tier (toolCap 2), a write tool executes for the 2nd time, verification *succeeds* — `toolCalls` is already 2 → `toolCapReached` → `render` → outcome `partial`/`completion_unverified` with *verified* evidence in `outcome.evidence`. The outcome simultaneously claims the completion was unverified and carries verified evidence for it — misleading diagnostics for telemetry consumers (Phase 6) and users. The turn actually ended because the tool cap was exhausted.
**Fix:** At the verification checkpoint, distinguish cap-driven render from evidence-failure render — check `caps.toolCapReached`/`plannerCapReached` first and use `tool_cap_reached`/`planner_cap_reached` reason codes; only use `completion_unverified` when the evidence itself is unverified.

### WR-07: New public outcome contract embeds raw, unredacted tool output

**File:** `src/core/ai/AgentTurnOutcome.ts:187-193`, `src/core/ai/types.ts:209-224`
**Issue:** `AgentTurnOutcome.toolResults[].output` carries the full raw tool output (`output: z.unknown()` in the schema). Pre-phase `runTurn` returned a string, so this phase introduced the outcome record as the public contract — and while the redaction controls cover evidence checks, diagnostics, and recovery observations ("never raw tool output, secrets, or logical keys"), `toolResults[].output` is exempt by omission. Any tool returning secret-bearing output (e.g. a credentials/keyring tool) places that material inside the public outcome; Phase 6 telemetry persisting outcomes would inherit it. The disclosure STRIDE tests (agent-harness.test.ts:561-606) assert evidence/diagnostics only and never touch `toolResults`.
**Fix:** Either document the toolResults output boundary explicitly in the outcome contract (recommended: keep raw output out of any persisted projection), or add a redacted projection for outcome consumers:
```ts
// e.g. sanitize or omit `output` on the persisted/telemetry projection of AgentTurnOutcome
```

## Info

### IN-01: Duplicated strict evidence-check schema

**File:** `src/core/ai/verifier/VerifierTypes.ts:16-25`, `src/core/ai/AgentTurnOutcome.ts:132-141`
**Issue:** Two structurally identical `CompletionEvidenceCheckSchema` definitions exist (one module-private in AgentTurnOutcome, one exported in VerifierTypes). Drift risk: a future field added to one (e.g. a new check field) would silently desynchronize verification-time validation from outcome-time validation. The 03a-02 summary documents VerifierTypes as the contract owner — export it from there and import it in AgentTurnOutcome.
**Fix:** `import { CompletionEvidenceCheckSchema } from './verifier/VerifierTypes'` in AgentTurnOutcome.ts, delete the private copy.

### IN-02: Idempotency ledger never evicts entries

**File:** `src/core/ai/ExecutorService.ts:93-95`
**Issue:** The `ledger` Map (keyed `op:…;tool:…;input:…`) retains every executed call's result and evidence for the service lifetime — "operation-scoped" is true for dedup semantics (fresh operationId ⇒ fresh key) but not for retention. A long-lived extension session accumulates unbounded entries across turns, including retained raw tool outputs (cf. WR-07). Consider evicting entries whose operationId differs from the current one, or capping the ledger size.
**Fix:**
```ts
// on execute() with a new operationId: prune entries for other operationIds
for (const [k, e] of this.ledger) if (e.operationId !== operationId) this.ledger.delete(k);
```

### IN-03: Permission request carries a throwaway `toolCallId` that never matches the executed call

**File:** `src/core/ai/AgentOrchestrator.ts:392`
**Issue:** `requestPermission` receives `toolCallId: crypto.randomUUID()`, but the executor generates a *different* id for the actual execution. A permission callback that records the granted decision's toolCallId for audit/correlation can never match it to the outcome's evidence or toolResults. Either derive the call id before the permission request and pass it through execution, or document the field as advisory.
**Fix:** Generate `toolCallId` once before the permission request and supply it to `executorService.execute` (e.g. via an optional explicit-id parameter), or drop the field from `PermissionRequest`.

### IN-04: AbortSignal not forwarded on fallback paths

**File:** `src/core/ai/ProviderRouter.ts:220`
**Issue:** `executeWithFallback` calls `this.selectProvider(providerId)` without the signal, and `getCompressionModel()` (which ContextCompressor passes the signal into) ignores it. Both are currently covered by boundary post-await checks (the compressor checks `signal` before/after the provider await), so no observable defect today — but the phase's own "every awaited operation receives the shared signal" contract is incomplete on these two paths, and a future refactor could silently rely on cancellation that never reaches them.
**Fix:** Thread `signal` into `selectProvider` from `executeWithFallback` and accept/check `signal` in `getCompressionModel(signal?)`.

---

_Reviewed: 2026-08-01T10:56:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
