# Phase 6: Transaction Logging and Diagnostics - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the AITransactionLog orchestration layer (wrapping every AI, MCP, tool, provider, cache, and storage operation), TraceRedactor (eager, pattern-based redaction before any persistence), and DiagnosticsPanel (in Full App → Options with master-detail transaction view, filters, deep-linking, and export). Every operation is traceable with a universal operationId. Requirements: TELE-01 through TELE-07, DATA-03.
</domain>

<decisions>
## Implementation Decisions

### Trace Injection Strategy
- **D-01 — Hybrid Architecture:** AgentOrchestrator owns the transaction lifecycle (operationId, correlation, start/complete/fail/abort handling, final persistence). Pipeline services (PlannerService, ExecutorService, RendererService, ProviderRouter, MemoryEngine, PromptCacheManager, WriteJournal) emit typed trace events through a callback interface only. No service couples directly to AITransactionLogDB.
- **D-02 — Request-Scoped ExecutionContext:** Introduce an `ExecutionContext` object containing `TraceCollector`, `operationId`, `AbortSignal`, and other runtime metadata. AgentOrchestrator creates it and passes it through all participating services. This avoids constructor-level coupling to request-scoped tracing and prevents method signatures from accumulating individual tracing parameters.
- **D-03 — Hybrid Checkpoint + Final Batch Write:** AITransactionLog writes a minimal transaction record at start (status: started). All detailed prompt/tool/provider/cache/memory/WriteJournal trace events are collected in-memory during execution. On transaction complete/fail/abort, the full trace set is batch-written to AITransactionLogDB via WriteJournal for consistency. On crash/reload before finalization, startup recovery marks open transactions as aborted/interrupted.
- **D-04 — Single ProviderTrace with attempts[]:** ProviderRouter creates one ProviderTrace per operation with an `attempts[]` array. Each retry/fallback appends to the array. Matches the product spec ProviderTrace format and keeps retry chains easy to inspect.
- **D-05 — Participating Services:** PlannerService, ExecutorService, RendererService, ProviderRouter, MemoryEngine, PromptCacheManager, and WriteJournal all emit trace events through the TraceCollector. Cache hit/miss/invalidation and journal recovery/failure/completion are first-class diagnostics signals.
- **D-06 — Two-Level Trace Verbosity:** Normal mode (always on): metadata only — no prompt bodies or tool I/O. Diagnostic mode (user opt-in, short-retention): includes redacted prompt/tool previews for troubleshooting. All data passes through TraceRedactor before persistence, UI display, console logging, or export regardless of mode.
- **D-07 — TraceCollector Interface in pipelineTypes.ts:** Define the TraceCollector interface in `pipelineTypes.ts`. Passed via ExecutionContext (not constructor DI or method parameters). Emits typed events: `onPlannerCall`, `onProviderAttempt`, `onToolExecution`, `onRendererCall`, `onCacheEvent`, `onMemoryEvent`, `onWriteJournalEvent`.

### Redaction Timing & Approach
- **D-08 — Eager Redaction Before Persistence:** TraceRedactor runs before any trace, error, debug, or export data is persisted. Raw sensitive data must never be written to AITransactionLogDB, ErrorStore, debugLog, DiagnosticsPanel state, or debug bundles. Lazy redaction at display/export time is prohibited.
- **D-09 — Explicit Middleware Inside AITransactionLog:** Redaction is a middleware step inside AITransactionLog — not ad-hoc utility calls from individual services. Raw traces flow through: service → TraceCollector → AITransactionLog → TraceRedactor → RedactedTrace → persist. Guarantees full coverage while keeping the path visible and testable.
- **D-10 — debugLog as Defensive Safety Net:** Primary redaction boundary is AITransactionLog. debugLog also performs automatic pattern-based redaction on all arguments before writing — preventing accidental leaks if a caller forgets to redact. Callers should still pass pre-redacted data whenever possible.
- **D-11 — Typed Placeholders for Redacted Values:** Redacted values are replaced with typed placeholders: `[REDACTED:API_KEY]`, `[REDACTED:BEARER_TOKEN]`, `[REDACTED:JSESSIONID]`, `[REDACTED:sysparmCK]`, `[REDACTED:g_ck]`, `[REDACTED:MCP_AUTH]`, `[REDACTED:RAW_BODY]`. Fields are never removed entirely so diagnostics still show what was redacted.

