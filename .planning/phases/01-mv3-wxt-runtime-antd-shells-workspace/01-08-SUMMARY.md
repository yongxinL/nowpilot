---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 08
subsystem: ui, routing, onboarding, cmdk, provider-gate
tags: [side-panel-shell, standalone-shell, d-07-provider-gate, onboarding-flow-9, cmdk-flow-10, page-skeletons, antd, zustand, provider-registry, w-8-command-set]

# Dependency graph
requires:
  - phase: 01-02
    provides: STR canonical strings + ProviderId type + WorkspaceState
  - phase: 01-04
    provides: ErrorBoundary, FocusTrap, isCmdK/KEYMAP.CMD_K, debugLog + ERROR_CODES (COMPONENT_RENDER/CMDK_*/ONBOARDING_*/REGISTRY_INIT)
  - phase: 01-05
    provides: ThemeStore (useThemeStore, setMode) + ThemeMode type
  - phase: 01-06
    provides: WorkspaceStore (workspace.activeSurface) + WorkspaceRouter (openStandalone/openSidePanel, Pitfall 1-safe)
  - phase: 01-07
    provides: StandalonePageRegistry + SidePanelPageRegistry (lazy component keys) + AddonSettingsStore + Registry pattern
provides:
  - ProviderRegistry (D-07 gate primitive) — registerActiveProvider/hasActiveProvider/getActiveProvider + subscribe/clear (T-1-18), empty in Phase 1 so the gate renders onboarding → disabled surface
  - SidePanelShell (§17.1 chat-only) + StandaloneShell (openTitle header + §18 page resolution) + SidePanelRouter/StandaloneRouter (D-07 gate on provider presence, W-10)
  - OnboardingModal (Flow 9 step 1, D-06/D-07: persona card E7 + provider skeleton + configure-later escape → disabled surface) + CmdKPicker (Flow 10, W-8 exact 3-command set)
  - §18 page skeletons — ChatPage/AgentPage/NotesPage/OptionsPage + ChatPageSkeleton/WorkspacePageSkeleton with E5 empty-state copy
  - standaloneNav module (the StandaloneRouter navigateToPage action, cycle-free)
