# Codebase Structure

**Analysis Date:** 2026-08-18

## Directory Layout

```
nowpilot/                          # NowPilot — privacy-first AI assistant Chrome extension (WXT/MV3)
├── entrypoints/                   # WXT entry points → manifest build targets
│   ├── background.ts              # MV3 non-persistent service worker
│   ├── content.core.ts            # ISOLATED-world content script (SPA nav detection, no UI)
│   ├── sidepanel/                 # Side panel React app
│   │   ├── index.html
│   │   └── main.tsx
│   ├── options/                   # Options page React app
│   │   ├── index.html
│   │   └── main.tsx
│   └── standalone/                # Standalone full-tab workspace React app
│       ├── index.html
│       └── main.tsx
├── src/                           # Shared application source
│   ├── main.tsx                   # Dev-shell app (Vite preview; not part of extension)
│   ├── index.css                  # Tailwind import + CSS design tokens
│   ├── vite-env.d.ts              # Vite env + asset module declarations
│   ├── types/                     # Domain TypeScript types
│   │   └── index.ts
│   ├── core/                      # Framework-agnostic core infrastructure
│   │   ├── runtime/               # RuntimeEnvelope, BroadcastBus, PortReader, workerState
│   │   ├── messaging/             # MessageBus (chrome.runtime envelope routing)
│   │   ├── events/                # EventBus (in-process pub/sub)
│   │   ├── workspace/             # WorkspaceStore, WorkspaceRouter, WorkspaceSync
│   │   ├── theme/                 # ThemeStore, ThemeConfig, ThemeSync, chromeStorageAdapter
│   │   ├── registry/              # Addon/SidePanelPage/FullAppPage registries + settings
│   │   ├── commands/              # CommandRegistry (command palette)
│   │   ├── input/                 # KeymapRegistry (keyboard shortcuts)
│   │   ├── prompts/               # Prompt templates
│   │   ├── i18n/                  # string-keyed i18n dictionary
│   │   ├── log/                   # debugLog ring buffer
│   │   └── components/            # ErrorBoundary, PortableMarkdown (framework-bound core UI)
│   ├── store/                     # Zustand stores
│   │   └── useExtensionStore.ts   # Main persisted domain store
│   ├── services/                  # External service layer
│   │   └── aiProvider.ts          # AI streaming + model discovery + fallback
│   ├── components/                # React UI components
│   │   ├── chat/                  # SidepanelChat, message list, composer, streaming hook
│   │   ├── common/                # CommandPalette, avatars, onboarding, modals, ThemeToggle
│   │   ├── standalone/            # StandaloneWorkspace, sidebar, Write tools, Tools/Teams panels
│   │   ├── options/               # OptionsPage, prompts tabs/modals
│   │   ├── notes/                 # NotesWorkspace
│   │   ├── history/               # ChatHistoryModal
│   │   ├── pages/                 # Placeholder pages (ChatPage, AgentPage, NotesPage, OptionsPage)
│   │   └── ThemeProvider.tsx      # AntD/XProvider theme bridge
│   ├── theme/                     # Ant Design light/dark theme token config
│   │   └── index.ts
│   └── assets/                    # Static assets
│       └── icons/avatarData.ts    # Base64 avatar data URLs
├── tests/                         # Vitest suite (jsdom)
│   ├── setup.ts                   # Global mocks (chrome.storage, BroadcastChannel, matchMedia)
│   ├── core/                      # Unit tests mirroring src/core (runtime, events, workspace, theme, commands)
│   └── isolation/                 # Architecture guard tests (entry-point import isolation)
├── public/                        # Static extension assets (icons)
│   └── assets/icons/
├── references/                    # External reference material (gitignored)
├── .planning/                     # GSD planning artifacts (config, DESIGN_SYSTEM, phases, codebase)
├── .wxt/                          # WXT generated types (gitignored)
├── .output/                       # WXT build output (gitignored); dist → .output/chrome-mv3
├── index.html                     # Dev-shell HTML (Vite)
├── wxt.config.ts                  # WXT + extension manifest config
├── vite.config.ts                 # Vite config (React, Tailwind, manualChunks)
├── vitest.config.ts               # Vitest config (jsdom, @ alias → repo root)
├── tsconfig.json                  # TS config (@/* and ~/* → repo root)
├── package.json / pnpm-lock.yaml / package-lock.json
├── metadata.json                  # AI Studio metadata
└── LICENSE, README.md, .gitignore
```

## Directory Purposes

