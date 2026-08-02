# NowPilot

## What This Is

NowPilot is a privacy-first, extensible Chrome MV3 extension AI assistant and personal knowledge platform. It provides AI chat with streaming/abort, agentic tool-calling with evidence-backed completion and trust-aware context, governed memory (working/episodic/semantic/preference/procedural), tool capability manifests, atomic note-taking with wikilinks and a note graph, an LLM-Wiki knowledge layer (auto-tagging, RAG, filesystem sync), trajectory evaluation with golden suites, verified continual evolution, bounded multi-role collaboration, multimodal input (image/audio), and a RICH conversational UX across two surfaces — a Chrome Side Panel for quick workflows and a Full App Tab for deep work. Everything runs locally against user-configured AI providers.

## Core Value

Users can acquire knowledge from web pages, store it as interconnected atomic notes, understand it through AI enrichment (tagging/summary/RAG), and interact with it through a persona-driven, intention-aware conversational workspace — all running locally on their machine.

## Current State

Phase 05 complete — Knowledge Base. Atomic notes are fully operational: Zod-validated notes with Obsidian-compatible wikilinks (`[[title]]`, `[[title|alias]]`, `[[title#section]]`), NotesDB with WriteJournal crash-consistency (executor registry + startup replay), persistent MiniSearch BM25 index with `<mark>` snippets (search verified <50ms @ 1,000 notes: avg 0.33ms), and a NoteGraph with dynamic backlinks and 50/20/30 hybrid similarity. The memory subsystem is complete: MemoryRecord schemas, D-08 weighted MemoryScorer, three persistent stores (Conversation with 12-message LLM summarization, User facts with immutable confidence, Preferences), and a MemoryEngine orchestrator with tier-gated retrieval, single-writer enforcement (BroadcastBus primary-surface election, wired into all 3 entrypoints), and journaled writes. Memory context feeds every AI turn (createAgentTurnInputWithMemory, loadPersonaFromMemory). 142/142 phase-5 gate tests, 13/13 threats closed, 10/10 code-review findings fixed. Prior: Phase 04b complete — Trust-Aware Context & Receipts. Layered extraction pipeline (content script → MessageBus → PageContentService → Defuddle→Readability→ApcLite strategies), 2.9KB content bundle with zero forbidden imports, D-02 password/secret redaction at every boundary (clone-based DomSerializer, strategy value guards, 4-term allowlist), per-tab MiniSearch index with SPA-nav invalidation, mode-keyed cache (tabId:mode:url). 263+ extraction/security tests passing, all 25 UAT checks verified including live extension boot.

## Current Milestone: v0.1 NowPilot Initial Release

**Goal:** Build the full NowPilot v0.1 — a privacy-first Chrome MV3 AI assistant and personal knowledge platform with two UI surfaces, cost-effective AI pipeline, persistent memory, LLM-Wiki, layered page extraction, add-ons, and RICH conversational UX.

**Target features:**
- Dual-surface shell (Side Panel + Full App Tab) with shared WorkspaceStore
- 4-provider AI pipeline (Planner→Executor→Renderer) with ContextOptimizer + PromptCache
- Agent runtime reliability — explicit trajectory states, evidence-backed completion, structured turn outcomes, deterministic replanning (Rev. C)
- Trust-aware context engineering — ContextItem contracts, prompt-injection isolation, context receipts, stable-prefix contract, progressive skill disclosure (Rev. C)
- Persistent memory (conversation + user facts + preferences + persona)
- Memory governance — taxonomy (working/episodic/semantic/preference/procedural), lifecycle, conflict resolution, user controls, procedural experience store (Rev. C)
- Tool governance — ToolCapabilityManifest, risk-based execution, postcondition verification, idempotency, active discovery (Rev. C)
- PageContentService with layered Defuddle→APC-lite extraction + MiniSearch index
- Atomic notes + wikilinks + note graph + LLM-Wiki (auto-tag/RAG/filesystem sync)
- AITransactionLog + TraceRedactor + DiagnosticsPanel
- Agent evaluation — versioned golden suites, trajectory rubric, layered validators, failure taxonomy, release regression gates (Rev. C)
- Verified continual evolution — evidence-to-candidate pipeline, sandbox/approval/rollout, no self-modification (Rev. C)
- Bounded multi-role collaboration — closed role registry, typed handoff artefacts, single coordinator/permission/commit authority, single-agent baseline gate (Rev. C)
- Multimodal input — image paste/upload analysis, voice transcription, interruption/cancellation (Rev. C)
- 12 built-in MCP tools + external MCP client (StreamableHTTP)
- 4 add-ons (ServiceNow, Write, TeamGQM, Research)
- RICH UX (persona, welcome/intent, clarification/follow-up, hybrid UI actions)
- Encrypted storage, WriteJournal, IndexedDB migrations v1→v4
- Security hardening + 19 phase verification scripts (Rev. C adds 3a, 4b, 5b, 6a, 6b, 6c, 7a, 8a)

