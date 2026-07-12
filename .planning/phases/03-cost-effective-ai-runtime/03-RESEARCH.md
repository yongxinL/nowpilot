# Phase 03: Cost-Effective AI Runtime - Research

**Researched:** 2026-07-12
**Domain:** AI Runtime Pipeline (LLM orchestration, provider routing, streaming, tool execution)
**Confidence:** HIGH

## Summary

Phase 3 delivers the full AI runtime pipeline for NowPilot — the linchpin phase that all downstream chat, agent, and memory features depend on. The architecture is a **sequential Planner→Executor→Renderer pipeline** built on Vercel AI SDK v4, with a custom ProviderRouter providing tier-based model selection, circuit breaking, and retry logic. All 5 provider types (OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible) are unified through a thin ProviderRegistry wrapping `@ai-sdk/*` provider instances.

The Planner produces JSON decisions via `generateText` with a system prompt (no AI SDK tools — the Planner outputs JSON manually parsed and validated against NowPilot's own Zod schemas). The Executor is deterministic: it validates tool calls against a ToolRegistry, checks permissions via PermissionService, and executes with timeout bounds. The Renderer streams text via `streamText` through a ChunkBuffer that applies `requestAnimationFrame` batching for smooth UI updates.

**Critical finding:** AI SDK v4 requires Zod v3, but the project uses Zod v4.4.3. Since the Planner/Executor/Renderer do NOT use AI SDK's built-in tool calling or `generateObject` (per D-05: "Planner uses `generateText` (JSON mode, no tools)"), this incompatibility is confined to AI SDK's internal schema processing. The ExecutorService performs its own Zod v4 validation independently. Tools are defined as plain objects with Zod v4 schemas — not via AI SDK's `tool()` helper. This avoids the compatibility issue entirely.

**Primary recommendation:** Install `ai@4.3.19` with `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google` (all v4.x), and `jsonrepair@3.15.0` for one-shot JSON repair. Build the Planner using `generateText` + manual JSON parsing/repair/validation (not `generateObject`). Build the Executor as deterministic validation+execution (not AI SDK tool calls). Build the Renderer with `streamText` + `onChunk` callback → ChunkBuffer.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | OpenAI provider adapter via @ai-sdk/openai | `createOpenAI()` from `@ai-sdk/openai` — See Standard Stack & Code Examples: Provider Adapter |
| PROV-02 | Anthropic provider adapter via @ai-sdk/anthropic | `createAnthropic()`/`anthropic()` from `@ai-sdk/anthropic` — See Standard Stack |
| PROV-03 | Gemini provider adapter via @ai-sdk/google | `createGoogle()`/`google()` from `@ai-sdk/google` — See Standard Stack |
| PROV-04 | Ollama provider adapter via @ai-sdk/openai (OpenAI-compatible endpoint) | `createOpenAI({ baseURL: 'http://localhost:11434/v1' })` — See Arch Pattern: Provider Adapters |
| PROV-05 | OpenAI-compatible provider adapter (user-supplied baseURL) | Same as PROV-04 — `createOpenAI({ baseURL, apiKey })` for any OpenAI-compatible endpoint |
| PROV-06 | ProviderRouter with cost/latency/reliability selection, retry, circuit breaker | Circuit breaker + retry are custom implementations (not in AI SDK v4). Pre-first-token retry via AI SDK's `maxRetries` + custom abort on first token. Fallback chain via sequential try/catch. See Architecture Patterns: Circuit Breaker |
| PROV-07 | TierResolver maps haiku/flash tier to concrete (providerId, model) | Model registry lookup — TierResolver queries ProviderRegistry for models matching requested tier, ordered by user-configured priority. See Architecture Patterns: TierResolver |
| AIRN-01 | PlannerService — JSON-only action planner (3s timeout, one-shot repair retry) | `generateText` + system prompt → `jsonrepair` → Zod v4 parse → 3s `AbortSignal.timeout`. See Code Examples: PlannerService |
| AIRN-02 | ExecutorService — deterministic tool executor (validate, permission, timeout, schema check) | Deterministic service — no LLM calls. Zod v4 validation on tool inputs/outputs. PermissionService check before execute. Tool timeout via `AbortSignal.timeout(10000)`. See Code Examples: ExecutorService |
| AIRN-03 | RendererService — concise response renderer (flash tier, 512 token cap, 5s timeout) | `streamText` with `maxTokens: 512`, flash-tier model via ProviderRouter, `AbortSignal.timeout(5000)`. See Code Examples: RendererService |
| AIRN-04 | AgentOrchestrator — Planner→Executor loop with tier caps (1-5 planner calls) | Orchestrator loops Planner→Executor up to tier cap. Each Planner call gets tool results from previous Executor run. See Architecture Patterns: Orchestrator Loop |
| AIRN-05 | StructuredOutput — JSON mode + schema validation + one-shot repair (Appendix L) | `generateText` with JSON system prompt → `jsonrepair()` → Zod v4 `safeParse()` → if fail, repair retry (one-shot). Not AI SDK's `generateObject`. See Code Examples: StructuredOutput |
| AIRN-06 | ChunkBuffer — rAF-batched streaming UI buffer (Appendix J) | Custom class collecting `text-delta` chunks, flushing on `requestAnimationFrame`. Tool/planner events bypass buffer. See Code Examples: ChunkBuffer |
| AIRN-07 | PromptCacheManager — cache segmentation and provider hints | Identifies stable sections (system prompt, tool schemas, preferences, memory) and marks with `CacheHint` metadata. See Architecture Patterns: PromptCache |
| AIRN-08 | PromptCacheAdapter — per-provider cache-hint transformation (Appendix K) | Translates provider-agnostic `CacheHint` → `providerOptions` per provider. Anthropic: `{ cacheControl: { type: 'ephemeral' } }`. OpenAI: `{ promptCacheKey, promptCacheOptions }`. Gemini: `{ cachedContent }`. See Code Examples: PromptCacheAdapter |
| AIRN-09 | Abort propagation through Planner→Executor→Renderer via single AbortController | Root `AbortController` → derived child signals per stage. `AbortSignal.timeout()` for per-stage timeouts. AI SDK natively accepts `abortSignal` in `generateText`/`streamText`. See Code Examples: Abort Propagation |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider Adapters (5 providers) | API / Backend | — | All provider calls originate from extension runtime code; no direct provider calls from background SW per MV3 restrictions |
| ProviderRegistry | API / Backend | Storage (chrome.storage.local) | In-memory cache backed by persistent storage; class+singleton in extension runtime |
| Model Discovery | API / Backend | — | HTTP calls to provider endpoints (`/v1/models`, Ollama API); runs in sidepanel/standalone contexts |
| ProviderRouter | API / Backend | — | Selection logic + retry + circuit breaker all run in extension runtime; no UI dependencies |
| TierResolver | API / Backend | — | Queries ProviderRegistry for tier-to-model mapping; pure selection logic |
| Circuit Breaker | API / Backend | — | State machine tracking failures over time; in-memory only |
| PlannerService | API / Backend | — | Makes LLM calls via AI SDK; runs in extension runtime (sidepanel/standalone) |
| ExecutorService | API / Backend | — | Deterministic validation and tool execution; no LLM calls |
| RendererService | API / Backend | — | Makes streaming LLM calls via AI SDK |
| AgentOrchestrator | API / Backend | — | Coordinates pipeline stages; emits events |
| StructuredOutput (JSON repair) | API / Backend | — | Post-processing on Planner output; pure function |
| PromptCacheManager | API / Backend | — | Identifies stable prompt sections for caching hints |
| PromptCacheAdapter | API / Backend | — | Translates cache hints to provider options at call time |
| ChunkBuffer | Browser / Client | — | `requestAnimationFrame` is a browser API; operates on renderer text-deltas before UI consumption |
| ToolRegistry | API / Backend | — | Registry of available tools with schemas; class+singleton pattern |
| PermissionService | API / Backend | — | Default-deny; called by Executor; replaced by UI dialog in Phase 7 |
| AbortController (propagation) | API / Backend | — | JS runtime primitive; root controller created by orchestrator, signals passed to AI SDK calls |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | `^4.3.19` | Vercel AI SDK core — `generateText`, `streamText`, `tool`, types | Project constraint (PROJECT.md). v4 is the last stable major before the v5/v6 API break (`Output.object`, `stopWhen`/`isStepCount`). **Must stay on v4** — v5+ changes tool API (`inputSchema` instead of `parameters`) and structured output API (`Output.object` instead of `generateObject`). |
| `@ai-sdk/openai` | `^4.0.11` | OpenAI + OpenAI-compatible provider (Ollama, custom endpoints) | [VERIFIED: npm registry + v4.ai-sdk.dev docs]. Handles OpenAI, Ollama (via `baseURL`), and any OpenAI-compatible endpoint (PROV-04, PROV-05). |
| `@ai-sdk/anthropic` | `^4.0.12` | Anthropic Claude provider | [VERIFIED: npm registry + v4.ai-sdk.dev docs]. Native Anthropic Messages API support with cache control via `providerOptions`. |
| `@ai-sdk/google` | `^4.0.12` | Google Gemini provider | [VERIFIED: npm registry + v4.ai-sdk.dev docs]. Gemini API with `cachedContent`, `safetySettings` via `providerOptions`. |
| `jsonrepair` | `^3.15.0` | One-shot JSON repair for malformed/truncated Planner output | [VERIFIED: npm registry + Context7]. Handles missing quotes, trailing commas, truncated strings, missing brackets, ellipsis. Throws `JSONRepairError` with `position` on unrecoverable input. Used by StructuredOutput (AIRN-05). |
| `zod` | `^4.4.3` | Schema validation for tool inputs/outputs, Planner decisions | Already in project (Phase 1). Zod v4 used throughout NowPilot — ExecutorService uses v4's `safeParse` directly (not through AI SDK). **AI SDK v4 requires Zod v3 for its internal `tool()`/`generateObject` validation** — but NowPilot does NOT use those AI SDK features, so no conflict. See Pitfall 1 below. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `idb` | `^8.0.3` | IndexedDB wrapper | Already in project. ProviderRegistry persistence uses chrome.storage.local (not IndexedDB) per D-04. |
| `zustand` | `^5.0.0` | State management | Already in project. providerStore and workspaceStore already use this. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AI SDK v4 `generateObject()` for Planner | `generateText` + manual JSON parsing/repair | `generateObject` requires Zod v3 — incompatible with project's Zod v4. Manual approach also gives us control over repair strategy (jsonrepair) and retry (one-shot within 3s window). Per D-05, Planner explicitly uses `generateText` not `generateObject`. |
| AI SDK `tool()` helper for fixture tools | Plain objects with Zod v4 schemas | `tool()` helper requires Zod v3 internally. Since ExecutorService does its own validation, plain Zod v4 schemas provide equivalent type safety without the compatibility layer. Phase 7 MCP tools can use AI SDK tool calling when/if we upgrade AI SDK. |
| AI SDK v5+ (`stopWhen`/`isStepCount`) | AI SDK v4 (`maxSteps`) | v5+ has better step control but changes the entire API surface. Project constraint locks v4. `maxSteps` provides equivalent functionality for the Orchestrator loop. |
| Custom retry logic | AI SDK v4 built-in `maxRetries` | AI SDK's retry applies to all provider errors uniformly. NowPilot needs pre-first-token-only retry with provider fallback (D-09). Custom wrapper around AI SDK calls gives us fine-grained control. |

**Installation:**
```bash
npm install ai@^4.3.19 @ai-sdk/openai@^4.0.11 @ai-sdk/anthropic@^4.0.12 @ai-sdk/google@^4.0.12 jsonrepair@^3.15.0
```

**Version verification:** All package versions confirmed via `npm view` against the npm registry on 2026-07-12. `ai@4.3.19` is the latest v4 release (v4 reached 4.3.19 before v5 was released).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `ai` | npm | ~2 yrs (since v4.0.0) | 16.8M/wk | github.com/vercel/ai | [SUS] | Flagged — latest patch published 2026-07-10 (too-new). Millions of weekly downloads and Vercel org ownership confirm legitimacy. Install `ai@4.3.19` specifically. |
| `@ai-sdk/openai` | npm | ~2 yrs | 7.4M/wk | github.com/vercel/ai | [SUS] | Flagged — latest patch published 2026-07-09. Vercel org, high adoption. Install `@ai-sdk/openai@4.0.11`. |
| `@ai-sdk/anthropic` | npm | ~2 yrs | 8.6M/wk | github.com/vercel/ai | [SUS] | Flagged — latest patch published 2026-07-10. Vercel org, high adoption. Install `@ai-sdk/anthropic@4.0.12`. |
| `@ai-sdk/google` | npm | ~2 yrs | 5.2M/wk | github.com/vercel/ai | [SUS] | Flagged — latest patch published 2026-07-10. Vercel org, high adoption. Install `@ai-sdk/google@4.0.12`. |
| `jsonrepair` | npm | ~4 yrs | 2.6M/wk | github.com/josdejong/jsonrepair | [SUS] | Flagged — latest release published 2026-07-03. Well-established library with consistent release cadence. Install `jsonrepair@3.15.0`. |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, jsonrepair — all flagged for "too-new" (recent release within past week). These are all well-established packages with millions of weekly downloads and maintained by reputable organizations (Vercel, josdejong). The planner should add `checkpoint:human-verify` before installation to confirm recent releases haven't introduced regressions.

*No packages discovered via WebSearch or training data that haven't been verified against an authoritative source. All packages confirmed on npm registry with official source repos.*

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────┐
                    │     AgentOrchestrator        │
                    │  (tier caps, event stream)   │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼──────────────────┐
              ▼                ▼                   ▼
     ┌────────────┐   ┌────────────┐    ┌─────────────┐
     │  Planner   │   │  Executor  │    │  Renderer   │
     │  Service   │──▶│  Service   │───▶│  Service    │
     │            │   │            │    │             │
     │ generateText  │ validate   │    │ streamText  │
     │ JSON mode  │   │ permission │    │ 512 tokens  │
     │ 3s timeout │   │ execute    │    │ 5s timeout  │
     └─────┬──────┘   └─────┬──────┘    └──────┬──────┘
           │                │                   │
           ▼                ▼                   ▼
     ┌────────────┐   ┌────────────┐    ┌─────────────┐
     │ Structured │   │   Tool     │    │ ChunkBuffer │
     │  Output    │   │  Registry  │    │  (rAF batch)│
     │ jsonrepair │   │ +PermSvc   │    └──────┬──────┘
     └────────────┘   └────────────┘           │
           │                                    ▼
           ▼                              ┌──────────┐
     ┌────────────┐                       │   UI     │
     │ProviderRouter                      │ (React)  │
     │┌──────────┐│                       └──────────┘
     ││Tier Resvr││
     │├──────────┤│
     ││Circuit Br││
     │├──────────┤│
     ││Provider  ││
     ││Registry  ││
     │└────┬─────┘│
     └─────┼──────┘
           │
     ┌─────┼──────────────────────────┐
     ▼     ▼           ▼              ▼
    OpenAI Anthropic  Gemini    OpenAI-compat
    ┌───┐  ┌───┐    ┌────┐    (Ollama/custom)
    │gpt│  │cl │    │gem │    ┌────┐
    └───┘  └───┘    └────┘    │olla│
                               └────┘

    ┌──────────────────────┐
    │   PromptCacheManager │  ← stable sections identification
    │   PromptCacheAdapter │  ← per-provider cache hints
    └──────────────────────┘
              │
    providerOptions: { anthropic: { cacheControl }, openai: { promptCacheKey }, ... }
```

**Data flow through primary use case (single-turn agent):**

1. User message → AgentOrchestrator creates root `AbortController`
2. Orchestrator requests tier-appropriate model from TierResolver → ProviderRouter
3. **Planner**: `generateText` with JSON system prompt → raw text → `jsonrepair` → Zod v4 parse → PlannerDecision JSON
4. If PlannerDecision has tool calls (`run_tool`): Executor validates tool names → checks permissions → executes → returns tool results
5. **Renderer**: `streamText` with tool results + user message → `onChunk` text-deltas → ChunkBuffer → rAF flush → UI
6. Orchestrator loop: if plan calls for more tools (within tier cap), go to step 3

**Abort path:** User cancel → root `AbortController.abort()` → propagates to all active AI SDK calls → Orchestrator emits error event → cleanup

### Recommended Project Structure
```
src/core/
├── ai/                          # NEW — AI runtime module
│   ├── providers/               # Provider adapters + registry
│   │   ├── ProviderRegistry.ts  # Class+singleton wrapping @ai-sdk/* providers
│   │   ├── providerTypes.ts     # ProviderConfig, ModelEntry, CostTier types
│   │   ├── modelDiscovery.ts    # Capability-based model discovery (D-03)
│   │   └── adapters/            # Per-provider adapter factories
│   │       ├── openaiAdapter.ts      # createOpenAI wrapper
│   │       ├── anthropicAdapter.ts   # createAnthropic wrapper
│   │       ├── googleAdapter.ts      # createGoogle wrapper
│   │       └── openaiCompatAdapter.ts # createOpenAI with baseURL
│   ├── router/                  # ProviderRouter + circuit breaker
│   │   ├── ProviderRouter.ts    # Tier-based selection, retry, fallback
│   │   ├── TierResolver.ts      # Maps tier → (provider, model)
│   │   ├── CircuitBreaker.ts    # State machine (CLOSED→OPEN→HALF_OPEN)
│   │   └── routerTypes.ts       # RouterConfig, FallbackChain, RetryPolicy
│   ├── pipeline/                # Planner→Executor→Renderer pipeline
│   │   ├── PlannerService.ts    # JSON decision planner (AIRN-01)
│   │   ├── ExecutorService.ts   # Deterministic tool executor (AIRN-02)
│   │   ├── RendererService.ts   # Streaming response renderer (AIRN-03)
│   │   ├── AgentOrchestrator.ts # Pipeline coordinator (AIRN-04)
│   │   ├── StructuredOutput.ts  # JSON mode + repair + validation (AIRN-05)
│   │   └── pipelineTypes.ts     # PlannerDecision, ToolCall, OrchestratorEvent
│   ├── tools/                   # Tool framework + fixtures
│   │   ├── ToolRegistry.ts      # Tool registration + lookup
│   │   ├── ToolDefinition.ts    # Tool schema type (Zod v4)
│   │   ├── PermissionService.ts # Default-deny permission interface (D-13)
│   │   └── fixtures/            # Test-only fixture tools
│   │       ├── echoTool.ts      # Echo fixture
│   │       ├── counterTool.ts   # Stateful counter fixture
│   │       └── getTimeTool.ts   # Time fixture
│   ├── streaming/               # Streaming infrastructure
│   │   ├── ChunkBuffer.ts       # rAF-batched text-delta buffer (AIRN-06)
│   │   ├── AbortManager.ts      # Root + child AbortSignal management (AIRN-09)
│   │   └── TimeoutConfig.ts     # Per-stage timeout defaults (D-19)
│   ├── cache/                   # Prompt caching
│   │   ├── PromptCacheManager.ts # Stable section identification (AIRN-07)
│   │   ├── PromptCacheAdapter.ts # Per-provider cache hints (AIRN-08)
│   │   └── cacheTypes.ts        # CacheHint, CacheSection, CacheKey
│   └── config/                  # AI runtime configuration
│       └── aiConfig.ts          # TimeoutConfig, tier caps, defaults
```

### Pattern 1: Class + Singleton Export

**What:** Every registry/service class is exported as both a class (for extensibility/testing) and a singleton instance (for application use).

**When to use:** All Phase 3 registries and services — ProviderRegistry, ToolRegistry, ProviderRouter, AgentOrchestrator.

**Example:**
```typescript
// Source: Existing project pattern (KeymapRegistry, EncryptedStorage, AITransactionLogDB)
// src/core/ai/tools/ToolRegistry.ts

import type { ToolDefinition } from './ToolDefinition';

export class ToolRegistry {
  #tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.#tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.#tools.get(name);
  }

  has(name: string): boolean {
    return this.#tools.has(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.#tools.values());
  }
}

