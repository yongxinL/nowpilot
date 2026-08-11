---
phase: 03-cost-effective-ai-runtime-persona-seed
reviewed: 2026-08-11T09:30:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - src/core/ai/ProviderRouter.ts
  - src/core/ai/RendererService.ts
  - src/core/ai/StructuredOutput.ts
  - src/core/error/TimeoutError.ts
  - tests/core/ai/ProviderRouter.test.ts
  - tests/core/ai/RendererService.test.ts
  - tests/core/ai/RendererService.streamBreakdown.test.ts
  - tests/core/ai/StructuredOutput.timeoutRetry.test.ts
  - .planning/phases/03-cost-effective-ai-runtime-persona-seed/03-15-PLAN.md
  - .planning/phases/03-cost-effective-ai-runtime-persona-seed/03-16-PLAN.md
  - .planning/phases/03-cost-effective-ai-runtime-persona-seed/03-15-SUMMARY.md
  - .planning/phases/03-cost-effective-ai-runtime-persona-seed/03-16-SUMMARY.md
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 3: Code Review Report — Gap-Closure Fixes (03-10 .. 03-14) + Post-Gap-Closure Review (03-15/03-16)

**Reviewed:** 2026-08-11T09:30:00Z
**Depth:** deep (cross-file trace through AgentOrchestrator, PlannerService, ai@4 SDK types)
**Files Reviewed:** 12 (4 src + 4 test + 4 planning docs)
**Status:** issues_found

## Summary

This document retains the full historical review of the five gap-closure plans (03-10..03-14) and adds a fresh adversarial pass over the **03-15/03-16** gap-closure fixes below.

**Post-gap-closure round (this pass):** Plans 03-15 (WR-02A — live streaming-path breaker) and 03-16 (WR-03A — D-17 timeout retry on the production path) were reviewed end-to-end. **Both defects are functionally closed**: `BREAKER_VOTES.STREAM_FAILED = 1` + classifier-mapped catch voting make the streaming breaker live (verified by the real-Router `streamBreakdown` suite); the carrier-as-abort-reason + `isTimeoutError(signal.reason)` recovery + per-attempt fresh derived controller make the timeout retry real (verified by the end-to-end `timeoutRetry` suite). All 53 tests across the four touched suites pass in this review run; the trace from `StructuredOutput.attempt` → router closure → D-17 retry → ledger was verified against the production arrival pattern (SDK drops the abort reason; Chrome DOMException is not `instanceof Error`). No new critical defects were found in the fixes. Two warnings and two info items are recorded — see the post-gap-closure section.

**Verdict per fix (historical, pre-fix state):**

- **CR-01 — correctly and completely closed.** `retryCount` increments only on the D-17 retried call (`isRetry=true`); both budget gates (`createStageInvocation` + inner `attempt()`) read `retryCount`; legitimate sequential stage calls and structured-output repairs never consume the budget; `attemptCount` removal leaves no stale references (grep-verified). The permanent orchestrator regression (real Router + real budget + real tier resolver) proves a medium-tier 2-tool turn completes with `reasonCode: 'success'`, the renderer runs, and `retryCount === 0`; the D-17 retry case consumes exactly 1. The unit budget test correctly terminates on the budget gate (not chain exhaustion).
- **WR-01 — correctly and completely closed.** `hasActiveProvider()` is any-usable (`enabled && !keyUnreadable` over all entries); `registerActiveProvider` has **zero production callers** (grep-verified — only the definition in ProviderRegistry.ts), so the entry-based behavior change is safe; the 4 new gate cases + re-asserted legacy test pin it; the 7 shell-gate fixtures were converted to real `registerProvider` entries (25/25 shell tests pass).
- **WR-04 — correctly and completely closed.** The footer gate (`m.id === messages[messages.length - 1]?.id && (m.status === 'failed' || m.status === 'offline')`) renders Retry only on the current turn's bubble; `handleRetry`'s last-message targeting is now sound; the 3 regression tests pin stale-bubble inertness, latest-bubble recovery, and replace-only-latest. No state hazard (gate lives in the `useMemo` with `messages` in deps; empty-list `?.` is safe).
- **WR-02 — was partially closed; fully closed by 03-15.** The first-token freeze is correctly wired exactly once per render (`firstTokenMarked`), making the §1.5 `stream_frozen` guard reachable; the catch/non-stop branches are mutually exclusive (no double-vote); the `isAbortError` name-match guard (prototype-chain-agnostic) correctly excludes user aborts. The residual inert-breaker defect is documented below as **WR-02A** and **resolved by 03-15**.
- **WR-03 — was partially closed; fully closed by 03-16.** The `TimeoutError` carrier is correctly produced (timedOut flag set before `ac.abort()`), the classifier maps it to `TIMEOUT`/retryable before the abort branch, user cancels stay `AbortError`/UNKNOWN (never conflated), and a planner timeout now surfaces the visible `planner_failed` fallback answer instead of a silent idle. The residual never-firing-D-17-retry defect is documented below as **WR-03A** and **resolved by 03-16**.

