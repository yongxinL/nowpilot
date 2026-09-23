# Requirements: NowPilot

**Defined:** 2026-09-20
**Release:** v0.2 (canonical current release label — DEC-OP-05)
**Core Value:** Turn the page you are on into trustworthy, cited, reusable knowledge — through a copilot whose routing is automatic, cost-governed, and safe by construction.

**Source of truth:** `.planning/product/PRODUCT_SPEC.md` v0.2 (canonical implementation contract). Requirement IDs are preserved verbatim from the spec's families. `CORE-*`, `SP-*`, `SA-*`, `OPT-*`, `WF-*`, `ADD-*` and `FLOW-*` are roadmap-level anchors for spec contracts that carry no native ID family — provenance is given per entry, and no spec identifier is renamed or invented. RICH's 60 items are tracked as three §18 wave rows (P0/P1/P2).

## v1 Requirements

Requirements for the v0.2 release. Each maps to exactly one roadmap phase.

### Foundation & Verification Anchors (CORE)

- [x] **CORE-01**: MV3/WXT runtime + two surfaces (Chat-only Side Panel; Standalone workspace) + shared WorkspaceStore handoff + theme store + RuntimeEnvelope/EventBus/registries/shells — §5, §6.2–§6.5, §8.3–§8.4; §18 Phase 1 DONE-when
- [x] **CORE-02**: Storage/security foundation — encrypted keys, IndexedDB stores, WriteJournal, idempotent migrations, workspace persistence — §15, §16, §20; §18 Phase 2 DONE-when
- [ ] **CORE-03**: Cost-effective runtime AI — Planner→Executor→Renderer, TierResolver (Appendix D), ProviderRouter fallback/circuit breaker, prompt caching, structured output one-repair, persona seed — §1, §10, §23
- [ ] **CORE-04**: Context-adaptive execution — model tiers, token budgets, ContextOptimizer, degradation order, minimal mode, ContextProvenanceManifest — §2
- [ ] **CORE-05**: PageContentService — layered extraction (Defuddle → Readability → AX/DOM), ephemeral per-tab MiniSearch, privacy (passwords never captured, no third-party fetch), content bundle <50 KB — §26, §22
- [ ] **CORE-06**: AI/MCP transaction logging + traceability + TraceRedactor + Prompt Inspector + Diagnostics — §4, §16.5
- [ ] **CORE-07**: UI/UX requirements §17.1–§17.6 — layouts, state matrix strings, container queries, accessibility, shared components
- [ ] **CORE-08**: Persistent memory architecture — three layers, scorer weights, injection budgets, conversation compaction — §3
- [ ] **CORE-09**: Hardening & release — verify:all / test:perf / test:isolation green, §22 targets met, regression gates block release, release evidence — §22, §24

### Side Panel Features (§9.1)

- [ ] **SP-01**: Chat (P0) — streaming, abort, slash commands, quick context; the only Side Panel surface — §9.1
- [x] **SP-02**: Open Standalone view action (P0) — opens standalone.html with workspace handoff — §9.1, Flow 11
- [ ] **SP-03**: Workflow selector (P0) — Auto or an approved workflow; provider/model resolution automatic and configured in Options — §9.1
- [ ] **SP-04**: Quick save to note (P1) — lightweight, non-LLM quick action — §9.1
- [ ] **SP-05**: Slash commands (P1) — /write, /ask, /research, etc. — §9.1
- [ ] **SP-06**: Tab pinning (P1) — max 10 pinned — §9.1
- [ ] **SP-07**: Selection → Ask AI (P0) — right-click context menu opens Side Panel with selection prefilled; assert in Phase 17 acceptance — §9.1
- [x] **SP-08**: Theme toggle (P1) — light/dark/auto via `chrome.storage.sync.np_theme` — §9.1, APPR-03
- [x] **SP-09**: Cmd+K palette (P1) — includes "Open Standalone view" — §9.1
- [ ] **SP-10**: Error toast + "Open Diagnostics" link (P1) — Diagnostics lives in Standalone → Options — §9.1

### Standalone View Features (§9.2)

- [ ] **SA-01**: Chat full-screen (P0) — shares WorkspaceStore + conversation with the Side Panel — §9.2
- [ ] **SA-02**: Agent full-screen (P0) — shares WorkspaceStore + conversation with Chat — §9.2
- [ ] **SA-03**: Note (P0) — list, editor, wikilinks, backlinks, graph, search, LLM-Wiki + Filesystem Sync — §9.2
- [ ] **SA-04**: Write (P0) — first-party add-on page: draft/rewrite/summarize/customer-update workflows — §9.2, §9.5
- [ ] **SA-05**: Tools (P0) — tool registry surface (main Sider group; manifests populated by Phase 18) — §9.2
- [ ] **SA-06**: TeamGQM add-on (P0) — full workspace, Add-ons group, feature-flag-gated — §9.2, §9.6
- [ ] **SA-07**: Settings (Options) (P0) — Diagnostics reached from Settings — §9.2
- [x] **SA-08**: First-run onboarding entry point (P0) — when no provider is configured (+ RICH-R-03 persona card) — §9.2
- [x] **SA-09**: Cmd+K palette (P1) — same command set as Side Panel + Standalone-only commands — §9.2
- [x] **SA-10**: Command "Focus Side Panel" (P1) — programmatically opens Side Panel for current tab — §9.2

