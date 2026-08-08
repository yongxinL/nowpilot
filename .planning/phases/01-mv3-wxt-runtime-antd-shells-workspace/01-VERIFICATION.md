---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
verified: 2026-08-08T13:40:00Z
status: gaps_found
score: 6/8 must-haves verified
behavior_unverified: 4 # Present + wired, behavior not exercised in a real browser (Chrome for Testing binary present but unrunnable — missing libnspr4.so)
overrides_applied: 0
gaps:
  - truth: "Side panel and standalone surfaces share workspace state; workspace state hands off correctly when the standalone opens (SC2, WSPC-01, WSPC-02)"
    status: failed
    reason: "useWorkspaceStore.init()/start() and WorkspaceSync.start() have ZERO callers in src/ (verified by grep — only tests invoke them). np_workspace is never hydrated: workspaceId/conversationId regenerate on every surface load, activeSurface is permanently 'sidepanel' (user-visible in the SidePanelShell header at line 63), and the BroadcastBus heartbeat / WORKSPACE_UPDATED LWW adoption / WORKSPACE_HANDOFF state machine / mirroring flow never run in the shipped extension. The 01-06 plan purpose explicitly states '01-08 shells and 01-09 mounts consume it, and handoff (Flow 11) depends on WorkspaceSync' — the plan intent was for the mounts to wire the store/sync, but no 01-08/01-09 task did. This is a genuine goal-level failure ('share workspace state' clause), not accepted phase-1 scope."
    artifacts:
      - path: src/entrypoints/sidepanel/main.tsx
        issue: "Fires only useThemeStore.init(); never calls useWorkspaceStore.init()/start() or WorkspaceSync.start()"
      - path: src/entrypoints/standalone/main.tsx
        issue: "Same — only ThemeStore hydrate at module scope"
      - path: src/core/workspace/WorkspaceStore.ts
        issue: "init()/start()/stop() fully implemented and unit-tested but orphaned in production (no consumers in src/)"
      - path: src/core/workspace/WorkspaceSync.ts
        issue: "start()/stop()/handoff/mirroring implemented and unit-tested but never instantiated in src/ (only tests: tests/core/workspace/WorkspaceSync.test.ts)"
    missing:
      - "At both entrypoint mounts (sidepanel + standalone main.tsx), after ThemeStore hydrate: void useWorkspaceStore.getState().init().then(() => { useWorkspaceStore.getState().start('sidepanel'|'standalone'); new WorkspaceSync(surface).start(); }) — per REVIEW.md WR-03 fix"
  - truth: "Onboarding 'Configure later' escape persists across surface loads (D-06; phase goal 'share onboarding' clause)"
    status: failed
    reason: "useAddonSettingsStore.init() has zero callers in src/ (verified by grep). handleConfigureLater writes onboarding.done to np_addon_settings via setSetting, but the storage value is never hydrated back into the store on boot — every fresh extension page load (each side-panel open, standalone tab, SW restart) starts with settings: {}, so SidePanelRouter's onboardingDone check (SidePanelRouter.tsx:34) is false and the OnboardingModal reappears despite the user having clicked 'Configure later'. The D-06 escape is effectively non-persistent."
    artifacts:
      - path: src/components/sidepanel/SidePanelRouter.tsx
        issue: "Reads settings.onboarding?.done which is never hydrated (line 34)"
      - path: src/components/OnboardingModal.tsx
        issue: "handleConfigureLater writes via setSetting (line 41) but nothing calls init() to read np_addon_settings back"
      - path: src/core/registry/AddonSettingsStore.ts
        issue: "init() implemented and unit-tested but orphaned in production"
    missing:
      - "Call void useAddonSettingsStore.getState().init() at both entrypoint mounts (sidepanel + standalone main.tsx) — per REVIEW.md WR-02 fix"
deferred: # Informational — Phase 2 SC2 text overlaps the durable-persistence dimension, but Phase 2 plans are TBD (no concrete ownership claimed), so the gaps stay real for Phase 1
  - truth: "np_workspace hydration + handoff wiring at the mounts"
    addressed_in: "Phase 2"
    evidence: "Phase 2 success criterion 2: 'User's workspace state (theme, conversations, add-on state) persists across page reload and side-panel↔standalone handoff' — overlaps the durable persistence dimension; the phase-1 SC2 handoff clause and the 01-06 plan intent ('mounts consume it') still make the wiring a Phase-1 obligation"
