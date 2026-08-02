---
phase: 05a-llm-wiki-filesystem-sync
plan: 02
type: execute
wave: 2
depends_on: [05a-01]
files_modified:
  - src/core/notes/NoteQA.ts
  - src/core/notes/NoteChatConverter.ts
  - src/core/notes/NoteMaintenance.ts
  - tests/core/notes/NoteQA.test.ts
  - tests/core/notes/NoteChatConverter.test.ts
  - tests/core/notes/NoteMaintenance.test.ts
autonomous: true
requirements: [NOTE-02]

must_haves:
  truths:
    - "NoteQA.ask() returns a NoteQAResult with answer string and citations array mapping [1]..[N] references to { noteId, title, relevantSnippet, referenceNumber }"
    - "NoteQA.search() returns MiniSearch top-10 reranked by haiku-tier LLM as ordered NoteSearchResult[]"
    - "NoteQA in tiny model tier returns raw MiniSearch + MemoryEngine results as NoteSearchResult[] with noteId links — no LLM call"
    - "NoteChatConverter.convert() returns a NoteDraft with title, content, tags, categoryPath, wikilinks from haiku LLM call + MemoryEngine.assemble() context"
    - "NoteChatConverter drafts carry provenance 'chat-conversion' when saved through the full pipeline"
    - "NoteMaintenance.getStaleNotes() returns notes where summaryGeneratedAt < updatedAt or tagsGeneratedAt < updatedAt"
    - "NoteMaintenance.getOrphanNotes() returns notes with 0 wikilinks and 0 backlinks"
  artifacts:
    - src/core/notes/NoteQA.ts
    - src/core/notes/NoteChatConverter.ts
    - src/core/notes/NoteMaintenance.ts
  key_links:
    - "NoteQA → MiniSearchNoteIndex.search() (BM25 retrieval of top-N snippets)"
    - "NoteQA → MemoryEngine.retrieve() (memory context injection)"
    - "NoteQA → LlmService.generate() with FLASH tier (synthesis with numbered citations)"
    - "NoteChatConverter → MemoryEngine.assemble() (MEM-03 context for draft generation)"
    - "NoteChatConverter → LlmService.generate() with FAST tier (haiku draft)"
    - "NoteMaintenance → NotesDB.getAll() + NoteGraph.getBacklinks() (orphan + staleness queries)"
prohibitions:
  - "MUST NOT send note or page content to LLM provider without user-initiated action — NoteQA only fires on explicit user question; NoteChatConverter only on explicit 'Save to note'"
  - "MUST NOT return citations to non-existent notes — parseCitations validates reference numbers against snippet array indices"
---

<objective>
Build the three remaining NOTE-02 services on top of the proven foundation: NoteQA (RAG Q&A with numbered citations), NoteChatConverter (chat/page → pre-filled note draft), and NoteMaintenance (passive staleness/orphan queries). These are the LLM-Wiki user-facing capabilities.

Purpose: Complete NOTE-02 coverage — users can ask questions across their notes with cited answers, convert conversations to atomic notes, and detect stale/orphaned notes for maintenance.
Output: Working NoteQA, NoteChatConverter, and NoteMaintenance services with full test suites.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-RESEARCH.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-CONTEXT.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-PATTERNS.md
@.planning/phases/05-knowledge-base/05-01-SUMMARY.md
@.planning/phases/05-knowledge-base/05-02-SUMMARY.md
@.planning/phases/05-knowledge-base/05-03-SUMMARY.md
@src/core/notes/MiniSearchNoteIndex.ts
@src/core/notes/NoteGraph.ts
@src/core/memory/MemoryEngine.ts
@src/core/ai/LlmService.ts
@src/core/notes/NoteSchema.ts
@src/core/events/EventBus.ts
</context>

<tasks>

