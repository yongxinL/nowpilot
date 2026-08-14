# NowPilot — Product Specification v0.1

**Document ID:** PRODUCT_SPEC_v0_1.md
**Status:** Canonical, standalone implementation reference
**Date:** 2026-08-02 (rev 2026-08-12)
**Version:** v0.1
**Scope:** NowPilot v0.1 — Chrome MV3 AI Assistant using Side Panel + Standalone view. Add-on architecture preserved. Page injection deferred to v0.2+.

**Changelog (rev 2026-08-12):**
- **Defuddle pinned to `^0.19` (≥ 0.19.2), superseding `^0.6`.** Adds CVE-2026-30830 (XSS) fix + `data:`/`blob:` URL rejection, iframe-`sandbox` retention, SVG `<style>` stripping, and non-mutating `parse()`. Requires `useAsync:false` + synchronous `parse()` (privacy: no third-party API fetches), the `defuddle/full` bundle for reliable Markdown, an effective-base-URL stamp for the panel's detached `DOMParser`, and an extended isolation grep (`mathml-to-latex`/`temml`/`turndown`). See §7.6, §26.4, §23, §24, Appendix G.
- **Note file format is now OKF v0.2-aligned (OKF-compatible, not OKF-constrained).** `.md` YAML frontmatter gains OKF-required `type`, recommended `description`, and the `generated`/`status` trust-lifecycle families; NowPilot's immutable UUID `id` is retained as an OKF **extension key** and wikilinks remain the body edge syntax. Full-OKF markdown-link edges + path-as-identity + `sources`/`verified` families are deferred to v0.2+. See §21.2, §27.3 (SYNC-04), §18 (Phase 5 / 5a), §23, Appendix C.
- **Implementability review pass (for cost-effective planning/coding models).** Closed gaps that would block a Haiku/DeepSeek-Flash/Gemini-Flash implementer: (1) LLM-WIKI-11 referenced a non-existent `NOTE_SUGGESTION_MAX_PER_SAVE` — corrected to the two real constants. (2) The settled **Phase 4a** extraction decisions (trigger model, subscription-gated re-extract, per-tab cache LRU, lazy heading-chunked index, payload cap, panel-side redaction, actionable-only APC walk, `CONTENT_EXTRACT_FAILED`) are now **normative in §26.4a/§26.5/§26.6** with tunables `PAGE_CACHE_MAX_TABS`/`PAGE_HTML_MAX_BYTES`/`INDEX_CHUNK_MAX_TOKENS`/`PAGE_EXTRACTION_TIMEOUT_MS` in Appendix C. (3) Zod-4 vs `zod-to-json-schema` ambiguity resolved to a single instruction (keep in v0.1; native migration is v0.2). (4) `resolveTier` now honors `prefer-local`. (5) Clarified the strategy-`id` vs result-`source` enums (no separate ReadabilityStrategy). (6) **§26.2 layers now tagged with owning phase** — ServiceNow Table API is explicitly **Phase 8, not 4a** (4a builds the read + actionable strategies only). (7) **Appendix D carries a model-ID verification warning** — the tier→model slugs are point-in-time and Phase 3 must verify them (incl. the exact current DeepSeek slug). See §26, Appendix C, Appendix D, Appendix L.
- **Dependency version audit (§7) refreshed to current majors.** Notable bumps: **wxt `^0.19` -> `^0.21`** (Node 22 / Vite 6.3.4 / peer-dep changes), **@wxt-dev/module-react `^0.3` -> `^1`**, **ai (Vercel AI SDK) `^4` -> `^5`+** (breaking API: `inputSchema`/`maxOutputTokens`/`stopWhen`; `@ai-sdk/*` providers version independently), **zod `^3` -> `^4`** (enables dropping `zod-to-json-schema` via native `z.toJSONSchema()`), **immer `^10` -> `^11`**, **@mozilla/readability `^0.5` -> `^0.6`**, plus a **TypeScript 6.x** development recommendation. Packages already current via caret (react 19, antd 6, @ant-design/x 2, @modelcontextprotocol/sdk 1.30, zustand 5, idb 8, minisearch 7, turndown 7, dompurify 3) are unchanged. See §7 and §23.

**Purpose:** This document is the single, self-contained product specification for NowPilot v0.1. It does not reference any prior document. Any AI coding agent implementing this spec must treat this file as authoritative and complete.

**Target implementation agents:** Anthropic Claude Haiku, Google Gemini Flash, DeepSeek Flash, or equivalent cost-effective coding models.
**Target runtime providers:** OpenAI, Anthropic, Gemini, Ollama
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
- §18 — Master Implementation Phases
- §19 — Runtime Edge Cases
- §20 — Runtime State Models & Cross-Context Coordination
- §21 — Data Models
- §22 — Performance Targets & Algorithms
- §23 — Key Technology Decisions (ADRs)
- §24 — Verification Commands
- §25 — Future Page Injection Architecture & Deferred UI Features
- §26 — PageContentService (Layered Page Extraction)
- §27 — LLM-Wiki & Filesystem Sync
- §28 — Verified Agent Harness Requirements
- §29 — Multimodal Input & Real-Time Interaction Foundation
- §30 — Bounded Multi-Agent Collaboration (single-agent default)
- Appendices A–O — canonical constants, type registry, error-code registry, and reference implementations (incl. Appendix O worked examples for cost-effective models)

Appendices C, E, F, G, I, J, K, L, M, and O are **mandatory** reading for any AI coding agent. Appendix O gives copy-pasteable reference implementations for the harness sub-phases and the coordinator platform.

## §0 — Hard Rules (Non-Negotiable)

These rules apply to every phase, every module, and every AI coding agent.

### §0.1 Read Order and Scope

- Read §§0–5 fully before writing any code.
- Read §§6–17 as background for the feature being implemented.
- Read §18 and the relevant feature sections, §§28–32, and appendices for the current phase. Use §18 only for implementation order.
- Do not implement more than one phase per response unless explicitly requested.

### §0.2 DO NOT Rules

**Codegen safety:**

- **DO NOT** invent file paths. Use only paths in §8 and §18.
- **DO NOT** invent type names. Use Appendix C for every shape.
- **DO NOT** invent tool names. Planner may only select tools from the enum passed by ExecutorService.
- **DO NOT** invent provider IDs. The four valid IDs are `'openai' | 'anthropic' | 'gemini' | 'ollama'` (use `openai` with a custom `baseURL` for OpenAI-compatible providers).
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
- **DO NOT** put heavy admin/configuration screens in the Side Panel. Those belong in the Standalone view under Options.
- **DO NOT** use innerHTML, dangerouslySetInnerHTML, or document.write.
- **DO NOT** use setTimeout/setInterval for DOM polling in content scripts. Use MutationObserver.
- **DO NOT** install tailwindcss, @tailwindcss/vite, shadcn/ui, @radix-ui/react-*, class-variance-authority, clsx, or tailwind-merge. Removed in v0.1.

**Filesystem:**

- **DO NOT** call `showDirectoryPicker()` or persist a `FileSystemDirectoryHandle` from a content script or the background service worker. The File System Access API is used **only in the Standalone page** (NotesPage / Options).
- **DO NOT** store a `FileSystemDirectoryHandle` in chrome.storage.local (non-JSON-serializable). Use the dedicated `notes_backup_config` IndexedDB store.
- **DO NOT** capture password field values during extraction or note conversion (`isPassword ⇒ value omitted`).

**Cross-surface layering:**

- **DO NOT** import from src/entrypoints/standalone/** inside src/entrypoints/sidepanel/** or vice versa. Each surface is independently mountable.
- **DO NOT** call chrome.tabs.create for the Standalone view from a content script. Only the side panel, popup, background SW (in response to user gesture), and command palette may open the Standalone view.

**AI orchestration:**

- **DO NOT** let the LLM execute tools directly. PlannerService may request tools; ExecutorService validates and runs them.
- **DO NOT** use large-model agent loops (maxSteps=15) for Haiku/Gemini Flash/DeepSeek Flash. Use the tier caps in §1.4.
- **DO NOT** use raw full history in prompts. All prompts pass through ContextOptimizer.
- **DO NOT** assemble any system prompt without the persona block once `PersonaInjector` (RICH-R-02) exists. Every AI call (Planner, Executor, Renderer, MemoryExtractor) routes its system string through `PersonaInjector.inject()` (§17.7, Appendix A note).

**Storage / persona:**

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
| AgentOrchestrator | src/core/ai/AgentOrchestrator.ts | Planner → Executor loop with tier caps (Appendix I) — the single-role engine |
| CollaborationCoordinator | src/core/collaboration/CollaborationCoordinator.ts | Runs a CollaborationPlan; owns sequencing, permissions, commits, termination (§1.6, §30) |
| CollaborationRoleRegistry | src/core/collaboration/CollaborationRoleRegistry.ts | Closed registry of allowed roles; the default one-role plan is the single-agent path |
| ProviderRouter | src/core/ai/ProviderRouter.ts | Provider selection, retry, fallback, circuit breaker |
| TierResolver | src/core/ai/TierResolver.ts | Maps haiku/flash tier → concrete (providerId, model) (Appendix D) |
| PromptCacheManager | src/core/ai/PromptCacheManager.ts | Prompt cache segmentation and provider hints |
| PromptCacheAdapter | src/core/ai/PromptCacheAdapter.ts | Per-provider cache-hint transformation (Appendix K) |
| StructuredOutput | src/core/ai/StructuredOutput.ts | JSON mode + schema validation + one-shot repair (Appendix L) |
| ChunkBuffer | src/core/ai/ChunkBuffer.ts | rAF-batched streaming UI buffer (Appendix J) |
| PersonaProfile | src/core/ai/persona/PersonaProfile.ts | AI identity/personality/tone config (RICH-R-01) |
| PersonaInjector | src/core/ai/persona/PersonaInjector.ts | Injects persona into system prompts (RICH-R-02) |
| IntentClassifier | src/core/intent/IntentClassifier.ts | URL/hostname heuristic for quick-actions (RICH-I-08, no LLM) |
| ModelContextTier | src/core/context/ModelContextTier.ts | tiny/small/medium/large classification |
| ContextOptimizer | src/core/context/ContextOptimizer.ts | Dynamic token budget, compression, degradation |
| ContextCompressor | src/core/context/ContextCompressor.ts | Structured text/page/case/history compression |
| MemoryEngine | src/core/memory/MemoryEngine.ts | System-owned memory orchestration |
| ConversationMemoryStore | src/core/memory/ConversationMemoryStore.ts | Per-conversation summary + recent turns |
| UserMemoryStore | src/core/memory/UserMemoryStore.ts | Cross-session fact/preference/pattern memory |
| PreferenceMemoryStore | src/core/memory/PreferenceMemoryStore.ts | User behavioural preferences (persona config lives here) |
| AITransactionLog | src/core/telemetry/AITransactionLog.ts | AI/MCP/tool/provider operation trace |
| AITransactionLogDB | src/core/telemetry/AITransactionLogDB.ts | IndexedDB trace persistence |
| TraceRedactor | src/core/telemetry/TraceRedactor.ts | Redaction before logs/UI/export |
| WriteJournal | src/core/storage/WriteJournal.ts | Multi-store consistency (metadata + IndexedDB body) |
| IndexedDBMigrator | src/core/storage/IndexedDBMigrator.ts | Versioned migrations |
| WorkspaceStore (NEW) | src/core/workspace/WorkspaceStore.ts | Shared workspace across Side Panel and Standalone view (Appendix M) |
| WorkspaceRouter (NEW) | src/core/workspace/WorkspaceRouter.ts | Handoff URL parse/build + cross-surface sync |
| SidePanelPageRegistry | src/core/registry/SidePanelPageRegistry.ts | Add-on registration of Side Panel pages |
| StandalonePageRegistry (NEW) | src/core/registry/StandalonePageRegistry.ts | Add-on registration of Standalone pages |
| PageContentService | src/core/extraction/PageContentService.ts | Core layered page extraction (§26) |
| NoteTagger | src/core/notes/NoteTagger.ts | LLM: tags + category + summary + memory facts (§27) |
| NoteQA | src/core/notes/NoteQA.ts | RAG Q&A over notes + memory (§27) |
| NoteChatConverter | src/core/notes/NoteChatConverter.ts | Chat/page → structured note draft (§27) |
| NoteFileSync | src/core/notes/NoteFileSync.ts | One-way app→filesystem .md sync (§27) |
| NoteMaintenance | src/core/notes/NoteMaintenance.ts | Staleness/orphan detection, bulk analysis (§27) |
| DiagnosticsPanel | src/components/options/DiagnosticsSection.tsx | Standalone view → Options → Diagnostics UI |

### §0.5 Implementation Guardrails & Risk Register (cost-effective models — READ FIRST)

This section keeps a cheap/fast implementer (Haiku, Gemini Flash, DeepSeek Flash) on the right track. It is the concentrated "how to not go wrong" checklist; the detailed rules live in the referenced sections.

#### §0.5.1 The 10 golden rules

1. **One phase per response.** Implement exactly one §18 phase (or sub-phase) at a time. Never jump ahead; later phases depend on earlier contracts.
2. **Never invent identifiers.** File paths come from §8.5 and §18; type names from **Appendix C** (harness/collaboration types → `@/types/harness`, §C.1); tool names from the ExecutorService enum; provider IDs are exactly `'openai' | 'anthropic' | 'gemini' | 'ollama'`; runtime tiers are exactly `'haiku' | 'flash'` (Appendix D).
3. **All prompts through the pipeline.** No React component or hook assembles a prompt directly. Every AI call consumes an `OptimizedContext` (§2.3) and routes through PersonaInjector (§1.3).
4. **Structured output = Zod + one repair only.** Use Appendix L's `requestJson`. Exactly one repair attempt, then throw `STRUCTURED_OUTPUT_FAILED`. Never hand-parse JSON with regex.
5. **Retries do not multiply.** Only three retry layers exist (ProviderRouter §1.5, AGT-04 replan, one per-stage retry) and they are bounded by tier caps §1.4. Never nest them (§1.6.1). See risk R-2 below.
6. **Respect the budgets.** Memory injection ≤ 1000 tokens / top-5 (top-3 tiny); working memory ≤ 300 tokens (§3.6); renderer ≤ 512 tokens (§1.2). If over budget, degrade per §2.4 — never silently truncate mid-structure.
7. **Retrieved data is never instructions.** Page/note/memory/tool output is `trust: 'retrieved'|'untrusted'` with `instructionAuthority: false` (§28.3, Appendix O.3). Wrap it as data.
8. **No success without evidence.** A side-effecting tool is "done" only with matching `CompletionEvidence` (§28.2, Appendix O.2). Cap exhaustion is `partial`, never `completed`.
9. **Every catch calls `debugLog(code, …)`** with a canonical error code from **Appendix C.2**. No empty catches. No new error strings.
10. **Every phase ends green.** A phase is not done until its `verify:phase-N` script (§24) passes. Stub `@implementation-tier: sonnet-class` modules; do not attempt them.

#### §0.5.2 Risk register (top failure modes → mitigation)

| ID | Risk (what a cheap model tends to do) | Mitigation (do this instead) | Ref |
|---|---|---|---|
| **R-1** | Invents a second module path for a type (e.g. `@/types/collaboration`) | All §C.1 types live in `@/types/harness` — see the Canonical Type Home table | §C.1 |
| **R-2** | Wraps retries so calls multiply (N×N×N cost blow-up) | One retry per layer; three layers max; all under tier caps | §1.6.1 |
| **R-3** | Calls a provider/EventSource/IndexedDB from the background SW | AI + IndexedDB live in Side Panel/Standalone only; SW does PROXY_FETCH/alarms | §0.2, §5.2 |
| **R-4** | Lets the LLM execute tools directly | Planner *requests*; ExecutorService *validates + runs* | §1.2 |
| **R-5** | Renders host-page UI or writes back to page fields in v0.1 | Content scripts are extraction-only; RICH-H-04/07 = clipboard-only | §0.2, R1 |
| **R-6** | Treats a `deferred`/`proposed` evolution candidate as active | `CandidateProposer` only proposes; activation is human-gated | §28.7a |
| **R-7** | Puts persona config in the fact store | Persona = user config in PreferenceMemoryStore (`np_persona`), not UserMemoryStore | R2, §3.5 |
| **R-8** | Skips the verifier and marks a write "done" | Postcondition verifier + `CompletionEvidence` required | §28.2 |
| **R-9** | Installs a banned package (framer-motion, x-sdk, langchain…) | Use only the approved stack in §7; see §0.2 package hygiene | §7, §0.2 |
| **R-10** | Logs raw prompt/tool bodies or secrets | Everything through `TraceRedactor` before persist/UI/export | §4.4 |

#### §0.5.3 Per-turn implementation checklist

Before returning code for a phase, confirm: (a) files match §8.5/§18; (b) types imported from the homes in §C.1; (c) a `verify:phase-N` script exists in `package.json` (§24); (d) at least one Zod fixture test per public boundary (§0.3); (e) every `catch` uses a §C.2 code; (f) no banned import; (g) worked example in **Appendix O** consulted for this phase (see the phase→example map in the Appendix O intro).

## §1 — Cost-Effective Runtime AI Architecture

### §1.1 Runtime Design Principle

NowPilot must assume the active runtime model may be cheap, fast, weaker at reasoning, small-context, local, or configured as the user's only provider. The system must not rely on the model to remember, decide tool safety, or preserve state.

Runtime AI uses: `PlannerService → ExecutorService → RendererService` with a bounded loop between Planner and Executor as defined in §1.4 and Appendix I.

NowPilot's runtime is a **coordinator-based agent platform**. The `Planner → Executor → Renderer` loop is the execution engine for a **single role**. A `CollaborationCoordinator` runs a `CollaborationPlan`; the **default configuration is a one-role plan**, which *is* the single-agent path. Selected complex workflows opt into multi-role plans (§30). Single-agent and multi-agent execution share one runtime, one tool-governance model, one memory model, one evaluation model, and one security model. See §1.6.

### §1.2 Planner → Executor → Renderer Flow

```
flowchart TD
User[User input from Side Panel or Standalone view] --> TxStart[AITransactionLog.start]
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
  z.object({
    action: z.literal('ask_clarification'),
    question: z.string().max(200),
    options: z.array(z.string().max(60)).max(4).default([]),   // RICH-C-04 option chips
  }),
]);
```

Rules:

- Use haiku tier where available (Appendix D).
- Return JSON only. Do not explain reasoning.
- Timeout: 3 seconds.
- One malformed-JSON repair retry only (Appendix L).
- If planner fails twice: fallback to `{ action: 'answer', reasonCode: 'planner_failed' }`.
- ExecutorService **must** narrow toolName to a closed z.enum derived from the currently registered tools before passing the schema to the model.

> **Note:** the `ask_clarification` branch is the runtime substrate for RICH-C-01 (AI-initiated clarification chips, §17.7). The `options` array (0–4 short strings) carries the clarification chips directly, so a single planner call yields both the focused question and the tappable options — no second LLM call is required. Tapping a chip injects its text into the `Sender`.

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

> **Note:** RendererService's structured card/table/checklist path is the substrate for RICH-C-05 follow-up chips and RICH-H-19 step-cards (§17.7).

### §1.3 Prompt Shape and Prompt Caching

Every AI call uses this canonical section order:

```
[SYSTEM: cached, canonical]            ← PersonaInjector prepends persona block here
[TOOL SCHEMAS: cached, canonical]
[USER PREFERENCES: compact]            ← includes persona overrides
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

### §1.6 Agent Platform Model (single-agent default, multi-agent opt-in)

NowPilot is a **bounded agent platform**, not a single-purpose chat loop and not an open-ended multi-agent swarm. One architecture serves both modes:

- **Default (single-agent):** every ordinary turn runs as a **one-role `CollaborationPlan`** — a single `AssistantRole` whose engine is the §1.2 `Planner → Executor → Renderer` loop under the §1.4 tier caps. There is no coordinator overhead beyond selecting the one-role plan. Routine chat, summarisation, rewriting, note Q&A, and simple retrieval always use this path.
- **Opt-in (multi-agent):** selected complex workflows (§30.3) activate a **multi-role plan** of two or more registered roles coordinated through typed handoffs and shared verified task state. Activation is explicit (user / workflow / allowed deterministic complexity policy); the planner alone can never silently enable it (COLLAB-01).

Invariants across **both** modes, enforced by the same modules:

- one `CollaborationCoordinator` owns sequencing, permission requests, side-effect commits, and termination (COLLAB-05);
- roles come from a **closed** `CollaborationRoleRegistry` (COLLAB-02) — no dynamic role or agent creation;
- tools run only through `ExecutorService` under `ToolCapabilityManifest` governance (§28.5);
- memory is system-owned (§3.1); workers never write durable memory/notes or execute side effects directly (COLLAB-06);
- every trajectory produces a structured `AgentTurnOutcome` with `CompletionEvidence` (§28.2).

**Forbidden in every mode (§0.2, §16.6):** open-ended agent-to-agent chat, dynamic unbounded spawning, peer-granted permissions, shared mutable worker memory, and treating agreement among roles as verification.

#### §1.6.1 Stage events, human-in-the-loop, and retry bounds

Three orchestration rules keep the coordinator predictable and cheap. They are **internal contracts**, not a runtime engine — NowPilot deliberately does **not** ship an event bus/emitter or the (deprecated) LlamaIndex Workflows engine.

- **Typed stage events (L1).** Each stage's input/output is a member of a **discriminated `StageEvent` union** (Appendix C.1), so a stage's shape is compile-time checked for Haiku/Flash implementers. This is a *type*, not an event system: the coordinator still calls stages directly in §18/§30 order.
- **Within-turn human input (L2).** A stage may emit an `input-required` `StageEvent` to pause **inside the current turn** for a clarification or a permission decision — surfaced as the `waiting-for-permission` / `ask_clarification` trajectory states (AGT-01). This is **within-turn only**; durable cross-session suspend/resume/rewind is explicitly **out of scope for v0.1** (§17.7.7) and deferred to v0.2+.
- **Bounded, non-multiplying retry (L3).** NowPilot has exactly **three** retry layers and they **must not multiply**:
  1. `ProviderRouter` — pre-first-token provider retry + circuit breaker (§1.5);
  2. Agent loop replan — the deterministic AGT-04 policy (§28.2);
  3. Per-stage coordinator retry — **at most one** retry per stage, after which the stage is terminal.

  All three are bounded by the tier caps in §1.4; the per-stage retry is simply AGT-04 applied once per stage. The coordinator MUST NOT nest these into an N×N×N fan-out — total planner/tool calls always stay under the `CollaborationPlan` caps (COLLAB-03).

This makes "single agent" the **degenerate one-role case** of the platform, so there is no second runtime to build later — multi-role workflows are added as **data** (roles + plans), not as a parallel architecture.

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
  activeSurface: 'sidepanel' | 'standalone'; // NEW in v0.1
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
  activeSurface: 'sidepanel' | 'standalone'; // NEW in v0.1
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

Memory is shared across surfaces — the Side Panel and Standalone view read the same memory stores through MemoryEngine.

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

> **Observational rolling summary (M2, enhancement).** The 12-message summariser MAY maintain a single **rolling observation log** — a dense running summary that *replaces* raw older turns as history grows, instead of appending isolated summaries. This keeps the injected `summary` small on long threads while preserving decisions, preferences, and open tasks. It is a refinement of the existing summariser, **not** a new store: it is **single-writer** on the primary surface (§13), lives only in `ConversationMemory.summary`, and never exceeds the tier's history budget (§2.2).

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

> **Note:** LLM-Wiki extracts memory-worthy facts from saved notes into this store via the existing MemoryExtractor schema. This is the **only** notes→memory direction (D-05); memory never auto-writes notes. The extraction runs on the primary surface only (§13).

### §3.5 Preference Memory

```ts
export interface UserPreferences {
  responseStyle: 'concise' | 'balanced' | 'detailed';
  preferredLanguage: string;
  preferStructuredOutput: boolean;
  allowCloudFallbackFromLocal: boolean;
  defaultProviderId?: ProviderId;
  toolAutonomy: 'ask_every_time' | 'allow_safe_tools' | 'manual_only';
  defaultSurface: 'sidepanel' | 'standalone';  // NEW in v0.1
  // NOTE: theme is NOT a preference field. Display mode (np_theme) and theme pack
  // (np_theme_pack) are the single source of truth in chrome.storage.sync,
  // surfaced via ThemeStore + getAntdConfig() and synced across surfaces by
  // chrome.storage.onChanged (§17.1a APPR-03/04/06, §15.1, Appendix F).
  // --- RICH persona (reconciliation R2: user config, NOT a fact) ---
  personaId?: string;
  personaOverrides?: {
    name?: string;
    tone?: 'professional-warm' | 'concise' | 'friendly';
    brevity?: 'brief' | 'balanced' | 'detailed';
  };
}
```

Preferences are injected as compact JSON, not verbose prose. **Persona configuration (RICH-R-05) persists in this store (`np_persona`), never in UserMemoryStore (reconciliation R2, §17.7.5).**

### §3.6 Working Memory (always-on user profile)

Working memory is a **single Markdown block** the system keeps continuously available — a cheap "always-on user profile" that suits tiny models better than top-k retrieval. It answers "what should I always know about this user?" (name, role, environment, standing preferences, long-term goals) without spending a retrieval pass.

```ts
// One block per resource (user); Markdown so it is human-editable and token-cheap.
export interface WorkingMemory {
  resourceId: string;            // user/owner scope (NOT thread) — see §3.1
  markdown: string;              // fixed template, see below
  tokens: number;                // enforced cap
  updatedAt: number;
}
export const WORKING_MEMORY_TEMPLATE = `# User Profile
- **Name**:
- **Role / Team**:
- **Environment**:
- **Preferences**:
- **Long-term Goals**:`;
```

**Ownership & guardrails (mandatory):**

- **Home store.** Working memory lives in **`UserMemoryStore`** as an *inferred* artefact (its facts have `source: 'inferred'|'explicit'`). It is **not** persona — persona is user *config* in `PreferenceMemoryStore` (R2, §3.5). Do not blur the two.
- **Budget.** It is injected as part of the memory section and counts against the **memory budget** (§3.4: ≤ 1000 tokens total; top-3 memories in tiny mode, §2.5). Cap the block (recommended ≤ 300 tokens) so it can never crowd out retrieved facts; if over budget, truncate the block **before** dropping retrieved facts.
- **Single-writer.** Updated only by the **primary surface** through `MemoryEngine` (§13). The Side Panel and Standalone view read the same block; they never write concurrently.
- **Privacy.** All writes pass through `TraceRedactor` (§4.4). Working memory is **never** written to notes or `.md` backups and must not contain secrets or raw customer data.
- **Scope.** Resource-scoped (per user), not thread-scoped — it persists across conversations, unlike `ConversationMemory` (§3.3).

*Implementation lands in Phase 5 (Knowledge Base — `UserMemoryStore`); see Appendix O.10 for a worked updater.*

## §4 — AI/MCP Transaction Logging and Diagnostics

### §4.1 Purpose

Every AI, MCP, skill, tool, context, cache, fallback, and provider operation must be traceable for troubleshooting.

AITransactionLog tracks: operation ID, provider/model, prompt token breakdown, context tier, truncation/compression decisions, prompt-cache hit/miss/write, MCP/tool calls, permission decisions, retries/fallbacks, errors, first-token timing, total duration, **workspaceId** (NEW), **activeSurface** — sidepanel | standalone (NEW).

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
  activeSurface?: 'sidepanel' | 'standalone'; // NEW in v0.1
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

> **Note:** LLM-Wiki extracted note content and filesystem paths are redacted before indexing/logging (§27.6). RICH feedback (👍/👎, RICH-C-10) is logged anonymously with no user-identifiable data.

### §4.5 Diagnostics UI

Diagnostics live in **Standalone view → Options → Diagnostics** (src/components/options/DiagnosticsSection.tsx).

The Side Panel does NOT contain the Diagnostics UI. It may show error toasts with a "Open Diagnostics" button that opens the Standalone view to the Diagnostics section, preserving operationId in the query string.

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
src/entrypoints/standalone/index.html            # Standalone view
src/entrypoints/standalone/main.tsx
src/entrypoints/content/core.content.ts            # extraction-only, ISOLATED world
src/entrypoints/content/servicenow-main.content.ts # MAIN world — ServiceNow g_ck only
src/entrypoints/popup/App.tsx
```

Background owns: chrome.sidePanel.setPanelBehavior, context menus, PROXY_FETCH, cookies, alarms, router startup.

Side Panel owns: AI streaming, MCP runtime, ProviderRouter, PromptCacheManager, ContextOptimizer, MemoryEngine, AITransactionLog, IndexedDB, WorkspaceStore (side-panel instance).

Standalone view owns: All Options screens, full-page Chat/Agent/Notes workspaces, TeamGQM full workspace, **LLM-Wiki + Filesystem Sync (§27)**, WorkspaceStore (standalone instance).

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

Canonical Standalone view entry point:

```ts
// src/entrypoints/standalone/main.tsx
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp, theme } from 'antd';
import { StandaloneShell } from '@/components/standalone/StandaloneShell';
import { getThemeStore } from '@/core/theme/ThemeStore';
const root = createRoot(document.getElementById('root')!);
root.render(<StandaloneShell />);
```

Complete wxt.config.ts — see **Appendix G**.

### §5.2 Background Service Worker Rules

- Register listeners synchronously at module load.
- Recreate alarms and context menus on every startup.
- Never run LLM or MCP streams in the SW.
- Use Promise.race plus AbortController for every async fetch.
- PROXY_FETCH timeout is 25 seconds unless a feature-specific timeout is lower.
- Side-panel/Standalone LLM streams continue independent of SW restart.

### §5.3 Side Panel Opening

- Use `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` in LifecycleManager.onInstalled and onStartup.
- Use `chrome.sidePanel.open({ tabId })` **only inside a user gesture** — action click or contextMenus.onClicked.
- The Side Panel is global per browser window; URL-specific navigation is filtered by SidePanelPageRegistry.

### §5.4 Standalone view Opening

The Standalone view is opened as an extension page: `chrome-extension://<extension-id>/standalone.html`

Opening rules:

- The Side Panel opens the Standalone view via `chrome.tabs.create({ url: chrome.runtime.getURL('standalone.html?workspaceId=' + wsId + '&conversationId=' + convId) })`.
- The command palette (Cmd+K) can open the Standalone view.
- Add-ons register standalonePages and users navigate to `standalone.html?page=<pageId>` — no add-on may call chrome.tabs.create directly.
- The Standalone view reads workspaceId/conversationId/page from the URL search params on mount and hands off to WorkspaceRouter.hydrateFromURL().
- Only one Standalone view per browser window at a time — WorkspaceRouter.openStandalone() deduplicates by scanning existing tabs matching chrome.runtime.getURL('standalone.html') before creating a new one.

### §5.5 Ant Design Setup

NowPilot uses Ant Design v6 as its primary design system, with Ant Design X 2.x presentation components (Bubble, Sender, Conversations, ThoughtChain, etc. — §7.2, §9) for Chat/Agent surfaces. `XProvider` (from `@ant-design/x`) **extends** antd's `ConfigProvider`, so each surface mounts **exactly one** provider — `XProvider` — and wraps `AntdApp` inside it. Never nest `ConfigProvider` inside `XProvider` (or vice-versa): that double-wraps theme/locale/icon context. Plain-AntD-only trees that render no X components may use `ConfigProvider` directly.

Side Panel:

```ts
// src/entrypoints/sidepanel/main.tsx
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';
function Root() {
  const { mode, pack } = useThemeStore(s => ({ mode: s.mode, pack: s.pack }));
  const cfg = getAntdConfig({ mode, pack, compact: true });         // ConfigProviderProps (theme + locale)
  return (
    <XProvider {...cfg}>                                       {/* XProvider ⊃ ConfigProvider — one provider */}
      <AntdApp>
        <SidePanelShell />
      </AntdApp>
    </XProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
