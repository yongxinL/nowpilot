# Phase 06: Transaction Logging and Diagnostics — Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 31 (17 new, 14 modified)
**Analogs found:** 30 / 31

## File Classification

| # | New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|-------------------|------|-----------|----------------|---------------|
| 1 | `src/core/telemetry/types.ts` (NEW) | types | n/a | `src/core/context/contextTypes.ts` | exact |
| 2 | `src/core/telemetry/AITransactionLog.ts` (NEW) | service | event-driven | `src/core/context/ContextOptimizer.ts` | role-match |
| 3 | `src/core/telemetry/TraceRedactor.ts` (NEW) | utility | transform | `src/core/utils/debugLog.ts` (utility+singleton) | role-match |
| 4 | `src/core/telemetry/AITransactionLogDB.ts` (MODIFIED) | model | CRUD | itself (existing stub) + `src/core/storage/stores/ErrorStore.ts` | exact |
| 5 | `src/core/telemetry/pruning.ts` (NEW) | utility | batch | `src/core/storage/WriteJournal.ts` (prune method) | data-flow-match |
| 6 | `src/core/telemetry/export.ts` (NEW) | utility | file-I/O | no exact analog (new pattern) | none |
| 7 | `src/components/options/DiagnosticsPanel.tsx` (NEW) | component | request-response | `src/components/options/OptionsRoot.tsx` | role-match |
| 8 | `src/components/options/DiagnosticsSection.tsx` (NEW) | component | request-response | `OptionsRoot` rendered section pattern | role-match |
| 9 | `src/components/diagnostics/TransactionTable.tsx` (NEW) | component | CRUD | OptionsRoot sidebar Button list + antd Table | partial |
| 10 | `src/components/diagnostics/TraceDetailPanel.tsx` (NEW) | component | request-response | OptionsRoot content area | partial |
| 11 | `src/components/diagnostics/ProviderTimeline.tsx` (NEW) | component | request-response | Research.md antd Timeline pattern | none |
| 12 | `src/components/diagnostics/ToolCallDescriptions.tsx` (NEW) | component | request-response | Research.md antd Descriptions pattern | none |
| 13 | `src/components/diagnostics/CacheStats.tsx` (NEW) | component | request-response | Research.md antd Statistic pattern | none |
| 14 | `src/core/stores/diagnosticsStore.ts` (NEW) | store | CRUD | `src/core/stores/workspaceStore.ts` | exact |
| 15 | `src/core/storage/IndexedDBManager.ts` (MODIFIED) | config | CRUD | itself (DB_VERSION upgrade pattern) | exact |
| 16 | `src/core/ai/pipeline/AgentOrchestrator.ts` (MODIFIED) | controller | event-driven | itself (runWithContext + constructor DI) | exact |
| 17 | `src/core/ai/pipeline/pipelineTypes.ts` (MODIFIED) | types | n/a | itself (zod schema + union type) | exact |
| 18 | `src/core/ai/pipeline/PlannerService.ts` (MODIFIED) | service | request-response | itself (constructor DI, router call) | exact |
| 19 | `src/core/ai/pipeline/ExecutorService.ts` (MODIFIED) | service | request-response | itself (permission check + execution) | exact |
| 20 | `src/core/ai/pipeline/RendererService.ts` (MODIFIED) | service | streaming | itself (async generator + streamText) | exact |
| 21 | `src/core/ai/router/ProviderRouter.ts` (MODIFIED) | service | request-response | itself (selectModel retry chain) | exact |
| 22 | `src/core/ai/cache/PromptCacheManager.ts` (MODIFIED) | service | request-response | itself (cache key generation) | exact |
| 23 | `src/core/memory/MemoryEngine.ts` (MODIFIED) | service | event-driven | itself (assemble + extract lifecycle) | exact |
| 24 | `src/core/storage/WriteJournal.ts` (MODIFIED) | utility | batch | itself (begin/markComplete/markCompleted) | exact |
| 25 | `src/core/storage/stores/ErrorStore.ts` (MODIFIED) | model | CRUD | itself (FIFO enforcement) | exact |
| 26 | `src/core/utils/debugLog.ts` (MODIFIED) | utility | transform | itself (__DEV__ guard, console routing) | exact |
| 27 | `src/core/storage/WriteJournalEntry.ts` (MODIFIED) | types | n/a | itself (zod schema + union type) | exact |
| 28 | `src/components/options/OptionsRoot.tsx` (MODIFIED) | component | request-response | itself (renderSectionContent injection) | exact |
| 29 | `tests/core/telemetry/AITransactionLog.test.ts` (NEW) | test | n/a | `tests/core/ai/pipeline/PlannerService.test.ts` | exact |
| 30 | `tests/core/telemetry/TraceRedactor.test.ts` (NEW) | test | n/a | `tests/core/debugLog.test.ts` | exact |
| 31 | `tests/core/telemetry/pruning.test.ts` (NEW) | test | n/a | `tests/core/storage/WriteJournal.test.ts` | exact |
| 32 | `tests/core/telemetry/export.test.ts` (NEW) | test | n/a | `tests/core/storage/WriteJournal.test.ts` | exact |

## Pattern Assignments

### 1. `src/core/telemetry/types.ts` (types — NEW)

**Analog:** `src/core/context/contextTypes.ts` (lines 1–145)

**Imports pattern** (lines 1–2):
```typescript
import { z } from 'zod';
```