## Context

- **Target runtime:** Chrome MV3 extension using WXT + React 19 + TypeScript (strict mode) + Ant Design v6 + Ant Design X 2.x
- **AI providers:** OpenAI, Anthropic, Gemini, Ollama via @ai-sdk/* adapters
- **Architecture:** Core layer (AI, storage, memory, extraction, notes) + Add-on layer (site-specific, first-party add-ons)
- **Two UI surfaces:** Side Panel (~400px, compact) for daily workflow; Full App Tab (full viewport) for deep work, configuration, diagnostics
- **Cost-effective runtime:** PlannerService (cheap haiku JSON decisions) → ExecutorService (deterministic tool validation/execution) → RendererService (concise flash answers), with agent step limits by context tier
- **Prior work:** Existing codebase has a `.planning/PRODUCT_SPEC_v0_1.md` as the canonical specification (Rev. C, 2026-07-31 — adds §§28-32 verified agent harness, multimodal, multi-agent; retains all Rev. B content). An implementation amendment lives at `.planning/PRODUCT_REQUIREMENTS_AGENT_HARNESS.md`.

## Constraints

- **Tech stack:** WXT ^0.19, React ^19, antd ^6, @ant-design/x ^2, @ant-design/x-markdown ^2, Zustand ^5, ai ^7, @ai-sdk/* ^4, zod ^4, MiniSearch ^7, idb ^8, motion ^12, yaml ^2, defuddle ^0.6 — NO tailwindcss, shadcn/ui, @radix-ui/react-*, @ant-design/x-sdk, @ant-design/x-card, framer-motion, or @anthropic-ai/sdk directly
- **MV3 rules:** No AI/MCP/IndexedDB in background SW; no custom User-Agent; no eval/remote code; content scripts extraction-only (no UI rendering, no host-page write-back in v0.1)
- **Two surfaces, one workspace:** Side Panel and Full App share WorkspaceStore with single-writer primary election via BroadcastBus
- **Page injection:** Deferred to v0.2+; v0.1 has no Shadow DOM, no host-page UI
- **Performance:** Side panel < 300ms paint, Full App < 500ms, first token < 2s local / < 3s cloud, content script bundle < 50KB

## Requirements

### Validated

- [x] **AI-01**: Four provider adapters (OpenAI, Anthropic, Gemini, Ollama) with ProviderRouter fallback/circuit-breaker — Phase 3
- [x] **AI-02**: PlannerService → ExecutorService → RendererService pipeline with tier caps — Phase 3
- [x] **AI-03**: PersonaInjector prepends persona block into all AI system prompts — Phase 3
- [x] **CTX-01**: ContextOptimizer with dynamic token budgets, degradation pipeline, and minimal mode for tiny models — Phase 4
- [x] **CTX-02**: PromptCacheManager with per-provider cache-hint transformation (Appendix K) — Phase 4
- [x] **NOTE-01**: Atomic notes with wikilinks, tags, note graph (MiniSearch + cosine similarity), backlinks — Phase 5
- [x] **MEM-01**: Conversation memory (summary + recent turns) + User memory (cross-session facts, scored retrieval) + Preference memory (response style, persona) — Phase 5
- [x] **MEM-02**: Memory writes only from primary surface; secondary surfaces mirror read-only — Phase 5

### Active

- [ ] **SHELL-01**: Side Panel opens with onboarding, chat, agent, write, TeamGQM, and Open Full App surfaces
- [ ] **SHELL-02**: Full App Tab opens with chat, agent, notes, TeamGQM, and options (all configuration/diagnostics)
- [ ] **SHELL-03**: Shared WorkspaceStore across both surfaces with handoff (Flow 11)
- [ ] **SHELL-04**: Theme toggle (light/dark/auto) affects both surfaces immediately
- [ ] **SHELL-05**: Cmd+K command palette on both surfaces
- [x] **AI-01**: Four provider adapters (OpenAI, Anthropic, Gemini, Ollama) with ProviderRouter fallback/circuit-breaker
- [x] **AI-02**: PlannerService → ExecutorService → RendererService pipeline with tier caps (Appendix I)
- [x] **AI-03**: PersonaInjector prepends persona block into all AI system prompts (RICH-R-01/02)
- [ ] **AI-04**: P0 Interaction — Welcome cards, context-aware quick-action chips, clarification chips, follow-up chips (RICH P0)
- [x] **PAGE-01**: PageContentService with layered extraction (Defuddle → APC-lite → ServiceNow API), ephemeral MiniSearch index, per-tab cache with SPA-nav invalidation — Phase 4a
- [ ] **NOTE-02**: LLM-Wiki — auto-tag/category/summary via single haiku call, RAG "Ask notes" with citations, chat/page-to-note conversion
- [ ] **NOTE-03**: One-way filesystem sync (app→FS .md with YAML frontmatter) and restore-from-folder with additive upsert
- [ ] **DIAG-01**: AITransactionLog with prompt/tool/provider traces, TraceRedactor, DiagnosticsPanel in Full App → Options
- [ ] **STORAGE-01**: Encrypted API keys (AES-GCM), WriteJournal multi-store consistency, IndexedDB migrations (v1→v4)
- [ ] **STORAGE-02**: Session tokens in chrome.storage.session, message bodies in IndexedDB, workspace in chrome.storage.local
- [ ] **TOOL-01**: 12 built-in MCP tools (get-page-content, search-notes, create-note, chat history, pin-tab, read/write clipboard, provider info, run-skill, list-skills, export-data, execute-webhook)
- [ ] **TOOL-02**: External MCP client with StreamableHTTP transport and permission gating
- [ ] **ADDON-01**: ServiceNow add-on (session extraction, case context, table API, CaseAnalyzer/CatchUp/Sentiment/CodeSearch skills)
- [ ] **ADDON-02**: Write add-on (rewrite/summarize/draft/explain/create-plan/generate-status, side-panel-only)
- [ ] **ADDON-03**: TeamGQM add-on shell (both surfaces)
- [ ] **ADDON-04**: Research global tool via MCP web-search
- [ ] **RICH-01**: Persona profile, injector, consistent identity across surfaces/modes, onboarding persona card (RICH R P0/P1)
- [ ] **RICH-02**: Welcome cards, context-aware quick-action chips, IntentClassifier (URL-pattern, no LLM), Sender templates popover (RICH I P0/P1)
- [ ] **RICH-03**: AI-initiated clarification chips (max 2 rounds), follow-up suggestion chips (non-blocking, graceful timeout), closure zone (RICH C P0/P1)
- [ ] **RICH-04**: Persona header, code-block actions (Copy/Save-as-macro, Insert=clipboard-only), "Save to note" button, streaming stage indicators (RICH H P0/P1)
- [ ] **SEC-01**: XSS prevention (PortableMarkdown via x-markdown, DOMPurify), sender validation, CSP, secret redaction in all logs/exports/backups
- [ ] **TEST-01**: Phase-level verification scripts (verify:phase-1 through verify:phase-9), isolation tests (no React/AntD/defuddle/yaml in content bundle), performance tests

### Agent Reliability (Rev. C §28.2)

- [x] **AGT-01** (P0): Explicit trajectory states (assembling-context → planning → waiting-for-permission → executing → verifying → replanning → rendering → completed/failed/aborted) with state-transition validation — Validated in Phase 3a
- [x] **AGT-02** (P0): Evidence-backed completion — side-effecting tasks require verified CompletionEvidence; RendererService must not claim writes without matching evidence — Validated in Phase 3a
- [x] **AGT-03** (P0): Structured AgentTurnOutcome on every exit path; cap exhaustion is partial not completed; abort does not render success — Validated in Phase 3a
- [x] **AGT-04** (P0): Deterministic replanning policy — success→verify, retryable→one replan, permission/auth→terminal; no retry after irreversible action — Validated in Phase 3a

### Trust-Aware Context Engineering (Rev. C §28.3)

- [x] **CTX-T01** (P0): ContextItem carries relevance, freshness, trust, sensitivity, and instruction-authority metadata; secret items excluded from cloud prompts — Validated in Phase 04b
- [x] **CTX-T02** (P0): Prompt-injection isolation — page/note/memory/tool data cannot redefine system instructions, grant tool permission, or change risk classifications — Validated in Phase 04b
- [x] **CTX-T03** (P0): Context receipt (ContextReceiptEntry) records inclusion, omission reasons, compression, and cache eligibility per source — Validated in Phase 04b
- [x] **CTX-T04** (P0): Stable-prefix contract — persona/system rules/sorted tool schemas must be byte-identical for identical configuration; snapshot tests required — Validated in Phase 04b
- [x] **CTX-T05** (P1): Progressive skill disclosure — irrelevant full instructions consume zero prompt tokens; receipt records loaded/unloaded skills — Mechanics validated in Phase 04b; skill-selection integration in Phase 7
- [ ] **CTX-T06** (P1): Context quality telemetry — injected-source count, utilization %, compression ratio, omission reasons, provenance coverage — Structural prep delivered in Phase 04b; aggregation in Phase 6a

### Memory Governance (Rev. C §28.4)

- [ ] **MEM-G01** (P0): Memory taxonomy includes working, episodic, semantic, preference, and procedural records; notes remain user-owned outside MemoryDB
- [ ] **MEM-G02** (P0): Durable MemoryRecord requires source, confidence, lifecycle (active/superseded/disputed/forgotten), sensitivity, and verification timestamps
- [ ] **MEM-G03** (P0): Conflict resolution precedence — explicit user correction > verified current state > previous explicit memory > inference; contradictions preserved as history
- [ ] **MEM-G04** (P0): User memory controls — view, source, confidence, edit, pin, forget, disable by type, export, and cloud-exclusion (UI in Phase 7)
- [ ] **MEM-G05** (P1): ProceduralExperience store — verified-trajectory candidates require evaluation and approval before activation
- [ ] **KNW-01** (P1): Knowledge-edge provenance (explicit-wikilink/imported-frontmatter/ai-suggested/accepted-suggestion); AI-suggested edges remain proposals until accepted

### Tool Governance (Rev. C §28.5)

- [ ] **TOL-01** (P0): Every tool has a ToolCapabilityManifest with category, risk, sideEffect, permissions, dataScopes, timeout, costClass, idempotency, verifier, and schema hashes
- [ ] **TOL-02** (P0): Risk-based execution matrix — read-only+low-risk auto, reversible writes require confirmation, irreversible/high-risk always preview+confirm
- [ ] **TOL-03** (P0): Postcondition verification — every side-effecting tool declares a verifier; unverified transport success is partial, not completed — Phase 3a delivers operation-scoped evidence verification + idempotency ledger; full manifest/tool coverage in Phase 8a
- [x] **TOL-04** (P0): Tool result shaping — validate output schema, redact secrets, apply max size, summarise/retrieve relevant, assign provenance/trust metadata before context re-entry — ToolResultShaper delivered in Phase 04b; ExecutorService wiring in Phase 8a
- [ ] **TOL-05** (P0): Idempotency — write tools accept or derive an idempotency key; replay must not repeat external effects
- [ ] **TOL-06** (P1): Active tool discovery — when schemas exceed budget, expose small core set + discover-tools capability with permission checks
- [ ] **TOL-07** (P2): Long-running async operation contract — operationId, status, progress, cancellation, checkpoint, resume, idempotency (deferred to future 8b)

### Agent Evaluation (Rev. C §28.6)

- [ ] **EVAL-01** (P0): Versioned golden suites — planner, context, tools, permissions, providers, memory, RAG, completion evidence, multimodal routing
- [ ] **EVAL-02** (P0): Trajectory rubric — independent outcome, process, safety, grounding, memory, quality, latency, and cost dimensions; safety dimensions are blocking
- [ ] **EVAL-03** (P0): Layered validators — environment/code validators > process validators > calibrated LLM judges (only for qualitative dimensions)
- [ ] **EVAL-04** (P0): Failure taxonomy (FailureLayer) — context/planning/tool-selection/tool-arguments/permission/execution/verification/rendering/memory/provider/multimodal/user-abort; diagnostics show first failing layer
- [ ] **EVAL-05** (P0): Release regression gate — relevant golden suite must run after model/prompt/tool/retrieval/memory/compression/persona/multimodal changes; blocking regressions include permissions, secrets, injection, false-completion, citations, isolation
- [ ] **EVAL-06** (P1): Cost/latency/quality frontier — Pareto comparisons across tier/provider combinations
- [ ] **EVAL-07** (P1): Judge calibration — expert-labelled calibration set, per-dimension agreement reporting, re-calibration on model/rubric changes

### Verified Continual Evolution (Rev. C §28.7)

- [ ] **EVO-01** (P1): Evidence-to-candidate pipeline — verified trajectory → evaluation → diagnosis → candidate → sandbox replay → security gates → approval → rollout → monitor → promote/rollback
- [ ] **EVO-02** (P1): Single target layer per candidate — knowledge/retrieval/instruction/experience/tool/workflow/model-tier
- [ ] **EVO-03** (P1): EvolutionCandidate contract — id, targetLayer, diagnosis, proposedChange, evidenceRefs, baseline/candidate/security results, version, status, rollbackRef
- [ ] **EVO-04** (P0): No direct self-modification — untrusted pages/notes/uploads/tool output/raw traces must never directly rewrite active prompts, permissions, tools, or procedural memory
- [ ] **EVO-05** (P1): Sandbox, approval, rollout, rollback — every candidate requires affected golden suites, security tests, explicit approval, versioning, scoped rollout, monitoring
- [ ] **EVO-06** (P2): Agent-generated tool proposals — sandbox only; require static checks, dependency allowlist, declared permissions, network disabled by default, tests, approval, no self-publish

### Bounded Multi-Agent Collaboration (Rev. C §32)

- [ ] **COLLAB-01** (P1): Explicit activation gate — collaboration starts only on user selection or deterministic complexity policy + user preference; planner may recommend but not silently enable
- [ ] **COLLAB-02** (P1): Closed role registry (coordinator/investigator/researcher/implementer/reviewer/renderer) — roles registered in code, not invented at runtime; restricted tool allowlists and context projections
- [ ] **COLLAB-03** (P1): CollaborationPlan — staged-shared-context only; max 3 active specialist roles + coordinator/reviewer pipeline; caps are product policy, not LLM-configurable
- [ ] **COLLAB-04** (P1): Typed AgentHandoffArtifact — facts with source-level provenance, open questions, output refs; no hidden reasoning exchanged
- [ ] **COLLAB-05** (P0): Single coordinator and permission authority — only CollaborationCoordinator sequences roles, requests permissions, commits side effects, or terminates; workers cannot self-grant
- [ ] **COLLAB-06** (P0): Single commit authority — only coordinator/commit stage may execute side-effecting tools, write durable memory, modify notes, activate evolution candidates, or export data
- [ ] **COLLAB-07** (P1): Independent review — high-impact outputs require a reviewer role that did not create the candidate; reviewer can approve/reject/request one correction cycle
- [ ] **COLLAB-08** (P1): Failure containment — role failure returns typed partial result; coordinator may retry once, substitute role/model, continue reduced, fall back to single-agent, or terminate with explanation
- [ ] **COLLAB-09** (P1): Context strategy — staged roles share one OptimizedContext plus projections; if projected context > 50% window, switch to isolated handoff or stop; notes/files stored by reference
- [ ] **COLLAB-10** (P1): Collaboration trace — activation reason, roles/policies, context sources, handoff references, tool/permission decisions, per-role and total tokens/cost/latency, reviewer decision, completion evidence
- [ ] **COLLAB-11** (P1): Single-agent baseline gate — collaboration cannot ship unless golden suite shows improvement in ≥1 quality dimension without breaching safety/cost/latency limits
- [ ] **COLLAB-12** (P2): Parallel isolated workers — deferred to future Phase 8b; independent, parallelisable sub-tasks with isolated contexts and validated handoff artefacts
- [ ] **COLLAB-13** (P0): Multi-agent hard boundaries — DO NOT: open-ended agent-to-agent chat, dynamic role creation, worker side effects, worker memory writes, agent-to-agent permission grants, secret sharing, default collaboration for routine tasks, agreement-as-verification, budget/deadline overrun

### Multimodal Input (Rev. C §29)

- [ ] **MM-01** (P1): Normalised ModalityInput — text/image/audio/document; binary payloads never enter PromptSection directly
- [ ] **MM-02** (P1): ModalityObservation contract — passes through ContextOptimizer, provenance, redaction, trust, and token budgets like other data sources
- [ ] **MM-03** (P1): Image paste/upload analysis — error screenshots, diagrams, UI-state interpretation, screenshot-to-note; route only to vision-capable provider, no silent local→cloud switch
- [ ] **MM-04** (P1): Voice input as editable transcription — microphone → SpeechInputAdapter → partial/final transcript → editable Sender → explicit Send; no tool executes from unconfirmed partial transcript
- [ ] **MM-05** (P2): Fast/slow interaction split — fast path handles listening/transcription/cancel; slow path handles context/planning/tools/rendering; fast path cannot perform irreversible actions (future Phase 7b)
- [ ] **MM-06** (P1): Interruption and cancellation — multimodal session state (listening/transcribing/ready/thinking/speaking/interrupted/cancelled); AbortSignal propagates through all active pipeline stages
- [ ] **MM-07** (P0): Computer use remains deferred — APC-lite does not authorise click/type automation; future spec must define debugger permission, domain allowlists, and evaluation fixtures

### Out of Scope

- Page injection (Shadow DOM UI, floating widgets, host-page write-back) — deferred to v0.2+
- PDF chat — out of scope
- Embedding-based semantic search — bag-of-words + MiniSearch sufficient; LLM-routed reranking used instead
- Bidirectional filesystem sync — one-way app→FS only; restore for import
- TTS output — voice input only (Web Speech); output deferred
- A2UI (@ant-design/x-card) — deferred to v0.2+
- @ant-design/x-sdk (useXChat/ChatProvider) — explicitly excluded; AgentOrchestrator/ProviderRouter/ContextOptimizer own the data flow
- Real-time chat, video posts, OAuth login — N/A (not a social/community app; it's a personal knowledge assistant)
- Mobile app — Chrome extension only
- Open-ended agent-to-agent conversation — bounded multi-role only; no dynamic unbounded agent spawning
- Click/type automation (computer use) — APC-lite does not authorise page automation; deferred to v0.2+/v2
- Agent-generated tools self-publishing — sandbox proposals only; require static checks, approval, no self-publication

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Ant Design v6 + Ant Design X 2.x as UI stack | Enterprise components, mature forms/tables, streaming markdown, RICH paradigm support | — Pending |
| NOT @ant-design/x-sdk | Would let UI call providers directly, bypassing Planner→Executor→Renderer, ContextOptimizer, MemoryEngine | — Pending |
| Two surfaces (Side Panel + Full App) | Side panel for daily workflow, full app for deep work/config/diagnostics | — Pending |
| Content scripts extraction-only in v0.1 | Reduces complexity; add-on architecture preserved for future page injection | — Pending |
| PageContentService as core infra (Phase 4a) | Shared across chat/agent/summarize/research/add-ons; central cache/concurrency/redaction | — Pending |
| Knowledge-first phase ordering (acquire→store→understand→display→extend→harden) | Matches product value (Copilot + Obsidian + NotebookLM); notes/LLM-Wiki are core, not late add-ons | — Pending |
| Single haiku call for note enrichment (tags+category+summary+memory) | Cheaper/faster than separate calls per enrichment task | — Pending |
| Persona as user config in PreferenceMemoryStore, NOT an inferred fact in UserMemoryStore | Persona is identity/behavior config; the memory system owns facts (reconciliation R2) | — Pending |
| No host-page write-back in v0.1 (clipboard-only for insert) | Extraction-only rule; write-back needs v0.2+ page injection (reconciliation R1) | — Pending |
| Defuddle over Readability for main-content extraction | Purpose-built successor; preserves footnotes/math/code; richer metadata; MIT | — Pending |
| Cost-effective runtime (Haiku/Flash tier for planning, Flash for rendering) | No dependency on large models; works with local/cheap providers | — Pending |
| PlannerDecisionSchema as 3-branch discriminated union (answer/run_tool/ask_clarification) | Safe for cheap models; ExecutorService validates all tool calls deterministically | — Pending |
| Character-based token estimation over js-tiktoken (D-10) | Avoids a new native dependency; CJK-aware (char/3) vs English (char/4); js-tiktoken verified but skipped | ✓ Phase 4 |
| 7-step immutable degradation policy with append-only stepsApplied | Order is a private readonly constant — external input cannot reorder; audit trail from provenance | ✓ Phase 4 |
| Single-call AI summarization overflow (no iterative loop) | One generateText via cheapest compression provider, then a single final budget check; graceful fallback on failure | ✓ Phase 4 |
| FNV-1a non-cryptographic cache key hash | Collisions → cache miss only, never a security issue; hashes stable sections (system prompt/tool schemas) | ✓ Phase 4 |
| In-memory cache health (5-miss cascade, 60s cooldown) | Per-provider missStreak/disabledUntil resets on SW restart; Phase 6 AITransactionLog will persist telemetry | ✓ Phase 4 |
| Clone-based redaction — never mutate the live document | Setting `field.value = ''` would wipe the user's typed password; redaction runs on `doc.cloneNode(true)` with `removeAttribute('value')` (IDL property vs content attribute decoupling) | ✓ Phase 4a |
| `defuddle/full` subpath import | Main entry's `markdown: true` is inert; `/full` wraps parse() with toMarkdown — delivers the markdown output the pipeline needs | ✓ Phase 4a |
| MiniSearch.removeAll over discard(id) | discard defers inverted-index cleanup to auto-vacuum — stale results on next query; removeAll with full docs cleans immediately | ✓ Phase 4a |
| Cache key ordering `tabId:mode:url` everywhere | Standardized across cache Map and in-flight coalescing Map — mode is part of cache identity, cross-mode serving impossible | ✓ Phase 4a |
| D-02 contains-match regex + 4-term allowlist | `passenger\|passport\|compass\|bypass` only; passcode/passage stay redacted (err on false positive); shared `isPasswordFieldName` at both redaction sites | ✓ Phase 4a |
| happy-dom per-file test environment | jsdom's nwsapi can't compile defuddle's `:has(source)` selectors; happy-dom exercises the real production pipeline | ✓ Phase 4a |
| Agent harness upgrade strengthens bounded loop, does not increase autonomy | NowPilot already uses Planner→Executor→Renderer; the upgrade adds trajectory states, evidence, governance — agent stays bounded by tier caps (Rev. C §28.1) | — Pending |
| Bounded multi-role collaboration, not autonomous agent society | Single orchestrator + staged specialist roles + shared verified state; parallel isolated workers deferred (Rev. C §32.1/COLLAB-12) | — Pending |
| Routines stay single-agent; collaboration is gated | User must explicitly select collaborative workflow or policy must match; planner may recommend but cannot silently enable (Rev. C COLLAB-01) | — Pending |
| Evidence-backed completion required for side-effecting tools | Transport success alone is insufficient; OutcomeVerifier checks postconditions before RendererService claims completion (Rev. C AGT-02) | — Pending |
| No self-modification — evolution is sandboxed | Untrusted data cannot directly rewrite active prompts/tools/permissions/procedural memory; EvolutionCandidate requires approval→rollout→monitor→rollback (Rev. C EVO-04/EVO-05) | — Pending |
| Multimodal data follows explicit provider/privacy policy | Image only to vision-capable providers; no silent local→cloud switch; blobs operation-scoped; raw images never logged (Rev. C MM-03) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-02 after Phase 05 completion (Knowledge Base)*
