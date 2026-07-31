# Phase 04: Context Optimization Pipeline — Research

**Researched:** 2026-07-31
**Domain:** Context optimization, token budgeting, prompt caching, degradation pipelines
**Confidence:** HIGH

## Summary

Phase 04 delivers the Context Optimization Pipeline — a core infrastructure layer that hooks into the Phase 3 AgentOrchestrator to transform raw conversational input (`AgentTurnInput`) through context assembly, token budgeting, compression, degradation, provenance tracking, and per-provider prompt cache hint transformation. The pipeline produces an `OptimizedContext` that PlannerService and RendererService consume directly, replacing the current `PlannerContext`.

The implementation spans 6 source files in `src/core/context/` and 3 source files modifying `src/core/ai/`. All new services follow the established module-level singleton pattern (AgentOrchestrator, ProviderRouter). The degradation pipeline is product policy — it follows a strict, auditable sequence that never fails: context degrades gracefully through 7 ordered steps before entering minimal mode. Token counting uses a dual approach: provider-native counting when the SDK exposes it (the AI SDK v7 `usage` object already provides `inputTokens`/`outputTokens`), with character-based heuristics as fallback. Prompt caching uses the three-layer architecture from D-12: PromptCacheManager (policy/health), PromptCacheAdapter (per-provider transform per Appendix K), and ProviderAdapter (strategy ID + metadata extraction).

**Primary recommendation:** Implement the spec-defined pipeline exactly as documented in PRODUCT_SPEC_v0_1.md §2.2–§2.6 and Appendix K. No hand-rolled alternatives needed — the AI SDK v7 already provides token usage data and cache control primitives. The key implementation challenge is correctly threading `OptimizedContext` through the existing PlannerService/RendererService interfaces without breaking the Phase 3 contract.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** ContextOptimizer is a first-class pipeline stage that owns context assembly, token budgeting, compression, degradation, provenance tracking, and prompt-cache preparation. AgentOrchestrator invokes ContextOptimizer internally before the Planner loop and operates on `OptimizedContext` throughout the turn.
- **D-02:** ContextOptimizer runs once per turn before the agent loop. The resulting `OptimizedContext` is reused by `RendererService.synthesize()` and `RendererService.stream()` — no re-optimization for streaming.
- **D-03:** `AgentTurnInput` replaces `PlannerContext` as the raw conversational input type. Phase 3 extension interfaces for future sources are removed.
- **D-04:** `PlannerService.plan()` and `RendererService.synthesize()` / `RendererService.stream()` all accept `OptimizedContext` directly. `ExecutorService` stays focused on tool requests/results and does not consume `OptimizedContext`.
- **D-05:** `ContextOptimizerInput` defines `pageContext`, `memoryHints`, and `preferences` as optional fields. ContextAssembler gathers whatever sources exist. No stub services or dead code.
- **D-06:** Hybrid compression strategy: deterministic local techniques first, AI summarization via `ProviderRouter.getCompressionModel()` only when context remains above budget after all local degradation steps.
- **D-07:** Degradation steps follow the spec's sequence (§2.4) strictly. `ContextProvenanceManifest` records exactly which steps ran.
- **D-08:** AI summarization overflow uses the cheapest available summarisation-capable model via `ProviderRouter.getCompressionModel()`. Independent of the user's conversation tier.
- **D-09:** `TokenBudget` is a standalone service in `src/core/context/`. `ProviderAdapter` gains an optional `countTokens()` method for provider-native counting.
- **D-10:** Character-based fallback uses per-section Unicode-range detection: >50% CJK characters → `Math.ceil(text.length / 3)`, otherwise → `Math.ceil(text.length / 4)`.
- **D-11:** `TokenBudget.allocateBudget(tier, inputBudget)` returns concrete per-kind token caps based on the tier allocation table (§2.2).
- **D-12:** Three-layer cache architecture: `PromptCacheManager` (policy + health), `PromptCacheAdapter` (per-provider transformation per Appendix K), `ProviderAdapter` (strategy identification + response metadata extraction).
- **D-13:** `PromptCacheManager` lives in `src/core/context/` and executes as the final stage of `ContextOptimizer.optimize()`. Module-level singleton with per-provider health state.
- **D-14:** `ContextOptimizer` sets the `stable` flag on `PromptSection` during assembly based on section provenance. `PromptCacheManager` reads `stable` as read-only metadata.
- **D-15:** Cache hit/miss signals arrive via post-response metadata. `AgentOrchestrator`, `PlannerService`, or `RendererService` calls `PromptCacheManager.recordResponse(metadata)` after the request completes.
- **D-16:** `PromptCacheAdapter.applyCacheHints()` from Appendix K is the canonical implementation. `cacheKeyHash` uses FNV-1a hash of stable sections joined by `\0`.
- **D-17:** Source-level provenance: one `ContextProvenanceManifest` entry per distinct data source. Diagnostics can group by `kind` at presentation time.
- **D-18:** `sourceId` format: dot-separated hierarchical `<domain>.<source>.<entity>[.<id>]`.

### the agent's Discretion

