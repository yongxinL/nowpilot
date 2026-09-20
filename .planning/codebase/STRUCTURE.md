---
last_mapped_commit: fa9f6508dff633ac15be7548c3cde08535e4bab5
last_mapped_at: 2026-09-20
---
# Codebase Structure

**Analysis Date:** 2026-09-20

## Directory Layout

```
nowpilot/
├── entrypoints/              # WXT extension entry points (root, adjacent to src/)
│   ├── background.ts         # MV3 service worker
│   ├── content/
│   │   └── core.content.ts   # ISOLATED content script (extraction/lifecycle only)
│   ├── options/              # options.html + main.tsx React root
│   ├── sidepanel/            # sidepanel.html + main.tsx React root
│   └── standalone/           # standalone.html + main.tsx React root
├── src/
│   ├── components/           # React UI, grouped by surface
│   │   ├── chat/             # Side Panel chat surface (reused by Standalone)
│   │   ├── common/           # Components shared by 2+ surfaces
│   │   ├── history/          # Chat history modal
│   │   ├── notes/            # Notes workspace (4-panel)
│   │   ├── options/          # Options page tabs + data
│   │   ├── pages/            # UNREFERENCED prototypes (do not import)
│   │   ├── standalone/       # Standalone workspace shell + Write/Tools/Teams panels
│   │   ├── OnboardingModal.tsx
│   │   └── ThemeProvider.tsx # ConfigProvider > XProvider composition
│   ├── core/                 # Context-agnostic framework primitives
│   │   ├── commands/         # CommandRegistry + workspace command sets
│   │   ├── components/       # Context-free React helpers (PortableMarkdown, ErrorBoundary)
│   │   ├── events/           # In-realm EventBus
│   │   ├── i18n/             # String map
│   │   ├── input/            # KeymapRegistry
│   │   ├── log/              # debugLog ring buffer
│   │   ├── messaging/        # MessageBus + BackgroundRouter
│   │   ├── prompts/          # Static prompt strings
│   │   ├── registry/         # Addon/page registries + settings store
│   │   ├── runtime/          # Envelope, BroadcastBus, PortReader, OperationId, workerState
│   │   ├── theme/            # ThemeStore, ThemeSync, ThemeConfig, storage adapters
│   │   └── workspace/        # WorkspaceStore, WorkspaceRouter, WorkspaceSync
│   ├── services/             # External I/O (aiProvider.ts SSE streaming)
│   ├── store/                # Main zustand store (useExtensionStore.ts)
│   ├── theme/                # AntD token packs (semanticTokens, componentTokens, algorithms)
│   ├── assets/icons/         # Base64-embedded avatar PNGs (avatarData.ts)
│   ├── types/                # All shared domain types (index.ts)
│   ├── index.css             # Global CSS vars (no Tailwind)
│   ├── main.tsx              # Vite browser dev-shell root
│   └── vite-env.d.ts
├── tests/                    # Vitest suites mirroring src/core and entrypoints areas
│   ├── background/           # background-router, message-bus-cold-start
│   ├── components/           # MirrorBanner, OnboardingModal
│   ├── core/                 # ai, commands, events, runtime, storage, store, strict, theme, workspace
│   ├── isolation/            # cross-entrypoint-imports gate
│   └── setup.ts              # chrome.storage/localStorage/BroadcastChannel/ResizeObserver mocks
├── public/assets/icons/      # Extension icon PNGs copied verbatim into the build
├── scripts/
│   └── verify-no-tailwind.sh # Phase-1b Tailwind-leak gate
├── .planning/                # GSD planning docs (product spec, design system, codebase maps)
├── .opencode/skills/         # Project skills (WXT/MV3, AntD, security, release, review)
├── .wxt/                     # WXT-generated types + tsconfig (tracked in git)
├── .output/chrome-mv3/       # WXT build output (gitignored)
├── dist -> .output/chrome-mv3 # Convenience symlink (gitignored)
├── index.html                # Vite dev-shell HTML (not shipped in extension)
├── wxt.config.ts             # Extension manifest, dev server, build tweaks
├── vite.config.ts            # Dev-shell build + manualChunks vendor split
├── vitest.config.ts          # jsdom + globals + tests/setup.ts
├── tsconfig.json             # strict TS, @/* and ~/* path aliases
└── package.json              # scripts: dev/build (Vite), dev:ext/build:ext (WXT), test, lint
```

## Directory Purposes

**entrypoints/:**

