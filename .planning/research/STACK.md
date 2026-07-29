# Stack Research

**Domain:** Chrome MV3 AI Assistant Extension + Personal Knowledge Platform
**Researched:** 2026-07-28
**Confidence:** HIGH

## Recommended Stack

### Extension Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| WXT | `^0.21` | Chrome extension framework | Gold standard for MV3 extension dev. File-based entrypoints (sidepanel/, popup/, content/, background/), first-class React/Vite integration, HMR, TypeScript out of the box. Automated manifest generation from HTML meta tags. |
| `@wxt-dev/module-react` | `^1.2` | WXT React integration | Official WXT module. Adds `@vitejs/plugin-react` and React auto-import preset. Required for React 19 support in WXT entrypoints. |

### Core Runtime

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | `^19.2` | UI framework | Latest stable. `useActionState` and `useOptimistic` hooks for AI interaction patterns (streaming state, optimistic message rendering). antd 6 natively supports React 19 — no compatibility patch needed. |
| TypeScript | `^5` (strict) | Type safety | Mandated by project constraints. Strict mode catches MV3 API type errors at compile time. |

### UI Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| antd | `^6.5` | Enterprise UI components | CSS-in-JS theming (no Less), ConfigProvider token-based customization. v6 breaking changes manageable: `children→items` (Menu), `maskClosable→mask.closable` (Drawer), `tabPosition→tabPlacement` (Tabs). Light/dark/auto theme toggle via `ConfigProvider theme.algorithm`. |
| `@ant-design/x` | `^2.9` | AI chat UI components | Bubble, Sender, Conversations components for AI chat interface. RICH paradigm (Role, Intention, Conversation, Hybrid UI) aligns with project's conversational UX goals. XMarkdown for streaming markdown rendering. |
| `@ant-design/x-markdown` | `^2.9` | Streaming markdown | Renders AI responses with streaming animation. `hasNextChunk` mode for progressive reveal, skeleton components for incomplete markdown during generation. |
| Motion | `^12.42` | React animations | Formerly Framer Motion (rebranded). `motion` component for enter/exit animations, `AnimatePresence` for unmount transitions, `layoutId` for shared layout animations. Used for RICH UI: message transitions, panel open/close, streaming indicators. Import from `motion/react`, NOT `framer-motion`. |

### AI Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `ai` | `^7` | AI SDK core | Vercel AI SDK. `streamText`/`generateText` APIs with tool calling, streaming, abort support. v7 is latest stable (`system→instructions` rename, stabilized `activeTools`). Used for PlannerService→ExecutorService→RendererService pipeline. |
| `@ai-sdk/openai` | `^4` | OpenAI provider | Official AI SDK provider for OpenAI. Supports GPT-4o, GPT-4o-mini, o-series models. |
| `@ai-sdk/anthropic` | `^4` | Anthropic provider | Official AI SDK provider for Claude (Haiku/Sonnet/Opus). |
| `@ai-sdk/google` | `^4` | Gemini provider | Official AI SDK provider for Gemini (Flash/Pro). |
| `ollama-ai-provider` | `^1.2` | Ollama provider | Community provider for local Ollama models. Uses the `@ai-sdk/openai` adapter with custom baseURL. |
| zod | `^4.4` | Schema validation | TypeScript-first schema validation. `z.discriminatedUnion` for PlannerDecisionSchema (answer/run_tool/ask_clarification), `z.object`/`z.enum` for tool schemas. v4: `z.strictObject()` replaces `.strict()`, `z.looseObject()` replaces `.passthrough()`. |

### State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Zustand | `^5.0` | Global state | Slices pattern (`StateCreator` composition) for WorkspaceStore: AI state, notes state, UI state, memory state. Immer middleware for complex state mutations. No boilerplate, tiny bundle (~1KB), perfect for MV3 where every KB counts. |
| `zustand/middleware/immer` | `^5.0` | Immutable updates | Direct state mutation syntax in Zustand `set()` callbacks, auto-converted to immutable updates. |

### Search & Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| MiniSearch | `^7.2` | Full-text search | In-memory search engine for notes and page content. `fields` for indexed content, `storeFields` for returned data, fuzzy/prefix matching, auto-suggest. Used for note graph search and ephemeral page content index. No external dependencies. |
| idb | `^8.0` | IndexedDB wrapper | Jake Archibald's type-safe IndexedDB library. `openDB()` with `DBSchema` generics, `upgrade()` for migrations (v1→v4 schema). Transaction support via `db.transaction()`. ~1.19KB brotli'd. Used for message bodies, notes, AI transaction logs, memory facts. |
| `chrome.storage.session` | — | Session tokens | API keys and session tokens. Cleared on browser restart. Service worker accessible. |
| `chrome.storage.local` | — | Workspace state | Serialized workspace state. ~10MB default, request `unlimitedStorage` for large note databases. Service worker accessible. |

