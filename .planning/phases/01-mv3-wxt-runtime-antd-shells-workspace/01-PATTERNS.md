# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace — Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 53 new files (35 src/config from spec §18 + RESEARCH reconciliation, 13 tests, 5 scaffold/config)
**Analogs found:** 22 / 53 with in-spec reference implementations (Appendices A/B/E/F/G/M + §5.1/§17/§20/§21.5); remaining files get pattern from spec rules + package conventions (no code analog exists in this greenfield repo)

> **Greenfield note:** The repo has NO source code (no `src/`, no `package.json`). The "closest analog" for every Phase 1 file is the spec's own canonical reference material — Appendices F, G, M, E, A, B, C, §5.1 entrypoint shapes, §17 UI rules, §20 state models — plus the locked stack's package conventions (WXT `defineBackground`/`defineContentScript`, AntD v6 `XProvider` mounting, zustand stores). The planner's implementation risk is **deviating from these canonical shapes**, not building new machinery (RESEARCH.md line 355).
>
> **Two locked resolution notes (planner must honor, not "fix"):**
> 1. **Theme storage area conflict:** spec Appendix F / §17.1a APPR-03 / Flow 19 say `chrome.storage.sync.np_theme`; **D-13 (user-locked) overrides to `chrome.storage.local`** as canonical source of truth (CONTEXT.md D-13; RESEARCH.md line 137: "D-13 overrides Appendix F's sync-adapter note"). Also Appendix F's `persist` middleware (localStorage) is **forbidden** for cross-surface state — use the storage adapter + `chrome.storage.onChanged` (RESEARCH Pattern 2, Pitfall 7).
> 2. **Entrypoint stem conflict:** §8.5 line 1320 shows `app/`; glossary/§5.1/§18/Appendix M all use **`standalone/`** → `standalone.html`. Use `standalone/` (RESEARCH Pitfall 3).

## File Classification

