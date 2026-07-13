---
phase: 06-transaction-logging-and-diagnostics
plan: 07
subsystem: telemetry/export
tags: [export, jszip, redaction, privacy, trace-radactor]

# Dependency graph
requires:
  - phase: 06-01
    provides: AITransactionLogDB with getTraceTree/queryTransactions
  - phase: 06-03
    provides: TraceRedactor eager redaction middleware
provides:
  - Debug bundle export: single-operation JSON, filtered multi-operation ZIP with manifest.json
  - Privacy Mode content stripping (tool I/O) before serialization
  - All export data passes through TraceRedactor before any serialization
affects:
  - 06-08 DiagnosticsPanel (consumes export functions for UI export buttons)
  - Diagnostics UAT and verification

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSZip integration for ZIP assembly in browser environment
    - Privacy mode content stripping as a separate stage before redaction
    - Safe chrome.runtime.getManifest() with try-catch for test environments

key-files:
  created:
    - src/core/telemetry/export.ts
  modified:
    - tests/core/telemetry/export.test.ts

key-decisions:
  - "Privacy Mode strips tool I/O fields (inputSchema/outputSchema) before redaction — not after — matching D-38 metadata-only semantics"
  - "extension_version in manifest uses try-catch fallback to '0.0.0' for test environments where chrome.runtime.getManifest() is unavailable"
  - "Full trace tree is redacted via traceRedactor.redactObject() before JSON.stringify — single redaction call per trace, not per field"

patterns-established:
  - "Export pattern: query → privacy strip → redact → serialize → Blob/ZIP"

requirements-completed:
  - DATA-03

# Coverage metadata
coverage:
  - id: D1
    description: "exportSingleTrace returns a JSON Blob with the complete TraceTree for one operation (D-19)"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#exportSingleTrace returns a JSON Blob with complete TraceTree"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#exportSingleTrace calls getTraceTree with the correct operationId"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#exportSingleTrace returns undefined gracefully when trace not found"
        status: pass
    human_judgment: false

  - id: D2
    description: "exportTraces returns a ZIP Blob with per-transaction JSON files and manifest.json (D-17, D-18)"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#exportTraces produces a ZIP Blob with per-transaction files and manifest.json"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#exportTraces adds per-transaction JSON files and manifest.json to the ZIP"
        status: pass
    human_judgment: false

  - id: D3
    description: "buildManifest creates manifest.json with all D-18 required fields (export_version, generated_at, extension_version, transaction_count, applied_filters, redaction_version, trace_verbosity, privacy_mode)"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#buildManifest returns manifest with all required D-18 fields"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#buildManifest includes applied_filters from ExportOptions"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#buildManifest sets privacy_mode true when privacyMode is enabled"
        status: pass
    human_judgment: false

  - id: D4
    description: "Privacy Mode strips content fields (tool I/O) from export output (D-38)"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#Privacy Mode exportSingleTrace strips content fields when privacyMode is true"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#Privacy Mode exportTraces forces metadata-only when privacyMode is true"
        status: pass
    human_judgment: false

  - id: D5
    description: "All export data passes through TraceRedactor before serialization (D-08 — data never exported raw)"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#Redaction exportSingleTrace calls traceRedactor.redactObject before serialization"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#Redaction exportTraces calls traceRedactor on all traces before ZIP assembly"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#Redaction raw API key patterns are not present in export output"
        status: pass
    human_judgment: false

  - id: D6
    description: "downloadBlob triggers browser download without throwing"
    verification:
      - kind: unit
        ref: "tests/core/telemetry/export.test.ts#downloadBlob triggers a browser download using URL.createObjectURL"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-07-13
status: complete
---

# Phase 6 Plan 7: Debug Bundle Export — TDD Summary

**exportSingleTrace, exportTraces, buildManifest, and downloadBlob with TraceRedactor serialization and Privacy Mode content stripping**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-13T06:40:14Z
- **Completed:** 2026-07-13T06:44:23Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 2

