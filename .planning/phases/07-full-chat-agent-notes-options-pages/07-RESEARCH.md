# Phase 07: Full Chat, Agent, Notes, Options Pages - Research

**Researched:** 2026-07-13
**Domain:** Chrome MV3 Extension UI — streaming chat, agent orchestration, notes with graph, multi-section options
**Confidence:** HIGH

## Summary

Phase 07 is the convergence point where all infrastructure phases (2–6) meet the UI across two surfaces (Side Panel + Full App Tab). The core technical challenge is architecting a streaming React hook hierarchy (`useStreamingLLM` → `useChat`/`useAgent`) that directly consumes `AgentOrchestrator.runWithContext()`'s `AsyncGenerator<OrchestratorEvent>`, feeds events through `ChunkBuffer`, and updates `@ant-design/x` Bubble.List and ThoughtChain components in real-time. All infrastructure services (`ContextOptimizer`, `MemoryEngine`, `ChatHistoryDB`, `NotesDB`, `AITransactionLog`) are already built and require only hook-level integration — no service modifications.

The component architecture follows existing shell patterns: ChatPage/AgentPage/NotesPage plug into `StandaloneRoot.renderActivePage` and `SidepanelRoot.renderActivePage`; Options sections plug into `OptionsRoot.renderSectionContent`. Surface adaptation is handled via the `WorkspaceState.activeSurface` flag and responsive density (compact for Side Panel, default for Full App). The hook layer owns all streaming/orchestration state; pages remain presentation-focused.

**Primary recommendation:** Build the hook hierarchy first (`useStreamingLLM` → `useChat`/`useAgent`) with thorough unit tests using mock `AsyncGenerator<OrchestratorEvent>`, then wire into the page components, then build Notes/Options as independent vertical slices. The Planner→Executor→Renderer pipeline streams exactly the `OrchestratorEvent` union types already defined in `pipelineTypes.ts` — no additional adapter layers needed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Streaming chat UI (Bubble.List) | Browser / Client | — | React component rendering, DOM updates via ChunkBuffer rAF batching |
| AsyncGenerator iteration + AbortController | Browser / Client | — | React hook manages `for await` loop and AbortManager lifecycle |
| Context assembly (MemoryEngine.assemble + ContextOptimizer.optimize) | Browser / Client | — | Hook calls these before invoking pipeline; no server-side tier exists |
| Pipeline execution (AgentOrchestrator.runWithContext) | Browser / Client | — | Singleton orchestrator runs in extension runtime; hook consumes yielded events |
| Conversation persistence (ChatHistoryDB) | Database / Storage | — | IndexedDB via existing idb wrapper; hook reads/writes through singleton |
| Note CRUD + wikilink indexing (NotesDB + MiniSearch) | Database / Storage | Browser / Client | IndexedDB storage + in-memory MiniSearch index rebuilt on mount |
| Note graph visualization (d3-force) | Browser / Client | — | Canvas-based force simulation running entirely in renderer process |
| Options form state (AntD Form) | Browser / Client | Database / Storage | Form state in React; persistence via ProviderStore (EncryptedStorage) and chrome.storage.local |
| Tool permission storage (np_mcp_permissions) | Database / Storage | — | chrome.storage.local key; accessed by PermissionStore/PermissionService |
| Draft persistence (WorkspaceState.drafts) | Database / Storage | — | chrome.storage.local via WorkspaceStore persist middleware |
| Cross-surface deep linking (WorkspaceRouter) | Browser / Client | — | URL query params parsed in Full App tab; focus-existing-tab deduplication |
| Title generation (Haiku-tier LLM call) | Browser / Client | — | Non-blocking LLM call in page runtime (not Service Worker); writes to ChatHistoryDB |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 — Hook owns streaming loop:** `useChat`/`useAgent` call `AgentOrchestrator.runWithContext()` directly and iterate the `AsyncGenerator` internally. No intermediate streaming service.
- **D-02 — Shared foundation, separate hooks:** `useStreamingLLM()` centralizes AsyncGenerator iteration, ChunkBuffer batching, AbortController management, and error handling. `useChat()` and `useAgent()` are separate consumer hooks.
- **D-03 — Mutable messages array:** Each renderer-chunk updates the last assistant message in-place via React state batching.
- **D-04 — ContextOptimizer inside the hook:** Hook assembles `ContextOptimizerInput`, calls `contextOptimizer.optimize()`, then invokes `AgentOrchestrator.runWithContext()`. Pages never do prompt assembly.
- **D-05 — Hybrid ThoughtChain + Modal.confirm:** Waiting-for-permission step inline in ThoughtChain + AntD `Modal.confirm` simultaneous.
- **D-06 — Persistent tool-level permissions:** Stored per-tool in `np_mcp_permissions` via chrome.storage.local. "Allow Always" persists; "Allow Once" is operation-scoped.
- **D-07 — One-by-one permission evaluation:** Each tool call evaluated independently. Sequential, no batch approval.
- **D-08 — Dedicated PermissionStore:** Lightweight, backed by chrome.storage.local `np_mcp_permissions`. Not a Zustand store. Dangerous tools always prompt.
- **D-09 — Standardized AntD Form pattern:** Left-aligned labels, single-column ~720px, shared validation/loading/save. Collection sections use `Form.List`.
- **D-10 — Inline Test Connection:** Provider row "Test Connection" button with loading state. Inline success/failure. Expandable diagnostics on failure.
- **D-11 — AntD Popconfirm on destructive deletes:** All delete actions use Popconfirm before removal.
- **D-12 — Three layout exceptions:** Providers (encrypted keys + connection testing), Import/Export (file-based), Prompt Templates (rich editor + preview).
- **D-13 — Sub-panel within Chat page:** Full App has conversation sidebar within ChatPage. Side Panel uses drawer/popover.
- **D-14 — Auto-create on first message:** No empty conversations on Chat open. Create on first send. Title generated async after first response.
- **D-15 — Runtime-side async title generation:** Non-blocking Haiku-tier call (temperature 0, 16 tokens, 3s timeout). Falls back to truncated first user message.
- **D-16 — Metadata list + active messages:** Fetch metadata for sidebar list. Load messages on-demand for active conversation only.
- **D-17 — Full pipeline visibility:** ThoughtChain exposes each major stage with progressive disclosure.
- **D-18 — Tool calls as ThoughtChain nodes:** Each tool: name, status icon, permission outcome badge, duration. Expandable input preview + result summary.
- **D-19 — Animated status with step name:** Active step updates in real-time as OrchestratorEvents arrive.
- **D-20 — Error Think items with inline recovery:** Recoverable failures expose inline Retry. Fatal failures provide actionable guidance.
- **D-21 — Minimal wikilink grammar:** `[[title]]` and `[[title|alias]]` only. Resolution: exact → case-insensitive → ambiguous → create-or-link.
- **D-22 — Split-pane editor:** Left: textarea with wikilink autocomplete. Right: XMarkdown preview. Side Panel uses preview toggle.
- **D-23 — Right sidebar backlinks panel:** Collapsible panel showing referencing notes with context snippet.
- **D-24 — Separate d3-force Graph view:** Interactive when ≥3 notes. Draggable nodes, click to navigate.
- **D-25 — Flat list with search:** No folder hierarchy. Sort by Updated Date (default), Created Date, Title.
- **D-26 — Context menu "Save to Note":** Each assistant message has "Save to Note" action. Opens lightweight dialog.
- **D-27 — Internal versioning with Undo:** Auto version on every save. Simple Undo/Revert only.
- **D-28 — Wikilink autocomplete dropdown:** `[[` triggers MiniSearch-ranked dropdown. "Create note" option for new titles.
- **D-29 — Entity-specific search:** Notes: MiniSearch. Conversations: metadata filter. Options: section search (already built).
- **D-30 — Persistent search bar above note list:** Debounced ~150ms MiniSearch queries.
- **D-31 — Conversation search: title/metadata only:** No full-text message search in v0.1.
- **D-32 — MiniSearch index lifecycle:** Full build on mount, incremental updates on CRUD.
- **D-33 — Per-conversation draft persistence:** Debounced writes. Survives navigation/switching/refresh/extension restart. Cleared on send.
- **D-34 — Drafts in WorkspaceState:** Stored as `WorkspaceState.drafts[conversationId]` via chrome.storage.local.
- **D-35 — Chat/Agent drafts only:** Notes have auto-save + versioning — no separate draft system.
- **D-36 — Clear on send or explicit discard:** "Clear Draft" action with confirmation prompt. No auto-expiry.
- **D-37 — Open Full App with page + context:** Deep links support Chat (conversationId), Agent (conversationId), Notes (noteId), Options (section), Diagnostics (operationId).
- **D-38 — URL query parameter transport:** `app.html?page=chat&conversationId=abc`. Matches existing diagnostics deep-link pattern.
- **D-39 — Focus existing tab + navigate:** Aligns with WorkspaceRouter deduplication model.
- **D-40 — No special back indicator:** Surfaces operate independently. Existing "Open Side Panel" action is sufficient.

### the agent's Discretion

- `useStreamingLLM()` internal implementation — async generator iteration, ChunkBuffer integration, AbortController wiring
- `useChat()` / `useAgent()` state shapes beyond `{ messages, send, abort, isStreaming, error }`
- `PermissionStore` / `PermissionService` exact interface — consistent with ToolRegistry/PermissionService patterns
- Options form component decomposition — per-section components following `OptionsRoot.renderSectionContent` pattern
- Title generation prompt design — Haiku-tier prompt
- d3-force graph configuration — force parameters, node sizing, edge styling, interaction details (note: react-force-graph-2d 1.29.1 wraps d3-force with React integration — planner to evaluate vs raw d3-force)
- MiniSearch index configuration — field definitions, tokenization, boost factors
- Wikilink autocomplete dropdown implementation
- Notes save debounce strategy for auto-versioning
- Provider connection test endpoint
- Import/Export file format and merge strategy
- Cmd+K command palette extension
- Error state patterns across pages

### Deferred Ideas (OUT OF SCOPE)

