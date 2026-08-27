---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 01
subsystem: ai-runtime
tags: [sse, stream-adapter, structured-output, zod, zod-to-json-schema, planner, tracer]

# Dependency graph
requires:
  - phase: 02
    provides: Requester (canonical codes RATE_LIMITED/TIMEOUT/NETWORK), OperationId, NP-STRICT ceiling 0
provides:
  - src/core/ai/types.ts spine (ProviderId, ModelTier, PlannerDecisionSchema, StreamEvent union D-47, PromptSection A8, ToolExecutionResult, RouterAttemptState)
  - ILLMProvider interface (stream → canonical events; requestJson JSON-mode) replacing the retired onChunk/onDone surface
  - REQ-R09 SSE rebuild: incremental TextDecoder({stream:true}) line buffer + OpenAI wire adapter, missing terminator = STREAM_ERROR
  - Appendix L StructuredOutput.requestJson (zodToJsonSchema + exactly one repair + terminal STRUCTURED_OUTPUT_FAILED)
  - §1.2 PlannerService with zero-tool runtime schema specialization (closed toolName enum)
  - Canonical Appendix A PROMPTS verbatim (repairJson.system replaced from non-canonical stub)
  - D-48 fixture library seed + 20 passing tests across 3 files
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, Phase 5 ContextOptimizer]

actuals:
  tokens: 9515     # chars/4 over the 10 files created/modified (38,061 chars)
  tasks: 3         # tasks completed
  commits: 3       # commits made

# Tech tracking
tech-stack:
  added: [zod-to-json-schema 3.25.2]
  patterns: [incremental SSE line-buffer parsing, zod-validated cross-boundary shapes, one-shot JSON repair loop, zero-tool schema specialization]

key-files:
  created:
    - src/core/ai/types.ts
    - src/core/ai/ILLMProvider.ts
    - src/core/ai/StreamAdapter.ts
    - src/core/ai/StructuredOutput.ts
    - src/core/ai/PlannerService.ts
    - tests/core/ai/PlannerService.test.ts
    - tests/core/ai/StructuredOutput.test.ts
    - tests/core/ai/fixtures/openai-stream.ts
    - tests/core/ai/fixtures/FixtureProvider.ts
  modified:
    - src/core/prompts/index.ts
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Zod v4 adaptation: Appendix L's `z.ZodSchema<T>` type name becomes `z.ZodType<T>` (v4 renames the class); zod-to-json-schema 3.25.2 typed bridge via Parameters<typeof zodToJsonSchema>[0] — no suppression markers"
  - "Zero-tool runtime specialization: buildPlannerDecisionSchema([]) emits answer|ask_clarification only — never z.enum([]), never unrestricted production toolName; base run_tool variant preserved for later tool-owning phases"
  - "STREAM_ERROR carries canonical §21.6 code 'NETWORK' for missing terminator (REQ-R09) — no invented codes (D-38)"

patterns-established:
  - "Cross-boundary shapes are zod-validated (StreamEventSchema, PlannerDecisionSchema, PromptSectionSchema) per CLAUDE.md"
  - "Per-provider wire adapters share one incremental TextDecoder({stream:true}) line buffer — Anthropic/Gemini/Ollama extend this in 03-03"
  - "Fixtures replay real wire bytes through the actual adapter (never a mocked parser)"

requirements-completed: [RICH-R-10]

coverage:
  - id: D1
    description: "PlannerService returns a zod-validated PlannerDecision parsed from real OpenAI SSE wire bytes through StreamAdapter → FixtureProvider → StructuredOutput.requestJson"
    requirement: "RICH-R-10"
    verification:
      - kind: unit
        ref: "tests/core/ai/PlannerService.test.ts#happy path: fixture wire bytes → zod-validated answer decision"
        status: pass
      - kind: unit
        ref: "tests/core/ai/PlannerService.test.ts#malformed decision is repaired exactly once via PROMPTS.repairJson.system"
        status: pass
      - kind: unit
        ref: "tests/core/ai/PlannerService.test.ts#missing terminator → STREAM_ERROR surfaces (REQ-R09)"
        status: pass
    human_judgment: false
  - id: D2
    description: "StructuredOutput one-shot repair loop per Appendix L — valid passes with no repair, malformed repaired exactly once, double failure terminal with retryable false, abort propagates"
    verification:
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.test.ts#(a) valid JSON first attempt passes through with NO repair"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.test.ts#(b) malformed JSON is repaired exactly once"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.test.ts#(c) double failure is terminal — STRUCTURED_OUTPUT_FAILED with retryable false"
        status: pass
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.test.ts#(d) caller abort mid-attempt surfaces a typed failure without hanging"
        status: pass
    human_judgment: false
  - id: D3
    description: "Canonical Appendix A prompts land verbatim in src/core/prompts/index.ts — persona-free, byte-stable; repairJson.system replaced from the non-canonical stub"
    verification:
      - kind: unit
        ref: "tests/core/ai/PlannerService.test.ts#canonical prompt is the Appendix A planner system string (persona-free)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero-tool runtime schema specialization — empty tool list produces no run_tool variant; non-empty list closes toolName via z.enum"
    verification:
      - kind: unit
        ref: "tests/core/ai/PlannerService.test.ts#zero-tool runtime: production schema has NO run_tool variant"
        status: pass
      - kind: unit
        ref: "tests/core/ai/PlannerService.test.ts#closed toolName enum when tools are registered"
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-08-27
status: complete
---

