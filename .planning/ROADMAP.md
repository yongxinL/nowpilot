# Roadmap: NowPilot v0.1

## Overview

NowPilot v0.1 is built in 11 phases following a knowledge-first data-flow: acquire → store → understand → display → extend → harden. Phase 1 establishes the MV3 runtime, workspace, and dual-surface shells. Phases 2–4 build the secure storage, AI pipeline, and context optimization foundations. Phases 4a–5a form the knowledge core: page extraction, notes/wikilinks/memory, and LLM-Wiki enrichment. Phases 6–7 add telemetry and the full RICH workspace experience. Phase 8 delivers the add-on ecosystem. Phase 9 hardens everything for release.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (4a, 5a): Knowledge sub-phases from product spec §18

- [ ] **Phase 1: Project Scaffold & Runtime Foundation** — WXT entrypoints, messaging, workspace store, theme, dual-surface shells with skeletons
- [ ] **Phase 2: Storage & Security Foundation** — Encrypted API keys, WriteJournal, IndexedDB migrations, CSP
- [ ] **Phase 3: AI Core Pipeline** — Five providers, Planner/Executor/Renderer, AgentOrchestrator, persona seed
- [ ] **Phase 4: Context Optimization Pipeline** — ContextOptimizer, ContextCompressor, PromptCacheManager
- [ ] **Phase 4a: Page Content Extraction** — PageContentService, Defuddle, APC-lite, MiniSearch page index
- [ ] **Phase 5: Knowledge Base** — Notes CRUD, wikilinks, note graph, Conversation/User/Preference memory, MiniSearch
- [ ] **Phase 5a: LLM-Wiki & Filesystem Sync** — NoteTagger, NoteQA, NoteChatConverter, NoteFileSync, NoteMaintenance
- [ ] **Phase 6: Telemetry & Diagnostics** — AITransactionLog, TraceRedactor, DiagnosticsPanel
- [ ] **Phase 7: Workspace Experience + RICH UX** — Full Chat/Agent/Notes/Options UI, RICH P0/P1 surfaces
- [ ] **Phase 8: Add-on Ecosystem** — ServiceNow, Write, TeamGQM, Research, MCP tools
- [ ] **Phase 9: Hardening & Release** — Security audit, perf tests, isolation tests, edge-case verification

## Phase Details

### Phase 1: Project Scaffold & Runtime Foundation

**Goal**: Users can open both the Side Panel and Full App Tab with shared workspace, theme, and command palette — onboarding appears on fresh install
**Depends on**: Nothing (first phase)
**Requirements**: SHELL-03, SHELL-04, SHELL-05
**Success Criteria** (what must be TRUE):

  1. User opens the Side Panel for the first time and sees the onboarding flow
  2. User opens the Full App Tab from the Side Panel "Open Full App" button with workspace state handed off (no duplicate tabs)
  3. User toggles the theme (light/dark/auto) in either surface and sees it apply immediately to both
  4. User presses Cmd+K on either surface and the command palette opens with the full command set
  5. Both surfaces render independently with no cross-entrypoint import violations

**Plans**: 4/5 plans executed

Plans:

- [x] 01-01-PLAN.md — Theme persistence end-to-end: chrome.storage.local adapter → ThemeStore → ThemeToggle → SidePanelShell (tracer)
- [x] 01-02-PLAN.md — Cross-surface theme sync via BroadcastChannel + AppShell integration + skeleton loading
- [x] 01-03-PLAN.md — Command palette infrastructure: CommandRegistry + CommandPalette component (SHELL-05)
- [x] 01-04-PLAN.md — Onboarding wizard: 3-card welcome flow + background SW install detection (SHELL-03)
- [ ] 01-05-PLAN.md — Shell wiring: command palette + onboarding integration into both surfaces + isolation test

**UI hint**: yes

### Phase 2: Storage & Security Foundation