### Content Extraction & Sanitization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| defuddle | `^0.19` | Page content extraction | Purpose-built Readability successor. `new Defuddle(document).parse()` returns cleaned content, title, author, description, published date, site name, word count. Preserves footnotes, math, code blocks. MIT license. |
| DOMPurify | `^3.4` | XSS sanitization | Industry standard HTML sanitizer. `sanitize(dirty)` strips scripts, event handlers, dangerous attributes. `addHook()` for custom attribute allow-lists. `RETURN_TRUSTED_TYPE` for Trusted Types compliance. Used on all AI-generated content before rendering. |

### File Format & Serialization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| yaml | `^2.9` | YAML parse/stringify | `parse()`/`stringify()` like JSON equivalents. YAML 1.1/1.2 support. Used for reading/writing YAML frontmatter in `.md` note files during filesystem sync. |

### Testing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vitest | `^4.1` | Test framework | Vite-native, Jest-compatible. v4: browser context import from `vitest/browser`. Browser mode with Playwright provider for extension UI tests. Used for phase-level verification scripts (`verify:phase-N`) and isolation tests (no React/antd/defuddle/yaml in content bundle). |
| `@vitejs/plugin-react` | latest | React testing | Bundled with `@wxt-dev/module-react`. Required for Vitest JSX/TSX transform. |

## Installation

