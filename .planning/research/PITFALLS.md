# Domain Pitfalls

**Domain:** Chrome MV3 Extension AI Assistant (NowPilot)
**Researched:** 2026-07-10
**Confidence:** HIGH

---

## Critical Pitfalls

Mistakes that cause rewrites or major production incidents.

### Pitfall 1: Running AI Providers from the Service Worker

**What goes wrong:** AI streaming, MCP connections, or EventSource calls are placed in the background service worker. The stream dies silently at ~30 s when the SW terminates. MCP connections fail because SW can't use EventSource. IndexedDB is unavailable from the SW.

**Why it happens:** Developers coming from server-side or MV2 background pages assume the SW is a persistent background process. The `background.ts` file feels like a "backend" and AI logic naturally gravitates there.

**Consequences:** In production, AI calls fail unpredictably. Users see frozen streams with no error. MCP tools are unreachable. Debugging is extremely difficult because the SW may terminate between any two lines of code. The SW's 5-minute max execution time for a single event also means any long-running MCP connection will be killed.

**How to avoid:** Architect all AI runtime into the Side Panel and Full App Tab. The SW handles only: proxy fetch (`PROXY_FETCH`), lifecycle events (`onInstalled`, `onStartup`), context menus, and alarms. Every AI-related dependency must stay out of the SW bundle.

**Warning signs:**
- Any import of `@ai-sdk/*`, `@modelcontextprotocol/sdk`, or use of `EventSource` in `src/entrypoints/background.ts`
- Tests that pass locally but fail in production because the SW was alive during testing
- "Stream completed with no output" bugs that can't be reproduced

**Phase to address:** Phase 1 (WXT setup) and Phase 3 (AI Runtime). Enforce with a lint rule at Phase 1.

---

### Pitfall 2: Two Surfaces Writing to IndexedDB Without Coordination

**What goes wrong:** Both the Side Panel and Full App Tab write to the same IndexedDB stores simultaneously. Version conflicts cause silent data loss. Two surfaces could run the same AI call, double-spending the user's provider credits. Memory writes from one surface overwrite the other's without merge.

**Why it happens:** The dual-surface architecture is uncommon in extension development. Developers assume each surface can operate independently because they are separate `createRoot()` calls in separate HTML pages. The Zustand stores feel isolated because each surface has its own React tree.

**Consequences:** Corrupted conversation history (interleaved messages from two surfaces). Duplicated AI calls consuming provider credits. Lost memory updates when secondary surface overwrites primary's writes. Non-deterministic bugs that appear only when both surfaces are open.

**How to avoid:** Implement primary writer election via `BroadcastBus` and `chrome.storage.session`. Only the primary surface writes to IndexedDB. Secondary surfaces read and mirror `WorkspaceStore` state via BroadcastChannel messages. All writes go through `WriteJournal` for idempotency. The election uses `np_workspace_primary` in `chrome.storage.session` with compare-and-set.

**Warning signs:**
- `WorkspaceCoordinationState` is `'solo'` when both surfaces are open
- Duplicate conversations appearing after handoff from Side Panel to Full App
- Messages from one surface appearing out of order in the other surface
- `WriteJournal` recovery detecting conflicting operations with the same sequence number

**Phase to address:** Phase 1 (Workspace coordination) and Phase 2 (Storage). Write an integration test in Phase 8 that opens both surfaces and verifies data consistency.

---

### Pitfall 3: Direct AI Calls from React Components

**What goes wrong:** Developers call `streamText()` or `@ai-sdk/*` directly from React hooks or event handlers. The call bypasses `ContextOptimizer` (no token budget enforcement), `MemoryEngine` (no memory injection), `AITransactionLog` (no traces for debugging), `ProviderRouter` (no circuit breaker), and `ExecutorService` (no tool validation). The LLM receives a raw prompt with no guardrails.

**Why it happens:** Vercel AI SDK v4 makes it trivially easy to call `streamText()` from anywhere. The `@ant-design/x-sdk`'s `useXChat` hook pattern reinforces this antipattern by design — which is why `@ant-design/x-sdk` is explicitly NOT adopted. Developers reach for the simplest API first.

**Consequences:** Token budgets are ignored, causing prompts to exceed model context windows (provider error, user sees nothing). Circuit breakers don't fire on rate limits (extension spams the provider until banned). No transaction traces for debugging (can't diagnose failures). Memory is never injected (AI has no user context). Tool calls are unvalidated (LLM can execute dangerous tools). Prompt caching never engages (higher latency and cost).

**How to avoid:** All AI calls must go through `AgentOrchestrator.runTurn()`. No component imports `streamText`, `generateText`, or any `@ai-sdk/*` adapter directly. Lint rule: `no-restricted-imports` for `ai` and `@ai-sdk/*` in `src/components/**` and `src/hooks/**`. The `useChat` hook wraps `AgentOrchestrator` — it's the only approved entry point for UI code.

**Warning signs:**
- `import { streamText } from 'ai'` in any file outside `src/core/ai/`
- Components calling `model.doGenerate()` or provider SDK methods directly
- Different components assembling their own prompt sections (duplicated ContextOptimizer logic)
- `@ant-design/x-sdk` imports appearing in `package.json`

