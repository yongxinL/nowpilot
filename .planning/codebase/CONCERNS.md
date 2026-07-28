# Codebase Concerns

**Analysis Date:** 2026-07-28

## Technical Debt

### No test coverage
- **Issue:** The codebase has zero tests — no `.test.ts`, `.spec.ts`, or `__tests__` directories exist anywhere.
- **Files:** Entire project (`src/`, `entrypoints/`, `server.ts`)
- **Impact:** Any refactoring or feature addition risks regression without verification. Critical AI chat and provider configuration flows are completely unguarded.
- **Fix approach:** Add Vitest test suite starting with unit tests for `aiProvider.ts`, `useExtensionStore.ts`, and key component logic. Add integration tests for the `/api/chat` endpoint.

### Monolithic components exceed 1000 lines
- **Issue:** Two components (`OptionsPage.tsx` and `NotesWorkspace.tsx`) are >1000 lines each, violating the single-responsibility principle.
- **Files:** `src/components/options/OptionsPage.tsx` (1090 lines), `src/components/notes/NotesWorkspace.tsx` (1064 lines)
- **Impact:** Hard to reason about, test, or modify. Any change risks breaking unrelated functionality within the same file.
- **Fix approach:** Break `OptionsPage.tsx` into separate sub-components (e.g., `ProviderConfigModal.tsx`, `PromptManager.tsx`, `TranslateSettings.tsx`, `AppearanceSettings.tsx`). Break `NotesWorkspace.tsx` into `NoteList.tsx`, `NoteEditor.tsx`, `NoteSidebar.tsx`.

### TypeScript `any` type assertions defeat type safety
- **Issue:** Multiple `as any` casts bypass the type system, primarily for enum-like state setters and catch clauses.
- **Files:**
  - `src/App.tsx:74` — `setActiveView(val as any)`
  - `src/components/options/OptionsPage.tsx:351` — `setActiveTab(item.key as any)`
  - `src/components/standalone/StandaloneWorkspace.tsx:142` — `setActiveMenu(item.key as any)`
  - `src/services/aiProvider.ts:92` — `catch (err: any)`
  - `entrypoints/background.ts:1` — `declare const chrome: any;`
  - `server.ts:31-32` — `(a: any)` and `(m: any)` in map callbacks
  - `server.ts:53,71` — `catch (genAiErr: any)` and `catch (err: any)`
- **Impact:** Eliminates compiler checks for these branches, allowing runtime type errors to go undetected.
- **Fix approach:** Use proper generics, branded types, or discriminated unions for view/menu state. Use `unknown` with type guards in catch clauses instead of `any`.

### No linting or formatting configuration
- **Issue:** No ESLint config, Prettier config, or Biome config present. No `lint` script beyond `tsc --noEmit`.
- **Files:** Project root (no `.eslintrc*`, `.prettierrc*`, `biome.json`)
- **Impact:** No automated enforcement of code style, no detection of unused imports/variables, no import ordering rules.
- **Fix approach:** Add ESLint with `@typescript-eslint` rules, configure Prettier/ Biome for formatting, and add to CI pipeline.

### Hardcoded sample API keys in source code
- **Issue:** Placeholder API keys and credentials are hardcoded in the store's default config.
- **Files:** `src/store/useExtensionStore.ts:128,162,171` — `apiKey: 'sk-proj-openai-sample-key'` and `apiKey: 'sk-ant-sample-key'`
- **Impact:** If this code is forked or used as reference, developers may accidentally commit real keys in these locations. The sample keys could be mistaken for valid credentials.
- **Fix approach:** Remove hardcoded API key values from defaults. Use empty strings and rely on actual `.env` or UI input for configuration.

### Server-side only supports Gemini, despite multi-provider UI
- **Issue:** The Options UI lets users configure OpenAI, Claude, Ollama, and Gemini providers, but `server.ts` only implements the Gemini API path (`@google/genai`). All other provider selections fall through to a hardcoded simulated response.
- **Files:** `server.ts:26-56` (Gemini path), `server.ts:58-70` (simulated fallback)
- **Impact:** Users who configure OpenAI or Claude providers in the UI will see simulated (fake) responses, not real AI output. This is highly misleading.
- **Fix approach:** Implement actual API clients for OpenAI, Claude, and Ollama in `server.ts`, or remove the non-functional provider options from the UI.

