# Phase 7: Full Chat, Agent, Notes, Options Pages - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers complete, functional page sets across both UI surfaces (Side Panel + Full App Tab). Chat uses the existing Planner→Executor→Renderer pipeline with streaming via `@ant-design/x` Bubble/Sender and `@ant-design/x-markdown` rendering. Agent displays the pipeline flow through ThoughtChain/Think with tool permission dialogs. Notes (Full App only) supports wikilinks, backlinks, and d3-force graph visualization. Options covers 11 sub-sections with functional forms. All pages wire into existing infrastructure: AgentOrchestrator.runWithContext(), ContextOptimizer, MemoryEngine, ChatHistoryDB, NotesDB, AITransactionLog, and the WorkspaceStore cross-surface state. Requirements: CHAT-01 through CHAT-09, AGNT-01 through AGNT-08, NOTE-01 through NOTE-07, OPT-01 through OPT-11 (35 requirements total).
</domain>

<decisions>
## Implementation Decisions

### Chat/Agent Hook Architecture
- **D-01 — Hook owns streaming loop:** useChat/useAgent call AgentOrchestrator.runWithContext() directly and iterate the AsyncGenerator internally. No intermediate streaming service. The hook manages all streaming state (messages, loading, abort).
- **D-02 — Shared foundation, separate hooks:** A shared `useStreamingLLM()` hook centralizes AsyncGenerator iteration, ChunkBuffer batching, AbortController management, and error handling. `useChat()` and `useAgent()` are separate consumer hooks built on top — Chat and Agent have different state models (Bubble messages vs ThoughtChain steps) but share all orchestration/streaming logic.
- **D-03 — Mutable messages array:** Hooks return `{ messages, send, abort, isStreaming, error }`. Each renderer-chunk updates the last assistant message in-place via React state batching. This aligns with `@ant-design/x` Bubble.List where messages update in real-time.
- **D-04 — ContextOptimizer inside the hook:** `useChat()`/`useAgent()` internally gather workspace state, memory, tool schemas, and user input, then call `contextOptimizer.optimize()` before invoking `AgentOrchestrator.runWithContext()`. Pages call only `send(message)` — they remain presentation-focused and never do prompt assembly.

### Agent Permission Dialog UX
- **D-05 — Hybrid: ThoughtChain + Modal.confirm:** When a tool needs user approval, a waiting-for-permission step appears inline in the ThoughtChain (showing tool name and status), while an AntD `Modal.confirm` simultaneously opens for the security decision (Allow Once / Allow Always / Deny). This preserves execution transparency while ensuring dangerous operations are never missed.
- **D-06 — Persistent tool-level permissions:** "Allow Always" is stored per-tool in `np_mcp_permissions` via chrome.storage.local and survives browser restarts. The permission applies to that specific tool only and is reused automatically on future runs. "Allow Once" remains operation-scoped (no persistence).
- **D-07 — One-by-one permission evaluation:** Each tool call is evaluated independently as encountered by the Planner→Executor loop. The agent enters waiting-for-permission, presents the modal, and resumes after the user's decision. Multi-tool plans are sequential — no batch approval.
- **D-08 — Dedicated PermissionStore:** Implement as a lightweight PermissionStore/PermissionService backed by `chrome.storage.local` key `np_mcp_permissions`, not a UI-focused Zustand store. Dangerous tools always prompt every time regardless of stored permissions, matching the product spec.

### Options Form Patterns (11 Sections)
- **D-09 — Standardized AntD Form pattern:** All Options sections share a common layout: AntD Form, left-aligned labels, single-column content (~720px max width), shared validation/loading/save behaviors. Collection sections (Providers, Models, MCP, Prompts, Slash Commands, Add-on Settings) use `Form.List` or table/list management. Operational screens (Diagnostics — already done, Import/Export) use specialized layouts.
- **D-10 — Inline Test Connection:** Each provider row/card has a "Test Connection" button with AntD Button loading state. Inline success/failure result appears directly beneath the provider config. On failure, expandable diagnostics section shows error code, endpoint, response summary, and a copy button.
- **D-11 — AntD Popconfirm on destructive deletes:** All delete actions across Providers, Models, MCP Servers, Prompt Templates, and Slash Commands use standard AntD Popconfirm before removal. No undo workflow in v0.1.
- **D-12 — Three layout exceptions:** Providers (encrypted key handling + connection testing), Import/Export (file-based upload/merge workflow, not a form), and Prompt Templates (rich editor with template preview + variable management) diverge from the standard form pattern. All remaining sections follow the common framework.

