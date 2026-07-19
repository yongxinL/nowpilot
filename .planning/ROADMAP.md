# Roadmap: NowPilot v0.1

## Overview

NowPilot v0.1 is a privacy-first, extensible Chrome MV3 AI assistant. The 10-phase linear build starts from a greenfield WXT scaffold and progresses through the full runtime stack — storage, AI runtime (the linchpin), context-adaptive execution, persistent memory, telemetry, UI, LLM-wiki features, add-ons, and hardening. Dependencies are strict: the AI runtime blocks everything downstream; shell and storage must be established first. Phases 4 and 6 can run in parallel after the AI runtime (Phase 3) lands.

## Phases

- [x] **Phase 1: MV3/WXT Runtime + AntD Shells + Workspace** — Extension scaffold, both UI surfaces, theme, workspace coordination, onboarding
- [x] **Phase 2: Storage, Security, WriteJournal, Workspace Persistence** — Split-storage strategy, encrypted API keys, idempotent migrations (completed 2026-07-12)
- [x] **Phase 3: Cost-Effective AI Runtime** — 5 providers, Planner→Executor→Renderer pipeline, AgentOrchestrator, tier caps (completed 2026-07-12)
- [x] **Phase 4: Context-Adaptive Execution** — Tier classification, token budgets, degradation pipeline, minimal mode (completed 2026-07-12)
- [x] **Phase 5: Persistent Memory Architecture** — System-owned memory engine, conversation/user/preference stores, retrieval scoring (completed 2026-07-13)
- [x] **Phase 6: Transaction Logging and Diagnostics** — AITransactionLog, TraceRedactor, DiagnosticsPanel in Full App (completed 2026-07-13)
- [x] **Phase 7: Full Chat, Agent, Notes, Options Pages** — Complete UI across both surfaces, all hooks, markdown streaming (completed 2026-07-13)
- [x] **Phase 7.1: LLM-Wiki & Filesystem Sync** — Auto-tagging, RAG Q&A, category system, one-way filesystem backup, notes maintenance (completed 2026-07-17)
- [x] **Phase 7.2: Page Extraction & Pin Tab** — Content scripts extract page context, PageContextBridge, pin-tab MCP tool, workspace wiring (completed 2026-07-17)
- [x] **Phase 7.3: RICH Design Core** — 17 P0 must-haves: AI persona profile, welcome cards, context-aware quick actions, clarification chips, follow-up suggestions, code block actions, richer stage indicators, branded header
- [x] **Phase 7.4: RICH Design Enhance** — 22 P1 should-haves: persona onboarding, split-pane layout, template browser, inline confirmation, personalized greeting, image paste (completed 2026-07-19)
- [ ] **Phase 7.5: RICH Design Polish** — 21 P2 nice-to-haves: persona editor, @mention syntax, voice input, TL;DR toggle, step checklists, educational tips
- [ ] **Phase 8: Add-ons and Content Script Runtime (Extraction-Only)** — Write/TeamGQM/ServiceNow add-ons, content scripts, data portability
- [ ] **Phase 9: Hardening and Release** — Performance tests, isolation verification, bundle checks, production release

## Dependency Graph

```
Phase 1 (Shells + Workspace)
  │
  ▼
Phase 2 (Storage + Security)
  │
  ▼
Phase 3 (AI Runtime) ← LINCHPIN
  │
  ├─────────────┐
  ▼             ▼
Phase 4        Phase 6    ◄── PARALLEL after Phase 3
(Context)      (Telemetry)
  │
  ▼
Phase 5 (Memory)
  │
  ▼
Phase 7 (Full UI)
  │
  ▼
Phase 7.1 (LLM-Wiki + Filesystem Sync)
  │
  ▼
Phase 7.2 (Page Extraction & Pin Tab)
  │
  ▼
Phase 7.3 (RICH Core)
  │
  ▼
Phase 7.4 (RICH Enhance)
  │
  ▼
Phase 7.5 (RICH Polish)
  │
  ▼
Phase 8 (Add-ons + Content Scripts)
  │
  ▼
Phase 9 (Hardening + Release)
```

## Phase Details

### Phase 1: MV3/WXT Runtime + AntD Shells + Workspace

**Goal**: A fully scaffolded Chrome extension with both UI surfaces mounted, theme system active, workspace coordination working, and first-run onboarding in place.
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05, SETUP-06, WRKSP-01, WRKSP-02, WRKSP-03, WRKSP-04, WRKSP-06, SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06, THEME-01, THEME-02, THEME-03, THEME-04, THEME-05, THEME-06, CMD-01, CMD-02, CMD-03, ONBD-01, ONBD-02, ONBD-03, HARD-05, HARD-06, HARD-08, HARD-09, HARD-10, ADDON-10
**Success Criteria** (what must be TRUE):

  1. Side panel opens and first-run onboarding appears on fresh install with no provider configured
  2. Full App tab opens from Side Panel with workspace state handed off correctly, and re-opening deduplicates existing tabs
  3. Background service worker registers all listeners synchronously at module load; no async gaps
  4. Cmd+K command palette opens on both surfaces with the full command set (Open Full App, Focus Side Panel, Open Options)
  5. Theme toggle (light/dark/auto) affects both surfaces immediately via ConfigProvider + antdConfig without CSS class manipulation
  6. antdConfig.ts exports getAntdConfig consumed by ConfigProvider; both surfaces render without AntD version-mismatch warnings
  7. Zero instances of `innerHTML`, `dangerouslySetInnerHTML`, `tailwind`, `shadcn`, `@radix-ui`, or `framer-motion` in the codebase
  8. `@ant-design/x-sdk` and `@ant-design/x-card` absent from package.json
  9. Core never imports from addons (ADDON-10 enforced by layered directory structure)