**Phase to address:** Phase 3 (AI Runtime). Phase 7 should include an architectural test that verifies no UI code calls AI providers directly.

---

### Pitfall 4: Storing Message Bodies in chrome.storage.local

**What goes wrong:** Full conversation histories, note content, and memory bodies are stored in `chrome.storage.local`. The 10 MB quota fills up after a few hundred conversations with AI-generated responses. When quota is exceeded, ALL writes to `chrome.storage.local` fail silently — including settings, API keys, and provider configs.

**Why it happens:** `chrome.storage.local` is the most convenient storage API in extensions. It's synchronous-feeling (the API returns promises but feels like key-value), well-documented, and built into every Chrome extension tutorial. Developers default to it for everything.

**Consequences:** The 10 MB `QUOTA_BYTES` limit is shared across ALL extension data. When exceeded: new API keys cannot be saved, provider configs are lost on restart, conversations silently fail to persist, the extension enters a degraded state where it appears to work but nothing saves. Users lose data without any warning.

**How to avoid:** Strict split storage: conversation metadata (id, title, status, message count — small) in `chrome.storage.local`; message bodies in IndexedDB `ChatHistoryDB` (practically unlimited, subject to disk space). Memory bodies in `MemoryDB`. Notes in `NotesDB`. Only config, metadata, and encrypted keys go in `chrome.storage.local`. Monitor quota usage and warn users before approaching the limit.

**Warning signs:**
- Properties like `content`, `body`, `text`, or `messages` in `chrome.storage.local` keys with large string values
- `chrome.storage.local.getBytesInUse()` exceeding 8 MB
- Write operations to `chrome.storage.local` failing with "QUOTA_BYTES" errors

**Phase to address:** Phase 2 (Storage). Write a test that stores 500 conversations and verifies `chrome.storage.local` usage is under 5 MB.

---

### Pitfall 5: Loading AntD in Content Script Bundles

**What goes wrong:** Content scripts import AntD components. The content script bundle balloons to 500 KB+ (AntD is ~400 KB minified). CSS injection conflicts with host-page styles. CSP `connect-src` restrictions block AntD's dynamic features like icon loading and portal rendering.

**Why it happens:** Developers want rich UI in the host page. AntD is the project's design system, so it's the natural choice. The instinct to reuse existing components across all surfaces is strong.

**Consequences:** Bundle exceeds Chrome Web Store size limits. Host-page CSS leaks corrupt AntD component appearance (a page with `!important` rules can break form inputs, modals, dropdowns). Shadow DOM can mitigate style bleed but AntD's `<style>` tag injection mechanism and portal components (`Modal`, `Drawer`, `Popover`) break inside Shadow DOM because they render to `document.body` by default.

**How to avoid:** In v0.1, content scripts are extraction-only — no UI rendering at all. In v0.2+, use Radix UI + Tailwind for injected UI (see §25 of PRODUCT_SPEC). AntD stays in extension-owned pages (Side Panel, Full App Tab) only. ESLint rule: `no-restricted-imports` for `antd` and `@ant-design/*` in content scripts and add-ons.

**Warning signs:**
- `antd` or `@ant-design/*` imports in `src/addons/**` or `src/entrypoints/content/**`
- Content script bundle > 50 KB when analyzed with `wxt build --mode production`
- WXT's content script build complaining about CSS or React dependencies

**Phase to address:** Phase 1 (WXT setup) and Phase 8 (Content scripts). `tests/isolation/no-content-script-ui.test.ts` in Phase 8 greps the output bundle.

---

## Moderate Pitfalls

### Pitfall 6: Async Event Listener Registration in Service Worker

**What goes wrong:** Event listeners (`chrome.runtime.onMessage`, `chrome.alarms.onAlarm`, etc.) are registered inside `async` callbacks or after `await` calls. The SW's synchronous startup phase completes before listeners are added.

**Why it happens:** Pattern from Node.js/server-side where async initialization is normal. Developers want to load config before registering handlers.

**Consequences:** Listeners are not registered when the SW starts, so events are silently dropped. Manifests as "it works after reload but not on first install" or "works in development but not in production." Chrome's SW lifecycle aggressively terminates the worker after the synchronous module load completes if no listeners are registered.

**How to avoid:** Register all listeners synchronously at module load (top-level scope). Move data loading into the listener handler, not around the listener registration. The `BackgroundRouter` must call `chrome.runtime.onMessage.addListener()` at module scope, never inside an async function.

```typescript
// CORRECT: register synchronously, load data in handler
chrome.action.onClicked.addListener(async (tab) => {
  const data = await chrome.storage.local.get('key');
  // use data
});

// WRONG: async registration — listeners may never be added
const data = await chrome.storage.local.get('key');
chrome.action.onClicked.addListener((tab) => { /* this might never register */ });
```

**Warning signs:**
- `await` or `.then()` before any `.addListener()` call in `background.ts`
- SW startup logs showing "cold-starting" but listeners never reach "ready"
- Chrome's `chrome://extensions` page showing "Service Worker (inactive)" immediately after load

