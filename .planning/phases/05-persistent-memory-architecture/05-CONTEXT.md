# Phase 5: Persistent Memory Architecture - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the system-owned MemoryEngine orchestrating three memory layers: ConversationMemoryStore (per-conversation summaries + recent turns), UserMemoryStore (cross-session 5-factor scored facts), and PreferenceMemoryStore (behavioural settings as compact JSON). Memory is shared across surfaces with single-writer enforcement via BroadcastBus, and MemoryExtractor runs as a Haiku-tier call after each round-trip. Requirements: MEM-01 through MEM-07.
</domain>

<decisions>
## Implementation Decisions

### Pipeline Integration
- **D-01 — Two-Phase Lifecycle:** MemoryEngine participates in two lifecycle phases: pre-optimization (retrieval) and post-execution (extraction).
  - **Pre-optimization:** `MemoryEngine.assemble()` retrieves relevant facts, summaries, and preferences and feeds them into `ContextOptimizerInput` before `ContextOptimizer.optimize()`. MemoryEngine owns all retrieval, scoring, and injection logic — ContextOptimizer only budgets and distributes.
  - **Post-execution:** `MemoryEngine.extract()` runs after the renderer completes and the final response has been delivered. Extraction is async, fire-and-forget.
- **D-02 — Orchestrator as Trigger:** AgentOrchestrator triggers `MemoryEngine.extract()` after `runWithContext()` completes (after the final renderer output). The chat hook / UI layer does NOT trigger extraction — it's a pipeline lifecycle concern.
- **D-03 — Round-Trip Extraction:** Extraction runs after complete user-assistant round-trips (one user message → full agent response). Do NOT extract after every intermediate assistant message or agent step. Gives MemoryEngine richer context, reduces duplicate extraction, and avoids storing transient agent-loop details.
- **D-04 — Extraction Resilience:** If extraction fails, retry once in the background. If the retry fails, record the failure in diagnostics/telemetry and drop it. Extraction MUST NOT block the user-facing pipeline or delay the current response.
- **D-05 — Haiku-Tier Extraction:** MemoryExtractor uses a separate Haiku-tier AI call for fact extraction and summary generation.

### Single-Writer Enforcement
- **D-06 — True Single-Writer Architecture:** All memory mutations are routed through BroadcastBus to the current primary surface, which alone performs MemoryDB and WriteJournal writes. Secondary surfaces are read-only and submit write requests to the primary. Eliminates cross-surface write races.
- **D-07 — Direct Reads, Routed Writes:** All surfaces query MemoryDB directly for retrieval operations (reads are non-mutating and shareable). Only memory writes go through BroadcastBus to the primary surface. Preserves single-writer guarantee while keeping retrieval fast and low-latency.

### Preference Store
- **D-08 — AI-Only Preferences:** PreferenceMemoryStore owns only AI-specific behavioural preferences: `responseStyle`, `preferredLanguage`, `preferStructuredOutput`, `allowCloudFallbackFromLocal`, `defaultProviderId`, `toolAutonomy`.
- **D-09 — Read from Existing Stores:** `themeMode` reads from ThemeStore, `defaultSurface` reads from WorkspaceStore. PreferenceMemoryStore does NOT duplicate these. At assembly time, MemoryEngine reads from all relevant stores and combines into the preference injection payload.
- **D-10 — Preferences Always Injected:** UserPreferences are injected as compact JSON (not verbose prose) into every AI call regardless of tier.

### Memory Retrieval & Ranking
- **D-11 — Two-Pass Retrieval:** MiniSearch as initial filter narrowing to top-20 candidates, then 5-factor scoring ranks and picks the final top-N. MiniSearch relevance feeds into the `keywordScore` factor but does NOT replace the full scoring formula.
- **D-12 — 5-Factor Scoring:** `score = keywordScore(0.45) + tagScore(0.25) + recencyScore(0.15) + useCountScore(0.10) + confidenceScore(0.05)`. All sub-scores normalized to [0, 1].
- **D-13 — Deterministic Tie-Break:** `final score → confidence → recency → useCount → memoryId`. Always return a fixed top-N result — never expand beyond N for ties.
- **D-14 — Tier-Specific Injection:** tiny → top-3 facts; small/medium/large → top-5 facts. Maximum memory injection ≤ 1000 tokens total. ContextOptimizer can trim lower-ranked memories if budget is exceeded.