**Goal**: User's API keys are encrypted at rest, storage writes are consistent across multiple stores, and IndexedDB migrations run idempotently
**Depends on**: Phase 1
**Requirements**: STORAGE-01, STORAGE-02
**Success Criteria** (what must be TRUE):

  1. User configures a provider API key in Options and it is stored AES-GCM encrypted — key round-trip decrypt test passes
  2. User's multi-store writes (metadata + IndexedDB body) are consistent via WriteJournal recovery
  3. User's session tokens reside only in chrome.storage.session, message bodies only in IndexedDB, workspace state in chrome.storage.local
  4. User's IndexedDB migrates from v1 fixture through all versions idempotently
  5. Workspace state persists across page reload and cross-surface handoff

**Plans**: TBD

### Phase 3: AI Core Pipeline

**Goal**: User can configure any of five AI providers and send prompts that flow through PlannerService → ExecutorService → RendererService with tier-based step limits and persona injection
**Depends on**: Phase 2
**Requirements**: AI-01, AI-02, AI-03
**Success Criteria** (what must be TRUE):

  1. User configures OpenAI, Anthropic, Gemini, Ollama, and an OpenAI-compatible provider — each validates connection and is available for selection
  2. User sends a prompt that PlannerService routes to an answer decision; the ExecutorService rejects unknown/hallucinated tool names deterministically; the RendererService produces a concise response within output caps
  3. User's provider fails mid-operation — ProviderRouter falls back to next available provider or opens circuit breaker after 3 consecutive failures
  4. User's persona configuration (from PreferenceMemoryStore) is prepended into every Planner, Executor, Renderer, and MemoryExtractor system prompt via PersonaInjector, placed in the cached [SYSTEM] section
  5. Structured output with malformed JSON is repaired once via one-shot repair; second failure returns a typed schema error

**Plans**: TBD
**UI hint**: yes

### Phase 4: Context Optimization Pipeline

**Goal**: User's prompts are optimized with dynamic token budgets across four context tiers; prompts degrade gracefully instead of failing on overflow
**Depends on**: Phase 3
**Requirements**: CTX-01, CTX-02
**Success Criteria** (what must be TRUE):

  1. User's prompt is optimized differently for tiny (≤4K), small (8K–16K), medium (32K–128K), and large (≥200K) models with appropriate token distribution
  2. User's context overflows the budget — the degradation pipeline drops debug context, summarizes history, compresses page context, and trims tool schemas before entering minimal mode
  3. User on a tiny model: minimal mode blocks MCP chaining and LLM-Wiki RAG synthesis; only one safe tool and top-3 memories are injected
  4. User's prompt cache hints are transformed per-provider (Anthropic cache breakpoints, OpenAI system message prefix, etc.) and cache hit/miss is logged
  5. Every OptimizedContext carries a ContextProvenanceManifest recording where each section came from

**Plans**: TBD

### Phase 4a: Page Content Extraction

**Goal**: User can extract page content via layered Defuddle → APC-lite DOM walk with an ephemeral MiniSearch index; content script bundle stays <50KB with no React/AntD
**Depends on**: Phase 2
**Requirements**: PAGE-01
**Success Criteria** (what must be TRUE):

  1. User opens a web page — Defuddle extracts main content as clean Markdown with footnotes/math/code preserved
  2. User navigates to a page where Defuddle produces low-confidence output — Readability fallback is used, and APC-lite DOM+ARIA walk extracts structural data
  3. User's extracted page content is indexed in an ephemeral per-tab MiniSearch index (never persisted to disk)
  4. User navigates via SPA (wxt:locationchange) or switches tabs — the per-tab cache invalidates and re-extracts
  5. Content script bundle contains no React, AntD, defuddle, yaml, or File System Access API usage and is under 50KB; password fields are never captured (isPassword ⇒ value omitted)

**Plans**: TBD

### Phase 5: Knowledge Base

