# Phase 4: Context-Adaptive Execution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 04-context-adaptive-execution
**Areas discussed:** Orchestrator Integration, ContextCompressor Strategy, Token Counting, ContextOptimizer Lifecycle, Context Source Priority, Provenance Granularity, Caching, Degradation Notification, Tool Schema Selection, Section Ordering, Planner vs Renderer Context

---

## Orchestrator Integration

| Option | Description | Selected |
|--------|-------------|----------|
| New wrapper method | Add `runWithContext(optimizedContext)` as canonical path, keep old `run()` for migration | ✓ |
| Replace `run()` signature | Replace current params with OptimizedContext entirely | |
| Pre-processing hook | ContextOptimizer runs before orchestrator, merges sections into systemPrompt | |

**User's choice:** New wrapper method. Add `AgentOrchestrator.runWithContext(optimizedContext)` as the new canonical path, while keeping the old `run()` temporarily for migration. ContextOptimizer should produce OptimizedContext, and the orchestrator should distribute its sections to Planner and Renderer. Avoid merging optimized sections into systemPrompt, because that loses provenance and weakens the ContextOptimizer contract.

---

## ContextCompressor Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Tier-dependent hybrid | LLM-based for medium/large, heuristic for tiny/small | ✓ |
| LLM-based always | Separate AI call for all summarization | |
| Heuristic-only | Regex/truncation only, no AI calls | |

**User's choice:** Tier-dependent hybrid. Use LLM-based compression for conversation history when running medium or large context tiers, where the token budget can justify an inexpensive summarization call. For small and tiny tiers, use heuristic compression only. For page/case context, prefer heuristic and structural extraction across all tiers because the data is already structured and gains little from LLM summarization. This preserves context quality while keeping the runtime cost-effective and predictable.

---

## Token Counting

| Option | Description | Selected |
|--------|-------------|----------|
| Char-based estimation | ceil(len/4) Latin, ceil(len/3) CJK, 10% safety margin | ✓ |
| tiktoken library | Accurate but adds ~3MB bundle | |
| Provider-native only | No fallback, skip if unavailable | |

**User's choice:** Use provider-native token counts whenever available. Otherwise, fall back to a lightweight shared estimator (ceil(length/4) for Latin text, ceil(length/3) for CJK), then apply a 10% safety margin before budget enforcement. This keeps ContextOptimizer provider-agnostic, avoids heavy tokenizer dependencies, and is sufficiently accurate for degradation and budget allocation decisions.

---

## ContextOptimizer Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Class + singleton | Following existing APIKeyRegistry/ToolRegistry pattern | ✓ |
| Module with pure functions | No state, no class, dependencies as params | |

**User's choice:** Class + singleton. Implement ContextOptimizer as a service class with an exported singleton, following the existing registry/service pattern. The constructor should accept dependencies such as TokenEstimator, ContextCompressor, and provider/model metadata lookup. The optimizer should expose a single `.optimize(input): Promise<OptimizedContext>` method. Keep the optimizer mostly stateless in Phase 4, but this structure leaves room for future in-memory caching and dependency injection.

---

## Context Source Priority

| Option | Description | Selected |
|--------|-------------|----------|
| User-driven priority | SP → User → Tools → Workspace → History → Memory → Page → Notes → Debug | ✓ |
| Flat degradation only | Follow only the 8-step pipeline order | |
| Memory-first priority | SP → Memory → User → Tools → History → Context | |

**User's choice:** User-driven priority with a refinement. Context priority should be: System Prompt → User Message → Active Tool Results → Workspace Context → Recent Conversation History → Relevant Memory → Page/Case Context → Notes/Metadata → Debug Data. The degradation pipeline still controls when categories are reduced, but this priority order determines what is retained longest when token budgets become constrained. This keeps current user intent and execution context ahead of historical or background information.

---

## Provenance Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Section-level outcome | Kind, sourceId, tokens, truncated, compression | |
| Full with dropped sections | Retained + dropped, outcome + reason, original + final tokens | ✓ |
| Minimal: presence only | Included sections + token counts only | |

**User's choice:** Record both retained and dropped sections, along with their original token count, final token count, outcome (kept, truncated, compressed, dropped), compression method, and reason (budget, minimal_mode, degradation_step). This provides enough information for PromptInspector, diagnostics, and future explainability features without the overhead of storing a full transformation history.

