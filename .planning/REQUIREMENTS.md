# Requirements: NowPilot

**Defined:** 2026-07-10
**Core Value:** Everything runs locally against user-configured providers. No data leaves the user's machine unless they explicitly configure a cloud provider.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Project Setup

- [ ] **SETUP-01**: WXT MV3 project scaffold with background SW, side panel, full app tab, content scripts, popup entry points
- [ ] **SETUP-02**: Ant Design v6 + Ant Design X 2.x installed and configured — `@ant-design/x-markdown` for streaming markdown
- [ ] **SETUP-03**: TypeScript strict mode, eslint, prettier, vitest test framework configured
- [ ] **SETUP-04**: `wxt.config.ts` per Appendix G with all entry points, permissions, CSP
- [ ] **SETUP-05**: TailwindCSS, shadcn/ui, Radix UI, framer-motion removed from dependencies
- [ ] **SETUP-06**: `@ant-design/x-sdk` and `@ant-design/x-card` NOT installed

### Workspace & Cross-Surface Coordination

- [ ] **WRKSP-01**: WorkspaceStore (Zustand) tracks workspaceId, conversationId, activeProvider, activeSurface
- [ ] **WRKSP-02**: BroadcastBus enables cross-surface messaging between Side Panel and Full App
- [ ] **WRKSP-03**: WorkspaceRouter opens Full App tab, deduplicates existing tabs
- [ ] **WRKSP-04**: Primary writer election via chrome.storage.session with heartbeat (3s)
- [x] **WRKSP-05**: Workspace state persists across page reload and cross-surface handoff
- [ ] **WRKSP-06**: Full App has priority over Side Panel in writer election tie-break

### Shell & Navigation

- [ ] **SHELL-01**: Side Panel shell with AntD compact layout — Header, Nav rail (Chat/Agent/Write/TeamGQM), Content area, Footer composer
- [ ] **SHELL-02**: Full App shell with AntD Layout — Header, collapsible Sider (Chat/Agent/Notes/TeamGQM/Options), Content area
- [ ] **SHELL-03**: SidePanelPageRegistry for add-on registration of Side Panel pages
- [ ] **SHELL-04**: FullAppPageRegistry for add-on registration of Full App pages
- [ ] **SHELL-05**: Open Full App action from Side Panel with workspace handoff (Flow 11)
- [ ] **SHELL-06**: Skeleton page components for Chat, Agent, Notes, Options

### Theme

- [ ] **THEME-01**: ThemeStore (Zustand) with light/dark/auto mode, persisted to chrome.storage.sync
- [ ] **THEME-02**: ConfigProvider wraps both surfaces with theme algorithm and tokens
- [ ] **THEME-03**: Side Panel uses compactAlgorithm; Full App uses default density
- [ ] **THEME-04**: XProvider wraps pages using @ant-design/x components
- [ ] **THEME-05**: Theme toggle affects both surfaces immediately
- [ ] **THEME-06**: All imperative APIs accessed via App.useApp(), not static imports

### Storage & Security

- [x] **STOR-01**: Split storage — IndexedDB for message bodies, chrome.storage.local for metadata, chrome.storage.session for tokens
- [x] **STOR-02**: AES-GCM encrypted API key storage via EncryptedStorage (PBKDF2 + per-key salt/IV)
- [x] **STOR-03**: WriteJournal for multi-store consistency with idempotent operations
- [x] **STOR-04**: IndexedDBMigrator with versioned, idempotent migrations
- [x] **STOR-05**: ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, AITransactionLogDB
- [x] **STOR-06**: RateLimiter per add-on instance
- [x] **STOR-07**: No message bodies in chrome.storage.local

### AI Providers

- [x] **PROV-01**: OpenAI provider adapter via @ai-sdk/openai
- [x] **PROV-02**: Anthropic provider adapter via @ai-sdk/anthropic
- [x] **PROV-03**: Gemini provider adapter via @ai-sdk/google
- [x] **PROV-04**: Ollama provider adapter via @ai-sdk/openai (OpenAI-compatible endpoint)
- [x] **PROV-05**: OpenAI-compatible provider adapter (user-supplied baseURL)
- [x] **PROV-06**: ProviderRouter with cost/latency/reliability selection, retry, circuit breaker
- [x] **PROV-07**: TierResolver maps haiku/flash tier to concrete (providerId, model)

### AI Runtime