No areas were deferred to the agent — all implementation decisions were explicitly made by the user.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTX-01 | User's prompts are optimized with dynamic token budgets, degradation pipeline, and minimal mode for tiny models | PRODUCT_SPEC_v0_1.md §2.2 (Token Budget Formula), §2.4 (Degradation Pipeline), §2.5 (Minimal Mode). AI SDK v7 `usage.inputTokens` provides native token counting. js-tiktoken available as fallback for off-line estimation. |
| CTX-02 | User benefits from prompt caching with per-provider cache-hint transformation | PRODUCT_SPEC_v0_1.md Appendix K (full implementation). AI SDK v7 Anthropic provider supports `cacheControl` on messages via `providerOptions`. `usage.inputTokenDetails.cacheReadTokens` / `cacheWriteTokens` available for hit/miss tracking. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token counting / budgeting | API / Backend (core logic) | — | TokenBudget operates on text content — a pure computation concern with no I/O or persistence |
| Context assembly (ContextAssembler) | API / Backend (core logic) | — | Gathers in-memory data sources into ContextOptimizerInput; no persistence, no UI |
| Context optimization (ContextOptimizer) | API / Backend (core logic) | — | Pure pipeline stage operating on in-memory data; produces OptimizedContext consumed by PlannerService/RendererService |
| Context compression (ContextCompressor) | API / Backend (core logic) | — | Local techniques are pure transforms; AI summarization is a provider call (infrastructure concern) |
| Degradation pipeline | API / Backend (core logic) | — | Policy-driven stepwise reduction — no UI, no persistence. Provenance tracking is audit-only metadata |
| Prompt cache management (PromptCacheManager) | API / Backend (core logic) | — | Runtime policy decisions + health tracking. Per-provider state stored in memory only (singleton) |
| Prompt cache transformation (PromptCacheAdapter) | API / Backend (core logic) | — | Pure transform function — maps sections to provider-specific cache hints per Appendix K |
| Model context tier detection | API / Backend (core logic) | — | classifyModelContext() is a pure function based on contextWindow parameter |
| Provenance manifest (ContextProvenanceManifest) | API / Backend (core logic) | — | Metadata generated during optimization — consumed by diagnostics (Phase 6), not persisted independently |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | ^7.0.42 (already installed) | Provides `usage.inputTokens`/`outputTokens` for native token counting; `generateText` and `streamText` already used by PlannerService/RendererService | Already the project's AI interaction layer; Phase 3 already depends on it [VERIFIED: npm registry — already in package.json] |
| `@ai-sdk/anthropic` | ^4.0.24 (already installed) | Cache control via `providerOptions.anthropic.cacheControl`; already returns cache read/write tokens in usage | Already installed; cache control is native to the SDK [VERIFIED: npm registry — already in package.json] |
| `zod` | ^4.4.3 (already installed) | Schema validation for ContextOptimizerInput, OptimizedContext, PromptSection, ContextProvenanceManifest | Already the project's validation layer; Phase 3 uses Zod for PlannerDecisionSchema [VERIFIED: npm registry — already in package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `js-tiktoken` | 1.0.21 | Off-line token estimation for pre-assembly budget planning and fallback counting | When provider-native `countTokens()` is unavailable AND character heuristics are insufficient; for speculative budget estimates before a provider call [VERIFIED: npm registry, package legitimacy OK] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled token estimation | `js-tiktoken` | js-tiktoken adds ~200KB bundle size but provides accurate BPE token counts matching OpenAI/Anthropic tokenizers. Character heuristics (char/4) are zero-dependency but ~20-30% less accurate [ASSUMED] |
| Implementing cache hints manually per provider API | Appendix K (PromptCacheAdapter) already specified | The spec-provided implementation handles all four providers; no need to research provider-specific REST APIs separately |
| AI SDK v7 provider-specific `countTokens` | Character-based heuristics from D-10 | Provider SDKs don't expose a standalone `countTokens()` method in v4/provider packages — the `usage` object is only available post-request. Pre-request estimation must use heuristics or js-tiktoken [CITED: ai-sdk v7 docs — usage returned after generation, no standalone counter] |

**Installation:**
```bash
# Only js-tiktoken is new; all other deps already installed
npm install js-tiktoken
```

**Version verification:**
- `js-tiktoken`: 1.0.21 (published 2025-08-09) [VERIFIED: npm registry]
- `ai`: 7.0.43 (latest on registry; project has ^7.0.42) [VERIFIED: npm registry]
- `@ai-sdk/anthropic`: 4.0.25 (latest; project has ^4.0.24) [VERIFIED: npm registry]
- `zod`: already installed at ^4.4.3 [VERIFIED: npm registry]

## Package Legitimacy Audit

> Run per Package Legitimacy Gate protocol.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| js-tiktoken | npm | ~3 yrs (published Aug 2024) | 6.6M/wk | github.com/dqbd/tiktoken | OK | Approved |
| ai | npm | already installed | — | github.com/vercel/ai | OK | Already installed |
| @ai-sdk/anthropic | npm | already installed | — | github.com/vercel/ai | OK | Already installed |
| zod | npm | already installed | — | github.com/colinhacks/zod | OK | Already installed |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

All packages are either already installed (verified by Phase 3 integration tests) or have been verified via npm registry and package-legitimacy check. js-tiktoken has no postinstall script and passes all legitimacy signals.

