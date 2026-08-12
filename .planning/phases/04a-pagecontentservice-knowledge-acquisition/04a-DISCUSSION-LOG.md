# Phase 4a: PageContentService (Knowledge Acquisition) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 4a-PageContentService (Knowledge Acquisition)
**Areas discussed:** Extraction trigger & cache lifecycle, HTML payload & transport, APC-lite depth in v0.1, Ephemeral index + optimizer feed, plus 11 user-pre-authored items (error-code/test naming, fallback threshold, ServiceNow seam, base-URL reconstruction, cross-surface ownership, concurrency/timeout, provenance metrics, password omission, tool/pinned-tab extraction, top-k model feed, centralized fixtures)

---

## Extraction trigger & cache lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand + auto re-extract on nav | Lightweight live context always; full extraction on request; auto re-extract on nav IF subscribed | ✓ |
| Auto-extract every nav | Full extraction on every SPA-nav/tab-update, proactive | |
| On-demand only | Full extraction only when asked; invalidation marks stale | |

**User's choice:** "On-demand + subscription-gated auto re-extract, with coalesced stale-safe reads." Full free-text: lightweight live context (title/url/meta) always on nav; full extraction on surface request; auto re-extract after wxt:locationchange/tabs.onUpdated only if a surface is subscribed (panel active OR pinned in WorkspaceState.pinnedTabs/currentPageContext); unsubscribed = mark-stale only. Read-after-invalidation awaits the in-flight extraction, never returns stale. 5 s cap + one AbortController; on failure → fallback → CONTENT_EXTRACT_FAILED.
**Notes:** Rationale — "matches read-only + no-MV3-background-work + cost-effective posture: fresh where the user is looking, zero extraction on the long tail of unread tabs, no stale-read race."

**Eviction (2nd question):**

| Option | Description | Selected |
|--------|-------------|----------|
| Tab-close + capped LRU | tabs.onRemoved + invalidation + PAGE_CACHE_MAX_TABS=20 LRU | ✓ |
| Tab-close only | Drop only when the tab closes | |
| You decide | Agent picks a bounded policy | |

**User's choice:** Tab-close + invalidation + capped LRU, with in-flight/subscribed guards. Extraction + index always evicted together; recency bumped on every read/serve; never persist to IndexedDB; never LRU-evict in-flight or subscribed tabs; pinned tabs eviction-last; PAGE_CACHE_MAX_TABS = 20 tunable in Appendix C; test asserts cap + eviction order.

---

## HTML payload & transport

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-stripped clone, serialized whole | Clone docElement, strip script/style/noscript/svg/cross-origin iframe/form-action, keep text/headings/links/inputs | ✓ |
| Full outerHTML as-is | Untouched serialization; panel strips | |
| Chunked envelope transfer | Multi-part ~200 KB envelope protocol | |

**User's choice:** Pre-stripped clone + base-URL stamp + hard size cap (PAGE_HTML_MAX_BYTES ~2 MB), serialized whole. Truncate at element boundary with truncated:true past the cap; no chunk protocol in v0.1 (revisit only if real pages hit the cap). Non-blocking at document_idle, inside the 5 s AbortController.
**Notes:** Inputs outside forms kept so both Defuddle (prose) and APC-lite (structure) have what they need.

**Redaction location (2nd question):**

| Option | Description | Selected |
|--------|-------------|----------|
| Panel-side, before index/log | TraceRedactor in panel; content bundle stays dependency-free | ✓ |
| Content-script, pre-send | Redactor in the constrained bundle | |
| Both ends | Maximum defense, double execution | |

**User's choice:** Panel-side, before index/log. Content script only strips + omits (passwords), never imports TraceRedactor (Appendix G).

---

## APC-lite depth in v0.1

| Option | Description | Selected |
|--------|-------------|----------|
| Full spec'd tree, walk on actionable | Full RawNode (roles/interaction/geometry/tables), walk on actionable request | ✓ |
| Structure always, geometry on-demand | Cheap walk every page; geometry computed on demand | |
| Minimal walk now, extend later | Roles/text/links/tables only | |

**User's choice:** Full APCLiteNode type + structural content-script walk, geometry omitted (not relocated). Ship the complete spec'd type verbatim (zero schema rework later); AxDomWalker runs only on mode:'actionable' and emits roles + text + hierarchy + interaction flags + links + tables; geometry omitted in v0.1 (field optional/unset). If geometry is ever populated it MUST be read against the live DOM in the content script — never the panel's detached DOMParser doc.

**RawNode timing (2nd question):**

