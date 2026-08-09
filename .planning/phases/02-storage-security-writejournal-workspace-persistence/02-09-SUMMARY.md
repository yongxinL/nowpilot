---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 09
subsystem: storage
tags: [import-export, fflate, backup-restore, storage-05, d-17, d-18, d-19, redaction]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: 02-02 redactSensitive field-level redaction + real TraceRedactor (D-16); 02-04 runJournaled/persistJournalEntry WriteJournal framework (O.11); 02-05 Setting.ts permission table + np_schema_version/CURRENT_SCHEMA_VERSION; 02-07 ChatHistoryDB/NotesDB/MemoryDB idb stores; 02-01 WriteJournalEntry/WriteJournalOperation types + fixture builders
provides:
  - src/core/storage/ImportExport.ts (+1 to the §18 create-list, documented Rule-3 deviation per RESEARCH Q1/A4): EXPORT_GROUPS/ExportGroup (export-data `{ scopes: string[] }` vocabulary), EXCLUDED_KEYS (np_providers ciphertext, np_install_secret, D-11 session tokens), ExportManifest/buildManifest, collectGroup (5 groups), sanitizeGroup (redactSensitive + assertNoSecrets), exportJson (canonical) + exportZip (fflate level 6), parseImportPayload (JSON or ZIP, shape-validated), mergeGroup (per-group MERGE/upsert, existing-wins + overwrite toggle), restoreFullVault (journaled 'restore-notes-batch' full-vault restore)
  - tests/core/storage/ImportExport.test.ts: 7 tests — JSON round-trip, ZIP round-trip, no-secrets export (D-01), merge semantics (D-18), journaled restore happy path + failed-group-step crash + recoverJournal replay (02-04 harness)
  - STORAGE-05 satisfied at the core level: sanitized JSON/ZIP import/export + backup/restore work via the verified core; UI deferred to Phase 7 (D-19)
affects: [02-11 verification wiring, Phase 7 ImportExportPanel UI consumer (§18/§9.3), Phase 5a additive restore-from-folder philosophy, verify-work STORAGE-05 UAT]

# Tech tracking
tech-stack:
  added: [] # no new deps — fflate 0.8.3 + idb 8.0.3 + fake-indexeddb already installed (02-01)
  patterns:
    - "Sanitize-before-serialize export boundary: every group runs redactSensitive THEN assertNoSecrets (O.13 patterns must not match any surviving string) before JSON.stringify/strToU8 — D-17/T-2-09-01"
    - "EXCLUDED_KEYS wholesale exclusion: np_providers ciphertext + np_install_secret + session tokens are dropped by key before collection, and the settings MERGE path refuses the same set at the import boundary — one const enforces D-01/D-11 in both directions"
    - "Per-group MERGE/upsert by id with existing-wins default + 'restore overwrites' toggle — never wipe-and-replace (D-18); settings merges additionally refuse unknown/declared-only/encrypted-only keys via the Setting.ts permission table (T-2-09-02)"
    - "Journaled batch restore: restoreFullVault runs runJournaled with one idempotent merge step per group under the locked 'restore-notes-batch' op (A-20); additive no-op rollbacks — consistency comes from replay/idempotency, not rollback (D-18/T-2-09-03)"

key-files:
  created:
    - src/core/storage/ImportExport.ts
    - tests/core/storage/ImportExport.test.ts
  modified: []

