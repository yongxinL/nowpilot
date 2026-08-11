---
phase: 03-cost-effective-ai-runtime-persona-seed
reviewed: 2026-08-11T02:30:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/core/ai/ProviderRouter.ts
  - src/core/ai/StructuredOutput.ts
  - src/core/ai/RendererService.ts
  - src/core/ai/ProviderRegistry.ts
  - src/components/pages/ChatPage.tsx
  - src/core/error/TimeoutError.ts
  - tests/core/ai/ProviderRouter.test.ts
  - tests/core/ai/AgentOrchestrator.budget.test.ts
  - tests/core/ai/StructuredOutput.test.ts
  - tests/core/ai/RendererService.test.ts
  - tests/core/ai/ProviderRegistry.test.ts
  - tests/components/pages/ChatPage.test.tsx
  - tests/components/sidepanel/SidePanelShell.test.tsx
  - tests/components/standalone/StandaloneShell.test.tsx
findings:
  critical: 0
  warning: 5
  info: 7
  total: 12
status: issues_found
---

# Phase 3: Code Review Report — Gap-Closure Fixes (03-10 .. 03-14)

**Reviewed:** 2026-08-11T02:30:00Z
**Depth:** standard
**Files Reviewed:** 14 (6 src + 8 test; plus cross-checked AgentOrchestrator/PlannerService/useStreamingLLM/ChunkBuffer/entrypoints)
**Status:** issues_found

## Summary

This review covers the five gap-closure plans that close the pre-fix findings of the prior 03-REVIEW.md: **CR-01** (03-10, retry-scoped R-2 budget), **WR-01** (03-13, any-usable D-07 gate), **WR-02** (03-12, breaker/stream-freeze wiring), **WR-03** (03-11, timeout-origin classification), **WR-04** (03-14, retry footer gating). All 108 tests across the changed suites pass (83 core + 25 shell/entrypoint), the `verify:phase-3` gate is green per the summaries, no new dependencies were added (all five plans: `tech-stack added: []`), no debug artifacts (`console.log`/`debugger`/`TODO` — 0 matches in changed files), R-10 discipline holds (TimeoutError carries only `timeoutMs`; debugLog payloads are redacted), and Golden Rule 9 holds on the new catch surfaces.

**Verdict per fix:**

- **CR-01 — correctly and completely closed.** `retryCount` increments only on the D-17 retried call (`isRetry=true`); both budget gates (`createStageInvocation` + inner `attempt()`) read `retryCount`; legitimate sequential stage calls and structured-output repairs never consume the budget; `attemptCount` removal leaves no stale references (grep-verified). The permanent orchestrator regression (real Router + real budget + real tier resolver) proves a medium-tier 2-tool turn completes with `reasonCode: 'success'`, the renderer runs, and `retryCount === 0`; the D-17 retry case consumes exactly 1. The unit budget test correctly terminates on the budget gate (not chain exhaustion).
- **WR-01 — correctly and completely closed.** `hasActiveProvider()` is any-usable (`enabled && !keyUnreadable` over all entries); `registerActiveProvider` has **zero production callers** (grep-verified — only the definition in ProviderRegistry.ts), so the entry-based behavior change is safe; the 4 new gate cases + re-asserted legacy test pin it; the 7 shell-gate fixtures were converted to real `registerProvider` entries (25/25 shell tests pass).
- **WR-04 — correctly and completely closed.** The footer gate (`m.id === messages[messages.length - 1]?.id && (m.status === 'failed' || m.status === 'offline')`) renders Retry only on the current turn's bubble; `handleRetry`'s last-message targeting is now sound; the 3 regression tests pin stale-bubble inertness, latest-bubble recovery, and replace-only-latest. No state hazard (gate lives in the `useMemo` with `messages` in deps; empty-list `?.` is safe).
- **WR-02 — partially closed (freeze ✓, breaker effect ✗).** The first-token freeze is correctly wired exactly once per render (`firstTokenMarked`), making the §1.5 `stream_frozen` guard reachable; the catch/non-stop branches are mutually exclusive (no double-vote); the `isAbortError` name-match guard (prototype-chain-agnostic) correctly excludes user aborts. **However, the breaker vote is inert** — see **WR-02A**.
- **WR-03 — partially closed (silent-idle ✓, D-17 retry ✗).** The `TimeoutError` carrier is correctly produced (timedOut flag set before `ac.abort()`), the classifier maps it to `TIMEOUT`/retryable before the abort branch, user cancels stay `AbortError`/UNKNOWN (never conflated), and a planner timeout now surfaces the visible `planner_failed` fallback answer instead of a silent idle. **However, the D-17 retry on timeout never fires on the production path** — see **WR-03A**.

