# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace - Pattern Map

**Mapped:** 2026-09-21
**Files analyzed:** 41 (create / adapt / move / remove)
**Analogs found:** 37 / 41
**Source discipline:** every analog named below is git-**tracked** source (`git ls-files` verified this session). Generated trees `.wxt/**` and `.output/**` are **never** analog sources — they are build mirrors and the D-04 inventory must not cite them as pattern origins.

> **How the planner should use this file.** The target paths below are the RESEARCH.md § Recommended Project Structure paths, which are *provisional* until `01-MIGRATION-INVENTORY.md` is frozen (D-04). Each row names the analog the executor should open before writing the new file. Where a row says **move-only**, no behavioural pattern may be copied — the diff is paths and relative-import depth only (RESEARCH Pattern 1).

---

## File Classification

### A. Build / config / scripts (ADAPT)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `wxt.config.ts` | config | request-response | `wxt.config.ts` (self) | exact (self-adapt) |
| `tsconfig.json` | config | transform | `tsconfig.json` (self) | exact (self-adapt) |
| `vitest.config.ts` | config | transform | `vitest.config.ts` (self) | exact (self-adapt) |
| `package.json` (scripts + deps) | config | — | `package.json` (self) | exact (self-adapt) |
| `.gitignore` | config | — | `.gitignore` (self) | exact (self-adapt) |
| `scripts/verify-no-tailwind.sh` | utility | batch | `scripts/verify-no-tailwind.sh` (self) | exact (self-adapt) |

### B. Entrypoints (MOVE-only, then ADAPT)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/entrypoints/background.ts` | entrypoint / service-worker | event-driven | `entrypoints/background.ts` | exact (self-move) |
| `src/entrypoints/sidepanel/index.html` + `main.tsx` | entrypoint / provider root | request-response | `entrypoints/sidepanel/main.tsx` | exact (self-move) |
| `src/entrypoints/standalone/index.html` + `main.tsx` | entrypoint / provider root | request-response | `entrypoints/standalone/main.tsx` | exact (self-move) |
| `src/entrypoints/content/index.ts` (or `content.ts`) | entrypoint / content-script | event-driven | `entrypoints/content/core.content.ts` | exact (self-move + rename) |
| `index.html`, `src/main.tsx`, `vite.config.ts` | dev shell | — | (removal targets — no analog) | remove |
| `entrypoints/options/**` | dev shell surface | — | `entrypoints/options/main.tsx` | remove |

### C. Theme (ADAPT + NEW)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/core/theme/antdConfig.ts` **(NEW)** | utility / theme factory | transform | `src/theme/index.ts` + `src/theme/componentTokens.ts` | role-match |
| `src/core/theme/ThemeStore.ts` | store | CRUD | `src/core/theme/ThemeStore.ts` (self) | exact (self-adapt) |
| `src/core/theme/ThemeSync.ts` | service / sync | pub-sub | `src/core/theme/ThemeSync.ts` (self) | exact (self-adapt) |
| `src/core/theme/chromeStorageAdapter.ts` | adapter / storage | CRUD | `src/core/theme/chromeStorageAdapter.ts` (self) | exact (KEEP + extend) |
| `src/components/ThemeProvider.tsx` → per-surface `Root()` | provider | request-response | `entrypoints/sidepanel/main.tsx` § render root | replace |

### D. Workspace / handoff (ADAPT + NEW)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/core/workspace/WorkspaceState.ts` **(NEW)** | model / schema | transform | `src/core/workspace/WorkspaceStore.ts` § `WorkspaceStateData` | role-match |
| `src/core/workspace/handoff/protocol.ts` **(NEW)** | protocol / messaging | pub-sub | `src/core/workspace/WorkspaceSync.ts` + `src/core/runtime/RuntimeEnvelope.ts` | role-match |
| `src/core/workspace/handoff/useWorkspaceHandoff.ts` **(NEW)** | hook / controller | event-driven | `src/components/chat/SidepanelChat.tsx` § `onWorkspaceSync` effect | partial |
| `src/core/workspace/WorkspaceRouter.ts` | service / navigation | request-response | `src/core/workspace/WorkspaceRouter.ts` (self) | exact (self-adapt) |
| `src/core/workspace/WorkspaceStore.ts` | store | CRUD | `src/core/workspace/WorkspaceStore.ts` (self) | exact (self-adapt) |
| `src/core/workspace/WorkspaceSync.ts` | service / broadcast | pub-sub | (REPLACE — superseded by `handoff/protocol.ts`) | — |

### E. Commands / keymap / runtime registry (ADAPT)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/core/input/KeymapRegistry.ts` | registry / input | event-driven | `src/core/input/KeymapRegistry.ts` (self) | exact (self-adapt) |
| `src/core/commands/registerWorkspaceCommands.ts` | registry / commands | request-response | `src/core/commands/registerWorkspaceCommands.ts` (self) | exact (self-adapt) |
| `src/components/common/CommandPalette.tsx` | component / overlay | request-response | `src/components/common/CommandPalette.tsx` (self) | exact (self-adapt) |
| `src/core/runtime/RuntimeEnvelope.ts` | model / messaging | request-response | `src/core/runtime/RuntimeEnvelope.ts` (self) | exact (self-adapt) |
| `src/core/messaging/MessageBus.ts` | service / messaging | event-driven | `src/core/messaging/MessageBus.ts` (self) | exact (self-adapt) |
| `src/core/messaging/BackgroundRouter.ts` | service / messaging | event-driven | `src/core/messaging/BackgroundRouter.ts` (self) | exact (self-adapt) |

### F. Onboarding / credentials (NEW + REPLACE)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/services/ports/providerValidationPort.ts` **(NEW)** | port / types | request-response | `src/services/aiProvider.ts` § `ProviderConnectionResult` | role-match |
| `src/services/ports/credentialStorePort.ts` **(NEW)** | port / types | CRUD | `src/services/aiProvider.ts` § result union | role-match |
| `src/services/fixtures/providerValidationFixtures.ts` **(NEW)** | fixture adapter | transform | (none — first fixture module in repo) | no analog |
| `src/components/onboarding/OnboardingFlow.tsx` **(NEW)** | component / flow | request-response | `src/components/OnboardingModal.tsx` | exact-ish |
| `src/core/storage/legacyCredentialCleanup.ts` **(NEW)** | migration / utility | batch | `src/core/workspace/WorkspaceStore.ts` § `workspaceMigrate` + `chromeStorageAdapter.ts` | role-match |
| `src/store/useExtensionStore.ts` | store | CRUD | `src/store/useExtensionStore.ts` (self) | exact (self-adapt) |
| `src/types/index.ts` | model | transform | `src/types/index.ts` (self) | exact (self-adapt) |
| `src/services/aiProvider.ts` | service / network | streaming | (REPLACE / REMOVE — network + secret paths deleted) | — |

### G. Shells / marking / presentation (NEW + ADAPT)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/common/DeferredNotice.tsx` **(NEW)** | component / marker | transform | `src/components/common/MirrorBanner.tsx` | role-match |
| `src/components/sidepanel/SidePanelShell.tsx` **(NEW)** | component / shell | request-response | `src/components/standalone/StandaloneShell.tsx` | role-match |
| `src/components/sidepanel/SidePanelRouter.tsx` **(NEW)** | component / router | request-response | `src/components/standalone/StandaloneShell.tsx` § `activeMenu` switch | role-match |
| `src/components/standalone/StandaloneRouter.tsx` **(NEW)** | component / router | request-response | `src/components/standalone/StandaloneShell.tsx` § `activeMenu` switch | role-match |
| `src/components/pages/{ChatPage,AgentPage,NotesPage,OptionsPage}.tsx` | component / page shell | — | `src/components/pages/AgentPage.tsx` (self) | exact (self-adapt) |
| `src/components/common/MirrorBanner.tsx` | component | — | self | exact (KEEP as unmounted typed) |
| `src/components/common/ThemeToggle.tsx` | component | — | self | exact (KEEP as unmounted typed) |
| `src/core/components/ErrorBoundary.tsx` | component / boundary | — | self | exact (self-adapt) |
| `src/components/standalone/WorkspaceSidebar.tsx` | component / nav | — | self (+ UI-SPEC § Standalone) | self-adapt |

