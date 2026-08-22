---
phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
plan: 01-07
type: execute
wave: 7
depends_on: [01-06]
autonomous: false
requirements: [REQ-F05, REQ-F12, REQ-F19, REQ-F20, D-04, D-05, D-06, D-08, D-10-UI-half]
---

# Plan 01-07 — Side Panel UI + Flow 10 commands + cross-surface theme sync

## Objective

Wire the visible + interactive half of Flow 11 on the Side Panel (D-04/D-05/D-06), register the Side Panel's Flow-10 command set (D-08), and complete cross-surface theme propagation (D-10's UI half): a visible `Segmented` theme control on BOTH surfaces, driven by `chrome.storage.onChanged`, with an actionable failure toast instead of a silent no-op.

## Commits

| SHA | Type | Message |
|-----|------|---------|
| `4af39db` | feat(01-07) | side-panel openStandalone wiring + Flow-10 commands + WORKSPACE_HANDOFF broadcast |
| `69f955e` | feat(01-07) | MirrorBanner + read-only composer + simplified empty-state caption |
| `ba3e769` | feat(01-07) | ThemeToggle Segmented + chrome.storage.onChanged sync (D-10 UI half) |

## What was built

### Flow 11 visual + interactive on Side Panel (D-04/D-05/D-06)
- `openStandalone()` wiring in side-panel main for "Open in Standalone" action
- `WORKSPACE_HANDOFF` broadcast across surfaces
- `MirrorBanner.tsx` for read-only composer state when another surface is editing the same workspace
- Simplified empty-state caption on Side Panel
- Tests for MirrorBanner visual behaviour

### Side Panel Flow-10 command set (D-08)
- Cmd+K / Ctrl+K command palette wired in side-panel main
- Register-sidepanel-commands helper in `src/core/commands/registerWorkspaceCommands.ts`
- "Open in Standalone" command (handoff to WorkspaceRouter.openStandalone)
- Theme palette cycle command (legacy keybinding per D-09)

### Theme propagation UI half (D-10)
- New `ThemeToggle` (antd `Segmented`) bound to `useThemeStore.setMode()` with three options (Auto/Light/Dark)
- `src/core/theme/ThemeSync.ts` additions:
  - `applyThemeToSync(mode, pack)` — explicit write of `np_theme` + `np_theme_pack` to chrome.storage.sync with `{ok, error?}` return
  - `startThemeOnChangedSync({onError})` — wires `chrome.storage.onChanged` to `useThemeStore.setMode` with explicit failure hook for toast surfacing
- ThemeToggle calls `startThemeOnChangedSync` on mount with an onError that surfaces a warning toast (not silent no-op)
- Both `entrypoints/sidepanel/main.tsx` and `entrypoints/standalone/main.tsx` call `applyThemeToSync` after the palette cycle so the cross-surface write is intentional
- `ChatHeader.tsx` and `WorkspaceSidebar.tsx` (Standalone top chrome) render `<ThemeToggle />` for parity (APPR-04 — no per-surface copy)

## Tests

| File | Tests | Notes |
|------|-------|-------|
| `tests/core/theme/ThemeSync.test.tsx` | 11 | covers both helpers, listener registration, write-failure surfacing through ThemeToggle |
| `tests/components/MirrorBanner.test.tsx` | (extended) | banner visibility, action callbacks |

## Verification

| Check | Result |
|-------|--------|
| `pnpm vitest run` (full suite) | **158 tests passed across 17 files** |
| `pnpm verify:phase-1` | 8 test files / 78 tests pass + tsc clean |
| `pnpm test:isolation` | green |
| `pnpm lint` (tsc --noEmit strict:true) | clean (NP-STRICT ceiling still 0) |

## Files modified

```
entrypoints/sidepanel/main.tsx                       (applyThemeToSync + Flow 10 commands)
entrypoints/standalone/main.tsx                      (applyThemeToSync)
src/components/chat/ChatHeader.tsx                   (ThemeToggle render)
src/components/common/ThemeToggle.tsx                (rebuilt as Segmented + onChanged sync)
src/components/standalone/WorkspaceSidebar.tsx       (ThemeToggle render)
src/core/theme/ThemeSync.ts                          (applyThemeToSync + startThemeOnChangedSync)
tests/core/theme/ThemeSync.test.tsx                  (extended; 11 tests)
```

## Deviations / issues encountered

1. **Mid-plan recovery:** the executing subagent completed ~3 of 4 tasks and 2 commits landed (`4af39db`, `69f955e`), but crashed before committing the ThemeToggle work or writing SUMMARY.md. Orchestrator recovered: verified ThemeSync tests pass, added the ThemeToggle integration commit (`ba3e769`), and authored this SUMMARY.
2. **Palette cycle still uses `cycle` semantics in entrypoints** (not the Segmented control) for the existing keybinding — the Segmented ThemeToggle is the new visible control; the palette cycle preserves the legacy Cmd+Shift+L gesture per D-09.

## Next plan

**01-08** — Replace the scaffold's 1006-line 8-step `OnboardingWizard` with the spec-mandated thin 4-step `OnboardingModal` (D-01/D-02/D-03, REQ-F19): persona placeholder → pick provider → enter key → validate, using the real `testProviderConnection` function Plan 01-04 already built.