## Accomplishments

- `exportSingleTrace(operationId, privacyMode?)` — queries AITransactionLogDB.getTraceTree, applies Privacy Mode content stripping, redacts via traceRedactor, returns JSON Blob
- `exportTraces(options, privacyMode?)` — queries filtered transactions, assembles ZIP via JSZip with per-transaction JSON files and manifest.json
- `buildManifest(options, count, privacyMode)` — constructs D-18 manifest with all required metadata fields (export_version, generated_at, extension_version, transaction_count, applied_filters, redaction_version, trace_verbosity, privacy_mode)
- `downloadBlob(blob, filename)` — browser download trigger via URL.createObjectURL
- Privacy Mode: strips tool I/O fields (inputSchema, outputSchema) before serialization
- All export data passes through `traceRedactor.redactObject()` before JSON.stringify
- 14 passing tests across 6 test groups (single export, bulk export, manifest, privacy mode, redaction, download)

## Task Commits

TDD cycle — RED then GREEN:

1. **Task 1 (RED): Write export tests** — `3cd8aa9` (test)
2. **Task 2 (GREEN): Implement export functions** — `6123992` (feat)

**No REFACTOR commit needed** — implementation clean and minimal.

## Files Created/Modified

- `src/core/telemetry/export.ts` (125 lines) — exportSingleTrace, exportTraces, buildManifest, downloadBlob with privacy strip and redaction
- `tests/core/telemetry/export.test.ts` (400 lines, 14 tests) — full test coverage for all 4 exports + privacy mode + redaction + download

## Decisions Made

- **Privacy Mode strips before redaction**: Tool I/O fields (inputSchema, outputSchema) are removed entirely before redactObject() is called. This matches D-38 metadata-only semantics — content never reaches serialization.
- **extension_version fallback**: `chrome.runtime.getManifest().version` wrapped in try-catch with `'0.0.0'` fallback for test environments where chrome.runtime is mocked but getManifest is not.
- **Full-tree redaction**: `traceRedactor.redactObject()` is called once on the full trace tree object (not per-field). The recursive redactValue dispatcher handles nested strings, arrays, and objects.
- **JSZip already installed** (v3.10.1) — no new dependencies needed.

## Deviations from Plan

None — plan executed exactly as written. All 14 tests pass at GREEN, all 563 existing tests pass, no regressions.

## TDD Gate Compliance

- **RED Gate:** Present — `test(06-07)` commit: 3cd8aa9
- **GREEN Gate:** Present — `feat(06-07)` commit: 6123992
- **REFACTOR:** Not needed — implementation clean and minimal
- **Status:** All gates PASS

## Issues Encountered

- **JSZip mock constructor**: The initial mock used `vi.fn(() => ({...}))` which is not callable with `new`. Fixed by using a plain function (`function MockJSZip() { return {...}; }`) as the default export.
- **Privacy Mode test assertion**: Initial test asserted `parsed.transaction.privacyMode` is `true`, but the privacy mode flag is not modified by the export function — it controls content stripping behavior. Fixed test to verify tool I/O fields are undefined after privacy mode export.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Export functions ready for DiagnosticsPanel (06-08) consumption — filter bar can wire "Export" button to exportTraces, transaction rows to exportSingleTrace
- JSZip already installed and ready for use
- All 563 tests pass (71 files)

## Self-Check: PASSED

- [x] `src/core/telemetry/export.ts` exists (125 lines)
- [x] `tests/core/telemetry/export.test.ts` exists (400 lines, 14 tests)
- [x] RED commit present: `3cd8aa9` (test)
- [x] GREEN commit present: `6123992` (feat)
- [x] All 14 export tests pass
- [x] All 563 total tests pass
- [x] TypeScript compiles cleanly (no new errors)
- [x] Exports match must_haves: exportSingleTrace, exportTraces, buildManifest, downloadBlob

---

*Phase: 06-transaction-logging-and-diagnostics*
*Completed: 2026-07-13*