**Enum + type pattern** (lines 3–4, 65–67):
```typescript
export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';
// ... zod schemas ...
export type PromptSectionKindType = z.infer<typeof PromptSectionKind>;
```

**Interface + zod schema co-location** (lines 21–26, 47–55, 114–145):
```typescript
export interface PromptSection {
  kind: PromptSectionKindType;
  sourceId: string;
  content: string;
  priority?: number;
}
// ... downstream same file ...
export const contextOptimizerInputSchema = z.object({ ... });
```

**Copy this structural pattern:**
1. Enums first (Severity, TraceVerbosity)
2. Type aliases (TransactionStatus, TransactionType)
3. Interfaces (AITransaction, PromptTrace, ToolTrace, ProviderTrace, CacheTrace, MemoryTrace, WriteJournalTrace)
4. TraceCollector interface (7 typed `on*` methods + `getAllEvents()` + `clear()`)
5. ExecutionContext interface (traceCollector, operationId, abortSignal, verbosity, privacyMode)
6. TraceTree interface (assembled query result)
7. ExportOptions / ExportManifest types
8. Zod schemas at bottom if needed for validation

---

### 2. `src/core/telemetry/AITransactionLog.ts` (service, event-driven — NEW)

**Analog:** `src/core/context/ContextOptimizer.ts` (lines 1–572, class+singleton) + `src/core/storage/WriteJournal.ts` (lines 1–218, begin/complete/fail lifecycle)

**Imports pattern** (lines 1–16):
```typescript
import { debugLog } from '../../core/utils/debugLog';
import type { TokenEstimator } from './TokenEstimator';
import type { ContextCompressor } from './ContextCompressor';
import type { ModelEntry } from '../ai/providers/providerTypes';
import type { ContextOptimizerInput, OptimizedContext, ... } from './contextTypes';
```

**Class + constructor DI** (lines 34–40 from AgentOrchestrator.ts):
```typescript
export class AITransactionLog {
  constructor(
    private db: AITransactionLogDB,
    private redactor: TraceRedactor,
    private writeJournal: WriteJournal,
  ) {}
```

**Lifecycle methods (start/complete/fail/abort):**
- `start(operationId, execCtx)` → writes minimal transaction record via db.logTransaction
- `complete(operationId, collector)` → redacts all events → batch-writes via WriteJournal
- `fail(operationId, error, collector)` → records error → redacts → batch-writes
- `close(operationId, collector)` → internal method called by complete/fail — handles the WriteJournal batch-write flow

**WriteJournal batch-write pattern** (from WriteJournal.ts lines 10–37, 53–89):
```typescript
const journal = await this.writeJournal.begin(
  'transaction-log-batch',
  { transaction_log_transactions: operationId },
  [
    { name: 'write-transaction' },
    { name: 'write-prompt-traces' },
    // ... more step names ...
  ],
);
try {
  await this.writeJournal.markStepStart(journal.id, 0);
  await this.db.logTransaction(redactedEvents.transaction);
  await this.writeJournal.markStepComplete(journal.id, 0);
  // ... repeat per step ...
  await this.writeJournal.markCompleted(journal.id);
} catch (err) {
  await this.writeJournal.markFailed(journal.id);
  throw err;
}
```

**Singleton export** (lines 557–572 from ContextOptimizer.ts):
```typescript
import { aiTransactionLogDB } from '../storage/stores/AITransactionLogDB';
import { traceRedactor } from './TraceRedactor';
import { writeJournal } from '../storage/WriteJournal';

export const aiTransactionLog = new AITransactionLog(
  aiTransactionLogDB,
  traceRedactor,
  writeJournal,
);
```

**Crash recovery** — `recoverOrphanedTransactions()` as a standalone exported function:
```typescript
export async function recoverOrphanedTransactions(): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('transaction_log_transactions');
  const orphaned = all.filter(tx => tx.status === 'started' || tx.status === 'streaming');
  for (const tx of orphaned) {
    tx.status = 'aborted';
    tx.endedAt = Date.now();
    tx.severity = Severity.WARNING;
    await db.put('transaction_log_transactions', tx);
  }
}
```

---

### 3. `src/core/telemetry/TraceRedactor.ts` (utility, transform — NEW)

**Analog:** `src/core/utils/debugLog.ts` (lines 1–22, utility+singleton)

**Class + singleton pattern:**
```typescript
// Based on debugLog utility pattern — simple class, exported as singleton

export class TraceRedactor {
  private readonly patterns: Array<{ regex: RegExp; placeholder: string }>;

  constructor() {
    this.patterns = [
      { regex: /sk-[A-Za-z0-9_-]+/g, placeholder: '[REDACTED:API_KEY]' },
      { regex: /key-[A-Za-z0-9_-]+/g, placeholder: '[REDACTED:API_KEY]' },
      { regex: /Bearer\s+[A-Za-z0-9._-]+/gi, placeholder: '[REDACTED:BEARER_TOKEN]' },
      // ... all patterns from product spec §4.4
    ];
  }

  redact(value: string): string { ... }
  redactObject<T extends Record<string, unknown>>(obj: T): T { ... }
  redactValue(value: unknown): unknown { ... }  // dispatches string/object/array/primitives
}

export const traceRedactor = new TraceRedactor();
```

