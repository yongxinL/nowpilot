---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
verified: 2026-08-08T22:30:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 4 # Present + wired, behavior not exercised in a real browser (Chrome for Testing binary present but unrunnable — missing libnspr4.so); code-level + unit behavioral evidence green
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/8
  gaps_closed:
    - "Side panel and standalone surfaces share workspace state; workspace state hands off correctly when the standalone opens (SC2, WSPC-01, WSPC-02) — WorkspaceStore.init()/start() + WorkspaceSync.start() wired at both entrypoint mounts (01-10, WR-03) with behavioral tests"
    - "Onboarding 'Configure later' escape persists across surface loads (D-06) — useAddonSettingsStore.init() wired at both mounts (01-10, WR-02) with a fresh-module round-trip behavioral test"
  gaps_remaining: []
  regressions: []
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
  - test: "In a runnable browser, verify the cross-window PING/PONG election and WORKSPACE_UPDATED LWW adoption now that the WR-03 wiring is live"
    expected: "Two extension contexts exchange heartbeats and the higher-version workspace wins"
    why_human: "Cross-window election behavior is deferred to browser e2e (01-06 flagged assumption); the unit layer (heartbeat/LWW/handoff) is covered by WorkspaceSync.test.ts"
---

# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace Verification Report

**Phase Goal:** An installable MV3 extension with side panel and standalone surfaces that share workspace state, theme, onboarding, and command palette.
**Verified:** 2026-08-08T22:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (01-10 mount wiring + 01-11 messaging hardening)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Installable MV3 extension builds with side panel, standalone, background SW, and extraction-only content entrypoints (RUNTIME-01) | ✓ VERIFIED | `pnpm verify:phase-1` exits 0 (rerun 2026-08-08, twice confirmed): eslint → prettier → tsc --noEmit → wxt build → 26 files/169 tests green → check-content-bundle clean. `.output/chrome-mv3/` contains sidepanel.html, standalone.html, background.js, content-scripts/core.js (158.93 KB). Content bundle isolated (0 forbidden UI tokens) |
| 2 | First-run onboarding appears on a fresh install (SC1 / RUNTIME-02) | ✓ VERIFIED | SidePanelRouter gates on `!hasProvider && !onboardingDone → OnboardingModal` (SidePanelRouter.tsx:36-38); ProviderRegistry starts empty; onboarding.done now persists via np_addon_settings hydration (gaps[1] closed). Real-browser load flagged (human verification) |
| 3 | Opening the standalone re-focuses the existing tab instead of duplicating it (SC2 dedupe clause / RUNTIME-03) | ✓ VERIFIED | WorkspaceRouter.openStandalone (WorkspaceRouter.ts:71-110) is update-or-create: tabs.query → tabs.update+windows.update, never tabs.create when a tab exists. tests/core/workspace/WorkspaceRouter.test.ts asserts tabs.create NOT called on existing tab (behavioral test). Cmd+K 'Open Standalone' command wired to it |
| 4 | Workspace state hands off correctly between surfaces / surfaces share workspace state (SC2 handoff clause, WSPC-01, WSPC-02) | ✓ VERIFIED | **GAP CLOSED (01-10, WR-03):** `useWorkspaceStore.getState().init()` → `getState().start('sidepanel'|'standalone')` → module-scope `new WorkspaceSync(surface).start()` wired at BOTH mounts (sidepanel/main.tsx:99-106, standalone/main.tsx:94-101; exactly 1 call site per file). np_workspace hydrates, start() writes D-18 active fields with version bump, WorkspaceSync.start() activates heartbeat / WORKSPACE_UPDATED LWW / handoff state machine / mirroring. Behavioral tests assert isReady===true, activeSurface==='sidepanel'/'standalone', version>=1 at both mounts (tests/entrypoints/sidepanel.test.tsx:64-73, standalone.test.tsx:41-48). Inbound adoption hardened (01-11 WR-04: sanitizeStored + workspaceId scope gate) |
| 5 | Theme toggles and both surfaces update immediately (SC3 / RUNTIME-04) | ✓ VERIFIED | ThemeStore.init() fired at module scope in both entrypoints; setMode writes np_theme, chrome.storage.onChanged propagates foreign writes (ThemeStore.test.ts behavioral tests with fakeBrowser); OptionsPage Appearance Segmented (light/dark/auto) wired to setMode; getAntdConfig derives per-surface config (compact:true side panel, default standalone) consumed by the single XProvider per surface |
| 6 | Cmd+K palette opens with the W-8 command set on both surfaces (SC4) | ✓ VERIFIED | Global mod+k capture (isCmdK) lifted at both entrypoints → controlled CmdKPicker; command const list has EXACTLY open-standalone / focus-side-panel / open-options (CmdKPicker.tsx:45-60); entrypoint smoke tests assert the palette opens on mod+k. Caveat: 'Open Options' deep-link lands on Chat when the standalone tab doesn't exist yet (WR-05, deferred to standalone-nav work) |
| 7 | Chat/Agent/Notes/Options page skeletons render in both surfaces with AntD theme; no innerHTML; no banned packages (SC5 / RUNTIME-05, WSPC-05) | ✓ VERIFIED | ChatPage/AgentPage/NotesPage/OptionsPage exist at §18 canonical paths with E5 copy; SidePanelShell renders ChatPage, StandaloneShell renders the §18 pages via StandalonePageRegistry; grep chrome. in src/components == 0; both mounts wrap ErrorBoundary; WSPC-05 components (ErrorBoundary/PortableMarkdown/FocusTrap/debugLog) exist with canonical §C.2 codes |
| 8 | Onboarding 'Configure later' escape persists across surface loads (D-06; goal 'share onboarding') | ✓ VERIFIED | **GAP CLOSED (01-10, WR-02):** `useAddonSettingsStore.getState().init()` wired at both mounts (sidepanel/main.tsx:96, standalone/main.tsx:91; 1 call per file). Round-trip behavioral test: seed `np_addon_settings { onboarding: { done: true } }` → vi.resetModules + fresh import → settings.onboarding.done===true hydrated AND the shell renders, OnboardingModal NOT shown (tests/entrypoints/sidepanel.test.tsx:75-94); standalone hydration test (standalone.test.tsx:50-65) |

