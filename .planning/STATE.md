---
gsd_state_version: "1.0"
milestone: v0.2
current_phase: 1
current_phase_name: MV3/WXT Runtime + AntD Shells + Workspace
status: executing
stopped_at: Completed 01-12-PLAN.md (fixture/deferred marker convention, deterministic page disposition, seven page suites, D-03 step-4 parity record)
last_updated: "2026-09-21T15:09:22.048Z"
last_activity: 2026-09-21
last_activity_desc: Phase 1 execution started
state_head: 56325f65bb98a5986fd8e24758963d5bbf5130b0
progress:
  total_phases: 19
  completed_phases: 0
  total_plans: 13
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-20)

**Core value:** Turn the page you are on into trustworthy, cited, reusable knowledge — through a copilot whose routing is automatic, cost-governed, and safe by construction.
**Current focus:** Phase 1 — MV3/WXT Runtime + AntD Shells + Workspace

## Current Position

Phase: 1 (MV3/WXT Runtime + AntD Shells + Workspace) — EXECUTING
Plan: 10 of 13
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
| Phase 01 P06 | 10 | 2 tasks | 8 files |
| Phase 01 P07 | 18min | 3 tasks | 14 files |
| Phase 01 P09 | 37 | 3 tasks | 18 files |
| Phase 01 P12 | 29min | 3 tasks | 28 files |

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
- [Phase 1]: Phase 1: MessageType is the full Appendix E const object with MessageTypeValues derived from it; OPEN_SIDE_PANEL/OPEN_STANDALONE replace the prototype spellings and the five scaffold-local literals live in ScaffoldMessageType with strict bounded schemas, validated but unhandled (T-1-29).
- [Phase 1]: Phase 1: payload validation is a strict per-type Zod parse in src/core/runtime/RuntimeEnvelopeValidation.ts, split out of RuntimeEnvelope.ts because declaring the schemas there put zod in the content bundle (4.07 kB -> 73.76 kB; after the split content.js is 4.88 kB and background.js carries zod).
- [Phase 1]: Phase 1: the chrome.runtime.onMessage listener rejects any sender whose sender.id is not chrome.runtime.id (absent sender and absent id included) and validates the envelope before dispatch; BackgroundRouter registers only the canonical literals, the scaffold handlers are gone, and synchronous cold-start attachment is proven by test.
- [Phase 1]: Phase 1: the envelope keeps operationId/timestamp (plan-verbatim) although Appendix C declares id/createdAt and an addon source; recorded in .planning/WINDOWS.md for the phase acceptance review.
- [Phase 1]: 01-07: the migration base pins `updatedAt` to 0 (never reads the clock) and mints one workspace id per process, so migrating the same input twice is deep-equal — the plan's determinism requirement rules out `Date.now()`.
- [Phase 1]: 01-07: the handoff state machines live in `handoff/protocol.ts` and the surface controllers in `handoff/useWorkspaceHandoff.ts`; Task 2's suite owns the cold-start/timeout/retry/ack-gate cases, so the correlator had to exist at Task 2's module boundary.
- [Phase 1]: 01-07: `deleteLegacyWorkspaceBlob()` moved to an import-free module after measuring `background.js` graph 73.0 kB → 95.3 kB (zustand + immer); back to 75.3 kB, with `WorkspaceStore` re-exporting the helper.
- [Phase 1]: 01-07: `openStandalone` keeps its positional signature and adds a typed `code` to the failure arm, so `src/entrypoints/sidepanel/main.tsx` compiles unmodified; the pinned `standalone.openFailed` copy and Retry rendering belong to the UI plans.
- [Phase 1]: 01-07: `hydrateFromURL` returns the target controller's disposer and `StandaloneShell`'s mount effect returns it — the controller's unsubscribe is the React effect cleanup.
- [Phase 1]: 01-09: PROVIDER_IDS is a const tuple and ProviderId is derived from it (one source for the union, the Select options and the tests); the prototype's 'claude' is not a member and gets no alias, while the legacy prototype provider types stay resolvable and marked // LEGACY for plan 01-11.
- [Phase 1]: 01-09: cancellation is its own union member with no error code ({ ok: false; cancelled: true }) plus isValidationCancelled(); a cancelled attempt can never be read as a success or as a coded failure.
- [Phase 1]: 01-09: the reveal toggle is a plain Input with an explicit type toggle and a named suffix button — antd v6's Input.Password hard-codes aria-label={locale.show|hide} with no override and visibilityToggle={false} freezes type, so the pinned onboarding.showKey/hideKey names are unreachable through it.
- [Phase 1]: 01-09: the completion record is np_onboarding with validationBacking: 'fixture' | 'provider' (not a boolean marker); writeOnboardingState re-migrates before merging so a skip cannot erase the selected provider, and the legacy boolean is absorbed and deleted.
- [Phase 1]: 01-09: the surface gate (useOnboardingGate) was split out of onboardingStateStore.ts after measuring the service worker — with the hook in the store the background graph went 75,312 B -> 86,140 B; after the split it is 77,740 B (+2.4 kB) and the content script is unchanged at 4,875 B.
- [Phase 1]: 01-09: the flow mounts in each entrypoint root (a modal over whichever surface the user opened), not in SidePanelRouter as plan 01-02's note reserved; the router's comment was corrected and the divergence recorded in the inventory.
- [Phase 1]: The marker attribute belongs to the marked region, never to DeferredNotice: every data-np-backing occurrence in src/ is a literal on a region, so a double or accidental marker is structurally impossible and the repo-wide scan is the audit surface.
- [Phase 1]: WorkspaceSidebar.tsx took the remove disposition (ADAPT -> REMOVE, inventory change-control C-01-12-A): 01-02 had already shipped the canonical Sider inside StandaloneShell.tsx, so remounting the unmounted file would have created the parallel implementation D-02 forbids.
- [Phase 1]: ModelSelector.tsx keeps REMOVE but its file deletion moves to 01-11 (change-control C-01-12-B): 01-12 replaced the Write-page import site with the read-only Auto workflow display, but the last importer is chat/ChatComposer.tsx, a 01-11 REMOVE row.
- [Phase 1]: options/OptionsPage.tsx loses the real connection test and its provider-service import, and its Save and provider Switch are disabled and marked; the credential-field strip stays 01-11's declared work.

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

Last session: 2026-09-21T15:09:22.024Z
Stopped at: Completed 01-12-PLAN.md (fixture/deferred marker convention, deterministic page disposition, seven page suites, D-03 step-4 parity record)
Resume file: None
