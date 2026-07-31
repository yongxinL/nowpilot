---
phase: 04-context-optimization-pipeline
plan: 01
subsystem: ai-core
tags: [context-optimization, token-budget, provenance, agent-orchestrator, typescript]

# Dependency graph
requires:
  - phase: 03-ai-core-pipeline
    provides: AgentOrchestrator runTurn(), PlannerService/ExecutorService/RendererService pipeline, ProviderAdapter, PipelineError codes, PlannerContext
provides:
  - ContextOptimizer.optimize() pipeline stage (tier classify → budget → assemble → trim/throw → provenance)
  - ModelContextTier classification (tiny/small/medium/large) + KNOWN_MODEL_WINDOWS
  - TokenBudget service (CJK-aware estimation, §2.2 allocation) — single token-estimation entry point
  - ContextProvenanceManifest (source-level provenance, sourceId validation)
  - AgentTurnInput + createAgentTurnInput factory (replaces PlannerContext as agent entry contract)
  - OptimizedContext contract consumed by PlannerService/RendererService
  - CONTEXT_TOO_LARGE terminal error code
affects: [04-context-optimization-pipeline plans 02/03, 05-memory, 06-telemetry (AITransactionLog consumes provenance), phase 7 UI (runTurn callers)]

# Tech tracking
tech-stack:
  added: [zod (already installed) — ContextOptimizerInput validation]
  patterns: [module-level singletons (contextOptimizer, tokenBudget), core module isolation (src/core/context/), sections-based prompt assembly, read-only stable flags (D-14)]

key-files:
  created:
    - src/core/context/ModelContextTier.ts
    - src/core/context/TokenBudget.ts
    - src/core/context/ContextProvenanceManifest.ts
    - src/core/context/ContextOptimizer.ts
    - src/core/ai/AgentTurnInput.ts
    - tests/core/context/ContextOptimizer.test.ts
  modified:
    - src/core/ai/types.ts
    - src/core/ai/PipelineError.ts
    - src/core/ai/AgentOrchestrator.ts
    - src/core/ai/PlannerService.ts
    - src/core/ai/RendererService.ts
    - tests/core/ai/tracer.test.ts
    - tests/core/ai/AgentOrchestrator.test.ts
    - tests/core/ai/integration.test.ts
    - tests/core/ai/PlannerService.test.ts

key-decisions:
  - "§2.2 section allocations computed against modelContextWindow (must_have/test contract), not inputBudget as the action text said — Test 4/tiny-4000 values pin this"
  - "Over-budget: trim USER_INPUT from start to fit; throw CONTEXT_TOO_LARGE when trimming empties the user input entirely"
  - "Tool execution in orchestrator builds RegisteredTool stubs from AgentTurnInput.selectedToolSchemas (preserves jsonSchema); AI-facing content flows only via OptimizedContext"
  - "Deferred requirements mark-complete for CTX-01/CTX-02 — both span later phase plans (04-02 degradation, 04-03 cache); marking now would falsify traceability"

patterns-established:
  - "ContextOptimizer is a first-class pipeline stage invoked once per turn (D-01/D-02) — AgentOrchestrator.runTurn() calls optimize() before the planner loop"
  - "PlannerService/RendererService consume OptimizedContext.sections[] exclusively — named-field access replaced by kind-keyed extraction"
  - "stable flag is read-only metadata set during assembly only (D-14); provenance entries record one per distinct sourceId (D-17, D-18)"

requirements-completed: []  # CTX-01/CTX-02 span Plans 04-02/04-03; marked complete at phase end

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "ModelContextTier.classifyModelContext returns correct tier at all §2.1 boundaries (4096→tiny, 4097/16384→small, 131072→medium, 200000→large); KNOWN_MODEL_WINDOWS shipped"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#ModelContextTier classifies model context windows at boundary values"
        status: pass
    human_judgment: false
  - id: D2
    description: "TokenBudget.estimateTokens handles English (/4), CJK >50% (/3), mixed <50% (/4), empty (0); allocateBudget returns exact §2.2 allocations for all 4 tiers with 70/20/10 input/output/safety split"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#TokenBudget"
        status: pass
    human_judgment: false
  - id: D3
    description: "ContextOptimizer.optimize() produces a valid OptimizedContext (tier, inputBudget, outputBudget, 7 canonical-order sections, provenance manifest, minimalMode); stable=true on system/tool_schemas/preferences, false on user_input/memory/context; provenance records one entry per sourceId with matching tokens; under-budget assembly unchanged with no truncation; over-budget trims user input from start and marks provenance truncated; CONTEXT_TOO_LARGE thrown when input cannot fit"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#ContextOptimizer"
        status: pass
    human_judgment: false
  - id: D4
    description: "End-to-end tracer: AgentTurnInput flows through AgentOrchestrator.runTurn(), which invokes ContextOptimizer.optimize() once and passes OptimizedContext to PlannerService.plan() and RendererService.synthesize(); pipeline connects without type errors and returns a rendered response"
    requirement: CTX-01
    verification:
      - kind: integration
        ref: "tests/core/context/ContextOptimizer.test.ts#Tracer end-to-end"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-31