**Phase to address:** Phase 1 (WXT setup). Template `background.ts` must register listeners synchronously.

---

### Pitfall 7: BroadcastChannel Message Deduplication

**What goes wrong:** When both Side Panel and Full App Tab use `BroadcastChannel`, a message sent by one surface is received by ALL tabs including the sender. Without deduplication, messages loop infinitely or trigger duplicate actions.

**Why it happens:** The BroadcastChannel API broadcasts to every context with the same channel name, including the sender. Developers assume it works like a pub/sub system where senders don't receive their own messages.

**Consequences:** Infinite message loops (Surface A sends update → Surface A receives update → triggers another send). Duplicate workspace state updates causing React re-renders. Workspace handoff triggers multiple tab openings. BroadcastBus traffic amplification.

**How to avoid:** Every `BroadcastBus` message must include `senderOrigin: string` (unique tab/surface identifier). Recipients check `senderOrigin !== ownOrigin` before processing. The `WorkspaceSync` module must enforce this at the protocol level. Use a per-tab UUID generated at mount time.

**Warning signs:**
- React components re-rendering 2+ times for a single workspace update
- `BroadcastBus` handler logs showing messages processed by the sender
- Tab opening count exceeding expected when clicking "Open Full App"

**Phase to address:** Phase 1 (Workspace coordination). Test with two surfaces open simultaneously.

---

### Pitfall 8: Stream State Not Surviving Side Panel Close/Reopen

**What goes wrong:** User starts an AI stream, closes the Side Panel, reopens it. The in-flight stream is lost — no error logged, no partial response saved, no abort sent to the provider. The provider continues billing until its internal timeout.

**Why it happens:** MV3 side panels are destroyed on close (the React tree unmounts). The `useStreamingLLM` hook's internal state (AbortController, chunk buffer, stream reader) is garbage collected.

**Consequences:** Provider continues streaming (and billing) for up to 30 seconds after panel close. User reopens to find no response and no error. Conversation history is corrupted — the user message exists but the assistant response is missing. If the user re-sends the message, they get charged twice.

**How to avoid:** Before unload, persist `np_active_stream` to `chrome.storage.session` with `{ operationId, conversationId, startedAt }`. On mount, check `np_active_stream` and call `AITransactionLog.markAborted(operationId)`. Send abort to provider via `AbortController.abort()` in a `beforeunload` handler. Save any partial chunks received so far.

**Warning signs:**
- Closing panel during streaming shows no abort in network tab
- Reopening panel shows no error toast about the abandoned stream
- `AITransactionLog` shows streams with `status: 'streaming'` that never transition to `'completed'` or `'aborted'`

**Phase to address:** Phase 3 (AI Runtime) and Phase 7 (Chat UI). `useStreamingLLM` must handle `beforeunload`.

---

### Pitfall 9: Silent Provider Quota Exhaustion

**What goes wrong:** A user on a free-tier API plan hits their monthly quota mid-stream. The provider returns a `429` or billing error, but the error is swallowed. The user sees "Connecting to provider..." indefinitely.

**Why it happens:** Provider SDKs return different error shapes for quota vs. rate limit vs. auth errors. Not all error paths in `AgentOrchestrator` → `ProviderRouter` → provider adapter handle the specific quota-exhaustion error codes.

**Consequences:** User has no idea their API quota is exhausted. They retry repeatedly, assuming a network issue. They waste time debugging. The app hangs in a loading state.

