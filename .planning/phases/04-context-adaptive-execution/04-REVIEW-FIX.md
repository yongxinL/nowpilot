---
phase: 04-context-adaptive-execution
fixed_at: 2026-08-12T09:16:00Z
review_path: .planning/phases/04-context-adaptive-execution/04-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-08-12
**Source review:** `.planning/phases/04-context-adaptive-execution/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (1 critical, 7 warnings)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: D-17 timeout-origin retry is untimed and cannot be aborted — orphaned paid request survives cancellation

**Files modified:** `src/core/ai/ProviderRouter.ts`, `tests/core/ai/ProviderRouter.test.ts`, `tests/core/ai/StructuredOutput.timeoutRetry.test.ts`
**Commit:** `cd45e75`
**Applied fix:** Two-part fix per the review's prescription: (1) the retry branch now refuses to retry on a dead parent signal — `if (signal.aborted) throw e;` before `attempt(true)` — so a TIMEOUT-origin failure (where StructuredOutput's one-shot timer already consumed the parent's abort event and the carrier is recovered) becomes an honest bounded terminal: the carrier propagates to the `planner_failed` fallback, no orphaned paid request bills tokens (§17.5). (2) `attempt()` arms a per-attempt timer on the retried call only (`isRetry`): `setTimeout(() => derived.abort(timeoutError(RETRY_TIMEOUT_MS)), RETRY_TIMEOUT_MS)` with `clearTimeout` in the finally, so a hung provider on a NETWORK/5XX retry (live parent) still terminates in a bounded failure — the retried call is no longer a raw untimed `invokeJsonMode`. The recovery branch also checks `derived.signal.reason` (the retry's own timer carrier), so a retry-timeout is classified TIMEOUT rather than UNKNOWN. Added `RETRY_TIMEOUT_MS = 3_000` (§1.2 planner parity) and imported `timeoutError`. The WR-03A timeout-retry tests were re-scoped to pin the corrected contract (1 SDK call, retryCount 0, ledger TIMEOUT, carrier propagates); the 5XX retry tests in `AgentOrchestrator.budget.test.ts` still pass (parent alive → retry fires, now with its own timer).

### WR-01: Golden Rule 9 gaps — three catch paths return without `debugLog(code, …)`

**Files modified:** `src/components/pages/useStreamingLLM.ts`, `src/core/ai/AgentOrchestrator.ts`, `src/core/ai/ProviderRouter.ts`
**Commit:** `a413f90`
**Applied fix:** Added canonical-code debugLogs to all three flagged sites: (1) the hook's `isContextTooLargeError` branch logs `ERROR_CODES.CONTEXT_TOO_LARGE` with module + operationId only (T-04-28 — no section/user text, R-10); (2) `AgentOrchestrator.runAgentTurn`'s `provider_unconfigured` terminal logs the canonical `UNKNOWN` code (module + operationId only — provider_unconfigured is a typed reason marker, not an error-code constant, per ProviderRouter L44-45) with a comment; (3) `ProviderRouter.createStageInvocation`'s `throw unavailable('provider_unconfigured')` site logs the same canonical `UNKNOWN` code (module + operationId only), matching the `privacy_blocked` site's observability. The abort branch in the hook stays silent by design (intentional cancel, review-defensible).

### WR-02: TokenBudget per-kind caps never drive the §2.4 ladder — `computeSectionCaps` is dead in the runtime path

**Files modified:** `src/core/context/ContextOptimizer.ts`, `tests/core/context/ContextOptimizer.test.ts`
**Commit:** `12a9c3d`
**Applied fix:** Took the review's option (a) — wired the caps into the ladder (the documented contract "caps DRIVE the §2.4 degradation ladder" is now true at runtime, not decoration). `optimize` now computes `computeSectionCaps(tier, inputBudget)` and the ladder fires when `totalTokens > inputBudget || anyKindOverCap()`, breaking only when BOTH the aggregate and every per-kind cap are met. `too-large` throws only for aggregate window overflow (a kind over its column cap with aggregate headroom degrades as far as P4 allows and stops — never a false window overflow). Added a regression test: a medium-window turn whose `user_input` blows its cap while the aggregate stays under budget now fires `minimal-mode`.

### WR-03: ContextCompressor no-op steps and `enterMinimalMode` are dead at runtime — and the optimizer's `trim-tools` predicate can never fire

**Files modified:** `src/core/context/ContextOptimizer.ts`
**Commit:** `12a9c3d`
**Applied fix:** Took the review's option (a): all 8 registry steps now genuinely call their module functions — the four structural no-op cases (`dropSecondaryNotes`, `summariseOlderHistory`, `compressPageContext`, `reduceMemoryTopK`) run their compressor primitives (their markers now exist in the runtime path, honoring the registry contract; they never drop in P4 so behavior is unchanged); `enterMinimalMode` is called by the `minimal-mode` case to mark the §2.5 pipeline before the optimizer's actual section reduction; `trim-tools` got a real in-scope predicate derived from `input.selectedToolSchemas` (section text includes a selected schema name) instead of the hardcoded `() => true` — it can now actually fire when an out-of-scope tool section is present. Real drops propagate their `compressionApplied` marker into the manifest sections (honoring markers; no-ops never drop → honest provenance).

### WR-04: `messageTooLong` surface is unwired — `STR.chat.messageTooLong` is unreachable

**Files modified:** `src/components/pages/useStreamingLLM.ts`, `src/components/pages/ChatPage.tsx`, `tests/components/pages/useStreamingLLM.test.tsx`, `tests/components/pages/ChatPage.test.tsx`
**Commit:** `da7256c`
**Applied fix:** The failed state gained a `reason?: 'too_long'` discriminator, set only by the `isContextTooLargeError` branch. `ChatPage` threads the discriminator into the assistant bubble and renders `STR.chat.messageTooLong` (instead of the generic "Provider error." prefix) with Retry **suppressed** for that terminal — re-sending the same oversized input lands in the same terminal, so a Retry button would be a lie. T-04-25 now asserts the `too_long` reason; added a ChatPage test asserting the messageTooLong bubble renders and Retry is absent.

### WR-05: No unmount abort — in-flight turns keep billing after a surface switch

**Files modified:** `src/components/pages/useStreamingLLM.ts`, `tests/components/pages/useStreamingLLM.test.tsx`
**Commit:** `d9c420b`
**Applied fix:** The hook's `useEffect` cleanup now calls `abortRef.current?.abort()` after unsubscribing the ChunkBuffer flush — switching side-panel tabs (Chat → Notes → Options) unmounts the component and cancels any in-flight `runAgentTurn`/renderer stream, so the SDK call stops billing (§17.5 no orphaned paid request). Added a regression test: unmounting mid-send aborts the captured turn signal.

### WR-06: A render-phase abort surfaces as `failed`, not `idle` — the renderer wraps the AbortError

**Files modified:** `src/core/ai/RendererService.ts`, `tests/core/ai/RendererService.test.ts`, `tests/core/ai/RendererService.streamBreakdown.test.ts`
**Commit:** `e6cb361`
**Applied fix:** `RendererService.render`'s catch now rethrows the original error when `isAbortError(e)` (`throw e;` before the vote/debugLog/wrap), so a user abort during the render phase propagates as the AbortError and the hook's `isAbortError` branch maps it to `idle` (the documented abort → idle contract). Provider-originated mid-stream failures still vote the breaker and wrap in `StreamFailedError` — only the user-abort class changed. Updated the three tests that pinned the old wrapping behavior to assert the AbortError propagates (and the breaker never votes on it).
**Status: fixed: requires human verification** — this is a logic/behavior change to the renderer's error classification; Tier 1/2 verification passed (typecheck + all renderer suites), but the abort→idle mapping across the hook/renderer boundary should be confirmed in an end-to-end run.

### WR-07: `StructuredOutput` carries a second, hardcoded token counter — violates the phase's own Pitfall-1 invariant

**Files modified:** `src/core/ai/StructuredOutput.ts`, `tests/core/ai/StructuredOutput.test.ts`
**Commit:** `cda1926`
**Applied fix:** The repair section's `tokens` now comes from `estimateTokens(repairText)` (imported from `@/core/context/TokenBudget`) instead of the hardcoded `Math.ceil(repairText.length / 4)` — the ONLY token counter (Pitfall 1) is the single source for the repair count too, so CJK-heavy repair output (which embeds the raw first model output) is no longer under-counted and the "two counters" trap stays sealed. The test now asserts `repair.tokens === estimateTokens(repair.text)`.

## Skipped Issues

None — all 8 in-scope findings were fixed.

---

_Fixed: 2026-08-12_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