### Memory Conflict Resolution
- **D-15 — Versioned Fact Model:** Facts have states: `active` and `superseded`. Old facts are marked superseded, not deleted. Only active facts participate in retrieval.
- **D-16 — Evidence Threshold for Superseding:** A contradictory fact requires 2+ independent observations with higher cumulative confidence than the existing active fact before it can supersede. Prevents single noisy extractions from flipping facts.
- **D-17 — Cumulative Confidence:** Confidence accumulates across observations. The superseding fact's confidence must exceed the existing fact's confidence at the time of comparison.

### Conversation Summary Lifecycle
- **D-18 — Keep Tail, Drop Middle:** After summarization, retain: system message + first 2 raw messages + last 4 raw messages + one LLM-generated summary covering the middle. Optionally archive summarized raw messages for diagnostics/export but exclude from normal retrieval and injection.
- **D-19 — One Rolling Cumulative Summary:** Maintain a single cumulative summary per conversation. When summarization triggers, merge the existing summary with newly summarized messages into the active summary. Retrieval and context injection use only the latest active summary.
- **D-20 — Summarization Trigger:** Auto-summarise triggers after every 12 messages (MEM-06), handled by MemoryEngine during post-execution extraction.
- **D-21 — Tier-Based Recent Turns:** ConversationMemoryStore keeps last 2 turns for tiny, last 4 turns for small, last 6 turns for medium/large.
- **D-22 — LRU Eviction & Archiving:** Archive conversations after 30 minutes idle. Cap: 10 active conversations, 100 archived. When exceeded, evict oldest archived via LRU, then archive oldest active. Uses `WriteJournal.operation = 'evict-conversation'`.

### Memory Retention & Forgetting
- **D-23 — Soft Cap with Auto-Pruning:** Maximum 500 user facts. When cap is reached, lowest-ranked facts are pruned first. Ranking uses confidence, recency, use count, and retrieval frequency.
- **D-24 — Low-Confidence Eviction:** Facts with confidence < 0.3 that have not been used for 30+ days are automatically evicted regardless of cap status.

### the agent's Discretion
- MemoryEngine internal architecture — class+singleton, constructor DI for stores, following existing patterns (KeymapRegistry, ProviderRegistry, ContextOptimizer).
- MemoryExtractor Haiku-tier prompt design — planner to design a cost-effective extraction prompt.
- MiniSearch index configuration — field definitions, boosting, rebuild strategy.
- BroadcastBus message types for memory write requests — planner to define message contracts.
- Exact MemoryDB schema updates needed for versioned fact model and summary state fields.
- Extraction concurrency model — at most one extraction per surface at a time.
- `MemoryEngine.assemble()` return type — must fit into `ContextOptimizerInput.memory` and `.preferences` fields.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Scope
- `.planning/REQUIREMENTS.md` — MEM-01 through MEM-07. Full requirement traceability for all 7 Phase 5 requirements.
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria (7 items), dependency on Phase 4 (lines 184–198).

### Product Specification
- `.planning/PRODUCT_SPEC_v0_1.md` §3 — Full Persistent Memory Architecture specification:
  - §3.1 (lines 428–438): Memory principle — system-owned, three layers, cross-surface sharing
  - §3.2 (lines 440–449): Framework choice — Zustand + IndexedDB/idb + MiniSearch, no LangChain/embeddings
  - §3.3 (lines 451–473): ConversationMemory interface, tier-based turn counts, summarization rules
  - §3.4 (lines 475–512): UserMemoryFact interface, 5-factor scoring formula, injection rules
  - §3.5 (lines 514–529): UserPreferences interface, compact JSON injection
- `.planning/PRODUCT_SPEC_v0_1.md` §15.3 (lines 1785–1790): LRU eviction — conversation caps, idle archiving, compactor rules
- `.planning/PRODUCT_SPEC_v0_1.md` Phase 5 (lines 2143–2171): File layout, test requirements, DONE criteria

### Project Context
- `.planning/PROJECT.md` — Core constraints: no embedding-based search (bag-of-words + MiniSearch), `@ai-sdk/*` only, MV3 restrictions, package hygiene.
- `.planning/STATE.md` — Session continuity, phases 1-4 complete, current position at Phase 5.

