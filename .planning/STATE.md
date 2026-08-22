---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
current_phase: 01
status: completed
stopped_at: Phase 1 UI-SPEC approved
last_updated: "2026-08-22T10:19:39.226Z"
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 9
  completed_plans: 8
current_phase_name: mv3-wxt-runtime-antd-shells-workspace-handoff
---

# NowPilot — Project State

**Project:** NowPilot
**Milestone:** v0.1
**Defined:** 2026-08-19
**Single source of truth:** `.planning/PROJECT.md` (project context) · `.planning/PRODUCT_SPEC_v0_1.md` §18 (implementation sequence)

---

## Project Reference

- **What this is:** Privacy-first Chrome MV3 AI assistant + personal knowledge platform for ServiceNow Support Engineers (Copilot + Obsidian + NotebookLM in one extension). See `.planning/PROJECT.md` §What This Is.
- **Core value:** *AI chat and a personal knowledge base that work together, locally-first, so a support engineer can capture knowledge once and retrieve it with citations — without any data leaving their machine unless they opt in.*
- **Current focus:** Phase 01 — mv3-wxt-runtime-antd-shells-workspace-handoff
- **Companion files:**
  - `.planning/PROJECT.md` — project context, Active/Out of Scope, Key Decisions
  - `.planning/REQUIREMENTS.md` — 220 v1 requirements (spec-native IDs + `REQ-F*` for §9 gaps)
  - `.planning/ROADMAP.md` — 19 phases mirroring spec §18 1:1
  - `.planning/PRODUCT_SPEC_v0_1.md` — spec, §18 canonical phase ordering
  - `.planning/RESEARCH-RECONCILIATION.md` — authority for stack/version/research-derived decisions
  - `.planning/SUMMARY.md` — recommended per-phase research pack for cost-effective models (path must match the precedence banners in the research docs; pick ONE canonical location and use it everywhere)
  - `.planning/adr/` — ADR-STACK-01 (WXT hold), ADR-STACK-02 (`unlimitedStorage`), ADR-P6-01 (Defuddle panel-side, proposed), ADR-SEC-01 (dual-LLM quarantine v0.2), ADR-NOTE-01 (WIKI-ID UUID identity)
  - `.planning/DESIGN_SYSTEM.md` + `.planning/mockup/` — visual reference for Phase 15

---

## Current Position

- **Phase:** 01 — COMPLETE
- **Plan:** 1 of 8
- **Status:** Phase 01 complete
- **Progress:** 0/19 phases complete · 0/19 plans written · 220/220 requirements mapped (100% coverage).

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 19 (canonical spec §18 order) |
| v1 requirements | 220 |
| Mapped requirements | 220 |
| Unmapped requirements | 0 |
| Coverage | 100% |
| Sub-waves preserved | Phase 15.1 / 15.2 / 15.3 (P0) / 15.4 (P1) / 15.5 (P2) |
| Verification gates | `pnpm run verify:phase-1` … `verify:phase-19` (defined in §24) |
| Open questions | 0 |
| Blockers | 0 |

---

## Accumulated Context — Decisions (inherited from PROJECT.md Key Decisions)

All inherited decisions are **— Pending** (awaiting first implementation to validate). PROJECT.md "Out of Scope" section is authoritative for what is **not** in v0.1.

