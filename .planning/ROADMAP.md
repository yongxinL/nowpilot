# NowPilot — Roadmap

**Project:** NowPilot
**Milestone:** v0.1
**Source of truth:** `.planning/PRODUCT_SPEC_v0_1.md` §18 (sole authoritative implementation sequence)
**Companion file:** `.planning/REQUIREMENTS.md` (220 v1 requirements, spec-native IDs + `REQ-F*` IDs for §9 features without native IDs)

> **No reordering.** Phase 1 → 19 are the canonical order from spec §18. Do not implement more than one phase per response unless explicitly requested (§18).
>
> **DONE = verification gate passes.** Each phase ships only when `pnpm run verify:phase-N` passes (§24). Acceptance recorded in VERIFICATION.md.

---

## Phases

- [x] **Phase 1: MV3/WXT Runtime + AntD Shells + Workspace Handoff** — AntD shells, RuntimeEnvelope, WorkspaceStore, Cmd+K palette shell, onboarding *(8/8 plans complete; verify:phase-1 green at 166 tests; see `.planning/VERIFICATION.md`)*
- [x] **Phase 2: Storage, Security, WriteJournal, Workspace Persistence** — EncryptedStorage, IndexedDB, KeyVault, WriteJournal, AES-GCM secrets (completed 2026-08-24)
- [x] **Phase 3: Cost-Effective AI Runtime (+ Persona seed)** — ProviderRouter, AgentOrchestrator, structured output, persona runtime foundation (completed 2026-08-29)
- [x] **Phase 4: Agent Reliability and Evidence** — Trajectory states, CompletionEvidence, AgentTurnOutcome, deterministic replan/terminal policy (completed 2026-08-29)
- [x] **Phase 5: Context-Adaptive Execution** — TokenBudget, ContextOptimizer, ContextCompressor, ContextProvenanceManifest (completed 2026-08-29)
- [x] **Phase 6: PageContentService (Knowledge Acquisition)** — Layered Defuddle→Readability fallback, APC-lite structural walk, panel-side extraction (completed 2026-08-30)
- [x] **Phase 7: Trust-Aware Context and Receipts** — ContextItem trust metadata, context receipt, six-layer injection defense, progressive skill disclosure (completed 2026-08-30)
- [ ] **Phase 8: Knowledge Base (Memory + MiniSearch + Notes)** — MemoryEngine, MiniSearch, NoteGraph, atomic notes + wikilinks, PreferenceMemoryStore np_persona
- [ ] **Phase 9: LLM-Wiki & Filesystem Sync** — NoteTagger/QA/ChatConverter/FileSync/Maintenance, OKF-aligned YAML frontmatter, write→restore round-trip, categoryPath, Memories↔Notes
- [ ] **Phase 10: Memory Governance and Experience Candidates** — MemoryRecord taxonomy, conflict precedence, lifecycle controls, procedural experience gating, edge provenance
- [ ] **Phase 11: Transaction Logging and Diagnostics** — AITransactionLog, TraceRedactor, PromptInspector, TokenLedger, DiagnosticsSection
- [ ] **Phase 12: Agent Evaluation** — Versioned golden suites, multi-dimension rubric, deterministic validators, first-failing-layer diagnostics, release-block regressions
- [ ] **Phase 13: Verified Continual Evolution** — EvolutionCandidate, CandidateProposer, sandbox→approve→scoped rollout→monitor→rollback
- [ ] **Phase 14: Bounded Multi-Role Collaboration** — Closed CollaborationRoleRegistry, CollaborationPlan, typed handoffs, single-agent baseline gate
- [ ] **Phase 15: Workspace Experience (UI/UX) + RICH** — Chat/Agent/Notes/Options pages, Options sub-sections, RICH 60 reqs (15.3 P0 core / 15.4 P1 enhance / 15.5 P2 polish), design system mockups
- [ ] **Phase 16: Multimodal Input Foundation** — ModalityInput/Observation, image paste/upload via vision model, voice transcription, AbortSignal across stages
- [ ] **Phase 17: Add-ons and Content Script Runtime (Extraction-Only)** — ServiceNow/Write/TeamGQM add-ons, Selection→Ask AI, /research, PROXY_FETCH, CookieSessionStore
- [ ] **Phase 18: Tool Governance and Active Discovery** — ToolCapabilityManifest, risk- & side-effect-based permission policy, postcondition verification, idempotency, active discovery
- [ ] **Phase 19: Hardening and Release** — verify:all + test:perf + test:isolation; CWS review-readiness, wxt submit init v2; CWS v1 publish API shutdown 2026-10-15

---

## Phase Details

### Phase 1: MV3/WXT Runtime + AntD Shells + Workspace Handoff

**Goal:** Side panel, standalone view, and workspace handoff are wired with MV3 discipline; the scaffold's dual messaging paths converge onto `BackgroundRouter`; onboarding + Cmd+K palette shell + cross-surface theme propagation are observable.
**Depends on:** Nothing (first phase; builds on existing scaffold).
**Requirements:** REQ-F05, REQ-F12, REQ-F19, REQ-F20 (4 v1 requirements) — workspace handoff Flow 11, Cmd+K palette Flow 10 command set on both surfaces, first-run onboarding entry point, Standalone view Cmd+K palette. Research-driven: REQ-R01, REQ-R02, REQ-R04, REQ-R05, REQ-R19, REQ-R21 (from `.planning/RESEARCH-RECONCILIATION.md` §D — see Phase 1 row in `SUMMARY.md`).
**Success Criteria** (what must be TRUE):

  1. Fresh install → opening Side Panel triggers `OnboardingModal` (Flow 9).
  2. Standalone view opens from Side Panel and re-opens without duplicating tabs (idempotent by workspaceId, Flow 11); workspace state hands off with no message loss.
  3. Cmd+K palette opens with the Flow 10 command set on **both** surfaces (including "Open Standalone view").
  4. Theme toggle changes propagate to both surfaces immediately (no reload; no per-surface copy).
  5. `pnpm run verify:phase-1` passes; grep gates: no `innerHTML`/`dangerouslySetInnerHTML` in `src/`, no `tailwind`/`shadcn`/`@radix-ui`/`framer-motion` in `package.json`.

