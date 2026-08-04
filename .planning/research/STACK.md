# Stack Research — NowPilot v0.1

> Synthesized from `.planning/PRODUCT_SPEC_v0_1.md` §7 (Technology Stack), §0.2 package hygiene, and §23 ADRs. The spec is canonical — treat any conflict here as spec-wins.

## Stack Overview

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Build / extension framework | **WXT** | ^0.19 | MV3 scaffold, HMR, manifest generation; `@wxt-dev/module-react` ^0.3 |
| UI framework | **React / react-dom** | ^19 | |
| Component library | **Ant Design (antd)** | ^6 | Primary component library |
| Icons | **@ant-design/icons** | ^6 | Must match antd major |
| AI chat UI | **@ant-design/x** | ^2 | Bubble, Sender, Conversations, Prompts, Welcome, Attachments, Suggestion, Actions, ThoughtChain, Think, FileCard, Sources, Folder |
| Streaming markdown | **@ant-design/x-markdown** | ^2 | LaTeX/mermaid/code-highlight built in; replaces react-markdown/remark-gfm/rehype-highlight/highlight.js/katex |
| Animation | **motion** | ^12 | Framer Motion v12; import from `motion/react`. Do NOT install framer-motion |
| State | **zustand** | ^5 | Global stores (workspace, theme, chat) |
| Immutable updates | **immer** | ^10 | |
| AI SDK | **ai** | ^4 | Vercel AI SDK: streamText, tool calling, abort |
| OpenAI provider | **@ai-sdk/openai** | ^1 | Also OpenAI-compatible local endpoints (Ollama custom baseURL) |
| Anthropic provider | **@ai-sdk/anthropic** | ^1 | |
| Gemini provider | **@ai-sdk/google** | ^1 | |
| MCP | **@modelcontextprotocol/sdk** | ^1 | MCP client, StreamableHTTP transport |
| Validation | **zod** + **zod-to-json-schema** | ^3 | Boundary validation; Zod→JSON Schema for tools |
| Storage | **idb** | ^8 | Typed IndexedDB wrapper |
| YAML | **yaml** | ^2 | LLM-Wiki .md frontmatter |
| Extraction | **defuddle** | ^0.6 | Primary main-content→Markdown; Readability successor |
| Fallback extraction | **@mozilla/readability** | ^0.5 | Low-confidence Defuddle output |
| HTML→Markdown | **turndown** | ^7 | APC-lite / non-Defuddle path |
| Sanitization | **dompurify** | ^3 | XSS for AI/tool output |
| Search | **minisearch** | ^7 | Local full-text (notes + ephemeral page index). NO embeddings |
| Graph | **d3-force** | ^3 | Note graph layout |
| ZIP | **fflate** | ^0.8 | Export |
| CSV | **papaparse** | ^5 | |
| Crypto | **crypto.subtle (native)** | — | AES-GCM |
| IDs | **crypto.randomUUID() (native)** | — | |
| Testing | vitest, @testing-library/react, jsdom, msw | — | |
| Types | typescript ≥5.5, `strict: true` | — | |
| FS access types | **@types/wicg-file-system-access** | — | File System Access API (§27) |

## Explicitly BANNED (do not install)

`tailwindcss`, `@tailwindcss/vite`, `shadcn/ui`, `@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `react-markdown`, `remark-gfm`, `rehype-highlight`, `highlight.js`, `katex` (all superseded by @ant-design/x-markdown).

## Explicitly NOT adopted in v0.1

`@ant-design/x-sdk`, `@ant-design/x-card` (see §0.2, §23, §25.6).

## Package hygiene (§0.2)

- Do not install banned packages (risk R-9: a cheap implementer reaching for framer-motion/x-sdk/langchain).
- Import from `motion/react`, never `framer-motion`.
- Icon package major must match antd major.
- ESLint + Prettier required; TypeScript strict.

## Cost-effective implementation models

Primary implementers: Haiku / Gemini Flash / DeepSeek Flash. The stack above is deliberately small and typed — choose types/names from Appendix C, never invent module paths (R-1).
