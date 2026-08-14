# Phase 5: Knowledge Base (Memory + MiniSearch + Notes) - Pattern Map

**Mapped:** 2026-08-13
**Files analyzed:** 26 new/modified files classified (16 create, 10 modify, 0 delete) + 11 new test files
**Analogs found:** 22 / 26 (4 no-analog — pure-logic/d3-force greenfield, RESEARCH.md provides the reference code)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/memory/MemoryEngine.ts` | service (orchestrator) | request-response | `src/core/context/ContextOptimizer.ts` | role-match |
| `src/core/memory/ConversationMemoryStore.ts` | service (store) | CRUD | `src/core/storage/MemoryDB.ts` + `src/core/storage/NotesDB.ts` | exact |
| `src/core/memory/UserMemoryStore.ts` | service (store) | CRUD | `src/core/storage/NotesDB.ts` | exact |
| `src/core/memory/PreferenceMemoryStore.ts` | service (store) | CRUD | `src/core/ai/persona/personaConfig.ts` (read) + `src/core/storage/Setting.ts` (write) | role-match |
| `src/core/memory/MemoryScorer.ts` | utility (pure) | transform | `src/core/context/trust/contextFeed.ts` (injectable clock, L40-43) | exact |
| `src/core/memory/MemoryExtractor.ts` | service (LLM stage) | request-response | `src/core/ai/StructuredOutput.ts` (requestJson) + `PersonaInjector.ts` | exact |
| `src/core/memory/types.ts` (MODIFY) | types (C.1 home) | — | `src/types/harness.ts` (C.1 co-located Zod boundary precedent) | role-match |
| `src/core/search/MiniSearchIndex.ts` | utility (index) | transform | `src/core/extraction/PageIndexBuilder.ts` (buildPageIndex L132-139) | exact |
| `src/core/notes/LinkParser.ts` | utility (pure) | transform | none — RESEARCH Common Operation 5 (WIKI-ID-02 verbatim) | no-analog |
| `src/core/notes/NoteGraph.ts` | utility (pure) | transform | none — RESEARCH Pattern 4 anti-pattern note (derived edges) | no-analog |
| `src/components/notes/BacklinksPanel.tsx` | component | request-response | `src/components/pages/OptionsPage.tsx` (antd Card/List/Empty pattern) | role-match |
| `src/components/notes/WikilinkAutocomplete.tsx` | component | event-driven | `src/components/cmdk/CmdKPicker.tsx` (a11y combobox/state pattern) | role-match |
| `src/components/notes/NoteGraphView.tsx` | component | event-driven | none — RESEARCH Common Operation 4 (d3-force official API) | no-analog |
| `src/components/pages/NotesPage.tsx` (REPLACE) | component (page) | request-response | `src/components/pages/OptionsPage.tsx` | role-match |
| `src/components/pages/useStreamingLLM.ts` (MODIFY) | hook | request-response | itself (existing `optimizerBase` structure L184-199) | exact |
| `src/core/context/ContextOptimizer.ts` (MODIFY) | service | request-response | itself (`buildPackInput` L120-136 + ladder L354-361) | exact |
| `src/core/context/ContextCompressor.ts` (MODIFY) | utility | transform | itself (`reduceMemoryTopK` no-op L126-128) | exact |
| `src/core/ai/persona/personaConfig.ts` (MODIFY) | service | CRUD | itself (`loadPersona` L39-63) + `PersonaProfile.ts` schema | exact |
| `src/core/storage/Setting.ts` (MODIFY) | config | CRUD | itself (`STORAGE_KEY_REGISTRY` L60-81) | exact |
| `src/core/storage/MemoryDB.ts` (MODIFY) | service (store) | CRUD | itself (`openMemoryDB` L70-79) + `IndexedDBMigrator.ts` (v1→v2) | exact |
| `src/core/error/errorCodes.ts` (MODIFY) | config | — | itself (Phase blocks L7-107, before `UNKNOWN`) | exact |
| `src/types/harness.ts` (MODIFY) | types (C.1) | — | itself (WorkingMemory + WORKING_MEMORY_TEMPLATE land here) | exact |
| `src/core/i18n/strings.ts` (MODIFY) | config | — | itself (`notes:` block L54-78) | exact |
| `src/components/core/PortableMarkdown.tsx` (MODIFY) | component | transform | itself (optional `wikilinks?` prop, L14-35) | exact |
| `src/core/events/EventBus.ts` (MODIFY) | config | event-driven | itself (`EVENT_TYPES` L10-23 — add `'note:saved'`) | exact |
| `package.json` (MODIFY) | config | — | itself (`verify:phase-4b` chain precedent) | exact |

Test files (all new except the ContextOptimizer extension): `tests/core/memory/*.test.ts` (6), `tests/core/search/MiniSearchIndex.test.ts`, `tests/core/notes/{LinkParser,NoteGraph}.test.ts`, `tests/components/notes/*.test.tsx` (3), `tests/core/context/ContextOptimizer.test.ts` (EXTEND — exists).

---

## Pattern Assignments

### `src/core/memory/ConversationMemoryStore.ts` + `src/core/memory/UserMemoryStore.ts` (store, CRUD)

**Analog:** `src/core/storage/NotesDB.ts` (exact) + `src/core/storage/MemoryDB.ts` (substrate)

Both stores copy the NotesDB.ts convention verbatim: idb strict DBSchema typing, `openMemoryDB()`-style factory, every read/write wrapped in try/catch with `debugLog(ERROR_CODES.STORE_READ|STORE_WRITE, …)`, write paths never throw, `[]`/`undefined` fallbacks on read failure (PATTERNS Shared Pattern 1).

**Imports + header convention** (NotesDB.ts lines 1-17):
```typescript
// src/core/storage/NotesDB.ts — the notes + concepts IndexedDB store
// (STORAGE-01). Data models VERBATIM §21.2 (lines 3357-3384); store layout per
// §15.1 (lines 1954-1958). Note content lives HERE — never chrome.storage.local
// (§0.2, Pitfall 4: note bodies belong in IndexedDB, not the 10MB KV quota).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
```

**Non-throwing write path** (NotesDB.ts lines 84-95) — copy for every store write (`putMessage`/`putFact`/`putConversationMeta`/`putWorkingMemory`):
```typescript
/** Upsert a note (write path — never throws; STORE_WRITE on failure). */
export async function putNote(db: IDBPDatabase<NotesDBSchema>, note: Note): Promise<void> {
  try {
    await db.put('notes', note);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to put note', {
      error: err instanceof Error ? err : undefined,
      module: 'NotesDB',
      extra: { noteId: note.id, title: note.title },
    });
  }
}
```

**Composite-key + index substrate** (MemoryDB.ts lines 51-79) — ConversationMemoryStore reuses the existing `MemoryMessage` row (`conversationId+seq` composite, `by-conversation` index) verbatim; only ADD `ConversationMeta` to `src/core/memory/types.ts` (never re-declare — R-1):
```typescript
export interface MemoryDBSchema extends DBSchema {
  messages: {
    key: [string, number];
    value: MemoryMessage;
    indexes: { 'by-conversation': string };
  };
  userFacts: { key: string; value: Fact };   // ← MODIFY: value becomes UserMemoryFact (v1→v2 migration)
  conversationSummaries: { key: string; value: ConversationSummary };
}
```

**`userFacts` v1→v2 migration** — analog `src/core/storage/IndexedDBMigrator.ts` L52-57 + L137-244. Register a `DBVersionMigration` for `'MemoryDB'` at version 2 with a data-carry migration (default-fill `type:'fact'`/`tags:[]`/`updatedAt:created`/`useCount:0`), open via `runMigrations` instead of `openMemoryDB`:
```typescript
/** D-14 per-DB migration registry: a DB's target version + the migrations to run. */
export interface DBVersionMigration {
  dbName: string;
  dbVersion: number;
  migrations: IndexedDBMigration[];
}
```
Runner contract (IndexedDBMigrator.ts L137-141): `runMigrations<T extends DBSchema>(spec, onMigrationFailed?)` returns `Promise<IDBPDatabase<T>>`; migrations dispatch SYNCHRONOUSLY inside `onupgradeneeded` (never await — Pitfall 2); a failure records `IDB_MIGRATION_FAILED` via the default `handleMigrationFailed` and degrades the DB read-only. The D-13 synthetic fixture lives in `tests/core/storage/IndexedDBMigrator.test.ts` — copy its shape for the MemoryDB v1→v2 test.

**Store test harness** (NotesDB.test.ts lines 10-14, 49-59) — copy for all three store test files:
```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { IDBPDatabase } from 'idb';
// ...
beforeEach(() => {
  // RESEARCH Pattern 8: fresh factory per test — documented fake-indexeddb reset.
  indexedDB = new IDBFactory();
});
```

---

### `src/core/memory/PreferenceMemoryStore.ts` (store, CRUD — np_persona WRITER)

**Analog:** `src/core/ai/persona/personaConfig.ts` (read path — keep working, D-05-18) + `src/core/storage/Setting.ts` (`settingRead`/`settingWrite`, promise-chain mutex)

**Read path to preserve (dual-shape compat shim — Pitfall 1):** personaConfig.ts L39-63. The store's read must accept BOTH the legacy Phase-3 `PersonaProfile` (PersonaProfileSchema-gated) AND the Phase-5 `UserPreferences`; convert legacy `{id, identity.name, languageStyle.tone, languageStyle.brevity}` → `{personaId, personaOverrides}`:
```typescript
async function loadPersona(): Promise<PersonaLoad> {
  const stored = await settingRead<unknown>(
    NP_PERSONA_KEY,
    (v) => v, // schema validation below — settingRead only guards permission/area
    undefined,
  );
  if (stored === undefined) {
    return { persona: DEFAULT_PERSONA, loaded: false };
  }
  const parsed = PersonaProfileSchema.safeParse(stored);
  if (!parsed.success) {
    debugLog(ERROR_CODES.PERSONA_LOAD_FAILED, 'np_persona failed PersonaProfileSchema validation — using DEFAULT_PERSONA', {
      module: 'personaConfig',
      extra: { issueCount: parsed.error.issues.length },
    });
    return { persona: DEFAULT_PERSONA, loaded: false };
  }
  return { persona: parsed.data, loaded: true };
}
```

**Write path (NEW — the store owns it):** use `settingWrite` (Setting.ts L139-171) — serialized promise-chain mutex, permission-checked, never throws. `np_persona` is ALREADY registered `{ area: 'local' }` (Setting.ts L67) — no registry change for this key. Gate the write with a co-located `UserPreferencesSchema` Zod boundary (GR-4; copy the co-location pattern from `src/types/harness.ts` L211-251 — schema beside the type it validates).

**ConversationMeta + np_conversation_meta registration (Pitfall 4):** add `np_conversation_meta: { area: 'local' }` to `STORAGE_KEY_REGISTRY` (Setting.ts L60-81, next to `np_persona` at L67); add the `ConversationMeta` type (§21.3, verbatim) to `src/core/memory/types.ts`.

---

### `src/core/memory/MemoryEngine.ts` (orchestrator, request-response)

**Analog:** `src/core/context/ContextOptimizer.ts` (pure orchestrator — zero chrome/async/Date.now) + `src/core/context/trust/contextFeed.ts` (injectable clock)

MemoryEngine is the ONLY surface entry for memory (D-05-02). Keep the public surface minimal and pure (planner discretion): `assemble()`, `recordTurn()`, `summariseIfNeeded()`, `updateWorkingMemory()`, `subscribe()`. All IndexedDB/chrome-bound work happens in the HOOK (Pitfall 5 — the optimizer is pure; the same "hook resolves inputs, optimizer packs" split as 04b trust stage). `assemble()` returns a plain `MemoryInjection` DTO (RESEARCH Pattern 3):

```typescript
export interface MemoryInjection {
  memories: RetrievedMemory[];          // top-5 (top-3 tiny), scores [0,1], ≤1000 tokens total
  workingMemoryBlock: string;           // ≤300 tokens, injected BEFORE facts (D-05-09)
  preferences: UserPreferences;         // compact JSON source for the preferences section (D-05-08)
}
```

**Module-header contract to copy** (ContextOptimizer.ts L26-32) — declares the purity boundary; MemoryEngine's pure surface (scoring, budget enforcement, section assembly) must be separable from its store-facing async core:
```typescript
// D-04-13: degradation is SECTION-granular — no text.slice/substring anywhere
// in this module; user_input is never modified. GR-3/Pitfall 7: the optimizer
// SELECTS prompt constants (D-04-11, PROMPTS.compact.*) — it never authors
// prompt text. Zero model calls, zero async, zero network, no provider/SDK
// imports, no React — pure deterministic core (determinism rule: no Date.now/crypto).
```

**Injectable clock precedent** (contextFeed.ts L40-43) — MemoryScorer's recency sub-score uses the same pattern:
```typescript
function freshnessFrom(extractedAt: number, nowMs: number): number {
  const ageHours = Math.max(0, (nowMs - extractedAt) / MS_PER_HOUR);
  return Math.min(1, Math.max(0, 1 - ageHours / FRESHNESS_WINDOW_HOURS));
}
```

---

### `src/core/memory/MemoryScorer.ts` (pure utility, transform)

**Analog:** `src/core/context/trust/contextFeed.ts` (pure + injectable clock) — RESEARCH Pattern 2 gives the §3.4 verbatim weights (05-RESEARCH.md L253-269):
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
Determinism rule (contextFeed.ts L13): no `Date.now`, no `crypto`, no `Math.random` — the only clock is the injected `nowMs`.

---

### `src/core/memory/MemoryExtractor.ts` (LLM stage, request-response)

**Analog:** `src/core/ai/StructuredOutput.ts` (requestJson — GR-4 Zod + one repair) + `src/core/ai/persona/PersonaInjector.ts` (4-stage inject incl. memoryExtractor) + `src/core/prompts/index.ts` L59-64 (PROMPTS.memoryExtractor)

**Imports + call shape** (StructuredOutput.ts L29-43 + requestJson L92-96):
```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { PROMPTS } from '@/core/prompts';
import { estimateTokens } from '@/core/context/TokenBudget';

