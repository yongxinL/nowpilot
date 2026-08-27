---
phase: 03-cost-effective-ai-runtime-persona-seed
fixed_at: 2026-08-28T09:00:00Z
review_path: .planning/phases/03-cost-effective-ai-runtime-persona-seed/03-REVIEW.md
iteration: 1
findings_in_scope: 16
fixed: 16
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-08-28T09:00:00Z
**Source review:** `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 16 (6 CRITICAL + 7 WARNING + 3 INFO — all advisory INFO fixes were trivial and applied)
- Fixed: 16
- Skipped: 0

**Verification location:** `tsc --noEmit` and the full vitest suite (46 files / 393 tests) were run inside the isolated review-fix worktree (`.claude/worktrees/rf-03-…`) against the fixed tree BEFORE the branch fast-forward, and re-run in the main checkout after the fast-forward. The phase-3 gate (`tsc --noEmit && vitest run tests/core/ai tests/core/ai/persona`) passes: 17 files / 153 tests.

**Production pipeline status:** The three structural defects that dead-ended the chat pipeline are removed. Production is now functional WITHOUT test-only seeding:
- CR-01: per-route provider instances carry the merged endpoint + decrypted apiKey + resolved model, so the planner's `requestJson` no longer throws and cloud auth headers are present.
- CR-02: the D-52 model cache is seeded from the disk model list at `hydrate()` and written by Options tier discovery (`refreshModels`), so `resolveTier` resolves for a configured operator instead of always returning `configuration_required`.
- CR-03/CR-04/CR-05/CR-06: wire-level empty/error-first streams fall back instead of locking; Gemini keeps text co-located with `finishReason`; Anthropic/Gemini bodies are strict-validation-safe; renderer mid-stream errors surface and are never persisted as completed turns.

The remaining `__test__.seedCachedModels` calls in tests (TierResolver/AgentOrchestrator/chat-integration) seed the same values `hydrate()` now derives from the disk `detail.models` list — they exercise resolution logic, they do not hide a broken production path.

## Fixed Issues

### CR-01: Provider instances never receive the configured model or apiKey — planner always throws, cloud auth always absent

**Files modified:** `src/core/ai/ProviderRegistry.ts`, `src/core/ai/AgentOrchestrator.ts`, `src/components/chat/useChatStreaming.ts`, `tests/core/ai/ProviderRegistry.test.ts`
**Commit:** `1e0f98f`
**Applied fix:** Added `ProviderRegistry.buildForRoute(providerId, { model, apiKey })` which constructs a fresh per-route adapter instance from the D-50-merged endpoint + decrypted key + resolved model (caller-registered test fixtures route through as-is; OpenAICompat is always rebuilt with the assigned endpoint + key + model). `AgentOrchestrator.resolveStageProvider` now builds per-route candidates for every enabled provider instead of consuming the config-empty module-load singletons, and `AgentTurnInput` gained `providerSecrets` (decrypted keys supplied by the chat hook from `useExtensionStore` — V6: the registry never decrypts). The planner's `requestJson` now runs on an instance with a resolved model, and cloud `stream()` requests carry real auth headers.

### CR-02: TierResolver always returns null in production — the D-52 model cache is never populated

**Files modified:** `src/core/ai/ProviderRegistry.ts` (hydrate), `src/components/options/OptionsPage.tsx` (discovery path — see WR-04)
**Commit:** `1e0f98f` (hydrate seed) + `89f0813` (Options discovery)
**Applied fix:** `hydrate()` seeds the D-52 session cache from the disk `detail.models` list (stale-but-present beats never-populated), so a configured operator's persisted `fastModel`/`balancedModel` resolve immediately. Options tier discovery routes through `ProviderRegistry.refreshModels`, which writes the same cache — discovery work is no longer thrown away. A missing cache is now the only case that stays unresolved (truly unconfigured).

### CR-03: Router locks a provider on STREAM_START, which fires before any text — fallback/retry defeated on wire-level failures

**Files modified:** `src/core/ai/ProviderRouter.ts`, `tests/core/ai/ProviderRouter.test.ts`, `src/core/ai/StreamAdapter.ts` (deferred START — WR-05)
**Commit:** `6eb7364` + `7e41606`
**Applied fix:** `runAttempt` locks only on `STREAM_DELTA`; a bare `STREAM_START` stays buffered and continues consuming. An empty/truncated/error-first stream now surfaces `STREAM_ERROR` pre-first-token and the §1.5 fallback chain engages (single provider retried once). Added router test: a `STREAM_START`→`STREAM_ERROR` provider (zero tokens) falls back to the next candidate; the empty-completed defensive branch is unchanged.

### CR-04: Gemini wire parser drops text co-located with `finishReason` in the same chunk

**Files modified:** `src/core/ai/StreamAdapter.ts`, `tests/core/ai/fixtures/gemini-stream.ts`, `tests/core/ai/StreamAdapter.test.ts`
**Commit:** `7e41606`
**Applied fix:** `parseGeminiDataLine` parses `parts[].text` deltas FIRST, then checks `finishReason` for the terminator — a single chunk carrying both text and `"STOP"` now yields `STREAM_DELTA` + `STREAM_COMPLETE` instead of an empty answer. Added the review-specified fixture (`{"candidates":[{"content":{"parts":[{"text":"Yes"}]},"finishReason":"STOP"}]}`) and a conformance test.

### CR-05: Renderer options passthrough (`{maxTokens, tier}`) breaks Anthropic and Gemini requests

**Files modified:** `src/core/ai/RendererService.ts`, `tests/core/ai/RendererService.test.ts`
**Commit:** `6617fb6`
**Applied fix:** `RendererService.render` no longer forwards renderer-internal options into the provider request body — `LLMStreamRequest.options` is omitted entirely. The §1.3 cap stays enforced by the client-side char counter (authoritative); Anthropic keeps its own required `max_tokens`, Gemini's `generationConfig` stays strict-validation-safe. Added a body-shape test asserting the request carries no options.

### CR-06: Renderer mid-stream error is silently persisted as a completed turn

**Files modified:** `src/core/ai/AgentOrchestrator.ts`, `tests/core/ai/AgentOrchestrator.test.ts`
**Commit:** `1e0f98f`
**Applied fix:** `finish()` throws a typed `ProviderError` (canonical code + message from `rendered.error`) when `terminatedBy === 'error'` — the partial is dropped, `persistTurn` is never invoked, and the caller surfaces the failure. Added an orchestrator test: a delta-then-`STREAM_ERROR` fixture rejects with the provider message and the seam does not fire.

### WR-01: requestJson D-54a guard throws `NETWORK` instead of `PROVIDER_MODEL_UNKNOWN`

**Files modified:** `src/core/ai/providers/base.ts`, `src/core/ai/providers/AnthropicProvider.ts`, `src/core/ai/providers/GeminiProvider.ts`
**Commit:** `c05daa7`
**Applied fix:** All three `requestJson` no-model guards now throw `ProviderError('PROVIDER_MODEL_UNKNOWN', …)` — the non-retryable code (CB vote 0) `stream()` already uses — so a configuration error never casts breaker votes or triggers fallback attempts.

### WR-02: Planner 3s timeout surfaces as AbortError — turn silently dropped with no error surfaced

**Files modified:** `src/core/ai/StructuredOutput.ts`, `tests/core/ai/StructuredOutput.test.ts`
**Commit:** `eee6939`
**Applied fix:** `StructuredOutput` tracks whether the internal §1.2 timeout fired; when it did, the provider's AbortError is rethrown as a `ProviderError('TIMEOUT', …)`. The caller's own abort still propagates as AbortError (unchanged). `useChatStreaming`'s catch no longer sees the timeout as a user stop — the turn surfaces the failure. Added a timeout test.

### WR-03: Prompt-cache machinery has zero production callers — the "cost-effective" value is unwired

**Files modified:** `src/core/ai/AgentOrchestrator.ts`
**Commit:** `1e0f98f`
**Applied fix:** Implemented the review's stated minimum — the deliberate deferral is documented in code at the orchestrator's `stagePrompt` choke-point: sections are flattened to the single string the provider body requires, and `applyCacheHints`/`recordCacheResult` wiring is deferred to the phase that restructures provider request bodies around the section metadata (the flattened string loses the section boundaries the hints require). Full per-provider `cache_control`/`cachedContent` wiring is out of Phase-3 scope and would have expanded the fix unreasonably.

### WR-04: Options model discovery bypasses the registry D-52 cache

**Files modified:** `src/components/options/OptionsPage.tsx`
**Commit:** `89f0813`
**Applied fix:** `handleDiscoverTierModels` now calls `ProviderRegistry.refreshModels(providerId, apiKey)` (D-50-merged endpoint internally) instead of `fetchProviderModels` directly — the discovered lists write the D-52 cache that `TierResolver` validates against.

### WR-05: Anthropic `event:` header tracked but never validated; STREAM_START contract drift

**Files modified:** `src/core/ai/StreamAdapter.ts`, `tests/core/ai/StreamAdapter.test.ts`
**Commit:** `7e41606`
**Applied fix:** (1) The `event:` header is now consumed by exactly one `data:` payload and validated against the payload's authoritative `type` — a mismatch surfaces `STREAM_ERROR` (malformed wire, never silently accepted); the stale-state bug is gone. (2) `STREAM_START` emission is deferred until a `STREAM_DELTA` is actually parsed, so the documented contract ("STREAM_START precedes the first delta") holds and error/empty-first streams carry no START (the CR-03 lock prerequisite). Added a test asserting an error-first stream emits no STREAM_START.

### WR-06: `localhost:12380` can still be persisted as an OpenAI endpoint override

**Files modified:** `src/components/options/OptionsPage.tsx`, `tests/components/OptionsPage.test.tsx`
**Commit:** `89f0813`
**Applied fix:** The OpenAI modal pre-fill is now the §10.6 canonical endpoint (`https://api.openai.com/v1`), and `handleSaveProviderModal` skips writing an override when the proxy field equals the provider's `defaultProxy` (an untouched pre-fill is not operator intent — it removes any previous override for that provider). Added a regression test: saving with the untouched default persists no override.