**Score:** 8/8 truths verified (2 previously-failed now closed; 4 present+behavior-unverified in real browser — see behavior_unverified_items)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| package.json / pnpm-lock.yaml | pnpm-only, pinned approved stack | ✓ VERIFIED | wxt ^0.19.29, @wxt-dev/module-react ^1.2.2, antd ^6.5.3, immer ^10.2.0, zod ^3.25.76, typescript ^5.9.3, vitest ^4.1.10; no package-lock.json; verify:phase-1/verify:e2e-phase-1/verify:all scripts present |
| wxt.config.ts | Appendix G (sidepanel/standalone stems, chrome120, manualChunks) | ✓ VERIFIED | manualChunks applied via vite:build:extendConfig hook (documented deviation — MV3 SW forbids dynamic imports); target chrome120; sidepanel/standalone entrypoints |
| src/core/runtime/RuntimeEnvelope.ts, MessageType.ts, OperationId.ts | Appendix C/E + D-17 | ✓ VERIFIED | MessageType = Appendix E + exactly 4 D-17 additions (grep == 4); createOperationId = crypto.randomUUID(); Zod fixture tests green |
| src/types/workspace.ts, src/core/content/PageContext.ts, src/types/harness.ts | Full §21.5/D-18 field set, canonical homes | ✓ VERIFIED | All 14 WorkspaceState fields declared (D-18 inert set present — grep == 8), tsc green |
| src/core/messaging/MessageBus.ts + MessageBusBridge.ts, src/core/events/EventBus.ts + EventBusManager.ts | Cross-context infra, whitelist enforcement | ✓ VERIFIED | MessageTypeValues whitelist in MessageBus + BroadcastBus + WorkspaceSync; bridge is the only surface-facing entry; tests green. **WR-01 closed (01-11):** real debugLog imports + direct ERROR_CODES calls; ambient hook gone (grep == 0); **WR-09 closed:** isRuntimeEnvelopeShape exported (MessageBus.ts:130) |
| src/core/error/errorCodes.ts + debugLog.ts, TraceRedactor.ts, i18n, KeymapRegistry | Golden Rule 9 / R-10 | ✓ VERIFIED | Canonical §C.2 codes; debugLog routes strings through TraceRedactor; errorCodes contains WORKSPACE_/THEME_/REGISTRY_/CMDK_ codes; i18n getString/formatString; KEYMAP.CMD_K + isCmdK. WR-07 (debugLog options.extra redaction) deferred to the security phase implementing real TraceRedactor (today redact is a pass-through stub — nothing leaks) |
| src/core/components/ErrorBoundary.tsx, PortableMarkdown.tsx, FocusTrap.tsx | WSPC-05 | ✓ VERIFIED | componentDidCatch → debugLog(COMPONENT_RENDER); PortableMarkdown skipHtml+DOMPurify (react-markdown imports == 0); FocusTrap traps + restores focus; no MinimalMode (I2) |
| src/core/theme/ThemeStore.ts, antdConfig.ts, themePacks.ts, ThemePackRegistry.ts | D-13, RUNTIME-04, WSPC-04 | ✓ VERIFIED | chrome.storage.local np_theme/np_theme_pack + onChanged (grep == 16); zustand persist == 0 (Pitfall 7); default pack ready; getAntdConfig consumed by both mounts |
| src/core/workspace/WorkspaceStore.ts, WorkspaceRouter.ts, WorkspaceSync.ts, src/core/runtime/BroadcastBus.ts | WSPC-01/02, RUNTIME-03, Appendix M | ✓ VERIFIED | **Now LIVE (01-10):** init/start/WorkspaceSync.start called at both entrypoint mounts; np_workspace round-trips; heartbeat/LWW/handoff/mirroring run in the shipped extension. **Hardened (01-11):** sanitizeStored exported (WorkspaceStore.ts:64) + workspaceId scope gate in handleRemoteUpdate (WorkspaceSync.ts:223); negative tests (foreign/malformed ignored) |
| src/core/registry/* (Registry, AddonRegistry, AddonSettingsStore, PageRegistry, SidePanelPageRegistry, StandalonePageRegistry) | WSPC-04 | ✓ VERIFIED | Registries built + singleton page registries pre-register nav pages; **AddonSettingsStore.init wired at both mounts (01-10)** — onboarding.done hydrates on every surface load (gaps[1] closed) |
| src/core/content/ContentScriptHost.ts, PageContextBridge.ts, src/entrypoints/core.content.ts | D-16/R-5 extraction-only ISOLATED | ✓ VERIFIED | defineContentScript world ISOLATED (grep == 4); zero react/antd/zustand imports in src/core/content; content bundle clean |
| src/core/ai/ProviderRegistry.ts | D-07 gate | ✓ VERIFIED | hasActiveProvider/getActiveProvider/registerActiveProvider; gate wired in SidePanelRouter via useSyncExternalStore. **WR-08 closed (01-11):** notify() catch logs ERROR_CODES.EVT_HANDLER — no empty catch |
| src/components/sidepanel/*, standalone/*, OnboardingModal.tsx, cmdk/CmdKPicker.tsx, pages/* | RUNTIME-03/05, WSPC-05, D-06/07 | ✓ VERIFIED | Shells/routers/pages render (unit-tested); 'Configure later' present; W-8 command set exact; ErrorBoundary everywhere; chrome. in components == 0. Caveats: Options deep-link (WR-05, deferred), theme-toast dead code (WR-06, deferred) |
| src/entrypoints/sidepanel/main.tsx, standalone/main.tsx | Appendix F one provider per surface + full store activation | ✓ VERIFIED | Single XProvider (+AntdApp) per surface; isReady null-gate; mod+k capture; createRoot only here; **01-10 wiring:** theme hydrate → addon-settings hydrate → workspace init().then(start; sync.start()) at both mounts |
| src/entrypoints/background.ts + src/core/background/* | §5.1 canonical SW, BLOCKER 3 | ✓ VERIFIED | All four managers register synchronously; BackgroundRouter sender.id + isRuntimeEnvelopeShape (WR-09) + MessageTypeValues validation, workerState.ok/fail replies incl. MSG_DESERIALIZE 'malformed envelope'; LifecycleManager setPanelBehavior (grep == 1); no React/antd imports (grep == 0) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| sidepanel/main.tsx | useThemeStore.init() | module-scope call | WIRED | Line 94 — theme hydrate before first render |
| sidepanel/main.tsx | useWorkspaceStore.init()/WorkspaceSync | entrypoint mount | WIRED | **01-10:** line 102 init → line 104 start('sidepanel') → line 105 workspaceSync.start() |
| sidepanel/main.tsx | useAddonSettingsStore.init() | entrypoint mount | WIRED | **01-10:** line 96 — np_addon_settings hydration |
| standalone/main.tsx | useThemeStore.init() | module-scope call | WIRED | Line 89 |
| standalone/main.tsx | useWorkspaceStore / WorkspaceSync / AddonSettingsStore init | entrypoint mount | WIRED | **01-10:** lines 91/97/99/100 — full chain with surface 'standalone' |
| CmdKPicker commands | WorkspaceRouter.openStandalone/openSidePanel | run() callbacks | WIRED | Command execution delegated to the gesture-safe router |
| WorkspaceRouter.openStandalone | chrome.tabs.query(update-or-create) | callback chain | WIRED | Dedupe verified by behavioral test (tabs.create NOT called) |
| SidePanelRouter | ProviderRegistry.hasActiveProvider() | useSyncExternalStore | WIRED | D-07 gate, W-10 (onboarding-done read live from hydrated settings — D-06 persistence now real) |
| SidePanelRouter | useAddonSettingsStore settings.onboarding.done | hydrated store state | WIRED | **01-10:** onboardingDone reads persisted value (SidePanelRouter.tsx:34); round-trip test proves shell-not-modal on fresh load |
| OptionsPage | ThemeStore.setMode | Segmented onChange | WIRED | E5 displayMode selector (D-14) |
| WorkspaceSync.handleRemoteUpdate | WorkspaceStore.sanitizeStored + workspaceId scope gate | inbound adoption | WIRED | **01-11 WR-04:** WorkspaceSync.ts:213 sanitize → :223 scope gate → :232 LWW → :242 merge adoption |
| BackgroundRouter listener | MessageBus.isRuntimeEnvelopeShape | runtime.onMessage dispatch | WIRED | **01-11 WR-09:** shape guard (line 59) before whitelist check; MSG_DESERIALIZE fail-envelope reply (line 60); manual cast removed |
| EventBus/MessageBus/BroadcastBus catches | debugLog + ERROR_CODES | catch bodies | WIRED | **01-11 WR-01:** EVT_HANDLER/MSG_SERIALIZE direct calls; ambient hook deleted (grep == 0) |
| LifecycleManager | chrome.sidePanel.setPanelBehavior | onInstalled+onStartup | WIRED | §5.3 action-button path (Pitfall 1 mitigation) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| SidePanelShell header | workspace.activeSurface | WorkspaceStore state via module-scope start('sidepanel') | ✓ FLOWING | **01-10:** init() hydrates np_workspace; start() writes active fields + version bump at both mounts; behavioral tests assert activeSurface + version>=1 |
| ThemeStore mode/pack | np_theme / np_theme_pack | chrome.storage.local via init() | ✓ FLOWING | init wired at both entrypoints; onChanged propagates foreign writes |
| AddonSettingsStore settings | np_addon_settings | chrome.storage.local via init() | ✓ FLOWING | **01-10:** init wired at both mounts; onboarding.done round-trip proven by fresh-module behavioral test |
| CmdKPicker commands | static COMMANDS const | typed array (no free-form) | ✓ FLOWING | Open Standalone/Focus Side Panel/Open Options — no stub commands (W-8) |
| OptionsPage mode | ThemeStore.mode | setMode → np_theme → onChanged | ✓ FLOWING | Cross-surface propagation wired (real-browser behavior flagged) |
| Standalone page nav | useStandaloneNav activePageId | in-memory zustand (fresh per tab) | ✗ DISCONNECTED | 'Open Options' deep-link lost for a fresh standalone tab (WR-05 — deferred to standalone-nav persistence work) |
| WorkspaceSync inbound WORKSPACE_UPDATED | sanitized remote state | sanitizeStored → workspaceId gate → LWW | ✓ FLOWING | **01-11:** malformed/foreign snapshots ignored (logged WORKSPACE_SYNC); same-id higher-version adopted via field-preserving merge |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase gate (eslint→prettier→tsc→build→vitest→isolation) | `pnpm verify:phase-1` | exit 0 (rerun twice 2026-08-08); 26 files/169 tests; content bundle clean | ✓ PASS |
| Build emits all 4 entrypoints | wxt build (in gate) | sidepanel.html, standalone.html, background.js, content-scripts/core.js | ✓ PASS |
| Workspace lifecycle wired at mounts (gaps[0] closure) | grep production callers | useWorkspaceStore.getState().init == 1 per entrypoint; getState().start('sidepanel'/'standalone') == 1 per entrypoint; new WorkspaceSync == 1 per entrypoint; .start() called in the init().then chain | ✓ PASS |
| AddonSettings hydration at mounts (gaps[1] closure) | grep production callers | useAddonSettingsStore.getState().init == 1 per entrypoint (sidepanel/main.tsx:96, standalone/main.tsx:91) | ✓ PASS |
| WR-01 regression guard (ambient hook gone) | grep | `declare const debugLog` / `typeof debugLog` in src/core/{events,messaging,runtime} == 0; real `import { debugLog }` == 3 | ✓ PASS |
| WR-04 inbound adoption gates | grep + test | sanitizeStored export == 1; `workspaceId !== local.workspaceId` == 1; negative tests ws-foreign/malformed present and green | ✓ PASS |
| WR-09 envelope shape guard | grep | isRuntimeEnvelopeShape export == 1; used in BackgroundRouter == 4 (import + guard + comments); MSG_DESERIALIZE fail reply == 1 | ✓ PASS |
| MessageType D-17 additions | grep count | == 4 (PING/PONG/GET_CONTENT_CAPABILITIES/CONTENT_CAPABILITIES) | ✓ PASS |
| No zustand persist in stores (Pitfall 7) | grep | 0 in ThemeStore/WorkspaceStore/AddonSettingsStore | ✓ PASS |
| No awaited tabs.query in router (Pitfall 1) | grep | 0 in src/core/workspace | ✓ PASS |
| No banned packages / no innerHTML | grep + node check | 0 / 0 | ✓ PASS |
| Chrome for Testing runnable | `.cache/chrome-for-testing/chrome/linux-151.0.7922.77/chrome-linux64/chrome --version` | FAILED: "error while loading shared libraries: libnspr4.so" | ✗ FAIL (host limitation — e2e gate wired but unrunnable here; carried to human verification) |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| verify:e2e-phase-1 (tests/e2e/load-smoke.mjs) | `pnpm verify:e2e-phase-1` | Not runnable — Chrome for Testing binary present (.cache/chrome-for-testing) but fails with missing libnspr4.so (host lacks Chrome system libs, RESEARCH A8; reconfirmed 2026-08-08) | SKIP (host limitation — routed to human verification) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RUNTIME-01 | 01-01, 01-02, 01-04 | WXT MV3 builds with 4 entrypoints | ✓ SATISFIED | Gate green; .output/chrome-mv3 has all 4 entrypoint artifacts; content bundle isolated |
| RUNTIME-02 | 01-03, 01-04, 01-09, 01-10 | Side panel opens; first-run onboarding on fresh install; 'Configure later' persists | ✓ SATISFIED | Entrypoint smoke tests; onboarding gate wired; **D-06 persistence proven by fresh-module round-trip test (01-10)**. Real-browser load flagged (human verification) |
| RUNTIME-03 | 01-06, 01-08, 01-10 | Standalone opens; state hands off; no duplicate tabs | ✓ SATISFIED | Dedupe verified (behavioral test); **handoff state machine + sync loop now live via mount wiring (01-10)**; real-browser PING/PONG election flagged (human verification) |
| RUNTIME-04 | 01-05 | AntD theme via ThemeStore + antdConfig (compact/default) | ✓ SATISFIED | Single XProvider per surface with per-surface config; setMode + onChanged wired |
| RUNTIME-05 | 01-07, 01-08, 01-09 | Page skeletons render in both surfaces | ✓ SATISFIED | All 4 pages exist with E5 copy; both mount smoke tests green; real-Chrome load flagged |
| WSPC-01 | 01-06, 01-09, 01-10 | WorkspaceStore persists theme, conversation, add-on state | ✓ SATISFIED | **Store init/start wired at both mounts (01-10)** — np_workspace round-trips in the shipped extension; behavioral tests assert isReady/activeSurface/version at both mounts |
| WSPC-02 | 01-06, 01-09, 01-10 | WorkspaceSync keeps surfaces in sync via BroadcastBus | ✓ SATISFIED | **WorkspaceSync instantiated + started at both mounts (01-10)** — heartbeat/LWW/handoff/mirroring active; inbound path hardened (01-11 WR-04) |
| WSPC-03 | 01-02, 01-03, 01-11 | MessageBus/EventBus/BroadcastBus cross-context communication | ✓ SATISFIED | Built, whitelist-enforced, used by BackgroundRouter + WorkspaceSync; **WR-01 real debugLog + WR-09 envelope shape guard (01-11)**; tests green |
| WSPC-04 | 01-05, 01-07, 01-10 | Registries register add-ons at startup | ✓ SATISFIED | Registry base + all 5 §18 registries + content PageRegistry; singletons pre-register nav pages; **AddonSettingsStore.init wired at both mounts (01-10)** — settings hydrate on boot |
| WSPC-05 | 01-04, 01-08, 01-11 | ErrorBoundary, PortableMarkdown, debugLog (canonical §C.2) | ✓ SATISFIED | All exist, tested; canonical codes used; **WR-08 ProviderRegistry catch filled (01-11)**. WR-07 (extra redaction) deferred to the security phase |

All 10 requirement IDs (RUNTIME-01…05, WSPC-01…05) are accounted for across plans 01-01 → 01-11 (no orphans). REQUIREMENTS.md detail section shows all 10 as `[x]`; range rows 180-181 flipped to `Done` by 01-10 and re-confirmed on disk (`| RUNTIME-01…05 | Phase 1 | Done |`, `| WSPC-01…05 | Phase 1 | Done |`).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/OnboardingModal.tsx / CmdKPicker.tsx | 32-37 / 58-65 | 'Configure provider' + 'Open Options' deep-link lost — new standalone tab boots fresh nav store defaulting to 'chat' (REVIEW WR-05) | ⚠️ Warning (deferred) | D-09 deep-link to Options lands on Chat when the tab doesn't exist yet — owned by the standalone-nav persistence work (01-11 context explicit deferral) |
| src/components/pages/OptionsPage.tsx | 26-33 | Theme-save error toast unreachable — setMode always adopts, comparison always false (REVIEW WR-06) | ⚠️ Warning (deferred) | E5 persistence-error contract can never fire — owned by the ThemeStore write-path change (01-11 context explicit deferral) |
| src/core/error/debugLog.ts | options.extra | extra payload not passed through a redaction pass (REVIEW WR-07) | ⚠️ Warning (deferred) | Today TraceRedactor.redact is a pass-through stub so nothing leaks; real redaction lands in the security phase and must apply inside debugLog per R-10 (01-11 context explicit deferral) |

**Closed by 01-10/01-11 (no longer active):** WR-01 (ambient debugLog — real imports + direct calls), WR-04 (verbatim adoption — sanitizeStored + workspaceId scope gate), WR-08 (empty ProviderRegistry catch — logs EVT_HANDLER), WR-09 (unguarded BackgroundRouter cast — isRuntimeEnvelopeShape + fail-envelope reply), and the stale REQUIREMENTS.md traceability rows (now Done).

### Human Verification Required

1. **Real-browser MV3 load gate** — run `pnpm verify:e2e-phase-1` on a host with Chrome system libs: sidepanel.html and standalone.html must mount console-error-free. The CfT binary is present in `.cache/chrome-for-testing` but fails with `libnspr4.so: cannot open shared object file` on this host (reconfirmed 2026-08-08).
2. **Action-button → side panel gesture** — click the extension action button in a real Chrome session; LifecycleManager's `setPanelBehavior({openPanelOnActionClick:true})` must open the side panel.
3. **Standalone tab dedupe in real browser** — run 'Open Standalone' twice; only one tab, second run focuses it.
4. **Cross-window PING/PONG election + LWW adoption** (wiring now live via 01-10) — two live contexts exchange heartbeats; higher-version workspace wins; foreign-workspace snapshots rejected (01-11 scope gate).
5. **Theme propagation across two live surfaces** — toggle display mode in standalone Options; side panel updates without reload.
6. **Real keyboard focus flow** — mod+k opens the palette in both surfaces; FocusTrap traps and restores focus.

### Gaps Summary

The two FAILED truths from the prior verification are **CLOSED** in shipped source:

1. **Workspace state sharing (gaps[0]) — closed by 01-10 (WR-03):** `useWorkspaceStore.getState().init()` → `start('<surface>')` → module-scope `WorkspaceSync.start()` now run at both entrypoint mounts (exactly 1 production call site per file, grep-verified). np_workspace hydrates; the D-18 active fields round-trip; the BroadcastBus heartbeat / WORKSPACE_UPDATED LWW / WORKSPACE_HANDOFF / mirroring loop is live in the shipped extension. Mount-level behavioral tests (tests/entrypoints/sidepanel.test.tsx:64-73, standalone.test.tsx:41-48) assert isReady===true, activeSurface==='sidepanel'|'standalone', version>=1. 01-11 (WR-04) hardened the now-reachable inbound path: malformed and foreign-workspace snapshots are ignored (sanitizeStored + workspaceId scope gate), with negative tests green.

2. **Onboarding persistence (gaps[1]) — closed by 01-10 (WR-02):** `useAddonSettingsStore.getState().init()` runs at both entrypoint mounts (sidepanel/main.tsx:96, standalone/main.tsx:91). 'Configure later' (D-06) writes `onboarding.done` to np_addon_settings and a fresh module load now hydrates it back: the round-trip behavioral test (sidepanel.test.tsx:75-94) seeds storage → vi.resetModules → fresh import → `settings.onboarding?.done === true` AND the shell renders in place of the OnboardingModal.

The full phase gate is green (`pnpm verify:phase-1` exit 0; eslint → prettier → tsc → wxt build → 26 files/169 tests → content-bundle clean — rerun twice during this verification). All 10 requirement IDs are satisfied with the two formerly-blocked rows (WSPC-01, WSPC-02, plus the RUNTIME-02/RUNTIME-03 persistence caveats) now fully satisfied. Remaining findings are: (a) deferred warnings owned by later phases (WR-05 Options deep-link, WR-06 theme toast, WR-07 extra redaction — explicit deferrals recorded in 01-11 context), and (b) host-limited real-browser verification items (CfT binary unrunnable here — missing libnspr4.so), carried separately as behavior_unverified_items / human_verification. No code-level gaps remain.

---

_Verified: 2026-08-08T22:30:00Z_
_Verifier: the agent (gsd-verifier)_
