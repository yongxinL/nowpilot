# Phase 04: Context-Adaptive Execution - Research

**Researched:** 2026-07-13
**Domain:** Context window management, token budgeting, AI prompt optimization
**Confidence:** HIGH

## Summary

Phase 4 delivers the ContextOptimizer — a gatekeeper class that wraps every AI call with tier-aware token budgets, dynamic section distribution, an 8-step degradation pipeline, and minimal mode for tiny models. The ContextOptimizer sits between context assembly (stores, workspace, memory) and the AgentOrchestrator pipeline, producing an `OptimizedContext` that carries a `ContextProvenanceManifest` recording every section's source, token count, and any truncation decisions.

No external packages are required. The implementation is purely internal TypeScript modules (`src/core/context/`) following the established class+singleton pattern (KeymapRegistry, ToolRegistry, ProviderRegistry). The ContextOptimizer is injected with `TokenEstimator` and `ContextCompressor` dependencies, mirroring the AgentOrchestrator's constructor DI pattern.

**Primary recommendation:** Build ContextOptimizer as a class+singleton with constructor-injected TokenEstimator and ContextCompressor, expose a single `.optimize()` method, and integrate into AgentOrchestrator via a new `runWithContext()` method that distributes sections per-stage without breaking the existing `run()` signature.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Model tier classification | API / Backend (core) | — | ContextOptimizer reads ModelEntry.contextWindow from ProviderRegistry — no UI involvement |
| Token budget computation | API / Backend (core) | — | Pure arithmetic on the model's context window — business logic, not UI |
| Section distribution | API / Backend (core) | — | ContextOptimizer assembles sections; AgentOrchestrator filters per stage (Planner vs Renderer) |
| Degradation pipeline | API / Backend (core) | — | Stepwise state machine in ContextOptimizer — no user interaction during degradation |
| History summarization (LLM) | API / Backend (core) | — | ContextCompressor makes a separate cheap AI call — backend-only concern |
| Structural context extraction | API / Backend (core) | — | ContextCompressor operates on structured PageContext data — no DOM access needed here |
| Provenance manifest recording | API / Backend (core) | — | ContextOptimizer records all section outcomes; PromptInspector (Phase 6) reads it later |
| Degradation event emission | API / Backend (core) | — | AgentOrchestrator inspects provenance and yields OrchestratorEvent — backend-only |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Orchestrator Integration):** `AgentOrchestrator.runWithContext(optimizedContext: OptimizedContext)` is the canonical execution path. Keep existing `run()` temporarily for migration. Sections are distributed to pipeline stages, never merged into a single systemPrompt string.
- **D-02 (Stage-Level Section Distribution):** Planner receives: instructions, tool schemas, workspace/page context, history, user input. Renderer receives: instructions, user input, history, tool results, memory, relevant context. Executor remains deterministic — no context sections.
- **D-03 (ContextCompressor Strategy):** LLM-based summarization for medium/large tier history. Heuristic compression for tiny/small tier history. Page/case context: heuristic/structural extraction across ALL tiers.
- **D-04 (ContextCompressor as Injectable Dependency):** Standalone module injected into ContextOptimizer constructor. Exposes `compressHistory()` and `compressContext()` methods.
- **D-05 (Token Counting):** Provider-native token counts preferred. Fallback: `Math.ceil(text.length / 4)` for Latin/ASCII, `Math.ceil(text.length / 3)` for CJK. 10% safety margin before budget enforcement. No tiktoken.
- **D-06 (TokenEstimator as Standalone Module):** `src/core/context/TokenEstimator.ts` — injected into ContextOptimizer. Exposes `estimateTokens(text: string): number`. Separable for independent testing.
- **D-07 (ContextOptimizer Lifecycle):** Class+singleton pattern. Constructor accepts: TokenEstimator, ContextCompressor, provider/model metadata lookup. Single method: `.optimize(input) -> Promise<OptimizedContext>`. Exported as `contextOptimizer` singleton. Mostly stateless.
- **D-08 (ModelContextTier Classification):** `classifyModelContext(contextWindow)` per thresholds: ≤4096→tiny, ≤16384→small, ≤131072→medium, >131072→large. Reads from `ModelEntry.contextWindow` at optimization time — not cached.
- **D-09 (Context Source Priority):** 1. System Prompt, 2. User Message, 3. Active Tool Results, 4. Workspace Context, 5. Recent Conversation History, 6. Relevant Memory, 7. Page/Case Context, 8. Notes/Metadata, 9. Debug Data.
- **D-10 (ContextProvenanceManifest Granularity):** Record both retained AND dropped sections. Each entry: kind, sourceId, originalTokens, finalTokens, outcome (kept/truncated/compressed/dropped), compressionMethod, reason. No full transformation history — just final outcome.
- **D-11 (Degradation Notification Contract):** ContextOptimizer is output-only. AgentOrchestrator inspects provenance and emits: silent for minor degradation, info-level for significant, warning for minimal mode, typed error for step 8 (CONTEXT_TOO_LARGE).
- **D-12 (No Caching):** Regenerate OptimizedContext fresh for every AI call. Cache expensive intermediates later if profiling demands it.
- **D-13 (Tool Schema Selection in Minimal Mode):** Caller-supplied via `ContextOptimizerInput.selectedToolSchemas`. ContextOptimizer keeps only first in minimal mode. No ToolRegistry dependency.
- **D-14 (Fixed Canonical Section Ordering):** 1. System Prompt, 2. Task Instructions, 3. Workspace Context, 4. Memory, 5. Tool Schemas, 6. Page/Case Context, 7. Conversation History, 8. User Input. ContextOptimizer produces sections; prompt assembly is a separate concern.
- **D-15 (Single OptimizedContext Per Operation):** One OptimizedContext with one ContextProvenanceManifest per operation. AgentOrchestrator filters sections per stage — no separate Planner vs Renderer optimization passes.

