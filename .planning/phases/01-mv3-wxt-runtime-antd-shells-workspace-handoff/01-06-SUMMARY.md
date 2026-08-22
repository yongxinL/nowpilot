---
phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
plan: 06
subsystem: workspace-routing
tags: [workspace-router, broadcast-bus, runtime-envelope, command-registry, standalone-shell, rename, mvp-tracer, threat-t-01-16, threat-t-01-17, threat-t-01-18]

# Dependency graph
requires:
  - phase: 01
    plan: 05
    provides: "isPrimaryWriter() predicate, ActiveSurface='standalone' canonical rename, frozen extraction envelope types, chromeStorageAdapter for WorkspaceStore, WorkspaceStore migrate v1"
provides:
  - "WorkspaceRouter.openStandalone(workspaceId, conversationId?, page?, opts?) — fixed target (standalone.html), cross-window tab dedup, onSettled callback for downstream toasts"
  - "WorkspaceStore.setWorkspaceId(id) action routing through zustand set() (triggers persistence + subscribers)"
  - "hydrateFromURL fix — both workspaceId and conversationId paths now route through set(), not the legacy Object.assign bypass"
  - "STANDALONE_OPEN message type (renamed from FULL_APP_OPEN) in RuntimeEnvelope + WorkspaceSync + 'standalone' source union literal"
  - "StandalonePageRegistry (renamed from FullAppPageRegistry) + StandalonePageRegistration type + standalonePages backing map"
  - "StandaloneShell.tsx (renamed from StandaloneWorkspace.tsx) — calls WorkspaceRouter.hydrateFromURL(new URLSearchParams(window.location.search)) on mount"
  - "src/core/commands/registerWorkspaceCommands.ts — registerStandaloneCommands(deps) exporting the 4-command Flow-10 base set (focus-side-panel, open-options, toggle-theme, reload-extension) with cleanup, deterministic registration order, gesture-safe focusSidePanel"
affects:
  - "01-07 (Side Panel Flow-10 base set via registerSidepanelCommands — depends on registerWorkspaceCommands module shape)"
  - "01-07 (Side Panel mirror-banner + handleOpenStandalone migration to WorkspaceRouter.openStandalone)"
  - "02 (WorkspaceStore authoritativeness — builds on setWorkspaceId/setConversationId symmetric shape)"
  - "15 (Full RICH command catalog — extends the base set on each surface)"

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 13750        # 55000 chars / 4 over files actually changed (src + entrypoints + tests, no .planning churn)
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WorkspaceRouter.openStandalone: callback-style chrome.tabs.query/create/update + chrome.windows.update for cross-window focus; onSettled({ok}) callback contract for downstream toasts"
    - "WorkspaceStore actions that touch version do `set(state => { state.x = y; state.version++ })` — symmetric shape for setWorkspaceId/setConversationId so persistence + subscribers always fire"
    - "StandaloneShell mount hydrates from URLSearchParams(window.location.search) so cross-tab handoff lands in WorkspaceStore before any panel renders"
    - "registerStandaloneCommands(deps) — fixed-order 4-command registration with cleanup; CommandRegistry.register throws on duplicate, so cleanup-before-reregister is the only safe remount path"

key-files:
  created:
    - src/core/commands/registerWorkspaceCommands.ts
    - tests/core/commands/registerWorkspaceCommands.test.ts
  modified:
    - src/core/workspace/WorkspaceRouter.ts
    - src/core/workspace/WorkspaceStore.ts
    - src/core/workspace/WorkspaceSync.ts
    - src/core/runtime/RuntimeEnvelope.ts
    - src/core/registry/Registry.ts
    - src/core/registry/AddonRegistry.ts
    - src/core/i18n/strings.ts
    - src/components/standalone/StandaloneShell.tsx (renamed from StandaloneWorkspace.tsx)
    - entrypoints/standalone/main.tsx
    - src/main.tsx
    - tests/core/workspace/WorkspaceRouter.test.ts