**Verification gate:** `pnpm run verify:phase-1` (§24).
**Notes:** Phase 1 builds on existing scaffold (UI shells, stores, runtime, registries already in `src/`), not a rebuild. Per PROJECT.md Validated: entry points, Side Panel compact chat UI, Standalone shell, Options, Runtime/MessageBus/EventBus/BroadcastBus, Zustand+immer stores with chrome.storage, AI provider service, registries, theme system.

### Phase 2: Storage, Security, WriteJournal, Workspace Persistence

**Goal:** All persisted state is encrypted at rest with AES-GCM; secrets never touch `chrome.storage.local` raw; the WriteJournal prevents silent data loss across SW suspension; IndexedDB stores are migrated and version-gated.
**Depends on:** Phase 1.
**Requirements:** (no spec-native v1 IDs land in Phase 2 — this phase is infrastructure. Research-driven: REQ-R06 `unlimitedStorage` permission per ADR-STACK-02; REQ-R07 storage adapter error codes; REQ-R03 `np_workspace` write coalescing.)
**Success Criteria** (what must be TRUE):

  1. WriteJournal recovery test passes (simulated SW kill mid-write → replay restores state without loss).
  2. API key AES-GCM round-trip passes (encrypt → chrome.storage.local → decrypt).
  3. No message body or raw secret appears in `chrome.storage.local` (TraceRedactor proven by inspection).
  4. IndexedDB migration from v1 → v2 fixture passes (idempotent; backward-compatible).
  5. Workspace state persists across page reload and cross-surface handoff (no message loss, no scroll jump).

**Verification gate:** `pnpm run verify:phase-2` (§24).
**Plans:** 9/9 plans complete
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Wave-0 test infra: idb/fake-indexeddb installs + tests/setup.ts (IndexedDB + chrome.storage.session harness)
- [x] 02-02-PLAN.md — Crypto foundation: KeyVault + EncryptedStorage + redactSensitive + np_store→np_providers migration + Options modal masking
- [x] 02-03-PLAN.md — RateLimiter (token bucket) + Requester (UI fetch wrapper)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-04-PLAN.md — IndexedDBMigrator + 5 DBs at v1 + ErrorStore + unlimitedStorage permission
- [x] 02-06-PLAN.md — WorkspaceElection (CAS/heartbeat) + adapter STORAGE_QUOTA/STORAGE_RATE_LIMIT surfacing

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-05-PLAN.md — WriteJournal (O.11) + journalingAdapter (election-gated, journaled, debounced)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-07-PLAN.md — WorkspaceStore integration + boot wiring + WorkspacePersistence test

**Gap closure** *(executed via `/gsd-execute-phase 02 --gaps-only`)*

**Gap Wave 1**

- [x] 02-09-PLAN.md — GAP 2 (CR-02): publish WORKSPACE_HEARTBEAT from runHeartbeatTick + BroadcastBus surface seam + production-tick two-surface test
- [x] 02-08-PLAN.md — GAP 1 (CR-01): recoverWorkspaceJournal boot-recovery fix (re-apply current np_workspace) + corrected regression tests

### Phase 3: Cost-Effective AI Runtime (+ Persona seed)

**Goal:** The bounded Planner → Executor → Renderer pipeline streams from user-configured OpenAI / Anthropic / Gemini / Ollama providers; tier-resolved routing (fast / balanced); persona runtime is wired into every AI call from day one.
**Depends on:** Phase 2 (IndexedDB persistence for transcripts).
**Requirements:** RICH-R-01, RICH-R-02, RICH-R-09, RICH-R-10 (4 v1 requirements) — PersonaProfile, PersonaInjector, chat/agent share persona, persona-consistent system prompt per pipeline stage.
**Success Criteria** (what must be TRUE):

  1. Planner returns valid JSON decisions with closed `toolName` enum; Executor rejects unknown tools with `TOOL_REJECTED`.
  2. Provider fallback + circuit breaker tests pass (one provider down → routed to next enabled provider).
  3. Structured-output one-shot repair works (Appendix L).
  4. **PersonaInjector prepends the persona block to the Planner, Executor, Renderer, and MemoryExtractor system prompts — persona-aware from day one — placed in the cached `[SYSTEM]` section so prompt caching is preserved.**
  5. **UserPreferences.personaOverrides (name/tone/brevity) apply without a code change.**

**Verification gate:** `pnpm run verify:phase-3` (§24).
**Plans:** 7/7 plans complete
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — TRACER: planner decision from fixture OpenAI wire bytes (SSE rebuild + Appendix L repair + Appendix A prompts + Wave-0 install)
- [x] 03-02-PLAN.md — Persona foundation: PersonaProfile (Appendix N.1) + PersonaInjector (N.2) + UserPreferences/np_preferences

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-03-PLAN.md — Provider adapters (OpenAI/Anthropic/Gemini/Ollama/OpenAICompat) + StreamAdapter wire-family expansion + conformance fixtures
- [x] 03-04-PLAN.md — PromptCacheManager (D-59 choke-point) + PromptCacheAdapter (Appendix K) + ChunkBuffer + toolSchemas + Executor/Renderer stages + ActiveStreamState

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-05-PLAN.md — Provider routing: ProviderRegistry (D-49/50/51/52) + TierResolver (D-53/54/54a) + ProviderRouter (§1.5/§20.10 circuit breaker)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-06-PLAN.md — AgentOrchestrator (Appendix I loop, tier caps, per-stage tiers, persist seam, persona consistency)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-07-PLAN.md — Chat integration (D-44 re-point) + append-chat-turn journaled persist (D-45) + Options D-50/D-54 fields + human smoke checkpoint

