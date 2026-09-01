# Phase 8: Knowledge Base (Memory + MiniSearch + Notes) - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 24 new/modified (13 new modules + 4 new type homes/components + 5 edits + 2 config/test edits)
**Analogs found:** 22 / 24 (2 no-analog: WorkingMemory redaction seam, NoteGraph stop-word list — both spec-prescribed verbatim)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/types/notes.ts` (NEW) | types | CRUD (type defs) | `src/types/harness.ts` | exact (canonical type home) |
| `src/core/memory/types.ts` (NEW) | types | CRUD (type defs) | `src/types/harness.ts` + `src/core/context/types.ts` | exact (canonical type home) |
| `src/core/memory/ConversationMemoryStore.ts` (NEW) | store | CRUD + batch (compactor) | `src/core/storage/MemoryDB.ts` (bodies) + `src/core/ai/UserPreferences.ts` (persist) | role-match |
| `src/core/memory/UserMemoryStore.ts` (NEW) | store | CRUD + LRU | `src/core/ai/UserPreferences.ts` (persist+partialize) + `src/core/storage/MemoryDB.ts` | role-match |
| `src/core/memory/PreferenceMemoryStore.ts` (NEW) | store | CRUD | `src/core/ai/UserPreferences.ts` | exact (zustand persist + chromeStorageAdapter) |
| `src/core/memory/MemoryScorer.ts` (NEW) | utility | transform | `src/core/context/TokenBudget.ts` | exact (pure fns + verbatim constants) |
| `src/core/memory/MemoryExtractor.ts` (NEW) | utility | transform | `src/core/ai/persona/PersonaProfile.ts` (zod schema) | role-match |
| `src/core/memory/MemoryEngine.ts` (NEW) | service | request-response (retrieval orchestration) | `src/core/extraction/PageContentService.ts` | exact (per-surface singleton orchestrator, create-only) |
| `src/core/memory/WorkingMemory.ts` (NEW) | utility | transform | `src/core/security/redactSensitive.ts` + `src/core/context/TokenBudget.ts` | role-match |
| `src/core/search/MiniSearchIndex.ts` (NEW) | service | event-driven + CRUD | `src/core/extraction/PageIndexBuilder.ts` | exact (lazy/memoized MiniSearch wrapper) |
| `src/core/notes/LinkParser.ts` (NEW) | utility | transform | `src/core/extraction/PageIndexBuilder.ts` (chunkMarkdown pure fn) | role-match |
| `src/core/notes/NoteGraph.ts` (NEW) | service | transform | `src/core/context/TokenBudget.ts` + `src/core/context/trust/contextItems.ts` (sort/tie-break) | role-match |
| `src/core/notes/save.ts` (NEW, discretion) | utility | event-driven | `src/core/extraction/PageIndexBuilder.ts` (wireEvictionHook) + `src/core/events/EventBus.ts` | role-match |
| `src/components/notes/BacklinksPanel.tsx` (NEW) | component | request-response | `src/components/notes/NotesWorkspace.tsx` | role-match |
| `src/components/notes/WikilinkAutocomplete.tsx` (NEW) | component | request-response | `src/components/notes/NotesWorkspace.tsx` | role-match |
| `src/components/notes/NoteGraphView.tsx` (NEW) | component | request-response | `src/components/notes/NotesWorkspace.tsx` | role-match |
| `src/types/harness.ts` (EDIT) | types | — | existing file (append-only, C.1 convention) | exact edit |
| `src/core/storage/NotesDB.ts` (EDIT) | storage | CRUD | `src/core/context/types.ts:22-23` (D-83 re-export precedent) | exact edit |
| `src/core/storage/MemoryDB.ts` (EDIT) | storage | CRUD | `src/core/context/types.ts:22-23` (D-72 re-export precedent) | exact edit |
| `src/core/ai/UserPreferences.ts` (EDIT) | store | CRUD | `src/core/context/types.ts:22-23` + own lines 54-58/98-102 | exact edit |
| `src/core/context/types.ts` (EDIT) | types | — | own lines 22-23 (D-83 precedent) + lines 25-32 (supersession point) | exact edit |
| `src/core/storage/WriteJournal.ts` (EDIT) | utility | batch | own `createChatTurnSteps` factory (297-329) + `registerJournalSteps` (78-83) | exact edit |
| `package.json` (EDIT) | config | — | D-92/D-103 precedent (07-03-PLAN.md:118) | exact edit |
| `tests/core/memory/*.test.ts` (NEW ×3) | test | — | `tests/core/storage/IndexedDBMigrator.test.ts` + `tests/core/extraction/PageIndexBuilder.test.ts` | role-match |
| `tests/core/search/MiniSearchIndex.test.ts` (NEW) | test | — | `tests/core/extraction/PageIndexBuilder.test.ts` | exact |
| `tests/core/notes/LinkParser.test.ts` (NEW) | test | — | `tests/core/extraction/PageIndexBuilder.test.ts` (pure-fn style) | role-match |

---

## Pattern Assignments

### `src/types/notes.ts` (types, CRUD — canonical Note home, D-107/D-108)

**Analog:** `src/types/harness.ts` (canonical type home, C.1 verbatim convention)

**File-header/doc convention** (harness.ts lines 3-19):
```typescript
/**
 * Canonical Phase-8 note-type home — Appendix C.1 / §21.2
 * (PRODUCT_SPEC_v0_1.md:4720-4741), verbatim.
 *
 * This file is the SINGLE canonical declaration site for the `Note` type
 * (D-107). No parallel copy in src/core/storage — the alias target is
 * authoritative (spec 4833 canonical-home rule).
 */