### DiagnosticsPanel UX Layout
- **D-12 — Master-Detail Layout:** Transaction list on the left (searchable/filterable Table). Selecting a transaction shows its full trace tree in a detail panel on the right with sections for provider attempts, tool calls, prompt/cache/context, memory, WriteJournal, and errors. Supports deep-linking via operationId.
- **D-13 — Full Filter Bar:** Filters for type (chat/planner/tool/...), status (completed/failed/aborted/...), provider, severity (DEBUG/INFO/WARNING/ERROR/CRITICAL), date range, and free-text search (operationId, model, provider, tool name, error code, workspaceId).
- **D-14 — Deep-Linking via Query Param:** Error toast "Open Diagnostics" link navigates to `app.html?page=options&section=diagnostics&operationId=<id>`. Full App parses the param, navigates to Options → Diagnostics, and auto-selects the matching trace. Consistent with existing workspace handoff URL patterns.
- **D-15 — AntD Component Mapping:** Provider attempts → `Timeline` with status markers. Tool calls → `Descriptions` (toolName, permission, outcome, timing). Cache stats → `Statistic` cards. Context budget → `Progress` bars. Prompts → `Typography.Text copyable` for operationId and hashes. Collapse used only for optional raw redacted trace details, not primary layout.
- **D-16 — OptionsRoot Integration:** `OptionsRoot` already has a `'diagnostics'` section registered with `<DashboardOutlined />` icon. DiagnosticsPanel is injected via `renderSectionContent('diagnostics')`. Matches existing Options section pattern.

### Export Format & Scope
- **D-17 — All Trace Types, User-Selectable Scope:** Export supports all trace types (AITransactions, PromptTraces, ToolTraces, ProviderTraces, cache traces, memory traces, WriteJournal traces, ErrorStore entries). User selects categories, date range, status filters, and transaction limits before export. Single operation → JSON file. Multiple operations → ZIP bundle with separate trace files and a manifest.
- **D-18 — Standard Metadata Manifest:** Every bundle includes `manifest.json` with: export version, generation timestamp, extension version, transaction count, date range, applied filters, included trace types, redaction version, trace verbosity level, and Privacy Mode status. Provides context to interpret exported traces.
- **D-19 — Single-Operation Export:** Each transaction row has an "Export Trace" action that exports only that operation as a self-contained JSON file with its complete trace tree. Bulk export remains available for filtered result sets.
- **D-20 — Export is Independent Copy:** Exporting creates an independent JSON/ZIP file. The diagnostics database continues its normal pruning policy. The export file is the user's durable copy — no pin-management or retention exceptions.

### Transaction Correlation Model
- **D-21 — operationId as Universal Correlation Key:** Every trace (AITransaction, PromptTrace, ToolTrace, ProviderTrace, cache trace, memory trace, WriteJournal trace, error record) carries the same `operationId` for one user-facing operation. DiagnosticsPanel and export assembly use this single key.
- **D-22 — parentOperationId Only for True Nested Operations:** `parentOperationId` is reserved for background child operations or truly nested sub-operations. Normal Planner/Executor/Renderer stages within a user turn share the same `operationId`. Retries and provider fallbacks do NOT create child operationIds.
- **D-23 — Retries Under Same operationId:** Retries and provider fallbacks stay under the original `operationId`, recorded as entries in `ProviderTrace.attempts[]`. The `operationId` represents the full user request, while individual provider/model calls are attempts within it.
- **D-24 — Normalized Storage, Assembled Query:** Each trace type is stored separately with an `operationId` index. AITransactionLogDB exposes `getTraceTree(operationId): Promise<TraceTree>` that assembles the full trace tree for DiagnosticsPanel. This avoids data duplication, supports late-arriving traces, and keeps the UI from owning query/join logic.

