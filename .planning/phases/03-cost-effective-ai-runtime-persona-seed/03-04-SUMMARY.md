---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 04
subsystem: ai-runtime
tags: [structured-output, zod, one-repair, planner, executor, tool-rejected, f-4, typescript]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: 03-01 canonical type homes (PromptSection/OptimizedContext/ProviderId at src/core/ai/types.ts, C.2 codes incl. STRUCTURED_OUTPUT_FAILED/TOOL_REJECTED), 03-02 ProviderRegistry (getProviderInfos, apiKey-stripped), 03-03 toolSchemas (GET_PROVIDER_INFO_TOOL/buildToolNameEnum/registeredToolNames) + tests/fixtures/optimizedContext.ts
provides:
  - src/core/ai/StructuredOutput.ts — Appendix L VERBATIM requestJson with the F-4 sections-in signature (PromptSection[] threaded, never a joined string); exactly ONE byte-stable repair (cached sections preserved, repair appended as a user_input PromptSection with PROMPTS.repairJson.system + 'Schema: …' + 'Broken: …' verbatim); STRUCTURED_OUTPUT_FAILED {retryable:false, raw:{first,second}} + isStructuredOutputFailed() guard; per-attempt AbortController timeout + outer-abort re-parenting
  - src/core/ai/PlannerService.ts — buildPlannerDecisionSchema (closed §1.2 discriminatedUnion; run_tool branch OMITTED when buildToolNameEnum → null, D-05), PlannerDecision, PlanInput (carries the OptimizedContext), pure plan() — never imports ProviderRouter, never joins a prompt (Golden Rule 3, D-19)
  - src/core/ai/ExecutorService.ts — deterministic execute(): closed-enum TOOL_REJECTED gate (D-05, T-03-04-03) + dangerous-flag + input-schema gates; get-provider-info reads the vault-safe ProviderRegistry snapshot; ToolExecutionResult with durationMs; no SDK tool machinery (R-4)
  - tests/core/ai/{StructuredOutput,PlannerService,ExecutorService}.test.ts — 19 new cases (60 test:ai total)