**Goal**: User can create atomic notes with wikilinks, browse a note graph with backlinks, and have conversation/user/preference memory persist across sessions
**Depends on**: Phase 4a
**Requirements**: NOTE-01, MEM-01, MEM-02
**Success Criteria** (what must be TRUE):

  1. User creates an atomic note with wikilinks — LinkParser resolves links with tie-break rule and the note appears in the note graph with cosine-similarity backlinks
  2. User searches notes via MiniSearch and gets results in under 50ms across 1,000 notes
  3. User's conversation memory returns summary + recent turns (2 for tiny, 4 for small, 6 for medium/large); older messages are automatically summarized after every 12 messages
  4. User's cross-session facts are scored (keyword + tag + recency + useCount + confidence), and top-5 (top-3 in tiny mode) are injected into prompts
  5. User's memory writes only happen from the primary surface (elected via BroadcastBus); secondary surfaces mirror read-only

**Plans**: TBD
**UI hint**: yes

### Phase 5a: LLM-Wiki & Filesystem Sync

**Goal**: User enriches notes via a single haiku call (tags + category + summary + memory facts), asks questions via RAG with citations, converts chat/page content to notes, and syncs to filesystem with one-way .md backup
**Depends on**: Phase 5
**Requirements**: NOTE-02, NOTE-03
**Success Criteria** (what must be TRUE):

  1. User saves a note — NoteTagger.analyze() runs non-blocking (haiku, single call) and auto-tag/category/summary suggestions render with accept/reject; save never blocks on LLM
  2. User types a question in the "Ask notes" bar — NoteQA.ask() retrieves MiniSearch top-5 snippets + relevant memory facts, synthesizes a flash-tier answer with clickable per-statement citations that navigate to source notes
  3. User converts a chat exchange or page content to a note — NoteChatConverter opens a pre-filled editor (user is the gatekeeper) with draft title, content, tags, wikilinks, and categoryPath
  4. User sets a backup folder via showDirectoryPicker() (Full App only) — per-save .md files are written with YAML frontmatter, nested categoryPath folders, collision suffixing, and external-change detection
  5. User restores notes from folder — additive upsert previews "Found N notes (X new, Y updated, Z unchanged)" and never deletes local notes not in the folder; v4 migration is idempotent

**Plans**: TBD
**UI hint**: yes

### Phase 6: Telemetry & Diagnostics

**Goal**: User can inspect AI transaction logs, view redacted traces, and diagnose provider/tool/cache issues from the Diagnostics panel in Full App → Options
**Depends on**: Phase 3
**Requirements**: DIAG-01
**Success Criteria** (what must be TRUE):

  1. Every provider call creates transaction + prompt + provider traces; every tool call creates a tool trace with permission decision
  2. User opens DiagnosticsPanel in Full App → Options and sees recent AI transactions, provider attempts (Timeline), MCP tool calls (Descriptions), prompt cache stats (Statistic), and context budget viewer (Progress)
  3. User copies an operation ID from any trace for reference
  4. Secrets (API keys, Bearer tokens, JSESSIONID, sysparm_ck, g_ck, raw prompt bodies, clipboard text, note content, filesystem paths) are redacted by TraceRedactor before persistence, UI display, console logging, or export

**Plans**: TBD
**UI hint**: yes

### Phase 7: Workspace Experience + RICH UX

**Goal**: User interacts through fully functional Chat, Agent, Notes, and Options surfaces on both Side Panel and Full App Tab with persona header, welcome cards, clarification/follow-up chips, code-block actions, and streaming stage indicators
**Depends on**: Phase 5a, Phase 6
**Requirements**: SHELL-01, SHELL-02, AI-04, RICH-01, RICH-02, RICH-03, RICH-04
**Success Criteria** (what must be TRUE):

  1. User opens Side Panel and sees Chat, Agent, Write, TeamGQM, and Open Full App as fully functional surfaces (Planner→Executor→Renderer pipeline, ChunkBuffer streaming); /write and /ask slash presets work
  2. User opens Full App Tab and sees Chat, Agent, Notes (full workspace with wikilinks, backlinks, graph), TeamGQM, and Options (all sub-sections including Persona, Notes, Diagnostics) as fully functional surfaces
  3. User sees a persona header with the AI's name/avatar/tagline on both surfaces; the persona is consistent across Chat and Agent modes
  4. User on an empty conversation sees Welcome Cards (4–6 capability cards) and context-aware quick-action chips (URL/hostname-based, no LLM); clicking a card or chip populates the Sender
  5. User types an ambiguous prompt — Planner returns ask_clarification with 2–4 option chips (max 2 rounds, then best-effort with caveat); after a response, 1–3 contextual follow-up chips appear (non-blocking, graceful timeout)
  6. User sees code-block inline actions (Copy, Save-as-macro, Insert=clipboard-only in v0.1); a "Save to note" first-class button on every assistant message; streaming stage indicators (Reading page context… → Planning response… → Generating…)

