# Phase 03: AI Core Pipeline - Research

**Researched:** 2026-07-30
**Domain:** AI Provider Integration & Agent Orchestration Pipeline (Chrome MV3 Extension)
**Confidence:** HIGH

## Summary

This phase builds the AI pipeline core: four provider adapters (OpenAI, Anthropic, Gemini, Ollama) wired through a PlannerService → ExecutorService → RendererService pipeline orchestrated by AgentOrchestrator, with ProviderRouter fallback/circuit-breaker, tier-based step limits, PersonaProfile + PersonaInjector seed, and streaming infrastructure.

The primary runtime dependency is the **Vercel AI SDK v7** (`ai@^7.0.42`) with provider-specific adapters (`@ai-sdk/openai@^4.0.24`, `@ai-sdk/anthropic@^4.0.24`, `@ai-sdk/google@^4.0.28`) and the community `ollama-ai-provider@^1.2.0`. Zod must be upgraded from v3 to v4 (`zod@^4.4.3`) for `z.strictObject()` and `z.discriminatedUnion`. **All packages verified on npm registry** [VERIFIED: npm registry].

**Critical architectural finding:** The AI SDK v7 deprecates `generateObject` in favor of `generateText({ output: Output.object({ schema }) })`. The product spec (§1.2) and all appendix code reference the deprecated `generateObject` API. Phase 3 implementation MUST use the new `Output.object()` pattern to avoid a future rewrite when `generateObject` is removed. The dual-mode strategy (structured output when supported, generateText+JSON+repair when not) remains valid — only the API surface changes.

**Primary recommendation:** Use `generateText({ output: Output.object({ schema }) })` for all structured output paths (PlannerDecisionSchema, tool input validation). The one-shot JSON repair loop from Appendix L adapts cleanly to the new API. Treat the product spec's `generateObject` references as deprecated and update the spec during Phase 3 execution.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider API calls (fetch/AI calls) | API/Backend (extension page runtime) | — | AI calls originate from extension pages (Side Panel/Full App), not service worker (§0.2). ProviderRouter + adapters use `fetch()` from the page context. |
| Structured output generation | API/Backend (AI SDK `Output.object()`) | — | The AI SDK handles JSON mode natively; ProviderAdapter flags `supportsStructuredOutput` for capability detection. |
| Persona injection (system prompt prepend) | API/Backend (PersonaInjector) | — | Persona blocks are injected into system prompts before AI calls; they must be byte-stable for prompt caching (§1.3). |
| Circuit breaker state | API/Backend (ProviderRouter in-memory) | chrome.storage.local (persistence) | Circuit breaker counters are per-operation in-memory but persisted for cross-session continuity (Optional in this phase). |
| Step limit enforcement | API/Backend (AgentOrchestrator) | — | AgentOrchestrator is the ONLY module allowed to enforce tier caps (§1.4, Appendix I). |
| Streaming UI rendering | Client/Browser (ChunkBuffer + React) | — | ChunkBuffer is UI-layer: rAF batching, message accumulation, render throttling. Pipeline produces semantic StreamEvent, UI controls presentation. |
| API key resolution | API/Backend (ApiKeyStore) | — | ProviderRouter reads encrypted keys from ApiKeyStore (established in Phase 2). |
| Tool execution (deterministic) | API/Backend (ExecutorService) | — | ExecutorService validates tool calls against Zod schemas; NO AI involvement in tool execution. |
| Model-to-tier resolution | API/Backend (TierResolver) | — | Maps haiku/flash → concrete (providerId, model); prevents hallucinated model names. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use `@ai-sdk/*` v4 adapters as the primary runtime abstraction for `generateText`, `streamText`, `generateObject`, and tool calling. Do NOT define a full `ILLMProvider` interface that duplicates AI SDK functions.
- **D-02:** Add a lightweight `ProviderAdapter` per provider for provider-specific concerns only: model resolution, prompt cache hints, connection validation, telemetry metadata, and capability detection (including `supportsStructuredOutput`). ProviderRouter sits above adapters, responsible for retries, fallbacks, circuit breakers, and tier-based model selection.
- **D-03:** Capability-based dual-mode strategy for PlannerDecisionSchema. Prefer native structured output when `ProviderAdapter.supportsStructuredOutput === true`. Fall back to `generateText` with JSON instructions + Zod validation + one-shot repair for Ollama/low-capability models.
- **D-04:** `ProviderAdapter` exposes `supportsStructuredOutput` per provider so PlannerService selects the most reliable path automatically.
- **D-05:** Explicit planner-controlled termination. `PlannerDecision` discriminated union: `answer` and `ask_clarification` are terminal states. `run_tool` is non-terminal. Loop continues while Planner returns `run_tool` and step count < tier cap.
- **D-06:** Tier cap is a safety net, not the primary termination condition. Task completion responsibility stays in PlannerService.
- **D-07:** RendererService as the single user-facing rendering gateway. `stream()` for answer terminals, `synthesize()` for forced render at tier cap. Both paths share persona injection, response formatting, citation handling, output limits, telemetry.
- **D-08:** Deterministic tier presets with optional user overrides. Each `ProviderAdapter` exposes `getDefaultModelForTier(tier)` with curated mappings for FAST, BALANCED, ADVANCED tiers. ProviderRouter consumes tiers, not concrete model IDs.
- **D-09:** Tiered persona injection. PlannerService: behavioral attributes only. ExecutorService: minimal identity metadata or none. RendererService: complete persona profile.
- **D-10:** Structured `PipelineError` objects with standardized error codes — not a deep class hierarchy. Each error: code, category, retryable flag, user-facing message, diagnostic metadata.
- **D-11:** AgentOrchestrator uses a dispatch table: retryable errors → fallback provider/retry/circuit-breaker; terminal errors → surface to user.
- **D-12:** Minimal, versioned `PlannerContext` containing only Phase 3 data sources. Future context sources as optional extension interfaces — unpopulated until their phases ship.
- **D-13:** StreamAdapter is thin pipeline-layer component: converts AI SDK streaming events into stable NowPilot `StreamEvent` union. No render batching or UI-specific processing in the pipeline.
- **D-14:** ChunkBuffer lives in the UI layer: requestAnimationFrame batching, message accumulation, stage indicators, token counting, render throttling.

