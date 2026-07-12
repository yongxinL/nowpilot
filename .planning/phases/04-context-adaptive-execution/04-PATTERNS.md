# Phase 04: Context-Adaptive Execution - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 13 (10 new, 3 modified)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/context/contextTypes.ts` | utility | n/a (types + schemas) | `src/core/ai/providers/providerTypes.ts` | exact |
| `src/core/context/ModelContextTier.ts` | utility | transform | `src/core/ai/router/routerTypes.ts` + `src/core/ai/config/aiConfig.ts` | good |
| `src/core/context/TokenEstimator.ts` | service | transform | `src/core/ai/cache/PromptCacheManager.ts` | role-match |
| `src/core/context/ContextCompressor.ts` | service | transform + AI call | `src/core/ai/pipeline/RendererService.ts` | role-match |
| `src/core/context/ContextOptimizer.ts` | service | transform (pipeline) | `src/core/ai/pipeline/AgentOrchestrator.ts` | exact |
| `src/core/context/ContextProvenanceManifest.ts` | utility | transform | `src/core/ai/pipeline/pipelineTypes.ts` | good |
| `tests/core/context/ModelContextTier.test.ts` | test | n/a | `tests/core/ai/router/TierResolver.test.ts` | exact |
| `tests/core/context/TokenEstimator.test.ts` | test | n/a | `tests/core/ai/cache/PromptCacheManager.test.ts` | exact |
| `tests/core/context/ContextCompressor.test.ts` | test | n/a | `tests/core/ai/pipeline/AgentOrchestrator.test.ts` | good |
| `tests/core/context/ContextOptimizer.test.ts` | test | n/a | `tests/core/ai/pipeline/AgentOrchestrator.test.ts` | exact |
| `tests/core/context/ContextProvenanceManifest.test.ts` | test | n/a | `tests/core/ai/cache/PromptCacheManager.test.ts` | good |
| `src/core/ai/pipeline/AgentOrchestrator.ts` (MODIFY) | service | request-response | `itself` (add method + event emission) | exact |
| `src/core/ai/pipeline/pipelineTypes.ts` (MODIFY) | utility | n/a | `itself` (extend union) | exact |

---

## Pattern Assignments

### 1. `src/core/context/contextTypes.ts` (utility, types + schemas)

**Analog:** `src/core/ai/providers/providerTypes.ts` (exact match — shared types + Zod schemas module)

**Imports pattern** (line 1):
```typescript
import { z } from 'zod';
```

**Enum + type pattern** (lines 1-4):
```typescript
export const CostTier = z.enum(['haiku', 'flash', 'sonnet', 'opus']);
export type CostTierType = z.infer<typeof CostTier>;
```

**Interface export pattern** (lines 6-11):
```typescript
export interface DiscoveredModel {
  modelId: string;
  contextWindow?: number;
  supportsStructuredOutput?: boolean;
  supportsToolUse?: boolean;
}
```

**Zod schema pattern** (lines 43-60):
```typescript
export const modelEntrySchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  costTier: CostTier,
  contextWindow: z.number().int().positive(),
  modalities: z.object({
    text: z.boolean(),
    image: z.boolean(),
    toolUse: z.boolean(),
    structuredOutput: z.boolean(),
  }),
  rateLimit: z
    .object({
      requestsPerMinute: z.number().int().positive(),
      tokensPerMinute: z.number().int().positive(),
    })
    .optional(),
});
```

**Apply to `contextTypes.ts`:** Define `PromptSection`, `ContextOptimizerInput`, `OptimizedContext`, `ModelContextTier`, `ContextTooLargeError` class, and all Zod schemas for input validation (ASVS V5). Use `z.enum()` for discriminated union discriminators, `z.object()` for structured inputs, and `z.infer<>` for transparent type extraction.

