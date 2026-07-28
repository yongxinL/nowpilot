<!-- refreshed: 2026-07-28 -->
# Architecture

**Analysis Date:** 2026-07-28

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                     WXT Chrome Extension                           │
│           (Multi-entrypoint micro-frontend architecture)           │
├──────────────────┬──────────────────┬─────────────────────────────┤
│   Sidepanel UI   │  Options Page    │   Standalone Workspace      │
│  `entrypoints/   │  `entrypoints/   │   `entrypoints/             │
│   sidepanel/`    │   options/`      │   standalone/`              │
├────────┬─────────┴────────┬─────────┴──────────┬──────────────────┤
│        │                  │                     │                  │
│        ▼                  ▼                     ▼                  │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │               Background Service Worker                    │    │
│  │               Content Script (page inject)                 │    │
│  │               `entrypoints/background.ts`                  │    │
│  │               `entrypoints/content.ts`                     │    │
│  └──────────────────────────┬────────────────────────────────┘    │
│                             │                                     │
└─────────────────────────────┼─────────────────────────────────────┘
                              │ HTTP / SSE
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Express.js API Server                            │
│     `server.ts`    POST /api/chat   (Gemini/fallback streaming)    │
│                    Vite dev middleware / static file serving        │
└──────────────────────────────────────────────────────────────────┘
```

The project uses **WXT** as the extension framework, which generates separate HTML entry points for each UI surface (sidepanel, options, standalone). All entry points share the same React component library in `src/`. A companion Express server handles AI streaming chat and optionally serves the app in production mode.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| SidepanelChat | Main chat interface with message history, input, toolbars | `src/components/chat/SidepanelChat.tsx` |
| StandaloneWorkspace | Full-page mode with navigation sidebar and tool panels | `src/components/standalone/StandaloneWorkspace.tsx` |
| OptionsPage | Provider configuration, appearance, translate, prompt management | `src/components/options/OptionsPage.tsx` |
| NotesWorkspace | Knowledge base / note-taking with 3-panel layout | `src/components/notes/NotesWorkspace.tsx` |
| ChatHistoryModal | Session drawer with search, star, export, delete | `src/components/history/ChatHistoryModal.tsx` |
| PromptManagerModal | CRUD for slash-command prompt templates | `src/components/common/PromptManagerModal.tsx` |
| ModelSelector | Dropdown to select AI model | `src/components/common/ModelSelector.tsx` |
| TabContextSelector | Popover for attaching tabs, files, images, screen cuts | `src/components/chat/TabContextSelector.tsx` |
| SlashCommandModal | Popover for choosing prompt templates (triggered by `/`) | `src/components/chat/SlashCommandModal.tsx` |
| ActionPanel | Copy, regenerate, quote, share, TTS for messages | `src/components/common/ActionPanel.tsx` |
| ThoughtProcessBlock | Collapsible "thinking" block with markdown rendering | `src/components/chat/ThoughtProcessBlock.tsx` |
| useExtensionStore | Custom hook; app state persisted to localStorage | `src/store/useExtensionStore.ts` |
| streamChatResponse | SSE fetch client for /api/chat | `src/services/aiProvider.ts` |

## Pattern Overview

**Overall:** Multi-entrypoint Chrome Extension + SPA + Express backend server

**Key Characteristics:**
- **WXT-idiomatic entrypoints**: Each browser UI surface (sidepanel, options, standalone) has its own `index.html` + `main.tsx` in `entrypoints/*/`. Background and content scripts are flat files in `entrypoints/`.
- **Shared component library**: All entry points import React components from `src/components/`, preventing code duplication.
- **Server-side AI streaming**: The Express server (`server.ts`) runs the AI provider integration (Gemini API) and streams responses via Server-Sent Events (SSE) — not from the browser directly.
- **localStorage persistence**: App state (config, sessions, prompts) is persisted via `localStorage` through a custom React hook, not a state management library.
- **Tailwind-first styling**: UI uses Tailwind CSS utility classes extensively for layout, with Ant Design theme tokens for component-level theming.

## Layers

**Entrypoints Layer:**
- Purpose: Browser-visible surfaces and extension background logic
- Location: `entrypoints/`
- Contains: `background.ts`, `content.ts`, `sidepanel/main.tsx`, `options/main.tsx`, `standalone/main.tsx`
- Depends on: `src/components/*`, `src/styles/theme.ts`, `src/index.css`
- Used by: Chrome browser (extension loading)

**Presentation Layer (React Components):**
- Purpose: All UI components organized by domain
- Location: `src/components/`
- Contains: `chat/`, `common/`, `history/`, `notes/`, `options/`, `standalone/`
- Depends on: `src/store/`, `src/types/`, `src/services/`, `src/styles/`
- Used by: Entrypoints

**State Layer:**
- Purpose: Centralized app state management and persistence
- Location: `src/store/useExtensionStore.ts`
- Contains: Config (providers, models, appearance), chat sessions, prompts, attachments, tab context state
- Depends on: `src/types/`
- Used by: Components

**Service Layer:**
- Purpose: External communication (AI API calls)
- Location: `src/services/aiProvider.ts`
- Contains: `streamChatResponse()` — SSE client that POSTs to `/api/chat`, model listing
- Depends on: `src/types/`
- Used by: `SidepanelChat`

**Types Layer:**
- Purpose: Shared TypeScript type definitions
- Location: `src/types/index.ts`
- Contains: `ProviderConfig`, `Message`, `ChatSession`, `Attachment`, `PromptItem`, `TabItem`, `ToolItem`, etc.
- Depends on: Nothing
- Used by: All layers

**Styles/Themes Layer:**
- Purpose: Ant Design theme config and global CSS
- Location: `src/styles/theme.ts`, `src/index.css`
- Contains: `getAppTheme()` (light/dark theme tokens), Tailwind CSS utilities, custom scrollbar and popover overrides
- Depends on: `antd`
- Used by: Entrypoints and components

**Server Layer:**
- Purpose: Express.js backend for AI chat and dev/prod static serving
- Location: `server.ts` (project root)
- Contains: `POST /api/chat` — SSE streaming endpoint (Gemini API with simulated fallback), Vite dev middleware, static production serving on port 3000
- Depends on: `express`, `vite`, `@google/genai`, `dotenv`
- Used by: Browser fetch calls from `src/services/aiProvider.ts`

## Data Flow

### Primary Request Path (AI Chat)

1. **User input** — User types message in `SidepanelChat` textarea, presses Enter (`SidepanelChat.tsx:579-583`)
2. **State update** — `addMessageToActiveSession()` stores user message in `useExtensionStore` (`SidepanelChat.tsx:115`)
3. **API call** — `streamChatResponse()` POSTs to `/api/chat` with messages, prompt, modelId, provider, keys, attachments (`src/services/aiProvider.ts:28-44`)
4. **Server processing** — Express route handler receives request, creates `GoogleGenAI` client, calls `ai.models.generateContentStream()` with Gemini model, streams SSE chunks (`server.ts:16-81`)
5. **SSE streaming** — Client reads response body with `ReadableStream.getReader()`, parses `data:` lines, separates text and thought chunks (`aiProvider.ts:51-89`)
6. **State update** — `updateLastAssistantMessage()` accumulates chunks into the current assistant message (`SidepanelChat.tsx:149-154`)
7. **UI render** — React re-renders message list via `activeSession.messages` (scrolls to bottom via `scrollRef`)

### Configuration Flow

1. User opens Options page → `OptionsPage.tsx` reads `config` from `useExtensionStore`
2. User modifies settings (theme, provider, model, language) → `updateConfig()` updates state
3. `useEffect` in store persists config to `localStorage` under key `nowpilot_config`
4. Other components read `config` from store on mount

### Extension Lifecycle Flow

1. Chrome loads extension → `background.ts` initializes service worker, sets sidepanel behavior
2. User clicks extension icon → sidepanel opens at `entrypoints/sidepanel/index.html`
3. Content script (`content.ts`) injects into browser tabs for text selection / DOM inspection
4. Sidepanel components communicate with background via `chrome.runtime.onMessage` for tab context

## Key Abstractions

**useExtensionStore (State Hook):**
- Purpose: Single source of truth for all app state; wraps `useState` + `useEffect` for localStorage persistence
- Examples: `src/store/useExtensionStore.ts`
- Pattern: Custom React hook (not a library like Zustand/Redux). Returns state values and mutation functions. State is initialized from localStorage with fallback to hardcoded defaults.

**streamChatResponse (Service Client):**
- Purpose: Abstract SSE streaming fetch for AI chat across any provider
- Examples: `src/services/aiProvider.ts`
- Pattern: Accepts a params object with callbacks (`onChunk`, `onDone`, `onError`) and an optional `AbortSignal`. Reads `ReadableStream` line-by-line, parses SSE `data:` events. All provider routing is on the server side.

**getAppTheme (Theme Factory):**
- Purpose: Generates Ant Design `ThemeConfig` for light/dark mode
- Examples: `src/styles/theme.ts`
- Pattern: Pure function that returns a theme config object with token overrides and component-level styles. Called in each entrypoint's root component wrapping `<ConfigProvider>`.

**Attachments (Domain Model):**
- Purpose: Represent multimodal context (images, tab references, quotes, screen captures, documents)
- Examples: `src/types/index.ts:11-17` — `Attachment` interface with `type` union
- Pattern: Simple data objects managed in store. Each attachment has a unique ID, type discriminator, title, optional content/URL/thumbnail. Rendered by `AttachmentBar.tsx` and added via `TabContextSelector.tsx`.

## Entry Points

**Background Service Worker:**
- Location: `entrypoints/background.ts`
- Triggers: Chrome extension load/install
- Responsibilities: Set sidepanel behavior (`openPanelOnActionClick`), listen for `GET_ACTIVE_TAB_CONTEXT` messages via `chrome.runtime.onMessage`

**Content Script:**
- Location: `entrypoints/content.ts`
- Triggers: Page load on all URLs (`<all_urls>`)
- Responsibilities: Listen for `mouseup` events to capture text selection (quote feature scaffolding)

**Sidepanel UI:**
- Location: `entrypoints/sidepanel/main.tsx` + `index.html`
- Triggers: User clicks extension icon (opens side panel in Chrome)
- Responsibilities: Render `SidepanelChat` component in a side panel context. Wraps with `ConfigProvider` and `App`

**Options Page:**
- Location: `entrypoints/options/main.tsx` + `index.html`
- Triggers: User navigates to `chrome://extensions` → extension details → Options, or calls `chrome.runtime.openOptionsPage`
- Responsibilities: Render `OptionsPage` component. Wraps with `ConfigProvider` and `App`

**Standalone Workspace:**
- Location: `entrypoints/standalone/main.tsx` + `index.html`
- Triggers: User opens the standalone HTML page (e.g., in a new tab)
- Responsibilities: Render `StandaloneWorkspace` component for full-page mode. Wraps with `ConfigProvider` and `App`

**Express API Server:**
- Location: `server.ts`
- Triggers: `npm run dev` / `npm start`
- Responsibilities: Serve `POST /api/chat` (SSE streaming AI endpoint), serve Vite dev middleware in development, serve static `dist/` in production, listen on port 3000

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop. Server uses `express` synchronously. No worker threads.
- **Global state:** Module-level `DEFAULT_CONFIG`, `INITIAL_SESSIONS`, `INITIAL_PROMPTS`, and `INITIAL_TABS` defined as constants in `src/store/useExtensionStore.ts`. These are initial values, not mutable singletons.
- **localStorage persistence boundary:** All application state is persisted in the browser via `localStorage`. The Express server has no database — it relies on client-provided API keys. State resets on browser cache clear.
- **Circular imports:** No circular dependency chains detected. Dependency direction is: `types/` ← `services/` ← `store/` ← `components/` ← `entrypoints/`. `services/`, `store/`, and `types/` do not import from `components/`.

## Anti-Patterns

### Simulated / Hardcoded Data

**What happens:** Several components rely on hardcoded mock data or simulated delays instead of real API integrations:
- `SidepanelChat.tsx:132-135` — Followup suggestions are hardcoded strings
- `TabContextSelector.tsx:50-59` — File attachment sets dummy content `[Attached Document: ${file.name}]`
- `StandaloneWorkspace.tsx:98-102` — `handleRunTool` uses `setTimeout` with hardcoded result text
- `NotesWorkspace.tsx:284-288` — AI summary regeneration is a simulated `setTimeout`

**Why it's wrong:** These placeholders give users a false sense of capability. The features appear functional but don't actually process data, leading to confusion and limiting real-world usefulness.

**Do this instead:** Replace each with a real integration or add clear "Coming soon" / disabled states. For `StandaloneWorkspace.tsx`, use the `streamChatResponse` service instead of fake data.

### API Keys Sent via Client

**What happens:** In `src/services/aiProvider.ts:33-41`, API keys (`openAiKey`, `geminiKey`) are sent as JSON body to the backend `/api/chat` endpoint. The server then uses these keys to authenticate with AI providers.

**Why it's wrong:** While the backend is owned by the same app, sending keys over HTTP (even loopback) introduces a MITM risk surface. The keys are stored in `localStorage` and sent on every chat request.

**Do this instead:** Consider a proxy approach where the server holds a single server-side key, or use a secure token exchange. Alternatively, run the AI client directly in the browser with `fetch()` to provider APIs (with proper CORS handling), avoiding the middleman for key transit.

### Large Component Files

**What happens:** `SidepanelChat.tsx` (660 lines), `OptionsPage.tsx` (~1200+ lines), `StandaloneWorkspace.tsx` (372 lines), and `NotesWorkspace.tsx` (~1100+ lines) are all single-component files containing extensive JSX, inline handlers, and business logic.

**Why it's wrong:** These mega-components violate the single-responsibility principle. They mix presentation, state management, event handling, and styling (via Tailwind classes in JSX) in one file. Changes to one area risk breaking unrelated functionality.

**Do this instead:** Extract sub-components for logical sections (e.g., `OptionsPage` → split ProviderGrid, AppearanceSettings, TranslateSettings as separate files). Extract business logic into custom hooks or utility functions outside the component file.

## Error Handling

**Strategy:** Minimal error handling with fallback mechanisms.

**Patterns:**
- **SSE stream errors** — If the Gemini API call fails in `server.ts:53-55`, the server logs the error and falls back to a simulated streaming response (word-by-word with delays).
- **HTTP errors in streamChatResponse** — `aiProvider.ts:46-49`: non-OK responses are parsed for JSON error body or fallback to `HTTP error ${status}`.
- **Abort handling** — `aiProvider.ts:93-94`: `AbortError` is silently caught (stream was cancelled by user). All other errors are logged and passed to the `onError` callback.
- **JSON parse errors on SSE boundary** — `aiProvider.ts:84-86`: parse failures during partial SSE line reads are silently ignored.
- **localStorage parse errors** — `useExtensionStore.ts:197-208`: if stored JSON is corrupt, falls back to `DEFAULT_CONFIG`.

## Cross-Cutting Concerns

**Logging:** Uses `console.log`, `console.warn`, `console.error` directly. No structured logging library. Background service worker logs on init (`background.ts:5`). Content script logs on page load (`content.ts:5`).

**Validation:** Minimal input validation. Forms use Ant Design `Form` component with basic required-field rules (`PromptManagerModal.tsx:108-109`). No schema validation (Zod, Yup) used.

**Authentication:** No user authentication in the traditional sense. AI provider authentication is handled via API keys stored in `localStorage` and sent to the server. The server uses `process.env.GEMINI_API_KEY` as a fallback when no client key is provided (`server.ts:24`).

---

*Architecture analysis: 2026-07-28*