### Options Page (§9.3)

- [ ] **OPT-01**: General — Account (name/email/log-out), AI access (provider grid → Set-up dialog), Appearance (Display mode + Theme pack, language, font size, side-panel position) — §9.3, §17.1a
- [ ] **OPT-02**: Providers — add/edit/delete provider configs, test connections, priority order — §9.3
- [ ] **OPT-03**: Models — per-provider model list + context window override — §9.3
- [ ] **OPT-04**: MCP Servers — add/enable/disable external MCP servers, view permissions — §9.3
- [ ] **OPT-05**: Prompt Templates — create/edit/delete templates + {{variable}} editor — §9.3
- [ ] **OPT-06**: Slash Commands — manage slash command → template mapping — §9.3
- [ ] **OPT-07**: Memory — view/edit user memory facts; enable/disable memory (governance contracts in Phase 10) — §9.3
- [ ] **OPT-08**: Diagnostics — DiagnosticsPanel, transaction traces, export debug bundle — §9.3
- [ ] **OPT-09**: Import / Export — sanitised JSON/ZIP export, import merge, "Restore from folder" (restore subsection delivered in Phase 9) — §9.3
- [ ] **OPT-10**: Feature Flags — toggle P2 features (webhooks, insights, TTS) — §9.3
- [ ] **OPT-11**: Add-on Settings — namespaced settings per registered add-on — §9.3
- [ ] **OPT-12**: Persona — edit AI name, tone, brevity (RICH-R-04) — §9.3
- [ ] **OPT-13**: Notes — LLM feature toggles, backup folder config, bulk maintenance — §9.3, §27
- [ ] **OPT-14**: About — version, license, links — §9.3

### Workflow Routing (§9.3a)

- [ ] **WF-01**: Default workflow is Auto — §9.3a
- [ ] **WF-02**: Registry of approved workflow IDs and labels — §9.3a
- [ ] **WF-03**: Workflow → capability tier mapping (`fast` | `balanced`; TierResolver runtime in Phase 3) — §9.3a, Appendix D
- [ ] **WF-04**: Optional provider preference and fallback policy per workflow — §9.3a
- [ ] **WF-05**: Allowed tools and confirmation posture per workflow — §9.3a
- [ ] **WF-06**: Read-only preview of the currently resolved provider/model — §9.3a
- [ ] **WF-07**: Validation that every enabled workflow resolves to ≥1 enabled compatible model — §9.3a

### Add-ons (§9.4–§9.8)

- [ ] **ADD-01**: Add-on contract — registry, Standalone pages only (`src/addons/<id>/pages/Standalone*.tsx`), chat-safe Side Panel entry actions only, no core→add-on imports, Zod settings schema, `np_addon_<id>` storage prefix — §9.4, §20.13
- [ ] **ADD-02**: Write add-on — StandaloneWritePage + DraftSkill/RewriteSkill/SummarizeSkill/CustomerUpdateSkill — §9.5
- [ ] **ADD-03**: TeamGQM add-on — integration shell + Standalone page (flag-gated), TeamGQMSummarySkill — §9.6
- [ ] **ADD-04**: ServiceNow add-on — JSESSIONID + sysparmCK extraction, case context, Table API via PROXY_FETCH, CaseAnalyzer/CatchUp/Sentiment/CodeSearch skills, Standalone case page — §9.7
- [ ] **ADD-05**: Research global tool — MCP web-search priority, typed failure (never silent model-only fallback), /research in both surfaces — §9.8
- [ ] **ADD-06**: Content-script runtime extraction-only — ContentScriptHost completed, no UI mount, certification checklist enforced — §9.4, §25

### Agent Reliability (§28.2)

- [ ] **AGT-01** (P0): Trajectory states — §28.2
- [ ] **AGT-02** (P0): Side-effect success requires CompletionEvidence — §28.2
- [ ] **AGT-03** (P0): Structured AgentTurnOutcome; cap exhaustion is `partial` — §28.2
- [ ] **AGT-04** (P0): Deterministic replan/terminal policy — §28.2

### Trust-Aware Context (§28.3)