<task type="auto">
  <name>NoteQA: RAG Q&A with search/ask modes, numbered citations, tiny-tier fallback</name>
  <read_first>
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-CONTEXT.md — D-13 (numbered citations [1]..[N]), D-14 (own prompt assembly, no ContextOptimizer), D-15 (search + ask modes), D-16 (tiny model tier fallback)
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-RESEARCH.md — Code Examples: Citation Post-Processing (lines 589–629), NoteQAResultSchema
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-PATTERNS.md — Pattern #3 (NoteQA, lines 198–271): singleton + MiniSearch retrieval + MemoryEngine + citation parsing
@src/core/notes/MiniSearchNoteIndex.ts — .search(query: string, limit?: number): NoteSearchResult[] — used for snippet retrieval
@src/core/memory/MemoryEngine.ts — .retrieve(options: RetrievalOptions): Promise<MemoryRetrievalResult> — memory context for RAG
@src/core/ai/LlmService.ts — .generate() from Plan 05a-01 — LLM call facade
@src/core/notes/NoteSchema.ts — NoteQAResultSchema (added in Plan 05a-01)
  </read_first>
  <files>
    src/core/notes/NoteQA.ts
    tests/core/notes/NoteQA.test.ts
  </files>
  <action>
Create NoteQA (src/core/notes/NoteQA.ts) as a module-level singleton (MemoryEngine pattern: `let _instance; export getNoteQA(); export resetNoteQA()`).

Two modes via a single entry point `async query(adapter: ProviderAdapter, params: { mode: 'search' | 'ask'; question: string; tier: ModelTier; abortSignal?: AbortSignal }): Promise<NoteQAResult | NoteSearchResult[]>`:

**Mode: 'ask' (D-15, D-13)**
1. Retrieve: call `noteSearchIndex.search(question, 5)` for top-5 BM25 snippets.
2. Memory context: call `getMemoryEngine().retrieve({ query: question, tier: 'FAST', maxItems: 3 })` for relevant memory facts.
3. Assemble prompt directly (D-14): system prompt instructing the LLM to synthesize an answer using numbered reference markers `[1]`, `[2]`, etc. from provided snippets. Include preamble with `noteId` metadata (invisible to LLM text) mapping each `[N]` to its source note. Format:
```
[Snippet 1] (noteId: abc-123) Title: ...
Content: ...
[Snippet 2] (noteId: def-456) Title: ...
Content: ...
[Memory facts]
...
Question: {question}
```
4. Call LlmService.generate() with FLASH tier, temperature-0, schema = NoteQAResultSchema (expects `{ answer, citations }` out of the LLM directly — the LLM is prompted to output both the answer text with inline [N] markers AND a citations array mapping reference numbers to noteIds).
5. Post-process: parseCitations() extracts [N] markers from the answer text, validates each N against the snippet array (1 ≤ N ≤ snippets.length), deduplicates, builds citations array with `{ noteId, title, relevantSnippet, referenceNumber }`. If the LLM didn't populate the citations array (legacy/malformed response), build citations from answer-text markers.
6. Return: `{ answer: string, citations: Citation[] }`.

**Mode: 'search' (D-15)**
1. Retrieve: call `noteSearchIndex.search(question, 10)` for top-10 BM25 snippets.
2. Call LlmService.generate() with FAST (haiku) tier, temperature-0, to rerank the snippets. Prompt the LLM to reorder snippets by relevance. Return the reranked list as NoteSearchResult[].
3. If LLM call fails → fall back to raw MiniSearch top-10 ordering.

**Tiny model tier (D-16):** When `tier === 'TINY'` (check via TierResolver or the passed tier parameter), both modes skip the LLM call entirely:
- ask mode: return MiniSearch top-5 snippets + MemoryEngine facts as raw results with noteId links in a plain text answer and a citations array built from the snippets directly.
- search mode: return MiniSearch top-10 snippets in their BM25 order.

**Prompt assembly (D-14):** NoteQA builds its own prompt — NO ContextOptimizer involvement. The token budget is small (top-5 snippets + memory). The system prompt for 'ask' mode MUST instruct:
- "Answer the question using ONLY the provided snippets and memory facts."
- "Reference sources using [1], [2], [3] markers inline."
- "Each [N] corresponds to Snippet N above. Do not invent references."
- "If no snippet is relevant, say 'I couldn't find relevant notes to answer this question.'"
- "Output as valid JSON matching the NoteQAResultSchema."

**Citation parsing helper:** Export `parseCitations(rawText: string, snippets: SnippetInfo[]): Citation[]` — iterates `rawText.matchAll(/\[(\d+)\]/g)`, validates each match, deduplicates, returns array. Used both for post-processing LLM responses and for tiny-mode raw result assembly.

