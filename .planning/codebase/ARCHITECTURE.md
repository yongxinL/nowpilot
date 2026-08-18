<!-- refreshed: 2026-08-18 -->
# Architecture

**Analysis Date:** 2026-08-18

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                      Extension Entry Points (WXT / MV3)                   │
├──────────────────────┬──────────────────────┬────────────────────────────┤
│  Background SW        │  Content Script      │  Sidepanel / Standalone /  │
│  `entrypoints/`       │  `entrypoints/`      │  Options React Surfaces    │
│  `background.ts`      │  `content.core.ts`   │  `entrypoints/*/main.tsx`  │
└──────────┬────────────┴──────────┬───────────┴──────────────┬─────────────┘
           │                       │                          │
           ▼                       ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     React UI Layer (src/components/)                      │
│     `src/components/chat/` `standalone/` `options/` `notes/` `history/`   │
│  consume Zustand stores; streaming via `useChatStreaming`                 │
└──────────┬────────────────────────────────────────────────┬──────────────┘
           │                                               │
           ▼                                               ▼
┌────────────────────────────────────────┐   ┌─────────────────────────────┐
│  State Layer (Zustand + immer)         │   │  Core Runtime Layer         │
│  `src/store/useExtensionStore.ts`      │   │  `src/core/`                │
│  `src/core/workspace/WorkspaceStore`   │   │  runtime/ messaging/ events/│
│  `src/core/theme/ThemeStore`           │   │  registry/ commands/ i18n/  │
└──────────┬─────────────────────────────┘   └──────────────┬──────────────┘
           │ persistence (chromeStorageAdapter)             │ typed envelopes
           ▼                                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Persistence & IPC                                                   │
│  `chrome.storage.local` (np_store, np_theme_store)                     │
│  BroadcastChannel (`np_theme`, `np_workspace`) via `BroadcastBus`      │
│  `chrome.runtime` messages (`MessageBus` / RuntimeEnvelope)            │
│  External AI providers (SSE) via `src/services/aiProvider.ts`          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Background service worker | Side panel behavior, install/update onboarding flag, raw message listener | `entrypoints/background.ts` |
| Content script | SPA navigation detection, page context signaling (no UI) | `entrypoints/content.core.ts` |
| Sidepanel surface | Compact chat UI + command palette + theme store wiring | `entrypoints/sidepanel/main.tsx` |
| Standalone surface | Full-tab workspace shell (sidebar nav to Chat/Tools/Note/Write/Teams) | `entrypoints/standalone/main.tsx`, `src/components/standalone/StandaloneWorkspace.tsx` |
| Options surface | Settings UI (AI providers, theme, translate, prompts) | `entrypoints/options/main.tsx`, `src/components/options/OptionsPage.tsx` |
| Chat container | Composer, message list, export, history, onboarding orchestration | `src/components/chat/SidepanelChat.tsx` |
| AI provider service | SSE streaming, model discovery, simulated fallback responses | `src/services/aiProvider.ts` |
| Main store | Sessions, messages, config, prompts, write history, notes | `src/store/useExtensionStore.ts` |
| Workspace store | Cross-surface workspace/conversation/tab state | `src/core/workspace/WorkspaceStore.ts` |
| Theme store | Mode + color theme, DOM side-effects, broadcast sync | `src/core/theme/ThemeStore.ts`, `src/core/theme/ThemeSync.ts` |
| Message routing | Typed envelope dispatch over `chrome.runtime.onMessage` | `src/core/messaging/MessageBus.ts` |
| Broadcast bus | Cross-surface pub/sub over `BroadcastChannel` | `src/core/runtime/BroadcastBus.ts` |
| Registries | Commands, keymaps, addons, sidepanel/full-app pages | `src/core/commands/CommandRegistry.ts`, `src/core/registry/Registry.ts` |
| Domain types | Message, ChatSession, ProviderConfig, NoteItem, etc. | `src/types/index.ts` |
| Theme config | Ant Design light/dark theme tokens | `src/theme/index.ts`, `src/components/ThemeProvider.tsx` |

## Pattern Overview

