---
phase: 03-cost-effective-ai-runtime
plan: 07
subsystem: pipeline
tags: [orchestrator, planner, executor, renderer, tier-caps, abort, tdd]

requires:
  - phase: 03-04
    provides: PlannerService, ExecutorService, RendererService, pipelineTypes, ProviderRouter
  - phase: 03-05
    provides: AbortManager, TimeoutConfig, AI_CONFIG tier caps
  - phase: 03-06
    provides: Pipeline stage services (Planner, Executor, Renderer)

provides:
  - AgentOrchestrator class+singleton — top-level entry point for all AI operations
  - Planner→Executor loop with tier caps (haiku=1, flash=2, sonnet=3, opus=5)
  - Per-stage timeout integration via AbortManager (3s/10s/5s)
  - Tool result feeding back to Planner in subsequent loop iterations
  - Unified OrchestratorEvent async generator stream per D-06
  - External cancel() method for user cancellation

affects:
  - Phase 7 Chat UI (consumes agentOrchestrator.run())
  - Phase 7 Agent page (consumes agentOrchestrator.run())

tech-stack:
  added: []
  patterns:
    - Async generator for typed event streaming (for-await consumption)
    - Constructor DI with module-level singleton wiring
    - Per-operation AbortManager with stage-level child signals

key-files:
  created:
    - src/core/ai/pipeline/AgentOrchestrator.ts
  modified:
    - tests/core/ai/pipeline/AgentOrchestrator.test.ts

key-decisions:
  - "Tier cap mapping uses CostTierType (haiku/flash/sonnet/opus) → {1, 2, 3, 5}, not the AI_CONFIG.tierCap key names (tiny/small/medium/large) — aligns with PlannerService and RendererService signatures"
  - "Renderer is called with hardcoded 'flash' tier matching RendererService's internal selectModel('flash') call"
  - "ask_clarification breaks planner loop but still proceeds to renderer phase (per plan pseudocode: break → proceed to Renderer)"
  - "AbortManager created internally per run() invocation, tracked in private field for cancel() access"
  - "Tool results formatted as 'Previous tool results:' section appended to user message in buildPlannerPrompt()"

requirements-completed:
  - AIRN-04

coverage:
  - id: D1
    description: "AgentOrchestrator loops Planner→Executor with tier cap enforcement (haiku=1, flash=2, sonnet=3, opus=5)"
    requirement: AIRN-04
    verification:
      - kind: unit
        ref: "tests/core/ai/pipeline/AgentOrchestrator.test.ts#enforces haiku tier cap"
        status: pass
      - kind: unit
        ref: "tests/core/ai/pipeline/AgentOrchestrator.test.ts#enforces opus tier cap"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tool results from Executor fed back to Planner in subsequent plan() calls"
    requirement: AIRN-04
    verification:
      - kind: unit
        ref: "tests/core/ai/pipeline/AgentOrchestrator.test.ts#passes tool results to Planner"
        status: pass
    human_judgment: false
  - id: D3
    description: "Renderer called after Planner loop ends with flash-tier model"
    requirement: AIRN-04
    verification:
      - kind: unit
        ref: "tests/core/ai/pipeline/AgentOrchestrator.test.ts#emits plan-created, skips executor, delegates to renderer"
        status: pass
    human_judgment: false
  - id: D4
    description: "User cancellation propagates through all stages via AbortManager cancel()"
    verification:
      - kind: unit
        ref: "tests/core/ai/pipeline/AgentOrchestrator.test.ts#cancelled during planner"
        status: pass
      - kind: unit
        ref: "tests/core/ai/pipeline/AgentOrchestrator.test.ts#cancelled during executor"
        status: pass
    human_judgment: false
  - id: D5
    description: "AbortSignal passed to planner, executor, and renderer stages (per-stage timeouts per D-17)"
    verification:
      - kind: unit
        ref: "tests/core/ai/pipeline/AgentOrchestrator.test.ts#passes AbortSignal to planner, executor, and renderer"
        status: pass
    human_judgment: false
  - id: D6
    description: "All OrchestratorEvent types emitted in correct order for full pipeline"
    verification:
      - kind: unit
        ref: "tests/core/ai/pipeline/AgentOrchestrator.test.ts#emits tool-called → tool-result, feeds result back"
        status: pass
    human_judgment: false

duration: 5 min
completed: 2026-07-12
status: complete
---

# Phase 3 Plan 7: AgentOrchestrator (Planner→Executor Loop with Tier Caps)

