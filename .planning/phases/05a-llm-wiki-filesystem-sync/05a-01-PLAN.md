---
phase: 05a-llm-wiki-filesystem-sync
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - src/core/notes/NoteSchema.ts
  - src/core/storage/MigrationRunner.ts
  - src/core/notes/NotesDB.ts
  - src/core/ai/LlmService.ts
  - src/core/notes/NoteTagger.ts
  - tests/core/ai/LlmService.test.ts
  - tests/core/notes/NoteTagger.test.ts
autonomous: true
requirements: [NOTE-02, NOTE-03]

must_haves:
  truths:
    - "NoteSchema exports summary, lastSyncedAt, summaryGeneratedAt, tagsGeneratedAt as optional number/string fields — existing Phase 5 tests still pass"
    - "MigrationRunner.migrateV5 creates backup_config object store (keyPath: id) when oldVersion < 5"
    - "NotesDB.openNotesDb() opens at version 5 — idb openDB/upgrade uses v5 schema"
    - "LlmService.generate() accepts adapter, tier, systemPrompt, userPrompt, schema, abortSignal and returns Zod-validated typed output via generateWithRepair"
    - "NoteTagger.analyze() calls LlmService.generate() with FAST tier, Temperature 0, and NoteTaggerResultSchema"
    - "NoteTagger.initNoteTagger() subscribes to EventBus note:saved — handler fires non-blocking, errors swallowed"
    - "Tracer end-to-end: a note is saved → note:saved emitted → NoteTagger LLM call resolves a valid NoteTaggerResult with enrichment and memoryFacts partitions"
    - "{ statement: \"NOTE-02: auto-tag/category/summary enrichment must not silently drop features — unclassified scope\", verification: \"backstop\" }"
    - "{ statement: \"NOTE-03: What happens if save triggers sync on the same note twice in rapid succession?\", verification: \"backstop\" }"
    - "{ statement: \"NOTE-03: If interrupted or run in parallel across surfaces, what is guaranteed about filesystem state?\", verification: \"backstop\" }"
  artifacts:
    - src/core/ai/LlmService.ts
    - src/core/notes/NoteTagger.ts
  key_links:
    - "EventBus note:saved → NoteTagger handler (error boundary — handler failures must not crash event dispatch)"
    - "LlmService → generateWithRepair → repairJSON (malformed JSON must fail with SCHEMA_INVALID not crash)"
    - "NoteTagger handler → NotesDB.getNote() → version comparison (D-07 staleness check)"
prohibitions:
  - "MUST NOT write tag/summary suggestions without user approval — enrichment responses return suggestions only, never auto-update notes"
  - "MUST NOT use LLM-reported confidence as system confidence tier — all accepted memoryFacts stored with confidence=0.5 (inferred) per D-03"
  - "MUST NOT block note save on LLM response — NoteTagger.analyze() fires non-blocking after IndexedDB save completes"
---

<objective>
Establish the foundation for Phase 5a: install new dependencies (yaml, @types/wicg-file-system-access), extend NoteSchema with Phase 5a fields, add MigrationRunner v5 for the backup_config store, bump NotesDB to v5, create the shared LlmService facade, and build the NoteTagger service with EventBus subscription — all wired as an end-to-end tracer proving the architecture.

Purpose: Prove the LLM enrichment architecture (LlmService → NoteTagger → EventBus → NotesDB) end-to-end before expanding to the other 4 services. Every subsequent plan builds on this proven slice.
Output: Working LlmService + NoteTagger with a green end-to-end tracer test.
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
@src/core/notes/NoteSchema.ts
@src/core/notes/NotesDB.ts
@src/core/storage/MigrationRunner.ts
@src/core/ai/StructuredOutput.ts
@src/core/ai/TierResolver.ts
@src/core/events/EventBus.ts
@tests/setup.ts
</context>

<tasks>

