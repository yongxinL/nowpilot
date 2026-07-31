# Phase 4a: Page Content Extraction - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

PageContentService — core layered page extraction. Users extract page content via a layered strategy (Defuddle primary → Readability fallback for `default` mode; APC-lite DOM+ARIA walk for `actionable` mode), indexed in an ephemeral per-tab MiniSearch index. Content script stays extraction-only (<50KB, no React/AntD/defuddle/yaml/FS Access) — it serializes HTML only; Defuddle/Readability/APC-lite parsing runs in the side panel / full app (extension page contexts). SPA-nav (wxt:locationchange) + tabs.onUpdated invalidate the per-tab cache. Password field values never captured. Extracted content feeds `ContextOptimizerInput.pageContext` (Phase 4 contract, D-05/D-18 sourceId `context.page.current-url`).

</domain>

<decisions>
## Implementation Decisions

### Content Capture (content script)
- **D-01:** Content script captures full `document.documentElement.outerHTML` (size-capped ~2MB) with password-field value redaction at capture time via `DomSerializer` — no extraction heuristics in the content bundle. Full-document serialization is simpler and more robust than subtree targeting, and keeps the content bundle minimal. — **Reversibility:** reversible — switching to subtree capture is local to DomSerializer.
- **D-02:** `DomSerializer` (in `src/core/content/`) is the content-script-safe serializer: walks DOM, omits `value` for password fields (`input[type=password]`, `isPassword` attribute, `autocomplete=current-password` heuristic), never logs or transmits captured text. Renamed from `AxDomWalker` to avoid confusion with accessibility-tree concepts. — **Reversibility:** one-way — redaction correctness is a privacy contract; relaxing it later would require re-auditing captured data.

### Content Script Messaging
- **D-03:** Full migration to RuntimeEnvelope + MessageBus pattern. Replace all raw `chrome.runtime.sendMessage` calls in `content.core.ts` with `createEnvelope()` (from `src/core/runtime/RuntimeEnvelope.ts`). Register incoming message handlers via `MessageBus.register()` (from `src/core/messaging/MessageBus.ts`). Both `SPA_NAVIGATION` and `EXTRACT_PAGE_CONTENT` use typed `RuntimeEnvelope` contracts. Remove unused `CONTENT_SCRIPT_READY` message. — **Reversibility:** costly — changing the messaging contract after migration touches every listener and future consumer; one-time migration cost is small relative to long-term type safety and diagnostics benefits.
- **D-04:** `EXTRACT_PAGE_CONTENT` uses request/response semantics via `chrome.runtime.onMessage` `sendResponse` callback (already wrapped by `MessageBus.init()`). The content script receives the envelope, serializes HTML synchronously, and returns the result through `sendResponse`. `SPA_NAVIGATION` is an outbound-only event (no response expected). No separate response envelope type needed. — **Reversibility:** costly — `sendResponse` is the established Chrome extension pattern; switching to a pair-envelope model would require changing all consumers.

### Execution Context (where parsing runs)
- **D-05:** Defuddle/Readability/APC-lite parsing runs in the side panel / full app (extension page contexts with DOMParser), NOT in the service worker and NOT in the content bundle (spec §26.4). Strategies accept an HTML string and construct their own `DOMParser` document. The requesting surface (Side Panel / Full App) invokes `PageContentService.extract()` and owns the result. — **Reversibility:** costly — moving parsing to another context (e.g. offscreen document) would touch messaging, caching, and tests.
- **D-06:** `PageContextBridge` (in `src/core/content/`) routes `EXTRACT_PAGE_CONTENT` requests via MessageBus — content script responds with serialized HTML + metadata (url, title, capturedAt, size); core responds with `ExtractionResult`. SPA navigation events flow through the same MessageBus for cache invalidation. — **Reversibility:** costly — MessageBus is the established cross-context contract; replacing the bridge changes every consumer.