key-decisions:
  - "openStandalone uses chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html*') }) with the trailing wildcard so the dedup matches the query-string variants openStandalone itself emits (URL pattern includes '?workspaceId=...')"
  - "chrome.windows.update added to the dedup branch for cross-window focus — covers re-opening from a different browser window (T-01-17 mitigation, REQ-F20 cross-window edge)"
  - "opts.onSettled({ok:true|false,error?}) added to openStandalone so 01-07's Side Panel mirror-banner can render toasts without re-querying chrome.runtime.lastError"
  - "setWorkspaceId mirrors setConversationId exactly (set() + version++) — symmetry makes persistence/subscribers consistent across both handoff params and removes the bug class where one path silently bypassed zustand's machinery"
  - "hydrateFromURL still lives in WorkspaceRouter.ts (H2 locked decision) — it calls store.setWorkspaceId/setConversationId rather than owning the mutation"
  - "StandaloneShell's hydrateFromURL call is wrapped in useEffect with empty deps — idempotent, no cleanup, single mount"
  - "registerStandaloneCommands registers commands in a fixed order (focus-side-panel, open-options, toggle-theme, reload-extension) so search() preserves deterministic ordering (REQ-F20 edge)"
  - "focus-side-panel action is synchronous — preserves the user-gesture stack so chrome.sidePanel.open stays allowed (T-01-18 mitigation)"
  - "reload-extension is registered with category 'Extension' (not 'System') and is never wired to a partial-match trigger — only an explicit full selection runs the destructive action (REQ-F20 prohibition)"

patterns-established:
  - "Cross-surface open-path canonicalization: WorkspaceRouter.openStandalone owns all Standalone tab lifecycle; entrypoints no longer roll their own chrome.tabs.query+find+update dance. Side Panel's handleOpenStandalone (entrypoints/sidepanel/main.tsx:11-40) is the next file Plan 01-07 migrates to call WorkspaceRouter.openStandalone."
  - "hydrateFromURL contract: takes URLSearchParams, routes through WorkspaceStore named actions, never mutates the raw getState() result. Future URL-driven state (page param) flows the same way."
  - "Command-set modules: registerStandaloneCommands(deps) is a shared, unit-testable module that entrypoints call from useEffect. The returned cleanup function is the unregister path. Same shape will be used by registerSidepanelCommands (01-07) and Phase 15's RICH catalog extension."

requirements-completed:
  - REQ-F05
  - REQ-F20

