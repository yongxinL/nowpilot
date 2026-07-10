# Architecture Research

**Domain:** Chrome MV3 Extension AI Assistant (dual-surface: Side Panel + Full App Tab)
**Researched:** 2026-07-10
**Confidence:** HIGH

## System Overview

NowPilot is a Chrome MV3 extension with **four execution contexts** and a strict layering model. AI runtime lives in the long-lived UI surfaces (Side Panel, Full App Tab), never in the ephemeral service worker. Content scripts are extraction-only in v0.1. Add-ons plug into both UI surfaces through registries.

```
Chrome Browser
├── Background Service Worker (background.ts)            [EPHEMERAL — ≤30 s lifetime]
│   ├── BackgroundRouter          typed chrome.runtime.onMessage dispatcher
│   ├── LifecycleManager          onInstalled, onStartup, setPanelBehavior
│   ├── KeepAliveManager          chrome.alarms + panel ping
│   ├── ContextMenuHost           chrome.contextMenus registration
│   ├── CookieSessionStore        generic chrome.cookies + storage.session
│   ├── CORSProxy                 PROXY_FETCH (25 s timeout)
│   └── WorkspaceRouter           opens Full App tab, dedupes existing tabs
│
├── Side Panel (sidepanel/main.tsx)                     [PERSISTENT while open]
│   ├── ConfigProvider (compact) + AntdApp + XProvider
│   ├── SidePanelShell / SidePanelRouter
│   ├── AI RUNTIME ─────────────────────────────────────────────
│   │   ├── ProviderRegistry / ProviderRouter / TierResolver
│   │   ├── AgentOrchestrator + Planner / Executor / Renderer
│   │   ├── MCPClient + MCPRegistry + NowPilotMainServer (12 tools)
│   │   ├── ContextOptimizer + ContextCompressor
│   │   ├── MemoryEngine + Conversation/User/PreferenceMemoryStore
│   │   └── AITransactionLog + AITransactionLogDB + TraceRedactor
│   ├── STORAGE LAYER ─────────────────────────────────────────
│   │   ├── IndexedDB: ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, WriteJournalDB, AITransactionLogDB
│   │   └── chrome.storage: local (metadata, encrypted keys), session (tokens), sync (theme/language)
│   ├── CROSS-CONTEXT ────────────────────────────────────────
│   │   ├── WorkspaceStore (Zustand) + WorkspaceSync (BroadcastBus)
│   │   ├── MessageBus (cross-context via chrome.runtime), EventBus (in-panel), BroadcastBus (cross-surface)
│   │   └── RuntimeEnvelope<T> (typed message wrapper)
│   └── UI: Chat / Agent / Write (add-on) / TeamGQM (add-on) / Open Full App
│
├── Full App Tab (app/main.tsx)                          [PERSISTENT tab]
│   ├── ConfigProvider (default density) + AntdApp + XProvider
│   ├── AppShell + FullAppRouter (Layout w/ Sider)
│   ├── Same core services as Side Panel (single-writer coordination via WorkspaceStore)
│   └── UI: Chat / Agent / Notes / TeamGQM / Options (11 sub-sections)
│
├── Content Scripts (extraction-only)                    [ISOLATED world]
│   ├── ContentScriptHost         message bridge only, no UI mount
│   ├── SPANavigationWatcher      MutationObserver (no polling)
│   ├── PageContextBridge         extracted context → side panel / full app
│   └── MAIN world only for domain-specific globals (e.g. window.g_ck)
│
└── Add-ons
    ├── Site-specific: ServiceNow (urlPatterns: *.service-now.com/*)
    └── Global: Write, TeamGQM, ResearchSkill, SelectionContextMenu
```

## Extension Contexts and Their Responsibilities

### Background Service Worker (Ephemeral)

The SW cannot run AI providers, MCP servers, EventSource, or IndexedDB. It is the **facilitator**, not the runtime:

