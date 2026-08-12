---
phase: 04-context-adaptive-execution
plan: 04
subsystem: ai-context
tags: [context-optimizer, degradation-ladder, minimal-mode, compact-prompts, context-too-large, provenance-manifest, drop-in, deterministic]

# Dependency graph
requires:
  - phase: 04-context-adaptive-execution
    provides: TokenBudget estimateTokens/computeBudgets + PER_TIER_DISTRIBUTION (04-01), ContextPack.packSections + ContextCompressor ladder primitives + LADDER_STEPS registry (04-02), ContextProvenanceManifest D-04-17 fields + Zod schema + LADDER_STEP_NAMES (04-03)
provides:
  - ContextOptimizer.optimize — the §2.3 drop-in orchestrator (D-04-08): classify tier from the resolved window (D-04-04), §2.2 budgets, §1.3 packing, the §2.4 ladder in D-04-12 order, §2.5 minimal mode (compact constants + ≤1 safe tool schema, D-04-11/14), and a Zod-validated ContextProvenanceManifest on every return (D-04-17/GR-4)
  - The typed CONTEXT_TOO_LARGE terminal (D-04-15): ContextTooLargeError + isContextTooLargeError guard, canonical §C.2 code (errorCodes.ts)
  - Compact per-role prompt constants (PROMPTS.planner.compact.system / renderer.compact.system, Appendix A addendum) + the CTX-02 typed input-only seam (ContextUpdate) on the optimizer input contract
affects: [04-05 ProviderRouter window stamp (already complete — feeds modelContextWindow), 04-06 hook rewire (imports optimize + isContextTooLargeError; contextHelper deletion; drop-in-identity snapshot handoff), 04-07 W-1 gate (spec Appendix A compact mirror + C.2 re-verify)]

# Tech tracking
tech-stack:
  added: [] # nothing new — pure TS on the approved stack (R-9)
  patterns:
    - "Typed-error-carrier terminal (StructuredOutput.ts precedent): ContextTooLargeError interface + isContextTooLargeError guard co-located; code/reason/numbers on the error object"
    - "Constant selection, never authorship (GR-3/D-04-11): the optimizer reads PROMPTS.*.compact.* — prompt text lives only in src/core/prompts/index.ts"
    - "Zod-validated public boundary (GR-4/T-04-19): every stamped manifest passes ContextProvenanceManifestSchema.safeParse before leaving the context layer — failure debugLogs SCHEMA_INVALID + throws"
    - "Section-granular degradation (D-04-13): whole-section drops only; zero slice/substring in the module (grep-gated); user_input never modified (P4-10)"

key-files:
  created:
    - src/core/context/ContextOptimizer.ts
    - tests/core/context/ContextOptimizer.test.ts
  modified:
    - src/core/prompts/index.ts
    - src/core/error/errorCodes.ts
    - src/core/ai/types.ts

key-decisions:
  - "Minimal-mode [SYSTEM] = `${compact per-role constant}\n\n${personaBlock}` — the compact constant with the persona block APPENDED (persona-aware from day one, Phase-3 precedent; flagged assumption); the default path stays persona-block-only, byte-identical to Phase 3 (D-04-07 cache-stability)"
  - "stepsFired records only REAL ladder firings: no-op steps (drop-secondary/summarise/compress/reduce-topk) pass through unrecorded; tiny-mandate minimal mode is recorded by the minimalMode manifest field, not a firing — only LADDER escalation pushes 'minimal-mode' (matches D-04-17 'steps that fired this turn', empty when no degradation)"
  - "The ≤1-safe-tool-schema cap (D-04-14) applies at PACK time via atMostOneSafeTool (first non-dangerous ref); the ladder's trim-tools step stays structurally present with an always-in-scope predicate (P4 pack derives sections from the caller-selected schemas, so nothing is ever out of scope in P4)"
  - "Compact constant texts drafted Appendix A-style (short, directive, JSON-only planner / concise-context-only renderer) — flagged planner-discretion; mirrored into spec Appendix A in 04-07 (W-1 gate)"
  - "CONTEXT_TOO_LARGE added IN PLACE to errorCodes.ts (Phase-4 block) mirroring spec C.2 L3512/L5040; the W-1 gate (04-07) re-verifies the spec mirror line-anchored"

