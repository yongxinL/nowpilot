# Domain Pitfalls

**Domain:** Chrome MV3 AI Assistant Extension + Personal Knowledge Platform
**Researched:** 2026-07-28

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Using AI SDK v1/v3 APIs with Provider v4 Packages

**What goes wrong:** The PROJECT.md specifies `@ai-sdk/* ^1`, but the current provider packages are at v4. The v1 provider API is unsupported and throws `AI_UnsupportedModelVersionError: Unsupported model version v1`. The core `ai` package is at v7 with breaking changes: `system` renamed to `instructions`, `experimental_activeTools` renamed to `activeTools`, `experimental_onStart` renamed to `onStart`.

**Why it happens:** The AI SDK ecosystem evolved rapidly in 2025-2026. Provider packages went from v1→v4, core from v1→v7. API surface changed significantly between major versions.

**Consequences:** Every AI integration point must be rewritten if v1 APIs are used. The PlannerService→ExecutorService→RendererService pipeline, PersonaInjector, ContextOptimizer, MemoryEngine, and all tool schemas would reference deprecated APIs that throw at runtime.

**Prevention:** Use AI SDK core v7 + provider v4 from Phase 1. Audit every `generateText`/`streamText` call for `system→instructions` migration. Replace all `.strict()` Zod calls with `z.strictObject()`.

**Detection:** The `AI_UnsupportedModelVersionError` is thrown immediately on first AI call. Catch it early by writing an integration test that makes a simple `generateText` call before building the full pipeline.

### Pitfall 2: IndexedDB Access from Service Worker

**What goes wrong:** Attempting to use IndexedDB (via idb or raw API) inside the MV3 service worker. The `indexedDB` global is undefined in the service worker context.

**Why it happens:** MV3 service workers are stripped of IndexedDB access. This is a Chrome runtime restriction, not a configuration issue. Many MV2→MV3 migrations hit this because background pages had full IndexedDB access.

**Consequences:** All notes, chat history, AI transaction logs, and memory facts must be stored from extension pages (Side Panel or Full App Tab), not from the service worker. The service worker must communicate with extension pages via `chrome.runtime.sendMessage` to trigger storage operations.

**Prevention:** Design the storage layer to run in extension pages. The service worker uses only `chrome.storage.session` and `chrome.storage.local`. Create a `StorageBridge` pattern: service worker sends messages to the active extension page, which performs IndexedDB operations and returns results.

**Detection:** Unit tests that attempt to open IndexedDB from the service worker context will throw `ReferenceError: indexedDB is not defined`. Test with a real MV3 extension build, not in Node.js.

### Pitfall 3: Async Listener Registration in Service Worker

**What goes wrong:** Event listeners (`chrome.runtime.onMessage.addListener`, `chrome.alarms.onAlarm.addListener`, `chrome.action.onClicked.addListener`) registered inside async callbacks, `.then()` chains, or after `await` calls never fire when the service worker is cold-started.

**Why it happens:** MV3 service workers terminate when idle (typically after 30 seconds of inactivity). When Chrome restarts the worker to handle an event, it executes the script synchronously and dispatches the event immediately. If listeners are registered asynchronously, they don't exist yet when the event fires — the event is silently dropped.

**Consequences:** Intermittent failures where the extension appears to work initially but stops responding after the user switches tabs or the browser is idle. Hardest MV3 bug to diagnose because it's non-deterministic.

**Prevention:** Register ALL event listeners at the top level of the service worker script. Move async initialization logic (loading settings, checking storage) after listener registration, never before or intertwined. Use `chrome.storage` as the source of truth for state that must survive worker restarts.

**Detection:** Test by reloading the extension and immediately triggering an event (e.g., clicking the toolbar icon) before any async initialization completes. If the event is dropped, listeners are registered in the wrong order.

### Pitfall 4: @ant-design/x-sdk in the Data Flow

