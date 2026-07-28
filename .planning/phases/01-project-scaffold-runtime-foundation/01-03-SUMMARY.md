---
phase: 01-project-scaffold-runtime-foundation
plan: 03
subsystem: command-palette
tags: [command-registry, command-palette, cmd+k, keyboard-navigation, antd-modal]
requires:
  - 01-01 (i18n strings module, antd/React setup)
provides:
  - SHELL-05 (Cmd+K command palette for both surfaces)
affects: []
tech-stack:
  added: [Command type interface]
  patterns:
    - "Pure TypeScript core module in src/core/commands/ (no React imports)"
    - "Dumb UI component receives commands as prop — parent shell passes surface-specific commands"
key-files:
  created:
    - src/core/commands/CommandRegistry.ts
    - src/components/common/CommandPalette.tsx
    - tests/core/commands/CommandRegistry.test.ts
    - tests/components/common/CommandPalette.test.tsx
  modified:
    - src/core/i18n/strings.ts
decisions:
  - "CommandRegistry as a singleton object (not a class) — consistent with existing KeymapRegistry pattern"
  - "String.prototype.includes() for search (no fuzzy lib) — command set <20 items in Phase 1 per RESEARCH.md"
  - "CommandPalette receives commands as prop — parent shell owns surface filtering (dumb UI, smart parent)"
  - "Modal handles Escape natively via onCancel — no duplicate keydown handler needed"
  - "List items with simple div layout (name+category row, description below) — no complex antd List.Item.Meta"
metrics:
  duration: "~11 min"
  completed_date: "2026-07-28"
  tasks: 2
  files: 5
  test_count: 26
status: complete
---

# Phase 01 Plan 03: Command Registry + Command Palette

**Cmd+K command palette as a self-contained unit:** a pure TypeScript command registry for registration/search/execution, and a React component (antd Modal + Input + List) for the overlay UI. Shell integration (keydown listeners, surface-specific command sets) deferred to Plan 01-05.

## Tasks Completed

### Task 1: CommandRegistry — registration, search, execution (TDD)

| Stage | Commit | Description |
|-------|--------|-------------|
| RED | `88243e6` | 14 failing tests for all CommandRegistry operations |
| GREEN | `bd3cdbc` | Full implementation: register/unregister/get/search/execute/getAll |

- `CommandRegistry` singleton with `Map<string, Command>` backing store
- `register(cmd)` — throws on duplicate id
- `unregister(id)` — no-op if not found
- `get(id)` → `Command | undefined`
- `search(query)` — case-insensitive substring on name+description; empty query returns all
- `execute(id)` — calls `cmd.action()`; throws if not found
- `getAll()` — returns all commands as array
- Pure TypeScript — zero React imports

### Task 2: CommandPalette UI component (TDD)

| Stage | Commit | Description |
|-------|--------|-------------|
| RED | `967aefc` | 12 failing tests for rendering, filtering, keyboard nav, empty state |
| GREEN | `98c0245` | Full component + i18n strings |

- `CommandPalette(props: { commands, open, onClose })` — dumb UI component
- antd `Modal` (560px, centered, `destroyOnHidden`) with auto-focused `Input`
- Real-time substring filter on command name + description (case-insensitive)
- Keyboard navigation: ArrowDown/ArrowUp (bounds-clamped), Enter (execute + close), Escape (close via Modal's onCancel)
- Empty state: antd `Empty` component with `t('commands.noResults')` copy
- i18n keys added: `commands.placeholder`, `commands.noResults`, `commands.category.{theme,navigation,system}`

## Verification Results

```text
✓ tests/core/commands/CommandRegistry.test.ts (14 tests)
✓ tests/components/common/CommandPalette.test.tsx (12 tests)
✓ tsc --noEmit (no errors)
✓ Full suite: 90 tests passed across 12 files
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Escape key double-fires onClose**

- **Found during:** Task 2 test execution
- **Issue:** The window-level keydown handler's Escape case called `onClose()` simultaneously with the antd Modal's built-in Escape handling (via `onCancel`), causing `onClose` to fire twice.
- **Fix:** Removed the redundant `Escape` case from the keyboard handler. Modal's `onCancel` already handles Escape natively.
- **Files modified:** `src/components/common/CommandPalette.tsx`
- **Commit:** `98c0245`

**2. [Rule 1 — Bug] `destroyOnClose` deprecated in antd v6**

- **Found during:** Task 2 test execution (antd runtime warning)
- **Issue:** antd v6 deprecated `destroyOnClose` in favor of `destroyOnHidden`.
- **Fix:** Renamed prop to `destroyOnHidden`.
- **Files modified:** `src/components/common/CommandPalette.tsx`
- **Commit:** `98c0245`

**3. [Rule 1 — Bug] `useRef<HTMLInputElement>` type incompatible with antd Input**

- **Found during:** `tsc --noEmit` type check
- **Issue:** antd Input expects `InputRef` type, not `HTMLInputElement`. The ref was unused (autoFocus works via prop).
- **Fix:** Removed the unused `inputRef` variable entirely.
- **Files modified:** `src/components/common/CommandPalette.tsx`
- **Commit:** `98c0245`

## Known Stubs

None. Both components are fully implemented with no placeholder data, hardcoded empty values, or TODOs.

## Threat Surface Scan

No new security-relevant surface introduced beyond what the plan's `<threat_model>` covers:

| Threat | Disposition | Status |
|--------|-------------|--------|
| T-01-07 Spoofing (command execution) | Mitigated | ✅ Search query is never eval'd; only pre-registered Command action callbacks execute; antd Input auto-escapes rendered text |
| T-01-08 DoS (rapid key presses) | Accepted | ✅ Keyboard nav throttled by React state updates; no async/network in Phase 1 commands |

## Self-Check: PASSED

- [x] `src/core/commands/CommandRegistry.ts` exists — 73 lines
- [x] `src/components/common/CommandPalette.tsx` exists — 143 lines
- [x] `tests/core/commands/CommandRegistry.test.ts` exists — 126 lines
- [x] `tests/components/common/CommandPalette.test.tsx` exists — 241 lines
- [x] Commit `88243e6` exists — test(01-03): add failing tests for CommandRegistry
- [x] Commit `bd3cdbc` exists — feat(01-03): implement CommandRegistry
- [x] Commit `967aefc` exists — test(01-03): add failing tests for CommandPalette
- [x] Commit `98c0245` exists — feat(01-03): implement CommandPalette
- [x] All 26 tests pass (14 + 12)
- [x] `tsc --noEmit` passes with zero errors
