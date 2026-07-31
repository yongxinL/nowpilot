# Phase 4a: Page Content Extraction - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

PageContentService — core layered page extraction. Users extract page content via a layered strategy (Defuddle primary → Readability fallback for read/summarize; APC-lite DOM+ARIA walk for actionable structure), indexed in an ephemeral per-tab MiniSearch index. Content script stays extraction-only (<50KB, no React/AntD/defuddle/yaml/FS Access) — it serializes HTML only; Defuddle parsing runs in the side panel / full app. SPA-nav (wxt:locationchange) + tabs.onUpdated invalidate the per-tab cache. Password field values never captured. Extracted content feeds `ContextOptimizerInput.pageContext` (Phase 4 contract, D-05/D-18 sourceId `context.page.current-url`).

</domain>

<decisions>
## Implementation Decisions

### Content Capture (content script)
- **D-01:** Content script captures full `document.documentElement.outerHTML` (size-capped ~2MB) with password-field value redaction at capture time via AxDomWalker — no extraction heuristics in the content bundle. Full-document serialization is simpler and more robust than subtree targeting, and keeps the content bundle minimal. — **Reversibility:** reversible — switching to subtree capture is local to AxDomWalker.
- **D-02:** `AxDomWalker` (in `src/core/content/`) is the content-script-safe serializer: walks DOM, omits `value` for password fields (`input[type=password]`, `isPassword` attribute, `autocomplete=current-password` heuristic), never logs or transmits captured text — **Reversibility:** one-way — redaction correctness is a privacy contract; relaxing it later would require re-auditing captured data.

### Execution Context (where parsing runs)
- **D-03:** Defuddle/Readability/APC-lite parsing runs in the side panel / full app (extension page contexts with DOMParser), NOT in the service worker and NOT in the content bundle (spec §26.4). Strategies accept an HTML string and construct their own `DOMParser` document. The requesting surface (Side Panel / Full App) invokes `PageContentService.extract()` and owns the result. — **Reversibility:** costly — moving parsing to another context (e.g. offscreen document) would touch messaging, caching, and tests.
- **D-04:** `PageContextBridge` (in `src/core/content/`) routes `EXTRACT_PAGE_CONTENT` requests via the existing RuntimeEnvelope pattern — content script responds with serialized HTML + metadata (url, title, capturedAt, size); core responds with PageContext. SPA navigation events flow through the same bridge for cache invalidation. — **Reversibility:** costly — RuntimeEnvelope is the established cross-context contract from Phase 1; replacing the bridge changes every consumer.

### Layered Strategy
- **D-05:** `DefuddleStrategy` is PRIMARY for mode `default` (read/summarize). Fallback to Readability when Defuddle yields low-confidence output: no content / content < ~500 chars / parse exception / >5s timeout. The source used (`defuddle` vs `readability`) is recorded in the extraction result and surfaces in provenance (`compressionApplied`/source metadata). — **Reversibility:** reversible — fallback thresholds are strategy-local constants.
- **D-06:** `ApcLiteStrategy` runs for mode `actionable` — builds an `APCLiteNode` tree per Appendix C (Zod-validated via `apcLite.types.ts`): roles, geometry, interaction info, node ids. Same DOMParser-in-extension-page execution model. Readiness for v2 automation is preserved in the schema (§26.7) — no automation in v0.1. — **Reversibility:** one-way — the APCLiteNode schema is the automation substrate; changing it later would orphan v2 consumers (spec §26.7).
- **D-07:** Strategy contract per spec §26.3: `IExtractionStrategy` with `id`, `canHandle({url, mode})`, `run(input) → StrategyResult` (markdown and/or APCLiteNode tree). ServiceNow Table-API first path belongs to the ServiceNow add-on (Phase 8), not this phase — `canHandle` returns false for it here.

### Page Index (MiniSearch)
- **D-08:** `PageIndexBuilder` creates one **ephemeral** per-tab MiniSearch instance over extracted content — Defuddle markdown chunked by heading (h1–h3 with hierarchical paths), or APC-lite text nodes for actionable mode. Never persisted to IndexedDB (spec §26.5). — **Reversibility:** one-way — persistent vs ephemeral is a privacy boundary; persisting later would need a migration + user consent.
- **D-09:** When extracted tokens exceed the 2,000-token webpage budget (§22.2), inject only `selectRelevant(query)` results and mark `compressionApplied: 'topk'` in the provenance manifest; minimal mode always routes through `selectRelevant`. Token counting uses the Phase 4 `TokenBudget` service (CJK-aware character estimation).

