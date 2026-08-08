---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 10
subsystem: workspace
tags: [entrypoint-mount, workspace-store, workspace-sync, addon-settings, onboarding, gap-closure]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: "01-06 WorkspaceStore/WorkspaceSync/BroadcastBus, 01-07 AddonSettingsStore, 01-08 shells/routers, 01-09 entrypoint mounts — the stores/sync the mounts now activate"
provides:
  - "Workspace lifecycle activated at both entrypoint mounts: useWorkspaceStore.init() → start('sidepanel'|'standalone') → module-scope WorkspaceSync.start() — np_workspace now hydrates, activeSurface reflects the mounted surface, and the cross-surface sync loop (heartbeat / WORKSPACE_UPDATED LWW / handoff state machine / mirroring) runs in the shipped extension"
  - "useAddonSettingsStore.init() called at both mounts — the D-06 'Configure later' escape persists across surface loads via np_addon_settings onboarding.done"
  - "Mount-level behavioral tests proving both closed truths (workspace isReady/activeSurface/version; onboarding round-trip through np_addon_settings on a fresh module load)"
  - "REQUIREMENTS.md Phase-1 traceability rows (RUNTIME-01…05, WSPC-01…05) flipped to Done; verify:phase-1 re-green"
affects: [01-mv3-wxt-runtime-antd-shells-workspace, 02-storage-persistence, real-browser e2e verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Entrypoint mount wiring: fire-and-forget store init chains at module scope (after ThemeStore hydrate), with init().then(start; sync.start()) ordering so start() never runs before hydration completes"
    - "Module-scope WorkspaceSync ref held for stop() — the constructor is side-effect-free; only start() activates subscriptions/timers"

key-files:
  created: []
  modified:
    - src/entrypoints/sidepanel/main.tsx
    - src/entrypoints/standalone/main.tsx
    - tests/entrypoints/sidepanel.test.tsx
    - tests/entrypoints/standalone.test.tsx
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Split the init().then(...) chain into a named const (workspaceInit) so the mandated per-file grep fixture (useWorkspaceStore.getState().init) survives prettier's chain-breaking reflow — same semantics, prettier-stable call-site literal"
  - "Dynamic fresh-module-load tests import the entrypoint module (not just the store) so the module-scope init() actually fires against seeded storage — the standalone hydration test needs the entrypoint import to trigger the wiring"
  - "Existing entrypoint tests untouched — new assertions appended; per-file call-site counts stay exactly 1 per fixture (header comments describe wiring by concept, no literal call expressions)"

patterns-established:
  - "Entrypoint mounts own the store-activation chain: theme hydrate → addon-settings hydrate → workspace init().then(start; sync.start())"
  - "Fresh-module persistence tests: seed chrome.storage.local → vi.resetModules() → dynamic import entrypoint + store → assert on the FRESH store instances"

requirements-completed: [RUNTIME-01, RUNTIME-02, RUNTIME-03, WSPC-01, WSPC-02]

coverage:
  - id: D1
    description: "Workspace lifecycle wired at both entrypoint mounts — np_workspace hydrates, activeSurface matches the mounted surface, version bumped, and WorkspaceSync.start() activates the cross-surface sync loop in the shipped extension"
    requirement: "WSPC-01"
    verification:
      - kind: unit
        ref: "tests/entrypoints/sidepanel.test.tsx#workspace lifecycle fires at module scope (01-10 WR-03)"
        status: pass
      - kind: unit
        ref: "tests/entrypoints/standalone.test.tsx#workspace lifecycle fires at module scope (01-10 WR-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-06 onboarding persistence: useAddonSettingsStore.init() at both mounts; onboarding.done round-trips through np_addon_settings on a fresh module load — the shell renders instead of the OnboardingModal"
    requirement: "RUNTIME-02"
    verification:
      - kind: unit
        ref: "tests/entrypoints/sidepanel.test.tsx#onboarding round-trips through np_addon_settings on a fresh module load (01-10 WR-02)"
        status: pass
      - kind: unit
        ref: "tests/entrypoints/standalone.test.tsx#addon settings hydrate from np_addon_settings on a fresh module load (01-10 WR-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase 1 gate re-green with the wiring in place; REQUIREMENTS.md Phase-1 traceability rows reconciled to Done"
    verification:
      - kind: other
        ref: "pnpm verify:phase-1 (eslint → prettier → tsc → wxt build → 26 files/167 tests → content-bundle clean) exits 0"
        status: pass
      - kind: other
        ref: "grep -n 'RUNTIME-01…05' .planning/REQUIREMENTS.md → | RUNTIME-01…05 | Phase 1 | Done |; same for WSPC-01…05"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real-browser verification of the now-live sync loop — cross-window PING/PONG election, LWW adoption, theme propagation across two live surfaces, action-button gesture, tab dedupe in real windows"
    verification: []
    human_judgment: true
    rationale: "Host lacks Chrome system libs (CfT binary fails with missing libnspr4.so); these behaviors are executable only on a host with a runnable Chrome — carried from 01-VERIFICATION.md human_verification items"

# Metrics
duration: 10min
completed: 2026-08-08
status: complete
---

# Phase 1 Plan 10: Gap-Closure Mount Wiring Summary

**Entrypoint-mount activation of the workspace lifecycle (WorkspaceStore.init/start + module-scope WorkspaceSync.start) and addon-settings hydration at both surfaces, closing the two FAILED phase-1 verification truths (REVIEW WR-02/WR-03) with mount-level behavioral tests and a re-green phase gate**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-08T21:50:28Z
- **Completed:** 2026-08-08T22:00:44Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Workspace lifecycle activated at both entrypoint mounts (sidepanel + standalone): `useWorkspaceStore.init()` hydrates `np_workspace`, `start('<surface>')` writes the D-18 active fields with a version bump, and the module-scope `WorkspaceSync` ref's `.start()` activates the heartbeat / WORKSPACE_UPDATED LWW / handoff state machine / mirroring loop — the cross-surface sync the 01-06 plan promised is no longer dead code.
- D-06 onboarding persistence restored: `useAddonSettingsStore.init()` at both mounts hydrates `np_addon_settings` so `onboarding.done` survives surface loads; SidePanelRouter's gate now decides Onboarding vs shell from persisted state.
- 4 new mount-level behavioral tests prove both closures: workspace `isReady`/`activeSurface`/`version >= 1` at both mounts; onboarding round-trip through `np_addon_settings` on a fresh module load (vi.resetModules + dynamic import) with the shell rendering in place of the OnboardingModal.
- `pnpm verify:phase-1` re-green end-to-end (eslint → prettier → tsc → wxt build → 26 files / 167 tests → content-bundle clean); REQUIREMENTS.md Phase-1 traceability rows flipped to Done.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire workspace lifecycle + onboarding hydration at both entrypoint mounts** - `05af3da` (feat)
2. **Task 2: Mount-wiring behavioral tests** - `6999be2` (test)
3. **Task 3: Phase gate re-green + REQUIREMENTS.md reconciliation** - `5ea0a51` (feat)

**Plan metadata:** pending final metadata commit

## Files Created/Modified

- `src/entrypoints/sidepanel/main.tsx` - Added useWorkspaceStore/WorkspaceSync/useAddonSettingsStore imports; module-scope wiring after theme hydrate: `void useAddonSettingsStore.getState().init();` + `const workspaceSync = new WorkspaceSync('sidepanel');` + `const workspaceInit = useWorkspaceStore.getState().init(); void workspaceInit.then(() => { useWorkspaceStore.getState().start('sidepanel'); workspaceSync.start(); });`
- `src/entrypoints/standalone/main.tsx` - Same wiring with surface literal `'standalone'` and its own module-scope ref
- `tests/entrypoints/sidepanel.test.tsx` - 2 new tests (workspace lifecycle fires at module scope; onboarding round-trips through np_addon_settings on fresh module load via vi.resetModules + dynamic import)
- `tests/entrypoints/standalone.test.tsx` - 2 new tests (workspace lifecycle; addon-settings hydration on fresh module load)
- `.planning/REQUIREMENTS.md` - Traceability rows 180-181 flipped to `Done` (scoped Edit only)

## Decisions Made

- **Named-const split of the init chain** — prettier's chain-breaking reflowed `void useWorkspaceStore.getState().init().then(...)` across lines, which would have broken the plan's mandated per-file grep fixture (`useWorkspaceStore.getState().init` == 1 per file). Split into `const workspaceInit = useWorkspaceStore.getState().init(); void workspaceInit.then(...)` — identical semantics and ordering, prettier-stable call-site literal.
- **Fresh-module tests import the entrypoint, not just the store** — the standalone hydration test initially imported only the store module; the module-scope `init()` lives in the entrypoint, so the seeding was never read. Fixed by also importing `@/entrypoints/standalone/main` (per plan prescription), proving the wiring is what hydrates.
- **Header comments describe wiring by concept** — no literal call expressions in the comments, keeping the per-file call-site greps unambiguous.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prettier chain-breaking broke the mandated grep fixture**
- **Found during:** Task 3 (phase gate re-green)
- **Issue:** `pnpm verify:phase-1` failed at `prettier --check` — the `void useWorkspaceStore.getState().init().then(...)` chain was reflowed by prettier onto separate lines (`.getState()` / `.init()`), breaking the acceptance-criterion grep `useWorkspaceStore.getState().init` per-file count.
- **Fix:** Split the chain into a named const (`workspaceInit`) holding the `init()` promise and a `void workspaceInit.then(...)` continuation — same init().then(start; sync.start()) ordering, prettier-stable literal on one line. Also ran prettier --write over the 4 wired files (formatting-only reflow).
- **Files modified:** src/entrypoints/sidepanel/main.tsx, src/entrypoints/standalone/main.tsx, tests/entrypoints/sidepanel.test.tsx, tests/entrypoints/standalone.test.tsx
- **Verification:** `prettier --check` passes on all 4 files; all 10 per-file call-site greps return exactly 1; `pnpm verify:phase-1` exits 0
- **Committed in:** 5ea0a51 (Task 3 commit)

**2. [Rule 1 - Bug] Fresh-module hydration test asserted on an un-init'd store**
- **Found during:** Task 2 (mount-wiring behavioral tests)
- **Issue:** standalone.test.tsx hydration test imported only `@/core/registry/AddonSettingsStore` after vi.resetModules — the fresh store's `init()` is fired by the *entrypoint's* module-scope wiring, so settings stayed `{}` and `onboarding?.done` was `undefined`.
- **Fix:** Added the `await import('@/entrypoints/standalone/main')` call (matching the plan's prescription to import the entrypoint + store) so the fresh module-scope init() hydrates the seeded storage.
- **Files modified:** tests/entrypoints/standalone.test.tsx
- **Verification:** `pnpm vitest run tests/entrypoints` → 11/11 pass
- **Committed in:** 6999be2 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were required for correctness and gate-green. No scope creep; no architectural changes.

## Issues Encountered

- The 3000ms heartbeat timer from WorkspaceSync.start() is live in jsdom entrypoint tests (module-scope wiring) — the suite still exits cleanly (26 files / 167 tests pass, no open-handle failures).
- The first full-gate run failed on prettier formatting (fixed as deviation 1); the second run passed end-to-end.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both FAILED verification truths closed: WorkspaceStore.init/start + WorkspaceSync.start now have exactly 2 production callers (one per entrypoint mount); useAddonSettingsStore.init() called at both mounts; onboarding.done round-trips through np_addon_settings (behavioral test green).
- Phase gate re-green with no regression to the 9 executed plans' acceptance criteria or must_haves; REQUIREMENTS.md traceability reconciled (both Phase-1 range rows Done).
- **Outstanding human-verification items** (carried from 01-VERIFICATION.md, unchanged by this plan — executable only on a host with Chrome system libs): real-browser mount of sidepanel.html/standalone.html, action-button → side panel gesture, standalone tab dedupe in real windows, cross-window PING/PONG election + LWW adoption (now that the wiring exists), theme propagation across two live surfaces, real keyboard focus flow.
- Plan 01-11 (messaging hardening / WR-01) is next and unaffected by this plan's additions.

---
*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

- Created files verified on disk: `01-10-SUMMARY.md`, both entrypoint main.tsx files, both entrypoint test files — FOUND
- Commits verified in git log: `05af3da` (feat, Task 1), `6999be2` (test, Task 2), `5ea0a51` (feat, Task 3) — FOUND
- Final `pnpm verify:phase-1` exit 0; 26 files / 167 tests green; content bundle clean