behavior_unverified_items:
  - truth: "Cmd+K palette opens and FocusTrap manages focus in a real Chrome surface"
    test: "Load the built extension in Chrome for Testing, press mod+k in the side panel and standalone, verify the palette opens and Escape closes it"
    expected: "Palette opens on mod+k in both surfaces; Enter runs the highlighted command; Escape closes and focus returns to the trigger"
    why_human: "jsdom unit tests prove the capture wiring, but real Chrome keyboard-focus flow (FocusTrap, native key events) cannot run on this host — the CfT binary fails with missing libnspr4.so"
  - truth: "chrome.sidePanel.open preserves the user gesture in a real browser (Pitfall 1)"
    test: "Run verify:e2e-phase-1 (tests/e2e/load-smoke.mjs) on a host with Chrome system libs; click the action button and confirm the side panel opens"
    expected: "Action button opens the side panel via LifecycleManager setPanelBehavior; WorkspaceRouter.openSidePanel keeps the gesture (callback-style tabs.query chain)"
    why_human: "The callback chain is unit-tested with fakeBrowser, but real-browser gesture semantics (crbug 1478648) require a runnable Chrome binary"
  - truth: "Standalone tab dedupe works across real windows"
    test: "From the side panel run the Open Standalone command twice; confirm only one standalone tab exists and the second invocation focuses it"
    expected: "update-or-create dedupe (tabs.query → update+focus, never tabs.create a second tab)"
    why_human: "Unit test asserts tabs.create is not called with fakeBrowser; real multi-window behavior needs a browser"
  - truth: "Theme changes propagate across two live surfaces via chrome.storage.onChanged"
    test: "Open side panel + standalone; toggle display mode in standalone Options; confirm the side panel updates immediately"
    expected: "np_theme write → onChanged → both ThemeStore instances adopt the new mode without reload"
    why_human: "Unit tests exercise fakeBrowser storage + onChanged; real two-context propagation requires two live extension pages"
human_verification:
  - test: "Run pnpm verify:e2e-phase-1 (tests/e2e/load-smoke.mjs) on a host with Chrome system libraries — sidepanel.html and standalone.html must mount console-error-free in real Chrome for Testing"
    expected: "Both surfaces mount clean (exit 0); the .cache/chrome-for-testing binary is present but currently unrunnable (missing libnspr4.so)"
    why_human: "Real-browser MV3 load + SW lifecycle cannot be executed on this host; the executor flagged this (RESEARCH A8) and I confirmed the binary is present but broken"
  - test: "In a runnable browser, click the extension action button and confirm the side panel opens (LifecycleManager setPanelBehavior, §5.3)"
    expected: "openPanelOnActionClick: true opens the side panel"
    why_human: "SW listener lifecycle requires a real Chrome session"
  - test: "In a runnable browser, verify the cross-window PING/PONG election and WORKSPACE_UPDATED LWW adoption once the WR-03 wiring gap is fixed"
    expected: "Two extension contexts exchange heartbeats and the higher-version workspace wins"
    why_human: "Cross-window election behavior is deferred to browser e2e (01-06 flagged assumption)"
---

# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace Verification Report