key-decisions:
  - "ImportExport.ts as a documented +1 to the §18 create-list (RESEARCH Q1/A4 resolution): the create-list omits the import/export core and D-09's folding rule forbids only StorageLayer/StorageSession names — standalone file with a header Rule-3 deviation note, never folded into Setting.ts"
  - "'restore-notes-batch' wired as the live journaled-restore consumer (A-20): user-confirmed 2026-08-09 that D-18's 'full-vault ZIP restore runs journaled' supersedes the declared-but-unwired wording for this op — a consumer wiring, not a vocabulary edit (Golden Rule 2)"
  - "settings group carries only the A-19 non-secret keys (np_theme/np_theme_pack/np_language/np_addon_settings/np_flags/np_schema_version/np_persona) with area routing derived from STORAGE_KEY_REGISTRY — no invented key list or routing"
  - "assertNoSecrets reuses the canonical O.13 redaction patterns via TraceRedactor.redact(s) !== s — a surviving secret after sanitization is a hard throw, never a silent export"
  - "Workspace/settings merges write via chrome.storage directly but validate every incoming key against the Setting.ts permission table (unknown/declared-only/encrypted-only refused) — hostile payloads cannot inject into protected keys"
  - "Rollback is a no-op for merge steps: additive upserts cannot be safely un-inserted; a mid-restore crash leaves completed groups persisted + an 'applying'/'rolled-back' entry, and recovery re-runs the idempotent merges with the retained payload (replay-safe)"

requirements-completed: [STORAGE-05]

coverage:
  - id: D1
    description: "JSON canonical export — manifest { exportedAt, appVersion, schemaVersion } + sanitized scoped groups (chat-history/notes/memory/workspace/settings) serialized to inspectable JSON (D-17); round-trips through parseImportPayload into fresh stores with equal ids"
    requirement: STORAGE-05
    verification:
      - kind: unit
        ref: "tests/core/storage/ImportExport.test.ts#exports chat-history + notes + memory groups to JSON and merges them back with equal ids"
        status: pass
    human_judgment: false
  - id: D2
    description: "ZIP export via fflate (zipSync/strToU8 level 6) with manifest.json + groups/<group>.json entries; parseImportPayload unzips (unzipSync/strFromU8) and round-trips equal ids (RESEARCH Pattern 7)"
    requirement: STORAGE-05
    verification:
      - kind: unit
        ref: "tests/core/storage/ImportExport.test.ts#exportZip produces a payload parseImportPayload can restore with equal ids"
        status: pass
    human_judgment: false
  - id: D3
    description: "No-secrets export (D-01/T-2-09-01) — np_providers ciphertext envelope, np_install_secret, and every secret-shaped value (sk-…, Bearer …, redaction-fixture password) absent from the serialized payload; secret-bearing content sanitized to [REDACTED]; manifest present"
    requirement: STORAGE-05
    verification:
      - kind: unit
        ref: "tests/core/storage/ImportExport.test.ts#excludes np_providers ciphertext, np_install_secret, and every secret-shaped value from the payload"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-group MERGE/upsert by id (D-18/T-2-09-02) — existing records win by default, overwrite:true lets incoming win, new ids insert, unrelated records never wiped; hostile settings keys refused at the merge boundary"
    requirement: STORAGE-05
    verification:
      - kind: unit
        ref: "tests/core/storage/ImportExport.test.ts#existing records win by default; overwrite:true lets incoming win; new ids insert without wiping others"
        status: pass
    human_judgment: false
  - id: D5
    description: "Journaled full-vault restore (D-18/A-20/T-2-09-03) — 'restore-notes-batch' entry with one idempotent merge step per group; a failed group step leaves a recoverable entry with completed groups persisted (additive); recoverJournal replays an 'applying' restore entry to convergence (02-04 harness, replay-once)"
    requirement: STORAGE-05
    verification:
      - kind: unit
        ref: "tests/core/storage/ImportExport.test.ts#restores every group through a restore-notes-batch journal entry that completes"
        status: pass
      - kind: unit
        ref: "tests/core/storage/ImportExport.test.ts#a failed group step leaves the restore entry in the journal with completed groups persisted (additive)"
        status: pass
      - kind: unit
        ref: "tests/core/storage/ImportExport.test.ts#recoverJournal replays an applying restore entry to convergence (02-04 recovery harness)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 9: Scoped-Group Import/Export Core Summary