**Carry-forward:** WR-05/WR-06/WR-07 and IN-01..IN-05 from the prior review were **not** part of the five gap-closure plans and remain open; they are carried forward below so they are not lost in this overwrite.

## Warnings

### WR-02A: The breaker vote is inert — `STREAM_FAILED` is absent from `BREAKER_VOTES`, so streaming failures still never open the breaker

**File:** `src/core/ai/ProviderRouter.ts:186-195` (`BREAKER_VOTES`) + `src/core/ai/RendererService.ts:128-132,146` (call sites)

**Issue:** `RendererService` now calls `getProviderRouter().recordFailure(providerId, ERROR_CODES.STREAM_FAILED, ...)` on every provider-originated streaming failure — but `voteBreaker` computes `BREAKER_VOTES[code] ?? 0` and **early-returns on 0**. `STREAM_FAILED` has no entry in `BREAKER_VOTES` (which only covers the §20.10 pre-first-token codes), so every streaming failure votes **0** and the provider's breaker can never open from mid-stream failures. The VERIFICATION.md WR-02 observable consequence — "a provider failing mid-stream accrues no breaker votes and is retried every turn" — is unchanged after the fix. The regression tests do not catch this: `RendererService.test.ts` mocks the Router (`routerMock.recordFailure`) and asserts only that `recordFailure` **was invoked**, never that a vote accrued or the breaker state changed. The `recordFailure` JSDoc ("a mid-stream/stream failure votes the provider's breaker") and the 03-12 SUMMARY claim ("a provider failing mid-stream now accrues breaker votes") assert an effect the implementation does not produce.

**Fix:** Give streaming failures a real vote. Either (a) add `STREAM_FAILED: 1` to `BREAKER_VOTES`, or (b) classify the underlying error in the catch branch and pass its code (e.g. `NETWORK`/`PROVIDER_5XX` → vote 1) while keeping `STREAM_FAILED` for the no-error non-stop branch. Then extend `RendererService.test.ts` with a test that drives a real `ProviderRouter` (not the mock) through 3 `STREAM_FAILED` failures and asserts `isBreakerOpen(providerId) === true`.

### WR-03A: The D-17 retry on TIMEOUT never fires on the production path — the carrier is born after the router's retry decision

**File:** `src/core/ai/StructuredOutput.ts:89-107` + `src/core/ai/ProviderRouter.ts:611-661` + `tests/core/ai/ProviderRouter.test.ts:354-373`

**Issue:** The WR-03 summary claims "the D-17 retry fires exactly once" on a timeout (T-03-11-02), but the production timeout flow cannot reach the retry:

1. `StructuredOutput.attempt` fires the per-attempt `setTimeout` → `timedOut = true; ac.abort()`.
2. Inside the router closure, the SDK rejects with a **bare `AbortError`** (the per-attempt signal aborted). `classifyProviderError` maps it to `{ code: 'UNKNOWN', retryable: false }` — not retryable, no breaker vote (UNKNOWN votes 0). The D-17 branch is never taken.
3. The `TimeoutError` carrier is only created **after** the closure's retry decision, in `attempt`'s catch (`if (timedOut) throw timeoutError(...)`).

