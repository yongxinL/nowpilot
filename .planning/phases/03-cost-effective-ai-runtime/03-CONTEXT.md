# Phase 3: Cost-Effective AI Runtime - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the full AI runtime pipeline: 5 provider adapters unified through a thin ProviderRegistry, tier-based ProviderRouter with circuit breaker and retry, sequential Planner→Executor→Renderer stages with unified orchestrator streaming, prompt caching normalized across providers, tool validation framework with permission interface, and abort propagation with staged timeout recovery. This is the linchpin phase — all downstream chat, agent, and memory features depend on it.

Requirements: PROV-01 through PROV-07, AIRN-01 through AIRN-09
</domain>

<decisions>
## Implementation Decisions

### Provider Adapter Architecture
- **D-01:** Thin ProviderRegistry layer wraps `@ai-sdk/*` providers — the AI SDK normalizes the provider APIs; NowPilot adds tier metadata, model list, and cost hints on top.
- **D-02:** Model-level registry — each entry has: `providerId`, `modelId`, `costTier` (haiku/flash/sonnet/opus), `contextWindow`, `modalities` (text, image, tool-use, structured-output), and optional rate limits.
- **D-03:** Capability-based model discovery for ALL providers — try auto-discovery first (e.g., `/v1/models` for OpenAI-compatible endpoints, Ollama API for Ollama). If discovery succeeds, populate automatically and allow user override of tier/context-window metadata. If discovery fails, fall back to manual model configuration. Discovery depends on endpoint capability, not provider type.
- **D-04:** Registry persists to `chrome.storage.local` and loads into an in-memory cache at startup for fast lookups. Re-discover on each provider edit.

### Pipeline Execution & Streaming
- **D-05:** Sequential stages with separate LLM calls — Planner uses `generateText` (JSON mode, no tools), Executor is deterministic (Zod validation + tool execution, no LLM), Renderer uses `streamText`/`generateText` for final response.
- **D-06:** AgentOrchestrator exposes a unified event stream. Planner and Executor emit structured execution events (plan-created, tool-called, tool-result). Renderer produces `text-delta` chunks via `streamText()`. ChunkBuffer sits at orchestrator output, buffering only renderer text-deltas via `rAF` batching. Tool/planner events flow through immediately for ThoughtChain, ToolCard, and progress UI rendering.
- **D-07:** Planner and Renderer can share the same model if only one is configured. TierResolver treats Haiku/Flash as preferred tiers with fallback to the user's active model when dedicated tier models aren't configured. Single-model onboarding, multi-model cost optimization for advanced users.

### ProviderRouter Selection & Tiers
- **D-08:** Tier-based priority chain — user configures provider priority and model assignments per tier. ProviderRouter selects the highest-priority model matching the requested tier, then follows the fallback chain on failure.
- **D-09:** Retry only pre-first-token for retryable provider errors (TIMEOUT, NETWORK, PROVIDER_5XX, RATE_LIMITED). After first token is streamed, errors are surfaced to the UI with Retry / Switch Provider options. Tool execution failures are handled by Executor/Renderer and do not trigger provider retries.
- **D-10:** Circuit breaker: 3 consecutive failures within 60s opens the provider for 5 minutes before a probe attempt is allowed (half-open → close on success, open on failure).
- **D-11:** Bounded fallback chain: preferred model for requested tier → next provider matching that tier → active/default model → abort. Maximum 3 attempts total including the initial request.

### Tool Validation Scope
- **D-12:** Phase 3 builds the full tool validation framework but uses test-only fixture tools to verify the pipeline. Implements: ToolRegistry, closed-enum tool-name validation (reject unknown tools), Zod input/output schema validation, permission checks, timeout handling, and ExecutorService rejection behavior. No real built-in tools — those arrive in Phase 7 (12 MCP tools).
- **D-13:** PermissionService interface with default-deny implementation. ExecutorService calls PermissionService before executing any tool. The default implementation denies dangerous or unknown tools; test overrides allow specific fixtures. Phase 7 plugs in the Allow once / Allow always / Deny UI dialog without changing ExecutorService.

### PromptCache Normalization
- **D-14:** Section-based cache hints — PromptCacheManager identifies stable prompt sections (system prompt, tool schemas, preferences, selected memory) and marks them with provider-agnostic `CacheHint` metadata. PromptCacheAdapter translates these hints to provider-specific `providerOptions` at call time.
- **D-15:** Per-provider cache key + global stable cache. Cache invalidates only when provider configuration, tool schemas, system prompts, or memory facts change — not when conversations or user messages change. Maximizes cache reuse while respecting per-provider cache behavior.
- **D-16:** AI SDK's `providerOptions` used for per-provider cache control: `cache_control: { type: 'ephemeral' }` for Anthropic, `promptCacheKey` + `promptCacheBreakpoint` + `promptCacheOptions` for OpenAI, `cachedContent` for Gemini.

### Abort Propagation & Timeout Policy
- **D-17:** Parent + child AbortSignal model — a single root `AbortController` for the operation with derived child signals per stage. User cancellation aborts the root controller, propagating to all stages immediately. Each stage has its own timeout (via child signal), so a stage timeout affects only that stage.
- **D-18:** Spec-aligned staged recovery: user cancel → clean abort with AbortError. Planner timeout → one-shot repair retry within the 3s window, then fallback to `{ action: "answer", reasonCode: "planner_failed" }`. Executor/tool timeout → structured timeout tool result. Renderer timeout → return partial text if any tokens were received, otherwise surface timeout error. ProviderRouter retries only pre-first-token on provider failures — no silent retry or provider switch after streaming starts.
- **D-19:** TimeoutConfig with defaults: Planner = 3s, Executor tool = 10s, Renderer = 5s. Configurable in code and dependency injection, but not exposed in the Options UI for v0.1.