patterns-established:
  - "Ladder driver pattern: the optimizer iterates the tested LADDER_STEPS registry (04-02), stopping at the first budget-met checkpoint — real steps act, no-ops break, 'too-large' throws the typed terminal"
  - "Additive input-extension pattern: ContextOptimizerInput grew personaBlock/stage/contextUpdate IN PLACE while OptimizedContext/PromptSection stayed untouched (D-04-07 — Planner/Renderer remain import-swap-only consumers)"

requirements-completed: [CTX-01, CTX-02, CTX-03, CTX-04]

coverage:
  - id: D1
    description: "Canonical compact per-role prompt constants (PROMPTS.planner.compact.system cacheable:true tier:haiku + renderer.compact.system cacheable:true tier:flash) selected ONLY by ContextOptimizer minimal mode (D-04-11, GR-3), plus the canonical CONTEXT_TOO_LARGE error code in errorCodes.ts mirroring spec C.2 (L3512/L5040)"
    requirement: CTX-03
    verification:
      - kind: unit
        ref: tests/core/context/ContextOptimizer.test.ts#tiny is mandatory minimal: compact planner [SYSTEM] + persona block appended, ≤1 tool schema
        status: pass
      - kind: unit
        ref: tests/core/context/ContextOptimizer.test.ts#renderer stage selects the renderer compact constant in minimal mode
        status: pass
      - kind: other
        ref: "grep gate: PROMPTS.*.compact.system consumed only by ContextOptimizer.ts (compact.system src grep)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CTX-02 typed input-only seam: ContextUpdate type ('page'|'memory'|'history'|'state') + contextUpdate? on ContextOptimizerInput, plus the flagged additive personaBlock/stage fields — output shape untouched (D-04-07), StageEvent stays a TYPE, never an event bus (L1), no consumer in P4"
    requirement: CTX-02
    verification:
      - kind: unit
        ref: tests/core/context/ContextOptimizer.test.ts#contextUpdate present returns output deep-equal to absent (typed input, no consumer in P4)
        status: pass
      - kind: other
        ref: "grep gate: no subscribe/publish/emit API in src/core/context/ or types.ts (only L1 documentation comments)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ContextOptimizer.optimize — the §2.3 drop-in (D-04-08): tier + §2.2 budgets derived from the resolved window (D-04-04), §1.3 ContextPack packing, the §2.4 degradation ladder in D-04-12 order (drop-debug + trim-tools real, no-ops pass through), §2.5 minimal mode (compact constant + ≤1 safe tool schema), and the typed CONTEXT_TOO_LARGE terminal (D-04-15 — never a silent truncation)"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: tests/core/context/ContextOptimizer.test.ts#classifies every boundary window exactly with the §2.2 floored budgets
        status: pass
      - kind: unit
        ref: tests/core/context/ContextOptimizer.test.ts#an over-budget small-window turn steps the ladder: stepsFired + totalTokens dropping
        status: pass
      - kind: unit
        ref: tests/core/context/ContextOptimizer.test.ts#absurd userInput beyond even minimal mode throws the typed terminal
        status: pass
      - kind: unit
        ref: tests/core/context/ContextOptimizer.test.ts#default path deep-equals contextHelper.buildOptimizedContext for equivalent inputs
        status: pass
    human_judgment: false
  - id: D4
    description: "Zod-validated ContextProvenanceManifest stamped on every OptimizedContext return (D-04-17: tier/model/window/counterMethod:'heuristic'/stepsFired + per-section tokens/truncated/compressionApplied) — schema.safeParse at the public boundary, failure debugLogs SCHEMA_INVALID + throws (GR-4/GR-9, T-04-19)"
    requirement: CTX-04
    verification:
      - kind: unit
        ref: tests/core/context/ContextOptimizer.test.ts#stamps a Zod-valid ContextProvenanceManifest on every return (D-04-17/GR-4, T-04-19)
        status: pass
      - kind: unit
        ref: tests/core/context/ContextOptimizer.test.ts#an under-budget turn fires no ladder steps (stepsFired empty — no degradation)
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-08-12
status: complete
---