status: complete
---

# Phase 04 Plan 01: Context Optimization Tracer Summary

**ContextOptimizer pipeline stage (tier classification → 70/20/10 token budgeting → canonical section assembly → provenance manifest) wired into AgentOrchestrator as the single turn-entry contract, with AgentTurnInput replacing PlannerContext and PlannerService/RendererService consuming OptimizedContext.sections[]**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-31T11:40:26Z
- **Completed:** 2026-07-31T11:46:00Z
- **Tasks:** 1 (tracer, TDD: RED + GREEN commits)
- **Files modified:** 15 (5 created, 6 src modified, 4 tests migrated)

## Accomplishments
- ModelContextTier classification with exact §2.1 boundaries + KNOWN_MODEL_WINDOWS lookup table (12 models)
- TokenBudget service: CJK-aware character estimation (D-10), §2.2 per-tier allocation table (D-11), native-counter orchestration path (D-09) — no inline counting anywhere else
- ContextProvenanceManifest with source-level entries (D-17), dot-separated sourceId validation (D-18, T-04-03)
- ContextOptimizer.optimize(): Zod-validated input (T-04-02/T-04-04), assemble → budget check → user-input trim from start → CONTEXT_TOO_LARGE terminal error, minimalMode for tiny tier
- AgentOrchestrator.runTurn(AgentTurnInput) invokes optimize() before the planner loop and operates on OptimizedContext throughout (D-01/D-02)
- PlannerService.plan() and RendererService.synthesize()/stream() extract content from sections[] (D-04)
- PipelineError.CONTEXT_TOO_LARGE registered as terminal (not retryable)
- 13 tracer tests green; zero tsc errors in all touched files

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer (TDD RED)** - `5dfab33` (test: add failing tracer tests for context optimization pipeline)
2. **Task 1: Tracer (TDD GREEN)** - `af9ffda` (feat: implement context optimization tracer slice)

**Plan metadata:** (final commit, after SUMMARY)

_Note: single TDD task — RED commit contains the failing test file; GREEN commit contains implementation + downstream test migration._

## Files Created/Modified
- `src/core/context/ModelContextTier.ts` - classifyModelContext() + KNOWN_MODEL_WINDOWS
- `src/core/context/TokenBudget.ts` - TokenBudget class (estimateTokens, allocateBudget, estimateTokensFromNative) + singleton
- `src/core/context/ContextProvenanceManifest.ts` - createProvenanceManifest, recordSection, markTruncated, markCompression + sourceId validation
- `src/core/context/ContextOptimizer.ts` - ContextOptimizer.optimize() pipeline + Zod input schema + singleton
- `src/core/ai/AgentTurnInput.ts` - AgentTurnInput re-export + createAgentTurnInput factory
- `src/core/ai/types.ts` - ModelContextTier, PromptSection, ContextProvenanceEntry/Manifest, OptimizedContext, ContextOptimizerInput, ToolSchemaInfo, AgentTurnInput, CONTEXT_TOO_LARGE
- `src/core/ai/PipelineError.ts` - CODE_CATEGORY: CONTEXT_TOO_LARGE → terminal
- `src/core/ai/AgentOrchestrator.ts` - runTurn(AgentTurnInput) with internal optimize() call
- `src/core/ai/PlannerService.ts` - plan(adapter, tier, OptimizedContext)
- `src/core/ai/RendererService.ts` - synthesize()/stream() accept OptimizedContext
- `tests/core/context/ContextOptimizer.test.ts` - 13 tracer tests
- `tests/core/ai/{tracer,AgentOrchestrator,integration,PlannerService}.test.ts` - migrated to new signatures