### the agent's Discretion

No areas were deferred to the agent — all gray areas had explicit decisions from the user.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | User can configure four AI providers (OpenAI, Anthropic, Gemini, Ollama) with automatic fallback and circuit breaker | ProviderAdapter pattern + ProviderRouter with circuit breaker. Each `@ai-sdk/*` provider adapter supports connection validation via API key test call. |
| AI-02 | User interactions flow through PlannerService → ExecutorService → RendererService with tier-based step limits | AgentOrchestrator loop with `stopWhen: isStepCount(cap)` controlling Planner iterations. TierResolver maps model tiers to concrete provider models. |
| AI-03 | User's persona configuration is injected into every AI system prompt via PersonaInjector | PersonaInjector.inject() prepends byte-stable persona block into the cached [SYSTEM] section before every AI call. PersonaProfile from PreferenceMemoryStore (R2: config, not inferred fact). |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | `^7.0.42` | AI SDK core — `generateText`, `streamText`, `Output.object()`, tool calling, abort handling | Vercel's official TypeScript toolkit. Unified interface across all providers. Multi-step agent loops with `stopWhen`/`isStepCount`. [VERIFIED: npm registry] |
| `@ai-sdk/openai` | `^4.0.24` | OpenAI provider adapter — `createOpenAI()`, custom baseURL support | Official Vercel AI SDK provider. Supports OpenAI + OpenAI-compatible endpoints (DeepSeek, Ollama proxy). [VERIFIED: npm registry] |
| `@ai-sdk/anthropic` | `^4.0.24` | Anthropic provider adapter — `createAnthropic()`, prompt caching via `cacheControl: { type: 'ephemeral' }` | Official Vercel AI SDK provider. Native ephemeral caching support. [VERIFIED: npm registry] |
| `@ai-sdk/google` | `^4.0.28` | Gemini provider adapter — `createGoogle()`, safety settings, thinking config | Official Vercel AI SDK provider. Supports Gemini 2.5/3.x models. [VERIFIED: npm registry] |
| `ollama-ai-provider` | `^1.2.0` | Ollama local model adapter — `ollama()` function | Community provider (128K+ weekly downloads). Uses OpenAI-compatible API under the hood. [VERIFIED: npm registry] |
| `zod` | `^4.4.3` | Schema validation — `z.discriminatedUnion()`, `z.strictObject()`, `z.literal()` | TypeScript-first validation. v4 required for `z.strictObject()` (replaces v3 `.strict()`). All pipeline schemas use v4 API. [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@ai-sdk/openai-compatible` | (bundled with `@ai-sdk/openai`) | Generic OpenAI-compatible provider adapter | Alternative to `ollama-ai-provider` if manual control of baseURL/headers needed for Ollama. Not needed if `ollama-ai-provider` works. |
| `zod-to-json-schema` | latest | Convert Zod schema to JSON schema | Used by `Output.object()` internally. Only needed for manual JSON repair fallback path (Appendix L). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@ai-sdk/*` v4 adapters | Direct `fetch()` to provider REST APIs | More control but no unified streaming, tool calling, abort handling. Adds ~200+ lines per provider. AI SDK chosen per D-01. |
| `Output.object()` (new) | `generateObject()` (deprecated) | `generateObject` is deprecated in AI SDK v7. `Output.object()` is the recommended API with identical semantics but used as `output` param on `generateText`/`streamText`. |
| `ollama-ai-provider` | `createOpenAI({ baseURL: 'http://localhost:11434/v1' })` | Direct OpenAI-compatible approach works but `ollama-ai-provider` handles model listing and metadata. Both valid; decision deferred to D-02. |
| `zod@^4.4` | `zod@^3.24` (currently installed) | v3 uses `.strict()`/`.passthrough()` (deprecated in v4). v4 native `z.strictObject()`/`z.looseObject()`. Must upgrade for forward compatibility. [ASSUMED] |

**Installation:**
```bash
npm install ai@^7.0.42 zod@^4.4.3
npm install @ai-sdk/openai@^4.0.24 @ai-sdk/anthropic@^4.0.24 @ai-sdk/google@^4.0.28
npm install ollama-ai-provider@^1.2.0
```

**Version verification:** All versions confirmed via `npm view <pkg> version` on 2026-07-30 against the npm registry. The existing `zod@3.25.76` installed by `tailwindcss` dependency must be upgraded to `zod@4.4.3` — the v3→v4 migration changes `.strict()` to `z.strictObject()` and `.passthrough()` to `z.looseObject()`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `ai` | npm | published 2026-07-29 | 19.1M/wk | github.com/vercel/ai | [SUS] | Flagged — published yesterday (July 2026). Vercel official package; the "too-new" flag is a false positive from the publish timestamp. Planner: verify build passes before shipping. |
| `@ai-sdk/openai` | npm | published 2026-07-29 | 9.6M/wk | github.com/vercel/ai | [SUS] | Flagged — same publish date as `ai`. Part of Vercel monorepo. Same handling as `ai`. |
| `@ai-sdk/anthropic` | npm | published 2026-07-29 | 9.5M/wk | github.com/vercel/ai | [SUS] | Flagged — same publish date as `ai`. Part of Vercel monorepo. Same handling as `ai`. |
| `@ai-sdk/google` | npm | published 2026-07-29 | 6.4M/wk | github.com/vercel/ai | [SUS] | Flagged — same publish date as `ai`. Part of Vercel monorepo. Same handling as `ai`. |
| `ollama-ai-provider` | npm | published 2025-01-17 | 128K/wk | github.com/sgomez/ollama-ai-provider | [OK] | Approved — 2+ years old, Apache-2.0, no postinstall scripts. |
| `zod` | npm | published 2026-05-04 | 245M/wk | github.com/colinhacks/zod | [OK] | Approved — gold-standard validation library, MIT license. |

**Packages removed due to [SLOP] verdict:** `zod@4` — the npm package is just `zod` (not `zod@4`). The latest version is 4.4.3; install as `zod@^4.4.3`.

**Packages flagged as suspicious [SUS]:** `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google` — all from Vercel's official monorepo (`github.com/vercel/ai`), flagged only because the latest version was published less than 24 hours ago on 2026-07-29. These are legitimate, established packages with millions of weekly downloads. The [SUS] verdict is a publish-timestamp artifact, not a quality signal. **Recommendation:** Proceed; the planner should verify build passes on the pinned versions.

*Packages discovered via WebSearch or training data that have not been verified against an authoritative source are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.*

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  Side Panel / Full App (extension page)                              │
│                                                                      │
│  User Input                                                          │
│     │                                                                │
│     ▼                                                                │
│  ┌──────────────────┐                                                │
│  │ AgentOrchestrator │ ◄── TierResolver (haiku/flash caps)          │
│  │  (runAgentTurn)  │ ◄── PersonaInjector (prepend persona block)  │
│  └────────┬─────────┘                                                │
│           │                                                          │
│     ┌─────┴──────────────────────────────────┐                       │
│     │  PlannerService                         │                       │
│     │  ┌─────────────────────────────────┐   │                       │
│     │  │ ProviderAdapter.supportsSO?      │   │                       │
│     │  │  YES → Output.object(schema)     │   │                       │
│     │  │  NO  → generateText + JSON +     │   │                       │
│     │  │         zod parse + 1-shot repair│   │                       │
│     │  └─────────────────────────────────┘   │                       │
│     │  Returns: PlannerDecision               │                       │
│     │  { answer | run_tool | ask_clarify }   │                       │
│     └─────┬──────────────────────────────────┘                       │
│           │                                                          │
│     ┌─────┼─────────────┬──────────────┐                             │
│     │     │             │              │                              │
│     ▼     ▼             ▼              │                              │
│  ┌────────┐  ┌───────────────┐         │                              │
│  │ answer │  │ ask_clarify   │         │                              │
│  │  or    │  │  (terminal)   │         │                              │
│  └───┬────┘  └───────┬───────┘         │                              │
│      │               │                 │                              │
│      ▼               ▼                 │                              │
│  ┌──────────────────────────────┐      │                              │
│  │ RendererService              │      │                              │
│  │  .stream() → StreamAdapter   │      │                              │
│  │  .synthesize() (cap reached) │      │                              │
│  │  ┌────────────────────────┐  │      │                              │
│  │  │ ProviderRouter         │  │      │                              │
│  │  │  ├─ select provider    │  │      │                              │
│  │  │  ├─ fallback chain     │  │      │                              │
│  │  │  └─ circuit breaker    │  │      │                              │
│  │  └────────┬───────────────┘  │      │                              │
│  └───────────┼──────────────────┘      │                              │
│              │                         │                              │
│     ┌────────┴────────┐                │                              │
│     │ StreamAdapter    │                │                              │
│     │ (AI SDK events   │                │                              │
│     │  → StreamEvent)  │                │                              │
│     └────────┬────────┘                │                              │
│              │                         │                              │
│     ┌────────┴────────┐                │                              │
│     │ ChunkBuffer (UI) │               │                              │
│     │ rAF batching     │               │                              │
│     │ stage indicators │               │                              │
│     └────────┬────────┘                │                              │
│              │                         │                              │
│              ▼                         │                              │
│     User sees response                 │                              │
│                                        │                              │
│     ┌──────────────────────────────────────────┐                      │
│     │ run_tool (non-terminal)                   │                      │
│     │  ExecutorService                          │                      │
│     │   ├─ validate toolName (closed enum)      │                      │
│     │   ├─ validate input (Zod schema)          │                      │
│     │   ├─ check permission policy              │                      │
│     │   ├─ execute with timeout                 │                      │
│     │   └─ return ToolExecutionResult           │                      │
│     │  ──→ back to PlannerService (loop)        │                      │
│     └──────────────────────────────────────────┘                      │
│                                                                      │
│  ┌──────────────────────────┐                                        │
│  │ ProviderRouter            │                                        │
│  │  Per-operation state:     │                                        │
│  │  ├─ hasStreamedFirstToken │                                        │
│  │  ├─ circuitBreakerOpen    │                                        │
│  │  └─ attempts[]            │                                        │
│  │                           │                                        │
│  │  Retryable: TIMEOUT,      │                                        │
│  │    PROVIDER_5XX, NETWORK, │                                        │
│  │    RATE_LIMITED           │                                        │
│  │  Non-retryable: AUTH,     │                                        │
│  │    MODEL_UNKNOWN,         │                                        │
│  │    SCHEMA_INVALID         │                                        │
│  └──────────────────────────┘                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/core/ai/
├── AgentOrchestrator.ts       # Planner→Executor loop with tier caps
├── PlannerService.ts          # Haiku-tier action planning (Output.object)
├── ExecutorService.ts         # Deterministic tool validation + execution
├── RendererService.ts         # Flash-tier response rendering
├── ProviderRouter.ts          # Provider selection, fallback, circuit breaker
├── StreamAdapter.ts           # AI SDK events → StreamEvent union
├── ChunkBuffer.ts             # rAF-batched UI buffer
├── TierResolver.ts            # haiku/flash → (providerId, model)
├── StructuredOutput.ts        # One-shot JSON repair loop (Appendix L)
├── PipelineError.ts           # Structured error codes (D-10)
├── types.ts                   # ProviderId, StreamEvent, PipelineError types
├── providers/
│   ├── ProviderAdapter.ts     # Lightweight adapter interface (D-02)
│   ├── openai.ts              # OpenAI adapter (createOpenAI + connection validation)
│   ├── anthropic.ts           # Anthropic adapter (createAnthropic + cache hints)
│   ├── gemini.ts              # Gemini adapter (createGoogle + capability detection)
│   └── ollama.ts              # Ollama adapter (ollama() + structured output flag)
└── persona/
    ├── PersonaProfile.ts      # DEFAULT_PERSONA constant + schema
    └── PersonaInjector.ts     # inject(stage, baseSystem, opts?)
```

### Pattern 1: AI SDK v7 Structured Output (New API — REPLACES generateObject)

**What:** Use `generateText({ output: Output.object({ schema }) })` for structured JSON generation. This is the recommended API in AI SDK v7; `generateObject` is deprecated.

**When to use:** When `ProviderAdapter.supportsStructuredOutput === true` (OpenAI, Anthropic, Gemini). For Ollama/low-capability models, fall back to `generateText` with JSON instructions + Zod validation + one-shot repair.

**Example:**
```typescript
// Source: Context7 /vercel/ai (structured data docs, v7)
import { generateText, Output } from 'ai';
import { z } from 'zod';

const PlannerDecisionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('answer'), reasonCode: z.string().max(64) }),
  z.strictObject({ action: z.literal('run_tool'), toolName: z.string().max(64), input: z.unknown() }),
  z.strictObject({ action: z.literal('ask_clarification'), question: z.string().max(200) }),
]);

