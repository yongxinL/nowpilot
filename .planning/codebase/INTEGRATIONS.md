---
last_mapped_commit: fa9f6508dff633ac15be7548c3cde08535e4bab5
last_mapped_at: 2026-09-20
---
# External Integrations

**Analysis Date:** 2026-09-20

## APIs & External Services

**AI Providers (client-side, bring-your-own-key):**

- **OpenAI-compatible / custom endpoint** - default chat path. Base URL from `config.openAiBaseUrl` (default `http://localhost:12380/v1`, a local proxy) or `config.providers.openai.proxyUrl`.
  - SDK/Client: native `fetch` in `src/services/aiProvider.ts`
  - Endpoints: `POST {base}/chat/completions` (streaming, `stream: true`), `GET {base}/models` (model discovery)
  - Auth: `Authorization: Bearer ${config.openAiKey}` header
  - UI configuration: `src/components/options/OptionsPage.tsx` (PROVIDER_INFO.openai), `src/components/OnboardingModal.tsx`
- **Google Gemini** - `https://generativelanguage.googleapis.com` (or `config.providers.gemini.proxyUrl`).
  - Endpoints: `GET /v1beta/models?key=<geminiKey>`, `POST /v1beta/models/<model>:streamGenerateContent?alt=sse&key=<geminiKey>` (SSE)
  - Auth: API key passed as `key` query parameter (`config.geminiKey` / `config.providers.gemini.apiKey`)
  - Allowed in CSP `connect-src` in `wxt.config.ts`; declared as `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` in `metadata.json`
- **Anthropic Claude** - `https://api.anthropic.com` (or `config.providers.claude.proxyUrl`).
  - Endpoints for model discovery: `GET /models` with headers `x-api-key: <key>` and `anthropic-version: 2023-06-01` (`src/services/aiProvider.ts:78-98`)
  - Streaming path: `buildEndpointUrl()` routes non-Gemini providers through `config.openAiBaseUrl` (`/chat/completions`), so Claude streaming currently depends on an OpenAI-compatible base URL being configured
  - Allowed in CSP `connect-src` in `wxt.config.ts`
- **Ollama (local)** - `http://localhost:11434` (or `config.providers.ollama.proxyUrl`).
  - Endpoints: `GET /api/tags` (falls back to `GET /v1/models`), then OpenAI-compatible `/chat/completions` streaming via `openAiBaseUrl`
  - Auth: none
- **ChatGPT Webapp session** - selectable via `config.serviceProvider === 'ChatGPT Webapp'` but **not implemented in this build**: streaming calls `onError('ChatGPT Webapp session provider is not implemented in this build...')` (`src/services/aiProvider.ts:333-338`).
- **Demo simulator** - `simulateStreamResponse()` returns canned text; reachable only when `config.demoMode === true` AND `import.meta.env.DEV === true` (development builds only).

**Chrome Extension APIs:**

- `chrome.sidePanel` - `setPanelBehavior({ openPanelOnActionClick: true })` on install/startup (`entrypoints/background.ts`), `chrome.sidePanel.open({ windowId })` from the standalone shell (`entrypoints/standalone/main.tsx:22`)
- `chrome.storage.local` / `chrome.storage.sync` - the only persistence layer; see Data Storage
- `chrome.storage.onChanged` - cross-surface theme propagation listener (`src/core/theme/ThemeSync.ts:122-163`)
- `chrome.tabs.query` / `chrome.tabs.create` / `chrome.tabs.update` - standalone and options tab routing/deduplication (`src/core/workspace/WorkspaceRouter.ts`)
- `chrome.windows.getCurrent` / `chrome.windows.update` - focus existing standalone/options window (`src/core/workspace/WorkspaceRouter.ts`, `entrypoints/standalone/main.tsx`)
- `chrome.runtime` - `onMessage` listener (`src/core/messaging/MessageBus.ts:64`), `sendMessage` from the content script (`entrypoints/content/core.content.ts`), `connect` ports (`src/core/runtime/PortReader.ts`), `getURL`, `onInstalled`, `onStartup`, `reload()` (command palette)

**Content Script Injection:**

- `entrypoints/content/core.content.ts` - `matches: ['<all_urls>']`, `runAt: 'document_idle'`, `world: 'ISOLATED'`, extraction-only (no UI, no `fetch`)
- Sends two advisory typed messages through `chrome.runtime.sendMessage`: `CONTENT_SCRIPT_READY` and `SPA_NAVIGATION`, built via `createEnvelope()` in `src/core/runtime/RuntimeEnvelope.ts`
- Background handlers for both are console-only (`src/core/messaging/BackgroundRouter.ts:38-52`)

**ServiceNow (declared permission, no live calls):**

