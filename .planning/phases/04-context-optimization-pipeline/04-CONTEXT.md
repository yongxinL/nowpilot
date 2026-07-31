# Phase 4: Context Optimization Pipeline - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the Context Optimization Pipeline — `ModelContextTier`, `TokenBudget`, `ContextOptimizer`, `ContextCompressor`, `ContextPack`, `ContextProvenanceManifest`, `PromptCacheManager`, and `PromptCacheAdapter`. These hook into the Phase 3 AgentOrchestrator pipeline to provide dynamic token budgeting across four context tiers (tiny/small/medium/large), stepwise degradation that never fails on overflow, minimal mode enforcement for tiny models, and per-provider prompt cache hint transformation.

This is a core infrastructure phase — no UI surface changes. The new modules live in `src/core/context/` (context optimization) and extend `src/core/ai/` (AgentOrchestrator, ProviderAdapter, PlannerService, RendererService). The pipeline transforms `AgentTurnInput` (formerly `PlannerContext`) through `ContextAssembler` → `ContextOptimizerInput` → `ContextOptimizer` → `OptimizedContext`, which PlannerService and RendererService consume directly. Missing future-phase data sources (MemoryEngine from Phase 5, PageContentService from Phase 4a) are handled via optional fields with graceful no-ops.
</domain>

<decisions>
## Implementation Decisions

### Pipeline Integration Architecture
- **D-01:** ContextOptimizer is a first-class pipeline stage that owns context assembly, token budgeting, compression, degradation, provenance tracking, and prompt-cache preparation. AgentOrchestrator invokes ContextOptimizer internally before the Planner loop and operates on `OptimizedContext` throughout the turn, while exposing `runTurn(rawInput)` as the clean public API — **Reversibility:** costly — every future AI call path (chat, agent, research, add-ons) routes through the orchestrator; changing the internal optimization boundary would require touching all of them.
- **D-02:** ContextOptimizer runs once per turn before the agent loop. The resulting `OptimizedContext` is reused by `RendererService.synthesize()` and `RendererService.stream()` — no re-optimization for streaming — **Reversibility:** costly — re-optimizing mid-turn would break provenance consistency and add latency to every streaming response the Renderer owns.
- **D-03:** `AgentTurnInput` replaces `PlannerContext` as the raw conversational input type. Phase 3 extension interfaces for future sources are removed. Data flow: `AgentTurnInput` → `ContextAssembler` → `ContextOptimizerInput` → `ContextOptimizer` → `OptimizedContext` → `PlannerService` / `RendererService` — **Reversibility:** one-way — renaming the primary pipeline input type touches every call site and every downstream service that consumed `PlannerContext`; Phase 3's `PlannerContext` extension interfaces become dead code once removed.
- **D-04:** `PlannerService.plan()` and `RendererService.synthesize()` / `RendererService.stream()` all accept `OptimizedContext` directly. `ExecutorService` stays focused on tool requests/results and does not consume `OptimizedContext` — **Reversibility:** costly — changing which services consume the optimized context affects the entire pipeline contract established in Phase 3.
- **D-05:** `ContextOptimizerInput` defines `pageContext`, `memoryHints`, and `preferences` as optional fields. A `ContextAssembler` gathers whatever sources currently exist and produces the input. `ContextOptimizer` operates only on provided data and silently skips undefined sections. No stub services or dead code — each future phase wires its data source into the assembler — **Reversibility:** reversible — adding a new required field later would make it non-optional; adding more optional fields is zero-cost.