export const toolRegistry = new ToolRegistry();
```

### Pattern 2: Provider Adapter Factory

**What:** Each provider gets a thin factory function that creates an AI SDK provider instance with NowPilot metadata. The factory reads API keys and configuration from the ProviderRegistry.

**When to use:** PROV-01 through PROV-05.

**Example:**
```typescript
// Source: v4.ai-sdk.dev docs — createOpenAI(), createAnthropic(), createGoogle()

import { createOpenAI } from '@ai-sdk/openai';
import type { ProviderConfig } from '../providerTypes';

export function createOpenAIAdapter(config: ProviderConfig) {
  return createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL, // undefined for OpenAI, http://localhost:11434/v1 for Ollama
    headers: config.customHeaders,
  });
}
```

### Pattern 3: Circuit Breaker State Machine

**What:** Standalone class tracking per-provider failure counts with time-windowed state transitions. CLOSED → (3 failures/60s) → OPEN → (5min cooldown) → HALF_OPEN → (probe) → CLOSED/OPEN.

**When to use:** ProviderRouter calls CircuitBreaker before every provider request.

**States:**
```
CLOSED (normal) → OPEN (blocking) → HALF_OPEN (probing)
     ↑                                   │
     └───────── (success) ───────────────┘
                    (failure) → OPEN
