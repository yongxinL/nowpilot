# Phase 6: Transaction Logging and Diagnostics - Research

**Researched:** 2026-07-13
**Domain:** Telemetry / Diagnostics / Observable AI Runtime
**Confidence:** HIGH

## Summary

Phase 6 introduces a comprehensive telemetry and diagnostics system that traces every AI, MCP, tool, provider, cache, memory, and storage operation in NowPilot. The architecture follows a **hybrid injection model** where `AgentOrchestrator.runWithContext()` owns the transaction lifecycle (operationId, start/complete/fail/abort, final persistence) and pipeline services (PlannerService, ExecutorService, RendererService, ProviderRouter, MemoryEngine, PromptCacheManager, WriteJournal) emit typed trace events through a callback interface (`TraceCollector`), never coupling directly to `AITransactionLogDB`.

Redaction is the critical security boundary: `TraceRedactor` runs as middleware inside `AITransactionLog` before any data hits IndexedDB, debugLog, or export. Typed placeholders (`[REDACTED:API_KEY]`, etc.) preserve field visibility. `debugLog` also gains a defensive auto-redaction safety net to prevent accidental leaks.

The `DiagnosticsPanel` lives in Full App → Options (section already registered), providing a master-detail layout with filterable transaction list, provider timelines, tool call descriptions, and export. Deep-linking via `operationId` query param enables error-toast "Open Diagnostics" navigation.

**Primary recommendation:** Build the `AITransactionLog` class+singleton first with `ExecutionContext` + `TraceCollector` interfaces. Wire through `AgentOrchestrator.runWithContext()`. Then implement `TraceRedactor` middleware, extend `AITransactionLogDB` schema (DB_VERSION 3), build `DiagnosticsPanel` components, and add `pruning.ts` / `export.ts` utilities. JSZip must be installed for export.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Transaction lifecycle (start/complete/fail/abort) | API / Backend (AgentOrchestrator) | — | Orchestrator owns the full request lifecycle |
| Trace event emission | API / Backend (Pipeline services) | — | Services emit typed events through callback interface |
| Trace redaction | API / Backend (AITransactionLog) | — | Middleware step before persistence; must be server-side |
| Trace persistence | Database / Storage (IndexedDB) | — | IndexedDB via idb, WriteJournal for consistency |
| Trace pruning | Database / Storage (pruning.ts) | — | Scheduled timer + startup scan |
| Trace export | Browser / Client (export.ts) | — | JSZip assembly in browser, file download |
| DiagnosticsPanel UI | Browser / Client (React) | — | Full App Tab only, AntD components |
| Error toast deep-linking | Browser / Client (React) | Frontend Server (shell) | URL query param navigation |
| Diagnostic/Privacy mode storage | Browser / Client (Zustand/chrome.storage) | — | Options section toggles |

## User Constraints (from CONTEXT.md)

### Locked Decisions

| ID | Decision | Constraint |
|----|----------|------------|
| D-01 | Hybrid Architecture: AgentOrchestrator owns transaction lifecycle; services emit typed trace events through callback interface only | No service couples directly to AITransactionLogDB |
| D-02 | Request-Scoped ExecutionContext with TraceCollector, operationId, AbortSignal | Passed through all participating services |
| D-03 | Hybrid Checkpoint + Final Batch Write: minimal start record, in-memory accumulation, batch-write on close | Startup recovery marks orphaned transactions as aborted |
| D-04 | Single ProviderTrace with attempts[] array | One ProviderTrace per operation, retries appended to attempts[] |
| D-05 | Participating Services: PlannerService, ExecutorService, RendererService, ProviderRouter, MemoryEngine, PromptCacheManager, WriteJournal | All emit through TraceCollector |
| D-06 | Two-Level Trace Verbosity: Normal (metadata only) / Diagnostic (redacted previews) | All data passes through TraceRedactor regardless of mode |
| D-07 | TraceCollector interface in pipelineTypes.ts | Typed events: onPlannerCall, onProviderAttempt, onToolExecution, onRendererCall, onCacheEvent, onMemoryEvent, onWriteJournalEvent |
| D-08 | Eager Redaction Before Persistence | Raw sensitive data must never be written to any storage |
| D-09 | Explicit Middleware Inside AITransactionLog | Not ad-hoc utility calls from individual services |
| D-10 | debugLog as Defensive Safety Net | Auto-redaction on all arguments |
| D-11 | Typed Placeholders for Redacted Values | `[REDACTED:API_KEY]`, `[REDACTED:BEARER_TOKEN]`, etc. |
| D-12 | Master-Detail Layout in DiagnosticsPanel | Transaction list (left) + Detail panel (right) |
| D-13 | Full Filter Bar | type, status, provider, severity, date range, free-text search |
| D-14 | Deep-Linking via Query Param | `app.html?page=options&section=diagnostics&operationId=<id>` |
| D-15 | AntD Component Mapping | Timeline (provider attempts), Descriptions (tool calls), Statistic (cache), Progress (context), Typography.Text copyable (operationIds) |
| D-16 | OptionsRoot Integration | `renderSectionContent('diagnostics')` injection |
| D-17 | All Trace Types, User-Selectable Export Scope | Single operation → JSON; Multiple → ZIP with manifest |
| D-18 | Standard Metadata Manifest | manifest.json with version, timestamp, count, filters, etc. |
| D-19 | Single-Operation Export | "Export Trace" action per transaction row |
| D-20 | Export is Independent Copy | No pin-management or retention exceptions |
| D-21 | operationId as Universal Correlation Key | Every trace carries the same operationId |
| D-22 | parentOperationId Only for True Nested Operations | Normal pipeline stages share same operationId |
| D-23 | Retries Under Same operationId | Recorded in ProviderTrace.attempts[] |
| D-24 | Normalized Storage, Assembled Query | AITransactionLogDB.getTraceTree(operationId) assembles from separate stores |
| D-25 | Hybrid Retention (Time + Count) | Whichever exceeded first triggers pruning |
| D-26 | Tiered Retention Limits | Transactions: 30d/5000, Normal traces: 14d/2000, Diagnostic: 7d/500, Errors: 30d/1000 |
| D-27 | Failure-Prioritized Pruning | Failed transactions retain priority; oldest successful pruned first |
| D-28 | Export Does Not Affect Retention | Normal pruning policy regardless of export history |
| D-29 | Scheduled + Startup Pruning | Startup scan + every 5 min; debounced on transaction close |
| D-30 | Five Severity Levels | DEBUG, INFO, WARNING, ERROR, CRITICAL |
| D-31 | Severity Classification | CRITICAL for storage/journal failures; ERROR for pipeline/tool failures; WARNING for retries; INFO for success; DEBUG for internals |
| D-32 | Severity Stored on AITransaction | Worst severity among all traces for that operation |
| D-33 | Selective Success Tracing | 100% for failures; latest 500 detailed for success |
| D-34 | Payload Truncation | Normal: 2KB prompt, 4KB tool I/O; Diagnostic: larger but hard-capped |
| D-35 | Buffered Trace Collection | Synchronous emit, no IndexedDB writes during execution, single batch-write on close |
| D-36 | Debounced Pruning Scheduling | Never blocks pipeline |
| D-37 | Hidden by Default, Expandable on Click | Normal mode: "Show redacted details" toggle; Diagnostic mode: inline redacted previews |
| D-38 | Privacy Mode as Separate Stricter Toggle | Metadata-only; overrides Diagnostic Mode |
| D-39 | Toggle Locations | Options → Diagnostics section + DiagnosticsPanel top |

### the agent's Discretion

- Exact shape of `ExecutionContext` and `TraceCollector` interfaces
- TraceRedactor regex patterns — from product spec §4.4
- AITransactionLog internal architecture — class+singleton with constructor DI
- DiagnosticsPanel component tree — TransactionTable, TraceDetailPanel, ProviderTimeline, ToolCallDescriptions, CacheStats, ExportButton
- Export serialization format and ZIP assembly — JSZip
- Pruning implementation — periodic timer + startup + debounced
- Diagnostic/Privacy mode state storage — Zustand store or chrome.storage.local
- Exact IndexedDB schema updates for DB_VERSION 3
- Crash recovery logic — startup scan for started/streaming → mark as aborted
- debugLog auto-redaction wrapper pattern

### Deferred Ideas (OUT OF SCOPE)