### Trace Retention & Pruning Policy
- **D-25 — Hybrid Retention (Time + Count):** Both time-based and count-based limits enforced. Whichever is exceeded first triggers pruning.
- **D-26 — Tiered Retention Limits:** Transactions (metadata): 30 days or 5,000 max. Normal trace details (prompt/provider/tool): 14 days or 2,000 max. Diagnostic traces (deep detail): 7 days or 500 max. Error records: 30 days or 1,000 max. Provides more recent diagnostic detail while keeping storage bounded.
- **D-27 — Failure-Prioritized Pruning:** Failed/error transactions retain full priority. When count limits are hit, oldest successful records are pruned first. Failed operations are preserved as long as possible within their retention window.
- **D-28 — Export Does Not Affect Retention:** Export creates independent files. AITransactionLogDB follows its normal pruning policy regardless of export history. No pinned-flag complexity.
- **D-29 — Scheduled + Startup Pruning:** Pruning runs on startup and periodically every 5 minutes while the extension is active. Transaction close schedules a debounced prune — never runs synchronously. If pruning is already in progress, queue one additional run after completion. Avoids adding latency to the AI runtime pipeline.

### Error Classification & Severity Model
- **D-30 — Five Severity Levels:** DEBUG, INFO, WARNING, ERROR, CRITICAL.
- **D-31 — Severity Classification:** CRITICAL: WriteJournal recovery failure, storage corruption, encryption initialization failure, migration failure, primary election failure. ERROR: tool validation failure, export failure, provider unreachable (all fallbacks exhausted), planner/executor/renderer pipeline failure. WARNING: provider timeout (retried), cache miss, memory extraction retry (first), rate limit hit (retried), circuit breaker opened. INFO: cache hit, degradation step applied, memory extraction completed, transaction completed. DEBUG: raw trace detail, token breakdowns, internal state transitions.
- **D-32 — Severity Stored on AITransaction:** Set at transaction close time as the worst severity among all traces for that operation. Enables fast filtering in DiagnosticsPanel without scanning all child traces.

### Performance & Sampling Strategy
- **D-33 — Selective Success Tracing:** Failures, warnings, retries, fallbacks, aborted operations, and CRITICAL system events → 100% fully traced. Successful operations → keep latest 500 detailed success traces; lightweight transaction metadata retained longer per retention policy.
- **D-34 — Payload Truncation:** Normal mode: prompt bodies capped at 2KB per section, tool input/output at 4KB each. Diagnostic mode: larger redacted previews but still hard-capped. Never store full raw prompt bodies, raw tool I/O, secrets, clipboard text, or ServiceNow case bodies.
- **D-35 — Buffered Trace Collection:** Services synchronously emit trace events to the in-memory TraceCollector (cheap struct push). No IndexedDB writes occur during execution. AITransactionLog accumulates events and performs a single redaction + batch-write when the transaction completes, fails, or aborts. Restart recovery marks orphaned transactions as aborted.
- **D-36 — Debounced Pruning Scheduling:** Transaction close fires a debounced prune request. Actual pruning runs asynchronously on a timer or at startup — never blocks the pipeline.

### Diagnostics Privacy & Access Policy
- **D-37 — Hidden by Default, Expandable on Click:** Normal mode: prompt bodies, memory contents, and tool I/O are hidden behind a "Show redacted details" toggle per trace. Only metadata, hashes, statistics, and sizes visible by default. Diagnostic mode: redacted previews shown inline in detail sections. All content redacted before display regardless of mode.
- **D-38 — Privacy Mode as Separate Stricter Toggle:** Privacy Mode is distinct from Diagnostic Mode. When enabled, it forces metadata-only diagnostics and exports — NO prompt content, tool I/O, or memory content even in redacted form. Overrides Diagnostic Mode. Useful for enterprise, shared-device, or high-security environments.
- **D-39 — Toggle Locations:** Persistent Diagnostic Mode and Privacy Mode settings stored in Options → Diagnostics section. Quick status indicators and toggles also shown at the top of DiagnosticsPanel for convenient debugging workflows.