- Full version history browser for Notes
- Full-text conversation search across message bodies
- Cross-entity unified global search
- Batch tool permission approval
- Folder hierarchy for Notes
- Folder-based draft organization
- Real-time backlink updates across surfaces
- Undo for chat messages
- Export/import for individual Options sections
- Memory editing UI in Options

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | Streaming AI chat with abort on both surfaces | §Hook Architecture, §Streaming Integration |
| CHAT-02 | Chat history persistence in ChatHistoryDB with conversation list | §Chat Hook Integration — ChatHistoryDB already supports sessions + messages |
| CHAT-03 | First-message title generation (temp 0, 16 tokens, non-blocking) | §Title Generation — Haiku-tier call in hook |
| CHAT-04 | Slash command parsing (`/write`, `/ask`, `/research`, etc.) | §Sender + Suggestion — @ant-design/x Suggestion component |
| CHAT-05 | Provider/model selector (read-only Side Panel, editable Full App Options) | §Provider Selector — workspaceStore + providerStore |
| CHAT-06 | Chat UI built on @ant-design/x (Bubble, Sender, Conversations) | §Component Patterns — Bubble.List + Sender + Conversations |
| CHAT-07 | Markdown rendering via @ant-design/x-markdown with streaming support | §XMarkdown — streaming prop with hasNextChunk |
| CHAT-08 | One stream per session — abort active before starting new | §useStreamingLLM — AbortController management |
| CHAT-09 | Error states — Provider error, Retry, Switch Provider, Open Settings | §Error Handling — OrchestratorEvent error types |
| AGNT-01 | Agent workflows with AgentOrchestrator and tier caps | §useAgent — same pipeline as useChat, different UI |
| AGNT-02 | 12 built-in MCP tools via NowPilotMainServer | §Tool Registry — ToolRegistry.list() for Agent context |
| AGNT-03 | External MCP client via @modelcontextprotocol/sdk | §Agent Hook — tool schemas fed to ContextOptimizer |
| AGNT-04 | Tool call permission dialog — Allow once / Allow always / Deny | §Permission Flow — PermissionStore + Modal.confirm |
| AGNT-05 | Dangerous tools always prompt regardless of allow list | §PermissionStore — category:'dangerous' check |
| AGNT-06 | Agent UI built on @ant-design/x (ThoughtChain, Think) | §ThoughtChain Pattern — ThoughtChain + Think components |
| AGNT-07 | Tool results rendered as data strings through React JSX | §ThoughtChain Pattern — expandable content render |
| AGNT-08 | Macros execution — sequential skill/MCP/note steps, no eval | §Agent Hook — sequential execution via useAgent |
| NOTE-01 | Note CRUD — create, read, update, delete (Full App only) | §Notes Integration — NotesDB existing CRUD |
| NOTE-02 | Wikilinks with link parsing and resolution | §LinkParser — regex grammar + MiniSearch resolution |
| NOTE-03 | Backlinks panel showing referencing notes | §Backlinks — computed on save from all notes |
| NOTE-04 | Note graph visualization via d3-force (Full App only) | §Graph Visualization — d3-force / react-force-graph-2d |
| NOTE-05 | Full-text search via MiniSearch | §Search — MiniSearch already installed (v7.2.0) |
| NOTE-06 | Quick save to note from Side Panel chat responses | §Save to Note — lightweight dialog pattern |
| NOTE-07 | Note version tracking with idempotent saves | §Versioning — auto-version on save |
| OPT-01 | Providers section — add/edit/delete provider configs, test connections | §Options Forms — AntD Form + providerStore |
| OPT-02 | Models section — per-provider model list + context window override | §Options Forms — Form.List for provider models |
| OPT-03 | MCP Servers section — add/enable/disable external MCP servers | §Options Forms — table/list management |
| OPT-04 | Prompt Templates section — CRUD with variable editor | §Template Engine — variable interpolation |
| OPT-05 | Slash Commands section — manage slash command to template mapping | §Slash Commands — SlashCommandRegistry |
| OPT-06 | Memory section — view/edit user memory facts, enable/disable | §Memory Options — read-only in v0.1 |
| OPT-07 | Diagnostics section — transaction traces, export debug bundle | Already built in Phase 6 — existing DiagnosticsSection |
| OPT-08 | Import/Export section — sanitized JSON/ZIP export, import merge | §Import/Export — jszip already installed (3.10.1) |
| OPT-09 | Feature Flags section — toggle P2 features | §Feature Flags — chrome.storage.local flags |
| OPT-10 | Add-on Settings section — namespaced settings per registered add-on | §Add-on Settings — add-on registry namespacing |
| OPT-11 | Options accessible only from Full App (not Side Panel) | §Surface Restriction — Notes registered on standalone only |

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@ant-design/x` | ^2.8.0 [VERIFIED: npm registry] | Bubble, Sender, Conversations, ThoughtChain, Think | Official Ant Design AI UI library; 102K weekly downloads |
| `@ant-design/x-markdown` | ^2.8.0 [VERIFIED: npm registry] | Streaming markdown with LaTeX, mermaid, code highlighting | Streaming-optimized renderer; project-mandated |
| `antd` | ^6.5.0 [VERIFIED: npm registry] | Form, Modal, Popconfirm, ConfigProvider, theme | Project's sole design system |
| `minisearch` | ^7.2.0 [VERIFIED: npm registry] | Full-text search for notes | In-memory, 1.3M weekly downloads, well-maintained |
| `zustand` | ^5.0.0 [VERIFIED: npm registry] | State management (WorkspaceStore, ProviderStore, ThemeStore) | Already used; v5 pattern established |
| `react` / `react-dom` | ^19.2.0 [VERIFIED: npm registry] | UI framework | Project framework |
| `idb` | ^8.0.3 [VERIFIED: npm registry] | IndexedDB wrapper | Used by ChatHistoryDB, NotesDB, MemoryDB |
| `jszip` | 3.10.1 [VERIFIED: npm registry] | Import/Export ZIP | Already installed |

### New Dependencies Required
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `d3-force` | 3.0.0 | Force-directed graph simulation for notes | [VERIFIED: npm registry] 17.3M weekly downloads; de facto standard for force layouts |
| `react-force-graph-2d` | 1.29.1 | React wrapper for d3-force graph (optional — planner discretion) | [VERIFIED: npm registry] 485K weekly downloads; wraps d3-force with React canvas component, drag, zoom, pan built-in |

### NOT Adopted (Project Decisions)
| Library | Reason |
|---------|--------|
| `@ant-design/x-sdk` | Duplicates ProviderRouter/AgentOrchestrator/ContextOptimizer. PROJECT.md explicitly excludes. |
| `@ant-design/x-card` | A2UI dynamic-surface generation deferred to v0.2+. PROJECT.md explicitly excludes. |
| `react-markdown` / `remark` / `rehype` | Superseded by `@ant-design/x-markdown` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `d3-force` (raw) | `react-force-graph-2d` | raw: more control, less React-idiomatic; wrapper: built-in React canvas, zoom/pan/drag callbacks, but adds 150KB+ dep |
| `@ant-design/x` Conversations | Custom sidebar | Conversations provides built-in grouping, menu, creation callbacks — avoids hand-rolling conversation list UI |

**Installation:**
```bash
pnpm add d3-force@3.0.0
# Optional (planner discretion for graph):
pnpm add react-force-graph-2d@1.29.1
```

**Version verification:** All packages verified against npm registry on 2026-07-13.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| d3-force | npm | ~9 yrs | 17.3M/wk | github.com/d3/d3-force | OK | Approved |
| minisearch | npm | ~5 yrs | 1.37M/wk | github.com/lucaong/minisearch | OK | Approved — already installed |
| @ant-design/x | npm | ~1 yr | 102K/wk | github.com/ant-design/x | OK | Approved — already installed |
| @ant-design/x-markdown | npm | ~1 yr | 20.7K/wk | github.com/ant-design/x | OK | Approved — already installed |
| antd | npm | ~9 yrs | 3.6M/wk | github.com/ant-design/ant-design | SUS | [WARNING: flagged as too-new — latest version 6.5.1 published same-day (2026-07-13). Already locked in project. Planner should pin exact version.] |
| react-force-graph-2d | npm | ~5 yrs | 485K/wk | github.com/vasturiano/react-force-graph | OK | Approved (if planner chooses wrapper approach) |

**Packages removed due to SLOP verdict:** none

**Packages flagged as suspicious [SUS]:** antd (too-new — published same day as research. Already project dependency with existing code depending on v6.x APIs. Mitigation: pin exact version `6.5.1` in package.json, do NOT use `^`.)

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase 7 Component Tree                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  StandaloneRoot / SidepanelRoot                              │
│    │                                                         │
│    ├─ renderActivePage ──────────────────────────┐           │
│    │                                              │           │
│    │  ┌───────────────────────────────────────────┤           │
│    │  │ ChatPage                                  │           │
│    │  │  ├─ useChat() ─────────────────────────┐  │           │
│    │  │  │  ├─ useStreamingLLM()               │  │           │
│    │  │  │  │  ├─ AgentOrchestrator             │  │           │
│    │  │  │  │  │  .runWithContext()              │  │           │
│    │  │  │  │  │  → AsyncGenerator<Event>       │  │           │
│    │  │  │  │  ├─ ChunkBuffer                   │  │           │
│    │  │  │  │  └─ AbortController               │  │           │
│    │  │  │  ├─ ContextOptimizer.optimize()       │  │           │
│    │  │  │  ├─ MemoryEngine.assemble()           │  │           │
│    │  │  │  └─ ChatHistoryDB                     │  │           │
│    │  │  ├─ Conversations (sidebar)              │  │           │
│    │  │  ├─ Bubble.List (streaming messages)     │  │           │
│    │  │  └─ Sender (composer + slash commands)   │  │           │
│    │  │                                           │  │           │
│    │  │ AgentPage                                 │  │           │
│    │  │  ├─ useAgent() ────────────────────────┐ │  │           │
│    │  │  │  ├─ useStreamingLLM() (shared)       │ │  │           │
│    │  │  │  ├─ PermissionStore                  │ │  │           │
│    │  │  │  └─ Modal.confirm (permission UI)    │ │  │           │
│    │  │  ├─ ThoughtChain (pipeline steps)       │ │  │           │
│    │  │  └─ ToolCard (expandable nodes)         │ │  │           │
│    │  │                                           │  │           │
│    │  │ NotesPage (Full App only)                 │  │           │
│    │  │  ├─ MiniSearch (index)                    │  │           │
│    │  │  ├─ LinkParser (wikilinks)                │  │           │
│    │  │  ├─ SplitPane (editor + preview)          │  │           │
│    │  │  ├─ BacklinksPanel                        │  │           │
│    │  │  └─ NoteGraphView (d3-force)              │  │           │
│    │  └───────────────────────────────────────────┘  │           │
│                                                       │           │
│  OptionsRoot                                           │           │
│    └─ renderSectionContent ─────────────────────────┐  │           │
│       ├─ ProvidersSection (Form + test connection)   │  │           │
│       ├─ ModelsSection (Form.List per provider)      │  │           │
│       ├─ MCPSection (table + enable/disable)         │  │           │
│       ├─ PromptsSection (rich editor + preview)      │  │           │
│       ├─ SlashSection (command mapping)              │  │           │
│       ├─ MemorySection (read-only facts list)        │  │           │
│       ├─ DiagnosticsSection (already built)          │  │           │
│       ├─ ImportExportSection (file upload)           │  │           │
│       ├─ FeatureFlagsSection (toggles)               │  │           │
│       ├─ AddonSettingsSection (namespaced)           │  │           │
│       └─ AboutSection (version info)                 │  │           │
└─────────────────────────────────────────────────────────────┘

Data Flow (Chat message → response):
  1. User types in Sender → onSubmit → useChat.send(message)
  2. useChat gathers: workspaceStore state, memoryEngine.assemble(), conversation history
  3. Assembled ContextOptimizerInput → contextOptimizer.optimize() → OptimizedContext
  4. OptimizedContext → agentOrchestrator.runWithContext() → AsyncGenerator<OrchestratorEvent>
  5. For each event:
     - 'text-delta' → ChunkBuffer.push() → rAF-batched → Bubble.List in-place update
     - 'plan-created', 'tool-called', 'tool-result' → useAgent updates thoughtChain steps[]
     - 'error' → error state displayed
     - 'text-complete' → finalize message, persist to ChatHistoryDB, trigger title gen
  6. On complete: agentOrchestrator internally fires memoryEngine.extract() (fire-and-forget)
```