affects: [01-09 (mounts SidePanelRouter/StandaloneRouter at entry roots; ConfigProvider wiring), chat phase (real composer on the shell input bar), providers phase (real provider registration flips the D-07 gate), settings phase (OptionsPage provider flow)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-07 gate: ProviderRegistry presence (not an onboarding flag, W-10) read live via useSyncExternalStore (T-1-18 — no cached UI flag); onboarding-done rides AddonSettingsStore np_addon_settings (D-18 forbids WorkspaceState widening)"
    - "Global overlay pattern: shells mount the Cmd+K palette; CmdKPicker self-captures mod+k via isCmdK and routes commands exclusively through WorkspaceRouter (Pitfall 1 / T-1-20 typed command array)"
    - "Lazy component-key resolution: StandaloneShell maps PageRegistration.component strings (01-07 UI-free registries) to components — registries stay React-free"
    - "jsdom-deterministic modal: conditionally mount the Cmd+K Modal ({open && <Modal>}) so close unmounts synchronously — rc-motion leave animations never complete in jsdom"

key-files:
  created:
    - src/core/ai/ProviderRegistry.ts
    - src/components/sidepanel/SidePanelRouter.tsx
    - src/components/sidepanel/SidePanelShell.tsx
    - src/components/standalone/StandaloneRouter.tsx
    - src/components/standalone/StandaloneShell.tsx
    - src/components/standalone/standaloneNav.ts
    - src/components/OnboardingModal.tsx
    - src/components/cmdk/CmdKPicker.tsx
    - src/components/pages/sidepanel/ChatPageSkeleton.tsx
    - src/components/pages/standalone/WorkspacePageSkeleton.tsx
    - src/components/pages/ChatPage.tsx
    - src/components/pages/AgentPage.tsx
    - src/components/pages/NotesPage.tsx
    - src/components/pages/OptionsPage.tsx
    - tests/components/sidepanel/SidePanelShell.test.tsx
    - tests/components/standalone/StandaloneShell.test.tsx
    - tests/components/OnboardingModal.test.tsx
    - tests/components/cmdk/CmdKPicker.test.tsx
  modified:
    - src/core/i18n/strings.ts (chat.askPlaceholder added — Rule 2)
    - tests/setup.ts (jest-dom matcher registration — Rule 3)

key-decisions:
  - "Onboarding-done lives in AddonSettingsStore (np_addon_settings 'onboarding'.done), not WorkspaceStore — WorkspaceState has no onboarding field and D-18 forbids type widening (01-06 handoff precedent); the plan allowed either store"
  - "ProviderRegistry is reactive: subscribe() + useSyncExternalStore in the router AND shell (T-1-18 'router re-evaluates on store/registry change — no cached UI flag'); clear() added for test/UAT isolation"
  - "navigateToPage (the StandaloneRouter action) lives in a co-located standaloneNav.ts module, re-exported from StandaloneRouter — avoids a CmdKPicker↔StandaloneRouter↔StandaloneShell circular import while honoring the plan's 'router action' contract"
  - "Cmd+K palette Modal is conditionally mounted ({open && <Modal open>}) instead of a persistent open toggle — rc-motion leave animations never complete in jsdom, stranding closed content in the DOM; conditional mount makes close deterministic and the Escape test reliable"
  - "E5 empty-state copy inlined verbatim in the page files (with STR-parity comments) — the acceptance greps require the literals in the files, and STR lacks agent/notes E5 keys"

patterns-established:
  - "D-07 gate contract: provider presence decides the surface tree (onboarding vs disabled vs enabled); components read the registry live, never a cached flag"
  - "Surface-tree layout: shells are Layout scaffolds + ErrorBoundary + global overlays; pages are self-contained §18 components; routers are pure store/registry selectors — zero extension API calls in src/components (grep-guarded)"

requirements-completed: [RUNTIME-03, RUNTIME-05, WSPC-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Routers — SidePanelRouter D-07 gate (ProviderRegistry presence, W-10, NOT onboarding-done) deciding Onboarding vs disabled shell vs enabled shell; StandaloneRouter page routing from StandalonePageRegistry ids via navigateToPage (chat default)"
    requirement: RUNTIME-03
    verification:
      - kind: unit
        ref: "tests/components/sidepanel/SidePanelShell.test.tsx#SidePanelRouter (D-07 gate) shows Onboarding when no provider and onboarding is pending"
        status: pass
      - kind: unit
        ref: "tests/components/sidepanel/SidePanelShell.test.tsx#SidePanelRouter (D-07 gate) shows the disabled shell when onboarding was dismissed via 'Configure later'"
        status: pass
      - kind: unit
        ref: "tests/components/sidepanel/SidePanelShell.test.tsx#SidePanelRouter (D-07 gate) shows the enabled chat shell when a provider is registered (W-10)"
        status: pass
      - kind: unit
        ref: "tests/components/standalone/StandaloneShell.test.tsx#StandaloneRouter defaults to the Chat page"
        status: pass
      - kind: unit
        ref: "tests/components/standalone/StandaloneShell.test.tsx#StandaloneRouter renders the page for the active registry id set via navigateToPage"
        status: pass
    human_judgment: false
  - id: D2
    description: "Shells — §17.1 chat-only SidePanelShell (header + ChatPage content or D-07 disabled surface STR.chat.noProvider + disabled askPlaceholder input, no send button, theme/surface captions) and StandaloneShell (openTitle header + §18 page resolution); both ErrorBoundary-wrapped, no chrome API calls"
    requirement: RUNTIME-05
    verification:
      - kind: unit
        ref: "tests/components/sidepanel/SidePanelShell.test.tsx#SidePanelShell renders the header title and a disabled askPlaceholder input (no chat logic)"
        status: pass
      - kind: unit
        ref: "tests/components/sidepanel/SidePanelShell.test.tsx#SidePanelShell renders no send button"
        status: pass
      - kind: unit
        ref: "tests/components/sidepanel/SidePanelShell.test.tsx#SidePanelShell renders the disabled surface when no provider is active"
        status: pass
      - kind: unit
        ref: "tests/components/sidepanel/SidePanelShell.test.tsx#SidePanelShell renders the chat content once a provider is registered (D-07)"
        status: pass
      - kind: unit
        ref: "tests/components/standalone/StandaloneShell.test.tsx#StandaloneShell renders the openTitle header"
        status: pass
      - kind: other
        ref: "grep -rn 'chrome\\.' src/components/ | wc -l == 0"
        status: pass
    human_judgment: true
    rationale: "flagged_unverified (RUNTIME-03): the §17.1 layout, theme/surface captions, and the full surface interaction must be visually verified in a real Chrome side panel/standalone tab — jsdom proves structure and state wiring only"
  - id: D3
    description: "OnboardingModal (Flow 9 step 1, D-06/D-07) — welcome + E7 persona card + provider-choice skeleton (four canonical provider ids disabled, coming in settings phase) + 'Configure provider' deep-link (D-09) + 'Configure later' escape writing np_addon_settings onboarding.done so the router exits to the disabled surface"
    verification:
      - kind: unit
        ref: "tests/components/OnboardingModal.test.tsx#renders the welcome heading, body, and persona card (E7)"
        status: pass
      - kind: unit
        ref: "tests/components/OnboardingModal.test.tsx#renders the provider-choice UI skeleton with the four canonical provider ids disabled"
        status: pass
      - kind: unit
        ref: "tests/components/OnboardingModal.test.tsx#'Configure later' marks onboarding done in the addon settings store (D-06 escape)"
        status: pass
      - kind: unit
        ref: "tests/components/sidepanel/SidePanelShell.test.tsx#SidePanelRouter (D-07 gate) shows the disabled shell when onboarding was dismissed via 'Configure later'"
        status: pass
    human_judgment: false
  - id: D4
    description: "CmdKPicker (Flow 10) — opens on mod+k via isCmdK, searchable list over the typed COMMANDS const with EXACTLY the W-8 set (Open Standalone / Focus Side Panel / Open Options), Enter runs the highlighted command through WorkspaceRouter, Escape closes, FocusTrap + ErrorBoundary"
    requirement: WSPC-05
    verification:
      - kind: unit
        ref: "tests/components/cmdk/CmdKPicker.test.tsx#opens on mod+k (isCmdK) and shows the search placeholder"
        status: pass
      - kind: unit
        ref: "tests/components/cmdk/CmdKPicker.test.tsx#lists EXACTLY the W-8 command set (no stub commands)"
        status: pass
      - kind: unit
        ref: "tests/components/cmdk/CmdKPicker.test.tsx#filters the command list by query"
        status: pass
      - kind: unit
        ref: "tests/components/cmdk/CmdKPicker.test.tsx#Enter runs the highlighted command through WorkspaceRouter (open-standalone)"
        status: pass
      - kind: unit
        ref: "tests/components/cmdk/CmdKPicker.test.tsx#Escape closes the palette (FocusTrap onEscape) and focus is released"
        status: pass
    human_judgment: true
    rationale: "flagged_unverified (WSPC-05): keyboard capture and FocusTrap behavior are proven in jsdom, but the real Chrome keyboard focus flow (mod+k from the browser, focus restore across surfaces) must be verified in browser e2e"
  - id: D5
    description: "§18 page skeletons (W-6 canonical flat paths) — ChatPage (STR.chat.empty/loading over ChatPageSkeleton, no chat logic), AgentPage (E5 'Agent runs land here.'), NotesPage (E5 verbatim + 'New note' no-op CTA, D-15), OptionsPage (Account E5 provider empty state + Appearance light/dark/auto Segmented wired to useThemeStore.setMode with the E5 save-failed toast); ChatPageSkeleton + WorkspacePageSkeleton (currentPageContext card display-only)"
    requirement: RUNTIME-05
    verification:
      - kind: unit
        ref: "tests/components/standalone/StandaloneShell.test.tsx#StandaloneShell renders the Chat page for the default registry id (renders ChatPage)"
        status: pass
      - kind: unit
        ref: "tests/components/standalone/StandaloneShell.test.tsx#StandaloneShell renders the Options page for the options registry id (renders OptionsPage)"
        status: pass
      - kind: other
        ref: "grep -c 'Agent runs land here' src/components/pages/AgentPage.tsx == 1"
        status: pass
      - kind: other
        ref: "grep -c 'New note' src/components/pages/NotesPage.tsx == 3 (>= 1)"
        status: pass
      - kind: other
        ref: "grep -c 'No provider connected' src/components/pages/OptionsPage.tsx == 2 (>= 1)"
        status: pass
      - kind: other
        ref: "grep -rn 'chrome\\.' src/components/pages/ | wc -l == 0"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-08
status: complete
---

# Phase 1 Plan 8: Surface UI — Shells, Routers, Onboarding, Cmd+K, Page Skeletons Summary

**D-07 provider-gated surface trees (SidePanelRouter/StandaloneRouter + §17.1 chat-only SidePanelShell + StandaloneShell), Flow 9 Onboarding step 1 with the configure-later escape, the W-8 exact-3-command Cmd+K palette (Flow 10) routed through WorkspaceRouter, and the §18 ChatPage/AgentPage/NotesPage/OptionsPage skeletons with verbatim E5 empty-state copy**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-08T11:50:24Z
- **Completed:** 2026-08-08T12:10:37Z
- **Tasks:** 3
- **Files modified:** 20 (14 source + 4 test created; strings.ts + tests/setup.ts modified)

## Accomplishments

- **D-07 provider gate (Task 1):** `ProviderRegistry` at the canonical `src/core/ai/` home (Phase 3 extends this exact file — no duplicate under core/providers/) with `registerActiveProvider`/`hasActiveProvider`/`getActiveProvider` plus a `subscribe()` used via `useSyncExternalStore` in both the router and the shell — the gate re-evaluates live on registry change (T-1-18, no cached UI flag), starts empty so Phase 1 renders onboarding → disabled surface, and never throws (REGISTRY_INIT logging). `SidePanelRouter` gates on provider **presence** (W-10 — NOT onboarding-done): no provider + onboarding pending → Onboarding; no provider + onboarding done → disabled shell (STR.chat.noProvider banner, disabled input); provider present → enabled chat shell. `SidePanelShell` is the §17.1 chat-only compact shell (header with wordmark + theme/surface captions, ChatPage content, disabled askPlaceholder input bar — no chat logic, chat lands in its phase) with Cmd+K as the global overlay; `StandaloneShell` renders the active §18 page via `StandalonePageRegistry` lazy component keys; `StandaloneRouter` owns page routing through `navigateToPage` (the router action backing the Cmd+K 'Open Options' command).
- **Onboarding + Cmd+K (Task 2):** `OnboardingModal` implements Flow 9 step 1 (D-06): welcome + E7 persona card (heading/body from STR.onboarding.*, 'Configure provider' deep-linking to Standalone Options per D-09) + the four-provider disabled skeleton (canonical ids, 'coming in settings phase') + the 'Configure later' escape that writes `np_addon_settings` `onboarding.done` (ONBOARDING_WRITE on error / ONBOARDING_DONE silent on success) — the router then exits to the disabled surface, never the chat shell (D-07). `CmdKPicker` implements Flow 10: opens on mod+k (isCmdK, KEYMAP.CMD_K), a searchable Modal over a **typed** COMMANDS const with EXACTLY the W-8 set — Open Standalone / Focus Side Panel / Open Options (D-15: no stub commands) — Enter runs the highlighted command exclusively through `WorkspaceRouter` (Pitfall 1: the only surface-open path; the open-options command also sets the standalone page via navigateToPage), Escape closes, FocusTrap + ErrorBoundary.
- **§18 page skeletons (Task 3):** the four canonical W-6 pages — `ChatPage` (STR.chat.empty/loading over the shared `ChatPageSkeleton`; no messages state, no send flow), `AgentPage` (verbatim E5 'Agent runs land here.'), `NotesPage` (verbatim E5 copy + 'New note' CTA that is enabled but no-op per D-15, logging COMPONENT_RENDER silent:true), `OptionsPage` (Account card with the E5 provider empty state + Appearance card with the light/dark/auto Segmented wired to `useThemeStore().setMode` and the E5 persistence toast when the store fails to adopt) — plus `ChatPageSkeleton` (sidepanel) and `WorkspacePageSkeleton` (standalone, with a display-only currentPageContext summary card). All six wrapped in ErrorBoundary; zero chrome API calls in `src/components` (grep-guarded).

## Task Commits

Each task was committed atomically (all 3 commits green against the complete working tree; see Deviation 2 for the interlock note):

1. **Task 1: Provider gate + Routers + Shells (surface trees)** - `9ffa7a5` (feat)
2. **Task 2: Onboarding (Flow 9) + CmdKPicker (Flow 10)** - `f547af9` (feat)
3. **Task 3: §18 page skeletons — ChatPage/AgentPage/NotesPage/OptionsPage + empty states** - `79d249a` (feat)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `src/core/ai/ProviderRegistry.ts` - D-07 gate primitive: registerActiveProvider/hasActiveProvider/getActiveProvider + subscribe (T-1-18) + clear; canonical AI home (B3/R-1)
- `src/components/sidepanel/SidePanelRouter.tsx` - D-07 gate (provider presence, W-10) + onboarding-done → Onboarding | disabled shell | enabled shell
- `src/components/sidepanel/SidePanelShell.tsx` - §17.1 chat-only shell: header (title + theme/surface captions), ChatPage or disabled surface, disabled input bar, Cmd+K overlay, ErrorBoundary
- `src/components/standalone/StandaloneRouter.tsx` - page routing via useStandaloneNav; re-exports navigateToPage
- `src/components/standalone/StandaloneShell.tsx` - openTitle header + §18 page resolution (lazy component keys)
- `src/components/standalone/standaloneNav.ts` - active-page nav store + navigateToPage (cycle-free module)
- `src/components/OnboardingModal.tsx` - Flow 9 step 1: persona card (E7) + provider skeleton + configure-later escape (D-06/D-07)
- `src/components/cmdk/CmdKPicker.tsx` - Flow 10 palette: mod+k, W-8 3-command set, Enter/Escape, FocusTrap + ErrorBoundary
- `src/components/pages/ChatPage.tsx` + `sidepanel/ChatPageSkeleton.tsx` - chat empty state/skeleton
- `src/components/pages/AgentPage.tsx` - E5 Agent empty state
- `src/components/pages/NotesPage.tsx` - E5 Notes empty state + 'New note' no-op CTA
- `src/components/pages/OptionsPage.tsx` - Account + Appearance (displayMode selector wired to ThemeStore)
- `src/components/pages/standalone/WorkspacePageSkeleton.tsx` - E5 skeleton + currentPageContext card
- `tests/components/sidepanel/SidePanelShell.test.tsx` - 7 tests (shell + router gate branches)
- `tests/components/standalone/StandaloneShell.test.tsx` - 5 tests (shell + router routing)
- `tests/components/OnboardingModal.test.tsx` - 3 tests (persona card, provider skeleton, configure-later)
- `tests/components/cmdk/CmdKPicker.test.tsx` - 5 tests (open, exact set, filter, Enter, Escape)
- `src/core/i18n/strings.ts` - `chat.askPlaceholder` added (Rule 2)
- `tests/setup.ts` - jest-dom/vitest matcher registration (Rule 3)

## Decisions Made

- **Onboarding-done rides AddonSettingsStore, not WorkspaceStore** — WorkspaceState has no onboarding field and D-18 forbids type widening (the 01-06 handoff precedent); the plan explicitly allowed either store, and `np_addon_settings.onboarding.done` is the reactive subscription the router uses.
- **ProviderRegistry is push-reactive** — `subscribe()` + `useSyncExternalStore` in the router AND shell fulfills T-1-18 ("re-evaluates on store/registry change — no cached UI flag") so the surface tree flips the moment a provider is registered (the settings phase/UAT need no reload); `clear()` serves test isolation.
- **navigateToPage in a co-located `standaloneNav.ts`** — the plan's "standalone router action" is exported from StandaloneRouter but implemented in a separate module to break the CmdKPicker↔StandaloneRouter↔StandaloneShell import cycle (components mount the palette globally, so the palette must set the standalone page without a circular module graph).
- **Cmd+K Modal conditionally mounted** — `{open && <Modal open>}` instead of a persistent open toggle: rc-motion leave animations never complete in jsdom (verified: stuck at `ant-zoom-leave-start` after 700 ms), which would strand the closed palette's DOM in tests; conditional mount gives deterministic close.
- **E5 copy inlined verbatim in page files** — the acceptance greps require the literals in the files and STR lacks agent/notes E5 keys (notes E5 copy, agent copy); comments note STR parity where a key exists (`STR.options.noProvider`, `STR.notes.newNote`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] STR.chat.askPlaceholder did not exist despite the plan referencing it**
- **Found during:** Task 1 (SidePanelShell implementation)
- **Issue:** The plan's shell contract reads "disabled Input with STR.chat.askPlaceholder from 01-02" — but the 01-02 STR has no `chat.askPlaceholder` key (tsc would reject `STR.chat.askPlaceholder`).
- **Fix:** Added `chat.askPlaceholder: 'Ask anything, @ models, / prompts'` to `strings.ts` — verbatim from the §17.1 composer input placeholder (UI-SPEC Copywriting source).
- **Files modified:** src/core/i18n/strings.ts
- **Verification:** tsc green; shell tests resolve `STR.chat.askPlaceholder` and assert the disabled input.
- **Committed in:** 9ffa7a5 (Task 1)

**2. [Rule 3 - Blocking] Plan task interlock — Task 1 shells reference Task 3 pages and Task 2 CmdKPicker; Task 3 verify runs Task 1's shell tests**
- **Found during:** Task 1 implementation
- **Issue:** The plan's literal 1→2→3 order cannot produce a self-contained green commit at every point: Task 1's SidePanelShell renders ChatPage (a Task 3 file) and mounts CmdKPicker (a Task 2 file), while Task 3's `<verify>` runs `tests/components/sidepanel tests/components/standalone` (Task 1 test files). The plan's own W-14 scope note batches the 13 files as one concern.
- **Fix:** Created the full file set (in compile-dependency order), verified everything green (tsc, 151-test suite, all acceptance greps), then committed per the plan's task grouping (1 → 2 → 3). Each commit is green against the complete working tree; Task 1's git history is not standalone-revertable in isolation, which is an accepted consequence of the plan's single-concern batching.
- **Files modified:** (commit ordering only)
- **Verification:** all three acceptance criteria sets pass; `pnpm vitest run tests/components` 35/35; full suite 151/151.
- **Committed in:** 9ffa7a5, f547af9, 79d249a

**3. [Rule 3 - Blocking] jest-dom matchers not registered (vitest runs with globals disabled)**
- **Found during:** Task 1 test authoring
- **Issue:** `expect(input).toBeDisabled()` failed with "Invalid Chai property: toBeDisabled" — `@testing-library/jest-dom` (installed) is never imported, and vitest runs with `globals: false` so jest-dom's auto-registration never fires.
- **Fix:** Added `import '@testing-library/jest-dom/vitest';` to `tests/setup.ts` (augments vitest's expect; additive for all existing tests).
- **Files modified:** tests/setup.ts
- **Verification:** 151/151 tests green (no regression in pre-existing suites).
- **Committed in:** 9ffa7a5 (Task 1)

**4. [Rule 1 - Bug] antd Modal leave animation never completes in jsdom — closed palette stranded in the DOM**
- **Found during:** Task 2 CmdKPicker Escape test
- **Issue:** With a persistent `open` toggle + `destroyOnHidden`, closing left the modal content in the DOM: rc-motion stays at `ant-zoom-leave-start` forever in jsdom (no transition/layout engine), so the leave motion's end callback never fires and `waitFor` still found the input after 700 ms.
- **Fix:** Conditionally mount the Modal (`{open && <Modal open>}`) — close now unmounts the palette synchronously; the open path still uses the antd appear motion. Documented in the component header.
- **Files modified:** src/components/cmdk/CmdKPicker.tsx
- **Verification:** Escape test green (deterministic); all 5 CmdKPicker tests pass.
- **Committed in:** f547af9 (Task 2)

**5. [Rule 1 - Bug] antd v6 prop renames (deprecation warnings)**
- **Found during:** Task 1/2 test runs (stderr warnings)
- **Issue:** antd v6 deprecated `Alert message` (use `title`) and `Space direction` (use `orientation`).
- **Fix:** `Alert` uses `title={STR.chat.noProvider}`; `Space` uses `orientation="vertical"`.
- **Files modified:** src/components/sidepanel/SidePanelShell.tsx, src/components/OnboardingModal.tsx
- **Verification:** warnings gone; tests green.
- **Committed in:** 9ffa7a5, f547af9

**6. [Rule 1 - Bug] E5 empty-state copy greps require literals in the page files**
- **Found during:** Task 3 acceptance verification
- **Issue:** `grep -c "Agent runs land here" AgentPage.tsx` etc. require the literals in the files — `STR.notes.newNote`/`STR.options.noProvider` references don't contain the grep literals, and STR has no agent/notes E5 keys.
- **Fix:** Inlined the verbatim E5 copy as local consts in AgentPage/NotesPage/OptionsPage (and the configure-later label in OnboardingModal) with STR-parity comments; ChatPage keeps `STR.chat.empty`/`STR.chat.loading` references (the grep pattern matches the STR property names there).
- **Files modified:** src/components/pages/AgentPage.tsx, NotesPage.tsx, OptionsPage.tsx, src/components/OnboardingModal.tsx
- **Verification:** all Task 3 acceptance greps pass (1/1/1/1) and `Configure later` == 1 exactly.
- **Committed in:** f547af9, 79d249a

**7. [Rule 2 - Missing Critical] standaloneNav.ts co-located module for the navigateToPage router action**
- **Found during:** Task 1/2 design (import graph)
- **Issue:** Mounting the palette in both shells means CmdKPicker must set the standalone active page; importing `navigateToPage` from StandaloneRouter would create a CmdKPicker↔StandaloneRouter↔StandaloneShell circular import.
- **Fix:** Implemented the nav store + `navigateToPage` in `src/components/standalone/standaloneNav.ts` and re-exported them from StandaloneRouter (the plan's "standalone router action from Task 1" contract holds).
- **Files modified:** src/components/standalone/standaloneNav.ts, StandaloneRouter.tsx, CmdKPicker.tsx, OnboardingModal.tsx
- **Verification:** no circular-import issues; tsc + tests green.
- **Committed in:** 9ffa7a5, f547af9

---

**Total deviations:** 7 auto-fixed (4 Rule 1 bugs, 3 Rule 2 missing-critical/blocking, 0 Rule 4)
**Impact on plan:** All fixes were necessary for green acceptance gates (literal-copy greps), correct antd v6 API usage, deterministic jsdom tests, and honest commit hygiene. No scope creep — no features beyond the plan's contract; the standaloneNav module and ProviderRegistry.subscribe are structural enablers of the plan's own required behavior (router action / T-1-18).

## Issues Encountered

- **antd v6 + jsdom modal animation** — rc-motion leave animations are a no-op in jsdom (no layout/transition engine); resolved with conditional modal mounting (Deviation 4). This is a test-environment artifact only — the palette opens with the appear motion in real Chrome.
- **`getComputedStyle` "with pseudo-elements" stderr warnings** — emitted by antd's CSS-in-JS during component tests; harmless, non-failing (same class of noise as pre-existing suites).
- **Escape-closes test timing** — with the conditional mount the assertion is synchronous; no flakiness observed across repeated runs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **01-09 (mounts + verify:phase-1):** `SidePanelRouter` / `StandaloneRouter` are the entry roots to mount at the sidepanel/standalone entrypoints with the XProvider → AntdApp → Router tree (Appendix F.3); the D-07 gate means a fresh install shows onboarding, and UAT can `ProviderRegistry.registerActiveProvider('fake')` to unlock the chat shell. `getAntdConfig` + `useThemeStore` wiring is display-only in the shells (ConfigProvider happens at mount).
- **Flagged for browser e2e:** real mod+k keyboard focus flow (WSPC-05) and full surface interaction (RUNTIME-03) — jsdom-proven at unit level; flagged_assumptions recorded.
- **Phase 3 (providers):** extends `src/core/ai/ProviderRegistry.ts` in place (never duplicated) and the real provider configure flow replaces the disabled provider skeleton in OnboardingModal.
- **Chat phase:** the disabled input bar in SidePanelShell becomes the real composer; ChatPage grows the message list.
- **Settings phase:** OptionsPage's provider empty state is replaced by the real provider grid; the Appearance displayMode selector is already wired.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

- All 18 created files (14 source + 4 test) exist on disk
- All 3 task commits found in git log: 9ffa7a5 (Task 1), f547af9 (Task 2), 79d249a (Task 3)
- Plan `<verification>` green: `pnpm vitest run tests/components` 35/35; full suite 151/151; `pnpm tsc --noEmit` exit 0; `grep -rn "chrome\." src/components/` == 0; prettier + eslint clean on all new/modified files
- All per-task acceptance criteria pass (Task 1: vitest 12/12 + hasActiveProvider==1 + ErrorBoundary>=2 + no chrome; Task 2: vitest 8/8 + Configure later==1 + W-8 labels>=3 + isCmdK/WorkspaceRouter>=2; Task 3: tsc exit 0 + 4 copy greps + no chrome in pages)