# Coverage metadata (#1602) — per-deliverable Requirements Traceability Matrix.
coverage:
  - id: D1
    description: "WorkspaceRouter.openStandalone opens standalone.html (not the legacy non-existent app.html)"
    requirement: REQ-F05
    verification:
      - kind: unit
        ref: tests/core/workspace/WorkspaceRouter.test.ts#queries by standalone.html (not the legacy app.html)
        status: pass
      - kind: unit
        ref: tests/core/workspace/WorkspaceRouter.test.ts#creates a new tab when no existing standalone tab is found
        status: pass
    human_judgment: false
  - id: D2
    description: "openStandalone focuses the existing standalone tab (no duplicate create), including cross-window via chrome.windows.update"
    requirement: REQ-F05
    verification:
      - kind: unit
        ref: tests/core/workspace/WorkspaceRouter.test.ts#focuses the existing tab (no duplicate create) and cross-window focuses when found
        status: pass
    human_judgment: false
  - id: D3
    description: "hydrateFromURL routes workspaceId through setWorkspaceId (set()-based) so persistence + subscribers fire — not the previous Object.assign bypass"
    requirement: REQ-F05
    verification:
      - kind: unit
        ref: tests/core/workspace/WorkspaceRouter.test.ts#goes through setWorkspaceId (persistence + subscribers fire)
        status: pass
      - kind: unit
        ref: tests/core/workspace/WorkspaceRouter.test.ts#no-op when both params are absent
        status: pass
    human_judgment: false
  - id: D4
    description: "FullAppPageRegistry/FullAppPageRegistration/fullAppPages renamed to StandalonePageRegistry/StandalonePageRegistration/standalonePages (D-07)"
    verification:
      - kind: unit
        ref: grep -rc \"FullAppPageRegistry|FullAppPageRegistration|fullAppPages\" src/ | grep -v ':0'
        status: pass
    human_judgment: false
  - id: D5
    description: "StandaloneWorkspace.tsx renamed to StandaloneShell.tsx; component symbol renamed; all importers updated"
    verification:
      - kind: unit
        ref: test -f src/components/standalone/StandaloneShell.tsx && ! test -f src/components/standalone/StandaloneWorkspace.tsx
        status: pass
    human_judgment: false
  - id: D6
    description: "StandaloneShell mounts by calling WorkspaceRouter.hydrateFromURL(new URLSearchParams(window.location.search))"
    verification:
      - kind: unit
        ref: grep -n hydrateFromURL src/components/standalone/StandaloneShell.tsx
        status: pass
    human_judgment: false
  - id: D7
    description: "FULL_APP_OPEN message type renamed to STANDALONE_OPEN across RuntimeEnvelope + WorkspaceSync + WorkspaceRouter publisher; 'full-app' source literal renamed to 'standalone'"
    verification:
      - kind: unit
        ref: grep -c \"app\\.html|openFullApp|FULL_APP_OPEN|'full-app'|openedFullAppTabId\" src/core/workspace/*.ts src/core/runtime/RuntimeEnvelope.ts
        status: pass
    human_judgment: false
  - id: D8
    description: "registerStandaloneCommands(deps) registers exactly the 4-command Flow-10 base set in deterministic order; cleanup unregisters all 4; CommandRegistry duplicate-throw contract preserved"
    requirement: REQ-F20
    verification:
      - kind: unit
        ref: tests/core/commands/registerWorkspaceCommands.test.ts#registers exactly the 4-command Flow-10 base set in the documented order
        status: pass
      - kind: unit
        ref: tests/core/commands/registerWorkspaceCommands.test.ts#returned cleanup unregisters all 4 ids
        status: pass
      - kind: unit
        ref: tests/core/commands/registerWorkspaceCommands.test.ts#registering twice without cleanup throws on the duplicate id
        status: pass
      - kind: unit
        ref: tests/core/commands/registerWorkspaceCommands.test.ts#CommandRegistry.search(\"\") returns the 4 commands in registration order
        status: pass
    human_judgment: false
  - id: D9
    description: "focus-side-panel action calls deps.focusSidePanel synchronously (gesture preserved so chrome.sidePanel.open stays allowed) — wired to the existing handleOpenSidepanel in entrypoints/standalone/main.tsx that was previously dead code"
    requirement: REQ-F20
    verification:
      - kind: unit
        ref: tests/core/commands/registerWorkspaceCommands.test.ts#invoking focus-side-panel.action calls the deps.focusSidePanel callback exactly once
        status: pass
    human_judgment: false
  - id: D10
    description: "reload-extension is registered with explicit-only semantics (no partial-match auto-run path); command is registered but only fires on full selection"
    requirement: REQ-F20
    verification:
      - kind: unit
        ref: tests/core/commands/registerWorkspaceCommands.test.ts#invoking reload-extension.action calls deps.reloadExtension exactly once (destructive; explicit-only per REQ-F20)
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-08-22
status: complete
---

# Phase 1 Plan 6: Workspace handoff plumbing + Standalone Flow-10 base set

**Canonical Standalone naming across router/store/envelope/registry + a fixed hydrateFromURL that goes through zustand's set(), plus the Standalone surface's 4-command Flow-10 base set with a working gesture-safe Focus Side Panel**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-22T16:53:00Z
- **Completed:** 2026-08-22T17:11:00Z
- **Tasks:** 3 of 3 complete
- **Files modified:** 11 (incl. 1 rename + 2 new)

## Accomplishments

