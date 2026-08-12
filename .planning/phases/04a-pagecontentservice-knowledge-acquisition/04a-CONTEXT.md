# Phase 4a: PageContentService (Knowledge Acquisition) - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase turns the Phase-1 extraction-only skeleton into the real **PageContentService** pipeline (spec §26, §18 Phase-4a create-list). The content script stays tiny — it clones + pre-strips the DOM and serializes one HTML string (never mounts UI, never imports React/AntD/defuddle/yaml, < 50 KB, R-5). The **Side Panel / Standalone view** owns the heavy work: `DOMParser` → layered extraction (Defuddle primary → Readability fallback → APC-lite structural walk), per-tab `PageContentCache`, ephemeral per-tab MiniSearch index (`PageIndexBuilder`), SPA-nav + tab-update invalidation. Passwords are omitted **at capture** (`isPassword ⇒ value omitted`, `FormControlSchema.refine`); TraceRedactor runs panel-side before index/log (CAT-03, R-10).

**Scope authority (G0):** Spec-authoritative. Phase 4a = the §18 create-list verbatim (`PageContentService`, `apcLite.types`, `strategies/{IExtractionStrategy, DefuddleStrategy, ApcLiteStrategy}`, `PageContentSerializer`, `PageIndexBuilder`, `PageContentCache`, `content/{AxDomWalker, PageContextBridge, ContentScriptHost, SPANavigationWatcher}`) + the five required tests + `verify:phase-4a`. No UI, no ServiceNow logic, no tool wiring.

**Boundary notes:**
- **R-3:** Defuddle/Readability/MiniSearch run in Side Panel/Standalone ONLY — never in the content bundle (isolation test).
- **Delivery boundary:** 4a delivers extracted content to the per-tab cache + PageContextBridge + `WorkspaceStore.currentPageContext` (primary-writer) + the ephemeral index. The model-facing feed into `ContextOptimizerInput.pageContext` stays **unplugged** → Phase 4b (CTX-01/02) (D-4a-06).
- **No host-page automation in v0.1** (§26.7): `APCLiteNode` schema ships automation-ready, but AxDomWalker geometry is omitted in 4a.
- **Cost posture:** extraction is subscription-gated — fresh where the user is looking, zero extraction on the long tail of unread tabs (D-4a-01).

</domain>

<decisions>
## Implementation Decisions

### Trigger & Cache Lifecycle
- **D-4a-01 [hybrid trigger]:** Lightweight live context (title/url/meta) updates always on nav — the tiny content-bridge payload. Full extraction runs on **surface request** (Chat/Summarize/agent/quick-action). Auto re-extract after `wxt:locationchange` (SPA-nav) or `tabs.onUpdated` fires **only if a surface is subscribed to that tab**; unsubscribed tabs are mark-stale only (no proactive extraction). "Subscribed" = the panel/Standalone is active on that tab OR the tab is pinned as context (`WorkspaceState.pinnedTabs` / `currentPageContext`).
- **D-4a-02 [cache distinct from PageRegistry]:** New per-tab `PageContentCache` keyed by `tabId`, **separate** from the Phase-1 `PageRegistry` (which keeps the lightweight live title/URL context). Never persisted to IndexedDB (§26.5).
- **D-4a-03 [stale-safe coalescing]:** Coalesce concurrent extractions per tab (in-flight promise dedup by `tabId`). A read arriving after invalidation but before re-extract completes must **await the in-flight extraction** — never return the stale entry. 5 s hard cap (§22.1) + a single `AbortController` threaded through the round-trip; on timeout/failure → fallback chain, then typed `CONTENT_EXTRACT_FAILED` — never a silent empty result.
- **D-4a-04 [eviction]:** Drop a tab's cache AND its ephemeral index together on: `tabs.onRemoved`, invalidation (SPA-nav/`tabs.onUpdated`), or LRU pressure (`PAGE_CACHE_MAX_TABS`, default 20 — Appendix C constant). Recency bumped on every read/serve. Never LRU-evict an in-flight or subscribed tab; pinned tabs are eviction-last (a user-chosen pin never silently loses its cache). Test asserts the cap + eviction order deterministically.