```

**Core pattern — verbatim interface + exported constant** (harness.ts:21-32 style; spec 4721-4741):
```typescript
export interface Note {
  id: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  tags: string[];
  links: string[];                    // resolved note IDs (WIKI-ID-02)
  unresolvedLinks: string[];          // raw [[Title]] targets with no match (WIKI-ID-03)
  source: { kind: 'manual'|'voice'|'chat-export'|'template'|'page-export'; conversationId?: string; templateId?: string };
  aiMeta: {
    suggestedLinks: Array<{ targetId: string; confidence: number; reason: string }>;
    concepts: string[];
    lastWikiRunAt?: number;
  };
  summary?: string;
  categoryPath?: string;              // declared Phase 8, populated Phase 9 (D-108)
  type?: string;                      // OKF v0.2 — default 'Note'; declared Phase 8, serialized Phase 9 (D-108)
  version: number;
}
export const OKF_NOTE_DEFAULT_TYPE = 'Note';
```
Also export `OkfNoteFrontmatter` + LLM-WIKI-11 suggestion-gating constants (spec 4758-4762, declared for Phase 9). Path alias: `@/types/notes` (per RESEARCH Pattern 3).

---

### `src/core/memory/types.ts` (types — canonical RetrievedMemory + UserPreferences + UserMemoryFact, D-112)

**Analog:** `src/types/harness.ts` (canonical home) + `src/core/context/types.ts:22-32` (supersession-point shape)

**Supersession comment + verbatim shape** (context/types.ts:25-32 — the pattern to REPLACE, verbatim shape spec 4572-4578):
```typescript
/** RetrievedMemory supersession point — Phase 8 owns src/core/memory/types.ts (spec 4572-4578). */
export interface RetrievedMemory {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'pattern';
  tags: string[];
  score: number;
}
```

**UserPreferences full §3.5 shape** (spec 4579-4595 + additive D-54 fields) — same zod pattern as the Phase-3 source, now canonical here:
- Declare `UserPreferencesSchema` + `type UserPreferences` verbatim (responseStyle / preferredLanguage / preferStructuredOutput / allowCloudFallbackFromLocal / defaultProviderId? / toolAutonomy / defaultSurface / personaId? / personaOverrides? + `fastModel?` / `balancedModel?` additive D-54).
- Also host the canonical §3.4 `UserMemoryFact` shape (RESEARCH Open Q1 recommendation): `{ id, content, type: 'fact'|'preference'|'pattern', tags, confidence, source: 'explicit'|'inferred'|'system', createdAt, updatedAt, lastUsedAt?, useCount }` (spec 601-612) — MemoryDB imports/re-exports it (D-72 precedent).
- **Scope fence:** do NOT declare `MemoryKind`/`MemoryRecord` — Phase 10 (spec 4903-4915; canonical home `@/types/harness`).

---

### `src/core/memory/ConversationMemoryStore.ts` (store, CRUD + batch compactor — D-104/D-106)

**Analog:** `src/core/storage/MemoryDB.ts` (bodies) + `src/core/ai/UserPreferences.ts` (chrome.storage.local persist)

**Bodies → MemoryDB** (write-through pattern, MemoryDB.ts:71-92 — reuse `openMemoryDB()`; do NOT re-open idb directly):
```typescript
export async function openMemoryDB() {
  return openVersionedDB<MemoryDBV1>(MEMORY_DB, MEMORY_DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) { /* messages [conversationId,seq] + userFacts + conversationSummaries */ }
      // Future: if (oldVersion < 2) { ... } — forward-migration contract (D-41).
    },
    blocked() { /* IDB_BLOCKED — bootstrap() handles degraded-mode recording. */ },
  });
}
```
Compound-key constraint (MemoryDB.ts:12-15): messages store keyPath `[conversationId, seq]` — the value MUST carry both fields. Use `db.getAllFromIndex('messages', 'byConversation', conversationId)` for turn reads.

**Metadata → chrome.storage.local** (`np_conversation_meta`, LRU 10 active / 100 archived) — zustand persist pattern (UserPreferences.ts:66-105, see PreferenceMemoryStore section) OR direct `chromeStorageAdapter.setItem` if not store-shaped (discretion).

**Compactor seam (D-106, §15.3 verbatim):** `messageCount % 12 === 0` → keep head (system + first 2) + stub summary + tail (last 4); archive after 30 min idle; evict via WriteJournal `'evict-conversation'` (op already in union — src/types/storage.ts:48). Summariser = pluggable seam — inject a deterministic stub in tests (context/types.ts:52-54 `Summarizer` interface is the seam-shape precedent):
```typescript
export interface Summarizer {
  summarize(sections: PromptSection[]): { text: string; tokens: number };
}
```

---

### `src/core/memory/UserMemoryStore.ts` (store, CRUD + LRU ≤500 — D-104/D-113)

**Analog:** `src/core/ai/UserPreferences.ts` (persist + partialize) + `src/core/storage/MemoryDB.ts` (bodies)

**Facts → MemoryDB.userFacts** (write-through `openMemoryDB()`, keyPath 'id'); **metadata index → chrome.storage.local `np_facts`** (ids + recency + useCount, max 500 LRU, §15.1).

**LRU eviction shape** — mirror the partialize pattern (UserPreferences.ts:98-102) for what persists under `np_facts`:
```typescript
partialize: (state) => ({
  fastModel: state.fastModel,
  balancedModel: state.balancedModel,
  personaOverrides: state.personaOverrides,
}),
```
For np_facts this becomes the metadata index record (`{ id, updatedAt, useCount }[]` capped at 500 — evict lowest useCount/oldest when full). Scoring reads this metadata WITHOUT opening IDB (D-104 A6: perf).

**Never secrets (§3.4):** bodies pass through `redactSensitiveValue` before IDB write (redactSensitive.ts:67-71 — see Shared Patterns).

---

### `src/core/memory/PreferenceMemoryStore.ts` (store, CRUD — np_persona owner, RICH-R-05 / D-112)

**Analog:** `src/core/ai/UserPreferences.ts` — EXACT (zustand + persist + chromeStorageAdapter + immer)

**Core store pattern** (UserPreferences.ts:66-105 verbatim — the template for np_persona):
```typescript
export const useUserPreferencesStore = create<UserPreferencesStore>()(
  persist(
    immer((set, _get, api) => ({
      ...initialPreferences,
      setFastModel: (fastModel: string) =>
        set((state) => { state.fastModel = fastModel; }),
      hydrate: async () => {
        await api.persist.rehydrate();
      },
    })),
    {
      name: 'np_preferences',                                   // → name: 'np_persona'
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({ /* only persisted fields */ }),
      version: 1,
    },
  ),
);
```
**np_persona payload shape** (RESEARCH A3): `{ personaId, persona: PersonaProfile, personaOverrides? }` — `PersonaProfileSchema` + `DEFAULT_PERSONA` imported from `@/core/ai/persona/PersonaProfile` (lines 7-40; R2: persona is user *config*, NEVER written to MemoryDB.userFacts). zod-validate on hydrate (zod v4 — `z.object`, `.safeParse`; see PersonaProfile.ts:7-23).

**Hydration on boot** re-reads np_persona (UserPreferences.ts:91-93 `hydrate: async () => { await api.persist.rehydrate(); }`).

---

### `src/core/memory/MemoryScorer.ts` (utility, transform — §3.4 verbatim, D-113)

**Analog:** `src/core/context/TokenBudget.ts` — EXACT (pure functions + exported spec-verbatim constants)

**Pure-function module pattern** (TokenBudget.ts:44-52 + 70-79):
```typescript
export function countTokensHeuristic(text: string): number { /* pure, deterministic */ }
export const DISTRIBUTION: Record<ModelContextTier, Record<BudgetCategory, number>> = { ... };
```
**§3.4 scoring formula (spec 618-628 verbatim — NO invented weights):**
```typescript
// keywordScore = matchedQueryTerms / totalQueryTerms
// tagScore     = matchedTags / max(1, memoryTags.length)
// recencyScore = clamp(1 - (now - updatedAt) / (30 * DAY), 0, 1)   // 30-day window
// useCountScore = min(1, useCount / 20)
// confidenceScore = confidence
// score = keywordScore*0.45 + tagScore*0.25 + recencyScore*0.15
//       + useCountScore*0.10 + confidenceScore*0.05
```
Export the weights as named constants (`MEMORY_SCORE_KEYWORD = 0.45`, etc.) in the TokenBudget style so the score test can assert them. Every sub-score normalised to [0,1] (ROADMAP SC#3).

---

### `src/core/memory/MemoryExtractor.ts` (utility, transform — schema + parse seam, D-113)

**Analog:** `src/core/ai/persona/PersonaProfile.ts` (zod schema module)

**Schema module pattern** (PersonaProfile.ts:7-23):
```typescript
export const PersonaProfileSchema = z.object({
  id: z.string().min(1),
  identity: z.object({ /* nested */ }),
  // ...
});
export type PersonaProfile = z.infer<typeof PersonaProfileSchema>;
```
**memoryFacts schema** (mirrors NoteTagResultSchema/ConfidentFact, spec 4764-4773):
```typescript
const ConfidentFact = z.object({ content: z.string(), confidence: z.number().min(0).max(1) });
```
Ship the schema + a `parse(output: string): MemoryFact[]` seam (`.safeParse`); the LLM call + NMEM-02 upsert wiring is Phase 9 (spec 3876). Do NOT call the LLM.

---

### `src/core/memory/MemoryEngine.ts` (service, request-response — create-only producer, D-105)

**Analog:** `src/core/extraction/PageContentService.ts` — EXACT (per-surface singleton orchestrator, create-only, typed result)

**Per-surface singleton + typed result union** (PageContentService.ts:1-45 pattern):
```typescript
// PageContentService — per-surface module singleton orchestrator for the
// layered page extraction read path (D-81: create-only — no pipeline wiring,
// no surface call-sites this phase).
/** Typed result union — never a silent empty result (D-91). */
export type ExtractResult =
  | { ok: true; context: PageContext; metrics: ExtractionMetrics }
  | { ok: false; code: 'CONTENT_EXTRACT_FAILED'; message: string; cause?: unknown };