- **Fixed WorkspaceRouter**: `openFullApp` → `openStandalone`; `app.html` → `standalone.html`; `FULL_APP_OPEN` → `STANDALONE_OPEN`; `openedFullAppTabId` → `openedStandaloneTabId`; `'full-app'` source literal → `'standalone'`. The non-existent `app.html` no longer blocks cross-surface handoff.
- **Fixed the latent `hydrateFromURL` bug**: workspaceId was being assigned via `Object.assign(store, { workspaceId: wsId })` directly on the raw `getState()` result, bypassing zustand's `set()` — silently breaking persistence and subscriber notifications. Added `WorkspaceStore.setWorkspaceId` (mirrors `setConversationId` exactly: `set()` + `version++`) and routed both branches through named actions.
- **Cross-window tab dedup**: existing-tab path now does `chrome.tabs.update(tabId, {active:true})` + `chrome.windows.update(windowId, {focused:true})` so re-opening from a different browser window focuses the existing standalone tab instead of creating a duplicate (T-01-17 mitigation).
- **`onSettled` callback contract** on `openStandalone` so Plan 01-07's Side Panel mirror-banner can render success/failure toasts without re-querying `chrome.runtime.lastError`.
- **Renamed `FullAppPageRegistry` → `StandalonePageRegistry`** (with backing `standalonePages` Map, type `StandalonePageRegistration`, and `AddonRegistration.standalonePages` field) — D-07 canonical naming across all registries.
- **Renamed `StandaloneWorkspace.tsx` → `StandaloneShell.tsx`** (component symbol, props interface, all importers including `src/main.tsx`'s dev harness); shell now calls `WorkspaceRouter.hydrateFromURL(new URLSearchParams(window.location.search))` on mount so cross-tab handoff lands in `WorkspaceStore` before any panel renders (H2 + D-04).
- **Standalone Flow-10 base command set** via `src/core/commands/registerWorkspaceCommands.ts`: exactly 4 commands in fixed order — `focus-side-panel`, `open-options`, `toggle-theme`, `reload-extension`. The previously dead `handleOpenSidepanel` is now reachable via `focus-side-panel` (T-01-18 — gesture-safe, synchronous call preserves the user-gesture stack so `chrome.sidePanel.open` is allowed). Cleanup unregisters all 4; remount-without-cleanup throws on duplicate id per `CommandRegistry` contract (REQ-F20 edge).
- **Defensive i18n rename**: `sidepanel.openFullApp`/`openingFullApp`/`fullAppFailed` → `sidepanel.openStandaloneView`/`openingStandaloneView`/`standaloneViewFailed` (no current consumer; keeps catalog consistent).

## Task Commits

Each task was committed atomically:

1. **Task 1: WorkspaceRouter.openStandalone + fix the hydrateFromURL set() bypass + FULL_APP_OPEN rename** — `f69db64` (feat)
2. **Task 2: StandalonePageRegistry rename + StandaloneShell.tsx rename with hydrateFromURL wiring** — `65d5e20` (feat, includes git mv)
3. **Task 3: Standalone entrypoint Flow-10 command set via a testable registration module** — `cef7c7b` (feat)
4. **Docs trim** — `b62e8bc` (docs): trimmed a single historical-rename mention from the WorkspaceRouter JSDoc so the strict acceptance-criteria gate (`grep -c "app.html|openFullApp|FULL_APP_OPEN|'full-app'|openedFullAppTabId" ... → 0`) is unambiguously clean. The rename history is fully documented in the plan's Task Breakdown and the commit messages themselves.

## Files Created/Modified

- `src/core/workspace/WorkspaceRouter.ts` — `openFullApp` → `openStandalone`, `app.html` → `standalone.html`, `FULL_APP_OPEN` → `STANDALONE_OPEN`, cross-window tab dedup, `onSettled` callback contract; `hydrateFromURL` now routes through `setWorkspaceId` (no more `Object.assign` bypass).
- `src/core/workspace/WorkspaceStore.ts` — added `setWorkspaceId(id)` action mirroring `setConversationId` (set() + version++); renamed `openedFullAppTabId` → `openedStandaloneTabId` and `setOpenedFullAppTabId` → `setOpenedStandaloneTabId` at every declaration + call site + partialize entry.
- `src/core/workspace/WorkspaceSync.ts` — `FULL_APP_OPEN` → `STANDALONE_OPEN` in the `WorkspaceSyncMessage` union.
- `src/core/runtime/RuntimeEnvelope.ts` — `FULL_APP_OPEN` → `STANDALONE_OPEN` in `MessageTypeValues`; `'full-app'` source literal → `'standalone'` in the `source` union.
- `src/core/registry/Registry.ts` — `FullAppPageRegistry` → `StandalonePageRegistry`; backing `fullAppPages` Map → `standalonePages`; all internal references + `AddonRegistry.register`/`unregister` updated.
- `src/core/registry/AddonRegistry.ts` — `FullAppPageRegistration` → `StandalonePageRegistration`; `fullAppPages?` field → `standalonePages?` on `AddonRegistration`.
- `src/core/i18n/strings.ts` — defensive rename of `sidepanel.openFullApp` / `openingFullApp` / `fullAppFailed` to the standalone-view variants.
- `src/components/standalone/StandaloneShell.tsx` (renamed from `StandaloneWorkspace.tsx`) — component symbol + interface renamed; imports `hydrateFromURL` from `WorkspaceRouter`; calls it on mount via `useEffect(() => { hydrateFromURL(new URLSearchParams(window.location.search)); }, [])`.
- `entrypoints/standalone/main.tsx` — imports `StandaloneShell`; replaces the inline 2-command useEffect with a single `registerStandaloneCommands({focusSidePanel: handleOpenSidepanel, openOptions: handleOpenOptions, toggleTheme, reloadExtension: () => chrome.runtime.reload()})` call returning the cleanup.
- `src/main.tsx` — imports `StandaloneShell`; renders `<StandaloneShell ...>` in the dev harness.
- `src/core/commands/registerWorkspaceCommands.ts` (NEW) — `registerStandaloneCommands(deps)` exporting the 4-command Flow-10 base set with deterministic registration order + cleanup. `StandaloneCommandDeps` interface: `{ focusSidePanel, openOptions, toggleTheme, reloadExtension }`.
- `tests/core/workspace/WorkspaceRouter.test.ts` — rewrote legacy `app.html` assertions; new openStandalone dedup tests (query URL contains standalone.html, no duplicate create, cross-window focus, openedStandaloneTabId set); new hydrateFromURL subscriber-fires proof + no-op-when-empty.
- `tests/core/commands/registerWorkspaceCommands.test.ts` (NEW) — 9 tests: registers exactly the 4 ids in documented order; name/category match UI-SPEC; cleanup removes all 4 + re-register doesn't throw; each action calls its dep exactly once; duplicate register throws; search('') preserves registration order.

## Decisions Made

- **`openStandalone` adds `chrome.windows.update` in the existing-tab branch** (not in the create branch) so cross-window focus is a separate signal from create-success. Plan 01-07's Side Panel mirror-banner will render the toast based on the single `onSettled({ok})` call.
- **`opts.onSettled` is optional** — existing call sites that don't pass it (none today) continue to work. This avoids breaking the plan's signature contract while opening the door for the 01-07 toast integration.
- **`setWorkspaceId` shape is byte-identical to `setConversationId`** (same `set(state => { state.x = y; state.version++ })` pattern). Future handoff params (e.g., `page`) should follow this same shape — a strict invariant the plan flagged as Rule 1 (avoid silent store-bypass bugs).
- **`hydrateFromURL` stays in `WorkspaceRouter.ts`** per the H2 locked decision; it does NOT live on the store. The store exposes named actions, the router orchestrates them from the URL.
- **`StandaloneShellProps` is renamed alongside the component** (not kept as `StandaloneWorkspaceProps`) so there's no mismatched interface/component-name pair, per the plan's explicit instruction.
- **`openStandalone` uses `chrome.runtime.getURL('standalone.html*')`** (trailing wildcard) for the dedup query — so the same tab is matched regardless of which query-string variant was used to open it (`?workspaceId=...` only, or with `&conversationId=...&page=...`).
- **Command registration order is fixed in the source code**, not enforced by a test assertion (the order itself is enforced by reading the file). `CommandRegistry.search('')` test confirms insertion order is preserved by the registry's Map iteration, satisfying the REQ-F20 edge-case determinism requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] WorkspaceStore.setWorkspaceId needed a symmetric `version++` bump**
- **Found during:** Task 1 (writing `setWorkspaceId`)
- **Issue:** Plan said "mirroring `setConversationId`'s exact shape (including the `version++` bump for symmetry)". `setConversationId` increments `version++` because every conversation change is a "workspace state change" event downstream consumers react to. A `setWorkspaceId` without the bump would create an asymmetry where consumers using `version` as a "state changed" signal would miss workspaceId-only handoffs.
- **Fix:** Included the `version++` in `setWorkspaceId` to match `setConversationId`'s shape exactly.
- **Files modified:** `src/core/workspace/WorkspaceStore.ts`
- **Verification:** `pnpm verify:phase-1` green; WorkspaceStore tests still pass.
- **Committed in:** `f69db64` (Task 1 commit)

**2. [Rule 3 - Blocking] Strict acceptance gate `grep -c ... → 0` was tripped by a single historical-rename mention in WorkspaceRouter JSDoc**
- **Found during:** Post-Task-3 acceptance criteria sweep
- **Issue:** The plan's acceptance gate `grep -c "app\.html|openFullApp|FULL_APP_OPEN|'full-app'|openedFullAppTabId" src/core/workspace/*.ts src/core/runtime/RuntimeEnvelope.ts` had to return 0 across all 4 files. The strict grep was returning 1 for `WorkspaceRouter.ts` due to a single line in the JSDoc that documented the rename for posterity ("Pre-fix this was `openFullApp` and pointed at a non-existent `app.html`.").
- **Fix:** Trimmed that one sentence from the JSDoc. The rename history is fully preserved in the plan's Task Breakdown section and in each commit message body — keeping it in the JSDoc as well was redundant.
- **Files modified:** `src/core/workspace/WorkspaceRouter.ts`
- **Verification:** All 4 files now return 0; `pnpm verify:phase-1` green; `pnpm test` green.
- **Committed in:** `b62e8bc` (docs commit)

**3. [Rule 2 - Missing Critical] `setOpenedStandaloneTabId` in `openStandalone`'s existing-tab branch**
- **Found during:** Task 1 (rewriting `openStandalone`)
- **Issue:** Plan didn't explicitly say to also call `setOpenedStandaloneTabId(tabs[0].id)` in the existing-tab branch — the legacy `openFullApp` only set it in the create branch. Skipping it on the focus path would leave `openedStandaloneTabId` stale (pointing at the previously-created tab id, not the now-focused one) when a tab is focused across windows.
- **Fix:** Added `setOpenedStandaloneTabId(tabId)` after the `chrome.tabs.update` call so the field always reflects the currently-focused standalone tab id.
- **Files modified:** `src/core/workspace/WorkspaceRouter.ts`
- **Verification:** New test `records openedStandaloneTabId (not openedFullAppTabId) on the store` asserts the field exists with the expected name and is absent under the old name. `pnpm verify:phase-1` green.
- **Committed in:** `f69db64` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking)
**Impact on plan:** All three fixes are correctness/security preserving — no scope creep, no API surface change beyond what the plan already specified.