| Responsibility | Implementation | Notes |
|---------------|---------------|-------|
| Message dispatch | `BackgroundRouter` | Validates `sender.id === chrome.runtime.id` + `MessageType` |
| Lifecycle events | `LifecycleManager` | Registers `sidePanel.setPanelBehavior`, recreates alarms/menus |
| Cross-origin proxy | `CORSProxy` | Generic `PROXY_FETCH` with 25 s timeout, `RateLimiter` per addon |
| Session token storage | `CookieSessionStore` | Reads `chrome.cookies` + writes to `chrome.storage.session` |
| Tab routing | `WorkspaceRouter` | Opens Full App tab, deduplicates by `workspaceId` |
| Keepalive | `KeepAliveManager` | `chrome.alarms` + panel ping (never `setInterval`) |

**Critical constraint:** Listeners must be registered synchronously at module load. The SW may terminate between events. Global state does not persist — use `chrome.storage` as the source of truth.

### Side Panel (Persistent AI Runtime)

The Side Panel is the **primary AI runtime**. It owns every AI-related service. It persists while the panel is open; Chrome will not terminate it mid-stream.

| Service | Role |
|---------|------|
| `AgentOrchestrator` | Planner → Executor loop with tier caps. Only module allowed to enforce step limits. |
| `PlannerService` | Cheap JSON-only decision (action: answer/run_tool/ask_clarification). 3 s timeout. Haiku tier. |
| `ExecutorService` | Validates, permissions-check, runs tools deterministically. LLM never runs tools. |
| `RendererService` | Final concise answer from validated context + tool output. Flash tier. 512 token cap. |
| `ProviderRouter` | Selection, retry, fallback, circuit breaker. Never switches after `hasStreamedFirstToken: true`. |
| `ContextOptimizer` | Token budget, tier classification (tiny/small/medium/large), degradation pipeline, minimal mode. |
| `MemoryEngine` | System-owned memory orchestration across Conversation/User/Preference stores. |
| `AITransactionLog` | Every provider call, tool call, cache hit/miss, retry logged. Redacted before persistence. |

### Full App Tab (Deep Work Surface)

Structurally identical to the Side Panel but optimized for full-viewport workflows. It mounts the same core services (all AI runtime code is shared, not duplicated) but presents a different UI shell:

- **Layout:** AntD `Layout` with 240 px Sider navigation, 56 px Header, full content area
- **Density:** Default (no `compactAlgorithm`)
- **Pages:** Chat, Agent, Notes (full workspace with graph), TeamGQM, Options (11 sub-sections)
- **Owns:** DiagnosticsPanel, PromptManager, Provider/Model/MCP configuration, Import/Export

Both surfaces cannot be the **primary writer** simultaneously. Workspace coordination uses `BroadcastBus` election (see Cross-Surface Coordination below).

### Content Scripts (Extraction-Only in v0.1)

Content scripts may **read** the host page but must not render UI. The bundle must contain **zero** React or AntD code (enforced by `tests/isolation/no-content-script-ui.test.ts`).

| Component | Role |
|-----------|------|
| `ContentScriptHost` | Message bridge; `extraction-only` mode — no UI mount |
| `SPANavigationWatcher` | `MutationObserver` detecting SPA route changes (no polling) |
| `PageContextBridge` | Packages extracted context as `PageContext` via `RuntimeEnvelope` |

## Core vs Add-On Boundary

The most important architectural invariant: **Core never imports from Add-ons. Add-ons never bypass Core APIs.**

### Core Owns

- AI runtime (ProviderRouter, AgentOrchestrator, Planner/Executor/Renderer, ContextOptimizer)
- MCP (client, registry, built-in tools)
- Storage (IndexedDB databases, WriteJournal, migrations, encryption)
- Memory (all three stores + MemoryEngine + scoring)
- Telemetry (AITransactionLog, TraceRedactor, PromptInspector)
- Chrome API hosts (CORSProxy, ContextMenuHost, TabManager)
- Cross-context messaging (MessageBus, EventBus, BroadcastBus, RuntimeEnvelope)
- Workspace coordination (WorkspaceStore, WorkspaceRouter, WorkspaceSync)
- Theme (ThemeStore, antdConfig)
- Registries (AddonRegistry, SidePanelPageRegistry, FullAppPageRegistry, KeymapRegistry)
- Shared UI (ErrorBoundary, PortableMarkdown)

