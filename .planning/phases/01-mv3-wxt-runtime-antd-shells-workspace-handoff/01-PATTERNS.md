# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace Handoff - Pattern Map

**Mapped:** 2026-08-19
**Files analyzed:** 20 (all existing — brownfield strip/wire/migrate, no net-new files except OnboardingModal.tsx + BackgroundRouter.ts)
**Analogs found:** 20 / 20 (every "analog" IS the file itself — this phase modifies real files in place; two are genuinely new)

> **Brownfield framing:** per `01-PLANNING-ADDENDUM.md` §0.3, Phase 1 is strip/wire/migrate, not create. For every "modified" file below, the closest analog is the file's OWN current content (read fresh in this pass, not assumed from CONTEXT.md prose). The two NEW files (`OnboardingModal.tsx`, `BackgroundRouter.ts`) use the nearest sibling pattern as their analog.

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|-----------------|----------------|
| `entrypoints/background.ts` | controller (SW entry) | event-driven | itself (current content read) | exact — modify in place |
| `entrypoints/sidepanel/main.tsx` | controller (surface bootstrap) | event-driven | itself + `entrypoints/standalone/main.tsx` (symmetric) | exact |
| `entrypoints/standalone/main.tsx` | controller (surface bootstrap) | event-driven | itself + `entrypoints/sidepanel/main.tsx` (symmetric) | exact |
| `src/core/messaging/MessageBus.ts` | service (message dispatch) | event-driven | itself | exact — `init()` exists, unused today |
| `src/core/messaging/BackgroundRouter.ts` | service (NEW — typed wrapper) | event-driven | `src/core/messaging/MessageBus.ts` (wraps it) | role-match — new file, wraps existing service |
| `src/core/runtime/RuntimeEnvelope.ts` | model (typed union) | transform | itself | exact — additive type-only change |
| `src/core/runtime/BroadcastBus.ts` | service (pub/sub) | pub-sub | itself | exact — untouched, consumed by Theme/WorkspaceSync |
| `src/core/workspace/WorkspaceStore.ts` | store (zustand+immer+persist) | CRUD | itself | exact |
| `src/core/workspace/WorkspaceRouter.ts` | service (tab lifecycle) | request-response | itself | exact — rename + fix in place |
| `src/core/workspace/WorkspaceSync.ts` | service (pub/sub wiring) | pub-sub | itself | exact — reused as-is |
| `src/core/theme/ThemeStore.ts` | store (zustand+immer+persist) | CRUD | itself | exact |
| `src/core/theme/ThemeSync.ts` | hook/service (cross-surface sync) | pub-sub | itself | exact — pattern WorkspaceSync should mirror |
| `src/core/theme/chromeStorageAdapter.ts` | utility (StateStorage adapter) | file-I/O (chrome.storage) | itself | exact |
| `src/core/commands/CommandRegistry.ts` | store (Map singleton) | CRUD | itself | exact |
| `src/core/registry/Registry.ts` | store (Map singleton, ×3) | CRUD | itself | exact — `FullAppPageRegistry` renames here |
| `src/components/common/CommandPalette.tsx` | component (modal renderer) | request-response | itself | exact — reused, zero changes needed |
| `src/components/common/OnboardingWizard.tsx` → `src/components/OnboardingModal.tsx` | component (NEW — 4-step wizard) | request-response | `OnboardingWizard.tsx` itself (source being shrunk) | exact — same file, thinned |
| `src/components/common/ThemeToggle.tsx` | component | event-driven | itself | exact — Tailwind classNames need AntD conversion (D-18) |
| `src/components/chat/SidepanelChat.tsx` | component (container) | request-response | itself | exact |
| `src/components/standalone/StandaloneWorkspace.tsx` → `StandaloneShell.tsx` | component (container, renamed) | request-response | itself | exact |
| `src/components/standalone/WorkspaceSidebar.tsx` | component | request-response | itself | exact — reused, Tailwind→AntD conversion needed for D-18 gate (heavy `className` usage) |
| `src/store/useExtensionStore.ts` | store (zustand+immer+persist, god-store) | CRUD | itself | exact |
| `src/services/aiProvider.ts` | service (streaming) | streaming | itself | exact |

## Pattern Assignments

### `entrypoints/background.ts` (controller, event-driven) — D-13/D-14

**Analog:** itself, current full content (37 lines):

