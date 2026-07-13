# Phase 05: Persistent Memory Architecture - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 18 (9 new, 4 modified, 5 new test files)
**Analogs found:** 18 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/memory/MemoryEngine.ts` | service | CRUD + event-driven | `src/core/context/ContextOptimizer.ts` | exact (class+singleton orchestrator with constructor DI) |
| `src/core/memory/ConversationMemoryStore.ts` | service | CRUD | `src/core/storage/stores/MemoryDB.ts` | exact (IndexedDB store wrapper) |
| `src/core/memory/UserMemoryStore.ts` | service | CRUD | `src/core/storage/stores/MemoryDB.ts` | exact (IndexedDB store wrapper) |
| `src/core/memory/PreferenceMemoryStore.ts` | store | request-response | `src/core/stores/themeStore.ts` | role-match (Zustand store; reads external stores) |
| `src/core/memory/MemoryScorer.ts` | utility | transform | `src/core/context/TokenEstimator.ts` | exact (pure calculation utility, singleton export) |
| `src/core/memory/MemoryExtractor.ts` | service | request-response (AI call) | `src/core/context/ContextCompressor.ts` | exact (AI call via generateText, error fallback) |
| `src/core/memory/memoryTypes.ts` | model (types) | N/A | `src/core/context/contextTypes.ts` | exact (zod schemas + TS interfaces) |
| `src/core/memory/conflictResolver.ts` | utility | transform | `src/core/context/ContextProvenanceManifest.ts` | role-match (domain logic module, exported functions) |
| `src/core/search/MiniSearchIndex.ts` | utility | transform (search) | `src/core/context/TokenEstimator.ts` | role-match (singleton utility, new dep `minisearch`) |
| `src/core/storage/stores/MemoryDB.ts` (MODIFIED) | model | CRUD | `src/core/storage/stores/ChatHistoryDB.ts` | exact (same file, extending schema) |
| `src/core/storage/IndexedDBManager.ts` (MODIFIED) | config | N/A | itself — same file | exact (bump DB_VERSION, extend NowPilotDB) |
| `src/core/ai/pipeline/AgentOrchestrator.ts` (MODIFIED) | controller | event-driven | itself — same file | exact (inject MemoryEngine into runWithContext) |
| `src/core/messaging/broadcastBus.ts` (MODIFIED) | middleware | event-driven | itself — same file | exact (add memory write request types) |
| `tests/core/memory/MemoryEngine.test.ts` | test | N/A | `tests/core/ai/pipeline/AgentOrchestrator.test.ts` | exact (integration test, async generator) |
| `tests/core/memory/MemoryScorer.test.ts` | test | N/A | `tests/core/context/TokenEstimator.test.ts` | exact (utility unit test, pure functions) |
| `tests/core/memory/UserMemoryStore.test.ts` | test | N/A | `tests/core/storage/domainStores.test.ts` | exact (`vi.hoisted()` mock pattern) |
| `tests/core/memory/ConversationMemoryStore.test.ts` | test | N/A | `tests/core/storage/domainStores.test.ts` | exact (`vi.hoisted()` mock pattern) |
| `tests/core/memory/PreferenceMemoryStore.test.ts` | test | N/A | `tests/core/themeStore.test.ts` | role-match (Zustand store test) |

---

## Pattern Assignments

### 1. `src/core/memory/MemoryEngine.ts` (service, CRUD + event-driven)

**Analog:** `src/core/context/ContextOptimizer.ts` (lines 1-572)

**Imports pattern** (lines 1-16):
```typescript
import { debugLog } from '../../core/utils/debugLog';
import type { TokenEstimator } from './TokenEstimator';
import type { ContextCompressor } from './ContextCompressor';
import type {
  ContextOptimizerInput,
  OptimizedContext,
  PromptSection,
  ModelContextTier,
} from './contextTypes';
import { contextOptimizerInputSchema, ContextTooLargeError } from './contextTypes';
```
→ For MemoryEngine: import `debugLog` from `../../core/utils/debugLog`, import type-only dependencies, import schemas/errors from `./memoryTypes`.

**Class + singleton export pattern** (lines 61-66, 568-572):
```typescript
export class ContextOptimizer {
  constructor(
    private tokenEstimator: TokenEstimator,
    private compressor: ContextCompressor,
    private getModelEntry: (providerId: string, modelId: string) => ModelEntry | undefined,
  ) {}
  // ... methods ...
}

