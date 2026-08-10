# Roadmap: NowPilot

## Overview

NowPilot v0.1 is a privacy-first, local-first AI assistant and personal knowledge platform — a Chrome MV3 extension (WXT + React 19 + Ant Design v6) with a thin Side Panel (chat-only) and a full Standalone workspace (chat, agents, notes, options, diagnostics). The roadmap follows the **canonical phase order declared in the product spec §18** — the single authoritative implementation sequencing: `1 → 2 → 3 → 3a → 4 → 4a → 4b → 5 → 5a → 5b → 6 → 6a → 6b → 6c → 7 → 7a → 8 → 8a → 9` (19 phases). Phases follow the product data-flow of *acquire → store → understand → display → extend → harden*, with reliability and governance sub-phases placed immediately after the capability they extend. Each phase ends green (`verify:phase-N`), is verified before the next begins, and evolution is human-verified — never autonomous. The journey starts with runtime shells and workspace state (1), hardens persistence (2), adds the cost-effective AI runtime (3, 3a), context adaptation and page acquisition (4, 4a, 4b), the knowledge base and LLM-Wiki (5, 5a, 5b), observability and governance (6, 6a, 6b, 6c), the full workspace UX and multimodal input (7, 7a), add-ons and tool governance (8, 8a), and finishes with hardening and the packaged release (9). All 81 v1 requirements map to exactly one phase; no orphans.

## Phases

- [x] **Phase 1: MV3/WXT Runtime + AntD Shells + Workspace** - Installable extension with side panel + standalone surfaces, onboarding, theme, Cmd+K, and shared workspace state (completed 2026-08-08)
- [x] **Phase 2: Storage, Security, WriteJournal, Workspace Persistence** - Encrypted vault, crash-safe write journal, IndexedDB stores, and durable workspace state (completed 2026-08-09)
- [ ] **Phase 3: Cost-Effective AI Runtime (+ Persona seed)** - Four-provider AI runtime with Planner→Executor→Renderer, streaming, cost guardrails, persona from day one
- [ ] **Phase 3a: Agent Reliability and Evidence** - Token-budgeted agent runs, checkpoint rollback, CompletionEvidence, bounded replan, commit-confirm barrier
- [ ] **Phase 4: Context-Adaptive Execution** - Tiered context windows, budget enforcement, graceful degradation, provenance manifests
- [ ] **Phase 4a: PageContentService (Knowledge Acquisition)** - Extraction-only page capture (Defuddle), < 50 KB content bundle, ephemeral per-tab index
- [ ] **Phase 4b: Trust-Aware Context and Receipts** - Retrieved data never instructs; injection quarantine; trust controls + context receipts
- [ ] **Phase 5: Knowledge Base (Memory + MiniSearch + Notes)** - Atomic notes with wikilinks, note graph, full-text search, budgeted memory
- [ ] **Phase 5a: LLM-Wiki & Filesystem Sync** - Auto-tagging, "Ask notes" RAG, chat→note conversion, one-way .md filesystem sync + restore
- [ ] **Phase 5b: Memory Governance and Experience Candidates** - Memory caps, decay, conflict precedence, user governance controls with provenance
- [ ] **Phase 6: Transaction Logging and Diagnostics** - Redacted transaction traces, Diagnostics panel, sanitized debug export
- [ ] **Phase 6a: Agent Evaluation** - Versioned golden suites with per-dimension evidence and failure-layer categorization
- [ ] **Phase 6b: Verified Continual Evolution** - Human-gated evolution candidates from failing evals; sandbox→approve→rollback; never self-activates
- [ ] **Phase 6c: Bounded Multi-Role Collaboration** - Single-agent one-role default; opt-in multi-role with coordinator-owned commits
- [ ] **Phase 7: Workspace Experience (UI/UX) + RICH** - Full chat/agent/notes/options surfaces with the RICH conversational layer
- [ ] **Phase 7a: Multimodal Input Foundation** - Image paste/upload via vision models, voice→editable text, redacted modality ContextItems
- [ ] **Phase 8: Add-ons and Content Script Runtime (Extraction-Only)** - ServiceNow, Write, TeamGQM add-ons; "Ask AI" context menu; /research
- [ ] **Phase 8a: Tool Governance and Active Discovery** - Tool capability manifests, permission prompts, idempotency, budget-bounded discovery
- [ ] **Phase 9: Hardening and Release** - All verify scripts green, performance budgets, regression gates, packaged Chrome release