```typescript
// Current state — entrypoints/background.ts:1-36
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground({
  type: 'module',
  persistent: false,
  main() {
    console.log('NowPilot Background Service Worker initialized');
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    chrome.runtime.onStartup.addListener(() => {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    });
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.storage.local.set({ onboardingComplete: false });
      } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
        chrome.storage.local.set({ onboardingComplete: true });
      }
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    });
    // Handle raw content script messages (not using RuntimeEnvelope yet)  ← D-13 target: REMOVE
    chrome.runtime.onMessage.addListener((message, sender) => {
      if (message.type === 'CONTENT_SCRIPT_READY') { console.debug(...); }
      else if (message.type === 'SPA_NAVIGATION') { console.debug(...); }
    });
  },
});
```

**What changes:** the raw `chrome.runtime.onMessage.addListener` block (lines 28-34) is deleted; replaced with `BackgroundRouter.register()` which internally calls `MessageBus.init()`. The `onInstalled`/`setPanelBehavior`/`onboardingComplete` logic is KEPT verbatim (D-13 says register exactly 3 things: BackgroundRouter, setPanelBehavior, onboardingComplete init — this file already does 2 of the 3 correctly).

**Error handling pattern:** `.catch(() => {})` empty-swallow at edges (line 10, 15, 24) — this IS the established failure-tolerance pattern (RESEARCH.md "Established Patterns" confirms), keep it for any new `chrome.*` promise calls in BackgroundRouter wiring.

---

### `src/core/messaging/MessageBus.ts` (service, event-driven) — D-13/D-14 analog for BackgroundRouter

**Analog:** itself, full 67-line file already read. Key excerpt — the handler contract every future envelope handler MUST follow:

```typescript
// src/core/messaging/MessageBus.ts:49-62 — the init() that background.ts must call
export function init(): void {
  if (initialized) return;                      // idempotent — Pitfall 1 (SW cold-start)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    dispatch(message, sender)
      .then((result) => { sendResponse(result ?? { ok: true }); })
      .catch((error) => { sendResponse({ ok: false, error: String(error) }); });
    return true;                                 // MUST return true synchronously — Pitfall 4
  });
  initialized = true;
}
```

**Registration pattern** (lines 10-22) — `register<T>(type, handler)` returns an unregister function; `Map<string, Set<MessageHandler>>` keyed by envelope `type`. This is the exact shape `BackgroundRouter.register()` should wrap: `BackgroundRouter.register()` = call `MessageBus.init()` once + optionally pre-register the `CONTENT_SCRIPT_READY`/`SPA_NAVIGATION` handlers that today live as raw checks in `background.ts:29-33`.

