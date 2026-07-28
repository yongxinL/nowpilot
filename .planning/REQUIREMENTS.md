# Requirements: NowPilot

**Defined:** 2026-07-28
**Core Value:** Users can acquire knowledge from web pages, store it as interconnected atomic notes, understand it through AI enrichment, and interact with it through a persona-driven conversational workspace — all running locally.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Shell

- [ ] **SHELL-01**: User can open the Side Panel with onboarding, chat, agent, write, TeamGQM, and Open Full App surfaces
- [ ] **SHELL-02**: User can open the Full App Tab with chat, agent, notes, TeamGQM, and options (all configuration/diagnostics)
- [ ] **SHELL-03**: User has a shared workspace that persists across Side Panel and Full App Tab with handoff between surfaces
- [x] **SHELL-04**: User can toggle theme (light/dark/auto) and it affects both surfaces immediately
- [x] **SHELL-05**: User can invoke Cmd+K command palette on both surfaces

### AI Pipeline

- [ ] **AI-01**: User can configure five AI providers (OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible) with automatic fallback and circuit breaker
- [ ] **AI-02**: User interactions flow through PlannerService → ExecutorService → RendererService with tier-based step limits
- [ ] **AI-03**: User's persona configuration is injected into every AI system prompt via PersonaInjector
- [ ] **AI-04**: User sees welcome cards, context-aware quick-action chips, clarification chips, and follow-up chips (RICH P0 interactions)

### Context

- [ ] **CTX-01**: User's prompts are optimized with dynamic token budgets, degradation pipeline, and minimal mode for tiny models
- [ ] **CTX-02**: User benefits from prompt caching with per-provider cache-hint transformation

### Memory

- [ ] **MEM-01**: User's conversation memory (summary + recent turns), cross-session user facts (scored retrieval), and preferences persist across sessions
- [ ] **MEM-02**: User's memory writes only happen from the primary surface; secondary surfaces reflect read-only

### Page Extraction

- [ ] **PAGE-01**: User can extract page content via layered extraction (Defuddle → APC-lite) with ephemeral MiniSearch index and per-tab SPA-nav cache

### Notes & Knowledge

- [ ] **NOTE-01**: User can create atomic notes with wikilinks, tags, note graph (MiniSearch + cosine similarity), and backlinks
- [ ] **NOTE-02**: User can enrich notes via LLM-Wiki (auto-tag/category/summary in one call), ask notes via RAG with citations, and convert chat/page to notes
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
| SHELL-03 | Phase 1 | Pending |
| SHELL-04 | Phase 1 | Complete |
| SHELL-05 | Phase 1 | Complete |
| AI-01 | Phase 3 | Pending |
| AI-02 | Phase 3 | Pending |
| AI-03 | Phase 3 | Pending |
| AI-04 | Phase 7 | Pending |
| CTX-01 | Phase 4 | Pending |
| CTX-02 | Phase 4 | Pending |
| MEM-01 | Phase 5 | Pending |
| MEM-02 | Phase 5 | Pending |
| PAGE-01 | Phase 4a | Pending |
| NOTE-01 | Phase 5 | Pending |
| NOTE-02 | Phase 5a | Pending |
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

**Coverage:**

- v1 requirements: 32 unique (33 rows in table above included 1 duplicate STORAGE-01; removed during roadmap)
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-28*
*Last updated: 2026-07-28 after initial definition*
