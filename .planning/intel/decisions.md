# NowPilot — Synthesized Decisions

No ADR-classified documents are in the ingest set (0 ADRs; classifications are 2 SPEC + 1 DOC; nothing marked locked).
The entries below are **embedded decisions** surfaced from the classified documents — PRODUCT_SPEC §23 is titled "Key Technology Decisions (ADRs)", §27.8 contains a Decisions table, §17.7.5 contains mandatory reconciliations, and the HTML guide contains one embedded decision. All are recorded with `status: proposed` (none are ADR-locked). No LOCKED-vs-LOCKED contradictions exist.

## DEC-SPEC-01: Technology stack pins (extension/UI/AI runtime)
- source: .planning/product/PRODUCT_SPEC.md (§23)
- status: proposed
- decision: WXT extension framework; React 19; Ant Design v6 with Ant Design X 2.x presentation components only; @ant-design/x-markdown for streaming markdown; Zustand for state; Vercel AI SDK `ai ^5+` (pin current major at implementation) via @ai-sdk/* adapters only (pin each provider package to its own current major); zod ^4 with zod-to-json-schema retained in v0.2; `motion` (Framer Motion v12, never framer-motion); @ant-design/icons v6; vitest/@testing-library/react/jsdom/msw; TypeScript ≥5.5 strict (develop on TS 6.x; TS 7 fast-follow).
- scope: whole product; package.json; provider adapters; theming stack

## DEC-SPEC-02: AI chat data flow is NOT @ant-design/x-sdk; A2UI deferred
- source: .planning/product/PRODUCT_SPEC.md (§23, §25.6)
- status: proposed
- decision: Keep AgentOrchestrator/ProviderRouter/ContextOptimizer as the data flow; @ant-design/x-sdk (useXChat, ChatProvider, etc.) is banned because it would call providers directly from the UI and bypass the pipeline. @ant-design/x-card / A2UI dynamic surfaces deferred beyond the current v0.2 milestone (JSON target too large for fast/balanced-tier models).
- scope: Chat/Agent surfaces; dependencies; renderer structured output

## DEC-SPEC-03: Two surfaces + extraction-only content scripts + page injection deferred
- source: .planning/product/PRODUCT_SPEC.md (§23, §6.2)
- status: proposed
- decision: Two UI surfaces — Side Panel (daily workflow; Chat only, per the operator W1 resolution) and Standalone view (deep work/config/diagnostics; Sider Chat · Agent · Note · Write · Tools + Add-ons + Settings, per W3) — share one workspace (WorkspaceStore + BroadcastBus). Content scripts are extraction-only in v0.2; Shadow DOM UI and host-page write-back are deferred to a later release.
- scope: surfaces; content scripts; post-v0.2 roadmap

## DEC-SPEC-04: Page-content extraction as core PageContentService (Phase 6), layered strategy
- source: .planning/product/PRODUCT_SPEC.md (§23, §26)
- status: proposed
- decision: Extraction is core infrastructure, not a tool; layered strategy Defuddle → APC-lite → ServiceNow API; Defuddle pinned `^0.19` (≥0.19.2, `defuddle/full`, sync `parse()`, `useAsync:false`); ephemeral per-tab MiniSearch over extracted content, never persisted; browser automation deferred to v2 (chrome.debugger + CDP).
- scope: extraction; context pipeline; content bundle budget; ServiceNow add-on registration (Phase 17)

## DEC-SPEC-05: Knowledge layer — Memory + MiniSearch + Notes + Wikilinks (Phase 8), LLM-Wiki (Phase 9)
- source: .planning/product/PRODUCT_SPEC.md (§23, §27)
- status: proposed
- decision: Consolidate Memory + MiniSearch + Notes + Wikilinks in Phase 8; LLM-Wiki (enrichment + RAG + filesystem sync) in Phase 9; single fast call for tags+category+summary+memory facts; categoryPath maps to folders and stays separate from tags; Notes→Memory only (never reverse); semantic search via LLM-routed reranking over MiniSearch (no embeddings); one-way app→FS sync + import-for-restore; backup handle in the notes_backup_config IndexedDB store.
- scope: knowledge base; notes; search; backup/restore

## DEC-SPEC-06: Note file format — OKF v0.2-aligned, OKF-compatible not OKF-constrained
- source: .planning/product/PRODUCT_SPEC.md (§23, §21.2, §27.3)
- status: proposed
- decision: `.md` + YAML frontmatter + folder tree; emit OKF-required `type` (default Note), recommended `description` (= summary), and `generated`/`status` families; retain immutable UUID `id` as an OKF extension key; wikilinks remain the body edge syntax. Strict OKF (markdown-link edges, path-as-identity, sources/verified families) deferred to a later release behind a dedicated ADR.
- scope: NoteFileSync; restore parser; note identity; spec ADR backlog

## DEC-SPEC-07: Persona from Phase 3; RICH on Ant Design X, phased; no host-page write-back
- source: .planning/product/PRODUCT_SPEC.md (§23, §17.7)
- status: proposed
- decision: PersonaProfile + PersonaInjector in Phase 3 with config in PreferenceMemoryStore (`np_persona`), never the fact store; RICH implemented on Ant Design X presentation components in Phase 15 sub-waves 15.3/15.4/15.5; host-page write-back deferred — RICH-H-04 Insert = clipboard-only in v0.2, RICH-H-07 deferred.
- scope: persona; RICH UI; side panel/standalone chat surfaces

## DEC-SPEC-08: Agent architecture — coordinator platform, single-agent default; human-verified evolution
- source: .planning/product/PRODUCT_SPEC.md (§23, §1.6, §28, §30)
- status: proposed
- decision: Single coordinator-based agent platform where the single-agent path is a one-role CollaborationPlan; multi-role added as data (roles + plans), not a second architecture. Self-learning is human-verified continual evolution — CandidateProposer only proposes; activation requires sandbox eval + human approval. StageEvent is a type only, not an event engine; human-in-the-loop is within-turn `input-required` only; retries are exactly three bounded non-multiplying layers.
- scope: agent runtime; collaboration (Phase 14); evolution (Phase 13); evaluation (Phase 12)

## DEC-SPEC-09: Working memory block; per-call tool approval; external agent frameworks rejected
- source: .planning/product/PRODUCT_SPEC.md (§23, §3.6, §14.5)
- status: proposed
- decision: Working memory = budget-capped Markdown block in UserMemoryStore (≤300 tokens, single-writer, redacted, distinct from persona). Tool approval is dynamic, escalate-only, coordinator-owned, baseline from `toolAutonomy`. External agent frameworks rejected: @ant-design/x-sdk, LlamaIndex Workflows, Mastra — patterns borrowed, runtime owned.
- scope: memory; tool governance (Phase 18); dependencies

## DEC-SPEC-10: §27.8 D-01…D-08 (LLM-Wiki / notes decisions)
- source: .planning/product/PRODUCT_SPEC.md (§27.8)
- status: proposed
- decision: D-01 single LLM call for tags+category+summary; D-02 notes dual-friendly (human body, machine frontmatter); D-02a OKF-aligned frontmatter; D-03 category path-based (1:1 folders) separate from tags; D-04 LLM wikilink suggestions dropped from v0.2; D-05 notes feed MemoryEngine, not the reverse; D-06 maintenance user-initiated (no background jobs in MV3); D-07 fast tier for analysis, balanced for synthesis; D-08 backup handle stored in IndexedDB.
- scope: LLM-Wiki; note-taking; sync; memory integration

## DEC-SPEC-11: RICH reconciliations R1 and R2 (MANDATORY)
- source: .planning/product/PRODUCT_SPEC.md (§17.7.5)
- status: proposed
- decision: R1 — No host-page write-back in v0.2: "Insert into page" degrades to clipboard-only, "Fill this field" is deferred; content scripts extraction-only; retained actions: Copy code, Save as macro, Save to note. R2 — Persona is user config, not an inferred fact: persists in PreferenceMemoryStore (`np_persona`) / UserPreferences.personaId + personaOverrides, never in UserMemoryStore.
- scope: RICH actions; persona persistence; content scripts; post-v0.2 page injection

## DEC-HTML-01: Remove the raw model selector from Chat — use workflow selector + TierResolver
- source: .planning/design/NOWPILOT_DETAILED_UI_UX_LAYOUT_GSD_GUIDE.html
- status: proposed
- decision: Show a Workflow selector, not a model selector. Each workflow defines its capability tier, tools, context and confirmation behaviour; TierResolver chooses the concrete provider/model. The resolved provider/model appears read-only in Activity details and Diagnostics; provider/model enablement and workflow-to-tier mapping live in Standalone Options; failure returns a typed "No compatible model configured" result with a direct Options action.
- scope: Side Panel composer; Standalone composer; workflow routing; Options

## Operator decisions (locked 2026-09-20 — resolved ingest conflicts W1–W6)

- **DEC-OP-01 (W1): Side Panel is Chat-only.** Allowed: Chat; workflow selection; page context; attachments; chat history; new chat; Options action; Switch to Full chat; lightweight Save to note hand-off; Help and Feedback. Standalone-only surfaces: Agent, Notes, Write, Tools, TeamGQM, Options, Diagnostics. Add-ons register Standalone pages and Side Panel chat-safe entry actions only. Phase 17 adds no Side Panel pages.
- **DEC-OP-02 (W2): No snip/screenshot control in the Side Panel composer.** Toolbar: workflow selector (left) · Attach · Chat history · New chat (right). Screenshot/region-capture is deferred beyond v0.2.
- **DEC-OP-03 (W3): Standalone Sider canonical set.** Primary: Chat · Agent · Note · Write · Tools. Add-ons group: TeamGQM (feature-gated) + future approved add-ons. Bottom: Settings (Diagnostics via Settings, not a primary Sider item). User-facing label `Note` (singular).
- **DEC-OP-04 (W4): Message action sets.** Side Panel assistant 7: Copy · Save to note · Like · Dislike · Regenerate · Share · Read aloud. Standalone assistant 8: Copy · Save to note · Like · Dislike · Regenerate · Quote · Share · Read aloud. Standalone user 4: Edit · Copy · Share · Read aloud. No Expand message action; Activity expansion is controlled by the Activity disclosure; RICH-C-09 controls stay separate.
- **DEC-OP-05 (W5): Canonical current release label is v0.2.** Active text updated; deferrals use "later release" phrasing; historical/external version references unchanged.
- **DEC-OP-06 (W6): Visual references under `.planning/design/references/{sidepanel,standalone,notes,options,themes}/`.** `.planning/mockup/` is not used. Acceptance-gate filenames are declared under the appropriate canonical subdirectory.