- [ ] **CTX-01** (P0): Source trust/authority metadata — §28.3
- [ ] **CTX-02** (P0): Retrieved data is never instructions — §28.3
- [ ] **CTX-03** (P0): ContextProvenanceManifest → context receipt — §28.3
- [ ] **CTX-04** (P0): Stable-prefix snapshot tests — §28.3
- [ ] **CTX-05** (P1): Progressive skill disclosure — §28.3
- [ ] **CTX-06** (P1): Context-quality diagnostics without raw text — §28.3

### Memory Governance (§28.4)

- [ ] **MEM-01** (P0): Working/episodic/semantic/preference/procedural taxonomy — §28.4
- [ ] **MEM-02** (P0): Source + confidence + lifecycle + sensitivity + verified-at on records — §28.4
- [ ] **MEM-03** (P0): Conflict precedence (correction > verified > prior > inference) — §28.4
- [ ] **MEM-04** (P0): View/edit/pin/forget/disable/export/cloud-exclude controls — §28.4
- [ ] **MEM-05** (P1): Procedural experience gated by approval — §28.4
- [ ] **KNW-01** (P1): Edge provenance — §28.4

### Tool Governance (§28.5)

- [ ] **TOL-01** (P0): ToolCapabilityManifest (category/risk/side-effect/permissions/scopes/timeout/cost/idempotency/verifier/hashes) — §28.5
- [ ] **TOL-02** (P0): Risk- & side-effect-based permission policy — §28.5
- [ ] **TOL-03** (P0): Postcondition verification — §28.5
- [ ] **TOL-04** (P0): Validate/redact/size-limit/shape/attribute tool results — §28.5
- [ ] **TOL-05** (P0): Idempotent write replay-safety — §28.5
- [ ] **TOL-06** (P1): Active discovery over tools budget — §28.5
- [ ] **TOL-07** (P2): Resumable long-running contract (future) — §28.5

### Agent Evaluation (§28.6)

- [ ] **EVAL-01** (P0): Versioned golden suites — §28.6
- [ ] **EVAL-02** (P0): Multi-dimension trajectory rubric — §28.6
- [ ] **EVAL-03** (P0): Deterministic validators first; judges only for qualitative dimensions — §28.6
- [ ] **EVAL-04** (P0): First-failing-layer diagnostics — §28.6
- [ ] **EVAL-05** (P0): Safety/leak/injection/false-completion/citation/isolation regressions block release — §28.6
- [ ] **EVAL-06** (P1): Cost/latency/quality Pareto — §28.6
- [ ] **EVAL-07** (P1): Calibrated, versioned judges — §28.6

### Verified Continual Evolution (§28.7)

- [ ] **EVO-01** (P1): Trajectories create candidates, never direct production changes — §28.7
- [ ] **EVO-02** (P1): One target layer per candidate — §28.7
- [ ] **EVO-03** (P1): EvolutionCandidate stores evidence/baseline/security/version/rollback — §28.7
- [ ] **EVO-04** (P0): Untrusted content cannot update active prompts/tools/permissions/code/procedural memory — §28.7
- [ ] **EVO-05** (P1): Sandbox → approve → scoped rollout → monitor → rollback — §28.7
- [ ] **EVO-06** (P2): Agent-generated tools stay sandbox proposals — §28.7

### Candidate Proposer (§28.7a)

- [ ] **PROP-01** (P1): Inputs = failing evals + trace evidence only — §28.7a
- [ ] **PROP-02** (P1): One layer per proposal (deterministic FailureLayer → targetLayer) — §28.7a
- [ ] **PROP-03** (P1): Evidence threshold (≥3 agreeing failures, ≥0.15 score drop) — §28.7a
- [ ] **PROP-04** (P1): Per-proposal sandbox cost cap (50,000 tokens) — §28.7a
- [ ] **PROP-05** (P0): Proposes only, never activates — §28.7a
- [ ] **PROP-06** (P1): Reproducible (suite version + op-ids + content hash) — §28.7a

### Multimodal Input (§29.2)

- [ ] **MM-01** (P1): ModalityInput (no inline binary) — §29.2
- [ ] **MM-02** (P1): ModalityObservation with confidence/sensitivity — §29.2
- [ ] **MM-03** (P1): Image paste/upload via vision model — §29.2
- [ ] **MM-04** (P1): Voice → editable Sender, explicit send — §29.2
- [ ] **MM-05** (P2): Later fast/slow split — §29.2
- [ ] **MM-06** (P1): AbortSignal across transcribe/plan/tool/render — §29.2
- [ ] **MM-07** (P0 boundary): APC-lite ≠ browser automation — §29.2

### Bounded Multi-Role Collaboration (§30.2)