### Chat Conversation Lifecycle
- **D-13 — Sub-panel within Chat page:** Full App has a dedicated conversation sidebar within ChatPage (the global nav Sider remains for page navigation). Side Panel uses a drawer or popover to access conversation history, preserving limited space (~400px).
- **D-14 — Auto-create on first message:** A conversation is created when the user sends their first message if no active conversation exists. Title is generated asynchronously after the first response. A "New Chat" button is always available. Empty conversations are never created merely by opening Chat.
- **D-15 — Runtime-side async title generation:** After the first successful assistant response, the chat runtime fires a non-blocking Haiku-tier call (temperature 0, 16 tokens, 3s timeout). Title written to `ChatHistoryDB.sessions.title`. Conversation list updates in-place. On failure or timeout, falls back to truncated first user message. Must run in Side Panel or Full App runtime, NOT the Background Service Worker.
- **D-16 — Metadata list + active messages:** On Chat mount, fetch all conversation metadata (id, title, updatedAt, preview) for the sidebar list. Load full messages only for the active conversation. Switching conversations triggers on-demand message load. Aligns with ChatHistoryDB.sessions / ChatHistoryDB.messages separation.

### Agent ThoughtChain & Progress Model
- **D-17 — Full pipeline visibility with progressive disclosure:** ThoughtChain exposes each major AgentOrchestrator stage: context preparation, planning, tool execution (per tool), permission waits, retry/fallback events, rendering, completion, warnings, errors. High-level steps remain always visible; detailed execution info is expandable on demand. Matches the Agent page's purpose of visualizing the Planner→Executor→Renderer workflow.
- **D-18 — Tool calls as ThoughtChain nodes:** Each tool execution appears as its own ThoughtChain node showing: tool name, status icon (pending/success/error/denied), permission outcome badge, and execution duration. Expanding reveals sanitized input preview and result summary.
- **D-19 — Animated status with step name:** The ThoughtChain displays an active step ("Preparing Context", "Planning Actions", "Executing tool", "Waiting for Permission", "Generating Response") that updates in real-time as OrchestratorEvents arrive. Transitions to completed state when finished.
- **D-20 — Error Think items with inline recovery:** Failures appear directly in the ThoughtChain as error-state nodes showing failed stage, error summary, and relevant details. Recoverable failures (tool timeout, transient provider error, rate limit) expose an inline Retry action. Fatal failures (context limits, planner failure) provide actionable guidance.

