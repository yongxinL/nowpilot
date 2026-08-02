---
phase: 05a
slug: llm-wiki-filesystem-sync
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-02
updated: 2026-08-02
---

# Phase 05a — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Revision note (2026-08-02):** Regenerated for the gap-closure plan set
> (05a-01/02/03) — replaces the per-task map of the superseded original plan set
> (05a-00 Wave 0, 05a-04, 05a-05). All 8 gap-closure tasks carry `<automated>`
> verifies; no Wave 0 is required because every referenced test suite pre-exists.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/core/notes/ --no-coverage` |
| **Full suite command** | `npx vitest run` |
| **Phase regression gate** | `npm run verify:phase-5a` (`tsc --noEmit && vitest run tests/core/notes tests/core/storage/migrations`) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's `Automated Command` from the per-task map below
- **After every plan wave:** Run `npx vitest run tests/core/notes/ --no-coverage`
- **Before `/gsd-verify-work`:** `npm run verify:phase-5a` must exit 0
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05a-01-01 | 01 | 1 | NOTE-03 | T-05a-02 | Native handle persisted via structured clone; snapshot branch only for test doubles; restart-resume reaches the real filesystem (CR-01) | unit (tracer) | `npx vitest run tests/core/notes/NoteFileSync.test.ts --no-coverage && npx tsc --noEmit` | ✅ | ⬜ pending |
| 05a-01-02 | 01 | 1 | NOTE-03 | T-05a-01, T-05a-03, T-05a-04 | Ownership-aware collision: never overwrite a file owned by another note; owned-file reuse; external-change suffixed fallback (CR-02, WR-04) | unit (tdd) | `npx vitest run tests/core/notes/NoteFileSync.test.ts tests/core/notes/NotesDB.test.ts --no-coverage && npx tsc --noEmit` | ✅ | ⬜ pending |
| 05a-01-03 | 01 | 1 | NOTE-03 | T-05a-05 | Per-note debounce map: burst saves of different notes all sync; same-note saves still coalesce (WR-01) | unit | `npx vitest run tests/core/notes/NoteFileSync.test.ts --no-coverage` | ✅ | ⬜ pending |
| 05a-02-01 | 02 | 2 | NOTE-03 | T-05a-06, T-05a-07 | Event-driven cleanup: note:deleted/note:renamed emitted + subscribed; save→delete→cleanup chain through EventBus (WR-02) | integration (tdd) | `npx vitest run tests/core/notes/NoteFileSync.test.ts tests/core/notes/NotesDB.test.ts --no-coverage && npx tsc --noEmit` | ✅ | ⬜ pending |
| 05a-02-02 | 02 | 2 | NOTE-02 | T-05a-09 | Staleness diff-writer in NotesDB.save(); getStaleNotes() distinguishes enriched-then-edited from never-enriched (WR-03) | unit (tdd) | `npx vitest run tests/core/notes/NotesDB.test.ts tests/core/notes/NoteMaintenance.test.ts --no-coverage && npx tsc --noEmit` | ✅ | ⬜ pending |
| 05a-02-03 | 02 | 2 | NOTE-02 | T-05a-08 | Markerless fallback citations rebuilt from snippets[] — fabricated LLM noteId/title never cited (WR-05) | unit (tdd) | `npx vitest run tests/core/notes/NoteQA.test.ts --no-coverage && npx tsc --noEmit` | ✅ | ⬜ pending |
| 05a-03-01 | 03 | 3 | NOTE-02, NOTE-03 | T-05a-10 | Full regression gate: tsc + all notes/storage/migration suites green; 79 baseline + gap-closure tests pass | regression | `npm run verify:phase-5a` | ✅ | ⬜ pending |
| 05a-03-02 | 03 | 3 | NOTE-02, NOTE-03 | T-05a-11 | Phase 7 deferral rows recorded in deferred-items.md — nothing silently dropped (≥6 rows referencing Phase 7) | doc gate | `[ "$(grep -c 'Phase 7' .planning/phases/05a-llm-wiki-filesystem-sync/deferred-items.md)" -ge 6 ]` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — this is the gap-closure plan set (05a-01/02/03), which extends
pre-existing suites only. All referenced test files already exist and are
tracked in the `File Exists` column above:

- `tests/core/notes/NoteTagger.test.ts` (18 baseline tests)
- `tests/core/notes/NoteQA.test.ts` (11 baseline tests)
- `tests/core/notes/NoteChatConverter.test.ts` (5 baseline tests)
- `tests/core/notes/NoteMaintenance.test.ts`
- `tests/core/notes/NoteFileSync.test.ts` (35 baseline tests)
- `tests/core/notes/NotesDB.test.ts`

No `MISSING` references to scaffold.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File System Access API showDirectoryPicker flow | NOTE-03 | Requires user gesture + browser interaction | Open Full App, click "Set backup folder", select directory, verify .md written on save. **Deferred to Phase 7** (real-browser verification recorded in deferred-items.md) |
| Native-handle restart-resume (structured clone into IndexedDB, CR-01) | NOTE-03 | vitest/jsdom cannot exercise real platform handles | Chrome Full App: set backup folder, restart extension, verify sync resumes without re-selection. **Deferred to Phase 7** — service-layer proxy covered by 05a-01 task 1 duck-typed native-branch tests |
| Backup folder permission revoked recovery | NOTE-03 | Requires manual browser permission revocation | Revoke permission in Chrome settings, verify "Backup: Error" tag, re-select folder. **Deferred to Phase 7** |
| Note enrichment accept/reject UI rendering (SC1) | NOTE-02 | Requires visual inspection | Save note, verify suggestions render with accept/reject, verify accepted updates trigger re-sync. **Deferred to Phase 7** |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (8/8 gap-closure tasks) — no Wave 0 dependencies needed
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No MISSING references — Wave 0 not required (all suites pre-exist)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