export const contextOptimizer = new ContextOptimizer(
  tokenEstimator,
  contextCompressor,
  getModelEntryFromRegistry,
);
```
→ For MemoryEngine: class with constructor DI (stores, scorer, extractor, broadcastBus). Singleton export after class definition. Dependency imports happen at module bottom (lines 557-558 in ContextOptimizer):
```typescript
import { tokenEstimator } from './TokenEstimator';
import { contextCompressor } from './ContextCompressor';
```

**Core orchestration pattern** (lines 68-148):
```typescript
async optimize(input: ContextOptimizerInput): Promise<OptimizedContext> {
  const validated = contextOptimizerInputSchema.parse(input);
  // ... orchestration logic ...
  debugLog('info', '[ContextOptimizer] Optimization complete', { ... });
  return { ... };
}
```
→ For MemoryEngine: `assemble()` validates inputs, orchestrates retrieval from sub-stores, returns populated result. `extract()` is fire-and-forget (no await from caller). Both log at method boundaries via `debugLog`.

**Error handling pattern** (lines 292, 58-59):
```typescript
throw new ContextTooLargeError(finalEstimated, inputBudget);
// ... catch in try/catch blocks with debugLog ...
```
→ For MemoryEngine: catch errors, log with `debugLog('error', ...)`, swallow extract failures per D-04.

**Private method decomposition** — ContextOptimizer uses many private methods (`classifyTier`, `computeBudget`, `assembleSections`, `estimateTotalTokens`, `withinBudget`, `applyDegradation`, etc.). MemoryEngine should follow the same structure: public `assemble()` and `extract()`, private helpers for retrieval loops, scoring orchestration, summary checking.

---

### 2. `src/core/memory/ConversationMemoryStore.ts` (service, CRUD)

**Analog:** `src/core/storage/stores/MemoryDB.ts` (lines 1-112)

**Imports pattern** (lines 1-2):
```typescript
import { getDB } from '../IndexedDBManager';
import { debugLog } from '../../utils/debugLog';
```
→ For ConversationMemoryStore: import `getDB` from `../storage/IndexedDBManager` and `debugLog` from `../../core/utils/debugLog`.

**Store method pattern — read** (lines 20-38):
```typescript
async getMessages(conversationId: string): Promise<Array<{...}>> {
  try {
    const db = await getDB();
    const tx = db.transaction('memory_messages');
    const store = tx.store;
    return store.getAll(IDBKeyRange.bound([conversationId, 0], [conversationId, Infinity]));
  } catch (err) {
    debugLog('error', 'MemoryDB.getMessages failed', { error: err });
    return [];
  }
}
```
→ Every store method follows: `try { const db = await getDB(); ... } catch (err) { debugLog('error', ...); return fallback; }`. ConversationMemoryStore extends this with tier-based filtering logic wrapping the raw DB calls.

**Store method pattern — write** (lines 5-18):
```typescript
async addMessage(msg: {...}): Promise<void> {
  try {
    const db = await getDB();
    await db.put('memory_messages', msg);
  } catch (err) {
    debugLog('error', 'MemoryDB.addMessage failed', { error: err });
  }
}
```
→ For conversation archiving and summary updates: same `try { db.put() } catch { debugLog() }` pattern.

**Singleton export** (lines 112):
```typescript
export const memoryDB = new MemoryDB();
```
→ ConversationMemoryStore: `export const conversationMemoryStore = new ConversationMemoryStore();`

**Additional analog:** `src/core/storage/stores/ChatHistoryDB.ts` (lines 1-97) — same `getDB` + try/catch + singleton pattern. All stores in the project follow this exact template.

---

### 3. `src/core/memory/UserMemoryStore.ts` (service, CRUD)

**Analog:** `src/core/storage/stores/MemoryDB.ts` (lines 1-112) — same pattern as ConversationMemoryStore.

**CRUD operations** (lines 40-75):
```typescript
async putUserFact(fact: {...}): Promise<void> {
  try {
    const db = await getDB();
    await db.put('memory_userFacts', fact);
  } catch (err) {
    debugLog('error', 'MemoryDB.putUserFact failed', { error: err });
  }
}

