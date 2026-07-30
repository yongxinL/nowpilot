---
phase: 03-ai-core-pipeline
plan: 04
subsystem: ai
tags: [planner-service, structured-output, dual-mode, zod]
requires:
  - phase: 03-01
    provides: types, PipelineError
  - phase: 03-02
    provides: ProviderAdapter.supportsStructuredOutput
provides:
  - Dual-mode PlannerService (Output.object native path + generateText+repair fallback)
  - StructuredOutput.repairJSON() utility (one-shot JSON repair)
  - All 3 PlannerDecision variants (answer, run_tool, ask_clarification)
affects: [03-07]
tech-stack:
  added: []
  patterns: [Dual-mode capability-based routing, one-shot JSON repair]
key-files:
  created:
    - src/core/ai/StructuredOutput.ts
    - tests/core/ai/StructuredOutput.test.ts
    - tests/core/ai/PlannerService.test.ts
  modified:
    - src/core/ai/PlannerService.ts
requirements-completed: [AI-02]
duration: 3min
completed: 2026-07-30
status: complete
---

# Phase 03 Plan 04: PlannerService Dual-Mode & StructuredOutput Summary

**PlannerService expanded with dual-mode routing (Output.object for capable providers, generateText+repair for Ollama) and StructuredOutput one-shot JSON repair — 14 tests pass**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-30T02:30:12Z
- **Completed:** 2026-07-30T02:33:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- PlannerService dual-mode: native Output.object() when supportsStructuredOutput=true, generateText+repairJSON when false
- StructuredOutput.repairJSON() strips fences, fixes trailing commas, completes truncated JSON
- All 3 PlannerDecision variants supported (answer, run_tool, ask_clarification)
- PlannerDecisionSchema as Zod v4 discriminatedUnion with z.strictObject()
- 14 tests pass across both test files

## Decisions Made

- repairJSON is one-shot only (no retry loop) per D-03
- StructuredOutput uses Zod v4 APIs (z.strictObject, z.discriminatedUnion)
- PlannerService now uses PersonaInjector for planner-stage persona injection

---

*Phase: 03-ai-core-pipeline*
*Completed: 2026-07-30*