### H. Tests (ADAPT + NEW)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/setup.ts` | test infra | — | `tests/setup.ts` (self) | exact (self-extend) |
| `tests/isolation/cross-entrypoint-imports.test.ts` | test / gate | batch | self | exact (self-adapt) |
| `tests/core/strict/np-strict-ceiling.test.ts` | test / gate | batch | self | exact (self-adapt) |
| `tests/core/input/KeymapRegistry.test.ts` **(NEW)** | test | event-driven | `tests/background/background-router.test.ts` | role-match |
| `tests/core/theme/antdConfig.test.ts` **(NEW)** | test | transform | `tests/core/theme/ThemeStore.test.ts` | role-match |
| `tests/core/workspace/WorkspaceHandoff.test.ts` **(NEW)** | test | pub-sub | `tests/core/workspace/WorkspaceRouter.test.ts` | role-match |
| `tests/core/workspace/WorkspaceState.test.ts` **(NEW)** | test | transform | `tests/core/theme/ThemeStore.test.ts` § migrate block | role-match |
| `tests/core/storage/legacyCredentialCleanup.test.ts` **(NEW)** | test | batch | `tests/core/ai/testProviderConnection.test.ts` § sentinel idiom | partial |
| `tests/components/OnboardingFlow.test.tsx` **(NEW)** | test | request-response | `tests/components/MirrorBanner.test.tsx` + `tests/core/ai/testProviderConnection.test.ts` | role-match |
| `tests/components/CommandPalette.test.tsx` **(NEW)** | test | request-response | `tests/components/MirrorBanner.test.tsx` | role-match |
| `tests/components/DeferredNotice.test.tsx` **(NEW)** | test | transform | `tests/components/MirrorBanner.test.tsx` | exact-ish |
| `tests/isolation/generated-manifest.test.ts` **(NEW)** | test / build-inspection | file-I/O | `tests/isolation/cross-entrypoint-imports.test.ts` | role-match |

---

## Pattern Assignments

### A1. `wxt.config.ts` (config, request-response)

**Analog:** `wxt.config.ts` (self)