- Host permissions in `wxt.config.ts` cover `*://*.service-now.com/*` and `*://support.servicenow.com/*`
- No ServiceNow API, token, or MCP call exists in current source; the only ServiceNow references are placeholder note content in `src/components/notes/NotesWorkspace.tsx` and future-phase comments in `entrypoints/background.ts`

## Data Storage

**Databases:**

- None. No IndexedDB, SQLite, or server database code exists in `src/` or `entrypoints/` (only future-phase comments referencing an IndexedDB MemoryDB).

**Browser Extension Storage:**

- `chrome.storage.local` (primary, via debounced adapter `src/core/theme/chromeStorageAdapter.ts`):
  - `np_store` - zustand-persist key for `src/store/useExtensionStore.ts`: provider config + API keys, chat sessions, prompts, write history, notes
  - `np_workspace_store` - `src/core/workspace/WorkspaceStore.ts`: workspace/conversation IDs, pinned tabs, active surface
  - `onboardingComplete` - boolean flag written by `entrypoints/background.ts:41-48` and read/written by `src/components/chat/SidepanelChat.tsx:164,183`
- `chrome.storage.sync` (via `syncStorageAdapter`):
  - `np_theme` - theme mode + color theme (`src/core/theme/ThemeStore.ts`, key defined `:30`)
  - `np_theme_pack` - theme pack id, separate key per spec (`src/core/theme/ThemeStore.ts:31`, `src/core/theme/ThemeSync.ts:109-112`)
- Fallback: all storage adapters fall back to `localStorage` when chrome storage is unavailable (`src/core/theme/chromeStorageAdapter.ts:78-88`), e.g. running the Vite web shell outside an extension.

**File Storage:**

- Local extension assets only (`public/assets/icons/*.png`); no file upload/download or filesystem integration.

**Caching:**

- None. No service worker cache, no HTTP cache layer; the only debounce/coalescing is the 300 ms chrome.storage write debounce.

## Authentication & Identity

**Auth Provider:**

- None (no OAuth, no `chrome.identity`, no server auth).
- Users supply their own provider API keys; keys are persisted in the `np_store` config blob in `chrome.storage.local` (`config.openAiKey`, `config.geminiKey`, `config.providers.*.apiKey`).
- Connection test (`testProviderConnection` in `src/services/aiProvider.ts:165-171`) deliberately never echoes or logs the API key; errors are built from HTTP status + server error body only.

## Monitoring & Observability

**Error Tracking:**

- None (no Sentry/Bugsnag/OTel).
- React error boundary exists for UI crash containment: `src/core/components/ErrorBoundary.tsx`.

**Logs:**

- In-memory ring buffer via `src/core/log/debugLog.ts` (`debugLog(code, message, context?)`, 200 entries, console.debug mirror; `getRecentLogs`/`clearLogs` accessors).
- `console.debug`/`console.error` used directly in `src/core/messaging/MessageBus.ts`, `entrypoints/background.ts`, and `src/services/aiProvider.ts`.
- No log shipping/export path.

## CI/CD & Deployment

**Hosting:**

- Chrome extension distributed as an unpacked/build artifact; no server hosting.
- Build output `.output/chrome-mv3/` (with `dist` symlinked to it).

**CI Pipeline:**

- None. No `.github/workflows`, `.gitlab-ci.yml`, or other CI configuration exists. Builds and gates are manual pnpm scripts (`build:ext`, `verify:all`, `scripts/verify-no-tailwind.sh`).

## Environment Configuration

**Required env vars:**

- None. The project reads no `process.env` or `import.meta.env` values except Vite's built-in `import.meta.env.DEV` for demo-mode gating.

**Secrets location:**

- User-provided provider API keys live in the persisted `np_store` blob in `chrome.storage.local` (plaintext JSON; see CONCERNS for the at-rest exposure risk).
- No `.env`, `credentials.*`, or secret files present in the repository.

## Webhooks & Callbacks

**Incoming:**

- None. Extension-internal event sources only: `chrome.runtime.onMessage` (`src/core/messaging/MessageBus.ts`), `chrome.runtime.onInstalled`/`onStartup` (`entrypoints/background.ts`), `chrome.storage.onChanged` (`src/core/theme/ThemeSync.ts`), `chrome.runtime.onConnect` ports (`src/core/runtime/PortReader.ts`), `BroadcastChannel` channels `np_theme` and `np_workspace` (`src/core/runtime/BroadcastBus.ts`, `src/core/workspace/WorkspaceSync.ts`).

**Outgoing:**

- AI provider HTTP/SSE requests only (see APIs above); no outbound webhooks or telemetry callbacks.

---

*Integration audit: 2026-09-20*
