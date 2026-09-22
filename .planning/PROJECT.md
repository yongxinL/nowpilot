# NowPilot

## What This Is

NowPilot v0.2 is a Chrome MV3 extension that puts a governed AI copilot one click away: a Chat-only Side Panel for daily work and a Standalone workspace for deep work (Chat · Agent · Note · Write · Tools · Settings). Built with WXT, React 19, TypeScript (strict), Ant Design v6 and Ant Design X 2.x, every request flows through a Planner → Executor → Renderer pipeline with workflow-based selection (no raw model selector), layered page extraction, durable memory + notes with OKF-compatible filesystem sync, and an agent harness that is reliable, trust-aware, governed, evaluated and human-verified.

Phase 1 converted the UI-seed prototype into the canonical WXT layout: the D-04 file-level migration inventory is frozen (140 rows), `srcDir: 'src'` is live, the Vite dev shell is retired (WXT is the single dev/build/zip runtime), and the surviving prototype pages are fixture-backed and D-16-marked for their owning later phases. The v0.2 build follows the spec's §18 phase sequence; later phases build on the Phase-1 contracts.

## Core Value

Turn the page you are on into trustworthy, cited, reusable knowledge — through a copilot whose routing is automatic, cost-governed, and safe by construction.

## Requirements

### Validated

- ✓ **Phase 1 — MV3/WXT Runtime + AntD Shells + Workspace** (2026-09-23) — CORE-01 · SP-02 · SP-08 · SP-09 · SA-08 · SA-09 · SA-10 · APPR-03 · APPR-04 · APPR-05 · FLOW-8 · FLOW-9 · FLOW-10 · FLOW-11: extension boots on MV3/WXT with both surfaces (Chat-only Side Panel; Standalone workspace), request-correlated workspace handoff, single-writer theme, envelope-validated messaging with sender guard, and shell contracts. 13/13 plans; `verify:phase-1` = 41 files / 569 tests + isolation gates.

### Active

- **188 v1 requirements**, traced to the spec's requirement families and §9 feature priorities — authoritative list with phase traceability in `.planning/REQUIREMENTS.md`.
- Families: `CORE-01…09` (foundation + verification anchors) · `SP-01…10` (§9.1 Side Panel) · `SA-01…10` (§9.2 Standalone) · `OPT-01…14` (§9.3 Options) · `WF-01…07` (§9.3a workflow routing) · `ADD-01…06` (§9.4–§9.8 add-ons) · `AGT-01…04` · `CTX-01…06` · `MEM-01…05` + `KNW-01` · `TOL-01…07` · `EVAL-01…07` · `EVO-01…06` + `PROP-01…06` · `MM-01…07` · `COLLAB-01…13` · `CAT-01…05` · `LLM-WIKI-01…11` · `SYNC-01…11` · `NMEM-01…03` · `WIKI-ID-01…04` · `OKF-WIKI-01…04` · `RICH-P0/P1/P2` · `APPR-01…06` · `NOTES-COL-01…03` · `FLOW-1…19`.

### Out of Scope

Documented to prevent re-adding:

- Page injection / Shadow DOM UI / host-page write-back — deferred to a later release; content scripts are extraction-only in v0.2 (§25; DEC-SPEC-03, DEC-SPEC-11 R1)
- Screenshot / region capture in the Side Panel composer — deferred beyond the current v0.2 milestone (DEC-OP-02)
- `@ant-design/x-sdk`, `@ant-design/x-card` / A2UI — banned for the chat data flow / deferred (DEC-SPEC-02)
- External agent frameworks (LangChain, LlamaIndex, MemGPT, Mastra) — patterns borrowed, runtime owned (DEC-SPEC-09)
- Embeddings / vector stores; bidirectional filesystem sync; LLM wikilink autocomplete — out of scope for v0.2; LLM-routed reranking + one-way app→FS sync instead (§27, D-04)
- Strict-OKF conformance (markdown-link edges, path-as-identity, `sources`/`verified`) — later release behind a dedicated ADR (OKF-WIKI-04)
- Raw model selector in Chat; Side Panel nav rail; add-on Side Panel pages; AI/MCP/IndexedDB from the background SW — explicitly prohibited (§0, §9.4, W1, DEC-HTML-01)
- Banned packages (`tailwindcss`, `shadcn/ui`, `@radix-ui/*`, `clsx`, `tailwind-merge`, `framer-motion`, `ulid`/`uuid`, provider SDKs) — §0 hard rules

## Context

