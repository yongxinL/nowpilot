# NowPilot

## What This Is

NowPilot is a privacy-first, extensible Chrome MV3 extension AI assistant and personal knowledge platform. It provides AI chat with streaming/abort, agentic tool-calling, atomic note-taking with wikilinks and a note graph, an LLM-Wiki knowledge layer (auto-tagging, RAG, filesystem sync), and a RICH conversational UX across two surfaces — a Chrome Side Panel for quick workflows and a Full App Tab for deep work. Everything runs locally against user-configured AI providers.

## Core Value

Users can acquire knowledge from web pages, store it as interconnected atomic notes, understand it through AI enrichment (tagging/summary/RAG), and interact with it through a persona-driven, intention-aware conversational workspace — all running locally on their machine.

## Context

- **Target runtime:** Chrome MV3 extension using WXT + React 19 + TypeScript (strict mode) + Ant Design v6 + Ant Design X 2.x
- **AI providers:** OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible endpoints via @ai-sdk/* adapters
- **Architecture:** Core layer (AI, storage, memory, extraction, notes) + Add-on layer (site-specific, first-party add-ons)
- **Two UI surfaces:** Side Panel (~400px, compact) for daily workflow; Full App Tab (full viewport) for deep work, configuration, diagnostics
- **Cost-effective runtime:** PlannerService (cheap haiku JSON decisions) → ExecutorService (deterministic tool validation/execution) → RendererService (concise flash answers), with agent step limits by context tier
- **Prior work:** Existing codebase has a `.planning/PRODUCT_SPEC_v0_1.md` as the canonical specification (Rev. B, 2026-07-27, knowledge-first reorganization)

## Constraints

- **Tech stack:** WXT ^0.19, React ^19, antd ^6, @ant-design/x ^2, @ant-design/x-markdown ^2, Zustand ^5, @ai-sdk/* ^1, zod ^3, MiniSearch ^7, idb ^8, motion ^12, yaml ^2, defuddle ^0.6 — NO tailwindcss, shadcn/ui, @radix-ui/react-*, @ant-design/x-sdk, @ant-design/x-card, framer-motion, or @anthropic-ai/sdk directly
- **MV3 rules:** No AI/MCP/IndexedDB in background SW; no custom User-Agent; no eval/remote code; content scripts extraction-only (no UI rendering, no host-page write-back in v0.1)
- **Two surfaces, one workspace:** Side Panel and Full App share WorkspaceStore with single-writer primary election via BroadcastBus
- **Page injection:** Deferred to v0.2+; v0.1 has no Shadow DOM, no host-page UI
- **Performance:** Side panel < 300ms paint, Full App < 500ms, first token < 2s local / < 3s cloud, content script bundle < 50KB

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **SHELL-01**: Side Panel opens with onboarding, chat, agent, write, TeamGQM, and Open Full App surfaces
- [ ] **SHELL-02**: Full App Tab opens with chat, agent, notes, TeamGQM, and options (all configuration/diagnostics)
- [ ] **SHELL-03**: Shared WorkspaceStore across both surfaces with handoff (Flow 11)
- [ ] **SHELL-04**: Theme toggle (light/dark/auto) affects both surfaces immediately
- [ ] **SHELL-05**: Cmd+K command palette on both surfaces
- [ ] **AI-01**: Five provider adapters (OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible) with ProviderRouter fallback/circuit-breaker
- [ ] **AI-02**: PlannerService → ExecutorService → RendererService pipeline with tier caps (Appendix I)
- [ ] **AI-03**: PersonaInjector prepends persona block into all AI system prompts (RICH-R-01/02)
- [ ] **AI-04**: P0 Interaction — Welcome cards, context-aware quick-action chips, clarification chips, follow-up chips (RICH P0)
- [ ] **CTX-01**: ContextOptimizer with dynamic token budgets, degradation pipeline, and minimal mode for tiny models
- [ ] **CTX-02**: PromptCacheManager with per-provider cache-hint transformation (Appendix K)
- [ ] **MEM-01**: Conversation memory (summary + recent turns) + User memory (cross-session facts, scored retrieval) + Preference memory (response style, persona)
- [ ] **MEM-02**: Memory writes only from primary surface; secondary surfaces mirror read-only
- [ ] **PAGE-01**: PageContentService with layered extraction (Defuddle → APC-lite → ServiceNow API), ephemeral MiniSearch index, per-tab cache with SPA-nav invalidation
- [ ] **NOTE-01**: Atomic notes with wikilinks, tags, note graph (MiniSearch + cosine similarity), backlinks
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
*Last updated: 2026-07-28 after initialization*
