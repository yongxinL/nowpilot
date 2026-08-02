---
phase: 05a-llm-wiki-filesystem-sync
verified: 2026-08-02T17:25:00Z
status: passed
score: 20/20 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 16/20
  gaps_closed:

    - "CR-01: native FileSystemDirectoryHandle persists through IndexedDB and resumes syncing after a simulated restart; writes reach the filesystem (backup_config store truth)"
    - "CR-02: NoteFileSync resolves title collisions via numeric suffixing with frontmatter-ownership guard — cross-note overwrite impossible (D-12 collision truth)"
    - "WR-02: note:deleted/note:renamed events wired from NotesDB to NoteFileSync — rename/delete cleanup happens in the app (D-12 cleanup truth)"
    - "SC4 partial → holds at the service layer: durable one-way .md backup that cannot corrupt another note's file"
  gaps_remaining: []
  regressions: []
human_verification:

  - test: "Real-browser File System Access behavior: in Chrome (Full App), set a backup folder, save notes, verify .md files appear with YAML frontmatter; then restart the extension and verify backup resumes automatically (D-09 restart-resume, CR-01 fix validation)"
    expected: "Per-save .md files written with correct frontmatter; after restart, backup resumes without re-selecting the folder — the CR-01 native-branch fix (persist native handle via structured clone) works on real platform handles"
    why_human: "File System Access API and real FileSystemDirectoryHandle structured-clone behavior cannot be exercised in vitest/jsdom; the duck-typed native-branch tests (05a-01 task 1) are the service-layer proxy — deferred to Phase 7, recorded in deferred-items.md entry 5"

  - test: "SC1 render surface (Phase 7): in the Notes UI, save a note and confirm auto-tag/category/summary suggestions render inline with accept/reject controls (note:enriched event → component state)"
    expected: "Suggestions appear for accept/reject after each save; accepting re-saves the note with the chosen tags/category/summary"
    why_human: "The service emits note:enriched in-memory (D-05); rendering is Phase 7 UI scope — deferred-items.md entry 2"

  - test: "SC2 clickable citations (Phase 7): in the 'Ask notes' bar, ask a question and confirm each [N] citation is clickable and navigates to the source note"
    expected: "Answer renders with per-statement citation links that open the referenced note (WR-05 guarantees citations reference real snippets)"
    why_human: "NoteQA returns Citation[] with noteId/title/relevantSnippet; clickable rendering is Phase 7 UI scope — deferred-items.md entry 3"

  - test: "SC3 pre-filled editor (Phase 7): trigger 'Save to note' on a chat exchange and confirm a pre-filled editor opens (draft title/content/tags/wikilinks/categoryPath) where the user must explicitly save"
    expected: "Editor opens pre-filled with the NoteDraft; nothing is saved until the user confirms"
    why_human: "NoteChatConverter returns the draft; the editor UI and user-gatekeeper flow is Phase 7 scope — deferred-items.md entry 4"
---

# Phase 05a: LLM-Wiki & Filesystem Sync Verification Report (Re-verification)