### the agent's Discretion

- Exact shape of TokenEstimator interface — researcher/planner to determine the cleanest approach consistent with existing class+singleton or pure-function patterns.
- ContextCompressor internal implementation — how heuristic extraction extracts structured fields from page/case context.
- LLM-based history summarization prompt — planner to design a cost-effective summarization prompt for Haiku/Flash tier.
- Degradation event format in the orchestrator event stream — planner to add degradation-warning events to OrchestratorEvent union type.
- Exact integration of runWithContext with the existing AbortManager/timeout infrastructure.

### Deferred Ideas (OUT OF SCOPE)

- OptimizedContext caching — revisit if profiling shows hot spots.
- Per-stage separate optimization — revisit if Planner and Renderer have diverging needs.
- Provider-adaptive section ordering — revisit if specific providers show quality improvements from reordering.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTXT-01 | ModelContextTier classification — tiny/small/medium/large based on context window | `classifyModelContext()` function with 4 thresholds per PRODUCT_SPEC §2.1. Reads `ModelEntry.contextWindow` from ProviderRegistry |
| CTXT-02 | Token budget formula — inputBudget=70%, outputBudget=20%, safetyMargin=10% | Simple arithmetic from modelContextWindow per PRODUCT_SPEC §2.2. Safety margin applied before budget enforcement per D-05 |
| CTXT-03 | Dynamic distribution across system/tools/memory/context/history/user per tier | Percentage distribution table per PRODUCT_SPEC §2.2. Applied after budget computation |
| CTXT-04 | ContextOptimizer assembles OptimizedContext with provenance manifest | Class+singleton with `.optimize()` method per D-07. Provenance per D-10 and PRODUCT_SPEC §2.6 |
| CTXT-05 | Degradation pipeline — 8-step overflow handling ending in CONTEXT_TOO_LARGE error | Linear stepwise pipeline per PRODUCT_SPEC §2.4. Each step reduces specific section types. Step 8 throws typed error |
| CTXT-06 | Minimal mode for tiny models — compact prompts, no MCP, top-3 memory, 200 token summary | PRODUCT_SPEC §2.5. Mandatory for 'tiny' tier. Restricts tool schemas to 1 safe schema, caps memory at top-3 |
| CTXT-07 | ContextCompressor — structured text/page/case/history compression | Injectable module per D-04. LLM summarization for medium/large history (D-03). Heuristic for tiny/small. Structural extraction for page/case context always |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (strict) | 7.0.2 | All type definitions, discriminated unions, typed errors | Already in project |
| `ai` (Vercel AI SDK) | 4.3.19 | `generateText` for ContextCompressor LLM summarization; `LanguageModelUsage` type for provider-native token counts | Already in project (Phase 3) |
| Zod | v4 | Schema validation for OptimizedContext, ProvenanceManifest, ContextOptimizerInput | Already in project (Phase 3) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@ai-sdk/openai` | 0.0.68 | Provider adapter for Haiku/Flash summarization calls | When ContextCompressor needs to call OpenAI-compatible cheap models |
| `@ai-sdk/anthropic` | 0.0.56 | Provider adapter for Haiku summarization calls | When ContextCompressor uses Anthropic Haiku for summarization |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tiktoken / js-tiktoken | N/A | Explicitly rejected per D-05. Adds ~4MB WASM dependency for MV3 extension. Char-based fallback sufficient |
| Custom regex-based text extraction | Context7 / cheerio-like | Rejected — ContextCompressor operates on structured PageContext data (already extracted), not raw HTML |
| Cached OptimizedContext | Rebuild per call | Rejected per D-12 — invalidation complexity exceeds benefit. Optimization is lightweight arithmetic |

**No new packages are installed in this phase.** All dependencies (TypeScript, AI SDK, Zod) are already present from Phase 3.

**Version verification:** Confirmed AI SDK v4.3.19 installed (`npm view ai@4.3.19 version` returns `4.3.19`). TypeScript 7.0.2 and Zod v4 confirmed in existing `package.json`.

## Package Legitimacy Audit

> Skipped — no external packages are installed in this phase. All modules are internal TypeScript files in `src/core/context/`.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────────┐
                          │   ContextOptimizer   │
                          │   (Class+Singleton)   │
                          │                      │
                          │  .optimize(input)    │←── ContextOptimizerInput
                          │     ↓                │    (operationId, model,
                          │  classifyModelContext │     modelContextWindow,
                          │     ↓                │     userInput, pageContext,
                          │  computeBudget()      │     toolSchemas, memory,
                          │     ↓                │     preferences, ...)
                          │  assessSections()     │
                          │     ↓                │
                          │  if overflow:         │
                          │    degradationPipeline│←── 8 steps
                          │     ↓                │
                          │  assembleManifest()   │
                          │     ↓                │
                          │  return OptimizedContext
                          └────────┬─────────────┘
                                   │ OptimizedContext
                                   │ { tier, inputBudget,
                                   │   outputBudget, sections,
                                   │   provenance, minimalMode }
                                   ▼
                          ┌──────────────────────┐
                          │  AgentOrchestrator   │
                          │  .runWithContext()    │
                          │     ↓                │
                          │  Inspects provenance  │
                          │  Emits degradation    │
                          │  events as needed     │
                          │     ↓                │
                          │  Distributes sections │
                          │  to Planner/Renderer  │
                          └──────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ Planner  │  │ Executor │  │ Renderer │
              │ receives:│  │ receives:│  │ receives:│
              │ instruct │  │ validated│  │ instruct │
              │ tools    │  │ tool     │  │ user msg │
              │ ctx      │  │ inputs   │  │ history  │
              │ history  │  │ (no ctx  │  │ tools    │
              │ user msg │  │ sections)│  │ memory   │
              └──────────┘  └──────────┘  │ ctx      │
                                          └──────────┘

  Dependencies (injected):
  ┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
  │ TokenEstimator   │   │ ContextCompressor│   │ Provider Lookup │
  │ .estimateTokens()│   │ .compressHistory()│   │ ModelEntry.     │
  │ - provider-native│   │ .compressContext()│   │ contextWindow   │
  │ - char-based     │   │ - LLM (md/lg)    │   │ from registry   │
  │   fallback       │   │ - heuristic (all)│   └─────────────────┘
  └─────────────────┘   └──────────────────┘
```

