# NowPilot

## What This Is

NowPilot is a privacy-first, extensible Chrome MV3 extension AI assistant. It provides AI chat with streaming, agent workflows with tool-calling, atomic note-taking with wikilinks, and ServiceNow support engineering integration — all running against user-configured AI providers (local or cloud). v0.1 exposes two UI surfaces: a Chrome Side Panel for lightweight contextual workflows and a Full App Tab for deep work and configuration.

## Core Value

Everything runs locally against user-configured providers. No data leaves the user's machine unless they explicitly configure a cloud provider. Privacy and cost-effective AI execution are the foundation.

## Requirements

### Validated

- [x] **WriteJournal + IndexedDBMigrator** — multi-store consistency, versioned migrations *(Phase 2)*
- [x] **Split storage strategy** — message bodies in IndexedDB, metadata in chrome.storage.local *(Phase 2)*
- [x] **Encrypted API keys** — AES-GCM-256 via EncryptedStorage with PBKDF2 derivation *(Phase 2)*

### Active

- [ ] **WXT MV3 project scaffold** with background SW, side panel, full app tab, content scripts, popup
- [ ] **Ant Design v6 + Ant Design X 2.x setup** — ConfigProvider, XProvider, compact Side Panel, default Full App, theme switching
- [ ] **5 AI provider adapters** — OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible via `@ai-sdk/*`
- [ ] **Planner → Executor → Renderer pipeline** — PlannerService, ExecutorService, RendererService, AgentOrchestrator with tier caps
- [ ] **ContextOptimizer** — dynamic token budget, context tiers (tiny/small/medium/large), degradation pipeline, minimal mode
- [ ] **ProviderRouter** — provider selection, retry, fallback, circuit breaker
- [ ] **PromptCacheManager + PromptCacheAdapter** — cached sections, provider-specific hints
- [ ] **Persistent memory** — ConversationMemoryStore, UserMemoryStore, PreferenceMemoryStore, MemoryEngine
- [ ] **12 built-in MCP tools + external MCP client** — StreamableHTTP transport
- [ ] **AITransactionLog** — telemetry, prompt traces, tool traces, provider traces, TraceRedactor

- [ ] **Side Panel shell** — Chat, Agent, Write (add-on), TeamGQM (add-on), Open Full App
- [ ] **Full App shell** — Chat, Agent, Notes, TeamGQM, Options (AntD Layout with Sider nav)
- [ ] **Shared WorkspaceStore** — cross-surface Zustand store, BroadcastBus sync, WorkspaceRouter handoff
- [ ] **Content scripts (extraction-only)** — PageContextBridge, SPANavigationWatcher, no UI rendering
- [ ] **ServiceNow add-on** — data extraction, side-panel/full-app UI only, no page injection
- [ ] **Write add-on** — side-panel primary, optional full-app page
- [ ] **TeamGQM add-on** — both surfaces
- [ ] **Notes** — list, editor, wikilinks, backlinks, graph (Full App only)
- [ ] **Options** — Providers, Models, MCP, Prompts, Slash, Diagnostics, Memory, Import/Export, FeatureFlags, AddonSettings
- [ ] **First-run onboarding**
- [ ] **Cmd+K command palette** — both surfaces
- [ ] **Data export/import**
- [ ] **Add-on architecture** — SidePanelPageRegistry, FullAppPageRegistry, AddonRegistry

### Out of Scope

- Page injection (Shadow DOM UI, floating widgets, `CaseInsightBox`) — deferred to v0.2+
- PDF chat — deferred to v0.2+
- Global internet-search page — replaced by `ResearchSkill` global add-on
- Embedding-based search — bag-of-words + MiniSearch is sufficient for v0.1
- Snippet/template productivity suite — deferred
- `@ant-design/x-sdk` (useXChat, ChatProvider) — duplicates ProviderRouter/AgentOrchestrator/ContextOptimizer
- `@ant-design/x-card` (A2UI) — dynamic-surface generation deferred to v0.2+
- Tailwind CSS, shadcn/ui, Radix UI — removed, using Ant Design v6 exclusively

## Context

NowPilot is a Chrome MV3 extension targeting cost-effective AI models (Haiku, Flash tier). The architecture enforces: system-owned memory, Planner→Executor→Renderer separation, context-adaptive execution with tier-based degradation, and strict cross-surface isolation. All UI uses Ant Design v6 component library with Ant Design X 2.x for chat presentation components (Bubble, Sender, Conversations, ThoughtChain). Markdown rendering uses `@ant-design/x-markdown`.

The project follows a core-vs-addon architecture where core owns AI runtime, MCP, messaging, storage, and registries; add-ons own site-specific extraction, UI pages, and skills.

Two UI surfaces share a WorkspaceStore via BroadcastBus: the Side Panel (~400px, compact density) for quick workflows beside the active tab, and the Full App Tab (full viewport, default density) for deep work, configuration, and diagnostics.

## Constraints

- **Platform**: Chrome MV3 extension only — WXT v0.19, Manifest V3
- **Tech stack**: React 19, TypeScript ≥5.5 strict, Ant Design v6, Ant Design X v2.x, Zustand v5, Vercel AI SDK v4, IndexedDB via idb v8
- **Package hygiene**: No direct provider SDKs (use `@ai-sdk/*`), no framer-motion (use `motion` v12), no tailwind/shadcn/radix, no `@ant-design/x-sdk` or `@ant-design/x-card`
- **MV3 restrictions**: No AI providers/MCP/EventSource from background SW, no IndexedDB from background SW, no setInterval in background SW
- **Cross-surface**: No imports between sidepanel/app entrypoints, each surface independently mountable
- **Layering**: Core must not import from addons; addons must not bypass core registries
- **Content scripts**: Extraction-only in v0.1 — no React rendering, no Shadow DOM, no CSS injection
- **Security**: AES-GCM encrypted API keys, chrome.storage.session for tokens, TraceRedactor on all logs, DOMPurify sanitization
- **Performance**: Budget-aware context optimization, rAF-batched streaming via ChunkBuffer, tier caps on agent steps

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Ant Design v6 + Ant Design X 2.x as sole design system | Replaces tailwind/shadcn stack; X provides battle-tested AI chat components | — Pending |
| `@ant-design/x-markdown` for markdown rendering | Replaces react-markdown/remark/rehype stack; streaming-aware, built-in LaTeX/mermaid/highlight | — Pending |
| `@ant-design/x-sdk` NOT adopted | Duplicates ProviderRouter/AgentOrchestrator/ContextOptimizer; would let UI code bypass core AI layer | — Pending |
| Two surfaces (Side Panel + Full App Tab) with shared WorkspaceStore | Side Panel too narrow for config/diagnostics; Full App Tab enables deep work without cluttering narrow panel | — Pending |
| Content scripts extraction-only in v0.1 | Eliminates host-page DOM risk, Shadow DOM complexity, and CSP conflicts; page injection deferred to v0.2+ | — Pending |
| Planner→Executor→Renderer pipeline with tier caps | Enables cost-effective AI models (Haiku/Flash) to work reliably; prevents runaway agent loops | — Pending |
| No embedding-based search in v0.1 | Bag-of-words + MiniSearch sufficient for local memory retrieval; avoids embedding model downloads | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-12*