All files below are **create** (no modify). Roles and data flow per the GSD mapper taxonomy.

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `wxt.config.ts` | config | build | Spec **Appendix G** (line 5302) verbatim | exact (verbatim) |
| `package.json` (scaffold + modify) | config | build | Spec §24 verify scripts (line 3561) + D-01/D-03/D-04 | exact |
| `vitest.config.ts` | config | build | RESEARCH Pattern 4 (line 319): `WxtVitest()` + jsdom | exact |
| `tests/setup.ts` | config | build | RESEARCH Pitfall 6/A5 (line 342): matchMedia polyfill + fakeBrowser reset | exact |
| `src/entrypoints/background.ts` | entrypoint | event-driven | Spec §5.1 canonical shape (line 858) + Appendix E BackgroundRouter (line 5052) | exact |
| `src/entrypoints/sidepanel/index.html` | static | — | WXT scaffold `sidepanel.html` entrypoint convention | role-match |
| `src/entrypoints/sidepanel/main.tsx` | component (mount) | request-response | Appendix F.3 mounting pattern (line 5233) | exact (verbatim) |
| `src/entrypoints/standalone/index.html` | static | — | WXT scaffold `standalone.html` entrypoint convention | role-match |
| `src/entrypoints/standalone/main.tsx` | component (mount) | request-response | Appendix F.3 mounting pattern (line 5255) | exact (verbatim) |
| `src/entrypoints/content/core.content.ts` | entrypoint | event-driven | Spec §5.1 canonical content-script shape (line 874) | exact |
| `src/core/runtime/RuntimeEnvelope.ts` | types | request-response | Appendix C (line 4141) + Appendix E (line 5046) | exact (verbatim) |
| `src/core/runtime/OperationId.ts` | utility | transform | RESEARCH code example (line 406): `crypto.randomUUID()` | exact |
| `src/core/runtime/BroadcastBus.ts` | service | pub-sub | Appendix M.3 usage (line 5834) — no impl given; pattern from §20.11 + chrome.runtime | partial |
| `src/core/runtime/PortReader.ts` | utility | streaming | Appendix E PortReader (line 5075) | exact (verbatim) |
| `src/core/runtime/workerState.ts` | service | request-response | §20.5 BackgroundWorkerState (line 3129) + workerState.ok/fail envelope (RESEARCH Pitfall 5) | role-match |
| `src/core/runtime/MessageType.ts` | types | request-response | Appendix E (line 5019) + **D-17 additions** PING/PONG/GET_CONTENT_CAPABILITIES/CONTENT_CAPABILITIES | exact + extension |
| `src/core/messaging/MessageBus.ts` | service | request-response | Appendix E BackgroundRouter pattern (line 5050) + §20.1 | role-match |
| `src/core/events/EventBus.ts` | service | event-driven | §13 rule (line 1802): sync handlers, never let errors escape | no impl given |
| `src/core/log/debugLog.ts` | utility | transform | Golden rule 9 (line 205) + §0.3 (line 146) + Appendix C.2 code set | exact (contract) |
| `src/core/i18n/strings.ts` | constants | transform | Appendix B (line 4029) verbatim | exact (verbatim) |
| `src/core/prompts/index.ts` | constants | transform | Appendix A (line 3962) verbatim | exact (verbatim) |
| `src/core/registry/Registry.ts` | registry | CRUD | No analog — pattern from Appendix C page-registration types (line 4364) | no analog |
| `src/core/registry/AddonRegistry.ts` | registry | CRUD | No analog — pattern: registry + registration entry (WSPC-04 registers zero add-ons) | no analog |
| `src/core/registry/AddonSettingsStore.ts` | store | CRUD | No analog — pattern from WorkspaceStore zustand shape (Appendix M.1) | partial |
| `src/core/registry/SidePanelPageRegistry.ts` | registry | CRUD | Appendix C type (line 4364) + §17.1 usage | exact (type) |
| `src/core/registry/StandalonePageRegistry.ts` | registry | CRUD | Appendix C type (line 4374) + §17.2 Sider usage | exact (type) |
| `src/core/input/KeymapRegistry.ts` | registry | event-driven | Appendix C type (line 4353) + Flow 8 (line 1698) | exact (type) |
| `src/core/theme/ThemeStore.ts` | store | CRUD | Appendix F.1 (line 5107) **minus persist middleware**, plus D-13 storage adapter + onChanged | exact (adapted) |
| `src/core/theme/antdConfig.ts` | utility | transform | Appendix F.2 (line 5150) verbatim | exact (verbatim) |
| `src/core/workspace/WorkspaceStore.ts` | store | CRUD | Appendix M.1 (line 5731) + D-18 full field set + §21.5 type | exact (verbatim + D-18) |
| `src/core/workspace/WorkspaceRouter.ts` | service | request-response | Appendix M.2 (line 5789) + RESEARCH Pattern 3 (gesture-safe focusSidePanel) | exact (adapted) |
| `src/core/workspace/WorkspaceSync.ts` | service | event-driven | Appendix M.3 (line 5824) verbatim | exact (verbatim) |
| `src/core/content/ContentScriptHost.ts` | service | event-driven | RESEARCH example (line 421): PING→PONG reply | exact |
| `src/core/content/PageContextBridge.ts` | service | event-driven | RESEARCH reconciliation #3 (line 267); no Phase 1 behavior beyond capabilities plumbing | partial |
| `src/core/components/ErrorBoundary.tsx` | component | request-response | §17.4 (line 2209): AntD `Result` status 500 + Reload | exact (rule) |
| `src/core/components/PortableMarkdown.tsx` | component | transform | §17.4 (line 2214) + §12 (line 2008): passthrough skeleton, x-markdown target Phase 7 | partial |
| `src/types/workspace.ts` | types | — | §21.5 (line 3339) + Appendix C (line 4387) — canonical home per M.1 import | exact (verbatim) |
| `src/types/harness.ts` | types | — | §C.1 home rule (line 4678) — Phase 1 ships minimal subset (CompletionEvidence) | role-match |
| `src/components/sidepanel/SidePanelShell.tsx` | component | request-response | §17.1 three-zone layout (line 2074) + §17.1b | exact (rule) |
| `src/components/sidepanel/SidePanelRouter.tsx` | component | request-response | §17.1 + SidePanelPageRegistry drive | partial |
| `src/components/standalone/StandaloneShell.tsx` | component | request-response | §17.2 AntD Layout + Sider (line 2113) | exact (rule) |
| `src/components/standalone/StandaloneRouter.tsx` | component | request-response | §17.2 + StandalonePageRegistry drive | partial |
| `src/components/OnboardingModal.tsx` | component | request-response | Flow 9 (line 1702) + D-06…D-09 + UI-SPEC persona card | partial |
| `src/components/pages/ChatPage.tsx` | component | request-response | §12 state matrix (line 1769) + UI-SPEC empty states | partial |
| `src/components/pages/AgentPage.tsx` | component | request-response | §12 (line 1772) + UI-SPEC "Agent runs land here." | partial |
| `src/components/pages/NotesPage.tsx` | component | request-response | §12 (line 1775) + UI-SPEC "Notes live here…" (skeleton only) | partial |
| `src/components/pages/OptionsPage.tsx` | component | request-response | §17.1a Appearance (display mode only per D-14) + UI-SPEC | partial |
| `tests/core/runtime/RuntimeEnvelope.test.ts` | test | transform | §0.3 Zod fixture rule (line 200) + RESEARCH RUNTIME-01 | exact |
| `tests/core/runtime/OperationId.test.ts` | test | transform | §0.3 fixture rule + RESEARCH RUNTIME-01 | exact |
| `tests/core/runtime/{MessageBus,workerState}.test.ts` | test | request-response | RESEARCH validation map (line 556) | exact |
| `tests/core/events/EventBus.test.ts` | test | event-driven | RESEARCH RUNTIME-03 (line 556) + fakeBrowser runtime events | exact |
| `tests/core/workspace/{WorkspaceStore,WorkspaceRouter,WorkspaceSync}.test.ts` | test | CRUD | RESEARCH WSPC-01/02/03 (line 559) + fakeBrowser | exact |
| `tests/core/theme/ThemeStore.test.ts` | test | CRUD | RESEARCH WSPC-05 (line 563) + matchMedia mock | exact |
| `tests/core/content/ContentScriptHost.test.ts` | test | event-driven | RESEARCH RUNTIME-05 (line 558) | exact |
| `tests/isolation/no-content-script-ui.test.ts` + `check-content-bundle.mjs` | test | build+grep | §24 (line 3594) + Appendix G rule (line 5358) | exact |

## Pattern Assignments

### A. Build & tooling (config)

#### `wxt.config.ts` (config, build)

**Analog:** Spec Appendix G — copy **verbatim** (lines 5304–5352). Do not modernize to wxt 0.21 surface (RESEARCH Pitfall 2: `pnpm dlx wxt@0.19.29 init`, pin `"wxt": "^0.19.29"`).