### Hook Hierarchy (Exact API Contracts)

```
useStreamingLLM(config: {
  orchestrator: AgentOrchestrator,       // singleton injected
  contextOptimizer: ContextOptimizer,    // singleton injected
  memoryEngine: MemoryEngine,            // singleton injected
  chatHistoryDB: ChatHistoryDB,          // singleton injected
  workspaceStore: WorkspaceStore,        // Zustand hook
  providerStore: ProviderStore,          // Zustand hook (for model context window)
  systemPrompt: string,                  // built-in or custom
  onTransactionStart?: (operationId: string) => void,
  onTransactionEnd?: (operationId: string) => void,
}) → {
  // Core streaming primitives (returned to useChat/useAgent, not pages)
  streamEvents: (optimizedContext: OptimizedContext, preferredProviders: string[]) => AsyncGenerator<{
    type: 'delta' | 'tool-called' | 'tool-result' | 'plan-created' | 'error' | 'complete' | 'context-degraded' | 'context-error',
    payload: unknown,
  }>,
  abort: () => void,
  isStreaming: boolean,
  error: string | null,
}

// Internal: iterates AsyncGenerator, routes events through ChunkBuffer for text,
// passes tool/planner events directly through.
// ChunkBuffer wraps onFlush to yield batched text deltas.

useChat() → {
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; streaming: boolean; timestamp: number }>,
  send: (message: string) => Promise<void>,
  abort: () => void,
  isStreaming: boolean,
  error: string | null,
  conversations: Array<ConversationMeta>,      // { id, title, updatedAt, preview }
  activeConversationId: string | null,
  switchConversation: (id: string) => void,
  deleteConversation: (id: string) => void,
  newConversation: () => void,
  draft: string,                               // per-conversation draft
  setDraft: (text: string) => void,
  clearDraft: () => void,
  activeProvider: string | null,               // from workspaceStore
  setActiveProvider: (id: string) => void,     // updates workspaceStore
}

useAgent() → {
  steps: Array<ThoughtChainStep>,              // { id, type, title, status, content?, duration?, collapsible? }
  send: (message: string) => Promise<void>,
  abort: () => void,
  isStreaming: boolean,
  error: string | null,
  pendingPermission: { toolName: string; toolInput: unknown } | null,
  resolvePermission: (decision: 'allow-once' | 'allow-always' | 'deny') => void,
  conversations: Array<ConversationMeta>,
  activeConversationId: string | null,
  // ... same conversation management as useChat
}
```

### Recommended File Structure
```
src/
├── hooks/
│   ├── useStreamingLLM.ts        # Shared AsyncGenerator iteration + ChunkBuffer + AbortController
│   ├── useChat.ts                # Chat hook: messages, conversations, title generation, drafts
│   ├── useAgent.ts               # Agent hook: thoughtChain steps, permission handling
│   ├── useWorkspace.ts           # WorkspaceState access helper
│   └── useTheme.ts               # Theme access helper
├── core/
│   ├── pages/
│   │   ├── ChatPage.tsx          # Replace stub — surfaces adapt via useChat()
│   │   ├── AgentPage.tsx         # Replace stub — surfaces adapt via useAgent()
│   │   ├── NotesPage.tsx         # Replace stub — Full App only
│   │   └── OptionsPage.tsx       # Section router for Full App
│   ├── prompts/
│   │   ├── PromptManager.ts      # Template CRUD
│   │   ├── TemplateEngine.ts     # Variable interpolation
│   │   └── builtinTemplates.ts   # Built-in prompt templates
│   ├── slash/
│   │   └── SlashCommandRegistry.ts  # Registration + dispatch
│   ├── notes/
│   │   ├── LinkParser.ts         # Wikilink parsing + resolution
│   │   └── NoteGraph.ts          # d3-force graph data model
│   └── permissions/
│       └── PermissionStore.ts    # np_mcp_permissions management
├── components/
│   ├── chat/
│   │   ├── ConversationSidebar.tsx
│   │   ├── ChatMessage.tsx       # Bubble wrapper with XMarkdown
│   │   └── ProviderSelector.tsx  # Read-only dropdown
│   ├── agent/
│   │   ├── ThoughtChainView.tsx
│   │   ├── ToolCard.tsx          # Expandable tool call node
│   │   ├── PermissionDialog.tsx  # Modal.confirm wrapper
│   │   └── SourceCard.tsx        # Source reference card
│   ├── notes/
│   │   ├── NoteList.tsx          # Searchable flat list
│   │   ├── NoteEditor.tsx        # Split-pane editor
│   │   ├── NotePreview.tsx       # XMarkdown preview
│   │   ├── BacklinksPanel.tsx    # Referencing notes panel
│   │   ├── WikilinkAutocomplete.tsx  # [[ dropdown
│   │   ├── NoteGraphView.tsx     # d3-force / react-force-graph-2d
│   │   └── SaveToNoteDialog.tsx  # Chat → note dialog
│   ├── options/
│   │   ├── ProvidersSection.tsx
│   │   ├── ModelsSection.tsx
│   │   ├── MCPSection.tsx
│   │   ├── PromptsSection.tsx
│   │   ├── SlashSection.tsx
│   │   ├── MemorySection.tsx
│   │   ├── ImportExportSection.tsx
│   │   ├── FeatureFlagsSection.tsx
│   │   ├── AddonSettingsSection.tsx
│   │   ├── AppearanceSection.tsx
│   │   └── AboutSection.tsx
│   └── patterns/
│       ├── SkillMessageRenderer.tsx
│       └── HistoryListItem.tsx
└── tests/
    ├── hooks/
    │   ├── useStreamingLLM.test.ts
    │   ├── useChat.test.ts
    │   └── useAgent.test.ts
    ├── components/
    │   ├── ChatPage.test.tsx
    │   ├── AgentPage.test.tsx
    │   ├── NotesPage.test.tsx
    │   ├── OptionsPage.test.tsx
    │   └── patterns/
    │       └── ChatMessage.test.tsx
    └── core/
        └── notes/
            └── LinkParser.test.ts
```

### Pattern 1: AsyncGenerator Consumption in React Hooks
**What:** Use `for await...of` to iterate `AsyncGenerator<OrchestratorEvent>` inside a React hook. Route text-delta events through `ChunkBuffer` for rAF-batched DOM updates. Route tool/planner events directly to state.
**When to use:** `useStreamingLLM()` — the foundation hook for both useChat and useAgent.
**Example:**
```typescript
// Source: derived from AgentOrchestrator.runWithContext() API + ChunkBuffer pattern
// src/core/ai/pipeline/pipelineTypes.ts (OrchestratorEvent union)

async function* streamEvents(
  optimizedContext: OptimizedContext,
  preferredProviders: string[],
  abortController: AbortController,
): AsyncGenerator<StreamEvent> {
  const chunkBuffer = new ChunkBuffer((text) => {
    // rAF-batched — consumer pushes to React state
  });

  try {
    for await (const event of orchestrator.runWithContext(optimizedContext, preferredProviders)) {
      abortController.signal.throwIfAborted();
      switch (event.type) {
        case 'text-delta':
          chunkBuffer.push(event.text);
          break;
        case 'text-complete':
          chunkBuffer.flush();
          yield { type: 'delta', payload: event.fullText };
          yield { type: 'complete', payload: null };
          break;
        case 'plan-created':
        case 'tool-called':
        case 'tool-result':
          yield { type: event.type, payload: event };
          break;
        case 'error':
          chunkBuffer.flush();
          yield { type: 'error', payload: event.message };
          break;
        case 'context-degraded':
        case 'context-error':
          yield { type: event.type, payload: event };
          break;
      }
    }
  } finally {
    chunkBuffer.destroy();
  }
}
```

