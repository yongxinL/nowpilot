# Technology Stack

**Project:** NowPilot v0.1
**Researched:** 2026-07-10

## Recommended Stack

### Extension Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `wxt` | `^0.19` | MV3 scaffold, HMR, manifest generation | Type-safe, cross-browser, no cloud dependency; `openPanelOnActionClick` for side panel |
| `@wxt-dev/module-react` | `^0.3` | React integration for WXT | Official module; handles React refresh in extension contexts |

### UI Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react` / `react-dom` | `^19` | UI framework | Concurrent mode for streaming renders; React 19 is the minimum for Ant Design v6 |
| `antd` | `^6` | Primary component library | Enterprise-grade data components (Table, Form, Descriptions), mature forms/tables, CSS-variable theming by default, official `antd` CLI reduces AI-agent hallucination risk on the newer major |
| `@ant-design/icons` | `^6` | Ant Design icon set | Must match `antd` major version; v6 includes Anthropic/Claude/Gemini/DeepSeek/Ollama marks for provider selector |
| `@ant-design/x` | `^2` | AI chat presentation components | `Bubble`, `Sender`, `Conversations`, `ThoughtChain`, `Think`, `Attachments` map directly onto Chat/Agent UI; requires antd v6 |
| `@ant-design/x-markdown` | `^2` | Streaming-aware Markdown renderer | Built-in LaTeX, mermaid, and code-highlight plugins; replaces `react-markdown` + `remark-gfm` + `rehype-highlight` + `highlight.js` + `katex` (5 packages → 1) |
| `motion` | `^12` | Animation library | Framer Motion v12 published under `motion`; import from `motion/react`. Do NOT install `framer-motion` |

### State Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `zustand` | `^5` | Global stores (workspace, theme, chat) | 1 KB, no boilerplate, works outside React; `persist` middleware for `chrome.storage.sync`; single store per concern |
| `immer` | `^10` | Immutable updates | Enables mutable-style syntax on Zustand state without spread-spam |

### AI & Workflow
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `ai` | `^4` | Vercel AI SDK: `streamText`, tool calling, abort | Streaming/abort/tools; lighter than LangChain; works with any JS runtime |
| `@ai-sdk/openai` | `^1` | OpenAI + Ollama + OpenAI-compatible | Single adapter for 3 of 5 providers; Ollama exposes OpenAI-compatible API |
| `@ai-sdk/anthropic` | `^1` | Anthropic Claude | Ephemeral cache_control for prompt caching |
| `@ai-sdk/google` | `^1` | Google Gemini | cachedContent for prompt caching; supports tools |
| `@modelcontextprotocol/sdk` | `^1` | MCP client — StreamableHTTP transport | Only transport that works from extension pages (EventSource unavailable in SW) |
| `zod` | `^3` | Boundary validation | Every public module boundary must have a Zod schema; used for tool input/output and PlannerDecision |
| `zod-to-json-schema` | `^3` | Zod → JSON Schema for tool definitions | Required for MCP tool registration and AI SDK tool schemas |

### Storage
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `idb` | `^8` | Typed IndexedDB wrapper | Promise-based, tree-shakeable, handles upgrade transactions |
| `chrome.storage` | Native | Metadata, config, encrypted keys (local); tokens (session); theme/language (sync) | Built-in, no dependency, 10 MB limit (local) |

