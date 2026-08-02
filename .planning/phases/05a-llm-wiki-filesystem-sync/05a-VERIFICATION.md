---
phase: 05a-llm-wiki-filesystem-sync
verified: 2026-08-02T05:01:36Z
status: gaps_found
score: 16/20 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "A backup folder configuration store exists after migration so handles can persist across browser sessions (05a-01 T3)"
    status: failed
    reason: "CR-01 (code-review verified): persistHandle() unconditionally converts the real FileSystemDirectoryHandle to a plain-data snapshot via toPlainHandle(), which reads lastModified/content/permissionState members the real platform objects do not have (verified against @types/wicg-file-system-access). Every real file persists as lastModified:0/content:'' and the directory permissionState as 'prompt'. After restart, loadPersistedHandle() rehydrates a phantom in-memory handle whose queryPermission()/requestPermission() always return 'prompt' — checkPermission() fails, sync disables with handle_expired, and even if it passed, writes would mutate the in-memory tree, never the filesystem. The store exists structurally but the D-09 cross-session persistence guarantee is broken. Class-based test mocks carry these members as own properties, so all 35 tests pass while production silently fails."
    artifacts:
      - path: "src/core/notes/NoteFileSync.ts"
        issue: "persistHandle (L206-216) / toPlainHandle (L700-721) / rehydrateHandle (L724-800) — snapshot destroys real handle fidelity"
    missing:
      - "Persist the native FileSystemDirectoryHandle directly (Chrome structured-clones it) or branch: only snapshot non-native/test-double handles — per 05a-REVIEW.md CR-01 fix"
  - truth: "NoteFileSync resolves title collisions via numeric suffixing ({title} 1.md, {title} 2.md) per D-12 (05a-03 T5)"
    status: failed
    reason: "CR-02 (code-review verified): the external-change/collision decision in syncNote (L310-334) uses timestamps only and never checks the existing file's frontmatter id. Two notes with the same sanitized title: note B collides once to 'React 1.md', then on its next save the canonical React.md is no longer newer than B.lastSyncedAt+2s → B overwrites A's canonical file with B's content. The SUMMARY claim 'a DIFFERENT note's file collides to a suffix' is not what the code implements — cross-note backup corruption is possible, and restoreFromFolder would later import the wrong content under A's id."
    artifacts:
      - path: "src/core/notes/NoteFileSync.ts"
        issue: "syncNote L310-334 + collideFileName L381-398 — no ownership (frontmatter id) check"
    missing:
      - "Check the existing file's frontmatter id before deciding overwrite vs collide — per 05a-REVIEW.md CR-02 fix"
  - truth: "NoteFileSync deletes orphaned .md on note rename and deletes .md + empty parent folders on note deletion per D-12 (05a-03 T6)"
    status: failed
    reason: "WR-02 (verified by grep): handleNoteRename()/handleNoteDelete() are exported and unit-tested but have ZERO callers in src/ — no note:deleted/note:renamed event exists anywhere (grep confirms), and NotesDB.remove() emits no event. In the running app, renaming or deleting a note leaves the orphan .md on disk forever. The must-have truth asserts observable behavior that does not occur."
    artifacts:
      - path: "src/core/notes/NoteFileSync.ts"
        issue: "handleNoteRename L457-463 / handleNoteDelete L469-475 — dead code, never wired"
    missing:
      - "Emit note:deleted/note:renamed events from the delete/rename paths and subscribe in initNoteFileSync(), or invoke from the Phase 7 deletion flow; add an integration test of the full save→delete→cleanup chain — per 05a-REVIEW.md WR-02 fix"
  - truth: "ROADMAP SC4: User sets a backup folder via showDirectoryPicker() — per-save .md files are written with YAML frontmatter, nested categoryPath folders, collision suffixing, and external-change detection"
    status: partial
    reason: "In-session behavior works (frontmatter/nested folders/debounce/permission checks all tested green). But the feature's safety guarantees do not hold end-to-end: (a) CR-01 — the backup silently stops functioning after any extension restart (phantom rehydrated handle); (b) CR-02 — collision suffixing can be bypassed, letting one note overwrite another note's backup file. Both defects are code-verified and reproduced by the review's scenarios."
    artifacts:
      - path: "src/core/notes/NoteFileSync.ts"
        issue: "CR-01 handle persistence fidelity; CR-02 collision ownership"
    missing:
      - "Apply CR-01 + CR-02 fixes (see gaps above) so the one-way .md backup is durable across sessions and cannot corrupt another note's file"