<task type="tracer">
  <name>Install deps + NoteSchema extension + MigrationRunner v5 + LlmService + NoteTagger (end-to-end tracer)</name>
  <read_first>
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-RESEARCH.md — Standard Stack (yaml 2.9.0, @types/wicg-file-system-access 2023.10.7), Architecture Patterns (Pattern 1–3), Code Examples (LlmService usage, NoteTaggerResultSchema, MigrationRunner v5 template)
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-PATTERNS.md — Pattern #1 (LlmService), Pattern #2 (NoteTagger), Patterns #7–9 (NoteSchema/NodesDB/MigrationRunner modifications)
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-CONTEXT.md — D-01 (single haiku call, two partition response), D-03 (LLM confidence display-only), D-04 (confidence < 0.3 filtered, max 3 memoryFacts), D-05 (in-memory suggestions), D-06 (toggle logic), D-07 (version-based staleness), D-08 (LlmService as shared facade), D-17 (EventBus note:saved independent subscription)
@src/core/notes/NoteSchema.ts — current schema shape (Note, NoteProvenance, Concept); extend with summary, lastSyncedAt, summaryGeneratedAt, tagsGeneratedAt
@src/core/storage/MigrationRunner.ts — existing migrateV4 pattern (lines 66–134); add migrateV5 following the same structure
@src/core/notes/NotesDB.ts — openNotesDb() at line ~17: bump version from 4 to 5, add getByLastSyncedAt() and updateLastSyncedAt() query methods
@src/core/ai/StructuredOutput.ts — generateWithRepair() signature (adapter, tier, prompt, schema, abortSignal) + repairJSON(); LlmService wraps this
@src/core/ai/TierResolver.ts — resolveTierModel() for FAST tier resolution
@src/core/events/EventBus.ts — on() subscription signature (event, handler); errors swallowed at line ~33
  </read_first>
  <files>
    package.json
    src/core/notes/NoteSchema.ts
    src/core/storage/MigrationRunner.ts
    src/core/notes/NotesDB.ts
    src/core/ai/LlmService.ts
    src/core/notes/NoteTagger.ts
    tests/core/notes/NoteTagger.test.ts
  </files>
  <action>
Install dependencies: `npm install yaml@^2 @types/wicg-file-system-access@2023.10` — both are pre-verified (RESEARCH § Package Legitimacy Audit, both OK).

Extend NoteSchema (src/core/notes/NoteSchema.ts): add `summary: z.string().optional()`, `lastSyncedAt: z.number().optional()`, `summaryGeneratedAt: z.number().optional()`, `tagsGeneratedAt: z.number().optional()` to the existing NoteSchema z.object(). These are all optional — existing Phase 5 tests must continue to pass. Also add the new Zod schemas for Phase 5a types: NoteTaggerResultSchema (enrichment + memoryFacts partitions per D-01), NoteQAResultSchema, NoteDraftSchema. Export corresponding inferred types. Follow the existing Zod pattern: `export const Schema = z.object({...}); export type Type = z.infer<typeof Schema>;`

Add MigrationRunner v5 (src/core/storage/MigrationRunner.ts): in the upgrade() callback, add `if (oldVersion < 5) { await this.migrateV5(transaction); }` after the existing v4 block. Implement migrateV5(transaction): if `!db.objectStoreNames.contains('backup_config')`, create `backup_config` with keyPath `'id'`. Follow the migrateV4 pattern exactly — same method signature, same VersionChangeTransaction type.

Bump NotesDB to v5 (src/core/notes/NotesDB.ts): change `migrationRunner.migrate('NotesDB', 4)` to `migrationRunner.migrate('NotesDB', 5)` and `openDB('NotesDB', 4)` to `openDB('NotesDB', 5)`. Add `getByLastSyncedAt(id: string): Promise<number | undefined>` — reads the note and returns its lastSyncedAt field (for D-11 external-change detection). Add `updateLastSyncedAt(id: string, timestamp: number): Promise<void>` — reads note, spreads, sets lastSyncedAt, puts back. Both follow existing NotesDB method pattern (openNotesDb() + try/finally db.close()).

Create LlmService (src/core/ai/LlmService.ts): a module-level singleton (MemoryEngine pattern: `let _instance; export getLlmService(); export resetLlmService()`). Public method `generate<T>(params: { adapter: ProviderAdapter; tier: ModelTier; systemPrompt: string; userPrompt: string; schema: z.ZodSchema<T>; abortSignal?: AbortSignal }): Promise<T>`. Implementation: join systemPrompt + userPrompt with `'\n\n'`, call generateWithRepair(adapter, tier, prompt, schema, abortSignal) from StructuredOutput.ts. Reuse existing repairJSON for validation. On PipelineError re-throw directly. On AbortError (`err.name === 'AbortError'`), throw PipelineError('ABORTED', ...). On unknown errors, throw PipelineError('UNKNOWN', ...). Imports: generateWithRepair from './StructuredOutput', PipelineError from './PipelineError', resolveTierModel from './TierResolver', plus zod, ai types. No new dependencies.