**Current shape** (lines 1-63) — the four deltas are: add `srcDir`, add `modules`, drop the options keys, reconcile CSP.

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  webExt: { disabled: true },                       // 4-6  KEEP
  dev: { server: { port: 3000, host: '0.0.0.0' } }, // 7-12 KEEP
  vite: () => ({ build: { chunkSizeWarningLimit: 1500, rollupOptions: { onwarn(...) {...} } } }),
  manifest: {
    name: 'NowPilot', description: '...', version: '0.1.0',
    permissions: ['sidePanel', 'storage', 'tabs'],  // 36  KEEP (A4 — do NOT adopt Appendix G's 8)
    host_permissions: ['*://*.service-now.com/*', '*://support.servicenow.com/*'], // 37-40 KEEP
    action: { default_title: 'Open NowPilot Assistant', default_icon: 'assets/icons/...' },
    icons: { 16: ..., 32: ..., 48: ..., 128: ... },
    side_panel: { default_path: 'sidepanel.html' },  // 51-53 KEEP
    options_ui: { page: 'options.html', open_in_tab: true },  // 54-57 REMOVE
    options_page: 'options.html',                              // 58    REMOVE
    content_security_policy: {                                  // 59-61 DECIDE (Open Q5)
      extension_pages: "script-src 'self'; object-src 'self'; connect-src http://localhost:* https://generativelanguage.googleapis.com https://api.anthropic.com https://api.openai.com",
    },
  },
});
```

**Required additions (RESEARCH Pattern 1 table):** `srcDir: 'src'`; `modules: ['@wxt-dev/module-react']`; `publicDir`/`modulesDir` only if `public/`/`modules/` move under `src/`. `options_ui`/`options_page` must go — `options_ui` silently forces `"open_in_tab": false` into the generated manifest (RESEARCH Summary).

**Anti-pattern (do not copy):** the comment block at lines 29-35 explains the permission rule; keep it and extend rather than rewriting.

---

### A2. `tsconfig.json` + `vitest.config.ts` (config, transform)

**Analog:** self.

**Current** (`tsconfig.json:22-25, 27-35`):
```jsonc
"paths": { "@/*": ["./*"], "~/*": ["./*"] },     // must become ["./src/*"]
"include": ["src/**/*", "entrypoints/**/*", "tests/**/*", "vite.config.ts", "vitest.config.ts", "wxt.config.ts", ".wxt/wxt.d.ts"]
// drop the root "entrypoints/**/*" entry; delete "vite.config.ts" when the dev shell is removed
```

**Current** (`vitest.config.ts:10-14`):
```ts
resolve: { alias: { '@': path.resolve(__dirname, '.') } },   // must become resolve(__dirname, 'src')
```

**Constraint:** `.wxt/tsconfig.json` maps `@/* → ../*` today and is **tracked in git**; do not hand-edit — regenerate with `wxt prepare` and `git rm -r --cached .wxt` + add `.wxt/` to `.gitignore` in the same commit (RESEARCH Runtime State Inventory).

---

### A3. `scripts/verify-no-tailwind.sh` (utility, batch) — **hard-break gate**

**Analog:** self.

**Current** (`scripts/verify-no-tailwind.sh:20, 23, 31-32, 35-36`): each grep targets `src/ entrypoints/`.

```bash
LEAK_COUNT=$(grep -rE 'className="[^"]*\b(flex |grid |...)' \
  --include="*.tsx" src/ entrypoints/ 2>&1 | wc -l | tr -d ' ')   # line 20
```

**Why it breaks:** after the move `entrypoints/` no longer exists; grep emits `No such file or directory` into stderr → `2>&1 | wc -l` counts it → `TOTAL ≥ 1` → gate fails. Change all four occurrences to `src/` only **in the same commit as the move** (RESEARCH Pitfall 6).

**Message line 40** (`echo "✓ verify-no-tailwind: 0 Tailwind className strings in src/ and entrypoints/"`) must be reworded or it lies.

---

### B1. `src/entrypoints/background.ts` (entrypoint / service-worker, event-driven)

**Analog:** `entrypoints/background.ts` (50 lines)

**Imports + registration shape** (lines 1-2, 4-7, 29-48):
```ts
import { defineBackground } from 'wxt/utils/define-background';
import * as BackgroundRouter from '../core/messaging/BackgroundRouter'; // becomes '../core/...' after move

export default defineBackground({
  type: 'module',
  persistent: false,
  main() {
    BackgroundRouter.register();                     // 29 — SYNCHRONOUS, top level
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {}); // 32-34
    chrome.runtime.onStartup.addListener(() => { ...setPanelBehavior... });             // 36-38
    chrome.runtime.onInstalled.addListener((details) => {                               // 41-48
      if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.storage.local.set({ onboardingComplete: false });   // ADAPT: typed OnboardingState record (Pitfall 7)
      } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
        chrome.storage.local.set({ onboardingComplete: true });
      }
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    });
  },
});
```

**Block comment 11-23 is the registration contract** — "exactly THREE things per D-13". Extend it with the D-07 legacy-credential cleanup call on install/startup rather than adding a fourth silent registration.

---

### B2. `src/entrypoints/sidepanel/main.tsx` + `standalone/main.tsx` (entrypoint / provider root)

**Analog:** `entrypoints/sidepanel/main.tsx` (126 lines) and `entrypoints/standalone/main.tsx` (91 lines)

**Imports (relative depth drops by one)** — `entrypoints/sidepanel/main.tsx:1-14`:
```tsx
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { SidepanelChat } from '../../src/components/chat/SidepanelChat';   // → '../../components/...'
import { CommandRegistry } from '../../src/core/commands/CommandRegistry'; // → '../../core/...'
import { ThemeProvider } from '../../src/components/ThemeProvider';
import { registerSidepanelCommands } from '../../src/core/commands/registerWorkspaceCommands';
import { applyThemeToSync } from '../../src/core/theme/ThemeSync';
import { debugLog } from '../../src/core/log/debugLog';
import '../../src/index.css';                                               // → '../../index.css'
```

**Command registration effect (KEEP shape, ADAPT content)** — `entrypoints/sidepanel/main.tsx:64-93`: `useEffect(() => { const cleanup = registerSidepanelCommands({...}); return cleanup; }, [])`. Deps are plain callbacks; theme toggle cycles `MODE_CYCLE` and calls `void applyThemeToSync(next, pack)` (local-first). Keep this deps shape; change the command set to D-09 and gate `reloadExtension` behind `import.meta.env.DEV`.

**Ad-hoc keydown to DELETE** — `entrypoints/sidepanel/main.tsx:95-104` and `entrypoints/standalone/main.tsx:63-72`:
```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPaletteOpen((prev) => !prev); }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```
Replace with a `KeymapRegistry.register({ id: 'open-command-palette', keys: 'Cmd+K', handler })` call in the same effect (RESEARCH Pattern 4).

**Gesture handler to ADAPT (SA-10 / Pitfall 4)** — `entrypoints/standalone/main.tsx:18-27`:
```tsx
const handleOpenSidepanel = async () => {
  try {
    const win = await chrome.windows.getCurrent();       // ← awaits BEFORE the gesture-gated call
    if (win?.id !== undefined) await chrome.sidePanel.open({ windowId: win.id });
  } catch { /* side panel may not be available */ }
};
```
Call `chrome.sidePanel.open({ tabId })` as early in the stack as possible — no awaited window lookup (RESEARCH Pitfall 4). Record the outcome as manual Chrome evidence.

**Render root to REPLACE (per-surface provider, §5.5)** — current both files nest `ThemeProvider` (which itself nests `ConfigProvider` inside `XProvider`, `src/components/ThemeProvider.tsx:38-44`). Target shape from RESEARCH Code Example 1:
```tsx
function Root() {
  const mode = useThemeStore((s) => s.mode);
  const pack = useThemeStore((s) => s.pack);
  const cfg = getAntdConfig({ mode, pack, compact: true });   // true = Side Panel, false = Standalone
  return (
    <XProvider {...cfg}>            {/* one provider per surface; ⊃ ConfigProvider */}
      <AntdApp>
        <ErrorBoundary>
          <SidePanelShell />
        </ErrorBoundary>
      </AntdApp>
    </XProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
```

---

### B3. `src/entrypoints/content/index.ts` (entrypoint / content-script, event-driven)

**Analog:** `entrypoints/content/core.content.ts`

**Shape** (`entrypoints/content/core.content.ts:1-12, 22-70`):
```ts
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createEnvelope } from '../../src/core/runtime/RuntimeEnvelope';   // → '../../core/...'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    // v0.1: extraction only — no UI rendering, no Shadow DOM.
    ...
    chrome.runtime.sendMessage(createEnvelope('CONTENT_SCRIPT_READY', { url: location.href }, 'content')).catch(() => {});
    return () => { observer.disconnect(); document.removeEventListener('wxt:locationchange', onLocationChange); };
  },
});
```

**Hard constraints to preserve verbatim:** the two comment rules at lines 10-16 ("Do NOT add a fetch(.) call in this file"). The isolation gate greps for `fetch(` and comment-strips — keep the comment as-is so the gate's own self-test stays meaningful.

**Discovery caveat (Pitfall 5):** `content/core.content.ts` matches **no** WXT glob; moving it to `src/entrypoints/content/core.content.ts` does not fix it. The plan must pick one of `src/entrypoints/content.ts` (`content.[jt]s?(x)`), `src/entrypoints/content/index.ts` (`content/index.[jt]s?(x)`, recommended), or explicit registration — and flip on the `content_scripts` assertion in `tests/isolation/generated-manifest.test.ts` in the same plan.

---

### C1. `src/core/theme/antdConfig.ts` (NEW — utility / theme factory, transform)

**Analogs:** `src/theme/index.ts` + `src/theme/componentTokens.ts` (token packs) and `src/core/theme/ThemeConfig.ts` (pack lookup)

**Token-pack shape to reuse** — `src/theme/index.ts:11-19`:
```ts
export function getLightTheme(_colorThemeId?: string): ThemeConfig { return claudePlusLight; }
export function getDarkTheme(_colorThemeId?: string): ThemeConfig { return claudePlusDark; }
```
Both currently ignore the pack argument and always return the Claude-Warm-flavoured blob — `antdConfig.ts` is where the `pack` argument becomes real.

**Pack lookup shape to reuse** — `src/core/theme/ThemeConfig.ts:3-31`: a `COLOR_THEMES` array + `getColorTheme(id?)` with a total fallback. The new file should mirror this defensive lookup for `pack: 'default' | 'liquid-glass' | 'claude-warm'`, Phase-1 resolving only `'default'` (D-15).

**Result/guard discipline to reuse** — `src/core/theme/ThemeSync.ts:102-107` (the `typeof chrome === 'undefined'` early-return, soft-success):
```ts
if (typeof chrome === 'undefined' || !chrome?.storage?.sync) {
  return { ok: true };     // no chrome → soft success, never throw
}
```

**Target shape (RESEARCH Pattern 3)** — must return an object, never `undefined`, and must compose algorithms as an array:
```ts
export function getAntdConfig(
  { mode, pack, compact }:
  { mode: 'light' | 'dark' | 'auto'; pack: 'default' | 'liquid-glass' | 'claude-warm'; compact: boolean },
): ThemeConfig {
  const resolved = mode === 'auto' ? resolveSystem() : mode;      // no persistence here
  const algorithms = [resolved === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm];
  if (compact) algorithms.push(theme.compactAlgorithm);           // APPR-05: fixed per surface
  return { algorithm: algorithms, token: {...seedTokens(pack)}, components: {...componentTokens(pack)}, cssVar: true, locale: enUS };
}
```
`enUS` import: `import { enUS } from 'antd/locale/en_US';` (UI-SPEC: never AntD locale defaults).

---

### C2. `src/core/theme/ThemeStore.ts` + `ThemeSync.ts` (ADAPT — the `np_theme` single-writer fix)

**Analog:** self + `chromeStorageAdapter.syncStorageAdapter`

**Store shape to KEEP verbatim** — `src/core/theme/ThemeStore.ts:72-140` (the canonical zustand shape CONVENTIONS mandates):
```ts
export const useThemeStore = create<ThemeState>()(
  persist(
    immer((set, get) => ({ /* state + actions */ })),
    {
      name: THEME_STORAGE_KEY,                              // 'np_theme'
      storage: createJSONStorage(() => syncStorageAdapter), // sync area, debounced
      partialize: (state) => ({ mode: state.mode, colorTheme: state.colorTheme, pack: state.pack }),
      version: 1,
      migrate: themeMigrate,
    },
  ),
);
```

**Throw-free migrate to KEEP as the idiom** — `ThemeStore.ts:38-49`:
```ts
export function themeMigrate(persisted: unknown, version: number): ThemePersisted {
  const defaults: ThemePersisted = { mode: 'auto', colorTheme: DEFAULT_COLOR_THEME_ID, pack: 'default' };
  if (persisted && typeof persisted === 'object') return { ...defaults, ...(persisted as Partial<ThemePersisted>) };
  return defaults;   // unparseable → defaults, never throw
}
```

**The defect to fix (Pitfall 1)** — `ThemeSync.ts:136-157` casts blindly:
```ts
const modeChange = changes[THEME_STORAGE_KEY];
if (modeChange?.newValue !== undefined) {
  const newMode = modeChange.newValue as ThemeMode;      // ← raw cast; breaks when the other writer wrote a bare string
  if (useThemeStore.getState().mode !== newMode) useThemeStore.getState().setMode(newMode);
}
```
Replace with a shape-detecting reader (`readThemeValue`, RESEARCH Code Example 2) that accepts **both** the legacy bare string and the zustand persist blob and returns `null` on anything else. `applyThemeToSync` (lines 102-119) is the second writer — it writes a bare mode string to the same key; funnel it through `ThemeStore` or delete it.

**Anti-pattern (do not copy):** `ThemeStore.setMode` publishes on `BroadcastBus` **and** toggles `document.documentElement.classList` (lines 59, 87-89). D-15 requires `chrome.storage.onChanged` as the propagation path and UI-SPEC forbids `.dark` class manipulation for AntD (Open Question 2 decides the scope of the class).

---

### C3. `src/core/theme/chromeStorageAdapter.ts` (KEEP + extend — adapter / storage)

**Analog:** self (247 lines) — this is the repo's **storage choke point** and the `__test__` reference implementation.

**Test-seam convention to copy exactly** — `chromeStorageAdapter.ts:226-246`:
```ts
// ---------------------------------------------------------------------------
// Test seams — exported only for unit tests. Production code must NOT use
// these (they reach into the debounce timer). The `__test__` prefix is the
// convention used by other adapters in this codebase for test-only exports.
// ---------------------------------------------------------------------------
export const __test__ = {
  setTimerFactory(factory: typeof timerFactory): void { timerFactory = factory; },
  setTimerClear(clear: typeof timerClear): void { timerClear = clear; },
  resetPendingState(): void { if (pendingTimer) timerClear(pendingTimer); pendingTimer = null; pendingWrites.clear(); _lifecycleInstalled = false; },
  getPendingSize(): number { return pendingWrites.size; },
};
```

**Debounce constant discipline to copy** — line 14: `export const STORAGE_DEBOUNCE_MS = 300;` exported **so tests can drive timers without hard-coding 300**.

**Failure logging to copy** — lines 154-156: `performFlush().catch((err) => debugLog('STORAGE_DEBOUNCE_FLUSH_FAILED', err?.message ?? String(err)))` — the debounced path never throws into the zustand persist caller.

**Environment guards to copy** — lines 4-5 (`typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local)`), 111 (`typeof window === 'undefined'` return for the SW), 127-139 (pending-map read short-circuit).

---

### D1. `src/core/workspace/WorkspaceState.ts` (NEW — model/schema, transform)

**Analog:** `src/core/workspace/WorkspaceStore.ts` § `WorkspaceStateData` (lines 29-38) + `workspaceMigrate` (77-82)

**Current shape to extend to canonical §8.4** — `WorkspaceStore.ts:22-64`:
```ts
export interface TabContext { tabId: number; title: string; url: string; pinned: boolean; }

