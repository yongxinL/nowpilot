# Phase 6: PageContentService (Knowledge Acquisition) - Context

**Gathered:** 2026-08-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 delivers the **PageContentService** — the single panel-side owner of layered page extraction (Defuddle → Readability fallback; APC-lite structural walk) that every later surface (Chat, Agent, Summarize, /research, add-ons) consumes. The content script stays an **extraction-only, <50 KB** bundle (serialize pre-stripped HTML + stamp base URL; never parse, never render). An ephemeral **per-tab MiniSearch index** (`PageIndexBuilder`) powers retrieval-augmented context. This is an **infrastructure phase — no spec-native v1 requirement IDs land here** (CTX-01…06 are Phase 7).

**Scope is per spec §18 Phase 6.** Create exactly (verbatim §18):

```
src/core/extraction/PageContentService.ts           # orchestrator (core)
src/core/extraction/apcLite.types.ts                # RawNode / APCLiteNode / APCLiteDocument (+ Zod) → Appendix C
src/core/extraction/strategies/IExtractionStrategy.ts
src/core/extraction/strategies/DefuddleStrategy.ts   # PRIMARY: main content → markdown (Defuddle)
src/core/extraction/strategies/ApcLiteStrategy.ts    # structural/actionable DOM+ARIA walk
src/core/extraction/PageContentSerializer.ts         # tree → markdown / PageContext
src/core/extraction/PageIndexBuilder.ts              # ephemeral MiniSearch index over extracted content
src/core/extraction/PageContentCache.ts              # per-tab cache + navigation invalidation
src/core/content/AxDomWalker.ts                      # content-script safe DOM+ARIA walker (no React/AntD)
src/core/content/PageContextBridge.ts                # RuntimeEnvelope bridge (EXTRACT_PAGE_CONTENT)
src/core/content/{ContentScriptHost, SPANavigationWatcher}.ts   # extraction-only shells
```

Required tests (verbatim §18):

```
tests/core/extraction/PageContentService.test.ts
tests/core/extraction/DefuddleStrategy.test.ts
tests/core/extraction/ApcLiteStrategy.test.ts
tests/core/extraction/PageIndexBuilder.test.ts
tests/isolation/no-content-script-ui.test.ts        # verifies no React/AntD/defuddle/yaml in content bundle
```

**DONE-when (verbatim §18 + ROADMAP):** Defuddle runs in the side panel/standalone (not the content bundle); content script only serializes HTML; content-script bundle has no React/AntD/defuddle/yaml and stays <50 KB; layered fallback (Defuddle→Readability, AX→DOM) records the source used; PageIndexBuilder builds an ephemeral per-tab MiniSearch index (never persisted); SPA-nav (`wxt:locationchange`) + `tabs.onUpdated` invalidation works; passwords never captured (isPassword ⇒ value omitted). Gate: `pnpm run verify:phase-6`.

**Out of scope (verified in spec §18 / PROJECT.md / REQUIREMENTS.md):** trust metadata / context receipts / CTX-01…06 (Phase 7 — the manifest becomes the context receipt there), live wiring of pageContext into ContextOptimizer.assemble (Phase 7 — Phase 6 produces the PageContext that feeds `ContextOptimizerInput.pageContext`), memory retrieval (Phase 8), the `get-page-content` tool **registration** (tool manifests are Phase 18 TOL; surface UI triggers are Phase 15), ServiceNow Table-API strategy (Phase 17 — Phase 6 only **reserves** the `servicenow-api` id and ordering), browser automation / APCLiteNode geometry (v2, §26.7 / MM-07), diagnostics surfacing of extraction metrics (Phase 11), PageContentService consumers (add-ons, /research — Phase 17).