**Typed error pattern** — no existing `extends Error` class in source. Use the pattern from RESEARCH.md (lines 254-269):
```typescript
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

---

### 2. `src/core/context/ModelContextTier.ts` (utility, pure function + types)

**Analog:** `src/core/ai/router/routerTypes.ts` (types-only export) + `src/core/ai/config/aiConfig.ts` (const assertions). Also `src/core/ai/router/TierResolver.ts` (class with injected dependency — but ModelContextTier is a pure function, so follow the simpler type-module pattern).

**Types-only export pattern** (`routerTypes.ts`, lines 1-17):
```typescript
export interface RouterConfig {
  preferredProviders: string[];
  tierAssignments: Record<string, string>;
  maxAttempts: number;
}
```

**Const assertion pattern** (`aiConfig.ts`, lines 5-9):
```typescript
export const AI_CONFIG = {
  timeout: DEFAULT_TIMEOUT_CONFIG,
  tierCap: { tiny: 1, small: 2, medium: 3, large: 5 } as const,
  maxFallbackAttempts: 3,
} as const;
```

**Pure function pattern** — no existing pure-function-only module. Follow the RESEARCH.md code example (lines 497-502):
```typescript
export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';

export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096) return 'tiny';
  if (contextWindow <= 16384) return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}
```

**Context source priority** (D-09) — also belongs in this module as a const:
```typescript
export const CONTEXT_SOURCE_PRIORITY = [
  'system_prompt',
  'user_message',
  'active_tool_results',
  'workspace_context',
  'recent_conversation_history',
  'relevant_memory',
  'page_case_context',
  'notes_metadata',
  'debug_data',
] as const;

export type ContextSourcePriority = (typeof CONTEXT_SOURCE_PRIORITY)[number];
```

---

### 3. `src/core/context/TokenEstimator.ts` (service, transform)

**Analog:** `src/core/ai/cache/PromptCacheManager.ts` (class + singleton export, private Map state, lightweight computation). Also `src/core/utils/RateLimiter.ts` (class with config in constructor).

**Import + class pattern** (`PromptCacheManager.ts`, lines 1-5):
```typescript
import { debugLog } from '../../utils/debugLog';
import type { CacheHint, CacheKey } from './cacheTypes';

const VALID_SECTIONS = new Set(['system-prompt', 'tool-schemas', 'preferences', 'memory']);
```

**Class with private fields** (`PromptCacheManager.ts`, lines 6-9):
```typescript
export class PromptCacheManager {
  #cacheKeys = new Map<string, CacheKey>();
  #sectionHints = new Map<string, CacheHint[]>();
  #keyCounter = 0;
```

**Singleton export** (`PromptCacheManager.ts`, line 88):
```typescript
export const promptCacheManager = new PromptCacheManager();
```

**RateLimiter config pattern** (`RateLimiter.ts`, lines 8-13):
```typescript
export interface RateLimiterConfig {
  capacity: number;
  refillRate: number;
}
```

**Apply to `TokenEstimator.ts`:**
- Class with no constructor dependencies (stateless). Exposes `estimateTokens(text: string): number` (synchronous).
- Private CJK regex constant at module level.
- `applySafetyMargin(estimatedTokens: number): number` as static or instance method.
- Singleton export: `export const tokenEstimator = new TokenEstimator();`
- Uses `debugLog` for edge cases (empty strings, extremely long inputs).

**Core pattern** — from RESEARCH.md (lines 470-486):
```typescript
const CJK_REGEX = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;

export function estimateTokens(text: string): number {
  const cjkCount = (text.match(CJK_REGEX) || []).length;
  const nonCjkCount = text.length - cjkCount;
  const estimated = Math.ceil(nonCjkCount / 4) + Math.ceil(cjkCount / 3);
  return estimated;
}

export function applySafetyMargin(estimatedTokens: number): number {
  return Math.ceil(estimatedTokens * 1.10);
}
```

---

### 4. `src/core/context/ContextCompressor.ts` (service, transform + AI call)

**Analog:** `src/core/ai/pipeline/AgentOrchestrator.ts` (constructor DI, async pipeline methods). Also `src/core/utils/RateLimiter.ts` (class with configurable config parameter).

**Constructor DI pattern** (`AgentOrchestrator.ts`, lines 44-49):
```typescript
export class AgentOrchestrator {
  private currentAbortManager: AbortManager | null = null;

