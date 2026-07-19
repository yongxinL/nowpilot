---
phase: 08-add-ons-data-portability
plan: 03
subsystem: data-portability
tags: [export, import, write-journal, trace-redactor, merge, credential-exclusion, d-16, d-17, d-18]

requires:
  - phase: 02-05
    provides: WriteJournal module for atomic multi-store operations
  - phase: 02-03
    provides: TraceRedactor with credential pattern redaction (JSESSIONID, sysparmCK, g_ck, API keys)
  - phase: 07-05
    provides: ImportExportSection (OPT-08) with scope selection, ZIP generation, file upload UI

provides:
  - Atomic export snapshots via WriteJournal export-data operation (D-16)
  - Credential exclusion from export via TraceRedactor safety net (D-18)
  - Export manifest with operationId for auditability (D-16)
  - Deterministic timestamp-based import merge (latest-wins) via mergeRecords() (D-17)
  - Import wrapped in WriteJournal import-data operation
  - Merge summary alert (updated/inserted/unchanged counts)
  - 13 data portability tests (6 export sanitization + 7 import merge)

affects:
  - Future add-on data portability plans (non-breaking extension point)

tech-stack:
  added: []
  patterns:
    - WriteJournal atomic lifecycle wrapping export/import operations
    - TraceRedactor safety net applied before ZIP file write
    - Deterministic timestamp-based merge (latest-wins) pattern for record reconciliation
    - MergeRecords utility function: pure function with Map-based lookup and summary

key-files:
  created:
    - src/core/data/mergeRecords.ts (61 lines) — Pure mergeRecords utility with MergeableRecord/MergeSummary types
    - tests/core/data/importMerge.test.ts (147 lines) — 7 tests for deterministic merge behavior
    - tests/core/data/exportSanitization.test.tsx (239 lines) — 6 tests for credential exclusion, operationId, WriteJournal integration
  modified:
    - src/components/options/ImportExportSection.tsx — handleExport and handleMerge with WriteJournal + TraceRedactor + mergeRecords
    - src/core/storage/WriteJournalEntry.ts — Added 'import-data' to WriteJournalOperation union and zod enum

key-decisions:
  - "Export wraps all storage reads in WriteJournal export-data operation with 3 steps (read-stores, redact-credentials, write-zip) — consistent snapshot across all stores per D-16"
  - "TraceRedactor.redactValue() applied as safety net on entire export data object before ZIP write — ensures no credential leakage per D-18"
  - "Export manifest includes operationId from WriteJournal entry for audit trail — connects exported file to journal entry"
  - "Import uses mergeRecords() with matched-existing-IDs tracking for correct unchanged counts — records existing only in the store are counted as unchanged"
  - "mergeRecords() follows Map-based lookup pattern: O(n) for incoming, O(1) per lookup — efficient for typical import volumes"
  - "Settings import does shallow merge (spread) for flat key-value structures (providerConfigs, featureFlags) and mergeRecords for array-based settings (mcpServers, slashCommands)"

patterns-established:
  - "Pattern: Export operations use 3-step WriteJournal lifecycle (read-stores → redact-credentials → write-zip) with markStepStart/markStepComplete per step and markCompleted on success"
  - "Pattern: Import operations use deterministic mergeRecords() with updatedAt comparison for conflict resolution — no interactive conflict UI needed"
  - "Pattern: Custom media queries with mergeRecords correctly accounts for unmatched existing records in unchanged count"

requirements-completed:
  - DATA-01
  - DATA-02