async getAllUserFacts(): Promise<Array<{...}>> {
  try {
    const db = await getDB();
    return db.getAll('memory_userFacts');
  } catch (err) {
    debugLog('error', 'MemoryDB.getAllUserFacts failed', { error: err });
    return [];
  }
}
```
→ UserMemoryStore builds on MemoryDB's `putUserFact`/`getAllUserFacts` by adding: MiniSearch indexing (update index on upsert), active/superseded filtering, conflict resolution pass-through. Same try/catch + debugLog + singleton export pattern.

**Key addition for UserMemoryStore:** Must also integrate `MiniSearchIndex` — call `this.index.replace(fact)` on upsert, `this.index.remove(id)` on evict, `this.index.rebuild(facts)` on construction/startup (Research pitfall #1).

---

### 4. `src/core/memory/PreferenceMemoryStore.ts` (store, request-response)

**Analog:** `src/core/stores/themeStore.ts` (lines 1-29) and `src/core/stores/workspaceStore.ts` (lines 1-91)

**Zustand store creation pattern** (themeStore.ts lines 1-29):
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'auto',
      setMode: (mode: ThemeMode) => set({ mode }),
    }),
    {
      name: 'nowpilot-theme',
      storage: chromeSyncStorage,
    },
  ),
);
```
→ PreferenceMemoryStore: use Zustand with `persist` middleware using `chrome.storage.local` (like workspaceStore, line 29-62). Storage key: `np_preferences`.

**Reading from external stores** (workspaceStore.ts syntax):
```typescript
// Zustand vanilla API (NOT hooks) — safe in non-React contexts:
import { useThemeStore } from '../stores/themeStore';
const mode = useThemeStore.getState().mode;

import { useWorkspaceStore } from '../stores/workspaceStore';
const surface = useWorkspaceStore.getState().activeSurface;
```
→ PreferenceMemoryStore's `get()` method reads `themeStore.getState().mode` and `workspaceStore.getState().activeSurface` at call time (D-09). Use vanilla Zustand getter, NOT React hooks — avoids circular dependency risks (Research pitfall #4).

**Compact JSON output** (D-10): PreferenceMemoryStore `get()` returns:
```typescript
{ responseStyle, preferredLanguage, preferStructuredOutput, allowCloudFallbackFromLocal, defaultProviderId, toolAutonomy }
```

---

### 5. `src/core/memory/MemoryScorer.ts` (utility, transform)

**Analog:** `src/core/context/TokenEstimator.ts` (lines 1-38)

**Class + singleton pattern** (lines 5-38):
```typescript
import { debugLog } from '../utils/debugLog';

export class TokenEstimator {
  estimateTokens(text: string): number {
    // ... pure calculation ...
  }
}

export const tokenEstimator = new TokenEstimator();
```
→ MemoryScorer: `export class MemoryScorer` with `score()` and `tieBreak()` methods. No external dependencies beyond `debugLog`. Singleton export at bottom.

**Pure calculation logic** — TokenEstimator has no side effects, no async, no I/O. MemoryScorer's `score()` is also a pure function (inputs → number), even though it's called in an async orchestration context. The class encapsulation is for testability and the project convention.

**Tie-break pattern** — Use compound sort with `||` short-circuit (RESEARCH.md lines 506-517):
```typescript
return results.sort((a, b) =>
  b.finalScore - a.finalScore ||
  b.fact.confidence - a.fact.confidence ||
  (b.fact.updatedAt - a.fact.updatedAt) ||
  ((b.fact.useCount ?? 0) - (a.fact.useCount ?? 0)) ||
  a.fact.id.localeCompare(b.fact.id)
);
```

---

### 6. `src/core/memory/MemoryExtractor.ts` (service, request-response / AI call)

**Analog:** `src/core/context/ContextCompressor.ts` (lines 1-101)

**Imports + AI call pattern** (lines 1-3, 15-16, 42-63):
```typescript
import { generateText } from 'ai';
import { debugLog } from '../utils/debugLog';

export class ContextCompressor {
  constructor(private modelAccessor: ModelAccessor) {}
  
  private async llmCompressHistory(...): Promise<string> {
    try {
      const { text } = await generateText({
        model: model as Parameters<typeof generateText>[0]['model'],
        system: 'You are a conversation summarizer. Be concise.',
        prompt,
        maxTokens: 200,
        temperature: 0,
      });
      debugLog('info', '[ContextCompressor] LLM summarization completed', { ... });
      return text;
    } catch (err) {
      debugLog('error', '[ContextCompressor] LLM summarization failed, falling back to heuristic', { error: err });
      return this.heuristicCompressHistory(messages);
    }
  }
}
```
→ MemoryExtractor: inject a `modelAccessor` function or `ProviderRouter`. Call `generateText` with Haiku-tier model, compact extraction prompt (<200 tokens output). On failure, return empty extraction results (no fallback needed — extraction is optional per D-04). Log both success and failure via `debugLog`.