## Decisions Made
- **§2.2 allocation base:** must_have truths + Test 4 (tiny/4000 → system 600) pin section caps to `floor(modelContextWindow × ratio)`; the action text's `floor(inputBudget × ratio)` contradicted the must_have contract — followed must_have/tests (verifier-enforced)
- **Over-budget behavior:** trim USER_INPUT from the start (keep most-recent content); if trimming empties the user input while total still cannot fit, throw CONTEXT_TOO_LARGE (degradation pipeline deferred to Plan 04-02)
- **Orchestrator tool stubs:** RegisteredTool stubs built from AgentTurnInput.selectedToolSchemas (keeps jsonSchema for ExecutorService validation); AI-facing content flows through OptimizedContext only
- **requirements mark-complete deferred:** CTX-01/CTX-02 are also referenced by Plans 04-02 (degradation) and 04-03 (cache transformation); marking them complete here would falsify the traceability table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated 4 existing AI test files to new runTurn()/plan() signatures**
- **Found during:** Task 1 (GREEN implementation)
- **Issue:** Changing `runTurn(providerId, tier, context)` → `runTurn(input: AgentTurnInput)` and `plan(adapter, tier, PlannerContext)` → `plan(adapter, tier, OptimizedContext)` breaks tracer.test.ts, AgentOrchestrator.test.ts, integration.test.ts, PlannerService.test.ts — all type-checked by project-wide `tsc --noEmit` and run by `vitest run`
- **Fix:** Migrated each test to createAgentTurnInput()-based inputs / buildMockOptimizedContext(); run_tool tests now pass tool schemas via selectedToolSchemas; integration test keeps real ExecutorService validation path
- **Files modified:** tests/core/ai/tracer.test.ts, AgentOrchestrator.test.ts, integration.test.ts, PlannerService.test.ts
- **Verification:** all migrated tests pass (84 passing in tests/core/ai)
- **Committed in:** af9ffda (GREEN commit)

**2. [Rule 2 - Security] Threat-model mitigations implemented**
- **Found during:** Task 1 (ContextOptimizer/TokenBudget implementation)
- **Issue:** Threat register (T-04-01/02/03/04/06, disposition "mitigate") requires input validation, sourceId validation, and budget guards not described in the action text
- **Fix:** Zod ContextOptimizerInput schema (positive int window, userInput ≤100K chars, non-empty IDs); sourceId pattern check in recordSection (rejects `..`, `/`, `\`); allocateBudget zero-budget guard for invalid tier/non-positive window; estimateTokens returns 0 for empty/malformed input
- **Files modified:** src/core/context/ContextOptimizer.ts, ContextProvenanceManifest.ts, TokenBudget.ts
- **Verification:** all 13 tracer tests pass; invalid-input paths covered by unit tests
- **Committed in:** af9ffda (GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 security/correctness)
**Impact on plan:** All auto-fixes necessary for correctness and the threat model. No scope creep. The §2.2 allocation-base inconsistency was resolved in favor of the must_have/test contract (see Decisions Made).

## Issues Encountered
- **Plan-internal inconsistency (§2.2):** action text says `floor(inputBudget × ratio)` but must_have truth + Test 4/Test 3 specify window-based values. Resolved per the must_have/test contract — the verifier enforces those values.
- **Bare `tsc <files>` acceptance command:** `pnpm exec tsc --noEmit <9 files>` without project flags trips on node_modules .d.ts (missing skipLibCheck/esModuleInterop). Re-run with project compiler flags: zero errors in all 9 listed files.
- **Pre-existing failures (out of scope, logged to deferred-items.md):** 9 tsc errors in src/core/storage/ (Phase 2, TS 5.8 lib typing drift); 6 pre-existing test failures in tests/core/ai (StreamAdapter ×2, ProviderAdapter ×4 — AI SDK v7 mock shape drift). Unrelated to Phase 4; reproduce without this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- **Plan 04-02 (degradation pipeline):** ContextOptimizer.optimize() now owns assembly + budget check with a clean throw/trim seam where ContextCompressor degradation steps plug in (drop debug → drop secondary → summarise history → compress page → trim tools → reduce memory → minimal mode); provenance helpers markTruncated/markCompression ready
- **Plan 04-03 (cache management):** stable flags set during assembly per D-14 (system/tool_schemas/preferences stable); PromptCacheManager slots into optimize() after provenance; contextOptimizer singleton is the extension point
- **Callers:** any UI (Phase 7) calling runTurn must switch from `(providerId, tier, context)` to `(AgentTurnInput)` — createAgentTurnInput factory provides defaults
- **Known intentional placeholders:** task section (`core.task.placeholder`) empty; renderer history assembly deferred; pageContext/memoryHints no-op when absent (D-05)

## Self-Check: PASSED

- All 6 created source/test files exist on disk (verified above)
- RED commit `5dfab33` exists; GREEN commit `af9ffda` exists
- `npx vitest run tests/core/context/ContextOptimizer.test.ts` → 13/13 pass (run after GREEN)
- Project `tsc --noEmit`: 0 errors in all touched files (9 pre-existing src/core/storage/ errors documented in deferred-items.md)

---
*Phase: 04-context-optimization-pipeline*
*Completed: 2026-07-31*
