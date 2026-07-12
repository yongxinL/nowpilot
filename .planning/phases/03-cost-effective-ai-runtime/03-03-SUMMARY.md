---
phase: 03-cost-effective-ai-runtime
plan: 03
subsystem: tools
tags: [tool-registry, permission-service, fixture-tools, zod, tdd]

# Dependency graph
requires:
  - phase: 03-01
    provides: AI SDK packages installed
  - phase: 03-02
    provides: ProviderRegistry with ProviderConfig/ModelEntry types
provides:
  - ToolRegistry class+singleton with closed-enum validation (register/get/has/list/unregister)
  - PermissionService interface + DefaultPermissionService default-deny implementation
  - 3 fixture tools (echoTool, counterTool, getTimeTool) for pipeline testing
affects:
  - Phase 03-06 ExecutorService (consumes ToolRegistry and PermissionService)
  - Phase 7 (replaces DefaultPermissionService with UI-based permission dialog)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Map-based registry pattern (private #tools field, exported class + singleton)
    - Interface + default implementation pattern for permission service
    - Fixture tool pattern with Zod v4 schemas for pipeline testing
    - TDD cycle applied to all 3 tasks (RED→GREEN commits per task)

key-files:
  created:
    - src/core/ai/tools/ToolRegistry.ts
    - src/core/ai/tools/PermissionService.ts
    - src/core/ai/tools/fixtures/echoTool.ts
    - src/core/ai/tools/fixtures/counterTool.ts
    - src/core/ai/tools/fixtures/getTimeTool.ts
  modified:
    - tests/core/ai/tools/ToolRegistry.test.ts
    - tests/core/ai/tools/PermissionService.test.ts
    - tests/core/ai/tools/fixtures/echoTool.test.ts

key-decisions:
  - "ToolRegistry uses JS private field (#tools = new Map) matching PATTERNS.md guidance"
  - "PermissionService interface exposes canExecute() returning Promise<boolean> — async for future UI dialog integration"
  - "Fixture tools are plain object exports (not class instances) — simpler, matches ToolDefinition interface"
  - "Counter tool uses module-level let count = 0 for session-scoped state"
  - "All 3 fixture tools check context.abortSignal.aborted before executing, throwing AbortError for aborted signals"

patterns-established:
  - "Pattern: Fixture tools are const object exports, ToolDefinition-compatible, with Zod v4 schemas, category:'safe', requiresPermission:false"

requirements-completed:
  - AIRN-02

coverage:
  - id: D1
    description: "ToolRegistry singleton with register/get/has/unregister/list — closed-enum validation returns undefined for unknown tool names"
    requirement: AIRN-02
    verification:
      - kind: unit
        ref: "tests/core/ai/tools/ToolRegistry.test.ts#ToolRegistry"
        status: pass
    human_judgment: false

  - id: D2
    description: "PermissionService interface + DefaultPermissionService default-deny — always returns false, extendable for Phase 7"
    requirement: AIRN-02
    verification:
      - kind: unit
        ref: "tests/core/ai/tools/PermissionService.test.ts#PermissionService"
        status: pass
    human_judgment: false

  - id: D3
    description: "echoTool fixture — echoes input string through Zod validation, respects abortSignal"
    verification:
      - kind: unit
        ref: "tests/core/ai/tools/fixtures/echoTool.test.ts#echoTool"
        status: pass
    human_judgment: false

  - id: D4
    description: "counterTool fixture — session-scoped stateful counter with increment/decrement/reset"
    verification:
      - kind: unit
        ref: "tests/core/ai/tools/fixtures/echoTool.test.ts#counterTool"
        status: pass
    human_judgment: false

  - id: D5
    description: "getTimeTool fixture — returns current ISO 8601 timestamp"
    verification:
      - kind: unit
        ref: "tests/core/ai/tools/fixtures/echoTool.test.ts#getTimeTool"
        status: pass
    human_judgment: false

  - id: D6
    description: "All 3 fixture tools have category:'safe' and requiresPermission:false"
    requirement: AIRN-02
    verification:
      - kind: unit
        ref: "tests/core/ai/tools/fixtures/echoTool.test.ts#category and permission assertions"
        status: pass
    human_judgment: false

# Metrics
duration: 3 min
completed: 2026-07-12
status: complete
---

# Phase 03 Plan 03: Tool Validation Framework (ToolRegistry, PermissionService, Fixture Tools)

**ToolRegistry with closed-enum validation, PermissionService interface with DefaultPermissionService default-deny, and 3 fixture tools (echo, counter, getTime) for pipeline testing — all built TDD-style with 26 passing tests**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-12T11:49:15Z
- **Completed:** 2026-07-12T11:52:59Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 8

## Accomplishments

- ToolRegistry class+singleton with Map-based register/get/has/list/unregister — duplicate registration throws, unknown names return undefined (closed-enum validation per D-12)
- PermissionService interface (canExecute) + DefaultPermissionService returning false for all tools (default-deny per D-13)
- 3 fixture tools: echoTool (echoes input, respects abortSignal), counterTool (stateful session-scoped count), getTimeTool (ISO 8601 timestamp)
- All fixture tools implement ToolDefinition with Zod v4 schemas, category:'safe', requiresPermission:false
- All 3 TDD tasks produced RED→GREEN commit sequence with tests passing at each step
- All 26 tests pass across 3 test files

## Task Commits

Each task was committed atomically following RED→GREEN TDD cycle:

1. **Task 1 (TDD RED): ToolRegistry failing test** - `f709e45` (test)
2. **Task 1 (TDD GREEN): ToolRegistry implementation** - `db34b43` (feat)
3. **Task 2 (TDD RED): PermissionService failing test** - `8131412` (test)
4. **Task 2 (TDD GREEN): PermissionService implementation** - `ae0759b` (feat)
5. **Task 3 (TDD RED): Fixture tools failing test** - `a78a64f` (test)
6. **Task 3 (TDD GREEN): Fixture tools implementation** - `d7e9060` (feat)

## Files Created/Modified

- `src/core/ai/tools/ToolRegistry.ts` - Map-based registry with register/get/has/list/unregister, closed-enum validation
- `src/core/ai/tools/PermissionService.ts` - Interface + DefaultPermissionService, default-deny for all tools
- `src/core/ai/tools/fixtures/echoTool.ts` - Echo fixture tool with Zod v4 input/output schemas, abortSignal support
- `src/core/ai/tools/fixtures/counterTool.ts` - Stateful counter fixture with increment/decrement/reset
- `src/core/ai/tools/fixtures/getTimeTool.ts` - Time fixture returning ISO 8601 timestamp
- `tests/core/ai/tools/ToolRegistry.test.ts` - 8 tests covering all ToolRegistry operations
- `tests/core/ai/tools/PermissionService.test.ts` - 4 tests for default-deny + custom override
- `tests/core/ai/tools/fixtures/echoTool.test.ts` - 14 tests across all 3 fixture tools

## Decisions Made

- ToolRegistry uses JS private field `#tools = new Map()` per PATTERNS.md guidance (exact copy of KeymapRegistry pattern)
- PermissionService interface is async (returns Promise<boolean>) for future Phase 7 UI dialog integration — ExecutorService calls it with await, no changes needed later
- Fixture tools are plain `const` object exports (not class instances) — simpler, directly implement ToolDefinition
- counterTool uses module-level `let count = 0` for session-scoped state (resets on extension restart)
- All 3 fixtures check `abortSignal.aborted` before executing, throwing AbortError for clean timeout propagation

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- **RED Gate:** Present — `test(03-03)` commits exist: f709e45, 8131412, a78a64f
- **GREEN Gate:** Present — `feat(03-03)` commits exist: db34b43, ae0759b, d7e9060
- **REFACTOR:** Not needed — no clean-up required for any of the 3 tasks
- **Status:** All gates PASS

## Issues Encountered

- Initial test import paths used wrong depth (`../../../../` instead of `../../../../../` for the fixtures directory which is one level deeper than the tools directory). Fixed during RED phase before GREEN commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ToolRegistry and PermissionService ready for ExecutorService (Plan 03-06) consumption
- Fixture tools registered in ToolRegistry for pipeline tests (to be done in Plan 03-06 setup)
- Phase 7 can replace PermissionService without changing interface

---

*Phase: 03-cost-effective-ai-runtime*
*Completed: 2026-07-12*