### Prior Phase Decisions
- `.planning/phases/04-context-adaptive-execution/04-CONTEXT.md` — ContextOptimizer pipeline: `runWithContext()` signature, `ContextOptimizerInput` memory/preferences fields, `SessionProvenance` manifest. Critical for MemoryEngine integration.
- `.planning/phases/03-cost-effective-ai-runtime/03-CONTEXT.md` — AI runtime pipeline: `AgentOrchestrator.run()` and `runWithContext()`, Planner/Renderer separation, Haiku-tier model usage, ProviderRouter, tier caps.
- `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-CONTEXT.md` — Storage infrastructure: MemoryDB schema (memory_messages, memory_userFacts, memory_summaries stores), WriteJournal consistency, BroadcastBus sync, class+singleton export pattern, direct path imports.

### Existing Code Dependencies
- `src/core/storage/stores/MemoryDB.ts` — Current MemoryDB with `memory_messages`, `memory_userFacts`, `memory_summaries` stores. Phase 5 builds orchestration on top of these.
- `src/core/context/contextTypes.ts` — `ContextOptimizerInput.memory` and `.preferences` fields, `PromptSection` type for memory sections.
- `src/core/context/ContextOptimizer.ts` — Budget and degradation logic that processes memory sections.
- `src/core/ai/pipeline/AgentOrchestrator.ts` — `runWithContext()` — the primary integration point for MemoryEngine.
- `src/core/messaging/broadcastBus.ts` — `WORKSPACE_UPDATED` event, `onBroadcastMessage` handler. Phase 5 extends with memory write request message types.
- `src/core/stores/workspaceStore.ts` — `WorkspaceState` with `activeSurface`, `activeSkillRun`. PreferenceMemoryStore reads `defaultSurface` from here.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **MemoryDB** (`src/core/storage/stores/MemoryDB.ts`): Already provides `addMessage`, `getMessages`, `putUserFact`, `getAllUserFacts`, `putSummary`, `getSummary`. Phase 5 builds MemoryEngine, ConversationMemoryStore, UserMemoryStore, and PreferenceMemoryStore on top of these methods. Schema extensions (e.g., `status` field on facts, `state` field on summaries) may require migration.
- **AgentOrchestrator** (`src/core/ai/pipeline/AgentOrchestrator.ts`): `runWithContext()` at line 75 is the primary integration point. Phase 5 adds MemoryEngine injection before optimization and extraction after rendering. `executeRenderer` at line 217 completes before extraction triggers.
- **ContextOptimizerInput** (`src/core/context/contextTypes.ts`): Already has `memory?: Array<{ id, content, score }>` (line 81) and `preferences?: Record<string, unknown>` (line 82). MemoryEngine's `assemble()` must populate these fields.
- **ContextOptimizer** (`src/core/context/ContextOptimizer.ts`): Section distribution already reserves budget for `memory` (10-15% depending on tier, lines 18-58). Memory injection flows through existing budget and degradation pipeline.
- **BroadcastBus** (`src/core/messaging/broadcastBus.ts`): Existing `WORKSPACE_UPDATED` constant and `onBroadcastMessage()` handler pattern. Phase 5 extends with memory write request message types and routing.
- **WriteJournal** (`src/core/storage/WriteJournal.ts`): Multi-store consistency for memory writes. All primary-surface memory writes route through WriteJournal.
- **debugLog** (`src/core/utils/debugLog.ts`): All catch blocks must call debugLog (HARD-09).

### Established Patterns
- **Class + singleton export**: Registry classes (KeymapRegistry, ToolRegistry, ProviderRegistry) and services (ContextOptimizer) follow this pattern. MemoryEngine, ConversationMemoryStore, UserMemoryStore, PreferenceMemoryStore, and MemoryScorer all match.
- **Constructor dependency injection**: AgentOrchestrator injects PlannerService, ExecutorService, RendererService, ProviderRouter. ContextOptimizer injects TokenEstimator, ContextCompressor. MemoryEngine follows the same pattern — injects stores, scorer, extractor.
- **Direct path imports**: No barrel/index files. New memory modules in `src/core/memory/`.
- **Test patterns**: Vitest + jsdom, tests in `tests/core/memory/`. Use `vi.hoisted()` for mock variables. Class+singleton tests with module-level `let` pattern.
- **`np_` key prefix**: Chrome storage keys use this convention. New keys: `np_memory_write_queue` for BroadcastBus write request routing.