### Notes: Wikilinks, Backlinks & Editor
- **D-21 — Minimal wikilink grammar:** Parse `[[title]]` and `[[title|alias]]` only. Resolution: exact title match → case-insensitive → prompt user to select from ambiguous matches → create-or-link if no match exists. Not automatically choosing the most recent — user confirms ambiguity.
- **D-22 — Split-pane editor:** Left: plain textarea for markdown editing with wikilink autocomplete. Right: `@ant-design/x-markdown` rendered preview with resolved wikilinks. Full App shows both panes simultaneously; Side Panel uses a preview toggle to conserve space.
- **D-23 — Right sidebar backlinks panel:** A collapsible right panel shows all notes referencing the current note. Each entry: note title + context snippet around the wikilink. Click navigates to that note. Index rebuilt from NotesDB on each save. Side Panel exposes backlinks through a drawer.
- **D-24 — Separate d3-force Graph view:** A dedicated "Graph" button/tab opens an interactive d3-force visualization when ≥3 notes exist. Notes as draggable nodes, wikilinks as edges. Zoom, pan, hover for titles, click nodes to navigate.
- **D-25 — Flat list with search:** Notes displayed as a searchable, sortable flat list (sort by Updated Date default, Created Date, Title). No folder hierarchy — wikilinks and backlinks provide structure.
- **D-26 — Context menu "Save to Note":** Each assistant message has a "Save to Note" action. Opens a lightweight dialog: create new note or append to existing, content pre-filled with selected message. Saves directly to NotesDB without navigating away from Chat.
- **D-27 — Internal versioning with Undo:** Auto version on every save. Expose only a simple Undo/Revert Last Change. Full version history browser deferred to future phase.
- **D-28 — Wikilink autocomplete dropdown:** Typing `[[` opens a note suggestion dropdown ranked by: exact prefix match → title-starts-with → title-contains → recently updated. Arrow keys navigate, Enter/Tab completes. "Create note" option for new titles. Uses MiniSearch for relevance.

### Search Architecture
- **D-29 — Entity-specific search:** Notes: MiniSearch full-text. Conversations: metadata filter (title/preview). Options: section-level search (already built). Cmd+K: commands and navigation. No cross-entity unified search in v0.1.
- **D-30 — Persistent search bar above note list:** Debounced ~150ms MiniSearch queries against titles and content. Results update in real-time with highlighted snippets. Matches the notes flat-list model.

- **D-32 — MiniSearch index lifecycle:** Full build on Notes page load, incremental updates on note create/edit/delete. Keeps search immediately consistent with NotesDB.

### Draft Persistence
- **D-33 — Per-conversation draft persistence:** Each conversation maintains its own unsent composer text. Debounced writes. Automatically restored when conversation is reopened. Survives navigation, conversation switching, page refresh, extension restart, and Side Panel ↔ Full App transitions. Cleared on successful send.
- **D-34 — Drafts in WorkspaceState:** Stored as `WorkspaceState.drafts[conversationId]` via existing chrome.storage.local mechanism. Treated as workspace/UI state, not chat history.

- **D-36 — Clear on send or explicit discard:** Draft persists until successfully sent or user explicitly clears it via a dedicated "Clear Draft" action with confirmation prompt. No auto-expiry.

### Cross-Surface Deep Linking
- **D-37 — Open Full App with page + context:** Deep links support: Chat (conversationId), Agent (conversationId), Notes (noteId), Options (section), Diagnostics (operationId). Routing handled centrally by WorkspaceRouter.
- **D-38 — URL query parameter transport:** Context passed as `app.html?page=chat&conversationId=abc`. Simple, inspectable, deterministic. Matches existing diagnostics deep-link pattern. No chrome.storage bridge.
- **D-39 — Focus existing tab + navigate:** When Full App tab already exists, focus it and navigate to the requested page/context. Only create a new tab when none exists. Aligns with WorkspaceRouter deduplication model.
- **D-40 — No special back indicator:** Surfaces operate independently. Existing "Open Side Panel" action in the sider header is the sufficient return path. No breadcrumb needed.