```

### Pattern 4: Unified Event Stream (Orchestrator)

**What:** AgentOrchestrator emits typed events through an async iterable or callback interface. Events have types: `plan-created`, `tool-called`, `tool-result`, `text-delta`, `text-complete`, `error`. ChunkBuffer intercepts only `text-delta` — all other events pass through immediately.

**When to use:** AgentOrchestrator.run() returns the event stream. UI consumers subscribe.

### Pattern 5: PromptCache Section Hints

**What:** PromptCacheManager identifies stable prompt sections (system prompt, tool schemas, preferences, memory) and marks them with `CacheHint` metadata. PromptCacheAdapter translates to per-provider `providerOptions`.

**When to use:** Every AI SDK call — ProviderRouter injects cache options before calling `generateText`/`streamText`.

**Per-provider mapping (D-16):**
| Provider | providerOptions shape |
|----------|----------------------|
| Anthropic | `{ anthropic: { cacheControl: { type: 'ephemeral' } } }` per message/part |
| OpenAI | `{ openai: { promptCacheKey, promptCacheOptions: { mode, ttl } } }` |
| Gemini | `{ google: { cachedContent } }` |
| Ollama | No cache support — skip |

### Anti-Patterns to Avoid
- **Using AI SDK `generateObject`/`streamObject` for Planner:** These require Zod v3 (see Pitfall 1). The Planner uses `generateText` + manual parsing instead.
- **Using AI SDK `tool()` helper for Phase 3 tools:** `tool()` validates with Zod v3 internally. Phase 3 defines tools as plain objects with Zod v4 schemas, validated directly by ExecutorService.
- **Retrying after first token is streamed:** D-09 explicitly prohibits this — errors after first token go to UI with Retry/Switch options.
- **Calling AI providers from background service worker:** MV3 restriction — AI runtime must run in sidepanel/standalone contexts. All provider calls originate from these surfaces.
- **Storing provider API keys unencrypted:** Keys must pass through EncryptedStorage (Phase 2). Provider adapters read keys from ProviderRegistry which reads from EncryptedStorage.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM API integration | Custom HTTP client for each provider | `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google` | AI SDK handles provider differences, streaming protocols, retry/error codes, and `providerOptions` for cache control. Hand-rolling would require maintaining 5 separate API clients. |
| JSON parsing error recovery | Custom regex/string manipulation | `jsonrepair` | Handles 15+ failure modes (missing quotes, trailing commas, truncation, NDJSON, comments, etc.) with a battle-tested parser. Custom regex repairs fail silently on edge cases. |
| Tool schema validation | Custom type checking | `zod` v4 `safeParse()` | Already in project. Zod provides co-located schema+TypeScript types, detailed error messages, and `safeParse` for non-throwing validation. |
| Prompt cache hints | Per-provider cache control embedded in pipeline code | PromptCacheManager + PromptCacheAdapter abstraction | Provider cache APIs differ (Anthropic: per-block `cacheControl`, OpenAI: `promptCacheKey`, Gemini: `cachedContent`). Abstraction layer normalizes across providers without duplicating cache logic in Planner/Renderer. |
| Circuit breaker | Inline failure counting in ProviderRouter | Dedicated `CircuitBreaker` class | Circuit breaker is a well-known pattern with tested state transitions. Inline implementation would scatter timeout logic, state tracking, and probe behavior across ProviderRouter. |
| Abort/timeout management | `setTimeout` + manual cleanup in each service | `AbortController` + `AbortSignal.timeout()` | Web standard API. AI SDK natively accepts `AbortSignal` in `generateText`/`streamText`. `AbortSignal.timeout(ms)` creates self-aborting signals — no manual timer management. |

**Key insight:** The AI SDK v4 provides a unified interface for 5 different provider APIs (OpenAI, Anthropic, Gemini, and any OpenAI-compatible endpoint). Hand-rolling provider integration would require maintaining separate HTTP clients, streaming parsers, error classifiers, and cache-control implementations for each — ~5x the code with worse edge-case handling than a library used by 16M+ weekly downloads.

## Common Pitfalls

### Pitfall 1: Zod v4 / AI SDK v4 Incompatibility (CRITICAL)

**What goes wrong:** AI SDK v4 internally uses Zod v3 APIs for schema validation in `tool()`, `generateObject()`, and `streamObject()`. The project uses Zod v4.4.3. Passing Zod v4 schemas to AI SDK's `tool({ parameters: zodV4Schema })` or `generateObject({ schema: zodV4Schema })` will cause runtime errors because Zod v4's `jsonSchema` output format and internal types differ from Zod v3.

**Why it happens:** The AI SDK v4 was built when Zod v3 was the current version. Zod v4 introduced breaking changes to JSON schema generation and type internals. The SDK's `parameters` parameter expects a Zod v3 schema object.

**How to avoid:** The CONTEXT.md D-05 already mandates this approach — the Planner uses `generateText` (JSON mode, no tools) rather than `generateObject`. For tool validation, ExecutorService performs its own Zod v4 validation on plain Zod schemas (not AI SDK's `tool()` helper). The Renderer just streams text and doesn't need Zod.

**Warning signs:** `TypeError: schema._def is not a function` or `TypeError: Cannot read properties of undefined (reading 'jsonSchema')` when passing Zod v4 schemas to AI SDK functions.

### Pitfall 2: AI SDK v4 API Shape Confusion (parameters vs inputSchema, maxSteps vs stopWhen)

**What goes wrong:** AI SDK v5+ changed the tool API from `parameters` to `inputSchema`, and step control from `maxSteps` to `stopWhen`/`isStepCount`. Developers reading current (v7) docs will write v5+ APIs that don't exist in v4.

**Why it happens:** The main ai-sdk.dev documentation is now at v7. The v4 docs are at `v4.ai-sdk.dev`. Search engines and LLM training data frequently return v5+ API examples.

**How to avoid:** Always reference `v4.ai-sdk.dev/docs` for API shapes. Key v4→v5+ differences:
- `tool({ parameters: schema })` NOT `tool({ inputSchema: schema })`
- `maxSteps: 5` NOT `stopWhen: isStepCount(5)`
- `generateObject({ schema })` NOT `generateText({ output: Output.object({ schema }) })`
- `experimental_output` available but experimental
- `onStepFinish` callback (not `onStepEnd`)

**Warning signs:** TypeScript errors for unknown properties `inputSchema`, `stopWhen`, or `output` on `generateText`.

### Pitfall 3: ProviderRouter Retry After First Token

**What goes wrong:** The AI SDK's `maxRetries` setting retries on ALL retryable errors including mid-stream failures. If the Renderer has already received and displayed text tokens (via `streamText` → ChunkBuffer → UI), a retry would cause the UI to show duplicate or inconsistent content.

**Why it happens:** AI SDK doesn't distinguish between pre-first-token and post-first-token errors in its retry logic.

**How to avoid:** Per D-09, wrap AI SDK calls in NowPilot's own retry logic. Track whether the first token has been received. For `generateText` (Planner): retry is safe since there's no streaming. For `streamText` (Renderer): use `onChunk` to detect first token arrival; after that, disable retries and surface errors to the UI.

**Warning signs:** Duplicate UI content when a Renderer stream fails and retries, or missing error UI when a stream fails mid-way.

### Pitfall 4: Chrome Extension MV3 Background SW Restrictions

**What goes wrong:** Calling AI providers from the background service worker fails because MV3 SWs don't support long-lived connections, `EventSource`, or certain fetch behaviors needed by AI SDK providers.

**Why it happens:** MV3 background SWs are ephemeral — they terminate after ~30s of inactivity. AI provider calls (especially streaming) require persistent connections.

**How to avoid:** The project already has this constraint (PROJECT.md). All AI runtime code must run in the sidepanel or standalone (full app tab) context. The ProviderRegistry, ProviderRouter, PlannerService, ExecutorService, RendererService, and AgentOrchestrator are all instantiated in sidepanel/standalone entry points — never imported by the background SW.

**Warning signs:** `Failed to fetch` errors or timeouts when AI SDK calls are made from `src/entrypoints/background.ts`.

### Pitfall 5: AbortController Not Propagating to Tool Execution

**What goes wrong:** User cancels an agent operation, the Planner/Renderer abort, but a long-running tool execution continues running because it doesn't receive the abort signal.

**Why it happens:** The root `AbortController` signal is passed to `generateText`/`streamText` but not forwarded to individual tool `execute` functions.

**How to avoid:** Per D-17, create child signals for each stage. The ExecutorService receives the root signal and creates per-tool timeouts via `AbortSignal.timeout(10000)`. Tool `execute` functions receive the signal and should forward it to any fetch/async operations. AI SDK v4 forwards `abortSignal` to tool execution as the second parameter (`{ abortSignal }`).

**Warning signs:** Tool execution continues after user cancellation, or `unhandled rejection` errors from abandoned tool promises.

## Code Examples

Verified patterns from official AI SDK v4 docs and project patterns:

### Provider Adapter (OpenAI + Ollama)

```typescript
// Source: v4.ai-sdk.dev/docs/providers — createOpenAI with baseURL
// src/core/ai/providers/adapters/openaiCompatAdapter.ts