---

## Caching

| Option | Description | Selected |
|--------|-------------|----------|
| No cache in Phase 4 | Regenerate fresh per call | ✓ |
| Cache stable sections | Cache tier + priority, recompute dynamic sections | |
| Full cache with invalidation | Cache per operationId, many invalidation triggers | |

**User's choice:** Regenerate OptimizedContext for every AI call in Phase 4. The optimization pipeline is mostly lightweight (token estimation, budgeting, prioritization, degradation, provenance generation), while the expensive parts depend on rapidly changing conversation state. Adding cache invalidation logic would create more complexity than benefit. If performance issues appear later, cache expensive intermediate artifacts such as conversation summaries or compressed history rather than caching the entire OptimizedContext.

---

## Degradation Notification

| Option | Description | Selected |
|--------|-------------|----------|
| Provenance manifest only | No explicit notification, orchestrator reads manifest | |
| Degradation events in stream | ContextOptimizer emits into orchestrator stream | |
| Provenance + orchestrator warns | Orchestrator checks provenance, emits events | ✓ |

**User's choice:** Provenance + orchestrator emits warning. ContextOptimizer should remain output-only and record all degradation decisions in the ContextProvenanceManifest. After optimization, AgentOrchestrator inspects the provenance and decides whether to emit a degradation-warning event. Minor degradations (debug removal, note trimming) remain silent, significant degradations (history/page/memory compression) generate informational warnings, minimal mode generates a warning-level event, and Step 8 continues to raise CONTEXT_TOO_LARGE. This keeps responsibilities clean while giving the UI and telemetry systems a simple, consistent signal.

---

## Tool Schema Selection in Minimal Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Caller-supplied via input | Orchestrator provides prioritized list, ContextOptimizer uses first | ✓ |
| ContextOptimizer queries ToolRegistry | Internal ToolRegistry dependency for tool selection | |
| Most recently used tool | Track and reuse last-used tool | |

**User's choice:** Caller-supplied via input. Tool selection should happen before ContextOptimizer runs. The caller (typically AgentOrchestrator or Planner) provides an already-prioritized selectedToolSchemas list in ContextOptimizerInput. If Minimal Mode activates, ContextOptimizer simply keeps the first tool schema and drops the rest. This avoids introducing a ToolRegistry dependency and keeps ContextOptimizer focused on context budgeting and degradation rather than execution-planning decisions.

---

## Section Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed canonical order | System → Task → Workspace → Memory → Tools → Page → History → User | ✓ |
| Provider-adaptive order | Different order per provider (Anthropic, OpenAI, Gemini) | |
| ContextOptimizer returns text | ContextOptimizer assembles final prompt string | |

**User's choice:** Fixed canonical order. Assemble prompt sections in the order: System Prompt → Task Instructions → Workspace Context → Memory → Tool Schemas → Page/Case Context → Conversation History → User Input. Use the same ordering for all providers and tiers. Keep provider-specific behavior in provider adapters, and keep prompt assembly separate from ContextOptimizer so the optimizer remains focused on budgeting, degradation, and provenance rather than prompt formatting.

---

## Planner vs Renderer Context

| Option | Description | Selected |
|--------|-------------|----------|
| Shared context + stage filtering | One OptimizedContext, orchestrator filters per stage | ✓ |
| Two separate optimize() calls | optimizeForPlanner() and optimizeForRenderer() | |
| Context at orchestrator level only | Full context to both, stages use what they need | |

**User's choice:** Shared context + stage filtering. ContextOptimizer should produce one OptimizedContext per operation with a single provenance manifest. AgentOrchestrator then filters sections per stage: Planner receives instructions, tool schemas, workspace/page context, history, and user input; Renderer receives instructions, user input, history, tool results, memory, and relevant context; Executor remains deterministic and receives only validated tool execution inputs. This avoids duplicate optimization while still giving each stage the context it actually needs.

---

## Deferred Ideas

- OptimizedContext caching — revisit if profiling shows hot spots
- Per-stage separate optimization — revisit if Planner/Renderer needs diverge
- Provider-adaptive section ordering — revisit if measurable quality improvement
