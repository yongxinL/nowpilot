# API Coverage — Vercel AI SDK (ai + @ai-sdk/provider packages)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Phase 5 external API surface: the Vercel AI SDK (`ai@7`) exercised through the provider adapters in `src/core/ai/providers/` — the same surface declared in Phases 3 and 4. Phase 5 adds one new consumer: LLM conversation summarization in the memory subsystem. Capabilities below were enumerated from live imports in `src/` at phase-seal time.

| capability | decision | reason |
|---|---|---|
| generateText (non-streaming generation) | INTEGRATE | Conversation summarization at the 12-message boundary (D-10): `compactConversation()` calls `generateText` with a FAST-tier model, ≤500-char summary, messages preserved |
| tier resolution via `getDefaultModelForTier('FAST')` | INTEGRATE | Summarization must land on the cheapest capable tier per D-10; ProviderAdapter + TierResolver compose the model id (ConversationMemoryStore.ts:254) |
| provider factories (createOpenAI/Anthropic/Google/Ollama) | INTEGRATE | `ProviderAdapter.createLanguageModel(modelId)` resolves the FAST-tier model through the Phase 3 provider surface; no new provider wiring added this phase |
| streamText (streaming) | INTEGRATE | No new consumer this phase; unchanged from Phase 3 (StreamAdapter) |
| structured output (Output / Output.object) | INTEGRATE | No new consumer this phase; unchanged from Phase 3 (PlannerService) |
| tool calling | INTEGRATE | No new consumer this phase; unchanged from Phase 3 (ExecutorService) |
| native token counting (countTokens) | INTEGRATE | No new consumer this phase; unchanged from Phase 4 (ProviderAdapter extension) |
| prompt cache hints | INTEGRATE | No new consumer this phase; unchanged from Phase 4 (PromptCacheAdapter) |

Note: phase 5 introduces no new external service. The only addition to the AI SDK surface is the `generateText` call inside `compactConversation()` for the 12-message-boundary summarization (D-10), which routes through the existing FAST-tier model resolution and respects circuit-breaker/open-circuit semantics via ProviderAdapter (null-throw on open breaker → `PROVIDER_ERROR` fallback, messages never deleted).

**Summary:** 8/8 capabilities INTEGRATE, 0 OPT-OUT. Full coverage — no capability of the declared AI SDK surface is opted out in this phase.
