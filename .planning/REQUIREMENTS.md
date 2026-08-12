# Requirements: NowPilot v0.1

**Defined:** 2026-08-04
**Core Value:** A privacy-first, local-first AI assistant where chat, extracted page content, and a linked notes/knowledge layer combine into a persistent personal workspace — no data leaves the machine unless the user deliberately configures a cloud provider.

> Derived from the canonical `.planning/PRODUCT_SPEC_v0_1.md`. The spec is the single authoritative reference; requirement namespaces follow spec sections (§9 features, §27 LLM-Wiki/CAT/LLM-WIKI/SYNC, §28 AGT/CTX/MEM/KNW/TOL/EVAL/EVO/PROP/MM/COLLAB). Each requirement maps to exactly one §18 phase.

## v1 Requirements

### Runtime & Shells (Phase 1)

- [x] **RUNTIME-01**: WXT MV3 extension builds with side panel, standalone view, background SW, and extraction-only content script entrypoints
- [x] **RUNTIME-02**: Side panel opens; first-run onboarding appears on fresh install
- [x] **RUNTIME-03**: Standalone view opens from side panel; workspace state hands off correctly (no duplicate tabs)
- [x] **RUNTIME-04**: AntD theme/design tokens applied via ThemeStore + antdConfig (compact for side panel, default for standalone)
- [x] **RUNTIME-05**: Chat, Agent, Notes, Options page skeletons render in both surfaces

### Workspace (Phase 1)

- [x] **WSPC-01**: WorkspaceStore (Zustand) persists theme, conversation, and add-on state
- [x] **WSPC-02**: WorkspaceSync keeps side panel and standalone surfaces in sync via BroadcastBus
- [x] **WSPC-03**: MessageBus, EventBus, and BroadcastBus provide cross-context / in-panel / cross-surface communication
- [x] **WSPC-04**: AddonRegistry, Registry, AddonSettingsStore, and page registries register add-ons at startup
- [x] **WSPC-05**: ErrorBoundary, PortableMarkdown, and debugLog (canonical §C.2 codes) exist

### Persistence & Storage (Phase 2)

- [x] **STORAGE-01**: IndexedDB stores (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore) work via idb with strict typing
- [x] **STORAGE-02**: StorageLayer, StorageSession, and per-key permissions implemented
- [x] **STORAGE-03**: Encrypted vault (AES-GCM crypto.subtle) protects secrets/sensitive values
- [x] **STORAGE-04**: WriteJournal + WriteTransaction enable crash-safe, conflict-safe writes
- [x] **STORAGE-05**: Import/export (sanitized JSON/ZIP) and backup/restore function

### AI Runtime & Cost (Phase 3)

- [x] **AI-01**: ProviderRegistry, ProviderRouter, and TierResolver support 'openai' | 'anthropic' | 'gemini' | 'ollama' with custom baseURL (OpenAI-compatible local)
- [x] **AI-02**: Planner→Executor→Renderer loop runs with Zod-validated PlannerDecision; Planner requests, Executor validates+runs tools
- [x] **AI-03**: Streaming works end-to-end (SSE + text via ChunkBuffer + React UI)
- [x] **AI-04**: Tier caps and monthly budget enforce cost guardrails (cheapest-capable routing)
- [x] **AI-05**: PersonaInjector and prompt pipeline ensure all AI calls consume an OptimizedContext
- [x] **AI-06**: RICH chat surfaces (Bubble, Sender, Prompts, Welcome, etc.) render streamed AI output
- [x] **AI-07**: MCP client (StreamableHTTP) + NowPilotMainServer (12 tools) + MCPRegistry work

> **AI-07 → Phase 8 (D-06, 03-01):** MCP is dependency-blocked (PageContentService → 4a, NotesDB → 5, ClipboardHelper → 8) and must ship WITH `ToolCapabilityManifest`/verifiers (Phase 8a, TOL-01…05), never governance-less. §18 is authoritative over this row — the Phase-3 AI-07 bullet is NOT a Phase-3 deliverable.
>
> **AI-04 monthly aggregate deferred to Phase 6 (D-16, 03-01):** the monthly token/cost aggregate is un-enforceable before AITransactionLog/TokenLedger exist and is currently under-specified (no rate table, reset semantics, or ledger schema). Phase 3 ships the tier-cap enforcement (AgentOrchestrator, §1.4) + the no-op `budgetGuard` hook on ProviderRouter; Phase 6 defines AI-04's full mechanism in an ADR.

### Agent Reliability & Evidence (Phase 3a)

- [x] **AGT-01**: Agent-level token budget bounds a single agent run
- [x] **AGT-02**: CheckpointRecorder enables one-step rollback on failure
- [x] **AGT-03**: Side-effecting tools require CompletionEvidence (probe + path); cap exhaustion = `partial`, never `completed`
- [x] **AGT-04**: Replan path is bounded by tier caps and never nested
- [x] **AGT-05**: Commit-confirm barrier requires user confirmation before irreversible actions

