# Coding Conventions

**Analysis Date:** 2026-08-18

## Naming Patterns

**Files:**
- Components: PascalCase `*.tsx` — `ChatComposer.tsx`, `ThemeProvider.tsx`, `ModelSelector.tsx`
- Hooks: camelCase with `use` prefix, `*.ts` — `useChatStreaming.ts`, `useExtensionStore.ts`
- Core modules: camelCase `*.ts` — `chromeStorageAdapter.ts`, `workerState.ts`, `debugLog.ts`, `aiProvider.ts`
- Tests: `<SourceName>.test.ts` / `.test.tsx` under `tests/` mirroring the source tree — `tests/core/events/EventBus.test.ts`
- Entrypoints: WXT convention `entrypoints/background.ts`, `entrypoints/content.core.ts`, `entrypoints/<surface>/main.tsx`

**Functions:**
- camelCase, verb-first where applicable — `createEnvelope`, `getColorTheme`, `streamChatResponse`, `openFullApp`
- React hooks start with `use` — `useThemeSync`, `useThemeStore`, `useChatStreaming`
- Public helper creators: `create*`, `get*`, `build*` — `createEnvelope`, `getColorTheme`, `buildEndpointUrl` (`src/services/aiProvider.ts:91`)

**Variables:**
- camelCase for locals/params — `selectedModelId`, `activeSession`
- UPPER_SNAKE for module-level constants and seed data — `DEFAULT_COLOR_THEME_ID` (`src/core/theme/ThemeConfig.ts:22`), `MAX_LOG_ENTRIES` (`src/core/log/debugLog.ts:8`), `WORKSPACE_CHANNEL` (`src/core/workspace/WorkspaceRouter.ts:4`), `MODE_CYCLE` (`src/main.tsx:40`), `INITIAL_SESSIONS` (`src/store/useExtensionStore.ts:84`)
- ID prefixes: string IDs are namespaced with prefixes — chat sessions `s_`, messages `m_`/`m_ast_`, notes `n_`, write history `wh_`, prompts `p_`, attachments `att_` (e.g. `src/store/useExtensionStore.ts`, `src/components/chat/useChatStreaming.ts:44`)
- Event/message types: UPPER_SNAKE string literals — `THEME_CHANGED`, `WORKSPACE_UPDATED`, `SPA_NAVIGATION` (`src/core/theme/ThemeSync.ts:7`, `entrypoints/content.core.ts:18`)

**Types:**
- PascalCase for interfaces and type aliases — `ThemeState`, `ChatSession`, `ProviderConfig`
- `interface` for object shapes; `type` for unions, utility types, and `ReturnType` — `ThemeMode` (`src/core/theme/ThemeStore.ts:8`), `MessageType` (`src/core/runtime/RuntimeEnvelope.ts:12`), `OperationId` (`src/core/runtime/OperationId.ts:5`)
- Component prop types: `<Component>Props` — `ChatComposerProps`, `ModelSelectorProps`, `ThemeProviderProps`
- Zustand store types: `<Name>State` for data + actions, combined store type — `ThemeState` (`src/core/theme/ThemeStore.ts:10`), `WorkspaceStateData` + `WorkspaceActions` + `WorkspaceStore` (`src/core/workspace/WorkspaceStore.ts:14-37`)
- Discriminated unions for message payloads — `ThemeSyncMessage` (`src/core/theme/ThemeSync.ts:6`), `WorkspaceSyncMessage` (`src/core/workspace/WorkspaceSync.ts:5`), `BackgroundWorkerState` (`src/core/runtime/workerState.ts:1`)
- `as const` arrays derive literal union types — `MessageTypeValues` → `MessageType` (`src/core/runtime/RuntimeEnvelope.ts:1-12`)
- Domain types centralized in `src/types/index.ts`

## Code Style

**Formatting:**
- No Prettier/ESLint/Biome config files present (no `.prettierrc`, `eslint.config.*`, `biome.json`). Formatting is hand-maintained and consistently matches Prettier defaults: 2-space indent, single quotes, semicolons, trailing commas in multiline literals, CRLF-free.
- `pnpm run lint` runs `tsc --noEmit` only — type checking is the lint gate (`package.json:13`)
- Stray `// eslint-disable-next-line no-console` comments exist at `console.*` call sites (`src/core/messaging/MessageBus.ts:42`, `src/core/log/debugLog.ts:25`, `entrypoints/background.ts:7`), implying an ESLint `no-console` rule was intended; the product spec (`references/PRODUCT_SPEC_v0_1.md`) lists `eslint, prettier` as planned tooling but they are not yet installed