# Phase 3 Plan 1: AI-Runtime Tracer Slice Summary

**End-to-end planner path proven with production quality: real OpenAI SSE wire bytes → incremental StreamAdapter → ILLMProvider fixture → Appendix L one-shot JSON repair → zod-validated PlannerDecision, with canonical Appendix A prompts and the zero-tool closed-enum schema contract**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-27T20:36:25Z
- **Completed:** 2026-08-27T20:50:12Z
- **Tasks:** 3 (1 chore, 1 tracer, 1 test)
- **Files modified:** 12 (10 created/rewritten, package.json + pnpm-lock.yaml)

## Accomplishments
- **REQ-R09 SSE rebuild proven:** the confirmed-drift risk (legacy parser returns empty text on real providers — it reads only proxy `textChunk`/`thoughtChunk`) is replaced by an incremental `TextDecoder({stream:true})` line buffer with an OpenAI wire adapter. Missing terminator → STREAM_ERROR. Tested with real wire-byte fixtures including CRLF endings and delta-split accumulation.
- **Appendix L structured-output loop proven:** `requestJson` converts Zod → JSON Schema via zod-to-json-schema 3.25.2 (not Zod 4 native), repairs malformed JSON **exactly once** via the canonical `PROMPTS.repairJson.system`, and throws terminal `STRUCTURED_OUTPUT_FAILED` (`retryable: false`) on a second failure. All four contract cases tested.
- **Zero-tool planner contract:** `buildPlannerDecisionSchema` never constructs `z.enum([])` and never leaves `toolName` as an unrestricted production string — empty tool list yields answer|ask_clarification only; a registered list closes the enum.
- **Canonical Appendix A prompts land verbatim** (planner/renderer/memoryExtractor/conversationSummarizer/repairJson + the full appendix) — persona-free and byte-stable, replacing the non-canonical 4-line stub. Persona prepending is deferred to the D-59 choke-point (plan 03-04).
- **D-48 fixture library seeded** with the golden-matrix subset (valid/malformed/repair-success/repair-failure/missing-terminator/CRLF/split streams) replayed through the real adapter.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave-0 toolchain — zod-to-json-schema install + baseline gate** - `f20e2fb` (chore)
2. **Task 2: End-to-end planner slice — wire bytes to PlannerDecision** - `ad1bce6` (feat, tracer)
3. **Task 3: Structured-output edge tests + D-48 fixture matrix** - `8a8ba23` (test)

**Plan metadata:** `pending` (committed with this SUMMARY)

## Files Created/Modified
- `src/core/ai/types.ts` - Spine: ProviderId (D-56, incl. openai-compat), ModelTier, §1.2 PlannerDecisionSchema verbatim, D-47 StreamEvent union, A8 PromptSection `{kind,text,stable,tokens}`, ToolExecutionResult, RouterAttemptState
- `src/core/ai/ILLMProvider.ts` - `stream(request, signal)` → canonical-event async iterable; `requestJson(prompt, jsonSchema, signal)`; legacy onChunk/onDone retired (D-47)
- `src/core/ai/StreamAdapter.ts` - REQ-R09 incremental line-buffer parser + `parseOpenAIStream` wire adapter; `[DONE]` terminator; missing terminator → STREAM_ERROR
- `src/core/ai/StructuredOutput.ts` - Appendix L verbatim: zodToJsonSchema + exactly-one repair + terminal `STRUCTURED_OUTPUT_FAILED` (retryable false, raw{first,second})
- `src/core/ai/PlannerService.ts` - §1.2 planner: 3s timeout, decision via requestJson, closed toolName enum, zero-tool schema specialization
- `src/core/prompts/index.ts` - Canonical Appendix A PROMPTS verbatim (was a 4-line non-canonical stub)
- `tests/core/ai/PlannerService.test.ts` - 8 tests: happy/CRLF/split/repair-once/STREAM_ERROR/zero-tool/closed-enum/canonical-prompt
- `tests/core/ai/StructuredOutput.test.ts` - 4 tests: no-repair/one-repair/terminal/abort
- `tests/core/ai/fixtures/openai-stream.ts` - D-48 golden matrix seed (7 fixture streams)
- `tests/core/ai/fixtures/FixtureProvider.ts` - scripted ILLMProvider replaying wire bytes through the real adapter
- `package.json` + `pnpm-lock.yaml` - zod-to-json-schema 3.25.2 pinned (only new dependency)