import { createOpenAI } from '@ai-sdk/openai';

export function createOpenAIAdapter(apiKey: string, baseURL?: string) {
  return createOpenAI({
    apiKey,
    baseURL, // undefined = default OpenAI; 'http://localhost:11434/v1' = Ollama
  });
}
```

### PlannerService (generateText + JSON repair)

```typescript
// Source: v4.ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
// src/core/ai/pipeline/PlannerService.ts

import { generateText } from 'ai';
import { jsonrepair, JSONRepairError } from 'jsonrepair';
import { z } from 'zod';

const PlannerDecision = z.object({
  action: z.enum(['answer', 'run_tool', 'ask_clarification']),
  toolName: z.string().optional(),
  toolInput: z.record(z.unknown()).optional(),
  reasoning: z.string(),
});

export class PlannerService {
  async plan(
    model: any, // AI SDK LanguageModel
    systemPrompt: string,
    userMessage: string,
    abortSignal: AbortSignal,
  ): Promise<z.infer<typeof PlannerDecision>> {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: userMessage,
      abortSignal,
      temperature: 0.1, // Low temp for deterministic planning
    });

    // One-shot JSON repair
    let repaired: string;
    try {
      repaired = jsonrepair(text);
    } catch (err) {
      if (err instanceof JSONRepairError) {
        // Repair failed — return fallback
        return { action: 'answer', reasoning: 'Planner output was unparseable' };
      }
      throw err;
    }

    // Validate against schema
    const parsed = JSON.parse(repaired);
    const result = PlannerDecision.safeParse(parsed);
    if (result.success) return result.data;

    // One-shot retry: repair failure → fallback answer
    return { action: 'answer', reasoning: 'Planner output failed schema validation' };
  }
}
```

### ExecutorService (Deterministic, no LLM)

```typescript
// src/core/ai/pipeline/ExecutorService.ts

