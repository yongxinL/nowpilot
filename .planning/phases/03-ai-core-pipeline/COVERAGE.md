# Phase 3 — API Coverage Decision Matrix

**Default:** FULL COVERAGE — every capability starts as INTEGRATE. Matrix is the subtraction record.

| Capability | Decision | Reason |
|---|---|---|
| Connection validation (`validateConnection`) | INTEGRATE | All 4 providers need connection validation; success criterion #1 requires each validates connection. |
| Model listing (`listModels`) | INTEGRATE | ProviderAdapter exposes model listing for ProviderRouter tier selection; dynamic model discovery per provider. |
| Structured output support (`supportsStructuredOutput`) | INTEGRATE | Capability detection flag per D-04. OpenAI/Anthropic/Gemini = true; Ollama = false (model-dependent). |
| Prompt caching (`getCacheStrategy`) | INTEGRATE | Per D-02. Anthropic: ephemeral; Gemini: cachedContent; OpenAI/Ollama: prefix-only. |
| Tier model mapping (`getDefaultModelForTier`) | INTEGRATE | Per D-08. Each adapter maps FAST/BALANCED/ADVANCED to provider-specific defaults with user-overridable presets. |
| Telemetry metadata (`getTelemetryMetadata`) | INTEGRATE | Per D-02. Each adapter provides provider-specific metadata for Phase 6 AITransactionLog. |
| Streaming (`streamText` via AI SDK) | INTEGRATE | All providers support streaming via AI SDK. Ollama via `ollama-ai-provider` (OpenAI-compatible mode). |
| Non-streaming generation (`generateText`) | INTEGRATE | Used by RendererService.synthesize() and PlannerService Ollama fallback path. All providers support. |
| Tool calling (via AI SDK `tools` option) | INTEGRATE | Passed through ProviderRouter to AI SDK; all providers support per D-01. |
| Abort handling (`abortSignal` propagation) | INTEGRATE | AI SDK auto-forwards abortSignal; no per-provider implementation needed. |
| Persona injection (system prompt prepend) | INTEGRATE | PersonaInjector is provider-agnostic; works across all 4 providers. Strategic injection path per D-09. |
| Structured output repair (one-shot JSON) | INTEGRATE | Fallback path applicable to any provider when structured output unavailable. Ollama primary consumer. |
| Tier resolution (FAST/BALANCED/ADVANCED → model) | INTEGRATE | TierResolver + ProviderAdapter.getDefaultModelForTier() compose to map tiers across providers. |
| Circuit breaker / fallback | INTEGRATE | ProviderRouter operates across all 4 providers. No provider-specific circuit breaker logic. |

**Summary:** 14/14 capabilities INTEGRATE, 0 OPT-OUT. Full coverage across all 4 AI providers.
