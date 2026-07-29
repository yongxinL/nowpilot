# External Integrations

**Last updated:** 2026-07-28

## APIs & Services

### Google Gemini API
- **Usage:** Primary AI provider for generating chat responses via streaming
- **SDK:** `@google/genai` v2.4.0
- **Endpoint:** `gemini-2.5-flash` model used in `server.ts`
- **Auth:** API key passed via `GEMINI_API_KEY` environment variable, or client-provided `geminiKey` from the chat request body
- **Integration point:** `server.ts` — `GoogleGenAI` instance created per request; content streamed via `ai.models.generateContentStream()`
- **Fallback:** If Gemini call fails, the server falls back to a simulated response stream (predefined text tokenized and sent word-by-word)

### OpenAI (Custom Proxy)
- **Usage:** OpenAI provider with custom baseURL for OpenAI-compatible endpoints (covers both OpenAI and compatible providers)
- **Default baseURL:** `https://api.openai.com/v1` (configurable per-provider in settings)
- **Auth:** API key encrypted with AES-GCM-256 via CryptoService (see Phase 2), stored in chrome.storage.local
- **Integration point:** Uses `@ai-sdk/openai` with resolved baseURL from ProviderRegistry
- **Note:** All provider API calls go through the browser directly (no server proxy in v0.1+ architecture)

### Anthropic Claude API
- **Usage:** Configured as an AI provider option
- **Default proxy URL:** `https://api.anthropic.com`
- **Auth:** API key stored in `localStorage`
- **Models configured:** `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`
- **Note:** Claude is listed in the provider configuration UI but not currently implemented in the server-side chat handler (`server.ts` does not route to Anthropic API)

### Ollama (Local AI)
- **Usage:** Local LLM inference via Ollama
- **Default proxy URL:** `http://localhost:11434`
- **Auth:** No API key required (local service)
- **Models configured:** `llama3.2`, `deepseek-r1:8b`, `qwen2.5-coder:7b`
- **Note:** Ollama is listed as a provider option in the UI but not currently wired into the server chat handler

### ChatGPT Webapp (Service Provider Option)
- **Usage:** Alternative service provider selection (configured via UI as "ChatGPT Webapp" vs "Custom API Key")
- **Note:** This is a conceptual/UI-only option — no ChatGPT webapp API integration is implemented in the server

## Data Stores

### Local Storage (Browser)
- **Purpose:** Primary data persistence for the Chrome extension
- **Keys used:**
  - `nowpilot_config` — Provider configurations, theme, language, font size, translate preferences
  - `nowpilot_sessions` — Chat session history with messages
  - `nowpilot_prompts` — Saved prompt templates
- **Location:** `src/store/useExtensionStore.ts` — React hook using `useState` + `useEffect` to sync to `localStorage`
- **Format:** JSON-serialized

### File System (Server)
- **Purpose:** Static file serving for production builds
- **Location:** `dist/` directory — Vite-built frontend assets served by Express

### No Database
- The application has no database integration (no SQL, NoSQL, or ORM dependencies)
- No server-side persistence beyond static file serving

## File Storage
- **None.** No cloud file storage (S3, GCS, etc.) or local file system storage for user content

## Caching
- **None.** No dedicated caching layer (Redis, Memcached, etc.)

## Authentication & Identity

### Auth Provider
- **None.** No authentication service integrated
- The Options page displays a hardcoded user profile ("George Li" / "oraclexp@hotmail.com") for UI mockup purposes only
- API keys for AI providers are stored in `localStorage` and sent directly from client to server
- **Security note:** API keys are transmitted from browser to Express server and proxied to AI providers — no encryption or token management is implemented

## Monitoring & Observability

### Logging
- **Console logging only** — `console.log` and `console.warn` statements in `server.ts`, `entrypoints/background.ts`, `entrypoints/content.ts`
- No structured logging, log levels, or log aggregation

### Error Tracking
- **None.** No error monitoring service (Sentry, DataDog, etc.)

## CI/CD & Deployment

### Hosting
- **Self-hosted Node.js server** — Express server on port 3000
- **Chrome Web Store** — Target distribution platform for the extension (manifest version 3)

### CI Pipeline
- **None.** No CI configuration files detected

## Environment Configuration

### Required Environment Variables

| Variable | Required | Used In | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | For Gemini AI | `server.ts` | Google Gemini API authentication |
| `NODE_ENV` | No | `server.ts` | Controls dev/production mode |
| `DISABLE_HMR` | No | `vite.config.ts` | Disables Vite HMR for AI Studio |

### Secrets Location
- AI provider API keys stored in browser `localStorage` (persisted client-side)
- `GEMINI_API_KEY` can be set as environment variable (server-side)
- No `.env` files committed to repository (gitignored)

## Webhooks & Callbacks

### Incoming
- **None.** No incoming webhook endpoints

### Outgoing
- **None.** No outgoing webhook callbacks

## Browser APIs (Chrome Extension)

### Chrome Permissions
- `storage` — Persistent extension storage
- `activeTab` — Access current tab context
- `scripting` — Inject content scripts
- `sidePanel` — Chrome Side Panel API
- `contextMenus` — Context menu integration

### Chrome APIs Used
- `chrome.sidePanel` — `setPanelBehavior({ openPanelOnActionClick: true })` in `entrypoints/background.ts`
- `chrome.runtime.onMessage` — Message passing for tab context in `entrypoints/background.ts`
- `chrome.runtime.sendMessage` — Content script communication (conceptual, via `window.getSelection()` in `entrypoints/content.ts`)

## Translation Service

- **Purpose:** Page translation feature configured in Options
- **Method:** Uses the configured AI provider model (default: `MiniCPM5-1B-OptiQ-4bit`) for translation
- **Target languages:** English, Simplified Chinese, Traditional Chinese, Japanese
- **Display modes:** Bilingual (original + translation) or Translation only
- **Display styles:** None, Underline, or Weaken (faded) for translated text
- **Note:** Translation is listed as a UI feature concept — no dedicated translation API integration is implemented

---

*Integration audit: 2026-07-28*
