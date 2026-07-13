---
phase: 05-persistent-memory-architecture
plan: 07
subsystem: ai-pipeline
tags: [memory-engine, broadcast-bus, agent-orchestrator, fire-and-forget, cross-surface, session-storage]

requires:
  - phase: 05-06
    provides: MemoryEngine with constructor DI, assemble/extract/handleMemoryWrite

provides:
  - Memory write request routing in BroadcastBus (MEMORY_WRITE_REQUEST, emitMemoryWrite, onMemoryWrite, session listener)
  - MemoryEngine injection into AgentOrchestrator as 5th constructor parameter
  - Fire-and-forget memory extraction in runWithContext finally block
  - Tool result collection for memory extraction context
  - Cross-surface memory write request emission via chrome.storage.session

affects:
  - Phase 7 (chat hooks — consumes AgentOrchestrator with MemoryEngine)

tech-stack:
  added: []
  patterns:
    - Fire-and-forget extraction via .catch() without await — pipeline never blocked
    - MemoryWriteRequest single-key routing via chrome.storage.session with idempotencyKey dedup
    - conversationId derived from optimizedContext.provenance.operationId

key-files:
  created: []
  modified:
    - src/core/messaging/broadcastBus.ts — added MEMORY_WRITE_REQUEST, emitMemoryWrite, onMemoryWrite, session-based memory write dispatch
    - src/core/ai/pipeline/AgentOrchestrator.ts — 5-arg constructor with MemoryEngine, extraction in finally, collectRoundTripMessages helper, collectedToolResults tracking
    - tests/core/ai/pipeline/AgentOrchestrator.test.ts — createMockMemoryEngine factory, updated constructor calls, test for extract call verification

key-decisions:
  - "No singleton added to AgentOrchestrator — consumer (Phase 7) owns construction with dependency injection"
  - "conversationId derived from optimizedContext.provenance.operationId — no new runWithContext parameter needed"
  - "Memory write requests use single-key approach (np_memory_write_request) rather than queue array — idempotencyKey prevents double-processing"

patterns-established:
  - "Pattern: Memory routing via BroadcastBus follows existing onBroadcastMessage pattern with dedicated memoryWriteHandlers set"
  - "Pattern: extraction in finally block is fire-and-forget — this.memoryEngine.extract(...).catch(err => debugLog(...))"

requirements-completed:
  - MEM-04
  - MEM-05
  - MEM-07

coverage:
  - id: D1
    description: "BroadcastBus exports MEMORY_WRITE_REQUEST, emitMemoryWrite, onMemoryWrite — session listener dispatches write requests"
    requirement: MEM-04
    verification:
      - kind: unit
        ref: "src/core/messaging/broadcastBus.ts exports constants, types, and functions as specified"
        status: pass
    human_judgment: false
  - id: D2
    description: "AgentOrchestrator accepts MemoryEngine as 5th constructor parameter"
    requirement: MEM-05
    verification:
      - kind: unit
        ref: "tests/core/ai/pipeline/AgentOrchestrator.test.ts — all 18 tests pass with 5-arg constructor"
        status: pass
    human_judgment: false
  - id: D3
    description: "runWithContext finally block calls memoryEngine.extract() as fire-and-forget with .catch()"
    requirement: MEM-07
    verification:
      - kind: unit
        ref: "tests/core/ai/pipeline/AgentOrchestrator.test.ts#calls memoryEngine.extract in finally block"
        status: pass
    human_judgment: false

duration: 3 min
completed: 2026-07-13
status: complete
---

# Phase 05 Plan 07: Wire MemoryEngine into AI Pipeline Summary

