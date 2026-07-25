# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

NowPilot is a privacy-first Chrome MV3 extension (WXT + React 19 + Ant Design v6) that provides AI chat, agent tool-calling, atomic notes, and ServiceNow support-engineer integrations. Everything runs against user-configured AI providers (OpenAI, Anthropic, Google, Ollama, OpenAI-compatible via `@ai-sdk/*`); no data leaves the machine unless the user configures a cloud provider.

This repo is managed with the **GSD planning framework** — see `.planning/` for the roadmap, phase plans, and architecture research. `.planning/PROJECT.md` is the living source of truth for requirements/decisions; `.planning/ROADMAP.md` and `.planning/STATE.md` track phase progress. `.planning/research/ARCHITECTURE.md` has a deep architecture writeup (some of it describes target-state naming, e.g. "Full App Tab" — the actual entrypoint/surface name in code is `standalone`, not `app`).

## Commands

```bash
pnpm dev          # wxt dev server (loads unpacked extension with HMR)
pnpm build        # wxt build → dist/
pnpm test         # vitest run (jsdom environment, tests/**/*.test.ts[x])
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint .
pnpm format       # prettier --write .
```

Run a single test file: `pnpm vitest run tests/core/ai/pipeline/AgentOrchestrator.test.ts`
Run tests matching a name: `pnpm vitest run -t "circuit breaker"`

