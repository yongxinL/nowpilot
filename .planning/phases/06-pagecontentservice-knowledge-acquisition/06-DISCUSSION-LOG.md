# Phase 6: PageContentService (Knowledge Acquisition) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-29
**Phase:** 6-PageContentService (Knowledge Acquisition)
**Mode:** `--auto` (autonomous — agent selected all gray areas + recommended options; no interactive prompts)
**Areas discussed:** Defuddle panel-side spike, strategy set, create-only scope, PageContext supersession, envelope wiring, content-script evolution, MiniSearch index ownership, extraction lifecycle/cache, redaction/privacy, timeout/errors, verification gate

---

## Defuddle panel-side spike (SPIKE-P6-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Spike in Phase-6 research; ADR flips Accepted on acceptable fidelity | Run SPIKE-P6-01 during planning research; detached-doc Defuddle on ServiceNow corpus; default expectation acceptable → ADR Accepted; only if material computed-style dependency → thin content-script measurement pass | ✓ (recommended) |
| Defer spike, assume detached doc works | Skip the spike; risky (VAI-01 / ADR explicitly pending) | |

**User's choice:** `--auto` — recommended option (D-79).

## Strategy set

| Option | Description | Selected |
|--------|-------------|----------|
| DefuddleStrategy + ApcLiteStrategy only; Readability internal fallback; servicenow-api reserved | Per §26.2 + "two enums" Appendix note (4688-4693); Phase 17 registers ServiceNow | ✓ (recommended) |
| Separate ReadabilityStrategy file | Contradicts the Appendix note — rejected | |

**User's choice:** `--auto` — recommended option (D-80).

## Create-only scope

| Option | Description | Selected |
|--------|-------------|----------|
| Create-only extraction layer (D-69 analog); no pipeline wiring | §18 inventory + required tests; no tool registration, no surface UI, no ContextOptimizer adoption | ✓ (recommended) |
| Wire into live chat/agent now | Out of phase scope — consumers are Phase 7/15/18 | |

**User's choice:** `--auto` — recommended option (D-81).

## PageContext supersession

| Option | Description | Selected |
|--------|-------------|----------|
| src/core/content/PageContext.ts canonical; context/types re-exports | D-72 re-export precedent; ContextOptimizer import keeps resolving | ✓ (recommended) |
| Keep placeholder in context/types.ts | Leaves the Phase-5 supersession point unresolved | |

**User's choice:** `--auto` — recommended option (D-83).

## Envelope wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Wire D-15 declared types (producer + consumer); BackgroundRouter stays stateless | Content script sends PAGE_HTML_PAYLOAD; PageContextBridge/PageContentService consume; extraction flows content-script → surface | ✓ (recommended) |
| Register handlers in BackgroundRouter | Violates §5.1 stateless-background rule | |

**User's choice:** `--auto` — recommended option (D-84).

## Content-script evolution

| Option | Description | Selected |
|--------|-------------|----------|
| core.content.ts stays thin; logic in src/core/content shells | ContentScriptHost/SPANavigationWatcher/PageContextBridge/AxDomWalker; pre-stripped clone + baseUrl + 2MB cap | ✓ (recommended) |
| Grow core.content.ts directly | Against §18 create-list shape; worse isolation greps | |

**User's choice:** `--auto` — recommended option (D-85).

## MiniSearch index ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Install minisearch ^7; PageIndexBuilder ephemeral page index; no Phase-8 wrapper | §26.5 verbatim; selectRelevant + topk; notes wrapper is Phase 8 | ✓ (recommended) |
| Create src/core/search/MiniSearchIndex.ts now | Phase-8 ownership — rejected | |

**User's choice:** `--auto` — recommended option (D-87).

## Extraction lifecycle + cache

| Option | Description | Selected |
|--------|-------------|----------|
| PageContentCache implements §26.4a verbatim; subscription API declared; surface wiring deferred | LRU cap 20, invalidation, coalescing, subscription-gated auto re-extract | ✓ (recommended) |
| Wire surface subscribers now | No surfaces exist — Phase 7/15 | |

**User's choice:** `--auto` — recommended option (D-88/D-89).

## Redaction / privacy

| Option | Description | Selected |
|--------|-------------|----------|
| TraceRedactor panel-side before indexing/logging; content script strips markup + omits passwords only | §26.6; FormControlSchema.refine enforces password omission | ✓ (recommended) |
| Redact content-script-side | Contradicts §26.6 (content bundle stays core-dep-free) | |

**User's choice:** `--auto` — recommended option (D-90).

## Timeout / errors

| Option | Description | Selected |
|--------|-------------|----------|
| 5 s AbortController + typed CONTENT_EXTRACT_FAILED; never silent empty | §26.6 / Appendix C.2 closed set | ✓ (recommended) |
| Fall back to empty PageContext silently | Violates DONE-when | |

**User's choice:** `--auto` — recommended option (D-91).

## Verification gate

| Option | Description | Selected |
|--------|-------------|----------|
| Re-point verify:phase-6 to §18 test dirs + reconcile verify:phase-4a | D-68/D-78 precedent; new no-content-script-ui test extends isolation-grep style | ✓ (recommended) |
| Leave gate mis-pointed at telemetry | Gate would pass vacuous / wrong phase — rejected | |

**User's choice:** `--auto` — recommended option (D-92).

---

## the agent's Discretion

- Exact Defuddle detached-doc spike harness + fidelity metric.
- PageContentService per-surface singleton vs factory.
- `src/core/extraction/` barrel vs one-file-per-§18-name.
- PageIndexBuilder direct minisearch vs thin internal wrapper.
- Redaction call-site (PageContentService vs PageContentCache write path).
- DefuddleStrategy low-confidence heuristic threshold for Readability fallback.

## Deferred Ideas

- Live get-page-content tool registration → Phase 18 (TOL-01).
- Surface UI extraction triggers → Phase 15.
- Trust metadata + context receipts (CTX-01…06) → Phase 7.
- Live pageContext → ContextOptimizer.assemble → Phase 7.
- Persistent notes MiniSearch wrapper → Phase 8.
- ServiceNow Table-API strategy → Phase 17.
- Browser automation + APCLiteNode geometry → v2.
- Diagnostics surfacing of extraction metrics → Phase 11.
- Add-ons / /research consuming PageContentService → Phase 17.