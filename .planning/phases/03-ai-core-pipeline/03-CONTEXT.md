# Phase 3: AI Core Pipeline - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver four AI provider adapters (OpenAI, Anthropic, Gemini, Ollama) wired through a PlannerService → ExecutorService → RendererService pipeline orchestrated by AgentOrchestrator, with ProviderRouter fallback/circuit-breaker, tier-based step limits, PersonaProfile + PersonaInjector seed, and streaming infrastructure (StreamAdapter + ChunkBuffer).

This is a core infrastructure phase — no UI surface changes. The existing `src/services/aiProvider.ts` (raw fetch, SSE) is replaced by this pipeline. `src/core/ai/` is greenfield. Future phases (Phase 4 ContextOptimizer, Phase 5 Memory, Phase 7 RICH UX) will consume the pipeline interfaces defined here.
</domain>

<decisions>
## Implementation Decisions

### Provider Abstraction Layer
- **D-01:** Use `@ai-sdk/*` v4 adapters as the primary runtime abstraction for `generateText`, `streamText`, `generateObject`, and tool calling. Do NOT define a full `ILLMProvider` interface that duplicates AI SDK functions — **Reversibility:** costly — rewiring every provider integration would require changing all call sites that consume the AI SDK API surface.
- **D-02:** Add a lightweight `ProviderAdapter` per provider for provider-specific concerns only: model resolution, prompt cache hints, connection validation, telemetry metadata, and capability detection (including `supportsStructuredOutput`). ProviderRouter sits above adapters, responsible for retries, fallbacks, circuit breakers, and tier-based model selection.

### Structured Output for PlannerService
- **D-03:** Capability-based dual-mode strategy for PlannerDecisionSchema (discriminated union: `answer` | `run_tool` | `ask_clarification`). Prefer `generateObject` with Zod schema when `ProviderAdapter.supportsStructuredOutput === true`. Fall back to `generateText` with JSON instructions + zod validation + one-shot repair (strip markdown fences, fix trailing commas, complete truncated JSON) for Ollama/low-capability models — **Reversibility:** costly — two code paths in PlannerService to maintain; changing the validation strategy would touch both paths.
- **D-04:** `ProviderAdapter` exposes `supportsStructuredOutput` per provider so PlannerService selects the most reliable path automatically.

### AgentOrchestrator Loop Control
- **D-05:** Explicit planner-controlled termination. `PlannerDecision` discriminated union: `answer` and `ask_clarification` are terminal states (→ RendererService). `run_tool` is non-terminal (→ ExecutorService → back to PlannerService). Loop continues while Planner returns `run_tool` and step count < tier cap — **Reversibility:** one-way — the termination semantics are baked into PlannerDecision schema and AgentOrchestrator loop logic; changing to intent-based or limit-only termination would require rewriting the decision schema and loop state machine.
- **D-06:** Tier cap (e.g., haiku=3, flash=6) is a safety net, not the primary termination condition. Task completion responsibility stays in PlannerService, not ExecutorService.

### Streaming Path Through Pipeline
- **D-07:** RendererService as the single user-facing rendering gateway — **Reversibility:** costly — splitting or recombining the rendering gateway affects every pipeline response path. `RendererService.stream()` for answer terminals (internally uses `streamText` via ProviderRouter). `RendererService.synthesize()` for forced render at tier cap (uses `generateText` with accumulated execution context). Both paths share: persona injection, response formatting, citation handling, output limits, telemetry.

### Tier Model Strategy
- **D-08:** Deterministic tier presets with optional user overrides. Each `ProviderAdapter` exposes `getDefaultModelForTier(tier)` with curated mappings for FAST, BALANCED, ADVANCED tiers. ProviderRouter consumes tiers, not concrete model IDs. User can override tier→model mappings in settings.

### Persona Injection Scope
- **D-09:** Tiered persona injection. PlannerService receives behavioral attributes only (brevity, clarification strategy, reasoning style). ExecutorService receives minimal identity metadata or none. RendererService receives the complete persona profile (tone, voice, formatting, behavior rules, response style) — **Reversibility:** costly — changing which persona fields go where requires adjusting injection logic across PlannerService, RendererService, and the AgentOrchestrator assembly step.

### Error Handling Taxonomy
- **D-10:** Structured `PipelineError` objects with standardized error codes — not a deep class hierarchy. Each error contains: code, category, retryable flag, user-facing message, diagnostic metadata. Serializable across extension contexts — **Reversibility:** costly — the error code enum is the contract for error handling across all pipeline services and will be consumed by Phase 6 AITransactionLog.
- **D-11:** AgentOrchestrator uses a dispatch table: retryable errors → fallback provider / retry / circuit-breaker; terminal errors → surface to user.

### Conversation Context Assembly
- **D-12:** Minimal, versioned `PlannerContext` containing only Phase 3 data sources: `userMessage`, `conversationHistory`, `toolCallHistory`, `availableTools`, `personaBehavior`. AgentOrchestrator assembles this as a strongly typed object and passes it to PlannerService. Future context sources (MemoryEngine, ContextOptimizer, PageContext, Diagnostics) are represented as optional extension interfaces — unpopulated until their respective phases ship. No dead code paths.

