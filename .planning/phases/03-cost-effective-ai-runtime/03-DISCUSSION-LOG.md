# Phase 3: Cost-Effective AI Runtime - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 3-Cost-Effective AI Runtime
**Areas discussed:** Provider adapter architecture, Pipeline execution & streaming, ProviderRouter selection & tiers, Tool validation scope, PromptCache normalization, Abort propagation & timeout policy

---

## Provider Adapter Architecture

### How should the 5 @ai-sdk/* providers be exposed to the pipeline?

| Option | Description | Selected |
|--------|-------------|----------|
| Direct SDK usage | Use AI SDK provider functions directly in ProviderRouter. No wrapper layer. | |
| Thin registry layer | Create a thin ProviderRegistry that wraps each provider with tier metadata, model list, and cost hints. | ✓ |
| Per-provider adapter | Each provider gets its own adapter class/method. | |

**User's choice:** Thin registry layer — AI SDK normalizes provider APIs; NowPilot adds metadata on top.
**Notes:** The AI SDK already provides a uniform `LanguageModelV1` interface via `generateText`/`streamText`. NowPilot's registry adds tier mapping, model discovery, and cost metadata.

### What metadata should the provider registry hold for each model entry?

| Option | Description | Selected |
|--------|-------------|----------|
| Model-level registry | Each entry: providerId, modelId, costTier, contextWindow, modalities, rate limits. | ✓ |
| Provider + model list | Config maps provider + API key, plus simple model name → tier. | |
| Model-centric registry | Models stored in chrome.storage.local with full metadata. | |

**User's choice:** Model-level registry with full metadata per entry.

### How should models be discovered for OpenAI-compatible/Ollama providers?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual model config | User manually enters model list. | |
| Auto-discover + override | Auto-populate from /v1/models, allow user override. | Capability-based (see notes) |
| Hybrid per-provider | Ollama auto-discovers, OpenAI-compatible requires manual. | |

**User's choice:** Capability-based discovery for ALL providers — not based on provider type. Flow: validate connection → attempt discovery → populate or manual fallback. Discovery behavior depends on endpoint capability, not provider type.

### Should the model registry data persist?

| Option | Description | Selected |
|--------|-------------|----------|
| Persist in storage | Models persist in chrome.storage.local. | |
| Store + memory cache | In-memory loaded from storage on startup. | |
| Storage with in-memory cache | Persist to chrome.storage.local, in-memory cache at startup. | ✓ |

**User's choice:** Storage with in-memory cache. Re-discover on each provider edit.

---

## Pipeline Execution & Streaming

### How should the Planner→Executor→Renderer stages connect?

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential stages | Three separate LLM calls. | ✓ |
| SDK tool loop + Renderer | Use AI SDK's built-in multi-step tool loop. | |
| Hybrid — chat vs agent | Single streamText for chat, separate stages for agent. | |

**User's choice:** Sequential stages — Planner (generateText, JSON mode), Executor (deterministic), Renderer (streamText/generateText).

### How should streaming work through the pipeline?

| Option | Description | Selected |
|--------|-------------|----------|
| Renderer streams, ChunkBuffer at UI | Renderer uses streamText, UI batches. | |
| Orchestrator unified stream | Orchestrator emits all events; ChunkBuffer at orchestrator output. | ✓ |
| Stream agent, batch chat | Non-streaming for agent, streamText for chat. | |

**User's choice:** AgentOrchestrator unified event stream. Planner/Executor emit structured events; Renderer emits text-delta chunks. ChunkBuffer at orchestrator output, buffers only renderer text deltas. Tool/planner events flow through immediately.

### How should models be assigned to pipeline stages?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-role model config | User configures separate models for planner, executor, renderer. | |
| Tier-based auto-selection | TierResolver uses cost tier to auto-select. | |
| Single model + fallback | Planner and Renderer share same model if only one configured. | ✓ |

**User's choice:** Single model + fallback. TierResolver treats Haiku/Flash as preferred tiers, falls back to user's active model. Single model for onboarding, multi-model for advanced users.

---

## ProviderRouter Selection & Tiers

### What drives ProviderRouter's initial model selection?

| Option | Description | Selected |
|--------|-------------|----------|
| Active provider + fallback | User sets active provider; router only activates on failure. | |
| Cost-optimized routing | Router selects cheapest matching model. | |
| Tier-based priority chain | User configures provider priority per tier. | ✓ |

**User's choice:** Tier-based priority chain — user configures provider priority and model assignments per tier. Router selects highest-priority matching model.

### What retry strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-first-token retry only | Retry on network/5xx errors before streaming starts. | ✓ |
| Full retry including mid-stream | Retry on any failure including mid-stream. | |
| Pre-token retry + user prompt | Retry pre-token, user prompt post-token. | |

