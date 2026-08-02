---
phase: 05a-llm-wiki-filesystem-sync
plan: 02
type: execute
wave: 2
depends_on: [05a-01]
files_modified:
  - src/core/notes/NotesDB.ts
  - src/core/notes/NoteFileSync.ts
  - src/core/notes/NoteQA.ts
  - tests/core/notes/NotesDB.test.ts
  - tests/core/notes/NoteFileSync.test.ts
  - tests/core/notes/NoteQA.test.ts
  - tests/core/notes/NoteMaintenance.test.ts
autonomous: true
gap_closure: true
requirements: [NOTE-02, NOTE-03]

must_haves:
  truths:
    - "Deleting a note removes its .md file and empty parent category folders through the note:deleted event path — full save→delete→cleanup integration chain green (WR-02)"
    - "Renaming a note (title or categoryPath change) removes the orphaned .md at the old path through the note:renamed event path (WR-02)"
    - "NotesDB.remove() emits note:deleted with {noteId, title, categoryPath} so the sync layer can compute the exact old file path"
    - "NotesDB.save() emits note:renamed with {noteId, oldTitle, oldCategoryPath} when title or categoryPath changed vs the persisted note"
    - "tagsGeneratedAt/summaryGeneratedAt are written by NotesDB.save() when the incoming tags/summary differ from the persisted note (WR-03 decision: implement now at service layer) — getStaleNotes() can distinguish 'enriched then edited' from 'never enriched'"
    - "getStaleNotes() viability restored: a note enriched then edited returns stale; a note enriched and untouched does not; a never-enriched note is stale only after the 60s grace (LLM-WIKI-08, UI-SPEC staleness hint lift)"
    - "NoteQA markerless fallback citations carry only REAL snippet noteIds/titles rebuilt by referenceNumber index — fabricated LLM noteId/title never enters the Citation[] (WR-05, 'never cite non-existent notes')"
  artifacts:
    - src/core/notes/NotesDB.ts
    - src/core/notes/NoteFileSync.ts
    - src/core/notes/NoteQA.ts
    - tests/core/notes/NoteFileSync.test.ts
    - tests/core/notes/NotesDB.test.ts
    - tests/core/notes/NoteQA.test.ts
    - tests/core/notes/NoteMaintenance.test.ts
  key_links:
    - "NotesDB.remove() → emit('note:deleted') → NoteFileSync.handleNoteDelete (event-driven, not direct invocation)"
    - "NotesDB.save() → emit('note:renamed') (title/categoryPath diff) → NoteFileSync.handleNoteRename"
    - "NotesDB.save() → staleness timestamp diff-writer (tagsGeneratedAt/summaryGeneratedAt) → NoteMaintenance.getStaleNotes()"
    - "NoteQA.buildCitations markerless fallback → snippets[referenceNumber-1] rebuild (authoritative snippet data)"
  prohibitions:
    - statement: "MUST NOT leave orphaned .md files when a note is renamed or deleted — cleanup must fire from the event path, never be dead code (WR-02)"
      status: flagged-unverified
      verification: "asserted by 05a-02 task 1 integration tests (save→delete→cleanup chain through EventBus)"
    - statement: "MUST NOT write tagsGeneratedAt/summaryGeneratedAt when enrichment is only suggested — timestamps mark APPLIED (persisted) enrichment changes (WR-03, D-05)"
      status: flagged-unverified
      verification: "asserted by 05a-02 task 2 diff-writer tests"
    - statement: "MUST NOT push LLM-supplied noteId/title into Citation[] in the markerless fallback — rebuild from the snippet array (WR-05)"
      status: flagged-unverified
      verification: "asserted by 05a-02 task 3 NoteQA fallback tests"
  assumptions:
    - "NOTE-02 edge coverage was unclassified at gap-closure time (no SPEC.md) — WR-05 is the only NOTE-02 service-layer gap addressed here; remaining NOTE-02 edges assumed covered by the existing 34-test NOTE-02 suites (NoteTagger/NoteQA/NoteChatConverter/NoteMaintenance); Phase 7 UI rendering (SC1/SC2/SC3) deferred (recorded in 05a-03)"
---