```
**MemoryEngine methods (D-105):** `retrieveConversationMemory(id)`, `retrieveUserMemory(query)` (top-5 / top-3 tiny / ≤1000 tokens via `countTokensHeuristic`), `buildPreferenceProfile()` (compact JSON incl. persona overrides — the `prefsCompact` shape at contextItems.ts:143-152 is the rendering precedent), `retrieveMemoryHints(): RetrievedMemory[]`. Each is a facade over the stores + scorer; no direct idb imports (stores own connections). Export object-form namespace (`export const MemoryEngine = { ... }` — ProviderRegistry/PageIndexBuilder:254-261 convention).

**Import wiring for `RetrievedMemory`:** keep resolving via `@/core/context/types` re-export (do NOT edit ContextOptimizer/AgentOrchestrator — D-105).

---

### `src/core/memory/WorkingMemory.ts` (utility, transform — O.10 with redaction swap)

**Analog:** `src/core/security/redactSensitive.ts` + `src/core/context/TokenBudget.ts` (Pitfall 1: TraceRedactor is Phase 11 — use `redactSensitiveValue` now)

**O.10 shape (spec 6596-6622) with the redaction swap** (RESEARCH Code Examples):
```typescript
import { WORKING_MEMORY_TEMPLATE, type WorkingMemory } from '@/types/harness';  // canonical home (C.1)
import { redactSensitiveValue } from '@/core/security/redactSensitive';         // TODO(Phase 11): swap to TraceRedactor