**Overall:** Layered browser-extension architecture: WXT entry-point layer → React UI layer → Zustand state layer → core runtime/services layer → Chrome extension primitives (storage, messaging, BroadcastChannel) and external AI provider APIs.

**Key Characteristics:**
- MV3 (non-persistent background service worker) built with WXT (`wxt.config.ts`), where each top-level `entrypoints/` file or directory becomes a build target (background, content script, and one HTML page per `main.tsx`).
- Multiple independent UI surfaces (sidepanel, standalone tab, options) that share state through persisted Zustand stores and cross-surface sync via `BroadcastChannel`.
- State layer uses Zustand + immer middleware with a custom `chromeStorageAdapter` (`src/core/theme/chromeStorageAdapter.ts`) that transparently falls back to `localStorage` outside Chrome — the same adapter is reused by all persisted stores.
- Core runtime modules are UI-framework-agnostic (no React imports except `src/core/components/` and `src/core/theme/ThemeSync.ts`), kept under `src/core/` for testability.
- UI renders with Ant Design v6 + Ant Design X (`Bubble`, `XMarkdown`), Tailwind CSS v4 for utility styling, and `@ant-design/x-markdown` for markdown rendering via the `PortableMarkdown` wrapper (`src/core/components/PortableMarkdown.tsx`).
- The chat request path is a fetch/SSE streaming loop with an in-browser simulated fallback when providers are unreachable (`src/services/aiProvider.ts`).

## Layers

**Entry Points Layer:**
- Purpose: Boot each extension surface; WXT wires them into the manifest.
- Location: `entrypoints/`
- Contains: `background.ts`, `content.core.ts`, and `sidepanel|options|standalone/main.tsx` + `index.html`
- Depends on: React, Zustand stores, `src/core/commands/CommandRegistry`, `src/components/*` shells
- Used by: Chrome extension runtime (manifest built by `wxt.config.ts`)

**UI Layer:**
- Purpose: Present chat, workspace, notes, write tools, and options; orchestrate user interaction.
- Location: `src/components/`
- Contains: surface containers (`chat/SidepanelChat.tsx`, `standalone/StandaloneWorkspace.tsx`, `options/OptionsPage.tsx`, `notes/NotesWorkspace.tsx`), sub-components, and the streaming hook `chat/useChatStreaming.ts`
- Depends on: `src/store/useExtensionStore.ts`, `src/core/*` (theme, commands, i18n, components), `src/services/aiProvider.ts`, `src/types`
- Used by: Entry point `main.tsx` files

**State Layer:**
- Purpose: Single source of truth for application data, persisted to `chrome.storage.local`.
- Location: `src/store/useExtensionStore.ts`, `src/core/workspace/WorkspaceStore.ts`, `src/core/theme/ThemeStore.ts`, `src/core/registry/AddonSettingsStore.ts`
- Contains: Zustand stores (persist + immer middleware), store-local actions
- Depends on: `src/types/index.ts`, `src/core/theme/chromeStorageAdapter.ts`, `src/core/runtime/BroadcastBus.ts`, `src/core/theme/ThemeConfig.ts`
- Used by: UI layer and core workspace/theme sync modules

**Core Runtime Layer:**
- Purpose: Transport, messaging, eventing, registries, i18n, logging, domain-neutral infrastructure.
- Location: `src/core/`
- Contains: `runtime/` (RuntimeEnvelope, PortReader, BroadcastBus, workerState, OperationId), `messaging/MessageBus.ts`, `events/EventBus.ts`, `workspace/`, `theme/`, `registry/`, `commands/`, `input/KeymapRegistry.ts`, `prompts/`, `i18n/strings.ts`, `log/debugLog.ts`, `components/`
- Depends on: Chrome APIs (`chrome.runtime`, `chrome.storage`), browser globals (`BroadcastChannel`, `crypto`, `document`)
- Used by: UI layer, state layer, entry points, tests

**Service Layer:**
- Purpose: External communication (AI providers).
- Location: `src/services/aiProvider.ts`
- Contains: `streamChatResponse` (SSE), `fetchProviderModels`, `AVAILABLE_MODELS`, `simulateStreamResponse`
- Depends on: `src/types`, global `fetch`
- Used by: `src/components/chat/useChatStreaming.ts`

## Data Flow

