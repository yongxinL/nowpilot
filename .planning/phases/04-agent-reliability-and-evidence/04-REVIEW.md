---
phase: 04-agent-reliability-and-evidence
reviewed: 2026-08-29T10:45:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - package.json
  - src/components/chat/useChatStreaming.ts
  - src/core/ai/AgentOrchestrator.ts
  - src/core/ai/OutcomeVerifier.ts
  - src/core/ai/trajectory.ts
  - src/core/ai/types.ts
  - src/types/harness.ts
  - tests/core/ai/AgentOrchestrator.test.ts
  - tests/core/ai/OutcomeVerifier.test.ts
  - tests/core/ai/trajectory/TrajectoryTracker.test.ts
  - tsconfig.json
  - vitest.config.ts
findings:
  critical: 1
  warning: 4
  info: 5
  total: 10
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-08-29T10:45:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the Phase-4 Agent Reliability & Evidence implementation: the canonical C.1 types (`src/types/harness.ts` — verbatim match to spec 4849-4876), `TrajectoryTracker` with the closed `TRAJECTORY_TRANSITIONS` table, `OutcomeVerifier` (`buildOutcome` verbatim to Appendix O.2, `guardMissingEvidence`, `VerifierRegistry`), the `AgentOrchestrator` rewiring (trajectory hooks, replan/terminal policy, boundary abort conversion, D-65 guard wiring), the `types.ts` evidence seam, and the `useChatStreaming` `status === 'aborted'` branch.

**Verification performed:**
- All 29 tests in the three test files pass (`pnpm vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts tests/core/ai/AgentOrchestrator.test.ts`).
- `pnpm exec tsc --noEmit` clean (strict mode, NP_STRICT_CEILING 0).
- The closed trajectory table was traced against **every** orchestrator code path: the loop-top hooks, the `finish()` normalization (executing→verifying, assembling-context→planning, replanning→planning), the failure/replan policy (executing→replanning), the renderer path (planning→rendering→completed/failed), the configuration-required path, and all 8 abort edges (pre-aborted, mid-planner, mid-route, mid-executor, mid-verifier, mid-renderer, boundary, post-terminal). No illegal transition is reachable in normal flow.
- The `@/*` alias re-point (`./*` → `./src/*` in tsconfig + vitest) is safe: `@/types/harness` is the only alias import in the codebase.
- No `console.log`, `@ts-ignore`, `as any` (in src), TODO/FIXME, or hardcoded secrets in the reviewed source files. All logging goes through `debugLog` with no API keys in payloads.

The one BLOCKER is in the phase's headline feature (04-04 abort conversion): the boundary catch matches on exception **type** rather than **signal state**, which both violates the module's own T-4-11 invariant and can crash inside the catch. The warnings cover evidence-spoofing gaps in the D-65 guard and verifier error handling.

## Critical Issues

### CR-01: Boundary abort conversion matches on exception type, not signal state — stray `AbortError` masquerades as a user abort; crash-in-catch on terminal phases

**File:** `src/core/ai/AgentOrchestrator.ts:582-593`
**Issue:** The boundary catch converts to the 'aborted' outcome whenever `err instanceof DOMException && err.name === 'AbortError'`, with **no check that `input.abortSignal.aborted` is actually set**. The comment on line 582 states the invariant — "only the caller-signal abort converts… an internal failure can never masquerade as a user abort (T-4-11)" — but the implementation does not verify the signal. Two concrete failure modes:

1. **Internal AbortError masquerades as a user abort.** `DOMException('AbortError')` is the standard rejection shape of an **aborted IndexedDB transaction** (the `idb` package surfaces it verbatim). `persistTurn` → `persistChatTurn` → `openWriteJournalDB`/`runJournaled` (all IndexedDB, awaited at lines 406-411 **inside** the try) is a live source of exactly this error type. A storage abort would be silently reported to the user as "Generation stopped" (the `status === 'aborted'` branch in `useChatStreaming`), and the genuine failure — including the completed turn's persisted state — is swallowed. The same applies to any provider/dependency that throws a stray `AbortError`.

2. **Crash inside the catch.** `persistTurn` is awaited *after* `trajectory.enter(effectiveStatus === 'failed' ? 'failed' : 'completed')` (line 390). If the persist seam throws `AbortError` at that point, the catch calls `trajectory.enter('aborted')` (line 593) **from a terminal phase** — `TRAJECTORY_TRANSITIONS['completed']` and `['failed']` are both `[]` — which throws `illegal trajectory transition: completed -> aborted` *inside* the catch, replacing the original error and crashing the turn with a confusing message.