**Key design:** `redactValue()` is the polymorphic entry point used by both AITransactionLog middleware and debugLog safety net. It handles: string (regex patterns), object (recursive prop scan), array (map), primitives (pass-through).

---

### 4. `src/core/telemetry/AITransactionLogDB.ts` (model, CRUD — MODIFIED)

**Analog:** itself (existing stub, lines 1–93) + `src/core/storage/stores/ErrorStore.ts` (lines 1–64, class+singleton+error handling)

**Imports pattern (existing)** (lines 1–2):
```typescript
import { getDB } from '../IndexedDBManager';
import { debugLog } from '../../utils/debugLog';
```

**Class + singleton (existing)** (lines 4, 93):
```typescript
export class AITransactionLogDB { ... }
export const aiTransactionLogDB = new AITransactionLogDB();
```

**Method pattern (existing)** (lines 5–21, 45–58):
```typescript
async logTransaction(tx: { ... }): Promise<void> {
  try {
    const db = await getDB();
    await db.put('transaction_log_transactions', tx);
  } catch (err) {
    debugLog('error', 'AITransactionLogDB.logTransaction failed', { error: err });
  }
}
```

**New methods to add:**
- `getTraceTree(operationId)` — assembles from all 7 stores using `getAllFromIndex`
- `queryTraces(options: ExportOptions)` — filtered query for export
- `getAllTransactions(limit?, offset?)` — paginated list for DiagnosticsPanel
- `deleteTraces(ids: string[])` — bulk delete for pruning
- Extend existing `logTransaction`/`logPromptTrace`/`logToolTrace`/`logProviderTrace` with full product spec types

**getTraceTree pattern** (from RESEARCH.md lines 497–518):
```typescript
async getTraceTree(operationId: string): Promise<TraceTree | undefined> {
  const db = await getDB();
  const tx = await db.get('transaction_log_transactions', operationId);
  if (!tx) return undefined;
  const prompts = await db.getAllFromIndex('transaction_log_promptTraces', 'by-operationId', operationId);
  // ... repeat for all 7 stores ...
  return { transaction: tx, promptTraces: prompts, ... };
}
```

---

### 5. `src/core/telemetry/pruning.ts` (utility, batch — NEW)

**Analog:** `src/core/storage/WriteJournal.ts` (lines 174–215, `prune()` method) + `src/core/storage/stores/ErrorStore.ts` (lines 4–27, count-limit pruning)

**WriteJournal prune pattern** (lines 174–215):
```typescript
async prune(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('write_journal_entries', 'readwrite');
  const allEntries = await tx.store.getAll();
  const now = Date.now();
  // Time-based: filter expired
  for (const entry of allEntries) {
    if (entry.createdAt < now - this.RETENTION_MS) { toPrune.push(entry.id); }
  }
  // Count-based: excess beyond max
  if (retained.length > MAX) { ... }
  // Delete
  for (const id of toPrune) { await tx.store.delete(id); }
  await tx.done;
  return toPrune.length;
}
```

**ErrorStore count-limit pattern** (lines 18–27):
```typescript
const count = await db.count('errors');
if (count > MAX_ERRORS) {
  const all = await db.getAll('errors');
  all.sort((a, b) => a.timestamp - b.timestamp);
  const toDelete = count - MAX_ERRORS;
  for (let i = 0; i < toDelete; i++) {
    await db.delete('errors', all[i].id);
  }
}
```

**Copy this for pruning.ts:**
1. Export `pruneNow()` function — iterates over all stores, checks time + count limits
2. Export `startPruning()` function — runs `pruneNow()` immediately, sets up 5-min `setInterval`
3. Export `scheduleDebouncedPrune()` — 30-second debounce after transaction close
4. Failure-prioritized sorting: sort by `(severity DESC, timestamp ASC)`, keep failures + newest successes up to limit

**Retention configuration:**
```typescript
const RETENTION = {
  transactions: { maxCount: 5000, maxAgeMs: 30 * 86400000 },
  normalTraces: { maxCount: 2000, maxAgeMs: 14 * 86400000 },
  diagnosticTraces: { maxCount: 500, maxAgeMs: 7 * 86400000 },
  errors: { maxCount: 1000, maxAgeMs: 30 * 86400000 },
  // cacheTraces, memoryTraces, writeJournalTraces: same as normalTraces
};
```

---

### 6. `src/core/telemetry/export.ts` (utility, file-I/O — NEW)

**No exact analog in codebase.** Use RESEARCH.md patterns (lines 878–961) and standard browser download pattern.

**JSZip import** (new dependency):
```typescript
import JSZip from 'jszip';
```

**Core export functions:**
- `exportSingleTrace(operationId)` — calls `getTraceTree()`, produces JSON blob, triggers download
- `exportTraces(options: ExportOptions)` — queries AITransactionLogDB, assembles ZIP with manifest.json
- `buildManifest(options, traces)` — produces manifest JSON per D-18 spec

**Browser download pattern** (standard):
```typescript
const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `nowpilot-diagnostics-${Date.now()}.zip`;
a.click();
URL.revokeObjectURL(url);
```

---

### 7. `src/components/options/DiagnosticsPanel.tsx` (component, request-response — NEW)

**Analog:** `src/components/options/OptionsRoot.tsx` (lines 1–204) — master-detail layout pattern

**Imports pattern** (lines 1–16):
```typescript
import { useMemo, useState } from 'react';
import { Button, Flex, Input, theme } from 'antd';
import { ... } from '@ant-design/icons';
```