**Plans:** 7 plans
Plans:
**Wave 1** ✓

- [x] 01-01a-PLAN.md — Package manifest & dependency installation (SETUP-02/05/06)
- [x] 01-01b-PLAN.md — WXT config, MV3 manifest & tooling configs (SETUP-01/03/04, ADDON-10)
- [x] 01-01c-PLAN.md — Entry point stubs, icons & addons boundary (SETUP-01)

**Wave 2** ✓

- [x] 01-02-PLAN.md — Core Stores, Background SW, Safety Utilities (THEME-01, WRKSP-01, HARD-05/06/08/09/10)
- [x] 01-03-PLAN.md — Messaging, Routing, Keymaps, Page Registries (WRKSP-02/03, SHELL-03/04, CMD-03)

**Wave 3** ✓

- [x] 01-04-PLAN.md — Shell Layouts, Theme Integration, Skeleton Pages (THEME-02..06, SHELL-01/02/05/06)

**Wave 4** ✓

- [x] 01-05-PLAN.md — Command Palette & Onboarding (CMD-01/02, ONBD-01/02/03)

**UI hint**: yes

### Phase 2: Storage, Security, WriteJournal, Workspace Persistence

**Goal**: The split-storage strategy is operational — message bodies in IndexedDB, metadata in chrome.storage.local, API keys encrypted with AES-GCM, and WriteJournal ensures multi-store consistency.
**Depends on**: Phase 1
**Requirements**: WRKSP-05, STOR-01, STOR-02, STOR-03, STOR-04, STOR-05, STOR-06, STOR-07
**Success Criteria** (what must be TRUE):

  1. WriteJournal recovery test passes — interrupted multi-store operations replay correctly and reach a consistent state
  2. API key encryption round-trip passes — encrypt → persist → decrypt produces the original key, with unique salt/IV per key
  3. No message body or raw API key appears in chrome.storage.local (only metadata and encrypted payloads)
  4. IndexedDB migration from v1 fixture to v2 fixture passes idempotently
  5. Workspace state persists across page reload (Side Panel close/reopen) and cross-surface handoff (Side Panel → Full App)
  6. ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, and AITransactionLogDB all open successfully with correct schema versions

**Plans:** 8/8 plans complete
Plans:

**Wave 0** — Setup

- [x] 02-01-PLAN.md — Install idb v8.0.3 dependency and update test infrastructure for storage/crypto mocking

**Wave 1** — Core Infrastructure + Utilities (parallel)

- [x] 02-02-PLAN.md — IndexedDBManager with DBSchema, DB_VERSION, and getDB() singleton (STOR-01, STOR-05)
- [x] 02-03-PLAN.md — EncryptedStorage AES-GCM wrapper with PBKDF2 key derivation (STOR-02)
- [x] 02-06-PLAN.md — RateLimiter token bucket utility (STOR-06)

**Wave 2** — Builders (parallel)

- [x] 02-04-PLAN.md — IndexedDBMigrator with v1-initial-schema migration (STOR-04, STOR-05)
- [x] 02-05-PLAN.md — WriteJournalEntry types + WriteJournal coordinator (STOR-03, STOR-07)

**Wave 3** — Consumers (parallel)

- [x] 02-07-PLAN.md — Domain stores: ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, AITransactionLogDB (STOR-05, STOR-07)
- [x] 02-08-PLAN.md — Workspace persistence + provider encryption + broadcast bus sync (WRKSP-05, STOR-02)

### Phase 3: Cost-Effective AI Runtime

**Goal**: The full AI runtime pipeline is operational — all 5 providers connect via ProviderRouter, the Planner→Executor→Renderer pipeline executes with tier caps, streaming works through ChunkBuffer, and prompt caching is configured per provider.
**Depends on**: Phase 2
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, AIRN-01, AIRN-02, AIRN-03, AIRN-04, AIRN-05, AIRN-06, AIRN-07, AIRN-08, AIRN-09
**Success Criteria** (what must be TRUE):

  1. PlannerService returns valid JSON decisions with a closed `toolName` enum (answer, run_tool, or ask_clarification) within 3s timeout
  2. ExecutorService rejects unknown tool names and validates all tool inputs/outputs against Zod schemas
  3. ProviderRouter correctly selects, retries (pre-first-token only), and falls back across providers; circuit breaker opens after 3 consecutive failures in 60s
  4. AgentOrchestrator enforces tier caps — planner calls capped at 1 (tiny) to 5 (large), tool calls at 1 to 3
  5. StructuredOutput one-shot JSON repair correctly handles truncated/malformed planner output
  6. ChunkBuffer delivers rAF-batched streaming text; AbortSignal propagates through the full Planner→Executor→Renderer chain

**Plans:** 9/9 plans complete

**Wave 0** — Setup

- [x] 03-01-PLAN.md — Package installation (AI SDK v4 + jsonrepair) + type definitions + config