### Phase 4: Agent Reliability and Evidence

**Goal:** The agent emits an explicit `AgentTurnOutcome` for every turn, with trajectory states, CompletionEvidence for non-trivial side effects, and a deterministic replan/terminal policy that never silently claims success.
**Depends on:** Phase 3.
**Requirements (from §28.2):** AGT-01 (P0) trajectory states · AGT-02 (P0) side-effect success needs CompletionEvidence · AGT-03 (P0) structured AgentTurnOutcome, cap exhaustion is `partial` · AGT-04 (P0) deterministic replan/terminal policy.
**Types:** `AgentTrajectoryState`, `CompletionEvidence`, `AgentTurnOutcome` (Appendix C.1).
**Success Criteria** (what must be TRUE):

  1. Agent trajectory transitions are asserted against the closed state machine (§28.2 AGT-01).
  2. Side-effecting tools without `CompletionEvidence` cannot render a "Done" message (AGT-02).
  3. Cap exhaustion produces `AgentTurnOutcome: partial`, never a successful state (AGT-03).
  4. Repeated identical tool failure → terminal `partial`/`failed`; abort produces `aborted` (AGT-04).

**Verification gate:** `pnpm run verify:phase-4` (§24).
**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — TRACER: canonical C.1 types + evidence seam + TrajectoryTracker + OutcomeVerifier framework + AgentTurnOutcome return contract + verify:phase-4 re-point (D-68)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Renderer completion guard wiring (D-65/AGT-02) + false-completion test

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — AGT-04 deterministic replan/terminal policy + re-scripted cap test + replan cases

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-04-PLAN.md — Abort → returned `aborted` outcome (Q1) + useChatStreaming branch + case (e) rework

### Phase 5: Context-Adaptive Execution

**Goal:** ContextOptimizer assembles a tier-appropriate `OptimizedContext` per turn with a token-counted serialized budget; minimal mode degrades instead of failing; every OptimizedContext carries a `ContextProvenanceManifest`.
**Depends on:** Phase 3 (Planner needs OptimizedContext).
**Requirements:** (no spec-native v1 IDs land in Phase 5 — infra phase).
**Success Criteria** (what must be TRUE):

  1. Tiny / small / medium / large tier tests pass (ModelContextTier resolver + TokenBudget).
  2. Context overflow degrades stepwise (never sends an oversized prompt; records `PromptTrace.truncatedSources`).
  3. Minimal mode blocks MCP chaining and LLM-Wiki RAG synthesis (§19.2).
  4. `ContextProvenanceManifest` is attached to every `OptimizedContext` (inclusion / omission / tokens / compression / cache eligibility).

**Verification gate:** `pnpm run verify:phase-5` (§24).
**Plans:** 2/2 plans complete
Plans:
**Wave 1**

- [x] 05-01-PLAN.md — TRACER: context spine — the seven §18 modules (types.ts/ModelContextTier/TokenBudget/ContextCompressor/ContextPack/ContextProvenanceManifest/ContextOptimizer) wired end-to-end through one assemble() happy path (D-69..D-77; six research open questions locked)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — §18 test files (TokenBudget/ContextCompressor/ContextOptimizer) + verify:phase-5 re-point to tests/core/context GREEN (D-78)

### Phase 6: PageContentService (Knowledge Acquisition)

**Goal:** A single panel-side PageContentService owns layered page extraction (Defuddle → Readability fallback; APC-lite structural walk); the content bundle stays extraction-only and <50 KB; ephemeral per-tab MiniSearch index powers retrieval-augmented context.
**Depends on:** Phase 5 (consumes OptimizedContext).
**Requirements:** (no spec-native v1 IDs land in Phase 6 — infra phase. ServiceNow-api strategy id is **reserved** but not registered here; Phase 17 registers it.)
**Success Criteria** (what must be TRUE):

  1. Defuddle runs in the side panel / standalone view (not the content bundle); content script only serializes a pre-stripped HTML clone with `baseUrl` + `truncated` (§26.4 / §26.6).
  2. Content-script bundle contains no React, AntD, defuddle, or yaml, and stays < 50 KB.
  3. Layered fallback (Defuddle → Readability, AX → DOM) records the source used.
  4. PageIndexBuilder builds an ephemeral per-tab MiniSearch index (chunked by heading; never persisted).
  5. SPA-nav (`wxt:locationchange`) + `tabs.onUpdated` invalidation works; passwords never captured (isPassword → value omitted).

**Verification gate:** `pnpm run verify:phase-6` (§24).
**Notes:** SPIKE-P6-01 (panel-side Detached-doc viability) → ADR-P6-01 (`.planning/adr/`).
**Plans:** 5/5 plans complete
Plans:
**Wave 1**