```ts
// wxt.config.ts — Source: PRODUCT_SPEC Appendix G (lines 5304-5351), MUST keep verbatim
import { defineConfig } from 'wxt';
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'NowPilot',
    permissions: ['sidePanel','storage','cookies','alarms','tabs','scripting','contextMenus','notifications'],
    optional_permissions: ['webNavigation'],
    host_permissions: ['*://*.service-now.com/*', '*://support.servicenow.com/*'],
    optional_host_permissions: ['*://*/*'],
    side_panel: { default_path: 'sidepanel.html' },
    action:     { default_title: 'Open NowPilot' },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src *",
    },
    web_accessible_resources: [{ resources: ['assets/*'], matches: ['<all_urls>'] }],
  },
  vite: () => ({ build: { target: 'chrome120', sourcemap: 'inline', rollupOptions: { output: {
    manualChunks(id) {
      if (id.includes('node_modules/antd')) return 'antd';
      if (id.includes('node_modules/@ant-design/x-markdown')) return 'antd-x-markdown';
      if (id.includes('node_modules/@ant-design/x')) return 'antd-x';
      if (id.includes('node_modules/@ant-design')) return 'ant-icons';
      if (id.includes('node_modules/defuddle')) return 'defuddle';
      if (id.includes('node_modules/yaml')) return 'yaml';
      if (id.includes('node_modules/react')) return 'react';
    },
  }}}}),
});
```
**Rules (line 5354-5358):** content bundle MUST NOT include antd/@ant-design/x/@ant-design/x-markdown/react/react-dom/defuddle/yaml — enforced by the isolation test. No `@tailwindcss/vite`.

#### `package.json`, `vitest.config.ts`, `tests/setup.ts` (config, build)

**Analog:** §24 (line 3561) + RESEARCH Pattern 4.

```json
// package.json scripts — Source: §24 (line 3568) + D-02/D-04 + RESEARCH line 570
"verify:phase-1": "eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme && node tests/isolation/check-content-bundle.mjs"
```
```ts
// vitest.config.ts — Source: RESEARCH Pattern 4 (lines 319-333) / wxt.dev unit-testing guide
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
export default defineConfig({
  plugins: [WxtVitest()],
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'] },
});
```
`tests/setup.ts`: polyfill `window.matchMedia` (jsdom lacks it — RESEARCH Pitfall 6/A5) and reset `fakeBrowser` per test:
```ts
// tests/setup.ts — Source: RESEARCH A5 + Pattern 4
import { beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
beforeEach(() => fakeBrowser.reset());
```

### B. Entrypoints (event-driven / request-response)

#### `src/entrypoints/background.ts` (entrypoint, event-driven)

**Analog:** §5.1 canonical shape (line 858) + Appendix E BackgroundRouter (line 5052). **Synchronous listener registration** is a DONE-when gate (§18 line 2465).

```ts
// src/entrypoints/background.ts — Source: §5.1 (lines 860-872) + §5.2 (lines 904-911)
export default defineBackground({
  type: 'module',
  persistent: false,
  main() {
    BackgroundRouter.register();      // chrome.runtime.onMessage listener, synchronous
    LifecycleManager.register();      // onInstalled + onStartup: sidePanel.setPanelBehavior({openPanelOnActionClick:true}) (§5.3 line 915)
    KeepAliveManager.register();
    ContextMenuHost.recreateAll();
  },
});
```
**BackgroundRouter core** (Appendix E, lines 5052-5063) — sender validation + MessageType whitelist + async dispatch:
```ts
export const BackgroundRouter = {
  register() {
    chrome.runtime.onMessage.addListener((msg: RuntimeEnvelope<unknown>, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) return false;          // spoof guard (RESEARCH Security table)
      if (!MessageTypeValues.includes(msg.type)) return false;    // canonical enum whitelist
      dispatch(msg).then(resp => sendResponse(resp));
      return true; // async
    });
  },
};
```

#### `src/entrypoints/sidepanel/main.tsx` + `standalone/main.tsx` (mount, request-response)

**Analog:** Appendix F.3 — copy **verbatim** (lines 5233–5275), changing only `compact` (sidepanel `true`, standalone `false`) and the shell import. **Exactly ONE provider** — never nest ConfigProvider inside XProvider (§5.5, RESEARCH anti-pattern line 336).

```tsx
// src/entrypoints/sidepanel/main.tsx — Source: Appendix F.3 (lines 5233-5253)
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';
function Root() {
  const { mode, pack } = useThemeStore(s => ({ mode: s.mode, pack: s.pack }));
  const cfg = getAntdConfig({ mode, pack, compact: true });
  return (
    <XProvider {...cfg}>
      <AntdApp>
        <SidePanelShell />
      </AntdApp>
    </XProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
```
Path alias: `@/` → `src/` (WXT + module-react default; used throughout Appendix M/F imports).

#### `src/entrypoints/content/core.content.ts` (entrypoint, event-driven)

**Analog:** §5.1 (lines 874–888) + D-16/D-17. ISOLATED world, extraction-only, minimum message subset only.

```ts
// src/entrypoints/content/core.content.ts — Source: §5.1 (lines 877-888) + D-16
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  async main(ctx) {
    // v0.1: extraction only. No UI rendering, no Shadow DOM.
    await ContentScriptHost.mountExtractionOnly(ctx);
  },
});
```
Imports for this file are **restricted** to `RuntimeEnvelope` + `OperationId` + `MessageType` + `debugLog` (dependency-free core) — RESEARCH Pitfall 4.

