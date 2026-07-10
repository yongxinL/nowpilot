---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 03
subsystem: cross-surface-coordination
tags: [broadcast-bus, workspace-router, keymap-registry, page-registries]
key-files:
  - src/core/messaging/broadcastBus.ts
  - src/core/routing/workspaceRouter.ts
  - src/core/commands/keymapRegistry.ts
  - src/core/registries/SidePanelPageRegistry.ts
  - src/core/registries/FullAppPageRegistry.ts
metrics:
  test_files: 4
  total_tests: 25
  passing_tests: 25
  broadcast_bus_implemented: true
  tab_dedup_implemented: true
---

# Summary: Plan 01-03 — Messaging, Routing, Keymaps, Page Registries

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | `20f44b0` | BroadcastBus (WRKSP-02) + WorkspaceRouter with tab dedup (WRKSP-03) |
| 2    | `20f44b0` | KeymapRegistry with chrome.commands integration (CMD-03) |
| 3    | `20f44b0` | SidePanelPageRegistry + FullAppPageRegistry (SHELL-03, SHELL-04) |

## Deviations

- **KeymapRegistry imports debugLog**: Uses path alias workaround with relative import (`../utils/debugLog`) to avoid circular dependency concerns.
- **Registry sort stability**: Both page registries use `Array.from(pages.values()).sort(...)` with stable sort (ES2019+), equal-order items preserve insertion order.

## Self-Check: PASSED

- [x] All 25 tests pass (broadcastBus 4, workspaceRouter 6, keymapRegistry 8, registries 7)
- [x] `pnpm tsc --noEmit` exits 0
- [x] BroadcastBus dispatches only on areaName === 'session'
- [x] WorkspaceRouter focuses existing tab + updates window (dedup) before creating new
- [x] KeymapRegistry throws on duplicate, logs warning on unknown command
- [x] Both page registries independent singletons with sorted getAll()