**Phase Goal:** An installable MV3 extension with side panel and standalone surfaces that share workspace state, theme, onboarding, and command palette.
**Verified:** 2026-08-08T13:40:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Installable MV3 extension builds with side panel, standalone, background SW, and extraction-only content entrypoints (RUNTIME-01) | ✓ VERIFIED | `pnpm verify:phase-1` exits 0 (rerun 2026-08-08): eslint → prettier → tsc --noEmit → wxt build → 26 files/163 tests green → check-content-bundle clean. `.output/chrome-mv3/` contains sidepanel.html, standalone.html, background.js, content-scripts/core.js (159 KB). Content bundle isolated (0 forbidden UI tokens). Banned packages: 0. innerHTML/dangerouslySetInnerHTML: 0 |
| 2 | First-run onboarding appears on a fresh install (SC1 / RUNTIME-02) | ✓ VERIFIED | SidePanelRouter gates on `!hasProvider && !onboardingDone → OnboardingModal` (SidePanelRouter.tsx:36-38); ProviderRegistry starts empty. tests/entrypoints/sidepanel.test.tsx asserts 'onboarding gate pending → Onboarding'. Real-browser load flagged (human verification) |
| 3 | Opening the standalone re-focuses the existing tab instead of duplicating it (SC2 dedupe clause / RUNTIME-03) | ✓ VERIFIED | WorkspaceRouter.openStandalone (WorkspaceRouter.ts:71-110) is update-or-create: tabs.query → tabs.update+windows.update, never tabs.create when a tab exists. tests/core/workspace/WorkspaceRouter.test.ts asserts tabs.create NOT called on existing tab (behavioral test). Cmd+K 'Open Standalone' command wired to it |
| 4 | Workspace state hands off correctly between surfaces / surfaces share workspace state (SC2 handoff clause, WSPC-01, WSPC-02) | ✗ FAILED | WorkspaceStore.init()/start() and WorkspaceSync.start() have zero callers in src/ (grep verified). np_workspace never hydrated; workspaceId/conversationId regenerate per load; heartbeat/LWW/handoff/mirroring never run in the shipped extension. Active surface stuck at 'sidepanel' — visible in the shell header (SidePanelShell.tsx:63 `{mode} · {activeSurface}`). See gaps[0] |
| 5 | Theme toggles and both surfaces update immediately (SC3 / RUNTIME-04) | ✓ VERIFIED | ThemeStore.init() fired at module scope in both entrypoints; setMode writes np_theme, chrome.storage.onChanged propagates foreign writes (ThemeStore.test.ts behavioral tests with fakeBrowser); OptionsPage Appearance Segmented (light/dark/auto) wired to setMode; getAntdConfig derives per-surface config (compact:true side panel, default standalone) consumed by the single XProvider per surface (grep: ConfigProvider == 1 per entrypoint) |
| 6 | Cmd+K palette opens with the W-8 command set on both surfaces (SC4) | ✓ VERIFIED | Global mod+k capture (isCmdK) lifted at both entrypoints → controlled CmdKPicker; command const list has EXACTLY open-standalone / focus-side-panel / open-options (CmdKPicker.tsx:45-60); entrypoint smoke tests assert the palette opens on mod+k. Caveat: the 'Open Options' deep-link lands on Chat when the standalone tab doesn't exist yet (WR-05 warning) |
| 7 | Chat/Agent/Notes/Options page skeletons render in both surfaces with AntD theme; no innerHTML; no banned packages (SC5 / RUNTIME-05, WSPC-05) | ✓ VERIFIED | ChatPage/AgentPage/NotesPage/OptionsPage exist at §18 canonical paths with E5 verbatim copy ('Agent runs land here', 'New note', 'No provider connected…', chat.empty/loading); SidePanelShell renders ChatPage, StandaloneShell renders the §18 pages via StandalonePageRegistry; grep chrome. in src/components == 0; both mounts wrap ErrorBoundary; WSPC-05 components (ErrorBoundary/PortableMarkdown/FocusTrap/debugLog) exist with canonical §C.2 codes |
| 8 | Onboarding 'Configure later' escape persists across surface loads (D-06; goal 'share onboarding') | ✗ FAILED | useAddonSettingsStore.init() has zero callers in src/; onboarding.done written to np_addon_settings but never hydrated back — onboarding reappears on every reload after 'Configure later'. See gaps[1] |

