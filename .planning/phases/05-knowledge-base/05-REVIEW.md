---
phase: 05-knowledge-base
reviewed: 2026-08-02T08:30:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - src/core/notes/NoteSchema.ts
  - src/core/notes/LinkParser.ts
  - src/core/notes/NotesDB.ts
  - src/core/notes/MiniSearchNoteIndex.ts
  - src/core/notes/NoteGraph.ts
  - src/core/notes/types.ts
  - src/core/memory/MemoryRecord.ts
  - src/core/memory/MemoryScorer.ts
  - src/core/memory/types.ts
  - src/core/memory/ConversationMemoryStore.ts
  - src/core/memory/UserMemoryStore.ts
  - src/core/memory/PreferenceMemoryStore.ts
  - src/core/memory/MemoryEngine.ts
  - src/core/ai/AgentTurnInput.ts
  - src/core/ai/persona/PersonaInjector.ts
  - src/core/i18n/strings.ts
  - src/core/runtime/BroadcastBus.ts
  - src/core/storage/MigrationRunner.ts
  - src/core/storage/NotesStore.ts
  - src/core/storage/WriteJournal.ts
  - package.json
  - tests/core/integration/phase05.test.ts
  - tests/core/memory/ConversationMemoryStore.test.ts
  - tests/core/memory/MemoryEngine.test.ts
  - tests/core/memory/MemoryScorer.test.ts
  - tests/core/memory/UserMemoryStore.test.ts
  - tests/core/notes/LinkParser.test.ts
  - tests/core/notes/MiniSearchNoteIndex.test.ts
  - tests/core/notes/NotesDB.test.ts
  - tests/core/notes/NoteGraph.test.ts
  - tests/core/storage/NotesStore.test.ts
findings:
  critical: 1
  warning: 9
  info: 7
  total: 17
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-08-02T08:30:00Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Reviewed the full phase-05 deliverable (diff `5341818..00e42c5`): the notes layer (NoteSchema/LinkParser/NotesDB/MiniSearchNoteIndex/NoteGraph), the memory layer (MemoryRecord/MemoryScorer/three stores/MemoryEngine), AI-pipeline wiring (AgentTurnInput, PersonaInjector), BroadcastBus election, MigrationRunner v4, i18n keys, and all 10 test suites. SUMMARY claims were verified against the code: TDD commit history, tier-gating constants (4/8/12/12, 12-message compact boundary), D-07 CONFIDENCE_MAP, D-08 weights, 19 i18n keys, and the 10-suite verify gate all check out.

The core architecture is sound (Zod boundaries, discriminated-union results, WriteJournal-wrapped writes), but the review found one data-loss bug in the D-11 LRU bookkeeping (codified by its own test), several wiring gaps that make shipped features inert (index persistence never invoked, journal replay never invoked, election never invoked in production), and one dead API path in `MemoryEngine.write()`. Cross-checked against `src/` with grep — these are not documented-deferred items; `persist()`, `load()`, `replayJournal`, and `setPrimarySurfaceId` have zero production callers.

## Critical Issues

### CR-01: LRU re-activation leaves a conversation in BOTH active and archived — active conversations can be evicted (data loss)

**File:** `src/core/memory/MemoryEngine.ts:311-314` (promotion), `:334-340` (eviction)
**Issue:** `trackConversationActivity()` promotes a conversation to `active` (step 2) but never removes it from `archived`. Once a conversation is archived (idle >30 min or active-overflow), any later activity re-adds it to `active` while it stays in `archived`:

```ts
// 2. Promote the current conversation to the active set
if (!this.active.includes(conversationId)) {
  this.active.push(conversationId);   // conv-a now in BOTH active AND archived
}
```

Consequences:
1. **Data loss risk:** step 4 evicts the oldest `archived` entry via `evictConversation()` — which deletes all messages AND the summary from IndexedDB. An archived-but-currently-active conversation can be evicted while in use, silently wiping its conversation memory. Trigger: 100+ archived conversations accumulated (long-running usage), which also produces duplicate `archived` entries on each bounce (steps 1/3 push without dedupe).
2. `getConversationStats()` double-counts — the phase's own test asserts the buggy state: `tests/core/memory/MemoryEngine.test.ts:466-467` expects `{ active: 1, archived: 3, total: 4 }` for only **3** distinct conversations (conv-a counted twice). The summary's "Test 12 corrected during GREEN" fixed the archive-all expectation but codified the double-count.