**Prompt template pattern** (lines 8-13):
```typescript
const HISTORY_SUMMARY_PROMPT = `Summarize the following conversation...`;
```
→ MemoryExtractor defines a constant extraction prompt template with `{messages}` placeholder. The prompt instructs the Haiku model to output structured JSON matching `memoryTypes` schemas.

**Error resilience** (lines 58-63): ContextCompressor catches AI call errors and falls back. MemoryExtractor catches errors, logs, and returns empty results — no fallback LLM call needed.

**Model access pattern** — See also `ProviderRouter.selectModel()` (ProviderRouter.ts lines 21-61) for how to resolve a Haiku-tier provider. MemoryExtractor can accept a pre-resolved model instance or resolve via ProviderRouter internally.

---

### 7. `src/core/memory/memoryTypes.ts` (model/types, N/A)

**Analog:** `src/core/context/contextTypes.ts` (lines 1-145)

**Zod schema + TS interface pattern** (lines 1-2, 5-18, 114-145):
```typescript
import { z } from 'zod';

export const PromptSectionKind = z.enum([...]);
export type PromptSectionKindType = z.infer<typeof PromptSectionKind>;

export interface PromptSection { ... }
export interface ContextOptimizerInput { ... }

export class ContextTooLargeError extends Error { ... }

export const contextOptimizerInputSchema = z.object({ ... });
```
→ memoryTypes.ts exports:
- `UserMemoryFact` interface (with `status: 'active' | 'superseded'`, `tags`, `useCount`, `lastUsedAt`)
- `MemoryScore` interface (candidate + finalScore)
- `ConversationSummary` interface
- `PreferencePayload` type
- `MemoryAssembleResult` interface (return type of `assemble()`)
- `MemoryExtractionResult` interface (return type of extract)
- `MemoryWriteRequest` interface (for BroadcastBus messages)
- Zod schemas: `userMemoryFactSchema`, `extractionResultSchema`, `preferenceSchema`

**Custom error class pattern** (lines 99-112):
```typescript
export class ContextTooLargeError extends Error {
  public readonly code = 'CONTEXT_TOO_LARGE' as const;
  constructor(estimatedTokens: number, budget: number) {
    super(`Context size (${estimatedTokens} tokens) exceeds available budget...`);
    this.name = 'ContextTooLargeError';
  }
}
```
→ If applicable: `MemoryEngineError` or custom error classes for memory cap exceeded, etc.

---

### 8. `src/core/memory/conflictResolver.ts` (utility, transform)

**Analog:** `src/core/context/ContextProvenanceManifest.ts` — domain logic module pattern

From the manifest module pattern (observable in import at ContextOptimizer.ts line 3):
```typescript
import { createManifest, recordSection, recordDegradationStep, setMinimalMode, createSectionEntry } from './ContextProvenanceManifest';
```
→ conflictResolver.ts exports pure functions (not a class):
- `resolve(newFacts: Fact[], existingFacts: Fact[]): ResolvedFact[]`
- `computeCumulativeConfidence(observations: Observation[]): number`
- Simple state machine: `null → pending → active` or `active → superseded` with evidence threshold (D-16)

No IndexedDB access — operates on in-memory arrays. Caller (MemoryEngine or UserMemoryStore) handles persistence.

**Analog also:** `src/core/storage/WriteJournalEntry.ts` — validation/utility module with pure functions:
```typescript
import type { WriteJournalEntry, WriteJournalOperation, WriteJournalSteps } from './WriteJournalEntry';
import { validateWriteJournalEntry } from './WriteJournalEntry';
```

---

### 9. `src/core/search/MiniSearchIndex.ts` (utility, transform/search)

**Analog:** `src/core/context/TokenEstimator.ts` (singleton utility class pattern)

