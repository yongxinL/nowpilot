# Feature Landscape

**Domain:** Chrome MV3 Extension AI Assistant (Side Panel + Full App Tab)
**Researched:** 2026-07-10
**Confidence:** MEDIUM

## Competitor Landscape Summary

Four major Chrome AI extensions dominate the market as of 2026:

| Extension | Users | Key Moat | UI Strategy | Monetization |
|-----------|-------|----------|-------------|--------------|
| **Merlin** | 20M+ | Projects (knowledge bases), Crafts (infographics), social media integration | Sidebar + Web App | Freemium (102 queries/day free, $19/mo Pro) |
| **Monica** | 10M+ | All-in-one (chat/summary/write/search/translate/art/bots), bot platform | Sidebar + Smart Toolbar + Desktop + Mobile | Freemium |
| **Sider** | 10M+ | Claw (browser agent), Code (website customization), Wisebase (knowledge) | Sidebar + Web App + Desktop + Mobile | Freemium |
| **MaxAI** | 1M+ | Simplicity, chat-with-page, trusted-by-enterprise positioning | Sidebar + Web App | Freemium |

**Universal table stakes across all competitors:**
- AI chat with streaming and multi-model support (GPT, Claude, Gemini minimum)
- Page/content summarization (web pages, articles)
- YouTube video summarization with timestamps
- Text selection actions (explain, translate, rewrite on highlight)
- Writing assistance (rewrite, change tone, professionalize)
- Keyboard shortcut activation (Cmd+M / Ctrl+M)
- Dark/light theme support
- Conversation history with session management
- Web search integration alongside search results

**Common advanced features (differentiators within the competitive set):**
- PDF chat / document Q&A (Monica, MaxAI, Sider)
- Page-injected UI (smart toolbar, floating widgets) (Monica, Sider, MaxAI)
- Image generation (DALL-E, Stable Diffusion) (Monica, MaxAI, Merlin)
- Bot/custom chatbot platforms (Monica, Merlin)
- Email reply generation — Gmail integration (Monica, Merlin, MaxAI)
- Social media content — X, LinkedIn (Merlin, Monica)
- Desktop + Mobile apps alongside extension (all four)
- Deep research with citations (Sider, Merlin)
- Diagram/infographic generation from prompts (Merlin)
- Browser agent — multi-step automated tasks on real websites (Sider "Claw")

**KEY GAP in market:** NO major competitor offers local-first/privacy-first AI. All are cloud-dependent. None offer MCP integration, persistent cross-session memory, built-in note-taking with wikilinks, or domain-specific integration (ServiceNow). This is NowPilot's differentiation territory.

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Competitor Standard | Notes |
|---------|--------------|------------|---------------------|-------|
| AI chat with streaming | Every AI assistant must have this | HIGH | All four; Monica/Sider use sidebar, Merlin uses Ctrl+M popup | Requires Planner→Executor→Renderer pipeline, ContextOptimizer, ChunkBuffer, `@ant-design/x-markdown` |
| Multiple AI providers | Users have preferences; local+cloud flexibility | MED | All four support GPT + Claude + Gemini minimum; some add DeepSeek, Mistral, Llama | 5 adapters via `@ai-sdk/*`; ProviderRouter handles selection, retry, fallback, circuit breaker |
| Side Panel UI | Chrome's built-in persistent panel — users expect it | MED | Monica, Sider, MaxAI all use sidebar strategy; Merlin uses popup overlay | ~400 px, compact AntD density, 4 pages + Open Full App |
| Full App Tab | Deep work, config, diagnostics — users expect a "full" mode | MED | All competitors offer web app (separate domain); NowPilot inlines as extension page | Full viewport, AntD Layout with Sider, 5 pages; chrome-extension:// URL |
| Conversation history | Cross-session continuity — every competitor has this | MED | All four save sessions with preview text, timestamps, starring | IndexedDB ChatHistoryDB; LRU eviction (10 active + 100 archived); auto-title generation |
| Dark/light theme | Visual preference — table stakes for any app in 2026 | LOW | Universal across competitors | AntD `theme.darkAlgorithm` + `ConfigProvider`; Zustand ThemeStore; auto mode respects OS preference |
| Keyboard shortcuts | Power users expect this; consistent across competitors | LOW | Ctrl+M is de facto standard (Monica, Merlin, Sider) | KeymapRegistry; Cmd+K command palette on both surfaces |
| Provider configuration | Must be able to add API keys to make the extension work | MED | All competitors offer this in settings; some proxy keys through servers | AES-GCM encrypted keys in `chrome.storage.local`; Options → Providers section; test-connection button |
| Error handling + retry | Providers fail, tokens expire; users expect recovery | MED | All competitors show error states with retry; Monica/Merlin have fallback models | AntD notifications; retry buttons; circuit breaker; ProviderRouter automatic fallback |
| Page context awareness | Answer questions about the current page — core value prop | MED | All four have this; Monica/Sider use toolbar + sidebar; Merlin uses popup/overlay | Content scripts extract page content via PageContextBridge; `get-page-content` MCP tool |
| Text selection actions | Explain, summarize, translate selected text — all competitors offer | LOW | Universal via toolbar (Monica/Sider/MaxAI) or right-click (Merlin) | Right-click context menu "Ask AI" → opens side panel with selection prefilled |

