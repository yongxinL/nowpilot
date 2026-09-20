---
last_mapped_commit: fa9f6508dff633ac15be7548c3cde08535e4bab5
last_mapped_at: 2026-09-20
---
# Coding Conventions

**Analysis Date:** 2026-09-20

## Naming Patterns

**Files:**

- React components: `PascalCase.tsx`, one component per file — `src/components/chat/ChatComposer.tsx`, `src/components/common/MirrorBanner.tsx`
- Class-like core modules (registry/store/bus/envelope): `PascalCase.ts` — `src/core/commands/CommandRegistry.ts`, `src/core/theme/ThemeStore.ts`, `src/core/events/EventBus.ts`, `src/core/runtime/RuntimeEnvelope.ts`
- Utility/adapter modules: `camelCase.ts` — `src/core/log/debugLog.ts`, `src/core/theme/chromeStorageAdapter.ts`, `src/core/input/KeymapRegistry.ts` (registry exception)
- Hooks: `useXxx.ts` camelCase — `src/components/chat/useChatStreaming.ts`
- WXT entrypoints: fixed lowercase contract names — `entrypoints/background.ts`, `entrypoints/content/core.content.ts`, `entrypoints/sidepanel/main.tsx`, `entrypoints/standalone/main.tsx`, `entrypoints/options/main.tsx`
- Tests: `<SourceUnit>.test.ts` / `.test.tsx` (see TESTING.md)

**Functions:**

- `camelCase`, verb-first, named function declarations in `src/core/*`; arrow functions for React components and inline callbacks
- Store actions: `setX` / `updateX` / `addX` / `deleteX` / `toggleX` / `createNewX` / `clearX` — `src/store/useExtensionStore.ts`
- Predicates: `isX` — `isEnvelope` (`src/core/runtime/RuntimeEnvelope.ts`), `isPrimaryWriter` (`src/core/workspace/WorkspaceStore.ts`), `isInitialized` (`src/core/messaging/MessageBus.ts`)
- Factories: `createX` — `createEnvelope` (`src/core/runtime/RuntimeEnvelope.ts`)
- Migrations: `xxxMigrate` — `npStoreMigrate` (`src/store/useExtensionStore.ts`), `themeMigrate` (`src/core/theme/ThemeStore.ts`), `workspaceMigrate` (`src/core/workspace/WorkspaceStore.ts`)
- Registration: `registerX` returning a cleanup closure — `registerWorkspaceCommands` (`src/core/commands/registerWorkspaceCommands.ts`), `on()` in `src/core/events/EventBus.ts`

**Variables:**

- `camelCase` locals; module-level exported constants `SCREAMING_SNAKE_CASE` — `STORAGE_DEBOUNCE_MS` (`src/core/theme/chromeStorageAdapter.ts:14`), `DEFAULT_CONFIG` / `INITIAL_PROMPTS` / `INITIAL_SESSIONS` (`src/store/useExtensionStore.ts:18-98`), `MAX_LOG_ENTRIES` (`src/core/log/debugLog.ts:8`), `THEME_STORAGE_KEY` (`src/core/theme/ThemeStore.ts:30`)
- Cross-context message types: `SCREAMING_SNAKE` string values declared as a `as const` array — `MessageTypeValues` (`src/core/runtime/RuntimeEnvelope.ts:1-26`)
- In-process events (EventBus) and BroadcastBus channels: colon-namespaced / lowercase keys — `'np_theme'` (`src/core/theme/ThemeStore.ts:88`), event names tested as `'test:event'`

**Types:**