# Phase 04 Plan 04: Context Optimizer Orchestration Summary

**The §2.3 drop-in ContextOptimizer (D-04-08) — tier/budgets from the resolved model window, §1.3 packing, the §2.4 degradation ladder in D-04-12 order, §2.5 minimal mode with the new compact per-role constants (D-04-11) and ≤1 safe tool schema, the typed CONTEXT_TOO_LARGE terminal (D-04-15), and a Zod-validated ContextProvenanceManifest on every return (D-04-17/GR-4) — plus the CTX-02 typed input-only seam on the extended optimizer input contract**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-12T06:26:53Z
- **Completed:** 2026-08-12T06:37:30Z
- **Tasks:** 3 (Task 1 `feat`; Task 2 TDD `test`→`feat`; Task 3 `test`)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `ContextOptimizer.ts` — `optimize(input): OptimizedContext` implements the §2.3 contract end-to-end (per-stage: the 04-05 window stamp feeds `modelContextWindow`): `classifyModelContext(window)` → tier (D-04-04); `TokenBudget.computeBudgets(window)` → input/output budgets (§2.2); `ContextPack.packSections` → §1.3 sections; over-budget → the §2.4 ladder iterating the tested `LADDER_STEPS` registry in D-04-12 order (`drop-debug` + `trim-tools` are real whole-section steps, the notes/history/page/memory steps pass through as structural no-ops, `minimal-mode` re-packs with the compact constant + ≤1 safe tool schema, `too-large` throws the honest typed terminal — never a silent truncation, P4-10). Stamps the `ContextProvenanceManifest` (D-04-17: tier/model/window/`counterMethod:'heuristic'`/`stepsFired` + per-section tokens/`truncated:false`) and runs `ContextProvenanceManifestSchema.safeParse` at the boundary (GR-4; failure → `SCHEMA_INVALID` debugLog + throw, T-04-19). Default path is byte-identical to the Phase-3 persona-block-only [SYSTEM] (D-04-07 cache-stability, re-pinned by the drop-in regression). `ContextTooLargeError` (code `CONTEXT_TOO_LARGE`, reason `minimal_mode_exceeded`, `totalTokens`, `inputBudget`) + `isContextTooLargeError` guard follow the StructuredOutput typed-error-carrier precedent (04-06 hook consumer). Zero model calls/async/network, no provider-SDK or React imports, no slice/substring (grep-gated).
- Minimal mode (D-04-14/§2.5): mandatory at tier `tiny`, escalated by the ladder for larger tiers. [SYSTEM] = the new compact per-role constant (planner haiku / renderer flash, D-04-11 — GR-3: the optimizer SELECTS from `src/core/prompts/index.ts`, never authors) with the persona block appended (persona-aware from day one); tool refs capped to ≤1 safe schema (`atMostOneSafeTool`). The optimizer only marks `minimalMode` — MCP-chaining/RAG enforcement is capsForTier (04-06) + a Phase-5a consumer concern (D-04-14).
- Input contract extended IN PLACE (additive — `OptimizedContext`/`PromptSection` untouched, D-04-07): required `personaBlock: string` (F-5 byte-stable [SYSTEM]), required `stage: 'planner' | 'renderer'` (per-role compact selection), and the D-04-02 CTX-02 seam `contextUpdate?: ContextUpdate` (`{ type: 'page' | 'memory' | 'history' | 'state' }`, typed input-only re-pack signal — StageEvent stays a TYPE, never an event bus, L1; no consumer in P4, output identical with/without it).
- `errorCodes.ts` gained `CONTEXT_TOO_LARGE` IN PLACE (Phase-4 block, comment citing spec C.2 L3512/L5040 + the 04-07 W-1 gate). `tests/core/context/ContextOptimizer.test.ts` — 17 deterministic tests: exact §2.1/§2.2 boundaries (4096 tiny → 200_000 large), minimal-mode selection (planner + renderer compact constants, ≤1 tool), ladder order (over-budget small-window turn fires `['minimal-mode']` with totalTokens dropping back under budget), drop-in identity (sections deep-equal `contextHelper.buildOptimizedContext` for equivalent English inputs — the live import is the 04-06 Task-3 snapshot handoff), cache-stability (identical inputs deep-equal), the typed terminal (`isContextTooLargeError` + code/reason/totalTokens/inputBudget), the CTX-02 seam, user_input-never-modified + known-texts-only granularity invariants, and manifest Zod-validity on every return.

