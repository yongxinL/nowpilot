# Roadmap: NowPilot v0.1

## Overview

NowPilot v0.1 is a privacy-first, extensible Chrome MV3 AI assistant. The 9-phase linear build starts from a greenfield WXT scaffold and progresses through the full runtime stack — storage, AI runtime (the linchpin), context-adaptive execution, persistent memory, telemetry, UI, add-ons, and hardening. Dependencies are strict: the AI runtime blocks everything downstream; shell and storage must be established first. Phases 4 and 6 can run in parallel after the AI runtime (Phase 3) lands.

## Phases

- [x] **Phase 1: MV3/WXT Runtime + AntD Shells + Workspace** — Extension scaffold, both UI surfaces, theme, workspace coordination, onboarding
- [ ] **Phase 2: Storage, Security, WriteJournal, Workspace Persistence** — Split-storage strategy, encrypted API keys, idempotent migrations
- [ ] **Phase 3: Cost-Effective AI Runtime** — 5 providers, Planner→Executor→Renderer pipeline, AgentOrchestrator, tier caps
- [ ] **Phase 4: Context-Adaptive Execution** — Tier classification, token budgets, degradation pipeline, minimal mode
- [ ] **Phase 5: Persistent Memory Architecture** — System-owned memory engine, conversation/user/preference stores, retrieval scoring
- [ ] **Phase 6: Transaction Logging and Diagnostics** — AITransactionLog, TraceRedactor, DiagnosticsPanel in Full App
- [ ] **Phase 7: Full Chat, Agent, Notes, Options Pages** — Complete UI across both surfaces, all hooks, markdown streaming
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

**Plans:** 2/8 plans executed
Plans:

**Wave 0** — Setup

- [x] 02-01-PLAN.md — Install idb v8.0.3 dependency and update test infrastructure for storage/crypto mocking

**Wave 1** — Core Infrastructure + Utilities (parallel)

- [x] 02-02-PLAN.md — IndexedDBManager with DBSchema, DB_VERSION, and getDB() singleton (STOR-01, STOR-05)
- [ ] 02-03-PLAN.md — EncryptedStorage AES-GCM wrapper with PBKDF2 key derivation (STOR-02)
- [ ] 02-06-PLAN.md — RateLimiter token bucket utility (STOR-06)

**Wave 2** — Builders (parallel)

- [ ] 02-04-PLAN.md — IndexedDBMigrator with v1-initial-schema migration (STOR-04, STOR-05)
- [ ] 02-05-PLAN.md — WriteJournalEntry types + WriteJournal coordinator (STOR-03, STOR-07)

**Wave 3** — Consumers (parallel)

- [ ] 02-07-PLAN.md — Domain stores: ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, AITransactionLogDB (STOR-05, STOR-07)
- [ ] 02-08-PLAN.md — Workspace persistence + provider encryption + broadcast bus sync (WRKSP-05, STOR-02)

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

**Plans**: TBD

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

**Plans**: TBD

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

**Plans**: TBD

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

**Plans**: TBD

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

**Plans**: TBD
**UI hint**: yes

### Phase 8: Add-ons and Content Script Runtime (Extraction-Only)

**Goal**: The add-on system is fully operational — Write, TeamGQM, and ServiceNow add-ons register their pages and skills through typed registries. Content scripts extract page context without rendering any UI. Data export/import works.
**Depends on**: Phase 7
**Requirements**: ADDON-01, ADDON-02, ADDON-03, ADDON-04, ADDON-05, ADDON-06, ADDON-07, ADDON-08, ADDON-09, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, CMD-04, DATA-01, DATA-02
**Success Criteria** (what must be TRUE):

  1. Content-script bundle contains zero React, zero AntD, zero UI code — verified by `tests/isolation/no-content-script-ui.test.ts` grepping the build output
  2. ServiceNow add-on extracts JSESSIONID via CookieSessionStore + ServiceNowSessionAdapter and sysparmCK from MAIN world; all API calls go through PROXY_FETCH
  3. Write add-on renders in Side Panel with all quick actions (Rewrite, Summarize, Draft customer update, Draft internal note, Explain, Action plan)
  4. TeamGQM add-on renders in both Side Panel (compact digest) and Full App (full workspace)
  5. Right-click selection → "Ask AI" opens Side Panel with selection text prefilled
  6. `/research` command runs via ResearchSkill (MCP web-search or built-in tool; graceful failure if no search tool connected)
  7. Data export produces sanitized JSON/ZIP (no API keys); import merges with conflict resolution

**Plans**: TBD
**UI hint**: yes

### Phase 9: Hardening and Release

**Goal**: All performance targets met, isolation invariants verified, bundle sizes within budget, and the "Looks Done But Isn't" checklist cleared for production release.
**Depends on**: Phase 8
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
| 2. Storage, Security, WriteJournal, Workspace Persistence | 2/8 | In Progress|  |
| 3. Cost-Effective AI Runtime | 0/TBD | Not started | - |
| 4. Context-Adaptive Execution | 0/TBD | Not started | - |
| 5. Persistent Memory Architecture | 0/TBD | Not started | - |
| 6. Transaction Logging and Diagnostics | 0/TBD | Not started | - |
| 7. Full Chat, Agent, Notes, Options Pages | 0/TBD | Not started | - |
| 8. Add-ons and Content Script Runtime (Extraction-Only) | 0/TBD | Not started | - |
| 9. Hardening and Release | 0/TBD | Not started | - |