- Purpose: WXT-discovered extension entry points; each subdirectory with `index.html` + `main.tsx` becomes one extension page
- Contains: `background.ts`, `content/core.content.ts`, and `{sidepanel,standalone,options}/`
- Key files: `entrypoints/background.ts`, `entrypoints/content/core.content.ts`, `entrypoints/sidepanel/main.tsx`, `entrypoints/standalone/main.tsx`, `entrypoints/options/main.tsx`
- Note: `entrypoints/` must stay adjacent to `src/` at the repo root so relative imports from content scripts resolve (comment at `entrypoints/content/core.content.ts:11`)

**src/components/:**

- Purpose: React UI grouped by owning surface; cross-surface rules enforced by tests
- Contains: `chat/`, `standalone/`, `options/`, `notes/`, `history/`, `common/`, plus root-level `OnboardingModal.tsx` and `ThemeProvider.tsx`
- Key files: `src/components/chat/SidepanelChat.tsx`, `src/components/standalone/StandaloneShell.tsx`, `src/components/options/OptionsPage.tsx`, `src/components/notes/NotesWorkspace.tsx`, `src/components/ThemeProvider.tsx`

**src/components/pages/:**

- Purpose: Unreferenced prototype page stubs (`ChatPage.tsx`, `AgentPage.tsx`, `NotesPage.tsx`, `OptionsPage.tsx`)
- Contains: early UI seeds superseded by surface components
- Key files: none — do not import these; grep confirms zero importers

**src/core/:**

- Purpose: All context-agnostic primitives and orchestration; the only layer every entrypoint may share
- Contains: messaging, runtime, workspace, theme, commands, registry, events, input, log, prompts, i18n
- Key files: `src/core/messaging/MessageBus.ts`, `src/core/runtime/RuntimeEnvelope.ts`, `src/core/workspace/WorkspaceRouter.ts`, `src/core/theme/chromeStorageAdapter.ts`, `src/core/commands/registerWorkspaceCommands.ts`

**src/services/:**

- Purpose: External network I/O
- Contains: `src/services/aiProvider.ts` (streaming fetch + connection tests + model catalog)
- Key files: `src/services/aiProvider.ts`

**src/store/:**

- Purpose: Main persisted application store
- Contains: `src/store/useExtensionStore.ts` (`np_store`): sessions, messages, prompts, write history, notes, attachments, provider config
- Key files: `src/store/useExtensionStore.ts`

**src/theme/:**

- Purpose: AntD v6 `ThemeConfig` construction from semantic tokens
- Contains: `src/theme/index.ts` (barrel + `getLightTheme`/`getDarkTheme`), `semanticTokens.ts`, `componentTokens.ts`, `algorithms.ts`, `packs/claudePlus.ts`, `tailwindEquivalents.ts` (unreferenced orphan)
- Key files: `src/theme/packs/claudePlus.ts`, `src/theme/semanticTokens.ts`

**src/types/:**

- Purpose: Single home for shared domain interfaces
- Contains: `Message`, `ChatSession`, `ProviderConfig`, `PromptItem`, `NoteItem`, `WriteHistoryItem`, `TabItem`, `WorkflowDefinition`, `Attachment`
- Key files: `src/types/index.ts`

**tests/:**

- Purpose: Vitest suites mirroring the source areas they cover
- Contains: 18 test files across `background/`, `components/`, `core/`, `isolation/`, plus `tests/setup.ts` global mocks
- Key files: `tests/setup.ts`, `tests/isolation/cross-entrypoint-imports.test.ts`, `tests/core/theme/ThemeStore.test.ts`, `tests/core/workspace/WorkspaceRouter.test.ts`

**public/:**

- Purpose: Static assets copied into the extension bundle by WXT
- Contains: `public/assets/icons/*.png` (role avatars referenced by `wxt.config.ts` icons/action and `src/assets/icons/avatarData.ts` as base64)

**scripts/:**

- Purpose: Verification gates runnable in CI/local
- Contains: `scripts/verify-no-tailwind.sh` (fails on Tailwind utility classes in `src/` and `entrypoints/`)

**.planning/:**

- Purpose: GSD planning artifacts — `product/PRODUCT_SPEC.md`, `design/DESIGN_SYSTEM.md`, `design/references/*`, `architecture/decisions/` (empty), and `codebase/` (these maps)

**.opencode/skills/:**

- Purpose: Project-specific agent skills that encode architecture rules: `nowpilot-wxt-mv3`, `nowpilot-ant-design`, `nowpilot-security-review`, `nowpilot-spec-compliance`, `nowpilot-release-gate`, `nowpilot-ui-ux-review`, `nowpilot-phase-verification`

## Key File Locations

**Entry Points:**

