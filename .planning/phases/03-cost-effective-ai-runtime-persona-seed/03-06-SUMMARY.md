---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 06
subsystem: ai-runtime
tags: [agent-orchestrator, appendix-i, tier-caps, persist-seam, persona-consistency, d-54a, rich-r-09]

# Dependency graph
requires:
  - phase: 03
    plan: 01
    provides: PlannerService.plan contract, PlannerDecisionSchema, ToolExecutionResult, OperationId correlation
  - phase: 03
    plan: 02
    provides: PersonaInjector + DEFAULT_PERSONA (name 'NowPilot'), UserPreferences (np_preferences fast/balanced)
  - phase: 03
    plan: 03
    provides: the five ILLMProvider adapters registered in ProviderRegistry
  - phase: 03
    plan: 04
    provides: PromptCacheManager.buildSystemPrompt (D-59 choke-point), ExecutorService (TOOL_REJECTED, D-46), RendererService (512-cap), toolSchemas ToolRegistry
  - phase: 03
    plan: 05
    provides: TierResolver.resolveTier (D-54a null contract), ProviderRouter.route (§1.5/§20.10), ProviderRegistry.getEnabled (D-51)
provides:
  - AgentOrchestrator.ts — the Appendix I bounded Planner → (run_tool → Executor) → Renderer loop; the ONLY §1.4 cap-enforcement point and the only PlannerService call site in src/ (grep-asserted == 1)
  - Per-stage tier resolution (D-55: planner fast, renderer fast, executor → turn modelTier) with the D-54a configuration-required typed outcome (no provider request when a tier is unresolved)
  - D-59 persona-consistent stage prompts for every stage of a turn (RICH-R-09 gate proven in-test)
  - D-45 turn-end persist seam (persistTurn once per completed turn, never per delta, not on abort)
affects: [03-07 chat wiring (consumes runAgentTurn + the config-required outcome + persist seam), Phase 5 ContextOptimizer (sections), Phase 11 AITransactionLog]

actuals:
  tokens: 6984     # chars/4 over the 2 files created (27,935 chars)
  tasks: 2         # tasks completed
  commits: 2       # commits made

# Tech tracking
tech-stack:
  added: []        # no new dependencies
  patterns:
    - "Appendix I verbatim loop: abort check → plannerCap → planner → answer/ask_clarification finish → toolCap → executor → push (spec 5567-5615)"
    - "Per-stage D-54a gate order: resolveTier FIRST, route SECOND — an unresolved tier returns the typed outcome before any provider interaction (zero provider calls proven)"
    - "D-55 stage-tier mapping as data: planner 'fast', renderer 'fast', executor = input.tier.modelTier"
    - "Configuration-required as a typed non-error AgentTurnOutput (reasonCode literal) — no invented error-code constant (identifier discovery rule)"
    - "D-59 single assembly path: every stage prompt through buildSystemPrompt; the planner prompt carries [USER INPUT] via the choke-point opts"

key-files:
  created:
    - src/core/ai/AgentOrchestrator.ts
    - tests/core/ai/AgentOrchestrator.test.ts

key-decisions:
  - "Configuration-required represented as a typed non-error AgentTurnOutput { streamedText: '', toolResults, reasonCode: 'configuration_required' } — the identifier discovery rule found no existing configuration-required identifier in the spec (§21.6 closed set) or repo, so only already-approved output fields + a documented literal reasonCode are used; NO CONFIG_REQUIRED constant is invented or exported (D-38)"
  - "Per-stage D-54a gate order: TierResolver.resolveTier runs BEFORE ProviderRouter.route — a null resolution returns the outcome immediately, so no route, no stream probe, no JSON call ever starts (test (h) proves zero fixture calls)"
  - "ProviderRouter.route is the per-stage provider SELECTION (its §1.5 first-token lock); the planner's native JSON-mode call (requestJson) and the renderer's stream both run through the routed provider — the plan's 'route via ProviderRouter.route and pass the resolved provider into the stage' literal reading"
  - "The planner prompt includes the user request via the D-59 choke-point (buildSystemPrompt('planner', { prefs, userInput }) → [USER INPUT] section) — the literal buildSystemPrompt(stage, { prefs }) would starve the planner of the user's text; the renderer receives userInput through its own message slot instead (no duplication)"
  - "ask_clarification surfaces its question/options as the renderer's user-side content (RICH-C-01 substrate: one planner call yields the focused question + tappable options, surfaced through the rendered answer)"
  - "allowCloudFallbackFromLocal defaults to true in the orchestrator — the Phase 3 AgentTurnInput contract has no privacy-mode field; 03-07 may thread a preference later"
  - "The run_tool case groups (b)/(d)/(g) script the real PlannerService module via vi.spyOn ('fixture planner') because the production zero-tool schema (D-46) cannot emit run_tool; Executor/Renderer stay real"