**Research-driven notes:** ADR-P6-01 is **Proposed** with `SPIKE-P6-01` pending "at Phase 6 start" — the spike (panel-side Detached-doc Defuddle fidelity) runs within Phase 6 and flips the ADR to Accepted (see D-79). Phase 1 (D-15) already declared the extraction RuntimeEnvelope types (`EXTRACT_PAGE_CONTENT`, `PAGE_LIVE_CONTEXT`, `PAGE_EXTRACTION_REQUESTED`, `PAGE_HTML_PAYLOAD`) and the frozen `PageHtmlPayload` shape with the instruction "do not register a handler until the Phase 6 spike lands" — Phase 6 wires the producer + consumer (D-84). The `verify:phase-6` gate currently mis-points at `tests/core/telemetry tests/components/DiagnosticsSection.test.tsx` (Phase 11 territory) and must be re-pointed — exact Phase-4/5 D-68/D-78 precedent (D-92).

</domain>

<decisions>
## Implementation Decisions

### Strategy placement + spike
- **D-79 (SPIKE-P6-01 runs in Phase 6 research; ADR-P6-01 flips to Accepted on acceptable fidelity):** ADR-P6-01 is `Proposed (spike pending at Phase 6 start)`. The Phase-6 researcher/planner runs the spike during planning research: capture ServiceNow-portal + KB-article HTML, run `defuddle/full` `parse({ markdown:true, url, useAsync:false })` on a detached `DOMParser` doc with `<base href>` injected, compare fidelity against a live-DOM baseline. **Default expectation: detached-doc fidelity is acceptable** (Defuddle's needs are met by DOM structure + base-href; it does not need computed style for the main-content path) → flip ADR-P6-01 Status to **Accepted**, no measurement pass. **Only if the spike finds a material computed-style/layout dependency** → add a **thin content-script measurement pass** (reads only the required layout signals; still no parsing; still <50 KB) and message them panel-side. Placement is NOT re-litigated — Defuddle stays panel-side per the ADR; the spike decides only the measurement-pass question. — **Reversibility:** `reversible` — rationale: ADR status flip + optional additive content-script pass; the panel-side placement is fixed by the ADR and §26.4.
- **D-80 (Phase 6 builds strategies 2 and 3 only — Readability is Defuddle's internal fallback, `servicenow-api` is reserved):** Per §26.2 + the Appendix "two enums" note (spec 4688-4693): implement `DefuddleStrategy` (mode `'default'`/read) and `ApcLiteStrategy` (mode `'actionable'`). **Readability is NOT a separate strategy/file** — it is DefuddleStrategy's internal low-confidence fallback and appears only as `StrategyResult.source: 'readability'` (result provenance). `IExtractionStrategy.id` enumerates installed strategies only (`'defuddle' | 'apc-lite'`); `'servicenow-api'` stays in the `StrategyResult.source` union + reserved ordering but is NOT registered in Phase 6 — Phase 17 registers it. Do NOT create a `ReadabilityStrategy` or ServiceNow strategy file. — **Reversibility:** `reversible` — rationale: registration/strategy table; Phase 17 adds a row.

### Create-only discipline + integration
- **D-81 (Create-only extraction layer — D-69 analog; no pipeline wiring):** §18 lists the extraction/content files + required tests and no AgentOrchestrator/chat/UI modification. Phase 6 ships `PageContentService` + strategies + cache + index + content-script shells proven by the §18 required tests. It is NOT wired into the live chat/agent pipeline this phase: no `get-page-content` tool registration (TOL-01 tool manifests are Phase 18), no surface UI triggers (Phase 15), no ContextOptimizer.assemble adoption (Phase 7). Extraction runs only when a surface requests it (§26.4a) — in Phase 6 that request path is exercised via PageContextBridge + tests, not a shipped surface call-site. — **Reversibility:** `reversible` — rationale: additive modules; wiring later is a caller edit.
- **D-82 (PageContentService produces the `PageContext` shape that feeds `ContextOptimizerInput.pageContext`):** Phase 6's output contract is the Appendix C `PageContext` (spec 4345-4357: url/origin/hostname/title/html?/markdown?/meta/extractedAt/addonId?/addonFields?). Phase 5's ContextOptimizer already declares `input.pageContext?: PageContext` — Phase 6 supplies the producer; the live `assemble()` adoption of pageContext is Phase 7 (trust-aware context). Phase 6 tests prove `extract()` → `PageContext` end-to-end via fixtures (pre-stripped HTML + stamped baseUrl). — **Reversibility:** `reversible` — rationale: producer module; consumer wiring later.

### PageContext supersession point
- **D-83 (PageContext supersession resolved — `src/core/content/PageContext.ts` is canonical):** The Phase-5 placeholder in `src/core/context/types.ts` (lines 7, 17-29) is explicitly marked as the "Phase 6 replaces in place at src/core/content/PageContext.ts (spec 4345)" supersession point. Phase 6 creates `src/core/content/PageContext.ts` holding `PageContext`, `TabContext`, `SNowCaseData`, `FileContext`, `NoteContext` verbatim from spec 4345-4391, and updates `src/core/context/types.ts` to **re-export/import from it** (D-72 re-export precedent) so `ContextOptimizer`'s `import type { PageContext } from './types'` keeps resolving. No parallel copy. — **Reversibility:** `reversible` — rationale: re-export; moving the canonical type later is an import edit.

### Envelope wiring (D-15 declared types)
- **D-84 (Phase-1 extraction envelope types wired — producer + consumer, BackgroundRouter stays stateless):** Phase 1 (D-15) declared `EXTRACT_PAGE_CONTENT`, `PAGE_LIVE_CONTEXT`, `PAGE_EXTRACTION_REQUESTED`, `PAGE_HTML_PAYLOAD` and the frozen `PageHtmlPayload` shape (`html`/`baseUrl`/`truncated`/`strategyId?`) in `src/core/runtime/RuntimeEnvelope.ts`, explicitly deferring handler registration until the Phase 6 spike lands. Phase 6 wires: the **producer** (content script serializer sends `PAGE_HTML_PAYLOAD`), the **consumer** (`PageContextBridge` + `PageContentService` receive/parse it), and `EXTRACT_PAGE_CONTENT` handling in PageContextBridge. The extraction round-trip flows **content-script → surface** (side panel/standalone) directly; `BackgroundRouter` stays stateless (no AI/IndexedDB in background per §5.1). `SPA_NAVIGATION`/`CONTENT_SCRIPT_READY` scaffold types stay as-is and now feed cache invalidation. — **Reversibility:** `reversible` — rationale: producer+consumer wiring; later surface call-sites are additional senders.

### Content script evolution
- **D-85 (core.content.ts stays thin; logic moves to `src/core/content/` shells):** `entrypoints/content/core.content.ts` keeps its WXT `defineContentScript` shell + `wxt:locationchange`/SPA-nav listener but delegates serialization + round-trip to the new `src/core/content/` modules (`ContentScriptHost`, `SPANavigationWatcher`, `PageContextBridge`, `AxDomWalker`). Serializer: serialize a **pre-stripped clone** of `document.documentElement` (remove `script`/`style`/`noscript`/`svg`/cross-origin `iframe` markup + `form action` attributes; **keep** text, headings, links, input controls), stamp the **effective base URL** into the payload, apply `PAGE_HTML_MAX_BYTES` (2 MB) hard cap, truncate at an element boundary + `truncated:true` if over. No multi-envelope chunking in v0.1 (§26.6). Content bundle stays free of React/AntD/defuddle/yaml/mathml-to-latex/temml/turndown (isolation grep §24 rev 2026-08-12). — **Reversibility:** `reversible` — rationale: additive content modules; entry file delegation is a thin edit.
- **D-86 (AxDomWalker content-side, minimal structural walk, runs only on actionable mode):** AxDomWalker produces `RawNode` **content-script-side** (ISOLATED world) — roles + text + hierarchy + interaction flags + links + tables; `geometry?` stays **unset** (v0.1, §26.6 — if ever populated it must be read content-side against live layout, never in the panel's detached doc). It runs **only on a `mode:'actionable'` request** (zero AX cost on the default read/summarize path). Password values are omitted at capture (FormControlSchema.refine). `ApcLiteStrategy` (panel-side) normalizes `RawNode` → `APCLiteNode` and validates with `APCLiteDocumentSchema`. — **Reversibility:** `reversible` — rationale: walker + normalizer split; adding fields later is type additive.

### MiniSearch + index ownership
- **D-87 (Install `minisearch ^7`; PageIndexBuilder owns the ephemeral page index; Phase-8 notes wrapper NOT created):** Add `minisearch ^7` to dependencies. `PageIndexBuilder` (§26.5) builds a **lazy, memoized, per-tab** MiniSearch index over extracted markdown: chunked **by heading** (h1–h6) with fields `title`/`url`/`headingPath` (breadcrumb)/`sectionText` + index-wide `tabId`; content before the first heading → synthetic `"(preamble)"` chunk; no-heading pages → paragraph-block chunks; oversized sections (> `INDEX_CHUNK_MAX_TOKENS` = 500) split into paragraph sub-chunks inheriting the same `headingPath`. Never persisted; built on first `query()`; evicted together with the extraction (§26.4a). When extracted tokens exceed the 2,000-token webpage budget (§22.2), expose `selectRelevant(query)` and record `compressionApplied: 'topk'` in the provenance manifest (§2.6 — the manifest is Phase 5's; the phase-7 receipt consumes it). Phase 6 does **NOT** create `src/core/search/MiniSearchIndex.ts` — the persistent notes-index wrapper is Phase 8. — **Reversibility:** `reversible` — rationale: additive index module; Phase 8's wrapper is separate.

### Extraction lifecycle + cache
- **D-88 (PageContentCache implements §26.4a lifecycle verbatim; subscription API declared, surface wiring deferred):** `PageContentCache`: keyed by `tabId` (**separate** from the Phase-1 `PageRegistry` — that registers surface pages, not page content); invalidate + evict on `wxt:locationchange` + `tabs.onUpdated`; evict on `tabs.onRemoved`; bounded LRU cap `PAGE_CACHE_MAX_TABS` = 20 with access-recency bumping; never LRU-evict an in-flight or subscribed tab; pinned tabs eviction-last; extraction and its index are **always evicted together** (never orphan an index). Coalesce concurrent extractions per tab (dedup on the in-flight promise keyed by tabId); a read after invalidation but before re-extract completes awaits the in-flight extraction, never a stale entry. Cache is ephemeral — never persisted to IndexedDB. The **subscription model** (subscribed = surface active on tab OR pinned via `WorkspaceState.pinnedTabs`) is declared as an API (`subscribe`/`unsubscribe`/`markStale`); the actual surface call-sites that subscribe arrive with their owning phases (Phase 7/15). — **Reversibility:** `reversible` — rationale: additive module + API; caller wiring later.
- **D-89 (On-demand + subscription-gated auto re-extract; lightweight live context always):** Per §26.4a: **lightweight live context** (title/url/meta) updates always on navigation (`PAGE_LIVE_CONTEXT` — the tiny content-bridge payload); **full extraction** (Defuddle → Readability → APC-lite) runs only when a surface requests it (`EXTRACT_PAGE_CONTENT`/`PAGE_EXTRACTION_REQUESTED`); **auto re-extract** after `wxt:locationchange` or `tabs.onUpdated` fires **only for subscribed tabs** — unsubscribed tabs are mark-stale only. Phase 6 implements the trigger model + stale-marking in `PageContentCache`; requests arrive through `PageContextBridge`. — **Reversibility:** `reversible` — rationale: lifecycle logic in cache module; surface senders later.

### Privacy, timeout, errors
- **D-90 (Redaction panel-side via TraceRedactor; content script only strips markup + omits passwords):** `TraceRedactor` runs **panel-side**, over the extracted markdown/tree, **before** indexing or logging (§26.6, §4.4, §16). The content script performs **no** redaction — it only strips markup and **omits password values at capture** (`isPassword ⇒ value omitted`, enforced via `FormControlSchema.refine` in the AxDomWalker). Passwords are never captured. — **Reversibility:** `reversible` — rationale: seam + enforcement point; both already declared (TraceRedactor ships Phase 1, FormControlSchema in Appendix C).
- **D-91 (5 s AbortController timeout + typed `CONTENT_EXTRACT_FAILED` — never a silent empty result):** `PAGE_EXTRACTION_TIMEOUT_MS` = 5_000 threaded through the round-trip via a **single** `AbortController` (§26.6/§13). On failure: fallback (Defuddle→Readability, AX→DOM), **record source**, then surface the typed error `CONTENT_EXTRACT_FAILED` (Appendix C.2 closed set — **no invented codes**, D-38/§21.6). Never a silent empty result. Metrics (duration, node/char count, source, truncation) are recorded panel-side → surfaced by Diagnostics in Phase 11. — **Reversibility:** `reversible` — rationale: typed result + closed error code; surfacing later is additive.

### Verification gate
- **D-92 (Re-point `verify:phase-6` to the §18 required test dirs + isolation grep — D-68/D-78 analog):** The `package.json` `verify:phase-6` script currently targets `tests/core/telemetry tests/components/DiagnosticsSection.test.tsx` (Phase 11 territory). Phase 6 re-points it to the §18 required tests: `tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts` (PageContentService/DefuddleStrategy/ApcLiteStrategy/PageIndexBuilder + the new isolation test). The new `tests/isolation/no-content-script-ui.test.ts` greps the **built content-script bundle** and rejects React/AntD/defuddle/yaml/mathml-to-latex/temml/turndown + File System Access API usage (per §24 rev 2026-08-12; extend the existing `cross-entrypoint-imports.test.ts` grep style, non-vacuous with self-test). **Reconcile `verify:phase-4a`** which currently points at the same Phase-6 dirs — it is a stale placeholder; Phase 6 owns these dirs (delete/re-point `phase-4a`). — **Reversibility:** `reversible` — rationale: package.json script edit.

### the agent's Discretion
- Exact Defuddle detached-doc spike harness (how the ServiceNow sample corpus is captured as test fixtures; fidelity metric — e.g., wordCount delta + relative-link resolution correctness vs live-DOM baseline).
- Whether `PageContentService` exposes a per-surface singleton (mirroring the per-surface module-singleton pattern) or a factory — either satisfies the consumer contract.
- `src/core/extraction/` layout: one file per §18 name vs a barrel `index.ts` — mirror the `src/core/ai/` layout convention.
- `PageIndexBuilder` internals: import `minisearch` directly vs a thin internal wrapper (Phase 8's `src/core/search/MiniSearchIndex.ts` may adopt the wrapper later).
- Whether the redaction call-site sits inside `PageContentService` or the `PageContentCache` write path (before indexing/logging per D-90).
- DefuddleStrategy low-confidence heuristic exact threshold for the Readability fallback (e.g., empty markdown, near-zero wordCount, or missing title).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec / scoping
- `.planning/PRODUCT_SPEC_v0_1.md` §18 (Phase 6 block, lines 2608-2644 — Create list, Required tests, DONE-when) — sole authority on the Phase-6 file inventory and gates. No Requirements line — Phase 6 is infra (no v1 requirement IDs; `servicenow-api` id reserved, not registered).
- `.planning/PRODUCT_SPEC_v0_1.md` §26.1-26.8 (lines 3672-3794) — the whole PageContentService chapter: principle, layered strategy (26.2), strategy contract (26.3), content-bundle constraint (26.4), extraction trigger & cache lifecycle (26.4a, **normative**), MiniSearch integration (26.5), reliability & privacy (26.6), automation deferral (26.7).
- `.planning/PRODUCT_SPEC_v0_1.md` §26.4 (lines 3718-3742) — canonical Defuddle call shape (`defuddle/full`, `{ markdown:true, url, useAsync:false }`, synchronous `parse()`, base-href injection; `useAsync:false` is privacy-critical).
- `.planning/PRODUCT_SPEC_v0_1.md` §26.4a (lines 3744-3761) — trigger model (on-demand + subscription-gated auto re-extract), PageContentCache LRU/invalidation/eviction/coalescing rules (drives D-88/D-89).
- `.planning/PRODUCT_SPEC_v0_1.md` §26.5 (lines 3763-3774) — heading-chunked ephemeral MiniSearch index, preamble/paragraph/oversized-section rules, 2,000-token budget → selectRelevant + `compressionApplied:'topk'` (drives D-87).
- `.planning/PRODUCT_SPEC_v0_1.md` §26.6 (lines 3776-3786) — pre-stripped clone serialization, 2 MB cap, APC-lite minimal walk (geometry omitted), 5 s timeout, panel-side TraceRedactor, password omission, metrics (drives D-85/D-86/D-90/D-91).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C extraction types (lines 4344-4448) — `PageContext`/`TabContext`/`SNowCaseData`/`FileContext`/`NoteContext` verbatim (D-83) and `RawNode`/`APCLiteNode`/`APCLiteDocument` + Zod schemas verbatim (D-86).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix extraction contract (lines 4658-4699) — `IContextExtractor`/`IExtractionStrategy`/`StrategyInput`/`StrategyResult` verbatim + the **"two enums" note (4688-4693, read before implementing)** + tunables `PAGE_CACHE_MAX_TABS`/`PAGE_HTML_MAX_BYTES`/`INDEX_CHUNK_MAX_TOKENS`/`PAGE_EXTRACTION_TIMEOUT_MS`.
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.2 (lines 3420-3433) — closed error-code set; `CONTENT_EXTRACT_FAILED` is the typed error (no invented codes, D-38).
- `.planning/PRODUCT_SPEC_v0_1.md` §24 / Appendix G (line 3631) — isolation-grep rev 2026-08-12: content bundle must reject `antd`/`React`/`react-dom`/`defuddle`/`yaml`/`mathml-to-latex`/`temml`/`turndown` + File System Access API (drives the no-content-script-ui test).
- `.planning/PRODUCT_SPEC_v0_1.md` §22.1/§22.2 (lines 3471-3504) — 50 KB content-bundle target + per-source token budgets (Webpage 2,000) that PageIndexBuilder's selectRelevant respects.
- `.planning/PRODUCT_SPEC_v0_1.md` §18 Phase 8 (lines 2656-2696) — confirms `src/core/search/MiniSearchIndex.ts` (persistent notes wrapper) is Phase 8, not Phase 6 (D-87).
- `.planning/PRODUCT_SPEC_v0_1.md` §2.3 (lines 463-489) — `ContextOptimizerInput.pageContext?: PageContext` (the Phase-6 output consumer contract; live wiring is Phase 7).
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 / §5.2 — MV3 boundaries: extraction/AI run in UI contexts; content script is extraction-only, ISOLATED world.

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 6: PageContentService (Knowledge Acquisition)" (lines 191-205) — goal, depends-on (Phase 5), success criteria, verification gate, SPIKE-P6-01 → ADR-P6-01 note.
- `.planning/adr/ADR-P6-01-defuddle-panel-side.md` — Defuddle panel-side placement (fixed) + SPIKE-P6-01 spike directive (runs at Phase 6 start; flips ADR to Accepted; D-79).
- `.planning/REQUIREMENTS.md` — Phase 6 has zero v1 requirements (phase table: "Phase 6 | 0 | Infrastructure"); CTX-01…06 are Phase 7.
- `.planning/phases/05-context-adaptive-execution/05-CONTEXT.md` — D-69 create-only precedent (D-81 follows), D-72 re-export precedent (D-83 follows), D-78 gate re-pointing precedent (D-92 follows verbatim), and the explicit "page/case content as `ContextOptimizerInput.pageContext` — Phase 6 (PageContentService) produces it" handoff note.
- `.planning/phases/04-agent-reliability-and-evidence/04-CONTEXT.md` — D-68 gate re-pointing precedent (D-92 follows verbatim).
- `.planning/STATE.md` — decision 12 (ADR-P6-01 Proposed, spike pending), decision 17 (strict ceiling → new code strict-clean, zero NP-STRICT markers), watch items VAI-01 (CVE-2026-30830 Defuddle XSS fix — confirm at Phase 6 install) and VAI-04 (re-query npm versions at each phase install).

### Source (integration targets — the Phase-6 consumer/producer contracts)
- `src/core/context/types.ts` (lines 1-29) — the Phase-5 PageContext placeholder marked as the Phase-6 supersession point (D-83 replaces it in place via re-export).
- `src/core/runtime/RuntimeEnvelope.ts` (lines 1-45) — D-15 declared `EXTRACT_PAGE_CONTENT`/`PAGE_LIVE_CONTEXT`/`PAGE_EXTRACTION_REQUESTED`/`PAGE_HTML_PAYLOAD` + the frozen `PageHtmlPayload` shape (D-84 wires the producer + consumer).
- `src/core/context/ContextOptimizer.ts` (lines 49, 143, 187, 216, 304-352) — `pageContext` input field + `buildContextText` consumer; the Phase-6 PageContext feeds this in Phase 7.
- `src/core/workspace/WorkspaceStore.ts` (lines 39, 118-129, 188) — `pinnedTabs: TabContext[]` — the subscription signal §26.4a keys on (D-88).
- `entrypoints/content/core.content.ts` — the current thin content-script shell (SPA-nav detection + `CONTENT_SCRIPT_READY`/`SPA_NAVIGATION`); D-85 keeps it thin and delegates to the new shells.
- `src/core/log/TraceRedactor.ts` (or `src/core/log/`) — the panel-side redaction seam D-90 uses.
- `tests/isolation/cross-entrypoint-imports.test.ts` — the existing non-vacuous isolation-grep style the new `no-content-script-ui.test.ts` extends.

### Codebase maps (refreshed 2026-08-18)
- `.planning/codebase/ARCHITECTURE.md` — per-surface module singletons; `src/core/` is UI-framework-agnostic (extraction layer follows); content-script extraction-only boundary.
- `.planning/codebase/STACK.md` — dependency table: minisearch ^7, defuddle ^0.19 (≥ 0.19.2, `defuddle/full`), @mozilla/readability ^0.6, turndown ^7 — versions re-verified via VAI-04 at install.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/runtime/RuntimeEnvelope.ts` — `MessageTypeValues` already carries the four Phase-6 envelope types + the frozen `PageHtmlPayload` interface (`html`/`baseUrl`/`truncated`/`strategyId?`); `createEnvelope` is ready for the producer/consumer wiring (D-84).
- `src/core/context/ContextOptimizer.ts` — `ContextOptimizerInput.pageContext?: PageContext` + `buildContextText` — the Phase-6 PageContext output lands here in Phase 7 (D-82).
- `src/core/workspace/WorkspaceStore.ts` — `pinnedTabs: TabContext[]` (cap 10) — the §26.4a subscription signal for the cache (D-88).
- `src/core/log/` — `TraceRedactor` ships from Phase 1; the panel-side redaction seam D-90 reuses.
- `src/types/` / `src/core/context/types.ts` — the PageContext supersession point (D-83) and the `@/` alias target for `src/core/content/PageContext.ts`.

### Established Patterns
- **Create-only discipline (D-69/D-81)** — §18 inventory + required tests, no pipeline wiring; proven by tests, consumed by later phases.
- **Declare-now/populate-later** — D-15 declared the envelope types in Phase 1; Phase 6 fills the producer/consumer (D-84). D-46/D-64/D-71 precedent for seams.
- **Re-export supersession (D-72/D-83)** — new canonical module + old file re-exports; no parallel copies.
- **Gate re-pointing (D-68/D-78/D-92)** — `verify:phase-N` script edited in package.json to the phase's own test dirs.
- **Non-vacuous isolation greps** — `tests/isolation/cross-entrypoint-imports.test.ts` self-tests its own regex; the new content-bundle grep extends the style.
- **Typed discriminated unions / Zod** — `StrategyResult.source`, `APCLiteDocumentSchema`, and the closed `CONTENT_EXTRACT_FAILED` code follow the established schema-first pattern.
- **Per-surface module singletons** — PageContentService instantiates per surface (side panel / standalone), never in the background SW.

### Integration Points
- Content script serializer (`ContentScriptHost`/`PageContextBridge`) → `PAGE_HTML_PAYLOAD` → panel `PageContentService` → `PageContext` → (Phase 7) `ContextOptimizer.assemble`.
- `PageContextBridge` handles `EXTRACT_PAGE_CONTENT` (surface request) + `SPA_NAVIGATION`/`tabs.onUpdated` → `PageContentCache` invalidation (D-84/D-88).
- `PageIndexBuilder` index → `selectRelevant(query)` → the 2,000-token budget + `compressionApplied:'topk'` provenance manifest entry (§26.5; manifest is Phase 5's, receipt is Phase 7's).
- `WorkspaceStore.pinnedTabs` → subscription-gated auto re-extract (D-89; caller wiring later).
- `verify:phase-6` script in package.json → re-point to `tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts` + reconcile `verify:phase-4a` (D-92).

</code_context>

<specifics>
## Specific Ideas

- **"Never a silent empty result"** is a spine guarantee — the 5 s AbortController + fallback chain (Defuddle→Readability, AX→DOM) records source and surfaces typed `CONTENT_EXTRACT_FAILED`; never an empty `PageContext` passed downstream (§26.6 / D-91).
- **Extraction is on-demand, not proactive** — NowPilot never extracts every page; full extraction fires only on a surface request, lightweight live context always on navigation (§26.4a / D-89).
- **Panel-side Defuddle, content-side serialization** — the content bundle serializes a pre-stripped clone + base URL (≤2 MB, truncate+flag) and does no parsing; Defuddle/Readability run in the side panel/standalone on a detached doc with `<base href>` injected (§26.4 / ADR-P6-01 / D-79).
- **Passwords never captured** — enforced at capture in the content-script AxDomWalker via `FormControlSchema.refine`; the panel-side TraceRedactor then redacts before indexing/logging (§26.6 / D-90).
- **Two strategies only** — DefuddleStrategy + ApcLiteStrategy; Readability is Defuddle's internal fallback (provenance only), `servicenow-api` is reserved for Phase 17 (D-80).
- **NP-STRICT ceiling → 0** — new Phase-6 code must be strict-clean; zero new `@ts-expect-error NP-STRICT` markers (STATE.md decision 17).
- **No invented requirement IDs** — Phase 6 is infra; do not mint pseudo-requirement IDs to force requirement-table rows.

</specifics>

<deferred>
## Deferred Ideas

- **Live `get-page-content` tool registration** — Phase 18 (TOL-01 tool manifests); Phase 6 ships the service, not the tool.
- **Surface UI extraction triggers** (pin / quick-action / chat / summarize) — Phase 15 (RICH-I-05 etc.); the subscription API is declared in Phase 6 (D-88/D-89).
- **Trust metadata + context receipts (CTX-01…06)** — Phase 7: `PageContext` gains trust/authority metadata and the manifest becomes the context receipt.
- **Live `pageContext` → `ContextOptimizer.assemble` wiring** — Phase 7 (trust-aware context consumes the Phase-6 output).
- **Persistent notes MiniSearch wrapper** (`src/core/search/MiniSearchIndex.ts`) — Phase 8; Phase 6 builds only the ephemeral page index (D-87).
- **ServiceNow Table-API strategy + `servicenow-api` registration** — Phase 17 (§9.7); Phase 6 reserves the id + ordering only.
- **Browser automation + APCLiteNode geometry** — v2 (§26.7 / MM-07 boundary); geometry must be read content-script-side against live layout if ever populated.
- **Diagnostics surfacing of extraction metrics** — Phase 11; Phase 6 records metrics panel-side.
- **Add-ons / /research consuming PageContentService** — Phase 17 (add-on architecture).

None of these belong in Phase 6 — discussion stayed within phase scope.

</deferred>

---
*Phase: 6-PageContentService (Knowledge Acquisition)*
*Context gathered: 2026-08-29*