export interface WorkspaceStateData {
  workspaceId: string;
  conversationId: string | null;
  activeProvider: string | null;
  selectedModel: string | null;
  pinnedTabs: TabContext[];
  activeSurface: ActiveSurface;
  openedStandaloneTabId: number | null;
  version: number;
}
```
**D-11 additions:** `schemaVersion`, `currentPageContext` (null), `selectedNotes` (immutable empty), `activeAddonContext` (null), `activeSkillRun` (null). Later-phase fields must be defaulted `null`/empty, producer-free, and typed now.

**Throw-free migration idiom to copy verbatim** — `WorkspaceStore.ts:77-82`:
```ts
export function workspaceMigrate(persisted: unknown, version: number): unknown {
  if (persisted && typeof persisted === 'object') return persisted;
  return {};
}
```

**Phase-1 producer allowlist (D-11):** only `schemaVersion`, `workspaceId`, `conversationId`, `activeSurface`, `openedStandaloneTabId` may be mutated. `setActiveProvider`/`setSelectedModel` (lines 101-110) must be removed or made inert — they are the exact "raw model selector writes `selectedModel`" path DEC-HTML-01 forbids.

**Validation:** zod (`zod@4.4.3` installed, zero imports today) with `.strict()` so unknown/invalid fields fail closed (D-11, §0.3). No analog exists in-repo — use RESEARCH § Security Domain V5.

---

### D2. `src/core/workspace/handoff/protocol.ts` (NEW — protocol/messaging, pub-sub)

**Analogs:** `src/core/workspace/WorkspaceSync.ts` (discriminated union on a named channel) + `src/core/runtime/RuntimeEnvelope.ts` (envelope factory/guard) + `src/core/runtime/BroadcastBus.ts` (transport)

**Discriminated-union-on-channel shape to copy** — `WorkspaceSync.ts:1-31`:
```ts
import { subscribe, publish } from '../runtime/BroadcastBus';   // → '../../runtime/BroadcastBus'
const WORKSPACE_CHANNEL = 'np_workspace';

export type WorkspaceSyncMessage =
  | { type: 'WORKSPACE_UPDATED'; workspaceId: string; conversationId: string | null }
  | { type: 'STANDALONE_OPEN'; workspaceId: string; conversationId?: string; page?: string }
  | { type: 'WORKSPACE_HANDOFF'; workspaceId: string; conversationId: string };