**Linting:**
- TypeScript `tsc --noEmit` via `npm run lint` / `verify:*` scripts
- `tsconfig.json` sets `strict: false` (non-strict), `noEmit: true`, `moduleResolution: bundler`, `jsx: react-jsx`, path aliases `@/*` → `./*` and `~/*` → `./*`
- No runtime lint enforced on commit; no git hooks

## Import Organization

**Order:**
1. React / external packages (`react`, `antd`, `zustand`, `@ant-design/*`)
2. Local project modules (relative paths)
3. CSS/style imports last (`import '../../src/index.css'` in `entrypoints/sidepanel/main.tsx:9`)

Examples:
```ts
// src/core/theme/ThemeStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from './chromeStorageAdapter';
```

**Path Aliases:**
- `@/*` → repo root (`tsconfig.json:18`, `vitest.config.ts:12`) and `~/*` → repo root (`tsconfig.json:19`)
- `@` → `./src` in `vite.config.ts:19`
- **Source and tests use relative imports, not aliases** — tests import via `../../../src/...` (`tests/core/events/EventBus.test.ts:2`); the `@` alias is configured but unused in both
- Node built-ins imported with `node:` prefix in config files — `node:path` (`vitest.config.ts:2`), `node:url` (`vite.config.ts:4`)
- `import type` used for type-only imports — `import type { ChatSession, ... } from '../types'` (`src/store/useExtensionStore.ts:7`); some files import types as values (`src/services/aiProvider.ts:1`)

## Error Handling

**Patterns:**
- **Swallow fire-and-forget errors** with empty `catch {}` or `catch { /* reason */ }` — event bus handlers must not throw (`src/core/events/EventBus.ts:33-34`), broadcast listeners (`src/core/runtime/BroadcastBus.ts:33-34`), port listeners (`src/core/runtime/PortReader.ts:11-12`), keymap handlers (`src/core/input/KeymapRegistry.ts:29`), SPA navigation sends (`entrypoints/content.core.ts:21`)
- **Early-return guards** for missing state before mutation — `if (!session) return;`, `if (!entry) return;`, `if (!msg || !msg.versions) return` (`src/store/useExtensionStore.ts:654-656`, `src/core/events/EventBus.ts:28`)
- **Isolate handler failures**: listeners are wrapped individually in try/catch so one failure never blocks others; `MessageBus.dispatch` uses `Promise.allSettled` and logs rejected reasons (`src/core/messaging/MessageBus.ts:33-44`)
- **Throw for programmer errors** (duplicate registrations): `throw new Error('Command already registered: ' + id)` (`src/core/commands/CommandRegistry.ts:14`), `throw new Error('Keymap conflict: ' + id)` (`src/core/input/KeymapRegistry.ts:41`), `Command not found: ...` (`src/core/commands/CommandRegistry.ts:46`)
- **Graceful degradation in services**: network/parse failures fall back to simulated/sample responses with a `notice` string (`src/services/aiProvider.ts:76-88, 266-291`); AbortError from `AbortController` is swallowed (`src/services/aiProvider.ts:338-341`)
- **Optional chaining + null coalescing** throughout — `config.providers?.gemini?.apiKey || ''`, `sessions[0] || null` (`src/services/aiProvider.ts:93`, `src/store/useExtensionStore.ts:518`)
- Errors serialized with `String(err)` for cross-context messaging — `{ ok: false, error: String(error) }` (`src/core/messaging/MessageBus.ts:57`)

## Logging

**Framework:** Native `console.*` plus a small in-memory log module

**Patterns:**
- `src/core/log/debugLog.ts` — structured entries `{ code, message, context, timestamp }`, capped at `MAX_LOG_ENTRIES = 200`, `debugLog(code, message, context)` writes to `console.debug` with a `[code]` prefix; exposed via `getRecentLogs()` / `clearLogs()`
- Direct `console.log/debug/warn/error` for diagnostics — `entrypoints/background.ts:8`, `src/services/aiProvider.ts:342`, `src/core/messaging/MessageBus.ts:43`
- Prefix convention for extension-context logs: `[BG]` (background), `[MessageBus]` — `entrypoints/background.ts:30-32`
- No structured/remote logging; no telemetry SDK wired in yet

## Comments

**When to Comment:**
- Section separators and numbered step comments inside complex hooks/components — `// 1. Subscribe to broadcasted theme changes...`, `// 2. Apply 'dark' class...` (`src/core/theme/ThemeSync.ts:35-51`), `// ---> macOS`, `// ---> Node` in `.gitignore`
- Rationale comments for non-obvious code — `// handlers must not throw — swallow` (`src/core/events/EventBus.ts:34`), `// Fallback defaults if endpoint is unreachable or CORS restricted` (`src/services/aiProvider.ts:76`)
- Data-file grouping comments — `// 1. For YouTube (Custom / special)` (`src/components/options/defaultPromptsData.ts:4`)
- UI annotations for mockup-driven layout — `{/* Sidepanel-only Top Toolbar (32px) */}` (`src/components/chat/ChatComposer.tsx:69`)