### C. Core runtime (types / messaging / events)

#### `src/core/runtime/RuntimeEnvelope.ts` + `MessageType.ts` (types)

**Analog:** Appendix C (lines 4141–4154) + Appendix E (lines 5019–5042) + **D-17** additions. The RESEARCH reconciliation #2 (line 266) is explicit: MessageType.ts = Appendix E values **+** the four D-17 values (PING/PONG/GET_CONTENT_CAPABILITIES/CONTENT_CAPABILITIES) — these extend the canonical enum, they are NOT a phase-local contract.

```ts
// src/core/runtime/RuntimeEnvelope.ts — Source: Appendix C (lines 4142-4153) + RESEARCH line 411
export interface RuntimeEnvelope<T = unknown> {
  id: string;                    // operationId
  type: MessageTypeValue;        // canonical MessageType
  createdAt: number;
  source: 'sidepanel' | 'background' | 'content' | 'addon' | 'standalone';
  target?: 'sidepanel' | 'background' | 'content' | 'addon' | 'standalone';
  payload: T;
}
export type ResponseEnvelope<T = unknown> =
  | { id: string; ok: true;  data: T }
  | { id: string; ok: false; error: { code: string; message: string; retryable: boolean } };
```
```ts
// src/core/runtime/MessageType.ts — Source: Appendix E (lines 5022-5041) + D-17 additions
export const MessageType = {
  PROXY_FETCH: 'PROXY_FETCH', EXTRACT_PAGE_CONTENT: 'EXTRACT_PAGE_CONTENT',
  OPEN_SIDE_PANEL: 'OPEN_SIDE_PANEL', OPEN_STANDALONE: 'OPEN_STANDALONE',
  SESSION_TOKEN_UPDATE: 'SESSION_TOKEN_UPDATE', BACKGROUND_STATE: 'BACKGROUND_STATE',
  KEEPALIVE_PING: 'KEEPALIVE_PING',
  PORT_STREAM_START: 'PORT_STREAM_START', PORT_STREAM_CHUNK: 'PORT_STREAM_CHUNK',
  PORT_STREAM_END: 'PORT_STREAM_END', PORT_STREAM_ABORT: 'PORT_STREAM_ABORT',
  ADDON_EVENT: 'ADDON_EVENT',
  WORKSPACE_HANDOFF: 'WORKSPACE_HANDOFF', WORKSPACE_UPDATED: 'WORKSPACE_UPDATED',
  WORKSPACE_HEARTBEAT: 'WORKSPACE_HEARTBEAT',
  // D-17 additions — content bridge minimum subset (RESEARCH reconciliation #2)
  PING: 'PING', PONG: 'PONG',
  GET_CONTENT_CAPABILITIES: 'GET_CONTENT_CAPABILITIES',
  CONTENT_CAPABILITIES: 'CONTENT_CAPABILITIES',
} as const;
export type MessageTypeValue = typeof MessageType[keyof typeof MessageType];
export const MessageTypeValues = Object.values(MessageType) as MessageTypeValue[];
```

#### `src/core/runtime/OperationId.ts` (utility)

**Analog:** RESEARCH (lines 406–409). Never hand-roll Date.now+rand — `crypto.randomUUID()` (secure context, RESEARCH "Don't Hand-Roll" line 352).

```ts
// src/core/runtime/OperationId.ts — Source: RESEARCH lines 406-409
export function createOperationId(): string { return crypto.randomUUID(); }
```

#### `src/core/runtime/PortReader.ts` (utility, streaming)

**Analog:** Appendix E (lines 5075–5100) — copy **verbatim** (async-iterable queue over chrome.runtime.Port; PORT_STREAM_START/CHUNK/END protocol, lines 5067–5073).

#### `src/core/runtime/workerState.ts` (service, request-response)

**Analog:** §20.5 BackgroundWorkerState type (lines 3131–3137) + workerState.ok/fail envelope helpers (RESEARCH Pitfall 5 line 386: "Every background and content handler returns ResponseEnvelope (via workerState.ok/workerState.fail)").

```ts
// src/core/runtime/workerState.ts — Source: §20.5 (lines 3131-3137) + RESEARCH Pitfall 5
export type BackgroundWorkerState =
  | { state: 'cold-starting'; startedAt: number }
  | { state: 'ready'; startedAt: number; alarmsReady: boolean; routerReady: boolean }
  | { state: 'degraded'; reason: 'ALARMS_MISSING' | 'ROUTER_ERROR' | 'SESSION_UNAVAILABLE'; message: string }
  | { state: 'shutting-down'; reason: 'IDLE' | 'RELOAD' | 'UNKNOWN' };
// plus ok()/fail() builders returning ResponseEnvelope (id, ok, data|error)
```

#### `src/core/runtime/BroadcastBus.ts` (service, pub-sub)

**Analog:** No in-spec implementation; usage contract is Appendix M.3 (lines 5834–5858: `on(MessageType, cb)` / `emit(MessageType, payload)`) and §20.11 (line 3201) / §13 (line 1805). Implementation over `chrome.runtime.sendMessage` + `chrome.storage.session` primary-election key `np_workspace_primary` (§13 line 1805, §21 table line 1954). Events in Phase 1: WORKSPACE_UPDATED, WORKSPACE_HEARTBEAT, WORKSPACE_HANDOFF. Every payload is wrapped in RuntimeEnvelope.