**Fix:** On promotion, remove the id from `archived` (and dedupe pushes):
```ts
// 2. Promote the current conversation to the active set
if (!this.active.includes(conversationId)) {
  const archIdx = this.archived.indexOf(conversationId);
  if (archIdx >= 0) this.archived.splice(archIdx, 1);
  this.active.push(conversationId);
}
```
Also guard pushes in steps 1/3 (`if (!this.archived.includes(id)) this.archived.push(id)`), and correct Test 12's expectations to `{ active: 1, archived: 2, total: 3 }`.

## Warnings

### WR-01: MiniSearch index is never persisted or loaded — search is empty after every extension restart

**File:** `src/core/notes/MiniSearchNoteIndex.ts:102-136, 189-199`; `src/core/notes/NotesDB.ts:93-97`
**Issue:** The SUMMARY claims a "persistent BM25 index … persist/load round-trip", but `persist()`, `load()`, and `rebuild()` have **zero callers** in `src/` (grep-verified). The `update-index` journal step only mutates the in-memory instance; the `index` object store is never written or read in production. After an extension reload the index is empty and `search()` returns `[]` until… nothing ever rebuilds it. NOTE-01 search is broken across sessions; the persistence layer is dead code.
**Fix:** Call `noteSearchIndex.load()` at startup (alongside `replayJournal`) and `noteSearchIndex.persist()` after index mutations (e.g., inside/after the `update-index` journal step, or subscribe to `note:saved`), or wire `rebuild()` from `notesDb.getAll()` at startup as a recovery path.

### WR-02: NotesStore mirror diverges from persisted note after save

**File:** `src/core/storage/NotesStore.ts:34-42`
**Issue:** `saveNote()` updates the local mirror with the raw `note` argument, not the persisted record. NotesDB.save() stores the *derived* note — resolved `links[]`/`unresolvedLinks[]`, incremented `version`, fresh `updatedAt` — but the mirror keeps the stale, un-derived input. UI consumers (list ordering, note graph via the store mirror, version display) show stale data until a manual `refreshNotes()`. This silently nullifies the D-01 derived-links contract at the UI boundary.
**Fix:** After a successful save, re-fetch the persisted note:
```ts
if (result.success) {
  const persisted = await notesDb.get(result.noteId);
  if (persisted.success) {
    set((state) => {
      const idx = state.notes.findIndex((n) => n.id === result.noteId);
      if (idx >= 0) state.notes[idx] = persisted.note;
      else state.notes.push(persisted.note);
    });
  }
}
```

### WR-03: MemoryEngine.write() can never persist working/episodic/preference records — the D-05 AI-write path is dead code

**File:** `src/core/memory/MemoryEngine.ts:224-238, 355-367`; `src/core/memory/UserMemoryStore.ts:53`
**Issue:** Every write is routed through `userStore.upsert(record as unknown as UserFactUpsertInput)`, and `UserMemoryFactSchema` pins `memoryType: z.literal('semantic')`. Therefore:
- **working/episodic** — the *only* types the D-05 guard allows the AI pipeline to write — are always rejected by Zod inside the journal executor → `JOURNAL_ERROR`. The guard's own error message ("AI pipeline may only write working/episodic…") describes a path that cannot succeed.
- **preference** via `write()` (from `user-action`) also always fails; only `semantic` ever works. There is no working preference write path through the engine at all (callers must reach into `PreferenceMemoryStore` directly).

The API contract misleads every future caller (Phase 5a note→memory extraction, Phase 7 UI) into a failing path with a confusing `JOURNAL_ERROR`.
**Fix:** Route by type in the executor (semantic → `userStore.upsert`, preference → `preferenceStore.set`, working/episodic → `conversationStore.appendMessage`), or narrow `write()` to `memoryType: 'semantic'` at the type level and add a dedicated `setPreference()` / `appendConversationMessage()` API.

