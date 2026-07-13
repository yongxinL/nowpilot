# Phase 6: Transaction Logging and Diagnostics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 06-transaction-logging-and-diagnostics
**Areas discussed:** Trace Injection Strategy, Redaction Timing & Approach, DiagnosticsPanel UX Layout, Export Format & Scope, Transaction Correlation Model, Trace Retention & Pruning Policy, Error Classification & Severity Model, Performance & Sampling Strategy, Diagnostics Privacy & Access Policy

---

## Trace Injection Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Orchestrator-only | AITransactionLog wraps runWithContext() only | |
| Distributed into services | Each service owns its own tracing | |
| Hybrid — orchestrator owns lifecycle, services emit trace events | Lifecycle centralized, services emit typed events | ✓ |

**User's choice:** Hybrid — AgentOrchestrator owns transaction lifecycle (operationId, correlation, start/complete/fail, persistence). Services emit typed trace events through a callback/event interface.

| Option | Description | Selected |
|--------|-------------|----------|
| Event emitter / Observable | Shared event bus | |
| Return trace data in method results | Traces in return values | |
| Request-scoped TraceCollector callback | Per-request collector passed to services | ✓ |

**User's choice:** Request-scoped TraceCollector callback/interface created by AgentOrchestrator, passed into services. Avoids global event bus complexity.

| Option | Description | Selected |
|--------|-------------|----------|
| At transaction close — single batch write | All traces in one batch via WriteJournal | |
| Streaming — write each trace immediately | Write as they occur | |
| Hybrid checkpoint + final batch write | Minimal start record, batch-write on close | ✓ |

**User's choice:** Minimal transaction record at start, collect detailed traces in memory, batch-write on close via WriteJournal. Startup recovery marks open transactions as aborted.

| Option | Description | Selected |
|--------|-------------|----------|
| Single provider trace with attempts[] array | One trace, retries appended | ✓ |
| Separate provider trace per attempt | New trace per retry | |

**User's choice:** Single ProviderTrace per operation with retries/fallbacks appended to attempts[] array.

**More questions asked:**

| Option | Description | Selected |
|--------|-------------|----------|
| Pipeline + MemoryEngine only | Minimal service set | |
| Pipeline + MemoryEngine + Cache + WriteJournal | Extended set including cache and journal | ✓ |

**User's choice:** Planner, Executor, Renderer, ProviderRouter, MemoryEngine, PromptCacheManager, and WriteJournal all emit trace events.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed detail — always trace everything | No config | |
| Two-level — normal and diagnostic mode | Normal (metadata only) + Diagnostic (opt-in, redacted previews) | ✓ |

**User's choice:** Two-level verbosity: Normal (always enabled, metadata only) + Diagnostic (user opt-in, short-retention, redacted previews).

| Option | Description | Selected |
|--------|-------------|----------|
| Interface in pipeline types, passed via constructor DI | Constructor injection | |
| Method parameter — optional arg on each method | Method param | |
| Request-scoped ExecutionContext | Bundles TraceCollector, operationId, AbortSignal | ✓ |

**User's choice:** Request-scoped ExecutionContext containing TraceCollector, operationId, AbortSignal, and runtime metadata.

---

## Redaction Timing & Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Eager — redact before any persistence | Never write raw to disk | ✓ |
| Lazy — store raw, redact on display/export | Raw data persisted | |

**User's choice:** TraceRedactor runs before any trace, error, debug, or export data is persisted. Lazy redaction prohibited.

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone utility — call before each write | Pure function module | |
| Middleware/pipeline — transparent interceptor | Transparent layer | |
| Explicit middleware inside AITransactionLog | Raw → Collect → AITransactionLog → Redactor → Persist | ✓ |

**User's choice:** Redaction as explicit middleware inside AITransactionLog. Not ad-hoc utility calls from individual services.

| Option | Description | Selected |
|--------|-------------|----------|
| debugLog receives only pre-redacted data | Callers responsible | |
| debugLog auto-redacts via wrapper | Proxy wrapper | |
| Both — primary boundary at AITransactionLog, debugLog as safety net | Defense in depth | ✓ |

**User's choice:** Primary boundary is AITransactionLog. debugLog also auto-redacts as a defensive safety net.

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with placeholder — '[REDACTED]' | Generic placeholder | |
| Remove fields entirely | Delete fields | |
| Typed placeholders — `[REDACTED:API_KEY]` | Specific category labels | ✓ |

**User's choice:** Typed placeholders: `[REDACTED:API_KEY]`, `[REDACTED:BEARER_TOKEN]`, `[REDACTED:JSESSIONID]`, etc. Fields never removed entirely.