- [x] **AIRN-01**: PlannerService — JSON-only action planner (3s timeout, one-shot repair retry)
- [x] **AIRN-02**: ExecutorService — deterministic tool executor (validate, permission, timeout, schema check)
- [x] **AIRN-03**: RendererService — concise response renderer (flash tier, 512 token cap, 5s timeout)
- [x] **AIRN-04**: AgentOrchestrator — Planner→Executor loop with tier caps (1-5 planner calls)
- [x] **AIRN-05**: StructuredOutput — JSON mode + schema validation + one-shot repair (Appendix L)
- [x] **AIRN-06**: ChunkBuffer — rAF-batched streaming UI buffer (Appendix J)
- [x] **AIRN-07**: PromptCacheManager — cache segmentation and provider hints
- [x] **AIRN-08**: PromptCacheAdapter — per-provider cache-hint transformation (Appendix K)
- [x] **AIRN-09**: Abort propagation through Planner→Executor→Renderer via single AbortController

### Context-Adaptive Execution

- [x] **CTXT-01**: ModelContextTier classification — tiny/small/medium/large based on context window
- [x] **CTXT-02**: Token budget formula — inputBudget=70%, outputBudget=20%, safetyMargin=10%
- [x] **CTXT-03**: Dynamic distribution across system/tools/memory/context/history/user per tier
- [x] **CTXT-04**: ContextOptimizer assembles OptimizedContext with provenance manifest
- [x] **CTXT-05**: Degradation pipeline — 8-step overflow handling ending in CONTEXT_TOO_LARGE error
- [x] **CTXT-06**: Minimal mode for tiny models — compact prompts, no MCP, top-3 memory, 200 token summary
- [x] **CTXT-07**: ContextCompressor — structured text/page/case/history compression

### Persistent Memory

- [x] **MEM-01**: ConversationMemoryStore — per-conversation summary + recent turns (2-6 based on tier)
- [x] **MEM-02**: UserMemoryStore — cross-session fact/preference/pattern memory with scoring
- [x] **MEM-03**: PreferenceMemoryStore — behavioural settings (response style, tool autonomy, theme)
- [x] **MEM-04**: MemoryEngine — orchestration, scoring, summarisation, injection (top-5, ≤1000 tokens)
- [x] **MEM-05**: Memory shared across surfaces via MemoryEngine
- [x] **MEM-06**: Auto-summarise older messages after every 12 messages
- [x] **MEM-07**: Memory writes single-writer — only primary surface via BroadcastBus election

### Chat

- [x] **CHAT-01**: Streaming AI chat with abort on both Side Panel and Full App
- [x] **CHAT-02**: Chat history persistence in ChatHistoryDB with conversation list
- [x] **CHAT-03**: First-message title generation (temperature 0, 16 tokens, non-blocking)
- [x] **CHAT-04**: Slash command parsing (`/write`, `/ask`, `/research`, etc.)
- [x] **CHAT-05**: Provider/model selector (read-only in Side Panel, editable in Full App Options)
- [x] **CHAT-06**: Chat UI built on @ant-design/x (Bubble, Sender, Conversations)
- [x] **CHAT-07**: Markdown rendering via @ant-design/x-markdown with streaming support
- [x] **CHAT-08**: One stream per session — abort active before starting new
- [x] **CHAT-09**: Error states — Provider error, Retry, Switch Provider, Open Settings

### Agent

- [ ] **AGNT-01**: Agent workflows with AgentOrchestrator and tier caps
- [ ] **AGNT-02**: 12 built-in MCP tools via NowPilotMainServer
- [ ] **AGNT-03**: External MCP client via @modelcontextprotocol/sdk (StreamableHTTP transport)
- [x] **AGNT-04**: Tool call permission dialog — Allow once / Allow always / Deny
- [x] **AGNT-05**: Dangerous tools always prompt regardless of allow list
- [ ] **AGNT-06**: Agent UI built on @ant-design/x (ThoughtChain, Think)
- [ ] **AGNT-07**: Tool results rendered as data strings through React JSX
- [ ] **AGNT-08**: Macros execution — sequential skill/MCP/note steps, no eval

### Notes

- [ ] **NOTE-01**: Note CRUD — create, read, update, delete (Full App only)
- [ ] **NOTE-02**: Wikilinks with link parsing and resolution
- [ ] **NOTE-03**: Backlinks panel showing referencing notes
- [ ] **NOTE-04**: Note graph visualization via d3-force (Full App only)
- [ ] **NOTE-05**: Full-text search via MiniSearch
- [ ] **NOTE-06**: Quick save to note from Side Panel chat responses
- [ ] **NOTE-07**: Note version tracking with idempotent saves