| # | Decision | Source | Status |
|---|----------|--------|--------|
| 1 | GSD roadmap mirrors spec §18 1:1 (19 phases) | PROJECT.md Key Decisions | — Pending |
| 2 | REQUIREMENTS.md anchors to spec-native IDs verbatim; `REQ-*` minted only for §9 features lacking native IDs | PROJECT.md Key Decisions | — Pending |
| 3 | `D-*` records (§23, §27.8) are constraints/ADRs, not requirements | PROJECT.md Key Decisions | — Pending |
| 4 | §12 component-state strings attach as acceptance criteria on feature requirements, not standalone requirements | PROJECT.md Key Decisions | — Pending |
| 5 | One v0.1 milestone for all 19 phases | PROJECT.md Key Decisions | — Pending |
| 6 | Product spec is the single source of truth; planning artifacts never invent scope/paths/types | PROJECT.md Key Decisions | — Pending |
| 7 | Phase 1 builds on existing scaffold, not rebuild | PROJECT.md Key Decisions | — Pending |
| 8 | WXT held at 0.20.27 for v0.1 (post-v0.1 chore: 0.21 migration) | `.planning/adr/ADR-STACK-01` (RESEARCH-RECONCILIATION §F) | Accepted 2026-08-19 |
| 9 | `unlimitedStorage` permission added at Phase 2 (IndexedDB ships) | `.planning/adr/ADR-STACK-02` (RESEARCH-RECONCILIATION §F) | Accepted 2026-08-19 |
| 10 | Dual-LLM quarantine deferred to v0.2 (six-layer injection defense ships in v0.1) | `.planning/adr/ADR-SEC-01` (RESEARCH-RECONCILIATION §F) | Accepted 2026-08-19 |
| 11 | WIKI-ID UUID is sole note identity; no parallel alias store | `.planning/adr/ADR-NOTE-01` (RESEARCH-RECONCILIATION §F) | Accepted 2026-08-19 |
| 12 | Defuddle panel-side extraction on detached doc | `.planning/adr/ADR-P6-01` (RESEARCH-RECONCILIATION §F) | Proposed (spike pending Phase 6) |
| 13 | Selection → Ask AI promoted P1 → P0 | RESEARCH-RECONCILIATION §F (REQ-R24) | Accepted 2026-08-19; spec §9.1 updated |
| 14 | G-1 similar-cases result card = §9.7 acceptance criterion (v0.1) | RESEARCH-RECONCILIATION §F (REQ-R22) | Accepted 2026-08-19 |
| 15 | Phase-1 wxt.config.ts permissions DEVIATE from Appendix G: authoritative Phase-1 set = ['sidePanel','storage','tabs']; cookies/scripting/contextMenus→Phase 17, alarms/notifications→when used, unlimitedStorage→Phase 2, declarativeNetRequest→never (v0.1) | `01-CONTEXT.md` D-19a (REQ-R21 / §16.4 / ADR-STACK-02) | Accepted 2026-08-19 |
| 16 | Entrypoints KEPT at root `entrypoints/` (WXT default; no migration to src/entrypoints/); content-script path shape normalized to `entrypoints/content/core.content.ts` (directory form, ISOLATED); MAIN-world servicenow content script → Phase 17 | `01-CONTEXT.md` D-07a (§5.1 / §6.2 / Appendix G) | Accepted 2026-08-19 |
| 17 | Phase-1 `strict:true` lands via `@ts-expect-error NP-STRICT` sweep; verify:phase-1 is `tsc --noEmit` (noEmitOnError is a no-op and NOT relied upon); NP-STRICT ceiling tracked → reduce to 0 in Phase 2-3 | `01-CONTEXT.md` D-21 (§7.8 / §24 / §0.5.1) | Accepted 2026-08-19 |
---

## Accumulated Context — Open Questions / Blockers

- **Open questions:** 0.
- **Blockers:** 0.
- **Watch items (verify at phase, do not hard-code as fact):**
  - VAI-01: `CVE-2026-30830` (Defuddle XSS fix in 0.19.x) — confirm at Phase 6 install.
  - VAI-04: version numbers (TS 7.0.2, Vitest 4.1.11, Vite 8.2.1, antd 6.6.1, minisearch 7.2.0, defuddle 0.19.2, idb 8.0.3) — re-query npm at each phase install.
  - VAI-05: CWS v1 publish API shutdown 2026-10-15 — confirm `wxt submit init` v2 flow at Phase 19.
  - VAI-08: `CONCERNS.md`-referenced scaffold defects (simulated-AI `localhost:12380`, per-chunk full-store persistence, dual messaging, 5 unused permissions, vacuous isolation tests) — verify each against `src/` in Phase 1 before treating as fact (per RECONCILIATION §F).
  - Phase-1 theme key: authoritative is chrome.storage.sync.np\_theme (§15.1 / §17.1a APPR-03) — NOT np\_theme\_mode (does not exist in spec) and NOT the scaffold's chrome.storage.local np\_theme\_store. ThemeStore declares mode + pack now; pack SELECTOR UI is Phase 15 (D-10 / A1).
  - Phase-1 endpoint default: §10.6 ENDPOINTS are authoritative; localhost:12380 is NOT a canonical default and is not pre-filled in onboarding — real endpoint wiring is Phase 3 (D-12 / A4).
  - Version axes: zustand-persist store `version` (D-22) is SEPARATE from IndexedDB DB_VERSION (§20.4, reaches v4 by Phase 9) — do not conflate when numbering later migrations (A5).

---

## Session Continuity

**Last session:** 2026-08-19T07:00:50.015Z
**Stopped at:** Phase 1 UI-SPEC approved
**Resume file:** .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace-handoff/01-UI-SPEC.md

- **Last action:** Phase-1 context review applied — 01-CONTEXT.md patched (B1 strict/noEmitOnError, B2 permissions + new D-19a, B3 entrypoint location + new D-07a, A1-A5 theme key/background/Cmd+K/endpoint/version). STATE.md decisions + watch items updated to match.
- **Last updated:** 2026-08-19 after initialization.
- **Resume with:** `/gsd-plan-phase 1` (Phase 1 plan generation).

---

## Next-up

The workflow expects Phase 1 planning next. Run:

```text
/gsd-plan-phase 1
```

This will produce `Phase-01-*.md` plans under `.planning/phases/01-mv3-wxt-runtime/` based on the spec §18 Phase 1 block + REQUIREMENTS.md §Traceability (Phase 1 row) + ROADMAP.md Phase 1 entry + RESEARCH-RECONCILIATION.md §D research-driven implications (REQ-R01/R02/R04/R05/R19/R21) + SUMMARY.md Phase 1 row + DESIGN_SYSTEM §8.1 (Side Panel 400 px) + `.planning/codebase/` (scaffold map).

---

*Last updated: 2026-08-19 after initialization*