**JSDoc/TSDoc:**
- Sparse. Used on public cross-surface APIs — `useThemeSync` and `publishThemeChange` in `src/core/theme/ThemeSync.ts:10-15, 65-68` — and tests may reference them. Most functions have no JSDoc; rely on descriptive names

## Function Design

**Size:** Core modules use small single-purpose functions (`RuntimeEnvelope.ts`, `BroadcastBus.ts`, `WorkerState.ts`). Store action functions in `src/store/useExtensionStore.ts` are larger but single-purpose per action. Components vary widely (184–1140 lines); UI-focus guidance is in `.planning/DESIGN_SYSTEM.md`.

**Parameters:** Props objects for components and named-object params for complex APIs. Streaming service uses a single destructured params object with callbacks — `StreamChatParams` with `onChunk`/`onDone`/`onError` (`src/services/aiProvider.ts:3-13`). Store actions take primitive args (`(id: string)`, `(updates: Partial<X>)`).

**Return Values:** 
- `on(...)`/`subscribe(...)`/`register(...)` return an unsubscribe cleanup function `() => void` (`src/core/events/EventBus.ts:16-25`, `src/core/runtime/BroadcastBus.ts:43`, `src/core/input/KeymapRegistry.ts`)
- Optional lookups return `T | undefined` (`CommandRegistry.get`, `AddonSettingsStore.get`)
- `void` for mutating store actions and fire-and-forget emitters

## Module Design

**Exports:**
- Named exports exclusively for application code; no default exports except WXT entrypoints (`defineBackground`/`defineContentScript` default in `entrypoints/background.ts:3`, `entrypoints/content.core.ts:3`)
- Components exported as `export const X: React.FC<Props>` — `ModelSelector.tsx:33`, `ChatComposer.tsx:44`
- Registries exposed as exported object literals over module-scoped `Map` singletons — `CommandRegistry`, `KeymapRegistry`, `AddonSettingsStore`, `SidePanelPageRegistry`, `FullAppPageRegistry` (`src/core/registry/Registry.ts`)

**Barrel Files:** Minimal. `src/types/index.ts` centralizes all domain types; `src/theme/index.ts` exports theme builders + cached themes. Component/store modules are imported directly from their files, not re-exported through barrels. No `src/components/index.ts`.

**State Management Pattern (Zustand):**
- Store shape: `create<State>()(persist(immer((set, get) => ({ ... }))))` — `src/core/theme/ThemeStore.ts:35`, `src/core/workspace/WorkspaceStore.ts:50`, `src/store/useExtensionStore.ts:560`
- `persist` with `createJSONStorage(() => chromeStorageAdapter)` writing to `chrome.storage.local` (`src/core/theme/chromeStorageAdapter.ts`); `partialize` whitelists persisted fields; `merge` recomputes derived state on rehydrate (`src/store/useExtensionStore.ts:938-948`)
- Immer-style mutation inside `set((state) => { state.x = y })`; `get()` for reading current state; `useXxxStore.getState()` for imperative access outside components

**Cross-Surface Messaging Pattern:**
- `BroadcastChannel` bus with `subscribe`/`publish` (`src/core/runtime/BroadcastBus.ts`) using `np_`-prefixed channel names; sender-ID envelope (`_sender`) ignores self-messages
- Chrome runtime message envelopes: `RuntimeEnvelope` with `type`/`operationId`/`timestamp`/`source`/`payload` (`src/core/runtime/RuntimeEnvelope.ts`); handlers registered via `register(type, handler)` and dispatched with `Promise.allSettled` (`src/core/messaging/MessageBus.ts`)

**Styling Convention (UI):**
- Tailwind utility classes with `dark:` variants for theming — `className="... dark:bg-zinc-800 ..."` (`src/components/common/ModelSelector.tsx:95`)
- CSS custom properties prefixed `--np-` for brand color: `--np-primary`, `--np-primary-light` set on `document.documentElement` (`src/core/theme/ThemeStore.ts:31-32`)
- Ant Design tokens via `theme.useToken()` / `ConfigProvider` + `XProvider` (`src/components/ThemeProvider.tsx`)
- Inline `style={{}}` used for antd token-driven values; dark/light classes drive Tailwind branches

---

*Convention analysis: 2026-08-18*