### Layered Strategy
- **D-07:** `DefuddleStrategy` is PRIMARY for mode `default` (read/summarize). Fallback to Readability when Defuddle yields low-confidence output: no content / content < ~500 chars / parse exception / >5s timeout (global budget, shared across the full fallback chain). The source used (`defuddle` vs `readability`) is recorded in the extraction result and surfaces in provenance (`compressionApplied`/source metadata). — **Reversibility:** reversible — fallback thresholds are strategy-local constants.
- **D-08:** `ApcLiteStrategy` runs for mode `actionable` — builds an `APCLiteNode` tree per Appendix C (Zod-validated via `apcLite.types.ts`): roles, geometry, interaction info, node ids. Same DOMParser-in-extension-page execution model. Readiness for v2 automation is preserved in the schema (§26.7) — no automation in v0.1. — **Reversibility:** one-way — the APCLiteNode schema is the automation substrate; changing it later would orphan v2 consumers (spec §26.7).
- **D-09:** Strategy contract per spec §26.3: `IExtractionStrategy` with `id`, `canHandle({url, mode})`, `run(input) → StrategyResult` (markdown and/or APCLiteNode tree). ServiceNow Table-API first path belongs to the ServiceNow add-on (Phase 8), not this phase — `canHandle` returns false for it here.
- **D-10:** Extraction timeout is a **5s global budget** shared across the entire fallback chain. Each strategy executes with the remaining available budget. If Defuddle times out at 4s, Readability gets 1s to attempt fallback. Once the global deadline is reached, return `ExtractionError` with `TIMEOUT` error code and the list of `strategiesAttempted`. — **Reversibility:** reversible — the 5s constant and budget-sharing algorithm are local to PageContentService.

### Extraction API Design
- **D-11:** `PageContentService.extract()` returns an `ExtractionResult` discriminated union: `{ ok: true, pageContext: PageContext }` | `{ ok: false, error: ExtractionError }`. `ExtractionError` carries `code` (NO_CONTENT, TIMEOUT, PARSE_ERROR, CAPTURE_FAILED) and `strategiesAttempted` (ordered list of strategy IDs tried). Operational failures never throw — they return typed failure results for telemetry and graceful degradation. — **Reversibility:** one-way — the discriminated union becomes the API contract for all consumers (ContextAssembler, future MCP tools, diagnostics).
- **D-12:** `PageContext` is a discriminated union keyed by `mode`: `{ mode: 'default', markdown: string, ...BaseMetadata }` | `{ mode: 'actionable', apcLiteTree: APCLiteNode, ...BaseMetadata }`. Shared `BaseMetadata` includes: `url`, `title`, `capturedAt`, `size`, `source` (`defuddle` / `readability` / `apc-lite`), `extractionLevel`, `truncated`, `compressionApplied`. Optional enrichment fields: `author`, `publishDate`, `language`, `description`, `siteName` — populated from Defuddle, Open Graph, or Schema.org metadata when available. — **Reversibility:** costly — the mode discriminator is baked into downstream type narrowing; adding a third mode requires extending every consumer's switch exhaustiveness check.
- **D-13:** `PageContentService.reExtract(tabId)` exposes explicit force re-extraction as an infrastructure capability — invalidates cache, re-extracts, and rebuilds index immediately. No UI or tool integration in Phase 4a — just the API. Lazy extraction via `extract()` remains the default path. — **Reversibility:** reversible — adding the API is additive; removing it only breaks future consumers that haven't been written yet.

### Page Index (MiniSearch)
- **D-14:** `PageIndexBuilder` creates one **ephemeral** per-tab MiniSearch instance over extracted content. Index survives SPA navigations within the tab session (incremental invalidation + re-extraction triggered by `SPA_NAVIGATION` events), but is destroyed on tab close. Never persisted to IndexedDB or chrome.storage (spec §26.5). — **Reversibility:** one-way — persistent vs ephemeral is a privacy boundary; persisting later would need a migration + user consent.
- **D-15:** MiniSearch indexes heading-aware chunks with BM25 ranking. Each chunk carries a heading breadcrumb (`h1 → h2 → h3` path). `selectRelevant(query)` performs BM25 retrieval with heading-aware score boosting — chunks whose heading text or heading path match query terms receive a relevance boost on top of the base BM25 score. Results are top-K chunks within the available token budget. — **Reversibility:** reversible — ranking algorithm and boost weights are local to PageIndexBuilder.
- **D-16:** Token budget for page content injection lives in **ContextOptimizer**, not PageContentService. `ContextOptimizer` obtains the per-tier page-content allocation from `TokenBudget.allocateBudget(tier)` and uses that value when calling `selectRelevant(query, budget)`. PageContentService stays focused on extraction + indexing + retrieval — no AI-context concerns leak into the extraction layer. — **Reversibility:** reversible — the budget source is a single call site in ContextOptimizer; changing it doesn't touch PageContentService.