coverage:
  - id: D1
    description: "Atomic export — WriteJournal export-data operation wraps all storage reads with TraceRedactor safety net and operationId in manifest"
    requirement: DATA-01
    verification:
      - kind: integration
        ref: "tests/core/data/exportSanitization.test.tsx#Test 6: export is wrapped in WriteJournal export-data operation"
        status: pass
      - kind: integration
        ref: "tests/core/data/exportSanitization.test.tsx#Test 5: export manifest includes operationId field"
        status: pass
    human_judgment: false
  - id: D2
    description: "Credential exclusion — export output contains no API keys, JSESSIONID, sysparm_ck, or g_ck values"
    requirement: DATA-01
    verification:
      - kind: integration
        ref: "tests/core/data/exportSanitization.test.tsx#Test 1: export with all scopes — output contains no np_providers key values"
        status: pass
      - kind: integration
        ref: "tests/core/data/exportSanitization.test.tsx#Test 2: export contains no JSESSIONID= string anywhere in output"
        status: pass
      - kind: integration
        ref: "tests/core/data/exportSanitization.test.tsx#Test 3: export contains no sysparm_ck= string anywhere in output"
        status: pass
      - kind: integration
        ref: "tests/core/data/exportSanitization.test.tsx#Test 4: export contains no g_ck value in output"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deterministic import merge — latest-wins updatedAt comparison with correct summary counts (updated, inserted, unchanged)"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "tests/core/data/importMerge.test.ts#newer updatedAt overwrites existing item (latest-wins)"
        status: pass
      - kind: unit
        ref: "tests/core/data/importMerge.test.ts#older updatedAt is ignored (existing kept)"
        status: pass
      - kind: unit
        ref: "tests/core/data/importMerge.test.ts#item with no matching id is inserted as new"
        status: pass
      - kind: unit
        ref: "tests/core/data/importMerge.test.ts#identical updatedAt keeps existing (no overwrite)"
        status: pass
      - kind: unit
        ref: "tests/core/data/importMerge.test.ts#merge summary returns correct counts for mixed scenario"
        status: pass
    human_judgment: false

duration: 8 min
completed: 2026-07-19
status: complete
---

# Phase 8 Plan 03: Data Portability — Atomic Export + Deterministic Import Merge

**Atomic export snapshots via WriteJournal with TraceRedactor credential exclusion safety net, deterministic timestamp-based import merge (latest-wins) with mergeRecords(), and 13 passing data portability tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-19T12:07:32Z
- **Completed:** 2026-07-19T12:15:59Z
- **Tasks:** 2 (1 TDD RED + 1 GREEN)
- **Files modified:** 5

## Accomplishments

- **Export hardening (DATA-01, D-16, D-18):** handleExport now wraps all storage reads in WriteJournal export-data operation with 3 steps (read-stores → redact-credentials → write-zip). TraceRedactor.redactValue() applied as safety net before ZIP write. Export manifest includes operationId for audit trail. Error handling uses markFailed/markStepFailed pattern from workspaceStore.

- **Import hardening (DATA-02, D-17):** handleMerge uses deterministic updatedAt merge via mergeRecords() utility — latest-wins semantics. Import wrapped in WriteJournal import-data operation. Settings use shallow merge for flat key-value structures and mergeRecords for array-based configs. Merge summary alert shows updated/inserted/unchanged counts.

- **mergeRecords() utility:** Pure function in `src/core/data/mergeRecords.ts` with Map-based lookup (O(n)), matched-existing-IDs tracking for correct unchanged counts. Handles all edge cases: latest-wins overwrite, older ignored, new record insertion, identical timestamp preservation, mixed scenarios, empty sets.

- **WriteJournalEntry extension:** Added 'import-data' to the WriteJournalOperation union type and zod writeJournalEntrySchema enum.

- **13 data portability tests passing:** 6 export sanitization tests (credential exclusion, operationId, WriteJournal integration) + 7 import merge tests (all merge scenarios including mixed, empty existing, empty incoming). All 13 tests pass in CI.

## Task Commits

Each task was committed atomically following TDD discipline:

1. **Task 1 (TDD RED): Add failing tests for export sanitization and import merge** - `b0cfc2c` (test)
2. **Task 2 (TDD GREEN): Implement atomic export with TraceRedactor and deterministic import merge** - `9797cdd` (feat)

## Files Created/Modified

### Created (1 file)

- `src/core/data/mergeRecords.ts` (61 lines) — mergeRecords utility with MergeableRecord/MergeSummary types, Map-based lookup, matched-existing-IDs tracking for correct unchanged counts

### Modified (4 files)