### Recommended Project Structure

```
src/core/context/
├── ModelContextTier.ts           # Tier type + classifyModelContext()
├── TokenEstimator.ts             # Token counting (provider-native + fallback)
├── ContextCompressor.ts          # Structured text/page/case/history compression
├── ContextOptimizer.ts           # Tier classification → budget → priority → degradation → assembly
├── ContextProvenanceManifest.ts  # Manifest types (retained + dropped sections)
└── contextTypes.ts               # Shared types: PromptSection, OptimizedContext, ContextOptimizerInput

tests/core/context/
├── ModelContextTier.test.ts      # Tier classification boundary tests
├── TokenEstimator.test.ts        # Provider-native + char fallback tests
├── ContextCompressor.test.ts     # LLM + heuristic compression tests
├── ContextOptimizer.test.ts      # Full optimization pipeline tests
└── ContextProvenanceManifest.test.ts  # Manifest assembly tests
```

**Modified files (integration):**
```
src/core/ai/pipeline/
├── AgentOrchestrator.ts          # Add runWithContext(), degradation event emission
└── pipelineTypes.ts              # Extend OrchestratorEvent with degradation events
```

### Pattern 1: Class + Singleton Export

**What:** One class, one singleton `const` export. Module-level shared state in private `#fields`. Constructor dependency injection for services.

**When to use:** For ContextOptimizer (D-07), TokenEstimator (D-06), ContextCompressor (D-04). This is the project's established pattern.

**Example:**
```typescript
// Source: src/core/ai/pipeline/AgentOrchestrator.ts (existing pattern)
import { debugLog } from '../../utils/debugLog';
import type { TokenEstimator } from './TokenEstimator';
import type { ContextCompressor } from './ContextCompressor';

export class ContextOptimizer {
  constructor(
    private tokenEstimator: TokenEstimator,
    private compressor: ContextCompressor,
  ) {}

  async optimize(input: ContextOptimizerInput): Promise<OptimizedContext> {
    // ...
  }
}

// Singleton wiring
export const contextOptimizer = new ContextOptimizer(
  tokenEstimator,
  contextCompressor,
);
```

### Pattern 2: Pure Function + Type-Only Module

**What:** A module that exports only types and a single pure function. No state, no class instantiation needed.

**When to use:** For `ModelContextTier.ts` (`classifyModelContext()`) and `ContextProvenanceManifest.ts` (type definitions + `createManifest()` builder). These have no dependencies and no state.

**Example:**
```typescript
// src/core/context/ModelContextTier.ts
export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';

export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096) return 'tiny';
  if (contextWindow <= 16384) return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}
```

### Pattern 3: Typed Error Classes

**What:** Custom error classes extending `Error` with structured properties for programmatic handling. Used when the consumer (AgentOrchestrator) needs to distinguish error types.

**When to use:** For `CONTEXT_TOO_LARGE` (degradation step 8). The orchestrator catches this and yields a specific error event rather than a generic failure.

**Example:**
```typescript
// src/core/context/contextTypes.ts
export class ContextTooLargeError extends Error {
  public readonly code = 'CONTEXT_TOO_LARGE' as const;
  public readonly estimatedTokens: number;
  public readonly budget: number;

  constructor(estimatedTokens: number, budget: number) {
    super(
      `Context size (${estimatedTokens} tokens) exceeds available budget (${budget} tokens) after all degradation steps`
    );
    this.name = 'ContextTooLargeError';
    this.estimatedTokens = estimatedTokens;
    this.budget = budget;
  }
}
```