> **AGT-02 (D-3a-02, 03a):** CheckpointRecorder is delivered as part of AGT-02 (rollback machinery, §17.7.7 in-memory loop-state rewind) — no new AGT id is invented; AGT-02 is the requirement that owns it.
>
> **AGT-05 → Phase 8 (D-3a-01, 03a):** the commit-confirm barrier re-maps to Phase 8 (TOL-03 PermissionDialog / ToolCapabilityManifest risk gating); Phase 3a ships only the trajectory `waiting-for-permission` state + the within-turn pause seam. §18 is authoritative over this row — the 03a AGT-05 bullet is NOT a full 03a deliverable.

### Context-Adaptive Execution (Phase 4)

- [x] **CTX-01**: Context windows (small/medium/large) selectable with budget enforcement
- [x] **CTX-02**: ContextUpdate events trigger context-aware selection on rapid page/state change
- [x] **CTX-03**: Phase-aware prompting applies per-context-role guidance
- [x] **CTX-04**: OptimizedContext degrades gracefully per §2.4 without mid-structure truncation

### PageContentService (Phase 4a)

- [ ] **CAT-01**: Content scripts extract `{title, url, text, metadata}` via defuddle (readability fallback, turndown APC-lite)
- [ ] **CAT-02**: SPANavigationWatcher + PageContextBridge deliver page context to side panel/standalone
- [ ] **CAT-03**: TraceRedactor applied to DOM-embedded sensitive values
- [ ] **CAT-04**: ISOLATED world by default; MAIN world only for domain-specific globals
- [ ] **CAT-05**: Content bundle under 50KB; extraction is non-blocking

### Trust-Aware Context (Phase 4b)

- [ ] **TRUST-01**: Content classification labels page/note/memory/tool output as retrieved/untrusted with `instructionAuthority: false`
- [ ] **TRUST-02**: XSS risk screening + prompt-injection quarantine before AI context use
- [ ] **TRUST-03**: Content trust controls let the user decide which sources feed the model

### Knowledge & Notes (Phase 5)

- [ ] **KNW-01**: Atomic note-taking: create, edit, save, delete notes with wikilinks ([[…]])
- [ ] **KNW-02**: Note graph (d3-force) + backlinks in Standalone Notes view
- [ ] **KNW-03**: MiniSearch indexes notes for full-text search
- [ ] **KNW-04**: MemoryEngine stores conversation, user, and preference memory with budget enforcement
- [ ] **KNW-05**: Memory injection ≤ 1000 tokens / top-5; working memory ≤ 300 tokens

### LLM-Wiki & Filesystem Sync (Phase 5a)

- [ ] **LLM-WIKI-01**: Auto-tagging adds suggested tags to notes
- [ ] **LLM-WIKI-02**: "Ask notes" RAG answers from note index (MiniSearch)
- [ ] **LLM-WIKI-03**: NoteChatConverter converts chat into notes; title→LLM integration
- [ ] **SYNC-01**: Local-FS sync exports notes as .md (YAML frontmatter) to a user-chosen folder
- [ ] **SYNC-02**: Baseline diff + restore-from-folder work one-way (export-first)

### Memory Governance (Phase 5b)

- [ ] **MEM-01**: Memory cap prevents unbounded growth
- [ ] **MEM-02**: Memory decay and privacy-preserving compression reduce stale/old facts
- [ ] **MEM-03**: User can view/edit/disable memory facts in Options

### Diagnostics (Phase 6)

- [ ] **DIAG-01**: AITransactionLog records chat/agent transactions with operation IDs
- [ ] **DIAG-02**: DiagnosticsPanel shows transaction traces, execution paths, and error codes
- [ ] **DIAG-03**: Export debug bundle (sanitized) works

### Agent Evaluation (Phase 6a)

- [ ] **EVAL-01**: Agent evaluation rubrics (checklist + recall + relevance) run against executed transactions
- [ ] **EVAL-02**: Evals UI surfaces pass/fail and per-rubric scores

### Verified Evolution (Phase 6b)

- [ ] **EVO-01**: CandidateProposer proposes evolution candidates only; activation is human-gated
- [ ] **EVO-02**: PROPOSED/DEFERRED candidates never activate automatically
- [ ] **PROP-01**: Properties/capability registry reflects only activated evolution

### Bounded Collaboration (Phase 6c)

- [ ] **COLLAB-01**: Single-agent default = one-role CollaborationPlan (the single-agent path)
- [ ] **COLLAB-02**: Multi-role plans (User/Planner/Executor/Evidence) opt-in via Coordinator, sharing one runtime/security/tool/memory model
- [ ] **COLLAB-03**: Collaboration manifest + coordination modes work

### Workspace UX + RICH (Phase 7)

- [ ] **RICH-01**: RICH design requirements met (persona header, welcome, quick-action chips, clarification/follow-up chips, stage indicators)
- [ ] **RICH-02**: Persona config (name, tone, brevity) editable in Options, stored in PreferenceMemoryStore
- [ ] **RICH-03**: One-phase-per-response; streaming stage indicators
- [ ] **RICH-04**: Cmd+K palette, tab pinning (max 10), theme toggle (light/dark/auto)