- `entrypoints/background.ts`: service worker registration (router, side panel behavior, onboarding flag)
- `entrypoints/content/core.content.ts`: content script lifecycle + SPA navigation envelopes
- `entrypoints/sidepanel/main.tsx`: Side Panel React root + command set
- `entrypoints/standalone/main.tsx`: Standalone React root + command set
- `entrypoints/options/main.tsx`: Options React root
- `src/main.tsx`: Vite browser dev-shell root (view switcher)
- `index.html`: Vite dev-shell HTML entry

**Configuration:**

- `wxt.config.ts`: manifest (permissions, host permissions, CSP, side panel/options paths), dev server port 3000
- `vite.config.ts`: dev-shell inputs, vendor `manualChunks` split
- `vitest.config.ts`: jsdom environment, `tests/setup.ts`
- `tsconfig.json`: strict mode, `@/*` / `~/*` aliases, includes `entrypoints/**/*` and `.wxt/wxt.d.ts`
- `package.json`: scripts and `NP_STRICT_CEILING` counter

**Core Logic:**

- `src/core/messaging/MessageBus.ts` + `src/core/messaging/BackgroundRouter.ts`: message dispatch path
- `src/core/runtime/RuntimeEnvelope.ts`: the envelope contract and `MessageType` union
- `src/core/runtime/BroadcastBus.ts`: cross-surface BroadcastChannel primitive
- `src/core/workspace/WorkspaceRouter.ts`: tab open/focus/dedup + URL hydration
- `src/core/theme/chromeStorageAdapter.ts`: persistence choke point (debounce + flush)
- `src/store/useExtensionStore.ts`: all chat/notes/prompts state transitions
- `src/services/aiProvider.ts`: provider endpoints and SSE stream parsing
- `src/components/chat/useChatStreaming.ts`: store ↔ provider streaming bridge

**Testing:**

- `tests/setup.ts`: chrome.storage local/sync mocks, `BroadcastChannel` mock with `__broadcast()` helper, `matchMedia`, `ResizeObserver`
- `tests/isolation/cross-entrypoint-imports.test.ts`: surface isolation + content-script `fetch(` gate with self-test
- `tests/core/strict/np-strict-ceiling.test.ts`: `@ts-expect-error NP-STRICT-*` ceiling guard

## Naming Conventions

**Files:**

- React components: PascalCase matching the exported component — `Pipeline` e.g. `src/components/chat/SidepanelChat.tsx` exports `SidepanelChat`
- Core modules with Map-based registries: PascalCase module name — `src/core/messaging/MessageBus.ts`, `src/core/commands/CommandRegistry.ts`
- Helper/adapter modules: camelCase — `src/core/theme/chromeStorageAdapter.ts`, `src/core/log/debugLog.ts`, `src/core/runtime/workerState.ts`
- Hooks: `useXxx.ts` camelCase — `src/components/chat/useChatStreaming.ts`
- Data/constants: camelCase `*Data.ts` — `src/components/options/defaultPromptsData.ts`, `src/assets/icons/avatarData.ts`
- Tests: `<Subject>.test.ts` / `<Subject>.test.tsx` under `tests/<area>/`, mirroring the subject's path

**Directories:**

- Lowercase single words: `entrypoints/`, `components/`, `services/`, `store/`, `theme/`, `tests/`
- Surface grouping under `src/components/<surface>/` (chat, standalone, options, notes, history, common)

**Code identifiers:**

- Storage keys: `np_` prefix — `np_store` (`useExtensionStore`), `np_workspace_store` (`WorkspaceStore`), `np_theme` / `np_theme_pack` (`ThemeStore`)
- BroadcastChannel names: `np_` prefix — `np_theme`, `np_workspace`
- Message types: SCREAMING_SNAKE_CASE in `MessageTypeValues` — `CONTENT_SCRIPT_READY`, `WORKSPACE_HANDOFF`
- Log codes: SCREAMING_SNAKE_CASE — `debugLog('THEME_SYNC_WRITE_FAILED', ...)`, `'STORAGE_DEBOUNCE_FLUSH_FAILED'`
- Entity IDs: prefixed string ids — `s_` sessions, `m_` messages, `n_` notes, `cut_`/`quote_` attachments
- CSS classes (non-Tailwind only): `np-` animation/prefixed helpers (`np-fade-in`, `np-pulse`, `chat-history-drawer`, `message-font-small`)

## Where to Add New Code

**New chat feature (Side Panel):**

- UI: new component in `src/components/chat/` composed inside `src/components/chat/SidepanelChat.tsx`
- State: add actions to `src/store/useExtensionStore.ts` (immer mutation inside `set`)
- Provider behavior: `src/services/aiProvider.ts`
- Tests: `tests/components/` or `tests/core/` matching the area under test