const { output } = await generateText({
  model: provider.languageModel('haiku'),
  output: Output.object({ schema: PlannerDecisionSchema }),
  messages: [...],
  // Note: no 'instructions' parameter here — system prompt is embedded in messages
});
// output is typed as PlannerDecision via Zod inference
```
[CITED: sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data]

**CRITICAL:** The product spec (§1.2) and Appendix I both reference the deprecated `generateObject()` API. This research confirms that `generateText({ output: Output.object({ schema }) })` is the current (v7) recommended API and `generateObject` is marked `@deprecated`. The dual-mode capability-based strategy (D-03) remains valid but the API surface changes. The one-shot JSON repair loop (Appendix L) adapts by wrapping `generateText` calls instead of `generateObject`.

### Pattern 2: Multi-Step Agent Loop (AgentOrchestrator)

**What:** PlannerService → (run_tool?) → ExecutorService → (loop) with `stopWhen: isStepCount(n)` controlling iteration count.

**When to use:** Every user interaction. AgentOrchestrator is the only module allowed to enforce step caps.

**Example:**
```typescript
// Source: Context7 /vercel/ai (tool calling docs, v7)
// Adapted for NowPilot pipeline
import { generateText, Output, tool, isStepCount } from 'ai';
import { z } from 'zod';