## Architecture Patterns

### System Architecture Diagram

```
                        AgentTurnInput (raw)
                              │
                              ▼
                      ┌───────────────┐
                      │ContextAssembler│  ← gathers pageContext?, memoryHints?, preferences?
                      └───────┬───────┘
                              │
                              ▼
                      ContextOptimizerInput
                              │
                              ▼
              ┌───────────────────────────────┐
              │       ContextOptimizer        │
              │                               │
              │ 1. classifyModelContext()     │
              │ 2. TokenBudget.allocate()     │
              │ 3. Assemble PromptSection[]   │
              │ 4. Check budget               │──┐
              │    ├─ under budget → continue │  │
              │    └─ over budget → degrade   │  │
              │         │                     │  │
              │         ▼                     │  │
              │  ContextCompressor            │  │
              │  ┌─────────────────────────┐  │  │
              │  │ drop debug              │  │  │
              │  │ drop secondary          │  │  │
              │  │ summarise history       │  │  │
              │  │ compress page           │  │  │
              │  │ trim tools              │  │  │
              │  │ reduce memory           │  │  │
              │  │ minimal mode            │  │  │
              │  │ CONTEXT_TOO_LARGE       │  │  │
              │  └─────────────────────────┘  │  │
              │         │                     │◄─┘
              │         ▼                     │
              │ 5. ContextProvenanceManifest  │
              │ 6. PromptCacheManager         │
              └───────────────┬───────────────┘
                              │
                              ▼
                        OptimizedContext
                              │
                    ┌─────────┼─────────┐
                    ▼                   ▼
             PlannerService        RendererService
             .plan(ctx)            .synthesize(ctx)
                                   .stream(ctx)
```

**Data flow:** `AgentTurnInput` enters at the top → `ContextAssembler` → `ContextOptimizer.optimize()` (budget → assemble → check → degrade loop → provenance → cache) → `OptimizedContext` consumed by both Planner and Renderer. The degradation loop (steps 4a–4g) checks remaining budget after each step and stops when under budget. After all steps fail, `CONTEXT_TOO_LARGE` error is thrown.

### Recommended Project Structure
```
src/core/context/
├── ModelContextTier.ts          # classifyModelContext(), ModelContextTier type
├── TokenBudget.ts               # TokenBudget service: countTokens(), allocateBudget()
├── ContextOptimizer.ts          # ContextOptimizer service: optimize() entry point
├── ContextCompressor.ts         # ContextCompressor: degradation steps, AI summarization
├── ContextProvenanceManifest.ts # ContextProvenanceManifest type and builder
├── PromptCacheManager.ts        # PromptCacheManager singleton: health, recordResponse()
src/core/ai/
├── PromptCacheAdapter.ts        # PromptCacheAdapter: applyCacheHints() per Appendix K
├── AgentTurnInput.ts            # AgentTurnInput type (replaces PlannerContext)
├── (modified) AgentOrchestrator.ts  # Gains ContextOptimizer integration
├── (modified) PlannerService.ts     # Accepts OptimizedContext instead of PlannerContext
├── (modified) RendererService.ts    # Accepts OptimizedContext instead of PlannerContext
├── (modified) ProviderAdapter.ts    # Gains optional countTokens()
├── (modified) ProviderRouter.ts     # Gains getCompressionModel()
├── (modified) types.ts             # Adds CONTEXT_TOO_LARGE, removes PlannerContext
tests/core/context/
├── ContextOptimizer.test.ts
├── TokenBudget.test.ts
├── PromptCacheManager.test.ts
```

### Pattern 1: Module-Level Singleton Service

**What:** Each service is instantiated once at module scope and exported as a `const`. Consumers import the instance directly — no dependency injection container, no factory functions.

**When to use:** For all new Phase 4 services — ContextOptimizer, TokenBudget, ContextCompressor, PromptCacheManager.

**Example:**
```typescript
// src/core/context/TokenBudget.ts
export class TokenBudget {
  countTokens(text: string, nativeCounter?: CountTokensFn): number { /* ... */ }
  allocateBudget(tier: ModelContextTier, inputBudget: number): SectionAllocations { /* ... */ }
}

export const tokenBudget = new TokenBudget();
```

This matches the existing pattern from Phase 3:
```typescript
// src/core/ai/PlannerService.ts (existing pattern)
export const plannerService = new PlannerService();
export const providerRouter = new ProviderRouter();
export const agentOrchestrator = new AgentOrchestrator();
```

### Pattern 2: Zod-Validated Pipeline Input/Output

**What:** Pipeline inputs and outputs use Zod schemas for runtime validation, matching the Phase 3 `PlannerDecisionSchema` pattern.

**Example:**
```typescript
// Based on: src/core/ai/PlannerService.ts (PlannerDecisionSchema pattern)
import { z } from 'zod';

export const PromptSectionSchema = z.object({
  kind: z.enum(['system','tool_schemas','preferences','memory','context','task','user_input']),
  text: z.string(),
  tokens: z.number().int().min(0),
  stable: z.boolean(),
  sourceId: z.string(),
});

export const ContextOptimizerInputSchema = z.object({
  operationId: z.string(),
  model: z.string(),
  modelContextWindow: z.number().int().positive(),
  userInput: z.string(),
  conversationId: z.string(),
  workspaceId: z.string(),
  activeSurface: z.enum(['sidepanel', 'full-app']),
  pageContext: z.any().optional(),
  selectedToolSchemas: z.array(z.any()),
  memoryHints: z.array(z.any()),
  preferences: z.any(),
});
```

