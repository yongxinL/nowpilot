# Phase 4a: Page Content Extraction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 4a-page-content-extraction
**Areas discussed:** content capture strategy, execution context, layered strategy fallbacks, APC-lite walk, MiniSearch index granularity, cache & invalidation, redaction & privacy, bundle & isolation enforcement

---

## Auto Mode

Run in `--auto` mode (yolo auto-advance chain from Phase 04 transition). All gray areas auto-selected and resolved to the recommended option grounded in PRODUCT_SPEC §26 — no interactive prompts. Choices logged in CONTEXT.md D-01..D-13.

| Area | Auto-selected decision |
|------|------------------------|
| Content capture | Full-document outerHTML, size-capped, password values redacted at capture (D-01/D-02) |
| Execution context | DOMParser in side panel / full app; strategies take HTML strings (D-03/D-04) |
| Layered strategy | Defuddle primary, Readability fallback on low confidence/5s timeout (D-05) |
| APC-lite | DOMParser-based tree per Appendix C, Zod-validated, actionable mode only (D-06) |
| MiniSearch | Ephemeral per-tab index, heading-chunked, topk injection over 2,000-token budget (D-08/D-09) |
| Cache | Per-tab Map, lazy re-extraction, SPA-nav + tabs.onUpdated invalidation (D-10/D-11) |
| Redaction | Password values never captured; TraceRedactor before index/log (D-12) |
| Bundle | <50KB extraction-only content bundle, isolation test enforced (D-13) |

---

## the agent's Discretion

- Heading-chunking limits, Readability fallback thresholds, capture size caps (planner may tune within decision bounds)

## Deferred Ideas

- v2 host-page automation (chrome.debugger + CDP Input) — spec §26.7
- ServiceNow Table-API-first extraction — Phase 8 add-on
- Site-specific extraction strategies (IContextExtractor pattern) — future add-ons