**How to avoid:** `ProviderRouter` must explicitly handle `RATE_LIMITED` with a quota-exhaustion variant (check error message for "quota," "billing," "insufficient_quota"). Show a specific AntD `notification.error`: "API quota exhausted for [Provider]. Wait until [reset time] or switch providers." The `ProviderRouter` circuit breaker should not open for quota errors (it's not a provider failure).

**Warning signs:**
- `RATE_LIMITED` errors lumped together without distinguishing quota vs. rate limit
- Users reporting "it just spins forever" for specific providers at month-end
- No provider-specific error message catalog

**Phase to address:** Phase 3 (ProviderRouter). Test with a mock that returns provider-specific quota error bodies.

---

### Pitfall 10: Prompt Cache Miss Cascade

**What goes wrong:** If the user's messages consistently differ from the cached sections, every request is a cache miss. The `PromptCacheManager` continues sending cache hints, adding overhead bytes to every request with zero benefit.

**Why it happens:** Cache hints (Anthropic ephemeral, Gemini cachedContent) add bytes to the request. If the cache never hits (e.g., because tool schemas or system prompts vary per request), those bytes are pure overhead. The most common cause: including dynamic data in supposedly "stable" cached sections.

**Consequences:** Higher latency (cache hint processing on provider side). Higher cost (cache write operations charged even on miss). Wasted token budget (cache hint tokens consume context window). Degraded experience on tiny/small models where every token counts.

**How to avoid:** `PromptCacheManager` must track cache hit rates. After 5 consecutive misses, disable cache hints for 60 seconds. Log cache hit/miss ratios in `AITransactionLog`. Ensure "stable" sections are truly byte-identical across calls — no dynamic timestamps, no sequence numbers, no inline counters. The tool schema section must be sorted by stable tool name.

**Warning signs:**
- `PromptTrace.promptCache.hit` is consistently `false` for more than 5 consecutive requests
- Prompt cache writes consuming tokens with no reads
- Inspecting prompt bodies shows subtle differences in supposedly "cached" sections

**Phase to address:** Phase 3 (PromptCacheManager) and Phase 4 (Context). Monitor via Phase 6 diagnostics.

---

### Pitfall 11: Storing Raw API Keys or Session Tokens in Unencrypted Storage

**What goes wrong:** API keys stored as plaintext in `chrome.storage.local` or `chrome.storage.sync`. Session tokens (`JSESSIONID`, `sysparmCK`) exposed in debug logs and export bundles.

**Why it happens:** Encryption adds complexity; developers skip it during prototyping and the TODO is never addressed. `chrome.storage.local` feels "local" and therefore "safe."

**Consequences:** API key compromise if the user's Chrome profile is accessed by malware or shared computer. Key visible in `chrome://extensions` storage viewer. Key visible in exported debug bundles sent to support. Session token theft leading to unauthorized ServiceNow access.

**How to avoid:** API keys encrypted with AES-GCM-256 (PBKDF2 from `installSecret` + `extensionId`, 100,000 iterations). Session tokens in `chrome.storage.session` only (cleared on browser close, never synced). `TraceRedactor` runs before any log, UI display, or export. Mandatory redaction patterns defined in §4.4 of PRODUCT_SPEC.

**Warning signs:**
- Raw API key visible in `AITransactionLogDB` entries
- Export bundle contains unredacted provider configs
- `console.log(providerConfig)` anywhere in the codebase
- Redaction test failures when new providers are added

**Phase to address:** Phase 2 (Storage/Encryption) and Phase 6 (Telemetry/TraceRedactor). Redaction test suite must include all five provider key formats.

---

### Pitfall 12: IndexedDB Migrations That Aren't Idempotent

**What goes wrong:** An IndexedDB migration fails partway through (SW terminates, user closes tab). On retry, the migration re-applies transformations to already-migrated data, corrupting it. Or the migration is forward-only with no rollback path.

**Why it happens:** Migration functions are written as one-shot scripts assuming they run to completion. IndexedDB's `onupgradeneeded` event runs inside a transaction, but the transaction may be aborted mid-flight.

**Consequences:** Data corruption in production that cannot be repaired. Users lose conversation history, notes, memory facts. The only fix is clearing all extension data — essentially a factory reset. Rollback is impossible without a backup.

**How to avoid:** Every migration MUST be idempotent — check if data is already in the target format before transforming. Use version markers on individual records. The `IndexedDBMigrator` must validate the database state after migration completes. Migration failures record `IDB_MIGRATION_FAILED` in `ErrorStore` and enter degraded mode without corrupting data.

**Warning signs:**
- Migration functions that use `put()` without checking existing data first
- No `toVersion` check at the start of each migration
- Migration tests that only test forward migration, not re-run scenarios

**Phase to address:** Phase 2 (Storage/IndexedDBMigrator). Write a test that runs a migration, simulates a partial failure, and verifies the re-run is safe.

---

### Pitfall 13: Single Surface Opens Both chrome.storage.session Write Paths

**What goes wrong:** During primary writer election, two surfaces both attempt to write to `chrome.storage.session.np_workspace_primary` simultaneously. `chrome.storage.session` does not support transactions. The second write silently overwrites the first.

**Why it happens:** `chrome.storage.session` is a simple key-value store. There is no compare-and-swap primitive. The election uses timestamp comparison, but in a race condition, both surfaces may read the old value, both compute a newer timestamp, and the last write wins.

**Consequences:** Both surfaces believe they are primary. Dual-writer scenario (see Pitfall 2) occurs despite the election mechanism. Non-deterministic — depends on timing of page loads.

**How to avoid:** The election protocol must be: (1) read current value, (2) check if it's stale (older than heartbeat interval), (3) write with a unique candidate token, (4) re-read to confirm own token is the stored value. If another surface wrote in between, the loser demotes to secondary. The `BroadcastBus` heartbeat must confirm primacy every 3 seconds.

**Warning signs:**
- Both surfaces logging "elected as primary" simultaneously
- `WorkspaceCoordinationState: 'primary'` on both surfaces
- Write conflicts appearing within 1-2 seconds of both surfaces opening

**Phase to address:** Phase 1 (Workspace coordination) and Phase 8 (Multi-surface integration testing).

---

### Pitfall 14: CSP Blocking AntD Dynamic Features

**What goes wrong:** Ant Design v6 uses CSS-in-JS (cssinjs) and may inject `<style>` tags dynamically. If the extension's CSP is too restrictive (`style-src 'self'` without `'unsafe-inline'`), AntD components fail to render styles.

**Why it happens:** The default MV3 CSP is strict. AntD's internal styling mechanism (especially with `ConfigProvider` theme switching) relies on dynamic style injection. Many extension developers discover this late because development builds work (HMR bypasses CSP in some modes) but production builds fail.

**Consequences:** Components render without styles (unstyled buttons, invisible text, broken layouts). Theme switching silently fails. Dark mode toggle has no effect. Production build looks completely broken compared to development.

**How to avoid:** Verify the manifest CSP permits AntD's style injection. Use `style-src 'self' 'unsafe-inline'` for extension pages. Test production builds (`wxt build --mode production`) early — don't wait until Phase 9. CSS-variable theming in AntD v6 should reduce the volume of injected styles, but dynamic injection is still used for component-specific overrides.

**Warning signs:**
- Unstyled AntD components in production build but not development
- Console warnings about CSP blocking inline styles
- Theme toggle changes `ConfigProvider` but visual styles don't update

**Phase to address:** Phase 1 (Manifest/CSP setup). Test production build in Phase 1, not Phase 9.

---

## Minor Pitfalls

### Pitfall 15: Importing @ant-design/icons Incorrectly

**What goes wrong:** Using tree-shaking-unfriendly imports that pull in the entire icon set (~1 MB uncompressed).

**Prevention:** AntD v6 with `@ant-design/icons` v6 uses named imports; Vite tree-shakes unused icons. Always use `import { SendOutlined } from '@ant-design/icons'`, never `import * as Icons from '@ant-design/icons'`. Verify bundle size after Phase 7 with `wxt build` analysis.

**Phase to address:** Phase 7.

---

### Pitfall 16: Using Static message/notification/Modal from antd

**What goes wrong:** Using `import { message } from 'antd'` instead of `App.useApp().message`. The static import bypasses `ConfigProvider` context.

**Prevention:** Static imports don't receive `ConfigProvider` theme tokens, so dark mode doesn't apply to toasts, notifications, or modals. Every component must use `App.useApp()` for imperative APIs. Lint rule: forbid `import { message, notification, Modal } from 'antd'`.

**Phase to address:** Phase 1 and Phase 7.

---

### Pitfall 17: Not Handling Abort During Permission Prompts

**What goes wrong:** User navigates away or closes the panel while a tool permission `Modal.confirm` is open. The modal's promise never resolves. The agent stream hangs forever in `waiting-for-permission` state.

**Prevention:** `ExecutorService` propagates the `AbortSignal` to the permission prompt. On abort, inject `PERMISSION_DENIED` tool result and end the stream cleanly. The `ToolPermissionState` state machine must handle the `PANEL_CLOSED` transition.

**Phase to address:** Phase 3 (ExecutorService).

---

### Pitfall 18: Ollama Context Window Default

**What goes wrong:** Ollama defaults to 2,048 token context window. Users report terrible AI quality and blame the extension.

**Prevention:** `TierResolver` detects the context window from `ProviderConfig.contextWindow`. If ≤ 4,096 on Ollama, `ProviderRouter` classifies as `tiny`. Flow 5 shows a warning with "Copy Modelfile" button. Default context window for Ollama models should be explicitly configured in the provider setup wizard.

**Phase to address:** Phase 3 (TierResolver) and Phase 7 (Options UI).

---

### Pitfall 19: Relying on Provider-Neutral Prompt Cache Behavior

**What goes wrong:** Assuming all providers handle prompt caching the same way. Anthropic uses ephemeral cache (max 4 breakpoints), Gemini uses cachedContent (min 32K tokens), OpenAI uses automatic prefix caching, Ollama doesn't cache at all.

**Prevention:** `PromptCacheAdapter` must have per-provider strategies. Never assume a provider supports prompt caching. The cache key strategy differs: Anthropic marks breakpoints in the prompt text, Gemini pre-uploads content, OpenAI detects prefixes automatically. Test with each provider individually.

**Phase to address:** Phase 3 (PromptCacheAdapter).

---

### Pitfall 20: Zustand persist Middleware with chrome.storage.local

**What goes wrong:** Using Zustand's `persist` middleware with `chrome.storage.local` as the storage backend. The `persist` middleware uses `localStorage` API by default. Swapping to `chrome.storage.local` requires a custom `storage` adapter, and the serialization/deserialization behavior differs.

**Prevention:** `ThemeStore` and `WorkspaceStore` must use `chrome.storage.local` directly, not through Zustand's `persist` middleware with a naive adapter. Zustand's `persist` fires on every state change — uncontrolled writes to `chrome.storage.local` can trigger quota errors. Instead, debounce writes and use `WriteJournal` for the workspace state.

**Phase to address:** Phase 1 (WorkspaceStore) and Phase 2 (Storage).

---

### Pitfall 21: WXT HMR Breaking chrome.storage.session State

**What goes wrong:** During development with WXT's HMR, the extension reloads. `chrome.storage.session` is cleared on extension reload (it persists across browser restarts but not extension updates/reloads). Development state disappears on every HMR cycle.

**Prevention:** Don't rely on `chrome.storage.session` for state that needs to survive HMR cycles during development. Use it only for runtime session tokens that can be re-acquired. During development, fall back to `chrome.storage.local` for session-like state if `chrome.storage.session` is empty and it's a development build.

**Phase to address:** Phase 1 (Development workflow).

---

### Pitfall 22: Content Script SPANavigationWatcher Missing SPA Routes

**What goes wrong:** The `MutationObserver` for SPA navigation detection misses route changes because it watches the wrong DOM mutations (e.g., only `childList` on `<body>`) or has a debounce that filters out rapid navigations.

**Prevention:** `SPANavigationWatcher` must observe `document.title` changes, `history.pushState`/`replaceState` overrides (via monkey-patch), and URL changes (periodic check as fallback, not primary). The WXT `wxt:locationchange` event is the canonical signal. Never use `setInterval` for SPA detection (see Pitfall 7).

**Phase to address:** Phase 8 (Content Script Runtime).

---

### Pitfall 23: Theme Flicker During Cross-Surface Handoff

**What goes wrong:** When handing off from Side Panel to Full App Tab (Flow 11), the Full App briefly shows the wrong theme (light flash in dark mode) before `ThemeStore` hydrates from `chrome.storage.sync`.

**Prevention:** The Full App's `app.html` must include an inline `<script>` that reads `chrome.storage.sync.np_theme` synchronously and sets a `data-theme` attribute on `<html>` before React mounts. `ConfigProvider` reads the attribute on first render. This eliminates the flash of incorrect theme.

**Phase to address:** Phase 1 (Full App shell) and Phase 7 (Theme).

---

### Pitfall 24: Cmd+K Command Palette Conflicts with Chrome Shortcuts

**What goes wrong:** The `Cmd+K` (`Ctrl+K`) keyboard shortcut for the command palette conflicts with Chrome's built-in "Focus Address Bar" shortcut on some platforms.

**Prevention:** Use `Alt+K` or `Cmd+Shift+K` as the primary shortcut, with `Cmd+K` as a secondary option that gracefully degrades when Chrome captures it. Test on macOS, Windows, and ChromeOS. The `KeymapRegistry` should allow users to rebind the shortcut.

**Phase to address:** Phase 1 (KeymapRegistry) and Phase 7 (Command palette).

---

## Technical Debt Patterns

Shortcuts that seem reasonable during development but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding model names in PlannerService instead of TierResolver | One less abstraction | Models change (GPT-4o-mini replaces GPT-3.5); every reference must be updated | Never |
| Skipping WriteJournal for "simple" writes | Less code in Phase 2 | Data corruption on crash; no recovery audit trail | Never — WriteJournal is non-negotiable |
| Using `any` for ToolSchema input/output | Quick prototyping | Type-unsafe tool execution; LLM can pass unexpected data shapes | Prototype only; must be replaced before Phase 3 merge |
| Copying prompt assembly logic between ChatPage and AgentPage | Faster Phase 7 | Divergent context behavior between surfaces; bug fixes must be applied twice | Never — extract into shared `useChat`/`useStreamingLLM` hooks |
| Skipping IndexedDB migration for schema change | Quick iteration | Data loss for existing users on update; angry support tickets | Development only; never in a published version |
| Using `chrome.storage.local` as cache for IndexedDB data | Simpler read path | Two sources of truth; stale cache; 10 MB quota consumed twice | Never — IndexedDB is the source of truth |
| Inlining CSP exceptions for new features | Quick deployment | CSP policy becomes unmaintainable; security loopholes accumulate | Only with an ADR documenting the exception and its expiry |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel AI SDK `streamText()` | Calling from any context other than Side Panel / Full App | Only from `AgentOrchestrator.runTurn()` within those two surfaces |
| `@ai-sdk/openai` for Ollama | Not setting `apiKey: 'ollama'` | Ollama's OpenAI-compatible endpoint requires a non-empty apiKey; use `'ollama'` |
| `@ai-sdk/anthropic` prompt caching | Exceeding 4 cache breakpoints | Anthropic allows max 4 ephemeral cache breakpoints; `PromptCacheAdapter` must count and prioritize |
| `@ai-sdk/google` cachedContent | Creating cached content < 32K tokens | Gemini requires minimum 32,768 tokens for cachedContent; `PromptCacheManager` must check |
| MCP `StreamableHTTP` transport | Not handling reconnection on transport drop | MCP connections drop on network change; implement exponential backoff reconnect in `MCPClient` |
| `chrome.storage.session` | Assuming it survives extension reload during development | It doesn't — cleared on extension update/reload; handle dev-vs-prod behavior difference |
| `BroadcastChannel` API | Not filtering sender's own messages | Always include `senderOrigin` and filter by it; otherwise infinite loops |
| `idb` (IndexedDB wrapper) | Opening DB without `blocked` handler | Always handle `onblocked` to detect version conflicts from multi-surface access |
| AntD `ConfigProvider` theme | Switching theme causes full component remount | Use CSS variable approach in v6; test theme toggle performance with 100+ components mounted |
| `chrome.sidePanel.open()` | Calling without user gesture | Only call from action click, context menu, commands API, or user-initiated events |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all conversations into Zustand on startup | 2+ second initial paint when user has 200+ conversations | Lazy-load: metadata in store, bodies fetched on demand from IndexedDB; virtual list | ~100 conversations |
| IndexedDB full-table scan for search | 500+ ms search response for 1,000+ notes | MiniSearch index built incrementally on write; IndexedDB used only for body retrieval by ID | ~500 notes |
| Re-rendering entire chat history on every stream chunk | Janky scrolling, dropped frames during AI response | `PortableMarkdown` with `React.memo`; virtualized message list; `overflow-anchor: none` on streaming tail | ~50 messages |
| ContextOptimizer recalculating for every chunk | Unnecessary CPU during streaming | `OptimizedContext` is computed once per turn, not per chunk; re-evaluate only on tool call loop iteration | Any streaming use case |
| Multiple Zustand selectors triggering cascading re-renders | UI lag, "Maximum update depth exceeded" errors | Use atomic selectors; `useShallow` for object selectors; avoid derived state that depends on async sources | Complex agent workflows |
| `BroadcastBus` sync on every keystroke | Cross-surface latency and flicker | Debounce workspace sync to 500 ms; batch updates; only sync on meaningful state transitions | Fast typing users |
| Prompt assembly on main thread | Blocks UI during large context preparation | Offload `ContextOptimizer` computation to `requestIdleCallback` or Web Worker (if IndexedDB access permits) | Large context windows (128K+ tokens) |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Content script `world: 'MAIN'` for all extraction | Host page JavaScript can access and modify extraction results; ServiceNow tokens stolen by malicious page scripts | Use `world: 'ISOLATED'` by default; `MAIN` world only for specific globals (`window.g_ck`) with minimal exposure surface |
| PROXY_FETCH forwarding raw responses to LLM | Malicious API response injects prompts into AI context | `CORSProxy` validates response structure before forwarding; never pass raw HTML/JSON directly to `ContextOptimizer` |
| Add-on registering dangerous tools without permission gate | Malicious add-on (or compromised update) can execute destructive operations | All `dangerous: true` tools require `PermissionGate` validation; add-on review must audit tool capabilities |
| `TraceRedactor` patterns incomplete for new provider key formats | New provider API key format not redacted in logs/export | Test suite must include realistic fixtures for all 5 providers; add redaction patterns before adding provider support |
| User-imported data (notes, prompts) executed as code | Imported markdown with embedded scripts could execute in `PortableMarkdown` | `DOMPurify.sanitize()` on all imported content; never `eval()` or `new Function()` on user-provided content |
| MCP server auth headers leaked through `AITransactionLog` | MCP Bearer tokens stored in plaintext traces | `TraceRedactor` redacts MCP auth headers (add to `REDACTION_PATTERNS`); MCP tool trace never includes raw input/output |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback during long tool execution | User thinks app is frozen; closes panel; loses work | Show step progress with `ThoughtChain` component; each tool execution shows "Running [toolName]..." with elapsed time |
| Error messages too technical | User sees "PROVIDER_5XX" and doesn't know what to do | Map every `NowPilotError.code` to a user-facing string in `STR`; always include actionable next step (Retry, Switch Provider, Open Settings) |
| Side Panel too heavy | User can't use it as a quick companion; closes it and never returns | Enforce compact density; no heavy tables/forms; "Open in Full App" as escape hatch for complex workflows |
| Full App feels disconnected from Side Panel | User treats them as two separate apps; confusion about where work lives | Consistent workspace state; handoff animations; "Workspace opened in Full App" notification on Side Panel |
| No progress indicator for first-time setup | User installs extension, sees empty panel, uninstalls | First-run onboarding modal (Flow 9) must appear immediately; never show empty state before onboarding completes |
| Silent data loss on export/import | User exports data, reinstalls extension, imports — notes missing because export was incomplete | Export must include ALL user data types; verify round-trip in test; warn about what's NOT exported (streaming state, ephemeral tokens) |
| Provider config without test button | User configures provider with wrong endpoint/API key; gets cryptic error on first message | "Test Connection" button in Options → Providers that validates: auth, model list, minimum context window |

---

## "Looks Done But Isn't" Checklist

Things that appear complete during development but are missing critical pieces.

- [ ] **Abort Handling:** Stream abort works for: user clicking stop, panel close, tab close, browser close, network disconnect. Verify `AbortController.signal` propagates to all 5 providers.
- [ ] **Offline Mode:** Extension works with only Ollama configured (no internet). Test: disable WiFi, restart extension, send message.
- [ ] **Multi-window:** Open Side Panel in Window A, Full App in Window B. Verify write coordination, theme sync, workspace handoff.
- [ ] **Extension Update:** Existing user data survives `wxt build` version bump. Migrations run without data loss. Test with a year-old data fixture.
- [ ] **Quota Exhaustion:** When `chrome.storage.local` reaches 10 MB, the extension degrades gracefully (informs user, continues in-memory, doesn't crash).
- [ ] **Concurrent Streams:** User cannot accidentally start two streams in the same conversation. The old stream is always aborted before the new one starts.
- [ ] **Provider Deleted While Active:** If the active provider is deleted from Options while a stream is running, the stream completes (already has connection) but next message fails with clear "No provider configured" error.
- [ ] **Keyboard Navigation:** All major flows (send message, abort, open Full App, navigate Options) are keyboard-accessible without a mouse.
- [ ] **Content Script Bundle Size:** Production content script bundle is under 50 KB. Verified by `tests/isolation/no-content-script-ui.test.ts`.
- [ ] **Memory Pressure:** Extension doesn't leak memory over hours of usage. Long-lived Side Panel session doesn't accumulate unreleased IndexedDB connections, event listeners, or React fibers.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Data corruption from dual-surface writes | HIGH | Restore from last WriteJournal checkpoint; replay idempotent operations; if unrecoverable, offer "Reset all data" with export-first option |
| IDB_MIGRATION_FAILED | HIGH | Export all readable data before migration retry; drop and recreate database as last resort; preserve `chrome.storage.local` metadata |
| 10 MB storage quota exhausted | MEDIUM | Detect in `Settings` module; show "Storage full" dialog; offer bulk delete of old conversations; guide user to clear old data |
| IndexedDB blocked by other tab | LOW | Show toast with "Reload extension to release database lock"; auto-retry open with exponential backoff (max 3 attempts) |
| Provider API key compromised | HIGH | Revoke key immediately from provider dashboard; `KeyVault.rotate(keyId)` generates new install secret; all existing encrypted keys must be re-encrypted |
| Prompt cache miss cascade | LOW | `PromptCacheManager` auto-disables after 5 consecutive misses for 60 s; no user action needed |
| Workspace election timeout | MEDIUM | Force election reset via `chrome.storage.session.clear('np_workspace_primary')`; surfaces re-elect on next heartbeat |
| CSP blocks AntD styles in production | MEDIUM | Update manifest CSP; requires extension update submission through Chrome Web Store review (days of delay) — test production build early! |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Pitfall 1: AI in SW | Phase 1, Phase 3 | Lint rule blocks AI imports in background.ts; Phase 3 tests run from Side Panel context |
| Pitfall 2: Dual-surface writes | Phase 1, Phase 2 | Phase 8 multi-surface integration test verifies data consistency |
| Pitfall 3: Direct AI from components | Phase 3, Phase 7 | Phase 7 architectural test: no `streamText` imports outside `src/core/ai/` |
| Pitfall 4: Bodies in chrome.storage.local | Phase 2 | Test: 500 conversations, `chrome.storage.local` < 5 MB |
| Pitfall 5: AntD in content scripts | Phase 1, Phase 8 | `tests/isolation/no-content-script-ui.test.ts` greps output bundle |
| Pitfall 6: Async SW listeners | Phase 1 | Phase 1 test: SW listener presence at module load |
| Pitfall 7: BroadcastChannel dedup | Phase 1 | Phase 1 test: two surfaces, message sent by one not processed by sender |
| Pitfall 8: Stream state on close | Phase 3, Phase 7 | Phase 7 test: close panel mid-stream, reopen, verify abort logged |
| Pitfall 9: Silent quota exhaustion | Phase 3 | Phase 3 test: mock provider returns quota error, verify user-facing message |
| Pitfall 10: Cache miss cascade | Phase 3, Phase 4 | Phase 6 diagnostics monitors cache hit rate |
| Pitfall 11: Unencrypted keys | Phase 2, Phase 6 | Phase 6 redaction test: realistic provider key fixtures |
| Pitfall 12: Non-idempotent migrations | Phase 2 | Phase 2 test: partial failure + re-run migration |
| Pitfall 13: Election race condition | Phase 1, Phase 8 | Phase 8 test: simultaneous surface open, verify single primary |
| Pitfall 14: CSP blocks AntD | Phase 1 | Phase 1 production build test; visual check for unstyled components |
| Pitfall 23: Theme flicker | Phase 1, Phase 7 | Phase 7 visual test: handoff from dark Side Panel to Full App, no flash |

---

## Sources

- Chrome MV3 Service Worker lifecycle — [developer.chrome.com](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): Confirmed 30 s idle timeout, 5 min max per event, global variable loss, sync listener registration requirement, no Web Storage API
- Chrome Service Worker basics — [developer.chrome.com](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics): Confirmed `import()` dynamic import not supported, remote code prohibited
- WXT Storage guide — [wxt.dev](https://wxt.dev/guide/essentials/storage.html): Confirmed `webext-storage` and `@webext-core/storage` as alternatives
- Vercel AI SDK Troubleshooting — [sdk.vercel.ai](https://sdk.vercel.ai/docs/troubleshooting): Confirmed stream abort issues (`onEnd` not called), `consumeSseStream` requirement, `createUIMessageStreamResponse` patterns
- PRODUCT_SPEC_v0_1.md: All canonical constraints, storage architecture split, security requirements (AES-GCM, TraceRedactor), concurrency rules (§13), edge cases (§19), workspace coordination (§20)
- NowPilot PROJECT.md: Key decisions, constraints (MV3 restrictions, package hygiene, cross-surface isolation)
- Community knowledge: Common Chrome extension pitfalls from WXT Discord, Chrome Extensions Google Group, and extension developer forums