async function plan(operationId: string, context: PlannerContext, tools: Record<string, any>, caps: { planner: number }) {
  const { output, steps } = await generateText({
    model: tierModel, // from TierResolver
    output: Output.object({ schema: PlannerDecisionSchema }),
    tools,
    stopWhen: isStepCount(caps.planner),
    messages: context.messages,
    abortSignal: context.abortSignal,
    onStepEnd({ stepNumber, text, toolCalls, toolResults }) {
      // Log step for AITransactionLog (Phase 6)
    },
  });
  return { output, steps };
}
```
[CITED: sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling]

### Pattern 3: Provider Adapter with Capability Detection

**What:** Lightweight adapter per provider (D-02) exposing only provider-specific concerns. Not a full ILLMProvider interface.

**When to use:** ProviderRouter uses adapters for model resolution, connection validation, capability detection. PlannerService reads `supportsStructuredOutput`.

**Example:**
```typescript
// src/core/ai/providers/ProviderAdapter.ts
export interface ProviderAdapter {
  providerId: ProviderId;
  createLanguageModel(modelId: string): LanguageModel;
  validateConnection(): Promise<{ ok: boolean; models: string[] }>;
  supportsStructuredOutput: boolean;
  getDefaultModelForTier(tier: 'FAST' | 'BALANCED' | 'ADVANCED'): string;
  getCacheStrategy(): 'anthropic-ephemeral' | 'gemini-cachedContent' | 'prefix-only';
  getTelemetryMetadata(): Record<string, unknown>;
}

// src/core/ai/providers/openai.ts
import { createOpenAI } from '@ai-sdk/openai';

export function createOpenAIAdapter(apiKey: string, baseURL?: string): ProviderAdapter {
  const client = createOpenAI({ apiKey, baseURL, compatibility: 'strict' });
  return {
    providerId: 'openai',
    createLanguageModel: (modelId) => client(modelId),
    supportsStructuredOutput: true,
    async validateConnection() { /* fetch /v1/models, check response */ },
    getDefaultModelForTier(tier) {
      const mapping = { FAST: 'gpt-4o-mini', BALANCED: 'gpt-4o', ADVANCED: 'o3-mini' };
      return mapping[tier];
    },
    getCacheStrategy: () => 'prefix-only',
    getTelemetryMetadata: () => ({ provider: 'openai' }),
  };
}
```
[CITED: Context7 /vercel/ai (provider docs), D-02, D-08]

### Pattern 4: Circuit Breaker in ProviderRouter

**What:** Track consecutive failures per provider. After 3 failures in 60s, open circuit for 5 minutes. Retryable errors: TIMEOUT, PROVIDER_5XX, NETWORK, RATE_LIMITED. Non-retryable: AUTH, MODEL_UNKNOWN, SCHEMA_INVALID.

**When to use:** Every AI call goes through ProviderRouter. Circuit breaker state is per-operation, in-memory.

**Example:**
```typescript
// src/core/ai/ProviderRouter.ts
interface RouterAttemptState {
  operationId: string;
  attempts: ProviderAttempt[];
  hasStreamedFirstToken: boolean;
  circuitBreakerOpen: Record<ProviderId, number>; // timestamp when reopen allowed
}

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_WINDOW_MS = 60_000;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60_000;

function isRetryable(error: PipelineError): boolean {
  return ['TIMEOUT', 'PROVIDER_5XX', 'NETWORK', 'RATE_LIMITED'].includes(error.code);
}

