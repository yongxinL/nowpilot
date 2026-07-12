---
phase: 03-cost-effective-ai-runtime
plan: 05
subsystem: streaming
tags: [chunk-buffer, rAF-batching, abort-manager, abort-signal, timeout, tdd]

# Dependency graph
requires:
  - phase: 03-01
    provides: AI SDK packages installed
  - phase: 03-04
    provides: ProviderRouter with fallback chain
provides:
  - ChunkBuffer class for rAF-batched text-delta event batching
  - AbortManager class for parent+child AbortSignal propagation
affects:
  - Phase 03-06 AgentOrchestrator (consumes ChunkBuffer and AbortManager)
  - Phase 03-07 RendererService (consumes ChunkBuffer for streaming output)
  - Phase 03-08 Timeline service (consumes AbortManager via orchestrator)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - No-singleton utility class pattern (consumers create instances)
    - Fake-timer test pattern with vi.useFakeTimers() for deterministic timeout testing
    - DOMException-based error types (TimeoutError, AbortError) for abort signal reasons

key-files:
  created:
    - src/core/ai/streaming/ChunkBuffer.ts
    - src/core/ai/streaming/AbortManager.ts
  modified:
    - tests/core/ai/streaming/ChunkBuffer.test.ts
    - tests/core/ai/streaming/AbortManager.test.ts

key-decisions:
  - "ChunkBuffer uses requestAnimationFrame for batching — pushes within same frame are combined into single flush"
  - "AbortManager uses root AbortController + per-stage child controllers — root cancel propagates to all children; child timeouts are isolated from root"
  - "Both classes exported as class only (no singleton) — consumers create instances per operation"
  - "Tests use vi.useFakeTimers() for deterministic timeout testing rather than real timers"

requirements-completed:
  - AIRN-06
  - AIRN-09

coverage:
  - id: D1
    description: "ChunkBuffer rAF-batched text-delta buffer — multiple pushes within same frame combined into single flush"
    requirement: AIRN-06
    verification:
      - kind: unit
        ref: "tests/core/ai/streaming/ChunkBuffer.test.ts#ChunkBuffer"
        status: pass
    human_judgment: false
  - id: D2
    description: "AbortManager parent+child AbortSignal model — root cancel propagates to all children; child timeouts isolated"
    requirement: AIRN-09
    verification:
      - kind: unit
        ref: "tests/core/ai/streaming/AbortManager.test.ts#AbortManager"
        status: pass
    human_judgment: false

# Metrics
duration: 2 min
completed: 2026-07-12
status: complete
---

# Phase 03 Plan 05: Streaming Infrastructure (ChunkBuffer + AbortManager)

**ChunkBuffer rAF-batched text-delta buffer and AbortManager parent+child signal model — both built TDD-style with 11 passing tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-12T12:01:21Z
- **Completed:** 2026-07-12T12:04:05Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4

## Accomplishments

- ChunkBuffer class with rAF-batched text-delta flushing — `push()` buffers text and schedules an rAF flush; multiple pushes within the same frame are batched into a single flush; `flush()` immediately emits pending buffer; `destroy()` cancels pending rAF and clears buffer
- AbortManager class with parent+child signal model — `rootController` for user cancellation, `createStageTimeout(ms)` returns a child signal with isolated timeout; root `cancel()` propagates `AbortError` to all children; child TimeoutError does not affect root
- Both classes exported as named class exports only — no singleton; consumers create instances per operation
- Both tasks followed RED→GREEN TDD cycle with proper commit sequence
- All 11 streaming tests pass, total 285 tests pass across 47 test files (no regressions)

## Task Commits

Each task was committed atomically following RED→GREEN TDD cycle:

1. **Task 1 (TDD RED): ChunkBuffer failing test** - `bc54228` (test)
2. **Task 1 (TDD GREEN): ChunkBuffer implementation** - `ff922ef` (feat)
3. **Task 2 (TDD RED): AbortManager failing test** - `763076c` (test)
4. **Task 2 (TDD GREEN): AbortManager implementation** - `9c7dd54` (feat)

## Files Created/Modified

- `src/core/ai/streaming/ChunkBuffer.ts` - rAF-batched text-delta buffer: push, flush, destroy, private scheduleFlush
- `src/core/ai/streaming/AbortManager.ts` - Parent+child AbortSignal model: rootController, createStageTimeout, cancel, isAborted
- `tests/core/ai/streaming/ChunkBuffer.test.ts` - 5 tests: single push, batch, cross-frame, immediate flush, destroy
- `tests/core/ai/streaming/AbortManager.test.ts` - 6 tests: root propagation, timeout, root-clear, isolation, mixed, isAborted

## Decisions Made

- ChunkBuffer uses `requestAnimationFrame` for batching — multiple pushes in the same frame are combined into a single flush call, preventing jank from per-chunk rendering
- AbortManager uses root `AbortController` with per-stage child controllers — user cancellation propagates `AbortError` to all child signals; child TimeoutError is isolated and does not affect the root
- Both classes are exported as class only (no singleton) — the AgentOrchestrator creates one instance per operation
- Tests use `vi.useFakeTimers()` for deterministic timeout testing and mocked `requestAnimationFrame`/`cancelAnimationFrame` for ChunkBuffer timing control

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- **RED Gate:** Present — `test(03-05)` commits exist: bc54228, 763076c
- **GREEN Gate:** Present — `feat(03-05)` commits exist: ff922ef, 9c7dd54
- **REFACTOR:** Not needed — no clean-up required for either task
- **Status:** All gates PASS

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ChunkBuffer ready for AgentOrchestrator (Plan 03-06) and RendererService (Plan 03-07) consumption
- AbortManager ready for AgentOrchestrator per-operation timeout management
- Both components follow no-singleton pattern — orchestrator creates instances as needed

## Self-Check: PASSED

- All 4 created files exist and verified
- All 4 commits verified in git log
- All 285 tests pass (47 test files, 11 new streaming tests)
- Both TDD tasks have RED→GREEN commit sequences

---

*Phase: 03-cost-effective-ai-runtime*
*Completed: 2026-07-12*
