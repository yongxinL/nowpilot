# NowPilot — PageContentService Migration Checklist (PR Decision Log)

> **Goal:** Remove the Phase-8 page-content-extraction **tool** and rebuild extraction as a **core service** (`PageContentService`, `src/core/extraction/`) that works with the core **`MiniSearchIndex`** and feeds **`ContextOptimizerInput.pageContext`**. ServiceNow stays **API-first**. Browser automation (`chrome.debugger`) is **out of scope → v2**.
>
> **Companion doc:** `NowPilot-PageContentService-implementation-guide.md` (v0.5)
> **Base spec:** `PRODUCT_SPEC_v0_1.md`
> **Owner:** George Li (Integrations) · Sydney
> **Started:** ____ · **Target complete:** ____

---

## How to use this log
- Each step (**M0–M6**) is a **separate PR**. Tick items as they land; record the **decision + PR link + reviewer** in the log row.
- A step is **Done** only when every checkbox is ticked **and** its acceptance gate passes.
- Do **not** start the next step until the current step's gate is green (migration is reversible per step).

### Legend
`[ ]` todo · `[x]` done · `[~]` in progress · `[-]` n/a (record why)

---

## Migration status board

| Step | Title | PR | Owner | Reviewer | Status | Gate passed |
|---|---|---|---|---|---|---|
| M0 | Inventory & baseline | | | | ☐ | ☐ |
| M1 | Create core `PageContentService` | | | | ☐ | ☐ |
| M2 | Move logic, keep names | | | | ☐ | ☐ |
| M3 | Thin-wrapper `get-page-content` | | | | ☐ | ☐ |
| M4 | Repoint callers | | | | ☐ | ☐ |
| M5 | Delete old tool-layer extractor | | | | ☐ | ☐ |
| M6 | ServiceNow API-first + MiniSearch verify | | | | ☐ | ☐ |

---

## M0 — Inventory & baseline

**Purpose:** Know exactly what exists before touching anything. Establish a quality baseline to prove the migration improves things.

### Checklist
- [ ] Locate the current extraction **tool** module(s). Path(s): `________________`
- [ ] Grep every caller of the tool + `get-page-content`. Callers found: `________________`
- [ ] Confirm the tool's current `inputSchema` / `outputSchema` (record verbatim for M3 parity).
- [ ] Build the **problem-page fixture set** (8–10): SPA, infinite scroll, accordion/out-of-viewport, same-origin iframe, **ServiceNow case**, **ServiceNow incident**, data table, lazy article, consent overlay.
- [ ] Run the **old tool** across fixtures; record baseline metrics in `docs/extraction-benchmark.md` (completeness, noise, structure, interactive coverage, token cost, latency).
- [ ] Confirm no other module secretly re-implements extraction (grep for DOM walks / Readability usage).

### Acceptance gate
- [ ] Full caller list documented.
- [ ] Old-tool baseline metrics captured in `docs/extraction-benchmark.md`.

**Decision log:** _______________________________________________
**PR:** ______  **Merged:** ______

---

## M1 — Create core `PageContentService` (no callers yet)

**Purpose:** Stand up the new core engine in isolation; prove it in tests before anyone depends on it.

### Checklist
- [ ] Create `src/core/extraction/apcLite.types.ts` (`RawNode`, `APCLiteNode`, `APCLiteDocument` + Zod). *(Proposed Appendix C additions — flag for ratification, §0.2.)*
- [ ] Create `src/core/content/AxDomWalker.ts` (content-script safe: **no React/AntD**).
- [ ] Create `src/core/extraction/PageContentService.ts` (`extract`, `getForTab`, `selectRelevant`, `toPageContext`, `invalidate`).
- [ ] Create `PageContentSerializer.ts`, `PageContentCache.ts`, `transforms.ts`.
- [ ] Create `src/core/content/PageContextBridge.ts` (uses `RuntimeEnvelope` + existing `EXTRACT_PAGE_CONTENT`).
- [ ] Reuse spec token estimate in `src/core/context/TokenBudget.ts` (§2.2).
- [ ] Concurrency guard (coalesce dup per-tab), 5 s timeout (§13), redact **before** anything (§16), `debugLog` in every catch (§0.3).
- [ ] Fixture tests: `apcLite.schema.test.ts`, `AxDomWalker.test.ts`, `PageContentService.test.ts`.

