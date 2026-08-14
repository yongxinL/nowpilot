# Phase 5: Knowledge Base (Memory + MiniSearch + Notes) - Research

**Researched:** 2026-08-13
**Domain:** Persistent memory architecture (IndexedDB + MiniSearch), atomic notes + wikilinks, d3-force note graph, context injection
**Confidence:** HIGH (spec-verbatim contracts + verified existing code + verified packages)

## Summary

Phase 5 ships the persistent knowledge layer on the Phase-2 storage substrate (`NotesDB`/`MemoryDB` — types already verbatim §21.2/§21.3/§21.4) and the Phase-4 optimizer seams (`ContextOptimizerInput.memoryHints`/`preferences` already exist; `ContextPackInput.preferencesText`/`memoryText` slots exist but are **never populated** by `buildPackInput` — Phase 5 makes both sections real). Three workstreams: **(1) MemoryEngine** — the single orchestrator over Conversation/User/PreferenceMemoryStore + MemoryScorer with budget enforcement (top-5 / top-3 tiny / ≤1000 tokens, scores in [0,1], working memory ≤300 tokens injected before facts); **(2) MiniSearchIndex** — the persistent in-memory notes index over title+content+tags+summary, pattern-matched from the existing Phase-4a `PageIndexBuilder` (verified minisearch 7.2.0 API), distinct instance from the ephemeral page index; **(3) Notes core + UI** — `LinkParser`/`NoteGraph` (pure, deterministic; tie-break exact title → updated desc → id asc), the save pipeline `parseLinks → resolveLinks → NotesDB.put → EventBus note:saved`, and the real Notes workspace replacing the E5 placeholder (`NotesPage.tsx`).

The critical architectural finding: **the optimizer is pure/synchronous (zero chrome, zero async, zero Date.now), so all IndexedDB-bound memory work must happen in the hook** (the same "hook resolves inputs, optimizer packs" split as the 04b trust stage, Pitfall 5). `MemoryEngine.assemble()` is the core builder the hook calls (Golden Rule 3); it produces the `RetrievedMemory[]` + working-memory block + compact-JSON preferences that flow through `ContextOptimizerInput`, and the optimizer's `buildPackInput` gains the threading that populates the currently-dead `preferences`/`memory` PromptSection slots. `reduceMemoryTopK` (currently a structural no-op) becomes real.

Four implementation-time landmines the planner MUST decide (details in Open Questions): (a) `np_persona` currently stores a `PersonaProfile` (Phase-3 schema) while `PreferenceMemoryStore` wants `UserPreferences` — a dual-shape compat shim is required to avoid a Phase-3 regression; (b) `MemoryDB.userFacts` is typed as the §21.4 `Fact` shape but spec §15.1 names it `UserMemoryFact[]` (§3.4, richer shape) — a v1→v2 migration or shape decision is required; (c) `np_conversation_meta` is NOT registered in `Setting.ts` (Pitfall 4 — unregistered key silently falls back) and the `ConversationMeta` type does not exist in code; (d) `PortableMarkdown` has **no wikilink props today** (the CONTEXT claims "wikilink styling hooks" — the code shows none) so the Notes preview needs a wikilink-aware extension.