---

## Differentiators

Features that set NowPilot apart. Not expected by users of general AI assistants, but uniquely valuable.

### Tier 1: Core Differentiators (Unique or Nearly Unique)

| Feature | Value Proposition | Complexity | Competitive Gap | Notes |
|---------|-------------------|------------|------------------|-------|
| **Local-first / privacy-first AI** | No data leaves machine unless user configures cloud provider; works fully offline with Ollama/LM Studio | HIGH | **NONE** of Monica, Sider, MaxAI, or Merlin support local models. All are cloud-dependent and require accounts. | Ollama provider via `@ai-sdk/openai`; `allowCloudFallbackFromLocal` preference; first-run onboarding guides local setup |
| **Planner → Executor → Renderer pipeline** | Cheap models (Haiku/Flash tier) can safely run structured agent workflows without runaway loops | HIGH | Sider's "Claw" is closest competitor — but it's a black-box browser agent, not a structured pipeline | Tier caps (1–5 planner calls, 1–3 tool calls per context tier); Planner is JSON-only; Executor is deterministic |
| **MCP integration (12 built-in tools + external servers)** | Connect to any MCP server for extensible tool ecosystem; StreamableHTTP transport | HIGH | **No competitor offers MCP.** Closest: Merlin has "tools" and Sider has "Claw" but neither uses MCP protocol | `@modelcontextprotocol/sdk` Client + StreamableHTTP transport; built-in tools include notes, clipboard, page extraction, webhooks, skills |
| **Persistent cross-session memory** | AI remembers user facts, preferences, and patterns across conversations — system-owned, not model-hallucinated | HIGH | Merlin "Projects" (knowledge bases) is closest but requires manual document upload; Monica/Sider don't persist facts across sessions | 3 stores: ConversationMemoryStore, UserMemoryStore, PreferenceMemoryStore; MemoryEngine orchestrates; 5-factor scoring for retrieval |
| **Dual-surface with shared workspace** | Quick side panel for context-adjacent work + full app tab for deep work — same conversation, synchronized | HIGH | All competitors either have sidebar-only OR separate web app — none have both surfaces share a live workspace | WorkspaceStore (Zustand) + BroadcastBus sync; primary writer election (3s heartbeat); handoff URL preserves state; only one primary writer at a time |

### Tier 2: Strong Differentiators