**Wave 1** — Foundation (parallel)

- [x] 03-02-PLAN.md — ProviderRegistry + modelDiscovery + 5 provider adapter factories
- [x] 03-03-PLAN.md — ToolRegistry + PermissionService + 3 fixture tools
- [x] 03-05-PLAN.md — ChunkBuffer + AbortManager streaming infrastructure
- [x] 03-08-PLAN.md — PromptCacheManager + PromptCacheAdapter

**Wave 2** — Router

- [x] 03-04-PLAN.md — CircuitBreaker + TierResolver + ProviderRouter

**Wave 3** — Pipeline Services

- [x] 03-06-PLAN.md — StructuredOutput + PlannerService + ExecutorService + RendererService

**Wave 4** — Orchestrator

- [x] 03-07-PLAN.md — AgentOrchestrator with Planner→Executor→Renderer loop

**Wave 5** — Integration

- [x] 03-09-PLAN.md — Store integration (providerStore extension) + background SW verification

### Phase 4: Context-Adaptive Execution

**Goal**: The ContextOptimizer wraps every AI call with tier-aware token budgets, dynamic section distribution, an 8-step degradation pipeline, and minimal mode for tiny models. Every OptimizedContext carries a provenance manifest.
**Depends on**: Phase 3
**Requirements**: CTXT-01, CTXT-02, CTXT-03, CTXT-04, CTXT-05, CTXT-06, CTXT-07
**Success Criteria** (what must be TRUE):

  1. ModelContextTier correctly classifies all models across the 4 tiers (tiny ≤4K, small 8K–16K, medium 32K–128K, large ≥200K)
  2. Token budgets follow the 70/20/10 formula and distribute correctly across system/tools/memory/context/history/user per tier
  3. Context overflow triggers the degradation pipeline stepwise — dropping debug context first, then compression, then minimal mode — never sending an oversized prompt
  4. Minimal mode blocks MCP chaining, caps memory injection at top-3, and restricts to one safe tool schema
  5. Every OptimizedContext carries a ContextProvenanceManifest recording section source, token count, and truncation decisions

**Plans:** 5/5 plans complete
Plans:

**Wave 1** — Foundation (parallel)

- [x] 04-01-PLAN.md — Foundation types (contextTypes, ModelContextTier, ContextProvenanceManifest) — CTXT-01
- [x] 04-02-PLAN.md — TokenEstimator (char-based + CJK detection + safety margin) — CTXT-02

**Wave 2** — Compressor

- [x] 04-03-PLAN.md — ContextCompressor (LLM summarization + heuristic compression) — CTXT-07

**Wave 3** — Core Optimizer

- [x] 04-04-PLAN.md — ContextOptimizer (budget, distribution, degradation pipeline, minimal mode) — CTXT-02/03/04/05/06

**Wave 4** — Integration

- [x] 04-05-PLAN.md — AgentOrchestrator.runWithContext() + OrchestratorEvent extension — CTXT-04

### Phase 5: Persistent Memory Architecture

**Goal**: The system-owned MemoryEngine orchestrates conversation summaries, cross-session user facts (5-factor scored), and preference injection — the LLM never directly reads or writes memory.
**Depends on**: Phase 4
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, MEM-06, MEM-07
**Success Criteria** (what must be TRUE):

  1. ConversationMemoryStore returns per-conversation summaries with recent turns (2–6 based on tier)
  2. UserMemoryStore returns top-5 scored facts (top-3 in tiny mode) with all sub-scores in [0, 1] range
  3. PreferenceMemoryStore injects UserPreferences as compact JSON (not verbose prose) into every AI call
  4. MemoryExtractor runs as a separate Haiku-tier call after each turn, extracting facts with 5-factor scoring
  5. Memory is shared across surfaces — Side Panel and Full App read the same stores through MemoryEngine
  6. Memory writes are single-writer — only the primary surface (via BroadcastBus election) writes; auto-summarise triggers after every 12 messages

**Plans:** 7/7 plans complete

**Wave 0** — Setup

- [x] 05-01-PLAN.md — Package install (minisearch@7.2.0) + memory types + test scaffolding

**Wave 1** — Foundation (parallel)

- [x] 05-02-PLAN.md — Schema migration v2: IndexedDBManager (DB_VERSION=2, NowPilotDB extension) + MemoryDB extended signatures
- [x] 05-03-PLAN.md — MiniSearchIndex + MemoryScorer (5-factor scoring, D-12) + conflictResolver (versioned facts, D-16/D-17)

**Wave 2** — Stores (parallel)

- [x] 05-04-PLAN.md — ConversationMemoryStore (tier-based turns, rolling summaries, archiving) + UserMemoryStore (two-pass retrieval, versioned facts)
- [x] 05-05-PLAN.md — PreferenceMemoryStore (Zustand persist, cross-store reads, D-08/D-09) + MemoryExtractor (Haiku-tier extraction, D-05)

**Wave 3** — Orchestration

- [x] 05-06-PLAN.md — MemoryEngine (assemble + extract + single-writer routing + cap enforcement, D-01/D-04/D-14/D-20/D-22/D-23/D-24)

**Wave 4** — Integration

- [x] 05-07-PLAN.md — AgentOrchestrator injection + BroadcastBus memory write routing (D-02/D-06/D-07)