### the agent's Discretion
- Exact shape of `ExecutionContext` and `TraceCollector` interfaces — researcher/planner to determine the cleanest design consistent with existing DI patterns.
- TraceRedactor regex patterns — implement from product spec §4.4 redaction rules. Planner to handle edge cases (e.g., partial key matches).
- AITransactionLog internal architecture — class+singleton following existing patterns (ContextOptimizer, MemoryEngine analog). Constructor DI for AITransactionLogDB, TraceRedactor, WriteJournal.
- DiagnosticsPanel component tree — planner to break into focused sub-components (TransactionTable, TraceDetailPanel, ProviderTimeline, ToolCallDescriptions, CacheStats, ExportButton) following existing options component patterns.
- Export serialization format and ZIP assembly — use standard JSZip or equivalent. Manifest follows decisions above.
- Pruning implementation — periodic timer in background or at component mount in Full App. Planner to determine the best lifecycle hook.
- Diagnostic/Privacy mode state storage — Zustand store (`diagnosticsStore`) or chrome.storage.local key (`np_diagnostics_mode`, `np_privacy_mode`). Planner to choose consistent pattern.
- Exact IndexedDB schema updates for extended trace types — planner to evolve existing `transaction_log_*` stores from stub shapes to full product spec interfaces.
- Crash recovery logic — startup scan for transactions with status: `started`/`streaming` → mark as `aborted`.
- debugLog auto-redaction wrapper — planner to design the defensive safety net pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Scope
- `.planning/REQUIREMENTS.md` — TELE-01 through TELE-07, DATA-03. Full requirement traceability for all 8 Phase 6 requirements.
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria (6 items), dependency on Phase 3 (lines 199–214).

### Product Specification
- `.planning/PRODUCT_SPEC_v0_1.md` §4 (lines 561–693) — Full Telemetry & Diagnostics specification:
  - §4.1 (lines 561–581): AITransaction interface — fields: id, sessionId, conversationId, workspaceId, activeSurface, userTurnId, type, status, providerId, model, startedAt, endedAt, durationMs, errorCode
  - §4.2 (lines 583–607): PromptTrace interface — operationId, promptTemplateId, promptHash, token breakdown per section, contextTier, truncated, minimalMode, promptCache stats
  - §4.3 (lines 609–630): ToolTrace interface — operationId, parentOperationId, toolName, source, dangerous, permission decision, input/output schemas, status, timing
  - §4.4 (lines 632–644): ProviderTrace interface — operationId, attempts[] array (providerId, model, timing, outcome, errorCode), circuitBreakerTriggered
  - §4.5 (lines 647–675): TraceRedactor rules — mandatory redaction patterns (API keys, Bearer tokens, JSESSIONID, sysparmCK, g_ck, MCP auth headers, raw bodies, clipboard text). Redaction must run BEFORE writing to AITransactionLogDB, ErrorStore, debugLog, rendering in DiagnosticsPanel, or exporting.
  - §4.6 (lines 677–693): DiagnosticsPanel design — AntD component mapping: Table, Timeline, Descriptions, Statistic, Progress, List, copyable Typography
- `.planning/PRODUCT_SPEC_v0_1.md` §15.2 (lines 1832–1846): Redaction pipeline — must redact before WriteJournal, ErrorStore, debugLog, DiagnosticsPanel, and debug bundle export
- `.planning/PRODUCT_SPEC_v0_1.md` Phase 6 layout (lines 2175–2208): File layout for src/core/telemetry/, tests/core/telemetry/, DONE criteria

### Project Context
- `.planning/PROJECT.md` — Core constraints: MV3 restrictions (no IndexedDB from background SW), `@ai-sdk/*` only, package hygiene, two-surface architecture, security requirements (AES-GCM encrypted API keys, TraceRedactor on all logs).
- `.planning/STATE.md` — Session continuity, Phases 1-5 complete, current position at Phase 6.

### Prior Phase Decisions
- `.planning/phases/03-cost-effective-ai-runtime/03-CONTEXT.md` — Phase 3 pipeline architecture: AgentOrchestrator constructor DI, ProviderRouter circuit breaker/retry, Planner→Executor→Renderer pipeline, AITransactionLogDB stub, PromptCacheManager. Critical for where trace hooks insert.
- `.planning/phases/04-context-adaptive-execution/04-CONTEXT.md` — ContextOptimizer: `runWithContext()` canonical path, ContextProvenanceManifest with operationId, tier classification, degradation pipeline. operationId originates here.
- `.planning/phases/05-persistent-memory-architecture/05-CONTEXT.md` — MemoryEngine: pre/post lifecycle hooks, single-writer via BroadcastBus, WriteJournal patterns for multi-store consistency. Phase 6 extends these with trace events.