### StreamAdapter + ChunkBuffer
- **D-13:** StreamAdapter is thin pipeline-layer component: converts AI SDK streaming events into a stable NowPilot `StreamEvent` union (`text-delta`, `tool-call`, `tool-result`, `error`, `done`). No render batching or UI-specific processing in the pipeline.
- **D-14:** ChunkBuffer lives in the UI layer: requestAnimationFrame batching, message accumulation, stage indicators (Reading… Planning… Generating…), token counting, render throttling. Clear boundary: pipeline produces semantic stream events, UI controls presentation.

### the agent's Discretion
No areas were deferred to the agent — all 9 gray areas had explicit decisions from the user.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Specification
- `.planning/PRODUCT_SPEC_v0_1.md` §11 — AI Core Pipeline: PlannerService, ExecutorService, RendererService, AgentOrchestrator, ProviderRouter, PersonaProfile, PersonaInjector, StructuredOutput, StreamAdapter, ChunkBuffer, tool schemas, provider adapters
- `.planning/PRODUCT_SPEC_v0_1.md` §12 — Context Optimization Pipeline (interface references for Phase 4)
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix I — Tier-based step limits and model tiers
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix K — Prompt cache hints per provider

### Project & Roadmap
- `.planning/PROJECT.md` — Constraints (NOT @ant-design/x-sdk, cost-effective runtime, MV3 rules), Key Decisions (PlannerDecisionSchema 3-branch union, persona as user config, single haiku call pattern)
- `.planning/ROADMAP.md` Phase 3 — Goal, success criteria (5 items), depends on Phase 2
- `.planning/REQUIREMENTS.md` — AI-01 (four provider adapters), AI-02 (Planner→Executor→Renderer pipeline), AI-03 (PersonaInjector)

### Research
- `.planning/research/STACK.md` — `@ai-sdk/openai@^4`, `@ai-sdk/anthropic@^4`, `@ai-sdk/google@^4`, `ollama-ai-provider@^1.2`, `ai@^7`
- `.planning/research/PITFALLS.md` — Critical: `@ai-sdk/*` v1→v4, `ai` core v7 (`system`→`instructions` rename), `zod` v4
- `.planning/research/ARCHITECTURE.md` — Pipeline architecture diagrams, component boundaries, data flow, Zod discriminated unions

### Prior Phase Context
- `.planning/phases/02-storage-security-foundation/02-CONTEXT.md` — D-01 (encrypted API keys in chrome.storage.local), D-04 (domain-specific Zustand stores), D-05 (shared service layer)

### Existing Code
- `src/core/storage/ApiKeyStore.ts` — Encrypted API key storage (AES-GCM-256); ProviderRouter reads keys from here
- `src/core/storage/CryptoService.ts` — PBKDF2 key derivation + AES-GCM encrypt/decrypt
- `src/core/workspace/WorkspaceStore.ts` — activeProvider + selectedModel state
- `src/types/index.ts` — ProviderType, CustomProviderId, ProviderConfig (may need refactoring for pipeline usage)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ApiKeyStore** (`src/core/storage/ApiKeyStore.ts`): ProviderRouter resolves API keys via `getKey(providerId)`. Already proven in Phase 2 tests.
- **CryptoService** (`src/core/storage/CryptoService.ts`): AES-GCM-256 encrypt/decrypt. Used by ApiKeyStore.
- **Zustand stores** (`src/core/workspace/WorkspaceStore.ts`, `src/core/storage/ApiKeyStore.ts`): Pattern for any pipeline state stores (e.g., ProviderState with circuit breaker counters).

### Established Patterns
- **Zustand + persist middleware**: Domain-specific Zustand stores with chrome.storage.local persistence. Phase 2 established this pattern.
- **Core module isolation**: `src/core/` modules do not import from `src/components/`. Pipeline services follow this boundary.
- **Singleton services**: Stores are module-level singletons via `create()`. Pipeline services (PlannerService, etc.) may follow this or be instantiated by AgentOrchestrator.

### Integration Points
- **ApiKeyStore** → ProviderRouter reads encrypted keys. Phase 2 lock.
- **WorkspaceStore** → activeProvider/selectedModel inform ProviderRouter tier selection.
- **Future consumers**: Phase 4 ContextOptimizer reads pipeline context assembly. Phase 6 AITransactionLog consumes PipelineError diagnostics. Phase 7 Chat UI consumes StreamEvent union.
- **Legacy replacement**: `src/services/aiProvider.ts` and `src/store/useExtensionStore.ts` provider/config sections are replaced by this pipeline. The old SSE streaming approach is retired.
</code_context>

<specifics>
## Specific Ideas

- User explicitly requested hybrid thin-wrapper over AI SDK — not a full ILLMProvider abstraction. The ProviderAdapter pattern is lightweight and provider-specific only.
- `supportsStructuredOutput` capability flag is the key differentiator between providers. OpenAI/Anthropic/Gemini support structured output; Ollama depends on the loaded model.
- Tiers are FAST / BALANCED / ADVANCED with deterministic presets per provider. User can override but defaults should be sensible.
- PersonaProfile and PersonaInjector are runtime seeds in this phase — the full persona UI lives in Phase 7, but the injection infrastructure must be operational for the pipeline.
- Structured output repair is one-shot only — no iterative repair loops. One failed repair is a terminal error.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No scope creep was raised.
</deferred>

---

*Phase: 3-AI Core Pipeline*
*Context gathered: 2026-07-30*