## Task Commits

Each task was committed atomically (TDD: test → feat for Task 2):

1. **Task 1: Add compact prompt constants + the CONTEXT_TOO_LARGE canonical code** - `94014c6` (feat)
2. **Task 2: Extend the optimizer input contract (CTX-02 seam) + create ContextOptimizer**
   - `645005b` (test — RED: tier/budget, minimal-mode, terminal, seam behavior cases)
   - `2295919` (feat — GREEN: types.ts extension + ContextOptimizer.ts)
3. **Task 3: Write ContextOptimizer.test.ts — tiers, ladder, minimal mode, drop-in identity, terminal, CTX-02 seam** - `6962638` (test: completed suite)

**Plan metadata:** (pending — `docs(04-04): complete …`)

## Files Created/Modified

- `src/core/context/ContextOptimizer.ts` - NEW: `optimize` (drop-in §2.3 orchestrator), `ContextTooLargeError` + `isContextTooLargeError`, `buildPackInput`/`compactSystemFor`/`atMostOneSafeTool` helpers; ladder driver over `LADDER_STEPS`; manifest stamping + Zod validation
- `tests/core/context/ContextOptimizer.test.ts` - NEW: 17 deterministic tests across the three tasks
- `src/core/prompts/index.ts` - MODIFIED: `planner.compact.system` + `renderer.compact.system` (D-04-11, Appendix A addendum, cacheable + tier)
- `src/core/error/errorCodes.ts` - MODIFIED: `CONTEXT_TOO_LARGE` (Phase-4 block, spec C.2 mirror)
- `src/core/ai/types.ts` - MODIFIED: `ContextUpdate` + `ContextOptimizerInput.personaBlock`/`stage`/`contextUpdate?` (additive, D-04-07/D-04-02)

## Decisions Made

