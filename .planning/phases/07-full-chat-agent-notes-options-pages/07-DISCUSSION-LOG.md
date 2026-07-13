# Phase 7: Full Chat, Agent, Notes, Options Pages - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 07-full-chat-agent-notes-options-pages
**Areas discussed:** Chat/Agent Hook Architecture, Agent Permission Dialog UX, Options Form Patterns, Chat Conversation Lifecycle, Agent ThoughtChain & Progress Model, Notes Wikilink Resolution & Backlinks, Search Architecture, Draft Persistence, Cross-Surface Deep Linking

---

## Chat/Agent Hook Architecture

### Q1: Hook streaming ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Hook owns the loop | useChat calls runWithContext() directly, iterates AsyncGenerator, manages all streaming state | ✓ |
| Separate streaming service | ChatService owns loop, emits events, hook subscribes | |
| You decide | Agent picks | |

### Q2: Hook split

| Option | Description | Selected |
|--------|-------------|----------|
| Single useChat | One hook with mode param for Chat/Agent | |
| Separate hooks | useChat() and useAgent() built on shared useStreamingLLM() foundation | ✓ |
| You decide | Agent decides | |

**User's choice:** Separate useChat() and useAgent() hooks built on a shared useStreamingLLM() foundation. Chat and Agent have different state models and will evolve independently, while all AsyncGenerator/ChunkBuffer/orchestrator streaming logic remains centralized in useStreamingLLM(). This avoids a growing mode-based hook while still keeping the implementation DRY.

### Q3: Streaming chunk delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Mutable messages array | { messages, send, abort, ... }, last message updates in-place per chunk | ✓ |
| Event callback pattern | onChunk/onComplete/onError callbacks | |

**User's choice:** Mutable messages array with React state updates. Aligns with @ant-design/x Bubble.List and ChunkBuffer architecture.

### Q4: ContextOptimizer placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inside the hook | useChat() internally calls contextOptimizer.optimize() | ✓ |
| Page calls before hook | Page assembles and passes OptimizedContext | |

**User's choice:** Inside the hook. Pages should simply call send(message) and remain presentation-focused.

---

## Agent Permission Dialog UX

### Q1: Dialog presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Modal overlay | AntD Modal over agent page | |
| Inline in ThoughtChain | Permission as inline step | |
| Hybrid Modal + ThoughtChain | Waiting step in chain + Modal.confirm for decision | ✓ |

**User's choice:** Hybrid. Display permission request as waiting-for-permission step inside ThoughtChain while simultaneously opening AntD Modal.confirm for the security decision.

### Q2: Allow always persistence scope

| Option | Description | Selected |
|--------|-------------|----------|
| Session-scoped | Resets on extension reload | |
| Persistent | Survives browser restarts in np_mcp_permissions | ✓ |

**User's choice:** Persistent tool-level permission. Allow Always stored in np_mcp_permissions, survives restarts, applies to that specific tool only.

### Q3: Multi-tool batch approval

| Option | Description | Selected |
|--------|-------------|----------|
| One-by-one | Each tool evaluated independently | ✓ |
| Batch preview | All tools upfront with per-tool toggles | |

**User's choice:** One-by-one. Matches existing orchestration architecture, keeps UI simple for v0.1.

### Q4: Allow list storage

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory Map | Session-scoped, no persistence | |
| Dedicated PermissionStore | chrome.storage.local np_mcp_permissions | ✓ |

**User's choice:** Dedicated PermissionStore backed by chrome.storage.local.np_mcp_permissions. Not a UI-focused Zustand store.

---

## Options Form Patterns (11 Sections)

### Q1: Form consistency

| Option | Description | Selected |
|--------|-------------|----------|
| Standardized AntD Form | Common layout, left-aligned, ~720px, Form.List for collections | ✓ |
| Per-section custom | Each section gets own layout | |

**User's choice:** Standardized AntD Form pattern. All sections share common layout based on AntD Form, left-aligned labels, single-column content. Collection sections use Form.List or table/list patterns.

### Q2: Test Connection UX

| Option | Description | Selected |
|--------|-------------|----------|
| Button with inline status | Loading state + inline result, expandable diagnostics | ✓ |
| Separate modal | Opens modal for results | |

**User's choice:** Inline validation with expandable diagnostics. On failure, expand additional diagnostics (error code, endpoint, response summary, copy details).

### Q3: Delete pattern

| Option | Description | Selected |
|--------|-------------|----------|
| AntD Popconfirm | "Are you sure?" confirmation before delete | ✓ |
| Immediate delete with undo toast | Delete + undo notification | |