### Pattern 3: Degradation Pipeline with Stepwise Budget Check

**What:** The degradation pipeline is a linear sequence of transformation steps. After each step, the total token count is rechecked. If under budget, the pipeline stops. If all steps complete and still over budget, throw `CONTEXT_TOO_LARGE`.

**Example:**
```typescript
// Degradation sequence from spec §2.4 & D-07
const STEPS: DegradationStep[] = [
  { name: 'drop-debug', apply: dropDebugContext },
  { name: 'drop-secondary', apply: dropSecondaryContext },
  { name: 'summarise-history', apply: summariseHistory },
  { name: 'compress-page', apply: compressPageContext },
  { name: 'trim-tools', apply: trimToolSchemas },
  { name: 'reduce-memory', apply: reduceMemoryTopK },
  { name: 'minimal-mode', apply: enterMinimalMode },
];

for (const step of STEPS) {
  sections = step.apply(sections);
  const totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);
  provenance.recordStep(step.name);
  if (totalTokens <= budget) break;
}

if (totalTokens > budget) {
  throw new PipelineError('CONTEXT_TOO_LARGE', 'Context exceeds budget after all degradation steps.');
}
```

### Anti-Patterns to Avoid

- **Inline token counting in ContextOptimizer:** TokenBudget is a separate service (D-09). Inlining token estimation in ContextOptimizer violates the single-responsibility boundary and prevents testing token logic independently.
- **Dynamic degradation order:** The degradation sequence is product policy (D-07), not an optimization heuristic. Reordering steps based on estimated savings would produce different Provenance manifests in different runs, breaking auditability.
- **Calling `countTokens()` synchronously in a hot path:** Native token counting may require a network call (some provider APIs have dedicated tokenizer endpoints). Always provide a synchronous fallback path for assembly-time estimates.
- **Storing cache health in chrome.storage:** PromptCacheManager health state is runtime-only (D-13). Persisting it would cause stale cache-disable states across sessions.
- **Modifying `stable` flag during degradation:** D-14 mandates that `stable` is set during assembly only. Degradation steps should never flip stability — cache behavior must be deterministic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom BPE tokenizer | AI SDK `usage.inputTokens` (post-request native); `js-tiktoken` (pre-request estimation) | BPE tokenization is complex, model-specific, and changes with each model version. js-tiktoken handles o200k_base, cl100k_base, p50k_base, r50k_base, and gpt2 encodings. |
| Cache key hashing | Custom hash function | FNV-1a hash (specified in Appendix K, ~10 lines of code) | FNV-1a is specified in the product spec for cache key hashing. The implementation is trivial (10 lines) and MUST match Appendix K exactly for cross-turn cache-hit detection. |
| Prompt cache transformation | Per-provider REST API calls | PromptCacheAdapter.applyCacheHints() per Appendix K; AI SDK `providerOptions` for Anthropic cache control | The AI SDK v7 already handles Anthropic cache control natively via `providerOptions.anthropic.cacheControl`. The PromptCacheAdapter is already fully specified in Appendix K. |
| Token budget allocation formula | Dynamic allocation based on content analysis | Fixed per-tier allocation table (§2.2) | The spec defines a fixed allocation table. Dynamic allocation would make Provenance manifests non-deterministic and break diagnostics. |
| Context assembly | Custom message format for each provider | PromptSection[] with standardized `kind`/`sourceId` | The `PromptSection` format is the common currency — PlannerService and RendererService consume it uniformly regardless of provider. |

**Key insight:** The AI SDK v7 already provides native token usage (`inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`) on every `generateText`/`streamText` response. For pre-request estimation (budget planning before the API call), use `js-tiktoken` for accurate counts or character heuristics for zero-dependency estimates. Do NOT build a custom tokenizer.

## Common Pitfalls

### Pitfall 1: Token Estimation Before vs. After Request

**What goes wrong:** Using the same token estimation strategy for pre-assembly budget planning AND post-response cache tracking. Pre-assembly estimation uses heuristics or js-tiktoken; post-response tracking uses the provider's actual `usage.inputTokens`.

**Why it happens:** TokenBudget appears to be a single service, but it serves two distinct use cases with different accuracy requirements.

**How to avoid:** `TokenBudget.estimateTokens(text)` uses character heuristics/js-tiktoken for pre-request planning. Post-request, `PromptCacheManager.recordResponse()` reads `usage.inputTokens`/`usage.inputTokenDetails` directly from the AI SDK response — NOT from TokenBudget.

**Warning signs:** Cache hit/miss tracking showing implausible values (e.g., cache hits for tokens that were never cached). Budget checks passing heuristically but failing at the provider level.

### Pitfall 2: OptimizedContext Shape Mismatch with Legacy PlannerContext