**Phase Goal:** User enriches notes via a single haiku call (tags + category + summary + memory facts), asks questions via RAG with citations, converts chat/page content to notes, and syncs to filesystem with one-way .md backup
**Verified:** 2026-08-02T17:25:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (05a-01/02/03 + code-review fixes c11f541, 8ae98c7, 1769efe, d26432e, 5475b53)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: Save triggers NoteTagger.analyze() non-blocking (single haiku call); enrichment suggestions emitted; save never blocks on LLM | ✓ VERIFIED | Unchanged from prior; 18-test suite green in regression gate |
| 2 | SC2: NoteQA.ask() retrieves top-5 + memory facts, synthesizes flash-tier answer with citations | ✓ VERIFIED | Unchanged; 14-test suite green (incl. +3 WR-05) |
| 3 | SC3: NoteChatConverter produces pre-filled draft via haiku + memory context | ✓ VERIFIED | Unchanged; 5-test suite green |
| 4 | SC4: setBackupFolder via showDirectoryPicker — per-save .md with YAML frontmatter, nested categoryPath folders, collision suffixing, external-change detection | ✓ VERIFIED | CR-01 + CR-02 closed: native handles persist natively (isNativeHandle branch, L213/L866), ownership-aware target selection (L436-467), collision scan skips foreign-owned (L519-539). 54-test NoteFileSync suite green; verify:phase-5a exit 0 |
| 5 | SC5: restoreFromFolder additive upsert with preview; never deletes local notes; migration idempotent | ✓ VERIFIED | Unchanged; restore tests green |
| 6 | Single haiku call returns two partitions (enrichment + memoryFacts) | ✓ VERIFIED | Unchanged (NoteTagger suite green) |
| 7 | v4→v5 migration without data loss | ✓ VERIFIED | Unchanged (storage/migrations suite green) |
| 8 | backup_config store exists so handles can persist across browser sessions | ✓ VERIFIED | **CR-01 CLOSED**: `persistHandle` stores native handle directly (structured clone), snapshot only for test doubles (L210-221); `loadPersistedHandle` returns live handles as-is, rehydrates only snapshot shape (L231-247); `restoreSession` re-enables sync on granted permission (L324-330). Test 'native-shaped handle persists natively and sync resumes after a simulated restart (CR-01)' (L642) asserts stored record has NO `children` snapshot array and writes reach the filesystem-backed mock |
| 9 | Malformed/invalid AI responses silently discarded | ✓ VERIFIED | Unchanged |
| 10 | End-to-end tracer path: event → AI analysis → validated result | ✓ VERIFIED | Unchanged |
| 11 | NoteQA.search() reranks top-10 via haiku; BM25 fallback | ✓ VERIFIED | Unchanged |
| 12 | Tiny model tier: raw MiniSearch + memory, no LLM call | ✓ VERIFIED | Unchanged |
| 13 | Chat-conversion provenance available on save | ✓ VERIFIED | Unchanged |
| 14 | NoteMaintenance.getStaleNotes() — tagsGeneratedAt < updatedAt \|\| summaryGeneratedAt < updatedAt | ✓ VERIFIED | **WR-03 CLOSED**: `NotesDB.save()` diff-writer stamps timestamps only on APPLIED tags/summary changes (L139-150); create leaves unset. Integration test 'via the save() diff-writer: enriched-then-edited is stale, untouched is not, never-enriched follows the grace rule' (NoteMaintenance.test.ts L123) green |
| 15 | NoteMaintenance.getOrphanNotes() — 0 wikilinks + 0 backlinks | ✓ VERIFIED | Unchanged |
| 16 | initNoteFileSync subscribes note:saved, debounces per note | ✓ VERIFIED | **WR-01 CLOSED**: `_debounceTimers` Map (L148), per-note scheduleSync (L343-355), reset clears all (L828-832). Burst test 'per-note debounce: a burst of DIFFERENT notes all reach the filesystem' (L581) green |
| 17 | D-10: queryPermission({mode:'readwrite'}) before every sync | ✓ VERIFIED | Unchanged + restoreSession re-enable (L316-330) |
| 18 | D-11: external-change detection (lastModified > lastSyncedAt + 2s) | ✓ VERIFIED | Unchanged; WR-04 fresh-suffix test (L382) green |
| 19 | D-12: collision resolution via numeric suffixing, ownership-aware | ✓ VERIFIED | **CR-02 CLOSED**: `selectTargetFile` reads existing file's frontmatter id (L449-452) — foreign-owned file never overwritten; `collideFileName` skips foreign-owned + externally-modified (L529-536). Tests L345 (cross-note never overwrite, re-save reuse), L382 (externally-modified owned file → fresh suffix), L432 (third-note occupancy → React 2.md), L413 (D-18 same-note overwrite preserved) all green |
| 20 | D-12: rename/delete cleanup (orphan .md deleted; .md + empty parents removed) | ✓ VERIFIED | **WR-02 CLOSED**: `NotesDB.remove()` emits `note:deleted` {noteId,title,categoryPath,lastSyncedFileName} (L331-336); `NotesDB.save()` emits `note:renamed` on title/categoryPath diff (L214-228); `initNoteFileSync` subscribes both + cancels pending debounce (L265-295). Full save→delete→cleanup and save→rename chains driven through EventBus + real NotesDB calls (L1147-1202) green |

