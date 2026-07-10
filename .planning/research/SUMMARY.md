# Project Research Summary

**Project:** NowPilot v0.1
**Domain:** Chrome MV3 Extension AI Assistant (Side Panel + Full App Tab)
**Researched:** 2026-07-10
**Confidence:** HIGH

## Executive Summary

NowPilot is a **local-first, privacy-first Chrome MV3 AI assistant extension** with a dual-surface architecture (compact Side Panel + Full App Tab). It occupies a unique market position: while all four major competitors (Merlin 20M+, Monica 10M+, Sider 10M+, MaxAI 1M+) are cloud-dependent and charge $19/mo for premium tiers, NowPilot offers **offline AI via Ollama, persistent cross-session memory owned by the system (not model-hallucinated), MCP integration for extensible tooling, and a structured Planner→Executor→Renderer pipeline optimized for cheap Haiku/Flash-tier models ($0.25/1M tokens)**.

The recommended approach is a **9-phase linear build** anchored on a strict layering model. The AI runtime lives exclusively in long-lived UI surfaces (Side Panel, Full App Tab) — never in the ephemeral service worker. A primary-writer election protocol coordinates the two surfaces sharing one workspace. Content scripts are extraction-only in v0.1 (no page-injected UI). The architecture enforces that **core never imports from add-ons, add-ons never bypass core APIs**, and all AI calls flow through `AgentOrchestrator.runTurn()` with tier caps preventing runaway agent loops.

**Key risks** (in priority order): (1) accidentally placing AI streaming or MCP in the ~30 s lifetime service worker; (2) dual-surface IndexedDB writes without coordination causing silent data loss; (3) UI components calling AI providers directly, bypassing ContextOptimizer, MemoryEngine, and tier caps; (4) exhausting chrome.storage.local's 10 MB quota with message bodies. All four are mitigated by explicit architecture rules enforced with lint rules, integration tests, and primary-writer election.

## Key Findings

### Recommended Stack

A single-design-system stack built on **Ant Design v6** (CSS-variable theming, enterprise-grade data components), avoiding the 6+ package Tailwind/Radix alternative. AI orchestration uses lightweight **Vercel AI SDK v4** with separate `@ai-sdk/*` adapters per provider rather than heavy LangChain (~500 KB+). Markdown rendering consolidates 5 packages into one (`@ant-design/x-markdown`, streaming-aware with built-in LaTeX, mermaid, code-highlight). State management is **Zustand v5 + Immer v10** (1 KB, works outside React for BroadcastBus handlers). No infrastructure for embeddings or vector search in v0.1 — MiniSearch bag-of-words is sufficient.

**Core technologies:**
- `wxt` ^0.19 + `@wxt-dev/module-react` ^0.3 — MV3 scaffold, HMR, cross-browser manifest generation; `openPanelOnActionClick` for side panel
- `react` ^19 + `antd` ^6 + `@ant-design/x` ^2 — UI framework with enterprise data components and AI chat primitives (Bubble, Sender, Conversations, ThoughtChain)
- `@ant-design/x-markdown` ^2 — Streaming-aware Markdown rendering, replaces 5 packages with 1
- `ai` ^4 + `@ai-sdk/openai` + `@ai-sdk/anthropic` + `@ai-sdk/google` — LLM orchestration: streaming, tool calling, abort; 5 providers via 3 adapters (OpenAI SDK covers OpenAI + Ollama + OpenAI-compatible)
- `zustand` ^5 + `immer` ^10 — Global state with mutable-style updates; `persist` middleware; works outside React
- `@modelcontextprotocol/sdk` ^1 — MCP client via StreamableHTTP transport (only transport viable from extension pages)
- `idb` ^8 + `chrome.storage` native — Split storage: message bodies in IndexedDB (unlimited), metadata/keys in chrome.storage.local (10 MB cap)
- `@mozilla/readability` + `turndown` + `dompurify` — Page extraction pipeline with XSS sanitisation
- `minisearch` ^7 — Local full-text search (< 50 ms over 1,000 notes); no model download
- `vitest` + `@testing-library/react` + `msw` — Testing stack with provider mocking

