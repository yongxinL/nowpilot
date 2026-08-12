---
phase: 04-context-adaptive-execution
plan: 05
subsystem: ai-context
tags: [provider-router, stage-invocation, context-window, d-04-04, canonical-map, mechanical-fixture-update]

# Dependency graph
requires:
  - phase: 04-context-adaptive-execution
    provides: resolveModelContextWindow canonical map (04-01) — the single window source (R-1)
provides:
  - StageInvocation carries the REQUIRED modelContextWindow stamped by buildInvocation from the canonical map (D-04-04/06, Pitfall 2)
  - The per-stage resolved window the hook (04-06) reads for per-stage optimization — the mandated router-window-before-hook-packs dependency order
affects: [04-06 hook rewire (per-stage optimizer input), 04-04 ContextOptimizer consumers]

# Tech tracking
tech-stack:
  added: [] # nothing new — pure TS on the approved stack (R-9)
  patterns:
    - "Pitfall 2 required-field enforcement: tsc errors ARE the construction-site inventory — the compiler found 5 more literal builders than the plan enumerated"
    - "Single canonical window source (R-1): ProviderRouter imports resolveModelContextWindow, never re-declares a table"

key-files:
  created: []
  modified:
    - src/core/ai/ProviderRouter.ts
    - tests/core/ai/AgentOrchestrator.test.ts
    - tests/core/ai/AgentOrchestrator.budget.test.ts
    - tests/components/pages/useStreamingLLM.test.tsx
    - tests/core/ai/trajectory/AgentOrchestrator.trajectory.test.ts (Rule 3)
    - tests/core/ai/trajectory/AgentOrchestrator.replan.test.ts (Rule 3)
    - tests/core/ai/RendererService.test.ts (Rule 3)
    - tests/core/ai/RendererService.evidence.test.ts (Rule 3)
    - tests/core/ai/RendererService.streamBreakdown.test.ts (Rule 3)

key-decisions:
  - "modelContextWindow is REQUIRED (never optional) — optionality would silently degrade to the pre-resolution fallback forever, inverting D-04-04 (Pitfall 2, T-04-22 mitigation)"
  - "The budget test needs no fixture literal: its makeResolver runs the REAL createStageInvocation path, so the map stamps 'deepseek-chat' → 65_536 automatically"

patterns-established:
  - "buildInvocation stamps the window synchronously from the canonical map — zero model calls (getModels is a throwing stub; the map IS the window source)"
  - "Fixture builders use a deterministic 200_000 window placed before ...overrides so per-test overrides win"

requirements-completed: [CTX-01]

coverage:
  - id: D1
    description: "StageInvocation carries the REQUIRED modelContextWindow (number) stamped by buildInvocation via resolveModelContextWindow(cand.model).contextWindow from the canonical map — synchronous, zero model calls; resolver/ledger/breaker logic byte-unchanged"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: tests/core/ai/ProviderRouter.test.ts#createStageInvocation — healthy path (cost discipline)
        status: pass
      - kind: unit
        ref: pnpm vitest run tests/core/ai/ProviderRouter.test.ts (33 passed)
        status: pass
      - kind: unit
        ref: pnpm typecheck (zero StageInvocation-completeness errors repo-wide)
        status: pass
    human_judgment: false
  - id: D2
    description: "All StageInvocation literal fixture builders supply deterministic windows (AgentOrchestrator.test.ts stageInvocation + useStreamingLLM.test.tsx hoisted mock = 200_000; the budget test needs none — real createStageInvocation path stamps 'deepseek-chat' 65_536); diff is fixture-only with zero assertion changes"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: tests/core/ai/AgentOrchestrator.test.ts#runAgentTurn — healthy turn costs EXACTLY 2 model calls
        status: pass
      - kind: unit
        ref: tests/core/ai/AgentOrchestrator.budget.test.ts#CR-01 regression — the R-2 budget never starves legitimate stage calls
        status: pass
      - kind: unit
        ref: tests/components/pages/useStreamingLLM.test.tsx#useStreamingLLM — send path (Golden Rule 3 + D-02)
        status: pass
      - kind: unit
        ref: pnpm vitest run tests/core/ai tests/components/pages/useStreamingLLM.test.tsx (22 files / 234 passed)
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-08-12
status: complete
---

