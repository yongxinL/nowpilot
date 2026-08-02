# Roadmap: NowPilot v0.1

## Overview

NowPilot v0.1 is built in 19 phases following a knowledge-first data-flow: acquire → store → understand → display → extend → harden. Phase 1 establishes the MV3 runtime, workspace, and dual-surface shells. Phases 2–4 build the secure storage, AI pipeline, context optimization, and agent reliability foundations. Phases 4a–5b form the knowledge core: page extraction, notes/wikilinks/memory, LLM-Wiki enrichment, trust-aware context, and memory governance. Phases 6–6c add telemetry, agent evaluation, continual evolution, and bounded multi-role collaboration. Phases 7–7a deliver the full RICH workspace experience and multimodal input. Phase 8–8a delivers the add-on ecosystem with tool governance. Phase 9 hardens everything for release.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (3a, 4a, 4b, 5a, 5b, 6a, 6b, 6c, 7a, 8a): Knowledge/agent-harness sub-phases from product spec §18 and §§28-32 (Rev. C)

- [ ] **Phase 1: Project Scaffold & Runtime Foundation** — WXT entrypoints, messaging, workspace store, theme, dual-surface shells with skeletons
- [ ] **Phase 2: Storage & Security Foundation** — Encrypted API keys, WriteJournal, IndexedDB migrations, CSP
- [x] **Phase 3: AI Core Pipeline** — Four providers, Planner/Executor/Renderer, AgentOrchestrator, persona seed (completed 2026-07-30)
- [x] **Phase 3a: Agent Reliability & Evidence** — Trajectory states, evidence-backed completion, structured turn outcomes, deterministic replanning (Rev. C) (completed 2026-08-01)
- [x] **Phase 4: Context Optimization Pipeline** — ContextOptimizer, ContextCompressor, PromptCacheManager (completed 2026-07-31)
- [x] **Phase 4a: Page Content Extraction** — PageContentService, Defuddle, APC-lite, MiniSearch page index (completed 2026-07-31)
- [x] **Phase 4b: Trust-Aware Context & Receipts** — ContextItem contracts, prompt-injection isolation, context receipts, stable-prefix, progressive skill disclosure (Rev. C) (completed 2026-08-01)
- [x] **Phase 5: Knowledge Base** — Notes CRUD, wikilinks, note graph, Conversation/User/Preference memory, MiniSearch (completed 2026-08-02)
- [ ] **Phase 5a: LLM-Wiki & Filesystem Sync** — NoteTagger, NoteQA, NoteChatConverter, NoteFileSync, NoteMaintenance
- [ ] **Phase 5b: Memory Governance & Experience Candidates** — Memory taxonomy, lifecycle, conflict resolution, user controls, procedural experience store (Rev. C)
- [ ] **Phase 6: Telemetry & Diagnostics** — AITransactionLog, TraceRedactor, DiagnosticsPanel
- [ ] **Phase 6a: Agent Evaluation** — Versioned golden suites, trajectory rubric, layered validators, failure taxonomy, release regression gates (Rev. C)
- [ ] **Phase 6b: Verified Continual Evolution** — Evidence-to-candidate pipeline, sandbox/approval/rollout/rollback (Rev. C)
- [ ] **Phase 6c: Bounded Multi-Role Collaboration** — Closed role registry, typed handoff artefacts, single coordinator/permission/commit authority, single-agent baseline gate (Rev. C)
- [ ] **Phase 7: Workspace Experience + RICH UX** — Full Chat/Agent/Notes/Options UI, RICH P0/P1 surfaces
- [ ] **Phase 7a: Multimodal Input Foundation** — Image paste/upload, voice transcription, interruption/cancellation, modality routing (Rev. C)
- [ ] **Phase 8: Add-on Ecosystem** — ServiceNow, Write, TeamGQM, Research, MCP tools
- [ ] **Phase 8a: Tool Governance & Active Discovery** — ToolCapabilityManifest, risk-based execution, postcondition verification, idempotency, active discovery (Rev. C)
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

**Plans**: 5/5 plans executed

Plans:

- [x] 01-01-PLAN.md — Theme persistence end-to-end: chrome.storage.local adapter → ThemeStore → ThemeToggle → SidePanelShell (tracer)
- [x] 01-02-PLAN.md — Cross-surface theme sync via BroadcastChannel + AppShell integration + skeleton loading
- [x] 01-03-PLAN.md — Command palette infrastructure: CommandRegistry + CommandPalette component (SHELL-05)
- [x] 01-04-PLAN.md — Onboarding wizard: 3-card welcome flow + background SW install detection (SHELL-03)
- [x] 01-05-PLAN.md — Shell wiring: command palette + onboarding integration into both surfaces + isolation test

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

**Plans**: 4/4 plans executed

Plans:

- [x] 02-01-PLAN.md — Tracer: CryptoService + ApiKeyStore end-to-end (encrypt→store→decrypt round-trip)
- [x] 02-02-PLAN.md — WriteJournal + MigrationRunner + test infrastructure (idb, fake-indexeddb, session mock)
- [x] 02-03-PLAN.md — Adapter relocation + SessionStore + WorkspaceStore migration to chrome.storage.local
- [x] 02-04-PLAN.md — Storage topology completion (MessageStore, NotesStore, DiagnosticsStore skeletons, redactSensitive, CSP docs)

### Phase 3: AI Core Pipeline

**Goal**: User can configure any of four AI providers and send prompts that flow through PlannerService → ExecutorService → RendererService with tier-based step limits and persona injection
**Depends on**: Phase 2
**Requirements**: AI-01, AI-02, AI-03
**Success Criteria** (what must be TRUE):

  1. User configures OpenAI, Anthropic, Gemini, or Ollama — each validates connection and is available for selection
  2. User sends a prompt that PlannerService routes to an answer decision; the ExecutorService rejects unknown/hallucinated tool names deterministically; the RendererService produces a concise response within output caps
  3. User's provider fails mid-operation — ProviderRouter falls back to next available provider or opens circuit breaker after 3 consecutive failures
  4. User's persona configuration (from PreferenceMemoryStore) is prepended into every Planner, Executor, Renderer, and MemoryExtractor system prompt via PersonaInjector, placed in the cached [SYSTEM] section
  5. Structured output with malformed JSON is repaired once via one-shot repair; second failure returns a typed schema error

**Plans**: 7/7 plans executed

Plans:

- [x] 03-01-PLAN.md — TRACER: Install deps + core types + OpenAI adapter + minimal answer pipeline + tracer test (AI-01, AI-02)
- [x] 03-02-PLAN.md — Anthropic, Gemini, Ollama ProviderAdapters + contract tests (AI-01)
- [x] 03-03-PLAN.md — ProviderRouter full: fallback chain, circuit breaker, streaming guard + tests (AI-01)
- [x] 03-04-PLAN.md — PlannerService dual-mode + StructuredOutput one-shot JSON repair + tests (AI-02)
- [x] 03-05-PLAN.md — PersonaProfile + PersonaInjector with tiered injection + byte-stability tests (AI-03)
- [x] 03-06-PLAN.md — StreamAdapter + ChunkBuffer + RendererService.stream() + tests (AI-02)
- [x] 03-07-PLAN.md — AgentOrchestrator full loop + ExecutorService full + integration tests + phase verification (AI-01, AI-02, AI-03)

**UI hint**: yes

### Phase 3a: Agent Reliability & Evidence