### WR-04: MEM-02 single-writer election is never invoked and cannot propagate across surfaces

**File:** `src/core/runtime/BroadcastBus.ts:14-29`; `src/core/memory/MemoryEngine.ts:87-89`
**Issue:** `setPrimarySurfaceId()` has **zero production callers** (grep-verified — only tests). The election state is also module-local per JS context; each extension surface (SidePanel, Full App Tab) runs its own module instance, and the state is never synchronized via BroadcastChannel (which the bus already wraps for pub/sub). As shipped: (a) nothing ever elects a primary, so `primarySurfaceId === null` → every surface is primary → the gate is a no-op; (b) even if one context elected itself, the other context would still see `null` and remain "primary". MEM-02 is not enforceable across surfaces with this wiring.
**Fix:** Elect at entrypoint startup and broadcast election changes: `setPrimarySurfaceId()` publishes a `PRIMARY_SURFACE_ELECTED` message on the existing channel; every context subscribes and applies remote election state (or persist in `chrome.storage.local` with a listener).

### WR-05: WriteJournal replay is never wired — phase-5 journal steps have no registered executors

**File:** `src/core/storage/WriteJournal.ts:168-211`; `src/core/notes/NotesDB.ts:84-102`; `src/core/memory/MemoryEngine.ts:224-246`
**Issue:** `replayJournal()`/`repairEntry()` have no callers in `src/`, and no executor registry exists for the new step names (`write-note`, `update-index`, `write-memory-record`, `broadcast-workspace-update`). A crash between `write-note` and `update-index` leaves the entry `applying` forever — and even if replay were invoked, it would fail the entry because `stepExecutors` has no mapping for these names. The "crash consistency" claim of both journaled paths is inert as shipped.
**Fix:** Register step executors at module init (e.g., a `registerStepExecutors()` called from an entrypoint) and invoke `replayJournal(executors)` on startup; add a test that simulates an interrupted `save-note-with-links` entry and verifies recovery.

### WR-06: Summarization prompt delimiter can be broken by message content — indirect prompt-injection vector

**File:** `src/core/memory/ConversationMemoryStore.ts:46-55, 204-205`; `src/core/memory/MemoryEngine.ts:106-118`
**Issue:** Untrusted message content is interpolated raw into `SUMMARY_PROMPT_TEMPLATE` between `<data-source>` markers. A message containing `</data-source>` (or the literal `Summary:` tail) terminates the block early and injects instructions into the summarization call. The summary produced is later re-injected into the model context via `retrieve()` at **trust 0.9** with `instructionAuthority: 'data'` — so a crafted user message can plant content that persists in the summary and is trusted on every future turn. The `<data-source>` wrapper alone is not a defense (delimiter collision), which undercuts the claimed T-05-10 mitigation.
**Fix:** Sanitize the excerpt before embedding — reject or strip any occurrence of the delimiter sequence (`</data-source>`) and the prompt tail in message content, e.g. `formatted.replace(/<\/?data-source>/g, '')`, and assert the assembled prompt contains exactly one delimiter pair.

### WR-07: Search snippets embed raw note content as HTML — stored-XSS risk at render time

**File:** `src/core/notes/MiniSearchNoteIndex.ts:49-74`
**Issue:** `buildSnippet()` returns note content (user-controlled, possibly imported) with query terms wrapped in `<mark>`, unescaped. The natural consumer renders this via `innerHTML` (the whole point of `<mark>`), which executes any markup/scripts carried in note content (SEC-01 territory; `note:saved` events and Phase 7 UI will surface this). The unit tests only assert `<mark>` presence, so nothing catches this today.
**Fix:** Escape the excerpt first, then wrap the escaped terms: `excerpt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')` before applying the `<mark>` regex — and require DOMPurify at the render boundary (SEC-01).

### WR-08: loadPersonaFromMemory casts stored JSON to PersonaProfile without validation