const MAX_WORKING_MEMORY_TOKENS = 300;   // §3.6
export function initWorkingMemory(resourceId: string): WorkingMemory { /* template + estimate */ }
export function updateWorkingMemory(cur: WorkingMemory, patch: Partial<Record<
  'Name' | 'Role / Team' | 'Environment' | 'Preferences' | 'Long-term Goals', string>>): WorkingMemory {
  // redactSensitiveValue each value before the md.replace — §4.4 never store secrets
}
const estimate = (s: string) => Math.ceil(s.length / 4);   // same heuristic as countTokensHeuristic(len/4)
```
Single-writer: gate writes on `isPrimaryWriter()` (WorkspaceStore.ts:23-25). Persist the ≤300-token block with the np_facts metadata (chrome.storage.local, D-104).

---

### `src/core/search/MiniSearchIndex.ts` (service, event-driven + CRUD — D-109)

**Analog:** `src/core/extraction/PageIndexBuilder.ts` — EXACT (lazy/memoized MiniSearch wrapper, never persisted)

**Index construction** (PageIndexBuilder.ts:145-153 — fields swapped to the search-notes contract spec 1608):
```typescript
export function buildIndex(docs: NoteDoc[]): MiniSearch<NoteDoc> {
  const index = new MiniSearch<NoteDoc>({
    fields: ['title', 'content', 'tags', 'summary'],           // search-notes contract (spec 1608)
    storeFields: ['title', 'content', 'tags', 'summary'],
    searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.2 },
  });
  index.addAll(docs);
  return index;
}
```
NoteDoc: `{ id: note.id, title: note.title, content: note.content, tags: note.tags.join(' '), summary: note.summary ?? '' }` (RESEARCH A2). `NoteHit = { id: string; score: number } & NoteDoc`.

**Lazy/memoized singleton + never persisted** (PageIndexBuilder.ts:159-172, 179):
```typescript
let index: MiniSearch<NoteDoc> | null = null;   // per-surface lazy singleton (Map<tabId> NOT needed — one notes index)
let lazyBuildCount = 0;