### Existing Code Dependencies
- `src/core/storage/stores/AITransactionLogDB.ts` — Current stub with simplified trace shapes (93 lines). Must be replaced/extended with full product spec types for AITransaction, PromptTrace, ToolTrace, ProviderTrace.
- `src/core/storage/stores/ErrorStore.ts` — Existing error store (FIFO, 100 max). Phase 6 traces severity through here.
- `src/core/storage/IndexedDBManager.ts` — DB_VERSION=2, schemas for `transaction_log_transactions`, `transaction_log_promptTraces`, `transaction_log_toolTraces`, `transaction_log_providerTraces` stores. Must be extended to match full product spec interfaces.
- `src/core/ai/pipeline/AgentOrchestrator.ts` — `runWithContext()` at line 79, constructor DI (line 34). Primary integration point for AITransactionLog lifecycle.
- `src/core/ai/router/ProviderRouter.ts` — `selectModel()` retry/fallback chain. ProviderTrace attempts[] recorded here.
- `src/core/ai/pipeline/PlannerService.ts` — `plan()` method. Trace event emission for planner calls.
- `src/core/ai/pipeline/ExecutorService.ts` — `execute()` with permission check (line 25) and tool execution (line 40). ToolTrace events.
- `src/core/ai/pipeline/RendererService.ts` — `render()` with streaming. Renderer trace events.
- `src/core/ai/cache/PromptCacheManager.ts` — Cache hit/miss/invalidation events.
- `src/core/memory/MemoryEngine.ts` — `assemble()` pre-optimization, `extract()` post-execution. Memory trace events.
- `src/core/storage/WriteJournal.ts` — Multi-store consistency. WriteJournal trace events for recovery/failure/completion.
- `src/core/messaging/broadcastBus.ts` — Event dispatching patterns (WORKSPACE_UPDATED, MEMORY_WRITE_REQUEST). May be extended for diagnostics broadcast events.
- `src/core/utils/debugLog.ts` — debugLog utility with `__DEV__` guard. Must be extended with auto-redaction safety net.
- `src/components/options/OptionsRoot.tsx` — Options section registry. `'diagnostics'` section already registered at line 35. DiagnosticsPanel injected via `renderSectionContent`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **AITransactionLogDB** (`src/core/storage/stores/AITransactionLogDB.ts`): Existing class+singleton with `logTransaction`, `getTransaction`, `logPromptTrace`, `logToolTrace`, `logProviderTrace` methods. Phase 6 replaces stub types with full product spec interfaces and adds `getTraceTree(operationId)` assembly method.
- **ErrorStore** (`src/core/storage/stores/ErrorStore.ts`): Class+singleton with `logError`, `getErrors`, `clear`. FIFO enforcement (100 max). Phase 6 extends with severity field.
- **IndexedDBManager** (`src/core/storage/IndexedDBManager.ts`): DB_VERSION=2 with existing `transaction_log_*` stores. Phase 6 extends schemas to match full product spec types. May require DB_VERSION bump to v3.
- **AgentOrchestrator** (`src/core/ai/pipeline/AgentOrchestrator.ts`): `runWithContext()` at line 79 is the primary lifecycle integration point. Constructor DI at line 34. ExecutionContext + TraceCollector injected here.
- **ProviderRouter** (`src/core/ai/router/ProviderRouter.ts`): `selectModel()` retry/fallback chain (line 21). ProviderTrace with attempts[] recorded per attempt.
- **WriteJournal** (`src/core/storage/WriteJournal.ts`): Multi-store consistency for trace batch writes. Used by AITransactionLog for transaction close persistence.
- **BroadcastBus** (`src/core/messaging/broadcastBus.ts`): Existing event dispatching pattern. May be used for diagnostics mode change notifications.
- **OptionsRoot** (`src/components/options/OptionsRoot.tsx`): `'diagnostics'` section already registered. `OptionsRootProps.renderSectionContent` prop for injection.
- **debugLog** (`src/core/utils/debugLog.ts`): `__DEV__`-guarded logging. Must gain auto-redaction safety net.

