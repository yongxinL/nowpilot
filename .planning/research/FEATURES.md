# Feature Landscape

**Domain:** Chrome MV3 AI Assistant Extension + Personal Knowledge Platform
**Researched:** 2026-07-28

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| AI Chat with streaming | Every AI assistant extension has this. Users expect real-time token-by-token streaming, not loading spinners. | Med | AI SDK v7 `streamText` with `textStream` async iterator. antd-x Bubble with XMarkdown streaming mode. |
| Multi-provider support | Users have existing API keys for OpenAI/Anthropic/Google. Local-only (Ollama) is insufficient. | Med | AI SDK unified provider interface. Each provider is a separate `@ai-sdk/*` package with identical API surface. |
| Side Panel access | MV3 standard. Users trigger from toolbar icon or keyboard shortcut. Must work across tabs. | Low | WXT `sidepanel/` entrypoint. chrome.sidePanel API with `setPanelBehavior({openPanelOnActionClick: true})`. |
| Chat history persistence | Users expect conversations to survive browser restart. | Med | IndexedDB via idb for message bodies. Service worker cannot access IndexedDB directly — storage logic lives in extension pages. |
| Conversation management | Multiple conversations, rename, delete, search. | Med | Conversations component from @ant-design/x for UI. Zustand store for conversation list state. |
| Web page context extraction | "Summarize this page", "What's on this page?" are primary use cases. | Med | defuddle for content extraction. Content script message passing to service worker. Ephemeral MiniSearch index per tab. |
| Dark mode | Table stakes in 2025. Auto-detection via `prefers-color-scheme`. | Low | antd 6 ConfigProvider `theme.algorithm: theme.darkAlgorithm`. Live toggle across both surfaces. |
| Keyboard shortcuts | Power users demand keyboard-first workflows. Cmd+K command palette. | Low-Med | chrome.commands API for global shortcuts. antd modal for command palette UI. |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Atomic notes with wikilinks | Obsidian-like note graph within an AI assistant. Unique in the extension ecosystem. | High | MiniSearch full-text index + cosine similarity for link suggestions. `[[wikilink]]` syntax parsing. Backlink tracking. |
| LLM-Wiki auto-enrichment | AI auto-tags, categorizes, and summarizes notes. Single haiku call for all enrichment tasks. | Med-High | AI SDK `generateText` with structured output. Cost-effective: ~$0.0005/note with Haiku. |
| Filesystem sync (one-way) | Export notes as `.md` with YAML frontmatter. Restore from folder with additive upsert. | Med | yaml v2 for frontmatter. File System Access API for folder picker. Additive upsert prevents data loss. |
| RICH conversational UX | Persona-driven, intention-aware chat. Welcome cards, context-aware quick-action chips, clarification chips, follow-up chips. | High | Motion v12 for transitions. antd-x Bubble/Sender for UI. PersonaInjector for system prompt prepending. IntentClassifier (URL-pattern, no LLM). |
| Planner→Executor→Renderer pipeline | Cost-effective AI runtime. Haiku/Flash for planning decisions, deterministic validation for execution, concise rendering. Tier caps prevent runaway costs. | High | AI SDK tool calling. Zod discriminated union for PlannerDecisionSchema. ExecutorService validates all tool calls deterministically. |
| Full App Tab for deep work | Side Panel is too narrow for note graphs, configuration, diagnostics. Full viewport tab as secondary surface. | Med | WXT `app/` entrypoint mapped to `chrome_url_overrides` or `tabs.create`. Shared WorkspaceStore with BroadcastBus single-writer election. |
| External MCP client | Connect to external MCP servers for tools beyond the 12 built-in. StreamableHTTP transport. Permission-gated. | High | Custom MCP client implementation. Tool registration per external server. Permission dialog before first use. |
| AITransactionLog | Full trace of every AI interaction: prompt, tool calls, provider, timing. TraceRedactor for secret redaction. | Med | IndexedDB log store. Structured logging format. DiagnosticsPanel in Full App for inspection. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Page injection (Shadow DOM, floating widgets) | MV3 content script restrictions. Security risk of host-page write-back. Deferred to v0.2+. | Clipboard-only insert. Extraction-only content scripts. |
| Bidirectional filesystem sync | Conflict resolution complexity. Data loss risk. Not MVP-critical. | One-way app→FS sync for export. Restore from folder with additive upsert for import. |
| Embedding-based semantic search | Requires embedding model (cost, latency). MiniSearch bag-of-words is sufficient for note search. v0.1 scope. | MiniSearch full-text search + LLM-routed reranking for context selection. |
| PDF chat | Complex extraction pipeline. Different UI paradigm. Out of scope entirely. | Web page extraction only. defuddle handles HTML pages. |
| Real-time collaboration | Not a social/community app. Personal knowledge assistant. Multi-user adds auth complexity. | Single-user. Local-first. |
| Mobile app | Chrome extension only. Web/PWA would require complete rearchitecture. | Chrome extension. Full App Tab for large-screen deep work. |
| @ant-design/x-sdk (useXChat, ChatProvider) | Would let UI call providers directly. Bypasses Planner→Executor→Renderer, ContextOptimizer, MemoryEngine. | AgentOrchestrator owns all AI data flow. Components (Bubble, Sender) used without x-sdk. |
| TTS output | Voice output requires audio setup, model selection, latency management. Deferred. | Web Speech API for voice input only. No TTS output. |

## Feature Dependencies

```
WorkspaceStore (Shell) → All features (shared state)
AI Provider adapters → PlannerService → ExecutorService → RendererService
PageContentService → AI Chat context injection, Research tool, Page-to-note conversion
Notes + MiniSearch → LLM-Wiki enrichment → RAG "Ask notes"
Notes + yaml frontmatter → Filesystem sync
AITransactionLog → TraceRedactor → DiagnosticsPanel
PersonaInjector → All AI interactions (prepended system prompt)
DOMPurify → All AI-generated content rendering
```

## MVP Recommendation

Prioritize Phase 1 (Shell), Phase 2 (AI Core), Phase 4a (Page Content), and Phase 5 (Notes) for the initial milestone:

1. **Shell (Phase 1):** Side Panel + Full App Tab shells, WorkspaceStore, theme toggle, Cmd+K palette
2. **AI Core (Phase 2):** Five provider adapters, Planner→Executor→Renderer pipeline, PersonaInjector, chat UI
3. **Page Content (Phase 4a):** defuddle extraction, ephemeral MiniSearch per tab, page-to-chat context injection
4. **Notes + LLM-Wiki (Phase 5-6):** Atomic notes with wikilinks, auto-enrichment, RAG, filesystem sync

**Defer:**
- External MCP client (Phase 7): Requires stable tool architecture first
- RICH full implementation (Phase 8): Incremental; start with P0 (welcome cards, chips)
- Add-ons (Phase 7): ServiceNow/Write/TeamGQM — valuable but not MVP-critical
- Security hardening (Phase 9): CSP, secret redaction — important but depends on previous phases' implementation

## Sources

- Context7 `/ant-design/x` — RICH paradigm, Bubble/Sender/Conversations components (HIGH)
- Context7 `/vercel/ai` — AI SDK tool calling, streaming, multi-step execution (HIGH)
- Context7 `/kepano/defuddle` — Content extraction API, metadata fields (HIGH)
- Context7 `/lucaong/minisearch` — Full-text search capabilities (HIGH)
- `developer.chrome.com` — chrome.sidePanel API, service worker restrictions (HIGH)
- NowPilot PROJECT.md — Validated/non-validated requirements, out of scope items (HIGH)