| Feature | Value Proposition | Complexity | Competitive Gap | Notes |
|---------|-------------------|------------|------------------|-------|
| **Add-on architecture** | Extensible without forking; add-ons register pages/skills/context-extractors | MED | Merlin has "tools" but no true add-on registry. Monica has a bot platform but it's cloud-hosted prompts, not local code | Core registries (SidePanelPageRegistry, FullAppPageRegistry, AddonRegistry); add-ons own extraction + pages + skills; core never imports from add-ons |
| **ServiceNow integration** | Support engineers get case context extraction, skills (CaseAnalyzer, CatchUp, CodeSearch), table API client | MED | **Unique.** No competitor targets ServiceNow; competitors are general-purpose | First-party add-on; JSESSIONID/sysparmCK extraction via content scripts; Table API via PROXY_FETCH; skills use AI for analysis |
| **AI/MCP transaction logging** | Debug what the AI did — copy operation ID to share; full trace of planner decisions, tool calls, provider attempts | MED | No competitor exposes this level of debugging. Merlin and Monica log internally but don't surface to users | AITransactionLog with PromptTrace, ToolTrace, ProviderTrace; DiagnosticsPanel in Full App → Options; TraceRedactor for security |
| **Note-taking with wikilinks and graph** | Personal knowledge layer independent of chat — atomic notes link together, graph visualization | MED | **Unique.** None of Monica, Sider, MaxAI, or Merlin offer note-taking. Sider's Wisebase is closer to a research library. | NotesDB, LinkParser, WikilinkAutocomplete, NoteGraphView (d3-force); export/import; Full App only (too heavy for Side Panel) |
| **Context-adaptive execution** | Works with 4K local models and 200K cloud models — same code, graceful degradation | HIGH | No competitor optimizes for small-context models. All assume GPT-4/Claude-level context. | 4 tiers (tiny/small/medium/large); dynamic token budget; 8-step degradation pipeline; minimal mode for tiny models; ContextProvenanceManifest |
| **Cost-optimized for Haiku/Flash tier** | Prompt caching, structured output repair, tier caps, token budget — designed for $0.25/1M token models | HIGH | Competitors optimize for premium models (GPT-4, Claude Opus); pricing reflects this ($19/mo Merlin, Monica paid tiers) | PromptCacheManager with provider-specific hints; StructuredOutput with one-shot JSON repair; tier caps prevent token waste |
| **Prompt templates + slash commands** | `/write`, `/ask`, `/research`, `/summarize` — reusable prompt templates with variable substitution | MED | Monica has 80+ templates; Merlin has prompt library; competitors offer this but as paid features | PromptManager, TemplateEngine with `{{variable}}` syntax; SlashCommandRegistry; built-in templates in Appendix A of spec |

### Tier 3: Nice-to-Have Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Write add-on (draft/rewrite/summarize/customer-update) | Content creation workflows without leaving the side panel | MED | `DraftSkill`, `RewriteSkill`, `SummarizeSkill`, `CustomerUpdateSkill`; clipboard or selection input |
| TeamGQM add-on | Team quality management integration — quick digest + full workspace | MED | Side panel: compact quick view; Full App: history, reports, detailed workspace |
| ResearchSkill (global add-on) | Web research via connected MCP server or built-in search; `/research` slash command | MED | Sources with citations; graceful failure if no search tool connected; rate-limited |
| Data export/import | User owns their data; portable JSON/ZIP export with redaction | LOW | Sanitized export (no API keys); merge-mode import; `DataPortability` module |
| DiagnosticsPanel | Full trace viewer in Options — see every AI call, tool execution, provider attempt | MED | AntD Table + Timeline + Descriptions; copy operation ID; export debug bundle; Side Panel shows toast with "Open Diagnostics" |
| Cmd+K command palette | Power-user navigation across both surfaces; unified command set | LOW | AntD Modal with filtered list; "Open Full App", "Focus Side Panel", "Open Options", slash commands |
| Tab pinning | Pin web pages as persistent AI context (max 10) — AI answers with page knowledge | LOW | `WorkspaceStore.pinTab`; `chrome.scripting.executeScript` + 5s timeout; context injected via ContextOptimizer |
| Macros (data-driven workflows) | Multi-step skill + MCP tool chains — data, not code; no `eval` | MED | `WorkflowRunner` executes sequentially; `{{step_N_output}}` variable passing |

---

## Anti-Features

Features to explicitly NOT build (at least in v0.1).