<objective>
Close the remaining VERIFICATION.md gaps that live outside the NoteFileSync write path: WR-02 (note:deleted/note:renamed cleanup handlers are dead code — zero callers, no events emitted), WR-03 (staleness timestamps never written — getStaleNotes() degenerates to 'everything old is stale'), and WR-05 (NoteQA markerless fallback trusts LLM-supplied noteId/title — fabricated citations can reference non-existent notes).

Purpose: Wire the D-12 cleanup guarantees into the running app via EventBus events (NotesDB is the single write path), make the LLM-WIKI-08 staleness feature actually viable at the service layer (decision: implement the timestamp writer now, so Phase 7 needs no extra writer), and restore the 'never cite non-existent notes' prohibition in the citation fallback.
Output: Event-driven rename/delete cleanup (integration-tested end-to-end), staleness timestamp diff-writer in NotesDB.save(), and snippet-authoritative fallback citations. NOTE-03 WR-02 + NOTE-02 WR-03/WR-05 closed.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Files being modified (current state)
@src/core/notes/NotesDB.ts
@src/core/notes/NoteFileSync.ts
@src/core/notes/NoteQA.ts
@tests/core/notes/NoteFileSync.test.ts
@tests/core/notes/NoteQA.test.ts
@tests/core/notes/NoteMaintenance.test.ts

