# Architecture Research — NowPilot v0.1

> Synthesized from `.planning/PRODUCT_SPEC_v0_1.md` §1 (Cost-Effective Runtime AI Architecture), §6.3, §8 (Architecture Design), §2 (Context), §3 (Memory), §13 (Storage), §28–§30. The spec is canonical.

## Runtime Design Principle (§1.1)

The active runtime model may be cheap, fast, weak at reasoning, small-context, local, or the user's only provider. **The system must not rely on the model to remember, decide tool safety, or preserve state.**

## Orchestration: Planner → Executor → Renderer (§1.2)

```
User → AITransactionLog.start → WorkspaceStore.load → MemoryEngine
  → ContextOptimizer → AgentOrchestrator → PlannerService
  → PlannerDecision {answer | clarification | run_tool}
    → answer/clarify → RendererService → ChunkBuffer + React UI
    → run_tool → ExecutorService → ToolExecutionResult → Orchestrator
  → MemoryEngine.update → WorkspaceStore.persist → AITransactionLog.complete
```

- **PlannerService**: returns exactly one Zod-validated `PlannerDecision`. Planner *requests*; it never executes tools (R-4).
- **ExecutorService**: validates + runs tools (never the LLM directly).
- **RendererService**: ≤ 512 tokens; streams to ChunkBuffer + React.
- **Bounded loop** between Planner and Executor, governed by §1.4 tier caps — never free-running maxSteps loops.
- **Coordinator-based agent platform**: the Planner→Executor→Renderer loop is the engine for a *single role*. A `CollaborationCoordinator` runs a `CollaborationPlan`; **default = one-role plan** (= the single-agent path). Multi-role is opt-in for selected workflows (§30). One runtime, one tool-governance, one memory, one evaluation, one security model.

## Extension Contexts (§8.1)

```
Chrome Browser
├── Background SW (background.ts) [ephemeral]
│   ├── BackgroundRouter, LifecycleManager, KeepAliveManager,
│   ├── ContextMenuHost, CookieSessionStore, CORSProxy (PROXY_FETCH),
│   └── WorkspaceRouter (opens standalone, dedupes tabs)
├── Side Panel (sidepanel/main.tsx) [persistent while open]
│   ├── AntD ConfigProvider (compact) + AntdApp
│   ├── Shell/Router, ProviderRegistry/Router/TierResolver
│   ├── AgentOrchestrator + Planner/Executor/Renderer + PersonaInjector
│   ├── MCPClient + MCPRegistry + NowPilotMainServer (12 tools)
│   ├── ContextOptimizer + ContextCompressor
│   ├── MemoryEngine + Conversation/User/PreferenceMemoryStore
│   ├── AITransactionLog + DB + TraceRedactor
│   ├── StorageLayer (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, WriteJournal)
│   ├── WorkspaceStore (Zustand) + WorkspaceSync (BroadcastBus)
│   ├── MessageBus / EventBus / BroadcastBus
│   └── UI: Chat / Agent / Write / TeamGQM / Open Standalone + RICH
├── Standalone view (app/main.tsx) [persistent tab]
│   ├── AntD ConfigProvider (default density) + AntdApp
│   ├── Shell + Router (AntD Layout w/ Sider)
│   ├── Same core services as Side Panel (single-writer via WorkspaceStore)
│   ├── LLM-Wiki services (NoteTagger/NoteQA/NoteChatConverter/NoteFileSync/NoteMaintenance)
│   └── UI: Chat / Agent / Notes / TeamGQM / Options
├── Content Scripts (extraction-only)
│   ├── ContentScriptHost (bridge only, no UI mount), SPANavigationWatcher,
│   ├── PageContextBridge; ISOLATED world by default; MAIN world only for domain globals
└── Add-ons (site-specific | global)
```

**Hard rule (R-3):** AI calls + IndexedDB live in Side Panel/Standalone only. Background SW does PROXY_FETCH / alarms / context menus.

## Core vs Add-on Boundary (§8.2)

Core services in `src/core/`, `src/services/`; add-ons in `src/addons/<id>/`. Add-ons must not import core components/pages or other add-ons; standalone pages at `src/addons/<id>/pages/Standalone*.tsx`, side-panel at `SidePanel*.tsx`.

## Context & Memory

- **ContextOptimizer (§2.3)** produces `OptimizedContext`; every AI call consumes it through PersonaInjector — **no React component assembles prompts directly** (golden rule 3).
- **MemoryEngine (§3)**: ConversationMemoryStore + UserMemoryStore + PreferenceMemoryStore. Memory injection ≤ 1000 tokens / top-5 (top-3 tiny); working memory ≤ 300 tokens. Budgets degrade per §2.4 — never silently truncate mid-structure (golden rule 6).
- **Storage (§13)**: IndexedDB via idb; ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, WriteJournal (CRDT-based write log with WriteTransaction + WriteJournalService for crash-safe writes).

## Security Model

- **TraceRedactor (§4.4)** on every sensitive flow before persist/UI/export (R-10) — no raw prompt/tool bodies or secrets logged.
- **Content scripts extraction-only** — no host-page UI, no write-back (R-5; RICH-H-04/07 clipboard-only).
- **Trust-aware context (§28.3)**: page/note/memory/tool output is `trust: 'retrieved'|'untrusted'` with `instructionAuthority: false` (R-7/golden rule 7). Content classification, XSS screening, prompt-injection quarantine.
- **Agent evidence (§28.2)**: side-effecting tool "done" only with matching `CompletionEvidence` (probe + path); cap exhaustion = `partial`, never `completed` (golden rule 8).
- **Encrypted vault** (AES-GCM via crypto.subtle) for secrets/storage.

## Verified Evolution & Collaboration

- **Verified evolution (§28.7)**: `CandidateProposer` only *proposes*; activation is human-gated — never autonomous self-modification (R-6).
- **Collaboration (§29–§30)**: coordinator-based; collaboration manifest + coordination modes; single-agent default = one-role CollaborationPlan.

## Key Architecture Constraints

- No AI/IndexedDB in background SW.
- No LLM tool execution (Planner requests, Executor validates+runs).
- No host-page UI in v0.1.
- No autonomous activation of evolution candidates.
- No direct prompt assembly outside the pipeline.
- No nested retries (three layers max, tier-cap bounded).