export async function requestJson<T>(
  schema: z.ZodSchema<T>,
  sections: PromptSection[],
  ctx: StructuredOutputContext,
): Promise<T> { /* exactly one repair, then STRUCTURED_OUTPUT_FAILED — L129-166 */ }
```

**PersonaInjector route (GR-3, D-05-10):** every AI call consumes an OptimizedContext via PersonaInjector (PersonaInjector.ts L53-62):
```typescript
export const PersonaInjector = {
  inject(
    stage: PipelineStage,          // 'planner' | 'executor' | 'renderer' | 'memoryExtractor'
    baseSystem: string,
    opts?: { persona?: PersonaProfile; prefs?: UserPreferences },
  ): string {
    const persona = resolvePersona(opts?.persona ?? DEFAULT_PERSONA, opts?.prefs);
    const block = buildPersonaBlock(persona);
    return `${block}\n\n${baseSystem}`; // persona first (cacheable), then canonical stage system string
  },
};
```
The stage schema is the Phase-3 `memoryExtractor` stage — `PipelineStage` union already includes it (PersonaInjector.ts L27); the call site is Phase 5 (D-11). The system prompt constant already exists (`PROMPTS.memoryExtractor.system`, prompts/index.ts L60-64 — "Do not store secrets or raw customer data", R-10). Save-time non-blocking: fire after the IndexedDB write, never await in the save path (§22.1 "save never waits").

---

### `src/core/search/MiniSearchIndex.ts` (index, transform)

**Analog:** `src/core/extraction/PageIndexBuilder.ts` (buildPageIndex L132-139 — verified minisearch 7.2.0 API) + RESEARCH Pattern 1 (05-RESEARCH.md L216-244)

**Imports + core pattern** (PageIndexBuilder.ts L10-13 + L132-139):
```typescript
import MiniSearch from 'minisearch';
import { estimateTokens } from '@/core/context/TokenBudget';
// ...
export function buildPageIndex(chunks: PageChunk[]): MiniSearch {
  const mini = new MiniSearch<PageChunk>({
    fields: ['title', 'url', 'headingPath', 'sectionText'],
    storeFields: ['title', 'url', 'headingPath', 'sectionText'],
  });
  mini.addAll(chunks);
  return mini;
}
```

**Notes index variant (RESEARCH Pattern 1):** fields `['title', 'content', 'tags', 'summary', 'categoryPath']` (categoryPath included now, populated 5a — D-05-11); `idField: 'id'` (note UUID, WIKI-ID-01); search `mini.search(query, { prefix: true, fuzzy: 0.2, boost: { title: 2, tags: 1.5 }, limit })`. **Score normalization (Assumption A1):** MiniSearch v7 scores are unbounded BM25 — normalize to [0,1] for the D-05-11 tool seam: `results.map((r) => ({ ...r, score: r.score / (results[0]?.score ?? 1) }))` (RESEARCH L480-481). Lifecycle per D-05-12: rebuild on Notes view mount from `listNotes(db)`, incremental `index.add(docFor(note))` / `index.discard(noteId)` on CRUD.

---

### `src/core/notes/LinkParser.ts` + `src/core/notes/NoteGraph.ts` (pure utilities, transform)

**No in-repo analog** — greenfield pure logic. RESEARCH Common Operation 5 (05-RESEARCH.md L454-471) is the verbatim WIKI-ID-02 reference:

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

Determinism contract: copy the module-header determinism rule from `contextFeed.ts` L13 ("no Date.now, no crypto, no Math.random") — NoteGraph's `edges(notes)` and backlink index are derived-on-demand from stored `links[]` (D-05-17 anti-pattern: never parse-at-render, never a graph store). `parseLinks(markdown)` extracts `[[Title]]` targets via regex (`/\[\[([^\]]+)\]\]/g` — planner discretion on exact regex; WIKI-ID-02 inline semantics).

---

### `src/core/context/ContextOptimizer.ts` (MODIFY) + `src/core/context/ContextCompressor.ts` (MODIFY)

**Analog: itself.** The dead slots become real (RESEARCH Common Operation 3, 05-RESEARCH.md L434-440):

**`buildPackInput` threading** (ContextOptimizer.ts L120-136 — currently drops preferences/memory inputs; add `preferencesText` + `memoryText`):
```typescript
function buildPackInput(
  input: ContextOptimizerInput,
  minimalMode: boolean,
  contextText?: string,
): ContextPackInput {
  const personaBlock = minimalMode
    ? `${compactSystemFor(input.stage)}\n\n${input.personaBlock}`
    : input.personaBlock;
  return {
    personaBlock,
    userInput: input.userInput,
    toolSchemaRefs: minimalMode
      ? atMostOneSafeTool(input.selectedToolSchemas)
      : input.selectedToolSchemas,
    ...(contextText && contextText.length > 0 ? { contextText } : {}),
    // Phase-5 additions (planner discretion on exact assembly, D-05-07/08/09):
    // preferencesText = JSON.stringify(input.preferences)  // compact JSON, deterministic key order
    // memoryText = [workingMemoryBlock, ...facts].join('\n\n') // working memory FIRST (D-05-09)
  };
}
```

**ContextPack already emits the sections** (ContextPack.ts L75-93) — `stable:true` `preferences` (sourceId `'preferences'`) + `stable:true` `memory` (sourceId `'memory'`); the optimizer only needs to THREAD the text. Cache-stability is preserved (F-5 — memory rides the stable flag, RESEARCH A6).

**reduce-topk becomes real** (ContextCompressor.ts L126-128 currently a no-op):
```typescript
/** NO-OP in P4 (D-04-12): top-k memory reduction arrives in Phase 5
 *  (RetrievedMemory top-k). Structurally present with a marker. */