human_verification:
  - test: "SC1 render surface: in the Phase 7 Notes UI, save a note and confirm auto-tag/category/summary suggestions render inline with accept/reject controls (note:enriched event → component state)"
    expected: "Suggestions appear for accept/reject after each save; accepting re-saves the note with the chosen tags/category/summary"
    why_human: "The service emits note:enriched in-memory (D-05); the rendering and accept/reject UI is Phase 7 scope and does not exist in this phase"
  - test: "SC2 clickable citations: in the Phase 7 'Ask notes' bar, ask a question and confirm each [N] citation is clickable and navigates to the source note"
    expected: "Answer renders with per-statement citation links that open the referenced note"
    why_human: "NoteQA returns Citation[] with noteId/title/relevantSnippet; clickable rendering is Phase 7 UI scope"
  - test: "SC3 pre-filled editor: in Phase 7, trigger 'Save to note' on a chat exchange and confirm a pre-filled editor opens (draft title/content/tags/wikilinks/categoryPath) where the user must explicitly save"
    expected: "Editor opens pre-filled with the NoteDraft; nothing is saved until the user confirms"
    why_human: "NoteChatConverter returns the draft; the editor UI and user-gatekeeper flow is Phase 7 scope"
  - test: "Real-browser File System Access API behavior: in Chrome (Full App), set a backup folder, save notes, verify .md files appear with YAML frontmatter; then restart the extension and verify whether backup resumes automatically"
    expected: "Per-save .md files written with correct frontmatter; after restart, backup should resume without re-selecting the folder (D-09) — note this is currently EXPECTED TO FAIL per CR-01 (phantom rehydrated handle disables sync with handle_expired)"
    why_human: "File System Access API and real FileSystemDirectoryHandle structured-clone behavior cannot be exercised in vitest/jsdom; class-based mocks diverge from production (CR-01)"
  - test: "Staleness feature viability (WR-03): confirm whether the Phase 7 enrichment-acceptance flow (or NotesDB.save) writes tagsGeneratedAt/summaryGeneratedAt when tags/summary change"
    expected: "Some code path writes the timestamps so getStaleNotes() can distinguish 'enriched then edited' from 'never enriched'"
    why_human: "No writer exists in this phase's code (grep-verified); the Phase 7 acceptance flow may add one — without it, getStaleNotes() flags every old note as stale"
---

# Phase 05a: LLM-Wiki & Filesystem Sync Verification Report