**Pattern** (TokenEstimator.ts lines 5-38):
```typescript
export class TokenEstimator {
  estimateTokens(text: string): number { ... }
}
export const tokenEstimator = new TokenEstimator();
```
→ MiniSearchIndex:
```typescript
import MiniSearch from 'minisearch';

export class MiniSearchIndex {
  private index: MiniSearch;
  
  constructor() {
    this.index = new MiniSearch({
      fields: ['content', 'tags', 'category'],
      storeFields: ['id', 'content', 'category', 'confidence', 'source', 'useCount', 'updatedAt'],
      searchOptions: { boost: { content: 2, tags: 1.5 }, prefix: true, fuzzy: 0.2 },
      idField: 'id',
    });
  }
  
  search(query: string, limit = 20) { ... }
  addFact(fact) { this.index.add(fact); }
  replaceFact(fact) { this.index.replace(fact); }
  removeFact(id) { this.index.discard(id); }
  rebuild(facts) { this.index.removeAll(); this.index.addAll(facts); }
}

export const miniSearchIndex = new MiniSearchIndex();
```

**Rebuild strategy** (Research open question #2): Call `miniSearchIndex.rebuild(allActiveFacts)` at SW startup, after loading facts from MemoryDB. Simpler than serialization.

---

### 10. `src/core/storage/stores/MemoryDB.ts` (MODIFIED, model, CRUD)

**Analog:** itself — extend existing class

**Schema extension** — Add to `putUserFact` param type:
```typescript
async putUserFact(fact: {
  id: string;
  fact: string;
  category: string;
  confidence: number;
  created: number;
  updated: number;
  source: string;
  status?: 'active' | 'superseded';  // NEW (D-15)
  tags?: string[];                     // NEW
  useCount?: number;                   // NEW
  lastUsedAt?: number;                 // NEW
}): Promise<void> { ... }
```

**Add to `putSummary` param type:**
```typescript
async putSummary(summary: {
  conversationId: string;
  summary: string;
  messageCount: number;
  created: number;
  updated: number;
  state?: 'active' | 'archived';       // NEW (D-22)
  archivedAt?: number;                  // NEW (D-22)
}): Promise<void> { ... }
```

All existing try/catch + debugLog patterns remain unchanged. No new methods needed — just extended interfaces.

---

### 11. `src/core/storage/IndexedDBManager.ts` (MODIFIED, config)

**Analog:** itself (lines 1-203)

**Changes needed** (lines 156, 164-188):
```typescript
export const DB_VERSION = 2; // bumped from 1 (line 156)

// In upgrade callback (lines 164-188):
upgrade(db, oldVersion, _newVersion, _transaction) {
  if (oldVersion < 1) {
    // ... existing v1 stores — NO CHANGE ...
  }
  if (oldVersion < 2) {
    // v2: schemaless stores — new fields (status, useCount, tags, state, archivedAt)
    // added via put() at runtime with defaults. No schema changes needed.
    // NowPilotDB TypeScript interface updated separately (see below).
  }
}
```

**NowPilotDB interface update** (lines 4-154) — add new fields to `memory_userFacts.value`:
```typescript
memory_userFacts: {
  key: string;
  value: {
    id: string;
    fact: string;
    category: string;
    confidence: number;
    created: number;
    updated: number;
    source: string;
    status?: 'active' | 'superseded';  // NEW
    tags?: string[];                    // NEW
    useCount?: number;                  // NEW
    lastUsedAt?: number;                // NEW
  };
};
```
Add to `memory_summaries.value`:
```typescript
memory_summaries: {
  key: string;
  value: {
    conversationId: string;
    summary: string;
    messageCount: number;
    created: number;
    updated: number;
    state?: 'active' | 'archived';      // NEW
    archivedAt?: number;                 // NEW
  };
};
```

**Key insight from Research (Pattern 3):** IndexedDB object stores are schemaless at the value level. Adding optional fields requires NO upgrade callback logic — just bump the version and update the TypeScript interface. Records without these fields get `undefined` at read time; runtime defaults fill in.

---

### 12. `src/core/ai/pipeline/AgentOrchestrator.ts` (MODIFIED, controller)

**Analog:** itself (lines 1-275)

**Integration point — `runWithContext()`** (lines 75-127):
```typescript
async *runWithContext(
  optimizedContext: OptimizedContext,
  preferredProviders: string[],
): AsyncGenerator<OrchestratorEvent> {
  // ...
  try {
    yield* this.emitDegradationEvents(optimizedContext);
    // ... planner loop ... renderer ...
  } catch (err) {
    // ... error handling ...
  } finally {
    this.currentAbortManager = null;
  }
}
```

**Changes — Inject MemoryEngine** (lines 28-36):
```typescript
export class AgentOrchestrator {
  constructor(
    private planner: PlannerService,
    private executor: ExecutorService,
    private renderer: RendererService,
    private router: ProviderRouter,
    private memoryEngine: MemoryEngine, // NEW
  ) {}
```

**Post-execution extraction** — add in `finally` block of `runWithContext()`:
```typescript
finally {
  // D-02: Memory extraction triggered after renderer completes
  // D-04: Fire-and-forget — NOT awaited
  const conversationId = optimizedContext.provenance.operationId; // or from context
  this.memoryEngine.extract(conversationId, messages, toolResults)
    .catch(err => debugLog('error', '[AgentOrchestrator] Memory extraction failed', { error: err }));
  
  this.currentAbortManager = null;
}
```

**Pre-optimization** — caller of `runWithContext()` calls `memoryEngine.assemble()` before creating `ContextOptimizerInput`, then passes enriched input. OR: Add `conversationId` and `userMessage` params to `runWithContext()` and call `assemble()` internally. Pattern A (caller-assembles) is simpler per Research open question #1.

**Async generator pattern** (`async *runWithContext`) — the generator signature remains unchanged. Memory extraction is a side-effect in the `finally` block, not a yielded event.

---

### 13. `src/core/messaging/broadcastBus.ts` (MODIFIED, middleware)

**Analog:** itself (lines 1-35)

**Existing pattern — message types** (line 5):
```typescript
export const WORKSPACE_UPDATED = 'np_workspace' as const;
```

**Add memory message types:**
```typescript
export const MEMORY_WRITE_REQUEST = 'np_memory_write_request' as const;

// Memory write request type (single-key approach — Research pitfall #5 suggests queue):
export interface MemoryWriteRequest {
  type: 'upsert-fact' | 'update-summary' | 'archive-conversation';
  payload: unknown;
  surfaceId: string;
  timestamp: number;
  idempotencyKey: string; // UUID for dedup (Research open question #4)
}
```

**Handler registration pattern** (lines 7-14):
```typescript
const handlers = new Set<BroadcastHandler>();

export function onBroadcastMessage(handler: BroadcastHandler): () => void {
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}
```
→ Extend `BroadcastHandler` type to include memory write requests, or add a separate handler set for memory messages. The existing `chrome.storage.onChanged` listener (lines 16-34) already monitors `session` area — memory write requests use `chrome.storage.session` per D-06.

**Session storage listener** (lines 17-23):
```typescript
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'session') {
    for (const handler of handlers) {
      handler(changes);
    }
  }
});
```
→ Memory write requests are routed through the same `session` area listener. Primary surface listens for `np_memory_write_request` changes; non-primary surfaces emit via `chrome.storage.session.set({ np_memory_write_request: request })`.

---

### 14-18. Test Files (test, N/A)

**Analog for store tests:** `tests/core/storage/domainStores.test.ts` (lines 1-139)

**`vi.hoisted()` mock pattern** (lines 3-34):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDB, mockDb } = vi.hoisted(() => {
  const mockDbInstance = {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(() => ({ store: mockStore, done: Promise.resolve() })),
  };
  const mockGetDB = vi.fn().mockResolvedValue(mockDbInstance);
  return { mockGetDB, mockDb: mockDbInstance };
});