**Core dispatch pattern** (lines 24-45): `isEnvelope()` guard, `Promise.allSettled` fan-out to all registered handlers for a type, errors collected and logged via `console.error` (not swallowed, unlike the `.catch(() => {})` UI-edge pattern above — background dispatch errors ARE surfaced to console per this file's existing convention).

---

### `src/core/messaging/BackgroundRouter.ts` (NEW file) — D-14

**Analog:** `src/core/messaging/MessageBus.ts` (the service it wraps) + the registration-return-unregister-fn pattern from `src/core/commands/CommandRegistry.ts`.

**Recommended shape** (derived from the two analogs, not invented) — a thin wrapper matching MessageBus's own exported-function style (no class, no default export, named exports):

```typescript
// Follows MessageBus.ts's own module-function convention (not a class)
import { init as initMessageBus, register as registerHandler } from './MessageBus';

export function register(): void {
  initMessageBus();               // idempotent — safe to call on every SW wake
  // pre-register CONTENT_SCRIPT_READY / SPA_NAVIGATION as typed envelope handlers here
}
```

---

### `entrypoints/sidepanel/main.tsx` / `entrypoints/standalone/main.tsx` (controllers, event-driven) — D-05/D-08/D-09

**Analog:** each is the other's mirror; both fully read above (137 and 106 lines respectively — actual file is shorter than CONTEXT.md's claimed line counts, current content differs slightly from CONTEXT.md's line-number citations — always read fresh).

**Cmd+K listener pattern** (KEEP as-is per D-09), identical in both files:
```typescript
// entrypoints/sidepanel/main.tsx:109-118 (same shape in standalone/main.tsx:78-87)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setPaletteOpen((prev) => !prev);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Command registration pattern** (`useEffect` register/cleanup, D-08 base set target) — sidepanel currently registers 3 commands (`toggle-theme`, `open-full-app`, `reload-extension`); standalone registers 2 (`toggle-theme`, `reload-extension`). D-08 target set requires renaming `open-full-app` → `open-standalone-view` and adding `open-options` + `focus-side-panel` per surface:
```typescript
// entrypoints/sidepanel/main.tsx:70-107 — the exact pattern to extend
useEffect(() => {
  CommandRegistry.register({ id: 'toggle-theme', name: 'Toggle Theme', description: '...', category: 'Appearance', action: () => { ... } });
  CommandRegistry.register({ id: 'open-full-app', name: 'Open in Full Tab', ... });  // RENAME id → 'open-standalone-view', wire to WorkspaceRouter.openStandalone
  CommandRegistry.register({ id: 'reload-extension', ... action: () => chrome.runtime.reload() });
  return () => {
    CommandRegistry.unregister('toggle-theme');
    CommandRegistry.unregister('open-full-app');   // update to match renamed id
    CommandRegistry.unregister('reload-extension');
  };
}, []);
```

**`handleOpenStandalone` — D-05 target (the actual `window.close()` site, CONFIRMED at `entrypoints/sidepanel/main.tsx:34-39`, NOT in `SidepanelChat.tsx` as CONTEXT.md's line citation implies — verify against src before acting, per VAI-08):**
```typescript
// entrypoints/sidepanel/main.tsx:11-40 — CURRENT (to be replaced per D-04/D-05)
const handleOpenStandalone = async () => {
  const url = chrome.runtime.getURL('standalone.html');
  try {
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs.find((t) => t.url && (t.url === url || t.url.includes('standalone.html')));
    if (existingTab?.id !== undefined) {
      await chrome.tabs.update(existingTab.id, { active: true });
      if (existingTab.windowId !== undefined) await chrome.windows.update(existingTab.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url });
    }
  } catch {
    window.open(url, '_blank');
  }
  // 2. Close side panel when standalone view is opened   ← D-05: REPLACE with mirror-banner state, not window.close()
  try { window.close(); } catch { /* ignore */ }
};
```
Note: this file ALREADY does its own ad-hoc tab-dedup (`chrome.tabs.query({})` + manual `.find()`) rather than calling `WorkspaceRouter.openFullApp`/`openStandalone` — D-04's wiring should replace this local duplicate logic with a call to `WorkspaceRouter.openStandalone(workspaceId, conversationId, page)`, which has its OWN (currently broken — points at `app.html`) dedup logic. Don't maintain two dedup implementations.

**Standalone's symmetric "Focus Side Panel" pattern already exists** (`entrypoints/standalone/main.tsx:34-43`, D-06 target is closer than CONTEXT.md suggests):
```typescript
// entrypoints/standalone/main.tsx:34-43 — gesture-safe sidePanel.open, already correct shape
const handleOpenSidepanel = async () => {
  try {
    const win = await chrome.windows.getCurrent();
    if (win?.id !== undefined) {
      await chrome.sidePanel.open({ windowId: win.id });
    }
  } catch { /* side panel may not be available */ }
};
```
This already exists and is wired to `StandaloneWorkspace`'s `onOpenSidepanel` prop — D-06's "focus-side-panel" command should just call this existing function via `CommandRegistry.register`, not reinvent it.

---

### `src/core/workspace/WorkspaceRouter.ts` (service, request-response) — D-04/D-07

**Analog:** itself, full 47-line file:

```typescript
// src/core/workspace/WorkspaceRouter.ts:6-33 — CURRENT, confirms CONTEXT.md's claim: app.html target
export function openFullApp(workspaceId: string, conversationId?: string, page?: string): void {
  const params = new URLSearchParams();
  params.set('workspaceId', workspaceId);
  if (conversationId) params.set('conversationId', conversationId);
  if (page) params.set('page', page);
  const url = chrome.runtime.getURL(`app.html?${params.toString()}`);   // ← D-07: app.html → standalone.html
  publish(WORKSPACE_CHANNEL, { type: 'FULL_APP_OPEN', workspaceId, conversationId, page });
  chrome.tabs.query({ url: chrome.runtime.getURL('app.html') }, (tabs) => {   // callback style, not async/await
    if (tabs.length > 0 && tabs[0].id) {
      chrome.tabs.update(tabs[0].id, { active: true });
      useWorkspaceStore.getState().setOpenedFullAppTabId(tabs[0].id);
    } else {
      chrome.tabs.create({ url }, (tab) => {
        if (tab.id) useWorkspaceStore.getState().setOpenedFullAppTabId(tab.id);
      });
    }
  });
}