- Export merge back / import for diagnostics
- Real-time diagnostics streaming to external dashboard
- Custom retention policy configuration per user
- Diagnostics analytics / aggregate stats over time
- Performance profiling via trace data

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TELE-01 | AITransactionLog — tracks every AI/MCP/tool/provider operation | §1 Integration Touchpoints, §3 Types |
| TELE-02 | PromptTrace — token breakdown, truncation, cache hits per operation | §3 Types (PromptTrace), §8 TraceCollector events |
| TELE-03 | ToolTrace — tool calls with permission decisions and outcomes | §3 Types (ToolTrace), §8 ExecutorService hook |
| TELE-04 | ProviderTrace — per-provider attempt tracking with circuit breaker state | §3 Types (ProviderTrace), §8 ProviderRouter hook |
| TELE-05 | TraceRedactor — redacts API keys, tokens, raw bodies before persistence | §4 Redaction Implementation Strategy |
| TELE-06 | DiagnosticsPanel in Full App → Options with Tables, Timelines, export | §7 DiagnosticsPanel Architecture |
| TELE-07 | Error toast with "Open Diagnostics" link from Side Panel | §8 Integration Touchpoints (Error toast) |
| DATA-03 | Export debug bundle from Diagnostics | §6 Export Implementation |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | ^8.0.3 | IndexedDB wrapper | Already installed (Phase 2); transactional CRUD for all trace stores [VERIFIED: npm registry] |
| Zod | ^4.4.3 | Schema validation | Already installed; type-safe trace serialization/deserialization [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| JSZip | ^3.10.1 | ZIP file creation for export bundles | Export multiple traces as ZIP with manifest.json [VERIFIED: npm registry] |
| Ant Design | ^6.x | UI components for DiagnosticsPanel | Timeline, Descriptions, Statistic, Table, Progress, Typography.Text copyable [CITED: ant.design components API] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSZip | Manual ZIP implementation | JSZip is battle-tested (45M weekly downloads, High source reputation), handles streaming, supports compression options. Hand-rolling ZIP is error-prone with complex binary format |
| JSZip | fflate | fflate is faster but JSZip has broader ecosystem support, better documentation, and simpler API for our use case (static JSON files, not streaming compression) |

**Installation:**
```bash
pnpm add jszip
```

**No new runtime dependencies beyond JSZip.** All other libraries (idb, zod, antd, react, zustand) are already installed from prior phases.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| jszip | npm | ~10 yrs | 45M/wk | git+https://github.com/Stuk/jszip.git | OK | Approved — install required |
| idb | npm | ~8 yrs | 17.5M/wk | git://github.com/jakearchibald/idb.git | OK | Already installed |
| zod | npm | ~5 yrs | 224M/wk | git+https://github.com/colinhacks/zod.git | OK | Already installed |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** none

## Architecture Patterns

### System Architecture Diagram

```
User Message / Action
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ AgentOrchestrator.runWithContext(optimizedContext)         │
│                                                            │
│  1. Create ExecutionContext {                              │
│       traceCollector, operationId, abortSignal,            │
│       verbosity, privacyMode                               │
│     }                                                      │
│  2. AITransactionLog.start(operationId) ──► IndexedDB     │
│       (minimal transaction record: status=started)         │
│                                                            │
│  3. ──ExecutionContext──► Pipeline Services:              │
│     ├─► PlannerService.plan()                              │
│     │     traceCollector.onPlannerCall({...})             │
│     │     └─► ProviderRouter.selectModel()                │
│     │           traceCollector.onProviderAttempt({...})   │
│     ├─► ExecutorService.execute()                         │
│     │     traceCollector.onToolExecution({...})           │
│     └─► RendererService.render()                          │
│           traceCollector.onRendererCall({...})            │
│                                                            │
│  4. ──ExecutionContext──► Supporting Services:            │
│     ├─► MemoryEngine.assemble() / extract()               │
│     │     traceCollector.onMemoryEvent({...})             │
│     ├─► PromptCacheManager                                │
│     │     traceCollector.onCacheEvent({...})              │
│     └─► WriteJournal (batch-write on close)               │
│           traceCollector.onWriteJournalEvent({...})       │
│                                                            │
│  5. On complete/fail/abort:                                │
│     AITransactionLog.close(operationId)                    │
│       └─► Collect all in-memory traces                     │
│       └─► TraceRedactor.redact(traces) — ALL modes        │
│       └─► WriteJournal.begin('transaction-log-batch')     │
│       └─► Batch-write redacted traces to IndexedDB         │
│       └─► WriteJournal.markCompleted()                    │
│       └─► Schedule debounced prune                        │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Error Toast (Side Panel)                                   │
│   └─► `app.html?page=options&section=diagnostics&         │
│        operationId=<id>`                                   │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ DiagnosticsPanel (Full App → Options → Diagnostics)        │
│                                                            │
│  ┌─ Filter Bar ──────────────────────────────────────┐   │
│  │ [type ▾] [status ▾] [prov ▾] [sev ▾] [date ▾]     │   │
│  │ [Search...]    [Diag: OFF] [Priv: OFF] [Export ⤓] │   │
│  ├───────────────────────┬────────────────────────────┤   │
│  │ TransactionTable      │ TraceDetailPanel           │   │
│  │ ┌───────────────────┐ │ ┌────────────────────────┐ │   │
│  │ │ rows with status  │ │ │ ProviderTimeline       │ │   │
│  │ │ icons, copyable   │ │ │ ToolCallDescriptions   │ │   │
│  │ │ operationIds      │ │ │ CacheStats             │ │   │
│  │ │ "Export Trace"    │ │ │ PromptHashes           │ │   │
│  │ │ per row           │ │ │ [Show redacted ▸]      │ │   │
│  │ └───────────────────┘ │ └────────────────────────┘ │   │
│  └───────────────────────┴────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── core/
│   └── telemetry/
│       ├── types.ts              # All trace types, TraceCollector, ExecutionContext, Severity enum
│       ├── AITransactionLog.ts   # Orchestration class + singleton
│       ├── TraceRedactor.ts      # Pattern-based redaction middleware
│       ├── AITransactionLogDB.ts # Extended DB methods, getTraceTree()
│       ├── pruning.ts            # Retention pruning logic
│       └── export.ts             # Debug bundle serialization and ZIP assembly
├── components/
│   ├── options/
│   │   ├── DiagnosticsPanel.tsx  # Master-detail layout with filter bar
│   │   └── DiagnosticsSection.tsx # Options page wrapper
│   └── diagnostics/
│       ├── TransactionTable.tsx   # Filterable transaction list
│       ├── TraceDetailPanel.tsx   # Full trace tree detail view
│       ├── ProviderTimeline.tsx   # AntD Timeline for provider attempts
│       ├── ToolCallDescriptions.tsx # AntD Descriptions for tool calls
│       └── CacheStats.tsx         # AntD Statistic cards
└── stores/
    └── diagnosticsStore.ts        # Zustand store for filter state, selectedTransaction, modes
tests/
└── core/
    └── telemetry/
        ├── AITransactionLog.test.ts
        ├── TraceRedactor.test.ts
        ├── pruning.test.ts
        └── export.test.ts
```

### Pattern 1: Class + Singleton Export

**What:** All registry and service classes follow this pattern. Export both the class (for extensibility/testability) and a pre-wired singleton instance (for app-wide use).

**When to use:** For services that have exactly one logical instance in the application.

**Example:**
```typescript
// Source: src/core/storage/stores/ErrorStore.ts (existing pattern)
export class AITransactionLog {
  constructor(
    private db: AITransactionLogDB,
    private redactor: TraceRedactor,
    private writeJournal: WriteJournal,
  ) {}
  // ...
}
export const aiTransactionLog = new AITransactionLog(
  aiTransactionLogDB, traceRedactor, writeJournal,
);
```

### Pattern 2: Interface + Default Implementation

**What:** Define a TypeScript interface for the contract, provide a concrete default implementation. Consumers depend on the interface; DI resolves the implementation.

**When to use:** For components that may have different implementations (e.g., TraceCollector interface with DefaultTraceCollector).

**Example:**
```typescript
// Source: src/core/ai/tools/PermissionService.ts (existing pattern)
export interface TraceCollector {
  onPlannerCall(event: PlannerCallEvent): void;
  onProviderAttempt(event: ProviderAttemptEvent): void;
  onToolExecution(event: ToolExecutionEvent): void;
  // ...
}
export class DefaultTraceCollector implements TraceCollector {
  private events: TraceEvent[] = [];
  onPlannerCall(event: PlannerCallEvent): void { this.events.push(event); }
  // ...
}
```

### Pattern 3: WriteJournal Batch-Write Lifecycle

**What:** Multi-store writes wrapped in a journal entry: begin → markStepStart → write → markStepComplete → markCompleted. Idempotent recovery on startup.

**When to use:** Whenever multiple IndexedDB stores need to be written atomically (e.g., transaction close batch-write).

**Example:**
```typescript
// Source: src/core/storage/WriteJournal.ts (existing pattern)
const journal = await writeJournal.begin(
  'transaction-log-batch',
  { transaction_log_transactions: operationId },
  steps,
);
await writeJournal.markStepStart(journal.id, 0);
// ... batch writes ...
await writeJournal.markStepComplete(journal.id, 0);
await writeJournal.markCompleted(journal.id);
```

### Pattern 4: Constructor Dependency Injection

**What:** Dependencies injected via constructor parameters, not module-level imports of singletons. Enables test mocking and avoids circular dependencies.

**When to use:** All service classes. The class constructor declares what it needs; DI wiring happens at module bottom.

**Example:**
```typescript
// Source: src/core/ai/pipeline/AgentOrchestrator.ts (existing pattern, line 34)
constructor(
  private planner: PlannerService,
  private executor: ExecutorService,
  private renderer: RendererService,
  private router: ProviderRouter,
  private memoryEngine: MemoryEngine,
) {}
```

### Anti-Patterns to Avoid
- **Direct import of aiTransactionLogDB in pipeline services:** Services must emit through TraceCollector interface, never directly to AITransactionLogDB. Violates D-01.
- **Lazy redaction at display time:** Redaction happens before persistence, not at UI render. Testing must verify raw data never reaches IndexedDB. Violates D-08.
- **Constructor DI for ExecutionContext:** ExecutionContext is request-scoped, not service-scoped. Create it per-request in AgentOrchestrator.runWithContext() and pass it. Don't inject it into service constructors.
- **Using dispose() or finalization for trace cleanup:** Trace cleanup is fire-and-forget (pruning), not tied to resource lifecycle. Don't use DisposeBag patterns for what should be a scheduled cleanup.
- **Circular telemetry imports:** telemetry/ code must not import from pipeline/ services. Communication is one-way: pipeline emits → TraceCollector → AITransactionLog.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP archive creation | Manual ZIP binary format | JSZip (^3.10.1) | ZIP format is complex (CRC32, deflate, directory structure). JSZip handles edge cases, streaming, compression options, binary encoding |
| Secure random operation IDs | Math.random() | crypto.randomUUID() | Already used in WriteJournal (line 15). Cryptographically strong, collision-resistant, no external dependency |
| IndexedDB transaction management | Raw indexedDB API | idb (^8.0.3) | Already installed. Provides promise-based wrapper, proper transaction lifecycle, error handling |
| Debounced scheduling | setTimeout chains | Simple setTimeout-based debounce function | No heavy scheduler library needed — a lightweight 30-line debounce wrapper suffices for pruning |
| String hashing for prompt hashes | Custom hash | DJB2 from PromptCacheManager | Already implemented in PromptCacheManager.simpleHash(). Reuse for consistent prompt hashing in PromptTrace |

**Key insight:** The trace system should be as lightweight as possible during execution. In-memory accumulation (D-35) means no I/O on the hot path. The biggest risk is IndexedDB contention during batch-write — mitigated by using a single WriteJournal-coordinated transaction.

## Runtime State Inventory

> Not a rename/refactor/migration phase. No runtime state changes needed. Existing database records (DB_VERSION=2) are schemaless at the value level; migration to v3 adds new stores without modifying existing ones.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing transaction_log_* stores with stub schemas (DB_VERSION=2) | Schema evolution to DB_VERSION=3 adds new stores (cache_traces, memory_traces, write_journal_traces) and extends existing store value types with new fields |
| Live service config | None — diagnostics is new functionality | No existing service config affected |
| OS-registered state | None | No OS-level registrations |
| Secrets/env vars | None | No new secrets required |
| Build artifacts | None | JSZip added as dependency |

## Common Pitfalls

### Pitfall 1: Redaction Not Applied Before IndexedDB Write
**What goes wrong:** Raw API keys or tokens leak into IndexedDB because someone calls `db.put()` without passing through TraceRedactor first.
**Why it happens:** Multiple code paths to `AITransactionLogDB` (stub methods are public). Developer bypasses AITransactionLog middleware.
**How to avoid:** Make AITransactionLogDB methods package-private or only export via `AITransactionLog` singleton. Gate all persistence through `AITransactionLog.close()` which always runs TraceRedactor. Test: `vi.spyOn(aiTransactionLogDB, 'logTransaction')` — assert it's never called with raw secrets in test inputs.
**Warning signs:** Direct imports of `aiTransactionLogDB` from non-telemetry modules. Redaction regex not matching test payloads.

### Pitfall 2: IndexedDB Write Contention During Batch Close
**What goes wrong:** Large trace batch causes slow IndexedDB transaction, blocking new operations.
**Why it happens:** Hundreds of traces accumulated during a long-running agent session; single `put()` for each trace in one transaction.
**How to avoid:** Use `idb`'s transaction scope properly — batch all writes into a single IDBTransaction with multiple `put()` calls. IndexedDB auto-commits when the microtask queue drains if no listeners are active. Keep the transaction alive by holding a reference until all `put()` calls complete.
**Warning signs:** Transaction timeout errors in IndexedDB. "Transaction is already committed" errors.

### Pitfall 3: TraceCollector Events Emitted After Transaction Close
**What goes wrong:** Services (MemoryEngine.extract, fire-and-forget) emit trace events after AITransactionLog.close() has already persisted.
**Why it happens:** D-04 makes MemoryEngine.extract fire-and-forget — it runs after the renderer completes. If the transaction closes before extraction finishes, trace events arrive after the batch-write.
**How to avoid:** Design TraceCollector to accept late-arriving events and write them individually (bypassed batch-write path) with operationId. Or, collect extraction trace events separately and attach them to the transaction record on the next prune cycle. Per D-24 (normalized storage, assembled query), late-arriving traces still have operationId index.
**Warning signs:** getTraceTree(operationId) missing memory traces for completed transactions. "No listener for operationId" errors.

### Pitfall 4: MV3 Service Worker Termination During Batch Write
**What goes wrong:** Full App tab is closed mid-batch-write. The transaction is in-flight but never completes. On next open, some traces are persisted and others aren't.
**Why it happens:** MV3 can terminate pages at any point. IndexedDB transactions auto-commit at the end of the microtask queue, but if the JS context is destroyed mid-task, partial writes occur.
**How to avoid:** WriteJournal.begin() before any batch writes. On startup, recovery scans for pending transactions (status: started/streaming) and marks them as aborted. The WriteJournal recovery mechanism (src/core/storage/WriteJournal.ts recover()) handles orphaned entries. AITransactionLog.close() uses WriteJournal to make the batch-write atomic and recoverable.
**Warning signs:** Transactions with status "started" persisting across extension restarts without being marked aborted.

## Code Examples

### ExecutionContext Creation (in AgentOrchestrator)
```typescript
// Integration point: src/core/ai/pipeline/AgentOrchestrator.ts:79 runWithContext()
// Source: D-02 (ExecutionContext) + D-06 (verbosity) from CONTEXT.md

import { ExecutionContext, DefaultTraceCollector, TraceVerbosity } from '../../telemetry/types';

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

  await aiTransactionLog.start(operationId, execCtx);

  try {
    // ... planner/executor/renderer loop with execCtx ...
    await aiTransactionLog.complete(operationId, traceCollector);
  } catch (err) {
    await aiTransactionLog.fail(operationId, err, traceCollector);
    throw err;
  }
}
```

### TraceRedactor Usage Pattern
```typescript
// Source: D-09 (middleware inside AITransactionLog) + product spec §4.4 redaction rules

export class TraceRedactor {
  private readonly patterns: Array<{ regex: RegExp; placeholder: string }> = [
    { regex: /sk-[A-Za-z0-9_-]+/g,                              placeholder: '[REDACTED:API_KEY]' },
    { regex: /key-[A-Za-z0-9_-]+/g,                             placeholder: '[REDACTED:API_KEY]' },
    { regex: /Bearer\s+[A-Za-z0-9._-]+/gi,                      placeholder: '[REDACTED:BEARER_TOKEN]' },
    { regex: /JSESSIONID=[^;\s]+/gi,                            placeholder: '[REDACTED:JSESSIONID]' },
    { regex: /sysparm_ck[=:]\s*[^&\s]+/gi,                      placeholder: '[REDACTED:sysparmCK]' },
    { regex: /g_ck[=:]\s*[^&\s]+/gi,                            placeholder: '[REDACTED:g_ck]' },
    { regex: /X-MCP-Auth-[A-Za-z0-9._-]+/gi,                   placeholder: '[REDACTED:MCP_AUTH]' },
  ];

  redact(value: string): string {
    let result = value;
    for (const { regex, placeholder } of this.patterns) {
      result = result.replace(regex, placeholder);
    }
    return result;
  }

  redactObject<T extends Record<string, unknown>>(obj: T): T {
    const redacted = { ...obj };
    for (const [key, value] of Object.entries(redacted)) {
      if (typeof value === 'string') {
        redacted[key] = this.redact(value) as T[Extract<keyof T, string>];
      }
    }
    return redacted;
  }
}
```

### IndexedDB Schema Extension (v2 → v3)
```typescript
// Source: src/core/storage/IndexedDBManager.ts (existing pattern, line 170)
// New stores for DB_VERSION 3; existing stores extended with additional fields

if (oldVersion < 3) {
  // New stores for extended trace types
  const cacheStore = db.createObjectStore('transaction_log_cacheTraces', { keyPath: 'id' });
  cacheStore.createIndex('by-operationId', 'operationId');

  const memoryStore = db.createObjectStore('transaction_log_memoryTraces', { keyPath: 'id' });
  memoryStore.createIndex('by-operationId', 'operationId');

  const journalStore = db.createObjectStore('transaction_log_writeJournalTraces', { keyPath: 'id' });
  journalStore.createIndex('by-operationId', 'operationId');

  // Add indexes to existing stores for query performance
  const txStore = (db as IDBDatabase).transaction('transaction_log_transactions', 'readwrite').objectStore('transaction_log_transactions');
  txStore.createIndex('by-operationId', 'operationId');
  txStore.createIndex('by-status', 'status');
  txStore.createIndex('by-severity', 'severity');
  txStore.createIndex('by-timestamp', 'startTime');

  // Existing stores: new fields added via put() at runtime (schemaless values)
}
```

### getTraceTree Assembler Pattern
```typescript
// Source: D-24 (normalized storage, assembled query)
// In: src/core/telemetry/AITransactionLogDB.ts

async getTraceTree(operationId: string): Promise<TraceTree | undefined> {
  const db = await getDB();
  const tx = await db.get('transaction_log_transactions', operationId);
  if (!tx) return undefined;

  const prompts = await db.getAllFromIndex('transaction_log_promptTraces', 'by-operationId', operationId);
  const tools = await db.getAllFromIndex('transaction_log_toolTraces', 'by-operationId', operationId);
  const providers = await db.getAllFromIndex('transaction_log_providerTraces', 'by-operationId', operationId);
  const cache = await db.getAllFromIndex('transaction_log_cacheTraces', 'by-operationId', operationId);
  const memory = await db.getAllFromIndex('transaction_log_memoryTraces', 'by-operationId', operationId);
  const journal = await db.getAllFromIndex('transaction_log_writeJournalTraces', 'by-operationId', operationId);

  return {
    transaction: tx,
    promptTraces: prompts,
    toolTraces: tools,
    providerTraces: providers,
    cacheTraces: cache,
    memoryTraces: memory,
    writeJournalTraces: journal,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stub AITransactionLogDB (93 lines, simplified shapes) | Full product spec types with normalized stores, indexes, getTraceTree() | Phase 6 | Backward compatible — existing records survive (schemaless values) |
| DB_VERSION=2 with 4 log stores | DB_VERSION=3 with 7 log stores + indexes on operationId, status, severity, timestamp | Phase 6 | Requires migration (oldVersion < 3 block). Existing v2 stores extended with new optional fields |
| Console-only debugLog | debugLog with auto-redaction safety net | Phase 6 | All existing debugLog calls continue to work; redaction is transparent |
| No diagnostics UI | DiagnosticsPanel in Full App → Options | Phase 6 | New UI section; no existing UI affected |
| No JSZip dependency | JSZip ^3.10.1 for export | Phase 6 | New dependency; ~50KB gzipped |

**Deprecated/outdated:**
- AITransactionLogDB.logPromptTrace's `cached: boolean` field — replaced by full PromptTrace with cache statistics
- AITransactionLogDB.logProviderTrace's `attempts: number` field — replaced by `attempts[]` array with per-attempt metadata
- IndexedDBManager's stub `transaction_log_*` value schemas — extended inline with new fields; no separate migration store needed (schemaless values)

## TypeScript Types & Interfaces

### Core Types (src/core/telemetry/types.ts)

```typescript
// =========================================================================
// Severity Enum (D-30, D-31)
// =========================================================================
export enum Severity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

// =========================================================================
// Trace Verbosity (D-06)
// =========================================================================
export enum TraceVerbosity {
  NORMAL = 'NORMAL',       // Metadata only
  DIAGNOSTIC = 'DIAGNOSTIC', // Redacted previews
}

// =========================================================================
// AITransaction Status
// =========================================================================
export type TransactionStatus = 'started' | 'streaming' | 'completed' | 'failed' | 'aborted';

// =========================================================================
// Transaction Type (matches product spec §4.1)
// =========================================================================
export type TransactionType = 'chat' | 'planner' | 'tool' | 'agent' | 'renderer' | 'system';

// =========================================================================
// AITransaction (product spec §4.1, lines 561-581)
// =========================================================================
export interface AITransaction {
  id: string;                    // operationId
  sessionId: string;
  conversationId: string;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'fullapp';
  userTurnId: string;
  type: TransactionType;
  status: TransactionStatus;
  providerId: string;
  model: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  errorCode?: string;
  severity?: Severity;           // D-32: worst severity among all traces
  parentOperationId?: string;    // D-22: only for true nested operations
  verbosity: TraceVerbosity;
  privacyMode: boolean;
}

// =========================================================================
// PromptTrace (product spec §4.2, lines 583-607)
// =========================================================================
export interface PromptTrace {
  id: string;
  operationId: string;
  promptTemplateId?: string;
  promptHash: string;            // DJB2 hash from PromptCacheManager
  tokenBreakdown: {
    system: number;
    memory: number;
    tools: number;
    context: number;
    history: number;
    user: number;
    output: number;
    total: number;
  };
  contextTier: ModelContextTier;
  truncated: boolean;
  minimalMode: boolean;
  cacheStats: {
    sectionsMarked: number;
    estimatedSavings: number;
    hitRate?: number;
  };
  timestamp: number;
  source: 'planner' | 'renderer';
}

// =========================================================================
// ToolTrace (product spec §4.3, lines 609-630)
// =========================================================================
export interface ToolTrace {
  id: string;
  operationId: string;
  parentOperationId?: string;
  toolName: string;
  source: 'built-in' | 'mcp' | 'skill';
  dangerous: boolean;
  permissionDecision: 'allowed' | 'denied' | 'allowed_once' | 'allowed_always';
  inputSchema?: string;         // Schema shape, not values
  outputSchema?: string;
  status: 'success' | 'failed' | 'timeout' | 'aborted' | 'denied';
  errorMessage?: string;
  durationMs: number;
  timestamp: number;
}

// =========================================================================
// ProviderTrace (product spec §4.4, lines 632-644)
// =========================================================================
export interface ProviderAttempt {
  attemptNumber: number;
  providerId: string;
  model: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  outcome: 'success' | 'timeout' | 'error' | 'circuit_open' | 'rate_limited';
  errorCode?: string;
  circuitBreakerTriggered: boolean;
}

export interface ProviderTrace {
  id: string;
  operationId: string;
  attempts: ProviderAttempt[];   // D-04: all retries in one trace
  resolvedProviderId: string;    // Final successful provider
  resolvedModel: string;
  totalDurationMs: number;
  timestamp: number;
}

// =========================================================================
// CacheTrace
// =========================================================================
export interface CacheTrace {
  id: string;
  operationId: string;
  event: 'hit' | 'miss' | 'invalidation' | 'key_generated';
  section?: string;             // system-prompt, tool-schemas, preferences, memory
  providerId?: string;
  cacheKey?: string;
  estimatedTokenSavings?: number;
  timestamp: number;
}

// =========================================================================
// MemoryTrace
// =========================================================================
export interface MemoryTrace {
  id: string;
  operationId: string;
  phase: 'assemble' | 'extract';
  conversationId: string;
  factsRetrieved?: number;
  factsExtracted?: number;
  extractionAttempt?: number;   // 1 or 2
  summarized: boolean;
  timestamp: number;
}

// =========================================================================
// WriteJournalTrace
// =========================================================================
export interface WriteJournalTrace {
  id: string;
  operationId: string;
  journalId: string;
  operation: string;            // WriteJournalOperation
  status: 'pending' | 'completed' | 'failed' | 'rolled-back';
  stepsCount: number;
  failedSteps?: number[];
  recovered: boolean;            // True if this was a recovery replay
  timestamp: number;
}

// =========================================================================
// TraceTree (assembled query result, D-24)
// =========================================================================
export interface TraceTree {
  transaction: AITransaction;
  promptTraces: PromptTrace[];
  toolTraces: ToolTrace[];
  providerTraces: ProviderTrace[];
  cacheTraces: CacheTrace[];
  memoryTraces: MemoryTrace[];
  writeJournalTraces: WriteJournalTrace[];
}

// =========================================================================
// TraceCollector Interface (D-07)
// =========================================================================
export interface TraceCollector {
  onPlannerCall(event: Omit<PromptTrace, 'id' | 'operationId'>): void;
  onProviderAttempt(event: Omit<ProviderAttempt, 'id'>): void;
  onToolExecution(event: Omit<ToolTrace, 'id' | 'operationId'>): void;
  onRendererCall(event: Omit<PromptTrace, 'id' | 'operationId'>): void;
  onCacheEvent(event: Omit<CacheTrace, 'id' | 'operationId'>): void;
  onMemoryEvent(event: Omit<MemoryTrace, 'id' | 'operationId'>): void;
  onWriteJournalEvent(event: Omit<WriteJournalTrace, 'id' | 'operationId'>): void;
  getAllEvents(): TraceEvent[];
  clear(): void;
}

// =========================================================================
// ExecutionContext (D-02)
// =========================================================================
export interface ExecutionContext {
  traceCollector: TraceCollector;
  operationId: string;
  abortSignal: AbortSignal;
  verbosity: TraceVerbosity;
  privacyMode: boolean;
}
```

## Redaction Implementation Strategy

### TraceRedactor as Middleware Inside AITransactionLog

TraceRedactor is instantiated as a dependency of AITransactionLog (constructor DI). The redaction path is:

```
Service → TraceCollector (in-memory) → AITransactionLog.close() → TraceRedactor → IndexedDB
```

**Mandatory patterns (from product spec §4.4):**

| Pattern | Placeholder | Scope |
|---------|-------------|-------|
| `/sk-[A-Za-z0-9_-]+/g` | `[REDACTED:API_KEY]` | OpenAI-style keys |
| `/key-[A-Za-z0-9_-]+/g` | `[REDACTED:API_KEY]` | Generic API keys |
| `/Bearer\s+[A-Za-z0-9._-]+/gi` | `[REDACTED:BEARER_TOKEN]` | HTTP Bearer auth headers |
| `/JSESSIONID=[^;\s]+/gi` | `[REDACTED:JSESSIONID]` | ServiceNow session cookies |
| `/sysparm_ck[=:]\s*[^&\s]+/gi` | `[REDACTED:sysparmCK]` | ServiceNow CSRF tokens |
| `/g_ck[=:]\s*[^&\s]+/gi` | `[REDACTED:g_ck]` | ServiceNow Google cookies |
| MCP auth headers (config-driven) | `[REDACTED:MCP_AUTH]` | X-MCP-Auth-* headers |
| Raw prompt bodies (normal mode) | `[REDACTED:RAW_BODY]` | Prompt content fields |
| Raw tool input/output (normal mode) | `[REDACTED:RAW_BODY]` | Tool I/O fields |
| Clipboard text | `[REDACTED:CLIPBOARD]` | Clipboard content fields |
| ServiceNow raw case body | `[REDACTED:CASE_BODY]` | Case body fields |

**Edge cases to handle:**
- Partial key matches: e.g., `sk-` appearing in legitimate text. The `[A-Za-z0-9_-]+` pattern matches common key formats. If false positives occur, the typed placeholder makes it clear what was redacted.
- Multi-line strings: Use the `s` flag for patterns that may span lines.
- Nested objects: `redactObject()` recursively traverses object values.

### debugLog Auto-Redaction Safety Net (D-10)

`debugLog` wraps its `data` argument through `TraceRedactor.redactObject()` before calling `console.*`. This is a **defensive safety net** — the primary boundary is AITransactionLog. Callers should still pass pre-redacted data whenever possible.

```typescript
// In: src/core/utils/debugLog.ts (modified)
import { traceRedactor } from '../telemetry/TraceRedactor';

export function debugLog(level: LogLevel, message: string, data?: unknown): void {
  if (typeof __DEV__ === 'undefined' || __DEV__) {
    const safeData = data !== undefined ? traceRedactor.redactValue(data) : '';
    // ... existing console logging with safeData ...
  }
}
```

The `redactValue` method handles: string (regex), object (recursive property scan), array (map over elements), and primitives (pass-through).

## IndexedDB Schema Evolution

### DB_VERSION 2 → 3 Migration Plan

**Current state (DB_VERSION=2):**
- `transaction_log_transactions` — stub (id, type, provider, model, startTime, endTime, status, metadata)
- `transaction_log_promptTraces` — stub (id, transactionId, tokens, cached, truncated)
- `transaction_log_toolTraces` — stub (id, transactionId, toolName, allowed, outcome, timestamp)
- `transaction_log_providerTraces` — stub (id, transactionId, provider, attempts, circuitBreakerOpen, timestamp)

**Target state (DB_VERSION=3):**

| Store | Key Path | New Indexes | Value Changes |
|-------|----------|-------------|---------------|
| `transaction_log_transactions` | id | `by-operationId` (operationId), `by-status` (status), `by-severity` (severity), `by-timestamp` (startTime) | Add: sessionId, conversationId, workspaceId, activeSurface, userTurnId, providerId, model, startedAt, endedAt, durationMs, errorCode, severity, parentOperationId, verbosity, privacyMode. Remove: startTime→startedAt mapping |
| `transaction_log_promptTraces` | id | `by-operationId` (operationId) | Add: operationId, promptTemplateId, promptHash, tokenBreakdown, contextTier, truncated, minimalMode, cacheStats, source, timestamp. Remove: transactionId→operationId, tokens→tokenBreakdown |
| `transaction_log_toolTraces` | id | `by-operationId` (operationId) | Add: operationId, parentOperationId, source, dangerous, permissionDecision, inputSchema, outputSchema, status, errorMessage, durationMs. Remove: transactionId→operationId, allowed→permissionDecision |
| `transaction_log_providerTraces` | id | `by-operationId` (operationId) | Add: operationId, attempts[] (array of ProviderAttempt), resolvedProviderId, resolvedModel, totalDurationMs. Remove: transactionId→operationId, provider→resolvedProviderId, attempts(number)→attempts(array) |
| `transaction_log_cacheTraces` (NEW) | id | `by-operationId` (operationId) | CacheTrace type fields |
| `transaction_log_memoryTraces` (NEW) | id | `by-operationId` (operationId) | MemoryTrace type fields |
| `transaction_log_writeJournalTraces` (NEW) | id | `by-operationId` (operationId) | WriteJournalTrace type fields |

**Migration approach:**
- Existing v2 records are schemaless at the value level (IndexedDB stores are key-value, no fixed columns)
- Migration creates new indexes under `oldVersion < 3` block
- Existing records persist with their current fields; new code reads optional fields with defaults
- No destructive migration needed — backward compatible
- Stub records (from Phase 2) won't have new fields; `getTraceTree()` handles undefined gracefully

## Pruning Implementation

### Scheduled Pruning Strategy

**Architecture:** A `pruning.ts` module exports a `startPruning()` function and a `scheduleDebouncedPrune()` function.

**Lifecycle hooks:**
1. **Startup:** `startPruning()` called at extension init (or Full App mount). Immediately runs `pruneNow()` and sets up a 5-minute interval.
2. **Transaction close:** `scheduleDebouncedPrune()` is called after `AITransactionLog.close()`. Debounces to 30 seconds — if multiple transactions close within that window, only one prune fires. If pruning is already in progress, queues one additional run.

**Pruning algorithm (D-26, D-27):**

```
pruneNow():
  for each store (transactions, promptTraces, toolTraces, providerTraces, cacheTraces, memoryTraces, writeJournalTraces, errors):
    1. COUNT-LIMIT CHECK:
       count = db.count(store)
       if count > maxCount:
         all = db.getAll(store) sorted by timestamp ASC
         // Failure-prioritized: sort by (severity DESC, timestamp ASC)
         // Keep: failed/error records + newest successful up to maxCount
         keep = []
         failures = all.filter(isFailure)
         successes = all.filter(isSuccess).sort(timestamp DESC)
         keep = failures + successes.slice(0, maxCount - failures.length)
         delete = all - keep
         db.delete(store, delete)

    2. TIME-LIMIT CHECK:
       all = db.getAll(store)
       expired = all.filter(r => r.timestamp < now - retentionPeriod)
       db.delete(store, expired)
```

**Retention windows (D-26):**

| Trace Type | Max Count | Retention Period |
|------------|-----------|-----------------|
| Transactions | 5,000 | 30 days |
| Normal traces (prompt/provider/tool) | 2,000 | 14 days |
| Diagnostic traces (deep detail) | 500 | 7 days |
| Errors | 1,000 | 30 days |
| Cache traces | 2,000 | 14 days |
| Memory traces | 2,000 | 14 days |
| WriteJournal traces | 2,000 | 14 days |

**MV3 constraint handling:** Pruning runs in the Full App tab context, not the background service worker. Full App has IndexedDB access. If Full App is not open, pruning runs on next open (startup check catches accumulated entries).

## Export Implementation

### ZIP Assembly Approach

**Library:** JSZip ^3.10.1

**Export flow:**

```
User selects filters in DiagnosticsPanel
  → Click "Export" button
  → Export dialog: select trace types, date range, status, transaction limit
  → exportTraces(options) called from src/core/telemetry/export.ts
  → Query AITransactionLogDB for matching traces
  → Assemble ZIP:
      1. Create JSZip instance
      2. For each transaction: add transaction_<operationId>.json
      3. Generate manifest.json
      4. zip.generateAsync({ type: 'blob' })
      5. Trigger browser download via saveAs or URL.createObjectURL
```

**Single-operation export (D-19):**
```
Transaction row "Export Trace" action
  → exportSingleTrace(operationId)
  → getTraceTree(operationId)
  → Create JSON blob
  → Trigger download: <operationId>.json
```

**Manifest format (D-18):**
```json
{
  "export_version": "1.0",
  "generated_at": "2026-07-13T12:00:00.000Z",
  "extension_version": "0.1.0",
  "transaction_count": 42,
  "date_range": { "from": "2026-07-01", "to": "2026-07-13" },
  "applied_filters": {
    "types": ["chat", "tool"],
    "statuses": ["completed", "failed"],
    "providers": ["anthropic", "openai"],
    "severities": ["ERROR", "WARNING"],
    "limit": 100
  },
  "included_trace_types": ["AITransactions", "PromptTraces", "ToolTraces", "ProviderTraces"],
  "redaction_version": "1.0",
  "trace_verbosity": "NORMAL",
  "privacy_mode": false
}
```

**JSZip integration pattern:**
```typescript
// Source: /stuk/jszip (Context7 verified API)
import JSZip from 'jszip';

export async function exportTraces(options: ExportOptions): Promise<Blob> {
  const traces = await aiTransactionLogDB.queryTraces(options);
  const zip = new JSZip();

  // Add each transaction as a separate file
  for (const tree of traces) {
    zip.file(`transaction_${tree.transaction.id}.json`, JSON.stringify(tree, null, 2));
  }

  // Add manifest
  zip.file('manifest.json', JSON.stringify(buildManifest(options, traces), null, 2));

  // Generate as blob for download
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nowpilot-diagnostics-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);

  return blob;
}
```

## DiagnosticsPanel Architecture

### Component Tree

```
DiagnosticsSection (Options wrapper)
└── DiagnosticsPanel (Master-Detail Layout)
    ├── FilterBar
    │   ├── Select (type) — AntD Select
    │   ├── Select (status) — AntD Select
    │   ├── Select (provider) — AntD Select
    │   ├── Select (severity) — AntD Select
    │   ├── DatePicker.RangePicker — AntD DatePicker
    │   ├── Input.Search — AntD Input.Search
    │   ├── Switch (Diagnostic Mode) — AntD Switch
    │   ├── Switch (Privacy Mode) — AntD Switch
    │   └── ExportButton — AntD Button + ExportModal
    ├── TransactionTable (left panel)
    │   └── AntD Table with columns:
    │       ├── Status icon (CheckCircle/CloseCircle/Warning/Exclamation)
    │       ├── Type badge (Tag component)
    │       ├── Provider + Model
    │       ├── operationId (Typography.Text copyable)
    │       ├── Duration
    │       ├── Severity (Tag with color)
    │       ├── Timestamp
    │       └── Actions: "Export Trace" (Button)
    └── TraceDetailPanel (right panel)
        ├── TransactionHeader (operationId, status, duration, severity)
        ├── ProviderTimeline (AntD Timeline)
        │   └── Timeline.Item per attempt with color coding
        ├── ToolCallDescriptions (AntD Descriptions, bordered)
        │   └── Descriptions.Item per tool call
        ├── PromptSection (Typography.Text copyable for hashes, Progress bars for tokens)
        ├── CacheStats (AntD Statistic cards)
        ├── MemorySection (summary of facts retrieved/extracted)
        ├── WriteJournalSection (journal operation summary)
        ├── ErrorSection (if errors present)
        └── Collapse (optional: "Show redacted details" — AntD Collapse)