- [x] 06-01-PLAN.md — TRACER: extraction spine — deps install (defuddle human-verify gate) + canonical types (PageContext supersession, apcLite, strategy contract) + DefuddleStrategy/PageContentSerializer/PageContentService proven by the §18 tests (D-79..D-84/D-90/D-91; SPIKE-P6-01 evidence)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02-PLAN.md — Actionable path: AxDomWalker + ApcLiteStrategy + tests (D-80/D-86, password omission)
- [x] 06-03-PLAN.md — PageContentCache §26.4a lifecycle + cache lifecycle tests (D-87/D-88/D-89)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-04-PLAN.md — PageIndexBuilder (ephemeral MiniSearch) + content-script shells (ContentScriptHost/SPANavigationWatcher/PageContextBridge) + core.content.ts delegation (D-84/D-85/D-87; RESEARCH correction 2)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 06-05-PLAN.md — Isolation gate (no-content-script-ui) + verify:phase-6 re-point/phase-4a reconcile + ADR-P6-01 flip to Accepted (D-79/D-92)

### Phase 7: Trust-Aware Context and Receipts

**Goal:** Every ContextItem carries trust/authority metadata; retrieved data cannot redefine system/tool/permission policy; the user can inspect a context receipt.
**Depends on:** Phases 5 and 6.
**Requirements (from §28.3):** CTX-01 (P0) source trust/authority metadata · CTX-02 (P0) retrieved data is never instructions · CTX-03 (P0) ContextProvenanceManifest → context receipt · CTX-04 (P0) stable-prefix snapshot tests · CTX-05 (P1) progressive skill disclosure · CTX-06 (P1) context-quality diagnostics without raw text.
**Types:** `ContextItem`, `ContextReceiptEntry` (Appendix C.1).
**Success Criteria** (what must be TRUE):

  1. Malicious page / note / tool-output fixtures cannot alter system/tool/permission policy (CTX-02).
  2. Stable-prefix snapshot tests run in CI; a system-prompt diff blocks release (CTX-04).
  3. Prompt Inspector reconstructs packing decisions from a transaction id, including inclusion/omission, original/final tokens, compression, and cache eligibility (CTX-03).
  4. Irrelevant full skill instructions consume zero prompt tokens (CTX-05 progressive disclosure).

**Verification gate:** `pnpm run verify:phase-7` (§24).
**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 07-01-PLAN.md — TRACER: trust spine — C.1 trust types (harness.ts) + O.3 TrustPolicy (authority map + wrap + structural guard) + D-93 item pipeline in assemble + ContextReceipt derivation + prompt-injection adversarial fixtures (CTX-01/02/03, D-93..D-99)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-02-PLAN.md — CTX-04 stable-prefix golden snapshots + FNV-1a hash cross-check + CTX-06 ContextQualityMetrics aggregates (D-100/D-102)

**Wave 3** *(blocked on Wave 1-2 completion)*

- [x] 07-03-PLAN.md — CTX-05 SkillDisclosure zero-token proof + verify:phase-7 re-point to spec 3611 gate (D-101/D-103)

### Phase 8: Knowledge Base (Memory + MiniSearch + Notes)

**Goal:** Atomic notes with wikilinks, MiniSearch over notes, a MemoryEngine covering working/episodic/semantic/preference/procedural memory, and PreferenceMemoryStore (`np_persona`) where persona config lives.
**Depends on:** Phase 7 (trust-aware context governs what memory can store).
**Requirements:** RICH-R-05 (1 v1 requirement) — persona persists across sessions/surfaces, stored in PreferenceMemoryStore (`np_persona`), not the fact store (reconciliation R2).
**Knowledge model established here:** atomic notes (unit) + wikilinks (`links[]`) + tags (many-to-many) + `categoryPath` declared on Note (populated later by LLM-Wiki in Phase 9). Optional `Note.type?: string` declared here (OKF v0.2 alignment, type-only — populated/serialized in Phase 9).
**Success Criteria** (what must be TRUE):

  1. Conversation summary + recent turns are returned by MemoryEngine.
  2. User memory returns top 5 (top 3 in tiny mode); preference profile injects compact JSON incl. persona overrides (RICH-R-05).
  3. Memory retrieval scores all in [0, 1].
  4. MiniSearch < 50 ms over 1,000 notes.
  5. Wikilinks resolve with tie-break rule; end-to-end `Page → PageContentService → Note → MiniSearch` path works.

**Verification gate:** `pnpm run verify:phase-8` (§24).
**Plans:** 4/5 plans executed
Plans:
**Wave 1**

- [x] 08-01-PLAN.md — Canonical type homes + persona persistence (RICH-R-05): notes.ts canonical Note (D-107/D-108), memory/types.ts + harness WorkingMemory supersessions (D-104/D-112/D-113), PreferenceMemoryStore np_persona (RICH-R-05)

**Wave 2** *(blocked on Wave 1)*

- [x] 08-02-PLAN.md — Memory subsystem: UserMemoryStore + MemoryScorer (D-104/D-113), ConversationMemoryStore compactor seam + WriteJournal evict steps + WorkingMemory O.10 (D-104/D-106), MemoryEngine create-only producers + MemoryExtractor schema seam (D-105/D-113, RICH-R-05 DONE-when)
- [x] 08-03-PLAN.md — Notes core: LinkParser + save seam Flow-3-minus-LLM (D-110), MiniSearchIndex persistent notes index + perf gate (D-109)

**Wave 3** *(blocked on Wave 2)*

- [x] 08-04-PLAN.md — NoteGraph §22.3 cosine + BacklinksPanel/WikilinkAutocomplete/NoteGraphView core logic (D-111, UI-SPEC)
- [ ] 08-05-PLAN.md — §18 DONE-when E2E Page→Note→MiniSearch + verify:phase-8 re-point to spec 3612 (D-105/D-114)