- **Authoritative baseline:** `.planning/product/PRODUCT_SPEC.md` v0.2 (canonical implementation contract; §18 is the sole implementation sequence), `.planning/design/DESIGN_SYSTEM.md` (visual contract; defers to the product spec on functional rules), `.planning/design/NOWPILOT_DETAILED_UI_UX_LAYOUT_GSD_GUIDE.html` (UI seed; precedence SPEC > DOC).
- **Ingest provenance:** `.planning/intel/SYNTHESIS.md`, `.planning/intel/decisions.md`, `.planning/intel/constraints.md`, `.planning/intel/context.md`; conflict log `.planning/INGEST-CONFLICTS.md` (0 blockers; W1–W6 operator-resolved 2026-09-20).
- **Codebase map (reference only):** `.planning/codebase/*.md`.
- **Visual references (acceptance artifact, not model input):** `.planning/design/references/{sidepanel,standalone,notes,options,themes}/` (W6).
- **Prototype state:** an early UI-seed prototype exists; `package.json` carries a pre-§18 `verify:phase-N` numbering (incl. `phase-4a`/`phase-5a`). §24's script mapping is authoritative and is realigned as each §18 phase lands.
- **Target implementation agents:** cost-effective coding models are expected; `@implementation-tier: advanced` modules may be stubbed (e.g. CodeSearchSkill → `CODESEARCH_NEEDS_ADVANCED_MODEL`).

## Constraints

- **Tech stack (pinned):** WXT; React 19; TypeScript ≥5.5 strict; Ant Design v6 + Ant Design X 2.x presentation components only; `@ant-design/x-markdown`; Zustand; Vercel AI SDK `ai ^5+` via `@ai-sdk/*` adapters; zod ^4 with zod-to-json-schema; `motion` (never `framer-motion`); `@ant-design/icons` v6; vitest + @testing-library/react + jsdom + msw; pnpm.
- **Hard rules (§0):** no provider/MCP/EventSource/IndexedDB from the background SW (PROXY_FETCH + `chrome.alarms` only); no custom User-Agent; no eval/remote code; tokens in `chrome.storage.session`; API keys AES-GCM-encrypted in `chrome.storage.local`; message bodies only in IndexedDB; all logging through TraceRedactor; content scripts extraction-only (no UI, no Shadow DOM, no host-page writes); no antd/`@ant-design` in content scripts or SW; no `innerHTML`/`dangerouslySetInnerHTML`; all cross-context messages carry `RuntimeEnvelope<T>`; canonical strings/prompts used verbatim (STR/PROMPTS); no cross-surface imports (sidepanel ↔ standalone).
- **Surface split (locked):** Side Panel = Chat only (workflow selection, page context, attachments, chat history, new chat, Options action, Switch to Full chat, lightweight Save-to-note, help/feedback). Standalone = Chat · Agent · Note · Write · Tools + Add-ons (TeamGQM flag-gated) + bottom Settings (Diagnostics via Settings).
- **Phase sequencing (locked):** PRODUCT_SPEC §18 Phases 1–19 — names and order; one phase per response; later phases depend on earlier contracts.
- **Verification:** every phase defines a real `pnpm run verify:phase-N` script (tsc --noEmit + targeted vitest; §24); `verify:all`, `test:perf`, `test:isolation` at release; `tests/isolation/no-content-script-ui.test.ts` greps the content bundle (no React/AntD/defuddle/yaml/File System Access deps).
- **Performance targets (§22):** side panel paint <300 ms; standalone paint <500 ms; first token <2 s local / <3 s cloud; MiniSearch 1,000 notes <50 ms; wikilink autocomplete <50 ms p95; content bundle <50 KB; PROXY_FETCH 25 s hard; tab extraction 5 s hard; BroadcastBus round-trip <100 ms p95; handoff <1 s; RAG synthesis <4 s p95; restore 100 notes <3 s.

## Key Decisions

Locked entries are operator-authoritative (2026-09-20). Proposed entries are embedded in the spec (§23 / §27.8 / §17.7.5 / HTML seed) and are **not** ADR-classified; they guide implementation but can be revisited. Full text: `.planning/intel/decisions.md`.