### Pattern 2: useChat State Model
**What:** Mutable `messages[]` array where the last assistant message is updated in-place on each `text-delta`. New user messages are appended. Conversation management is reactive.
**When to use:** ChatPage component.
**Example:**
```typescript
// Source: D-03 (mutable messages array) + @ant-design/x Bubble.List items mapping

function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (userMessage: string) => {
    // 1. Abort existing stream (CHAT-08)
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // 2. Append user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      streaming: false,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    // 3. Append placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      streaming: true,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, assistantMsg]);
    setIsStreaming(true);

    // 4. Assemble context + invoke pipeline
    const optimizedContext = await assembleContext(userMessage);
    const stream = streamEvents(optimizedContext, preferredProviders, abortRef.current);

    try {
      for await (const event of stream) {
        if (event.type === 'delta') {
          // Update last assistant message in-place (D-03)
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + (event.payload as string),
              };
            }
            return updated;
          });
        }
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Bubble.List items mapping (D-03 alignment)
  const bubbleItems = useMemo(() => messages.map(msg => ({
    key: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    streaming: msg.streaming,
    loading: msg.streaming && !msg.content,
  })), [messages]);

  return { messages, bubbleItems, send, abort, isStreaming };
}
```

### Pattern 3: useAgent with ThoughtChain + Permission Flow
**What:** Maps `OrchestratorEvent` to `ThoughtChainStep[]`. Intercepts `tool-called` events to check permissions via `PermissionStore`, presents `Modal.confirm` when needed, and resumes the pipeline.
**When to use:** AgentPage component.
**Example:**
```typescript
// Source: D-05 (hybrid ThoughtChain + Modal), D-17 (full pipeline visibility)
// @ant-design/x ThoughtChain items shape

type ThoughtChainStep = {
  key: string;
  title: string;
  description?: string;
  status: 'loading' | 'success' | 'error' | 'abort';
  content?: React.ReactNode;
  collapsible?: boolean;
  blink?: boolean;
};

function useAgent() {
  const [steps, setSteps] = useState<ThoughtChainStep[]>([]);
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
  const permissionRef = useRef<(decision: PermissionDecision) => void>();

  // Tool call handler — checks permissions
  const handleToolCall = useCallback(async (
    toolName: string,
    toolInput: unknown,
    isDangerous: boolean,
  ): Promise<PermissionDecision> => {
    if (isDangerous) {
      // D-05: always prompt for dangerous tools
      return new Promise(resolve => {
        setPendingPermission({ toolName, toolInput });
        permissionRef.current = resolve;
      });
    }

    const stored = await permissionStore.getPermission(toolName);
    if (stored === 'allow-always') return 'allow-always';
    if (stored === 'deny') return 'deny';

    // Prompt for unknown
    return new Promise(resolve => {
      setPendingPermission({ toolName, toolInput });
      permissionRef.current = resolve;
    });
  }, []);

  const resolvePermission = useCallback((decision: PermissionDecision) => {
    setPendingPermission(null);
    // Store if "allow always" (D-06)
    if (decision === 'allow-always') {
      // Get toolName from pendingPermission
      permissionStore.setPermission(pendingPermission!.toolName, 'allow-always');
    }
    permissionRef.current?.(decision);
  }, [pendingPermission]);

  return { steps, send, abort, isStreaming, pendingPermission, resolvePermission };
}
```

### Pattern 4: OptionsSection Rendering via renderSectionContent
**What:** Each section component receives `sectionId` from `OptionsRoot.renderSectionContent()` and renders a self-contained form. The shell provides sidebar navigation, search, and layout.
**When to use:** All 11 Options sections.
**Example:**
```typescript
// Source: OptionsRoot.tsx renderSectionContent pattern (already used by DiagnosticsSection)

// In registerOptionsSections.ts or similar wiring:
function OptionsPage({ sectionId }: { sectionId?: string }) {
  const renderSection = (id: string): React.ReactNode => {
    switch (id) {
      case 'providers': return <ProvidersSection />;
      case 'models': return <ModelsSection />;
      case 'mcp': return <MCPSection />;
      case 'prompts': return <PromptsSection />;
      case 'slash': return <SlashSection />;
      case 'memory': return <MemorySection />;
      case 'diagnostics': return <DiagnosticsSection />;  // already built
      case 'import-export': return <ImportExportSection />;
      case 'feature-flags': return <FeatureFlagsSection />;
      case 'addons': return <AddonSettingsSection />;
      case 'appearance': return <AppearanceSection />;
      case 'about': return <AboutSection />;
      default: return <DefaultSectionPlaceholder id={id} />;
    }
  };

  return <OptionsRoot
    initialSection={sectionId ?? 'providers'}
    renderSectionContent={renderSection}
  />;
}
```

### Pattern 5: Notes Wikilink Resolution + MiniSearch
**What:** `LinkParser` regex-extracts `[[title]]` and `[[title|alias]]`. Resolution pipeline: exact match → case-insensitive → MiniSearch fuzzy → prompt user for ambiguous matches → create-or-link.
**When to use:** NotesPage editor, preview renderer, backlinks computation.
**Example:**
```typescript
// Source: D-21 (minimal wikilink grammar), D-28 (MiniSearch autocomplete)
// MiniSearch API from /lucaong/minisearch

const WIKILINK_REGEX = /\[\[([^\]]+?)(?:\|([^\]]+?))?\]\]/g;

class LinkParser {
  private index: MiniSearch;

  constructor() {
    this.index = new MiniSearch({
      fields: ['title', 'content'],
      storeFields: ['id', 'title', 'updatedAt'],
      searchOptions: {
        boost: { title: 3 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
  }

  parseLinks(content: string): ParsedLink[] {
    const links: ParsedLink[] = [];
    let match;
    while ((match = WIKILINK_REGEX.exec(content)) !== null) {
      links.push({ title: match[1], alias: match[2] || match[1], raw: match[0] });
    }
    return links;
  }

  async resolve(title: string, allNotes: Note[]): Promise<ResolutionResult> {
    // Exact match
    const exact = allNotes.find(n => n.title === title);
    if (exact) return { found: true, noteId: exact.id };

    // Case-insensitive
    const caseInsensitive = allNotes.find(n => n.title.toLowerCase() === title.toLowerCase());
    if (caseInsensitive) return { found: true, noteId: caseInsensitive.id };

    // MiniSearch fuzzy
    const results = this.index.search(title, { fuzzy: 0.2, prefix: true });
    if (results.length === 1 && results[0].score > 0.5) {
      return { found: true, noteId: results[0].id as string };
    }
    if (results.length > 1) {
      return { found: false, ambiguous: true, candidates: results.map(r => ({
        id: r.id as string, title: r.title as string
      }))};
    }

    // No match — suggest create
    return { found: false, ambiguous: false };
  }
}
```

### Anti-Patterns to Avoid
- **Calling AgentOrchestrator.runWithContext() directly from components:** Pages must go through hooks. Direct calls bypass state management, abort handling, and context assembly.
- **Creating a separate streaming service between hooks and AgentOrchestrator:** D-01 explicitly prohibits this. The hooks iterate the AsyncGenerator directly.
- **Using `@ant-design/x-sdk`'s `useXChat`:** PROJECT.md excludes x-sdk. It duplicates ProviderRouter/AgentOrchestrator/ContextOptimizer.
- **Building a custom markdown renderer:** Use `@ant-design/x-markdown` with `streaming` prop. It handles LaTeX, mermaid, code highlighting, and streaming natively.
- **Implementing wikilink resolution as just `notes.find()`:** Must follow D-21 resolution pipeline: exact → case-insensitive → fuzzy → ambiguous → create-or-link.
- **Hand-rolling a conversation list sidebar:** Use `@ant-design/x` Conversations component with `items`, `activeKey`, `onActiveChange`, `groupable`, `menu` props.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming markdown rendering | Custom markdown renderer | `@ant-design/x-markdown` XMarkdown component | 20.7K weekly downloads; handles LaTeX, mermaid, code highlighting, streaming animation, DOMPurify sanitization |
| Chat message list with auto-scroll | Custom scroll-to-bottom logic | `@ant-design/x` Bubble.List with `autoScroll` | Built-in auto-scroll on new messages; managed by the component |
| Conversation sidebar with CRUD | Custom sidebar component | `@ant-design/x` Conversations component | Built-in grouping, context menus, creation callback, keyboard navigation |
| Agent step visualization | Custom step list | `@ant-design/x` ThoughtChain with `items` (status, collapsible, blink) | Built-in status icons (loading/success/error/abort), expand/collapse, blink animation |
| Reasoning content display | Custom collapsible panel | `@ant-design/x` Think component | Built-in loading state with blink, defaultExpanded control |
| Full-text search for notes | Custom search implementation | `minisearch` (already installed v7.2.0) | 1.3M weekly downloads; prefix search, fuzzy matching, field boosting, auto-suggestions, incremental updates |
| Force-directed graph visualization | Canvas + manual force simulation | `d3-force` 3.0.0 (or `react-force-graph-2d` for React integration) | 17.3M weekly downloads; de facto standard; velocity Verlet integrator, collision detection, link constraints |
| Permission persistence | Custom storage layer | `chrome.storage.local` + `PermissionStore` class | Existing workspaceStore pattern; `np_` key prefix convention |
| Import/Export file handling | Custom serialization | `jszip` (already installed 3.10.1) | ZIP creation/extraction for debug bundles and data export |
| Template variable interpolation | Custom string replace | `TemplateEngine` with `{{variable}}` regex | Simple, testable, no template library needed for basic variable substitution |

**Key insight:** The `@ant-design/x` component suite covers the entire chat and agent UI surface. Every custom UI solution in this domain would re-implement functionality that the library provides with better accessibility, performance, and consistency. The only custom React layer needed is the hook hierarchy that bridges the AI pipeline to these UI components.

## Runtime State Inventory