- **Minimal-mode [SYSTEM] join = `${compact}\n\n${personaBlock}`:** the compact constant with the persona block appended (persona-aware from day one, Phase-3 precedent — flagged assumption). The DEFAULT path stays persona-block-only (byte-identical to Phase 3, cache-stability).
- **stepsFired = real firings only:** no-op ladder steps never record; tiny-mandate minimal mode is carried by the manifest's `minimalMode` flag, not a stepsFired entry — only LADDER escalation pushes `'minimal-mode'`. The ladder-order test pins `['minimal-mode']` for the small-window escalation turn and `[]` for the under-budget large turn.
- **≤1 safe tool at pack time:** `atMostOneSafeTool` (first non-dangerous ref) applies inside `buildPackInput` for minimal mode; the ladder's `trim-tools` step stays structurally present with an always-in-scope predicate — P4 pack derives sections from the caller-selected schemas so nothing is out of scope in P4 (the mechanism + registry slot are real, T-04-08).
- **Compact texts drafted Appendix A-style** (planner: JSON-only action selection; renderer: concise context-only) — flagged planner-discretion; mirrored to spec Appendix A in 04-07 (W-1 gate).
- **`contextUpdate` seam is input-only:** the optimizer's output is identical with or without it (pinned by deep-equal tests) — the re-pack trigger consumers arrive in Phase 4a/7.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The opencode LSP produced persistent stale "Cannot find module '@/core/context/ContextOptimizer'/'TokenBudget'/'ContextPack'/'ContextCompressor'" + cascading implicit-any diagnostics even after the modules were created and verified green (same spurious LSP-cache pattern documented in 04-01/04-02/04-03). The actual gates (`vitest run`, `tsc --noEmit`, eslint) were all clean; the LSP cache is not a build-state signal.
- Prettier flagged formatting drift on the test file after Task 3's additions — fixed with `prettier --write` before commit; `prettier --check` clean on all five touched files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **CTX-01/02/03/04 proven by the optimizer suite** (17 tests): tier/budget derivation from the resolved window, the typed input-only seam, minimal-mode compact-prompt selection, and the ladder + honest terminal all pinned. CTX-01/02/03/04 remain unresolved *spec-probe* items (#1110) by design until the phase gate seals them.
- **04-05 is already complete** — `StageInvocation.modelContextWindow` (window stamp) is the input contract this plan consumes; the 04-06 hook reads it per stage and feeds `optimize()`.
- **04-06 handoff contract:** the hook imports `optimize` + `isContextTooLargeError` from `@/core/context/ContextOptimizer` (no PROMPTS import, no budget math — Pitfall 7); the drop-in-identity test's live `buildOptimizedContext` import is replaced with a hardcoded Phase-3 snapshot BEFORE `contextHelper.ts` is deleted (Task 3); PersonaInjector.test.ts re-points its builder call sites to `optimize`.
- **04-07 W-1 gate:** mirrors the compact constants into spec Appendix A and re-verifies `CONTEXT_TOO_LARGE` in spec C.2 (already present at L3512/L5040 — verified this plan).

## Threat Flags

None — no new surface outside the plan's threat model: ContextOptimizer is a pure core module (no endpoints, no auth paths, no I/O). T-04-15 mitigated (typed CONTEXT_TOO_LARGE terminal tested — the oversized prompt is never sent; user_input never sliced), T-04-16 mitigated (tiny ⇒ mandatory minimalMode with ≤1 safe tool schema; capsForTier enforcement follows in the 04-06 hook), T-04-17 mitigated (compact constants only in prompts/index.ts — optimizer selects, never authors; default path byte-identical), T-04-18 mitigated (only the SCHEMA_INVALID debugLog carries code + module, never section text/user input), T-04-19 mitigated (manifest Zod boundary at the public boundary — tested), T-04-20 no-op (no packages installed).

---

## Self-Check

- `src/core/context/ContextOptimizer.ts` — FOUND (optimize + ContextTooLargeError + isContextTooLargeError exported)
- `tests/core/context/ContextOptimizer.test.ts` — FOUND (17 tests, green)
- `src/core/prompts/index.ts` — FOUND (planner.compact.system + renderer.compact.system)
- `src/core/error/errorCodes.ts` — FOUND (CONTEXT_TOO_LARGE)
- `src/core/ai/types.ts` — FOUND (ContextUpdate + personaBlock/stage/contextUpdate; OptimizedContext/PromptSection untouched)
- Commits: `94014c6` ✓ `645005b` ✓ `2295919` ✓ `6962638` ✓
- TDD gate: RED `645005b` (test) precedes GREEN `2295919` (feat) ✓
- Verification: `pnpm vitest run tests/core/context` → 77 passed (4 files: TokenBudget 26 + Compressor 26 + Manifest 8 + Optimizer 17); `pnpm typecheck` → clean; eslint → clean on all five files; prettier --check → clean; grep gates (no slice/substring in src/core/context, no subscribe/publish/emit API in the context layer or types.ts seam, compact.system consumed only by ContextOptimizer) → CLEAN; full suite 69 files / 605 tests → green (was 68/588 in 04-03)

## Self-Check: PASSED

---
*Phase: 04-context-adaptive-execution*
*Completed: 2026-08-12*
