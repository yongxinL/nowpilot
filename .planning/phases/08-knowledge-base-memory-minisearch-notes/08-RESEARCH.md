# Phase 8: Knowledge Base (Memory + MiniSearch + Notes) - Research

**Researched:** 2026-09-01
**Domain:** persistent memory architecture (§3), local full-text retrieval (MiniSearch), atomic-note + wikilink core (§21.2/§27.7a), persona persistence (RICH-R-05)
**Confidence:** HIGH

## Summary

Phase 8 builds the persistent knowledge layer: (1) the memory subsystem — ConversationMemoryStore / UserMemoryStore / PreferenceMemoryStore / MemoryScorer / MemoryExtractor / MemoryEngine (with the §3.6 working-memory block), (2) a persistent per-surface MiniSearch notes index, and (3) the atomic-note + wikilink core (LinkParser, NoteGraph, three thin components). Nearly all dependencies are **already shipped by prior phases**: the IDB body stores (MemoryDB, NotesDB), the WriteJournal op union (which already declares `evict-conversation`, `archive-conversation`, `compact-conversation`, `save-note-with-links`, `update-user-memory`), the `ContextOptimizerInput.memoryHints: RetrievedMemory[]` seam + the Phase-7 `[MEMORY]` trust builder (trust:'retrieved', authority:false), the `getNoteByTitle` NotesDB affordance, the Phase-6 MiniSearch wrapper pattern (`PageIndexBuilder`), the `WorkspaceElection.isPrimaryWriter()` single-writer gate, and `countTokensHeuristic`. **No new packages need installing** — minisearch ^7.2.0, idb ^8.0.3, zod 4.4.3, zustand 5, fake-indexeddb are all present (verified against node_modules + package.json).

Four traps dominate planning risk: (1) the O.10 worked example imports `TraceRedactor` from `@/core/telemetry/TraceRedactor`, which **does not exist** (Phase 11) — WorkingMemory must use the Phase-2 `redactSensitiveValue` primitive behind a documented swap point; (2) the Phase-2 `MemoryDB.UserMemoryFact` bootstrap shape (`{userId, fact, category}`) does **not** match the §3.4 spec shape (`{content, type, tags, source, lastUsedAt, useCount}`) — all MemoryDB stores are verified write-empty, so the type supersedes safely with zero data migration; (3) the Phase-3 `useUserPreferencesStore` persists `np_preferences` and its store interface `extends UserPreferences` — the D-112 full-§3.5 supersession adds **required** fields (responseStyle etc.) that force an update of the store's initial state and partialize, not just a re-export; (4) `getNoteByTitle` returns the first byTitle-index hit and does **not** implement the WIKI-ID-02 tie-break — `resolveLinks` must `getAllFromIndex('byTitle', title)` and sort (updated desc → id asc) itself.

