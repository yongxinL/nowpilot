---
phase: 06-transaction-logging-and-diagnostics
plan: 02
subsystem: telemetry
tags: [redaction, security, trace-redactor, patterns, regex, singleton]

# Dependency graph
requires:
  - phase: 06-01
    provides: Severity enum, TraceVerbosity, telemetry types (types.ts)
provides:
  - TraceRedactor class with 7 mandatory regex redaction patterns from product spec 4.4
  - redact() string redaction with typed placeholders per D-11
  - redactObject() recursive object traversal for safe object redaction
  - redactValue() polymorphic dispatch for strings, objects, arrays, primitives
  - traceRedactor singleton for app-wide use
affects:
  - 06-03 (AITransactionLog integration — TraceRedactor as constructor dependency)
  - 06-04 (debugLog auto-redaction safety net)
  - All downstream phases that persist or display trace data

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-level constants for testable regex pattern arrays
    - Recursive object redaction via polymorphic dispatch (redactValue)
    - Class+singleton export following project pattern (ErrorStore, ContextOptimizer analog)

key-files:
  created:
    - src/core/telemetry/TraceRedactor.ts (69 lines) — Class with PATTERNS constant, 3 methods, singleton
    - tests/core/telemetry/TraceRedactor.test.ts (177 lines, 13 tests) — All patterns + edge cases
  modified: []

key-decisions:
  - "Patterns defined as module-level const PATTERNS array (not instance property) for testability — matches plan guidance"
  - "redactObject delegates to redactValue for each property, enabling recursive traversal of nested objects and arrays"
  - "redactValue handles 4 dispatch paths: string→redact, array→map, object→redactObject, primitive→pass-through"
  - "Bearer token pattern uses case-insensitive flag /gi to match both 'Bearer' and 'bearer'"
  - "MCP auth header pattern matches /X-MCP-Auth-/gi for any X-MCP-Auth-* header name"

requirements-completed:
  - TELE-05

coverage:
  - id: D1
    description: "TraceRedactor.redact() applies all 7 mandatory patterns from product spec §4.4 — API keys (sk-, key-), Bearer tokens, JSESSIONID, sysparm_ck, g_ck, X-MCP-Auth headers"
    requirement: TELE-05
    verification:
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#redact sk-... API keys"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#redact key-... API keys"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#redact Bearer tokens"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#redact JSESSIONID"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#redact sysparm_ck"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#redact g_ck"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#redact MCP auth headers"
        status: pass
    human_judgment: false
  - id: D2
    description: "TraceRedactor.redactObject() recursively traverses nested objects, replacing string values. Handles arrays, null/undefined/numbers without throwing."
    requirement: TELE-05
    verification:
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#redactObject nested objects"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#redactObject arrays"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#redactObject null/undefined/numbers"
        status: pass
    human_judgment: false
  - id: D3
    description: "TraceRedactor.redactValue() dispatches correctly by type — string, object, array, primitive"
    requirement: TELE-05
    verification:
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#redactValue dispatch"
        status: pass
    human_judgment: false
  - id: D4
    description: "Edge cases handled — empty strings, false positive resilience (sk- without alphanum suffix is NOT redacted)"
    requirement: TELE-05
    verification:
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#empty string"
        status: pass
      - kind: unit
        ref: "tests/core/telemetry/TraceRedactor.test.ts#false positive resilience"
        status: pass
    human_judgment: false

# Metrics
duration: 2 min
completed: 2026-07-13
status: complete
---

# Phase 6 Plan 2: TraceRedactor — Eager pattern-based redaction middleware

**TraceRedactor class+singleton with 7 mandatory regex patterns from product spec §4.4, typed placeholders per D-11, and 13 passing tests covering redact/redactObject/redactValue with nested objects, arrays, and edge cases**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-13T06:22:40Z
- **Completed:** 2026-07-13T06:24:44Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 2

## Accomplishments

- TraceRedactor class with module-level PATTERNS constant (7 regex patterns) — sk- and key- API keys, Bearer tokens, JSESSIONID, sysparm_ck, g_ck, X-MCP-Auth headers
- Three methods: `redact()` (string), `redactObject()` (recursive object), `redactValue()` (polymorphic dispatch)
- Typed placeholders per D-11: `[REDACTED:API_KEY]`, `[REDACTED:BEARER_TOKEN]`, `[REDACTED:JSESSIONID]`, `[REDACTED:sysparmCK]`, `[REDACTED:g_ck]`, `[REDACTED:MCP_AUTH]`
- `traceRedactor` singleton exported for app-wide use
- 13 unit tests covering all patterns, recursive objects, arrays, null/undefined/numbers, empty strings, and false positive resilience
- All 539 existing tests continue to pass (2 pre-existing IndexedDBManager failures unrelated)

## Task Commits

Each task was committed atomically following RED→GREEN TDD cycle:

1. **Task 1 (TDD RED): Write 13 failing tests** - `9a44d67` (test)
2. **Task 2 (TDD GREEN): Implement TraceRedactor class** - `84151ac` (feat)

## Files Created/Modified

- `src/core/telemetry/TraceRedactor.ts` (69 lines) — TraceRedactor class with PATTERNS constant, redact(), redactObject(), redactValue() methods, traceRedactor singleton
- `tests/core/telemetry/TraceRedactor.test.ts` (177 lines, 13 tests) — All 7 mandatory patterns + recursive objects + arrays + edge cases

## Decisions Made

- Patterns are module-level `const PATTERNS` array (not instance property) for testability — matches plan guidance
- `redactObject` delegates to `redactValue` for each property, enabling recursive traversal of nested objects and arrays without duplicated logic
- `redactValue` handles 4 dispatch paths: string→redact, array→map over elements with redactValue, object→redactObject, primitive→pass-through
- Bearer token pattern uses case-insensitive flag (`/gi`) to match both `Bearer` and `bearer`
- MCP auth header pattern uses `/X-MCP-Auth-/gi` to match any `X-MCP-Auth-*` header name
- False positive resilience: `sk-` without alphanumeric suffix is intentionally preserved

## Deviations from Plan

None - plan executed exactly as written. All 13 tests pass.

## TDD Gate Compliance

- **RED Gate:** Present — `9a44d67` (`test(06-02)`)
- **GREEN Gate:** Present — `84151ac` (`feat(06-02)`)
- **REFACTOR:** Not needed — implementation clean and minimal
- **Status:** All gates PASS

## Issues Encountered

- Two pre-existing `IndexedDBManager.test.ts` failures (test expects `DB_VERSION === 1` but actual is `2` from prior phase work) — unrelated to this plan

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TraceRedactor ready for Plan 06-03 (AITransactionLog integration as constructor dependency)
- Plan 06-04 (debugLog auto-redaction safety net) will import traceRedactor singleton
- All downstream phases that persist or display trace data will use TraceRedactor as the eager redaction boundary (D-08)

## Self-Check: PASSED

- [x] `src/core/telemetry/TraceRedactor.ts` exists (69 lines)
- [x] `tests/core/telemetry/TraceRedactor.test.ts` exists (177 lines, 13 tests)
- [x] All 13 TraceRedactor tests pass
- [x] Both commits verified in git log (`9a44d67`, `84151ac`)
- [x] RED commit precedes GREEN commit (TDD gate)
- [x] Class + singleton exported: `TraceRedactor`, `traceRedactor`
- [x] All 7 mandatory patterns from product spec 4.4 implemented
- [x] Typed placeholders match D-11 exactly
- [x] No forEach or for-in loops (uses for-of with Object.entries)

---

*Phase: 06-transaction-logging-and-diagnostics*
*Completed: 2026-07-13*