### Add-ons Own

- Site-specific context extraction (`IContextExtractor`)
- Side Panel pages (`SidePanelPageRegistration`)
- Full App pages (`FullAppPageRegistration`)
- Site-specific skills (`ISkill`)
- Add-on settings (`z.ZodSchema<unknown>`)
- Keymap registrations

### Layer Invariants

```
src/core/     → NEVER imports from src/addons/
src/addons/   → calls Core registries and services; NEVER imports other add-ons
src/components/pages/ → shared page components; NEVER imports add-on internals
src/entrypoints/sidepanel/ → NEVER imports from src/entrypoints/app/ (and vice versa)
```

## Planner → Executor → Renderer Pipeline

This three-stage pipeline is the central architectural pattern for cost-effective AI runtime. It separates the AI's decision from tool execution and response rendering.

```
User Input
    ↓
WorkspaceStore.load()  ← current workspace state
    ↓
MemoryEngine           ← retrieves conversation summary + user facts + preferences
    ↓
ContextOptimizer       ← token budget, tier classification, section assembly
    ↓
AgentOrchestrator.runTurn()    ← bounded loop
    │
    ├─→ PlannerService          [Haiku tier, 3 s timeout, JSON-only]
    │   Returns: answer | run_tool | ask_clarification
    │
    ├─→ ExecutorService         [Deterministic validation]
    │   └─ Validates tool name against closed enum
    │   └─ Checks permission policy
    │   └─ Runs with timeout
    │   └─ Returns ToolExecutionResult<T>
    │
    └─→ RendererService         [Flash tier, 5 s timeout]
        Returns: streamed text via ChunkBuffer
            ↓
        MemoryEngine.update()   ← persist memory updates
            ↓
        AITransactionLog.complete()
```

**Why this separation:** Haiku/Flash-class models cannot safely drive `maxSteps=15` agent loops. By splitting the cheap "what should I do?" (Planner) from the expensive "how do I render the answer?" (Renderer), the system enforces hard caps (1–5 planner calls depending on context tier) while preserving answer quality.

**Tier caps:**

| Context tier | Max planner calls | Max tool calls | MCP chaining |
|-------------|:---:|:---:|---|
| tiny (≤4K) | 1 | 1 | Disabled |
| small (8K–16K) | 2 | 1 | Disabled by default |
| medium (32K–128K) | 3 | 2 | Enabled |
| large (≥200K) | 5 | 3 | Enabled |

## Cross-Surface Coordination

### Shared Workspace Model

Both surfaces read/write a `WorkspaceStore` (Zustand) tracking:

- `workspaceId`, `conversationId`
- `activeProvider`, `selectedModel`
- `pinnedTabs`, `currentPageContext`, `selectedNotes`
- `activeAddonContext`, `activeSkillRun`
- `activeSurface: 'sidepanel' | 'full-app'`
- `openedFullAppTabId?`

### Primary Writer Election

Only one surface may be the primary writer at a time:

```
Startup: each surface writes candidate token to chrome.storage.session.np_workspace_primary
         using compare-and-set
         ↓
Heartbeat: every 3 s via BroadcastBus
         ↓
Missed 2 heartbeats → re-election
         ↓
Tie-break: Full App > Side Panel (Full App is the deep-work surface)
```

Secondary surfaces read from IndexedDB and mirror `WorkspaceStore` state via `BroadcastBus` messages.

### Workspace Handoff (Side Panel → Full App)