**Primary recommendation:** Build in five waves — (A) canonical type homes + supersessions (`src/types/notes.ts`, `src/core/memory/types.ts`, harness `WorkingMemory`, UserPreferences re-export), (B) the three memory stores + MemoryScorer + MemoryExtractor + MemoryEngine (D-104/D-105/D-106/D-113), (C) MiniSearchIndex + LinkParser + save-path seam + NoteGraph (D-109/D-110/D-111), (D) the three note components' core logic, (E) verify:phase-8 re-point (D-114) + perf/E2E tests. All §18 modules are new files; zero edits to ContextOptimizer/AgentOrchestrator/useChatStreaming (create-only discipline D-105).

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-104 (Memory storage follows the §23 split — metadata/LRU indices in chrome.storage.local, bodies in MemoryDB):** UserMemoryStore facts persist to **MemoryDB.userFacts** (the Phase-2 foundation store) as the body store; `chrome.storage.local` `np_facts` (max 500, LRU — §15.1) holds the small metadata/LRU index over those facts (ids + recency + useCount). ConversationMemoryStore: **`np_conversation_meta`** (chrome.storage.local) holds the LRU conversation metadata; message **bodies live in MemoryDB.messages** (§3.3 "store message bodies in IndexedDB only"); summaries persist to **MemoryDB.conversationSummaries**. PreferenceMemoryStore: **`np_persona`** (chrome.storage.local, §15.1) holds PersonaProfile + overrides — persona is small config, never a fact (R2). Working memory (§3.6): the budget-capped markdown block persists with the user-facts metadata (small, ≤300 tokens, single-writer, TraceRedactor'd) per Appendix O.10. — **Reversibility:** `costly` — rationale: storage-home assignment is cross-store; moving bodies between IDB and chrome.storage.local later touches the store adapters + LRU wiring.

- **D-105 (MemoryEngine is create-only — it supplies `memoryHints`/preference-profile producers proven by tests; live chat adoption stays deferred):** §18 Phase 8 lists memory files + notes files + the three components and NO ContextOptimizer/AgentOrchestrator modification. MemoryEngine exposes `retrieveConversationMemory()`, `retrieveUserMemory()` (top-5 / top-3 tiny / ≤1000 tokens / never secrets — §3.4), `buildPreferenceProfile()` (compact JSON incl. persona overrides, §3.5), and `retrieveMemoryHints()` producing the `RetrievedMemory[]` the Phase-7 trust layer already consumes. All proven by the §18 required tests + fixture suites. The live AgentOrchestrator/useChatStreaming call-sites that feed `ContextOptimizerInput.memoryHints` are NOT wired here (Phase 15 RICH + NMEM consumers in Phase 9 feed them). The E2E "Page → PageContentService → Note → MiniSearch" path is proven by a service-level test (PageContext → Note creation → NotesDB.put → index upsert → query), not a shipped UI call-site. — **Reversibility:** `reversible` — rationale: additive producer modules; wiring later is a caller edit.

- **D-106 (Conversation summarisation ships as a seam, proven with a deterministic stub):** §3.3 keep last 2/4/6 turns per tier; §15.3 compactor fires at `messageCount % 12 === 0` → keep head (system + first 2) + summary of middle + tail (last 4); archive after 30 min idle; LRU max 10 active / 100 archived (evict-conversation via WriteJournal). MemoryEngine/ConversationMemoryStore implement the compactor rules with the **summariser as a pluggable seam**; tests inject a deterministic stub summariser (the real LLM summariser wiring is a later phase — the M2 rolling observation refinement is preserved as the seam's contract). The 12-message rule, LRU caps, and archive-after-30-min are spec-verbatim (§15.3). — **Reversibility:** `reversible` — rationale: seam + deterministic tests; swapping the stub for an LLM call is a wiring edit.

- **D-107 (Canonical `Note` home is `src/types/notes.ts`; NotesDB re-exports it — D-72/D-83 precedent):** The Phase-2 `NotesDB.Note` (simplified: `source: string`, no `unresolvedLinks`/`summary`/`categoryPath`/`type`) is superseded. `src/types/notes.ts` becomes the canonical home carrying the spec §21.2 `Note` verbatim (spec 4721-4741: `links[]` = resolved note IDs, `unresolvedLinks[]`, `source` object with `kind`, `aiMeta` with `suggestedLinks`/`concepts`, `summary?`, `categoryPath?`, `type?: string`, `version`) + `OKF_NOTE_DEFAULT_TYPE` + `OkfNoteFrontmatter` + the LLM-WIKI-11 suggestion-gating constants (spec 4758-4762, declared for Phase 9). `src/core/storage/NotesDB.ts` re-exports/imports the canonical type so its `put`/`get` value shape is the canonical Note (D-72 re-export; no parallel copy). No DB migration in Phase 8 — idb value shapes are schema-flexible and the fields are additive; the v4 migration (adds `tags`/`summary` to the notes index + Note `type` population) is Phase 9 (spec 3156). — **Reversibility:** `costly` — rationale: type-home move + NotesDB value-shape change touches every NotesDB consumer and test fixture once, then converges (D-83 precedent cost).

- **D-108 (`Note.type?: string` is declaration-only in Phase 8):** the OKF-aligned field is added to the canonical Note interface and type-checks; NO reader/writer consumes it, no serialization, no migration, no LLM behavior change (spec 2675 DONE-when append — Phase 9 owns population + serialization). Same for `categoryPath` (declared here, populated Phase 9). — **Reversibility:** `reversible` — rationale: additive optional field; Phase 9 fills it.

- **D-109 (MiniSearchIndex is a per-surface lazy/memoized persistent notes index, updated incrementally on `note:saved`):** wraps NotesDB into a MiniSearch index with fields `title` + `content` + `tags` (+ `summary` seam for when Phase 9 populates it) per the `search-notes` contract (spec 1608). Built lazily on first query; **upserted incrementally** on the `EventBus` `note:saved` event (Flow 3 emit); deletion removes the note's document. Never persisted to IndexedDB — the index is rebuilt from NotesDB on surface boot (same never-persisted posture as the Phase-6 `PageIndexBuilder`, but persistent within the surface lifetime and over the notes store, not per-tab ephemeral). Perf gate: `< 50 ms over 1,000 notes` (spec 3481) — asserted by a test that indexes 1,000 synthetic notes and queries. — **Reversibility:** `reversible` — rationale: additive wrapper; rebuilding strategy is a local edit.

- **D-110 (Wikilink resolution is ID-based with the spec tie-break; unresolved links tracked):** `LinkParser.parseLinks` extracts `[[Title]]` targets from the markdown body; `resolveLinks` maps each to a note ID via the **resolution order (exact title match → `updated` desc → `id` asc, WIKI-ID-02)**. Resolved targets go to `links[]` (IDs); raw targets with no matching note go to `unresolvedLinks[]` (WIKI-ID-03, rendered distinctly by Phase-15 UI). Deleting a note does NOT rewrite source bodies — dangling edges demote back to `unresolvedLinks[]` at next save/graph rebuild (WIKI-ID-04). The save-path core (Flow 3 minus the LLM pipeline): `LinkParser.parseLinks → resolveLinks → NotesDB.put → EventBus.emit('note:saved')` — proven by tests; the note:saved handler upserts the MiniSearchIndex (D-109). — **Reversibility:** `reversible` — rationale: pure functions + graph ops; the save-wiring later is a caller edit.

- **D-111 (NoteGraph ships §22.3 cosine similarity + backlinks core; components carry core logic):** NoteGraph exposes `topKSimilar(note, k = 5)` — bag-of-words cosine, tokenise `content.toLowerCase().match(/[a-z0-9]{3,}/g)`, inline fixed 50-word English stop-word list (shipped inline in NoteGraph.ts per spec 3511), per-note term-frequency map, `cosine = dot(a,b) / (||a|| * ||b||)`, ties broken by `updated` desc then `id` asc (spec 3508-3514). Backlinks are a reverse index over `links[]`. The three `.tsx` files ship their **core logic** (backlink listing data, wikilink autocomplete = MiniSearch title matching per D-04 — no LLM suggestions in v0.1, graph adjacency/rendering data) as thin components; the full `NotesWorkspace` UI integration is Phase 15. — **Reversibility:** `reversible` — rationale: core-logic modules + thin components; Phase 15 consumes them.

- **D-112 (PreferenceMemoryStore owns `np_persona`; full §3.5 UserPreferences supersedes the Phase-3 minimal shape):** PreferenceMemoryStore persists **`np_persona`** (PersonaProfile + `personaId` + `personaOverrides`, §3.5 / R2) to chrome.storage.local — never the fact store. The Phase-3 minimal `UserPreferences` (src/core/ai/UserPreferences.ts) is superseded to the full §3.5 shape (responseStyle / preferredLanguage / preferStructuredOutput / allowCloudFallbackFromLocal / defaultProviderId? / toolAutonomy / defaultSurface / personaId? / personaOverrides?) at the canonical home **`src/core/memory/types.ts`** (spec 4579-4595, the declared supersession point from Phase 5's context/types.ts:8 and Phase 3's UserPreferences.ts:1-6). Existing consumers (`PersonaInjector`, `ContextOptimizer`, `PromptCacheManager`, `AgentOrchestrator`) keep resolving via the re-export (D-72/D-83 precedent); `fastModel`/`balancedModel` (D-54) remain additive preference fields. PersonaInjector continues to read overrides — now sourced from PreferenceMemoryStore/np_persona, not a fact store (R2, spec 121). Hydration on boot re-reads np_persona. — **Reversibility:** `costly` — rationale: supersession touches the Phase-3 UserPreferences contract + consumers; the D-72 re-export keeps it converging, but the shape move is the one-way-ish part (full §3.5 shape is the locked supersession target per spec 4579).

- **D-113 (MemoryScorer is the §3.4 scoring formula verbatim; MemoryExtractor is a schema+seam, LLM wiring in Phase 9):** MemoryScorer computes the exact weighted blend (spec 618-628: keyword 0.45 · tag 0.25 · recency 0.15 · useCount 0.10 · confidence 0.05), every sub-score normalised to [0,1] (ROADMAP SC#3); recency window = 30 days. MemoryExtractor ships the memory-fact extraction **schema + parse seam** (memoryFacts with confidence, mirroring the `NoteTagResultSchema`/`ConfidentFact` shape at spec 4764-4773); the actual LLM extraction call + NMEM-02 upsert wiring is Phase 9 (spec 3876). — **Reversibility:** `reversible` — rationale: verbatim formula + additive schema; Phase 9 wiring is a caller edit.

- **D-114 (Re-point `verify:phase-8` to the §18 required test dirs — D-92/D-103 analog):** package.json `verify:phase-8` currently targets `tests/core/content tests/addons tests/isolation` (Phase 6/17 territory). Re-point to the §18 canonical gate string (spec 3612 verbatim): `tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts`. — **Reversibility:** `reversible` — rationale: package.json script edit (D-68/D-78/D-92/D-103 precedent).

### the agent's Discretion

- Exact `src/core/memory/` layout (one file per §18 name vs a barrel `index.ts` — mirror `src/core/ai/` convention); whether `src/core/memory/types.ts` holds `RetrievedMemory` + `UserPreferences` only, or also local store types (idb row shapes).
- Whether the note-save core lives in `LinkParser.ts`/`NoteGraph.ts` or a small `notes/save.ts` seam — either satisfies Flow 3 minus the LLM pipeline (D-110).
- Whether `MiniSearchIndex` reuses the Phase-6 `PageIndexBuilder` field/chunk conventions or defines its own note-document shape (both satisfy the `<50 ms/1,000 notes` gate).
- Whether WorkingMemory (Appendix O.10) is a `src/core/memory/WorkingMemory.ts` module + `@/types/harness` type (O.10 exact shape) or folded into `UserMemoryStore.ts`.
- Whether `EventBus` `note:saved` is a declared event type now (Phase 8 emitter) vs Phase 9 (both satisfy D-109's incremental upsert).

### Deferred Ideas (OUT OF SCOPE)

- **Memory governance (MEM-01…05, KNW-01)** — Phase 10: `MemoryRecord` conflict resolution (O.4), lifecycle controls (pin/forget/expiry), procedural experience, edge provenance. Phase 8 ships the stores + scoring only.
- **LLM enrichment + filesystem sync** — Phase 9: NoteTagger/NoteQA/NoteChatConverter/NoteFileSync/NoteMaintenance, CAT/LLM-WIKI/SYNC/NMEM-01…03, OKF serialization, `search-notes` RAG.
- **Live `memoryHints` adoption in AgentOrchestrator/useChatStreaming** — deferred (D-69/D-105); Phase 15 RICH + Phase 9 NMEM consumers feed the seam.
- **Full Notes UI in `NotesWorkspace`** (list/editor/backlinks/graph/search) — Phase 15.1; Phase 8 ships component core logic.
- **`search-notes` / `create-note` tool registration** — Phase 18 (TOL-01 tool manifests); Phase 8 ships the index + save core.
- **Real LLM summariser for the 12-message compactor** — later phase; Phase 8 proves the seam with a deterministic stub (D-106).
- **LLM wikilink autocomplete suggestions** — not in v0.1 (D-04); MiniSearch title matching is sufficient (D-111).
- **Embedding-based retrieval** — deferred per §3.2 (no embedding downloads); MiniSearch + cosine is the v0.1 mechanism.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RICH-R-05 | Persona persists across sessions/surfaces. Stored in PreferenceMemoryStore (`np_persona`), NOT the fact store (reconciliation R2). Depends on R-01. | PreferenceMemoryStore persists `np_persona` (PersonaProfile + personaId + personaOverrides) to chrome.storage.local (D-112; §15.1 key declared at PRODUCT_SPEC_v0_1.md:1957). Full §3.5 `UserPreferences` supersedes the Phase-3 minimal shape at the canonical home `src/core/memory/types.ts` (spec 4579-4595); `src/core/ai/UserPreferences.ts` re-exports so PersonaInjector/ContextOptimizer/PromptCacheManager/AgentOrchestrator keep resolving (verified import sites: src/core/ai/UserPreferences.ts:12, src/core/ai/PromptCacheManager.ts:26, src/core/ai/AgentOrchestrator.ts:24, src/core/context/ContextOptimizer.ts:24, src/core/context/trust/contextItems.ts:28). `PersonaProfileSchema` + `DEFAULT_PERSONA` already exist at src/core/ai/persona/PersonaProfile.ts:7-40 (code-seeded, RICH-R-01). DONE-when proof: `MemoryEngine.buildPreferenceProfile()` returns compact JSON incl. persona overrides read from np_persona (create-only producer, D-105), asserted by the §18 `MemoryEngine.test.ts` + `UserMemoryStore.test.ts` tests. Never written to MemoryDB.userFacts (R2, spec 664/2384). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Memory bodies (messages / userFacts / conversationSummaries) | Database — IndexedDB (MemoryDB) | — | §23/D-104: bodies in MemoryDB only; chrome.storage.local 10 MB cap (§15.1) insufficient for message bodies |
| Memory metadata / LRU indices (np_facts, np_conversation_meta) | Database — chrome.storage.local | — | §15.1 keys; small metadata (ids + recency + useCount) |
| Persona config (np_persona) | Database — chrome.storage.local | — | §15.1/R2: small user *config*, never a fact; cross-surface readable |
| Working memory block | Database — chrome.storage.local (with np_facts metadata) | API/Backend — WorkingMemory module | D-104; ≤300 tokens, single-writer (primary surface), redacted |
| Memory scoring + retrieval (MemoryScorer, MemoryEngine.retrieveUserMemory) | API/Backend — core logic | — | Pure functions over facts; UI-agnostic (src/core/ UI-framework-free convention) |
| Conversation compactor / LRU (12-msg rule, archive, evict) | API/Backend — core logic | Database — WriteJournal (evict-conversation op) | §15.3 rules spec-verbatim; single-writer via `WorkspaceElection.isPrimaryWriter()` (verified src/core/workspace/WorkspaceStore.ts:23) |
| Full-text search over notes | Browser/Client — in-memory MiniSearch | API/Backend — MiniSearchIndex wrapper | Spec §3.2 mandates MiniSearch (local, no server/embeddings); index never persisted (D-109, §26.5) |
| Wikilink parse/resolve | API/Backend — core logic (LinkParser) | Database — NotesDB byTitle index | Pure functions; tie-break per WIKI-ID-02 |
| NoteGraph cosine + backlinks | API/Backend — core logic (NoteGraph) | — | §22.3 verbatim algorithm, no library |
| Backlinks / autocomplete / graph rendering data | Browser/Client — thin .tsx components | API/Backend — NoteGraph/MiniSearchIndex | D-111: components carry core logic only; NotesWorkspace UI integration is Phase 15 |

## Standard Stack

All packages are **already installed** — Phase 8 installs nothing new (VAI-04: re-query versions at install; verified against node_modules this session).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| minisearch | ^7.2.0 (installed 7.2.0) | In-memory full-text index for notes (MiniSearchIndex) + title matching for wikilink autocomplete | Spec §3.2/§26.5/§10.5 mandates MiniSearch; already used by Phase-6 PageIndexBuilder (src/core/extraction/PageIndexBuilder.ts:145-153); zero deps, sub-ms queries at 1,000 docs |
| idb | ^8.0.3 (installed 8.0.3) | Typed IndexedDB access through MemoryDB/NotesDB | Phase-2 foundation (D-41/D-42); openVersionedDB wrapper + DBSchema typing (src/core/storage/IndexedDBMigrator.ts:24) |
| zod | 4.4.3 installed (STACK.md "zod ^3.24" is stale — VAI-04) | Cross-boundary schema validation: MemoryExtractor schema, np_persona schema, UserMemoryFact/RetrievedMemory validation | CLAUDE.md convention: all cross-boundary data zod-validated; v4 API (`z.enum`, `z.object`, `.safeParse`) already used across src/core/ai + context |
| zustand | ^5.0.0 | PreferenceMemoryStore (np_persona) persistence if store-shaped | Phase-3 UserPreferences store precedent (src/core/ai/UserPreferences.ts:66-105) + chromeStorageAdapter |
| fake-indexeddb | installed (dev) | In-memory IDB for memory/notes DB tests | tests/setup.ts:2-11 `fake-indexeddb/auto` + `__resetIndexedDB()` per-test |
| vitest | 4.1.11 (VAI-04) | Test runner for the 5 §18 test files + perf/E2E tests | Existing infra; verify:phase-8 re-point target (spec 3612) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chromeStorageAdapter (in-repo) | — | chrome.storage.local adapter for np_facts/np_conversation_meta/np_persona | Every chrome.storage.local persist in the three memory stores (src/core/theme/chromeStorageAdapter.ts) |
| countTokensHeuristic (in-repo) | — | §3.4 ≤1000-token memory budget + WorkingMemory cap bookkeeping | src/core/context/TokenBudget.ts:44 — same heuristic O.10 inlines as `Math.ceil(s.length/4)` |
| WorkspaceElection.isPrimaryWriter() (in-repo) | — | Single-writer gate for compactor/working-memory writes | src/core/workspace/WorkspaceStore.ts:23 → WorkspaceElection.ts:133-134 (real CAS election, Phase 2) |
| redactSensitiveValue (in-repo) | — | WorkingMemory redaction seam (O.10 calls TraceRedactor — Phase 11; use this now) | src/core/security/redactSensitive.ts:68-71 — storage-side primitive; swap to TraceRedactor at Phase 11 |
| EventBus (in-repo) | — | note:saved emit/subscribe for MiniSearchIndex upsert | src/core/events/EventBus.ts:16-37 (`on`/`emit`/`off`/`hasListeners`, string-keyed, handler errors swallowed) |
| WriteJournal (in-repo) | — | `evict-conversation` operation for §15.3 LRU eviction | src/core/storage/WriteJournal.ts:78-101 `registerJournalSteps`/`isSupportedOperation` — op already declared in union |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MiniSearch (in-memory) | Embedding vectors / remote vector DB | Spec §3.2 explicitly defers embeddings (40 MB model download "not justified"); MiniSearch + cosine is the v0.1 mechanism |
| IndexedDB bodies + chrome.storage.local metadata | All in chrome.storage.local | 10 MB cap makes message bodies impossible locally (§23 ADR row verified at spec 3554) |
| MiniSearch `discard(id)` on note delete | `remove(fullDoc)` | `discard` is by-ID + lazy auto-vacuum (verified dist/es/index.d.ts:926-969) — right choice for the delete path where the caller has only the ID |

**Installation:**
```bash
# None required. minisearch ^7.2.0, idb ^8.0.3, zod 4.4.3, zustand ^5.0.0,
# fake-indexeddb all present in package.json dependencies (verified).
# VAI-04: re-query `npm view minisearch version` etc. at install time if any
# version bump is considered — do NOT bump in Phase 8 without a decision.
```

**Version verification:**
```bash
npm view minisearch version        # → 7.2.0 (2025-09-16 publish; 2.6M weekly downloads)
npm view idb version               # → 8.0.3 (2025-05-07 publish; 24.7M weekly downloads)
node -e "console.log(require('./node_modules/zod/package.json').version)"  # → 4.4.3
```

## Package Legitimacy Audit

> All four packages below are **already installed** (Phase 2/3/5/6); Phase 8 installs nothing new.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| minisearch | npm | 8+ yrs (7.2.0 pub 2025-09-16) | 2.63M/wk | github.com/lucaong/minisearch | OK | Approved — in use since Phase 6 |
| idb | npm | 10+ yrs (8.0.3 pub 2025-05-07) | 24.7M/wk | github.com/jakearchibald/idb | OK | Approved — in use since Phase 2 |
| fake-indexeddb | npm | 8+ yrs (pub 2025-11-07) | 5.7M/wk | github.com/dumbmatter/fakeIndexedDB | OK | Approved — test infra since Phase 2 |
| zod | npm | 4.4.3 pub 2026-08-29 (too-new signal) | 274.7M/wk | github.com/colinhacks/zod | SUS (flagged "too-new" by publish date only) | Keep — already installed + used across all phases; no install in Phase 8. No checkpoint needed since nothing is being installed. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** zod — flagged only because the *latest* publish is recent; the package is the canonical colinhacks/zod (274.7M weekly downloads) and 4.4.3 is already the installed, fully-exercised version in this repo. No install action in Phase 8, so no human-verify checkpoint is required.

*No WebSearch-discovered or training-data-discovered package names are used in Phase 8 recommendations — every library above is already in package.json + node_modules ([VERIFIED: node_modules + npm registry]).*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SURFACE (side panel / standalone — UI contexts only; never background SW)   │
│                                                                             │
│  MemoryEngine (create-only producer, D-105)                                 │
│   ├─ retrieveConversationMemory(id) ─► ConversationMemoryStore              │
│   │     ├─ MemoryDB.messages (bodies)  ←  compactor (msgCount % 12 === 0)   │
│   │     ├─ MemoryDB.conversationSummaries (summaries)  ← summariser seam    │
│   │     └─ chrome.storage.local np_conversation_meta (LRU 10/100)           │
│   ├─ retrieveUserMemory(query) ─► UserMemoryStore                           │
│   │     ├─ MemoryDB.userFacts (bodies, §3.4 shape)                          │
│   │     ├─ chrome.storage.local np_facts (LRU ≤500 metadata index)          │
│   │     └─ MemoryScorer (0.45/0.25/0.15/0.10/0.05 verbatim)                 │
│   ├─ retrieveMemoryHints() ─► RetrievedMemory[] ──► (Phase-7 trust layer)   │
│   │     └─ contextItems [MEMORY]: trust 'retrieved', authority FALSE        │
│   ├─ buildPreferenceProfile() ─► compact JSON ──► PreferenceMemoryStore     │
│   │     └─ chrome.storage.local np_persona (PersonaProfile + overrides)     │
│   └─ working memory block (≤300 tok, single-writer, redacted)               │
│                                                                             │
│  MiniSearchIndex (per-surface lazy singleton, never persisted)              │
│   └─ MiniSearch{fields: title,content,tags(+summary)} ◄─ note:saved upsert  │
│                                                                             │
│  Save-path core (Flow 3 minus LLM):                                         │
│   LinkParser.parseLinks → resolveLinks (tie-break) → NotesDB.put            │
│     → EventBus.emit('note:saved') → MiniSearchIndex.upsert                  │
│                                                                             │
│  NoteGraph.topKSimilar(note,k=5) + backlinks  ──► 3 thin .tsx components    │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                      │
                    ▼                      ▼
        IndexedDB (MemoryDB/NotesDB)   chrome.storage.local
        bodies: messages, userFacts,   np_facts / np_conversation_meta /
        conversationSummaries, notes   np_persona (+ working block)
```

Trace the primary use case: `[[Title]]` wikilink in a saved note → `LinkParser.parseLinks` extracts target → `resolveLinks` maps to note ID via exact-title → updated-desc → id-asc → `NotesDB.put` stores the canonical Note (edges as IDs) → `EventBus.emit('note:saved')` → `MiniSearchIndex` upserts the document (incremental, no rebuild) → later `search(query)` returns the note in <50 ms. In parallel, MemoryEngine retrieves memory: facts scored by §3.4 → top-5 (top-3 tiny) → `RetrievedMemory[]` → Phase-7 trust layer emits `[MEMORY]` with trust:'retrieved' / authority:false.

### Recommended Project Structure

```
src/
├── types/
│   ├── notes.ts            # NEW — canonical Note (§21.2 verbatim), OKF frontmatter,
│   │                       #   OKF_NOTE_DEFAULT_TYPE, suggestion-gating constants
│   └── harness.ts          # EDIT — ADD WorkingMemory + WORKING_MEMORY_TEMPLATE (Appendix C.1/O.10)
├── core/
│   ├── memory/             # NEW (mirror src/core/ai/ layout — one file per §18 name)
│   │   ├── types.ts        #   canonical RetrievedMemory + UserPreferences (spec 4571-4595);
│   │   │                   #   discretion: may also host §3.4 UserMemoryFact canonical shape
│   │   ├── MemoryEngine.ts
│   │   ├── ConversationMemoryStore.ts
│   │   ├── UserMemoryStore.ts
│   │   ├── PreferenceMemoryStore.ts     # np_persona owner (RICH-R-05)
│   │   ├── MemoryScorer.ts              # §3.4 formula verbatim
│   │   ├── MemoryExtractor.ts           # schema + parse seam only
│   │   └── WorkingMemory.ts             # O.10 worked example (redaction seam swap, see Pitfall 1)
│   ├── search/
│   │   └── MiniSearchIndex.ts           # NEW — persistent notes wrapper (D-109)
│   ├── notes/                            # NEW
│   │   ├── LinkParser.ts                # parseLinks/resolveLinks (+ tie-break)
│   │   ├── NoteGraph.ts                 # topKSimilar + backlinks + 50-word stop-list
│   │   └── save.ts                      # OPTIONAL discretion: Flow-3 save core seam
│   ├── storage/
│   │   ├── NotesDB.ts                   # EDIT — re-export canonical Note (D-72 precedent)
│   │   ├── MemoryDB.ts                  # EDIT — reconcile UserMemoryFact to §3.4 shape
│   │   └── WriteJournal.ts              # EDIT — register 'evict-conversation' steps
│   ├── ai/
│   │   └── UserPreferences.ts           # EDIT — re-export full shape from @/core/memory/types
│   └── context/
│       └── types.ts                     # EDIT — re-export RetrievedMemory (spec 4571 supersession)
├── components/notes/
│   ├── BacklinksPanel.tsx               # NEW — core logic (D-111)
│   ├── WikilinkAutocomplete.tsx         # NEW — MiniSearch title matching (D-04)
│   └── NoteGraphView.tsx                # NEW — adjacency/rendering data
tests/
├── core/memory/                          # NEW — MemoryEngine/MemoryScorer/UserMemoryStore
├── core/search/                          # NEW — MiniSearchIndex (+ perf gate)
└── core/notes/LinkParser.test.ts         # NEW
```

### Pattern 1: MiniSearch wrapper — lazy per-surface singleton (D-109, mirrors PageIndexBuilder)

**What:** Module-level singleton index over NotesDB, built lazily on first query, upserted incrementally on `note:saved`, `discard(noteId)` on delete, never persisted.
**When to use:** The persistent notes index (distinct instance from the Phase-6 per-tab ephemeral page index — §26.5 spec 3774: they never share storage).
**Example:** (verified in-repo — src/core/extraction/PageIndexBuilder.ts:145-153, 175-180)

```typescript
// Source: src/core/extraction/PageIndexBuilder.ts:145-153 (Phase-6 pattern to mirror)
export function buildIndex(chunks: PageChunk[]): MiniSearch<PageChunk> {
  const index = new MiniSearch<PageChunk>({
    fields: ['title', 'url', 'headingPath', 'sectionText'],
    storeFields: ['title', 'url', 'headingPath', 'sectionText'],
    searchOptions: { boost: { title: 3, headingPath: 2 }, prefix: true, fuzzy: 0.2 },
  });
  index.addAll(chunks);
  return index;
}
```

For MiniSearchIndex the document shape is note-native: `{ id: note.id, title: note.title, content: note.content, tags: note.tags.join(' '), summary: note.summary ?? '' }` with `searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.2 }` (search-notes contract spec 1608: title + content + tags + summary). Search results spread stored fields at runtime — the `as unknown as IndexHit[]` cast precedent at PageIndexBuilder.ts:179 is required because the static `SearchResult` type only declares `{ id, terms, queryTerms, score, match }` [VERIFIED: node_modules/minisearch/dist/es/index.d.ts + PageIndexBuilder.ts:175-180]. Bulk boot rebuild uses `addAll` (sync, sub-ms at 1,000 docs) or `addAllAsync({chunkSize})` if main-thread blocking matters [VERIFIED: node_modules .d.ts:885-899].

### Pattern 2: Metadata-local / bodies-IDB split (§23, D-104)

**What:** Small metadata + LRU indices in chrome.storage.local (`np_facts` ≤500, `np_conversation_meta` 10/100, `np_persona`); large bodies in IndexedDB (MemoryDB.messages/userFacts/conversationSummaries).
**When to use:** Every memory write in Phase 8. The np_facts metadata record mirrors §3.4's recency/useCount fields (ids + recency + useCount per D-104) so MemoryScorer can score without opening IDB, and fact bodies are fetched only for the top-k.
**Key detail:** All three MemoryDB stores are **write-empty** today — verified by grep: no source file outside MemoryDB.ts writes `userFacts`/`conversationSummaries`/`messages` (only WriteJournalDB.ts + IndexedDBMigrator.ts reference MemoryDB for bootstrap). Phase 8 is the first writer, so value-shape supersession (Pitfall 2) needs **zero data migration** — idb is schema-flexible at runtime and D-107's no-migration logic covers additive fields.

### Pattern 3: Canonical type home + re-export supersession (D-72/D-83/D-107/D-112)

**What:** New canonical homes (`src/types/notes.ts` for Note, `src/core/memory/types.ts` for RetrievedMemory/UserPreferences) carry the spec shapes verbatim; the old declaration sites re-export so existing imports keep resolving.
**When to use:** D-107 (NotesDB.Note → types/notes.ts), D-112 (context/types.ts:26-32 + ai/UserPreferences.ts → core/memory/types.ts), harness WorkingMemory addition.
**Example** (in-repo precedent — src/core/context/types.ts:22-23):

```typescript
/** D-83: PageContext family re-exported from the canonical Phase-6 home (spec 4345-4391). */
export type { PageContext, TabContext, SNowCaseData, FileContext, NoteContext } from '../content/PageContext';
```

Phase 8 mirrors this: `src/core/storage/NotesDB.ts` imports + re-exports `Note` from `@/types/notes` (its `put`/`get` value shape becomes canonical — a one-line type change + deleting the local placeholder at NotesDB.ts:26-37), and `src/core/context/types.ts` re-exports `RetrievedMemory` from `@/core/memory/types` (replacing its local declaration at lines 26-32).

### Pattern 4: Create-only producer seam (D-69/D-81/D-105)

**What:** Producers (MemoryEngine.retrieveMemoryHints, buildPreferenceProfile) are real, tested modules; the live call-sites that would consume them stay untouched. Proof is via the §18 required tests + fixture suites, not a shipped UI call.
**When to use:** All of Phase 8 — no edits to ContextOptimizer.ts / AgentOrchestrator.ts / useChatStreaming; the `ContextOptimizerInput.memoryHints: RetrievedMemory[]` field (ContextOptimizer.ts:55) and the `[MEMORY]` item builder (contextItems.ts:70-93: `hint.id\t hint.content`, trust 'retrieved', authority false, relevance = mean score, freshness 0.5, sensitivity 'high') already exist and are unit-tested — Phase 8 only supplies the data shape that satisfies them.

### Pattern 5: Spec-verbatim discrete values (D-38/D-113)

**What:** No invented weights/caps/tie-breaks — every constant copied from the spec. The executor-facing verbatim values for this phase (all read from PRODUCT_SPEC_v0_1.md this session):

```
§3.4 scoring (spec 618-628):
  keywordScore = matchedQueryTerms / totalQueryTerms
  tagScore     = matchedTags / max(1, memoryTags.length)
  recencyScore = clamp(1 - (now - updatedAt) / (30 * DAY), 0, 1)
  useCountScore = min(1, useCount / 20)
  confidenceScore = confidence
  score = keywordScore*0.45 + tagScore*0.25 + recencyScore*0.15
        + useCountScore*0.10 + confidenceScore*0.05

§3.4 injection (spec 630-635): top 5 max · top 3 tiny · total ≤ 1000 tokens · never secrets/raw customer data
§3.6 (spec 678-684): WORKING_MEMORY_TEMPLATE = `# User Profile\n- **Name**:\n- **Role / Team**:\n- **Environment**:\n- **Preferences**:\n- **Long-term Goals**:`; block cap ≤ 300 tokens
§15.3 (spec 2005-2010): max 10 active → archive oldest; max 100 archived → evict via WriteJournal 'evict-conversation'; compactor at messageCount % 12 === 0 → keep head (system + first 2) + summary + tail (last 4); archive after 30 min idle
§22.3 (spec 3508-3514): topKSimilar(note, k=5); tokenise content.toLowerCase().match(/[a-z0-9]{3,}/g); 50-word inline stop-list; cosine = dot(a,b)/(||a||*||b||); ties by updated desc then id asc
WIKI-ID-02 (spec 3902): resolution order exact title match → updated desc → id asc
```

### Anti-Patterns to Avoid

- **Importing `@/core/telemetry/TraceRedactor`** (O.10's literal import): the module does not exist (Phase 11) — `tsc --noEmit` fails. Use the Phase-2 `redactSensitiveValue` primitive with a documented Phase-11 swap comment.
- **Editing ContextOptimizer/AgentOrchestrator** to "wire" memory: violates D-105 create-only discipline; the E2E proof is tests, not call-sites.
- **Persisting the MiniSearch notes index**: D-109/§26.5 forbid it; zero storage-area imports in MiniSearchIndex (grep-assertable like PageIndexBuilder).
- **Building MemoryRecord/MemoryKind (C.1 spec 4903-4915)**: Phase 10 scope — do not declare them in Phase 8 (even though `memory/types.ts` might look like their home; the canonical home is `@/types/harness` per spec 4839).
- **Letting notes leak into the page index or page chunks into the notes index**: two distinct MiniSearch instances, never shared storage (spec 3774).
- **Renaming values in the tie-break / scoring / LRU caps**: executor `parse()`/typecheck failures are the expensive place to discover drift; spec-verbatim only (Pattern 5).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text search over notes | A custom inverted index / string `includes` scan | minisearch 7.2.0 (MiniSearchIndex) | Spec §3.2 mandates MiniSearch; prefix + fuzzy + boosting + ranking already solved; <50 ms/1,000 notes gate (spec 3481) is trivially met with `addAll` + one `search` |
| Note similarity ranking | Custom TF-IDF / vector code | NoteGraph §22.3 bag-of-words cosine (inline, ~30 lines) | Spec 3508-3514 is the verbatim contract — but it IS the small hand-rolled algorithm the spec prescribes (no library); the point is to implement §22.3 exactly, not invent a fancier scheme |
| IndexedDB versioning/migration | Per-store ad-hoc `openDB` | openVersionedDB + IndexedDBMigration (Phase 2) | Shared framework (src/core/storage/IndexedDBMigrator.ts:24-62); conditional blocks + ErrorStore degraded-mode discipline |
| Crash-safe multi-store writes | Direct multi-store writes without journaling | WriteJournal runJournaled + registered steps | §15.3 eviction spans IDB + chrome.storage.local; journal makes it atomic-on-recovery (O.11); `evict-conversation` op already in the union |
| Cross-surface memory sync | Surface-to-surface direct calls | chrome.storage.local shared keys + BroadcastChannel (existing) | §3.1 memory is shared across surfaces by reading the same stores; single-writer via WorkspaceElection |
| Password/secret handling in memory | Storing secrets in np_facts/np_persona | redactSensitiveValue now / TraceRedactor Phase 11 + §3.4 "never secrets" rule | Privacy-first: working memory + facts redacted before persist; secrets stay in np_providers (encrypted) + np_jsessionid/session |

**Key insight:** This phase is almost entirely *composition of already-shipped foundations* (stores, journal, trust layer, event bus, MiniSearch pattern, election, redaction primitive). The only genuinely hand-built algorithms are the ones the spec prescribes verbatim (MemoryScorer weights, NoteGraph cosine + stop-list, LinkParser regex, compactor rules) — hand-roll those *exactly*, nothing else.

## Runtime State Inventory

> Phase 8 is a supersession-touching phase (D-107/D-112 type-home moves) but creates **no new runtime data migrations**. Every category below was explicitly checked this session.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None — verified.** `np_facts`, `np_conversation_meta`, `np_persona` keys do not exist in the codebase (grep: no writer outside this phase's scope); MemoryDB `userFacts`/`conversationSummaries`/`messages` stores are write-empty (grep: only MemoryDB.ts declares them; WriteJournalDB/IndexedDBMigrator reference MemoryDB for bootstrap only). Phase 8 is the first writer — value-shape supersession (MemoryDB.UserMemoryFact → §3.4) needs zero data migration. | None (type-only supersession) |
| Live service config | None — no external services configured by this phase; chrome.storage keys are new. | None |
| OS-registered state | None — no OS registrations (extension storage only). | None |
| Secrets/env vars | `np_preferences` (Phase 3) persists `fastModel`/`balancedModel`/`personaOverrides` — the D-112 supersession does NOT move these keys' values; PreferenceMemoryStore adds `np_persona` alongside. `personaOverrides` now has two potential homes (np_preferences legacy + np_persona canonical) — see Open Question 3. | None (additive key); code edit only |
| Build artifacts | None — no renames of installed packages/entrypoints. `verify:phase-8` package.json script mis-pointing (D-114) is a config edit, not a build artifact. | package.json script edit |

## Common Pitfalls

### Pitfall 1: O.10's `TraceRedactor` import doesn't compile — the module ships in Phase 11
**What goes wrong:** The Appendix O.10 worked example (spec 6596-6622) does `import { TraceRedactor } from '@/core/telemetry/TraceRedactor'` — `src/core/telemetry/` does not exist this session (verified: `ls src/core/telemetry` → missing; grep for `export.*TraceRedactor` in src → zero hits). Copying O.10 verbatim fails `tsc --noEmit`.
**Why it happens:** O.10 was written against the full roadmap; TraceRedactor is a Phase-11 module (per redactSensitive.ts:3-4 comment "The full TraceRedactor (Phase 11) is a richer logger-side sibling").
**How to avoid:** Implement `src/core/memory/WorkingMemory.ts` with the O.10 shape (initWorkingMemory / updateWorkingMemory / MAX_WORKING_MEMORY_TOKENS = 300 / estimate = `Math.ceil(s.length / 4)` / truncateToTokens) but substitute the redaction call with the existing `redactSensitiveValue` (src/core/security/redactSensitive.ts:68-71) behind a `// TODO(Phase 11): swap to TraceRedactor` comment. Add `WorkingMemory` + `WORKING_MEMORY_TEMPLATE` to `@/types/harness` (canonical home, spec 4839) — the type itself does not exist there yet (verified harness.ts:1-102 has reliability + trust types only).
**Warning signs:** import error `Cannot find module '@/core/telemetry/TraceRedactor'` at the first `pnpm lint`.

### Pitfall 2: `MemoryDB.UserMemoryFact` bootstrap shape ≠ §3.4 spec shape
**What goes wrong:** The store value type at src/core/storage/MemoryDB.ts:37-45 is `{ id, userId, fact, category, confidence, createdAt, updatedAt }` — the §3.4 spec shape (spec 601-612) is `{ id, content, type: 'fact'|'preference'|'pattern', tags, confidence, source: 'explicit'|'inferred'|'system', createdAt, updatedAt, lastUsedAt?, useCount }`. If UserMemoryStore writes `content`/`type`/`tags`/`useCount` into the typed store without reconciling the type, `parse()`/typecheck fails (or worse, an invented union drifts from the spec).
**Why it happens:** Phase 2 bootstrapped a simplified shape; the spec §3.4 canonical shape belongs to the Phase-8 owning phase.
**How to avoid:** Supersede in place — either move the canonical §3.4 `UserMemoryFact` to `src/core/memory/types.ts` and have MemoryDB import/re-export it (D-72 precedent, recommended), or replace the local interface with the verbatim spec shape. Safe because the store is write-empty (verified by grep — no writer exists today). Same check applies to `MemoryMessage.role` at MemoryDB.ts:31 — its union is `'user' | 'assistant' | 'system'`, while §3.3 `ConversationMemory.lastMessages` roles include `'tool'` (spec 579) — extend the union additively if tool turns are stored.
**Warning signs:** `Property 'useCount' does not exist on type` in UserMemoryStore, or a MemoryScorer test asserting scores with a hand-invented shape.

### Pitfall 3: The D-112 UserPreferences supersession breaks the Phase-3 zustand store, not just imports
**What goes wrong:** `src/core/ai/UserPreferences.ts:46` has `interface UserPreferencesStore extends UserPreferences` with `initialPreferences` (line 54-58) containing only the three optional fields. The full §3.5 shape (spec 4579-4595) adds **required** fields (`responseStyle`, `preferredLanguage`, `preferStructuredOutput`, `allowCloudFallbackFromLocal`, `toolAutonomy`, `defaultSurface`) — a bare re-export makes the store's `initialPreferences`/`partialize` fail typecheck.
**Why it happens:** The supersession replaces the type contract, and the store is typed against it.
**How to avoid:** Plan a dedicated task: (a) declare the full shape in `src/core/memory/types.ts` (verbatim spec 4579-4595, plus additive `fastModel?`/`balancedModel?` per D-54), (b) `src/core/ai/UserPreferences.ts` re-exports `UserPreferences` from `@/core/memory/types` and keeps the store, updating `initialPreferences` with defaults for the required fields and keeping `partialize` (which persists fastModel/balancedModel/personaOverrides under np_preferences — unchanged legacy behavior), (c) verify PersonaInjector (resolvePersona reads `prefs.personaOverrides` — PersonaInjector.ts:18-30), PromptCacheManager (prefsCompact reads fastModel/balancedModel/personaOverrides — PromptCacheManager.ts:160-171), ContextOptimizer + contextItems (prefsCompact — contextItems.ts:143-152) still compile with zero edits (create-only).
**Warning signs:** `pnpm lint` errors on `initialPreferences`/`partialize` in UserPreferences.ts immediately after the type move.

### Pitfall 4: `getNoteByTitle` does NOT implement the WIKI-ID-02 tie-break
**What goes wrong:** NotesDB's `getNoteByTitle` (NotesDB.ts:88-93) uses `db.getFromIndex('notes', 'byTitle', title)` which returns a single arbitrary hit (byTitle is `unique: false`, NotesDB.ts:69). `resolveLinks` must return the exact-title → updated-desc → id-asc winner among possibly multiple same-title notes — using getNoteByTitle silently picks the wrong one.
**Why it happens:** The Phase-2 helper was a "first hit" affordance; the tie-break is a Phase-8 contract (WIKI-ID-02).
**How to avoid:** `resolveLinks` queries `db.getAllFromIndex('notes', 'byTitle', title)`, filters exact matches, sorts by `updated` desc then `id` asc (spec 3902 verbatim), takes the first. Keep `getNoteByTitle` untouched for its other callers or re-point it — do not rely on it for resolution.
**Warning signs:** A LinkParser.test.ts tie-break fixture (two notes same title, different updated) resolves to the wrong ID.

### Pitfall 5: MiniSearch search results don't carry stored fields statically
**What goes wrong:** `index.search(q)` returns `SearchResult[]` typed `{ id, terms, queryTerms, score, match }` — the `storeFields` are spread onto results at runtime. Accessing `result.title` without a projection cast fails typecheck.
**Why it happens:** MiniSearch's static type only declares the base fields (verified node_modules/minisearch/dist/es/index.d.ts:620-630).
**How to avoid:** The Phase-6 precedent — `query()` casts `as unknown as IndexHit[]` (PageIndexBuilder.ts:179). MiniSearchIndex defines its own `NoteHit = { id: string; score: number } & NoteDoc` and casts the same way.
**Warning signs:** `Property 'title' does not exist on type 'SearchResult'`.

### Pitfall 6: EventBus is in-memory, string-keyed, and swallows handler errors
**What goes wrong:** `note:saved` emitted on the in-repo EventBus (src/core/events/EventBus.ts:27-37) only reaches handlers registered in the SAME surface/module instance — it is not cross-surface (that's BroadcastChannel's job). Also `emit` swallows handler exceptions (lines 30-36), so a failing upsert silently disappears.
**Why it happens:** The EventBus is a deliberately generic in-surface pub/sub; no declared event registry exists.
**How to avoid:** Register the MiniSearchIndex `note:saved` subscriber at module load (like PageIndexBuilder.wireEvictionHook at PageIndexBuilder.ts:224-230, which is re-invocable via the `__test__` reset seam). For the discretion item "declared event type now vs Phase 9": recommend declaring a typed constant + payload now — `export const NOTE_SAVED_EVENT = 'note:saved'` with `interface NoteSavedPayload { noteId: string }` exported from the notes module (save.ts or LinkParser.ts) — without touching EventBus.ts, keeping both emitter and subscriber type-checked.
**Warning signs:** A test emits `note:saved` after `__test__.reset()` and the index never upserts (handler was never re-wired).

### Pitfall 7: verify:phase-8 still points at Phase-6 test dirs
**What goes wrong:** package.json:26 `"verify:phase-8": "tsc --noEmit && vitest run tests/core/content tests/addons tests/isolation"` — the §18 gate (spec 3612) is `tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts`. A phase that only adds memory/search/notes tests would report "green" while running zero Phase-8 tests.
**Why it happens:** The script was never re-pointed after Phase 6 (D-92 re-pointed verify:phase-6; D-103 re-pointed phase-7; phase-8 was left).
**How to avoid:** Apply D-114 — replace the script with the spec 3612 string (verbatim). Same precedent as D-92/D-103 (STATE.md:173).
**Warning signs:** `pnpm run verify:phase-8` passes before any Phase-8 test file exists.

### Pitfall 8: NoteGraph's "50-word stop-word list" is not enumerated in the spec
**What goes wrong:** Spec 3511 says "Remove fixed 50-word English stop-word list shipped inline in NoteGraph.ts" but does not enumerate the 50 words. The executor must ship exactly 50 English stop-words — a 40- or 60-word list is a spec deviation, and a fancier (lemma/pos) filter is out of scope.
**Why it happens:** The spec prescribes the count and the inline location, not the vocabulary.
**How to avoid:** Plan a task that states "exactly 50 common English stop-words (e.g. the classic 'a, an, the, and, or, ...' set), declared as a module-level array in NoteGraph.ts with a length-50 assertion" — and pin the length in a test (`expect(STOP_WORDS).toHaveLength(50)`). Mark the exact vocabulary as executor discretion bounded by the count.
**Warning signs:** A cosine test flips when an article like "the" is or isn't filtered.

### Pitfall 9: Deleting a note must demote edges, not rewrite bodies
**What goes wrong:** WIKI-ID-04 (spec 3904): deleting a note does NOT rewrite source bodies; referencing notes' dangling edges move from `links[]` back to `unresolvedLinks[]` at the next save/graph rebuild. A naive delete that rewrites sources (or a delete that leaves dangling IDs in `links[]`) breaks the atomic-note contract.
**Why it happens:** The ID-based edge model deliberately tolerates dangling edges; the demotion is a lazy reconciliation.
**How to avoid:** NoteGraph rebuild (or the save-path) computes `links[]` membership against the live note set; a note whose ID no longer exists demotes back to `unresolvedLinks[]` with the raw `[[Title]]` string. Also wire MiniSearchIndex.discard(noteId) on the delete path (D-109 "deletion removes the note's document").
**Warning signs:** BacklinksPanel shows edges to deleted notes after a delete → rebuild test.

## Code Examples

Verified patterns from official sources + the spec (all read this session):

### §3.6 Working Memory updater (Appendix O.10, spec 6596-6622 — with the Pitfall 1 redaction swap)
```typescript
// Source: PRODUCT_SPEC_v0_1.md Appendix O.10 (spec 6596-6622); redaction line adapted
// (TraceRedactor is Phase 11 — using the Phase-2 redactSensitiveValue primitive now)
import { WORKING_MEMORY_TEMPLATE, type WorkingMemory } from '@/types/harness';  // canonical home (Appendix C.1)
import { redactSensitiveValue } from '@/core/security/redactSensitive';         // TODO(Phase 11): swap to TraceRedactor

const MAX_WORKING_MEMORY_TOKENS = 300;   // §3.6: cap so it can't crowd out retrieval

export function initWorkingMemory(resourceId: string): WorkingMemory {
  return { resourceId, markdown: WORKING_MEMORY_TEMPLATE, tokens: estimate(WORKING_MEMORY_TEMPLATE), updatedAt: Date.now() };
}

export function updateWorkingMemory(cur: WorkingMemory, patch: Partial<Record<
  'Name' | 'Role / Team' | 'Environment' | 'Preferences' | 'Long-term Goals', string>>): WorkingMemory {
  let md = cur.markdown;
  for (const [field, value] of Object.entries(patch)) {
    if (!value) continue;
    const safe = String(redactSensitiveValue(value));          // §4.4 — never store secrets
    md = md.replace(new RegExp(`(- \\*\\*${field}\\*\\*:).*`), `$1 ${safe}`);
  }
  let tokens = estimate(md);
  if (tokens > MAX_WORKING_MEMORY_TOKENS) { md = truncateToTokens(md, MAX_WORKING_MEMORY_TOKENS); tokens = MAX_WORKING_MEMORY_TOKENS; }
  return { ...cur, markdown: md, tokens, updatedAt: Date.now() };     // single-writer: primary surface only (§13)
}

const estimate = (s: string) => Math.ceil(s.length / 4);
function truncateToTokens(s: string, cap: number) { return s.slice(0, cap * 4); }
```

### MiniSearch notes index construction (pattern from PageIndexBuilder.ts:145-153 + spec 1608 fields)
```typescript
// Source: adapted from src/core/extraction/PageIndexBuilder.ts:145-153 (Phase-6, verified in-repo)
// search-notes contract fields: title + content + tags + summary (PRODUCT_SPEC_v0_1.md:1608)
const index = new MiniSearch<NoteDoc>({
  fields: ['title', 'content', 'tags', 'summary'],
  storeFields: ['title', 'content', 'tags', 'summary'],
  searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.2 },
});
index.addAll(docs);                 // boot rebuild — sub-ms at 1,000 docs; addAllAsync({chunkSize}) if needed
index.upsert(doc);                  // note:saved handler (incremental — no rebuild)
index.discard(noteId);              // delete path (by-ID, lazy vacuum)
const hits = index.search(q) as unknown as NoteHit[];   // stored fields spread at runtime (Pitfall 5)
```

### Canonical Note (spec 4721-4741 verbatim — `src/types/notes.ts`)
```typescript
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
  type?: string;                 // OKF v0.2 frontmatter type (rev 2026-08-12); default 'Note'. Declared Phase 8, serialized Phase 9.
  version: number;
}
export const OKF_NOTE_DEFAULT_TYPE = 'Note';
```

### MemoryExtractor schema seam (mirrors spec 4764-4773)
```typescript
// Source: PRODUCT_SPEC_v0_1.md:4764-4773 (NoteTagResultSchema/ConfidentFact — the mirror shape D-113 references)
const ConfidentFact = z.object({ content: z.string(), confidence: z.number().min(0).max(1) });
// MemoryExtractor ships its own memoryFacts schema with this shape + a parse seam;
// the LLM call + NMEM-02 upsert wiring is Phase 9 (spec 3876).
```

### RetrievalMetadata → RetrievedMemory shape (spec 4572-4578 verbatim — `src/core/memory/types.ts`)
```typescript
export interface RetrievedMemory {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'pattern';
  tags: string[];
  score: number;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase-2 bootstrap `NotesDB.Note` (flat `source: string`, no unresolvedLinks/aiMeta/summary/type) | Canonical §21.2 `Note` at `src/types/notes.ts` (D-107/D-108) | Phase 8 | Every NotesDB consumer + fixture converges once (D-83 precedent); OKF `type?` declared-now/populated-Phase-9 |
| Phase-3 minimal `UserPreferences` (3 optional fields) | Full §3.5 shape at `src/core/memory/types.ts` (D-112) | Phase 8 | Store initial state/partialize must be updated (Pitfall 3); consumers keep resolving via re-export |
| No persona persistence (code-seeded DEFAULT_PERSONA only) | `np_persona` in PreferenceMemoryStore (RICH-R-05) | Phase 8 | RICH-R-05 lands; PersonaInjector overrides now sourced from np_persona, never the fact store (R2) |
| Phase-5 minimal `RetrievedMemory` at context/types.ts:26-32 | Canonical home `src/core/memory/types.ts` (spec 4571) | Phase 8 | context/types.ts re-exports (D-72); the `[MEMORY]` trust builder (D-94) starts receiving real data from MemoryEngine.retrieveMemoryHints() |
| Phase-6 ephemeral per-tab page index (PageIndexBuilder) | + persistent per-surface notes index (MiniSearchIndex) — two instances, never shared (spec 3774) | Phase 8 | search-notes RAG foundation (tool registration is Phase 18) |
| No memory body writer (stores write-empty) | MemoryEngine writes through MemoryDB (D-104) | Phase 8 | First writer — zero data migration; v4 IDB migration stays Phase 9 (spec 3156) |

**Deprecated/outdated:**
- `getNoteByTitle` as a resolution primitive: fine as a "first hit" helper, but NOT usable for the WIKI-ID-02 tie-break (Pitfall 4).
- The STACK.md "zod ^3.24" note: zod 4.4.3 is installed and in use (VAI-04); new zod code (MemoryExtractor schema, np_persona schema) should follow the v4 patterns already in src/core/ai.
- The current `verify:phase-8` script (Phase-6 target): replaced per D-114 (spec 3612).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact 50 English stop-words for NoteGraph (spec 3511 gives the count + inline location, not the vocabulary) are at the planner's/executor's discretion bounded to exactly 50 common English stop-words | Common Pitfalls 8 | A deviating list changes cosine rankings; pinned by a length-50 test. Low risk — any standard stop-word set satisfies "English stop-word list" |
| A2 | The `NoteDoc` field set for MiniSearchIndex (title/content/tags + summary seam) treats `tags` as a joined string and `summary` as `''` until Phase 9 populates it | Pattern 1 / D-109 | Only affects ranking; the <50 ms gate and query semantics are unchanged. The D-109 decision locks fields, so this is the field *encoding* only |
| A3 | `np_persona` payload is a JSON blob shaped `{ personaId, persona: PersonaProfile, personaOverrides? }` persisted via the chromeStorageAdapter | Pattern 2 / D-112 | §15.1 declares the key; the exact JSON shape is Phase-8 design. If a later phase expects a different shape, the adapter write converges (reversible) |
| A4 | MemoryEngine/memory stores run as per-surface singletons in UI contexts only, never the background SW | Architecture diagram | MV3 boundary (§5.2); background SW stays stateless per CLAUDE.md — no change of plan |
| A5 | `MemoryMessage.role` union is extended with `'tool'` only if Phase-8 tests need to store tool turns in MemoryDB.messages (Pitfall 2 note) | Common Pitfalls 2 | If §3.3 tool-role messages must be persisted, the union must be extended; additive + schema-flexible, so low risk |
| A6 | The np_facts metadata record shape (ids + recency + useCount, per D-104) is a Phase-8 design decision; §3.4 fields map onto it (updatedAt ↔ recency window, useCount ↔ useCountScore) | Pattern 2 | A mismatched metadata shape would force MemoryScorer to open IDB per fact — perf regression only, no correctness failure |

## Open Questions

1. **Where does the canonical §3.4 `UserMemoryFact` type live?**
   - What we know: MemoryDB.ts:37-45 declares a simplified bootstrap shape; §3.4 (spec 601-612) is the canonical shape; D-104 makes MemoryDB.userFacts the body store; Appendix C.1 maps only `WorkingMemory`→harness and `RetrievedMemory`/`UserPreferences`→core/memory/types (spec 4833-4845) — `UserMemoryFact` is unassigned.
   - What's unclear: whether `src/core/memory/types.ts` hosts it (and MemoryDB imports/re-exports per D-72) or MemoryDB.ts is edited in place.
   - Recommendation: put the canonical `UserMemoryFact` in `src/core/memory/types.ts` and have MemoryDB import it (matches the D-72/D-107 supersession precedent and keeps the memory home authoritative). This also answers the CONTEXT discretion item "whether memory/types.ts also holds local store types" — yes for the §3.4 fact shape, no for idb row schemas (those stay in the DB modules).

2. **Does the np_persona write path feed PersonaInjector in Phase 8, or is it store-only?**
   - What we know: D-112 says overrides are "now sourced from PreferenceMemoryStore/np_persona"; D-105 forbids live chat/AgentOrchestrator wiring; PersonaInjector.resolvePersona takes `prefs` as a parameter (PersonaInjector.ts:18-30) and needs no edit.
   - What's unclear: whether any Phase-8 code reads np_persona into the UserPreferences object consumers see, or whether PreferenceMemoryStore is a standalone persisted store + `buildPreferenceProfile()` producer proven by tests (the RICH-R-05 DONE-when wording).
   - Recommendation: store + producers only (PreferenceMemoryStore.hydrate/get/update + MemoryEngine.buildPreferenceProfile()); the live injection re-point is Phase 15 RICH. Mark in the plan that PersonaInjector's parameter source changes later, not now.

3. **`personaOverrides` has two homes after D-112 (legacy np_preferences + canonical np_persona) — who is authoritative?**
   - What we know: Phase-3 useUserPreferencesStore persists personaOverrides under np_preferences (UserPreferences.ts:98-102); D-112 gives PreferenceMemoryStore ownership of np_persona (PersonaProfile + personaId + personaOverrides).
   - What's unclear: whether Phase 8 migrates/redirects the np_preferences write (an edit to the Phase-3 store file — allowed since UserPreferences.ts is already being edited for the re-export) or leaves both writing independently (divergence risk).
   - Recommendation: PreferenceMemoryStore is canonical for personaOverrides; the Phase-3 store keeps persisting fastModel/balancedModel only, dropping personaOverrides from its partialize — but ONLY if the plan also verifies no existing consumer reads `useUserPreferencesStore.personaOverrides` in the live path (grep before dropping). If any live reader exists, keep both and note the Phase-15 consolidation point.

4. **Does the delete path emit an event, or does MiniSearchIndex expose a direct remove?**
   - What we know: Flow 3 (spec 1690) emits only `note:saved`; D-109 requires deletion to remove the note's document; WIKI-ID-04 demotes dangling edges at next save/rebuild.
   - What's unclear: the delete-side trigger for MiniSearchIndex.discard (a `note:deleted` event is an invention; the save-path core may not own deletion in Phase 8).
   - Recommendation: expose `MiniSearchIndex.remove(noteId)` (via `discard`) as a public API and let the note-delete caller invoke it — no new event needed. Tests exercise remove directly.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tsc/vitest runs | ✓ | v24.19.0 | — |
| pnpm | verify:phase-8 + installs | ✓ | 11.22.0 | npm (not needed — no installs) |
| minisearch | MiniSearchIndex, WikilinkAutocomplete | ✓ | 7.2.0 (installed) | — |
| idb | MemoryDB/NotesDB access | ✓ | 8.0.3 (installed) | — |
| zod | MemoryExtractor schema, np_persona validation | ✓ | 4.4.3 (installed) | — |
| fake-indexeddb | memory/notes DB tests | ✓ | installed (dev) | — |
| vitest | §18 test files + verify:phase-8 | ✓ | 4.1.11 (per VAI-04) | — |
| TraceRedactor | O.10 working-memory redaction | ✗ | — | `redactSensitiveValue` (src/core/security/redactSensitive.ts:68-71) + Phase-11 swap comment (Pitfall 1) |
| Chrome extension runtime | live E2E in a browser | ✗ (not needed) | — | Phase 8 proof is vitest-level (create-only, D-105) |

**Missing dependencies with no fallback:** none — TraceRedactor has a viable fallback (above); everything else is installed.
**Missing dependencies with fallback:** TraceRedactor (Phase 11) → redactSensitiveValue now.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in .planning/config.json — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.11 (globals enabled, jsdom) — configured in vitest.config.ts |
| Config file | vitest.config.ts (setupFiles: ./tests/setup.ts; alias `@` → src) |
| Quick run command | `pnpm test -- tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts` |
| Full suite command | `pnpm run verify:phase-8` (after D-114 re-point: `tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RICH-R-05 | Persona persists to PreferenceMemoryStore np_persona; buildPreferenceProfile includes persona overrides | unit | `pnpm test -- tests/core/memory/MemoryEngine.test.ts` | ❌ Wave 0 |
| RICH-R-05 | np_persona key written/read via chromeStorageAdapter (never MemoryDB.userFacts) | unit | `pnpm test -- tests/core/memory/UserMemoryStore.test.ts` | ❌ Wave 0 |
| DONE-when | MemoryScorer scores ∈ [0,1]; weights 0.45/0.25/0.15/0.10/0.05 | unit | `pnpm test -- tests/core/memory/MemoryScorer.test.ts` | ❌ Wave 0 |
| DONE-when | MemoryEngine returns conversation summary + recent turns; user memory top-5/top-3-tiny; MiniSearch <50 ms/1,000 notes; wikilink tie-break; Page→PageContentService→Note→MiniSearch E2E | unit/integration + perf | `pnpm test -- tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts` | ❌ Wave 0 (all 5 files + E2E + perf are new) |
| D-114 | verify:phase-8 gate runs the §18 dirs | config (manual-only) | `pnpm run verify:phase-8` | ❌ script edit |

### Sampling Rate
- **Per task commit:** `pnpm lint` (tsc --noEmit) + the specific test file touched (`pnpm test -- <file>`)
- **Per wave merge:** `pnpm test -- tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts`
- **Phase gate:** `pnpm run verify:phase-8` green (post D-114 re-point) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/memory/MemoryEngine.test.ts` — covers RICH-R-05 + DONE-when retrieval (required by §18)
- [ ] `tests/core/memory/MemoryScorer.test.ts` — scores ∈ [0,1], verbatim weights (required by §18)
- [ ] `tests/core/memory/UserMemoryStore.test.ts` — np_facts LRU ≤500, top-5/top-3, redaction (required by §18)
- [ ] `tests/core/search/MiniSearchIndex.test.ts` — lazy build, note:saved upsert, remove/discard, <50 ms/1,000-notes perf gate (required by §18)
- [ ] `tests/core/notes/LinkParser.test.ts` — parseLinks/resolveLinks tie-break, unresolvedLinks, deletion demotion (required by §18)
- [ ] E2E service-level test (PageContext → Note → NotesDB.put → index upsert → query) — DONE-when, §18 "End-to-end path works"
- [ ] DB-test conventions: reuse `(globalThis as any).__resetIndexedDB()` per-test (tests/setup.ts:9-11) + `chromeStorageMap` reset — the IndexedDBMigrator.test.ts pattern (tests/core/storage/IndexedDBMigrator.test.ts:44-48)

*(No new framework installs — vitest + fake-indexeddb present; the only infra edit is the package.json verify:phase-8 script per D-114.)*

## Security Domain

> `security_enforcement` is `true` in .planning/config.json — section included. ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth in Phase 8; provider secrets remain in encrypted np_providers, Phase 2) |
| V3 Session Management | no | — (np_jsessionid/np_sysparm_ck session keys untouched — Phase 17 territory) |
| V4 Access Control | no | — (no new permissions; permission set unchanged from Phase 1) |
| V5 Input Validation | yes | zod schemas at every cross-boundary: np_persona schema, MemoryExtractor memoryFacts schema (zod v4, in-repo pattern), LinkParser output shape; Note body is stored content, validated on write |
| V6 Cryptography | no | — (no new crypto; working memory/persona are non-secrets by design — §3.6 "must not contain secrets") |

### Known Threat Patterns for {chrome-extension + IDB + MiniSearch}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Memory injection becomes instructions (prompt injection via retrieved facts/notes) | Tampering / Elevation | The Phase-7 trust layer already tags `[MEMORY]` items trust:'retrieved', instructionAuthority:false (contextItems.ts:87-92, CTX-02) — MemoryEngine produces plain data; the trust policy governs. Never let memory content alter system prompts |
| XSS via note/wikilink content in the Phase-8 components | Tampering | The three .tsx components render data through React JSX only — no dangerouslySetInnerHTML; Phase-15 UI uses PortableMarkdown (spec §16.1) |
| Secret/customer-data leakage into memory or working block | Information Disclosure | §3.4 "never inject secrets or raw customer data"; O.10 redacts all working-memory writes (redactSensitiveValue now, TraceRedactor Phase 11); memory bodies never logged (TraceRedactor discipline §4.4) |
| Storage overflow / DoS via index rebuild | DoS | Lazy build + memoized per-surface singleton; incremental upsert (no full rebuild on save); <50 ms/1,000-notes perf gate asserted in tests; np_facts LRU ≤500 caps chrome.storage.local growth |
| Tampered IDB rows at read time | Tampering | NotesDB/MemoryDB reads are typed against the canonical schemas; cross-boundary zod validation where values cross module boundaries (np_persona hydrate path) |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: PRODUCT_SPEC_v0_1.md §3.1-3.6 (546-694), §15.1 (1939-1969), §15.3 (2005-2010), §18 Phase 8 (2656-2696), §21.2 (3287-3322), §22.3 (3506-3514), §23 ADR (3554), §24 verify gates (3600-3619), §26.5 (3765-3774), §27.7a (3899-3904), spec 4571-4596, 4720-4777, 4833-4845, 4903-4923, 6591-6622] — read this session; all discrete values quoted verbatim in this doc
- [VERIFIED: src/core/storage/MemoryDB.ts:28-69] — MemoryMessage/UserMemoryFact/ConversationSummary shapes + MemoryDBV1 store schema
- [VERIFIED: src/core/storage/NotesDB.ts:26-37, 48-59, 88-93] — bootstrap Note placeholder, byTitle/byUpdated indexes, getNoteByTitle
- [VERIFIED: src/core/storage/WriteJournal.ts:57-101, 120-162] — JournalStep/registerJournalSteps/isSupportedOperation/runJournaled
- [VERIFIED: src/types/storage.ts:46-61] — WriteJournalOperation union incl. 'evict-conversation' | 'archive-conversation' | 'compact-conversation' | 'save-note-with-links' | 'update-user-memory'
- [VERIFIED: src/core/ai/UserPreferences.ts:21-44, 66-105] — Phase-3 minimal UserPreferences + np_preferences store
- [VERIFIED: src/core/ai/persona/PersonaProfile.ts:7-40] — PersonaProfileSchema + DEFAULT_PERSONA
- [VERIFIED: src/core/ai/persona/PersonaInjector.ts:18-30] — resolvePersona reads prefs.personaOverrides
- [VERIFIED: src/core/ai/PromptCacheManager.ts:26, 160-171] + [VERIFIED: src/core/ai/AgentOrchestrator.ts:24, 74] — UserPreferences consumers
- [VERIFIED: src/core/context/ContextOptimizer.ts:45-64, 55] + [VERIFIED: src/core/context/trust/contextItems.ts:70-93] — memoryHints input + [MEMORY] trust builder
- [VERIFIED: src/core/context/types.ts:22-32] — PageContext re-export + RetrievedMemory supersession point
- [VERIFIED: src/core/extraction/PageIndexBuilder.ts:37-56, 145-153, 175-180, 211-230] — MiniSearch pattern, lazy/memoized/evict + wireEvictionHook
- [VERIFIED: src/core/events/EventBus.ts:1-54] — on/emit/off/hasListeners, string-keyed, error-swallowing emit
- [VERIFIED: src/core/security/redactSensitive.ts:20-71] — redactSensitive/redactSensitiveValue (TraceRedactor absent — verified by grep)
- [VERIFIED: src/types/harness.ts:1-102] — no WorkingMemory yet; C.1 verbatim-declaration convention
- [VERIFIED: src/core/workspace/WorkspaceStore.ts:23] + [VERIFIED: src/core/workspace/WorkspaceElection.ts:133-134] — isPrimaryWriter delegation
- [VERIFIED: src/core/context/TokenBudget.ts:44] — countTokensHeuristic
- [VERIFIED: tests/setup.ts:1-297] — fake-indexeddb/auto + __resetIndexedDB + chrome storage mocks + BroadcastChannel mock
- [VERIFIED: package.json:26, 39, 42] — verify:phase-8 mis-pointing + minisearch ^7.2.0 + idb ^8.0.3
- [VERIFIED: node_modules/minisearch/dist/es/index.d.ts:820-970, 1234] — installed 7.2.0 API (add/addAll/addAllAsync/remove/discard/has/search/Options)
- [CITED: https://lucaong.github.io/minisearch/] — official MiniSearch docs (fuzzy 0.2 = 0.2×term-length edit distance; prefix; boost; combineWith)

### Secondary (MEDIUM confidence)
- [CITED: .planning/codebase/STACK.md] — minisearch ^7 + idb v8 versions (partially stale: says zod ^3.24; actual installed zod is 4.4.3 — VAI-04 re-query)

### Tertiary (LOW confidence)
- None — every claim in this research was verified in-repo or against the official docs this session. All [ASSUMED] items are in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in node_modules + package.json this session; no new installs
- Architecture: HIGH — every integration seam (stores, journal ops, trust layer, event bus, election, redaction) read directly from source
- Pitfalls: HIGH — each pitfall backed by a verified in-repo mismatch (missing TraceRedactor, bootstrap-vs-spec shape drift, store typing, tie-break gap, gate mis-pointing)

**Research date:** 2026-09-01
**Valid until:** 2026-10-01 (30 days — stable stack: minisearch/idb/zod versions pinned by VAI-04; re-query only if a package bump is considered)