### Simulated/mock data throughout the application
- **Issue:** Most features display hardcoded demo data rather than real captured content:
  - Chat history sessions are pre-populated with fake conversations (`store/useExtensionStore.ts:29-117`)
  - Tab context is hardcoded to GitHub URLs (`store/useExtensionStore.ts:186-190`)
  - Screen capture simulates with a timeout and placeholder Unsplash image (`SidepanelChat.tsx:175-183`)
  - Tool execution in StandaloneWorkspace returns a canned response (`StandaloneWorkspace.tsx:99-102`)
  - Notes workspace contains ~5 full ServiceNow demo notes (`NotesWorkspace.tsx:77-215`)
  - Regenerated responses return a hardcoded template string (`useExtensionStore.ts:320`)
  - Connection "check" is simulated with a 1-second timeout (`OptionsPage.tsx:234`)
- **Impact:** The application appears functional but does not actually perform any real data capture, tool execution, or provider validation. Users cannot rely on any feature working with real data.
- **Fix approach:** Implement real integrations for tab capture (Chrome tabs API), screen capture (chrome.desktopCapture or MediaRecorder), and tool execution. Remove or gate demo data behind a development flag.

### `useExtensionStore` is a monolithic state hook
- **Issue:** A single 433-line React hook manages all application state: config, sessions, prompts, attachments, tabs. This mixes concerns and creates a god object.
- **Files:** `src/store/useExtensionStore.ts` (433 lines)
- **Impact:** Any component that needs one piece of state gets re-rendered when unrelated state changes. Hard to extract logic, test, or scale to new features.
- **Fix approach:** Split into domain-specific stores or hooks (e.g., `useConfigStore`, `useChatStore`, `usePromptStore`, `useAttachmentStore`) using React Context or Zustand.

### No TypeScript strict mode
- **Issue:** `tsconfig.json` lacks `strict: true`, allowing implicit `any`, unchecked indexing, and loose null checks.
- **Files:** `tsconfig.json`
- **Impact:** Many type errors that strict mode would catch go undetected. Combined with existing `as any` casts, type safety is weak throughout.
- **Fix approach:** Enable `strict: true` in `tsconfig.json` and fix all resulting type errors.