function getIndex(db: IDBPDatabase<NotesDBV1>): MiniSearch<NoteDoc> {
  if (index !== null) return index;             // memoized
  index = buildIndex(await seedFromNotesDB(db));
  lazyBuildCount += 1;
  return index;
}
// query: cast stored fields (Pitfall 5) — PageIndexBuilder.ts:175-180
return getIndex(db).search(q) as unknown as NoteHit[];
```
**Zero storage-area imports** (grep-assertable, same as PageIndexBuilder — D-109/§26.5: never persisted; rebuilt from NotesDB on surface boot).

**Incremental upsert on `note:saved`** — wire at module load, re-invocable (PageIndexBuilder.ts:219-230):
```typescript
let noteSavedUnsubscribe: (() => void) | undefined;
function wireNoteSaved(): void {
  noteSavedUnsubscribe?.();
  noteSavedUnsubscribe = on(NOTE_SAVED_EVENT, (payload: NoteSavedPayload) => { void upsert(payload.noteId); });
}
wireNoteSaved();
```
(EventBus.on returns unsubscribe — EventBus.ts:16-25. Delete path: expose `remove(noteId)` → `index.discard(noteId)` — RESEARCH Open Q4.)

**__test__ seam** (PageIndexBuilder.ts:237-252 — copy verbatim shape):
```typescript
export const __test__ = {
  reset(): void { index = null; lazyBuildCount = 0; wireNoteSaved(); },
  get buildCount(): number { return lazyBuildCount; },
};
export const MiniSearchIndex = { getIndex, query, upsert, remove, __test__ };
```

---

### `src/core/notes/LinkParser.ts` (utility, transform — D-110)

**Analog:** `src/core/extraction/PageIndexBuilder.ts` (pure regex transform — chunkMarkdown)

**Pure-function module with exported constants** (PageIndexBuilder.ts:59-61 pattern):
```typescript
const PARAGRAPH_BREAK = /\n\s*\n/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
```
**parseLinks** — wikilink regex: `export const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;` extracting `[[Title]]` targets from the markdown body.

**resolveLinks with WIKI-ID-02 tie-break** (Pitfall 4 — do NOT use `getNoteByTitle`; it returns first hit, NotesDB.ts:88-93):
```typescript
// query getAllFromIndex('notes', 'byTitle', title), filter exact title matches,
// sort by updated desc then id asc (spec 3902 verbatim), take the first.
const hits = await db.getAllFromIndex('notes', 'byTitle', title);
const exact = hits.filter((n) => n.title === title)
  .sort((a, b) => b.updated - a.updated || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
```
Resolved → `links[]` (IDs); no match → `unresolvedLinks[]` (raw `[[Title]]` string, WIKI-ID-03).

---

### `src/core/notes/NoteGraph.ts` (service, transform — §22.3 verbatim, D-111)

**Analog:** `src/core/context/TokenBudget.ts` (pure module + exported constants) + `contextItems.ts:136-139` (tie-break sort)

**§22.3 cosine (spec 3508-3514 verbatim):**
```typescript
export const STOP_WORDS: readonly string[] = [ /* exactly 50 common English stop-words — pinned by `expect(STOP_WORDS).toHaveLength(50)` (Pitfall 8) */ ];
// tokenise: content.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
// per-note term-frequency map; cosine = dot(a,b) / (||a|| * ||b||)
// ties broken by updated desc then id asc (same comparator as LinkParser)
export function topKSimilar(note: Note, allNotes: Note[], k = 5): Array<{ note: Note; score: number }> { ... }
```
**Backlinks** = reverse index over `links[]`: `export function computeBacklinks(notes: Note[]): Map<string, string[]>` (noteId → referencing note IDs).

---

### `src/core/notes/save.ts` (utility, event-driven — discretion seam, D-110)

**Analog:** `src/core/extraction/PageIndexBuilder.ts` (module-load wiring) + `src/core/events/EventBus.ts`

**Flow-3-minus-LLM save core + typed event constant** (Pitfall 6 — declare the event here; do NOT edit EventBus.ts):
```typescript
export const NOTE_SAVED_EVENT = 'note:saved';
export interface NoteSavedPayload { noteId: string }
// saveNote(note) = parseLinks → resolveLinks → NotesDB.put → emit(NOTE_SAVED_EVENT, { noteId })
```
Emit via EventBus.emit (EventBus.ts:27-37 — swallow-safe). MiniSearchIndex subscribes at module load (see above).

---

### `src/components/notes/{BacklinksPanel, WikilinkAutocomplete, NoteGraphView}.tsx` (component, request-response — core logic only, D-111)

**Analog:** `src/components/notes/NotesWorkspace.tsx` (the existing notes component scaffold)

**Component skeleton** (NotesWorkspace.tsx:194-205 — the established convention):
```tsx
export const NotesWorkspace: React.FC = () => {
  const { message: antMessage } = App.useApp();
  const { token } = useToken();
  const { notes: storeNotes, addNote, deleteNote, toggleFavoriteNote } = useExtensionStore();
  const [selectedNoteId, setSelectedNoteId] = useState<string>('n1');
  // ...
};
```
Imports: `React, { useState }` + antd (`Input`, `Button`, `Tag`, `Tooltip`, `App`, `Typography`, `theme`) + `@ant-design/icons` + `useExtensionStore` (NotesWorkspace.tsx:1-49). The Phase-8 components are THIN: core logic delegates to `NoteGraph.computeBacklinks`/`topKSimilar` and `MiniSearchIndex.query` (autocomplete = MiniSearch title matching per D-04 — no LLM suggestions). Render through React JSX only — NO `dangerouslySetInnerHTML` (XSS mitigation). Full NotesWorkspace integration is Phase 15 (scope fence).

---

### Edits — canonical-type supersessions (D-72/D-83/D-107/D-112)

**`src/types/harness.ts` (EDIT):** append the C.1 `WorkingMemory` + `WORKING_MEMORY_TEMPLATE` (§3.6, spec 678-684) in the existing verbatim-convention style (harness.ts:3-19 header + 21-32 interface). No other edits.

**`src/core/storage/NotesDB.ts` (EDIT):** delete the local placeholder `Note` (lines 26-37); import + re-export the canonical type (D-83 precedent, context/types.ts:22-23):
```typescript
/** D-107: canonical Note re-exported from the Phase-8 home (spec 4721-4741). */
export type { Note } from '../../types/notes';
```
Keep `Concept`, `openNotesDB`, `getNoteByTitle` untouched (getNoteByTitle stays a first-hit helper — do NOT rely on it for resolution, Pitfall 4).

**`src/core/storage/MemoryDB.ts` (EDIT):** reconcile `UserMemoryFact` (lines 37-45) to the canonical §3.4 shape — import/re-export from `@/core/memory/types` (RESEARCH Open Q1; write-empty stores = zero migration). Optionally extend `MemoryMessage.role` with `'tool'` only if tool turns are stored (A5).

**`src/core/ai/UserPreferences.ts` (EDIT):** re-export `UserPreferences` (+ schema) from `@/core/memory/types`; the local zod schema (lines 36-44) is superseded. Pitfall 3: the full §3.5 shape adds REQUIRED fields → `initialPreferences` (lines 54-58) needs defaults for the new required fields; keep `partialize` (98-102) persisting fastModel/balancedModel (drop personaOverrides from partialize ONLY if no live reader — RESEARCH Open Q3: grep before dropping).

**`src/core/context/types.ts` (EDIT):** replace local `RetrievedMemory` (lines 26-32) with a re-export (D-83 precedent, lines 22-23):
```typescript
/** D-112: RetrievedMemory re-exported from the canonical Phase-8 home (spec 4571). */
export type { RetrievedMemory } from '../memory/types';
```
`ToolSchemaRef` (lines 34-41) stays (Phase 18 owns it).

**`src/core/storage/WriteJournal.ts` (EDIT):** register `'evict-conversation'` JournalSteps (D-106 §15.3). Curried-factory precedent (`createChatTurnSteps`, lines 297-329):
```typescript
export function createEvictConversationSteps(deps: EvictConversationDeps): EvictConversationStepsBuilder {
  return (payload: EvictConversationPayload): JournalStep[] => [ /* delete conversation rows (MemoryDB.messages) + drop np_conversation_meta LRU entry */ ];
}
```
Register via `registerJournalSteps('evict-conversation', ...)` (lines 78-83) — the op is already in the union (src/types/storage.ts:48).

**`package.json` (EDIT):** line 26 — replace `"verify:phase-8": "tsc --noEmit && vitest run tests/core/content tests/addons tests/isolation"` with `"verify:phase-8": "tsc --noEmit && vitest run tests/core/memory tests/core/search tests/core/notes/LinkParser.test.ts"` (spec 3612 verbatim, D-114 — D-92/D-103 precedent; verify via `node -e` exact-string assert per 05-02-PLAN.md:130).

---

### Test files (5 §18 required + E2E + perf)

**DB-backed store tests** — `tests/core/storage/IndexedDBMigrator.test.ts:43-48` conventions:
```typescript
describe('...', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();          // fresh fake-indexeddb factory
    const migrator = await import('../../../src/core/storage/IndexedDBMigrator');
    migrator.clearMigrations('FixtureDB');
  });