| Decision | Rationale | Status |
|----------|-----------|--------|
| DEC-OP-01 — Side Panel is Chat-only; Agent/Notes/Write/Tools/TeamGQM/Options/Diagnostics are Standalone-only; add-ons register Standalone pages + chat-safe Side Panel entry actions only | One task-focused surface; deep work lives in the Standalone workspace | **Locked** |
| DEC-OP-02 — No snip/screenshot control in the Side Panel composer; toolbar = workflow selector · Attach · Chat history · New chat | Page extraction ≠ screenshot capture; capture deferred beyond v0.2 | **Locked** |
| DEC-OP-03 — Standalone Sider = Chat · Agent · Note · Write · Tools + Add-ons group (TeamGQM flag-gated) + bottom Settings (Diagnostics via Settings) | Canonical navigation set | **Locked** |
| DEC-OP-04 — Message actions: Side Panel assistant 7 · Standalone assistant 8 · Standalone user 4; no Expand action | Action sets differ by surface capability; Activity disclosure owns expansion | **Locked** |
| DEC-OP-05 — Current release label is v0.2; deferrals use "later release" phrasing | Single canonical version label | **Locked** |
| DEC-OP-06 — Visual references live under `.planning/design/references/{sidepanel,standalone,notes,options,themes}/`; `.planning/mockup/` is not used | Pinned acceptance-artifact location | **Locked** |
| DEC-SPEC-01 — Technology stack pins (extension/UI/AI runtime) | §23 | Proposed |
| DEC-SPEC-02 — AI chat data flow is not `@ant-design/x-sdk`; A2UI deferred | §23, §25.6 | Proposed |
| DEC-SPEC-03 — Two surfaces + extraction-only content scripts; page injection deferred | §23, §6.2 | Proposed |
| DEC-SPEC-04 — PageContentService as core infrastructure (Phase 6), layered Defuddle → APC-lite → ServiceNow API | §23, §26 | Proposed |
| DEC-SPEC-05 — Knowledge layer: Memory + MiniSearch + Notes + Wikilinks (Phase 8); LLM-Wiki (Phase 9) | §23, §27 | Proposed |
| DEC-SPEC-06 — Note format OKF v0.2-aligned, OKF-compatible not OKF-constrained | §23, §21.2, §27.3 | Proposed |
| DEC-SPEC-07 — Persona from Phase 3; RICH on Ant Design X, phased; no host-page write-back | §23, §17.7 | Proposed |
| DEC-SPEC-08 — Coordinator-based agent platform, single-agent default; human-verified evolution | §23, §1.6, §28, §30 | Proposed |
| DEC-SPEC-09 — Working memory block; per-call tool approval; external agent frameworks rejected | §23, §3.6, §14.5 | Proposed |
| DEC-SPEC-10 — §27.8 D-01…D-08 (LLM-Wiki / notes decisions) | §27.8 | Proposed |
| DEC-SPEC-11 — RICH reconciliations R1 (no host-page write-back; Insert = clipboard-only) and R2 (persona is user config in PreferenceMemoryStore) | §17.7.5 (mandatory) | Proposed |
| DEC-HTML-01 — Workflow selector, not a raw model selector; TierResolver picks provider/model | UI-seed decision, corroborated by spec + design system | Proposed |
| DEC-OP-07 — Phase-1 content script is excluded from the build (staged `src/entrypoints/content/core.content.ts`, no `content_scripts` manifest key, matches narrowed to the authorised ServiceNow hosts); Phase 6 restores it as `index.ts` with a widened scope in one change | Operator decision 01-03 Option C: least-privilege manifest for a phase that runs no extraction; the temporary exclusion is recorded with owner + removal condition | **Locked (operator, 2026-09-22)** |
| DEC-OP-08 — Legacy plaintext provider credentials are destroyed in place on install/startup (field names-only report, non-secret metadata preserved, one neutral notice); affected users re-enter credentials once Phase 2 ships KeyVault | Operator decision 01-10 Option A (record D-01-10-1), rated one-way: the values exist only client-side and D-07 requires stripping now; the highest-severity CONCERNS finding is closed | **Locked (operator, 2026-09-22)** |
| DEC-OP-09 — Preserved-page prototype copy may stay inline through Phase 1; the canonical string map covers all Phase-1-authored copy and the sweep is owned by Phase 15 (Options/Notes) and Phase 17 (Write) via review item IN-05 | Operator-accepted override of 01-04's strict "no inline literal" clause, recorded in `01-VERIFICATION.md` frontmatter `overrides:` | **Accepted (operator, 2026-09-22)** |

## Evolution

- **After each phase transition:** invalidated requirements → Out of Scope (with reason); validated requirements → Validated (with phase reference); new requirements → Active; decisions → Key Decisions; "What This Is" updated if drifted.
- **After each milestone:** full review; Core Value check; Out of Scope audit; Context updated with current state (users, feedback, metrics).

---
*Last updated: 2026-09-23 after Phase 1 (MV3/WXT Runtime + AntD Shells + Workspace)*