export function onWorkspaceSync(handler: SyncHandler): () => void {
  return subscribe<WorkspaceSyncMessage>(WORKSPACE_CHANNEL, (msg) => { handler(msg); });
}
export function notifyWorkspaceHandoff(workspaceId: string, conversationId: string): void {
  publish<WorkspaceSyncMessage>(WORKSPACE_CHANNEL, { type: 'WORKSPACE_HANDOFF', workspaceId, conversationId });
}
```
The handoff protocol **supersedes** this union: the current `STANDALONE_OPEN`/`WORKSPACE_HANDOFF` notice pair becomes `HANDOFF_READY` / `WORKSPACE_HANDOFF` / `HANDOFF_ACK` with request-id correlation (RESEARCH Pattern 2). `WorkspaceSync.ts` is a REPLACE row — do not keep both.

**Transport semantics to respect** — `BroadcastBus.ts:43-62`: `subscribe` returns an unsubscribe closure and closes the channel at zero listeners; `publish` posts and returns `void` — **no delivery receipt, no replay**. Never send immediately after `tabs.create`.

**Self-echo suppression already exists** — `BroadcastBus.ts:12-15, 26-29` (`_sender` instance id). The handoff must still validate content (`target`, `workspaceId`, `requestId`, `schemaVersion`) because any same-origin extension page can publish.

**Envelope-guard shape to copy for URL/message validation** — `RuntimeEnvelope.ts:70-79`:
```ts
export function isEnvelope(value: unknown): value is RuntimeEnvelope {
  return typeof value === 'object' && value !== null &&
    'type' in value && 'operationId' in value && 'timestamp' in value && 'source' in value &&
    MessageTypeValues.includes((value as RuntimeEnvelope).type as MessageType);
}
```
Note the RESEARCH security finding: `isEnvelope` checks four key names + type membership only — add zod validation for payloads at the new boundaries (and the sender guard at `MessageBus.init`, `MessageBus.ts:64-73`).

**Constants to export (A10):** `HANDOFF_SCHEMA_VERSION`, `HANDOFF_TIMEOUT_MS` (~3000), `HANDOFF_MAX_RETRIES` (2) — named exports pinned by tests, not inline magic numbers.

---

### D3. `src/core/workspace/WorkspaceRouter.ts` (ADAPT — service/navigation, request-response)

**Analog:** self (159 lines)

**Dedupe + focus idiom to extend (SP-02, D-12)** — lines 40-74:
```ts
chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html*') }, (tabs) => {
  if (chrome.runtime.lastError) { opts?.onSettled?.({ ok: false, error: String(chrome.runtime.lastError.message) }); return; }
  if (tabs.length > 0 && tabs[0].id) {
    const tabId = tabs[0].id; const windowId = tabs[0].windowId;
    chrome.tabs.update(tabId, { active: true }, () => { /* lastError → onSettled */ 
      if (windowId !== undefined) chrome.windows.update(windowId, { focused: true }, () => opts?.onSettled?.({ ok: true }));
      else opts?.onSettled?.({ ok: true });
    });
    useWorkspaceStore.getState().setOpenedStandaloneTabId(tabId);
  } else {
    chrome.tabs.create({ url }, (tab) => { /* lastError → onSettled */ 
      if (tab.id) useWorkspaceStore.getState().setOpenedStandaloneTabId(tab.id);
      opts?.onSettled?.({ ok: true });
    });
  }
});
```
Keep the callback-style + `chrome.runtime.lastError` branches verbatim; replace the fire-and-forget `publish(...STANDALONE_OPEN...)` at lines 33-38 with the request-id handshake (success must be gated on an ack, not on `tabs.create`).

**URL bootstrap to REPLACE** — lines 26-31 currently build `URLSearchParams` ad-hoc; D-13 requires validated/normalised params (workspaceId, conversationId, route, handoff request id, handoff schema version) through one zod path. `hydrateFromURL` (lines 143-158) is the read side and must gain the same validation + the `notifyWorkspaceHandoff` call removed (it claims a handoff with no ack).

**`openOptions` (lines 87-123)** — same dedupe shape; the URL target changes from `options.html` to `standalone.html?page=options` (§5.4, UI-SPEC § Options routing).

---

### D4. `src/core/workspace/WorkspaceStore.ts` (ADAPT — store, CRUD)

**Analog:** self (173 lines)

**Persist block to DELETE (D-14)** — lines 147-171:
```ts
{
  name: 'np_workspace_store',                                   // ← must not exist in Phase 1
  storage: createJSONStorage(() => chromeStorageAdapter),
  partialize: (state) => ({ ... }),
  version: 1,
  migrate: workspaceMigrate,
}
```
Phase 1 persists **neither** `np_workspace_store` nor `np_workspace`. Also delete the stale key on startup so Phase 2 does not inherit a zombie blob (RESEARCH Runtime State Inventory).

**SWAP POINT comment to keep and re-scope** — lines 8-20 (`isPrimaryWriter()` always-true). D-12 requires a Phase-1 adapter that reports writable and **says it is a Phase 1 adapter**, never fabricating election success/epoch/writer identity.

---

### E1. `src/core/input/KeymapRegistry.ts` (ADAPT — registry/input, event-driven)

**Analog:** self (61 lines) — the defect is in the predicate, lines 9-34.

**Current (broken on macOS):**
```ts
const keydownListener = (e: KeyboardEvent): void => {
  for (const keymap of keymaps.values()) {
    const modifiers = keymap.keys.split('+');
    const key = modifiers.pop()?.toLowerCase();
    const ctrl = modifiers.includes('Control') || modifiers.includes('Cmd');
    const shift = modifiers.includes('Shift');
    const alt = modifiers.includes('Alt');
    const meta = modifiers.includes('Meta');
    if (key === e.key.toLowerCase() && ctrl === (e.ctrlKey || e.metaKey) && shift === e.shiftKey && alt === e.altKey && meta === e.metaKey) {
      e.preventDefault();
      try { keymap.handler(); } catch { /* swallow */ }
      return;
    }
  }
};
```

**Replace with a single platform-primary modifier** (RESEARCH Code Example 3):
```ts
const PRIMARY_TOKENS = new Set(['Control', 'Cmd', 'Command', 'Meta']);
function matchesKeymap(keys: string, e: KeyboardEvent): boolean {
  const parts = keys.split('+');
  const key = parts.pop()?.toLowerCase();
  const primary = parts.some((p) => PRIMARY_TOKENS.has(p));
  const shift = parts.includes('Shift');
  const alt = parts.includes('Alt');
  return key === e.key.toLowerCase() && primary === (e.metaKey || e.ctrlKey)
    && shift === e.shiftKey && alt === e.altKey;
}
```

**Registration/cleanup shape to KEEP** — lines 38-60: module `Map`, listener attached on first `register`, removed when the map empties; duplicate id throws (lines 40-42). Change the raw `Error` to a typed error carrying the canonical code `KEYMAP_CONFLICT` (§21.6). Registry currently has **zero consumers and no test file** — ship `tests/core/input/KeymapRegistry.test.ts` in the same plan.

---

### E2. `src/core/commands/registerWorkspaceCommands.ts` (ADAPT — registry/commands)

**Analog:** self (153 lines)

**Deps-injection pattern to KEEP verbatim** — lines 24-78:
```ts
export interface SidepanelCommandDeps {
  openStandalone: () => void; openOptions: () => void; toggleTheme: () => void; reloadExtension: () => void;
}
export function registerSidepanelCommands(deps: SidepanelCommandDeps): () => void {
  CommandRegistry.register({ id: 'open-standalone-view', name: 'Open Standalone view', description: '...', category: 'Navigation', action: () => { deps.openStandalone(); } });
  ...
  return () => { CommandRegistry.unregister('open-standalone-view'); ... };
}
```
The cleanup-closure contract and the per-id unregister list are the pattern; keep them and change the **content** to D-09's set (Open Standalone view / Focus Side Panel [Standalone only] / Open Options / Toggle theme) with `reload-extension` gated by `import.meta.env.DEV` (D-10). Update description/category strings to the UI-SPEC § Copywriting Contract table verbatim (`Appearance` not `Theme`; `System` not `Extension`).

---

### E3. `src/components/common/CommandPalette.tsx` (ADAPT — component/overlay)

**Analog:** self (127 lines)

**Overlay keydown shape to KEEP (intra-overlay, not global)** — lines 39-64: `Escape` closes, `ArrowUp/Down` `preventDefault` + move selection, `Enter` `preventDefault` + execute. This listener must stay (it is not the global binding D-09 removes) — but the plan must verify `Cmd+K` while the palette is open *toggles closed* rather than double-handling.

**Three concrete defects to fix (UI-SPEC § Copywriting + RESEARCH Anti-Patterns):**
- line 87: `<div style={{ ... color: '#999' }}>` → token-derived (`theme.useToken()`), and zero-results copy must resolve through `t('commands.noResults')`.
- line 106: `backgroundColor: idx === selectedIndex ? 'var(--color-primary-bg, #e6f4ff)' : undefined` → `token.colorPrimaryBg`.
- line 118: `fontSize: 11` → **12px floor** (`colorTextTertiary`).
- Placeholder line 77 `"Search commands…"` → `t('commands.placeholder')`; category label line 118-120 → `t('commands.category.*')`.
- `Modal` props (lines 67-74) already match UI-SPEC (`width={560}`, `centered`, `footer={null}`, `destroyOnHidden`) — keep. Add explicit close accessible name (`a11y.closeDialog`).

---

### E4. `src/core/runtime/RuntimeEnvelope.ts` (ADAPT — model/messaging)

**Analog:** self (80 lines)

**Canonical literal realignment (Open Question 7)** — lines 1-26: rename `SIDE_PANEL_OPEN` → `OPEN_SIDE_PANEL`, `STANDALONE_OPEN` → `OPEN_STANDALONE` per Appendix E; keep the scaffold-local five (`CONTENT_SCRIPT_READY`, `SPA_NAVIGATION`, `PAGE_LIVE_CONTEXT`, `PAGE_EXTRACTION_REQUESTED`, `PAGE_HTML_PAYLOAD`) as a **clearly separated second export** so `BackgroundRouter` and `tests/background/**` (which register by literal, `BackgroundRouter.ts:38-52`) move in the same plan.

**Keep verbatim** — `createEnvelope` (56-68: `crypto.randomUUID()` + `Date.now()` + `source`) and `isEnvelope`'s structural shape. Add zod payload validation at the new boundaries; do **not** add handoff ready/ack literals here — they ride `BroadcastBus`, not `MessageTypeValues` (Open Question 6 recommendation).

---

### F1. `src/services/ports/providerValidationPort.ts` + `credentialStorePort.ts` (NEW — ports/types)

**Analog:** `src/services/aiProvider.ts` § `ProviderConnectionResult` (lines 22-24) — the repo's result-union idiom:
```ts
export type ProviderConnectionResult =
  | { ok: true; models: CustomModelItem[] }
  | { ok: false; error: string };
```

**Target (RESEARCH Pattern 5):**
```ts
export type ProviderValidationResult =
  | { ok: true }
  | { ok: false; code: 'PROVIDER_AUTH' | 'PROVIDER_5XX' | 'NETWORK' | 'PROVIDER_CHECK_FAILED' };

export interface ProviderValidationPort {
  validate(input: { providerId: ProviderId; credential: string; signal?: AbortSignal }): Promise<ProviderValidationResult>;
}
export interface CredentialStorePort {   // Phase 2 port — NO Phase 1 implementation
  isConfigured(providerId: ProviderId): Promise<boolean>;
  store(providerId: ProviderId, credential: string): Promise<{ ok: true } | { ok: false; code: string }>;
}
```
Codes are canonical Appendix C.2 / §21.6 — do **not** invent `PROVIDER_RUNTIME_NOT_READY` (D-05). `ProviderId` must be `'openai' | 'anthropic' | 'gemini' | 'ollama'`; the prototype's `'claude'` (`src/types/index.ts:1, 94`) is the defect.

**Naming note:** `CredentialStorePort.store` takes a credential as a parameter — that is fine for a Phase-2 interface, but Phase 1 must ship **no** implementation and no call site.

---

### F2. `src/components/onboarding/OnboardingFlow.tsx` (NEW — component/flow)

**Analog:** `src/components/OnboardingModal.tsx` (406 lines) — same 4-step Flow 9 shape, but ADAPT: no `testProviderConnection`, no `useExtensionStore.updateConfig`, no `apiKey` persistence, ports injected via props.

**Modal shell + focus contract to KEEP** — lines 386-405:
```tsx
<Modal
  open={open}
  closable={false}            // Escape/backdrop do NOT dismiss (UI-SPEC § Keyboard & focus)
  footer={null}
  width={520}
  centered
  destroyOnHidden
  mask={{ closable: false }}
  data-testid="onboarding-modal"
>
```
UI-SPEC keeps `Escape does not dismiss`.

**Step render shape to copy** — lines 178-384: one `renderStepN()` per step, each `<Space orientation="vertical" size="middle" style={{ width: '100%' }}>` + `<Title level={3}>` + step caption + body + footer row `justifyContent: 'space-between'` with the exit affordance (`Button type="link"`) on the left and navigation on the right.

**Password field shape to copy** — lines 268-282:
```tsx
<Input.Password
  value={apiKey}
  onChange={(e) => setApiKey(e.target.value)}
  autoFocus
  iconRender={(visible) => visible ? <EyeOutlined onClick={() => setShowApiKey(false)} /> : <EyeInvisibleOutlined onClick={() => setShowApiKey(true)} />}
  visibilityToggle={false}
  type={showApiKey ? 'text' : 'password'}
  data-testid="onboarding-api-key-input"
/>
```
UI-SPEC requires the toggle's accessible name from `t('onboarding.showKey')` / `t('onboarding.hideKey')` and placeholder `t('onboarding.keyPlaceholder')`.

**Unmount guard to copy** — lines 96-102 (`mountedRef` + cleanup) — the fixture `validate()` is async; the guard prevents setState-after-unmount on Skip.

**State machine to build (replaces lines 116-165):** `'idle' | 'testing' | 'ok' | 'error'` **plus** a cancelled branch that returns to idle with no error and no success claim (UI-SPEC § Validation state matrix). Status→UI mapping is pinned in the UI-SPEC table; copy labels come from `t()` only.

**Anti-patterns in the analog — do NOT copy:** `apiKey` handed to `updateConfig` (lines 130-147); hard-coded `'#52c41a'`/`'#ff4d4f'` (lines 346, 358) — use `token.colorSuccess`/`token.colorError`; literal `'Connected!'` (line 347, canonical is `Connected`); literal `'Skip for now'` (canonical `Skip`); literal `'Connect Provider'` (canonical `Check connection`); literal `'Try again'` (canonical `Retry`); literal `'Testing connection…'` with an ellipsis character (canonical is ASCII `Testing connection...`).

**Shared-module constraint (D-06):** the component calls **no** Chrome API. Navigation/lifecycle adapters (`openStandalone`, `close`, `readOnboardingState`) come in through typed props/ports. One module, both surfaces.

---

### F3. `src/core/storage/legacyCredentialCleanup.ts` (NEW — migration/utility, batch)

**Analogs:** `src/core/workspace/WorkspaceStore.ts` § `workspaceMigrate` (throw-free totality) + `chromeStorageAdapter.ts` (guarded chrome access, `debugLog`-only failure reporting)

**Throw-free/total discipline to copy** — `WorkspaceStore.ts:77-82` (see D1) and `chromeStorageAdapter.ts:111` (early `typeof` guard).

**Logging discipline to copy** — `src/core/log/debugLog.ts:11-27`: `debugLog('SCREAMING_SNAKE', message, context?)`, 200-entry ring buffer, `console.debug` only. The cleanup must log **field names only**: `debugLog('LEGACY_CREDENTIAL_FIELDS_REMOVED', 'fields removed', { removedFields })` and never the values.

**Target signature (RESEARCH Pattern 6):**
```ts
const LEGACY_SECRET_FIELDS = ['apiKey', 'token', 'accessToken', 'secret'] as const;
const CLEANUP_SCHEMA_VERSION = 1;

export function sanitizeLegacyProviderConfig(raw: unknown): {
  value: unknown; found: boolean; removedFields: string[];   // field NAMES only — never values
} { /* deep-walk providers[*] + top-level openAiKey/geminiKey; delete matched keys; never return/hash/copy a removed value */ }
```

**Live targets (RESEARCH probe, per-file `apiKey` counts):** `src/services/aiProvider.ts` (15), `src/components/OnboardingModal.tsx` (9), `src/store/useExtensionStore.ts` (4), `src/components/options/OptionsPage.tsx` (4), `src/types/index.ts` (1 — `ProviderConfig.apiKey` at line 108, and `CustomProviderDetail.apiKey` at line 108/103-112).

**Startup wiring analog:** `entrypoints/background.ts:41-48` (`onInstalled`) — extend with the idempotent cleanup on INSTALL **and** UPDATE (and/or `onStartup`), never as a silent fourth registration (keep the D-13 comment honest).

---

### F4. `src/store/useExtensionStore.ts` + `src/types/index.ts` (ADAPT — store + model)

**Analog:** self

**Secrets to remove** — `useExtensionStore.ts:21-75`: `DEFAULT_CONFIG` hard-codes `apiKey: ''` for four providers plus `openAiKey`/`geminiKey`, a fictional `selectedModel: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx'`, and `themeMode: 'Auto'` (APPR-03 forbids a second theme source). The persist config follows the canonical shape (version/migrate) already established elsewhere in the file.