### Phase 6: Transaction Logging and Diagnostics

**Goal**: Every AI, MCP, tool, and provider operation is traceable with operation IDs, redacted traces, and a DiagnosticsPanel in Full App → Options with export capabilities.
**Depends on**: Phase 3
**Requirements**: TELE-01, TELE-02, TELE-03, TELE-04, TELE-05, TELE-06, TELE-07, DATA-03
**Success Criteria** (what must be TRUE):

  1. Every provider call creates AITransaction + PromptTrace + ProviderTrace records with operation IDs
  2. Every tool call (built-in, MCP, skill) creates a ToolTrace with permission decision and outcome
  3. TraceRedactor correctly redacts API keys, Bearer tokens, JSESSIONID, sysparmCK, g_ck, MCP auth headers, and raw bodies before persistence
  4. DiagnosticsPanel in Full App → Options renders transaction list with copyable operation IDs, provider timelines, and prompt cache statistics
  5. Error toasts in Side Panel include "Open Diagnostics" link that opens Full App to the relevant trace
  6. Debug bundle can be exported as sanitized JSON/ZIP from Diagnostics

**Plans:** 8/8 plans complete

**Wave 0** — Setup

- [x] 06-01-PLAN.md — JSZip install, telemetry/types.ts (all core types), test scaffolding (TELE-01/02/03/04)

**Wave 1** — Foundation (parallel)

- [x] 06-02-PLAN.md — TraceRedactor class+singleton with 7 mandatory redaction patterns (TELE-05)
- [x] 06-03-PLAN.md — IndexedDB DB_VERSION 3 schema migration, WriteJournalEntry extension, AITransactionLogDB replacement with getTraceTree() (TELE-01/02/03/04)

**Wave 2** — Core Services (parallel)

- [x] 06-04-PLAN.md — AITransactionLog orchestration (start/complete/fail/batch-write/crash recovery) (TELE-01/05)
- [x] 06-05-PLAN.md — debugLog auto-redaction safety net + pruning.ts (tiered retention, debounced scheduling) (TELE-05)

**Wave 3** — Integration (parallel)

- [x] 06-06-PLAN.md — Pipeline integration (AgentOrchestrator lifecycle + 7 service trace emissions) + diagnosticsStore (TELE-01/02/03/04/07)
- [x] 06-07-PLAN.md — Export (single-operation JSON + multi-operation ZIP with manifest) (DATA-03)

**Wave 4** — UI

- [x] 06-08-PLAN.md — DiagnosticsPanel UI (master-detail, filter bar, 7 sub-components) + Error Toast deep-linking (TELE-06/07)

### Phase 7: Full Chat, Agent, Notes, Options Pages

**Goal**: Both surfaces have complete, functional page sets. Chat uses Planner→Executor→Renderer with streaming. Agent displays ThoughtChain. Notes (Full App only) supports wikilinks, backlinks, and graph. Options covers 11 sub-sections.
**Depends on**: Phase 5, Phase 6
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, CHAT-07, CHAT-08, CHAT-09, AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05, AGNT-06, AGNT-07, AGNT-08, NOTE-01, NOTE-02, NOTE-03, NOTE-04, NOTE-05, NOTE-06, NOTE-07, OPT-01, OPT-02, OPT-03, OPT-04, OPT-05, OPT-06, OPT-07, OPT-08, OPT-09, OPT-10, OPT-11
**Success Criteria** (what must be TRUE):

  1. Chat flow (Flow 1) works on both surfaces — user sends message → ContextOptimizer assembles → AgentOrchestrator.runTurn() → ChunkBuffer streams → PortableMarkdown renders; abort cancels mid-stream
  2. Streaming UI uses `@ant-design/x` Bubble/Sender/Conversations and `@ant-design/x-markdown` for markdown with LaTeX, mermaid, and code highlighting
  3. First-message title generation runs at temperature 0, max 16 tokens, non-blocking; conversation list persists in ChatHistoryDB
  4. Agent page uses ThoughtChain/Think components; tool calls trigger permission dialog (Allow once / Allow always / Deny); dangerous tools always prompt
  5. Slash commands (`/write`, `/ask`, `/research`) parse correctly and dispatch to registered handlers
  6. Notes (Full App only) support full CRUD with wikilinks resolving via LinkParser, backlinks panel showing referencing notes, and d3-force graph visualization (≥3 notes)
  7. Options page shows all 11 sub-sections with functional forms — Providers (with test connection), Models, MCP Servers, Prompt Templates, Slash Commands, Memory, Diagnostics, Import/Export, Feature Flags, Add-on Settings, About
  8. Options accessible only from Full App (not Side Panel), enforcing the surface separation rule

**Plans**: 6/6 plans complete

**Wave 0** — Foundation

- [x] 07-01-PLAN.md — Install d3-force, extend core types (WorkspaceState.drafts, OrchestratorEvent.waiting-permission, ChatHistoryDB.updateSession), create PermissionStore, SlashCommandRegistry, PromptManager with TemplateEngine

**Wave 1** — Hooks + Independent Features (parallel)

