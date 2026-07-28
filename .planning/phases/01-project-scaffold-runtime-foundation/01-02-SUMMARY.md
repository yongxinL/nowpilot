---
phase: 01-project-scaffold-runtime-foundation
plan: 02
subsystem: ui, theme, runtime
tags: [chrome-extension, broadcast-channel, theme-sync, react, antd, zustand, side-panel, full-app-tab]
requires:
  - phase: 01-01
    provides: chromeStorageAdapter, ThemeStore with persistence, ThemeToggle component, BroadcastBus
provides:
  - useThemeSync hook (BroadcastChannel-based cross-surface theme sync)
  - publishThemeChange function for broadcasting theme changes
  - ThemeStore.setMode broadcasts THEME_CHANGED on np_theme channel
  - AppShell with hydration skeleton, ThemeToggle, TeamGQM disabled placeholder
affects: phase-01-plans-03-through-05
tech-stack:
  added: []
  patterns:
    - BroadcastChannel theme sync via BroadcastBus subscribe/publish on np_theme channel
    - Cross-surface bidirectional sync: both shells call useThemeSync
    - Message type guard (THEME_CHANGED) prevents processing unrelated broadcasts
    - Hydration guard with Skeleton before Persist rehydration completes
key-files:
  created:
    - src/core/theme/ThemeSync.ts
    - tests/core/theme/ThemeSync.test.tsx
    - tests/components/app/AppShell.test.tsx
  modified:
    - src/core/theme/ThemeStore.ts
    - src/components/app/AppShell.tsx
key-decisions:
  - "useThemeSync as standalone hook (not inlined into each shell) for single-responsibility and testability"
  - "publishThemeChange as named export for direct use by other callers beyond ThemeStore.setMode"
  - "ThemeStore.setMode directly calls publish (not publishThemeChange) to avoid circular dependency"
  - "BroadcastChannel guard (typeof BroadcastChannel !== 'undefined') in setMode for environments without it"
  - "AppShell skeleton matches SidePanelShell pattern exactly — Skeleton active + 'Loading workspace…' text"
  - "TeamGQM menu item follows same pattern as SidePanel tabs: Tooltip 'Available in Phase 7' + disabled"
pattern-established:
  - "Cross-surface sync: publish from store action → BroadcastChannel → useThemeSync in each shell"
  - "ThemeStore as single source of truth: all mode changes route through setMode, which both persists AND broadcasts"
  - "AppShell sidebar bottom area: ThemeToggle centered above collapse button, 4px gap"
requirements-completed: [SHELL-04]
coverage:
  - id: D1
    description: "useThemeSync hook subscribes to np_theme BroadcastChannel and applies THEME_CHANGED messages"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/core/theme/ThemeSync.test.tsx#useThemeSync subscribes to np_theme and applies THEME_CHANGED messages"
        status: pass
    human_judgment: false
  - id: D2
    description: "publishThemeChange broadcasts THEME_CHANGED on np_theme channel"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/core/theme/ThemeSync.test.tsx#publishThemeChange broadcasts THEME_CHANGED on np_theme channel"
        status: pass
    human_judgment: false
  - id: D3
    description: "useThemeSync ignores non-THEME_CHANGED message types (type guard)"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/core/theme/ThemeSync.test.tsx#ignores non-THEME_CHANGED messages on np_theme channel"
        status: pass
    human_judgment: false
  - id: D4
    description: "useThemeSync cleanup removes listener on unmount"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/core/theme/ThemeSync.test.tsx#unmount cleanup removes the listener"
        status: pass
    human_judgment: false
  - id: D5
    description: "AppShell renders skeleton during ThemeStore rehydration"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/components/app/AppShell.test.tsx#shows skeleton loading during rehydration when hasHydrated is false"
        status: pass
    human_judgment: false
  - id: D6
    description: "AppShell sidebar has ThemeToggle above collapse button"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/components/app/AppShell.test.tsx#renders ThemeToggle in sidebar bottom area"
        status: pass
    human_judgment: false
  - id: D7
    description: "AppShell TeamGQM menu item is disabled with tooltip"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/components/app/AppShell.test.tsx#renders TeamGQM menu item with disabled state"
        status: pass
    human_judgment: false
  - id: D8
    description: "AppShell responds to THEME_CHANGED broadcast via useThemeSync"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/components/app/AppShell.test.tsx#responds to THEME_CHANGED broadcast via useThemeSync"
        status: pass
    human_judgment: false
  - id: D9
    description: "AppShell has no imports from src/components/sidepanel/ (cross-entrypoint isolation)"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/components/app/AppShell.test.tsx#does not import from src/components/sidepanel/"
        status: pass
    human_judgment: false
duration: 10min
completed: 2026-07-28
status: complete
---

# Phase 01 Plan 02: BroadcastChannel Theme Sync + AppShell Integration