# Gap definitions and review fix directives
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-VERIFICATION.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-REVIEW.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-01-SUMMARY.md
@.planning/phases/05a-llm-wiki-filesystem-sync/05a-03-SUMMARY.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wire note:deleted/note:renamed events + subscription + save→delete→cleanup integration chain (WR-02)</name>
  <files>src/core/notes/NotesDB.ts, src/core/notes/NoteFileSync.ts, tests/core/notes/NoteFileSync.test.ts</files>
  <read_first>
    - src/core/notes/NotesDB.ts — remove() (L202-216, currently emits nothing), save() (L54-147, existing fetched at L72), emit import (L4)
    - src/core/notes/NoteFileSync.ts — initNoteFileSync (L240-246), handleNoteRename (L457-463), handleNoteDelete (L469-475), removeFileAndEmptyParents (L477-510), buildFilePath (L84-87), unsub pattern (L804-822)
    - tests/core/notes/NoteFileSync.test.ts — makeBackupFs/pickerStub/makeNote/addFile/fm helpers, existing handler-unit tests ('handleNoteRename deletes the old .md', 'handleNoteDelete removes file and empty parent folders')
    - 05a-REVIEW.md WR-02 fix directive (emit events from delete/rename paths + subscribe in initNoteFileSync + integration test)
  </read_first>
  <behavior>
    - Test 1 (save→delete→cleanup integration chain): setBackupFolder (mock picker) → NotesDB.save(note) → advance debounce → .md exists on mock FS → NotesDB.remove(noteId) → assert .md deleted AND empty parent category folders removed — the whole chain driven through EventBus + real NotesDB calls, NOT direct handleNoteDelete invocation.
    - Test 2 (rename chain): save note (title A) → sync → save with title B → note:renamed fires → old A.md deleted, B.md written. Assert both file states on the mock FS.
    - Test 3 (delete without backup folder): NotesDB.remove() emits note:deleted even when sync is disabled — handler no-ops safely (no throw, no crash).
    - Test 4 (payload shapes): note:deleted payload = {noteId, title, categoryPath}; note:renamed payload = {noteId, oldTitle, oldCategoryPath}.
    - Test 5 (no rename event on non-rename save): save with same title/categoryPath emits NO note:renamed.
  </behavior>
  <action>
    Per 05a-REVIEW.md WR-02 — handleNoteRename/handleNoteDelete have ZERO callers and no note:deleted/note:renamed event exists; cleanup never happens in the running app.

    1. NotesDB.ts — define and export payload types (emitter side, avoids circular import with NoteFileSync):
       - `export interface NoteDeletedEvent { noteId: string; title: string; categoryPath: string }`
       - `export interface NoteRenamedEvent { noteId: string; oldTitle: string; oldCategoryPath: string }`
    2. NotesDB.ts remove(): fetch the note BEFORE deleting (const found = await this.get(id); if !found.success return), then after db.delete + index persist, `emit<NoteDeletedEvent>('note:deleted', { noteId: id, title: found.note.title, categoryPath: found.note.categoryPath })`.
    3. NotesDB.ts save(): after the existing `emit('note:saved', …)` at L138, when `existing.success && (existing.note.title !== parsed.title || existing.note.categoryPath !== parsed.categoryPath)` → `emit<NoteRenamedEvent>('note:renamed', { noteId: parsed.id, oldTitle: existing.note.title, oldCategoryPath: existing.note.categoryPath })`. Do NOT emit when nothing changed.
    4. NoteFileSync.ts initNoteFileSync(): subscribe BOTH events (idempotent like note:saved — guard with the same `if (unsub) return`):
       - `on<NoteDeletedEvent>('note:deleted', ({ noteId, title, categoryPath }) => void this.handleNoteDelete(noteId, buildFilePath(categoryPath, title)))`
       - `on<NoteRenamedEvent>('note:renamed', ({ noteId, oldTitle, oldCategoryPath }) => void this.handleNoteRename(noteId, buildFilePath(oldCategoryPath, oldTitle)))`
       - Also cancel any pending per-note debounce timer for the deleted noteId (clear the WR-01 map entry from 05a-01 task 3) so a queued sync cannot resurrect the file after deletion.
    5. Integration tests in NoteFileSync.test.ts (new describe block 'lifecycle integration'): use the existing helpers — full chains per the behavior block above. The tests MUST drive through NotesDB.save/remove + EventBus, not direct handler calls.
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NoteFileSync.test.ts tests/core/notes/NotesDB.test.ts --no-coverage && npx tsc --noEmit</automated>
  </verify>
  <done>
    - grep shows call sites: initNoteFileSync subscribes note:deleted and note:renamed; no more zero-caller dead handlers.
    - The save→delete→cleanup chain test passes through the EventBus (not direct method calls): .md + empty parents removed after NotesDB.remove().
    - The rename chain test passes: old .md gone, new .md present after a title-changing save.
    - All pre-existing NoteFileSync/NotesDB tests stay green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Staleness timestamp diff-writer in NotesDB.save() (WR-03 — implement now, decision recorded)</name>
  <files>src/core/notes/NotesDB.ts, tests/core/notes/NotesDB.test.ts, tests/core/notes/NoteMaintenance.test.ts</files>
  <read_first>
    - src/core/notes/NotesDB.ts — save() finalNote construction (L86-93), existing-note fetch (L72), lastSyncedAt preservation block (L79-84)
    - src/core/notes/NoteSchema.ts — summaryGeneratedAt/tagsGeneratedAt optional fields (L39-40)
    - src/core/notes/NoteMaintenance.ts — getStaleNotes() (L50-66, 60s grace, never-enriched branch), FRESH_NOTE_GRACE_MS
    - tests/core/notes/NoteMaintenance.test.ts — existing staleness tests (current expectations may assume no writer)
    - 05a-REVIEW.md WR-03 fix directive + VERIFICATION.md WR-03 human item (the decision contract)
  </read_first>
  <behavior>
    - Test 1: save(note with tags changed vs persisted) → tagsGeneratedAt set to a timestamp ≥ prior value; save(same tags) → tagsGeneratedAt unchanged.
    - Test 2: save(note with summary changed) → summaryGeneratedAt set; summary unchanged → preserved.
    - Test 3: create (no existing) → neither timestamp set unless payload explicitly carries them (never-enriched state preserved).
    - Test 4 (integration with getStaleNotes): note enriched (tagsGeneratedAt=t0) then content-only edit (updatedAt=t1>t0, tags unchanged) → getStaleNotes() returns it; untouched enriched note → not stale; never-enriched note edited within grace → not stale, after grace → stale.
  </behavior>
  <action>
    DECISION RECORDED (WR-03): implement the staleness timestamp writer NOW at the service layer, in NotesDB.save(). Rationale: the Phase 7 enrichment-acceptance flow re-saves the accepted note via NotesDB.save() (D-18), so a diff-writer here makes getStaleNotes() viable regardless of Phase 7 behavior; deferring would leave LLM-WIKI-08 degenerate. reanalyzeAll() must NOT write timestamps (enrichment is in-memory only per D-05 — timestamps mark APPLIED changes).

    1. NotesDB.ts save(): in the finalNote construction (L86-93), compute diff-writer fields when `existing.success`:
       - `tagsChanged = JSON.stringify(existing.note.tags) !== JSON.stringify(parsed.tags)` — or array-equality; if tagsChanged → `tagsGeneratedAt: Date.now()`, else preserve `parsed.tagsGeneratedAt ?? existing.note.tagsGeneratedAt`.
       - `summaryChanged = (existing.note.summary ?? null) !== (parsed.summary ?? null)` → if summaryChanged → `summaryGeneratedAt: Date.now()`, else preserve `parsed.summaryGeneratedAt ?? existing.note.summaryGeneratedAt`.
       - When NOT existing.success (create): keep `parsed.tagsGeneratedAt` / `parsed.summaryGeneratedAt` as-is (undefined unless payload carries them) — a brand-new note is 'never enriched'.
    2. Do NOT touch NoteMaintenance.getStaleNotes() logic — it already implements the intended comparison (L50-66); only the writer was missing.
    3. Update any NoteMaintenance.test.ts expectations that encoded the 'no writer' degenerate behavior; add the integration tests from the behavior block.
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NotesDB.test.ts tests/core/notes/NoteMaintenance.test.ts --no-coverage && npx tsc --noEmit</automated>
  </verify>
  <done>
    - grep 'tagsGeneratedAt\s*=\|summaryGeneratedAt\s*=' in src/core/notes/NotesDB.ts returns the diff-writer assignments (writers now exist outside NoteSchema/Maintenance).
    - getStaleNotes() distinguishes 'enriched then edited' (timestamps < updatedAt) from 'never enriched' (no timestamps, grace rule) — integration tests green.
    - Full note suites stay green (NotesDB, NoteMaintenance, NoteTagger — NoteTagger.test.ts L408 uses updateLastSyncedAt which must remain untouched).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: NoteQA markerless fallback rebuilds citations from snippets (WR-05)</name>
  <files>src/core/notes/NoteQA.ts, tests/core/notes/NoteQA.test.ts</files>
  <read_first>
    - src/core/notes/NoteQA.ts — buildCitations (L155-176), SnippetInfo (L54), parseCitations (L90), Citation shape
    - tests/core/notes/NoteQA.test.ts — existing markerless-fallback tests (may assert the old verbatim passthrough)
    - 05a-REVIEW.md WR-05 fix snippet (rebuild from snippets[c.referenceNumber-1])
  </read_first>
  <behavior>
    - Test 1: markerless answer with LLM-supplied fabricated noteId/title → output citations carry the REAL snippet noteId/title for the referenced index; fabricated values never appear.
    - Test 2: out-of-range referenceNumber (0 or > snippets.length) → citation dropped (existing range check preserved).
    - Test 3: duplicate referenceNumbers → deduped (existing behavior preserved).
  </behavior>
  <action>
    Per 05a-REVIEW.md WR-05: the markerless fallback pushes the LLM's citation object VERBATIM — noteId/title can be hallucinated, violating the 'never cite non-existent notes' prohibition (D-13 requires citations to map to actual source notes).

    1. NoteQA.ts buildCitations(): in the markerless fallback loop (L170-176), replace `out.push(c)` with a snippet-index rebuild:
       - `const s = snippets[c.referenceNumber - 1];` then `out.push({ noteId: s.noteId, title: s.title, relevantSnippet: s.snippet, referenceNumber: c.referenceNumber })`.
       - Keep the existing guards: skip if referenceNumber < 1 or > snippets.length; skip if already used (dedupe). LLM-supplied noteId/title/relevantSnippet fields are IGNORED entirely.
    2. Update/add NoteQA.test.ts tests per the behavior block; fix any existing test that asserted the old verbatim passthrough.
  </action>
  <verify>
    <automated>npx vitest run tests/core/notes/NoteQA.test.ts --no-coverage && npx tsc --noEmit</automated>
  </verify>
  <done>
    - Markerless fallback citations reference only real snippets (noteId/title/relevantSnippet sourced from snippets[]); fabricated LLM values never appear in output.
    - Existing marker-path citations (parseCitations) unchanged and green.
    - All 11 pre-existing NoteQA tests + new tests pass.
  </done>