| Anti-Feature | Why Requested | Why Problematic | What to Do Instead |
|--------------|---------------|-----------------|-------------------|
| **Page-injected UI** (Shadow DOM widgets, floating toolbars) | Competitors (Monica, Sider, MaxAI) all have this; users expect inline actions | CSP conflicts, style bleed with host pages, 500KB+ bundle bloat, Shadow DOM complexity, host page DOM mutation risk | Deferred to v0.2+ (§25 of spec); deliver all value through Side Panel + Full App; content scripts extraction-only in v0.1 |
| **Direct AI calls from UI components** | Quick to implement; feels natural in React | Bypasses ContextOptimizer, MemoryEngine, tier caps, transaction logging, TraceRedactor; security boundary collapses | All AI calls go through AgentOrchestrator → ContextOptimizer → Planner/Executor/Renderer pipeline |
| **Large-model agent loops** (maxSteps=15, ReAct pattern) | "Real agents" need many steps; popular in tutorials | Haiku/Flash cannot drive this safely; runaway loops common; wastes tokens for cost-sensitive models; MCP chaining amplifies risk | Tier caps: 1–5 planner calls, 1–3 tool calls depending on context tier (§1.4 of spec) |
| **Embedding-based search** (vector DB, semantic search) | Impressive demos; "AI-native" feel | 40 MB+ model download not justified for note/memory search; bag-of-words + MiniSearch sufficient for v0.1 scale; requires embedding model management | MiniSearch (full-text, bag-of-words, cosine similarity) for v0.1; revisit for v0.2+ |
| **`@ant-design/x-sdk`** (useXChat, ChatProvider) | Ships with Ant Design X; reduces boilerplate | Duplicates ProviderRouter/AgentOrchestrator/ContextOptimizer; would let UI code call providers directly, violating layering; SDK assumes cloud-first, single-provider pattern | Use `@ant-design/x` presentation components only (Bubble, Sender, Conversations, ThoughtChain); all data flow through core AI runtime |
| **`@ant-design/x-card`** (A2UI dynamic surfaces) | AI-generated UI cards are compelling for rich responses | Adds significant complexity; dynamic surface generation requires schema→UI mapping engine; premature for v0.1 | Deferred to v0.2+ (§25.6 of spec); use structured cards in RendererService via AntD Cards/Tables |
| **PDF chat** | Competitors (Monica, MaxAI, Sider) offer this as key feature | Materially different context extraction pipeline; PDF rendering + parsing is a full feature domain; risk of scope creep | Deferred to v0.2+; not in spec for v0.1 |
| **Image generation** (DALL-E, Stable Diffusion, Flux) | All competitors (Monica, MaxAI, Merlin, Sider) offer this prominently | Completely different provider ecosystem; requires image model APIs, aspect ratio handling, prompt engineering for images; not aligned with privacy-first/local-first philosophy | Out of scope for NowPilot entirely — NowPilot is about text/agent/knowledge workflows, not media generation |
| **Email/social media reply generation** | Merlin, Monica, MaxAI all integrate with Gmail/X/LinkedIn | Requires page-specific DOM injection to add reply buttons (conflicts with no-page-injection rule); each platform has different DOM structures; maintenance burden | Not in v0.1 scope; could be an add-on in v0.2+ using extraction-only approach (read email, but reply via clipboard or Side Panel, not DOM injection) |
| **Real-time cloud sync of conversations** | Users want conversations on all devices | Requires server infrastructure (privacy-first design is local-only); IndexedDB is local; `chrome.storage.sync` has 8KB limit | Data export/import for manual transfer between devices; `chrome.storage.sync` for theme/language only |
| **Audio/video generation** (Sora 2, podcast generation) | Monica and Merlin both offer this | Completely different infrastructure; not aligned with text/knowledge focus of NowPilot | Out of scope permanently |
| **"Chat with everything"** (YouTube, PDF, images, code all in one box) | Merlin, Sider market this as unified experience | Makes ContextOptimizer enormously complex; each content type needs different extraction + compression strategies; premature generalization | Build strong text + page context first; add content types incrementally as add-ons or in later milestones |

---

## Feature Dependencies

```
Phase 1: MV3/WXT Shells + AntD + Workspace
├── Creates: Side Panel/Full App shells, ThemeStore, WorkspaceStore, BroadcastBus
└──→ Phase 2: Storage + Security + WriteJournal
    ├── Creates: IndexedDB stores, encrypted API keys, WriteJournal consistency
    └──→ Phase 3: AI Runtime (5 providers, AgentOrchestrator)
        ├── Creates: Provider adapters, Planner→Executor→Renderer, CircuitBreaker
        ├──→ Phase 4: Context-Adaptive Execution
        │   ├── Creates: ContextOptimizer, tier classification, token budgets, degradation
        │   └──→ Phase 5: Persistent Memory
        │       ├── Creates: MemoryEngine, 3 memory stores, MemoryScorer, MiniSearchIndex
        │       └──→ Memory injection depends on ContextOptimizer token budget
        ├──→ Phase 6: Transaction Logging + Diagnostics
        │   └── Creates: AITransactionLog, TraceRedactor, DiagnosticsPanel
        └──→ Phase 7: Full UI Pages (Chat, Agent, Notes, Options)
            ├── Creates: ChatPage (both surfaces), AgentPage, NotesPage (Full App), OptionsPage (Full App)
            ├── Depends on: Phase 3 (AI) + Phase 4 (Context) + Phase 5 (Memory) + Phase 6 (Logging)
            └──→ Phase 8: Add-ons + Content Scripts (Extraction-Only)
                ├── Creates: ContentScriptHost, PageContextBridge, Write/TeamGQM/ServiceNow add-ons, ResearchSkill
                └──→ Phase 9: Hardening + Release
```