export function reduceMemoryTopK(sections: PromptSection[]): CompressionResult {
  return { sections: [...sections], compressionApplied: 'topk', dropped: [] };
}
```
Phase 5 realization per Pitfall 5: re-build the memory section from `input.memoryHints.slice(0, 3)` — pure whole-item drops (D-04-13 no-slice gate), the MemoryEngine already budgets per-tier so this is the fallback safety net. `'reduce-topk'` is already in `LADDER_STEPS` (L150-159) and the optimizer ladder calls it (ContextOptimizer.ts L354-361).

**Test extension:** `tests/core/context/ContextOptimizer.test.ts` — the existing `optimizerBase` fixture at L65 has `memoryHints: []`; extend with memory/preferences threading + reduce-topk + memory-disabled gate (Open Q6: hook drops `memoryHints` when `trustPrefs.memory === false`, mirroring the 04b page gate in `buildTrustedContext` L166-169).

---

### `src/components/pages/useStreamingLLM.ts` (MODIFY — hook wiring)

**Analog: itself.** Replace `memoryHints: []` with real memory (D-05-07), GR-3 intact — the hook calls a core builder, never assembles prompts. Current site (useStreamingLLM.ts L150-199):

```typescript
const prefs = await readPersonaPrefs();
const persona = resolvePersona(DEFAULT_PERSONA, prefs);
const personaBlock = buildPersonaBlock(persona);
// 04b-05 (D-4b-09): the trust-aware page feed — the hook is the ONLY
// chrome-boundary input resolver (page + prefs, Pitfall 5); the optimizer
// stays pure.
const trustPrefs = await readTrustPrefs();
const currentPage = useWorkspaceStore.getState().workspace.currentPageContext;
// ...
const optimizerBase = {
  operationId,
  userInput: trimmed,
  personaBlock,
  conversationId: 'default', // A11 (04-04): no conversation store until Phase 7
  workspaceId,
  activeSurface,
  selectedToolSchemas: [],
  memoryHints: [],            // ← Phase 5: memoryEngine.assemble({ query: trimmed, conversationId, tier, trustPrefs }) result
  preferences: prefs,         // ← Phase 5: PreferenceMemoryStore.read() (UserPreferences)
  pageContext: currentPage,
  trustPrefs,
};
```

**Phase-5 wiring (per-stage tiers, Pitfall 5/Open Q3):** `MemoryEngine.assemble()` accepts `tier` (planner haiku / renderer flash — the StageInvocation's `modelContextWindow` derives each; the invocation closures are built at L167-174) and returns already-budgeted `RetrievedMemory[]`. Drop `memoryHints` entirely when `trustPrefs.memory === false` (Open Q6 recommendation). `conversationId: 'default'` stays until Phase 7 (Assumption A5).

---

### `src/core/ai/persona/personaConfig.ts` (MODIFY — dual-shape read, D-05-18)

**Analog: itself + PersonaProfile.ts.** Keep the read path (L39-63 above) working; PreferenceMemoryStore becomes the WRITER. The read must accept BOTH shapes (Pitfall 1): try `UserPreferencesSchema.safeParse(stored)` first (new), then `PersonaProfileSchema.safeParse` (legacy, L50) → convert `{personaId: id, personaOverrides: {name, tone, brevity}}`. `readPersona()` (only consumer is the pipeline itself — RESEARCH verified) can derive via `resolvePersona(DEFAULT_PERSONA, prefs)` (PersonaInjector.ts L29-41). `NP_PERSONA_KEY = 'np_persona'` (L26) stays the single key — §3.5 "persists in this store (np_persona)".

---

### `src/core/storage/Setting.ts` (MODIFY — register np_conversation_meta)

**Analog: itself.** Add one line to `STORAGE_KEY_REGISTRY` (Setting.ts L60-81), next to `np_persona` (L67):

```typescript
export const STORAGE_KEY_REGISTRY: Record<string, KeyPermission> = {
  // --- local (metadata, 10 MB quota) ---
  np_providers: { area: 'local', encrypted: true },
  np_install_secret: { area: 'local' },
  np_workspace: { area: 'local' },
  np_persona: { area: 'local' },
  np_conversation_meta: { area: 'local' },   // ← Phase 5 (Pitfall 4 — was silently unregistered)
  // ...
};
```
Reads/writes go through `settingRead`/`settingWrite` (L139-204) — permission table + promise-chain mutex; never direct `chrome.storage.local` calls in the store (ConversationMemoryStore writes meta via these, bodies stay in MemoryDB — §23 ADR metadata-local/bodies-IDB split, Open Q8).

---

### `src/core/error/errorCodes.ts` (MODIFY — Phase-5 canonical block)

**Analog: itself.** Add a Phase-5 block before `UNKNOWN` (errorCodes.ts L105-107), mirroring the Phase-4 (L96) / Phase-4b (L104) block comments; mirror the new codes in spec Appendix C.2 (W-1 gate precedent):

```typescript
// --- Knowledge base / memory / notes / search (Phase 5, canonical additions) ---
MEMORY_RETRIEVAL_FAILED: 'MEMORY_RETRIEVAL_FAILED',   // planner names the exact vocabulary (Open Q7)
MEMORY_EXTRACT_FAILED: 'MEMORY_EXTRACT_FAILED',
NOTE_LINK_PARSE_FAILED: 'NOTE_LINK_PARSE_FAILED',
NOTE_GRAPH_FAILED: 'NOTE_GRAPH_FAILED',
SEARCH_INDEX_REBUILD_FAILED: 'SEARCH_INDEX_REBUILD_FAILED',
// --- Fallback ---
UNKNOWN: 'UNKNOWN',
```
Stores reuse `STORE_READ`/`STORE_WRITE` (never new codes for idb failures — RESEARCH Open Q7).

---

### `src/core/events/EventBus.ts` (MODIFY — add 'note:saved')

**Analog: itself.** Extend `EVENT_TYPES` (EventBus.ts L10-23); keep `NOTE_SAVE` for backward compat (EventBus.test.ts keeps passing — Pitfall 7):

```typescript
export const EVENT_TYPES = [
  'SHOW_HANDOFF_PENDING',
  // ...
  'NOTE_SAVE',          // Phase-1 vocabulary — stays (backward compat)
  'note:saved',         // ← Phase 5, spec §20.11 Flow 3 vocabulary (Pitfall 7)
  // ...
] as const;
```
Handlers: EventBusManager.ts L12 constructs `new EventBus(EVENT_TYPES)` from the same array — no extra wiring. The save pipeline emits `'note:saved'` with `{ noteId }` (D-05-15); NotesPage/graph/backlinks/index-rebuild subscribe. Handler try/catch + `debugLog(EVT_HANDLER)` pattern is built in (EventBus.ts L70-78).

---

### `src/types/harness.ts` (MODIFY — WorkingMemory + WORKING_MEMORY_TEMPLATE)

**Analog: itself (C.1 co-location precedent).** Append the Appendix C (L4976-4988) types at the C.1 home, with co-located Zod boundary schema where a boundary exists (harness.ts L211-251 precedent — schema beside type):
```typescript
export interface WorkingMemory {
  resourceId: string;
  markdown: string;          // WORKING_MEMORY_TEMPLATE-filled, ≤300 tokens (§3.6/O.10)
  tokens: number;
  updatedAt: number;
}
export const WORKING_MEMORY_TEMPLATE = /* Appendix O.10 fixed template (planner discretion, verbatim O.10) */;
```
The O.10 working-memory updater (RESEARCH Common Operation 2, 05-RESEARCH.md L409-432) imports these from here (R-1): `updateWorkingMemory` redacts via `TraceRedactor.redact(value)` (R-10), trims over 300 tokens via `truncateToTokens` (slice-at-char, §3.6 — this is the ONE sanctioned slice: the fixed template's tail, never a fact's content mid-structure).

---

### `src/core/i18n/strings.ts` (MODIFY — STR.notes.*)

**Analog: itself (notes block L54-78).** 19 new canonical keys per the 05-UI-SPEC Copywriting Contract (UI-SPEC L126-153) appended under `notes:` — verbatim strings from the UI-SPEC table (Golden Rule 2, 01/03/04b precedent). Existing keys reused verbatim: `loading`, `empty` (placeholder copy at NotesPage.tsx L15 is RETIRED with the placeholder), `loadFailed`, `newNote`. New: `newNoteFromPage`, `searchPlaceholder`, `searchEmpty`, `resultsCount`, `loadingNote`, `saveFailed`, `selectNote`, `save`, `unsaved`, `discard`, `deleteConfirm`, `deleteFailed`, `backlinks`, `backlinksEmpty`, `graphLoading`, `graphEmpty`, `graphFailed`, `viewNotes`, `viewGraph`, `createNote`, `addTag`, `star`, `unstar`. No `STR` shape changes beyond the `notes` object (strings.ts L158 `as const`).

---

### `src/components/core/PortableMarkdown.tsx` (MODIFY — optional wikilinks prop)

**Analog: itself** (Pitfall 3 — the CONTEXT claim of "wikilink styling hooks" is false; there are none today). Add an OPTIONAL prop, default undefined → byte-identical for existing consumers; DOMPurify stays unconditional (R-10/T-1-07):
```typescript
export interface PortableMarkdownProps {
  content: string;
  trust?: 'retrieved' | 'untrusted';
  className?: string;
  style?: CSSProperties;
  /** Phase 5: optional wikilink resolution (default undefined → zero behavior change). */
  wikilinks?: { resolve: (title: string) => { id?: string } | null };
}
```
Mechanism is planner discretion (Open Q4): pre-process `[[…]]` into link spans before XMarkdown OR a `NoteBody` wrapper delegating the rest. Resolved → clickable colorPrimary link; unresolved → muted/dashed + "Create note" affordance (UI-SPEC Color/D-05-14). Current body (L28-34) for the extension point:
```typescript
export function PortableMarkdown({ content, trust = 'untrusted', className, style }: PortableMarkdownProps) {
  if (!content || content.trim().length === 0) return null;
  const sanitized = DOMPurify.sanitize(content);
  return (
    <div className={className} style={style} data-trust={trust}>
      <XMarkdown content={sanitized} escapeRawHtml />
    </div>
  );
}
```

---

### `src/components/pages/NotesPage.tsx` (REPLACE placeholder) + `src/components/notes/*` (create)

**Analog:** `src/components/pages/OptionsPage.tsx` (antd page + ErrorBoundary + App.useApp notification + STR imports) and `src/components/cmdk/CmdKPicker.tsx` (a11y combobox state for WikilinkAutocomplete).

**Page skeleton to copy** (OptionsPage.tsx L17-25 imports + L74-76 wrapper):
```typescript
import { App, Button, Card, Divider, Empty, Input, List, Segmented, Tag, Popconfirm, Skeleton, Space, Typography } from 'antd';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { STR } from '@/core/i18n/strings';
// ...
return (
  <ErrorBoundary>
    {/* page header row: SearchOutlined Input + Segmented Notes|Graph + [New note from page] + [New note] */}
    {/* Notes view: list column (~300px) + editor column (title 20/600 + star + tags + TextArea/PortableMarkdown + BacklinksPanel) */}
    {/* Graph view: NoteGraphView full-pane */}
  </ErrorBoundary>
);
```

**Combobox state pattern for WikilinkAutocomplete** (CmdKPicker.tsx L68-89 — controlled/open state + highlighted index + keydown handling; the a11y contract is binding: `aria-haspopup="listbox"`, `aria-expanded`, `aria-activedescendant`, `role="listbox"`/`role="option"`, UI-SPEC Interaction Contract):
```typescript
const [internalOpen, setInternalOpen] = useState(false);
const [query, setQuery] = useState('');
const [highlighted, setHighlighted] = useState(0);
// ↑/↓ move the active item, Enter/Tab inserts [[Title]] at the caret, Esc closes
```
MiniSearch title matching drives the options (< 50 ms p95 ≤ 5,000 notes); custom anchored popover over the TextArea (Open Q5 — antd AutoComplete's text-input coupling fights caret insertion); dropdown max-height ~320 px + internal scroll (UI-SPEC ⚠ unresolved item).

**Star toggle (D-05-16):** persist membership in `WorkspaceStore.workspace.selectedNotes: string[]` — the D-18 declared field, inert since Phase 1 (WorkspaceStore.ts L66), activated as the favorites set — no type widening, no new storage key (UI-SPEC L234). **Save pipeline** (D-05-15): `parseLinks` → `resolveLinks` → `NotesDB.put` → `EventBus.emit('note:saved', {noteId})` → MiniSearch incremental add + graph/backlinks re-derivation. Write paths never throw; failure → `STR.notes.saveFailed` inline retry. Delete → Popconfirm (`STR.notes.deleteConfirm`, danger `colorError`) → `deleteNote` → rebuild (WIKI-ID-04 dangling edges). Dirty guard → Popconfirm `STR.notes.discard`.

**NoteGraphView (d3-force ^3, no analog):** RESEARCH Common Operation 4 (05-RESEARCH.md L442-452):
```typescript
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force';
const simulation = forceSimulation(nodes)
  .force('link', forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(80))
  .force('charge', forceManyBody().strength(-200))
  .force('center', forceCenter(width / 2, height / 2));