---

## DiagnosticsPanel UX Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs — one per trace domain | Tabbed by category | |
| Single scrollable page with sections | All data scrollable | |
| Master-detail — transaction list left, detail right | Select → trace tree in side panel | ✓ |

**User's choice:** Transaction-centered master-detail: filterable list on left, full trace tree detail panel on right. Supports deep-linking.

| Option | Description | Selected |
|--------|-------------|----------|
| Full filter bar | Type, status, provider, severity, date, search | ✓ |
| Minimal — search text + status only | Simple filtering | |

**User's choice:** Full filter bar with type, status, provider, severity, date range, and free-text search.

| Option | Description | Selected |
|--------|-------------|----------|
| Query param with operationId | URL-based deep link | ✓ |
| chrome.storage.session signal | Signal-based | |

**User's choice:** `app.html?page=options&section=diagnostics&operationId=<id>` query parameter.

| Option | Description | Selected |
|--------|-------------|----------|
| Product spec design — Table, Timeline, Descriptions, Statistic | Specified AntD mapping | ✓ |
| All inline with Collapse panels | Simpler layout | |

**User's choice:** Product spec component mapping. Collapse only for optional raw redacted details.

---

## Export Format & Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All trace types — user-selectable scope | Full export with category selection | ✓ |
| Transactions + errors only | Minimal export | |

**User's choice:** All trace types, user-selectable. Single operation → JSON, multiple → ZIP bundle with manifest.

| Option | Description | Selected |
|--------|-------------|----------|
| Standard metadata manifest | Export version, timestamp, extension version, filters, redaction version | ✓ |
| Minimal — just the traces | No metadata | |

**User's choice:** Standard manifest.json with export version, generation timestamp, extension version, transaction count, date range, filters, trace types, redaction version, verbosity level, Privacy Mode status.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — context menu on each transaction row | Single-operation export action | ✓ |
| No — only bulk export | Filtered result set only | |

**User's choice:** Each transaction row has "Export Trace" action for single-operation export.

| Option | Description | Selected |
|--------|-------------|----------|
| No — export is user's copy; DB keeps its own lifecycle | Independent files | ✓ |
| Yes — mark exported traces as pinned | Pinned flag | |

**User's choice:** Export creates independent files. DB follows normal pruning. No pin management.

---

## Transaction Correlation Model

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — operationId is the universal correlation key | Single key | ✓ |
| Hierarchical — parentOperationId for nested operations | Nested chaining | |

**User's choice:** operationId as universal correlation key. parentOperationId only for true nested/background child operations.

| Option | Description | Selected |
|--------|-------------|----------|
| Same operationId — retries are attempts within the operation | Single operation scope | ✓ |
| New operationId per retry with parentOperationId linking | Child operations | |

**User's choice:** Retries/fallbacks stay under the same operationId in ProviderTrace.attempts[].

| Option | Description | Selected |
|--------|-------------|----------|
| Eager — AITransactionLog assembles on close | Batch-write with matching IDs | |
| Lazy — DiagnosticsPanel joins at query time | Query-time assembly | |
| Normalized storage + getTraceTree(operationId) API | Assembly API on DB layer | ✓ |

**User's choice:** Store each trace type separately with operationId index. Expose `getTraceTree(operationId)` for assembly.

---

## Trace Retention & Pruning Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid — time-based with count cap | Both limits enforced | ✓ |
| Time-based only — 30 day rolling window | Time only | |
| Count-based only — max N per trace type | Count only | |

**User's choice:** Hybrid retention — time AND count limits. Whichever hits first triggers pruning.

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered retention | Transactions: 30d/5000; Normal: 14d/2000; Diagnostic: 7d/500; Errors: 30d/1000 | ✓ |
| Uniform retention | All same limits | |

**User's choice:** Tiered retention per trace type.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — retain failures longer | Failure-prioritized pruning | ✓ |
| No — uniform pruning regardless of status | Uniform | |

**User's choice:** Failures retained longer. Oldest successes pruned first.

| Option | Description | Selected |
|--------|-------------|----------|
| No — export is user's copy; DB keeps its own lifecycle | Independent | ✓ |
| Yes — mark exported traces as pinned | Pin management | |

**User's choice:** Export does not affect retention policy.

| Option | Description | Selected |
|--------|-------------|----------|
| Periodic (every N minutes) + on startup | Scheduled background pruning | ✓ |
| On every transaction close | Close-time pruning | |
| Startup only | Minimal overhead | |