**Critical dependency chain:** AI Runtime (Phase 3) → Context Optimization (Phase 4) → Memory (Phase 5)

- Cannot build memory without knowing token budget
- Cannot know token budget without ContextOptimizer
- Cannot build ContextOptimizer without provider models selected
- **Phase 3 is the linchpin** — everything downstream depends on it

**Other important dependencies:**
- WorkspaceStore (Phase 1) must exist before ChatPage (Phase 7) — chat writes to workspace
- EncryptedStorage (Phase 2) must exist before Provider config (Phase 3) — API keys need encryption
- IndexedDB stores (Phase 2) must exist before Conversation history (Phase 7) — messages need persistence
- Transaction logging (Phase 6) depends on AI Runtime (Phase 3) — must intercept provider/tool calls

---

## Competitor Feature Analysis Matrix

| Feature | Monica | Sider | MaxAI | Merlin | NowPilot (v0.1) |
|---------|--------|-------|-------|--------|------------------|
| AI Chat (multi-model) | ✅ | ✅ (Chat mode) | ✅ | ✅ | ✅ (P0) |
| Streaming responses | ✅ | ✅ | ✅ | ✅ | ✅ (P0) |
| Page summarization | ✅ | ✅ | ✅ | ✅ | ✅ (P0, via get-page-content tool) |
| YouTube summarization | ✅ | ✅ | ✅ | ✅ | ❌ (deferred to v0.2+) |
| Text selection actions | ✅ (toolbar) | ✅ (toolbar) | ✅ (toolbar) | ✅ (popup) | ✅ (right-click "Ask AI") |
| Writing assistance | ✅ | ✅ | ✅ | ✅ | ✅ (Write add-on P0) |
| Web search integration | ✅ | ✅ | ✅ | ✅ | ✅ (ResearchSkill P1) |
| Keyboard shortcut | ✅ (Cmd+M) | ✅ | ✅ | ✅ (Cmd+M) | ✅ (Cmd+K palette P1) |
| Dark/light theme | ✅ | ✅ | ✅ | ✅ | ✅ (P1) |
| Conversation history | ✅ | ✅ | ✅ | ✅ | ✅ (P0) |
| **Local/offline AI** | ❌ | ❌ | ❌ | ❌ | ✅ **(differentiator)** |
| **Agentic workflows** | ❌ (bot platform only) | ✅ (Claw) | ❌ | ❌ | ✅ **(differentiator, structured pipeline)** |
| **MCP integration** | ❌ | ❌ | ❌ | ❌ | ✅ **(unique)** |
| **Persistent memory** | ❌ | ❌ | ❌ | ⚠️ (Projects, manual) | ✅ **(differentiator)** |
| **Note-taking + wikilinks** | ❌ | ❌ | ❌ | ❌ | ✅ **(unique)** |
| **ServiceNow integration** | ❌ | ❌ | ❌ | ❌ | ✅ **(unique)** |
| **Add-on architecture** | ❌ | ❌ | ❌ | ❌ (tools only) | ✅ **(unique)** |
| **Dual-surface workspace** | ⚠️ (sidebar + separate web app, no sync) | ⚠️ (sidebar + separate web app) | ⚠️ (sidebar + separate web app) | ⚠️ (popup + separate web app) | ✅ **(differentiator, shared state)** |
| PDF chat | ✅ | ✅ | ✅ | ✅ | ❌ (deferred to v0.2+) |
| Image generation | ✅ | ✅ | ✅ | ✅ | ❌ (anti-feature) |
| Page-injected UI | ✅ (toolbar) | ✅ (toolbar) | ✅ (toolbar) | ❌ (popup only) | ❌ (anti-feature for v0.1) |
| Desktop app | ✅ | ✅ | ❌ | ❌ (web app) | ❌ (extension-only) |
| Mobile app | ✅ | ✅ | ❌ | ✅ | ❌ (extension-only) |
| Social media integration | ❌ | ❌ | ⚠️ (reply only) | ✅ (Gmail, X, LinkedIn) | ❌ (out of scope) |
| Bot/custom chatbot platform | ✅ | ❌ | ❌ | ✅ | ❌ (out of scope) |
| Prompt templates | ✅ (80+ templates) | ❌ | ❌ | ✅ | ✅ (P1) |
| Slash commands | ❌ | ❌ | ❌ | ❌ | ✅ **(differentiator)** |

