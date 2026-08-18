# External Integrations

**Analysis Date:** 2026-08-18

## APIs & External Services

**AI Model Providers (client-side `fetch`, no SDKs):**
- OpenAI-compatible Chat Completions - Main chat/streaming path
  - Endpoint: `{base}/chat/completions`; base = `config.openAiBaseUrl` (default `http://localhost:12380/v1`) or `https://api.openai.com/v1`
  - Auth: `Authorization: Bearer {config.openAiKey}` header
  - Streaming: SSE (`data:` lines, `[DONE]` sentinel); custom `textChunk`/`thoughtChunk` fields parsed
  - Files: `src/services/aiProvider.ts:91-99`, `src/services/aiProvider.ts:249-265`
  - Model listing: `GET {base}/models` → `data[].id` (`src/services/aiProvider.ts:57-62`)
- Google Gemini - Streaming + model listing
  - Endpoint: `{base}/v1beta/models/{model}:streamGenerateContent?alt=sse&key={key}` (default base `https://generativelanguage.googleapis.com`)
  - Auth: API key as URL query param `key=` (`src/services/aiProvider.ts:31`, `src/services/aiProvider.ts:94-95`)
  - Model listing: `GET {base}/v1beta/models?key=...` → `data.models[].name` stripped of `models/` prefix
- Anthropic Claude - Streaming + model listing
  - Endpoint: `https://api.anthropic.com` (configurable proxy in Options)
  - Auth: `x-api-key` + `anthropic-version: 2023-06-01` headers (`src/services/aiProvider.ts:50-55`)
  - Model listing: `GET {base}/models`
- Ollama (local) - Model listing
  - Endpoint: `http://localhost:11434` (`/api/tags`, falls back to `/v1/models`)
  - Auth: none (local)
  - Files: `src/services/aiProvider.ts:40-46`
- "ChatGPT Webapp" service mode - Simulated only: no real integration; `streamChatResponse` returns canned `simulateStreamResponse` output when `serviceProvider === 'ChatGPT Webapp'` (`src/services/aiProvider.ts:231-243`, `src/services/aiProvider.ts:101-217`)

**Provider configuration UI:**
- Onboarding wizard: `src/components/common/OnboardingWizard.tsx` (provider select, API key input, endpoint toggle, connection test via `fetchProviderModels`)
- Options > General > AI access: `src/components/options/OptionsPage.tsx:423-540` (provider grid, per-provider modal, enable/disable switches)

**ServiceNow (declared, not yet integrated):**
- `host_permissions: ['*://*.service-now.com/*', '*://*.support.servicenow.com/*']` declared in `wxt.config.ts:42-45`
- No ServiceNow API (`/api/now/*`) calls exist yet; ServiceNow references are seed/demo content only (`src/store/useExtensionStore.ts` notes/chat samples). The content script `entrypoints/content.core.ts` only reports navigation events and runs on `<all_urls>`

## Data Storage

**Databases:**
- None (no server-side DB)

**File Storage:**
- Local only: extension icons in `public/assets/icons/`; no upload/download service

**Caching:**
- Chrome in-memory fetch only; no dedicated cache layer

**Client-side persistence (Chrome Storage):**
- `chrome.storage.local` via zustand `persist` + `createJSONStorage(chromeStorageAdapter)` in `src/core/theme/chromeStorageAdapter.ts`; falls back to `localStorage` when `chrome` is undefined (webapp/tests)
- Persisted stores:
  - `np_store` - ProviderConfig, chat sessions, prompts, write history, notes (`src/store/useExtensionStore.ts:936-937`)
  - `np_theme_store` - Theme mode + color theme (`src/core/theme/ThemeStore.ts:79-81`)
  - `np_workspace_store` - Workspace/conversation routing state (`src/core/workspace/WorkspaceStore.ts:108`)
- Misc keys: `onboardingComplete` (`entrypoints/background.ts:20-22`, `src/components/chat/SidepanelChat.tsx:157`)

## Authentication & Identity

**Auth Provider:**
- Custom / None. No OAuth, no account system, no identity provider
  - Implementation: Per-provider API keys stored client-side in `ProviderConfig.providers[].apiKey` (and `openAiKey`/`geminiKey`), persisted via `np_store` in `chrome.storage.local`
  - Options page states keys "are stored locally in your browser and are never sent elsewhere" (`src/components/options/OptionsPage.tsx:476-478`)
  - Profile card in Options (`George Li / oraclexp@hotmail.com` with "Log out" button) is hardcoded UI, not backed by auth (`src/components/options/OptionsPage.tsx:404-420`)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/analytics SDKs)

**Logs:**
- `console.log`/`console.debug`/`console.error` only (e.g., `entrypoints/background.ts:8`, `src/services/aiProvider.ts:342`)
- Debug logging module: `src/core/log/debugLog.ts`

## CI/CD & Deployment

**Hosting:**
- Chrome Web Store (MV3); build output `.output/chrome-mv3` (symlinked as `dist/`)

**CI Pipeline:**
- None (no `.github/` workflows); verification is local npm scripts (`verify:*` in `package.json`)

## Environment Configuration

**Required env vars:**
- None. There are no `.env` files and no `import.meta.env`/`process.env` references. All secrets are user-provided at runtime via the Options/Onboarding UI and persisted to `chrome.storage.local`

**Secrets location:**
- `chrome.storage.local` (key `np_store` → `config.providers.*.apiKey`, `openAiKey`, `geminiKey`)
- Extension CSP restricts `connect-src` to `http://localhost:*`, `https://generativelanguage.googleapis.com`, `https://api.anthropic.com`, `https://api.openai.com` (`wxt.config.ts:64-66`)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Cross-Surface Messaging (internal, not external)

- `chrome.runtime.onMessage` message bus with `RuntimeEnvelope` typing: `src/core/messaging/MessageBus.ts`, `src/core/runtime/RuntimeEnvelope.ts`
- `BroadcastChannel` pub/sub for cross-surface sync: `np_theme` (theme changes, `src/core/theme/ThemeSync.ts`), `np_workspace` (full-app open, `src/core/workspace/WorkspaceRouter.ts`)
- Chrome runtime Ports: `src/core/runtime/PortReader.ts`

---

*Integration audit: 2026-08-18*