The unit test "retries EXACTLY once on a TimeoutError carrier" passes `timeoutError(3_000)` as the **`generateObject` mock rejection** — an arrival pattern production never produces (`timeoutError()` is the only TimeoutError creation site, and it runs outside the router closure). Additionally, even if a TimeoutError did reach the closure, the D-17 retry would call `attempt(true)` with the **same already-aborted per-attempt signal** — the retried call would reject immediately with AbortError, i.e. a futile retry that still consumes `retryCount` and can never succeed by construction. So the timeout path still consumes zero retries and never votes the breaker (`BREAKER_VOTES.TIMEOUT = 1` is equally unreachable). The primary WR-03 goal **is** achieved (timeout → `planner_failed` fallback answer via `planOnce`, never a silent idle; user cancels stay `AbortError`/idle), but the D-17-retry-on-timeout claim is satisfied only by test injection.

**Fix:** Either (a) accept the fallback-answer semantics and correct the summary/test framing (rename the unit test to document that the carrier's production path bypasses the router retry), or (b) make the router closure timeout-aware — wrap the incoming signal in the closure so a timeout-origin rejection surfaces as the carrier *inside* the retry decision point (and give the retried call a fresh, non-aborted signal), then assert the retry end-to-end through `StructuredOutput.attempt` + real Router.

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

## Info

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

### IN-06 (new): inconsistent `isAbortError` implementations — ProviderRouter still uses the `instanceof` form the 03-12 plan itself flagged as broken in the test realm

**File:** `src/core/ai/ProviderRouter.ts:782-784`

**Issue:** `classifyProviderError`'s abort branch is `err instanceof Error && err.name === 'AbortError'`, while the WR-02 fix (and AgentOrchestrator/useStreamingLLM) deliberately use the prototype-chain-agnostic name-match because DOMException is not `instanceof Error` in the jsdom realm. The test `'a user cancel (AbortError) stays UNKNOWN/never-retried'` passes only because the jsdom DOMException falls *through* the abort branch to the UNKNOWN fallthrough — so the test cannot distinguish the abort branch from the fallthrough. Production (Chrome, where DOMException IS `instanceof Error`) is correct, but the branch is untested-as-written. Align it with the canonical name-match:
```ts
return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
```

### IN-07 (new): plan-doc drift — WR-03 is attributed to 03-14 in the 03-13 SUMMARY and 03-14 SUMMARY

**File:** `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-13-SUMMARY.md:149`, `03-14-SUMMARY.md` tags

**Issue:** 03-13's "Next Phase Readiness" and 03-14's metadata describe 03-14 as covering "WR-03 TIMEOUT classification + WR-04 retry targeting"; WR-03 was actually closed by 03-11. Documentation-only drift; the implementation trail (commits `86fe69b`/`93dabfa`/`5548c3e`/`87f460a`) is unambiguous.

---

## Verified-Open Checks (positive results)

- **CR-01 regression:** `AgentOrchestrator.budget.test.ts` runs a real Router + real budget + real stage services (only the three ai-sdk call sites stubbed, real error classes kept) — the 2-tool medium turn resolves `reasonCode: 'success'` with the renderer actually invoked (`streamText` × 1) and `retryCount === 0`; the repair turn and the D-17-retry turn both answer. This directly reproduces the pre-fix `no_candidate (router attempt budget exhausted)` failure mode and proves it gone.
- **No new deps:** all five summaries `tech-stack added: []`; package.json untouched by these plans.
- **R-10:** `TimeoutError` carries only `timeoutMs`; RendererService debugLog payloads are code/operationId/partialToken-count only; the redaction test (`sk-super-secret-token-123` absent from captured logs) passes.
- **Golden Rule 9:** new catches debugLog canonical codes (`STREAM_FAILED`, `PLANNER_FAILED`); the `attempt` catch in StructuredOutput rethrows (no swallowing) with the terminal failure logged via `STRUCTURED_OUTPUT_FAILED`; no empty catches introduced.
- **No double-voting (WR-02):** the mid-stream catch and the non-stop-finish branch are mutually exclusive — no path votes twice for one failure.
- **Test gate:** 83/83 core tests + 25/25 shell/entrypoint tests pass in this review run.

---

_Reviewed: 2026-08-11T02:30:00Z_
_Reviewer: gsd-code-reviewer agent (adversarial review of gap-closure fixes)_
_Depth: standard_