- [x] 07-02-PLAN.md — Create useStreamingLLM hook (AsyncGenerator iteration, ChunkBuffer, AbortController), useWorkspace, useTheme helper hooks
- [x] 07-05-PLAN.md — Create LinkParser (wikilink parsing + MiniSearch resolution + backlinks), NoteGraph (d3-force data model), NotesPage with all note components (NoteList, NoteEditor, NotePreview, BacklinksPanel, WikilinkAutocomplete, NoteGraphView, SaveToNoteDialog) + SkillMessageRenderer + SourceCard
- [x] 07-06-PLAN.md — Create all 11 Options sections (ProvidersSection through AboutSection), OptionsPage routing, workspaceRouter deep linking extension

**Wave 2** — Chat & Agent (parallel)

- [x] 07-03-PLAN.md — Create useChat hook (messages, conversations, title generation, drafts, context assembly), ChatPage with chat components (ChatMessage, ConversationSidebar, ProviderSelector, HistoryListItem)
- [x] 07-04-PLAN.md — Extend AgentOrchestrator with PermissionResolver callback, create useAgent hook (thoughtChain steps, permission handling), AgentPage with agent components (ThoughtChainView, ToolCard, PermissionDialog)

**UI hint**: yes

### Phase 7.1: LLM-Wiki & Filesystem Sync

**Goal**: Extend the Notes system with LLM-powered features (auto-tagging, auto-categorization, auto-summarization, semantic search, RAG Q&A, chat-to-note conversion), a hierarchical category system mapping to filesystem folders, one-way app-to-filesystem backup, and import-for-restore. Memory-aware RAG bridges notes with MemoryEngine for richer context.
**Depends on**: Phase 7, Phase 5, Phase 3
**Requirements**: See `.planning/LLM-WIKI-SPEC.md` Sections 2–5 (CAT-01..05, LLM-WIKI-01..10, SYNC-01..11, MEM-01..03)
**Success Criteria** (what must be TRUE):

  1. Auto-tag and auto-categorize on save — a Haiku-tier LLM call returns up to 5 tags + 1 categoryPath + 1-2 sentence summary; suggestions displayed in NoteEditor with accept/reject per tag
  2. "Ask notes" RAG Q&A — MiniSearch retrieves top-5 snippets, Flash-tier LLM synthesizes answer with per-statement citations (note title + wikilink); answer rendered as Bubble inline, ephemeral
  3. Category path maps 1:1 to filesystem folders during backup; nested folders created automatically via File System Access API
  4. Per-save sync writes `.md` with YAML frontmatter (id, created, updated, tags, categoryPath, summary) to user-selected backup folder
  5. Title collision resolution — numerical suffixes on same-title notes in same category path
  6. "Save to note" from chat — LLM drafts a note from conversation context + memory facts, opens NoteEditor pre-filled for user review
  7. Orphan detection — algorithmic (no LLM): notes with 0 wikilinks + 0 backlinks show "Orphan" badge
  8. Memory-aware RAG — "Ask notes" also queries MemoryEngine for relevant user facts/preferences
  9. Note → Memory extraction — LLM call extracts memory-worthy facts from note content, routed through MemoryEngine

**Plans**: 7 plans

**Wave 1** — Foundation

- [x] 07.1-01-PLAN.md — Types, Storage Migration & Dependencies (noteTypes, Note interface extension, v4 IndexedDB migration, NotesDB.getNoteByTitle(), npm packages)

**Wave 2** — Core Services (parallel)

- [x] 07.1-02-PLAN.md — LLM Core Services (NoteTagger Haiku-tier, NoteQA Flash-tier RAG, NoteChatConverter chat-to-note)
- [x] 07.1-03-PLAN.md — Sync & Maintenance Services (NoteFileSync File System Access API, NoteMaintenance orphan/staleness/bulk)

**Wave 3** — UI Components (parallel)

- [x] 07.1-04-PLAN.md — New UI Components (CategoryTree, TagSuggestions, AskNotesInput, NotesSection)
- [x] 07.1-05-PLAN.md — NoteEditor & NoteList Modifications (category input, tag suggestions, summary, staleness, orphan badge, AI search toggle, category tree)

**Wave 4** — Integration (parallel)

- [x] 07.1-06-PLAN.md — NotesPage, SaveToNoteDialog, & ChatMessage Integration (AskNotes, sync pipeline, save-to-note from chat)
- [x] 07.1-07-PLAN.md — Options Integration (NotesSection routing, Restore from folder)

### Phase 7.2: Page Extraction & Pin Tab

**Goal**: Content scripts extract page context (url, title, meta, markdown) and send it to the Side Panel and Full App via PageContextBridge. The `get-page-content` MCP tool exposes page data to the AI. The `pin-tab` MCP tool with a pin UI lets users pin/unpin tabs as context (max 10). Workspace store and ContextOptimizer are wired to include page context in every AI call.
**Depends on**: Phase 7, Phase 7.1
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, MCP tools #1 (`get-page-content`) and #5 (`pin-tab`)
**Success Criteria** (what must be TRUE):

  1. Content scripts registered in `wxt.config.ts` — ISOLATED world, extraction-only, no React/AntD/UI code
  2. `ContentScriptHost` provides extraction-only message bridge (no UI mount)
  3. `SPANavigationWatcher` detects SPA navigation via MutationObserver (no polling)
  4. `PageContextBridge` extracts url, title, meta, markdown (via `@mozilla/readability`) and sends to Side Panel/Full App via `RuntimeEnvelope`
  5. Content-script bundle < 50 KB and contains zero React/AntD/UI code — verified by `tests/isolation/no-content-script-ui.test.ts`
  6. `get-page-content` MCP tool returns active/pinned tab context to the AI
  7. `pin-tab` MCP tool pins/unpins tabs; pin UI in Side Panel shows current page + managed pinned tabs (max 10)
  8. `workspaceStore.setCurrentPageContext()` is called when page context changes
  9. `ContextOptimizerInput.pageContext` is passed from `useChat.ts` so the LLM sees page content in every AI call