- [ ] **COLLAB-01** (P1): Explicit activation — §30.2
- [ ] **COLLAB-02** (P1): Closed role registry — §30.2
- [ ] **COLLAB-03** (P1): CollaborationPlan caps/deadline (single-agent = one-role plan) — §30.2
- [ ] **COLLAB-04** (P1): Typed handoffs, no hidden reasoning — §30.2
- [ ] **COLLAB-05** (P0): Coordinator owns commits — §30.2
- [ ] **COLLAB-06** (P0): Workers have no side effects — §30.2
- [ ] **COLLAB-07** (P1): Independent reviewer — §30.2
- [ ] **COLLAB-08** (P1): Contained failure/fallback — §30.2
- [ ] **COLLAB-09** (P1): Shared projected context — §30.2
- [ ] **COLLAB-10** (P1): Collaboration traces — §30.2
- [ ] **COLLAB-11** (P1): Single-agent baseline gate — §30.2
- [ ] **COLLAB-12** (P2): Future isolated workers — §30.2
- [ ] **COLLAB-13** (P0): No open-ended/unbounded agents — §30.2

### LLM-Wiki & Notes (§27)

- [ ] **CAT-01**: Path-based `categoryPath` (`/` separator, no leading/trailing slashes; segments normalized) — §27.1
- [ ] **CAT-02**: NoteList tree grouped by category; "Uncategorized" node; click → flat list within category — §27.1
- [ ] **CAT-03**: LLM suggests category path during auto-tagging; user accept/edit/dismiss — §27.1
- [ ] **CAT-04**: Backup saves `{categoryPath}/{title}.md`; nested folders auto-created — §27.1
- [ ] **CAT-05**: Normalize on save; invalid segments flagged (AntD red border) — §27.1
- [ ] **LLM-WIKI-01**: On save, one fast-tier temperature-0 call returns ≤5 tags + 1 categoryPath + 1–2 sentence summary (+ memory facts) — §27.2
- [ ] **LLM-WIKI-02**: Independent toggles in Options → Notes (`np_notes_llm_features`); off = no LLM call on save — §27.2
- [ ] **LLM-WIKI-03**: Optional `summary` field displayed in NoteList — §27.2
- [ ] **LLM-WIKI-04**: "Regenerate tags/summary" toolbar button re-runs the combined call in place — §27.2
- [ ] **LLM-WIKI-05**: Natural-language search: MiniSearch fuzzy → fast call reranks top-10 ("AI-enhanced"; no embeddings) — §27.2
- [ ] **LLM-WIKI-06**: "Ask your notes" RAG: MiniSearch top-5 + memory facts → balanced-tier synthesis with per-statement citations — §27.2
- [ ] **LLM-WIKI-07**: "Save to note" → NoteChatConverter drafts title/content/tags/wikilinks/categoryPath → pre-filled editor (user gatekeeper) — §27.2
- [ ] **LLM-WIKI-08**: Staleness hint (summaryGeneratedAt/tagsGeneratedAt vs updated) — §27.2
- [ ] **LLM-WIKI-09**: Orphan detection (algorithmic; "Orphan" badge + "Find context") — §27.2
- [ ] **LLM-WIKI-10**: "Re-analyze all notes" (Options → Notes), user-initiated, sequential — §27.2
- [ ] **LLM-WIKI-11**: Suggestion confidence gating (threshold 0.60; ≤3 facts / ≤5 tags per save; stale suggestions discarded) — §27.2
- [ ] **SYNC-01**: "Set backup folder" via `showDirectoryPicker()` (Standalone only); handle in `notes_backup_config` IndexedDB store — §27.3
- [ ] **SYNC-02**: On NotesPage mount verify `queryPermission()`; denied/missing → disabled + re-select banner — §27.3
- [ ] **SYNC-03**: Per-save write/update/delete, fire-and-forget, 50 ms debounce — §27.3
- [ ] **SYNC-04**: File path + sanitized filename + OKF v0.2-aligned YAML frontmatter (`type`/`title`/`description`/`id`/`created`/`updated`/`tags`/`categoryPath`/`generated`/`status`) — §27.3
- [ ] **SYNC-05**: Title collision → numeric suffix scan — §27.3
- [ ] **SYNC-06**: External-change detection (2 s tolerance) → Overwrite/Skip, default Skip — §27.3
- [ ] **SYNC-07**: No backup folder → sync no-ops + "Backup: off [Configure]" — §27.3
- [ ] **SYNC-08**: Status Tag green On / gray Off / red Error — §27.3
- [ ] **SYNC-09**: "Restore from backup" — walk tree, parse frontmatter, additive upsert (never deletes local notes), OKF tolerance (unknown keys preserved) — §27.3
- [ ] **SYNC-10**: Restore preview modal ("Found N notes (X new, Y updated, Z unchanged)") — §27.3
- [ ] **SYNC-11**: Delete-on-sync + empty-folder cleanup — §27.3
- [ ] **NMEM-01**: Memory-aware RAG — "Ask notes" also queries MemoryEngine facts/preferences — §27.4
- [ ] **NMEM-02**: On save, same LLM call extracts memory facts → MemoryEngine; Notes → Memory only; primary surface only — §27.4
- [ ] **NMEM-03**: "Save from chat" uses conversation messages AND `MemoryEngine.assemble()` facts — §27.4
- [ ] **WIKI-ID-01**: Immutable `id` (crypto.randomUUID) — never changes on rename/move/restore; edges stored as note IDs — §27.7a
- [ ] **WIKI-ID-02**: `[[Title]]` body syntax; `resolveLinks()` maps to IDs (exact title → updated desc → id asc); rename never rewrites sources — §27.7a
- [ ] **WIKI-ID-03**: Unresolved links recorded in `unresolvedLinks[]`, rendered distinctly, save-time reconciliation promotes matches — §27.7a
- [ ] **WIKI-ID-04**: Deletion → dangling edges move back to `unresolvedLinks[]` at next save/graph rebuild; restore reconstructs IDs from frontmatter — §27.7a
- [ ] **OKF-WIKI-01** (P1): NoteFileSync emits OKF-required `type` (default `Note`) + recommended `description` (= `Note.summary`) — §18 Phase 9
- [ ] **OKF-WIKI-02** (P1): NoteFileSync emits `generated: { by, at }` (ISO 8601) + `status` (`draft`|`stable`, default `stable`) — §18 Phase 9
- [ ] **OKF-WIKI-03** (P1): `Note.id` (UUID) emitted/parsed as OKF extension key; write→restore round-trip preserves it and every wikilink edge — §18 Phase 9
- [ ] **OKF-WIKI-04** (P0 boundary): v0.2 does not emit OKF markdown-link edges and does not adopt path-as-identity; strict-OKF conformance deferred to a later release behind an ADR — §18 Phase 9