# Phase 04 Plan 05: Router StageInvocation Window Stamp Summary

**StageInvocation gains the REQUIRED modelContextWindow stamped by buildInvocation from the canonical resolveModelContextWindow map (D-04-04/06) — the router-side window source the 04-06 hook reads for per-stage optimization; three planned fixture builders plus five compiler-surfaced literal builders updated mechanically with deterministic windows.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-12T06:04:46Z
- **Completed:** 2026-08-12T06:15:03Z
- **Tasks:** 2 (all `type="auto"`)
- **Files modified:** 8 (1 source, 7 test fixtures — 2 planned fixtures + 5 Rule-3 compiler-surfaced)

## Accomplishments

- `StageInvocation` (ProviderRouter.ts L140-147) gains **REQUIRED** `modelContextWindow: number` — documented with the D-04-04/06 Pitfall-2 rationale (optionality would silently degrade to the pre-resolution fallback forever, inverting D-04-04) and the zero-model-calls invariant (T-04-22 mitigation).
- `buildInvocation` (L617-631) stamps `modelContextWindow: resolveModelContextWindow(cand.model).contextWindow` — imported from `@/core/context/ModelContextTier` (R-1 canonical home, never re-declared); synchronous + pure, zero SDK/network calls (getModels is a throwing stub). Unknown models resolve conservatively (4096, windowKnown:false — never assume large, T-04-21 mitigation). Resolver/ledger/breaker/F-4/F-5 closures byte-unchanged (G0 scope discipline).
- Three planned fixture builders updated: `AgentOrchestrator.test.ts` `stageInvocation()` and `useStreamingLLM.test.tsx` hoisted mock add deterministic `modelContextWindow: 200_000` before `...overrides` (overridable per-test); `AgentOrchestrator.budget.test.ts` needs NO literal — its `makeResolver` runs the REAL `createStageInvocation` path so the canonical map stamps 'deepseek-chat' → 65_536 automatically (flagged assumption honored: budget assertions stay capsForTier-relative, never window-derived).
- **Pitfall 2 confirmed empirically:** the full-repo typecheck surfaced FIVE additional literal construction sites the plan did not enumerate (trajectory ×2, RendererService ×3) — all received the identical mechanical required-field addition. The plan's own must_have ("tsc errors ARE the inventory") is exactly what happened.

## Task Commits

Each task was committed atomically:

1. **Task 1: Stamp modelContextWindow on StageInvocation in buildInvocation** - `08adc82` (feat)
2. **Task 2: Update the three fixture builders with deterministic windows** - `01e4f7d` (test)

**Plan metadata:** pending (`docs(04-05): complete …` — committed after SUMMARY creation)

## Files Created/Modified

- `src/core/ai/ProviderRouter.ts` - StageInvocation interface + `modelContextWindow: number` (required); buildInvocation stamp via `resolveModelContextWindow(cand.model).contextWindow`; header + interface docs (D-04-04/06, Pitfall 2, zero-model-calls)
- `tests/core/ai/AgentOrchestrator.test.ts` - `stageInvocation()` fixture gains `modelContextWindow: 200_000` before overrides
- `tests/core/ai/AgentOrchestrator.budget.test.ts` - NO change needed (real createStageInvocation path stamps the window from the map)
- `tests/components/pages/useStreamingLLM.test.tsx` - hoisted `createStageInvocation` mock returns `modelContextWindow: 200_000`
- `tests/core/ai/trajectory/AgentOrchestrator.trajectory.test.ts` - Rule 3: same mechanical fixture update (compiler-surfaced)
- `tests/core/ai/trajectory/AgentOrchestrator.replan.test.ts` - Rule 3: same mechanical fixture update (compiler-surfaced)
- `tests/core/ai/RendererService.test.ts` - Rule 3: same mechanical fixture update (compiler-surfaced)
- `tests/core/ai/RendererService.evidence.test.ts` - Rule 3: same mechanical fixture update (compiler-surfaced)
- `tests/core/ai/RendererService.streamBreakdown.test.ts` - Rule 3: same mechanical fixture update (compiler-surfaced)

## Decisions Made