### the agent's Discretion
- `useStreamingLLM()` internal implementation — exact async generator iteration pattern, ChunkBuffer integration, AbortController wiring.
- `useChat()` / `useAgent()` state shapes — exact fields beyond `{ messages, send, abort, isStreaming, error }`.
- `PermissionStore` / `PermissionService` exact interface — researcher/planner to design consistent with existing ToolRegistry/PermissionService patterns.
- Options form component decomposition — planner to break into per-section components following existing `OptionsRoot` injection pattern via `renderSectionContent`.
- Individual Options section implementation details — form field specifics, validation rules, save behavior per section.
- Title generation prompt design — Haiku-tier prompt for first-message title extraction.
- d3-force graph configuration — force parameters, node sizing, edge styling, interaction details.
- MiniSearch index configuration for notes — field definitions, tokenization, boost factors.
- Wikilink autocomplete dropdown implementation — how MiniSearch results feed the dropdown ranking.
- Notes save debounce strategy for auto-versioning.
- Prompt Templates editor — variable tag parsing, preview rendering approach.
- Provider connection test endpoint — which AI SDK call to use for validation.
- Import/Export file format and merge strategy — JSON structure, conflict resolution rules.
- Cmd+K command palette — already exists in App.tsx shells; Phase 7 extends with page-specific commands.
- Error state patterns across pages — loading/empty/error states, planner to define consistent component patterns.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Scope
- `.planning/REQUIREMENTS.md` — CHAT-01 through CHAT-09, AGNT-01 through AGNT-08, NOTE-01 through NOTE-07, OPT-01 through OPT-11. Full traceability for all 35 Phase 7 requirements.
- `.planning/ROADMAP.md` — Phase 7 goal (lines 280–297), success criteria (8 items), dependency on Phases 5 and 6. Phase 7 is the convergence point where all infrastructure phases (2–6) meet the UI.

### Product Specification
- `.planning/PRODUCT_SPEC_v0_1.md` §1 (lines 1–304) — Full Chat & Agent specification:
  - §1.1: Chat flow architecture (Flow 1 — Planner→Executor→Renderer streaming)
  - §1.2: Agent flow (Flow 2 — tool calling, permission, ThoughtChain)
  - §1.3: Chat UI components — Bubble, Sender, Conversations, Bubble.List
  - §1.4: Agent UI components — ThoughtChain, Think, Sources, FileCard
  - §1.5: Slash commands — `/write`, `/ask`, `/research` presets
  - §1.6: Error states — Provider error, Retry, Switch Provider, Open Settings
- `.planning/PRODUCT_SPEC_v0_1.md` §5 (Notes specification) — Note CRUD, wikilinks, backlinks, graph visualization
- `.planning/PRODUCT_SPEC_v0_1.md` §6 (Options specification) — 11 sub-sections, form requirements per section
- `.planning/PRODUCT_SPEC_v0_1.md` §7 (Commands & Shortcuts) — Cmd+K palette, slash commands
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix J — ChunkBuffer streaming buffer specification
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix I — Agent ThoughtChain rendering patterns
- `.planning/PRODUCT_SPEC_v0_1.md` Phase 7 layout (lines 2201–2247) — File layout, test requirements, DONE criteria

### Project Context
- `.planning/PROJECT.md` — Core constraints: MV3 restrictions, `@ai-sdk/*` only, Ant Design v6 + Ant Design X 2.x sole design system, `@ant-design/x-markdown` for markdown, `@ant-design/x-sdk` and `@ant-design/x-card` NOT adopted, two-surface architecture (Side Panel + Full App Tab), no Tailwind/shadcn/Radix.
- `.planning/STATE.md` — Session continuity, Phases 1–6 complete, current position at Phase 7.

### Prior Phase Decisions (Critical Dependencies)
- `.planning/phases/03-cost-effective-ai-runtime/03-CONTEXT.md` — AgentOrchestrator pipeline: `runWithContext()` canonical API, Planner→Executor→Renderer loop, ProviderRouter retry/fallback, AbortManager. The hook MUST integrate with this API — no alternative entry point.
- `.planning/phases/04-context-adaptive-execution/04-CONTEXT.md` — ContextOptimizer: `optimize()` signature, `ContextOptimizerInput` fields (memory, preferences, toolSchemas), `OptimizedContext` shape, `ContextProvenanceManifest`. Hook calls this before pipeline invocation.
- `.planning/phases/05-persistent-memory-architecture/05-CONTEXT.md` — MemoryEngine: `assemble()` pre-optimization, `extract()` post-execution (fire-and-forget), single-writer via BroadcastBus. Memory injection feeds into ContextOptimizerInput.
- `.planning/phases/06-transaction-logging-and-diagnostics/06-CONTEXT.md` — AITransactionLog wraps every pipeline call, DiagnosticsPanel already built in Options→Diagnostics, operationId deep-linking pattern. Phase 7 hooks must emit through ExecutionContext.