### Primary Request Path (Chat Message Streaming)

1. User submits in composer — `SidepanelChat.handleSend` (`src/components/chat/SidepanelChat.tsx:219`) calls `streamSend`.
2. `useChatStreaming.handleSend` appends user + assistant placeholder messages to the active session, sets `isGenerating`, creates an `AbortController` (`src/components/chat/useChatStreaming.ts:20-66`).
3. `streamChatResponse` (`src/services/aiProvider.ts:219`) builds the provider endpoint (`buildEndpointUrl` at `aiProvider.ts:91`), POSTs, and reads the SSE stream (`data:` lines) until `[DONE]`; on fetch/HTTP failure it runs `simulateStreamResponse` (`aiProvider.ts:101`) as fallback.
4. Chunks arrive via `onChunk`/`onDone` callbacks → `updateLastAssistantMessage` in `src/store/useExtensionStore.ts:651` mutates the last assistant message (content + `thoughtProcess` + versions), which persists through the immer set.
5. React re-renders `ChatMessageList` (`src/components/chat/ChatMessageList.tsx`) from the updated store; user can abort via `handleStopGenerating` (`useChatStreaming.ts:91`).

### Cross-Surface Sync (Theme / Workspace)

1. `useThemeStore.setMode` / `setColorTheme` apply DOM effects and `publish('np_theme', ...)` (`src/core/theme/ThemeStore.ts:35`).
2. `BroadcastBus.publish` posts to a named `BroadcastChannel`, tagging the message with the emitting `INSTANCE_ID` so self-messages are ignored (`src/core/runtime/BroadcastBus.ts:55`).
3. Each surface's `ThemeProvider` calls `useThemeSync()` (`src/core/theme/ThemeSync.ts:16`), which subscribes and applies the change locally.
4. Workspace handoff uses the same mechanism: `WorkspaceSync` publishes `np_workspace` messages; `WorkspaceRouter.openFullApp` opens/focuses the standalone tab with `workspaceId`/`conversationId` query params (`src/core/workspace/WorkspaceRouter.ts:6`).

### Message Envelope Routing

1. `createEnvelope` builds a `RuntimeEnvelope` with `type`, `operationId`, `timestamp`, `source` (`src/core/runtime/RuntimeEnvelope.ts:22`).
2. `MessageBus.dispatch` validates with `isEnvelope` and fans out to registered handlers via `Promise.allSettled` (`src/core/messaging/MessageBus.ts:24`).
3. `MessageBus.init` registers a single `chrome.runtime.onMessage` listener that async-responds (`MessageBus.ts:49`).
4. The background worker currently listens to raw (non-envelope) messages (`CONTENT_SCRIPT_READY`, `SPA_NAVIGATION`) from the content script (`entrypoints/background.ts:28`).

**State Management:**
- Zustand stores with `immer` middleware for draft-style mutations and `persist` middleware for durability. Persistence goes through `chromeStorageAdapter` (`src/core/theme/chromeStorageAdapter.ts`) with storage keys `np_store` (`useExtensionStore.ts:936`), `np_workspace_store` (`WorkspaceStore.ts:108`), `np_theme_store` (`ThemeStore.ts:79`). Derived/volatile fields (`activeSession`, `activeAttachments`, `availableTabs`) are excluded from persistence via `partialize` and recomputed on `merge` (`useExtensionStore.ts:938-948`).

## Key Abstractions

**RuntimeEnvelope:**
- Purpose: Typed, correlation-carrying message wrapper for all extension IPC.
- Examples: `src/core/runtime/RuntimeEnvelope.ts`
- Pattern: Discriminated type union (`MessageTypeValues`) + factory (`createEnvelope`) + type guard (`isEnvelope`); mirrored by tests in `tests/core/runtime/RuntimeEnvelope.test.ts`.

**BroadcastBus:**
- Purpose: Cross-surface publish/subscribe over `BroadcastChannel` with self-message suppression.
- Examples: `src/core/runtime/BroadcastBus.ts`, consumed by `ThemeSync.ts`, `WorkspaceSync.ts`, `ThemeStore.ts`
- Pattern: Module-level channel map with lazy channel creation, ref-counted teardown (`subscribe` closes the channel when the last listener leaves).