### Established Patterns
- **Class + singleton export**: All registry classes and services follow this pattern. AITransactionLog and TraceRedactor match.
- **Constructor dependency injection**: AgentOrchestrator, ContextOptimizer, ProviderRouter all use constructor DI. AITransactionLog injects AITransactionLogDB, TraceRedactor, WriteJournal.
- **Direct path imports**: No barrel/index files. New telemetry modules in `src/core/telemetry/`.
- **Interface + default implementation**: PermissionService pattern. TraceCollector as interface, DefaultTraceCollector as implementation.
- **Zustand v5 stores**: `create() + persist()` with `createJSONStorage`. Diagnostics/Privacy mode state may use this.
- **WriteJournal lifecycle**: begin → markStepStart → write → markStepComplete → markCompleted. AITransactionLog batch-write uses this.
- **`np_` key prefix**: All chrome.storage keys use this. New keys: `np_diagnostics_mode`, `np_privacy_mode`.
- **Test patterns**: Vitest + jsdom, tests in `tests/core/telemetry/`. `vi.hoisted()` for mock variables.

### Integration Points
- **AgentOrchestrator.runWithContext()** — Primary lifecycle integration. ExecutionContext created here, passed to all services. AITransactionLog wraps start/complete/fail/abort.
- **ProviderRouter.selectModel()** — ProviderTrace attempts[] recorded per retry/fallback. TraceCollector receives onProviderAttempt events.
- **PlannerService.plan() / ExecutorService.execute() / RendererService.render()** — Each emits typed trace events through ExecutionContext.traceCollector.
- **MemoryEngine.assemble() / extract()** — Trace events for memory retrieval and extraction.
- **PromptCacheManager** — Trace events for cache hit/miss/invalidation.
- **WriteJournal** — Trace events for journal recovery/failure/completion.
- **OptionsRoot** — DiagnosticsPanel injected via `renderSectionContent('diagnostics')`. Deep-linking via query param parsed in Full App entrypoint.
- **IndexedDB Schema** — Existing `transaction_log_*` stores must be extended. May require migration from DB_VERSION 2 → 3.
</code_context>

<specifics>
## Specific Ideas

### ExecutionContext Flow (conceptual)
```
AgentOrchestrator.runWithContext(optimizedContex)
  → Create operationId = optimizedContex.provenance.operationId
  → Create ExecutionContex { traceCollector, operationId, abortSignal, verbosity, privacyMode }
  → AITransactionLog.start(operationId) → write minimal transaction record
  → Pass ExecutionContex to Planner, Executor, Renderer, ProviderRouter, MemoryEngine, Cache, WriteJournal
  → Services emit trace events synchronously to traceCollector (cheap struct push)
  → On complete/fail/abort: AITransactionLog.close() → redact all traces → batch-write via WriteJournal
  → On crash/reload: startup recovery scans for started/streaming → mark as aborted
```

### Trace Tree Assembly (conceptual)
```
AITransaction (operationId, type, status, severity, timing)
├── PromptTrace[] (one per planner/renderer call — token breakdowns, cache stats, tier)
├── ProviderTrace[] (one per operation — attempts[] array per retry/fallback)
├── ToolTrace[] (one per tool call — permission decision, outcome, timing)
├── CacheTrace[] (hit/miss per section, invalidation events)
├── MemoryTrace[] (retrieval summary, extraction outcome)
├── WriteJournalTrace[] (operation type, steps, recovery events)
└── ErrorTrace[] (linked by operationId + severity)
```