patterns-established:
  - "Appendix I loop as the single AI-call entry: every stage resolves its tier → routes → calls through the routed provider; the loop owns caps + the persist seam"
  - "D-54a fail-closed before any provider interaction: the tier gate is the first per-stage check, and its outcome is a typed value, not a throw"
  - "Persist-seam contract: the callback is invoked only from the finish path, after a non-aborted render, with the completed pair — never from the delta path"

requirements-completed: [RICH-R-09]

coverage:
  - id: D1
    description: "AgentOrchestrator — the Appendix I bounded Planner → Executor → Renderer loop enforcing §1.4 tier caps (plannerCap/toolCap) as the ONLY cap-enforcement point in the phase; exactly one PlannerService call site in src/ (grep-asserted == 1); happy path streams the renderer's answer"
    requirement: "RICH-R-09"
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(a) happy path — answer decision → AgentTurnOutput from the renderer"
        status: pass
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(b) planner_cap_reached — §1.4 cap enforcement (T-3-18)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(d) TOOL_REJECTED — the typed rejection surfaces and the loop continues (D-46)"
        status: pass
      - kind: other
        ref: "grep -rn \"PlannerService.plan\" src/ | wc -l == 1 (Appendix I rule)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-54a configuration-required outcome — an unresolved stage tier (TierResolver null) returns a typed non-error AgentTurnOutput (reasonCode 'configuration_required', empty streamedText) and starts NO provider request; no inference, no substitution, no guessing; not a completed turn → persist seam does not fire"
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(h) configuration-required (D-54a) — unresolved tier → typed outcome, zero provider calls"
        status: pass
    human_judgment: false
  - id: D3
    description: "RICH-R-09 persona consistency — the persona block is the string PREFIX of the planner, executor, and renderer system prompts of one turn, the persona name 'NowPilot' appears in all three, and the prompt is byte-stable per stage (D-59 single choke-point)"
    requirement: "RICH-R-09"
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(g) PERSONA CONSISTENCY (RICH-R-09 / DONE-when 4) — all three stage prompts of one turn"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-45 turn-end persist seam — persistTurn invoked exactly once per completed turn with the user message + streamedText, never per delta; abort (loop-top or mid-stream) propagates AbortError, drops the partial, and does NOT invoke the seam"
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(f) PERSIST SEAM (D-45) — exactly once at turn end, never per delta"
        status: pass
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(e) abort — AbortError propagates; persistTurn NOT invoked (D-45)"
        status: pass
    human_judgment: false
  - id: D5
    description: "ask_clarification + TOOL_REJECTED surfacing — a clarification decision finishes the turn with reasonCode 'ask_clarification' and its question/options reach the renderer request (RICH-C-01 substrate); every run_tool with zero registered tools surfaces a typed TOOL_REJECTED result in toolResults while the loop continues (D-46)"
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(c) ask_clarification — finishes with that reasonCode; question/options surface (RICH-C substrate)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(d) TOOL_REJECTED — the typed rejection surfaces and the loop continues (D-46)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-28
status: complete
---

# Phase 3 Plan 6: AgentOrchestrator — Appendix I Loop Summary