**Score:** 6/8 truths verified (2 failed; 4 present+behavior-unverified in real browser — see behavior_unverified_items)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | np_workspace hydration + handoff wiring at the mounts | Phase 2 (informational) | Phase 2 SC2: "User's workspace state (theme, conversations, add-on state) persists across page reload and side-panel↔standalone handoff" overlaps the durable dimension, but Phase 2 plans are TBD and Phase 1's own SC2 + 01-06 plan intent make the wiring a Phase-1 obligation — kept as a real gap |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| package.json / pnpm-lock.yaml | pnpm-only, pinned approved stack | ✓ VERIFIED | wxt ^0.19.29, @wxt-dev/module-react ^1.2.2, antd ^6.5.3, immer ^10.2.0, zod ^3.25.76, typescript ^5.9.3, vitest ^4.1.10; no package-lock.json; verify:phase-1/verify:e2e-phase-1/verify:all scripts present |
| wxt.config.ts | Appendix G (sidepanel/standalone stems, chrome120, manualChunks) | ✓ VERIFIED | manualChunks applied via vite:build:extendConfig hook (documented deviation — MV3 SW forbids dynamic imports); target chrome120; sidepanel/standalone entrypoints |
| src/core/runtime/RuntimeEnvelope.ts, MessageType.ts, OperationId.ts | Appendix C/E + D-17 | ✓ VERIFIED | MessageType = Appendix E + exactly 4 D-17 additions (grep == 4); createOperationId = crypto.randomUUID(); Zod fixture tests green |
| src/types/workspace.ts, src/core/content/PageContext.ts, src/types/harness.ts | Full §21.5/D-18 field set, canonical homes | ✓ VERIFIED | All 14 WorkspaceState fields declared (D-18 inert set present — grep == 8), tsc green |
| src/core/messaging/MessageBus.ts + MessageBusBridge.ts, src/core/events/EventBus.ts + EventBusManager.ts | Cross-context infra, whitelist enforcement | ✓ VERIFIED | MessageTypeValues whitelist in MessageBus + BroadcastBus + WorkspaceSync; bridge is the only surface-facing entry; tests green. Caveat: ambient `declare const debugLog` in EventBus/MessageBus/BroadcastBus is never bound — error logging dead in effect (WR-01 warning) |
| src/core/error/errorCodes.ts + debugLog.ts, TraceRedactor.ts, i18n, KeymapRegistry | Golden Rule 9 / R-10 | ✓ VERIFIED | Canonical §C.2 codes; debugLog routes strings through TraceRedactor; errorCodes contains WORKSPACE_/THEME_/REGISTRY_/CMDK_ codes; i18n getString/formatString; KEYMAP.CMD_K + isCmdK |
| src/core/components/ErrorBoundary.tsx, PortableMarkdown.tsx, FocusTrap.tsx | WSPC-05 | ✓ VERIFIED | componentDidCatch → debugLog(COMPONENT_RENDER); PortableMarkdown skipHtml+DOMPurify (react-markdown imports == 0); FocusTrap traps + restores focus; no MinimalMode (I2) |
| src/core/theme/ThemeStore.ts, antdConfig.ts, themePacks.ts, ThemePackRegistry.ts | D-13, RUNTIME-04, WSPC-04 | ✓ VERIFIED | chrome.storage.local np_theme/np_theme_pack + onChanged (grep == 16); zustand persist == 0 (Pitfall 7); default pack ready, liquid-glass/claude-warm not-ready; getAntdConfig consumed by both mounts |
| src/core/workspace/WorkspaceStore.ts, WorkspaceRouter.ts, WorkspaceSync.ts, src/core/runtime/BroadcastBus.ts | WSPC-01/02, RUNTIME-03, Appendix M | ⚠️ ORPHANED | All fully implemented + unit-tested (163-suite green) but WorkspaceStore.init/start and WorkspaceSync.start have zero production callers — cross-surface sync is dead code in the shipped extension (gaps[0]) |
| src/core/registry/* (Registry, AddonRegistry, AddonSettingsStore, PageRegistry, SidePanelPageRegistry, StandalonePageRegistry) | WSPC-04 | ⚠️ PARTIAL | Registries built + singleton page registries pre-register nav pages; AddonSettingsStore.init orphaned → onboarding-done not hydrated (gaps[1]) |
| src/core/content/ContentScriptHost.ts, PageContextBridge.ts, src/entrypoints/core.content.ts | D-16/R-5 extraction-only ISOLATED | ✓ VERIFIED | defineContentScript world ISOLATED (grep == 4); zero react/antd/zustand imports in src/core/content; content bundle clean |
| src/core/ai/ProviderRegistry.ts | D-07 gate | ✓ VERIFIED | hasActiveProvider/getActiveProvider/registerActiveProvider; gate wired in SidePanelRouter via useSyncExternalStore |
| src/components/sidepanel/*, standalone/*, OnboardingModal.tsx, cmdk/CmdKPicker.tsx, pages/* | RUNTIME-03/05, WSPC-05, D-06/07 | ✓ VERIFIED | Shells/routers/pages render (unit-tested); 'Configure later' present; W-8 command set exact; ErrorBoundary everywhere; chrome. in components == 0. Caveats: onboarding persistence (gaps[1]), Options deep-link (WR-05) |
| src/entrypoints/sidepanel/main.tsx, standalone/main.tsx | Appendix F one provider per surface | ✓ VERIFIED | Single XProvider (+AntdApp) per surface; isReady null-gate; mod+k capture; createRoot only here. Missing workspace/onboarding hydrate (gaps) |
| src/entrypoints/background.ts + src/core/background/* | §5.1 canonical SW, BLOCKER 3 | ✓ VERIFIED | All four managers register synchronously; BackgroundRouter sender.id + MessageTypeValues validation, workerState.ok/fail replies; LifecycleManager setPanelBehavior (grep == 1); no React/antd imports (grep == 0). Caveat: unguarded cast on inbound message (WR-09) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| sidepanel/main.tsx | useThemeStore.init() | module-scope call | WIRED | Line 83 — theme hydrate before first render |
| sidepanel/main.tsx | useWorkspaceStore.init()/WorkspaceSync | entrypoint mount | NOT_WIRED | Zero callers — gaps[0] |
| sidepanel/main.tsx | useAddonSettingsStore.init() | entrypoint mount | NOT_WIRED | Zero callers — gaps[1] |
| standalone/main.tsx | useThemeStore.init() | module-scope call | WIRED | Line 78 |
| standalone/main.tsx | useWorkspaceStore / WorkspaceSync / AddonSettingsStore init | entrypoint mount | NOT_WIRED | Same gaps |
| CmdKPicker commands | WorkspaceRouter.openStandalone/openSidePanel | run() callbacks | WIRED | Command execution delegated to the gesture-safe router |
| WorkspaceRouter.openStandalone | chrome.tabs.query(update-or-create) | callback chain | WIRED | Dedupe verified by behavioral test (tabs.create NOT called) |
| SidePanelRouter | ProviderRegistry.hasActiveProvider() | useSyncExternalStore | WIRED | D-07 gate, W-10 (not onboarding-done flag) |
| OptionsPage | ThemeStore.setMode | Segmented onChange | WIRED | E5 displayMode selector (D-14) |
| BackgroundRouter | MessageBus + workerState | runtime.onMessage dispatch | WIRED | Whitelist + sender.id + ok/fail replies |
| LifecycleManager | chrome.sidePanel.setPanelBehavior | onInstalled+onStartup | WIRED | §5.3 action-button path (Pitfall 1 mitigation) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| SidePanelShell header | workspace.activeSurface | WorkspaceStore state (default 'sidepanel') | ⚠️ STATIC | Store never init'd/started in production → activeSurface never updates from storage (gaps[0]) |
| ThemeStore mode/pack | np_theme / np_theme_pack | chrome.storage.local via init() | ✓ FLOWING | init wired at both entrypoints; onChanged propagates foreign writes |
| AddonSettingsStore settings | np_addon_settings | chrome.storage.local via init() | ✗ DISCONNECTED | init never called → settings always {} in production; onboarding.done write lost on reload (gaps[1]) |
| CmdKPicker commands | static COMMANDS const | typed array (no free-form) | ✓ FLOWING | Open Standalone/Focus Side Panel/Open Options — no stub commands (W-8) |
| OptionsPage mode | ThemeStore.mode | setMode → np_theme → onChanged | ✓ FLOWING | Cross-surface propagation wired (real-browser behavior flagged) |
| Standalone page nav | useStandaloneNav activePageId | in-memory zustand (fresh per tab) | ✗ DISCONNECTED | 'Open Options' deep-link lost for a fresh standalone tab (WR-05) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase gate (eslint→prettier→tsc→build→vitest→isolation) | `pnpm verify:phase-1` | exit 0; 26 files/163 tests; content bundle clean | ✓ PASS |
| Build emits all 4 entrypoints | wxt build (in gate) | sidepanel.html, standalone.html, background.js, content-scripts/core.js | ✓ PASS |
| MessageType D-17 additions | grep count | == 4 (PING/PONG/GET_CONTENT_CAPABILITIES/CONTENT_CAPABILITIES) | ✓ PASS |
| No zustand persist in stores (Pitfall 7) | grep | 0 in ThemeStore/WorkspaceStore/AddonSettingsStore | ✓ PASS |
| No awaited tabs.query in router (Pitfall 1) | grep | 0 in src/core/workspace | ✓ PASS |
| No banned packages / no innerHTML | grep + node check | 0 / 0 | ✓ PASS |
| Chrome for Testing runnable | `.cache/chrome-for-testing/chrome/linux-151.0.7922.77/chrome-linux64/chrome --version` | FAILED: "error while loading shared libraries: libnspr4.so" | ✗ FAIL (host limitation — e2e gate wired but unrunnable here) |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| verify:e2e-phase-1 (tests/e2e/load-smoke.mjs) | `pnpm verify:e2e-phase-1` | Not runnable — Chrome for Testing binary present (.cache/chrome-for-testing) but fails with missing libnspr4.so (host lacks Chrome system libs, RESEARCH A8) | SKIP (host limitation — routed to human verification) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RUNTIME-01 | 01-01, 01-02, 01-04 | WXT MV3 builds with 4 entrypoints | ✓ SATISFIED | Gate green; .output/chrome-mv3 has all 4 entrypoint artifacts; content bundle isolated |
| RUNTIME-02 | 01-03, 01-04, 01-09 | Side panel opens; first-run onboarding on fresh install | ✓ SATISFIED (persistence caveat) | Entrypoint smoke tests; onboarding gate wired. Real-browser load + onboarding persistence after 'Configure later' need human/browser verification (gaps[1]) |
| RUNTIME-03 | 01-06, 01-08 | Standalone opens; state hands off; no duplicate tabs | ⚠️ PARTIAL | Dedupe verified (behavioral test); handoff never runs in production (gaps[0]) |
| RUNTIME-04 | 01-05 | AntD theme via ThemeStore + antdConfig (compact/default) | ✓ SATISFIED | Single XProvider per surface with per-surface config; setMode + onChanged wired |
| RUNTIME-05 | 01-07, 01-08, 01-09 | Page skeletons render in both surfaces | ✓ SATISFIED | All 4 pages exist with E5 copy; both mount smoke tests green; real-Chrome load flagged |
| WSPC-01 | 01-06, 01-09 | WorkspaceStore persists theme, conversation, add-on state | ✗ BLOCKED | Store never init'd/started in production — np_workspace never round-trips; theme persistence (ThemeStore) works, add-on/workspace persistence doesn't (gaps[0], gaps[1]) |
| WSPC-02 | 01-06, 01-09 | WorkspaceSync keeps surfaces in sync via BroadcastBus | ✗ BLOCKED | WorkspaceSync never instantiated in src/ — heartbeat/LWW/handoff are dead code in the shipped extension (gaps[0]) |
| WSPC-03 | 01-02, 01-03 | MessageBus/EventBus/BroadcastBus cross-context communication | ✓ SATISFIED | Built, whitelist-enforced, used by BackgroundRouter + WorkspaceSync; tests green. WR-01 dead-debugLog warning |
| WSPC-04 | 01-05, 01-07 | Registries register add-ons at startup | ✓ SATISFIED (caveat) | Registry base + all 5 §18 registries + content PageRegistry; singletons pre-register nav pages; AddonSettingsStore.init orphaned (gaps[1]) |
| WSPC-05 | 01-04, 01-08 | ErrorBoundary, PortableMarkdown, debugLog (canonical §C.2) | ✓ SATISFIED | All exist, tested; canonical codes used. WR-01/07/08 warnings |

All 10 requirement IDs (RUNTIME-01…05, WSPC-01…05) are accounted for across plans 01-01 → 01-09 (no orphans). REQUIREMENTS.md detail section shows all 10 as `[x]`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/core/events/EventBus.ts, src/core/messaging/MessageBus.ts, src/core/runtime/BroadcastBus.ts | 35 / 29 / 29 | Ambient `declare const debugLog` never bound — catch bodies are dead (REVIEW WR-01) | ⚠️ Warning | Golden Rule 9 violated in effect: handler exceptions, publish failures, emit failures silently swallowed — observability contract (R-10) not effective in these modules |
| src/core/workspace/WorkspaceSync.ts | 198-217 | handleRemoteUpdate adopts remote state verbatim — no workspaceId gate, no schema validation (REVIEW WR-04) | ⚠️ Warning | Cross-workspace contamination + malformed-state adoption once sync is wired (latent today — sync never started) |
| src/components/OnboardingModal.tsx / CmdKPicker.tsx | 32-37 / 58-65 | 'Configure provider' + 'Open Options' deep-link lost — new standalone tab boots fresh nav store defaulting to 'chat' (REVIEW WR-05) | ⚠️ Warning | D-09 deep-link to Options lands on Chat when the tab doesn't exist yet |
| src/components/pages/OptionsPage.tsx | 26-33 | Theme-save error toast unreachable — setMode always adopts, comparison always false (REVIEW WR-06) | ⚠️ Warning | E5 persistence-error contract can never fire |
| src/core/background/BackgroundRouter.ts | 47-60 | Inbound message cast without structural guard — null/malformed message throws synchronously (REVIEW WR-09) | ⚠️ Warning | Unhandled listener error; sender promise hangs |
| src/core/ai/ProviderRegistry.ts | 35-38 | Empty catch without debugLog (REVIEW WR-08) | ℹ️ Info | Golden Rule 9 hygiene; one line to fix |
| .planning/REQUIREMENTS.md | 180-181 | Traceability rows stale: RUNTIME row "In Progress (RUNTIME-01, RUNTIME-02, RUNTIME-03, RUNTIME-04 done)" — RUNTIME-05 omitted from the done list and both Phase-1 rows not flipped to Done, while the detail section (lines 12-24) marks all 10 `[x]` | ⚠️ Warning | Range rows (RUNTIME-01…05) could not be parsed per-ID by the mark-complete tool; end state on disk is inconsistent — the checkbox list is authoritative (all done), the table needs a per-ID or "Done" update |

### Human Verification Required

1. **Real-browser MV3 load gate** — run `pnpm verify:e2e-phase-1` on a host with Chrome system libs: sidepanel.html and standalone.html must mount console-error-free. The CfT binary is present in `.cache/chrome-for-testing` but fails with `libnspr4.so: cannot open shared object file` on this host.
2. **Action-button → side panel gesture** — click the extension action button in a real Chrome session; LifecycleManager's `setPanelBehavior({openPanelOnActionClick:true})` must open the side panel.
3. **Standalone tab dedupe in real browser** — run 'Open Standalone' twice; only one tab, second run focuses it.
4. **Cross-window PING/PONG election + LWW adoption** (once gaps[0] is wired) — two live contexts exchange heartbeats; higher-version workspace wins.
5. **Theme propagation across two live surfaces** — toggle display mode in standalone Options; side panel updates without reload.
6. **Real keyboard focus flow** — mod+k opens the palette in both surfaces; FocusTrap traps and restores focus.

### Gaps Summary

The phase gate is genuinely green (verify:phase-1 exits 0; 163 tests; clean build; isolated content bundle) and 8 of 10 requirements are satisfied or close, but the **phase goal's core "share" clauses are not met in the shipped extension**:

1. **Workspace state is not shared** — `WorkspaceStore.init()/start()` and `WorkspaceSync.start()` have zero production callers. The complete, unit-tested workspace/sync layer (np_workspace hydration, BroadcastBus heartbeat, WORKSPACE_UPDATED LWW adoption, WORKSPACE_HANDOFF state machine, mirroring) is dead code outside tests. The 01-06 plan's own purpose statement ("01-08 shells and 01-09 mounts consume it") was never executed — a genuine SC2 handoff failure, not accepted scope.

2. **Onboarding is not persistent** — `AddonSettingsStore.init()` has zero production callers. 'Configure later' (D-06) marks onboarding done only in memory; every reload re-shows the OnboardingModal.

Both are one-shot entrypoint wiring fixes (fire init/start at both mounts, as prescribed by REVIEW.md WR-02/WR-03). The remaining findings are warnings (dead ambient debugLog, unguarded WorkspaceSync adoption, Options deep-link, theme-toast dead code) and host-limited e2e flags. REQUIREMENTS.md traceability rows are stale despite all-`[x]` detail entries.

---

_Verified: 2026-08-08T13:40:00Z_
_Verifier: the agent (gsd-verifier)_