```
Also reset `(globalThis as any).__chromeStorageMap` (tests/setup.ts:56-80) between tests for chrome.storage.local keys (np_facts/np_persona/np_conversation_meta).

**MiniSearchIndex.test.ts** — copy `tests/core/extraction/PageIndexBuilder.test.ts` structure (lines 1-38): `import { __test__ as indexTest } from '@/core/search/MiniSearchIndex'`, `beforeEach(() => indexTest.reset())`; perf gate: index 1,000 synthetic notes, `expect(Date.now() - t0).toBeLessThan(50)` (spec 3481).

**Pure-function tests** (MemoryScorer, LinkParser) — `PageIndexBuilder.test.ts` pure-fn style (lines 40-100): direct imports, no mocks, fixture literals. **MemoryEngine.test.ts** — inject deterministic stub summariser (D-106), assert `buildPreferenceProfile()` includes persona overrides (RICH-R-05 DONE-when). E2E test: PageContext → Note creation → NotesDB.put → index upsert → query (D-105, service-level, no UI).

---

## Shared Patterns

### Canonical type home + re-export supersession (D-72/D-83/D-107/D-112)
**Source:** `src/core/context/types.ts:22-23`
**Apply to:** `src/types/notes.ts`, `src/core/memory/types.ts`, NotesDB.ts, MemoryDB.ts, context/types.ts, ai/UserPreferences.ts
```typescript
/** D-83: PageContext family re-exported from the canonical Phase-6 home (spec 4345-4391). */
export type { PageContext, TabContext, SNowCaseData, FileContext, NoteContext } from '../content/PageContext';
```

### Lazy/memoized per-surface MiniSearch singleton, never persisted (D-109)
**Source:** `src/core/extraction/PageIndexBuilder.ts:145-180, 219-261`
**Apply to:** `src/core/search/MiniSearchIndex.ts`, `WikilinkAutocomplete.tsx`
Key elements: `new MiniSearch({fields, storeFields, searchOptions})` + `addAll` boot / `upsert` incremental / `discard` delete; memoized module-level index; `as unknown as IndexHit[]` cast for stored fields; `wireX()` module-load subscription (re-invocable via `__test__.reset()`); `__test__` seam + object-form namespace export.

### Typed result union, never a silent empty result (D-91/D-105)
**Source:** `src/core/extraction/PageContentService.ts:28-33`
**Apply to:** `MemoryEngine.ts` retrieval facades
```typescript
export type ExtractResult =
  | { ok: true; context: PageContext; metrics: ExtractionMetrics }
  | { ok: false; code: 'CONTENT_EXTRACT_FAILED'; message: string; cause?: unknown };