function shouldOpenCircuit(state: RouterAttemptState, providerId: ProviderId): boolean {
  const recentFailures = state.attempts.filter(
    a => a.providerId === providerId && !a.success && (Date.now() - a.timestamp) < CIRCUIT_BREAKER_WINDOW_MS
  );
  return recentFailures.length >= CIRCUIT_BREAKER_THRESHOLD;
}
```
[CITED: CONTEXT.md D-01, D-02, PRODUCT_SPEC_v0_1 §1.5]

### Anti-Patterns to Avoid

- **Anti-pattern: Using `generateObject` in new code.** It's deprecated in AI SDK v7. Use `generateText({ output: Output.object({ schema }) })`. The product spec references `generateObject` but these must be updated during Phase 3 execution.
- **Anti-pattern: Calling AI providers from React components.** All AI calls must go through AgentOrchestrator. No component may call `generateText`/`streamText` directly.
- **Anti-pattern: Using v3 Zod APIs (`.strict()`, `.passthrough()`, `.format()`, `.flatten()`) in new code.** Use v4 equivalents: `z.strictObject()`, `z.looseObject()`, `z.formatError()`, `z.treeifyError()`.
- **Anti-pattern: Hard-coding model names in PlannerService/RendererService.** Use TierResolver → ProviderAdapter.getDefaultModelForTier(). Model names come from configured tier mappings, not from code constants.
- **Anti-pattern: Running AI calls from the service worker.** AI calls originate from extension pages (Side Panel/Full App), which have `fetch()` and no 30s termination limit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-step agent loop | Custom while-loop with manual state tracking | AI SDK `stopWhen: isStepCount(n)` with `steps` array | AI SDK handles tool call→result→next step automatically, provides typed `steps` with per-step metadata, usage tracking, and abort propagation. |
| Streaming text to UI | Custom SSE parser + manual chunk delivery | AI SDK `streamText()` + StreamAdapter + ChunkBuffer | AI SDK handles provider-specific SSE formats, abort signals, and partial response handling. ChunkBuffer handles UI-layer batching. |
| Structured JSON generation | Manual JSON.parse + try/catch repair loop per call | `Output.object({ schema })` (native) or Appendix L repair pattern (fallback) | AI SDK's `Output.object()` handles JSON mode natively at the provider level. The repair loop is pre-defined in Appendix L — don't reinvent. |
| Provider fallback logic | Custom try/catch with manual retry counters | ProviderRouter with circuit breaker pattern | Defined in §1.5: retryable vs non-retryable errors, hasStreamedFirstToken guard, circuit breaker after 3 failures. |
| Persona string templating | Template literals scattered across services | PersonaInjector.inject(stage, baseSystem, opts) with byte-stable buildPersonaBlock() | Centralized injection ensures prompt caching stability (§1.3). Single source of truth for persona blocks. |
| Abort signal plumbing | Manual AbortController chains | AI SDK auto-forwards `abortSignal` to tool `execute()` | AI SDK propagates abort signals through the entire call chain. Tools receive `abortSignal` in execute options. |
| Token counting | `text.length / 4` scattered across code | Use AI SDK's `usage` object returned by `generateText`/`streamText` | AI SDK provides provider-reported token counts in `result.usage`. Fallback to `Math.ceil(text.length / 4)` only when usage unavailable. |

**Key insight:** The AI SDK v7 is the "don't hand-roll" library for AI pipelines. It handles provider-specific streaming, tool calling, structured output, abort handling, and usage tracking. The NowPilot pipeline adds domain-specific layers (tier caps, persona injection, tool validation) on top — not replacing AI SDK internals.

## Common Pitfalls

### Pitfall 1: generateObject Deprecation in AI SDK v7

**What goes wrong:** Code written against the product spec's `generateObject()` API will work initially (deprecated, not removed) but will break when `generateObject` is removed in a future AI SDK release. The product spec and all appendix code reference the old API.

**Why it happens:** The product spec (PRODUCT_SPEC_v0_1.md, Rev. B) was written before AI SDK v7 finalized the `Output.object()` API. The spec's `generateObject` references are now stale.

**How to avoid:** Use `generateText({ output: Output.object({ schema }) })` for all structured output. The return type changes from `GenerateObjectResult<T>` to the `output` property on `GenerateTextResult`. Update the product spec references during implementation.

**Warning signs:** IDE shows `@deprecated` annotation on `generateObject` import. TypeScript compiler suggests `generateText` with `output` setting.

### Pitfall 2: Zod v3→v4 API Migration in Existing Code

**What goes wrong:** The project currently has `zod@3.25.76` installed (via tailwindcss dependency). The product spec uses v4 APIs (`z.strictObject()`, `z.looseObject()`). Installing `zod@^4` alongside v3 may cause conflicts.

**Why it happens:** tailwindcss 4.x transitively depends on zod@3 via jiti. The project needs zod@4 for Phase 3. Two major versions of the same package create import resolution issues.

**How to avoid:** Install `zod@^4.4.3` as a direct dependency. The v4 package should take precedence over transitive v3. Use `z.strictObject()` instead of `.strict()`, `z.looseObject()` instead of `.passthrough()`. Where v3 and v4 APIs differ (e.g., `.format()` → `z.formatError()`), use the v4 API.

**Warning signs:** Runtime error: `z.strictObject is not a function`. TypeScript: `Property 'strictObject' does not exist on type 'typeof z'`.

### Pitfall 3: Abort Signal Not Threading Through Pipeline

**What goes wrong:** User aborts a request but the AI call continues consuming tokens because the `AbortSignal` wasn't propagated to `generateText`/`streamText`.

**Why it happens:** The AbortController is created in the UI layer (useStreamingLLM hook) but may not reach the AgentOrchestrator if the signal isn't threaded through every function call.

**How to avoid:** Pass `abortSignal` through AgentOrchestrator → PlannerService → ProviderRouter → `generateText`. The AI SDK auto-forwards the signal to tool `execute()` functions. Verify with an integration test that creates an AbortController, calls abort(), and asserts no further tokens are generated.

**Warning signs:** Console shows "API call completed" after user pressed Stop. Token usage counts increase after abort.

### Pitfall 4: hasStreamedFirstToken Not Checked During Fallback

**What goes wrong:** ProviderRouter switches providers mid-stream after the first token has already been sent to the user. The stream restarts with a new provider, producing garbled/duplicate output.

**Why it happens:** §1.5 explicitly forbids provider switching after `hasStreamedFirstToken === true`, but a missing guard allows the fallback logic to trigger.

**How to avoid:** Wrap the entire `streamText`/`generateText` call in a try/catch. Only attempt fallback if `hasStreamedFirstToken` is false AND the error is retryable. Set `hasStreamedFirstToken = true` on the first `text-delta` StreamEvent.

**Warning signs:** User sees partial response from one model, then a different model's response appended. Duplicate "Hello! I'm..." intros.

### Pitfall 5: Persona Block Breaking Prompt Cache

**What goes wrong:** The persona block changes on every request (e.g., includes timestamp, dynamic greeting) — making the cached `[SYSTEM]` section different each time and defeating prompt caching.

**Why it happens:** §1.3 requires byte-stable cached sections. A dynamic value in the persona block invalidates the cache for Anthropic/Gemini providers.

**How to avoid:** `PersonaInjector.buildPersonaBlock()` must be byte-stable for a given persona ID. Use only the persona profile fields (identity, core values, language style, behavioral drivers) — no timestamps, conversation IDs, or dynamic content. The persona block is prepended to the SYSTEM section; its stability preserves the cache.

**Warning signs:** Cache hit rate near 0% for Anthropic provider. `inputTokenDetails.cacheWriteTokens` equals `inputTokenDetails.totalInputTokens` on every request.

## Code Examples

Verified patterns from official sources:

### Provider Instantiation with API Key from ApiKeyStore
```typescript
// Source: Context7 /vercel/ai (provider docs, v7)
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { ollama } from 'ollama-ai-provider';
import { useApiKeyStore } from '../../core/storage/ApiKeyStore';