Package manager is **pnpm** (pnpm-lock.yaml is authoritative; package-lock.json also exists but don't use npm to install).

There is no `verify:all` / `test:perf` / `test:isolation` script yet — those are planned for Phase 9 (Hardening). The isolation and no-addon-import guard tests (below) already run as part of the plain `pnpm test` suite.

## Architecture

### Four execution contexts, one strict rule: AI never runs in the background service worker

- **Background SW** (`src/entrypoints/background.ts`) — ephemeral (~30s lifetime). Only does message routing/validation (`RuntimeEnvelope`/`validateEnvelope`), lifecycle setup (`onInstalled`/`onStartup`), tab/panel routing, and CORS proxying. It cannot run providers, MCP, EventSource, or IndexedDB. Never store state in SW globals — use `chrome.storage` and re-register listeners synchronously on every load.
- **Side Panel** (`src/entrypoints/sidepanel/`) and **Standalone tab** (`src/entrypoints/standalone/`) — both mount the *same* core AI runtime and storage layer; they differ only in shell/layout (compact vs default AntD density) and which pages are registered. Never import across `entrypoints/sidepanel/` ↔ `entrypoints/standalone/`.
- **Content script** (`src/entrypoints/content.ts` + `src/core/content/*`) — extraction-only. Zero React/AntD/UI imports, enforced by `tests/isolation/no-content-script-ui.test.ts`. Detects SPA navigation via `SPANavigationWatcher` (MutationObserver, no polling) and ships `PageContext` up via `PageContextBridge`.
- **Popup** (`src/entrypoints/popup/`) — minimal, separate from the two above.

### Core vs. add-ons — the boundary that's actually enforced

`src/core/` owns AI runtime, storage, messaging, memory, telemetry, registries, and shared UI. `src/addons/` (`servicenow`, `teamgqm`, `write`, `global`) own site/feature-specific pages, skills, and context extraction, and register into core through `AddonRegistry` / `registerNowPilotCorePages.ts`-style registration files.

This is enforced by ESLint (`eslint.config.mjs` — `no-restricted-imports` blocks `*/addons/*` from anywhere) **and** by `tests/core/no-addon-imports.test.ts`, which greps every file under `src/core/` for `addons/` import paths. If you add a core file that needs an addon type, invert the dependency — addons import core, never the reverse.

Core (non-addon) pages register via `registerCorePages({ id, label, icon, component, order, registerOn: ['sidepanel'|'standalone'] })` (see `src/core/registries/registerNowPilotCorePages.ts`), which fans out into `SidepanelPageRegistry` / `StandalonePageRegistry`. Add-ons register pages/skills/settings through `AddonRegistry` (`src/core/registries/AddonRegistry.ts`), gated by an enable/disable map persisted to `chrome.storage.local` under `np_addon_enabled`.

### Planner → Executor → Renderer pipeline (`src/core/ai/pipeline/`)

The central pattern for making cheap models (Haiku/Flash tier) drive tool-calling reliably without unbounded agent loops:

- `PlannerService` — cheap JSON-only decision (`answer` / `run_tool` / `ask_clarification`), short timeout.
- `ExecutorService` — deterministic validation + execution. The LLM never runs tools directly; tool names are checked against a closed enum and a permission policy (`src/core/permissions/`) before running.
- `RendererService` — turns validated tool output into the final streamed answer.
- `AgentOrchestrator` — owns the bounded Planner↔Executor loop and enforces tier-based step caps (tiny/small/medium/large context tiers → different max planner/tool calls; see `TierResolver`/`ModelContextTier`).

Never call `@ai-sdk/*` / provider adapters directly from a component or hook — always go through `AgentOrchestrator.runTurn()` so `ContextOptimizer` (token budgeting), `MemoryEngine` (memory injection), and `AITransactionLog` (tracing) stay in the loop. `ProviderRouter` (`src/core/ai/router/`) handles provider selection, retry, fallback, and circuit breaking (`CircuitBreaker`) — it does not switch providers once `hasStreamedFirstToken` is true.

### Cross-surface state

`useWorkspaceStore` (Zustand, `src/core/stores/workspaceStore.ts`) is the shared cross-surface state (active provider/model, pinned tabs, page context, active addon/skill, drafts). It persists through a custom `chrome.storage.local`-backed adapter that routes writes through `WriteJournal` when available (falls back to direct `chrome.storage.local.set` if WriteJournal is unavailable, e.g. in tests). Storage changes propagate cross-surface via `chrome.storage.onChanged` in `src/core/messaging/broadcastBus.ts` (there is no `BroadcastChannel` — "BroadcastBus" is a `chrome.storage.onChanged` listener registry).

Messaging layers:
- `runtimeEnvelope.ts` — typed `Envelope<T>` with a Zod schema, `source: 'background'|'sidepanel'|'standalone'|'popup'|'content-script'`. Validate untrusted `chrome.runtime.onMessage` payloads with `validateEnvelope()` before branching on `type`.
- `pageMessages.ts` — page-extraction-specific message types/schemas following the same as-const-string + Zod pattern.
- `broadcastBus.ts` — cross-surface storage-change propagation + a session-storage-based memory-write-request channel (`emitMemoryWrite`/`onMemoryWrite`).

### Storage split

Message/note bodies and large objects live in IndexedDB (`src/core/storage/stores/*DB.ts`, managed via `idb`, versioned by `IndexedDBMigrator`). Metadata, config, and encrypted provider keys live in `chrome.storage.local`/`.session`/`.sync`. Multi-step writes that touch more than one store go through `WriteJournal` (`src/core/storage/WriteJournal.ts`) for atomicity/rollback — follow this pattern (`begin` → `markStepStart`/`markStepComplete`/`markStepFailed` → `markCompleted`/`markFailed`) rather than writing to multiple stores ad hoc. API keys are AES-GCM encrypted via `EncryptedStorage`; session tokens (e.g. ServiceNow JSESSIONID) live in `chrome.storage.session` and are cleared on browser close.

### Add-ons

Each add-on under `src/addons/<name>/` follows: `register<Name>Addon.ts` (registration entry point) + `components/` (Sidepanel/Standalone page pairs) + `services/` (if it needs external calls) + `skills/` (if it exposes `AddonSkill`s). ServiceNow calls always go through the background SW's `PROXY_FETCH` (never direct fetch from a UI surface) to avoid CORS and to centralize per-addon rate limiting. When adding a new add-on, check `.planning/phases/08-add-ons-data-portability/08-PATTERNS.md` for the closest existing analog before writing new code from scratch.

## Conventions worth knowing

- TypeScript strict mode; path alias `@/*` → `src/*` (both `tsconfig.json` and `vitest.config.ts`).
- Prettier: single quotes, semicolons, trailing commas everywhere, 100-char print width, 2-space indent.
- Class-based registries/services use JS private fields (`#foo`) and export a singleton instance (e.g. `export const addonRegistry = new AddonRegistry()`), not a class the caller instantiates.
- Registries throw on duplicate registration (`register()` throws if the key already exists) rather than silently overwriting — don't swallow that error by pre-checking `has()` and skipping; fix the double-registration instead.
- Persistence helpers in stores/registries wrap `chrome.storage` calls in try/catch and log via `debugLog(...)` rather than throwing, since storage failures shouldn't crash a registry.