**MemoryEngine injected into AgentOrchestrator as 5th constructor parameter, fire-and-forget extraction in runWithContext finally block, BroadcastBus extended with memory write request routing for cross-surface communication**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-13T01:54:31Z
- **Completed:** 2026-07-13T01:57:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **BroadcastBus memory write routing** — Added `MEMORY_WRITE_REQUEST` constant (`'np_memory_write_request'`), `emitMemoryWrite()` to write requests to `chrome.storage.session`, `onMemoryWrite()` handler registration with unsubscribe, and session listener dispatch in `initBroadcastBus()`. Cross-surface memory routing per D-06/D-07.
- **MemoryEngine injection into AgentOrchestrator** — 5-arg constructor with `MemoryEngine` parameter. Extraction triggered in `runWithContext()` finally block as fire-and-forget (not awaited) with `.catch()` error logging per D-04.
- **Tool result collection** — `collectedToolResults` tracks results during the planner loop for inclusion in extraction context.
- **Round-trip message collection** — `collectRoundTripMessages()` extracts user input, conversation history, and tool results from the `OptimizedContext` for memory extraction.
- **conversationId from provenance** — Uses `optimizedContext.provenance.operationId` as the conversation identifier per Research open question #1 (caller-assembles pattern).
- **All 18 tests pass** — Including a new test verifying `memoryEngine.extract` is called with the correct `conversationId` in the finally block.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend BroadcastBus with memory write request types and handlers** - `87c1868` (feat)
2. **Task 2: Inject MemoryEngine into AgentOrchestrator and wire fire-and-forget extraction** - `3291702` (feat)

**Plan metadata:** (committed after SUMMARY)

## Files Created/Modified

- `src/core/messaging/broadcastBus.ts` (36 lines added) — Added `MEMORY_WRITE_REQUEST`, `MemoryWriteHandler` type, `memoryWriteHandlers` set, `onMemoryWrite`/`emitMemoryWrite` functions, extended session listener in `initBroadcastBus()`
- `src/core/ai/pipeline/AgentOrchestrator.ts` (78 lines added, 2 modified) — 5th constructor parameter `memoryEngine`, `collectRoundTripMessages` private method, `collectedToolResults` tracking, fire-and-forget extraction in finally block
- `tests/core/ai/pipeline/AgentOrchestrator.test.ts` — Added `createMockMemoryEngine()` factory, updated constructor calls, new extraction verification test

## Decisions Made

- **No singleton added to AgentOrchestrator** — The class export format is preserved for Phase 7 consumer to construct with DI. The plan's singleton update step was skipped since no existing singleton pattern exists in the file.
- **conversationId from provenance.operationId** — Avoids changing the `runWithContext()` signature. The caller (Phase 7) calls `memoryEngine.assemble()` before creating `ContextOptimizerInput` per Research open question #1.
- **Single-key approach for memory write requests** — Follows the plan design using a single `np_memory_write_request` key rather than a queue. Race window is small for single-user v0.1, and `idempotencyKey` prevents double-processing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both tasks executed cleanly with first-pass verification success.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5 is now complete (all 7 plans have SUMMARY.md)
- MemoryEngine is wired into the AI pipeline via BroadcastBus (memory write routing) and AgentOrchestrator (post-execution extraction)
- Phase 6 (UI surfaces) can consume AgentOrchestrator with MemoryEngine — the caller assembles memory via `memoryEngine.assemble()` before creating `ContextOptimizerInput`, and triggers extraction after each turn
- Phase 7 (hooks) will register `memoryEngine.handleMemoryWrite` as a BroadcastBus memory write handler during startup

## Self-Check: PASSED

- [x] `src/core/messaging/broadcastBus.ts` exists with MEMORY_WRITE_REQUEST, emitMemoryWrite, onMemoryWrite
- [x] `src/core/ai/pipeline/AgentOrchestrator.ts` exists with MemoryEngine 5th constructor param, extraction in finally, collectRoundTripMessages
- [x] `tests/core/ai/pipeline/AgentOrchestrator.test.ts` exists with updated constructor calls and extraction test
- [x] Commit `87c1868` (Task 1) verified in git log
- [x] Commit `3291702` (Task 2) verified in git log
- [x] All 18 AgentOrchestrator tests pass
- [x] No new TypeScript errors introduced (pre-existing errors in unrelated files unchanged)

---

*Phase: 05-persistent-memory-architecture*
*Completed: 2026-07-13*