### ContextCompressor
- **D-06:** Hybrid compression strategy: deterministic local techniques first (recency retention, truncation, duplicate removal, extractive compression). AI summarization via `ProviderRouter.getCompressionModel()` only when context remains above budget after all local degradation steps — **Reversibility:** reversible — adding or removing local techniques is local to ContextCompressor; the AI overflow path is an independent code path.
- **D-07:** Degradation steps follow the spec's sequence (§2.4) strictly — drop debug → drop secondary → summarise history → compress page → trim tools → reduce memory → minimal mode. After each step, check remaining budget; stop when under budget. `ContextProvenanceManifest` records exactly which steps ran — **Reversibility:** one-way — changing the degradation order changes what Provenance manifests report, which would break any diagnostics or auditing that depends on the step sequence.
- **D-08:** AI summarization overflow uses the cheapest available summarisation-capable model via `ProviderRouter.getCompressionModel()`. Independent of the user's conversation tier. Compression is infrastructure, not part of answer quality — **Reversibility:** reversible — the model selection policy for compression is a single function call; changing it doesn't affect the compression logic.

### Token Counting & Budgeting
- **D-09:** `TokenBudget` is a standalone service in `src/core/context/`. `ProviderAdapter` gains an optional `countTokens()` method for provider-native counting when the SDK exposes it. `TokenBudget` orchestrates: invoke native counter when available, fall back to character-based heuristics, compute section-level allocations — **Reversibility:** costly — adding `countTokens()` to the `ProviderAdapter` interface requires implementing it in all four provider adapters and affects every call site that needs token estimates.
- **D-10:** Character-based fallback uses per-section Unicode-range detection: >50% CJK characters → `Math.ceil(text.length / 3)`, otherwise → `Math.ceil(text.length / 4)`. No dependency on user preferences — **Reversibility:** reversible — the estimation formula is a pure function; changing the ratio or detection threshold is a local change.
- **D-11:** `TokenBudget.allocateBudget(tier, inputBudget)` returns concrete per-kind token caps based on the tier allocation table (§2.2). `ContextOptimizer` enforces these caps during section assembly, compression, and degradation — **Reversibility:** reversible — the allocation table can be adjusted without changing the enforcement logic.

### PromptCacheManager & PromptCacheAdapter
- **D-12:** Three-layer cache architecture: `PromptCacheManager` (policy + health: hit/miss tracking, auto-disable after 5 consecutive misses, cooldown enforcement, eligibility decisions), `PromptCacheAdapter` (pure per-provider transformation per Appendix K), `ProviderAdapter` (strategy identification via `getCacheStrategy()` + response metadata extraction) — **Reversibility:** costly — the three-layer split defines clear contracts between cache policy, transformation, and provider abstraction; merging layers would break testability and cross-provider consistency.
- **D-13:** `PromptCacheManager` lives in `src/core/context/` and executes as the final stage of `ContextOptimizer.optimize()`. Cache decisions are recorded in `OptimizedContext` metadata. The Manager is a module-level singleton with per-provider health state (`missStreak`, `lastHit`, `disabledUntil`) shared across all surfaces — **Reversibility:** one-way — the singleton's per-provider health state becomes the runtime contract for cache behavior; changing it to per-surface isolation would require migrating accumulated health records.
- **D-14:** `ContextOptimizer` sets the `stable` flag on `PromptSection` during assembly based on section provenance (system prompts are stable; user input, history, memory, page context are not). `PromptCacheManager` reads `stable` as read-only metadata. Runtime cache state (disabled, cooling down) is tracked separately, never by modifying section stability — **Reversibility:** reversible — stability classification rules can be updated without changing the cache application logic.
- **D-15:** Cache hit/miss signals arrive via post-response metadata. `ProviderAdapter`/`ProviderRouter` normalizes provider-specific cache usage into `CacheResponseMetadata`. `AgentOrchestrator`, `PlannerService`, or `RendererService` calls `PromptCacheManager.recordResponse(metadata)` after the request completes — **Reversibility:** costly — adding a new metadata field requires updating every provider adapter's response normalization; removing a field would leave stale data in cache health records.
- **D-16:** `PromptCacheAdapter.applyCacheHints()` from Appendix K is the canonical implementation — only stable sections are eligible; Anthropic max 4 breakpoints; Gemini min 32,768 cached tokens threshold; OpenAI/Ollama uses stable-first ordering. `cacheKeyHash` uses FNV-1a hash of stable sections joined by `\0` — **Reversibility:** one-way — changing the hash algorithm would invalidate all cache keys and break cache-hit detection for cross-turn comparisons.