## Issues Encountered

- **`chrome.windows.UpdateProperties` does not exist in `@types/chrome` 0.2.x** — the actual type is `chrome.windows.UpdateInfo`. Fixed by importing the correct type in the new `WorkspaceRouter.test.ts` mocks.
- **LSP shows stale `StateCreator` mutator errors** on `WorkspaceStore.ts`, `ThemeStore.ts`, `useExtensionStore.ts`, and `vitest.config.ts` — these are pre-existing issues with the TypeScript language server's immer/persist middleware inference; they do NOT surface in `tsc --noEmit` (the verify:phase-1 gate). Verified with multiple commits: `tsc --noEmit` always returns clean. Plan 01-07 or later can address if desired.
- **LSP `WorkspaceRouter.ts` historical-rename comment** was the only remaining hit on the strict acceptance gate — see Deviation #2 above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Plan 01-07 is unblocked:**
- `WorkspaceRouter.openStandalone` is ready for `entrypoints/sidepanel/main.tsx`'s `handleOpenStandalone` to call (replacing the local `chrome.tabs.query` + `find` + `update`/`create` + `windows.update` dance). The cross-window focus + onSettled callback are already in place.
- `registerWorkspaceCommands.ts` module shape is ready for `registerSidepanelCommands` to be added in 01-07 (same pattern, different deps + 5 commands instead of 4).
- `StandaloneShell` hydrates on mount, so 01-07's Side Panel mirror-banner can rely on `WorkspaceStore.workspaceId` being set as soon as the Standalone view renders.

**Phase 2 readiness:**
- `setWorkspaceId` + `setConversationId` symmetric shape is the contract `isPrimaryWriter()`-gated MemoryEngine write paths will assume in Phase 2. The previous `Object.assign` bypass would have caused silent data loss for Phase 2's CAS-on-`np_workspace_primary` flow — that's now foreclosed.

**Phase 15 readiness:**
- RICH command catalog extends the base set on each surface (D-08). The `registerStandaloneCommands`/`registerSidepanelCommands` modules are the named-extension points; suggestion templates and slash commands register against the same `CommandRegistry`.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff*
*Plan: 06*
*Completed: 2026-08-22*