**User's choice:** Startup + periodic (5 min). Transaction close schedules a debounced prune. Never synchronous.

---

## Error Classification & Severity Model

| Option | Description | Selected |
|--------|-------------|----------|
| Four levels — DEBUG, INFO, WARNING, ERROR | Standard levels | |
| Three levels — INFO, WARNING, ERROR | Simplified | |
| Five levels — DEBUG, INFO, WARNING, ERROR, CRITICAL | Add critical for system integrity | ✓ |

**User's choice:** Five levels including CRITICAL for storage/encryption/journal/migration failures.

| Option | Description | Selected |
|--------|-------------|----------|
| Consistent with product spec | CRITICAL: journal/storage/encryption. ERROR: tool/export/provider exhaustion. WARNING: timeout/cache miss/retry. INFO: cache hit/completion. DEBUG: raw detail | ✓ |
| Custom classification | User-defined mappings | |

**User's choice:** Product spec-aligned classification.

| Option | Description | Selected |
|--------|-------------|----------|
| Stored on AITransaction — set at close time | Worst severity among traces | ✓ |
| Derived — computed from traces at query time | Query-time calculation | |

**User's choice:** Severity stored on transaction at close, computed as worst among all child traces.

---

## Performance & Sampling Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Sample successes, always trace failures | 100% traces on failures, last 500 successes | ✓ |
| Always trace everything | Full tracing for all | |

**User's choice:** Failures/warnings/retries/fallbacks/aborted/critical → 100% traced. Successes → latest 500 detailed, metadata kept longer.

| Option | Description | Selected |
|--------|-------------|----------|
| Truncate to reasonable limits | Normal: 2KB prompt/4KB tool I/O. Diagnostic: larger but capped | ✓ |
| Store full payloads — no truncation | No limits | |

**User's choice:** Large payloads redacted and truncated. Normal mode has tight caps. Never store full raw bodies/secrets.

| Option | Description | Selected |
|--------|-------------|----------|
| Periodic (every N minutes) + on startup | Background pruning | ✓ |
| On every transaction close | Close-time | |
| Startup only | Minimal overhead | |

**User's choice:** Startup + periodic. Debounced from transaction close.

**Additional question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Buffered — emit to TraceCollector, batch-write on close | In-memory accumulation | ✓ |
| Synchronous — write each trace to IndexedDB immediately | Immediate persistence | |

**User's choice:** Buffered trace collection. Services emit to in-memory TraceCollector. AITransactionLog batch-writes on close. No IndexedDB writes during execution.

---

## Diagnostics Privacy & Access Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden by default — expandable on click with redaction | "Show redacted details" toggle per trace | ✓ |
| Always visible if diagnostic mode is on | Inline redacted previews | |
| Never visible — metadata only | No content access | |

**User's choice:** Hidden by default. Expandable on click. Diagnostic mode shows redacted previews inline. Always redacted before display.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — Privacy Mode as a separate toggle | Stricter metadata-only override | ✓ |
| No — Privacy is handled by normal/diagnostic mode | Two levels only | |

**User's choice:** Privacy Mode as separate stricter toggle — forces metadata-only, overrides Diagnostic Mode.

| Option | Description | Selected |
|--------|-------------|----------|
| Options → Diagnostics section | Persistent settings in Options | |
| Inline in DiagnosticsPanel | Quick access in panel | |
| Both — persistent in Options + quick toggles at top of panel | Both locations | ✓ |

**User's choice:** Persistent settings in Options → Diagnostics + quick toggles at top of DiagnosticsPanel.

---

## the agent's Discretion

- Exact shape of ExecutionContext and TraceCollector interfaces
- TraceRedactor regex pattern implementation and edge cases
- AITransactionLog internal architecture (class+singleton, constructor DI)
- DiagnosticsPanel component tree breakdown
- Export serialization format and ZIP assembly
- Pruning implementation (periodic timer lifecycle)
- Diagnostic/Privacy mode state storage (Zustand or chrome.storage)
- IndexedDB schema evolution (stub → full product spec types)
- Crash recovery logic (startup orphaned transaction scan)
- debugLog auto-redaction wrapper design

## Deferred Ideas

- Export merge back / import for diagnostics → Phase 8 (Data Portability)
- Real-time diagnostics streaming to external dashboard → out of scope v0.1
- Custom retention policy configuration per user → Phase 7 Options
- Diagnostics analytics / aggregate stats over time → out of scope v0.1
- Performance profiling via trace data → Phase 9 (Hardening)
- Custom severity classification → out of scope v0.1