**chromeStorageAdapter:**
- Purpose: Zustand `StateStorage` that abstracts `chrome.storage.local` with a `localStorage` fallback.
- Examples: `src/core/theme/chromeStorageAdapter.ts`
- Pattern: Adapter interface (`getItem`/`setItem`/`removeItem`), reused by `useExtensionStore`, `ThemeStore`; enables vitest jsdom testing without Chrome.

**CommandRegistry / KeymapRegistry / AddonRegistry:**
- Purpose: Registry objects registering named capabilities (commands, shortcuts, addon pages) that UI shells enumerate.
- Examples: `src/core/commands/CommandRegistry.ts`, `src/core/input/KeymapRegistry.ts`, `src/core/registry/Registry.ts`
- Pattern: Module-level `Map` singletons with `register`/`unregister`/`getAll`, consumed by `CommandPalette` and entry-point shells.

## Entry Points

**Background Service Worker:**
- Location: `entrypoints/background.ts`
- Triggers: Extension install/startup/update; browser launch
- Responsibilities: `sidePanel.setPanelBehavior({ openPanelOnActionClick })`, onboarding flag init (`onboardingComplete`), raw content-script message listener

**Content Script:**
- Location: `entrypoints/content.core.ts`
- Triggers: `document_idle` on `<all_urls>`
- Responsibilities: MutationObserver + `wxt:locationchange` SPA navigation detection, sends `CONTENT_SCRIPT_READY` / `SPA_NAVIGATION` raw messages; extraction-only (no DOM UI, per v0.1 design)

**Sidepanel UI:**
- Location: `entrypoints/sidepanel/main.tsx`
- Triggers: Side panel open (action click); `Ctrl/Cmd+K` opens `CommandPalette`
- Responsibilities: Mount `ThemeProvider` + `SidepanelChat`, register surface commands, open standalone/options tabs

**Standalone Full-Tab UI:**
- Location: `entrypoints/standalone/main.tsx`
- Triggers: "Open in Full Tab" from sidepanel, or `WorkspaceRouter.openFullApp`
- Responsibilities: Mount `ThemeProvider` + `StandaloneWorkspace` (sidebar: Chat/Tools/Note/Write/Teams), register surface commands, open sidepanel/options

**Options UI:**
- Location: `entrypoints/options/main.tsx`
- Triggers: `options.html` opened in tab
- Responsibilities: Mount `ThemeProvider` + `OptionsPage` (General / Translate / Prompts tabs, provider config modals)

**Dev Shell (non-extension):**
- Location: `src/main.tsx` (wired by `index.html`)
- Triggers: `vite dev` / `npm run dev` on port 3000
- Responsibilities: Browser-preview shell with segmented view switcher (Workspace / Sidepanel Chat / Options) for development; not part of the built extension.

## Architectural Constraints

- **Threading:** Single-threaded. The background worker is an MV3 non-persistent service worker (`wxt.config.ts`, `background.ts:5`); it may be killed/recreated at any time, so durable state lives in `chrome.storage.local`, not in the worker.
- **Global state:** Module-level singletons hold in-memory registries and buses: `src/core/messaging/MessageBus.ts` (`handlers` map), `src/core/events/EventBus.ts` (`events` map), `src/core/runtime/BroadcastBus.ts` (`channels` map + module `INSTANCE_ID`), `src/core/commands/CommandRegistry.ts`, `src/core/input/KeymapRegistry.ts`, `src/core/registry/Registry.ts`, `src/core/log/debugLog.ts` (ring buffer), `src/core/runtime/workerState.ts`. These are per-context, so each extension surface gets its own copy.
- **Circular imports:** Not detected. `BroadcastBus` is a leaf (no imports of other core modules); `ThemeStore` → `BroadcastBus`/`ThemeConfig`, `WorkspaceStore` → `BroadcastBus`, `useExtensionStore` → `chromeStorageAdapter` + `ThemeStore` + `defaultPromptsData`, all one-directional.
- **Entry-point isolation:** Surfaces must not import each other's UI — enforced by the guard test `tests/isolation/cross-entrypoint-imports.test.ts` (grep-based; pattern references `components/app` and `components/sidepanel` paths that no longer exist verbatim).
- **Content-script isolation:** Content script runs in an `ISOLATED` world (`entrypoints/content.core.ts:6`) and intentionally renders no UI.
- **CSP:** `content_security_policy` restricts `connect-src` to `localhost:*` and the three AI provider hosts (`wxt.config.ts:65`), which bounds what the streaming layer may reach.
- **TypeScript strictness:** `strict: false` in `tsconfig.json:8`; several `as any` casts exist (e.g. `wxt.config.ts:15`, `BroadcastBus.ts:27`).