**Layout pattern** (lines 86–193) — flex row with sidebar nav + content area:
```tsx
<div style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100%' }}>
  {/* Left panel: sidebar/filter bar + transaction list */}
  <aside style={{ width: 260, ... }}>...</aside>
  {/* Right panel: detail content */}
  <main style={{ flex: 1, ... }}>{content}</main>
</div>
```

**Copy this for DiagnosticsPanel:**
1. Two-column flex layout (left: filter bar + TransactionTable, right: TraceDetailPanel)
2. Left panel ~350px (wider than Options sidebar to fit Table columns)
3. Right panel flex: 1, scrollable
4. theme.useToken() for consistent colors/spacing
5. Filter bar above TransactionTable using AntD Select, Input.Search, DatePicker, Switch

---

### 8. `src/components/options/DiagnosticsSection.tsx` (component, request-response — NEW)

**Analog:** `OptionsRoot.tsx` rendered section pattern (lines 65–73)

```tsx
{renderSectionContent ? renderSectionContent(activeSection) : (
  <div data-options-section={activeSection} style={{ padding: '8px 0' }}>
    <h2 style={{ marginTop: 0 }}>{activeEntry.title}</h2>
  </div>
)}
```

**Copy this for DiagnosticsSection:** Simple wrapper that returns `<DiagnosticsPanel />`. Use same `data-options-section` attribute. Import from `./DiagnosticsPanel`.

---

### 9. `src/components/diagnostics/TransactionTable.tsx` (component, CRUD — NEW)

**Analog:** `OptionsRoot.tsx` sidebar Button list (lines 126–165) for selection pattern + AntD Table pattern from RESEARCH.md (lines 981–989)

**Selection state pattern** (lines 133–164):
```tsx
const isActive = section.id === activeSection;
<Button
  aria-current={isActive ? 'page' : undefined}
  onClick={() => handleSelect(section.id)}
  data-active={isActive ? 'true' : 'false'}
>
```

**Copy this for TransactionTable:**
1. AntD `<Table>` with columns: Status icon, Type badge, Provider+Model, operationId (copyable), Duration, Severity, Timestamp, Actions ("Export Trace")
2. `onRow` click handler → `diagnosticsStore.selectTransaction(operationId)`
3. Page size, loading state, empty state
4. Uses `useDiagnosticsStore()` for transaction data + selectedOperationId

---

### 10. `src/components/diagnostics/TraceDetailPanel.tsx` (component, request-response — NEW)

**Analog:** `OptionsRoot.tsx` content area (lines 177–192) for content rendering pattern

**Copy this:** Renders the selected transaction's TraceTree. Contains sub-sections:
- TransactionHeader (operationId, status, duration, severity)
- ProviderTimeline
- ToolCallDescriptions
- PromptSection (hashes, token Progress bars)
- CacheStats
- MemorySection
- WriteJournalSection
- ErrorSection
- Collapse for "Show redacted details"
- "Export this trace" button

Each sub-section gets its own `<section>` with a title. Uses `diagnosticsStore.traceTree` for data.

---

### 11. `src/components/diagnostics/ProviderTimeline.tsx` (component, request-response — NEW)

**No direct code analog.** Follow AntD v6 Timeline pattern from RESEARCH.md (lines 1052–1054):

```tsx
import { Timeline } from 'antd';
<Timeline
  items={attempts.map(a => ({
    color: a.outcome === 'success' ? 'green' : 'red',
    children: <>{a.providerId} / {a.model} ({a.durationMs}ms) {a.errorCode ? `— ${a.errorCode}` : ''}</>,
  }))}
/>
```

Props: receives `ProviderAttempt[]` array. Renders one Timeline.Item per attempt with color-coded status.

---

### 12. `src/components/diagnostics/ToolCallDescriptions.tsx` (component, request-response — NEW)

**No direct code analog.** Follow AntD v6 Descriptions pattern from RESEARCH.md (lines 1053–1055):

```tsx
import { Descriptions, Tag } from 'antd';
<Descriptions bordered column={1} size="small"
  items={toolCalls.map(t => ({
    key: t.id,
    label: <Tag>{t.toolName}</Tag>,
    children: `${t.status} — ${t.durationMs}ms${t.errorMessage ? `: ${t.errorMessage}` : ''}`,
  }))}
/>
```

Props: receives `ToolTrace[]` array.

---

### 13. `src/components/diagnostics/CacheStats.tsx` (component, request-response — NEW)

**No direct code analog.** Follow AntD v6 Statistic pattern from RESEARCH.md (line 1055):

```tsx
import { Statistic, Row, Col } from 'antd';
<Row gutter={16}>
  <Col><Statistic title="Hits" value={hits} /></Col>
  <Col><Statistic title="Misses" value={misses} /></Col>
  <Col><Statistic title="Estimated Savings" value={savings} suffix="tokens" /></Col>
</Row>
```

Props: receives `CacheTrace[]` array or aggregated cache stats object.

---

### 14. `src/core/stores/diagnosticsStore.ts` (store, CRUD — NEW)

**Analog:** `src/core/stores/workspaceStore.ts` (lines 1–91) — Zustand v5 with chrome.storage.local persistence