### Cache & Invalidation
- **D-17:** `PageContentCache` is a per-tab in-memory Map (tabId → {url, result, indexedAt}). Invalidation: URL change via `SPA_NAVIGATION` event (emitted by content script via MessageBus) and `tabs.onUpdated` (status complete + URL diff). Re-extraction is **lazy** — next request to the tab triggers fresh extraction, never eager background extraction. Explicit `reExtract(tabId)` available for force re-extraction. — **Reversibility:** reversible — invalidation policy is cache-local.
- **D-18:** Concurrency guard: duplicate extractions per tab coalesce into a single in-flight promise; hard 5s global timeout per extraction (D-10); on failure fall back (Defuddle→Readability, AX→DOM) and record the source in `strategiesAttempted`.

### Redaction & Privacy
- **D-19:** TraceRedactor-style redaction runs before indexing or logging (§4.4/§16): API keys, bearer tokens, emails in extracted text. Password values never captured at source (D-02). Metrics recorded per extraction (duration, node/char count, source, truncation) feed Phase 6 Diagnostics — no content payloads in metrics.

### Bundle & Isolation Enforcement
- **D-20:** Content bundle must contain no React, AntD, defuddle, yaml, or FS Access API usage and stay < 50KB. Enforced by `tests/isolation/no-content-script-ui.test.ts` (import-graph isolation test) + a bundle-size assertion in the phase verification script (`pnpm run verify:phase-4a`). New npm dependencies (defuddle, @mozilla/readability, minisearch) are permitted only in extension-page contexts (Side Panel / Full App bundles). — **Reversibility:** one-way — the <50KB extraction-only cap is a product constraint (§5.6, §22.1); violating it silently breaks the isolation contract.

### the agent's Discretion
- Exact heading-chunking limits, Readability fallback thresholds (char count), and DOM capture size caps are implementation constants — planner may tune within the decision bounds above.
- BM25 boost weight for heading-path matches — planner selects reasonable defaults.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Spec (primary source of truth)
- `.planning/PRODUCT_SPEC_v0_1.md` §26 — PageContentService layered extraction: §26.1 principle, §26.2 layered strategy order, §26.3 strategy contract, §26.4 content-bundle constraint (parsing location), §26.5 MiniSearch integration + 2,000-token budget, §26.6 reliability & privacy (5s timeout, redaction, passwords, invalidation), §26.7 automation deferred to v2, §26.8 reference projects
- `.planning/PRODUCT_SPEC_v0_1.md` §22.1/§22.2 — content script bundle cap <50KB + webpage token budget 2,000
- `.planning/PRODUCT_SPEC_v0_1.md` §5.6 — MV3 extraction-only rule (no UI rendering, no host-page write-back in v0.1)
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C — APCLiteNode schema (Zod) for `apcLite.types.ts`
- `.planning/PRODUCT_SPEC_v0_1.md` §4.4/§16 — TraceRedactor redaction rules
- `.planning/PRODUCT_SPEC_v0_1.md` §13 — 5s hard timeout policy

### Cross-Phase Contracts
- `.planning/REQUIREMENTS.md` — PAGE-01 (layered extraction + ephemeral MiniSearch + per-tab SPA-nav cache)
- Phase 4 context `.planning/phases/04-context-optimization-pipeline/04-CONTEXT.md` — D-05 (`pageContext` optional field feeding ContextOptimizerInput), D-18 (sourceId `context.page.current-url`), D-09/11 (TokenBudget.allocateBudget for per-tier page allocation)
- Phase 3 context `.planning/phases/03-ai-core-pipeline/03-CONTEXT.md` — D-10 (serializable PipelineError), D-12 (PlannerContext extension interfaces superseded by Phase 4 AgentTurnInput)
- `.planning/PRODUCT_SPEC_v0_1.md` §4.5 — Diagnostics metrics contract (duration, node/char count, source, truncation)

