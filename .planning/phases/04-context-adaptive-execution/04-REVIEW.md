---
phase: 04-context-adaptive-execution
reviewed: 2026-08-12T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src/components/pages/useStreamingLLM.ts
  - src/core/ai/AgentOrchestrator.ts
  - src/core/ai/ProviderRouter.ts
  - src/core/ai/types.ts
  - src/core/context/ContextCompressor.ts
  - src/core/context/ContextOptimizer.ts
  - src/core/context/ContextPack.ts
  - src/core/context/ContextProvenanceManifest.ts
  - src/core/context/ModelContextTier.ts
  - src/core/context/TokenBudget.ts
  - src/core/error/errorCodes.ts
  - src/core/i18n/strings.ts
  - src/core/prompts/index.ts
  - tests/components/pages/useStreamingLLM.test.tsx
  - tests/core/ai/AgentOrchestrator.budget.test.ts
  - tests/core/ai/AgentOrchestrator.test.ts
  - tests/core/ai/RendererService.evidence.test.ts
  - tests/core/ai/RendererService.streamBreakdown.test.ts
  - tests/core/ai/RendererService.test.ts
  - tests/core/ai/persona/PersonaInjector.test.ts
  - tests/core/ai/trajectory/AgentOrchestrator.replan.test.ts
  - tests/core/ai/trajectory/AgentOrchestrator.trajectory.test.ts
  - tests/core/context/ContextCompressor.test.ts
  - tests/core/context/ContextOptimizer.test.ts
  - tests/core/context/ContextProvenanceManifest.test.ts
  - tests/core/context/TokenBudget.test.ts
  - tests/fixtures/optimizedContext.ts
findings:
  critical: 1
  warning: 7
  info: 9
  total: 17
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-08-12
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Fresh review of the Phase-4 Context-Adaptive Execution wave at the current code state (the previous REVIEW.md is superseded): the per-stage `ContextOptimizer` pipeline (TokenBudget → ContextPack → §2.4 ladder → provenance manifest), the `StageInvocation`/`modelContextWindow` stamping in `ProviderRouter`, the `contextForStage` seams in `runAgentTurn`, and the `useStreamingLLM` rewire. Cross-file tracing covered the retry/budget machinery (`ROUTER_MAX_ATTEMPTS`, D-17 retry, WR-03A signal recovery), the trajectory transition table (`LEGAL_TRANSITIONS` — every orchestrator `emit` is legal), and the optimizer's determinism/budget invariants.

Strengths verified: the tier/budget derivation chain (window → tier → §2.2 budgets → capsForTier) is consistent end-to-end and pinned by tests; the optimizer is pure and deterministic (no `Date.now`/`crypto`, verified); the `too-large` honest terminal + Zod manifest gate (GR-4) are sound; the CR-01 budget re-scoping (only D-17 retried calls consume `retryCount`) is correct and well-pinned by `AgentOrchestrator.budget.test.ts`; the D-3a-13 replan accounting is verified by the trajectory/replan suites; the `LEGAL_TRANSITIONS` table is complete and all runtime transitions are legal.

**Critical concern (unfixed from the prior review):** the D-17 timeout-origin retry still runs **untimed and un-cancellable** — the parent signal's `abort` event has already fired, so the re-parenting is dead code for exactly the failure class (TIMEOUT) the retry branch is designed for. **New this review:** the hook never aborts on unmount (in-flight turns keep billing after a surface switch), a render-phase abort surfaces as `failed` instead of `idle`, and a second hardcoded token counter in `StructuredOutput` violates the phase's own Pitfall-1 invariant.

## Critical Issues

### CR-01: D-17 timeout-origin retry is untimed and cannot be aborted — orphaned paid request survives cancellation