### Phase 9: LLM-Wiki & Filesystem Sync

**Goal:** Notes are auto-tagged/categorized/summarized; "Ask notes" returns cited answers; one-way app→filesystem `.md` backup with OKF v0.2-aligned YAML frontmatter; restore preserves UUID identity and every wikilink edge.
**Depends on:** Phases 8 (notes + memory) + 6 (PageContentService) + 3 (AI runtime).
**Requirements (from §27.1, §27.2, §27.3, §27.4, §27.7a, §18 rev 2026-08-12):** CAT-01…05 · LLM-WIKI-01…11 · SYNC-01…11 · NMEM-01…03 · WIKI-ID-01…04 · OKF-WIKI-01…03 (37 v1 requirements).
**Types:** `NoteFileSync`, `NoteTagger`, `NoteQA`, `NoteChatConverter`, `NoteMaintenance` (§27.5); `notes_backup_config` IndexedDB store (SYNC-01).
**Success Criteria** (what must be TRUE):

  1. Save pipeline runs `NoteTagger.analyze()` non-blocking after the IndexedDB write; auto-tag/category/summary suggestions render with accept/reject.
  2. "Ask notes" RAG (balanced tier) returns cited answers; tiny mode falls back to plain MiniSearch.
  3. `showDirectoryPicker()` + handle persist in `notes_backup_config` (Standalone view only).
  4. Per-save `.md` sync with **OKF v0.2-aligned YAML frontmatter** (`type`/`description`/`id`/`generated`/`status`, SYNC-04) + nested folders + collision suffixing + external-change guard.
  5. Restore parser tolerates OKF keys and ignores unknown OKF fields (SYNC-09); wikilinks remain the body edge syntax (not OKF markdown-link edges — OKF-WIKI-04 boundary).
  6. NMEM-02 upserts facts only on the primary surface; v4 migration is idempotent (skip if `Note.type` already present).

**Verification gate:** `pnpm run verify:phase-9` (§24).

### Phase 10: Memory Governance and Experience Candidates

**Goal:** MemoryRecords carry source/confidence/lifecycle/sensitivity/verified-at; conflict precedence is explicit; procedural experience is gated by verification + approval; graph edges record provenance.
**Depends on:** Phases 8 and 9.
**Requirements (from §28.4):** MEM-01 (P0) working/episodic/semantic/preference/procedural taxonomy · MEM-02 (P0) source+confidence+lifecycle+sensitivity+verified-at · MEM-03 (P0) conflict precedence (correction > verified > prior > inference) · MEM-04 (P0) view/edit/pin/forget/disable/export/cloud-exclude controls · MEM-05 (P1) procedural experience gated by approval · KNW-01 (P1) edge provenance.
**Types:** `MemoryRecord`, `ProceduralExperience`, `KnowledgeEdgeSource` (Appendix C.1).
**Success Criteria** (what must be TRUE):

  1. Conflict precedence test: correction > verified > prior > inference (MEM-03).
  2. User can view, source, confidence, edit, pin, forget, type-disable, export, cloud-exclude (MEM-04).
  3. Procedural experience activates only after verification + approval (MEM-05).
  4. Notes/Memory boundary preserved: only Notes → Memory upsert direction (NMEM-02).

**Verification gate:** `pnpm run verify:phase-10` (§24).

### Phase 11: Transaction Logging and Diagnostics

**Goal:** Every provider call, every tool call, and every prompt is recorded with a redaction layer; the user can copy an operation id from Diagnostics and pull the corresponding trace.
**Depends on:** Phase 4 (evidence) + Phase 10 (memory governance).
**Requirements:** (no spec-native v1 IDs land in Phase 11 — infra phase).
**Success Criteria** (what must be TRUE):

  1. Every provider call creates transaction / prompt / provider traces.
  2. Every tool call creates a tool trace.
  3. Redaction test proves secrets (and note content and filesystem paths) are not persisted.
  4. Diagnostics panel in Options can copy operation id and pull the corresponding trace.

**Verification gate:** `pnpm run verify:phase-11` (§24).

### Phase 12: Agent Evaluation

**Goal:** Versioned golden suites cover planner, context, tools, permissions, providers, memory, RAG, completion evidence, and multimodal routing; safety/leakage/injection/false-completion/citation/isolation regressions block release.
**Depends on:** Phase 11 and available core capabilities.
**Requirements (from §28.6):** EVAL-01 (P0) versioned golden suites · EVAL-02 (P0) multi-dimension trajectory rubric · EVAL-03 (P0) deterministic validators, judges only for qualitative dims · EVAL-04 (P0) first-failing-layer diagnostics · EVAL-05 (P0) safety/leak/injection/false-completion/citation/isolation regressions block release · EVAL-06 (P1) cost/latency/quality Pareto · EVAL-07 (P1) calibrated, versioned judges.
**Types:** `FailureLayer` (Appendix C.1).
**Success Criteria** (what must be TRUE):

  1. Golden suites produce per-dimension evidence and failure-layer categorisation.
  2. Diagnostics assigns the first failing layer (EVAL-04).
  3. Safety / leakage / injection / false-completion / citation / isolation regressions block release (EVAL-05).
  4. Pareto report shows cost / latency / quality (EVAL-06); LLM judges are calibrated and versioned (EVAL-07).

**Verification gate:** `pnpm run verify:phase-12` (§24).

### Phase 13: Verified Continual Evolution