**Carry-forward:** WR-05/WR-06/WR-07 and IN-01..IN-05 from the prior review were **not** part of the five gap-closure plans (nor of 03-15/03-16) and remain open; they are carried forward below so they are not lost in this overwrite. IN-06 (instanceof `isAbortError`) was **not** removed by 03-16 despite the summary's claim — see the post-gap-closure section, where it is re-raised as a warning.

## Warnings (historical, pre-gap-closure)

### WR-02A: The breaker vote is inert — `STREAM_FAILED` is absent from `BREAKER_VOTES`, so streaming failures still never open the breaker

**File:** `src/core/ai/ProviderRouter.ts:186-195` (`BREAKER_VOTES`) + `src/core/ai/RendererService.ts:128-132,146` (call sites)

**Issue:** `RendererService` now calls `getProviderRouter().recordFailure(providerId, ERROR_CODES.STREAM_FAILED, ...)` on every provider-originated streaming failure — but `voteBreaker` computes `BREAKER_VOTES[code] ?? 0` and **early-returns on 0**. `STREAM_FAILED` has no entry in `BREAKER_VOTES` (which only covers the §20.10 pre-first-token codes), so every streaming failure votes **0** and the provider's breaker can never open from mid-stream failures. The VERIFICATION.md WR-02 observable consequence — "a provider failing mid-stream accrues no breaker votes and is retried every turn" — is unchanged after the fix. The regression tests do not catch this: `RendererService.test.ts` mocks the Router (`routerMock.recordFailure`) and asserts only that `recordFailure` **was invoked**, never that a vote accrued or the breaker state changed. The `recordFailure` JSDoc ("a mid-stream/stream failure votes the provider's breaker") and the 03-12 SUMMARY claim ("a provider failing mid-stream now accrues breaker votes") assert an effect the implementation does not produce.

**Fix:** Give streaming failures a real vote. Either (a) add `STREAM_FAILED: 1` to `BREAKER_VOTES`, or (b) classify the underlying error in the catch branch and pass its code (e.g. `NETWORK`/`PROVIDER_5XX` → vote 1) while keeping `STREAM_FAILED` for the no-error non-stop branch. Then extend `RendererService.test.ts` with a test that drives a real `ProviderRouter` (not the mock) through 3 `STREAM_FAILED` failures and asserts `isBreakerOpen(providerId) === true`.

**RESOLVED by 03-15** (both halves implemented: `BREAKER_VOTES.STREAM_FAILED = 1` at ProviderRouter.ts:203 and classifier-mapped catch voting at RendererService.ts:132-134; pinned by `RendererService.streamBreakdown.test.ts`, 4 real-Router breaker-STATE tests). Verified green in this review run.

### WR-03A: The D-17 retry on TIMEOUT never fires on the production path — the carrier is born after the router's retry decision

**File:** `src/core/ai/StructuredOutput.ts:89-107` + `src/core/ai/ProviderRouter.ts:611-661` + `tests/core/ai/ProviderRouter.test.ts:354-373`

**Issue:** The WR-03 summary claims "the D-17 retry fires exactly once" on a timeout (T-03-11-02), but the production timeout flow cannot reach the retry:

1. `StructuredOutput.attempt` fires the per-attempt `setTimeout` → `timedOut = true; ac.abort()`.
2. Inside the router closure, the SDK rejects with a **bare `AbortError`** (the per-attempt signal aborted). `classifyProviderError` maps it to `{ code: 'UNKNOWN', retryable: false }` — not retryable, no breaker vote (UNKNOWN votes 0). The D-17 branch is never taken.
3. The `TimeoutError` carrier is only created **after** the closure's retry decision, in `attempt`'s catch (`if (timedOut) throw timeoutError(...)`).

