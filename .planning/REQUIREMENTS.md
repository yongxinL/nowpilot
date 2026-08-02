# Requirements: NowPilot

**Defined:** 2026-07-28
**Core Value:** Users can acquire knowledge from web pages, store it as interconnected atomic notes, understand it through AI enrichment, and interact with it through a persona-driven conversational workspace — all running locally.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Shell

- [ ] **SHELL-01**: User can open the Side Panel with onboarding, chat, agent, write, TeamGQM, and Open Full App surfaces
- [ ] **SHELL-02**: User can open the Full App Tab with chat, agent, notes, TeamGQM, and options (all configuration/diagnostics)
- [x] **SHELL-03**: User has a shared workspace that persists across Side Panel and Full App Tab with handoff between surfaces
- [x] **SHELL-04**: User can toggle theme (light/dark/auto) and it affects both surfaces immediately
- [x] **SHELL-05**: User can invoke Cmd+K command palette on both surfaces

### AI Pipeline

- [x] **AI-01**: User can configure four AI providers (OpenAI, Anthropic, Gemini, Ollama) with automatic fallback and circuit breaker
- [x] **AI-02**: User interactions flow through PlannerService → ExecutorService → RendererService with tier-based step limits
- [x] **AI-03**: User's persona configuration is injected into every AI system prompt via PersonaInjector
- [ ] **AI-04**: User sees welcome cards, context-aware quick-action chips, clarification chips, and follow-up chips (RICH P0 interactions)

### Context

- [x] **CTX-01**: User's prompts are optimized with dynamic token budgets, degradation pipeline, and minimal mode for tiny models
- [x] **CTX-02**: User benefits from prompt caching with per-provider cache-hint transformation

### Memory

- [x] **MEM-01**: User's conversation memory (summary + recent turns), cross-session user facts (scored retrieval), and preferences persist across sessions
- [x] **MEM-02**: User's memory writes only happen from the primary surface; secondary surfaces reflect read-only

### Page Extraction

- [x] **PAGE-01**: User can extract page content via layered extraction (Defuddle → APC-lite) with ephemeral MiniSearch index and per-tab SPA-nav cache

### Notes & Knowledge

- [x] **NOTE-01**: User can create atomic notes with wikilinks, tags, note graph (MiniSearch + cosine similarity), and backlinks
- [x] **NOTE-02**: User can enrich notes via LLM-Wiki (auto-tag/category/summary in one call), ask notes via RAG with citations, and convert chat/page to notes
- [ ] **NOTE-03**: User can sync notes one-way to filesystem (.md with YAML frontmatter) and restore from folder with additive upsert

### Diagnostics

- [ ] **DIAG-01**: User can view AI transaction logs, prompt/tool/provider traces, redacted traces, and diagnostics panel in Full App → Options

### Storage

- [ ] **STORAGE-01**: User's API keys are encrypted (AES-GCM), multi-store writes are consistent (WriteJournal), IndexedDB is migrated (v1→v4)
- [ ] **STORAGE-02**: User's session tokens are in chrome.storage.session, message bodies in IndexedDB, workspace state in chrome.storage.local

### Tools

- [ ] **TOOL-01**: User can invoke 12 built-in MCP tools (get-page-content, search-notes, create-note, chat history, pin-tab, read/write clipboard, provider info, run-skill, list-skills, export-data, execute-webhook)
- [ ] **TOOL-02**: User can connect external MCP servers via StreamableHTTP transport with permission gating

### Add-ons

- [ ] **ADDON-01**: User can use ServiceNow add-on (session extraction, case context, table API, CaseAnalyzer/CatchUp/Sentiment/CodeSearch skills)
- [ ] **ADDON-02**: User can use Write add-on (rewrite/summarize/draft/explain/create-plan/generate-status)
- [ ] **ADDON-03**: User can access TeamGQM add-on shell on both surfaces
- [ ] **ADDON-04**: User can trigger research via global MCP web-search tool

### RICH UX