**New Standalone workspace page:**

- Panel: `src/components/standalone/<Name>Panel.tsx`
- Tab registration: extend `WorkspaceTab` in `src/components/standalone/WorkspaceSidebar.tsx` and the `activeMenu` conditionals in `src/components/standalone/StandaloneShell.tsx`
- If it should be add-on registerable: use `AddonRegistry` / `StandalonePageRegistry` from `src/core/registry/Registry.ts`

**New Options tab or settings section:**

- Tab component: `src/components/options/<Name>Tab.tsx`
- Wire into `src/components/options/OptionsPage.tsx` tab switch (`'General' | 'Translate' | 'Prompts'`)
- Reuse provider/model helpers from `src/services/aiProvider.ts`; do not duplicate fetch logic

**New core primitive:**

- Create `src/core/<domain>/<Name>.ts`; export module functions with `register`/`unregister` (or `on`/`emit`) returning cleanups
- If it carries a new `chrome.runtime` message: add the literal to `MessageTypeValues` in `src/core/runtime/RuntimeEnvelope.ts` and register a handler via `BackgroundRouter`/`MessageBus`
- If it broadcasts between surfaces: add a channel helper next to `src/core/workspace/WorkspaceSync.ts` or `src/core/theme/ThemeSync.ts`

**New persisted store or key:**

- Use `createJSONStorage(() => chromeStorageAdapter)` (local) or `syncStorageAdapter` (sync) from `src/core/theme/chromeStorageAdapter.ts`
- Add `version: 1` + a throw-free `migrate`, and an explicit `partialize` — follow `src/store/useExtensionStore.ts:522`

**New command or keybinding:**

- Command: add to `registerSidepanelCommands` / `registerStandaloneCommands` in `src/core/commands/registerWorkspaceCommands.ts` and return an `unregister` in the cleanup
- Keymap: `KeymapRegistry.register({ id, keys, handler, description })` from `src/core/input/KeymapRegistry.ts`

**New extension entry point:**

- Add `entrypoints/<name>/index.html` + `entrypoints/<name>/main.tsx`; declare manifest fields in `wxt.config.ts`
- Optionally add the HTML to `rollupOptions.input` in `vite.config.ts` if the dev shell should render it
- Keep any cross-context communication on `RuntimeEnvelope`

**Shared UI:**

- Put in `src/components/common/` only when two or more surfaces use it; otherwise keep it inside the owning surface directory

**New types:**

- Add to `src/types/index.ts` (single shared type barrel); no per-domain type files yet

**Assets:**

- Extension-shipped icons: `public/assets/icons/` (referenced from `wxt.config.ts`)
- Inline base64 avatars: `src/assets/icons/avatarData.ts`

## Special Directories

**.wxt/:**

- Purpose: WXT-generated TypeScript declarations and tsconfig for the current project
- Generated: Yes (by `wxt prepare`/`wxt dev`)
- Committed: Yes (`.wxt/tsconfig.json`, `.wxt/types/*` are tracked; `.wxt` is not in `.gitignore`)

**.output/:**

- Purpose: WXT extension build output (`chrome-mv3/`, includes generated `manifest.json`)
- Generated: Yes
- Committed: No (gitignored)

**dist:**

- Purpose: Symlink to `.output/chrome-mv3` for convenient load-unpacked
- Generated: Yes
- Committed: No (gitignored, local-only symlink)

**references/:**

- Purpose: Reserved for external reference material (gitignored, not currently present)

## Build & Verification Commands

```bash
pnpm dev              # Vite browser dev shell (port 3000)
pnpm build            # tsc --noEmit + Vite dev-shell build
pnpm dev:ext          # WXT dev (extension)
pnpm build:ext        # WXT production build -> .output/chrome-mv3
pnpm lint             # tsc --noEmit
pnpm test             # vitest run (all suites)
pnpm test:isolation   # surface isolation gate only
pnpm verify:all       # tsc --noEmit + vitest run + tsc lint
```

**Note on `verify:phase-*` scripts:** `package.json` declares `verify:phase-1` … `verify:phase-9` pointing at future-phase test paths (e.g. `tests/core/context`, `tests/core/memory`, `tests/core/notes`, `tests/core/telemetry`, `tests/hooks`, `tests/addons`, `tests/perf`). Only `tests/background`, `tests/components`, `tests/core/{ai,commands,events,runtime,storage,store,strict,theme,workspace}`, and `tests/isolation` currently exist. Do not assume a referenced suite is present; check `tests/` first.

---

*Structure analysis: 2026-09-20*