### Shell & Navigation (Phase 1)
- `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-CONTEXT.md` — WorkspaceStore chrome.storage.local persistence, BroadcastBus cross-surface sync, `np_` key prefix convention, zustand v5 patterns.

### Existing Code Dependencies
- `src/core/ai/pipeline/AgentOrchestrator.ts` — `runWithContext(optimizedContext, preferredProviders): AsyncGenerator<OrchestratorEvent>`. Hook integration target. OrchestratorEvent types: planner-start/complete, tool-call/result, renderer-chunk/complete, error, degradation-*, minimal-mode, context-error.
- `src/core/ai/pipeline/pipelineTypes.ts` — `OrchestratorEvent` union type, `ToolExecutionResult` shape. Hook consumes these events.
- `src/core/context/ContextOptimizer.ts` — `optimize(input): Promise<OptimizedContext>`. Hook calls this.
- `src/core/context/contextTypes.ts` — `ContextOptimizerInput`, `OptimizedContext`, `PromptSection` types.
- `src/core/memory/MemoryEngine.ts` — `assemble()` and `extract()`. Hook calls assemble() before optimization.
- `src/core/storage/stores/ChatHistoryDB.ts` — `sessions`, `messages` stores. `getConversations`, `getMessages`, `addMessage`, `updateSession`.
- `src/core/storage/stores/NotesDB.ts` — `notes` store. Note CRUD operations.
- `src/core/storage/stores/MemoryDB.ts` — Memory facts for retrieval during context assembly.
- `src/core/stores/workspaceStore.ts` — `WorkspaceState` with `activeProvider`, `activeSurface`, `drafts` (new field).
- `src/core/stores/providerStore.ts` — Provider/model configuration for provider selector UI.
- `src/core/stores/themeStore.ts` — Theme mode for ConfigProvider.
- `src/core/telemetry/AITransactionLog.ts` — `aiTransactionLog` singleton, `start/complete/fail`. Hook integration.
- `src/core/telemetry/types.ts` — `ExecutionContext`, `TraceCollector` types.
- `src/core/navigation/navConfig.ts` — Navigation items (chat, agent, write, notes, tools, tasks). Page stubs exist.
- `src/core/navigation/navigationTypes.ts` — `NowPilotNavItem`, `Surface` types.
- `src/core/registries/registerNowPilotCorePages.ts` — Page registry wiring for sidepanel + standalone.
- `src/core/routing/workspaceRouter.ts` — `openStandalone()` function for cross-surface navigation.
- `src/components/standalone/StandaloneRoot.tsx` — Full App shell with ConfigProvider, StandaloneSider, renderActivePage prop.
- `src/components/sidepanel/SidepanelRoot.tsx` — Side Panel shell with ConfigProvider, responsive density, renderActivePage prop.
- `src/components/options/OptionsRoot.tsx` — Options shell with 12 sections, search, renderSectionContent injection. `'diagnostics'` section already populated.
- `src/core/pages/ChatPage.tsx` — Empty stub. Phase 7 replaces with functional page.
- `src/core/pages/AgentPage.tsx` — Empty stub. Phase 7 replaces with functional page.
- `src/core/pages/NotesPage.tsx` — Empty stub. Phase 7 replaces with functional page.
- `src/core/pages/OptionsPage.tsx` — Empty stub. Phase 7 replaces with functional page.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **AgentOrchestrator** (`src/core/ai/pipeline/AgentOrchestrator.ts`): `runWithContext()` returns `AsyncGenerator<OrchestratorEvent>`. The hook's streaming loop iterates this. Already handles AbortManager, trace collection, memory extraction. Hook only needs to consume events and update UI state.
- **ChunkBuffer** (`src/core/ai/streaming/ChunkBuffer.ts`): rAF-batched streaming buffer. `useStreamingLLM()` feeds renderer-chunks through this.
- **ContextOptimizer** (`src/core/context/ContextOptimizer.ts`): Singleton, `optimize()` returns `OptimizedContext`. Hook calls this with assembled `ContextOptimizerInput`.
- **MemoryEngine** (`src/core/memory/MemoryEngine.ts`): Singleton, `assemble()` returns `{ memory, conversationContext, preferences }` for `ContextOptimizerInput`. `extract()` is fire-and-forget — already handled by AgentOrchestrator after runWithContext().
- **ChatHistoryDB** (`src/core/storage/stores/ChatHistoryDB.ts`): Already has `getConversations`, `getMessages`, `addMessage`, `updateSession`. Phase 7 hook reads/writes through these.
- **NotesDB** (`src/core/storage/stores/NotesDB.ts`): Existing note CRUD. Phase 7 adds wikilink indexing, backlink computation, and version tracking on top.
- **Shell components** — StandaloneRoot, SidepanelRoot, StandaloneContent, SidepanelContent, SiderMenu, OptionsRoot: All render page content via `renderActivePage` prop. ChatPage, AgentPage, NotesPage, OptionsPage just need to be implemented as React components and registered.
- **Page registry** — `registerNowPilotCorePages.ts` already wires chat/agent/write/notes to sidepanel/standalone. Phase 7 replaces stubs with real components.
- **OptionsRoot** — `renderSectionContent(sectionId)` injection pattern already used for Diagnostics. Same pattern for Providers, Models, MCP, etc.
- **WorkspaceStatusBar** (`src/components/common/WorkspaceStatusBar.tsx`): Provider/model indicator already in shells. Phase 7 Chat/Agent hook updates the active provider shown here.
- **WorkspaceRouter** (`src/core/routing/workspaceRouter.ts`): `openStandalone()` with query params. Phase 7 extends for deep-linking.

