# Phase 4: Context-Adaptive Execution - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the ContextOptimizer — wrapping every AI call with tier-aware token budgets derived from the model's actual context window, dynamic section distribution across system/tools/memory/context/history/user, an 8-step degradation pipeline that drops debug data first and escalates to minimal mode, and a ContextProvenanceManifest on every OptimizedContext. Requirements: CTXT-01 through CTXT-07.

The ContextOptimizer sits between context assembly (from stores, workspace, and memory) and the AgentOrchestrator pipeline. It is the gatekeeper — all AI calls must consume an OptimizedContext.
</domain>

<decisions>
## Implementation Decisions

- **D-01 — Orchestrator Integration:** Add `AgentOrchestrator.runWithContext(optimizedContext: OptimizedContext)` as the canonical execution path. Internally extracts tier from context tier, distributes sections to Planner and Renderer.
- Keep existing `run()` temporarily for migration. All new call sites use `runWithContext()`.
- Sections are distributed to pipeline stages, never merged into a single systemPrompt string — that loses provenance and weakens the ContextOptimizer contract.

- **D-02 — Stage-Level Section Distribution:** Planner receives: instructions, tool schemas, workspace/page context, history, and user input.
- Renderer receives: instructions, user input, history, tool results, memory, and relevant context.
- Executor remains deterministic — receives only validated tool execution inputs. No context sections.

- **D-03 — ContextCompressor Strategy — Tier-Dependent Hybrid:** **Conversation history:** LLM-based summarization (Haiku/Flash call) for medium/large tiers where the token budget justifies the cost. Heuristic compression (character-based truncation) for tiny/small tiers.
- **Page/case context:** Heuristic and structural extraction across ALL tiers. This data is already structured — gains little from LLM summarization and avoids introducing latency on the critical path.

- **D-04 — ContextCompressor as Injectable Dependency:** ContextCompressor is a standalone module injected into ContextOptimizer's constructor. Exposes `compressHistory()` and `compressContext()` methods.
- LLM-based compression uses a separate cheap AI call — cost is accounted for in the degradation decision (only invoked when budget allows).

- **D-05 — Token Counting — Provider-Native with Lightweight Fallback:** Prefer provider-native token counts when available from the AI SDK.
- Fallback: `Math.ceil(text.length / 4)` for Latin/ASCII text, `Math.ceil(text.length / 3)` for CJK text.
- Apply a 10% safety margin before budget enforcement to absorb estimation error.
- No tiktoken or heavy tokenizer dependency.

- **D-06 — TokenEstimator as Standalone Module:** `src/core/context/TokenEstimator.ts` — injected into ContextOptimizer. Exposes `estimateTokens(text: string): number`.
- Hosts the provider-native detection and char-based fallback logic. Separable for independent testing.

- **D-07 — ContextOptimizer Lifecycle — Class + Singleton:** Follows the existing class+singleton pattern (KeymapRegistry, ToolRegistry, ProviderRegistry).
- Constructor accepts: `TokenEstimator`, `ContextCompressor`, and a provider/model metadata lookup (reads `ModelEntry.contextWindow` from ProviderRegistry or providerStore).
- Exposes single method: `.optimize(input: ContextOptimizerInput): Promise<OptimizedContext>`.
- Exported as `contextOptimizer` singleton.
- Mostly stateless in Phase 4 — class structure leaves room for future in-memory caching.

- **D-08 — ModelContextTier Classification:** `classifyModelContext(contextWindow: number): ModelContextTier` per PRODUCT_SPEC §2.1:
  - ≤4,096 → `tiny`
  - ≤16,384 → `small`
  - ≤131,072 → `medium`
  - >131,072 → `large`
- ContextOptimizer reads `ModelEntry.contextWindow` from the active provider/model at optimization time. Not cached per Phase 4 (D-12).

- **D-09 — Context Source Priority:** When token budgets constrain assembly, sections are retained in this priority order:
1. System Prompt
2. User Message
3. Active Tool Results
4. Workspace Context
5. Recent Conversation History
6. Relevant Memory
7. Page/Case Context
8. Notes/Metadata
9. Debug Data

The degradation pipeline still controls which categories are reduced at each step. This priority determines retention *within* constrained categories.

- **D-10 — ContextProvenanceManifest Granularity:** Record both **retained and dropped** sections in the manifest. Dropped sections are included with `outcome: 'dropped'`.
- Each section entry: `kind`, `sourceId`, `originalTokens`, `finalTokens` (0 if dropped), `outcome` (kept | truncated | compressed | dropped), `compressionMethod` (summarise | structural | topk | null), `reason` (budget | minimal_mode | degradation_step_N).
- No full transformation history trail — just the final outcome. Sufficient for PromptInspector and diagnostics.