**Imports pattern** (lines 1–4):
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Surface } from '../navigation/navigationTypes';
```

**chrome.storage.local adapter** (lines 29–62):
```typescript
const chromeLocalStorage = createJSONStorage<DiagnosticsState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then((result) => (result[name] as string) ?? null),
  setItem: async (name: string, value: string) => {
    await chrome.storage.local.set({ [name]: value });
  },
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));
```

**Store creation** (lines 64–91):
```typescript
export const useDiagnosticsStore = create<DiagnosticsState>()(
  persist(
    (set) => ({
      // default state
      filterType: undefined,
      searchQuery: '',
      diagnosticMode: false,
      privacyMode: false,
      // setters
      setFilter: (key, value) => set({ [key]: value }),
      setDiagnosticMode: (enabled) => set({ diagnosticMode: enabled }),
      // ...
    }),
    {
      name: 'np_diagnostics',
      storage: chromeLocalStorage,
    },
  ),
);
```

**Store shape (from RESEARCH.md lines 1007–1035):**
```typescript
export interface DiagnosticsState {
  filterType: TransactionType | undefined;
  filterStatus: TransactionStatus | undefined;
  filterProvider: string | undefined;
  filterSeverity: Severity | undefined;
  filterDateRange: [number, number] | undefined;
  searchQuery: string;
  selectedOperationId: string | undefined;
  diagnosticMode: boolean;
  privacyMode: boolean;
  transactions: AITransaction[];
  traceTree: TraceTree | undefined;
  loading: boolean;
  setFilter: (key: string, value: unknown) => void;
  selectTransaction: (operationId: string) => Promise<void>;
  setDiagnosticMode: (enabled: boolean) => void;
  setPrivacyMode: (enabled: boolean) => void;
  refreshTransactions: () => Promise<void>;
}
```

---

### 15. `src/core/storage/IndexedDBManager.ts` (config, CRUD — MODIFIED)

**Analog:** itself (lines 1–212, DB_VERSION upgrade pattern)

**DB_VERSION bump** (line 162):
```typescript
// Current:
export const DB_VERSION = 2;
// → New:
export const DB_VERSION = 3;
```

**V3 upgrade block** (lines 194–197, copy the existing pattern):
```typescript
if (oldVersion < 3) {
  // 4 new stores:
  const cacheStore = db.createObjectStore('transaction_log_cacheTraces', { keyPath: 'id' });
  cacheStore.createIndex('by-operationId', 'operationId');
  const memoryStore = db.createObjectStore('transaction_log_memoryTraces', { keyPath: 'id' });
  memoryStore.createIndex('by-operationId', 'operationId');
  const journalStore = db.createObjectStore('transaction_log_writeJournalTraces', { keyPath: 'id' });
  journalStore.createIndex('by-operationId', 'operationId');
  // Error store gains severity
  // (schemaless — fields added via put() at runtime)

  // New indexes on existing stores (transaction upgrade pattern):
  const txStore = db.transaction('transaction_log_transactions', 'readwrite').objectStore('transaction_log_transactions');
  txStore.createIndex('by-operationId', 'operationId');
  txStore.createIndex('by-status', 'status');
  txStore.createIndex('by-severity', 'severity');
  txStore.createIndex('by-timestamp', 'startTime');

  const promptStore = db.transaction('transaction_log_promptTraces', 'readwrite').objectStore('transaction_log_promptTraces');
  promptStore.createIndex('by-operationId', 'operationId');
  // ... repeat for tool + provider stores
}
```

**NowPilotDB interface updates** — extend `transaction_log_transactions`, `transaction_log_promptTraces`, `transaction_log_toolTraces`, `transaction_log_providerTraces` value types with full product spec fields (see RESEARCH.md lines 813–820). Add new store entries for `transaction_log_cacheTraces`, `transaction_log_memoryTraces`, `transaction_log_writeJournalTraces`.

---

### 16. `src/core/ai/pipeline/AgentOrchestrator.ts` (controller, event-driven — MODIFIED)

**Analog:** itself (lines 1–317, `runWithContext()` + `constructor DI`)

**Constructor DI** (lines 34–40, add AITransactionLog):
```typescript
constructor(
  private planner: PlannerService,
  private executor: ExecutorService,
  private renderer: RendererService,
  private router: ProviderRouter,
  private memoryEngine: MemoryEngine,
  private aiTransactionLog: AITransactionLog,  // NEW
) {}
```

**ExecutionContext creation** in `runWithContext()` (lines 79–87, replace with):
```typescript
async *runWithContext(
  optimizedContext: OptimizedContext,
  preferredProviders: string[],
): AsyncGenerator<OrchestratorEvent> {
  const operationId = optimizedContext.provenance.operationId;
  const abortManager = new AbortManager();
  const traceCollector = new DefaultTraceCollector();

  const execCtx: ExecutionContext = {
    operationId,
    traceCollector,
    abortSignal: abortManager.signal,
    verbosity: this.diagnosticsMode ? TraceVerbosity.DIAGNOSTIC : TraceVerbosity.NORMAL,
    privacyMode: this.privacyMode,
  };

  await this.aiTransactionLog.start(operationId, execCtx);

  try {
    // ... planner/executor/renderer loop with execCtx passed through ...
    await this.aiTransactionLog.complete(operationId, traceCollector);
  } catch (err) {
    await this.aiTransactionLog.fail(operationId, err, traceCollector);
    throw err;
  }
}
```

**Pass ExecutionContext to services** — add `execCtx` param to `executePlannerLoop()` and `executeRenderer()`, and forward to `PlannerService.plan()`, `ExecutorService.execute()`, `RendererService.render()`, `ProviderRouter.selectModel()`, `MemoryEngine.assemble()/extract()`.

---

### 17–23. Pipeline Service Modifications (MODIFIED)

**Analog patterns for each:**

**PlannerService.plan()** — `src/core/ai/pipeline/PlannerService.ts` (lines 20–60):
```typescript
// Add execCtx parameter:
async plan(
  tier: CostTierType,
  preferredProviders: string[],
  systemPrompt: string,
  userMessage: string,
  abortSignal: AbortSignal,
  execCtx?: ExecutionContext,  // NEW
): Promise<PlannerDecisionType> {
  // At start:
  execCtx?.traceCollector.onPlannerCall({ /* promptHash, tokenBreakdown, ... */ });
  // After generateText:
  execCtx?.traceCollector.onPlannerCall({ /* full data with token breakdown */ });
}
```

**ExecutorService.execute()** — `src/core/ai/pipeline/ExecutorService.ts` (lines 12–57):
```typescript
// Add execCtx parameter:
async execute(
  toolName: string,
  toolInput: Record<string, unknown>,
  abortSignal: AbortSignal,
  execCtx?: ExecutionContext,  // NEW
): Promise<ToolExecutionResult> {
  // After permission check (line 25) and after execution complete:
  execCtx?.traceCollector.onToolExecution({ toolName, permissionDecision, status, durationMs, ... });
}
```

**RendererService.render()** — `src/core/ai/pipeline/RendererService.ts` (lines 10–57):
```typescript
// Add execCtx parameter:
async *render(
  tier: CostTierType,
  preferredProviders: string[],
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  abortSignal: AbortSignal,
  execCtx?: ExecutionContext,  // NEW
): AsyncGenerator<OrchestratorEvent> {
  // At text-complete (line 43):
  execCtx?.traceCollector.onRendererCall({ promptHash, tokenBreakdown, source: 'renderer', ... });
}
```

**ProviderRouter.selectModel()** — `src/core/ai/router/ProviderRouter.ts` (lines 21–61):
```typescript
// Add execCtx parameter:
async selectModel(
  tier: CostTierType,
  preferredProviders: string[],
  execCtx?: ExecutionContext,  // NEW
): Promise<...> {
  for (let i = 0; i < Math.min(chain.length, 3); i++) {
    const startTime = Date.now();
    // ... existing logic ...
    const durationMs = Date.now() - startTime;
    // Emit provider attempt trace:
    execCtx?.traceCollector.onProviderAttempt({
      attemptNumber: i + 1,
      providerId, modelId,
      startedAt: startTime, endedAt: Date.now(), durationMs,
      outcome: success ? 'success' : 'error',
      circuitBreakerTriggered: false,
    });
  }
}
```

**PromptCacheManager** — `src/core/ai/cache/PromptCacheManager.ts` (lines 1–88):
Add `execCtx?: ExecutionContext` param to `generateCacheKey()` and `invalidateCacheKey()`. Emit `onCacheEvent`.

**MemoryEngine** — `src/core/memory/MemoryEngine.ts` (lines 1–481):
Add `execCtx?: ExecutionContext` param to `assemble()` and `extract()`. Emit `onMemoryEvent` in both methods.

**WriteJournal** — `src/core/storage/WriteJournal.ts` (lines 1–218):
Add `execCtx?: ExecutionContext` to `begin()`. Emit `onWriteJournalEvent` at `markCompleted`/`markFailed`.

---

### 24–27. Storage/Utility Modifications (MODIFIED)

**ErrorStore** — `src/core/storage/stores/ErrorStore.ts` (lines 1–64):
Extend `logError` type to include `severity?: Severity`. Existing FIFO enforcement (lines 18–27) unchanged.

**debugLog** — `src/core/utils/debugLog.ts` (lines 1–22):
Add defensive redaction safety net using `traceRedactor.redactValue()`:
```typescript
import { traceRedactor } from '../telemetry/TraceRedactor';

