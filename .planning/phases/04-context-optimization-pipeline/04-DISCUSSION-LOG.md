# Phase 4: Context Optimization Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 4-Context Optimization Pipeline
**Areas discussed:** Integration Architecture, ContextCompressor Summarization, Token Counting Strategy, PromptCacheManager Scope, Context Provenance Granularity, Source-Level ContextProvenanceManifest

---

## Integration Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Before runTurn — external wrapper | ContextOptimizer called before runTurn(), AgentOrchestrator accepts OptimizedContext | |
| Inside runTurn — orchestrator-owned | AgentOrchestrator calls ContextOptimizer internally at top of runTurn() | |
| Pipeline transform — pure function injection | ContextOptimizer is a stateless transform applied by the caller | ✓ (hybrid) |

**User's choice:** ContextOptimizer is a first-class pipeline stage that owns context assembly, budgeting, compression, provenance tracking, and prompt-cache preparation. AgentOrchestrator consumes OptimizedContext internally but exposes runTurn(rawInput) as clean public API.

**Notes:** runTurn() takes raw conversational input. ContextAssembler gathers available sources. ContextOptimizer budgets/compresses/degrades. Both are internal stages. PlannerService and RendererService both consume OptimizedContext. ExecutorService stays tool-focused. PlannerContext renamed to AgentTurnInput — extension interfaces removed. Optimize once per turn, both synthesize() and stream() consume the same OptimizedContext. Missing future-phase data fields are optional with graceful no-ops.

### Integration Architecture — Follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Optional fields with graceful no-op | Future-phase fields are optional; ContextOptimizer skips undefined | ✓ |
| Stub interfaces returning empty defaults | Create stub services for MemoryEngine and PageContentService | |
| Progressive input builder | ContextAssembler grows as phases ship | ✓ (combined) |

**User's choice:** ContextAssembler + optional fields. ContextOptimizerInput defines optional fields. ContextAssembler gathers available sources. ContextOptimizer skips undefined sections. No stubs.

---

## ContextCompressor Summarization

| Option | Description | Selected |
|--------|-------------|----------|
| Local heuristics only | Truncation + extractive techniques, no AI call | |
| Hybrid: local first, AI on overflow | Local techniques first; lightweight LLM only when still over budget | ✓ |
| Pure AI summarization | Always use LLM via side-channel | |

**User's choice:** Hybrid compression. Local deterministic techniques first (recency retention, truncation, dedup, extractive). AI summarization via ProviderRouter only when context remains above budget after all local steps.

**Notes:** Degradation follows spec sequence strictly — check budget after each step, stop when under budget. AI overflow uses cheapest summarisation-capable model via ProviderRouter.getCompressionModel(), independent of user's tier. Compression is infrastructure, not answer quality.

---

## Token Counting Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone TokenBudget utility | Separate service; ProviderAdapter gains optional countTokens() | ✓ |
| ProviderAdapter gains countTokens() | Each adapter implements counting directly | |
| ContextOptimizer owns token counting | Char-based counting only, no provider integration | |

**User's choice:** Dedicated TokenBudget service in src/core/context/. ProviderAdapter optional countTokens(). TokenBudget orchestrates native + fallback + section-level allocations.

**Notes:** Per-section Unicode-range detection for fallback — >50% CJK → ÷3, otherwise ÷4. TokenBudget.allocateBudget() computes section-level caps; ContextOptimizer enforces them.

---

## PromptCacheManager Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Orchestrator: health + hint coordination | Manager tracks health, Adapter does transforms, Provider reports strategy | ✓ |
| Thin wrapper | Manager just forwards to Adapter | |
| Monolithic | Single module absorbs everything | |

**User's choice:** Three-layer: PromptCacheManager (policy + health), PromptCacheAdapter (per-provider transform per Appendix K), ProviderAdapter (strategy ID + response metadata).

**Notes:** PromptCacheManager in src/core/context/, runs as final stage of ContextOptimizer.optimize(). Module-level singleton with per-provider health (missStreak, lastHit, disabledUntil). ContextOptimizer sets stable flag on sections; Manager reads it as read-only. Cache hit/miss via post-response CacheResponseMetadata. recordResponse() called by AgentOrchestrator/Planner/Renderer after each request.

---

## Context Provenance Granularity & Source IDs

| Option | Description | Selected |
|--------|-------------|----------|
| Source-level per distinct source | One entry per data source, even if same kind | ✓ |
| Kind-level merged | One entry per kind, merged sourceId | |
| Two-level grouped | Kind groups with source children | |

**User's choice:** Source-level provenance — one entry per distinct data source. Diagnostics groups by kind at presentation time but manifest is lossless.

**Notes:** sourceId uses dot-separated hierarchical format: `<domain>.<source>.<entity>[.<id>]`. Examples: `persona.injector.default`, `core.instructions.system`, `tools.builtin.search`, `memory.user.fact.abc123`. Logical content origins, not file paths.

---

## the agent's Discretion

None — all 6 gray areas had explicit decisions from the user.

## Deferred Ideas

None — discussion stayed within phase scope.