**What goes wrong:** PlannerService.plan() and RendererService.synthesize()/stream() currently accept `PlannerContext` with fields like `userMessage`, `conversationHistory`, `toolCallHistory`, `availableTools`, `personaBehavior`, `abortSignal`. After D-03/D-04, they must accept `OptimizedContext` which has entirely different shape (`sections`, `tier`, `provenance`, `minimalMode`).

**Why it happens:** The type change is architecturally correct but creates a hard type migration. Every call site in the planner loop must be updated.

**How to avoid:** First add the `OptimizedContext` type and make `AgentTurnInput` (renamed `PlannerContext`). Then update `AgentOrchestrator.runTurn()` to assemble `AgentTurnInput`, call `ContextOptimizer.optimize()`, and pass `OptimizedContext` to `PlannerService.plan()` and `RendererService`. Update `PlannerService.buildPlannerSystemPrompt()` and `RendererService.buildMessages()` to extract data from `OptimizedContext.sections` instead of from `PlannerContext` fields. Remove the `PlannerContext` type entirely.

**Warning signs:** TypeScript errors across PlannerService, RendererService, and AgentOrchestrator. `PlannerContext` extension interfaces (from Phase 3 D-12) still in the codebase after D-03 removal.

### Pitfall 3: Cache Disabled State Persists Across Conversation Restarts

**What goes wrong:** PromptCacheManager is a module-level singleton (D-13). Its health state (`missStreak`, `disabledUntil`) is stored in memory only. After a page reload (Side Panel closes, Full App Tab opens), the singleton is recreated with fresh state — cache is re-enabled even if it was disabled before the reload.

**Why it happens:** D-13 explicitly says per-provider health state is shared across surfaces but does NOT require persistence. This is by design — cache should be retried after a fresh start. But a rapid reload loop where cache keeps failing could cause unnoticed cache-disabled states.

**How to avoid:** This is acceptable per the spec. The 5-consecutive-miss threshold means the worst case is 5 wasted cache-write tokens per session start. If this becomes a real problem, add a short-lived sessionStorage flag (NOT chrome.storage per D-13 anti-pattern).

**Warning signs:** Cache health reset on every surface switch but immediately re-disabling after 5 consecutive misses. Diagnosable via `missStreak` counter in Diagnostics panel (Phase 6).

### Pitfall 4: Persona Injector and Cache Stability Interaction

**What goes wrong:** PersonaInjector currently prepends a `[PERSONA]` block into system prompts. D-14 mandates system prompts are `stable: true` for cache eligibility. If PersonaInjector modifies the persona block between turns (e.g., user changes persona settings mid-conversation), the cached system prompt becomes stale but the `stable` flag doesn't reflect this.

**Why it happens:** The `stable` flag is set during ContextOptimizer assembly based on section provenance (system prompt → stable). But PersonaInjector injects the persona block into the system prompt string BEFORE assembly. If the persona changes, the generated system prompt text changes but the `kind: 'system'` still maps to `stable: true`.

**How to avoid:** PersonaInjector output is hashed as part of `hashStableSections()`. If the persona changes, the hash changes, the cache key changes, and the old cached content is naturally invalidated. This is handled by FNV-1a hashing in PromptCacheAdapter — no special handling needed. Just be aware: persona changes DO invalidate the cache, which is correct behavior.

**Warning signs:** Unexpected cache misses after persona configuration changes. This is expected — not a bug.

## Code Examples

### Token Counting with Character Heuristics (D-10)

```typescript
// Source: PRODUCT_SPEC_v0_1.md §2.2, D-10
// Confidence: HIGH (canonical spec)

export function estimateTokens(text: string): number {
  let cjkCount = 0;
  let totalCount = 0;
  for (const char of text) {
    totalCount++;
    const code = char.codePointAt(0)!;
    // CJK Unified Ideographs, Extensions, Compatibility
    if (
      (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified
      (code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
      (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
      (code >= 0xF900 && code <= 0xFAFF)    // CJK Compatibility
    ) {
      cjkCount++;
    }
  }
  const cjkRatio = cjkCount / Math.max(totalCount, 1);
  if (cjkRatio > 0.5) {
    return Math.ceil(text.length / 3);
  }
  return Math.ceil(text.length / 4);
}
```

### Model Context Tier Classification (§2.1)

```typescript
// Source: PRODUCT_SPEC_v0_1.md §2.1
// Confidence: HIGH (canonical spec)

export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';

export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096)   return 'tiny';
  if (contextWindow <= 16384)  return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}
```

### Token Budget Allocation Table (§2.2)

```typescript
// Source: PRODUCT_SPEC_v0_1.md §2.2, D-11
// Confidence: HIGH (canonical spec)

const ALLOCATION_TABLE: Record<ModelContextTier, SectionAllocations> = {
  tiny:   { system: 0.15, tools: 0.20, memory: 0.10, context: 0.20, history: 0.15, user: 0.20 },
  small:  { system: 0.10, tools: 0.15, memory: 0.10, context: 0.25, history: 0.20, user: 0.20 },
  medium: { system: 0.08, tools: 0.12, memory: 0.10, context: 0.30, history: 0.25, user: 0.15 },
  large:  { system: 0.05, tools: 0.10, memory: 0.10, context: 0.35, history: 0.25, user: 0.15 },
};

export function allocateBudget(tier: ModelContextTier, inputBudget: number): Record<string, number> {
  const alloc = ALLOCATION_TABLE[tier];
  return {
    system: Math.floor(inputBudget * alloc.system),
    tools: Math.floor(inputBudget * alloc.tools),
    memory: Math.floor(inputBudget * alloc.memory),
    context: Math.floor(inputBudget * alloc.context),
    history: Math.floor(inputBudget * alloc.history),
    user: Math.floor(inputBudget * alloc.user),
  };
}
```