**User's choice:** AntD Popconfirm on all destructive deletes. Consistent across all collection sections. No undo workflow.

### Q4: Section complexity exceptions

| Option | Description | Selected |
|--------|-------------|----------|
| Providers + Import/Export only | Two complex sections need special treatment | |
| Standard pattern with 3 exceptions | Providers, Import/Export, and Prompt Templates | ✓ |
| All sections same pattern | No exceptions | |

**User's choice:** Standard pattern with 3 exceptions. Providers (connection testing + encrypted keys), Import/Export (file-based workflow), Prompt Templates (preview + variables).

---

## Chat Conversation Lifecycle

### Q1: Conversation list display

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-panel within Chat page | Chat page has its own left panel, nav sider unchanged | ✓ |
| Replace sider nav | Sider shows conversations when Chat active | |

**User's choice:** Sub-panel within Chat Page. Full App retains global nav Sider and adds dedicated conversation sidebar within ChatPage. Side Panel uses drawer/popover.

### Q2: New conversation trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-create on first message | First send creates conversation, New Chat available | ✓ |
| Explicit only | Must click New Chat first | |

**User's choice:** Auto-create on first message. Title generated asynchronously after first response. Empty conversations never created by opening Chat.

### Q3: Title generation location

| Option | Description | Selected |
|--------|-------------|----------|
| Inside useChat hook | Non-blocking Haiku call, writes to ChatHistoryDB | ✓ |
| Background service worker | MV3 constraints violate this | |

**User's choice:** Runtime-side async title generation. Non-blocking Haiku-tier call, temperature 0, 16 tokens, 3s timeout. Runs in Side Panel or Full App runtime.

### Q4: History loading strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata list + active messages | Fetch all metadata, load active messages on-demand | ✓ |
| Fetch all upfront | Load everything on mount | |

**User's choice:** Metadata list + active messages. Scales to large histories, keeps initial load fast.

---

## Agent ThoughtChain & Progress Model

### Q1: Pipeline visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Full pipeline visibility | All stages visible, progressive disclosure | ✓ |
| Summary-level only | Collapse details behind expandables | |

**User's choice:** Full pipeline visibility with progressive disclosure. Each major stage exposed. High-level steps always visible, details expandable on demand.

### Q2: Tool call display

| Option | Description | Selected |
|--------|-------------|----------|
| Name + status + expandable | Tool name, status, permission, duration, expandable details | ✓ |
| Simple status line | Just name + status | |

**User's choice:** Tool name + status + expandable details. Each execution as its own ThoughtChain node.

### Q3: Progress indication

| Option | Description | Selected |
|--------|-------------|----------|
| Animated status with step name | Real-time step updates (Planning, Executing, etc.) | ✓ |
| Simple spinner only | Just spinning indicator | |

**User's choice:** Animated status with step name. Updates in real-time as OrchestratorEvents arrive.

### Q4: Error display

| Option | Description | Selected |
|--------|-------------|----------|
| Error Think item with retry | Inline error with retry for recoverable, guidance for fatal | ✓ |
| Separate error banner | Toast above ThoughtChain | |

**User's choice:** Error Think item with inline recovery. Retry for recoverable failures, actionable guidance for fatal failures.

---

## Notes: Wikilinks, Backlinks & Editor

### Q1: Wikilink syntax and resolution

| Option | Description | Selected |
|--------|-------------|----------|
| [[title]] + [[title|alias]] | Exact → case-insensitive → prompt → create-or-link | ✓ |
| Full wikilink spec | Headings, block refs, etc. | |

**User's choice:** Minimal wikilink grammar. Phase 7 supports only [[title]] and [[title|alias]]. Exact title match wins, case-insensitive, prompt user for ambiguous, create-or-link for new.

### Q2: Editor experience

| Option | Description | Selected |
|--------|-------------|----------|
| Split-pane + markdown preview | Textarea left, @ant-design/x-markdown preview right | ✓ |
| Single-pane textarea only | No live preview | |

**User's choice:** Split-pane textarea + live preview. Full App shows both panes; Side Panel uses preview toggle.

### Q3: Backlinks panel

| Option | Description | Selected |
|--------|-------------|----------|
| Right sidebar panel | Collapsible right panel, title + snippet, click to navigate | ✓ |
| Bottom section | Below editor | |

**User's choice:** Right Sidebar Backlinks Panel. Side Panel uses drawer instead. Index rebuilt on save.

### Q4: Graph visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Separate Graph tab | Dedicated button opens full-view d3-force graph | ✓ |
| Permanent mini-graph | Small graph always visible | |

