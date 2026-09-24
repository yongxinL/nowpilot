# Roadmap: NowPilot

## Overview

NowPilot v0.2 ships as a Chrome MV3 extension built in 19 phases. The sequence is **operator-locked to PRODUCT_SPEC §18** (the sole authoritative implementation sequence): it follows the product data-flow of *acquire → store → understand → display → extend → harden*, with governance and reliability sub-phases placed immediately after the capability they extend. Every phase ends green via its own `pnpm run verify:phase-N` script (§24) — the developer-facing success metric — and the §22 performance targets are gated at Phase 19.

> **Structure note:** the phase structure below is mandated by PRODUCT_SPEC §18 (names and order). It is intentionally not compressed by the default granularity setting; any change requires `/gsd-phase` plus operator approval. The current `package.json` carries a pre-§18 `verify:phase-N` numbering (incl. `phase-4a`/`phase-5a`); §24's mapping is authoritative and is realigned as each phase lands.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: MV3/WXT Runtime + AntD Shells + Workspace** - Extension boots: both surfaces, shared workspace handoff, theme, messaging and shell contracts. (completed 2026-09-23)
- [x] **Phase 2: Storage, Security, WriteJournal, Workspace Persistence** - Durable encrypted storage with journaled writes, migrations and workspace persistence. (completed 2026-09-24)
- [ ] **Phase 3: Cost-Effective AI Runtime (+ Persona seed)** - Planner → Executor → Renderer pipeline on four providers, with tiering, caching, routing and persona injection.
- [ ] **Phase 4: Agent Reliability and Evidence** - Trajectory states, completion evidence and deterministic terminal policy; no false completion.
- [ ] **Phase 5: Context-Adaptive Execution** - Model-context tiers, token budgets, ContextOptimizer degradation and provenance.
- [ ] **Phase 6: PageContentService (Knowledge Acquisition)** - Layered, private page extraction with an ephemeral per-tab index; content bundle stays <50 KB.
- [ ] **Phase 7: Trust-Aware Context and Receipts** - Source trust metadata, injection defences, context receipts and stable-prefix snapshots.
- [ ] **Phase 8: Knowledge Base (Memory + MiniSearch + Notes)** - Memory engine, MiniSearch index, atomic notes and the wikilink graph.
- [ ] **Phase 9: LLM-Wiki & Filesystem Sync** - LLM enrichment, RAG Q&A, note conversion, OKF-aligned one-way .md sync and restore.
- [ ] **Phase 10: Memory Governance and Experience Candidates** - Memory taxonomy, conflict resolution, user controls and provenance.
- [ ] **Phase 11: Transaction Logging and Diagnostics** - Traceability, redaction and the Diagnostics surface.
- [ ] **Phase 12: Agent Evaluation** - Versioned golden suites, trajectory rubrics and first-failing-layer diagnostics.
- [ ] **Phase 13: Verified Continual Evolution** - Human-verified candidates: propose, sandbox, approve, scoped rollout, rollback.
- [ ] **Phase 14: Bounded Multi-Role Collaboration** - Coordinator-owned bounded collaboration with typed handoffs and independent review.
- [ ] **Phase 15: Workspace Experience (UI/UX) + RICH** - Full surfaces, Options, Notes workspace, workflow routing and RICH waves on the design system.
- [ ] **Phase 16: Multimodal Input Foundation** - Image paste/upload and voice → editable Sender with redacted context and abort.
- [ ] **Phase 17: Add-ons and Content Script Runtime (Extraction-Only)** - Write, TeamGQM, ServiceNow add-ons; extraction-only content scripts; Selection → Ask AI.
- [ ] **Phase 18: Tool Governance and Active Discovery** - Tool manifests, permission policy, postcondition verification and idempotent writes.
- [ ] **Phase 19: Hardening and Release** - Full-suite green, performance targets, regression gates and release evidence.

## Phase Details

### Phase 1: MV3/WXT Runtime + AntD Shells + Workspace