**Type split to build (D-07):**
- `PersistedProviderConfig` — non-secret metadata only (`id`, `name`, `enabled`, `isConfigured`, `useCustomProxy`, non-secret `proxyUrl`, `models[]`).
- `TransientCredentialInput` — in-memory onboarding input only.
- `CredentialStorePort` — Phase 2 typed port, no implementation.
- `ProviderValidationPort` — Phase 3 typed port, fixture-backed in Phase 1.

**Store shape to keep** — `persist(immer(...), { name: 'np_store', storage: createJSONStorage(() => chromeStorageAdapter), partialize, version, migrate })` (CONVENTIONS § Module Design).

---

### G1. `src/components/common/DeferredNotice.tsx` (NEW — component/marker, transform)

**Analog:** `src/components/common/MirrorBanner.tsx` (73 lines) — the closest existing "presentation-only, token-driven, labelled region" component.

**Token discipline + aria shape to copy** — `MirrorBanner.tsx:27-73`:
```tsx
export const MirrorBanner: React.FC<MirrorBannerProps> = ({ onRefocus }) => {
  const { token } = theme.useToken();
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="mirror-banner"
      style={{ height: 32, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', background: token.colorPrimaryBg,
        borderTop: `1px solid ${token.colorBorderSecondary}`, borderBottom: `1px solid ${token.colorBorderSecondary}`,
        flexShrink: 0, userSelect: 'none' }}
    >
      <Typography.Text style={{ fontSize: 12, color: token.colorTextBase, lineHeight: '32px' }}>Switched to Standalone.</Typography.Text>
      <Typography.Link onClick={onRefocus} aria-label="Refocus here and return to primary chat mode" style={{ ... }}>
        Refocus here
      </Typography.Link>
    </div>
  );
};
```

**Target contract (UI-SPEC § Fixture-Backed & Deferred Marking Convention):**
```ts
// src/components/common/DeferredNotice.tsx
export type Phase1Backing = 'fixture' | 'deferred';
```
- Two variants only: **Inline** = AntD `Tag`, adjacent to the affected control; **Block** = `Alert type="warning" showIcon` at the top of the affected region.
- `colorWarning`-toned, visible without hover, `aria-label` holds the **full sentence** (never tooltip-only).
- Copy keys: `deferred.tag` / `deferred.fixtureTag` / `deferred.reasonDeferred` / `deferred.reasonFixture` → add to `src/core/i18n/strings.ts`.
- The region that is inert carries `data-np-backing="fixture" | "deferred"` on its **outermost** element; the value is the literal from `Phase1Backing` — no ad-hoc strings.
- One file, one type, one component. No parallel marker module.

**Test analog:** `tests/components/MirrorBanner.test.tsx:11-41` — `renderWithAntd(<ConfigProvider>{ui}</ConfigProvider>)`, literal-string assertions, click-once callback assertions, "does not throw" for effects that would navigate.

---

### G2. `src/components/sidepanel/SidePanelShell.tsx` + `SidePanelRouter.tsx` (NEW — shell/router)

**Analog:** `src/components/standalone/StandaloneShell.tsx` (112 lines)

**Shell composition shape to copy** — lines 20-31, 40-58:
```tsx
export const StandaloneShell: React.FC<StandaloneShellProps> = ({ onOpenOptions, onOpenSidepanel }) => {
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState<WorkspaceTab>('Chat');

  useEffect(() => {                                  // 29-31: hydrate from URL on mount
    hydrateFromURL(new URLSearchParams(window.location.search));
  }, []);

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', overflow: 'hidden',
      backgroundColor: token.colorBgLayout, fontFamily: token.fontFamily }}>
      <WorkspaceSidebar activeMenu={activeMenu} onSelectMenu={setActiveMenu} collapsed={collapsed}
        onToggleCollapsed={setCollapsed} onOpenSidepanel={onOpenSidepanel} onOpenOptions={onOpenOptions} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
        backgroundColor: token.colorBgContainer, borderTopLeftRadius: token.borderRadiusLG * 3,
        borderLeft: `1px solid ${token.colorBorderSecondary}`, ... }}>
        {activeMenu === 'Chat' && ( ... )}
        {activeMenu === 'Tools' && <ToolsGridPanel />}
        ...
      </main>
    </div>
  );
};
```