```

### Redaction before any persistence (D-90/§4.4; O.10 redaction swap)
**Source:** `src/core/security/redactSensitive.ts:67-71`
**Apply to:** UserMemoryStore fact bodies, WorkingMemory block, ConversationMemoryStore summaries, MemoryEngine output
```typescript
/** Test-only seam — redaction of arbitrary unknown value for non-object contexts. */
export function redactSensitiveValue(value: unknown): unknown {
  const seen = new WeakSet<object>();
  return redactValue(value, seen);
}
```
`// TODO(Phase 11): swap to TraceRedactor` comment required (TraceRedactor does not exist yet — RESEARCH Pitfall 1).

### Single-writer gate (D-106/§13)
**Source:** `src/core/workspace/WorkspaceStore.ts:23-25`
**Apply to:** WorkingMemory writes, conversation compactor, fact upserts
```typescript
export function isPrimaryWriter(): boolean {
  return electionIsPrimaryWriter();
}
```

### Token budgeting (≤1000-token memory cap, §3.4)
**Source:** `src/core/context/TokenBudget.ts:44-52`
**Apply to:** MemoryEngine.retrieveUserMemory, WorkingMemory estimate
```typescript
export function countTokensHeuristic(text: string): number { /* ceil(len/4) English / ceil(len/3) CJK */ }
```