### Integration Points
- **AgentOrchestrator.runWithContext()** — Primary integration point. MemoryEngine.assemble() runs before ContextOptimizer.optimize(); MemoryEngine.extract() runs after renderer completes.
- **ContextOptimizerInput** — MemoryEngine populates `memory` and `preferences` fields before calling `contextOptimizer.optimize()`.
- **MemoryDB** — Phase 5 adds orchestration layer on top. Schema may need migration for versioned fact model (active/superseded states), conversation `status` field (active/archived), and summary `state` field.
- **BroadcastBus** — Phase 5 extends with memory write request messages routed to primary surface. Non-primary surfaces emit write requests; primary surface listens and executes.
- **Chat/Agent hooks (Phase 7)** — `useMemory` hook will consume MemoryEngine.assemble() for pre-optimization injection. Phase 5 provides the engine; hooks wire it in Phase 7.
</code_context>

<specifics>
## Specific Ideas

### MemoryEngine Flow (conceptual)
```
Pre-optimization (before every AI call):
  MemoryEngine.assemble(conversationId, userMessage, tier)
    → ConversationMemoryStore.get(conversationId) → summary + recent turns
    → UserMemoryStore.search(query, tier) → MiniSearch → 5-factor scoring → top-N facts
    → PreferenceMemoryStore.get() → compact JSON from ThemeStore + WorkspaceStore + own prefs
    → return { memory, conversationContext, preferences }
    → populate ContextOptimizerInput

Post-execution (after renderer completes):
  AgentOrchestrator triggers MemoryEngine.extract(conversationId, messages, toolResults)
    → MemoryExtractor extracts facts via Haiku call
    → Conflict resolver checks against existing facts
    → UserMemoryStore upserts (with versioned fact model)
    → Check summarization threshold (every 12 messages)
    → If threshold: summarize older messages, update ConversationMemoryStore
    → Check archiving threshold (30 min idle)
    → If idle: archive conversation
    → WriteJournal + MemoryDB writes (primary surface only)
    → Non-primary: send write requests via BroadcastBus
```

### Versioned Fact State Machine
```
New observation → pending (confidence < threshold)
  → 2+ observations with cumulative confidence > existing → active (supersedes old → superseded)
  → Low confidence + 30d unused → evicted
```

### Conversation States
```
active (≤ 10) → 30 min idle → archived (≤ 100) → LRU eviction → evicted
```

### File Layout (from PRODUCT_SPEC)
- `src/core/memory/MemoryEngine.ts` — Orchestration, scoring, summarization, injection
- `src/core/memory/ConversationMemoryStore.ts` — Per-conversation summary + recent turns
- `src/core/memory/UserMemoryStore.ts` — Cross-session fact storage with versioned model
- `src/core/memory/PreferenceMemoryStore.ts` — AI-behaviour prefs, reads theme/surface from existing stores
- `src/core/memory/MemoryScorer.ts` — 5-factor scoring + tie-break logic
- `src/core/memory/MemoryExtractor.ts` — Haiku-tier fact extraction prompt and pipeline
- `src/core/search/MiniSearchIndex.ts` — MiniSearch full-text index for memory retrieval
</specifics>

<deferred>
## Deferred Ideas

- **Archived raw messages** for diagnostics/export — keep summarized middle in a diagnostic store for debugging, but exclude from normal retrieval. Deferred to Phase 6 (Telemetry/Diagnostics) or Phase 9 (Hardening).
- **User-managed memory editing UI** — Options → Memory section with view/edit/delete of facts. Deferred to Phase 7 (Full UI).
- **Per-fact TTL configuration** — user-defined expiry per fact category. Out of scope for v0.1.
- **Memory import/export** — export user facts as part of data portability. Deferred to Phase 8 (Data Portability).

None beyond scope — all discussion stayed within phase boundaries.
</deferred>

---

*Phase: 5-Persistent Memory Architecture*
*Context gathered: 2026-07-13*