**Score:** 20/20 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/ai/LlmService.ts` | Shared structured-LLM facade | ✓ VERIFIED | Unchanged, untouched by gap closure |
| `src/core/notes/NoteTagger.ts` | Enrichment + memoryFacts service | ✓ VERIFIED | Unchanged |
| `src/core/notes/NoteQA.ts` | RAG Q&A with citations | ✓ VERIFIED | WR-05 fallback rebuild from snippets (L178-184) |
| `src/core/notes/NoteChatConverter.ts` | Chat/page → NoteDraft | ✓ VERIFIED | Unchanged |
| `src/core/notes/NoteMaintenance.ts` | Staleness/orphan queries | ✓ VERIFIED | getStaleNotes logic unchanged; writer now in NotesDB.save() |
| `src/core/notes/NoteFileSync.ts` | One-way .md backup + restore | ✓ VERIFIED | CR-01/CR-02/WR-01/WR-02/WR-04 fixes + ownership-aware cleanup (L617-681) all present and tested |
| `src/core/notes/NoteSchema.ts` | 5a fields + 3 result schemas | ✓ VERIFIED | + lastSyncedFileName (L39) |
| `src/core/notes/NotesDB.ts` | v5 + query methods + events | ✓ VERIFIED | note:deleted/note:renamed events, diff-writer, single-transaction updateSyncState |
| `src/core/storage/MigrationRunner.ts` | migrateV5 backup_config | ✓ VERIFIED | Unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| persistHandle | backup_config store | structured clone (native) / toPlainHandle (double) | WIRED | L213 branch via isNativeHandle; round-trip test asserts no `children` snapshot for native |
| syncNote | existing-file frontmatter id | readOwnerId → selectTargetFile | WIRED | L449-452: foreign-owned → never overwrite |
| syncNote | collideFileName (owner-skip scan) | D-12 collision | WIRED | L519-539 skips foreign-owned + externally-modified |
| syncNote | NotesDB.updateSyncState | lastSyncedAt + lastSyncedFileName atomically | WIRED | L408; single readwrite transaction (NotesDB L292-304) — no clobber of concurrent save |
| NotesDB.save() | lastSyncedFileName preservation | mirrors lastSyncedAt (L122-127) | WIRED | NotesDB.test.ts L168 green |
| NotesDB.remove() | emit('note:deleted') → handleNoteDelete | EventBus, event-driven | WIRED | L331-336 → L265-274; integration chain green |
| NotesDB.save() | emit('note:renamed') → handleNoteRename | title/categoryPath diff | WIRED | L214-228 → L275-290 (cancel → cleanup → re-schedule); rename chain green |
| NotesDB.save() | staleness diff-writer → getStaleNotes() | tagsGeneratedAt/summaryGeneratedAt | WIRED | L139-150; integration test green |
| NoteQA.buildCitations | snippets[referenceNumber-1] rebuild | markerless fallback | WIRED | L178-184; WR-05 tests green |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| NoteFileSync persisted handle | backup_config record | native handle / snapshot | **Yes** — native handles stored directly (structured clone); snapshot only for doubles | ✓ FLOWING (CR-01 fixed) |
| NoteFileSync .md content | note fields → YAML frontmatter | NotesDB.get(noteId) | Yes — real note data | ✓ FLOWING |
| NoteFileSync cleanup path | lastSyncedFileName | event payload from NotesDB | Yes — exact owned file (possibly suffixed) | ✓ FLOWING (CR-01 cleanup fix) |
| NoteMaintenance stale/orphan | timestamps | NotesDB.save() diff-writer | Yes — real enrichment-change stamps | ✓ FLOWING (WR-03 fixed) |
| NoteQA citations | snippets[] | MiniSearch index | Yes — snippet-authoritative rebuild | ✓ FLOWING (WR-05 fixed) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full phase regression gate | `npm run verify:phase-5a` (tsc --noEmit && vitest run tests/core/notes tests/core/storage/migrations) | EXIT 0 — 150/150 tests, 9 files | ✓ PASS |
| CR-01 native round-trip | NoteFileSync.test.ts L642 | persists natively (no children), restart resumes, write lands on mock FS | ✓ PASS |
| CR-02 cross-note overwrite | NoteFileSync.test.ts L345, L432 | B re-save never touches A's canonical; third-note skipped | ✓ PASS |
| WR-02 full chains | NoteFileSync.test.ts L1147-1202 | .md + empty parents removed via EventBus; rename writes new .md | ✓ PASS |
| CR-01 collided cleanup | NoteFileSync.test.ts L1225, L1263 | delete/rename of collided note removes ITS OWN suffixed file, other's canonical survives | ✓ PASS |
| TOCTOU in-flight sync | NoteFileSync.test.ts L1011 | just-written .md removed when note deleted mid-write | ✓ PASS |
| Rename race ordering | NoteFileSync.test.ts L1296 | no new file until old removed; new .md after | ✓ PASS |
| NotFoundError no-op | NoteFileSync.test.ts L1355, L1382 | no spurious sync:error; mock matches platform | ✓ PASS |
| updateSyncState atomicity | NotesDB.test.ts L191, L219 | 1 transaction; concurrent save() wins | ✓ PASS |

Note: the 6 pre-existing failures in `tests/core/ai/` (StreamAdapter ×2, ProviderAdapter ×4) are unrelated to 05a (documented in deferred-items.md entry 1, reproduced at pre-05a baseline) and excluded from the 05a gate, which scopes `tests/core/notes` + `tests/core/storage/migrations`.

### Probe Execution

Not applicable — no probes declared in any 05a plan; regression gate (above) is the phase's runnable check.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| NOTE-02 | 05a-01, 05a-02, 05a-03 | User can enrich notes via LLM-Wiki, ask notes via RAG with citations, convert chat/page to notes | ✓ SATISFIED | Service layer complete (NoteTagger/NoteQA/NoteChatConverter/NoteMaintenance) + WR-03/WR-05 closed; UI render surfaces deferred to Phase 7 (deferred-items.md entries 2-4, 8). Marked [x] Complete in REQUIREMENTS.md |
| NOTE-03 | 05a-01, 05a-02, 05a-03 | User can sync notes one-way to filesystem (.md with YAML frontmatter) and restore from folder with additive upsert | ✓ SATISFIED | CR-01/CR-02/WR-02/WR-04 closed at service layer; 54-test NoteFileSync suite + integration chains green; real-browser FSA verification deferred to Phase 7 (deferred-items.md entry 5). Marked [x] Complete in REQUIREMENTS.md |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/core/notes/NotesDB.ts | 274-280 | IN-02 carry-over: getByLastSyncedAt has no production caller | ⚠️ Warning | Pre-existing info item; not introduced by gap closure; wire or remove in a future phase |

No TBD/FIXME/XXX debt markers found in phase-modified files. `getFileHandleWithCollision` (IN-01) and the dead `current` var — grep returns zero matches (deleted per 05a-01).

### Prohibitions Verification

| Prohibition | Enforcement Evidence | Status |
| ----------- | -------------------- | ------ |
| MUST NOT persist plain-data snapshot of a native handle (CR-01) | isNativeHandle branch L213; test asserts no `children` on stored record | ✓ ENFORCED |
| MUST NOT overwrite an existing .md with a different note's frontmatter id (CR-02) | selectTargetFile L449-452 + collideFileName L529-536; cross-note tests | ✓ ENFORCED |
| MUST NOT decide overwrite-vs-collide from timestamps alone when owner differs | Ownership check precedes timestamp check in both paths | ✓ ENFORCED |
| MUST NOT leave orphaned .md on rename/delete (WR-02) | Events wired + integration chains green | ✓ ENFORCED |
| MUST NOT write staleness timestamps for merely-suggested enrichment (WR-03) | Diff-writer only stamps on persisted change; create leaves unset | ✓ ENFORCED |
| MUST NOT push LLM-supplied noteId/title into Citation[] (WR-05) | buildCitations rebuilds from snippets[referenceNumber-1] | ✓ ENFORCED |
| MUST NOT drop Phase 7 deferrals silently | deferred-items.md entries 2-8 (7 rows, `grep -c 'Phase 7'` = 7 ≥ 6) | ✓ ENFORCED |

### Human Verification Required

1. **Real-browser File System Access behavior (CR-01 validation):** In Chrome (Full App), set a backup folder, save notes, verify .md output, restart the extension, confirm backup resumes without re-selection. Expected: backup resumes (D-09). Why human: FSA + real platform handle structured-clone cannot run in vitest/jsdom; duck-typed native-branch tests are the service-layer proxy. Deferred to Phase 7 (deferred-items.md entry 5).
2. **SC1 suggestion render surface (Phase 7):** In the Notes UI, save a note and confirm auto-tag/category/summary suggestions render with accept/reject. Expected: suggestions per save; accepting re-saves with chosen values. Why human: rendering is Phase 7 UI scope (entry 2).
3. **SC2 clickable citations (Phase 7):** Ask a question and confirm [N] citations are clickable and navigate to source notes. Expected: citations reference real notes (WR-05 guarantees). Why human: clickable rendering is Phase 7 UI scope (entry 3).
4. **SC3 pre-filled editor (Phase 7):** Trigger "Save to note" and confirm a pre-filled editor opens with the user as gatekeeper. Why human: editor UI is Phase 7 scope (entry 4).

### Gaps Summary

All four prior gaps are **closed** — verified against the actual codebase, not just SUMMARY claims:

1. **CR-01 (handle persistence)** — `persistHandle` now branches on `isNativeHandle` (duck-typed via `isSameEntry` + `Symbol.asyncIterator`): native handles stored directly via structured clone, plain-data snapshot only for test doubles; `loadPersistedHandle` returns live handles as-is. The CR-01 round-trip test (L642) verifies the stored record is NOT a snapshot and that a simulated restart resumes sync with writes reaching the filesystem. `restoreSession` additionally re-enables sync on a granted permission check (Rule 1 fix in 82004b2).
2. **CR-02 (cross-note overwrite)** — `selectTargetFile`/`collideFileName` are ownership-first: a file whose frontmatter id belongs to a different note is never overwritten, regardless of timestamps. Tests reproduce the exact prior failure scenario (B re-save no longer clobbers A's React.md) plus third-note occupancy and D-18 same-note overwrite.
3. **WR-02 (cleanup dead code)** — `note:deleted`/`note:renamed` events now flow from NotesDB (single write path) to NoteFileSync subscriptions, with pending-debounce cancellation and ownership-guarded removal. Full save→delete→cleanup and save→rename chains are integration-tested through the EventBus.
4. **SC4 partial → holds at the service layer** — with CR-01 + CR-02 closed, the one-way .md backup is durable across simulated sessions and cannot corrupt another note's file.

The post-gap-closure code review found 1 critical + 4 warnings, all fixed and verified: **c11f541** (ownership-aware cleanup of collided note files — event payloads carry `lastSyncedFileName`, `resolveCleanupFilePath` + `expectedOwnerId` guard, tests L1225/L1263), **8ae98c7** (in-flight sync TOCTOU — post-write existence re-check), **1769efe** (rename cleanup strictly precedes re-sync), **d26432e** (NotFoundError no-op + platform-faithful mock), **5475b53** (single-transaction updateSyncState).

Regression gate: `npm run verify:phase-5a` exits 0 — tsc clean + 150/150 tests across 9 files (was 79 baseline; +20 gap-closure tests in 05a-01/02, +8 code-review-fix tests). Working tree clean; 22 commits in 82004b2..HEAD.

Remaining: real-browser FSA behavior and the Phase 7 UI surfaces (SC1/SC2/SC3) require human verification — all recorded in deferred-items.md (entries 2-8) with Phase 7 owner surfaces. The WR-03 staleness-writer human item from the prior verification is resolved (writer implemented at the service layer).

---

## Acknowledged Gaps

Acknowledged 2026-08-02 via UAT session (verify-work): 4 human-verification items tested — 1 passed, 3 blocked as Phase 7 deferrals (prerequisite gates, not code defects; no gap plans spawned).

| UAT Test | Outcome | Tracking |
|----------|---------|----------|
| Real-browser FSA restart-resume (CR-01) | PASS — native handle persisted through IndexedDB + extension restart, permission `granted`, post-restart saves written without re-selection | UAT 05a-01 |
| SC1 enrichment suggestion render surface | BLOCKED (prior-phase) — Phase 7 Notes UI not built | deferred-items.md entry 2 |
| SC2 clickable citations | BLOCKED (prior-phase) — Phase 7 answer Bubble not built | deferred-items.md entry 3 |
| SC3 pre-filled editor | BLOCKED (prior-phase) — Phase 7 SaveToNoteDialog not built | deferred-items.md entry 4 |

These deferrals remain open for Phase 7 and are NOT resolved gaps of this phase.

---

_Verified: 2026-08-02T17:25:00Z_
_Verifier: the agent (gsd-verifier)_