## Phase Details

### Phase 1: MV3/WXT Runtime + AntD Shells + Workspace

**Goal**: An installable MV3 extension with side panel and standalone surfaces that share workspace state, theme, onboarding, and command palette.
**Depends on**: Nothing (first phase)
**Requirements**: RUNTIME-01, RUNTIME-02, RUNTIME-03, RUNTIME-04, RUNTIME-05, WSPC-01, WSPC-02, WSPC-03, WSPC-04, WSPC-05
**Success Criteria** (what must be TRUE):

  1. User installs the extension; the side panel opens with first-run onboarding on a fresh install.
  2. User opens the standalone view from the side panel; workspace state hands off correctly and re-opening focuses the existing tab instead of duplicating it.
  3. User toggles light/dark theme and both surfaces update immediately.
  4. User opens the Cmd+K palette with the command set on both surfaces.
  5. Chat, Agent, Notes, and Options page skeletons render in both surfaces with the AntD theme applied; no `innerHTML`/`dangerouslySetInnerHTML` anywhere in src and no banned packages installed.

**Plans**: 11/11 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — pnpm + WXT scaffold, pinned stack, wxt.config.ts (Appendix G), vitest toolchain, verify:phase-1 gate (wave 1)
- [x] 01-10-PLAN.md — gap closure: workspace sync + onboarding hydration mount wiring (WR-02/WR-03; closes the 2 failed verification truths) (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — canonical types: RuntimeEnvelope, MessageType (Appendix E + D-17), WorkspaceState (D-18), STR/PROMPTS constants (wave 2)
- [x] 01-11-PLAN.md — gap closure: messaging/sync hardening — real debugLog rewiring + inbound adoption + shape guards (WR-01/WR-04/WR-08/WR-09) (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — MessageBus + MessageBusBridge + EventBus/EventBusManager (Pitfall 5 whitelist) (wave 2)
- [x] 01-04-PLAN.md — errorCodes + debugLog (Golden Rule 9, R-10), i18n, keymap, core components (ErrorBoundary, PortableMarkdown, MinimalMode, FocusTrap) (wave 2)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — ThemeStore (chrome.storage.local, D-13), ThemePackRegistry (WSPC-04), antdConfig (wave 3)
- [x] 01-06-PLAN.md — WorkspaceStore (D-18), WorkspaceRouter (Pitfall 1 gesture-safe), WorkspaceSync (PING/PONG handoff) (wave 3)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-07-PLAN.md — AddonRegistry/AddonSettingsStore/PageRegistry, ContentScriptHost + PageContextBridge (D-16), content bundle isolation (Pitfall 4) (wave 4)
- [x] 01-08-PLAN.md — SidePanel/Standalone shells + routers, Onboarding (Flow 9/D-06), CmdKPicker (Flow 10), page skeletons (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-09-PLAN.md — entrypoint mounts (Appendix F one provider per surface), mount smoke tests, full verify:phase-1 + DONE-when hygiene gates (wave 5)

**UI hint**: yes

### Phase 2: Storage, Security, WriteJournal, Workspace Persistence

**Goal**: Durable, crash-safe, encrypted persistence — secrets never leak to chrome.storage, writes survive crashes via WriteJournal, and workspace state persists across reloads and surfaces.
**Depends on**: Phase 1
**Requirements**: STORAGE-01, STORAGE-02, STORAGE-03, STORAGE-04, STORAGE-05
**Success Criteria** (what must be TRUE):

  1. User's API keys and sensitive values encrypt/decrypt round-trip correctly (AES-GCM) and no message body ever appears in chrome.storage.local.
  2. User's workspace state (theme, conversations, add-on state) persists across page reload and side-panel↔standalone handoff.
  3. A mid-write crash recovers cleanly via WriteJournal replay (recovery test passes).
  4. The database migrates from the v1 → v2 fixture without data loss.
  5. User can import/export sanitized JSON/ZIP and back up/restore their data.

**Plans**: 11/11 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — foundation: deps (idb/fflate/fake-indexeddb), test harness, storage types, canonical error codes + spec C.2, i18n strings, fixture builders (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — real redaction: TraceRedactor body (O.13) + redactSensitive (DROP passwords) (wave 2)
- [x] 02-03-PLAN.md — vault: EncryptedStorage (AES-GCM-256) + KeyVault (installSecret + PROVIDER_KEY_UNREADABLE) (wave 2)
- [x] 02-05-PLAN.md — Setting.ts: per-key permissioned KV + serialized writes + migrate-on-read (np_schema_version) (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-04-PLAN.md — WriteJournal framework + WorkspaceStore journal rewire + recovery tests (wave 3)
- [x] 02-06-PLAN.md — IndexedDBMigrator (raw-open + wrap, v1→v2 fixture, degraded mode) + ErrorStore (FIFO 100, redacted) (wave 3)
- [x] 02-07-PLAN.md — ChatHistoryDB + NotesDB + MemoryDB (idb typed CRUD) (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-08-PLAN.md — sync-quota shadow (D-15) + ThemeStore rewire through Setting.ts + APPR-03 spec touch (wave 4)
- [x] 02-09-PLAN.md — ImportExport core: JSON+ZIP (fflate), scoped groups, manifest, merge/upsert journaled restore (wave 4)
- [x] 02-10-PLAN.md — RateLimiter + Requester functional primitives (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-11-PLAN.md — storage-layer entrypoint init + content-bundle isolation tokens + no-secrets privacy test + verify:phase-2 gate (wave 5)

### Phase 3: Cost-Effective AI Runtime (+ Persona seed)

**Goal**: Users can chat with any of four providers through Planner→Executor→Renderer orchestration with streaming, cost guardrails, and persona-aware prompting from day one.
**Depends on**: Phase 2
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07
**Success Criteria** (what must be TRUE):

  1. User configures any provider (`openai` | `anthropic` | `gemini` | `ollama`, including a custom OpenAI-compatible baseURL for local models) and converses with it.
  2. User sees responses stream incrementally in the chat UI (SSE + text via ChunkBuffer).
  3. User's usage is bounded by tier caps and monthly budget; the cheapest capable model is routed automatically with provider fallback + circuit breaker.
  4. Planner returns validated decisions with a closed toolName enum; Executor rejects unknown tools; Renderer respects output caps; structured output self-repairs once.
  5. User's persona overrides (name/tone/brevity) apply without a code change.

**Plans**: 1/9 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — foundation: pinned ai-sdk deps, canonical types seed (D-07), ProviderId swap, Phase-3 error codes + spec C.2 (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 03-02-PLAN.md — provider layer: ILLMProvider + getAISDKModel seam, 5 adapters (incl. OpenAICompat D-12), TierResolver + privacyModeFromPrefs (D-13), ProviderRegistry extension (D-21) (wave 2)
- [ ] 03-03-PLAN.md — deterministic utilities: ChunkBuffer (J.1), StreamAdapter, PromptCacheAdapter/Manager (K), toolSchemas (D-04/D-05), optimizedContext fixture (D-08) (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 03-04-PLAN.md — decision validity: StructuredOutput (L), PlannerDecisionSchema + PlannerService, ExecutorService (TOOL_REJECTED) (wave 3)
- [ ] 03-05-PLAN.md — ProviderRouter: fallback + breaker + D-13 privacy gate + D-18 callProviderJsonMode + budgetGuard (D-16), injected-fetch eval suite (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 03-06-PLAN.md — RendererService streaming (Seam 3) + AgentOrchestrator (Appendix I + onStreamDelta/invocation deviations, §1.4 caps) (wave 4)
- [ ] 03-07-PLAN.md — persona pipeline: PersonaProfile (N.1), np_persona accessor (D-09), PersonaInjector (N.2), contextHelper (D-02) (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 03-08-PLAN.md — minimal streaming chat: STR keys, co-located useStreamingLLM hook (D-01), ChatPage Bubble/Sender, SidePanelShell composer reconciliation (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 03-09-PLAN.md — runAIRuntimeInit wiring (vault→registry→persona→router, R-3), verify:phase-3 gate + isolation extension, §18 addendum (wave 6)

**UI hint**: yes

### Phase 3a: Agent Reliability and Evidence

**Goal**: Agent runs are reliable and evidenced — budgeted, rollback-capable, evidence-gated side effects, bounded replanning, and user confirmation before irreversible actions.
**Depends on**: Phase 3
**Requirements**: AGT-01, AGT-02, AGT-03, AGT-04, AGT-05
**Success Criteria** (what must be TRUE):

  1. A single agent run is bounded by the agent-level token budget (trajectory states transition correctly).
  2. A failed run can roll back one step via CheckpointRecorder.
  3. Side-effecting tools are marked done only with matching CompletionEvidence; cap exhaustion is reported as `partial`, never `completed`.
  4. Replanning is bounded by tier caps and never nested; abort works cleanly.
  5. User confirms before irreversible actions via the commit-confirm barrier; false-completion tests pass.

**Plans**: TBD

### Phase 4: Context-Adaptive Execution

**Goal**: AI execution adapts to model context — tiered windows with budget enforcement, graceful degradation on overflow, minimal-mode limits, and a provenance manifest on every context pack.
**Depends on**: Phase 3a
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04
**Success Criteria** (what must be TRUE):

  1. Context tiers (tiny/small/medium/large) are selectable and enforced against token budgets.
  2. Context overflow degrades stepwise — never fails mid-response and never sends an oversized prompt.
  3. Minimal mode blocks MCP chaining and LLM-Wiki RAG synthesis for small local models.
  4. Every OptimizedContext carries a ContextProvenanceManifest.

**Plans**: TBD

### Phase 4a: PageContentService (Knowledge Acquisition)

**Goal**: Users capture readable main content from any page (title/url/text/metadata) into the extension via extraction-only content scripts that stay under 50 KB and never inject into host pages.
**Depends on**: Phase 4
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05
**Success Criteria** (what must be TRUE):

  1. User browses a page and main content is extracted (Defuddle primary, Readability fallback, APC-lite structural walk) and delivered to the side panel/standalone.
  2. Passwords are never captured (isPassword ⇒ value omitted).
  3. Content-script bundle stays under 50 KB with no React/AntD/defuddle/yaml and no UI code; extraction is non-blocking.
  4. SPA navigation and tab updates trigger cache invalidation and re-extraction.
  5. Extracted content is searchable via an ephemeral per-tab MiniSearch index (never persisted).

**Plans**: TBD

### Phase 4b: Trust-Aware Context and Receipts

**Goal**: Retrieved content can never instruct the model — trust/authority metadata on every item, prompt-injection quarantine, user-controlled source trust, and reconstructible context receipts.
**Depends on**: Phases 4 and 4a
**Requirements**: TRUST-01, TRUST-02, TRUST-03
**Success Criteria** (what must be TRUE):

  1. Malicious page, note, and tool fixtures cannot alter policy or inject instructions (`instructionAuthority: false` enforced).
  2. User can open a context receipt that reconstructs packing decisions (Prompt Inspector) without exposing raw text.
  3. User can control which content sources feed the model (content trust controls).
  4. XSS-risk screening and prompt-injection quarantine run before any AI context use.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Knowledge Base (Memory + MiniSearch + Notes)

**Goal**: Users write atomic notes with wikilinks, browse a note graph with backlinks, search notes full-text, and benefit from budgeted conversation/user/preference memory.
**Depends on**: Phase 4b
**Requirements**: KNW-01, KNW-02, KNW-03, KNW-04, KNW-05
**Success Criteria** (what must be TRUE):

  1. User creates/edits/saves/deletes notes with wikilinks that resolve with the tie-break rule.
  2. User browses the note graph (d3-force) and backlinks in the Standalone Notes view.
  3. User full-text searches notes via MiniSearch (< 50 ms over 1,000 notes).
  4. Memory retrieval returns top-5 (top-3 in tiny mode) with scores in [0, 1]; preference profile injects compact JSON including persona overrides.
  5. The end-to-end Page → PageContentService → Note → MiniSearch path works.

**Plans**: TBD
**UI hint**: yes

### Phase 5a: LLM-Wiki & Filesystem Sync

**Goal**: Users get LLM enrichment — auto-tags/category/summary with accept/reject, cited "Ask notes" answers, chat→note conversion — plus one-way local-filesystem sync of notes as .md with restore-from-folder.
**Depends on**: Phase 5
**Requirements**: LLM-WIKI-01, LLM-WIKI-02, LLM-WIKI-03, SYNC-01, SYNC-02
**Success Criteria** (what must be TRUE):

  1. After saving a note, the user sees auto-suggested tags/category/summary with accept/reject; saves are never blocked by LLM tagging failure.
  2. User asks "Ask notes" and receives cited answers from the note index (flash); tiny mode falls back to plain MiniSearch; zero hits yields a helpful message with no wasted LLM call.
  3. User converts a chat/page into a structured note draft opened in a pre-filled editor (user is the gatekeeper).
  4. User picks a local folder (Standalone view) and notes export as .md with YAML frontmatter, nested folders, collision suffixing, delete-on-sync, and an external-change guard.
  5. User previews and restores from the folder additively — local notes not in the folder are never deleted.

**Plans**: TBD
**UI hint**: yes

### Phase 5b: Memory Governance and Experience Candidates

**Goal**: Memory is governed — capped growth, decay and private compression, conflict precedence, and user-facing view/edit/pin/forget/disable/export controls with provenance.
**Depends on**: Phases 5 and 5a
**Requirements**: MEM-01, MEM-02, MEM-03
**Success Criteria** (what must be TRUE):

  1. Memory growth is capped (no unbounded accumulation).
  2. Conflicting facts resolve by precedence (correction > verified > prior > inference); stale facts decay and compress privacy-preservingly.
  3. User views/edits/pins/forgets/disables/exports memory facts and can exclude them from cloud sync in Options.
  4. User can inspect a memory fact's source, confidence, lifecycle, sensitivity, and verified-at provenance; procedural experiences stay approval-gated.

**Plans**: TBD
**UI hint**: yes

### Phase 6: Transaction Logging and Diagnostics

**Goal**: Every AI transaction is observable — redacted transaction/prompt/provider/tool traces, a Diagnostics panel with operation IDs, and sanitized debug bundle export.
**Depends on**: Phase 5b
**Requirements**: DIAG-01, DIAG-02, DIAG-03
**Success Criteria** (what must be TRUE):

  1. Every provider call creates transaction/prompt/provider traces and every tool call creates a tool trace.
  2. Secrets, note content, and filesystem paths are never persisted in logs (redaction proven by test).
  3. User opens Diagnostics in Options, inspects transaction traces, execution paths, and error codes, and copies an operation ID.
  4. User exports a sanitized debug bundle.

**Plans**: TBD
**UI hint**: yes

### Phase 6a: Agent Evaluation

**Goal**: Agent quality is measurable — versioned golden suites produce per-dimension evidence (checklist, recall, relevance) with failure-layer categorization surfaced in Diagnostics.
**Depends on**: Phase 6
**Requirements**: EVAL-01, EVAL-02
**Success Criteria** (what must be TRUE):

  1. User runs evaluation suites against executed transactions and sees per-dimension pass/fail and scores.
  2. Failing cases show first-failing-layer diagnostics (deterministic validators; judges only for qualitative dimensions).
  3. Safety/leak/injection/false-completion/citation/isolation regressions block release.

**Plans**: TBD
**UI hint**: yes

### Phase 6b: Verified Continual Evolution

**Goal**: The assistant improves only through human-verified evolution — candidates proposed from failing evals + trace evidence, sandboxed, approved, scoped, monitored, and rollback-capable; nothing self-activates.
**Depends on**: Phases 5b and 6a
**Requirements**: EVO-01, EVO-02, PROP-01
**Success Criteria** (what must be TRUE):

  1. Raw traces cannot self-activate; untrusted content cannot update prompts, tools, permissions, code, or procedural memory.
  2. A failing eval maps to exactly one single-layer, cost-capped `proposed` candidate (evidence threshold: ≥ 3 agreeing failures, ≥ 0.15 score drop).
  3. A candidate can be proposed, tested, approved, scoped, and rolled back (sandbox → approve → scoped rollout → monitor → rollback).
  4. The properties/capability registry reflects only activated evolution.

**Plans**: TBD

### Phase 6c: Bounded Multi-Role Collaboration

**Goal**: Collaboration is bounded and explicit — single-agent default is a one-role CollaborationPlan; multi-role (User/Planner/Executor/Evidence) is opt-in with typed role policies, coordinator-owned commits, and no unbounded agents.
**Depends on**: Phases 3a, 4b, 6a, and 6b
**Requirements**: COLLAB-01, COLLAB-02, COLLAB-03
**Success Criteria** (what must be TRUE):

  1. The single-agent path uses a one-role CollaborationPlan with caps/deadline (single-agent baseline gate passes).
  2. User can opt into a multi-role plan; roles, tools, contexts, budgets, permissions, and typed handoffs enforce their policies with no hidden reasoning.
  3. The coordinator owns commits and workers have no side effects; an independent reviewer exists.
  4. Failure/fallback is contained; no open-ended or unbounded agents exist.

**Plans**: TBD

### Phase 7: Workspace Experience (UI/UX) + RICH

**Goal**: Users get the polished full workspace — complete Chat/Agent/Notes/Options pages with Planner→Executor→Renderer streaming, /write /ask presets, LLM-Wiki UI, and the RICH conversational layer (persona header, welcome cards, chips, stage indicators).
**Depends on**: Phase 6c
**Requirements**: RICH-01, RICH-02, RICH-03, RICH-04
**Success Criteria** (what must be TRUE):

  1. User chats on both surfaces with Planner→Executor→Renderer and ChunkBuffer streaming; /write and /ask presets work.
  2. User opens the full Notes page (Standalone) with wikilinks resolving, category tree, orphan badges, backup status, and SaveToNoteDialog.
  3. User configures all Options sub-sections with functional forms (Providers, Models, MCP, Prompts, Slash, Memory, Import/Export, Feature Flags, Add-ons, Persona, Notes; Diagnostics renders).
  4. RICH P0 works: persona header, welcome cards, quick-action chips, clarification + follow-up chips (max 2 rounds, graceful timeout), code-block Copy/Save-as-macro (clipboard-only insert), streaming stage indicators.
  5. Cmd+K palette, tab pinning (max 10), and light/dark/auto theme toggle work.

**Plans**: TBD
**UI hint**: yes

### Phase 7a: Multimodal Input Foundation

**Goal**: Users can attach images (paste/upload) and dictate voice (→ editable text) in chat; vision models render understanding, unsupported providers fail safely, and abort works end-to-end.
**Depends on**: Phases 7 and 4b
**Requirements**: MM-01, MM-02, MM-03
**Success Criteria** (what must be TRUE):

  1. User pastes/attaches an image in chat and a vision-capable provider (Ollama vision / VLM) renders understanding of it.
  2. User's voice input lands as editable text in the Sender and is sent explicitly (no inline binary).
  3. Image/audio inputs become redacted ContextItems with confidence/sensitivity metadata; unsupported providers fail safely.
  4. Aborting cancels across transcribe/plan/tool/render (AbortSignal).
  5. Attachments/FileCard surfaces render in RICH chat.

**Plans**: TBD
**UI hint**: yes

### Phase 8: Add-ons and Content Script Runtime (Extraction-Only)

**Goal**: Users get first-party add-ons — ServiceNow session integration, Write quick actions, TeamGQM — plus right-click "Ask AI" and /research, with the content-script runtime staying extraction-only (no host-page UI).
**Depends on**: Phase 7a
**Requirements**: ADDON-01, ADDON-02, ADDON-03, ADDON-04
**Success Criteria** (what must be TRUE):

  1. User right-clicks a text selection → "Ask AI" opens the side panel with the selection prefilled.
  2. User runs /research via ResearchSkill.
  3. Write add-on renders in the side panel with rewrite/summarize/draft quick actions and streamed output.
  4. TeamGQM add-on renders in the side panel and standalone workspace.
  5. ServiceNow add-on extracts JSESSIONID via ServiceNowSessionAdapter and calls APIs via PROXY_FETCH only; the content-script bundle still contains no React/AntD/UI code.

**Plans**: TBD
**UI hint**: yes

### Phase 8a: Tool Governance and Active Discovery

**Goal**: Every tool is governed — capability manifests (risk/side-effect/perms/timeout/cost/idempotency/verifier), risk-based permission prompts, postcondition verification, idempotent writes, and budget-bounded active discovery.
**Depends on**: Phases 8 and 3a
**Requirements**: TOL-01, TOL-02, TOL-03
**Success Criteria** (what must be TRUE):

  1. Every tool carries a complete ToolCapabilityManifest (category/risk/side-effect/perms/scopes/timeout/cost/idempotency/verifier/hashes).
  2. User is prompted before risky/side-effecting writes (risk- and side-effect-based permission policy).
  3. Duplicate/replayed writes are prevented (idempotent write replay-safety) and postcondition verification is required before a tool is "done".
  4. Tool results are validated/redacted/size-limited/shaped/attributed; active discovery stays within the tools token budget.

**Plans**: TBD

### Phase 9: Hardening and Release

**Goal**: v0.1 ships — all verify scripts green, performance budgets met, security regressions blocked, and a release build packaged for Chrome with complete release records.
**Depends on**: Phase 8a
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04
**Success Criteria** (what must be TRUE):

  1. User installs the packaged Chrome release build of the extension.
  2. Performance budgets hold: content bundle < 50 KB, side panel paint < 300 ms, standalone paint < 500 ms, first token < 2 s local / < 3 s cloud.
  3. No raw prompts, tool bodies, or secrets appear in logs, UI, or exports (TraceRedactor everywhere); prompt-injection, secret-leakage, false-completion, permission, and memory-isolation regressions block release.
  4. Filesystem restore round-trips a full vault; RAG returns correct citations on fixture notes; multimodal privacy and provider-routing fixtures pass.
  5. `pnpm run verify:all`, `test:perf`, and `test:isolation` all pass; release records include evaluation-suite and rubric versions.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** Phases execute in canonical spec §18 order: 1 → 2 → 3 → 3a → 4 → 4a → 4b → 5 → 5a → 5b → 6 → 6a → 6b → 6c → 7 → 7a → 8 → 8a → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. MV3/WXT Runtime + AntD Shells + Workspace | 11/11 | Complete    | 2026-08-08 |
| 2. Storage, Security, WriteJournal, Workspace Persistence | 11/11 | Complete    | 2026-08-09 |
| 3. Cost-Effective AI Runtime (+ Persona seed) | 1/9 | In Progress|  |
| 3a. Agent Reliability and Evidence | TBD | Not started | - |
| 4. Context-Adaptive Execution | TBD | Not started | - |
| 4a. PageContentService (Knowledge Acquisition) | TBD | Not started | - |
| 4b. Trust-Aware Context and Receipts | TBD | Not started | - |
| 5. Knowledge Base (Memory + MiniSearch + Notes) | TBD | Not started | - |
| 5a. LLM-Wiki & Filesystem Sync | TBD | Not started | - |
| 5b. Memory Governance and Experience Candidates | TBD | Not started | - |
| 6. Transaction Logging and Diagnostics | TBD | Not started | - |
| 6a. Agent Evaluation | TBD | Not started | - |
| 6b. Verified Continual Evolution | TBD | Not started | - |
| 6c. Bounded Multi-Role Collaboration | TBD | Not started | - |
| 7. Workspace Experience (UI/UX) + RICH | TBD | Not started | - |
| 7a. Multimodal Input Foundation | TBD | Not started | - |
| 8. Add-ons and Content Script Runtime (Extraction-Only) | TBD | Not started | - |
| 8a. Tool Governance and Active Discovery | TBD | Not started | - |
| 9. Hardening and Release | TBD | Not started | - |