**Primary recommendation:** Follow the spec-verbatim create list exactly (R-1), pattern-match the store/accessor/test conventions from NotesDB/MemoryDB/personaConfig/PageIndexBuilder, keep MemoryEngine + LinkParser + NoteGraph + MemoryScorer pure/deterministic (injectable clock), do all IndexedDB + chrome-boundary work in the hook, and add `pnpm add d3-force@^3` as an explicit early plan task (not installed as of 2026-08-13).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-05-01 [store paths verbatim]:** The six memory modules land at the §18/§8.5 paths (`src/core/memory/{MemoryEngine,ConversationMemoryStore,UserMemoryStore,PreferenceMemoryStore,MemoryScorer,MemoryExtractor}.ts`). R-1 — no invented paths. `RetrievedMemory`/`UserPreferences` stay in `src/core/memory/types.ts` (C.1 home, already seeded in Phase 3); the stores import (never re-declare) them.
- **D-05-02 [MemoryEngine = single orchestrator]:** `MemoryEngine` is the ONLY entry point surfaces use for memory read/write (§3.2). It owns: store dispatch, scoring (via MemoryScorer), summarisation (via the existing 12-message compactor rules §15.3), budget enforcement, and injection assembly. Surfaces never talk to the individual stores directly. Single-writer on the primary surface (§13), cross-surface via BroadcastBus primary election (§17.6/§20.10, Standalone tie-break).
- **D-05-03 [ConversationMemoryStore]:** Per-conversation rolling summary + recent turns (§3.3, `ConversationMemory` shape). Rules: last-2 turns tiny / 4 small / 6 medium-large; summarise older after every 12 messages; message bodies in IndexedDB only (reuse `MemoryDB` `MemoryMessage` row — already `conversationId+seq` keyed, Phase 2). LRU per §15.3 (10 active / 100 archived, archive after 30 min idle, evict via `evict-conversation` WriteJournal op).
- **D-05-04 [UserMemoryStore]:** Cross-session fact/preference/pattern memory (§3.4 `UserMemoryFact` shape: id/content/type/tags/confidence/source/createdAt/updatedAt/lastUsedAt/useCount). Working memory (Appendix O.10 block, ≤ 300 tokens) lives here as `source: 'inferred'` (D-05-09). Write paths never throw (PATTERNS Shared Pattern 1); every catch calls debugLog with a canonical code (GR-9).
- **D-05-05 [MemoryScorer = §3.4 verbatim weights]:** `score = keywordScore*0.45 + tagScore*0.25 + recencyScore*0.15 + useCountScore*0.10 + confidenceScore*0.05`, every sub-score normalised to [0,1] (keyword = matched/total query terms; tag = matched/max(1,tags); recency = clamp(1 − (now−updatedAt)/(30d),0,1); useCount = min(1,count/20); confidence passes through). Deterministic + pure (injectable clock for recency tests, Pitfall 6 precedent).
- **D-05-06 [injection budget]:** top-5 memories maximum, top-3 in tiny mode, total memory injection ≤ 1000 tokens (Golden Rule 6, §3.4). Never inject secrets or raw customer data (R-10 redaction precedent). Degrade per §2.4 — never truncate mid-structure.
- **D-05-07 [injection seam]:** Retrieved memory travels through the existing `ContextOptimizerInput.memoryHints: RetrievedMemory[]` (type already in `src/core/ai/types.ts`). The hook calls a core builder (Golden Rule 3); no prompt assembly in `useStreamingLLM.ts`. `MemoryEngine` produces `RetrievedMemory[]` (id/content/type/tags/score) with scores in [0,1].
- **D-05-08 [preference injection = compact JSON]:** `PreferenceMemoryStore` injects `UserPreferences` as compact JSON (incl. `personaId`/`personaOverrides`), not verbose prose (§3.5). This is what the optimizer's stable `preferences` PromptSection (Phase 4) already consumes — Phase 5 feeds it real data.
- **D-05-09 [working memory block]:** The always-on Markdown profile (§3.6, fixed template, ≤ 300 tokens, injected with the memory section BEFORE retrieved facts so it can never crowd them out) lives in `UserMemoryStore` as `source: 'inferred'`. Never blurs into persona (R2).
- **D-05-10 [MemoryExtractor = LLM stage, save-time non-blocking]:** `MemoryExtractor` (haiku tier) extracts durable facts/preferences/patterns from conversation. Runs on the primary surface only, non-blocking after the IndexedDB write (never blocks a save — Phase-5a NoteTagger precedent, §22.1 "save never waits"). Routes through PersonaInjector like every other AI stage (GR-3); the schema is the existing memoryExtractor stage schema (Phase 3 seeded the inject() across all 4 stages incl. memoryExtractor, D-11).
- **D-05-11 [persistent notes index]:** `MiniSearchIndex` = the PERSISTENT notes index (§26.5/§27) over Note `title + content + tags + summary` (+ categoryPath when 5a populates it). Distinct instance from the ephemeral page index (§26); never shares storage. `minisearch ^7`, `search` tool mapping: `{query, limit}` (spec §9.8 search-notes) → scores in [0,1].
- **D-05-12 [index lifecycle]:** Index built/rebuilt from `NotesDB` on demand (Standalone Notes view mount), kept in memory (MiniSearch is in-memory by design). Incremental add/remove on note CRUD; no durable index store in 5 (persistence = NotesDB; rebuild is cheap at ≤ 5,000 notes). < 50 ms over 1,000 notes (SC#3).
- **D-05-13 [Page → Note → MiniSearch path]:** SC#5 is satisfied when a captured page (`PageContentService` → `PageContext`, Phase 4a) can be saved as a note (`source.kind: 'page-export'`, already in the `Note` type) and that note is searchable via the persistent notes index. The save-to-note affordance itself is a plain manual "New note from page" — the LLM-drafted SaveToNoteDialog is Phase 5a (LLM-WIKI-07). No LLM involved in the 5 core path.
- **D-05-14 [wikilink tie-break, verbatim]:** `LinkParser.parseLinks()` extracts raw `[[Title]]` targets from the markdown body (inline `[[…]]`). `resolveLinks()` maps each to a note ID via the resolution order (exact title match → `updated` desc → `id` asc, WIKI-ID-02). Resolved targets → `links[]` (IDs); original display text preserved inline; unresolved → `unresolvedLinks[]` (raw strings, rendered muted/dashed + "create note" affordance, WIKI-ID-03). On save, a bounded save-time reconciliation promotes matching `unresolvedLinks[]` → `links[]` when a new note's title matches (MiniSearch title lookup, primary surface only, never blocks save).
- **D-05-15 [notes store CRUD]:** Create/edit/save/delete through `NotesDB` (already Phase-2, `Note` + `Concept` verbatim §21.2). Note `id` = `crypto.randomUUID()` immutable (WIKI-ID-01); `title` mutable display text. Save pipeline: parseLinks → resolveLinks → NotesDB.put → EventBus `note:saved` (§20.11 Flow 3). Write paths never throw; GR-9 codes.
- **D-05-16 [editor UX]:** Real Notes page replaces the E5 placeholder. Standalone Notes view = list + editor (§21.2 col 3: title + star, body via `PortableMarkdown` — already Phase 1, wikilink + unresolved-link styling, tag chips). `WikilinkAutocomplete` (≤ 50 ms p95 ≤ 5,000 notes) offers existing titles as the user types `[[`; LLM-wikilink *suggestions* are NOT in v0.1 (D-04) — MiniSearch title matching is sufficient.
- **D-05-17 [note graph + backlinks]:** `NoteGraphView` (d3-force ^3, approved) renders notes + `links[]` edges; `BacklinksPanel` lists in-links per note. Empty states per UI-SPEC §21.2/§26 (e.g. "Create at least 3 notes to see the graph"). Node click → open note. Graph is derived (no separate graph store) — NoteGraph computes edges from `links[]`/backlink indices on demand.
- **D-05-18 [np_persona writer moves to PreferenceMemoryStore]:** Phase 3 shipped `personaConfig.ts` (D-09) as a READ-ONLY Setting accessor for `np_persona`. Phase 5's `PreferenceMemoryStore` becomes the WRITER (R2, §3.5, RICH-R-05) — persona is user config, never a fact. Keep the Phase-3 accessor working (read path unchanged) or re-route reads to the store; no behavior regression on the Phase-3 persona pipeline (PersonaInjector reads resolvePersona → readPersona/readPersonaPrefs). `UserPreferences.personaId`/`personaOverrides` stay the injected compact-JSON shape.
- **D-05-19 [verify:phase-5 gate]:** spec line 3685 = `tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts`. Follow the §24 chain template consistent with prior phases (eslint + prettier + tsc + wxt build + vitest run) in `package.json`.

### the agent's Discretion
- Exact MemoryEngine public API surface (assemble/inject/update/subscribe) — single-entry orchestration, keep it minimal and pure.
- Exact store hydration + memory section assembly mechanics inside ContextOptimizer/ContextPack (`memoryHints` → `memory`/`preferences` sections).
- Exact MiniSearch field weights / `prefix`/`fuzzy` options for title+content+tags+summary.
- Exact NoteGraph d3-force layout params + node/edge styling (dark/light theme tokens).
- Exact working-memory Markdown template (Appendix O.10 fixed template, ≤ 300 tokens).
- Exact `verify:phase-5` script shape (follow the §24 chain + spec line 3685).
- Whether the Phase-5 save-to-note entry point lives in the Notes page toolbar, the page feed, or both.

### Deferred Ideas (OUT OF SCOPE)
- **LLM-Wiki enrichment** (NoteTagger auto-tags/category/summary + accept/reject, NoteQA "Ask notes" RAG, NoteChatConverter chat/page→note, NoteMaintenance orphan/staleness) — Phase 5a (LLM-WIKI-01..10, CAT-01..05).
- **Filesystem sync** (one-way .md export, restore-from-folder, delete-on-sync, external-change guard) — Phase 5a (SYNC-01..11).
- **Memory governance** (cap/decay/privacy-preserving compression, conflict precedence, view/edit/pin/forget/disable/export with provenance) — Phase 5b (MEM-01..03).
- **Durable memory indexing / vector or embedding-based retrieval** — deferred per §3.2/§26.5 (MiniSearch is sufficient for v0.1).
- **LLM wikilink autocomplete suggestions** (D-04, §27.1) — not in v0.1; manual `[[` autocomplete ships in Phase 5.
- **Prompt Inspector / durable context receipts** — Phase 6 (telemetry AITransactionLog), from the 04b receipt data.
- **Tool registration for `search-notes`** — the MiniSearchIndex powers it (D-05-11); the ExecutorService tool registration is Phase 8's ToolCapabilityManifest suite.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KNW-01 | Atomic note-taking: create, edit, save, delete notes with wikilinks ([[…]]) | `LinkParser` (parse/resolve/tie-break, WIKI-ID-02), `NotesDB` CRUD (verified verbatim), save pipeline parseLinks → resolveLinks → NotesDB.put → `note:saved` (§20.11 Flow 3), immutable UUID ids (WIKI-ID-01), deletion → dangling-edge reconciliation (WIKI-ID-04) |
| KNW-02 | Note graph (d3-force) + backlinks in Standalone Notes view | `NoteGraph` derived edges from `links[]` + backlink index (D-05-17), `NoteGraphView` (d3-force ^3 — must install), `BacklinksPanel`; UI-SPEC E5/E6 states + click-to-open contract |
| KNW-03 | MiniSearch indexes notes for full-text search | `MiniSearchIndex` over title+content+tags+summary (D-05-11/12), pattern-matched from verified `PageIndexBuilder` (minisearch 7.2.0 API), < 50 ms/1,000 notes (SC#3), distinct from page index (§26.5) |
| KNW-04 | MemoryEngine stores conversation, user, and preference memory with budget enforcement | MemoryEngine + Conversation/User/PreferenceMemoryStore + MemoryScorer (§3.1–§3.6, §15.3 LRU), `RetrievedMemory`/`UserPreferences` C.1 homes verified; `np_conversation_meta`/`np_persona` keys (Setting.ts registration gap found) |
| KNW-05 | Memory injection ≤ 1000 tokens / top-5; working memory ≤ 300 tokens | `ContextOptimizerInput.memoryHints` + `preferences` seams verified; `ContextPackInput.preferencesText`/`memoryText` slots verified dead (must thread); `reduceMemoryTopK` no-op verified (must realize); §3.6 working-memory block in UserMemoryStore (D-05-09) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Memory persistence (conversation/user/preference stores) | Core data layer (`src/core/memory/*` + NotesDB/MemoryDB) | Browser (IndexedDB via idb) | Stores are the single writers; surfaces never talk to stores directly (D-05-02). MemoryMessage bodies in MemoryDB only (§3.3, §15.1) |
| Memory scoring + budget enforcement + injection assembly | Core logic (MemoryEngine + MemoryScorer) | — | Deterministic, pure, injectable clock (D-05-05); surfaces consume assembled output only |
| Memory section packing (`memoryHints` → `memory`/`preferences` PromptSections) | Core context (ContextOptimizer/ContextPack) | — | Optimizer stays pure/zero-async (Pitfall 5); the hook resolves chrome-bound inputs, the optimizer packs |
| Full-text note search | Core (`MiniSearchIndex`) | Browser (in-memory index rebuilt from NotesDB) | Index is in-memory by design (D-05-12); NotesDB is the durable source; UI search field is a filter surface, the §9.8 tool comes Phase 8 |
| Wikilink parsing + graph derivation | Core (`LinkParser`/`NoteGraph`) | — | Pure functions (tie-break, cosine §22.3); UI consumes derived data only (D-05-17 no graph store) |
| Notes UI (list + editor + graph + backlinks + search + autocomplete) | Browser/React (NotesPage + `src/components/notes/*`) | Core (via NotesDB, MiniSearchIndex, NoteGraph) | UI = presentation + state; all logic lives in core modules (GR-3; R-3 Standalone-only) |
| Preference/persona config storage | Core (PreferenceMemoryStore, `np_persona`) | — | User config, never a fact (R-7/R2, §3.5); Phase-3 read path must keep working (D-05-18) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| minisearch | ^7.2.0 (installed) | Persistent notes index + WikilinkAutocomplete title matching | Approved stack (AGENTS.md §7, spec §3.2/§26.5); [VERIFIED: npm registry — legacy check OK, 2M weekly downloads, lucaong/minisearch]; installed + verified against `node_modules/minisearch/dist/es/index.d.ts` |
| d3-force | ^3 (NOT installed — must `pnpm add d3-force@^3`) | NoteGraphView force layout | Approved stack (AGENTS.md); [VERIFIED: npm registry — legacy check OK, 19.9M weekly downloads, d3/d3-force]; [CITED: d3js.org/d3-force — forceSimulation/forceLink/forceManyBody/forceCenter API]; Standalone-bundle only (R-3) |
| idb | ^8 (installed) | NotesDB/MemoryDB substrate | Phase-2 verbatim; stores already ship `Note`/`MemoryMessage`/`Fact`/`ConversationSummary` shapes |
| zod | ^3 (installed) | Boundary gates (GR-4): UserPreferencesSchema, MemoryExtractorResultSchema, Note boundary schema | Existing ProviderConfigSchema/TrustPrefsSchema precedent |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| antd | 6.5.3 (installed) | Card, List, Input/TextArea, Tag, Segmented, Popconfirm, Tooltip, Skeleton, Empty, Space, Divider, Flex, Badge, Button (exports verified in UI-SPEC) | All Notes UI per UI-SPEC design contract |
| @ant-design/icons | 6.3.2 (installed) | PlusOutlined, SearchOutlined, StarOutlined/Filled, DeleteOutlined, MoreOutlined, etc. (canonical map in UI-SPEC) | Icon-only controls carry aria-label + Tooltip |
| @ant-design/x-markdown | 2.9.0 via PortableMarkdown | Body renderer (the ONLY markdown renderer) | Preview mode; wikilink handling must be EXTENDED (see Open Q4) |
| @/core/context/TokenBudget `estimateTokens` | — | The ONLY token counter (Pitfall 1/A4) | Memory budget enforcement + section tokens |
| @/core/security/TraceRedactor | — | R-10 redaction on working-memory writes (O.10) and any memory/log path | Working memory updater (Appendix O.10 verbatim) |

### Alternatives Considered
| Instead of | Could Use | Why the Standard Wins |
|------------|-----------|----------------------|
| In-memory MiniSearch rebuild | Durable index store in IndexedDB | D-05-12 locked: persistence = NotesDB; rebuild is cheap at ≤ 5,000 notes; MiniSearch is in-memory by design |
| Embeddings/vector retrieval | — | Deferred per §3.2/§26.5 (R-9 — never in v0.1) |
| LangChain/LlamaIndex/MemGPT | — | Explicitly banned §3.2 |
| Hand-rolled inverted index / link resolution | MiniSearch + LinkParser | MiniSearch is approved stack; LinkParser is spec-verbatim (WIKI-ID-02) |

**Installation:**
```bash
pnpm add d3-force@^3
```
*(minisearch ^7.2.0, antd, icons, x-markdown already installed — no other new packages)*

**Version verification:** minisearch 7.2.0 verified in `node_modules` (2026-08-13); d3-force NOT in node_modules (verified) — the only install task; antd 6.5.3 / icons 6.3.2 / x-markdown 2.9.0 verified in node_modules.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| minisearch | npm | ~7 yrs (7.2.0, 2025-09 pub) | 2.0M/wk | github.com/lucaong/minisearch | OK | Approved — already installed, approved stack |
| d3-force | npm | ~5 yrs (3.0.0) | 19.9M/wk | github.com/d3/d3-force | OK | Approved — planner task: `pnpm add d3-force@^3` (UI-SPEC flagged it as the only missing install) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Both names come from the user-approved AGENTS.md Approved Stack (not WebSearch/training discovery), confirmed on the npm registry, and passed the `package-legitimacy check` with OK verdicts + no postinstall scripts.*

## Architecture Patterns

### System Architecture Diagram

```
                        ┌────────────────────────────────────────────────────┐
                        │                    SURFACES                        │
                        │  Side Panel / Standalone (R-3: NEVER background SW) │
                        └────────────────────────────────────────────────────┘
                                          │
         useStreamingLLM.send() (hook — chrome-boundary resolver, GR-3 data only)
                                          │
              ┌───────────────────────────┼───────────────────────────────┐
              │                           │                               │
   ┌──────────▼──────────┐   ┌───────────▼────────────┐   ┌──────────────▼─────────────┐
   │ MemoryEngine.assemble│   │ readPersonaPrefs /     │   │ NotesPage (Notes workspace) │
   │ ({query, convId,     │   │ PreferenceMemoryStore  │   │ list+editor+search+graph+   │
   │  tier, trustPrefs})  │   │ → UserPreferences      │   │ backlinks (Standalone only) │
   └──────────┬──────────┘   └───────────┬────────────┘   └──────────────┬─────────────┘
              │  RetrievedMemory[]        │ compact JSON                   │ NotesDB CRUD
              │  (top-5/top-3 tiny,       │ (personaId + overrides)        ▼
              │   ≤1000 tokens,           │                        ┌──────────────┐
              │   working mem first)      ▼                        │  NotesDB     │
              │                   ┌───────────────┐                │  (idb, §21.2)│
              └──────────────────▶│ContextOptimizer│◀──────────────┼──────────────┤
                                 │ optimize()     │                └──────┬───────┘
                                 │ (PURE — no     │                       │ EventBus
                                 │  chrome/async/ │      note:saved ┌──────▼───────┐
                                 │  Date.now)     │◀───────────────┤ Save pipeline│
                                 └──────┬────────┘                 │ parseLinks → │
                                        │ memory + preferences     │ resolveLinks │
                                        │ sections (REAL in P5)    │ → put → emit │
                                        ▼                          └──────────────┘
                              ┌────────────────────┐        ┌───────────────┐  ┌──────────────┐
                              │  ContextOptimizer  │        │ MiniSearchIndex│  │  NoteGraph   │
                              │  Input             │        │ (in-memory,   │  │ (derived     │
                              │  memoryHints +     │        │  rebuild on   │  │  edges from  │
                              │  preferences       │        │  mount, incr. │  │  links[] +   │
                              └────────────────────┘        │  add/remove)  │  │  backlinks)  │
                                                            └───────────────┘  └──────────────┘
                                                              ▲        ▲             ▲
                                            MemoryEngine: Conversation/User/Preference stores (idb + chrome.storage)
                                            MemoryDB (messages/conversationSummaries/userFacts) · np_conversation_meta · np_persona
```

**Primary use case trace (memory):** `send(userInput)` → hook awaits `MemoryEngine.assemble({query, conversationId, tier})` (reads MemoryDB + np_persona, scores via MemoryScorer, enforces budgets) → hook passes `memoryHints` + `preferences` into `optimize()` → `buildPackInput` threads `memoryText`/`preferencesText` → `ContextPack` emits stable `preferences`/`memory` PromptSections (§1.3 canonical order) → `runAgentTurn` streams renderer output.

**Primary use case trace (notes):** Save click → `parseLinks(body)` → `resolveLinks(titles, notes)` (tie-break, <20 ms) → `NotesDB.put(note)` → `EventBus.emit('note:saved', {noteId})` → MiniSearchIndex.add + NoteGraph/backlinks re-derivation. Search field → `MiniSearchIndex.search(query, {limit})` → filtered list. Graph view → `NoteGraph.edges(notes)` → d3-force SVG.

### Recommended Project Structure
```
src/
├── core/
│   ├── memory/                      # D-05-01 verbatim paths (R-1)
│   │   ├── types.ts                 # EXISTING C.1 home (RetrievedMemory/UserPreferences) + NEW: UserMemoryFact, ConversationMemory, ConversationMeta (§21.3), MemoryInjection
│   │   ├── MemoryEngine.ts          # single orchestrator (assemble/recordTurn/summariseIfNeeded/updateWorkingMemory)
│   │   ├── ConversationMemoryStore.ts  # MemoryDB messages + conversationSummaries + np_conversation_meta LRU
│   │   ├── UserMemoryStore.ts       # MemoryDB.userFacts (UserMemoryFact) + working memory (§3.6, O.10)
│   │   ├── PreferenceMemoryStore.ts # np_persona WRITER (UserPreferences, Zod-gated)
│   │   ├── MemoryScorer.ts          # §3.4 verbatim weights, injectable clock
│   │   └── MemoryExtractor.ts       # haiku-tier LLM stage via PersonaInjector + requestJson
│   ├── search/
│   │   └── MiniSearchIndex.ts       # persistent notes index (pattern: PageIndexBuilder)
│   ├── notes/
│   │   ├── LinkParser.ts            # parseLinks/resolveLinks/unresolved reconciliation (pure)
│   │   └── NoteGraph.ts             # edges/backlink index/topKSimilar (§22.3) (pure)
│   └── context/
│       ├── ContextOptimizer.ts      # MODIFY: thread memoryHints→memoryText, preferences→preferencesText; realize reduce-topk
│       └── ContextPack.ts           # slots exist — no change needed beyond callers
├── components/
│   ├── notes/                       # §18 create list (core logic)
│   │   ├── BacklinksPanel.tsx
│   │   ├── WikilinkAutocomplete.tsx
│   │   └── NoteGraphView.tsx
│   ├── pages/NotesPage.tsx          # REPLACE E5 placeholder (real workspace)
│   └── core/PortableMarkdown.tsx    # EXTEND: optional wikilink resolver (Open Q4)
└── types/harness.ts                 # ADD: WorkingMemory + WORKING_MEMORY_TEMPLATE (C.1 home per Appendix O.10 import)
```

### Pattern 1: MiniSearchIndex — persistent notes index (pattern-matched from verified PageIndexBuilder)

**What:** The persistent notes MiniSearch instance over `title + content + tags + summary`. Distinct instance from the ephemeral page index (§26.5 note — never shares storage). In-memory only; rebuilt from NotesDB on Notes-view mount; incremental `add`/`remove` on CRUD (D-05-12).

**When to use:** Every note search path — the Notes search field, WikilinkAutocomplete title matching, and (Phase 8) the `search-notes` tool.

**Example (API verified against minisearch 7.2.0 `index.d.ts` + existing `src/core/extraction/PageIndexBuilder.ts` L132–139):**
```typescript
// src/core/search/MiniSearchIndex.ts — mirrors buildPageIndex (PageIndexBuilder)
import MiniSearch from 'minisearch';
import type { Note } from '@/core/storage/NotesDB';

export interface NoteSearchDoc {
  id: string;          // note.id (immutable UUID, WIKI-ID-01)
  title: string;
  content: string;
  tags: string[];      // indexed as a single text field per MiniSearch array semantics
  summary?: string;
  categoryPath?: string; // populated by 5a — field included now (D-05-11)
}

export function buildNotesIndex(notes: Note[]): MiniSearch<NoteSearchDoc> {
  const mini = new MiniSearch<NoteSearchDoc>({
    fields: ['title', 'content', 'tags', 'summary', 'categoryPath'],
    storeFields: ['title', 'content', 'tags', 'summary'],
    idField: 'id',
  });
  mini.addAll(notes.map((n) => ({
    id: n.id, title: n.title, content: n.content, tags: n.tags,
    summary: n.summary, categoryPath: n.categoryPath,
  })));
  return mini;
}
// search: mini.search(query, { prefix: true, fuzzy: 0.2, boost: { title: 2, tags: 1.5 }, limit })
```
**Scoring note (Assumption A1):** MiniSearch v7 result scores are unbounded BM25-style (verified `SearchResult` = `{ id, score, match, terms }` — no [0,1] guarantee). D-05-11 requires scores in [0,1] for the tool seam — the index must normalize (e.g. divide by the top result score) before returning. UI ranking is unaffected.

### Pattern 2: MemoryScorer — §3.4 verbatim weights, pure + injectable clock

**What:** Deterministic scoring with the locked weights (D-05-05). Injectable `nowMs` for recency (precedent: `contextFeed.freshnessFrom(extractedAt, nowMs?)` L40–43 and 03a `buildOutcome` injectable clock — Pitfall 6).

**When to use:** Every retrieval in UserMemoryStore (and conversation-memory relevance, if scored).

**Example (source: PRODUCT_SPEC §3.4 L605–618 verbatim):**
```typescript
export function scoreMemoryFact(
  fact: UserMemoryFact,
  queryTerms: string[],
  nowMs: number, // injectable — production Date.now(), tests a fixed instant
): number {
  const keywordScore = queryTerms.filter((t) => fact.content.toLowerCase().includes(t.toLowerCase())).length
    / Math.max(1, queryTerms.length);
  const tagScore = fact.tags.filter((t) => queryTerms.includes(t.toLowerCase())).length
    / Math.max(1, fact.tags.length);
  const recencyScore = Math.min(1, Math.max(0, 1 - (nowMs - fact.updatedAt) / (30 * 86_400_000)));
  const useCountScore = Math.min(1, fact.useCount / 20);
  return keywordScore * 0.45 + tagScore * 0.25 + recencyScore * 0.15
    + useCountScore * 0.10 + fact.confidence * 0.05;
}
```

### Pattern 3: MemoryEngine — single orchestrator + hook-side injection assembly

**What:** `MemoryEngine` is the ONLY surface entry for memory (D-05-02). Recommended minimal pure-surface API (planner discretion): `assemble()`, `recordTurn()`, `summariseIfNeeded()`, `updateWorkingMemory()`, `subscribe()`. `assemble()` reads stores → scores → enforces budgets → returns a plain `MemoryInjection` DTO; the hook passes `memoryHints`/`preferences` into `optimize()` (the optimizer stays pure — Pitfall 5).

**When to use:** Every memory read/write from surfaces. Never bypassed (R-4: no store access leaks into surfaces).

**Example (recommended shape — planner discretion D-05-02):**
```typescript
export interface MemoryInjection {
  memories: RetrievedMemory[];          // top-5 (top-3 tiny), scores [0,1], ≤1000 tokens total
  workingMemoryBlock: string;           // ≤300 tokens, injected BEFORE facts (D-05-09)
  preferences: UserPreferences;         // compact JSON source for the preferences section (D-05-08)
}
// hook (useStreamingLLM.ts) — GR-3: data only, no prompt assembly:
// const injection = await memoryEngine.assemble({ query: trimmed, conversationId, tier: plannerCtx.tier, trustPrefs });
// optimizerBase = { ..., memoryHints: injection.memories, preferences: injection.preferences, ... }
```

### Pattern 4: LinkParser — wikilink tie-break + unresolved reconciliation (WIKI-ID-02/03)

**What:** Pure functions: `parseLinks(markdown) → string[]` (raw `[[Title]]` targets), `resolveLinks(targets, notes) → { links: string[], unresolvedLinks: string[] }` with the verbatim tie-break (exact title → `updated` desc → `id` asc, <20 ms §22.1). Save-time reconciliation promotes matching `unresolvedLinks[]` when a new note's title matches (bounded MiniSearch title lookup, primary surface only, never blocks save).

**When to use:** Every note save + note-graph edge derivation. **Anti-pattern:** resolving at render time instead of save time — `links[]`/`unresolvedLinks[]` are stored fields, not derived-on-read (WIKI-ID-02).

### Pattern 5: Stores — non-throwing write paths + GR-9 (NotesDB/MemoryDB precedent)

**What:** All three memory stores follow the NotesDB.ts convention exactly: idb strict typing, `try/catch` with `debugLog(ERROR_CODES.STORE_READ|STORE_WRITE, ...)`, write paths never throw, empty-array fallbacks on read failure.

**When to use:** ConversationMemoryStore (MemoryDB messages + conversationSummaries + np_conversation_meta), UserMemoryStore (MemoryDB.userFacts + working memory), PreferenceMemoryStore (np_persona via Setting.ts — read path stays, write path added).

### Anti-Patterns to Avoid
- **Prompt assembly in the hook:** GR-3 — `useStreamingLLM.ts` must call a core builder (`MemoryEngine.assemble`), never build the memory text itself. The optimizer SELECTS/threads sections; `PROMPTS` constants live in `src/core/prompts/index.ts`.
- **Truncating mid-structure on budget:** D-05-06/§2.4 — memory degradation is whole-item drops (top-5 → top-3 → empty), never a substring slice of a fact's content (D-04-13 no-slice gate).
- **Storing memory bodies in chrome.storage.local:** §15.1/§0.2 Pitfall 4 — message bodies live in MemoryDB IndexedDB only.
- **Graph store / runtime recompute of links:** D-05-17 — NoteGraph derives on demand from stored `links[]`; never a separate graph table, never parse-at-render.
- **Second source of truth for persona:** R-7/R2 — persona is `np_persona` in PreferenceMemoryStore; never a UserMemoryFact.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text search over notes | Hand-rolled inverted index / regex scan | minisearch ^7 | Approved stack (§3.2/§26.5, R-9); prefix/fuzzy/boost built in; PageIndexBuilder precedent |
| Force-directed graph layout | Hand-rolled physics/simulation | d3-force ^3 | Approved stack; velocity-Verlet simulation + link/many-body/center forces (CITED: d3js.org/d3-force) |
| Atomic-note storage + wikilink columns | New storage layer | NotesDB (Phase 2, verbatim §21.2) | Note/Concept types + by-updated/by-tags indexes + getNoteByTitle already ship |
| Memory message/fact persistence | New IndexedDB DB | MemoryDB (Phase 2, verbatim §21.3/§21.4) | messages `[conversationId, seq]` composite key + conversationSummaries already ship |
| Token counting | A hand-rolled counter | `estimateTokens` (TokenBudget) | The ONLY token counter (Pitfall 1/A4) — memory budget + sections must share it |
| LLM structured output | Hand-parsed JSON | `requestJson` (Appendix L) + Zod | GR-4: Zod + exactly one repair, then STRUCTURED_OUTPUT_FAILED |
| Secret redaction in memory | Hand-rolled scrubbing | TraceRedactor (O.13) | Working-memory updater redacts on write (O.10 verbatim); R-10 |
| Anthropic cache-prefix flags | Hand-authored flags | ContextPack stability flags (system/tool_schemas/preferences/memory = stable:true) | Wrong flag kills prompt caching (F-5/P4-8); memory section rides the stable flag |

**Key insight:** Every "knowledge layer" primitive in this phase already has an approved-stack or Phase-2/4a implementation to pattern-match. The genuinely new engineering is the *orchestration* (MemoryEngine budgets, hook wiring, optimizer threading) and the *pure logic* (LinkParser tie-break, MemoryScorer weights, NoteGraph derivation) — not infrastructure.

## Runtime State Inventory

> Included because D-05-18 (np_persona writer migration) and the MemoryDB.userFacts shape question touch EXISTING stored data. Greenfield modules (memory/search/notes paths, notes UI) have no runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **`np_persona` (chrome.storage.local):** existing installs may hold a Phase-3 `PersonaProfile`-shaped value (PersonaProfileSchema-gated). PreferenceMemoryStore wants `UserPreferences`-shaped values. | Dual-shape compat shim in the read path (accept legacy PersonaProfile → convert to UserPreferences) or a migration on first read. Code edit + no destructive migration. |
| Stored data | **`MemoryDB.userFacts` (IndexedDB):** existing rows are §21.4 `Fact`-shaped (`{id, content, confidence, source, created}`). UserMemoryStore needs §3.4 `UserMemoryFact` (adds type/tags/updatedAt/lastUsedAt/useCount; source union differs). Spec §15.1 names `userFacts UserMemoryFact[]` — the CODE deviates from the spec. | Data migration: MemoryDB v1→v2 via `runMigrations` (IndexedDBMigrator D-14 registry — no store currently uses it) with default-fill for new fields, OR keep `Fact` and map in-memory (loses persistence of type/tags/useCount — NOT recommended). Planner decision (Open Q2). |
| Live service config | None — no n8n/Datadog-style external config | None |
| OS-registered state | None — no systemd/pm2/Task Scheduler registrations | None |
| Secrets/env vars | **No new keys:** `np_persona` already registered `area:'local'` (Setting.ts L67). **Gap:** `np_conversation_meta` (§15.1) is NOT registered — `settingRead` silently falls back (Pitfall 4). | Register `np_conversation_meta: { area: 'local' }` in Setting.ts + add `ConversationMeta` type (§21.3 — not in code yet) to `src/core/memory/types.ts`. |
| Build artifacts | None — d3-force not yet installed (no stale artifacts) | `pnpm add d3-force@^3` |

**Nothing found in category:** Live service config, OS-registered state — verified by grep (no external service references in the phase scope).

## Common Pitfalls

### Pitfall 1: np_persona shape clash breaks the Phase-3 persona pipeline (regression)
**What goes wrong:** PreferenceMemoryStore writes a `UserPreferences`-shaped np_persona; `personaConfig.loadPersona()` parses with `PersonaProfileSchema.safeParse` → fails → PERSONA_LOAD_FAILED → DEFAULT_PERSONA. The persona silently resets (R-7/R-2 regression, D-05-18 violation).
**Why it happens:** Two schemas (PersonaProfile vs UserPreferences) claim the same key; the Phase-3 read path is not shape-aware.
**How to avoid:** PreferenceMemoryStore owns the write; `personaConfig` gains a dual-shape read (accept legacy PersonaProfile → convert `{personaId, personaOverrides}` from id/name/tone/brevity; accept UserPreferences → pass through), both Zod-gated. `readPersona()` (only consumer: pipeline itself — verified no other callers) can be derived via `resolvePersona(DEFAULT_PERSONA, prefs)`.
**Warning signs:** `PERSONA_LOAD_FAILED` in debugLog after saving persona prefs; injected persona name reverts to "NowPilot".

### Pitfall 2: MemoryDB.userFacts shape drift (Fact vs UserMemoryFact)
**What goes wrong:** UserMemoryStore writes §3.4 facts into a store typed §21.4 — lost fields (type/tags/useCount/lastUsedAt) silently degrade scoring (tagScore/useCountScore always 0); spec §15.1 explicitly names `userFacts UserMemoryFact[]`.
**Why it happens:** Phase 2 shipped the §21.4 `Fact` shape; §3.4's richer `UserMemoryFact` was defined later in the spec.
**How to avoid:** Upgrade `MemoryDB.userFacts` value type to `UserMemoryFact` with a v1→v2 data-carry migration via the IndexedDBMigrator registry (`runMigrations` — exists, currently unused by any store; 02-06 registry precedent). Default-fill new fields (type: 'fact', tags: [], updatedAt: created, useCount: 0, lastUsedAt: undefined).
**Warning signs:** tsc errors writing UserMemoryFact into userFacts; scoring unit tests show tagScore/useCountScore dead at 0.

### Pitfall 3: "Wikilink styling hooks" don't exist in PortableMarkdown
**What goes wrong:** The plan assumes PortableMarkdown already styles wikilinks (CONTEXT code_context claims it); the actual component (verified) is `XMarkdown + DOMPurify.sanitize + escapeRawHtml` with no wikilink props. The Notes preview can't render resolved/unresolved links distinctly.
**Why it happens:** Phase 1 shipped the renderer without the §21.2 col-3 wikilink surface (that surface is Phase 5's).
**How to avoid:** Extend `PortableMarkdown` with an OPTIONAL `wikilinks?: { resolve: (title: string) => { id?: string } | null }` prop (default undefined → zero behavior change for existing consumers) OR a `NoteBody` wrapper that pre-processes `[[...]]` into link spans and delegates the rest to PortableMarkdown. DOMPurify must stay unconditional (R-10/T-1-07). Planner decision (Open Q4).
**Warning signs:** Preview mode renders `[[Title]]` as literal text; no styled link affordance.

### Pitfall 4: Unregistered storage key silently no-ops (np_conversation_meta)
**What goes wrong:** ConversationMemoryStore writes conversation meta; `settingWrite/settingRead` for an unregistered key silently fall back (Pitfall 4 — Setting.ts permission table). LRU archive/evict never persists; status resets to 'active' every mount.
**Why it happens:** §15.1 declares `np_conversation_meta` but Phase 2 never registered it (grep verified: absent from STORAGE_KEY_REGISTRY).
**How to avoid:** Register `np_conversation_meta: { area: 'local' }` in Setting.ts + `ConversationMeta` type (§21.3, verbatim) in `src/core/memory/types.ts`. Test the archive/evict round-trip through the Setting layer.
**Warning signs:** conversation status/`messageCount` resets on reload; `lastAccessed` stays stale.

### Pitfall 5: Budget enforcement leaks into the hook or optimizer
**What goes wrong:** Top-5/top-3/≤1000-token logic scattered between the hook (which resolves tier per stage) and ContextOptimizer (which knows tier) — double trimming, divergent results between planner (haiku) and renderer (flash) stages, or mid-structure truncation.
**Why it happens:** Tier differs per stage (planner haiku vs renderer flash — T-04-27 precedent); the optimizer is the only tier authority, but MemoryEngine owns budget enforcement per D-05-02.
**How to avoid:** MemoryEngine.assemble accepts `tier` (or `maxMemories: 3 | 5`) and returns the already-budgeted `RetrievedMemory[]`; the optimizer's `reduceMemoryTopK` becomes REAL as a fallback safety net (re-build the memory section from `input.memoryHints.slice(0, 3)` when the ladder fires — pure, no text slicing, D-04-13). Hook passes data; no budget math in the hook (GR-3).
**Warning signs:** Memory injection >1000 tokens in the manifest; tiny-mode planner injecting 5 memories while renderer gets 3.

### Pitfall 6: d3-force in jsdom / wrong bundle (R-3)
**What goes wrong:** NoteGraphView tests under vitest jsdom hang or crash (simulation timers never settle; no real layout); importing d3-force in the side panel or background SW violates R-3.
**Why it happens:** d3-force uses requestAnimationFrame/timers + needs real DOM measurement; it's a runtime-only layout lib.
**How to avoid:** `prefers-reduced-motion` → run simulation to equilibrium then render final layout directly (UI-SPEC Motion); test the graph's *data derivation* (NoteGraph) in node env and the SVG component with jsdom + manual tick stepping (`simulation.tick(n)` — synchronous, no rAF); import d3-force only in `NoteGraphView.tsx` (Standalone bundle only — Appendix G isolation check unchanged).
**Warning signs:** vitest hang with "simulation" in the stack; bundle size jump in side-panel output.

### Pitfall 7: note:saved event name drift
**What goes wrong:** Spec §20.11 Flow 3 names `EventBus.emit('note:saved')`; the existing EVENT_TYPES union has `NOTE_SAVE` (Phase 1). A plan that reuses `NOTE_SAVE` diverges from the spec vocabulary; a plan that emits an unregistered name throws at construction (`EventBus` constructor only registers listed events).
**Why it happens:** Two vocabularies (Phase-1 Appendix E list vs §20.11 prose).
**How to avoid:** Add `'note:saved'` to `EVENT_TYPES` (extending the union — existing `NOTE_SAVE` stays for backward compat; EventBus.test.ts keeps passing). Subscribe to `note:saved` in NotesPage/graph/backlinks/index-rebuild wiring.
**Warning signs:** `emit('note:saved')` returns false / handlers never fire; tsc error on the literal event name.

### Pitfall 8: verify:phase-5 script shape
**What goes wrong:** Spec line 3685 defines the narrow `tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts`; prior phases' package.json scripts use the §24 full chain (eslint + prettier + tsc + wxt build + vitest run). Copying either literally ignores D-05-19's "follow the §24 chain template consistent with prior phases".
**How to avoid:** `"verify:phase-5": "eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run"` in package.json (matching phases 1–4b exactly); the spec's narrow form is the conceptual gate — the vitest paths must still exist under `tests/core/memory`, `tests/core/search`, `tests/core/notes/LinkParser.test.ts` (all NEW — no Wave-0 files exist).
**Warning signs:** Phase gate greps package.json for the §24 chain and finds the spec's narrow form.

## Code Examples

Verified patterns from official/authoritative sources:

### Common Operation 1: MemoryEngine assemble — budgeted injection DTO
```typescript
// Recommended (planner discretion D-05-02). Source: §3.4 injection rules + D-05-06/07/09.
// MemoryEngine.ts — orchestrates stores; surfaces never touch stores directly.
const MAX_MEMORY_TOKENS = 1000;      // §3.4
const WORKING_MEMORY_MAX_TOKENS = 300; // §3.6 / D-05-09

export async function assemble(
  opts: { query: string; conversationId: string; tier: ModelContextTier; nowMs?: number },
): Promise<MemoryInjection> {
  // 1. Working memory block from UserMemoryStore (source: 'inferred') — §3.6, O.10
  // 2. User facts: UserMemoryStore.retrieve(query, nowMs) → MemoryScorer → sort desc
  // 3. Budgets: top-5 (top-3 tiny), running token cap via estimateTokens, redact (R-10)
  // 4. Preferences: PreferenceMemoryStore.read() → UserPreferences (compact JSON source)
  // 5. Return { memories, workingMemoryBlock, preferences }
}
```

### Common Operation 2: Working-memory updater (Appendix O.10 VERBATIM, spec L6661–6692)
```typescript
// src/core/memory/WorkingMemory.ts (O.10 verbatim; planner may co-locate in UserMemoryStore)
import { WORKING_MEMORY_TEMPLATE, type WorkingMemory } from '@/types/harness'; // C.1 home — ADD to harness.ts
const MAX_WORKING_MEMORY_TOKENS = 300;

export function initWorkingMemory(resourceId: string): WorkingMemory {
  return { resourceId, markdown: WORKING_MEMORY_TEMPLATE, tokens: estimate(WORKING_MEMORY_TEMPLATE), updatedAt: Date.now() };
}
export function updateWorkingMemory(cur: WorkingMemory, patch: Partial<Record<
  'Name' | 'Role / Team' | 'Environment' | 'Preferences' | 'Long-term Goals', string>>): WorkingMemory {
  let md = cur.markdown;
  for (const [field, value] of Object.entries(patch)) {
    if (!value) continue;
    const safe = TraceRedactor.redact(value); // §4.4 — never store secrets
    md = md.replace(new RegExp(`(- \\*\\*${field}\\*\\*:).*`), `$1 ${safe}`);
  }
  let tokens = estimate(md);
  if (tokens > MAX_WORKING_MEMORY_TOKENS) { md = truncateToTokens(md, MAX_WORKING_MEMORY_TOKENS); tokens = MAX_WORKING_MEMORY_TOKENS; }
  return { ...cur, markdown: md, tokens, updatedAt: Date.now() }; // single-writer: primary surface only (§13)
}
const estimate = (s: string) => Math.ceil(s.length / 4);
function truncateToTokens(s: string, cap: number) { return s.slice(0, cap * 4); }
```

### Common Operation 3: Optimizer threading — the dead slots become real (verified ContextPack L75–93)
```typescript
// ContextOptimizer.buildPackInput (Phase-5 modification — currently drops these inputs):
// preferencesText = JSON.stringify(input.preferences)      // compact JSON, D-05-08 — deterministic key order via spread order
// memoryText = [workingMemoryBlock, ...facts].join('\n\n') // working memory FIRST (D-05-09); facts as "- [score] content" lines
// ContextPack already emits:  stable:true 'preferences' (sourceId 'preferences') + stable:true 'memory' (sourceId 'memory')
```

### Common Operation 4: d3-force graph (CITED: d3js.org/d3-force — official API)
```typescript
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force';
// nodes: { id, title, selected }[]; links: { source, target }[] (note IDs — WIKI-ID-01)
const simulation = forceSimulation(nodes)
  .force('link', forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(80))
  .force('charge', forceManyBody().strength(-200))
  .force('center', forceCenter(width / 2, height / 2));
simulation.on('tick', () => { /* update <circle>/<line> positions in SVG */ });
// reduced-motion: const positions = simulation.tick(300) → render final layout directly, stop() (UI-SPEC Motion)
```

### Common Operation 5: LinkParser tie-break (source: WIKI-ID-02 verbatim)
```typescript
// src/core/notes/LinkParser.ts — pure; resolveLinks must stay < 20 ms (§22.1)
export function resolveLinks(
  targets: string[],
  notes: readonly Pick<Note, 'id' | 'title' | 'updated'>[],
): { links: string[]; unresolvedLinks: string[] } {
  const links: string[] = [];
  const unresolvedLinks: string[] = [];
  for (const title of targets) {
    // resolution order: exact title → updated desc → id asc
    const match = notes
      .filter((n) => n.title === title)
      .sort((a, b) => b.updated - a.updated || (a.id < b.id ? -1 : 1))[0];
    if (match) links.push(match.id); else unresolvedLinks.push(title);
  }
  return { links, unresolvedLinks };
}
```

### Common Operation 6: MiniSearch index rebuild + incremental (pattern: PageIndexBuilder L132–139, verified)
```typescript
// Lifecycle (D-05-12): rebuild on Notes view mount; incremental add/remove on CRUD.
//   const index = buildNotesIndex(await listNotes(db));   // mount — cheap ≤ 5,000 notes
//   index.add(docFor(note));                              // note:saved handler
//   index.discard(noteId);                                // delete handler
//   const results = index.search(query, { prefix: true, fuzzy: 0.2, boost: { title: 2 }, limit });
//   const normalized = results.map((r) => ({ ...r, score: r.score / (results[0]?.score ?? 1) })); // [0,1] (A1)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `memoryHints: []` + dead `preferencesText`/`memoryText` slots (Phase 4/4b) | Real memory + preferences PromptSections fed by MemoryEngine | Phase 5 | The optimizer's stable `preferences`/`memory` sections (F-5 cache-eligible) actually emit; `reduceMemoryTopK` stops being a structural no-op |
| np_persona read-only accessor (Phase 3, D-09) | PreferenceMemoryStore writer (D-05-18) | Phase 5 | Full UserPreferences persistable; read path must stay compatible (Pitfall 1) |
| `MemoryDB.userFacts` = §21.4 Fact | `MemoryDB.userFacts` = §3.4 UserMemoryFact (spec §15.1 name) | Phase 5 | Scoring has tag/useCount inputs; v1→v2 migration required |
| Ephemeral page index only (Phase 4a PageIndexBuilder) | Second DISTINCT instance: persistent notes index (§26.5 note) | Phase 5 | Notes search + future RAG (5a) + search-notes tool (Phase 8) share one core engine, never shared storage |

**Deprecated/outdated:**
- `NOTE_SAVE` (Phase-1 event name): superseded vocabulary by spec §20.11 `note:saved` — keep the old constant (backward compat, EventBus.test.ts) but the save pipeline emits `note:saved` (Pitfall 7).
- `ConversationMeta` (spec §21.3): not yet in code — Phase 5 adds it to `src/core/memory/types.ts` (R-1 single home).
- `WorkingMemory` + `WORKING_MEMORY_TEMPLATE` (spec Appendix C L4976–4988): not yet in `src/types/harness.ts` despite the O.10 import — Phase 5 adds them at the C.1 home (R-1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MiniSearch v7 raw scores need normalization to [0,1] for the D-05-11 tool seam (verified `SearchResult` has unbounded `score`) | MiniSearch | If raw scores are acceptable, normalization is harmless overhead; if scores must be raw for ranking parity, normalization changes only the tool contract (UI ranking unaffected) |
| A2 | Real installs may hold Phase-3 `PersonaProfile`-shaped `np_persona` values; the PreferenceMemoryStore read path needs a dual-shape compat shim | Persona writer migration | If no legacy values exist (fresh install), the shim is dead code — but omitting it risks a silent persona reset (Pitfall 1) |
| A3 | `MemoryDB.userFacts` must upgrade to `UserMemoryFact` (§3.4) via a v1→v2 `runMigrations` migration | Memory stores | If the planner instead keeps `Fact` + in-memory mapping, type/tags/useCount/lastUsedAt don't persist → scoring degrades (tagScore/useCountScore dead) |
| A4 | d3-force ^3 resolves to 3.0.0 via `pnpm add d3-force@^3` and its ESM/CJS exports work under WXT's bundler | Graph | d3-force is a mature, stable package (no API change since 2016); the only risk is ESM interop — verified it ships dual build |
| A5 | `conversationId: 'default'` stays the hook value until Phase 7 (no conversation store) — ConversationMemoryStore still implements per-conversation keying | Memory injection | If a conversation selector arrives mid-phase, the hook wiring changes — store design unaffected |
| A6 | The memory `PromptSection` (stable:true) changing per turn breaks the anthropic cache prefix only when memory changes — acceptable, F-5 intent preserved | Memory section | If per-turn memory churn must not invalidate the cache, memory would need stable:false — contradicts ContextPack's documented F-5 mapping (do not change without an ADR) |

## Open Questions (RESOLVED)

_All eight recommendations below were implemented during 05-01..05-08 (see the per-question summary lines and the 05-08 SUMMARY for the resolution evidence); no open item remains unresolved at gap closure._

1. **np_persona storage shape — PersonaProfile vs UserPreferences (D-05-18)**
   - What we know: np_persona currently stores a PersonaProfile (Phase-3 schema); UserPreferences (with personaId/personaOverrides) is the Phase-5 injected shape; `readPersona()` has no external callers (verified).
   - What's unclear: whether PreferenceMemoryStore persists the full UserPreferences object under np_persona (requiring the dual-shape read shim + legacy conversion) or persists persona under np_persona and other prefs elsewhere.
   - Recommendation: **np_persona stores UserPreferences (full shape, UserPreferencesSchema-gated); personaConfig read path accepts both shapes (legacy PersonaProfile → convert); `readPersona()` derives via `resolvePersona(DEFAULT_PERSONA, prefs)`.** Single key, spec-verbatim (§3.5 "persists in this store (np_persona)").

2. **MemoryDB.userFacts migration (Fact → UserMemoryFact)**
   - What we know: spec §15.1 names `userFacts UserMemoryFact[]`; code types it §21.4 `Fact`; `runMigrations` + DBVersionMigration registry exist but are unused by any store.
   - What's unclear: whether to migrate v1→v2 with default-fill, or add a separate store.
   - Recommendation: **v1→v2 data-carry migration via runMigrations (default-fill type:'fact'/tags:[]/updatedAt:created/useCount:0)** — spec-verbatim, no orphaned store; the 02-06 migrator pattern the store headers already reference.

3. **Memory section assembly location (memoryHints → memoryText)**
   - What we know: the optimizer is pure (no chrome/async/Date.now — verified module contract); MemoryEngine owns budget enforcement (D-05-02); tier differs per stage.
   - What's unclear: assemble-per-stage (hook calls assemble twice) vs assemble-once-top-5 + optimizer tiny-trim.
   - Recommendation: **assemble per stage with the stage's tier (top-5/top-3 decided in MemoryEngine; hook passes tier)** AND make `reduceMemoryTopK` a real fallback (re-build from `input.memoryHints.slice(0,3)` — pure, D-04-13-safe). The optimizer's `buildPackInput` threads the assembled text.

4. **PortableMarkdown wikilink extension**
   - What we know: PortableMarkdown = XMarkdown + unconditional DOMPurify (verified — no wikilink props despite CONTEXT's claim).
   - What's unclear: optional prop vs wrapper component; how `[[Title]]` becomes a clickable/resolved link without bypassing DOMPurify or breaking existing consumers.
   - Recommendation: **optional `wikilinks?: { resolve(title): { id?: string } | null }` prop on PortableMarkdown** (default undefined → byte-identical for existing consumers); resolved → clickable colorPrimary link, unresolved → muted/dashed + Create-note affordance (UI-SPEC). Planner must pin the exact mechanism (pre-process spans vs x-markdown custom renderers) at implementation with a fixture test.

5. **WikilinkAutocomplete widget**
   - What we know: a11y contract is binding (combobox, aria-activedescendant, listbox); MiniSearch title matching < 50 ms p95 ≤ 5,000 notes; no LLM suggestions (D-04).
   - What's unclear: antd `AutoComplete` vs custom anchored popover over the TextArea.
   - Recommendation: **custom anchored popover** (AutoComplete's text-input coupling fights caret-position insertion inside a TextArea); implement per the UI-SPEC a11y contract; dropdown max-height ~320 px + internal scroll (UI-SPEC ⚠ unresolved item).

6. **trustPrefs.memory gate application point**
   - What we know: `TrustPrefs.memory` exists (np_trust, D-4b-07/08); the 4b trust feed only processes pageContext; memory rides the stable PromptSection path, not the feed.
   - What's unclear: whether MemoryEngine.assemble honors trustPrefs.memory or the hook drops memoryHints when memory is disabled.
   - Recommendation: **the hook drops `memoryHints` when `trustPrefs.memory === false`** (mirrors the 04b page gate; keeps the optimizer pure and MemoryEngine store-focused). Add a test that memory-disabled produces no memory section.

7. **New Phase-5 canonical error codes**
   - What we know: no memory/notes/search codes exist in errorCodes.ts (verified — only STORE_READ/STORE_WRITE cover storage); every prior phase added a canonical block + spec Appendix C.2 mirror (W-1 gate precedent).
   - What's unclear: exact code vocabulary for this phase.
   - Recommendation: **add a Phase-5 canonical block** (e.g. MEMORY_RETRIEVAL_FAILED, MEMORY_EXTRACT_FAILED, NOTE_LINK_PARSE_FAILED, NOTE_GRAPH_FAILED, SEARCH_INDEX_REBUILD_FAILED — planner names them) to errorCodes.ts AND mirror in spec Appendix C.2 (prior-phase W-1 precedent); stores reuse STORE_READ/STORE_WRITE.

8. **ConversationMeta persistence target**
   - What we know: §15.1 `np_conversation_meta ConversationMeta[]` (LRU 10/100) in chrome.storage.local; MemoryDB has `conversationSummaries` (id/summary/updatedAt) + messages; np_conversation_meta is NOT registered in Setting.ts.
   - What's unclear: meta in chrome.storage.local (spec) vs extending MemoryDB.
   - Recommendation: **spec-verbatim — register `np_conversation_meta: { area: 'local' }` in Setting.ts; ConversationMeta type in src/core/memory/types.ts; bodies+summaries stay in MemoryDB** (the §23 ADR "metadata in local; bodies in IDB" split).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test toolchain | ✓ | v24.18.1 | — |
| pnpm | package installs (`pnpm add d3-force@^3`) | ✓ | 11.18.0 | — |
| minisearch | MiniSearchIndex, WikilinkAutocomplete | ✓ | 7.2.0 (installed) | — |
| d3-force | NoteGraphView | ✗ | — | MUST INSTALL (`pnpm add d3-force@^3`) — approved stack, legacy check OK, no postinstall |
| antd | Notes UI components | ✓ | 6.5.3 (installed) | — |
| @ant-design/icons | icon-only controls | ✓ | 6.3.2 (installed) | — |
| @ant-design/x-markdown | PortableMarkdown body renderer | ✓ | 2.9.0 (installed) | — |
| vitest | tests (threads pool, jsdom-align env) | ✓ | 4.1.10 | — |
| TypeScript | tsc --noEmit gate | ✓ | 5.9.3 | — |
| fake-indexeddb | store tests (NotesDB/MemoryDB precedent, RESEARCH Pattern 8) | ✓ | installed | — |

**Missing dependencies with no fallback:**
- d3-force — must be added by the planner as an early task (`pnpm add d3-force@^3`); the NoteGraphView plan task is blocked until it's installed. No fallback (d3-force is the approved graph library; a hand-rolled layout is forbidden — Don't Hand-Roll).

**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (threads pool; jsdom-align custom env for component tests; node env for pure core) |
| Config file | vitest.config.ts (existing) |
| Quick run command | `npx vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts --bail=1` |
| Full suite command | `pnpm run verify:phase-5` (eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run — §24 chain per D-05-19) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KNW-04 | MemoryScorer §3.4 verbatim weights + [0,1] + injectable clock | unit | `vitest run tests/core/memory/MemoryScorer.test.ts` | ❌ Wave 0 |
| KNW-04 | MemoryEngine orchestration: assemble budgets (top-5/top-3 tiny/≤1000), working memory first, primary-surface single-writer | unit | `vitest run tests/core/memory/MemoryEngine.test.ts` | ❌ Wave 0 |
| KNW-04 | UserMemoryStore: UserMemoryFact CRUD + working memory (O.10) + write-never-throws (GR-9) | unit | `vitest run tests/core/memory/UserMemoryStore.test.ts` | ❌ Wave 0 |
| KNW-04 | ConversationMemoryStore: 12-message compactor, last-N turns per tier, LRU 10/100 archive-after-30min, evict-conversation op | unit | `vitest run tests/core/memory/ConversationMemoryStore.test.ts` (+1 to §18) | ❌ Wave 0 |
| KNW-04/05 | PreferenceMemoryStore: np_persona writer, UserPreferencesSchema gate, legacy PersonaProfile compat, compact-JSON injection | unit | `vitest run tests/core/memory/PreferenceMemoryStore.test.ts` (+1 to §18) | ❌ Wave 0 |
| KNW-05 | MemoryExtractor: haiku-tier via PersonaInjector('memoryExtractor') + requestJson, non-blocking | unit (stub LLM) | `vitest run tests/core/memory/MemoryExtractor.test.ts` (+1 to §18) | ❌ Wave 0 |
| KNW-03 | MiniSearchIndex: fields title+content+tags+summary, rebuild + incremental add/remove, < 50 ms / 1,000 notes, [0,1] normalization | unit + perf | `vitest run tests/core/search/MiniSearchIndex.test.ts` | ❌ Wave 0 |
| KNW-01 | LinkParser: parseLinks extraction, tie-break (exact → updated desc → id asc), unresolved, save-time reconciliation | unit | `vitest run tests/core/notes/LinkParser.test.ts` | ❌ Wave 0 |
| KNW-02 | NoteGraph: edges from links[] + backlink index, deletion-dangling reconciliation (WIKI-ID-04), topKSimilar (§22.3) | unit | `vitest run tests/core/notes/NoteGraph.test.ts` (+1 to §18) | ❌ Wave 0 |
| KNW-02 | NoteGraphView SVG + reduced-motion (tick(n) manual) | component (jsdom-align) | `vitest run tests/components/notes/NoteGraphView.test.tsx` | ❌ Wave 0 |
| KNW-01/02 | BacklinksPanel + WikilinkAutocomplete (a11y combobox contract) | component | `vitest run tests/components/notes/*.test.tsx` | ❌ Wave 0 |
| KNW-05 | ContextOptimizer threading: memoryHints→memoryText, preferences→preferencesText, reduce-topk real, memory-disabled gate | unit | `vitest run tests/core/context/ContextOptimizer.test.ts` (extend) | ✅ exists (extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file> --bail=1`
- **Per wave merge:** `npx vitest run tests/core/memory tests/core/search tests/core/notes tests/components/notes --bail=1`
- **Phase gate:** `pnpm run verify:phase-5` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/memory/MemoryEngine.test.ts` — covers KNW-04/05
- [ ] `tests/core/memory/MemoryScorer.test.ts` — covers KNW-04 (required by §18)
- [ ] `tests/core/memory/UserMemoryStore.test.ts` — covers KNW-04 (required by §18)
- [ ] `tests/core/memory/ConversationMemoryStore.test.ts` — covers KNW-04
- [ ] `tests/core/memory/PreferenceMemoryStore.test.ts` — covers KNW-04/05 + D-05-18 compat
- [ ] `tests/core/memory/MemoryExtractor.test.ts` — covers KNW-05 (GR-4 Zod + one repair)
- [ ] `tests/core/search/MiniSearchIndex.test.ts` — covers KNW-03 (required by §18)
- [ ] `tests/core/notes/LinkParser.test.ts` — covers KNW-01 (required by §18)
- [ ] `tests/core/notes/NoteGraph.test.ts` — covers KNW-02
- [ ] `tests/components/notes/*.test.tsx` — NoteGraphView / BacklinksPanel / WikilinkAutocomplete
- [ ] Extend `tests/core/context/ContextOptimizer.test.ts` — memory/preferences threading + reduce-topk
- [ ] Framework install: `pnpm add d3-force@^3` — required before NoteGraphView task

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth surfaces in this phase |
| V3 Session Management | no | np_workspace_primary election is not a session |
| V4 Access Control | no | no new permission surfaces (np_conversation_meta/np_persona already local-area) |
| V5 Input Validation | yes | Zod boundary gates: `UserPreferencesSchema` (np_persona write), `MemoryExtractorResultSchema` (GR-4 + one repair via requestJson), dual-shape legacy PersonaProfile read, note store boundary |
| V6 Cryptography | no | reuses the Phase-2 vault; no new crypto |

### Known Threat Patterns for {stack}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via retrieved memory | Tampering | Memory section is data assembled by MemoryEngine (never instruction text — GR-7); trustPrefs.memory gate drops the section when disabled (D-4b-08/KIND_TO_PREF_KEY memory: 'memory' verified); MemoryExtractor prompt forbids storing instructions/unsafe content |
| Secrets leaking into memory / working memory | Information Disclosure | O.10 `TraceRedactor.redact()` on every working-memory write (verbatim); MemoryExtractor system prompt "Do not store secrets or raw customer data"; D-05-06 never inject secrets (R-10) |
| XSS via note bodies | Tampering | Notes render ONLY through PortableMarkdown (DOMPurify unconditional + escapeRawHtml — verified); never dangerouslySetInnerHTML (spec §16.1) |
| Memory store tampering → model manipulation | Tampering | Single-writer primary surface (§13); surfaces never write stores directly (D-05-02); retrieved memory is `trust:'retrieved'` semantics with instructionAuthority:false at the source (04b envelope) |
| R-3 background-SW isolation | — | Memory + IndexedDB + MiniSearch + d3-force live in Side Panel/Standalone only; isolation grep at verify (Appendix G/§24 chain precedent) |

## Sources

### Primary (HIGH confidence)
- PRODUCT_SPEC_v0_1.md (canonical, read in this session): §3 Persistent Memory Architecture (L536–684 incl. §3.3 ConversationMemory, §3.4 UserMemoryFact + scoring weights, §3.5 UserPreferences, §3.6 WorkingMemory), §13 Concurrency (L1784–1803, single-writer), §15.1 Storage Backends (L1920–1974), §15.3 LRU Eviction (L1986–1991), §18 Phase 5 create list + DONE-when (L2752–2790), §20.11 Flow 3 save pipeline (L1669–1671), §21.2 Note (L3368–3399), §21.3/§21.4 Memory models (L3401–3432), §22.1 Perf targets (L3550–3572), §22.3 NoteGraph cosine (L3583–3591), §24 verify chain + line 3685, §26.5 MiniSearch integration (L3791–3798), §27.7a WIKI-ID-01..04 (L3884–3889), §9.8 search-notes tool row (L1589), Appendix C WorkingMemory (L4976–4988), Appendix O.10 working-memory updater (L6661–6692)
- 05-CONTEXT.md D-05-01..19 (user decisions, read in full)
- 05-UI-SPEC.md (approved UI contract, read in full)
- Code verified in this session: NotesDB.ts, MemoryDB.ts, memory/types.ts, ai/types.ts, ContextOptimizer.ts, ContextPack.ts, ContextCompressor.ts, useStreamingLLM.ts, PersonaInjector.ts, personaConfig.ts, PersonaProfile.ts, NotesPage.tsx, PageIndexBuilder.ts, EventBus.ts, contextFeed.ts, contextReceipt.ts, Setting.ts, IndexedDBMigrator.ts, trustConfig.ts, errorCodes.ts, strings.ts, PortableMarkdown.tsx, harness.ts (ContextItem/Schema), ChatHistoryDB.ts, prompts/index.ts, StructuredOutput.ts
- Package verification: minisearch 7.2.0 `node_modules/minisearch/dist/es/index.d.ts` (fields/storeFields/boost/prefix/fuzzy/SearchResult shape), `gsd-tools query package-legitimacy check` (minisearch OK, d3-force OK)

### Secondary (MEDIUM confidence)
- d3js.org/d3-force (official docs fetched 2026-08-13) — forceSimulation/forceLink/forceManyBody/forceCenter API + tick-event rendering pattern
- STATE.md + ROADMAP.md Phase 5 (SC#1–5) + REQUIREMENTS.md KNW-01..05 rows
- 03-CONTEXT.md (D-09/D-11 persona accessor + memoryExtractor stage) + 04b-CONTEXT.md (D-4b-01 memory structural no-op, D-4b-08 memory trust gate) + 04-CONTEXT.md (memoryHints/preferences seams)

### Tertiary (LOW confidence)
- None — all critical claims verified against the spec, installed packages, or official d3 docs. Assumptions A1–A6 are explicitly flagged in the Assumptions Log for user confirmation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — minisearch + d3-force on user-approved stack, both pass the legitimacy gate; versions verified in node_modules/registry
- Architecture: HIGH — spec-verbatim shapes + verified existing seams (memoryHints/preferences slots, reduce-topk no-op, PageIndexBuilder pattern); open decisions (np_persona shape, userFacts migration) are flagged with recommendations
- Pitfalls: HIGH — every pitfall verified against actual code (unregistered np_conversation_meta, missing PortableMarkdown wikilink props, Fact-vs-UserMemoryFact drift, NOTE_SAVE vs note:saved, dead ContextPack slots)

**Research date:** 2026-08-13
**Valid until:** 2026-08-20 (fast-moving — minisearch/d3-force majors stable, but verify against node_modules at implementation)