**User's choice:** Separate Graph View. d3-force nodes draggable, zoom/pan, click to navigate. ≥3 notes.

### Q5: Notes list organization

| Option | Description | Selected |
|--------|-------------|----------|
| Flat list with search | Sortable flat list, no folders | ✓ |
| Folder + flat list | Folder hierarchy | |

### Q6: Quick save from chat

| Option | Description | Selected |
|--------|-------------|----------|
| Context menu on messages | "Save to Note" per message, create new or append | ✓ |
| Global quick-save | Save entire conversation | |

### Q7: Version tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Internal only with undo | Auto version, undo only exposed | ✓ |
| Full history panel | Diff, restore, timeline | |

### Q8: Wikilink autocomplete

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown on [[ | Ranked by prefix, start, contains, recent | ✓ |
| Manual only | No autocomplete | |

---

## Search Architecture

### Q1: Search scope

| Option | Description | Selected |
|--------|-------------|----------|
| Entity-specific | Notes: MiniSearch, Conversations: metadata, Options: section, Cmd+K: commands | ✓ |
| Unified global search | Cross-entity index | |

### Q2: Notes search UX

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent bar above list | Debounced 150ms, real-time snippets | ✓ |
| Cmd+K modal | Command palette | |

### Q3: Conversation search

| Option | Description | Selected |
|--------|-------------|----------|
| Title filter only | Metadata filtering, no full-text | ✓ |
| Full-text message search | All message bodies | |

### Q4: MiniSearch index lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| On load + incremental | Full build on load, update on save | ✓ |
| On load only | Build once per mount | |

---

## Draft Persistence

### Q1: Draft scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-conversation | Each conversation has own draft, restored on reopen | ✓ |
| No persistence | Lost on navigation | |

### Q2: Draft storage

| Option | Description | Selected |
|--------|-------------|----------|
| WorkspaceStore + chrome.storage.local | WorkspaceState.drafts[conversationId] | ✓ |
| ChatHistoryDB IndexedDB | Separate drafts store | |

### Q3: What gets draft persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Chat/Agent only | Notes has auto-save + undo | ✓ |
| Chat + Notes | Both | |

### Q4: Draft clearing

| Option | Description | Selected |
|--------|-------------|----------|
| On send + explicit clear | Persists until sent or explicitly discarded | ✓ |
| On send only | No manual clear | |

---

## Cross-Surface Deep Linking

### Q1: Deep-link scenarios

| Option | Description | Selected |
|--------|-------------|----------|
| Page + context | Chat(conversationId), Agent(conversationId), Notes(noteId), Options(section), Diagnostics(operationId) | ✓ |
| Simple open only | No context | |

### Q2: Transport mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| URL query params | app.html?page=chat&conversationId=X | ✓ |
| chrome.storage bridge | Write-read cycle | |

### Q3: Tab deduplication

| Option | Description | Selected |
|--------|-------------|----------|
| Focus existing + navigate | Focus and navigate existing tab | ✓ |
| Always new tab | Create duplicate | |

### Q4: Back navigation

| Option | Description | Selected |
|--------|-------------|----------|
| No special indicator | Surfaces independent, existing Open Side Panel suffices | ✓ |
| Contextual breadcrumb | "← Back to Side Panel" | |

---

## the agent's Discretion

Areas where the user deferred to the agent:
- `useStreamingLLM()` internal implementation details
- Exact state shapes for useChat / useAgent beyond the agreed return signatures
- PermissionStore / PermissionService exact interface design
- Options form component decomposition into per-section components
- Individual Options section field specifics, validation, save behavior
- Title generation prompt design (Haiku-tier)
- d3-force graph force parameters, node/edge styling
- MiniSearch index configuration (field defs, tokenization, boosts)
- Wikilink autocomplete dropdown implementation using MiniSearch
- Notes save debounce strategy for auto-versioning
- Prompt Templates editor: variable parsing, preview rendering
- Provider connection test: which AI SDK call to use
- Import/Export file format and merge strategy details
- Error state patterns across pages (loading/empty/error)
- Cmd+K page-specific command extensions

## Deferred Ideas

- Full version history browser for Notes (diff, restore, timeline) → future phase
- Full-text conversation search across message bodies → future phase
- Cross-entity unified global search → future phase
- Batch tool permission approval (multi-tool plans) → future phase
- Folder hierarchy for Notes → future phase
- Folder-based draft organization → future phase
- Real-time backlink updates across surfaces → future phase
- Undo for chat messages → future phase
- Export/import for individual Options sections → Phase 8
- Memory editing UI in Options → future phase