**Goal:** Trajectories create `EvolutionCandidate`s; a deterministic CandidateProposer maps a `FailureLayer` to exactly one single-layer, cost-capped proposal; raw traces cannot self-activate; activation is human-gated (sandbox → approve → scoped rollout → monitor → rollback).
**Depends on:** Phases 10 and 12.
**Requirements (from §28.7):** EVO-01 (P1) trajectories create candidates, never direct prod changes · EVO-02 (P1) one target layer per candidate · EVO-03 (P1) EvolutionCandidate stores evidence/baseline/security/version/rollback · EVO-04 (P0) untrusted content cannot update active prompts/tools/permissions/code/procedural memory · EVO-05 (P1) sandbox→approve→scoped rollout→monitor→rollback · EVO-06 (P2) agent-generated tools stay sandbox proposals.
**Candidate Proposer (from §28.7a):** PROP-01 (P1) inputs = failing evals + trace evidence only · PROP-02 (P1) one layer per proposal (deterministic `FailureLayer`→`targetLayer`) · PROP-03 (P1) evidence threshold (≥3 agreeing failures, ≥0.15 score drop) · PROP-04 (P1) per-proposal sandbox cost cap · PROP-05 (P0) proposes only, never activates · PROP-06 (P1) reproducible (suite version + op-ids + hash).
**Create:** `src/core/evolution/CandidateProposer.ts` (deterministic proposer), candidate store, sandbox runner, approval/version/rollback contracts.
**Types:** `EvolutionCandidate`, `EvolutionCandidateProposal`, `ProposerInput` (Appendix C.1).
**Worked example:** Appendix O.9.
**Success Criteria** (what must be TRUE):

  1. Raw traces cannot self-activate (PROP-05 / EVO-04).
  2. The proposer maps a failing eval to exactly one single-layer, cost-capped `proposed` candidate.
  3. A candidate can be proposed, tested, approved, scoped, and rolled back.
  4. Proposals are reproducible (suite version + op-ids + hash) — PROP-06.

**Verification gate:** `pnpm run verify:phase-13` (§24).

### Phase 14: Bounded Multi-Role Collaboration

**Goal:** A closed `CollaborationRoleRegistry`, typed `CollaborationPlan` and `AgentHandoffArtifact`, a coordinator-owned commit point, and a single-agent baseline gate that blocks collaborative workflows from shipping unless they beat the one-role default on quality / cost / latency / safety.
**Depends on:** Phases 4, 7, 12, and 13.
**Requirements (from §30.2):** COLLAB-01 (P1) explicit activation · COLLAB-02 (P1) closed role registry · COLLAB-03 (P1) CollaborationPlan caps/deadline (single-agent = one-role plan) · COLLAB-04 (P1) typed handoffs, no hidden reasoning · COLLAB-05/06 (P0) coordinator owns commits, workers no side effects · COLLAB-07 (P1) independent reviewer · COLLAB-08 (P1) contained failure/fallback · COLLAB-09/10 (P1) shared projected context + traces · COLLAB-11 (P1) single-agent baseline gate · COLLAB-12 (P2) future isolated workers · COLLAB-13 (P0) no open-ended/unbounded agents.
**Types:** `CollaborationRole`, `RolePolicy`, `CollaborationPlan`, `AgentHandoffArtifact`, `CollaborationOutcome` (Appendix C.1).
**Success Criteria** (what must be TRUE):

  1. Roles, tools, contexts, budgets, permissions, handoffs, independent review, failure fallback, and single-agent baseline gates pass.
  2. Coordinator owns sequencing, permission requests, side-effect commits, and termination (COLLAB-05).
  3. Workers cannot directly write memory/notes, execute side effects, export data, or activate evolution candidates (COLLAB-06).
  4. Single-agent baseline gate blocks collaborative workflows that fail quality/cost/latency/safety (COLLAB-11).

**Verification gate:** `pnpm run verify:phase-14` (§24).

### Phase 15: Workspace Experience (UI/UX) + RICH

**Goal:** ChatPage / AgentPage / NotesPage / OptionsPage render with Planner → Executor → Renderer and ChunkBuffer streaming; Options sub-sections (incl. Persona + Notes) are functional; RICH 60 requirements ship across sub-waves 15.3 / 15.4 / 15.5; visual surfaces match `.planning/mockup/` per DESIGN_SYSTEM §8.0 precedence rule (functional rule defers to spec; visual layout intent defers to mockup).
**Depends on:** Phase 9 (LLM-Wiki UI surfaces); Phase 14 only in the sequential 1→19 sense (its capability becomes visible in UI, not a functional build dependency per §18).
**Requirements:** REQ-F01, REQ-F02, REQ-F06, REQ-F07, REQ-F08, REQ-F09, REQ-F11, REQ-F13, REQ-F14, REQ-F15, REQ-F16, REQ-F18, REQ-F21, REQ-F22…REQ-F35 · APPR-01…06 · NOTES-COL-01…03 · RICH-R-03/04/06/07/08/11 · RICH-I-01…I-14 · RICH-C-01…C-15 · RICH-H-01…H-20 (excludes H-07 — v0.2) — 90 v1 requirements.
**Sub-waves (preserved from spec §18):**