- `src/components/options/ImportExportSection.tsx` +98/-18 — Added WriteJournal lifecycle for export/import (begin/markStepStart/markStepComplete/markCompleted/markFailed), TraceRedactor safety net, operationId in manifest, mergeRecords integration, merge summary alert
- `src/core/storage/WriteJournalEntry.ts` +2/-0 — Added 'import-data' to WriteJournalOperation type and zod enum
- `tests/core/data/exportSanitization.test.tsx` (239 lines) — 6 tests for credential exclusion (API keys, JSESSIONID, sysparm_ck, g_ck), operationId, WriteJournal integration; mocks JSZip, WriteJournal, URL.createObjectURL; renders component with antd providers
- `tests/core/data/importMerge.test.ts` (147 lines) — 7 tests for mergeRecords: latest-wins, older ignored, new insert, identical timestamps, mixed scenario, empty existing, empty incoming

## Decisions Made

- **Export uses 3-step WriteJournal lifecycle**: read-stores → redact-credentials → write-zip. Each step marked independently with markStepStart/markStepComplete. On failure, markFailed is called on the entry (step-level failure tracked by the missing step index).

- **TraceRedactor applied to full data object before ZIP write**: `traceRedactor.redactValue(data)` is called on the entire collected data object. This catches credentials in any scope's data, not just specific keys — acts as a universal safety net per D-18.

- **mergeRecords uses matched-existing-IDs tracking**: After iterating incoming records, existing records that were never matched by any incoming record are counted as unchanged. This ensures the summary accurately reflects all existing records, not just those with incoming matches.

- **Settings import uses two merge strategies**: Shallow spread merge (`{...existing, ...incoming}`) for flat key-value settings (providerConfigs, featureFlags) since these don't have `updatedAt` fields; mergeRecords for array-based settings (mcpServers, slashCommands) that may have per-record timestamps.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- **RED Gate:** Present — `test(08-03)` commit exists: `b0cfc2c` — 13 tests failing (6 export assertion failures + 7 import module-not-found)
- **GREEN Gate:** Present — `feat(08-03)` commit exists: `9797cdd` — all 13 tests passing
- **REFACTOR:** Not needed — implementation is clean and minimal for both tasks
- **Status:** All gates PASS

## Issues Encountered

- **exportSanitization test needed `.tsx` extension:** Initial `.test.ts` file failed to parse due to JSX in test (oxc requires `.tsx` for JSX syntax). Renamed to `.test.tsx`.
- **`vi.unstubAllGlobals()` removed chrome global:** afterEach hook used `vi.unstubAllGlobals()` which removed the chrome global stub set in setup.ts, causing downstream test failures. Fixed by using `vi.spyOn(URL, ...)` instead of global stubs and removing the destructive cleanup.
- **mergeRecords unchanged count needed matched-IDs tracking:** Initial implementation only counted unchanged from incoming-matched records. Existing-only records were left uncounted. Added `matchedExistingIds` set to track which existing records were matched and count unmatched ones as unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DATA-01 and DATA-100% covered by tests: credential exclusion verified, atomic export verified, deterministic merge verified
- ImportExportSection now production-grade for data portability — can be shipped with confidence
- Next plan (08-04) can proceed with remaining Phase 8 plans

## Self-Check: PASSED

- [x] `src/components/options/ImportExportSection.tsx` — modified with WriteJournal + TraceRedactor + mergeRecords
- [x] `src/core/data/mergeRecords.ts` — created with mergeRecords, MergeableRecord, MergeSummary
- [x] `src/core/storage/WriteJournalEntry.ts` — 'import-data' added to union and zod enum
- [x] `tests/core/data/importMerge.test.ts` — 7 tests passing
- [x] `tests/core/data/exportSanitization.test.tsx` — 6 tests passing
- [x] Both commits verified in git log: `b0cfc2c` (test), `9797cdd` (feat)
- [x] All 13 data portability tests pass
- [x] Existing ImportExportSection UI preserved (scope selection, ZIP download, file upload, import preview, restore from backup not affected)
- [x] All plan-level success criteria met

---

*Phase: 08-add-ons-data-portability*
*Completed: 2026-07-19*