### Cross-Surface Delivery
- **D-4a-05 [primary-writer election]:** Extraction follows the existing Phase-1 primary-writer election (§13): the primary surface extracts and writes `WorkspaceStore.currentPageContext`; the secondary mirrors via BroadcastBus. **No new coordination path.**
- **D-4a-06 [delivery boundary]:** 4a delivers to cache + PageContextBridge + `WorkspaceStore.currentPageContext` + ephemeral index ONLY. The hook→optimizer pageContext feed (`ContextOptimizerInput.pageContext`, Phase-4 structural no-op) stays unplugged → **Phase 4b** (CTX-01/02 trust-aware feed). Phase-4's D-04-02 re-pack seam trigger arrives via the 4a PageContextBridge events.

### HTML Payload & Transport
- **D-4a-07 [pre-stripped clone]:** Content script clones `document.documentElement`, removes script/style/noscript/svg/cross-origin iframe markup and form-action attributes — **keeps** text nodes, headings, links, and input controls (incl. inputs outside forms) so both Defuddle (prose) and APC-lite (structure) have what they need. Serializes the cleaned tree to a single HTML string (typical multi-MB pages shrink ~70–90 %). Runs at `document_idle`, non-blocking, inside the 5 s `AbortController` budget.
- **D-4a-08 [base-URL stamp]:** Content script stamps the page's effective base URL into the payload (absolute `<base href>` or a sibling field); the panel injects it before `new Defuddle(doc).parse()` — closes the detached-DOMParser relative-link/image gap (correct citations).
- **D-4a-09 [hard size cap]:** `PAGE_HTML_MAX_BYTES` (default ~2 MB). If the cleaned string still exceeds it, truncate at an element boundary and set `truncated: true` in provenance (§22.2) — **no chunk/assembly protocol in v0.1**. Revisit chunking only if real pages hit the cap.
- **D-4a-10 [redaction panel-side]:** TraceRedactor runs in the panel before indexing/logging (CAT-03, §26.6). The content script strips + omits only — **never imports TraceRedactor** (Appendix G isolation; the bundle stays dependency-free).

### APC-lite (Structural Path)
- **D-4a-11 [full schema now]:** Ship the complete spec'd `APCLiteNode` / `RawNode` types verbatim per Appendix C (roles, interaction, `geometry?`, link, image, form, iframe, tables) — **zero schema rework** when 4b/5/8 or v2 automation (§26.7) lands.
- **D-4a-12 [walk on actionable only]:** AxDomWalker runs only when `mode: 'actionable'` is requested. It emits roles + text + hierarchy + interaction flags (clickable/editable/focusable/disabled) + links + tables. Geometry is **omitted** in v0.1 (the field stays optional and unset).
- **D-4a-13 [geometry placement rule]:** If/when geometry is ever populated, it MUST be read in the content script against the **live DOM** — never the panel's detached DOMParser doc (which has no layout). In v0.1 it is not read at all (avoids `getBoundingClientRect` forced-layout cost; no consumer, no automation — R-5).
- **D-4a-14 [mode gating]:** `mode` defaults to `'default'` (read/summarize → Defuddle → Readability). `'actionable'` (APC-lite) is used only when an agent explicitly requests structure.

### Ephemeral MiniSearch Index
- **D-4a-15 [lazy build]:** The per-tab index is built **lazily on first `query()`**, memoized per tab, evicted with the extraction, never persisted (§26.5). Zero index cost for tabs whose content is never searched.
- **D-4a-16 [heading chunking]:** Chunk Defuddle markdown by heading boundaries (h1–h6); each MiniSearch doc has fields `title`, `url`, `headingPath` (breadcrumb, e.g. "Work KB > ServiceNow > Incident"), `sectionText`, plus an index-wide `tabId`. A synthetic **"(preamble)"** chunk covers content before the first heading (no orphaned lead text). No-heading pages fall back to paragraph-block chunks (blank-line separated) under the page title. Sections over `INDEX_CHUNK_MAX_TOKENS` (default ~500) split into paragraph sub-chunks inheriting the same `headingPath`.