- [ ] **RICH-01**: User can configure persona profile (name, tone, brevity) with consistent identity across surfaces and onboarding persona card
- [ ] **RICH-02**: User sees welcome cards, context-aware quick-action chips, IntentClassifier (URL-pattern), and Sender templates popover
- [ ] **RICH-03**: User receives AI-initiated clarification chips (max 2 rounds), follow-up suggestion chips (non-blocking with graceful timeout), and closure zone
- [ ] **RICH-04**: User sees persona header, code-block actions (Copy/Save-as-macro, Insert=clipboard-only), Save-to-note button, and streaming stage indicators

### Security

- [ ] **SEC-01**: User is protected against XSS (x-markdown + DOMPurify), sender validation, CSP enforcement, and secret redaction in all logs/exports/backups

### Testing

- [ ] **TEST-01**: Phase verification scripts (verify:phase-1 through verify:phase-9), isolation tests (no React/AntD in content bundle), and performance tests exist

### Agent Reliability (Rev. C §28.2 — Phase 3a)

- [x] **AGT-01** (P0): Explicit trajectory states (assembling-context → planning → waiting-for-permission → executing → verifying → replanning → rendering → completed/failed/aborted) — state transitions validated, invalid transitions rejected
- [x] **AGT-02** (P0): Evidence-backed completion — side-effecting tasks require CompletionEvidence; RendererService must not claim writes without verified postconditions
- [x] **AGT-03** (P0): Structured AgentTurnOutcome on every exit path — cap exhaustion is partial (not completed), abort does not render success
- [x] **AGT-04** (P0): Deterministic replanning policy — success→verify→render, retryable→one replan, permission/auth→terminal, no retry after irreversible

### Trust-Aware Context (Rev. C §28.3 — Phase 4b)

- [ ] **CTX-T01** (P0): ContextItems carry relevance, freshness, trust, sensitivity, and instruction-authority — secret items excluded from cloud
- [ ] **CTX-T02** (P0): Prompt-injection isolation — untrusted data cannot redefine system instructions, grant tool permission, or change risk classifications
- [ ] **CTX-T03** (P0): Context receipts record inclusion, omission, compression, and cache eligibility per source without exposing raw sensitive text
- [ ] **CTX-T04** (P0): Stable-prefix contract — persona/system rules/sorted tool schemas byte-identical for identical config; snapshot tests guard
- [ ] **CTX-T05** (P1): Progressive skill disclosure — irrelevant full instructions consume zero prompt tokens; receipt tracks loaded/unloaded
- [ ] **CTX-T06** (P1): Context quality telemetry — injected-source count, utilization %, compression ratio, omission reasons, provenance coverage

### Memory Governance (Rev. C §28.4 — Phase 5b)

- [ ] **MEM-G01** (P0): Memory taxonomy (working/episodic/semantic/preference/procedural) — notes remain user-owned outside MemoryDB
- [ ] **MEM-G02** (P0): MemoryRecords carry source, confidence, lifecycle status, sensitivity, verification timestamps — validation rejects records without source/confidence
- [ ] **MEM-G03** (P0): Conflict precedence: explicit user correction > verified current state > previous explicit > inference — contradictions preserved
- [ ] **MEM-G04** (P0): User memory controls — view, source, confidence, edit, pin, forget, disable by type, export, cloud-exclusion (UI in Phase 7)
- [ ] **MEM-G05** (P1): ProceduralExperience store — candidates from verified trajectories only; not active until evaluation and approval
- [ ] **KNW-01** (P1): Knowledge-edge provenance (explicit-wikilink/imported-frontmatter/ai-suggested/accepted-suggestion)

### Tool Governance (Rev. C §28.5 — Phase 8a)