```

Standalone view:

```ts
// src/entrypoints/standalone/main.tsx
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { StandaloneShell } from '@/components/standalone/StandaloneShell';
function Root() {
  const { mode, pack } = useThemeStore(s => ({ mode: s.mode, pack: s.pack }));
  const cfg = getAntdConfig({ mode, pack, compact: false });        // ConfigProviderProps (theme + locale)
  return (
    <XProvider {...cfg}>                                       {/* XProvider ⊃ ConfigProvider — one provider */}
      <AntdApp>
        <StandaloneShell />
      </AntdApp>
    </XProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
```

Rules:

- Mount exactly **one** provider per surface (`XProvider`). Do not also wrap in `ConfigProvider`.
- All imperative UI APIs (message, notification, Modal) MUST be accessed via App.useApp() — not the static message.* imports. This ensures theme + provider context is respected.
- The Side Panel uses theme.compactAlgorithm combined with the theme mode algorithm.
- The Standalone view does NOT use theme.compactAlgorithm — full density.
- Dark mode is switched via theme.darkAlgorithm (antd v6 pure CSS-variable mode — real-time switch, no `.dark` class, no full remount). Do not manipulate CSS classes directly for AntD components.
- Full details in Appendix F.

### §5.6 Content Script Rules (extraction-only)

Content scripts in v0.1:

- MAY extract page context, DOM text, selected text, ServiceNow session cookies, and SPA navigation events.
- MAY communicate with the Side Panel, Standalone view, or Background via RuntimeEnvelope<T>.
- MUST NOT render React or any UI.
- MUST NOT create Shadow DOM roots for UI.
- MUST NOT inject CSS or `<style>` tags.
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

The side panel contains **only Chat** (Ask-Gemini style, §17.1) — there is no nav rail and no surface switcher:

- Chat (the only Side Panel surface)
- Switch to Full chat (workspace handoff to the Standalone view, Flow 11)

Plus RICH welcome/quick-action/clarification/follow-up surfaces (§17.7), the composer toolbar (model selector · screenshot · attach · chat history · new chat), the status bar (provider · help · feedback), and quick "Save to note".

Agent, Note, Write, Tools, and TeamGQM are **not** in the Side Panel — they live in the Standalone Sider (§8.3, §17.2). Do NOT put heavy admin, diagnostics, provider management, prompt management, note-graph workflows, **LLM-Wiki management, or Filesystem Sync config** in the side panel.

#### Standalone view — Deep Work Workspace

> **Glossary — "Standalone view":** NowPilot's full-page surface, opened in its own browser tab (`standalone.html`). Code symbols use the `standalone` stem: the surface union value `'standalone'` (`activeSurface`/`defaultSurface`), `WorkspaceRouter.openStandalone`, `openedStandaloneTabId`, `StandalonePageRegistry`/`StandalonePageRegistration`, entrypoint `src/entrypoints/standalone/`, and message type `OPEN_STANDALONE`. The Side Panel's handoff button keeps its distinct label **"Switch to Full chat"** (it describes the action of continuing the current chat in the larger surface).

The Standalone view is an extension page opened in a normal browser tab at: `chrome-extension://<extension-id>/standalone.html`

It is optimized for **deep work, configuration, diagnostics, and large workspace screens**. It uses AntD Layout with a Sider navigation.

The Standalone view contains:

- Chat (full-screen)
- Agent (full-screen, shares workspace with Chat)
- Notes (full workspace: list, editor, backlinks, graph, **+ LLM-Wiki + Filesystem Sync**)
- TeamGQM (add-on, full-page)
- Options (all configuration and diagnostics)

### §6.3 Architecture Separation

- **Core layer** — AI providers, storage, messaging, context pipeline, agent orchestration, MCP client, memory, transaction logging, workspace store, **page-content extraction (PageContentService)**, **LLM-Wiki services (NoteTagger/NoteQA/NoteChatConverter/NoteFileSync/NoteMaintenance)**, and **persona (PersonaProfile/PersonaInjector)**.
- **Add-on layer** — site-specific context extraction, skills, side-panel pages, standalone pages. ServiceNow ships as first-party add-on. Write and TeamGQM are first-party add-ons.

Core never knows about specific websites. Add-ons never bypass core APIs.

### §6.4 Design Principles

- **Privacy by default:** local providers (Ollama, LM Studio) are first-class.
- **Two surfaces, one workspace:** side panel and standalone view share a WorkspaceStore.
- **Extensible via add-ons:** add-ons register pages on either surface (never inject into host pages in v0.1).
- **Cost-effective by design:** every prompt goes through ContextOptimizer and the Planner → Executor → Renderer pipeline.
- **Offline-capable:** the extension works with local models only.
- **Knowledge-first:** the product data-flow is acquire → store → understand → display → extend; PageContentService, Notes, and LLM-Wiki are the core, not late add-ons.
- **RICH conversational UX:** persona-driven, intention-aware, clarifying, hybrid-UI experience on Ant Design X.

### §6.5 Scope Fences

**In scope for v0.1:**

- Side panel shell (Chat, Agent, Write, TeamGQM, Open Standalone view)
- Full app shell (Chat, Agent, Notes, TeamGQM, Options)
- Shared WorkspaceStore across both surfaces
- 4 provider adapters (OpenAI, Anthropic, Gemini, Ollama)
- PageContentService (core) — layered page extraction (Defuddle → APC-lite DOM walk), feeding ContextOptimizerInput.pageContext, indexed by MiniSearch.
- Persistent memory (conversation + user + preference)
- 12 built-in MCP tools + external MCP client
- ServiceNow add-on (data extraction + side-panel/standalone UI only)
- Write add-on (side-panel primary; optional standalone page)
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
| wxt | ^0.21 (≥ 0.21.4) | MV3 scaffold, HMR, manifest generation. **Rev 2026-08-12:** bumped from the draft `^0.19` (WXT is `0.x`, so `^0.19` would not auto-jump). v0.21 is breaking: **Node.js ≥ 22, Vite ≥ 6.3.4, TypeScript ≥ 5.4**, and `vite`/`web-ext`/`typescript` are now **peer dependencies** (add `vite` to devDependencies; `web-ext` optional for auto-open). Install footprint cut ~78%. |
| @wxt-dev/module-react | ^1 (≥ 1.1.6) | React integration. **Rev 2026-08-12:** bumped from `^0.3` — the module reached **v1.x** (adds WXT v0.20/0.21 support); `^0.3` cannot resolve to 1.x. |

### §7.2 UI

| Package | Version | Purpose |
|---|---|---|
| react / react-dom | ^19 | UI framework |
| antd | ^6 | Ant Design v6 — primary component library |
| @ant-design/icons | ^6 | Ant Design icon set (must match antd major version) |
| @ant-design/x | ^2 | Ant Design X — AI chat presentation components (Bubble, Sender, Conversations, Prompts, Welcome, Attachments, Suggestion, Actions, ThoughtChain, Think, FileCard, Sources, Folder) — RICH building blocks |
| @ant-design/x-markdown | ^2 | Streaming-aware Markdown renderer with built-in LaTeX, mermaid, and code-highlight plugins. Replaces react-markdown/remark-gfm/rehype-highlight/highlight.js/katex. |
| motion | ^12 | Framer Motion (import from `motion/react`). **Do not install framer-motion.** **Rev 2026-08-12:** current latest is v13 (framer-motion 13.x); v12 remains fully React-19-compatible, so `^12` is retained as a conservative pin. Optionally move to `^13` for the newest features — the `motion/react` import surface is unchanged. |

**Explicitly removed from v0.1:** tailwindcss, @tailwindcss/vite, shadcn/ui, @radix-ui/react-*, class-variance-authority, clsx, tailwind-merge, react-markdown, remark-gfm, rehype-highlight, highlight.js, katex (superseded by @ant-design/x-markdown).

**Explicitly not adopted in v0.1 (see §0.2, §23, §25.6):** @ant-design/x-sdk, @ant-design/x-card.

### §7.3 State

| Package | Version | Purpose |
|---|---|---|
| zustand | ^5 | Global stores (workspace, theme, chat) |
| immer | ^11 (≥ 11.1.16) | Immutable updates. **Rev 2026-08-12:** bumped from `^10` — Immer is now on **v11** (`^10` cannot resolve to 11.x). v11 also carries prototype-pollution hardening; the `produce`/draft API is unchanged. |

### §7.4 AI & Workflow

| Package | Version | Purpose |
|---|---|---|
| ai | ^5 (min modern baseline; latest 7.x) | Vercel AI SDK: streamText, tool calling, abort. **Rev 2026-08-12:** bumped from `^4` (three majors stale). AI SDK **v5** is the first "modern unified" line and the minimum this spec's code shape targets; latest stable is **7.x** (Aug 2026). Pin to the **current major at implementation time**. **Breaking vs v4** (insulated by the `ILLMProvider` abstraction, §10.1): tool `parameters` → `inputSchema`, `maxTokens` → `maxOutputTokens`, `maxSteps` → `stopWhen: stepCountIs(n)`, message `parts` model. Provider factories (`createOpenAI/createAnthropic/createGoogleGenerativeAI`) are unchanged. |
| @ai-sdk/openai | current major (≈ 4.x) | OpenAI + Ollama (custom baseURL for OpenAI-compatible providers). **Rev 2026-08-12:** the `@ai-sdk/*` provider packages **version independently** — do **not** pin them to one shared `^1`. Install each at its own current major (openai ≈ 4.x, google ≈ 3.x, anthropic ≈ 3.x) matched to the chosen `ai` core version. |
| @ai-sdk/anthropic | current major (≈ 3.x) | Anthropic Claude (see note above — independent major). |
| @ai-sdk/google | current major (≈ 3.x) | Google Gemini (see note above — independent major). |
| @modelcontextprotocol/sdk | ^1 (≥ 1.30) | MCP client — StreamableHTTP transport. ✓ current (caret resolves to 1.30.x). Note: the SDK now imports `zod/v4` internally but stays back-compatible with Zod v3.25+ — consistent with the Zod 4 bump below. |
| zod | ^4 (≥ 4.4) | Boundary validation. **Rev 2026-08-12:** bumped from `^3` — **Zod 4 is stable** (root `zod` export), ~14× faster parsing, and is the version the MCP SDK and AI SDK 5+ already target. Existing `z.object(...)` schemas are source-compatible; review the [migration guide](https://zod.dev/v4) for edge cases (error `.issues` shape, `.email()` → `z.email()`). |
| zod-to-json-schema | `^3` — **KEEP in v0.1** | Zod → JSON Schema for tool definitions. **Rev 2026-08-12 (definitive for implementers):** **v0.1 keeps `zod-to-json-schema` exactly as written in Appendix L** — do **not** change that code. Zod 4 also ships native `z.toJSONSchema()`, but migrating to it is a **v0.2 cleanup** (tracked, not in scope for any v0.1 phase). This avoids ambiguity: a Phase-implementer uses `zodToJsonSchema(schema)` per Appendix L and nothing else. |

### §7.5 Storage

| Package | Version | Purpose |
|---|---|---|
| idb | ^8 | Typed IndexedDB wrapper |
| **yaml** | ^2 | YAML frontmatter parse/serialize for LLM-Wiki .md files (§27) |

### §7.6 Extraction & Text

| Package | Version | Purpose |
|---|---|---|
| defuddle | ^0.19 (≥ 0.19.2) | Primary main-content extraction → clean Markdown (Readability successor; preserves footnotes/math/code, richer metadata). Use the **`defuddle/full`** bundle (adds `mathml-to-latex` + `temml` for reliable Markdown/math). Call `parse()` **synchronously** with `{ markdown: true, url, useAsync: false }` — `useAsync:false` disables Defuddle's third-party API extractors (e.g. FxTwitter), which is mandatory for the privacy-first, no-data-leaves-the-machine posture (§0.2, §6.1). `^0.6` (spec draft) is superseded — see §23 ADR. |
| @mozilla/readability | ^0.6 (≥ 0.6.0) | Fallback article extraction when Defuddle yields low-confidence output. **Rev 2026-08-12:** bumped from `^0.5` — 0.6.0 is current (Readability is `0.x`, so `^0.5` would not auto-jump to 0.6). API (`new Readability(doc).parse()`) unchanged. |
| turndown | ^7 | HTML → Markdown (used by APC-lite path / non-Defuddle output) |
| dompurify | ^3 | XSS sanitisation for AI/tool output |

**Rationale:** Defuddle is a drop-in Readability replacement built for exactly this job (see §23 ADR). MIT-licensed. **Version note (rev 2026-08-12):** pinned to `^0.19` (≥ 0.19.2), not `^0.6`. Because Defuddle is a `0.x` package, `^0.19` correctly locks the `0.19.x` line (npm caret on a pre-1.0 package does **not** auto-jump minors), so a future `0.20` breaking change is not pulled in automatically. The `0.19.x` line adds the CVE-2026-30830 XSS fix and `data:`/`blob:` URL rejection, iframe-`sandbox` retention, and SVG `<style>` stripping — directly relevant since PageContentService parses arbitrary untrusted host-page HTML (§16.1). DOMPurify (§16.1) still runs on output; Defuddle hardening is defense-in-depth, not a replacement.

### §7.7 Search & Data

| Package | Version | Purpose |
|---|---|---|
| minisearch | ^7 | Local full-text search (notes index + ephemeral page index) |
| d3-force | ^3 | Note graph layout (Standalone view) |
| fflate | ^0.8 | ZIP export |
| papaparse | ^5 | CSV parsing |

### §7.8 Security & Testing & DX

| Item | Purpose |
|---|---|
| crypto.subtle (native) | AES-GCM encryption |
| crypto.randomUUID() (native) | ID generation |
| vitest, @testing-library/react, jsdom, msw | Testing |
| typescript ≥5.5, strict: true | Type safety. **Rev 2026-08-12:** `≥5.5` is a floor and remains valid (WXT 0.21 requires TS ≥ 5.4). Current releases are **TS 6.0** (last JS-based compiler; removes long-deprecated APIs) and **TS 7.0** (native Go compiler, preview→stable). Recommend developing on **TS 6.x** now; treat TS 7 as a fast-follow once the toolchain (WXT/Vite/vitest) certifies it. |
| eslint, prettier | Linting / formatting |
| **@types/wicg-file-system-access** | TypeScript types for File System Access API (§27) |

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
│   └── WorkspaceRouter           opens Standalone view, dedupes existing tabs
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
│   └── UI: Chat / Agent / Write (add-on) / TeamGQM (add-on) / Open Standalone view + RICH surfaces
│
├── Standalone view (app/main.tsx)                               [persistent tab]
│   ├── AntD ConfigProvider (default density) + AntdApp
│   ├── StandaloneShell + StandaloneRouter (AntD Layout w/ Sider)
│   ├── Same core services as Side Panel (single-writer coordination via WorkspaceStore)
│   ├── LLM-Wiki services (NoteTagger/NoteQA/NoteChatConverter/NoteFileSync/NoteMaintenance)
│   └── UI: Chat / Agent / Notes (+LLM-Wiki) / TeamGQM / Options
│
├── Content Scripts (extraction-only)
│   ├── ContentScriptHost         message bridge only, no UI mount
│   ├── SPANavigationWatcher      MutationObserver
│   ├── PageContextBridge         extracted context → side panel / standalone view
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
- Registries (AddonRegistry, EndpointRegistry, KeymapRegistry, SidePanelPageRegistry, StandalonePageRegistry)
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

| Aspect | Side Panel | Standalone view |
|---|---|---|
| Width | ~400 px (Chrome default) | Full browser viewport |
| Density | AntD **compact** algorithm | AntD default density |
| Purpose | Fast, context-adjacent workflows | Deep work, config, diagnostics |
| Pages | Chat, Agent, Write, TeamGQM, Open Standalone view | Chat, Agent, Notes (+LLM-Wiki), TeamGQM, Options |
| Persistence | Persistent while open | Persistent tab |
| Opened by | Chrome action button, keyboard shortcut, context menu | "Open Standalone view" action, command palette, options link |
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
- activeSurface: 'sidepanel' | 'standalone'
- openedStandaloneTabId?: number

Persistence:

- Workspace metadata → chrome.storage.local.np_workspace
- Cross-surface sync → BroadcastBus (see §13, §20)
- Only one surface may be the **primary writer** at a time; election via BroadcastBus

Handoff URL format for Open Standalone view: `chrome-extension://<id>/standalone.html?workspaceId=<uuid>&conversationId=<uuid>&page=<pageId>`

Full details in Appendix M.

### §8.5 File Structure

```
nowpilot/
├── wxt.config.ts                            # Appendix G
├── src/
│   ├── entrypoints/
│   │   ├── background.ts
│   │   ├── sidepanel/{index.html, main.tsx}
│   │   ├── app/{index.html, main.tsx}                # Standalone view
│   │   ├── content/core.content.ts                    # extraction-only
│   │   └── popup/App.tsx
│   │
│   ├── core/
│   │   ├── ai/**
│   │   │   └── persona/{PersonaProfile, PersonaInjector}.ts
│   │   ├── mcp/{MCPClient, MCPRegistry, mcpToVercelAI, NowPilotMainServer}.ts
│   │   ├── context/**
│   │   ├── memory/**
│   │   ├── telemetry/**
│   │   ├── storage/**  (+ migrations/ … v4: notes_backup_config)
│   │   ├── security/{KeyVault, redactSensitive}.ts
│   │   ├── runtime/{RuntimeEnvelope, OperationId, BroadcastBus, PortReader, workerState}.ts
│   │   ├── messaging/MessageBus.ts
│   │   ├── events/EventBus.ts
│   │   ├── workspace/{WorkspaceStore, WorkspaceRouter, WorkspaceSync}.ts
│   │   ├── theme/{ThemeStore, antdConfig}.ts
│   │   ├── content/{ContentScriptHost, SPANavigationWatcher, PageContextBridge, AxDomWalker}.ts
│   │   ├── chrome/{CookieSessionStore, CORSProxy, ContextMenuHost, TabManager, NotificationsManager, ClipboardHelper, Scheduler}.ts
│   │   ├── prompts/**
│   │   ├── slash/SlashCommandRegistry.ts
│   │   ├── search/MiniSearchIndex.ts
│   │   ├── intent/IntentClassifier.ts
│   │   ├── notes/
│   │   │   ├── LinkParser.ts, NoteGraph.ts                                    # Phase 5 (atomic notes + wikilinks)
│   │   │   ├── NoteTagger.ts (§27)
│   │   │   ├── NoteQA.ts (§27)
│   │   │   ├── NoteChatConverter.ts (§27)
│   │   │   ├── NoteFileSync.ts (§27)
│   │   │   └── NoteMaintenance.ts (§27)
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
│   │   ├── registry/{AddonRegistry, Registry, AddonSettingsStore, SidePanelPageRegistry, StandalonePageRegistry}.ts
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
│   │   ├── app/{StandaloneShell, StandaloneRouter}.tsx
│   │   ├── pages/{ChatPage, AgentPage, NotesPage, OptionsPage}.tsx
│   │   ├── options/{Providers, Models, MCP, Prompts, Slash, Diagnostics, Memory, ImportExport, FeatureFlags, AddonSettings, Persona, Notes}Section.tsx   # +Persona +Notes
│   │   ├── notes/{BacklinksPanel, WikilinkAutocomplete, NoteGraphView, NotePreview, SaveToNoteDialog}.tsx    # +SaveToNoteDialog
│   │   ├── rich/{WelcomeCards, QuickActionChips, ClarificationChips, FollowUpChips, PersonaHeader, StageIndicator, ClosureZone, ContextPane, TemplateCatalog, CodeBlockActions, StepCards}.tsx
│   │   ├── patterns/{ChatMessage, HistoryListItem, ToolCard, SkillMessageRenderer, SourceCard}.tsx
│   │   └── OnboardingModal.tsx
│   │
│   ├── hooks/{useChat, useStreamingLLM, useProviderRouter, useMemory, useDiagnostics, useConversations, useAddonContext, useWorkspace, useTheme, usePersona, useRichSuggestions}.ts   # +usePersona +useRichSuggestions
│   └── types/{messages, storage, errors, addon, workspace, notes, persona, harness}.ts   # +notes +persona +harness(§C.1)
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
| Open Standalone view action | P0 | Opens standalone.html with workspace handoff (Flow 11) |
| Provider/model selector | P0 | Read-only in side panel — edit lives in Options |
| Quick save to note | P1 | "Save this response as note" quick action (lightweight, non-LLM) |
| Slash commands | P1 | /write, /ask, /research, etc. |
| Tab pinning | P1 | Max 10 pinned |
| Selection → Ask AI | P1 | Right-click context menu → opens side panel with selection prefilled |
| Theme toggle | P1 | light/dark/auto |
| Cmd+K palette | P1 | Includes "Open Standalone view" |
| Error toast + "Open Diagnostics" link | P1 | Diagnostics lives in Standalone view → Options |

**RICH additions:** Persona header (RICH-H-01), Welcome cards (RICH-I-01), Context-aware quick-action chips (RICH-I-05/06), Clarification chips (RICH-C-01), Follow-up chips (RICH-C-05), Streaming stage indicators (RICH-H-08).

The side panel intentionally does NOT include: Notes editor, DiagnosticsPanel, PromptManager, ProvidersEditor, MCP servers editor, Feature flag editor, Import/Export, **LLM-Wiki management, Filesystem Sync config**.

### §9.2 Standalone view Features

| Feature | Priority | Notes |
|---|---|---|
| Chat (full-screen) | P0 | Shares WorkspaceStore + conversation with side panel |
| Agent (full-screen) | P0 | Shares WorkspaceStore + conversation with Chat |
| Notes | P0 | List, editor, wikilinks, backlinks, graph, search, **+ LLM-Wiki + Filesystem Sync (§27)** |
| TeamGQM add-on (full-page) | P0 | Full workspace for TeamGQM add-on |
| Options | P0 | See §9.3 |
| First-run onboarding entry point | P0 | If user opens Standalone view without provider configured (+ RICH-R-03 persona card) |
| Cmd+K palette | P1 | Same command set as side panel + Standalone-only commands |
| Command "Focus Side Panel" | P1 | Programmatically opens side panel for current tab |

### §9.3 Options Page

Options is a Standalone page with the following sections, each accessible via a left-side Menu inside a Layout:

| Section | Purpose |
|---|---|
| **General** | **Account (name/email/log-out); AI access (Service provider select + provider grid → Set-up dialog §17.2d); Appearance (Display mode Light/Dark/Auto + Theme pack Default/Liquid Glass/Claude Warm), display language, font size, side-panel position — see §17.1a** |
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
| **Persona** | Edit AI name, tone, brevity (RICH-R-04) |
| **Notes** | LLM feature toggles, backup folder config, bulk maintenance (§27) |
| About | Version, license, links |

### §9.4 Add-on Contract

Add-ons register with the AddonRegistry at side-panel or standalone startup. They may declare:

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
  standalonePages?: StandalonePageRegistration[];
  addonSettings?: z.ZodSchema<unknown>;
  keymap?: KeymapRegistration[];
}
```

**Note:** the contentScript UI mount interface (IContentAddon) is removed. Add-ons no longer render UI into host pages. Content-script logic for **extraction** still exists via contextExtractor and generic PageContextBridge.

Rules:

- Each add-on MUST declare a Zod addonSettings schema (may be z.object({})).
- Standalone pages MUST live under src/addons/<id>/pages/Standalone*.tsx.
- Side-Panel pages MUST live under src/addons/<id>/pages/SidePanel*.tsx.
- Add-ons MUST NOT import from src/components/pages/** or from other add-ons.

### §9.5 Write Add-on

**Location:** src/addons/write/ · **Scope:** global

**Side Panel Page:** SidePanelWritePage — quick actions: Rewrite professionally · Summarize · Draft customer update · Draft internal note · Explain technical issue · Create action plan · Generate concise status update.

**Skills:** DraftSkill, RewriteSkill, SummarizeSkill, CustomerUpdateSkill.

**Standalone view Page:** Not required in v0.1 (side-panel-only). If added later, it must live in src/addons/write/pages/StandaloneWritePage.tsx.

**Input source:** current clipboard, selected text (via SelectionContextMenu), pinned tab context, or free-form text area.

**Output:** streamed markdown; user actions include "Copy", "Insert into chat", "Save as note".

### §9.6 TeamGQM Add-on

**Location:** src/addons/teamgqm/ · **Scope:** global (v0.1)

**Side Panel Page:** SidePanelTeamGQMPage — compact quick view: Latest TeamGQM digest · Quick action buttons · Link to full page.

**Standalone view Page:** StandaloneTeamGQMPage — full workspace: History · Reports · Detailed views · Shared workspace context (same conversationId as Chat/Agent).

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

**Out of scope (v0.1):** CaseInsightBox (page-injected UI), serviceNowInjection.ts (Shadow DOM mount), scoped page UI enhancements. ServiceNow value is delivered inside the side panel and Standalone view only.

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
export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama';
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

### §10.2 Four Provider Implementations

| Provider ID | Adapter | Default baseURL | Supports tools |
|---|---|---|---|
| openai | @ai-sdk/openai createOpenAI | https://api.openai.com/v1 | Yes |
| anthropic | @ai-sdk/anthropic createAnthropic | https://api.anthropic.com | Yes |
| gemini | @ai-sdk/google createGoogleGenerativeAI | Google Cloud | Yes |
| ollama | @ai-sdk/openai createOpenAI | http://localhost:11434/v1 | Model-dependent |

Ollama: pass apiKey: 'ollama'. Default context is 2048 tokens — warn the user (Flow 5). ProviderRegistry computes resolvedBaseURL = customBaseURL ?? baseURL once at construction. For OpenAI-compatible providers (e.g. DeepSeek, Together AI), use `openai` with a custom `baseURL`.

### §10.3 Provider Config Schema

```ts
export const ProviderConfigSchema = z.object({
  id: z.enum(['openai','anthropic','gemini','ollama']),
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

- Lives in the side panel and Standalone view. Never in the background service worker.
- Uses @modelcontextprotocol/sdk Client + StreamableHTTPClientTransport.
- Never hand-roll SSE parsing.
- First-time tool call triggers a permission dialog (Flow 2). Allow/deny persisted in np_mcp_permissions.
- Dangerous tools always prompt regardless of allow list.

### §10.5 NowPilotMainServer — 12 Built-in Tools

| # | Tool name | Input | dangerous | Effect |
|---|---|---|---|---|
| 1 | get-page-content | { tabId?: number } | no | Active/pinned tab context via PageContentService (core, layered: Defuddle → APC-lite → ServiceNow API) |
| 2 | search-notes | { query: string; limit?: number } | no | MiniSearch over notes (title + content + tags + summary) |
| 3 | create-note | { title: string; content: string; tags?: string[] } | yes | Writes to NotesDB (triggers NoteTagger + NoteFileSync save pipeline) |
| 4 | get-chat-history | { sessionId?: string; limit?: number } | no | Recent messages |
| 5 | pin-tab | { tabId: number } | no | Pins as context (max 10) |
| 6 | read-clipboard | {} | no | Reads clipboard |
| 7 | write-clipboard | { text: string } | yes | Writes clipboard |
| 8 | get-provider-info | {} | no | Active provider + model + limits |
| 9 | run-skill | { skillId: string; input: unknown } | yes | Runs a registered skill |
| 10 | list-skills | {} | no | Lists registered skills |
| 11 | export-data | { scopes: string[] } | yes | Export bundle (no API keys) |
| 12 | execute-webhook | { event: string; payload: unknown } | yes | Fires a webhook |

> **Tool-design guardrails (M4).** When adding or exposing tools (built-in or MCP), follow these principles — they keep the planner's tool budget small and behaviour predictable for cheap models:
> - **Minimise surface area.** Prefer a few **workflow-shaped** capability tools (e.g. `search-notes`, `get-page-content`) over many narrow endpoint tools; a smaller enum is easier for Haiku/Flash to select correctly.
> - **Read-only by default.** A tool is `dangerous: false` unless it has a side effect; side-effecting tools are the minority and each carries a `ToolCapabilityManifest` (§28.5) with a postcondition verifier.
> - **Deterministic & bounded.** Tools validate input/output with Zod, are size-limited and redacted (TOL-04), and write tools are idempotent (TOL-05).
> - **Discoverable.** When the combined schemas exceed the tools budget, use active discovery (TOL-06) rather than injecting every schema.

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

Applies to Side Panel Chat and Standalone view Chat.

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

### Flow 3 — Save a Note (Standalone view Notes only)

LinkParser.parseLinks → resolveLinks → NotesDB.put → EventBus.emit('note:saved'). **Note:** the save pipeline additionally runs NoteTagger.analyze() (non-blocking), NMEM-02 memory upsert (primary surface only), and NoteFileSync.sync() (see §27, Flow 12).

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

AntD Modal with Input + filtered list. Commands include Open Standalone view, Focus Side Panel, Open Options, etc.

### Flow 11 — Open Standalone view (Workspace Handoff)

- Read current WorkspaceState.
- WorkspaceRouter.openStandalone: persist workspace via BroadcastBus flush; query existing app tabs; update or create.
- Standalone view boots → WorkspaceStore.hydrateFromURL().
- Standalone view fires WORKSPACE_HANDOFF via BroadcastBus.
- Side panel demotes to read-only mirror until refocused.

### Flow 12 — Save to Note (LLM-Wiki)

- User clicks "Save to note" on an assistant message (ChatMessage three-dot menu or first-class button, RICH-H-06).
- SaveToNoteDialog opens.
- NoteChatConverter.convert(messages, memoryContext) drafts title, content (markdown), tags, wikilinks, categoryPath (haiku tier + MemoryEngine.assemble(), NMEM-03).
- Dialog shows a pre-filled NoteEditor + NotePreview. **User is always the gatekeeper.**
- User edits → save → NotesDB.createNote() → save pipeline: NoteTagger merge + NMEM-02 upsert (primary surface) + NoteFileSync.sync().

### Flow 13 — Ask Your Notes (RAG)

- User types a question in the Notes "Ask notes" bar (LLM-WIKI-06).
- NoteQA.ask(query): MiniSearch top-5 snippets + MemoryEngine relevant facts (NMEM-01).
- Flash-tier synthesis with per-statement citations.
- Rendered as an ephemeral @ant-design/x Bubble with clickable citation Tags that navigate to the source note.
- Tiny mode: falls back to plain MiniSearch results, no LLM synthesis (§2.5).

### Flow 14 — Set/Change Backup Folder

- Options → Notes → "Set backup folder" (SYNC-01).
- showDirectoryPicker() (**Standalone view only**) → FileSystemDirectoryHandle persisted in notes_backup_config IndexedDB store.
- Status Tag turns green "Backup: On".

### Flow 15 — Restore from Folder

- Options → Import/Export → "Restore from folder" (SYNC-09).
- showDirectoryPicker() → walk tree → parse .md YAML frontmatter.
- Preview modal: "Found N notes (X new, Y updated, Z unchanged)" (SYNC-10).
- User confirms → additive upsert into IndexedDB (never deletes local notes not in folder).

### Flow 16 — RICH Clarification & Follow-up

- Ambiguous intent → Planner returns ask_clarification → focused question + 2–4 option chips in the Bubble (RICH-C-01/04); chips inject into Sender; max 2 rounds then best-effort with caveat (RICH-C-03).
- After a response, 1–3 follow-up chips are generated by a non-blocking haiku suggestion call (RICH-C-05/08); tapping sends as the next message; degrades to none on timeout.

### Flow 17 — Open Chat History
- **Side Panel:** composer 🕘 → **bottom sheet** slides up over a dimmed conversation (§17.1b).
- **Standalone view:** 🕘 → **right drawer** slides in over the dimmed content area, Sider stays visible (§17.2b).
- Shared: **All / Starred** tabs, search, day-grouped items; item `…` overflow = rename/delete/star; tap loads the conversation. `useChatHistory` backs both surfaces.

### Flow 18 — Configure a Provider
- Options → General → AI access → provider card **Set up** → provider `Modal` (§17.2d).
- Enter API key (eye toggle) → optional proxy `Switch` + URL → **Check** (`validateConfig`) → edit model list (per-model enable `Switch`, **Update list** via `getModels`, **+** add custom) → **Save** persists `ProviderConfigSchema`. Enabled models populate the composer model selector.

### Flow 19 — Change Appearance (Display Mode + Theme Pack)
- Options → General → Appearance → **Display mode** (Auto/Light/Dark → `np_theme`) and **Theme pack** (Default/Liquid Glass/Claude Warm → `np_theme_pack`).
- Both write only to `chrome.storage.sync`; `chrome.storage.onChanged` applies them to **both** surfaces in real time via `getAntdConfig({ mode, pack, compact })` (§17.1a).

## §12 — Component State Matrix

Every page must render these states with these exact strings (from STR in Appendix B).

| Component | Surface | Loading | Empty | Error | Success |
|---|---|---|---|---|---|
| ChatPage | Side Panel + Standalone view | "Connecting to provider..." | "Start a conversation" | "Provider error. [Retry] [Switch Provider]" | Message stream visible |
| AgentPage | Side Panel + Standalone view | "Preparing agent..." | "Describe a task and the agent will plan steps" | "Agent error: [message]. [Retry]" | Step progress visible |
| WritePage | Side Panel | "Preparing..." | "Choose an action or paste text" | "Write skill failed: [message]. [Retry]" | Streamed output visible |
| TeamGQMPage (side panel) | Side Panel | "Loading..." | "No TeamGQM context available" | "Failed to load. [Retry]" | Summary + actions |
| NotesPage | Standalone view | "Loading notes..." | "No notes yet. Press + to create one." | "Failed to load notes. [Retry]" | Note list |
| NoteEditor | Standalone view | "Loading note..." | — | "Failed to save note. [Retry]" | Editor visible |
| NoteGraph | Standalone view | "Building graph..." | "Create at least 3 notes to see the graph" | "Failed to render graph. [Retry]" | Graph visible |
| OptionsPage | Standalone view | "Loading settings..." | — | "Failed to load settings" | Section content visible |
| DiagnosticsPanel | Standalone view → Options | "Loading diagnostics..." | "No AI transactions yet." | "Failed to load traces" | Transaction list |
| Research | Both | "Researching..." | "Enter a research question" | "Research failed: no web-search tool connected. [Open Settings]" | Answer + SourceCards |
| ChatHistoryDB load | Both | Skeleton shimmer | "No conversations yet" | "Failed to load history" | Conversation list |
| MCP tool call | Both | "Calling [toolName]..." | — | "Tool failed: [error]. [Retry tool]" | Tool result card |
| Tab pin | Side Panel | "Extracting page content..." | — | "Cannot pin this page. Try a regular web page." | Page title + remove |
| Provider validation | Standalone view → Options | "Testing connection..." | — | "Connection failed: [error]" | "Connected" |
| Onboarding | Both | "Testing connection..." | — | "Connection failed: [error]" | "Connected" → focus composer |
| Open Standalone view | Side Panel button | "Opening standalone view..." | — | "Failed to open Standalone view" | New tab focused |
| **Ask Notes (RAG)** | Standalone view | "Searching your notes..." | "Ask a question about your notes" | "Couldn't answer from notes. [Retry]" | Bubble answer + citations |
| **Backup status** | Standalone view | "Checking backup folder..." | "Backup: Off [Configure]" | "Backup: Error (tooltip)" | "Backup: On" (green) |
| **Restore from folder** | Standalone view | "Reading backup folder..." | "No .md notes found" | "Failed to read folder. [Retry]" | Preview modal |
| **Welcome cards** | Both | — | 4–6 capability cards | — | Card populates Sender |
| **Clarification chips** | Both | — | — | — | Question + option chips |

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
- **Cross-surface workspace coordination.** Both side panel and Standalone view may load simultaneously. BroadcastBus elects a primary writer: election key np_workspace_primary in chrome.storage.session; on startup each surface writes { tabId, surface, electedAt } with compare-and-set; only the primary writes memory/notes/chat-history bodies; secondary surfaces mirror; if primary tab closes → next surface auto-promotes on next heartbeat (max 3 s latency).

**Additional concurrency rules:**

- **NoteFileSync is fire-and-forget with a 50 ms debounce** after the IndexedDB write; never blocks the save UI (§27 SYNC-03).
- **NMEM-02 memory upsert from notes runs only on the primary surface** (same single-writer rule as all memory writes).
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

### §14.5 Dynamic Per-Call Tool Approval (M3)

`UserPreferences.toolAutonomy` (`ask_every_time` | `allow_safe_tools` | `manual_only`, §3.5) sets the baseline. On top of that baseline, approval can be decided **per call** so risk scales with the actual arguments, not just the tool identity — this is the runtime expression of TOL-02 ("risk- and side-effect-based permission policy", §28.5).

```ts
// src/core/ai/ToolApprovalPolicy.ts
import type { ToolCapabilityManifest } from '@/types/harness';

export type ApprovalDecision = 'allow' | 'require-approval' | 'deny';

export interface ApprovalContext {
  manifest: ToolCapabilityManifest;
  input: unknown;
  autonomy: 'ask_every_time' | 'allow_safe_tools' | 'manual_only';
}

/** Deterministic baseline + optional per-call override. Coordinator-owned only. */
export function decideApproval(
  ctx: ApprovalContext,
  perCall?: (ctx: ApprovalContext) => ApprovalDecision,   // optional dynamic hook (TOL-02)
): ApprovalDecision {
  if (ctx.autonomy === 'manual_only' && ctx.manifest.sideEffect) return 'require-approval';
  const base: ApprovalDecision =
    !ctx.manifest.sideEffect ? 'allow'
    : ctx.autonomy === 'ask_every_time' ? 'require-approval'
    : ctx.manifest.risk === 'high' ? 'require-approval'
    : 'allow';                                             // allow_safe_tools + low/med risk
  const dynamic = perCall?.(ctx);
  // Fail-safe: a dynamic hook may only ESCALATE, never downgrade a required approval.
  if (dynamic === 'deny') return 'deny';
  if (dynamic === 'require-approval') return 'require-approval';
  return base;
}
```

**Rules:**

- **Coordinator-owned (COLLAB-05).** Only the `CollaborationCoordinator` / `ExecutorService` may run `decideApproval`. **Worker roles can never self-approve** (COLLAB-06).
- **Escalate-only.** A per-call hook may raise the requirement (`allow → require-approval → deny`) but must never lower a baseline `require-approval` to `allow`.
- **Manifest-driven.** The hook reads only the `ToolCapabilityManifest` (§28.5) + validated input; it never inspects raw untrusted context to decide (§28.3).
- **Traced.** Every decision is recorded on the `ToolTrace.permission` field (§4.3).

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
  np_workspace          WorkspaceState
  np_addon_<addonId>    unknown                              (AddonSettingsStore)
  np_persona            PersonaProfile + overrides
  np_notes_llm_features { autoTag, autoCategorize, autoSummary, aiSearch }
chrome.storage.session  (cleared on browser close)
  np_jsessionid         string
  np_sysparm_ck         string
  np_token_ttl          number
  np_active_stream      { conversationId, operationId, startedAt }
  np_workspace_primary  { tabId, surface, electedAt }
chrome.storage.sync  (≤ 8 KB per key)
  np_theme              'light'|'dark'|'auto'          (display mode, §17.1a)
  np_theme_pack         'default'|'liquid-glass'|'claude-warm'   (theme pack, §17.1a APPR-06)
  np_language           string
IndexedDB  (side panel + standalone view)
  ChatHistoryDB
    sessions  { id, title, created, updated, starred, preview }
    messages  { sessionId, role, content, timestamp, metadata }
  NotesDB
    notes     { id, title, content, created, updated, tags[], links[], source, aiMeta, version,
                summary?, categoryPath?, summaryGeneratedAt?, tagsGeneratedAt? }
    concepts  { slug, label, summary, noteIds[], aliases[], updatedAt }
    // getNoteByTitle()
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
  notes_backup_config   { dirHandle }
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
  'scripting','contextMenus','notifications'
],
optional_permissions: ['webNavigation'],
host_permissions: [
  '*://*.service-now.com/*',
  '*://support.servicenow.com/*'
],
optional_host_permissions: [
  '*://*/*'                       // requested on demand for webhooks + user-configured MCP hosts
]
```

Rules:

- `declarativeNetRequest` is **not** declared: v0.1 ships no DNR ruleset, so requesting the permission would be flagged in review. Add it back only alongside a concrete header-strip ruleset.
- The File System Access API (§27) requires **no new manifest permission** — the user-gesture `showDirectoryPicker()` grants the handle.
- Webhook targets (§ WebhookManager) and user-configured MCP/proxy hosts are **not** in the static `host_permissions`. Because they are reached through the background `PROXY_FETCH`, the target host must be granted at configure time via `chrome.permissions.request({ origins: [host] })` against `optional_host_permissions`; an ungranted host returns `HOST_NOT_PERMITTED` with a "Grant access" action. This prevents silent webhook/MCP failures while keeping the default install least-privilege.
- LLM-Wiki note content passes through TraceRedactor before indexing/logging/backup. Password field values are never written to .md files.

### §16.5 Secret Redaction

TraceRedactor.redact(value) MUST run before: writing to AITransactionLogDB; writing to ErrorStore; writing to debugLog; rendering in DiagnosticsPanel; exporting a debug bundle; **indexing note content or writing .md files**. See §4.4 for the mandatory patterns.

### §16.6 Advanced Agent Security Rules

These apply to every agent mode (single-agent default and multi-role, §1.6) and every harness track (§§28–30).

- **DO NOT** claim a side effect completed without `CompletionEvidence` (§28.2).
- **DO NOT** treat retrieved data (page, note, memory, upload, tool output) as instructions (§28.3).
- **DO NOT** write raw traces directly into procedural memory (§28.4).
- **DO NOT** activate an evolution candidate without evaluation and approval (§28.7).
- **DO NOT** persist raw image/audio data in diagnostics (§29.3).
- **DO NOT** execute tools from partial voice transcription (§29.2).
- **DO NOT** infer that APC-lite enables browser automation (§29.2, MM-07).
- **DO NOT** allow open-ended agent-to-agent conversations or dynamic unbounded spawning (§30).
- **DO NOT** let worker roles grant permissions, execute side effects, or write durable memory directly (§30, COLLAB-06).
- **DO NOT** treat agreement among agents as evidence or verification (§30, COLLAB-13).

## §17 — UI/UX Requirements

### §17.1 Side Panel Layout — Chat Only (Ask-Gemini style)

Side panel is 400 px wide (Chrome default). All UI must work at this width. **The Side Panel is a single, uninterrupted Chat surface — there is NO side navigation rail.** Agent/Note/Write/Tools/TeamGQM do not appear here; deeper work opens the Standalone view via **Switch to Full chat**. Three stacked zones: header, conversation, composer block (toolbar → input → status bar).

**Structure (using AntD compact algorithm):**

- **Header (~52 px)** — left: app mark ("N" avatar) + "NowPilot" wordmark. Right: **exactly two** icon buttons — **Options** (`SettingOutlined`, opens Standalone view → Options) and **Switch to Full chat** (`ExpandAltOutlined`, workspace handoff, Flow 11). **No provider chip** (provider moved to the status bar), **no nav rail**.
- **Conversation area** — fills/scrolls; user bubbles right (`colorPrimaryBg`), assistant bubbles left prefixed by a small ⚡ model-id label, body via `PortableMarkdown`. Per-message action toolbar (Copy · Expand · Regenerate · Quote/save-note · Share · Read-aloud). Follow-up chips below (RICH-C-05). Empty state = mascot + Welcome cards (RICH-I-01).
- **Composer toolbar (above the input, space-between)** — left: **model selector** (`⚡ model-id ▾`, the only model control in the Side Panel). Right: **Screenshot/snip** (`ScissorOutlined`) · **Attach** (`PaperClipOutlined`) · **Chat history** (`HistoryOutlined`, opens the bottom sheet, §17.1b) · **New chat** (`FormOutlined`).
- **Input** — rounded (radius 12), placeholder "Ask anything, @ models, / prompts", **send button inside** bottom-right; slash suggestion overlay.
- **Status bar (below the input)** — left: active **provider name** (e.g. "OpenAI"; turns `colorError` on provider failure). Right: **Help** (`QuestionCircleOutlined`) + **Feedback** (`MailOutlined`) icons.
- **Global overlays** — Cmd+K palette (AntD Modal), toasts via App.useApp().message, permission dialogs via App.useApp().modal.confirm, chat-history bottom sheet (§17.1b).

Rules:

- Use AntD compact theme.compactAlgorithm throughout.
- Do NOT render heavy AntD Table, multi-column Descriptions, or wide forms in the side panel.
- Do NOT render a nav rail or any surface switcher — **Chat is the only Side Panel surface** (§6.2, §8.3).
- Container queries below 380 px collapse to a single column.
- Use overflow-anchor: none for the streaming tail.
- CLS target <= 0.05.
- The "Switch to Full chat" button lives in the header and is always visible.
- Every icon-only control carries an `aria-label` + tooltip (Options, Switch to Full chat, Snip, Attach, History, New chat, Help, Feedback).

#### §17.1b Chat History — Bottom Sheet (Side Panel)

The composer's **Chat history** (🕘) icon opens a **bottom sheet** that slides up over a dimmed conversation (rounded top corners, `E3` elevation; dismiss via drag-down, ✕, or scrim tap). Content: title "Chat history" + count; **All / Starred** underline tabs + clear/delete (trash) icon; a Search field; day-grouped items ("Today"/"Yesterday"/dates), each item = title + `…` overflow (rename/delete/star) + star toggle. Tapping an item loads that conversation. Backed by `useChatHistory`; states per §12. The Standalone view presents the same content as a **right drawer** (§17.2b).

### §17.1a Appearance Settings (Options → General)

The theme *engine* is specified in §5.5 and Appendix F; this section defines the **settings surface** that drives it.

- **APPR-01 — Location.** Theme controls live in **Options → General → Appearance** (Standalone view only). The Side Panel has no theme UI; it follows the shared setting live.
- **APPR-02 — Control.** A single `Segmented` (or `Radio.Group`) with three options — **Light · Dark · Auto** — bound to `ThemeMode`. "Auto" follows `prefers-color-scheme`. Default is **Auto**.
- **APPR-03 — Single source of truth.** The selection writes **only** to `chrome.storage.sync.np_theme` (§15.1). A thin `chrome.storage`-backed Zustand `ThemeStore` (Appendix F) mirrors it, and `chrome.storage.onChanged` propagates the change to **both** surfaces immediately (no reload, no per-surface copy). There is **no** `themeMode` field on `UserPreferences` — that would create a second source of truth.
- **APPR-04 — Application.** On change, each surface re-derives its AntD config via `getAntdConfig({ mode, pack, compact })` and switches `theme.darkAlgorithm`/`defaultAlgorithm` plus the selected pack's token overlay. Because antd v6 uses pure CSS variables, the switch is real-time — no component remount, no `.dark` class manipulation.
- **APPR-05 — Density is not user-configurable in v0.1.** Compact vs default density is fixed per surface (Side Panel = compact, Standalone view = default). Appearance controls colour scheme only; a density toggle is out of scope.
- **APPR-06 — Theme pack (user-facing in v0.1).** In addition to the Light/Dark/Auto **display mode**, a **Theme pack** selector ships in v0.1: a `Select` with **Default · Liquid Glass · Claude Warm**, bound to `chrome.storage.sync.np_theme_pack` (§15.1). Display mode and theme pack are **orthogonal** (3 modes × 3 packs = 9 valid appearances). Both write only to `chrome.storage.sync` and propagate to both surfaces via `chrome.storage.onChanged`; each surface re-derives config via `getAntdConfig({ mode, pack, compact })` (Appendix F). A pack is a token overlay merged on the seed tokens; every pack must pass WCAG AA (§17.6) in **both** light and dark before shipping. Liquid Glass keeps message text on a solid surface for legibility and provides a non-glass fallback when `backdrop-filter` is unsupported. Visual definitions of each pack live in the companion `DESIGN_SYSTEM.md` (§6.4); this spec owns only the wiring.

### §17.2 Standalone view Layout

Standalone view is served from standalone.html in a normal browser tab. Uses AntD Layout:

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

The Standalone Sider is the surface switcher: **Chat · Note · Write · Tools · [TeamGQM optional] · Options**. Active item = `colorPrimaryBg` pill + `colorPrimary`. Footer holds profile avatar, settings gear, and a `⌘K` hint. The Standalone view **Chat** page reuses the Side Panel composer/bubble recipes at default density.

#### §17.2b Chat History — Right Drawer (Standalone view)

In the Standalone view, the **Chat history** control opens a **right-side drawer** (~360–400 px) that slides in over a dimmed content area (the Sider stays visible; `E3` elevation; scrim over content only). Identical content model to the Side Panel bottom sheet (§17.1b): title + count, **All / Starred** tabs, clear/delete, search, day-grouped items with `…` overflow + star. `useChatHistory` backs both surfaces; only the entry animation differs (bottom-sheet vs right-drawer).

#### §17.2c Notes Page — 4-Column Workspace (Standalone view only)

The Notes page is a **four-column workspace** with a top header. Each side column is independently collapsible; the centre column is persistent.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ 🔎 Search notes, tags, content…  ⌘K   [▢ Directory][≣ Notes][ⓘ Inspector]      │  HEADER
│                                                        + New Note  Import  Backup │
├───────────────┬───────────────────┬───────────────────────────┬───────────────┤
│ DIRECTORY   « │ ServiceNow/Inc. ▾ │ INC Lifecycle Flow …      │ INSPECTOR   » │
│ (col 1: tree) │ (col 2: note list)│  Edit  Share  ⋮           │ (col 4)       │
│ All Notes 128 │ ┌───────────────┐ │  meta · tags (+add)       │ ✨ AI Summary │
│ Recently Upd  │ │ Note card ★   │ │  ┌ format toolbar ─────┐ │   [Regenerate]│
│ Favorites   8 │ │ snippet…      │ │  │ Body▾ ↶↷ B I <> ≣ ▦ │ │──────────────│
│ Uncategorized │ │ tags  10m ago │ │  └─────────────────────┘ │ ⓘ Note Details│
│ ▾ Work KB   3 │ └───────────────┘ │  # heading                │  Word/Read/… │
│   ▸ ServiceN24│ Total 5 notes     │  <body: text/diagrams/    │  Links/Backln│
│ … TAGS …      │                   │   callouts/tables>        │ Quick Actions│
│ #Incident  22 │  (col 2)          │  (col 3: editor/viewer)   │  Copy/Export │
└───────────────┴───────────────────┴───────────────────────────┴───────────────┘
```

- **Col 1 — Directory:** folder tree (All Notes + count, Recently Updated, Favorites, Uncategorized, category hierarchy e.g. Work Knowledge Base ▸ ServiceNow ▸ Incident/Problem/Change) + a **TAGS** list with counts and "More tags…". Header label + collapse `«`.
- **Col 2 — Notes:** the note **list** for the current scope; breadcrumb + `▾` scope selector, filter/sort/grid icons, collapse `«`; cards = title + star, 2-line snippet clamp, tag chips, relative timestamp; footer "Total N notes".
- **Col 3 — Note content (persistent, cannot hide):** editor/viewer; title + star, **Edit / Share / ⋮**; created/updated + tag chips (+add); formatting toolbar (`Body▾`, undo/redo, **B** *I* `<>`, bullet/number lists, table, checkbox, link, image); body via `PortableMarkdown`; wikilinks + unresolved-link styling (§27.7a).
- **Col 4 — Inspector:** **AI Summary** card (with **Regenerate**, LLM-WIKI-03/04) → **Note Details** (Word Count, Est. Read Time, Created, Last Modified, Links Count, Backlinks) → **Quick Actions** (Copy Link, Export as Markdown, Export as PDF, Move to…). Header label + collapse `»`.

Column show/hide behaviour:

- **NOTES-COL-01** The header has three segmented **toggle buttons — Directory · Notes · Inspector** (`colorPrimary` when active) that show/hide columns 1, 2, and 4. Column 3 is the persistent centre and cannot be hidden.
- **NOTES-COL-02** Each collapsible column also has an inline collapse chevron in its own header (`«` left columns, `»` Inspector), kept in sync with the header toggles.
- **NOTES-COL-03** Collapsed columns animate width→0 (150–200 ms) and the centre editor reflows to fill. State persists per surface. At narrow Standalone widths, auto-collapse Directory first, then Inspector, keeping Notes + content.

#### §17.2d Provider Configuration Dialog (Options → AI access → Set up)

Each provider card's **Set up** opens a centred AntD `Modal` (`E3`, radius 16):

- **Title** = provider name (e.g. "OpenAI") + ✕ close.
- **API key:** password `Input.Password` with eye toggle; AES-encrypted per §15.2; the stored key is never rendered in plaintext on reload.
- **API proxy URL (optional):** a `Switch`; when on, reveals a URL input mapped to `ProviderConfig.customBaseURL` (§10.3).
- **Check connection:** helper text "Check if your API key and proxy (if used) are valid." + **Check** button → `validateConfig()`; inline success/error (`colorSuccess`/`colorError`; error code `PROVIDER_CHECK_FAILED`).
- **Model list:** count label + **↻ Update list** (`getModels()`) + **+** to add a custom model id; each row = model id + **enable/disable `Switch`**. Enabled models populate the composer model selector.
- **Footer:** **Cancel** (ghost) / **Save** (primary → persists `ProviderConfigSchema`, §10.3).

### §17.3 AntD Theme System

NowPilot uses a single centralized ThemeStore (Zustand) that both surfaces consume via ConfigProvider. getAntdConfig (Appendix F) returns a full ConfigProviderProps including theme.algorithm, theme.token, and per-component overrides.

Rules:

- Use theme.darkAlgorithm for dark mode. Do not manipulate CSS classes for AntD components.
- Side Panel adds theme.compactAlgorithm; Standalone view does not.
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
- Same conversation is visible in Side Panel Chat and Standalone view Chat when workspaceId matches.
- User can hand off from Side Panel → Standalone view via Flow 11 without losing scroll position or in-flight streaming.
- Same notification.error messages appear only on the surface that initiated the failing operation; secondary surfaces receive a compact "Error in other surface. Focus to see." indicator.

### §17.6 Accessibility

- Minimum contrast ratio: WCAG AA (4.5:1 text, 3:1 large text/UI).
- Focus rings visible on all interactive elements (AntD default is compliant).
- All Modals trap focus and support Escape to close.
- All Menu items reachable by arrow keys.
- All streaming content in Chat has aria-live="polite" on the message list.

### §17.7 RICH Design Requirements

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

- **RICH-H-11 (P1, L)** — Standalone view split-pane: left 60% chat, right 40% Context panel; toggle.
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

## §18 — Master Implementation Phases

> **Single authoritative roadmap.** §18 is the sole source of implementation sequencing for NowPilot v0.1. All implementation phases, sub-phases, dependencies, verification gates, and release ordering are defined here. Sections §28–§30 provide requirement detail and supporting contracts, but they do not define a separate implementation order.

**Canonical order:**

```text
1 → 2 → 3 → 3a → 4 → 4a → 4b → 5 → 5a → 5b
  → 6 → 6a → 6b → 6c → 7 → 7a → 8 → 8a → 9
```

Do not implement more than one phase per response unless explicitly requested.

**Reorganisation principle:** phases follow the product data-flow of _acquire → store → understand → display → extend → harden_, while governance and reliability sub-phases are placed immediately after the capability they extend. Key placements: **PageContentService → Phase 4a**; **Notes + Memory + MiniSearch → Phase 5**; **LLM-Wiki + Filesystem Sync → Phase 5a**; **Workspace Experience + RICH → Phase 7**; **Hardening & Release → Phase 9**.

```text
AI runtime (3) → reliability/evidence (3a)
Page → context (4) → PageContentService (4a) → trust-aware context (4b)
    → Knowledge Base (5) → LLM-Wiki and filesystem sync (5a)
    → memory governance and experience candidates (5b)
    → Diagnostics (6) → evaluation (6a) → verified evolution (6b)
    → bounded multi-role collaboration (6c)
    → Workspace Experience + RICH (7) → multimodal input (7a)
    → Add-ons (8) → tool governance and active discovery (8a)
    → Hardening & Release (9)
```

### Phase 1 — MV3/WXT Runtime + AntD Shells + Workspace

**Create:**

```
wxt.config.ts                                       # Appendix G
src/entrypoints/background.ts
src/entrypoints/sidepanel/{index.html, main.tsx}
src/entrypoints/standalone/{index.html, main.tsx}
src/entrypoints/content/core.content.ts                             # extraction-only
src/core/theme/{ThemeStore.ts, antdConfig.ts}
src/core/workspace/{WorkspaceStore.ts, WorkspaceRouter.ts, WorkspaceSync.ts}
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
src/core/registry/{AddonRegistry, Registry, AddonSettingsStore, SidePanelPageRegistry, StandalonePageRegistry}.ts
src/core/input/KeymapRegistry.ts
src/core/components/{ErrorBoundary, PortableMarkdown}.tsx
src/components/sidepanel/{SidePanelShell, SidePanelRouter}.tsx
src/components/standalone/{StandaloneShell, StandaloneRouter}.tsx
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
- Standalone view opens from side panel; workspace state hands off correctly.
- Standalone view can be re-opened without duplicating tabs (dedupe logic).
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
src/core/ai/persona/PersonaProfile.ts
src/core/ai/persona/PersonaInjector.ts
```

**Required tests:**

```
tests/core/ai/PlannerService.test.ts
tests/core/ai/ExecutorService.test.ts
tests/core/ai/RendererService.test.ts
tests/core/ai/AgentOrchestrator.test.ts
tests/core/ai/ProviderRouter.test.ts
tests/core/ai/StructuredOutput.test.ts
tests/core/ai/persona/PersonaProfile.test.ts
tests/core/ai/persona/PersonaInjector.test.ts
```

**DONE when:**

- Planner returns valid JSON decisions with closed toolName enum.
- Executor rejects unknown tools.
- Renderer respects output caps.
- Provider fallback + circuit breaker tests pass.
- Structured output one-shot repair works.
- **PersonaInjector prepends the persona block to the Planner, Executor, Renderer, and MemoryExtractor system prompts (persona-aware from day one), placed in the cached [SYSTEM] section so prompt caching is preserved.**
- **UserPreferences.personaOverrides (name/tone/brevity) apply without a code change.**

### Phase 3a — Agent Reliability and Evidence

**Depends on:** Phase 3  
**Create/modify:** AgentTrajectoryState, OutcomeVerifier, CompletionEvidence, AgentTurnOutcome, AgentOrchestrator integration, Renderer completion guard.  
**Required tests:** `tests/core/ai/trajectory/**`, `tests/core/ai/OutcomeVerifier.test.ts`  
**Verification:** `pnpm run verify:phase-3a`  
**Requirements (from §28.2):** AGT-01 (P0) trajectory states · AGT-02 (P0) side-effect success needs CompletionEvidence · AGT-03 (P0) structured AgentTurnOutcome, cap exhaustion is `partial` · AGT-04 (P0) deterministic replan/terminal policy.  
**Types:** `AgentTrajectoryState`, `CompletionEvidence`, `AgentTurnOutcome` (Appendix C.1).  
**DONE when:** transitions, evidence, partial/cap behaviour, abort, and false-completion tests pass.

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

### Phase 4a — PageContentService (Knowledge Acquisition)

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

- Defuddle runs in the side panel / standalone view (not the content bundle); content script only serializes HTML.
- Content-script bundle contains no React, AntD, defuddle, or yaml, and stays < 50 KB.
- Layered fallback (Defuddle→Readability, AX→DOM) records the source used.
- PageIndexBuilder builds an ephemeral per-tab MiniSearch index (never persisted).
- SPA-nav (wxt:locationchange) + tabs.onUpdated invalidation works.
- Passwords never captured (isPassword ⇒ value omitted).
- pnpm run verify:phase-4a passes.

### Phase 4b — Trust-Aware Context and Receipts

**Depends on:** Phases 4 and 4a  
**Create/modify:** ContextItem, trust policy, context receipt, injection defences, stable-prefix snapshots, progressive skill disclosure.  
**Required tests:** `tests/core/context/trust/**`, `tests/security/prompt-injection/**`  
**Verification:** `pnpm run verify:phase-4b`  
**Requirements (from §28.3):** CTX-01 (P0) source trust/authority metadata · CTX-02 (P0) retrieved data is never instructions · CTX-03 (P0) ContextProvenanceManifest → context receipt · CTX-04 (P0) stable-prefix snapshot tests · CTX-05 (P1) progressive skill disclosure · CTX-06 (P1) context-quality diagnostics without raw text.  
**Types:** `ContextItem`, `ContextReceiptEntry` (Appendix C.1).  
**DONE when:** malicious page, note, and tool fixtures cannot alter policy, and Prompt Inspector reconstructs packing decisions.

### Phase 5 — Knowledge Base (Memory + MiniSearch + Notes)

**Create:**

```
src/core/memory/MemoryEngine.ts
src/core/memory/ConversationMemoryStore.ts
src/core/memory/UserMemoryStore.ts
src/core/memory/PreferenceMemoryStore.ts             # persona config (np_persona) lives here
src/core/memory/MemoryScorer.ts
src/core/memory/MemoryExtractor.ts
src/core/search/MiniSearchIndex.ts
src/core/notes/LinkParser.ts
src/core/notes/NoteGraph.ts
src/components/notes/{BacklinksPanel, WikilinkAutocomplete, NoteGraphView}.tsx   # core logic
```

**Knowledge model established here:** atomic notes (the unit) + wikilinks (`links[]`, the connective web) + tags (many-to-many labels). The `categoryPath` field is introduced on the Note type here (populated later by LLM-Wiki in Phase 5a).

**OKF v0.2 alignment — type declaration only (rev 2026-08-12).** Add the optional OKF-aligned field `type?: string` to the `Note` interface in `src/types/notes.ts` here (declaration only; default `Note` applied at serialization time in Phase 5a). This mirrors how `categoryPath` is *declared* in Phase 5 and *populated* by LLM-Wiki in Phase 5a — no serialization, no migration, and no LLM behaviour change in Phase 5. DONE-when (append): `Note.type?: string` exists in `src/types/notes.ts` and type-checks; no reader/writer consumes it yet (Phase 5a owns population + serialization).

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

### Phase 5a — LLM-Wiki & Filesystem Sync

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

Implements the full §27 requirement set: CAT-01…05, LLM-WIKI-01…10, SYNC-01…11, NMEM-01…03, **plus the OKF v0.2 note-format alignment (OKF-WIKI-01…04, rev 2026-08-12).**

**OKF v0.2 alignment — serialization, migration, restore (rev 2026-08-12).** These are additive changes to files **already created** in Phase 5a — no new files:
- `src/core/notes/NoteFileSync.ts` — emit the OKF-aligned YAML frontmatter (SYNC-04): OKF-required `type` (default `Note`), recommended `description` (= `Note.summary` when present), and the `generated: { by: nowpilot/<tier-model>, at: <ISO 8601> }` + `status` families. `id` (UUID) is emitted as an OKF **extension key**; wikilinks stay in the body.
- `src/core/storage/migrations/v4_notes_backup_config.ts` — fold the optional `Note.type` into the **existing v4 migration** (idempotent; skip if the field already exists — **no new v5 bump**).
- `src/components/options/ImportExportSection.tsx` — the "Restore from folder" parser tolerates OKF keys (`type`/`description`/`generated`/`status`) and ignores unknown OKF fields (SYNC-09).

**New requirements (rev 2026-08-12):**
- **OKF-WIKI-01 (P1)** NoteFileSync emits OKF-required `type` (default `Note`) + recommended `description` (= `Note.summary` when present).
- **OKF-WIKI-02 (P1)** NoteFileSync emits the OKF trust/lifecycle families `generated: { by, at }` (ISO 8601) and `status` (`draft`|`stable`, default `stable`).
- **OKF-WIKI-03 (P1)** `Note.id` (UUID) is emitted and parsed as an OKF **extension key**; a write→restore round-trip preserves it and every wikilink edge (WIKI-ID-01/04 unchanged).
- **OKF-WIKI-04 (P0 boundary)** v0.1 does **not** emit OKF standard-markdown-link edges and does **not** adopt path-as-identity; wikilinks + UUID identity remain authoritative. Strict-OKF link/identity conformance (and `sources`/`verified` families) is deferred to v0.2+ behind a dedicated ADR.

**Required tests:**

```
tests/core/notes/NoteTagger.test.ts
tests/core/notes/NoteQA.test.ts
tests/core/notes/NoteChatConverter.test.ts
tests/core/notes/NoteFileSync.test.ts
tests/core/notes/NoteFileSync.okf-frontmatter.test.ts   # emitted frontmatter has type+generated+status; round-trips (OKF-WIKI-01/02/03)
tests/core/notes/NoteMaintenance.test.ts
tests/core/storage/migrations/v4.test.ts                 # extended: v4 adds Note.type idempotently (skip if present)
```

**DONE when:**

- Save pipeline runs NoteTagger.analyze() (haiku, combined tags+category+summary+memory-facts) non-blocking after the IndexedDB write.
- Auto-tag/category/summary suggestions render with accept/reject.
- "Ask notes" RAG (flash) returns cited answers; tiny mode falls back to plain MiniSearch.
- Chat/page → note conversion opens a pre-filled editor (user is the gatekeeper).
- NMEM-02 upserts facts only on the primary surface.
- showDirectoryPicker() + handle persist in notes_backup_config (Standalone view only).
- Per-save .md sync with **OKF v0.2-aligned YAML frontmatter** (`type`/`description`/`id`/`generated`/`status`, SYNC-04) + nested folders + collision suffixing + external-change guard.
- Every emitted `.md` carries OKF-required `type` + `generated` + `status`, and the UUID `id` survives a write→restore round-trip (OKF-WIKI-01/02/03).
- Restore parser tolerates OKF keys and ignores unknown OKF fields (SYNC-09); wikilinks (not OKF markdown-link edges) remain the body syntax (OKF-WIKI-04).
- Delete-on-sync + empty-folder cleanup.
- Restore preview + additive upsert (never deletes local notes not in the folder).
- v4 migration idempotent (adding `Note.type` is skipped when already present).
- pnpm run verify:phase-5a passes.

### Phase 5b — Memory Governance and Experience Candidates

**Depends on:** Phases 5 and 5a  
**Create/modify:** MemoryRecord, conflict resolver, lifecycle controls, procedural experience candidate store, edge provenance.  
**Required tests:** `tests/core/memory/governance/**`, `tests/core/knowledge/provenance/**`  
**Verification:** `pnpm run verify:phase-5b`  
**Requirements (from §28.4):** MEM-01 (P0) working/episodic/semantic/preference/procedural taxonomy · MEM-02 (P0) source+confidence+lifecycle+sensitivity+verified-at · MEM-03 (P0) conflict precedence (correction > verified > prior > inference) · MEM-04 (P0) view/edit/pin/forget/disable/export/cloud-exclude controls · MEM-05 (P1) procedural experience gated by approval · KNW-01 (P1) edge provenance.  
**Types:** `MemoryRecord`, `ProceduralExperience`, `KnowledgeEdgeSource` (Appendix C.1).  
**DONE when:** conflicts, forget, expiry, sensitivity, provenance, and Notes/Memory boundaries pass.

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
- Redaction test proves secrets (+ note content + filesystem paths) are not persisted.
- Diagnostics panel in Options can copy operation ID.

### Phase 6a — Agent Evaluation

**Depends on:** Phase 6 and available core capabilities  
**Create:** `src/core/evaluation/**`, `tests/evals/**`, evaluation reports in Diagnostics.  
**Required tests:** `tests/evals/**`  
**Verification:** `pnpm run verify:phase-6a`  
**Requirements (from §28.6):** EVAL-01 (P0) versioned golden suites · EVAL-02 (P0) multi-dimension trajectory rubric · EVAL-03 (P0) deterministic validators, judges only for qualitative dims · EVAL-04 (P0) first-failing-layer diagnostics · EVAL-05 (P0) safety/leak/injection/false-completion/citation/isolation regressions block release · EVAL-06 (P1) cost/latency/quality Pareto · EVAL-07 (P1) calibrated, versioned judges.  
**Types:** `FailureLayer` (Appendix C.1).  
**DONE when:** golden suites produce per-dimension evidence and failure-layer categorisation.

### Phase 6b — Verified Continual Evolution

**Depends on:** Phases 5b and 6a  
**Create:** `src/core/evolution/**`, candidate store, sandbox runner, approval/version/rollback contracts.  
**Required tests:** `tests/core/evolution/**`  
**Verification:** `pnpm run verify:phase-6b`  
**Requirements (from §28.7):** EVO-01 (P1) trajectories create candidates, never direct prod changes · EVO-02 (P1) one target layer per candidate · EVO-03 (P1) EvolutionCandidate stores evidence/baseline/security/version/rollback · EVO-04 (P0) untrusted content cannot update active prompts/tools/permissions/code/procedural memory · EVO-05 (P1) sandbox→approve→scoped rollout→monitor→rollback · EVO-06 (P2) agent-generated tools stay sandbox proposals.  
**Candidate Proposer (from §28.7a):** PROP-01 (P1) inputs = failing evals + trace evidence only · PROP-02 (P1) one layer per proposal (deterministic `FailureLayer`→`targetLayer`) · PROP-03 (P1) evidence threshold (≥3 agreeing failures, ≥0.15 score drop) · PROP-04 (P1) per-proposal sandbox cost cap · PROP-05 (P0) proposes only, never activates · PROP-06 (P1) reproducible (suite version + op-ids + hash).  
**Create:** `src/core/evolution/CandidateProposer.ts` (deterministic proposer), candidate store, sandbox runner, approval/version/rollback contracts.  
**Types:** `EvolutionCandidate`, `EvolutionCandidateProposal`, `ProposerInput` (Appendix C.1).  
**Worked example:** Appendix O.9.  
**DONE when:** raw traces cannot self-activate; the proposer maps a failing eval to exactly one single-layer, cost-capped `proposed` candidate; and a candidate can be proposed, tested, approved, scoped, and rolled back.

### Phase 6c — Bounded Multi-Role Collaboration

**Depends on:** Phases 3a, 4b, 6a, and 6b  
**Create:** `src/core/collaboration/**`, typed role policies and handoffs, collaboration coordinator, trace integration, and baseline evaluation fixtures.  
**Required tests:** `tests/core/collaboration/**`, `tests/evals/collaboration/**`, `tests/security/collaboration-permissions.test.ts`  
**Verification:** `pnpm run verify:phase-6c`  
**Requirements (from §30.2):** COLLAB-01 (P1) explicit activation · COLLAB-02 (P1) closed role registry · COLLAB-03 (P1) CollaborationPlan caps/deadline (single-agent = one-role plan) · COLLAB-04 (P1) typed handoffs, no hidden reasoning · COLLAB-05/06 (P0) coordinator owns commits, workers no side effects · COLLAB-07 (P1) independent reviewer · COLLAB-08 (P1) contained failure/fallback · COLLAB-09/10 (P1) shared projected context + traces · COLLAB-11 (P1) single-agent baseline gate · COLLAB-12 (P2) future isolated workers · COLLAB-13 (P0) no open-ended/unbounded agents.  
**Types:** `CollaborationRole`, `RolePolicy`, `CollaborationPlan`, `AgentHandoffArtifact`, `CollaborationOutcome` (Appendix C.1).  
**DONE when:** roles, tools, contexts, budgets, permissions, handoffs, independent review, failure fallback, and single-agent baseline gates pass. Full requirements are in §30.

### Phase 7 — Workspace Experience (UI/UX) + RICH

**Create:**

```
src/components/pages/ChatPage.tsx                   # full — reused by Side Panel + Standalone view
src/components/pages/AgentPage.tsx
src/components/pages/NotesPage.tsx                  # Standalone view only, incl. LLM-Wiki panels
src/components/pages/OptionsPage.tsx                # Standalone view only
src/components/options/{ProvidersSection, ModelsSection, MCPSection, PromptsSection, SlashSection, MemorySection, ImportExportSection, FeatureFlagsSection, AddonSettingsSection, PersonaSection, NotesSection}.tsx
src/components/notes/{BacklinksPanel, WikilinkAutocomplete, NoteGraphView, NotePreview, SaveToNoteDialog}.tsx
src/components/patterns/{ChatMessage, HistoryListItem, ToolCard, SkillMessageRenderer, SourceCard}.tsx
src/components/rich/{WelcomeCards, QuickActionChips, ClarificationChips, FollowUpChips, PersonaHeader, StageIndicator, ClosureZone, ContextPane, TemplateCatalog, CodeBlockActions, StepCards}.tsx
src/core/intent/IntentClassifier.ts
src/hooks/useChat.ts
src/hooks/useStreamingLLM.ts                        # Appendix J
src/hooks/useProviderRouter.ts
src/hooks/useMemory.ts
src/hooks/useDiagnostics.ts
src/hooks/useWorkspace.ts
src/hooks/useTheme.ts
src/hooks/usePersona.ts
src/hooks/useRichSuggestions.ts
src/core/prompts/{PromptManager, TemplateEngine, builtinTemplates}.ts
src/core/slash/SlashCommandRegistry.ts
```

**Required tests:**

```
tests/hooks/useStreamingLLM.test.ts
tests/hooks/useWorkspace.test.ts
tests/hooks/usePersona.test.ts
tests/components/ChatPage.test.tsx
tests/components/OptionsPage.test.tsx
tests/components/rich/ClarificationChips.test.tsx
tests/components/rich/FollowUpChips.test.tsx
tests/components/rich/WelcomeCards.test.tsx
tests/core/intent/IntentClassifier.test.ts
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
- Note wikilinks resolve with tie-break rule (Standalone view Notes page).
- Options page shows all sub-sections (incl. Persona + Notes) with functional forms.
- DiagnosticsPanel renders in Standalone view → Options → Diagnostics.
- LLM-Wiki UI functional (Ask notes, category tree, backup status, SaveToNoteDialog).
- RICH P0 (7.3) complete: persona header, welcome cards, quick-action chips, clarification + follow-up chips (max 2 rounds; graceful timeout), code-block Copy/Save-as-macro (Insert=clipboard-only), streaming stage indicators.
- pnpm run verify:phase-7 passes.

### Phase 7a — Multimodal Input Foundation

**Depends on:** Phase 7 and Phase 4b  
**Create:** `src/core/multimodal/**`, image input UI, voice transcription input, provider capability gates, modality fixtures.  
**Required tests:** `tests/core/multimodal/**`, `tests/components/multimodal/**`  
**Verification:** `pnpm run verify:phase-7a`  
**Requirements (from §29.2):** MM-01 (P1) ModalityInput (no inline binary) · MM-02 (P1) ModalityObservation with confidence/sensitivity · MM-03 (P1) image paste/upload via vision model · MM-04 (P1) voice → editable Sender, explicit send · MM-05 (P2) later fast/slow split · MM-06 (P1) AbortSignal across transcribe/plan/tool/render · MM-07 (P0 boundary) APC-lite ≠ browser automation.  
**Types:** `ModalityInput`, `ModalityObservation` (Appendix C.1).  
**DONE when:** image and audio inputs become redacted ContextItems, unsupported providers fail safely, and abort works.

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
- TeamGQM add-on renders in Side Panel and Standalone view.
- Add-ons can consume PageContentService + Memory + Notes + LLM-Wiki.

### Phase 8a — Tool Governance and Active Discovery

**Depends on:** Phase 8 and Phase 3a  
**Create/modify:** ToolCapabilityManifest, risk matrix, verifier registry, result shaping, idempotency, active tool discovery.  
**Required tests:** `tests/core/tools/governance/**`, `tests/core/tools/discovery/**`  
**Verification:** `pnpm run verify:phase-8a`  
**Requirements (from §28.5):** TOL-01 (P0) ToolCapabilityManifest (category/risk/side-effect/perms/scopes/timeout/cost/idempotency/verifier/hashes) · TOL-02 (P0) risk- & side-effect-based permission policy · TOL-03 (P0) postcondition verification · TOL-04 (P0) validate/redact/size-limit/shape/attribute results · TOL-05 (P0) idempotent write replay-safety · TOL-06 (P1) active discovery over tools budget · TOL-07 (P2) resumable long-running contract (future).  
**Types:** `ToolCapabilityManifest` (Appendix C.1).  
**DONE when:** manifests are complete, risky writes require confirmation, duplicate writes are prevented, and discovery stays within token budget.

### Phase 9 — Hardening and Release

**Required test suites:**

```
tests/core/ai/**
tests/core/context/**
tests/core/memory/**
tests/core/notes/**            # LLM-Wiki + filesystem sync
tests/core/telemetry/**
tests/core/storage/**
tests/core/workspace/**
tests/components/rich/**        # RICH interaction
tests/isolation/no-content-script-ui.test.ts
tests/perf/**
```

**DONE when:**

- pnpm run verify:all passes.
- pnpm run test:perf passes.
- pnpm run test:isolation passes.
- Content script bundle < 50 KB (extraction-only).
- Side panel initial paint < 300 ms.
- Standalone view initial paint < 500 ms.
- First token < 2 s local / < 3 s cloud.
- Filesystem restore round-trips a full vault.
- RAG returns correct citations on a fixture note set.
- Every inserted sub-phase verification command passes.
- Prompt-injection, secret-leakage, false-completion, permission, and memory-isolation regressions block release.
- Multimodal privacy and provider-routing fixtures pass.
- Evolution candidate activation and rollback drills pass.
- Release records include evaluation-suite and rubric versions.

## §19 — Runtime Edge Cases and Mitigations

### §19.1 User Has Only One AI Provider

- ProviderRouter must not assume fallback exists.
- Retry once only for retryable failures before first token.
- On persistent failure: show retry / configure-provider UI (opens Standalone view → Options → Providers).
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

- LLM stream continues in side panel or Standalone view.
- PROXY_FETCH calls fail / retry only if marked safe by caller.
- Startup recreates alarms, context menus, router.
- Diagnostics records background restart.
- useStreamingLLM persists np_active_stream to chrome.storage.session; a re-opened surface calls AITransactionLog.markAborted(operationId) on recovery.

### §19.7 Side Panel Resizing

- Container queries; single-column fallback below 380 px.
- overflow-anchor: none for streaming tail.
- CLS target ≤ 0.05.

### §19.8 Multi-Window Side Panels + Standalone views

- BroadcastBus primary election across all surfaces.
- Only the primary surface writes memory stores.
- Secondary surfaces mirror read-only.
- WriteJournal maintains idempotency.
- If two Standalone views are open in different windows, both display but only one holds write primacy.

### §19.9 Provider Deleted While Active

- Fall back to lowest-priority enabled provider.
- If none: show Flow 1 no-provider modal (with "Open Options" button leading to Standalone view).

### §19.10 IndexedDB Blocked

- Catch open error → IDB_BLOCKED toast.
- Degrade to in-memory session (no persistence).

### §19.11 Abort During Permission Prompt

- Dismiss → inject PERMISSION_DENIED tool result → end stream cleanly.

### §19.12 Two Side Panels + Two Standalone views

- Enforce single-writer rule via BroadcastBus.
- Last-write-wins with version check on all memory writes.

### §19.13 Prompt Cache Miss Cascade

- If provider reports zero cache hit for 5 consecutive requests, PromptCacheManager disables cache hints for 60 s to avoid overhead.

### §19.14 Standalone view Closed Mid-Stream

- Stream continues in memory until finished, then is discarded (no destination).
- AITransactionLog.markAborted(operationId) fires on close via beforeunload.
- Primary writer election restarts; next surface picks up primacy.

### §19.15 Handoff Race Condition

- WorkspaceRouter.openStandalone() is idempotent by workspaceId.
- Second click focuses the existing Standalone view instead of opening a new one.

### §19.16 Backup Folder Permission Revoked

- On NotesPage mount, handle.queryPermission() fails → sync disabled → red "Backup: Error" Tag + banner "[Re-select folder] [Dismiss]". No data loss (IndexedDB remains primary). Error code NOTE_SYNC_PERMISSION_REVOKED.

### §19.17 External .md Change

- On save, if file lastModified is newer than the last sync timestamp (2 s tolerance) → confirm "This file was modified externally. Overwrite with app version? [Overwrite] [Skip]", default Skip (SYNC-06).

### §19.18 NoteTagger LLM Failure

- Save always succeeds (IndexedDB first); tagging failure shows a subtle "Couldn't analyze — [Retry]" hint; never blocks save or sync. Error code NOTE_TAGGER_FAILED.

### §19.19 RAG No Results

- "Ask notes" with zero MiniSearch hits → "No relevant notes found. Try rephrasing." (no LLM call wasted). Error code RAG_NO_RESULTS.

### §19.20 RICH Suggestion Timeout

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
| **Sync note file** | note.id + note.version + filePath |
| **Delete note file** | note.id + filePath |
| **Restore notes batch** | folderHash + fileName |
| Webhook retry | eventId |
| Workspace update | workspaceId + version |
| Open Standalone view | workspaceId |
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
  | 'sync-note-file'
  | 'delete-note-file'
  | 'restore-notes-batch';
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
- **v4 migration:** add the `notes_backup_config` object store; add optional Note fields `summary`, `categoryPath`, `summaryGeneratedAt`, `tagsGeneratedAt`, **and `type` (OKF v0.2 alignment, default `Note`, rev 2026-08-12)**; add `tags` and `summary` to the MiniSearch notes index fields. Idempotent: skip if store/fields already present (adding `Note.type` is skipped when the field already exists — no new v5 bump).

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

Election rules: startup compare-and-set to np_workspace_primary; heartbeat every 3 s; missed 2 heartbeats → re-election; Standalone view has tie-break priority.

### §20.12 Note Sync State

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

### §21.2 Note

```ts
export interface Note {
  id: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  tags: string[];
  links: string[];                 // resolved wikilinks — target note IDs (atomic-note graph)
  unresolvedLinks: string[];       // wikilink targets with no matching note yet (rendered distinctly)
  source: {
    kind: 'manual'|'voice'|'chat-export'|'template'|'page-export';   // +page-export
    conversationId?: string;
    templateId?: string;
  };
  aiMeta: {
    suggestedLinks: Array<{ targetId: string; confidence: number; reason: string }>;
    concepts: string[];
    lastWikiRunAt?: number;
  };
  // --- LLM-Wiki fields (§27) ---
  summary?: string;                // LLM-generated (LLM-WIKI-03) — also emitted as OKF `description`
  categoryPath?: string;           // e.g. "InfoTech/Database/MySQL" (CAT-01) → filesystem folder
  summaryGeneratedAt?: number;     // staleness detection (LLM-WIKI-08)
  tagsGeneratedAt?: number;        // staleness detection (LLM-WIKI-08)
  // --- OKF v0.2 alignment (rev 2026-08-12) ---
  type?: string;                   // OKF-required frontmatter field; default 'Note' (declared Phase 5, serialized Phase 5a)
  version: number;
}
```

> **Knowledge model:** atomic note (unit) + `links[]` (wikilink web) + `tags[]` (many-to-many labels) + `categoryPath` (single hierarchy → folder). Categories and tags are deliberately separate (D-03, §27).

> **OKF v0.2 alignment (rev 2026-08-12).** The on-disk `.md` file is **OKF v0.2-compatible**: a directory of Markdown files with YAML frontmatter and a free-form body — exactly OKF's container. The `type` field satisfies OKF's only always-required key (default `Note`); `summary` is additionally emitted as OKF's recommended `description`; and the trust-lifecycle families `generated`/`status` are added by the serializer (see §27.3 SYNC-04). NowPilot's immutable UUID `id` is retained and written as an OKF **extension key** — legal because OKF consumers "MUST NOT reject documents with unrecognized fields." Wikilinks remain the body edge syntax (WIKI-ID-01…04); NowPilot does **not** emit OKF standard-markdown-link edges or adopt path-as-identity in v0.1 (those conflict with the UUID-identity/wikilink model and are deferred to v0.2+). The `type` field is **declared here in Phase 5** (type only) and **populated/serialized in Phase 5a** — mirroring how `categoryPath` is declared in Phase 5 and populated by LLM-Wiki in Phase 5a.

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
export type ActiveSurface = 'sidepanel' | 'standalone';
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
  openedStandaloneTabId?: number;
  version: number;
  updatedAt: number;
}
```

### §21.6 NowPilot Error + Persona

```ts
export interface NowPilotError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
}
// Persona (RICH-R). Config lives in PreferenceMemoryStore (reconciliation R2).
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
STANDALONE_OPEN_FAILED
NOTE_SYNC_PERMISSION_REVOKED
NOTE_SYNC_WRITE_FAILED
NOTE_RESTORE_PARSE_FAILED
NOTE_TAGGER_FAILED
RAG_NO_RESULTS
PERSONA_LOAD_FAILED
RICH_SUGGESTION_TIMEOUT
```

## §22 — Performance Targets & Algorithms

### §22.1 Performance Targets

| Metric | Target |
|---|---|
| Side panel initial paint | < 300 ms |
| Standalone view initial paint | < 500 ms |
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
| **NoteTagger analyze (haiku)** | non-blocking; save never waits |
| **Ask-notes RAG synthesis (flash)** | < 4 s p95 |
| **Per-save .md file write** | < 200 ms; 50 ms debounce; fire-and-forget |
| **Restore parse (100 notes)** | < 3 s |

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
| **Two UI surfaces** | Side Panel + Standalone view | Side Panel = daily workflow, Standalone view = deep work / config / diagnostics |
| **Shared workspace** | WorkspaceStore (Zustand) + BroadcastBus | Single source of truth across surfaces; cross-surface handoff |
| **Content scripts** | Extraction-only in v0.1 | No UI in host pages; simpler bundle; page injection deferred |
| **Page injection** | **Deferred to v0.2+** | Reduces v0.1 complexity; add-on architecture preserved |
| **Page-content extraction placement** | **Core PageContentService**, not a tool | Shared infra for Chat/Agent/Summarize/research/add-ons; central cache, concurrency, redaction |
| **Main-content extraction** | **Defuddle `^0.19` (≥ 0.19.2)** — full bundle, sync `parse()`, `useAsync:false` | Purpose-built Readability successor; preserves footnotes/math/code; clean Markdown; MIT; runs in side panel/standalone view. Pinned to `0.19.x` (superseding the draft `^0.6`) for the CVE-2026-30830 XSS fix + `data:`/`blob:` rejection + iframe-`sandbox` retention + non-mutating `parse()`. `useAsync:false` + synchronous `parse()` disable third-party API extractors (privacy). `defuddle/full` bundle for reliable Markdown/math; math deps stay out of the content bundle (rev 2026-08-12; §7.6, §26.4) |
| **Extraction model** | **Layered strategy** (Defuddle → APC-lite → ServiceNow API) | Right tool per page type |
| **Page-content retrieval** | **MiniSearch over extracted content** (ephemeral, per-tab) | Keeps large pages within the 2,000-token budget; reuses core engine; never persisted |
| **Browser automation** | **Deferred to v2** (chrome.debugger + CDP Input) | Trusted-event automation needs the debugger; out of scope for read-only v0.1 |
| State | Zustand | 1 KB, no boilerplate, works outside React |
| AI SDK | Vercel AI SDK + custom orchestrator | Streaming/abort/tools; lighter than LangChain |
| **AI SDK version** (rev 2026-08-12) | **`ai ^5`+ (min modern; latest 7.x)** — pin current major at implementation | v4 was three majors stale. v5+ is the unified modern API; the `ILLMProvider` abstraction (§10.1) insulates the app from the `parameters`→`inputSchema` / `maxTokens`→`maxOutputTokens` / `maxSteps`→`stopWhen` breaking changes, so only the provider adapters (§10.2) touch the SDK surface directly |
| **AI provider packages** (rev 2026-08-12) | **Pin each `@ai-sdk/*` to its own current major** (openai ≈4.x, google ≈3.x, anthropic ≈3.x) | The provider packages version **independently** — a shared `^1` is incorrect; match each to the chosen `ai` core version |
| AI providers | @ai-sdk/* only | Single codepath for 4 providers (OpenAI uses custom baseURL for compatible endpoints) |
| **Validation library** (rev 2026-08-12) | **`zod ^4`**; **keep `zod-to-json-schema` in v0.1** | Zod 4 is stable, ~14× faster, and is what MCP SDK + AI SDK 5+ already target. Existing `z.object(...)` schemas are source-compatible. **v0.1 keeps `zod-to-json-schema` (Appendix L unchanged)**; migrating to native `z.toJSONSchema()` is a deferred **v0.2 cleanup** so no v0.1 phase has to touch it |
| Runtime orchestration | Planner → Executor → Renderer | Cheap models cannot drive maxSteps=15 loops safely |
| Tier resolution | TierResolver (Appendix D) | Prevents hallucinated model names |
| Animation | motion | Do not install framer-motion — v12 is published under motion |
| MCP transport | StreamableHTTP from side panel and Standalone view | EventSource unavailable in SW |
| Built-in tools | NowPilotMainServer (12) in each surface | Available without external server |
| AI calls location | Side panel or Standalone view only | SW ~30 s timeout kills streaming |
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
| Options placement | Standalone view only | Side panel stays lightweight |
| Diagnostics placement | Standalone view → Options | Deep work surface |
| Notes placement | Standalone view only | Rich workspace needs full viewport |
| Cross-surface consistency | Same ThemeStore and WorkspaceStore | One product across two surfaces |
| **Phase ordering** | **Knowledge-first data-flow** (acquire→store→understand→display→extend→harden) | Matches product value (Copilot + Obsidian + NotebookLM); PageContentService/Notes/LLM-Wiki are the core, not late add-ons |
| **PageContentService placement** | **Phase 4a** (was Phase 8) | Core infrastructure (§26); consumers in every later phase |
| **Knowledge Base consolidation** | Memory + MiniSearch + Notes + Wikilinks in **Phase 5** | One coherent knowledge layer before enrichment |
| **LLM-Wiki phase** | **Phase 5a** (LLM enrichment + RAG + filesystem sync together) | Single shared save pipeline; depends on Phases 4a/5 |
| **Note enrichment** | **Single haiku call** (tags+category+summary+memory facts) | Cheaper/faster than separate calls (D-01) |
| **Notes dual-friendly** | **Markdown body + YAML frontmatter** | Human reads body; LLM/machine reads frontmatter (D-02) |
| **Note file format** | **OKF v0.2-aligned — OKF-compatible, not OKF-constrained** (rev 2026-08-12) | The `.md` + YAML-frontmatter + folder-tree container already matches OKF v0.2. Frontmatter adds OKF-required `type`, recommended `description`, and the `generated`/`status` trust-lifecycle families so a generic OKF consumer can read a NowPilot note. NowPilot's immutable UUID `id` (WIKI-ID-01) is retained as an OKF **extension key** (OKF §11: consumers must not reject unknown fields), and wikilinks stay the body edge syntax. Full-OKF markdown-link edges + path-as-identity + `sources`/`verified` provenance families conflict with the UUID-identity/wikilink model and are **deferred to v0.2+** behind a dedicated ADR (§21.2, §27.3 SYNC-04, §18 Phase 5/5a) |
| **Category model** | **Path-based `categoryPath` → folders**, separate from tags | 1:1 filesystem mapping; tags stay many-to-many (D-03) |
| **Notes↔Memory direction** | **Notes → Memory only** | Notes are user-owned; memory is system-owned (D-05) |
| **Semantic search** | **LLM-routed reranking over MiniSearch** (no embeddings) | No model download; sufficient for v0.1 |
| **Filesystem sync** | **One-way app→FS + import-for-restore** | Backup use case; bidirectional deferred |
| **Backup handle storage** | **`notes_backup_config` IndexedDB store** | FileSystemDirectoryHandle non-serializable (D-08) |
| **Persona** | **PersonaProfile + PersonaInjector in Phase 3; config in PreferenceMemoryStore** | Persona-aware prompts from day one; user config ≠ inferred fact (R2) |
| **RICH implementation** | **On Ant Design X presentation components, phased 7.3/7.4/7.5** | Reuses adopted stack; no new UI framework |
| **Host-page write-back** | **Deferred (clipboard-only in v0.1)** | Extraction-only rule (§0.2); write-back needs v0.2+ injection (R1) |
| **Agent architecture** | **Coordinator platform; single-agent = one-role plan** | One runtime, tool-governance, memory, evaluation & security model for both modes; multi-role added as data (roles + plans), not a second architecture (§1.6, §30) |
| **Self-learning model** | **Human-verified continual evolution — NOT autonomous self-modification** | Live orchestration is deterministic; learning is a gated candidate pipeline (§28.6/§28.7/§28.7a). `CandidateProposer` only *proposes*; nothing activates without sandbox eval + human approval (EVO-01/04/05, PROP-05). Fits privacy/cost/safety posture |
| **Stage typing** | **Discriminated `StageEvent` union (type only), not an event engine** | Compile-time-checked stage I/O for cheap models (L1); avoids importing the deprecated LlamaIndex Workflows engine (§1.6.1) |
| **Human-in-the-loop** | **Within-turn `input-required` only** | Maps to `waiting-for-permission`/`ask_clarification` (AGT-01); durable cross-session suspend/resume/rewind deferred to v0.2+ (L2, §17.7.7) |
| **Retry layering** | **Three bounded, non-multiplying layers** | ProviderRouter (§1.5) + AGT-04 replan + one per-stage retry, all under §1.4 tier caps; prevents N×N×N cost blow-up on cheap models (L3, §1.6.1) |
| **Working memory** | **Markdown block in `UserMemoryStore`, budget-capped** | Cheap always-on user profile for tiny models (Mastra M1); kept distinct from persona config (R2); single-writer, redacted (§3.6) |
| **Per-call tool approval** | **Dynamic, escalate-only, coordinator-owned** | Risk scales with actual arguments (TOL-02); workers never self-approve (COLLAB-06); baseline from `toolAutonomy` (Mastra M3, §14.5) |
| **External agent frameworks** | **Rejected: @ant-design/x-sdk, LlamaIndex Workflows, Mastra** | Each is a server/UI-first or deprecated runtime that would duplicate the owned coordinator; patterns borrowed instead (see `DECISIONS.md`) |

**Explicitly out of scope (do not implement):** Tailwind v4 + np-* tokens; shadcn/ui; @radix-ui/react-*; Tweakcn HSL mapping; Shadow DOM injection via ContentScriptHost UI mount; split preflight CSS; portal isolation via ui-shadow/ wrappers; dark mode via .dark class. See §25.

## §24 — Verification Commands

Each phase must define a real script. Minimum expected commands in package.json:

```json
{
  "scripts": {
    "verify:phase-1":  "tsc --noEmit && vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme",
    "verify:phase-2":  "tsc --noEmit && vitest run tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts",
    "verify:phase-3":  "tsc --noEmit && vitest run tests/core/ai tests/core/ai/persona",
    "verify:phase-3a": "tsc --noEmit && vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts",
    "verify:phase-4":  "tsc --noEmit && vitest run tests/core/context",
    "verify:phase-4a": "tsc --noEmit && vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts",
    "verify:phase-4b": "tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection",
    "verify:phase-5":  "tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts",
    "verify:phase-5a": "tsc --noEmit && vitest run tests/core/notes tests/core/storage/migrations",
    "verify:phase-5b": "tsc --noEmit && vitest run tests/core/memory/governance tests/core/knowledge/provenance",
    "verify:phase-6":  "tsc --noEmit && vitest run tests/core/telemetry tests/components/DiagnosticsSection.test.tsx",
    "verify:phase-6a": "tsc --noEmit && vitest run tests/evals",
    "verify:phase-6b": "tsc --noEmit && vitest run tests/core/evolution tests/core/evolution/CandidateProposer.test.ts",
    "verify:phase-6c": "tsc --noEmit && vitest run tests/core/collaboration tests/evals/collaboration tests/security/collaboration-permissions.test.ts",
    "verify:phase-7":  "tsc --noEmit && vitest run tests/hooks tests/components tests/components/rich tests/core/intent tests/core/notes",
    "verify:phase-7a": "tsc --noEmit && vitest run tests/core/multimodal tests/components/multimodal",
    "verify:phase-8":  "tsc --noEmit && vitest run tests/core/content tests/addons tests/isolation",
    "verify:phase-8a": "tsc --noEmit && vitest run tests/core/tools/governance tests/core/tools/discovery",
    "verify:phase-9":  "tsc --noEmit && vitest run && pnpm run lint",
    "verify:all":      "tsc --noEmit && vitest run && pnpm run lint",
    "test:perf":       "vitest run tests/perf",
    "test:isolation":  "vitest run tests/isolation"
  }
}
```

`tests/isolation/no-content-script-ui.test.ts` greps the content-script bundle and rejects if it finds `antd`, `React`, `react-dom` — **and `defuddle` or `yaml`, or any File System Access API usage.** **Rev 2026-08-12:** because Defuddle is pinned to the `defuddle/full` bundle (§7.6, §26.4), the grep MUST also reject Defuddle's transitive Markdown/math deps in the content bundle — `mathml-to-latex`, `temml`, and `turndown` — so the panel-only extraction rule (R-3) stays enforced.

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

Side Panel + Standalone view continue to use AntD. Injected UI uses Tailwind + Radix, never AntD. ESLint rule: no-restricted-imports patterns ['antd','@ant-design/*'] for src/addons/** and src/components/ui-shadow/**.

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
   ├─ 1. ServiceNow record?  ── yes ─▶ ServiceNow add-on: Table API → SNowCaseData   [API-FIRST, §9.7 — PHASE 8, not 4a]
   │
   ├─ 2. mode = 'default' (read/summarize)                                  [PHASE 4a]
   │        └─▶ DefuddleStrategy  → clean Markdown (main content)          [PRIMARY read path]
   │             └─ low confidence? → Readability fallback
   │
   └─ 3. mode = 'actionable' (Agent needs structure/interaction)           [PHASE 4a]
            └─▶ ApcLiteStrategy   → APCLiteNode tree (roles, interaction; geometry omitted in v0.1, §26.6)
```

- **DefuddleStrategy** is the default for reading/summarizing. **(Phase 4a)**
- **ApcLiteStrategy** is used when the Agent needs structure (forms, tables, clickable/editable elements, node ids) — the substrate for future v2 automation (§26.7). **(Phase 4a; geometry omitted in v0.1 per §26.6.)**
- **ServiceNow** always tries the Table API first (§9.7); extraction is fallback only. **⚠️ Phase 4a does NOT implement this layer** — it only reserves the `servicenow-api` strategy id and ordering; the ServiceNow add-on **registers** the strategy in **Phase 8** (§8.2, F5 note in Appendix C). A Phase-4a implementer builds strategies 2 and 3 only.

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
Content script (tiny):  stripped outerHTML clone + effective base URL  ──RuntimeEnvelope──▶ Side Panel / Standalone view
Side Panel / Standalone view:  DOMParser → inject <base href> → Defuddle(doc, opts).parse()  → markdown → PageContext
```

The content script only reads/serializes HTML; **Defuddle parsing runs in the side panel / standalone view**. Preserves the isolation rule (§5.6) and the 50 KB cap (§22.1).

**Canonical Defuddle call shape (Defuddle ≥ 0.19.2, rev 2026-08-12).** The `0.19.x` API requires markdown to be requested explicitly and third-party API extractors to be disabled:

```ts
import { Defuddle } from 'defuddle/full';        // full bundle → reliable Markdown + math (mathml-to-latex, temml)

// panel side: the payload from the content script carries the page's effective base URL
const doc = new DOMParser().parseFromString(payload.html, 'text/html');
// A detached DOMParser document has no layout and no base href, so relative URLs/images
// resolve wrong. The content script stamps the effective base URL; the panel restores it:
if (payload.baseUrl && !doc.querySelector('base')) {
  const base = doc.createElement('base');
  base.setAttribute('href', payload.baseUrl);
  doc.head?.prepend(base);
}
const result = new Defuddle(doc, {
  url: payload.baseUrl,   // feeds relative-URL resolution (0.19.x)
  markdown: true,         // 0.19.x: markdown is opt-in
  useAsync: false,        // PRIVACY-CRITICAL: never let Defuddle fetch third-party APIs (e.g. FxTwitter). §0.2, §6.1
}).parse();               // synchronous parse() — async extractors never run on parse()
// result.content = markdown; result.title/author/description/published/wordCount/... = metadata
```

**Why `useAsync:false` + `parse()` (not `parseAsync()`) is mandatory.** Defuddle `0.19.x` added async extractors that fetch from third-party APIs (e.g. FxTwitter for X/Twitter) when a page has no locally usable content. For a privacy-first extension where no data leaves the machine unless the user configures a cloud provider (§6.1), that silent outbound call is prohibited. Synchronous `parse()` never triggers async extractors, and `useAsync:false` is belt-and-braces. This also keeps §0.2's "no custom User-Agent in fetch" invariant intact, since Defuddle would otherwise be the fetch initiator.

**Bundle choice.** Use `defuddle/full` (not the core `defuddle` bundle) in the panel: the core bundle "handles math but doesn't include fallbacks for converting between MathML and LaTeX," so clean-Markdown fidelity (which DefuddleStrategy depends on, §26.2) needs `full`. Size is acceptable because Defuddle runs in the Side Panel/Standalone view, **not** the < 50 KB content bundle — and its math deps (`mathml-to-latex`, `temml`) plus `turndown` must stay out of the content bundle (enforced by the isolation grep, §24, Appendix G).

### §26.4a Extraction trigger & cache lifecycle (authoritative)

This subsection is **normative** and fixes the timing/lifecycle rules a Phase-4a implementer must follow. All constants live in Appendix C.

**Trigger model — on-demand extraction + subscription-gated auto re-extract:**
- **Lightweight live context** (title, url, meta) updates **always** on navigation — this is the tiny content-bridge payload, not the heavy path.
- **Full extraction** (Defuddle → Readability → APC-lite) runs **only when a surface requests it** (Chat/Summarize/agent `get-page-content`/pin/quick-action). NowPilot never proactively extracts every page (read-only + no MV3 background work + cost-effective posture).
- **Auto re-extract** after `wxt:locationchange` (SPA-nav) or `tabs.onUpdated` fires **only if a surface is subscribed to that tab**. Unsubscribed tabs are **mark-stale only**.
- **"Subscribed" is defined as:** the Side Panel/Standalone is active on that tab **OR** the tab is pinned as context (`WorkspaceState.pinnedTabs` / `currentPageContext`).

**PageContentCache (per tab):**
- Keyed by `tabId`; **separate** from the Phase-1 `PageRegistry` (which registers surface pages, not page content).
- **Invalidate + evict** the tab's cache **and** its ephemeral MiniSearch index immediately on `wxt:locationchange`, `tabs.onUpdated`; evict on `tabs.onRemoved`.
- **Bounded LRU:** keep at most `PAGE_CACHE_MAX_TABS` (default **20**) tab entries; on insert beyond the cap, evict the **least-recently-accessed** tab's entry+index. Access recency is bumped on every cache read/serve. Extraction and its index are **always evicted together** (never orphan an index).
- **Never LRU-evict an in-flight or subscribed tab** (active extraction promise or live subscription). **Pinned tabs are eviction-last** (they count against the cap but are evicted only after unsubscribed/unpinned entries).
- Cache is **ephemeral — never persisted** to IndexedDB.

**Concurrency & race guard:** coalesce concurrent extractions per tab (dedup on the in-flight promise keyed by `tabId`). A read arriving **after invalidation but before re-extract completes** must **await the in-flight extraction**, never return the stale entry.

### §26.5 MiniSearch integration (retrieval-augmented context)

- The ephemeral MiniSearch index is built **lazily on the first `query()` for a tab** (`PageIndexBuilder`). Until then the cache stores raw Defuddle markdown / APC-lite tree only; the index is **built once and memoized** for the tab, and evicted together with the extraction (§26.4a). Never persisted.
- **Chunking (`chunked by heading`, authoritative):** chunk Defuddle markdown by heading boundaries (`h1–h6`); each chunk is a MiniSearch doc with fields `title`, `url`, `headingPath` (breadcrumb), `sectionText`, plus an index-wide `tabId`. Additional rules:
  - **Preamble:** content before the first heading becomes a synthetic `"(preamble)"` chunk under the page title (never orphaned).
  - **No-heading pages:** if the page has zero headings, fall back to **paragraph-block chunks** (blank-line separated) under the page title.
  - **Oversized sections:** if a heading section exceeds `INDEX_CHUNK_MAX_TOKENS` (default **500**), split it into paragraph sub-chunks that **inherit the same `headingPath`**.
- When extracted tokens exceed the **2,000-token webpage budget** (§22.2), inject only selectRelevant(query) results and mark compressionApplied:'topk' in the provenance manifest (§2.6).
- Minimal mode (§2.5) always routes through selectRelevant.
- Page indexes are ephemeral — **never persisted** to IndexedDB.

> **Note:** the same core MiniSearch engine powers *two distinct index instances* — the **ephemeral page index** (§26) and the **persistent notes index** (§27). They never share storage. A page can be captured → converted to a note (Flow 12) → indexed into the persistent notes index for future RAG (Flow 13).

### §26.6 Reliability & privacy

- **HTML payload (content script → panel):** serialize a **pre-stripped clone** of `document.documentElement` (remove `script`/`style`/`noscript`/`svg`/cross-origin `iframe` markup and `form action` attributes; **keep** text, headings, links, and input controls). Stamp the page's **effective base URL** into the payload so the panel's detached `DOMParser` resolves relative URLs (§26.4). Apply a hard size cap `PAGE_HTML_MAX_BYTES` (default **2 MB**); if still larger, **truncate at an element boundary and set `truncated:true`** — no multi-envelope chunking protocol in v0.1.
- **APC-lite depth (v0.1):** ship the **full `APCLiteNode` type** (Appendix C) but a **minimal structural walk** — roles + text + hierarchy + interaction flags + links + tables; **geometry omitted** (the optional `geometry?` field stays unset). If ever populated, geometry MUST be read **content-script-side** against live layout, never in the panel's detached doc. The `AxDomWalker` runs **only on a `mode:'actionable'` request** (zero AX cost on the default read/summarize path).
- **Concurrency guard:** coalesce duplicate extractions per tab; serve the in-flight promise, never a stale entry (§26.4a).
- **Timeout:** 5 s hard cap (§13) via a single `AbortController` threaded through the round-trip; on failure fall back (Defuddle→Readability, AX→DOM), record source, then surface the typed error `CONTENT_EXTRACT_FAILED` (Appendix C.2) — **never a silent empty result**.
- **Invalidation:** SPANavigationWatcher (wxt:locationchange) + tabs.onUpdated.
- **Redaction:** run `TraceRedactor` **panel-side**, over the extracted markdown/tree, **before** indexing or logging (§4.4, §16). The content script performs **no** redaction (keeps the content bundle free of core deps, Appendix G) — it only strips markup and omits password values at capture.
- **Passwords:** field values never captured (isPassword ⇒ value omitted), enforced at capture in the content-script `AxDomWalker` via `FormControlSchema.refine` (Appendix C).
- **Metrics:** duration, node/char count, source, truncation → Diagnostics (§4.5); redacted, no raw body persisted.

### §26.7 Browser automation — deferred to v2

NowPilot v0.1 is **read-only**: content scripts are extraction-only (§5.6); the Agent acts through tools/APIs (§10.5), never by driving the host-page UI. Genuine automation (click/type/navigate) needs **trusted input events** (event.isTrusted), which only chrome.debugger + CDP Input can produce. v0.1/v0.2: no host-page automation, no "debugger" permission. **v2:** add "debugger", a DebuggerSession manager, and automation tools (clickElement/typeText/navigate) resolving a stable APCLiteNode.id → geometry → Input.dispatchMouseEvent. The APCLiteNode schema (Appendix C) is already automation-ready — no schema rework. A separate v2 Automation addendum spec must be ratified first.

### §26.8 Reference projects (informative, non-normative)

- **Defuddle** (kepano, MIT) — adopted as the DefuddleStrategy engine.
- **google/llm-sidebar-with-context** (Apache-2.0) — pattern reference only (not forked). Borrow tab-pinning UX (our cap 10 vs their 6) and site-specific extraction strategies as a model for our add-on IContextExtractor pattern.

## §27 — LLM-Wiki & Filesystem Sync

**Built in Phase 5a.** Requires Phase 5 (Notes + Memory + MiniSearch), Phase 4a (PageContentService), Phase 3 (AI runtime). Extends the atomic-note-with-wikilinks system with LLM enrichment, a hierarchical category system that maps to filesystem folders, RAG Q&A, chat/page-to-note capture, Memory↔Notes integration, and one-way app→filesystem backup with import-for-restore.

**Surfaces affected:** Standalone view (all features + Options); Side Panel (`ChatMessage` "Save to note" only). **Not touched:** BacklinksPanel, NoteGraphView, WikilinkAutocomplete, NotePreview — the atomic-note + wikilink core is preserved unchanged.

### §27.1 Category System (CAT-01…05)

- **CAT-01** Path-based `categoryPath` (e.g. `InfoTech/Database/MySQL`), `/` separator, no leading/trailing slashes; segments normalized (no empty, no `.`/`..`, trim).
- **CAT-02** NoteList tree view grouped by category; "Uncategorized" node; click node → flat list within category.
- **CAT-03** LLM suggests a category path during auto-tagging (LLM receives existing distinct category paths + note content). User accept/edit/dismiss.
- **CAT-04** On backup, a note at `InfoTech/Database/MySQL` saves as `InfoTech/Database/MySQL/Note Title.md`; nested folders auto-created.
- **CAT-05** Normalize on save (strip leading/trailing slashes, collapse duplicates, trim segments); invalid segments flagged (AntD red border).

### §27.2 LLM Features (LLM-WIKI-01…10)

- **LLM-WIKI-01** On save, one **haiku-tier, temperature-0** call returns ≤5 tags + 1 categoryPath (or null) + a 1–2 sentence summary (+ memory facts, NMEM-02). Rendered as accept/reject Tags + inline category input.
- **LLM-WIKI-02** Independent toggles in Options → Notes (`np_notes_llm_features`: autoTag, autoCategorize, autoSummary, aiSearch). When off, no LLM call on save.
- **LLM-WIKI-03** Optional `summary` field; displayed as secondary text in NoteList.
- **LLM-WIKI-04** "Regenerate tags/summary" toolbar button; re-runs the combined call in place.
- **LLM-WIKI-05** Natural-language search: MiniSearch fuzzy → if <3 results or "AI Search", a haiku call reranks top-10 by semantic relevance ("AI-enhanced" indicator). No embeddings/vector store.
- **LLM-WIKI-06** "Ask your notes" RAG: MiniSearch top-5 + memory facts (NMEM-01) → **flash-tier** synthesis with per-statement citations → ephemeral @ant-design/x Bubble with clickable citation Tags (Flow 13).
- **LLM-WIKI-07** "Save to note" on any assistant message → `NoteChatConverter` drafts title/content/tags/wikilinks/categoryPath → pre-filled NoteEditor for review (user is gatekeeper).
- **LLM-WIKI-08** Staleness: `summaryGeneratedAt`/`tagsGeneratedAt` vs `updated` → subtle "Content has changed — [Regenerate tags/summary]" hint.
- **LLM-WIKI-09** Orphan detection (algorithmic, no LLM): 0 wikilinks + 0 backlinks → "Orphan" badge + "Find context" (triggers RAG).
- **LLM-WIKI-10** "Re-analyze all notes" (Options → Notes), user-initiated only, sequential; updates stats in real time.
- **LLM-WIKI-11** Suggestion confidence gating. Every enrichment item the model returns (`memoryFacts[]`, suggested `tags[]`, suggested wikilinks) carries a self-reported `confidence` in `[0,1]`. Items below `NOTE_SUGGESTION_DISPLAY_THRESHOLD = 0.60` are **never surfaced** to the user (silently discarded, not stored). Of the items at or above the threshold, at most `NOTE_SUGGESTION_MAX_FACTS_PER_SAVE = 3` `memoryFacts` and `NOTE_SUGGESTION_MAX_TAGS_PER_SAVE = 5` `tags` are shown per save, ordered by descending confidence; overflow is dropped. (Both constants are defined in Appendix C — there is no single `NOTE_SUGGESTION_MAX_PER_SAVE`.) Accepted items persist at their reported confidence; rejected items are discarded and never re-suggested for the same `{noteId, version}`. When the note is edited before the (non-blocking) suggestions return, stale suggestions for the prior `version` are discarded (never applied to newer content).

### §27.3 One-Way Filesystem Sync (SYNC-01…11)

- **SYNC-01** "Set backup folder" via `showDirectoryPicker()` (**Standalone view only**); FileSystemDirectoryHandle persisted in `notes_backup_config` IndexedDB store (cannot use chrome.storage.local — handles are non-serializable).
- **SYNC-02** On NotesPage mount, verify `handle.queryPermission()`; if denied/missing → sync disabled + banner "Backup folder not accessible. [Re-select folder] [Dismiss]".
- **SYNC-03** Per-save write/update/delete of the `.md` file; fire-and-forget (no loading state); 50 ms debounce prevents rapid-save bursts.
- **SYNC-04 (OKF v0.2-aligned, rev 2026-08-12)** File path: `{categoryPath}/{title}.md`; empty categoryPath → root folder; filename sanitized: `/ \ : * ? " < > |` → `_`. Each file is a UTF-8 Markdown document with an **OKF v0.2-compatible YAML frontmatter block** followed by the Markdown body (wikilinks live inline in the body). Frontmatter fields:

  | Field | OKF role | Source | Required |
  |-------|----------|--------|----------|
  | `type` | OKF **required** (only always-required key) | fixed default `Note` (or producer value, e.g. `Playbook`) | required |
  | `title` | OKF recommended | `Note.title` | required |
  | `description` | OKF recommended | `Note.summary` (when present) | optional |
  | `id` | OKF **extension key** | `Note.id` (immutable UUID, WIKI-ID-01) | required (NowPilot identity) |
  | `created` / `updated` | extension | `Note.created` / `Note.updated` (epoch) | required |
  | `tags` | OKF `tags` | `Note.tags[]` | optional |
  | `categoryPath` | extension | `Note.categoryPath` | optional |
  | `generated` | OKF `generated` | `{ by: nowpilot/<tier-model>, at: <ISO 8601> }` from `tagsGeneratedAt`/`summaryGeneratedAt` | required |
  | `status` | OKF `status` | `draft` | `stable` (default `stable`) | required |

  **Canonical emitted example:**
  ```markdown
  ---
  type: Note
  title: INC Lifecycle Flow
  description: One-row-per-state summary of the incident lifecycle in ServiceNow.
  id: 6f2c1a90-7b3e-4d51-9c2a-1e77aa42b0c9
  created: 1754870400000
  updated: 1754956800000
  tags: [servicenow, incident, lifecycle]
  categoryPath: Work Knowledge Base/ServiceNow/Incident
  generated: { by: nowpilot/claude-haiku-4, at: 2026-08-12T09:58:00Z }
  status: stable
  ---
  # Incident lifecycle

  New -> In Progress -> On Hold -> Resolved -> Closed.

  See [[Problem Lifecycle Flow]] and [[Change Request Flow]] for related processes.
  ```

  **Contract notes.** (a) **Identity stays UUID** - OKF v0.2 treats the file *path* as the Concept ID, but NowPilot intentionally keeps the immutable `id` (WIKI-ID-01) as the source of truth and exposes it as an OKF extension key; a generic OKF consumer ignores it, restore (SYNC-09) keys off it. (b) **Links stay wikilinks** - `[[Title]]` remains inside the body so the atomic-note graph is fully reconstructable on restore (§27.7a); NowPilot does **not** emit OKF standard-markdown-link edges in v0.1. (c) **No secrets** - all frontmatter/body still passes through TraceRedactor before write; password field values are never written (§16.4, §27.6).
- **SYNC-05** Title collision (same title + same category) → numeric suffix: `My Note.md`, `My Note (1).md`, … Scan existing files for highest suffix before writing.
- **SYNC-06** External-change detection: if file lastModified newer than last sync (2 s tolerance) → confirm "Overwrite with app version? [Overwrite] [Skip]", default Skip.
- **SYNC-07** No backup folder → all sync ops are no-ops; toolbar indicator "Backup: off [Configure]".
- **SYNC-08** Status Tag: green "Backup: On" / gray "Backup: Off" / red "Backup: Error" (tooltip shows last error).
- **SYNC-09** "Restore from backup" via `showDirectoryPicker()` → walk tree → parse `.md` frontmatter → upsert: id exists → update (preserve updated if newer); id missing → create; additive (notes not in folder are NOT deleted); categoryPath reconstructed from folder path. **OKF tolerance (rev 2026-08-12):** the parser reads the OKF-aligned frontmatter (SYNC-04) — `type`/`description`/`generated`/`status` are parsed without error, and **any unknown OKF key is tolerated and preserved** (OKF §11: consumers must not reject unrecognized fields). Missing OKF families never reject a file; `id` is read from the OKF extension key to preserve identity and every wikilink edge on round-trip.
- **SYNC-10** Restore preview modal: "Found 24 notes (12 new, 3 updated, 9 unchanged). Proceed? [Import] [Cancel]".
- **SYNC-11** Delete-on-sync: deleting a note removes its `.md`; if the nested category folder becomes empty it is removed (clean backup).

### §27.4 Memory ↔ Notes Integration (NMEM-01…03)

- **NMEM-01** Memory-aware RAG: "Ask notes" retrieval also queries MemoryEngine for relevant user facts/preferences; highly relevant facts are included as context alongside note snippets.
- **NMEM-02** On save, the same LLM call extracts memory-worthy facts (MemoryExtractor schema) → routed through MemoryEngine for conflict resolution + storage. **Notes → Memory only** (D-05). Runs on the primary surface only (§13).
- **NMEM-03** "Save from chat" (LLM-WIKI-07) uses conversation messages AND `MemoryEngine.assemble()` facts to produce a richer draft.

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

**OKF v0.2 compatibility (informative, rev 2026-08-12).** The on-disk `.md` format is **OKF v0.2-compatible** (see the [Open Knowledge Format v0.2 spec](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)): a directory of Markdown files with YAML frontmatter and a free-form body. The serialized frontmatter carries OKF's only always-required key `type` (default `Note`), the recommended `description` (= the LLM `summary`), and the `generated`/`status` trust-lifecycle families (SYNC-04). NowPilot deliberately keeps its **immutable UUID `id`** as the source of truth (written as an OKF *extension key*, which OKF consumers must tolerate) and keeps **wikilinks** — not OKF standard-markdown-link edges — as the body edge syntax, so the atomic-note graph survives rename/move/restore (WIKI-ID-01…04). Strict-OKF conformance (markdown-link edges as graph edges, path-as-Concept-ID, and the `sources`/`verified` provenance families) would break the UUID-identity/wikilink model and is therefore **out of scope for v0.1** — deferred to v0.2+ behind a dedicated ADR. The net posture is **OKF-compatible, not OKF-constrained**: a generic OKF consumer can read a NowPilot note today, while NowPilot's internal identity/link graph stays authoritative.

### §27.7a Note Identity, Rename & Unresolved Links (WIKI-ID-01…04)

- **WIKI-ID-01 — Immutable identity.** A note's `id` is a `crypto.randomUUID()` assigned at creation and **never changes** — not on rename, move (category change), or filesystem restore. The `title` is mutable display text; the `id` is the stable referent. All graph edges (`links[]`, backlinks) are stored as **note IDs**, never titles, so renaming a note can never break an existing edge.
- **WIKI-ID-02 — Wikilink syntax vs storage.** Authors type human-readable `[[Title]]` in the markdown body. On save, `LinkParser.parseLinks()` extracts the raw targets and `resolveLinks()` maps each to a note ID via the resolution order (exact title match → `updated` desc → `id` asc, per §26). Resolved targets go to `links[]` (IDs); the original display text is preserved inline for rendering. Renaming a *target* note updates only that note's `title`; because edges are ID-based, no source note needs rewriting, and the link label re-renders from the target's current title on next paint.
- **WIKI-ID-03 — Unresolved links.** A `[[Title]]` with no matching note resolves to no ID and is recorded in the source note's `unresolvedLinks[]` (raw target strings). The editor renders unresolved links **distinctly** (muted/dashed style + "create note" affordance) so they are visually separable from resolved links. When a note whose title matches a pending unresolved target is later created, a save-time reconciliation pass promotes the matching `unresolvedLinks[]` entries on referencing notes into `links[]` (by the new note's ID) and clears them from `unresolvedLinks[]`. This pass is bounded (MiniSearch title lookup, primary surface only) and never blocks the save.
- **WIKI-ID-04 — Deletion.** Deleting a note does **not** rewrite source bodies; the referencing edges become dangling and are moved from `links[]` back into `unresolvedLinks[]` on those notes at the next save/graph rebuild, so the `[[Title]]` renders as an unresolved link the user can recreate. Filesystem restore (§27.3) reconstructs IDs from YAML frontmatter, so round-tripping a vault preserves every edge.

### §27.8 Decisions

| # | Decision | Rationale |
|---|---|---|
| D-01 | Single LLM call for tags + category + summary | One haiku call is cheaper/faster than three; structured JSON returns all three |
| D-02 | Notes dual-friendly: human body, machine frontmatter | Body is natural markdown; YAML frontmatter is structured metadata; both consumers served by one file |
| D-02a | **Note frontmatter is OKF v0.2-aligned** (rev 2026-08-12) — OKF-compatible, not OKF-constrained | The `.md` + YAML-frontmatter + folder-tree container already matches OKF v0.2's "directory of markdown files with YAML frontmatter." Adding OKF `type`/`description`/`generated`/`status` makes a note readable by any generic OKF consumer while keeping the immutable UUID `id` as an OKF extension key and wikilinks as body edges. OKF's own value-add (provenance/trust/lifecycle) maps onto the harness `MemoryRecord`/`CompletionEvidence` taxonomy (§28.2/§28.4), avoiding two competing metadata vocabularies. Strict-OKF markdown-link edges + path-as-identity + `sources`/`verified` families conflict with WIKI-ID-01…04 and are deferred to v0.2+ behind a dedicated ADR |
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

## §28 — Verified Agent Harness Requirements

### §28.1 Purpose

This section adds evidence-backed completion, trust-aware context, governed memory, capability-based tools, trajectory evaluation, and verified evolution. It does not replace the bounded Planner → Executor → Renderer architecture.

> **Where each requirement is built:** the P0/P1 IDs below are folded next to their implementation phase in §18 (AGT→3a, CTX→4b, MEM/KNW→5b, TOL→8a, EVAL→6a, EVO→6b). Canonical shapes are in Appendix C.1; **worked reference implementations are in Appendix O**.

### §28.2 Agent reliability requirements

- **AGT-01 (P0):** Add explicit trajectory states: assembling-context, planning, waiting-for-permission, executing, verifying, replanning, rendering, completed, failed, aborted.
- **AGT-02 (P0):** Side-effecting success requires `CompletionEvidence`. Renderer must not claim execution without matching evidence.
- **AGT-03 (P0):** Every turn produces a structured `AgentTurnOutcome`; cap exhaustion is partial, not successful.
- **AGT-04 (P0):** Replanning follows a deterministic retry/terminal policy: at most one replan per failed tool within the tier's planner cap (§1.4); a repeated identical failure, a cap breach, or an abort is terminal and yields a `partial` or `failed` `AgentTurnOutcome` — never a silent success.

### §28.3 Trust-aware context requirements

- **CTX-01 (P0):** Context sources carry relevance, freshness, trust, sensitivity, and instruction-authority metadata.
- **CTX-02 (P0):** Page, note, memory, upload, and tool output are untrusted data and cannot redefine system/tool/permission policy.
- **CTX-03 (P0):** `ContextProvenanceManifest` becomes a context receipt with inclusion, omission, original/final tokens, compression, and cache eligibility.
- **CTX-04 (P0):** Stable prefix snapshot tests are mandatory.
- **CTX-05 (P1):** Skills use progressive disclosure; irrelevant full instructions consume zero prompt tokens.
- **CTX-06 (P1):** Diagnostics track context quality without persisting raw sensitive text.

### §28.4 Memory and knowledge governance

> These `MEM-*` IDs are the harness-track memory-governance taxonomy and are **distinct** from the Notes↔Memory `NMEM-01…03` requirements in §27.4.


- **MEM-01 (P0):** Memory taxonomy includes working, episodic, semantic, preference, and procedural records.
- **MEM-02 (P0):** Durable memories require source, confidence, lifecycle, sensitivity, and verification timestamps.
- **MEM-03 (P0):** Conflict precedence is explicit correction > verified current state > prior explicit memory > inference.
- **MEM-04 (P0):** User controls include view, source, confidence, edit, pin, forget, type disable, export, and cloud exclusion.
- **MEM-05 (P1):** Procedural experience is stored separately and activated only after verification and approval.
- **KNW-01 (P1):** Graph edges record explicit, imported, suggested, or accepted provenance.

### §28.5 Tool governance

- **TOL-01 (P0):** Every tool has a `ToolCapabilityManifest` with category, risk, side effect, permissions, scopes, timeout, cost, idempotency, verifier, and schema hashes.
- **TOL-02 (P0):** Permission policy is risk- and side-effect based.
- **TOL-03 (P0):** Side-effecting tools define postcondition verification.
- **TOL-04 (P0):** Tool results are validated, redacted, size-limited, shaped, and attributed before context injection.
- **TOL-05 (P0):** Every write tool is replay-safe through idempotency.
- **TOL-06 (P1):** Tool registries use active discovery when schemas exceed the tools budget.
- **TOL-07 (P2):** Long-running operations use a resumable async contract in a future phase.

### §28.6 Evaluation requirements

- **EVAL-01 (P0):** Maintain versioned golden suites for planner, context, tools, permissions, providers, memory, RAG, completion evidence, and multimodal routing.
- **EVAL-02 (P0):** Use a trajectory rubric with separate outcome, process, safety, grounding, memory, quality, latency, and cost dimensions.
- **EVAL-03 (P0):** Prefer deterministic environment/process validators; use calibrated LLM judges only for qualitative dimensions.
- **EVAL-04 (P0):** Diagnostics assign the first failing layer.
- **EVAL-05 (P0):** Safety, leakage, injection, false-completion, citation, and isolation regressions block release.
- **EVAL-06 (P1):** Report cost/latency/quality Pareto comparisons.
- **EVAL-07 (P1):** Calibrate and version LLM judges.

### §28.7 Verified evolution requirements

- **EVO-01 (P1):** Verified trajectories create candidates, never direct production changes.
- **EVO-02 (P1):** Each candidate targets one layer: knowledge, retrieval, instruction, experience, tool, workflow, or model tier.
- **EVO-03 (P1):** `EvolutionCandidate` stores evidence, baseline, candidate, security, version, status, and rollback.
- **EVO-04 (P0):** Untrusted/raw content cannot directly update active prompts, tools, permissions, code, or procedural memory.
- **EVO-05 (P1):** Candidate activation requires sandbox evaluation, approval, scoped rollout, monitoring, and rollback.
- **EVO-06 (P2):** Agent-generated tools remain sandbox proposals and cannot self-publish.

### §28.7a Candidate Proposer contract

**Design intent.** NowPilot's self-learning is **human-verified continual evolution, not autonomous self-modification.** The live orchestration (§1.2, §1.6) is deterministic and never rewrites itself at runtime. Learning happens *beside* the runtime as a **gated candidate pipeline**: evaluation (§28.6) detects a weakness, the **Candidate Proposer** turns it into a typed `EvolutionCandidate`, and nothing activates without sandbox evaluation + human approval (EVO-01/04/05).

`CandidateProposer` (`src/core/evolution/CandidateProposer.ts`, Phase 6b) is the missing bridge between *evaluation output* and *evolution input*. It is **deterministic**: same eval failures ⇒ same proposals.

- **PROP-01 (P1):** The proposer's **only** inputs are (a) failed golden-suite results carrying a `FailureLayer` (EVAL-04) and (b) the `AITransactionLog` evidence for those operations. It never reads raw untrusted content (page/note/tool output) to form a proposal (EVO-04, §28.3).
- **PROP-02 (P1):** Each proposal targets **exactly one** layer, mapped deterministically from `FailureLayer` → candidate `targetLayer` (EVO-02). A failure spanning multiple layers yields multiple single-layer proposals, never one blended patch.
- **PROP-03 (P1):** A proposal is emitted **only** when the weakness clears an **evidence threshold**: at least `PROPOSE_MIN_FAILURES` (default **3**) failing trajectories agree on the same `FailureLayer`, over a rubric-score drop ≥ `PROPOSE_MIN_SCORE_DELTA` (default **0.15**). Below threshold ⇒ no proposal (avoids over-fitting to one bad run).
- **PROP-04 (P1):** Every proposal carries a **cost cap**: an estimated token/latency budget for its sandbox evaluation. If the projected sandbox cost exceeds `PROPOSE_MAX_EVAL_TOKENS` (default **50_000**), the proposal is marked `deferred`, not run — keeping self-learning affordable for cost-effective deployments.
- **PROP-05 (P0):** The proposer **only proposes**. It emits `status: 'proposed'` candidates into the Phase 6b store and can never activate, scope-roll, or write them into active prompts/tools/permissions/procedural memory (EVO-01/04/05). Activation stays human-gated.
- **PROP-06 (P1):** Every proposal is reproducible: it records the eval-suite version, the contributing `operationId`s, and a content hash so the same inputs regenerate an identical candidate (supports EVAL-07 judge/version calibration).

Canonical types are in **Appendix C.1**; a worked implementation is in **Appendix O.9**. Constants live in Appendix C.1 alongside the types.

## §29 — Multimodal Input and Real-Time Interaction Foundation

### §29.1 Scope

v0.1 adds a bounded multimodal input foundation, not a second agent architecture. Image, audio, and document inputs become normalised observations consumed by the existing ContextOptimizer and agent pipeline.

> **Where each requirement is built:** the MM-* IDs below are folded into Phase 7a (§18). Canonical shapes are in Appendix C.1; a worked adapter is in **Appendix O.6**.

### §29.2 Requirements

- **MM-01 (P1):** Define `ModalityInput` for text, image, audio, and document references. Binary payloads never enter prompt sections directly.
- **MM-02 (P1):** `ModalityObservation` carries source ID, modality, extracted text/structure, confidence, sensitivity, and timestamps.
- **MM-03 (P1):** Image paste/upload supports screenshot, diagram, table, UI-state, and note-draft use cases through a configured vision-capable model.
- **MM-04 (P1):** Voice input is transcribed into an editable Sender; tool execution requires explicit send/confirmation.
- **MM-05 (P2):** A later fast/slow architecture separates low-latency interaction from deep reasoning/tool work.
- **MM-06 (P1):** Interruption propagates the existing AbortSignal across transcription, planning, tools, and rendering.
- **MM-07 (P0 boundary):** APC-lite does not authorise computer use. Browser automation remains deferred to a separate addendum.

### §29.3 Privacy and provider routing

- Modality blobs are operation-scoped unless explicitly saved.
- No raw image/audio persistence in traces.
- TraceRedactor applies to extracted/transcribed observations.
- Never switch local to cloud for multimodal processing unless `allowCloudFallbackFromLocal` permits it.
- If no compatible model is configured, return `MULTIMODAL_MODEL_UNAVAILABLE` with a settings action.

## §30 — Bounded Multi-Agent Collaboration (single-agent default)

### §30.1 Architecture decision

NowPilot uses a **coordinator-based agent platform** (§1.6). **Single-agent execution is the default configuration, implemented as a one-role `CollaborationPlan`.** Multi-agent execution uses two or more registered roles coordinated through typed handoffs and shared verified task state.

All agent execution — single-agent or multi-agent — uses the **same** runtime (§1.2), tool governance (§28.5), evaluation (§28.6), memory governance (§28.4), and security model (§16.6). Multi-role workflows are added as **data** (roles + plans), never as a second runtime, so there is no separate architecture to build later.

The initial multi-role implementation is one `CollaborationCoordinator` running **bounded staged roles**. Dynamic agent creation, unbounded spawning, peer-granted permissions, uncontrolled agent-to-agent conversation, shared mutable worker memory, and agreement-as-verification remain **prohibited** in every mode (§16.6). Isolated parallel workers are deferred (§30.6).

Routine chat, summarisation, rewriting, and simple retrieval run on the default one-role plan and never pay multi-agent overhead.

### §30.2 Requirements

- **COLLAB-01 (P1):** Multi-role collaboration requires explicit user/workflow activation or an allowed deterministic complexity policy. Planner recommendation alone cannot silently enable it. (The one-role default needs no activation.)
- **COLLAB-02 (P1):** Roles come from a closed `CollaborationRoleRegistry`; each has a role-specific prompt, tool allowlist, context projection, budget, and timeout.
- **COLLAB-03 (P1):** `CollaborationPlan` defines stages, dependencies, roles, total planner/tool/token caps, and deadline. The single-agent default is the one-role plan (`stages.length === 1`).
- **COLLAB-04 (P1):** Roles exchange `AgentHandoffArtifact` values containing summaries, sourced facts, open questions, output references, and completion status. Hidden reasoning is never exchanged or logged.
- **COLLAB-05 (P0 boundary):** One coordinator owns sequencing, permission requests, side-effect commits, and termination.
- **COLLAB-06 (P0 boundary):** Workers cannot directly write memory/notes, execute side effects, export data, or activate evolution candidates.
- **COLLAB-07 (P1):** High-impact output requires an independent reviewer that did not create the candidate result.
- **COLLAB-08 (P1):** Role failures are contained and may trigger one safe retry, substitution, reduced-confidence continuation, single-agent fallback, or termination.
- **COLLAB-09 (P1):** Staged roles share one OptimizedContext through role-specific projections and typed artefacts; full trajectories are not duplicated across roles.
- **COLLAB-10 (P1):** Collaboration traces record roles, policies, supplied sources, handoffs, tools, permissions, budgets, reviewer decision, evidence, and termination without raw prompts or hidden reasoning.
- **COLLAB-11 (P1):** A collaborative workflow ships only after evaluation against the single-agent baseline and configured quality/cost/latency/safety gates.
- **COLLAB-12 (P2):** Future isolated parallel workers are allowed only for independent sub-tasks and communicate through validated artefacts or referenced files.
- **COLLAB-13 (P0 boundary):** Open-ended agent chat, dynamic unbounded spawning, peer-granted permissions, shared mutable worker memory, and agreement-as-verification are forbidden.

### §30.3 Initial multi-role workflow candidates

1. Complex ServiceNow case investigation.
2. Deep multi-source research.
3. High-value LLM-Wiki knowledge review.
4. Verified evolution review.
5. Specification → implementation → test → architecture review.

### §30.4 Required types

Canonical Zod-validated shapes live in **Appendix C.1 (Harness-Track & Collaboration Types)** — implemented during Phase 6c: `CollaborationRole`, `RolePolicy`, `CollaborationPlan`, `AgentHandoffArtifact`, `CollaborationOutcome`. The `AssistantRole` used by the single-agent default is the one-role instance of `CollaborationRole`.

### §30.5 Implementation & verification

**Phase 6c (§18)** is the single source for the collaboration build steps, files, tests, and the `verify:phase-6c` command (also in §24). Collaboration error codes live in **Appendix C.2 (Error Code Registry)**.

### §30.6 Future Phase 8b — Isolated Parallel Workers

Parallel worker execution is deferred until Phase 6c is stable and evaluated. It requires isolated contexts, bounded concurrency, cancellation, referenced artefacts, deterministic merge/review, and no shared mutable state. Agent-generated tool proposals remain a separate later capability and must not be combined with initial parallel-worker work.

---

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
  // --- LLM-Wiki (§27) ---
  noteTagger: {
    system: 'Analyze the note title and content. Return JSON only: {tags:[{value:string,confidence:number}], categoryPath:string|null, summary:string, memoryFacts:[{content:string,confidence:number}]}. Each confidence is your own 0..1 estimate; the client discards items below its display threshold (LLM-WIKI-11). categoryPath uses "/" separators and should reuse an existing path when suitable. Do not invent facts. Do not include secrets.',
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
  // --- RICH (§17.7) ---
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

> **Note:** the persona block (RICH-R-02) is prepended to the `planner`, `renderer`, `memoryExtractor`, `noteTagger`, `noteQA`, and `noteChatConvert` system strings by `PersonaInjector.inject()` at request time. Do **not** hard-code persona text into these constants — keep them byte-stable for prompt caching (§1.3).

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
    // --- LLM-Wiki (§27) ---
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
    working: 'NowPilot is working...',           // RICH-H-03
  },
  standalone: {
    openTitle: 'Open Standalone view',
    opening: 'Opening standalone view...',
    openFailed: 'Failed to open Standalone view',
    minWidth: 'This view is optimized for wider screens; open the side panel for narrow layouts.',
  },
  workspace: {
    handoffPending: 'Opening workspace in standalone view...',
    handoffComplete: 'Workspace opened in standalone view.',
    mirroringNotice: 'Standalone view is now the primary surface for this workspace.',
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
    persona: 'Persona',           //
    notes: 'Notes',               //
    about: 'About',
  },
  // --- RICH (§17.7) ---
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
  source: 'sidepanel' | 'background' | 'content' | 'addon' | 'standalone';
  target?: 'sidepanel' | 'background' | 'content' | 'addon' | 'standalone';
  payload: T;
}
export type ResponseEnvelope<T = unknown> =
  | { id: string; ok: true;  data: T }
  | { id: string; ok: false; error: { code: string; message: string; retryable: boolean } };
```

```ts
// src/core/ai/types.ts
export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama';
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
// Result returned by ExecutorService.execute() and consumed by AgentOrchestrator,
// OutcomeVerifier (Appendix O.2), and CandidateProposer evidence. Referenced across
// Appendix I/O — defined here as the single source of truth.
export interface ToolExecutionResult<T = unknown> {
  toolName: string;                 // used by OutcomeVerifier to pick a postcondition verifier
  ok: boolean;
  output?: T;
  error?: { code: string; message: string; retryable: boolean };
  evidence?: import('@/types/harness').CompletionEvidence; // set for side-effecting tools (§28.2)
  durationMs: number;
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
  when?: 'always' | 'in-composer' | 'in-note' | 'in-side-panel' | 'in-standalone';
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
// src/core/registry/StandalonePageRegistry.ts
export interface StandalonePageRegistration {
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
// src/core/workspace/WorkspaceStore.ts
export type ActiveSurface = 'sidepanel' | 'standalone';
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
  openedStandaloneTabId?: number;
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
  llmWiki: boolean; — master toggle for §27 LLM features
  filesystemSync: boolean; — master toggle for §27 backup/restore
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
  defaultSurface: 'sidepanel' | 'standalone';
  // theme is NOT here — display mode (np_theme) + theme pack (np_theme_pack) are the
  // single source of truth in chrome.storage.sync (§17.1a, §15.1, Appendix F).
  // --- RICH persona (reconciliation R2: user config, NOT a fact) ---
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
// NOTE on the two enums (read before implementing): `IExtractionStrategy.id` enumerates the
// installed STRATEGIES; there is intentionally NO separate ReadabilityStrategy — Readability is
// Defuddle's internal fallback, so it appears in `StrategyResult.source` (result provenance) but
// NOT as its own strategy id. `PageContext.source` (the z.enum at §Appendix C page-context block)
// additionally carries 'dom'|'ax'|'hybrid' for the APC-lite walk provenance. Do not create a
// ReadabilityStrategy or a ServiceNow strategy in Phase 4a (ServiceNow strategy registers in Phase 8).

// §26.4a / §26.5 / §26.6 tunables (Phase 4a). All ephemeral; none persisted.
export const PAGE_CACHE_MAX_TABS   = 20;         // per-tab PageContentCache LRU cap (§26.4a)
export const PAGE_HTML_MAX_BYTES   = 2_000_000;  // serialized HTML hard cap → truncate+flag (§26.6)
export const INDEX_CHUNK_MAX_TOKENS = 500;       // oversized heading-section split threshold (§26.5)
export const PAGE_EXTRACTION_TIMEOUT_MS = 5_000; // hard cap, single AbortController (§26.6, §13)
```

```ts
// src/types/addon.ts
export interface Addon {
  id: string;
  name: string;
  scope: 'site' | 'global';
  urlPatterns?: string[];
  contextExtractor?: IContextExtractor;
  skills?: ISkill[];
  prompts?: PromptTemplate[];
  sidePanelPages?: SidePanelPageRegistration[];   //
  standalonePages?: StandalonePageRegistration[];       //
  addonSettings?: z.ZodSchema<unknown>;
  keymap?: KeymapRegistration[];
}
```

```ts
// src/types/notes.ts
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
  type?: string;                 // OKF v0.2 frontmatter type (rev 2026-08-12); default 'Note'. Declared Phase 5, serialized Phase 5a.
  version: number;
}
// OKF v0.2 note-frontmatter contract (rev 2026-08-12). NoteFileSync emits this shape;
// the restore parser tolerates it and ignores any unknown OKF keys (OKF §11).
// `id` is emitted as an OKF EXTENSION key (UUID identity, WIKI-ID-01); wikilinks stay in the body.
export const OKF_NOTE_DEFAULT_TYPE = 'Note';
export interface OkfNoteFrontmatter {
  type: string;                  // OKF-required (default OKF_NOTE_DEFAULT_TYPE)
  title: string;                 // OKF-recommended
  description?: string;          // OKF-recommended (= Note.summary when present)
  id: string;                    // OKF extension key — immutable UUID (WIKI-ID-01)
  created: number;
  updated: number;
  tags?: string[];               // OKF `tags`
  categoryPath?: string;         // extension
  generated: { by: string; at: string };  // OKF trust family; by = `nowpilot/<tier-model>`, at = ISO 8601
  status: 'draft' | 'stable';    // OKF lifecycle family (default 'stable')
}
// Suggestion-gating constants (LLM-WIKI-11). Items below the threshold are never
// surfaced; the caps bound how many gated items are shown per save.
export const NOTE_SUGGESTION_DISPLAY_THRESHOLD = 0.60;   // confidence floor for surfacing
export const NOTE_SUGGESTION_MAX_FACTS_PER_SAVE = 3;     // max memoryFacts shown per save
export const NOTE_SUGGESTION_MAX_TAGS_PER_SAVE  = 5;     // max suggested tags shown per save

const ConfidentTag  = z.object({ value: z.string(), confidence: z.number().min(0).max(1) });
const ConfidentFact = z.object({ content: z.string(), confidence: z.number().min(0).max(1) });

export const NoteTagResultSchema = z.object({
  // Each suggested tag/fact carries a self-reported confidence so LLM-WIKI-11 can gate it.
  tags: z.array(ConfidentTag).max(10),          // pre-gating; UI applies threshold + max-5 cap
  categoryPath: z.string().nullable(),
  summary: z.string(),
  memoryFacts: z.array(ConfidentFact).max(10).default([]), // pre-gating; UI applies threshold + max-3 cap
});
export type NoteTagResult = z.infer<typeof NoteTagResultSchema>;

/** Apply LLM-WIKI-11 gating: drop below-threshold items, cap, sort by confidence desc. */
export function gateSuggestions(r: NoteTagResult): { tags: string[]; memoryFacts: string[] } {
  const pick = <T extends { confidence: number }>(arr: T[], cap: number) =>
    arr.filter(x => x.confidence >= NOTE_SUGGESTION_DISPLAY_THRESHOLD)
       .sort((a, b) => b.confidence - a.confidence)
       .slice(0, cap);
  return {
    tags: pick(r.tags, NOTE_SUGGESTION_MAX_TAGS_PER_SAVE).map(t => t.value),
    memoryFacts: pick(r.memoryFacts, NOTE_SUGGESTION_MAX_FACTS_PER_SAVE).map(f => f.content),
  };
}
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
// src/types/persona.ts
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

### Appendix C.1 — Harness-Track & Collaboration Types

These shapes are **self-contained** (there is no external `NOWPILOT_ADDITIONAL_REQUIREMENTS_AGENT_HARNESS.md`). Implement each type in its target sub-phase (§18) and treat these as the single source of truth.

> **CANONICAL TYPE HOME (MANDATORY).** All harness-track, collaboration, evolution, multimodal, stage-event, proposer, and working-memory types below live in **one file: `src/types/harness.ts`**, re-exported via the path alias **`@/types/harness`**. Every worked example (Appendix O) imports from `@/types/harness`. Do **not** invent `@/types/collaboration`, `@/types/evolution`, or `@/types/memory` for these shapes — that split is a common cost-effective-model error. `UserPreferences` and `RetrievedMemory` remain in `@/core/memory/types`; `ToolExecutionResult`/provider types remain in `@/core/ai/types`.
>
> | Type group | Types | Home file |
> |---|---|---|
> | Reliability | `AgentTrajectoryState`, `CompletionEvidence`, `AgentTurnOutcome` | `@/types/harness` |
> | Trust context | `ContextItem`, `ContextReceiptEntry`, `TrustLevel` | `@/types/harness` |
> | Memory gov. | `MemoryRecord`, `ProceduralExperience`, `KnowledgeEdgeSource`, `WorkingMemory` | `@/types/harness` |
> | Tools | `ToolCapabilityManifest` | `@/types/harness` |
> | Eval/evolution | `FailureLayer`, `EvolutionCandidate`, `EvolutionCandidateProposal`, `ProposerInput` | `@/types/harness` |
> | Multimodal | `Modality`, `ModalityInput`, `ModalityObservation` | `@/types/harness` |
> | Collaboration | `CollaborationRole`, `RolePolicy`, `CollaborationPlan`, `AgentHandoffArtifact`, `CollaborationOutcome`, `StageEvent` | `@/types/harness` |
> | Runtime result | `ToolExecutionResult` | `@/core/ai/types` |

```ts
// src/types/harness.ts — single home for all types in this appendix section
// ---- Agent reliability (Phase 3a, §28.2) ----
export type AgentTrajectoryPhase =
  | 'assembling-context' | 'planning' | 'waiting-for-permission'
  | 'executing' | 'verifying' | 'replanning' | 'rendering'
  | 'completed' | 'failed' | 'aborted';

export interface AgentTrajectoryState {
  operationId: string;
  phase: AgentTrajectoryPhase;
  plannerCalls: number;
  toolCalls: number;
  updatedAt: number;
}
export interface CompletionEvidence {
  toolName: string;
  operationId: string;
  postconditionId: string;   // verifier that produced this evidence (TOL-03)
  ok: boolean;
  verifiedAt: number;
  detail?: string;
}
export interface AgentTurnOutcome {
  operationId: string;
  status: 'completed' | 'partial' | 'failed' | 'aborted';
  reasonCode: string;        // cap exhaustion => 'partial', never 'completed'
  evidence: CompletionEvidence[];
  plannerCalls: number;
  toolCalls: number;
}

// ---- Trust-aware context (Phase 4b, §28.3) ----
export type TrustLevel = 'system' | 'user' | 'tool' | 'retrieved' | 'untrusted';
export interface ContextItem {
  id: string;
  kind: PromptSection['kind'];
  text: string;
  tokens: number;
  trust: TrustLevel;
  instructionAuthority: boolean;   // MUST be false for retrieved/untrusted data
  relevance: number;               // 0..1
  freshness: number;               // 0..1
  sensitivity: 'none' | 'low' | 'high';
  sourceId: string;
}
export interface ContextReceiptEntry {
  sourceId: string;
  included: boolean;
  originalTokens: number;
  finalTokens: number;
  compression?: 'summarise' | 'structural' | 'topk';
  cacheEligible: boolean;
  omitReason?: string;
}

// ---- Memory & knowledge governance (Phase 5b, §28.4) ----
export type MemoryKind = 'working' | 'episodic' | 'semantic' | 'preference' | 'procedural';
export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  content: string;
  source: 'explicit' | 'inferred' | 'system' | 'correction';
  confidence: number;              // 0..1
  sensitivity: 'none' | 'low' | 'high';
  lifecycle: 'active' | 'expired' | 'forgotten' | 'pinned';
  verifiedAt?: number;
  createdAt: number;
  updatedAt: number;
}
export interface ProceduralExperience {
  id: string;
  trigger: string;
  steps: string[];
  status: 'candidate' | 'approved' | 'rejected';
  evidenceOperationIds: string[];  // activated only after verification + approval
  createdAt: number;
}
export type KnowledgeEdgeSource = 'explicit' | 'imported' | 'suggested' | 'accepted';

// ---- Tool governance (Phase 8a, §28.5) ----
export interface ToolCapabilityManifest {
  toolName: string;
  category: string;
  risk: 'low' | 'medium' | 'high';
  sideEffect: boolean;
  requiredPermissions: string[];
  scopes: string[];
  timeoutMs: number;
  estCostTokens: number;
  idempotent: boolean;             // every write tool MUST be replay-safe (TOL-05)
  verifierId?: string;             // postcondition verifier (TOL-03)
  inputSchemaHash: string;
  outputSchemaHash: string;
}

// ---- Evaluation & evolution (Phase 6a/6b, §28.6/§28.7) ----
export type FailureLayer =
  | 'knowledge' | 'retrieval' | 'context' | 'planning'
  | 'tool' | 'permission' | 'memory' | 'rendering' | 'safety';
export interface EvolutionCandidate {
  id: string;
  targetLayer: FailureLayer | 'instruction' | 'experience' | 'workflow' | 'model-tier';
  evidenceOperationIds: string[];
  baselineRef: string;
  candidateRef: string;
  security: 'sandboxed';           // never touches active prompts/tools directly (EVO-04)
  version: string;
  status: 'proposed' | 'approved' | 'rejected' | 'rolled-back';
  rollbackRef: string;
}

// ---- Multimodal input (Phase 7a, §29) ----
export type Modality = 'text' | 'image' | 'audio' | 'document';
export interface ModalityInput {
  id: string;
  modality: Modality;
  ref: string;                     // object/blob/storage ref — NEVER inline binary in prompts
  mime: string;
  createdAt: number;
}
export interface ModalityObservation {
  sourceId: string;
  modality: Modality;
  extractedText?: string;
  structure?: unknown;
  confidence: number;              // 0..1
  sensitivity: 'none' | 'low' | 'high';
  createdAt: number;
}

// ---- Working memory (Phase 5, §3.6) ----
export interface WorkingMemory {
  resourceId: string;              // user/owner scope (NOT thread) — §3.1
  markdown: string;                // fixed template below
  tokens: number;                  // enforced cap (§3.6: ≤ 300 recommended)
  updatedAt: number;
}
export const WORKING_MEMORY_TEMPLATE = `# User Profile
- **Name**:
- **Role / Team**:
- **Environment**:
- **Preferences**:
- **Long-term Goals**:`;

// ---- Bounded multi-agent collaboration (Phase 6c, §30) ----
export interface CollaborationRole {
  id: string;
  label: string;
  systemPromptId: string;
  toolAllowlist: string[];
  contextProjection: PromptSection['kind'][];   // which context kinds this role may see
}
export interface RolePolicy {
  roleId: string;
  plannerCap: number;
  toolCap: number;
  tokenCap: number;
  timeoutMs: number;
  canReview: boolean;              // independent reviewer flag (COLLAB-07)
}
export interface CollaborationPlan {
  id: string;
  stages: Array<{ roleId: string; dependsOn: string[] }>;
  totalPlannerCap: number;
  totalToolCap: number;
  totalTokenCap: number;
  deadlineMs: number;
  // The DEFAULT single-agent path is a one-role plan: stages.length === 1 (§1.6).
}
export interface AgentHandoffArtifact {
  fromRoleId: string;
  summary: string;
  sourcedFacts: Array<{ fact: string; sourceId: string }>;
  openQuestions: string[];
  outputRefs: string[];
  completion: 'complete' | 'partial' | 'failed';
  // Hidden chain-of-thought is NEVER exchanged or logged (COLLAB-04).
}
export interface CollaborationOutcome {
  planId: string;
  status: 'completed' | 'partial' | 'failed' | 'aborted' | 'fallback-single-agent';
  reviewerRoleId?: string;
  reviewerDecision?: 'approved' | 'rejected';
  evidence: CompletionEvidence[];
  terminatedReason: string;
}

// ---- Typed stage events (L1, §1.6.1) ----
// A lightweight discriminated union for compile-time-checked stage I/O.
// This is a TYPE ONLY — NOT an event bus/emitter. The coordinator still calls
// stages directly in §18/§30 order; do not build a runtime event system.
export type StageEvent =
  | { kind: 'start';          userInput: string }
  | { kind: 'handoff';        artifact: AgentHandoffArtifact }        // stage → stage
  | { kind: 'input-required'; roleId: string; question: string;       // within-turn pause (L2)
      options?: string[]; reason: 'clarification' | 'permission' }
  | { kind: 'result';         outcome: CollaborationOutcome };
// input-required maps to the 'waiting-for-permission' / 'ask_clarification'
// trajectory states (AGT-01). It is WITHIN-TURN ONLY — no durable cross-session
// suspend/resume/rewind in v0.1 (§17.7.7).

// ---- Candidate Proposer (Phase 6b, §28.7a) ----
export const PROPOSE_MIN_FAILURES     = 3;       // PROP-03: agreeing failing trajectories
export const PROPOSE_MIN_SCORE_DELTA  = 0.15;    // PROP-03: rubric-score drop
export const PROPOSE_MAX_EVAL_TOKENS  = 50_000;  // PROP-04: sandbox cost cap

export interface ProposerInput {
  suiteVersion: string;                          // PROP-06 reproducibility
  failures: Array<{
    operationId: string;                         // links to AITransactionLog (PROP-01)
    failingLayer: FailureLayer;                  // from EVAL-04
    scoreDelta: number;                          // baseline − candidate rubric score
  }>;
}
export interface EvolutionCandidateProposal {
  targetLayer: EvolutionCandidate['targetLayer'];// PROP-02 single layer
  evidenceOperationIds: string[];
  suiteVersion: string;
  estEvalTokens: number;                         // PROP-04
  contentHash: string;                           // PROP-06 deterministic identity
  status: 'proposed' | 'deferred';               // 'deferred' when over cost cap; never 'approved' (PROP-05)
}
```

### Appendix C.2 — Error Code Registry

Canonical error codes — every `catch`/return path uses one of these verbatim (§0.3, `debugLog(code, …)`).

```text
# Runtime / provider
PROVIDER_CHECK_FAILED
HOST_NOT_PERMITTED
CONTEXT_TOO_LARGE
STRUCTURED_OUTPUT_FAILED
STREAM_FAILED
STREAM_INTERRUPTED
# Notes / filesystem sync / RAG
NOTE_SYNC_PERMISSION_REVOKED
NOTE_TAGGER_FAILED
RAG_NO_RESULTS
# RICH
RICH_SUGGESTION_TIMEOUT
# Agent harness (Phases 3a/4b/5b/6a/6b/8a)
AGENT_STATE_INVALID
TOOL_POSTCONDITION_FAILED
COMPLETION_EVIDENCE_MISSING
CONTEXT_INSTRUCTION_INJECTION_BLOCKED
MEMORY_CONFLICT
MEMORY_EXPIRED
TOOL_MANIFEST_INVALID
TOOL_IDEMPOTENCY_CONFLICT
EVALUATION_FAILED
EVOLUTION_CANDIDATE_REJECTED
# Multimodal (Phase 7a)
MULTIMODAL_MODEL_UNAVAILABLE
MULTIMODAL_INPUT_INVALID
MULTIMODAL_TRANSCRIPTION_FAILED
# Bounded multi-agent collaboration (Phase 6c, §30)
COLLAB_DISABLED
COLLAB_PLAN_INVALID
COLLAB_ROLE_UNKNOWN
COLLAB_ROLE_BUDGET_EXCEEDED
COLLAB_TOTAL_BUDGET_EXCEEDED
COLLAB_HANDOFF_INVALID
COLLAB_TOOL_SCOPE_VIOLATION
COLLAB_PERMISSION_VIOLATION
COLLAB_REVIEW_REJECTED
COLLAB_BASELINE_NOT_MET
COLLAB_DEADLINE_EXCEEDED
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
    { providerId: 'openai',            model: 'deepseek-chat' },
    { providerId: 'ollama',            model: 'llama3.2:3b' },
  ],
  flash: [
    { providerId: 'gemini',            model: 'gemini-2.5-flash' },
    { providerId: 'anthropic',         model: 'claude-haiku-4-latest' },
    { providerId: 'openai',            model: 'deepseek-chat' },
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
  // privacyMode handling (all three values are honored):
  //   'local-only'   → only ollama candidates are eligible.
  //   'prefer-local' → all candidates eligible, but ollama is reordered to the front.
  //   'cloud-ok'     → candidate order unchanged.
  let candidates = TIER_TO_MODEL_CANDIDATES[input.tier].filter(c =>
    input.privacyMode === 'local-only' ? c.providerId === 'ollama' : true,
  );
  if (input.privacyMode === 'prefer-local') {
    candidates = [
      ...candidates.filter(c => c.providerId === 'ollama'),
      ...candidates.filter(c => c.providerId !== 'ollama'),
    ];
  }
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
- **Note:** NoteTagger and NoteChatConverter resolve the `haiku` tier; NoteQA resolves the `flash` tier (§27, D-07).

> **⚠️ Model-ID verification (rev 2026-08-12).** The model slugs in `TIER_TO_MODEL_CANDIDATES` (`claude-haiku-4-latest`, `gemini-2.5-flash`, `deepseek-chat`, `llama3.2:3b`, `qwen2.5:7b`) are **point-in-time**. Because the resolver "never invents a model name," a stale slug resolves to `null` and the caller falls back or errors. **Phase 3 implementers MUST verify each slug against the provider's current model list before wiring**, and update this table (not the calling code) if a provider has renamed a model. In particular, "DeepSeek Flash / V4" is reached via the `openai`-compatible provider using the `deepseek-chat` slug against DeepSeek's baseURL — confirm the exact current DeepSeek model id at build time. This table is the **single source of truth** for tier→model mapping; no other file hard-codes model names.

## Appendix E — MessageType Registry and Port Protocol

```ts
// src/core/runtime/MessageType.ts
export const MessageType = {
  PROXY_FETCH:          'PROXY_FETCH',
  EXTRACT_PAGE_CONTENT: 'EXTRACT_PAGE_CONTENT',
  OPEN_SIDE_PANEL:      'OPEN_SIDE_PANEL',
  OPEN_STANDALONE:        'OPEN_STANDALONE',           //
  SESSION_TOKEN_UPDATE: 'SESSION_TOKEN_UPDATE',
  BACKGROUND_STATE:     'BACKGROUND_STATE',
  KEEPALIVE_PING:       'KEEPALIVE_PING',
  PORT_STREAM_START:    'PORT_STREAM_START',
  PORT_STREAM_CHUNK:    'PORT_STREAM_CHUNK',
  PORT_STREAM_END:      'PORT_STREAM_END',
  PORT_STREAM_ABORT:    'PORT_STREAM_ABORT',
  ADDON_EVENT:          'ADDON_EVENT',
  WORKSPACE_HANDOFF:    'WORKSPACE_HANDOFF',       //
  WORKSPACE_UPDATED:    'WORKSPACE_UPDATED',       //
  WORKSPACE_HEARTBEAT:  'WORKSPACE_HEARTBEAT',     //
} as const;
export type MessageTypeValue = typeof MessageType[keyof typeof MessageType];
export const MessageTypeValues = Object.values(MessageType) as MessageTypeValue[];
```

> **Note:** LLM-Wiki filesystem sync (§27) is **Standalone-local** — it does not add any new cross-context message type. Note capture reuses `EXTRACT_PAGE_CONTENT`. Persona is read locally from PreferenceMemoryStore; no new message type.

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
export type ThemePack = 'default' | 'liquid-glass' | 'claude-warm';   // §17.1a APPR-06
export interface ThemeState {
  mode: ThemeMode;
  pack: ThemePack;                 // theme pack (np_theme_pack)
  effectiveDark: boolean;
  setMode(mode: ThemeMode): void;
  setPack(pack: ThemePack): void;
  recomputeAuto(): void;
}
function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
// Persisted to chrome.storage.sync (np_theme + np_theme_pack) via a chrome.storage
// adapter so BOTH surfaces stay in sync through chrome.storage.onChanged (§17.1a APPR).
export const useThemeStore = create<ThemeState>()(persist(
  (set, get) => ({
    mode: 'auto',
    pack: 'default',
    effectiveDark: resolveDark('auto'),
    setMode: (mode) => set({ mode, effectiveDark: resolveDark(mode) }),
    setPack: (pack) => set({ pack }),
    recomputeAuto: () => {
      if (get().mode === 'auto') set({ effectiveDark: resolveDark('auto') });
    },
  }),
  { name: 'np_theme' }   // key group; mode → np_theme, pack → np_theme_pack
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
export type ThemePack = 'default' | 'liquid-glass' | 'claude-warm';
export interface AntdConfigOptions {
  mode: 'light' | 'dark' | 'auto';
  pack: ThemePack;              // §17.1a APPR-06 — user-facing theme pack (np_theme_pack)
  compact: boolean;
}
// Pack token overlays merged on top of the seed tokens. Visual definitions live
// in DESIGN_SYSTEM.md §6.4; the spec owns only the token wiring.
const PACK_TOKEN_OVERLAY: Record<ThemePack, Record<string, unknown>> = {
  'default':      {},
  'liquid-glass': { colorBgContainer: 'rgba(255,255,255,0.68)' }, // + backdrop-filter via CSS layer; solid fallback required
  'claude-warm':  { colorBgBase: '#FAF7F2' },
};
export function getAntdConfig(opts: AntdConfigOptions): ConfigProviderProps {
  const isDark = opts.mode === 'dark'
    || (opts.mode === 'auto' && typeof window !== 'undefined'
        && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const algorithm = [
    isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    ...(opts.compact ? [theme.compactAlgorithm] : []),
  ];
  const packToken = PACK_TOKEN_OVERLAY[opts.pack] ?? {};
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
        ...packToken,                         // §17.1a APPR-06 pack overlay (last-wins)
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
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';
function Root() {
  const { mode, pack } = useThemeStore(s => ({ mode: s.mode, pack: s.pack }));
  const cfg = getAntdConfig({ mode, pack, compact: true });   // returns ConfigProviderProps (theme + locale)
  return (
    <XProvider {...cfg}>                                 {/* XProvider ⊃ ConfigProvider — mount ONE provider */}
      <AntdApp>
        <SidePanelShell />
      </AntdApp>
    </XProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
```

```ts
// src/entrypoints/standalone/main.tsx
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { StandaloneShell } from '@/components/standalone/StandaloneShell';
function Root() {
  const { mode, pack } = useThemeStore(s => ({ mode: s.mode, pack: s.pack }));
  const cfg = getAntdConfig({ mode, pack, compact: false });  // returns ConfigProviderProps (theme + locale)
  return (
    <XProvider {...cfg}>                                 {/* XProvider ⊃ ConfigProvider — mount ONE provider */}
      <AntdApp>
        <StandaloneShell />
      </AntdApp>
    </XProvider>
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
    description: 'AI-native Chrome Side Panel + Standalone view assistant',
    permissions: [
      'sidePanel','storage','cookies','alarms','tabs',
      'scripting','contextMenus','notifications',
    ],
    optional_permissions: ['webNavigation'],
    host_permissions: [
      '*://*.service-now.com/*',
      '*://support.servicenow.com/*',
    ],
    optional_host_permissions: ['*://*/*'],   // webhooks + user MCP hosts, granted on demand
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
            if (id.includes('node_modules/defuddle')) return 'defuddle'; — keep out of content bundle
            // Defuddle/full math deps (rev 2026-08-12) — also keep out of content bundle:
            if (id.includes('node_modules/mathml-to-latex')) return 'defuddle';
            if (id.includes('node_modules/temml')) return 'defuddle';
            if (id.includes('node_modules/turndown')) return 'defuddle';
            if (id.includes('node_modules/yaml')) return 'yaml'; — keep out of content bundle
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
- The content-script bundle MUST NOT include antd, @ant-design/x, @ant-design/x-markdown, react, react-dom, **defuddle, or yaml** — **and (rev 2026-08-12) not `defuddle/full`'s math deps `mathml-to-latex`, `temml`, or `turndown`**. Enforced by tests/isolation/no-content-script-ui.test.ts.

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
- **Note:** when the reasonCode is `ask_clarification`, the UI layer renders RICH-C-01 clarification chips (§17.7); the follow-up chips (RICH-C-05) are produced by a separate non-blocking suggestion call, never inside this loop.

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
- **Note:** the persona block sits in the stable `[SYSTEM]` section and is therefore cache-eligible; keep it byte-stable per persona (§1.3).

## Appendix L — Structured Output Repair Loop

> **Implementer note (rev 2026-08-12):** v0.1 uses `zod-to-json-schema` exactly as shown below. Do **not** substitute Zod 4's native `z.toJSONSchema()` — that swap is a deferred v0.2 cleanup (§7.4). Implement this file verbatim.

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
- **Note:** NoteTagResultSchema, NoteQAResultSchema, NoteDraftSchema (Appendix C) and the RICH `clarify`/`followUpSuggest` outputs all use this loop.

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

### M.2 WorkspaceRouter — Open Standalone view

```ts
// src/core/workspace/WorkspaceRouter.ts
import { useWorkspaceStore } from './WorkspaceStore';
export const WorkspaceRouter = {
  async openStandalone(opts?: { page?: string }): Promise<void> {
    const store = useWorkspaceStore.getState();
    await store.persist();
    const state = store.state;
    const url = new URL(chrome.runtime.getURL('standalone.html'));
    url.searchParams.set('workspaceId', state.workspaceId);
    url.searchParams.set('conversationId', state.conversationId);
    if (opts?.page) url.searchParams.set('page', opts.page);
    const existing = await chrome.tabs.query({ url: chrome.runtime.getURL('standalone.html') + '*' });
    const currentWindow = await chrome.windows.getCurrent();
    const inCurrent = existing.find(t => t.windowId === currentWindow.id);
    if (inCurrent && inCurrent.id !== undefined) {
      await chrome.tabs.update(inCurrent.id, { active: true, url: url.toString() });
      store.setState({ openedStandaloneTabId: inCurrent.id });
    } else {
      const created = await chrome.tabs.create({ url: url.toString() });
      if (created.id !== undefined) store.setState({ openedStandaloneTabId: created.id });
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
export function startWorkspaceSync(surface: 'sidepanel' | 'standalone') {
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
- WorkspaceRouter.openStandalone is idempotent by tab dedupe.
- On Standalone view mount, always call hydrateFromURL() before rendering routes.

## Appendix N — Persona & Intent Reference Implementations

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

---

## Appendix O — Worked Reference Implementations for Cost-Effective Models

Concrete, copy-pasteable references for the harness sub-phases and the coordinator platform. These are **canonical**: a Haiku/Flash/DeepSeek implementer should adapt them rather than invent new shapes. Every example uses only the types in Appendix C.1, the tiers in Appendix D, and the prompts in Appendix A. Each block is self-contained — no missing detail must be inferred.

#### How to use these examples

1. **Find your phase in the map below**, open that example, and adapt it — do not rewrite from scratch.
2. **Keep the imports as written.** All harness/collaboration types come from `@/types/harness` (§C.1). If your editor cannot resolve an import, you have the wrong path (risk R-1), not a missing type.
3. **Do not add behaviour the example omits.** These are minimal on purpose. Extra retries, extra LLM calls, or extra state are how cheap models blow the budget.
4. **Wire the verifier/tests named in the phase block** (§18) before moving on.

**Phase → worked-example map (which code to open for each phase):**

| Phase | Worked example(s) | Also see |
|---|---|---|
| 1 — Runtime/Shells/Workspace | — | Appendix E, F, G, M |
| 2 — Storage/Security/WriteJournal | **O.11** WriteJournal recover/replay | §15, §20.3 |
| 3 — AI Runtime (+Persona) | Appendix I `runAgentTurn` | Appendix D, K, L, N |
| 3a — Reliability & Evidence | **O.2** OutcomeVerifier | §28.2 |
| 4 — Context-Adaptive | — (contract in §2.3) | §2.4 |
| 4a — PageContentService | **O.12** layered extraction fallback | §26 |
| 4b — Trust-Aware Context | **O.3** trust policy | §28.3 |
| 5 — Knowledge Base | **O.10** working-memory updater | §3.4, §3.6 |
| 5b — Memory Governance | **O.4** conflict resolver | §28.4 |
| 6 — Logging & Diagnostics | **O.13** AITransactionLog + TraceRedactor | §4 |
| 6a — Evaluation | **O.7** golden fixture + rubric | §28.6 |
| 6b — Verified Evolution | **O.9** CandidateProposer | §28.7a |
| 6c — Collaboration | **O.1** coordinator · **O.8** role registry | §30 |
| 7a — Multimodal | **O.6** modality adapter | §29 |
| 8a — Tool Governance | **O.5** manifest+verifier · §14.5 approval | §28.5 |

**Common pitfalls (do NOT do these):** build an event bus for `StageEvent` (it is a type only, §1.6.1); call a provider from a React component (use the pipeline, §2.3); nest retries (R-2); parse JSON by hand (use Appendix L); mark a write done without evidence (O.2); persist raw bodies (use TraceRedactor, O.13).

### O.1 CollaborationCoordinator — single-agent default (one-role plan)

The default path is a **one-role plan** whose engine is `runAgentTurn` (Appendix I). Multi-role plans reuse the exact same worker call per stage. There is no second runtime.

```ts
// src/core/collaboration/CollaborationCoordinator.ts
import { runAgentTurn } from '@/core/ai/AgentOrchestrator';
import type { OptimizedContext } from '@/core/context/ContextOptimizer';
import type {
  CollaborationPlan, CollaborationRole, RolePolicy,
  AgentHandoffArtifact, CollaborationOutcome, CompletionEvidence,
} from '@/types/harness';        // canonical home (Appendix C.1)
import { CollaborationRoleRegistry } from './CollaborationRoleRegistry';
import { debugLog } from '@/core/log/debugLog';

export interface CoordinatorInput {
  operationId: string;
  plan: CollaborationPlan;
  userInput: string;
  baseContext: OptimizedContext;   // one OptimizedContext, projected per role (COLLAB-09)
  abortSignal: AbortSignal;
}

// The single-agent DEFAULT is literally this constant (§1.6, §30.1).
export const DEFAULT_SINGLE_AGENT_PLAN: CollaborationPlan = {
  id: 'default-single-agent',
  stages: [{ roleId: 'assistant', dependsOn: [] }],
  totalPlannerCap: 3, totalToolCap: 2, totalTokenCap: 8_000, deadlineMs: 30_000,
};

export async function runCollaboration(input: CoordinatorInput): Promise<CollaborationOutcome> {
  const { plan, operationId } = input;
  const handoffs: AgentHandoffArtifact[] = [];
  const evidence: CompletionEvidence[] = [];
  const deadline = Date.now() + plan.deadlineMs;
  let plannerBudget = plan.totalPlannerCap;
  let toolBudget = plan.totalToolCap;

  for (const stage of plan.stages) {                       // COLLAB-03 staged, dependency order
    if (input.abortSignal.aborted) return terminate('aborted', 'aborted');
    if (Date.now() > deadline) return terminate('failed', 'COLLAB_DEADLINE_EXCEEDED');

    const role = CollaborationRoleRegistry.get(stage.roleId); // COLLAB-02 closed registry
    if (!role) return terminate('failed', 'COLLAB_ROLE_UNKNOWN');
    const policy = CollaborationRoleRegistry.policyOf(role.id);

    // Project the shared context down to what this role may see (COLLAB-09).
    const roleContext = projectContext(input.baseContext, role);
    // Only ONE coordinator ever owns caps/permissions/commits (COLLAB-05).
    const turn = await runAgentTurn({
      operationId: `${operationId}:${role.id}`,
      userInput: composeRoleInput(input.userInput, handoffs, role),
      context: roleContext,
      abortSignal: input.abortSignal,
      tier: {
        plannerCap: Math.min(policy.plannerCap, plannerBudget),
        toolCap: role.toolAllowlist.length ? Math.min(policy.toolCap, toolBudget) : 0,
        mcpChaining: false,
      },
    });

    plannerBudget -= turn.toolResults.length ? 1 : 1;
    toolBudget -= turn.toolResults.length;
    if (plannerBudget < 0) return terminate('partial', 'COLLAB_TOTAL_BUDGET_EXCEEDED');

    handoffs.push(toHandoff(role, turn));                   // COLLAB-04 typed handoff, no CoT
    evidence.push(...turn.toolResults
      .map(r => (r as any).evidence).filter(Boolean) as CompletionEvidence[]);
  }

  // Independent review only for multi-role, high-impact output (COLLAB-07).
  const reviewer = plan.stages.length > 1
    ? CollaborationRoleRegistry.reviewerFor(plan) : undefined;
  const reviewerDecision = reviewer
    ? review(reviewer, handoffs, evidence) : undefined;
  if (reviewer && reviewerDecision !== 'approved')
    return terminate('failed', 'COLLAB_REVIEW_REJECTED', reviewer.id, reviewerDecision);

  return { planId: plan.id, status: 'completed',
    reviewerRoleId: reviewer?.id, reviewerDecision,
    evidence, terminatedReason: 'ok' };

  function terminate(status: CollaborationOutcome['status'], reason: string,
                     reviewerRoleId?: string, reviewerDecision?: 'approved'|'rejected') {
    debugLog(reason, 'collaboration terminated', { planId: plan.id, status });
    return { planId: plan.id, status, reviewerRoleId, reviewerDecision,
      evidence, terminatedReason: reason };
  }
}

// --- helpers (pure, deterministic) ---
function projectContext(ctx: OptimizedContext, role: CollaborationRole): OptimizedContext {
  return { ...ctx, sections: ctx.sections.filter(s => role.contextProjection.includes(s.kind)) };
}
function composeRoleInput(userInput: string, prior: AgentHandoffArtifact[], role: CollaborationRole) {
  if (prior.length === 0) return userInput;               // one-role default: just the user input
  const facts = prior.flatMap(h => h.sourcedFacts).map(f => `- ${f.fact} [${f.sourceId}]`).join('\n');
  return `Task: ${userInput}\n\nVerified facts so far:\n${facts}\n\nYour role: ${role.label}.`;
}
function toHandoff(role: CollaborationRole, turn: { streamedText: string; toolResults: unknown[] }): AgentHandoffArtifact {
  return { fromRoleId: role.id, summary: turn.streamedText.slice(0, 600),
    sourcedFacts: [], openQuestions: [], outputRefs: [], completion: 'complete' };
}
function review(_r: CollaborationRole, _h: AgentHandoffArtifact[], ev: CompletionEvidence[]) {
  return ev.every(e => e.ok) ? 'approved' as const : 'rejected' as const; // no claim without evidence
}
```

**Why this matters for cheap models:** ordinary chat calls `runCollaboration({ plan: DEFAULT_SINGLE_AGENT_PLAN, … })`. The implementer writes **one** coordinator; "multi-agent" is just a plan with more stages — no new architecture, no agent-to-agent chat.

### O.2 OutcomeVerifier + CompletionEvidence (Phase 3a)

No side effect may be reported as success without matching evidence (AGT-02).

```ts
// src/core/ai/OutcomeVerifier.ts
import type { CompletionEvidence, AgentTurnOutcome } from '@/types/harness';
import type { ToolExecutionResult } from './types';

export interface Verifier {
  postconditionId: string;
  verify(result: ToolExecutionResult<unknown>): Promise<{ ok: boolean; detail?: string }>;
}

export async function buildOutcome(
  operationId: string,
  results: ToolExecutionResult<unknown>[],
  verifiers: Record<string, Verifier>,   // keyed by toolName
  caps: { plannerCalls: number; toolCalls: number; capHit: boolean },
): Promise<AgentTurnOutcome> {
  const evidence: CompletionEvidence[] = [];
  for (const r of results) {
    const v = verifiers[r.toolName];
    if (!v) continue;                     // read-only tool: no postcondition required
    const outcome = await v.verify(r);
    evidence.push({ toolName: r.toolName, operationId, postconditionId: v.postconditionId,
      ok: outcome.ok, verifiedAt: Date.now(), detail: outcome.detail });
  }
  const sideEffectFailed = evidence.some(e => !e.ok);
  const status: AgentTurnOutcome['status'] =
    caps.capHit ? 'partial' : sideEffectFailed ? 'failed' : 'completed'; // AGT-03: cap = partial
  return { operationId, status,
    reasonCode: caps.capHit ? 'cap_exhausted' : sideEffectFailed ? 'postcondition_failed' : 'ok',
    evidence, plannerCalls: caps.plannerCalls, toolCalls: caps.toolCalls };
}
```

### O.3 Trust-aware context — stripping instruction authority (Phase 4b)

Retrieved/untrusted content is data, never instructions (CTX-02).

```ts
// src/core/context/TrustPolicy.ts
import type { ContextItem, TrustLevel } from '@/types/harness';

const AUTHORITY_BY_TRUST: Record<TrustLevel, boolean> = {
  system: true, user: true, tool: false, retrieved: false, untrusted: false,
};

/** Enforce CTX-02: only system/user may carry instruction authority. */
export function applyTrustPolicy(items: ContextItem[]): ContextItem[] {
  return items.map(it => {
    const allowed = AUTHORITY_BY_TRUST[it.trust];
    if (it.instructionAuthority && !allowed) {
      // Wrap so the model treats it as quoted DATA, not a directive.
      return { ...it, instructionAuthority: false,
        text: `<untrusted_data source="${it.sourceId}">\n${it.text}\n</untrusted_data>` };
    }
    return it;
  });
}
// Blocked-injection error to raise when a retrieved item tries to redefine policy:
//   throw Object.assign(new Error('blocked'), { code: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED' });
```

### O.4 MemoryRecord conflict resolver (Phase 5b)

Deterministic precedence: correction > verified current > prior explicit > inference (MEM-03).

```ts
// src/core/memory/ConflictResolver.ts
import type { MemoryRecord } from '@/types/harness';

const RANK: Record<MemoryRecord['source'], number> =
  { correction: 3, system: 2, explicit: 1, inferred: 0 };

/** Returns the winning record for a set of conflicting memories about the same key. */
export function resolveConflict(a: MemoryRecord, b: MemoryRecord): MemoryRecord {
  if (RANK[a.source] !== RANK[b.source]) return RANK[a.source] > RANK[b.source] ? a : b;
  // Same source rank → prefer verified, then most recent, then higher confidence.
  const av = a.verifiedAt ?? 0, bv = b.verifiedAt ?? 0;
  if (av !== bv) return av > bv ? a : b;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return a.confidence >= b.confidence ? a : b;
}
```

### O.5 ToolCapabilityManifest instance + verifier + idempotency (Phase 8a)

A concrete write tool with a manifest, postcondition verifier, and replay-safe key.

```ts
// src/addons/servicenow/tools/addWorkNote.ts
import type { ToolCapabilityManifest } from '@/types/harness';

export const addWorkNoteManifest: ToolCapabilityManifest = {
  toolName: 'servicenow.addWorkNote',
  category: 'servicenow-write',
  risk: 'high', sideEffect: true,
  requiredPermissions: ['servicenow:write'],
  scopes: ['case:comment'],
  timeoutMs: 15_000, estCostTokens: 0, idempotent: true,   // TOL-05
  verifierId: 'servicenow.workNotePresent',                // TOL-03
  inputSchemaHash: 'sha256-…', outputSchemaHash: 'sha256-…',
};

// Idempotency key: same case + same body ⇒ one write, safe on replay (TOL-05).
export const workNoteIdempotencyKey = (i: { caseId: string; body: string }) =>
  `swn:${i.caseId}:${hash(i.body)}`;

// Postcondition verifier consumed by O.2 buildOutcome:
export const workNoteVerifier = {
  postconditionId: 'servicenow.workNotePresent',
  async verify(result: { output?: { sysId?: string } }) {
    return result.output?.sysId
      ? { ok: true, detail: `note ${result.output.sysId}` }
      : { ok: false, detail: 'no sysId returned' };        // → TOOL_POSTCONDITION_FAILED
  },
};
function hash(s: string) { let h = 2166136261; for (let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=(h*16777619)>>>0;} return h.toString(16); }
```

### O.6 ModalityInput → ModalityObservation adapter (Phase 7a)

Binary never enters prompts; only the extracted observation does (MM-01/02).

```ts
// src/core/multimodal/ModalityAdapter.ts
import type { ModalityInput, ModalityObservation } from '@/types/harness';
import { resolveTier } from '@/core/ai/TierResolver';
import { TraceRedactor } from '@/core/telemetry/TraceRedactor';

export async function toObservation(
  input: ModalityInput,
  callVision: (ref: string, model: string) => Promise<string>,
  cfg: Parameters<typeof resolveTier>[0],
): Promise<ModalityObservation> {
  if (input.modality === 'text')
    return { sourceId: input.id, modality: 'text', extractedText: '', confidence: 1,
             sensitivity: 'none', createdAt: Date.now() };
  const tier = resolveTier({ ...cfg, tier: 'flash' });     // vision-capable flash tier
  if (!tier) throw Object.assign(new Error('no vision model'),
    { code: 'MULTIMODAL_MODEL_UNAVAILABLE' });             // settings action
  const raw = await callVision(input.ref, tier.model);     // ref only — never inline bytes
  return { sourceId: input.id, modality: input.modality,
    extractedText: TraceRedactor.redact(raw),              // redact before it becomes context
    confidence: 0.8, sensitivity: 'low', createdAt: Date.now() };
}
```

### O.7 Golden eval fixture + rubric scoring (Phase 6a)

Deterministic validators first; judges only for qualitative dimensions (EVAL-03).

```ts
// tests/evals/planner/summarizeCase.golden.ts
import type { FailureLayer } from '@/types/harness';

export const goldenCase = {
  id: 'planner-summarize-case-01',
  input: { userInput: 'Summarize this case', pageKind: 'servicenow-incident' },
  expect: {
    action: 'run_tool', toolName: 'servicenow.getCase',   // deterministic outcome check
    maxPlannerCalls: 2, mustCite: true,
  },
};

export function scoreTrajectory(actual: {
  action: string; toolName?: string; plannerCalls: number; citations: number;
}): { pass: boolean; failingLayer?: FailureLayer; dims: Record<string, number> } {
  const dims = {
    outcome: actual.toolName === goldenCase.expect.toolName ? 1 : 0,
    process: actual.plannerCalls <= goldenCase.expect.maxPlannerCalls ? 1 : 0,
    grounding: actual.citations > 0 ? 1 : 0,
  };
  const failingLayer: FailureLayer | undefined =
    dims.outcome === 0 ? 'planning' : dims.grounding === 0 ? 'retrieval' : undefined; // EVAL-04
  return { pass: Object.values(dims).every(v => v === 1), failingLayer, dims };
}
```

### O.8 Registering the default assistant role

The single-agent default is one entry in the closed registry — nothing more.

```ts
// src/core/collaboration/CollaborationRoleRegistry.ts (excerpt)
import type { CollaborationRole, RolePolicy } from '@/types/harness';        // canonical home (Appendix C.1)

const ASSISTANT: CollaborationRole = {
  id: 'assistant', label: 'Assistant', systemPromptId: 'renderer',
  toolAllowlist: ['*'],                                    // gated again by ExecutorService + manifest
  contextProjection: ['system','tool_schemas','preferences','memory','context','task','user_input'],
};
const ASSISTANT_POLICY: RolePolicy = {
  roleId: 'assistant', plannerCap: 3, toolCap: 2, tokenCap: 8_000, timeoutMs: 30_000, canReview: false,
};

const ROLES = new Map<string, CollaborationRole>([[ASSISTANT.id, ASSISTANT]]);
const POLICIES = new Map<string, RolePolicy>([[ASSISTANT.id, ASSISTANT_POLICY]]);

export const CollaborationRoleRegistry = {
  get: (id: string) => ROLES.get(id) ?? null,             // unknown → COLLAB_ROLE_UNKNOWN
  policyOf: (id: string) => POLICIES.get(id)!,
  reviewerFor: (_plan: unknown) => [...ROLES.values()].find(r => POLICIES.get(r.id)?.canReview),
  register(role: CollaborationRole, policy: RolePolicy) { ROLES.set(role.id, role); POLICIES.set(role.id, policy); },
};
```

---

### O.9 CandidateProposer — evaluation failure → gated candidate (Phase 6b)

Deterministic: same failing evals ⇒ same proposal. It **only proposes** (PROP-05); activation stays human-gated (EVO-05).

```ts
// src/core/evolution/CandidateProposer.ts
import {
  PROPOSE_MIN_FAILURES, PROPOSE_MIN_SCORE_DELTA, PROPOSE_MAX_EVAL_TOKENS,
  type ProposerInput, type EvolutionCandidateProposal, type FailureLayer,
} from '@/types/harness';

// PROP-02: deterministic FailureLayer → candidate targetLayer.
const LAYER_MAP: Record<FailureLayer, EvolutionCandidateProposal['targetLayer']> = {
  knowledge: 'knowledge', retrieval: 'retrieval', context: 'instruction',
  planning: 'instruction', tool: 'tool', permission: 'tool',
  memory: 'experience', rendering: 'instruction', safety: 'instruction',
};

/** Pure function: eval failures in → zero or more single-layer proposals out. */
export function proposeCandidates(input: ProposerInput): EvolutionCandidateProposal[] {
  // PROP-03: group by failing layer, keep only layers with enough agreeing evidence.
  const byLayer = new Map<FailureLayer, ProposerInput['failures']>();
  for (const f of input.failures) {
    (byLayer.get(f.failingLayer) ?? byLayer.set(f.failingLayer, []).get(f.failingLayer)!).push(f);
  }
  const out: EvolutionCandidateProposal[] = [];
  for (const [layer, fs] of byLayer) {
    const avgDelta = fs.reduce((s, f) => s + f.scoreDelta, 0) / fs.length;
    if (fs.length < PROPOSE_MIN_FAILURES) continue;          // not enough evidence
    if (avgDelta < PROPOSE_MIN_SCORE_DELTA) continue;        // drop too small
    const ids = fs.map(f => f.operationId).sort();
    const estEvalTokens = ids.length * 4_000;                // crude, deterministic estimate
    out.push({
      targetLayer: LAYER_MAP[layer],                         // PROP-02 single layer
      evidenceOperationIds: ids,
      suiteVersion: input.suiteVersion,                      // PROP-06
      estEvalTokens,
      contentHash: hash(`${layer}|${input.suiteVersion}|${ids.join(',')}`),
      // PROP-04 cost cap → 'deferred' (never run) instead of 'proposed'.
      status: estEvalTokens > PROPOSE_MAX_EVAL_TOKENS ? 'deferred' : 'proposed',
      // PROP-05: never 'approved' here — activation is human-gated (EVO-05).
    });
  }
  return out.sort((a, b) => a.contentHash.localeCompare(b.contentHash)); // stable order
}

function hash(s: string) {
  let h = 2166136261; for (let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=(h*16777619)>>>0;}
  return h.toString(16).padStart(8,'0');
}
```

**Why this is safe & cheap:** it reads only eval results + trace IDs (PROP-01), emits one single-layer, cost-capped, reproducible `proposed` (or `deferred`) candidate, and cannot touch production — the sandbox runner + human approval come later in Phase 6b (EVO-05).

### O.10 Working-memory updater (Phase 5, §3.6)

Budget-capped, single-writer, redacted. Slots into `UserMemoryStore`; not persona.

```ts
// src/core/memory/WorkingMemory.ts
import { WORKING_MEMORY_TEMPLATE, type WorkingMemory } from '@/types/harness';  // canonical home (Appendix C.1)
import { TraceRedactor } from '@/core/telemetry/TraceRedactor';

const MAX_WORKING_MEMORY_TOKENS = 300;   // §3.6: cap so it can't crowd out retrieval

export function initWorkingMemory(resourceId: string): WorkingMemory {
  return { resourceId, markdown: WORKING_MEMORY_TEMPLATE, tokens: estimate(WORKING_MEMORY_TEMPLATE), updatedAt: Date.now() };
}

/** Merge new profile facts into the Markdown block; redact + cap before persisting. */
export function updateWorkingMemory(cur: WorkingMemory, patch: Partial<Record<
  'Name' | 'Role / Team' | 'Environment' | 'Preferences' | 'Long-term Goals', string>>): WorkingMemory {
  let md = cur.markdown;
  for (const [field, value] of Object.entries(patch)) {
    if (!value) continue;
    const safe = TraceRedactor.redact(value);                        // §4.4 — never store secrets
    md = md.replace(new RegExp(`(- \\*\\*${field}\\*\\*:).*`), `$1 ${safe}`);
  }
  let tokens = estimate(md);
  if (tokens > MAX_WORKING_MEMORY_TOKENS) { md = truncateToTokens(md, MAX_WORKING_MEMORY_TOKENS); tokens = MAX_WORKING_MEMORY_TOKENS; }
  return { ...cur, markdown: md, tokens, updatedAt: Date.now() };     // single-writer: primary surface only (§13)
}

const estimate = (s: string) => Math.ceil(s.length / 4);
function truncateToTokens(s: string, cap: number) { return s.slice(0, cap * 4); }
```

### O.11 WriteJournal — crash-safe multi-store write + replay (Phase 2)

Notes/memory span two stores (metadata in `chrome.storage.local`, body in IndexedDB). The journal makes a multi-store write **atomic-on-recovery**: on startup, any `pending`/`applying` entry is replayed or rolled back. Idempotent steps make replay safe (§20.3).

```ts
// src/core/storage/WriteJournal.ts
import type { WriteJournalEntry } from '@/types/storage';   // Appendix C
import { debugLog } from '@/core/log/debugLog';

export interface JournalStep {
  name: string;
  apply(): Promise<void>;      // MUST be idempotent (safe to run twice on replay)
  rollback(): Promise<void>;
}

export async function runJournaled(
  entry: WriteJournalEntry,
  steps: JournalStep[],
  persist: (e: WriteJournalEntry) => Promise<void>,   // writes the journal entry itself
): Promise<void> {
  entry.status = 'applying'; entry.attempts++; await persist(entry);
  const done: JournalStep[] = [];
  try {
    for (const s of steps) {
      await s.apply();                                  // idempotent → replay-safe
      entry.steps.push({ name: s.name, status: 'completed' });
      done.push(s);
      await persist(entry);
    }
    entry.status = 'completed'; await persist(entry);
  } catch (e: any) {
    debugLog('WRITE_JOURNAL_FAILED', 'rolling back', { id: entry.id, step: done.at(-1)?.name });
    for (const s of done.reverse()) {
      try { await s.rollback(); } catch (r: any) { debugLog('WRITE_JOURNAL_ROLLBACK_FAILED', r?.message ?? 'rollback', { id: entry.id }); }
    }
    entry.status = 'rolled-back'; await persist(entry);
    throw e;
  }
}

/** On startup: finish or undo any entry left mid-flight (crash recovery). */
export async function recoverJournal(
  load: () => Promise<WriteJournalEntry[]>,
  replay: (e: WriteJournalEntry) => Promise<void>,
): Promise<void> {
  for (const e of await load()) {
    if (e.status === 'applying' || e.status === 'pending') await replay(e); // idempotent replay
  }
}
```

**Why:** covers the Phase 2 DONE-when "WriteJournal recovery test passes." Keep every `apply()` idempotent (e.g. upsert by id) so a replay after a crash is a no-op, not a duplicate.

### O.12 PageContentService — layered extraction with recorded fallback (Phase 4a)

The service tries strategies in order and **records which one produced the result** (§26). Heavy libs (Defuddle) run in the panel, never in the content bundle (isolation test).

```ts
// src/core/extraction/PageContentService.ts
import type { IExtractionStrategy, StrategyInput, StrategyResult } from './strategies/IExtractionStrategy'; // Appendix C
import { debugLog } from '@/core/log/debugLog';

export interface ExtractionOutcome {
  result: StrategyResult;
  sourceUsed: StrategyResult['source'];   // provenance — which layer won
  fallbacksTried: string[];
}

export async function extractLayered(
  input: StrategyInput,
  strategies: IExtractionStrategy[],      // ordered: Defuddle → Readability → APC-lite → ServiceNow API
): Promise<ExtractionOutcome> {
  const tried: string[] = [];
  for (const s of strategies) {
    if (!s.canHandle({ url: input.url, mode: input.mode })) continue;
    try {
      const result = await s.run(input);
      // Accept the first strategy that returns usable content.
      if ((result.markdown && result.markdown.length > 0) || result.root) {
        return { result, sourceUsed: result.source, fallbacksTried: tried };
      }
      tried.push(s.id);
    } catch (e: any) {
      tried.push(s.id);
      debugLog('EXTRACTION_STRATEGY_FAILED', e?.message ?? 'strategy error', { strategy: s.id, url: input.url });
    }
  }
  // Typed failure — never throw a bare error; caller shows a user-facing message.
  throw Object.assign(new Error('no strategy produced content'), { code: 'EXTRACTION_FAILED', fallbacksTried: tried });
}
```

**Guardrails:** the content-script bundle must contain **no** React/AntD/Defuddle/yaml (isolation test, §24). Content scripts only serialise HTML; `extractLayered` runs in the Side Panel/Standalone view. Passwords are never captured (`isPassword ⇒ value omitted`, §16).

### O.13 AITransactionLog + TraceRedactor — safe tracing (Phase 6)

Every AI/tool/provider op is traceable, but **nothing raw is persisted**. Redaction runs before *every* sink (persist, UI, console, export).

```ts
// src/core/telemetry/TraceRedactor.ts
const REDACTION_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]+/g, /key-[A-Za-z0-9_-]+/g, /Bearer\s+[A-Za-z0-9._-]+/gi,
  /JSESSIONID=[^;\s]+/gi, /sysparm_ck[=:]\s*[^&\s]+/gi, /g_ck[=:]\s*[^&\s]+/gi,
];
export const TraceRedactor = {
  redact(value: string): string {
    return REDACTION_PATTERNS.reduce((s, re) => s.replace(re, '[REDACTED]'), value);
  },
};

// src/core/telemetry/AITransactionLog.ts
import type { AITransaction } from '@/types/harness';   // (trace shapes live with harness types)
import { TraceRedactor } from './TraceRedactor';

export function startTx(base: Omit<AITransaction, 'status' | 'startedAt'>): AITransaction {
  return { ...base, status: 'started', startedAt: Date.now() };
}
/** Persist ONLY redacted metadata by default (raw bodies never stored — §4.2/§4.4). */
export async function completeTx(
  tx: AITransaction,
  write: (t: AITransaction) => Promise<void>,
  errorCode?: string,           // MUST be a code from Appendix C.2
): Promise<void> {
  tx.status = errorCode ? 'failed' : 'completed';
  tx.endedAt = Date.now();
  tx.durationMs = tx.endedAt - tx.startedAt;
  if (errorCode) tx.errorCode = errorCode;
  await write(tx);              // no prompt/body fields on this object by design
}
```

**Rule of thumb:** if you ever pass a prompt, tool input/output, cookie, clipboard text, or case body toward a log/UI/export, it goes through `TraceRedactor.redact()` first (risk R-10). Deep traces store **redacted previews only** and expire fast (§4.2).

**End of NowPilot Product Specification v0.1.**