```

### DiagnosticsStore (Zustand)

```typescript
// src/stores/diagnosticsStore.ts
interface DiagnosticsState {
  // Filter state (D-13)
  filterType: TransactionType | undefined;
  filterStatus: TransactionStatus | undefined;
  filterProvider: string | undefined;
  filterSeverity: Severity | undefined;
  filterDateRange: [number, number] | undefined;
  searchQuery: string;

  // Selection
  selectedOperationId: string | undefined;

  // Modes (D-38, D-39)
  diagnosticMode: boolean;   // Persisted to chrome.storage.local: np_diagnostics_mode
  privacyMode: boolean;       // Persisted to chrome.storage.local: np_privacy_mode

  // Data
  transactions: AITransaction[];
  traceTree: TraceTree | undefined;
  loading: boolean;

  // Actions
  setFilter: (key: string, value: unknown) => void;
  selectTransaction: (operationId: string) => Promise<void>;
  setDiagnosticMode: (enabled: boolean) => void;
  setPrivacyMode: (enabled: boolean) => void;
  refreshTransactions: () => Promise<void>;
}
```

**Mode persistence:** `np_diagnostics_mode` and `np_privacy_mode` stored in chrome.storage.local (consistent with `np_workspace` pattern). Zustand `persist` middleware with chrome.storage.local adapter for UI state; chrome.storage.session for ephemeral runtime state.

### Deep-Linking (D-14)

The `operationId` query parameter is parsed in the Full App entry point. The flow:

1. Side Panel error toast renders: `<Button onClick={() => openFullApp('options', { section: 'diagnostics', operationId: errorOpId })}>Open Diagnostics</Button>`
2. `WorkspaceRouter.openFullApp()` constructs: `app.html?page=options&section=diagnostics&operationId=<id>`
3. Full App parses query params, navigates to Options → Diagnostics section
4. `DiagnosticsPanel` reads `operationId` from URL, calls `diagnosticsStore.selectTransaction(operationId)`
5. Initial filter state preserved in URL for shareability (optional — at planner's discretion)

### AntD Component Mapping (D-15)

| Visualization | AntD Component | Props Pattern |
|---------------|---------------|---------------|
| Provider attempt timeline | `Timeline` v6 | `items={attempts.map(a => ({ color: a.outcome === 'success' ? 'green' : 'red', children: <>{a.providerId} ({a.durationMs}ms)</> }))}` |
| Tool call details | `Descriptions` | `bordered`, `column={1}`, `items={toolCalls.map(t => ({ key: t.id, label: t.toolName, children: t.status }))}` |
| Cache statistics | `Statistic` | `value={hitRate}`, `suffix="%"`, `prefix={<CacheIcon />}` |
| Context token budget | `Progress` | `percent={tokenUsagePercent}`, `status={overBudget ? 'exception' : 'active'}` |
| Copyable operation IDs | `Typography.Text` | `copyable`, `code`, `ellipsis` |
| Redacted details toggle | `Collapse` | `items={[{ key: 'redacted', label: 'Show redacted details', children: <pre>{redactedContent}</pre> }]}` |

## Integration Touchpoints

### Concrete Hook Points in Each Service

| Service | Method | TraceCollector Event | What to Emit | When |
|---------|--------|---------------------|--------------|------|
| **AgentOrchestrator** | `runWithContext()` | (creates ExecutionContext) | Creates operationId, starts AITransactionLog | Before pipeline execution |
| | `runWithContext()` (finally) | (calls AITransactionLog.close) | Batch-writes all traces | After pipeline completes/fails/aborts |
| **PlannerService** | `plan()` | `onPlannerCall(event)` | promptHash, tokenBreakdown, contextTier, cacheStats, truncated | Before generateText call (prompt assembled) and after response |
| **ProviderRouter** | `selectModel()` | `onProviderAttempt(event)` | attemptNumber, providerId, model, outcome, durationMs, errorCode, circuitBreakerTriggered | Per attempt in fallback chain |
| **ExecutorService** | `execute()` | `onToolExecution(event)` | toolName, source, dangerous, permissionDecision, status, durationMs | After permission check + execution complete |
| **RendererService** | `render()` | `onRendererCall(event)` | Same shape as PromptTrace (source: 'renderer'), promptHash, tokenBreakdown | After final token received (text-complete event) |
| **MemoryEngine** | `assemble()` | `onMemoryEvent(event)` | phase: 'assemble', factsRetrieved, conversationId | After assemble() completes |
| | `extract()` | `onMemoryEvent(event)` | phase: 'extract', factsExtracted, extractionAttempt, summarized | After extract() completes (fire-and-forget) |
| **PromptCacheManager** | `identifyStableSections()` | `onCacheEvent(event)` | event: 'key_generated', sections found | Called by services before generateText |
| | `invalidateCacheKey()` | `onCacheEvent(event)` | event: 'invalidation', providerId, reason | On invalidation |
| **WriteJournal** | `begin()` / `markCompleted()` | `onWriteJournalEvent(event)` | journalId, operation type, status, stepsCount, recovered | On journal lifecycle transitions |

### Error Toast Integration (TELE-07)

The error toast in the Side Panel needs access to the current `operationId`. Pattern:

```typescript
// In Side Panel error handler
function showErrorToast(message: string, operationId?: string) {
  notification.error({
    message: 'Operation Failed',
    description: message,
    btn: operationId ? (
      <Button size="small" onClick={() => openFullApp('options', {
        section: 'diagnostics',
        operationId
      })}>
        Open Diagnostics
      </Button>
    ) : undefined,
    duration: 0, // Don't auto-dismiss when diagnostics link present
  });
}
```

The `openFullApp` function constructs the URL with query parameters. The Full App entry point parses `?page=options&section=diagnostics&operationId=<id>` and routes accordingly.

### WriteJournal Batch-Write Flow

```typescript
// In AITransactionLog.close()
async close(operationId: string, collector: TraceCollector): Promise<void> {
  const events = collector.getAllEvents();
  const redactedEvents = this.redactor.redactTraces(events);

  // WriteJournal-coordinated batch write
  const journal = await this.writeJournal.begin(
    'transaction-log-batch' as WriteJournalOperation, // Extend WriteJournalOperation type
    {
      transaction_log_transactions: operationId,
    },
    [
      { name: 'write-transaction' },
      { name: 'write-prompt-traces' },
      { name: 'write-tool-traces' },
      { name: 'write-provider-traces' },
      { name: 'write-cache-traces' },
      { name: 'write-memory-traces' },
      { name: 'write-journal-traces' },
    ],
  );

  try {
    await this.writeJournal.markStepStart(journal.id, 0);
    await this.db.logTransaction(redactedEvents.transaction);
    await this.writeJournal.markStepComplete(journal.id, 0);
    // ... repeat for each step ...
    await this.writeJournal.markCompleted(journal.id);
  } catch (err) {
    await this.writeJournal.markFailed(journal.id);
    throw err;
  } finally {
    collector.clear();
    scheduleDebouncedPrune();
  }
}
```

Note: `WriteJournalOperation` in `WriteJournalEntry.ts` must be extended with `'transaction-log-batch'` to support the new operation type.

### Crash Recovery Logic

```typescript
// Called at startup (extension init or Full App mount)
async function recoverOrphanedTransactions(): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('transaction_log_transactions');
  const orphaned = all.filter(tx =>
    tx.status === 'started' || tx.status === 'streaming'
  );

  for (const tx of orphaned) {
    tx.status = 'aborted';
    tx.endedAt = Date.now();
    tx.severity = Severity.WARNING;
    await db.put('transaction_log_transactions', tx);
  }

  if (orphaned.length > 0) {
    debugLog('warn', '[AITransactionLog] Recovered orphaned transactions', {
      count: orphaned.length,
      ids: orphaned.map(t => t.id),
    });
  }
}
```

### debugLog Extension

The modified `debugLog` uses `TraceRedactor.redactValue()` as a safety net. The redaction is applied to the `data` argument before console output. This is a defensive measure — the primary boundary remains AITransactionLog middleware.

**Implementation pattern:**
```typescript
import { traceRedactor } from '../telemetry/TraceRedactor';