## Decisions Made
- **Zod v4 type adaptation:** Appendix L's `z.ZodSchema<T>` (zod v3 name) is expressed as `z.ZodType<T>` (v4); zod-to-json-schema 3.25.2's v3-typed parameter is bridged via `Parameters<typeof zodToJsonSchema>[0]` — strict-clean with zero suppression markers (NP-STRICT ceiling 0 held).
- **Zero-tool runtime specialization (plan header):** production planner schema drops `run_tool` entirely when no tools are registered; the base three-variant schema remains available for Executor contract tests and later tool-owning phases.
- **STREAM_ERROR code:** missing terminator surfaces with canonical `NETWORK` (§21.6 closed set) — no invented codes (D-38).

## Deviations from Plan

### Environment Drift (not a code deviation)

**1. [Environment] node_modules + zod-to-json-schema already present at Task 1**
- **Found during:** Task 1 (Wave-0 toolchain)
- **Issue:** The plan (and RESEARCH.md Environment Availability) asserted node_modules was ABSENT and zod-to-json-schema was not installed. On execution, node_modules existed and `zod-to-json-schema@3.25.2` was already pinned in package.json + pnpm-lock.yaml as uncommitted working-tree changes.
- **Fix:** Ran `pnpm install` to reconcile (no-op), verified the dep resolves, ran `pnpm run verify:phase-3` (green baseline, 8 pre-existing testProviderConnection tests pass), and committed the existing package.json/pnpm-lock.yaml changes as the Task 1 commit. No source files were modified in Task 1, per plan.
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** `pnpm run verify:phase-3` exits 0; `require('zod-to-json-schema')` resolves
- **Committed in:** f20e2fb (Task 1 commit)

**2. [Rule 3 - Blocking] zod-to-json-schema v3-typed parameter vs zod v4 schemas**
- **Found during:** Task 2 (StructuredOutput.ts)
- **Issue:** `zodToJsonSchema(schema)` type-errors — the package's declarations import `ZodSchema` from `zod/v3` while the code passes zod v4 `ZodType` instances.
- **Fix:** Bridged through the declared parameter type: `schema as unknown as Parameters<typeof zodToJsonSchema>[0]`. Runtime is compatible (peerDeps `zod ^3.25.28 || ^4`; smoke-tested discriminated unions). No suppression markers — NP-STRICT ceiling 0 held.
- **Files modified:** src/core/ai/StructuredOutput.ts
- **Verification:** tsc clean; all 20 tests pass
- **Committed in:** ad1bce6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3), 1 environment drift documented
**Impact on plan:** Both were required for correctness. No scope creep; the zero-tool schema contract and REQ-R09 rebuild were implemented exactly as planned.

## Issues Encountered
- Test (b) initially used the answer-only `TestSchema` against a repair-success fixture returning `ask_clarification` — fixed by asserting against the real `PlannerDecisionSchema` (the schema the production planner actually uses). Resolved within the task.

## TDD Gate Compliance
Not a TDD plan (`type: execute`); task-level verification gates ran after every commit.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Ready for 03-02:** persona seed (PersonaProfile/DEFAULT_PERSONA, PersonaInjector, UserPreferences) — the A8 `PromptSection` shape and ProviderId/Tier types it consumes now exist.
- **Ready for 03-03:** provider implementations — the `ILLMProvider` interface, `createStreamAdapter`/`parseOpenAIStream` extension points, and D-48 fixture conventions are in place for Anthropic/Gemini/Ollama adapters.
- **Ready for 03-04:** ExecutorService can supply the closed toolName enum consumed by `buildPlannerDecisionSchema`; PromptCacheManager builds on the A8 sections + canonical PROMPTS.
- **Watch item:** verified gate `pnpm run verify:phase-3` covers `tests/core/ai` + `tests/core/ai/persona` — new test dirs must stay within those paths.

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-27*

## Self-Check: PASSED

- All 11 files exist on disk (10 code/test files + SUMMARY.md)
- All 3 task commits found in git log: f20e2fb, ad1bce6, 8a8ba23
- `pnpm run verify:phase-3` green (tsc clean + 20 tests across 3 files)
- No strict-suppression markers in src/core/ai (NP-STRICT ceiling 0)