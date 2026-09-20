---
last_mapped_commit: fa9f6508dff633ac15be7548c3cde08535e4bab5
last_mapped_at: 2026-09-20
---
<!-- refreshed: 2026-09-20 -->

# Architecture

**Analysis Date:** 2026-09-20

## System Overview

NowPilot is a Chrome MV3 extension built with WXT 0.20 + React 19 + Ant Design 6, with four runtime contexts: a non-persistent background service worker, an extraction-only content script, and three React UI surfaces (Side Panel, Standalone workspace tab, Options page). All cross-context coordination flows through typed `RuntimeEnvelope` messages, BroadcastChannel buses, or `chrome.storage` — never through shared module instances (each context gets its own JS realm).

```text
┌───────────────────────────────────────────────────────────────────────────┐
│              Browser/Extension Contexts (separate JS realms)              │
├──────────────────┬──────────────────┬───────────────┬─────────────────────┤
│ Side Panel       │ Standalone tab   │ Options tab   │ Background SW       │
│ `entrypoints/    │ `entrypoints/    │ `entrypoints/ │ `entrypoints/       │
│  sidepanel/`     │  standalone/`    │  options/`    │  background.ts`     │
│ SidepanelChat    │ StandaloneShell  │ OptionsPage   │ BackgroundRouter    │
├──────────────────┴──────────────────┴───────────────┼─────────────────────┤
│         Shared framework: `src/core/*`               │ MessageBus dispatch │
│  runtime · messaging · workspace · theme ·           │ (advisory handlers) │
│  commands · registry · events · log                  │                     │
├──────────────────────────────────────────────────────┴─────────────────────┤
│ Shared state: `src/store/useExtensionStore.ts` (zustand+immer+persist),    │
│ `src/core/workspace/WorkspaceStore.ts`, `src/core/theme/ThemeStore.ts`     │
│ Shared services: `src/services/aiProvider.ts` (SSE streaming fetch)        │
├────────────────────────────────────────────────────────────────────────────┤
│ Platform: chrome.storage.local/sync (debounced adapters) · BroadcastChannel│
│ (`np_theme`, `np_workspace`) · chrome.tabs/sidePanel/runtime APIs          │
├────────────────────────────────────────────────────────────────────────────┤
│ Content Script (ISOLATED, no UI): `entrypoints/content/core.content.ts`    │
│ sends CONTENT_SCRIPT_READY / SPA_NAVIGATION envelopes to background        │
└────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Background SW | Registers the single message entry (`BackgroundRouter.register()`), side panel click behavior, onboarding flag init | `entrypoints/background.ts` |
| Message dispatch | Envelope validation, handler registry, `chrome.runtime.onMessage` listener, `Promise.allSettled` fan-out | `src/core/messaging/MessageBus.ts` |
| Background router | Typed wrapper; pre-registers `CONTENT_SCRIPT_READY` / `SPA_NAVIGATION` advisory handlers; idempotent module flag | `src/core/messaging/BackgroundRouter.ts` |
| Envelope contract | `MessageTypeValues` union, `createEnvelope()`, `isEnvelope()` guard, `PageHtmlPayload` shape | `src/core/runtime/RuntimeEnvelope.ts` |
| Cross-surface bus | `BroadcastChannel` wrapper with per-instance echo suppression (`_sender` id) | `src/core/runtime/BroadcastBus.ts` |
| Content script | SPA navigation detection via `MutationObserver` + `wxt:locationchange`; sends envelopes; zero UI, zero `fetch(` | `entrypoints/content/core.content.ts` |
| Side Panel shell | Chat UI, command palette, theme sync, onboarding/mirror state | `entrypoints/sidepanel/main.tsx`, `src/components/chat/SidepanelChat.tsx` |
| Standalone shell | Workspace nav (Chat/Tools/Note/Write/Teams), URL hydration, settings | `src/components/standalone/StandaloneShell.tsx`, `entrypoints/standalone/main.tsx` |
| Options page | Provider/model config, translation, prompts tabs | `src/components/options/OptionsPage.tsx`, `entrypoints/options/main.tsx` |
| Workspace store | Cross-surface handoff state (`workspaceId`, `conversationId`, `activeSurface`, pinned tabs), persisted | `src/core/workspace/WorkspaceStore.ts` |
| Workspace router | Open/focus Standalone & Options tabs (dedup), hydrate store from query string, publish handoff | `src/core/workspace/WorkspaceRouter.ts` |
| Workspace sync | `np_workspace` BroadcastChannel message types (`WORKSPACE_UPDATED`, `STANDALONE_OPEN`, `WORKSPACE_HANDOFF`) | `src/core/workspace/WorkspaceSync.ts` |
| Theme store | `mode`/`colorTheme`/`pack`, DOM class + CSS var application, persisted to `chrome.storage.sync` | `src/core/theme/ThemeStore.ts` |
| Theme sync | Bidirectional cross-surface theme propagation (`np_theme` broadcast + `chrome.storage.onChanged`) | `src/core/theme/ThemeSync.ts` |
| Storage adapters | 300 ms trailing-debounce `chrome.storage.local` / `.sync` `StateStorage` with lifecycle flush and localStorage fallback | `src/core/theme/chromeStorageAdapter.ts` |
| Main app store | Chat sessions, messages, prompts, write history, notes, attachments, provider config | `src/store/useExtensionStore.ts` |
| AI streaming | SSE SSE parse loop, provider endpoint building, demo simulator gated by `demoMode && import.meta.env.DEV` | `src/services/aiProvider.ts` |
| Chat streaming hook | Wires store mutations to `streamChatResponse` callbacks, abort handling | `src/components/chat/useChatStreaming.ts` |
| Command registry | Global command map + search/execute; duplicate-id throws; `Cmd/Ctrl+K` palette | `src/core/commands/CommandRegistry.ts`, `src/core/commands/registerWorkspaceCommands.ts` |
| Add-on/page registry | Addon registration fan-out to Side Panel / Standalone page registries | `src/core/registry/Registry.ts`, `src/core/registry/AddonRegistry.ts` |
| Event bus | In-realm pub/sub (`on`/`emit`/`off`/`hasListeners`) | `src/core/events/EventBus.ts` |
| Theme tokens | AntD `ThemeConfig` packs, semantic/component tokens, algorithms, CSS vars | `src/theme/index.ts`, `src/theme/packs/claudePlus.ts` |
| Theme provider | Single `ConfigProvider` > `XProvider` wrapper + system dark-mode tracking | `src/components/ThemeProvider.tsx` |
| Diagnostics | Ring-buffer log (200 entries) + `console.debug` | `src/core/log/debugLog.ts` |

## Pattern Overview

**Overall:** Layered extension architecture with isolated UI surfaces, a shared core-framework layer, and message/broadcast-based cross-context coordination.

**Key Characteristics:**

- **Surface isolation:** `src/components/chat/`, `src/components/standalone/`, and `src/components/options/` may not import from each other; shared code lives in `src/core/`, `src/services/`, `src/types/`, or `src/components/common/`. Enforced by `tests/isolation/cross-entrypoint-imports.test.ts`.
- **Module-function registries over classes:** core primitives (`MessageBus`, `EventBus`, `BroadcastBus`, `CommandRegistry`, `KeymapRegistry`, `AddonRegistry`) are module-level singleton maps with `register`/`unregister` returning cleanup functions.
- **No shared runtime memory between contexts:** every store in `src/store/` and `src/core/*/` is per-realm; cross-surface state travels only via `chrome.storage` or `BroadcastChannel`.
- **Zustand + immer + persist everywhere:** three persisted stores, all routed through the same debounced storage adapters.
- **Typed envelopes at context boundaries:** `RuntimeEnvelope<T>` with `type`, `operationId`, `timestamp`, `source`, `payload`; `isEnvelope()` validates before dispatch.
- **Streaming stays in UI contexts:** provider fetch/SSE runs in Side Panel / Standalone React roots, never in the background SW.
- **Styling strictly AntD tokens + CSS vars:** Tailwind is banned; `scripts/verify-no-tailwind.sh` enforces zero utility-class leakage.
- **Dual build system:** WXT builds the extension (`entrypoints/` + `wxt.config.ts`); Vite config builds the same React roots plus `index.html` + `src/main.tsx` as a browser-only dev shell for a three-view preview.

## Layers

**Entry Points (WXT):**

- Purpose: Declare extension contexts and their manifest metadata
- Location: `entrypoints/`
- Contains: `background.ts` (service worker), `content/core.content.ts` (ISOLATED content script), `sidepanel/`, `standalone/`, `options/` HTML + React roots
- Depends on: `src/core/*`, `src/components/*`, `wxt.config.ts`
- Used by: WXT build → `.output/chrome-mv3/`

**Browser Dev Shell (Vite):**

- Purpose: Preview all three views in a normal browser during UI work
- Location: `index.html`, `src/main.tsx`, `vite.config.ts`
- Contains: `AppShell` with a header `Segmented` switcher between Workspace / Sidepanel Chat / Options
- Depends on: same `src/components/*` roots as the extension
- Used by: `pnpm dev` / `pnpm build` (not shipped as the extension)

**Surface UI:**

- Purpose: Per-surface React component trees
- Location: `src/components/{chat,standalone,options,notes,history}/`, `src/components/OnboardingModal.tsx`, `src/components/ThemeProvider.tsx`
- Contains: chat composer/message list/streaming hook; workspace shell/sidebar/write page; options page + prompts tabs; 4-panel notes workspace; history modals
- Depends on: `src/core/*`, `src/store/*`, `src/services/*`, `src/types`
- Used by: entrypoints; Standalone reuses `SidepanelChat` with `isStandalone` flag (read-only reuse, no cross-import between surfaces)

**Shared UI:**

- Purpose: Components used by two or more surfaces
- Location: `src/components/common/`
- Contains: `CommandPalette`, `ThemeToggle`, `ModelSelector`, `WorkflowSelector`, `MirrorBanner`, `PromptManagerModal`, `ActionPanel`, avatars
- Depends on: `src/core/*`
- Used by: chat, standalone, options surfaces

**Core Framework:**

- Purpose: Context-agnostic primitives (messaging, runtime, storage adapters, registries, logging, i18n, workspace/theme orchestration)
- Location: `src/core/`
- Contains: `messaging/`, `runtime/`, `workspace/`, `theme/`, `commands/`, `registry/`, `events/`, `input/`, `log/`, `prompts/`, `i18n/`, `components/`
- Depends on: `zustand`, `chrome` APIs, `src/theme/` (for CSS vars)
- Used by: every surface, entrypoints, tests

**State:**

- Purpose: Persisted domain state
- Location: `src/store/useExtensionStore.ts`, `src/core/workspace/WorkspaceStore.ts`, `src/core/theme/ThemeStore.ts`
- Contains: chat sessions/messages/prompts/notes/write history/provider config; workspace handoff state; theme mode/pack
- Depends on: `src/core/theme/chromeStorageAdapter.ts`, `src/types/`
- Used by: surfaces and the streaming hook

**Services:**

- Purpose: External I/O
- Location: `src/services/aiProvider.ts`
- Contains: `streamChatResponse` (SSE reader over `fetch`), `testProviderConnection`, `fetchProviderModels`, `AVAILABLE_MODELS`
- Depends on: `src/types/`, browser `fetch`, `AbortSignal`
- Used by: `src/components/chat/useChatStreaming.ts`, `src/components/options/*`

**Design Tokens:**

- Purpose: AntD v6 theme configuration and CSS custom properties
- Location: `src/theme/`, `src/index.css`
- Contains: semantic tokens, component token builder, algorithms, `claudePlus` pack, global CSS vars (`--np-primary`, `--background`, ...)
- Depends on: `antd` `ThemeConfig`
- Used by: `src/components/ThemeProvider.tsx`, `src/core/theme/ThemeStore.ts`

## Data Flow

### Primary Chat Request Path

1. User submits composer → `SidepanelChat.handleSend()` (`src/components/chat/SidepanelChat.tsx:254`) → `useChatStreaming.handleSend()` (`src/components/chat/useChatStreaming.ts:20`)
2. Hook creates user + assistant placeholder messages and commits them via `useExtensionStore` actions (`addMessageToActiveSession`)
3. Hook calls `streamChatResponse()` (`src/services/aiProvider.ts:301`) with `config`, `modelId`, filtered history, and an `AbortController` signal
4. `buildEndpointUrl()` picks Gemini `streamGenerateContent?alt=sse` or OpenAI-compatible `/chat/completions`; response body is read as an SSE stream, parsed per `data: ` line
5. Each `onChunk` calls `updateLastAssistantMessage()` (`src/store/useExtensionStore.ts:238`) which appends content/thought and bumps `activeSession`
6. `onDone`/`onError` finalize the message; store persistence flows through `chromeStorageAdapter.setItem` → 300 ms debounce → `chrome.storage.local`
7. Production failures surface via `onError`; the canned simulator only runs when `config.demoMode === true && import.meta.env.DEV === true` (`src/services/aiProvider.ts:318`)

### Cross-Surface Handoff (Side Panel → Standalone)

1. Side Panel triggers `openStandaloneWithToasts()` (`entrypoints/sidepanel/main.tsx:40`) → `WorkspaceRouter.openStandalone()` (`src/core/workspace/WorkspaceRouter.ts:20`)
2. Router builds `standalone.html?workspaceId=…&conversationId=…&page=…`, publishes `STANDALONE_OPEN` on `np_workspace`, then `chrome.tabs.query` dedups: focus + `chrome.windows.update` if present, else `chrome.tabs.create`
3. Standalone `StandaloneShell` mounts, calls `hydrateFromURL(new URLSearchParams(window.location.search))` (`src/components/standalone/StandaloneShell.tsx:30` → `WorkspaceRouter.ts:143`) which commits IDs through store actions and publishes `WORKSPACE_HANDOFF`
4. Side Panel is subscribed via `onWorkspaceSync` (`src/components/chat/SidepanelChat.tsx:209`); matching `workspaceId` sets `mirrored = true`, rendering `MirrorBanner` and disabling the composer

### Content Script → Background Messaging

1. Content script waits for `document.body`, sends `CONTENT_SCRIPT_READY` envelope via `chrome.runtime.sendMessage` (`entrypoints/content/core.content.ts:51`)
2. A `MutationObserver` plus `wxt:locationchange` listener detect SPA navigation and send `SPA_NAVIGATION` envelopes (`core.content.ts:21`)
3. `MessageBus.init()` registered synchronously by `BackgroundRouter.register()` in `entrypoints/background.ts:29` dispatches envelopes to the advisory handlers; handlers log via `console.debug` only in the current phase

### Theme Propagation

1. `useThemeStore.setMode()` toggles the `dark` class, sets `--np-primary` CSS vars, publishes on `np_theme`, and persists via `syncStorageAdapter`
2. `applyThemeToSync()` (`src/core/theme/ThemeSync.ts:102`) explicitly writes `np_theme` + `np_theme_pack` to `chrome.storage.sync`
3. Other surfaces receive `startThemeOnChangedSync()` `chrome.storage.onChanged` events and/or the `np_theme` BroadcastChannel, guarded by inequality checks to avoid write/notify loops
4. `ThemeProvider` maps mode + system preference to `claudePlusLight`/`claudePlusDark` `ThemeConfig` and wraps children in `ConfigProvider` > `XProvider`

**State Management:**

- `useExtensionStore` (`np_store`) owns chat/notes/prompts/config; `WorkspaceStore` (`np_workspace_store`) owns cross-surface IDs; `ThemeStore` (`np_theme` + `np_theme_pack` key) owns appearance
- All three use `persist` + `immer`, version `1`, throw-free `migrate` functions, and explicit `partialize`
- Ephemeral per-realm state (modal open/closed, editing IDs, palette state) stays in component `useState`

## Key Abstractions

**RuntimeEnvelope:**

- Purpose: Canonical validated message shape for every chrome.runtime message
- Examples: `src/core/runtime/RuntimeEnvelope.ts`, used by `entrypoints/content/core.content.ts`, `src/core/messaging/MessageBus.ts`
- Pattern: discriminated union of string literal `MessageType`; `createEnvelope(type, payload, source)` stamps `crypto.randomUUID()` + `Date.now()`; `isEnvelope()` rejects anything else before dispatch

**BroadcastBus channels:**

- Purpose: Same-origin cross-surface messaging where `chrome.runtime` is unnecessary
- Examples: `np_theme` (`src/core/theme/ThemeStore.ts`, `ThemeSync.ts`), `np_workspace` (`src/core/workspace/WorkspaceRouter.ts`, `WorkspaceSync.ts`)
- Pattern: lazily created per-channel `BroadcastChannel` with listener sets; payloads get a `_sender` instance id so a sender never receives its own message

**Registries:**

- Purpose: Extension-point pattern for commands, keymaps, add-ons, pages, events
- Examples: `src/core/commands/CommandRegistry.ts`, `src/core/input/KeymapRegistry.ts`, `src/core/registry/Registry.ts`, `src/core/events/EventBus.ts`
- Pattern: module-scope `Map` + `register`/`unregister`; duplicate registration throws (commands/keymaps) or overwrites by id (pages/addons); `registerWorkspaceCommands.ts` demonstrates the deps-object adapter + cleanup-function convention

**Storage adapters:**

- Purpose: Single choke point for persistence with quota-safe debouncing
- Examples: `src/core/theme/chromeStorageAdapter.ts` (`chromeStorageAdapter`, `syncStorageAdapter`, `flushPendingWrites`, `STORAGE_DEBOUNCE_MS = 300`)
- Pattern: per-key pending-write map tagged `local` vs `sync`, single trailing timer, lifecycle flush on `beforeunload` / `visibilitychange`, localStorage fallback outside the extension, `__test__` seams

**WorkspaceRouter:**

- Purpose: Own all tab open/focus/dedup and URL hydration so entrypoints never roll their own `chrome.tabs` logic
- Examples: `src/core/workspace/WorkspaceRouter.ts`
- Pattern: callback-style `{ onSettled }` result reporting; `chrome.runtime.lastError` checked at every callback level

## Entry Points

**Background service worker:**

- Location: `entrypoints/background.ts`
- Triggers: Extension install/startup, service worker wake on message
- Responsibilities: `BackgroundRouter.register()`; `chrome.sidePanel.setPanelBehavior`; `onInstalled` onboarding flag; `onStartup` re-registration

**Content script:**

- Location: `entrypoints/content/core.content.ts`
- Triggers: `<all_urls>`, `document_idle`, ISOLATED world
- Responsibilities: lifecycle `CONTENT_SCRIPT_READY` message, SPA navigation detection, cleanup on unload; no UI, no network calls

**Side Panel:**

- Location: `entrypoints/sidepanel/index.html`, `entrypoints/sidepanel/main.tsx`
- Triggers: Toolbar action (`side_panel.default_path: sidepanel.html`) or `chrome.sidePanel.open`
- Responsibilities: `SidepanelChat`, command palette (`Cmd/Ctrl+K`), theme cycle, standalone handoff toasts

**Standalone workspace:**

- Location: `entrypoints/standalone/index.html`, `entrypoints/standalone/main.tsx`
- Triggers: `chrome.tabs.create` from `WorkspaceRouter.openStandalone` or direct `standalone.html`
- Responsibilities: `StandaloneShell` (Chat/Note/Write/Tools/Teams), URL hydration, command set with gesture-safe `focus-side-panel`

**Options:**

- Location: `entrypoints/options/index.html`, `entrypoints/options/main.tsx`
- Triggers: `chrome.runtime.getURL('options.html')`; declared as `options_ui`/`options_page` in `wxt.config.ts`
- Responsibilities: `OptionsPage` (General/Translate/Prompts)

**Browser dev shell:**

- Location: `index.html` + `src/main.tsx`
- Triggers: `pnpm dev` / `vite build` (`vite.config.ts`)
- Responsibilities: header + `Segmented` view switcher rendering `StandaloneShell`, `SidepanelChat`, `OptionsPage` outside the extension

## Architectural Constraints

- **Threading:** One single-threaded JS event loop per extension context. The background SW is `persistent: false` (`entrypoints/background.ts:6`) and can be evicted at any time; all listeners that must survive re-wakes are registered synchronously inside `defineBackground.main()`.
- **Global state:** Module-level singletons live in `src/core/messaging/MessageBus.ts` (`handlers`, `initialized`), `src/core/messaging/BackgroundRouter.ts` (`registered`), `src/core/runtime/BroadcastBus.ts` (`channels`, `INSTANCE_ID`), `src/core/events/EventBus.ts` (`events`), `src/core/commands/CommandRegistry.ts` (`commands`), `src/core/input/KeymapRegistry.ts` (`keymaps`, `listening`), `src/core/registry/Registry.ts` (three maps), `src/core/registry/AddonSettingsStore.ts` (`settings`), `src/core/theme/chromeStorageAdapter.ts` (`pendingWrites`, `pendingTimer`), `src/core/log/debugLog.ts` (`logEntries`), `src/core/runtime/workerState.ts` (`workerState`). These are intentionally per-realm; do not treat them as cross-context shared state.
- **Bundle isolation:** Surface directories must not cross-import (`chat` ↔ `standalone` ↔ `options`); content script must contain zero `fetch(` calls; enforced by `tests/isolation/cross-entrypoint-imports.test.ts` with a non-vacuous self-test.
- **Entrypoint location:** `entrypoints/` sits at the repo root, adjacent to `src/` (WXT default; required so content-script imports stay relative).
- **Manifest least privilege:** `permissions: ['sidePanel', 'storage', 'tabs']`, host permissions limited to `*://*.service-now.com/*` and `*://support.servicenow.com/*` (`wxt.config.ts:36`). New permissions require explicit spec/phase ownership — never a silent manifest addition.
- **CSP allowlist:** `connect-src` permits only `http://localhost:*`, `https://generativelanguage.googleapis.com`, `https://api.anthropic.com`, `https://api.openai.com` (`wxt.config.ts:60`). New provider hosts must be added deliberately.
- **No Tailwind/shadcn/Radix:** inline styles + AntD tokens only; `scripts/verify-no-tailwind.sh` fails the build on utility-class regressions.
- **No remote code:** MV3 rules; no `eval`, no remote scripts.

## Anti-Patterns

### Cross-surface imports

**What happens:** A file in `src/components/chat/` imports from `src/components/standalone/` (or the reverse, or into `options/`).
**Why it's wrong:** It couples separately rendered bundles and is a hard test failure (`tests/isolation/cross-entrypoint-imports.test.ts`). Standalone intentionally reuses `SidepanelChat` by importing up the shared path — that is the allowed direction only because `standalone/StandaloneShell.tsx` composes `chat/SidepanelChat.tsx` as a generic component prop; do not add new chat→standalone imports.
**Do this instead:** Put shared code in `src/components/common/`, `src/core/`, `src/services/`, or `src/types/`.

### Mutating zustand state outside `set()`

**What happens:** `Object.assign(store, { workspaceId })` on a `getState()` snapshot (the historical `hydrateFromURL` bug, documented at `src/core/workspace/WorkspaceRouter.ts:125`).
**Why it's wrong:** Persistence and subscriber notifications never fire; UI silently stays stale.
**Do this instead:** Call named store actions (`setWorkspaceId`, `setConversationId`) which route through zustand `set()`.

### Fetching from the content script

**What happens:** Adding `fetch(...)` to `entrypoints/content/core.content.ts`.
**Why it's wrong:** Violates the extraction-only rule (Pitfall P3) and is gated by `tests/isolation/cross-entrypoint-imports.test.ts`. Network I/O belongs to UI contexts (`src/services/`) or background handlers (`PROXY_FETCH`).
**Do this instead:** Send an envelope and let the owning context perform the request.

### Duplicating tab dedup logic in entrypoints

**What happens:** An entrypoint calls `chrome.tabs.query`/`create` directly to open Standalone/Options.
**Why it's wrong:** Dedup, window focus, and error reporting drift between surfaces; `WorkspaceRouter` exists to be the one implementation.
**Do this instead:** Call `openStandalone()` / `openOptions()` from `src/core/workspace/WorkspaceRouter.ts` and render results through the `onSettled` callback.

### Nesting theme providers

**What happens:** Wrapping an existing `XProvider` tree with a second `ConfigProvider` (or the reverse).
**Why it's wrong:** Double-wraps theme/locale/icon context (spec §5.5). Each surface must mount exactly one provider — `ThemeProvider` already composes `ConfigProvider` > `XProvider` (`src/components/ThemeProvider.tsx:38`).
**Do this instead:** Reuse `ThemeProvider`; for plain-AntD-only trees with no X components, `ConfigProvider` alone is acceptable but never nested.

### Reusing prototype page components

**What happens:** Importing `src/components/pages/ChatPage.tsx`, `AgentPage.tsx`, `NotesPage.tsx`, or `src/components/pages/OptionsPage.tsx` (a stub duplicate using `t()` from `src/core/i18n/strings.ts`).
**Why it's wrong:** These files are unreferenced prototypes superseded by the surface components (`chat/SidepanelChat.tsx`, `standalone/StandaloneShell.tsx`, `notes/NotesWorkspace.tsx`, `options/OptionsPage.tsx`). Importing them resurrects dead code paths.
**Do this instead:** Extend the surface components under `src/components/{chat,standalone,notes,options}/`.

### Silent demo fallbacks in production

**What happens:** Calling `simulateStreamResponse` whenever a provider fetch fails.
**Why it's wrong:** Masks real provider errors and fabricates content. The simulator is hard-gated by `config.demoMode === true && import.meta.env.DEV === true` (`src/services/aiProvider.ts:318`).
**Do this instead:** Surface real failures through `onError` and render `StructuredErrorCard`.

## Error Handling

**Strategy:** Never throw across context boundaries; convert failures into typed results, toasts, or logged diagnostics.

**Patterns:**

- Envelope dispatch: `MessageBus.dispatch` isolates handler failures with try/catch + `Promise.allSettled`, then `console.error`s the collected reasons (`src/core/messaging/MessageBus.ts:40`); `init()` responds `{ ok: true }` / `{ ok: false, error }`
- AI streaming: `streamChatResponse` catches network/HTTP errors and calls `onError`; `AbortError` (user stop) returns silently (`src/services/aiProvider.ts:449`)
- Connection tests: `testProviderConnection` returns `{ ok: false, error }` built from provider status/body — API keys are never interpolated into error strings (`src/services/aiProvider.ts:165`)
- Chrome API callbacks: every `chrome.tabs`/`windows` callback checks `chrome.runtime.lastError` and reports via `onSettled` (`src/core/workspace/WorkspaceRouter.ts`)
- Store migrations: `themeMigrate`, `npStoreMigrate`, `workspaceMigrate` are throw-free and return defaults for unparseable blobs
- UI feedback: antd `App.useApp()` messages for user-visible failures; `MirrorBanner`/`StructuredErrorCard` for surface-specific states
- Diagnostics: `debugLog(code, message, context)` ring buffer + `console.debug` (`src/core/log/debugLog.ts`)

## Cross-Cutting Concerns

**Logging:** `src/core/log/debugLog.ts` for structured, code-tagged diagnostics (200-entry ring buffer); `console.debug` with eslint-disable comments for background advisory handlers; `console.error` only in `MessageBus` and AI stream catch.

**Validation:** `isEnvelope()` gate before any dispatch (`src/core/runtime/RuntimeEnvelope.ts:70`); sender identity check is documented as mandatory for future state-mutating background handlers (`src/core/messaging/BackgroundRouter.ts:8`) — currently only advisory handlers exist.

**Authentication:** No auth provider. Provider credentials (`apiKey`, proxy URLs) live inside `useExtensionStore` config persisted to `chrome.storage.local` (`np_store`); there is no secret store or encryption layer yet. Host permissions are limited to ServiceNow domains.

**Theming:** Single `claudePlus` pack, `light`/`dark`/`auto` modes, `--np-primary` CSS vars, cross-surface sync via `np_theme` + `chrome.storage.sync`.

**i18n:** `src/core/i18n/strings.ts` provides a `t()` map, currently only consumed by the unreferenced prototype pages.

---

*Architecture analysis: 2026-09-20*