> This phase is NOT a rename/refactor phase. All page stubs are greenfield replacements. However, there are runtime state considerations for the new functionality:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | ChatHistoryDB (IndexedDB): sessions + messages stores — existing but empty. NotesDB (IndexedDB): notes store — existing schema. Both ready for Phase 7 writes. | Hook writes new records on first use; no migration needed |
| Live service config | `chrome.storage.local` keys: `np_workspace`, `np_providers` — exist from Phase 2. `np_mcp_permissions` — new key for Phase 7. | Add `np_mcp_permissions` key; existing keys used as-is |
| OS-registered state | None — extension is purely in-browser | No action |
| Secrets/env vars | API keys in EncryptedStorage via `np_providers` key — existing. Title generation needs a provider configured (Haiku-tier) to work. | User must have at least one provider configured; otherwise title gen falls back to truncated user message |
| Build artifacts | `workspaceStore.ts` needs `drafts` field added (D-34). `ChatHistoryDB` sessions store already has `title`, `preview`, `updatedAt` fields. | Add `drafts` to WorkspaceState; existing DB schema sufficient |

**Nothing found that requires migration — all new state uses existing or new keys.**

## Common Pitfalls

### Pitfall 1: Bubble.List Key Instability During Streaming
**What goes wrong:** Each `setMessages()` call creates new message objects, causing React to re-render all bubbles. When the assistant message content changes every ~16ms (rAF batch), the entire list re-renders, degrading performance.
**Why it happens:** `Bubble.List` relies on stable `key` props for efficient reconciliation. If message IDs change or if React detects content changes deep in the tree, it may re-render unnecessarily.
**How to avoid:** Use `useMemo` with `messages` as dependency for `bubbleItems`. The assistant message ID must remain stable throughout the stream (created once at stream start). Use React.memo on individual Bubble components if needed. The rAF batching via `ChunkBuffer` already reduces updates to ~60fps — don't add additional state updates between rAF frames.
**Warning signs:** Janky typing animation, high CPU usage, Chrome DevTools "React flamegraph" showing many Bubble.List commits per frame.

### Pitfall 2: AsyncGenerator Not Being Cancelled on Unmount
**What goes wrong:** Navigating away from Chat page while streaming continues in the background, leaking the AsyncGenerator and causing stale state updates on unmounted components.
**Why it happens:** `useEffect` cleanup doesn't abort the `AbortController`, or the `for await` loop doesn't check `abortSignal.aborted` before `setState`.
**How to avoid:** In `useStreamingLLM`: (1) create `AbortController` in a ref, (2) check `abortSignal.aborted` at the top of each loop iteration, (3) in `useEffect` cleanup: call `abortController.abort()`. The `AgentOrchestrator` already catches `AbortError` and yields `{ type: 'error', message: 'Operation cancelled' }` — the hook must swallow this after unmount.
**Warning signs:** Console warnings "Can't perform a React state update on an unmounted component", multiple streams running simultaneously.

### Pitfall 3: Permission Modal State Management During Stream Lifecycle
**What goes wrong:** A `Modal.confirm` for tool permission appears after the user has already navigated away from Agent page, or two permission dialogs stack because a new message was sent while one is pending.
**Why it happens:** Modal is decoupled from stream lifecycle. The async permission flow (`new Promise(resolve => ...)`) retains a closure over the state setter even after unmount.
**How to avoid:** Store `pendingPermission` in hook state. In `useEffect` cleanup: resolve pending permission with 'deny' if component unmounts. Before showing modal, check `isStreaming` — abort if not. The permission dialog should be rendered by the page component (not the hook) to benefit from React lifecycle.
**Warning signs:** Multiple overlapping Modals, "zombie" tool calls continuing after navigation.

### Pitfall 4: MiniSearch Index Not Rebuilt After Note Deletion
**What goes wrong:** Searching for newly created notes returns stale/no results, or deleted notes still appear in search results.
**Why it happens:** MiniSearch is an in-memory index. `add()` and `remove()` must be called on every NotesDB mutation. If the index is only built on mount, edits during the session are invisible to search.
**How to avoid:** D-32: Full build on Notes page mount via `miniSearch.addAll(notesDB.getAllNotes())`. Then use `miniSearch.add(note)` on create/update and `miniSearch.discard(noteId)` on delete. The debounced search bar (150ms) queries the in-memory index, which is always consistent with NotesDB.
**Warning signs:** Newly created notes not appearing in search, "ghost" results for deleted notes, search results count ≠ visible note count.

### Pitfall 5: d3-force SVG/Canvas Confusion in React
**What goes wrong:** Using raw d3-force with SVG elements inside React leads to DOM conflicts (d3 modifies DOM directly, React expects ownership).
**Why it happens:** d3-force is a physics engine, not a rendering library. It outputs `{ x, y, vx, vy }` positions. Rendering those positions requires either (a) d3's DOM manipulation (conflicts with React) or (b) React rendering from force state.
**How to avoid:** Option A: Use `react-force-graph-2d` which wraps d3-force in a React canvas component — clean React integration. Option B: Use raw d3-force but render with a `<canvas>` ref and custom draw loop, keeping React out of the force simulation render path. The planner should evaluate the tradeoff. **Never** let d3 and React both manipulate the same DOM nodes.
**Warning signs:** Nodes disappearing after re-render, double-rendered elements, React reconciliation errors in graph area.

### Pitfall 6: Conversations Component Not Reflecting Async Title Generation
**What goes wrong:** Title generated asynchronously after first response, but Conversations sidebar doesn't update because the `items` array wasn't refreshed.
**Why it happens:** `ChatHistoryDB.updateSession()` writes to IndexedDB, but the Conversations component's `items` are managed by React state. The hook must update state after the async title generation completes.
**How to avoid:** After title generation succeeds: (1) update `ChatHistoryDB.sessions` via `chatHistoryDB.updateSession()`, (2) update local `conversations` state in the hook, (3) Conversations component re-renders with new title. Use a `refreshConversations()` function that re-reads from `ChatHistoryDB.getAllSessions()`.
**Warning signs:** Conversations sidebar shows "New Conversation" even after title was generated, title appears in DB but not in UI.

## Code Examples

### ChatPage: Wiring useChat to @ant-design/x Components
```typescript
// Source: @ant-design/x Bubble.List + Sender + Conversations API (Context7)
// Source: D-13 (sub-panel), D-14 (auto-create), D-15 (title generation)

import { Bubble, Conversations, Sender, Suggestion } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import { useChat } from '@/hooks/useChat';

export function ChatPage({ surface }: { surface: 'sidepanel' | 'standalone' }) {
  const {
    bubbleItems, send, abort, isStreaming,
    conversations, activeConversationId, switchConversation,
    newConversation, deleteConversation, draft, setDraft,
  } = useChat();

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Conversation sidebar — Full App inline, Side Panel in Drawer */}
      {surface === 'standalone' && (
        <Conversations
          style={{ width: 260 }}
          items={conversations}
          activeKey={activeConversationId}
          onActiveChange={switchConversation}
          groupable
          creation={{ label: 'New Chat', onClick: newConversation }}
          menu={(conv) => ({
            items: [{ key: 'delete', label: 'Delete', danger: true }],
            onClick: ({ key }) => key === 'delete' && deleteConversation(conv.key),
          })}
        />
      )}

      {/* Messages + Composer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Bubble.List
          style={{ flex: 1, padding: 16 }}
          role={{
            assistant: {
              placement: 'start',
              contentRender: (content) => <XMarkdown content={content} streaming={{ hasNextChunk: false }} />,
            },
            user: { placement: 'end' },
          }}
          items={bubbleItems}
          autoScroll
        />

        <div style={{ padding: '0 16px 16px' }}>
          <Suggestion items={slashCommands} onSelect={(val) => setDraft(draft + val + ' ')}>
            {({ onTrigger, onKeyDown }) => (
              <Sender
                value={draft}
                loading={isStreaming}
                onChange={(v) => { setDraft(v); if (v.endsWith('/')) onTrigger({}); }}
                onKeyDown={onKeyDown}
                onSubmit={(msg) => send(msg)}
                onCancel={abort}
                placeholder="Ask anything... (type / for commands)"
                autoSize={{ minRows: 1, maxRows: 6 }}
              />
            )}
          </Suggestion>
        </div>
      </div>
    </div>
  );
}
```

### XMarkdown with Streaming Support
```typescript
// Source: @ant-design/x-markdown API (Context7 /websites/x_ant_design)
// Source: D-03 (in-place message updates)

<XMarkdown
  content={message.content}
  streaming={{
    hasNextChunk: message.streaming,  // true while still receiving deltas
    enableAnimation: true,
    animationConfig: { fadeDuration: 200, easing: 'ease-in-out' },
  }}
  openLinksInNewTab={true}
  components={{
    // Custom code block renderer
    code: ({ children, className }) => {
      const language = className?.replace('language-', '');
      return <CodeBlock language={language} code={String(children)} />;
    },
  }}
/>
```

### ThoughtChain for Agent Page
```typescript
// Source: @ant-design/x ThoughtChain API (Context7)
// Source: D-17 (full pipeline visibility), D-18 (tool calls as nodes)

<ThoughtChain
  items={steps.map(step => ({
    key: step.id,
    title: step.title,
    description: step.description,
    status: step.status as 'loading' | 'success' | 'error' | 'abort',
    content: step.content,          // expandable detail
    collapsible: step.collapsible ?? (step.type === 'tool'),
    blink: step.status === 'loading',
  }))}
  expandedKeys={expandedKeys}
  onExpand={setExpandedKeys}
/>
```

### Notes MiniSearch Index Setup
```typescript
// Source: MiniSearch API from /lucaong/minisearch (Context7)
// Source: D-29 (entity-specific search), D-30 (debounced 150ms), D-32 (index lifecycle)

const notesIndex = new MiniSearch({
  fields: ['title', 'content'],
  storeFields: ['id', 'title', 'updatedAt', 'created'],
  searchOptions: {
    boost: { title: 3 },
    prefix: true,
    fuzzy: 0.2,
  },
  // Custom tokenizer to handle wikilinks as tokens
  tokenize: (text) => text.split(/[\s.,;:!?()[\]{}]+/).filter(Boolean),
});

// On CRUD:
notesIndex.add({ id, title, content, updatedAt, created });
notesIndex.remove(noteId);
notesIndex.replace({ id, title, content, updatedAt, created });

// Search with 150ms debounce:
const results = notesIndex.search(query, {
  prefix: true,
  fuzzy: 0.2,
  boost: { title: 3 },
});
```