**Test suite** (tests/core/notes/NoteQA.test.ts):
- "ask mode returns cited answer with correct citations" — mock LlmService to return answer with [1][2] markers + citations array; assert citations have correct noteId/title/snippet/referenceNumber
- "ask mode retrieves top-5 MiniSearch snippets" — assert noteSearchIndex.search called with limit 5
- "ask mode injects MemoryEngine context" — assert memoryEngine.retrieve called
- "search mode reranks top-10 via haiku" — assert LlmService called with FAST tier
- "search mode falls back to BM25 order on LLM failure" — mock LLM to throw, assert raw MiniSearch results returned
- "tiny mode returns raw results without LLM call" — set tier TINY, assert LlmService.generate NOT called, assert MiniSearch results + memory facts returned as raw result
- "parseCitations validates reference range" — [5] in a 3-snippet context → skipped
- "parseCitations deduplicates repeated references" — [1] appears twice → only one citation entry
- "empty question returns empty results" — empty string → no MiniSearch call, null result
- "no relevant snippets returns 'couldn't find' message" — LLM returns this message when no snippets are relevant
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NoteQA.test.ts --no-coverage</automated>
  </verify>
  <done>
NoteQA test suite passes: ask mode returns cited answers with correct citations mapping [1]..[N] to source notes; search mode reranks via haiku and falls back to BM25 on error; tiny mode returns raw MiniSearch + MemoryEngine results without LLM call; citation parsing validates range and deduplicates; edge cases (empty question, no relevant snippets) handled gracefully.
  </done>
  <acceptance_criteria>
    1. NoteQA.query({ mode: 'ask' }) retrieves MiniSearch top-5 snippets and MemoryEngine facts.
    2. Ask mode prompt assembles snippets with noteId preamble, calls LlmService FLASH tier.
    3. LLM response includes answer with inline [N] markers + citations array; post-processing builds correct Citation[].
    4. NoteQA.query({ mode: 'search' }) retrieves MiniSearch top-10 and reranks via haiku LLM.
    5. Search mode falls back to raw MiniSearch order on LLM failure.
    6. Tiny model tier (TINY) skips LLM entirely for both modes; returns raw results with noteId links.
    7. parseCitations() validates 1 ≤ N ≤ snippets.length, deduplicates, returns correct shape.
    8. Empty question returns null/empty result (no LLM call).
    9. No ContextOptimizer involvement — NoteQA builds its own prompt.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>NoteChatConverter: chat/page → pre-filled note draft (haiku) + NoteMaintenance: staleness/orphan queries</name>
  <read_first>
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-CONTEXT.md — D-20 (full save pipeline, provenance chat-conversion), D-21 (passive query, no background monitoring), MEM-03 (MemoryEngine.assemble() for draft context)
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-RESEARCH.md — Architecture diagram (NoteChatConverter + NoteMaintenance sections), NoteDraftSchema
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-PATTERNS.md — Pattern #4 (NoteChatConverter, lines 275–323), Pattern #6 (NoteMaintenance, lines 431–487)
@src/core/memory/MemoryEngine.ts — .assemble(): Promise<string> — assembles memory context string (MEM-03)
@src/core/ai/LlmService.ts — .generate() from Plan 05a-01
@src/core/notes/NoteGraph.ts — .getBacklinks(noteId, allNotes): string[] — used by NoteMaintenance for orphan detection
@src/core/notes/NotesDB.ts — .getAll(): Promise<Note[]> — used by NoteMaintenance for queries
@src/core/notes/NoteSchema.ts — NoteDraftSchema (added in Plan 05a-01), NoteProvenanceSchema
  </read_first>
  <files>
    src/core/notes/NoteChatConverter.ts
    src/core/notes/NoteMaintenance.ts
    tests/core/notes/NoteChatConverter.test.ts
    tests/core/notes/NoteMaintenance.test.ts
  </files>
  <action>
**Part 1: NoteChatConverter (src/core/notes/NoteChatConverter.ts)**

Module-level singleton (MemoryEngine pattern: `let _instance; export getNoteChatConverter(); export resetNoteChatConverter()`).

Single method:
```
async convert(adapter: ProviderAdapter, input: { chatMessages: string[]; sourceUrl?: string; abortSignal?: AbortSignal }): Promise<NoteDraft>
```