export function createProviderAdapter(
  providerId: ProviderId,
  getKey: (id: string) => Promise<string | null>
): ProviderAdapter {
  switch (providerId) {
    case 'openai': {
      const apiKey = await getKey('openai');
      const client = createOpenAI({ apiKey, compatibility: 'strict' });
      // ...
    }
    case 'anthropic': {
      const apiKey = await getKey('anthropic');
      const client = createAnthropic({ apiKey });
      // ...
    }
    case 'gemini': {
      const apiKey = await getKey('gemini');
      const client = createGoogle({ apiKey });
      // ...
    }
    case 'ollama': {
      // ollama-ai-provider connects to http://localhost:11434 by default
      // No API key needed for local Ollama
      return { createLanguageModel: (id) => ollama(id), supportsStructuredOutput: false, /* ... */ };
    }
  }
}
```
[CITED: Context7 /vercel/ai provider docs + npmjs.com/package/ollama-ai-provider]

### Anthropic Ephemeral Prompt Caching
```typescript
// Source: Context7 /vercel/ai (Anthropic provider docs, v7)
// Cache the stable SYSTEM section (including persona block)
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const result = await generateText({
  model: anthropic('claude-haiku-4-latest'),
  messages: [
    {
      role: 'system',
      content: personaBlock + '\n\n' + canonicalSystemPrompt,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    },
    { role: 'user', content: userPrompt },
  ],
});
// Cache metrics available in: result.usage.inputTokenDetails.cacheReadTokens
```
[CITED: sdk.vercel.ai/providers/ai-sdk-providers/anthropic]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ollama-ai-provider@^1.2.0` works correctly with AI SDK v7 (`ai@^7.0.42`). The provider was published in 2025 and may not have been tested against the latest AI SDK core. | Standard Stack | Ollama integration breaks; fall back to `createOpenAI({ baseURL: 'http://localhost:11434/v1' })` with OpenAI-compatible mode. |
| A2 | `@ai-sdk/google@^4.0.28` supports `createGoogle()` with the same API as `@ai-sdk/openai@^4.0.24` and `@ai-sdk/anthropic@^4.0.24`. The Google provider uses different parameter names for some features. | Standard Stack | ProviderAdapter interface may need Google-specific fields. Risk is LOW — all `@ai-sdk/*` v4 providers follow the same LanguageModelV1 interface. |
| A3 | Zod v4 (`zod@^4.4.3`) can coexist with the transitive `zod@3.x` dependency from tailwindcss/jiti without runtime conflicts. | Common Pitfalls | The transitive v3 may be loaded first, causing v4 APIs (`z.strictObject()`) to fail. Risk is MEDIUM — may need `overrides` in package.json or a Dedupe strategy. [ASSUMED] |
| A4 | The `generateText({ output: Output.object({ schema }) })` API is sufficient for PlannerDecisionSchema. The structs output feature counts as an additional step in `stopWhen: isStepCount()`. | Architecture Patterns | If structured output adds +1 step to every operation, tier caps need adjustment. Risk is LOW — the AI SDK docs confirm structured output is part of the multi-step model. |
| A5 | The `FAST`/`BALANCED`/`ADVANCED` tier model from D-08 maps directly to the `haiku`/`flash` ModelTier from Appendix D. The mapping is: FAST→haiku, BALANCED→flash, ADVANCED→flash (with largest model). | Architecture Patterns | Tier semantics may diverge. Risk is LOW — the CONTEXT.md D-08 supersedes the product spec Appendix D. |

## Open Questions

1. **Should ChunkBuffer live in `src/core/ai/` or `src/hooks/`?**
   - What we know: D-14 says ChunkBuffer "lives in the UI layer" with rAF batching. The product spec places it at `src/core/ai/ChunkBuffer.ts` but the implementation is UI-specific.
   - What's unclear: Whether ChunkBuffer should be in the core layer (importable by both Side Panel and Full App) or the UI hooks layer.
   - Recommendation: Place at `src/core/ai/ChunkBuffer.ts` as product spec dictates, but it uses `requestAnimationFrame` (DOM API) — this is fine since it only runs in extension pages (Side Panel/Full App) which have DOM access.