export function debugLog(level: LogLevel, message: string, data?: unknown): void {
  if (typeof __DEV__ === 'undefined' || __DEV__) {
    const timestamp = new Date().toISOString();
    const prefix = `[NowPilot ${timestamp}] ${message}`;
    const safeData = data !== undefined ? traceRedactor.redactValue(data) : '';
    // ... existing console.* calls with safeData ...
  }
}
```

## Testing Strategy

### 1. TraceRedactor Tests (Highest Priority — Security-Critical)

```typescript
// tests/core/telemetry/TraceRedactor.test.ts
describe('TraceRedactor', () => {
  // MUST test: every redaction pattern from product spec §4.4
  it('redacts OpenAI API keys (sk-...)', () => {
    const input = 'Authorization: Bearer sk-abc123def456';
    const result = redactor.redact(input);
    expect(result).not.toContain('sk-abc123def456');
    expect(result).toContain('[REDACTED:API_KEY]');
  });

  // MUST test: raw data never leaks
  it('redacts before persistence — raw key never reaches DB mock', async () => {
    const dbMock = vi.fn();
    const log = new AITransactionLog(dbMock, redactor, writeJournal);
    const collector = new DefaultTraceCollector();
    collector.onPlannerCall({ promptContent: 'Bearer sk-leaked' });
    await log.close('op-123', collector);
    expect(dbMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ promptContent: expect.stringContaining('sk-') })
    );
  });

  // Edge cases
  it('handles partial key matches without breaking', () => { /* ... */ });
  it('handles empty strings', () => { /* ... */ });
  it('handles deeply nested objects', () => { /* ... */ });
  it('handles arrays of strings', () => { /* ... */ });
  it('handles null/undefined values', () => { /* ... */ });
});
```

### 2. Trace Lifecycle Tests

```typescript
// tests/core/telemetry/AITransactionLog.test.ts
describe('AITransactionLog', () => {
  it('start() writes minimal transaction record with status: started');
  it('complete() batch-writes all accumulated traces via WriteJournal');
  it('fail() records error and batch-writes traces');
  it('close() clears TraceCollector after persistence');
  it('recoverOrphanedTransactions() marks started/streaming as aborted');
  it('severity is computed as worst among all child traces (D-32)');
});
```

### 3. Pruning Tests

```typescript
// tests/core/telemetry/pruning.test.ts
describe('pruning', () => {
  it('prunes oldest successful records when count exceeds limit');
  it('preserves failed/error records regardless of age (D-27)');
  it('prunes records older than retention period regardless of count');
  it('debounced scheduling — multiple rapid closes trigger only one prune');
  it('pruning in progress — queues one additional run, not multiple');
});
```

### 4. Export Tests

```typescript
// tests/core/telemetry/export.test.ts
describe('export', () => {
  it('single operation export produces valid JSON with complete TraceTree');
  it('bulk export produces ZIP with manifest.json and per-transaction files');
  it('manifest.json contains all required metadata fields (D-18)');
  it('export respects privacy mode — no content fields in output');
  it('export respects redaction — no raw keys in output');
});
```

### Mock Patterns

```typescript
// Use vi.hoisted() for mock variables (established Vitest v4 pattern)
const { vi } = import.meta;
const mockDB = vi.hoisted(() => ({
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(undefined),
  getAll: vi.fn().mockResolvedValue([]),
  getAllFromIndex: vi.fn().mockResolvedValue([]),
  count: vi.fn().mockResolvedValue(0),
  delete: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/core/storage/IndexedDBManager', () => ({
  getDB: vi.fn().mockResolvedValue(mockDB),
}));