- [ ] **TOL-01** (P0): Every tool has a ToolCapabilityManifest — category, risk, sideEffect, permissions, dataScopes, timeout, costClass, idempotency, verifier, schema hashes
- [ ] **TOL-02** (P0): Risk-based execution — read-only+low-risk auto, reversible writes→confirm, irreversible/high-risk→preview+explicit confirm
- [x] **TOL-03** (P0): Postcondition verification — side-effecting tools declare a verifier; unverified transport = partial, not completed
- [x] **TOL-04** (P0): Tool result shaping — validate output, redact secrets, apply max size, summarise/retrieve, assign provenance/trust before re-entering context
- [ ] **TOL-05** (P0): Idempotency — write tools accept/derive idempotency key; replay must not repeat external effects
- [ ] **TOL-06** (P1): Active tool discovery — when schemas exceed budget, expose core set + discover-tools with permission checks
- [ ] **TOL-07** (P2): Long-running async operation contract (future Phase 8b — operationId/status/progress/cancel/checkpoint/resume/idempotency)

### Agent Evaluation (Rev. C §28.6 — Phase 6a)

- [ ] **EVAL-01** (P0): Versioned golden suites (planner, context, tools, permissions, providers, memory, RAG, completion evidence, multimodal routing)
- [ ] **EVAL-02** (P0): Trajectory rubric — independent outcome, process, safety, grounding, memory, quality, latency, and cost; safety is blocking
- [ ] **EVAL-03** (P0): Layered validators — environment/code > process > calibrated LLM judges (qualitative only)
- [ ] **EVAL-04** (P0): FailureLayer taxonomy (context/planning/tool-selection/tool-arguments/permission/execution/verification/rendering/memory/provider/multimodal/user-abort)
- [ ] **EVAL-05** (P0): Release regression gate — golden suites must run after model/prompt/tool/retrieval/memory/compression/persona/multimodal changes
- [ ] **EVAL-06** (P1): Cost/latency/quality Pareto comparisons across tier/provider combinations
- [ ] **EVAL-07** (P1): Judge calibration — expert-labelled calibration set, per-dimension agreement reporting, re-calibration

### Continual Evolution (Rev. C §28.7 — Phase 6b)

- [ ] **EVO-01** (P1): Evidence-to-candidate pipeline — verified trajectory → evaluation → diagnosis → candidate → sandbox → security → approve → rollout → monitor → promote/rollback
- [ ] **EVO-02** (P1): Single target layer per candidate (knowledge/retrieval/instruction/experience/tool/workflow/model-tier)
- [ ] **EVO-03** (P1): EvolutionCandidate contract — id, targetLayer, diagnosis, proposedChange, evidenceRefs, results, version, status, rollbackRef
- [ ] **EVO-04** (P0): No direct self-modification — untrusted data never directly rewrites active prompts, permissions, tools, or procedural memory
- [ ] **EVO-05** (P1): Sandbox, approval, rollout, rollback — every candidate requires golden suites, security tests, explicit approval, scoped rollout, monitoring
- [ ] **EVO-06** (P2): Agent-generated tools — sandbox proposals only; static checks, dependency allowlist, network disabled, tests, approval, no self-publish

### Bounded Multi-Agent Collaboration (Rev. C §32 — Phase 6c)