**What goes wrong:** Using `useXChat`, `OpenAIChatProvider`, or `XRequest` from `@ant-design/x-sdk` to handle AI chat requests. This would let the UI bypass the AgentOrchestrator, ProviderRouter, ContextOptimizer, and MemoryEngine.

**Why it happens:** Ant Design X documentation and examples prominently feature x-sdk hooks. It's the "happy path" shown in all getting-started guides. The temptation to use it for convenience is strong.

**Consequences:** The cost-effective runtime architecture (PlannerService→ExecutorService→RendererService with tier caps) is bypassed. Persona injection doesn't happen. Memory retrieval doesn't happen. Tool calls go directly to AI without ExecutorService validation. Provider fallback/circuit breaker is skipped. The entire architecture collapses into a thin wrapper around raw AI calls.

**Prevention:** Use antd-x components (Bubble, Sender, Conversations, XMarkdown) as presentational components only. Wire them to Zustand state. The AgentOrchestrator uses AI SDK's `streamText`/`generateText` directly. Add an ESLint rule to ban `@ant-design/x-sdk` imports.

**Detection:** `grep -r "@ant-design/x-sdk" src/` should return zero results. Any import from x-sdk is a violation.

### Pitfall 5: Not Sanitizing AI-Generated Content

**What goes wrong:** AI-generated text is rendered directly in the DOM via `dangerouslySetInnerHTML` or passed to Bubble/XMarkdown without DOMPurify sanitization.

**Why it happens:** Markdown renderers (including XMarkdown) allow raw HTML passthrough. AI models can generate embedded scripts, event handlers, or malicious links, either through prompt injection or hallucination. The project's PortableMarkdown mode reduces but doesn't eliminate this risk.

**Consequences:** XSS vulnerability in the extension. An attacker who controls a web page the user visits could inject content that the AI summarizes, and that summary could contain malicious HTML that executes in the extension's privileged context.

**Prevention:** Run ALL AI-generated content through `DOMPurify.sanitize()` before rendering. This includes chat responses, note summaries, tool execution results, and any content displayed in Bubble/XMarkdown. Configure DOMPurify to allow only safe HTML tags and attributes.

**Detection:** Audit every location where AI output enters the DOM. There should be exactly one sanitization point per rendering path. Use CSP headers (manifest `content_security_policy`) as defense-in-depth.

## Moderate Pitfalls

### Pitfall 1: Large MiniSearch Index in Zustand Store

**What goes wrong:** Storing the entire MiniSearch index as Zustand state, causing serialization/deserialization overhead and slow state updates.

**Prevention:** Keep MiniSearch as a module-level singleton outside Zustand. Only store the document source data (notes array) in Zustand. Rebuild the MiniSearch index on load from the document data.

### Pitfall 2: YAML Frontmatter Corruption on Filesystem Sync

**What goes wrong:** The `yaml` library's `stringify()` produces valid YAML but may differ from user expectations for frontmatter output (e.g., quote style, indentation, flow vs. block format).

**Prevention:** Use `yaml.stringify()` with explicit options: `{ lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' }`. Test round-trip (parse then stringify) to ensure frontmatter is identically reproducible.

### Pitfall 3: Motion Animations and antd 6 CSS-in-JS Style Priority

**What goes wrong:** Motion's `layout` animations depend on CSS transform/opacity transitions. If antd 6's CSS-in-JS injects styles after Motion's styles, animation properties may be overridden.

**Prevention:** Verify in Phase 8 (RICH UI) that Motion animations work within antd 6's style injection order. If issues arise, use Motion's `style` prop instead of CSS classes for critical animations, or increase specificity with antd 6's `hashId`.

### Pitfall 4: Service Worker Termination During Long AI Calls

**What goes wrong:** The service worker terminates after 30 seconds of inactivity. If a long-running AI call (e.g., large context processing) takes longer, the worker terminates and the AI response is lost.