### FNV-1a Hash for Cache Keys (Appendix K)

```typescript
// Source: PRODUCT_SPEC_v0_1.md Appendix K
// Confidence: HIGH (canonical spec — MUST match exactly)

function hashStableSections(sections: Array<Pick<PromptSection, 'text' | 'stable'>>): string {
  const stable = sections.filter(s => s.stable).map(s => s.text).join('\u0000');
  let h = 2166136261;
  for (let i = 0; i < stable.length; i++) {
    h ^= stable.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
```

### Anthropic Cache Control via AI SDK Provider Options

```typescript
// Source: AI SDK v7 docs — Anthropic provider cache control
// Confidence: VERIFIED (ai-sdk docs)
// Notes: The project uses ai@^7.0.42 and @ai-sdk/anthropic@^4.0.24

// Cache control on system messages (stable sections):
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const result = await generateText({
  model: anthropic('claude-haiku-4-latest'),
  messages: [
    {
      role: 'system',
      content: 'Cached system prompt text...',
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    },
    { role: 'user', content: 'User prompt' },
  ],
});

// Cache read/write tokens available on usage:
console.log(result.usage.inputTokenDetails.cacheReadTokens);
console.log(result.usage.inputTokenDetails.cacheWriteTokens);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `PlannerContext` with hardcoded fields | `AgentTurnInput` → `ContextAssembler` → `ContextOptimizerInput` → `OptimizedContext` with `PromptSection[]` | Phase 4 (now) | All downstream services (Planner, Renderer) must read from sections array instead of named fields |
| Static context assembly in PlannerService | Dynamic token budgeting and degradation in ContextOptimizer | Phase 4 (now) | Context now adapts to model tier; overflow degrades gracefully instead of failing |
| No prompt caching | Three-layer cache: PromptCacheManager + PromptCacheAdapter + AI SDK providerOptions | Phase 4 (now) | 70-90% token savings on stable sections per Anthropic docs [CITED: Anthropic prompt caching docs] |
| Token counting not performed | Dual-mode: AI SDK `usage.inputTokens` (post-request) + character heuristics (pre-request) | Phase 4 (now) | Enables budget-aware context assembly before API calls |

**Deprecated/outdated:**
- `PlannerContext` type (Phase 3 D-12): Replaced by `AgentTurnInput`. The extension interfaces for future sources are removed per D-03.
- Hardcoded system prompts in PlannerService/RendererService: System prompt content moves to `OptimizedContext.sections` where it can be budgeted, compressed, and cache-tagged.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | js-tiktoken provides sufficiently accurate token counts for pre-assembly budget estimation across Anthropic, OpenAI, and Google models | Standard Stack | If js-tiktoken tokenizer encodings diverge significantly from the actual provider tokenizers, pre-request budget estimates will be off by 20-30%. Mitigation: post-request `usage.inputTokens` provides ground truth; use that for cache tracking and adjust heuristics if needed. |
| A2 | AI SDK v7 `providerOptions.anthropic.cacheControl` API is the same in version `@ai-sdk/anthropic@^4.0.24` as in the current v7 docs | Code Examples | If the v4 provider package uses a different cache control API than v7, the PromptCacheAdapter implementation needs adjustment. The project currently has `@ai-sdk/anthropic@^4.0.24` — this is the latest v4.x release on npm. |
| A3 | The `usage.inputTokens` value from AI SDK v7 is the authoritative token count and no separate `countTokens()` API call is needed | TokenBudget | If some providers return inaccurate or zero `usage.inputTokens`, the character-based fallback (D-10) serves as the backup. |
| A4 | Gemini's `cachedContent` feature (min 32,768 tokens) is supported by `@ai-sdk/google@^4.0.28` via provider options | PromptCacheAdapter | If the v4 Google provider package doesn't support cachedContent natively, Gemini caching will fall back to prefix-only per Appendix K's `default` case. |

## Open Questions

1. **How is `modelContextWindow` determined for Ollama/local models?**
   - What we know: `classifyModelContext(contextWindow)` needs a numeric window size. OpenAI/Anthropic/Gemini have known context windows per model. Ollama models are user-installed and may not report context window.
   - What's unclear: Should we prompt the user to configure context window for Ollama models? Should we default to 'tiny' (4K) for unknown local models?
   - Recommendation: Default Ollama models to 'small' (8K) with an option to override in provider config. The `validateConnection()` method in the Ollama adapter could be extended to query `/api/show` for model metadata including context length.

2. **When should `ProviderRouter.getCompressionModel()` route to which provider?**
   - What we know: D-08 says "cheapest available summarisation-capable model." The compression model is independent of the user's conversation tier.
   - What's unclear: Should it always use the same provider as the conversation, or pick the cheapest across all configured providers? Should it prefer local (Ollama) for cost?
   - Recommendation: Implement as a simple policy: try the conversation's provider first (if it has a cheap model), then fall back to the cheapest configured provider. For now, the compression call is a Code Example placeholder — the actual model selection policy is D-08's discretion.

3. **How to detect model tier dynamically for provider-returned models?**
   - What we know: `classifyModelContext()` needs a numeric context window. OpenAI/Gemini model lists from `validateConnection()` don't include context window metadata.
   - What's unclear: Should we maintain a static lookup table of known model → context window mappings?
   - Recommendation: Maintain a `KNOWN_MODEL_WINDOWS` map in `ModelContextTier.ts` with known models (e.g., `'claude-haiku-4-latest': 200000`, `'gpt-4o-mini': 128000`, `'gemini-2.0-flash': 1048576`). Fall back to the tier resolution from Phase 3's `TierResolver` for unknown models: FAST → small (16K), BALANCED → medium (128K), ADVANCED → large (200K).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All runtime code | ✓ | v26.5.0 | — |
| npm | Package installation | ✓ | 11.17.0 | — |
| vitest | Test execution | ✓ | 3.2.7 | — |
| jsdom | Test environment (via vitest) | ✓ | 25.0.0 (installed) | — |
| fake-indexeddb | IndexedDB simulation in tests | ✓ | 6.2.5 (installed) | — |
| js-tiktoken | Pre-request token estimation | ✗ | — | Character heuristics (D-10) already specified as fallback |
| AI providers (API keys) | ProviderAdapter validation, integration tests | — (user-configured) | — | Tests use mocked adapters (existing pattern from Phase 3) |

**Missing dependencies with no fallback:**
- js-tiktoken: Must be installed if pre-request token accuracy matters. Character heuristics (D-10) serve as the zero-dependency fallback per the spec.

**Missing dependencies with fallback:**
- js-tiktoken → Character heuristics (Math.ceil(text.length / 4) for English, /3 for CJK) per D-10.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.7 |
| Config file | vitest.config.ts (environment: jsdom, globals: true, setupFiles: [./tests/setup.ts]) |
| Quick run command | `npx vitest run tests/core/context` |
| Full suite command | `pnpm run verify:phase-4` (tsc --noEmit && vitest run tests/core/context) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-01 | classifyModelContext returns correct tier for boundary values (4096→tiny, 4097→small, 16384→small, 131072→medium, 131073→large) | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "tier classification"` | ❌ Wave 0 |
| CTX-01 | TokenBudget.allocateBudget returns correct per-section caps for each tier | unit | `vitest run tests/core/context/TokenBudget.test.ts -t "budget allocation"` | ❌ Wave 0 |
| CTX-01 | Degradation pipeline reduces context below budget for over-budget input; provenance records each step | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "degradation pipeline"` | ❌ Wave 0 |
| CTX-01 | Minimal mode: only 1 tool schema, top-3 memories, conversation summary ≤200 tokens, last 1-2 turns | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "minimal mode"` | ❌ Wave 0 |
| CTX-01 | CONTEXT_TOO_LARGE error thrown when all degradation steps fail | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "context too large"` | ❌ Wave 0 |
| CTX-02 | PromptCacheAdapter.applyCacheHints for Anthropic: max 4 breakpoints, only stable sections get ephemeral cache control | unit | `vitest run tests/core/context/PromptCacheManager.test.ts -t "anthropic cache hints"` | ❌ Wave 0 |
| CTX-02 | PromptCacheAdapter for Gemini: cachedContent when stable tokens ≥ 32,768, else prefix-only | unit | `vitest run tests/core/context/PromptCacheManager.test.ts -t "gemini cache hints"` | ❌ Wave 0 |
| CTX-02 | PromptCacheAdapter for OpenAI/Ollama: stable-first ordering | unit | `vitest run tests/core/context/PromptCacheManager.test.ts -t "openai cache hints"` | ❌ Wave 0 |
| CTX-02 | cacheKeyHash produces consistent FNV-1a hash for identical stable sections | unit | `vitest run tests/core/context/PromptCacheManager.test.ts -t "cache key hash"` | ❌ Wave 0 |
| CTX-02 | PromptCacheManager auto-disables after 5 consecutive misses; re-enables after 60s cooldown | unit | `vitest run tests/core/context/PromptCacheManager.test.ts -t "cache health"` | ❌ Wave 0 |
| Integration | AgentOrchestrator.runTurn() with ContextOptimizer produces valid OptimizedContext consumed by PlannerService/RendererService | integration | `vitest run tests/core/ai/integration.test.ts` (extend existing) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/context` (quick unit test run)
- **Per wave merge:** `pnpm run verify:phase-4` (full typecheck + all context tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/context/ContextOptimizer.test.ts` — covers tier classification, degradation pipeline, minimal mode, CONTEXT_TOO_LARGE, provenance tracking
- [ ] `tests/core/context/TokenBudget.test.ts` — covers estimateTokens (char heuristics + CJK detection), allocateBudget for all 4 tiers, integration with optional countTokens()
- [ ] `tests/core/context/PromptCacheManager.test.ts` — covers applyCacheHints for all 4 providers, FNV-1a hash, cache health (miss streak, cooldown, auto-disable), recordResponse
- [ ] `tests/core/ai/integration.test.ts` — extend existing Phase 3 integration test to verify ContextOptimizer → PlannerService → RendererService pipeline with OptimizedContext
- [ ] `tests/setup.ts` — already exists with fake-indexeddb, localStorage stub. No changes needed for Phase 4 tests.
- [ ] Vitest config — already exists at `vitest.config.ts`. No changes needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Provider API keys already encrypted in Phase 2 (ApiKeyStore with AES-GCM) |
| V3 Session Management | No | Session tokens managed by chrome.storage.session (Phase 2) |
| V4 Access Control | No | Tool execution permission gating deferred to Phase 8 (MCP tools) |
| V5 Input Validation | **Yes** | Zod validation on ContextOptimizerInput and OptimizedContext. `sourceId` format validation (dot-separated hierarchical). Token counts must be non-negative integers. |
| V6 Cryptography | No | FNV-1a is a non-cryptographic hash for cache keys — intentional per D-16. No cryptographic requirements in this phase. |

### Known Threat Patterns for Context Optimization

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed `sourceId` injection (path traversal in sourceId string) | Tampering | Validate `sourceId` against pattern: `/^[a-z0-9]+(\.[a-z0-9_\-]+)*(\.[a-zA-Z0-9_\-]+)?$/`. Reject IDs with `..`, `/`, or `\`. |
| Token count integer overflow/underflow | Tampering | Use `z.number().int().min(0).max(2_000_000)` for all token counts in Zod schemas. The largest production context window (Gemini 2.5 Pro) is ~2M tokens. |
| Unbounded `userInput` or `text` fields causing memory exhaustion | Denial of Service | ContextOptimizerInput.userInput and PromptSection.text should have Zod `.max()` constraints. User input max recommended: 100K chars (~25K tokens). Prompt section text: 500K chars. |
| Cache key collision from truncated/malformed stable sections | Information Disclosure | FNV-1a is non-cryptographic — collisions are possible but the consequence is a cache miss (not a security breach). The stable sections themselves are system prompts and tool schemas — not user data. |
| Degradation pipeline skipping steps due to malformed budget thresholds | Tampering | `TokenBudget.allocateBudget()` must validate that inputBudget > 0 and tier is a valid `ModelContextTier`. Negative or zero budgets should throw immediately. |

## Sources

### Primary (HIGH confidence)
- `.planning/PRODUCT_SPEC_v0_1.md` §2.1–§2.6 — ModelContextTier, Token Budget Formula, ContextOptimizer contract, Degradation Pipeline, Minimal Mode, ContextProvenanceManifest [CITED: canonical project specification]
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix K — PromptCacheAdapter full implementation including FNV-1a hash [CITED: canonical project specification]
- `.planning/phases/04-context-optimization-pipeline/04-CONTEXT.md` — All 18 locked decisions (D-01 through D-18) [CITED: user-decided constraints]
- `src/core/ai/AgentOrchestrator.ts` — Existing runTurn() entry point, planner loop structure [CITED: codebase]
- `src/core/ai/PlannerService.ts` — Current PlannerContext consumption pattern [CITED: codebase]
- `src/core/ai/RendererService.ts` — Current synthesize()/stream() signatures [CITED: codebase]
- `src/core/ai/providers/ProviderAdapter.ts` — Existing interface with getCacheStrategy() [CITED: codebase]
- `src/core/ai/ProviderRouter.ts` — Existing provider selection pattern [CITED: codebase]

### Secondary (MEDIUM confidence)
- AI SDK v7 docs (sdk.vercel.ai) — Cache control for Anthropic via providerOptions, usage.inputTokenDetails.cacheReadTokens/cacheWriteTokens [CITED: official ai-sdk documentation]
- AI SDK v7 docs — generateText reference showing usage.inputTokens, usage.outputTokens [CITED: official ai-sdk documentation]
- npm registry — js-tiktoken@1.0.21 (published 2025-08-09, 6.6M weekly downloads) [VERIFIED: npm registry]

### Tertiary (LOW confidence)
- WebSearch — Token counting heuristics (char/4 for English, char/3 for CJK) — confirmed as standard practice across LLM tooling but no single authoritative source [ASSUMED]
- WebSearch — FNV-1a hash usage for cache key hashing — common in distributed systems but no verification against a specific canonical source [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core dependencies already installed (ai, @ai-sdk/*, zod) from Phase 3; js-tiktoken is the only addition and is verified on npm registry
- Architecture: HIGH — architecture is fully specified by PRODUCT_SPEC_v0_1.md §2 and Appendix K, with all decisions locked in 04-CONTEXT.md
- Pitfalls: HIGH — pitfalls are derived from the spec's explicit constraints (D-01 through D-18) and the existing codebase patterns

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 (30 days — stable AI SDK APIs and product spec)

---

*Research complete. Planner can now create PLAN.md for Phase 04: Context Optimization Pipeline.*