### Zod validation at every cross-boundary (v4)
**Source:** `src/core/ai/persona/PersonaProfile.ts:7-23`
**Apply to:** np_persona hydrate path, MemoryExtractor memoryFacts schema, np_facts/np_conversation_meta metadata reads
```typescript
export const PersonaProfileSchema = z.object({ ... });
export type PersonaProfile = z.infer<typeof PersonaProfileSchema>;
```

### EventBus in-surface pub/sub (string-keyed, error-swallowing)
**Source:** `src/core/events/EventBus.ts:16-37`
**Apply to:** `note:saved` emit (save.ts) + MiniSearchIndex subscriber. Declare `NOTE_SAVED_EVENT` + `NoteSavedPayload` in the notes module — do NOT edit EventBus.ts (Pitfall 6).

### debugLog for instrumentation
**Source:** `src/core/log/debugLog.ts:14-21`
**Apply to:** store eviction/compactor/upsert paths
```typescript
export function debugLog(code: string, message: string, context?: Record<string, unknown>): void
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/memory/WorkingMemory.ts` | utility | transform | No existing O.10-style budget-capped markdown updater; spec Appendix O.10 (spec 6596-6622) is the verbatim source with the redaction swap (RESEARCH Pitfall 1) |
| `src/core/notes/NoteGraph.ts` (stop-word list) | service | transform | The exact 50-word stop-list vocabulary is not enumerated in the spec (spec 3511 gives count + location only); executor discretion bounded by `expect(STOP_WORDS).toHaveLength(50)` (Pitfall 8) — cosine algorithm itself analogizes to TokenBudget/contextItems patterns |

Both are spec-prescribed verbatim constructions — RESEARCH.md Code Examples provide the shapes; planner should reference those + the role-match analogs listed above.

---

## Metadata

**Analog search scope:** `src/core/storage/`, `src/core/extraction/`, `src/core/context/`, `src/core/ai/`, `src/core/events/`, `src/core/security/`, `src/core/theme/`, `src/core/workspace/`, `src/types/`, `src/components/notes/`, `tests/core/`
**Files scanned:** ~20 (all analogs listed in CONTEXT canonical_refs, read in full or targeted sections)
**Pattern extraction date:** 2026-09-01