- **D-11 — Degradation Notification Contract:** ContextOptimizer is output-only — records all degradation decisions in the provenance manifest.
- AgentOrchestrator inspects `optimizedContext.provenance` after `.optimize()` and emits degradation events:
  - Minor degradation (debug removal, note trimming) → **silent** (no event).
  - Significant degradation (history/page/memory compression) → **info-level** degradation event in orchestrator stream.
  - Minimal mode activation → **warning-level** event.
  - Step 8 (CONTEXT_TOO_LARGE) → **typed error**, no degraded context returned.
- Keeps responsibilities clean — ContextOptimizer optimizes, orchestrator decides what to surface.

- **D-12 — No Caching in Phase 4:** Regenerate OptimizedContext fresh for every AI call. Optimization is lightweight (classification + arithmetic + degradation decisions). Caching invalidation complexity exceeds benefit.
- If performance profiling later shows hot spots, cache expensive intermediate artifacts (conversation summaries, compressed history) — not the full OptimizedContext.

- **D-13 — Tool Schema Selection in Minimal Mode:** Caller-supplied via `ContextOptimizerInput.selectedToolSchemas` — the caller (orchestrator/planner) provides an already-prioritized list before calling `.optimize()`.
- In minimal mode, ContextOptimizer keeps only the first tool schema and drops the rest.
- No ToolRegistry dependency in ContextOptimizer — keeps it focused on budgeting and degradation.

- **D-14 — Fixed Canonical Section Ordering:** Prompt sections are assembled in fixed order for all providers and tiers:
1. System Prompt
2. Task Instructions
3. Workspace Context
4. Memory
5. Tool Schemas
6. Page/Case Context
7. Conversation History
8. User Input

ContextOptimizer produces sections; prompt assembly (converting sections to provider-specific message format) is a separate concern handled by adapters or the orchestrator.

- **D-15 — Single OptimizedContext Per Operation:** ContextOptimizer produces one `OptimizedContext` with a single `ContextProvenanceManifest` per operation.
- AgentOrchestrator filters sections per stage (D-02). No separate optimization passes for Planner vs Renderer.
- Avoids duplicate work and ensures provenance consistency across the full pipeline.

### the agent's Discretion
- Exact shape of TokenEstimator interface — researcher/planner to determine the cleanest approach consistent with existing class+singleton or pure-function patterns.
- ContextCompressor internal implementation — how heuristic extraction extracts structured fields from page/case context.
- LLM-based history summarization prompt — planner to design a cost-effective summarization prompt for Haiku/Flash tier.
- Degradation event format in the orchestrator event stream — planner to add degradation-warning events to OrchestratorEvent union type.
- Exact integration of runWithContext with the existing AbortManager/timeout infrastructure.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Scope
- `.planning/REQUIREMENTS.md` — CTXT-01 through CTXT-07 (lines 80–86). Full requirement traceability for all 7 Phase 4 requirements.
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria (5 items), dependency on Phase 3 (lines 170–183).

### Product Specification
- `.planning/PRODUCT_SPEC_v0_1.md` §2 — Full Context-Adaptive Execution specification:
  - §2.1 (lines 306–325): ModelContextTier classification
  - §2.2 (lines 326–343): Token budget formula and dynamic distribution table
  - §2.3 (lines 345–372): ContextOptimizer contract — input/output interfaces
  - §2.4 (lines 374–384): 8-step degradation pipeline
  - §2.5 (lines 386–403): Minimal mode rules (allowed/blocked)
  - §2.6 (lines 405–423): ContextProvenanceManifest interface
- `.planning/PRODUCT_SPEC_v0_1.md` §4.3 (lines 583–607): PromptTrace interface with tier/degradation/cache fields
- `.planning/PRODUCT_SPEC_v0_1.md` (lines 3389–3397): PromptSection type definition

### Project Context
- `.planning/PROJECT.md` — Core constraints: MV3 restrictions, `@ai-sdk/*` only, package hygiene, two-surface architecture.
- `.planning/STATE.md` — Session continuity, Phase 3 decisions carried forward (pipeline architecture, tier caps).

### Prior Phase Decisions
- `.planning/phases/03-cost-effective-ai-runtime/03-CONTEXT.md` — Phase 3 pipeline architecture: AgentOrchestrator.run() signature, CostTierType, Planner/Renderer separation, ProviderRouter, tier caps. Critical for understanding where ContextOptimizer integrates.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **AgentOrchestrator** (`src/core/ai/pipeline/AgentOrchestrator.ts`): Current `run(tier, preferredProviders, userMessage, systemPrompt)` signature at line 62. Phase 4 adds `runWithContext(optimizedContext)`. Existing AbortManager integration, tier caps, and Planner→Executor→Renderer loop stay intact.
- **ProviderRegistry** (`src/core/ai/providers/ProviderRegistry.ts`): `ModelEntry.contextWindow` (line 24 of providerTypes.ts) provides the context window for tier classification. `getModelsForTier()` for cost-tier lookups.
- **Pipeline types** (`src/core/ai/pipeline/pipelineTypes.ts`): `OrchestratorEvent` union type (line 20) — Phase 4 extends with degradation-warning events.
- **AI Config** (`src/core/ai/config/aiConfig.ts`): `TIER_CAP` and `AI_CONFIG` constants — ContextOptimizer reads these for budget enforcement.
- **PlannerService** (`src/core/ai/pipeline/PlannerService.ts`): Takes `systemPrompt` + `userMessage` separately (line 23-24). runWithContext distributes OptimizedContext sections into these params.
- **RenderService** (`src/core/ai/pipeline/RendererService.ts`): Flash-tier rendering with streaming. ContextOptimizer may influence which renderer model is used based on output budget.
- **providerStore** (`src/core/stores/providerStore.ts`): `modelEntries` and `tierAssignments` fields — ContextOptimizer reads active model's context window from here.
- **debugLog** (`src/core/utils/debugLog.ts`): All catch blocks must call debugLog (HARD-09).