**Plans**: 4/4 plans complete

**Wave 0** — Foundation

- [x] 07.2-01-PLAN.md — Type migration (PageContext, TabContext, workspaceStore) + package installation (@mozilla/readability, turndown) + message schemas

**Wave 1** — Modules + Context Wiring (parallel)

- [x] 07.2-02-PLAN.md — Content script modules: PageExtractor (Readability + turndown + DOM fallback), PageContextBridge, SPANavigationWatcher, ContentChangeWatcher, runtimeEnvelope source type
- [x] 07.2-04-PLAN.md — Context wiring (contextTypes schema change, ContextCompressor enhancement, useChat/useAgent hook wiring) + PinTabBar Side Panel UI component

**Wave 2** — Integration

- [x] 07.2-03-PLAN.md — Content script entrypoint (content.ts), wxt.config.ts changes, Background SW message handlers, MCP tools (get-page-content, pin-tab), ToolRegistry registration, bundle size verification

**UI hint**: yes

### Phase 7.3: RICH Design Core

**Goal**: Establish the RICH design paradigm foundation — AI persona profile, welcome experience, context-aware intention suggestions, AI-initiated clarification, proactive follow-up suggestions, richer stage indicators, and AI branding. 17 P0 must-have requirements.
**Depends on**: Phase 7.2, Phase 7, Phase 5
**Requirements**: RICH-R-01, RICH-R-02, RICH-R-11, RICH-I-01, RICH-I-05, RICH-I-06, RICH-C-01, RICH-C-02, RICH-C-03, RICH-C-04, RICH-C-05, RICH-C-06, RICH-C-07, RICH-C-08, RICH-H-01, RICH-H-04, RICH-H-08 (see `.planning/REQUIREMENTS_RICH_DESIGN.md`)
**Success Criteria** (what must be TRUE):

  1. PersonaProfile defines AI identity (name, tagline, personality core, language style) and PersonaInjector weaves it into every system prompt across chat and agent modes
  2. Empty chat state shows interactive Welcome Card grid (6 capability cards) that populate the Sender on click; cards dynamically sorted by usage and context
  3. Context-aware quick action chips appear above the Sender when a page is pinned — page-type heuristics (ServiceNow incident → "Summarize this case", KB article → "Summarize this article")
  4. When PlannerService returns `ask_clarification`, the UI renders clarification chips as interactive Button components in the Bubble — max 2 rounds before best-effort attempt with disclaimer
  5. After stream completion, follow-up suggestion chips (1-3) appear below responses with visual divider; tapping a chip sends it as the next user message
  6. Code blocks in AI responses render with inline action buttons: Copy code, Insert into page, Save as macro
  7. Streaming stage indicators show richer context: "Reading page context…" → "Planning…" → "Generating…" with expand toggle for detail
  8. Branded AI header bar above chat shows NowPilot name, avatar, tagline — dismissible, reappears on new conversation

**Plans**: 4 plans ✓

**Wave 1** — Persona Subsystem
- [x] 07.3-01-PLAN.md — PersonaProfile data model, PersonaService retrieval abstraction, PersonaInjector prompt injection, BunnyAvatar extraction, integration into useChat + AgentOrchestrator (RICH-R-01, RICH-R-02, RICH-R-11)

**Wave 2** — Welcome Cards + Branded Header
- [x] 07.3-02-PLAN.md — WelcomeCardService with three-tier contextual ranking, WelcomeCards 6-card capability grid, BrandedHeader AI identity bar, ChatPage empty-state replacement (RICH-I-01, RICH-H-01)

**Wave 3** — Clarification + Quick Actions
- [x] 07.3-03-PLAN.md — ActionChipGroup shared chip container, QuickActionService static hostname mapping, QuickActionChips above Sender, ClarificationAction in Bubble, PlannerDecision schema extension, clarification round tracking (RICH-C-01, RICH-C-02, RICH-C-03, RICH-C-04, RICH-I-05, RICH-I-06)

**Wave 4** — Follow-up + Code Block Actions + Stage Indicators
- [x] 07.3-04-PLAN.md — FollowUpService heuristic + Haiku-tier suggestions, FollowUpAction divider + chips, StageIndicator pipeline-driven labels with slow-stream pulse, CodeBlockActions Copy/Insert/Save-as-macro, ChatPage Think replacement (RICH-C-05, RICH-C-06, RICH-C-07, RICH-C-08, RICH-H-04, RICH-H-08)

**UI hint**: yes

### Phase 7.4: RICH Design Enhance