**Goal**: The extension boots on MV3/WXT with both surfaces (Chat-only Side Panel; Standalone workspace), the shared workspace handoff, theme store, messaging/eventing and shell contracts in place.
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, SP-02, SP-08, SP-09, SA-08, SA-09, SA-10, APPR-03, APPR-04, APPR-05, FLOW-8, FLOW-9, FLOW-10, FLOW-11
**Success Criteria** (what must be TRUE):

  1. Side panel opens; onboarding appears on fresh install; the Cmd+K palette opens with the Flow 10 command set on both surfaces.
  2. Standalone view opens from the Side Panel with correct workspace handoff, and re-opening focuses the existing tab (no duplicates).
  3. A theme change (single `np_theme` source) applies to both surfaces immediately without reload; density is fixed per surface (Side Panel compact, Standalone default).
  4. Background router registers listeners synchronously; RuntimeEnvelope fixtures parse; EventBus/WorkspaceStore/WorkspaceRouter/ThemeStore suites pass.
  5. `pnpm run verify:phase-1` passes and banned-import greps are zero (`innerHTML`/`dangerouslySetInnerHTML`; `tailwind`/`shadcn`/`@radix-ui`; `framer-motion`).

**Plans**: 13/13 plans executed
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Freeze the D-04 file-level migration inventory and its D-16 page dispositions

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — TRACER: WXT `srcDir` move + both surfaces render through WXT with one provider each + gate re-pointing
- [x] 01-04-PLAN.md — Canonical Phase-1 string map and the `format()` helper

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Generated-manifest inspection gate + content-script injection-scope decision
- [x] 01-05-PLAN.md — Single-source `np_theme` + `getAntdConfig` + Toggle theme cycle
- [x] 01-06-PLAN.md — Canonical `MessageType` registry, envelope payload validation, sender guard
- [x] 01-07-PLAN.md — Frozen `WorkspaceState` + ready/transfer/ack handoff + validated URL bootstrap
- [x] 01-09-PLAN.md — Typed provider ports, fixture adapter, shared onboarding shell, onboarding state

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-08-PLAN.md — `KeymapRegistry` repair, Phase-1 command set, palette contract
- [x] 01-10-PLAN.md — Legacy plaintext credential cleanup (one-way; operator decision gate)
- [x] 01-12-PLAN.md — `DeferredNotice` + `data-np-backing` convention + per-page D-16 dispositions

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-11-PLAN.md — Credential-free schemas, prototype host retirement, dev-shell removal, WXT scripts

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-13-PLAN.md — Banned-import gate, `verify:phase-1` composition, real-Chrome evidence

**UI hint**: yes

### Phase 2: Storage, Security, WriteJournal, Workspace Persistence

**Goal**: Durable, encrypted, crash-safe storage foundation — keys encrypted, message bodies only in IndexedDB, migrations idempotent, writes journaled, workspace persistent across reloads and surfaces.
**Depends on**: Phase 1
**Requirements**: CORE-02
**Success Criteria** (what must be TRUE):

  1. WriteJournal recovery test passes — an interrupted write recovers to a consistent state.
  2. API key encryption round-trip passes (AES-GCM per §15.2); no message body appears in `chrome.storage.local`.
  3. Migration v1→v2 fixture passes; IndexedDB writes use single transactions for consistent stores.
  4. Workspace state persists across page reload and cross-surface handoff; `pnpm run verify:phase-2` passes.