vi.mock('../../../src/core/storage/IndexedDBManager', () => ({
  getDB: mockGetDB,
}));
```
→ All store tests (ConversationMemoryStore, UserMemoryStore) use this exact `vi.hoisted()` + `vi.mock()` pattern for `getDB` mocking. The relative path from `tests/core/memory/` to `src/core/storage/IndexedDBManager` is `../../../src/core/storage/IndexedDBManager`.

**Singleton import** (lines 36-40):
```typescript
import { chatHistoryDB } from '../../../src/core/storage/stores/ChatHistoryDB';
```
→ Import the singleton instance for testing:
```typescript
import { conversationMemoryStore } from '../../../src/core/memory/ConversationMemoryStore';
import { userMemoryStore } from '../../../src/core/memory/UserMemoryStore';
```

**Analog for integration tests:** `tests/core/ai/pipeline/AgentOrchestrator.test.ts` (lines 1-100)

**Mock factory pattern** (lines 38-64):
```typescript
function createMockPlanner() {
  return { plan: vi.fn() as PlannerService['plan'] } as unknown as PlannerService;
}
function createMockRenderer() {
  return { render: vi.fn() as RendererService['render'] } as unknown as RendererService;
}
```
→ For MemoryEngine.test.ts: create mock factories for `ConversationMemoryStore`, `UserMemoryStore`, `PreferenceMemoryStore`, `MemoryScorer`, `MemoryExtractor`, `BroadcastBus`.

**Constructor injection in tests** (lines 68-78):
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  optimizer = new ContextOptimizer(
    tokenEstimator,
    createMockCompressor(),
    createMockGetModelEntry(),
  );
});
```
→ For MemoryEngine tests:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  engine = new MemoryEngine(
    createMockConversationStore(),
    createMockUserMemoryStore(),
    createMockPreferenceStore(),
    createMockScorer(),
    createMockExtractor(),
    createMockBroadcastBus(),
  );
});
```

**Async generator helpers** (AgentOrchestrator.test.ts lines 16-33):
```typescript
async function collectEvents(gen: AsyncGenerator<OrchestratorEvent>): Promise<OrchestratorEvent[]> {
  const events: OrchestratorEvent[] = [];
  for await (const event of gen) events.push(event);
  return events;
}
```
→ Not needed for MemoryEngine tests (no async generators), but useful if testing AgentOrchestrator integration with MemoryEngine.

**Analog for utility tests:** `tests/core/context/TokenEstimator.test.ts` — pure unit tests with no mocks needed beyond the module itself. MemoryScorer.test.ts follows this pattern.

**Vitest config** (vitest.config.ts): `jsdom` environment, `tests/setup.ts` setup file, test include pattern `tests/**/*.test.ts`. New test files at `tests/core/memory/` match this.

---

## Shared Patterns

### Authentication/Authorization
No new auth surface in Phase 5. MemoryEngine is an internal service — no user-facing auth. Not applicable.

### Error Handling
**Source:** `src/core/utils/debugLog.ts` (lines 1-22) + all existing try/catch patterns
**Apply to:** All new service and utility files

```typescript
// Every async method pattern:
async someMethod(...): Promise<ReturnType> {
  try {
    const db = await getDB();
    // ...
  } catch (err) {
    debugLog('error', 'ClassName.methodName failed', { error: err });
    return fallback; // or re-throw for non-recoverable errors
  }
}
```

**MemoryEngine-specific:** Extraction errors are caught and logged, NEVER re-thrown (D-04 fire-and-forget):
```typescript
this.memoryEngine.extract(...).catch(err => 
  debugLog('error', '[AgentOrchestrator] Memory extraction failed', { error: err })
);
```

### Validation
**Source:** `src/core/context/contextTypes.ts` (zod schemas) + `src/core/storage/WriteJournalEntry.ts` (validation functions)
**Apply to:** `memoryTypes.ts`, MemoryExtractor output parsing

```typescript
import { z } from 'zod';

