# Phase 3 — Vercel AI SDK API Coverage Matrix

**Generated:** 2026-08-11 (gap-closure replan 03-10..03-14)
**Policy:** Full API coverage by default — every capability is INTEGRATE unless explicitly OPT-OUT with a reason.
**Scope:** The ai@4 / @ai-sdk surface the phase integrates. The already-executed plans 03-01..03-09 integrated the core invocation surface; this replan adds NO new SDK capabilities (all five gap fixes operate below the SDK call sites).

## Integrated Surface (already shipped by 03-01..03-09 — preserved, not re-planned)

| # | SDK Capability | Decision | Consumer | Evidence |
|---|----------------|----------|----------|----------|
| 1 | `streamText({ model, messages, maxTokens, maxRetries, abortSignal })` | **INTEGRATE** | RendererService.render (Seam 3) | `RendererService.ts:78-84`; `maxRetries: 0` (Pitfall 1, D-17) |
| 2 | `generateObject({ model, schema, mode, messages, maxTokens, maxRetries, abortSignal })` | **INTEGRATE** | ProviderRouter.invokeJsonMode — native jsonMode (D-18) | `ProviderRouter.ts:645-654`; `jsonSchema()` wrapper; mode `'auto'` |
| 3 | `generateText({ model, messages, maxTokens, maxRetries, abortSignal })` | **INTEGRATE** | ProviderRouter.invokeJsonMode — prompt jsonMode (D-18 ollama default) | `ProviderRouter.ts:658-670`; schema embedded in [SYSTEM] |
| 4 | Provider adapters: `createOpenAI` / `createAnthropic` / `createGoogleGenerativeAI` (+ OpenAI-compatible `baseURL` variant) | **INTEGRATE** | ILLMProvider.getAISDKModel (Seam 1) + 5 adapters | `ILLMProvider.ts`; `providers/{OpenAI,Anthropic,Gemini,Ollama,OpenAICompat}Provider.ts` |
| 5 | `providerOptions` threading (anthropic `cacheControl` ephemeral) | **INTEGRATE** | PromptCacheAdapter.applyCacheHints + Router F-5 buildStageMessages | `PromptCacheAdapter.ts`; `ProviderRouter.ts:239-258` |
| 6 | `CallSettings`: `maxTokens` (explicit), `maxRetries: 0`, `abortSignal` threaded | **INTEGRATE** | every constructed SDK call (Router + Renderer) | grep: no constructed call without `maxTokens` + `maxRetries: 0` |
| 7 | `APICallError` / `NoObjectGeneratedError` / `LoadAPIKeyError` error classes (`instanceof` checks) | **INTEGRATE** | ProviderRouter.classifyProviderError | `ProviderRouter.ts:485-515`; test mock keeps real classes |

## Opt-Out Surface (decision + reason)

| # | SDK Capability | Decision | Reason |
|---|----------------|----------|--------|
| 8 | `tool()` / `tools` / `maxSteps` (SDK tool-calling machinery) | **OPT-OUT** | R-4: Planner *requests*, deterministic ExecutorService *validates + runs* (§1.2); `generateObject` in ai@4 has no `tools` param and `maxSteps` stays default 1. Phase-8 MCP tools still run through ExecutorService, never the SDK loop |
| 9 | `structuredOutput()` helper | **OPT-OUT** | requestJson (Appendix L) + `generateObject` mode `'auto'` covers structured output with the one-repair loop owned by app code (Golden Rule 4); the helper adds no capability the phase needs |
| 10 | `fullStream` / `onError` / stream event parts | **OPT-OUT** | Pitfall 5 handled by awaiting `textStream` (throws) + `result.finishReason` (promise); no event-part consumption needed on the Planner→Executor→Renderer path |
| 11 | `embed()` / `embedMany()` (embeddings) | **OPT-OUT** | Retrieval is MiniSearch (Phase 5) — no embeddings in v0.1 |
| 12 | Message-conversion helpers (`convertToLanguageModelMessages`, `convertUIMessage`…) | **OPT-OUT** | F-5 `buildStageMessages` owns the messages[] shape directly; no UI-message conversions on the runtime path |
| 13 | Experimental features / `experimental_*` exports | **OPT-OUT** | Stability policy; nothing experimental is required by the locked Appendix I/L contracts |
| 14 | Telemetry (`experimental_telemetry`) | **OPT-OUT** | Privacy-first (R-10); no telemetry in v0.1 |
| 15 | SDK-internal retries (`maxRetries > 0`) | **OPT-OUT** | D-17/R-2: the Router is the first retry layer; every call pins `maxRetries: 0` (ai@4 silently defaults to 2 — a hidden 4th layer) |

## Changes Introduced by This Replan

None — the gap fixes (CR-01 budget retryCount, WR-02 breaker wiring, WR-03 timeout origin, WR-01 gate, WR-04 retry targeting) operate entirely in app code above/below the SDK call sites. The SDK surface matrix above is unchanged by 03-10..03-14.

_Seal gate: `check.api-coverage.verify-pre` validates this file at verify:pre._