The pre-aborted-signal test (case e1) only exercises the signal-aborted path; no test covers a stray `AbortError`.

**Fix:** Gate the conversion on the signal state, not the exception type:
```ts
if (input.abortSignal.aborted && err instanceof DOMException && err.name === 'AbortError') {
  // ... existing conversion ...
}
// Defensive: never enter 'aborted' from a terminal phase (a stray AbortError
// past the terminal enter must rethrow unchanged).
if (trajectory.phase === 'completed' || trajectory.phase === 'failed') throw err;
```
The second guard also covers the persist-seam case: the turn had already reached its honest terminal, so the outcome stands and the real error propagates to the caller's catch (`useChatStreaming` line 265) instead of being mislabeled an abort.

## Warnings

### WR-01: D-65 guard is a presence check on attacker-controlled data — fabricated `evidence` defeats the AGT-02 protection

**File:** `src/core/ai/OutcomeVerifier.ts:100-102`
**Issue:** `guardMissingEvidence` treats *any* `evidence` object on an `ok === true` result as satisfying the postcondition — it validates **presence only**, never provenance. `ToolExecutionResult.evidence` is set by the executor/tool layer (spec 4339), which is exactly the layer the guard is meant to distrust (R-8: "skips the verifier and marks a write done"). A tool (or a compromised execution path) that stamps `evidence: { ok: true, postconditionId: 'anything', ... }` on its result defeats the guard completely and gets a clean 'completed' — the false-completion hole AGT-02 exists to close, now bypassable by fabrication. This is vacuous in Phase 4 (zero tools, D-64/D-46) but is the standing guarantee for Phase 18 (TOL-03).

**Fix:** Cross-check the evidence against the registered verifier's identity (TOL-03) rather than mere presence:
```ts
return results.some(
  (r) =>
    r.ok === true &&
    verifiers[r.toolName] !== undefined &&
    (r.evidence === undefined ||
      r.evidence.postconditionId !== verifiers[r.toolName].postconditionId),
);
```
Optionally also require `r.evidence.operationId` to match the turn's operationId.

### WR-02: D-65 guard override masks genuine failures and emits self-contradictory outcomes

**File:** `src/core/ai/AgentOrchestrator.ts:380-386`
**Issue:** The guard is the unconditional final word over `built.status` — including when `buildOutcome` computed **'failed'** (a registered verifier returned `ok: false`) or when a policy terminal fired (`repeated_failure`/`replan_exhausted`). In those cases the outcome is downgraded to `'partial'` / `reasonCode: 'missing_evidence'` while the `evidence` array still carries the verifier's `ok: false` entries. A genuine postcondition failure — the *most* important failure to report honestly — is reported as "partial, missing evidence", and the failure cause is invisible except by inspecting the evidence array. The same override also discards the `cap_exhausted` reason when a cap hit coincides with the guard firing. The result is a reasonCode that can contradict the evidence payload it ships alongside (`missing_evidence` with `evidence: [{ok: false}]`, or `{ok: true}`).

**Fix:** The guard should only override a *clean success*, never a computed failure — failures already carry their honest signal:
```ts
const effectiveStatus: AgentTurnOutcome['status'] =
  guardMissing && built.status !== 'failed'
    ? 'partial'
    : policyTerminal
      ? 'failed'
      : built.status;
const effectiveReasonCode =
  guardMissing && built.status !== 'failed' ? 'missing_evidence' : capHit ? 'cap_exhausted' : reasonCode;
```
This preserves the D-65 downgrade for the false-completion case (test (j) case 1 still passes) while never masking a real `failed`.

### WR-03: A throwing verifier kills the whole turn with an unhandled error instead of a typed failure

**File:** `src/core/ai/OutcomeVerifier.ts:40`
**Issue:** `const outcome = await v.verify(r)` is unguarded. A verifier that throws (network error during postcondition check, unexpected result shape, bug in the verifier) propagates through `buildOutcome` → `finish()` → the boundary catch → rethrow → `useChatStreaming`'s catch surfaces a generic "Generation failed" toast, and the turn's honest failure status is never computed. The whole evidence framework should be fail-safe: a verifier crash on one tool must not erase the turn's outcome. Only injected fixtures (D-67) exist today, but Phase 18 registers real verifiers against live side effects — exactly when verifiers are most likely to fail.