**Legend:** ✅ = has feature | ⚠️ = partial/hybrid | ❌ = doesn't have

---

## MVP Recommendation

Prioritize for first working demo (Phase 3 completion validates the core):

1. **ProviderRouter + 3 providers** (OpenAI, Anthropic, Ollama) — Minimum to validate local + cloud AI runtime
2. **AgentOrchestrator** (Planner → Executor → Renderer) — Core differentiator; validates tier caps with cheap models
3. **ChunkBuffer + Side Panel Chat** — First visible AI interaction; streaming must work
4. **WorkspaceStore + Full App Tab handoff** — Validates dual-surface architecture; proves shared workspace

Defer from MVP to later phases:

- All 5 providers: Gemini and OpenAI-compatible can wait (less common initially)
- All 12 built-in MCP tools: First 4 (get-page-content, get-chat-history, run-skill, list-skills) sufficient
- Notes with graph: Core chat + agent is the first milestone; notes are Phase 7
- All add-ons: Write add-on first (simplest global add-on), then ServiceNow, then TeamGQM
- Diagnostics: Phase 6; Phase 3 should log minimally (debugLog), full traces later
- User memory + preferences: Phase 5; conversation memory is sufficient for early validation
- ContextOptimizer full degradation pipeline: Phase 4; basic token counting sufficient for Phase 3
- Transactions logging: Phase 6; console.log sufficient for early debugging

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase | Why This Order |
|---------|------------|---------------------|----------|-------|----------------|
| WXT MV3 scaffold + two shells + workspace | HIGH | MED | P0 | 1 | Foundation everything builds on |
| Storage + API key encryption + WriteJournal | HIGH | MED | P0 | 2 | Must be before any data is stored |
| 5 AI provider adapters + ProviderRouter | HIGH | HIGH | P0 | 3 | Core differentiator; gates all AI features |
| AgentOrchestrator + Planner/Executor/Renderer | HIGH | HIGH | P0 | 3 | Core differentiator; enables agent workflows |
| ContextOptimizer + tier system | HIGH | HIGH | P0 | 4 | Enables cost-effective small-model usage |
| Memory (conversation + user + preference) | HIGH | HIGH | P1 | 5 | Differentiator; depends on context budget |
| Transaction logging + Diagnostics | MED | MED | P1 | 6 | Debug tooling; nice but not blocking |
| Full Chat + Agent pages (both surfaces) | HIGH | MED | P0 | 7 | Visible AI interaction; requires Phases 1-6 |
| Full Notes page (Full App only) | MED | MED | P1 | 7 | Differentiator; independent of AI pipeline |
| Full Options page (Full App only) | HIGH | MED | P0 | 7 | Required to configure providers/settings |
| Add-ons + content scripts (extraction-only) | MED | HIGH | P1 | 8 | ServiceNow, Write, TeamGQM; research skill |
| Hardening + performance + release | HIGH | MED | P1 | 9 | Polish before ship |

**Priority key:** P1 = Must have for v0.1 launch | P2 = Should have, add post-launch | P3 = Nice to have, v0.2+

## Sources

- **Monica** (monica.im) — product page and feature list; 10M+ users, Chrome + Edge + Desktop + Mobile
- **Sider AI** (sider.ai) — product page; Chat/Claw/Code three-mode strategy; Wisebase knowledge platform
- **MaxAI** (maxai.co) — product page; 1M+ users; simplicity-focused positioning
- **Merlin AI** (getmerlin.in) — product page; 20M+ users; Projects, Crafts, social media integration
- **Chrome for Developers: Extensions and AI** (developer.chrome.com/docs/extensions/ai) — Chrome's built-in AI APIs (Prompt API, Summarizer API, Writer API, Translator API); WebMCP standard; security guidance
- **PRODUCT_SPEC_v0_1.md** — canonical feature specification for NowPilot v0.1 (§6 Scope, §9 Features, §10 AI & MCP, §14 Skills & Tooling, §18 Implementation Phases)
- **PROJECT.md** — core value proposition and constraints

---

*Feature landscape for: NowPilot — Chrome MV3 AI Assistant*
*Researched: 2026-07-10*
*Last updated with competitor analysis: 2026-07-10*