2. **How should ProviderRouter persist circuit breaker state across sessions?**
   - What we know: Circuit breaker state is per-operation, in-memory. The spec does not mention cross-session persistence.
   - What's unclear: Whether the circuit breaker should reset on page reload or persist in chrome.storage.local.
   - Recommendation: Start with in-memory only (page reload resets). Add persistence in a future iteration if cross-session circuit breaker state proves valuable. The 5-minute cooldown is short enough that in-memory is sufficient.

3. **What Zod version should the project standardize on — v3 or v4?**
   - What we know: `zod@3.25.76` is currently installed. The product spec uses v4 APIs. Installing v4 alongside v3 may cause conflicts.
   - What's unclear: Can we safely upgrade to v4 without breaking tailwindcss/jiti which depends on v3?
   - Recommendation: Install `zod@^4.4.3` as direct dependency. Run `pnpm why zod` to audit transitive dependencies. If conflicts arise, use `pnpm.overrides` to force v4. The v4 package is backwards-compatible for most v3 usage; jiti uses basic Zod features that should work with v4.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/dev runtime | ✓ | v26.5.0 | — |
| npm | Package management | ✓ | 11.17.0 | — |
| TypeScript | Type checking | ✓ | 5.8.3 | — |
| Vitest | Testing | ✓ | 3.2.7 | — |
| `ai` (npm) | AI SDK core — generateText, streamText, tool calling | ✓ (not installed) | 7.0.42 | Cannot operate without — this is the core AI runtime. |
| `@ai-sdk/openai` (npm) | OpenAI provider adapter | ✓ (not installed) | 4.0.24 | — |
| `@ai-sdk/anthropic` (npm) | Anthropic provider adapter | ✓ (not installed) | 4.0.24 | — |
| `@ai-sdk/google` (npm) | Gemini provider adapter | ✓ (not installed) | 4.0.28 | — |
| `ollama-ai-provider` (npm) | Ollama local model adapter | ✓ (not installed) | 1.2.0 | `createOpenAI({ baseURL })` for OpenAI-compatible mode |
| `zod@^4` (npm) | Schema validation — strictObject, discriminatedUnion | ✓ (zod@3 installed, needs upgrade) | 4.4.3 | Cannot use v3 — v4 APIs required for `z.strictObject()`, `z.discriminatedUnion()` |
| Ollama (local binary) | Local model runtime | ✗ | — | Ollama-ai-provider will fail at runtime if Ollama binary not installed. Graceful error: "Ollama not available — start Ollama or select another provider." |

**Missing dependencies with no fallback:**
- `ai@^7`, `@ai-sdk/*@^4`, `zod@^4` — these are the core AI runtime. Must be installed before any pipeline code runs.

