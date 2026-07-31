# API Coverage — Vercel AI SDK (ai + @ai-sdk/provider packages)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Phase 4 external API surface: the Vercel AI SDK (`ai@7`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) exercised through the provider adapters in `src/core/ai/providers/`. Capabilities below were enumerated from live imports in `src/` at phase-seal time.

| capability | decision | reason |
|---|---|---|
| generateText (non-streaming generation) | INTEGRATE | Compression AI summarization (ContextCompressor), rendering (RendererService), planning (PlannerService), structured output (StructuredOutput) |
| streamText (streaming) | INTEGRATE | StreamAdapter + aiProvider service (Phase 3); accepts `tools:` passthrough |
| structured output (Output / Output.object) | INTEGRATE | PlannerService dual-mode plan extraction |
| step-count control (isStepCount) | INTEGRATE | PlannerService |
| prompt cache hints (cache_control breakpoints / cachedContent) | INTEGRATE | PromptCacheAdapter per Appendix K (this phase) |
| native token counting (countTokens) | INTEGRATE | ProviderAdapter.countTokens() extension (this phase) |
| provider factories (createOpenAI / createAnthropic / createGoogle) | INTEGRATE | ProviderRouter model resolution, fallback + circuit breakers (Phase 3) |
| tool calling | INTEGRATE | Transport-level passthrough (StreamAdapter) + ExecutorService tool validation (Phase 3); tool registry/invocation lands with MCP tool ecosystem in Phase 8 |

Note: phase 4 introduces no new external service beyond the AI SDK surface already consumed by Phase 3; the phase extends it with prompt-cache hints and native token counting.