## State Management Strategy

### Hook-Owned State (per hook instance)
| Hook | State Owned | Persistence | Cross-Surface Sync |
|------|------------|-------------|-------------------|
| `useStreamingLLM` | `isStreaming`, `error`, `AbortController` ref | None (ephemeral) | No — each surface has own hook instance |
| `useChat` | `messages[]` (current conversation), `activeConversationId`, `draft` (from workspaceStore) | Drafts via workspaceStore.drafts; messages via ChatHistoryDB | Drafts sync via workspaceStore BroadcastBus; conversation list re-read on focus |
| `useAgent` | `steps[]`, `pendingPermission`, permission modal state | None (ephemeral) | No — each surface has independent Agent session |

### Store-Owned State (cross-surface)
| Store | State Relevant to Phase 7 | Surface Sync Mechanism |
|-------|--------------------------|----------------------|
| `workspaceStore` | `activeProvider`, `activeSurface`, `conversationId`, `drafts[convId]` | chrome.storage.local + BroadcastBus WORKSPACE_UPDATED |
| `providerStore` | `apiKeys`, `selectedProvider`, `modelEntries`, `providerPriority`, `tierAssignments` | EncryptedStorage + Zustand persist |
| `themeStore` | `mode` (light/dark/auto) | Zustand persist |

### Database-Owned State (persistent, not reactive)
| Database | Data | Hook Access Pattern |
|----------|------|-------------------|
| `ChatHistoryDB` | sessions (metadata), messages (bodies) | Read on mount/switch, write on send/complete |
| `NotesDB` | notes (CRUD), concepts (wikilinks) | Read on page load, write on save, search via MiniSearch |
| `MemoryDB` | user facts, preferences | Accessed by MemoryEngine during hook's pre-optimization phase |

### Cross-Surface Sync for Conversations
When a conversation is created/updated on one surface:
1. Hook writes to `ChatHistoryDB` (IndexedDB — always consistent)
2. Hook updates `workspaceStore.conversationId` (triggers BroadcastBus)
3. Other surface's hook re-queries `ChatHistoryDB.getAllSessions()` on focus

Drafts follow the same pattern via `workspaceStore.drafts[conversationId]`.

## Integration Surface Mapping

### Existing Services Consumed by Hooks

| Service | Method Called | When | Input | Output |
|---------|--------------|------|-------|--------|
| `memoryEngine` | `assemble(conversationId, userMessage, tier)` | Before context optimization | conversationId: string, userMessage: string, tier: ModelContextTier | `MemoryAssembleResult { memory[], conversationContext, preferences }` |
| `contextOptimizer` | `optimize(input)` | After memory assembly, before pipeline | `ContextOptimizerInput` (see contextTypes.ts) | `OptimizedContext { operationId, tier, sections[], provenance, minimalMode }` |
| `agentOrchestrator` | `runWithContext(optimizedContext, preferredProviders)` | After context optimization | `OptimizedContext`, `string[]` | `AsyncGenerator<OrchestratorEvent>` |
| `chatHistoryDB` | `getAllSessions()`, `getMessagesBySession(id)`, `addMessage(msg)`, `createSession(s)` | On mount, switch, send, complete | Various | Various |
| `notesDB` | `getAllNotes()`, `getNote(id)`, `createNote(n)`, `updateNote(n)`, `deleteNote(id)` | On Notes page mount, CRUD | Various | Various |
| `useWorkspaceStore` | `activeProvider`, `setConversationId()`, `drafts[]` | Throughout hook lifecycle | — | Reactive state |
| `useProviderStore` | `selectedProvider`, `modelEntries`, `apiKeys` | Provider selection, model context window lookup | — | Reactive state |

### Shell Component Props (Pages Must Satisfy)

| Shell | Prop | Type | Phase 7 Pages Must |
|-------|------|------|-------------------|
| `StandaloneRoot` | `renderActivePage` | `(item: NowPilotNavItem) => React.ReactNode` | Return `<ChatPage surface="standalone" />` when `item.id === 'chat'`, etc. |
| `SidepanelRoot` | `renderActivePage` | `(item: NowPilotNavItem) => React.ReactNode` | Return `<ChatPage surface="sidepanel" />` when `item.id === 'chat'` |
| `OptionsRoot` | `renderSectionContent` | `(sectionId: string) => React.ReactNode` | Return the appropriate section component for each sectionId |

### Page Component Surface Adaptation Pattern

```typescript
// ChatPage adapts to both surfaces:
// - Side Panel (~400px): compact, conversation drawer
// - Full App: full layout with inline conversation sidebar

export function ChatPage({ surface, conversationId }: ChatPageProps) {
  const hook = useChat({ surface, initialConversationId: conversationId });

  if (surface === 'sidepanel') {
    return <ChatPageCompactLayout hook={hook} />;
  }
  return <ChatPageFullLayout hook={hook} />;
}
```

## Options Form Implementation Strategy

### Per-Section Component Mapping

| Section ID | Component | Form Pattern | Data Source | Dependencies |
|------------|-----------|-------------|-------------|-------------|
| `providers` | `ProvidersSection` | AntD Form + encrypted key handling + test connection (D-12 exception) | `providerStore` | `providerStore` (API keys), Provider adapter for connection test |
| `models` | `ModelsSection` | AntD Form with `Form.List` per provider | `providerStore.modelEntries` | `providerStore` |
| `mcp` | `MCPSection` | Table with enable/disable toggles, add/edit/delete | New `np_mcp_servers` key or in-memory | MCP SDK |
| `prompts` | `PromptsSection` | Rich editor + template variable preview (D-12 exception) | New `np_prompt_templates` key | `TemplateEngine` |
| `slash` | `SlashSection` | AntD Form.List mapping commands to templates | New `np_slash_commands` key | `SlashCommandRegistry`, `PromptManager` |
| `memory` | `MemorySection` | Read-only facts list with enable/disable | `MemoryDB.getAllUserFacts()` | `MemoryDB` |
| `appearance` | `AppearanceSection` | AntD Form with theme mode + density | `themeStore` | `themeStore` |
| `diagnostics` | `DiagnosticsSection` | Already built in Phase 6 | `AITransactionLogDB` | None (complete) |
| `import-export` | `ImportExportSection` | File upload/merge workflow (D-12 exception) | All DB data | `jszip` (already installed) |
| `feature-flags` | `FeatureFlagsSection` | Toggle list | New `np_feature_flags` key | None |
| `addons` | `AddonSettingsSection` | Namespaced settings per add-on | AddonRegistry | AddonRegistry |
| `about` | `AboutSection` | Static version info | package.json version | None |

### Shared Form Pattern (Standard Sections)
```typescript
// All standard sections follow this pattern (D-09):
function StandardOptionsSection({ title, children }: SectionProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const handleSave = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      await persistValues(values);
      message.success('Saved');
    } catch (err) {
      message.error('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <Title level={4}>{title}</Title>
      <Form form={form} layout="horizontal" labelAlign="left" onFinish={handleSave}>
        {children}
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
        </Form.Item>
      </Form>
    </div>
  );
}
```

## Notes Engine Architecture

### LinkParser Parsing Strategy
1. **Regex extraction:** `\[\[([^\]]+?)(?:\|([^\]]+?))?\]\]` — captures `[[title]]` and `[[title|alias]]`
2. **Resolution pipeline (D-21):** exact match → case-insensitive → MiniSearch fuzzy (threshold 0.5) → ambiguous match (multiple candidates) → create-or-link
3. **Backlink computation:** For each note, scan all other notes' content for wikilinks targeting this note's title. Store computed backlinks map. Rebuild on save.
4. **Rendering:** In preview mode, replace `[[title]]` with `<Link>` components (if resolved) or "create note" action (if unresolved). In editor mode, display as raw text with syntax highlighting.

### MiniSearch Index Configuration (D-29, D-30, D-32)
```typescript
const notesIndex = new MiniSearch({
  fields: ['title', 'content'],       // full-text index both
  storeFields: ['id', 'title', 'content', 'updatedAt', 'created'],
  searchOptions: {
    boost: { title: 3 },              // title matches weighted 3x
    prefix: true,                     // partial word matching
    fuzzy: 0.2,                       // ~20% edit distance tolerance
  },
  tokenize: (text, fieldName) => {
    if (fieldName === 'title') {
      return text.split(/[\s]+/).filter(Boolean);   // word tokenization
    }
    return text.split(/[\s.,;:!?()[\]{}]+/).filter(Boolean);  // with punctuation splitting
  },
});
```

### d3-force Graph Integration (D-24)
**Data model:** `{ nodes: NoteNode[], links: NoteLink[] }` where each `NoteNode` has `{ id, title }` and each `NoteLink` has `{ source: nodeId, target: nodeId }` derived from wikilinks.

**If using raw d3-force:**
```typescript
const simulation = forceSimulation(nodes)
  .force('link', forceLink(links).distance(100))
  .force('charge', forceManyBody().strength(-300))
  .force('center', forceCenter(width / 2, height / 2))
  .force('collision', forceCollide().radius(30))
  .on('tick', () => {
    // Update canvas/ref with new node positions
  });
```

**If using react-force-graph-2d:**
```tsx
<ForceGraph2D
  graphData={{ nodes, links }}
  nodeLabel="title"
  nodeColor={() => token.colorPrimary}
  onNodeClick={(node) => navigateToNote(node.id)}
  width={containerWidth}
  height={containerHeight}
/>
```

### Versioning/Undo (D-27)
Auto-version on every save: store previous version in a `notes_versions` IndexedDB object store with `{ noteId, version, content, timestamp }`. Undo restores the most recent version and creates a new version entry with the pre-undo content. Simple stack, no branching.

## Risk Assessment