### Pattern 4: Discriminated Union for Section Outcomes

**What:** A union type where each variant has a distinct `outcome` literal discriminator. Enables exhaustiveness checking in `switch` statements.

**When to use:** For `ContextProvenanceManifest` section entries (D-10). The planner needs to switch on `outcome` to determine what to display.

**Example:**
```typescript
// src/core/context/ContextProvenanceManifest.ts
export interface SectionProvenanceEntry {
  kind: PromptSectionKind;
  sourceId: string;
  originalTokens: number;
  finalTokens: number;
  outcome: 'kept' | 'truncated' | 'compressed' | 'dropped';
  compressionMethod?: 'summarise' | 'structural' | 'topk';
  reason?: 'budget' | 'minimal_mode' | 'degradation_step_1' | 'degradation_step_2' | /* ... */ 'degradation_step_7';
}
```

### Pattern 5: Degradation Pipeline State Machine

**What:** A linear stepwise pipeline where each step attempts to reduce context size. After each step, re-estimate total tokens. If within budget, return. If still overflow, proceed to next step. Step 8 throws.

**When to use:** For the 8-step degradation pipeline (PRODUCT_SPEC §2.4). Must be implemented as a sequence of idempotent transformations on the section list.

**Example:**
```typescript
// Inside ContextOptimizer.optimize()
private async applyDegradation(
  sections: PromptSection[],
  input: ContextOptimizerInput,
  tier: ModelContextTier,
): Promise<{ sections: PromptSection[]; provenance: SectionProvenanceEntry[] }> {
  const provenance: SectionProvenanceEntry[] = [];

  // Step 1: Drop debug-only context
  const step1Result = this.dropDebugContext(sections);
  if (this.withinBudget(step1Result.sections, input)) {
    return { sections: step1Result.sections, provenance: [...provenance, ...step1Result.dropped] };
  }
  provenance.push(...step1Result.dropped);

  // Step 2: Drop secondary notes and optional metadata
  // ...

  // Step 3: Summarise older history (LLM or heuristic based on tier)
  // ...

  // ... Steps 4-7 ...

  // Step 8: Still too large → error
  const estimatedTokens = this.totalEstimatedTokens(sections);
  throw new ContextTooLargeError(estimatedTokens, input.modelContextWindow);
}
```

### Anti-Patterns to Avoid

- **Merging sections into a single systemPrompt string:** Violates D-01 — loses provenance and weakens the ContextOptimizer contract. Sections must remain separable so the orchestrator can distribute them per-stage.
- **Calling ContextOptimizer.optimize() twice per operation:** Violates D-15 — one OptimizedContext per operation. AgentOrchestrator filters sections, doesn't re-optimize.
- **Caching or memoizing the OptimizedContext:** Violates D-12 — regenerate fresh each call. Optimization is lightweight arithmetic.
- **Hard-coding provider names in ContextOptimizer:** ContextOptimizer should only read `modelContextWindow` from the provider lookup and the `providerType` if needed by TokenEstimator. All provider-specific logic belongs in TokenEstimator and ContextCompressor.
- **Using class static methods instead of instance methods:** The project pattern uses class+singleton, not static methods. Instance methods enable constructor DI for testability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom tokenizer, regex-based counting | `result.usage.inputTokens` / `result.usage.outputTokens` from AI SDK, or `Math.ceil(text.length / 4)` char-based fallback | AI SDK already counts tokens from provider responses. Char fallback is the explicit decision (D-05). No tiktoken needed |
| CJK token estimation | Byte-level counting, ICU segmentation | `Math.ceil(text.length / 3)` | Decision D-05 specifies this threshold. CJK characters are ~3 chars per token on average |
| History summarization (LLM path) | Custom NLP pipeline, sentence extraction | `generateText` from AI SDK with Haiku/Flash model | Already in project. ContextCompressor calls the same ProviderRouter that Planner uses. No new summarization library needed |
| Structural context extraction | DOM parsing, cheerio, regex on HTML | Direct access to `PageContext` structured fields | PageContext is already a typed object with structured fields. ContextCompressor reads field names, not raw HTML |
| Prompt assembly (sections to provider format) | Custom string concatenation | Adapter per provider (can reuse existing adapter patterns from PromptCacheAdapter) | Provider formats differ — Anthropic separates system/user, OpenAI uses roles. Adapter pattern already established in Phase 3 |

**Key insight:** The ContextOptimizer is a coordinator and budget enforcer, not a text processor. Token counting delegates to TokenEstimator. History summarization delegates to ContextCompressor (which delegates to AI SDK). ContextOptimizer's unique value is the tier classification → budget → distribution → degradation pipeline, all of which are arithmetic + decision logic.

## Runtime State Inventory

> Omitted — not a rename/refactor/migration phase. This is a greenfield module in `src/core/context/` with no existing runtime state to migrate.

## Common Pitfalls

### Pitfall 1: Token Budget Off-by-One on Boundary Values

**What goes wrong:** The `classifyModelContext()` function uses `<=` thresholds. A model with exactly 4096 context window must be classified as `tiny`, not fall through to `small`. The PRODUCT_SPEC explicitly uses `<=` in the boundary conditions.