export function debugLog(level: LogLevel, message: string, data?: unknown): void {
  if (typeof __DEV__ === 'undefined' || __DEV__) {
    const timestamp = new Date().toISOString();
    const prefix = `[NowPilot ${timestamp}] ${message}`;
    const safeData = data !== undefined ? traceRedactor.redactValue(data) : '';
    switch (level) {
      case 'debug': console.debug(prefix, safeData); break;
      case 'info':  console.info(prefix, safeData);  break;
      case 'warn':  console.warn(prefix, safeData);  break;
      case 'error': console.error(prefix, safeData); break;
    }
  }
}
```

**WriteJournalEntry** — `src/core/storage/WriteJournalEntry.ts` (lines 1–64):
Extend `WriteJournalOperation` union type (line 4–12) with `'transaction-log-batch'`:
```typescript
export type WriteJournalOperation =
  | 'update-workspace'
  | 'append-memory-message'
  | 'evict-conversation'
  | 'archive-conversation'
  | 'compact-conversation'
  | 'save-note-with-links'
  | 'update-user-memory'
  | 'export-data'
  | 'transaction-log-batch';  // NEW
```
Also add `'transaction-log-batch'` to the zod enum (lines 33–42).

**OptionsRoot** — `src/components/options/OptionsRoot.tsx` (lines 1–204):
No code changes needed. The `renderSectionContent('diagnostics')` injection point already exists at line 66. The `'diagnostics'` section is already registered at line 35. Simply ensure the Full App wiring passes a `renderSectionContent` prop that maps `'diagnostics'` → `<DiagnosticsSection />`.

---

### 28–32. Test Files (NEW)

**Analog pattern:** `tests/core/ai/pipeline/PlannerService.test.ts` (lines 1–160) + `tests/core/storage/WriteJournal.test.ts` (lines 1–80) + `tests/core/debugLog.test.ts` (lines 1–39)

**Test file template** (from PlannerService.test.ts):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSomething = vi.hoisted(() => vi.fn());
vi.mock('../../src/core/storage/IndexedDBManager', () => ({
  getDB: mockGetDB,
}));

import { ClassUnderTest } from '../../src/core/telemetry/Module';

describe('ModuleName', () => {
  let instance: ClassUnderTest;
  beforeEach(() => { vi.clearAllMocks(); instance = new ClassUnderTest(...); });

  it('descriptive test name', async () => {
    // arrange → act → assert
  });
});
```

