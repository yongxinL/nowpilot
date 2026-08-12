# Phase 4a: PageContentService (Knowledge Acquisition) - Research

**Researched:** 2026-08-12
**Domain:** Browser-extension content extraction, layered HTML→markdown strategies, ephemeral full-text indexing
**Confidence:** HIGH (architecture locked by CONTEXT.md; library APIs verified against package source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Trigger & Cache Lifecycle
- **D-4a-01 [hybrid trigger]:** Lightweight live context (title/url/meta) updates always on nav — the tiny content-bridge payload. Full extraction runs on **surface request** (Chat/Summarize/agent/quick-action). Auto re-extract after `wxt:locationchange` (SPA-nav) or `tabs.onUpdated` fires **only if a surface is subscribed to that tab**; unsubscribed tabs are mark-stale only (no proactive extraction). "Subscribed" = the panel/Standalone is active on that tab OR the tab is pinned as context (`WorkspaceState.pinnedTabs` / `currentPageContext`).
- **D-4a-02 [cache distinct from PageRegistry]:** New per-tab `PageContentCache` keyed by `tabId`, **separate** from the Phase-1 `PageRegistry` (which keeps the lightweight live title/URL context). Never persisted to IndexedDB (§26.5).
- **D-4a-03 [stale-safe coalescing]:** Coalesce concurrent extractions per tab (in-flight promise dedup by `tabId`). A read arriving after invalidation but before re-extract completes must **await the in-flight extraction** — never return the stale entry. 5 s hard cap (§22.1) + a single `AbortController` threaded through the round-trip; on timeout/failure → fallback chain, then typed `CONTENT_EXTRACT_FAILED` — never a silent empty result.
- **D-4a-04 [eviction]:** Drop a tab's cache AND its ephemeral index together on: `tabs.onRemoved`, invalidation (SPA-nav/`tabs.onUpdated`), or LRU pressure (`PAGE_CACHE_MAX_TABS`, default 20 — Appendix C constant). Recency bumped on every read/serve. Never LRU-evict an in-flight or subscribed tab; pinned tabs are eviction-last (a user-chosen pin never silently loses its cache). Test asserts the cap + eviction order deterministically.

#### Cross-Surface Delivery
- **D-4a-05 [primary-writer election]:** Extraction follows the existing Phase-1 primary-writer election (§13): the primary surface extracts and writes `WorkspaceStore.currentPageContext`; the secondary mirrors via BroadcastBus. **No new coordination path.**
- **D-4a-06 [delivery boundary]:** 4a delivers to cache + PageContextBridge + `WorkspaceStore.currentPageContext` + ephemeral index ONLY. The hook→optimizer pageContext feed (`ContextOptimizerInput.pageContext`, Phase-4 structural no-op) stays unplugged → **Phase 4b** (CTX-01/02 trust-aware feed). Phase-4's D-04-02 re-pack seam trigger arrives via the 4a PageContextBridge events.

#### HTML Payload & Transport
- **D-4a-07 [pre-stripped clone]:** Content script clones `document.documentElement`, removes script/style/noscript/svg/cross-origin iframe markup and form-action attributes — **keeps** text nodes, headings, links, and input controls (incl. inputs outside forms) so both Defuddle (prose) and APC-lite (structure) have what they need. Serializes the cleaned tree to a single HTML string (typical multi-MB pages shrink ~70–90 %). Runs at `document_idle`, non-blocking, inside the 5 s `AbortController` budget.
- **D-4a-08 [base-URL stamp]:** Content script stamps the page's effective base URL into the payload (absolute `<base href>` or a sibling field); the panel injects it before `new Defuddle(doc).parse()` — closes the detached-DOMParser relative-link/image gap (correct citations).
- **D-4a-09 [hard size cap]:** `PAGE_HTML_MAX_BYTES` (default ~2 MB). If the cleaned string still exceeds it, truncate at an element boundary and set `truncated: true` in provenance (§22.2) — **no chunk/assembly protocol in v0.1**. Revisit chunking only if real pages hit the cap.
- **D-4a-10 [redaction panel-side]:** TraceRedactor runs in the panel before indexing/logging (CAT-03, §26.6). The content script strips + omits only — **never imports TraceRedactor** (Appendix G isolation; the bundle stays dependency-free).

#### APC-lite (Structural Path)
- **D-4a-11 [full schema now]:** Ship the complete spec'd `APCLiteNode` / `RawNode` types verbatim per Appendix C (roles, interaction, `geometry?`, link, image, form, iframe, tables) — **zero schema rework** when 4b/5/8 or v2 automation (§26.7) lands.
- **D-4a-12 [walk on actionable only]:** AxDomWalker runs only when `mode: 'actionable'` is requested. It emits roles + text + hierarchy + interaction flags (clickable/editable/focusable/disabled) + links + tables. Geometry is **omitted** in v0.1 (the field stays optional and unset).
- **D-4a-13 [geometry placement rule]:** If/when geometry is ever populated, it MUST be read in the content script against the **live DOM** — never the panel's detached DOMParser doc (which has no layout). In v0.1 it is not read at all (avoids `getBoundingClientRect` forced-layout cost; no consumer, no automation — R-5).
- **D-4a-14 [mode gating]:** `mode` defaults to `'default'` (read/summarize → Defuddle → Readability). `'actionable'` (APC-lite) is used only when an agent explicitly requests structure.

#### Ephemeral MiniSearch Index
- **D-4a-15 [lazy build]:** The per-tab index is built **lazily on first `query()`**, memoized per tab, evicted with the extraction, never persisted (§26.5). Zero index cost for tabs whose content is never searched.
- **D-4a-16 [heading chunking]:** Chunk Defuddle markdown by heading boundaries (h1–h6); each MiniSearch doc has fields `title`, `url`, `headingPath` (breadcrumb, e.g. "Work KB > ServiceNow > Incident"), `sectionText`, plus an index-wide `tabId`. A synthetic **"(preamble)"** chunk covers content before the first heading (no orphaned lead text). No-heading pages fall back to paragraph-block chunks (blank-line separated) under the page title. Sections over `INDEX_CHUNK_MAX_TOKENS` (default ~500) split into paragraph sub-chunks inheriting the same `headingPath`.

#### Strategy Layering & Fallback
- **D-4a-17 [ordered + reserved seam]:** `IExtractionStrategy` runs ordered Defuddle → Readability → APC-lite (§26.2). The `'servicenow-api'` strategy id is **reserved in the union but NOT implemented** — the core stays add-on-agnostic (§8.2); the ServiceNow add-on registers its strategy in Phase 8.
- **D-4a-18 [fallback threshold]:** "Low confidence" is concrete: a **min extracted-text char floor + content/boilerplate density ratio**, evaluated in the panel after Defuddle. Below threshold → Readability fallback; record `source` used. Never a bare-length heuristic.
- **D-4a-19 [fallback record]:** `extractLayered` (O.12) records `sourceUsed` + `fallbacksTried`; accepts the first strategy with usable content; on total failure throws typed `CONTENT_EXTRACT_FAILED` (never silent empty).

#### Security & Privacy
- **D-4a-20 [password omission at capture]:** `isPassword ⇒ value omitted` is enforced **at capture** in the content-script AxDomWalker via `FormControlSchema.refine` (Appendix C) — never captured, not merely redacted later. Invariant test lives in `tests/isolation/`.
- **D-4a-21 [provenance metrics]:** `StrategyResult.source` + `APCLiteDocument.stats` (duration, node/char count, source, truncated) are the **only** metrics → Diagnostics (§4.5). No raw page body persisted; everything redacted first (R-10).

#### Error Codes & Test Hygiene
- **D-4a-22 [canonical error code]:** `CONTENT_EXTRACT_FAILED` is the canonical code (spec §16 state code, line ~3270). O.12's `EXTRACTION_FAILED` is non-canonical — **drop it**. Reconcile the existing `CONTENT_EXTRACT` per the W-1 gate (canonicalize into spec Appendix C.2 + `src/core/error/errorCodes.ts` before shipping, GR-9). Every catch/debugLog uses a registered code.
- **D-4a-23 [isolation-test name]:** Canonical filename is `tests/isolation/no-content-script-ui.test.ts` (already §18/§24-named). **Retire the `check-content-bundle.mjs` name** — fold its logic into the named test / rename the helper (exact mechanics = agent discretion).
- **D-4a-24 [shared golden fixtures]:** Golden HTML fixtures for `DefuddleStrategy` / `ApcLiteStrategy` / `PageIndexBuilder` live in **one shared `tests/fixtures/` module** (not duplicated per test) — the extraction regression guard is shared.

### the agent's Discretion
- Exact min char floor + content/boilerplate density ratio constants for the D-4a-18 fallback threshold.
- Exact base-URL stamp shape (absolute `<base href>` vs sibling field) for D-4a-08.
- Exact defaults/units for `PAGE_HTML_MAX_BYTES` (~2 MB), `PAGE_CACHE_MAX_TABS` (20), `INDEX_CHUNK_MAX_TOKENS` (~500) — researcher/planner pins + documents in Appendix C.
- How the `check-content-bundle.mjs` logic folds into the canonical `.ts` isolation-test name (rename vs inline).
- How `WorkspaceStore.currentPageContext` write flows through the primary-writer election precisely.
- `verify:phase-4a` script shape — follow the §24 chain (eslint + prettier + tsc + wxt build + vitest run + isolation check), targeting `tests/core/extraction/**` + the isolation suite.

### Deferred Ideas (OUT OF SCOPE)
- `get-page-content` tool + non-active pinned-tab extraction via `executeScript` → Phase 8 (D-4a-*; item 13)
- top-k / `compressionApplied:'topk'` model feed → Phase 4b (CTX-01/02; item 14)
- ServiceNow API-first strategy registration (id reserved in 4a) → Phase 8 (item 7)
- Chunked envelope transfer protocol → only if real pages hit `PAGE_HTML_MAX_BYTES` (D-4a-09)
- Browser automation / geometry population → v2 (§26.7, D-4a-13)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Content scripts extract `{title, url, text, metadata}` via defuddle (readability fallback, turndown APC-lite) | defuddle@0.6.6 core API verified; **critical finding**: browser bundle does NOT convert to markdown → turndown@7.2.4 required in panel (PageContentSerializer). Readability@0.5.0 verified (charThreshold 500 = D-4a-18 floor reference). APC-lite schema verbatim in Appendix C. |
| CAT-02 | SPANavigationWatcher + PageContextBridge deliver page context to side panel/standalone | `wxt:locationchange` verified present in installed wxt 0.19.29 (`ctx.addEventListener(window, 'wxt:locationchange', ({newUrl}) => …)`); PageContextBridge extension path identified (MessageType additions are canonical, Pitfall 5). |
| CAT-03 | TraceRedactor applied to DOM-embedded sensitive values | TraceRedactor@src/core/security verified (REDACTION_PATTERNS); **panel-side only** (D-4a-10) — content script never imports it; `isPassword ⇒ value omitted` enforced at capture via `FormControlSchema.refine` (D-4a-20). |
| CAT-04 | ISOLATED world by default; MAIN world only for domain-specific globals | `core.content.ts` already `world: 'ISOLATED'`, `<all_urls>`, `document_idle`; isolation gate tokens verified (`FORBIDDEN_TOKENS` in current bundle checker). |
| CAT-05 | Content bundle under 50 KB; extraction is non-blocking | Measured current bundle: 174 KB raw but **21 KB payload** (inline sourcemap inflates 8× — the size assertion MUST strip the sourcemap). Defuddle/minisearch/turndown stay panel-side. Non-blocking: `document_idle` + async + 5 s AbortController. |

</phase_requirements>

## Summary

Phase 4a turns the Phase-1 extraction-only skeleton into the full PageContentService pipeline. The architecture is fully locked by CONTEXT.md (D-4a-01…24); this research verifies the library APIs, the WXT SPA-nav mechanism, the bundle-size math, and the panel-side test strategy so the planner can write precise tasks.

**The single most important finding:** `defuddle@0.6.6` (what spec's `^0.6` resolves to) is a webpack UMD core bundle whose **`markdown`/`separateMarkdown` options are no-ops** — the markdown conversion code lives only in `defuddle/node`, which requires jsdom and is unusable in the browser panel. Therefore the panel pipeline must be: `DOMParser → defuddle core (clean HTML) → turndown (markdown)`. Turndown is already in the approved stack (spec §7) and CAT-01 explicitly names "turndown APC-lite" — this research confirms turndown is also the HTML→markdown engine for the Defuddle path, not just APC-lite. `defuddle@0.6.6` also has **no `useAsync` option** (added in later versions), so at the pinned version Defuddle performs zero network calls — privacy-safe (R-10); a future upgrade must set `useAsync: false`.

**Second finding:** the current content bundle `core.js` is 174 KB raw but only 21 KB of actual payload — the wxt vite config sets `sourcemap: 'inline'`, inflating every bundle ~8×. The "keep < 50 KB assertion" (D-4a-23) must strip the inline sourcemap before measuring, otherwise the gate fails on a technically-clean bundle. There is ~29 KB headroom for AxDomWalker + serializer + SPANavigationWatcher, all dependency-free.

**Third finding:** `wxt:locationchange` is verified present in the installed wxt 0.19.29 — a namespaced window event (`${runtime.id}:${entrypoint}:wxt:locationchange`) with `{newUrl, oldUrl}`, registered via `ctx.addEventListener(window, 'wxt:locationchange', handler)` which auto-cleans on context invalidation. The SPANavigationWatcher must use `ctx.addEventListener`, and tests must dispatch the same namespaced event name.

**Primary recommendation:** Pin `defuddle@^0.6.6`, `@mozilla/readability@^0.5.0`, `turndown@^7.2.4` (+`@types/turndown@^5.0.6` — turndown 7 ships no bundled types), `minisearch@^7.2.0`. Build the panel pipeline as Defuddle→(threshold)→Readability→(actionable)→APC-lite with `extractLayered` (O.12, minus the non-canonical `EXTRACTION_FAILED` — use `CONTENT_EXTRACT_FAILED` per D-4a-22). Reconcile `CONTENT_EXTRACT`→`CONTENT_EXTRACT_FAILED` in `errorCodes.ts` before shipping (W-1 gate).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Live page context (title/url/meta) | Content script (ISOLATED) | PageRegistry (content-side) | D-16 skeleton already does this; always-on, tiny payload |
| DOM pre-strip + serialize to HTML string | Content script (ISOLATED) | — | R-5 extraction-only; dependency-free bundle (D-4a-07) |
| Password omission at capture | Content script (AxDomWalker) | FormControlSchema.refine (panel validation) | D-4a-20: never captured, enforced at capture + validated at boundary |
| DOMParser + layered extraction (Defuddle→Readability→APC-lite) | Side Panel / Standalone view | PageContentService (core) | R-3: heavy libs live panel-side only; §26.4 |
| HTML→markdown conversion | Side Panel / Standalone view | turndown (PageContentSerializer) | defuddle browser bundle can't convert (verified); turndown is approved stack |
| Per-tab cache + LRU eviction | Side Panel / Standalone view | PageContentCache (core) | In-memory only, never persisted (§26.5) |
| Ephemeral MiniSearch index | Side Panel / Standalone view | PageIndexBuilder (core) | Lazy per-tab; zero cost unless queried (D-4a-15) |
| SPA-nav / tab-update invalidation | Content script (`wxt:locationchange`) + background (`tabs.onUpdated`) | PageContentCache invalidation | D-4a-01 hybrid trigger; background forwards envelope only, never extracts (R-3) |
| Redaction before index/log | Side Panel / Standalone view | TraceRedactor (existing, R-10) | D-4a-10 panel-side only; content bundle stays dependency-free |
| Cross-surface delivery | Side Panel / Standalone view (primary-writer) | BroadcastBus (secondary mirrors) | §13 primary-writer election; no new coordination path (D-4a-05) |
| Model-facing feed | — (unplugged) | Phase 4b | D-4a-06: `ContextOptimizerInput.pageContext` stays disconnected |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| defuddle | ^0.6.6 (resolves 0.6.6; latest 0.19.2) | Primary main-content extraction → clean HTML | Spec §7 approved; spec §26.4 mandates Defuddle in panel; kepano's Obsidian Web Clipper engine, MIT, ~411 K/wk downloads, zero runtime deps |
| @mozilla/readability | ^0.5.0 (latest 0.6.0) | Fallback extraction (Firefox Reader View engine) | Spec §7 approved; §26.2 layered fallback; Apache-2.0, ~2.8 M/wk |
| turndown | ^7.2.4 (resolves 7.2.4) | HTML → Markdown (Defuddle HTML + APC-lite HTML) | Spec §7 approved; CAT-01 "turndown APC-lite"; **required for Defuddle path too** (verified: defuddle browser bundle cannot convert) |
| minisearch | ^7.2.0 | Ephemeral per-tab full-text index | Spec §7 approved; §26.5; MIT, ~2 M/wk, zero deps, ES9 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/turndown | ^5.0.6 | Type declarations for turndown (v7 ships **no** bundled .d.ts) | devDependency; verify API compat at install (v7 API stable per releases, but types are 5.x) |
| zod | ^3.25.76 (already installed) | RawNode/APCLiteNode/APCLiteDocument schema validation; `FormControlSchema.refine` password invariant | Already in stack; Appendix C types are zod-first |
| dompurify | ^3.4.13 (already installed) | Sanitize extracted HTML before any render (Readability security note) | Readability docs explicitly recommend DOMPurify on output; PortableMarkdown already wraps XMarkdown + sanitize |

**Installation:**
```bash
pnpm add defuddle@^0.6 @mozilla/readability@^0.5 turndown@^7 minisearch@^7
pnpm add -D @types/turndown@^5
```

**Version verification (2026-08-12):**
```bash
npm view defuddle version            # 0.19.2 (spec pins ^0.6 → 0.6.6, published 2025-08-14)
npm view @mozilla/readability version # 0.6.0 (spec pins ^0.5 → 0.5.0, published 2023-12-15)
npm view turndown version            # 7.2.4
npm view minisearch version          # 7.2.0
```
All four are **approved in spec §7 / AGENTS.md but NOT yet installed** (PROJECT.md: "approved but NOT yet installed; Phase 4a adds them, R-9"). This is the first phase to install them.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| turndown for Defuddle-path markdown | defuddle's `markdown:true` option | **defuddle's markdown option is a no-op in the browser bundle** (verified in dist source — only `defuddle/node` implements it). Using turndown is the only correct option. |
| minisearch | lunr / flexsearch / custom trie | Spec §7/§26.5 mandates minisearch; v7 API verified (addAll/search/autoSuggest, processTerm, storeFields). lunr is unmaintained; flexsearch not in approved stack (R-9). |
| Readability `isProbablyReaderable` pre-check | Always-run parse | `isProbablyReaderable` (minContentLength 140, minScore 20) is a cheap guard, but D-4a-18's threshold runs on Defuddle output — keep both: readerable-guard before Readability, threshold after Defuddle. |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| defuddle | npm | created 2025-02-27 (0.6.6: 2025-08-14; latest 0.19.2: 2026-07-22) | 411 K/wk | github.com/kepano/defuddle | SUS (flagged "too-new" on latest 0.19.2) | **Flagged** — planner adds `checkpoint:human-verify` before install (spec §7 pre-approves; verify resolves to 0.6.6) |
| @mozilla/readability | npm | 0.5.0: 2023-12-15 | 2.8 M/wk | github.com/mozilla/readability | OK | Approved |
| turndown | npm | v7.2.4: 2026-04-03 | 7.2 M/wk | github.com/mixmark-io/turndown | OK | Approved |
| minisearch | npm | 7.2.0: 2025-09-16 | 2.0 M/wk | github.com/lucaong/minisearch | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `defuddle` — the seam flags the *latest* publish (0.19.2, 2026-07-22) as too-new, but the project pins `^0.6` → 0.6.6 (published 2025-08-14, one year old, 411 K/wk, well-known kepano repo, spec §7 pre-approved). The postinstall check is clean (no postinstall script). The planner MUST still add `checkpoint:human-verify` per protocol before installing.

*Packages installed without authoritative-source verification in this session: none — all four were verified against the npm registry, package source tarballs, and official GitHub docs/READMEs.*

## Architecture Patterns

### System Architecture Diagram

```
Host Page (ISOLATED world content script — dependency-free, < 50 KB payload)
┌─────────────────────────────────────────────────────────────────────────┐
│ SPANavigationWatcher ──ctx.addEventListener(window,'wxt:locationchange')─┼──▶ invalidation signal
│   (D-4a-01; wxt 0.19.29 verified; {newUrl} event; auto-cleans on invalidate) │
│                                                                         │
│ AxDomWalker (D-4a-12)  ── walks DOM → RawNode tree (mode:'actionable')   │
│   • isPassword ⇒ value OMITTED at capture (D-4a-20, FormControlSchema)   │
│   • roles + text + interaction flags + links + tables; NO geometry (v0.1)│
│                                                                         │
│ ContentScriptHost (D-4a-07)                                              │
│   • clone document.documentElement                                      │
│   • strip script/style/noscript/svg/cross-origin-iframe/form-action     │
│   • stamp base URL (D-4a-08: <base href> or sibling field)               │
│   • serialize → single HTML string (truncate at element boundary if      │
│     > PAGE_HTML_MAX_BYTES ~2 MB, truncated:true)                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ EXTRACT_PAGE_CONTENT request/reply (RuntimeEnvelope,      │
                               │ canonical MessageType additions — Pitfall 5)
                               ▼
Side Panel / Standalone view (R-3: ALL heavy libs live here)
┌─────────────────────────────────────────────────────────────────────────┐
│ PageContentService.extract(tabId, mode)  ← coalesced per tab (D-4a-03)   │
│   single AbortController, 5 s hard cap (§22.1)                            │
│   │                                                                      │
│   ├─ mode 'default' (D-4a-14):                                           │
│   │   DOMParser(html, {baseURL stamped})                                  │
│   │   → DefuddleStrategy: new Defuddle(doc).parse() → clean HTML          │
│   │   → threshold check (D-4a-18: char floor + boilerplate density)       │
│   │   → below? ReadabilityStrategy: new Readability(clone).parse()        │
│   │   → PageContentSerializer: turndown(HTML) → markdown                  │
│   └─ mode 'actionable' (D-4a-12):                                        │
│       → ApcLiteStrategy: RawNode (from bridge) → APCLiteNode tree + stats │
│   record sourceUsed + fallbacksTried (O.12, D-4a-19)                     │
│   throw CONTENT_EXTRACT_FAILED on total failure (D-4a-22)                │
│                                                                          │
│ Result → PageContentCache (per-tab, in-memory, LRU 20, D-4a-02/04)       │
│        → TraceRedactor before ANY index/log/persist (D-4a-10, R-10)      │
│        → WorkspaceStore.currentPageContext (primary-writer, §13)         │
│        → secondary mirrors via BroadcastBus (D-4a-05)                    │
│                                                                          │
│ PageIndexBuilder (D-4a-15/16, lazy on first query):                      │
│   markdown → heading-boundary chunks (h1–h6) + "(preamble)" chunk        │
│   → MiniSearch docs {id, title, url, headingPath, sectionText}           │
│   → index-wide tabId; INDEX_CHUNK_MAX_TOKENS ~500 sub-chunking           │
│   → NEVER persisted (§26.5)                                              │
└──────────────────────────────────────────────────────────────────────────┘

Background SW (R-3 — forward-only, never extracts)
  tabs.onUpdated / tabs.onRemoved → lightweight envelope → panel invalidates cache
```

### Recommended Project Structure
```
src/
├── core/extraction/                    # NEW (§18 create-list — panel-side pipeline)
│   ├── PageContentService.ts           # orchestrator: extract(tabId, mode) + coalescing + timeout
│   ├── apcLite.types.ts                # RawNode / APCLiteNode / APCLiteDocument + Zod (Appendix C VERBATIM)
│   ├── strategies/
│   │   ├── IExtractionStrategy.ts      # StrategyInput / StrategyResult / IExtractionStrategy (C.1 VERBATIM)
│   │   ├── DefuddleStrategy.ts         # PRIMARY: defuddle core → clean HTML (markdown via serializer)
│   │   └── ApcLiteStrategy.ts          # structural/actionable: RawNode → APCLiteDocument
│   ├── PageContentSerializer.ts        # tree → markdown (turndown) / PageContext
│   ├── PageIndexBuilder.ts             # ephemeral MiniSearch over chunked markdown
│   └── PageContentCache.ts             # per-tab cache + nav invalidation + LRU
├── core/content/
│   ├── AxDomWalker.ts                  # NEW: content-script safe DOM+ARIA walker (dependency-free)
│   ├── PageContextBridge.ts            # EXTEND: canonical extraction request/reply MessageTypes
│   ├── ContentScriptHost.ts            # EXTEND: serialize + reply; wire SPANavigationWatcher
│   └── SPANavigationWatcher.ts         # NEW: wxt:locationchange → invalidation
tests/
├── core/extraction/
│   ├── PageContentService.test.ts      # §18 required
│   ├── DefuddleStrategy.test.ts        # §18 required
│   ├── ApcLiteStrategy.test.ts         # §18 required
│   └── PageIndexBuilder.test.ts        # §18 required
├── isolation/
│   └── no-content-script-ui.test.ts    # §18 required (retire check-content-bundle.mjs — D-4a-23)
└── fixtures/
    └── pageContent.ts                  # shared golden HTML fixtures (D-4a-24)
```

### Pattern 1: Layered Strategy with Recorded Fallback (O.12, D-4a-17/19)
**What:** Try strategies in fixed order; accept the first that produces usable content; record which one won and what was tried.
**When to use:** Any "try primary, degrade gracefully" pipeline where the source of truth matters for provenance.
**Example:**
```typescript
// src/core/extraction/PageContentService.ts — O.12 verbatim, adapted per D-4a-22
// (throw code EXTRACTION_FAILED → CONTENT_EXTRACT_FAILED; debugLog codes canonical).
import type { IExtractionStrategy, StrategyInput, StrategyResult } from './strategies/IExtractionStrategy';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

export interface ExtractionOutcome {
  result: StrategyResult;
  sourceUsed: StrategyResult['source'];   // provenance — which layer won
  fallbacksTried: string[];
}

export async function extractLayered(
  input: StrategyInput,
  strategies: IExtractionStrategy[],      // ordered: Defuddle → Readability → APC-lite → ServiceNow API
): Promise<ExtractionOutcome> {
  const tried: string[] = [];
  for (const s of strategies) {
    if (!s.canHandle({ url: input.url, mode: input.mode })) continue;
    try {
      const result = await s.run(input);
      if ((result.markdown && result.markdown.length > 0) || result.root) {
        return { result, sourceUsed: result.source, fallbacksTried: tried };
      }
      tried.push(s.id);
    } catch (e: unknown) {
      tried.push(s.id);
      debugLog(ERROR_CODES.CONTENT_EXTRACT_FAILED, e instanceof Error ? e.message : 'strategy error', {
        module: 'PageContentService', extra: { strategy: s.id, url: input.url },
      });
    }
  }
  // Typed failure — D-4a-22: CONTENT_EXTRACT_FAILED is canonical (§16 line ~3270);
  // O.12's bare 'EXTRACTION_FAILED' is non-canonical and MUST NOT be used.
  const err = new Error('no strategy produced content') as Error & { code: string; fallbacksTried: string[] };
  err.code = ERROR_CODES.CONTENT_EXTRACT_FAILED;
  err.fallbacksTried = tried;
  throw err;
}
```
*Source: PRODUCT_SPEC Appendix O.12 (lines 6732–6771), adapted per D-4a-22.*

### Pattern 2: Content-Script Serialization (D-4a-07/08)
**What:** The content script NEVER parses — it clones, pre-strips, stamps the base URL, and serializes one HTML string for the panel to own.
**When to use:** R-5 extraction-only content scripts; keeps the bundle dependency-free and < 50 KB while the panel does heavy parsing.
**Example (pseudo — planner writes final):**
```typescript
// inside ContentScriptHost (content side, dependency-free)
function serializeForExtraction(): { html: string; baseUrl: string; truncated: boolean } {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  // D-4a-07 strip set — script/style/noscript/svg/cross-origin iframe/form-action
  clone.querySelectorAll('script, style, noscript, svg').forEach((n) => n.remove());
  clone.querySelectorAll('iframe').forEach((n) => {
    try { if (n.contentWindow?.location.origin !== location.origin) n.remove(); }
    catch { n.remove(); } // cross-origin access throws — treat as cross-origin
  });
  // form-action removal keeps inputs but disarms submission
  clone.querySelectorAll('[formaction]').forEach((n) => n.removeAttribute('formaction'));
  const html = clone.outerHTML;
  return {
    html: html.length > PAGE_HTML_MAX_BYTES ? truncateAtElementBoundary(html, PAGE_HTML_MAX_BYTES) : html,
    baseUrl: document.baseURI, // D-4a-08 stamp (absolute, resolves relative links)
    truncated: html.length > PAGE_HTML_MAX_BYTES,
  };
}
```
**Note (D-4a-13):** geometry must NEVER be read here against the live DOM in v0.1 — it stays unset. `getBoundingClientRect` forced-layout cost is avoided entirely.

### Pattern 3: Detached-Document Extraction (panel side, D-4a-08)
**What:** The panel parses the serialized HTML with DOMParser, then stamps the base URL so both Defuddle and Readability resolve relative links correctly.
**When to use:** Any extraction from a serialized string instead of the live document.
**Example:**
```typescript
// panel side — DefuddleStrategy
import Defuddle from 'defuddle';

function parseDetached(html: string, baseUrl: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // D-4a-08: DOMParser docs have baseURI === 'about:blank'; Readability resolves
  // relative URLs via document.baseURI, so inject the real base.
  const base = doc.createElement('base');
  base.href = baseUrl;
  doc.head.prepend(base);
  return doc;
}

export class DefuddleStrategy implements IExtractionStrategy {
  id = 'defuddle' as const;
  canHandle({ mode }: { url: string; mode: 'default' | 'actionable' }): boolean {
    return mode === 'default'; // D-4a-14 gating
  }
  async run(input: StrategyInput): Promise<StrategyResult> {
    if (!input.html) throw new Error('DefuddleStrategy requires html');
    const doc = parseDetached(input.html, input.baseUrl ?? input.url);
    const defuddle = new Defuddle(doc, { url: input.url }); // url option drives site-specific extractors
    const result = defuddle.parse(); // content = clean HTML string (NOT markdown — verified)
    return {
      source: 'defuddle',
      markdown: '', // PageContentSerializer converts (turndown) — see Pattern 4
      meta: { defuddleHtml: result.content, title: result.title, wordCount: String(result.wordCount) },
      approxTokens: estimateTokens(result.content),
      truncated: false,
    };
  }
}
```
*Source: defuddle@0.6.6 dist/defuddle.d.ts + Readability README (baseURI resolution requirement).*

### Pattern 4: HTML→Markdown via turndown (PageContentSerializer)
**What:** The single serializer converts clean HTML (Defuddle or Readability output) or APC-lite HTML to markdown with a fixed turndown config.
**When to use:** Every prose path. Matches the config defuddle itself uses internally (verified in defuddle's markdown.js).
**Example:**
```typescript
// src/core/extraction/PageContentSerializer.ts
import TurndownService from 'turndown';

// Verified: identical to the config defuddle's own markdown.js uses internally
// (headingStyle atx, hr ---, bulletListMarker -, codeBlockStyle fenced,
//  emDelimiter *, preformattedCode true) — consistent markdown across layers.
const TURNDOWN_OPTIONS = {
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  preformattedCode: true,
} as const;

const turndown = new TurndownService(TURNDOWN_OPTIONS);

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}
```
*Source: turndown@7.2.4 README + defuddle@0.6.6 dist/markdown.js (config parity verified).*

### Pattern 5: Ephemeral Per-Tab MiniSearch (PageIndexBuilder, D-4a-15/16)
**What:** Chunk markdown by heading boundaries; each chunk is a MiniSearch doc with `title/url/headingPath/sectionText`; a "(preamble)" doc covers pre-heading text; index built lazily on first query and evicted with the cache.
**When to use:** Retrieval over extracted page content that must never be persisted (§26.5).
**Example:**
```typescript
import MiniSearch from 'minisearch';

// D-4a-16 doc shape: fields indexed + stored; idField defaults to 'id'
export interface PageChunk {
  id: string;               // `${tabId}:${sectionPath}:${chunkIndex}`
  title: string;
  url: string;
  headingPath: string;      // breadcrumb e.g. 'Work KB > ServiceNow > Incident'
  sectionText: string;
}

export function buildPageIndex(chunks: PageChunk[]): MiniSearch {
  const mini = new MiniSearch({
    fields: ['title', 'url', 'headingPath', 'sectionText'],
    storeFields: ['title', 'url', 'headingPath', 'sectionText'],
  });
  mini.addAll(chunks);
  return mini;
}
// query: mini.search(query, { prefix: true, boost: { title: 2, headingPath: 1.5 } })
```
*Source: minisearch@7.2.0 README (fields/storeFields/addAll/search/boost/prefix verified).*

### Anti-Patterns to Avoid
- **[defuddle `markdown:true` in the panel]:** the browser core bundle ignores it (verified in dist source — conversion only in `defuddle/node`). Output stays HTML; always route through turndown.
- **[Running defuddle/readability in the content script]:** breaks the < 50 KB bundle and Appendix G isolation (R-3/R-9). Both are panel-side only — the isolation test's forbidden-token list already includes `defuddle`.
- **[Reusing the same Document for Readability after Defuddle]:** Readability's `parse()` **mutates** the document — always pass `document.cloneNode(true)` and give each strategy its own doc (or run Readability first on a fresh clone).
- **[Measuring bundle size without stripping the inline sourcemap]:** wxt vite config sets `sourcemap: 'inline'` → a 21 KB payload appears as 174 KB. The 50 KB assertion (D-4a-23) must strip the `//# sourceMappingURL` comment before measuring, or gate on a `build: { sourcemap: false }` content-only pass.
- **[Firing `wxt:locationchange` in tests with a plain `new Event('wxt:locationchange')`]:** the real event name is namespaced (`${runtime.id}:${entrypoint}:wxt:locationchange`). Tests must dispatch via the same namespaced name (import `WxtLocationChangeEvent` from wxt internals or replicate the namespacing) or the watcher never fires.
- **[Importing turndown without @types/turndown]:** turndown 7.2.4 ships no bundled `.d.ts` (verified package.json — `types` absent); strict tsc fails without the dev dependency.
- **[Reusing the Phase-1 `PageRegistry` as the extraction cache]:** D-4a-02 mandates a NEW `PageContentCache` (registry holds live title/url context; cache holds extracted content + index, evicted together).
- **[Returning the stale entry on a read during re-extraction]:** D-4a-03 — a read after invalidation must await the in-flight promise, never serve stale.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Main-content extraction (prose) | Custom scoring/boilerplate heuristics | defuddle + @mozilla/readability | Battle-tested (Obsidian Web Clipper, Firefox Reader View); scoring/selector/standardization complexity is not replicable correctly in a phase |
| HTML → Markdown | Custom HTML-to-md converter | turndown | Escaping (lists, links, inline code) is subtle and already solved; defuddle's own markdown module uses turndown internally (verified) |
| Full-text search over chunks | Custom inverted index | minisearch | BM25-ish ranking, prefix/fuzzy, field boosting, zero deps, memory-efficient — 2 M/wk |
| SPA navigation detection | Hand-rolled history.pushState patching | wxt:locationchange (`ctx.addEventListener`) | wxt patches history + popstate + handles context invalidation cleanup; §5.6 "never polling" satisfied |
| Relative-URL resolution in detached docs | Manual regex URL rewriting | `<base href>` stamp + DOMParser | Browser-native resolution; Readability explicitly resolves via document.baseURI; zero custom URL-parsing bugs |
| Password/value omission invariant | Relying on redaction later | `FormControlSchema.refine` at capture + boundary validation | D-4a-20: never captured (privacy), not merely redacted (defense-in-depth, R-10) |

**Key insight:** every "don't hand-roll" item here is a *correctness* argument, not a convenience one — extraction scoring, markdown escaping, search ranking, and SPA-nav detection each carry edge-case complexity that a phase-sized custom implementation would get subtly wrong.

## Runtime State Inventory

> Phase 4a is a greenfield build phase (11 new files) with TWO in-scope renames of existing artifacts. Only the renamed items carry runtime state; both are code-edit, not data-migration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — PageContentCache/PageIndexBuilder are in-memory only, never persisted (§26.5) | none |
| Live service config | None — no external services, no UI-configured state | none |
| OS-registered state | None — no OS-level registrations | none |
| Secrets/env vars | None — no secret keys renamed; `np_workspace_primary` election key untouched (D-4a-05 reuses it) | none |
| Build artifacts | `src/core/error/errorCodes.ts` exports `CONTENT_EXTRACT` — renamed to `CONTENT_EXTRACT_FAILED` (D-4a-22 W-1 gate); `tests/isolation/check-content-bundle.mjs` retired in favor of `no-content-script-ui.test.ts` (D-4a-23); `verify:phase-4a` script added to package.json (§24 chain) | code edit (error code + helper rename); re-run `pnpm run verify:phase-4a` after rename |
| Code references | `CONTENT_EXTRACT` referenced in errorCodes.ts + spec Appendix C.2 Phase-1 block (line 5108); `CONTENT_EXTRACT_FAILED` already canonical at spec line 3510 | reconcile both spec + source (W-1 gate, GR-9) |

**Nothing found in category:** stored data / live config / OS state / secrets — verified by codebase inspection above.

## Common Pitfalls

### Pitfall 1: defuddle's `markdown` option silently returns HTML
**What goes wrong:** `new Defuddle(doc, { markdown: true }).parse()` in the panel returns HTML, not markdown — downstream markdown-dependent consumers (heading chunker D-4a-16, PageContext.markdown) receive HTML and index/render it wrong.
**Why it happens:** verified in defuddle@0.6.6 dist — the markdown conversion (`markdown.js` → turndown) is only wired into `defuddle/node` (which requires jsdom). The browser core bundle (webpack UMD `dist/index.js`) declares the option in types but never calls it.
**How to avoid:** always pipe Defuddle HTML through `PageContentSerializer.htmlToMarkdown` (turndown, fixed config). Never rely on the option.
**Warning signs:** `content` contains `<p>`, `<h2>` tags when markdown was requested.

### Pitfall 2: Readability mutates the document
**What goes wrong:** running Readability on the same Document the pipeline reuses (e.g., after Defuddle, or for a second attempt) leaves the doc stripped — later strategies see missing content, and Defuddle may have already cloned so results look fine until APC-lite runs on a gutted tree.
**Why it happens:** Readability's `parse()` modifies the DOM in place (official docs: "The parse() method works by modifying the DOM").
**How to avoid:** `new Readability(document.cloneNode(true)).parse()` — clone per call; treat every strategy's input document as read-only.
**Warning signs:** second extraction of the same tab returns less content than the first.

### Pitfall 3: bundle-size gate measures the inline sourcemap
**What goes wrong:** the < 50 KB assertion (D-4a-23) fails on a 174 KB file even though the payload is 21 KB — or worse, the gate is skipped and a real regression slips through.
**Why it happens:** wxt.config.ts vite block sets `sourcemap: 'inline'` for all builds; the content bundle's payload is 21 KB but the raw file is 174 KB (measured 2026-08-12).
**How to avoid:** the isolation test must strip the trailing `//# sourceMappingURL=data:...` comment before measuring (or run a `sourcemap: false` content-only pass). Assert payload < 50 KB.
**Warning signs:** raw file size ≈ 8–10× payload size.

### Pitfall 4: `wxt:locationchange` never fires in tests (namespaced event name)
**What goes wrong:** SPANavigationWatcher tests dispatch `new Event('wxt:locationchange')`; the watcher ignores it; invalidation coverage silently passes as false-green or the test hangs.
**Why it happens:** wxt namespaces the event: `getUniqueEventName('wxt:locationchange')` = `${browser.runtime.id}:${import.meta.env.ENTRYPOINT}:wxt:locationchange` (verified in node_modules/wxt/dist/client/content-scripts/custom-events.mjs).
**How to avoid:** dispatch with the namespaced name — in tests use the same runtime.id the fakeBrowser provides (`FIXED_EXTENSION_ID` fixture pattern) + the entrypoint name 'core', or extract the namespacing into a tiny helper the watcher and tests share.
**Warning signs:** invalidation test passes while production invalidation never triggers.

### Pitfall 5: importing turndown without types under strict tsc
**What goes wrong:** `tsc --noEmit` (part of `verify:phase-4a`) fails: "Could not find a declaration file for module 'turndown'".
**Why it happens:** turndown@7.2.4 has no bundled `.d.ts` (verified package.json — `types` absent); @types/turndown@5.0.6 is required as a devDependency.
**How to avoid:** `pnpm add -D @types/turndown@^5`; verify the 5.x types match the v7 API at install (v7 kept the API surface: TurndownService/options/addRule/keep/remove/use — but confirm on first typecheck).
**Warning signs:** verify fails at tsc with a module-declaration error on turndown.

### Pitfall 6: content bundle grows past 50 KB via shared chunks
**What goes wrong:** importing a "shared" module (e.g., MessageBus, OperationId) that transitively pulls a forbidden/heavy dep into the content bundle; the isolation token scan catches React/antd but raw size drifts over 50 KB.
**Why it happens:** wxt chunks shared imports; one careless `import` from a panel-only module into content-side code drags the whole graph in. Current content bundle already imports MessageBus (verified in core.js).
**How to avoid:** keep the content bundle's import graph explicit and small: AxDomWalker + serializer + SPANavigationWatcher import only dependency-free siblings (MessageType, RuntimeEnvelope types, debugLog is already there). Extend `FORBIDDEN_TOKENS` if any new lib appears; run the size assertion after every wave.
**Warning signs:** bundle payload climbs > 40 KB; new `node_modules/` tokens appear in the content bundle scan.

### Pitfall 7: stale read served during re-extraction (race)
**What goes wrong:** user navigates (SPA), cache is invalidated, a read arrives before re-extract completes, and the consumer gets the previous page's content — wrong-page answers in Chat/Summarize.
**Why it happens:** naive cache-get ignores the in-flight extraction promise.
**How to avoid:** D-4a-03 — per-tab in-flight promise map; reads await the in-flight promise; on timeout/failure → typed `CONTENT_EXTRACT_FAILED`, never silent empty.
**Warning signs:** a test that invalidates then immediately reads returns the old page.

## Code Examples

Verified patterns from official sources:

### Common Operation 1: Defuddle parse in the panel
```typescript
// Source: defuddle@0.6.6 README + dist/defuddle.d.ts (API verified)
import Defuddle from 'defuddle';

const defuddle = new Defuddle(document, { url: 'https://example.com/article' });
const result = defuddle.parse();
console.log(result.content);     // clean HTML string (NOT markdown — verified)
console.log(result.title);       // article title
console.log(result.author);      // author
console.log(result.wordCount);   // word count (candidate for D-4a-18 density metric)
console.log(result.schemaOrgData);
```

### Common Operation 2: Readability fallback on a clone
```typescript
// Source: @mozilla/readability@0.5.0 README + index.d.ts (verified)
import { Readability } from '@mozilla/readability';

const documentClone = document.cloneNode(true) as Document; // parse() mutates — ALWAYS clone
const article = new Readability(documentClone, { charThreshold: 500 }).parse();
if (article) {
  console.log(article.title, article.textContent, article.length);
  // article.content = HTML string → turndown → markdown
}
```

### Common Operation 3: turndown HTML → markdown
```typescript
// Source: turndown@7.2.4 README (verified)
import TurndownService from 'turndown';

const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
const markdown = turndownService.turndown('<h1>Hello world!</h1>');
// => '# Hello world!'
```

### Common Operation 4: MiniSearch build + query
```typescript
// Source: minisearch@7.2.0 README (verified)
import MiniSearch from 'minisearch';

const miniSearch = new MiniSearch({
  fields: ['title', 'sectionText'],                 // fields to index
  storeFields: ['title', 'url', 'headingPath'],     // fields returned with results
  searchOptions: { prefix: true, boost: { title: 2 } },
});
miniSearch.addAll(chunks);
const results = miniSearch.search('incident workaround');
// results[0] => { id, score, match, title, url, headingPath }
```

### Common Operation 5: wxt:locationchange SPA-nav detection
```typescript
// Source: wxt.dev/guide/essentials/content-scripts.html + installed wxt 0.19.29
// types (verified: WxtWindowEventMap extends WindowEventMap with
// 'wxt:locationchange': WxtLocationChangeEvent {newUrl, oldUrl}).
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main(ctx) {
    // ctx.addEventListener auto-removes the listener on context invalidation —
    // NEVER use window.addEventListener directly here (leak + invalidated context).
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      // newUrl is the post-navigation URL — mark cache stale / re-extract if subscribed
      console.log('SPA navigated to', newUrl);
    });
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Readability-only extraction (single engine) | Layered Defuddle→Readability→APC-lite with recorded fallback | spec §26.2 (this phase) | Better prose quality (Defuddle more forgiving, §26.2) + structural path for agents |
| Content script parses the DOM (pre-MV3 era) | Content script serializes HTML only; panel parses via DOMParser | spec §26.4 + R-3 | < 50 KB bundle preserved; heavy libs panel-side; MV3 isolation respected |
| Extraction libs not yet installed | defuddle/readability/turndown/minisearch installed this phase | spec §7 (this phase) | First phase installing the four approved-but-uninstalled libs (R-9) |
| SPA detection via MutationObserver/polling | `wxt:locationchange` (history API patch + popstate, event-driven) | wxt 0.19.29 (installed) | §5.6 "never polling" satisfied; auto-cleans on context invalidation |
| Defuddle `markdown:true` option | turndown HTML→markdown in the panel | defuddle 0.6.6 architecture (verified) | The option is a no-op in the browser bundle; turndown is the real converter |
| `EXTRACTION_FAILED` (O.12) | `CONTENT_EXTRACT_FAILED` (spec §16 canonical) | D-4a-22 (this phase) | Single canonical code; W-1 gate reconciles errorCodes.ts + spec C.2 |

**Deprecated/outdated:**
- `check-content-bundle.mjs`: retired per D-4a-23 — logic folds into `tests/isolation/no-content-script-ui.test.ts` (§18/§24-named).
- `CONTENT_EXTRACT` error code: superseded by `CONTENT_EXTRACT_FAILED` (W-1 canonicalization, D-4a-22).
- `EXTRACTION_FAILED` (Appendix O.12): non-canonical; drop per D-4a-22.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | turndown@7.2.4 API matches @types/turndown@5.0.6 types (TurndownService/options/addRule/keep/remove/use) | Standard Stack | Strict tsc fails → planner adds a typecheck gate after install; API surface verified stable across v7 releases |
| A2 | `document.baseURI` from a stamped `<base href>` in a DOMParser doc drives Readability's relative-URL resolution | Pattern 3 | Readability might use `document.URL` instead → citations still relative; mitigation: also pass url in constructor (Readability takes only document — verify at test time with a fixture asserting absolute hrefs) |
| A3 | `PAGE_HTML_MAX_BYTES ≈ 2 MB` truncation at element boundary keeps enough content for Defuddle to extract | D-4a-09 | Extremely large pages may lose the main content if truncation lands mid-article → fallback chain still runs (Readability/APC-lite) on the truncated doc; revisit chunking only if real pages hit the cap (deferred) |
| A4 | `estimateTokens` uses a simple ~4-char/token heuristic consistent with the rest of the codebase (Phase-4 TokenBudget precedent) | Pattern 3 / D-4a-21 | Misestimate → §22.2 2,000-token webpage budget miscalibrated; 4b consumes it later — pin a constant + unit test |
| A5 | Defuddle's site-specific extractors (github/claude/chatgpt/etc., built into core bundle) do not break privacy at 0.6.6 (no network calls; `useAsync` does not exist yet) | Summary / Pitfalls | If a future defuddle upgrade adds `useAsync`, third-party fetches could exfiltrate page content → pin ^0.6 and document `useAsync:false` for any future upgrade |
| A6 | `TURNDOWN_OPTIONS` config parity with defuddle's internal markdown.js produces consistent markdown across Defuddle/Readability/APC-lite paths | Pattern 4 | If outputs diverge, heading chunking (D-4a-16) may miss boundaries on one path → the PageIndexBuilder test with golden fixtures (D-4a-24) catches this |

**If this table is empty:** N/A — 6 assumed claims documented above.

## Open Questions (RESOLVED)

1. **Exact D-4a-18 fallback threshold constants**
   - What we know: min extracted-text char floor + content/boilerplate density ratio, evaluated after Defuddle; Readability's `charThreshold` default is 500 chars.
   - What's unclear: the exact floor (500? 1000?) and the density-ratio formula (text chars / total chars? link-text ratio?).
   - Recommendation: pin `MIN_EXTRACTED_CHARS = 500` (Readability parity) + a simple `textLength / htmlLength` ratio ≥ ~0.2, exported constants + unit test (agent discretion area).
   - **RESOLVED → pinned by 04a-04:** `MIN_EXTRACTED_CHARS = 500` + `MIN_CONTENT_DENSITY = 0.2` are exported from `DefuddleStrategy.ts` and vitest-pinned (D-4a-18) — the boilerplate fixture test asserts the fallback fires.

2. **Base-URL stamp shape (D-4a-08)**
   - What we know: either an absolute `<base href>` injected panel-side, or a sibling field in the payload envelope.
   - What's unclear: which shape; whether the content script injects `<base>` into the serialized HTML string itself (string-level `insertBefore`) or sends a separate `baseUrl` field.
   - Recommendation: sibling `baseUrl` field in the payload + panel-side `<base>` injection (keeps the content bundle pure string manipulation; panel owns DOM). Planner pins in the bridge payload contract.
   - **RESOLVED → pinned by 04a-07:** `ExtractionPayload { html, baseUrl, truncated }` carries the sibling `baseUrl` field; the panel injects the `<base href>` into its detached DOMParser doc (`parseDetached`, 04a-04).

3. **How `WorkspaceStore.currentPageContext` write flows through primary-writer election**
   - What we know: D-4a-05 reuses Phase-1 §13 election (`np_workspace_primary` CAS in chrome.storage.session); `currentPageContext` is an inert field on WorkspaceState with no setter yet (verified — no `setCurrentPageContext` in WorkspaceStore).
   - What's unclear: whether the write uses `get().update(draft => { draft.currentPageContext = ctx })` (inert field, no storage serialize — D-18 active-fields list excludes it) and how the primary surface learns it IS primary.
   - Recommendation: primary surface calls `update()` with the draft write (inert, never journaled — matches D-18/§21.5); the extraction request itself arrives via PageContextBridge only on the subscribed surface. Planner details in a task.
   - **RESOLVED → pinned by 04a-08:** the default deliverContext writes via `useWorkspaceStore.getState().update(draft => { draft.currentPageContext = ctx })` — inert-field draft, never journaled/serialized (D-18/§21.5, D-4a-05); the delivery test asserts the draft write.

4. **`check-content-bundle.mjs` fold mechanics (D-4a-23)**
   - What we know: retire the `.mjs` name; logic folds into `no-content-script-ui.test.ts` (rename vs inline = agent discretion).
   - What's unclear: keep `execFileSync` wrapper over a renamed helper, or move the bundle-scan into the vitest test body.
   - Recommendation: rename the helper to `tests/isolation/content-bundle-scan.ts` (or inline) so the §24 verify chain + vitest both exercise one implementation; keep the size assertion sourcemap-stripped (Pitfall 3).
   - **RESOLVED → pinned by 04a-09:** inline the walker + FORBIDDEN_TOKENS/BACKGROUND_FORBIDDEN_TOKENS into the canonical `tests/isolation/no-content-script-ui.test.ts` body (single enforcement point); the `.mjs` name is retired and all six verify scripts drop its call.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build/test runtime | ✓ | v24.18.1 | — |
| pnpm | install/verify | ✓ | 11.18.0 | npm 12.0.2 |
| wxt | content-script build + wxt:locationchange | ✓ | ^0.19.29 pinned (installed) | — |
| vitest | test suite | ✓ | (existing config, jsdom-align env, threads pool) | — |
| fakeBrowser (wxt/testing) | bridge/event tests | ✓ | (existing, Phase-1 pattern) | — |
| chrome.tabs (onUpdated/onRemoved) | invalidation triggers | ✓ (MV3 manifest already has `tabs` permission) | — | — |
| defuddle / @mozilla/readability / turndown / minisearch | extraction pipeline | ✗ NOT installed yet | ^0.6 / ^0.5 / ^7 / ^7 | none — this phase installs them (R-9, spec §7 pre-approved) |
| Chrome (manual smoke) | verify SPA-nav in a real browser | ✗ (not exercised by automated tests) | — | wxt dev-mode manual check; automated coverage via namespaced-event unit tests |

**Missing dependencies with no fallback:**
- The four approved libraries — this phase's first action is `pnpm add` (Wave 0); the pipeline cannot build without them.

**Missing dependencies with fallback:**
- Real-browser SPA-nav verification — automated unit tests (namespaced `wxt:locationchange` dispatch) cover the logic; a manual `wxt dev` smoke is recommended at the phase gate but not blocking (existing `verify:e2e-phase-1` pattern).

## Validation Architecture

> `workflow.nyquist_validation: true` (config.json) — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing; config: `tests/environments/jsdom-align.ts` default, `threads` pool, `tests/setup.ts`) |
| Config file | vitest.config.ts (existing) |
| Quick run command | `pnpm vitest run tests/core/extraction tests/isolation` |
| Full suite command | `pnpm run verify:phase-4a` (new script: `eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && <isolation check>`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | DefuddleStrategy extracts clean HTML→markdown from golden HTML fixtures | unit | `pnpm vitest run tests/core/extraction/DefuddleStrategy.test.ts -x` | ❌ Wave 0 |
| CAT-01 | Readability fallback triggers below threshold; `sourceUsed` recorded | unit | `pnpm vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ Wave 0 |
| CAT-01 | ApcLiteStrategy builds APCLiteDocument from RawNode (schema-validated) | unit | `pnpm vitest run tests/core/extraction/ApcLiteStrategy.test.ts -x` | ❌ Wave 0 |
| CAT-02 | SPANavigationWatcher fires invalidation on namespaced wxt:locationchange | unit | `pnpm vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ Wave 0 |
| CAT-02 | PageContextBridge request/reply roundtrip with canonical MessageTypes | unit | (extend existing `tests/core/content/` suite or PageContentService.test.ts) | ❌ Wave 0 |
| CAT-03 | Password value omitted at capture (isPassword ⇒ value undefined) | unit (isolation dir per D-4a-20) | `pnpm vitest run tests/isolation/no-content-script-ui.test.ts -x` | partial — bundle-token test exists; password invariant test new |
| CAT-04 | Bundle contains no React/AntD/defuddle/yaml/turndown/minisearch tokens | integration (build-gated) | `pnpm vitest run tests/isolation/no-content-script-ui.test.ts -x` | ✅ existing (extends D-4a-23) |
| CAT-05 | Content payload < 50 KB (sourcemap-stripped) | integration (build-gated) | `pnpm vitest run tests/isolation/no-content-script-ui.test.ts -x` | ❌ size assertion new |
| CAT-05 | Coalescing: concurrent extracts dedup; read-after-invalidate awaits in-flight | unit | `pnpm vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ Wave 0 |
| CAT-05 | LRU eviction cap + order deterministic; pinned/in-flight never evicted | unit | `pnpm vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ Wave 0 |
| D-4a-16 | PageIndexBuilder heading chunking + "(preamble)" + headingPath | unit | `pnpm vitest run tests/core/extraction/PageIndexBuilder.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/core/extraction tests/isolation`
- **Per wave merge:** full `pnpm run verify:phase-4a`
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/fixtures/pageContent.ts` — shared golden HTML fixtures (D-4a-24): one fixture set reused by DefuddleStrategy / ApcLiteStrategy / PageIndexBuilder tests
- [ ] `tests/core/extraction/PageContentService.test.ts` — orchestrator, coalescing, timeout, fallback chain, eviction, currentPageContext write
- [ ] `tests/core/extraction/DefuddleStrategy.test.ts` — golden fixture → clean HTML → markdown (turndown), base-URL stamp
- [ ] `tests/core/extraction/ApcLiteStrategy.test.ts` — RawNode → APCLiteDocument, stats, password invariant via FormControlSchema.refine
- [ ] `tests/core/extraction/PageIndexBuilder.test.ts` — heading chunking, "(preamble)", headingPath, sub-chunking over INDEX_CHUNK_MAX_TOKENS
- [ ] `tests/isolation/no-content-script-ui.test.ts` — extend: sourcemap-stripped < 50 KB assertion + password-omission invariant (D-4a-20) + retire `.mjs` (D-4a-23)
- [ ] Framework install: `pnpm add defuddle@^0.6 @mozilla/readability@^0.5 turndown@^7 minisearch@^7 && pnpm add -D @types/turndown@^5`
- [ ] `verify:phase-4a` script in package.json (§24 chain + isolation)

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` (config.json) — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth in this phase) |
| V3 Session Management | no | — (no sessions; cookies are Phase-8 ServiceNow add-on) |
| V4 Access Control | no | — (no user roles/permissions) |
| V5 Input Validation | yes | zod schemas on every boundary: RawNode/APCLiteNode/APCLiteDocument (Appendix C), StrategyInput/Result, FormControlSchema.refine password invariant, payload envelope validation |
| V6 Cryptography | no | — (no new crypto; vault is Phase-2) |
| V10 Malicious Code | yes | content-bundle isolation gate (Appendix G tokens), DOMPurify on any rendered extracted HTML |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Password/sensitive input capture | Information Disclosure | `isPassword ⇒ value omitted` at capture in AxDomWalker (D-4a-20) + FormControlSchema.refine at the zod boundary; never merely redacted later |
| DOM-embedded secrets (JSESSIONID, API keys) leaking to index/log | Information Disclosure | TraceRedactor (existing REDACTION_PATTERNS) runs panel-side before ANY index/log/persist (D-4a-10, R-10) |
| Malicious page content reaching the model (prompt injection) | Spoofing | Out of scope for 4a — trust/authority labeling + quarantine is Phase 4b (TRUST-01/02); 4a only delivers to cache/index, never to the model (D-4a-06) |
| Host-page XSS / DOM clobbering via extracted HTML | Tampering | Content is always parsed in the panel's isolated DOMParser doc (never innerHTML into a live page); any UI render of extracted HTML passes DOMPurify (approved stack, PortableMarkdown precedent); content script never mounts UI (R-5) |
| Third-party network exfiltration via extraction lib | Information Disclosure | defuddle@0.6.6 has no `useAsync` (verified — zero fetch code in dist); future upgrades MUST set `useAsync:false` (A5) |
| Bundle smuggling (React/AntD/yaml/defuddle/minisearch/turndown in content script) | Tampering / Spoofing | Appendix G isolation test: forbidden-token scan + size gate; R-3/R-9 enforcement |

## Sources

### Primary (HIGH confidence)
- [defuddle@0.6.6 npm tarball] — dist source inspected: API (DefuddleOptions/Response d.ts), markdown no-op in browser bundle, extractors, no useAsync
- [@mozilla/readability@0.5.0 npm tarball] — index.d.ts + Readability.js: parse options, charThreshold 500, isProbablyReaderable, mutation caveat
- [turndown@7.2.4 npm tarball] — lib/ dist: API surface, no bundled types, domino browser-field mapping
- [minisearch@7.2.0 npm tarball] — dist/es/index.d.ts: MiniSearchOptions (fields/storeFields/extractField/processTerm/idField)
- [wxt.dev/guide/essentials/content-scripts.html] — wxt:locationchange usage + ctx.addEventListener semantics
- [installed wxt 0.19.29 node_modules] — custom-events.mjs (namespacing), content-script-context.d.ts (WxtWindowEventMap)
- [PRODUCT_SPEC_v0_1.md] — §18 Phase 4a (2704–2740), §26 (3745–3817), §22.1/§22.2 (3555–3600), §5.6 (985–1004), §4.4 (780–818), Appendix C.1 (4360–4701), Appendix C.2 (3505–3515, 5098–5115), O.12 (6725–6771), §13 (1784+), §16/§20.7 (3260–3290)
- [CONTEXT.md / DISCUSSION-LOG.md] — locked decisions D-4a-01…24 + discretion areas

### Secondary (MEDIUM confidence)
- [kepano/defuddle README] — usage + response shape (cross-checked against tarball)
- [mozilla/readability README] — security note (DOMPurify), baseURI resolution note
- [mixmark-io/turndown README + releases] — options table, rules, v7 rewrite notes
- [lucaong/minisearch README] — usage/options (cross-checked against d.ts)
- [registry.npmjs.org] — versions, publish dates, downloads, postinstall checks

### Tertiary (LOW confidence)
- None — all factual claims verified against package source or official docs this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — four library APIs verified against package tarballs + official docs; versions pinned
- Architecture: HIGH — locked by CONTEXT.md (D-4a-01…24); pipeline shape verified against library capabilities
- Pitfalls: HIGH — defuddle markdown no-op, Readability mutation, sourcemap inflation, event namespacing all confirmed by direct inspection

**Research date:** 2026-08-12
**Valid until:** 2026-08-19 (fast-moving: defuddle/turndown publish frequently; spec-pinned versions stable)