| Risk Area | Severity | Likelihood | Gap |
|-----------|---------|-----------|-----|
| **AgentOrchestrator permission integration:** The existing pipeline does NOT yield `waiting-permission` events. The `ExecutorService` calls `PermissionService.canExecute()` which returns `false` (default-deny). Phase 7 needs the pipeline to pause and yield when permission is needed, then resume after user decision. | HIGH | HIGH | The pipeline must be extended or a callback mechanism added. The `DefaultPermissionService` must be replaced with a UI-integrated implementation. This is the #1 integration risk. |
| **d3-force dependency:** `d3-force` is NOT in package.json. Must be added. Raw d3-force requires SVG/Canvas DOM management in React — significant complexity if not using react-force-graph-2d. | MEDIUM | MEDIUM | Add `d3-force` to package.json. Evaluate `react-force-graph-2d` as wrapper to reduce React integration complexity. |
| **Title generation provider requirement:** Title generation fires a Haiku-tier LLM call. Requires a configured provider. If no provider is configured, falls back to truncated user message (acceptable per D-15). | LOW | MEDIUM | Graceful fallback already designed. Title gen should catch provider errors silently. |
| **WorkspaceStore `drafts` field:** `WorkspaceState` interface does not currently have a `drafts` field. Must be added with migration-safe default. | LOW | LOW | Add `drafts: Record<string, string>` with default `{}`. Zustand persist handles new field. |
| **ChatHistoryDB session schema:** Existing schema has `title`, `preview`, `updatedAt` fields — sufficient for D-16 metadata list. No schema migration needed. | LOW | LOW | None. Existing schema is compatible. |
| **MiniSearch bundle size:** MiniSearch v7.2.0 is ~8KB gzipped. Adding to content script bundle would violate HARD-01 (50KB cap). But MiniSearch is only used in Notes page (Full App runtime), not in content scripts. | LOW | LOW | Confirm MiniSearch is NOT imported in content script entry points. |
| **Options Page routing:** Options accessible via `chrome.runtime.openOptionsPage()` (D-11) opens `options.html` (separate entry point). OptionsRoot already renders in that context. Deep-linked sections via URL hash already work (`OptionsRoot.handleSelect` updates `window.location.hash`). | LOW | LOW | Existing pattern works. Only need to read initial hash on mount. |
| **Cross-surface conversation sync:** Two surfaces might both have active ChatPage. `ChatHistoryDB` is IndexedDB — always consistent. But `workspaceStore.conversationId` cross-surface sync via BroadcastBus has latency. | LOW | LOW | Accept brief inconsistency. Both surfaces read from consistent IndexedDB on conversation switch. |

### Critical Gap: Permission Flow in Pipeline

The existing pipeline (`AgentOrchestrator.runWithContext()` → `executePlannerLoop()` → `executor.execute()`) calls `PermissionService.canExecute()` synchronously. For Phase 7, the tool execution flow must:

1. **Yield** `{ type: 'waiting-permission', toolName, toolInput }` from the AsyncGenerator
2. **Pause** the planner loop (do not proceed with execution)
3. **Wait** for the hook to call `resolvePermission(decision)` — either via a Promise, callback, or AbortSignal pattern
4. **Resume** or **skip** based on the decision

**Recommended approach:** Extend `AgentOrchestrator` with a `setPermissionResolver(resolver: PermissionResolver)` method. The `PermissionResolver` interface: `(toolName: string, toolInput: unknown) => Promise<'allow-once' | 'allow-always' | 'deny'>`. The orchestrator yields a `waiting-permission` event, then `await`s the resolver. The hook's `PermissionStore` implements this resolver with `Modal.confirm` integration.

**Risk mitigation:** The planner should create this pipeline extension as an early task (Wave 0 or Wave 1), before hook implementation depends on it.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 with jsdom |
| Config file | `vitest.config.ts` — existing, with `@` alias |
| Quick run command | `npx vitest run tests/hooks/useStreamingLLM.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | Streaming loop processes text-delta events and updates messages array | unit | `vitest run tests/hooks/useStreamingLLM.test.ts` | ❌ Wave 0 |
| CHAT-02 | Conversations list loaded from ChatHistoryDB on mount | integration | `vitest run tests/hooks/useChat.test.ts` | ❌ Wave 0 |
| CHAT-03 | Title generated async, falls back to truncated message on failure | unit | `vitest run tests/hooks/useChat.test.ts` | ❌ Wave 0 |
| CHAT-04 | Slash command parsing dispatches to registered handlers | unit | `vitest run tests/core/slash/SlashCommandRegistry.test.ts` | ❌ Wave 0 |
| CHAT-06 | Bubble.List renders streaming messages with XMarkdown | component | `vitest run tests/components/ChatPage.test.tsx` | ❌ Wave 0 |
| CHAT-07 | XMarkdown renders code blocks, LaTeX, and mermaid | component | `vitest run tests/components/patterns/ChatMessage.test.tsx` | ❌ Wave 0 |
| CHAT-08 | Abort cancels active stream, new send creates new stream | unit | `vitest run tests/hooks/useStreamingLLM.test.ts` | ❌ Wave 0 |
| CHAT-09 | Error events render error state with retry action | component | `vitest run tests/components/ChatPage.test.tsx` | ❌ Wave 0 |
| AGNT-04 | Permission modal appears for tool calls, decisions flow to resolvePermission | unit | `vitest run tests/hooks/useAgent.test.ts` | ❌ Wave 0 |
| AGNT-06 | ThoughtChain renders steps with status icons and expandable content | component | `vitest run tests/components/agent/ThoughtChainView.test.tsx` | ❌ Wave 0 |
| NOTE-02 | Wikilink regex extracts [[title]] and [[title|alias]] | unit | `vitest run tests/core/notes/LinkParser.test.ts` | ❌ Wave 0 |
| NOTE-05 | MiniSearch returns ranked results for note titles and content | unit | `vitest run tests/core/notes/LinkParser.test.ts` (combined) | ❌ Wave 0 |
| NOTE-07 | Version created on save, undo restores previous version | unit | `vitest run tests/core/notes/NoteVersioning.test.ts` | ❌ Wave 0 |
| OPT-01 | Provider form validates keys, test connection returns success/error | component | `vitest run tests/components/options/ProvidersSection.test.tsx` | ❌ Wave 0 |
| ALL-PAGES | ErrorBoundary wraps every page with AntD Result fallback | component | `vitest run tests/components/ --testNamePattern="ErrorBoundary"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose` on relevant test file
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/hooks/useStreamingLLM.test.ts` — covers AsyncGenerator iteration, ChunkBuffer integration, abort, error handling (CHAT-01, CHAT-08)
- [ ] `tests/hooks/useChat.test.ts` — covers send(), message state, title generation, conversation CRUD (CHAT-02, CHAT-03)
- [ ] `tests/hooks/useAgent.test.ts` — covers step state, permission flow, Modal mock (AGNT-04)
- [ ] `tests/core/slash/SlashCommandRegistry.test.ts` — covers registration, dispatch, conflict handling (CHAT-04)
- [ ] `tests/core/notes/LinkParser.test.ts` — covers wikilink regex, resolution pipeline, MiniSearch integration (NOTE-02, NOTE-05)
- [ ] `tests/core/notes/NoteVersioning.test.ts` — covers auto-version on save, undo restore (NOTE-07)
- [ ] `tests/core/permissions/PermissionStore.test.ts` — covers get/set/clear, dangerous tool always-prompt (AGNT-05)
- [ ] Framework install: none — vitest, jsdom, @testing-library/react already configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | User authentication not in scope for v0.1 |
| V3 Session Management | No | Session management is browser-level (extension) |
| V4 Access Control | No | Access control is surface-level (Side Panel vs Full App) |
| V5 Input Validation | Yes | All user inputs (chat messages, note content, option form fields) validated via Zod schemas (`ContextOptimizerInput` already schema-validated). User-provided wikilink titles sanitized. |
| V6 Cryptography | Yes | API keys encrypted via EncryptedStorage (AES-GCM-256) — existing from Phase 2. No new cryptography in Phase 7. |

### Known Threat Patterns for Phase 7 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **XSS via wikilink titles in XMarkdown:** Malicious `[[<script>alert(1)</script>]]` rendered through XMarkdown | Tampering | XMarkdown uses DOMPurify internally for sanitization. Additionally, validate wikilink titles against `/^[\w\s-]+$/` before rendering. |
| **Prompt injection via malicious note content:** Note content fed to ContextOptimizer as `notes[]` — user could inject instructions | Spoofing | ContextOptimizer separates sections by kind — note content goes into `notes_metadata` section, not `system_prompt`. Low risk. |
| **Excessive memory writes via rapid tool approvals:** User rapidly approves tool calls, generating large IndexedDB transaction logs | Denial of Service | Rate limiter (existing Phase 2) applied per add-on. Permission decisions are small writes. AITransactionLog pruning (Phase 6) handles transaction volume. |
| **Option form cross-site data leak via import:** Import file contains external URLs or scripts | Information Disclosure | Import/Export uses JSON format only. Validate structure before writing to stores. Reject files with unexpected keys or non-JSON content. |
| **Slash command injection:** User-defined slash command mapping to template that includes `{{userInput}}` — template could be crafted to leak system prompt context | Information Disclosure | Template variables are explicit (`{{variable}}`) with known set. TemplateEngine should only substitute registered variables. No arbitrary code execution. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom markdown renderer (react-markdown + remark/rehype) | `@ant-design/x-markdown` with `streaming` prop | Phase 1 (project decision) | Smaller bundle, streaming-optimized, built-in LaTeX/mermaid/code highlighting |
| `@ant-design/x-sdk` useXChat for message management | Custom `useChat` hook consuming AgentOrchestrator AsyncGenerator | Phase 3 (project decision) | Full control over pipeline lifecycle; no duplicate abstraction layer |
| `useRef` for mutable message state | `useState` with in-place array update (D-03) | Phase 7 (this phase) | Simpler, aligns with React batching; refs would bypass React rendering |
| `@modelcontextprotocol/sdk` (v1) | StreamableHTTP transport | Phase 8 (future) | v0.1 uses built-in tools only; external MCP in v0.2 |