Create NoteTagger (src/core/notes/NoteTagger.ts): a module-level singleton (MemoryEngine pattern). Constructor takes no params. Methods:
- `async analyze(adapter: ProviderAdapter, noteId: string, noteContent: string, noteVersion: number, abortSignal?: AbortSignal): Promise<NoteTaggerResult>` — calls `getLlmService().generate({ adapter, tier: 'FAST', systemPrompt: NOTE_TAGGER_SYSTEM_PROMPT, userPrompt: `Note content:\n${noteContent}`, schema: NoteTaggerResultSchema, abortSignal })`. Returns the parsed result. On error: silently discard (no throw — EventBus swallows errors).
- `initNoteTagger(): void` — subscribes to EventBus `note:saved` with handler signature `on<{ noteId: string }>('note:saved', async ({ noteId }) => { ... })`. Inside the handler: 1) check D-06 toggles — if all off, skip. 2) Load note from NotesDB.get(noteId). 3) Call this.analyze(). 4) On response, re-load note, compare version (D-07): if versions differ, silently discard. 5) Route enrichment to component state (emit event or return via callback — fire-and-forget, suggestions are in-memory D-05). 6) Filter memoryFacts: drop confidence < 0.3 (D-04), cap at 3 (D-04). 7) Emit event for memory suggestion UI.
- `static NOTE_TAGGER_SYSTEM_PROMPT`: the system prompt instructing the LLM to output JSON with enrichment (tags ≤5, categoryPath, summary ≤200 chars, suggestedConcepts) and memoryFacts (type: 'semantic', content, confidence 0–1, reason). Prompt must NOT instruct the LLM to include markdown fences. Follows the generateWithRepair contract: temperature-0, JSON-only.
- `isPrimarySurface()` check is NOT at NoteTagger call time — per D-19, NoteTagger fires LLM on both surfaces; MEM-02 write gating happens at MemoryEngine.write() time.

Idempotency guard: if unsub already set, initNoteTagger() is a no-op (prevents double subscription).

Write the tracer test (tests/core/notes/NoteTagger.test.ts): use vitest + fake-indexeddb (from tests/setup.ts). Test "end-to-end tracer: note saved → NoteTagger handler fires → LlmService.generate → NoteTaggerResult returned":
- Create a note, save via NotesDB, observe that the EventBus note:saved handler fires (mock LlmService.generate to return a valid NoteTaggerResult with enrichment tags + memoryFacts).
- Assert enrichment.tags is array, memoryFacts is array with confidence 0-1 range.
- Verify note version comparison: handler re-reads note.version from DB, discards if versions differ.
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NoteTagger.test.ts --no-coverage</automated>
  </verify>
  <done>
The tracer end-to-end test passes: a note save triggers EventBus note:saved, NoteTagger handler calls LlmService.generate() with FAST tier, the LLM returns a valid NoteTaggerResult with both enrichment and memoryFacts partitions, and the result is parsed correctly through Zod. Existing Phase 5 tests (`npx vitest run tests/core/notes/`) all still pass.
  </done>
  <acceptance_criteria>
    1. `npm ls yaml` shows 2.x installed; `npm ls @types/wicg-file-system-access` shows 2023.10.x installed.
    2. NoteSchema exports summary, lastSyncedAt, summaryGeneratedAt, tagsGeneratedAt as optional fields — existing NotesDB tests pass unchanged.
    3. MigrationRunner v5 creates backup_config store with keyPath 'id' — test verifies db.objectStoreNames.contains('backup_config').
    4. NotesDB opens at version 5; getByLastSyncedAt() returns undefined for notes without the field.
    5. LlmService.generate() with a mock adapter returns Zod-validated output of the correct type.
    6. NoteTagger.analyze() calls LlmService.generate() with FAST tier and NoteTaggerResultSchema.
    7. initNoteTagger() subscribes to note:saved — idempotent (second call is no-op).
    8. Tracer test: a saved note triggers LLM call → valid NoteTaggerResult with enrichment.tags (array) + memoryFacts (array, confidence in [0,1]).
    9. Version staleness: if note.version changes between LLM call and response, suggestions are discarded.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>NoteTagger enrichment behaviors + confidence filtering + toggle logic + test suite completion</name>
  <read_first>
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-CONTEXT.md — D-03 (LLM confidence → inferred mapping), D-04 (confidence < 0.3 filtered, max 3 displayed), D-05 (in-memory only suggestions), D-06 (toggle skip logic), D-07 (version staleness full logic)
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-RESEARCH.md — Common Pitfalls §2 (LLM response race condition), NoteTaggerResultSchema full shape (lines 467–484)
@src/core/notes/NoteTagger.ts — existing analyze() and initNoteTagger() from Task 1; add filtering/toggle/staleness behaviors
@tests/core/notes/NoteTagger.test.ts — extend test file with behavior tests
  </read_first>
  <files>
    src/core/notes/NoteTagger.ts
    tests/core/notes/NoteTagger.test.ts
  </files>
  <action>
