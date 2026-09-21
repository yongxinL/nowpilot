---
gsd_state_version: "1.0"
milestone: v0.2
current_phase: 1
current_phase_name: MV3/WXT Runtime + AntD Shells + Workspace
status: executing
stopped_at: "Completed 01-05-PLAN.md (single-source theme contract: one np_theme writer, shape-detecting onChanged reader, pack-ready getAntdConfig, pinned local-first failure toast)"
last_updated: "2026-09-21T12:51:13.155Z"
last_activity: 2026-09-21
last_activity_desc: Phase 1 execution started
state_head: 6fb5e1267877f543f82dbbca5c4fa5e267bf18e0
progress:
  total_phases: 19
  completed_phases: 0
  total_plans: 13
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-20)

**Core value:** Turn the page you are on into trustworthy, cited, reusable knowledge — through a copilot whose routing is automatic, cost-governed, and safe by construction.
**Current focus:** Phase 1 — MV3/WXT Runtime + AntD Shells + Workspace

## Current Position

Phase: 1 (MV3/WXT Runtime + AntD Shells + Workspace) — EXECUTING
Plan: 6 of 13
Status: Ready to execute
Last activity: 2026-09-21 — Phase 1 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 10 | 3 tasks | 1 files |
| Phase 01 P02 | 24 | 3 tasks | 34 files |
| Phase 01 P04 | 5 | 2 tasks | 2 files |
| Phase 01 P05 | 17 | 3 tasks | 15 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- **Locked (operator, 2026-09-20):** DEC-OP-01 Side Panel is Chat-only · DEC-OP-02 no snip control · DEC-OP-03 Standalone Sider set · DEC-OP-04 message actions 7/8/4 · DEC-OP-05 release label v0.2 · DEC-OP-06 reference paths under `.planning/design/references/`.
- **Proposed (spec-embedded, not ADR-locked):** DEC-SPEC-01…11 + DEC-HTML-01 — see `.planning/intel/decisions.md`.
- Phase structure is operator-locked to PRODUCT_SPEC §18 Phases 1–19 (names + order); changes go through `/gsd-phase` + operator approval.
- [Phase 1]: Inventory D-04 gate frozen: 140 prototype files classified (KEEP 47 / ADAPT 69 / REPLACE 5 / REMOVE 19); every non-KEEP row names one owning plan 01-02..01-13; plans cite rows by Current path.
- [Phase 1]: Content-script entrypoint resolves to src/entrypoints/content/index.ts (WXT content/index glob; §5.1 directory intent preserved) with the operator checkpoint in 01-03 (H-1/OQ1).
- [Phase 1]: Theme: .dark class scoped to AntD only (src/index.css keeps its selectors) and AntD/X packages stay exactly pinned with no Phase 1 bump (OQ2/OQ4).
- [Phase 1]: WXT srcDir:'src' is live — every entrypoint under src/entrypoints/**, @ resolves to src in all three resolvers, and the content script is now at a WXT-discoverable path (build emits content-scripts/content.js).
- [Phase 1]: AntD v6 removed the cssVar boolean — ThemeConfig.cssVar is {prefix,key} and CSS variables are always on; getAntdConfig passes the pack's {key:'antd'} through instead of the v5-era cssVar:true.
- [Phase 1]: One provider chain per surface (XProvider > AntdApp > ErrorBoundary > shell); ErrorBoundary is mounted for the first time and pinned to shell.errorTitle/Body/Reload.
- [Phase 1]: The isolation gate matrix was corrected: standalone -> options is authorised by §5.4/§8.6 (Options renders inside the Standalone shell), options -> surface stays forbidden, and the pattern now catches bare relative sibling hops.
- [Phase 1]: The canonical Sider renders inside StandaloneShell.tsx; WorkspaceSidebar.tsx is unmounted and plan 01-12 owns its remount-or-remove disposition (inventory row updated).
- [Phase 1]: WXT dev-mode HMR observed as a real js-update for a component edit with @wxt-dev/module-react alone; browser-side application remains a manual check.
- [Phase 1]: Phase 1: The canonical string map is live with 68 canonical keys plus format(); the LEGACY block carries only the five prototype keys with a live t() consumer (app.name, common.back, agent.empty, options.loading, notes.empty) because the files the plan named as consumers render inline literals instead. The legacy-prune step moved out of 01-11; app.name/common.back belong to 01-12's shell disposition.
- [Phase 1]: Phase 1: src/core/i18n/strings.ts exports the frozen strings record (not just t/format) so the credential-shape and mutation-safety gates scan the whole map rather than a sample; Object.freeze makes the immutability claim assertable via Object.isFrozen and Reflect.set.
- [Phase 1]: Phase 1: chat.error is one canonical key (Provider error. [Retry] [Switch Provider]) and chat.retry/chat.switchProvider are deleted; the suite proves deletion by asserting each retired key resolves to its own name.
- [Phase 1]: Phase 1: a11y.closeDialog is asserted by explicit presence (t(key) !== key), not inequality, because the UI-SPEC pins Close — the same word AntD enUS ships; the three overrides that genuinely differ (OK, Cancel, Please select) are asserted as inequalities.
- [Phase 1]: Phase 1: onboarding.failed and deferred.phaseBody carry {token} interpolation slots rather than the UI-SPEC's bracketed [error] form, because the same UI-SPEC defines [...] as an action label rendered as a link or button.
- [Phase 1]: Phase 1: np_theme has exactly one writer — ThemeStore's persist envelope. applyThemeToSync (the bare-string second writer) and the BroadcastBus theme channel are deleted; chrome.storage.onChanged is the only propagation path and both surface roots install it through useThemeSync().
- [Phase 1]: Phase 1: getAntdConfig is the only derivation point — pack overlays merge over the seed token blob through the total getThemePack(id), algorithm is always an array with compactAlgorithm second only when compact, and an unknown pack id resolves to default rather than returning a partial config (T-1-22).
- [Phase 1]: Phase 1: readThemeValue() accepts the persist envelope (object or JSON string) and the legacy bare mode string and returns null for every other shape; startThemeOnChangedSync never casts. A rejected sync write is local-first with the pinned theme.syncFailed / theme.syncRetry toast via persistThemeNow() + flushPendingWrites().
- [Phase 1]: Phase 1: ThemeMode moved to the pure ThemeConfig.ts (re-exported by ThemeStore) so ThemeToggle keeps no store/Chrome import; src/components/ThemeProvider.tsx is deleted and ThemeToggle stays unmounted and typed (mode/onChange) with map-resolved labels.
- [Phase 1]: Phase 1: the np_store persisted projection no longer carries config.themeMode (D-15); merge re-seats the in-memory field from the defaults. Recorded on the inventory row for 01-09/01-11.

### Pending Todos

None yet.

### Blockers/Concerns

- `package.json` carries a pre-§18 `verify:phase-N` numbering (incl. `phase-4a`/`phase-5a`); §24's mapping is authoritative — realign scripts per phase as each phase lands (Phase 1 owns `verify:phase-1`).
- Existing `src/` + `entrypoints/` is a UI-seed prototype; convert it per the spec's "UI Seed and Workflow Routing Authority" — do not extend it as production architecture.
- One phase per response; later phases depend on earlier contracts (§18). Do not start Phase N+1 before Phase N is green.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| Capture | Snip/screenshot composer control (DEC-OP-02) | Deferred beyond v0.2 | 2026-09-20 | v0.2 |
| Injection | Page injection / Shadow DOM / host-page write-back (§25, R1) | Deferred to later release | 2026-09-20 | v0.2 |
| Knowledge | Strict-OKF conformance (OKF-WIKI-04) | Deferred (ADR required) | 2026-09-20 | v0.2 |
| UI | RICH-H-07 "Fill this field" | Deferred (R1) | 2026-09-20 | v0.2 |

## Session Continuity

Last session: 2026-09-21T12:51:13.134Z
Stopped at: Completed 01-05-PLAN.md (single-source theme contract: one np_theme writer, shape-detecting onChanged reader, pack-ready getAntdConfig, pinned local-first failure toast)
Resume file: None