#### `src/core/messaging/MessageBus.ts` (service, request-response)

**Analog:** Appendix E BackgroundRouter shape (lines 5050–5063) + §20.1 rule: "All cross-context messages carry a RuntimeEnvelope<T> (Appendix C). All responses use ResponseEnvelope<T> (Appendix E)."

#### `src/core/events/EventBus.ts` (service, event-driven)

**Analog:** No impl; §13 rule (line 1802): **"EventBus handlers are synchronous. Handlers may spawn internal Promises but must never let errors escape."** Phase 1 events: `note:saved`-style in-panel events (line 1680) — Phase 1 registers only what shells need.

### D. Theme (Appendix F, adapted to D-13)

#### `src/core/theme/antdConfig.ts` (utility, transform)

**Analog:** Appendix F.2 (lines 5150–5228) — copy **verbatim** (this is the canonical token wiring). UI-SPEC color/typography contract (lines 92–134) is served by these tokens — no hex in components.

```ts
// src/core/theme/antdConfig.ts — Source: Appendix F.2 (lines 5153-5228), verbatim
export function getAntdConfig(opts: AntdConfigOptions): ConfigProviderProps {
  const isDark = opts.mode === 'dark'
    || (opts.mode === 'auto' && typeof window !== 'undefined'
        && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const algorithm = [ isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    ...(opts.compact ? [theme.compactAlgorithm] : []) ];       // compact only on side panel
  const packToken = PACK_TOKEN_OVERLAY[opts.pack] ?? {};
  return { locale: enUS, theme: { algorithm, token: {
    colorPrimary: '#3B82F6', colorInfo: '#3B82F6', colorSuccess: '#10B981',
    colorWarning: '#F59E0B', colorError: '#EF4444', borderRadius: 8,
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
    fontSize: opts.compact ? 13 : 14, controlHeight: opts.compact ? 30 : 32,
    ...packToken }, components: { Layout: {/* headerBg/siderBg/headerHeight */}, Menu: {},
      Button: {}, Input: {}, Card: {}, Table: {}, Modal: {}, Notification: {} } } };
}
```
`PACK_TOKEN_OVERLAY` (lines 5164–5168): `default: {}`, `liquid-glass: { colorBgContainer: 'rgba(255,255,255,0.68)' }`, `claude-warm: { colorBgBase: '#FAF7F2' }` — non-default packs registered but not-ready (D-12).

#### `src/core/theme/ThemeStore.ts` (store, CRUD) — **ADAPTED, not verbatim**

**Analog:** Appendix F.1 (lines 5107–5147) with **two locked changes**:
1. **Drop the `persist` middleware** (Appendix F line 5111/5131) — zustand persist writes localStorage which does NOT cross surfaces (RESEARCH Pitfall 7 line 395, D-13 line 137).
2. **Storage area = `chrome.storage.local`** (D-13), not sync; sync via `chrome.storage.onChanged` (RESEARCH Pattern 2, lines 290–302).

```ts
// src/core/theme/ThemeStore.ts — Source: Appendix F.1 (lines 5113-5127) + D-13 + RESEARCH Pattern 2
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ThemePack = 'default' | 'liquid-glass' | 'claude-warm';
export const useThemeStore = create<ThemeState>()((set, get) => ({
  mode: 'auto', pack: 'default',
  effectiveDark: resolveDark('auto'),                    // resolveDark from F.1 lines 5123-5128
  setMode: (mode) => set({ mode, effectiveDark: resolveDark(mode) }),
  setPack: (pack) => set({ pack }),
  recomputeAuto: () => { if (get().mode === 'auto') set({ effectiveDark: resolveDark('auto') }); },
}));
// Persistence adapter (NOT persist middleware): write np_theme / np_theme_pack to chrome.storage.local
// Sync listener in every context — D-13 canonical (RESEARCH lines 297-301):
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.np_theme)     useThemeStore.setState({ mode: changes.np_theme.newValue as ThemeMode });
  if (changes.np_theme_pack) useThemeStore.setState({ pack: changes.np_theme_pack.newValue as ThemePack });
});
// matchMedia guarded with typeof window !== 'undefined'; recomputeAuto on prefers-color-scheme change (F.1 lines 5144-5147)
```
Storage keys: `np_theme` ('light'|'dark'|'auto'), `np_theme_pack` ('default'|'liquid-glass'|'claude-warm') — §21 table lines 1956–1957.

### E. Workspace (Appendix M, verbatim + D-18)

#### `src/types/workspace.ts` (types)

**Analog:** §21.5 (lines 3341–3366) + Appendix C (lines 4387–4414). **Canonical home `@/types/workspace`** (Appendix M.1 line 5737 imports from it). Phase 1 type declares the **full field set**; only workspaceId/conversationId/activeSurface/openedStandaloneTabId are active (D-18).

```ts
// src/types/workspace.ts — Source: §21.5 (lines 3341-3366); import ProviderId/PageContext/TabContext per Appendix C
export type ActiveSurface = 'sidepanel' | 'standalone';
export interface WorkspaceState {
  workspaceId: string; conversationId: string;
  activeProvider?: ProviderId; selectedModel?: string;
  pinnedTabs: TabContext[]; currentPageContext?: PageContext;
  selectedNotes: string[];
  activeAddonContext?: { addonId: string; contextKey: string; payload: unknown };
  activeSkillRun?: { skillId: string; operationId: string; startedAt: number;
    status: 'running' | 'completed' | 'failed' | 'aborted' };
  activeSurface: ActiveSurface; openedStandaloneTabId?: number;
  version: number; updatedAt: number;
}
```