**Missing dependencies with fallback:**
- Ollama binary — `ollama-ai-provider` will throw connection error; ProviderRouter can detect this and mark ollama as unavailable in its fallback chain.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.7 |
| Config file | `vitest.config.ts` (from WXT) |
| Quick run command | `npx vitest run tests/core/ai` |
| Full suite command | `npm run verify:phase-3` (tsc --noEmit && vitest run tests/core/ai tests/core/ai/persona) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-01 | Provider adapter validates connection with correct API key | unit | `vitest run tests/core/ai/providers/ProviderAdapter.test.ts -t "connection validation"` | ❌ Wave 0 |
| AI-01 | ProviderRouter falls back to next provider on retryable error | integration | `vitest run tests/core/ai/ProviderRouter.test.ts -t "fallback chain"` | ❌ Wave 0 |
| AI-01 | Circuit breaker opens after 3 consecutive failures | unit | `vitest run tests/core/ai/ProviderRouter.test.ts -t "circuit breaker"` | ❌ Wave 0 |
| AI-02 | PlannerService returns PlannerDecision via structured output | unit | `vitest run tests/core/ai/PlannerService.test.ts -t "plan decision"` | ❌ Wave 0 |
| AI-02 | ExecutorService rejects unknown tool names | unit | `vitest run tests/core/ai/ExecutorService.test.ts -t "reject unknown tool"` | ❌ Wave 0 |
| AI-02 | RendererService produces output within token cap | unit | `vitest run tests/core/ai/RendererService.test.ts -t "output limits"` | ❌ Wave 0 |
| AI-02 | AgentOrchestrator enforces tier caps (planner=3, tool=2) | integration | `vitest run tests/core/ai/AgentOrchestrator.test.ts -t "tier caps"` | ❌ Wave 0 |
| AI-03 | PersonaInjector prepends persona block into system prompt | unit | `vitest run tests/core/ai/persona/PersonaInjector.test.ts -t "injects persona"` | ❌ Wave 0 |
| AI-03 | Persona block is byte-stable for same persona profile | unit | `vitest run tests/core/ai/persona/PersonaInjector.test.ts -t "byte stable"` | ❌ Wave 0 |
| SC-05 | Structured output with malformed JSON repaired once, fails on second | unit | `vitest run tests/core/ai/StructuredOutput.test.ts -t "one-shot repair"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/ai tests/core/ai/persona`
- **Per wave merge:** `npm run verify:phase-3`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/ai/` — entire test directory needs creation
- [ ] `tests/core/ai/persona/` — persona-specific tests
- [ ] `tests/core/ai/providers/` — provider adapter tests
- [ ] Mock AI SDK provider — needed to test pipeline without real API calls. Use `MockLanguageModelV1` pattern from AI SDK.
- [ ] Test fixtures for PlannerDecisionSchema, ToolExecutionResult, PipelineError
- [ ] Framework install: AI SDK + provider packages + zod@4 not yet in package.json

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | API keys handled by ApiKeyStore (Phase 2) — not in this phase's scope |
| V3 Session Management | No | Session tokens in chrome.storage.session (Phase 2) |
| V4 Access Control | No | Tool permission gating in Phase 8 |
| V5 Input Validation | Yes | `zod@^4` — all LLM inputs and tool inputs validated against Zod schemas. ExecutorService validates tool names against closed `z.enum()`, inputs against tool schemas. StructuredOutput repair validates JSON output against Zod schema. |
| V6 Cryptography | No | API key encryption in Phase 2 — ProviderRouter reads decrypted keys from ApiKeyStore |

### Known Threat Patterns for AI SDK v7 + Chrome MV3

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM generates hallucinated tool name not in registered tools | Spoofing | ExecutorService validates `toolName` against closed `z.enum()` derived from ToolRegistry. Unknown names → `NoSuchToolError`. |
| LLM generates tool input that doesn't match schema | Tampering | AI SDK's `inputSchema` validates tool inputs before `execute()`. Invalid inputs throw `InvalidToolInputError`. |
| Malicious web page injects content into AI prompt via PageContext | Information Disclosure | Content scripts extract content only; sanitization in Phase 9 (DOMPurify). Phase 3 doesn't handle page content injection. |
| API key leaked via `usage` or error messages in client bundle | Information Disclosure | ProviderRouter reads keys from ApiKeyStore (encrypted in chrome.storage.local). Keys are never included in error messages or streaming output. |
| Abort signal not propagated → orphaned AI calls consume tokens | Denial of Service | AI SDK auto-forwards `abortSignal` to `execute()`. Pipeline tests verify abort propagation. |
| Prompt injection via user input that manipulates system prompt | Elevation of Privilege | PersonaInjector prepends persona block AFTER the `[SYSTEM]` section header. User input is in the `[USER INPUT: current turn]` section — clearly separated from system instructions. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `generateObject()` with Zod schema | `generateText({ output: Output.object({ schema }) })` | AI SDK v7 (2026) | `generateObject` is deprecated. New API supports `streamText` structured output streaming via `partialOutputStream`. |
| Zod v3 `.strict()` / `.passthrough()` | Zod v4 `z.strictObject()` / `z.looseObject()` | Zod v4 (2026) | v3 APIs still work but emit deprecation warnings. v4 APIs are the canonical form. |
| `experimental_activeTools` | `activeTools` | AI SDK v7 | Renamed; old name removed. |
| `system` parameter | `instructions` parameter (renamed) | AI SDK v7 | The `system` role in messages array replaced by `instructions` on `generateText`. However, system messages embedded in the `messages` array as `{ role: 'system', content: '...' }` still work. |
| `experimental_onStart` | `onStart` | AI SDK v7 | Renamed; old name removed. |
| Raw `fetch()` to provider REST APIs (current `aiProvider.ts`) | `@ai-sdk/*` adapters through AI SDK `generateText`/`streamText` | Phase 3 | Full pipeline replaces the legacy SSE streaming in `src/services/aiProvider.ts`. |

**Deprecated/outdated:**
- `generateObject()`: Use `generateText({ output: Output.object({ schema }) })` [CITED: AI SDK source code `@deprecated` annotation]
- `z.object().strict()`: Use `z.strictObject()` [CITED: Zod v4 changelog]
- `z.object().passthrough()`: Use `z.looseObject()` [CITED: Zod v4 changelog]
- `src/services/aiProvider.ts`: Entire file replaced by this pipeline. Remove after Phase 3 verification passes.
- `ProviderType` in `src/types/index.ts`: Uses `'claude'` instead of `'anthropic'`, missing `'ollama'`. Replace with canonical `ProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama'`.

## Sources

### Primary (HIGH confidence — Context7 official docs)
- Context7 `/vercel/ai` — AI SDK v7 core: `generateText`, `streamText`, `Output.object()`, tool calling, `isStepCount`, `stopWhen`, abort handling, error handling, multi-step execution, provider management
- Context7 `/websites/ai-sdk_dev` — AI SDK structured data generation, `Output.object()`, `Output.json()`, `Output.array()`, `Output.choice()`, error handling with `NoObjectGeneratedError`
- Context7 `/colinhacks/zod` — Zod v4: `z.strictObject()`, `z.looseObject()`, `z.discriminatedUnion()`, v3→v4 migration, deprecated APIs, `safeParse()`
- sdk.vercel.ai — Official AI SDK documentation: generating structured data, tool calling, Anthropic cache control, Google provider setup

### Secondary (MEDIUM confidence — npm registry + official docs)
- npmjs.com — Package version verification: `ai@7.0.42`, `@ai-sdk/openai@4.0.24`, `@ai-sdk/anthropic@4.0.24`, `@ai-sdk/google@4.0.28`, `ollama-ai-provider@1.2.0`, `zod@4.4.3`
- npmjs.com/package/ollama-ai-provider — README confirms `import { ollama } from 'ollama-ai-provider'` and `generateText({ model: ollama('phi3') })` pattern [VERIFIED: npm registry]
- github.com/vercel/ai — Vercel AI SDK monorepo source; confirm `generateObject` is `@deprecated` [CITED: packages/ai/src/generate-object/generate-object.ts]

### Tertiary (LOW confidence — training data)
- No LOW-confidence claims are used as primary recommendations. All assertions are backed by Context7 docs or npm registry verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via `npm view`, confirmed on registry, official Context7 docs support the API surface
- Architecture: HIGH — patterns verified against AI SDK v7 official docs, product spec constraints applied correctly
- Pitfalls: MEDIUM — Zod v3/v4 conflicts and generateObject deprecation are verified; Ollama provider compatibility is assumed (A1)
- Package legitimacy: MEDIUM — `ai` + `@ai-sdk/*` flagged [SUS] due to recency of latest publish (2026-07-29) but confirmed legitimate via source repo and weekly downloads

**Research date:** 2026-07-30
**Valid until:** 2026-08-30 (AI SDK publishes frequently; verify against current docs if implementation extends beyond this date)