### WR-07: `useChatStreaming` hardcodes demo follow-ups and interpolates raw error text into the assistant message

**Files modified:** `src/components/chat/useChatStreaming.ts`
**Commit:** `1e0f98f`
**Applied fix:** The hardcoded demo follow-up chips are removed (`followups: []` until RICH-C wiring). Turn failures now surface via a dedicated `antMessage.error` toast; the assistant placeholder is finalized without an error note interpolated into its content.

### IN-01: `ActiveStreamState` is declared but never used

**Files modified:** `src/core/runtime/workerState.ts`
**Commit:** `da136a4`
**Applied fix:** Marked reserved-for-later in the type's doc comment (the §20.6 type-only deliverable is retained; the event→state mapping is not yet wired).

### IN-02: `PROMPTS.renderer.tier = 'balanced'` contradicts the D-55 fast-tier mapping

**Files modified:** `src/core/prompts/index.ts`
**Commit:** `da136a4`
**Applied fix:** Aligned `renderer.tier` to `'fast'` (D-55 / AgentOrchestrator hardcodes the renderer stage to `fast`).

### IN-03: `EXECUTOR_SYSTEM` reserved string is not a canonical Appendix A entry

**Files modified:** `src/core/ai/PromptCacheManager.ts`
**Commit:** `da136a4`
**Applied fix:** Added a tracked `TODO(Phase 18 — Tool Governance)` reference on the reserved executor string so the tool-owning phase replaces it with a canonical Appendix A entry before the executor stage ever reaches a model.

## Skipped Issues

None — all 16 findings in scope were fixed.

---

_Fixed: 2026-08-28T09:00:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_