// Mock WriteJournal for trace batch-write tests
const mockJournal = vi.hoisted(() => ({
  begin: vi.fn().mockResolvedValue({ id: 'journal-1', steps: [] }),
  markStepStart: vi.fn().mockResolvedValue(undefined),
  markStepComplete: vi.fn().mockResolvedValue(undefined),
  markCompleted: vi.fn().mockResolvedValue(undefined),
  markFailed: vi.fn().mockResolvedValue(undefined),
}));
```

## Risk Assessment

### Performance Impact of Tracing

| Risk | Severity | Mitigation |
|------|----------|------------|
| Trace event emission adds overhead to hot path | LOW | Events are cheap struct pushes (object allocation + array push). No I/O during execution. Overhead < 1ms per event for typical trace volume (5-15 events per operation) |
| Batch-write on close blocks subsequent operations | MEDIUM | WriteJournal transaction is separate from pipeline. Batch-write happens after user sees the response. If write takes > 100ms, consider yielding with setTimeout(0) between steps |
| IndexedDB contention with other stores | LOW | Each trace store is separate; reads/writes are independent. IndexedDB supports concurrent transactions on different object stores |

### IndexedDB Storage Budget

| Risk | Estimate | Mitigation |
|------|----------|------------|
| Transaction metadata (5000 records × ~500 bytes) | ~2.5 MB | Within reasonable limits |
| Trace detail records (2000 × 1KB each × 6 stores) | ~12 MB | Tiered pruning limits total. Diagnostic traces capped at 500 records |
| Total worst-case | ~15 MB | Well within Chrome's ~60% of disk free space budget for extensions |
| Rapid accumulation during debugging | Spike of diagnostic traces | Diagnostic mode limited to 500 records (D-26); pruned more aggressively |

### MV3 Service Worker Constraints

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| No IndexedDB from background SW | Pruning cannot run in background | Pruning runs in Full App context (has IndexedDB access). Startup prune on Full App mount |
| Background SW can be terminated | State in memory lost | All trace state persisted to IndexedDB; no in-memory-only trace data survives beyond transaction close |
| No setInterval in MV3 background SW | Cannot schedule periodic pruning in SW | Use Full App component mount + 5-min interval; if Full App not open, prune on next open |

### Edge Cases

| Edge Case | Risk | Handling |
|-----------|------|----------|
| **Crash recovery** — Full App closed mid-batch-write | Partial trace data persisted | WriteJournal recovery marks orphaned transactions as aborted. Next startup: recoverOrphanedTransactions() scans for status: started/streaming |
| **Partial writes** — some trace stores updated, others not | Inconsistent trace tree | WriteJournal.begin() before batch. Each step is idempotent. getTraceTree() handles missing child traces gracefully (returns empty arrays) |
| **Concurrent operations** — two tabs both writing traces | Race conditions on same operationId | Normalized storage with operationId key — idb `put()` is last-write-wins. For overlapping operations, each has a unique operationId |
| **Very large trace batches** — 100+ tool calls in one agent session | IndexedDB transaction timeout | Cap batch size at 100 writes per transaction. Split into multiple WriteJournal steps if needed. IndexedDB transactions auto-commit after 60 seconds of inactivity |
| **Export of very large trace sets** | ZIP creation blocks UI thread | Use `zip.generateAsync()` which yields to the event loop. Consider progress indicator for > 100 transactions |
| **Privacy mode enabled during trace collection** | Previously collected data in memory | ExecutionContext carries privacyMode — TraceCollector respects it during collection (skip content fields). Mode toggle mid-operation affects next operation only |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| idb (IndexedDB) | All trace persistence | ✓ | 8.0.3 | Already installed |
| zod | Type validation | ✓ | 4.4.3 | Already installed |
| JSZip | Export ZIP creation | ✗ (needs install) | 3.10.1 | Install via pnpm — required |
| Ant Design | DiagnosticsPanel UI | ✓ | 6.x | Already installed |
| React | UI components | ✓ | 19.x | Already installed |
| Zustand | diagnosticsStore | ✓ | 5.x | Already installed |
| crypto.randomUUID() | Operation IDs | ✓ | Native | No fallback needed |
| Vitest | Testing | ✓ | (configured) | Already configured |

**Missing dependencies with no fallback:**
- JSZip — must install (`pnpm add jszip`) before export implementation

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts) |
| Config file | vitest.config.ts (jsdom environment, setupFiles: ./tests/setup.ts) |
| Quick run command | `npx vitest run tests/core/telemetry/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TELE-01 | AITransactionLog tracks all operations | unit | `npx vitest run tests/core/telemetry/AITransactionLog.test.ts` | ❌ Wave 0 |
| TELE-02 | PromptTrace with token breakdown, cache hits | unit | `npx vitest run tests/core/telemetry/AITransactionLog.test.ts` | ❌ Wave 0 |
| TELE-03 | ToolTrace with permission decisions | unit | `npx vitest run tests/core/telemetry/AITransactionLog.test.ts` | ❌ Wave 0 |
| TELE-04 | ProviderTrace with attempts[] tracking | unit | `npx vitest run tests/core/telemetry/AITransactionLog.test.ts` | ❌ Wave 0 |
| TELE-05 | TraceRedactor redacts all patterns before persistence | unit | `npx vitest run tests/core/telemetry/TraceRedactor.test.ts` | ❌ Wave 0 |
| TELE-06 | DiagnosticsPanel renders | unit | `npx vitest run tests/core/telemetry/` (or component test) | ❌ Wave 0 |
| TELE-07 | Error toast "Open Diagnostics" link | integration | Manual UAT + component test | ❌ Wave 0 |
| DATA-03 | Export debug bundle as sanitized ZIP | unit | `npx vitest run tests/core/telemetry/export.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/telemetry/ --reporter=verbose`
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/telemetry/TraceRedactor.test.ts` — covers TELE-05 (all redaction patterns)
- [ ] `tests/core/telemetry/AITransactionLog.test.ts` — covers TELE-01 through TELE-04 (lifecycle, batch-write, recovery)
- [ ] `tests/core/telemetry/pruning.test.ts` — covers pruning logic (retention, failure-prioritized)
- [ ] `tests/core/telemetry/export.test.ts` — covers DATA-03 (ZIP assembly, manifest, privacy)
- [ ] `tests/core/telemetry/types.test.ts` — Zod schema validation (if Zod schemas added)
- [ ] Framework install: Already configured (vitest.config.ts, tests/setup.ts exist)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (indirectly) | TraceRedactor prevents API key leaks via redaction patterns |
| V3 Session Management | Yes | JSESSIONID, sysparmCK, g_ck redaction prevents session token leakage |
| V4 Access Control | No | Diagnostics access is local-only (Chrome extension) |
| V5 Input Validation | Yes | Zod v4 schemas validate trace data before persistence |
| V6 Cryptography | No | No new cryptographic operations (crypto.randomUUID() for IDs is non-crypto) |
| V7 Error Handling | Yes | ErrorStore with severity classification; no raw error data in debugLog |
| V8 Data Protection | Yes | TraceRedactor as middleware ensures sensitive data never persists |
| V9 Communications | No | All local (Chrome extension, no network communication) |
| V10 Malicious Code | Yes | Package legitimacy audit performed; JSZip verified |

### Known Threat Patterns for Telemetry Systems

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leakage through trace logs | Information Disclosure | TraceRedactor with regex patterns; double boundary (AITransactionLog middleware + debugLog safety net) |
| Session token capture in diagnostics export | Information Disclosure | All export passes through TraceRedactor; Privacy Mode forces metadata-only |
| Stored XSS in trace content rendered in DiagnosticsPanel | Tampering | AntD components auto-escape React content; no dangerouslySetInnerHTML (HARD-10) |
| Trace injection — attacker-controlled data in tool outputs | Spoofing | ToolTrace stores schemas/summaries, not raw I/O in normal mode; truncated content |
| Denial of service — excessive trace accumulation | Denial of Service | Tiered pruning with hard caps (5000 transactions, 2000 detail traces); startup pruning |
| Incomplete trace writes leading to data corruption | Tampering | WriteJournal coordination with idempotent steps; crash recovery marks orphaned transactions |
| Clipboard data exfiltration through trace storage | Information Disclosure | `[REDACTED:CLIPBOARD]` pattern; normal mode truncates raw content |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JSZip v3.10.1 is the latest version and has no breaking changes for our use case | Standard Stack | If v4 is released with API changes, the export code needs updating |
| A2 | Existing stub records (DB_VERSION=2) in transaction_log_* stores will survive migration without data loss | IndexedDB Schema Evolution | LOW — schemaless values mean old fields persist; new code reads optional fields with defaults |
| A3 | `vi.hoisted()` pattern for Vitest mock variables continues to work with the installed Vitest version | Testing Strategy | LOW — pattern used in all existing test files (Phase 2-5) |
| A4 | `modelContextTier` is accessible from `OptimizedContext.tier` without additional imports | TypeScript Types | LOW — confirmed in contextTypes.ts:3, already imported in AgentOrchestrator |
| A5 | WriteJournalOperation type extension (adding 'transaction-log-batch') does not break existing WriteJournal consumers | Integration Touchpoints | LOW — TypeScript union type extension is non-breaking |

## Open Questions

1. **How should diagnostics mode state (Diagnostic/Privacy) be persisted — Zustand persist or chrome.storage.local?**
   - What we know: Both patterns exist. `np_workspace` uses chrome.storage.local with Zustand persist middleware. Theme uses chrome.storage.sync.
   - What's unclear: Whether diagnostics mode needs cross-surface sync (Side Panel toast needs to know Privacy Mode is enabled)
   - Recommendation: Use chrome.storage.local with Zustand `persist` middleware (pattern: workspaceStore). This provides cross-surface sync if needed. Fallback: Zustand persist with `localStorage` if chrome.storage is unavailable in test environments.

2. **Should TraceCollector events be batched per pipeline stage or per-event?**
   - What we know: D-35 mandates synchronous, cheap struct pushes. Services emit individual events per operation.
   - What's unclear: Whether to batch multiple tool calls from a planner loop as a single emit or individual events
   - Recommendation: Individual events better match the granularity needed for DiagnosticsPanel (one ToolTrace row per tool call). The "batch" is at persistence time (AITransactionLog.close()), not at collection time.

3. **What happens to trace events from fire-and-forget MemoryEngine.extract() if the transaction closes first?**
   - What we know: D-04 makes extraction fire-and-forget. D-24 supports late-arriving traces (stores indexed by operationId).
   - What's unclear: Whether to buffer extraction traces separately and attach on next prune, or write them immediately
   - Recommendation: MemoryEngine.extract() should call `aiTransactionLog.appendTrace(operationId, trace)` which writes individual traces bypassing the batch-write path. These late traces use the same operationId for TraceTree assembly.

## Sources

### Primary (HIGH confidence) — Verified via tool + official source
- [VERIFIED: npm registry] JSZip v3.10.1 — package legitimacy check passed; 45M weekly downloads, High source reputation, GitHub: Stuk/jszip
- [VERIFIED: npm registry] idb v8.0.3 — already installed; 17.5M weekly downloads, GitHub: jakearchibald/idb
- [VERIFIED: npm registry] zod v4.4.3 — already installed; 224M weekly downloads
- [CITED: context7 /stuk/jszip] JSZip API — `new JSZip()`, `zip.file()`, `zip.generateAsync({ type: 'blob' })` confirmed
- [CITED: context7 /ant-design/ant-design v6] Timeline items API (color, content, icon, title), Descriptions bordered/column/items, Typography.Text copyable/ellipsis — all confirmed for v6
- [CITED: src/core/storage/IndexedDBManager.ts] DB_VERSION=2 with existing transaction_log_* stores; upgrade callback pattern (oldVersion < N blocks)
- [CITED: src/core/ai/pipeline/AgentOrchestrator.ts] constructor DI at line 34, runWithContext() at line 79
- [CITED: src/core/ai/router/ProviderRouter.ts] selectModel() retry/fallback chain at line 21
- [CITED: .planning/PRODUCT_SPEC_v0_1.md §4] Full telemetry spec: AITransaction, PromptTrace, ToolTrace, ProviderTrace interfaces; TraceRedactor rules; DiagnosticsPanel design
- [CITED: .planning/phases/06-transaction-logging-and-diagnostics/06-CONTEXT.md] 39 locked implementation decisions (D-01 through D-39)

### Secondary (MEDIUM confidence) — Verified by reading source code
- [CITED: src/core/memory/MemoryEngine.ts] assemble() at line 78, extract() at line 133, BroadcastBusLike pattern at line 20
- [CITED: src/core/ai/cache/PromptCacheManager.ts] identifyStableSections(), generateCacheKey() with DJB2 hash
- [CITED: src/core/storage/WriteJournal.ts] begin/markStepStart/markStepComplete/markCompleted/markFailed lifecycle
- [CITED: src/core/storage/stores/ErrorStore.ts] FIFO enforcement (MAX_ERRORS=100), logError(), getErrors()
- [CITED: src/core/utils/debugLog.ts] __DEV__ guard pattern at line 4
- [CITED: src/components/options/OptionsRoot.tsx] diagnostics section registered at line 35, OptionsRootProps.renderSectionContent at line 44
- [CITED: src/core/messaging/broadcastBus.ts] session/local storage listeners, onMemoryWrite pattern
- [CITED: src/core/ai/pipeline/pipelineTypes.ts] OrchestratorEvent union type, PlannerDecisionType

### Tertiary (LOW confidence)
- None — all claims verified through codebase reading, npm registry checks, or Context7 documentation queries

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — JSZip verified on npm, idb + zod already installed, AntD v6 confirmed via Context7
- Architecture: HIGH — full codebase read of all integration points; CONTEXT.md has 39 locked decisions
- Types: HIGH — derived from product spec §4.1-§4.4 and existing code patterns
- Redaction: HIGH — product spec §4.4 specifies exact regex patterns; implementation pattern from D-08/D-09
- IndexedDB Schema: HIGH — existing schema fully understood; v3 migration path clear
- Pruning: HIGH — D-25 through D-29 locked; MV3 constraints evaluated
- Export: HIGH — JSZip API confirmed; D-17 through D-20 locked
- DiagnosticsPanel: HIGH — AntD v6 component API confirmed; D-12 through D-16 locked
- Integration: HIGH — all hook points identified in source code
- Testing: MEDIUM — patterns established but no telemetry tests exist yet (Wave 0 gap)

**Research date:** 2026-07-13
**Valid until:** 2026-08-13 (30 days — stable domain, no fast-moving dependencies)

<!-- gsd:write-continue -->