### Context Provenance
- **D-17:** Source-level provenance: one `ContextProvenanceManifest` entry per distinct data source, even when multiple sources share the same `kind`. Diagnostics can group by `kind` at presentation time but the manifest is lossless — **Reversibility:** costly — merging entries later would lose source-level traceability; splitting merged entries requires reconstructing original boundaries.
- **D-18:** `sourceId` format: dot-separated hierarchical `<domain>.<source>.<entity>[.<id>]`. Examples: `persona.injector.default`, `core.instructions.system`, `tools.builtin.search`, `memory.user.fact.abc123`, `context.page.current-url`. Logical content origins, not file paths — **Reversibility:** one-way — sourceId strings appear in every ProvenanceManifest stored in diagnostics logs; changing the naming convention would orphan historical provenance records.

### the agent's Discretion
No areas were deferred to the agent — all 6 gray areas had explicit decisions from the user.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Specification
- `.planning/PRODUCT_SPEC_v0_1.md` §2.1 — ModelContextTier: tiny/small/medium/large classification with context window thresholds
- `.planning/PRODUCT_SPEC_v0_1.md` §2.2 — Token budget formula (70/20/10 split) and per-tier section allocation percentages
- `.planning/PRODUCT_SPEC_v0_1.md` §2.3 — ContextOptimizer contract: ContextOptimizerInput, OptimizedContext, PromptSection
- `.planning/PRODUCT_SPEC_v0_1.md` §2.4 — Degradation pipeline: ordered steps, budget checking, CONTEXT_TOO_LARGE error
- `.planning/PRODUCT_SPEC_v0_1.md` §2.5 — Minimal mode: allowed operations and blocked capabilities for tiny models
- `.planning/PRODUCT_SPEC_v0_1.md` §2.6 — ContextProvenanceManifest: section-level provenance with kind, sourceId, tokens, truncated, compressionApplied
- `.planning/PRODUCT_SPEC_v0_1.md` §1.2 — Pipeline flowchart showing MemoryEngine → ContextOptimizer → AgentOrchestrator
- `.planning/PRODUCT_SPEC_v0_1.md` §0.4 — Canonical runtime concepts and file locations
- `.planning/PRODUCT_SPEC_v0_1.md` §19.13 — Prompt cache miss cascade: disable after 5 consecutive misses for 60s
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix K — PromptCacheAdapter per-provider cache hint transformation (full implementation reference)
- `.planning/PRODUCT_SPEC_v0_1.md` Phase 4 file list — files to create: 6 source + 3 test files

### Project & Roadmap
- `.planning/PROJECT.md` — Constraints (cost-effective runtime, MV3 rules, NOT @ant-design/x-sdk), Key Decisions
- `.planning/ROADMAP.md` Phase 4 — Goal, success criteria (5 items), depends on Phase 3
- `.planning/REQUIREMENTS.md` — CTX-01 (dynamic token budgets, degradation, minimal mode), CTX-02 (per-provider cache hint transformation)

### Prior Phase Context
- `.planning/phases/03-ai-core-pipeline/03-CONTEXT.md` — D-02 (ProviderAdapter with getCacheStrategy()), D-12 (PlannerContext extension interfaces — now replaced by AgentTurnInput), integration points (AgentOrchestrator, PlannerService, RendererService, ProviderRouter)
- `.planning/phases/02-storage-security-foundation/02-CONTEXT.md` — D-01 (singleton services pattern), D-04 (domain-specific module isolation)