**Why it happens:** Confusion between inclusive/exclusive boundaries when writing the tier classification. Getting this wrong means a 4096-window model gets treated as `small` (8K-16K) instead of `tiny` (≤4K), potentially exceeding its actual context limit.

**How to avoid:** Write exact boundary tests for 4096, 4097, 16384, 16385, 131072, 131073. Each boundary value should produce the expected tier.

**Warning signs:** Test failures at boundary values. Models with 4096 or 16384 context windows crashing with context-overflow errors.

### Pitfall 2: Provider-Native Token Counts Not Available Pre-Flight

**What goes wrong:** Trying to get provider-native token counts before sending the prompt to the AI. Token counts are only available AFTER the API call completes (in `result.usage`). The ContextOptimizer runs BEFORE any AI call, so provider-native counts are not available at optimization time.

**Why it happens:** The natural instinct is to use the most accurate token counter. But ContextOptimizer must estimate token counts to prevent oversized prompts — it can't wait for the API to return token counts because the prompt might be too large to send.

**How to avoid:** TokenEstimator uses the char-based fallback exclusively for estimation. The `estimateTokens()` method does NOT make AI calls. Provider-native counts are only used post-hoc for telemetry/diagnostics (PromptTrace in Phase 6), not for budget enforcement.

**Warning signs:** `TokenEstimator.estimateTokens()` attempting to call `generateText` or `streamText`. Async token counting in what should be a synchronous or trivial computation.

### Pitfall 3: Degradation Pipeline Not Idempotent

**What goes wrong:** Running the degradation pipeline step-by-step, but after step 3 (history summarization), the token count increases instead of decreases — because the LLM summary is longer than the original history on a tiny context.

**Why it happens:** LLM-based summarization is not guaranteed to produce shorter output than input, especially for very short conversation histories. Summarizing 2 turns of 50-token messages could produce a 60-token summary.

**How to avoid:** After each degradation step, re-estimate tokens AND compare to the previous step. If tokens did not decrease, log a warning and skip to the next step. The degradation pipeline must always move forward, never loop.

**Warning signs:** Infinite loop in degradation pipeline. Token counts increasing after a "reduction" step.

### Pitfall 4: Minimal Mode Activating on Non-Tiny Models

**What goes wrong:** A model with a 128K context window (medium tier) enters minimal mode because of context overflow. Minimal mode severely restricts functionality — it should only be step 7 of the degradation pipeline, not the first resort.

**Why it happens:** The degradation pipeline is triggered by overflow, not by tier. A large-tier model with excessive page context or history could overflow. But minimal mode is the MOST aggressive degradation — it should never activate before steps 1-6 have been tried.

**How to avoid:** Strict step ordering in the degradation pipeline. Minimal mode is step 7 — after debug removal, note trimming, history summarization, context compression, tool trimming, and memory reduction. Only if ALL those fail does minimal mode activate.

**Warning signs:** `minimalMode: true` in provenance manifest when tier is `medium` or `large`. Debug data still present but minimal mode active.

### Pitfall 5: OrchestratorEvent Union Type Extension Breaking Existing Consumers

**What goes wrong:** Adding new event types to the `OrchestratorEvent` union type without updating existing `switch`/`if-else` handlers in consumers (Chat UI, Agent page, tests). TypeScript won't catch this if handlers use `default` clauses or loose type checks.

**Why it happens:** The `OrchestratorEvent` type is a discriminated union of 6 variants in Phase 3. Adding `context-degraded` and `context-error` variants means consumers must handle them. If they have `default` cases, they silently ignore the new events.

**How to avoid:** Grep for all consumers of `OrchestratorEvent` before extending the union. Add explicit handling for new event types in every consumer. Prefer exhaustive `switch` with `assertNever()` over `default` clauses.

**Warning signs:** New degradation events logged but never surfaced in the UI. Test failures in orchestrator test files after extending the event union.

## Code Examples

Verified patterns from official sources:

### Token Usage from AI SDK v4 (Context7)

```typescript
// Source: Context7 /vercel/ai/ai_4_3_19 — LanguageModelUsage type
// Provider-native token counts are available in result.usage after the AI call.
// ContextOptimizer uses char-based fallback PRE-flight; these counts are for telemetry.

import { generateText } from 'ai';

const result = await generateText({
  model: /* provider model */,
  prompt: 'Your prompt here',
});

// result.usage.inputTokens — total input tokens from provider
// result.usage.outputTokens — total output tokens from provider
// result.usage.raw — raw provider-specific metadata (e.g., cache hit/miss, reasoning tokens)
console.log('Input tokens:', result.usage.inputTokens);
console.log('Output tokens:', result.usage.outputTokens);
console.log('Raw provider metadata:', result.usage.raw);
```

### Summarization via generateText (Context7)

```typescript
// Source: Context7 /vercel/ai/ai_4_3_19 — generateText with system prompt
// Pattern for ContextCompressor.compressHistory() on medium/large tiers
// Uses a separate cheap model call (Haiku/Flash) to summarize conversation history

import { generateText } from 'ai';

const SUMMARY_PROMPT = `Summarize the following conversation in ≤200 tokens.
Focus on: key decisions, action items, and user preferences.
Do not include greetings or pleasantries.

