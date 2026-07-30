---
phase: 03-ai-core-pipeline
plan: 01
subsystem: ai
tags: [ai-sdk, zod, openai, pipeline, provider-adapter, tracer]
requires:
  - phase: 02
    provides: ApiKeyStore, CryptoService
provides:
  - Shared AI pipeline types (PipelineErrorCode, PlannerDecision, StreamEvent, PlannerContext, RegisteredTool, ModelTier)
  - ProviderAdapter interface with OpenAI implementation
  - ProviderRouter, TierResolver, PlannerService, ExecutorService, RendererService, AgentOrchestrator
  - Tracer test proving end-to-end prompt -> plan -> render cycle
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07]
tech-stack:
  added: [ai@^7.0.42, zod@^4.4.3, @ai-sdk/openai@^4.0.24, @ai-sdk/anthropic@^4.0.24, @ai-sdk/google@^4.0.28, ollama-ai-provider@^1.2.0]
  patterns: [ProviderAdapter interface, AgentOrchestrator single-turn loop, Output.object structured output]
key-files:
  created:
    - src/core/ai/types.ts
    - src/core/ai/PipelineError.ts
    - src/core/ai/providers/ProviderAdapter.ts
    - src/core/ai/providers/openai.ts
    - src/core/ai/ProviderRouter.ts
    - src/core/ai/TierResolver.ts
    - src/core/ai/PlannerService.ts
    - src/core/ai/ExecutorService.ts
    - src/core/ai/RendererService.ts
    - src/core/ai/AgentOrchestrator.ts
    - tests/core/ai/tracer.test.ts
key-decisions:
  - "D-01: Use @ai-sdk/* v4 adapters, not a full ILLMProvider interface"
  - "D-02: ProviderAdapter pattern for provider-specific concerns only; ProviderRouter above for routing/circuit-breaker"
  - "D-05: Three-branch PlannerDecision discriminated union (answer/run_tool/ask_clarification)"
  - "D-10: Structured PipelineError codes — not a deep class hierarchy"
patterns-established:
  - "ProviderAdapter: per-provider interface for model resolution, connection validation, capability detection"
  - "PipelineError: structured error with code, category, retryable flag, userFacingMessage, diagnostic"
  - "AgentOrchestrator single-turn loop: select provider -> plan -> route by decision type"
requirements-completed: [AI-01, AI-02]
coverage:
  - id: D1
    description: Shared pipeline types — PipelineErrorCode, PlannerDecision, StreamEvent, PlannerContext, RegisteredTool, ModelTier, TIER_CAPS
    requirement: AI-02
    verification:
      - kind: unit
        ref: tests/core/ai/tracer.test.ts#Pipeline Tracer
        status: pass
    human_judgment: false
  - id: D2
    description: ProviderAdapter interface with OpenAI adapter — createLanguageModel, supportsStructuredOutput, validateConnection, getDefaultModelForTier, getCacheStrategy, getTelemetryMetadata
    requirement: AI-01
    verification:
      - kind: unit
        ref: tests/core/ai/tracer.test.ts#Pipeline Tracer
        status: pass
    human_judgment: false
  - id: D3
    description: Tracer test proves end-to-end pipeline: prompt -> PlannerService.plan() -> answer decision -> RendererService.synthesize() -> response text
    requirement: AI-02
    verification:
      - kind: unit
        ref: tests/core/ai/tracer.test.ts#full prompt plan render cycle
        status: pass
    human_judgment: false
duration: 4min
completed: 2026-07-30
status: complete
---

# Phase 03 Plan 01: AI Pipeline Tracer Slice Summary

**AI SDK dependencies installed, shared pipeline types defined, OpenAI ProviderAdapter, ProviderRouter, TierResolver, PlannerService, ExecutorService, RendererService, and AgentOrchestrator — verified by 3 passing tracer tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-30T02:16:35Z
- **Completed:** 2026-07-30T02:20:48Z
- **Tasks:** 1 (tracer)
- **Files modified:** 14

## Accomplishments

- Installed `ai@^7.0.42`, `zod@^4.4.3`, `@ai-sdk/*@^4.0.24`, `ollama-ai-provider@^1.2.0`
- Created all shared pipeline types (PipelineProviderId, ModelTier, PlannerDecision, StreamEvent, etc.)
- Created PipelineError with structured error codes and retryable/terminal categorization
- Created ProviderAdapter interface with full OpenAI adapter implementation
- Created ProviderRouter with OpenAI single-provider path (other providers return error)
- Created TierResolver for deterministic tier-to-model mapping
- Created PlannerService using `Output.object()` for structured JSON output (not deprecated `generateObject`)
- Created ExecutorService stub with tool name and input validation
- Created RendererService.synthesize() for non-streaming answer generation
- Created AgentOrchestrator.runTurn() with single-turn Planner->Renderer loop
- Created tracer test with 3 passing tests covering full pipeline, answer decision, and unknown provider error

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies + define core types + create OpenAI adapter + wire pipeline + tracer test** - `019c64d` (feat(03-01))

## Files Created/Modified

- `package.json` - Added ai@^7.0.42, zod@^4.4.3, @ai-sdk/*, ollama-ai-provider
- `pnpm-lock.yaml` - Updated lockfile
- `src/core/ai/types.ts` - All shared pipeline types (PipelineProviderId, ModelTier, PipelineErrorCode, PlannerDecision, StreamEvent, PlannerContext, RegisteredTool, TIER_CAPS)
- `src/core/ai/PipelineError.ts` - Structured error class with code/category/retryable/userFacingMessage/diagnostic
- `src/core/ai/providers/ProviderAdapter.ts` - Adapter interface (createLanguageModel, validateConnection, supportsStructuredOutput, etc.)
- `src/core/ai/providers/openai.ts` - OpenAI adapter using @ai-sdk/openai with tier model mapping
- `src/core/ai/ProviderRouter.ts` - Single-provider routing, reads API keys from ApiKeyStore
- `src/core/ai/TierResolver.ts` - Deterministic tier-to-model mapping + tier cap access
- `src/core/ai/PlannerService.ts` - Answer-only path using generateText + Output.object()
- `src/core/ai/ExecutorService.ts` - Tool name validation, input validation, execution stub
- `src/core/ai/RendererService.ts` - synthesize() path for non-streaming answer generation
- `src/core/ai/AgentOrchestrator.ts` - Single-turn loop: select provider -> plan -> route by decision type
- `tests/core/ai/tracer.test.ts` - 3 tests covering full pipeline, answer decision, and unknown provider error

## Decisions Made

- D-01: Use `@ai-sdk/*` v4 adapters (NOT direct fetch, NOT ILLMProvider) — minimal wrapper over AI SDK
- D-02: ProviderAdapter pattern for provider-specific concerns only; ProviderRouter handles routing/circuit-breaker
- D-05: Three-branch PlannerDecision discriminated union for exhaustive coverage
- D-10: Structured PipelineError codes — standard error taxonomy across all pipeline services
- CSP already included `http://localhost:*` in connect-src — no change needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in `src/core/storage/` (ApiKeyStore, CryptoService, MigrationRunner, WriteJournal) from Phase 2 block `tsc --noEmit`. Our source files compile cleanly.

## Next Phase Readiness

- Foundation for Plan 03-02 (additional provider adapters) is laid
- Foundation for Plan 03-03 (full ProviderRouter with fallback/circuit-breaker) is laid
- Foundation for Plan 03-05 (PersonaInjector) is laid
- Foundation for Plan 03-06 (StreamAdapter/ChunkBuffer) is laid

---

*Phase: 03-ai-core-pipeline*
*Completed: 2026-07-30*
