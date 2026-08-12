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
  warning: 4
  info: 8
  total: 13
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-08-12
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Reviewed the Phase-4 Context-Adaptive Execution wave: the per-stage `ContextOptimizer` pipeline (TokenBudget → ContextPack → §2.4 ladder → provenance manifest), the `StageInvocation`/`modelContextWindow` stamping in `ProviderRouter`, the context seams threaded through `runAgentTurn`, and the `useStreamingLLM` hook rewire. Cross-file tracing covered the retry/budget machinery (`ROUTER_MAX_ATTEMPTS`, D-17 retry, WR-03A signal recovery), the trajectory transition table (`@/types/harness` `LEGAL_TRANSITIONS` — all orchestrator emits are legal), and the optimizer's determinism/budget invariants.

Strengths: the CR-01 budget fix is correct and well-pinned by `AgentOrchestrator.budget.test.ts` (only D-17 retried calls consume `retryCount`); the tier/budget derivation chain (window → tier → caps → loop caps) is consistent end-to-end; the ladder's `too-large` honest terminal and the Zod manifest gate are solid; the trajectory/replan accounting (D-3a-13) is verified correct by the tests.

Key concerns: (1) a D-17 timeout-origin retry runs **untimed and un-cancellable** — the parent signal's `abort` event already fired, so re-parenting a fresh controller cannot re-arm it (abort guarantee violated); (2) several Golden-Rule-9 catch paths return without `debugLog`; (3) the TokenBudget per-kind caps (`computeSectionCaps`) and the ContextCompressor no-op steps are dead in the runtime path — the documented "caps DRIVE the ladder" contract is not implemented; (4) the `messageTooLong` surface is unwired — `STR.chat.messageTooLong` is unreachable.

## Critical Issues

### CR-01: D-17 timeout-origin retry is untimed and cannot be aborted — orphaned paid request survives cancellation

