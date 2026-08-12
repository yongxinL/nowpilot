---
phase: 04-context-adaptive-execution
plan: 06
subsystem: ai-context
tags: [per-stage-optimization, context-optimizer, context-for-stage-seam, context-too-large, context-helper-deletion, drop-in, pitfall-1, tdd]

# Dependency graph
requires:
  - phase: 04-context-adaptive-execution
    provides: ContextOptimizer.optimize + isContextTooLargeError (04-04), StageInvocation.modelContextWindow stamp (04-05), TokenBudget estimateTokens (04-01)
provides:
  - The Phase-3→4 cutover: useStreamingLLM rewired to per-stage ContextOptimizer calls (tier/budgets from each resolved model window — the behavioral-change surface, D-04-04/05/07)
  - AgentTurnInput.contextForStage input-only seam (D-04-05, L1 direct call) + estimateTokens re-pointed to TokenBudget
  - STR.chat.messageTooLong + the honest CONTEXT_TOO_LARGE→failed surface mapping (D-04-15 — never truncation, T-04-25)
  - src/core/ai/contextHelper.ts DELETED (D-04-08) with zero surviving imports — the Pitfall-1 wave seal
  - Extended hook/orchestrator suites: per-stage contexts, planner-tier loop caps, tier divergence, drop-in byte-identity, terminal mapping
affects: [04-07 W-1 gate (mirrors messageTooLong into spec Appendix B), Phase 4a/7 (contextUpdate consumers, conversation store), prompt-cache stability re-verification]

# Tech tracking
tech-stack:
  added: [] # nothing new — pure TS on the approved stack (R-9)
  patterns:
    - "Per-stage resolution-upfront pattern (D-04-04/05): the hook resolves BOTH StageInvocations first, reads each modelContextWindow, and runs optimize once per stage — the window (04-05 stamp) is the tier/budget source, never the pre-resolution fallback"
    - "Input-only seam extension (RESEARCH Pattern 1): contextForStage defaults to input.context for every existing call site — drop-in additive, direct call, never an event bus (L1)"
    - "Typed-error-carrier → surface mapping: isContextTooLargeError checked BEFORE classifyProviderError (T-04-28 — no section/user text logged), maps to failed + messageTooLong (T-04-25)"
    - "Pitfall-1 wave ordering: import re-points + hook swap + test re-points all land BEFORE the module deletion — tsc green at every commit, grep gate zero survivors"

key-files:
  created: [] # no new runtime/test files
  modified:
    - src/components/pages/useStreamingLLM.ts
    - src/core/ai/AgentOrchestrator.ts
    - src/core/i18n/strings.ts
    - tests/core/ai/AgentOrchestrator.test.ts
    - tests/components/pages/useStreamingLLM.test.tsx
    - tests/core/context/ContextOptimizer.test.ts
    - tests/core/ai/persona/PersonaInjector.test.ts
  deleted:
    - src/core/ai/contextHelper.ts

key-decisions:
  - "Fallback constants exported + vitest-pinned: DEFAULT_CONTEXT_TIER ('medium') / FALLBACK_MODEL_CONTEXT_WINDOW (131_072) are exported so eslint (no-unused-vars on local consts) stays clean and the plan-sanctioned consistency assertion is a one-line test — classifyModelContext(131_072) === 'medium' (a 16_384 fallback would derive 'small' and contradict the retained tier constant)"
  - "capsForTier mock records its tier argument (capsTierCalls) while returning the constant caps shape — proves D-04-05 'planner-stage tier governs loop caps' without changing the legacy assertion surface"
  - "BeforeEach mockReset (not mockClear) on createStageInvocation: per-test window overrides (tiny/planner) must not leak into later tests — the drop-in test caught the leak via a minimal-mode [SYSTEM]"

patterns-established:
  - "Per-stage optimizer packs threaded via contextForStage: planner pack is input.context, renderer pack resolves only at finish — the orchestrator never assembles or mutates prompts (GR-3, T-04-26)"
  - "Test-time snapshot handoff for deletion: the drop-in-identity regression compares optimize's default path against a hardcoded Phase-3 snapshot captured pre-deletion — byte-identity survives the module's removal (D-04-07/P4-8)"