- [ ] **COLLAB-01** (P1): Explicit activation gate — user selection or deterministic complexity policy + user preference; planner cannot silently enable
- [ ] **COLLAB-02** (P1): Closed role registry (coordinator/investigator/researcher/implementer/reviewer/renderer) — code-registered, not runtime-invented
- [ ] **COLLAB-03** (P1): CollaborationPlan — staged-shared-context only; max 3 active specialists + coordinator/reviewer; caps are product policy
- [ ] **COLLAB-04** (P1): Typed AgentHandoffArtifact — source-provenanced facts, open questions, output refs; no hidden reasoning
- [ ] **COLLAB-05** (P0): Single coordinator and permission authority — only coordinator sequences roles, requests permissions, commits side effects, terminates
- [ ] **COLLAB-06** (P0): Single commit authority — only coordinator/commit stage executes side effects, writes memory, modifies notes, activates evolution candidates, exports data
- [ ] **COLLAB-07** (P1): Independent review — reviewer cannot have created the candidate; approve/reject/one correction cycle; rejected→cannot render success
- [ ] **COLLAB-08** (P1): Failure containment — typed partial result; coordinator may retry/substitute/continue reduced/fall back single-agent/terminate
- [ ] **COLLAB-09** (P1): Context strategy — shared OptimizedContext + projections; if >50% context window → isolated handoff or stop
- [ ] **COLLAB-10** (P1): Collaboration trace — activation reason, roles/policies, context sources, handoff references, per-role/total tokens/cost/latency, reviewer decision
- [ ] **COLLAB-11** (P1): Single-agent baseline gate — collaboration ships only if golden suite shows improvement in ≥1 quality dimension without breaching safety/cost/latency
- [ ] **COLLAB-12** (P2): Parallel isolated workers (deferred to future Phase 8b)
- [ ] **COLLAB-13** (P0): Multi-agent hard boundaries — no open-ended chat, dynamic spawning, worker side effects, worker memory writes, agent-agent permission grants, secret sharing, agreement-as-verification, budget/deadline overrun

### Multimodal Input (Rev. C §29 — Phase 7a)