**Mock patterns** (from WriteJournal.test.ts lines 3–42):
```typescript
const { mockGetDB, mockStoreMap, clearMockStore } = vi.hoisted(() => {
  const storeMap = new Map<string, Record<string, unknown>>();
  const mockStore = {
    put: vi.fn((val) => { storeMap.set(val.id as string, val); return Promise.resolve(val.id); }),
    get: vi.fn((key) => Promise.resolve(storeMap.get(key))),
    getAll: vi.fn(() => Promise.resolve(Array.from(storeMap.values()))),
    getAllFromIndex: vi.fn(() => Promise.resolve([])),
    delete: vi.fn((key) => { storeMap.delete(key); return Promise.resolve(); }),
    count: vi.fn(() => Promise.resolve(storeMap.size)),
    clear: vi.fn(() => { storeMap.clear(); return Promise.resolve(); }),
    index: vi.fn(() => ({ getAll: vi.fn(() => Promise.resolve([])) })),
  };
  const mockGetDB = vi.fn(() => Promise.resolve({
    transaction: vi.fn(() => ({ store: mockStore, done: Promise.resolve(undefined) })),
  }));
  return { mockGetDB, mockStoreMap, clearMockStore: () => storeMap.clear() };
});
```

**Test files to create:**
- `tests/core/telemetry/TraceRedactor.test.ts` — all redaction patterns + edge cases (nested objects, arrays, empty strings, null/undefined)
- `tests/core/telemetry/AITransactionLog.test.ts` — lifecycle (start/complete/fail), batch-write, recovery, severity computation
- `tests/core/telemetry/pruning.test.ts` — count-limit, time-limit, failure-prioritized, debounced scheduling
- `tests/core/telemetry/export.test.ts` — single export (JSON), bulk export (ZIP), manifest, privacy mode, redaction

**Vitest config** (from `vitest.config.ts`):
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
```

---

## Shared Patterns

### Class + Singleton Export

**Source:** `src/core/storage/stores/ErrorStore.ts` (lines 6–64), `src/core/context/ContextOptimizer.ts` (lines 557–572)

**Apply to:** `AITransactionLog.ts`, `TraceRedactor.ts`

```typescript
export class ServiceName {
  constructor(private dep1: Type1, private dep2: Type2) {}
  // ... methods ...
}

// Wire at module bottom to avoid circular dependencies:
import { dep1 } from './dep1';
import { dep2 } from './dep2';
export const serviceName = new ServiceName(dep1, dep2);
```

### Constructor Dependency Injection

**Source:** `src/core/ai/pipeline/AgentOrchestrator.ts` (lines 34–40)

**Apply to:** `AITransactionLog.ts`, all pipeline service modifications

```typescript
constructor(
  private planner: PlannerService,
  private executor: ExecutorService,
  private renderer: RendererService,
  private router: ProviderRouter,
  private memoryEngine: MemoryEngine,
) {}
```

**Anti-pattern:** Do NOT inject ExecutionContext into constructors — it is request-scoped, passed through method parameters only.

### Error Handling (try/catch + debugLog)

**Source:** `src/core/storage/stores/ErrorStore.ts` (lines 15–31), `src/core/ai/pipeline/PlannerService.ts` (lines 27–58)

**Apply to:** All new telemetry files, all modified services

```typescript
async someMethod(): Promise<Result> {
  try {
    const db = await getDB();
    // ... operation ...
    return result;
  } catch (err) {
    debugLog('error', '[ServiceName] operation failed', { error: err });
    // Return safe fallback or rethrow
  }
}
```

### Direct Path Imports (No Barrel Files)

**Source:** All existing files — use direct file-to-file imports

**Apply to:** All new telemetry files

```typescript
import { debugLog } from '../../utils/debugLog';          // Correct
import { debugLog } from '../../utils';                   // Wrong — no barrel
import { getDB } from '../IndexedDBManager';              // Correct
```

### Interface + Default Implementation

**Source:** `src/core/ai/tools/PermissionService.ts` (existing pattern)

**Apply to:** `TraceCollector` interface in `types.ts`

```typescript
export interface TraceCollector {
  onPlannerCall(event: Omit<PromptTrace, 'id' | 'operationId'>): void;
  onProviderAttempt(event: Omit<ProviderAttempt, 'id'>): void;
  // ...
  getAllEvents(): TraceEvent[];
  clear(): void;
}