| Option | Description | Selected |
|--------|-------------|----------|
| Walk only on actionable request | Zero AX cost on the default read path | ✓ |
| Always walk on subscribed extraction | Structure cached instantly | |
| Coarse always, full on demand | Hybrid of depth + cost | |

**User's choice:** Walk only on actionable request.

---

## Ephemeral index + optimizer feed

| Option | Description | Selected |
|--------|-------------|----------|
| Eager, per subscribed extraction | Index immediately after extraction | |
| Lazy, on first query | Index on first query(); memoized per tab | ✓ |
| Hybrid metadata now, tokenize later | Chunk metadata eager, tokenization lazy | |

**User's choice:** Lazy, on first query(); memoized per tab; evicted with the extraction; never persisted (§26.5).

**Chunking (2nd question):**

| Option | Description | Selected |
|--------|-------------|----------|
| Heading-boundary chunks | h1-h6 chunked docs | ✓ |
| Paragraph blocks | Blank-line separated chunks | |
| One doc per page | Single full-markdown doc | |

**User's choice:** Heading-boundary chunks with a preamble chunk + oversized-section paragraph fallback. MiniSearch doc fields: title, url, headingPath (breadcrumb), sectionText, tabId. "(preamble)" synthetic chunk before first heading; no-heading pages → paragraph-block chunks; sections over INDEX_CHUNK_MAX_TOKENS (~500) split into paragraph sub-chunks inheriting headingPath.

---

## User pre-authored items (5–15) — locked as answered

| # | Area | Decision |
|---|------|----------|
| 5 | Error-code + isolation-test naming | Canonical `CONTENT_EXTRACT_FAILED` everywhere (drop O.12 `EXTRACTION_FAILED`; reconcile `CONTENT_EXTRACT`); canonical test name `tests/isolation/no-content-script-ui.test.ts`, retire `check-content-bundle.mjs` name |
| 6 | Defuddle→Readability fallback | Min extracted-text char floor + content/boilerplate density ratio, evaluated in panel; below → Readability, record source; mode defaults 'default', 'actionable' only on explicit agent structure request |
| 7 | ServiceNow API-first seam | 4a defines strategy ordering + reserves 'servicenow-api' id, ships NO ServiceNow logic; add-on registers in Phase 8 |
| 8 | Defuddle base-URL reconstruction | Content script stamps effective base URL; panel injects absolute `<base>` before Defuddle.parse() |
| 9 | Cross-surface ownership | Phase-1 primary-writer election (§13); primary extracts + writes currentPageContext; secondary mirrors via BroadcastBus; no new coordination path |
| 10 | Concurrency + timeout | Coalesce per tab (in-flight promise dedup); 5 s hard cap; one AbortController; timeout → fallback → typed CONTENT_EXTRACT_FAILED, never silent empty |
| 11 | Provenance/metrics | StrategyResult.source + APCLiteDocument.stats (duration, node/char count, source, truncated) are the ONLY metrics → Diagnostics (§4.5); no raw body persisted; redacted first |
| 12 | Password omission | isPassword ⇒ value omitted at capture via FormControlSchema.refine in content-script AxDomWalker; never captured, not merely redacted; invariant test in tests/isolation/ |
| 13 | get-page-content tool | DEFER → Phase 8: tool wiring (§10.5) + executeScript pinned-tab extraction (Flow 4); 4a exposes service API only |
| 14 | top-k model feed | DEFER → 4b (CTX-01/02): ephemeral index is 4a; trust-aware model-facing feed is 4b |
| 15 | Centralized fixtures | Golden HTML fixtures in ONE shared tests/fixtures/ module, not duplicated per test |

## the agent's Discretion

- Exact fallback threshold constants (char floor + density ratio).
- Base-URL stamp shape (absolute `<base href>` vs sibling field).
- Exact defaults: PAGE_HTML_MAX_BYTES (~2 MB), PAGE_CACHE_MAX_TABS (20), INDEX_CHUNK_MAX_TOKENS (~500).
- Isolation-test mechanics (how check-content-bundle.mjs folds into the canonical .ts name).
- WorkspaceStore.currentPageContext write flow through the primary-writer election.
- verify:phase-4a script shape (§24 chain, targeting tests/core/extraction/** + isolation suite).

## Deferred Ideas

- `get-page-content` tool + executeScript pinned-tab extraction → Phase 8.
- top-k / `compressionApplied:'topk'` model feed → Phase 4b (CTX-01/02).
- ServiceNow strategy registration → Phase 8 add-on.
- Chunked envelope transfer → only if real pages hit the size cap (v0.1 truncates).
- Browser automation / geometry population → v2 (§26.7).