### DiagnosticsPanel Layout (conceptual)
```
┌─────────────────────────────────────────────────────┐
│ [Filter Bar: type ▾ status ▾ provider ▾ severity ▾]  │
│ [date range ▾] [Search...                    ]       │
│ [Diagnostic Mode: OFF] [Privacy Mode: OFF] [Export]  │
├──────────────────────┬──────────────────────────────┤
│ Transaction List     │ Detail Panel                 │
│ ┌──────────────────┐ │ ┌──────────────────────────┐ │
│ │ ✓ chat completed │ │ │ Transaction #abc123      │ │
│ │ ✓ tool failed    │ │ │ Status: completed         │ │
│ │ ⚠ planner warn   │ │ │ Duration: 1.2s            │ │
│ │ ✗ renderer error │ │ ├──────────────────────────┤ │
│ │ ...              │ │ │ Provider Timeline        │ │
│ └──────────────────┘ │ │ ● anthropic (1.1s) ✓      │ │
│                      │ │ ● ollama (timed out) ⚠     │ │
│                      │ ├──────────────────────────┤ │
│                      │ │ Tool Calls               │ │
│                      │ │ ● echo (allowed) ✓        │ │
│                      │ ├──────────────────────────┤ │
│                      │ │ Cache Stats              │ │
│                      │ │ Hit: 2 | Miss: 1          │ │
│                      │ │ Saved: 1,200 tokens       │ │
│                      │ ├──────────────────────────┤ │
│                      │ │ [Show redacted details ▸] │ │
│                      │ │ [Export this trace    ⤓] │ │
│                      │ └──────────────────────────┘ │
└──────────────────────┴──────────────────────────────┘
```

### Redaction Pipeline (from product spec §4.4)
```
Mandatory patterns:
  /sk-[A-Za-z0-9_-]+/g              → [REDACTED:API_KEY]
  /key-[A-Za-z0-9_-]+/g             → [REDACTED:API_KEY]
  /Bearer\s+[A-Za-z0-9._-]+/gi      → [REDACTED:BEARER_TOKEN]
  /JSESSIONID=[^;\s]+/gi            → [REDACTED:JSESSIONID]
  /sysparm_ck[=:]\s*[^&\s]+/gi      → [REDACTED:sysparmCK]
  /g_ck[=:]\s*[^&\s]+/gi            → [REDACTED:g_ck]
  MCP auth headers                   → [REDACTED:MCP_AUTH]
  Raw prompt bodies (default)        → [REDACTED:RAW_BODY]
  Raw tool input/output (default)    → [REDACTED:RAW_BODY]
  Clipboard text                     → [REDACTED:CLIPBOARD]
  ServiceNow raw case body           → [REDACTED:CASE_BODY]
```

### File Layout (from PRODUCT_SPEC Phase 6)
- `src/core/telemetry/AITransactionLog.ts` — Orchestration class, lifecycle management, batch-write coordination
- `src/core/telemetry/TraceRedactor.ts` — Pattern-based redaction, typed placeholders
- `src/core/telemetry/AITransactionLogDB.ts` — Extended DB methods with full trace types, getTraceTree()
- `src/core/telemetry/types.ts` — Full AITransaction, PromptTrace, ToolTrace, ProviderTrace, CacheTrace, MemoryTrace, WriteJournalTrace types plus TraceCollector interface and ExecutionContext
- `src/core/telemetry/pruning.ts` — Retention pruning logic (scheduled + startup)
- `src/core/telemetry/export.ts` — Debug bundle serialization and ZIP assembly
- `src/components/options/DiagnosticsPanel.tsx` — Master-detail layout with filter bar
- `src/components/options/DiagnosticsSection.tsx` — Options page wrapper
- `src/components/diagnostics/TransactionTable.tsx` — Filterable transaction list
- `src/components/diagnostics/TraceDetailPanel.tsx` — Full trace tree detail view
- `src/components/diagnostics/ProviderTimeline.tsx` — AntD Timeline for provider attempts
- `src/components/diagnostics/ToolCallDescriptions.tsx` — AntD Descriptions for tool calls
- `src/components/diagnostics/CacheStats.tsx` — AntD Statistic cards
- `tests/core/telemetry/AITransactionLog.test.ts`
- `tests/core/telemetry/TraceRedactor.test.ts`
- `tests/core/telemetry/pruning.test.ts`
</specifics>

<deferred>
## Deferred Ideas

- **Export merge back / import for diagnostics** — conflicts with data portability phase (Phase 8).
- **Real-time diagnostics streaming to external dashboard** — out of scope for v0.1.
- **Custom retention policy configuration per user** — fixed policy for v0.1; configurable in Phase 7 Options.
- **Diagnostics analytics / aggregate stats over time** — out of scope for v0.1.
- **Performance profiling via trace data** — out of scope for v0.1 (Phase 9 Hardening).

None beyond scope — all discussion stayed within phase boundaries.
</deferred>

---

*Phase: 6-Transaction Logging and Diagnostics*
*Context gathered: 2026-07-13*