simulation.on('tick', () => { /* update <circle>/<line> positions in SVG */ });
// reduced-motion: const positions = simulation.tick(300) → render final layout directly, stop() (UI-SPEC Motion)
```
Install task (early plan item): `pnpm add d3-force@^3`. d3-force is runtime-only — import ONLY in NoteGraphView.tsx (Standalone bundle; R-3 — never side panel/background SW). Tests: jsdom + manual `simulation.tick(n)` (synchronous, no rAF — Pitfall 6); graph DATA derivation (`NoteGraph`) tests run in node env. `< 3` notes → `STR.notes.graphEmpty` (never render the simulation below 3 nodes — UI-SPEC L286). Node colors from theme tokens at runtime, never hex (UI-SPEC Color).

---

## Shared Patterns

### 1. Write paths never throw + GR-9 debugLog (PATTERNS Shared Pattern 1 — applies to ALL stores + NotesPage handlers)
**Source:** `src/core/storage/NotesDB.ts` L84-95 (putNote) — copy the exact try/catch/debugLog shape. Every catch calls `debugLog(ERROR_CODES.STORE_READ|STORE_WRITE, …, { error, module, extra })`. Read failures return `[]`/`undefined` fallbacks. New Phase-5 codes (`MEMORY_*`/`NOTE_*`/`SEARCH_*`) go to errorCodes.ts; stores reuse `STORE_READ`/`STORE_WRITE`.

### 2. Budgets via estimateTokens — the ONLY token counter (Pitfall 1)
**Source:** `src/core/context/TokenBudget.ts` L36-44. MemoryEngine budget enforcement (≤1000 tokens memory, ≤300 working memory), ContextPack section tokens, and any memory-text assembly ALL use `estimateTokens(text)`. Degradation is whole-item drops (top-5 → top-3 → empty), never a substring slice (D-04-13/D-05-06; the only sanctioned slice is the O.10 working-memory tail trim).

### 3. GR-4 Zod boundary gates (Zod + one repair)
**Source:** `src/core/ai/StructuredOutput.ts` (requestJson L92-167) + co-located schema precedent (`src/types/harness.ts` L211-251). New boundaries: `UserPreferencesSchema` (np_persona write), `MemoryExtractorResultSchema` (via requestJson), `MemoryInjection` DTO, note store boundary. Structured LLM output: exactly one repair then `STRUCTURED_OUTPUT_FAILED`, never hand-parsed JSON.

### 4. R-10 redaction on every memory path
**Source:** `src/core/security/TraceRedactor.ts` / `redactSensitive.ts` (import in IndexedDBMigrator.ts L41 precedent). Working-memory writes redact via `TraceRedactor.redact(value)` (O.10 verbatim); MemoryExtractor system prompt forbids secrets; debugLog auto-routes through TraceRedactor — never log raw prompt/tool bodies.

### 5. Pure/deterministic core rule
**Source:** `src/core/context/ContextOptimizer.ts` L31-32 + `contextFeed.ts` L13. MemoryEngine's pure surface, MemoryScorer, LinkParser, NoteGraph: zero chrome/async/Date.now/crypto — the only clock is the injected `nowMs` (Pitfall 6 precedent). All IndexedDB/chrome-bound work lives in the hook (Pitfall 5).

### 6. Canonical i18n (Golden Rule 2)
**Source:** `src/core/i18n/strings.ts` notes block L54-78 + 05-UI-SPEC Copywriting Contract L126-153. All new copy is verbatim from the UI-SPEC table, keyed `STR.notes.*`; no inline strings in components.

### 7. verify:phase-5 script shape (D-05-19)
**Source:** `package.json` `verify:phase-4b` line — copy the §24 chain exactly: `"verify:phase-5": "eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run"`. The spec's narrow gate (`tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts`) requires those test paths to EXIST (all new — Wave 0 gaps in RESEARCH).

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md pattern code instead):

| File | Role | Data Flow | Reason / Research Reference |
|------|------|-----------|-----------------------------|
| `src/core/notes/LinkParser.ts` | utility | transform | Pure regex/tie-break logic — no prior parser in repo. RESEARCH Common Operation 5 (WIKI-ID-02 verbatim) |
| `src/core/notes/NoteGraph.ts` | utility | transform | Derived-edge graph math — no prior graph code. RESEARCH Pattern 4 (anti-pattern: no graph store) |
| `src/components/notes/NoteGraphView.tsx` | component | event-driven | First d3-force consumer — d3-force ^3 must be installed (early task). RESEARCH Common Operation 4 + Pitfall 6 (jsdom tick-stepping) |

## Metadata

**Analog search scope:** `src/core/storage/*`, `src/core/memory/*`, `src/core/context/*` (+ `trust/`), `src/core/ai/*` (+ `persona/`), `src/core/extraction/*`, `src/core/events/*`, `src/core/error/*`, `src/core/i18n/*`, `src/components/pages/*`, `src/components/cmdk/*`, `src/components/core/*`, `src/core/workspace/*`, `src/types/*`, `tests/core/storage/*`, `tests/core/context/*`
**Files scanned:** 30+ source files, 3 planning artifacts (05-CONTEXT.md / 05-RESEARCH.md / 05-UI-SPEC.md)
**Pattern extraction date:** 2026-08-13
**Key open decisions handed to planner:** np_persona dual-shape read (Open Q1), MemoryDB userFacts v1→v2 migration (Open Q2/A3), per-stage assemble vs top-5-once (Open Q3), PortableMarkdown wikilink mechanism (Open Q4), autocomplete widget (Open Q5), trustPrefs.memory gate location (Open Q6), Phase-5 error code vocabulary (Open Q7), ConversationMeta persistence target (Open Q8) — all with RESEARCH recommendations.