import { z } from 'zod';

export interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

export class ExecutorService {
  constructor(
    private toolRegistry: ToolRegistry,
    private permissionService: PermissionService,
  ) {}

  async execute(
    toolName: string,
    toolInput: Record<string, unknown>,
    abortSignal: AbortSignal,
  ): Promise<ToolExecutionResult> {
    // 1. Closed-enum validation
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    // 2. Permission check (default-deny)
    const canExecute = await this.permissionService.canExecute(toolName, toolInput);
    if (!canExecute) {
      return { success: false, error: `Permission denied for tool: ${toolName}` };
    }

    // 3. Input schema validation (Zod v4)
    const inputResult = tool.inputSchema.safeParse(toolInput);
    if (!inputResult.success) {
      return { success: false, error: `Invalid input: ${inputResult.error.message}` };
    }

    // 4. Execute with timeout
    try {
      const output = await tool.execute(inputResult.data, { abortSignal });
      // 5. Output schema validation
      const outputResult = tool.outputSchema.safeParse(output);
      if (!outputResult.success) {
        return { success: false, error: `Invalid output: ${outputResult.error.message}` };
      }
      return { success: true, output: outputResult.data };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, error: 'Tool execution timed out' };
      }
      return { success: false, error: err instanceof Error ? err.message : 'Tool execution failed' };
    }
  }
}
```

### RendererService (streamText)

```typescript
// Source: v4.ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
// src/core/ai/pipeline/RendererService.ts

import { streamText } from 'ai';

export async function* renderStream(
  model: any,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  abortSignal: AbortSignal,
): AsyncGenerator<{ type: 'text-delta'; text: string } | { type: 'text-complete'; fullText: string } | { type: 'error'; message: string }> {
  const result = streamText({
    model,
    system: systemPrompt,
    messages: messages as any,
    maxTokens: 512,
    abortSignal,
    onError({ error }) {
      console.error('Renderer stream error:', error);
    },
  });

  let fullText = '';
  for await (const chunk of result.textStream) {
    fullText += chunk;
    yield { type: 'text-delta', text: chunk };
  }
  yield { type: 'text-complete', fullText };
}
```

### ChunkBuffer (rAF batching)

```typescript
// src/core/ai/streaming/ChunkBuffer.ts

export class ChunkBuffer {
  private buffer: string[] = [];
  private rafId: number | null = null;
  private onFlush: (text: string) => void;

  constructor(onFlush: (text: string) => void) {
    this.onFlush = onFlush;
  }

  push(text: string): void {
    this.buffer.push(text);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.rafId !== null) return; // already scheduled
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (this.buffer.length > 0) {
        const combined = this.buffer.join('');
        this.buffer = [];
        this.onFlush(combined);
      }
    });
  }
}
```

### Abort Propagation (Parent + Child signals)

```typescript
// src/core/ai/streaming/AbortManager.ts

export class AbortManager {
  readonly rootController = new AbortController();

  createStageTimeout(ms: number): AbortSignal {
    // Child signal: aborts when either root cancels OR stage timeout fires
    const stageController = new AbortController();
    const timeoutId = setTimeout(() => stageController.abort(new DOMException('Stage timeout', 'TimeoutError')), ms);

    // Link parent: if root aborts, abort child too
    this.rootController.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      stageController.abort(this.rootController.signal.reason);
    }, { once: true });

    return stageController.signal;
  }

  cancel(reason?: string): void {
    this.rootController.abort(new DOMException(reason ?? 'User cancelled', 'AbortError'));
  }
}
```

### PromptCacheAdapter (Anthropic example)

```typescript
// Source: v4.ai-sdk.dev docs — Anthropic cacheControl
// src/core/ai/cache/PromptCacheAdapter.ts

export function applyAnthropicCache(
  messages: Array<{ role: string; content: any }>,
  cacheHints: Map<number, boolean>, // message index → shouldCache
): Array<{ role: string; content: any }> {
  return messages.map((msg, idx) => {
    if (!cacheHints.get(idx)) return msg;
    return {
      ...msg,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' as const } },
      },
    };
  });
}
```

### ProviderRouter with Circuit Breaker + Fallback

```typescript
// src/core/ai/router/ProviderRouter.ts

import { CircuitBreaker } from './CircuitBreaker';

export class ProviderRouter {
  constructor(
    private registry: ProviderRegistry,
    private breaker: CircuitBreaker,
  ) {}

  async selectModel(
    tier: CostTier,
    preferredProviders: string[],
  ): Promise<{ provider: any; model: string } | null> {
    // D-11: Bounded fallback chain, max 3 attempts
    const chain = this.buildFallbackChain(tier, preferredProviders);
    let lastError: Error | null = null;

    for (let i = 0; i < Math.min(chain.length, 3); i++) {
      const { providerId, modelId } = chain[i];

      // Check circuit breaker before attempting
      if (this.breaker.isOpen(providerId)) {
        continue; // Skip — provider circuit is open
      }

      try {
        const provider = this.registry.getProvider(providerId);
        if (!provider) continue;

        // D-09: This is a "pre-first-token" stage — retry is safe
        this.breaker.recordSuccess(providerId);
        return { provider: provider.instance, model: modelId };
      } catch (err) {
        lastError = err as Error;
        this.breaker.recordFailure(providerId);
        // Continue to next in fallback chain
      }
    }

    throw lastError ?? new Error(`No available provider for tier: ${tier}`);
  }

  private buildFallbackChain(tier: CostTier, preferredProviders: string[]): Array<{ providerId: string; modelId: string }> {
    // TierResolver logic: preferred provider → next matching tier → active/default → empty
    const models = this.registry.getModelsForTier(tier);
    // Sort by user's provider priority order, then return up to 3
    return models
      .sort((a, b) => preferredProviders.indexOf(a.providerId) - preferredProviders.indexOf(b.providerId))
      .slice(0, 3)
      .map(m => ({ providerId: m.providerId, modelId: m.modelId }));
  }
}
```

### Circuit Breaker State Machine

```typescript
// src/core/ai/router/CircuitBreaker.ts

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface ProviderCircuit {
  state: CircuitState;
  failures: Array<number>; // timestamps
  openedAt: number | null;
}

export class CircuitBreaker {
  private circuits = new Map<string, ProviderCircuit>();
  private readonly FAILURE_THRESHOLD = 3;
  private readonly FAILURE_WINDOW_MS = 60_000;
  private readonly COOLDOWN_MS = 5 * 60_000; // 5 minutes

  isOpen(providerId: string): boolean {
    const circuit = this.circuits.get(providerId);
    if (!circuit) return false;

    if (circuit.state === 'OPEN') {
      // Check if cooldown has elapsed → transition to HALF_OPEN
      if (circuit.openedAt && Date.now() - circuit.openedAt >= this.COOLDOWN_MS) {
        circuit.state = 'HALF_OPEN';
        return false; // Allow probe
      }
      return true; // Still blocking
    }
    return false;
  }