**Deprecated/outdated:**
- `@ant-design/x-sdk` — not adopted per PROJECT.md; use custom hooks directly on AgentOrchestrator
- `react-markdown` / `remark` stack — replaced by `@ant-design/x-markdown`

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | WXT build, vitest | ✓ | (runtime) | — |
| pnpm | Package management | ✓ | (runtime) | — |
| Chrome MV3 | Extension runtime | ✓ | (user's browser) | — |
| d3-force | Notes graph visualization | ✗ | — | Install via `pnpm add d3-force@3.0.0` |
| react-force-graph-2d | Notes graph (optional wrapper) | ✗ | — | Install via `pnpm add react-force-graph-2d@1.29.1` (or use raw d3-force) |
| minisearch | Notes full-text search | ✓ | 7.2.0 (installed) | — |
| @ant-design/x | Chat/Agent UI components | ✓ | 2.8.0 (installed) | — |
| @ant-design/x-markdown | Markdown rendering | ✓ | 2.8.0 (installed) | — |
| jszip | Import/Export ZIP | ✓ | 3.10.1 (installed) | — |
| ChatGPT/LLM provider | Title generation, chat responses | User-configured | — | Title gen falls back to truncated user message; chat shows error state if no provider |

**Missing dependencies with no fallback:**
- d3-force — blocks notes graph visualization. Must be installed before Notes feature development.

**Missing dependencies with fallback:**
- react-force-graph-2d — optional; raw d3-force with canvas rendering is viable alternative.

## Sources

### Primary (HIGH confidence)
- [Context7 /ant-design/x] — Bubble, Bubble.List, Sender, Conversations, ThoughtChain, Think component APIs, patterns, and usage examples. Source Reputation: High. Verified via npm registry (v2.8.0, 102K weekly downloads).
- [Context7 /websites/x_ant_design] — XMarkdown streaming Markdown renderer API, streaming animation config, incomplete markdown handling. Source Reputation: High.
- [Context7 /lucaong/minisearch] — Full-text search engine: index configuration, field boosting, prefix search, fuzzy matching, tokenization, incremental updates. Source Reputation: High. Verified via npm registry (v7.2.0, 1.37M weekly downloads).
- [Context7 /d3/d3-force] — Velocity Verlet integrator, force simulation API, forceLink, forceCollide, forceManyBody, forceCenter. Source Reputation: High. Verified via npm registry (v3.0.0, 17.3M weekly downloads).
- [Context7 /vasturiano/react-force-graph] — React wrapper for d3-force: 2D/3D canvas components, zoom/pan/drag callbacks, node click events. Source Reputation: High. Verified via npm registry (v1.29.1, 485K weekly downloads).
- [Source code — AgentOrchestrator.ts] — `runWithContext()` API: `AsyncGenerator<OrchestratorEvent>`, accepts `OptimizedContext` + `preferredProviders`. OrchestratorEvent union in pipelineTypes.ts.
- [Source code — ContextOptimizer.ts] — `optimize()` accepts `ContextOptimizerInput` (userInput, systemPrompt, memory, toolSchemas, conversationHistory, etc.), returns `OptimizedContext`.
- [Source code — MemoryEngine.ts] — `assemble(conversationId, userMessage, tier)` returns `MemoryAssembleResult { memory[], conversationContext, preferences }`.
- [Source code — ChatHistoryDB.ts] — `createSession`, `getAllSessions`, `getMessagesBySession`, `addMessage`. Existing schema sufficient.
- [Source code — NotesDB.ts] — `createNote`, `getNote`, `getAllNotes`, `updateNote`, `deleteNote`. Existing schema sufficient.
- [Source code — OptionsRoot.tsx] — `renderSectionContent(sectionId)` injection pattern. 12 defined sections, search, sidebar navigation.
- [Source code — StandaloneRoot.tsx, SidepanelRoot.tsx] — `renderActivePage(item) => ReactNode` pattern. Surface adaptation via component props.
- [chrome.storage API docs] — `chrome.storage.local.set/get`, `onChanged` event for cross-context sync. Verified from official Chrome Developer documentation.

### Secondary (MEDIUM confidence)
- [Source code — PermissionService.ts] — `DefaultPermissionService` always returns `false`. Must be extended/replaced for Phase 7 UI-integrated permission flow.
- [Source code — ChunkBuffer.ts] — rAF-batched buffer with `push()`, `flush()`, `destroy()`. Consumed by `useStreamingLLM`.
- [Source code — pipelineTypes.ts] — `OrchestratorEvent` union: plan-created, tool-called, tool-result, text-delta, text-complete, error, context-degraded, context-error. No `waiting-permission` event type.

### Tertiary (LOW confidence)
- None — all claims verified against authoritative sources (Context7 docs, npm registry, or actual source code).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AgentOrchestrator pipeline can be extended to support `waiting-permission` events without breaking existing tests | Risk Assessment | HIGH — if the pipeline cannot be extended, the entire Agent permission flow must be redesigned. Mitigation: early spike task. |
| A2 | react-force-graph-2d provides adequate performance for 100+ note nodes (typical use case) | Architecture | MEDIUM — if performance is poor with large graphs, may need to switch to raw d3-force or virtualize. Mitigation: test with 500+ nodes before committing. |
| A3 | `@ant-design/x` XMarkdown `streaming` prop handles partial/incomplete markdown gracefully (e.g., truncated code fence mid-stream) | Component Patterns | LOW — documented to support `hasNextChunk` and `incompleteMarkdownComponentMap`. Mitigation: test with edge cases. |
| A4 | MiniSearch v7.2.0's default English tokenizer is sufficient for note content (no CJK tokenization needed in v0.1) | Notes Engine | LOW — if users write notes in CJK languages, search quality will degrade. Mitigation: document limitation; can add custom tokenizer later. |
| A5 | Title generation using Haiku-tier provider is fast enough (< 3s) to not block the chat UI | Chat Architecture | LOW — fallback to truncated user message already designed. If consistently slow, increase timeout or skip. |
| A6 | `OperatorPackageLegitimacyTool` and other MCP-related tool registrations exist and are accessible via `ToolRegistry.list()` | Agent Integration | MEDIUM — if tool registry is empty, Agent page has nothing to display. Check tool registration status early. |

## Open Questions (RESOLVED)

1. **AgentOrchestrator permission extension mechanism**
   - What we know: The current pipeline calls `PermissionService.canExecute()` which returns `false` (default-deny). There is no mechanism to pause and resume.
   - What's unclear: The exact architecture for adding a `PermissionResolver` callback pattern without breaking the existing Planner→Executor loop.
   - Recommendation: Planner should add a Wave 0 spike task: "Pipeline Permission Extension Spike" to design and prototype. Two viable approaches: (A) `setPermissionResolver()` callback injected into AgentOrchestrator, (B) yield permission-needed-orchestrator-event from ExecutorService.
   - **RESOLVED:** AgentOrchestrator.setPermissionResolver() per Plan 07-04 Task 1 — `PermissionResolver` interface: `(toolName: string, toolInput: unknown) => Promise<'allow-once' | 'allow-always' | 'deny'>`. The orchestrator yields a `waiting-permission` event, then awaits the resolver callback. The hook's `PermissionStore` implements the resolver with `Modal.confirm` integration.
2. **d3-force vs react-force-graph-2d selection**
   - What we know: Both are viable. react-force-graph-2d provides React-idiomatic integration. Raw d3-force gives more control but requires Canvas ref management.
   - What's unclear: Whether the project prefers minimal dependencies (raw d3-force) or React-idiomatic integration (wrapper).
   - Recommendation: Planner to evaluate. If react-force-graph-2d is chosen, it's a single additional dependency that wraps d3-force. If raw d3-force is chosen, the Canvas rendering code must be written.
   - **RESOLVED:** raw d3-force + canvas ref per Plan 07-05 Task 2 — use `forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide` from 'd3-force' with custom canvas rendering via `useRef<HTMLCanvasElement>`. react-force-graph-2d not needed; keeps dependencies minimal.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries verified against npm registry and Context7 documentation.
- Architecture: HIGH — All integration surfaces mapped from actual source code. Hook hierarchy designed against real AgentOrchestrator API.
- Pitfalls: MEDIUM — Permission flow gap requires pipeline extension design; d3-force React integration requires careful approach. Both flagged with mitigation strategies.
- Options forms: HIGH — Existing OptionsRoot injection pattern well-understood; AntD Form patterns standard.
- Notes engine: HIGH — MiniSearch API verified; wikilink grammar specified; versioning pattern straightforward.

**Research date:** 2026-07-13
**Valid until:** 2026-08-13 (30 days — stable stack, no fast-moving deps)

## Sources

### Primary (HIGH confidence)
- [Context7 /ant-design/x] — Bubble, Bubble.List, Sender, Conversations, ThoughtChain, Think component APIs and patterns
- [Context7 /websites/x_ant_design] — XMarkdown streaming renderer API, streaming animation config
- [Context7 /lucaong/minisearch] — Full-text search indexing, tokenization, prefix/fuzzy search, incremental updates
- [Context7 /d3/d3-force] — Force simulation API, forceLink, forceCollide, forceManyBody
- [Context7 /vasturiano/react-force-graph] — React wrapper component API, zoom/pan/drag callbacks
- [Source code] AgentOrchestrator.ts — runWithContext() API contract, OrchestratorEvent types
- [Source code] ContextOptimizer.ts — optimize() with ContextOptimizerInput
- [Source code] MemoryEngine.ts — assemble() and extract() APIs
- [Source code] ChatHistoryDB.ts, NotesDB.ts — existing CRUD APIs
- [Source code] OptionsRoot.tsx, StandaloneRoot.tsx, SidepanelRoot.tsx — shell injection patterns
- [Source code] pipelineTypes.ts — OrchestratorEvent union type
- [chrome.storage API docs] — chrome.storage.local API, onChanged event
- [npm registry] — Package versions and legitimacy verified for all dependencies

### Secondary (MEDIUM confidence)
- [Source code] PermissionService.ts — DefaultPermissionService default-deny pattern
- [Source code] ChunkBuffer.ts — rAF-batched streaming buffer API
- [Source code] workspaceStore.ts — WorkspaceState interface, persist middleware pattern

### Tertiary (LOW confidence)
- None identified — all claims cross-referenced against authoritative sources