### Cache & Invalidation
- **D-10:** `PageContentCache` is a per-tab in-memory Map (tabId → {url, result, indexedAt}). Invalidation: URL change via SPANavigationWatcher (`wxt:locationchange`) and `tabs.onUpdated` (status complete + URL diff). Re-extraction is **lazy** — next request to the tab triggers fresh extraction, never eager background extraction. — **Reversibility:** reversible — invalidation policy is cache-local.
- **D-11:** Concurrency guard: duplicate extractions per tab coalesce into a single in-flight promise; hard 5s timeout per extraction (spec §26.6); on failure fall back (Defuddle→Readability, AX→DOM) and record the source.

### Redaction & Privacy
- **D-12:** TraceRedactor-style redaction runs before indexing or logging (§4.4/§16): API keys, bearer tokens, emails in extracted text. Password values never captured at source (D-02). Metrics recorded per extraction (duration, node/char count, source, truncation) feed Phase 6 Diagnostics — no content payloads in metrics.

### Bundle & Isolation Enforcement
- **D-13:** Content bundle must contain no React, AntD, defuddle, yaml, or FS Access API usage and stay < 50KB. Enforced by `tests/isolation/no-content-script-ui.test.ts` (import-graph isolation test) + a bundle-size assertion in the phase verification script (`pnpm run verify:phase-4a`). — **Reversibility:** one-way — the <50KB extraction-only cap is a product constraint (§5.6, §22.1); violating it silently breaks the isolation contract.

### the agent's Discretion
- Exact heading-chunking limits, Readability fallback thresholds, and capture size caps are implementation constants — planner may tune within the decision bounds above.

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
- Phase 4 context `.planning/phases/04-context-optimization-pipeline/04-CONTEXT.md` — D-05 (`pageContext` optional field feeding ContextOptimizerInput), D-18 (sourceId `context.page.current-url`)
- Phase 3 context `.planning/phases/03-ai-core-pipeline/03-CONTEXT.md` — D-10 (serializable PipelineError), D-12 (PlannerContext extension interfaces superseded by Phase 4 AgentTurnInput)
- `.planning/PRODUCT_SPEC_v0_1.md` §4.5 — Diagnostics metrics contract (duration, node/char count, source, truncation)

### Codebase
- `entrypoints/content.core.ts` — existing extraction-only content script with SPA navigation detection (MutationObserver → `SPA_NAVIGATION` message); Phase 4a replaces/extends this with the full content host
- `src/core/events/RuntimeEnvelope.ts` (or equivalent in `src/core/events/`) — established cross-context messaging contract (Phase 1)
- `src/core/context/TokenBudget.ts` — Phase 4 CJK-aware token estimation for budget enforcement
- `src/core/context/ContextProvenanceManifest.ts` — provenance recording for `compressionApplied: 'topk'`
- `tests/isolation/cross-entrypoint-imports.test.ts` — existing isolation test pattern to extend for no-content-script-ui

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `entrypoints/content.core.ts`: existing content script shell with SPA navigation detection — extend, don't duplicate; extraction-only comment contract already in place
- `src/core/events/` RuntimeEnvelope: cross-context messaging pattern from Phase 1 (used by background/content/sidepanel messaging)
- `src/core/context/TokenBudget.ts`: Phase 4 token estimation (CJK-aware) — reuse for the 2,000-token page budget enforcement
- `src/core/context/ContextProvenanceManifest.ts`: `markCompression`/recordSection APIs — reuse for `topk` provenance marking
- `tests/isolation/cross-entrypoint-imports.test.ts`: pattern for the new `no-content-script-ui.test.ts` import-graph checks

### Established Patterns
- Content scripts are extraction-only: `content.core.ts` has no React/AntD and only sends structured messages
- Shared core modules live in `src/core/` with per-domain subfolders (`ai/`, `context/`, `storage/` → new `extraction/` and `content/`)
- Zod schemas at module boundaries (Phase 4 pattern: `ContextOptimizerInput` validation)
- TDD with vitest, `tests/core/` mirror of `src/core/`

### Integration Points
- `ContextOptimizerInput.pageContext` (optional field, Phase 4) — extraction results feed here
- `AgentOrchestrator.runTurn(AgentTurnInput)` — page context flows into the optimization pipeline
- RuntimeEnvelope messaging — `EXTRACT_PAGE_CONTENT` request/response + `SPA_NAVIGATION` events
- Diagnostics (Phase 6) consumes per-extraction metrics (duration, node/char count, source, truncation)

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the spec — the PRODUCT_SPEC §26 is unusually detailed and locks the architecture. Standard approaches per decisions above.

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