  constructor(
    private planner: PlannerService,
    private executor: ExecutorService,
    private renderer: RendererService,
    private router: ProviderRouter,
  ) {}
```

**debugLog usage** (`AgentOrchestrator.ts`, lines 154-162):
```typescript
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      debugLog('info', '[AgentOrchestrator] Operation cancelled by user');
      yield { type: 'error', message: 'Operation cancelled' };
    } else {
      const message =
        err instanceof Error ? err.message : 'Unknown error in AgentOrchestrator';
      debugLog('error', '[AgentOrchestrator] Operation failed', { error: err });
      yield { type: 'error', message };
    }
  }
```

**Apply to `ContextCompressor.ts`:**
- Constructor accepts: a lightweight model accessor (not full ProviderRouter — see RESEARCH.md Open Questions #1). Alternatively, use a callback: `(modelId: string) => LanguageModel`.
- Exposes `compressHistory(messages, tier, model): Promise<string>` and `compressContext(pageContext): PageContext`.
- Private methods for heuristic compression (always sync), LLM-based summarization (async, only for medium/large tiers).
- Singleton export: `export const contextCompressor = new ContextCompressor(modelAccessor);`

**LLM call pattern** — follow RESEARCH.md (lines 438-462):
```typescript
import { generateText } from 'ai';

const SUMMARY_PROMPT = `Summarize the following conversation in ≤200 tokens. ...`;

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

---

### 5. `src/core/context/ContextOptimizer.ts` (service, pipeline coordinator)

**Analog:** `src/core/ai/pipeline/AgentOrchestrator.ts` (exact match — constructor DI, async pipeline method, private helper methods). Also `src/core/ai/providers/ProviderRegistry.ts` (class + singleton export, private Map fields, async methods).

**Full constructor DI + singleton pattern** (`AgentOrchestrator.ts` lines 37-49 + `ProviderRegistry.ts` line 226):
```typescript
export class AgentOrchestrator {
  private currentAbortManager: AbortManager | null = null;

  constructor(
    private planner: PlannerService,
    private executor: ExecutorService,
    private renderer: RendererService,
    private router: ProviderRouter,
  ) {}
  // ...
}

// ProviderRegistry.ts singleton:
export const providerRegistry = new ProviderRegistry();
```

**Private Map state** (`ProviderRegistry.ts`, lines 12-13):
```typescript
export class ProviderRegistry {
  #providers = new Map<string, ProviderConfig>();
  #instances = new Map<string, unknown>();
```

**debugLog pattern with prefix convention** (`ProviderRegistry.ts`, line 28):
```typescript
debugLog('info', '[ProviderRegistry] no persisted data found, starting empty');
```

**Apply to `ContextOptimizer.ts`:**
- Constructor accepts: `TokenEstimator`, `ContextCompressor`, provider lookup function `(providerId: string, modelId: string) => ModelEntry | undefined`.
- Exposes single `async optimize(input: ContextOptimizerInput): Promise<OptimizedContext>`.
- Private methods: `classifyTier()`, `computeBudget()`, `assessSections()`, `applyDegradation()` (the 8-step pipeline), `assembleManifest()`.
- Mostly stateless per D-07. Use `debugLog('[ContextOptimizer] ...')` prefix.
- Singleton export: `export const contextOptimizer = new ContextOptimizer(tokenEstimator, contextCompressor, getModelEntry);`

**Degradation pipeline pattern** — follow RESEARCH.md (lines 299-327):
```typescript
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

  // Steps 2-7 ...

  // Step 8: Still too large → error
  const estimatedTokens = this.totalEstimatedTokens(sections);
  throw new ContextTooLargeError(estimatedTokens, input.modelContextWindow);
}
```