### Strategy Layering & Fallback
- **D-4a-17 [ordered + reserved seam]:** `IExtractionStrategy` runs ordered Defuddle → Readability → APC-lite (§26.2). The `'servicenow-api'` strategy id is **reserved in the union but NOT implemented** — the core stays add-on-agnostic (§8.2); the ServiceNow add-on registers its strategy in Phase 8.
- **D-4a-18 [fallback threshold]:** "Low confidence" is concrete: a **min extracted-text char floor + content/boilerplate density ratio**, evaluated in the panel after Defuddle. Below threshold → Readability fallback; record `source` used. Never a bare-length heuristic.
- **D-4a-19 [fallback record]:** `extractLayered` (O.12) records `sourceUsed` + `fallbacksTried`; accepts the first strategy with usable content; on total failure throws typed `CONTENT_EXTRACT_FAILED` (never silent empty).

### Security & Privacy
- **D-4a-20 [password omission at capture]:** `isPassword ⇒ value omitted` is enforced **at capture** in the content-script AxDomWalker via `FormControlSchema.refine` (Appendix C) — never captured, not merely redacted later. Invariant test lives in `tests/isolation/`.
- **D-4a-21 [provenance metrics]:** `StrategyResult.source` + `APCLiteDocument.stats` (duration, node/char count, source, truncated) are the **only** metrics → Diagnostics (§4.5). No raw page body persisted; everything redacted first (R-10).

### Error Codes & Test Hygiene
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec (authoritative)
- `.planning/PRODUCT_SPEC_v0_1.md` §18 Phase 4a block (lines 2704–2740) — create-list (11 files), required tests (5), DONE-when (Defuddle in panel not bundle; < 50 KB; layered fallback records source; ephemeral index; SPA-nav + tabs.onUpdated invalidation; passwords never captured; `verify:phase-4a`).
- `.planning/PRODUCT_SPEC_v0_1.md` §26 "PageContentService" (lines 3745–3817) — §26.1 principle (feeds `ContextOptimizerInput.pageContext`), §26.2 layered strategy order, §26.3 `IExtractionStrategy` contract, §26.4 content-bundle constraint (Defuddle in panel), §26.5 MiniSearch ephemeral index + 2,000-token webpage budget + `compressionApplied:'topk'` (4b), §26.6 reliability/privacy (coalesce, 5 s timeout, invalidation, redaction, passwords, metrics), §26.7 automation deferred, §26.8 reference projects.
- `.planning/PRODUCT_SPEC_v0_1.md` §22.1 Performance Targets (line 3562 content bundle < 50 KB; line 3564 tab context extraction 5 s hard).
- `.planning/PRODUCT_SPEC_v0_1.md` §22.2 Context Overflow Rules (line 3581 webpage 2,000-token budget; truncation rules; `truncated: true` semantics).
- `.planning/PRODUCT_SPEC_v0_1.md` §5.6 Content Script Rules (lines 992–1004) — extraction-only; no React/UI/Shadow DOM/style injection/host-DOM writes; MutationObserver for SPA nav, never polling.
- `.planning/PRODUCT_SPEC_v0_1.md` §4.4 Redaction Rules (lines 784–814) — TraceRedactor before persist/UI/log/export; required patterns.
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 (lines 4360–4701) — `PageContext` (existing verbatim home `src/core/content/PageContext.ts`), `RawNode`/`APCLiteNode`/`APCLiteDocumentSchema`, `StrategyInput`/`StrategyResult`/`IExtractionStrategy`/`IContentStrategy`.
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.2 — error-code registry; `CONTENT_EXTRACT_FAILED` canonicalized IN PLACE (W-1 gate, GR-9).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix O.12 (lines 6732–6771) — `extractLayered` + `fallbacksTried` + guardrails; note the non-canonical `EXTRACTION_FAILED` (drop per D-4a-22).
- `.planning/PRODUCT_SPEC_v0_1.md` §16 (line ~3270) — `'CONTENT_EXTRACT_FAILED'` canonical state code.
- `.planning/PRODUCT_SPEC_v0_1.md` §2.3 + Appendix I — `ContextOptimizerInput.pageContext` seam (feed unplugged in 4a, D-4a-06).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix G (lines ~5451–5455) — content-bundle isolation rule set (React/AntD/defuddle/yaml forbidden in bundle).
- `.planning/PRODUCT_SPEC_v0_1.md` §18 Phase-3 addendum (~lines 2655–2664) — contextHelper deletion target; Phase-3 canonical type homes the 4a types extend in place (R-1).