export const userMemoryFactSchema = z.object({
  id: z.string(),
  fact: z.string(),
  category: z.string(),
  confidence: z.number().min(0).max(1),
  // ...
});
export type UserMemoryFact = z.infer<typeof userMemoryFactSchema>;
```

**Runtime validation:** MemoryExtractor's AI output MUST be validated via zod schema before ANY fact is upserted. Invalid extraction results are discarded silently (log + drop).

### Logging
**Source:** `src/core/utils/debugLog.ts` + existing patterns in all source files
**Apply to:** All files

```typescript
import { debugLog } from '../../core/utils/debugLog';
// OR from sibling paths:
import { debugLog } from '../utils/debugLog';

// Usage:
debugLog('info', '[MemoryEngine] assemble complete', { conversationId, factCount });
debugLog('warn', '[MemoryScorer] No candidates to score', { query });
debugLog('error', '[MemoryExtractor] Haiku call failed', { error: err });
```

**Convention:** Class/method names in brackets as prefix: `[ClassName] methodName description`. Data objects as third argument.

### IndexedDB Access
**Source:** `src/core/storage/IndexedDBManager.ts` (getDB function) + `src/core/storage/stores/MemoryDB.ts`
**Apply to:** ConversationMemoryStore, UserMemoryStore, MemoryDB (modified)

```typescript
import { getDB } from '../storage/IndexedDBManager';
// or
import { getDB } from '../IndexedDBManager';