### Workspace Experience — RICH (§17.7)

- [ ] **RICH-P0**: 17 P0 items (Phase 15.3) — RICH-R-01, R-02, R-11, H-01, I-01, I-05, I-06, C-01, C-02, C-03, C-04, C-05, C-06, C-07, C-08, H-04 (clipboard-only insert), H-08 — §17.7, §18 Phase 15.3
- [ ] **RICH-P1**: 22 P1 items (Phase 15.4) — RICH-R-03, R-05, R-06, R-08, R-09, R-10, I-02, I-03, I-08, I-09, I-10, C-09, C-12, C-13, C-14, H-02, H-03, H-05, H-06, H-11, H-12, H-16 — §17.7, §18 Phase 15.4
- [ ] **RICH-P2**: 21 P2 items (Phase 15.5) — all remaining P2 items; RICH-H-07 remains deferred (R1) — §17.7, §18 Phase 15.5

### Appearance & Notes Workspace

- [ ] **APPR-01**: Theme controls live in Options → General → Appearance (Standalone only); Side Panel follows live — §17.1a
- [ ] **APPR-02**: Single Segmented Light · Dark · Auto bound to ThemeMode; default Auto — §17.1a
- [x] **APPR-03**: Single source of truth `chrome.storage.sync.np_theme`; no `themeMode` on UserPreferences; `chrome.storage.onChanged` propagates to both surfaces — §17.1a
- [x] **APPR-04**: On change, each surface re-derives `getAntdConfig({ mode, pack, compact })`; real-time via antd v6 CSS variables, no remount — §17.1a
- [x] **APPR-05**: Density is not user-configurable in v0.2 (Side Panel compact; Standalone default) — §17.1a
- [ ] **APPR-06**: Theme pack selector Default · Liquid Glass · Claude Warm bound to `np_theme_pack`; orthogonal to mode; each pack passes WCAG AA in both modes — §17.1a
- [ ] **NOTES-COL-01**: Four segmented toggles — Directory · Notes · Content · Inspector; Content (col 3) persistent/always-on — §17.2c
- [ ] **NOTES-COL-02**: Inline collapse chevrons per collapsible column, synced with header toggles — §17.2c
- [ ] **NOTES-COL-03**: Collapse animates width→0 (150–200 ms); state persists per surface; auto-collapse Directory then Inspector at narrow widths — §17.2c

### Critical User Flows (§11)

