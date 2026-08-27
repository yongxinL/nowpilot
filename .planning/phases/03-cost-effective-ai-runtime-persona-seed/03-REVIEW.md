---
phase: 03-cost-effective-ai-runtime-persona-seed
reviewed: 2026-08-28T09:30:00Z
depth: deep
files_reviewed: 31
files_reviewed_list:
  - src/core/ai/types.ts
  - src/core/ai/ILLMProvider.ts
  - src/core/ai/StreamAdapter.ts
  - src/core/ai/StructuredOutput.ts
  - src/core/ai/PlannerService.ts
  - src/core/ai/ChunkBuffer.ts
  - src/core/ai/PromptCacheAdapter.ts
  - src/core/ai/PromptCacheManager.ts
  - src/core/ai/toolSchemas.ts
  - src/core/ai/ExecutorService.ts
  - src/core/ai/RendererService.ts
  - src/core/ai/ProviderRegistry.ts
  - src/core/ai/TierResolver.ts
  - src/core/ai/ProviderRouter.ts
  - src/core/ai/AgentOrchestrator.ts
  - src/core/ai/UserPreferences.ts
  - src/core/ai/persona/PersonaProfile.ts
  - src/core/ai/persona/PersonaInjector.ts
  - src/core/ai/providers/base.ts
  - src/core/ai/providers/OpenAIProvider.ts
  - src/core/ai/providers/OpenAICompatProvider.ts
  - src/core/ai/providers/OllamaProvider.ts
  - src/core/ai/providers/AnthropicProvider.ts
  - src/core/ai/providers/GeminiProvider.ts
  - src/core/prompts/index.ts
  - src/core/runtime/workerState.ts
  - src/core/storage/WriteJournal.ts
  - src/types/storage.ts
  - src/services/aiProvider.ts
  - src/components/chat/useChatStreaming.ts
  - src/components/options/OptionsPage.tsx
findings:
  critical: 6
  warning: 7
  info: 3
  total: 16
status: clean
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-28T09:30:00Z
**Depth:** deep (cross-file import graph, call-chain tracing, abort/stream race analysis)
**Files Reviewed:** 31 source files (plus 22 test files read for verification)
**Status:** issues_found

## Summary

The phase delivers an impressively complete AI runtime surface — five provider adapters, a four-wire SSE parser, an Appendix I orchestrator, prompt-cache scaffolding, and a journaled persist seam — with a green 142-test gate. However, deep cross-file tracing shows the **production chat pipeline cannot complete a single turn as shipped**, and the test suite does not catch it because every test seeds the two module-level dependencies that production never populates (`__test__.seedCachedModels` and fixture providers with constructor config).

Three structural defects chain together to dead-end the pipeline:

1. **Provider instances never receive the configured model or apiKey.** The registry hands out module-load singletons constructed with empty configs (`new OpenAIProvider()`), the disk `np_providers` apiKey (an `EncryptedBlob`) stays opaque in the `normalized` map, and the router's per-candidate model resolution feeds only `stream()` (via `request.model`). `requestJson` has no model parameter and throws on the singleton's `undefined` model — so the **planner stage always throws**, and cloud providers always send keyless requests → 401.
2. **`resolveTier` always returns null in production.** The D-52 model cache is populated only by `ProviderRegistry.refreshModels`, which has zero production callers; Options' discovery path (`fetchProviderModels`) bypasses the cache. `getCachedModels` is therefore always `undefined` → every turn resolves to `configuration_required`.
3. **The router locks a provider on `STREAM_START`, which the adapter emits before any text** (and even on empty/error-first streams) — defeating the §1.5 first-token fallback protection for exactly the wire-failure cases REQ-R09 was built to catch.

Additional correctness bugs: Gemini drops text co-located with `finishReason` in one chunk; Anthropic/Gemini reject the renderer's `{maxTokens, tier}` options passthrough (strict unknown-field validation → 400); and renderer `STREAM_ERROR` mid-stream is silently persisted as a completed turn.

