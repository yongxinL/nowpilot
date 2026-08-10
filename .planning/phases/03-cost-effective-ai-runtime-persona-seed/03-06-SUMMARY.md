---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 06
subsystem: ai-runtime
tags: [renderer-service, agent-orchestrator, run-agent-turn, f-5, streaming-honesty, tier-caps, appendix-i, typescript]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: 03-03 StreamAdapter/ChunkBuffer (Seam 3 pattern) + PromptCacheAdapter F-5 payload, 03-04 PlannerService/ExecutorService (the loop's stage services, D-05/D-19), 03-05 ProviderRouter (createStageInvocation StageInvocation bundle + buildStageMessages F-5 messages[] builder + isProviderUnconfiguredError + terminal reasonCode markers)
provides:
  - src/core/ai/RendererService.ts — the second Seam-3 streamText consumer: render() builds its streamText call from the Router's F-5 messages[]+providerOptions shape (buildStageMessages, never the `system` string form); deltas stream live via onDelta; finishReason awaited; finishReason !== 'stop' or a mid-stream rejection throws the typed STREAM_FAILED error (partialText = exactly the pre-failure deltas); abortSignal threaded unchanged
  - src/core/ai/AgentOrchestrator.ts — Appendix I runAgentTurn VERBATIM output struct {operationId, streamedText, toolResults, reasonCode} (D-20, zero evidence-machinery tokens); §1.4 caps enforced ONLY here (planner_cap_reached/tool_cap_reached); capsForTier maps ModelContextTier → the verbatim {plannerCap, toolCap, mcpChaining} shape (tiny 1/1, small 2/1, medium 3/2, large 5/3); input-only deviations onStreamDelta? + invocation? (StageResolver over the 03-05 StageInvocation)
  - Every-path terminal discipline: planner failure → deterministic planner_failed fallback (no re-invocation); provider_unconfigured resolution → provider_unconfigured reasonCode with NO model call; abort → AbortError; provider-level failures propagate as the visible provider-failure state
  - tests/core/ai/{RendererService,AgentOrchestrator}.test.ts — 26 new tests (115 test:ai / 395 full-suite green): streaming honesty, abort-cancels-billing, F-5 messages[] proof, exactly-2-call healthy turn, cap terminals, planner_failed no-reinvocation, deltas-before-completion, D-20 source grep
affects: [03-07 PersonaInjector (the byte-stable [SYSTEM] persona block now flows through the renderer's F-5 messages[] shape), 03-08 useStreamingLLM hook + ChatPage (runAgentTurn + onStreamDelta + StageResolver consumption, provider_unconfigured reasonCode gate), 03-09 wiring (§18 addendum documents the onStreamDelta/invocation deviations), Phase 3a (rewires runAgentTurn with reliability machinery — the output struct is the seam)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seam 3 two-consumer boundary: streamText is consumed ONLY inside RendererService/StreamAdapter (AI-SPEC); RendererService builds its call from the Router's F-5 messages[]+providerOptions shape and implements done-XOR-error honesty (finishReason !== 'stop' → typed STREAM_FAILED failed terminal — StreamAdapter's generic done chunk cannot express a truncated finish)"
    - "Bounded terminal reasonCode discipline: every runAgentTurn path ends in planner_failed / provider_unconfigured / *_cap_reached / the planner's reasonCode / ask_clarification / AbortError / a typed provider failure — never a hang, never an unbounded loop (bounded while loop under §1.4 caps)"
    - "Input-only D-20 deviations: onStreamDelta? + invocation? are additive AgentTurnInput fields; the output struct stays verbatim (Phase 3a rewires it later)"

key-files:
  created:
    - src/core/ai/RendererService.ts
    - src/core/ai/AgentOrchestrator.ts
    - tests/core/ai/RendererService.test.ts
    - tests/core/ai/AgentOrchestrator.test.ts
  modified: []

key-decisions:
  - "RendererService IS the second Seam-3 streamText consumer (the plan's verify grep 'RendererService streamText construction' + the AI-SPEC rule 'streamText is consumed ONLY inside RendererService/StreamAdapter' + the finishReason !== 'stop' honesty requirement jointly mandate direct construction): render() threads buildStageMessages' messages[]+providerOptions shape into streamText — the 'consumes StreamAdapter (Seam 3)' phrasing means the Seam-3 boundary pattern, which the renderer implements with full honesty control"
  - "The orchestrator's plan() call omits toolResults: 03-04's PlanInput never declared it (the D-19-pure PlannerService never joins tool results into the prompt — the F-4 sections-in contract is the prompt source); the loop still pushes toolResults and threads them into render() verbatim"
  - "planner_failed fallback covers NON-provider plan() rejections only (§1.2 'if planner fails twice' collapsed to the plan's 'no re-invocation'): a ProviderUnavailableError (no_candidate/budget_blocked from the Router closure) or an AbortError propagates as the visible provider-failure state / AbortError — never converted to planner_failed (which would waste a re-resolution + re-render)"
  - "StageResolver is defined in AgentOrchestrator over the 03-05 StageInvocation type (03-05 exported the invocation bundle but no resolver type; the 're-export' requirement is realized as the exported (stage: 'planner' | 'renderer') => StageInvocation seam the 03-08 hook builds over getProviderRouter().createStageInvocation)"
  - "isAbortError matches by name ('AbortError'), not instanceof Error — DOMException does not extend Error in every runtime; an abort surfacing inside the planner must propagate as AbortError, never become planner_failed"

patterns-established:
  - "Typed failed-terminal carriers mirror the ProviderUnavailableError precedent: StreamFailedError { code: 'STREAM_FAILED', partialText } + isStreamFailedError() guard — canonical code as a field, distinguishable without string matching"
  - "Fixture-driven orchestration tests: the stage services are mocked (their contracts are 03-04/03-06's own suites) so the orchestrator's loop/caps/terminal invariants are isolated — 17 tests over the Appendix-I shape"

requirements-completed: [AI-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "RendererService.render — Seam-3 streamText built from the Router's F-5 messages[]+providerOptions shape (never the system string form), deltas stream live via onDelta, finishReason awaited, explicit maxTokens 512 + maxRetries 0, caller abortSignal threaded unchanged"
    requirement: AI-03
    verification:
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#F-5 messages[]+providerOptions shape / no system key / maxRetries 0 / maxTokens 512 / abortSignal pass-through (3 tests)"
        status: pass
      - kind: other
        ref: "grep: no `system:` string literal in RendererService streamText construction (grep -nE '^\\s+system:' src/core/ai/RendererService.ts → 0 matches)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Streaming honesty (T-03-06-01) — a mid-stream rejection or a finishReason !== 'stop' (length) throws the typed STREAM_FAILED error whose partialText is exactly the pre-failure deltas; an aborted stream terminates in STREAM_FAILED, never a complete text"
    requirement: AI-03
    verification:
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#mid-stream rejection partialText + finishReason length + finishReason rejection + aborted stream (4 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AgentOrchestrator runAgentTurn — Appendix I VERBATIM output struct (D-20), bounded loop, healthy turn costs exactly 2 model calls (1 planner + 1 renderer), run_tool executes deterministically via ExecutorService, §1.4 caps enforced ONLY here (planner_cap_reached / tool_cap_reached, never beyond caps)"
    requirement: AI-02
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#exactly-2-call healthy turn + run_tool loop + cap terminals + large-caps bound (6 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every-path terminal discipline — planner failure → deterministic planner_failed (no re-invocation); provider_unconfigured resolution → provider_unconfigured reasonCode with no model call; abort → AbortError; provider-level failures (no_candidate/budget_blocked) propagate as the visible provider-failure state"
    requirement: AI-02
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#planner_failed + provider_unconfigured + no_candidate + budget_blocked + pre-aborted + inside-planner abort (6 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "capsForTier — maps ModelContextTier to the verbatim Appendix-I caps shape {plannerCap, toolCap, mcpChaining} (tiny 1/1, small 2/1, medium 3/2, large 5/3); AgentTurnInput.tier is that shape, never ModelContextTier"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#capsForTier all four tiers (1 test)"
        status: pass
    human_judgment: false
  - id: D6
    description: "onStreamDelta seam (AI-03) — deltas flow through the renderer to the caller's callback strictly BEFORE the output resolves; render receives the same callback; the invocation resolver supplies per-stage StageInvocation bundles from 03-05"
    requirement: AI-03
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#deltas-before-completion fixture + planner-invocation threading (2 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "D-20 source invariant — AgentOrchestrator carries zero evidence-machinery tokens (grep-asserted); the output struct is verbatim (Phase 3a owns the rewiring)"
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#D-20 source grep (1 test)"
        status: pass
      - kind: other
        ref: "grep -nE 'CompletionEvidence|OutcomeVerifier|trajectory' src/core/ai/AgentOrchestrator.ts → 0 matches"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-10
status: complete
---

# Phase 3 Plan 6: RendererService + AgentOrchestrator Summary

**The Seam-3 RendererService that builds its streamText call from the Router's F-5 messages[]+providerOptions shape (byte-stable [SYSTEM] persona block + anthropic cacheControl, never the system string) with typed STREAM_FAILED streaming honesty, and the Appendix-I-verbatim runAgentTurn loop (exactly-2-call healthy turns, §1.4 caps enforced only here, every path terminating in a bounded reasonCode) with the onStreamDelta + StageResolver input seams the 03-08 hook consumes — all 26 new tests green, D-20 source invariant grep-proven.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-10T20:06:06Z
- **Completed:** 2026-08-10T20:18:50Z
- **Tasks:** 8 (2 service tasks, 2 test tasks, 1 fix, verify)
- **Files modified:** 4 (all created)

## Accomplishments

- `src/core/ai/RendererService.ts` — **Seam 3, second streamText consumer** (AI-SPEC rule names RendererService/StreamAdapter). `render({ operationId, context, userInput, toolResults, abortSignal, invocation, onDelta })` builds its streamText call from the Router's F-5 builder (`buildStageMessages(providerId, sections)`, 03-05): the `messages[]` form whose CoreSystemMessage carries `providerOptions.anthropic.cacheControl` — **never the `system` string form** (ai@4 silently drops the breakpoint on it). Deltas flow live to the hook's ChunkBuffer via `onDelta`; the accumulated text is returned. **Streaming honesty (T-03-06-01):** `finishReason` is always awaited after the delta loop; a mid-stream rejection OR a `finishReason !== 'stop'` (length/content-filter) throws the typed `StreamFailedError { code: 'STREAM_FAILED', partialText }` — the failed terminal's partialText is EXACTLY the pre-failure deltas (test-proven: a 2-delta stream that fails after the first yields `partialText === 'part'` and no delta past the failure). `abortSignal` is threaded unchanged into the constructed call (T-03-06-04: cancel stops generation — no orphaned billing); `maxRetries: 0` (Pitfall 1 — the Router owns retries) and explicit `maxTokens: 512` (§1.2).
- `src/core/ai/AgentOrchestrator.ts` — **Appendix I VERBATIM (D-20).** `runAgentTurn` returns `AgentTurnOutput { operationId, streamedText, toolResults, reasonCode }` — the output struct is byte-identical to the spec; a source grep proves zero evidence-machinery tokens (Phase 3a owns the rewiring). The bounded loop: abort check → plannerCap check → planner call → answer/ask_clarification terminates / run_tool → toolCap check → deterministic `ExecutorService.execute` → push → loop. `AgentTurnInput.tier` is the **verbatim Appendix-I caps shape** `{ plannerCap, toolCap, mcpChaining }` (never ModelContextTier); `capsForTier` (tiny 1/1, small 2/1, medium 3/2, large 5/3 — §1.4) is the hook-side helper that populates it. **Input-only deviations (documented):** optional `onStreamDelta?` (live deltas to the hook, AI-03) and optional `invocation?` (`StageResolver = (stage: 'planner' | 'renderer') => StageInvocation` — per-stage bundles from 03-05's `createStageInvocation`).
- **Every path terminates in a bounded terminal reasonCode:** planner failure → deterministic `planner_failed` fallback (§1.2, **no re-invocation** — `planOnce` never retries); provider-unconfigured invocation resolution → `provider_unconfigured` reasonCode with **no model call**; abort → `AbortError` (loop-top `DOMException('aborted','AbortError')` + propagated in-call aborts); caps → `planner_cap_reached`/`tool_cap_reached`; success → the planner's reasonCode or `ask_clarification`; provider-level failures (`no_candidate`/`budget_blocked`/…) propagate as the visible provider-failure state (the hook's failed UI), never converted to `planner_failed`. The loop is bounded by construction: each iteration returns or consumes a plannerCap slot.
- **Cost discipline proven at the orchestrator level (AI-SPEC "Cost discipline"):** a healthy turn is EXACTLY 2 model calls (one planner + one renderer) regardless of provider — asserted with spies; run_tool executions are deterministic (zero model calls) and capped at `toolCap`; large caps bound the loop at 5/3.
- Test suites (26 new): RendererService (9 — F-5 messages[]+providerOptions proof incl. the byte-stable persona block as `messages[0].content` and `providerOptions.anthropic.cacheControl` on the CoreSystemMessage, no `system` key, maxRetries 0, maxTokens 512, hints-paused cascade, abortSignal pass-through, done-XOR-error honesty with exact partialText, finishReason 'length' failed terminal) and AgentOrchestrator (17 — exactly-2-call healthy turn, planner-invocation threading, run_tool loop + toolResults, cap terminals incl. large-caps bound, planner_failed no-reinvocation, provider_unconfigured no-call, no_candidate/budget_blocked propagation, pre-aborted + inside-planner AbortError, deltas-before-completion fixture, capsForTier table, D-20 source grep). `test:ai` 115/115 (10 files), full suite 395/395 (52 files).

## Task Commits

Each task was committed atomically:

1. **Tasks 1-2: RendererService.ts (Seam 3 + F-5 + streaming honesty + abort)** - `2f1bb9c` (feat)
2. **Tasks 3-5: AgentOrchestrator.ts (Appendix I + capsForTier + terminal enforcement)** - `3fdd26a` (feat)
3. **Task 6: RendererService.test.ts (9 tests)** - `88132b4` (test)
4. **Rule-1 fix: isAbortError name-based check** - `acff72c` (fix)
5. **Task 7: AgentOrchestrator.test.ts (17 tests)** - `b6d015c` (test)
6. **Task 8: Verify** - no commit (verification only)

**Plan metadata:** docs commit follows this SUMMARY.

## Files Created/Modified

- `src/core/ai/RendererService.ts` - Seam-3 streamText consumer: F-5 messages[]+providerOptions shape, onDelta streaming, typed STREAM_FAILED honesty, abort pass-through
- `src/core/ai/AgentOrchestrator.ts` - Appendix I runAgentTurn (D-20 verbatim output), capsForTier, StageResolver seam, terminal reasonCode discipline
- `tests/core/ai/RendererService.test.ts` - 9 contract tests (honesty, abort, F-5, hints cascade)
- `tests/core/ai/AgentOrchestrator.test.ts` - 17 contract tests (2-call cost, terminals, caps, deltas-before-completion, D-20 grep)

## Decisions Made

- **RendererService is the second Seam-3 streamText consumer** (direct construction, not a `streamTextToLLMChunks` call): the plan's own verify task ("grep no `system:` string literal in RendererService **streamText construction**") and the AI-SPEC rule ("streamText is consumed ONLY inside RendererService/StreamAdapter") presuppose the construction lives here, and the T-03-06-01 honesty requirement (`finishReason !== 'stop'` → failed terminal) is only implementable with direct access to the terminal member — StreamAdapter's generic 'done' chunk cannot express a truncated finish. The renderer follows the Seam-3 pattern exactly (F-5 shape via the Router's builder, `maxRetries: 0`, done XOR error). "Consumes StreamAdapter (Seam 3)" is realized as the renderer being the second consumer of the seam.
- **The plan() call omits `toolResults`**: 03-04's `PlanInput` never declared the field (the D-19-pure PlannerService never joins tool results into the prompt — the F-4 sections-in contract is the prompt source). The loop still accumulates `toolResults` and threads them into `render()` verbatim, so the Appendix-I call shape is preserved where it matters.
- **planner_failed is scoped to NON-provider plan() rejections**: a `ProviderUnavailableError` from the Router closure (no_candidate/budget_blocked) or an AbortError propagates — converting those to `planner_failed` would waste a re-resolution + re-render and mislabel a provider failure as a planner failure.
- **StageResolver lives in AgentOrchestrator** over the 03-05 `StageInvocation` type: 03-05 exported the invocation bundle but no resolver type, so the "re-export" requirement is realized as the exported `(stage) => StageInvocation` seam the 03-08 hook builds over `getProviderRouter().createStageInvocation`.
- **isAbortError matches by name**, not `instanceof Error` — DOMException does not extend Error in every runtime; an abort surfacing inside the planner must propagate as AbortError, never become planner_failed (Rule 1).
- **AI-02 marked complete** (the requirement's full text — the Planner→Executor→Renderer loop with Zod-validated decisions and deterministic execution — is test-proven by this plan's orchestrator suite); AI-03 (React UI end-to-end) stays pending for 03-08, AI-04 (monthly budget ledger) stays pending for Phase 6 per the REQUIREMENTS.md note.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `isAbortError` failed for DOMException abort rejections**
- **Found during:** Task 7 (AgentOrchestrator suite — "abort inside the planner" case)
- **Issue:** `isAbortError` used `err instanceof Error && err.name === 'AbortError'`; DOMException does not extend Error in every runtime, so an abort surfacing inside `plan()` (SDK/DOMException rejection) fell through to the planner_failed fallback instead of propagating as AbortError — violating the must-have terminal table (abort → AbortError, never a planner_failed re-render).
- **Fix:** name-based check (`typeof err === 'object' && err !== null && err.name === 'AbortError'`) — matches the loop-top `DOMException('aborted','AbortError')` and any SDK abort regardless of prototype chain.
- **Files modified:** src/core/ai/AgentOrchestrator.ts
- **Verification:** the inside-planner abort test passes (AbortError propagates, render never called); full suite re-green
- **Committed in:** acff72c

---

**Total deviations:** 1 auto-fixed (1 Rule 1)
**Impact on plan:** Correctness fix required by the plan's own terminal-state invariant. No scope creep.

## Issues Encountered

- **AI-03 / AI-04 mark-complete deliberately NOT run.** The plan frontmatter lists `requirements: [AI-02, AI-03, AI-04]`; AI-03's full text names the React UI (03-08, its own frontmatter claims AI-03) and AI-04's full text names the monthly budget ledger (Phase 6, per the REQUIREMENTS.md D-16 note). Only AI-02 — whose full text this plan's orchestrator suite test-proves — is marked complete; the requirements-completed frontmatter records the plan's stated linkage, and the checkboxes stay `[ ]` for the two later-owned requirements (03-02/03-03/03-04/03-05 precedent).
- **The plan's "render() consumes StreamAdapter" phrasing vs. direct construction** — resolved as a documented reading (see Decisions): the AI-SPEC rule names RendererService as a streamText consumer, the verify grep presupposes a construction in the renderer, and the `finishReason !== 'stop'` honesty check requires direct terminal access. No StreamAdapter change was needed (it stays out of this plan's file scope).
- README.md carries the same pre-existing uncommitted documentation edit noted in 03-01/03-03/03-04/03-05 — left untouched (out of this plan's scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **03-07 (PersonaInjector + contextHelper):** the byte-stable `[SYSTEM]` persona block now flows through the renderer's F-5 `messages[]` shape — PersonaInjector must keep it byte-stable so the anthropic cacheControl breakpoint actually engages (the fixture's FIXED_PERSONA_BLOCK is asserted as `messages[0].content` in RendererService.test.ts).
- **03-08 (useStreamingLLM hook + ChatPage):** consumes `runAgentTurn({ operationId, userInput, context, abortSignal, tier: capsForTier(context.tier), onStreamDelta, invocation })` — the hook builds the StageResolver closure over `getProviderRouter().createStageInvocation` (operationId/tier/privacyMode/maxTokens 256|512/configuredProviders), maps `streamedText` + `reasonCode` ('provider_unconfigured' gate, ask_clarification chips) into the Bubble state machine, and aborts via the threaded signal.
- **03-09 (wiring + §18 addendum):** the §18 addendum records the two input-only deviations (onStreamDelta, invocation) exactly as documented here; `getProviderRouter().configure()` precedes any send.
- **Phase 3a:** rewires `runAgentTurn` by replacing the D-20 output struct — the verbatim `AgentTurnOutput` is the seam; nothing in this plan leaks the Phase-3a machinery in (grep-proven).
- Cost discipline, streaming honesty, and loop termination are all test-proven at the orchestrator level — the AI-SPEC eval dimensions "Cost discipline", "Streaming honesty", and "Task completion / loop termination" are covered by this plan's suites.

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-10*

## Self-Check: PASSED

- All 4 created files + SUMMARY exist on disk (verified via `[ -f ]`)
- All 5 execution commits present in git log: 2f1bb9c, 3fdd26a, 88132b4, acff72c, b6d015c
- tsc --noEmit exit 0 · eslint . clean · prettier --check . clean · test:ai 115/115 (10 files) · full suite 395/395 (52 files)
- Grep gates: no `system:` string literal in RendererService streamText construction (0 matches); zero CompletionEvidence/OutcomeVerifier/trajectory tokens in AgentOrchestrator.ts (0 matches, D-20)
- F-5 proven: constructed streamText uses messages[] with the byte-stable [SYSTEM] persona block (joinSections over CACHED_KINDS) carrying providerOptions.anthropic.cacheControl — `'system' in args` is false, maxRetries 0, maxTokens 512
- Streaming honesty proven: mid-stream rejection → STREAM_FAILED with partialText exactly the pre-failure deltas; finishReason 'length' → failed terminal (never a truncated complete); aborted stream → STREAM_FAILED, abortSignal threaded unchanged
- Cost discipline proven: healthy turn = exactly 2 model calls (1 planner + 1 renderer, spies); run_tool loop capped at toolCap; large caps bound the loop at 5/3
- Terminal paths proven: planner_failed (no re-invocation), provider_unconfigured (no model call), AbortError (pre-aborted + inside-planner), no_candidate/budget_blocked propagation, planner_cap_reached/tool_cap_reached, ask_clarification
- Deltas-before-completion proven: onStreamDelta order ['delta:d1', 'completed']