**Deferred verification (WINDOWS #5, #8)**: the Phase-1 Real-Chrome frontend observations are formally deferred (operator, 2026-09-23) — Phase 2 may proceed, but Phase 2 plans MUST include automated contract/integration coverage for the handoff contract (#5) and the onboarding contract/security invariants (#8). Final Real-Chrome closure belongs to the Phase 15 consolidated acceptance cycle; the Phase 19 release gate must fail while any deferred verification remains open. See `.planning/STATE.md` § Verification Deferrals.
**Plans**: 14/14 plans executed + 1 gap-closure plan (02-14)
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Wave 0: `idb` + `fake-indexeddb`, test-setup seams (IndexedDB reset, session area, onChanged), `unlimitedStorage` with its manifest gate

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Storage spine (TRACER): `np_db` + migrator + `ChatHistoryDB` + `WriteJournal` in one journaled write/read-back path
- [x] 02-03-PLAN.md — Credential vault crypto core: `EncryptedStorage`, `KeyVault`, `redactSensitive`

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-04-PLAN.md — `CredentialStorePort` contract + `Setting.ts` install secret (read-back-verified)
- [x] 02-05-PLAN.md — `ErrorStore` + legacy chat migration (7 stages, sanitisation, D2-15 case table)
- [x] 02-06-PLAN.md — `WorkspacePersistence` + `WriterElection` (CAS, heartbeat, stale-writer rejection)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-07-PLAN.md — Election-backed writer state, `MirrorBanner` activation, onboarding single controller, string map
- [x] 02-08-PLAN.md — `np_store` v3 cutover + asynchronous hydration (one-way, D2-17, operator-locked)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-09-PLAN.md — Hydration states in the conversation region + `MirrorBanner` mount and refocus path

**Wave 6** *(blocked on Wave 5 / Wave 3 completion)*

- [x] 02-10-PLAN.md — Surface wiring: startup sequence, pinned AntD notice config, three persistent notices, capability notice
- [x] 02-11-PLAN.md — Two-surface harness + Suite A (WINDOWS #5 handoff contract)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 02-12-PLAN.md — Suite B (WINDOWS #8 onboarding contract) + D2-35 traceability records (windows stay open)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 02-13-PLAN.md — Corrected `verify:phase-2` (explicit suites + path preflight) and the full phase gate evidence

**Wave 9** *(gap closure — blocked on Wave 8 completion)*

- [x] 02-14-PLAN.md — Gap closure: replace the over-broad Phase-1 substring rule with the credential-boundary gate, correct the stale verification claims, keep WINDOWS #25 open, and re-run both phase gates from one code state

**UI hint**: yes

### Phase 3: Cost-Effective AI Runtime (+ Persona seed)

**Goal**: The Planner → Executor → Renderer pipeline runs on the four providers with tier resolution, routing/fallback/circuit breaker, prompt caching, structured-output repair — and persona is injected from day one.
**Depends on**: Phase 2
**Requirements**: CORE-03
**Success Criteria** (what must be TRUE):

  1. Planner returns exactly one Zod-valid decision with a closed `toolName` enum; malformed JSON is repaired once; `planner_failed` fallback after two failures.
  2. Executor rejects unknown tools and validates input/output schemas; Renderer respects output caps and never invents tool results.
  3. Provider routing fallback + circuit-breaker tests pass; the provider never switches after `hasStreamedFirstToken`; retry layers never nest.
  4. Structured-output one-shot repair works; the streaming path produces a first token in fixture tests.
  5. PersonaInjector prepends a byte-stable persona block inside the cached `[SYSTEM]` section for Planner/Executor/Renderer/MemoryExtractor; `personaOverrides` apply without a code change; `pnpm run verify:phase-3` passes.

**Inherited constraints (from Phase 2 D2-26/D2-29)**: `src/core/http/Requester.ts` and `src/core/utils/RateLimiter.ts` are Phase 3-owned under requirement `CORE-03`; the Phase 3 requirement/plan/task mapping must carry them together with D2-27's constraints (AbortController-based cancellation and timeout, no generic retries, per-provider limiter, no module-level mutable singleton). PRODUCT_SPEC §18's Phase 2 Create list is stale pending the documentation follow-up owned by `Phase 3 planner` — the canonical Product Specification is not edited in Phase 2.
**Inherited constraints (from Phase 2 D2-05)**: Phase 3 wires both approved credential-entry surfaces (onboarding and Options provider configuration) with this contract — transient credential input → real provider validation through the approved `Requester` and `ProviderRouter` → validation success → storage through the Phase 2 `CredentialStorePort` → transient input cleared → provider metadata records configured/validated state without the secret. On validation failure the credential is not persisted, a redacted canonical error is returned, and the provider is not marked ready.

**Plans**: TBD

### Phase 4: Agent Reliability and Evidence

**Goal**: Agent turns are verifiable — trajectory states, completion evidence, structured outcomes and deterministic replan/terminal policy; no success without evidence.
**Depends on**: Phase 3
**Requirements**: AGT-01, AGT-02, AGT-03, AGT-04
**Success Criteria** (what must be TRUE):

  1. Trajectory state transitions are deterministic and test-covered.
  2. Side-effect success requires CompletionEvidence; false completion is rejected by the renderer completion guard.
  3. Cap exhaustion yields `AgentTurnOutcome` = `partial` — never silent success.
  4. Abort, replan and terminal-policy tests pass; `pnpm run verify:phase-4` passes.

**Plans**: TBD

### Phase 5: Context-Adaptive Execution

**Goal**: Every request is packed to its model's context tier — budgets enforced, overflow degraded stepwise, minimal mode honoured, provenance recorded.
**Depends on**: Phase 4 (canonical order)
**Requirements**: CORE-04
**Success Criteria** (what must be TRUE):

  1. Tiny/small/medium/large classification and per-tier budget distribution tests pass.
  2. Context overflow degrades stepwise (drop debug → … → typed CONTEXT_TOO_LARGE) instead of failing; truncated sources are recorded.
  3. Minimal mode blocks MCP chaining, multi-step agent, CodeSearchSkill and LLM-Wiki RAG synthesis.
  4. Every OptimizedContext carries a ContextProvenanceManifest; `pnpm run verify:phase-5` passes.

**Plans**: TBD

### Phase 6: PageContentService (Knowledge Acquisition)

**Goal**: The current page becomes clean, private, indexed context — layered extraction runs panel-side, the content script only serializes HTML, and the content bundle stays extraction-only.
**Depends on**: Phase 5
**Requirements**: CORE-05
**Success Criteria** (what must be TRUE):

  1. Defuddle runs in the side panel/standalone view (not the content bundle); the content script sends only a stripped HTML clone + base URL.
  2. The content-script bundle contains no React, AntD, defuddle or yaml and stays <50 KB.
  3. Layered fallback records the source used (Defuddle → Readability; AX → DOM); failures are typed CONTENT_EXTRACT_FAILED — never silent empty.
  4. PageIndexBuilder builds an ephemeral per-tab MiniSearch index (never persisted); SPA-nav + `tabs.onUpdated` invalidation works.
  5. Passwords are never captured (`isPassword` ⇒ value omitted); `pnpm run verify:phase-6` passes.

**Plans**: TBD

### Phase 7: Trust-Aware Context and Receipts

**Goal**: Context is trustworthy by construction — source authority metadata, injection defences, receipts that explain packing, and stable prompt prefixes.
**Depends on**: Phases 5 and 6
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05, CTX-06
**Success Criteria** (what must be TRUE):

  1. Malicious page, note and tool fixtures cannot alter policy (retrieved data is never treated as instructions).
  2. The context receipt reconstructs packing decisions from the ContextProvenanceManifest; the Prompt Inspector shows the reconstruction.
  3. Stable-prefix snapshot tests pass; progressive skill disclosure respects the context budget.
  4. Context-quality diagnostics expose no raw text; `pnpm run verify:phase-7` passes.

**Plans**: TBD

### Phase 8: Knowledge Base (Memory + MiniSearch + Notes)

**Goal**: The knowledge core exists — three-layer memory with budgets, a MiniSearch index, atomic notes with an immutable-ID wikilink graph, and `categoryPath`/`Note.type` declared for Phase 9.
**Depends on**: Phase 7
**Requirements**: CORE-08, WIKI-ID-01, WIKI-ID-02, WIKI-ID-03, WIKI-ID-04
**Success Criteria** (what must be TRUE):

  1. Conversation summary + recent turns are retrieved; user memory returns top-5 only (top-3 in tiny mode); all retrieval scores are in [0, 1].
  2. The preference profile injects compact JSON (incl. persona overrides); working memory stays ≤300 tokens under single-writer control.
  3. MiniSearch answers in <50 ms over 1,000 notes; wikilinks resolve with the tie-break rule; unresolved-link reconciliation is bounded and never blocks a save.
  4. End-to-end `Page → PageContentService → Note → MiniSearch` works; `Note.type?: string` is declared in `src/types/notes.ts` and type-checks (declaration only).
  5. `pnpm run verify:phase-8` passes.

**Plans**: TBD

### Phase 9: LLM-Wiki & Filesystem Sync

**Goal**: Notes become intelligent and durable — non-blocking LLM enrichment with confidence gating, cited RAG Q&A, chat→note conversion, and OKF-compatible one-way `.md` sync with safe restore.
**Depends on**: Phase 8
**Requirements**: CAT-01…CAT-05, LLM-WIKI-01…LLM-WIKI-11, SYNC-01…SYNC-11, NMEM-01…NMEM-03, OKF-WIKI-01…OKF-WIKI-04, OPT-13, FLOW-3, FLOW-12, FLOW-13, FLOW-14, FLOW-15
**Success Criteria** (what must be TRUE):

  1. The save pipeline runs NoteTagger.analyze() non-blocking; suggestions render accept/reject with confidence gating (threshold 0.60; ≤3 facts / ≤5 tags); NMEM-02 upserts facts on the primary surface only.
  2. "Ask notes" RAG returns cited answers (balanced tier); tiny mode falls back to plain MiniSearch; `RAG_NO_RESULTS` makes no LLM call.
  3. Save-to-note conversion opens a pre-filled editor and the user remains the gatekeeper; chat/page → note conversion works end to end.
  4. Backup folder + per-save `.md` sync emit OKF-aligned frontmatter (`type`/`description`/`id`/`generated`/`status`) with nested folders, collision suffixing and the external-change guard; restore preview + additive upsert tolerate OKF keys and never delete local notes; delete-on-sync cleans empty folders.
  5. The v4 migration is idempotent (`Note.type` skipped when present); a write→restore round-trip preserves the UUID `id` and every wikilink edge; `pnpm run verify:phase-9` passes.

**Plans**: TBD

### Phase 10: Memory Governance and Experience Candidates

**Goal**: Memory is governed — typed records with lifecycle/sensitivity, deterministic conflict resolution, user controls, and procedural experience gated behind approval.
**Depends on**: Phases 8 and 9
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, KNW-01
**Success Criteria** (what must be TRUE):

  1. The five-layer taxonomy is enforced with source, confidence, lifecycle, sensitivity and verified-at on every record.
  2. Conflict precedence (correction > verified > prior > inference) resolves fixtures correctly.
  3. User controls work (view/edit/pin/forget/disable/export/cloud-exclude); procedural experience cannot activate without approval.
  4. Edge provenance is recorded; the Notes → Memory boundary holds (never reverse); `pnpm run verify:phase-10` passes.

**Plans**: TBD

### Phase 11: Transaction Logging and Diagnostics

**Goal**: Every AI/MCP/tool operation is traceable and safely inspectable — traces, redaction and the Diagnostics surface.
**Depends on**: Phase 10
**Requirements**: CORE-06, OPT-08, SP-10
**Success Criteria** (what must be TRUE):

  1. Every provider call creates transaction + prompt + provider traces; every tool call creates a tool trace with its permission decision.
  2. Redaction tests prove secrets, note content and filesystem paths are never persisted or exported.
  3. The Diagnostics panel (Standalone → Options → Diagnostics) can copy an operation ID; retention windows are enforced (200 txns/14 days metadata; 50 traces/72 h debug).
  4. Side Panel errors surface as toasts with an "Open Diagnostics" link; `pnpm run verify:phase-11` passes.

**Plans**: TBD
**UI hint**: yes

### Phase 12: Agent Evaluation

**Goal**: Quality is measurable — versioned golden suites, trajectory rubrics, deterministic validators and first-failing-layer diagnostics.
**Depends on**: Phase 11 (and available core capabilities)
**Requirements**: EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-06, EVAL-07
**Success Criteria** (what must be TRUE):

  1. Versioned golden suites produce per-dimension trajectory evidence.
  2. Deterministic validators run first; judges apply only to qualitative dimensions (calibrated, versioned).
  3. Failure-layer categorisation identifies the first failing layer.
  4. Safety/leak/injection/false-completion/citation/isolation regressions block release; cost/latency/quality Pareto is reported; `pnpm run verify:phase-12` passes.

**Plans**: TBD

### Phase 13: Verified Continual Evolution

**Goal**: The system can improve itself only through evidence and human approval — candidates are proposed, sandboxed, approved, rolled out scoped and rolled back.
**Depends on**: Phases 10 and 12
**Requirements**: EVO-01, EVO-02, EVO-03, EVO-04, EVO-05, EVO-06, PROP-01, PROP-02, PROP-03, PROP-04, PROP-05, PROP-06
**Success Criteria** (what must be TRUE):

  1. Raw traces cannot self-activate anything; untrusted content cannot update active prompts/tools/permissions/code/procedural memory.
  2. CandidateProposer maps a failing eval to exactly one single-layer, cost-capped `proposed` candidate (threshold ≥3 agreeing failures, ≥0.15 score drop; 50,000-token sandbox cap).
  3. Proposals are reproducible (suite version + op-ids + content hash); agent-generated tools stay sandbox proposals.
  4. The full drill passes — propose → sandbox test → human approve → scoped rollout → monitor → rollback; `pnpm run verify:phase-13` passes.

**Plans**: TBD

### Phase 14: Bounded Multi-Role Collaboration

**Goal**: Multi-role work is bounded and coordinator-owned — closed registry, typed handoffs, independent review and contained failures; single-agent remains the baseline.
**Depends on**: Phases 4, 7, 12, and 13
**Requirements**: COLLAB-01…COLLAB-13
**Success Criteria** (what must be TRUE):

  1. Roles, tools, contexts, budgets, permissions and typed handoffs enforce the CollaborationPlan caps/deadline (single-agent = one-role plan).
  2. The coordinator owns commits and permissions; workers have no side effects; no open-ended/unbounded agents or peer-granted permissions.
  3. Independent review and contained failure/fallback work; shared projected context and collaboration traces are recorded.
  4. The single-agent baseline gate passes; `pnpm run verify:phase-14` passes.

**Plans**: TBD

### Phase 15: Workspace Experience (UI/UX) + RICH

**Goal**: The capabilities of Phases 3–9 become polished, design-system-conformant surfaces on both surfaces — plus the RICH interaction waves and the full Options/Notes workspaces.
**Depends on**: Phase 14 (canonical order; exposes capabilities from Phases 3–9)
**Requirements**: CORE-07, SP-01, SP-03, SP-04, SP-05, SA-01, SA-02, SA-03, SA-05, SA-07, OPT-01…OPT-07, OPT-10, OPT-12, OPT-14, WF-01…WF-07, RICH-P0, RICH-P1, RICH-P2, APPR-01, APPR-02, APPR-06, NOTES-COL-01…NOTES-COL-03, FLOW-1, FLOW-1a, FLOW-5, FLOW-16, FLOW-17, FLOW-18, FLOW-19
**Success Criteria** (what must be TRUE):

  1. Both surfaces run chat/agent through Planner→Executor→Renderer with ChunkBuffer streaming; /write and /ask presets work; the Side Panel is Chat-only per DEC-OP-01/02 (no nav rail; composer = workflow selector · Attach · Chat history · New chat; no snip).
  2. The Standalone Sider matches DEC-OP-03 (Chat · Agent · Note · Write · Tools + Add-ons + Settings); Notes renders the 4-column workspace with persistent Content; message action sets are 7/8/4 per DEC-OP-04; Options menu General · Notes · Advance with functional sections incl. Persona, Notes and Workflow routing validation.
  3. Visual acceptance: delivered surfaces match the annotated references in `.planning/design/references/` with exact metrics — Side Panel 400/52/44/60/28 px; Sider 240/72 px; history sheet ≤~70% vs drawer 320 px; provider dialog 6-column model table; display mode + theme packs apply live on both surfaces.
  4. RICH P0 (17) and P1 (22) complete; P2 (21) complete except deferred RICH-H-07; persona header, welcome/quick-action/clarification/follow-up chips (max 2 rounds, graceful timeout), stage indicators and code-block Copy/Save-as-macro (Insert = clipboard-only) verified.
  5. `pnpm run verify:phase-15` passes.

**Deferred verification (WINDOWS #5, #7, #8)**: consolidated Real-Chrome frontend acceptance cycle carried from Phase 01 — onboarding at the 400 px Side Panel width (#7), cross-surface handoff (#5), two-live-surface onboarding (#8), plus final workflow and command-palette behaviour, responsive surfaces, final error and recovery states, keyboard and focus behaviour, accessibility, theme consistency, and final fixture/deferred-state removal or labelling. Each closure needs a screenshot plus a written observed-result record. Must close before the v0.2 release gate (Phase 19). See `.planning/STATE.md` § Verification Deferrals.
**Plans**: TBD
**UI hint**: yes

### Phase 16: Multimodal Input Foundation

**Goal**: Images and voice enter the pipeline safely — redacted modality inputs, provider capability gates, editable voice transcripts and abort throughout.
**Depends on**: Phase 15 and Phase 7
**Requirements**: MM-01…MM-07
**Success Criteria** (what must be TRUE):

  1. Image and audio inputs become redacted ContextItems — no inline binary in prompts.
  2. Image paste/upload routes via a vision-capable model; unsupported providers fail safely with typed errors.
  3. Voice transcription produces an editable Sender with explicit send — no tool execution from partial transcription.
  4. AbortSignal propagates across transcribe/plan/tool/render; `pnpm run verify:phase-16` passes.

**Plans**: TBD
**UI hint**: yes

### Phase 17: Add-ons and Content Script Runtime (Extraction-Only)

**Goal**: The add-on platform ships — Write, TeamGQM and ServiceNow as Standalone surfaces with chat-safe Side Panel entry actions, extraction-only content scripts, and Selection → Ask AI.
**Depends on**: Phase 16
**Requirements**: ADD-01…ADD-06, SP-06, SP-07, SA-04, SA-06, OPT-09, OPT-11, FLOW-4, FLOW-6, FLOW-7
**Success Criteria** (what must be TRUE):

  1. The content-script bundle contains no React, no AntD and no UI code, and remains extraction-only (<50 KB).
  2. Right-click selection → "Ask AI" opens the Side Panel with the selection prefilled; /research runs via ResearchSkill (typed RESEARCH_NO_TOOL failure when no web-search tool is connected).
  3. Write renders as a primary Standalone Sider page with all quick actions; TeamGQM renders in the Add-ons group (feature-flag-gated); ServiceNow uses ServiceNowSessionAdapter and PROXY_FETCH only.
  4. Phase 17 adds Standalone add-on pages and chat-safe Side Panel entry actions only — no Side Panel pages (DEC-OP-01).
  5. Add-ons can consume PageContentService + Memory + Notes + LLM-Wiki; `pnpm run verify:phase-17` passes.

**Plans**: TBD
**UI hint**: yes

### Phase 18: Tool Governance and Active Discovery

**Goal**: Tools are governed — complete capability manifests, risk-based permissions, postcondition verification, result shaping, idempotent writes and budgeted discovery.
**Depends on**: Phase 17 and Phase 4
**Requirements**: TOL-01…TOL-07, FLOW-2
**Success Criteria** (what must be TRUE):

  1. Every registered tool has a complete ToolCapabilityManifest (category/risk/side-effect/permissions/scopes/timeout/cost/idempotency/verifier/hashes).
  2. Risky writes require confirmation; postcondition verification runs after side-effecting tools; duplicate writes are prevented (idempotency).
  3. Tool results are validated, redacted, size-limited, shaped and attributed before reaching the renderer.
  4. Active discovery stays within the tools token budget; `pnpm run verify:phase-18` passes.

**Plans**: TBD

### Phase 19: Hardening and Release

**Goal**: v0.2 is release-ready — full suites green, §22 performance targets met, regression gates blocking release, and release evidence recorded.
**Depends on**: Phase 18 (canonical order; release gate over all phases)
**Requirements**: CORE-09
**Success Criteria** (what must be TRUE):

  1. `pnpm run verify:all`, `pnpm run test:perf` and `pnpm run test:isolation` pass; every `verify:phase-N` command passes.
  2. §22 targets met: side panel paint <300 ms; standalone paint <500 ms; first token <2 s local / <3 s cloud; content-script bundle <50 KB.
  3. Filesystem restore round-trips a full vault; RAG returns correct citations on a fixture note set.
  4. Regression gates block release: prompt-injection, secret-leakage, false-completion, permission and memory-isolation suites.
  5. Release records include evaluation-suite and rubric versions; multimodal privacy fixtures and evolution activation/rollback drills pass.

**Release gate — open verification deferrals**: WINDOWS #5, #7 and #8 (Phase 15 owns final Real-Chrome closure; Phase 2 owns automated contract coverage for #5/#8) must close with screenshot + observed-result evidence before this gate. **This gate must FAIL while any deferred verification remains open** and the release record must name each closure. See `.planning/STATE.md` § Verification Deferrals. (`workflow.windows_enforce` is `false` in this project, so this line — not the ledger counter — is the explicit release-gate block.)
**Release gate — CR-01 follow-up (WINDOWS #26)**: the CR-01 metadata re-persist follow-up (operator disposition 2026-09-24, plan 02-14) is owned by this release-hardening phase, or by any earlier approved gap-closure or storage-hardening plan that may modify the store write guard. **This gate must FAIL while WINDOWS #26 remains unimplemented or lacks an explicit later operator decision**, and the release record must name its closure. See `.planning/WINDOWS.md` #26 and `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-14-SUMMARY.md` § Operator acknowledgement.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. MV3/WXT Runtime + AntD Shells + Workspace | 13/13 | Complete    | 2026-09-23 |
| 2. Storage, Security, WriteJournal, Workspace Persistence | 14/14 | Complete    | 2026-09-24 |
| 3. Cost-Effective AI Runtime (+ Persona seed) | 0/TBD | Not started | - |
| 4. Agent Reliability and Evidence | 0/TBD | Not started | - |
| 5. Context-Adaptive Execution | 0/TBD | Not started | - |
| 6. PageContentService (Knowledge Acquisition) | 0/TBD | Not started | - |
| 7. Trust-Aware Context and Receipts | 0/TBD | Not started | - |
| 8. Knowledge Base (Memory + MiniSearch + Notes) | 0/TBD | Not started | - |
| 9. LLM-Wiki & Filesystem Sync | 0/TBD | Not started | - |
| 10. Memory Governance and Experience Candidates | 0/TBD | Not started | - |
| 11. Transaction Logging and Diagnostics | 0/TBD | Not started | - |
| 12. Agent Evaluation | 0/TBD | Not started | - |
| 13. Verified Continual Evolution | 0/TBD | Not started | - |
| 14. Bounded Multi-Role Collaboration | 0/TBD | Not started | - |
| 15. Workspace Experience (UI/UX) + RICH | 0/TBD | Not started | - |
| 16. Multimodal Input Foundation | 0/TBD | Not started | - |
| 17. Add-ons and Content Script Runtime (Extraction-Only) | 0/TBD | Not started | - |
| 18. Tool Governance and Active Discovery | 0/TBD | Not started | - |
| 19. Hardening and Release | 0/TBD | Not started | - |