#### `src/core/workspace/WorkspaceStore.ts` (store, CRUD)

**Analog:** Appendix M.1 (lines 5731–5786) — copy **verbatim** (subscribeWithSelector + chrome.storage.local `np_workspace` + version-bumped setState + auto-persist). Rules (M lines 5873–5880): all mutations via `setState`; `persist()` auto-called; hydrateFromURL() before rendering routes on standalone mount.

```ts
// src/core/workspace/WorkspaceStore.ts — Source: Appendix M.1 (lines 5734-5786), verbatim
export const useWorkspaceStore = create<WorkspaceStoreShape>()(
  subscribeWithSelector((set, get) => ({
    state: defaultState(),
    setState: (patch) => {
      const next = { ...get().state, ...patch, version: get().state.version + 1, updatedAt: Date.now() };
      set({ state: next });
      void get().persist();                                  // auto-persist every mutation
    },
    reset: () => set({ state: defaultState() }),
    hydrateFromStorage: async () => {
      const v = await chrome.storage.local.get('np_workspace');
      if (v.np_workspace) set({ state: v.np_workspace as WorkspaceState });
    },
    hydrateFromURL: async () => { /* parse workspaceId/conversationId/page from window.location.search (lines 5770-5781) */ },
    persist: async () => { await chrome.storage.local.set({ np_workspace: get().state }); },
  })),
);
```
`defaultState()` (lines 5746–5756): `workspaceId: crypto.randomUUID(), conversationId: crypto.randomUUID(), pinnedTabs: [], selectedNotes: [], activeSurface: 'sidepanel', version: 0, updatedAt: Date.now()`.

#### `src/core/workspace/WorkspaceRouter.ts` (service, request-response)

**Analog:** Appendix M.2 (lines 5789–5821) + RESEARCH Pattern 3 (crbug 1478648, lines 304–317). **Adaptation:** `focusSidePanel` uses **callback-style** `chrome.tabs.query` — no `await` before `chrome.sidePanel.open` (user-gesture flag). Handoff URL: `chrome-extension://<id>/standalone.html?workspaceId=..&conversationId=..&page=..` (§8.4 line 1307).

```ts
// src/core/workspace/WorkspaceRouter.ts — Source: Appendix M.2 (lines 5792-5821) + RESEARCH Pattern 3
export const WorkspaceRouter = {
  async openStandalone(opts?: { page?: string }): Promise<void> {
    const store = useWorkspaceStore.getState();
    await store.persist();
    const url = new URL(chrome.runtime.getURL('standalone.html'));
    url.searchParams.set('workspaceId', store.state.workspaceId);
    url.searchParams.set('conversationId', store.state.conversationId);
    if (opts?.page) url.searchParams.set('page', opts.page);
    const existing = await chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html') + '*' });
    // update-or-create with dedupe (§18 DONE-when line 2463); set openedStandaloneTabId (lines 5803-5812)
  },
  async focusSidePanel(): Promise<void> {
    // CALLBACK STYLE — no await before sidePanel.open (crbug 1478648, RESEARCH lines 311-316)
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id !== undefined) void chrome.sidePanel.open({ tabId: tab.id });
    });
  },
};
```

#### `src/core/workspace/WorkspaceSync.ts` (service, event-driven)

**Analog:** Appendix M.3 (lines 5824–5858) — copy **verbatim**: WORKSPACE_UPDATED last-write-wins by version; WORKSPACE_HEARTBEAT every 3 s; subscribe-on-change → BroadcastBus emit. Primary-writer election via `np_workspace_primary` in `chrome.storage.session` (§13 line 1805) — election itself is per §20.11 (standalone has tie-break priority, line 3212).

### F. Registries & input

#### `src/core/registry/{SidePanelPageRegistry,StandalonePageRegistry}.ts` (registry, CRUD)

**Analog:** Appendix C types (lines 4364–4384) — registration entries drive the shells:

```ts
// src/core/registry/SidePanelPageRegistry.ts — Source: Appendix C (lines 4365-4373)
export interface SidePanelPageRegistration {
  id: string; label: string; icon: string; urlPatterns?: string[];
  component: React.ComponentType; order: number;
}
// StandalonePageRegistration (lines 4375-4384) adds: routePath: string; showInSider?: boolean; addonId?: string
```
Phase 1 registers: side panel = Chat + Agent; standalone = Chat + Agent + Notes + Options (§8.3 line 1276, WSPC-04). AddonRegistry/Registry/AddonSettingsStore ship with **zero add-ons registered** (WSPC-04 line 74).

#### `src/core/input/KeymapRegistry.ts` (registry, event-driven)

**Analog:** Appendix C type (lines 4353–4361) + Flow 8 (line 1698: "KeymapRegistry global keydown listener → handler → preventDefault"). Defaults per CONTEXT discretion: macOS `mod+k`, Win/Linux `ctrl+k`. Phase 1 commands only (D-15): Open Standalone view, Focus Side Panel, Open Options.

```ts
// src/core/input/KeymapRegistry.ts — Source: Appendix C (lines 4354-4362)
export interface KeymapRegistration {
  id: string;
  when?: 'always' | 'in-composer' | 'in-note' | 'in-side-panel' | 'in-standalone';
  combo: string; description: string; handlerId: string;
}
```