- [ ] **MM-01** (P1): Normalised ModalityInput (text/image/audio/document) — binary payloads never enter PromptSection directly
- [ ] **MM-02** (P1): ModalityObservation passes through ContextOptimizer, provenance, redaction, trust, and token budgets
- [ ] **MM-03** (P1): Image paste/upload analysis — vision-capable provider only; no silent local→cloud; blobs operation-scoped; raw images never logged
- [ ] **MM-04** (P1): Voice input — microphone → transcription → editable Sender → explicit Send; no tool from unconfirmed partial transcript
- [ ] **MM-05** (P2): Fast/slow interaction split (future Phase 7b — fast handles listen/transcribe/cancel; slow handles context/plan/tools)
- [ ] **MM-06** (P1): Interruption and cancellation — multimodal session states; AbortSignal propagates through all active stages
- [ ] **MM-07** (P0): Computer use remains deferred — APC-lite does not authorise click/type automation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Page injection (Shadow DOM UI, floating widgets, host-page write-back) | Deferred to v0.2+; extraction-only in v0.1 |
| PDF chat | Not in core knowledge workflow |
| Embedding-based semantic search | Bag-of-words + MiniSearch sufficient; LLM reranking used instead |
| Bidirectional filesystem sync | One-way app→FS only; restore for import |
| TTS output | Voice input only (Web Speech); output deferred |
| A2UI (@ant-design/x-card) | Deferred to v0.2+ |
| @ant-design/x-sdk (useXChat/ChatProvider) | Explicitly excluded; AgentOrchestrator owns data flow |
| Mobile app | Chrome extension only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 7 | Pending |
| SHELL-02 | Phase 7 | Pending |
| SHELL-03 | Phase 1 | Complete |
| SHELL-04 | Phase 1 | Complete |
| SHELL-05 | Phase 1 | Complete |
| AI-01 | Phase 3 | Complete |
| AI-02 | Phase 3 | Complete |
| AI-03 | Phase 3 | Complete |
| AI-04 | Phase 7 | Pending |
| CTX-01 | Phase 4 | Complete |
| CTX-02 | Phase 4 | Complete |
| MEM-01 | Phase 5 | Complete |
| MEM-02 | Phase 5 | Complete |
| PAGE-01 | Phase 4a | Complete |
| NOTE-01 | Phase 5 | Complete |
| NOTE-02 | Phase 5a | Complete |
| NOTE-03 | Phase 5a | Pending |
| DIAG-01 | Phase 6 | Pending |
| STORAGE-01 | Phase 2 | Pending |
| STORAGE-02 | Phase 2 | Pending |
| TOOL-01 | Phase 8 | Pending |
| TOOL-02 | Phase 8 | Pending |
| ADDON-01 | Phase 8 | Pending |
| ADDON-02 | Phase 8 | Pending |
| ADDON-03 | Phase 8 | Pending |
| ADDON-04 | Phase 8 | Pending |
| RICH-01 | Phase 7 | Pending |
| RICH-02 | Phase 7 | Pending |
| RICH-03 | Phase 7 | Pending |
| RICH-04 | Phase 7 | Pending |
| SEC-01 | Phase 9 | Pending |
| TEST-01 | Phase 9 | Pending |
| AGT-01 | Phase 3a | Complete |
| AGT-02 | Phase 3a | Complete |
| AGT-03 | Phase 3a | Complete |
| AGT-04 | Phase 3a | Complete |
| CTX-T01 | Phase 4b | Pending |
| CTX-T02 | Phase 4b | Pending |
| CTX-T03 | Phase 4b | Pending |
| CTX-T04 | Phase 4b | Pending |
| CTX-T05 | Phase 4b / 8a | Pending |
| CTX-T06 | Phase 6a | Pending |
| MEM-G01 | Phase 5b | Pending |
| MEM-G02 | Phase 5b | Pending |
| MEM-G03 | Phase 5b | Pending |
| MEM-G04 | Phase 7 | Pending |
| MEM-G05 | Phase 5b / 6b | Pending |
| KNW-01 | Phase 5b | Pending |
| TOL-01 | Phase 8a | Pending |
| TOL-02 | Phase 8a | Pending |
| TOL-03 | Phase 3a / 8a | Complete |
| TOL-04 | Phase 4b / 8a | Complete |
| TOL-05 | Phase 8a | Pending |
| TOL-06 | Phase 8a | Pending |
| TOL-07 | Future 8b | Pending |
| EVAL-01 | Phase 6a | Pending |
| EVAL-02 | Phase 6a | Pending |
| EVAL-03 | Phase 6a | Pending |
| EVAL-04 | Phase 6a | Pending |
| EVAL-05 | Phase 9 | Pending |
| EVAL-06 | Phase 6a | Pending |
| EVAL-07 | Phase 6a | Pending |
| EVO-01 | Phase 6b | Pending |
| EVO-02 | Phase 6b | Pending |
| EVO-03 | Phase 6b | Pending |
| EVO-04 | Phase 5b / 6b | Pending |
| EVO-05 | Phase 6b / 9 | Pending |
| EVO-06 | Future 8b | Pending |
| COLLAB-01 | Phase 6c | Pending |
| COLLAB-02 | Phase 6c | Pending |
| COLLAB-03 | Phase 6c | Pending |
| COLLAB-04 | Phase 6c | Pending |
| COLLAB-05 | Phase 6c | Pending |
| COLLAB-06 | Phase 6c | Pending |
| COLLAB-07 | Phase 6c | Pending |
| COLLAB-08 | Phase 6c | Pending |
| COLLAB-09 | Phase 6c | Pending |
| COLLAB-10 | Phase 6c / 6a | Pending |
| COLLAB-11 | Phase 6c / 9 | Pending |
| COLLAB-12 | Future 8b | Pending |
| COLLAB-13 | All collaboration phases | Pending |
| MM-01 | Phase 7a | Pending |
| MM-02 | Phase 7a | Pending |
| MM-03 | Phase 7a | Pending |
| MM-04 | Phase 7a | Pending |
| MM-05 | Future 7b | Pending |
| MM-06 | Phase 7a | Pending |
| MM-07 | v0.2+ | Pending |

**Coverage:**

- v1 requirements (pre-Rev. C): 32 unique
- Rev. C additions: 59 unique (8 Agent Rel + 6 Trust Context + 6 Memory Gov + 7 Tool Gov + 7 Eval + 6 Evolution + 13 Collab + 7 Multimodal = 60 minus 1 computer-use boundary)
- Total: 91 requirements
- Mapped to phases: 91
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-28*
*Last updated: 2026-07-31 — Rev. C agent-harness requirements integrated*
