# NowPilot — Product Specification v0.1 (Standalone)

**Document ID:** PRODUCT_SPEC_v0_1.md
**Status:** Canonical, standalone implementation reference
**Date:** 2026-07-27 (Rev. B — Knowledge-first reorganization + LLM-Wiki + RICH Design; content-complete for cost-effective coding agents)
**Version:** v0.1
**Scope:** NowPilot v0.1 — Chrome MV3 AI Assistant using Side Panel + Full App Tab. Add-on architecture preserved. Page injection deferred to v0.2+.

**Revision note (Rev. B — 2026-07-27):** This revision folds three previously separate documents into this canonical spec while **keeping the version at v0.1**, and preserves the full verbatim depth (all appendix code) required by cost-effective coding agents (Claude Haiku, DeepSeek Flash, Gemini Flash):

1. **LLM-Wiki & Filesystem Sync** — merged as **§27**, with the `Note` type extension (§21.2), the `notes_backup_config` IndexedDB store + v4 migration (§15.1, §20.4), the `yaml` + `@types/wicg-file-system-access` dependencies (§7.5, §7.8), and Phase 5a (§18).
2. **RICH Design Requirements** — Role / Intention / Conversation / Hybrid-UI best practices from the [Ant Design X RICH paradigm](https://x.ant.design/docs/spec/introduce). Merged as **§17.7**, with persona runtime seeds in Phase 3, RICH waves 7.3/7.4/7.5 in Phase 7, and the two reconciliations (R1 clipboard-only host-page actions; R2 persona → PreferenceMemoryStore).
3. **Knowledge-first phase reorganization** — §18 re-sequenced to follow the product data-flow (*acquire → store → understand → display → extend → harden*). PageContentService → Phase 4a; Notes/Memory/MiniSearch consolidate into Phase 5 (Knowledge Base); LLM-Wiki → Phase 5a; Phase 7 becomes the pure Workspace Experience (UI/UX) phase hosting the RICH sub-waves.

**Revision note (Rev. A):** v0.1 targets **Ant Design v6** and **Ant Design X 2.x** (component library + x-markdown) instead of AntD v5 with a hand-assembled markdown stack. @ant-design/x-sdk's chat-data-flow layer (useXChat, ChatProvider) and @ant-design/x-card (A2UI) are explicitly **not** adopted in v0.1 — see §0.2 and §25.6 for rationale.

**Purpose:** This document is the single, self-contained product specification for NowPilot v0.1. It does not reference any prior document. Any AI coding agent implementing this spec must treat this file as authoritative and complete.

**Target implementation agents:** Anthropic Claude Haiku, Google Gemini Flash, DeepSeek Flash, or equivalent cost-effective coding models.
**Target runtime providers:** Claude Haiku, Gemini Flash, DeepSeek Flash, Ollama, LM Studio, OpenAI-compatible endpoints, OpenAI, Anthropic, Gemini.
**Primary application:** Chrome MV3 extension using WXT + React + TypeScript + Ant Design v6 + Ant Design X 2.x.

### How to Read This Specification

Read in this exact order:

- §0 — Hard Rules
- §1 — Cost-Effective Runtime AI Architecture
- §2 — Context-Adaptive Execution
- §3 — Persistent Memory Architecture
- §4 — AI/MCP Transaction Logging
- §5 — WXT / MV3 / Ant Design / Isolation
- §6 — Executive Summary & Scope
- §7 — Technology Stack
- §8 — Architecture Design
- §9 — Feature Specification
- §10 — AI & MCP Integration
- §11 — Critical User Flows
- §12 — Component State Matrix
- §13 — Concurrency Rules
- §14 — Skills & Tooling Framework
- §15 — Storage Architecture
- §16 — Security
- §17 — UI/UX Requirements (incl. §17.7 RICH Design)
- §18 — Master Implementation Phases (reorganized in Rev. B)
- §19 — Runtime Edge Cases
- §20 — Runtime State Models & Cross-Context Coordination
- §21 — Data Models
- §22 — Performance Targets & Algorithms
- §23 — Key Technology Decisions (ADRs)
- §24 — Verification Commands
- §25 — Future Page Injection Architecture & Deferred UI Features
- §26 — PageContentService (Layered Page Extraction)
- §27 — LLM-Wiki & Filesystem Sync
- Appendices A–M — canonical constants, type registry, and reference implementations

Appendices C, E, F, G, I, J, K, L, and M are **mandatory** reading for any AI coding agent.

## §0 — Hard Rules (Non-Negotiable)

These rules apply to every phase, every module, and every AI coding agent.

### §0.1 Read Order and Scope

- Read §§0–5 fully before writing any code.
- Read §§6–17 as background for the feature being implemented.
- Read §§18–27 and the relevant appendix for the current phase.
- Do not implement more than one phase per response unless explicitly requested.

### §0.2 DO NOT Rules

**Codegen safety:**

- **DO NOT** invent file paths. Use only paths in §8 and §18.
- **DO NOT** invent type names. Use Appendix C for every shape.
- **DO NOT** invent tool names. Planner may only select tools from the enum passed by ExecutorService.
- **DO NOT** invent provider IDs. The five valid IDs are `'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openai-compatible'`.
- **DO NOT** invent runtime model names. Resolve tier: `'haiku' | 'flash'` through Appendix D.

**MV3 / Chrome:**

- **DO NOT** call AI providers, MCP servers, or EventSource from the background service worker.
- **DO NOT** open IndexedDB from the background service worker.
- **DO NOT** use setInterval in the background service worker. Use chrome.alarms.
- **DO NOT** set a custom User-Agent header in any fetch().
- **DO NOT** use remote code execution or eval().

**Storage / secrets:**

- **DO NOT** store ServiceNow session tokens or API keys in chrome.storage.local. Use chrome.storage.session for tokens and AES-GCM-encrypted chrome.storage.local for API keys.
- **DO NOT** store conversation message bodies in chrome.storage.local. Bodies live in IndexedDB MemoryDB.
- **DO NOT** log raw prompt bodies, raw tool inputs/outputs, cookies, clipboard text, ServiceNow raw case body, or API keys by default. All logging goes through TraceRedactor.

**UI / DOM (v0.1):**

- **DO NOT** render UI from content scripts in v0.1. Content scripts are extraction-only.
- **DO NOT** use Shadow DOM UI in v0.1. Shadow DOM UI is deferred to v0.2+ (see §25).
- **DO NOT** manipulate host page DOM for UI purposes. Content scripts may only read.
- **DO NOT** write back into host-page fields, editors, or textareas in v0.1. RICH-H-04 ("Insert into page") and RICH-H-07 ("Fill this field") degrade to **clipboard-only** in v0.1 (reconciliation R1, §17.7.5). Host-page write-back is deferred to v0.2+ page injection (§25). Retained: "Copy code", "Save as macro", "Save to note".
- **DO NOT** import antd components into content scripts or the background service worker.
- **DO NOT** put heavy admin/configuration screens in the Side Panel. Those belong in the Full App Tab under Options.
- **DO NOT** use innerHTML, dangerouslySetInnerHTML, or document.write.
- **DO NOT** use setTimeout/setInterval for DOM polling in content scripts. Use MutationObserver.
- **DO NOT** install tailwindcss, @tailwindcss/vite, shadcn/ui, @radix-ui/react-*, class-variance-authority, clsx, or tailwind-merge. Removed in v0.1.

**Filesystem (Rev. B — LLM-Wiki, §27):**

- **DO NOT** call `showDirectoryPicker()` or persist a `FileSystemDirectoryHandle` from a content script or the background service worker. The File System Access API is used **only in the Full App page** (NotesPage / Options).
- **DO NOT** store a `FileSystemDirectoryHandle` in chrome.storage.local (non-JSON-serializable). Use the dedicated `notes_backup_config` IndexedDB store.
- **DO NOT** capture password field values during extraction or note conversion (`isPassword ⇒ value omitted`).

**Cross-surface layering:**

- **DO NOT** import from src/entrypoints/app/** inside src/entrypoints/sidepanel/** or vice versa. Each surface is independently mountable.
- **DO NOT** call chrome.tabs.create for the Full App from a content script. Only the side panel, popup, background SW (in response to user gesture), and command palette may open the Full App.

**AI orchestration:**

- **DO NOT** let the LLM execute tools directly. PlannerService may request tools; ExecutorService validates and runs them.
- **DO NOT** use large-model agent loops (maxSteps=15) for Haiku/Gemini Flash/DeepSeek Flash. Use the tier caps in §1.4.
- **DO NOT** use raw full history in prompts. All prompts pass through ContextOptimizer.
- **DO NOT** assemble any system prompt without the persona block once `PersonaInjector` (RICH-R-02) exists. Every AI call (Planner, Executor, Renderer, MemoryExtractor) routes its system string through `PersonaInjector.inject()` (§17.7, Appendix A note).

**Storage / persona (Rev. B — reconciliation R2):**

- **DO NOT** store persona configuration in `UserMemoryStore` (the fact store). Persona is user configuration, not an inferred fact. It lives in `PreferenceMemoryStore` (`np_persona`) and `UserPreferences.personaId` / `personaOverrides` (§3.5).

**Package hygiene:**

- **DO NOT** install @anthropic-ai/sdk, openai, or @google/generative-ai directly. Use @ai-sdk/* adapters only.
- **DO NOT** install framer-motion. The correct package is motion (Framer Motion v12); import from motion/react.
- **DO NOT** use ulid or uuid. Use native crypto.randomUUID().
- **DO NOT** install @ant-design/x-sdk, or use its useXChat, useXConversations, ChatProvider, OpenAIChatProvider, or DeepSeekChatProvider exports. These duplicate ProviderRouter/AgentOrchestrator/ContextOptimizer and would let UI code call providers directly, violating the rule above and §2.3. @ant-design/x **presentation** components (Bubble, Sender, Conversations, ThoughtChain, etc.) and @ant-design/x-markdown are approved — see §7.2 and §23.
- **DO NOT** install or use @ant-design/x-card. A2UI dynamic-surface generation is deferred to v0.2+ (§25.6).

**Layering:**

- **DO NOT** import from src/addons/** inside src/core/**.
- **DO NOT** put ServiceNow-specific token names (JSESSIONID, sysparmCK, g_ck) or DOM selectors in core. They live only in src/addons/servicenow/**.

**Cross-context messaging:**

- **DO NOT** send a cross-context message without a RuntimeEnvelope<T> (Appendix C, Appendix E).
- **DO NOT** paraphrase canonical strings or prompts. Use STR (Appendix B) and PROMPTS (Appendix A) verbatim.

### §0.3 Implementation Constraints for Low-Cost Coding Agents

- Every public module boundary must have a Zod schema and at least one fixture test.
- Every phase must define a real npm script under verify:phase-N.
- Every module marked @implementation-tier: sonnet-class must be stubbed by Haiku/Flash implementers, not written.
- Every catch block must call debugLog(code, message, context). Empty catches are forbidden.

### §0.4 Canonical Runtime Concepts

| Concept | File | Purpose |
|---|---|---|
| PlannerService | src/core/ai/PlannerService.ts | Cheap JSON-only action planner |
| ExecutorService | src/core/ai/ExecutorService.ts | Deterministic MCP/skill/built-in tool executor |
| RendererService | src/core/ai/RendererService.ts | Final concise response renderer |
| AgentOrchestrator | src/core/ai/AgentOrchestrator.ts | Planner → Executor loop with tier caps (Appendix I) |
| ProviderRouter | src/core/ai/ProviderRouter.ts | Provider selection, retry, fallback, circuit breaker |
| TierResolver | src/core/ai/TierResolver.ts | Maps haiku/flash tier → concrete (providerId, model) (Appendix D) |
| PromptCacheManager | src/core/ai/PromptCacheManager.ts | Prompt cache segmentation and provider hints |
| PromptCacheAdapter | src/core/ai/PromptCacheAdapter.ts | Per-provider cache-hint transformation (Appendix K) |
| StructuredOutput | src/core/ai/StructuredOutput.ts | JSON mode + schema validation + one-shot repair (Appendix L) |
| ChunkBuffer | src/core/ai/ChunkBuffer.ts | rAF-batched streaming UI buffer (Appendix J) |
| PersonaProfile (Rev. B) | src/core/ai/persona/PersonaProfile.ts | AI identity/personality/tone config (RICH-R-01) |
| PersonaInjector (Rev. B) | src/core/ai/persona/PersonaInjector.ts | Injects persona into system prompts (RICH-R-02) |
| IntentClassifier (Rev. B) | src/core/intent/IntentClassifier.ts | URL/hostname heuristic for quick-actions (RICH-I-08, no LLM) |
| ModelContextTier | src/core/context/ModelContextTier.ts | tiny/small/medium/large classification |
| ContextOptimizer | src/core/context/ContextOptimizer.ts | Dynamic token budget, compression, degradation |
| ContextCompressor | src/core/context/ContextCompressor.ts | Structured text/page/case/history compression |
| MemoryEngine | src/core/memory/MemoryEngine.ts | System-owned memory orchestration |
| ConversationMemoryStore | src/core/memory/ConversationMemoryStore.ts | Per-conversation summary + recent turns |
| UserMemoryStore | src/core/memory/UserMemoryStore.ts | Cross-session fact/preference/pattern memory |
| PreferenceMemoryStore | src/core/memory/PreferenceMemoryStore.ts | User behavioural preferences (persona config lives here — Rev. B) |
| AITransactionLog | src/core/telemetry/AITransactionLog.ts | AI/MCP/tool/provider operation trace |
| AITransactionLogDB | src/core/telemetry/AITransactionLogDB.ts | IndexedDB trace persistence |
| TraceRedactor | src/core/telemetry/TraceRedactor.ts | Redaction before logs/UI/export |
| WriteJournal | src/core/storage/WriteJournal.ts | Multi-store consistency (metadata + IndexedDB body) |
| IndexedDBMigrator | src/core/storage/IndexedDBMigrator.ts | Versioned migrations |
| WorkspaceStore (NEW) | src/core/workspace/WorkspaceStore.ts | Shared workspace across Side Panel and Full App Tab (Appendix M) |
| WorkspaceRouter (NEW) | src/core/workspace/WorkspaceRouter.ts | Handoff URL parse/build + cross-surface sync |
| SidePanelPageRegistry | src/core/registry/SidePanelPageRegistry.ts | Add-on registration of Side Panel pages |
| FullAppPageRegistry (NEW) | src/core/registry/FullAppPageRegistry.ts | Add-on registration of Full App pages |
| PageContentService | src/core/extraction/PageContentService.ts | Core layered page extraction (§26) |
| NoteTagger (Rev. B) | src/core/notes/NoteTagger.ts | LLM: tags + category + summary + memory facts (§27) |
| NoteQA (Rev. B) | src/core/notes/NoteQA.ts | RAG Q&A over notes + memory (§27) |
| NoteChatConverter (Rev. B) | src/core/notes/NoteChatConverter.ts | Chat/page → structured note draft (§27) |
| NoteFileSync (Rev. B) | src/core/notes/NoteFileSync.ts | One-way app→filesystem .md sync (§27) |
| NoteMaintenance (Rev. B) | src/core/notes/NoteMaintenance.ts | Staleness/orphan detection, bulk analysis (§27) |
| DiagnosticsPanel | src/components/options/DiagnosticsSection.tsx | Full App → Options → Diagnostics UI |

## §1 — Cost-Effective Runtime AI Architecture

### §1.1 Runtime Design Principle

NowPilot must assume the active runtime model may be cheap, fast, weaker at reasoning, small-context, local, or configured as the user's only provider. The system must not rely on the model to remember, decide tool safety, or preserve state.

Runtime AI uses: `PlannerService → ExecutorService → RendererService` with a bounded loop between Planner and Executor as defined in §1.4 and Appendix I.

### §1.2 Planner → Executor → Renderer Flow

```
flowchart TD
User[User input from Side Panel or Full App] --> TxStart[AITransactionLog.start]
TxStart --> Workspace[WorkspaceStore.load]
Workspace --> Memory[MemoryEngine]
Memory --> Context[ContextOptimizer]
Context --> Orchestrator[AgentOrchestrator]
Orchestrator --> Planner[PlannerService]
Planner --> Decision{PlannerDecision}
Decision -->|answer or clarification| Renderer[RendererService]
Decision -->|run_tool| Executor[ExecutorService]
Executor --> ToolResult[ToolExecutionResult]
ToolResult --> Orchestrator
Renderer --> Stream[ChunkBuffer + React UI]
Stream --> MemoryUpdate[MemoryEngine.update]
MemoryUpdate --> WorkspaceUpdate[WorkspaceStore.persist]
WorkspaceUpdate --> TxDone[AITransactionLog.complete]
```

#### PlannerService

Planner returns exactly one of the following, validated by Zod:

```ts
export const PlannerDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('answer'), reasonCode: z.string().max(64) }),
  z.object({
    action: z.literal('run_tool'),
    toolName: z.string().max(64),   // ExecutorService supplies a closed z.enum at request time
    input: z.unknown(),
  }),
  z.object({ action: z.literal('ask_clarification'), question: z.string().max(200) }),
]);
```

Rules:

- Use haiku tier where available (Appendix D).
- Return JSON only. Do not explain reasoning.
- Timeout: 3 seconds.
- One malformed-JSON repair retry only (Appendix L).
- If planner fails twice: fallback to `{ action: 'answer', reasonCode: 'planner_failed' }`.
- ExecutorService **must** narrow toolName to a closed z.enum derived from the currently registered tools before passing the schema to the model.

> **Rev. B note:** the `ask_clarification` branch is the runtime substrate for RICH-C-01 (AI-initiated clarification chips, §17.7). No schema change is required — RICH adds the chip UI + detection heuristics on top of this existing branch.

#### ExecutorService

Deterministic. It must:

- reject unknown tool names,
- validate input against the tool's Zod schema,
- check permission policy,
- check model/context-tier capability,
- run the tool with timeout,
- validate output against the tool's Zod output schema,
- return ToolExecutionResult<T>.

The LLM never executes tools directly.

#### RendererService

Renderer converts validated context and tool output into a concise answer.

Rules:

- Use flash tier where available (Appendix D).
- Do not invent missing tool results.
- Use structured output for cards/tables/checklists.
- Timeout: 5 seconds for normal answers.
- Max normal output: 512 tokens unless the feature overrides.

> **Rev. B note:** RendererService's structured card/table/checklist path is the substrate for RICH-C-05 follow-up chips and RICH-H-19 step-cards (§17.7).

### §1.3 Prompt Shape and Prompt Caching

Every AI call uses this canonical section order:

```
[SYSTEM: cached, canonical]            ← PersonaInjector prepends persona block here (Rev. B)
[TOOL SCHEMAS: cached, canonical]
[USER PREFERENCES: compact]            ← includes persona overrides (Rev. B)
[MEMORY: compact top-k]
[CONTEXT: optimized]
[TASK: small]
[USER INPUT: current turn]
```

Rules:

- Stable sections must be byte-identical across repeated calls where possible.
- Tool schemas must be sorted by stable tool name.
- Whitespace in cached sections must be stable.
- Current user input and in-flight assistant output are never cached.
- Prompt cache hits/misses are logged in AITransactionLog.
- The persona block (RICH-R-02) is prepended inside the cached `[SYSTEM]` section by `PersonaInjector`; it must be byte-stable for a given persona so it does not break caching.

Provider-specific cache behaviour is implemented in PromptCacheAdapter — see Appendix K.

### §1.4 Agent Step Limits

| Context tier | Max planner calls | Max tool calls | MCP chaining | Agent mode |
|---|---|---|---|---|
| tiny ≤4K | 1 | 1 | Disabled | Minimal mode only |
| small 8K–16K | 2 | 1 | Disabled by default | Single-tool task |
| medium 32K–128K | 3 | 2 | Enabled | Limited agent |
| large ≥200K | 5 | 3 | Enabled | Full agent |

The AgentOrchestrator (Appendix I) is the only module allowed to enforce these caps.

### §1.5 Provider Routing and Fallback

ProviderRouter selects providers using cost, latency, reliability, privacy mode, configured priority, and provider availability.

Fallback rules:

- If only one provider exists, retry once only for retryable pre-first-token failures.
- Do not silently switch from local to cloud when allowCloudFallbackFromLocal=false.
- Never switch provider after hasStreamedFirstToken === true.
- Record every attempt in AITransactionLog.

State that ProviderRouter must track per operation:

```ts
interface RouterAttemptState {
  operationId: string;
  attempts: ProviderAttempt[];
  hasStreamedFirstToken: boolean;
  circuitBreakerOpen: Record<ProviderId, number>; // reopen after cool-down ms
}
```

Retry / circuit breaker policy:

- Retryable pre-first-token errors: TIMEOUT, PROVIDER_5XX, NETWORK, RATE_LIMITED.
- Non-retryable: AUTH, MODEL_UNKNOWN, SCHEMA_INVALID, HOST_NOT_PERMITTED.
- Circuit breaker: after 3 consecutive failures for a provider within 60 s, mark provider open for 5 minutes.

## §2 — Context-Adaptive Execution

### §2.1 Model Context Tiers

```ts
export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';
export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096)   return 'tiny';
  if (contextWindow <= 16384)  return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}
```

| Tier | Context window | Typical provider | Runtime strategy |
|---|---|---|---|
| tiny | ≤4K | default local model | Minimal mode, one tool max |
| small | 8K–16K | tuned local model | Summary + last few turns |
| medium | 32K–128K | strong local/cloud model | Balanced context |
| large | ≥200K | large cloud Flash/Haiku class | Full context with caching |

### §2.2 Token Budget Formula

```
inputBudget  = floor(modelContextWindow * 0.70)
outputBudget = floor(modelContextWindow * 0.20)
safetyMargin = floor(modelContextWindow * 0.10)
```

Dynamic distribution:

| Tier | System | Tools | Memory | Context | History | User |
|---|---|---|---|---|---|---|
| tiny | 15% | 20% | 10% | 20% | 15% | 20% |
| small | 10% | 15% | 10% | 25% | 20% | 20% |
| medium | 8% | 12% | 10% | 30% | 25% | 15% |
| large | 5% | 10% | 10% | 35% | 25% | 15% |

Token counting rule: use the provider-native counter when the SDK exposes it; else fall back to `Math.ceil(text.length / 4)` for English and `Math.ceil(text.length / 3)` for CJK.

### §2.3 ContextOptimizer Contract

```ts
export interface ContextOptimizerInput {
  operationId: string;
  model: string;
  modelContextWindow: number;
  userInput: string;
  conversationId: string;
  workspaceId: string;                     // NEW in v0.1
  activeSurface: 'sidepanel' | 'full-app'; // NEW in v0.1
  pageContext?: PageContext;
  selectedToolSchemas: ToolSchemaRef[];
  memoryHints: RetrievedMemory[];
  preferences: UserPreferences;
}
export interface OptimizedContext {
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  sections: PromptSection[];
  provenance: ContextProvenanceManifest;
  minimalMode: boolean;
}
```

Direct prompt assembly in React components is forbidden. All AI calls must consume an OptimizedContext.

### §2.4 Degradation Pipeline

When estimated tokens exceed budget:

- Drop debug-only context.
- Drop secondary notes and optional metadata.
- Summarise older history.
- Compress page/case context into structured fields.
- Trim tool schemas to the tools currently in scope.
- Reduce memory injection top-k.
- Enter minimal mode.
- If still too large, return a typed CONTEXT_TOO_LARGE error with a user-facing explanation.

### §2.5 Minimal Mode

Mandatory for tiny models.

Allowed:

- compact system prompt,
- compact preference profile,
- top 3 user memories,
- conversation summary ≤ 200 tokens,
- last 1–2 turns,
- at most one safe tool schema.

Blocked:

- multi-step agent,
- MCP chaining,
- CodeSearchSkill,
- full note-graph injection,
- large research synthesis,
- **LLM-Wiki bulk operations and RAG synthesis (§27)** — "Ask notes" falls back to plain MiniSearch results with no LLM synthesis in tiny mode.

### §2.6 Context Provenance Manifest

Every OptimizedContext carries a manifest recording where each section came from so PromptInspector can display provenance without the raw body.

```ts
export interface ContextProvenanceManifest {
  sections: Array<{
    kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input';
    sourceId: string;
    tokens: number;
    truncated: boolean;
    compressionApplied?: 'summarise' | 'structural' | 'topk';
  }>;
  totalTokens: number;
  minimalMode: boolean;
  workspaceId: string;         // NEW in v0.1
  activeSurface: 'sidepanel' | 'full-app'; // NEW in v0.1
}
```

## §3 — Persistent Memory Architecture

### §3.1 Memory Principle

Memory is system-owned. The LLM does not own persistent memory. Three layers:

```
Conversation memory  → continuity inside one conversation
User memory          → durable cross-session facts / preferences / patterns
Preference memory    → behavioural settings and response style
```

Memory is shared across surfaces — the Side Panel and Full App Tab read the same memory stores through MemoryEngine.

### §3.2 Recommended Framework Choice

```
Zustand       → runtime/UI state (including WorkspaceStore)
IndexedDB/idb → persistent large memory bodies
MiniSearch    → local full-text retrieval
MemoryEngine  → orchestration, scoring, summarisation, injection
```

Do **not** use LangChain, LlamaIndex, MemGPT, remote vector DBs, or embedding downloads in v0.1.

### §3.3 Conversation Memory

```ts
export interface ConversationMemory {
  conversationId: string;
  summary: string;
  summaryTokens: number;
  lastMessages: Array<{
    role: 'user' | 'assistant' | 'tool';
    content: string;
    tokens: number;
    timestamp: number;
  }>;
  updatedAt: number;
}
```

Rules:

- Keep last 2 turns for tiny.
- Keep last 4 turns for small.
- Keep last 6 turns for medium/large.
- Summarise older messages after every 12 messages.
- Store message bodies in IndexedDB only.

### §3.4 User Memory

```ts
export interface UserMemoryFact {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'pattern';
  tags: string[];
  confidence: number;         // 0..1
  source: 'explicit' | 'inferred' | 'system';
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  useCount: number;
}
```

Retrieval scoring — every sub-score must be normalised to [0, 1]:

```
keywordScore   = matchedQueryTerms / totalQueryTerms
tagScore       = matchedTags / max(1, memoryTags.length)
recencyScore   = clamp(1 - (now - updatedAt) / (30 * DAY), 0, 1)
useCountScore  = min(1, useCount / 20)
confidenceScore = confidence
score = keywordScore   * 0.45
      + tagScore       * 0.25
      + recencyScore   * 0.15
      + useCountScore  * 0.10
      + confidenceScore* 0.05
```

Injection rules:

- top 5 memories maximum,
- top 3 memories maximum in tiny mode,
- total memory injection ≤ 1000 tokens,
- never inject secrets or raw customer data.

> **Rev. B — MEM-02 note (§27):** LLM-Wiki extracts memory-worthy facts from saved notes into this store via the existing MemoryExtractor schema. This is the **only** notes→memory direction (D-05); memory never auto-writes notes. The extraction runs on the primary surface only (§13).

### §3.5 Preference Memory

```ts
export interface UserPreferences {
  responseStyle: 'concise' | 'balanced' | 'detailed';
  preferredLanguage: string;
  preferStructuredOutput: boolean;
  allowCloudFallbackFromLocal: boolean;
  defaultProviderId?: ProviderId;
  toolAutonomy: 'ask_every_time' | 'allow_safe_tools' | 'manual_only';
  defaultSurface: 'sidepanel' | 'full-app';  // NEW in v0.1
  themeMode: 'light' | 'dark' | 'auto';      // NEW in v0.1 (moved from chrome.storage.sync)
  // --- Rev. B — RICH persona (reconciliation R2: user config, NOT a fact) ---
  personaId?: string;
  personaOverrides?: {
    name?: string;
    tone?: 'professional-warm' | 'concise' | 'friendly';
    brevity?: 'brief' | 'balanced' | 'detailed';
  };
}
```

Preferences are injected as compact JSON, not verbose prose. **Persona configuration (RICH-R-05) persists in this store (`np_persona`), never in UserMemoryStore (reconciliation R2, §17.7.5).**

## §4 — AI/MCP Transaction Logging and Diagnostics

### §4.1 Purpose

Every AI, MCP, skill, tool, context, cache, fallback, and provider operation must be traceable for troubleshooting.

AITransactionLog tracks: operation ID, provider/model, prompt token breakdown, context tier, truncation/compression decisions, prompt-cache hit/miss/write, MCP/tool calls, permission decisions, retries/fallbacks, errors, first-token timing, total duration, **workspaceId** (NEW), **activeSurface** — sidepanel | full-app (NEW).

### §4.2 Storage and Retention

| Mode | Enabled | Raw prompt/body | Retention |
|---|---|---|---|
| Lightweight metadata | Always | No | Last 200 transactions or 14 days |
| Debug deep trace | User opt-in | Redacted previews only | Last 50 traces or 72 hours |

### §4.3 Core Trace Types

```ts
export interface AITransaction {
  id: string;
  sessionId?: string;
  conversationId?: string;
  workspaceId?: string;                    // NEW in v0.1
  activeSurface?: 'sidepanel' | 'full-app'; // NEW in v0.1
  userTurnId?: string;
  type: 'chat' | 'planner' | 'renderer' | 'structured_output'
      | 'mcp_tool' | 'builtin_tool' | 'skill' | 'proxy_fetch';
  status: 'started' | 'streaming' | 'waiting_for_permission'
        | 'completed' | 'failed' | 'aborted' | 'retried' | 'fallback_used';
  providerId?: ProviderId;
  model?: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  errorCode?: string;
}
export interface PromptTrace {
  operationId: string;
  promptTemplateId: string;
  promptHash: string;
  systemTokens: number;
  toolSchemaTokens: number;
  contextTokens: number;
  memoryTokens: number;
  historyTokens: number;
  userInputTokens: number;
  totalInputTokens: number;
  maxContextWindow: number;
  contextTier: ModelContextTier;
  truncated: boolean;
  truncatedSources: string[];
  minimalMode: boolean;
  promptCache: {
    enabled: boolean;
    cacheKey?: string;
    hit: boolean;
    write: boolean;
    providerCacheId?: string;
    estimatedSavedTokens?: number;
  };
}
export interface ToolTrace {
  operationId: string;
  parentOperationId?: string;
  toolName: string;
  source: 'mcp' | 'builtin' | 'skill' | 'servicenow' | 'write' | 'teamgqm';
  dangerous: boolean;
  permission: {
    required: boolean;
    decision: 'allowed_once' | 'allowed_always' | 'denied' | 'not_required';
    decidedAt?: number;
  };
  inputSchemaHash: string;
  inputSizeBytes: number;
  outputSchemaHash?: string;
  outputSizeBytes?: number;
  outputTokens?: number;
  status: 'started' | 'completed' | 'failed' | 'timeout' | 'aborted';
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  error?: { code: string; message: string; retryable: boolean };
}
export interface ProviderTrace {
  operationId: string;
  attempts: Array<{
    providerId: ProviderId;
    model: string;
    startedAt: number;
    endedAt?: number;
    firstTokenAt?: number;
    outcome: 'success' | 'retry' | 'fallback' | 'failed';
    errorCode?: string;
  }>;
  circuitBreakerTriggered: boolean;
}
```

### §4.4 Redaction Rules

TraceRedactor must redact before persistence, UI display, console logging, or export:

```
API keys
Bearer tokens
JSESSIONID
sysparm_ck
g_ck
ServiceNow raw case body
clipboard text unless explicitly user-provided
MCP auth headers
raw prompt body by default
raw tool input/output by default
```

Required patterns:

```ts
const REDACTION_PATTERNS = [
  /sk-[A-Za-z0-9_-]+/g,
  /key-[A-Za-z0-9_-]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /JSESSIONID=[^;\s]+/gi,
  /sysparm_ck[=:]\s*[^&\s]+/gi,
  /g_ck[=:]\s*[^&\s]+/gi,
];
```

> **Rev. B note:** LLM-Wiki extracted note content and filesystem paths are redacted before indexing/logging (§27.6). RICH feedback (👍/👎, RICH-C-10) is logged anonymously with no user-identifiable data.

### §4.5 Diagnostics UI

Diagnostics live in **Full App → Options → Diagnostics** (src/components/options/DiagnosticsSection.tsx).

The Side Panel does NOT contain the Diagnostics UI. It may show error toasts with a "Open Diagnostics" button that opens the Full App Tab to the Diagnostics section, preserving operationId in the query string.

Diagnostics surfaces:

- Recent AI Transactions (AntD Table)
- Provider Attempts (AntD Timeline)
- MCP Tool Calls (AntD Descriptions)
- Prompt Cache Stats (AntD Statistic)
- Context Budget Viewer (AntD Progress)
- Memory Retrieval Viewer (AntD List)
- Failed Operations (AntD Table with error tags)
- Export Debug Bundle (AntD Button → download)
- Copy Operation ID (AntD Typography.Text copyable)
- Copy Redacted Trace (AntD Button)

## §5 — WXT, MV3, Ant Design, and Isolation

### §5.1 Canonical WXT Entry Points

```
src/entrypoints/background.ts
src/entrypoints/sidepanel/index.html
src/entrypoints/sidepanel/main.tsx
src/entrypoints/app/index.html            # NEW in v0.1 — Full App Tab
src/entrypoints/app/main.tsx              # NEW in v0.1
src/entrypoints/content/core.content.ts   # extraction-only in v0.1
src/entrypoints/popup/App.tsx
```

Background owns: chrome.sidePanel.setPanelBehavior, context menus, PROXY_FETCH, cookies, alarms, router startup.

Side Panel owns: AI streaming, MCP runtime, ProviderRouter, PromptCacheManager, ContextOptimizer, MemoryEngine, AITransactionLog, IndexedDB, WorkspaceStore (side-panel instance).

Full App Tab owns: All Options screens, full-page Chat/Agent/Notes workspaces, TeamGQM full workspace, **LLM-Wiki + Filesystem Sync (§27)**, WorkspaceStore (full-app instance).

Content Scripts own: Page context extraction, SPA navigation detection, ServiceNow token/case extraction. **No UI rendering** in v0.1.

Canonical WXT background entrypoint (mandatory shape):

```ts
// src/entrypoints/background.ts
export default defineBackground({
  type: 'module',
  persistent: false,
  main() {
    BackgroundRouter.register();
    LifecycleManager.register();
    KeepAliveManager.register();
    ContextMenuHost.recreateAll();
  },
});
```

Canonical content-script entrypoint (extraction-only):

```ts
// src/entrypoints/content/core.content.ts
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  async main(ctx) {
    ctx.addEventListener(window, 'wxt:locationchange', onSpaNav);
    // v0.1: extraction only. No UI rendering, no Shadow DOM.
    await ContentScriptHost.mountExtractionOnly(ctx);
  },
});
```

Canonical Full App entry point:

```ts
// src/entrypoints/app/main.tsx
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp, theme } from 'antd';
import { AppShell } from '@/components/app/AppShell';
import { getThemeStore } from '@/core/theme/ThemeStore';
const root = createRoot(document.getElementById('root')!);
root.render(<AppShell />);
```

Complete wxt.config.ts — see **Appendix G**.

### §5.2 Background Service Worker Rules

- Register listeners synchronously at module load.
- Recreate alarms and context menus on every startup.
- Never run LLM or MCP streams in the SW.
- Use Promise.race plus AbortController for every async fetch.
- PROXY_FETCH timeout is 25 seconds unless a feature-specific timeout is lower.
- Side-panel/Full-App LLM streams continue independent of SW restart.

### §5.3 Side Panel Opening

- Use `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` in LifecycleManager.onInstalled and onStartup.
- Use `chrome.sidePanel.open({ tabId })` **only inside a user gesture** — action click or contextMenus.onClicked.
- The Side Panel is global per browser window; URL-specific navigation is filtered by SidePanelPageRegistry.

### §5.4 Full App Tab Opening (NEW in v0.1)

The Full App is opened as an extension page: `chrome-extension://<extension-id>/app.html`

Opening rules:

- The Side Panel opens the Full App via `chrome.tabs.create({ url: chrome.runtime.getURL('app.html?workspaceId=' + wsId + '&conversationId=' + convId) })`.
- The command palette (Cmd+K) can open the Full App.
- Add-ons register fullAppPages and users navigate to `app.html?page=<pageId>` — no add-on may call chrome.tabs.create directly.
- The Full App reads workspaceId/conversationId/page from the URL search params on mount and hands off to WorkspaceRouter.hydrateFromURL().
- Only one Full App tab per browser window at a time — WorkspaceRouter.openFullApp() deduplicates by scanning existing tabs matching chrome.runtime.getURL('app.html') before creating a new one.

### §5.5 Ant Design Setup

NowPilot uses Ant Design v6 as its primary design system, with Ant Design X 2.x presentation components (Bubble, Sender, Conversations, ThoughtChain, etc. — §7.2, §9) for Chat/Agent surfaces. Both surfaces mount an AntdApp provider inside a ConfigProvider, and any screen using Ant Design X components additionally wraps them in XProvider (from @ant-design/x) so chat components share the same theme tokens, locale, and density as the rest of the surface.

Side Panel:

```ts
// src/entrypoints/sidepanel/main.tsx
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';
function Root() {
  const cfg = useThemeStore();
  return (
    <ConfigProvider {...getAntdConfig({ mode: cfg.mode, compact: true })}>
      <AntdApp>
        <SidePanelShell />
      </AntdApp>
    </ConfigProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
```

Full App:

```ts
// src/entrypoints/app/main.tsx
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { AppShell } from '@/components/app/AppShell';
function Root() {
  const cfg = useThemeStore();
  return (
    <ConfigProvider {...getAntdConfig({ mode: cfg.mode, compact: false })}>
      <AntdApp>
        <AppShell />
      </AntdApp>
    </ConfigProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
```

Rules:

- All imperative UI APIs (message, notification, Modal) MUST be accessed via App.useApp() — not the static message.* imports. This ensures theme + ConfigProvider context is respected.
- The Side Panel uses theme.compactAlgorithm combined with the theme mode algorithm.
- The Full App does NOT use theme.compactAlgorithm — full density.
- Dark mode is switched by re-rendering ConfigProvider with theme.darkAlgorithm. Do not manipulate CSS classes directly for AntD components.
- Full details in Appendix F.

### §5.6 Content Script Rules (extraction-only)

Content scripts in v0.1:

- MAY extract page context, DOM text, selected text, ServiceNow session cookies, and SPA navigation events.
- MAY communicate with the Side Panel, Full App, or Background via RuntimeEnvelope<T>.
- MUST NOT render React or any UI.
- MUST NOT create Shadow DOM roots for UI.
- MUST NOT inject CSS or <style> tags.
- MUST NOT modify host page DOM except non-visible read operations (e.g., cloning a node into memory for parsing).
- MUST NOT write back into host-page fields/editors (reconciliation R1 — RICH-H-04/H-07 are clipboard-only/deferred).
- MUST use MutationObserver for SPA navigation detection, never polling.

## §6 — Executive Summary & Scope

### §6.1 What NowPilot Is

NowPilot is a privacy-first, extensible Chrome extension AI assistant and **personal knowledge platform**. It provides:

- AI chat with streaming and abort
- Atomic note-taking with wikilinks and a note graph
- **LLM-Wiki knowledge layer** — auto-tagging, categorization, summaries, RAG "Ask notes", chat/page-to-note capture, and Markdown filesystem backup (§27)
- Agent workflows with tool-calling
- Prompt templates and slash commands
- A personal knowledge layer
- Layered page-content extraction (§26)
- ServiceNow support engineering integration
- **RICH conversational experience** — persona, welcome/intention discovery, clarification & follow-up, hybrid UI (§17.7)

Everything runs locally against user-configured AI providers. No data leaves the user's machine unless they explicitly configure a cloud provider.

### §6.2 Two UI Surfaces

NowPilot v0.1 exposes **two extension-owned UI surfaces**. There is no page-injected UI in v0.1.

#### Side Panel — Lightweight Daily Workflow

The Chrome Side Panel is narrow (~400 px), always available beside the active tab, and optimized for **quick, context-adjacent workflows** while the user is working in ServiceNow or another page.

The side panel contains only:

- Chat
- Agent
- Write (add-on)
- TeamGQM (add-on)
- Open Full App

Plus RICH welcome/quick-action/clarification/follow-up surfaces (§17.7) and quick "Save to note".

Do NOT put heavy admin, diagnostics, provider management, prompt management, note-graph workflows, **LLM-Wiki management, or Filesystem Sync config** in the side panel.

#### Full App Tab — Deep Work Workspace

The Full App is an extension page opened in a normal browser tab at: `chrome-extension://<extension-id>/app.html`

It is optimized for **deep work, configuration, diagnostics, and large workspace screens**. It uses AntD Layout with a Sider navigation.

The Full App contains:

- Chat (full-screen)
- Agent (full-screen, shares workspace with Chat)
- Notes (full workspace: list, editor, backlinks, graph, **+ LLM-Wiki + Filesystem Sync**)
- TeamGQM (add-on, full-page)
- Options (all configuration and diagnostics)

### §6.3 Architecture Separation

- **Core layer** — AI providers, storage, messaging, context pipeline, agent orchestration, MCP client, memory, transaction logging, workspace store, **page-content extraction (PageContentService)**, **LLM-Wiki services (NoteTagger/NoteQA/NoteChatConverter/NoteFileSync/NoteMaintenance)**, and **persona (PersonaProfile/PersonaInjector)**.
- **Add-on layer** — site-specific context extraction, skills, side-panel pages, full-app pages. ServiceNow ships as first-party add-on. Write and TeamGQM are first-party add-ons.

Core never knows about specific websites. Add-ons never bypass core APIs.

### §6.4 Design Principles

- **Privacy by default:** local providers (Ollama, LM Studio) are first-class.
- **Two surfaces, one workspace:** side panel and full app share a WorkspaceStore.
- **Extensible via add-ons:** add-ons register pages on either surface (never inject into host pages in v0.1).
- **Cost-effective by design:** every prompt goes through ContextOptimizer and the Planner → Executor → Renderer pipeline.
- **Offline-capable:** the extension works with local models only.
- **Knowledge-first (Rev. B):** the product data-flow is acquire → store → understand → display → extend; PageContentService, Notes, and LLM-Wiki are the core, not late add-ons.
- **RICH conversational UX (Rev. B):** persona-driven, intention-aware, clarifying, hybrid-UI experience on Ant Design X.

### §6.5 Scope Fences

**In scope for v0.1:**

- Side panel shell (Chat, Agent, Write, TeamGQM, Open Full App)
- Full app shell (Chat, Agent, Notes, TeamGQM, Options)
- Shared WorkspaceStore across both surfaces
- 5 provider adapters
- PageContentService (core) — layered page extraction (Defuddle → APC-lite DOM walk), feeding ContextOptimizerInput.pageContext, indexed by MiniSearch.
- Persistent memory (conversation + user + preference)
- 12 built-in MCP tools + external MCP client
- ServiceNow add-on (data extraction + side-panel/full-app UI only)
- Write add-on (side-panel primary; optional full-app page)
- TeamGQM add-on (both surfaces)
- Data export/import
- Prompt inspector and diagnostics (in Options)
- First-run onboarding
- **LLM-Wiki + one-way Filesystem Sync (§27)**
- **RICH Design R/I/C/H requirements (§17.7)**
- **Persona profile + injector (RICH-R)**

**Out of scope for v0.1 (deferred to v0.2+):**

- Page injection (Shadow DOM UI, floating widgets, CaseInsightBox, injected page enhancements, **host-page write-back for RICH-H-04/H-07 — reconciliation R1**)
- PDF chat
- Global internet-search page (replaced by ResearchSkill global add-on)
- Embedding-based search remains deferred — bag-of-words + MiniSearch is sufficient, and now also powers page-content retrieval (§26.5)
- Snippet/template productivity suite
- Bidirectional filesystem sync (§27.9)
- TTS output (RICH-H-17 input only)
- A2UI (@ant-design/x-card, §25.6)

See §25 for the future page-injection reintroduction plan.

## §7 — Technology Stack

### §7.1 Extension Framework

| Package | Version | Purpose |
|---|---|---|
| wxt | ^0.19 | MV3 scaffold, HMR, manifest generation |
| @wxt-dev/module-react | ^0.3 | React integration |

### §7.2 UI

| Package | Version | Purpose |
|---|---|---|
| react / react-dom | ^19 | UI framework |
| antd | ^6 | Ant Design v6 — primary component library |
| @ant-design/icons | ^6 | Ant Design icon set (must match antd major version) |
| @ant-design/x | ^2 | Ant Design X — AI chat presentation components (Bubble, Sender, Conversations, Prompts, Welcome, Attachments, Suggestion, Actions, ThoughtChain, Think, FileCard, Sources, Folder) — RICH building blocks |
| @ant-design/x-markdown | ^2 | Streaming-aware Markdown renderer with built-in LaTeX, mermaid, and code-highlight plugins. Replaces react-markdown/remark-gfm/rehype-highlight/highlight.js/katex. |
| motion | ^12 | Framer Motion v12; import from motion/react. **Do not install framer-motion.** |

**Explicitly removed from v0.1:** tailwindcss, @tailwindcss/vite, shadcn/ui, @radix-ui/react-*, class-variance-authority, clsx, tailwind-merge, react-markdown, remark-gfm, rehype-highlight, highlight.js, katex (superseded by @ant-design/x-markdown).

**Explicitly not adopted in v0.1 (see §0.2, §23, §25.6):** @ant-design/x-sdk, @ant-design/x-card.

### §7.3 State

| Package | Version | Purpose |
|---|---|---|
| zustand | ^5 | Global stores (workspace, theme, chat) |
| immer | ^10 | Immutable updates |

### §7.4 AI & Workflow

| Package | Version | Purpose |
|---|---|---|
| ai | ^4 | Vercel AI SDK: streamText, tool calling, abort |
| @ai-sdk/openai | ^1 | OpenAI + Ollama + OpenAI-compatible endpoints |
| @ai-sdk/anthropic | ^1 | Anthropic Claude |
| @ai-sdk/google | ^1 | Google Gemini |
| @modelcontextprotocol/sdk | ^1 | MCP client — StreamableHTTP transport |
| zod | ^3 | Boundary validation |
| zod-to-json-schema | ^3 | Zod → JSON Schema for tool definitions |

### §7.5 Storage

| Package | Version | Purpose |
|---|---|---|
| idb | ^8 | Typed IndexedDB wrapper |
| **yaml** (Rev. B) | ^2 | YAML frontmatter parse/serialize for LLM-Wiki .md files (§27) |

### §7.6 Extraction & Text

| Package | Version | Purpose |
|---|---|---|
| defuddle | ^0.6 | Primary main-content extraction → clean Markdown (Readability successor; preserves footnotes/math/code, richer metadata) |
| @mozilla/readability | ^0.5 | Fallback article extraction when Defuddle yields low-confidence output |
| turndown | ^7 | HTML → Markdown (used by APC-lite path / non-Defuddle output) |
| dompurify | ^3 | XSS sanitisation for AI/tool output |

**Rationale:** Defuddle is a drop-in Readability replacement built for exactly this job (see §23 ADR). MIT-licensed.

### §7.7 Search & Data

| Package | Version | Purpose |
|---|---|---|
| minisearch | ^7 | Local full-text search (notes index + ephemeral page index) |
| d3-force | ^3 | Note graph layout (Full App) |
| fflate | ^0.8 | ZIP export |
| papaparse | ^5 | CSV parsing |

### §7.8 Security & Testing & DX

| Item | Purpose |
|---|---|
| crypto.subtle (native) | AES-GCM encryption |
| crypto.randomUUID() (native) | ID generation |
| vitest, @testing-library/react, jsdom, msw | Testing |
| typescript ≥5.5, strict: true | Type safety |
| eslint, prettier | Linting / formatting |
| **@types/wicg-file-system-access** (Rev. B, dev) | TypeScript types for File System Access API (§27) |

## §8 — Architecture Design

### §8.1 Extension Contexts

```
Chrome Browser
├── Background Service Worker (background.ts)                 [ephemeral]
│   ├── BackgroundRouter          typed chrome.runtime.onMessage dispatcher
│   ├── LifecycleManager          onInstalled, onStartup
│   ├── KeepAliveManager          chrome.alarms + panel ping
│   ├── ContextMenuHost           chrome.contextMenus registration
│   ├── CookieSessionStore        generic chrome.cookies + storage.session
│   ├── CORSProxy                 PROXY_FETCH (§10.7)
│   └── WorkspaceRouter           opens Full App tab, dedupes existing tabs
│
├── Side Panel (sidepanel/main.tsx)                           [persistent while open]
│   ├── AntD ConfigProvider (compact) + AntdApp
│   ├── SidePanelShell / SidePanelRouter
│   ├── ProviderRegistry / ProviderRouter / TierResolver
│   ├── AgentOrchestrator + Planner/Executor/Renderer (+ PersonaInjector)
│   ├── MCPClient + MCPRegistry + NowPilotMainServer (12 tools)
│   ├── ContextOptimizer + ContextCompressor
│   ├── MemoryEngine + Conversation/User/PreferenceMemoryStore
│   ├── AITransactionLog + AITransactionLogDB + TraceRedactor
│   ├── StorageLayer (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, WriteJournal)
│   ├── WorkspaceStore (Zustand) + WorkspaceSync (BroadcastBus)
│   ├── MessageBus (cross-context), EventBus (in-panel), BroadcastBus (cross-surface)
│   └── UI: Chat / Agent / Write (add-on) / TeamGQM (add-on) / Open Full App + RICH surfaces
│
├── Full App Tab (app/main.tsx)                               [persistent tab]
│   ├── AntD ConfigProvider (default density) + AntdApp
│   ├── AppShell + FullAppRouter (AntD Layout w/ Sider)
│   ├── Same core services as Side Panel (single-writer coordination via WorkspaceStore)
│   ├── LLM-Wiki services (NoteTagger/NoteQA/NoteChatConverter/NoteFileSync/NoteMaintenance)
│   └── UI: Chat / Agent / Notes (+LLM-Wiki) / TeamGQM / Options
│
├── Content Scripts (extraction-only)
│   ├── ContentScriptHost         message bridge only, no UI mount
│   ├── SPANavigationWatcher      MutationObserver
│   ├── PageContextBridge         extracted context → side panel / full app
│   ├── ISOLATED world by default
│   └── MAIN world only for domain-specific globals (e.g. window.g_ck)
│
└── Add-ons
    ├── Site-specific  (urlPatterns match)
    └── Global         (all pages)
```

### §8.2 Core vs Add-on Boundary

Core owns:

- AI runtime, MCP, messaging, context, storage, migrations, WriteJournal
- Chrome API hosts (CORSProxy, ContextMenuHost, TabManager)
- Generic session infrastructure (CookieSessionStore)
- Shared UI (ErrorBoundary, PortableMarkdown)
- Prompt/template/slash engines
- Telemetry, redaction
- Registries (AddonRegistry, EndpointRegistry, KeymapRegistry, SidePanelPageRegistry, FullAppPageRegistry)
- **WorkspaceStore** and cross-surface coordination
- Content-script message bridge (extraction-only)
- PageContentService + extraction strategies (DefuddleStrategy, ApcLiteStrategy) + PageIndexBuilder (MiniSearch over extracted content)
- **LLM-Wiki services (§27): NoteTagger, NoteQA, NoteChatConverter, NoteFileSync, NoteMaintenance**
- **Persona services (§17.7): PersonaProfile, PersonaInjector**
- **IntentClassifier (RICH-I-08)**

Add-ons own:

- Site-specific context extraction
- Side-panel pages
- Full-app pages
- Site-specific skills, prompts, endpoints, session semantics
- Add-on settings, keymaps

Rules:

- Core MUST NOT import from src/addons/**.
- Add-ons MUST NOT bypass Core registries or WorkspaceStore.
- Add-ons MUST NOT render UI into host pages in v0.1.
- ServiceNow-specific selectors/token names live **only** in src/addons/servicenow/**.

### §8.3 Two UI Surfaces — Comparison

| Aspect | Side Panel | Full App Tab |
|---|---|---|
| Width | ~400 px (Chrome default) | Full browser viewport |
| Density | AntD **compact** algorithm | AntD default density |
| Purpose | Fast, context-adjacent workflows | Deep work, config, diagnostics |
| Pages | Chat, Agent, Write, TeamGQM, Open Full App | Chat, Agent, Notes (+LLM-Wiki), TeamGQM, Options |
| Persistence | Persistent while open | Persistent tab |
| Opened by | Chrome action button, keyboard shortcut, context menu | "Open Full App" action, command palette, options link |
| Notes management | ❌ (view/quick-save only) | ✅ full workspace + LLM-Wiki + Filesystem Sync |
| Options | ❌ | ✅ |
| Diagnostics | Toast + "Open Diagnostics" link only | ✅ full DiagnosticsPanel |
| Prompt management | ❌ (execute only) | ✅ edit/create/delete |
| Provider config | ❌ | ✅ |

### §8.4 Shared Workspace Model

Both surfaces read/write a shared WorkspaceStore (Zustand) that tracks:

- workspaceId
- conversationId
- activeProvider
- selectedModel
- pinnedTabs
- currentPageContext
- selectedNotes
- activeAddonContext
- activeSkillRun
- activeSurface: 'sidepanel' | 'full-app'
- openedFullAppTabId?: number

Persistence:

- Workspace metadata → chrome.storage.local.np_workspace
- Cross-surface sync → BroadcastBus (see §13, §20)
- Only one surface may be the **primary writer** at a time; election via BroadcastBus

Handoff URL format for Open Full App: `chrome-extension://<id>/app.html?workspaceId=<uuid>&conversationId=<uuid>&page=<pageId>`

Full details in Appendix M.

### §8.5 File Structure

```
nowpilot/
├── wxt.config.ts                            # Appendix G
├── src/
│   ├── entrypoints/
│   │   ├── background.ts
│   │   ├── sidepanel/{index.html, main.tsx}
│   │   ├── app/{index.html, main.tsx}                # Full App Tab
│   │   ├── content/core.content.ts                    # extraction-only
│   │   └── popup/App.tsx
│   │
│   ├── core/
│   │   ├── ai/**  (as v0.1c)
│   │   │   └── persona/{PersonaProfile, PersonaInjector}.ts     # NEW (Rev. B, RICH-R)
│   │   ├── mcp/{MCPClient, MCPRegistry, mcpToVercelAI, NowPilotMainServer}.ts
│   │   ├── context/**
│   │   ├── memory/**
│   │   ├── telemetry/**
│   │   ├── storage/**  (+ migrations/ … v4: notes_backup_config)   # UPDATED (Rev. B)
│   │   ├── security/{KeyVault, redactSensitive}.ts
│   │   ├── runtime/{RuntimeEnvelope, OperationId, BroadcastBus, PortReader, workerState}.ts
│   │   ├── messaging/MessageBus.ts
│   │   ├── events/EventBus.ts
│   │   ├── workspace/{WorkspaceStore, WorkspaceRouter, WorkspaceSync}.ts     # NEW
│   │   ├── theme/{ThemeStore, antdConfig}.ts                                  # NEW
│   │   ├── content/{ContentScriptHost, SPANavigationWatcher, PageContextBridge, AxDomWalker}.ts
│   │   ├── chrome/{CookieSessionStore, CORSProxy, ContextMenuHost, TabManager, NotificationsManager, ClipboardHelper, Scheduler}.ts
│   │   ├── prompts/**
│   │   ├── slash/SlashCommandRegistry.ts
│   │   ├── search/MiniSearchIndex.ts
│   │   ├── intent/IntentClassifier.ts                                         # NEW (Rev. B, RICH-I-08)
│   │   ├── notes/
│   │   │   ├── LinkParser.ts, NoteGraph.ts                                    # Phase 5 (atomic notes + wikilinks)
│   │   │   ├── NoteTagger.ts                                                  # NEW (§27)
│   │   │   ├── NoteQA.ts                                                      # NEW (§27)
│   │   │   ├── NoteChatConverter.ts                                           # NEW (§27)
│   │   │   ├── NoteFileSync.ts                                                # NEW (§27)
│   │   │   └── NoteMaintenance.ts                                             # NEW (§27)
│   │   ├── extraction/
│   │   │   ├── PageContentService.ts
│   │   │   ├── apcLite.types.ts
│   │   │   ├── strategies/{IExtractionStrategy, DefuddleStrategy, ApcLiteStrategy}.ts
│   │   │   ├── PageContentSerializer.ts
│   │   │   ├── PageIndexBuilder.ts
│   │   │   └── PageContentCache.ts
│   │   ├── output/**
│   │   ├── webhooks/WebhookManager.ts
│   │   ├── data/DataPortability.ts
│   │   ├── insights/InsightEngine.ts
│   │   ├── http/Requester.ts
│   │   ├── registry/{AddonRegistry, Registry, AddonSettingsStore, SidePanelPageRegistry, FullAppPageRegistry}.ts
│   │   ├── input/KeymapRegistry.ts
│   │   ├── speech/SpeechSynthesisService.ts
│   │   ├── utils/RateLimiter.ts
│   │   ├── config/{endpoints, EndpointRegistry, FeatureFlags, localModelCapabilities}.ts
│   │   ├── log/debugLog.ts
│   │   ├── i18n/strings.ts
│   │   └── components/{ErrorBoundary.tsx, PortableMarkdown.tsx}
│   │
│   ├── addons/
│   │   ├── global/{SelectionContextMenu, ResearchSkill}.ts
│   │   ├── write/                                     # first-party add-on
│   │   ├── teamgqm/                                   # first-party add-on
│   │   └── servicenow/  (no injected UI in v0.1)
│   │
│   ├── components/
│   │   ├── sidepanel/{SidePanelShell, SidePanelRouter}.tsx
│   │   ├── app/{AppShell, FullAppRouter}.tsx
│   │   ├── pages/{ChatPage, AgentPage, NotesPage, OptionsPage}.tsx
│   │   ├── options/{Providers, Models, MCP, Prompts, Slash, Diagnostics, Memory, ImportExport, FeatureFlags, AddonSettings, Persona, Notes}Section.tsx   # +Persona +Notes (Rev. B)
│   │   ├── notes/{BacklinksPanel, WikilinkAutocomplete, NoteGraphView, NotePreview, SaveToNoteDialog}.tsx    # +SaveToNoteDialog (Rev. B)
│   │   ├── rich/{WelcomeCards, QuickActionChips, ClarificationChips, FollowUpChips, PersonaHeader, StageIndicator, ClosureZone, ContextPane, TemplateCatalog, CodeBlockActions, StepCards}.tsx   # NEW (Rev. B, §17.7)
│   │   ├── patterns/{ChatMessage, HistoryListItem, ToolCard, SkillMessageRenderer, SourceCard}.tsx
│   │   └── OnboardingModal.tsx
│   │
│   ├── hooks/{useChat, useStreamingLLM, useProviderRouter, useMemory, useDiagnostics, useConversations, useAddonContext, useWorkspace, useTheme, usePersona, useRichSuggestions}.ts   # +usePersona +useRichSuggestions (Rev. B)
│   └── types/{messages, storage, errors, addon, workspace, notes, persona}.ts   # +notes +persona (Rev. B)
│
└── tests/  (see §24)
```

## §9 — Feature Specification

### §9.1 Side Panel Features

| Feature | Priority | Notes |
|---|---|---|
| Chat | P0 | Streaming, abort, slash commands, quick context |
| Agent | P0 | AgentOrchestrator with tier caps + permission prompts |
| Write add-on page | P0 | Draft/rewrite/summarize/customer-update workflows |
| TeamGQM add-on page | P0 | Quick TeamGQM summary/actions |
| Open Full App action | P0 | Opens app.html with workspace handoff (Flow 11) |
| Provider/model selector | P0 | Read-only in side panel — edit lives in Options |
| Quick save to note | P1 | "Save this response as note" quick action (lightweight, non-LLM) |
| Slash commands | P1 | /write, /ask, /research, etc. |
| Tab pinning | P1 | Max 10 pinned |
| Selection → Ask AI | P1 | Right-click context menu → opens side panel with selection prefilled |
| Theme toggle | P1 | light/dark/auto |
| Cmd+K palette | P1 | Includes "Open Full App" |
| Error toast + "Open Diagnostics" link | P1 | Diagnostics lives in Full App → Options |

**RICH additions (Rev. B, §17.7):** Persona header (RICH-H-01), Welcome cards (RICH-I-01), Context-aware quick-action chips (RICH-I-05/06), Clarification chips (RICH-C-01), Follow-up chips (RICH-C-05), Streaming stage indicators (RICH-H-08).

The side panel intentionally does NOT include: Notes editor, DiagnosticsPanel, PromptManager, ProvidersEditor, MCP servers editor, Feature flag editor, Import/Export, **LLM-Wiki management, Filesystem Sync config**.

### §9.2 Full App Features

| Feature | Priority | Notes |
|---|---|---|
| Chat (full-screen) | P0 | Shares WorkspaceStore + conversation with side panel |
| Agent (full-screen) | P0 | Shares WorkspaceStore + conversation with Chat |
| Notes | P0 | List, editor, wikilinks, backlinks, graph, search, **+ LLM-Wiki + Filesystem Sync (§27)** |
| TeamGQM add-on (full-page) | P0 | Full workspace for TeamGQM add-on |
| Options | P0 | See §9.3 |
| First-run onboarding entry point | P0 | If user opens Full App without provider configured (+ RICH-R-03 persona card) |
| Cmd+K palette | P1 | Same command set as side panel + Full-App-only commands |
| Command "Focus Side Panel" | P1 | Programmatically opens side panel for current tab |

### §9.3 Options Page

Options is a Full App page with the following sections, each accessible via a left-side Menu inside a Layout:

| Section | Purpose |
|---|---|
| Providers | Add/edit/delete provider configs, test connections, priority order |
| Models | Per-provider model list + context window override |
| MCP Servers | Add/enable/disable external MCP servers, view permissions |
| Prompt Templates | Create/edit/delete prompt templates + {{variable}} editor |
| Slash Commands | Manage slash command → template mapping |
| Memory | View/edit user memory facts; enable/disable memory |
| Diagnostics | DiagnosticsPanel, transaction traces, export debug bundle |
| Import / Export | Sanitised JSON/ZIP export; import merge; **Restore from folder (§27)** |
| Feature Flags | Toggle P2 features (webhooks, insights, TTS) |
| Add-on Settings | Namespaced settings per registered add-on |
| **Persona** (Rev. B) | Edit AI name, tone, brevity (RICH-R-04) |
| **Notes** (Rev. B) | LLM feature toggles, backup folder config, bulk maintenance (§27) |
| About | Version, license, links |

### §9.4 Add-on Contract

Add-ons register with the AddonRegistry at side-panel or full-app startup. They may declare:

```ts
export interface Addon {
  id: string;
  name: string;
  scope: 'site' | 'global';
  urlPatterns?: string[];              // required when scope === 'site'
  contextExtractor?: IContextExtractor;
  skills?: ISkill[];
  prompts?: PromptTemplate[];
  sidePanelPages?: SidePanelPageRegistration[];
  fullAppPages?: FullAppPageRegistration[];
  addonSettings?: z.ZodSchema<unknown>;
  keymap?: KeymapRegistration[];
}
```

**Key change from v0.1c:** the contentScript UI mount interface (IContentAddon) is removed. Add-ons no longer render UI into host pages. Content-script logic for **extraction** still exists via contextExtractor and generic PageContextBridge.

Rules:

- Each add-on MUST declare a Zod addonSettings schema (may be z.object({})).
- Full-App pages MUST live under src/addons/<id>/pages/FullApp*.tsx.
- Side-Panel pages MUST live under src/addons/<id>/pages/SidePanel*.tsx.
- Add-ons MUST NOT import from src/components/pages/** or from other add-ons.

### §9.5 Write Add-on

**Location:** src/addons/write/ · **Scope:** global

**Side Panel Page:** SidePanelWritePage — quick actions: Rewrite professionally · Summarize · Draft customer update · Draft internal note · Explain technical issue · Create action plan · Generate concise status update.

**Skills:** DraftSkill, RewriteSkill, SummarizeSkill, CustomerUpdateSkill.

**Full App Page:** Not required in v0.1 (side-panel-only). If added later, it must live in src/addons/write/pages/FullAppWritePage.tsx.

**Input source:** current clipboard, selected text (via SelectionContextMenu), pinned tab context, or free-form text area.

**Output:** streamed markdown; user actions include "Copy", "Insert into chat", "Save as note".

### §9.6 TeamGQM Add-on

**Location:** src/addons/teamgqm/ · **Scope:** global (v0.1)

**Side Panel Page:** SidePanelTeamGQMPage — compact quick view: Latest TeamGQM digest · Quick action buttons · Link to full page.

**Full App Page:** FullAppTeamGQMPage — full workspace: History · Reports · Detailed views · Shared workspace context (same conversationId as Chat/Agent).

**Skills:** TeamGQMSummarySkill — implementation-specific; this spec defines only the integration shell.

**Add-on Settings:** implementation-specific; must validate with a Zod schema.

### §9.7 ServiceNow Add-on

**Location:** src/addons/servicenow/ · **Scope:** site — urlPatterns: `['*://*.service-now.com/*', '*://support.servicenow.com/*']`

| Feature | Priority | Notes |
|---|---|---|
| JSESSIONID extraction | P0 | Via CookieSessionStore + ServiceNowSessionAdapter |
| sysparmCK extraction | P0 | MAIN-world content script → adapter → CookieSessionStore |
| Case context extraction | P0 | IContextExtractor implementation, extraction-only |
| Table API client | P0 | SNowTableClient uses PROXY_FETCH + RateLimiter |
| CaseAnalyzerSkill | P0 | AI analysis of case details |
| CatchUpSkill | P0 | 24 h activity digest |
| SentimentSkill | P1 | Case communication sentiment |
| CodeSearchSkill | P1 | Map-reduce over scripts; needs ≥ 16K context (§14.4) |
| Side-panel page | P0 | Quick case-context view + skill launcher |
| Full-app page | P1 | Detailed case workspace (case table, comments, work notes, skill results) |

**Removed from v0.1c → v0.1:** CaseInsightBox (page-injected UI), serviceNowInjection.ts (Shadow DOM mount), scoped page UI enhancements. ServiceNow value is delivered inside the side panel and Full App only.

### §9.8 Research Global Tool

- Lives at src/addons/global/ResearchSkill.ts.
- inputSchema: `{ query: string; maxSources?: number }`.
- Uses in priority order: user-connected MCP web-search server via MCPClient; a built-in web-search MCP tool if configured; graceful failure otherwise — never silently fall back to model-only answers.
- outputSchema: `{ answer: string; sources: Array<{ title: string; url: string; snippet: string }> }`.
- Subject to PermissionGate and RateLimiter.
- Surfaced through /research slash command in both surfaces.

## §10 — AI & MCP Integration

### §10.1 Provider Interface

```ts
// src/core/ai/ILLMProvider.ts
import type { LanguageModel } from 'ai';
export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openai-compatible';
export interface ILLMProvider {
  id: ProviderId;
  name: string;
  chat(messages: LLMMessage[], options: LLMOptions): AsyncIterable<LLMStreamChunk>;
  getModels(): Promise<ModelInfo[]>;
  validateConfig(config: ProviderConfig): Promise<boolean>;
  getAISDKModel(model: string): LanguageModel;
}
```

Types LLMMessage, LLMOptions, LLMStreamChunk, ModelInfo, ProviderConfig are defined in Appendix C.

### §10.2 Five Provider Implementations

| Provider ID | Adapter | Default baseURL | Supports tools |
|---|---|---|---|
| openai | @ai-sdk/openai createOpenAI | https://api.openai.com/v1 | Yes |
| anthropic | @ai-sdk/anthropic createAnthropic | https://api.anthropic.com | Yes |
| gemini | @ai-sdk/google createGoogleGenerativeAI | Google Cloud | Yes |
| ollama | @ai-sdk/openai createOpenAI | http://localhost:11434/v1 | Model-dependent |
| openai-compatible | @ai-sdk/openai createOpenAI | user-supplied | Model-dependent |

Ollama: pass apiKey: 'ollama'. Default context is 2048 tokens — warn the user (Flow 5). ProviderRegistry computes resolvedBaseURL = customBaseURL ?? baseURL once at construction.

### §10.3 Provider Config Schema

```ts
export const ProviderConfigSchema = z.object({
  id: z.enum(['openai','anthropic','gemini','ollama','openai-compatible']),
  label: z.string().trim().min(1).max(50),
  apiKey: z.string().optional(),
  baseURL: z.string().url(),
  customBaseURL: z.string().url().optional(),
  models: z.array(z.string().min(1)).min(1).max(10)
           .refine(a => new Set(a).size === a.length, 'models must be unique'),
  contextWindow: z.number().int().min(1024).max(2_000_000),
  supportsTools: z.boolean(),
  enabled: z.boolean(),
  priority: z.number().int().min(0),
  lastValidated: z.number().int().optional(),
});
```

### §10.4 MCP Client

- Lives in the side panel and Full App. Never in the background service worker.
- Uses @modelcontextprotocol/sdk Client + StreamableHTTPClientTransport.
- Never hand-roll SSE parsing.
- First-time tool call triggers a permission dialog (Flow 2). Allow/deny persisted in np_mcp_permissions.
- Dangerous tools always prompt regardless of allow list.

### §10.5 NowPilotMainServer — 12 Built-in Tools

| # | Tool name | Input | dangerous | Effect |
|---|---|---|---|---|
| 1 | get-page-content | { tabId?: number } | no | Active/pinned tab context via PageContentService (core, layered: Defuddle → APC-lite → ServiceNow API) |
| 2 | search-notes | { query: string; limit?: number } | no | MiniSearch over notes (title + content + tags + summary — Rev. B) |
| 3 | create-note | { title: string; content: string; tags?: string[] } | yes | Writes to NotesDB (triggers NoteTagger + NoteFileSync save pipeline — Rev. B) |
| 4 | get-chat-history | { sessionId?: string; limit?: number } | no | Recent messages |
| 5 | pin-tab | { tabId: number } | no | Pins as context (max 10) |
| 6 | read-clipboard | {} | no | Reads clipboard |
| 7 | write-clipboard | { text: string } | yes | Writes clipboard |
| 8 | get-provider-info | {} | no | Active provider + model + limits |
| 9 | run-skill | { skillId: string; input: unknown } | yes | Runs a registered skill |
| 10 | list-skills | {} | no | Lists registered skills |
| 11 | export-data | { scopes: string[] } | yes | Export bundle (no API keys) |
| 12 | execute-webhook | { event: string; payload: unknown } | yes | Fires a webhook |

### §10.6 endpoints.ts

```ts
// src/core/config/endpoints.ts
export const ENDPOINTS = {
  openai:    'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini:    'https://generativelanguage.googleapis.com',
  ollama:    'http://localhost:11434/v1',
} as const;
```

User overrides live in chrome.storage.local.np_endpoint_overrides and are merged at load.

### §10.7 CORSProxy — Generic Cross-Origin Fetch

Runs in the background service worker. Message name is generic: PROXY_FETCH.

```ts
export interface ProxyFetchRequest {
  type: 'PROXY_FETCH';
  addonId: string;
  url: string;
  method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE';
  headers?: Record<string,string>;
  body?: string;
  credentials?: 'include' | 'omit';
}
export interface ProxyFetchResponse {
  ok: boolean; status: number; body: string; error?: string;
}
```

Rules:

- BackgroundRouter validates sender.id === chrome.runtime.id.
- The SW checks url host against declared host_permissions; unknown host → HOST_NOT_PERMITTED.
- Wrapped in a 25 s Promise.race timeout.
- Per-add-on RateLimiter keyed by addonId.
- Never logs request or response bodies.

## §11 — Critical User Flows

### Flow 1 — Send a Chat Message

Applies to Side Panel Chat and Full App Chat.

- useChat runs slash-check.
- Assemble context via ContextOptimizer (sourced from WorkspaceStore).
- Call AgentOrchestrator.runTurn(input, ctx).
- Stream through ChunkBuffer → render via PortableMarkdown.
- On stream end append to ChatHistoryDB. First message → Flow 1a.
- On provider error: AntD notification.error with Retry / Open Settings.

### Flow 1a — Title Generation

PROMPTS.titleGen, temperature: 0, maxTokens: 16, 3 s timeout. Never blocks save on titling.

### Flow 2 — Tool Call Permission

AntD Modal.confirm with Allow once / Allow always. Dangerous tools always prompt regardless.

### Flow 3 — Save a Note (Full App Notes only)

LinkParser.parseLinks → resolveLinks → NotesDB.put → EventBus.emit('note:saved'). **Rev. B:** the save pipeline additionally runs NoteTagger.analyze() (non-blocking), MEM-02 memory upsert (primary surface only), and NoteFileSync.sync() (see §27, Flow 12).

### Flow 4 — Tab Pinning

chrome.scripting.executeScript + 5 s timeout → WorkspaceStore.pinTab. Max 10.

### Flow 5 — Local Model Context Warning

In Options → Providers, if Ollama reports ≤ 4096 tokens → AntD Alert + "Copy Modelfile" button.

### Flow 6 — Data Export

In Options → Import / Export. AntD Modal with Checkbox.Group, sanitise, serialise, download.

### Flow 7 — Webhook Fire

WebhookManager.fire → POST → retry queue (30 s / 5 min / 30 min) → log in AITransactionLog.

### Flow 8 — Keyboard Shortcut

KeymapRegistry global keydown listener → handler → preventDefault.

### Flow 9 — First-Run Onboarding

OnboardingModal over disabled surface. 4 steps: **Step 1 "Meet NowPilot" persona card (RICH-R-03)** → pick provider → enter key → validate.

### Flow 10 — Command Palette (Cmd+K)

AntD Modal with Input + filtered list. Commands include Open Full App, Focus Side Panel, Open Options, etc.

### Flow 11 — Open Full App (Workspace Handoff)

- Read current WorkspaceState.
- WorkspaceRouter.openFullApp: persist workspace via BroadcastBus flush; query existing app tabs; update or create.
- Full App boots → WorkspaceStore.hydrateFromURL().
- Full App fires WORKSPACE_HANDOFF via BroadcastBus.
- Side panel demotes to read-only mirror until refocused.

### Flow 12 — Save to Note (LLM-Wiki) — NEW (Rev. B)

- User clicks "Save to note" on an assistant message (ChatMessage three-dot menu or first-class button, RICH-H-06).
- SaveToNoteDialog opens.
- NoteChatConverter.convert(messages, memoryContext) drafts title, content (markdown), tags, wikilinks, categoryPath (haiku tier + MemoryEngine.assemble(), MEM-03).
- Dialog shows a pre-filled NoteEditor + NotePreview. **User is always the gatekeeper.**
- User edits → save → NotesDB.createNote() → save pipeline: NoteTagger merge + MEM-02 upsert (primary surface) + NoteFileSync.sync().

### Flow 13 — Ask Your Notes (RAG) — NEW (Rev. B)

- User types a question in the Notes "Ask notes" bar (LLM-WIKI-06).
- NoteQA.ask(query): MiniSearch top-5 snippets + MemoryEngine relevant facts (MEM-01).
- Flash-tier synthesis with per-statement citations.
- Rendered as an ephemeral @ant-design/x Bubble with clickable citation Tags that navigate to the source note.
- Tiny mode: falls back to plain MiniSearch results, no LLM synthesis (§2.5).

### Flow 14 — Set/Change Backup Folder — NEW (Rev. B)

- Options → Notes → "Set backup folder" (SYNC-01).
- showDirectoryPicker() (**Full App only**) → FileSystemDirectoryHandle persisted in notes_backup_config IndexedDB store.
- Status Tag turns green "Backup: On".

### Flow 15 — Restore from Folder — NEW (Rev. B)

- Options → Import/Export → "Restore from folder" (SYNC-09).
- showDirectoryPicker() → walk tree → parse .md YAML frontmatter.
- Preview modal: "Found N notes (X new, Y updated, Z unchanged)" (SYNC-10).
- User confirms → additive upsert into IndexedDB (never deletes local notes not in folder).

### Flow 16 — RICH Clarification & Follow-up — NEW (Rev. B)

- Ambiguous intent → Planner returns ask_clarification → focused question + 2–4 option chips in the Bubble (RICH-C-01/04); chips inject into Sender; max 2 rounds then best-effort with caveat (RICH-C-03).
- After a response, 1–3 follow-up chips are generated by a non-blocking haiku suggestion call (RICH-C-05/08); tapping sends as the next message; degrades to none on timeout.

## §12 — Component State Matrix

Every page must render these states with these exact strings (from STR in Appendix B).

| Component | Surface | Loading | Empty | Error | Success |
|---|---|---|---|---|---|
| ChatPage | Side Panel + Full App | "Connecting to provider..." | "Start a conversation" | "Provider error. [Retry] [Switch Provider]" | Message stream visible |
| AgentPage | Side Panel + Full App | "Preparing agent..." | "Describe a task and the agent will plan steps" | "Agent error: [message]. [Retry]" | Step progress visible |
| WritePage | Side Panel | "Preparing..." | "Choose an action or paste text" | "Write skill failed: [message]. [Retry]" | Streamed output visible |
| TeamGQMPage (side panel) | Side Panel | "Loading..." | "No TeamGQM context available" | "Failed to load. [Retry]" | Summary + actions |
| NotesPage | Full App | "Loading notes..." | "No notes yet. Press + to create one." | "Failed to load notes. [Retry]" | Note list |
| NoteEditor | Full App | "Loading note..." | — | "Failed to save note. [Retry]" | Editor visible |
| NoteGraph | Full App | "Building graph..." | "Create at least 3 notes to see the graph" | "Failed to render graph. [Retry]" | Graph visible |
| OptionsPage | Full App | "Loading settings..." | — | "Failed to load settings" | Section content visible |
| DiagnosticsPanel | Full App → Options | "Loading diagnostics..." | "No AI transactions yet." | "Failed to load traces" | Transaction list |
| Research | Both | "Researching..." | "Enter a research question" | "Research failed: no web-search tool connected. [Open Settings]" | Answer + SourceCards |
| ChatHistoryDB load | Both | Skeleton shimmer | "No conversations yet" | "Failed to load history" | Conversation list |
| MCP tool call | Both | "Calling [toolName]..." | — | "Tool failed: [error]. [Retry tool]" | Tool result card |
| Tab pin | Side Panel | "Extracting page content..." | — | "Cannot pin this page. Try a regular web page." | Page title + remove |
| Provider validation | Full App → Options | "Testing connection..." | — | "Connection failed: [error]" | "Connected" |
| Onboarding | Both | "Testing connection..." | — | "Connection failed: [error]" | "Connected" → focus composer |
| Open Full App | Side Panel button | "Opening full app..." | — | "Failed to open Full App tab" | New tab focused |
| **Ask Notes (RAG)** (Rev. B) | Full App | "Searching your notes..." | "Ask a question about your notes" | "Couldn't answer from notes. [Retry]" | Bubble answer + citations |
| **Backup status** (Rev. B) | Full App | "Checking backup folder..." | "Backup: Off [Configure]" | "Backup: Error (tooltip)" | "Backup: On" (green) |
| **Restore from folder** (Rev. B) | Full App | "Reading backup folder..." | "No .md notes found" | "Failed to read folder. [Retry]" | Preview modal |
| **Welcome cards** (Rev. B) | Both | — | 4–6 capability cards | — | Card populates Sender |
| **Clarification chips** (Rev. B) | Both | — | — | — | Question + option chips |

## §13 — Concurrency and Race-Condition Rules

- **One stream per session.** useStreamingLLM aborts the active stream before starting a new one.
- **IndexedDB writes are transactions.** Use a single idb transaction for stores that must stay consistent.
- **Background SW fetch wrapped in 25 s Promise.race**, returning { error: 'TIMEOUT' }.
- **Tab context timeout 5 s.** executeScript + round-trip must finish in 5 s or cancel.
- **Abort propagation.** One AbortController signal threaded through AgentOrchestrator, PlannerService, ExecutorService, RendererService, and every fetch().
- **Settings writes serialized.** Never write two Setting<T> keys concurrently; await sequentially.
- **Memory writes single-writer.** MemoryEngine writes only from the primary surface. Cross-surface coordination via BroadcastBus primary election with version check.
- **EventBus handlers are synchronous.** Handlers may spawn internal Promises but must never let errors escape.
- **RateLimiter is per-instance.** Each add-on owns its limiter; never shared.
- **hasStreamedFirstToken per operation.** Once true, ProviderRouter must never switch provider.
- **Cross-surface workspace coordination.** Both side panel and Full App may load simultaneously. BroadcastBus elects a primary writer: election key np_workspace_primary in chrome.storage.session; on startup each surface writes { tabId, surface, electedAt } with compare-and-set; only the primary writes memory/notes/chat-history bodies; secondary surfaces mirror; if primary tab closes → next surface auto-promotes on next heartbeat (max 3 s latency).

**New in Rev. B:**

- **NoteFileSync is fire-and-forget with a 50 ms debounce** after the IndexedDB write; never blocks the save UI (§27 SYNC-03).
- **MEM-02 memory upsert from notes runs only on the primary surface** (same single-writer rule as all memory writes).
- **NoteTagger LLM call is non-blocking**; the note is saved to IndexedDB first, suggestions arrive after.
- **RICH follow-up/clarification suggestion calls are non-blocking** and degrade gracefully to no chips on timeout (RICH-C-08).

## §14 — Skills & Tooling Framework

### §14.1 Skill Interface

```ts
export interface ISkill {
  id: string;
  name: string;
  description: string;
  requiredContext: (keyof SkillContext)[];
  inputSchema: z.ZodSchema<unknown>;
  outputSchema: z.ZodSchema<unknown>;
  execute(context: SkillContext): AsyncIterable<SkillResult>;
  abort(): void;
}
export interface SkillContext {
  provider: ILLMProvider;
  model: string;
  abortSignal: AbortSignal;
  pageData?: TabContext;
  caseData?: SNowCaseData;
  uploadedFiles?: FileContext[];
  chatHistory?: LLMMessage[];
  noteContext?: NoteContext[];
}
export interface SkillResult {
  type: 'text' | 'structured' | 'card-grid' | 'list' | 'error' | 'action';
  content: string;
  data?: unknown;
  cards?: SkillCard[];
  actions?: SkillAction[];
}
```

### §14.2 Slash Command Parsing

```ts
const m = input.match(/^\/([a-z-]+)\b\s*(.*)$/s);
if (m) {
  const handler = SlashCommandRegistry.get(m[1]);
  if (handler) { handler.execute(m[2]); return; }
}
// No match → LLM verbatim
```

Palette sections: Skills, Templates, Macros, Commands. Triggered by / in composer.

### §14.3 Macros

Macros are **data, not code**. No eval. Each step is one of:

- { type: 'skill', skillId, input }
- { type: 'mcp', toolName, input }
- { type: 'save-note', titleTemplate }

WorkflowRunner executes sequentially. Step N output is available as {{step_N_output}} in step N+1.

### §14.4 CodeSearchSkill Chunking Contract

Marked @implementation-tier: sonnet-class — Haiku/Flash implementers must stub with { type: 'error', content: 'CODESEARCH_NEEDS_LARGE_MODEL' }.

Full implementation shape (for Sonnet-class agents):

- **Input schema:** { query: string; scriptScope?: string; maxResults?: number }.
- Fetch candidate scripts via SNowTableClient, rate-limited.
- **Map:** split each script into ≤ 8K-token windows by line boundaries. For each window, one LLM call: "Does this code match <query>? Return JSON {match:boolean, lines:[start,end], reason}."
- **Reduce:** collect matches, sort by relevance, cap at maxResults (default 20).
- **Output schema:** { matches: Array<{ scriptName: string; lines: [number,number]; snippet: string; reason: string }> }.
- Abort: each window call receives ctx.abortSignal; reduce halts on abort.
- **Model gate:** if active model context < 16K → SkillResult{ type: 'error', content: 'CODESEARCH_NEEDS_16K_CONTEXT' }.

## §15 — Storage Architecture

### §15.1 Storage Backends

```
chrome.storage.local  (10 MB limit)
  np_providers          ProviderConfig[]                     (encrypted apiKey fields)
  np_flags              FeatureFlags
  np_mcp_servers        MCPServerConfig[]
  np_mcp_permissions    Record<toolName,{allow,grantedAt}>
  np_conversation_meta  ConversationMeta[]                   (LRU 10 active + 100 archived)
  np_facts              Fact[]                                (max 500, LRU)
  np_templates          PromptTemplate[]
  np_macros             Macro[]
  np_install_secret     string                               (32 random bytes)
  np_debug_mode         boolean
  np_endpoint_overrides Record<string,string>
  np_keymap             KeymapRegistration[]
  np_workspace          WorkspaceState                       [NEW]
  np_addon_<addonId>    unknown                              (AddonSettingsStore)
  np_persona            PersonaProfile + overrides           [NEW Rev. B — PreferenceMemoryStore; reconciliation R2]
  np_notes_llm_features { autoTag, autoCategorize, autoSummary, aiSearch }   [NEW Rev. B — §27 LLM-WIKI-02]
chrome.storage.session  (cleared on browser close)
  np_jsessionid         string
  np_sysparm_ck         string
  np_token_ttl          number
  np_active_stream      { conversationId, operationId, startedAt }
  np_workspace_primary  { tabId, surface, electedAt }        [NEW]
chrome.storage.sync  (≤ 8 KB per key)
  np_theme              'light'|'dark'|'auto'
  np_language           string
IndexedDB  (side panel + full app)
  ChatHistoryDB
    sessions  { id, title, created, updated, starred, preview }
    messages  { sessionId, role, content, timestamp, metadata }
  NotesDB
    notes     { id, title, content, created, updated, tags[], links[], source, aiMeta, version,
                summary?, categoryPath?, summaryGeneratedAt?, tagsGeneratedAt? }   [Rev. B fields]
    concepts  { slug, label, summary, noteIds[], aliases[], updatedAt }
    // getNoteByTitle() added in Rev. B
  MemoryDB
    messages  { conversationId, seq, role, content, timestamp }   keyPath [conversationId, seq]
    userFacts UserMemoryFact[]
    conversationSummaries { conversationId, summary, updatedAt }
  ErrorStore (debug only, FIFO max 100)
  WriteJournalDB
    entries   WriteJournalEntry[]
  AITransactionLogDB
    transactions AITransaction[]
    promptTraces  PromptTrace[]
    toolTraces    ToolTrace[]
    providerTraces ProviderTrace[]
  notes_backup_config   { dirHandle }   [NEW Rev. B — v4 migration; FileSystemDirectoryHandle, non-JSON-serializable; §27 SYNC-01/D-08]
```

Message bodies never live in chrome.storage.local.

### §15.2 API Key Encryption

```
// src/core/storage/EncryptedStorage.ts
// installSecret: 32 random bytes, generated once → np_install_secret
// per-key: random 16-byte salt + 12-byte IV
// derivedKey: PBKDF2(installSecret + extensionId, salt, 100000, SHA-256) → AES-GCM-256
// NEVER use navigator.userAgent or any value that changes on browser update.
```

### §15.3 LRU Eviction (MemoryEngine)

- Max 10 conversations with status: 'active'. > 10 → archive oldest.
- Max 100 conversations with status: 'archived'. > 100 → evict oldest via WriteJournal.operation = 'evict-conversation'.
- Compactor runs when messageCount % 12 === 0: keep head (system + first 2) + LLM summary of middle + tail (last 4).
- Archive after 30 minutes idle.

## §16 — Security

### §16.1 XSS Prevention

| Attack vector | Mitigation |
|---|---|
| AI response in chat | PortableMarkdown (x-markdown) — never dangerouslySetInnerHTML |
| Content-script DOM writes | Extraction-only; DOMPurify.sanitize() on any HTML consumed |
| MCP tool results | Rendered as data strings through React JSX (AntD Descriptions, List, etc.) |
| User prompt text | React-managed input state; no eval |
| AntD content | Never pass HTML strings to AntD Typography.Paragraph; use <PortableMarkdown> |

### §16.2 Message Security (enforced by BackgroundRouter)

```ts
if (sender.id !== chrome.runtime.id) return false;
if (!MessageTypeValues.includes(message.type)) return false;
```

### §16.3 Content Security Policy

```
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src *"
}
```

### §16.4 Manifest Permissions

```
permissions: [
  'sidePanel','storage','cookies','alarms','tabs',
  'scripting','contextMenus','notifications','declarativeNetRequest'
],
host_permissions: [
  '*://*.service-now.com/*',
  '*://support.servicenow.com/*'
]
```

> **Rev. B note:** the File System Access API (§27) requires **no new manifest permission** — the user-gesture `showDirectoryPicker()` grants the handle. LLM-Wiki note content passes through TraceRedactor before indexing/logging/backup. Password field values are never written to .md files.

### §16.5 Secret Redaction

TraceRedactor.redact(value) MUST run before: writing to AITransactionLogDB; writing to ErrorStore; writing to debugLog; rendering in DiagnosticsPanel; exporting a debug bundle; **indexing note content or writing .md files (Rev. B, §27.6)**. See §4.4 for the mandatory patterns.

## §17 — UI/UX Requirements

### §17.1 Side Panel Layout

Side panel is 400 px wide (Chrome default). All UI must work at this width.

**Structure (using AntD compact algorithm):**

- **Header** — 44 px, contains conversation title, provider chip, "Open Full App" button.
- **Nav rail** — 48 px vertical, icon-only, tooltips (AntD Menu mode="inline" collapsed): Chat, Agent, Write (add-on), TeamGQM (add-on).
- **Main area** — page content.
- **Footer / composer** — chat input, slash suggestion overlay, send button.
- **Global overlays** — provider selector (AntD Popover), Cmd+K palette (AntD Modal), toasts via App.useApp().message, permission dialogs via App.useApp().modal.confirm.

Rules:

- Use AntD compact theme.compactAlgorithm throughout.
- Do NOT render heavy AntD Table, multi-column Descriptions, or wide forms in the side panel.
- Container queries below 380 px collapse to a single column.
- Use overflow-anchor: none for the streaming tail.
- CLS target <= 0.05.
- The "Open Full App" button lives in the header and is always visible.

### §17.2 Full App Layout

Full App is served from app.html in a normal browser tab. Uses AntD Layout:

```
+------------------------------------------------------------+
| Header (56 px)                                             |
|  NowPilot logo · workspace title · theme toggle · avatar   |
+----------+-------------------------------------------------+
|          |                                                 |
|  Sider   |            Content Area                         |
|  (240px) |                                                 |
|          |   Chat / Agent / Notes / TeamGQM / Options      |
|  Menu:   |                                                 |
|  - Chat  |                                                 |
|  - Agent |                                                 |
|  - Notes |                                                 |
|  - TeamGQM|                                                |
|  - Options|                                                |
+----------+-------------------------------------------------+
```

Rules:

- Use AntD default density (no compact algorithm).
- Sider is collapsible; state persisted per user in chrome.storage.sync.
- Content Area may use AntD Tabs, Table, Form, Descriptions, Card, Steps, Drawer, Modal.
- The Options page uses AntD Menu (secondary vertical) inside the Content Area to switch between sub-sections.
- Minimum supported viewport width: 1024 px. Below → show AntD Alert "This view is optimized for wider screens; open the side panel for narrow layouts."

### §17.3 AntD Theme System

NowPilot uses a single centralized ThemeStore (Zustand) that both surfaces consume via ConfigProvider. getAntdConfig (Appendix F) returns a full ConfigProviderProps including theme.algorithm, theme.token, and per-component overrides.

Rules:

- Use theme.darkAlgorithm for dark mode. Do not manipulate CSS classes for AntD components.
- Side Panel adds theme.compactAlgorithm; Full App does not.
- Any surface rendering @ant-design/x components wraps them in XProvider, fed the same theme/token object returned by getAntdConfig.
- All imperative APIs (message, notification, Modal.confirm) MUST be accessed through App.useApp(); static imports are forbidden.
- Icons from @ant-design/icons only (or motion for animated icons).

Full theme details in Appendix F.

### §17.4 Shared Component Requirements

- Every page wrapped in <ErrorBoundary> → renders AntD Result with status="500" and [Reload] button.
- All interactive elements have accessible labels via aria-label or AntD's built-in labelling.
- Keyboard navigation for major flows (Tab / Enter / Escape / Cmd+K).
- Loading uses AntD Skeleton, not spinners, for content areas.
- Toasts: max 3 visible via message.config({ maxCount: 3, duration: 5 }); errors persist until dismissed (notification.error({ duration: 0 })).
- All AI text rendered through <PortableMarkdown>.
- English only in v0.1; t('key') abstraction in src/core/i18n/strings.ts for future i18n; AntD locale set via ConfigProvider locale={enUS} for now.

### §17.5 Cross-Surface UX Consistency

- Same theme mode (light/dark) applies to both surfaces immediately via ThemeStore subscription.
- **Same persona applies to both surfaces (RICH-R-11).**
- Same conversation is visible in Side Panel Chat and Full App Chat when workspaceId matches.
- User can hand off from Side Panel → Full App via Flow 11 without losing scroll position or in-flight streaming.
- Same notification.error messages appear only on the surface that initiated the failing operation; secondary surfaces receive a compact "Error in other surface. Focus to see." indicator.

### §17.6 Accessibility

- Minimum contrast ratio: WCAG AA (4.5:1 text, 3:1 large text/UI).
- Focus rings visible on all interactive elements (AntD default is compliant).
- All Modals trap focus and support Escape to close.
- All Menu items reachable by arrow keys.
- All streaming content in Chat has aria-live="polite" on the message list.

### §17.7 RICH Design Requirements (NEW in Rev. B)

**Source:** [Ant Design X RICH Design Paradigm](https://x.ant.design/docs/spec/introduce).
**Scope:** four pillars — **R**ole (角色), **I**ntention (意图), **C**onversation (会话), **H**ybrid UI (混合界面). 60 requirements total (17 P0 / 22 P1 / 21 P2).
**Framework note:** RICH is implemented **on the already-adopted Ant Design X presentation components** (Bubble, Sender, Prompts, Welcome, Suggestion, Actions, ThoughtChain — §5.5, §7.2). No new UI framework. Persona runtime (RICH-R-01/02/10) built in Phase 3; all UI/behavior built in Phase 7 sub-waves 7.3/7.4/7.5 (§18).
**Priority key:** P0 = must-have · P1 = should-have · P2 = nice-to-have. **Effort:** S <4h · M 4–16h · L >16h.

#### §17.7.1 — R — Role (角色设计)

*AI 扮演了某种身份角色，来匹配用户的意图，保障与用户的互动是顺畅、符合预期的。*

**[R-01] AI Personality Profile — 角色人格配置**

- **RICH-R-01 (P0, M)** — Persona profile in `src/core/ai/persona/PersonaProfile.ts`: Identity (name, tagline, domain); Personality core (privacy-first, helpful, precise, humble); behavioral drivers (prefers clarifying questions over guessing, cites sources); Language style (professional-warm, technical-accessible, concise-by-default); Emotional repertoire (empathy, encouragement, curiosity).
- **RICH-R-02 (P0, S)** — `PersonaInjector` injects persona into system prompts across all AI calls. Depends on R-01.
- **RICH-R-03 (P1, M)** — "Meet NowPilot" character-introduction card as onboarding Step 1 (Flow 9). Depends on R-01.
- **RICH-R-04 (P2, L)** — Persona editor in Options → Persona (name, tone, brevity). Depends on R-01.
- **RICH-R-05 (P1, S)** — Persona persists across sessions/surfaces. **Stored in PreferenceMemoryStore (`np_persona`), NOT the fact store (reconciliation R2).** Depends on R-01.

**[R-02] Emotional Awareness — 人情味**

- **RICH-R-06 (P1, M)** — Sentiment-aware framing (acknowledge frustration before solutions). Via persona prompt, **no separate sentiment pipeline**. Depends on R-02.
- **RICH-R-07 (P2, S)** — Progress celebration on milestone. Depends on R-02.
- **RICH-R-08 (P1, S)** — Humble error recovery (brief apology + alternative, not defensive). Depends on R-02.

**[R-03] Role Consistency — 多模式角色一致性**

- **RICH-R-09 (P1, S)** — Chat and Agent share the same persona. Depends on R-02.
- **RICH-R-10 (P1, M)** — Persona-consistent system prompt per pipeline stage (Planner/Executor/Renderer). Depends on R-02.
- **RICH-R-11 (P0, S)** — Consistent avatar/visual identity across surfaces and modes.

#### §17.7.2 — I — Intention (意图设计)

*AI 能够听懂并理解用户的意图，协助用户自动完成方案计划和步骤拆解，进而推动执行。*

**[I-01] Welcome Cards — 唤醒｜欢迎提示**

- **RICH-I-01 (P0, L)** — Interactive Welcome Card grid (4–6 capability cards: Summarize page / Draft response / Research incident / Explain code / Write script / Analyze sentiment); each has icon+title+description; click populates the Sender.
- **RICH-I-02 (P1, M)** — Cards sorted: most-used first, then contextual (page URL/hostname). Depends on I-01.
- **RICH-I-03 (P1, S)** — Cards respect persona (persona-aware greeting). Depends on I-01, R-01.
- **RICH-I-04 (P2, S)** — Dismiss/don't-show-again toggle. Depends on I-01.

**[I-02] Context-Aware Suggestions — 上下文感知意图推荐**

- **RICH-I-05 (P0, L)** — 2–3 context-aware quick actions above the Sender when a page is pinned (ServiceNow incident/KB/generic mappings). Depends on PageContextBridge (§26).
- **RICH-I-06 (P0, S)** — Horizontal scrollable chip/pill strip between last message and Sender. Depends on I-05.
- **RICH-I-07 (P2, S)** — "More" expander. Depends on I-05.
- **RICH-I-08 (P1, M)** — Lightweight `IntentClassifier` (URL-pattern → suggestion mapping), **no LLM call**. Depends on I-05.

**[I-03] Intention Type Browsing — 明确意图类型**

- **RICH-I-09 (P1, M)** — Browsable prompt-template catalog (Writing/Analysis/Research/Coding/Support); select populates Sender.
- **RICH-I-10 (P1, M)** — Sender "Templates" popover (categories + recent). Depends on I-09.
- **RICH-I-11 (P2, S)** — Recently-used first. Depends on I-09.

**[I-04] Progressive Education — 渐进式能力引导**

- **RICH-I-12 (P2, S)** — After first 3 messages: "/" commands tip.
- **RICH-I-13 (P2, S)** — On 5th session: Agent-mode hint.
- **RICH-I-14 (P2, S)** — All tips "Got it" dismissible + tracked in memory.

#### §17.7.3 — C — Conversation (会话设计)

*用户的模糊意图通过会话来逐步与 AI 对焦、拆解，用户的指令也结合其中。*

**[C-01] AI-Initiated Clarification — 追问**

- **RICH-C-01 (P0, L)** — On ambiguous intent, ask a focused question + 2–4 option chips before executing; chips inject into Sender. **Uses existing `ask_clarification` branch (§1.2) — no schema change.** Depends on PlannerService.
- **RICH-C-02 (P0, M)** — Detection rules: missing target / ambiguous reference / under-specified. Depends on C-01.
- **RICH-C-03 (P0, S)** — Max 2 clarification rounds, then best-effort + caveat. Depends on C-01.
- **RICH-C-04 (P0, M)** — Chips as interactive Button components in the Bubble, 2–4 max. Depends on C-01.

**[C-02] Proactive Next-Step Hints — 提示**

- **RICH-C-05 (P0, L)** — 1–3 contextual follow-up chips after a response. Depends on PlannerService.
- **RICH-C-06 (P0, S)** — "Follow up" divider separating suggestions. Depends on C-05.
- **RICH-C-07 (P0, S)** — Tapping a chip sends it as the next user message. Depends on C-05.
- **RICH-C-08 (P0, M)** — Non-blocking haiku suggestion model, graceful timeout → no chips. Depends on C-05.

**[C-03] Conversation Closure — 结束**

- **RICH-C-09 (P1, M)** — Closure zone after 5 s idle: "Did this help?" 👍/👎 + "Anything else?".
- **RICH-C-10 (P2, S)** — Feedback logged anonymously (no user-identifiable data). Depends on C-09.
- **RICH-C-11 (P2, S)** — "Save this conversation" when ≥3 exchanges. Depends on C-09.

**[C-04] Structured Confirmation — 确认**

- **RICH-C-12 (P1, L)** — Inline confirmation chip for side-effect chat actions ("I'll search the web. [Proceed] [Cancel]"). Depends on PermissionDialog (Phase 8).
- **RICH-C-13 (P1, S)** — Read-only actions execute immediately. Depends on C-12.

**[C-05] Personalized Greeting — 开始**

- **RICH-C-14 (P1, M)** — Empty-state greeting with user name + time-of-day. Depends on UserMemoryStore/PreferenceMemoryStore.
- **RICH-C-15 (P2, S)** — Greeting includes contextual elements (page title, recent summary). Depends on C-14.

#### §17.7.4 — H — Hybrid UI (混合界面设计)

*用户的执行动作和机器的结果输出与反馈承载在融合了多种交互方式的界面当中。*

**[H-01] AI Branding — 唤醒**

- **RICH-H-01 (P0, M)** — Branded, dismissible AI header bar (name, avatar, tagline). Depends on R-01.
- **RICH-H-02 (P1, S)** — Brand badge on responses.
- **RICH-H-03 (P1, S)** — Agent ThoughtChain header: "NowPilot is working…". Depends on H-01.

**[H-02] Result Application Actions — 反馈**

- **RICH-H-04 (P0, L)** — Code-block inline actions: **"Copy code"**; **"Insert into page" = CLIPBOARD-ONLY in v0.1 (reconciliation R1)**; **"Save as macro"**.
- **RICH-H-05 (P1, M)** — Structured outputs get "Export as CSV" / "Copy as table".
- **RICH-H-06 (P1, S)** — "Save to note" promoted to a first-class button on every assistant message.
- **RICH-H-07 (P2, L)** — "Fill this field…" (page write-back) — **DEFERRED to v0.2+ (reconciliation R1).**

**[H-03] Rich Generation Process — 确认**

- **RICH-H-08 (P0, M)** — Streaming stage indicators: "Reading page context…" → "Planning response…" → "Generating…" as pills. Depends on ChunkBuffer (Appendix J).
- **RICH-H-09 (P2, M)** — Stage expand toggle for detail. Depends on H-08.
- **RICH-H-10 (P2, M)** — Slow-stream (>3 s) "Still working…" indicator. Depends on ChunkBuffer.

**[H-04] Parallel Chat + GUI — Do+Chat 均衡布局**

- **RICH-H-11 (P1, L)** — Full App split-pane: left 60% chat, right 40% Context panel; toggle.
- **RICH-H-12 (P1, L)** — Right-pane tabs: Context / Notes / Tools. Depends on H-11.
- **RICH-H-13 (P2, S)** — Split-pane layout persistent. Depends on H-11.
- **RICH-H-14 (P2, M)** — Inline notes Q&A layout. Depends on notes CRUD (Phase 5).

**[H-05] Sender Rich Input — 表达**

- **RICH-H-15 (P2, L)** — `@` mention (`@note:`, `@tab:`, `@prompt:`) + autocomplete. Depends on SlashCommandRegistry.
- **RICH-H-16 (P1, M)** — Image-paste attach.
- **RICH-H-17 (P2, L)** — Voice input (Web Speech, input only; TTS output deferred).

**[H-06] Message Result Actions — 反馈**

- **RICH-H-18 (P2, M)** — TL;DR expand/collapse for long responses (>500 chars).
- **RICH-H-19 (P2, M)** — Step-cards with checkoff for numbered/step lists.
- **RICH-H-20 (P2, S)** — Sticky table headers + horizontal scroll (XMarkdown). Depends on CHAT-07.

#### §17.7.5 — Reconciliations (MANDATORY)

- **R1 — No host-page write-back in v0.1.** RICH-H-04 "Insert into page" → clipboard-only; RICH-H-07 "Fill this field" → deferred. Content scripts extraction-only (§0.2, §5.6). Write-back requires v0.2+ page injection (§25). Retained: Copy code, Save as macro, Save to note.
- **R2 — Persona is user config, not an inferred fact.** RICH-R-05 persona persistence in PreferenceMemoryStore (`np_persona`) / `UserPreferences.personaId` — never UserMemoryStore. Honors system-owned, single-writer memory rules (§3.1, §3.5, §13).

#### §17.7.6 — Coverage & Priority Summary

Role 11 · Intention 14 · Conversation 15 · Hybrid UI 20 = **60**. P0 17 · P1 22 · P2 21.

#### §17.7.7 — Out of Scope (v0.1)

| Feature | Reason |
|---|---|
| Multi-modal animated 3D avatar | Over-scoped; static identity sufficient |
| Separate sentiment-analysis LLM call | In-scope framing uses persona prompt |
| Full NLP intent-parsing pipeline | URL/hostname + keyword heuristics sufficient (I-08) |
| Voice output (TTS) | Input (H-17) in scope; output deferred |
| Drag-and-drop GUI macro builder | Not in v0.1 |
| Cross-session conversation resumption w/ full replay | Deferred; v0.1 stateless between sessions |
| Shadow DOM injection / host-page write-back | Deferred per §0.2 (R1) |

## §18 — Master Implementation Phases (REORGANIZED in Rev. B)

This is the single canonical phase plan. Do not implement more than one phase per response unless explicitly requested.

**Reorganization principle (Rev. B):** phases follow the product data-flow — *acquire → store → understand → display → extend → harden* — instead of pure implementation dependency order. Key moves: **PageContentService → Phase 4a** (core infrastructure, §26); **Notes + Memory + MiniSearch consolidate into Phase 5 (Knowledge Base)**; **LLM-Wiki + Filesystem Sync → Phase 5a**; **Phase 7 becomes the pure Workspace Experience (UI/UX) phase** hosting the RICH sub-waves; **Hardening & Release stays last (Phase 9)**. Persona runtime seeds are added to Phase 3.

```
Data-flow view:
  Page → PageContentService (4a)
       → Knowledge Base: Memory · MiniSearch · Notes · Wikilinks (5)
       → LLM-Wiki: RAG · auto-tag/category/summary · chat/page→note · filesystem sync (5a)
       → Diagnostics (6)
       → Workspace Experience UI/UX + RICH (7)
       → Add-ons (8)
       → Hardening & Release (9)
```

### Phase 1 — MV3/WXT Runtime + AntD Shells + Workspace

**Create:**

```
wxt.config.ts                                       # Appendix G
src/entrypoints/background.ts
src/entrypoints/sidepanel/{index.html, main.tsx}
src/entrypoints/app/{index.html, main.tsx}                          [NEW]
src/entrypoints/content/core.content.ts                             # extraction-only
src/core/theme/{ThemeStore.ts, antdConfig.ts}                       [NEW]
src/core/workspace/{WorkspaceStore.ts, WorkspaceRouter.ts, WorkspaceSync.ts}   [NEW]
src/core/runtime/RuntimeEnvelope.ts                 # Appendix C + E
src/core/runtime/OperationId.ts
src/core/runtime/BroadcastBus.ts
src/core/runtime/PortReader.ts
src/core/runtime/workerState.ts
src/core/messaging/MessageBus.ts
src/core/events/EventBus.ts
src/core/log/debugLog.ts
src/core/i18n/strings.ts                            # Appendix B
src/core/prompts/index.ts                           # Appendix A
src/core/registry/{AddonRegistry, Registry, AddonSettingsStore, SidePanelPageRegistry, FullAppPageRegistry}.ts
src/core/input/KeymapRegistry.ts
src/core/components/{ErrorBoundary, PortableMarkdown}.tsx
src/components/sidepanel/{SidePanelShell, SidePanelRouter}.tsx      [NEW]
src/components/app/{AppShell, FullAppRouter}.tsx                    [NEW]
src/components/OnboardingModal.tsx                  # Flow 9
src/components/pages/{ChatPage, AgentPage, NotesPage, OptionsPage}.tsx   # skeletons only
```

**Required tests:**

```
tests/core/runtime/RuntimeEnvelope.test.ts
tests/core/runtime/OperationId.test.ts
tests/core/events/EventBus.test.ts
tests/core/workspace/WorkspaceStore.test.ts
tests/core/workspace/WorkspaceRouter.test.ts
tests/core/theme/ThemeStore.test.ts
```

**DONE when:**

- Side panel opens; onboarding appears on fresh install.
- Full App tab opens from side panel; workspace state hands off correctly.
- Full App can be re-opened without duplicating tabs (dedupe logic).
- Background router registers listeners synchronously.
- RuntimeEnvelope fixtures parse.
- Cmd+K palette opens with the Flow 10 command set on both surfaces.
- Theme toggle affects both surfaces immediately.
- grep -r 'innerHTML|dangerouslySetInnerHTML' src/ → zero.
- grep 'tailwind|shadcn|@radix-ui' package.json → zero.
- grep 'framer-motion' package.json → zero.
- pnpm run verify:phase-1 passes.

### Phase 2 — Storage, Security, WriteJournal, Workspace Persistence

**Create:**

```
src/core/storage/Setting.ts
src/core/storage/EncryptedStorage.ts
src/core/storage/WriteJournal.ts
src/core/storage/IndexedDBMigrator.ts
src/core/security/KeyVault.ts
src/core/security/redactSensitive.ts
src/core/storage/ChatHistoryDB.ts
src/core/storage/MemoryDB.ts
src/core/storage/NotesDB.ts
src/core/storage/ErrorStore.ts
src/core/utils/RateLimiter.ts
src/core/http/Requester.ts
```

**Required tests:**

```
tests/core/storage/WriteJournal.test.ts
tests/core/storage/EncryptedStorage.test.ts
tests/core/storage/IndexedDBMigrator.test.ts
tests/core/utils/RateLimiter.test.ts
tests/core/workspace/WorkspacePersistence.test.ts
```

**DONE when:**

- WriteJournal recovery test passes.
- API key encryption round-trip passes.
- No message body appears in chrome.storage.local.
- Migration from v1 → v2 fixture passes.
- Workspace state persists across page reload and cross-surface handoff.

### Phase 3 — Cost-Effective AI Runtime (+ Persona seed)

**Create:**

```
src/core/ai/types.ts
src/core/ai/ILLMProvider.ts
src/core/ai/ProviderRegistry.ts
src/core/ai/providers/{OpenAI,Anthropic,Gemini,Ollama,OpenAICompat}Provider.ts
src/core/ai/ProviderRouter.ts
src/core/ai/TierResolver.ts                         # Appendix D
src/core/ai/PromptCacheManager.ts
src/core/ai/PromptCacheAdapter.ts                   # Appendix K
src/core/ai/PlannerService.ts
src/core/ai/ExecutorService.ts
src/core/ai/RendererService.ts
src/core/ai/AgentOrchestrator.ts                    # Appendix I
src/core/ai/StructuredOutput.ts                     # Appendix L
src/core/ai/toolSchemas.ts
src/core/ai/StreamAdapter.ts
src/core/ai/ChunkBuffer.ts                          # Appendix J
src/core/ai/persona/PersonaProfile.ts               [NEW Rev. B — RICH-R-01]
src/core/ai/persona/PersonaInjector.ts              [NEW Rev. B — RICH-R-02, R-10]
```

**Required tests:**

```
tests/core/ai/PlannerService.test.ts
tests/core/ai/ExecutorService.test.ts
tests/core/ai/RendererService.test.ts
tests/core/ai/AgentOrchestrator.test.ts
tests/core/ai/ProviderRouter.test.ts
tests/core/ai/StructuredOutput.test.ts
tests/core/ai/persona/PersonaProfile.test.ts        [NEW Rev. B]
tests/core/ai/persona/PersonaInjector.test.ts       [NEW Rev. B]
```

**DONE when:**

- Planner returns valid JSON decisions with closed toolName enum.
- Executor rejects unknown tools.
- Renderer respects output caps.
- Provider fallback + circuit breaker tests pass.
- Structured output one-shot repair works.
- **PersonaInjector prepends the persona block to the Planner, Executor, Renderer, and MemoryExtractor system prompts (persona-aware from day one), placed in the cached [SYSTEM] section so prompt caching is preserved.**
- **UserPreferences.personaOverrides (name/tone/brevity) apply without a code change.**

### Phase 4 — Context-Adaptive Execution

**Create:**

```
src/core/context/ModelContextTier.ts
src/core/context/TokenBudget.ts
src/core/context/ContextOptimizer.ts
src/core/context/ContextCompressor.ts
src/core/context/ContextPack.ts
src/core/context/ContextProvenanceManifest.ts
```

**Required tests:**

```
tests/core/context/ContextOptimizer.test.ts
tests/core/context/ContextCompressor.test.ts
tests/core/context/TokenBudget.test.ts
```

**DONE when:**

- Tiny/small/medium/large tier tests pass.
- Context overflow degrades instead of failing.
- Minimal mode blocks MCP chaining (and LLM-Wiki RAG synthesis).
- ContextProvenanceManifest is attached to every OptimizedContext.

### Phase 4a — PageContentService (Knowledge Acquisition) — MOVED EARLIER (was Phase 8)

**Create:**

```
src/core/extraction/PageContentService.ts           # orchestrator (core)
src/core/extraction/apcLite.types.ts                # RawNode / APCLiteNode / APCLiteDocument (+ Zod) → Appendix C
src/core/extraction/strategies/IExtractionStrategy.ts
src/core/extraction/strategies/DefuddleStrategy.ts   # PRIMARY: main content → markdown (Defuddle)
src/core/extraction/strategies/ApcLiteStrategy.ts    # structural/actionable DOM+ARIA walk
src/core/extraction/PageContentSerializer.ts         # tree → markdown / PageContext
src/core/extraction/PageIndexBuilder.ts              # ephemeral MiniSearch index over extracted content
src/core/extraction/PageContentCache.ts              # per-tab cache + navigation invalidation
src/core/content/AxDomWalker.ts                      # content-script safe DOM+ARIA walker (no React/AntD)
src/core/content/PageContextBridge.ts                # RuntimeEnvelope bridge (EXTRACT_PAGE_CONTENT)
src/core/content/{ContentScriptHost, SPANavigationWatcher}.ts   # extraction-only shells
```

**Required tests:**

```
tests/core/extraction/PageContentService.test.ts
tests/core/extraction/DefuddleStrategy.test.ts
tests/core/extraction/ApcLiteStrategy.test.ts
tests/core/extraction/PageIndexBuilder.test.ts
tests/isolation/no-content-script-ui.test.ts        # verifies no React/AntD/defuddle/yaml in content bundle
```

**DONE when:**

- Defuddle runs in the side panel / full app (not the content bundle); content script only serializes HTML.
- Content-script bundle contains no React, AntD, defuddle, or yaml, and stays < 50 KB.
- Layered fallback (Defuddle→Readability, AX→DOM) records the source used.
- PageIndexBuilder builds an ephemeral per-tab MiniSearch index (never persisted).
- SPA-nav (wxt:locationchange) + tabs.onUpdated invalidation works.
- Passwords never captured (isPassword ⇒ value omitted).
- pnpm run verify:phase-4a passes.

### Phase 5 — Knowledge Base (Memory + MiniSearch + Notes)

**Create:**

```
src/core/memory/MemoryEngine.ts
src/core/memory/ConversationMemoryStore.ts
src/core/memory/UserMemoryStore.ts
src/core/memory/PreferenceMemoryStore.ts             # persona config (np_persona) lives here — Rev. B
src/core/memory/MemoryScorer.ts
src/core/memory/MemoryExtractor.ts
src/core/search/MiniSearchIndex.ts
src/core/notes/LinkParser.ts
src/core/notes/NoteGraph.ts
src/components/notes/{BacklinksPanel, WikilinkAutocomplete, NoteGraphView}.tsx   # core logic
```

**Knowledge model established here:** atomic notes (the unit) + wikilinks (`links[]`, the connective web) + tags (many-to-many labels). The `categoryPath` field is introduced on the Note type here (populated later by LLM-Wiki in Phase 5a).

**Required tests:**

```
tests/core/memory/MemoryEngine.test.ts
tests/core/memory/MemoryScorer.test.ts
tests/core/memory/UserMemoryStore.test.ts
tests/core/search/MiniSearchIndex.test.ts
tests/core/notes/LinkParser.test.ts
```

**DONE when:**

- Conversation summary + recent turns retrieved.
- User memory returns top 5 only (top 3 in tiny mode).
- Preference profile injects compact JSON (incl. persona overrides).
- Memory retrieval scores are all in [0, 1].
- MiniSearch < 50 ms over 1,000 notes.
- Wikilinks resolve with tie-break rule.
- End-to-end `Page → PageContentService → Note → MiniSearch` path works.
- pnpm run verify:phase-5 passes.

### Phase 5a — LLM-Wiki & Filesystem Sync — NEW

**Create:**

```
src/core/notes/NoteTagger.ts                         # LLM: tags + category + summary + memory facts
src/core/notes/NoteQA.ts                             # RAG: MiniSearch + memory + LLM synthesis + citations
src/core/notes/NoteChatConverter.ts                  # chat/page → structured note draft
src/core/notes/NoteFileSync.ts                       # one-way app→FS .md sync
src/core/notes/NoteMaintenance.ts                    # staleness/orphan detection, bulk analysis
src/components/notes/SaveToNoteDialog.tsx            # enhanced (LLM draft + preview)
src/components/options/NotesSection.tsx              # LLM toggles, backup config, bulk maintenance
src/components/options/ImportExportSection.tsx       # + "Restore from folder"
src/core/storage/migrations/v4_notes_backup_config.ts  # add notes_backup_config store + Note fields
```

Implements the full §27 requirement set: CAT-01…05, LLM-WIKI-01…10, SYNC-01…11, MEM-01…03.

**Required tests:**

```
tests/core/notes/NoteTagger.test.ts
tests/core/notes/NoteQA.test.ts
tests/core/notes/NoteChatConverter.test.ts
tests/core/notes/NoteFileSync.test.ts
tests/core/notes/NoteMaintenance.test.ts
tests/core/storage/migrations/v4.test.ts
```

**DONE when:**

- Save pipeline runs NoteTagger.analyze() (haiku, combined tags+category+summary+memory-facts) non-blocking after the IndexedDB write.
- Auto-tag/category/summary suggestions render with accept/reject.
- "Ask notes" RAG (flash) returns cited answers; tiny mode falls back to plain MiniSearch.
- Chat/page → note conversion opens a pre-filled editor (user is the gatekeeper).
- MEM-02 upserts facts only on the primary surface.
- showDirectoryPicker() + handle persist in notes_backup_config (Full App only).
- Per-save .md sync with YAML frontmatter + nested folders + collision suffixing + external-change guard.
- Delete-on-sync + empty-folder cleanup.
- Restore preview + additive upsert (never deletes local notes not in the folder).
- v4 migration idempotent.
- pnpm run verify:phase-5a passes.

### Phase 6 — Transaction Logging and Diagnostics

**Create:**

```
src/core/telemetry/AITransactionLog.ts
src/core/telemetry/AITransactionLogDB.ts
src/core/telemetry/TraceRedactor.ts
src/core/telemetry/PromptInspector.ts
src/core/telemetry/TokenLedger.ts
src/components/options/DiagnosticsSection.tsx
src/components/options/TransactionTraceView.tsx
```

**Required tests:**

```
tests/core/telemetry/AITransactionLog.test.ts
tests/core/telemetry/TraceRedactor.test.ts
tests/components/DiagnosticsSection.test.tsx
```

**DONE when:**

- Every provider call creates transaction / prompt / provider traces.
- Every tool call creates a tool trace.
- Redaction test proves secrets (+ note content + filesystem paths, Rev. B) are not persisted.
- Diagnostics panel in Options can copy operation ID.

### Phase 7 — Workspace Experience (UI/UX) + RICH — RENAMED/REFOCUSED

**Create:**

```
src/components/pages/ChatPage.tsx                   # full — reused by Side Panel + Full App
src/components/pages/AgentPage.tsx
src/components/pages/NotesPage.tsx                  # Full App only, incl. LLM-Wiki panels
src/components/pages/OptionsPage.tsx                # Full App only
src/components/options/{ProvidersSection, ModelsSection, MCPSection, PromptsSection, SlashSection, MemorySection, ImportExportSection, FeatureFlagsSection, AddonSettingsSection, PersonaSection, NotesSection}.tsx
src/components/notes/{BacklinksPanel, WikilinkAutocomplete, NoteGraphView, NotePreview, SaveToNoteDialog}.tsx
src/components/patterns/{ChatMessage, HistoryListItem, ToolCard, SkillMessageRenderer, SourceCard}.tsx
src/components/rich/{WelcomeCards, QuickActionChips, ClarificationChips, FollowUpChips, PersonaHeader, StageIndicator, ClosureZone, ContextPane, TemplateCatalog, CodeBlockActions, StepCards}.tsx   [NEW Rev. B]
src/core/intent/IntentClassifier.ts                                                             [NEW Rev. B — RICH-I-08]
src/hooks/useChat.ts
src/hooks/useStreamingLLM.ts                        # Appendix J
src/hooks/useProviderRouter.ts
src/hooks/useMemory.ts
src/hooks/useDiagnostics.ts
src/hooks/useWorkspace.ts                                                [NEW]
src/hooks/useTheme.ts                                                    [NEW]
src/hooks/usePersona.ts                                                  [NEW Rev. B]
src/hooks/useRichSuggestions.ts                                         [NEW Rev. B — RICH-C-05/08]
src/core/prompts/{PromptManager, TemplateEngine, builtinTemplates}.ts
src/core/slash/SlashCommandRegistry.ts
```

**Required tests:**

```
tests/hooks/useStreamingLLM.test.ts
tests/hooks/useWorkspace.test.ts
tests/hooks/usePersona.test.ts                       [NEW Rev. B]
tests/components/ChatPage.test.tsx
tests/components/OptionsPage.test.tsx
tests/components/rich/ClarificationChips.test.tsx    [NEW Rev. B]
tests/components/rich/FollowUpChips.test.tsx         [NEW Rev. B]
tests/components/rich/WelcomeCards.test.tsx          [NEW Rev. B]
tests/core/intent/IntentClassifier.test.ts           [NEW Rev. B]
tests/core/notes/LinkParser.test.ts
```

This phase exposes capabilities built in Phases 3–5a as polished surfaces, then layers RICH in sub-waves:

- **Phase 7.1 — Core screens:** Chat/Agent/Notes/Options render with Planner→Executor→Renderer, ChunkBuffer streaming, /write /ask presets, note wikilinks, Options forms, Diagnostics.
- **Phase 7.2 — LLM-Wiki UI surfacing:** NotesPage "Ask notes" bar, category tree toggle, summary lines, orphan badges, AI-search toggle, backup status Tag, SaveToNoteDialog.
- **Phase 7.3 — RICH Core (17 P0):** RICH-R-01/02/11, RICH-H-01, RICH-I-01/05/06, RICH-C-01/02/03/04, RICH-C-05/06/07/08, RICH-H-04 (clipboard-only insert), RICH-H-08. *(persona runtime seeds already in Phase 3.)*
- **Phase 7.4 — RICH Enhance (22 P1):** RICH-R-03/05/06/08/09/10, RICH-I-02/03/08/09/10, RICH-C-09/12/13/14, RICH-H-02/03/05/06/11/12/16.
- **Phase 7.5 — RICH Polish (21 P2):** all remaining P2 items (RICH-H-07 remains deferred, R1).

**DONE when:**

- Both surfaces use Planner→Executor→Renderer; ChunkBuffer streaming.
- /write and /ask presets work.
- Note wikilinks resolve with tie-break rule (Full App Notes page).
- Options page shows all sub-sections (incl. Persona + Notes) with functional forms.
- DiagnosticsPanel renders in Full App → Options → Diagnostics.
- LLM-Wiki UI functional (Ask notes, category tree, backup status, SaveToNoteDialog).
- RICH P0 (7.3) complete: persona header, welcome cards, quick-action chips, clarification + follow-up chips (max 2 rounds; graceful timeout), code-block Copy/Save-as-macro (Insert=clipboard-only), streaming stage indicators.
- pnpm run verify:phase-7 passes.

### Phase 8 — Add-ons and Content Script Runtime (Extraction-Only)

**Create/complete:**

```
src/core/content/ContentScriptHost.ts               # extraction-only, no UI mount (completed)
src/core/content/PageContextBridge.ts               # (completed)
src/core/chrome/{CookieSessionStore, CORSProxy, ContextMenuHost, TabManager, NotificationsManager, ClipboardHelper, Scheduler}.ts
src/core/output/{StructuredOutputRenderer, OutputFormatter}.ts
src/core/data/DataPortability.ts
src/core/webhooks/WebhookManager.ts
src/addons/global/{SelectionContextMenu, ResearchSkill}.ts
src/addons/write/**                                 # full
src/addons/teamgqm/**                               # shell + integration
src/addons/servicenow/**                            # full add-on tree per §8.5
```

**Required tests:**

```
tests/core/content/ContentScriptHost.test.ts
tests/core/content/PageContextBridge.test.ts
tests/addons/write/WriteAddon.test.ts
tests/addons/servicenow/ServiceNowSessionAdapter.test.ts
tests/isolation/no-content-script-ui.test.ts
```

**DONE when:**

- Content-script bundle contains no React, no AntD, no UI code.
- ServiceNow add-on uses ServiceNowSessionAdapter.
- ServiceNow API calls use PROXY_FETCH only.
- Right-click selection → "Ask AI" opens Side Panel with selection prefilled.
- /research runs via ResearchSkill.
- Write add-on renders in Side Panel with all quick actions.
- TeamGQM add-on renders in Side Panel and Full App.
- Add-ons can consume PageContentService + Memory + Notes + LLM-Wiki.

### Phase 9 — Hardening and Release

**Required test suites:**

```
tests/core/ai/**
tests/core/context/**
tests/core/memory/**
tests/core/notes/**            # LLM-Wiki + filesystem sync (Rev. B)
tests/core/telemetry/**
tests/core/storage/**
tests/core/workspace/**
tests/components/rich/**        # RICH interaction (Rev. B)
tests/isolation/no-content-script-ui.test.ts
tests/perf/**
```

**DONE when:**

- pnpm run verify:all passes.
- pnpm run test:perf passes.
- pnpm run test:isolation passes.
- Content script bundle < 50 KB (extraction-only).
- Side panel initial paint < 300 ms.
- Full App initial paint < 500 ms.
- First token < 2 s local / < 3 s cloud.
- Filesystem restore round-trips a full vault (Rev. B).
- RAG returns correct citations on a fixture note set (Rev. B).

## §19 — Runtime Edge Cases and Mitigations

### §19.1 User Has Only One AI Provider

- ProviderRouter must not assume fallback exists.
- Retry once only for retryable failures before first token.
- On persistent failure: show retry / configure-provider UI (opens Full App → Options → Providers).
- Memory, notes, and local search remain available offline.

### §19.2 Local Model Small Context

- Classify as tiny or small via ModelContextTier.
- Enable minimal mode automatically.
- Disable MCP chaining.
- Cap memory injection.
- Compress page/case context.

### §19.3 Context Overflow

- Degrade stepwise via ContextOptimizer.
- Never send an oversized prompt.
- Record truncation in PromptTrace.truncatedSources.
- Show non-blocking message.warning only when quality may be affected.

### §19.4 JSON Truncation

- Detect malformed/incomplete JSON.
- Retry once with smaller output cap and PROMPTS.repairJson.
- If still broken, return typed schema error.

### §19.5 Hallucinated Tool Call

- Executor rejects unknown / invalid tools with TOOL_REJECTED.
- Renderer explains limitation briefly.

### §19.6 Background SW Termination

- LLM stream continues in side panel or Full App.
- PROXY_FETCH calls fail / retry only if marked safe by caller.
- Startup recreates alarms, context menus, router.
- Diagnostics records background restart.
- useStreamingLLM persists np_active_stream to chrome.storage.session; a re-opened surface calls AITransactionLog.markAborted(operationId) on recovery.

### §19.7 Side Panel Resizing

- Container queries; single-column fallback below 380 px.
- overflow-anchor: none for streaming tail.
- CLS target ≤ 0.05.

### §19.8 Multi-Window Side Panels + Full App Tabs

- BroadcastBus primary election across all surfaces.
- Only the primary surface writes memory stores.
- Secondary surfaces mirror read-only.
- WriteJournal maintains idempotency.
- If two Full App tabs are open in different windows, both display but only one holds write primacy.

### §19.9 Provider Deleted While Active

- Fall back to lowest-priority enabled provider.
- If none: show Flow 1 no-provider modal (with "Open Options" button leading to Full App).

### §19.10 IndexedDB Blocked

- Catch open error → IDB_BLOCKED toast.
- Degrade to in-memory session (no persistence).

### §19.11 Abort During Permission Prompt

- Dismiss → inject PERMISSION_DENIED tool result → end stream cleanly.

### §19.12 Two Side Panels + Two Full App Tabs

- Enforce single-writer rule via BroadcastBus.
- Last-write-wins with version check on all memory writes.

### §19.13 Prompt Cache Miss Cascade

- If provider reports zero cache hit for 5 consecutive requests, PromptCacheManager disables cache hints for 60 s to avoid overhead.

### §19.14 Full App Tab Closed Mid-Stream

- Stream continues in memory until finished, then is discarded (no destination).
- AITransactionLog.markAborted(operationId) fires on close via beforeunload.
- Primary writer election restarts; next surface picks up primacy.

### §19.15 Handoff Race Condition

- WorkspaceRouter.openFullApp() is idempotent by workspaceId.
- Second click focuses the existing Full App tab instead of opening a new one.

### §19.16 Backup Folder Permission Revoked (NEW Rev. B)

- On NotesPage mount, handle.queryPermission() fails → sync disabled → red "Backup: Error" Tag + banner "[Re-select folder] [Dismiss]". No data loss (IndexedDB remains primary). Error code NOTE_SYNC_PERMISSION_REVOKED.

### §19.17 External .md Change (NEW Rev. B)

- On save, if file lastModified is newer than the last sync timestamp (2 s tolerance) → confirm "This file was modified externally. Overwrite with app version? [Overwrite] [Skip]", default Skip (SYNC-06).

### §19.18 NoteTagger LLM Failure (NEW Rev. B)

- Save always succeeds (IndexedDB first); tagging failure shows a subtle "Couldn't analyze — [Retry]" hint; never blocks save or sync. Error code NOTE_TAGGER_FAILED.

### §19.19 RAG No Results (NEW Rev. B)

- "Ask notes" with zero MiniSearch hits → "No relevant notes found. Try rephrasing." (no LLM call wasted). Error code RAG_NO_RESULTS.

### §19.20 RICH Suggestion Timeout (NEW Rev. B)

- Clarification/follow-up haiku call times out → render the response with no chips (graceful, RICH-C-08). Error code RICH_SUGGESTION_TIMEOUT (logged, non-fatal).

## §20 — Runtime State Models & Cross-Context Coordination

### §20.1 RuntimeEnvelope

All cross-context messages carry a RuntimeEnvelope<T> (Appendix C). All responses use ResponseEnvelope<T> (Appendix E).

### §20.2 Idempotency Keys

| Operation | Idempotency key |
|---|---|
| Save chat message | sessionId + seq |
| Save memory body | conversationId + seq |
| Evict conversation | conversationId + evictionVersion |
| Save note | note.id + note.version |
| **Sync note file (Rev. B)** | note.id + note.version + filePath |
| **Delete note file (Rev. B)** | note.id + filePath |
| **Restore notes batch (Rev. B)** | folderHash + fileName |
| Webhook retry | eventId |
| Workspace update | workspaceId + version |
| Open Full App | workspaceId |
| PROXY_FETCH | Never retried unless caller marks request retry-safe. |

### §20.3 WriteJournal Operations

```ts
type WriteJournalOperation =
  | 'append-memory-message'
  | 'evict-conversation'
  | 'archive-conversation'
  | 'compact-conversation'
  | 'save-note-with-links'
  | 'update-user-memory'
  | 'export-data'
  | 'update-workspace'
  | 'sync-note-file'         // NEW Rev. B
  | 'delete-note-file'       // NEW Rev. B
  | 'restore-notes-batch';   // NEW Rev. B
```

update-workspace order:

```
1. Create WriteJournalEntry(status='pending')
2. Write chrome.storage.local.np_workspace
3. Emit BroadcastBus WORKSPACE_UPDATED
4. Mark WriteJournalEntry(status='completed')
```

### §20.4 IndexedDB Migration Policy

```ts
export interface IndexedDBMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(db: IDBPDatabase, tx: IDBPTransaction): Promise<void>;
}
```

- Every IndexedDB database declares a numeric DB_VERSION.
- Every version bump includes a migration function.
- Migrations are deterministic and idempotent where practical.
- Migration failures record IDB_MIGRATION_FAILED in ErrorStore and enter degraded mode.
- **v4 migration (Rev. B):** add the `notes_backup_config` object store; add optional Note fields `summary`, `categoryPath`, `summaryGeneratedAt`, `tagsGeneratedAt`; add `tags` and `summary` to the MiniSearch notes index fields. Idempotent: skip if store/fields already present.

### §20.5 Background Worker State

```ts
export type BackgroundWorkerState =
  | { state: 'cold-starting'; startedAt: number }
  | { state: 'ready'; startedAt: number; alarmsReady: boolean; routerReady: boolean }
  | { state: 'degraded'; reason: 'ALARMS_MISSING' | 'ROUTER_ERROR' | 'SESSION_UNAVAILABLE'; message: string }
  | { state: 'shutting-down'; reason: 'IDLE' | 'RELOAD' | 'UNKNOWN' };
```

### §20.6 Active Stream State

```ts
export type ActiveStreamState =
  | { state: 'idle' }
  | { state: 'preparing'; sessionId: string; operationId: string; surface: ActiveSurface }
  | { state: 'streaming'; sessionId: string; operationId: string; startedAt: number; surface: ActiveSurface }
  | { state: 'waiting-for-permission'; sessionId: string; operationId: string; toolName: string; surface: ActiveSurface }
  | { state: 'aborting'; sessionId: string; operationId: string; surface: ActiveSurface }
  | { state: 'completed'; sessionId: string; operationId: string; surface: ActiveSurface }
  | { state: 'failed'; sessionId: string; operationId: string; code: string; message: string; surface: ActiveSurface };
```

### §20.7 Tab Extraction State

```ts
export type TabExtractionState =
  | { state: 'idle'; tabId?: number }
  | { state: 'injecting'; tabId: number; operationId: string }
  | { state: 'extracting'; tabId: number; operationId: string }
  | { state: 'pinned'; tabId: number; title: string; extractedAt: number }
  | { state: 'failed'; tabId?: number; code: 'UNSUPPORTED_URL' | 'TIMEOUT' | 'CONTENT_EXTRACT_FAILED'; message: string };
```

### §20.8 Tool Permission State

```ts
export type ToolPermissionState =
  | { state: 'not-required'; toolName: string }
  | { state: 'prompting'; toolName: string; dangerous: boolean; operationId: string }
  | { state: 'allowed-once'; toolName: string; operationId: string }
  | { state: 'allowed-always'; toolName: string; grantedAt: number }
  | { state: 'denied'; toolName: string; operationId: string; reason: 'USER_DENIED' | 'PANEL_CLOSED' | 'TIMEOUT' };
```

### §20.9 ServiceNow Session State

```ts
export type ServiceNowSessionState =
  | { state: 'unknown' }
  | { state: 'missing'; missing: Array<'JSESSIONID' | 'sysparmCK'> }
  | { state: 'partial'; available: Array<'JSESSIONID' | 'sysparmCK'>; missing: Array<'JSESSIONID' | 'sysparmCK'> }
  | { state: 'ready'; instanceHost: string; tokenTtl: number }
  | { state: 'expired'; instanceHost: string; expiredAt: number }
  | { state: 'error'; code: string; message: string };
```

### §20.10 Provider Retry / Circuit Breaker

| Error code | Retryable pre-first-token | Circuit-breaker vote |
|---|---|---|
| TIMEOUT | Yes | 1 |
| PROVIDER_5XX | Yes | 1 |
| NETWORK | Yes | 1 |
| RATE_LIMITED | Yes (with jitter) | 0 |
| AUTH | No | 3 (open immediately) |
| MODEL_UNKNOWN | No | 0 |
| SCHEMA_INVALID | No | 0 |
| HOST_NOT_PERMITTED | No | 0 |

After 3 votes within 60 s, provider marked open for 5 minutes.

### §20.11 Workspace Coordination State

```ts
export type WorkspaceCoordinationState =
  | { state: 'solo'; primarySurface: ActiveSurface }
  | { state: 'primary'; surface: ActiveSurface; secondaries: ActiveSurface[] }
  | { state: 'secondary'; primarySurface: ActiveSurface; isMirroring: boolean }
  | { state: 'election-in-progress'; startedAt: number }
  | { state: 'error'; code: 'ELECTION_TIMEOUT' | 'STORAGE_UNAVAILABLE'; message: string };
```

Election rules: startup compare-and-set to np_workspace_primary; heartbeat every 3 s; missed 2 heartbeats → re-election; Full App has tie-break priority.

### §20.12 Note Sync State (NEW Rev. B)

```ts
export type NoteSyncState =
  | { state: 'off' }
  | { state: 'on'; folderName: string; lastSyncAt: number; noteCount: number }
  | { state: 'syncing'; noteId: string }
  | { state: 'error'; code: 'PERMISSION_REVOKED' | 'WRITE_FAILED' | 'PICKER_ABORTED'; message: string };
```

### §20.13 Add-on Certification Checklist

Every add-on PR must confirm: no core→add-on import; no UI in content scripts; pages registered via registries; storage keys prefixed np_addon_<id>; API via PROXY_FETCH; secrets via TraceRedactor; Zod addonSettings schema; ≥1 fixture test.

## §21 — Data Models

### §21.1 Chat

```ts
export interface ChatSession {
  id: string;
  title: string;
  created: number;
  updated: number;
  starred: boolean;
  preview: string;
}
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'system'|'user'|'assistant'|'tool';
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    skillId?: string;
    toolName?: string;
    surface?: ActiveSurface;
  };
}
```

### §21.2 Note (EXTENDED in Rev. B)

```ts
export interface Note {
  id: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  tags: string[];
  links: string[];                 // wikilinks (atomic-note graph)
  source: {
    kind: 'manual'|'voice'|'chat-export'|'template'|'page-export';   // +page-export (Rev. B)
    conversationId?: string;
    templateId?: string;
  };
  aiMeta: {
    suggestedLinks: Array<{ targetId: string; confidence: number; reason: string }>;
    concepts: string[];
    lastWikiRunAt?: number;
  };
  // --- Rev. B — LLM-Wiki fields (§27) ---
  summary?: string;                // LLM-generated (LLM-WIKI-03)
  categoryPath?: string;           // e.g. "InfoTech/Database/MySQL" (CAT-01) → filesystem folder
  summaryGeneratedAt?: number;     // staleness detection (LLM-WIKI-08)
  tagsGeneratedAt?: number;        // staleness detection (LLM-WIKI-08)
  version: number;
}
```

> **Knowledge model:** atomic note (unit) + `links[]` (wikilink web) + `tags[]` (many-to-many labels) + `categoryPath` (single hierarchy → folder). Categories and tags are deliberately separate (D-03, §27).

### §21.3 Conversation Metadata + Memory Bodies

```ts
export type ConversationStatus = 'active' | 'archived';
export interface ConversationMeta {
  id: string;
  title: string;
  status: ConversationStatus;
  topic?: string;
  created: number;
  lastAccessed: number;
  messageCount: number;
}
export interface MemoryMessage {
  conversationId: string;
  seq: number;
  role: LLMMessage['role'];
  content: string;
  timestamp: number;
}
```

### §21.4 Fact / Insight / Built-in Tool Descriptor

```ts
export interface Fact {
  id: string;
  content: string;
  confidence: number;
  source: 'extracted'|'explicit';
  created: number;
}
export interface Insight {
  id: string;
  kind: 'tag-trend' | 'activity' | 'skill-usage';
  label: string;
  value: number | string;
  computedAt: number;
}
export interface BuiltinTool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<unknown>;
  outputSchema: z.ZodSchema<unknown>;
  dangerous: boolean;
}
```

### §21.5 Workspace Model

```ts
export type ActiveSurface = 'sidepanel' | 'full-app';
export interface WorkspaceState {
  workspaceId: string;
  conversationId: string;
  activeProvider?: ProviderId;
  selectedModel?: string;
  pinnedTabs: TabContext[];
  currentPageContext?: PageContext;
  selectedNotes: string[];
  activeAddonContext?: {
    addonId: string;
    contextKey: string;
    payload: unknown;
  };
  activeSkillRun?: {
    skillId: string;
    operationId: string;
    startedAt: number;
    status: 'running' | 'completed' | 'failed' | 'aborted';
  };
  activeSurface: ActiveSurface;
  openedFullAppTabId?: number;
  version: number;
  updatedAt: number;
}
```

### §21.6 NowPilot Error + Persona (Rev. B)

```ts
export interface NowPilotError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
}
// Rev. B — Persona (RICH-R). Config lives in PreferenceMemoryStore (reconciliation R2).
export interface PersonaProfile {
  id: string;
  identity: { name: string; tagline: string; domain: string };
  personalityCore: string[];                 // ['privacy-first','helpful','precise','humble']
  behavioralDrivers: string[];               // ['asks clarifying questions','cites sources']
  languageStyle: { tone: 'professional-warm'|'concise'|'friendly'; vocabulary: string; brevity: 'brief'|'balanced'|'detailed' };
  emotionalRepertoire: string[];             // ['empathy','encouragement','curiosity']
}
```

Canonical error codes (closed set):

```
SESSION_TOKEN_MISSING
PROVIDER_FETCH_FAILED
PROVIDER_AUTH
PROVIDER_5XX
PROVIDER_RATE_LIMITED
PROVIDER_MODEL_UNKNOWN
MCP_TOOL_ERROR
STORAGE_READ_FAILED
CONTENT_EXTRACT_FAILED
CONTEXT_PACK_TRUNCATED
CONTEXT_TOO_LARGE
PERMISSION_DENIED
TIMEOUT
RATE_LIMITED
KEYMAP_CONFLICT
TOOL_UNAVAILABLE
TOOL_REJECTED
IDB_BLOCKED
IDB_MIGRATION_FAILED
RESEARCH_NO_TOOL
HOST_NOT_PERMITTED
STRUCTURED_OUTPUT_FAILED
SCHEMA_INVALID
NETWORK
PLANNER_FAILED
CODESEARCH_NEEDS_16K_CONTEXT
CODESEARCH_NEEDS_LARGE_MODEL
BACKGROUND_START_FAILED
BACKGROUND_ROUTER_REGISTER_FAILED
BACKGROUND_ALARM_RECREATE_FAILED
BACKGROUND_CONTEXT_MENU_RECREATE_FAILED
BACKGROUND_PROXY_TIMEOUT
BACKGROUND_STATE_DEGRADED
WORKSPACE_ELECTION_TIMEOUT
WORKSPACE_STORAGE_UNAVAILABLE
WORKSPACE_HANDOFF_FAILED
FULL_APP_OPEN_FAILED
NOTE_SYNC_PERMISSION_REVOKED       # NEW Rev. B
NOTE_SYNC_WRITE_FAILED             # NEW Rev. B
NOTE_RESTORE_PARSE_FAILED          # NEW Rev. B
NOTE_TAGGER_FAILED                 # NEW Rev. B
RAG_NO_RESULTS                     # NEW Rev. B
PERSONA_LOAD_FAILED                # NEW Rev. B
RICH_SUGGESTION_TIMEOUT            # NEW Rev. B
```

## §22 — Performance Targets & Algorithms

### §22.1 Performance Targets

| Metric | Target |
|---|---|
| Side panel initial paint | < 300 ms |
| Full App initial paint | < 500 ms |
| First AI token (local Ollama) | < 2 s |
| First AI token (cloud) | < 3 s |
| MiniSearch over 1,000 notes | < 50 ms |
| Wikilink autocomplete | < 50 ms p95 (≤ 5,000 notes) |
| resolveLinks() | < 20 ms |
| IndexedDB write batch | ≤ 5 s or 10 messages, whichever first |
| Content script bundle | < 50 KB (extraction-only) |
| Background SW fetch timeout | 25 s (hard) |
| Tab context extraction | 5 s (hard) |
| EventBus dispatch | < 1 ms (synchronous) |
| BroadcastBus round-trip (cross-surface) | < 100 ms p95 |
| Workspace handoff | < 1 s |
| ChunkBuffer flush rate | max every 16 ms (upgrade to 33 ms if enqueue > 8 kB/s) |
| **NoteTagger analyze (haiku)** (Rev. B) | non-blocking; save never waits |
| **Ask-notes RAG synthesis (flash)** (Rev. B) | < 4 s p95 |
| **Per-save .md file write** (Rev. B) | < 200 ms; 50 ms debounce; fire-and-forget |
| **Restore parse (100 notes)** (Rev. B) | < 3 s |

### §22.2 Context Overflow Rules

- Drop longest block.
- Drop last 20 %.
- Keep only first paragraph + first heading.
- Return empty with truncated: true; toast: "Content was too large to include in AI context."

Per-source budgets (tokens): Webpage 2,000 · Note 500 · Current page (SN) 300 · JSON 1,000.

### §22.3 NoteGraph Cosine Similarity

topKSimilar(note, k = 5) — bag-of-words cosine, no library.

- Tokenise: content.toLowerCase().match(/[a-z0-9]{3,}/g).
- Remove fixed 50-word English stop-word list shipped inline in NoteGraph.ts.
- Per-note term-frequency map; cosine = dot(a,b) / (||a|| * ||b||).
- Rank descending; ties broken by updated desc, then id asc.
- Default k = 5.

### §22.4 InsightEngine Analyses

Runs nightly via Scheduler. v0.1 produces exactly three Insight values: tag-trend, activity, skill-usage.

## §23 — Key Technology Decisions (ADRs)

| Decision | Choice | Rationale |
|---|---|---|
| Extension framework | WXT | Type-safe, HMR, cross-browser, no cloud dependency |
| UI framework | React 19 | Streaming renders via concurrent mode |
| **UI component library** | **Ant Design v6** | Enterprise data components, mature forms/tables, accessibility, i18n; v6 compatible upgrade over v5 (React ≥18, CSS-variable theming, official CLI + machine-readable DESIGN.md reduce AI-coding-agent hallucination) |
| **AI chat components** | **Ant Design X 2.x** (presentation only) | Bubble, Sender, Conversations, ThoughtChain, Think, Attachments, Suggestion, Sources, FileCard map onto Chat/Agent needs. X 2.x targets antd v6 and is the actively developed line; X 1.x pairs with antd v5 (1-year bugfix-only window from Nov 2025) |
| **Markdown/streaming rendering** | **@ant-design/x-markdown** | Purpose-built for incremental/streaming; built-in LaTeX/mermaid/code-highlight replace 5 packages |
| **AI chat data flow** | **NOT @ant-design/x-sdk** — kept AgentOrchestrator/ProviderRouter/ContextOptimizer | x-sdk's useXChat/ChatProvider calls providers directly from the UI, bypassing Planner→Executor→Renderer, ContextOptimizer, MemoryEngine, AITransactionLog |
| **Dynamic agent-generated UI (A2UI)** | **Deferred to v0.2+** — not @ant-design/x-card in v0.1 | A2UI's createSurface/updateComponents command stream is a harder JSON target than the 3-action PlannerDecisionSchema; unsafe for Haiku/Flash today (§25.6) |
| **Theming** | AntD ConfigProvider + XProvider + Zustand ThemeStore | Centralized token system, dark mode via darkAlgorithm, per-surface compact toggle |
| **Two UI surfaces** | Side Panel + Full App Tab | Side Panel = daily workflow, Full App = deep work / config / diagnostics |
| **Shared workspace** | WorkspaceStore (Zustand) + BroadcastBus | Single source of truth across surfaces; cross-surface handoff |
| **Content scripts** | Extraction-only in v0.1 | No UI in host pages; simpler bundle; page injection deferred |
| **Page injection** | **Deferred to v0.2+** | Reduces v0.1 complexity; add-on architecture preserved |
| **Page-content extraction placement** | **Core PageContentService**, not a tool | Shared infra for Chat/Agent/Summarize/research/add-ons; central cache, concurrency, redaction |
| **Main-content extraction** | **Defuddle** | Purpose-built Readability successor; preserves footnotes/math/code; clean Markdown; MIT; runs in side panel/full app |
| **Extraction model** | **Layered strategy** (Defuddle → APC-lite → ServiceNow API) | Right tool per page type |
| **Page-content retrieval** | **MiniSearch over extracted content** (ephemeral, per-tab) | Keeps large pages within the 2,000-token budget; reuses core engine; never persisted |
| **Browser automation** | **Deferred to v2** (chrome.debugger + CDP Input) | Trusted-event automation needs the debugger; out of scope for read-only v0.1 |
| State | Zustand | 1 KB, no boilerplate, works outside React |
| AI SDK | Vercel AI SDK + custom orchestrator | Streaming/abort/tools; lighter than LangChain |
| AI providers | @ai-sdk/* only | Single codepath for 5 providers |
| Runtime orchestration | Planner → Executor → Renderer | Cheap models cannot drive maxSteps=15 loops safely |
| Tier resolution | TierResolver (Appendix D) | Prevents hallucinated model names |
| Animation | motion | Do not install framer-motion — v12 is published under motion |
| MCP transport | StreamableHTTP from side panel and Full App | EventSource unavailable in SW |
| Built-in tools | NowPilotMainServer (12) in each surface | Available without external server |
| AI calls location | Side panel or Full App only | SW ~30 s timeout kills streaming |
| Chat storage | IndexedDB via idb | 10 MB chrome.storage.local insufficient |
| Memory storage | Metadata in chrome.storage.local; bodies in MemoryDB | Split prevents 10 MB overflow |
| API key storage | chrome.storage.local + AES-GCM | Encrypted at rest |
| Session tokens | chrome.storage.session | Cleared on browser close |
| Token estimation | Provider-native counters; fallback 4 chars ≈ 1 token | Accurate; zero dependency |
| Note search | MiniSearch + bag-of-words cosine | No server, no model download |
| Embedding search | Deferred | 40 MB model download not justified |
| XSS protection | PortableMarkdown + DOMPurify | Eliminates innerHTML |
| Generic proxy | PROXY_FETCH in SW | Reusable across add-ons |
| Scheduler | chrome.alarms | Persists across SW restarts |
| In-panel messaging | EventBus | Avoids chrome.runtime overhead |
| Cross-context messaging | MessageBus + BroadcastBus + RuntimeEnvelope | Typed and sender-validated |
| Add-on settings isolation | AddonSettingsStore namespaced | Prevents key collisions |
| Keyboard shortcuts | KeymapRegistry | Conflict detection |
| Icons | @ant-design/icons v6 + motion | Consistent AntD ecosystem; v6 icon set includes provider marks |
| Options placement | Full App only | Side panel stays lightweight |
| Diagnostics placement | Full App → Options | Deep work surface |
| Notes placement | Full App only | Rich workspace needs full viewport |
| Cross-surface consistency | Same ThemeStore and WorkspaceStore | One product across two surfaces |
| **Phase ordering (Rev. B)** | **Knowledge-first data-flow** (acquire→store→understand→display→extend→harden) | Matches product value (Copilot + Obsidian + NotebookLM); PageContentService/Notes/LLM-Wiki are the core, not late add-ons |
| **PageContentService placement (Rev. B)** | **Phase 4a** (was Phase 8) | Core infrastructure (§26); consumers in every later phase |
| **Knowledge Base consolidation (Rev. B)** | Memory + MiniSearch + Notes + Wikilinks in **Phase 5** | One coherent knowledge layer before enrichment |
| **LLM-Wiki phase (Rev. B)** | **Phase 5a** (LLM enrichment + RAG + filesystem sync together) | Single shared save pipeline; depends on Phases 4a/5 |
| **Note enrichment (Rev. B)** | **Single haiku call** (tags+category+summary+memory facts) | Cheaper/faster than separate calls (D-01) |
| **Notes dual-friendly (Rev. B)** | **Markdown body + YAML frontmatter** | Human reads body; LLM/machine reads frontmatter (D-02) |
| **Category model (Rev. B)** | **Path-based `categoryPath` → folders**, separate from tags | 1:1 filesystem mapping; tags stay many-to-many (D-03) |
| **Notes↔Memory direction (Rev. B)** | **Notes → Memory only** | Notes are user-owned; memory is system-owned (D-05) |
| **Semantic search (Rev. B)** | **LLM-routed reranking over MiniSearch** (no embeddings) | No model download; sufficient for v0.1 |
| **Filesystem sync (Rev. B)** | **One-way app→FS + import-for-restore** | Backup use case; bidirectional deferred |
| **Backup handle storage (Rev. B)** | **`notes_backup_config` IndexedDB store** | FileSystemDirectoryHandle non-serializable (D-08) |
| **Persona (Rev. B)** | **PersonaProfile + PersonaInjector in Phase 3; config in PreferenceMemoryStore** | Persona-aware prompts from day one; user config ≠ inferred fact (R2) |
| **RICH implementation (Rev. B)** | **On Ant Design X presentation components, phased 7.3/7.4/7.5** | Reuses adopted stack; no new UI framework |
| **Host-page write-back (Rev. B)** | **Deferred (clipboard-only in v0.1)** | Extraction-only rule (§0.2); write-back needs v0.2+ injection (R1) |

**Removed ADRs from v0.1c (obsolete):** Tailwind v4 + np-* tokens; shadcn/ui; @radix-ui/react-*; Tweakcn HSL mapping; Shadow DOM injection via ContentScriptHost UI mount; split preflight CSS; portal isolation via ui-shadow/ wrappers; dark mode via .dark class. See §25.

## §24 — Verification Commands

Each phase must define a real script. Minimum expected commands in package.json:

```json
{
  "scripts": {
    "verify:phase-1":  "tsc --noEmit && vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme",
    "verify:phase-2":  "tsc --noEmit && vitest run tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts",
    "verify:phase-3":  "tsc --noEmit && vitest run tests/core/ai tests/core/ai/persona",
    "verify:phase-4":  "tsc --noEmit && vitest run tests/core/context",
    "verify:phase-4a": "tsc --noEmit && vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts",
    "verify:phase-5":  "tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts",
    "verify:phase-5a": "tsc --noEmit && vitest run tests/core/notes tests/core/storage/migrations",
    "verify:phase-6":  "tsc --noEmit && vitest run tests/core/telemetry tests/components/DiagnosticsSection.test.tsx",
    "verify:phase-7":  "tsc --noEmit && vitest run tests/hooks tests/components tests/components/rich tests/core/intent tests/core/notes",
    "verify:phase-8":  "tsc --noEmit && vitest run tests/core/content tests/addons tests/isolation",
    "verify:phase-9":  "tsc --noEmit && vitest run && pnpm run lint",
    "verify:all":      "tsc --noEmit && vitest run && pnpm run lint",
    "test:perf":       "vitest run tests/perf",
    "test:isolation":  "vitest run tests/isolation"
  }
}
```

`tests/isolation/no-content-script-ui.test.ts` greps the content-script bundle and rejects if it finds `antd`, `React`, `react-dom` — **and (Rev. B) `defuddle` or `yaml`, or any File System Access API usage.**

## §25 — Future Page Injection Architecture & Deferred UI Features

### §25.1 Why Deferred

Page injection was removed from v0.1 to reduce complexity, keep the content-script bundle small, and let cost-effective coding agents focus on the core AI runtime and two clean UI surfaces. It will be reintroduced in v0.2+ once the v0.1 baseline is stable.

### §25.2 What Was Intentionally Preserved

Add-on architecture (Addon, AddonRegistry, AddonSettingsStore); add-on lifecycle (IContextExtractor, ISkill, PromptTemplate, KeymapRegistration); content-script infra (ContentScriptHost extraction-only, SPANavigationWatcher, PageContextBridge, IContentStrategy, DefaultWebPageStrategy); ServiceNow add-on; global add-ons; cross-context messaging; CSP/permissions; test isolation harness.

### §25.3 What Would Be Required in v0.2+

- Shadow DOM UI runtime (mountShadow.ts, adoptedStyleSheets).
- Shared stylesheet loader; theme sheet builder.
- Injected UI component library using **Radix UI + Tailwind, NOT AntD**.
- IContentAddon render-mode contract.
- Content-script UI bundle (separate WXT entrypoint, React + Tailwind + Radix, < 100 KB gzipped).
- Portal isolation (PortalHostContext).
- Style-bleed test suite.
- First reintroduced add-on: CaseInsightBox for ServiceNow.
- **Host-page write-back (unblocks RICH-H-04 "Insert into page" + RICH-H-07 "Fill this field" — reconciliation R1).**
- Hard rule: "DO NOT import AntD into src/addons/** or the content-script UI bundle."

### §25.4 Recommended Reintroduction Plan

v0.2.0 planning (Shadow DOM addendum spec); Phase 10 (dual-bundle config, Tailwind, mountShadow); Phase 11 (Radix + PortalHostContext); Phase 12 (CaseInsightBox); Phase 13 (style-bleed tests + perf). Ship v0.2.0.

### §25.5 Hybrid Rule for Future

Side Panel + Full App continue to use AntD. Injected UI uses Tailwind + Radix, never AntD. ESLint rule: no-restricted-imports patterns ['antd','@ant-design/*'] for src/addons/** and src/components/ui-shadow/**.

### §25.6 @ant-design/x-card / A2UI — Deferred to v0.2+

**Why deferred:** JSON-generation difficulty mismatch — NowPilot's runtime keeps the JSON a Haiku/Flash model must emit small (PlannerDecisionSchema is a 3-branch union; StructuredOutput budgets one repair). A2UI's adjacency-list component trees + JSON-Pointer bindings are a much larger, error-prone target. New canonical types (Catalog, Surface, ActionPayload) would need Appendix C additions. Overlaps existing SkillResult card/table/checklist rendering.

**Preserved for future:** RendererService's structured-output rule (§1.2) and SkillResult.type 'card-grid'|'list' (§14.1) are stepping stones. @ant-design/x-card is antd/@ant-design/x-adjacent (same tokens, same XProvider), so only new Zod schemas + capability gate needed later.

**Reintroduction trigger:** v0.1 baseline stable AND a concrete feature need plain card/table rendering can't satisfy.

## §26 — PageContentService (Layered Page Extraction)

### §26.1 Principle

Page-content extraction is **core infrastructure**, not a tool (built in **Phase 4a**). A single PageContentService owns extraction for every surface (Chat, Agent, Summarize, /research, add-ons). It applies a **layered strategy**, caches per tab, redacts before use, and feeds ContextOptimizerInput.pageContext (§2.3).

### §26.2 Layered strategy (ordered)

```
extract(tabId, mode)
   │
   ├─ 1. ServiceNow record?  ── yes ─▶ ServiceNow add-on: Table API → SNowCaseData   [API-FIRST, §9.7]
   │
   ├─ 2. mode = 'default' (read/summarize)
   │        └─▶ DefuddleStrategy  → clean Markdown (main content)          [PRIMARY read path]
   │             └─ low confidence? → Readability fallback
   │
   └─ 3. mode = 'actionable' (Agent needs structure/interaction)
            └─▶ ApcLiteStrategy   → APCLiteNode tree (roles, geometry, interaction)
```

- **DefuddleStrategy** is the default for reading/summarizing.
- **ApcLiteStrategy** is used when the Agent needs structure (forms, tables, clickable/editable elements, node ids + geometry) — the substrate for future v2 automation (§26.7).
- **ServiceNow** always tries the Table API first (§9.7); extraction is fallback only.

### §26.3 Strategy contract

```ts
export interface IExtractionStrategy {
  id: 'defuddle' | 'apc-lite' | 'servicenow-api';
  canHandle(input: { url: string; mode: 'default' | 'actionable' }): boolean;
  run(input: StrategyInput): Promise<StrategyResult>; // → markdown and/or APCLiteNode tree
}
```

### §26.4 Content-bundle constraint (critical)

Defuddle is **not** bundled into the content script (would break the < 50 KB extraction-only bundle, §22.1, §5.6). Instead:

```
Content script (tiny):  outerHTML (or targeted subtree)  ──RuntimeEnvelope──▶ Side Panel / Full App
Side Panel / Full App:  DOMParser → new Defuddle(doc).parse()  → markdown → PageContext
```

The content script only reads/serializes HTML; **Defuddle parsing runs in the side panel / full app**. Preserves the isolation rule (§5.6) and the 50 KB cap (§22.1).

### §26.5 MiniSearch integration (retrieval-augmented context)

- After extraction, PageIndexBuilder builds an **ephemeral** MiniSearch index (core engine) over the extracted content (Defuddle markdown chunked by heading, or APC-lite text nodes).
- When extracted tokens exceed the **2,000-token webpage budget** (§22.2), inject only selectRelevant(query) results and mark compressionApplied:'topk' in the provenance manifest (§2.6).
- Minimal mode (§2.5) always routes through selectRelevant.
- Page indexes are ephemeral — **never persisted** to IndexedDB.

> **Rev. B link to §27:** the same core MiniSearch engine powers *two distinct index instances* — the **ephemeral page index** (§26) and the **persistent notes index** (§27). They never share storage. A page can be captured → converted to a note (Flow 12) → indexed into the persistent notes index for future RAG (Flow 13).

### §26.6 Reliability & privacy

- **Concurrency guard:** coalesce duplicate extractions per tab.
- **Timeout:** 5 s hard cap (§13); on failure fall back (Defuddle→Readability, AX→DOM) and record source.
- **Invalidation:** SPANavigationWatcher (wxt:locationchange) + tabs.onUpdated.
- **Redaction:** run TraceRedactor-style redaction **before** indexing or logging (§4.4, §16).
- **Passwords:** field values never captured (isPassword ⇒ value omitted).
- **Metrics:** duration, node/char count, source, truncation → Diagnostics (§4.5).

### §26.7 Browser automation — deferred to v2

NowPilot v0.1 is **read-only**: content scripts are extraction-only (§5.6); the Agent acts through tools/APIs (§10.5), never by driving the host-page UI. Genuine automation (click/type/navigate) needs **trusted input events** (event.isTrusted), which only chrome.debugger + CDP Input can produce. v0.1/v0.2: no host-page automation, no "debugger" permission. **v2:** add "debugger", a DebuggerSession manager, and automation tools (clickElement/typeText/navigate) resolving a stable APCLiteNode.id → geometry → Input.dispatchMouseEvent. The APCLiteNode schema (Appendix C) is already automation-ready — no schema rework. A separate v2 Automation addendum spec must be ratified first.

### §26.8 Reference projects (informative, non-normative)

- **Defuddle** (kepano, MIT) — adopted as the DefuddleStrategy engine.
- **google/llm-sidebar-with-context** (Apache-2.0) — pattern reference only (not forked). Borrow tab-pinning UX (our cap 10 vs their 6) and site-specific extraction strategies as a model for our add-on IContextExtractor pattern.

## §27 — LLM-Wiki & Filesystem Sync (NEW in Rev. B)

**Built in Phase 5a.** Requires Phase 5 (Notes + Memory + MiniSearch), Phase 4a (PageContentService), Phase 3 (AI runtime). Extends the atomic-note-with-wikilinks system with LLM enrichment, a hierarchical category system that maps to filesystem folders, RAG Q&A, chat/page-to-note capture, Memory↔Notes integration, and one-way app→filesystem backup with import-for-restore.

**Surfaces affected:** Full App (all features + Options); Side Panel (`ChatMessage` "Save to note" only). **Not touched:** BacklinksPanel, NoteGraphView, WikilinkAutocomplete, NotePreview — the atomic-note + wikilink core is preserved unchanged.

### §27.1 Category System (CAT-01…05)

- **CAT-01** Path-based `categoryPath` (e.g. `InfoTech/Database/MySQL`), `/` separator, no leading/trailing slashes; segments normalized (no empty, no `.`/`..`, trim).
- **CAT-02** NoteList tree view grouped by category; "Uncategorized" node; click node → flat list within category.
- **CAT-03** LLM suggests a category path during auto-tagging (LLM receives existing distinct category paths + note content). User accept/edit/dismiss.
- **CAT-04** On backup, a note at `InfoTech/Database/MySQL` saves as `InfoTech/Database/MySQL/Note Title.md`; nested folders auto-created.
- **CAT-05** Normalize on save (strip leading/trailing slashes, collapse duplicates, trim segments); invalid segments flagged (AntD red border).

### §27.2 LLM Features (LLM-WIKI-01…10)

- **LLM-WIKI-01** On save, one **haiku-tier, temperature-0** call returns ≤5 tags + 1 categoryPath (or null) + a 1–2 sentence summary (+ memory facts, MEM-02). Rendered as accept/reject Tags + inline category input.
- **LLM-WIKI-02** Independent toggles in Options → Notes (`np_notes_llm_features`: autoTag, autoCategorize, autoSummary, aiSearch). When off, no LLM call on save.
- **LLM-WIKI-03** Optional `summary` field; displayed as secondary text in NoteList.
- **LLM-WIKI-04** "Regenerate tags/summary" toolbar button; re-runs the combined call in place.
- **LLM-WIKI-05** Natural-language search: MiniSearch fuzzy → if <3 results or "AI Search", a haiku call reranks top-10 by semantic relevance ("AI-enhanced" indicator). No embeddings/vector store.
- **LLM-WIKI-06** "Ask your notes" RAG: MiniSearch top-5 + memory facts (MEM-01) → **flash-tier** synthesis with per-statement citations → ephemeral @ant-design/x Bubble with clickable citation Tags (Flow 13).
- **LLM-WIKI-07** "Save to note" on any assistant message → `NoteChatConverter` drafts title/content/tags/wikilinks/categoryPath → pre-filled NoteEditor for review (user is gatekeeper).
- **LLM-WIKI-08** Staleness: `summaryGeneratedAt`/`tagsGeneratedAt` vs `updated` → subtle "Content has changed — [Regenerate tags/summary]" hint.
- **LLM-WIKI-09** Orphan detection (algorithmic, no LLM): 0 wikilinks + 0 backlinks → "Orphan" badge + "Find context" (triggers RAG).
- **LLM-WIKI-10** "Re-analyze all notes" (Options → Notes), user-initiated only, sequential; updates stats in real time.

### §27.3 One-Way Filesystem Sync (SYNC-01…11)

- **SYNC-01** "Set backup folder" via `showDirectoryPicker()` (**Full App only**); FileSystemDirectoryHandle persisted in `notes_backup_config` IndexedDB store (cannot use chrome.storage.local — handles are non-serializable).
- **SYNC-02** On NotesPage mount, verify `handle.queryPermission()`; if denied/missing → sync disabled + banner "Backup folder not accessible. [Re-select folder] [Dismiss]".
- **SYNC-03** Per-save write/update/delete of the `.md` file; fire-and-forget (no loading state); 50 ms debounce prevents rapid-save bursts.
- **SYNC-04** File format: `{categoryPath}/{title}.md` with YAML frontmatter (`id, created, updated, tags, categoryPath, summary`) + markdown body. Empty categoryPath → root folder. Filename sanitized: `/ \ : * ? " < > |` → `_`.
- **SYNC-05** Title collision (same title + same category) → numeric suffix: `My Note.md`, `My Note (1).md`, … Scan existing files for highest suffix before writing.
- **SYNC-06** External-change detection: if file lastModified newer than last sync (2 s tolerance) → confirm "Overwrite with app version? [Overwrite] [Skip]", default Skip.
- **SYNC-07** No backup folder → all sync ops are no-ops; toolbar indicator "Backup: off [Configure]".
- **SYNC-08** Status Tag: green "Backup: On" / gray "Backup: Off" / red "Backup: Error" (tooltip shows last error).
- **SYNC-09** "Restore from backup" via `showDirectoryPicker()` → walk tree → parse `.md` frontmatter → upsert: id exists → update (preserve updated if newer); id missing → create; additive (notes not in folder are NOT deleted); categoryPath reconstructed from folder path.
- **SYNC-10** Restore preview modal: "Found 24 notes (12 new, 3 updated, 9 unchanged). Proceed? [Import] [Cancel]".
- **SYNC-11** Delete-on-sync: deleting a note removes its `.md`; if the nested category folder becomes empty it is removed (clean backup).

### §27.4 Memory ↔ Notes Integration (MEM-01…03)

- **MEM-01** Memory-aware RAG: "Ask notes" retrieval also queries MemoryEngine for relevant user facts/preferences; highly relevant facts are included as context alongside note snippets.
- **MEM-02** On save, the same LLM call extracts memory-worthy facts (MemoryExtractor schema) → routed through MemoryEngine for conflict resolution + storage. **Notes → Memory only** (D-05). Runs on the primary surface only (§13).
- **MEM-03** "Save from chat" (LLM-WIKI-07) uses conversation messages AND `MemoryEngine.assemble()` facts to produce a richer draft.

### §27.5 New Core Services

| File | Role |
|---|---|
| src/core/notes/NoteTagger.ts | LLM call: analyzes note content → tags + category + summary + memory facts |
| src/core/notes/NoteQA.ts | RAG Q&A: MiniSearch retrieval + memory context + LLM synthesis + citations |
| src/core/notes/NoteChatConverter.ts | Converts chat/page (with memory context) → structured note drafts |
| src/core/notes/NoteFileSync.ts | One-way sync: manages FileSystemDirectoryHandle, writes/reads/deletes .md, permissions, folder tree |
| src/core/notes/NoteMaintenance.ts | Staleness detection, orphan detection, bulk analysis coordinator |

### §27.6 Reliability & Privacy

TraceRedactor-style redaction runs **before** indexing, logging, or writing to disk. Password values are never written. Filesystem paths and note content are redacted from Diagnostics/exports. Page indexes and RAG answers are ephemeral (never persisted).

### §27.7 Note-Taking Method (clarification)

The method is **atomic notes + wikilinks** (the Phase 5 core), *extended* by LLM-Wiki with: `categoryPath` (single hierarchy → folder), `tags` (many-to-many labels), and an LLM `summary` (glanceable context). Wikilinks remain the primary linking mechanism and live inside the markdown body, so the atomic-note graph is fully reconstructable on restore. LLM wikilink *autocomplete* suggestions are **not** in v0.1 (D-04; MiniSearch title matching is sufficient) — but chat/page-to-note conversion (LLM-WIKI-07) still *suggests* wikilinks for the drafted note.

### §27.8 Decisions

| # | Decision | Rationale |
|---|---|---|
| D-01 | Single LLM call for tags + category + summary | One haiku call is cheaper/faster than three; structured JSON returns all three |
| D-02 | Notes dual-friendly: human body, machine frontmatter | Body is natural markdown; YAML frontmatter is structured metadata; both consumers served by one file |
| D-03 | Category path-based, not flat | categoryPath maps 1:1 to folders; flat tags already cover many-to-many |
| D-04 | LLM wikilink suggestions dropped from v0.1 | MiniSearch covers title-based matching; edge case rare |
| D-05 | Notes feed into MemoryEngine, not the reverse | Notes are user-curated; extracting facts enriches chat context without polluting notes |
| D-06 | Maintenance is user-initiated | No background jobs in MV3; staleness is passive timestamp comparison |
| D-07 | Haiku for analysis, Flash for synthesis | Tag/category/summary is low-complexity (Haiku); RAG synthesis benefits from Flash |
| D-08 | Backup handle in IndexedDB | FileSystemDirectoryHandle is non-serializable; dedicated store required |

### §27.9 Out of Scope (v0.1)

Bidirectional filesystem sync (requires polling/Native Messaging) · embedding-based vector search · LLM wikilink autocomplete · real-time collaborative editing · filesystem as primary note store · image/file attachments in notes · auto-create notes from chat unprompted.

### §27.10 UX Flow Summary

- **Daily writing:** write & save → tags+category+summary auto-suggested → review/accept → indexed + memory facts extracted → `.md` silently written to `BackupFolder/{categoryPath}/{title}.md`.
- **Research:** type "how do I deploy to staging?" in Ask notes → MiniSearch 5 + memory 2 → LLM synthesizes cited answer → click citation → navigate to note.
- **Chat-to-note:** assistant gives instructions → "…" → "Save to note" → LLM drafts title/tags/wikilinks with conversation + memory context → NoteEditor pre-filled → review → save.
- **Restore:** new device/cleared IndexedDB → Options → Import/Export → Restore from folder → preview → import (category structure preserved).
- **Backup (normal):** set folder once → every save auto-writes → green "Backup: On" → permission lost → red → re-select.

## Appendix A — Canonical Prompt Constants

```ts
// src/core/prompts/index.ts
export const PROMPTS = {
  planner: {
    system: 'Select exactly one action: answer, run_tool, or ask_clarification. Return JSON only. Do not explain.',
    cacheable: true,
    tier: 'haiku',
  },
  renderer: {
    system: 'Answer using only the provided context and tool result. Be concise. If data is missing, say what is missing. Do not invent facts.',
    cacheable: true,
    tier: 'flash',
  },
  memoryExtractor: {
    system: 'Extract durable user memory. Store only stable facts, preferences, or repeated patterns. Do not store secrets or raw customer data. Return JSON only.',
    cacheable: true,
    tier: 'haiku',
  },
  conversationSummarizer: {
    system: 'Summarise prior conversation into compact durable context. Preserve decisions, preferences, open tasks, and unresolved questions. Return plain text summary only.',
    cacheable: true,
    tier: 'haiku',
  },
  repairJson: {
    system: 'Repair the previous output into valid JSON matching the provided schema. Return JSON only.',
    cacheable: true,
    tier: 'haiku',
  },
  titleGen: {
    system: 'Summarize this message as a 3-6 word title. Reply with the title only, no quotes.',
    cacheable: false,
    tier: 'haiku',
  },
  // --- Rev. B — LLM-Wiki (§27) ---
  noteTagger: {
    system: 'Analyze the note title and content. Return JSON only: {tags:string[<=5], categoryPath:string|null, summary:string, memoryFacts:string[]}. categoryPath uses "/" separators and should reuse an existing path when suitable. Do not invent facts. Do not include secrets.',
    cacheable: true,
    tier: 'haiku',
  },
  noteQA: {
    system: 'Answer the question using ONLY the provided note snippets and user memory facts. Cite each statement with its source note title. If the notes do not contain the answer, say so. Return concise markdown with inline citations.',
    cacheable: true,
    tier: 'flash',
  },
  noteChatConvert: {
    system: 'Convert the conversation excerpt into a structured knowledge note. Return JSON only: {title:string, content:string(markdown), tags:string[<=5], categoryPath:string|null, wikilinks:string[]}. Extract durable knowledge; omit chit-chat. Do not include secrets.',
    cacheable: true,
    tier: 'haiku',
  },
  // --- Rev. B — RICH (§17.7) ---
  clarify: {
    system: 'The user request is ambiguous. Ask ONE focused clarifying question, then list 2-4 concrete options. Return JSON only: {question:string, options:string[]}. Do not answer the request yet.',
    cacheable: true,
    tier: 'haiku',
  },
  followUpSuggest: {
    system: 'Given the assistant answer, propose 1-3 short next-step suggestions the user might tap. Return JSON only: {suggestions:string[]}. Each <= 6 words. If none are useful, return {suggestions:[]}.',
    cacheable: true,
    tier: 'haiku',
  },
} as const;
```

> **Rev. B note:** the persona block (RICH-R-02) is prepended to the `planner`, `renderer`, `memoryExtractor`, `noteTagger`, `noteQA`, and `noteChatConvert` system strings by `PersonaInjector.inject()` at request time. Do **not** hard-code persona text into these constants — keep them byte-stable for prompt caching (§1.3).

## Appendix B — Canonical User Strings

```ts
// src/core/i18n/strings.ts
export const STR = {
  chat: {
    loading: 'Connecting to provider...',
    empty: 'Start a conversation',
    errorRetry: 'Provider error. [Retry] [Switch Provider]',
    offline: 'No network. Retrying when back online.',
    contextReduced: 'Some context was compressed to fit the selected model.',
    minimalMode: 'Minimal mode enabled for this model context size.',
    noProvider: 'Configure an AI provider in Settings first.',
    maxPinnedTabs: 'Maximum 10 pinned tabs. Remove one first.',
    cannotPin: 'Cannot pin this page. Try a regular web page.',
  },
  diagnostics: {
    title: 'Diagnostics',
    copyOperationId: 'Copy operation ID',
    exportDebugBundle: 'Export debug bundle',
    noTransactions: 'No AI transactions yet.',
    loading: 'Loading diagnostics...',
  },
  tools: {
    rejected: 'Tool is not available or input schema is invalid.',
    permissionDenied: 'Tool permission denied.',
    researchNoTool: 'Research failed: no web-search tool connected. [Open Settings]',
  },
  memory: {
    updated: 'Memory updated.',
    disabled: 'Memory is disabled in Settings.',
  },
  onboarding: {
    testing: 'Testing connection...',
    connected: 'Connected',
    failed: 'Connection failed: [error]',
  },
  notes: {
    loading: 'Loading notes...',
    empty: 'No notes yet. Press + to create one.',
    loadFailed: 'Failed to load notes. [Retry]',
    // --- Rev. B — LLM-Wiki (§27) ---
    askPlaceholder: 'Ask a question about your notes',
    askLoading: 'Searching your notes...',
    askEmpty: 'No relevant notes found. Try rephrasing.',
    askError: "Couldn't answer from notes. [Retry]",
    backupOn: 'Backup: On',
    backupOff: 'Backup: Off',
    backupError: 'Backup: Error',
    backupConfigure: 'Configure',
    backupBannerLost: 'Backup folder not accessible. [Re-select folder] [Dismiss]',
    restorePreview: 'Found [n] notes ([new] new, [updated] updated, [unchanged] unchanged). Proceed?',
    externalChange: 'This file was modified externally. Overwrite with app version? [Overwrite] [Skip]',
    stale: 'Content has changed — [Regenerate tags/summary]',
    orphan: 'Orphan',
    taggerFailed: "Couldn't analyze — [Retry]",
    reanalyzeAll: 'Re-analyze all notes',
  },
  agent: {
    loading: 'Preparing agent...',
    empty: 'Describe a task and the agent will plan steps',
    error: 'Agent error: [message]. [Retry]',
    working: 'NowPilot is working...',           // Rev. B — RICH-H-03
  },
  fullApp: {
    openTitle: 'Open Full App',
    opening: 'Opening full app...',
    openFailed: 'Failed to open Full App tab',
    minWidth: 'This view is optimized for wider screens; open the side panel for narrow layouts.',
  },
  workspace: {
    handoffPending: 'Opening workspace in full app...',
    handoffComplete: 'Workspace opened in full app.',
    mirroringNotice: 'Full App is now the primary surface for this workspace.',
    electionFailed: 'Could not coordinate between surfaces. Reload to retry.',
  },
  options: {
    providers: 'Providers',
    models: 'Models',
    mcp: 'MCP Servers',
    prompts: 'Prompt Templates',
    slash: 'Slash Commands',
    memory: 'Memory',
    diagnostics: 'Diagnostics',
    importExport: 'Import / Export',
    featureFlags: 'Feature Flags',
    addonSettings: 'Add-on Settings',
    persona: 'Persona',           // Rev. B
    notes: 'Notes',               // Rev. B
    about: 'About',
  },
  // --- Rev. B — RICH (§17.7) ---
  rich: {
    personaTagline: 'NowPilot — Your ServiceNow support co-pilot',
    welcomeTitle: 'What can I help you with?',
    clarifyPrefix: 'Quick question:',
    followUpLabel: 'Follow up',
    closureAsk: 'Did this help?',
    closureMore: 'Anything else?',
    stageReading: 'Reading page context...',
    stagePlanning: 'Planning response...',
    stageGenerating: 'Generating...',
    stageSlow: 'Still working...',
    insertCopiedToClipboard: 'Copied to clipboard (in-page insert available in a future version).',
  },
} as const;
```

## Appendix C — Canonical Type Registry (MANDATORY)

Every type here is the single source of truth.

```ts
// src/core/runtime/RuntimeEnvelope.ts
export interface RuntimeEnvelope<T = unknown> {
  id: string;
  type: MessageTypeValue;
  createdAt: number;
  source: 'sidepanel' | 'background' | 'content' | 'addon' | 'full-app';
  target?: 'sidepanel' | 'background' | 'content' | 'addon' | 'full-app';
  payload: T;
}
export type ResponseEnvelope<T = unknown> =
  | { id: string; ok: true;  data: T }
  | { id: string; ok: false; error: { code: string; message: string; retryable: boolean } };
```

```ts
// src/core/ai/types.ts
export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openai-compatible';
export interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  imageUrl?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
}
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
}
export interface LLMOptions {
  model: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: BuiltinTool[];
  abortSignal?: AbortSignal;
}
export interface LLMStreamChunk {
  type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error';
  content: string;
  toolName?: string;
  toolInput?: unknown;
}
export interface ModelInfo {
  id: string;
  label: string;
  contextWindow: number;
  supportsTools: boolean;
  group: 'local' | 'cloud';
}
export interface ProviderConfig {
  id: ProviderId;
  label: string;
  apiKey?: string;
  baseURL: string;
  customBaseURL?: string;
  models: string[];
  contextWindow: number;
  supportsTools: boolean;
  enabled: boolean;
  priority: number;
  lastValidated?: number;
}
```

```ts
// src/core/content/PageContext.ts
export interface PageContext {
  url: string;
  origin: string;
  hostname: string;
  title: string;
  html?: string;
  markdown?: string;
  meta: Record<string, string>;
  extractedAt: number;
  addonId?: string;
  addonFields?: Record<string, unknown>;
}
export interface TabContext {
  tabId: number;
  windowId: number;
  page: PageContext;
  pinnedAt?: number;
}
export interface SNowCaseData {
  caseId: string;
  number: string;
  shortDescription: string;
  description: string;
  state: string;
  priority: string;
  assignedTo?: string;
  openedAt: number;
  updatedAt: number;
  latestComments: Array<{ author: string; body: string; at: number }>;
  workNotes: Array<{ author: string; body: string; at: number }>;
}
export interface FileContext {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  textPreview?: string;
}
export interface NoteContext {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
  score: number;
}
```

```ts
// src/core/extraction/apcLite.types.ts
import { z } from 'zod';
// Raw content-script output BEFORE normalization (small, serializable over RuntimeEnvelope).
export interface RawNode {
  id: string; role: string; type?: string; text?: string;
  geometry?: { x: number; y: number; width: number; height: number; inViewport: boolean };
  interaction?: Record<string, boolean | undefined>;
  link?: { href: string; rel?: string };
  image?: { alt?: string; src?: string };
  form?: { control?: { fieldName?: string; fieldType?: string; value?: string; isPassword?: boolean } };
  iframe?: { origin: string; crossOrigin: boolean };
  children?: RawNode[];
}
export const GeometrySchema = z.object({
  x: z.number(), y: z.number(), width: z.number(), height: z.number(), inViewport: z.boolean(),
});
export const InteractionSchema = z.object({
  clickable: z.boolean().optional(), editable: z.boolean().optional(), focusable: z.boolean().optional(),
  disabled: z.boolean().optional(), expanded: z.boolean().optional(),
});
// INVARIANT: password value MUST be omitted (privacy, §16 / §0.2).
export const FormControlSchema = z.object({
  fieldName: z.string().optional(), fieldType: z.string().optional(),
  value: z.string().optional(), isPassword: z.boolean().optional(),
}).refine(c => !(c.isPassword && c.value !== undefined), 'password value must be omitted');
export type APCLiteNode = {
  id: string; domNodeId?: number; role: string; type?: string; text?: string;
  textStyle?: { level?: number; emphasis?: boolean; size?: number };
  geometry?: z.infer<typeof GeometrySchema>;
  interaction?: z.infer<typeof InteractionSchema>;
  link?: { href: string; rel?: string };
  image?: { alt?: string; src?: string; origin?: string };
  form?: { name?: string; control?: z.infer<typeof FormControlSchema> };
  iframe?: { origin: string; crossOrigin: boolean };
  children?: APCLiteNode[];
};
export const APCLiteNodeSchema: z.ZodType<APCLiteNode> = z.lazy(() => z.object({
  id: z.string(), domNodeId: z.number().optional(), role: z.string(), type: z.string().optional(),
  text: z.string().optional(),
  textStyle: z.object({ level: z.number().optional(), emphasis: z.boolean().optional(), size: z.number().optional() }).optional(),
  geometry: GeometrySchema.optional(), interaction: InteractionSchema.optional(),
  link: z.object({ href: z.string(), rel: z.string().optional() }).optional(),
  image: z.object({ alt: z.string().optional(), src: z.string().optional(), origin: z.string().optional() }).optional(),
  form: z.object({ name: z.string().optional(), control: FormControlSchema.optional() }).optional(),
  iframe: z.object({ origin: z.string(), crossOrigin: z.boolean() }).optional(),
  children: z.array(APCLiteNodeSchema).optional(),
}));
export const APCLiteDocumentSchema = z.object({
  url: z.string(), title: z.string(), extractedAt: z.number(),
  source: z.enum(['dom', 'ax', 'hybrid', 'servicenow-api', 'defuddle', 'readability']),
  root: APCLiteNodeSchema,
  stats: z.object({ nodeCount: z.number(), approxTokens: z.number(), durationMs: z.number(), truncated: z.boolean() }),
});
export type APCLiteDocument = z.infer<typeof APCLiteDocumentSchema>;
```

```ts
// src/core/prompts/types.ts
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  slash?: string;
  variables: Array<{
    name: string;
    kind: 'string' | 'number' | 'enum';
    values?: string[];
    default?: string | number;
    required: boolean;
  }>;
  systemTemplate: string;
  userTemplate: string;
}
export interface Macro {
  id: string;
  name: string;
  description: string;
  steps: Array<
    | { type: 'skill';    skillId: string;    input: Record<string, unknown> }
    | { type: 'mcp';      toolName: string;   input: Record<string, unknown> }
    | { type: 'save-note';titleTemplate: string }
  >;
}
```

```ts
// src/core/input/KeymapRegistry.ts
export interface KeymapRegistration {
  id: string;
  when?: 'always' | 'in-composer' | 'in-note' | 'in-side-panel' | 'in-full-app';
  combo: string;
  description: string;
  handlerId: string;
}
```

```ts
// src/core/registry/SidePanelPageRegistry.ts
export interface SidePanelPageRegistration {
  id: string;
  label: string;
  icon: string;
  urlPatterns?: string[];
  component: React.ComponentType;
  order: number;
}
// src/core/registry/FullAppPageRegistry.ts   [NEW]
export interface FullAppPageRegistration {
  id: string;
  label: string;
  icon: string;
  routePath: string;
  component: React.ComponentType;
  order: number;
  showInSider?: boolean;
  addonId?: string;
}
```

```ts
// src/core/workspace/WorkspaceStore.ts   [NEW]
export type ActiveSurface = 'sidepanel' | 'full-app';
export interface WorkspaceState {
  workspaceId: string;
  conversationId: string;
  activeProvider?: ProviderId;
  selectedModel?: string;
  pinnedTabs: TabContext[];
  currentPageContext?: PageContext;
  selectedNotes: string[];
  activeAddonContext?: {
    addonId: string;
    contextKey: string;
    payload: unknown;
  };
  activeSkillRun?: {
    skillId: string;
    operationId: string;
    startedAt: number;
    status: 'running' | 'completed' | 'failed' | 'aborted';
  };
  activeSurface: ActiveSurface;
  openedFullAppTabId?: number;
  version: number;
  updatedAt: number;
}
```

```ts
// src/core/config/FeatureFlags.ts
export interface FeatureFlags {
  research: boolean;
  webhooks: boolean;
  insights: boolean;
  tts: boolean;
  serviceNowAddon: boolean;
  writeAddon: boolean;
  teamGqmAddon: boolean;
  llmWiki: boolean;          // NEW Rev. B — master toggle for §27 LLM features
  filesystemSync: boolean;   // NEW Rev. B — master toggle for §27 backup/restore
}
```

```ts
// src/core/mcp/MCPRegistry.ts
export interface MCPServerConfig {
  id: string;
  label: string;
  url: string;
  authHeader?: string;
  enabled: boolean;
  autoConnect: boolean;
  lastConnectedAt?: number;
}
```

```ts
// src/core/memory/types.ts
export interface RetrievedMemory {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'pattern';
  tags: string[];
  score: number;
}
export interface UserPreferences {
  responseStyle: 'concise' | 'balanced' | 'detailed';
  preferredLanguage: string;
  preferStructuredOutput: boolean;
  allowCloudFallbackFromLocal: boolean;
  defaultProviderId?: ProviderId;
  toolAutonomy: 'ask_every_time' | 'allow_safe_tools' | 'manual_only';
  defaultSurface: 'sidepanel' | 'full-app';
  themeMode: 'light' | 'dark' | 'auto';
  // --- Rev. B — RICH persona (reconciliation R2: user config, NOT a fact) ---
  personaId?: string;
  personaOverrides?: {
    name?: string;
    tone?: 'professional-warm' | 'concise' | 'friendly';
    brevity?: 'brief' | 'balanced' | 'detailed';
  };
}
```

```ts
// src/core/ai/toolSchemas.ts
export interface ToolSchemaRef {
  name: string;
  description: string;
  jsonSchema: unknown;
  dangerous: boolean;
  source: 'builtin' | 'mcp' | 'skill' | 'servicenow';
}
```

```ts
// src/core/context/ContextOptimizer.ts
export interface PromptSection {
  kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input';
  text: string;
  tokens: number;
  stable: boolean;
  sourceId: string;
}
```

```ts
// src/core/storage/WriteJournal.ts
export interface WriteJournalEntry {
  id: string;
  operation: WriteJournalOperation;
  status: 'pending' | 'applying' | 'completed' | 'failed' | 'rolled-back';
  createdAt: number;
  updatedAt: number;
  attempts: number;
  targetIds: Record<string, string>;
  steps: Array<{
    name: string;
    status: 'pending' | 'completed' | 'failed';
    error?: string;
  }>;
}
```

```ts
// src/types/messages.ts
export interface ProxyFetchRequest {
  type: 'PROXY_FETCH';
  addonId: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  credentials?: 'include' | 'omit';
}
export interface ProxyFetchResponse {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}
```

```ts
// src/core/extraction/IContentStrategy.ts
export interface IContextExtractor {
  id: string;
  supports(url: string): boolean;
  extract(document: Document): Promise<PageContext>;
}
```

```ts
// src/core/extraction/IExtractionStrategy.ts
import type { APCLiteNode } from './apcLite.types';
export interface StrategyInput {
  url: string; title: string; mode: 'default' | 'actionable';
  html?: string;   // present for DefuddleStrategy (default/read mode)
  raw?: RawNode;   // present for ApcLiteStrategy (actionable mode)
}
export interface StrategyResult {
  source: 'defuddle' | 'readability' | 'apc-lite' | 'servicenow-api';
  markdown?: string;      // prose path (Defuddle/Readability)
  root?: APCLiteNode;     // structural path (APC-lite)
  meta?: Record<string, string>;
  approxTokens: number;
  truncated: boolean;
}
export interface IExtractionStrategy {
  id: StrategyResult['source'];
  canHandle(i: { url: string; mode: 'default' | 'actionable' }): boolean;
  run(i: StrategyInput): Promise<StrategyResult>;
}
```

```ts
// src/types/addon.ts   [UPDATED — replaces v0.1c IContentAddon]
export interface Addon {
  id: string;
  name: string;
  scope: 'site' | 'global';
  urlPatterns?: string[];
  contextExtractor?: IContextExtractor;
  skills?: ISkill[];
  prompts?: PromptTemplate[];
  sidePanelPages?: SidePanelPageRegistration[];   // [UPDATED]
  fullAppPages?: FullAppPageRegistration[];       // [NEW]
  addonSettings?: z.ZodSchema<unknown>;
  keymap?: KeymapRegistration[];
}
```

```ts
// src/types/notes.ts   [NEW Rev. B — §27 / §21.2]
export interface Note {
  id: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  tags: string[];
  links: string[];
  source: { kind: 'manual'|'voice'|'chat-export'|'template'|'page-export'; conversationId?: string; templateId?: string };
  aiMeta: {
    suggestedLinks: Array<{ targetId: string; confidence: number; reason: string }>;
    concepts: string[];
    lastWikiRunAt?: number;
  };
  summary?: string;
  categoryPath?: string;
  summaryGeneratedAt?: number;
  tagsGeneratedAt?: number;
  version: number;
}
export const NoteTagResultSchema = z.object({
  tags: z.array(z.string()).max(5),
  categoryPath: z.string().nullable(),
  summary: z.string(),
  memoryFacts: z.array(z.string()).default([]),
});
export type NoteTagResult = z.infer<typeof NoteTagResultSchema>;
export const NoteQAResultSchema = z.object({
  answer: z.string(),
  citations: z.array(z.object({ noteId: z.string(), title: z.string(), snippet: z.string() })),
});
export type NoteQAResult = z.infer<typeof NoteQAResultSchema>;
export const NoteDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()).max(5),
  categoryPath: z.string().nullable(),
  wikilinks: z.array(z.string()).default([]),
});
export type NoteDraft = z.infer<typeof NoteDraftSchema>;
export type NoteSyncState =
  | { state: 'off' }
  | { state: 'on'; folderName: string; lastSyncAt: number; noteCount: number }
  | { state: 'syncing'; noteId: string }
  | { state: 'error'; code: 'PERMISSION_REVOKED' | 'WRITE_FAILED' | 'PICKER_ABORTED'; message: string };
```

```ts
// src/types/persona.ts   [NEW Rev. B — §17.7 / §21.6]
import { z } from 'zod';
export const PersonaProfileSchema = z.object({
  id: z.string().min(1),
  identity: z.object({
    name: z.string().min(1).max(40),
    tagline: z.string().min(1).max(120),
    domain: z.string().min(1).max(200),
  }),
  personalityCore: z.array(z.string()).min(1).max(8),
  behavioralDrivers: z.array(z.string()).max(8),
  languageStyle: z.object({
    tone: z.enum(['professional-warm', 'concise', 'friendly']),
    vocabulary: z.string().max(120),
    brevity: z.enum(['brief', 'balanced', 'detailed']),
  }),
  emotionalRepertoire: z.array(z.string()).max(8),
});
export type PersonaProfile = z.infer<typeof PersonaProfileSchema>;
```

## Appendix D — Tier → Model Resolver Table

```ts
// src/core/ai/TierResolver.ts
import type { ProviderId } from './types';
export type ModelTier = 'haiku' | 'flash';
export interface TierCandidate {
  providerId: ProviderId;
  model: string;
}
export const TIER_TO_MODEL_CANDIDATES: Record<ModelTier, TierCandidate[]> = {
  haiku: [
    { providerId: 'anthropic',         model: 'claude-haiku-4-latest' },
    { providerId: 'openai-compatible', model: 'deepseek-chat' },
    { providerId: 'ollama',            model: 'llama3.2:3b' },
  ],
  flash: [
    { providerId: 'gemini',            model: 'gemini-2.5-flash' },
    { providerId: 'anthropic',         model: 'claude-haiku-4-latest' },
    { providerId: 'openai-compatible', model: 'deepseek-chat' },
    { providerId: 'ollama',            model: 'qwen2.5:7b' },
  ],
} as const;
export interface TierResolveInput {
  tier: ModelTier;
  configuredProviders: Array<{ id: ProviderId; models: string[]; enabled: boolean; priority: number }>;
  privacyMode: 'local-only' | 'prefer-local' | 'cloud-ok';
}
export interface TierResolveResult {
  providerId: ProviderId;
  model: string;
  fallbackChain: TierCandidate[];
}
export function resolveTier(input: TierResolveInput): TierResolveResult | null {
  const candidates = TIER_TO_MODEL_CANDIDATES[input.tier].filter(c => {
    if (input.privacyMode === 'local-only') return c.providerId === 'ollama' || c.providerId === 'openai-compatible';
    return true;
  });
  const enabled = input.configuredProviders.filter(p => p.enabled).sort((a, b) => a.priority - b.priority);
  const chosen: TierCandidate[] = [];
  for (const c of candidates) {
    const cfg = enabled.find(p => p.id === c.providerId);
    if (cfg && cfg.models.includes(c.model)) chosen.push(c);
  }
  if (chosen.length === 0) return null;
  return { providerId: chosen[0].providerId, model: chosen[0].model, fallbackChain: chosen.slice(1) };
}
```

Rules:

- The resolver never invents a model name.
- If no candidate matches, callers must handle null.
- Planner/Renderer must call resolveTier at request time.
- **Rev. B:** NoteTagger and NoteChatConverter resolve the `haiku` tier; NoteQA resolves the `flash` tier (§27, D-07).

## Appendix E — MessageType Registry and Port Protocol

```ts
// src/core/runtime/MessageType.ts
export const MessageType = {
  PROXY_FETCH:          'PROXY_FETCH',
  EXTRACT_PAGE_CONTENT: 'EXTRACT_PAGE_CONTENT',
  OPEN_SIDE_PANEL:      'OPEN_SIDE_PANEL',
  OPEN_FULL_APP:        'OPEN_FULL_APP',           // [NEW]
  SESSION_TOKEN_UPDATE: 'SESSION_TOKEN_UPDATE',
  BACKGROUND_STATE:     'BACKGROUND_STATE',
  KEEPALIVE_PING:       'KEEPALIVE_PING',
  PORT_STREAM_START:    'PORT_STREAM_START',
  PORT_STREAM_CHUNK:    'PORT_STREAM_CHUNK',
  PORT_STREAM_END:      'PORT_STREAM_END',
  PORT_STREAM_ABORT:    'PORT_STREAM_ABORT',
  ADDON_EVENT:          'ADDON_EVENT',
  WORKSPACE_HANDOFF:    'WORKSPACE_HANDOFF',       // [NEW]
  WORKSPACE_UPDATED:    'WORKSPACE_UPDATED',       // [NEW]
  WORKSPACE_HEARTBEAT:  'WORKSPACE_HEARTBEAT',     // [NEW]
} as const;
export type MessageTypeValue = typeof MessageType[keyof typeof MessageType];
export const MessageTypeValues = Object.values(MessageType) as MessageTypeValue[];
```

> **Rev. B note:** LLM-Wiki filesystem sync (§27) is **Full-App-local** — it does not add any new cross-context message type. Note capture reuses `EXTRACT_PAGE_CONTENT`. Persona is read locally from PreferenceMemoryStore; no new message type.

### Response Envelope

Every request-response call over chrome.runtime.sendMessage MUST use ResponseEnvelope<T> (Appendix C).

### BackgroundRouter Skeleton

```ts
export const BackgroundRouter = {
  register() {
    chrome.runtime.onMessage.addListener((msg: RuntimeEnvelope<unknown>, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) return false;
      if (!MessageTypeValues.includes(msg.type)) return false;
      dispatch(msg).then(resp => sendResponse(resp));
      return true; // async
    });
  },
};
```

### Long-Lived Port Streaming Protocol

Used when the SW must stream data to a surface. Message flow, all wrapped in RuntimeEnvelope:

```
1. PORT_STREAM_START  { operationId, kind: 'session-tokens' | 'workspace-mirror' }
2. PORT_STREAM_CHUNK  { operationId, data: unknown }         // 0..N times
3. PORT_STREAM_END    { operationId, ok: boolean, error? }
```

```ts
// src/core/runtime/PortReader.ts
export function readPort<T>(port: chrome.runtime.Port): AsyncIterable<T> {
  const queue: T[] = [];
  let done = false;
  let err: unknown = null;
  let notify: (() => void) | null = null;
  port.onMessage.addListener((env: RuntimeEnvelope<any>) => {
    if (env.type === MessageType.PORT_STREAM_CHUNK) queue.push(env.payload.data as T);
    else if (env.type === MessageType.PORT_STREAM_END) { done = true; if (!env.payload.ok) err = env.payload.error; }
    notify?.();
  });
  port.onDisconnect.addListener(() => { done = true; err = err ?? new Error('PORT_DISCONNECTED'); notify?.(); });
  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<T>> {
          while (queue.length === 0 && !done) await new Promise<void>(res => { notify = res; });
          if (queue.length > 0) return { value: queue.shift()!, done: false };
          if (err) throw err;
          return { value: undefined as any, done: true };
        },
      };
    },
  };
}
```

## Appendix F — Ant Design Theme System

This appendix uses Ant Design v6 tokens exclusively (consumed by both ConfigProvider and XProvider for Ant Design X components).

### F.1 Central Theme Store

```ts
// src/core/theme/ThemeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export type ThemeMode = 'light' | 'dark' | 'auto';
export interface ThemeState {
  mode: ThemeMode;
  effectiveDark: boolean;
  setMode(mode: ThemeMode): void;
  recomputeAuto(): void;
}
function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
export const useThemeStore = create<ThemeState>()(persist(
  (set, get) => ({
    mode: 'auto',
    effectiveDark: resolveDark('auto'),
    setMode: (mode) => set({ mode, effectiveDark: resolveDark(mode) }),
    recomputeAuto: () => {
      if (get().mode === 'auto') set({ effectiveDark: resolveDark('auto') });
    },
  }),
  { name: 'np_theme' }
));
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => useThemeStore.getState().recomputeAuto());
}
```

### F.2 AntD Config Builder

```ts
// src/core/theme/antdConfig.ts
import { theme, type ConfigProviderProps } from 'antd';
import enUS from 'antd/locale/en_US';
export interface AntdConfigOptions {
  mode: 'light' | 'dark' | 'auto';
  compact: boolean;
}
export function getAntdConfig(opts: AntdConfigOptions): ConfigProviderProps {
  const isDark = opts.mode === 'dark'
    || (opts.mode === 'auto' && typeof window !== 'undefined'
        && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const algorithm = [
    isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    ...(opts.compact ? [theme.compactAlgorithm] : []),
  ];
  return {
    locale: enUS,
    theme: {
      algorithm,
      token: {
        colorPrimary: '#3B82F6',
        colorInfo: '#3B82F6',
        colorSuccess: '#10B981',
        colorWarning: '#F59E0B',
        colorError: '#EF4444',
        borderRadius: 8,
        fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
        fontSize: opts.compact ? 13 : 14,
        controlHeight: opts.compact ? 30 : 32,
      },
      components: {
        Layout: {
          headerBg: isDark ? '#141414' : '#FFFFFF',
          siderBg:  isDark ? '#141414' : '#FAFAFA',
          headerHeight: opts.compact ? 44 : 56,
        },
        Menu: {
          itemHeight: opts.compact ? 32 : 40,
          itemMarginInline: opts.compact ? 4 : 8,
          collapsedIconSize: 16,
        },
        Button: {
          controlHeight: opts.compact ? 28 : 32,
          borderRadius: 6,
        },
        Input: {
          controlHeight: opts.compact ? 30 : 32,
        },
        Card: {
          bodyPadding: opts.compact ? 12 : 20,
        },
        Table: {
          cellPaddingBlock: opts.compact ? 8 : 12,
          cellPaddingInline: opts.compact ? 8 : 16,
        },
        Modal: {
          titleFontSize: opts.compact ? 15 : 16,
        },
        Notification: {
          width: opts.compact ? 320 : 384,
        },
      },
    },
  };
}
```

### F.3 Mounting Pattern

```ts
// src/entrypoints/sidepanel/main.tsx
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';
function Root() {
  const mode = useThemeStore(s => s.mode);
  return (
    <ConfigProvider {...getAntdConfig({ mode, compact: true })}>
      <AntdApp>
        <SidePanelShell />
      </AntdApp>
    </ConfigProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
```

```ts
// src/entrypoints/app/main.tsx
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { AppShell } from '@/components/app/AppShell';
function Root() {
  const mode = useThemeStore(s => s.mode);
  return (
    <ConfigProvider {...getAntdConfig({ mode, compact: false })}>
      <AntdApp>
        <AppShell />
      </AntdApp>
    </ConfigProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
```

### F.4 Accessing Imperative APIs

Never import message, notification, Modal statically. Always use App.useApp():

```ts
import { App } from 'antd';
function MyComponent() {
  const { message, notification, modal } = App.useApp();
  return (
    <button onClick={() => notification.error({
      message: 'Provider error',
      description: 'Failed to reach OpenAI.',
    })}>Fail</button>
  );
}
```

### F.5 Dark Mode

Dark mode is switched by re-rendering ConfigProvider with theme.darkAlgorithm. Do not toggle a .dark class.

### F.6 Icons

Use @ant-design/icons for static icons. For animated icons use motion (import { motion } from 'motion/react').

## Appendix G — Complete wxt.config.ts

```ts
// wxt.config.ts
import { defineConfig } from 'wxt';
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'NowPilot',
    description: 'AI-native Chrome Side Panel + Full App assistant',
    permissions: [
      'sidePanel','storage','cookies','alarms','tabs',
      'scripting','contextMenus','notifications','declarativeNetRequest',
    ],
    host_permissions: [
      '*://*.service-now.com/*',
      '*://support.servicenow.com/*',
    ],
    side_panel: { default_path: 'sidepanel.html' },
    action:     { default_title: 'Open NowPilot' },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src *",
    },
    web_accessible_resources: [
      { resources: ['assets/*'], matches: ['<all_urls>'] },
    ],
  },
  vite: () => ({
    build: {
      target: 'chrome120',
      sourcemap: 'inline',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/antd')) return 'antd';
            if (id.includes('node_modules/@ant-design/x-markdown')) return 'antd-x-markdown';
            if (id.includes('node_modules/@ant-design/x')) return 'antd-x';
            if (id.includes('node_modules/@ant-design')) return 'ant-icons';
            if (id.includes('node_modules/defuddle')) return 'defuddle';   // NEW Rev. B — keep out of content bundle
            if (id.includes('node_modules/yaml')) return 'yaml';           // NEW Rev. B — keep out of content bundle
            if (id.includes('node_modules/react')) return 'react';
          },
        },
      },
    },
  }),
});
```

Rules:

- target: 'chrome120' matches the minimum supported Chrome for chrome.sidePanel.open. AntD v6 requires React ≥18 (this project uses React 19) and uses CSS-variable theming by default.
- No @tailwindcss/vite plugin.
- The content-script bundle MUST NOT include antd, @ant-design/x, @ant-design/x-markdown, react, react-dom, **defuddle, or yaml (Rev. B)**. Enforced by tests/isolation/no-content-script-ui.test.ts.

## Appendix H — Reserved

**Shadow DOM Isolation Kit is deferred to v0.2+.** See §25 for the future page-injection reintroduction plan. When v0.2 reintroduces page injection, this appendix will contain: mountShadow() (adoptedStyleSheets); loadSharedSheet(); buildTokenSheet(); portal-aware Radix wrappers under src/components/ui-shadow/; content-script UI bundle configuration; **host-page write-back helpers that unblock RICH-H-04/H-07 (reconciliation R1)**.

In v0.1, this appendix is intentionally empty to signal the boundary between v0.1 (no injection) and v0.2+ (injection reintroduced).

## Appendix I — AgentOrchestrator Reference Implementation

```ts
// src/core/ai/AgentOrchestrator.ts
import { PlannerService } from './PlannerService';
import { ExecutorService } from './ExecutorService';
import { RendererService } from './RendererService';
import type { OptimizedContext } from '../context/ContextOptimizer';
import type { ToolExecutionResult } from './types';
export interface AgentTurnInput {
  operationId: string;
  userInput: string;
  context: OptimizedContext;
  abortSignal: AbortSignal;
  tier: {
    plannerCap: number;
    toolCap: number;
    mcpChaining: boolean;
  };
}
export interface AgentTurnOutput {
  operationId: string;
  streamedText: string;
  toolResults: ToolExecutionResult<unknown>[];
  reasonCode: string;
}
export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
  const toolResults: ToolExecutionResult<unknown>[] = [];
  let plannerCalls = 0;
  let toolCalls = 0;
  while (true) {
    if (input.abortSignal.aborted) throw new DOMException('aborted', 'AbortError');
    if (plannerCalls >= input.tier.plannerCap) return await finish('planner_cap_reached');
    plannerCalls++;
    const decision = await PlannerService.plan({
      operationId: input.operationId,
      context: input.context,
      userInput: input.userInput,
      toolResults,
      abortSignal: input.abortSignal,
    });
    if (decision.action === 'answer' || decision.action === 'ask_clarification') {
      return await finish(
        decision.action === 'answer'
          ? (decision as any).reasonCode
          : 'ask_clarification'
      );
    }
    if (toolCalls >= input.tier.toolCap) return await finish('tool_cap_reached');
    toolCalls++;
    const result = await ExecutorService.execute({
      operationId: input.operationId,
      toolName: (decision as any).toolName,
      input: (decision as any).input,
      abortSignal: input.abortSignal,
    });
    toolResults.push(result);
  }
  async function finish(reasonCode: string): Promise<AgentTurnOutput> {
    const rendered = await RendererService.render({
      operationId: input.operationId,
      context: input.context,
      userInput: input.userInput,
      toolResults,
      abortSignal: input.abortSignal,
    });
    return {
      operationId: input.operationId,
      streamedText: rendered.text,
      toolResults,
      reasonCode,
    };
  }
}
```

Rules:

- AgentOrchestrator is the only module allowed to enforce tier caps in §1.4.
- No component or hook may call PlannerService directly.
- The AbortSignal is passed through unchanged to every downstream service.
- **Rev. B:** when the reasonCode is `ask_clarification`, the UI layer renders RICH-C-01 clarification chips (§17.7); the follow-up chips (RICH-C-05) are produced by a separate non-blocking suggestion call, never inside this loop.

## Appendix J — Streaming Kit

### J.1 ChunkBuffer

```ts
// src/core/ai/ChunkBuffer.ts
export interface ChunkBuffer {
  enqueue(delta: string): void;
  onFlush(cb: (text: string) => void): () => void;
  flushNow(): void;
  reset(): void;
}
export function createChunkBuffer(): ChunkBuffer {
  let pending = '';
  let full = '';
  let rafId: number | null = null;
  const listeners = new Set<(t: string) => void>();
  let byteRate = 0;
  let lastMeasure = performance.now();
  function schedule() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      full += pending;
      pending = '';
      for (const cb of listeners) cb(full);
    });
  }
  return {
    enqueue(delta) {
      pending += delta;
      byteRate += delta.length;
      const now = performance.now();
      if (now - lastMeasure > 1000) { byteRate = delta.length; lastMeasure = now; }
      if (byteRate > 8_000 && rafId === null) {
        rafId = setTimeout(() => {
          rafId = null; full += pending; pending = '';
          listeners.forEach(cb => cb(full));
        }, 33) as unknown as number;
      } else {
        schedule();
      }
    },
    onFlush(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    flushNow() {
      if (rafId !== null) { cancelAnimationFrame(rafId as number); rafId = null; }
      full += pending; pending = '';
      listeners.forEach(cb => cb(full));
    },
    reset() {
      pending = ''; full = '';
      if (rafId !== null) { cancelAnimationFrame(rafId as number); rafId = null; }
    },
  };
}
```

### J.2 useStreamingLLM

```ts
// src/hooks/useStreamingLLM.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { createChunkBuffer, type ChunkBuffer } from '../core/ai/ChunkBuffer';
import { runAgentTurn } from '../core/ai/AgentOrchestrator';
import type { ActiveStreamState } from '../core/runtime/workerState';
import { useWorkspaceStore } from '../core/workspace/WorkspaceStore';
export function useStreamingLLM(conversationId: string) {
  const bufferRef = useRef<ChunkBuffer>(createChunkBuffer());
  const abortRef  = useRef<AbortController | null>(null);
  const [text, setText] = useState('');
  const [state, setState] = useState<ActiveStreamState>({ state: 'idle' });
  const surface = useWorkspaceStore(s => s.state.activeSurface);
  useEffect(() => bufferRef.current.onFlush(setText), []);
  const send = useCallback(async (userInput: string, ctxBuilder: () => Promise<any>) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    bufferRef.current.reset();
    const operationId = crypto.randomUUID();
    await chrome.storage.session.set({
      np_active_stream: { conversationId, operationId, startedAt: Date.now(), surface },
    });
    setState({ state: 'streaming', sessionId: conversationId, operationId, startedAt: Date.now(), surface });
    try {
      const context = await ctxBuilder();
      const result = await runAgentTurn({
        operationId, userInput, context,
        abortSignal: abortRef.current.signal,
        tier: pickTierCaps(context),
      });
      for (const ch of chunkStringForEffect(result.streamedText)) {
        bufferRef.current.enqueue(ch);
      }
      bufferRef.current.flushNow();
      setState({ state: 'completed', sessionId: conversationId, operationId, surface });
    } catch (e: any) {
      setState({
        state: 'failed', sessionId: conversationId, operationId, surface,
        code: e?.code ?? 'STREAM_FAILED', message: e?.message ?? 'Unknown error',
      });
    } finally {
      await chrome.storage.session.remove('np_active_stream');
    }
  }, [conversationId, surface]);
  const abort = useCallback(() => { abortRef.current?.abort(); }, []);
  useEffect(() => {
    (async () => {
      const v = await chrome.storage.session.get('np_active_stream');
      if (v.np_active_stream && v.np_active_stream.conversationId === conversationId) {
        setState({
          state: 'failed', sessionId: conversationId,
          operationId: v.np_active_stream.operationId, surface,
          code: 'STREAM_INTERRUPTED', message: 'Previous stream was interrupted.',
        });
        await chrome.storage.session.remove('np_active_stream');
      }
    })();
  }, [conversationId, surface]);
  return { text, state, send, abort };
}
function chunkStringForEffect(s: string): Iterable<string> { return s.match(/.{1,32}/g) ?? []; }
function pickTierCaps(_ctx: any) { return { plannerCap: 3, toolCap: 2, mcpChaining: true }; }
```

## Appendix K — PromptCacheAdapter per Provider

```ts
// src/core/ai/PromptCacheAdapter.ts
import type { ProviderId } from './types';
import type { PromptSection } from '../context/ContextOptimizer';
export interface CacheAdaptedPrompt {
  providerRequestSections: unknown;
  cacheKeyHash: string;
  strategy: 'anthropic-ephemeral' | 'gemini-cachedContent' | 'prefix-only';
}
const ANTHROPIC_MAX_BREAKPOINTS = 4;
const GEMINI_MIN_CACHED_TOKENS = 32_768;
export function applyCacheHints(providerId: ProviderId, sections: PromptSection[]): CacheAdaptedPrompt {
  switch (providerId) {
    case 'anthropic': {
      let marked = 0;
      const out = sections.map((s) => {
        if (s.stable && marked < ANTHROPIC_MAX_BREAKPOINTS) {
          marked++;
          return { ...s, cache_control: { type: 'ephemeral' as const } };
        }
        return s;
      });
      return {
        providerRequestSections: out,
        cacheKeyHash: hashStableSections(sections),
        strategy: 'anthropic-ephemeral',
      };
    }
    case 'gemini': {
      const stable = sections.filter(s => s.stable);
      const stableTokens = stable.reduce((n, s) => n + s.tokens, 0);
      if (stableTokens >= GEMINI_MIN_CACHED_TOKENS) {
        return {
          providerRequestSections: {
            cachedContent: stable,
            inline: sections.filter(s => !s.stable),
          },
          cacheKeyHash: hashStableSections(stable),
          strategy: 'gemini-cachedContent',
        };
      }
      return {
        providerRequestSections: { inline: sections },
        cacheKeyHash: hashStableSections(stable),
        strategy: 'prefix-only',
      };
    }
    case 'openai':
    case 'openai-compatible':
    case 'ollama':
    default: {
      const ordered = [...sections].sort(stableFirst);
      return {
        providerRequestSections: ordered,
        cacheKeyHash: hashStableSections(ordered.filter(s => s.stable)),
        strategy: 'prefix-only',
      };
    }
  }
}
function stableFirst(a: PromptSection, b: PromptSection) {
  if (a.stable !== b.stable) return a.stable ? -1 : 1;
  return a.kind.localeCompare(b.kind);
}
function hashStableSections(sections: Array<Pick<PromptSection, 'text' | 'stable'>>): string {
  const stable = sections.filter(s => s.stable).map(s => s.text).join('\u0000');
  let h = 2166136261;
  for (let i = 0; i < stable.length; i++) {
    h ^= stable.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
```

Rules:

- Only stable sections are eligible for cache hints.
- cacheKeyHash is recorded in PromptTrace.promptCache.cacheKey (§4.3).
- Below the Gemini 32,768-token minimum, fall back to prefix-only.
- **Rev. B:** the persona block sits in the stable `[SYSTEM]` section and is therefore cache-eligible; keep it byte-stable per persona (§1.3).

## Appendix L — Structured Output Repair Loop

```ts
// src/core/ai/StructuredOutput.ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ProviderId } from './types';
import { PROMPTS } from '../prompts';
export interface StructuredOutputContext {
  operationId: string;
  providerId: ProviderId;
  model: string;
  timeoutMs: number;
  callProviderJsonMode: (prompt: string, jsonSchema: unknown, signal: AbortSignal) => Promise<string>;
  abortSignal: AbortSignal;
}
export async function requestJson<T>(
  schema: z.ZodSchema<T>,
  prompt: string,
  ctx: StructuredOutputContext,
): Promise<T> {
  const jsonSchema = zodToJsonSchema(schema);
  const attempt = async (p: string): Promise<string> => {
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    ctx.abortSignal.addEventListener('abort', onAbort);
    const to = setTimeout(() => ac.abort(), ctx.timeoutMs);
    try {
      return await ctx.callProviderJsonMode(p, jsonSchema, ac.signal);
    } finally {
      clearTimeout(to);
      ctx.abortSignal.removeEventListener('abort', onAbort);
    }
  };
  const first = await attempt(prompt);
  const parsedFirst = safeParse(schema, first);
  if (parsedFirst.ok) return parsedFirst.data;
  const repairPrompt = `${PROMPTS.repairJson.system}
Schema: ${JSON.stringify(jsonSchema)}
Broken: ${first}`;
  const second = await attempt(repairPrompt);
  const parsedSecond = safeParse(schema, second);
  if (parsedSecond.ok) return parsedSecond.data;
  const err: any = new Error('STRUCTURED_OUTPUT_FAILED');
  err.code = 'STRUCTURED_OUTPUT_FAILED';
  err.retryable = false;
  err.raw = { first, second };
  throw err;
}
function safeParse<T>(schema: z.ZodSchema<T>, raw: string):
  | { ok: true; data: T }
  | { ok: false; error: unknown }
{
  try {
    const cleaned = raw.trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    const res = schema.safeParse(parsed);
    return res.success ? { ok: true, data: res.data } : { ok: false, error: res.error };
  } catch (e) {
    return { ok: false, error: e };
  }
}
```

Rules:

- Exactly one repair attempt. Further failures throw STRUCTURED_OUTPUT_FAILED.
- PROMPTS.repairJson.system (Appendix A) is canonical. Do not paraphrase.
- The provider adapter must set the provider's JSON mode flag natively.
- **Rev. B:** NoteTagResultSchema, NoteQAResultSchema, NoteDraftSchema (Appendix C) and the RICH `clarify`/`followUpSuggest` outputs all use this loop.

## Appendix M — WorkspaceStore Reference

### M.1 Zustand Store

```ts
// src/core/workspace/WorkspaceStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { WorkspaceState, ActiveSurface } from '@/types/workspace';
interface WorkspaceStoreShape {
  state: WorkspaceState;
  setState(patch: Partial<WorkspaceState>): void;
  reset(): void;
  hydrateFromStorage(): Promise<void>;
  hydrateFromURL(): Promise<void>;
  persist(): Promise<void>;
}
function defaultState(): WorkspaceState {
  return {
    workspaceId: crypto.randomUUID(),
    conversationId: crypto.randomUUID(),
    pinnedTabs: [],
    selectedNotes: [],
    activeSurface: 'sidepanel',
    version: 0,
    updatedAt: Date.now(),
  };
}
export const useWorkspaceStore = create<WorkspaceStoreShape>()(
  subscribeWithSelector((set, get) => ({
    state: defaultState(),
    setState: (patch) => {
      const next = { ...get().state, ...patch, version: get().state.version + 1, updatedAt: Date.now() };
      set({ state: next });
      void get().persist();
    },
    reset: () => set({ state: defaultState() }),
    hydrateFromStorage: async () => {
      const v = await chrome.storage.local.get('np_workspace');
      if (v.np_workspace) set({ state: v.np_workspace as WorkspaceState });
    },
    hydrateFromURL: async () => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const workspaceId = params.get('workspaceId');
      const conversationId = params.get('conversationId');
      if (workspaceId) {
        await get().hydrateFromStorage();
        if (get().state.workspaceId !== workspaceId) {
          get().setState({ workspaceId, conversationId: conversationId ?? crypto.randomUUID() });
        }
      }
    },
    persist: async () => {
      await chrome.storage.local.set({ np_workspace: get().state });
    },
  })),
);
```

### M.2 WorkspaceRouter — Open Full App

```ts
// src/core/workspace/WorkspaceRouter.ts
import { useWorkspaceStore } from './WorkspaceStore';
export const WorkspaceRouter = {
  async openFullApp(opts?: { page?: string }): Promise<void> {
    const store = useWorkspaceStore.getState();
    await store.persist();
    const state = store.state;
    const url = new URL(chrome.runtime.getURL('app.html'));
    url.searchParams.set('workspaceId', state.workspaceId);
    url.searchParams.set('conversationId', state.conversationId);
    if (opts?.page) url.searchParams.set('page', opts.page);
    const existing = await chrome.tabs.query({ url: chrome.runtime.getURL('app.html') + '*' });
    const currentWindow = await chrome.windows.getCurrent();
    const inCurrent = existing.find(t => t.windowId === currentWindow.id);
    if (inCurrent && inCurrent.id !== undefined) {
      await chrome.tabs.update(inCurrent.id, { active: true, url: url.toString() });
      store.setState({ openedFullAppTabId: inCurrent.id });
    } else {
      const created = await chrome.tabs.create({ url: url.toString() });
      if (created.id !== undefined) store.setState({ openedFullAppTabId: created.id });
    }
  },
  async focusSidePanel(): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (tabId !== undefined) {
      await chrome.sidePanel.open({ tabId });
    }
  },
};
```

### M.3 WorkspaceSync — Cross-Surface via BroadcastBus

```ts
// src/core/workspace/WorkspaceSync.ts
import { useWorkspaceStore } from './WorkspaceStore';
import { BroadcastBus } from '@/core/runtime/BroadcastBus';
import { MessageType } from '@/core/runtime/MessageType';
const HEARTBEAT_MS = 3000;
export function startWorkspaceSync(surface: 'sidepanel' | 'full-app') {
  useWorkspaceStore.setState((s) => ({ state: { ...s.state, activeSurface: surface } }));
  BroadcastBus.on(MessageType.WORKSPACE_UPDATED, (payload) => {
    const remote = payload as { state: any; from: string };
    const local = useWorkspaceStore.getState().state;
    if (remote.state.version > local.version) {
      useWorkspaceStore.setState({ state: remote.state });
    }
  });
  const timer = setInterval(() => {
    BroadcastBus.emit(MessageType.WORKSPACE_HEARTBEAT, {
      surface,
      workspaceId: useWorkspaceStore.getState().state.workspaceId,
      at: Date.now(),
    });
  }, HEARTBEAT_MS);
  const unsub = useWorkspaceStore.subscribe(
    (s) => s.state,
    (state) => {
      BroadcastBus.emit(MessageType.WORKSPACE_UPDATED, { state, from: surface });
    },
  );
  return () => {
    clearInterval(timer);
    unsub();
  };
}
```

### M.4 useWorkspace Hook

```ts
// src/hooks/useWorkspace.ts
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
export function useWorkspace() {
  const state = useWorkspaceStore(s => s.state);
  const setState = useWorkspaceStore(s => s.setState);
  return { state, setState };
}
```

Rules:

- The WorkspaceStore is the single source of truth for cross-surface state.
- All mutations go through setState — do not set state directly on the store.
- persist() is called automatically on every setState.
- WORKSPACE_UPDATED messages carry the whole state; consumers apply last-write-wins by version.
- WorkspaceRouter.openFullApp is idempotent by tab dedupe.
- On Full App mount, always call hydrateFromURL() before rendering routes.

## Appendix N — Persona & Intent Reference Implementations (NEW in Rev. B)

### N.1 PersonaProfile (RICH-R-01)

```ts
// src/core/ai/persona/PersonaProfile.ts
import { z } from 'zod';
export const PersonaProfileSchema = z.object({
  id: z.string().min(1),
  identity: z.object({
    name: z.string().min(1).max(40),
    tagline: z.string().min(1).max(120),
    domain: z.string().min(1).max(200),
  }),
  personalityCore: z.array(z.string()).min(1).max(8),
  behavioralDrivers: z.array(z.string()).max(8),
  languageStyle: z.object({
    tone: z.enum(['professional-warm', 'concise', 'friendly']),
    vocabulary: z.string().max(120),
    brevity: z.enum(['brief', 'balanced', 'detailed']),
  }),
  emotionalRepertoire: z.array(z.string()).max(8),
});
export type PersonaProfile = z.infer<typeof PersonaProfileSchema>;
// Canonical default persona (RICH-R-01). Do not paraphrase.
export const DEFAULT_PERSONA: PersonaProfile = {
  id: 'nowpilot-default',
  identity: {
    name: 'NowPilot',
    tagline: 'Your ServiceNow support co-pilot',
    domain: 'ServiceNow support engineering, technical troubleshooting, and knowledge management',
  },
  personalityCore: ['privacy-first', 'helpful', 'precise', 'humble'],
  behavioralDrivers: ['prefers asking clarifying questions over guessing', 'cites sources when available'],
  languageStyle: {
    tone: 'professional-warm',
    vocabulary: 'technical but accessible to support engineers',
    brevity: 'brief',
  },
  emotionalRepertoire: ['empathy', 'encouragement', 'curiosity'],
};
```

### N.2 PersonaInjector (RICH-R-02 / R-10)

```ts
// src/core/ai/persona/PersonaInjector.ts
import type { PersonaProfile } from './PersonaProfile';
import { DEFAULT_PERSONA } from './PersonaProfile';
import type { UserPreferences } from '@/core/memory/types';
export type PipelineStage = 'planner' | 'executor' | 'renderer' | 'memoryExtractor';
// Applies user overrides (RICH-R-04). Config from PreferenceMemoryStore (np_persona) — NEVER the fact store (R2).
export function resolvePersona(base: PersonaProfile, prefs?: UserPreferences): PersonaProfile {
  if (!prefs?.personaOverrides) return base;
  const o = prefs.personaOverrides;
  return {
    ...base,
    identity: { ...base.identity, name: o.name ?? base.identity.name },
    languageStyle: {
      ...base.languageStyle,
      tone: o.tone ?? base.languageStyle.tone,
      brevity: o.brevity ?? base.languageStyle.brevity,
    },
  };
}
// Stable output (byte-identical per persona) so prompt caching is preserved (§1.3).
export function buildPersonaBlock(p: PersonaProfile): string {
  return [
    `You are ${p.identity.name} — ${p.identity.tagline}.`,
    `Domain: ${p.identity.domain}.`,
    `Core values: ${p.personalityCore.join(', ')}.`,
    `Behaviour: ${p.behavioralDrivers.join('; ')}.`,
    `Tone: ${p.languageStyle.tone}. Vocabulary: ${p.languageStyle.vocabulary}. Default brevity: ${p.languageStyle.brevity}.`,
    `You may express: ${p.emotionalRepertoire.join(', ')}. Acknowledge user frustration before solving; celebrate progress briefly; if you err, apologise briefly and offer an alternative — never be defensive.`,
  ].join('\n');
}
export const PersonaInjector = {
  inject(stage: PipelineStage, baseSystem: string, opts?: { persona?: PersonaProfile; prefs?: UserPreferences }): string {
    const persona = resolvePersona(opts?.persona ?? DEFAULT_PERSONA, opts?.prefs);
    const block = buildPersonaBlock(persona);
    return `${block}\n\n${baseSystem}`;   // persona first (cacheable), then canonical stage system string (Appendix A)
  },
};
```

### N.3 IntentClassifier (RICH-I-08 — no LLM)

```ts
// src/core/intent/IntentClassifier.ts
export interface QuickAction { id: string; label: string; promptTemplateId: string; }
type Rule = { test: (url: URL) => boolean; actions: QuickAction[] };
const RULES: Rule[] = [
  {
    test: (u) => /service-now\.com$/.test(u.hostname) && /incident|\/now\/nav/.test(u.pathname + u.search),
    actions: [
      { id: 'sn-summarize-case', label: 'Summarize this case', promptTemplateId: 'sn.summarizeCase' },
      { id: 'sn-draft-worknote', label: 'Draft a work note',   promptTemplateId: 'sn.draftWorkNote' },
      { id: 'sn-similar-cases',  label: 'Check similar cases',  promptTemplateId: 'sn.similarCases' },
    ],
  },
  {
    test: (u) => /service-now\.com$/.test(u.hostname) && /kb_view|knowledge/.test(u.pathname + u.search),
    actions: [
      { id: 'sn-summarize-kb', label: 'Summarize this article', promptTemplateId: 'sn.summarizeKb' },
      { id: 'sn-check-updates', label: 'Check for updates',     promptTemplateId: 'sn.checkUpdates' },
    ],
  },
];
const GENERIC: QuickAction[] = [
  { id: 'summarize-page', label: 'Summarize this page', promptTemplateId: 'generic.summarize' },
  { id: 'extract-points', label: 'Extract key points',  promptTemplateId: 'generic.extract' },
];
// Pure heuristic — no LLM call (RICH-I-08). Returns 2-3 quick actions for the pinned page.
export function classifyIntent(rawUrl: string): QuickAction[] {
  try {
    const u = new URL(rawUrl);
    for (const r of RULES) if (r.test(u)) return r.actions.slice(0, 3);
  } catch { /* fall through */ }
  return GENERIC;
}
```

**End of NowPilot Product Specification v0.1 (Rev. B) — content-complete for cost-effective coding agents.**