### Codebase
- `entrypoints/content.core.ts` — existing extraction-only content script with SPA navigation detection; Phase 4a fully migrates to RuntimeEnvelope + MessageBus and adds DomSerializer/EXTRACT_PAGE_CONTENT handling
- `src/core/runtime/RuntimeEnvelope.ts` — established cross-context messaging contract with `EXTRACT_PAGE_CONTENT` and `SPA_NAVIGATION` already defined in `MessageTypeValues`
- `src/core/messaging/MessageBus.ts` — envelope validation, handler registration, and `chrome.runtime.onMessage` dispatch wrapping
- `src/core/context/TokenBudget.ts` — Phase 4 CJK-aware token estimation and per-tier budget allocation (used by ContextOptimizer for page-content budget)
- `src/core/context/ContextProvenanceManifest.ts` — provenance recording for `compressionApplied: 'topk'`
- `tests/isolation/cross-entrypoint-imports.test.ts` — existing isolation test pattern to extend for `no-content-script-ui.test.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `entrypoints/content.core.ts`: existing content script shell with SPA navigation detection via MutationObserver + `wxt:locationchange` event — extend with DomSerializer + RuntimeEnvelope migration, don't duplicate
- `src/core/runtime/RuntimeEnvelope.ts`: `createEnvelope()`, `isEnvelope()`, `MessageTypeValues` (already includes `EXTRACT_PAGE_CONTENT` and `SPA_NAVIGATION`) — use directly in content script
- `src/core/messaging/MessageBus.ts`: `register()`, `init()`, `dispatch()` — register `EXTRACT_PAGE_CONTENT` handler, init in all extension-page contexts
- `src/core/context/TokenBudget.ts`: Phase 4 token estimation (CJK-aware) — ContextOptimizer uses for per-tier page budget, not PageContentService
- `src/core/context/ContextProvenanceManifest.ts`: `markCompression`/recordSection APIs — reuse for `topk` provenance marking
- `tests/isolation/cross-entrypoint-imports.test.ts`: pattern for the new `no-content-script-ui.test.ts` import-graph checks

### Established Patterns
- Content scripts are extraction-only: `content.core.ts` has no React/AntD and only sends structured messages (currently raw, migrating to RuntimeEnvelope)
- Shared core modules live in `src/core/` with per-domain subfolders (`ai/`, `context/`, `storage/`, `runtime/`, `messaging/` → new `extraction/` and `content/`)
- Zod schemas at module boundaries (Phase 3/4 pattern: PlannerDecisionSchema, ContextOptimizerInput validation)
- Discriminated unions for result types (PlannerDecision, ExtractionResult, PageContext)
- TDD with vitest, `tests/core/` mirror of `src/core/`
- Cross-context messaging via RuntimeEnvelope + MessageBus (established Phase 1–4 pattern)

### Integration Points
- `ContextOptimizerInput.pageContext` (optional field, Phase 4) — extraction results feed here; ContextOptimizer owns the page-content budget via TokenBudget
- `AgentOrchestrator.runTurn(AgentTurnInput)` — page context flows into the optimization pipeline
- `MessageBus` messaging — `EXTRACT_PAGE_CONTENT` request/response + `SPA_NAVIGATION` outbound events via RuntimeEnvelope
- Diagnostics (Phase 6) consumes per-extraction metrics (duration, node/char count, source, truncation, error codes, strategiesAttempted)
- Future MCP tools (Phase 8) — `get-page-content` tool calls `PageContentService.extract()` or `reExtract()`

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond spec and discussion decisions — the PRODUCT_SPEC §26 is detailed and locks the architecture. Standard approaches per decisions above.

User explicitly requested:
- Full RuntimeEnvelope migration (not partial) for type safety and long-term maintainability
- Keep content script minimal — removal of dead CONTENT_SCRIPT_READY message
- Budget policy stays in ContextOptimizer, not in extraction layer

</specifics>

<deferred>
## Deferred Ideas

- **v2 host-page automation** (click/type/navigate via chrome.debugger + CDP Input) — spec §26.7: explicitly deferred; APCLiteNode schema is already automation-ready, a v2 addendum spec must be ratified first
- **ServiceNow Table-API-first extraction** — belongs to the ServiceNow add-on (Phase 8); this phase only reserves the strategy slot
- **site-specific extraction strategies** (google/llm-sidebar-with-context pattern) — model for future add-on `IContextExtractor` (spec §26.8)

</deferred>

---

*Phase: 4a-PageContentExtraction*
*Context gathered: 2026-07-31*
