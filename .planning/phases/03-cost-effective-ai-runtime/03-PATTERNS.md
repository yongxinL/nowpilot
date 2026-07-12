# Phase 03: Cost-Effective AI Runtime - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 33 (30 new + 3 modified)
**Analogs found:** 26 / 33

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/ai/providers/ProviderRegistry.ts` | registry | CRUD (Map) | `src/core/commands/keymapRegistry.ts` | exact |
| `src/core/ai/providers/providerTypes.ts` | types | N/A | `src/core/storage/WriteJournalEntry.ts` | role-match |
| `src/core/ai/providers/modelDiscovery.ts` | utility | request-response (HTTP) | `src/core/storage/EncryptedStorage.ts` | partial (async class + error handling) |
| `src/core/ai/providers/adapters/openaiAdapter.ts` | factory | transform | — | no analog (thin factory, pure function) |
| `src/core/ai/providers/adapters/anthropicAdapter.ts` | factory | transform | — | no analog (thin factory, pure function) |
| `src/core/ai/providers/adapters/googleAdapter.ts` | factory | transform | — | no analog (thin factory, pure function) |
| `src/core/ai/providers/adapters/openaiCompatAdapter.ts` | factory | transform | — | no analog (thin factory, pure function) |
| `src/core/ai/router/ProviderRouter.ts` | service | request-response | `src/core/storage/WriteJournal.ts` | partial (class with DI constructor) |
| `src/core/ai/router/TierResolver.ts` | resolver | lookup | `src/core/utils/RateLimiter.ts` | partial (config-driven class) |
| `src/core/ai/router/CircuitBreaker.ts` | utility | state-machine | `src/core/utils/RateLimiter.ts` | role-match (stateful utility, no singleton) |
| `src/core/ai/router/routerTypes.ts` | types | N/A | `src/core/storage/WriteJournalEntry.ts` | role-match |
| `src/core/ai/pipeline/PlannerService.ts` | service | LLM-call | `src/core/storage/stores/AITransactionLogDB.ts` | partial (async class with DI) |
| `src/core/ai/pipeline/ExecutorService.ts` | service | deterministic | `src/core/storage/stores/AITransactionLogDB.ts` | partial (async class with DI) |
| `src/core/ai/pipeline/RendererService.ts` | service | streaming | — | no analog (streaming service is new) |
| `src/core/ai/pipeline/AgentOrchestrator.ts` | orchestrator | event-driven | — | no analog (event-driven orchestrator is new) |
| `src/core/ai/pipeline/StructuredOutput.ts` | utility | transform | `src/core/utils/debugLog.ts` | partial (pure function utility) |
| `src/core/ai/pipeline/pipelineTypes.ts` | types | N/A | `src/core/storage/WriteJournalEntry.ts` | role-match |
| `src/core/ai/tools/ToolRegistry.ts` | registry | CRUD (Map) | `src/core/commands/keymapRegistry.ts` | exact |
| `src/core/ai/tools/ToolDefinition.ts` | types | N/A | `src/core/storage/WriteJournalEntry.ts` | role-match |
| `src/core/ai/tools/PermissionService.ts` | service | request-response | `src/core/storage/stores/AITransactionLogDB.ts` | partial (class with singleton, async pattern) |
| `src/core/ai/tools/fixtures/echoTool.ts` | fixture | deterministic | — | no analog (fixture tool is new) |
| `src/core/ai/tools/fixtures/counterTool.ts` | fixture | deterministic | — | no analog |
| `src/core/ai/tools/fixtures/getTimeTool.ts` | fixture | deterministic | — | no analog |
| `src/core/ai/streaming/ChunkBuffer.ts` | utility | streaming (browser) | `src/core/utils/RateLimiter.ts` | role-match (no-singleton utility class) |
| `src/core/ai/streaming/AbortManager.ts` | utility | event-driven | `src/core/utils/RateLimiter.ts` | partial (stateful utility class) |
| `src/core/ai/streaming/TimeoutConfig.ts` | config | N/A | `src/core/utils/RateLimiter.ts` (config interface) | partial (config interface pattern) |
| `src/core/ai/cache/PromptCacheManager.ts` | manager | transform | `src/core/storage/EncryptedStorage.ts` | role-match (class+singleton, Map-based) |
| `src/core/ai/cache/PromptCacheAdapter.ts` | adapter | transform | `src/core/stores/providerStore.ts` (storage adapter) | partial (adapter pattern) |
| `src/core/ai/cache/cacheTypes.ts` | types | N/A | `src/core/storage/WriteJournalEntry.ts` | role-match |
| `src/core/ai/config/aiConfig.ts` | config | N/A | `src/core/utils/RateLimiter.ts` (config interface) | partial (config constants pattern) |
| `src/core/stores/providerStore.ts` (MODIFY) | store | CRUD (Zustand) | same file | exact |
| `src/core/stores/workspaceStore.ts` (MODIFY) | store | CRUD (Zustand) | same file | exact |
| `src/entrypoints/background.ts` (MODIFY) | entrypoint | N/A | same file | exact |

---

## Pattern Assignments

### 1. `src/core/ai/providers/ProviderRegistry.ts` (registry, CRUD Map)

**Analog:** `src/core/commands/keymapRegistry.ts` (exact match)

**Imports pattern** (line 1):
```typescript
import { debugLog } from '../utils/debugLog';
```

**Class + singleton export pattern** (lines 12-44):
```typescript
export class KeymapRegistry {
  private commands = new Map<string, CommandDefinition>();