- **REQUIRED field (Pitfall 2), not optional:** an optional `modelContextWindow` would let the pre-resolution `medium` fallback silently remain the primary source forever — inverting D-04-04's "resolved window is the source" contract. The compiler enforces every construction site (T-04-22 mitigated by construction).
- **Budget test stays literal-free:** the plan's flagged assumption held — the budget test's resolver path is the REAL `router.createStageInvocation`, so the canonical map resolves 'deepseek-chat' → 65_536 with no hardcoded literal; budget assertions remain capsForTier-relative (never window-derived).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Five additional StageInvocation literal builders surfaced by the full-repo typecheck**
- **Found during:** Task 2 (full `pnpm typecheck` — the plan's Task-1 boundary defers it to Task 2)
- **Issue:** The plan enumerated three fixture builders to update, but the REQUIRED field breaks every literal `StageInvocation` construction site in the repo. The compiler found five more: `trajectory/AgentOrchestrator.trajectory.test.ts`, `trajectory/AgentOrchestrator.replan.test.ts`, `RendererService.test.ts`, `RendererService.evidence.test.ts`, `RendererService.streamBreakdown.test.ts` (all `TS2322` — `modelContextWindow` missing).
- **Fix:** Applied the identical mechanical fixture update (`modelContextWindow: 200_000` before `...overrides`) to all five sites — exactly the plan's own Pitfall-2 prediction ("tsc errors ARE the inventory"), just a wider blast radius than the enumerated three.
- **Files modified:** the five test files above
- **Verification:** `pnpm typecheck` → clean; full AI + hook suites green (22 files / 234 tests)
- **Committed in:** `01e4f7d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking)
**Impact on plan:** Mechanical, zero assertion-semantics changes — the diff is fixture-only (+14 lines across 7 files). The required-field blast radius is exactly the literal construction sites, as the plan's Pitfall-2 note predicted; no scope creep, no architectural change.

## Issues Encountered

- The plan's `files_modified` frontmatter listed 4 files but the compiler inventory covered 9 (incl. the budget test needing no change) — mid-plan the full typecheck was red until all five compiler-surfaced sites were updated; resolved within Task 2, typecheck clean at the plan boundary.
- `.planning/phases/04-context-adaptive-execution/04-PATTERNS.md` is untracked (planner artifact, pre-dates this plan's execution) — left untouched; not part of this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The stamped window is the D-04-04 per-stage resolution source the hook reads in 04-06 — the mandated router-window-before-hook-packs dependency order is satisfied.
- `resolveModelContextWindow` remains the single window source (R-1); the map values stay [ASSUMED] A2..A6 behind user confirmation gates (wrong value → downstream tier/cap shift, mitigated by 70% budget + ladder).
- CTX-01 progress: map (04-01) + compressor (04-02) + manifest (04-03) + window stamp (this plan) landed; per-stage budget enforcement completes in the 04-06 hook rewire.

## Threat Flags

None — no new surface outside the plan's threat model: the stamp is a pure synchronous map read on the existing StageInvocation bundle (no new endpoints, auth paths, I/O, or schema changes at trust boundaries). T-04-21 mitigated by the conservative 4096 unknown-model fallback; T-04-22 mitigated by the REQUIRED field enforced by tsc; T-04-23 passes the window to the 04-04 TokenBudget enforcement path unchanged; T-04-24 no-op (no packages installed).

---

## Self-Check

- `src/core/ai/ProviderRouter.ts` — FOUND (`modelContextWindow: number` declared exactly once in the interface; stamp in buildInvocation; import from ModelContextTier)
- `tests/core/ai/AgentOrchestrator.test.ts` — FOUND (stageInvocation fixture gains 200_000)
- `tests/components/pages/useStreamingLLM.test.tsx` — FOUND (hoisted mock returns 200_000)
- Commits: `08adc82` ✓ `01e4f7d` ✓
- Verification: `pnpm vitest run tests/core/ai tests/components/pages/useStreamingLLM.test.tsx` → 22 files / 234 passed; `pnpm typecheck` → clean; grep gates (interface decl ×1, no optional variant, no getModels call) → CLEAN
- No file deletions in either commit; no generated/untracked artifacts introduced

## Self-Check: PASSED

---
*Phase: 04-context-adaptive-execution*
*Completed: 2026-08-12*