The prompt-cache machinery (`applyCacheHints`, `recordCacheResult`) — the phase's "cost-effective" value proposition — has zero production callers; the orchestrator flattens sections to a string.

## Critical Issues

### CR-01: Provider instances never receive the configured model or apiKey — planner always throws, cloud auth always absent

**File:** `src/core/ai/AgentOrchestrator.ts:153-175` (+ `src/core/ai/ProviderRegistry.ts:137-179,222-232`, `src/core/ai/providers/base.ts:289-296`, `src/core/ai/providers/AnthropicProvider.ts:152-159`, `src/core/ai/providers/GeminiProvider.ts:158-162`)

**Issue:** The five provider singletons are constructed at module load with empty configs (`new OpenAIProvider()`, etc. — no `apiKey`, no `model`). `hydrate()` stores the disk apiKey (an `EncryptedBlob`, never decrypted per V6) only in the `normalized` map; nothing ever constructs a per-route instance with the decrypted key or resolved model. Consequences, traced end-to-end:

- **Planner stage always fails:** `runAgentTurn` routes, then calls `plannerStage.provider.requestJson(prompt, jsonSchema, signal)` (line 258-259). The D-47 interface carries no model on `requestJson`, and the singleton's `this.model` is `undefined`, so the D-54a guard in `base.ts:290-295` throws `ProviderError('NETWORK', 'no model resolved for requestJson …')` on **every** planner call.
- **Cloud providers always 401:** `stream()` uses `request.model` (which the router does supply), but `authHeaders()` emits no `Authorization`/`x-api-key`/`x-goog-api-key` because `this.apiKey` is `undefined` on the singletons. Every OpenAI/Anthropic/Gemini request goes out keyless → 401 → `PROVIDER_AUTH` → breaker opens after one vote.
- `OpenAICompatProvider` registered at hydrate (`ProviderRegistry.ts:246`) gets `{ baseUrl }` only — the operator's key for `openai-compat` cannot reach it either (no disk entry; `DISK_TO_RUNTIME` has no compat key).

The 03-05 summary claims "the registry constructs per-route provider instances from getEndpointFor() + normalized apiKey when 03-06 needs override-merged configs" — that construction does not exist in code. The human smoke checkpoint likely exercised Ollama or a key-injecting proxy; the shipped path cannot work.

**Fix:** Construct per-route provider instances with the resolved config, e.g. add `ProviderRegistry.buildForRoute(providerId, { model, apiKey })` that builds a fresh adapter instance from the merged endpoint + decrypted key + resolved model, and have `resolveStageProvider`/`runAttempt` use those instances. Alternatively extend `LLMJsonRequest` with a `model` field and thread the resolved model + key per request. This is the single highest-priority fix.

### CR-02: TierResolver always returns null in production — the D-52 model cache is never populated

**File:** `src/core/ai/TierResolver.ts:108-114` (+ `src/core/ai/ProviderRegistry.ts:293-318`, `src/components/options/OptionsPage.tsx:485-513`)