- [ ] **FLOW-1**: Send a chat message — slash-check → ContextOptimizer → AgentOrchestrator.runTurn → ChunkBuffer → PortableMarkdown → ChatHistoryDB; errors via notification with Retry / Open Settings — §11
- [ ] **FLOW-1a**: Title generation — PROMPTS.titleGen, temp 0, maxTokens 16, 3 s; never blocks save — §11
- [ ] **FLOW-2**: Tool call permission — Allow once / Allow always; dangerous tools always prompt — §11
- [ ] **FLOW-3**: Save a note — LinkParser → resolveLinks → NotesDB → NoteTagger (non-blocking) → NMEM-02 → NoteFileSync — §11
- [ ] **FLOW-4**: Tab pinning — executeScript + 5 s timeout → WorkspaceStore.pinTab; max 10 — §11
- [ ] **FLOW-5**: Local model context warning — Ollama ≤4096 tokens → Alert + "Copy Modelfile" — §11
- [ ] **FLOW-6**: Data export — Options → Import/Export, sanitised download — §11
- [ ] **FLOW-7**: Webhook fire — retry queue 30 s / 5 min / 30 min, logged — §11
- [x] **FLOW-8**: Keyboard shortcut — KeymapRegistry global keydown → handler → preventDefault — §11
- [x] **FLOW-9**: First-run onboarding — persona card → provider → key → validate — §11
- [x] **FLOW-10**: Cmd+K command palette — filtered command list — §11
- [x] **FLOW-11**: Open Standalone view — persist → dedupe → hydrate → WORKSPACE_HANDOFF → Side Panel mirrors — §11
- [ ] **FLOW-12**: Save to note (LLM-Wiki) — NoteChatConverter draft → user edits → save pipeline — §11
- [ ] **FLOW-13**: Ask your notes (RAG) — MiniSearch top-5 + memory → balanced synthesis with citations; tiny falls back — §11
- [ ] **FLOW-14**: Set/change backup folder — showDirectoryPicker (Standalone only) → handle in IndexedDB — §11
- [ ] **FLOW-15**: Restore from folder — parse frontmatter → preview → additive upsert — §11
- [ ] **FLOW-16**: RICH clarification & follow-up — chips, max 2 rounds, graceful timeout — §11
- [ ] **FLOW-17**: Open chat history — Side Panel bottom sheet vs Standalone right drawer — §11
- [ ] **FLOW-18**: Configure a provider — modal flow, validateConfig, enabled models feed routing — §11
- [ ] **FLOW-19**: Change appearance — display mode + theme pack to storage.sync, live on both surfaces — §11

## v2 / Later Release

Acknowledged and deferred; not in the current roadmap.

### Page Injection & Capture

- Page injection architecture (Shadow DOM runtime, Tailwind+Radix injected UI, portal isolation, style-bleed tests) — §25
- Screenshot / region capture in the Side Panel composer — DEC-OP-02
- Browser automation (chrome.debugger + CDP) — §26 (v2)
- CaseInsightBox / host-page UI enhancements — §9.7

### Knowledge & Notes

- Strict-OKF conformance (markdown-link edges, path-as-identity, `sources`/`verified`) — OKF-WIKI-04, behind a dedicated ADR
- Bidirectional filesystem sync — §27
- Embeddings / vector stores — §27 (LLM reranking instead)
- LLM wikilink autocomplete suggestions — D-04
- RICH-H-07 "Fill this field" (host-page write-back) — DEC-SPEC-11 R1

### Experience