**Phase Goal:** User enriches notes via a single haiku call (tags + category + summary + memory facts), asks questions via RAG with citations, converts chat/page content to notes, and syncs to filesystem with one-way .md backup
**Verified:** 2026-08-02T05:01:36Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: Save triggers NoteTagger.analyze() non-blocking (single haiku call); enrichment suggestions emitted for accept/reject; save never blocks on LLM | ✓ VERIFIED | `src/core/notes/NoteTagger.ts` — `initNoteTagger()` subscribes `note:saved` (fire-and-forget, `void handleNoteSaved`), `analyze()` single `LlmService.generate({tier:'FAST', schema: NoteTaggerResultSchema})`, errors → null. NotesDB.save() emits after commit, never awaits LLM. Tracer test + 18 tests green |
| 2 | SC2: NoteQA.ask() retrieves MiniSearch top-5 + memory facts, synthesizes flash-tier answer with numbered citations mapping to source notes | ✓ VERIFIED | `src/core/notes/NoteQA.ts` — ask mode: `noteSearchIndex.search(q,5)` + `MemoryEngine.retrieve()` (top 3), BALANCED-tier generate, `parseCitations()` rebuilds citations from snippet array (range-validated, deduped). 11 tests green. ⚠️ WR-05: fallback path (no inline markers) pushes LLM-supplied noteId/title verbatim — see Anti-Patterns |
| 3 | SC3: NoteChatConverter produces pre-filled draft (title/content/tags/wikilinks/categoryPath) via haiku + memory context; user is gatekeeper | ✓ VERIFIED | `src/core/notes/NoteChatConverter.ts` — `convert()` assembles memory context + chat messages, single FAST-tier call with NoteDraftSchema; all fields returned. 5 tests green. Editor UI is Phase 7 scope (human item) |
| 4 | SC4: setBackupFolder via showDirectoryPicker — per-save .md with YAML frontmatter, nested categoryPath folders, collision suffixing, external-change detection | ✗ FAILED (partial) | In-session write path works (35 tests green). But CR-01 breaks the backup after any restart (phantom handle) and CR-02 allows cross-note overwrite of the canonical .md — see gaps |
| 5 | SC5: restoreFromFolder additive upsert with preview "Found N notes (X new, Y updated, Z unchanged)"; never deletes local notes; migration idempotent | ✓ VERIFIED | `restoreFromFolder()` two-pass walk, `isUuid` + duplicate-id guards, additive upsert only (never `remove()`); preview counts tested. MigrationRunner `migrateV4/V5` guard with `contains()`; same-version migrate is a no-op |
| 6 | Single haiku call returns two partitions (enrichment + memoryFacts) | ✓ VERIFIED | `NoteTaggerResultSchema` (NoteSchema.ts L52-73) + one generate call in `analyze()`; tracer test asserts both partitions |
| 7 | v4→v5 migration without data loss | ✓ VERIFIED | `MigrationRunner.migrateV5` creates only `backup_config` (keyPath id); existing stores untouched; full notes/storage suite green (176 tests per 05a-03 summary); migration test in NoteTagger.test.ts L378 |
| 8 | backup_config store exists so handles can persist across browser sessions | ✗ FAILED | Store exists (migration + test) but CR-01: real handles persist as content-less phantoms — cross-session persistence is broken in production (see gaps) |
| 9 | Malformed/invalid AI responses silently discarded | ✓ VERIFIED | `analyze()` catches all errors → null; SCHEMA_INVALID test passes; EventBus `emit` swallows handler errors (EventBus.ts L33) |
| 10 | End-to-end tracer path: event → AI analysis → validated result with both partitions | ✓ VERIFIED | Tracer test 'emits note:enriched with both partitions when a note is saved' + D-07 stale-version discard test |
| 11 | NoteQA.search() reranks top-10 via haiku; BM25 fallback on LLM failure | ✓ VERIFIED | `search()` FAST-tier rerank with RERANK_SCHEMA, `try/catch → results` fallback; tests green |
| 12 | Tiny model tier: raw MiniSearch + memory results, no LLM call | ✓ VERIFIED | `tier === 'TINY'` branches return raw results in both modes; test asserts generate NOT called |
| 13 | Chat-conversion provenance available on save | ✓ VERIFIED | `NoteProvenanceSchema.source` enum includes `'chat-conversion'`; save path is Phase 7 UI scope (documented D-20) |
| 14 | NoteMaintenance.getStaleNotes() — tagsGeneratedAt < updatedAt \|\| summaryGeneratedAt < updatedAt | ✓ VERIFIED | `NoteMaintenance.ts` L50-66 implements both branches + 60s grace; tests green. ⚠️ WR-03: no code writes the timestamps (grep-verified) — feature degenerates to 'everything old is stale' until Phase 7 writes them |
| 15 | NoteMaintenance.getOrphanNotes() — 0 wikilinks + 0 backlinks | ✓ VERIFIED | L69-77 via `getNotesDb().getAll()` + `getNoteGraph().getBacklinks()`; tests green |
| 16 | initNoteFileSync subscribes note:saved, debounces 50ms | ✓ VERIFIED | `initNoteFileSync()` idempotent, `scheduleSync` 50ms; debounce test green. ⚠️ WR-01: single timer drops earlier notes in a burst (see Anti-Patterns) |
| 17 | D-10: queryPermission({mode:'readwrite'}) before every sync | ✓ VERIFIED | `syncNote()` L292 + `verifyPermission()` helper; denial → `_syncEnabled=false` + `sync:error`; tests green |
| 18 | D-11: external-change detection (lastModified > lastSyncedAt + 2s) | ✓ VERIFIED | L310-314 + `EXTERNAL_CHANGE_TOLERANCE_MS=2000`; `updateLastSyncedAt()` after write; NotesDB.save() preserves lastSyncedAt (D-11 fix); tests green |
| 19 | D-12: collision resolution via numeric suffixing | ✗ FAILED | `collideFileName()` works for the first collision, but CR-02: no frontmatter-id ownership check — a second note with the same sanitized title can overwrite the first note's canonical file on re-save (see gaps) |
| 20 | D-12: rename/delete cleanup (orphan .md deleted; .md + empty parents removed) | ✗ FAILED | Helpers `handleNoteRename`/`handleNoteDelete` exist and are unit-tested, but have zero callers in src/ and no note:deleted/note:renamed event exists — cleanup never happens in the app (WR-02, see gaps) |