```bash
# Core extension framework
npm install wxt@^0.21 react@^19.2 react-dom@^19.2
npm install -D @wxt-dev/module-react@^1.2 typescript@^5

# UI
npm install antd@^6.5 @ant-design/x@^2.9 @ant-design/x-markdown@^2.9 motion@^12.42

# AI (core + providers)
npm install ai@^7 zod@^4.4
npm install @ai-sdk/openai@^4 @ai-sdk/anthropic@^4 @ai-sdk/google@^4 ollama-ai-provider@^1.2

# State management
npm install zustand@^5.0 immer@^10

# Search & storage
npm install minisearch@^7.2 idb@^8.0

# Content extraction & sanitization
npm install defuddle@^0.19 dompurify@^3.4

# File format
npm install yaml@^2.9

# Testing
npm install -D vitest@^4.1 @vitejs/plugin-react @vitest/browser-playwright@latest
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| WXT + `@wxt-dev/module-react` | Plasmo | Plasmo if you prefer convention-over-config with less manifest control. WXT chosen for explicit manifest control and file-based entrypoints that match MV3 architecture. |
| `@ai-sdk/*` providers | Direct fetch to provider APIs | Only if you need to avoid AI SDK's abstraction layer. AI SDK chosen for unified streaming, tool calling, abort handling across 5+ providers. |
| Motion (`motion/react`) | CSS transitions/animations | CSS-only if animations are simple (opacity/transform). Motion needed for `AnimatePresence` exit animations, shared layout transitions, gesture support. |
| idb (`jakearchibald/idb`) | Raw IndexedDB API | Raw API if you need maximum control over indexes/cursors. idb chosen for type-safe `DBSchema`, simplified transactions, and proven MV3 compatibility. |
| MiniSearch v7 | Lunr.js, Fuse.js | Lunr if you need stemming/stop-word removal. MiniSearch chosen for smaller bundle, prefix search, zero dependencies, and `addAllAsync` for large note databases. |
| DOMPurify | sanitize-html | sanitize-html if you need server-side sanitization. DOMPurify chosen for DOM-only speed, Trusted Types support, and being the de facto browser standard. |
| Zustand + Immer | Redux Toolkit, Jotai | Redux if team has existing Redux patterns and DevTools. Jotai if atomic state is preferred. Zustand chosen for minimal bundle, slices pattern matching MV3 multi-surface state, zero boilerplate. |
| Defuddle | @mozilla/readability | Readability if you need Node.js-only extraction with no DOM dependency. Defuddle chosen for browser-native `document` parsing, richer metadata, and active maintenance (2026). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `framer-motion` (deprecated package) | Rebranded to `motion`. The old `framer-motion` npm package is no longer the canonical distribution and receives no updates. | `motion` (import from `motion/react`) |
| `@ant-design/x-sdk` (`useXChat`, `OpenAIChatProvider`, `XRequest`) | Would let UI call AI providers directly, bypassing AgentOrchestrator → ProviderRouter → ContextOptimizer → MemoryEngine pipeline. Project architecture owns the data flow. | AgentOrchestrator with `ai` SDK's `streamText`/`generateText` directly |
| `@ant-design/x-card` (A2UI) | Deferred to v0.2+ per project scope. Interactive card-based UI for tool results. | Plain Bubble/Sender components for v0.1 |
| `tailwindcss`, `shadcn/ui`, `@radix-ui/react-*` | CSS class pollution in MV3 extension (conflicts with host page styles). Not needed when antd 6 covers all UI needs. | antd 6 components with ConfigProvider theming |
| `@anthropic-ai/sdk` directly | Bypasses AI SDK's unified provider interface, abort handling, and tool calling middleware. | `@ai-sdk/anthropic` through AI SDK core |
| `@ant-design/v5-patch-for-react-19` | antd 6 natively supports React 19 — patch is for antd v5 only. | Remove entirely; antd 6 needs no patch |
| `localStorage` in service worker | Not available in MV3 service workers. Ephemeral context — data lost on worker termination. | `chrome.storage.local` (synchronous listener registration) or IndexedDB from extension pages |
| `XMLHttpRequest` in any extension context | Blocked in MV3 service workers. Legacy API. | `fetch()` API |
| `setTimeout`/`setInterval` in service worker | Timers canceled when service worker terminates. Unreliable for periodic tasks. | `chrome.alarms` API with top-level listener registration |
| `@ant-design/icons` as separate package | Now bundled within `antd` v6. Import from `@ant-design/icons` only if using standalone (not recommended). | `import { XIcon } from '@ant-design/icons'` (shipped with antd 6) |
| `immer` used standalone | Redundant when Zustand already includes `zustand/middleware/immer`. | `import { immer } from 'zustand/middleware/immer'` |

## Stack Patterns by Variant

**For the Service Worker (background.js):**
- No React, antd, IndexedDB, DOM, or `window` access
- Use `chrome.storage.session` for session tokens, `chrome.storage.local` for settings
- `chrome.alarms` for periodic tasks (not `setInterval`)
- Register all listeners synchronously at top level
- `fetch()` for all network requests (not `XMLHttpRequest`)

**For the Side Panel (sidepanel.html):**
- Full React 19 + antd 6 + @ant-design/x components
- Zustand WorkspaceStore (primary writer, BroadcastBus leader)
- IndexedDB via idb for message bodies, notes, transaction logs
- DOMPurify on all rendered AI output
- Compact layout: ~400px width, no page injection

**For the Full App Tab (app.html):**
- Same React/antd/x stack as Side Panel
- Zustand WorkspaceStore (secondary, mirror read-only after primary election)
- All configuration, diagnostics, and deep work surfaces
- Full viewport layout

**For Content Scripts (v0.1):**
- Defuddle for page extraction only (no UI rendering)
- No React, antd, DOMPurify, yaml — bundle < 50KB
- Ephemeral MiniSearch index for current page content
- Message passing to service worker for AI requests

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `react@^19.2` | `antd@^6.5` | antd 6 natively supports React 19. Remove `@ant-design/v5-patch-for-react-19`. |
| `antd@^6.5` | `@ant-design/x@^2.9` | Both share antd 6's CSS-in-JS token system. Theme via shared `ConfigProvider`. |
| `ai@^7` | `@ai-sdk/openai@^4`, `@ai-sdk/anthropic@^4`, `@ai-sdk/google@^4` | Provider packages at v4 are the current stable for AI SDK core v7. Provider v1 is unsupported — see `AI_UnsupportedModelVersionError`. |
| `zod@^4.4` | `ai@^7` | AI SDK v7 tool schemas use Zod. `z.strictObject()` (v4) preferred over `.strict()` (v3 deprecated). |
| `motion@^12.42` | `react@^19.2` | Import from `motion/react`, NOT `framer-motion`. |
| `zustand@^5.0` | `immer@^10` | Zustand bundles `zustand/middleware/immer`. Do not install immer separately. |
| `wxt@^0.21` | `@wxt-dev/module-react@^1.2` | Module version must match WXT major. WXT 0.21.x uses module v1.x. |

## Sources

- Context7 `/wxt-dev/wxt` — WXT framework docs, entrypoints, Side Panel patterns (HIGH)
- Context7 `/websites/react_dev` — React 19 features, hooks (HIGH)
- Context7 `/ant-design/ant-design` — antd 6.5.0, v5→v6 migration, theming (HIGH)
- Context7 `/vercel/ai` — AI SDK v7, providers, tool calling, migration guides (HIGH)
- Context7 `/pmndrs/zustand` — Zustand v5, slices pattern, Immer middleware (HIGH)
- Context7 `/lucaong/minisearch` — MiniSearch v7 API, constructor, search (HIGH)
- Context7 `/jakearchibald/idb` — idb v8 API, DBSchema, transactions (HIGH)
- Context7 `/websites/motion_dev` — Motion v12, AnimatePresence, layout animations (HIGH)
- Context7 `/kepano/defuddle` — Defuddle v0.19, browser/Node parsing (HIGH)
- Context7 `/colinhacks/zod` — Zod v4, discriminatedUnion, v3→v4 migration (HIGH)
- Context7 `/ant-design/x` — Ant Design X v2.9, Bubble/Sender/Conversations/XMarkdown, RICH (HIGH)
- Context7 `/eemeli/yaml` — yaml v2.9, parse/stringify API (HIGH)
- Context7 `/cure53/dompurify` — DOMPurify v3.4, sanitize, hooks, Trusted Types (HIGH)
- Context7 `/vitest-dev/vitest` — Vitest v4, browser mode, configuration (HIGH)
- `developer.chrome.com` — chrome.sidePanel API reference (Chrome 114+), service worker migration guide (HIGH)
- `npm view` — All version numbers verified against npm registry as of 2026-07-28 (HIGH)

---

*Stack research for: Chrome MV3 AI Assistant Extension + Personal Knowledge Platform*
*Researched: 2026-07-28*