**Prevention:** AI calls should originate from extension pages (Side Panel or Full App Tab), which do not have the 30-second termination limit. The service worker should only coordinate, not execute AI calls directly. If the service worker must initiate an AI action, use the `waitUntil()` heartbeat pattern (call `chrome.runtime.getPlatformInfo` every 25 seconds while the promise is pending).

## Minor Pitfalls

### Pitfall 1: Forgetting to Remove @ant-design/v5-patch-for-react-19

**What goes wrong:** The v5 compatibility patch is imported but not needed for antd 6. May cause subtle render issues or deprecation warnings.

**Prevention:** Grep for `@ant-design/v5-patch-for-react-19` and remove all imports. antd 6 natively supports React 19.

### Pitfall 2: Using framer-motion Import Path

**What goes wrong:** Importing from `framer-motion` instead of `motion/react`. The old package is deprecated and may not have the latest API surface.

**Prevention:** Use `import { motion, AnimatePresence } from 'motion/react'`. Add an ESLint rule to ban `framer-motion` imports.

### Pitfall 3: Not Checking DOMPurify + XMarkdown Interaction

**What goes wrong:** XMarkdown renders markdown to HTML. If DOMPurify is applied before XMarkdown (on raw markdown text), it won't catch HTML injected by the markdown renderer. If applied after (on rendered HTML), it may strip legitimate formatting.

**Prevention:** Apply DOMPurify AFTER XMarkdown renders markdown to HTML, before the HTML is inserted into the DOM. Test with known XSS vectors in markdown.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Shell (Phase 1) | WXT entrypoint configuration mismatch between Side Panel and Full App Tab | Verify both `sidepanel/` and `app/` entrypoints in WXT config. Test both surfaces open simultaneously. |
| AI Core (Phase 2) | AI SDK v7 `system→instructions` rename | Audit every AI call. Use TypeScript to enforce the new parameter names. |
| AI Core (Phase 2) | Zod v4 `z.strictObject()` migration | Replace all `.strict()` with `z.strictObject()`. Enable Zod v4 strict mode globally. |
| Memory (Phase 3) | Memory writes from secondary surface | Enforce single-writer pattern. Secondary surface throws or no-ops on write attempts. |
| Context/Page (Phase 4) | defuddle parsing failure on non-article pages | Graceful fallback: if defuddle returns empty content, fall back to `document.body.innerText`. |
| Notes (Phase 5) | MiniSearch index rebuild performance | Add `addAllAsync()` with chunking for large note databases (>1000 notes). |
| LLM-Wiki (Phase 6) | Single haiku call timeout on very long notes | Implement note content length check. Skip auto-enrichment for notes >10K tokens (flag for manual review). |
| Add-ons (Phase 7) | External MCP server connection timeout | Implement connection timeout (10s) and retry (max 3). Circuit breaker for failing servers. |
| RICH UI (Phase 8) | Motion exit animations clashing with React 19 concurrent rendering | Use `AnimatePresence mode="wait"` to ensure exit animations complete before new elements enter. |
| Security (Phase 9) | CSP blocking inline styles from antd 6 CSS-in-JS | Use antd 6's `hashId` mode. Add `style-src 'unsafe-inline'` to CSP only if hash-based approach fails. |

## Sources

- `developer.chrome.com` — Service worker lifecycle, IndexedDB restrictions, synchronous listener registration (HIGH)
- Context7 `/vercel/ai` — AI SDK v7 migration guide, `system→instructions` rename, `AI_UnsupportedModelVersionError` (HIGH)
- Context7 `/ant-design/ant-design` — v6 migration, React 19 compatibility (HIGH)
- Context7 `/cure53/dompurify` — XSS sanitization, hooks, Trusted Types (HIGH)
- Context7 `/websites/motion_dev` — AnimatePresence modes, layout animations (HIGH)
- NowPilot PROJECT.md — Known constraints, excluded libraries, architecture decisions (HIGH)