affects: [03-05 ProviderRouter (constructs callProviderJsonMode — the F-4 callback these services consume), 03-06 RendererService (requestJson for cards/tables), 03-07 PersonaInjector (byte-stability now hash-assertable end-to-end), 03-08 AgentOrchestrator (PlannerService.plan + ExecutorService.execute call sites), phase 4 (ContextOptimizer must keep the sections-in contract)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "F-4 sections-in seam: requestJson + callProviderJsonMode take PromptSection[]; cached kinds (system/tool_schemas/preferences/memory) map to provider `system`, task kinds (context/task/user_input) to `prompt` — owned by the Router closure (03-05); consumers never join or split strings (no prompt.split code path, grep-asserted)"
    - "One-repair structured output (Golden Rule 4 / D-19): first safeParse fail → keep cached sections byte-stable + append one user_input repair section → second fail → STRUCTURED_OUTPUT_FAILED {retryable:false, raw:{first,second}} — never a third attempt, never hand-parsed JSON"
    - "D-05 closed tool boundary: buildToolNameEnum null-for-empty drives BOTH the planner (run_tool branch omitted → stray run_tool fails the schema) and the executor (closed-enum gate → TOOL_REJECTED); invented tool names can never reach a run (R-4)"

key-files:
  created:
    - src/core/ai/StructuredOutput.ts
    - src/core/ai/PlannerService.ts
    - src/core/ai/ExecutorService.ts
    - tests/core/ai/StructuredOutput.test.ts
    - tests/core/ai/PlannerService.test.ts
    - tests/core/ai/ExecutorService.test.ts
  modified: []

key-decisions:
  - "F-4 ripple applied at the boundary: requestJson threads context.sections unchanged and the one-repair appends a task-kind (user_input) repair section — the cached [SYSTEM] text stays byte-identical across attempt 1 and the repair (hash-equality proven via hashStableSections), so the provider prompt cache is never silently drifted (T-03-04-02)"
  - "PlannerService stays pure (D-19): PlanInput carries the OptimizedContext + the Router-constructed callProviderJsonMode (providerId/model/timeoutMs); plan() builds ctx and calls requestJson(schema, context.sections, ctx) — no ProviderRouter import, no prompt assembly (Golden Rule 3); userInput is carried for the Appendix-I call shape but never joined"
  - "ExecutorService is deterministic (R-4): the closed z.enum via buildToolNameEnum is the single accept gate; TOOL_REJECTED covers unknown tools, the dangerous-flag gate (nothing dangerous ships in Phase 3, D-04), and the input-schema gate (get-provider-info's empty-object schema rejects any payload) — the 13-code Phase-3 C.2 block stays closed (no new code invented, 03-01 decision)"
  - "The ask_clarification branch keeps the spec's .default([]) — its INPUT shape (options optional) differs from OUTPUT (options required), so plan() casts the requestJson result to PlannerDecision exactly as Appendix I casts (decision as any) — the schema itself remains the spec-verbatim discriminatedUnion"
  - "AI-02 checkbox stays PENDING in REQUIREMENTS.md — this plan ships the Planner + Executor services, but the requirement names the full Planner→Executor→Renderer loop (Renderer = 03-06, Orchestrator = 03-08); marking complete now would repeat the 03-01 mark-complete mistake"

patterns-established:
  - "Appendix L verbatim lands prettier-formatted: the spec's template-literal repairText is reproduced semantically verbatim (system + '\\nSchema: ' + jsonSchema + '\\nBroken: ' + first), then prettier-normalized to pass the repo's prettier --check gate"
  - "Typed failure carriers: isStructuredOutputFailed() + StructuredOutputFailedError mirror the Phase-2 typed-error precedent — canonical code as a field, distinguishable without string matching, raw bodies never logged (R-10)"

requirements-completed: [AI-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "StructuredOutput.requestJson (Appendix L verbatim + F-4 sections-in) — exactly ONE byte-stable repair (cached sections preserved, repair appended as a user_input PromptSection), STRUCTURED_OUTPUT_FAILED {retryable:false, raw:{first,second}} + isStructuredOutputFailed() guard, per-attempt timeoutMs + outer-abort re-parenting"
    requirement: AI-02
    verification:
      - kind: unit
        ref: "tests/core/ai/StructuredOutput.test.ts#sections-in signature / byte-stable repair (hashStableSections equality) / one-repair-max / failure shape / abort re-parenting (7 tests)"
        status: pass
      - kind: other
        ref: "grep: no `prompt.split(` code path (src/ tests/) — only the spec's own explanatory comments; PromptSection imported from '@/core/ai/types' (line 31)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PlannerService — buildPlannerDecisionSchema (closed §1.2 discriminatedUnion; run_tool branch omitted when zero tools, D-05), PlannerDecision, PlanInput carrying the OptimizedContext, pure plan() threading context.sections into requestJson (never joins a prompt, never imports ProviderRouter)"
    requirement: AI-02
    verification:
      - kind: unit
        ref: "tests/core/ai/PlannerService.test.ts#plan purity + repair cycle + D-05 omission + closed enum + ask_clarification branch (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ExecutorService — deterministic closed-enum TOOL_REJECTED gate (stray run_tool never reaches a run), dangerous-flag + input-schema gates, get-provider-info reads the vault-safe ProviderRegistry snapshot (apiKey stripped, R-10), ToolExecutionResult with durationMs, no SDK tool machinery (R-4)"
    requirement: AI-02
    verification:
      - kind: unit
        ref: "tests/core/ai/ExecutorService.test.ts#TOOL_REJECTED unknown/stray tool + input-schema gate + get-provider-info runs/empty/undefined-input (5 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-08-10
status: complete
---

# Phase 3 Plan 4: Structured Output + Planner + Executor Summary

**The Appendix L `requestJson` one-repair loop (F-4 sections-in signature with a byte-stable cached [SYSTEM] across the repair), the pure PlannerService (`buildPlannerDecisionSchema` with the D-05 run_tool omission + `plan()` threading OptimizedContext.sections), and the deterministic ExecutorService closed-enum gate (TOOL_REJECTED, get-provider-info via ProviderRegistry) — the Zod-validated decision boundary and tool-execution gate the AI-02 loop runs on, all 19 new tests green with the decision-validity and prompt-cache-stability invariants hash-asserted.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-10T07:58:42Z
- **Completed:** 2026-08-10T08:15:00Z
- **Tasks:** 8 (3 service tasks + 3 test tasks + verify + 1 style fix)
- **Files modified:** 6 (3 source created, 3 test files created)

## Accomplishments

- `src/core/ai/StructuredOutput.ts` — Appendix L VERBATIM with the F-4 signature: `requestJson(schema, sections: PromptSection[], ctx)` and `callProviderJsonMode(sections, jsonSchema, signal)` thread the sections through UNCHANGED (the Router closure in 03-05 owns the kind→system/prompt mapping — requestJson never string-splits). On the first safeParse fail the repair keeps the cached [SYSTEM] sections byte-identical and APPENDS a single `{ kind:'user_input', text: PROMPTS.repairJson.system + '\nSchema: ' + JSON.stringify(jsonSchema) + '\nBroken: ' + first, tokens: ceil(len/4), stable:false, sourceId:'structured-output-repair' }` section; a second fail throws the typed `STRUCTURED_OUTPUT_FAILED { retryable:false, raw:{first,second} }` with the `isStructuredOutputFailed()` guard. Per-attempt `AbortController` with `ctx.timeoutMs` re-parents the outer abort (Appendix L). PromptSection imported from `@/core/ai/types'` (P-3/R-1 — the only declaration is types.ts, grep-asserted).
- `src/core/ai/PlannerService.ts` — `buildPlannerDecisionSchema(tools)` builds the §1.2 closed discriminatedUnion: the run_tool branch's toolName is the **closed z.enum** from `buildToolNameEnum` (03-03) and the whole branch is **OMITTED when zero tools are registered** (D-05 — never `z.enum([])`); `PlannerDecision`/`PlanInput` exported; `plan()` stays pure (D-19): it builds the `StructuredOutputContext` from the input (operationId/providerId/model/timeoutMs/callProviderJsonMode/abortSignal) and calls `requestJson(schema, context.sections, ctx)` — **no ProviderRouter import, no prompt joining** (Golden Rule 3). `userInput` is carried for the Appendix-I call shape but never joined (F-4 — the user_input PromptSection is the source).
- `src/core/ai/ExecutorService.ts` — deterministic (R-4): `execute()` validates toolName against the closed z.enum → **TOOL_REJECTED** on unknown (a stray run_tool decision can never reach a run, T-03-04-03); the dangerous-flag gate (nothing dangerous ships, D-04) and the input-schema gate (get-provider-info's `{}` schema rejects any payload) run before the tool; `get-provider-info` (§10.5 row 8) reads the vault-safe `getProviderRegistry().getProviderInfos()` snapshot (apiKey stripped at registration, R-10) and returns a `ToolExecutionResult` with `durationMs`. No SDK `tool()`/`tools`/`maxSteps` machinery.
- Test suites (19 new cases): StructuredOutput (7 — sections-in threading, fence-strip safeParse, byte-stable repair via **hashStableSections hash-equality** across attempt 1 vs the repair, one-repair-max call-count = 2, STRUCTURED_OUTPUT_FAILED shape, timeoutMs abort, outer-abort re-parenting), PlannerService (7 — plan purity/F-4 threading, first-fail→repair→success, second-fail→STRUCTURED_OUTPUT_FAILED, D-05 run_tool omission, closed-enum rejection, ask_clarification + RICH-C-04 chip default), ExecutorService (5 — TOOL_REJECTED unknown + stray, input-schema gate, get-provider-info runs/empty/undefined). `test:ai` 60/60 (7 files), full suite 340/340 (49 files).
- Grep gates (Task 8): no `prompt.split(` code path in src/ or tests/ (the 2 matches are the spec's own explanatory comments documenting the removed anti-pattern); PromptSection import path = `@/core/ai/types'`; no `from '../context/ContextOptimizer'` import anywhere in src/core/ai (1 comment mention only); zero `@ai-sdk` imports outside the Seam-1 switch (unchanged); `PromptSection` declared exactly once (types.ts, R-1).

## Task Commits

Each task was committed atomically:

1. **Tasks 1-3: StructuredOutput.ts (Appendix L + F-4 + repair + abort)** - `420e7f7` (feat)
2. **Task 4: PlannerService.ts** - `af76ac1` (feat)
3. **Task 5: ExecutorService.ts** - `bbcee1b` (feat)
4. **Task 6: StructuredOutput.test.ts** - `76ab62b` (test)
5. **Task 7: PlannerService.test.ts + ExecutorService.test.ts** - `09018b3` (test)
6. **Task 8: Verify** - no commit (verification only)

**Rule-1 fix:** `35a0a89` (style — prettier --check gate flagged StructuredOutput.test.ts after Task 6; formatting-only, suite re-green)

**Plan metadata:** docs commit follows this SUMMARY.

## Files Created/Modified

- `src/core/ai/StructuredOutput.ts` - Appendix L requestJson verbatim + F-4 sections-in signature, one byte-stable repair, isStructuredOutputFailed guard, abort re-parenting
- `src/core/ai/PlannerService.ts` - buildPlannerDecisionSchema (D-05 run_tool omission), PlannerDecision, PlanInput, pure plan()
- `src/core/ai/ExecutorService.ts` - deterministic execute() with closed-enum TOOL_REJECTED gate + get-provider-info
- `tests/core/ai/StructuredOutput.test.ts` - 7 contract tests (sections-in, byte-stability, one-repair-max, failure shape, aborts)
- `tests/core/ai/PlannerService.test.ts` - 7 tests (purity, repair cycle, D-05, closed enum, clarification chips)
- `tests/core/ai/ExecutorService.test.ts` - 5 tests (TOOL_REJECTED, input gate, get-provider-info)

## Decisions Made

- **F-4 sections-in boundary applied at both ends:** `requestJson` and the Seam-2 callback take `PromptSection[]`; the one repair appends a task-kind section instead of rebuilding a joined string — the cached [SYSTEM] is byte-identical attempt-1 vs repair (hash-equality proven), so the provider prompt cache is never silently drifted (T-03-04-02). The Router (03-05) supplies the callback; consumers stay pure.
- **D-05 closed boundary in BOTH planner and executor:** the planner omits run_tool when zero tools are registered (a stray run_tool fails the schema → repair → STRUCTURED_OUTPUT_FAILED at the gate); the executor independently TOOL_REJECTs any unvalidated toolName. Double-gated, deterministic.
- **Executor input validation kept minimal (T-03-04-03):** Phase 3's single tool declares an empty-object schema, so a structural check (object with zero keys / no input) is the whole input-schema gate; richer per-tool Zod validation ships with the Phase-8 tool suite (ToolCapabilityManifest, §28.5) — no JSON-schema engine invented (§0.2).
- **ask_clarification `.default([])` kept spec-verbatim:** its input/output shape asymmetry means `plan()` casts the requestJson result to `PlannerDecision` — the same boundary cast Appendix I performs (`(decision as any)`), now typed.
- **AI-02 stays PENDING** in REQUIREMENTS.md (see Issues Encountered).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prettier --check gate flagged StructuredOutput.test.ts after Task 6**
- **Found during:** Task 6 commit (prettier check on the new test file)
- **Issue:** `tests/core/ai/StructuredOutput.test.ts` was committed with line-wrapping that violates the repo's prettier --check gate (the plan's verify runs prettier; the 03-02/03-03 "verbatim code lands prettier-formatted" precedent applies)
- **Fix:** Ran `npx prettier --write` on the test file; semantically unchanged (suite re-run 7/7)
- **Files modified:** tests/core/ai/StructuredOutput.test.ts
- **Verification:** `pnpm format` clean; `pnpm test:ai` 60/60
- **Committed in:** 35a0a89 (style)

---

**Total deviations:** 1 auto-fixed (1 Rule 1)
**Impact on plan:** Formatting-only fix required for the repo's prettier --check gate. No behavior change, no scope creep.

## Issues Encountered

- **AI-02 mark-complete deliberately NOT run.** The plan frontmatter lists `requirements: [AI-02]`, but the requirement text names the full Planner→Executor→Renderer loop with the bounded Planner/Executor cycle — this plan ships the Planner + Executor services while RendererService is 03-06 and the Appendix-I `runAgentTurn` loop is 03-08. Marking AI-02 complete now would repeat the documented 03-01 mark-complete mistake (03-02/03-03 precedent: primitive-shipping plans leave checkboxes `[ ]`; the requirements-completed frontmatter records the plan's stated linkage only).
- The `prompt.split(` grep gate returns 2 matches — both are the spec-derived explanatory comments in StructuredOutput.ts documenting the REMOVED anti-pattern (the F-4 rationale, mirroring Appendix L's own note). Scoped to code lines (`grep -v '^\s*//'`), 0 matches. The plan's intent (no code path splits/joins prompts) holds.
- `PlannerService.plan()` requires a one-line cast (`as PlannerDecision`) because the ask_clarification branch's `.default([])` makes the Zod INPUT type (options optional) differ from OUTPUT (options required) — Appendix I itself casts the decision at this boundary. The schema remains spec-verbatim; no cast exists anywhere else in the 3 services.
- README.md carries the same pre-existing uncommitted documentation edit noted in 03-01/03-03 — left untouched (out of this plan's scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **03-05 (ProviderRouter):** the F-4 `callProviderJsonMode(sections, jsonSchema, signal)` signature this plan's `StructuredOutputContext` declares is exactly what the Router's `buildCallProviderJsonMode` must implement (D-18/D-19) — the kind→system/prompt `joinSections` mapping lives there, never in the consumers; `requestJson` (planner 3s timeout) is the consumer of the Router's callback
- **03-06 (RendererService):** reuses `requestJson` for structured card/table/checklist outputs with the same one-repair loop; `PlannerDecision`'s ask_clarification options feed RICH-C-01 chips (§17.7)
- **03-07 (PersonaInjector):** the byte-stability invariant is now hash-assertable end-to-end — the fixture persona block inside [SYSTEM] must keep `hashStableSections` stable through the planner's repair path
- **03-08 (AgentOrchestrator):** Appendix I call sites are `PlannerService.plan({operationId, context, userInput, abortSignal, ...})` and `ExecutorService.execute({operationId, toolName, input, abortSignal})` — both exported shapes already match; the orchestrator supplies `callProviderJsonMode`/`providerId`/`model`/`timeoutMs` into PlanInput
- Decision validity is proven end-to-end: one repair max, closed enum, TOOL_REJECTED on stray run_tool, get-provider-info runs — the AI-SPEC "Decision validity" eval dimension (Critical) is fully covered by this plan's tests

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-10*

## Self-Check: PASSED

- All 6 created files exist on disk (verified via `[ -f ]`)
- All 6 execution commits present in git log: 420e7f7, af76ac1, bbcee1b, 76ab62b, 35a0a89, 09018b3
- tsc --noEmit exit 0 · eslint . exit 0 · prettier --check . clean · pnpm test 340/340 (49 files) · test:ai 60/60 (7 files, +19 from 03-04)
- Grep gates: no `prompt.split(` code path in src/tests (2 matches are spec-derived comments only); PromptSection imported from '@/core/ai/types' (StructuredOutput.ts line 31); no ContextOptimizer PromptSection import; single PromptSection declaration (types.ts, R-1); no ProviderRouter import in the 3 services; no joined-string builder in the 3 services
- Hash-equality invariant proven: `hashStableSections`(attempt-1 cached) === `hashStableSections`(repair cached) — cached [SYSTEM] byte-identical across the one repair
- One-repair-max proven: call count = 2 in both StructuredOutput and PlannerService suites; STRUCTURED_OUTPUT_FAILED {retryable:false, raw:{first,second}} asserted
- D-05 proven: zero-tools schema omits run_tool (stray run_tool fails); closed enum rejects invented tool names; ExecutorService TOOL_REJECTs unknown/stray toolName and rejects invalid input; get-provider-info runs via ProviderRegistry with apiKey-stripped output
