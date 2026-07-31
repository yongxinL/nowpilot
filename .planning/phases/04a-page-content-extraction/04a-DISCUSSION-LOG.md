# Phase 4a: Page Content Extraction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 4a-page-content-extraction
**Areas discussed:** Content script messaging pattern, DomSerializer naming, Total extraction failure behavior, PageContext schema, MiniSearch index scope, Index persistence, Re-extraction trigger policy, Context budget allocation

---

## Content Script Messaging Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Full RuntimeEnvelope migration | Replace all raw sendMessage calls with createEnvelope() + register handler via MessageBus | ✓ |
| Minimal: only EXTRACT_PAGE_CONTENT | Add new handling alongside existing raw messages | |

**User's choice:** Full migration to RuntimeEnvelope + MessageBus. Phase 4a is the ideal time to remove remaining ad-hoc `chrome.runtime.sendMessage` usage. SPA_NAVIGATION, EXTRACT_PAGE_CONTENT, and future page-content events all use typed RuntimeEnvelope contracts with MessageBus registration. Maintaining both styles in one file introduces unnecessary inconsistency.

**Notes:** RuntimeEnvelope is at `src/core/runtime/RuntimeEnvelope.ts` (not `src/core/events/`). MessageBus at `src/core/messaging/MessageBus.ts`. Both already exist.

---

## EXTRACT_PAGE_CONTENT Response Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| sync sendResponse in listener | Content script responds via chrome.runtime.onMessage sendResponse callback with serialized HTML | ✓ |
| Request/response envelope pair | Separate PAGE_CONTENT_EXTRACTED response envelope sent back | |

**User's choice:** Using RuntimeEnvelope request/response semantics and returning the extraction result through the standard `sendResponse` pathway already wrapped by MessageBus. EXTRACT_PAGE_CONTENT is a command expecting immediate result — single request/response exchange. SPA_NAVIGATION remains an outbound event.

---

## CONTENT_SCRIPT_READY Message

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it | No known consumers exist | ✓ |
| Keep as RuntimeEnvelope event | Convert to typed envelope for future use | |

**User's choice:** Remove CONTENT_SCRIPT_READY. No known consumers, and Phase 4a focuses on page extraction rather than lifecycle telemetry. The content script should only emit messages with active consumers. If needed for Phase 6, it can be reintroduced later.

---

## DomSerializer Naming

| Option | Description | Selected |
|--------|-------------|----------|
| Rename to DomSerializer | Clear, describes exactly what it does | ✓ |
| Rename to DomWalker | Drops misleading 'Ax' prefix | |
| Keep AxDomWalker | Keep original name | |

**User's choice:** Rename to DomSerializer. The component transforms DOM into a serialized extraction payload while applying redaction. The AX prefix strongly suggested accessibility-tree processing which is not what the implementation does.

---

## Total Extraction Failure Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Typed ExtractionError result | Discriminated union (Success | Failure) with error code + strategiesAttempted | ✓ |
| Null/degraded empty PageContext | Silent degradation with empty content | |
| Throw / reject the promise | Let errors propagate naturally | |

**User's choice:** Typed `ExtractionResult` discriminated union. PageContentService returns either a successful PageContext or a structured ExtractionError. Extraction failures are expected operational outcomes, not exceptions. Preserves diagnostic information and allows ContextAssembler/ContextOptimizer to degrade gracefully.

---

## Extraction Timeout Policy

| Option | Description | Selected |
|--------|-------------|----------|
| 5s global shared budget | Entire fallback chain shares 5s; remaining budget passed to each fallback | ✓ |
| Continue fallbacks within 5s total | Defuddle ~3s, Readability gets remaining time | |
| 5s per strategy, separate caps | Each strategy gets its own 5s | |

**User's choice:** 5-second global budget shared across the entire fallback chain. Each strategy executes with remaining available budget. If Defuddle times out at 4s, Readability gets 1s. Once global deadline reached, return TIMEOUT ExtractionError with attempted strategies.

---

## PageContext Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated by mode | DefaultModePageContext { markdown } vs ActionableModePageContext { apcLiteTree } | ✓ |
| Unified PageContext type | One type with optional fields for mode-specific data | |

**User's choice:** Discriminated union keyed by mode. Shared base metadata (url, title, capturedAt, size, source, extractionLevel, truncated, compressionApplied). Different payload per mode. Stronger typing, prevents invalid field combinations.

---

## PageContext Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Include structured metadata | Optional author, publishDate, language, description, siteName from Defuddle/OG/Schema.org | ✓ |
| Minimal: title + URL + markdown | Keep extraction simple | |

**User's choice:** Lightweight optional structured metadata. Enriches search, retrieval quality, source attribution, and future citation support while keeping Phase 4a implementation lightweight.

---

## MiniSearch Index Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full-text + heading hierarchy | BM25 ranking with heading breadcrumb metadata per chunk | ✓ |
| Full-text search only | Basic BM25 across content chunks | |

**User's choice:** Full-text search with heading hierarchy metadata. MiniSearch indexes heading-aware chunks with heading breadcrumb (H1→H2→H3 path) retained. Search remains BM25 with heading-aware score boosting. Preserves document structure and improves retrieval relevance.

---

## MiniSearch Index Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm: strict ephemeral | Index survives SPA navs within tab session, destroyed on close, never persisted | ✓ |
| Ephemeral + optional session cache | SPA-safe but cleared on close | |
| Revisit: allow optional persistence | Consider IndexedDB persistence with user consent | |

**User's choice:** Ephemeral, tab-lifetime, SPA-navigation safe. Index survives SPA navigations within the tab (incremental invalidation + re-extraction). Never persisted to IndexedDB or chrome.storage. Privacy-first and zero-migration.

---

## Re-extraction Trigger Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Add explicit reExtract() API | reExtract(tabId) forces cache invalidation and re-extraction; no UI in Phase 4a | ✓ |
| Lazy only for Phase 4a | Re-extraction only via next extract() request | |

**User's choice:** Add `PageContentService.reExtract(tabId)` API as infrastructure capability. Lazy extraction via `extract()` remains default. Stable extension point for future UI actions, diagnostics, and MCP tools without adding UI in this phase.

---

## Context Budget Allocation

| Option | Description | Selected |
|--------|-------------|----------|
| TokenBudget integration | ContextOptimizer gets per-tier allocation from TokenBudget.allocateBudget(tier); PageContentService stays extraction-focused | ✓ |
| Constant in PageContentService | 2,000 tokens hardcoded in extraction layer | |

**User's choice:** Budget policy centralized in ContextOptimizer via TokenBudget. PageContentService remains responsible only for extraction, indexing, and retrieval. Different tiers get different page content amounts. No AI-context concerns leaking into extraction layer.

---

## the agent's Discretion

- Heading-chunking limits, Readability fallback char-count thresholds, DOM capture size caps — planner may tune within decision bounds
- BM25 boost weight for heading-path matches — planner selects reasonable defaults

## Deferred Ideas

- v2 host-page automation (via chrome.debugger + CDP Input) — spec §26.7, APCLiteNode schema automation-ready
- ServiceNow Table-API-first extraction — Phase 8 ServiceNow add-on
- site-specific extraction strategies — future add-on IContextExtractor model