### G. Logging, i18n, prompts

#### `src/core/log/debugLog.ts` (utility)

**Analog:** Golden rule 9 (line 205): every catch calls `debugLog(code, message, context)` with a canonical §C.2 code; no empty catches; no new error strings. Code set is Appendix C.2 (lines 4920–4960); Phase 1 uses the runtime group (e.g. `STRUCTURED_OUTPUT_FAILED`, `STREAM_FAILED`) and must be extended with any Phase-1-specific codes (e.g. workspace handoff / theme persistence) as additions, per RESEARCH open question — never invent free-form strings.

#### `src/core/i18n/strings.ts` (constants) — Appendix B verbatim (lines 4031–4135); seed canonical strings (STR.chat/onboarding/standalone/workspace/options/rich). No full i18n framework in Phase 1 (CONTEXT discretion). `src/core/prompts/index.ts` — Appendix A verbatim (lines 3964–4025).

### H. Shared components (core)

#### `src/core/components/ErrorBoundary.tsx` (component)

**Analog:** §17.4 (line 2209): every page wrapped in `<ErrorBoundary>` → renders AntD `Result` status="500" + `[Reload]` button. Class component with `componentDidCatch` → `debugLog(code, ...)` (golden rule 9).

#### `src/core/components/PortableMarkdown.tsx` (component)

**Analog:** §17.4 (line 2214) + §12 (line 2008): all AI text through `<PortableMarkdown>` — **never dangerouslySetInnerHTML** (DONE-when grep, §18 line 2469). Phase 1 = passthrough skeleton (real renderer is @ant-design/x-markdown in Phase 7). Uses DOMPurify discipline (approved stack) when rendering.

### I. Shells, onboarding, page skeletons (components)

All shells/page components: **no innerHTML, no hard-coded hex** — colors via tokens (UI-SPEC Color section), copy via `STR` (Appendix B), icons from `@ant-design/icons`, imperative APIs via `App.useApp()` (F.4 lines 5277–5292 — never static `message.error`).

#### `src/components/sidepanel/SidePanelShell.tsx` (component)

**Analog:** §17.1 (lines 2074–2096): three stacked zones — header (~52 px: "N" mark + wordmark left; Options `SettingOutlined` + Switch to Full chat `ExpandAltOutlined` right) → conversation area (persona card first-run / Skeleton) → composer block (toolbar → input → status bar). Compact algorithm. Every icon-only control: `aria-label` + tooltip (UI-SPEC inventory, lines 192–205).

#### `src/components/standalone/StandaloneShell.tsx` (component)

**Analog:** §17.2 (lines 2113–2143): AntD `Layout` — Sider (240 px, collapsible, 4 items, active item = `colorPrimaryBg` pill + `colorPrimary`) + Content Area (Chat/Agent/Notes/Options via StandalonePageRegistry) + footer (⌘K hint, settings gear, avatar). Default density (no compact). Min viewport 1024 px → AntD Alert (STR.standalone.minWidth).

#### `src/components/OnboardingModal.tsx` (component)

**Analog:** Flow 9 (line 1702) + D-06…D-09 + UI-SPEC persona card (lines 172–175). Phase 1 = Step 1 persona card + Configure later gate. Gate: `useWorkspaceStore(s => s.state.activeProvider)` — no provider ⇒ persona card + disabled surface (D-07). CTA "Configure provider" → `WorkspaceRouter.openStandalone({ page: 'options' })` (D-09). Persona fields from `np_persona` defaults (PreferenceMemoryStore — read-only, D-08). Heading "Meet your co-pilot" (UI-SPEC line 144, Flow 9 RICH-R-03). Handoff failure → AntD `notification` + `debugLog` canonical code (UI-SPEC line 246).

#### `src/components/pages/*.tsx` (skeletons)

**Analog:** §12 state matrix (lines 1769–1778) + UI-SPEC Copywriting (lines 139–158) + AntD `Skeleton` blocks (UI-SPEC line 210). Empty-state copy per UI-SPEC table; error paths emit `debugLog` with §C.2 codes.

### J. Content bridge (D-16/D-17 additions)

#### `src/core/content/ContentScriptHost.ts` + `PageContextBridge.ts` (service, event-driven)

**Analog:** RESEARCH (lines 403–427) + §5.1 content entrypoint. Minimum message subset only; envelope replies:

```ts
// content script reply — Source: RESEARCH lines 421-426 (PING→PONG; D-17)
chrome.runtime.onMessage.addListener((msg: RuntimeEnvelope, _sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ ...msg, kind: 'response', type: 'PONG', payload: { ok: true } });
  }
});
```
`ContentScriptHost.mountExtractionOnly(ctx)` — no DOM extraction, no SPANavigationWatcher, no annotations in Phase 1 (D-16). GET_CONTENT_CAPABILITIES → CONTENT_CAPABILITIES replies with capability flags. Imports limited to dependency-free core modules (RESEARCH Pitfall 4).

### K. Tests

**Analog:** §0.3 Zod fixture rule (line 200) — one Zod fixture test per public boundary; WxtVitest + fakeBrowser for chrome API touching tests (RESEARCH Pattern 4). Required §18 tests (lines 2451–2457): `tests/core/runtime/{RuntimeEnvelope,OperationId}.test.ts`, `tests/core/events/EventBus.test.ts`, `tests/core/workspace/{WorkspaceStore,WorkspaceRouter}.test.ts`, `tests/core/theme/ThemeStore.test.ts`. RESEARCH adds MessageBus/workerState/ContentScriptHost/WorkspaceSync/registry/components tests (lines 554–565). Isolation test greps built bundle for antd/React/react-dom/defuddle/yaml (line 5358 + §24 line 3594) — requires `wxt build` before verify (RESEARCH Open Question 1 → included in verify:phase-1 script).