## Anti-Patterns

### Stale/Parallel Store State

**What happens:** `src/store/useExtensionStore.ts` keeps the full app domain state (sessions, config, notes, write history) while separate, newer stores (`WorkspaceStore`, `ThemeStore`) hold workspace and theme state; theme mode exists in both `ProviderConfig.themeMode` and `ThemeStore.mode`, with manual bridging in `updateConfig` (`useExtensionStore.ts:582-587`).
**Why it's wrong:** Two sources of truth for overlapping data invite drift and duplicated sync logic.
**Do this instead:** Converge domain state into the typed stores and let `useExtensionStore` derive from / delegate to them, as `WorkspaceStore` already models.

### Simulated Fallbacks Masking Real Errors

**What happens:** `src/services/aiProvider.ts` substitutes canned `simulateStreamResponse` output on any fetch failure or HTTP error (`aiProvider.ts:267-292`), and the message stays in the store.
**Why it's wrong:** Users and diagnostics cannot distinguish real model output from fabricated fallback content, which is dangerous for a "privacy-first AI assistant".
**Do this instead:** Surface errors to the UI explicitly (already available via `onError`), and gate simulated responses behind a visible dev/test mode flag.

### Stale Architecture References

**What happens:** `WorkspaceRouter` opens `app.html` (`src/core/workspace/WorkspaceRouter.ts:12,21`) but the real surface is `standalone.html` (see `entrypoints/standalone/main.tsx` and the sidepanel's `handleOpenStandalone`), and the isolation test greps for `components/app` / `components/sidepanel` folders that don't exist (`tests/isolation/cross-entrypoint-imports.test.ts:6-32`).
**Why it's wrong:** Dead references mislead future planners and can break navigation if `app.html` ever resolves differently.
**Do this instead:** Point routing to the actual `standalone.html` entry and update the isolation guard to the real directory names.

## Error Handling

**Strategy:** Try/catch with swallowing at the edges (background listener, broadcast handlers, keymap handlers), `MessageBus` aggregates handler rejections via `Promise.allSettled` and logs them (`MessageBus.ts:33-44`); `ErrorBoundary` (`src/core/components/ErrorBoundary.tsx`) catches React render errors per shell; streaming reports errors through `onError` callbacks.

**Patterns:**
- Handlers "must not throw" — `EventBus.emit` and `BroadcastBus` wrap each listener in try/catch and swallow (`EventBus.ts:32`, `BroadcastBus.ts:32`).
- Async message dispatch responds `{ ok: true }` or `{ ok: false, error }` (`MessageBus.ts:54-58`).
- Chrome API calls use `.catch(() => {})` to tolerate API absence (`background.ts:10`, `standalone/main.tsx:40`).
- AI stream abort is treated as success (`aiProvider.ts:339`).

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.debug` with `[code]` prefixes via `debugLog` ring buffer (`src/core/log/debugLog.ts`); inline `console` calls exist in `background.ts`, `MessageBus.ts`, `aiProvider.ts`, `useExtensionStore` tests. `getRecentLogs` supports a diagnostics surface.

**Validation:** Runtime message validity via `isEnvelope` type guard (`RuntimeEnvelope.ts:36`); provider/model config is validated implicitly by form/UI interactions rather than a schema layer (zod is a dependency but not used in `src/`).

**Authentication:** Provider API keys are stored in the persisted `ProviderConfig` (`apiKey` fields) under `chrome.storage.local` via `np_store`; `Content-Security-Policy` constrains `connect-src` to approved hosts. Keys are never sent to NowPilot-owned servers.

---

*Architecture analysis: 2026-08-18*