**The Appendix I bounded Planner → Executor → Renderer loop as the single AI-call entry for the phase: §1.4 tier caps (the ONLY cap-enforcement point), per-stage fast-tier resolution (D-55), the D-54a configuration-required typed outcome (zero provider calls when a tier is unresolved), D-59 persona-consistent stage prompts proven in one turn (RICH-R-09 gate), and the D-45 turn-end persist seam — with real stage services and fixture providers across 8 test case groups**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-27T21:57:32Z
- **Completed:** 2026-08-27T22:02:08Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- **Appendix I loop verbatim (spec 5567-5615):** `runAgentTurn` is the bounded `Planner → (run_tool → Executor) → Renderer` loop — abort check → plannerCap → planner → answer/ask_clarification finish → toolCap → executor → push → loop. The orchestrator is the **only** module enforcing the §1.4 caps and the **only** caller of the planner stage (`grep -rn "PlannerService.plan" src/ | wc -l` == 1 — the Appendix I rule). Tool calls default to the turn's `modelTier` (D-55); zero registered tools mean every `run_tool` surfaces a typed `TOOL_REJECTED` result and the loop continues (D-46, T-3-18).
- **D-54a configuration-required outcome:** each stage resolves its tier via `TierResolver.resolveTier` **first** — an unresolved tier returns a typed non-error `AgentTurnOutput` (`streamedText: ''`, `reasonCode: 'configuration_required'`) and **no provider request starts** (no route, no stream probe, no JSON call — test (h) proves the fixture is never touched). Per the identifier discovery rule, the spec's §21.6 closed set and the repository expose no configuration-required identifier, so the condition uses only the already-approved output fields with a documented literal reasonCode — **no `CONFIG_REQUIRED` constant is invented or exported** (D-38).
- **Persona consistency (RICH-R-09 / DONE-when 4):** every stage system prompt is assembled by `PromptCacheManager.buildSystemPrompt` (D-59 single choke-point). Test (g) classifies the captured planner/executor/renderer requests of one turn by their canonical stage string and asserts the persona block is the **string prefix** of all three, that 'NowPilot' appears in each, and that the renderer prompt is byte-stable across requests.
- **D-45 persist seam:** `persistTurn` fires exactly once per completed turn (user message + streamedText) from the finish path — never inside the delta path (multi-delta stream: 3 deltas, 1 persist call). Abort at the loop-top check or mid-stream propagates `DOMException('aborted', 'AbortError')`, drops the partial, and the seam is **not** invoked (tests (e)/(f), T-3-20/T-3-21).
- **ask_clarification + routing:** a clarification decision finishes the turn with that reasonCode and its question/options surface as the renderer's user-side content (RICH-C-01 substrate). Each stage routes via `ProviderRouter.route` (tier → providerId/model) and passes the routed provider into the stage.
- **138-test phase gate green** after every commit (tsc strict-clean, NP-STRICT ceiling 0 held — zero `@ts-expect-error` markers in new code).

## Task Commits

Each task was committed atomically:

1. **Task 1: AgentOrchestrator — Appendix I loop + per-stage tiers + config-required + persist seam** - `66c44a0` (feat)
2. **Task 2: AgentOrchestrator.test.ts — tier caps, abort, ask_clarification, TOOL_REJECTED, persona consistency, persist seam** - `ce6ea0d` (test)

**Plan metadata:** `pending` (committed with this SUMMARY)

## Files Created/Modified

- `src/core/ai/AgentOrchestrator.ts` - `runAgentTurn(input)` — the Appendix I bounded loop (spec 5567-5615); `AgentTier { plannerCap, toolCap, modelTier }` (§1.4 + D-55); `AgentTurnInput { userInput, sessionId, operationId, tier, prefs?, abortSignal, persistTurn? }`; `AgentTurnOutput { streamedText, toolResults, reasonCode }`; `PersistTurnInput { userMessage, assistantMessage }`. Per-stage `resolveStageProvider` (resolveTier → D-54a gate → ProviderRouter.route → routed provider); D-59 `stagePrompt` via buildSystemPrompt (planner carries [USER INPUT], renderer/executor carry the persona-first system prompt); D-45 persist seam in `finish`; debugLog instrumentation (ORCHESTRATOR_PLAN / ORCHESTRATOR_TOOL / TIER_UNRESOLVED).
- `tests/core/ai/AgentOrchestrator.test.ts` - 8 case groups / 9 tests (a–h) with REAL Planner/Executor/Renderer stage services + D-48 fixture providers (RecordingProvider wrapper, SlowAbortStreamProvider, seedEnv wiring the registry + prefs); the planner is scripted via `vi.spyOn` only for the run_tool case groups (the production zero-tool schema cannot emit run_tool, D-46).

## Decisions Made