**Cross-surface theme sync via BroadcastChannel np_theme channel, useThemeSync hook, publishThemeChange function, and AppShell with hydration skeleton, ThemeToggle, and disabled TeamGQM placeholder**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-28T08:09:46Z
- **Completed:** 2026-07-28T18:18:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `useThemeSync` React hook — subscribes to `BroadcastChannel('np_theme')` and applies `THEME_CHANGED` messages via `ThemeStore.setMode`, bidirectional cross-surface sync
- Created `publishThemeChange` function — broadcasts `{ type: 'THEME_CHANGED', mode }` on `np_theme` channel for other surfaces to react
- Modified `ThemeStore.setMode` — every local theme change publishes `THEME_CHANGED` via BroadcastChannel with `typeof BroadcastChannel` guard
- Integrated `AppShell` — hydration skeleton (Skeleton + "Loading workspace…"), `useThemeSync()` call at component top, TeamGQM menu item (disabled with "Available in Phase 7" tooltip), ThemeToggle above collapse button in sidebar bottom area
- Created AppShell test suite (10 tests) — covers hydration guard, ThemeToggle presence, TeamGQM disabled state, theme sync broadcast reception, collapse button, cross-entrypoint isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: BroadcastChannel theme sync hook** — `d6e64c6` (test), `c341de1` (feat)
2. **Task 2: AppShell integration** — `24259cd` (feat)

**Plan metadata:** *(final commit below)*

## Files Created/Modified

### Created
- `src/core/theme/ThemeSync.ts` — useThemeSync hook + publishThemeChange function using BroadcastBus
- `tests/core/theme/ThemeSync.test.tsx` — 4 tests for useThemeSync (subscribe, publish, type guard, cleanup)
- `tests/components/app/AppShell.test.tsx` — 10 tests for AppShell (hydration, theme sync, sidebar, TeamGQM)

### Modified
- `src/core/theme/ThemeStore.ts` — setMode now publishes THEME_CHANGED via BroadcastChannel
- `src/components/app/AppShell.tsx` — hydration skeleton, useThemeSync, ThemeToggle, TeamGQM disabled placeholder

## Decisions Made

- `useThemeSync` as standalone hook (not inlined into each shell) for single-responsibility and testability
- `publishThemeChange` as named export for direct use by other callers beyond ThemeStore.setMode (e.g., SidePanelShell in Plan 01-01)
- `ThemeStore.setMode` directly calls `publish` (not `publishThemeChange`) to avoid circular dependency (ThemeStore → BroadcastBus is fine; ThemeStore → ThemeSync → BroadcastBus would be unnecessary)
- `BroadcastChannel` guard (`typeof BroadcastChannel !== 'undefined'`) in setMode for environments (test, Node) that may not have BroadcastChannel
- AppShell hydration guard follows exact same pattern as SidePanelShell: antd Skeleton active + "Loading workspace…" centered text
- TeamGQM menu item follows same disabled + Tooltip pattern as Side Panel tabs for consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created AppShell test file**
- **Found during:** Task 2 verification
- **Issue:** Plan's verify step specifies `npx vitest run tests/components/app/AppShell.test.tsx` but the test file didn't exist (Wave 0 gap)
- **Fix:** Created comprehensive AppShell test file covering hydration skeleton, ThemeToggle, TeamGQM disabled state, theme sync broadcast, collapse button, and cross-entrypoint isolation
- **Files modified:** tests/components/app/AppShell.test.tsx (created)
- **Verification:** All 10 tests pass via `npx vitest run tests/components/app/AppShell.test.tsx`
- **Committed in:** 24259cd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Test file was necessary for verification. No scope creep — tests match the plan's acceptance criteria exactly.

## Issues Encountered

- Test file had to be renamed from `.ts` to `.tsx` because vitest/esbuild treats `.ts` files as TypeScript without JSX support — self-corrected during RED phase of Task 1 TDD
- Antd act() warnings in AppShell tests are the same pattern seen in all existing antd component tests in jsdom — expected, non-blocking

## Threat Surface Scan

No new threat flags introduced. BroadcastChannel `np_theme` carries only `{ type: 'THEME_CHANGED', mode }` — matching T-01-05 (mitigated: message type guard) and T-01-06 (accepted: no PII/secrets in channel). The BroadcastChannel mock in tests/setup.ts was already created by Plan 01-01.

## Next Phase Readiness

- Cross-surface theme sync complete — Plan 01-03 can build the command palette without theme sync concerns
- AppShell skeleton + ThemeToggle + sidebar navigation are in place — Plan 01-04/01-05 will add the command palette and onboarding wizard integration
- Both surfaces (SidePanelShell from Plan 01-01, AppShell from this plan) call `useThemeSync()` for full bidirectional sync
- `publishThemeChange` is available for any future component that needs to programmatically broadcast a theme change (e.g., command palette "Toggle Theme" command)

---

*Phase: 01-project-scaffold-runtime-foundation*
*Completed: 2026-07-28*