### Acceptance gate
- [ ] `tsc --noEmit` clean.
- [ ] New fixture tests green.
- [ ] **No caller wired yet** (old tool still serves production).

**Decision log:** _______________________________________________
**PR:** ______  **Merged:** ______

---

## M2 — Move logic, keep names (no behavior change)

**Purpose:** Port any genuinely useful extraction logic from the old tool into core transforms; eliminate duplication. Callers still use the old tool — nothing visible changes yet.

### Checklist
- [ ] Identify reusable logic in the old tool (selectors, cleanup, Readability usage) and port into `transforms.ts` / walker.
- [ ] Remove now-duplicated logic from the old tool (leave its public interface intact for M3).
- [ ] Ensure **no ServiceNow-specific** selectors/tokens leak into core (`src/core/**`) — they belong only in the add-on (§0.2).
- [ ] Confirm core (`src/core/extraction/**`) does **not** import from `src/addons/**` (§0.2).

### Acceptance gate
- [ ] Old tool still returns identical output (regression check on fixtures).
- [ ] No `src/addons/**` import inside `src/core/**` (lint/grep check).

**Decision log:** _______________________________________________
**PR:** ______  **Merged:** ______

---

## M3 — Thin-wrapper the built-in `get-page-content` tool

**Purpose:** Make the built-in tool delegate to core **without changing its contract** (backward compatibility, §1.2).

### Checklist
- [ ] Rewrite `src/core/mcp/tools/getPageContent.ts` to call `PageContentService.getForTab()` → `toPageContext()`.
- [ ] Keep `name: 'get-page-content'`, `dangerous: false`, and the **exact same** `inputSchema` / `outputSchema` (§10.5).
- [ ] Confirm Planner/Executor tool enum is unaffected (§1.2).
- [ ] Add `migration.parity.test.ts` — old tool output vs core-backed wrapper on all fixtures.

### Acceptance gate
- [ ] `get-page-content` returns the same shape, now backed by core (cache/concurrency/redaction/metrics active).
- [ ] Parity test: core-backed wrapper **≥** old tool on completeness + noise on **≥ 70 %** of fixtures.

**Decision log:** _______________________________________________
**PR:** ______  **Merged:** ______

---

## M4 — Repoint callers (one caller per PR)

**Purpose:** Switch consumers to the core service (preferably via the context pipeline `pageContext`, not the tool, where possible).

### Checklist (one row per caller — add as needed)
- [ ] Caller: **Chat** → consumes `PageContentService` / `pageContext`. PR: ______
- [ ] Caller: **Agent** → `getInteractiveElements` / `getPageContent` via core. PR: ______
- [ ] Caller: **Summarize** → core. PR: ______
- [ ] Caller: **/research** → core. PR: ______
- [ ] Caller: **TeamGQM / Write (if applicable)** → core. PR: ______
- [ ] Wire MiniSearch selection: if `approxTokens > 2000` (§22.2) → `selectRelevant()`; mark `compressionApplied:'topk'` in provenance (§2.6).
- [ ] Minimal mode (tiny/small tiers, §2.5) always routes through `selectRelevant`.

### Acceptance gate
- [ ] Every listed caller now uses core; none call the old tool module directly.
- [ ] Large-page fixtures stay within the 2 000-token webpage budget via `selectRelevant`.

**Decision log:** _______________________________________________
**PR:** ______  **Merged:** ______

---

## M5 — Delete old tool-layer extractor

**Purpose:** Remove the deprecated extraction module. Only the thin `get-page-content` wrapper (now core-backed) remains.

### Checklist
- [ ] Delete the old tool-layer extractor module(s) identified in M0.
- [ ] Grep confirms extraction logic exists **only** under `src/core/extraction/**` + `src/core/content/**` (+ ServiceNow API path in the add-on).
- [ ] Remove dead imports/config referencing the old tool.
- [ ] `tests/isolation/no-content-script-ui.test.ts` passes (walker bundle has **no** React/AntD, < 50 KB, §22.1).