// Usage:
const db = await getDB();
await db.put('memory_userFacts', fact);
await db.getAll('memory_messages');
```

### Singleton Export
**Source:** Multiple files — ContextOptimizer.ts (line 568), TokenEstimator.ts (line 38), ProviderRegistry.ts (line 226), MemoryDB.ts (line 112), WriteJournal.ts (line 218)
**Apply to:** MemoryEngine, ConversationMemoryStore, UserMemoryStore, PreferenceMemoryStore, MemoryScorer, MemoryExtractor, MiniSearchIndex

```typescript
export const className = new ClassName(...deps);
```
Singleton dependencies are imported at module bottom (ContextOptimizer pattern, lines 557-572):
```typescript
// At bottom of file, after class definition:
import { dependencyA } from './dependencyA';
import { dependencyB } from './dependencyB';
export const instance = new Class(dependencyA, dependencyB);
```

### NP_ Key Prefix
**Source:** `src/core/stores/workspaceStore.ts` (`'np_workspace'`), `src/core/stores/providerStore.ts` (`'np_providers'`), `src/core/messaging/broadcastBus.ts` (`'np_workspace'`), `src/core/ai/providers/ProviderRegistry.ts` (`'np_provider_registry'`)
**Apply to:** New storage keys

```typescript
// chrome.storage.session keys for memory write routing:
'np_memory_write_request'
// chrome.storage.local keys for preference persistence:
'np_preferences'
```

### Direct Path Imports
**Source:** All project files — no barrel/index files
**Apply to:** All new files

```typescript
import { memoryEngine } from '../../../core/memory/MemoryEngine'; // NOT from '../../../core/memory'
```

---

## Files with Special Considerations

### MemoryExtractor (AI call pattern)
The AI call pattern differs from typical store methods. It must:
1. Resolve a Haiku-tier model via ProviderRouter (like ContextCompressor's `modelAccessor`)
2. Call `generateText()` from `ai` SDK
3. Parse and validate output with zod
4. Return typed extraction results
5. Catch ALL errors — never throw (D-04)
6. Log success/failure via debugLog

### MiniSearchIndex (new dependency)
The only new npm dependency. Must be installed before implementation:
```bash
npm install minisearch@7.2.0
```
The index is rebuilt from MemoryDB at SW startup. Every upsert/evict must update the index.

### PreferenceMemoryStore (cross-store reads)
Reads from existing Zustand stores via vanilla `getState()` — NOT React hooks. This avoids circular dependency issues:
```typescript
import { useThemeStore } from '../stores/themeStore';
import { useWorkspaceStore } from '../stores/workspaceStore';

// Safe in background SW context:
const mode = useThemeStore.getState().mode;
const surface = useWorkspaceStore.getState().activeSurface;
```

---

## No Analog Found

None — all files have strong analogs in the existing codebase. The closest category is `MiniSearchIndex` which uses a new dependency, but follows existing utility class patterns exactly.

---

## Metadata

**Analog search scope:** `src/core/` (all subdirectories), `tests/core/` (all subdirectories)
**Files scanned for analogs:** ~80+ files reviewed (ContextOptimizer, AgentOrchestrator, MemoryDB, ChatHistoryDB, broadcastBus, contextTypes, TokenEstimator, ContextCompressor, IndexedDBManager, WriteJournal, ProviderRegistry, ProviderRouter, themeStore, workspaceStore, pipelineTypes, debugLog, + test files)
**Pattern extraction date:** 2026-07-13
**Key patterns identified:**
1. Class + singleton export (all service/utility classes)
2. Constructor DI (ContextOptimizer pattern: inject deps, singleton instantiation at module bottom)
3. IndexedDB store wrapper (MemoryDB/ChatHistoryDB pattern: `getDB` + try/catch + debugLog)
4. Zustand + persist (themeStore/workspaceStore pattern for PreferenceMemoryStore)
5. AI call via generateText (ContextCompressor pattern for MemoryExtractor)
6. Zod schema + TS interface (contextTypes/pipelineTypes pattern for memoryTypes)
7. vi.hoisted() mock pattern (domainStores.test.ts for all store tests)
8. Mock factory + constructor injection (AgentOrchestrator.test.ts for MemoryEngine integration tests)
9. debugLog everywhere (HARD-09: all catch blocks)
10. Chrome storage session routing (broadcastBus pattern for memory write requests)