export function hydrateFromURL(searchParams: URLSearchParams): void {
  const wsId = searchParams.get('workspaceId');
  const convId = searchParams.get('conversationId');
  const store = useWorkspaceStore.getState();
  if (wsId) Object.assign(store, { workspaceId: wsId });   // NOTE: direct mutation via Object.assign on getState() result —
  if (convId) store.setConversationId(convId);              // does NOT go through zustand's set()/immer; likely a bug to preserve-or-fix
}
```
**Important existing gap for the planner:** `hydrateFromURL` already exists (D-04 doesn't need to invent it) but its `workspaceId` assignment bypasses the store's `set()` (uses `Object.assign` on the raw state object returned by `getState()`), which will NOT trigger persist/subscribers. The `conversationId` path correctly uses `setConversationId()` (which does go through `set()` + increments `version`). This asymmetry should be fixed as part of D-04/D-16 wiring — add a proper `setWorkspaceId` action instead of `Object.assign`.

**Function naming convention to follow:** module-level exported functions (not a class/object), callback-based chrome.tabs API (not promisified) — matches the file's existing style; D-04's `openStandalone` rename should keep this same callback shape unless promisifying is a deliberate improvement.

---

### `src/core/workspace/WorkspaceStore.ts` (store, CRUD) — D-16 `isPrimaryWriter()`

**Analog:** itself, full 121-line file. The exact `persist(immer(...))` shape to extend with `isPrimaryWriter`:

```typescript
// src/core/workspace/WorkspaceStore.ts:50-52, 97-105 — action pattern to follow for isPrimaryWriter (D-16)
export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    immer((set) => ({
      ...initialState,
      bumpVersion: () => set((state) => { state.version++; }),
      reset: () => set((state) => { Object.assign(state, { ...initialState, workspaceId: crypto.randomUUID() }); }),
    })),
    { name: 'np_workspace_store', partialize: (state) => ({ /* explicit allow-list, no version/migrate yet */ }) },
  ),
);
```
`isPrimaryWriter(): boolean` is a plain function (not a `set()`-based action, since it has no side effect) — it should be added alongside the store definition, e.g. `export function isPrimaryWriter(): boolean { return true; }` (module-level export, matching the file's existing module-export style for `TabContext`/`ActiveSurface` types) rather than shoehorned into the Zustand action map. **`ActiveSurface` type today is `'sidepanel' | 'full-app'`** — D-07's rename to "standalone" naming must update this union too (currently NOT `'sidepanel' | 'standalone'`).

**Persist config gap confirmed:** no `version`/`migrate` key exists today (line 107-119) — D-22 must add both; this store currently uses name `np_workspace_store` (not `np_workspace` as CONTEXT.md's storage diagram implies) — verify exact storage key before writing migration code.

---

### `src/core/theme/ThemeStore.ts` + `ThemeSync.ts` (store + hook) — D-10

**Analog:** itself. Current persist target CONFIRMED as `chromeStorageAdapter` (local storage, name `np_theme_store`) — matches CONTEXT.md's claim exactly:

```typescript
// src/core/theme/ThemeStore.ts:78-83 — CURRENT persist config (D-10 target: sync.np_theme, not local.np_theme_store)
{
  name: 'np_theme_store',
  storage: createJSONStorage(() => chromeStorageAdapter),   // chromeStorageAdapter today = chrome.storage.LOCAL only
  partialize: (state) => ({ mode: state.mode, colorTheme: state.colorTheme }),
}
```
**No `pack` field exists yet** — D-10 requires adding it (`colorTheme` is the closest existing analog field: a plain string persisted alongside `mode`). Add `pack: string` next to `colorTheme` using the identical `set()` + `applyThemeDom`-adjacent pattern (`setColorTheme` at lines 54-65 is the template for a new `setPack` action).

**Dual-broadcast pattern already exists and works** — `setMode`/`setColorTheme` call `publish('np_theme', ...)` directly (ThemeStore.ts:49-51, 62-63) AND `ThemeSync.ts` separately exposes `publishThemeChange`/`publishColorThemeChange` wrapping the same `publish()` call — this is redundant (two call sites for the same broadcast). D-10's authoritative-source change should consolidate: keep ONE publish path (prefer the store's inline `publish()` calls since `useThemeSync()`'s subscribe-side is the one that must stay, not the duplicate publish helpers).

`useThemeSync()` hook pattern (`ThemeSync.ts:16-63`) — subscribe to `BroadcastBus('np_theme')`, guard against redundant `setMode` calls with a `!== ` check before re-invoking the setter (prevents publish-loop), and drive `document.documentElement` CSS vars directly. This is the exact pattern `chrome.storage.onChanged` cross-surface listening (D-10's sync-storage requirement) should be ADDED alongside, not replace — `useThemeSync` stays for the auxiliary BroadcastChannel path per D-10's "MAY be retained additionally."

---

### `src/core/theme/chromeStorageAdapter.ts` (utility, file-I/O) — D-22 debounce target

**Analog:** itself, full 30-line file:

```typescript
// src/core/theme/chromeStorageAdapter.ts:5-29 — CURRENT, no debounce, writes on every setItem call
export const chromeStorageAdapter: StateStorage = {
  getItem: async (name) => hasChromeStorage ? (await chrome.storage.local.get(name))[name] ?? null : localStorage.getItem(name),
  setItem: async (name, value) => hasChromeStorage ? chrome.storage.local.set({ [name]: value }) : localStorage.setItem(name, value),
  removeItem: async (name) => hasChromeStorage ? chrome.storage.local.remove(name) : localStorage.removeItem(name),
};
```
D-22's trailing-debounce + `beforeunload`/`visibilitychange` flush wraps `setItem` specifically — the `getItem`/`removeItem` paths stay untouched. This is the SAME adapter `useExtensionStore` and `WorkspaceStore` need to adopt (today `WorkspaceStore` doesn't use `chromeStorageAdapter` at all — it uses zustand's default `persist` storage, i.e., implicit `localStorage`, NOT chrome.storage; confirm this gap before wiring D-22, since WorkspaceStore currently has no `storage:` key specified at all, unlike ThemeStore which explicitly sets `storage: createJSONStorage(() => chromeStorageAdapter)`).

---

### `src/core/commands/CommandRegistry.ts` (store, CRUD) — D-08 base-set registration

**Analog:** itself, full 51-line file. Note the `register()` THROWS on duplicate id (line 13-14) — any D-08 registration code in `sidepanel/main.tsx`/`standalone/main.tsx` MUST unregister in `useEffect` cleanup (already done, see pattern above) or a hot-reload double-register will throw. `search(query)` (lines 31-41) is the exact filter logic `CommandPalette.tsx` duplicates inline (lines 15-23) — currently two independent implementations of the same substring match; not a blocker for Phase 1 but worth flagging as duplication.

---

### `src/components/common/CommandPalette.tsx` (component, request-response) — D-08 (reused, unmodified)

**Analog:** itself, full 128-line file (confirmed 127-128 lines per CONTEXT.md). Zero code changes required — only the commands passed via `CommandRegistry.getAll()` change. Existing UI-SPEC-relevant excerpts already verbatim-match UI-SPEC's Copywriting Contract:
```typescript
// CommandPalette.tsx:77, 88-90 — kept verbatim per UI-SPEC
placeholder="Search commands…"
"No matching commands — try a different search term"
```
One UI-SPEC gap: current active-row highlight uses a hardcoded fallback `'#e6f4ff'` (line 106) instead of an AntD token — `var(--color-primary-bg, #e6f4ff)` — this is flagged by UI-SPEC's Visual Anchors section ("replaces the scaffold's hardcoded `#e6f4ff`") as a Phase 1 cleanup item; should become `token.colorPrimaryBg` via `theme.useToken()` (see `SidepanelChat.tsx:30` for the established `const { token } = theme.useToken();` pattern already used elsewhere in the codebase).

---

### `src/components/common/OnboardingWizard.tsx` → `src/components/OnboardingModal.tsx` (component, request-response) — D-01/D-02/D-03

**Analog:** itself (1006 lines) — confirmed exact locations for the two required strips:

```typescript
// OnboardingWizard.tsx:99-108 — the 10s auto-advance to DELETE (D-02)
useEffect(() => {
  let timer: ReturnType<typeof setTimeout>;
  if (step === 4) {          // NOTE: current step numbering differs from D-01's target step numbering — verify before wiring
    timer = setTimeout(() => {
      // advances to next step automatically
    }, 10000);
  }
  return () => clearTimeout(timer);
}, [step]);
```
```typescript
// OnboardingWizard.tsx:17 — motion import to KEEP (grep gate only excludes literal "framer-motion")
import { motion, AnimatePresence } from 'motion/react';
```
```typescript
// OnboardingWizard.tsx:515-558 — "Test connection" button + connectionTested gate — the pattern D-03 replaces
const [connectionTested, setConnectionTested] = useState<boolean>(false);
// ... button onClick currently does a fake setTimeout-based always-success test (per CONTEXT D-03's claim at :112-119
//     — NOT found verbatim at that exact line range in the current file; the `connectionTested` state + gated
//     "Continue" button (disabled until tested) IS confirmed at lines 542-558. Re-verify exact setTimeout call site
//     before editing — CONTEXT.md's cited line numbers (112-119) point to logic that may have moved.
<Button disabled={!connectionTested} ... >Continue</Button>
```
**Structural pattern to keep:** the `motion.div` step-transition wrapper (lines 238, 486, 512, 1002) — AnimatePresence-based step transitions are the one piece of `OnboardingWizard` visual behavior D-01 doesn't ask to remove; `OnboardingModal.tsx` (thinned to 4 steps) should keep the same `motion.div` transition wrapper pattern, just around fewer `<Steps>`.

**New file's closest structural sibling for AntD Modal shape:** `CommandPalette.tsx`'s `<Modal open onCancel footer={null} width={...} centered destroyOnHidden>` (lines 67-74) is the canonical AntD v6 Modal-prop pattern already used correctly in this codebase (`open`/`destroyOnHidden`, NOT the deprecated `visible`/`destroyOnClose`) — `OnboardingModal.tsx` should copy this exact prop set (per UI-SPEC Visual Anchors: `width={520}`, `centered`, `destroyOnHidden`, `footer={null}` with custom footer).

---

### `src/components/chat/SidepanelChat.tsx` (component, request-response) — D-05/D-11 consumer

**Analog:** itself, full 443-line file. Confirms:
- `onOpenStandalone` is a passed-in prop (line 19, 25), invoked at lines 283 (`ChatHeader`) and 333 (`ChatMessageList`) — the actual `window.close()` side effect is NOT inside this file; it lives in the caller, `entrypoints/sidepanel/main.tsx:36` (see above). This file only forwards the callback — D-05's mirror-banner UI (composer disable + banner) belongs in THIS file (`SidepanelChat.tsx`) since it owns the composer/message-list render tree, while the `window.close()` removal is in `entrypoints/sidepanel/main.tsx`.
- `onboardingComplete === null` loading-state pattern (lines 262-268) is the exact "Loading workspace…" copy UI-SPEC requires verbatim — already correct, no change needed:
```typescript
// SidepanelChat.tsx:262-268 — matches UI-SPEC Copywriting Contract verbatim, KEEP as-is
if (onboardingComplete === null) {
  return (
    <div className="flex items-center justify-center h-full bg-white dark:bg-zinc-900">
      <div className="text-zinc-400 text-sm">Loading workspace…</div>
    </div>
  );
}
```
- `<OnboardingWizard open={onboardingOpen} onComplete={handleOnboardingComplete} />` (lines 412-415) is the mount point that must become `<OnboardingModal open={...} onComplete={...} />` — same two-prop contract, just a rename + import swap (`import { OnboardingWizard } from '../common/OnboardingWizard';` at line 5 → `import { OnboardingModal } from '../OnboardingModal';`).
- `onShare` handler (line 327-330) does `navigator.clipboard.writeText(text); antMessage.success('Link copied to clipboard')` — this is the "mislabeled Share→Link copied" demo-content the addendum flags for SidepanelChat strip (§1 table); not explicitly in a numbered D- decision but flagged in the addendum's Strip column.

---

### `src/components/standalone/StandaloneWorkspace.tsx` → `StandaloneShell.tsx` (component) — D-07

**Analog:** itself, full 61-line file (confirmed 61 lines exactly matches CONTEXT.md). Rename target + `hydrateFromURL` integration point:
```typescript
// StandaloneWorkspace.tsx:14-20 — component signature to extend with hydrateFromURL on mount
export const StandaloneWorkspace: React.FC<StandaloneWorkspaceProps> = ({ onOpenOptions, onOpenSidepanel }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState<WorkspaceTab>('Chat');
  // D-07a: add useEffect(() => { WorkspaceStore.hydrateFromURL(new URLSearchParams(window.location.search)); }, []) here
  ...
```
Heavy Tailwind `className` usage throughout (`h-full w-full flex ... bg-[#eceef0] dark:bg-zinc-950 font-sans`, line 22) — this file is NOT in the D-18 "must convert" hot path per the addendum (§6 lists `StandaloneWritePage`/`ToolsGridPanel`/etc as out-of-scope-for-now), but since `StandaloneWorkspace` itself IS in §1 scope, its Tailwind usage DOES need conversion to satisfy the D-18 grep gate on `tailwind` in `package.json` (the gate is on the dependency, not per-class usage — but the CSS utility classes will silently no-op once Tailwind is removed, so visual regression is likely). Flag for planner: this file's rename task should include a pass converting `className="..."` Tailwind utility strings to inline `style`/AntD tokens, or accept the visual regression risk noted in D-18's reversibility rationale.

---

### `src/components/standalone/WorkspaceSidebar.tsx` (component, reused) — chrome only per addendum §1

**Analog:** itself, full 301-line file. Confirms addendum's "Sider chrome only (240/72 px)" framing is aspirational — actual current widths are `w-16`/`w-[230px]` (line 121-122), not exactly 72/240px from DESIGN_SYSTEM §8.2. This file is ENTIRELY Tailwind-className-driven (every visual style is a `className` string, zero inline `style`/AntD tokens) — the single heaviest D-18 conversion burden in the §1 scope list. Planner should budget this as the largest strip task in Plan 3.

---

### `src/store/useExtensionStore.ts` (store, CRUD) — D-11/D-12/D-22 confirmed line-level

**Analog:** itself, full 951-line file. Confirmed via grep (not full read, per large-file strategy):
```
Line 31, 70: proxyUrl / openAiBaseUrl = 'http://localhost:12380/v1'   (D-12 target — remove as canonical default)
Line 74:     themeMode: 'Auto'                                        (D-10 target — the 2nd theme-state source to strip)
Line 84:     const INITIAL_SESSIONS: ChatSession[] = [ ... ]           (D-11 target — empty to [])
Line 320:    const INITIAL_WRITE_HISTORY: WriteHistoryItem[] = [ ... ] (D-11 target — empty to [])
Line 377:    const INITIAL_NOTES: NoteItem[] = [ ... ]                 (D-11 target — empty to [])
Line 561:    persist(                                                  (no version/migrate keys found — D-22 target)
Line 569-576: sessions: INITIAL_SESSIONS, writeHistory: INITIAL_WRITE_HISTORY, notes: INITIAL_NOTES, activeSession: INITIAL_SESSIONS[0]
Line 582-583: if (updates.themeMode) { const targetMode = updates.themeMode.toLowerCase() as ThemeMode; ... }  (D-10 bridging-code to delete)
```
This confirms every CONTEXT.md D-10/D-11/D-12/D-22 line citation against the real file — all verified present. `activeSession: INITIAL_SESSIONS[0]` (line 576) is an important dependency: once `INITIAL_SESSIONS` becomes `[]`, this becomes `undefined` — the planner must handle the type/null-safety fallout of `activeSession` losing its non-null default, likely requiring `ChatSession | null` typing (ties into the D-21 strict-mode sweep).

---

### `src/services/aiProvider.ts` (service, streaming) — D-12

**Analog:** itself, full 354-line file. Confirmed via grep:
```
Line 101: async function simulateStreamResponse(...)     — the gate target
Lines 234, 267, 283: await simulateStreamResponse(...)    — three call sites, all need the DEMO_MODE + import.meta.env.DEV gate
```
No existing `DEMO_MODE` config key found in this file — D-12 introduces it fresh; the nearest analog for "a config-driven feature flag guarding a code path" in this codebase is `useExtensionStore`'s `config` object pattern (plain object properties read via `useExtensionStore.getState().config.xxx`), which is where `DEMO_MODE` should likely live as a new config field, mirroring how `themeMode`/`proxyUrl` are already config-object members.

---

## Shared Patterns

### Zustand persist(immer(...)) store shape
**Source:** `src/core/workspace/WorkspaceStore.ts`, `src/core/theme/ThemeStore.ts`, `src/store/useExtensionStore.ts` (all three)
**Apply to:** any store touched by D-16 (isPrimaryWriter), D-10 (pack field), D-22 (version/migrate)
```typescript
create<State>()(
  persist(
    immer((set, get) => ({ /* state + actions via set((state) => { state.x = y }) */ })),
    { name: 'np_xxx', storage?: createJSONStorage(() => chromeStorageAdapter), partialize: (state) => ({ /* explicit allow-list */ }) },
  ),
);
```
**Gotcha:** `WorkspaceStore.ts` has NO `storage:` key (defaults to zustand's built-in, effectively `localStorage` in a browser context — NOT chrome.storage) while `ThemeStore.ts` DOES specify `chromeStorageAdapter`. D-22's "add debounce to chromeStorageAdapter" only helps stores that actually use it — confirm `WorkspaceStore` is migrated onto `chromeStorageAdapter` as part of D-22, or the debounce work won't apply to it.

### Cross-surface BroadcastBus pub/sub
**Source:** `src/core/runtime/BroadcastBus.ts` (untouched infra) + `src/core/theme/ThemeSync.ts` (consumer pattern) + `src/core/workspace/WorkspaceSync.ts` (consumer pattern, thinner)
**Apply to:** D-04 (workspace handoff), D-10 (theme propagation)
```typescript
// subscribe pattern (ThemeSync.ts:37-48)
useEffect(() => {
  const unsubscribe = subscribe<MsgType>('channel_name', (msg) => { /* guard: only act if state actually differs */ });
  return unsubscribe;
}, []);
// publish pattern (ThemeStore.ts:49-51)
if (typeof BroadcastChannel !== 'undefined') { publish('channel_name', { type: '...', ...payload }); }
```
Self-message suppression via `INSTANCE_ID` is automatic (`BroadcastBus.ts:12-15, 26-29`) — publishers/subscribers never need to filter their own messages manually.

### Empty-handler failure tolerance at edges
**Source:** `entrypoints/background.ts:10,15,24`, `entrypoints/standalone/main.tsx:40-42`
**Apply to:** any new `chrome.*` promise call added during D-04/D-06/D-13 wiring
```typescript
someChromeApiCall().catch(() => { /* one-line comment explaining why swallow is safe */ });
```

### Command registration in useEffect with matching cleanup
**Source:** `entrypoints/sidepanel/main.tsx:70-107`, `entrypoints/standalone/main.tsx:50-76`
**Apply to:** D-08 Flow 10 base-set registration in both surfaces
```typescript
useEffect(() => {
  CommandRegistry.register({ id, name, description, category, action });
  // ...repeat per command
  return () => { CommandRegistry.unregister(id); /* ...repeat per command */ };
}, []);
```
**Gotcha:** `CommandRegistry.register()` throws on duplicate `id` (`CommandRegistry.ts:13-14`) — hot-reload/remount without the cleanup running first will crash. Always pair register with an unmount cleanup.

## No Analog Found

None — every file in `01-PLANNING-ADDENDUM.md` §1/§3 scope exists in the current codebase and was read directly. The two genuinely NEW files (`OnboardingModal.tsx`, `BackgroundRouter.ts`) both have clear sibling patterns documented above (OnboardingWizard's own body being thinned; MessageBus's own init/register shape being wrapped) — no external RESEARCH.md-only pattern was needed.

## Metadata

**Analog search scope:** `entrypoints/`, `src/components/`, `src/core/`, `src/store/`, `src/services/` (repo root, WXT default per D-07a)
**Files scanned:** 23 read in full or via targeted grep (background.ts, sidepanel/main.tsx, standalone/main.tsx, MessageBus.ts, RuntimeEnvelope.ts, BroadcastBus.ts, WorkspaceStore.ts, WorkspaceRouter.ts, WorkspaceSync.ts, ThemeStore.ts, ThemeSync.ts, chromeStorageAdapter.ts, CommandRegistry.ts, Registry.ts, CommandPalette.tsx, ThemeToggle.tsx, StandaloneWorkspace.tsx, WorkspaceSidebar.tsx, SidepanelChat.tsx (partial + grep), OnboardingWizard.tsx (grep + targeted), useExtensionStore.ts (grep), aiProvider.ts (grep))
**Pattern extraction date:** 2026-08-19
**Key verification note (VAI-08 compliance):** several CONTEXT.md line-number citations were found to be approximate or slightly stale against the current file state (e.g., `WorkspaceRouter.ts` line numbers matched exactly; `OnboardingWizard.tsx`'s D-03 "1s always-success test" citation at `:112-119` was not confirmed verbatim at that exact range — the `connectionTested` gate logic was found nearby at lines 515-558 instead). Planner should re-grep before editing rather than trusting CONTEXT.md's line numbers as exact.