### `defineBackground` and `defineContentScript` are polyfilled
- **Issue:** The entrypoint files manually define `defineBackground()` and `defineContentScript()` functions as identity wrappers instead of importing from WXT, suggesting the WXT framework is being used incorrectly.
- **Files:** `entrypoints/background.ts:26-28`, `entrypoints/content.ts:17-19`
- **Impact:** These polyfills may not correctly register with WXT's lifecycle, potentially causing extension startup failures or missed events.
- **Fix approach:** Import `defineBackground` and `defineContentScript` from `wxt/sandbox` (or use WXT's recommended export pattern).

## Known Bugs

### Streaming SSE parser splits at line boundaries incorrectly
- **Issue:** The SSE parsing logic in `aiProvider.ts` splits on `\n` and checks for `data:` prefix, but SSE messages can span multiple lines and the parsing does not handle multi-line data payloads or SSE comments.
- **Files:** `src/services/aiProvider.ts:60-89`
- **Trigger:** Server sends a response with newlines inside a JSON payload (e.g., formatted JSON, code blocks in AI output).
- **Symptoms:** Some SSE messages are silently dropped (caught by empty `catch` on line 84), leading to truncated or missing response chunks.
- **Fix approach:** Implement proper SSE parsing that handles multi-line data events and uses the SSE message boundary (`\n\n`) rather than line boundaries (`\n`).

### Simulated AI responses indistinguishable from real ones
- **Issue:** When the Gemini API call fails (line 54) or when using non-Gemini providers, the server silently falls back to a simulated response with no user-visible indication.
- **Files:** `server.ts:54-70`
- **Trigger:** Gemini API key is missing/expired, or user selects OpenAI/Claude/Ollama provider.
- **Symptoms:** Users receive completely fabricated AI responses with no error feedback, potentially relying on incorrect information.
- **Fix approach:** Return an error message to the client when the selected provider cannot be used, or clearly label fallback/simulated responses.

### AbortController not properly cleaned up on component unmount
- **Issue:** The `SidepanelChat.tsx` stores `abortControllerRef.current` but does not abort existing requests when the component unmounts or when a new request is started while one is already in flight.
- **Files:** `src/components/chat/SidepanelChat.tsx:81,141-161`
- **Trigger:** User rapidly sends multiple prompts or navigates away while generation is in progress.
- **Symptoms:** Multiple concurrent streams, stale state updates, potential memory leaks from orphaned `AbortController` instances.
- **Fix approach:** Abort any existing controller before creating a new one. Add cleanup in `useEffect` return to abort on unmount.

## Security Considerations

### API keys transmitted in plaintext to server
- **Issue:** The `streamChatResponse` function sends API keys (`openAiKey`, `geminiKey`) as part of the JSON POST body to the local server.
- **Files:** `src/services/aiProvider.ts:38-41`
- **Risk:** **HIGH** — If the dev server is bound to `0.0.0.0` (which it is), other processes on the network could intercept API keys. Any XSS vulnerability in the extension could also exfiltrate keys.
- **Current mitigation:** Only sent over localhost in development (but server listens on `0.0.0.0`).
- **Recommendations:** Use server-side key management via environment variables only; never send keys from client to server. The client should only send a session token, and the server should look up the key.

### Server listens on all network interfaces
- **Issue:** `server.ts:98` uses `app.listen(PORT, '0.0.0.0', ...)` binding to all interfaces.
- **Files:** `server.ts:98`
- **Risk:** **MEDIUM** — On shared or public networks, other machines can connect to the NowPilot server and its `/api/chat` endpoint.
- **Current mitigation:** None.
- **Recommendations:** Change to `'127.0.0.1'` (localhost only) unless remote access is specifically required.

### No input validation on `/api/chat` endpoint
- **Issue:** The server does not validate or sanitize any of the request body fields (`messages`, `prompt`, `modelId`, `provider`, `openAiKey`, `geminiKey`, etc.) before processing.
- **Files:** `server.ts:18`
- **Risk:** **MEDIUM** — Malformed requests could cause unhandled exceptions or be used for injection. API keys could contain unexpected characters.
- **Current mitigation:** Generic try/catch wrapper.
- **Recommendations:** Add request body validation using Zod or a similar schema validator. Validate that `provider` is one of the allowed values.

### API keys stored unencrypted in `localStorage`
- **Issue:** Provider API keys are stored in `localStorage` under the key `nowpilot_config` as plain JSON with no encryption.
- **Files:** `src/store/useExtensionStore.ts:193-211,230-232`
- **Risk:** **MEDIUM** — Any Chrome extension or script with access to the page's origin can read `localStorage`. Malicious extensions could steal stored API keys.
- **Current mitigation:** None.
- **Recommendations:** Use the Chrome `storage.managed` or `storage.sync` APIs with encryption. At minimum, warn users about storing keys in `localStorage`.

### No rate limiting on API endpoint
- **Issue:** The `/api/chat` POST endpoint has no rate limiting, request size limiting, or authentication.
- **Files:** `server.ts:16-81`
- **Risk:** **MEDIUM** — An attacker could flood the endpoint, exhausting the Gemini API quota or causing denial of service.
- **Current mitigation:** None.
- **Recommendations:** Add rate limiting middleware (e.g., `express-rate-limit`) and authentication for the chat endpoint.

### No CSRF/XSS protections
- **Issue:** No `helmet` middleware, no CSP headers, and no input sanitization on the Vite/Express server.
- **Files:** `server.ts`
- **Risk:** **LOW-MEDIUM** — Since this is a local dev server, risk is reduced but still present if the server is exposed.
- **Current mitigation:** None.
- **Recommendations:** Add `helmet` middleware and CSP headers to the Express server.

## Performance Considerations

### All chat messages rendered in DOM without virtualization
- **Issue:** `SidepanelChat.tsx` renders every message in the chat history as a full DOM node. No virtual scrolling or windowing is used.
- **Files:** `src/components/chat/SidepanelChat.tsx:245-473`
- **Impact:** With even 50+ messages containing thought processes and attachments, DOM size grows significantly, causing jank on mobile/low-power devices.
- **Improvement path:** Use `react-window` or `@tanstack/virtual` for message list virtualization.

### `localStorage` used for chat session persistence
- **Issue:** Entire chat histories (including all messages) are serialized to `localStorage` whenever state changes, via `useEffect` on `sessions` (and config/prompts).
- **Files:** `src/store/useExtensionStore.ts:230-240`
- **Impact:** `localStorage` has a ~5-10MB limit. Chat sessions with many messages or large AI responses will exceed this limit silently (JSON.parse/stringify will throw). Synchronous `localStorage` writes also block the main thread.
- **Improvement path:** Use `IndexedDB` (via `idb-keyval` or `Dexie.js`) for session persistence. Consider debouncing writes.

### Multiple `setTimeout` calls for simulated async operations
- **Issue:** The codebase uses `setTimeout` extensively to simulate async operations for screen capture, tool execution, connection checking, AI summary generation, and more.
- **Files:**
  - `SidepanelChat.tsx:175` (screen capture)
  - `OptionsPage.tsx:234` (connection check)
  - `OptionsPage.tsx:442` (model update feedback)
  - `StandaloneWorkspace.tsx:99` (tool execution)
  - `ActionPanel.tsx:46` (copy feedback)
  - `NotesWorkspace.tsx:286` (AI summary)
- **Impact:** These create the illusion of functionality but waste CPU cycles. More critically, they mask missing real implementations and make performance profiling useless since fake delays give unrealistic timing.
- **Improvement path:** Replace each simulated operation with its real implementation (Chrome API, fetch call, etc.). The `setTimeout` calls should be in test mocks, not production code.

### No code splitting or lazy loading
- **Issue:** All components are eagerly imported in `App.tsx`, including the massive `OptionsPage.tsx` and `NotesWorkspace.tsx`.
- **Files:** `src/App.tsx:13-18`
- **Impact:** Initial bundle includes the entire application even when only one view is visible. Increases load time for the side panel.
- **Improvement path:** Use `React.lazy()` and `Suspense` for `OptionsPage` and `NotesWorkspace`, which are only shown on specific views.

### Naive SSE stream parsing
- **Issue:** The parsing loop in `aiProvider.ts` calls `JSON.parse` inside a `try/catch` for every line, silently discarding parse errors.
- **Files:** `src/services/aiProvider.ts:74-86`
- **Impact:** Parse failures waste CPU on every chunk. More critically, partial JSON at line boundaries is silently dropped, losing response content without any recovery mechanism.
- **Improvement path:** Implement an SSE parser that accumulates partial messages and only parses complete message boundaries.

## Fragile Areas

### NotesWorkspace.tsx — 1064 lines of hardcoded demo data + UI
- **Files:** `src/components/notes/NotesWorkspace.tsx`
- **Why fragile:** Massive single file combining hardcoded demo data (140+ lines of mock ServiceNow notes), state logic, filtering, rendering, and a rich text editor UI. Any change to the data model requires updating the mock data, filtering logic, and display components simultaneously. The absence of tests makes this extremely risky to refactor.
- **Safe modification:** Extract mock data into a separate `src/components/notes/mockData.ts` file. Split UI into `NoteList`, `NoteEditor`, `NoteSidebar` sub-components.
- **Test coverage:** Zero.

### OptionsPage.tsx — 1090 lines with tightly coupled provider modal state
- **Files:** `src/components/options/OptionsPage.tsx`
- **Why fragile:** Contains provider configuration modal inline with all its state (9 separate `useState` hooks for modal state alone). The modal's save logic depends on `activeModalProviderId` to update the correct provider config, making it easy to save to the wrong provider. Hardcoded provider-specific defaults and icons create tight coupling.
- **Safe modification:** Extract the provider configuration modal into its own component with a clean prop interface. Each provider's config should be independently validated.
- **Test coverage:** Zero.

### AI provider integration — simulated fallback masks real failures
- **Files:** `src/services/aiProvider.ts`, `server.ts`
- **Why fragile:** The server silently catches Gemini API errors on line 54 and falls through to simulated responses. The client has no way to distinguish real AI output from fake text. If the Gemini API changes its SDK, the error is silently swallowed. The provider abstraction only exists on the client side — the server has no routing logic for different providers.
- **Safe modification:** Always return an explicit error to the client when AI generation fails. Never silently fall back to simulated responses in production code. Implement proper provider routing on the server.
- **Test coverage:** Zero.

### useExtensionStore — single hook managing all application state
- **Files:** `src/store/useExtensionStore.ts` (433 lines)
- **Why fragile:** Since all state is in one hook, any component calling `useExtensionStore()` re-renders when any field changes — even unrelated ones like prompts or tabs. The `localStorage` persistence effects (lines 230-240) fire on every state change, causing unnecessary writes. Mutations like `updateLastAssistantMessage` (284-311) have complex nested logic with version tracking that is difficult to reason about.
- **Safe modification:** Split into smaller hooks. Use `React.memo` and selector patterns to prevent unnecessary re-renders. Debounce `localStorage` writes.
- **Test coverage:** Zero.

### Entrypoint polyfills — WXT integration fragility
- **Files:** `entrypoints/background.ts:26-28`, `entrypoints/content.ts:17-19`
- **Why fragile:** The `defineBackground` and `defineContentScript` functions are locally defined polyfills rather than imported from WXT. These polyfills don't use WXT's internal registration mechanisms, so the extension may not initialize correctly when loaded by Chrome. Any WXT version update may break assumptions these polyfills make.
- **Safe modification:** Import from `wxt/sandbox` or use WXT's recommended export pattern. Test extension loads correctly after changes.
- **Test coverage:** Zero.

### Duplicated SVG icon components
- **Issue:** The gear/cog settings icon SVG path is duplicated verbatim in `SidepanelChat.tsx` and `StandaloneWorkspace.tsx`.
- **Files:** `src/components/chat/SidepanelChat.tsx:228` and `src/components/standalone/StandaloneWorkspace.tsx:184,210`
- **Why fragile:** Any update to the icon requires editing two files identically. Inconsistencies will occur.
- **Fix approach:** Extract reusable SVG icons into a shared `src/components/common/icons.tsx` file.

---

*Concerns audit: 2026-07-28*
