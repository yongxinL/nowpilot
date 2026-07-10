---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 04
subsystem: ui-shells
tags: [side-panel, full-app, popup, skeleton-pages, theme-integration]
key-files:
  - src/entrypoints/sidepanel/App.tsx
  - src/entrypoints/app/App.tsx
  - src/entrypoints/popup/App.tsx
  - src/core/pages/ChatPage.tsx
  - src/core/pages/AgentPage.tsx
  - src/core/pages/NotesPage.tsx
  - src/core/pages/OptionsPage.tsx
metrics:
  surface_files: 9
  skeleton_pages: 4
  test_files: 1
  passing_tests: 4
  configprovider_root: true
  xprovider_root: false
---

# Summary: Plan 01-04 — Shell Layouts, Theme Integration, Skeleton Pages

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | `4fa7e6f` | Entry point HTML + React mount points for all 3 surfaces |
| 2    | `4fa7e6f` | Side Panel (compact), Full App (default), Popup shells with ConfigProvider + antdConfig |
| 3    | `4fa7e6f` | Skeleton pages registered, workspace handoff, theme integration test |

## Deviations

- **XProvider → ConfigProvider**: Surface root uses ConfigProvider (via antdConfig.ts) per PRODUCT_SPEC §5.5. XProvider is deferred to Phase 7 for Chat/Agent subtrees.
- **Side panel nav**: Uses AntD `Layout.Sider` with `Menu` instead of a separate nav rail, consistent with WXT conventions.
- **Popup static theme**: Popup uses `getAntdConfig({ mode: 'auto', compact: true })` since it has no theme toggle.
- **Theme test**: Uses dynamic imports for surface components to avoid mocking issues with side-effect module-level registrations.

## Self-Check: PASSED

- [x] `pnpm wxt build` succeeds — all 3 surfaces bundled
- [x] `pnpm tsc --noEmit` passes
- [x] Theme test passes (4 tests: SidePanel renders, toggle button visible, FullApp renders, Popup renders)
- [x] No static AntD API calls (THEME-06)
- [x] No XProvider in surface root — ConfigProvider used exclusively
- [x] Side Panel has compact density, Full App has default density
- [x] All 4 skeleton pages registered and navigable
- [x] Open Full App from Side Panel calls workspaceRouter.openFullApp()
- [x] Both surfaces import getAntdConfig from antdConfig.ts
- [x] Zero cross-surface imports between sidepanel/app entrypoints