**User's choice:** Retry only pre-first-token for retryable errors (TIMEOUT, NETWORK, PROVIDER_5XX, RATE_LIMITED). Post-first-token: surface error with Retry/Switch Provider. Tool failures don't trigger provider retries. Circuit breaker: 3 consecutive failures in 60s → open for 5 min → probe.

### What's the fallback chain depth?

| Option | Description | Selected |
|--------|-------------|----------|
| Same-tier → lower-tier | Same tier different provider, then lower tier. | |
| User-defined fallback chain | User defines ordered fallback list per tier. | |
| Exhaustive same-tier → abort | All same-tier providers, then default, then abort. Max 3. | ✓ |

**User's choice:** Bounded fallback chain: preferred model → next same-tier provider → active/default model → abort. Max 3 attempts.

---

## Tool Validation Scope

### What tool implementations does Phase 3 need?

| Option | Description | Selected |
|--------|-------------|----------|
| Framework-only, no tools | Build framework, register zero tools. | |
| Minimal test tools (2-3) | Small test fixtures to verify pipeline. | ✓ |
| All 12 tool stubs | Schemas with empty execute functions. | |

**User's choice:** Framework + test fixture tools. Phase 3 builds ToolRegistry, closed-enum validation, Zod I/O validation, permission checks, timeout handling, and ExecutorService rejection. Test-only fixtures verify the pipeline. No real tools until Phase 7.

### What permission model should Phase 3 implement?

| Option | Description | Selected |
|--------|-------------|----------|
| Simple allow/deny now | Flag on each tool. | |
| Full permission model, no UI | PermissionManager without UI dialog. | |
| Permission interface + default-deny | Interface with default-deny impl. Phase 7 adds UI. | ✓ |

**User's choice:** PermissionService interface + default-deny implementation. Phase 7 plugs in Allow once/Always/Deny UI without changing ExecutorService.

---

## PromptCache Normalization

### How should PromptCacheManager and PromptCacheAdapter work together?

| Option | Description | Selected |
|--------|-------------|----------|
| Section-based cache hints | Manager marks stable sections; Adapter translates per provider. | ✓ |
| Automatic section tagging | Each provider adapter auto-tags what's cacheable. | |
| Cache key management | Focus on key management, not section-level hinting. | |

**User's choice:** Section-based cache hints. PromptCacheManager identifies stable sections (system prompt, tool schemas, preferences, memory) and marks them with CacheHint metadata. PromptCacheAdapter translates to provider-specific providerOptions.

### What's the cache scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-conversation cache | System prompt + tools cached per conversation. | |
| Global stable cache | All stable sections cached across conversations. | |
| Per-provider key + global | Per-provider cache key + global stable cache. | ✓ |

**User's choice:** Per-provider cache key + global stable cache. Invalidate on config/tool/prompt/memory changes, not on conversation changes.

---

## Abort Propagation & Timeout Policy

### How should abort propagation work?

| Option | Description | Selected |
|--------|-------------|----------|
| Parent + child signals | Root AbortController, derived child signals per stage. | ✓ |
| Single controller + race | One AbortController with race conditions. | |
| Timeout with recovery | PipelineTimeout wraps all stages with recovery. | |

**User's choice:** Parent + child AbortSignal model. Single root AbortController, derived child signals per stage. User cancel aborts root → all stages. Stage timeouts are stage-local.

### What happens when a stage times out?

| Option | Description | Selected |
|--------|-------------|----------|
| Surface to user, manual retry | Error surfaced with retry option. | |
| Auto-tier-fallback on timeout | Silently retry at lower tier. | |
| Spec-aligned recovery | Staged recovery per the success criteria. | ✓ |

**User's choice:** Spec-aligned staged recovery: Planner → one-shot repair then fallback to answer. Executor → structured timeout result. Renderer → partial text if available.

### What are the timeout values for each stage?

| Option | Description | Selected |
|--------|-------------|----------|
| 3s / 10s / 5s | Planner 3s, Executor 10s, Renderer 5s. | ✓ |
| Configurable timeouts | User-adjustable in Options → Advanced. | |
| Hardcoded per spec | Non-configurable in v0.1. | |

**User's choice:** TimeoutConfig with defaults Plannner=3s, Executor=10s, Renderer=5s. Configurable in code/DI only, not in v0.1 UI.

---

## the agent's Discretion

- Exact shape of the ProviderRegistry interface — follow class+singleton pattern
- Test fixture tools — pick 2-3 representative fixtures (echo, counter, get-time)
- ChunkBuffer rAF batching granularity — standard rAF batching
- CacheKey format — hashing strategy for stable sections
- TimeoutConfig DI integration — constructor or module parameter

## Deferred Ideas

None — discussion stayed within phase scope.