### Extraction & Text
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@mozilla/readability` | `^0.5` | Article extraction | Battle-tested, extracts clean HTML → `PageContext.markdown` |
| `turndown` | `^7` | HTML → Markdown | Converts ServiceNow case HTML and general page content |
| `dompurify` | `^3` | XSS sanitisation for AI/tool output | Must sanitize before any `PortableMarkdown` rendering; runs on AI responses and MCP tool results |

### Search & Data
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `minisearch` | `^7` | Local full-text search over notes | < 50 ms over 1,000 notes; no server, no model download; sufficient for v0.1 |
| `d3-force` | `^3` | Note graph layout (Full App) | Force-directed layout for wikilink graph; mature, well-documented |
| `fflate` | `^0.8` | ZIP export | Fast client-side ZIP for data export bundles |
| `papaparse` | `^5` | CSV parsing | Used for import flows |

### Security & Testing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `crypto.subtle` (native) | — | AES-GCM encryption for API keys | Browser-native, no dependency; PBKDF2 key derivation |
| `crypto.randomUUID()` (native) | — | ID generation | No `ulid` or `uuid` dependency needed |
| `vitest` | latest | Test runner | Fast, Vite-native, works with WXT |
| `@testing-library/react` | latest | React component testing | Renders AntD components, accessible queries |
| `jsdom` | latest | DOM environment for tests | Required for component tests |
| `msw` | latest | API mocking | Mock provider responses for AI runtime tests |

### Dev Dependencies
| Technology | Purpose |
|------------|---------|
| `typescript ≥5.5` | Type safety; `strict: true` |
| `eslint` | Linting with restricted imports (no tailwind, no framer-motion, no `@ant-design/x-sdk`) |
| `prettier` | Formatting |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| UI framework | Ant Design v6 | Tailwind CSS + shadcn/ui + Radix UI | Removed from v0.1; AntD v6 provides enterprise-grade data components (Table, Form, Timeline, Descriptions) that would need hand-building with Radix; CSS-variable theming is simpler than HSL token mapping; single package instead of 6+ |
| Markdown rendering | `@ant-design/x-markdown` | `react-markdown` + `remark-gfm` + `rehype-highlight` + `highlight.js` + `katex` | 5 packages vs 1; `x-markdown` is streaming-aware natively; built-in LaTeX/mermaid/code-highlight |
| AI chat data flow | Custom `AgentOrchestrator`/`ProviderRouter`/`ContextOptimizer` | `@ant-design/x-sdk` (`useXChat`, `ChatProvider`) | x-sdk calls providers directly from UI, bypassing Planner→Executor→Renderer, ContextOptimizer, MemoryEngine, AITransactionLog; would let UI code bypass tier caps |
| AI orchestration | Vercel AI SDK v4 + custom orchestrator | LangChain | LangChain is heavy (500 KB+), server-oriented, abstracting too much for a local-first extension |
| Animation | `motion` v12 | `framer-motion` | `framer-motion` is not the v12 package name; `motion` is the correct name with identical API |
| State management | Zustand v5 | React Context, Redux, Jotai | Zustand is 1 KB, works outside React (BroadcastBus handlers), no provider nesting; Redux is overkill for client-side extension state |
| ID generation | `crypto.randomUUID()` | `uuid`, `ulid` | Native, zero dependencies |
| Token estimation | Provider-native counter; fallback 4 chars ≈ 1 token | `tiktoken` | Avoids 3 MB WASM download; accurate enough for budget management |
| Embedding search | Deferred to v0.2+ | MiniSearch bag-of-words | 40 MB model download not justified for v0.1 note/memory search |
| A2UI / dynamic surfaces | Deferred to v0.2+ | `@ant-design/x-card` | A2UI command stream is a harder JSON target than the 3-branch PlannerDecisionSchema; unsafe for Haiku/Flash planners today |

## Explicitly NOT Adopted

| Package | Reason |
|---------|--------|
| `tailwindcss`, `@tailwindcss/vite` | Removed in v0.1; AntD v6 as sole design system |
| `shadcn/ui`, `@radix-ui/react-*` | Removed in v0.1; use AntD components instead |
| `framer-motion` | Wrong package name; use `motion` v12 |
| `@ant-design/x-sdk` | Duplicates and bypasses core AI runtime |
| `@ant-design/x-card` | A2UI deferred to v0.2+ |
| `@anthropic-ai/sdk`, `openai`, `@google/generative-ai` | Use `@ai-sdk/*` adapters exclusively |
| `react-markdown`, `remark-gfm`, `rehype-highlight`, `highlight.js`, `katex` | Superseded by `@ant-design/x-markdown` |
| `uuid`, `ulid` | Use `crypto.randomUUID()` |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Removed with Tailwind |

## Installation

```bash
# Core
pnpm add react react-dom antd @ant-design/icons @ant-design/x @ant-design/x-markdown motion zustand immer

# AI & workflow
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @modelcontextprotocol/sdk zod zod-to-json-schema

# Storage & extraction
pnpm add idb @mozilla/readability turndown dompurify

# Search & data
pnpm add minisearch d3-force fflate papaparse

# Dev dependencies
pnpm add -D wxt @wxt-dev/module-react typescript @types/react @types/react-dom @types/dompurify @types/d3-force
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom msw
pnpm add -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

## Sources

- PRODUCT_SPEC_v0_1.md §7 — canonical technology stack definition
- Ant Design v6 documentation — CSS-variable theming, `ConfigProvider` API, `compactAlgorithm`
- Ant Design X 2.x docs — `Bubble`, `Sender`, `Conversations`, `ThoughtChain`, `XProvider`
- Vercel AI SDK v4 docs — `streamText`, `generateText`, tool calling, abort propagation
- WXT v0.19 docs — entrypoints, HMR, `defineBackground`, `defineContentScript`
- Zustand v5 docs — `persist` middleware, `create` API, selector patterns
- @modelcontextprotocol/sdk docs — StreamableHTTP transport for extension pages