Implementation (D-20, MEM-03):
1. Retrieve memory context: `const context = await getMemoryEngine().assemble()` — this provides user facts, preferences, and persona context for informed draft generation per MEM-03.
2. Build user prompt:
```
${context ? `Context:\n${context}\n\n` : ''}
Chat messages:
${input.chatMessages.map((msg, i) => `[${i + 1}] ${msg}`).join('\n')}
${input.sourceUrl ? `\nSource URL: ${input.sourceUrl}` : ''}
```
3. Call `getLlmService().generate()` with FAST tier (haiku), temperature-0, schema = NoteDraftSchema (title, content, tags, categoryPath, wikilinks).
4. The system prompt instructs: "You are a note-taking assistant. Based on the conversation, draft an atomic note. Extract the key insight as the title. Write concise content in markdown. Suggest 1-5 relevant tags. Optionally suggest a category path and any wikilinks to other topics. Output valid JSON matching NoteDraftSchema."
5. Return the NoteDraft — the UI (Phase 7) pre-fills the note editor; the user is the gatekeeper (must explicitly save).

Provenance: When the user saves the draft, the NoteProvenance.source is set to `'chat-conversion'` — this is already a valid value in the existing NoteProvenanceSchema from Phase 5 D-16. Notes saved this way trigger the full save pipeline: NoteTagger enrichment + NoteFileSync backup + MEM-02 memory extraction (D-20).

**Part 2: NoteMaintenance (src/core/notes/NoteMaintenance.ts)**

Module-level singleton (NoteGraph-style: `private static _instance`, `static getInstance()/resetInstance()`).

Three passive query methods (D-21 — no background monitoring, no EventBus subscriptions, UI-driven):

1. `async getStaleNotes(): Promise<Note[]>`:
   - Fetch all notes via `getNotesDb().getAll()`.
   - Filter: `tagsGeneratedAt < updatedAt || summaryGeneratedAt < updatedAt`. If tagsGeneratedAt or summaryGeneratedAt is undefined (note never enriched), consider it stale if the note has been edited (updatedAt > createdAt + 60s grace period to avoid flagging brand-new notes).
   - Return the filtered array.

2. `async getOrphanNotes(): Promise<Note[]>`:
   - Fetch all notes via `getNotesDb().getAll()`.
   - For each note, check `note.links.length === 0 && getNoteGraph().getBacklinks(note.id, allNotes).length === 0`.
   - Return notes with zero wikilinks and zero backlinks.

3. `async reanalyzeAll(adapter: ProviderAdapter): Promise<{ total: number; enriched: number; failed: number }>`:
   - Fetch all notes.
   - Sequentially call `getNoteTagger().analyze(adapter, note.id, note.content, note.version)` for each note.
   - Count enriched (LLM call succeeded) vs failed (LLM call threw, silently caught).
   - Return summary. This is a bulk operation — no parallelism (avoids rate-limiting the LLM provider), each call is fire-and-forget.
   - For each successful enrichment, emit the note:enriched event so the UI can reflect suggestions.

**Test suites:**

NoteChatConverter.test.ts:
- "returns NoteDraft with title, content, tags, categoryPath, wikilinks" — mock LlmService to return a draft, assert all fields populated
- "includes MemoryEngine.assemble() context" — assert assemble() called
- "formats chat messages with [N] prefixes" — verify the user prompt sent to LLM
- "handles LLM failure gracefully" — mock LlmService to throw PipelineError, assert thrown through convert()
- "handles empty chat messages" — empty array input → still returns a draft (LLM may return low-quality draft but should not error)

NoteMaintenance.test.ts:
- "getStaleNotes returns notes where tagsGeneratedAt < updatedAt" — create note with stale timestamp, assert it appears
- "getStaleNotes excludes fresh notes" — create note with tagsGeneratedAt > updatedAt, assert excluded
- "getOrphanNotes returns notes with 0 wikilinks + 0 backlinks" — create isolated note, assert it appears
- "getOrphanNotes excludes notes with wikilinks" — create note with links, assert excluded
- "getOrphanNotes excludes notes with backlinks" — create note referenced by another, assert excluded
- "reanalyzeAll processes all notes sequentially" — create 3 notes, mock NoteTagger, assert analyze() called 3 times
- "reanalyzeAll returns success/fail counts" — mock 2 succeed, 1 fail, assert { total: 3, enriched: 2, failed: 1 }
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NoteChatConverter.test.ts tests/core/notes/NoteMaintenance.test.ts --no-coverage</automated>
  </verify>
  <done>