```
Side Panel                          Full App
    │                                   │
    ├─ WorkspaceStore.getState()        │
    ├─ BroadcastBus.flush()             │
    ├─ WorkspaceRouter.openFullApp()    │
    │   └─ chrome.tabs.create({          │
    │       url: 'app.html?              │
    │         workspaceId=X&             │
    │         conversationId=Y&          │
    │         page=chat'                 │
    │     })                             │
    │                                   ├─ WorkspaceStore.hydrateFromURL()
    │                                   ├─ BroadcastBus WORKSPACE_HANDOFF
    │   ├─ demote to read-only          │
    │   │                               ├─ becomes primary writer
```

Handoff is idempotent by `workspaceId` — double-click opens existing tab instead of duplicating.

## Data Flow

### Chat Message Flow (Flow 1)

```
User types in composer
    ↓
useChat checks for slash command (/write, /ask, /research, etc.)
    ↓
ContextOptimizer.optimize({
    model, modelContextWindow, userInput, conversationId, workspaceId,
    activeSurface, pageContext, selectedToolSchemas, memoryHints, preferences
}) → OptimizedContext
    ↓
AgentOrchestrator.runTurn(userInput, optimizedContext, abortSignal)
    ↓
ChunkBuffer enqueue(delta) → rAF-batched → useStreamingLLM state update
    ↓
PortableMarkdown renders streaming text
    ↓
On stream end: ChatHistoryDB.append(sessionId, message)
    ↓
MemoryEngine.update() — extract facts, update conversation summary
    ↓
WorkspaceStore.persist()
    ↓
AITransactionLog.complete()
```

### Page Context Extraction Flow

```
Content Script (extraction-only)
    ├─ SPANavigationWatcher detects navigation
    ├─ PageContextBridge extracts: url, title, meta, markdown (via @mozilla/readability)
    ├─ RuntimeEnvelope<{ type: 'EXTRACT_PAGE_CONTENT', pageContext }>
    │
    ↓ chrome.runtime.sendMessage
    │
Side Panel or Full App
    ├─ MessageBus receives EXTRACT_PAGE_CONTENT
    ├─ WorkspaceStore.setCurrentPageContext(pageContext)
    └─ Subsequent AI calls include page context via ContextOptimizer
```

### Provider Call Flow (with retry and circuit breaker)

```
ProviderRouter.selectProvider({ tier, privacyMode, configuredProviders })
    ↓ Candidate selected (matched from TIER_TO_MODEL_CANDIDATES)
    ↓
ProviderRouter.makeCall({ providerId, model, messages, abortSignal })
    ↓
┌─ Success → return stream
├─ Retryable error (TIMEOUT, PROVIDER_5XX, NETWORK, RATE_LIMITED)
│   └─ Pre-first-token only → retry same provider once
│   └─ Circuit breaker: 3 failures in 60 s → open for 5 min
├─ Non-retryable (AUTH, MODEL_UNKNOWN, SCHEMA_INVALID, HOST_NOT_PERMITTED)
│   └─ Fallback to next priority provider
└─ No provider available → Flow 1 no-provider modal
```

## Storage Architecture

### Split Storage Strategy

Messages and large objects live in IndexedDB. Metadata and config live in `chrome.storage`. This split prevents `chrome.storage.local`'s 10 MB limit from being exhausted by message bodies.

| Store | Backend | Contains |
|-------|---------|----------|
| Conversation metadata | `chrome.storage.local.np_conversation_meta` | id, title, status, topic, message count |
| Message bodies | IndexedDB `ChatHistoryDB.messages` | sessionId, role, content, timestamp |
| Memory bodies | IndexedDB `MemoryDB.messages` | conversationId, seq, role, content |
| User facts | IndexedDB `MemoryDB.userFacts` | id, content, type, confidence, tags |
| Notes | IndexedDB `NotesDB.notes` | id, title, content, wikilinks, version |
| API keys | `chrome.storage.local.np_providers` | AES-GCM encrypted |
| Session tokens | `chrome.storage.session` | Cleared on browser close |
| Theme/language | `chrome.storage.sync` | Cross-device sync (≤ 8 KB) |
| Workspace state | `chrome.storage.local.np_workspace` | versioned, synced via BroadcastBus |