**STORAGE-05 core shipped as a documented +1 file: sanitized JSON-canonical + fflate-ZIP exports of the five export-data scopes (chat-history/notes/memory/workspace/settings), each redactSensitive-sanitized with an assertNoSecrets guard and an EXCLUDED_KEYS wall that guarantees np_providers ciphertext, np_install_secret, and session tokens never leave the machine (D-01), a manifest on every bundle (D-17), per-group MERGE/upsert restore with existing-wins + 'restore overwrites' toggle that can never wipe data (D-18), and a journaled full-vault restore under the user-confirmed 'restore-notes-batch' op with a proven crash/replay path — all core-only with the Import/ExportPanel UI deferred to Phase 7 (D-19)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-09T06:54:44Z
- **Completed:** 2026-08-09T07:06:00Z
- **Tasks:** 2 (both TDD: RED + GREEN = 2 commits)
- **Files modified:** 2 created

## Accomplishments

- **`src/core/storage/ImportExport.ts` (624 lines, +1 to the §18 create-list):** the header documents the Rule-3 deviation per RESEARCH Q1/A4 (the §18 list omits the import/export core; D-09's folding rule forbids only StorageLayer/StorageSession names — standalone file, never folded into Setting.ts).
- **Export (D-17):** `EXPORT_GROUPS`/`ExportGroup` mirror the export-data tool's `{ scopes: string[] }` vocabulary verbatim. `collectGroup` reads chat-history/notes/memory from the 02-07 idb stores (sessions+messages, notes+concepts, memory messages+facts+summaries), workspace from np_workspace, and settings from the A-19 non-secret keys with area routing derived from the Setting.ts permission table. `EXCLUDED_KEYS` (np_providers, np_install_secret, five D-11 session tokens) are dropped by key before collection. `sanitizeGroup` runs redactSensitive then `assertNoSecrets` (a surviving O.13-pattern string throws — a secret can never serialize silently). `exportJson` produces the canonical `{ manifest, groups }` bundle; `exportZip` uses fflate `zipSync` level 6 with `manifest.json` + `groups/<group>.json` entries; `buildManifest` stamps `{ exportedAt, appVersion: '0.1.0', schemaVersion: CURRENT_SCHEMA_VERSION (1) }`.
- **Import (D-18 / T-2-09-02):** `parseImportPayload` handles both JSON strings and fflate ZIPs (`unzipSync`/`strFromU8`), validating the manifest + group shapes and rejecting unknown groups. `mergeGroup` performs per-group MERGE/upsert by id — existing records win by default, `{ overwrite: true }` flips the conflict rule, new ids insert, and nothing is ever wiped; the settings merge additionally refuses excluded/unknown/declared-only/encrypted-only keys via `STORAGE_KEY_REGISTRY`, so a hostile payload cannot inject into protected storage. Malformed incoming data throws (the hostile-payload path).
- **Journaled full-vault restore (D-18 / A-20 / T-2-09-03):** `restoreFullVault` parses the payload, builds a `WriteJournalEntry` with `operation: 'restore-notes-batch'` (the user-confirmed 2026-08-09 live Phase-2 consumer — D-18 supersedes the declared-but-unwired wording; a wiring, not a vocabulary edit) and `targetIds: { scope: 'full-vault' }`, and runs `runJournaled` with one idempotent `merge-<group>` step per exported group. Steps are additive with no-op rollbacks — a mid-restore crash leaves completed groups persisted and an 'applying'/'rolled-back' entry; recovery re-runs the idempotent merges with the retained payload.
- **Tests (7):** JSON round-trip and ZIP round-trip through the REAL idb stores into fresh sets with equal ids; the D-01 no-secrets proof (envelope ciphertext + installSecret + sk-…/Bearer…/password values absent from the serialized payload, [REDACTED] present, manifest asserted); merge semantics (existing-wins, overwrite toggle, no-wipe); and the journaled-restore trio (completing entry with one step per group, failed-group-step crash leaving additive partials, recoverJournal replay of an 'applying' entry to convergence via the 02-04 harness).
- **Full suite green:** `pnpm vitest run` 257/257 across 41 files; `pnpm typecheck` clean; eslint + prettier clean on all touched files; D-19 held (zero ImportExportPanel matches in src/components).

## Task Commits

Each task was committed atomically (TDD RED → GREEN order):

1. **Task 1 RED: ImportExport.test.ts failing tests** - `6bc5989` (test)
2. **Task 2 GREEN: ImportExport.ts — scoped groups, manifest, JSON+ZIP, merge/upsert, journaled restore** - `f91361c` (feat, amended to fold the overwrite-expectation test fix + prettier formatting)

**Plan metadata:** pending (docs: complete plan — this SUMMARY commit)

_Note: TDD discipline inverts task order — the test file (Task 2) was authored first as the RED gate, then the implementation (Task 1) as GREEN (same pattern as 02-05)._

## Files Created/Modified

- `src/core/storage/ImportExport.ts` - Created. EXPORT_GROUPS/ExportGroup, EXCLUDED_KEYS, SETTINGS_GROUP_KEYS (A-19), ExportManifest/buildManifest, collectGroup, sanitizeGroup + assertNoSecrets, exportJson/exportZip, parseImportPayload + validateExportShape, mergeGroup (5 per-group merges), restoreFullVault (journaled 'restore-notes-batch'); every catch → debugLog with canonical STORE_READ/STORE_WRITE/WRITE_JOURNAL_FAILED codes
- `tests/core/storage/ImportExport.test.ts` - Created. 7 tests across 5 describe blocks: JSON round-trip, ZIP round-trip, no-secrets export, merge semantics, journaled restore (happy / failed-step crash / recoverJournal replay)

## Decisions Made

- **Documented +1 file (Rule-3 deviation):** `src/core/storage/ImportExport.ts` per RESEARCH Q1/A4 — the §18 create-list omits the import/export core and D-09 forbids only StorageLayer/StorageSession names; folding into Setting.ts would be a bad fit. Header comment records the deviation (Phase 1 precedent).
- **'restore-notes-batch' is a live consumer, not a new op:** A-20 user-confirmed 2026-08-09 that D-18's journaled full-vault restore supersedes the declared-but-unwired wording for this op (02-CONTEXT.md Deferred Ideas exception). `WriteJournalOperation` vocabulary untouched (Golden Rule 2).
- **assertNoSecrets over re-declared patterns:** the canonical O.13 patterns stay in TraceRedactor; sanitizeGroup asserts `redact(s) === s` for every surviving string, so a pattern leak after sanitization is a hard throw — no secret-shaped value can serialize.
- **EXCLUDED_KEYS enforced in both directions:** excluded by key at export collection AND refused at the settings merge boundary — one const is the D-01/D-11 enforce-point for export and hostile-import alike.
- **Existing-wins default with an explicit toggle:** `mergeGroup(group, incoming, { overwrite?: boolean })` — the D-18 'restore overwrites' toggle inverts the conflict rule; records absent from the payload are never touched (no wipe-and-replace ever).
- **No-op rollback, replay-based consistency:** additive upserts cannot be safely un-inserted; D-18's mid-restore consistency comes from per-boundary journal persistence + idempotent merge replay (proven by the crash/replay test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Overwrite-merge expectation miscounted kept records**
- **Found during:** Task 1 GREEN run (the per-group merge semantics test)
- **Issue:** The test asserted `overwrite: true` yields `{ upserted: 1, kept: 1 }`, but with the toggle set, EVERY incoming record is upserted (existing records replaced, not kept) — the correct result is `{ upserted: 2, kept: 0 }`. Implementation behavior was right; the expectation was wrong.
- **Fix:** Corrected the assertion to `{ upserted: 2, kept: 0 }` with a comment explaining the toggle semantics (incoming wins everywhere; records absent from the payload still never wipe).
- **Files modified:** tests/core/storage/ImportExport.test.ts
- **Verification:** `pnpm vitest run tests/core/storage/ImportExport.test.ts` 7/7 pass
- **Committed in:** `f91361c` (folded into the GREEN commit via amend — same pattern as 02-07's GREEN-commit test fix)

**2. [Rule 1 - Hygiene] Unused COSMETIC_SYNC_KEYS import after registry-based area routing**
- **Found during:** Task 2 verification (`pnpm eslint`)
- **Issue:** The settings collector derives local-vs-sync area from `STORAGE_KEY_REGISTRY` (single source of truth), so the imported `COSMETIC_SYNC_KEYS` was unused — eslint `no-unused-vars`.
- **Fix:** Removed the unused import; prettier --write applied to the two touched files.
- **Files modified:** src/core/storage/ImportExport.ts
- **Verification:** `pnpm eslint` clean, `pnpm prettier --check` clean, `pnpm typecheck` clean, tests 7/7
- **Committed in:** `f91361c` (GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 test-expectation bug, 1 hygiene)
**Impact on plan:** No scope creep — both fixes were necessary for the GREEN gate to pass cleanly; the implementation follows D-17/D-18 exactly as written.

## Issues Encountered

- **Stale LSP module-not-found noise:** after the ImportExport module landed, the language server reported `Cannot find module '@/core/storage/ImportExport'` in the test file (and pre-existing `WriteJournal.test.ts`/`__probe06.test.ts` diagnostics) — `pnpm typecheck` (tsc --noEmit) exits 0 with zero errors and the vitest suite resolves cleanly. Non-blocking (same stale-LSP pattern documented in 02-04/02-07).
- **Pre-existing `__probe06.test.ts` LSP errors** (object possibly undefined at lines 46/50/89): an old probe file from the RESEARCH session, unrelated to this plan's files; excluded by the scope-boundary rule — not touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **STORAGE-05 satisfied at the core level (D-19):** sanitized JSON/ZIP import/export + backup/restore work via the verified core; the Options → Advanced → Import/ExportPanel UI is Phase 7's consumer of `exportJson`/`exportZip`/`restoreFullVault` (§18 Phase 7 create-list, §9.3).
- **Recovery contract documented:** a mid-restore crash leaves additive partials + an 'applying'/'rolled-back' journal entry; recovery re-runs the idempotent merges with the retained payload — the Phase-7 restore flow and any startup-replay wiring (02-11) can reuse `mergeGroup` directly.
- **D-05/D-08 held:** the 11-op WriteJournal vocabulary is untouched — 'restore-notes-batch' gained its user-confirmed live consumer (A-20); no other op was wired.
- **Ready for 02-11:** verify:phase-2 runs the full chain (eslint + prettier + tsc + wxt build + vitest + isolation); the ImportExport suite participates in `tests/core/storage`.
- **No blockers.** Full suite 257/257 green; typecheck/eslint/prettier clean.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-09*

## TDD Gate Compliance

- RED gate: `6bc5989` `test(02-09): add failing ImportExport round-trip/merge/journal tests` — ran and FAILED with module-not-found before any implementation existed (verified).
- GREEN gate: `f91361c` `feat(02-09): implement scoped-group import/export core with journaled restore` — immediately follows RED; the 7-test suite passes (verified).
- REFACTOR gate: none (no cleanup needed — implementation shipped minimal and lint/prettier clean).
- Sequence validated: `git log --oneline --grep="^test(02-09)"` then `--grep="^feat(02-09)"` show RED before GREEN. **Compliant.**

## Self-Check: PASSED

- Created files verified on disk: `src/core/storage/ImportExport.ts`, `tests/core/storage/ImportExport.test.ts`, `02-09-SUMMARY.md`
- Commits verified in git log: `6bc5989` (Task 2 RED test), `f91361c` (Task 1 GREEN feat — amended to fold the test-expectation fix + formatting)
- Full verification: `pnpm vitest run` 257/257 green (41 files); `pnpm vitest run tests/core/storage` 50/50 green; `pnpm vitest run tests/core/storage/ImportExport.test.ts` 7/7 green; `pnpm typecheck` clean (exit 0); eslint clean; prettier clean on all touched files
- Plan verification commands run: the Task 1 `<verify>` chain (`pnpm typecheck` + `grep -c zipSync` + `grep -c restore-notes-batch`) all pass; Task 2 `<verify>` (`pnpm vitest run tests/core/storage/ImportExport.test.ts --reporter=dot`) passes; D-19 held — `grep ImportExportPanel src/components/` = 0 matches