NoteChatConverter returns pre-filled NoteDraft with title, content, tags, categoryPath, and wikilinks from haiku LLM + MemoryEngine context. NoteMaintenance returns stale notes (summaryGeneratedAt/tagsGeneratedAt < updatedAt), orphan notes (0 wikilinks + 0 backlinks), and reanalyzeAll() processes all notes sequentially with success/fail counts. Both services are passive/UI-driven per D-20/D-21.
  </done>
  <acceptance_criteria>
    NoteChatConverter:
    1. convert() calls MemoryEngine.assemble() for context (MEM-03).
    2. User prompt includes chat messages with [N] prefixes and optional source URL.
    3. LlmService.generate() called with FAST tier and NoteDraftSchema.
    4. Returned NoteDraft has all fields: title, content, tags, categoryPath, wikilinks.
    5. Provenance 'chat-conversion' is set when user saves the draft (per D-20, Phase 7 UI scope).
    6. LLM failure throws PipelineError through convert().
    
    NoteMaintenance:
    7. getStaleNotes() returns notes where enrichment timestamps < updatedAt.
    8. getOrphanNotes() returns notes with 0 wikilinks + 0 backlinks.
    9. reanalyzeAll() calls NoteTagger.analyze() sequentially for every note.
    10. reanalyzeAll() returns { total, enriched, failed } summary.
    11. No EventBus subscriptions, no background monitoring (D-21).
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User question → NoteQA → LLM | User questions and note snippets cross to LLM provider — note content is user-owned, sent only on explicit user action |
| Chat/page content → NoteChatConverter → LLM | Chat history and page URLs cross to LLM provider — user-initiated via "Save to Note" action |
| NoteMaintenance → NotesDB/NoteGraph | Read-only queries — no write side effects, no LLM calls (except reanalyzeAll which delegates to NoteTagger) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-05a-06 | Spoofing | NoteQA.ask() LLM response | medium | mitigate | Zod NoteQAResultSchema validates response structure. parseCitations() validates reference numbers against snippet indices — out-of-range [N] markers are dropped. System prompt instructs "use ONLY provided snippets." Answer with no citations when no snippet is relevant is a valid result. |
| T-05a-07 | Information Disclosure | NoteQA snippet assembly | medium | mitigate | Only top-5 MiniSearch snippets are included in prompt (D-14 small token budget). Note content is user-owned and already in local IndexedDB. Memory facts filtered through existing MemoryScorer D-08/D-09 scoring. |
| T-05a-08 | Information Disclosure | NoteChatConverter chat history | low | accept | Chat messages are user-initiated text already in conversation memory. Source URL may expose browsing history — only included if explicitly provided by UI. LLM provider receives only the chat text, not metadata. |
| T-05a-09 | Tampering | NoteMaintenance staleness detection | low | accept | Read-only queries — no writes. Incorrect staleness results would only affect UI badges. No data corruption risk. |
</threat_model>

<verification>
  1. `npx vitest run tests/core/notes/NoteQA.test.ts --no-coverage` — all NoteQA tests pass
  2. `npx vitest run tests/core/notes/NoteChatConverter.test.ts --no-coverage` — all NoteChatConverter tests pass
  3. `npx vitest run tests/core/notes/NoteMaintenance.test.ts --no-coverage` — all NoteMaintenance tests pass
  4. `npx tsc --noEmit` — no type errors from new services
</verification>

<success_criteria>
[ ] NoteQA.ask() returns cited answer with correct Citation[] array
[ ] NoteQA.search() reranks top-10 via haiku, falls back to BM25 on error
[ ] NoteQA tiny mode returns raw results without LLM call
[ ] parseCitations() validates range, deduplicates
[ ] NoteChatConverter returns NoteDraft with all fields populated
[ ] NoteChatConverter includes MemoryEngine.assemble() context
[ ] NoteChatConverter provenance 'chat-conversion' on save
[ ] NoteMaintenance.getStaleNotes() correct staleness logic
[ ] NoteMaintenance.getOrphanNotes() correct orphan detection
[ ] NoteMaintenance.reanalyzeAll() sequential processing with counts
</success_criteria>

<output>
Create `.planning/phases/05a-llm-wiki-filesystem-sync/05a-02-SUMMARY.md` when done
</output>