**AgentOrchestrator class+singleton with async generator `run()` method — the top-level entry point for all AI operations, looping Planner→Executor with tier caps, per-stage timeouts, and unified event streaming**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-12T12:14:29Z
- **Completed:** 2026-07-12T12:19:29Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 2

## Accomplishments

- AgentOrchestrator class+singleton with constructor DI (PlannerService, ExecutorService, RendererService, ProviderRouter)
- `async *run()` method returns `AsyncGenerator<OrchestratorEvent>` — consumers iterate with `for await`
- Planner→Executor loop with tier caps: haiku=1, flash=2, sonnet=3, opus=5 (maps cost tier to max planner iterations)
- Tool results captured and fed back to Planner in subsequent `plan()` calls via `buildPlannerPrompt()`
- Renderer phase called after Planner loop ends, with hardcoded 'flash' tier
- Per-stage timeouts via `AbortManager.createStageTimeout()`: planner 3s, executor 10s, renderer 5s
- `cancel()` method for external user cancellation — delegates to `AbortManager.cancel('User cancelled')`
- Error handling: AbortError → "Operation cancelled" event; other errors → message + debugLog
- 11 passing tests across answer-only, tool-chain, tier cap, abort, and event ordering scenarios

## Task Commits

Each task was committed atomically following RED→GREEN TDD cycle:

1. **Task 1 (TDD RED): AgentOrchestrator failing test** - `e21a68a` (test)
2. **Task 1 (TDD GREEN): AgentOrchestrator implementation** - `97c72b2` (feat)

_Note: Task 2 integration test behaviors were included in the same test file — all 11 tests cover both tasks' acceptance criteria._

## Files Created/Modified

- `src/core/ai/pipeline/AgentOrchestrator.ts` - Pipeline coordinator: Planner→Executor loop with tier caps, per-stage timeouts, Renderer delegation, cancel()
- `tests/core/ai/pipeline/AgentOrchestrator.test.ts` - 11 tests covering answer-only flow, tool-then-answer, tier cap enforcement (haiku/opus), tool result feeding, user cancellation (planner/executor), AbortSignal propagation, ask_clarification behavior, cancel() safety

## Decisions Made

- **Tier cap mapping** uses `CostTierType` (haiku/flash/sonnet/opus → 1/2/3/5) directly since these are the types passed to PlannerService and RendererService. The AI_CONFIG.tierCap keys (tiny/small/medium/large) are a different naming convention — the orchestrator implements its own mapping via a `Record<CostTierType, number>`.
- **Renderer called with 'flash' tier** hardcoded, matching the existing RendererService implementation which internally calls `this.router.selectModel('flash', ...)` regardless of the tier parameter. Per D-07 the renderer always uses flash-tier for cost-effective streaming.
- **ask_clarification breaks loop but proceeds to Renderer** — the plan's pseudocode says `break (proceed to Renderer)` for both 'answer' and 'ask_clarification', so the renderer still streams after an ask_clarification decision.
- **AbortManager is internal** — created per `run()` invocation, stored in a private field for `cancel()` access. This keeps the orchestrator API clean (no abortManager parameter).
- **Tool result formatting** follows a simple text-based approach: `"Previous tool results:\n" + JSON.stringify(toolResults)` appended to the user message. This clearly demarcates authoritative tool data from user input per T-03-01-B.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- **RED Gate:** Present — `e21a68a test(03-07): add failing test for AgentOrchestrator`
- **GREEN Gate:** Present — `97c72b2 feat(03-07): implement AgentOrchestrator (Planner→Executor loop with tier caps)`
- **REFACTOR:** Not needed — implementation is clean and minimal
- **Status:** All gates PASS

## Issues Encountered

- Two test expectations needed correction during GREEN phase:
  1. Executor cancel test: `tool-called` is yielded synchronously before `execute()` is called, so error event is at index 2, not index 1
  2. ask_clarification test: the plan pseudocode says `break (proceed to Renderer)` — renderer runs after the break, so text-delta/text-complete events are expected

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AgentOrchestrator ready for Phase 7 Chat UI and Agent page consumption
- All 326 tests pass across 52 test files
- Pipeline stage services complete: PlannerService, ExecutorService, RendererService, AgentOrchestrator
- Next: Phase 3 Plan 8 (ContextOptimizer — token budget management and tier-based context degradation)

---

*Phase: 03-cost-effective-ai-runtime*
*Completed: 2026-07-12*