### Established Patterns
- **Class + singleton export**: Registry classes (KeymapRegistry, ToolRegistry, ProviderRegistry) follow this pattern. ContextOptimizer matches.
- **Constructor dependency injection**: AgentOrchestrator already injects PlannerService, ExecutorService, RendererService, ProviderRouter (line 44-48). ContextOptimizer follows the same pattern with TokenEstimator, ContextCompressor, and provider lookup.
- **Direct path imports**: No barrel/index files. New context modules in `src/core/context/`.
- **Test patterns**: Vitest + jsdom, tests in `tests/core/context/`. Use `vi.hoisted()` for mock variables. Class+singleton tests with module-level `let` pattern (per Phase 2).

### Integration Points
- **AgentOrchestrator.run()** — The primary integration point. Current signature at `src/core/ai/pipeline/AgentOrchestrator.ts:62-66`. Phase 4 adds `runWithContext()` without breaking `run()`.
- **Model metadata** — `ModelEntry.contextWindow` at `src/core/ai/providers/providerTypes.ts:24`. ContextOptimizer reads this to classify tier and compute budgets. ProviderRegistry is the source of truth.
- **CostTierType vs ModelContextTier** — Separate concepts. `CostTierType` (haiku/flash/sonnet/opus) controls provider/model selection and tier caps. `ModelContextTier` (tiny/small/medium/large) controls token budgets and degradation. They coexist — ContextOptimizer uses both.
- **OrchestratorEvent stream** — `pipelineTypes.ts:20` defines the event union. Phase 4 adds `degradation-warning` events that the UI (Phase 7) surfaces.
</code_context>

<specifics>
## Specific Ideas

### ContextOptimizer Flow (conceptual)
```
ContextOptimizerInput
  → classifyModelContext(modelContextWindow) → tier
  → computeBudget(tier, modelContextWindow) → inputBudget, outputBudget
  → assessSections(input, priority order) → section list
  → if overflow: run degradation pipeline (steps 1-8)
  → if tier === 'tiny': enable minimalMode
  → assemble ProvenanceManifest
  → return OptimizedContext { tier, inputBudget, outputBudget, sections, provenance, minimalMode }
```

### Degradation Pipeline (from PRODUCT_SPEC §2.4)
1. Drop debug-only context
2. Drop secondary notes and optional metadata
3. Summarise older history (LLM for medium/large, heuristic for tiny/small)
4. Compress page/case context into structured fields (heuristic/structural always)
5. Trim tool schemas to tools currently in scope
6. Reduce memory injection top-k
7. Enter minimal mode
8. If still too large → `CONTEXT_TOO_LARGE` error

### Minimal Mode Rules (from PRODUCT_SPEC §2.5)
- Compact system prompt, compact preference profile, top 3 user memories, conversation summary ≤200 tokens, last 1-2 turns, at most one safe tool schema.
- Blocked: multi-step agent, MCP chaining, CodeSearchSkill, full note-graph injection, large research synthesis.

### File Layout (from PRODUCT_SPEC Appendix)
- `src/core/context/ModelContextTier.ts` — Tier classification function
- `src/core/context/TokenEstimator.ts` — Token counting (provider-native + fallback)
- `src/core/context/ContextCompressor.ts` — Structured text/page/case/history compression
- `src/core/context/ContextOptimizer.ts` — Tier classification → budget → section priority → degradation → assembly
- `src/core/context/ContextProvenanceManifest.ts` — Manifest types (retained + dropped sections)
- `tests/core/context/ContextOptimizer.test.ts` — Full optimization pipeline tests
- `tests/core/context/ContextCompressor.test.ts` — Compression strategy tests
</specifics>

<deferred>
## Deferred Ideas

- **OptimizedContext caching** — Revisit if profiling shows hot spots. Cache expensive intermediates (summaries, compressed history) rather than full contexts.
- **Per-stage separate optimization** — Revisit if Planner and Renderer have significantly diverging context needs that justify separate passes.
- **Provider-adaptive section ordering** — Revisit if specific providers show measurable quality improvement from reordered sections.

None beyond scope — all discussion stayed within phase boundaries.
</deferred>

---

*Phase: 4-Context-Adaptive Execution*
*Context gathered: 2026-07-13*