**File:** `src/core/ai/persona/PersonaInjector.ts:18-22`; `src/core/ai/persona/PersonaProfile.ts:3-10`
**Issue:** `np_persona` is user-controlled JSON from IndexedDB, cast directly to `PersonaProfile` — `PersonaProfileSchema` exists but is unused. A malformed stored value (e.g., `coreValues` missing or a non-array, tone outside the enum) crashes at prompt-build time: `buildPersonaBlock` calls `profile.coreValues.sort()` (TypeError on non-array), or injects `undefined` values into the system prompt. The `DEFAULT_PERSONA` fallback only covers the null case.
**Fix:**
```ts
const parsed = PersonaProfileSchema.safeParse(stored);
return parsed.success ? parsed.data : DEFAULT_PERSONA;
```

### WR-09: appendMessage seq assignment races — concurrent appends silently overwrite each other

**File:** `src/core/memory/ConversationMemoryStore.ts:161-170`
**Issue:** `seq = existing.length` is a read-then-write without a transaction. Two appends to the same conversation overlapping (rapid turns, or append racing an eviction) compute the same `seq`; the second `db.put` overwrites the first — a conversation message is silently lost. The D-10 compact-boundary count then drifts.
**Fix:** Perform the count+put in a single readwrite transaction on `memory_messages` (or use a per-conversation counter record incremented transactionally, or `IDBKeyRange` + `openKeyCursor(null, 'prev')` inside the same transaction to derive `seq` atomically).

## Info

### IN-01: `note:saved` event has no subscribers

**File:** `src/core/notes/NotesDB.ts:114`
**Issue:** `emit('note:saved', …)` fires on every successful save but no `on('note:saved')` handler exists anywhere in `src/` (grep-verified). The event is dead until Phase 5a/7 wiring — fine as a contract, but it should be tracked so downstream sync (persist index, graph recompute) actually lands.

### IN-02: NotesDB.remove() bypasses the journal and leaves dangling links

**File:** `src/core/notes/NotesDB.ts:156-168`
**Issue:** Deletion is direct `db.delete` + in-memory index discard (no journal step, and no re-derivation of other notes' `links[]`). Notes referencing the deleted id keep dangling `links[]` entries, so `NoteGraph.getBacklinks`/`computeEdges` emit edges to nonexistent notes until those notes are re-saved.

### IN-03: No optimistic locking on note version

**File:** `src/core/notes/NotesDB.ts:71-81`
**Issue:** `version` is computed as read-then-write (`get()` → `version + 1` → `put`) with no conflict check. Two concurrent saves of the same note both persist — one content update is silently lost (last-write-wins). The `version` counter (D-17) therefore does not actually protect against lost updates.

### IN-04: write() inflates useCount on every write, including updates

**File:** `src/core/memory/MemoryEngine.ts:262-264`
**Issue:** `incrementUseCount` runs after every successful write — a freshly created fact immediately starts at `useCount = 1`, and repeated edits inflate the D-08 useCount sub-score. The counter is documented as retrieval-frequency (D-07) but conflates write frequency with retrieval.

### IN-05: Conversation turn sourceIds are unstable across retrievals

**File:** `src/core/memory/MemoryEngine.ts:120-133`
**Issue:** `sourceId: memory.conversation.turn.${index}` uses the index within the tail slice, not the message `seq`. As the tail shifts, the same message gets a different sourceId on the next turn — receipts/caching keys (Phase 4b CTX-T03) will not be stable.

### IN-06: Summary sensitivity 'public' vs. source messages 'private'

**File:** `src/core/memory/MemoryEngine.ts:106-118`
**Issue:** The conversation summary item is labeled `sensitivity: 'public'` while the messages it is derived from are `'private'`. Summaries contain decisions/preferences/facts from private conversation text; if consumed before the 4b ContextTrustPolicy re-derives sensitivity, cloud-eligibility logic would treat them as exportable.

### IN-07: getMemoryEngine(surfaceId) silently ignores the parameter after first pinning

**File:** `src/core/memory/MemoryEngine.ts:381-386`
**Issue:** The second surface calling `getMemoryEngine('B')` receives the instance pinned to surface A. This is safe today because each extension surface has its own JS context (per STATE.md decision), but the API is a trap — document it or assert/throw on mismatch.

---

_Reviewed: 2026-08-02T08:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