### Existing Code — Phase 3 Pipeline
- `src/core/ai/AgentOrchestrator.ts` — runTurn() entry point; will invoke ContextOptimizer internally and operate on OptimizedContext
- `src/core/ai/PlannerService.ts` — plan() currently accepts PlannerContext; will accept OptimizedContext
- `src/core/ai/RendererService.ts` — synthesize() and stream(); both will accept OptimizedContext
- `src/core/ai/types.ts` — PlannerContext (to become AgentTurnInput), PipelineProviderId, ModelTier, PlannerDecision, TIER_CAPS
- `src/core/ai/providers/ProviderAdapter.ts` — getCacheStrategy(), supportsStructuredOutput, getDefaultModelForTier(); gains optional countTokens()
- `src/core/ai/ProviderRouter.ts` — selectProvider(); gains getCompressionModel() for ContextCompressor overflow
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **AgentOrchestrator** (`src/core/ai/AgentOrchestrator.ts`): Singleton orchestrator with planner loop. ContextOptimizer calls will be added at the top of runTurn(). PlannerService and RendererService already wired in.
- **ProviderAdapter** (`src/core/ai/providers/ProviderAdapter.ts`): Lightweight interface with `getCacheStrategy()` already returning strategy strings. Gains optional `countTokens()` and response metadata extraction.
- **ProviderRouter** (`src/core/ai/ProviderRouter.ts`): Provider selection with fallback/circuit-breaker. Gains `getCompressionModel()` for infrastructure summarization calls.
- **PlannerService / RendererService** (`src/core/ai/`): Existing services that will accept OptimizedContext. Both are singletons, tested, and follow the Phase 3 pipeline contract.
- **TierResolver** (`src/core/ai/TierResolver.ts`): Maps ModelTier (FAST/BALANCED/ADVANCED) to tier caps. Phase 4 adds ModelContextTier (tiny/small/medium/large) — a separate concept for context window classification.

### Established Patterns
- **Module-level singletons**: AgentOrchestrator, ProviderRouter, PlannerService are module-level singletons. ContextOptimizer, PromptCacheManager, and TokenBudget follow this same pattern.
- **Core module isolation**: `src/core/` modules do not import from `src/components/`. All new `src/core/context/` modules follow this boundary.
- **Zod validation**: Phase 3 uses Zod for PlannerDecisionSchema. ContextOptimizerInput and OptimizedContext should follow this pattern.
- **Structured error codes**: Phase 3's `PipelineError` uses standardized codes. Phase 4 adds `CONTEXT_TOO_LARGE` as a typed error.

### Integration Points
- **AgentOrchestrator.runTurn()** — Primary integration point. ContextOptimizer runs here before the planner loop.
- **PlannerService.plan()** — Input type changes from PlannerContext to OptimizedContext.
- **RendererService.synthesize() / stream()** — Both accept OptimizedContext; use provenance for citations, tier for output caps.
- **ProviderAdapter / ProviderRouter** — Gains countTokens() (optional), getCompressionModel(), and CacheResponseMetadata extraction.
- **Future consumers**: Phase 5 MemoryEngine feeds into ContextAssembler as `memoryHints` source. Phase 4a PageContentService feeds as `pageContext` source. Phase 6 AITransactionLog consumes ContextProvenanceManifest and cache telemetry.
</code_context>

<specifics>
## Specific Ideas

- Optimization runs once per turn — no re-optimization for streaming or tool-call retries within the same planner loop.
- The degradation order is product policy, not an optimization heuristic. It must follow the spec sequence exactly for predictable, auditable behavior.
- All missing data sources (pageContext, memoryHints, preferences) are handled as optional fields with graceful no-ops. No stubs or placeholder services.
- ContextCompressor's AI overflow is infrastructure: it uses the cheapest model, not the user's tier. `ProviderRouter.getCompressionModel()` is the dedicated path.
- `PlannerContext` is renamed to `AgentTurnInput` — a naming change that reflects the type's new role as raw conversational input, not the planning model.
- `PromptCacheManager` in `src/core/context/` (not `src/core/ai/`) because cache preparation is a context-optimization concern. The spec's file list places `PromptCacheAdapter` in `src/core/ai/` for its provider-specific transformation logic.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No scope creep was raised.
</deferred>

---

*Phase: 4-Context Optimization Pipeline*
*Context gathered: 2026-07-31*