### Acceptance gate
- [ ] `verify:phase-8` passes (`tests/core/content`, `tests/addons`, `tests/isolation`, §24).
- [ ] `test:isolation` + `test:perf` pass.
- [ ] Zero references to the old tool module remain.

**Decision log:** _______________________________________________
**PR:** ______  **Merged:** ______

---

## M6 — ServiceNow API-first + MiniSearch verification

**Purpose:** Confirm ServiceNow uses the Table API first (extraction only as fallback) and that page↔MiniSearch retrieval works end-to-end.

### Checklist
- [ ] `ServiceNowContextExtractor` calls `SNowTableClient` (Table API via `PROXY_FETCH`, §10.7) for case/incident → `SNowCaseData`.
- [ ] Falls back to `PageContentService` only when tokens/API unavailable; surfaces `CONTENT_EXTRACT_FAILED` cleanly on unreachable closed shadow DOM.
- [ ] ServiceNow selectors/token names live **only** in `src/addons/servicenow/**` (§0.2).
- [ ] `PageIndexBuilder` builds an **ephemeral** per-page MiniSearch index (never IndexedDB); `selectRelevant` returns budget-trimmed nodes.
- [ ] `searchPageContent` / `findElement` Agent tools go through core `MiniSearchIndex` (no private index).
- [ ] Tests: `ServiceNowContextExtractor.test.ts`, `PageIndexBuilder.test.ts`.

### Acceptance gate
- [ ] ServiceNow case + incident fixtures return complete structured data via API.
- [ ] Long-page fixtures answerable via `searchPageContent` within budget.
- [ ] Full `verify:all` green.

**Decision log:** _______________________________________________
**PR:** ______  **Merged:** ______

---

## Cross-cutting compliance gate (verify before final sign-off)
- [ ] Password values never read (`isPassword ⇒ value omitted`) — Zod refine + `formInfo`.
- [ ] `script`/`style`/hidden nodes excluded; cross-origin iframes = origin only.
- [ ] `redact()` before indexing and before any `debugLog` (§4.4, §16).
- [ ] Page MiniSearch indexes ephemeral — never persisted.
- [ ] Content bundle: no React/AntD, < 50 KB (§22.1).
- [ ] Core never imports `src/addons/**`; ServiceNow specifics only in the add-on (§0.2).
- [ ] All cross-origin fetches via `PROXY_FETCH`; host checked → `HOST_NOT_PERMITTED` (§10.7).
- [ ] Every `catch` calls `debugLog(code, …)` (§0.3).
- [ ] **`chrome.debugger` NOT added** — browser automation is **v2** (§11a). No host-page automation in v0.1.

---

## Out of scope (record so reviewers don't expect it)
- [-] Browser automation (click/type/navigate) — **v2**, requires `chrome.debugger` + trusted `Input` events (guide §11a).
- [-] `chrome.debugger` AX-tree extraction — optional prototype only; adopted with v2 automation.
- [-] Page injection / Shadow-DOM UI — deferred per spec §25.

---

## Spec ratification tracker (§0.2 — do before code lands)
- [ ] Appendix C: `RawNode`, `APCLiteNode`, `APCLiteDocument` (+ Zod) ratified.
- [ ] §8.5 file tree: `src/core/extraction/*` paths added.
- [ ] §21.6 error codes: confirmed reuse (`CONTENT_EXTRACT_FAILED`, `TIMEOUT`, `HOST_NOT_PERMITTED`, `SESSION_TOKEN_MISSING`, `CONTEXT_TOO_LARGE`); no new codes needed for v0.1.

---

## Final sign-off
- [ ] All M0–M6 gates green.
- [ ] Cross-cutting compliance gate green.
- [ ] Spec ratification complete.
- [ ] `docs/extraction-benchmark.md` shows core **≥** old tool on the agreed metrics.

**Approver:** ______  **Date:** ______  **Release tag:** ______
