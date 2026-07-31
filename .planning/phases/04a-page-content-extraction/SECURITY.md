---
phase: 04a-page-content-extraction
slug: page-content-extraction
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-31
---

# Phase 04a — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Untrusted web page HTML → content script (DomSerializer) | HTML from arbitrary pages enters the content script; password values redacted before any transmission | serialized HTML, page title/URL |
| Content script → Extension Page (MessageBus) | Serialized HTML crosses chrome.runtime boundary — validated via RuntimeEnvelope isEnvelope() | RuntimeEnvelope payloads |
| Extension Page → DOMParser → Defuddle/Readability | HTML parsed in extension page context; DOMParser provides browser-native sandboxing | HTML string |
| Extracted text → ContextOptimizer / AI context | Redacted text enters AI pipeline via pageContext; must be free of secrets | redacted markdown |
| Extracted text → MiniSearch (ephemeral in-memory) | In-memory index never persisted; destroyed on tab close — no IndexedDB/chrome.storage writes | indexed chunks |
| Untrusted DOM → APCLiteNode tree | Zod strictObject validation is the trust gate before consumers read the tree | typed tree nodes |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04a-01 | Tampering | MessageBus cross-context messaging | medium | mitigate | isEnvelope() shape+type validation (RuntimeEnvelope.ts:37-47); dispatch drops non-envelopes (MessageBus.ts:28); try/catch → structured error sendResponse (MessageBus.ts:64-66) | closed |
| T-04a-02 | Information Disclosure | DomSerializer password capture | high | mitigate | Redaction on clone before outerHTML — 3 selectors + name heuristic, removeAttribute('value')+IDL clear (DomSerializer.ts:13-16,67-95); tests all patterns (DomSerializer.test.ts:14-45) | closed |
| T-04a-03 | Information Disclosure | Secret leakage to AI context | medium | mitigate | redactSensitive() before PageContext construction (PageContentService.ts:191); JWT/Bearer/API-key/JSESSIONID/sysparm_ck patterns (redactSensitive.ts:28-39) | closed |
| T-04a-04 | Information Disclosure | Index persistence | medium | mitigate | MiniSearch strictly in-memory; no storage/serialization APIs (PageIndexBuilder.ts); tabs.onRemoved → removeTab (PageContentService.ts:70-73) | closed |
| T-04a-05 | Denial of Service | Large HTML payload | low | mitigate | 2MB size cap (DomSerializer.ts:11); 5s global timeout + per-strategy Promise.race (PageContentService.ts:23,153-172); in-flight coalescing (86-100) | closed |
| T-04a-06 | Tampering | ReadabilityFallback DOM mutation | low | mitigate | doc.cloneNode(true) before Readability.parse() (ReadabilityFallback.ts:40-41); mutation-simulating test | closed |
| T-04a-07 | Information Disclosure | Readability textContent | low | accept | Documented in Accepted Risks Log | closed |
| T-04a-08 | Denial of Service | Deep DOM nesting | low | mitigate | MAX_DEPTH=100 recursion cap + truncated flag (ApcLiteStrategy.ts:75,309-332); 2000-deep fixture test | closed |
| T-04a-09 | Tampering | Zod validation bypass | medium | mitigate | z.strictObject schemas (apcLite.types.ts); APCLiteDocumentSchema.safeParse at strategy boundary (ApcLiteStrategy.ts:55) | closed |
| T-04a-10 | Information Disclosure | Index persistence | high | mitigate | In-memory only, no serialization API (PageIndexBuilder.ts); destroy on tab close (PageContentService.ts:70-73) | closed |
| T-04a-11 | Information Disclosure | Stale data across navigations | medium | mitigate | SPA_NAVIGATION: removeTab BEFORE invalidate (PageContentService.ts:126-128); buildFromText/Tree removeTab-first (PageIndexBuilder.ts:81,101) | closed |
| T-04a-12 | Denial of Service | Unbounded memory growth | low | mitigate | Input bounded by 2MB cap; per-tab index destroyed on close; tab isolation (PageIndexBuilder.ts:163-174) | closed |
| T-04a-13 | Tampering | Banned dependency in content bundle | medium | mitigate | Isolation test: banned-import grep + <50KB bundle + built-bundle string check (no-content-script-ui.test.ts:21-125) | closed |
| T-04a-14 | Information Disclosure | SerializedPage in transit | low | accept | Documented in Accepted Risks Log | closed |
| T-04a-15 | Tampering | Test coverage gaps | low | accept | Documented in Accepted Risks Log | closed |
| T-04a-SC | Tampering | npm install (defuddle, readability, minisearch) | low | accept | Documented in Accepted Risks Log | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-04a-01 | T-04a-07 | Readability extracts textContent only (no markup) — cross-site script content stripped during text extraction; redactSensitive runs downstream in PageContentService as defense-in-depth | plan (T-04a-07 disposition) | 2026-07-31 |
| R-04a-02 | T-04a-14 | SerializedPage travels via chrome.runtime.sendMessage within the extension's isolated world; cross-extension interception is a Chrome platform concern, not an application concern | plan (T-04a-14 disposition) | 2026-07-31 |
| R-04a-03 | T-04a-15 | Test coverage targets all strategy implementations, both modes, all error codes, all redaction patterns, both invalidation paths; uncovered paths (corrupted DOMParser output) are Chrome platform guarantees | plan (T-04a-15 disposition) | 2026-07-31 |
| R-04a-04 | T-04a-SC | defuddle@0.19.2, @mozilla/readability@0.6.0, minisearch@7.2.0 verified legitimate per RESEARCH.md Package Legitimacy Audit: established age (1.5–7 yrs), MIT/Apache-2.0, zero postinstall scripts, no [SLOP]/[SUS] verdicts; installed only in extension-page bundles (not content script) | plan (T-04a-SC disposition) | 2026-07-31 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-31 | 16 | 16 | 0 | gsd-security-auditor (L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-31
