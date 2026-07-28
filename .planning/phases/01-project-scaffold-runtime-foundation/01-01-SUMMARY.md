---
phase: 01-project-scaffold-runtime-foundation
plan: 01
subsystem: ui, theme, persistence
tags: [chrome-extension, zustand, antd, chrome-storage, theme, react, side-panel]
requires: []
provides:
  - chrome.storage.local Zustand adapter (chromeStorageAdapter)
  - ThemeStore with chrome.storage.local persistence
  - ThemeToggle component (light/dark/auto cycle)
  - antdConfig with UI-SPEC seed tokens
  - SidePanelShell with Tabs nav, header, footer, skeleton
affects: phase-01-plans-02-through-05
tech-stack:
  added: []
  patterns:
    - Zustand persist with chrome.storage.local adapter
    - Theme toggle cycle light→dark→auto→light
    - Skeleton loading while persist rehydrates
key-files:
  created:
    - src/core/theme/chromeStorageAdapter.ts
    - src/components/common/ThemeToggle.tsx
    - tests/components/common/ThemeToggle.test.tsx
    - tests/components/sidepanel/SidePanelShell.test.tsx
  modified:
    - tests/setup.ts
    - src/core/theme/ThemeStore.ts
    - src/core/theme/antdConfig.ts
    - src/core/i18n/strings.ts
    - src/core/components/ErrorBoundary.tsx
    - src/components/sidepanel/SidePanelShell.tsx
    - tests/core/theme/ThemeStore.test.ts
key-decisions:
  - "chrome.storage.local adapter as separate module (not inlined into ThemeStore) for reuse by WorkspaceStore in Plan 01-06"
  - "antdConfig stripped of all per-component overrides; uses only UI-SPEC seed tokens (colorPrimary: #1677ff, borderRadius: 6, controlHeight: 32)"
  - "SidePanelShell migrated from Menu-based nav to antd Tabs per UI-SPEC"
  - "ErrorBoundary updated to use shell.error copy ('Something went wrong. Please reload the extension.')"
patterns-established:
  - "Zustand persist → createJSONStorage(() => chromeStorageAdapter) for cross-context persistence"
  - "ThemeStore.chromeStorageAdapter as reusable module for other stores"
  - "Skeleton loading during persist rehydration prevents flash-of-wrong-theme"
requirements-completed: [SHELL-04]
coverage:
  - id: D1
    description: "chrome.storage.local adapter implements Zustand StateStorage (getItem/setItem/removeItem)"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/core/theme/ThemeStore.test.ts#chromeStorageAdapter"
        status: pass
    human_judgment: false
  - id: D2
    description: "ThemeStore persists to chrome.storage.local via chromeStorageAdapter"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/core/theme/ThemeStore.test.ts#ThemeStore persists mode changes to chrome.storage.local"
        status: pass
    human_judgment: false
  - id: D3
    description: "ThemeToggle cycles light→dark→auto→light on click"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/components/common/ThemeToggle.test.tsx#cycles mode light→dark→auto→light on click"
        status: pass
    human_judgment: false
  - id: D4
    description: "SidePanelShell renders header (NowPilot + ThemeToggle), Tabs nav (4 items, 2 disabled), footer ('Open in Full Tab')"
    requirement: SHELL-04
    verification:
      - kind: unit
        ref: "tests/components/sidepanel/SidePanelShell.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "antdConfig uses UI-SPEC seed tokens without per-component overrides"
    verification:
      - kind: unit
        ref: "src/core/theme/antdConfig.ts"
        status: pass
    human_judgment: true
    rationale: "Static assertion not automated — manual inspection of seed token values needed"
duration: 12min
completed: 2026-07-28
status: complete
---

# Phase 01 Plan 01: Theme Persistence Tracer — chrome.storage.local adapter → ThemeStore → ThemeToggle → SidePanelShell

**Chrome storage persistence for theme across browser reload, with ThemeToggle UI component and full SidePanel shell refactored to UI-SPEC (Tabs nav, footer, skeleton loading state)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-28T17:54:00Z
- **Completed:** 2026-07-28T18:03:30Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Created `chromeStorageAdapter` — Zustand StateStorage implementation backed by `chrome.storage.local` (getItem/setItem/removeItem)
- Refactored `ThemeStore` to use chromeStorageAdapter via `createJSONStorage(() => chromeStorageAdapter)` instead of default localStorage
- Stripped antdConfig to UI-SPEC seed tokens only (colorPrimary: `#1677ff`, borderRadius: 6, controlHeight: 32) — no per-component overrides
- Created `ThemeToggle` component — cycles light→dark→auto→light with antd Tooltip and mode hints per copywriting contract
- Added i18n keys: `theme.toggle`, `theme.switchToDark`, `theme.switchToLight`, `shell.loading`, `shell.error`, `sidepanel.footer`
- Refactored `SidePanelShell` — header (NowPilot + ThemeToggle), Tabs nav (Chat/Agent active, Write/TeamGQM disabled with "Available in Phase 7"), content area, footer ("Open in Full Tab" button), Skeleton loading during rehydration
- Added chrome.storage.local and BroadcastChannel mocks to test setup
- Added ResizeObserver and matchMedia mocks for antd component testing in jsdom
- Updated ErrorBoundary to use UI-SPEC shell.error copy