requirements-completed: [CTX-01, CTX-02, CTX-03, CTX-04]

coverage:
  - id: D1
    description: "Hook rewired to per-stage optimization — two ContextOptimizer.optimize calls per send, tier + §2.2 budgets derived from each StageInvocation's modelContextWindow (04-05 stamp), planner tier governs capsForTier loop caps, contextForStage threads the per-stage packs (D-04-04/05/07 — the phase's only behavioral-change surface)"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: tests/components/pages/useStreamingLLM.test.tsx#runs optimize per stage: two createStageInvocation calls, capsForTier(planner tier) + contextForStage threaded
        status: pass
      - kind: unit
        ref: tests/components/pages/useStreamingLLM.test.tsx#per-stage tier divergence: planner tiny / renderer large — capsForTier receives the PLANNER tier (D-04-05, T-04-27)
        status: pass
      - kind: unit
        ref: tests/components/pages/useStreamingLLM.test.tsx#sends through runAgentTurn with an optimizer-built OptimizedContext (tier 'large' from the 200_000 mock window)
        status: pass
    human_judgment: false
  - id: D2
    description: "AgentTurnInput.contextForStage input-only seam — planner section base resolves from contextForStage('planner') ?? input.context, renderer receives contextForStage('renderer') ?? input.context; estimateTokens re-pointed to TokenBudget (D-04-05, RESEARCH Pattern 1, Pitfall 1)"
    requirement: CTX-02
    verification:
      - kind: unit
        ref: tests/core/ai/AgentOrchestrator.test.ts#with contextForStage: planner base resolves from the seam, renderer receives the seam context
        status: pass
      - kind: unit
        ref: tests/core/ai/AgentOrchestrator.test.ts#default path (no contextForStage) keeps input.context for BOTH stages (RESEARCH Pattern 1)
        status: pass
    human_judgment: false
  - id: D3
    description: "Honest CONTEXT_TOO_LARGE terminal — a caught ContextTooLargeError (isContextTooLargeError) maps to the failed state with STR.chat.messageTooLong BEFORE classifyProviderError; never a truncated prompt sent (D-04-15, P4-10, T-04-25/T-04-28)"
    requirement: CTX-04
    verification:
      - kind: unit
        ref: tests/components/pages/useStreamingLLM.test.tsx#a ContextTooLargeError (over-cap input even in minimal mode) → failed — never offline/completed (D-04-15, T-04-25)
        status: pass
      - kind: unit
        ref: tests/core/context/ContextOptimizer.test.ts#absurd userInput beyond even minimal mode throws the typed terminal
        status: pass
    human_judgment: false
  - id: D4
    description: "contextHelper.ts deleted with zero surviving imports across src/ AND tests/ — the Pitfall-1 wave seal (D-04-08, T-04-29); its packing/counting lives in ContextPack/TokenBudget (04-01/02), its builder in ContextOptimizer (04-04)"
    requirement: CTX-03
    verification:
      - kind: other
        ref: "grep gate: zero src/ or tests/ files import @/core/ai/contextHelper (exact specifier, 0 matches)"
        status: pass
      - kind: other
        ref: "glob: src/core/ai/contextHelper.ts no longer exists"
        status: pass
    human_judgment: false
  - id: D5
    description: "Drop-in byte-identity preserved across the deletion — ContextOptimizer.test.ts compares against the hardcoded Phase-3 snapshot (system 21 / tool_schemas 13 / user_input 7 tokens), the hook test pins the default-path section bytes (D-04-07/P4-8 prompt-cache stability)"
    verification:
      - kind: unit
        ref: tests/core/context/ContextOptimizer.test.ts#default path deep-equals the hardcoded Phase-3 snapshot (byte-identity survives the deletion)
        status: pass
      - kind: unit
        ref: tests/components/pages/useStreamingLLM.test.tsx#drop-in regression: the default-path section bytes equal the pre-04-06 snapshot (D-04-07/P4-8)
        status: pass
    human_judgment: false
  - id: D6
    description: "STR.chat.messageTooLong verbatim copy added beside contextReduced; the fallback constants pair (DEFAULT_CONTEXT_TIER/FALLBACK_MODEL_CONTEXT_WINDOW) is internally consistent and vitest-pinned (D-04-04, D-04-15)"
    verification:
      - kind: unit
        ref: tests/components/pages/useStreamingLLM.test.tsx#FALLBACK_MODEL_CONTEXT_WINDOW derives the DEFAULT_CONTEXT_TIER — the constants cannot disagree
        status: pass
      - kind: other
        ref: "grep: messageTooLong: 'This message is too long for the selected model.' verbatim in src/core/i18n/strings.ts L15"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-12