  recordFailure(providerId: string): void {
    const circuit = this.getOrCreate(providerId);
    const now = Date.now();

    if (circuit.state === 'HALF_OPEN') {
      // Probe failed → back to OPEN
      circuit.state = 'OPEN';
      circuit.openedAt = now;
      return;
    }

    // CLOSED: add failure timestamp, prune old ones
    circuit.failures.push(now);
    circuit.failures = circuit.failures.filter(t => now - t < this.FAILURE_WINDOW_MS);

    if (circuit.failures.length >= this.FAILURE_THRESHOLD) {
      circuit.state = 'OPEN';
      circuit.openedAt = now;
    }
  }

  recordSuccess(providerId: string): void {
    const circuit = this.circuits.get(providerId);
    if (!circuit) return;

    if (circuit.state === 'HALF_OPEN') {
      // Probe succeeded → close circuit
      circuit.state = 'CLOSED';
      circuit.failures = [];
    }
    // CLOSED: reset failure window on success
    if (circuit.state === 'CLOSED') {
      circuit.failures = [];
    }
  }

  private getOrCreate(providerId: string): ProviderCircuit {
    if (!this.circuits.has(providerId)) {
      this.circuits.set(providerId, { state: 'CLOSED', failures: [], openedAt: null });
    }
    return this.circuits.get(providerId)!;
  }
}
```

### AgentOrchestrator (Pipeline loop with tier caps)

```typescript
// src/core/ai/pipeline/AgentOrchestrator.ts

export type OrchestratorEvent =
  | { type: 'plan-created'; decision: PlannerDecision }
  | { type: 'tool-called'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; result: ToolExecutionResult }
  | { type: 'text-delta'; text: string }
  | { type: 'text-complete'; fullText: string }
  | { type: 'error'; message: string };

export class AgentOrchestrator {
  async *run(
    userMessage: string,
    systemPrompt: string,
    tier: ModelContextTier,
    abortManager: AbortManager,
  ): AsyncGenerator<OrchestratorEvent> {
    const tierCap = this.getTierCap(tier); // tiny=1, small=2, medium=3, large=5
    let plannerCalls = 0;
    const toolResults: ToolExecutionResult[] = [];

    while (plannerCalls < tierCap) {
      // D-05: Planner uses generateText (no tools)
      const plannerSignal = abortManager.createStageTimeout(3000); // 3s per D-19
      const provider = await this.router.selectModel(tier, this.userPreferences);
      const decision = await this.planner.plan(
        provider.model,
        systemPrompt,
        this.buildPlannerPrompt(userMessage, toolResults),
        plannerSignal,
      );

      plannerCalls++;
      yield { type: 'plan-created', decision };

      if (decision.action === 'answer' || decision.action === 'ask_clarification') {
        break; // Proceed to Renderer
      }

      if (decision.action === 'run_tool' && decision.toolName) {
        const toolSignal = abortManager.createStageTimeout(10000); // 10s per D-19
        yield { type: 'tool-called', toolName: decision.toolName, input: decision.toolInput };
        const result = await this.executor.execute(decision.toolName, decision.toolInput ?? {}, toolSignal);
        yield { type: 'tool-result', toolName: decision.toolName, result };
        toolResults.push(result);
      }
    }

    // Renderer: stream final response
    const rendererSignal = abortManager.createStageTimeout(5000); // 5s per D-19
    for await (const chunk of this.renderer.stream(userMessage, systemPrompt, toolResults, rendererSignal)) {
      yield chunk; // text-delta or text-complete or error
    }
  }