</task>

</tasks>

## Artifacts this phase produces

- `NotesDB.NoteDeletedEvent` / `NotesDB.NoteRenamedEvent` — new exported event payload types.
- Event names `note:deleted`, `note:renamed` — emitted by NotesDB.remove() / NotesDB.save() (title/categoryPath diff).
- `NoteFileSync.initNoteFileSync` subscriptions for both events + pending-debounce cancellation on delete.
- `NotesDB.save()` staleness diff-writer — tagsGeneratedAt/summaryGeneratedAt written on applied tags/summary changes (WR-03).
- `NoteQA.buildCitations` markerless fallback — snippet-index rebuild, LLM noteId/title ignored (WR-05).

## Deferred to Phase 7

- SC1/SC2/SC3 UI rendering (enrichment suggestions accept/reject, clickable citations, pre-filled editor) — Phase 7 UI scope (VERIFICATION.md human items).
- Staleness hint rendering ("Content has changed — [Regenerate tags/summary]") — Phase 7 renders from getStaleNotes(), now viable via the WR-03 writer.
- UI-SPEC backstop rows (2): RAG in-flight indicator bubble + Ask-bar in-flight indicator — Phase 7 visual tests.
- UI-SPEC unresolved row (1): Re-analyze progress widget shape — Phase 7 planner assumption (sequential per-note updates).

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| NotesDB write paths → EventBus → NoteFileSync cleanup | delete/rename events carry note identity (title/categoryPath) used to compute filesystem paths; a stale or fabricated payload could delete the wrong file |
| LLM output → NoteQA citations | the LLM is untrusted for factual claims about note identity (noteId/title) — only snippet data derived from the actual index is authoritative |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-05a-06 | Tampering | NotesDB.remove() → note:deleted → handleNoteDelete path | medium | mitigate | payload carries only identity fields read from the fetched note BEFORE deletion (task 1); path derived via buildFilePath from trusted DB fields; pending debounce cancelled so a queued sync cannot resurrect the file |
| T-05a-07 | Repudiation | note:renamed emission (save with title/categoryPath diff) | low | mitigate | diff computed against the persisted note inside the single save() path — no duplicate/missing events; no emit when unchanged (task 1 test 5) |
| T-05a-08 | Spoofing | NoteQA markerless fallback citations (WR-05) | medium | mitigate | rebuild citations from snippets[referenceNumber-1] — LLM-supplied noteId/title/relevantSnippet never enter Citation[] (task 3) |
| T-05a-09 | Tampering | staleness timestamps (WR-03) | low | mitigate | diff-writer only stamps on APPLIED tags/summary changes; create path leaves timestamps unset (never-enriched) — no false 'enriched' claims |
| T-05a-SC | Tampering | npm/pip/cargo installs | low | accept | no new package installs in this plan — all changes are edits to existing source/test files |

</threat_model>

<verification>
- `npx vitest run tests/core/notes/NoteFileSync.test.ts tests/core/notes/NotesDB.test.ts tests/core/notes/NoteQA.test.ts tests/core/notes/NoteMaintenance.test.ts --no-coverage` — all green
- `npx tsc --noEmit` — clean
- grep checks: `'note:deleted'` and `'note:renamed'` appear in both NotesDB.ts (emit) and NoteFileSync.ts (on); `tagsGeneratedAt\s*=` and `summaryGeneratedAt\s*=` appear in NotesDB.ts
- Full-suite regression is the explicit 05a-03 task
</verification>

<success_criteria>
- WR-02 closed: rename/delete cleanup is event-driven and integration-tested end-to-end (save→delete→cleanup chain green)
- WR-03 closed: staleness timestamps have a service-layer writer; getStaleNotes() distinguishes enriched-then-edited from never-enriched
- WR-05 closed: markerless fallback citations are snippet-authoritative — 'never cite non-existent notes' holds
- No regression in the pre-existing NoteFileSync/NotesDB/NoteQA/NoteMaintenance suites
</success_criteria>

<output>
Create `.planning/phases/05a-llm-wiki-filesystem-sync/05a-02-SUMMARY.md` when done
</output>