## Task Commits

Each task was committed atomically:

1. **Task 1: chrome storage adapter with test mocks (TDD)** — `a51884a` (test/feat)
2. **Task 2: ThemeStore refactor + ThemeToggle component (TDD)** — `ba259cd` (feat)
3. **Task 3: SidePanelShell refactor (Tabs, theme toggle, footer, skeleton)** — `a6b5054` (feat)

## Files Created/Modified

### Created
- `src/core/theme/chromeStorageAdapter.ts` — Zustand StateStorage adapter backed by chrome.storage.local
- `src/components/common/ThemeToggle.tsx` — Theme mode cycle button (light/dark/auto) with antd Tooltip
- `tests/components/common/ThemeToggle.test.tsx` — 7 tests for ThemeToggle render, cycle, persistence
- `tests/components/sidepanel/SidePanelShell.test.tsx` — 8 tests for shell render, header, tabs, footer

### Modified
- `tests/setup.ts` — Added chrome.storage.local mock, BroadcastChannel mock, ResizeObserver mock, matchMedia mock, `__broadcast` helper
- `src/core/theme/ThemeStore.ts` — Switched to chromeStorageAdapter via createJSONStorage
- `src/core/theme/antdConfig.ts` — Stripped per-component overrides; UI-SPEC seed tokens only
- `src/core/i18n/strings.ts` — Added 6 new i18n keys
- `src/core/components/ErrorBoundary.tsx` — Updated subTitle to use shell.error copy
- `src/components/sidepanel/SidePanelShell.tsx` — Full refactor per UI-SPEC
- `tests/core/theme/ThemeStore.test.ts` — Added 8 chromeStorageAdapter tests

## Decisions Made

- chromeStorageAdapter kept as separate module (not inlined into ThemeStore.ts) for reuse by WorkspaceStore in Plan 01-06
- antdConfig completely stripped of component-level overrides — only UI-SPEC seed tokens remain; algorithm selection unchanged
- SidePanelShell tab items use `items` prop API for antd Tabs; tooltips placed on disabled tab labels
- Test mocks added to shared setup.ts rather than per-test-file to avoid duplication across plans

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ResizeObserver and matchMedia mocks for jsdom test environment**
- **Found during:** Task 3 (SidePanelShell test)
- **Issue:** antd Layout/Tabs internally use ResizeObserver, which is not available in jsdom — caused SidePanelShell tests to fail with "ResizeObserver is not defined" caught by ErrorBoundary
- **Fix:** Added ResizeObserver polyfill and matchMedia mock to tests/setup.ts
- **Files modified:** tests/setup.ts
- **Verification:** All 50 tests pass including SidePanelShell tests

---

**Total deviations:** 1 (Rule 3 — blocking)
**Impact on plan:** Auto-fix was necessary for component test infrastructure. No scope creep.

## Issues Encountered

- antd v6 Layout/Tabs components require `ResizeObserver` and `window.matchMedia` which are not available in jsdom — added mock implementations to test setup. This is a standard pattern for antd component testing in jsdom.

## Threat Surface Scan

No threat flags introduced — all changes are within the plan's threat_model scope. chrome.storage.local sandboxing (T-01-01, accepted), BroadcastChannel same-origin scope (T-01-02, accepted), and ThemeToggle rapid-click DoS (T-01-03, accepted) remain the only relevant threats.

## Stub Tracking

No stubs detected — all components render real UI (ThemeToggle with icons, SidePanelShell with full Tabs/footer/skeleton, ErrorBoundary with real result card).

## Next Phase Readiness

- Theme persistence foundation complete — Ready for Plan 01-02 (cross-surface theme sync via BroadcastChannel + AppShell integration)
- chromeStorageAdapter is a reusable module that Plan 01-06 can use for WorkspaceStore persistence
- SidePanelShell component structure is final — Plan 01-04/01-05 will add onboarding wizard and command palette integration

---

*Phase: 01-project-scaffold-runtime-foundation*
*Completed: 2026-07-28*