**Plans**: TBD
**UI hint**: yes

### Phase 8: Add-on Ecosystem

**Goal**: User can use ServiceNow add-on for case analysis, Write add-on for quick drafting, TeamGQM add-on on both surfaces, Research via MCP web-search, and 12 built-in MCP tools with external MCP server connectivity
**Depends on**: Phase 7
**Requirements**: TOOL-01, TOOL-02, ADDON-01, ADDON-02, ADDON-03, ADDON-04
**Success Criteria** (what must be TRUE):

  1. User invokes any of the 12 built-in MCP tools (get-page-content, search-notes, create-note, get-chat-history, pin-tab, read/write clipboard, get-provider-info, run-skill, list-skills, export-data, execute-webhook) — each validates input schema, checks permissions, and returns output via ExecutorService
  2. User connects an external MCP server via StreamableHTTP transport — first tool call triggers a permission dialog; dangerous tools always prompt regardless of allow list
  3. User on a ServiceNow page sees session extraction (JSESSIONID/sysparmCK), case context, and can run CaseAnalyzerSkill, CatchUpSkill (24h digest), SentimentSkill, and CodeSearchSkill
  4. User opens the Write add-on in the Side Panel and uses Rewrite, Summarize, Draft, Explain, Create Plan, and Generate Status quick actions — each streams output and supports Copy/Insert into chat/Save as note
  5. User opens TeamGQM on both surfaces (compact Side Panel quick view, full-page Full App workspace); user triggers /research via ResearchSkill with MCP web-search, graceful failure on no tool configured

**Plans**: TBD
**UI hint**: yes

### Phase 9: Hardening & Release

**Goal**: The application passes all phase verification scripts, isolation tests, performance targets, security checks, and edge-case recovery flows
**Depends on**: Phase 8
**Requirements**: SEC-01, TEST-01
**Success Criteria** (what must be TRUE):

  1. XSS prevention: all AI/tool/MCP output renders through PortableMarkdown (x-markdown); DOMPurify sanitizes any HTML consumed; no dangerouslySetInnerHTML exists; CSP is enforced; sender validation rejects non-extension messages
  2. Secret redaction: TraceRedactor strips API keys, tokens, raw prompt bodies, and ServiceNow session tokens from all logs, exports, backups, and DiagnosticsPanel display
  3. Content script isolation: bundle contains no React, AntD, defuddle, or yaml and stays under 50KB
  4. Performance: Side Panel paints in <300ms, Full App in <500ms, first token <2s local/<3s cloud; filesystem restore round-trips a full vault; RAG returns correct citations on fixture note set
  5. All phase verification scripts pass: `pnpm run verify:phase-1` through `pnpm run verify:phase-9`, `pnpm run test:perf`, `pnpm run test:isolation`, and `pnpm run verify:all`

**Plans**: TBD

## Progress

**Execution Order:**
Decimal phases execute after their parent integer phase: 4 → 4a → 5 → 5a → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffold & Runtime Foundation | 4/5 | In Progress|  |
| 2. Storage & Security Foundation | TBD | Not started | - |
| 3. AI Core Pipeline | TBD | Not started | - |
| 4. Context Optimization Pipeline | TBD | Not started | - |
| 4a. Page Content Extraction | TBD | Not started | - |
| 5. Knowledge Base | TBD | Not started | - |
| 5a. LLM-Wiki & Filesystem Sync | TBD | Not started | - |
| 6. Telemetry & Diagnostics | TBD | Not started | - |
| 7. Workspace Experience + RICH UX | TBD | Not started | - |
| 8. Add-on Ecosystem | TBD | Not started | - |
| 9. Hardening & Release | TBD | Not started | - |