**Goal**: Every agent turn records explicit trajectory states, produces structured outcomes, and requires verified evidence for side-effecting completion — the agent is trustworthy by construction before any downstream work depends on it
**Depends on**: Phase 3
**Requirements**: AGT-01, AGT-02, AGT-03, AGT-04, TOL-03
**Success Criteria** (what must be TRUE):

  1. AgentOrchestrator emits typed trajectory states (assembling-context → planning → waiting-for-permission → executing → verifying → replanning → rendering → completed/failed/aborted) — invalid transitions return AGENT_STATE_INVALID
  2. Side-effecting tool results are verified via OutcomeVerifier before RendererService claims completion — rendered text must not claim writes without matching CompletionEvidence
  3. Every exit path returns an AgentTurnOutcome; cap exhaustion is terminalState:partial not completed; abort does not render a success answer
  4. Replanning follows deterministic policy — success→verify→render, retryable→one replan, permission/auth/schema→terminal; irreversible execution always terminates without retry or replan (cross-turn replay safety remains Phase 8a)

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 03a-01-PLAN.md — Contracts, strict trajectory machine, and operation-scoped idempotency primitive (AGT-01, AGT-03, TOL-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03a-02-PLAN.md — OutcomeVerifier and pure ReplanPolicy with exhaustive unit tests (AGT-02, AGT-04, TOL-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03a-03-PLAN.md — AgentOrchestrator integration, evidence-constrained renderer, signal propagation, and caller migration (AGT-01, AGT-02, AGT-03, AGT-04, TOL-03)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03a-04-PLAN.md — Abort propagation through nested ContextCompressor summarization (AGT-03)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03a-05-PLAN.md — STRIDE regression suite and explicit phase verification script (AGT-01, AGT-02, AGT-03, AGT-04, TOL-03)

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

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — TRACER: Core types + foundation services (ModelContextTier, TokenBudget, ContextProvenanceManifest, ContextOptimizer) + AgentOrchestrator/PlannerService/RendererService pipeline integration + tracer integration test (CTX-01, CTX-02) — completed 2026-07-31

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Degradation pipeline: ContextCompressor with 7 ordered steps + AI summarization overflow + minimal mode + ProviderRouter.getCompressionModel() (CTX-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — Prompt cache management: PromptCacheAdapter per Appendix K + PromptCacheManager with health tracking/cooldown + ProviderAdapter.countTokens() + ContextOptimizer cache integration (CTX-02)

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

**Plans**: 6/6 plans executed

Plans:
**Wave 1**

- [x] 04a-01-PLAN.md — Tracer: End-to-end extraction pipeline (deps+types+DomSerializer+DefuddleStrategy+PageContentService+content script migration) — autonomous: false (has checkpoint:decision)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04a-02-PLAN.md — Strategy expansion: ReadabilityFallback + ApcLiteStrategy + full mode-discriminated PageContext output

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04a-03-PLAN.md — Page indexing: PageIndexBuilder with MiniSearch heading-aware chunks + BM25 + index integration into PageContentService
- [x] 04a-04-PLAN.md — Verification: bundle isolation test (<50KB, no banned imports) + messaging contract tests + verify:phase-4a green (parallel with 04a-03)

**Wave 4** *(gap closure)*

- [x] 04a-05-PLAN.md — Gap closure: fix password name-heuristic regression (D-02), SPA-nav invalidation test regression (WR-02), isolation test output path, wire init() to side panel

**Wave 5** *(code-review closure)*

- [x] 04a-06-PLAN.md — Code-review closure: mode-aware cache (CR-01), crypto.randomUUID guard (WR-01), SPA index/cache consistency (WR-02), redaction false-positive allowlist (WR-03), hidden-input exclusion (WR-04)

### Phase 4b: Trust-Aware Context & Receipts

**Goal**: Every context source carries trust/sensitivity/provenance metadata, prompt-injection is isolated at the data boundary, and a context receipt explains what was included/omitted/compressed without exposing sensitive text
**Depends on**: Phase 4
**Requirements**: CTX-T01, CTX-T02, CTX-T03, CTX-T04, CTX-T05, CTX-T06, TOL-04
**Success Criteria** (what must be TRUE):

  1. Every ContextItem has relevance, freshness, trust, sensitivity, and instructionAuthority metadata — secret items are excluded from cloud prompts and logs
  2. Prompt-injection fixtures from page HTML, notes, memory text, and tool output cannot alter tool availability, permission outcomes, or system instructions
  3. Context receipt (ContextReceiptEntry) explains inclusion, compression, and omission (budget/irrelevant/stale/sensitive/policy) for every source — PromptInspector displays this without raw sensitive text
  4. Persona, system rules, and sorted tool schemas are byte-identical for identical configuration — snapshot tests fail on unexpected whitespace/order changes
  5. Irrelevant skill instructions consume zero prompt tokens (progressive disclosure); receipt records which skills were loaded

**Plans**: 6/6 plans executed

Plans:
**Wave 1** *(tracer)*

- [x] 04b-01-PLAN.md — TRACER: ContextItem types + ContextTrustPolicy core + ContextOptimizer trust-gated pipeline end-to-end with delimiter wrapping and receipt generation (CTX-T01, CTX-T02, CTX-T03)

**Wave 2** *(parallel — blocked on Wave 1 completion)*

- [x] 04b-02-PLAN.md — Full ContextTrustPolicy (8 source types) + ContextFreshnessPolicy (exponential decay, per-source TTLs) (CTX-T01)
- [x] 04b-03-PLAN.md — ToolResultShaper: redaction, size limits, provenance, immutable ContextItem (TOL-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04b-04-PLAN.md — Receipt extension: ContextReceiptEntry in manifest, omission reasons from compressor, totals cross-check (CTX-T03)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04b-05-PLAN.md — Stable-prefix contract: FNV-1a hash + per-section hashes + snapshot tests (CTX-T04)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04b-06-PLAN.md — Prompt-injection isolation tests + progressive skill disclosure basic mechanics (CTX-T02, CTX-T05)

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

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — TRACER: Notes persistence end-to-end — MigrationRunner v4, NoteSchema+LinkParser+NotesDB+MiniSearchNoteIndex+NoteGraph (NOTE-01)
- [x] 05-02-PLAN.md — Memory Foundation + Engine — MemoryRecord schemas, MemoryScorer, ConversationMemoryStore+UserMemoryStore+PreferenceMemoryStore, MemoryEngine orchestrator (MEM-01, MEM-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-03-PLAN.md — Integration + Verification — Conversation summarization LLM call, MemoryEngine→PersonaInjector feed, verify:phase-5 gate, integration tests (NOTE-01, MEM-01, MEM-02)

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

**Plans**: 1/3 plans executed

Plans:
**Wave 1**

- [x] 05a-01-PLAN.md — TRACER: Foundation (deps + NoteSchema + Migration v5 + NotesDB v5) → LlmService → NoteTagger end-to-end with EventBus note:saved handler (NOTE-02, NOTE-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 05a-02-PLAN.md — NoteQA (RAG with citations, search/ask modes, tiny fallback) + NoteChatConverter (haiku draft with MEM-03) + NoteMaintenance (staleness/orphan queries) (NOTE-02)
- [ ] 05a-03-PLAN.md — NoteFileSync: EventBus handler, permission management, debounced .md writes with YAML frontmatter, collision resolution, external-change detection, rename/delete cleanup, folder restore (NOTE-03)

**UI hint**: yes

### Phase 5b: Memory Governance & Experience Candidates

**Goal**: Memory records carry full lifecycle metadata (type, source, confidence, status, expiry), conflicts are resolved by precedence not silent merge, and procedural experience from verified trajectories feeds a governed evolution candidate store
**Depends on**: Phase 5
**Requirements**: MEM-G01, MEM-G02, MEM-G03, MEM-G04, MEM-G05, KNW-01, EVO-04
**Success Criteria** (what must be TRUE):

  1. Memory records are classified by taxonomy (working/episodic/semantic/preference/procedural) — notes remain outside MemoryDB as user-owned knowledge
  2. Every durable MemoryRecord has source/confidence/lifecycle status; forgotten records are immediately excluded from retrieval; secret records never enter cloud context
  3. Contradictions follow precedence: explicit user correction > verified external state > previous explicit > inferred — losing record becomes superseded/disputed, no silent merge
  4. Memory UI supports view, source, confidence, edit, pin, forget, disable by type, export, and cloud-exclusion controls (UI in Phase 7)
  5. ProceduralExperience candidates are created only from verified trajectories — candidates are not active until evaluation and approval
  6. AI-suggested knowledge edges remain proposals until user acceptance

**Plans**: TBD

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

**Plans**: TBD
**UI hint**: yes

### Phase 6a: Agent Evaluation

**Goal**: Every AI subsystem is covered by versioned golden suites with layered validators (environment→process→LLM judge); a release regression gate blocks safety/policy breaches; cost/latency/quality Pareto comparisons inform tier/provider selection
**Depends on**: Phase 3, Phase 6
**Requirements**: EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-06, EVAL-07, CTX-T06
**Success Criteria** (what must be TRUE):

  1. Versioned golden suites exist for planner, context, tools, permissions, providers, memory, RAG, completion evidence, and multimodal routing
  2. Trajectory rubric evaluates outcome, process, safety, grounding, memory, quality, latency, and cost independently — safety dimensions are blocking (no hidden averages)
  3. Environment/code validators are preferred; LLM judges are calibrated and used only for qualitative dimensions
  4. FailureLayer taxonomy assigns the first failing layer (context/planning/tool-selection/tool-arguments/permission/execution/verification/rendering/memory/provider/multimodal/user-abort)
  5. Golden suites run as release regression gates — permission enforcement, secret leakage, prompt injection, false completion, citation grounding, and cross-workspace isolation are blocking regressions
  6. Cost/latency/quality frontier reports Pareto-efficient tier/provider combinations

**Plans**: TBD

### Phase 6b: Verified Continual Evolution

**Goal**: Verified trajectories feed a sandboxed evolution pipeline (diagnosis → candidate → sandbox replay → security gates → approval → rollout → monitor → promote/rollback); no untrusted data directly modifies active prompts, tools, or procedural memory
**Depends on**: Phase 6a
**Requirements**: EVO-01, EVO-02, EVO-03, EVO-05, EVO-06
**Success Criteria** (what must be TRUE):

  1. Verified trajectories produce EvolutionCandidates targeting exactly one layer (knowledge/retrieval/instruction/experience/tool/workflow/model-tier)
  2. Every candidate passes sandbox replay, affected golden suites, and security tests before approval
  3. Approved candidates undergo scoped rollout with monitoring — promote or rollback based on metrics
  4. Untrusted pages/notes/uploads/tool output/raw feedback/raw traces cannot directly rewrite active prompts, permissions, tools, or procedural memory
  5. Agent-generated tools remain sandbox proposals — static checks, dependency allowlist, network disabled by default, no self-publication

**Plans**: TBD

### Phase 6c: Bounded Multi-Role Collaboration

**Goal**: Complex workflows (ServiceNow investigation, multi-source research, knowledge consolidation, verified evolution, NowPilot development) can use staged specialist roles with typed handoff artefacts — a single coordinator controls sequencing, permissions, and side effects; a reviewer independently validates outputs
**Depends on**: Phase 6a, Phase 6b
**Requirements**: COLLAB-01, COLLAB-02, COLLAB-03, COLLAB-04, COLLAB-05, COLLAB-06, COLLAB-07, COLLAB-08, COLLAB-09, COLLAB-10, COLLAB-11, COLLAB-13
**Success Criteria** (what must be TRUE):

  1. Collaboration activates only via explicit user selection or deterministic complexity policy + user preference — planner may recommend but cannot silently enable; routine tasks stay single-agent
  2. Roles are a closed registry (coordinator/investigator/researcher/implementer/reviewer/renderer) with restricted tool allowlists and context projections; roles are not invented at runtime
  3. CollaborationPlan enforces staged-shared-context strategy with max 3 active specialist roles + coordinator/reviewer; caps are product policy, not LLM-configurable
  4. Roles exchange typed AgentHandoffArtifacts (facts with source provenance, open questions, output refs) — no hidden reasoning; large outputs stored by reference
  5. Only CollaborationCoordinator sequences roles, requests permission, commits side effects, and terminates; workers cannot self-grant permissions or write persistent memory
  6. Independent reviewer (not the role that created output) can approve, reject, or request one correction cycle — rejected results cannot render as successful
  7. Role failure returns typed partial result; coordinator may retry once, substitute role/model, continue reduced, fall back to single-agent, or terminate with explanation
  8. Collaboration trace records activation reason, roles/policies, context sources, handoff references, per-role and total tokens/cost/latency, reviewer decision, and completion evidence

**Plans**: TBD

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

**Plans**: TBD
**UI hint**: yes

### Phase 7a: Multimodal Input Foundation

**Goal**: Users can paste/upload images for analysis (screenshots, diagrams, tables) and use voice input with editable transcription — binary payloads never enter prompt text directly, routing follows explicit provider/privacy policy, and AbortSignal propagates through all active stages
**Depends on**: Phase 7
**Requirements**: MM-01, MM-02, MM-03, MM-04, MM-06, MM-07
**Success Criteria** (what must be TRUE):

  1. Normalised ModalityInput represents text/image/audio/document; binary payloads never enter PromptSection directly
  2. ModalityObservations pass through ContextOptimizer, provenance, redaction, trust, and token budgets like other data sources
  3. Image paste/upload routes only to a vision-capable provider; silent local→cloud switch is blocked; blobs are operation-scoped; raw images are never logged
  4. Voice input flows: microphone → SpeechInputAdapter → partial/final transcript → editable Sender → explicit Send → Agent pipeline; no tool executes from unconfirmed partial transcript
  5. Multimodal session states (listening/transcribing/ready/thinking/speaking/interrupted/cancelled) propagate AbortSignal through all active pipeline stages

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

**Plans**: TBD
**UI hint**: yes

### Phase 8a: Tool Governance & Active Discovery

**Goal**: Every tool carries a ToolCapabilityManifest (category, risk, side effect, permissions, idempotency, schema hashes); execution follows a risk-based permission matrix; write tools are idempotent; tool results are shaped before context re-entry; active tool discovery keeps prompts within budget
**Depends on**: Phase 8
**Requirements**: TOL-01, TOL-02, TOL-05, TOL-06, TOL-07
**Success Criteria** (what must be TRUE):

  1. Every tool has a ToolCapabilityManifest — registry rejects incomplete manifests
  2. Risk-based execution: read-only+low-risk auto per user autonomy; reversible writes require confirmation or scoped grant; irreversible/high-risk always preview+confirm
  3. Write tools accept/derive an idempotency key — replay after retry/journal recovery/surface reload does not repeat external effects
  4. When tool-schema tokens exceed configured budget, expose small core set + discover-tools capability with normal permission checks
  5. Long-running async operations use operationId/status/progress/cancellation/checkpoint/resume/idempotency — hidden work is not buried in sync turn loop (deferred to future 8b)

**Plans**: TBD

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
Decimal phases execute after their parent integer phase: 3 → 3a → 4 → 4a → 4b → 5 → 5a → 5b → 6 → 6a → 6b → 6c → 7 → 7a → 8 → 8a → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffold & Runtime Foundation | 5/5 | Completed | 2026-07-28 |
| 2. Storage & Security Foundation | 4/4 | Completed | 2026-07-29 |
| 3. AI Core Pipeline | 7/7 | Completed | 2026-07-30 |
| 3a. Agent Reliability & Evidence | 5/5 | Complete    | 2026-08-01 |
| 4. Context Optimization Pipeline | 3/3 | Completed | 2026-07-31 |
| 4a. Page Content Extraction | 6/6 | Completed | 2026-07-31 |
| 4b. Trust-Aware Context & Receipts | 6/6 | Complete    | 2026-08-01 |
| 5. Knowledge Base | 3/3 | Complete    | 2026-08-02 |
| 5a. LLM-Wiki & Filesystem Sync | 1/3 | In Progress|  |
| 5b. Memory Governance & Experience Candidates | TBD | Not started | - |
| 6. Telemetry & Diagnostics | TBD | Not started | - |
| 6a. Agent Evaluation | TBD | Not started | - |
| 6b. Verified Continual Evolution | TBD | Not started | - |
| 6c. Bounded Multi-Role Collaboration | TBD | Not started | - |
| 7. Workspace Experience + RICH UX | TBD | Not started | - |
| 7a. Multimodal Input Foundation | TBD | Not started | - |
| 8. Add-on Ecosystem | TBD | Not started | - |
| 8a. Tool Governance & Active Discovery | TBD | Not started | - |
| 9. Hardening & Release | TBD | Not started | - |