- **Phase 15.1 — Core screens:** Chat/Agent/Notes/Options render with Planner→Executor→Renderer, ChunkBuffer streaming, /write /ask presets, note wikilinks, Options forms, Diagnostics.
- **Phase 15.2 — LLM-Wiki UI surfacing:** NotesPage "Ask notes" bar, category tree toggle, summary lines, orphan badges, AI-search toggle, backup status Tag, SaveToNoteDialog.
- **Phase 15.3 — RICH Core (17 P0):** RICH-R-01/02/11, RICH-H-01, RICH-I-01/05/06, RICH-C-01/02/03/04, RICH-C-05/06/07/08, RICH-H-04 (clipboard-only insert), RICH-H-08. *(persona runtime seeds already in Phase 3.)*
- **Phase 15.4 — RICH Enhance (22 P1):** RICH-R-03/06/08, RICH-I-02/03/08/09/10, RICH-C-09/12/13/14, RICH-H-02/03/05/06/11/12/16. _(Runtime for RICH-R-09/R-10 lands in Phase 3 and RICH-R-05 persona persistence in Phase 8 — see REQUIREMENTS §Traceability; 15.4 only surfaces/uses them, it does not re-implement them.)_
- **Phase 15.5 — RICH Polish (21 P2):** all remaining P2 items (RICH-H-07 remains deferred, R1).

**Success Criteria** (what must be TRUE):

  1. Both surfaces use Planner → Executor → Renderer; ChunkBuffer streaming.
  2. /write and /ask presets work.
  3. Note wikilinks resolve with tie-break rule (Standalone view Notes page).
  4. Options page shows all sub-sections (incl. Persona + Notes) with functional forms.
  5. RICH P0 (15.3) complete: persona header, welcome cards, quick-action chips, clarification + follow-up chips (max 2 rounds; graceful timeout), code-block Copy/Save-as-macro (Insert = clipboard-only), streaming stage indicators.
  6. **Visual acceptance (rev 2026-08-12):** delivered Side Panel, Standalone chat, Notes 4-column workspace, and Options/provider-modal surfaces match annotated mockups in `.planning/mockup/` (indexed in **DESIGN_SYSTEM §8.0**), within the precedence rule. Exact metrics: Side Panel width 400 / header 52 / composer 44 / input 60 / status 28 px (§8.1); Standalone Sider 240/72 px + Add-ons group (§8.2); Notes four column toggles with persistent Content + bottom status bar (§8.3); chat-history bottom sheet ≤ ~70% vs right drawer 320 px (§8.4/§8.5); Options menu General·Notes·Advance (§8.6); provider dialog 6-column model table (§8.7); message action sets 6/8/4 (§8.8).

**Verification gate:** `pnpm run verify:phase-15` (§24).
**UI hint**: yes.

### Phase 16: Multimodal Input Foundation

**Goal:** Image paste/upload and voice transcription become normalized observations consumed by the existing ContextOptimizer; `MULTIMODAL_MODEL_UNAVAILABLE` surfaces gracefully when no compatible model is configured; APC-lite does **not** authorise computer use.
**Depends on:** Phase 15 and Phase 7.
**Requirements (from §29.2):** MM-01 (P1) ModalityInput (no inline binary) · MM-02 (P1) ModalityObservation with confidence/sensitivity · MM-03 (P1) image paste/upload via vision model · MM-04 (P1) voice → editable Sender, explicit send · MM-06 (P1) AbortSignal across transcribe/plan/tool/render · MM-07 (P0 boundary) APC-lite ≠ browser automation.
**Types:** `ModalityInput`, `ModalityObservation` (Appendix C.1).
**Visual reference:** `.planning/mockup/00-sidepanel-chat.png` composer annotations (DESIGN_SYSTEM §8.0); composer **Attach** per §8.1.
**Success Criteria** (what must be TRUE):

  1. Image and audio inputs become redacted ContextItems (TraceRedactor applied).
  2. Unsupported providers fail safely with `MULTIMODAL_MODEL_UNAVAILABLE` + settings action.
  3. Interruption propagates AbortSignal across transcription, planning, tools, rendering.
  4. No raw image/audio persistence in traces; modality blobs are operation-scoped unless explicitly saved.

**Verification gate:** `pnpm run verify:phase-16` (§24).
**UI hint**: yes.

### Phase 17: Add-ons and Content Script Runtime (Extraction-Only)

**Goal:** ServiceNow / Write / TeamGQM add-ons render in Side Panel (and Standalone view for TeamGQM); Selection → Ask AI (promoted P1 → P0) opens Side Panel with selection prefilled; /research runs via ResearchSkill; content-script bundle stays extraction-only with no host-page UI.
**Depends on:** Phase 16 (multimodal input available to add-ons) + Phase 6 (PageContentService consumed by add-ons). _(Sequential 1→19 order only; /research uses MCPClient per §9.8, not the collaboration coordinator — no functional Phase-14 dependency.)_
**Requirements:** REQ-F03, REQ-F04, REQ-F10, REQ-F17 · REQ-F36…REQ-F54 (23 v1 requirements) — Side Panel Write add-on page, Side Panel TeamGQM add-on page, Selection → Ask AI (P0), Standalone TeamGQM add-on full-page, Write add-on page + Skills (DraftSkill/RewriteSkill/SummarizeSkill/CustomerUpdateSkill) + Input source + Output, TeamGQM Side Panel page + Standalone page + Skill + Settings, ServiceNow JSESSIONID / sysparmCK / case context extraction + Table API client + CaseAnalyzerSkill / CatchUpSkill / SentimentSkill / CodeSearchSkill + Side-panel page + Full-app page, ResearchSkill global tool.
**Success Criteria** (what must be TRUE):

  1. Content-script bundle contains no React, no AntD, no UI code (isolation grep passes).
  2. ServiceNow add-on uses ServiceNowSessionAdapter; ServiceNow API calls use `PROXY_FETCH` only.
  3. Right-click selection → "Ask AI" opens Side Panel with selection prefilled.
  4. /research runs via ResearchSkill (graceful failure on no MCP web-search).
  5. Write add-on renders in Side Panel with all quick actions; TeamGQM add-on renders in Side Panel and Standalone view.
  6. Add-ons can consume PageContentService + Memory + Notes + LLM-Wiki.