Extend NoteTagger with the full enrichment pipeline behaviors:

1. **Confidence filtering (D-04):** After parsing LLM response, filter memoryFacts: drop any where `confidence < 0.3`. Cap remaining at max 3 (take first 3 after filtering). Both thresholds are local constants (`MIN_CONFIDENCE = 0.3`, `MAX_MEMORY_FACTS = 3`) defined in NoteTagger.ts.

2. **Toggle logic (D-06):** initNoteTagger() handler accepts toggle state via a config module or EventBus payload. If `autoTag`, `autoCategorize`, and `autoSummary` are all off → skip the LLM call entirely (early return). If some are on but memory extraction is off → still call LLM but discard memoryFacts after parsing. The LLM prompt always requests the full structured output regardless of toggle state (keeps prompt invariant).

3. **Version staleness (D-07):** Before the LLM call, capture `note.version` from the save event payload or DB read. After response arrives, re-read the note via NotesDB.get(noteId). If `currentNote.version !== capturedVersion` → silently discard the suggestions (no error, no UX noise). Add a `version` field to the note:saved event payload so the handler doesn't need to re-read before the call.

4. **In-memory suggestions (D-05):** Enrichment results are emitted as an event (`note:enriched` with `{ noteId, enrichment, memoryFacts }`) on the EventBus. UI layer (Phase 7) subscribes and stores in component state. No IndexedDB persistence. On session restart, suggestions are lost — the "Regenerate" button is the recovery path.

5. **Confidence mapping (D-03):** LLM-reported confidence is preserved as `llmConfidence` metadata on the memoryFact object. When user accepts a memory fact, it is stored via MemoryEngine.write() with `confidence: 0.5` (inferred). The LLM score is NEVER used as the system confidence tier. Add a helper `toMemoryFactInput(fact, llmConfidence)` that maps the LLM result to a MemoryWriteInput with `confidence: 0.5`.

6. **LLM error handling:** All LLM errors (PipelineError, AbortError, SCHEMA_INVALID, network failure) are caught in the EventBus handler. Silently discard — no error toast, no retry. The handler is fire-and-forget. Log to console.debug for development visibility (gated behind `process.env.NODE_ENV !== 'production'`).

7. **Test suite:** Add tests for each behavior:
   - "filters memoryFacts with confidence < 0.3" — feed result with mixed confidences, assert only ≥ 0.3 survive
   - "caps memoryFacts at 3" — feed result with 5 memoryFacts, assert only 3 returned
   - "skips LLM call when all toggles are off" — set all toggles false, assert LlmService.generate is NOT called
   - "still calls LLM but discards memoryFacts when memory extraction is off" — set memory toggle off, assert LLM called but memoryFacts empty in emitted event
   - "discards stale suggestions when version changes" — simulate version bump between capture and response, assert enrichment event is NOT emitted
   - "emits note:enriched event with enrichment partition on success" — mock LLM, assert EventBus received note:enriched with correct payload
   - "silently discards on PipelineError" — mock LLM to throw PipelineError('SCHEMA_INVALID'), assert no event emitted, no throw propagated
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NoteTagger.test.ts --no-coverage</automated>
  </verify>
  <done>