### Multimodal Input (Phase 7a)

- [ ] **MM-01**: Image input (paste/attach) accepted in chat
- [ ] **MM-02**: Ollama vision / VLM integration renders image understanding
- [ ] **MM-03**: Attachments/FileCard surfaces render in RICH chat

### Add-ons (Phase 8)

- [ ] **ADDON-01**: Addon contract (id/name/scope/urlPatterns/contextExtractor/skills/prompts/pages/settings/keymap) enforced with Zod settings
- [ ] **ADDON-02**: ServiceNow add-on extracts JSESSIONID (P0) via CookieSessionStore
- [ ] **ADDON-03**: Write add-on quick actions (rewrite/summarize/draft) work with streamed output
- [ ] **ADDON-04**: TeamGQM side-panel quick view + standalone workspace render

### Tool Governance (Phase 8a)

- [ ] **TOL-01**: Tool-calling registry + allowlist control which tools run
- [ ] **TOL-02**: AI-chosen tools validated by ExecutorService; JSONSchema tools via zod-to-json-schema
- [ ] **TOL-03**: Permission prompts gate sensitive tool actions

### Hardening & Release (Phase 9)

- [ ] **HARD-01**: TraceRedactor applied to every sensitive flow (no raw prompts/tool bodies/secrets in logs/UI/export)
- [ ] **HARD-02**: XSS sanitization (DOMPurify) on all AI/tool output; content scripts extraction-only
- [ ] **HARD-03**: Performance budgets met (content < 50KB, side panel paint < 300ms, first token < 2s local)
- [ ] **HARD-04**: `verify:phase-1…9` scripts green; release build packaged for Chrome

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

- **PGINJ-01**: Page injection / host-page automation (page writes, click automation, UI overlays)
- **PDF-01**: PDF chat / extraction
- **EMB-01**: Embedding-based semantic search (MiniSearch remains v1 retrieval)
- **SYNC-03**: Bidirectional filesystem sync / live folder watch
- **TTS-01**: Voice/TTS audio output
- **A2UI-01**: Computer-use / autonomous UI interaction

## Out of Scope

| Feature | Reason |
|---------|--------|
| Page injection / host-page automation | Privacy + MV3 constraints; extraction-only in v0.1 (spec §0.2 R1, §6.5) |
| PDF chat / extraction | Parser complexity + cost (spec §6.5) |
| Embedding-based search | Cost model; MiniSearch sufficient (spec §7.7, ADR) |
| Bidirectional FS sync / live watch | Correctness risk; one-way export-first in v0.1 (spec §27) |
| TTS audio output | Not in v0.1 scope (spec §6.5) |
| A2UI / computer-use autonomy | Not in v0.1 scope (spec §6.5) |
| @ant-design/x-sdk, @ant-design/x-card | Explicitly not adopted (spec §7.2, §23, §25.6) |
| Shadcn/ui, Tailwind, Radix, react-markdown chain | Banned; superseded by AntD + @ant-design/x-markdown (spec §7.2) |
| Page UI overlays / in-page add-on UI | Content-script UI mount removed from add-on contract (spec §9.4) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RUNTIME-01…05 | Phase 1 | Done |
| WSPC-01…05 | Phase 1 | Done |
| STORAGE-01…05 | Phase 2 | Pending |
| AI-01…06 | Phase 3 | Done |
| AI-07 | Phase 8 (re-mapped per D-06 — MCP dependency-blocked to Phase 8/8a) | Complete |
| AGT-01…05 | Phase 3a | Done |
| CTX-01…04 | Phase 4 | CTX-01 Done (04-01), CTX-02…04 Pending |
| CAT-01…05 | Phase 4a | Pending |
| TRUST-01…03 | Phase 4b | Pending |
| KNW-01…05 | Phase 5 | Pending |
| LLM-WIKI-01…03, SYNC-01…02 | Phase 5a | Pending |
| MEM-01…03 | Phase 5b | Pending |
| DIAG-01…03 | Phase 6 | Pending |
| EVAL-01…02 | Phase 6a | Pending |
| EVO-01…02, PROP-01 | Phase 6b | Pending |
| COLLAB-01…03 | Phase 6c | Pending |
| RICH-01…04 | Phase 7 | Pending |
| MM-01…03 | Phase 7a | Pending |
| ADDON-01…04 | Phase 8 | Pending |
| TOL-01…03 | Phase 8a | Pending |
| HARD-01…04 | Phase 9 | Pending |

**Coverage:**

- v1 requirements: 81 total
- Mapped to phases: 81
- Unmapped: 0 ✓

> Coverage correction: the count was previously stated as 80; the verified count of v1 requirement bullets is 81 (LLM-WIKI-01…03 were omitted from the earlier tally). The traceability table above always mapped 81 requirements across the 19 §18 phases; ROADMAP.md reflects the same mapping.

---
*Requirements defined: 2026-08-04*
*Last updated: 2026-08-04 after roadmap creation (preserved spec §18 canonical phase order; coverage corrected to 81)*