### Options

- [x] **OPT-01**: Providers section — add/edit/delete provider configs, test connections
- [x] **OPT-02**: Models section — per-provider model list + context window override
- [x] **OPT-03**: MCP Servers section — add/enable/disable external MCP servers
- [x] **OPT-04**: Prompt Templates section — CRUD with variable editor
- [x] **OPT-05**: Slash Commands section — manage slash command to template mapping
- [x] **OPT-06**: Memory section — view/edit user memory facts, enable/disable
- [x] **OPT-07**: Diagnostics section — transaction traces, export debug bundle (Full App only)
- [x] **OPT-08**: Import/Export section — sanitized JSON/ZIP export, import merge
- [x] **OPT-09**: Feature Flags section — toggle P2 features
- [x] **OPT-10**: Add-on Settings section — namespaced settings per registered add-on
- [x] **OPT-11**: Options accessible only from Full App (not Side Panel)

### Telemetry & Diagnostics

- [ ] **TELE-01**: AITransactionLog — tracks every AI/MCP/tool/provider operation
- [ ] **TELE-02**: PromptTrace — token breakdown, truncation, cache hits per operation
- [ ] **TELE-03**: ToolTrace — tool calls with permission decisions and outcomes
- [ ] **TELE-04**: ProviderTrace — per-provider attempt tracking with circuit breaker state
- [ ] **TELE-05**: TraceRedactor — redacts API keys, tokens, raw bodies before persistence
- [ ] **TELE-06**: DiagnosticsPanel in Full App → Options with Tables, Timelines, export
- [ ] **TELE-07**: Error toast with "Open Diagnostics" link from Side Panel

### Add-ons

- [x] **ADDON-01**: AddonRegistry with typed registration for skills, prompts, pages, settings
- [x] **ADDON-02**: ServiceNow add-on — JSESSIONID/sysparmCK extraction, case context, Table API client
- [ ] **ADDON-03**: ServiceNow add-on — CaseAnalyzerSkill, CatchUpSkill, SentimentSkill
- [ ] **ADDON-04**: ServiceNow add-on — Side Panel page (quick case-context view + skill launcher)
- [ ] **ADDON-05**: ServiceNow add-on — Full App page (case table, comments, work notes)
- [x] **ADDON-06**: Write add-on — Rewrite, Summarize, Draft customer update, Draft internal note, Explain, Action plan
- [x] **ADDON-07**: Write add-on — Side Panel page with quick actions
- [x] **ADDON-08**: TeamGQM add-on — Side Panel (compact digest) + Full App (full workspace)
- [ ] **ADDON-09**: ResearchSkill global add-on — web search via MCP or built-in tool
- [ ] **ADDON-10**: Core-addon boundary enforced — core never imports from addons

### Content Scripts (Extraction-Only)

- [x] **CONT-01**: ContentScriptHost — extraction-only message bridge, no UI mount
- [x] **CONT-02**: SPANavigationWatcher — MutationObserver-based SPA navigation detection
- [x] **CONT-03**: PageContextBridge — extracted context to Side Panel and Full App
- [x] **CONT-04**: Content script bundle contains no React, no AntD, no UI code
- [x] **CONT-05**: ISOLATED world by default; MAIN world only for domain globals (e.g. window.g_ck)

### Commands & Shortcuts

- [ ] **CMD-01**: Cmd+K command palette on both surfaces with full command set
- [ ] **CMD-02**: Palette includes Open Full App, Focus Side Panel, Open Options
- [ ] **CMD-03**: Keyboard shortcuts via KeymapRegistry

### Data Portability

- [x] **DATA-01**: Data export — sanitized JSON/ZIP with scope selection (no API keys)
- [x] **DATA-02**: Data import — merge with conflict resolution
- [ ] **DATA-03**: Export debug bundle from Diagnostics

### Onboarding

- [ ] **ONBD-01**: First-run OnboardingModal — welcome, pick provider, enter key, validate
- [ ] **ONBD-02**: Onboarding triggers on fresh install when no provider configured
- [ ] **ONBD-03**: Onboarding accessible from both surfaces

### Hardening