**File:** `src/core/ai/ProviderRouter.ts:666-752` (attempt closure, esp. L675-677 and L747-750)
**Issue:** When a timeout-origin failure triggers the D-17 retry, `signal` (the closure's parent) was **already aborted by StructuredOutput's timer** before `attempt(true)` runs. `attempt(true)` creates a fresh `derived` controller and re-parents it via `signal.addEventListener('abort', onParentAbort)` — but the `abort` event already fired on `signal` and will never fire again, so the retried SDK call (`invokeJsonMode`, L679) is **immune to every subsequent abort**: a user cancel that propagates to `signal` is a no-op (already aborted), so `onParentAbort` never runs and `derived` is never aborted. Two compounding consequences:
1. **No timeout on the retry.** The per-attempt timeout is enforced by StructuredOutput around its closure call; the closure's *inner* retry is a raw `invokeJsonMode` call with no timer of its own. A hung provider connection therefore makes the retry hang indefinitely.
2. **Abort cannot stop it.** The user hits cancel → the hook shows `idle` (the turn's AbortError propagates through `planOnce`/the loop) while the retried call keeps running in the background — it can still bill tokens when it eventually completes. This directly violates the §17.5 invariant ("abort() cancels generation so no orphaned request bills tokens") and the "every path terminates in a bounded terminal" invariant (the retry path has no bound).

The non-timeout retry path (e.g. NETWORK/5XX) is fine — the parent is alive and re-parenting works — which is why the budget tests (all 5XX) pass and the defect is invisible in the suite.

**Fix:** Skip the retry (or run it against a live signal) when the parent is already aborted, and give the retry its own timeout:
```ts
// in buildCallProviderJsonMode, before attempt(true):
if (signal.aborted) throw e;            // parent dead — never retry on a dead signal
// and inside attempt(), arm a per-attempt timeout on `derived`:
const timer = setTimeout(() => derived.abort(timeoutError(PLANNER_TIMEOUT_MS)), RETRY_TIMEOUT_MS);
// … clearTimeout(timer) in the finally alongside removeEventListener
```

## Warnings

### WR-01: Golden Rule 9 gaps — three catch paths return without `debugLog(code, …)`

**Files:**
- `src/components/pages/useStreamingLLM.ts:223-236` — the `isAbortError` and `isContextTooLargeError` branches return without any `debugLog`. The abort branch is defensible (intentional cancel, "not an error"), but the `CONTEXT_TOO_LARGE` terminal is a real error path and GR-9 mandates a canonical-code log. The T-04-28 rationale (never log user text) is achievable without the text: `debugLog(ERROR_CODES.CONTEXT_TOO_LARGE, 'context too large — minimal mode exceeded', { module: 'useStreamingLLM', extra: { operationId } })` logs no user content.
- `src/core/ai/AgentOrchestrator.ts:140-152` — the `provider_unconfigured` terminal in `runAgentTurn`'s catch returns without `debugLog`.
- `src/core/ai/ProviderRouter.ts:461-464` — the `throw unavailable('provider_unconfigured')` site logs nothing; combined with the above, the D-07 unconfigured path has zero observability (the `privacy_blocked` site at L480-492 does log — inconsistent).
**Fix:** Add `debugLog(ERROR_CODES.CONTEXT_TOO_LARGE, …)` to the hook's typed-terminal branch, and a `debugLog(ERROR_CODES.HOST_NOT_PERMITTED`-style canonical call for the `provider_unconfigured` terminal (e.g. `ERROR_CODES.UNKNOWN` or a registry-consistent code with `module: 'ProviderRouter'` / `module: 'AgentOrchestrator'`, no user/provider text).

### WR-02: TokenBudget per-kind caps never drive the §2.4 ladder — `computeSectionCaps` is dead in the runtime path

**File:** `src/core/context/TokenBudget.ts:100-117` + `src/core/context/ContextOptimizer.ts:140-196`
**Issue:** The module contract states "caps DRIVE the §2.4 degradation ladder" (TokenBudget.ts L23-24, ContextCompressor.ts L6) — but `computeSectionCaps` (and transitively `PER_TIER_DISTRIBUTION` / `SECTION_CAP_MAPPING`) has **zero consumers in `src/`** (verified by grep; only the unit tests call it). `ContextOptimizer.optimize`'s ladder reacts exclusively to the aggregate `totalTokens > inputBudget`; a single section that blows its per-kind cap (e.g. `user_input` at 3000 tokens against the medium cap of 2457) while the aggregate stays under budget triggers **no degradation at all** — the per-kind overrun is silently accepted, contradicting §2.2's column-budget semantics and the D-04-13 "caps drive degradation" claim. This is either dead code (caps are decoration) or a missing enforcement step (ladder should consult `computeSectionCaps`).
**Fix:** Either (a) wire the caps into the ladder — after the aggregate check, also fire `trim-tools` / `minimal-mode` when a *kind's* tokens exceed its cap; or (b) if aggregate-only is the P4 intent, delete `computeSectionCaps`/`SECTION_CAP_MAPPING`/`PER_TIER_DISTRIBUTION` from the runtime surface and re-scope the tests — the current half-wired state will silently rot.

### WR-03: ContextCompressor no-op steps and `enterMinimalMode` are dead at runtime — optimizer bypasses the module it claims to iterate

**File:** `src/core/context/ContextOptimizer.ts:143-187` vs `src/core/context/ContextCompressor.ts:78-143`
**Issue:** `ContextOptimizer` imports only `LADDER_STEPS`, `dropDebugOnly`, `trimToolSchemas` (L38). The four structural no-op steps (`dropSecondaryNotes`, `summariseOlderHistory`, `compressPageContext`, `reduceMemoryTopK`) are handled with bare `break` — the exported functions are never called, so the documented "return the input sections unchanged **plus a compressionApplied marker**" behavior exists only in the unit tests, not in the runtime path (the manifest's `stepsFired`/`compressionApplied` never reflects those steps). Likewise `enterMinimalMode` is never called: the optimizer re-implements minimal-mode assembly inline (`buildPackInput` + `atMostOneSafeTool` + the `'minimal-mode'` switch case), duplicating what the primitive was built to do. D-04-12's "the optimizer iterates the registry" is only true for 3 of the 8 steps.
**Fix:** Either have the `drop-secondary`/`summarise-history`/`compress-page`/`reduce-topk` cases call their module functions (and honor their markers), or delete the four no-op exports + `enterMinimalMode` from `ContextCompressor` and keep only the tested primitives — one or the other; the current split (module claims ownership, optimizer ignores it) is the classic dual-source-of-truth trap.

### WR-04: `messageTooLong` surface is unwired — `STR.chat.messageTooLong` is unreachable

**File:** `src/components/pages/useStreamingLLM.ts:229-236` + `src/core/i18n/strings.ts:15`
**Issue:** D-04-15's contract ("surface the messageTooLong failed state") is not implemented end-to-end. The `ContextTooLargeError` branch sets `{ state: 'failed', operationId }` — the same state as every other failure — and `ChatStreamState` (L65-70) has no field to distinguish the too-long terminal. `STR.chat.messageTooLong` (strings.ts L15) has no consumer anywhere in `src/` (verified by grep). The user sees the generic provider-error/Retry bubble for an input that is *not* a provider failure and can never succeed via Retry — Retry re-sends the same oversized input into the same terminal. The T-04-25 test asserts only `state: 'failed'`, so the gap is invisible.
**Fix:** Add a discriminator to the failed state (e.g. `{ state: 'failed', operationId, reason?: 'too_long' }` or a dedicated `messageTooLong` surface state) set in the `isContextTooLargeError` branch, and render `STR.chat.messageTooLong` from it (and suppress/relabel Retry for that terminal).

## Info

### IN-01: Dead `status === 'aborted'` branch in the hook

**File:** `src/components/pages/useStreamingLLM.ts:214-217`
**Issue:** `runAgentTurn` never returns `status: 'aborted'` — every abort path throws `AbortError` (AgentOrchestrator L198, L445-450) and is caught by the `isAbortError` branch. The `'aborted'` member exists in the `AgentTurnOutcome` union (`src/types/harness.ts:63`) but the orchestrator never produces it, so this branch is unreachable.
**Fix:** Remove the branch (or, if a non-throwing aborted terminal is ever introduced, keep it with a comment explaining when it fires).

### IN-02: Redundant `provider_unconfigured` early-return

**File:** `src/components/pages/useStreamingLLM.ts:203-209`
**Issue:** `reasonCode === 'provider_unconfigured'` returns `{ state: 'failed', operationId }` — identical to the generic fall-through at L218-219 that handles `partial | failed` (which includes `provider_unconfigured`, since `runAgentTurn` returns `status: 'failed'` for it, AgentOrchestrator L144-151). The branch is a duplicate of the fall-through.
**Fix:** Delete the branch; the comment explaining the D-07 mapping can move to the fall-through.

### IN-03: CheckpointRecorder "rewind counters" comment is misleading

**File:** `src/core/ai/AgentOrchestrator.ts:264-272`
**Issue:** The comment says the checkpoint "discard[s] the failed result, rewind counters" (D-3a-09) — but `capture` runs *after* `toolCalls++` (L240-246), so `restore` rewinds `toolCalls` to a value that **includes** the failed execution. The failed tool still counts against `toolCap` (pinned by the trajectory/replan tests). Only `toolResults` is actually rewound.
**Fix:** Update the comment to state that `toolResults` is rewound while the failed execution's counter is retained (and that the replan's planOnce consumes a fresh `plannerCalls` slot — D-3a-13).

### IN-04: `errorCodes.ts` comment says "canonical 13-code Phase-3 block" — the block has 16 codes

**File:** `src/core/error/errorCodes.ts:64-67`
**Issue:** The Phase-3 block lists TOOL_REJECTED, PERSONA_LOAD_FAILED, AGENT_STATE_INVALID, TOOL_POSTCONDITION_FAILED, COMPLETION_EVIDENCE_MISSING, STRUCTURED_OUTPUT_FAILED, PLANNER_FAILED, STREAM_FAILED, NETWORK, TIMEOUT, RATE_LIMITED, PROVIDER_5XX, PROVIDER_AUTH, PROVIDER_MODEL_UNKNOWN, SCHEMA_INVALID, HOST_NOT_PERMITTED = 16 constants, not 13. The W-1 line-anchored mirror check keys on content, so the count in the comment will mislead future readers.
**Fix:** Correct the comment (e.g. "the canonical Phase-3 block").

### IN-05: `estimateTokens` doc "mixed script → higher-cost divisor" is imprecise

**File:** `src/core/context/TokenBudget.ts:12-13`
**Issue:** Divisor 4 (used when the CJK ratio is < 0.3, i.e. Latin-dominant mixed text) yields the **lower** token estimate; divisor 3 (ratio ≥ 0.3) is the higher/conservative one. The comment "mixed script → higher-cost divisor" reads as if mixed text gets the higher estimate, which is the opposite of what the code (and the MIXED_TEXT test, `TokenBudget.test.ts:239`) does. Documentation-only, but it can mislead future budget tuning.
**Fix:** Rephrase: "CJK-dominant text (ratio ≥ 0.3) is counted at the higher divisor 3; otherwise divisor 4."

### IN-06: `waitForAbortOrResume` — `void resolve` is dead, listener never removed on the resolve path

**File:** `src/core/ai/AgentOrchestrator.ts:442-456`
**Issue:** `void resolve` (L454) is a no-op expression — the promise never resolves in P4 (no resume wiring until Phase 8), and the `abort` listener is only cleaned up by its own `{ once: true }` firing. Correct today, but the dead expression invites a reader to assume a resume path exists.
**Fix:** Either delete `void resolve` and document that P4 ships the pause-only seam, or store the resolver for Phase 8 (`(resolveFn = resolve)`).

### IN-07: Renderer context is optimized against the pre-turn provider, the runtime renderer may resolve a different one

**File:** `src/components/pages/useStreamingLLM.ts:177-182` + `src/core/ai/ProviderRouter.ts:474-517`
**Issue:** `rendererCtx` is optimized from `rendererInv.modelContextWindow` (resolved before the turn), but at finish `AgentOrchestrator` re-resolves the renderer stage (AgentOrchestrator L347) — and `createStageInvocation` skips providers with a `failed` ledger entry (ProviderRouter L475), so a planner-loop failure can make the runtime renderer provider **differ** from the one whose window drove the renderer context. The context is then sized for a window the actual model may not have (or, worse, is under-sized for a larger one). P4 impact is nil (single provider in practice), but the seam is a latent mismatch.
**Fix:** Re-resolve the renderer invocation before optimizing the renderer stage (i.e. let the turn resolve the renderer stage last), or pass the runtime-resolved window into the optimizer at finish.

### IN-08: `STR.chat.offline` copy claims auto-retry that does not exist

**File:** `src/core/i18n/strings.ts:11`
**Issue:** `'No network. Retrying when back online.'` promises automatic retry, but the hook maps NETWORK-class failures to `offline` with no reconnection listener — the user must hit Retry manually. The copy is spec-locked (Appendix B), so flag only: if the copy cannot change, consider a reconnect-on-online listener in a later phase to make the promise true.
**Fix:** Note in the phase plan that Phase 4a+ should wire `navigator.onLine` → auto-retry, or defer the copy change to the Copywriting Contract owner.

---

_Reviewed: 2026-08-12_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