**Issue:** `resolveTier` requires `ProviderRegistry.getCachedModels(providerId)` to be defined and contain the persisted model (`cached !== undefined && cached.includes(model)`). The cache is written **only** by `ProviderRegistry.refreshModels` — which has **zero production callers** (grep-verified: only the registry's own export and `__test__` seams). Options' discovery (`handleDiscoverTierModels`, OptionsPage:496) calls `fetchProviderModels` directly and never touches the registry cache. Therefore in a fresh session `getCachedModels` is always `undefined` and `resolveTier` always returns `null` → every `runAgentTurn` returns the `configuration_required` outcome with zero provider calls. Even a fully-configured user (models assigned in Options, providers enabled) can never chat.

Every test seeds the cache via `registryTest.seedCachedModels(...)` (AgentOrchestrator.test.ts:109, TierResolver.test.ts:52-54, chat-integration.test.ts:74), which is why the 142-test gate is green while production is dead.

**Fix:** Populate the cache from a production path — e.g. call `ProviderRegistry.refreshModels()` per enabled provider at boot (after `hydrate()`), and/or have `handleDiscoverTierModels` route through `refreshModels` so discovery writes the cache. At minimum, seed the cache from the disk `detail.models` list at hydrate (stale-but-present beats never-populated), and treat a missing cache as "discovery pending" rather than an unconditional null.

### CR-03: Router locks a provider on STREAM_START, which fires before any text — fallback/retry defeated on wire-level failures

**File:** `src/core/ai/ProviderRouter.ts:398-411` (+ `src/core/ai/StreamAdapter.ts:228-237,282-302`)

**Issue:** `runAttempt` treats `STREAM_START` as the first-token lock point. But `StreamAdapter.emitDelta` emits `STREAM_START` on the **first push/end that produces any parsed line**, even when that line yields zero deltas — an Anthropic `message_start`/`ping`, a Gemini chunk with no text parts, or an OpenAI role-only delta all trigger it. Worse, `end()` on an empty/truncated stream emits `[STREAM_START, STREAM_ERROR]` in the same batch (StreamAdapter.ts:291-301), and an Anthropic `error` event as the first payload does the same. The router sees `STREAM_START` first → locks the provider → replays the subsequent `STREAM_ERROR` to the caller with **no fallback, no retry** — even though zero tokens were produced. This contradicts the 03-05 summary's claim that "StreamAdapter emits it only in the same batch as the first delta," and it silently defeats the §1.5 fallback contract (DONE-when 2) for exactly the empty/truncated/error-first streams REQ-R09 was designed to catch. Only HTTP-level failures (non-ok status) still fall back, because those yield `STREAM_ERROR` without the adapter.

**Fix:** Lock only on `STREAM_DELTA` (drop `STREAM_START` from the lock condition), or make the adapter defer `STREAM_START` until a delta is actually parsed (buffer the start event). Add a router test: provider returns a 200 stream that ends without terminator → must fall back to the next candidate, not lock.

### CR-04: Gemini wire parser drops text co-located with `finishReason` in the same chunk

**File:** `src/core/ai/StreamAdapter.ts:141-162`

**Issue:** `parseGeminiDataLine` returns `STREAM_COMPLETE` immediately when `candidates[0].finishReason` is present, discarding any `parts[].text` in the same chunk. The Gemini SSE wire commonly delivers short completions as a **single chunk containing both the text and `finishReason:"STOP"`**. Such responses render as an **empty answer** (fullText ''), and the empty answer is then persisted by the turn-end seam. The conformance fixtures (gemini-stream.ts:18-19) always send text and finishReason in separate chunks, so the failure mode is untested.

**Fix:** Parse parts and the terminator in one pass — emit the text deltas first, then `STREAM_COMPLETE`, e.g. collect part texts before checking `finishReason`; add a fixture with `{"candidates":[{"content":{"parts":[{"text":"Yes"}]},"finishReason":"STOP"}]}`.

### CR-05: Renderer options passthrough (`{maxTokens, tier}`) breaks Anthropic and Gemini requests

**File:** `src/core/ai/RendererService.ts:95` (+ `src/core/ai/providers/base.ts:233-238`, `src/core/ai/providers/AnthropicProvider.ts:102-109`, `src/core/ai/providers/GeminiProvider.ts:109-115`)

**Issue:** `render()` passes `options: { maxTokens: maxOutputTokens, tier: input.tier }`, and every provider spreads `...request.options` into its request body. The Anthropic Messages API validates strictly — unknown top-level fields (`maxTokens`, `tier`) return 400 "extra fields are not permitted" — and Gemini validates `generationConfig` strictly (`maxTokens`/`tier` are not valid fields; Gemini's key is `maxOutputTokens`). So the renderer stage 400s on every call to Anthropic or Gemini. OpenAI-wire providers tolerate the extra fields but the intended server-side token cap is silently ignored (the local char counter still enforces a rough cap). Provider request shapes are only tsc/grep-verified per the summaries (D1/D2 `human_judgment: true`) — no test exercises the body construction.

**Fix:** Don't forward renderer-internal options into the provider body. Either filter options per provider (map `maxTokens` → `max_tokens`/`maxOutputTokens`, drop `tier`), or move the cap entirely to the client-side counter and omit `options` for native providers. Add a body-shape unit test per provider.

### CR-06: Renderer mid-stream error is silently persisted as a completed turn

**File:** `src/core/ai/AgentOrchestrator.ts:205-222` (+ `src/core/ai/RendererService.ts:132-137`)

**Issue:** `finish()` only distinguishes `terminatedBy === 'aborted'`. When the renderer stream hits `STREAM_ERROR` mid-stream (e.g. network drop after the first token — common), `RendererService.render` returns `{ streamedText: <partial>, terminatedBy: 'error', error: {code, message} }`, and `finish()` ignores `rendered.error`, assembling a normal `AgentTurnOutput` and invoking `persistTurn` — **persisting a truncated/erroneous partial answer as a completed turn** in ChatHistoryDB with no error marker. The user sees a cut-off answer and no failure signal. This is exactly the "stream dies mid-stream → error surfaces to the caller" path the router deliberately does not re-route.

**Fix:** In `finish()`, when `rendered.terminatedBy === 'error'`, either throw a typed error (caller surfaces it; no persist) or return an output with an error marker and skip `persistTurn`. Add an orchestrator test with a stream-then-STREAM_ERROR fixture asserting the seam does not fire and the error surfaces.

## Warnings

### WR-01: requestJson D-54a guard throws `NETWORK` instead of `PROVIDER_MODEL_UNKNOWN`

**File:** `src/core/ai/providers/base.ts:290-295` (+ `AnthropicProvider.ts:152-159`, `GeminiProvider.ts:158-162`)

**Issue:** The three requestJson D-54a guards throw `ProviderError('NETWORK', …)` while `stream()` uses `PROVIDER_MODEL_UNKNOWN` for the identical condition. `NETWORK` is retryable with CB vote 1 per the locked §20.10 table — so a configuration error (no model) would be treated as a transient network failure, casting breaker votes and triggering fallback attempts instead of the non-retryable `PROVIDER_MODEL_UNKNOWN` (vote 0). Same condition, different canonical codes (D-38 discipline broken).

**Fix:** Use `'PROVIDER_MODEL_UNKNOWN'` in all three requestJson guards (or drop the guard and rely on CR-01's per-route construction).

### WR-02: Planner 3s timeout surfaces as AbortError — turn silently dropped with no error surfaced

**File:** `src/core/ai/StructuredOutput.ts:54-65` (+ `src/components/chat/useChatStreaming.ts:243-246`)

**Issue:** The §1.2 timeout aborts an internal `AbortController`, and the provider's `requestJson` converts that into `DOMException('aborted','AbortError')`. `useChatStreaming`'s catch treats any AbortError as a user abort and returns silently — so a planner timeout drops the user's turn with no error message, no retry, nothing persisted. A timeout is indistinguishable from a user stop. (Anthropic's Messages API is slow; 3s is tight.)

**Fix:** Make `StructuredOutput` distinguish internal timeout from caller abort (e.g. wrap the timeout as a `TIMEOUT`-coded `ProviderError`), and have `useChatStreaming`/orchestrator surface it distinctly.

### WR-03: Prompt-cache machinery has zero production callers — the "cost-effective" value is unwired

**File:** `src/core/ai/AgentOrchestrator.ts:125-132` (+ `src/core/ai/PromptCacheAdapter.ts:25`, `src/core/ai/PromptCacheManager.ts:140`)

**Issue:** `applyCacheHints` and `recordCacheResult` are called only from tests. The orchestrator flattens `buildSystemPrompt(...).sections` into a plain string (`sections.map(s => s.text).join('\n\n')`), discarding the section metadata, and never applies per-provider cache hints. The `cacheKeyHash`/`cacheDisabled` fields are likewise unused. The phase's central prompt-caching value proposition is declared but not wired into the runtime path.

**Fix:** Route stage prompts through `applyCacheHints(providerId, sections)` and pass the adapted shape into the provider request (Anthropic `cache_control`, Gemini `cachedContent`); drive `recordCacheResult` from provider responses. At minimum, document the deliberate deferral in code.

### WR-04: Options model discovery bypasses the registry D-52 cache

**File:** `src/components/options/OptionsPage.tsx:485-513`

**Issue:** `handleDiscoverTierModels` calls `fetchProviderModels(...)` directly; the discovered lists are rendered into the selectors but never stored in `ProviderRegistry`'s model cache. This is the fix path for CR-02 — the discovery work is done, then thrown away.

**Fix:** Call `ProviderRegistry.refreshModels(providerId, apiKey)` instead (or in addition) so Options discovery populates the cache TierResolver validates against.

### WR-05: Anthropic `event:` header tracked but never validated; STREAM_START contract drift

**File:** `src/core/ai/StreamAdapter.ts:39,242-249,228-237`

**Issue:** `pendingEventType` is written on `event:` lines and never read — the parser dispatches solely on the payload's `type`, so a wire that mismatches `event:` and `data:` type fields is silently accepted (dead state + missed malformed-wire detection). Separately, the documented contract "STREAM_START precedes the first delta" (types.ts:71, 03-05 summary) is not what the adapter does: it emits STREAM_START on the first chunk containing any line. Fixing WR-05's start semantics is a prerequisite for CR-03's fix.

**Fix:** Either validate `pendingEventType` against the payload type (emit STREAM_ERROR on mismatch) or remove the field; and defer STREAM_START emission until a delta is parsed (see CR-03).

### WR-06: `localhost:12380` can still be persisted as an OpenAI endpoint override

**File:** `src/components/options/OptionsPage.tsx:92,312-326`

**Issue:** The modal pre-fills `proxyUrl` with the legacy default `http://localhost:12380/v1` (PROVIDER_INFO.openai.defaultProxy). `handleSaveProviderModal` writes the override whenever the proxy field is non-empty and http(s)-valid — so an operator who opens the OpenAI modal and saves without touching the proxy persists `localhost:12380/v1` into `np_endpoint_overrides`, which the registry then treats as the runtime endpoint. This contradicts the D-12/D-50 claim that "localhost:12380 never canonical" and silently re-introduces the legacy dev-proxy dependency.

**Fix:** Treat the legacy default as "no override": skip `writeEndpointOverride` when the URL equals `PROVIDER_INFO[providerId].defaultProxy`, or change the pre-fill to the §10.6 endpoint.

### WR-07: `useChatStreaming` hardcodes demo follow-ups and interpolates raw error text into the assistant message

**File:** `src/components/chat/useChatStreaming.ts:158-161,247-249`

**Issue:** Every new assistant placeholder carries hardcoded follow-up chips ("What are the core components of critical thinking?") — demo content shipped into the production path. Separately, raw error messages (`err.message`, which can include server-provided body text capped at 300 chars) are interpolated into the assistant message content — rendered as text (React-escaped, so low XSS risk) but surfaced as if the model said it.

**Fix:** Remove the hardcoded follow-ups (empty array until RICH-C wiring) and render errors via a dedicated UI state rather than inside the message content.

## Info

### IN-01: `ActiveStreamState` is declared but never used

**File:** `src/core/runtime/workerState.ts:18-38`

**Issue:** The §20.6 union type-checks but no module consumes it (grep: only comments reference it). The orchestrator/renderer emit canonical events; nothing maps them onto `ActiveStreamState`. Type-only deliverable — fine for the plan's contract, but the documented event→state mapping is unimplemented.

**Fix:** Wire the mapping in the orchestrator/useChatStreaming, or mark the type as reserved-for-later in a comment.

### IN-02: `PROMPTS.renderer.tier = 'balanced'` contradicts the D-55 fast-tier mapping

**File:** `src/core/prompts/index.ts:18-21` (+ `src/core/ai/AgentOrchestrator.ts:188`)

**Issue:** The canonical prompts carry tier metadata, and the renderer entry says `tier: 'balanced'`, while D-55 and the orchestrator hardcode the renderer stage to `fast`. The metadata is dead data today, but the inconsistency will mislead future tier wiring (PlannerService reads `PROMPTS.planner.tier` nowhere, so it's purely informational).

**Fix:** Align `renderer.tier` to `'fast'` or drop the tier field until a consumer exists.

### IN-03: `EXECUTOR_SYSTEM` reserved string is not a canonical Appendix A entry

**File:** `src/core/ai/PromptCacheManager.ts:46-47`

**Issue:** The executor stage string is a local constant (documented as never sent to a model in Phase 3, since zero tools are registered). Risk: once tools ship, the string becomes the executor system prompt without ever passing the Appendix A canonicalization review. The code comment flags this — consider an explicit Phase-4+ TODO with the owning phase reference.

**Fix:** Add a tracked TODO referencing the future tool-owning phase, as the comment suggests.

---

_Reviewed: 2026-08-28T09:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

## Fix Status

Applied by the fixer agent on 2026-08-28. All 6 CRITICAL + 7 WARNING findings are resolved (WR-03 via the review's documented-deferral minimum); the 3 INFO findings were also fixed (all trivial). Frontmatter `status:` set to `clean` — all in-scope findings resolved. Per-finding detail (files, commits) in `03-REVIEW-FIX.md`.

| Finding | Resolution |
|---------|-----------|
| CR-01 | fixed — per-route provider instances (merged endpoint + decrypted key + resolved model) via `ProviderRegistry.buildForRoute`; `providerSecrets` threaded through `runAgentTurn` |
| CR-02 | fixed — D-52 cache seeded from disk `detail.models` at hydrate; Options discovery writes the cache via `refreshModels` |
| CR-03 | fixed — router locks only on `STREAM_DELTA`; empty/error-first streams fall back (added router test) |
| CR-04 | fixed — Gemini parser emits co-located text deltas before `finishReason` terminator (added fixture + test) |
| CR-05 | fixed — renderer no longer forwards `{maxTokens, tier}` options into provider bodies (client-side cap authoritative; added body-shape test) |
| CR-06 | fixed — renderer mid-stream `STREAM_ERROR` throws a typed `ProviderError`; `persistTurn` never fires (added orchestrator test) |
| WR-01 | fixed — all three `requestJson` no-model guards throw `PROVIDER_MODEL_UNKNOWN` (non-retryable) |
| WR-02 | fixed — planner internal timeout rethrown as `TIMEOUT`-coded `ProviderError`; caller abort still propagates as AbortError (added timeout test) |
| WR-03 | fixed-partial — review's minimum implemented: deliberate deferral documented at the orchestrator `stagePrompt` choke-point; full `applyCacheHints`/`recordCacheResult` wiring deferred to the phase that restructures provider request bodies |
| WR-04 | fixed — Options tier discovery routes through `ProviderRegistry.refreshModels`, populating the D-52 cache |
| WR-05 | fixed — Anthropic `event:` header validated against payload type (mismatch → STREAM_ERROR); `STREAM_START` deferred until the first parsed delta (added test) |
| WR-06 | fixed — OpenAI modal pre-fills §10.6 endpoint; an untouched default proxy is never persisted as an override (added regression test) |
| WR-07 | fixed — demo follow-ups removed (`followups: []`); turn errors surface via a dedicated toast, never interpolated into message content |
| IN-01 | fixed — `ActiveStreamState` documented as reserved-for-later |
| IN-02 | fixed — `PROMPTS.renderer.tier` aligned to `'fast'` (D-55) |
| IN-03 | fixed — tracked `TODO(Phase 18)` on the reserved `EXECUTOR_SYSTEM` string |

Verification: `tsc --noEmit` clean (NP-STRICT ceiling 0) and full `pnpm test` green (46 files / 393 tests) — run in the isolated review-fix worktree, then re-confirmed in the main checkout after the branch fast-forward. Production chat pipeline is functional without `__test__.seedCachedModels` (remaining test seeds mirror the values hydrate now derives from disk).