status: complete
---

# Phase 04 Plan 06: Wave-4 Cutover — Per-Stage Optimization + contextHelper Deletion Summary

**The Pitfall-1 wave: useStreamingLLM rewired to per-stage ContextOptimizer calls (tier + budgets from each resolved model window — D-04-04/05/07), the contextForStage input-only seam on AgentOrchestrator (D-04-05), the honest CONTEXT_TOO_LARGE→failed terminal with the STR.chat.messageTooLong surface (D-04-15), and the src/core/ai/contextHelper.ts DELETION with zero surviving imports (D-04-08) — the byte-identical default path keeps the prompt-cache regression green.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-12T06:45:52Z
- **Completed:** 2026-08-12T07:10:09Z
- **Tasks:** 3 (Tasks 1-2 TDD test→feat; Task 3 single refactor wave)
- **Files modified:** 8 (3 source modified, 1 source deleted, 4 test files modified)

## Accomplishments

- **Hook rewire (the phase's ONLY behavioral-change surface, D-04-07):** `useStreamingLLM.send()` now resolves BOTH StageInvocations upfront, reads each `modelContextWindow` (04-05 stamp), and runs `ContextOptimizer.optimize` once per stage — planner + renderer packs derive tier + §2.2 budgets from the RESOLVED window, never the hardcoded medium/16K defaults (which become the documented pre-resolution fallback only). `runAgentTurn` receives `context: plannerCtx`, `tier: capsForTier(plannerCtx.tier)` (D-04-05 locked: the PLANNER-stage tier governs loop caps even when the stages diverge — T-04-27), and the `contextForStage` per-stage pack seam. Zero PROMPTS import, zero budget math (GR-3/Pitfall 7).
- **Honest terminal (D-04-15):** the catch maps `isContextTooLargeError` → `failed` with the new `STR.chat.messageTooLong` surface BEFORE `classifyProviderError` (T-04-25/T-04-28) — an over-cap turn fails honestly, never silently truncates user input (P4-10). Test pins 'failed' (not 'offline', not 'completed') with runAgentTurn never reached.
- **Orchestrator seam (D-04-05):** `AgentTurnInput.contextForStage?: (stage) => OptimizedContext` — input-only, direct call (L1, mirrors invocation/onStreamDelta). planOnce's section base resolves from `contextForStage('planner') ?? input.context` (replan sections still append); finish passes `contextForStage('renderer') ?? input.context` to RendererService.render. Defaults keep every existing call site green (RESEARCH Pattern 1). `estimateTokens` import re-pointed to `@/core/context/TokenBudget` (the ONLY counter).
- **contextHelper DELETED (D-04-08, Pitfall 1):** zero `@/core/ai/contextHelper` import specifiers survive anywhere in src/ or tests/ (grep gate). The drop-in-identity regression in ContextOptimizer.test.ts now compares against the hardcoded Phase-3 snapshot (captured while the module still existed — system 21 / tool_schemas 13 / user_input 7 tokens, tier large); PersonaInjector.test.ts re-points `estimateTokens` to TokenBudget and its builder call sites to `ContextOptimizer.optimize` (byte-identical default path keeps the §2.3 determinism + injection-safety assertions meaningful). The hook test adds a drop-in section-bytes regression.
- **Extended suites:** useStreamingLLM.test.tsx proves per-stage contexts (2 invocation calls), planner-tier capsForTier via the recording mock, planner-tiny/renderer-large tier divergence, CONTEXT_TOO_LARGE→failed, and the drop-in regression (19 tests); AgentOrchestrator.test.ts proves the seam + default fallback (19 tests). Full repo: 69 files / 612 tests green, typecheck clean, eslint clean, prettier clean.

## Task Commits

Each task was committed atomically (TDD: test → feat for Tasks 1-2):

1. **Task 1: contextForStage seam + estimateTokens re-point**
   - `4d10569` (test — RED: seam + default-fallback tests)
   - `c28f739` (feat — GREEN: seam implementation + TokenBudget import)
2. **Task 2: Hook rewire + honest CONTEXT_TOO_LARGE mapping**
   - `fef478c` (test — RED: repaired send-path assertions for the rewire)
   - `119358b` (feat — GREEN: per-stage optimize calls, STR copy, terminal mapping, fallback constants)
3. **Task 3: Delete contextHelper + re-point test imports + extend hook suite (Pitfall-1 seal)** - `3eaee19` (refactor)

**Plan metadata:** (pending — `docs(04-06): complete …` committed after SUMMARY creation)

## Files Created/Modified

- `src/components/pages/useStreamingLLM.ts` - MODIFIED: per-stage optimizer calls, `contextForStage` threading, `capsForTier(plannerCtx.tier)`, CONTEXT_TOO_LARGE→failed mapping; `DEFAULT_CONTEXT_TIER`/`FALLBACK_MODEL_CONTEXT_WINDOW` exported as the documented pre-resolution fallback; Phase-3 DEFAULT_INPUT/OUTPUT_BUDGET removed
- `src/core/ai/AgentOrchestrator.ts` - MODIFIED: `AgentTurnInput.contextForStage?` seam (D-04-05), planOnce/finish per-stage resolution, estimateTokens import → TokenBudget
- `src/core/i18n/strings.ts` - MODIFIED: `chat.messageTooLong` verbatim (D-04-15)
- `src/core/ai/contextHelper.ts` - DELETED (D-04-08) — packing/counting/builder migrated in 04-01/02/04
- `tests/core/ai/AgentOrchestrator.test.ts` - MODIFIED: seam test + default-fallback pin
- `tests/components/pages/useStreamingLLM.test.tsx` - MODIFIED: repaired send-path assertions (tier 'large' from the 200_000 mock window), per-stage/divergence/terminal/drop-in extensions, capsTierCalls recording mock
- `tests/core/context/ContextOptimizer.test.ts` - MODIFIED: drop-in identity vs hardcoded Phase-3 snapshot
- `tests/core/ai/persona/PersonaInjector.test.ts` - MODIFIED: estimateTokens → TokenBudget; buildOptimizedContext → optimize

## Decisions Made

- **Fallback constants exported + vitest-pinned:** the rewire leaves `DEFAULT_CONTEXT_TIER`/`FALLBACK_MODEL_CONTEXT_WINDOW` unused at runtime (the window is REQUIRED on StageInvocation since 04-05 — the fallback is contract documentation). Exporting keeps eslint's no-unused-vars clean and enables the plan-sanctioned one-line consistency assertion: `classifyModelContext(131_072) === 'medium' === DEFAULT_CONTEXT_TIER`.
- **capsForTier mock records the tier argument:** the hook's loop-cap call can't be observed through the constant return value, so the mock records the arg into a hoisted `capsTierCalls` array — proving the PLANNER-stage tier (tiny in the divergence test, large otherwise) governs the loop caps without changing the legacy `{3,2,true}` assertion surface.
- **beforeEach mockReset over mockClear:** the divergence test's tiny-window `createStageInvocation` implementation leaked into the drop-in test (mockClear keeps implementations) — reset + re-established default keeps per-test window overrides isolated.
- **Test snapshot handoff:** the drop-in-identity comparison uses a hardcoded Phase-3 snapshot captured programmatically pre-deletion rather than a live import — the byte-identity regression survives the module's removal (D-04-07/P4-8).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] createStageInvocation mock implementation leaked across tests**
- **Found during:** Task 3 (drop-in regression test failed — [SYSTEM] showed the minimal-mode compact prefix)
- **Issue:** `beforeEach` used `mockClear()` on `createStageInvocation`, which keeps the previous test's `mockImplementation` — the tier-divergence test's tiny-window override leaked into the drop-in test, so the 200_000 window resolved to minimal mode.
- **Fix:** `mockReset()` + re-established default (200_000 window, spread `...input`) in `beforeEach` — per-test overrides now isolated.
- **Files modified:** tests/components/pages/useStreamingLLM.test.tsx
- **Verification:** drop-in regression green; full suite green
- **Committed in:** `3eaee19` (Task 3 commit)

**2. [Rule 1 - Test coverage gap] capsForTier's planner-tier argument was unobservable**
- **Found during:** Task 3 (extension (b) — runAgentTurnMock receives tier matching capsForTier(plannerCtx.tier))
- **Issue:** the mocked capsForTier returns a constant, so the hook's call argument (the planner-stage tier) could not be asserted; D-04-05's 'planner tier governs loop caps' needed a proof.
- **Fix:** the hoisted mock now records the tier arg into a `capsTierCalls` array (return shape unchanged — existing assertions untouched); the divergence test pins `capsTierCalls === ['tiny']`.
- **Files modified:** tests/components/pages/useStreamingLLM.test.tsx
- **Verification:** divergence + per-stage tests green
- **Committed in:** `3eaee19` (Task 3 commit)

**3. [Rule 3 - Blocking] eslint no-unused-vars on the fallback constants after the rewire**
- **Found during:** Task 2 GREEN (the rewire leaves DEFAULT_CONTEXT_TIER/FALLBACK_MODEL_CONTEXT_WINDOW unused at runtime)
- **Issue:** `@typescript-eslint/no-unused-vars` is `error` for local consts; the plan's "keep the constants" requirement would trip it.
- **Fix:** exported both constants (exported vars are not flagged) — which also enables the plan-sanctioned "one-line vitest" consistency assertion instead of inspection-only.
- **Files modified:** src/components/pages/useStreamingLLM.ts, tests/components/pages/useStreamingLLM.test.tsx
- **Verification:** eslint clean on the hook; consistency test green
- **Committed in:** `119358b` (Task 2 commit)

**4. [Rule 1 - Test repair] StageResolver seam test broke at the rewire boundary**
- **Found during:** Task 2 RED
- **Issue:** the plan enumerated only L110-126 (tier assertion) as stale, but the L142-179 invocation test also broke — the old hook resolved stages lazily inside runAgentTurn (0 upfront calls), the rewired hook resolves both upfront (2 calls).
- **Fix:** rewrote the test to assert the upfront 2-call resolution + per-stage maxTokens (256/512) from the call args.
- **Files modified:** tests/components/pages/useStreamingLLM.test.tsx
- **Verification:** invocation test green after the rewire
- **Committed in:** `fef478c` (Task 2 RED commit)

---

**Total deviations:** 4 auto-fixed (3 Rule 1, 1 Rule 3)
**Impact on plan:** All fixes were correctness/test-accuracy corrections directly caused by the rewire — no scope creep, no architectural change. The plan's own TDD boundary (L110-126 repair) was the minimum; the two additional test breaks were the natural blast radius of the behavioral change.

## Issues Encountered

- The opencode LSP produced persistent stale "Cannot find module '@/core/context/…'" + implicit-any diagnostics during Task 3 even after the modules were verified green by vitest/tsc — the same spurious LSP-cache pattern documented in 04-01/04-04; not a build-state signal.
- The plan's Task-2 action text used `toolSchemaRefs: []` for the optimizer input base, but the `ContextOptimizerInput` field is `selectedToolSchemas` — used the actual field name (the types file is authoritative, R-1).
- `/tmp` hit a disk-quota limit on this host — timestamp bookkeeping moved in-process; no impact on the repo or the build.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **CTX-01/02/03/04 all reach the runtime:** per-stage budget enforcement (hook), the typed input-only seam (orchestrator), minimal mode via optimizer compact-prompt selection (04-04, passed through unchanged), and the honest CONTEXT_TOO_LARGE terminal — the unresolved spec-probe status (#1110) seals at the phase gate.
- **04-07 W-1 gate:** mirrors `STR.chat.messageTooLong` into spec Appendix B (the string is already verbatim in strings.ts L15) and re-verifies the compact constants + CONTEXT_TOO_LARGE in the spec — no code changes expected.
- **Pitfall-1 sealed:** contextHelper is gone with zero survivors; the drop-in byte-identity regression (hardcoded snapshot) keeps the prompt-cache stability claim alive for future refactors.
- **Deferred:** page/state-change re-pack triggers (CTX-02 consumers) and the conversation store arrive with Phase 4a/7 (A11: conversationId 'default' constant in the hook's optimizer inputs).

## Threat Flags

None — no new surface outside the plan's threat model. T-04-25 mitigated (honest terminal tested: over-cap → failed, never a truncated prompt sent), T-04-26 mitigated (contextForStage is an input-only typed callback — the orchestrator resolves contexts, never assembles; GR-3 keeps prompt assembly in core builders), T-04-27 mitigated (planner-tier capsForTier proven by the divergence test), T-04-28 mitigated (CONTEXT_TOO_LARGE path returns before classifyProviderError noise; no section/user text logged), T-04-29 mitigated (Pitfall-1 wave ordering + grep gate zero survivors + tsc green at every commit), T-04-30 no-op (no packages installed).

---

## Self-Check

- `src/components/pages/useStreamingLLM.ts` — FOUND (2 optimize calls in send; contextForStage threaded; no PROMPTS import; no .slice)
- `src/core/ai/AgentOrchestrator.ts` — FOUND (contextForStage seam ×3 sites; estimateTokens from TokenBudget)
- `src/core/i18n/strings.ts` — FOUND (messageTooLong verbatim)
- `src/core/ai/contextHelper.ts` — NOT FOUND (deleted — intended, D-04-08)
- `tests/core/ai/AgentOrchestrator.test.ts` — FOUND (19 tests, seam + fallback)
- `tests/components/pages/useStreamingLLM.test.tsx` — FOUND (19 tests, extensions)
- `tests/core/context/ContextOptimizer.test.ts` — FOUND (17 tests, snapshot drop-in)
- `tests/core/ai/persona/PersonaInjector.test.ts` — FOUND (migrated to optimize)
- Commits: `4d10569` ✓ `c28f739` ✓ `fef478c` ✓ `119358b` ✓ `3eaee19` ✓
- TDD gates: Task 1 RED `4d10569` → GREEN `c28f739` ✓; Task 2 RED `fef478c` → GREEN `119358b` ✓
- Verification: scoped suite `pnpm vitest run tests/core/context tests/core/ai tests/components/pages tests/fixtures` → 28 files / 338 passed; full `pnpm vitest run` → 69 files / 612 passed; `pnpm typecheck` → clean; eslint → clean on all 7 touched files; prettier --check → clean; grep gates (zero `@/core/ai/contextHelper` imports in src/ AND tests/, no `.slice(` in the rewire, no PROMPTS import in the hook, FALLBACK_MODEL_CONTEXT_WINDOW 131_072 consistent with DEFAULT_CONTEXT_TIER 'medium') → CLEAN
- Only intentional deletion: `src/core/ai/contextHelper.ts` (the D-04-08 target); the pre-existing untracked planner artifact `04-PATTERNS.md` left untouched (04-05 precedent)

## Self-Check: PASSED

---
*Phase: 04-context-adaptive-execution*
*Completed: 2026-08-12*