**entrypoints/:**
- Purpose: WXT entry points; each top-level file or directory becomes an extension build target.
- Contains: `background.ts` (service worker), `content.core.ts` (content script), and one React app directory per HTML surface (`sidepanel/`, `options/`, `standalone/`) each with `index.html` + `main.tsx`.
- Key files: `background.ts`, `content.core.ts`, `sidepanel/main.tsx`, `standalone/main.tsx`, `options/main.tsx`

**src/core/:**
- Purpose: Framework-agnostic infrastructure: transports, registries, stores, and domain-neutral utilities that are unit-testable without a browser.
- Contains: `runtime/` (RuntimeEnvelope, OperationId, PortReader, BroadcastBus, workerState), `messaging/`, `events/`, `workspace/`, `theme/`, `registry/`, `commands/`, `input/`, `prompts/`, `i18n/`, `log/`, `components/`.
- Key files: `runtime/RuntimeEnvelope.ts`, `runtime/BroadcastBus.ts`, `messaging/MessageBus.ts`, `workspace/WorkspaceStore.ts`, `theme/ThemeStore.ts`, `theme/chromeStorageAdapter.ts`, `commands/CommandRegistry.ts`

**src/components/:**
- Purpose: React UI layer, organized by surface/feature.
- Contains: `chat/` (main chat experience), `common/` (shared UI: CommandPalette, avatars, modals), `standalone/` (full-tab workspace + Write tooling), `options/` (settings), `notes/`, `history/`, `pages/` (placeholder stubs), `ThemeProvider.tsx`.
- Key files: `chat/SidepanelChat.tsx`, `chat/useChatStreaming.ts`, `standalone/StandaloneWorkspace.tsx`, `options/OptionsPage.tsx`, `ThemeProvider.tsx`

**src/store/:**
- Purpose: Zustand domain stores.
- Contains: `useExtensionStore.ts` — the primary persisted store (config, sessions, prompts, writeHistory, notes, attachments).
- Key files: `useExtensionStore.ts`

**src/services/:**
- Purpose: External service integration layer.
- Contains: `aiProvider.ts` — SSE streaming, model listing, fallback simulation, `AVAILABLE_MODELS`.
- Key files: `aiProvider.ts`

**src/types/:**
- Purpose: Central domain type definitions.
- Contains: `index.ts` (Message, ChatSession, ProviderConfig, NoteItem, Attachment, PromptItem, etc.).
- Key files: `index.ts`

**tests/:**
- Purpose: Vitest suite with a shared global mock setup.
- Contains: `setup.ts` (mocks for chrome.storage.local, BroadcastChannel, matchMedia, ResizeObserver, localStorage), `core/` (unit tests mirroring `src/core/`), `isolation/` (import-isolation guard tests).
- Key files: `setup.ts`, `core/runtime/RuntimeEnvelope.test.ts`, `core/workspace/WorkspaceRouter.test.ts`, `isolation/cross-entrypoint-imports.test.ts`

**public/:**
- Purpose: Static assets copied verbatim into the extension build.
- Contains: `assets/icons/` — role icons (`icon-role-ai-*.png`, `icon-role-user-avatar.png`) referenced by the manifest.
- Key files: `assets/icons/icon-role-ai-avatar.png` (action + all manifest icon slots)

**src/assets/:**
- Purpose: In-source static assets.
- Contains: `icons/avatarData.ts` — auto-generated base64 data URLs for avatars.
- Key files: `icons/avatarData.ts`

## Key File Locations

**Entry Points:**
- `entrypoints/background.ts`: MV3 service worker (side panel behavior, onboarding flag)
- `entrypoints/content.core.ts`: ISOLATED-world content script (SPA navigation detection)
- `entrypoints/sidepanel/main.tsx`: Side panel React root
- `entrypoints/standalone/main.tsx`: Standalone full-tab React root
- `entrypoints/options/main.tsx`: Options page React root
- `src/main.tsx`: Dev-shell React root (Vite preview only)

**Configuration:**
- `wxt.config.ts`: WXT config + extension manifest (permissions, CSP, host_permissions, side_panel, options_ui)
- `vite.config.ts`: React/Tailwind plugins, `@` alias, manualChunks
- `vitest.config.ts`: jsdom env, global setup, `@` alias
- `tsconfig.json`: TS config, `@/*` and `~/*` path aliases
- `package.json`: scripts (`dev`, `dev:ext`, `build:ext`, `test`, `lint`, `verify:phase-*`)