- `@ant-design/x-card` / A2UI dynamic surfaces — DEC-SPEC-02
- Animated 3D avatar; separate sentiment LLM call; full NLP intent pipeline; TTS output; drag-and-drop macro builder; cross-session replay — §17.7 out of scope
- Resumable long-running tool contract — TOL-07
- Isolated collaboration workers — COLLAB-12

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Page injection / Shadow DOM UI / host-page write-back | Content scripts are extraction-only in v0.2 (§25; DEC-SPEC-03/11 R1) |
| Raw model selector in Chat | Workflow selector + TierResolver only (DEC-HTML-01) |
| Side Panel nav rail / add-on Side Panel pages | Side Panel is Chat-only (W1 / DEC-OP-01) |
| AI/MCP/EventSource/IndexedDB in background SW | §0 hard rules (PROXY_FETCH + chrome.alarms only) |
| `@ant-design/x-sdk` chat data flow | Would bypass AgentOrchestrator/ProviderRouter (DEC-SPEC-02) |
| External agent frameworks (LangChain, LlamaIndex, MemGPT, Mastra) | Patterns borrowed, runtime owned (DEC-SPEC-09) |
| Banned packages (`tailwindcss`, `shadcn/ui`, `@radix-ui/*`, `clsx`, `tailwind-merge`, `framer-motion`, `ulid`/`uuid`, provider SDKs) | §0 hard rules (use `motion`, crypto.randomUUID, @ai-sdk/*) |

## Traceability

Which phases cover which requirements. Each requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Complete |
| CORE-02 | Phase 2 | Complete |
| CORE-03 | Phase 3 | Pending |
| CORE-04 | Phase 5 | Pending |
| CORE-05 | Phase 6 | Pending |
| CORE-06 | Phase 11 | Pending |
| CORE-07 | Phase 15 | Pending |
| CORE-08 | Phase 8 | Pending |
| CORE-09 | Phase 19 | Pending |
| SP-01 | Phase 15 | Pending |
| SP-02 | Phase 1 | Complete |
| SP-03 | Phase 15 | Pending |
| SP-04 | Phase 15 | Pending |
| SP-05 | Phase 15 | Pending |
| SP-06 | Phase 17 | Pending |
| SP-07 | Phase 17 | Pending |
| SP-08 | Phase 1 | Complete |
| SP-09 | Phase 1 | Complete |
| SP-10 | Phase 11 | Pending |
| SA-01 | Phase 15 | Pending |
| SA-02 | Phase 15 | Pending |
| SA-03 | Phase 15 | Pending |
| SA-04 | Phase 17 | Pending |
| SA-05 | Phase 15 | Pending |
| SA-06 | Phase 17 | Pending |
| SA-07 | Phase 15 | Pending |
| SA-08 | Phase 1 | Complete |
| SA-09 | Phase 1 | Complete |
| SA-10 | Phase 1 | Complete |
| OPT-01 | Phase 15 | Pending |
| OPT-02 | Phase 15 | Pending |
| OPT-03 | Phase 15 | Pending |
| OPT-04 | Phase 15 | Pending |
| OPT-05 | Phase 15 | Pending |
| OPT-06 | Phase 15 | Pending |
| OPT-07 | Phase 15 | Pending |
| OPT-08 | Phase 11 | Pending |
| OPT-09 | Phase 17 | Pending |
| OPT-10 | Phase 15 | Pending |
| OPT-11 | Phase 17 | Pending |
| OPT-12 | Phase 15 | Pending |
| OPT-13 | Phase 9 | Pending |
| OPT-14 | Phase 15 | Pending |
| WF-01 | Phase 15 | Pending |
| WF-02 | Phase 15 | Pending |
| WF-03 | Phase 15 | Pending |
| WF-04 | Phase 15 | Pending |
| WF-05 | Phase 15 | Pending |
| WF-06 | Phase 15 | Pending |
| WF-07 | Phase 15 | Pending |
| ADD-01 | Phase 17 | Pending |
| ADD-02 | Phase 17 | Pending |
| ADD-03 | Phase 17 | Pending |
| ADD-04 | Phase 17 | Pending |
| ADD-05 | Phase 17 | Pending |
| ADD-06 | Phase 17 | Pending |
| AGT-01 | Phase 4 | Pending |
| AGT-02 | Phase 4 | Pending |
| AGT-03 | Phase 4 | Pending |
| AGT-04 | Phase 4 | Pending |
| CTX-01 | Phase 7 | Pending |
| CTX-02 | Phase 7 | Pending |
| CTX-03 | Phase 7 | Pending |
| CTX-04 | Phase 7 | Pending |
| CTX-05 | Phase 7 | Pending |
| CTX-06 | Phase 7 | Pending |
| MEM-01 | Phase 10 | Pending |
| MEM-02 | Phase 10 | Pending |
| MEM-03 | Phase 10 | Pending |
| MEM-04 | Phase 10 | Pending |
| MEM-05 | Phase 10 | Pending |
| KNW-01 | Phase 10 | Pending |
| TOL-01 | Phase 18 | Pending |
| TOL-02 | Phase 18 | Pending |
| TOL-03 | Phase 18 | Pending |
| TOL-04 | Phase 18 | Pending |
| TOL-05 | Phase 18 | Pending |
| TOL-06 | Phase 18 | Pending |
| TOL-07 | Phase 18 | Pending |
| EVAL-01 | Phase 12 | Pending |
| EVAL-02 | Phase 12 | Pending |
| EVAL-03 | Phase 12 | Pending |
| EVAL-04 | Phase 12 | Pending |
| EVAL-05 | Phase 12 | Pending |
| EVAL-06 | Phase 12 | Pending |
| EVAL-07 | Phase 12 | Pending |
| EVO-01 | Phase 13 | Pending |
| EVO-02 | Phase 13 | Pending |
| EVO-03 | Phase 13 | Pending |
| EVO-04 | Phase 13 | Pending |
| EVO-05 | Phase 13 | Pending |
| EVO-06 | Phase 13 | Pending |
| PROP-01 | Phase 13 | Pending |
| PROP-02 | Phase 13 | Pending |
| PROP-03 | Phase 13 | Pending |
| PROP-04 | Phase 13 | Pending |
| PROP-05 | Phase 13 | Pending |
| PROP-06 | Phase 13 | Pending |
| MM-01 | Phase 16 | Pending |
| MM-02 | Phase 16 | Pending |
| MM-03 | Phase 16 | Pending |
| MM-04 | Phase 16 | Pending |
| MM-05 | Phase 16 | Pending |
| MM-06 | Phase 16 | Pending |
| MM-07 | Phase 16 | Pending |
| COLLAB-01 | Phase 14 | Pending |
| COLLAB-02 | Phase 14 | Pending |
| COLLAB-03 | Phase 14 | Pending |
| COLLAB-04 | Phase 14 | Pending |
| COLLAB-05 | Phase 14 | Pending |
| COLLAB-06 | Phase 14 | Pending |
| COLLAB-07 | Phase 14 | Pending |
| COLLAB-08 | Phase 14 | Pending |
| COLLAB-09 | Phase 14 | Pending |
| COLLAB-10 | Phase 14 | Pending |
| COLLAB-11 | Phase 14 | Pending |
| COLLAB-12 | Phase 14 | Pending |
| COLLAB-13 | Phase 14 | Pending |
| CAT-01 | Phase 9 | Pending |
| CAT-02 | Phase 9 | Pending |
| CAT-03 | Phase 9 | Pending |
| CAT-04 | Phase 9 | Pending |
| CAT-05 | Phase 9 | Pending |
| LLM-WIKI-01 | Phase 9 | Pending |
| LLM-WIKI-02 | Phase 9 | Pending |
| LLM-WIKI-03 | Phase 9 | Pending |
| LLM-WIKI-04 | Phase 9 | Pending |
| LLM-WIKI-05 | Phase 9 | Pending |
| LLM-WIKI-06 | Phase 9 | Pending |
| LLM-WIKI-07 | Phase 9 | Pending |
| LLM-WIKI-08 | Phase 9 | Pending |
| LLM-WIKI-09 | Phase 9 | Pending |
| LLM-WIKI-10 | Phase 9 | Pending |
| LLM-WIKI-11 | Phase 9 | Pending |
| SYNC-01 | Phase 9 | Pending |
| SYNC-02 | Phase 9 | Pending |
| SYNC-03 | Phase 9 | Pending |
| SYNC-04 | Phase 9 | Pending |
| SYNC-05 | Phase 9 | Pending |
| SYNC-06 | Phase 9 | Pending |
| SYNC-07 | Phase 9 | Pending |
| SYNC-08 | Phase 9 | Pending |
| SYNC-09 | Phase 9 | Pending |
| SYNC-10 | Phase 9 | Pending |
| SYNC-11 | Phase 9 | Pending |
| NMEM-01 | Phase 9 | Pending |
| NMEM-02 | Phase 9 | Pending |
| NMEM-03 | Phase 9 | Pending |
| WIKI-ID-01 | Phase 8 | Pending |
| WIKI-ID-02 | Phase 8 | Pending |
| WIKI-ID-03 | Phase 8 | Pending |
| WIKI-ID-04 | Phase 8 | Pending |
| OKF-WIKI-01 | Phase 9 | Pending |
| OKF-WIKI-02 | Phase 9 | Pending |
| OKF-WIKI-03 | Phase 9 | Pending |
| OKF-WIKI-04 | Phase 9 | Pending |
| RICH-P0 | Phase 15 | Pending |
| RICH-P1 | Phase 15 | Pending |
| RICH-P2 | Phase 15 | Pending |
| APPR-01 | Phase 15 | Pending |
| APPR-02 | Phase 15 | Pending |
| APPR-03 | Phase 1 | Complete |
| APPR-04 | Phase 1 | Complete |
| APPR-05 | Phase 1 | Complete |
| APPR-06 | Phase 15 | Pending |
| NOTES-COL-01 | Phase 15 | Pending |
| NOTES-COL-02 | Phase 15 | Pending |
| NOTES-COL-03 | Phase 15 | Pending |
| FLOW-1 | Phase 15 | Pending |
| FLOW-1a | Phase 15 | Pending |
| FLOW-2 | Phase 18 | Pending |
| FLOW-3 | Phase 9 | Pending |
| FLOW-4 | Phase 17 | Pending |
| FLOW-5 | Phase 15 | Pending |
| FLOW-6 | Phase 17 | Pending |
| FLOW-7 | Phase 17 | Pending |
| FLOW-8 | Phase 1 | Complete |
| FLOW-9 | Phase 1 | Complete |
| FLOW-10 | Phase 1 | Complete |
| FLOW-11 | Phase 1 | Complete |
| FLOW-12 | Phase 9 | Pending |
| FLOW-13 | Phase 9 | Pending |
| FLOW-14 | Phase 9 | Pending |
| FLOW-15 | Phase 9 | Pending |
| FLOW-16 | Phase 15 | Pending |
| FLOW-17 | Phase 15 | Pending |
| FLOW-18 | Phase 15 | Pending |
| FLOW-19 | Phase 15 | Pending |

**Coverage:**

- v1 requirements: 188 total (RICH counted as 3 §18 waves covering 60 items; FLOW-1a included)
- Mapped to phases: 188
- Unmapped: 0 ✓
- Per phase: P1 14 · P2 1 · P3 1 · P4 4 · P5 1 · P6 1 · P7 6 · P8 5 · P9 40 · P10 6 · P11 3 · P12 7 · P13 12 · P14 13 · P15 43 · P16 7 · P17 15 · P18 8 · P19 1

---
*Requirements defined: 2026-09-20*
*Last updated: 2026-09-20 after ingest bootstrap (PRODUCT_SPEC v0.2; W1–W6 resolutions applied)*