## Shared Patterns

### 1. Message Contract (apply to: all runtime/messaging/content files)
**Source:** Appendix C (line 4141) + Appendix E (line 5046) + D-17
Every cross-context message = `RuntimeEnvelope<T>`; every response = `ResponseEnvelope<T>` (workerState.ok/fail). `MessageType` enum is the only allowed type vocabulary — **no throwaway contracts** (D-17, RESEARCH Pitfall 5). Background/content handlers validate `sender.id === chrome.runtime.id` + `MessageTypeValues.includes(msg.type)`.

### 2. Error Handling + debugLog (apply to: every file with a catch/async path)
**Source:** Golden rule 9 (line 205) + Appendix C.2 (lines 4920–4960)
```ts
try { ... } catch (err) {
  debugLog('STRUCTURED_OUTPUT_FAILED', 'phase-1 reason', { id, err: err?.message });  // canonical §C.2 code
}
```
No empty catches, no new error strings. UI surfaces error copy from UI-SPEC table; imperative errors via `App.useApp()` `notification.error` (F.4) with `duration: 0` for persist-until-dismissed (§17.4 line 2213).

### 3. One-Provider Mounting (apply to: both main.tsx entrypoints)
**Source:** Appendix F.3 + §5.5
Exactly one `XProvider` per surface wrapping `AntdApp`; `getAntdConfig({ mode, pack, compact })` spread into it. Never nest ConfigProvider inside XProvider. All imperative APIs through `App.useApp()`.

### 4. Cross-Surface State Sync (apply to: ThemeStore, WorkspaceStore, WorkspaceSync)
**Source:** D-13 + Appendix M.1 + RESEARCH Pattern 2/Pitfall 7
Plain zustand stores (no persist middleware); canonical source = `chrome.storage.local` keys `np_theme`, `np_theme_pack`, `np_workspace`; `chrome.storage.onChanged` listener in every context hydrates stores; live cross-surface channel = BroadcastBus (WORKSPACE_UPDATED version-LWW, WORKSPACE_HEARTBEAT 3 s).

### 5. Bundle Isolation (apply to: content entrypoint + build config)
**Source:** Appendix G (line 5354) + §24 (line 3594)
Content bundle imports only dependency-free core (`RuntimeEnvelope`, `OperationId`, `MessageType`, `debugLog`); manualChunks keeps antd/x/react/defuddle/yaml out; isolation grep test gates the phase.

### 6. Storage Keys (apply to: ThemeStore, WorkspaceStore, WorkspaceSync, LifecycleManager)
**Source:** §21 table (lines 1945–1957) + §13 (line 1805)
`np_workspace` (storage.local) · `np_workspace_primary` (storage.session, `{ tabId, surface, electedAt }`) · `np_theme` / `np_theme_pack` (storage.local per D-13) · `np_persona` (storage.local). Never invent keys.

## No Analog Found

Files with no reference implementation in the spec (planner should use the spec rule + package convention cited):

| File | Role | Data Flow | Pattern Source (spec rule + stack convention) |
|------|------|-----------|----------------|
| `src/core/runtime/BroadcastBus.ts` | service | pub-sub | Appendix M.3 usage contract + §20.11 election + chrome.runtime messaging |
| `src/core/events/EventBus.ts` | service | event-driven | §13 line 1802 (sync handlers) + in-panel EventTarget-style |
| `src/core/messaging/MessageBus.ts` | service | request-response | Appendix E BackgroundRouter + §20.1 envelope rules |
| `src/core/registry/{Registry,AddonRegistry,AddonSettingsStore}.ts` | registry/store | CRUD | Appendix C page-registration shapes + WSPC-04 (zero add-ons) |
| `src/components/**` shells/pages/onboarding | component | request-response | §17.1/§17.2/§17.4 + Flow 9/10 + UI-SPEC + AntD v6 conventions |
| `src/core/components/ErrorBoundary.tsx` | component | request-response | §17.4 line 2209 (Result 500 + Reload) |
| `src/core/content/PageContextBridge.ts` | service | event-driven | D-16/D-17 (capabilities plumbing only, Phase 4a extraction) |
| `src/types/harness.ts` | types | — | §C.1 home rule (line 4678); Phase 1 minimal subset |
| `tests/setup.ts` / `vitest.config.ts` | config | build | wxt.dev unit-testing guide + RESEARCH Pattern 4 |

## Metadata

**Analog search scope:** `.planning/PRODUCT_SPEC_v0_1.md` (Appendices A/B/C/C.2/E/F/G/M/O, §0.5/§5.1/§5.3/§8.1/§8.3/§8.4/§8.5/§12/§13/§17/§20/§21/§24, Flows 8–19), `01-CONTEXT.md`, `01-RESEARCH.md`, `01-UI-SPEC.md`, `.planning/DESIGN_SYSTEM.md`, `.planning/REQUIREMENTS.md`; repo-wide glob for source analogs (none exist — greenfield).
**Files scanned:** 53 planned files classified; ~20 spec sections read; no src/ files exist to search.
**Pattern extraction date:** 2026-08-04