### Established Patterns
- **Class + singleton export**: All services follow this (AgentOrchestrator, ContextOptimizer, MemoryEngine, etc.). Phase 7's PermissionStore and any new services match.
- **Constructor dependency injection**: Used throughout core layer. Hooks get singletons from module imports.
- **renderActivePage prop pattern**: Both StandaloneRoot and SidepanelRoot accept a `renderActivePage` callback that receives the active nav item and returns a React node. New pages plug in here.
- **renderSectionContent prop pattern**: OptionsRoot accepts `renderSectionContent(sectionId)` for injecting section-specific content. New Options sections follow this.
- **Direct path imports**: No barrel/index files. New hooks in `src/hooks/`, new pages in `src/core/pages/`, new options sections in `src/components/options/`.
- **Zustand v5 stores**: `create() + persist()` with `createJSONStorage`. ThemeStore, WorkspaceStore, ProviderStore follow this. New drafts in WorkspaceStore.
- **`np_` key prefix**: chrome.storage keys. New keys: `np_mcp_permissions`.
- **Ant Design v6 + X 2.x**: ConfigProvider at shell level with compactAlgorithm (Side Panel) / defaultAlgorithm (Full App). XProvider wrapping pages using @ant-design/x components. `theme.useToken()` for token access.
- **Test patterns**: Vitest + jsdom, tests in `tests/hooks/`, `tests/components/`. `vi.hoisted()` for mock variables. React Testing Library for component tests.

### Integration Points
- **StandaloneRoot.renderActivePage** — ChatPage, AgentPage, NotesPage components plug in here for Full App.
- **SidepanelRoot.renderActivePage** — ChatPage, AgentPage components plug in here for Side Panel (Notes excluded per surface restriction).
- **OptionsRoot.renderSectionContent** — All 11 Options section components plug in here.
- **AgentOrchestrator.runWithContext()** — The hook's primary integration point. Hook provides OptimizedContext from ContextOptimizer.
- **ContextOptimizer.optimize()** — Hook assembles ContextOptimizerInput before calling this. Memory, workspace context, tool schemas, conversation history, user message.
- **MemoryEngine.assemble()** — Hook calls this during pre-optimization to populate ContextOptimizerInput.memory and .preferences.
- **ChatHistoryDB** — Hook reads conversations and messages, writes new messages, updates titles.
- **WorkspaceStore** — Hook reads activeProvider, writes drafts. Provider selector reads providerStore.
- **BroadcastBus** — Cross-surface sync for workspace updates, memory writes routed to primary surface.
- **AITransactionLog** — AgentOrchestrator already wraps pipeline with start/complete/fail. Hook doesn't need to call directly.
</code_context>