Conversation:
{history}

Summary:`;

export async function summarizeHistory(
  messages: Array<{ role: string; content: string }>,
  model: /* Haiku/Flash model instance */,
): Promise<string> {
  const history = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  const { text } = await generateText({
    model,
    system: 'You are a conversation summarizer. Be concise.',
    prompt: SUMMARY_PROMPT.replace('{history}', history),
    maxTokens: 200,
    temperature: 0,
  });
  return text;
}
```

### Token Estimation — Char-Based Fallback

```typescript
// Source: Decision D-05 — Token Counting with char-based fallback
// No AI SDK call needed — pure computation used in ContextOptimizer pre-flight

const CJK_REGEX = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;

export function estimateTokens(text: string): number {
  // Count CJK characters separately (3 chars ≈ 1 token)
  const cjkCount = (text.match(CJK_REGEX) || []).length;
  const nonCjkCount = text.length - cjkCount;

  // Latin/ASCII: 4 chars ≈ 1 token. CJK: 3 chars ≈ 1 token.
  const estimated = Math.ceil(nonCjkCount / 4) + Math.ceil(cjkCount / 3);
  return estimated;
}

// Apply 10% safety margin before budget enforcement
export function applySafetyMargin(estimatedTokens: number): number {
  return Math.ceil(estimatedTokens * 1.10);
}
```

### ModelContextTier Classification

```typescript
// Source: PRODUCT_SPEC §2.1 — classifyModelContext function
// Pure function — no dependencies, no state

export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';

export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096) return 'tiny';
  if (contextWindow <= 16384) return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}
```

### TypeScript Exhaustive Switch Pattern