**File:** `src/core/ai/ProviderRouter.ts:666-752` (attempt closure, esp. L675-677 re-parenting and L747-750 retry branch)
**Issue:** When a TIMEOUT-origin failure triggers the D-17 retry, `signal` (the closure's parent) was **already aborted** by StructuredOutput's one-shot timer (`StructuredOutput.ts:105-111` — the `setTimeout` fires once, sets `timedOut`, aborts `ac` with the carrier). The closure recovers the carrier (`isTimeoutError(signal.reason)`, L708), records/votes, and rethrows; the retry branch classifies it `TIMEOUT/retryable` and calls `attempt(true)`. Inside, `attempt(true)` derives a fresh controller and re-parents via `signal.addEventListener('abort', onParentAbort)` (L675-677) — but the parent's `abort` event already fired and will never fire again, so `onParentAbort` never runs and `derived` is never aborted. Two compounding consequences:
1. **No timeout on the retry.** The per-attempt timeout lives in StructuredOutput's `setTimeout`, which is one-shot and already consumed; the closure's inner retry is a raw `invokeJsonMode` call with no timer of its own. A hung provider makes the retried call hang indefinitely, and StructuredOutput's `finally` (clearTimeout/removeEventListener) never runs until it settles.
2. **Abort cannot stop it.** A user cancel (or a new `send()`) aborts the turn's signal, but the retried call is immune — it keeps running in the background and bills tokens when it eventually lands, violating the §17.5 "no orphaned request bills tokens" invariant and the "every path terminates in a bounded terminal" invariant.

The non-timeout retry path (NETWORK/5XX) is fine — the parent is alive and re-parenting works — which is why the budget suite (all 5XX) passes and the defect is invisible to it. The WR-03A comment (L670-674) claims the retry runs on "a FRESH non-aborted derived signal" — true, but the retry is *supposed* to be bounded by the parent; for timeout origins there is no bound left.

**Fix:**
```ts
// in buildCallProviderJsonMode, before the retry branch:
if (signal.aborted) throw e; // parent dead (timeout origin) — never retry on a dead signal
// and inside attempt(), arm a per-attempt timeout on `derived`:
const timer = setTimeout(() => derived.abort(timeoutError(RETRY_TIMEOUT_MS)), RETRY_TIMEOUT_MS);
// … clearTimeout(timer) in the finally alongside removeEventListener
```
If a retry on TIMEOUT is genuinely wanted, the retried call must get its own timer and an abort path; otherwise TIMEOUT should be excluded from the retry decision when `signal.aborted`.

## Warnings

### WR-01: Golden Rule 9 gaps — three catch paths return without `debugLog(code, …)`

**Files:**
- `src/components/pages/useStreamingLLM.ts:220-236` — the `isAbortError` (L223-228) and `isContextTooLargeError` (L229-236) branches return without any `debugLog`. The abort branch is defensible (intentional cancel), but the `CONTEXT_TOO_LARGE` terminal is a real error path and GR-9 mandates a canonical-code log. The T-04-28 rationale (never log user text) is achievable without the text: `debugLog(ERROR_CODES.CONTEXT_TOO_LARGE, 'context too large — minimal mode exceeded', { module: 'useStreamingLLM', extra: { operationId } })` logs no user content.
- `src/core/ai/AgentOrchestrator.ts:140-152` — the `provider_unconfigured` terminal in `runAgentTurn`'s catch returns without `debugLog`.
- `src/core/ai/ProviderRouter.ts:461-464` — the `throw unavailable('provider_unconfigured')` site logs nothing; the D-07 unconfigured path has zero observability end-to-end (the `privacy_blocked` site at L480-492 logs — inconsistent).
**Fix:** Add `debugLog(ERROR_CODES.CONTEXT_TOO_LARGE, …)` to the hook's typed-terminal branch, and a canonical-code `debugLog` for the `provider_unconfigured` terminal (module + operationId only, no user/provider text).

### WR-02: TokenBudget per-kind caps never drive the §2.4 ladder — `computeSectionCaps` is dead in the runtime path

**File:** `src/core/context/TokenBudget.ts:100-117` + `src/core/context/ContextOptimizer.ts:140-196`
**Issue:** The module contract states "caps DRIVE the §2.4 degradation ladder" (TokenBudget.ts L23-24, ContextCompressor.ts L6) — but `computeSectionCaps` and `SECTION_CAP_MAPPING` have **zero consumers in `src/`** (verified by grep; only the unit suites call them). `ContextOptimizer.optimize`'s ladder reacts exclusively to the aggregate `totalTokens > inputBudget`; a single section that blows its per-kind cap (e.g. `user_input` at 3000 tokens against the medium cap of 2457 — the `OVER_BUDGET_SECTIONS` fixture) while the aggregate stays under budget triggers **no degradation at all** — the §2.2 column-budget semantics are silently unenforced. This is either dead code (caps are decoration) or a missing enforcement step; the half-wired state will silently rot.
**Fix:** Either (a) wire the caps into the ladder — after the aggregate check, also fire `trim-tools` / `minimal-mode` when a *kind's* tokens exceed its cap; or (b) if aggregate-only is the P4 intent, remove `computeSectionCaps`/`SECTION_CAP_MAPPING`/`PER_TIER_DISTRIBUTION` from the runtime surface and re-scope the tests.

### WR-03: ContextCompressor no-op steps and `enterMinimalMode` are dead at runtime — and the optimizer's `trim-tools` predicate can never fire

**File:** `src/core/context/ContextOptimizer.ts:141-193` vs `src/core/context/ContextCompressor.ts:78-143`
**Issue:** `ContextOptimizer` imports only `LADDER_STEPS`, `dropDebugOnly`, `trimToolSchemas` (L38). The four structural no-op steps are handled with bare `break` — `dropSecondaryNotes`/`summariseOlderHistory`/`compressPageContext`/`reduceMemoryTopK` are never called anywhere in `src/` (verified by grep), so their `compressionApplied` markers exist only in the unit tests, not in the runtime path. `enterMinimalMode` is likewise never called — the optimizer re-implements minimal-mode assembly inline (`buildPackInput` + `atMostOneSafeTool`). Additionally, the one REAL step that *is* called is neutered by construction: `trimToolSchemas(sections, () => true)` (L170) hardcodes the in-scope predicate to "everything", so `dropped` is always `[]` and the step can never fire — the comment claims it fires "when a future caller passes a narrower scope", but the optimizer *is* the only caller and hardcodes the widest scope. D-04-12's "the optimizer iterates the registry" is only true for 2 of the 8 steps.
**Fix:** Either have the four no-op cases call their module functions (and honor their markers), delete the unused exports + `enterMinimalMode`, and give `trim-tools` a real in-scope predicate derived from `input.selectedToolSchemas` — or keep the current split only with an explicit comment that the registry is a future-phase placeholder (the current dual-source-of-truth state will silently rot).

### WR-04: `messageTooLong` surface is unwired — `STR.chat.messageTooLong` is unreachable

**File:** `src/components/pages/useStreamingLLM.ts:229-236` + `src/core/i18n/strings.ts:15`
**Issue:** D-04-15's contract ("surface the messageTooLong failed state") is not implemented end-to-end. The `ContextTooLargeError` branch sets `{ state: 'failed', operationId }` — identical to every other failure — and `ChatStreamState` (L65-70) has no discriminator for the too-long terminal. `STR.chat.messageTooLong` has no consumer anywhere in `src/` (verified by grep; only the string definition and a code comment mention it). The user sees the generic provider-error/Retry bubble for an input that is *not* a provider failure and can never succeed via Retry — Retry re-sends the same oversized input into the same terminal. The T-04-25 test asserts only `state: 'failed'`, so the gap is invisible.
**Fix:** Add a discriminator to the failed state (e.g. `{ state: 'failed', operationId, reason?: 'too_long' }` or a dedicated `messageTooLong` surface state) set in the `isContextTooLargeError` branch, and render `STR.chat.messageTooLong` from it (suppress/relabel Retry for that terminal).

### WR-05: No unmount abort — in-flight turns keep billing after a surface switch

**File:** `src/components/pages/useStreamingLLM.ts:104-118`
**Issue:** The hook's only `useEffect` (L115-118) sets up the ChunkBuffer and returns `onFlush`'s unsubscribe as cleanup. `abortRef.current` is never aborted on unmount. The comment at L225 explicitly claims cancel happens on "a new send or an unmount" — but there is no unmount path that aborts: switching side-panel tabs (Chat → Notes → Options) unmounts the chat page component while `send()`'s `runAgentTurn` continues, the renderer stream keeps running to completion, and the SDK call bills tokens. The only abort triggers are a new `send()` or an explicit `abort()` call, which nothing wires to unmount.
**Fix:**
```ts
useEffect(() => {
  if (!bufferRef.current) bufferRef.current = createChunkBuffer();
  const unsubscribe = bufferRef.current.onFlush(setText);
  return () => {
    unsubscribe();
    abortRef.current?.abort(); // cancel in-flight generation on unmount — no orphaned paid request
  };
}, []);
```

### WR-06: A render-phase abort surfaces as `failed`, not `idle` — the renderer wraps the AbortError

**File:** `src/components/pages/useStreamingLLM.ts:223-228` + `src/core/ai/RendererService.ts:179-195` (cross-file)
**Issue:** When the user calls `abort()` (or a new send aborts the previous controller) while the turn is in the **render phase**, `RendererService.render`'s catch converts *every* stream error — including the user AbortError — into the typed `StreamFailedError` (`streamFailed(err.message, accumulated)`, L195). The hook's `isAbortError` check (name-based on the wrapper's `name === 'AbortError'`) misses it, `classifyProviderError` maps the message (`STREAM_FAILED: aborted`) to `UNKNOWN`, and the surface lands in `failed` with partial text + Retry — violating the documented "abort → idle" contract (asserted by the hook test at L420-429, which passes only because it mocks `runAgentTurn` to reject with a bare `DOMException`, bypassing the real renderer). Abort-during-planner works correctly; only the render phase mislabels.
**Fix:** In `RendererService`, rethrow the original abort error instead of wrapping it when `isAbortError(e)` (`throw e;` in that branch), so the hook's `isAbortError` branch can map it to `idle`.

### WR-07: `StructuredOutput` carries a second, hardcoded token counter — violates the phase's own Pitfall-1 invariant

**File:** `src/core/ai/StructuredOutput.ts:137` (cross-file, vs. the 04-06 re-point at `AgentOrchestrator.ts:35`)
**Issue:** The phase's documented invariant — "`estimateTokens` is the ONLY token counter (Pitfall 1)" (TokenBudget.ts L7-8; `AgentOrchestrator.ts:33-35` re-points the import "in the same wave as the contextHelper deletion") — is broken by `StructuredOutput`'s repair section: `tokens: Math.ceil(repairText.length / 4)` (verified by grep — the only `length / 4` in `src/`). The repair text embeds the raw first model output (`Broken: ${first}`), which can be CJK-heavy; the heuristic counter would rate it at divisor 3 (ratio ≥ 0.3), while this site hardcodes divisor 4 — the repair section's token count diverges from `estimateTokens` and any consumer of the number (e.g. the Router's `budgetGuard` estimate at `ProviderRouter.ts:654`) under-counts CJK output. The divergence also quietly re-introduces the "two counters" trap the phase explicitly sealed.
**Fix:** `tokens: estimateTokens(repairText)` (import from `@/core/context/TokenBudget`).

## Info

### IN-01: Dead `status === 'aborted'` branch in the hook

**File:** `src/components/pages/useStreamingLLM.ts:214-217`
**Issue:** `runAgentTurn` never returns `status: 'aborted'` — every abort path throws `AbortError` (AgentOrchestrator L198, L444-450) and is caught by the `isAbortError` branch. The `'aborted'` member exists in the `AgentTurnOutcome` union (`src/types/harness.ts:112`) but the orchestrator never produces it, so the branch is unreachable.
**Fix:** Remove the branch (or keep it with a comment explaining when a non-throwing aborted terminal would fire).

### IN-02: Redundant `provider_unconfigured` early-return

**File:** `src/components/pages/useStreamingLLM.ts:203-209`
**Issue:** `reasonCode === 'provider_unconfigured'` returns `{ state: 'failed', operationId }` — identical to the generic fall-through at L218-219 (which also handles `provider_unconfigured`, since `runAgentTurn` returns `status: 'failed'` for it, AgentOrchestrator L144-151). Duplicate of the fall-through.
**Fix:** Delete the branch; move the D-07 comment to the fall-through.

### IN-03: CheckpointRecorder "rewind counters" comment is misleading

**File:** `src/core/ai/AgentOrchestrator.ts:264-272`
**Issue:** The comment says the checkpoint "discard[s] the failed result, rewind counters" — but `capture` runs *after* `toolCalls++` (L240-246), so `restore` rewinds `toolCalls`/`plannerCalls` to values that **include** the failed execution; only `toolResults` is actually rewound. The counters are not rewound (the replan's planOnce then consumes a fresh `plannerCalls` slot — D-3a-13, verified by the replan tests).
**Fix:** Update the comment to state that `toolResults` is rewound while the counters retain the failed execution.

### IN-04: `errorCodes.ts` comment says "canonical 13-code Phase-3 block" — the block has 16 codes

**File:** `src/core/error/errorCodes.ts:64-67`
**Issue:** The Phase-3 block (TOOL_REJECTED … HOST_NOT_PERMITTED) contains 16 constants, not 13. The W-1 line-anchored mirror check keys on content, so the stale count misleads future readers.
**Fix:** Correct the comment (e.g. "the canonical Phase-3 block").

### IN-05: `estimateTokens` doc "mixed script → higher-cost divisor" is imprecise

**File:** `src/core/context/TokenBudget.ts:12-13`
**Issue:** Divisor 3 (ratio ≥ 0.3, CJK-dominant) is the higher/conservative count; divisor 4 (ratio < 0.3) is lower. The comment reads as if mixed text gets the higher estimate — the opposite of the code (and the `MIXED_TEXT` test, TokenBudget.test.ts L239). Documentation-only, but it can mislead future budget tuning.
**Fix:** Rephrase: "CJK-dominant text (ratio ≥ 0.3) is counted at the higher divisor 3; otherwise divisor 4."

### IN-06: `waitForAbortOrResume` — `void resolve` is dead, listener never removed on the resolve path

**File:** `src/core/ai/AgentOrchestrator.ts:442-456`
**Issue:** `void resolve` (L454) is a no-op — the promise never resolves in P4 (no resume wiring until Phase 8), and the abort listener is only cleaned up by its own `{ once: true }` firing. Correct today, but the dead expression invites a reader to assume a resume path exists.
**Fix:** Delete `void resolve` and document that P4 ships the pause-only seam (or store the resolver for Phase 8).

### IN-07: Per-stage contexts are optimized against the pre-turn resolved model; mid-turn failover can change the model (and its window)

**File:** `src/components/pages/useStreamingLLM.ts:157-182` + `src/core/ai/ProviderRouter.ts:469-475` + `src/core/ai/AgentOrchestrator.ts:347`
**Issue:** The hook optimizes `plannerCtx`/`rendererCtx` from the *first* resolution of each stage. But `createStageInvocation` skips any provider with a `failed` ledger entry (L469-475) and is re-invoked for every planner loop iteration and for the renderer at finish — so a mid-turn planner failure can make the *runtime* model differ from the one whose `modelContextWindow` drove the context's tier/budgets (e.g. deepseek 64K → anthropic 200K, or the reverse: an over-budget context sent to a smaller-window fallback). P4 impact is nil in practice (single provider), but the D-04-04 claim "budgets derive from each StageInvocation's modelContextWindow" is only true for the first resolution.
**Fix:** Re-resolve the renderer invocation before optimizing its context at finish (or validate the runtime model's window against the context's at `planOnce`/`finish` and re-optimize on mismatch).

### IN-08: `STR.chat.offline` copy claims auto-retry that does not exist

**File:** `src/core/i18n/strings.ts:11`
**Issue:** `'No network. Retrying when back online.'` promises automatic retry, but the hook maps NETWORK-class failures to `offline` with no reconnection listener — the user must hit Retry manually. Copy is spec-locked (Appendix B), so flag only: wire `navigator.onLine` → auto-retry in a later phase, or defer the copy change to the Copywriting Contract owner.
**Fix:** Note in the phase plan that Phase 4a+ should wire `navigator.onLine` → auto-retry.

### IN-09: Manifest `compressionApplied` field is never populated by the optimizer

**File:** `src/core/context/ContextOptimizer.ts:202-218` + `src/core/context/ContextProvenanceManifest.ts:55`
**Issue:** The manifest schema/interface declare per-section `compressionApplied?: 'summarise' | 'structural' | 'topk'`, and the compressor steps produce those markers — but `optimize` always builds manifest sections with `truncated: false` and never sets `compressionApplied`. Every stamped manifest has `undefined` there; the field is decoration, and the "PromptInspector-ready" provenance claim (ContextProvenanceManifest.ts L63) is not met for compression markers.
**Fix:** Propagate the compressor steps' `compressionApplied` markers into the manifest sections when a real step drops/compresses (or drop the field from the schema until a consumer exists).

---

_Reviewed: 2026-08-12_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