<specifics>
## Specific Ideas

### Hook Hierarchy (conceptual)
```
useStreamingLLM({ orchestrator, contextOptimizer, memoryEngine })
  └─ owns: AsyncGenerator iteration, ChunkBuffer, AbortController, error boundary
  └─ returns: stream state primitives

useChat()
  └─ uses: useStreamingLLM()
  └─ owns: messages[], conversationId, title generation, draft persistence
  └─ returns: { messages, send, abort, conversations, activeConversation, ... }

useAgent()
  └─ uses: useStreamingLLM()
  └─ owns: thoughtChain steps[], tool permissions, permission modal state
  └─ returns: { steps, send, abort, conversations, activeConversation, pendingPermission, ... }
```

### Agent Permission Flow (conceptual)
```
AgentOrchestrator yields { type: 'tool-call', toolName, ... }
  → ExecutorService needs permission → yield { type: 'waiting-permission', toolName }
  → useAgent detects waiting-permission event
  → ThoughtChain shows "waiting for permission" step
  → Modal.confirm opens with Allow Once / Allow Always / Deny
  → User selects → hook calls permissionService.canExecute() → result
  → Hook signals orchestrator to continue → stream resumes
```

### Chat Page Layout (conceptual)
```
Side Panel (~400px):
┌──────────────────────────────────┐
│ [Provider: Anthropic ▼]          │
├──────────────────────────────────┤
│ Bubble.List (streaming messages) │
│ ┌──────────────────────────────┐ │
│ │ User: Hello                  │ │
│ │ Assistant: Hi! How can I...  │ │ <- streaming via ChunkBuffer
│ └──────────────────────────────┘ │
├──────────────────────────────────┤
│ Sender (composer) + slash hints  │
└──────────────────────────────────┘
   [Conversations drawer ▸]

Full App:
┌────┬────────────────────────────┬─────┐
│ Nav│ Conversations  │ Messages  │     │
│Sider│ ┌────────────┐│ ┌────────┐│     │
│    │ │ Conv 1     ││ │Bubbles ││     │
│    │ │ Conv 2 ✓   ││ │        ││     │
│    │ │ Conv 3     ││ │        ││     │
│    │ │ + New Chat ││ └────────┘│     │
│    │ └────────────┘│ Sender    │     │
└────┴────────────────────────────┴─────┘
```

### Notes Page Layout (conceptual, Full App only)
```
┌────┬──────────┬──────────────────────┬──────────┐
│ Nav│ Note List│ Editor               │ Backlinks│
│Sid │ ┌──────┐ │ ┌──────────────────┐ │ ┌──────┐ │
│er  │ │Search│ │ │ Markdown textarea│ │ │Note X│ │
│    │ └──────┘ │ │                  │ │ │Note Y│ │
│    │ Note 1   │ │                  │ │ └──────┘ │
│    │ Note 2 ✓ │ ├──────────────────┤ │          │
│    │ Note 3   │ │ Rendered preview │ │ [Graph ▸│
│    │ + New    │ │ [[wikilinks]]    │ │          │
│    └──────────┘ └──────────────────┘ └──────────┘
└────┴─────────────────────────────────────────────┘
```