**Goal**: Extend RICH design with persona onboarding, split-pane layout, template browser, inline confirmation in chat mode, personalized greeting, and enhanced message actions. 22 P1 should-have requirements.
**Depends on**: Phase 7.3
**Requirements**: RICH-R-03, RICH-R-05, RICH-R-06, RICH-R-08, RICH-R-09, RICH-R-10, RICH-I-02, RICH-I-03, RICH-I-08, RICH-I-09, RICH-I-10, RICH-C-09, RICH-C-12, RICH-C-13, RICH-C-14, RICH-H-02, RICH-H-03, RICH-H-05, RICH-H-06, RICH-H-11, RICH-H-12, RICH-H-16 (see `.planning/REQUIREMENTS_RICH_DESIGN.md`)
**Success Criteria** (what must be TRUE):

  1. Persona profile surfaced in onboarding Step 1 as "Meet NowPilot" character introduction card
  2. Standalone mode supports split-pane layout: chat left (60%), context panel right (40%) with tabs for pinned tabs, notes, and tools
  3. Sender toolbar adds Templates icon button with categorized popover of prompt templates; recently-used shown first
  4. Chat mode shows inline confirmation chips for side-effect actions ("I'll search the web for that. [Proceed] [Cancel]"), aligning with Agent PermissionDialog
  5. Empty-state greeting uses user's name (from Google profile or UserMemoryStore) with time-of-day context
  6. Image paste support — pasted clipboard images attach as files via Sender

**Plans:** 7 plans
Plans:

**Wave 1** — Data Layer + Stateless Components (parallel)

- [x] 07.4-01-PLAN.md — Core Data Extensions: PreferenceMemoryStore persona fields, PersonaService.getActiveProfile(), PermissionService ConfirmationLevel + ConfirmationPolicy (RICH-R-05, RICH-C-13, RICH-R-06/08/09/10)
- [x] 07.4-02-PLAN.md — Right Pane System: RightPaneStore, RightPane container, PaneToggle, ContextTab, NotesTab, ToolsTab (RICH-H-11, RICH-H-12)
- [x] 07.4-03-PLAN.md — Template & Greeting Systems: builtinTemplates displayCategory, TemplateBrowserService, TemplateBrowser, GreetingService, useGreeting (RICH-I-09, RICH-I-10, RICH-C-14, RICH-I-03, RICH-I-02, RICH-I-08)
- [x] 07.4-04-PLAN.md — Chat Interaction Widgets: MeetNowPilotStep, InlineConfirmationCard, ConversationClosure, useConversationClosure, StructuredOutputActions (RICH-R-03, RICH-C-12, RICH-C-09, RICH-H-05)

**Wave 2** — Integration (parallel)

- [x] 07.4-05-PLAN.md — Brand UI + Agent + Onboarding: OnboardingModal MeetNowPilotStep, AgentPage ThoughtChain text, BrandedHeader greeting props, ChatMessage first-message branding + Save-to-note promotion (RICH-R-03, RICH-H-03, RICH-H-02, RICH-H-06, RICH-I-03)
- [x] 07.4-06-PLAN.md — StandaloneRoot Integration: Right pane column + responsive Drawer degradation (RICH-H-11, RICH-H-12)

**Wave 3** — ChatPage Assembly

- [x] 07.4-07-PLAN.md — ChatPage Integration: personalized greeting, TemplateBrowser prefix, image paste, InlineConfirmationCard, ConversationClosure, first-message branding wiring (RICH-C-14, RICH-I-10, RICH-H-16, RICH-C-12, RICH-C-09, RICH-H-05, RICH-I-03)

**UI hint**: yes

**Verification:**

### Phase 7.5: RICH Design Polish

**Goal**: Polish the RICH experience with persona editor, @mention syntax, voice input, TL;DR toggle, step checklists, educational tips, and enhanced markdown rendering. 21 P2 nice-to-have requirements.
**Depends on**: Phase 7.4
**Requirements**: RICH-R-04, RICH-R-07, RICH-I-04, RICH-I-07, RICH-I-11, RICH-I-12, RICH-I-13, RICH-I-14, RICH-C-10, RICH-C-11, RICH-C-15, RICH-H-07, RICH-H-09, RICH-H-10, RICH-H-13, RICH-H-14, RICH-H-15, RICH-H-17, RICH-H-18, RICH-H-19, RICH-H-20 (see `.planning/REQUIREMENTS_RICH_DESIGN.md`)
**Success Criteria** (what must be TRUE):

  1. Persona editor in Options → Persona allows customizing AI name, tone, and response brevity
  2. Sender supports @mention syntax (@note:title, @tab:title, @prompt:name) with autocomplete popover
  3. Voice input button in Sender toolbar using Web Speech API for dictation
  4. Long AI responses (>500 chars) have TL;DR expand/collapse toggle; numbered steps render as checkable cards
  5. Educational tips appear progressively: `/` command hint after 3 messages, Agent mode hint on 5th session — all tracked via UserMemoryStore
  6. Markdown tables have sticky headers and horizontal scroll; stage indicators show "Still working…" with ETA on slow streams

**Plans**: 7 plans
Plans:

**Wave 1** — Foundation (data layer + core services)
- [x] 07.5-01-PLAN.md — Data Foundation: PreferenceMemoryStore migration, PersonaService, ContextOptimizerInput, AttachmentModel (RICH-R-04/data, RICH-H-07/type)
- [x] 07.5-02-PLAN.md — Reference System Core: ReferenceResolver registry + 3 resolvers (RICH-H-15/core)
- [x] 07.5-03-PLAN.md — Supporting Data Layer: VoiceInput hook, PromptStarter data, EduTips data, UserMemoryStore extension (RICH-H-17/hook, RICH-I-11/12/13/14/data)