**Core Logic:**
- `src/store/useExtensionStore.ts`: Main persisted domain store (sessions, config, prompts, notes, write history)
- `src/core/workspace/WorkspaceStore.ts` / `WorkspaceRouter.ts` / `WorkspaceSync.ts`: Cross-surface workspace state and handoff
- `src/core/theme/ThemeStore.ts` / `ThemeSync.ts` / `ThemeConfig.ts` / `chromeStorageAdapter.ts`: Theme state, sync, and storage adapter
- `src/core/runtime/RuntimeEnvelope.ts` / `BroadcastBus.ts` / `PortReader.ts` / `workerState.ts`: IPC and runtime primitives
- `src/core/messaging/MessageBus.ts`: Typed chrome.runtime message routing
- `src/services/aiProvider.ts`: AI streaming and model discovery
- `src/components/chat/useChatStreaming.ts`: Chat streaming orchestration hook

**Testing:**
- `tests/setup.ts`: Global test mocks
- `tests/core/runtime/RuntimeEnvelope.test.ts`, `tests/core/workspace/WorkspaceRouter.test.ts`, `tests/core/theme/ThemeStore.test.ts`, `tests/core/events/EventBus.test.ts`, `tests/core/commands/CommandRegistry.test.ts`: Core unit tests
- `tests/isolation/cross-entrypoint-imports.test.ts`: Entry-point import isolation guard

## Naming Conventions

**Files:**
- React components: PascalCase `.tsx` — `ChatMessageList.tsx`, `StandaloneWorkspace.tsx`, `NotesWorkspace.tsx`
- Core modules: PascalCase `.ts` — `EventBus.ts`, `WorkspaceStore.ts`, `CommandRegistry.ts`, `RuntimeEnvelope.ts`
- Hooks: `use` + PascalCase — `useChatStreaming.ts`, `useThemeSync.ts`
- WXT entry points: kebab-case (`background.ts`, `content.core.ts`) and surface `main.tsx` inside PascalCase-less folder names (`sidepanel/`, `options/`, `standalone/`)
- Tests: `<Module>.test.ts` / `.test.tsx` mirroring source layout under `tests/`
- Storage keys: `np_` prefix — `np_store`, `np_workspace_store`, `np_theme_store`, `np_theme`, `np_workspace`
- i18n keys: dot-namespaced strings (`chat.empty`, `onboarding.welcome`)

**Directories:**
- `src/core/`: plural lowercase sub-directories named by concern (`runtime/`, `events/`, `workspace/`, `registry/`, `commands/`, `prompts/`)
- `src/components/`: plural lowercase feature directories (`chat/`, `common/`, `standalone/`, `options/`, `notes/`, `history/`, `pages/`)
- `entrypoints/`: kebab-case surface directories (`sidepanel/`, `options/`, `standalone/`)
- Types/functions/variables: PascalCase interfaces and types (`Message`, `ChatSession`, `ProviderConfig`), camelCase functions and variables (`streamChatResponse`, `activeSessionId`)

## Where to Add New Code

**New Feature:**
- Primary code: add a feature folder under `src/components/<feature>/` for UI and, if it owns domain state, a store in `src/store/` or `src/core/<feature>/`
- Tests: `tests/core/<feature>/` (or `tests/components/` for UI), mirroring the module under test; register globals in `tests/setup.ts` only when a new browser API is touched

**New Component/Module:**
- Implementation: `src/components/<feature>/<ComponentName>.tsx` (React) or `src/core/<concern>/<ModuleName>.ts` (infrastructure)
- Shell registration: `src/components/standalone/StandaloneWorkspace.tsx` for workspace tabs, `src/components/chat/SidepanelChat.tsx` for chat features, `src/components/options/OptionsPage.tsx` for settings
- Surface commands: register/unregister in the relevant `entrypoints/*/main.tsx` (or `src/main.tsx`) via `CommandRegistry` in `useEffect`

**Utilities:**
- Shared helpers: `src/core/` (framework-agnostic); React hooks in `src/components/<feature>/use<Name>.ts`; i18n strings in `src/core/i18n/strings.ts`; prompt templates in `src/core/prompts/index.ts`

## Special Directories

**.wxt:**
- Purpose: WXT-generated type definitions and config shims
- Generated: Yes (by `wxt` / `wxt build`)
- Committed: No (gitignored in `.gitignore`)

**.output:**
- Purpose: WXT build output (Chrome MV3 target); `dist` is a symlink to `.output/chrome-mv3`
- Generated: Yes
- Committed: No

**references:**
- Purpose: External reference material (out-of-repo source snapshots)
- Generated: No
- Committed: No (gitignored)

**.planning:**
- Purpose: GSD planning artifacts — `config.json`, `DESIGN_SYSTEM.md`, `PRODUCT_SPEC_v0_1.md`, `prompts/`, `phases/`, `codebase/`, `mockup/`
- Generated: Yes (by GSD workflow)
- Committed: Yes (tracked planning state)

**public/assets/icons:**
- Purpose: Extension manifest icons referenced by `wxt.config.ts`
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-08-18*
