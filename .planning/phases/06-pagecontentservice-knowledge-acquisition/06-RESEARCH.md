# Phase 6: PageContentService (Knowledge Acquisition) - Research

**Researched:** 2026-08-29
**Domain:** Panel-side layered page extraction (Defuddle → Readability fallback; APC-lite structural walk), content-script serialization boundary, ephemeral per-tab MiniSearch retrieval
**Confidence:** MEDIUM

## Summary

Phase 6 ships the **PageContentService** — the single panel-side owner of layered extraction that every later surface consumes — plus the content-script shells that serialize a pre-stripped HTML clone with a stamped base URL, and the ephemeral per-tab MiniSearch index that powers retrieval-augmented context. It is a **create-only infrastructure phase** (D-81): the §18 file inventory + required tests, no live pipeline wiring (tool registration → Phase 18, surface triggers → Phase 15, `ContextOptimizer.assemble` adoption → Phase 7).

**SPIKE-P6-01 resolution (D-79):** the detached-document question is answered by evidence. Defuddle's `getComputedStyle` usage is guarded (`element.ownerDocument.defaultView?.getComputedStyle(...)` — optional chaining, source `src/defuddle.ts`), so a detached `DOMParser` document (`defaultView === null`) **degrades rather than throws** — independently confirmed for 0.19.2 by the nexus project (issue #329, 2026-08-14). Readability 0.6.0's `_isProbablyVisible` (verified in the published `Readability.js:2694-2707`) uses **only inline style/attribute checks — no `getComputedStyle`/`defaultView`** — so the fallback also works on detached docs. **Conclusion: detached-doc fidelity is ACCEPTABLE → ADR-P6-01 flips to Accepted, no content-script measurement pass.** The one known fidelity delta (stylesheet-driven `display:none` elements are not removed on a detached doc; inline `display:none` still is) degrades gracefully and is partially mitigated by the content-script pre-strip.

**Two spec-literal corrections surfaced by research** (the executor would otherwise fail `tsc --noEmit`):
1. **`defuddle/full` exports the `Defuddle` class as its DEFAULT export** (`dist/index.full.d.ts` verified) — spec 3721's `import { Defuddle } from 'defuddle/full'` is a named import that **does not exist** (TS2305 + runtime failure). Use `import Defuddle from 'defuddle/full'`.
2. **WXT 0.20.x dispatches a namespaced event, not the literal `wxt:locationchange`** — `getUniqueEventName()` prefixes `${browser.runtime.id}:${ENTRYPOINT}:` and it is dispatched on **`window`** (verified in installed `node_modules/wxt`). The scaffold's `document.addEventListener('wxt:locationchange', ...)` in `core.content.ts:49` is **dead code** (the MutationObserver URL-diff alongside it is what actually works). `SPANavigationWatcher` must use `ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl, oldUrl }) => …)` via the content-script context.