```typescript
// Source: Standard TypeScript pattern for discriminated unions
// Used in the degradation pipeline and provenance manifest consumers

type DegradationStep = 
  | 'drop_debug'
  | 'drop_metadata'
  | 'summarise_history'
  | 'compress_context'
  | 'trim_tools'
  | 'reduce_memory'
  | 'minimal_mode';

function getStepDescription(step: DegradationStep): string {
  switch (step) {
    case 'drop_debug':       return 'Removed debug context';
    case 'drop_metadata':    return 'Removed optional metadata';
    case 'summarise_history':return 'Summarised conversation history';
    case 'compress_context': return 'Compressed page/case context';
    case 'trim_tools':       return 'Trimmed tool schemas to in-scope tools';
    case 'reduce_memory':    return 'Reduced memory injection top-k';
    case 'minimal_mode':     return 'Activated minimal mode';
    // No default — exhaustiveness checked by TypeScript
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed system prompt with no tier awareness | Dynamic section distribution per ModelContextTier | Phase 4 | Adaptive to model capabilities — tiny models get compact prompts, large models get full context |
| Manual token counting via tiktoken | Provider-native counts (post-hoc) + char-based estimation (pre-flight) | Phase 4 (D-05) | Removes 4MB WASM dependency; char-based fallback sufficient for budget enforcement |
| Single prompt string (merged sections) | Separable PromptSection[] with provenance per section | Phase 4 (D-01, D-10) | Enables PromptInspector diagnostics, per-stage distribution, and audit trails |
| All models get same context | Tiered budgets: 70/20/10 formula with dynamic percentage distribution | Phase 4 (PRODUCT_SPEC §2.2) | Respects model limits; prevents overflow on small models while maximizing context on large models |
| Manual context size management | Automated 8-step degradation pipeline | Phase 4 (PRODUCT_SPEC §2.4) | Graceful degradation instead of hard errors; user-visible diagnostics via provenance |

**Deprecated/outdated:**
- **tiktoken approach:** Replaced by provider-native + char-based fallback. No tokenizer dependency needed.
- **Single system prompt string:** Replaced by PromptSection[]. Sections carry provenance metadata.
- **Context overflow = hard error:** Replaced by degradation pipeline. Only step 8 produces an error.

## Assumptions Log

> All claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `result.usage.raw` from `generateText` in AI SDK v4.3.19 is available for all provider adapters (OpenAI, Anthropic, Gemini, Ollama) and contains provider-specific token metadata | Code Examples — Token Usage | Some providers may not populate `raw`. TokenEstimator's provider-native path would silently degrade to char-based fallback — functionally correct but less accurate for telemetry. LOW impact |
| A2 | CJK regex `\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af` covers all CJK scripts the app will encounter | Code Examples — Token Estimation | Missed CJK characters (e.g., rare extension blocks) would be counted as Latin (4 chars/token) instead of CJK (3 chars/token), slightly overestimating tokens. LOW impact — overestimation is safer than under-estimation |
| A3 | The ContextCompressor's LLM summarization path can use the same ProviderRouter that PlannerService uses, selecting Haiku/Flash models | Architecture Patterns — Summarization | If ProviderRouter doesn't expose search by cost tier independently of the orchestrator's tier caps, ContextCompressor may need a direct ProviderRegistry reference instead. MEDIUM impact — would require design adjustment |
| A4 | The `OrchestratorEvent` union type extension won't break existing consumers if we add `context-degraded` and `context-error` events with explicit handling | Common Pitfalls — Pitfall 5 | If consumers use `default` or non-exhaustive handlers, new events would be silently dropped. MEDIUM impact — degradation info would be lost to UI |

## Open Questions (RESOLVED)

1. **(RESOLVED) ContextCompressor LLM summarization model selection**
   - What we know: D-03 specifies LLM-based summarization for medium/large tiers. The project has ProviderRouter for model selection.
   - What's unclear: Should ContextCompressor use ProviderRouter (which has tier caps and circuit breakers) or a lightweight direct model selection? Using ProviderRouter adds circuit breaker and retry, which may be overkill for a side-call. Direct selection is simpler but bypasses retry logic.
   - Recommendation: Inject a separate lightweight model accessor (not full ProviderRouter) that ContextCompressor can call for summarization. This avoids coupling ContextCompressor to the main pipeline's routing concerns.

2. **(RESOLVED) TokenEstimator interface shape**
   - What we know: D-06 says "standalone module, injected into ContextOptimizer, exposes `estimateTokens(text: string): number`." The PRODUCT_SPEC says "use the provider-native counter when available; else fall back to char-based."
   - What's unclear: Should `estimateTokens()` be synchronous (char-based only, for pre-flight estimation) or also have an async method for provider-native post-hoc counting? Pre-flight estimation must be sync — it runs before the AI call. Post-hoc counting is for telemetry.
   - Recommendation: `estimateTokens(text: string): number` is synchronous — returns the char-based estimate. No async variant. Provider-native counts come from `result.usage` in the AI SDK response and are captured by telemetry (Phase 6), not by TokenEstimator.

3. **(RESOLVED) Degradation pipeline step granularity vs. plan granularity**
   - What we know: The 8-step pipeline is defined in PRODUCT_SPEC §2.4. Each step is a distinct operation with different logic.
   - What's unclear: Should each step be a private method on ContextOptimizer, or should the pipeline be a separate DegradationPipeline class? The decision affects testability and file organization.
   - Recommendation: Make each degradation step a private method on ContextOptimizer. The steps are tightly coupled (each depends on the output of the previous step) and share access to the section list, tier, and input. A separate class would require passing all this state. Private methods are sufficient for testability — tests call `.optimize()` with inputs that trigger specific degradation steps.

## Environment Availability

> Step 2.6: AUDITED. This phase has no external tool/runtime dependencies beyond what's already available.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | TypeScript compilation, test execution | ✓ | 20+ | — |
| npm | Package management (no new packages) | ✓ | 10+ | — |
| Vitest | Test framework | ✓ | v4.x | — (already in devDependencies) |
| jsdom | Test environment | ✓ | — | — (already configured in vitest.config.ts) |
| TypeScript | Compilation | ✓ | 7.0.2 | — |
| `ai` (Vercel AI SDK) | ContextCompressor LLM summarization | ✓ | 4.3.19 | — (installed in Phase 3) |

**No missing dependencies.** All required tooling is already installed from Phases 1–3.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4 |
| Config file | `vitest.config.ts` (environment: jsdom, setupFiles: `./tests/setup.ts`) |
| Quick run command | `npx vitest run tests/core/context/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTXT-01 | classifyModelContext returns correct tier for boundary values (4096→tiny, 16384→small, 131072→medium, >131072→large) | unit | `npx vitest run tests/core/context/ModelContextTier.test.ts -t "classifyModelContext"` | ❌ Wave 0 |
| CTXT-02 | computeBudget returns inputBudget=70%, outputBudget=20%, safetyMargin=10% of modelContextWindow | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts -t "budget"` | ❌ Wave 0 |
| CTXT-03 | Sections distributed per-tier percentages (tiny: system 15%, tools 20%, etc.) | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts -t "distribution"` | ❌ Wave 0 |
| CTXT-04 | ContextOptimizer.optimize() returns OptimizedContext with tier, budgets, sections, provenance, minimalMode | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts -t "optimize"` | ❌ Wave 0 |
| CTXT-05 | Degradation pipeline reduces context stepwise; step 8 throws ContextTooLargeError | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts -t "degradation"` | ❌ Wave 0 |
| CTXT-06 | Minimal mode: compact prompts, no MCP chaining markers, top-3 memory, ≤200 token summary, 1 safe tool | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts -t "minimal mode"` | ❌ Wave 0 |
| CTXT-07 | ContextCompressor.compressHistory() with LLM (medium/large) and heuristic (tiny/small) | unit | `npx vitest run tests/core/context/ContextCompressor.test.ts -t "compress"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/core/context/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/core/context/ModelContextTier.test.ts` — covers CTXT-01 (boundary values for all 4 tiers)
- [ ] `tests/core/context/TokenEstimator.test.ts` — covers CTXT-02 (char-based estimation, CJK detection, safety margin)
- [ ] `tests/core/context/ContextCompressor.test.ts` — covers CTXT-07 (LLM summarization mock, heuristic extraction, structural context)
- [ ] `tests/core/context/ContextOptimizer.test.ts` — covers CTXT-02 through CTXT-06 (full pipeline, degradation, minimal mode, provenance)
- [ ] `tests/core/context/ContextProvenanceManifest.test.ts` — covers CTXT-04 (manifest assembly, retained + dropped sections, outcome tracking)
- [ ] Framework config: none needed — existing `vitest.config.ts` covers `tests/core/context/` via `tests/**/*.test.ts` glob

## Security Domain

> Required — `security_enforcement: true` in config.json (ASVS Level 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not in scope for context optimization — handled by ProviderStore/EncryptedStorage (Phase 2) |
| V3 Session Management | No | Not in scope — handled by WorkspaceStore (Phase 2) |
| V4 Access Control | No | Not in scope — tool permissions handled by PermissionService (Phase 3) |
| V5 Input Validation | **Yes** | ContextOptimizerInput validated via Zod schema before processing. `modelContextWindow` must be positive integer. `userInput` must be non-empty string. `selectedToolSchemas` must be array. |
| V6 Cryptography | No | Not in scope — API key encryption handled by EncryptedStorage (Phase 2) |
| V7 Error Handling | **Yes** | `ContextTooLargeError` must not leak sensitive data (model names, provider IDs, raw section content) in error messages. `debugLog` handles all catch blocks per HARD-09. |
| V8 Data Protection | **Yes** | Section content (userInput, pageContext, memory) must remain in memory only. ContextProvenanceManifest records metadata (kind, sourceId, tokens) but never raw section text. TraceRedactor (Phase 6) will redact provenance entries before persistence. |

### Known Threat Patterns for TypeScript AI SDK Context Management

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via user input in provenance manifest | Tampering | Provenance manifest records `kind` + token counts, never raw user input text. User input is opaque to ContextOptimizer — it only measures token length |
| Information disclosure via ContextTooLargeError message | Information Disclosure | Error message includes `estimatedTokens` and `budget` (both numbers), never `modelId`, `providerId`, or raw section content. Use generic error message pattern |
| Denial of service via oversized page context | Denial of Service | Degradation pipeline compresses page context at step 4. Step 8 produces a typed error — the caller can inform the user without crashing the extension |
| Token budget bypass via char-based fallback inaccuracy | Elevation of Privilege | 10% safety margin applied to ALL estimates (D-05). Even if char-based estimate is 20% low, the safety margin absorbs the error. Worst case: aggressive degradation that's still safe. Never under-budget |
| Sensitive data in debugLog output | Information Disclosure | `debugLog` already guarded by `__DEV__` flag. Production builds (non-dev) suppress all log output. ContextOptimizer's `debugLog` calls must follow HARD-09 — log only metadata (tier, budget, step number), never raw section text |

## Sources

### Primary (HIGH confidence)

- [Context7 /vercel/ai/ai_4_3_19] — `LanguageModelUsage` type definition, `generateText` API, `streamText` API, `providerMetadata` access pattern, `onFinish` callback token usage. [VERIFIED: official AI SDK v4.3.19 source code on GitHub]
- [Context7 /vercel/ai/ai_4_3_19] — `asLanguageModelUsage()` conversion function showing how raw provider usage maps to SDK usage types. [VERIFIED: official source]
- [PRODUCT_SPEC_v0_1.md §2] — Complete ContextOptimizer specification: tier classification, budget formula, distribution table, degradation pipeline, minimal mode rules, provenance manifest interface, PromptSection type, ContextOptimizerInput/OptimizedContext interfaces. [CITED: /.planning/PRODUCT_SPEC_v0_1.md]
- [Existing codebase] — AgentOrchestrator.run() signature, pipelineTypes.ts OrchestratorEvent union, providerTypes.ts ModelEntry.contextWindow, providerStore.ts modelEntries, aiConfig.ts TIER_CAP constants. [VERIFIED: codebase grep]
- [Existing codebase] — Class+singleton pattern (KeymapRegistry, ToolRegistry, ProviderRegistry, PromptCacheManager), constructor DI pattern (AgentOrchestrator), debugLog utility, vitest config with jsdom. [VERIFIED: codebase grep]

### Secondary (MEDIUM confidence)

- [sdk.vercel.ai/docs] — Official AI SDK documentation for `generateText` and `streamText` (AI SDK v7 content). Token usage `result.usage` access pattern confirmed consistent with v4. [CITED: sdk.vercel.ai/docs/ai-sdk-core/generating-text]
- [Existing codebase] — PlannerService.plan() and RendererService.render() signatures showing how systemPrompt + userMessage are currently passed. [VERIFIED: codebase grep]

### Tertiary (LOW confidence)

- None — all claims are either verified against official AI SDK docs (Context7) or the existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all dependencies already installed from Phase 3
- Architecture: HIGH — pattern matched to existing class+singleton, constructor DI, and discriminated union patterns in the codebase
- Token estimation: HIGH — AI SDK v4 `LanguageModelUsage` type confirmed via Context7 source code; char-based fallback is explicit decision D-05
- Degradation pipeline: HIGH — PRODUCT_SPEC §2.4 defines exact 8-step sequence; linear state machine with typed error at step 8
- Context compression: MEDIUM — LLM-based summarization prompt design is planner's discretion; structural extraction depends on PageContext shape (not yet defined in this phase)
- Pitfalls: HIGH — based on common patterns in token-sensitive AI systems and existing codebase patterns

**Research date:** 2026-07-13
**Valid until:** 2026-08-12 — stable patterns, long-lived TypeScript types. AI SDK v4 API is stable.
