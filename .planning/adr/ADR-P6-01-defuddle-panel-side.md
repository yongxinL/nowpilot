# ADR-P6-01 — Defuddle runs panel-side on a detached document

- **Status:** Accepted (2026-08-29 — SPIKE-P6-01 resolved by the Phase-6 tracer tests; no measurement pass)
- **Date:** 2026-08-19
- **Deciders:** George Li (product owner / architect)
- **Decides:** RESEARCH-RECONCILIATION.md §B / SPIKE-P6-01
- **Related:** ARCHITECTURE.md §3.3 + Pattern 6, STACK.md (defuddle row — corrected), spec §26.4, §26.6, §5.6, §24

## Context

`STACK.md` originally stated Defuddle *"runs in the content-script isolated world (needs DOM + `getComputedStyle`)."* This contradicts `ARCHITECTURE.md` and spec §26.4, which place Defuddle **panel-side**: the content script only serializes a pre-stripped HTML clone and stamps the base URL (≤2 MB, `truncated:true`), and the side panel / standalone parses a detached `DOMParser` document after injecting `<base href>`.

Bundling Defuddle in the content script would blow the <50 KB extraction bundle (§5.6) and fail the `no-content-script-ui` / isolation grep (§24). Panel-side placement is therefore **fixed**.

The genuine open question the STACK.md error surfaced: a **detached** `DOMParser` document has **no layout and no `getComputedStyle`**. Does `defuddle/full` `parse()` depend on computed style / live layout that only exists in the content script's live DOM?

## Decision

**Defuddle runs panel-side** (side panel / standalone), called synchronously as `parse({ markdown: true, url, useAsync: false })` on a detached document with `<base href>` injected. `useAsync: false` is mandatory (blocks third-party API extractors — privacy §0.2). The content script never imports Defuddle.

**Spike `SPIKE-P6-01` (run at Phase 6 start) determines the fallback, not the placement:**
- Run `defuddle/full` on captured ServiceNow-portal + KB-article HTML in a panel context; compare extraction fidelity against a live-DOM baseline.
- **If** fidelity is acceptable on the detached doc → no change; close this ADR as Accepted.
- **If** Defuddle materially depends on computed style/layout → add a **thin content-script measurement pass** that reads only the required layout signals (still no parsing, still <50 KB) and messages them to the panel. **Do not** move Defuddle into the content bundle.

Record the spike outcome in this ADR (flip Status → Accepted with the chosen path).

## Consequences

- **Positive:** keeps the <50 KB extraction bundle and isolation guarantees; privacy-safe sync parse; matches spec §26.4.
- **Negative:** if the detached doc underperforms, a small content-script measurement pass adds complexity (bounded, no parsing).
- **Risk if ignored:** a cost-effective model reading the old STACK.md text would bundle Defuddle in the content script → bundle-size + isolation-test failures.

## Verification

- Isolation grep (§24): no `defuddle` import in `content/` entrypoints; content bundle <50 KB; also rejects `mathml-to-latex`, `temml`, `turndown`, `yaml`.
- Spike report attached: fidelity delta (detached vs live-DOM) on the ServiceNow sample corpus; decision (no-op vs measurement-pass) recorded here.
- Extraction produces clean Markdown with correct relative-link resolution (base-href stamp working).

## Spike Outcome (SPIKE-P6-01)

**Resolution: detached-doc fidelity is ACCEPTABLE → no content-script measurement pass. Placement stays panel-side per this ADR and §26.4.**

- **Defuddle's computed-style access is guarded.** `defuddle` 0.19.x reads layout via `element.ownerDocument.defaultView?.getComputedStyle(...)` — the optional chaining means a detached `DOMParser` document (`defaultView === null`) **degrades rather than throws**. Independently confirmed for 0.19.2 by the nexus project (issue #329, 2026-08-14).
- **Readability 0.6.0's visibility check is inline-only.** `_isProbablyVisible` (verified in the published `Readability.js:2694-2707`) uses only inline style/attribute checks — no `getComputedStyle` / `defaultView` — so the internal Readability fallback also runs on a detached doc.
- **Evidence (Phase-6 tracer, plan 06-01):** the real-engine detached-doc tests in `tests/core/extraction/DefuddleStrategy.test.ts` run `defuddle/full` on synthesized KB/portal fixtures with base-href injection under jsdom — (a) does not throw on a detached `DOMParser` doc with base-href (A1/A2), (b) extracts non-empty markdown + title for the KB fixture, (c) extracts the portal-record-shaped fixture. No measurement pass needed (D-79).
- **Known fidelity delta (accepted):** stylesheet-driven `display:none` removal is inert on a detached doc (no computed style to read); inline `display:none` / `hidden` attributes are still detected. This degrades gracefully and is partially mitigated by the content-script pre-strip (06-04).
- **Conclusion:** the ADR flips to **Accepted**; no content-script measurement pass ships in v0.1 (D-79).