### Project planning artifacts
- `.planning/ROADMAP.md` Phase 4a (lines 247–260) — goal, requirements CAT-01..05, success criteria (Defuddle primary/Readability fallback/APC-lite delivered to panel; passwords never captured; < 50 KB bundle; SPA-nav + tab-update invalidation; ephemeral per-tab MiniSearch searchability).
- `.planning/REQUIREMENTS.md` Phase 4a CAT-01..05 rows.
- `.planning/PROJECT.md` — core value, constraints (content bundle < 50 KB), approved stack §7 (`defuddle ^0.6`, `@mozilla/readability ^0.5`, `turndown ^7`, `minisearch ^7` — approved but NOT yet installed; Phase 4a adds them, R-9).
- `.planning/phases/04-context-adaptive-execution/04-CONTEXT.md` — D-04-02 (CTX-02 re-pack seam trigger arrives with 4a PageContextBridge), D-04-12 (pageContext degradation steps are no-ops until 4a).
- `.planning/STATE.md` — Phase-1 D-16/D-17 (ContentScriptHost/PageContextBridge extraction-only skeleton), W-7 (flat content entry path under wxt 0.19.29), Appendix G isolation enforcement.
- `AGENTS.md` — 10 golden rules, risk register (R-3 AI+IndexedDB panel/standalone only, R-5 content scripts extraction-only, R-9 approved stack, R-10 redaction), approved stack.
- `tests/isolation/no-content-script-ui.test.ts` + `tests/isolation/check-content-bundle.mjs` — existing bundle-isolation gates (extend; retire `.mjs` name per D-4a-23).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/content/PageContext.ts` — Appendix C verbatim `PageContext` (R-1 home, comment says "extraction begins in Phase 4a (D-16)"). The `html?`/`markdown?` fields get populated by 4a.
- `src/core/content/PageContextBridge.ts` — existing bridge (`EXTRACT_PAGE_CONTENT`, `PING`, `GET_CONTENT_CAPABILITIES`, `ContentCapabilities`). Extend for the extraction request/reply flow (canonical MessageType additions — Phase-1 Pitfall 5: no throwaway contracts).
- `src/core/content/ContentScriptHost.ts` — extraction-only shell (R-5). Add serialization + AxDomWalker + SPANavigationWatcher wiring; `buildLiveContext()` already produces the lightweight live context.
- `src/core/registry/PageRegistry.ts` — Phase-1 tab-keyed lightweight context map; stays distinct from the new `PageContentCache` (D-4a-02).
- `src/entrypoints/core.content.ts` — content entry at the flat path (W-7 wxt 0.19.29 glob quirk), `defineContentScript`, `document_idle`, ISOLATED. The extraction payload path extends from here.
- `src/core/security/TraceRedactor.ts` + `redactSensitive.ts` — panel-side redaction (R-10), dependency-free regex.
- `src/core/error/errorCodes.ts` + `debugLog.ts` — existing `CONTENT_EXTRACT` code to reconcile to `CONTENT_EXTRACT_FAILED` (D-4a-22); GR-9 canonical codes.
- `src/types/workspace.ts` — `currentPageContext?: PageContext` on the workspace slice — primary-writer delivery target (D-4a-05).
- `src/core/context/ContextOptimizer.ts` (`compressPageContext`) + `src/core/ai/types.ts` (`ContextOptimizerInput.pageContext`) — the Phase-4b feed seam; **unplugged in 4a** (D-4a-06).
- `tests/isolation/{no-content-script-ui.test.ts, check-content-bundle.mjs}` — bundle gate already forbids defuddle/yaml/React/AntD/idb/fflate/KeyVault/AI tokens; keep < 50 KB assertion.
- WXT auto-imports: `defineContentScript` (in use), `wxt:locationchange` event for SPA-navigation detection in content scripts (document_idle).

### Established Patterns
- **Spec-verbatim paths (§8.5/§18) + Appendix C types (R-1)** — no invented identifiers; seeded homes imported, never re-created.
- **Layered strategy + recorded fallback (O.12)** — accept first usable strategy; record `sourceUsed`/`fallbacksTried`.
- **Input-only seams (`onStreamDelta`/`onTransition` precedent)** — the 4a PageContextBridge events feed the Phase-4 D-04-02 CTX-02 re-pack seam (trigger arrives in 4a, consumer in 4b/7).
- **Primary-writer election + BroadcastBus (Phase 1, §13)** — cross-surface ownership without a new coordination path.
- **In-flight promise dedup / coalescing** — per-tab promise map (D-4a-03), stale-safe reads.
- **GR-9 canonical codes + W-1 gate** — reconcile `CONTENT_EXTRACT` → `CONTENT_EXTRACT_FAILED` before shipping.
- **verify:phase-N gate** — §24 chain (eslint + prettier + tsc + wxt build + vitest run + isolation check).

### Integration Points
- `ContentScriptHost.handleMessage` — extend `EXTRACT_PAGE_CONTENT` to serialize + reply; wire `SPANavigationWatcher` (`wxt:locationchange`) into invalidation.
- `PageContextBridge` — canonical extraction request/reply MessageTypes + payload contract (RuntimeEnvelope/ResponseEnvelope, Phase-1 Pitfall 5).
- `PageContentCache` + `PageIndexBuilder` — future consumers: Summarize, Agent `get-page-content` (Phase 8), RAG "Ask notes" (Phase 5a).
- `WorkspaceStore.currentPageContext` — primary surface writes extraction result; secondary mirrors via BroadcastBus (D-4a-05).
- Invalidation signals: `wxt:locationchange` (content-side) + `tabs.onUpdated` — the background may forward a lightweight envelope, but must NOT extract (R-3).
- Content bundle: AxDomWalker + serializer + SPANavigationWatcher stay dependency-free (< 50 KB, no React/AntD/defuddle/yaml — isolation test).

</code_context>

<specifics>
## Specific Ideas

- **Through-line (user):** Extraction is "fresh where the user is looking (subscribed), zero extraction on the long tail of unread tabs, and no stale-read race" — the hybrid trigger rationale (D-4a-01/03).
- **P4a-1:** `PAGE_CACHE_MAX_TABS = 20` default; a test asserts the cap + eviction order deterministically (D-4a-04).
- **P4a-2:** Geometry placement rule — never read geometry from the panel's detached DOMParser doc (D-4a-13).
- **P4a-3:** "(preamble)" chunk + `headingPath` breadcrumb so no leading page text is orphaned and RAG gets section precision (D-4a-16).
- **P4a-4:** Password-omission invariant test lives in `tests/isolation/` (D-4a-20).
- **P4a-5:** Items 5–15 from the user's pre-authored analysis are locked decisions (D-4a-17..24) — not open for re-litigation.

</specifics>

<deferred>
## Deferred Ideas

- **`get-page-content` tool + non-active pinned-tab extraction via `executeScript`** (Flow 4) — consumers of PageContentService → **Phase 8** (D-4a-*; item 13).
- **top-k / `compressionApplied:'topk'` model feed** (`selectRelevant` into `ContextOptimizerInput.pageContext`) — trust-aware model-facing feed → **Phase 4b** (CTX-01/02; item 14).
- **ServiceNow API-first strategy registration** — the `'servicenow-api'` id is reserved in 4a; the add-on registers the strategy → **Phase 8** (item 7).
- **Chunked envelope transfer protocol** — only if real pages hit `PAGE_HTML_MAX_BYTES`; v0.1 degrades to truncate (D-4a-09).
- **Browser automation / geometry population** — v0.1 omits geometry; automation needs `chrome.debugger` + CDP → v2 (§26.7, D-4a-13).

</deferred>

---

*Phase: 4a-PageContentService (Knowledge Acquisition)*
*Context gathered: 2026-08-12*