**View-switch pattern to copy** — lines 77-108: a simple `activeMenu === 'X' && <Component/>` switch. `SidePanelRouter`/`StandaloneRouter` should keep this shape (no router library) and read the initial view from the validated URL (`page` param) instead of local state alone.

**Adaptations required:**
- Target geometry is UI-SPEC § Standalone: AntD `Layout`/`Sider` (240/72 px) / `Header` (56 px) / `Content`; the current sidebar is hand-rolled (`WorkspaceSidebar.tsx`, 623 lines) — ADAPT or replace per UI-SPEC component table.
- Sider Main group = `Chat · Agent · Note · Write · Tools`; **`Teams` is a divergence** — `StandaloneShell.tsx:108` mounts `TeamsPanel`, which is not in the canonical Main set. Disposition it (`deferred-shell`/`remove`) in the inventory, do not silently keep.
- Add-ons group renders only at ≥1 registered add-on (`Registry.ts` — Phase 1 registers none); account block absent (no identity). Absent elements need no marker.
- Side Panel does **not** use `Layout` (UI-SPEC § Side Panel contract): 52 px header, 44 px composer toolbar, 60 px min input, 28 px status bar, 400 px width.

---

### G3. `src/components/pages/{ChatPage,AgentPage,NotesPage,OptionsPage}.tsx` (ADAPT — page shells, D-16)

**Analog:** `src/components/pages/AgentPage.tsx` (self, 24 lines) — e.g.:
```tsx
export const AgentPage: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
    <Empty description={t('agent.empty')}>
      <Typography.Text type="secondary">
        Agent functionality will be implemented in Phase 3 (AI Runtime) and Phase 7 (UI/UX).
      </Typography.Text>
    </Empty>
  </div>
);
```

**Why this is the disposition target:** each page already carries a "will be implemented in Phase N" sentence — the *intent* of `deferred-shell` — but with two defects: (a) it uses bare AntD `Empty`, which UI-SPEC forbids ("Not used bare — empty states are mascot + copy"), and (b) it carries **no** `data-np-backing` marker and no canonical deferred-state panel naming the owning phase.

**Required changes per page:** add `data-np-backing="deferred"` (or `"fixture"` where the approved presentation exists) on the page root; replace bare `Empty` with the intentional deferred-state panel naming the owning roadmap phase; add navigation back to an active Phase 1 surface where useful; no fake controls, no skeleton.

**Duplicate-path hazard (RESEARCH § Deprecated):** `ChatPage`/`AgentPage`/`NotesPage`/`OptionsPage` exist **both** under `src/components/pages/**` and under their live surface directories (`src/components/options/OptionsPage.tsx`, `src/components/notes/NotesWorkspace.tsx`, …). The inventory must assign each exactly one disposition — no module may keep two live implementations (D-02).

---

### G4. `src/core/components/ErrorBoundary.tsx` (ADAPT — component/boundary)

**Analog:** self (45 lines)

**Current fallback** (lines 28-44):
```tsx
<Result status="500" title={t('common.error')} subTitle={t('shell.error')}
  extra={<Button type="primary" onClick={this.handleReload}>{t('common.retry')}</Button>} />
```
**Adapt** to the pinned keys: `shell.errorTitle` = `Something went wrong`, `shell.errorBody` = `Reload NowPilot to continue.`, `shell.errorReload` = `Reload` (§17.4). **Mount it** — CONCERNS flags that the boundary is currently never mounted; RESEARCH Code Example 1 mounts it inside `AntdApp` on both surfaces.

---

### H1. `tests/setup.ts` (ADAPT — test infra)

**Analog:** self (197 lines) — the shared mock surface every suite relies on.

**Mocks to reuse and extend:**
- `localStorage` Map stub — lines 5-20.
- `ResizeObserver` — lines 23-28; `matchMedia` — lines 31-43.
- `chrome.storage.local` — lines 46-95, with `__chromeStorageLocal` + `__chromeStorageMap` globals (lines 94-95).
- `chrome.storage.sync` — lines 97-137 (**note:** its `get` reads the same `chromeStorage` map as `local`, not a separate map).
- `chrome.storage` install guard — lines 139-145.
- `BroadcastChannel` mock + `__broadcast(channelName, data)` helper — lines 150-196.

**Additions Phase 1 needs:** `chrome.storage.onChanged` (currently injected ad-hoc per suite — see `tests/core/theme/ThemeSync.test.tsx:24-45`; hoist it into setup), `chrome.tabs`/`chrome.windows`/`chrome.sidePanel` stubs for the handoff suites (currently each suite stubs locally — `tests/core/workspace/WorkspaceRouter.test.ts:7-25`).

---

### H2. Gate tests to adapt (Pitfall 6)

**`tests/isolation/cross-entrypoint-imports.test.ts`** — the comment-stripping grep helper (lines 25-47) and the fetch gate (lines 74-81) must repoint `entrypoints/content/` → `src/entrypoints/content/`. **Extend the self-test block (lines 84-124)**, do not merely repoint: a nonexistent path yields zero matches and the gate passes **vacuously**. Add a positive-control case that asserts the gate's target directory exists.

**`tests/core/strict/np-strict-ceiling.test.ts`** — lines 49-56 and 85 git-grep `src entrypoints`; collapse to `src` and update the fallback `find src entrypoints ...` (lines 62-66) in the same commit. `NP_STRICT_CEILING: 0` lives in `package.json:7` and is read at lines 35-45 — the ceiling must not be raised to make the move pass.

**`tests/isolation/generated-manifest.test.ts` (NEW)** — RESEARCH Code Example 4: read `.output/chrome-mv3/manifest.json`, assert permissions `['sidePanel','storage','tabs']`, assert **no** `options_ui`/`options_page`, assert `side_panel.default_path === 'sidepanel.html'`. Sequence the `content_scripts` assertion with the Pitfall-5 rename — as written today it would fail the phase.

---

### H3. Test-suite analogs for the new suites

| New suite | Analog | What to copy |
|---|---|---|
| `tests/core/input/KeymapRegistry.test.ts` | `tests/background/background-router.test.ts:12-27` | `vi.resetModules()` + dynamic re-import for a fresh module instance per test; assert the **macOS** `Cmd+K` case explicitly (Pitfall 2) and the `KEYMAP_CONFLICT` throw |
| `tests/core/theme/antdConfig.test.ts` | `tests/core/theme/ThemeStore.test.ts:159-212` | Reset store + mocks in `beforeEach`; assert `getAntdConfig` **never returns `undefined`**, and the compact/default algorithm split |
| `tests/core/workspace/WorkspaceHandoff.test.ts` | `tests/core/workspace/WorkspaceRouter.test.ts:7-25, 199-232` | Callback-style chrome stub + `vi.stubGlobal('chrome', chromeApi)` **before** the import; `BroadcastBus.publish` spy filtered by channel + `payload.type`; `__broadcast('np_workspace', msg)` for inbound |
| `tests/core/workspace/WorkspaceState.test.ts` | `tests/core/theme/ThemeStore.test.ts:188-211` | `expect(() => migrate(...)).not.toThrow()` for garbage input; shape/default assertions |
| `tests/core/storage/legacyCredentialCleanup.test.ts` | `tests/core/ai/testProviderConnection.test.ts` (sentinel idiom) | `const secretKey = 'sk-secret-DO-NOT-LEAK-XYZ123'` then assert absence across storage/serialised state/messages/logs/DOM (RESEARCH Code Example 5) |
| `tests/components/OnboardingFlow.test.tsx` | `tests/core/theme/ThemeSync.test.tsx:9-15` | `renderWithAntd` wrapper; `vi.spyOn(globalThis,'fetch')` + assert never called; sentinel-absence assertions |
| `tests/components/CommandPalette.test.tsx` | `tests/components/MirrorBanner.test.tsx:7-9` | `renderWithAntd`; assert the five pinned commands, dev-only `reload-extension`, 12 px floor, token-derived selected-row background |
| `tests/components/DeferredNotice.test.tsx` | `tests/components/MirrorBanner.test.tsx:11-41` | Presence/absence of `data-np-backing` on marked vs live regions; `aria-label` full sentence |

---

## Shared Patterns

### S1. Surface isolation (enforced, not advisory)