- **Configuration-required shape (identifier discovery rule):** the spec §21.6 closed set and the repository contain no configuration-required identifier to reuse, so the outcome is a typed non-error `AgentTurnOutput` with only already-approved fields and the documented literal reasonCode `'configuration_required'`. No `CONFIG_REQUIRED` error-code constant is invented or exported; 03-07 matches the literal. (An initial `CONFIGURATION_REQUIRED_REASON` export was removed in-task to keep the 4-export contract and the rule's letter.)
- **Per-stage D-54a gate order:** `resolveTier` runs before `route` — a null resolution returns the outcome immediately, so no provider interaction of any kind starts (test (h) asserts `streamCalls === 0` AND zero `requestJson` prompts).
- **route() as per-stage provider selection:** each stage routes (the router's §1.5 first-token lock) and then calls the stage service through the routed provider — the planner via `callProviderJsonMode → requestJson`, the renderer via `render(...)` on the routed provider. This is the plan's literal "route via ProviderRouter.route and pass the resolved provider into the stage" reading.
- **Planner prompt carries [USER INPUT] through the D-59 choke-point:** `buildSystemPrompt('planner', { prefs, userInput })` — the literal `{ prefs }`-only call would starve the planner of the user's request (PlannerInput has no separate userInput slot). The renderer receives userInput via its own message slot (no duplication); the executor prompt is the reserved deterministic string.
- **ask_clarification surfacing:** the decision's question/options become the renderer's user-side content (`question\nOptions: …`), so the RICH-C-01 substrate is a single planner call that yields the focused question + tappable options surfaced through the rendered answer.
- **`allowCloudFallbackFromLocal` defaulted to `true`:** the Phase 3 input contract has no privacy-mode field; 03-07 can thread a preference later.
- **Fixture planner mechanism:** tests (b)/(d)/(g) script the real `PlannerService` module with `vi.spyOn` because the zero-tool production schema (D-46) cannot produce a `run_tool` decision; Executor and Renderer are exercised real in every case group.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Grep gate hit by a docstring pseudo-code line**
- **Found during:** Task 1 verification (first grep run: 2 hits, expected 1)
- **Issue:** The module docstring's loop pseudo-code contained the literal pattern `PlannerService.plan(...)` — the same comment-match trap documented as deviation 3 in 03-04.
- **Fix:** Reworded the docstring to "the planner stage call (PlannerService, the ONLY call site)" — the sole remaining hit is the real call site.
- **Files modified:** src/core/ai/AgentOrchestrator.ts
- **Verification:** `grep -rn "PlannerService.plan" src/ | wc -l` == 1
- **Committed in:** 66c44a0 (Task 1 commit)

**2. [Inventory note - not a code deviation] ReasonCode-constant export removed**
- **Found during:** Task 1 (post-write review against the plan's export contract + identifier discovery rule)
- **Issue:** An initial `CONFIGURATION_REQUIRED_REASON` constant export exceeded the plan's 4-export contract and flirted with the "do not invent or export CONFIG_REQUIRED" prohibition.
- **Fix:** Removed the constant; the outcome uses the documented literal `'configuration_required'` inline (03-07 matches the literal).
- **Files modified:** src/core/ai/AgentOrchestrator.ts
- **Verification:** tsc clean; test (h) asserts the literal; export surface is exactly runAgentTurn/AgentTurnInput/AgentTurnOutput/AgentTier (+ PersistTurnInput, the persist-callback arg type)
- **Committed in:** 66c44a0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3), 1 inventory note
**Impact on plan:** Both were required for acceptance-proof compliance (the grep gate and the export contract). No scope creep — the shipped deliverable set matches the plan's artifact inventory exactly.

## Issues Encountered

- The `PlannerService.plan` grep gate initially reported 2 (docstring pseudo-code + real call site) — resolved by rewording the comment (deviation 1). The 03-04 precedent (comment matches) applied identically.
- Test (e) mid-stream abort timing: the SlowAbortStreamProvider's 80 ms stall anchors the abort window deterministically (abort at ~30 ms lands mid-render); the generator checks the signal after the stall and the renderer's loop-top `signal.aborted` check converts it to an aborted termination.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 03-07 (chat wiring, D-44):** `runAgentTurn({ userInput, sessionId, operationId, tier, prefs, abortSignal, persistTurn })` is the exact call shape 03-07's `useChatStreaming.handleSend` needs. The `persistTurn` seam maps to the journaled `append-chat-turn` op; the configuration-required outcome (`reasonCode: 'configuration_required'`, empty streamedText) drives a configuration-prompt UI state; `ask_clarification` (reasonCode + renderer-surfaced question/options) feeds the RICH-C-01 chip rendering.
- **DONE-when loop for Phase 3 closes:** DONE-when 1 (caps + ask_clarification + TOOL_REJECTED), DONE-when 2 (fallback via the router — proven in 03-05), DONE-when 4 (persona in all three stage prompts — proven here) are all green; DONE-when 3 (live provider streaming) remains for the 03-07 human smoke checkpoint.
- **Watch items (carried):** `pnpm run verify:phase-3` covers `tests/core/ai` + `tests/core/ai/persona` — new test dirs must stay within those paths. Route-per-stage performs a stream probe per stage call in production — acceptable for Phase 3 (no production path until 03-07; a future phase may route once per turn and share the locked stream).

---

*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-28*

## Self-Check: PASSED

- All 2 source/test files + SUMMARY.md exist on disk (verified via `[ -f ]`)
- Both task commits found in git log: 66c44a0 (Task 1), ce6ea0d (Task 2)
- `pnpm run verify:phase-3` green after every task commit: tsc strict-clean + 138 tests across 16 files (129 prior + 9 new)
- Grep guard: `grep -rn "PlannerService.plan" src/ | wc -l` == 1 (the Appendix I rule — sole call site in AgentOrchestrator)
- Zero `@ts-expect-error NP-STRICT` markers in new code (NP-STRICT ceiling 0 held)