**Error handling** (`AgentOrchestrator.ts`, lines 152-162):
```typescript
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      debugLog('info', '[AgentOrchestrator] Operation cancelled by user');
      yield { type: 'error', message: 'Operation cancelled' };
    } else {
      const message =
        err instanceof Error ? err.message : 'Unknown error in AgentOrchestrator';
      debugLog('error', '[AgentOrchestrator] Operation failed', { error: err });
      yield { type: 'error', message };
    }
  }
```
**Adapt for ContextOptimizer:** ContextOptimizer uses `try/catch` with `debugLog` for unexpected errors (HARD-09). The `ContextTooLargeError` is thrown intentionally as part of the degradation pipeline — the caller (AgentOrchestrator) catches it.

---

### 6. `src/core/context/ContextProvenanceManifest.ts` (utility, types + builder)

**Analog:** `src/core/ai/pipeline/pipelineTypes.ts` (discriminated union, Zod schemas, type exports). Also `src/core/ai/cache/cacheTypes.ts` (pure type exports with Zod).

**Zod + discriminated union pattern** (`pipelineTypes.ts`, lines 1-26):
```typescript
import { z } from 'zod';

export const PlannerAction = z.enum(['answer', 'run_tool', 'ask_clarification']);

export const PlannerDecision = z.object({
  action: PlannerAction,
  toolName: z.string().optional(),
  toolInput: z.record(z.string(), z.unknown()).optional(),
  reasoning: z.string(),
});

export type PlannerDecisionType = z.infer<typeof PlannerDecision>;

export type OrchestratorEvent =
  | { type: 'plan-created'; decision: PlannerDecisionType }
  | { type: 'tool-called'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; result: ToolExecutionResult }
  | { type: 'text-delta'; text: string }
  | { type: 'text-complete'; fullText: string }
  | { type: 'error'; message: string };
```

**Pure type export pattern** (`cacheTypes.ts`, lines 1-16):
```typescript
import { z } from 'zod';

export const CacheSection = z.enum(['system-prompt', 'tool-schemas', 'preferences', 'memory']);
export type CacheSectionType = z.infer<typeof CacheSection>;

export interface CacheHint {
  section: CacheSectionType;
  messageIndices: number[];
  ttl: number;
}

export interface CacheKey {
  providerId: string;
  hash: string;
  createdAt: number;
}
```

**Apply to `ContextProvenanceManifest.ts`:**
- Define `PromptSectionKind` as `z.enum([...])` covering all section types from D-14.
- Define `SectionProvenanceEntry` interface with `outcome` discriminator: `'kept' | 'truncated' | 'compressed' | 'dropped'`.
- Define `ContextProvenanceManifest` interface (operationId, tier, sections[], degradationSteps[], createdAt).
- Export `createManifest()` builder function.
- Use Zod for the output schema (`ContextProvenanceManifestSchema`).

---

### 7-11. Test Files (test, n/a)

**Analog:** `tests/core/ai/pipeline/AgentOrchestrator.test.ts` (complex orchestrator test with mocks), `tests/core/ai/cache/PromptCacheManager.test.ts` (simple class test), `tests/core/ai/router/TierResolver.test.ts` (simple pure-function test).

**Imports + describe/it/expect pattern** (`AgentOrchestrator.test.ts`, lines 1-9):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OrchestratorEvent, ToolExecutionResult, PlannerDecisionType } from '../../../../src/core/ai/pipeline/pipelineTypes';
import type { CostTierType } from '../../../../src/core/ai/providers/providerTypes';
import type { PlannerService } from '../../../../src/core/ai/pipeline/PlannerService';
import type { ExecutorService } from '../../../../src/core/ai/pipeline/ExecutorService';
import type { RendererService } from '../../../../src/core/ai/pipeline/RendererService';
import type { ProviderRouter } from '../../../../src/core/ai/router/ProviderRouter';
import { AgentOrchestrator } from '../../../../src/core/ai/pipeline/AgentOrchestrator';
```

**Mock factory pattern** (`AgentOrchestrator.test.ts`, lines 36-62):
```typescript
function createMockPlanner() {
  return {
    plan: vi.fn() as PlannerService['plan'],
  } as unknown as PlannerService;
}