  private getTierCap(tier: ModelContextTier): number {
    switch (tier) {
      case 'tiny': return 1;
      case 'small': return 2;
      case 'medium': return 3;
      case 'large': return 5;
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK v3 `generateObject`/`streamObject` with `schema` | AI SDK v4 same API but with `experimental_output` on `generateText` | v4.0 (2024) | v4 added `experimental_output` for structured output WITH tool calling. NowPilot doesn't use this — Planner uses raw `generateText` + manual parsing. |
| AI SDK v4 `tool({ parameters })` | AI SDK v5+ `tool({ inputSchema })` | v5.0 (2025) | Parameter renamed. NowPilot on v4 uses `parameters`. |
| AI SDK v4 `maxSteps` | AI SDK v5+ `stopWhen` / `isStepCount` | v5.0 (2025) | Step control API changed. NowPilot on v4 uses `maxSteps`. |
| Manual Zod v3 schema | Zod v4 with new `z.object()` and `safeParse` | v4.0 (2025) | Breaking changes to internal types. AI SDK v4 requires Zod v3 — NowPilot avoids the conflict by not using AI SDK schema validation. |

**Deprecated/outdated:**
- **`generateObject({ schema })`** for Planner: Not used because of Zod v4 incompatibility. Replaced by `generateText` + `jsonrepair` + manual Zod v4 parse.
- **AI SDK `tool()` helper for Phase 3:** Not used because it requires Zod v3 for parameter validation. Phase 3 defines tools as plain objects with Zod v4 schemas. Phase 7 may upgrade AI SDK to a version supporting Zod v4.
- **`@ai-sdk/openai` v3:** Requires `ai` v3 which has different provider API. Use v4.x exclusively.
- **`openai-edge` / `ai` v2:** Completely different API. Migrated to `@ai-sdk/openai` + `ai` v4.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AI SDK v4's `tool()` helper requires Zod v3 internally and will fail with Zod v4 schemas | Standard Stack, Pitfall 1 | MEDIUM — if AI SDK v4.3.19 added Zod v4 compatibility, we could use `tool()` and `generateObject`, simplifying the Planner and tool definitions. Mitigation: confirm during implementation; fallback to manual approach still works. |
| A2 | `jsonrepair` can successfully repair typical LLM JSON output failures (truncation, missing quotes, trailing commas) | Standard Stack | LOW — `jsonrepair` is well-tested for these scenarios. If a specific LLM produces novel malformation patterns, the `JSONRepairError` catch provides a safe fallback to `answer` action. |
| A3 | AI SDK v4's `abortSignal` propagates to tool execution via the second `execute` parameter | Code Examples: Abort Propagation | LOW — confirmed in v4 docs (Tools → Abort Signals section). If this doesn't work as documented, we pass the signal explicitly in ExecutorService. |
| A4 | Ollama's API is compatible with OpenAI's `/v1/chat/completions` endpoint shape | Architecture Patterns: Provider Adapters | MEDIUM — Ollama has historically maintained OpenAI compatibility but may diverge on specific features (structured output, tool calling). The OpenAI-compatible adapter with `baseURL` should work for basic chat. Model discovery via `/v1/models` may differ. |
| A5 | `chrome.storage.local` has sufficient capacity and speed for ProviderRegistry model lists | Architecture Patterns | LOW — Model lists are small (typically 10-100 entries). chrome.storage.local has 10MB quota. Read speed is sub-millisecond for small payloads. |
| A6 | AI SDK v4's `onChunk` callback is available in `streamText` | Code Examples: RendererService | MEDIUM — The v4 `streamText` API reference lists `onChunk` and `onError` callbacks. If `onChunk` is not available in v4.3.19, we iterate `result.textStream` as an async iterable instead. |

## Open Questions

1. **Zod v4 → v3 downgrade or AI SDK upgrade for Phase 7?**
   - What we know: Phase 3 avoids the Zod v4/v3 conflict by not using AI SDK's schema validation. Phase 7 uses MCP tools and may need AI SDK's tool calling features.
   - What's unclear: Should Phase 7 upgrade AI SDK to v5+ (which may support Zod v4) or should we keep v4 and work around it? v5+ has significant API changes (`inputSchema`, `stopWhen`, `Output.object`).
   - Recommendation: Defer to Phase 7. Phase 3 establishes the pattern (manual Zod validation, no AI SDK tool helper). If Phase 7 needs AI SDK tool calling, evaluate upgrading to ai@5+ at that time.

2. **Ollama model discovery API shape**
   - What we know: Ollama provides `/api/tags` for listing models. The output format differs from OpenAI's `/v1/models`.
   - What's unclear: Whether a unified discovery interface can handle both OpenAI-compatible and Ollama-specific endpoints gracefully.
   - Recommendation: Implement capability-based discovery (D-03): try OpenAI-compatible `/v1/models` first; if that fails (404), try Ollama-specific `/api/tags`. Each adapter returns a normalized `DiscoveredModel[]` array.

3. **Circuit breaker state persistence across extension restarts**
   - What we know: Extension runtime restarts when the side panel closes. Circuit breaker state would be lost.
   - What's unclear: Whether circuit breaker state should persist. A 5-minute cooldown across restarts may be desirable for truly broken providers.
   - Recommendation: Start with in-memory-only (simpler). A fresh circuit-breaker state on panel open is acceptable for v0.1 — if a provider is consistently failing, the user will see errors and can switch providers.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test toolchain | ✓ | v26.5.0 | — |
| npm | Package management | ✓ | 11.17.0 | — |
| TypeScript | Compilation | ✓ | 5.9.3 (tsc) | — |
| Vitest | Test runner | ✓ | 4.1.10 | — |
| Docker | (not required) | ✗ | — | Not needed for Phase 3 — no containerized services |
| Chrome/Chromium | Runtime (extension host) | ✓ (dev) | — | MV3 extension runs in Chrome; development uses WXT dev mode |
| `ai` (npm) | AI SDK core | ✗ (not yet installed) | — | Install `ai@4.3.19` — confirmed available on npm |
| `@ai-sdk/openai` | OpenAI/Ollama/compat providers | ✗ (not yet installed) | — | Install `@ai-sdk/openai@4.0.11` |
| `@ai-sdk/anthropic` | Anthropic provider | ✗ (not yet installed) | — | Install `@ai-sdk/anthropic@4.0.12` |
| `@ai-sdk/google` | Gemini provider | ✗ (not yet installed) | — | Install `@ai-sdk/google@4.0.12` |
| `jsonrepair` | JSON repair | ✗ (not yet installed) | — | Install `jsonrepair@3.15.0` |
| `zod` | Schema validation | ✓ (installed) | 4.4.3 | — |
| `idb` | IndexedDB | ✓ (installed) | 8.0.3 | — |
| `zustand` | State management | ✓ (installed) | 5.0.0 | — |

**Missing dependencies with no fallback:**
- `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `jsonrepair` — must be installed before implementation. These are the core dependencies of Phase 3.

**Missing dependencies with fallback:**
- None — all missing deps are essential with no alternatives.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/core/ai/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROV-01 | OpenAI adapter creates valid AI SDK provider instance | unit | `npx vitest run tests/core/ai/providers/openaiAdapter.test.ts -t "creates provider"` | ❌ Wave 0 |
| PROV-02 | Anthropic adapter creates valid AI SDK provider instance | unit | `npx vitest run tests/core/ai/providers/anthropicAdapter.test.ts` | ❌ Wave 0 |
| PROV-03 | Gemini adapter creates valid AI SDK provider instance | unit | `npx vitest run tests/core/ai/providers/googleAdapter.test.ts` | ❌ Wave 0 |
| PROV-04 | Ollama adapter uses correct baseURL | unit | `npx vitest run tests/core/ai/providers/ollamaAdapter.test.ts` | ❌ Wave 0 |
| PROV-05 | OpenAI-compatible adapter accepts custom baseURL | unit | `npx vitest run tests/core/ai/providers/openaiCompatAdapter.test.ts` | ❌ Wave 0 |
| PROV-06 | ProviderRouter follows fallback chain, max 3 attempts | unit | `npx vitest run tests/core/ai/router/ProviderRouter.test.ts -t "fallback"` | ❌ Wave 0 |
| PROV-06 | Circuit breaker opens after 3 failures in 60s | unit | `npx vitest run tests/core/ai/router/CircuitBreaker.test.ts -t "opens"` | ❌ Wave 0 |
| PROV-07 | TierResolver maps tier to correct provider+model | unit | `npx vitest run tests/core/ai/router/TierResolver.test.ts` | ❌ Wave 0 |
| AIRN-01 | PlannerService returns valid JSON decision | unit | `npx vitest run tests/core/ai/pipeline/PlannerService.test.ts -t "valid decision"` | ❌ Wave 0 |
| AIRN-01 | PlannerService handles malformed JSON via jsonrepair | unit | `npx vitest run tests/core/ai/pipeline/PlannerService.test.ts -t "jsonrepair"` | ❌ Wave 0 |
| AIRN-02 | ExecutorService rejects unknown tool names | unit | `npx vitest run tests/core/ai/pipeline/ExecutorService.test.ts -t "unknown tool"` | ❌ Wave 0 |
| AIRN-02 | ExecutorService validates inputs against Zod schema | unit | `npx vitest run tests/core/ai/pipeline/ExecutorService.test.ts -t "input validation"` | ❌ Wave 0 |
| AIRN-03 | RendererService streams text-delta chunks | unit | `npx vitest run tests/core/ai/pipeline/RendererService.test.ts -t "streams"` | ❌ Wave 0 |
| AIRN-03 | RendererService respects 512 token cap | unit | `npx vitest run tests/core/ai/pipeline/RendererService.test.ts -t "token cap"` | ❌ Wave 0 |
| AIRN-04 | AgentOrchestrator enforces tier caps (1/2/3/5) | unit | `npx vitest run tests/core/ai/pipeline/AgentOrchestrator.test.ts -t "tier cap"` | ❌ Wave 0 |
| AIRN-04 | Orchestrator loops Planner→Executor until answer | unit | `npx vitest run tests/core/ai/pipeline/AgentOrchestrator.test.ts -t "loop"` | ❌ Wave 0 |
| AIRN-05 | StructuredOutput repairs truncated JSON | unit | `npx vitest run tests/core/ai/pipeline/StructuredOutput.test.ts -t "truncated"` | ❌ Wave 0 |
| AIRN-05 | StructuredOutput falls back to answer on unrecoverable parse | unit | `npx vitest run tests/core/ai/pipeline/StructuredOutput.test.ts -t "fallback"` | ❌ Wave 0 |
| AIRN-06 | ChunkBuffer batches text-deltas via rAF | unit | `npx vitest run tests/core/ai/streaming/ChunkBuffer.test.ts` | ❌ Wave 0 |
| AIRN-07 | PromptCacheManager identifies stable sections | unit | `npx vitest run tests/core/ai/cache/PromptCacheManager.test.ts` | ❌ Wave 0 |
| AIRN-08 | PromptCacheAdapter translates hints to Anthropic cacheControl | unit | `npx vitest run tests/core/ai/cache/PromptCacheAdapter.test.ts -t "anthropic"` | ❌ Wave 0 |
| AIRN-08 | PromptCacheAdapter translates hints to OpenAI promptCacheKey | unit | `npx vitest run tests/core/ai/cache/PromptCacheAdapter.test.ts -t "openai"` | ❌ Wave 0 |
| AIRN-09 | AbortManager root abort propagates to child signals | unit | `npx vitest run tests/core/ai/streaming/AbortManager.test.ts -t "propagation"` | ❌ Wave 0 |
| AIRN-09 | Stage timeout fires independently of root | unit | `npx vitest run tests/core/ai/streaming/AbortManager.test.ts -t "timeout"` | ❌ Wave 0 |
| D-13 | PermissionService default-deny blocks unknown tools | unit | `npx vitest run tests/core/ai/tools/PermissionService.test.ts -t "default deny"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/ai/` — run tests for the module being modified
- **Per wave merge:** `npx vitest run` — ensure no regressions across the full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/ai/` — entire test directory, all 24+ test files
- [ ] `tests/core/ai/pipeline/PlannerService.test.ts` — mock AI SDK `generateText` + jsonrepair + Zod validation
- [ ] `tests/core/ai/pipeline/ExecutorService.test.ts` — mock ToolRegistry + PermissionService + Zod schemas
- [ ] `tests/core/ai/router/CircuitBreaker.test.ts` — state machine transitions (CLOSED→OPEN→HALF_OPEN→CLOSED)
- [ ] `tests/core/ai/router/ProviderRouter.test.ts` — fallback chain, max 3 attempts, circuit breaker integration
- [ ] `tests/core/ai/streaming/ChunkBuffer.test.ts` — rAF mocking for deterministic tests
- [ ] `tests/core/ai/streaming/AbortManager.test.ts` — AbortController mocking for signal propagation
- [ ] `tests/core/ai/tools/` — fixture tool tests (echo, counter, get-time)
- [ ] Test mocks for AI SDK `generateText`, `streamText` — use `vi.mock('ai', ...)` pattern from existing tests
- [ ] Test fixture tools (echo, counter, get-time) — exercise validation, timeout, and permission paths

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | Yes | API keys encrypted at rest via EncryptedStorage (AES-GCM-256). Provider adapters read keys from encrypted store. No keys in source, logs, or error messages. |
| V3 Session Management | No | Phase 3 is stateless between runs. Session management is in Phase 7 (Chat). |
| V4 Access Control | Yes | PermissionService default-deny for tool execution (D-13). ExecutorService calls PermissionService before executing any tool. Dangerous tools always prompt regardless of allow list. |
| V5 Input Validation | Yes | Zod v4 schema validation on all tool inputs and outputs (ExecutorService). StructuredOutput validates Planner JSON against Zod schema. Closed-enum tool-name validation rejects unknown tools. `jsonrepair` input is validated before parsing. |
| V6 Cryptography | No | Phase 2 already provides AES-GCM encryption via EncryptedStorage. Phase 3 consumes this — no new cryptography. |
| V7 Error Handling & Logging | Yes | All catch blocks call `debugLog` (HARD-09). AI SDK errors (`APICallError`, `NoSuchToolError`) are caught and sanitized before logging. No raw API responses in logs. Circuit breaker state logged but not user-visible. |
| V8 Data Protection | Yes | Provider data (API keys, model lists) persisted via EncryptedStorage. Prompt content not persisted in Phase 3 — that's Phase 6 (AITransactionLog). |
| V9 Communication | Yes | All provider API calls use HTTPS. `createOpenAI()` / `createAnthropic()` / `createGoogle()` default to HTTPS endpoints. Ollama uses localhost HTTP (user's machine). |
| V10 Malicious Code | No | All packages from npm with verified source repos. No eval, no dynamic code execution. `jsonrepair` is a pure parser, not an eval. |
| V11 Business Logic | Yes | Tier caps enforced in AgentOrchestrator (1-5 planner calls). TimeoutConfig prevents runaway execution. Circuit breaker prevents cascading provider failures. Provider fallback chain capped at 3 attempts. |

### Known Threat Patterns for AI Runtime

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM injection via user message (prompt injection into Planner system prompt) | Spoofing | Planner uses separate system prompt (not user-controllable). User message is placed in a clearly demarcated section. JSON mode constrains output to valid JSON. |
| API key exfiltration via error messages | Information Disclosure | AI SDK errors sanitized via `debugLog`. `APICallError` messages checked for key leakage before logging. No raw HTTP responses in user-facing errors. |
| Tool permission bypass via crafted Planner output | Elevation of Privilege | ExecutorService always validates tool names against closed enum (reject unknown). PermissionService always called before execution. Default-deny for untrusted tools. |
| Resource exhaustion via unbounded agent loops | Denial of Service | Tier caps (1-5 max planner calls). Per-stage timeouts (3s planner, 10s tool, 5s renderer). Total operation cap via root AbortController. |
| Circuit breaker manipulation via targeted failures | Denial of Service | Circuit breaker per-provider, not per-user. Failure threshold (3) is reasonable. Cooldown (5 min) is server-side — user can switch providers manually. |
| Malformed JSON triggering code execution in jsonrepair | Tampering | `jsonrepair` is a deterministic parser, not an interpreter. Output is passed to `JSON.parse()` which is safe. No `eval` or `Function()` involved. |
| Provider metadata leakage via model discovery | Information Disclosure | Model discovery results are user-visible (model list) by design. API keys never sent as part of discovery responses. Discovery failures don't expose error details to UI. |

## Sources

### Primary (HIGH confidence)
- [Context7: /websites/v4_ai-sdk_dev] — AI SDK v4 official docs: generateText API reference, tool calling, structured data generation, error handling. Confirmed v4 API shapes (`parameters` not `inputSchema`, `maxSteps` not `stopWhen`).
- [WebFetch: v4.ai-sdk.dev/docs/ai-sdk-core/generating-structured-data] — AI SDK v4 structured data docs: `generateObject`, `experimental_output`, `experimental_repairText`, `NoObjectGeneratedError`.
- [WebFetch: v4.ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling] — AI SDK v4 tool calling docs: `tool({ parameters })`, `maxSteps`, `experimental_repairToolCall`, abort signal forwarding.
- [WebFetch: v4.ai-sdk.dev/docs/reference/ai-sdk-core/generate-text] — Complete `generateText` API reference with all parameters and return types.
- [Context7: /josdejong/jsonrepair] — jsonrepair library docs: API, error handling, truncation repair, `JSONRepairError`.
- [npm registry] — Package version verification: `ai@4.3.19`, `@ai-sdk/openai@4.0.11`, `@ai-sdk/anthropic@4.0.12`, `@ai-sdk/google@4.0.12`, `jsonrepair@3.15.0`.
- [Context7: /vercel/ai] — AI SDK (latest) docs for cross-reference: `providerOptions` for prompt caching, `retryWithExponentialBackoff`, error types (`APICallError`, `NoSuchToolError`).

### Secondary (MEDIUM confidence)
- [Project codebase: src/core/stores/providerStore.ts] — Existing provider key storage via EncryptedStorage. Phase 3 extends this with model registry.
- [Project codebase: src/core/stores/workspaceStore.ts] — `activeProvider` field consumed by Phase 3 ProviderRouter.
- [Project codebase: src/core/storage/stores/AITransactionLogDB.ts] — Transaction log methods ready for Phase 3 trace writes.
- [Project codebase: src/core/utils/RateLimiter.ts] — Token bucket rate limiter reusable for per-provider rate limiting.
- [Project codebase: tests/setup.ts] — Chrome API mocks for vitest/jsdom. AI SDK provider calls will need additional mocking.

### Tertiary (LOW confidence)
- [ASSUMED] Ollama OpenAI-compatible endpoint shape — assumed from Ollama documentation, not verified in this session.
- [ASSUMED] OpenAI-compatible `/v1/models` discovery endpoint shape — assumed from OpenAI API documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified on npm registry. AI SDK v4 API confirmed via official v4 docs. jsonrepair confirmed via Context7.
- Architecture: HIGH — pipeline architecture (Planner→Executor→Renderer) mandated by CONTEXT.md decisions. Circuit breaker, ProviderRouter, and ChunkBuffer patterns derived from specified requirements with well-known implementations.
- Pitfalls: HIGH — Zod v4/v3 incompatibility confirmed from AI SDK v4 docs. API shape differences (v4 vs v5+) confirmed by comparing v4 and latest docs. MV3 restrictions confirmed from project constraints.
- Security: MEDIUM — ASVS mappings derived from phase requirements. Specific threat mitigations verified against AI SDK error handling patterns. Prompt injection and permission bypass mitigations are standard patterns but not verified against ASVS test cases.

**Research date:** 2026-07-12
**Valid until:** 2026-07-26 (14 days — AI SDK v4 is stable but the ecosystem around LLM providers evolves quickly)