**Explicitly NOT adopted:** `tailwindcss`, `shadcn/ui`, `framer-motion` (use `motion`), `@ant-design/x-sdk` (duplicates and bypasses orchestration), `@ant-design/x-card` (A2UI deferred), `react-markdown` + ecosystem (superseded by `@ant-design/x-markdown`), `uuid`/`ulid` (use `crypto.randomUUID()`).

### Expected Features

**Must have (table stakes — missing = product feels incomplete):**
- AI chat with streaming responses and multi-model support (OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible)
- Side Panel UI (~400 px, compact AntD density, 4 pages + "Open Full App")
- Full App Tab (full viewport, AntD Layout with Sider navigation, 5 pages)
- Conversation history with auto-title generation, LRU eviction, cross-session persistence
- Dark/light/auto theme (AntD ConfigProvider + Zustand ThemeStore)
- Keyboard shortcuts (Cmd+K command palette, right-click context menu "Ask AI")
- Provider configuration with AES-GCM encrypted API keys and test-connection button
- Error handling with retry, circuit breaker, and automatic provider fallback
- Page context awareness (content script extraction via PageContextBridge)
- Text selection actions (explain, summarize, translate on right-click)

**Should have (differentiators — what sets NowPilot apart):**
- **Local-first / privacy-first AI** — works fully offline with Ollama/LM Studio; NO data leaves machine unless user configures cloud provider (unique — no competitor supports local models)
- **Planner→Executor→Renderer pipeline** — cheap models (Haiku/Flash tier) run structured agent workflows with tier caps preventing runaway loops (unique — Sider's "Claw" is a black-box alternative)
- **MCP integration** — 12 built-in tools plus external MCP servers via StreamableHTTP transport (unique — no competitor offers MCP)
- **Persistent cross-session memory** — system-owned; AI remembers user facts across conversations via MemoryEngine (unique — Merlin "Projects" requires manual document upload)
- **Dual-surface shared workspace** — Side Panel and Full App share live conversation/workspace state; primary writer election (unique — competitors have separate apps with no sync)
- **ServiceNow integration** — first-party add-on for support engineers (unique)
- **Add-on architecture** — extensible without forking; typed registries for pages, skills, context extractors (unique)
- **Note-taking with wikilinks and graph** — personal knowledge layer independent of chat; d3-force graph (unique)
- **Context-adaptive execution** — same code works with 4K local models up to 200K cloud models with graceful degradation

**Defer (v0.2+ or out of scope permanently):**
- Page-injected UI (Shadow DOM widgets, floating toolbars) → v0.2+
- PDF chat → v0.2+
- Image generation → permanently out of scope
- Email/social media reply generation → out of scope
- YouTube summarization → v0.2+
- Embedding-based semantic search → v0.2+ (40 MB model download not justified)
- `@ant-design/x-card` A2UI dynamic surfaces → v0.2+
- `@ant-design/x-sdk` (useXChat, ChatProvider) → never adopted (conflicts with orchestration)

**Feature dependency chain:** AI Runtime (Phase 3) is the linchpin. ContextOptimizer (Phase 4) wraps the AI runtime. MemoryEngine (Phase 5) depends on knowing token budgets from ContextOptimizer. Transaction logging (Phase 6) intercepts AI calls. All UI (Phase 7) depends on the full runtime stack.

### Architecture Approach

NowPilot runs in **four execution contexts** with strict responsibility boundaries. The **background service worker** is a facilitator only — it handles message dispatch, CORS proxy, lifecycle events, and alarms, but has zero AI, IndexedDB, or MCP code. The **Side Panel** is the primary AI runtime, owning every AI-related service (AgentOrchestrator, ProviderRouter, ContextOptimizer, MemoryEngine, AITransactionLog, MCPClient). The **Full App Tab** mounts the same core services (shared code, not duplicated) but presents a full-viewport shell with Sider navigation, diagnostics, configuration, and note-taking pages. **Content scripts** are extraction-only in v0.1 — they read the host page but render zero UI (enforced by bundle size tests).

**Major components:**
1. **AgentOrchestrator + Planner/Executor/Renderer** — The central AI pipeline. Planner (Haiku-tier, JSON-only, 3 s timeout) decides: answer/run_tool/ask_clarification. Executor (deterministic, no LLM) validates and runs tools with permission gates. Renderer (Flash-tier, 5 s timeout) produces streaming text. Tier caps prevent runaway loops (1–5 planner calls, 1–3 tool calls depending on context tier).
2. **ProviderRouter + 5 adapters** — Selection, retry (pre-first-token only), fallback, circuit breaker (3 failures/60 s → 5 min open). Never switches provider after first streamed token. Handles quota vs. rate-limit distinction.
3. **ContextOptimizer** — 4-tier classification (tiny ≤4K / small 8K–16K / medium 32K–128K / large ≥200K), dynamic token budgets, 8-step degradation pipeline, minimal mode for tiny models.
4. **MemoryEngine + 3 stores** — System-owned memory orchestration. MemoryExtractor runs as separate Haiku call after each turn, extracting facts with 5-factor scoring. Injected into context by ContextOptimizer.
5. **WorkspaceStore + BroadcastBus** — Cross-surface shared workspace with primary-writer election (compare-and-set via chrome.storage.session, 3 s heartbeat, tie-break: Full App > Side Panel). Handoff from Side Panel → Full App preserves workspace state via URL parameters.
6. **Core-Addon Registry architecture** — Core owns AI, storage, messaging, MCP. Add-ons register pages/skills/extractors through typed registries. Core never imports from add-ons. Add-ons never bypass core APIs. Invariant: `src/core/` NEVER imports from `src/addons/`.

**Key architectural patterns:**
- Planner→Executor→Renderer separation (cheap models drive structured workflows)
- Dual-surface with shared workspace and primary-writer election
- Extraction-only content scripts (no UI, no AntD, minimal bundle)
- Core-addon registry pattern
- System-owned memory (LLM never reads/writes memory directly)
- Split storage (metadata in chrome.storage.local, bodies in IndexedDB)
- WriteJournal for multi-store consistency (chat save + memory update as atomic operation)

### Critical Pitfalls

1. **Running AI providers from the Service Worker** — The SW terminates after ~30 s of inactivity, killing mid-stream AI calls, breaking MCP connections, and blocking EventSource. **Mitigation:** Architect all AI into Side Panel/Full App Tab. SW is facilitator only (PROXY_FETCH, lifecycle, alarms). Enforced by lint rule blocking `@ai-sdk/*` and `@modelcontextprotocol/sdk` in background.ts.

2. **Two surfaces writing to IndexedDB without coordination** — Race conditions on conversation history, memory writes, note saves cause silent data loss and duplicate AI calls double-charging provider credits. **Mitigation:** Primary-writer election via BroadcastBus + chrome.storage.session with compare-and-set. Only the primary writes; secondaries read and mirror. WriteJournal ensures idempotency. Tie-break: Full App > Side Panel.

3. **Direct AI calls from React components** — Calling `streamText()` or `@ai-sdk/*` from UI bypasses ContextOptimizer (no token budget), MemoryEngine (no memory injection), AITransactionLog (no traces), tier caps (unbounded loops), and circuit breaker (rate-limit spamming). **Mitigation:** All AI must go through `AgentOrchestrator.runTurn()`. Lint rule restricts `ai` and `@ai-sdk/*` imports to `src/core/ai/`. `useChat` hook is the only approved UI entry point.

4. **Storing message bodies in chrome.storage.local** — The 10 MB quota fills up after a few hundred conversations, causing ALL writes to fail silently (settings, API keys, conversation saves all break). **Mitigation:** Split storage — metadata in chrome.storage.local, message/memory/note bodies in IndexedDB (practically unlimited). Monitor quota usage; warn before 8 MB.

5. **Loading AntD in content script bundles** — Content scripts balloon to 500 KB+ with AntD; CSS injection conflicts with host-page styles; portal components break in Shadow DOM. **Mitigation:** Content scripts are extraction-only in v0.1 (zero UI rendering). In v0.2+, use Radix UI + Tailwind for injected UI. AntD stays in extension-owned pages only. Enforced by `tests/isolation/no-content-script-ui.test.ts` that greps the output bundle.

**Other significant pitfalls:** Async event listener registration in the SW (listeners must be registered synchronously at module load, never after `await`), BroadcastChannel message deduplication (every message must include `senderOrigin`; recipients filter out own messages), stream state not surviving Side Panel close/reopen (persist `np_active_stream` before unload, send abort, log aborted transaction), silent provider quota exhaustion (distinguish quota errors from rate limits in ProviderRouter; show specific actionable notification), prompt cache miss cascade (track hit rate; auto-disable after 5 consecutive misses for 60 s), and non-idempotent IndexedDB migrations (check target format before transforming; validate database state post-migration; record failures in ErrorStore).

## Implications for Roadmap

Based on research, the **9-phase linear build** from the PRODUCT_SPEC is correct and non-negotiable due to hard dependency chains. Phases 4 and 6 can be parallelized. The following refines the spec's phase structure with research-informed rationale:

### Phase 1: MV3/WXT Runtime + Shells + Workspace Coordination
**Rationale:** Greenfield foundation — without this, nothing can run. Must establish the extension skeleton, both UI surfaces, cross-context messaging, and workspace coordination before any data flows.
**Delivers:** WXT scaffold with background SW, side panel entrypoint, full app entrypoint. ThemeStore with dark/light/auto. WorkspaceStore with BroadcastBus primary-writer election (compare-and-set, 3 s heartbeat). RuntimeEnvelope<T> typed message wrapper. MessageBus, EventBus, BroadcastBus. SidePanelShell and AppShell with ConfigProvider + XProvider. Cmd+K command palette. Onboarding modal skeleton.
**Uses:** wxt, react, antd, motion, zustand
**Implements:** Background SW (facilitator only — BackgroundRouter, LifecycleManager, KeepAliveManager, ContextMenuHost, WorkspaceRouter), Side Panel/Full App shells
**Avoids:** Pitfall 1 (no AI in SW — lint rule enforced from day 1), Pitfall 2 (primary election protocol built now, not retrofitted), Pitfall 6 (synchronous listener registration in SW template), Pitfall 7 (BroadcastBus `senderOrigin` deduplication), Pitfall 13 (election race condition — read-check-write-re-read protocol), Pitfall 14 (CSP permits AntD style injection — test production build), Pitfall 23 (theme flicker — inline script sets `data-theme` before React mount)

### Phase 2: Storage + Security + WriteJournal
**Rationale:** Phase 3 needs encrypted storage for API keys. Phase 7 needs IndexedDB for conversation/notes/memory persistence. Must establish the split-storage strategy before any data is stored.
**Delivers:** SettingStore, EncryptedStorage (AES-GCM-256 via crypto.subtle with PBKDF2 key derivation). WriteJournal for multi-store consistency. IndexedDBMigrator with idempotent migrations. ChatHistoryDB, MemoryDB, NotesDB, ErrorStore, WriteJournalDB, KeyVault. RateLimiter.
**Uses:** idb, chrome.storage (local/session/sync)
**Implements:** Storage layer (all IndexedDB databases, chrome.storage layout, split-storage strategy)
**Avoids:** Pitfall 4 (message bodies in chrome.storage.local — enforced by split storage), Pitfall 11 (unencrypted API keys — enforced by EncryptedStorage), Pitfall 12 (non-idempotent migrations — idempotency checks + validation), Pitfall 20 (Zustand persist with chrome.storage — debounced writes)

### Phase 3: AI Runtime (THE LINCHPIN)
**Rationale:** Everything downstream depends on this phase. Without AI providers, orchestrator, and pipeline, nothing else can be built. This is the core differentiator — the structured Planner→Executor→Renderer pipeline with tier caps.
**Delivers:** All 5 providers (OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible) via @ai-sdk/* adapters. ProviderRouter with selection, retry, fallback, circuit breaker. TierResolver with model-to-tier mapping. AgentOrchestrator with tier-capped runTurn() loop. PlannerService (Haiku-tier, JSON-only, 3 s timeout), ExecutorService (deterministic validation + tool execution), RendererService (Flash-tier, streaming, 5 s timeout). PromptCacheManager with per-provider cache strategies. StructuredOutput with one-shot JSON repair. ChunkBuffer (rAF-batched streaming).
**Uses:** ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, zod, zod-to-json-schema, @modelcontextprotocol/sdk
**Implements:** Full AI runtime pipeline (Planner→Executor→Renderer), all provider adapters, ProviderRouter, AgentOrchestrator, MCPClient + 4 built-in tools (get-page-content, get-chat-history, run-skill, list-skills)
**Avoids:** Pitfall 1 (AI never in SW — verified by tests run from Side Panel context), Pitfall 3 (all AI through AgentOrchestrator — lint rule restricts direct imports), Pitfall 8 (stream state survives panel close — beforeunload persists np_active_stream), Pitfall 9 (quota exhaustion handled — specific notification for quota vs. rate limit), Pitfall 10 (cache miss cascade — per-provider strategies, auto-disable after 5 misses), Pitfall 17 (abort during tool permission prompts — AbortSignal propagation), Pitfall 18 (Ollama context window default — TierResolver detects and warns), Pitfall 19 (per-provider cache behavior — PromptCacheAdapter strategies)

### Phase 4: Context-Adaptive Execution
**Rationale:** Phase 5 MemoryEngine needs to know token budgets to decide how much memory to inject. Phase 7 Chat UI needs optimized context assembly. This phase enables cost-effective use of cheap models.
**Delivers:** ModelContextTier (tiny/small/medium/large classification). TokenBudget (model-specific token counting). ContextOptimizer (dynamic section assembly, 8-step degradation pipeline, minimal mode for tiny models). ContextCompressor (summary-based compression).
**Uses:** All Phase 3 runtime
**Implements:** ContextOptimizer pipeline (tier classification → token budget → section priority → degradation → optimized context assembly)
**Avoids:** Pitfall 10 (cache miss cascade detection in ContextOptimizer assembly)

### Phase 5: Persistent Memory
**Rationale:** Core differentiator. Depends on Phase 4 for token budget awareness and Phase 2 for storage infrastructure. System-owned memory means the LLM never directly reads/writes memory.
**Delivers:** MemoryEngine (orchestration, fact extraction, scoring, injection). ConversationMemoryStore (session-level summary). UserMemoryStore (cross-session facts, LRU capped at 500). PreferenceMemoryStore (user preferences). MemoryScorer (5-factor relevance scoring). MiniSearchIndex (hybrid retrieval: bag-of-words + semantic).
**Uses:** MiniSearch, Phase 3 AgentOrchestrator, Phase 4 ContextOptimizer, Phase 2 MemoryDB
**Implements:** Full memory system (extraction → scoring → storage → retrieval → injection)
**Avoids:** LLM-managed memory (system-owned only — the model never directly writes or retrieves memory)

### Phase 6: Transaction Logging + Diagnostics
**Rationale:** Depends only on Phase 3 (wraps all AI calls). Can run in parallel with Phase 4/5. Critical for debugging the AI pipeline — every provider call, tool execution, and cache hit/miss must be traceable.
**Delivers:** AITransactionLog (PromptTrace, ToolTrace, ProviderTrace with operation IDs). TraceRedactor (redacts API keys, MCP auth headers, session tokens before persistence). PromptInspector. DiagnosticsPanel in Full App → Options (AntD Table + Timeline + Descriptions). Copy operation ID, export debug bundle.
**Uses:** Phase 3 AI runtime
**Implements:** Full telemetry pipeline (logging → redaction → storage → diagnostics UI)
**Avoids:** Pitfall 11 (TraceRedactor must handle all 5 provider key formats + MCP auth headers)

### Phase 7: Full UI Pages
**Rationale:** Depends on Phases 1–6 (full runtime stack must be in place). This is where the user-visible product materializes. Both surfaces get their complete page sets.
**Delivers:** ChatPage (both surfaces — composer, streaming display, conversation list). AgentPage (both surfaces — tool-run display with ThoughtChain). NotesPage (Full App only — editor with wikilinks, autocomplete, graph view via d3-force). OptionsPage (Full App only — 11 sub-sections: Providers, Models, MCP, Context, Memory, Skills/Tools, Data, Prompts, Add-ons, Diagnostics, About). Shared hooks (useChat, useStreamingLLM). Widget components (Bubble, Sender, Conversations, ThoughtChain via @ant-design/x).
**Uses:** All Phase 3–6 runtime, @ant-design/x components, motion for animations
**Implements:** Full visible UI across both surfaces
**Avoids:** Pitfall 3 (no direct AI calls from UI — useChat is the only approved entry point), Pitfall 15 (tree-shakeable icon imports), Pitfall 16 (use App.useApp() for imperative APIs, never static import), Pitfall 23 (theme flicker — inline script for initial theme)

### Phase 8: Add-ons + Content Scripts (Extraction-Only)
**Rationale:** Depends on Phase 7 — add-ons register pages into the Side Panel and Full App shells. Content scripts are extraction-only in v0.1 (no UI injection).
**Delivers:** ContentScriptHost (extraction bridge, no UI mount). SPANavigationWatcher (MutationObserver-based, + history monkey-patch). PageContextBridge (url, title, meta, markdown via @mozilla/readability → PageContext). Write add-on (DraftSkill, RewriteSkill, SummarizeSkill, CustomerUpdateSkill). TeamGQM add-on (side panel compact view + full app workspace). ServiceNow add-on (case context extraction, CaseAnalyzer skill, CatchUp skill, CodeSearch skill, Table API via PROXY_FETCH). ResearchSkill (global add-on). AddonRegistry, SidePanelPageRegistry, FullAppPageRegistry, SkillRegistry, KeymapRegistry.
**Uses:** @mozilla/readability, turndown, Phase 3 AgentOrchestrator, Phase 4 ContextOptimizer
**Implements:** Content script extraction pipeline, add-on system with typed registries
**Avoids:** Pitfall 5 (no AntD in content scripts — bundle size test verifies < 50 KB, no React/AntD imports), Pitfall 22 (SPANavigationWatcher uses wxt:locationchange + title change + history monkey-patch, not polling)

### Phase 9: Hardening + Release
**Rationale:** Gates everything. All features must exist before hardening can begin. Production readiness requires performance testing, isolation verification, bundle analysis, and the "Looks Done But Isn't" checklist.
**Delivers:** Performance tests (chat scrolling at 500+ messages, memory leak detection over 8-hour sessions). Isolation tests (no-content-script-ui, no-cross-surface-imports, restricted-imports). Bundle size checks (content script < 50 KB, full app < 2 MB). Lint audit (all restricted import rules verified). "Looks Done But Isn't" checklist items: abort handling (all 5 providers), offline mode (Ollama-only), multi-window, extension update data survival, quota exhaustion degradation, concurrent stream prevention, provider-deleted-while-streaming, keyboard navigation, memory pressure.
**Uses:** All prior phases
**Avoids:** All pitfalls — this is the verification phase

### Phase Ordering Rationale

**Why this order (non-negotiable dependency chain):**
1. Phase 1 (Shells) → Phase 2 (Storage): WorkspaceStore needs persistence; API keys need encryption before they can be configured
2. Phase 2 (Storage) → Phase 3 (AI Runtime): Providers need EncryptedStorage for API keys; AITransactionLog needs IndexedDB
3. Phase 3 (AI Runtime) → Phase 4 (Context): ContextOptimizer wraps provider calls; needs model information from ProviderRouter
4. Phase 3 (AI Runtime) → Phase 6 (Logging): AITransactionLog wraps all provider/tool calls
5. Phase 4 (Context) → Phase 5 (Memory): MemoryEngine needs token budgets from ContextOptimizer to decide injection volume
6. Phases 3–6 → Phase 7 (UI): All pages need the runtime to be complete — they display real AI output, not skeletons
7. Phase 7 (UI) → Phase 8 (Add-ons): Add-ons register pages into shells that must already exist
8. Phases 1–8 → Phase 9 (Hardening): All features must exist before hardening

**Parallelization opportunity:** Phases 4 and 6 can run in parallel after Phase 3 — ContextOptimizer (Phase 4) and AITransactionLog (Phase 6) both depend on Phase 3 but not on each other. The tightest dependency is the Phase 3 → Phase 4 → Phase 5 chain, which is sequential.

**Why this grouping:** Each phase is a coherent, testable milestone. Phase 3 alone produces a working AI chat (with streaming) that validates the core differentiator — cheap models running structured agent workflows. Phase 3 completion is the first true "working demo."

### Research Flags

**Phases needing deeper research during planning (`/gsd-plan-phase --research-phase <N>`):**
- **Phase 3 (AI Runtime):** MCP StreamableHTTP transport behavior from extension pages needs empirical validation. Provider-specific error shapes (quota vs. rate-limit vs. auth) differ across all 5 providers — need a test fixture catalog. JSON repair strategy for malformed Planner output needs testing across Haiku/Flash models with different context windows.
- **Phase 4 (Context-Adaptive Execution):** The 8-step degradation pipeline is theoretical — needs empirical testing to verify that degraded prompts still produce useful AI output. Token counting without `tiktoken` (using 4 chars ≈ 1 token heuristic) needs accuracy validation across provider/model combinations.
- **Phase 5 (Persistent Memory):** The 5-factor relevance scoring algorithm needs empirical tuning. Memory injection volume vs. context window budget trade-offs need testing across all 4 tiers.
- **Phase 8 (Add-ons + Content Scripts):** ServiceNow's JSESSIONID extraction from MAIN world content scripts needs real-world testing (ServiceNow instance variations). SPA navigation detection via MutationObserver + history monkey-patch needs validation on actual ServiceNow navigation patterns.

**Phases with well-documented patterns (skip research-phase):**
- **Phase 1 (Shells):** WXT v0.19 docs are comprehensive; Chrome MV3 side panel API is well-documented; Zustand + BroadcastChannel patterns are established
- **Phase 2 (Storage):** IndexedDB via `idb` wrapper is well-documented; AES-GCM via crypto.subtle is standardized; chrome.storage API is mature
- **Phase 7 (UI):** Ant Design v6 components are well-documented with examples; @ant-design/x chat components have reference implementations
- **Phase 9 (Hardening):** Performance testing, bundle analysis, and isolation testing are standard processes with established tooling (vitest, WXT build analysis, Chrome DevTools)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All technologies verified against official docs. Version constraints confirmed (React 19 minimum for AntD v6, AntD v6 required for @ant-design/x v2). Alternatives documented with clear rationale. Explicitly-not-adopted list prevents wrong packages. |
| Features | **MEDIUM** | Competitive landscape is strong (detailed feature matrices for Monica, Sider, MaxAI, Merlin). Table stakes / differentiators / anti-features are well-defined. Confidence is MEDIUM, not HIGH, because: (1) ServiceNow integration validation is theoretical until tested against real instances, (2) tier caps (1–5 planner calls) are estimated — empirical testing needed, (3) user demand for local-first/privacy-first vs. cloud AI is inferred from market gap, not user research. |
| Architecture | **HIGH** | Architecture is derived from a detailed PRODUCT_SPEC with explicit component boundaries, layer invariants, data flows, and anti-patterns. All 4 execution contexts have defined responsibilities. Cross-surface coordination protocol is specified in detail (compare-and-set election, heartbeat, tie-break). Core-addon registry pattern is a known good pattern. Confidence is HIGH because this is a greenfield design (no legacy constraints). |
| Pitfalls | **HIGH** | 24 pitfalls identified (5 critical, 9 moderate, 10 minor) with concrete prevention strategies, warning signs, and phase-to-pitfall mapping. Sources include Chrome MV3 lifecycle docs, WXT community knowledge, common extension development patterns, and the PRODUCT_SPEC. Recovery strategies documented for worst-case scenarios. "Looks Done But Isn't" checklist covers 10 common verification gaps. |

**Overall confidence:** **HIGH** — The research is thorough, sourced from official documentation, and grounded in a detailed PRODUCT_SPEC. The main areas of uncertainty are empirical (MCP transport from extensions, tier cap effectiveness with real models, ServiceNow extraction robustness) — these will be resolved during implementation, not through further research.

### Gaps to Address

- **MCP StreamableHTTP from extension pages:** The spec recommends this transport because SW cannot use EventSource, but the behavior from a Side Panel page (which runs in an extension context, not a regular web page) needs empirical validation. Plan a spike in Phase 3 to verify transport stability.
- **JSON repair for Planner output:** The StructuredOutput module performs one-shot JSON repair on malformed Planner responses, but the specific repair strategies (trailing comma, unclosed brace, truncated JSON) need testing across Haiku/Flash models to verify reliability. This is a Phase 3 execution risk.
- **ServiceNow extraction robustness:** The content script must extract JSESSIONID from `window.g_ck` in MAIN world. ServiceNow instances vary in their cookie/global variable structure. Need real-world testing across multiple instances (demo, dev, prod). This is a Phase 8 execution risk.
- **Tier cap calibration:** The tier caps (tiny: 1 planner/1 tool, small: 2 planner/1 tool, medium: 3 planner/2 tool, large: 5 planner/3 tool) are estimated from the spec. They need empirical validation to confirm they produce useful results without runaway loops. Monitor AITransactionLog in Phase 6 to tune these caps.
- **Token counting accuracy without tiktoken:** The 4 chars ≈ 1 token heuristic avoids a 3 MB WASM download. Accuracy needs validation across provider/model combinations (GPT-4, Claude, Gemini, local models have different tokenizers). This affects ContextOptimizer budget accuracy in Phase 4.
- **Prompt cache effectiveness:** Anthropic's 4-cache-breakpoint limit means prompt structure must be carefully ordered. Gemini's 32K token minimum for cachedContent means it's only viable in medium+ tiers. Cache hit rate monitoring in Phase 6 will reveal effectiveness.

## Sources

### Primary (HIGH confidence)
- **PRODUCT_SPEC_v0_1.md** — Canonical specification for all architecture decisions, component boundaries, data flows, feature definitions, tier caps, security requirements, and phase structure. §7 defines the technology stack, §9 defines features, §10 defines AI & MCP architecture, §14 defines skills & tooling, §18 defines implementation phases.
- **PROJECT.md** — Core value proposition, constraints (MV3 restrictions, package hygiene, cross-surface isolation), key decisions.
- **Chrome Side Panel API reference** (developer.chrome.com) — MV3 side panel architecture, setPanelBehavior, open() requiring user gesture.
- **Chrome MV3 Service Worker lifecycle docs** (developer.chrome.com) — 30 s idle timeout, 5 min max per event, global variable loss, sync listener registration requirement, no Web Storage API, no EventSource.
- **WXT v0.19 documentation** (wxt.dev) — Entrypoint types, HMR, defineBackground() with type: 'module', defineContentScript() with world: 'ISOLATED', openPanelOnActionClick.
- **Vercel AI SDK v4 documentation** (sdk.vercel.ai) — streamText(), generateText(), tool calling, AbortSignal propagation, textStream async iterable.
- **Ant Design v6 documentation** — CSS-variable theming, ConfigProvider API, compactAlgorithm, useApp() for imperative APIs.
- **Ant Design X 2.x documentation** — Bubble, Sender, Conversations, ThoughtChain, XProvider, Think, Attachments.
- **Zustand v5 documentation** — persist middleware, create API, selector patterns, useShallow.
- **@modelcontextprotocol/sdk documentation** — StreamableHTTP transport, client setup, tool registration.
- **@mozilla/readability documentation** — Article extraction API, HTML → clean content.

### Secondary (MEDIUM confidence)
- **Monica (monica.im)** — Product page analysis; 10M+ users; sidebar + toolbar + desktop + mobile; all-in-one strategy; bot platform.
- **Sider AI (sider.ai)** — Product page analysis; 10M+ users; Chat/Claw/Code three-mode strategy; Wisebase knowledge platform; space missions.
- **MaxAI (maxai.co)** — Product page analysis; 1M+ users; simplicity-focused positioning; trusted-by-enterprise messaging.
- **Merlin AI (getmerlin.in)** — Product page analysis; 20M+ users; Projects, Crafts, infographics, social media integration; 102 queries/day free tier.
- **Chrome for Developers: Extensions and AI** (developer.chrome.com/docs/extensions/ai) — Chrome's built-in AI APIs (Prompt API, Summarizer API, Writer API, Translator API); WebMCP standard; security guidance for AI extensions.
- **WXT v0.19 Changelog** — openPanelOnActionClick, side panel HMR support, CSS processing in content scripts.
- **Community knowledge** — WXT Discord, Chrome Extensions Google Group, extension developer forums; common pitfalls and patterns.

### Tertiary (LOW confidence — needs validation)
- **ServiceNow instance variations** — JSESSIONID/sysparmCK availability across different ServiceNow versions and configurations; needs real-world testing.
- **MCP StreamableHTTP from extension pages** — Theoretical compatibility, empirically unverified; needs Phase 3 spike.
- **Tier cap effectiveness** — 1–5 planner calls, 1–3 tool calls are estimated; needs empirical validation with real Haiku/Flash models.

---

*Research completed: 2026-07-10*
*Ready for roadmap: yes*