function createMockExecutor() {
  return {
    execute: vi.fn() as ExecutorService['execute'],
  } as unknown as ExecutorService;
}
```

**beforeEach pattern** (`AgentOrchestrator.test.ts`, lines 89-112):
```typescript
describe('AgentOrchestrator', () => {
  let planner: ReturnType<typeof createMockPlanner>;
  let executor: ReturnType<typeof createMockExecutor>;
  let renderer: ReturnType<typeof createMockRenderer>;
  let router: ReturnType<typeof createMockRouter>;
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    planner = createMockPlanner();
    executor = createMockExecutor();
    renderer = createMockRenderer();
    router = createMockRouter();
    orchestrator = new AgentOrchestrator(planner, executor, renderer, router);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
```

**vi.hoisted() for AI SDK mocks** (`PlannerService.test.ts`, line 5):
```typescript
const mockGenerateText = vi.hoisted(() => vi.fn());
```

**Singleton test pattern** (`PromptCacheManager.test.ts`, lines 112-119):
```typescript
describe('singleton', () => {
  it('exports a singleton alongside the class', async () => {
    const mod = await import('../../../../src/core/ai/cache/PromptCacheManager');
    expect(mod.promptCacheManager).toBeDefined();
    expect(mod.promptCacheManager).toBeInstanceOf(PromptCacheManager);
  });
});
```

**Pure function test pattern** (`TierResolver.test.ts`, lines 1-4):
```typescript
import { describe, it, expect } from 'vitest';
import { TierResolver } from '../../../../src/core/ai/router/TierResolver';
import type { ProviderRegistry } from '../../../../src/core/ai/providers/ProviderRegistry';
```

**Apply per test file:**

| Test File | Follow Pattern From | Key Adaptations |
|-----------|-------------------|-----------------|
| `ModelContextTier.test.ts` | `TierResolver.test.ts` | Pure function tests — no mocks needed. Test boundary values: 4096→tiny, 4097→small, 16384→small, 16385→medium, 131072→medium, 131073→large |
| `TokenEstimator.test.ts` | `PromptCacheManager.test.ts` | Class+singleton test with `beforeEach(() => tokenEstimator = new TokenEstimator())`. Test CJK detection, safety margin, edge cases |
| `ContextCompressor.test.ts` | `AgentOrchestrator.test.ts` | Mock AI SDK `generateText` via `vi.hoisted()`. Test LLM summarization path and heuristic compression path |
| `ContextOptimizer.test.ts` | `AgentOrchestrator.test.ts` | Mock TokenEstimator + ContextCompressor. Test full pipeline: budget computation, degradation steps 1–8, minimal mode, provenance |
| `ContextProvenanceManifest.test.ts` | `PromptCacheManager.test.ts` | Test manifest assembly, retained + dropped sections, outcome tracking, Zod validation |

**Error assertion pattern** (`ToolRegistry.test.ts`, lines 29-33):
```typescript
it('register with duplicate name throws an error', () => {
  registry.register(createMockTool('echo'));
  expect(() => {
    registry.register(createMockTool('echo'));
  }).toThrow('Tool "echo" is already registered');
});
```

**Async event collection helper** (`AgentOrchestrator.test.ts`, lines 14-22):
```typescript
async function collectEvents(
  gen: AsyncGenerator<OrchestratorEvent>,
): Promise<OrchestratorEvent[]> {
  const events: OrchestratorEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}
```

---

### 12. `src/core/ai/pipeline/AgentOrchestrator.ts` (MODIFY — add `runWithContext()`)

**Analog:** The file itself — extend with a new method following the existing `run()` pattern.

**Existing signature** (lines 62-67):
```typescript
async *run(
  userMessage: string,
  systemPrompt: string,
  tier: CostTierType,
  preferredProviders: string[],
): AsyncGenerator<OrchestratorEvent> {
```

**New method:** Add `runWithContext(optimizedContext: OptimizedContext)` as the canonical path. Internally:
1. Extract tier from `optimizedContext.tier`
2. Distribute `optimizedContext.sections` per-stage (D-02)
3. Inspect `optimizedContext.provenance` for degradation decisions
4. Emit degradation events per D-11 contract (silent for minor, info for significant, warning for minimal mode)

**Degradation event emission** — follow the existing event yield pattern (lines 92, 105-109, 117-120):
```typescript
yield { type: 'plan-created', decision };

yield {
  type: 'tool-called',
  toolName: decision.toolName,
  input: decision.toolInput,
};

yield {
  type: 'tool-result',
  toolName: decision.toolName,
  result,
};
```

**Error yielding pattern** (lines 156, 161):
```typescript
yield { type: 'error', message: 'Operation cancelled' };
yield { type: 'error', message };
```

**Keep existing `run()` temporarily** for migration. New code paths use `runWithContext()`. Extract shared logic into private methods (e.g., `buildPlannerPrompt` is already private). Add `inspectProvenance()` and `emitDegradationEvents()` private methods.

**AbortManager integration** — `runWithContext()` must create an `AbortManager` exactly like `run()` does (lines 68-70):
```typescript
const abortManager = new AbortManager();
this.currentAbortManager = abortManager;
```

---

### 13. `src/core/ai/pipeline/pipelineTypes.ts` (MODIFY — extend OrchestratorEvent)

**Analog:** The file itself — extend the `OrchestratorEvent` union.

**Existing union** (lines 20-26):
```typescript
export type OrchestratorEvent =
  | { type: 'plan-created'; decision: PlannerDecisionType }
  | { type: 'tool-called'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; result: ToolExecutionResult }
  | { type: 'text-delta'; text: string }
  | { type: 'text-complete'; fullText: string }
  | { type: 'error'; message: string };
```

**Add degradation events** after `{ type: 'error'; message: string }`:
```typescript
  // Phase 4: Context-Adaptive Execution degradation notifications
  | { type: 'context-degraded'; level: 'info' | 'warning'; message: string; step?: number }
  | { type: 'context-error'; code: 'CONTEXT_TOO_LARGE'; estimatedTokens: number; budget: number }
```

**Grep consumers before committing** — the CONTEXT.md mentions this pitfall (Pitfall 5, RESEARCH.md lines 395-403): search for all files that consume `OrchestratorEvent`:
```bash
grep -r "OrchestratorEvent" --include="*.ts" --include="*.tsx" src/
```
Add explicit handling for `context-degraded` and `context-error` in every consumer. Prefer exhaustive switch/if-else over default clauses.

---

## Shared Patterns

### debugLog Convention
**Source:** `src/core/utils/debugLog.ts` (lines 1-22)
**Apply to:** All new source files (ContextOptimizer, TokenEstimator, ContextCompressor, ModelContextTier, ContextProvenanceManifest)

```typescript
import { debugLog } from '../utils/debugLog';

// Usage: prefix with module name in brackets
debugLog('info', '[ContextOptimizer] optimization complete', { tier, budget, sections: sections.length });
debugLog('error', '[ContextOptimizer] optimization failed', { error: err });
debugLog('warn', '[ContextOptimizer] degradation step applied', { step: 3, before: prevTokens, after: currTokens });
```

**Rule (HARD-09):** All catch blocks must call `debugLog`. Production builds (non-`__DEV__`) suppress all log output.

### Singleton Export Pattern
**Source:** `src/core/ai/cache/PromptCacheManager.ts` (line 88), `src/core/ai/providers/ProviderRegistry.ts` (line 226), `src/core/ai/tools/ToolRegistry.ts` (line 30)
**Apply to:** ContextOptimizer, TokenEstimator, ContextCompressor

```typescript
export const contextOptimizer = new ContextOptimizer(
  tokenEstimator,
  contextCompressor,
  getModelEntry,
);
```

### Constructor Dependency Injection
**Source:** `src/core/ai/pipeline/AgentOrchestrator.ts` (lines 44-49)
**Apply to:** ContextOptimizer, ContextCompressor

```typescript
constructor(
  private tokenEstimator: TokenEstimator,
  private compressor: ContextCompressor,
  private getModelEntry: (providerId: string, modelId: string) => ModelEntry | undefined,
) {}
```

### Type Imports
**Source:** `src/core/ai/pipeline/AgentOrchestrator.ts` (lines 4-10)
**Apply to:** All new source files

```typescript
import type { PlannerService } from './PlannerService';
import type { ExecutorService } from './ExecutorService';
import type { RendererService } from './RendererService';
import type { ProviderRouter } from '../router/ProviderRouter';
import type { OrchestratorEvent, ToolExecutionResult } from './pipelineTypes';
import type { PlannerDecisionType } from './pipelineTypes';
import type { CostTierType } from '../providers/providerTypes';
```

**Rule:** Use `import type` for all type-only imports. Use direct path imports (no barrel/index files).

### File Organization
**Source:** `src/core/ai/pipeline/` directory structure
**Apply to:** `src/core/context/`

```
src/core/context/
├── ModelContextTier.ts           # Types + pure function (no deps)
├── TokenEstimator.ts             # Class + singleton (lightweight)
├── ContextCompressor.ts          # Class + singleton (depends on AI SDK)
├── ContextOptimizer.ts           # Class + singleton (depends on all above)
├── ContextProvenanceManifest.ts  # Types + builder functions
└── contextTypes.ts               # Shared types + Zod schemas (depended on by all)
```

**Rule:** `contextTypes.ts` has no intra-module dependencies. `ModelContextTier.ts` imports types from `contextTypes.ts`. Everything else imports from `contextTypes.ts` and sibling modules.

### Test File Organization
**Source:** `tests/core/ai/` directory structure
**Apply to:** `tests/core/context/`

```
tests/core/context/
├── ModelContextTier.test.ts
├── TokenEstimator.test.ts
├── ContextCompressor.test.ts
├── ContextOptimizer.test.ts
└── ContextProvenanceManifest.test.ts
```

**Rule:** Vitest discovers via `tests/**/*.test.ts` glob in `vitest.config.ts`. Environment: jsdom, setup: `./tests/setup.ts`.

---

## Pattern For: CONTEXT_TOO_LARGE Typed Error

**No existing analog:** No custom `extends Error` classes exist in this codebase. Use the greenfield pattern from RESEARCH.md (lines 254-269):

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

**Usage:** Thrown by `ContextOptimizer.applyDegradation()` at step 8. Caught by `AgentOrchestrator.runWithContext()` which yields `{ type: 'context-error', code: 'CONTEXT_TOO_LARGE', ... }`.

**Security:** Error message includes only token counts (numbers), never model IDs, provider IDs, or raw section content. Follows ASVS V7 (RESEARCH.md lines 642-643).

---

## No Analog Found

No files without analogs. All 13 files have close analogs in the existing codebase. The only genuinely new pattern is the typed error class (`ContextTooLargeError`), which follows a well-known TypeScript convention and has a RESEARCH.md code example.

---

## Metadata

**Analog search scope:** `src/core/ai/`, `src/core/commands/`, `src/core/utils/`, `tests/core/ai/`, `tests/core/`
**Files scanned:** 42 files (glob + read)
**Pattern extraction date:** 2026-07-13
**Key reference files:**
- `src/core/ai/pipeline/AgentOrchestrator.ts` — primary analog (constructor DI, async pipeline, error handling, debugLog)
- `src/core/ai/providers/ProviderRegistry.ts` — class+singleton, private Maps, async methods
- `src/core/ai/providers/providerTypes.ts` — Zod schemas, interface exports, `z.infer<>` pattern
- `src/core/ai/cache/PromptCacheManager.ts` — class+singleton, private state, singleton export test
- `src/core/ai/pipeline/pipelineTypes.ts` — discriminated union extension point
- `tests/core/ai/pipeline/AgentOrchestrator.test.ts` — mock factories, beforeEach, vi.hoisted, collectEvents
- `tests/core/ai/cache/PromptCacheManager.test.ts` — class test, singleton test pattern
- `tests/core/ai/router/TierResolver.test.ts` — pure function test, boundary value tests