The unit test "retries EXACTLY once on a TimeoutError carrier" passes `timeoutError(3_000)` as the **`generateObject` mock rejection** — an arrival pattern production never produces (`timeoutError()` is the only TimeoutError creation site, and it runs outside the router closure). Additionally, even if a TimeoutError did reach the closure, the D-17 retry would call `attempt(true)` with the **same already-aborted per-attempt signal** — the retried call would reject immediately with AbortError, i.e. a futile retry that still consumes `retryCount` and can never succeed by construction. So the timeout path still consumes zero retries and never votes the breaker (`BREAKER_VOTES.TIMEOUT = 1` is equally unreachable). The primary WR-03 goal **is** achieved (timeout → `planner_failed` fallback answer via `planOnce`, never a silent idle; user cancels stay `AbortError`/idle), but the D-17-retry-on-timeout claim is satisfied only by test injection.

**Fix:** Either (a) accept the fallback-answer semantics and correct the summary/test framing (rename the unit test to document that the carrier's production path bypasses the router retry), or (b) make the router closure timeout-aware — wrap the incoming signal in the closure so a timeout-origin rejection surfaces as the carrier *inside* the retry decision point (and give the retried call a fresh, non-aborted signal), then assert the retry end-to-end through `StructuredOutput.attempt` + real Router.

**RESOLVED by 03-16** (option (b): `ac.abort(timeoutError(ctx.timeoutMs))` at StructuredOutput.ts:102; `isTimeoutError(signal.reason)` recovery + per-attempt fresh derived controller at ProviderRouter.ts:639-701; pinned end-to-end by `StructuredOutput.timeoutRetry.test.ts`). Verified green in this review run.

### WR-05 (carry-forward, not closed by these plans): `useStreamingLLM` never aborts on unmount — in-flight turns keep billing after navigation

**File:** `src/components/pages/useStreamingLLM.ts:105-108`

**Issue:** Still open. The only `useEffect` wires the ChunkBuffer flush listener and returns its unsubscribe; nothing calls `abortRef.current?.abort()` on cleanup. Closing the panel / navigating away unmounts ChatPage while `runAgentTurn` continues to completion and tokens keep billing. Not in the five gap-closure plans' scope.

**Fix:**
```ts
useEffect(() => {
  if (!bufferRef.current) bufferRef.current = createChunkBuffer();
  const unsubscribe = bufferRef.current.onFlush(setText);
  return () => {
    unsubscribe();
    abortRef.current?.abort();
  };
}, []);
```

### WR-06 (carry-forward, not closed by these plans): ChunkBuffer `flushNow()`/`reset()` cancel a `setTimeout` id with `cancelAnimationFrame` in degraded mode

**File:** `src/core/ai/ChunkBuffer.ts:33-41,55-71`

**Issue:** Still open (verified in current source). When the 8,000 B/s throttle engages, `rafId` holds a `setTimeout` id, but `flushNow()`/`reset()` call `cancelAnimationFrame(rafId)` — a no-op for timeout ids — so the pending 33 ms timer can fire after `reset()` and flush the next turn's buffer (cross-turn text contamination). Not in the five gap-closure plans' scope.

**Fix:** Track the timer kind, or cancel both:
```ts
if (rafId !== null) {
  if (timerIsRaf) cancelAnimationFrame(rafId as number);
  else clearTimeout(rafId as number);
  rafId = null;
}
```

### WR-07 (carry-forward, not closed by these plans): ~300 lines of bootstrap/AI-runtime wiring duplicated verbatim across the two entrypoints

**File:** `src/entrypoints/sidepanel/main.tsx:74-248` and `src/entrypoints/standalone/main.tsx:68-243`

**Issue:** Still open — `AI_PROVIDER_IDS`, `runStorageBootstrap()`, `warmOpenIdbStore()`, and `runAIRuntimeInit()` remain copy-pasted across both entrypoints. Not in the five gap-closure plans' scope.

**Fix:** Extract a shared module (e.g. `src/entrypoints/shared/aiRuntimeInit.ts`); each entrypoint keeps only its mount-specific root component.

## Info (historical)

### IN-01 (carry-forward): `streamTextToLLMChunks` (StreamAdapter) is dead code — no production callers

**File:** `src/core/ai/StreamAdapter.ts:49` — still no importer in `src/`. Either wire it or mark it `@implementation-tier`.

### IN-02 (carry-forward): `ILLMProvider.validateConfig()`/`chat()`/`getModels()` have no callers

**File:** `src/core/ai/ILLMProvider.ts:22-29` — `validateConfig` is never invoked; `chat()`/`getModels()` are throwing stubs. A comment documenting the dormant contract would prevent future implementers from assuming the wiring calls them.

### IN-03 (carry-forward): `PersonaInjector.inject()` has no production callers

**File:** `src/core/ai/persona/PersonaInjector.ts:53-62` — the hook uses `resolvePersona` + `buildPersonaBlock` directly; the stage-aware composition is dormant (Phase-5 seam).

### IN-04 (carry-forward): `get-provider-info` returns ALL providers, not the "Active provider" (§10.5 row 8)

**File:** `src/core/ai/ExecutorService.ts:67-72` — semantic mismatch only (apiKey correctly stripped); either narrow to the active provider or widen the tool description.

### IN-05 (carry-forward): `ProviderRegistry.getProviderInfo()` (singular) is unused

**File:** `src/core/ai/ProviderRegistry.ts:169-171` — all consumers use `getProviderInfos()` (plural); dead export or a future Phase-7 consumer.

### IN-06 (historical — superseded by post-gap-closure WR-01): inconsistent `isAbortError` implementations — ProviderRouter still uses the `instanceof` form the 03-12 plan itself flagged as broken in the test realm

**File:** `src/core/ai/ProviderRouter.ts:782-784` (pre-03-16 line numbers; now `:837-839`)

**Issue:** `classifyProviderError`'s abort branch is `err instanceof Error && err.name === 'AbortError'`, while the WR-02 fix (and AgentOrchestrator/useStreamingLLM) deliberately use the prototype-chain-agnostic name-match because DOMException is not `instanceof Error` in the jsdom realm. The test `'a user cancel (AbortError) stays UNKNOWN/never-retried'` passes only because the jsdom DOMException falls *through* the abort branch to the UNKNOWN fallthrough — so the test cannot distinguish the abort branch from the fallthrough. Production (Chrome, where DOMException IS `instanceof Error`) is correct, but the branch is untested-as-written. Align it with the canonical name-match:
```ts
return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
```

**Still open — re-raised as post-gap-closure WR-01 (03-16's summary falsely claims this conjunct was removed).**

### IN-07 (historical): plan-doc drift — WR-03 is attributed to 03-14 in the 03-13 SUMMARY and 03-14 SUMMARY

**File:** `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-13-SUMMARY.md:149`, `03-14-SUMMARY.md` tags

**Issue:** 03-13's "Next Phase Readiness" and 03-14's metadata describe 03-14 as covering "WR-03 TIMEOUT classification + WR-04 retry targeting"; WR-03 was actually closed by 03-11. Documentation-only drift; the implementation trail (commits `86fe69b`/`93dabfa`/`5548c3e`/`87f460a`) is unambiguous.

---

## Post-gap-closure review (03-15/03-16)

**Scope:** the WR-02A (streaming breaker) and WR-03A (timeout retry) fixes. Adversarial pass over `ProviderRouter.ts` (breaker table, `recordFailure`, the D-17 closure with the WR-03A recovery), `RendererService.ts` (catch/non-stop vote branches), `StructuredOutput.ts` (carrier-as-abort-reason), `TimeoutError.ts`, and the four test files, with cross-file traces through `AgentOrchestrator.runTurn`/`planOnce`/`finish` (double-vote and re-resolution analysis) and the ai@4 SDK (`LanguageModelV1FinishReason` — no `'aborted'` value exists in this version, so a user abort cannot resolve as a non-'stop' finish reason; the non-stop branch's unconditional vote is sound for the installed SDK).

**Verdict:** Both fixes are functionally correct and the regression suites genuinely pin the observable consequences (breaker STATE through a real Router; 2 SDK calls / retryCount 1 / ledger TIMEOUT / fresh retry signal through real `requestJson` + real Router). All 53 tests in the four suites pass in this review run. The D-17 retry on the production timeout path is real; the streaming breaker is live; no double-voting exists on the orchestrator path (the render catch is the only vote site for a render failure — `runAgentTurn`'s terminal catch does not classify or vote). No critical findings. The findings below concern accounting integrity on the streaming path and one false verification claim.

### WR-01: 03-16's self-check claims the `instanceof`-based `isAbortError` was removed — it is still in the module (IN-06 not closed; acceptance grep evaded by variable naming)

**File:** `src/core/ai/ProviderRouter.ts:837-839` (definition), `:529` (call site in `classifyProviderError`); false claim at `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-16-SUMMARY.md:168` and `03-16-PLAN.md` Task 1 acceptance (`grep -c "isAbortError(e)"` returns 0)

**Issue:** The 03-16 plan/summary assert the instance-of conjunct is "gone from the whole module". It is not: `function isAbortError(err) { return err instanceof Error && err.name === 'AbortError'; }` remains at L837-839 and `classifyProviderError` still uses it at L529. The acceptance grep was `isAbortError(e)` (lowercase `e`) — the call site passes `err` (`if (isAbortError(err))`), so the criterion passed vacuously without any removal. This reopens IN-06: in the jsdom test realm, a `DOMException` user abort is not `instanceof Error` and falls through to the UNKNOWN fallthrough (the user-abort test passes for the wrong reason — the branch is untested-as-written); the timeout-recovery guard (L672) is correctly environment-independent, but the classifier's abort branch retains the exact defect the 03-12 plan flagged. The behavior is coincidentally correct in both realms today (abort → UNKNOWN either way), so this is a verification-integrity + maintainability defect, not a live behavior bug — but the summary's claim should be corrected and the branch aligned with the canonical name-match used by `RendererService.ts:85-89` and `AgentOrchestrator.ts:204-210`.

**Fix:**
```ts
// ProviderRouter.ts:837-839
function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}
```
And correct the 03-16 SUMMARY self-check line (the "conjunct absent" claim is false as written).

### WR-02: Streaming-path failures never enter the D-14 attempt ledger — `recordFailure` is vote-only, so pre-first-token stream failures don't advance the fallback chain and can never engage the D-13 privacy gate

**File:** `src/core/ai/ProviderRouter.ts:557-559` (`recordFailure` — votes the breaker but does not push a `ProviderAttempt`; signature has no `operationId`), `:438-446` (`createStageInvocation`'s `failed` set and `lastFailed` derive solely from `state.attempts`), `src/core/ai/RendererService.ts:132-134` (the only vote site for render failures)

**Issue:** `RendererService.render`'s mid-stream catch and non-stop-finish branch call `recordFailure(providerId, code, err)`, which only votes the breaker. The D-14 ledger's `attempts` array — documented at ProviderRouter.ts:131-136 as "the OBSERVABILITY ledger (every SDK call)" — never receives the renderer's `streamText` call, success or failure. Consequences:

1. **Fallback-chain blindness:** a stream failure before the first token (`hasStreamedFirstToken` false — e.g. a connect-time rejection) adds no `failed` entry, so a subsequent `createStageInvocation` for the same operation re-resolves the **same dead provider** as the cheapest candidate instead of advancing the chain (the `failed`/`lastFailed` sets at L438-446 are empty). The breaker eventually opens after 3 such failures (WR-02A now works), but the first two re-attempts are wasted.
2. **D-13 gate gap:** `lastFailed` is undefined after a stream failure, so the `prefer-local` privacy refusal (L446) never triggers from a streaming failure — a local provider that dies mid-stream is not "known failed" to the traversal logic.
3. **Observability gap:** after a render failure the operation's ledger can show zero failed attempts, contradicting the interface contract.

The current orchestrator calls `render` once per terminal `finish()` and propagates failure, so the re-resolution paths are latent today — but the D-14 accounting contract is violated on the exact surface 03-15 modified, and any future re-render/retry flow inherits the blind spots.

**Fix:** Extend `recordFailure` (or add a sibling) to accept the `operationId` and push a `ProviderAttempt` (`{ outcome: 'failed', errorCode }`) into `state.attempts` before voting, e.g.:
```ts
recordFailure(operationId: string, providerId: ProviderId, code: ErrorCode, err?: unknown): void {
  this.recordAttempt(operationId, providerId, /* model */ '', 'failed', code);
  this.voteBreaker(providerId, code, err);
}
```
and update the renderer call sites to pass `input.operationId` (the renderer already receives it).

### IN-01: Post-timeout retry failures are masked as TIMEOUT — a provider 500 on the D-17 retry is recorded and surfaced as a timeout (accepted T-03-16-02, now cemented by test b)

**File:** `src/core/ai/ProviderRouter.ts:672-686`

**Issue:** Because the parent signal is permanently aborted-with-carrier after the first timeout, any failure of the D-17 retry — including a genuine provider 500 (`APICallError`) — is recovered by `isTimeoutError(signal.reason)` and rethrown as the carrier. The ledger records `errorCode: 'TIMEOUT'` for what was a 5XX, the breaker takes a TIMEOUT vote (same 1-vote weight, so no behavioral drift), and the user-visible error is "Timeout after Nms" rather than the actual 500. This is explicitly accepted in the 03-16 threat register (T-03-16-02), and `StructuredOutput.timeoutRetry.test.ts` test b now pins the masking as the contract. Flagging for the record: the D-14 ledger will carry wrong error codes for post-timeout retry failures, which will mislead future observability consumers (the ledger's `errorCode` is documented as the canonical C.2 code of the failure). If ledger accuracy matters later, the recovery guard could distinguish "retry failed with a classifiable error" from "retry aborted" by checking the retry's own rejection (`classifyProviderError(e)` first; fall back to the signal-reason recovery only when the rejection is an abort).

### IN-02: The D-17 retry runs with no armed timeout and no abort propagation — a hanging retry is unbounded (accepted T-03-16-02)

**File:** `src/core/ai/ProviderRouter.ts:639-651` (fresh derived controller) + `src/core/ai/StructuredOutput.ts:92-113` (per-attempt timeout lives only on the first attempt's controller)

**Issue:** The per-attempt timeout (`setTimeout` → `ac.abort(carrier)`) belongs to `StructuredOutput.attempt`'s controller, which is already aborted when the D-17 retry starts. The retry's fresh derived controller re-parents to the already-aborted parent (listener never fires), so the retried SDK call has **no timeout armed and no way to be aborted** — not by the expired timer, not by a subsequent user cancel. A hung retry runs indefinitely and still bills tokens. The plan accepts this ("low, accept — mirrors the pre-existing 5XX-retry semantics"), and it is bounded to a single call, but the renderer/planner timeouts (3 s / 5 s, `PLANNER_TIMEOUT_MS`) do not govern the retry. If per-attempt timeout governance is desired for the retry, `StructuredOutput` would need to re-arm the timer around the whole closure invocation rather than the first attempt only.

---

## Verified-Open Checks (positive results, post-gap-closure)

- **WR-02A suite:** `RendererService.streamBreakdown.test.ts` (4 tests) drives a FRESH real `ProviderRouter` per test via a hoisted holder — 3 non-stop finishes open the breaker (single one does not), 3 mid-stream real `APICallError(500)` failures open via the real classifier's mapped code, 3 user aborts never open, a clean stop never votes. A 0-vote `BREAKER_VOTES` regression fails this suite immediately.
- **WR-03A suite:** `StructuredOutput.timeoutRetry.test.ts` (3 tests) runs REAL `requestJson` + REAL Router + REAL `resolveTier` with the production arrival pattern (abort-with-carrier → SDK rejects bare AbortError) — 2 SDK calls, `retryCount === 1`, ledger `attempts[0] = { outcome: 'failed', errorCode: 'TIMEOUT' }`, retry signal non-aborted; retry-also-fails rejects with the carrier (`planner_failed` source intact); healthy first call never retries.
- **No double-voting (post-fix):** the render catch and the non-stop branch remain mutually exclusive; `runAgentTurn`/`planOnce`'s catches do not classify or vote render failures; the only vote site for a render failure is the renderer itself.
- **Test gate (this review run):** `ProviderRouter.test.ts` + `RendererService.test.ts` + `RendererService.streamBreakdown.test.ts` + `StructuredOutput.timeoutRetry.test.ts` — **53/53 passed** (3.3 s).
- **No new deps / R-10 / Golden Rule 9:** unchanged from the prior pass; the WR-03A recovery rethrows the existing carrier (timeoutMs only), and the new vote paths log only code + providerId + redacted errors.

---

_Reviewed: 2026-08-11T09:30:00Z_
_Reviewer: gsd-code-reviewer agent (adversarial review of gap-closure fixes + post-gap-closure pass over 03-15/03-16)_
_Depth: deep_
