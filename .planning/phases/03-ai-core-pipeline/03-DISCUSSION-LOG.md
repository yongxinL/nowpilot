# Phase 3: AI Core Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 03-ai-core-pipeline
**Areas discussed:** Provider abstraction layer, Structured output for PlannerService, AgentOrchestrator loop control, Streaming path through pipeline, Tier model strategy, Persona injection scope, Error handling taxonomy, Conversation context assembly, StreamAdapter + ChunkBuffer

---

## Provider Abstraction Layer

| Option | Description | Selected |
|--------|-------------|----------|
| AI SDK directly | Use @ai-sdk/* adapters as the sole provider layer. ProviderRouter wraps LanguageModelV2. Minimal ILLMProvider. | |
| Custom ILLMProvider interface | Full interface with chat(), chatStream(), chatObject(). Each provider implements it. | |
| Hybrid — thin wrapper | AI SDK as primary, lightweight ProviderAdapter for provider-specific concerns. ProviderRouter above adapters. | ✓ |

**User's choice:** Hybrid thin-wrapper architecture. AI SDK v7 as primary runtime for text generation, streaming, structured output, and tool calling. Lightweight ProviderAdapter for model resolution, prompt cache hints, connection validation, telemetry metadata, and capability detection. ProviderRouter above adapters for retries, fallbacks, circuit breakers, tier selection. No full ILLMProvider duplication of AI SDK functions.

---

## Structured Output for PlannerService

| Option | Description | Selected |
|--------|-------------|----------|
| generateObject (AI SDK) | Use AI SDK's generateObject with Zod schema. Most reliable. Ollama support depends on model. | |
| generateText + zod repair | Manual generateText + JSON parsing + one-shot repair. Works with all providers. | |
| Dual-mode — auto-detect | generateObject when capability exists, fallback to generateText + repair for others. | ✓ |

**User's choice:** Capability-based dual-mode. Prefer generateObject with Zod discriminated union when ProviderAdapter.supportsStructuredOutput is true. Fallback to generateText with JSON instructions + zod validation + single repair pass for Ollama/low-capability models. ProviderAdapter reports supportsStructuredOutput.

---

## AgentOrchestrator Loop Control

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit stop signal | PlannerDecision always has done flag. answer = always done. run_tool optional done=false. | |
| Step limit only | No done flag. Loop until tier cap. Cap is the only guardrail. | |
| Intent-based termination | ExecutorService returns needsReplan. Heuristic-based. Nuanced but complex. | ✓ |

**User's choice:** Explicit planner-controlled termination. PlannerDecision discriminated union: answer and ask_clarification are terminal, run_tool is non-terminal. Loop continues while Planner returns run_tool and step count < tier cap. Task completion stays in PlannerService, not ExecutorService. Tier cap is safety net, not primary termination.

---

## Streaming Path Through Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| RendererService owns streaming | RendererService.stream() → streamText via ProviderRouter. Full pipeline participation. | |
| Orchestrator bypass for answer | AgentOrchestrator calls streamText directly for answer decisions, bypassing RendererService. | |
| Two-mode RendererService | stream() for answer terminals, synthesize() for forced render. Both through RendererService. | ✓ |

**User's choice:** RendererService as single rendering gateway. stream() for answer terminals (uses streamText via ProviderRouter). synthesize() for forced render at tier cap (uses generateText with accumulated context). Both share persona injection, response formatting, citation handling, output limits, and telemetry.

---

## Tier Model Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded tier presets | ProviderAdapter defines known cheap/capable model IDs per tier. User can override. | ✓ |
| Provider-reported model ranking | Fetch model lists, rank by capability metadata. Dynamic but fragile. | |
| User-configured model per tier | User explicitly selects model for each tier in settings UI. Most control. | |

**User's choice:** Deterministic tier presets with optional user overrides. ProviderAdapter exposes getDefaultModelForTier(tier) with curated FAST/BALANCED/ADVANCED mappings. ProviderRouter consumes tiers, not model IDs. User can override in settings.

---

## Persona Injection Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Planner + Renderer only | Planner gets minimal persona. Renderer gets full. Executor gets none. | |
| All stages, same persona | Same PersonaProfile injected everywhere. Simplest, consistent. | |
| Tiered injection | Planner gets behavioral. Executor gets functional. Renderer gets full. | ✓ |

**User's choice:** Tiered persona injection. PlannerService receives behavioral attributes (brevity, clarification strategy, reasoning style). ExecutorService receives none or minimal identity metadata. RendererService receives complete persona (tone, voice, formatting, behavior rules, response style).

---

## Error Handling Taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Typed error hierarchy | PipelineError base class with subtypes. Class-based routing. | |
| Error codes + minimal types | Standardized error codes with structured flat objects. Dispatch table routing. | ✓ |
| Result pattern (never throw) | Result<T, PipelineError>. No exceptions. Pattern-matching. | |

**User's choice:** Structured PipelineError objects with standardized error codes, not a deep class hierarchy. Contains code, category, retryable flag, user-facing message, diagnostic metadata. Serializable across extension contexts. AgentOrchestrator uses dispatch table for retryable vs. terminal routing.

---

## Conversation Context Assembly

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal phase-3 context | PlannerContext with only existing data sources. Optional extension interfaces for future. | ✓ |
| Rich speculative context | Full PlannerContext with all future fields as empty stubs. Conditional prompt sections. | |
| Defer to AgentOrchestrator | Opaque context string. AgentOrchestrator owns assembly entirely. | |

**User's choice:** Minimal PlannerContext containing userMessage, conversationHistory, toolCallHistory, availableTools, personaBehavior. Future sources as optional extension interfaces, unpopulated until their phases ship. Stable contract, no dead code.

---

## StreamAdapter + ChunkBuffer

| Option | Description | Selected |
|--------|-------------|----------|
| StreamAdapter as provider normalizer | Full stream normalization. ChunkBuffer for rAF batching. Pipeline produces events. | |
| AI SDK provides enough | StreamAdapter unnecessary. RendererService forwards AI SDK stream directly. Only ChunkBuffer is custom. | |
| ChunkBuffer as main concern | StreamAdapter is minimal type mapper. ChunkBuffer is real value: rAF batching, stage indicators, token counting. | ✓ |

**User's choice:** StreamAdapter is thin pipeline-layer: converts AI SDK events into stable StreamEvent union (text-delta, tool-call, tool-result, error, done). ChunkBuffer lives in UI layer: rAF batching, message accumulation, stage indicators, token counting, render throttling. Pipeline produces semantic events, UI controls presentation.

---

## the agent's Discretion

No areas were deferred to the agent — all 9 gray areas had explicit decisions from the user.

## Deferred Ideas

None — discussion stayed within phase scope.