**Wave 2** — UI Components (presentational)
- [x] 07.5-04-PLAN.md — Markdown Enhancement: TL;DR toggle, Step Checklists, Sticky Tables, StageIndicator (RICH-H-18, H-19, H-20, H-09, H-10)
- [x] 07.5-05-PLAN.md — Sender Enhancement UI: @mention chips, Voice button, EduTips banner, QuickAction "More" (RICH-H-15/UI, H-17/UI, I-07, I-12/13/14/UI)
- [x] 07.5-06-PLAN.md — Options UI: Persona editor, Memory browser, OptionsRoot nav (RICH-R-04/UI, RICH-I-11/UI)

**Wave 3** — Integration
- [x] 07.5-07-PLAN.md — Conversation Feedback/Save + Greeting + Notes Q&A + ChatPage Integration (RICH-C-10, C-11, C-15, H-14 + all cross-cutting)

**UI hint**: yes

### Phase 8: Add-ons & Data Portability

**Goal**: The add-on system is fully operational — Write, TeamGQM, and ServiceNow add-ons register their pages and skills through typed registries. Data export/import works.
**Depends on**: Phase 7, Phase 7.1, Phase 7.2
**Requirements**: ADDON-01, ADDON-02, ADDON-03, ADDON-04, ADDON-05, ADDON-06, ADDON-07, ADDON-08, ADDON-09, DATA-01, DATA-02
**Success Criteria** (what must be TRUE):

  1. ServiceNow add-on extracts JSESSIONID via CookieSessionStore + ServiceNowSessionAdapter and sysparmCK from MAIN world; all API calls go through PROXY_FETCH
  2. Write add-on renders in Side Panel with all quick actions (Rewrite, Summarize, Draft customer update, Draft internal note, Explain, Action plan)
  3. TeamGQM add-on renders in both Side Panel (compact digest) and Full App (full workspace)
  4. `/research` command runs via ResearchSkill (MCP web-search or built-in tool; graceful failure if no search tool connected)
  5. Data export produces sanitized JSON/ZIP (no API keys); import merges with conflict resolution

**Plans**: TBD
**UI hint**: yes

### Phase 9: Hardening and Release

**Goal**: All performance targets met, isolation invariants verified, bundle sizes within budget, and the "Looks Done But Isn't" checklist cleared for production release.
**Depends on**: Phase 7.1, Phase 7.2, Phase 8
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04, HARD-07
**Success Criteria** (what must be TRUE):

  1. `pnpm run verify:all` passes — all test suites, type checking, and lint rules across every phase
  2. `pnpm run test:perf` passes — Side Panel initial paint < 300ms, Full App initial paint < 500ms, first token < 2s local / < 3s cloud
  3. `pnpm run test:isolation` passes — content script bundle < 50 KB, no cross-surface imports, no restricted imports
  4. WCAG AA contrast ratios verified across all UI surfaces — all interactive elements have focus rings and keyboard navigation
  5. All "Looks Done But Isn't" checklist items verified: abort handling (all 5 providers), offline mode (Ollama-only), multi-window, extension update data survival, quota exhaustion degradation, concurrent stream prevention, provider-deleted-while-streaming, keyboard navigation, memory pressure over 8-hour sessions

**Plans**: TBD

## Parallel Execution Note

Phases 4 (Context-Adaptive Execution) and 6 (Transaction Logging) both depend on Phase 3 but not on each other. After Phase 3 completes, these two phases can be executed concurrently via separate workstreams:

- Workstream A: Phase 4 → Phase 5 → Phase 7
- Workstream B: Phase 6 → merge into Phase 7

Phase 7 depends on both Phase 5 and Phase 6 being complete, acting as the convergence point.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. MV3/WXT Runtime + AntD Shells + Workspace | 7/7 | ✓ Complete | 2026-07-10 |
| 2. Storage, Security, WriteJournal, Workspace Persistence | 8/8 | Complete    | 2026-07-12 |
| 3. Cost-Effective AI Runtime | 9/9 | Complete    | 2026-07-12 |
| 4. Context-Adaptive Execution | 5/5 | Complete    | 2026-07-12 |
| 5. Persistent Memory Architecture | 7/7 | Complete   | 2026-07-13 |
| 6. Transaction Logging and Diagnostics | 8/8 | Complete   | 2026-07-13 |
| 7. Full Chat, Agent, Notes, Options Pages | 6/6 | Complete   | 2026-07-13 |
| 7.1. LLM-Wiki & Filesystem Sync | 7/7 | Complete    | 2026-07-17 |
| 7.2. Page Extraction & Pin Tab | 4/4 | Complete   | 2026-07-17 |
| 7.3. RICH Design Core | 4/4 | ✓ Complete | 2026-07-19 |
| 7.4. RICH Design Enhance | 0/7 | Planned | 2026-07-19 |
| 7.5. RICH Design Polish | 7/7 | ✓ Complete | 2026-07-19 |
| 8. Add-ons and Content Script Runtime (Extraction-Only) | 0/TBD | Not started | - |
| 9. Hardening and Release | 0/TBD | Not started | - |