export class DefaultTraceCollector implements TraceCollector {
  private events: TraceEvent[] = [];
  onPlannerCall(event) { this.events.push({ type: 'planner', ...event }); }
  getAllEvents() { return this.events; }
  clear() { this.events = []; }
}
```

### Zustand Store (v5 + chrome.storage.local)

**Source:** `src/core/stores/workspaceStore.ts` (lines 1–91)

**Apply to:** `src/core/stores/diagnosticsStore.ts`

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const chromeLocalStorage = createJSONStorage<StateType>(() => ({
  getItem: (name) => chrome.storage.local.get(name).then(r => (r[name] as string) ?? null),
  setItem: (name, value) => chrome.storage.local.set({ [name]: value }),
  removeItem: (name) => chrome.storage.local.remove(name),
}));

export const useStore = create<StateType>()(
  persist((set) => ({ ... }), { name: 'np_key_prefix', storage: chromeLocalStorage }),
);
```

### AntD v6 Component Usage

**Source:** `src/components/options/OptionsRoot.tsx` (Button, Input.Search, Flex, theme.useToken) + RESEARCH.md patterns

**Apply to:** All diagnostics components

```tsx
import { Button, Flex, Input, theme } from 'antd';
const { token } = theme.useToken();
// Use token.colorBgContainer, token.colorBorderSecondary, token.colorTextSecondary, etc.
```

### WriteJournal Lifecycle (begin → markStep → markCompleted)

**Source:** `src/core/storage/WriteJournal.ts` (lines 10–89)

**Apply to:** `AITransactionLog.close()` batch-write

```typescript
const journal = await writeJournal.begin(operation, targetIds, steps);
try {
  await writeJournal.markStepStart(journal.id, 0);
  // ... write ...
  await writeJournal.markStepComplete(journal.id, 0);
  await writeJournal.markCompleted(journal.id);
} catch (err) {
  await writeJournal.markFailed(journal.id);
  throw err;
}
```

### debugLog Safety Net Pattern

**Source:** `src/core/utils/debugLog.ts` (lines 1–22)

**Apply to:** `debugLog.ts` modification

```typescript
export function debugLog(level: LogLevel, message: string, data?: unknown): void {
  if (typeof __DEV__ === 'undefined' || __DEV__) {
    const safeData = data !== undefined ? traceRedactor.redactValue(data) : '';
    // ... console routing with safeData ...
  }
}
```

### `vi.hoisted()` Mock Pattern (Vitest)

**Source:** `tests/core/ai/pipeline/PlannerService.test.ts` (lines 1–8), `tests/core/storage/WriteJournal.test.ts` (lines 3–38)

**Apply to:** All telemetry test files

```typescript
const mockGenerateText = vi.hoisted(() => vi.fn());
vi.mock('ai', () => ({ generateText: mockGenerateText }));

// Module import must come after vi.mock
import { ClassUnderTest } from '../../src/core/telemetry/Module';
```

### Zod Schema Co-location

**Source:** `src/core/context/contextTypes.ts` (lines 1–145) — types and schemas in same file

**Apply to:** `src/core/telemetry/types.ts` — optionally add zod schemas for trace validation

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/telemetry/export.ts` | utility | file-I/O | ZIP assembly via JSZip is a new capability; no existing browser ZIP export pattern. Use RESEARCH.md §6 (lines 878–961) for implementation pattern. |
| `src/components/diagnostics/ProviderTimeline.tsx` | component | request-response | AntD Timeline has not been used in existing codebase. Use RESEARCH.md component mapping (lines 1052–1054) and Context7-verified antd v6 Timeline API. |
| `src/components/diagnostics/ToolCallDescriptions.tsx` | component | request-response | AntD Descriptions has not been used. Use RESEARCH.md (lines 1053–1055) pattern. |
| `src/components/diagnostics/CacheStats.tsx` | component | request-response | AntD Statistic has not been used. Use RESEARCH.md (line 1055) pattern. |

## Metadata

**Analog search scope:** `src/core/`, `src/components/`, `tests/core/`
**Files scanned:** 55+ source files, 10+ test files
**Pattern extraction date:** 2026-07-13

### Key Patterns Identified
- **Class + singleton export** — all services follow this (ErrorStore, ContextOptimizer, PromptCacheManager, WriteJournal, ProviderRouter)
- **Constructor dependency injection** — all pipeline services (AgentOrchestrator, PlannerService, ExecutorService, RendererService, ProviderRouter)
- **Direct path imports** — no barrel/index files anywhere in the project
- **Error handling with debugLog** — try/catch wrapping all IndexedDB operations with structured debugLog calls
- **Zustand v5 + persist + chrome.storage.local** — workspaceStore (np_workspace key) and providerStore (np_providers key)
- **antd v6 theme.useToken()** — inline styles using token for consistent colors/spacing
- **`vi.hoisted()` mock variables** — Vitest mock pattern with hoisted factories and `vi.mock` before imports
- **WriteJournal-coordinated batch writes** — used for cross-store consistency in workspace persists and transaction-log batch writes
- **`__DEV__` guard** — all debugLog calls wrapped in dev-only check; applied to all new telemetry debug logging