### WriteJournal for Multi-Store Consistency

Operations spanning multiple stores (e.g., saving a chat message that also updates memory) use WriteJournal:

```
1. WriteJournalEntry(status='pending', steps: [...])
2. Execute steps sequentially (each step: status → 'completed' or 'failed')
3. Mark WriteJournalEntry(status='completed')
4. On failure: rollback completed steps, mark WriteJournalEntry(status='rolled-back')
```

## Component Boundaries Summary

| Component | Owns | Talks To | Import Constraints |
|-----------|------|----------|-------------------|
| `BackgroundRouter` | Message dispatch, sender validation | Chrome runtime API | No UI, no AI, no IndexedDB |
| `AgentOrchestrator` | Planner→Executor loop, tier caps | Planner, Executor, Renderer | Only from AI runtime |
| `PlannerService` | JSON-only action decision | ProviderRouter (haiku tier) | Never called by UI directly |
| `ExecutorService` | Tool validation + execution | MCPClient, NowPilotMainServer | Never called by UI directly |
| `RendererService` | Final response rendering | ProviderRouter (flash tier) | Never called by UI directly |
| `ProviderRouter` | Selection, retry, fallback, circuit breaker | `@ai-sdk/*` providers | Only from AI runtime |
| `ContextOptimizer` | Token budget, compression, degradation | MemoryEngine, PageContext | Only from AI runtime |
| `MemoryEngine` | Memory orchestration, scoring, injection | Conversation/User/PreferenceMemoryStore | Only from AI runtime |
| `AITransactionLog` | Telemetry, traces, redaction | All AI services, IndexedDB | Any AI component can log |
| `WorkspaceStore` | Cross-surface state (Zustand) | WorkspaceSync, BroadcastBus | Both surfaces, never from SW |
| `ThemeStore` | Theme mode (light/dark/auto) | ConfigProvider, XProvider | Both surfaces, chrome.storage.sync |
| `SidePanelShell` | Side panel UI routing | SidePanelPageRegistry | Side panel only |
| `AppShell` | Full App UI routing (Layout + Sider) | FullAppPageRegistry | Full App only |
| `ContentScriptHost` | Extraction bridge (no UI) | PageContextBridge | Content scripts only |
| `AddonRegistry` | Add-on registration, lifecycle | Core services | Core only (add-ons register, don't call registry) |

## Architectural Patterns

### Pattern 1: Planner → Executor → Renderer Separation

**What:** Split the AI call into three distinct services: a cheap planner (JSON decision), a deterministic executor (runs tools), and a renderer (converts results to text).

**When to use:** When running Haiku/Flash-tier models that cannot safely drive multi-step agent loops.

**Trade-offs:** Adds latency (up to 3 sequential AI calls) but prevents runaway agent loops. Forcing the planner to return JSON-only constrains the model enough that cheap tiers work reliably. NOT needed for GPT-4/Claude-Sonnet class models — those can run integrated agent loops directly.

### Pattern 2: Dual-Surface with Shared Workspace

**What:** Two independently-mountable UI surfaces (Side Panel + Full App Tab) share state through a single WorkspaceStore with primary-writer election.

**When to use:** When a narrow panel (400 px) is insufficient for deep-work workflows but the extension needs both quick-context and full-workspace modes.

**Trade-offs:** Complex cross-surface coordination (primary election, heartbeat, handoff). Worth it because it keeps the Side Panel fast and lightweight while providing a full IDE-like experience in the Full App. Avoids cramming configuration and diagnostics into 400 px.

### Pattern 3: Extraction-Only Content Scripts

**What:** Content scripts extract page context but render zero UI. All interaction happens in extension-owned surfaces.

**When to use:** When host-page UI injection creates CSP conflicts, style bleed, and Shadow DOM complexity that isn't yet justified by the feature set.

**Trade-offs:** Services like ServiceNow lose the "inline case insight box" that would be visible beside the case. Acceptable for v0.1 because the Side Panel provides sufficient context-adjacent workflows. Reintroduce injection in v0.2+.

### Pattern 4: Core-Addon Registry Architecture

**What:** Core owns shared infrastructure (AI, storage, messaging). Add-ons register pages, skills, context extractors through typed registries. Core never knows about specific add-ons.

**When to use:** When the product needs to be extensible but the core runtime must remain strict about how extensions access AI, storage, and messaging.

**Trade-offs:** Registry indirection adds boilerplate. Worth it because it prevents add-ons from calling AI providers directly, bypassing ContextOptimizer, MemoryEngine, or the tier caps.

### Pattern 5: System-Owned Memory

**What:** The LLM does not directly read/write memory. `MemoryEngine` is the sole owner — it extracts facts, scores relevance, and injects top-K memories into context.

**When to use:** When running cheap models that cannot reliably remember, decide what to store, or maintain state across turns.

**Trade-offs:** The model cannot volunteer memories unprompted. `MemoryExtractor` runs as a separate Haiku-tier call after each conversation turn. This adds latency but ensures memory quality for cheap models.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Running AI Calls from the Service Worker

**What people do:** Put AI streaming, MCP connections, or EventSource in the background SW.

**Why it's wrong:** SW terminates after ~30 s of inactivity, killing mid-stream. SW cannot use EventSource. SW cannot access IndexedDB. Any AI call in the SW will fail unpredictably.

**Do this instead:** Run AI calls exclusively in the Side Panel or Full App Tab. The SW only facilitates via `PROXY_FETCH` for cross-origin requests and `WorkspaceRouter` for tab opening.

### Anti-Pattern 2: Direct Provider Calls from UI Components

**What people do:** Call `streamText()` or `@ai-sdk/*` directly from React hooks or components.

**Why it's wrong:** Bypasses ContextOptimizer (no token budget), MemoryEngine (no memory injection), AITransactionLog (no traces), and tier caps (unbounded agent loops). Makes every component a security boundary.

**Do this instead:** All AI calls go through `AgentOrchestrator.runTurn()` → `ContextOptimizer` → tier-capped Planner/Executor/Renderer. The UI only sees the streamed output.

### Anti-Pattern 3: Importing AntD into Content Scripts

**What people do:** Try to render AntD components in content scripts for page-injected UI.

**Why it's wrong:** AntD's bundle size (~500 KB) bloats the content script. AntD's `<style>` injection conflicts with host-page CSS. Portal components (`Modal`, `Drawer`) break in Shadow DOM. CSP conflicts.

**Do this instead:** In v0.1, do not render UI from content scripts at all. In v0.2+, use Radix UI + Tailwind for injected UI (see §25 of PRODUCT_SPEC). Keep AntD in extension-owned pages only.

### Anti-Pattern 4: Two Writers Without Coordination

**What people do:** Let both the Side Panel and Full App write to the same IndexedDB stores without a primary-writer protocol.

**Why it's wrong:** Race conditions on memory writes, conversation updates, note saves. Version conflicts cause data loss. Two surfaces could run the same AI call simultaneously.

**Do this instead:** `BroadcastBus` primary election. Only the primary surface writes memory/notes/chat history. Secondary surfaces read from IndexedDB and mirror state. `WriteJournal` ensures idempotency.

### Anti-Pattern 5: Assuming SW State Persists

**What people do:** Store runtime state in global variables in the background SW, or use `setTimeout`/`setInterval` for periodic tasks.

**Why it's wrong:** The SW can terminate at any time. Globals are reset on restart. Timers are cancelled on termination.

**Do this instead:** Use `chrome.storage` as the source of truth. Use `chrome.alarms` for periodic tasks. Recreate listeners, menus, and alarms on every `onStartup`/`onInstalled`.

## Build Order Implications

Based on component dependencies, the recommended build order is:

```
Phase 1: MV3/WXT Runtime + Shells + Workspace
    │  (No dependencies — greenfield scaffold)
    │  Background SW, side panel entrypoint, full app entrypoint,
    │  ThemeStore, WorkspaceStore, RuntimeEnvelope, MessageBus/EventBus/BroadcastBus,
    │  SidePanelShell, AppShell, OnboardingModal, Cmd+K palette
    │
Phase 2: Storage + Security + WriteJournal
    │  (Depends on Phase 1 — WorkspaceStore needs storage)
    │  SettingStore, EncryptedStorage, WriteJournal, IndexedDBMigrator,
    │  ChatHistoryDB, MemoryDB, NotesDB, KeyVault, RateLimiter
    │
Phase 3: AI Runtime
    │  (Depends on Phase 2 — providers need encrypted storage)
    │  All providers (5), ProviderRouter, TierResolver,
    │  PlannerService, ExecutorService, RendererService, AgentOrchestrator,
    │  PromptCacheManager, StructuredOutput, ChunkBuffer
    │
Phase 4: Context-Adaptive Execution
    │  (Depends on Phase 3 — ContextOptimizer wraps AI calls)
    │  ModelContextTier, TokenBudget, ContextOptimizer, ContextCompressor
    │
Phase 5: Persistent Memory
    │  (Depends on Phase 4 — MemoryEngine feeds into ContextOptimizer)
    │  MemoryEngine, ConversationMemoryStore, UserMemoryStore,
    │  PreferenceMemoryStore, MemoryScorer, MiniSearchIndex
    │
Phase 6: Transaction Logging + Diagnostics
    │  (Depends on Phase 3 — wraps all AI calls)
    │  AITransactionLog, TraceRedactor, PromptInspector, DiagnosticsPanel
    │
Phase 7: Full UI Pages
    │  (Depends on Phase 3–6 — all runtime is ready)
    │  ChatPage, AgentPage, NotesPage, OptionsPage, hooks, patterns
    │
Phase 8: Add-ons + Content Scripts
    │  (Depends on Phase 7 — pages and runtime complete)
    │  ContentScriptHost, PageContextBridge, Write add-on,
    │  TeamGQM add-on, ServiceNow add-on, ResearchSkill
    │
Phase 9: Hardening + Release
       (Depends on Phase 1–8 — all features built)
       Perf tests, isolation tests, bundle size checks, lint audit
```

**Why this order:**
1. Phase 1 establishes the extension skeleton — without it, nothing runs.
2. Phase 2 adds persistence — Phase 3 providers need `EncryptedStorage` for API keys, and Phase 3's `AITransactionLog` needs `IndexedDBMigrator`.
3. Phase 3 is the core AI runtime — Phase 4 wraps it, Phases 5-6 depend on it having providers and an orchestrator.
4. Phase 4 (ContextOptimizer) feeds into Phase 5 (MemoryEngine needs OptimizedContext to know token budget for injection).
5. Phase 6 (telemetry) wraps every AI call — building it after Phase 3 ensures all calls are traced from the start.
6. Phase 7 (UI pages) depends on the runtime being complete so the pages have real behavior, not just skeletons.
7. Phase 8 (add-ons) depends on Phase 7 because add-ons register into the side panel and Full App shells.
8. Phase 9 gates everything — all features must exist before hardening.

## Integration Points

### External Services

| Service | Pattern | Auth | Notes |
|---------|---------|------|-------|
| OpenAI | `@ai-sdk/openai` → `createOpenAI` | API key (AES-GCM encrypted in storage) | Also used for Ollama and OpenAI-compatible |
| Anthropic | `@ai-sdk/anthropic` → `createAnthropic` | API key (AES-GCM encrypted) | Prompt caching via ephemeral cache_control |
| Google Gemini | `@ai-sdk/google` → `createGoogleGenerativeAI` | API key | cachedContent for prompt caching |
| Ollama | `@ai-sdk/openai` → `createOpenAI({ baseURL: localhost:11434 })` | `apiKey: 'ollama'` | No encryption needed (local) |
| MCP Servers | `@modelcontextprotocol/sdk` StreamableHTTP | Auth header in config | Never from SW |
| ServiceNow | `PROXY_FETCH` via SW | JSESSIONID + sysparmCK (session storage) | RateLimiter per addon |

### Internal Boundaries

| Boundary | Communication | Protocol |
|----------|--------------|----------|
| SW ↔ Side Panel | `chrome.runtime.sendMessage` | `RuntimeEnvelope<T>` → `ResponseEnvelope<T>` |
| SW ↔ Full App | `chrome.runtime.sendMessage` | Same as Side Panel |
| SW ↔ Content Script | `chrome.runtime.sendMessage` | Same, sender validation |
| Side Panel ↔ Full App | `BroadcastBus` (broadcast channel) | Workspace heartbeat, handoff, mirroring |
| Side Panel internal | `EventBus` (synchronous pub/sub) | In-panel events (note:saved, stream:abort) |
| Content Script → SW | Long-lived `chrome.runtime.Port` | `PORT_STREAM_START/CHUNK/END` for streaming data |
| Core ↔ Add-on | Registry registration + Core service calls | Add-ons call Core APIs through typed interfaces; Core dispatches through registries |
| Side Panel components | React context + Zustand stores | `WorkspaceStore`, `ThemeStore`, `useChat`, `useStreamingLLM` |

## Scaling Considerations

As a client-side extension, "scaling" means different things:

| Scale | Concern | Architecture Response |
|-------|---------|---------------------|
| 10 conversations | — | No concern, IndexedDB handles trivially |
| 100 conversations | LRU eviction, archive after 30 min idle | `ConversationMeta.status = 'archived'` |
| 500 user facts | LRU capped at 500 facts | Evict oldest by `updatedAt` |
| 5,000 notes | MiniSearch index rebuild | < 50 ms search, offline |
| 10 AI providers | ProviderRouter priority + fallback chain | Circuit breaker isolates slow providers |
| 3 surfaces (2 side panels + 1 Full App) | Primary election, single writer | Heartbeat-based election, 3 s promotion latency |
| Debug trace retention | 50 traces / 72 hours | FIFO eviction, redacted before storage |

**First bottleneck:** IndexedDB blocking. Catch `IDB_BLOCKED` error and degrade to in-memory session (no persistence) rather than crashing.

**Second bottleneck:** `chrome.storage.local` 10 MB limit. The split-storage strategy (metadata in storage, bodies in IndexedDB) prevents this.

**Third bottleneck:** `chrome.storage.session` token rotation under heavy ServiceNow usage. Session tokens clear on browser close; the extension re-extracts on tab activation.

## Sources

- Chrome Side Panel API reference (developer.chrome.com) — confirmed MV3 side panel architecture, `setPanelBehavior`, `open()` requiring user gesture
- WXT Framework documentation (wxt.dev) — confirmed entrypoint types, `defineBackground()` with `type: 'module'`, `defineContentScript()` with `world: 'ISOLATED'`
- Chrome MV3 Service Worker migration guide — confirmed SW constraints (no DOM, no `localStorage`, synchronous listener registration, `chrome.alarms` for timers)
- Vercel AI SDK v4/v7 docs (sdk.vercel.ai) — confirmed `streamText()` with `textStream` async iterable, `AbortSignal` propagation, tool calling
- NowPilot PRODUCT_SPEC_v0_1.md — primary source for all architecture decisions, component boundaries, data flows, and phase structure
- WXT v0.19 Changelog — confirmed `openPanelOnActionClick`, side panel HMR support
- @modelcontextprotocol/sdk docs — confirmed StreamableHTTP transport for MCP from extension pages

---

*Architecture research for: NowPilot v0.1 — Chrome MV3 Extension AI Assistant*
*Researched: 2026-07-10*