**Source:** `tests/isolation/cross-entrypoint-imports.test.ts:22-124`
**Apply to:** every new component under `src/components/**`
```ts
const CROSS_IMPORT_RE = /from\s+['"][^'"]*components\/(chat|standalone|options)\//;
```
New surfaces must respect the same rule: `sidepanel/**` and `standalone/**` never import each other; shared code lives in `src/core/**`, `src/types/**`, `src/services/**`, `src/components/common/**`. `src/components/onboarding/**` is a **new** shared directory — the gate must be extended to treat it as shared (like `common/`), and to flag `sidepanel ↔ standalone` cross-imports, in the same plan that creates it.

### S2. Zustand persisted-store shape (single source of truth for all three stores)

**Source:** `src/core/theme/ThemeStore.ts:72-140`, `src/core/workspace/WorkspaceStore.ts:84-172`, `src/core/theme/chromeStorageAdapter.ts:126-224`
**Apply to:** any new persisted store (onboarding state, provider metadata)
```ts
create<State>()(
  persist(
    immer((set, get) => ({ ...state, ...actions })),
    { name: '<np_key>', storage: createJSONStorage(() => syncStorageAdapter | chromeStorageAdapter),
      partialize: (s) => ({ ...persistedOnly }), version: 1, migrate: throwFreeMigrate },
  ),
);
```
Rules: always `partialize` (never persist transient UI state — D-11 explicitly lists what must stay out); always a throw-free, total `migrate`; never introduce a second writer for the same key.

### S3. Result unions for expected failures, throws for programmer errors

**Source:** `src/core/theme/ThemeSync.ts:12` (`ThemeSyncResult`), `src/services/aiProvider.ts:22-24` (`ProviderConnectionResult`), `src/core/workspace/WorkspaceRouter.ts:24` (`{ ok: true } | { ok: false; error }`)
**Apply to:** ports, handoff controller, cleanup report, theme sync
```ts
export type ThemeSyncResult = { ok: true } | { ok: false; error: string };
```
Migrations and cleanup never throw on foreign input; registration functions throw on programmer errors only (duplicate id — `CommandRegistry.ts:12-17`).

### S4. Registration → cleanup closure + module-level Map singleton

**Source:** `src/core/commands/CommandRegistry.ts:9-49`, `src/core/events/EventBus.ts:7-49`, `src/core/input/KeymapRegistry.ts:36-60`, `src/core/runtime/BroadcastBus.ts:9-53`, `src/core/commands/registerWorkspaceCommands.ts:72-78`
**Apply to:** every registry, subscription, keymap and command registration
```ts
export function on<T>(event: string, handler: EventHandler<T>): () => void {
  const entry = getEvent(event);
  entry.handlers.add(handler as EventHandler);
  return () => { entry.handlers.delete(handler as EventHandler); if (entry.handlers.size === 0) events.delete(event); };
}
```
Handlers are swallowed-on-throw by design (`EventBus.ts:31-36`, `BroadcastBus.ts:32-36`, `KeymapRegistry.ts:27-29`).

### S5. Guarded Chrome access + debugLog-only failure reporting

**Source:** `src/core/theme/chromeStorageAdapter.ts:4-5, 111, 154-156`, `src/core/theme/ThemeSync.ts:103-107, 133-135`
**Apply to:** cleanup migration, handoff controller, onboarding state reader, any new adapter
```ts
const hasChromeStorageLocal = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);
...
if (typeof chrome === 'undefined' || !chrome?.storage?.sync) return { ok: true };
...
.catch((err) => { debugLog('SCREAMING_SNAKE_CODE', err?.message ?? String(err)); });
```
Never `console.error` a raw value; never throw into a caller; never log a credential (field names only).

### S6. String resolution through `t()` and a single strings module

**Source:** `src/core/i18n/strings.ts:1-95` (`const strings: Record<string,string>` + `export function t(key: string): string { return strings[key] ?? key; }`)
**Apply to:** every user-visible string in shells, palette, onboarding, deferred notices
New keys go into this one file (`commands.category.*`, `deferred.*`, `onboarding.*`, `shell.error*`, `workspace.*`, `standalone.*`, `theme.sync*`, `a11y.*`, `provider.credentialsCleared`). Never inline a literal in a component; never rely on AntD locale defaults (UI-SPEC § AntD default-chrome overrides).

### S7. Token-first styling (`theme.useToken()`), no hard-coded values

**Source:** `src/components/common/MirrorBanner.tsx:28-71`, `src/components/standalone/StandaloneShell.tsx:20, 35-37`, `src/components/chat/ChatHeader.tsx:17, 27-28`
**Apply to:** `DeferredNotice`, shells, palette fixes, onboarding
```tsx
const { token } = theme.useToken();
// colour / radius / border / spacing reads only — never '#52c41a', 'var(--color-primary-bg, #e6f4ff)', fontSize: 11
```
Spacing scale is `{4, 8, 12 (Side Panel only), 16, 20 (card bodies), 24, 32, 48, 64}`; 12 px is the type floor.

### S8. Test seams via exported `__test__` namespaces

**Source:** `src/core/theme/chromeStorageAdapter.ts:226-246`, `src/core/messaging/BackgroundRouter.ts:55-62` (`__resetForTests`)
**Apply to:** any module with latent module-level state that tests must reset
Never export production internals; never reach into a module's private state from a test.

### S9. Banned-import / strictness gates

**Source:** `scripts/verify-no-tailwind.sh:19-23`, `tests/core/strict/np-strict-ceiling.test.ts:47-103`, `package.json:18`
**Apply to:** all new source
- Zero `innerHTML` / `dangerouslySetInnerHTML`; zero `tailwind`/`shadcn`/`@radix-ui`; zero `framer-motion` (`motion` v12 stays permitted — A9).
- `// @ts-expect-error NP-STRICT-<n>` only (never `@ts-ignore`); `NP_STRICT_CEILING: 0` in `package.json`.
- `verify:phase-1` currently runs `tsc --noEmit && vitest run tests/core tests/background tests/components tests/isolation && bash scripts/verify-no-tailwind.sh` — every new suite must be added to a path it covers, or it will not run in the gate.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/services/fixtures/providerValidationFixtures.ts` | fixture adapter | transform | `grep -rn "fixture" src/ tests/` returns **zero** modules today — this is the repo's first fixture module. Use RESEARCH Pattern 5 + the UI-SPEC § Validation state matrix; prove "no network" with `vi.spyOn(globalThis,'fetch')`. |
| Zod-validated boundary schemas (`WorkspaceState`, URL bootstrap, `HandoffEnvelope` payloads, `chrome.storage.onChanged` values) | validation | transform | `zod@4.4.3` is installed with **zero imports**. No in-repo schema exists to copy — §0.3 requires "a Zod schema + fixture test on every public module boundary"; use RESEARCH § Security Domain V5. |
| `src/components/sidepanel/**` (directory) | shell | request-response | The directory does not exist; compose from `StandaloneShell.tsx` + `ChatHeader.tsx` + UI-SPEC § Side Panel contract. |
| `src/components/onboarding/**` (directory) | shared flow | request-response | New shared directory; only the single-modal analog `OnboardingModal.tsx` exists. |
| Writer-state / mirror typed contracts (Phase-2 freeze) | types | — | D-12 freezes names for Phase 2 (`primary`, `mirror`, election pending, handoff pending, handoff failed, writer unavailable) but no canonical in-repo type exists — take identifiers from PRODUCT_SPEC §21.x, do not invent parallels. |

---

## Metadata

**Analog search scope:** `src/**`, `entrypoints/**`, `tests/**`, `scripts/**`, root configs. Generated trees (`.wxt/**`, `.output/**`, `dist`) deliberately excluded as analog sources.
**Files read for pattern extraction:** 33 (all git-tracked; verified with `git ls-files`).
**Baseline floor (do not mistake for progress):** `npx vitest run` = 18 files / 166 tests green; `npx tsc --noEmit` exit 0; `bash scripts/verify-no-tailwind.sh` exit 0; `pnpm run build:ext` produces a valid MV3 manifest.
**Pattern extraction date:** 2026-09-21

**Analogs that must be re-read by the executor at implementation time (large files, partially mapped):**
`src/components/chat/SidepanelChat.tsx` (614 lines — read 1-210; the `mirrored`/onboarding-gate effects at 203+ are D-12 removal targets), `src/components/standalone/WorkspaceSidebar.tsx` (623 lines — structure grepped only), `src/store/useExtensionStore.ts` (562 lines — read 1-120 for `DEFAULT_CONFIG`), `src/core/theme/chromeStorageAdapter.ts` (247 lines — fully read).