**Fix:**
```ts
let outcome: { ok: boolean; detail?: string };
try {
  outcome = await v.verify(r);
} catch (err) {
  outcome = {
    ok: false,
    detail: `verifier crashed: ${err instanceof Error ? err.message : String(err)}`,
  };
}
```
A crashed verifier then yields `postcondition_failed` / status 'failed' — the honest outcome.

### WR-04: `handleStopGenerating` double-fire appends the stopped note twice and toasts twice

**File:** `src/components/chat/useChatStreaming.ts:295-304`
**Issue:** `handleStopGenerating` has no re-entry guard. `setIsGenerating(false)` is synchronous but React batches the re-render — a fast double-click on the stop button fires `onClick` twice against the same rendered button. Each invocation calls `abortControllerRef.current.abort()` and `updateLastAssistantMessage('\n\n*(Generation stopped by user)*', '', true)`, which **appends** (the store does `lastMsg.content += contentChunk`, `useExtensionStore.ts:270`). Result: the final message carries two stacked "(Generation stopped by user)" notes and the user sees two info toasts. The stale-controller risk is latent here too — the ref is never reset to null after a turn, though the UI's `isGenerating &&` gate (SidepanelChat.tsx:462) currently prevents stop clicks outside a turn.

**Fix:**
```ts
const handleStopGenerating = () => {
  if (!isGenerating || !abortControllerRef.current) return;
  ...
};
```

## Info

### IN-01: 'partial' (cap-exhausted) turns enter terminal trajectory phase 'completed'

**File:** `src/core/ai/AgentOrchestrator.ts:390`
**Issue:** `trajectory.enter(effectiveStatus === 'failed' ? 'failed' : 'completed')` maps status 'partial' onto phase 'completed'. A consumer reading `outcome.trajectory.phase` alone (without `status`) misreads a cap-exhausted turn as fully completed. Documented ("the 'partial' honesty lives on the outcome status") but semantically loose — the C.1 union has no 'partial' phase, so this is a design tension worth a comment at the call site or a future C.1 amendment.

### IN-02: Defensive `AbortError` catch branch in `useChatStreaming` is now unreachable

**File:** `src/components/chat/useChatStreaming.ts:273-276`
**Issue:** Since 04-04, `runAgentTurn` converts every caller-signal abort to the returned 'aborted' outcome at the boundary; only `ProviderError`/routed errors rethrow, never `DOMException('AbortError')`. The catch branch is documented as defensive, but it is dead code in the current wiring — unless CR-01's stray-AbortError path (fixed per that recommendation) starts rethrowing them, in which case this branch's `setIsGenerating(false); return;` would correctly swallow them. Recommend keeping it only while the CR-01 fix is pending, then deleting or converting it to a `debugLog`.

### IN-03: Cap-exhausted turns pass through the 'verifying' phase without any verification

**File:** `src/core/ai/AgentOrchestrator.ts:280-281`
**Issue:** The `finish()` normalization routes `executing → verifying` whenever the loop-top cap check fires after a tool execution, but no postcondition verification runs on that path — the machine passes through 'verifying' purely to satisfy the closed table's forward-edge rule. Harmless today (the table is the source of truth) but the emitted snapshot implies a verification step that never occurred.

### IN-04: `buildOutcome` re-runs verifiers even when the result already carries evidence

**File:** `src/core/ai/OutcomeVerifier.ts:37-49`
**Issue:** When the executor stamps `r.evidence` (the seam the guard checks), `buildOutcome` runs `v.verify(r)` a second time and pushes a fresh evidence entry. For Phase 18 verifiers that are themselves side-effecting (re-reading state, re-checking a write), this is a double verification. The framework should skip re-verification when `r.evidence` is present and reconcile both paths (currently the two evidence records would diverge if the re-verification outcome differs from the stamped one).

### IN-05: `verify:phase-4` scope redundancy

**File:** `package.json:21`
**Issue:** `vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts tests/core/ai` — the trailing `tests/core/ai` directory scope subsumes the two explicit file scopes (they run twice) and broadens the gate to **all** Phase-3 AI tests (planner/executor/persona/router suites), so a Phase-3 regression would fail the Phase-4 gate. The spec's gate (spec line 3608) is just the two explicit scopes plus the orchestrator test: `vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts tests/core/ai/AgentOrchestrator.test.ts`.

---

_Reviewed: 2026-08-29T10:45:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_