**Primary recommendation:** Plan the phase as: (Wave 1) install deps + `apcLite.types.ts` + `PageContext.ts` supersession re-export + strategy contract; (Wave 2) `DefuddleStrategy` (with the corrected default import + internal Readability fallback + the spike-as-fixture-test) and `ApcLiteStrategy`; (Wave 3) `PageContentService` orchestrator + `PageContentSerializer` + `PageContentCache` (§26.4a lifecycle); (Wave 4) `PageIndexBuilder` (minisearch) + content-script shells (`AxDomWalker`, `PageContextBridge`, `ContentScriptHost`, `SPANavigationWatcher`); (Wave 5) the §18 required tests + `verify:phase-6`/`verify:phase-4a` gate reconciliation (D-92).

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-79 (SPIKE-P6-01 runs in Phase 6 research; ADR-P6-01 flips to Accepted on acceptable fidelity):** ADR-P6-01 is `Proposed (spike pending at Phase 6 start)`. The Phase-6 researcher/planner runs the spike during planning research: capture ServiceNow-portal + KB-article HTML, run `defuddle/full` `parse({ markdown:true, url, useAsync:false })` on a detached `DOMParser` doc with `<base href>` injected, compare fidelity against a live-DOM baseline. **Default expectation: detached-doc fidelity is acceptable** (Defuddle's needs are met by DOM structure + base-href; it does not need computed style for the main-content path) → flip ADR-P6-01 Status to **Accepted**, no measurement pass. **Only if the spike finds a material computed-style/layout dependency** → add a **thin content-script measurement pass** (reads only the required layout signals; still no parsing; still <50 KB) and message them panel-side. Placement is NOT re-litigated — Defuddle stays panel-side per the ADR; the spike decides only the measurement-pass question. — **Reversibility:** `reversible` — rationale: ADR status flip + optional additive content-script pass; the panel-side placement is fixed by the ADR and §26.4.
- **D-80 (Phase 6 builds strategies 2 and 3 only — Readability is Defuddle's internal fallback, `servicenow-api` is reserved):** Per §26.2 + the Appendix "two enums" note (spec 4688-4693): implement `DefuddleStrategy` (mode `'default'`/read) and `ApcLiteStrategy` (mode `'actionable'`). **Readability is NOT a separate strategy/file** — it is DefuddleStrategy's internal low-confidence fallback and appears only as `StrategyResult.source: 'readability'` (result provenance). `IExtractionStrategy.id` enumerates installed strategies only (`'defuddle' | 'apc-lite'`); `'servicenow-api'` stays in the `StrategyResult.source` union + reserved ordering but is NOT registered in Phase 6 — Phase 17 registers it. Do NOT create a `ReadabilityStrategy` or ServiceNow strategy file. — **Reversibility:** `reversible` — rationale: registration/strategy table; Phase 17 adds a row.
- **D-81 (Create-only extraction layer — D-69 analog; no pipeline wiring):** §18 lists the extraction/content files + required tests and no AgentOrchestrator/chat/UI modification. Phase 6 ships `PageContentService` + strategies + cache + index + content-script shells proven by the §18 required tests. It is NOT wired into the live chat/agent pipeline this phase: no `get-page-content` tool registration (TOL-01 tool manifests are Phase 18), no surface UI triggers (Phase 15), no ContextOptimizer.assemble adoption (Phase 7). Extraction runs only when a surface requests it (§26.4a) — in Phase 6 that request path is exercised via PageContextBridge + tests, not a shipped surface call-site. — **Reversibility:** `reversible` — rationale: additive modules; wiring later is a caller edit.
- **D-82 (PageContentService produces the `PageContext` shape that feeds `ContextOptimizerInput.pageContext`):** Phase 6's output contract is the Appendix C `PageContext` (spec 4345-4357: url/origin/hostname/title/html?/markdown?/meta/extractedAt/addonId?/addonFields?). Phase 5's ContextOptimizer already declares `input.pageContext?: PageContext` — Phase 6 supplies the producer; the live `assemble()` adoption of pageContext is Phase 7 (trust-aware context). Phase 6 tests prove `extract()` → `PageContext` end-to-end via fixtures (pre-stripped HTML + stamped baseUrl). — **Reversibility:** `reversible` — rationale: producer module; consumer wiring later.
- **D-83 (PageContext supersession resolved — `src/core/content/PageContext.ts` is canonical):** The Phase-5 placeholder in `src/core/context/types.ts` (lines 7, 17-29) is explicitly marked as the "Phase 6 replaces in place at src/core/content/PageContext.ts (spec 4345)" supersession point. Phase 6 creates `src/core/content/PageContext.ts` holding `PageContext`, `TabContext`, `SNowCaseData`, `FileContext`, `NoteContext` verbatim from spec 4345-4391, and updates `src/core/context/types.ts` to **re-export/import from it** (D-72 re-export precedent) so `ContextOptimizer`'s `import type { PageContext } from './types'` keeps resolving. No parallel copy. — **Reversibility:** `reversible` — rationale: re-export; moving the canonical type later is an import edit.
- **D-84 (Phase-1 extraction envelope types wired — producer + consumer, BackgroundRouter stays stateless):** Phase 1 (D-15) declared `EXTRACT_PAGE_CONTENT`, `PAGE_LIVE_CONTEXT`, `PAGE_EXTRACTION_REQUESTED`, `PAGE_HTML_PAYLOAD` and the frozen `PageHtmlPayload` shape (`html`/`baseUrl`/`truncated`/`strategyId?`) in `src/core/runtime/RuntimeEnvelope.ts`, explicitly deferring handler registration until the Phase 6 spike lands. Phase 6 wires: the **producer** (content script serializer sends `PAGE_HTML_PAYLOAD`), the **consumer** (`PageContextBridge` + `PageContentService` receive/parse it), and `EXTRACT_PAGE_CONTENT` handling in PageContextBridge. The extraction round-trip flows **content-script → surface** (side panel/standalone) directly; `BackgroundRouter` stays stateless (no AI/IndexedDB in background per §5.1). `SPA_NAVIGATION`/`CONTENT_SCRIPT_READY` scaffold types stay as-is and now feed cache invalidation. — **Reversibility:** `reversible` — rationale: producer+consumer wiring; later surface call-sites are additional senders.
- **D-85 (core.content.ts stays thin; logic moves to `src/core/content/` shells):** `entrypoints/content/core.content.ts` keeps its WXT `defineContentScript` shell + `wxt:locationchange`/SPA-nav listener but delegates serialization + round-trip to the new `src/core/content/` modules (`ContentScriptHost`, `SPANavigationWatcher`, `PageContextBridge`, `AxDomWalker`). Serializer: serialize a **pre-stripped clone** of `document.documentElement` (remove `script`/`style`/`noscript`/`svg`/cross-origin `iframe` markup + `form action` attributes; **keep** text, headings, links, input controls), stamp the **effective base URL** into the payload, apply `PAGE_HTML_MAX_BYTES` (2 MB) hard cap, truncate at an element boundary + `truncated:true` if over. No multi-envelope chunking in v0.1 (§26.6). Content bundle stays free of React/AntD/defuddle/yaml/mathml-to-latex/temml/turndown (isolation grep §24 rev 2026-08-12). — **Reversibility:** `reversible` — rationale: additive content modules; entry file delegation is a thin edit.
- **D-86 (AxDomWalker content-side, minimal structural walk, runs only on `mode:'actionable'`):** AxDomWalker produces `RawNode` **content-script-side** (ISOLATED world) — roles + text + hierarchy + interaction flags + links + tables; `geometry?` stays **unset** (v0.1, §26.6 — if ever populated it must be read content-side against live layout, never in the panel's detached doc). It runs **only on a `mode:'actionable'` request** (zero AX cost on the default read/summarize path). Password values are omitted at capture (FormControlSchema.refine). `ApcLiteStrategy` (panel-side) normalizes `RawNode` → `APCLiteNode` and validates with `APCLiteDocumentSchema`. — **Reversibility:** `reversible` — rationale: walker + normalizer split; adding fields later is type additive.
- **D-87 (Install `minisearch ^7`; PageIndexBuilder owns the ephemeral page index; Phase-8 notes wrapper NOT created):** Add `minisearch ^7` to dependencies. `PageIndexBuilder` (§26.5) builds a **lazy, memoized, per-tab** MiniSearch index over extracted markdown: chunked **by heading** (h1–h6) with fields `title`/`url`/`headingPath` (breadcrumb)/`sectionText` + index-wide `tabId`; content before the first heading → synthetic `"(preamble)"` chunk; no-heading pages → paragraph-block chunks; oversized sections (> `INDEX_CHUNK_MAX_TOKENS` = 500) split into paragraph sub-chunks inheriting the same `headingPath`. Never persisted; built on first `query()`; evicted together with the extraction (§26.4a). When extracted tokens exceed the 2,000-token webpage budget (§22.2), expose `selectRelevant(query)` and record `compressionApplied: 'topk'` in the provenance manifest (§2.6 — the manifest is Phase 5's; the phase-7 receipt consumes it). Phase 6 does **NOT** create `src/core/search/MiniSearchIndex.ts` — the persistent notes-index wrapper is Phase 8. — **Reversibility:** `reversible` — rationale: additive index module; Phase 8's wrapper is separate.
- **D-88 (PageContentCache implements §26.4a lifecycle verbatim; subscription API declared, surface wiring deferred):** `PageContentCache`: keyed by `tabId` (**separate** from the Phase-1 `PageRegistry` — that registers surface pages, not page content); invalidate + evict on `wxt:locationchange` + `tabs.onUpdated`; evict on `tabs.onRemoved`; bounded LRU cap `PAGE_CACHE_MAX_TABS` = 20 with access-recency bumping; never LRU-evict an in-flight or subscribed tab; pinned tabs eviction-last; extraction and its index are **always evicted together** (never orphan an index). Coalesce concurrent extractions per tab (dedup on the in-flight promise keyed by tabId); a read after invalidation but before re-extract completes awaits the in-flight extraction, never a stale entry. Cache is ephemeral — never persisted to IndexedDB. The **subscription model** (subscribed = surface active on tab OR pinned via `WorkspaceState.pinnedTabs`) is declared as an API (`subscribe`/`unsubscribe`/`markStale`); the actual surface call-sites that subscribe arrive with their owning phases (Phase 7/15). — **Reversibility:** `reversible` — rationale: additive module + API; caller wiring later.
- **D-89 (On-demand + subscription-gated auto re-extract; lightweight live context always):** Per §26.4a: **lightweight live context** (title/url/meta) updates always on navigation (`PAGE_LIVE_CONTEXT` — the tiny content-bridge payload); **full extraction** (Defuddle → Readability → APC-lite) runs only when a surface requests it (`EXTRACT_PAGE_CONTENT`/`PAGE_EXTRACTION_REQUESTED`); **auto re-extract** after `wxt:locationchange` or `tabs.onUpdated` fires **only for subscribed tabs** — unsubscribed tabs are mark-stale only. Phase 6 implements the trigger model + stale-marking in `PageContentCache`; requests arrive through `PageContextBridge`. — **Reversibility:** `reversible` — rationale: lifecycle logic in cache module; surface senders later.
- **D-90 (Redaction panel-side via TraceRedactor; content script only strips markup + omits passwords):** `TraceRedactor` runs **panel-side**, over the extracted markdown/tree, **before** indexing or logging (§26.6, §4.4, §16). The content script performs **no** redaction — it only strips markup and **omits password values at capture** (`isPassword ⇒ value omitted`, enforced via `FormControlSchema.refine` in the AxDomWalker). Passwords are never captured. — **Reversibility:** `reversible` — rationale: seam + enforcement point; both already declared (TraceRedactor ships Phase 1, FormControlSchema in Appendix C).
- **D-91 (5 s AbortController timeout + typed `CONTENT_EXTRACT_FAILED` — never a silent empty result):** `PAGE_EXTRACTION_TIMEOUT_MS` = 5_000 threaded through the round-trip via a **single** `AbortController` (§26.6/§13). On failure: fallback (Defuddle→Readability, AX→DOM), **record source**, then surface the typed error `CONTENT_EXTRACT_FAILED` (Appendix C.2 closed set — **no invented codes**, D-38/§21.6). Never a silent empty result. Metrics (duration, node/char count, source, truncation) are recorded panel-side → surfaced by Diagnostics in Phase 11. — **Reversibility:** `reversible` — rationale: typed result + closed error code; surfacing later is additive.
- **D-92 (Re-point `verify:phase-6` to the §18 required test dirs + isolation grep — D-68/D-78 analog):** The `package.json` `verify:phase-6` script currently targets `tests/core/telemetry tests/components/DiagnosticsSection.test.tsx` (Phase 11 territory). Phase 6 re-points it to the §18 required tests: `tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts` (PageContentService/DefuddleStrategy/ApcLiteStrategy/PageIndexBuilder + the new isolation test). The new `tests/isolation/no-content-script-ui.test.ts` greps the **built content-script bundle** and rejects React/AntD/defuddle/yaml/mathml-to-latex/temml/turndown + File System Access API usage (per §24 rev 2026-08-12; extend the existing `cross-entrypoint-imports.test.ts` grep style, non-vacuous with self-test). **Reconcile `verify:phase-4a`** which currently points at the same Phase-6 dirs — it is a stale placeholder; Phase 6 owns these dirs (delete/re-point `phase-4a`). — **Reversibility:** `reversible` — rationale: package.json script edit.

### the agent's Discretion

- Exact Defuddle detached-doc spike harness (how the ServiceNow sample corpus is captured as test fixtures; fidelity metric — e.g., wordCount delta + relative-link resolution correctness vs live-DOM baseline).
- Whether `PageContentService` exposes a per-surface singleton (mirroring the per-surface module-singleton pattern) or a factory — either satisfies the consumer contract.
- `src/core/extraction/` layout: one file per §18 name vs a barrel `index.ts` — mirror the `src/core/ai/` layout convention.
- `PageIndexBuilder` internals: import `minisearch` directly vs a thin internal wrapper (Phase 8's `src/core/search/MiniSearchIndex.ts` may adopt the wrapper later).
- Whether the redaction call-site sits inside `PageContentService` or the `PageContentCache` write path (before indexing/logging per D-90).
- DefuddleStrategy low-confidence heuristic exact threshold for the Readability fallback (e.g., empty markdown, near-zero wordCount, or missing title).

### Deferred Ideas (OUT OF SCOPE)

- **Live `get-page-content` tool registration** — Phase 18 (TOL-01 tool manifests); Phase 6 ships the service, not the tool.
- **Surface UI extraction triggers** (pin / quick-action / chat / summarize) — Phase 15 (RICH-I-05 etc.); the subscription API is declared in Phase 6 (D-88/D-89).
- **Trust metadata + context receipts (CTX-01…06)** — Phase 7: `PageContext` gains trust/authority metadata and the manifest becomes the context receipt.
- **Live `pageContext` → `ContextOptimizer.assemble` wiring** — Phase 7 (trust-aware context consumes the Phase-6 output).
- **Persistent notes MiniSearch wrapper** (`src/core/search/MiniSearchIndex.ts`) — Phase 8; Phase 6 builds only the ephemeral page index (D-87).
- **ServiceNow Table-API strategy + `servicenow-api` registration** — Phase 17 (§9.7); Phase 6 reserves the id + ordering only.
- **Browser automation + APCLiteNode geometry** — v2 (§26.7 / MM-07 boundary); geometry must be read content-script-side against live layout if ever populated.
- **Diagnostics surfacing of extraction metrics** — Phase 11; Phase 6 records metrics panel-side.
- **Add-ons / /research consuming PageContentService** — Phase 17 (add-on architecture).

## Phase Requirements

No spec-native v1 requirement IDs land in Phase 6 (infra phase — `REQUIREMENTS.md` phase table: "Phase 6 | 0 | Infrastructure"; CTX-01…06 are Phase 7). The §18 DONE-when criteria are the phase's contract:

| §18 DONE-when Criterion | Research Support |
|-------------------------|-------------------|
| Defuddle runs panel-side, content script only serializes HTML | SPIKE-P6-01 resolved: detached-doc fidelity acceptable (guarded `defaultView?.` in defuddle; inline-only visibility checks in Readability 0.6.0) → ADR-P6-01 flips to Accepted |
| Content bundle: no React/AntD/defuddle/yaml, <50 KB | `tests/isolation/no-content-script-ui.test.ts` grep list (spec 3631 rev 2026-08-12: also `mathml-to-latex`, `temml`, `turndown`, File System Access API); defuddle/full pulls those as optional deps — must stay panel-side |
| Layered fallback (Defuddle→Readability, AX→DOM) records source | `StrategyResult.source` union `'defuddle' | 'readability' | 'apc-lite' | 'servicenow-api'` (spec 4676); `APCLiteDocumentSchema.source` adds `'dom'|'ax'|'hybrid'` (spec 4443) |
| PageIndexBuilder ephemeral per-tab MiniSearch index (never persisted) | minisearch 7.2.0 verified; heading-chunked fields per spec 3766-3770; `countTokensHeuristic` (TokenBudget.ts:44) reusable for the 500-token split + 2,000-token budget |
| SPA-nav (`wxt:locationchange`) + `tabs.onUpdated` invalidation works | WXT 0.20.27 dispatch verified (namespaced event on `window`, Navigation-API-first); scaffold's raw `document` listener is dead code — use `ctx.addEventListener(window, …)` |
| Passwords never captured (`isPassword ⇒ value omitted`) | `FormControlSchema.refine` (spec 4415-4418) enforced at AxDomWalker capture; panel-side redaction is separate (D-90) |
| `pnpm run verify:phase-6` passes | package.json re-point per D-92 (currently mis-pointed at Phase-11 dirs); reconcile `verify:phase-4a` |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Main-content extraction (Defuddle → Readability) | Panel (side panel/standalone) | — | §26.4 fixed: parsing runs on a detached doc in the surface; would blow the <50 KB content bundle otherwise |
| HTML serialization + base-URL stamp + 2 MB truncation | Content script (ISOLATED world) | — | Only the live document can serialize itself; content side never parses (§26.6) |
| APC-lite structural walk (RawNode capture) | Content script (ISOLATED world) | Panel (`ApcLiteStrategy` normalizes) | `geometry?` must be read against live layout if ever populated (§26.6); walker runs only on `mode:'actionable'` (D-86) |
| Ephemeral per-tab search index | Panel (`PageIndexBuilder`) | — | MiniSearch over extracted markdown lives with the extraction; never persisted (§26.5) |
| Extraction lifecycle (LRU cache, invalidation, coalescing) | Panel (`PageContentCache`) | Content script (nav events) | §26.4a normative lifecycle; invalidation signals come from `wxt:locationchange` + `tabs.onUpdated`/`onRemoved` |
| Redaction before indexing/logging | Panel (`TraceRedactor` seam) | — | Content script performs no redaction (D-90 / §26.6); keeps the bundle free of core deps |
| Timeout + typed error | Panel (`PageContentService` orchestrator) | — | Single `AbortController`, 5 s hard cap, `CONTENT_EXTRACT_FAILED` closed code (D-91 / Appendix C.2) |
| Password omission | Content script (`AxDomWalker` via `FormControlSchema.refine`) | — | Enforced at capture — a detached-doc panel walk would never see the live form values anyway |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| defuddle (`defuddle/full` bundle) | ^0.19 → 0.19.3 current (published 2026-08-22) | PRIMARY main-content extraction → clean Markdown | Purpose-built Readability successor (kepano/Obsidian Web Clipper engine, MIT); 562K weekly downloads; spec §23 pins 0.19.x for the CVE-2026-30830 fix + `data:`/`blob:` rejection + non-mutating `parse()` (rev 2026-08-12); `useAsync:false` + sync `parse()` keep it privacy-safe |
| @mozilla/readability | ^0.6 → 0.6.0 current | DefuddleStrategy's internal low-confidence fallback (provenance only — NOT a strategy) | Firefox Reader View engine; 3.56M weekly downloads; `^0.6` pin matters (0.x — `^0.5` would not auto-jump); `_isProbablyVisible` verified detached-doc-safe |
| turndown | ^7 → 7.2.4 current | HTML → Markdown for the APC-lite path (non-Defuddle output) | 8.65M weekly downloads; also an optional dep of defuddle/full (must stay out of the content bundle per §24 grep); STACK.md pin |
| minisearch | ^7 → 7.2.0 current | Ephemeral per-tab full-text index (`PageIndexBuilder`) | 2.65M weekly downloads; in-memory, no network, BM25+ ranking, fuzzy/prefix; spec §26.5 + §23 "Page-content retrieval" row; Phase 8 reuses the same engine for the notes index |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.4.3 (already in repo) | `APCLiteNodeSchema`, `APCLiteDocumentSchema`, `FormControlSchema.refine`, envelope payload validation | All cross-boundary shapes (CLAUDE.md convention) |
| wxt | ^0.20.27 (already pinned) | `defineContentScript` shell, `ContentScriptContext.addEventListener(window,'wxt:locationchange',…)`, `injectScript` | Content-script shells; v0.21 migration is a post-v0.1 chore (ADR-STACK-01) |
| src/core/context/TokenBudget.ts `countTokensHeuristic` | repo-local (Phase 5) | token estimate for `INDEX_CHUNK_MAX_TOKENS` splitting + 2,000-token budget | PageIndexBuilder chunk sizing (spec 461 heuristic; code-point aware) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| defuddle panel-side on detached doc | defuddle content-side (live DOM) | Would blow <50 KB bundle + fail isolation grep; ADR-P6-01 fixes placement |
| @mozilla/readability as fallback | A separate ReadabilityStrategy file | Appendix "two enums" note (spec 4688-4693) explicitly forbids it — provenance only (D-80) |
| minisearch for the page index | Embedding/vector search | Deferred per §23 ("no embeddings in v0.1"); MiniSearch reuses one engine across §26/§27 |
| turndown for markdown | Defuddle-only markdown | APC-lite tree → markdown needs an HTML→MD converter; turndown is the pinned choice (STACK.md) |

**Installation:**

```bash
pnpm add defuddle@^0.19 @mozilla/readability@^0.6 turndown@^7 minisearch@^7
```

**Version verification (VAI-04 — run at install):**

```bash
npm view defuddle version            # 0.19.3 (verified 2026-08-29)
npm view @mozilla/readability version  # 0.6.0
npm view turndown version            # 7.2.4
npm view minisearch version          # 7.2.0
```

All four confirmed on the npm registry this session; none has a `postinstall` script. **VAI-01 confirmed:** CVE-2026-30830 affects defuddle ≤ 0.7.0, patched in 0.9.0 (GHSA-5mq8-78gm-pjmq, 2026-03-05) — `^0.19` is far above the patch floor.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| defuddle | npm | 0.19.3 published 2026-08-22 (4 days before research; project line tracked since 2026-08-19) | 562K/wk | github.com/kepano/defuddle | [SUS] (reason: "too-new" — latest publish is days old; the package itself is long-established, 9.2k stars) | Flagged — planner must add `checkpoint:human-verify` before install |
| minisearch | npm | 7.2.0 published 2025-09-16 | 2.65M/wk | github.com/lucaong/minisearch | [OK] | Approved |
| turndown | npm | 7.2.4 published 2026-04-03 | 8.65M/wk | github.com/mixmark-io/turndown | [OK] | Approved |
| @mozilla/readability | npm | 0.6.0 published 2025-03-03 | 3.56M/wk | github.com/mozilla/readability | [OK] | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `defuddle` `[WARNING: flagged as suspicious — verify before using.]` — the seam's "too-new" signal fires on the 0.19.3 publish date (2026-08-22), not on package novelty: source repo is the known kepano/defuddle (the Obsidian Web Clipper engine), 562K weekly downloads, and the exact version line (`^0.19`, ≥0.19.2) is spec-pinned (§23). The planner must still insert `checkpoint:human-verify` before the install per protocol; the human check is expected to be a fast pass given the repo/downloads/provenance. No postinstall scripts on any of the four (checked via `npm view <pkg> scripts.postinstall` — all null/absent).

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────── CONTENT SCRIPT (ISOLATED world, <50 KB, extraction-only) ──────────────────────────────┐
│ entrypoints/content/core.content.ts (thin WXT shell, D-85)                                                          │
│   ├─ ContentScriptHost ── serialize pre-stripped clone of document.documentElement                                  │
│   │     (strip script/style/noscript/svg/cross-origin iframe markup + form action; keep text/headings/links/inputs)  │
│   │     stamp effective baseUrl · apply PAGE_HTML_MAX_BYTES (2 MB) → truncate at element boundary + truncated:true    │
│   ├─ SPANavigationWatcher ── ctx.addEventListener(window,'wxt:locationchange',…) + MutationObserver URL-diff          │
│   ├─ PageContextBridge ── RuntimeEnvelope producer/consumer: PAGE_HTML_PAYLOAD · EXTRACT_PAGE_CONTENT ·               │
│   │     PAGE_EXTRACTION_REQUESTED · PAGE_LIVE_CONTEXT (lightweight title/url/meta) · SPA_NAVIGATION feeds invalidation │
│   └─ AxDomWalker ── RawNode walk (roles/text/hierarchy/interaction/links/tables; geometry? UNSET;                    │
│         password values omitted via FormControlSchema.refine) — runs ONLY on mode:'actionable'                        │
└───────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────┘
                                                 │ RuntimeEnvelope (typed, D-15 declared, D-84 wired)
                                                 ▼
┌────────────────────────────────────── SIDE PANEL / STANDALONE (panel-side extraction) ───────────────────────────────┐
│ PageContentService (orchestrator — per-surface singleton or factory, agent's discretion)                             │
│   │  DOMParser(payload.html) → inject <base href> (if none) → strategy chain (5 s single AbortController, D-91)      │
│   ├─ DefuddleStrategy (mode 'default') ── defuddle/full parse({markdown:true, url, useAsync:false})                  │
│   │     └─ low confidence? → @mozilla/readability fallback → StrategyResult.source: 'readability'                    │
│   ├─ ApcLiteStrategy (mode 'actionable') ── RawNode → APCLiteNode tree → APCLiteDocument (zod)                        │
│   └─ PageContentSerializer ── StrategyResult → PageContext (markdown/html/meta/…, spec 4345)                          │
│         │                                                                                                             │
│         ├─ TraceRedactor (panel-side, before indexing/logging — D-90)                                                 │
│         ├─ PageContentCache (per-tab LRU, PAGE_CACHE_MAX_TABS=20, §26.4a lifecycle:                                  │
│         │     invalidate on wxt:locationchange/tabs.onUpdated, evict on tabs.onRemoved, coalesce in-flight per tab,   │
│         │     never LRU-evict in-flight/subscribed, pinned eviction-last, index always evicted WITH extraction)       │
│         └─ PageIndexBuilder (lazy, memoized per-tab MiniSearch — chunked by heading h1–h6; "(preamble)";             │
│               paragraph-block fallback; >500-token sections split; selectRelevant(query) when >2,000 tokens          │
│               → compressionApplied:'topk' in Phase-5 manifest)                                                        │
│                                                                                                                       │
│ output: PageContext ──▶ (Phase 7) ContextOptimizerInput.pageContext → assemble()                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/core/extraction/
├── PageContentService.ts           # orchestrator: request → strategy → PageContext; timeout + typed errors (D-91)
├── apcLite.types.ts                # RawNode / APCLiteNode / APCLiteDocument + zod schemas (spec 4393-4448, verbatim)
├── strategies/
│   ├── IExtractionStrategy.ts      # StrategyInput / StrategyResult / IExtractionStrategy (spec 4667-4693 verbatim)
│   ├── DefuddleStrategy.ts         # PRIMARY read path; internal Readability fallback; source: 'defuddle'|'readability'
│   └── ApcLiteStrategy.ts          # actionable path; RawNode → APCLiteNode normalize + APCLiteDocumentSchema validation
├── PageContentSerializer.ts        # StrategyResult → PageContext / markdown rendering
├── PageIndexBuilder.ts             # lazy per-tab MiniSearch index (heading-chunked; selectRelevant + topk)
└── PageContentCache.ts             # §26.4a lifecycle: LRU/invalidation/coalescing/subscription API (D-88/D-89)
src/core/content/
├── PageContext.ts                  # CANONICAL PageContext/TabContext/SNowCaseData/FileContext/NoteContext (spec 4345-4391)
├── AxDomWalker.ts                  # content-script RawNode walker (no React/AntD; password omission)
├── PageContextBridge.ts            # RuntimeEnvelope bridge (EXTRACT_PAGE_CONTENT producer/consumer, D-84)
├── ContentScriptHost.ts            # serializer orchestration shell (pre-strip + baseUrl + 2 MB cap, D-85)
└── SPANavigationWatcher.ts         # wxt:locationchange (ctx.addEventListener(window,…)) + MutationObserver fallback
tests/core/extraction/
├── PageContentService.test.ts
├── DefuddleStrategy.test.ts        # also hosts the SPIKE-P6-01 fidelity fixtures (detached vs live baseline)
├── ApcLiteStrategy.test.ts
└── PageIndexBuilder.test.ts
tests/isolation/
└── no-content-script-ui.test.ts    # greps built content bundle; rejects React/antd/react-dom/defuddle/yaml/
                                    #   mathml-to-latex/temml/turndown + File System Access API (spec 3631 rev 2026-08-12)
```

**Layout choice (agent's discretion):** mirror `src/core/ai/` — no barrel `index.ts`; the §18 names import each other directly. `PageContentService` as a **per-surface module singleton** (`getPageContentService()` returning a module-level instance) matches the established codebase pattern (module-level `Map` singletons per surface, ARCHITECTURE.md line 195) and keeps background-SW instantiation impossible by construction.

### Pattern 1: Detached-doc Panel-Side Extraction with base-href Restoration

**What:** The content script ships raw serialized HTML + effective base URL; the panel parses a detached `DOMParser` document, injects `<base href>` when absent, then runs Defuddle synchronously with `useAsync: false`.
**When to use:** Always — §26.4 is normative; placement is fixed (ADR-P6-01).
**Spike outcome (SPIKE-P6-01):** ACCEPTED — no measurement pass. Evidence: defuddle source guards computed-style access (`element.ownerDocument.defaultView?.getComputedStyle(element)` inside try/catch → falls back to inline styles / attribute sizes; `[CITED: github.com/kepano/defuddle src/defuddle.ts]`), and nexus issue #329 (2026-08-14) independently confirms "getComputedStyle calls are guarded, so a DOMParser document (defaultView === null) degrades rather than throws defuddle@0.19.2". Readability 0.6.0's `_isProbablyVisible` needs no `defaultView` at all `[VERIFIED: unpkg @mozilla/readability@0.6.0 Readability.js:2694-2707]`. Known delta: stylesheet-driven `display:none` removal is inert on detached docs (inline `display:none`/`hidden` still detected) — graceful, and the pre-strip already removes `style`/`script`/`noscript`/`svg`.
**Example:**

```typescript
// Source: PRODUCT_SPEC_v0_1.md §26.4 (spec 3718-3742) with the import shape CORRECTED per research.
// deviates from spec 3721: defuddle/full exports the class as DEFAULT, not named.
import Defuddle from 'defuddle/full';   // [VERIFIED: unpkg defuddle@0.19.3 dist/index.full.d.ts — 'export default Defuddle']

const doc = new DOMParser().parseFromString(payload.html, 'text/html');
if (payload.baseUrl && !doc.querySelector('base')) {
  const base = doc.createElement('base');
  base.setAttribute('href', payload.baseUrl);
  doc.head?.prepend(base);
}
const result = new Defuddle(doc, {
  url: payload.baseUrl,   // feeds relative-URL resolution
  markdown: true,         // 0.19.x: markdown is opt-in
  useAsync: false,        // PRIVACY-CRITICAL: default is TRUE in 0.19.x — must be explicit
}).parse();               // synchronous — async extractors never run on parse()
// result.content (markdown when markdown:true) / result.title / result.wordCount / result.parseTime …
```

### Pattern 2: Layered Strategy with Recorded Provenance

**What:** `PageContentService` routes by `mode`; each strategy returns `StrategyResult` carrying `source` (provenance). Readability is Defuddle's internal fallback — never a separate strategy file (spec 4688-4693). The `servicenow-api` id is reserved in the union but not registered until Phase 17.
**When to use:** D-80 is normative.
**Defuddle low-confidence heuristic (agent's discretion):** recommend firing the Readability fallback when `parse()` yields empty/whitespace markdown, `wordCount < ~50`, or a missing title — but note defuddle 0.19.x already auto-retries once internally when `wordCount < 200` (with `removePartialSelectors: false`), so the strategy-level threshold should sit below that (e.g., `wordCount < 50 || !content.trim()`). Readability's `parse()` returns `null` when below `charThreshold` (default 500) — treat `null` as a failed fallback that still records `source: 'readability'` and surfaces the typed error rather than an empty result (D-91).
**Example:**

```typescript
// Source: Appendix extraction contract (spec 4667-4693 verbatim) — the strategy interface Phase 6 implements.
import type { StrategyInput, StrategyResult } from './IExtractionStrategy';

export const DEFUDDLE_LOW_CONFIDENCE_WORD_COUNT = 50; // agent's discretion (below defuddle's internal 200-word retry)

// inside DefuddleStrategy.run():
try {
  const result = parseWithDefuddle(input);            // Pattern 1 call
  if (result.markdown.trim() && result.wordCount >= DEFUDDLE_LOW_CONFIDENCE_WORD_COUNT) {
    return { source: 'defuddle', markdown: result.markdown, meta: { title: result.title, wordCount: String(result.wordCount) }, approxTokens, truncated };
  }
  const fallback = parseWithReadability(input);       // new Readability(doc).parse() — see Pattern 4
  return { source: 'readability', markdown: fallback.markdown, meta: …, approxTokens, truncated };
} catch {
  return { source: 'readability', markdown: undefined, approxTokens: 0, truncated: true }; // caller surfaces CONTENT_EXTRACT_FAILED
}
```

### Pattern 3: Heading-Chunked Ephemeral MiniSearch Index

**What:** `PageIndexBuilder` lazily builds one MiniSearch per tab on first `query()`, chunking markdown by `h1–h6` boundaries. Fields per spec 3766: `title`, `url`, `headingPath` (breadcrumb), `sectionText`, plus index-wide `tabId` — **plus a synthesized `id`** (MiniSearch's default `idField` is `'id'`; the spec field list has no id — synthesize `headingPath + ':' + index`).
**When to use:** §26.5 normative; index is memoized per tab and evicted with the extraction (never orphaned).
**Chunking rules (verbatim):** preamble → synthetic `"(preamble)"` chunk; no headings → paragraph-block chunks (blank-line separated); sections > `INDEX_CHUNK_MAX_TOKENS` (500) → paragraph sub-chunks inheriting the same `headingPath`. Over the 2,000-token webpage budget (§22.2) → `selectRelevant(query)` returns only the top-k chunks and records `compressionApplied: 'topk'` (the `'topk'` literal is the Phase-5 `CompressionType`, `src/core/context/types.ts:50` — `[VERIFIED: src/core/context/types.ts:50]`).
**Example:**

```typescript
// Source: MiniSearch docs (lucaong.github.io/minisearch) + spec §26.5
import MiniSearch from 'minisearch';
import { countTokensHeuristic } from '../context/TokenBudget'; // D-71 heuristic, [VERIFIED: src/core/context/TokenBudget.ts:44]
import { INDEX_CHUNK_MAX_TOKENS } from './strategies/IExtractionStrategy'; // = 500 (spec 4698)

const index = new MiniSearch<PageChunk>({
  fields: ['title', 'url', 'headingPath', 'sectionText'],
  storeFields: ['title', 'url', 'headingPath', 'sectionText'],
  searchOptions: { boost: { title: 3, headingPath: 2 }, prefix: true, fuzzy: 0.2 },
});
index.addAll(chunks);  // chunks: { id, tabId, title, url, headingPath, sectionText }
const hits = index.search(query);   // [{ id, score, …storedFields }]
```

### Pattern 4: Readability Fallback (Detached-Doc-Safe)

**What:** `new Readability(doc).parse()` returns `{ title, content (HTML), textContent, length, excerpt, byline, dir, siteName, lang, publishedTime }` or `null`. `parse()` **mutates** the passed document — the panel's detached doc is disposable, but if the same doc is reused for a second attempt, clone it (`doc.cloneNode(true)`). The returned `content` HTML must be converted with turndown to markdown (Readability returns HTML, unlike Defuddle).
**When to use:** Only inside `DefuddleStrategy`'s low-confidence path.
**Example:**

```typescript
// Source: @mozilla/readability README (0.6.0) — verified _isProbablyVisible is detached-doc-safe [VERIFIED: Readability.js:2694-2707]
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

const article = new Readability(doc).parse();   // doc = the detached DOMParser doc (with <base href> injected)
if (!article) throw new Error('readability returned null');  // below charThreshold (500)
const markdown = new TurndownService().turndown(article.content);
```

### Pattern 5: Re-Export Supersession (PageContext)

**What:** Create the canonical `src/core/content/PageContext.ts` (verbatim spec 4345-4391: `PageContext`, `TabContext`, `SNowCaseData`, `FileContext`, `NoteContext`), then change `src/core/context/types.ts` to import-and-re-export `PageContext` (D-72 precedent) so `ContextOptimizer`'s `import type { PageContext } from './types'` keeps resolving.
**When to use:** D-83 normative; no parallel copies.

### Pattern 6: Content-Script SPA-Nav Invalidation (correct WXT usage)

**What:** `SPANavigationWatcher` must listen via the **content-script context** (`ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl, oldUrl }) => …)`) — WXT 0.20.x translates the type name to the extension-namespaced event and starts the LocationWatcher (Navigation API first, 1 s polling fallback; dispatched on `window`). Keep the scaffold's MutationObserver URL-diff as a belt-and-braces fallback (it is what works today).
**When to use:** D-84/D-88 invalidation signals.

### Anti-Patterns to Avoid

- **Named `Defuddle` import from `defuddle/full`:** spec 3721's literal shape fails TS2305 — the package's only class export is default (verified in the published d.ts and runtime). Use `import Defuddle from 'defuddle/full'` and document the deviation in a code comment.
- **Raw `document.addEventListener('wxt:locationchange', …)`:** dead code — the real event name is namespaced (`${runtime.id}:${ENTRYPOINT}:wxt:locationchange`) and dispatched on `window`. The current `core.content.ts:49` has exactly this bug; `SPANavigationWatcher` fixes it.
- **Trusting `useAsync`'s default:** in 0.19.x `useAsync` defaults to **true** — omitting it would silently allow third-party API fetches (FxTwitter) on content-less pages. Always pass `useAsync: false`.
- **Creating a `ReadabilityStrategy` or `ServiceNowStrategy` file:** the two-enums note (spec 4688-4693) is explicit — provenance only.
- **Creating `src/core/search/MiniSearchIndex.ts`:** that wrapper is Phase 8 (spec 2667); Phase 6 builds only `PageIndexBuilder` (D-87).
- **Persisting the cache or index:** both are ephemeral by spec (§26.4a/§26.5) — never IndexedDB.
- **Hand-rolling the serializer truncation mid-element:** 2 MB cap must truncate at an element boundary (spec 3778); a mid-element cut produces invalid HTML that `DOMParser` must repair (lossy).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Main-content extraction → clean Markdown | A Readability-clone scoring/cleaning engine | defuddle `^0.19` `defuddle/full` bundle | Readability successor with footnotes/math/code preservation, richer metadata; 0.19.x has the XSS fix + `data:`/`blob:` rejection + non-mutating parse |
| Article fallback when extraction is low-confidence | A second custom scorer | @mozilla/readability (internal fallback) | Firefox Reader View engine, 15+ years of tuning; verified detached-doc-safe |
| HTML → Markdown conversion | Regex-based markdown writer | turndown ^7 | GFM fidelity (tables, code fences, links) — regex writers mangle nested markup |
| Full-text retrieval over page chunks | A hand-rolled inverted index / string matching | minisearch ^7 | BM25+ ranking, fuzzy/prefix, field boosting, in-memory; < 50 ms over 1,000 docs (§22.1) |
| Password-capture prevention | Trusting page HTML to not contain values | `FormControlSchema.refine` at capture (spec 4415-4418) | Enforcement at the walker — the ONLY place live form values exist |
| Redaction before logging/indexing | Storing raw content then hoping it stays private | `TraceRedactor` seam (redactSensitive primitive + Phase-11 TraceRedactor) | D-90: redact panel-side before indexing/logging; content script never redacts |

**Key insight:** every "hard" piece of this phase (article extraction, fallback quality, markdown conversion, retrieval) is a solved problem with a pinned, spec-mandated library. The phase's real engineering is the **lifecycle plumbing** (per-tab LRU + invalidation + coalescing + subscription gating) and the **boundary discipline** (content bundle stays under 50 KB and dependency-free).

## Common Pitfalls

### Pitfall 1: `defuddle/full` named import fails typecheck
**What goes wrong:** `import { Defuddle } from 'defuddle/full'` → TS2305 "has no exported member" → `tsc --noEmit` (the verify gate) fails; a transpile-only path would also throw at runtime (no named export exists).
**Why it happens:** spec 3721's literal shape was never validated against the published package; `dist/index.full.d.ts` declares `export default Defuddle` (verified), and the runtime UMD `module.exports` IS the class itself.
**How to avoid:** Use `import Defuddle from 'defuddle/full'`; add a comment noting the spec-literal deviation. Executor instruction: treat the RESEARCH code example as authoritative over the spec's literal import.
**Warning signs:** `tsc --noEmit` error mentioning `defuddle/full`.

### Pitfall 2: `wxt:locationchange` listener on the wrong target/name
**What goes wrong:** SPA-nav invalidation silently never fires.
**Why it happens:** WXT 0.20.x namespaces the event (`${browser.runtime.id}:${ENTRYPOINT}:wxt:locationchange`) and dispatches it on `window`; the scaffold's `document.addEventListener('wxt:locationchange', …)` (`core.content.ts:49`) is dead code — the MutationObserver URL-diff next to it is what actually detects navigation.
**How to avoid:** `ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl, oldUrl }) => …)` inside the WXT `main(ctx)` — the context wrapper translates the name and starts the LocationWatcher (Navigation API first, 1 s polling fallback).
**Warning signs:** invalidation tests pass while live navigation shows stale cache; the watcher never starts (`.run()` is only invoked from `ctx.addEventListener`).

### Pitfall 3: `useAsync` defaults to true in 0.19.x
**What goes wrong:** silent outbound third-party API fetches (FxTwitter) when a page has no local content — a privacy violation (§0.2) and a violation of the "no data leaves the machine" posture.
**Why it happens:** the option's default is `true`; older drafts/notes predate the option.
**How to avoid:** always pass `useAsync: false` AND call synchronous `parse()` (never `parseAsync()`); both are belt-and-braces (spec 3740).
**Warning signs:** any network request originating from Defuddle during extraction.

### Pitfall 4: Readability `parse()` mutates its input document
**What goes wrong:** a second strategy attempt on the same detached doc sees a stripped/restructured DOM; `isProbablyReaderable` (if used) would call `getComputedStyle` via `defaultView` and throw on a detached doc.
**Why it happens:** Readability works in place; the readerable helper's default visibility checker is not detached-safe.
**How to avoid:** treat each strategy attempt as owning its doc (parse the panel's detached doc once per strategy); if reuse is needed, `doc.cloneNode(true)`. Never call `isProbablyReaderable` without a custom `visibilityChecker`.
**Warning signs:** empty second-attempt results; `null.defaultView`-style exceptions.

### Pitfall 5: MiniSearch chunk docs missing the `id` field
**What goes wrong:** `addAll` throws (default `idField` is `'id'`) or results come back with `undefined` ids.
**Why it happens:** spec 3766 lists fields `title/url/headingPath/sectionText` + index-wide `tabId` but no `id`.
**How to avoid:** synthesize an `id` per chunk (e.g., `${headingPath}:${chunkIndex}`) and keep the index-wide `tabId` on every doc (spec 3766 "plus an index-wide `tabId`").
**Warning signs:** MiniSearch `addAll` errors; search results missing ids.

### Pitfall 6: Gate mis-pointing (D-92) breaks the phase definition of done
**What goes wrong:** `pnpm run verify:phase-6` runs Phase-11 tests (currently `tests/core/telemetry tests/components/DiagnosticsSection.test.tsx` — confirmed in package.json:25) and fails on unrelated files or passes vacuously.
**Why it happens:** stale package.json scripts; `verify:phase-4a` (package.json:22) already points at the Phase-6 dirs as a placeholder.
**How to avoid:** re-point `verify:phase-6` to `tsc --noEmit && vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts` (D-92) and delete/re-point `verify:phase-4a`; also note `verify:phase-7` currently mis-points at Phase-15 dirs (out of Phase-6 scope — flag for Phase 7).
**Warning signs:** `verify:phase-6` referencing `telemetry` or `DiagnosticsSection`.

### Pitfall 7: Isolation grep must hit the BUILT bundle, not just source
**What goes wrong:** a source-level grep passes while the built `.wxt/` content bundle still contains defuddle's transitive math deps (`mathml-to-latex`, `temml`) or turndown (optional deps of `defuddle/full` — verified in defuddle package.json).
**Why it happens:** bundlers hoist/tree-shake differently; source greps can't see transitive deps resolved at build.
**How to avoid:** `no-content-script-ui.test.ts` greps the **built** content-script bundle (`.wxt/` output; may require `pnpm build:ext` first — D-92 says "built content-script bundle"), rejects `antd|React|react-dom|defuddle|yaml|mathml-to-latex|temml|turndown` + File System Access API (spec 3631), and is non-vacuous with a self-test block (cross-entrypoint-imports.test.ts style).
**Warning signs:** a `wxt build` output larger than ~50 KB; `defuddle` strings in the content chunk.

### Pitfall 8: Content-script modules must not import panel-side core modules
**What goes wrong:** `src/core/content/*` importing `src/core/extraction/*` (or zod-heavy panel modules) drags the bundle over budget or breaks the isolation grep.
**Why it happens:** `src/core/` is UI-framework-agnostic but not all of it is content-safe; the ISOLATED-world content script can only carry what WXT bundles for it.
**How to avoid:** content-side modules (`AxDomWalker`, `PageContextBridge`, `ContentScriptHost`, `SPANavigationWatcher`) may import only `src/core/runtime/RuntimeEnvelope.ts` (types + `createEnvelope`) and each other — nothing else. `RawNode` must stay a plain serializable interface (no zod in the content bundle; `FormControlSchema.refine` runs where the walker builds the node, and the zod validation is panel-side in `ApcLiteStrategy`).
**Warning signs:** `wxt build` warns on shared chunk; isolation grep trips.

## Code Examples

### Corrected canonical Defuddle call (panel side)

```typescript
// Source: PRODUCT_SPEC_v0_1.md §26.4 (spec 3718-3742), import shape corrected per research
// [VERIFIED: unpkg defuddle@0.19.3 dist/index.full.d.ts + dist/index.full.js]
import Defuddle from 'defuddle/full'; // DEFAULT export — spec 3721's named import fails TS2305

export function parseDetached(payload: { html: string; baseUrl: string }): DefuddleResponse {
  const doc = new DOMParser().parseFromString(payload.html, 'text/html');
  if (payload.baseUrl && !doc.querySelector('base')) {
    const base = doc.createElement('base');
    base.setAttribute('href', payload.baseUrl);
    doc.head?.prepend(base);
  }
  return new Defuddle(doc, {
    url: payload.baseUrl,
    markdown: true,
    useAsync: false, // PRIVACY-CRITICAL: default is true — explicit false required
  }).parse();
}
```

### Readability fallback (DefuddleStrategy internal)

```typescript
// Source: @mozilla/readability 0.6.0 README; detached-safety verified in Readability.js:2694-2707
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

function readabilityFallback(doc: Document): { markdown: string } | null {
  const article = new Readability(doc).parse(); // may mutate doc — doc is disposable here
  if (!article || article.textContent.trim().length === 0) return null;
  return { markdown: new TurndownService({ headingStyle: 'atx' }).turndown(article.content) };
}
```

### PageIndexBuilder chunking + lazy index (per-tab)

```typescript
// Source: spec §26.5 (3763-3774) + MiniSearch docs (lucaong.github.io/minisearch)
import MiniSearch from 'minisearch';
import { countTokensHeuristic } from '../context/TokenBudget';
import { INDEX_CHUNK_MAX_TOKENS } from './strategies/IExtractionStrategy'; // 500

interface PageChunk { id: string; tabId: number; title: string; url: string; headingPath: string; sectionText: string; }

export function chunkMarkdown(markdown: string, tabId: number, title: string, url: string): PageChunk[] {
  // 1. Split on /^#{1,6}\s/m heading lines → track breadcrumb path per heading.
  // 2. Pre-heading text → chunk with headingPath '(preamble)' (spec 3767).
  // 3. No headings at all → blank-line-separated paragraph blocks (spec 3768).
  // 4. A section > INDEX_CHUNK_MAX_TOKENS (countTokensHeuristic) → paragraph sub-chunks
  //    inheriting the same headingPath (spec 3769).
  // 5. id = `${headingPath}:${index}`; every chunk carries tabId.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void countTokensHeuristic; void INDEX_CHUNK_MAX_TOKENS;
  return []; // implementation detail — chunker logic exercised by PageIndexBuilder.test.ts
}

export function buildIndex(chunks: PageChunk[]): MiniSearch<PageChunk> {
  return new MiniSearch<PageChunk>({
    fields: ['title', 'url', 'headingPath', 'sectionText'],
    storeFields: ['title', 'url', 'headingPath', 'sectionText'],
    searchOptions: { boost: { title: 3, headingPath: 2 }, prefix: true, fuzzy: 0.2 },
  }).addAll(chunks) as unknown as MiniSearch<PageChunk>; // addAll returns this
}
```

### SPA-nav invalidation (correct WXT usage)

```typescript
// Source: WXT 0.20.27 installed source (content-script-context.mjs:150-158, location-watcher.mjs:9-29)
// [VERIFIED: node_modules/wxt/dist/utils/internal/location-watcher.mjs:9-29]
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main(ctx) {
    // Must go through ctx.addEventListener: translates the namespaced event name AND
    // starts the LocationWatcher (Navigation API first, 1s polling fallback).
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl, oldUrl }) => {
      onNavigation(newUrl.href, oldUrl.href); // → PageContentCache.invalidate(tabId) / markStale
    });
    // Belt-and-braces URL-diff (MutationObserver) kept from the scaffold for pre-0.20.27 parity.
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @mozilla/readability as the primary extractor | Defuddle (Readability successor) primary; Readability is the fallback | 0.9.0 security line, 2026-03-05; 0.19.x pin rev 2026-08-12 | Better footnote/math/code preservation + metadata; CVE-2026-30830 fixed; `useAsync`-gated third-party extractors |
| Content-side extraction (live DOM) | Panel-side detached-doc extraction with base-href | ADR-P6-01 (2026-08-19), spike resolves at Phase 6 | Content bundle stays <50 KB and dependency-free; XSS surface moved off host pages |
| WXT locationchange polling | Navigation-API-first dispatch (polling fallback) | WXT issue #1567 → PR #2136 (post-0.20.x line) | Faster SPA-nav detection; 0.20.27 still uses `window` dispatch with namespaced names |
| Hand-rolled inverted index / bag-of-words | MiniSearch BM25+ for page + notes retrieval | minisearch 7.x | Unified engine for §26 ephemeral + §27 persistent indexes; no embeddings in v0.1 |

**Deprecated/outdated:**
- **`import { Defuddle } from 'defuddle/full'` (spec 3721):** the named import does not exist in the published package — default import only (this research's correction).
- **`document.addEventListener('wxt:locationchange', …)` (scaffold core.content.ts:49):** dead code in WXT 0.20.x — namespaced event on `window`; use `ctx.addEventListener(window, …)`.
- **`^0.5` @mozilla/readability (earlier spec draft):** `^0.5` would not auto-jump to 0.6 (0.x semver) — the `^0.6` pin matters (STACK.md correction).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `defaultView?.getComputedStyle` guard seen in defuddle's `main` branch source applies to the published 0.19.3 dist | Architecture Patterns / Pattern 1 | If 0.19.3 removed the guard, the detached doc could throw — the spike fixture test in `DefuddleStrategy.test.ts` (run in vitest jsdom, which HAS `DOMParser`) proves it at test time; low risk |
| A2 | vitest jsdom can execute the `defuddle/full` UMD bundle end-to-end (jsdom provides `window`/`document`/`DOMParser`; turndown is DOM-free; mathml-to-latex/temml are pure JS) | Standard Stack / Validation | If the full bundle fails to load under jsdom, tests must stub `Defuddle` and the real-engine spike moves to a `wxt build` + node harness — planner should gate DefuddleStrategy.test.ts behind a real-engine smoke test |
| A3 | MiniSearch's default multi-term combination is OR (BM25-ranked union) | Pattern 3 | Only affects ranking defaults; `combineWith` can be set explicitly in `searchOptions` if a different behavior is wanted |
| A4 | The built content-script bundle is available for the isolation grep (requires `wxt build`/`pnpm build:ext` before `verify:phase-6`) | Pitfall 7 / D-92 | If builds are too slow for CI, the test should grep source imports as a proxy PLUS one build-based size/isolation check — planner decides the exact mechanics |
| A5 | `countTokensHeuristic` (Phase 5) is a suitable token estimate for `INDEX_CHUNK_MAX_TOKENS` splitting and the 2,000-token budget | Pattern 3 | Different counting changes chunk boundaries, not correctness; the heuristic is the same one ContextOptimizer uses for the 2,000-token budget, so boundaries stay consistent |
| A6 | Content-script modules can depend only on `RuntimeEnvelope` (types + `createEnvelope`) and each other, keeping the bundle dependency-free | Pitfall 8 | If the envelope module pulls heavier deps, the content bundle grows — verify with the isolation grep on the built bundle |
| A7 | `pageContext` re-export from `src/core/content/PageContext.ts` into `src/core/context/types.ts` type-checks cleanly (D-72 precedent) | Pattern 5 | The D-72 PromptSection re-export precedent (Phase 5) proves the pattern; low risk |

## Open Questions (RESOLVED)

1. **Spike fixture corpus for SPIKE-P6-01**
   - What we know: the evidence (guarded computed-style access + Readability inline-only visibility) makes detached-doc extraction viable; the D-79 spike wants a fidelity comparison on ServiceNow-portal + KB-article HTML.
   - What's unclear: whether to capture real ServiceNow HTML as fixtures (privacy: ServiceNow instances are customer environments) or synthesize representative KB/portal-shaped fixtures.
   - Recommendation: synthesize 2–3 representative fixtures (KB-article shape, portal record shape, generic article) in `tests/fixtures/` (or inline in `DefuddleStrategy.test.ts`), and measure (a) wordCount delta vs a live-DOM baseline where the fixture is also parsed with a jsdom live document, and (b) relative-link resolution correctness (base-href stamp). This satisfies the spike within the §18 required tests; the ADR flips to Accepted with the spike record appended.

2. **Isolation-grep mechanics: source vs built bundle**
   - What we know: D-92 says "greps the built content-script bundle"; the cross-entrypoint precedent greps source.
   - What's unclear: whether `verify:phase-6` should run `wxt build` first (adds seconds to the gate) or grep source + one build-time check.
   - Recommendation: grep source imports in `src/core/content/**` + `entrypoints/content/**` for the forbidden list (fast, deterministic), plus a bundle-size assertion on `.wxt/` output when present; document in the test header. Planner picks the exact mechanics; non-vacuous self-test is mandatory.

3. **verify:phase-7 mis-pointing (out of Phase-6 scope, flag only)**
   - What we know: package.json:26 `verify:phase-7` targets `tests/hooks tests/components tests/components/rich tests/core/intent tests/core/notes` — that is the §24 Phase-15 target, not spec's `tests/core/context/trust tests/security/prompt-injection`.
   - What's unclear: whether Phase 6 should fix it (no — not in §18 scope; D-92 only covers phase-6/phase-4a).
   - Recommendation: leave for Phase 7's own gate reconciliation (D-68/D-78/D-92 pattern); note in the plan's risks so the Phase-7 planner picks it up.

4. **Redaction call-site (agent's discretion): service vs cache write path**
   - What we know: D-90 requires redaction panel-side before indexing/logging; the primitive is `redactSensitive` (src/core/security/redactSensitive.ts) with the richer TraceRedactor deferred to Phase 11.
   - What's unclear: whether the call lives in `PageContentService.extract()` (redact once, all consumers safe) or `PageContentCache` write path (redact on storage).
   - Recommendation: redact in `PageContentService` before both indexing and caching — one seam, single guarantee; cache stores the redacted form.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build + tests | ✓ | v24.19.0 | — |
| pnpm | install + verify gates | ✓ | 11.22.0 (matches package.json `packageManager`) | — |
| npm registry | install + version verification | ✓ | reachable (npm view succeeded for all 4 packages) | — |
| jsdom (dev dep) | vitest DOM environment (`tests/setup.ts`) | ✓ | ^25.0.0 (installed) | — |
| WXT | content-script shell + `wxt:locationchange` | ✓ | ^0.20.27 (installed, source verified in node_modules) | — |
| defuddle ^0.19 | DefuddleStrategy | ✗ | — | Install at Wave 1; checkpoint:human-verify per SUS |
| @mozilla/readability ^0.6 | Readability fallback | ✗ | — | Install at Wave 1 |
| turndown ^7 | APC-lite markdown path | ✗ | — | Install at Wave 1 |
| minisearch ^7 | PageIndexBuilder | ✗ | — | Install at Wave 1 |
| Chrome (real browser) | live SPA-nav/tabs.onUpdated end-to-end verification | ✗ (not needed) | — | All lifecycle logic is testable via mocks (chrome.tabs mock + BroadcastChannel mock in tests/setup.ts); live browser check is optional manual UAT |

**Missing dependencies with no fallback:** the four extraction/index libraries — the phase cannot implement without them; the install is the first Wave-1 task.
**Missing dependencies with fallback:** none beyond the libraries above (all testable headless via vitest jsdom + Chrome API mocks).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 (jsdom environment, globals enabled) |
| Config file | `vitest.config.ts` (setupFiles: `./tests/setup.ts`; `@/` alias → `src/`) |
| Quick run command | `pnpm verify:phase-6` (after re-point per D-92) |
| Full suite command | `pnpm verify:all` (tsc --noEmit && vitest run && lint) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| §18 (no v1 IDs) | PageContentService orchestrates extract() → PageContext via fixtures (pre-stripped HTML + baseUrl), timeout → CONTENT_EXTRACT_FAILED, never silent-empty | unit/integration | `vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ Wave 1 |
| §18 | DefuddleStrategy: real defuddle in jsdom on detached DOMParser doc + base-href; low-confidence → Readability fallback with source 'readability'; useAsync:false asserted | unit (spike host) | `vitest run tests/core/extraction/DefuddleStrategy.test.ts -x` | ❌ Wave 1 |
| §18 | ApcLiteStrategy: RawNode → APCLiteNode normalization; APCLiteDocumentSchema validation; password-omission refine | unit | `vitest run tests/core/extraction/ApcLiteStrategy.test.ts -x` | ❌ Wave 1 |
| §18 | PageIndexBuilder: heading chunking, preamble, no-heading paragraphs, oversized-section split, selectRelevant + 'topk', never persisted | unit | `vitest run tests/core/extraction/PageIndexBuilder.test.ts -x` | ❌ Wave 1 |
| §18 / §24 | Content bundle isolation: built-bundle grep rejects React/antd/react-dom/defuddle/yaml/mathml-to-latex/temml/turndown + File System Access API; non-vacuous self-test | isolation | `vitest run tests/isolation/no-content-script-ui.test.ts -x` | ❌ Wave 1 |

### Sampling Rate
- **Per task commit:** `pnpm lint` (tsc --noEmit) + the affected test file
- **Per wave merge:** `pnpm verify:phase-6`
- **Phase gate:** `pnpm verify:phase-6` green before `/gsd-verify-work` (plus `pnpm verify:all` smoke at gate)

### Wave 0 Gaps
- [ ] `tests/core/extraction/PageContentService.test.ts` — orchestrator + timeout + typed error path
- [ ] `tests/core/extraction/DefuddleStrategy.test.ts` — real-engine detached-doc fidelity (SPIKE-P6-01 host) + Readability fallback
- [ ] `tests/core/extraction/ApcLiteStrategy.test.ts` — normalization + schema + password omission
- [ ] `tests/core/extraction/PageIndexBuilder.test.ts` — chunking rules + selectRelevant + ephemerality
- [ ] `tests/isolation/no-content-script-ui.test.ts` — built-bundle grep with self-test
- [ ] `tests/fixtures/` (optional) — KB-article / portal-record shaped HTML fixtures for the spike
- [ ] Dependency install: `pnpm add defuddle@^0.19 @mozilla/readability@^0.6 turndown@^7 minisearch@^7` — none installed today (verified in node_modules)

*(Chrome API mocks needed by cache/content tests already exist in `tests/setup.ts`: chrome.storage local/sync/session, BroadcastChannel, fake-indexeddb; a `chrome.tabs` mock for onUpdated/onRemoved will need adding if not present.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth in extraction) |
| V3 Session Management | no | — |
| V4 Access Control | no | — (content script reads the page the user is already viewing; no escalation) |
| V5 Input Validation | **yes** | zod schemas on every cross-boundary shape: `APCLiteDocumentSchema`, `FormControlSchema.refine` (password omission), `PageHtmlPayload` shape validation; strategy `canHandle` gating by mode |
| V6 Cryptography | no | — (no new crypto; secrets stay in chrome.storage.session per Phase-2 design) |
| V7 XSS / Output Encoding | **yes** | defuddle ≥ 0.9.0 (CVE-2026-30830 patched — VAI-01 confirmed; 0.19.3 installed); extracted HTML/markdown is never rendered with raw `innerHTML` — markdown rendering surfaces (x-markdown) sanitize; TraceRedactor before logging |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via extracted HTML (crafted schema.org + img alt attribute injection) | Tampering | defuddle ≥ 0.9.0 (the CVE-2026-30830 fix line — GHSA-5mq8-78gm-pjmq, patched 0.9.0; pin `^0.19`); never interpolate extracted strings into HTML; markdown renderer sanitization (consumer-side, Phase 3's x-markdown) |
| Third-party exfiltration via Defuddle async extractors | Information Disclosure | `useAsync: false` + synchronous `parse()` (privacy-critical, spec 3740); content script contains zero `fetch(` (existing Phase-1 isolation gate) |
| Password capture from host forms | Information Disclosure | `FormControlSchema.refine` — value omitted when `isPassword` at capture time (content-side AxDomWalker); panel-side redaction as second layer (D-90) |
| Host-page prompt injection reaching the LLM | Spoofing | Phase 6 extraction hygiene only (never treat page text as instructions); full mitigation is Phase 7 CTX-02 layered trust + stable-prefix defense (out of scope here) |
| Oversized payload / DoS on panel parsing | Denial of Service | `PAGE_HTML_MAX_BYTES` (2 MB) hard cap + element-boundary truncation + `truncated:true`; 5 s AbortController (D-91) |
| Detached-doc computed-style crash | Availability | defuddle guards `defaultView?.getComputedStyle`; Readability `_isProbablyVisible` is inline-only (both verified) — spike fixture test asserts no-throw |

## Sources

### Primary (HIGH confidence)
- **PRODUCT_SPEC_v0_1.md §18/§26/Appendix C/Appendix contract/§24/§22/§2.3** — the phase contract, canonical call shape, types, tunables, isolation grep (read this session: 2598-2710, 3410-3504, 3600-3632, 3672-3801, 4344-4448, 4658-4700)
- **unpkg defuddle@0.19.3 `dist/index.full.d.ts` + `dist/index.full.js` + `package.json`** — default-export shape, exports map, optional deps (mathml-to-latex/temml/turndown), no postinstall
- **unpkg @mozilla/readability@0.6.0 `Readability.js`** — `_isProbablyVisible` (lines 2694-2707) detached-doc safety; `parse()` return shape; mutation behavior
- **node_modules/wxt@0.20.27** — `location-watcher.mjs:9-29` (window dispatch, Navigation-API-first), `custom-events.mjs:3-17` (namespaced event name), `content-script-context.mjs:150-158` (ctx.addEventListener translation)
- **npm registry** — versions: defuddle 0.19.3, minisearch 7.2.0, @mozilla/readability 0.6.0, turndown 7.2.4; no postinstall scripts
- **In-repo sources read this session:** `src/core/runtime/RuntimeEnvelope.ts:1-80` (D-15 envelope types + `PageHtmlPayload`), `src/core/context/types.ts:1-60` (supersession points), `src/core/context/ContextOptimizer.ts:41-53,304-312,385-388` (pageContext input + buildContextText), `src/core/context/ContextProvenanceManifest.ts:13-63` (CompressionTypeSchema incl. 'topk'), `src/core/context/TokenBudget.ts:44-56` (countTokensHeuristic), `src/core/workspace/WorkspaceStore.ts:116-130` (pinnedTabs cap 10), `entrypoints/content/core.content.ts:1-67` (thin shell + dead wxt:locationchange listener), `tests/isolation/cross-entrypoint-imports.test.ts:1-124` (grep style), `tests/setup.ts:1-256` (chrome/broadcast mocks), `package.json:22-25` (verify:phase-4a/6 mis-pointing), `wxt.config.ts:1-72` (permissions)

### Secondary (MEDIUM confidence)
- [CITED: github.com/kepano/defuddle src/defuddle.ts (main)] — guarded `defaultView?.getComputedStyle` usage in removeHiddenElements/image measurement
- [CITED: github.com/ProfSynapse/nexus issue #329 (2026-08-14)] — independent confirmation "DOMParser document (defaultView === null) degrades rather than throws defuddle@0.19.2"
- [CITED: github.com/advisories/GHSA-5mq8-78gm-pjmq / NVD CVE-2026-30830 / Snyk SNYK-JS-DEFUDDLE-15441037] — affected ≤ 0.7.0, patched 0.9.0, cross-checked across three advisory sources
- [CITED: npmjs.com/package/defuddle README] — option table (useAsync default true, markdown opt-in, parseAsync third-party fetch)
- [CITED: lucaong.github.io/minisearch API] — Options/SearchOptions types, search/fuzzy/prefix/boost, tokenize/processTerm defaults
- [CITED: github.com/mozilla/readability 0.6.0 README] — parse() return shape, isProbablyReaderable caveats, Node usage
- [CITED: wxt.dev guide/essentials/content-scripts + wxt issue #1567] — `wxt:locationchange` semantics and polling→Navigation-API evolution

### Tertiary (LOW confidence)
- Stack Overflow DOMParser/getComputedStyle general background (detached doc `defaultView === null`) — consistent with primary sources, not load-bearing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified on the npm registry this session; export-shape and detached-doc behavior verified against the published artifacts
- Architecture: MEDIUM — spec contracts read in full; library behaviors cross-checked; two spec-literal corrections (import shape, wxt event) are the main deltas
- Pitfalls: MEDIUM — the top four pitfalls (named import, wxt event target/name, useAsync default, Readability mutation) are directly verified; the remainder are codebase-specific patterns with in-repo evidence

**Research date:** 2026-08-29
**Valid until:** 2026-09-05 (fast-moving: defuddle 0.19.x publishes frequently; re-verify versions at install per VAI-04)