  register(command: CommandDefinition): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command "${command.id}" is already registered`);
    }
    this.commands.set(command.id, command);
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  getCommand(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  getAllCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }
}

export const keymapRegistry = new KeymapRegistry();
```

**Pattern to apply:**
- `private #mapField = new Map<K, V>()` using JS private fields (`#`)
- `register()`, `get()`, `has()`, `list()` methods
- Export class (for testing) AND `export const providerRegistry = new ProviderRegistry()` singleton
- For ProviderRegistry: add `initialize()` (async, loads from chrome.storage.local) and `persist()` methods

**Also see:** `src/core/registries/SidepanelPageRegistry.ts` (lines 11-35) for an alternative registry pattern with `getAll()` sorting.

---

### 2. `src/core/ai/providers/providerTypes.ts` (types, static)

**Analog:** `src/core/storage/WriteJournalEntry.ts` (lines 1-63)

**Type + Zod schema pattern:**
```typescript
import { z } from 'zod';

export type WriteJournalOperation =
  | 'update-workspace'
  | 'append-memory-message'
  | 'evict-conversation';

export interface WriteJournalEntry {
  id: string;
  operation: WriteJournalOperation;
  status: 'pending' | 'applying' | 'completed' | 'failed' | 'rolled-back';
  createdAt: number;
  updatedAt: number;
  attempts: number;
  targetIds: Record<string, string>;
  steps: WriteJournalSteps[];
}

export const writeJournalEntrySchema = z.object({
  id: z.string().min(1),
  operation: z.enum([...]),
  status: z.enum([...]),
  createdAt: z.number(),
  // ...
});
```

**Pattern to apply:**
- TypeScript `interface` for types consumed by services
- Co-located Zod v4 `z.object()` for runtime validation (NOT AI SDK schemas — pure Zod v4)
- `z.enum()` for string literal unions (e.g., `CostTier = z.enum(['haiku', 'flash', 'sonnet', 'opus'])`)
- Types export: `ProviderConfig`, `ModelEntry`, `CostTier`, `ModelCapabilities`
- No default exports — named exports only

---

### 3. `src/core/ai/providers/modelDiscovery.ts` (utility, HTTP fetch)

**Analog:** `src/core/storage/EncryptedStorage.ts` (lines 10-89) — class+singleton + async initialization pattern

**Async initialization + error pattern** (lines 14-34):
```typescript
async initialize(): Promise<void> {
  const installSecret = await this.getOrCreateInstallSecret();
  // ... async setup ...
  this.initialized = true;
  debugLog('info', '[EncryptedStorage] initialized');
}

private async ensureInitialized(): Promise<void> {
  if (!this.initialized) await this.initialize();
}
```

**Error handling with debugLog** (from `src/core/storage/stores/AITransactionLogDB.ts` lines 15-21):
```typescript
try {
  const db = await getDB();
  await db.put('transaction_log_transactions', tx);
} catch (err) {
  debugLog('error', 'AITransactionLogDB.logTransaction failed', { error: err });
}
```

**Pattern to apply:**
- Export class + singleton: `export const modelDiscovery = new ModelDiscovery()`
- `async discover(endpoint: string, apiKey: string): Promise<DiscoveredModel[]>`
- Try OpenAI-compatible `/v1/models` first, fall back to Ollama `/api/tags` on 404
- All `catch` blocks call `debugLog('error', ...)` with contextual message + `{ error: err }`
- Return normalized `DiscoveredModel[]` — never throw to caller on discovery failure (return empty array)

---

### 4. `src/core/ai/providers/adapters/*.ts` (4 adapter factory files)

**Analog:** NONE — these are thin factory functions wrapping `@ai-sdk/*` providers. Follow RESEARCH.md Code Examples directly.

**Pattern to apply (from RESEARCH.md lines 446-457):**
```typescript
// src/core/ai/providers/adapters/openaiAdapter.ts
import { createOpenAI } from '@ai-sdk/openai';

export function createOpenAIAdapter(apiKey: string, baseURL?: string) {
  return createOpenAI({
    apiKey,
    baseURL, // undefined = default OpenAI
  });
}
```

- Pure function, no class needed
- Named export only (no default export)
- No error handling — AI SDK constructor validates inputs
- No `debugLog` call (caller logs)

**No analog found** — planner should reference RESEARCH.md Code Examples section (lines 446-457) and AI SDK v4 docs.

---

### 5. `src/core/ai/router/ProviderRouter.ts` (service, request-response)

**Analog:** `src/core/storage/WriteJournal.ts` (lines 6-218) — class with DI constructor + singleton

**Constructor DI pattern** (WriteJournal has implicit constructor, RateLimiter has explicit config DI):
```typescript
// From src/core/utils/RateLimiter.ts lines 24-35
export class RateLimiter {
  private tokens: number;
  private readonly capacity: number;

  constructor(config: RateLimiterConfig) {
    this.capacity = config.capacity;
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
    this.refillIntervalMs = 1000 / config.refillRate;
  }
}
```

**Error/debugLog pattern** (from `src/core/storage/WriteJournal.ts` lines 35, 89, 102):
```typescript
debugLog('debug', 'WriteJournal: entry created', { id, operation });
debugLog('debug', 'WriteJournal: entry completed', { id: entryId });
debugLog('error', 'WriteJournal: entry failed', { id: entryId });
```

**Pattern to apply:**
- Constructor DI: `constructor(private registry: ProviderRegistry, private breaker: CircuitBreaker)`
- Export class AND singleton: `export const providerRouter = new ProviderRouter(providerRegistry, circuitBreaker)`
- All methods async, using try/catch with `debugLog`
- Fallback chain capped at 3 attempts per D-11
- Integrates with `CircuitBreaker.isOpen()` before each attempt

---

### 6. `src/core/ai/router/TierResolver.ts` (resolver, lookup)

**Analog:** `src/core/utils/RateLimiter.ts` — config-driven class with no external dependencies

**Pattern to apply:**
- Constructor takes config object: `new TierResolver(registry: ProviderRegistry, config: TierResolverConfig)`
- Pure lookup logic — no async, no side effects, no external calls
- Returns `{ providerId, modelId } | null` from registry model list
- Class export only (no singleton — created by ProviderRouter internally or DI)

**No separate analog** — pattern mirrors RateLimiter's config-driven constructor but with simpler lookup logic.

---

### 7. `src/core/ai/router/CircuitBreaker.ts` (utility, state-machine)

**Analog:** `src/core/utils/RateLimiter.ts` (lines 24-68) — **exact role match** (stateful utility, no singleton)

**Configuration + private fields pattern** (lines 24-35):
```typescript
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillIntervalMs: number;

  constructor(config: RateLimiterConfig) {
    this.capacity = config.capacity;
    this.tokens = config.capacity;
    // ...
  }
}
```

**No-singleton export:** `RateLimiter` is exported as class only — consumers create their own instances.

**Pattern to apply:**
- Export class only (no singleton — one instance per ProviderRouter)
- Constructor sets thresholds: `FAILURE_THRESHOLD = 3`, `FAILURE_WINDOW_MS = 60_000`, `COOLDOWN_MS = 5 * 60_000`
- Private `Map<string, ProviderCircuit>` for per-provider state
- `isOpen(providerId)`, `recordFailure(providerId)`, `recordSuccess(providerId)` methods
- No `debugLog` calls (CircuitBreaker is called by ProviderRouter which handles logging)
- State machine: CLOSED → OPEN → HALF_OPEN → CLOSED/OPEN

---

### 8. `src/core/ai/router/routerTypes.ts` (types)

**Same analog as #2:** `src/core/storage/WriteJournalEntry.ts`

**Pattern to apply:**
- `RouterConfig`, `FallbackChain`, `RetryPolicy` interfaces
- Optional Zod schemas for runtime validation if needed
- Named exports only

---

### 9. `src/core/ai/pipeline/PlannerService.ts` (service, LLM-call)

**Analog:** `src/core/storage/stores/AITransactionLogDB.ts` (lines 4-93) — async class with DI + singleton

**Class + singleton export** (lines 4, 93):
```typescript
export class AITransactionLogDB {
  async logTransaction(tx: { ... }): Promise<void> { ... }
}

export const aiTransactionLogDB = new AITransactionLogDB();
```

**Error handling pattern** (lines 15-21):
```typescript
try {
  const db = await getDB();
  await db.put('transaction_log_transactions', tx);
} catch (err) {
  debugLog('error', 'AITransactionLogDB.logTransaction failed', { error: err });
}
```

**Pattern to apply:**
- Constructor DI: `constructor(private router: ProviderRouter, private structuredOutput: StructuredOutput)`
- `async plan(model, systemPrompt, userMessage, abortSignal): Promise<PlannerDecision>`
- Uses `generateText` from `ai` (NOT `generateObject`)
- JSON output parsing: `jsonrepair()` → `JSON.parse()` → Zod v4 `safeParse()`
- One-shot repair retry on parse failure → fallback `{ action: 'answer' }`
- All errors logged via `debugLog`
- Export class + singleton

---

### 10. `src/core/ai/pipeline/ExecutorService.ts` (service, deterministic)

**Same analog as #9:** `src/core/storage/stores/AITransactionLogDB.ts` — async class with DI + singleton

**Pattern to apply:**
- Constructor DI: `constructor(private toolRegistry: ToolRegistry, private permissionService: PermissionService)`
- `async execute(toolName, toolInput, abortSignal): Promise<ToolExecutionResult>`
- Deterministic flow: validate tool name → permission check → Zod v4 input validation → execute → Zod v4 output validation
- Structured error returns (never throw for tool-level failures; throw only for infrastructure failures)
- Export class + singleton

---

### 11. `src/core/ai/pipeline/RendererService.ts` (service, streaming)

**No analog found** — this is the first streaming service in the codebase.

**Pattern to apply (from RESEARCH.md Code Examples lines 576-608):**
```typescript
import { streamText } from 'ai';

export async function* renderStream(
  model: any,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  abortSignal: AbortSignal,
): AsyncGenerator<OrchestratorEvent> { ... }
```

- Async generator function (not class — simpler than pipeline services)
- Uses `streamText` from `ai`
- `onChunk` callback for ChunkBuffer integration
- `maxTokens: 512`, `abortSignal` for timeout
- Export class + singleton for DI: `constructor(private router: ProviderRouter)`

**No analog found** — planner should reference RESEARCH.md Code Examples lines 576-608.

---

### 12. `src/core/ai/pipeline/AgentOrchestrator.ts` (orchestrator, event-driven)

**No analog found** — this is the first event-driven orchestrator in the codebase.

**Pattern to apply (from RESEARCH.md Code Examples lines 843-896):**
```typescript
export type OrchestratorEvent =
  | { type: 'plan-created'; decision: PlannerDecision }
  | { type: 'tool-called'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; result: ToolExecutionResult }
  | { type: 'text-delta'; text: string }
  | { type: 'text-complete'; fullText: string }
  | { type: 'error'; message: string };

export class AgentOrchestrator {
  async *run(...): AsyncGenerator<OrchestratorEvent> { ... }
}
```

- Constructor DI: `constructor(private planner, private executor, private renderer, private router)`
- Async generator method (`async *run`)
- Tier caps: tiny=1, small=2, medium=3, large=5
- Loop: Planner → Executor → (repeat up to tier cap) → Renderer
- Integration with AbortManager for stage timeouts
- Export class + singleton

**No analog found** — planner should reference RESEARCH.md Code Examples lines 830-896.

---

### 13. `src/core/ai/pipeline/StructuredOutput.ts` (utility, transform)

**Analog:** `src/core/utils/debugLog.ts` (lines 1-22) — pure function utility module

**Pattern to apply:**
```typescript
// Pure function, no class
export function repairAndValidate(text: string, schema: z.ZodType): { result: T } | { fallback: FallbackDecision } {
  // jsonrepair → JSON.parse → Zod safeParse
}
```

- Pure function (no class, no state)
- Import `jsonrepair` + `z` from `zod`
- Named export only
- No `debugLog` (caller logs)

**No exact analog** — planner should reference RESEARCH.md Code Examples lines 460-513 and the `debugLog.ts` functional module pattern.

---

### 14. `src/core/ai/pipeline/pipelineTypes.ts` (types)

**Same analog as #2:** `src/core/storage/WriteJournalEntry.ts`

**Pattern to apply:**
- `PlannerDecision = z.object({ action: z.enum([...]), toolName: z.string().optional(), ... })`
- `ToolExecutionResult`, `OrchestratorEvent` (discriminated union)
- Named exports only, no default export

---

### 15. `src/core/ai/tools/ToolRegistry.ts` (registry, CRUD Map)

**Analog:** `src/core/commands/keymapRegistry.ts` (lines 12-44) — **exact match**

**Class + Map-based registry pattern:**
```typescript
export class KeymapRegistry {
  private commands = new Map<string, CommandDefinition>();

  register(command: CommandDefinition): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command "${command.id}" is already registered`);
    }
    this.commands.set(command.id, command);
  }

  getCommand(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  getAllCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }
}