- No `I` prefix; interfaces for object shapes, `type` aliases for unions — see `src/types/index.ts` (78 interfaces vs 24 type aliases across repo)
- Zero `enum` declarations. Use string-literal unions instead: `type ProviderType = 'openai' | 'gemini' | 'webapp' | 'claude'` (`src/types/index.ts:1`)
- Component props: non-exported `interface <ComponentName>Props` immediately above the component (`ChatComposerProps`, `MirrorBannerProps`, `RuntimeEnvelope`'s `PageHtmlPayload` is exported because it is a cross-module contract)
- Discriminated result unions with `ok: true/false` — `ProviderConnectionResult` (`src/services/aiProvider.ts:24-26`)
- Use `import type { ... }` or inline `type` specifier: `import { useThemeStore, type ThemeMode } from './core/theme/ThemeStore'` (`src/main.tsx:11`)

**Storage keys:**

- Always `np_`-prefixed snake_case: `np_store` (`src/store/useExtensionStore.ts:523`), `np_theme` / `np_theme_pack` (`src/core/theme/ThemeStore.ts:30-31`), `np_workspace_store` (`src/core/workspace/WorkspaceStore.ts:148`)
- Canonical key registry lives in `.planning/product/PRODUCT_SPEC.md` §"Storage keys" (line ~1967). Never invent a key.

**Runtime IDs:**

- `crypto.randomUUID()` for protocol IDs — `operationId` (`src/core/runtime/RuntimeEnvelope.ts:63`), `workspaceId` (`src/core/workspace/WorkspaceStore.ts:56`); `ulid`/`uuid` packages are banned by spec
- Timestamp-prefixed IDs for UI entities: `'s_' + Date.now()` (sessions), `'m_'` / `'m_ast_'` (messages), `'n_'` (notes)

**DOM/test hooks:**

- `data-testid` kebab-case (`data-testid="mirror-banner"` `src/components/common/MirrorBanner.tsx:34`; `data-testid="onboarding-error-text"`)
- `aria-label` is a full sentence/instruction (`MirrorBanner.tsx:67`: `"Refocus here and return to primary chat mode"`)

## Code Style

**Formatting:**

- 2-space indentation, single quotes, semicolons, trailing commas, ~100-column code, comments wrapped at ~80
- No Prettier config file exists (`.prettierrc*`, `biome.json` absent). Style is consistent by convention, not tooling.

**Linting:**

- No ESLint config file exists (`.eslintrc*`, `eslint.config.*` absent). `pnpm run lint` and every `verify:*` script run `tsc --noEmit` — TypeScript is the lint.
- `strict: true` is mandatory (`tsconfig.json:12`, spec §7.8). Type suppressions must use `// @ts-expect-error NP-STRICT-<n>: <reason>` — sequential numbering, never `@ts-ignore`. Live count is capped by `NP_STRICT_CEILING` in `package.json` (currently `0`) and enforced by `tests/core/strict/np-strict-ceiling.test.ts`.
- `any` is rare (10 occurrences in `src` + `entrypoints`); when mocking/adapting, use explicit casts: `as unknown as Response` (tests) or `as unknown as Record<string, unknown>` (`chromeStorageAdapter.ts:79`).
- `// eslint-disable-next-line no-console` / `@typescript-eslint/no-explicit-any` comments appear even though ESLint is not installed — keep them; they document intent for the planned ESLint integration (spec §7.8).

**JSX styling:**

- Inline `style={{}}` objects using Ant Design tokens from `theme.useToken()` — `src/components/common/MirrorBanner.tsx:28-46`, `src/main.tsx:135`
- `className` only for hand-written CSS defined in `src/index.css` (`np-*` utilities, `custom-scrollbar`, `message-font-*`). Tailwind, shadcn, Radix, clsx, tailwind-merge are banned (spec §0.2) and gated by `scripts/verify-no-tailwind.sh`.
- Use Ant Design v6 components before bespoke widgets; Ant Design X is presentation-only. One root provider per surface (`ConfigProvider` + `XProvider` in `src/components/ThemeProvider.tsx:38-43`).
- Icon-only actions require a `Tooltip` and an accessible name (`.opencode/skills/nowpilot-ant-design/SKILL.md`).

## Import Organization

**Order (observed consistently):**

1. `react` / `react-dom`
2. Third-party UI: `antd`, `@ant-design/icons`, `@ant-design/x`
3. Third-party state/util: `zustand`, `immer`, `zod`
4. Local modules via relative paths

```tsx
// src/components/chat/ChatComposer.tsx:1-16
import React from 'react';
import { Tooltip, theme } from 'antd';
import { HistoryOutlined, PlusSquareOutlined, /* ... */ } from '@ant-design/icons';
import { ModelSelector } from '../common/ModelSelector';
import { WorkflowSelector } from '../common/WorkflowSelector';
import { AVAILABLE_MODELS } from '../../services/aiProvider';
import { ProviderConfig, Attachment, TabItem, PromptItem } from '../../types';
```

**Path aliases:**

- All `src/` and `tests/` imports are relative (`../`, `../../`). Zero files use `@/` or `~/`.
- Aliases are declared but UNUSED and INCONSISTENT — do not start using them without fixing the configs: `vite.config.ts:18` maps `@` → `./src`, while `tsconfig.json:23` and `vitest.config.ts:12` map `@`/`@/*` → repo root. Prefer relative imports to match existing code.
- `import React from 'react'` is explicitly present in all 51 `.tsx` files even though `jsx: "react-jsx"` makes it unnecessary. Match this.
- Barrel files exist only at `src/types/index.ts`, `src/theme/index.ts`, `src/core/prompts/index.ts`. Import concrete module paths elsewhere.

## Error Handling

**Patterns:**

- **Result unions over throws for expected runtime failures.** `{ ok: true; ... } | { ok: false; error: string }` with narrowing via `if (result.ok)` — `ProviderConnectionResult` in `src/services/aiProvider.ts:24`, consumed in `src/components/OnboardingModal.tsx`.
- **Throw only for programmer errors** — duplicate/missing registry IDs: `throw new Error(\`Command already registered: ${cmd.id}\`)` (`src/core/commands/CommandRegistry.ts:14`), tested in `tests/core/commands/CommandRegistry.test.ts:46`.
- **Migrations are throw-free and total.** Each persisted store ships a pure `migrate` that returns the blob unchanged or `{}`/defaults — `npStoreMigrate` (`src/store/useExtensionStore.ts:555`), `themeMigrate` (`src/core/theme/ThemeStore.ts:38`), `workspaceMigrate` (`src/core/workspace/WorkspaceStore.ts:77`). Tests assert `not.toThrow`.
- **Fire-and-forget async uses explicit swallowed catches** for Chrome API calls: `.catch(() => {})` (`entrypoints/background.ts:32`, `entrypoints/content/core.content.ts`). When the failure matters, route to `debugLog` instead: `performFlush().catch((err) => { debugLog('STORAGE_DEBOUNCE_FLUSH_FAILED', err?.message ?? String(err)); })` (`src/core/theme/chromeStorageAdapter.ts:154-156`).
- **Handler isolation.** `MessageBus.dispatch` wraps each handler so one throw cannot abort others (`Promise.allSettled` + sync-throw-to-rejection wrapper, `src/core/messaging/MessageBus.ts:40-48`). `EventBus.emit` swallows handler throws by design (`src/core/events/EventBus.ts:30-36`).
- **Never interpolate secrets into errors.** Provider errors are built from HTTP status + server body only; raw `apiKey` must not appear in any string (D-12/T-01-10), asserted in `tests/core/ai/testProviderConnection.test.ts:84-109`.
- **Spec rule (partially honored):** every `catch` should call `debugLog(code, message, context)` with a canonical code (spec §0.3, §0.5.1 rule 9). In practice, intentional no-op catches exist for chrome lifecycle calls; prefer `debugLog` when the failure is observable or persistent.

## Logging

**Framework:** custom `debugLog` ring buffer — `src/core/log/debugLog.ts` (200-entry cap, `console.debug` mirror).

**Patterns:**

- Persistent/diagnostic failures use `debugLog('SCREAMING_SNAKE_CODE', message)` — `'STORAGE_DEBOUNCE_FLUSH_FAILED'` (`src/core/theme/chromeStorageAdapter.ts:155`), `'THEME_SYNC_WRITE_FAILED'` (`src/core/theme/ThemeSync.ts:116`), `'SIDEPANEL_STANDALONE_OPEN_FAILED'` (`entrypoints/sidepanel/main.tsx:52`).
- `console.debug` only in background advisory handlers: `console.debug('[BG] Content script ready:', tabId, url)` (`src/core/messaging/BackgroundRouter.ts:44,51`).
- `console.error` is limited to two places: MessageBus handler-aggregate errors (`src/core/messaging/MessageBus.ts:56`) and `'AI Stream Error:'` (`src/services/aiProvider.ts:453`).
- `console.log` only once at service-worker boot (`entrypoints/background.ts:9`).
- Redaction rule: never log raw prompts, API keys, cookies, or customer bodies; go through redaction per `.opencode/skills/nowpilot-security-review/SKILL.md`.

## Comments

**When to Comment:**

- **Decision-tagged rationale is the dominant convention.** Comments cite spec decision IDs and phase references so future phases can trace intent: `D-22`, `D-10`, `D-16 / REQ-R05`, `T-01-10`, `Plan 01-07`. ~50 `D-XX` and ~26 `REQ-` references exist in source.
- Explain *why* and invariants, not *what* — e.g. the re-entrancy note in `chromeStorageAdapter.ts:63-65`, the allSettled sync-throw note in `MessageBus.ts:33-39`.
- Permanent constraints get explicit prohibition comments: "Do NOT add a fetch(.) call in this file" (`entrypoints/content/core.content.ts`), "Do NOT re-add any non-Phase-1 permission" (`wxt.config.ts:29-35`).
- Temporary scaffolds are marked with an explicit upgrade point: `SWAP POINT (Phase 2): replace with leader-election...` (`src/core/workspace/WorkspaceStore.ts:15`).

**JSDoc/TSDoc:**

- Block JSDoc on exported functions/constants where behavior is non-obvious: migrations (`chromeStorageAdapter.ts:173-189`, `useExtensionStore.ts:546-554`), `testProviderConnection` docs (`src/services/aiProvider.ts:15-37`), `createEnvelope`/`isEnvelope` (`RuntimeEnvelope.ts:30-46`).
- Test-only exports use a banner comment plus `__test__` namespace: `src/core/theme/chromeStorageAdapter.ts:226-247`.

## Function Design

**Size:** No enforced limit; utilities are 5–80 lines, components range widely (largest hands-on components: `src/components/notes/NotesWorkspace.tsx` 2564 lines, `src/components/options/OptionsPage.tsx` 1977 lines). Keep new components under a few hundred lines where possible.

**Parameters:**

- Components receive explicit callback props (`onSend`, `onOpenOptions`, `onRefocus`) rather than importing stores when they are reusable presentational pieces — `src/components/common/MirrorBanner.tsx:4-6`, `src/components/chat/ChatComposer.tsx:18-49`
- Cross-module side effects use a dependency-injection "deps" object so tests can inject spies: `SidepanelCommandDeps` / `StandaloneCommandDeps` (`src/core/commands/registerWorkspaceCommands.ts:24-29, 99-104`)
- Defaults for optional booleans: `disabled = false` (`ChatComposer.tsx:55`), `includeStarred = true` (`useExtensionStore.ts:321`)

**Return Values:**

- Explicit `: void` on actions, `: Promise<T>` on async APIs
- Registration functions return an unsubscribe/cleanup closure: `on()` → `() => void` (`EventBus.ts:16`), `registerStandaloneCommands()` → `() => void` (`registerWorkspaceCommands.ts:106`)
- Store actions return values when callers need them: `createNewSession(): string` (`useExtensionStore.ts:184`), `saveTextAsNote(...): NoteItem` (`useExtensionStore.ts:475`)

## Module Design

**Exports:**

- Named exports everywhere in `src/`; only WXT entrypoints use `export default` (`defineBackground`, `defineContentScript`) — 3 default exports total.
- Components: `export const X: React.FC<XProps> = (...) => {}` (53 `React.FC` usages); one class component exists for error boundaries — `src/core/components/ErrorBoundary.tsx`.

**Singletons:**

- Module-level `Map` singletons with matching deregistration — `CommandRegistry` (`src/core/commands/CommandRegistry.ts:9`), `EventBus` (`src/core/events/EventBus.ts:7`), `MessageBus` (`src/core/messaging/MessageBus.ts:8`). Always expose `unregister`/`off` and delete empty entries to avoid leaks.
- Idempotent init guards: `let initialized = false` (`MessageBus.ts:60-75`), `_lifecycleInstalled` (`chromeStorageAdapter.ts:108-112`).

**Zustand stores:**

- Canonical shape: `create<State>()(persist(immer((set, get) => ({...})), { name, storage: createJSONStorage(() => adapter), partialize, version: 1, migrate }))` — `src/store/useExtensionStore.ts:143-544`, `src/core/theme/ThemeStore.ts:72-139`, `src/core/workspace/WorkspaceStore.ts:84-172`.
- Always provide `partialize` to exclude transient fields and `version` + `migrate`; `version: 1` means "current schema, throw-free no-op".
- Cross-surface propagation: `BroadcastChannel` via `src/core/runtime/BroadcastBus.ts`, guarded by `typeof BroadcastChannel !== 'undefined'`.

**Test seams in production modules:**

- Export a `__test__` object for test-only control (timer injection, pending state reset) with an explicit "production code must NOT use these" comment — `src/core/theme/chromeStorageAdapter.ts:226-247`. Follow this pattern rather than exporting internals directly.

**i18n:**

- `t('namespace.key')` from `src/core/i18n/strings.ts`; keys are dotted namespaces (`'chat.empty'`, `'options.error'`). New user-facing strings should use `t()`; some scaffold components still ship literal English (e.g. `MirrorBanner` caption is spec-verbatim text and intentionally literal).

## Project-Specific Rules (from spec + `.opencode/skills/`)

- **Never invent identifiers** — file paths, type names, storage keys, message types, provider IDs, workflows, error codes come from the spec appendices (spec §0.5.1). Known code/spec drift to be careful with: `src/types/index.ts` uses provider IDs `'openai' | 'gemini' | 'webapp' | 'claude'`, while spec §0.2 names `'openai' | 'anthropic' | 'gemini' | 'ollama'`; do not add a third spelling.
- **Every public module boundary should get a Zod schema + fixture test** (spec §0.3). `zod` is installed but not yet imported anywhere — apply it to new public boundaries.
- **Content scripts are extraction-only**: no UI, no `fetch(`, no Shadow DOM, no host-page writes (`entrypoints/content/core.content.ts`; `tests/isolation/cross-entrypoint-imports.test.ts`).
- **Surface isolation**: never import `src/components/standalone/**` from `chat/**` or `options/**` (and vice versa). Shared code belongs in `src/core/**`, `src/types/**`, `src/services/**`, `src/components/common/**` (`tests/isolation/cross-entrypoint-imports.test.ts`).
- **Background service worker** registers listeners synchronously at module top level and never calls AI providers or IndexedDB (`entrypoints/background.ts`; `wxt.config.ts`).
- **Manifest permissions are least-privilege** — the current set is exactly `['sidePanel', 'storage', 'tabs']` plus ServiceNow host permissions. Never add one silently (`wxt.config.ts:36-40`).
- **Banned packages:** tailwindcss, shadcn/ui, `@radix-ui/*`, clsx, tailwind-merge, framer-motion (use `motion` from `motion/react`), `@ant-design/x-sdk`, `@ant-design/x-card`, `openai`/`@anthropic-ai/sdk`/`@google/generative-ai`, ulid/uuid (spec §0.2).
- **Every phase ships a `verify:phase-N` npm script** that runs `tsc --noEmit` plus the phase's focused tests (spec §0.3; see `package.json` scripts).
- **Canonical wording:** use `standalone` (not "full app" / "app.html") and "Standalone view"; Side Panel is Chat-only and exposes Workflow selection, not a raw model picker.

---

*Convention analysis: 2026-09-20*