**Score:** 16/20 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/ai/LlmService.ts` | Shared structured-LLM facade | ✓ VERIFIED | Singleton; `generate()` joins prompts → `generateWithRepair`; used by NoteTagger/NoteQA/NoteChatConverter |
| `src/core/notes/NoteTagger.ts` | Enrichment + memoryFacts service | ✓ VERIFIED | Single FAST call, D-04/D-06/D-07 behaviors, note:enriched emission, toMemoryFactInput |
| `src/core/notes/NoteQA.ts` | RAG Q&A with citations | ✓ VERIFIED | ask/search/tiny modes, parseCitations, self-contained prompts |
| `src/core/notes/NoteChatConverter.ts` | Chat/page → NoteDraft | ✓ VERIFIED | FAST-tier single call + memory context |
| `src/core/notes/NoteMaintenance.ts` | Staleness/orphan queries | ✓ VERIFIED | getStaleNotes/getOrphanNotes/reanalyzeAll |
| `src/core/notes/NoteFileSync.ts` | One-way .md backup + restore | ⚠️ STUB-in-behavior | Substantive and wired in-session, but CR-01/CR-02/WR-02 defects break production guarantees |
| `src/core/notes/NoteSchema.ts` | 5a fields + 3 result schemas | ✓ VERIFIED | summary/lastSyncedAt/summaryGeneratedAt/tagsGeneratedAt + NoteTaggerResult/NoteQAResult/NoteDraft schemas |
| `src/core/notes/NotesDB.ts` | v5 + query methods | ✓ VERIFIED | v5 open, note:saved carries version, lastSyncedAt preserved, getByLastSyncedAt/updateLastSyncedAt |
| `src/core/storage/MigrationRunner.ts` | migrateV5 backup_config | ✓ VERIFIED | Creates store with keyPath id, contains() guard |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| EventBus `note:saved` | NoteTagger handler | `on()` subscription, fire-and-forget, error-safe | WIRED | NoteTagger.ts L152-155; EventBus emit swallows handler errors |
| LlmService | generateWithRepair → repairJSON | delegation | WIRED | LlmService.ts L32; SCHEMA_INVALID test passes |
| NoteTagger handler | NotesDB.get + version comparison | D-07 staleness | WIRED | L187-191 re-read + version compare |
| NoteQA | MiniSearchNoteIndex.search | top-5/top-10 retrieval | WIRED | NoteQA.ts L183/L220 |
| NoteQA | MemoryEngine.retrieve | memory context | WIRED | L145-152 |
| NoteQA | LlmService.generate | BALANCED ask / FAST rerank | WIRED | L203/L226 |
| NoteChatConverter | MemoryEngine.retrieve (assemble analog) | MEM-03 context | WIRED | L41-48 (documented deviation: assemble() doesn't exist) |
| NoteChatConverter | LlmService.generate | FAST tier + NoteDraftSchema | WIRED | L62-69 |
| NoteMaintenance | NotesDB.getAll + NoteGraph.getBacklinks | queries | WIRED | L51/L71-75 |
| NoteFileSync | EventBus `note:saved` | 50ms debounce | WIRED | L243-245 (service-level; init call is Phase 7 scope) |
| NoteFileSync | FileSystemDirectoryHandle via backup_config | D-09 persistence | PARTIAL | Store wired, functional fidelity broken (CR-01) |
| NoteFileSync | yaml stringify/parse | frontmatter round-trip | WIRED | L100/L111; special-char tests pass |
| NoteFileSync | NotesDB.getByLastSyncedAt/updateLastSyncedAt | D-11 | PARTIAL | updateLastSyncedAt wired (L334); getByLastSyncedAt has no callers (IN-02) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| NoteTagger note:enriched | enrichment/memoryFacts | LlmService.generate → NoteTaggerResultSchema | Yes — Zod-validated LLM output | ✓ FLOWING |
| NoteQA answer/citations | NoteQAResult | MiniSearch + MemoryEngine → BALANCED LLM | Yes — marker-derived citations rebuilt from snippets | ✓ FLOWING (WR-05 exception in markerless fallback) |
| NoteChatConverter NoteDraft | title/content/tags/... | MemoryEngine context → FAST LLM | Yes — Zod-validated | ✓ FLOWING |
| NoteFileSync .md content | note fields → YAML frontmatter | NotesDB.get(noteId) | Yes — real note data | ✓ FLOWING (in-session) |
| NoteFileSync persisted handle | backup_config record | toPlainHandle(real handle) | **No** — real handles persist as `lastModified:0/content:''/permissionState:'prompt'` phantoms | ⚠️ HOLLOW (CR-01) |
| NoteMaintenance stale/orphan | notes from getAll() | NotesDB | Yes — real notes; staleness timestamps never written (WR-03) | ✓ FLOWING (⚠️ WR-03) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All 5 phase test suites | `npx vitest run tests/core/notes/NoteTagger.test.ts NoteQA.test.ts NoteChatConverter.test.ts NoteMaintenance.test.ts NoteFileSync.test.ts --no-coverage` | 79/79 pass | ✓ PASS |
| Tracer: save → note:enriched both partitions | NoteTagger.test.ts#end-to-end tracer | 18/18 pass (suite) | ✓ PASS |
| CR-01 severity (handle members exist?) | `@types/wicg-file-system-access` FileSystemFileHandle/DirectoryHandle | No lastModified/content/permissionState members | ✓ CLAIM VERIFIED |
| CR-02 severity (ownership check exists?) | grep syncNote L310-334 | Timestamp-only decision, no frontmatter id | ✓ CLAIM VERIFIED |
| WR-02 (cleanup callers) | grep handleNoteRename/handleNoteDelete in src/ | Zero callers; no note:deleted/note:renamed events | ✓ CLAIM VERIFIED |
| WR-03 (timestamp writers) | grep tagsGeneratedAt/summaryGeneratedAt in src/ | Zero writers outside schema/maintenance | ✓ CLAIM VERIFIED |
| CR-01 test divergence | MockDirHandle/MockFileHandle own props | lastModified/content/permissionState are own members (L29-72) | ✓ CLAIM VERIFIED |

### Probe Execution

Not applicable — no probes declared in any 05a plan; phase is a feature phase with vitest suites (executed above).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| NOTE-02 | 05a-01, 05a-02 | User can enrich notes via LLM-Wiki (auto-tag/category/summary in one call), ask notes via RAG with citations, and convert chat/page to notes | ✓ SATISFIED (service layer) | NoteTagger/NoteQA/NoteChatConverter/NoteMaintenance implemented + 34 tests green. UI render surfaces deferred to Phase 7 (human items). Requirement is marked [x] in REQUIREMENTS.md |
| NOTE-03 | 05a-01, 05a-03 | User can sync notes one-way to filesystem (.md with YAML frontmatter) and restore from folder with additive upsert | ✗ PARTIAL | In-session sync + restore implemented + 35 tests green; CR-01 (cross-session persistence broken), CR-02 (cross-note overwrite), WR-02 (cleanup dead code) block full satisfaction |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/core/notes/NoteFileSync.ts | 206-216, 700-800 | CR-01: unconditional plain-data snapshot of real handle (reads non-existent members) | 🛑 Blocker | Backup silently non-functional after restart; D-09 broken; tests can't catch (mock divergence) |
| src/core/notes/NoteFileSync.ts | 310-334, 381-398 | CR-02: collision/external-change decision ignores file ownership (frontmatter id) | 🛑 Blocker | Two same-title notes → one overwrites the other's backup; restore imports wrong content |
| src/core/notes/NoteFileSync.ts | 457-475 | WR-02: handleNoteRename/Delete exported, zero callers | ⚠️ Warning | Orphan .md files never cleaned on rename/delete in the app |
| src/core/notes/NoteFileSync.ts | 273-281 | WR-01: single debounce timer drops earlier notes in a burst | ⚠️ Warning | Restore-with-active-backup backs up only the last note; rapid multi-note saves lose backups |
| src/core/notes/NoteMaintenance.ts / NoteSchema.ts | — | WR-03: tagsGeneratedAt/summaryGeneratedAt never written | ⚠️ Warning | getStaleNotes degenerates to 'everything old is stale' |
| src/core/notes/NoteFileSync.ts | 328, 381-398 | WR-04: collided file ownership never recorded → unbounded suffix accumulation | ⚠️ Warning | Repeated saves after external change create Title 1/2/3… indefinitely |
| src/core/notes/NoteQA.ts | 160-176 | WR-05: markerless fallback pushes LLM-supplied noteId/title verbatim | ⚠️ Warning | Hallucinated citation can reference a non-existent note (prohibition NOTE-02 partially violated) |
| src/core/notes/NoteFileSync.ts | 434-451 | IN-01: getFileHandleWithCollision dead code re-encoding original bug | ℹ️ Info | Should be deleted |
| src/core/notes/NotesDB.ts | 184-190 | IN-02: getByLastSyncedAt unused outside tests | ℹ️ Info | Wire or remove |

No TBD/FIXME/XXX debt markers found in phase files.

### Human Verification Required

1. **SC1 suggestion render surface (Phase 7):** In the Notes UI, save a note and confirm auto-tag/category/summary suggestions render with accept/reject. Expected: suggestions appear per save; accepting re-saves with chosen values. Why human: rendering is Phase 7 UI scope; this phase delivers the note:enriched event mechanism only.
2. **SC2 clickable citations (Phase 7):** Ask a question in the "Ask notes" bar and confirm citations are clickable and navigate to source notes. Why human: Citation[] is delivered; clickable rendering is Phase 7 UI scope.
3. **SC3 pre-filled editor (Phase 7):** Trigger "Save to note" and confirm a pre-filled editor opens (title/content/tags/wikilinks/categoryPath) with the user as gatekeeper. Why human: NoteDraft is delivered; the editor is Phase 7 UI scope.
4. **Real-browser File System Access behavior:** In Chrome Full App, set a backup folder, save notes, verify .md output, then restart the extension. Expected: backup resumes without re-selecting the folder — **currently expected to FAIL per CR-01**. Why human: FSA API + real handle structured-clone behavior cannot run in vitest/jsdom; the class-based mocks diverge from production.
5. **Staleness timestamp writer (WR-03):** Confirm the Phase 7 enrichment-acceptance flow (or a code change) writes tagsGeneratedAt/summaryGeneratedAt so getStaleNotes() works as designed. Why human: no writer exists in this phase's code; whether the acceptance flow adds one is a Phase 7 decision.

### Gaps Summary

The phase delivers all five services with substantial, tested implementations — 79 tests green across 5 suites, LlmService→NoteTagger→NoteQA→NoteChatConverter→NoteMaintenance→NoteFileSync all substantively implemented and service-level wired. NOTE-02 (enrichment/RAG/conversion) is satisfied at the service layer.

However, the NOTE-03 filesystem-sync deliverable has two code-review-verified **critical defects** (confirmed independently against the codebase and the platform type definitions) that prevent the phase goal from being fully achieved:

1. **CR-01 — handle persistence destroys real handle fidelity.** `persistHandle()` snapshots real `FileSystemDirectoryHandle` objects into plain data that reads members the platform objects do not have; after any extension restart the rehydrated handle is a phantom that cannot write to disk and fails permission checks. The D-09 cross-session persistence guarantee (05a-01 must-have T3) is broken, and the class-based test mocks carry the very own-properties that mask the defect.
2. **CR-02 — cross-note overwrite.** The collision guard decides overwrite-vs-suffix from timestamps only, never checking the existing file's frontmatter id. Two notes with the same sanitized title can silently clobber each other's canonical backup file — breaking the D-12 collision guarantee (05a-03 must-have T5) and SC4.
3. **WR-02 — D-12 cleanup is dead code.** `handleNoteRename`/`handleNoteDelete` have zero callers and no note:deleted/note:renamed event exists; orphan .md files are never cleaned in the running app (05a-03 must-have T6 fails).

These three gaps share one root cause: the NoteFileSync write/cleanup paths were built and unit-tested in isolation but never verified against the real platform object shapes or wired into the application lifecycle. The review's proposed fixes (persist native handles / branch on native vs test-double; frontmatter-id ownership check; event-driven cleanup wiring) are concrete and localized to `NoteFileSync.ts`/`NotesDB.ts`.

Additional warning-level findings (WR-01 debounce drops, WR-03 staleness timestamps unwritten, WR-04 unbounded suffix accumulation, WR-05 fallback citation trust) should be addressed in the follow-up plan together with the criticals. Human verification is required for the Phase 7 UI surfaces (SC1/SC2/SC3 rendering) and real-browser FSA behavior.

---

_Verified: 2026-08-02T05:01:36Z_
_Verifier: the agent (gsd-verifier)_