### the agent's Discretion
- Exact shape of the ProviderRegistry interface — downstream agents should follow the pattern of existing class+singleton modules (e.g., KeymapRegistry, AITransactionLogDB).
- Test fixture tools — researcher/planner to pick 2-3 representative fixtures (e.g., echo, counter, get-time) that exercise validation, timeout, and permission paths.
- ChunkBuffer rAF batching granularity — standard rAF batching pattern.
- CacheKey format — planner to determine the hashing strategy for stable sections.
- TimeoutConfig DI integration — inject via constructor or module parameter; planner to determine the cleanest approach consistent with existing patterns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Scope
- `.planning/REQUIREMENTS.md` — PROV-01 through PROV-07, AIRN-01 through AIRN-09 (lines 58–77). Full requirement traceability for all 16 Phase 3 requirements.
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria (6 items), dependency on Phase 2, linchpin role (lines 127–141).

### Project Context
- `.planning/PROJECT.md` — Core constraints: `@ai-sdk/*` only (no direct provider SDKs), MV3 restrictions (no IndexedDB from background SW), package hygiene, `@ant-design/x-sdk` NOT adopted, two-surface architecture.
- `.planning/STATE.md` — Session continuity, Phase 2 decisions carried forward (WriteJournal, EncryptedStorage, storage patterns).

### Prior Phase Decisions
- `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-CONTEXT.md` — Storage infrastructure decisions that Phase 3 builds on: EncryptedStorage for API keys, WriteJournal for consistency, IndexedDB domain stores, NP_ key prefix convention, Zustand persist patterns, test infrastructure setup, class+singleton export pattern.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **providerStore** (`src/core/stores/providerStore.ts`): Already persists API keys via EncryptedStorage. Will be the consumer of the ProviderRegistry — active provider/model selection flows through this store.
- **workspaceStore** (`src/core/stores/workspaceStore.ts`): Has `activeProvider` field for provider selection, plus `activeSkillRun` and `activeAddonContext` fields ready for agent consumption.
- **AITransactionLogDB** (`src/core/storage/stores/AITransactionLogDB.ts`): Ready with `logTransaction`, `logPromptTrace`, `logToolTrace`, `logProviderTrace` methods. AgentOrchestrator should write traces here.
- **BroadcastBus** (`src/core/messaging/broadcastBus.ts`): Cross-surface messaging for orchestrator events and workspace sync.
- **WriteJournal** (`src/core/storage/WriteJournal.ts`): Multi-store consistency — use for any IndexedDB mutations in provider/model configuration.
- **EncryptedStorage** (`src/core/storage/EncryptedStorage.ts`): AES-GCM-256 encryption ready. API keys already encrypted at rest.
- **RateLimiter** (`src/core/utils/RateLimiter.ts`): Token bucket rate limiter — reusable for per-provider rate limiting in ProviderRouter.
- **debugLog** (`src/core/utils/debugLog.ts`): All catch blocks must call debugLog (HARD-09).

### Established Patterns
- **Class + singleton export**: Registry classes follow this pattern — applicable to ProviderRegistry, PromptCacheManager, ToolRegistry.
- **Zustand v5 stores**: `create()` + `persist()` with custom `createJSONStorage`. Stores accessed via hooks and imperative `getState()`/`setState()`.
- **Direct path imports**: No barrel/index files. Modules import directly via relative paths.
- **Test patterns**: Vitest + jsdom, tests in `tests/core/`, `chrome.*` APIs mocked in `tests/setup.ts`. Use `vi.hoisted()` for mock variables and module-level `let` for singletons (per Phase 2 patterns).
- **NP_ key prefix**: All `chrome.storage` keys use this convention. New Phase 3 keys should follow: `np_provider_registry`, `np_cache_keys`.

### Integration Points
- **Background service worker** (`src/entrypoints/background.ts`): MV3 restrictions — no direct AI provider calls from background SW. AI runtime must run in sidepanel/standalone contexts.
- **providerStore shape**: Current interface has `selectedProvider` (string | null) and `apiKeys` (Record<string, string>). Phase 3 will extend with model registry references.
- **WorkspaceStore shape**: `activeProvider` field references the provider ID. Phase 3 pipeline reads this to determine the active provider/model chain.
- **Storage layer**: Existing `nowpilot` IndexedDB database has `transaction_log_transactions`, `transaction_log_promptTraces`, `transaction_log_toolTraces`, `transaction_log_providerTraces` stores — ready for Phase 3 trace writes.
</code_context>

<specifics>
## Specific Ideas

### Model Discovery Flow
1. User enters endpoint + API key.
2. Validate connection.
3. Attempt model discovery (capability-based, not provider-type-based).
4. On success: auto-populate models, allow user override of NowPilot metadata (tier, context window, tool support, cache support).
5. On failure: fall back to manual model configuration.

### Circuit Breaker States
```
CLOSED → (3 failures in 60s) → OPEN → (5 min cooldown) → HALF_OPEN → (probe) → CLOSED/OPEN
```

### Orchestrator Event Stream (conceptual)
```
plan-created | tool-called | tool-result | text-delta | text-complete | error
```
ChunkBuffer processes only `text-delta` events via rAF batching. All other events passthrough immediately.

### Timeout Recovery Strategy
- Planner: 3s total → one-shot repair → `{ action: "answer", reasonCode: "planner_failed" }`
- Executor tool: 10s per tool → structured timeout tool result
- Renderer: 5s → return partial text if available, else error
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 3-Cost-Effective AI Runtime*
*Context gathered: 2026-07-12*