All NoteTagger unit tests pass: confidence filtering (< 0.3 dropped, max 3), toggle skip logic (all-off → no call; enrichment-only → memoryFacts discarded), version staleness (changed version → discard), in-memory emission (note:enriched event), error handling (PipelineError/AbortError silently swallowed). The single haiku call returns both partitions per D-01.
  </done>
  <acceptance_criteria>
    1. Confidence < 0.3 memoryFacts are filtered; remaining capped at 3.
    2. All toggles off → no LlmService.generate() call; log skipped.
    3. Memory extraction off → LLM called but memoryFacts discarded from emitted event.
    4. Note version changed between LLM call and response → suggestions silently discarded, no event emitted.
    5. Successful enrichment emits note:enriched EventBus event with { noteId, enrichment, memoryFacts }.
    6. PipelineError/AbortError in LLM call → silently discarded (console.debug in dev only).
    7. LLM confidence preserved as llmConfidence metadata; toMemoryFactInput() maps to confidence: 0.5 (D-03).
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| LLM API (ProviderAdapter) | Note content crosses to configured LLM provider — untrusted LLM response returns to NoteTagger |
| EventBus note:saved → NoteTagger handler | Multiple EventBus subscribers, handler errors must not crash event dispatch |
| NoteTagger → MemoryEngine.write() | MEM-02 memory writes cross the primary-surface trust boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-05a-01 | Spoofing | NoteTagger.analyze() | medium | mitigate | Zod validation (NoteTaggerResultSchema) rejects malformed LLM output — only well-formed enrichment/memoryFacts pass. system prompt boundary instructions prevent LLM from inventing facts. D-03 maps LLM self-reported confidence to inferred (0.5). |
| T-05a-02 | Tampering | NoteTagger (version staleness) | high | mitigate | D-07: captured note version compared against current DB version on response return. Stale suggestions silently discarded. User never sees enrichment for wrong note version. |
| T-05a-03 | Information Disclosure | LlmService.generate() | medium | mitigate | Note content sent to LLM provider is user-initiated via save action. No secrets in note content per existing TraceRedactor policy. abortSignal propagates for cancellation. |
| T-05a-04 | Denial of Service | EventBus note:saved handler | low | accept | Handler errors are swallowed by EventBus (try/catch at line 33 of EventBus.ts). Fire-and-forget pattern — no retry loop. LLM failures do not block save or subsequent saves. |
| T-05a-05 | Elevation | NoteTagger → MemoryEngine | medium | mitigate | D-19: MEM-02 memory writes gated at MemoryEngine.write() via isPrimarySurface(). NoteTagger suggests memoryFacts on both surfaces, but write() fails gracefully on secondary surfaces. |
| T-05a-SC | Tampering | npm install yaml/@types | high | mitigate | Both packages pre-verified in RESEARCH.md Package Legitimacy Audit (yaml: 184M/wk, 10yr age; @types: 745K/wk, 4yr age). Both OK verdict. No SLOP/SUS packages. |
</threat_model>

<verification>
  1. `npx vitest run tests/core/notes/NoteTagger.test.ts --no-coverage` — all NoteTagger tests pass
  2. `npx vitest run tests/core/notes/ --no-coverage` — existing Phase 5 note tests still pass
  3. `npx tsc --noEmit` — no type errors from new services
</verification>

<success_criteria>
[ ] npm install completes — yaml 2.x and @types/wicg-file-system-access installed
[ ] NoteSchema extended with Phase 5a fields; existing tests pass
[ ] MigrationRunner v5 creates backup_config store
[ ] NotesDB opens at v5 with new query methods
[ ] LlmService.generate() returns Zod-validated output via generateWithRepair
[ ] NoteTagger.analyze() calls LlmService with FAST tier and correct schema
[ ] initNoteTagger() subscribes to EventBus note:saved — idempotent guard works
[ ] Tracer test: save → LLM → NoteTaggerResult with both partitions passes
[ ] Confidence filtering: < 0.3 dropped, max 3 memoryFacts
[ ] Toggle logic: all-off skips LLM; memory-off still calls LLM but discards facts
[ ] Version staleness: version mismatch → suggestions discarded
[ ] Error handling: PipelineError silently swallowed
[ ] D-03 confidence mapping: LLM confidence → stored as inferred (0.5)
[ ] D-05 in-memory: note:enriched event emitted, no IndexedDB persistence
</success_criteria>

<output>
Create `.planning/phases/05a-llm-wiki-filesystem-sync/05a-01-SUMMARY.md` when done
</output>