### File Layout (from PRODUCT_SPEC + discussion)
- `src/hooks/useStreamingLLM.ts` — Shared AsyncGenerator iteration + ChunkBuffer + AbortController
- `src/hooks/useChat.ts` — Chat hook: messages, conversations, title generation, drafts
- `src/hooks/useAgent.ts` — Agent hook: thoughtChain steps, permission handling
- `src/hooks/useWorkspace.ts` — Workspace state access helper
- `src/hooks/useTheme.ts` — Theme access helper
- `src/core/pages/ChatPage.tsx` — Full Chat page component (reuses Chat UI across both surfaces)
- `src/core/pages/AgentPage.tsx` — Full Agent page component
- `src/core/pages/NotesPage.tsx` — Full Notes page (Full App only)
- `src/core/pages/OptionsPage.tsx` — Options page wrapper for Full App
- `src/core/prompts/PromptManager.ts` — Prompt template CRUD
- `src/core/prompts/TemplateEngine.ts` — Template variable interpolation
- `src/core/prompts/builtinTemplates.ts` — Built-in prompt templates
- `src/core/slash/SlashCommandRegistry.ts` — Slash command registration and dispatch
- `src/core/notes/LinkParser.ts` — Wikilink parsing and resolution
- `src/core/notes/NoteGraph.ts` — d3-force graph data model and layout
- `src/core/permissions/PermissionStore.ts` — Persistent tool permissions (np_mcp_permissions)
- `src/components/options/ProvidersSection.tsx`
- `src/components/options/ModelsSection.tsx`
- `src/components/options/MCPSection.tsx`
- `src/components/options/PromptsSection.tsx`
- `src/components/options/SlashSection.tsx`
- `src/components/options/MemorySection.tsx`
- `src/components/options/ImportExportSection.tsx`
- `src/components/options/FeatureFlagsSection.tsx`
- `src/components/options/AddonSettingsSection.tsx`
- `src/components/options/AppearanceSection.tsx` (or reuse existing theme)
- `src/components/options/AboutSection.tsx`
- `src/components/notes/BacklinksPanel.tsx`
- `src/components/notes/WikilinkAutocomplete.tsx`
- `src/components/notes/NoteGraphView.tsx`
- `src/components/patterns/ChatMessage.tsx` — Chat Bubble wrapper with @ant-design/x-markdown
- `src/components/patterns/HistoryListItem.tsx` — Conversation list item
- `src/components/patterns/ToolCard.tsx` — Tool call ThoughtChain node
- `src/components/patterns/SkillMessageRenderer.tsx` — Skill/macro output renderer
- `src/components/patterns/SourceCard.tsx` — Source reference card
- `tests/hooks/useStreamingLLM.test.ts`
- `tests/hooks/useChat.test.ts`
- `tests/hooks/useAgent.test.ts`
- `tests/hooks/useWorkspace.test.ts`
- `tests/components/ChatPage.test.tsx`
- `tests/components/OptionsPage.test.tsx`
- `tests/components/patterns/ChatMessage.test.tsx`
- `tests/core/notes/LinkParser.test.ts`
</specifics>

<deferred>
## Deferred Ideas

- **Full version history browser for Notes** — diff view, restore, timeline. Deferred to future phase. Phase 7 implements Undo/Revert only.
- **Full-text conversation search across message bodies** — deferred to future phase. v0.1 uses title/metadata filtering.
- **Cross-entity unified global search** — deferred to future phase. Phase 7 has entity-specific search.
- **Batch tool permission approval** — multi-tool plans with one-click approve-all. Deferred. v0.1 uses one-by-one.
- **Folder hierarchy for Notes** — deferred. v0.1 uses flat list with wikilinks for structure.
- **Folder-based draft organization** — no folders exist in v0.1; per-conversation drafts suffice.
- **Real-time backlink updates across surfaces** — deferred. Backlinks rebuilt on save.
- **Undo for chat messages** — deferred. Phase 7 has draft persistence; message editing is a future feature.
- **Export/import for individual Options sections** — deferred to Phase 8 (Data Portability).
- **Memory editing UI in Options** — deferred. Phase 5 provides the engine; Phase 7 shows current facts read-only.

None beyond scope — all discussion stayed within phase boundaries.
</deferred>

---

*Phase: 7-Full Chat, Agent, Notes, Options Pages*
*Context gathered: 2026-07-13*