export const keymapRegistry = new KeymapRegistry();
```

**Pattern to apply (EXACT copy of KeymapRegistry structure):**
```typescript
export class ToolRegistry {
  #tools = new Map<string, ToolDefinition>();  // Use JS private fields (#) per modern conventions

  register(tool: ToolDefinition): void {
    if (this.#tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.#tools.set(tool.name, tool);
  }

  unregister(name: string): void { this.#tools.delete(name); }

  get(name: string): ToolDefinition | undefined { return this.#tools.get(name); }
  has(name: string): boolean { return this.#tools.has(name); }
  list(): ToolDefinition[] { return Array.from(this.#tools.values()); }
}

export const toolRegistry = new ToolRegistry();
```

---

### 16. `src/core/ai/tools/ToolDefinition.ts` (types)

**Same analog as #2:** `src/core/storage/WriteJournalEntry.ts`

**Pattern to apply (from RESEARCH.md code pattern, adapted to project conventions):**
```typescript
import { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  execute: (input: unknown, context: { abortSignal: AbortSignal }) => Promise<unknown>;
  // Permissions
  requiresPermission?: boolean;
  category?: 'safe' | 'sensitive' | 'dangerous';
}
```

- `ToolDefinition` interface — NOT Zod schema (tools are registered as plain objects)
- Zod v4 `z.ZodType` (NOT `z.Schema`) for input/output schemas
- Named export only

---

### 17. `src/core/ai/tools/PermissionService.ts` (service, request-response)

**Analog:** `src/core/storage/stores/AITransactionLogDB.ts` (lines 4-93) — class + singleton, async pattern

**Class + singleton export** (lines 4, 93):
```typescript
export class AITransactionLogDB { ... }
export const aiTransactionLogDB = new AITransactionLogDB();
```

**Pattern to apply:**
```typescript
export interface PermissionService {
  canExecute(toolName: string, toolInput: Record<string, unknown>): Promise<boolean>;
}

export class DefaultPermissionService implements PermissionService {
  async canExecute(toolName: string, _toolInput: Record<string, unknown>): Promise<boolean> {
    // Default-deny for dangerous tools; allow known safe fixtures
    return false;
  }
}

export const permissionService = new DefaultPermissionService();
```

- Interface + default implementation pattern (per D-13)
- Default-deny: return `false` for all tools except test fixtures
- Phase 7 replaces implementation without changing interface
- Export class + singleton

---

### 18. `src/core/ai/tools/fixtures/*.ts` (fixture tools, 3 files)

**No analog found** — these are new fixture patterns. They define tool objects following ToolDefinition.

**Pattern to apply:**
```typescript
// src/core/ai/tools/fixtures/echoTool.ts
import { z } from 'zod';
import type { ToolDefinition } from '../ToolDefinition';

export const echoTool: ToolDefinition = {
  name: 'echo',
  description: 'Returns the input unchanged',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ echoed: z.string() }),
  category: 'safe',
  requiresPermission: false,
  execute: async (input, _context) => {
    const { text } = input as { text: string };
    return { echoed: text };
  },
};
```

- Plain object export (no class, no singleton)
- `const` named export: `export const echoTool: ToolDefinition = { ... }`
- Zod v4 schemas for input/output validation
- `category: 'safe'` → no permission check needed
- `context.abortSignal` forwarded to any async operations in execute

**No analog found** — planner should reference RESEARCH.md fixture tool patterns.

---

### 19. `src/core/ai/streaming/ChunkBuffer.ts` (utility, streaming/browser)

**Analog:** `src/core/utils/RateLimiter.ts` (lines 24-68) — **role match** (no-singleton utility class)

**Class pattern with private fields:**
```typescript
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;

  constructor(config: RateLimiterConfig) {
    this.capacity = config.capacity;
    // ...
  }

  tryAcquire(): RateLimitResult { ... }
  private refill(): void { ... }
}
```

**Pattern to apply (from RESEARCH.md lines 612-641):**
```typescript
export class ChunkBuffer {
  private buffer: string[] = [];
  private rafId: number | null = null;

  constructor(private onFlush: (text: string) => void) {}

  push(text: string): void {
    this.buffer.push(text);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.rafId !== null) return;
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

- No singleton export — consumers create instances
- Constructor takes callback (not config — consistent with RateLimiter constructor pattern but with callback DI)
- `requestAnimationFrame` — browser API (runs in sidepanel/standalone context only)
- Private methods for internal state management

---

### 20. `src/core/ai/streaming/AbortManager.ts` (utility, event-driven)

**Analog:** `src/core/utils/RateLimiter.ts` — stateful utility class, no singleton

**Pattern to apply:**
```typescript
export class AbortManager {
  readonly rootController = new AbortController();

  createStageTimeout(ms: number): AbortSignal {
    const stageController = new AbortController();
    const timeoutId = setTimeout(() => stageController.abort(new DOMException('Stage timeout', 'TimeoutError')), ms);
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

- No singleton export — created by orchestrator per-operation
- Web platform APIs: `AbortController`, `DOMException`
- No `debugLog` (caller logs)

**No exact analog** — the pattern follows RateLimiter's utility class structure but with Web APIs.

---

### 21. `src/core/ai/streaming/TimeoutConfig.ts` (config)

**Analog:** `src/core/utils/RateLimiter.ts` (lines 8-13) — config interface pattern

**Config interface pattern:**
```typescript
export interface RateLimiterConfig {
  capacity: number;
  refillRate: number;
}
```

**Pattern to apply:**
```typescript
// src/core/ai/streaming/TimeoutConfig.ts

export interface TimeoutConfig {
  planner: number;    // 3000ms
  executorTool: number; // 10000ms
  renderer: number;   // 5000ms
}

export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  planner: 3000,
  executorTool: 10000,
  renderer: 5000,
};
```

- Interface + default constants export
- Named exports only
- No class, no singleton — consumed via DI constructor or module parameter

---

### 22. `src/core/ai/cache/PromptCacheManager.ts` (manager, transform)

**Analog:** `src/core/storage/EncryptedStorage.ts` (lines 10-89) — class+singleton, async/Map-based

**Class + singleton export pattern** (lines 10, 90):
```typescript
export class EncryptedStorage {
  private initialized = false;

  async initialize(): Promise<void> { ... }
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize();
  }
}

export const encryptedStorage = new EncryptedStorage();
```

**Pattern to apply:**
- `class PromptCacheManager` with private state
- `identifyStableSections(prompt: string[]): Map<number, CacheHint>` — pure logic
- `invalidateCacheKey(reason: string): void` — cache key rotation
- Export class + singleton: `export const promptCacheManager = new PromptCacheManager()`
- All catch blocks call `debugLog`

---

### 23. `src/core/ai/cache/PromptCacheAdapter.ts` (adapter, transform)

**Analog:** `src/core/stores/providerStore.ts` (lines 19-30) — storage adapter pattern

**Adapter pattern (transparent wrapper):**
```typescript
const encryptedJSONStorage = createJSONStorage<ProviderState>(() => ({
  getItem: async (name: string) => {
    const value = await encryptedStorage.get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await encryptedStorage.set(name, JSON.parse(value));
  },
  removeItem: async (name: string) => {
    await encryptedStorage.remove(name);
  },
}));
```

**Pattern to apply:**
```typescript
export function applyAnthropicCache(messages, cacheHints: Map<number, boolean>) { ... }
export function applyOpenAICache(messages, cacheHints: Map<number, boolean>) { ... }
export function applyGoogleCache(messages, cacheHints: Map<number, boolean>) { ... }
```

- Pure functions (no class, no singleton)
- Translates provider-agnostic `CacheHint` → per-provider `providerOptions`
- One function per provider family
- Named exports only

---

### 24. `src/core/ai/cache/cacheTypes.ts` (types)

**Same analog as #2:** `src/core/storage/WriteJournalEntry.ts`

**Pattern to apply:**
- `CacheHint`, `CacheSection`, `CacheKey` interfaces/types
- Named exports only

---

### 25. `src/core/ai/config/aiConfig.ts` (config)

**Analog:** `src/core/utils/RateLimiter.ts` (config interface) + no existing config directory — use straightforward module export.

**Pattern to apply:**
```typescript
export const AI_CONFIG = {
  timeout: DEFAULT_TIMEOUT_CONFIG,
  tierCap: { tiny: 1, small: 2, medium: 3, large: 5 },
  maxFallbackAttempts: 3,
} as const;
```

- Named exports of constants
- Re-exports from `TimeoutConfig.ts`
- No class, no singleton — import and use directly

**No exact analog** — follow general TypeScript module export conventions.

---

### 26. `src/core/stores/providerStore.ts` (MODIFY, store)

**Analog:** Same file — existing Zustand v5 pattern

**Current pattern** (lines 1-48):
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { encryptedStorage } from '../storage/EncryptedStorage';

export interface ProviderState {
  selectedProvider: string | null;
  apiKeys: Record<string, string>;
  setSelectedProvider: (provider: string | null) => void;
  setApiKey: (provider: string, key: string) => void;
}

const encryptedJSONStorage = createJSONStorage<ProviderState>(() => ({
  getItem: async (name: string) => {
    const value = await encryptedStorage.get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await encryptedStorage.set(name, JSON.parse(value));
  },
  removeItem: async (name: string) => {
    await encryptedStorage.remove(name);
  },
}));

export const useProviderStore = create<ProviderState>()(
  persist(
    (set) => ({
      selectedProvider: null,
      apiKeys: {},
      setSelectedProvider: (selectedProvider) => set({ selectedProvider }),
      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),
    }),
    {
      name: 'np_providers',
      storage: encryptedJSONStorage,
    },
  ),
);
```

**Changes to apply:**
- Add model registry fields: `modelEntries: ModelEntry[]`, `providerPriority: string[]`, `tierAssignments: Record<string, string>`
- Continue using `encryptedJSONStorage` (API keys stay encrypted, model metadata stored with same mechanism)
- Import path: `../../core/ai/providers/providerTypes` (relative path, no barrel)
- Key persists as `'np_providers'` (unchanged)

---

### 27. `src/core/stores/workspaceStore.ts` (MODIFY, store)

**Analog:** Same file — existing Zustand v5 + WriteJournal pattern

**Current pattern** (lines 1-91):
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Surface } from '../navigation/navigationTypes';
import { writeJournal } from '../storage/WriteJournal';
```

**WriteJournal persistence pattern** (lines 29-62):
```typescript
const chromeLocalStorage = createJSONStorage<WorkspaceState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then(...),
  setItem: async (name: string, value: string) => {
    try {
      const entry = await writeJournal.begin('update-workspace', ...);
      // ... journal steps ...
    } catch {
      await chrome.storage.local.set({ [name]: value });
    }
  },
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));
```

**Changes to apply:**
- No structural changes — the existing `activeProvider`, `activeSkillRun`, `activeAddonContext` fields are already ready
- Phase 3 pipeline reads `activeProvider` for provider selection
- Key persists as `'np_workspace'` (unchanged)
- Use WriteJournal for any new persistent fields

---

### 28. `src/entrypoints/background.ts` (MODIFY, entrypoint)

**Analog:** Same file — existing background entrypoint pattern

**Current pattern** (lines 1-19):
```typescript
import { defineBackground } from 'wxt/utils/define-background';
import { debugLog } from '../core/utils/debugLog';

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener((details) => { ... });
  chrome.commands.onCommand.addListener((command) => { ... });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { ... });
});
```

**Changes to apply:**
- **Verification only** — ensure NO imports from `src/core/ai/` appear in this file (MV3 restriction)
- If any AI runtime imports exist, remove them
- No functional changes to the background SW logic

---

## Shared Patterns

### Authentication (API Keys)
**Source:** `src/core/stores/providerStore.ts` lines 19-30
**Apply to:** All provider adapter files, ProviderRegistry
```typescript
// Keys encrypted at rest via EncryptedStorage (AES-GCM-256)
const encryptedJSONStorage = createJSONStorage<ProviderState>(() => ({
  getItem: async (name: string) => {
    const value = await encryptedStorage.get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await encryptedStorage.set(name, JSON.parse(value));
  },
  removeItem: async (name: string) => {
    await encryptedStorage.remove(name);
  },
}));
```

### Error Handling (HARD-09)
**Source:** `src/core/storage/stores/AITransactionLogDB.ts` lines 15-21
**Apply to:** ALL service, manager, and utility files
```typescript
try {
  // ... operation ...
} catch (err) {
  debugLog('error', '[ModuleName] operation description failed', { error: err });
  // Return structured error or rethrow depending on context
}
```

### Class + Singleton Export
**Source:** `src/core/commands/keymapRegistry.ts` lines 12-44 + `src/core/storage/EncryptedStorage.ts` lines 10-90
**Apply to:** ProviderRegistry, ToolRegistry, PlannerService, ExecutorService, RendererService, AgentOrchestrator, PromptCacheManager, PermissionService, ProviderRouter
```typescript
export class ClassName {
  // ... implementation ...
}

export const className = new ClassName();
```

### Map-Based Registry
**Source:** `src/core/commands/keymapRegistry.ts` lines 13-31 + `src/core/registries/SidepanelPageRegistry.ts` lines 12-32
**Apply to:** ProviderRegistry, ToolRegistry, PromptCacheManager (internal)
```typescript
private #items = new Map<string, T>();

register(item: T): void {
  if (this.#items.has(item.id)) throw new Error(`...`);
  this.#items.set(item.id, item);
}

get(id: string): T | undefined { return this.#items.get(id); }
has(id: string): boolean { return this.#items.has(id); }
list(): T[] { return Array.from(this.#items.values()); }
```

### Zustand v5 Store (with persistence)
**Source:** `src/core/stores/providerStore.ts` lines 1-48 (encrypted) + `src/core/stores/workspaceStore.ts` lines 1-91 (WriteJournal)
**Apply to:** Modifications to providerStore, workspaceStore
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useStore = create<StateType>()(
  persist(
    (set) => ({ /* state + setters */ }),
    { name: 'np_key', storage: customStorageAdapter },
  ),
);
```

### Debug Logging
**Source:** `src/core/utils/debugLog.ts` lines 1-22
**Apply to:** ALL Phase 3 files
```typescript
import { debugLog } from '../utils/debugLog';  // relative path!

debugLog('info', '[ModuleName] message', { contextualData });
debugLog('error', '[ModuleName] error context', { error: err });
debugLog('warn', '[ModuleName] warning', { details });
```

### Direct Path Imports (No Barrel Files)
**Source:** ALL existing source files
**Apply to:** ALL Phase 3 files
```typescript
// CORRECT — relative path imports
import { debugLog } from '../utils/debugLog';
import { providerRegistry } from './providers/ProviderRegistry';

// WRONG — no barrel/index imports
// import { ProviderRegistry } from './providers';
```

### Test Infrastructure
**Source:** `tests/setup.ts` lines 1-92 + `tests/core/keymapRegistry.test.ts` lines 1-63
**Apply to:** ALL test files in `tests/core/ai/`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClassName } from '../../src/core/ai/module/fileName';

describe('ModuleName', () => {
  let instance: ClassName;

  beforeEach(() => {
    instance = new ClassName();
  });

  it('description of behavior', () => {
    // arrange → act → assert
  });
});
```

**Mocking pattern** (from tests/setup.ts and Phase 2 patterns):
- `vi.stubGlobal('chrome', { ... })` for Chrome APIs (already in tests/setup.ts)
- `vi.mock('ai', () => ({ generateText: vi.fn(), streamText: vi.fn() }))` for AI SDK
- Use `vi.hoisted()` for mock variables accessed in `vi.mock` factories
- Module-level `let` for singleton access in tests (consistent with Phase 2)
- Test files go in `tests/core/ai/` mirroring `src/core/ai/` structure

### NP_ Key Prefix Convention
**Source:** CONTEXT.md line 92 + `src/core/stores/workspaceStore.ts` line 88, `src/core/stores/providerStore.ts` line 44
**Apply to:** ProviderRegistry chrome.storage keys
```typescript
// New chrome.storage keys follow convention:
'np_provider_registry'   // ProviderRegistry model list
'np_cache_keys'          // PromptCacheManager cache keys
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md code examples instead):

| File | Role | Data Flow | Reason | RESEARCH.md Reference |
|------|------|-----------|--------|----------------------|
| `adapters/openaiAdapter.ts` | factory | transform | No factory pattern classes in codebase — pure functions wrapping AI SDK | Lines 446-457 |
| `adapters/anthropicAdapter.ts` | factory | transform | Same as above | Same pattern, different provider |
| `adapters/googleAdapter.ts` | factory | transform | Same as above | Same pattern, different provider |
| `adapters/openaiCompatAdapter.ts` | factory | transform | Same as above | Same pattern, different provider |
| `pipeline/RendererService.ts` | service | streaming | First streaming service — async generator pattern is new | Lines 576-608 |
| `pipeline/AgentOrchestrator.ts` | orchestrator | event-driven | First event-driven orchestrator — AsyncGenerator pattern is new | Lines 830-896 |
| `pipeline/StructuredOutput.ts` | utility | transform | First jsonrepair + Zod utility — pure function pattern | Lines 460-513 |
| `tools/fixtures/echoTool.ts` | fixture | deterministic | First fixture tool — plain object export with Zod schemas | D-12 patterns |
| `tools/fixtures/counterTool.ts` | fixture | deterministic | Same as above | D-12 patterns |
| `tools/fixtures/getTimeTool.ts` | fixture | deterministic | Same as above | D-12 patterns |
| `streaming/AbortManager.ts` | utility | event-driven | First AbortController manager — Web API pattern | Lines 643-669 |
| `streaming/TimeoutConfig.ts` | config | N/A | Simple config — use interface + defaults export pattern | D-19 + RateLimiter config pattern |
| `config/aiConfig.ts` | config | N/A | Simple constants module — no existing config dir to copy | D-19 + RateLimiter config pattern |

---

## Metadata

**Analog search scope:** `src/core/commands/`, `src/core/registries/`, `src/core/storage/`, `src/core/utils/`, `src/core/stores/`, `src/core/messaging/`, `src/entrypoints/`, `tests/core/`
**Files scanned:** 22 source files + 22 test files
**Pattern extraction date:** 2026-07-12
**Project convention:** Direct relative path imports, no barrel files, TypeScript with Zod v4, Zustand v5, Vitest 4.x, WXT MV3 extension framework
