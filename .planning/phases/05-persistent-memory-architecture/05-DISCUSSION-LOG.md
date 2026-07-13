# Phase 5: Persistent Memory Architecture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 5-persistent-memory-architecture
**Areas discussed:** Pipeline hook point, Extraction strategy, Single-writer pattern, Preference data source, Retrieval & Ranking, Conflict Resolution, Summary Lifecycle, Injection Budget, Retention/Forgetting

---

## Pipeline Hook Point

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-optimization: independent service | Caller assembles memory via MemoryEngine first, then passes into ContextOptimizerInput | |
| Post-optimization: called by ContextOptimizer | ContextOptimizer calls MemoryEngine during optimization | |
| Both: pre-opt for injection, post-opt for extraction | MemoryEngine participates in two lifecycle phases: retrieval before optimization and extraction after execution | ✓ |

**User's choice:** Both phases. Before the AI call, MemoryEngine retrieves relevant facts, summaries, and preferences and supplies them to ContextOptimizerInput. After the renderer finishes, MemoryEngine asynchronously extracts new facts, updates summaries, and persists memory. ContextOptimizer stays focused on budgeting and degradation.

| Option | Description | Selected |
|--------|-------------|----------|
| AgentOrchestrator triggers after renderer | Orchestrator calls extract() before yielding final event | |
| UI layer triggers after streaming ends | Chat hook calls extract() after stream completes | |
| AgentOrchestrator triggers, fire-and-forget | Orchestrator fires extract() async without awaiting, retry once on failure | ✓ |

**User's choice:** AgentOrchestrator triggers fire-and-forget. Extract runs async after renderer completes; never blocks the user. Retry once on failure; if retry fails, record in diagnostics and drop.

| Option | Description | Selected |
|--------|-------------|----------|
| Every round-trip | Run extract() after each complete user-assistant exchange | ✓ |
| Every assistant message | Run extract() after every individual assistant response | |

**User's choice:** Every round-trip. Only extract after the final renderer output is complete. Do not extract after intermediate agent steps — gives richer context, reduces duplicates, lowers cost.

---

## Single-Writer Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| MemoryEngine checks election state internally | Self-contained enforcement within MemoryEngine | |
| Caller checks before calling MemoryEngine | Responsibility on the caller side | |
| Memory writes always through BroadcastBus to primary | All mutations routed through primary surface via BroadcastBus | ✓ |

**User's choice:** True single-writer architecture. All memory mutations routed through BroadcastBus to primary surface. Secondary surfaces read-only, submit write requests to primary.

| Option | Description | Selected |
|--------|-------------|----------|
| Direct reads, routed writes | Secondary surfaces query MemoryDB directly | ✓ |
| Both reads and writes through primary | All memory access through primary for consistency | |

**User's choice:** Direct reads, routed writes. Reads are non-mutating and don't need coordination. Only writes go through primary.

---

## Preference Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Read from existing stores, own only AI-specific prefs | themeMode from ThemeStore, defaultSurface from WorkspaceStore. No duplication | ✓ |
| Own all preferences independently | PreferenceMemoryStore as single source for ALL prefs including theme/surface | |
| Duplicate — stores independent, PreferenceMemoryStore syncs | Each store owns its data, PreferenceMemoryStore reads at assembly time | |

**User's choice:** Read from existing stores. PreferenceMemoryStore owns only AI-behaviour prefs (responseStyle, toolAutonomy, etc.). themeMode from ThemeStore, defaultSurface from WorkspaceStore. MemoryEngine combines at assembly time.

---

## Retrieval & Ranking

| Option | Description | Selected |
|--------|-------------|----------|
| MiniSearch as initial filter, then score | Top-20 candidates from MiniSearch, then 5-factor scoring for top-N | ✓ |
| Score all facts first, no MiniSearch | Direct scoring without pre-filter | |
| MiniSearch score replaces keywordScore | MiniSearch relevance IS the keywordScore factor | |

**User's choice:** Two-pass retrieval. MiniSearch narrows to top-20, then 5-factor scoring ranks. MiniSearch relevance feeds into keywordScore but does not replace full formula.

| Option | Description | Selected |
|--------|-------------|----------|
| Recency breaks ties | Prefer more recently updated | |
| Confidence breaks ties | Higher confidence wins ties | |
| Deterministic chain (user-defined) | final score → confidence → recency → useCount → memoryId | ✓ |

**User's choice:** Deterministic tie-break chain. Confidence before recency (retrieval quality > freshness). Always return fixed top-N, never expand for ties.

---

## Injection Budget

| Option | Description | Selected |
|--------|-------------|----------|
| Stick with spec: tiny=3, all others=5 | Simple two-tier rule, ≤1000 tokens | ✓ |
| Graduated: tiny=2, small=3, medium=4, large=5 | Per-tier fact counts | |
| Context-window proportional | Adaptive based on context window size | |

**User's choice:** Stick with spec. tiny=3, all others=5, ≤1000 tokens. ContextOptimizer can trim lower-ranked memories if budget exceeded.

---

## Conflict Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned fact model | Active/superseded states, replace only with sufficient evidence | ✓ |
| Always replace, old becomes superseded | Latest always wins, old marked superseded | |
| Keep both, let scoring decide | Both coexist, scoring naturally favors fresher | |

**User's choice:** Versioned fact model. Facts have active/superseded states. 2+ independent observations with higher cumulative confidence needed to supersede. Old facts marked superseded, not deleted.

---

## Conversation Summary Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Keep tail, drop middle | System + first 2 + last 4 raw + LLM summary for middle | ✓ |
| Drop all raw, keep only summary | Only summary, no raw messages | |
| Keep all raw + summary | Never drop, additive only | |

**User's choice:** Keep tail, drop middle. System message + first 2 + last 4 raw + one cumulative summary. Archived raw messages optionally kept for diagnostics.

| Option | Description | Selected |
|--------|-------------|----------|
| One rolling cumulative summary | Each new summary merges into previous | ✓ |
| Chain of incremental summaries | Summary #1, Summary #2, etc. | |

**User's choice:** One rolling cumulative summary per conversation. Merge new summary into existing cumulative summary.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, implement LRU eviction now | Full lifecycle: summarization + archiving + eviction caps | ✓ |
| Summarization only, LRU later | Defer eviction to Phase 9 | |

**User's choice:** Implement full conversation lifecycle now. 30 min idle archiving, 10 active / 100 archived caps with LRU eviction.

---

## Retention / Forgetting

| Option | Description | Selected |
|--------|-------------|----------|
| Soft cap with auto-pruning | 500-fact cap, auto-prune lowest-ranked, evict low-confidence + unused | ✓ |
| User-managed only | No automatic eviction | |
| TTL-based auto-expiry | Facts expire after N days | |

**User's choice:** Soft cap of 500 facts. Auto-prune lowest-ranked when exceeded. Facts with confidence < 0.3 unused for 30+ days evicted. Ranking uses confidence, recency, useCount, retrieval frequency.

---

## the agent's Discretion

- MemoryEngine internal architecture (class+singleton, constructor DI)
- MemoryExtractor Haiku-tier prompt design
- MiniSearch index configuration (fields, boosting, rebuild strategy)
- BroadcastBus memory write request message types
- Exact MemoryDB schema updates for versioned facts and summary states
- Extraction concurrency model
- `MemoryEngine.assemble()` return type

## Deferred Ideas

- Archived raw messages for diagnostics/export — Phase 6 (Telemetry)
- User-managed memory editing UI — Phase 7 (Full UI / Options → Memory)
- Per-fact TTL configuration — out of scope for v0.1
- Memory import/export — Phase 8 (Data Portability)