- [ ] **HARD-01**: Content script bundle < 50 KB
- [ ] **HARD-02**: Side Panel initial paint < 300ms
- [ ] **HARD-03**: Full App initial paint < 500ms
- [ ] **HARD-04**: First token < 2s local / < 3s cloud
- [ ] **HARD-05**: RuntimeEnvelope on all cross-context messages
- [ ] **HARD-06**: ErrorBoundary on every page with AntD Result fallback
- [ ] **HARD-07**: WCAG AA contrast ratios, focus rings, keyboard navigation
- [ ] **HARD-08**: Background SW registers listeners synchronously at module load
- [ ] **HARD-09**: All catch blocks call debugLog — no empty catches
- [ ] **HARD-10**: No innerHTML, dangerouslySetInnerHTML, or eval in codebase

## Out of Scope

| Feature | Reason |
|---------|--------|
| Page injection (Shadow DOM UI, floating widgets, CaseInsightBox) | Deferred to v0.2+; removes host-page DOM risk, Shadow DOM complexity, and CSP conflicts |
| PDF chat | Deferred to v0.2+; not core to v0.1 value proposition |
| Embedding-based search | Bag-of-words + MiniSearch sufficient for v0.1; avoids embedding model downloads |
| Snippet/template productivity suite | Deferred; not core to v0.1 scope |
| @ant-design/x-sdk (useXChat, ChatProvider) | Duplicates ProviderRouter/AgentOrchestrator/ContextOptimizer |
| @ant-design/x-card (A2UI) | Dynamic-surface generation deferred to v0.2+ |
| TailwindCSS, shadcn/ui, Radix UI | Superseded by Ant Design v6 |
| framer-motion (use `motion` v12 instead) | Replaced by `motion/react` import per Framer Motion v12 |
| Global internet-search page | Replaced by ResearchSkill global add-on via MCP or built-in tool |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 1 | Pending |
| SETUP-02 | Phase 1 | Pending |
| SETUP-03 | Phase 1 | Pending |
| SETUP-04 | Phase 1 | Pending |
| SETUP-05 | Phase 1 | Pending |
| SETUP-06 | Phase 1 | Pending |
| WRKSP-01 | Phase 1 | Pending |
| WRKSP-02 | Phase 1 | Pending |
| WRKSP-03 | Phase 1 | Pending |
| WRKSP-04 | Phase 1 | Pending |
| WRKSP-05 | Phase 2 | Complete |
| WRKSP-06 | Phase 1 | Pending |
| SHELL-01 | Phase 1 | Pending |
| SHELL-02 | Phase 1 | Pending |
| SHELL-03 | Phase 1 | Pending |
| SHELL-04 | Phase 1 | Pending |
| SHELL-05 | Phase 1 | Pending |
| SHELL-06 | Phase 1 | Pending |
| THEME-01 | Phase 1 | Pending |
| THEME-02 | Phase 1 | Pending |
| THEME-03 | Phase 1 | Pending |
| THEME-04 | Phase 1 | Pending |
| THEME-05 | Phase 1 | Pending |
| THEME-06 | Phase 1 | Pending |
| STOR-01 | Phase 2 | Complete |
| STOR-02 | Phase 2 | Complete |
| STOR-03 | Phase 2 | Complete |
| STOR-04 | Phase 2 | Complete |
| STOR-05 | Phase 2 | Complete |
| STOR-06 | Phase 2 | Complete |
| STOR-07 | Phase 2 | Complete |
| PROV-01 | Phase 3 | Complete |
| PROV-02 | Phase 3 | Complete |
| PROV-03 | Phase 3 | Complete |
| PROV-04 | Phase 3 | Complete |
| PROV-05 | Phase 3 | Complete |
| PROV-06 | Phase 3 | Complete |
| PROV-07 | Phase 3 | Complete |
| AIRN-01 | Phase 3 | Complete |
| AIRN-02 | Phase 3 | Complete |
| AIRN-03 | Phase 3 | Complete |
| AIRN-04 | Phase 3 | Complete |
| AIRN-05 | Phase 3 | Complete |
| AIRN-06 | Phase 3 | Complete |
| AIRN-07 | Phase 3 | Complete |
| AIRN-08 | Phase 3 | Complete |
| AIRN-09 | Phase 3 | Complete |
| CTXT-01 | Phase 4 | Complete |
| CTXT-02 | Phase 4 | Complete |
| CTXT-03 | Phase 4 | Complete |
| CTXT-04 | Phase 4 | Complete |
| CTXT-05 | Phase 4 | Complete |
| CTXT-06 | Phase 4 | Complete |
| CTXT-07 | Phase 4 | Complete |
| MEM-01 | Phase 5 | Complete |
| MEM-02 | Phase 5 | Complete |
| MEM-03 | Phase 5 | Complete |
| MEM-04 | Phase 5 | Complete |
| MEM-05 | Phase 5 | Complete |
| MEM-06 | Phase 5 | Complete |
| MEM-07 | Phase 5 | Complete |
| CHAT-01 | Phase 7 | Complete |
| CHAT-02 | Phase 7 | Complete |
| CHAT-03 | Phase 7 | Complete |
| CHAT-04 | Phase 7 | Complete |
| CHAT-05 | Phase 7 | Complete |
| CHAT-06 | Phase 7 | Complete |
| CHAT-07 | Phase 7 | Complete |
| CHAT-08 | Phase 7 | Complete |
| CHAT-09 | Phase 7 | Complete |
| AGNT-01 | Phase 7 | Pending |
| AGNT-02 | Phase 7 | Pending |
| AGNT-03 | Phase 7 | Pending |
| AGNT-04 | Phase 7 | Complete |
| AGNT-05 | Phase 7 | Complete |
| AGNT-06 | Phase 7 | Pending |
| AGNT-07 | Phase 7 | Pending |
| AGNT-08 | Phase 7 | Pending |
| NOTE-01 | Phase 7 | Pending |
| NOTE-02 | Phase 7 | Pending |
| NOTE-03 | Phase 7 | Pending |
| NOTE-04 | Phase 7 | Pending |
| NOTE-05 | Phase 7 | Pending |
| NOTE-06 | Phase 7 | Pending |
| NOTE-07 | Phase 7 | Pending |
| OPT-01 | Phase 7 | Complete |
| OPT-02 | Phase 7 | Complete |
| OPT-03 | Phase 7 | Complete |
| OPT-04 | Phase 7 | Complete |
| OPT-05 | Phase 7 | Complete |
| OPT-06 | Phase 7 | Complete |
| OPT-07 | Phase 7 | Complete |
| OPT-08 | Phase 7 | Complete |
| OPT-09 | Phase 7 | Complete |
| OPT-10 | Phase 7 | Complete |
| OPT-11 | Phase 7 | Complete |
| TELE-01 | Phase 6 | Pending |
| TELE-02 | Phase 6 | Pending |
| TELE-03 | Phase 6 | Pending |
| TELE-04 | Phase 6 | Pending |
| TELE-05 | Phase 6 | Pending |
| TELE-06 | Phase 6 | Pending |
| TELE-07 | Phase 6 | Pending |
| ADDON-01 | Phase 8 | Complete |
| ADDON-02 | Phase 8 | Complete |
| ADDON-03 | Phase 8 | Pending |
| ADDON-04 | Phase 8 | Pending |
| ADDON-05 | Phase 8 | Pending |
| ADDON-06 | Phase 8 | Complete |
| ADDON-07 | Phase 8 | Complete |
| ADDON-08 | Phase 8 | Complete |
| ADDON-09 | Phase 8 | Pending |
| ADDON-10 | Phase 1 | Pending |
| CONT-01 | Phase 7.2 | Complete |
| CONT-02 | Phase 7.2 | Complete |
| CONT-03 | Phase 7.2 | Complete |
| CONT-04 | Phase 7.2 | Complete |
| CONT-05 | Phase 7.2 | Complete |
| CMD-01 | Phase 1 | Pending |
| CMD-02 | Phase 1 | Pending |
| CMD-03 | Phase 1 | Pending |
| DATA-01 | Phase 8 | Complete |
| DATA-02 | Phase 8 | Complete |
| DATA-03 | Phase 6 | Pending |
| ONBD-01 | Phase 1 | Pending |
| ONBD-02 | Phase 1 | Pending |
| ONBD-03 | Phase 1 | Pending |
| HARD-01 | Phase 9 | Pending |
| HARD-02 | Phase 9 | Pending |
| HARD-03 | Phase 9 | Pending |
| HARD-04 | Phase 9 | Pending |
| HARD-05 | Phase 1 | Pending |
| HARD-06 | Phase 1 | Pending |
| HARD-07 | Phase 9 | Pending |
| HARD-08 | Phase 1 | Pending |
| HARD-09 | Phase 1 | Pending |
| HARD-10 | Phase 1 | Pending |

**Coverage:**

- v1 requirements: 126 total
- Mapped to phases: 126
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-10*
*Last updated: 2026-07-10 after initial definition*