**Verification gate:** `pnpm run verify:phase-17` (§24).
**UI hint**: yes.

### Phase 18: Tool Governance and Active Discovery

**Goal:** Every tool has a `ToolCapabilityManifest`; risky / side-effecting tools require confirmation; idempotency prevents duplicate writes; active discovery stays within token budget.
**Depends on:** Phase 17 and Phase 4.
**Requirements (from §28.5):** TOL-01 (P0) ToolCapabilityManifest (category/risk/side-effect/perms/scopes/timeout/cost/idempotency/verifier/hashes) · TOL-02 (P0) risk- & side-effect-based permission policy · TOL-03 (P0) postcondition verification · TOL-04 (P0) validate/redact/size-limit/shape/attribute results · TOL-05 (P0) idempotent write replay-safety · TOL-06 (P1) active discovery over tools budget.
**Types:** `ToolCapabilityManifest` (Appendix C.1).
**Success Criteria** (what must be TRUE):

  1. Manifests are complete for every registered tool (TOL-01).
  2. Risky writes require confirmation (TOL-02).
  3. Postcondition verification runs after every side-effecting tool (TOL-03).
  4. Tool results are validated, redacted, size-limited, shaped, attributed (TOL-04).
  5. Duplicate writes are prevented (idempotency replay-safety, TOL-05).
  6. Active discovery stays within the tools token budget (TOL-06).

**Verification gate:** `pnpm run verify:phase-18` (§24).

### Phase 19: Hardening and Release

**Goal:** Release-grade verification passes; performance budgets met; CWS review-readiness (permission audit, privacy policy, secrets scan, red-team corpus); CWS v1 publish API shutdown 2026-10-15 → use `wxt submit init` v2 flow.
**Depends on:** Phase 18 (all earlier phases).
**Requirements:** (no new v1 requirements — verification only).
**Success Criteria** (what must be TRUE):

  1. `pnpm run verify:all` passes; `pnpm run test:perf` passes; `pnpm run test:isolation` passes.
  2. Performance: content script bundle < 50 KB (extraction-only); Side panel initial paint < 300 ms; Standalone view initial paint < 500 ms; first token < 2 s local / < 3 s cloud.
  3. Filesystem restore round-trips a full vault; RAG returns correct citations on a fixture note set.
  4. Every inserted sub-phase verification command passes.
  5. Prompt-injection, secret-leakage, false-completion, permission, and memory-isolation regressions block release.
  6. Multimodal privacy and provider-routing fixtures pass.
  7. Evolution candidate activation and rollback drills pass.
  8. Release records include evaluation-suite and rubric versions.

**Verification gate:** `pnpm run verify:all` + `pnpm run test:perf` + `pnpm run test:isolation` (§24).

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. MV3/WXT Runtime + AntD Shells + Workspace Handoff | 8/8 | Complete    | 2026-08-22 |
| 2. Storage, Security, WriteJournal, Workspace Persistence | 9/9 | Complete    | 2026-08-24 |
| 3. Cost-Effective AI Runtime (+ Persona seed) | 7/7 | Complete    | 2026-08-29 |
| 4. Agent Reliability and Evidence | 4/4 | Complete    | 2026-08-29 |
| 5. Context-Adaptive Execution | 2/2 | Complete    | 2026-08-29 |
| 6. PageContentService (Knowledge Acquisition) | 5/5 | Complete    | 2026-08-30 |
| 7. Trust-Aware Context and Receipts | 3/3 | Complete    | 2026-08-30 |
| 8. Knowledge Base (Memory + MiniSearch + Notes) | 4/5 | In Progress|  |
| 9. LLM-Wiki & Filesystem Sync | 0/4 | Not started | — |
| 10. Memory Governance and Experience Candidates | 0/2 | Not started | — |
| 11. Transaction Logging and Diagnostics | 0/2 | Not started | — |
| 12. Agent Evaluation | 0/3 | Not started | — |
| 13. Verified Continual Evolution | 0/3 | Not started | — |
| 14. Bounded Multi-Role Collaboration | 0/3 | Not started | — |
| 15. Workspace Experience (UI/UX) + RICH | 0/5 | Not started | — |
| 16. Multimodal Input Foundation | 0/2 | Not started | — |
| 17. Add-ons and Content Script Runtime (Extraction-Only) | 0/4 | Not started | — |
| 18. Tool Governance and Active Discovery | 0/3 | Not started | — |
| 19. Hardening and Release | 0/3 | Not started | — |

---

## Coverage

- **Phases:** 19 (1 → 19, canonical spec §18 order).
- **v1 requirements:** 220 (see `.planning/REQUIREMENTS.md` §Traceability; includes OKF-WIKI-04 / EVO-06 / COLLAB-12 / MM-07 as active v0.1 boundaries counted in Phases 9/13/14/16).
- **Mapped:** 220 / 220 → **Coverage 100%**.
- **Sub-waves preserved:** Phase 15.1 / 15.2 / 15.3 / 15.4 / 15.5 (per spec §18).
- **§18 "Requirements (from §28.X)" lines reused verbatim** for phases 4, 7, 10, 12, 13, 14, 16, 18.
- **Verification gates:** `pnpm run verify:phase-1` … `verify:phase-19` (per §24); Phase 19 also `verify:all`, `test:perf`, `test:isolation`.
- **UI phases (annotated):** Phase 15, Phase 16, Phase 17 (with `**UI hint**: yes` per spec §18 UI detection keywords).

---

*Last updated: 2026-08-19 after initialization*
