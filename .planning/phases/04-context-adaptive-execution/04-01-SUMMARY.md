---
phase: 04-context-adaptive-execution
plan: 01
subsystem: ai-context
tags: [token-budget, context-window, cjk, distribution, model-tiers, deterministic]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: ModelContextTier + classifyModelContext seed (P-3b home), contextHelper.estimateTokens migration seed, PromptSection kinds, TierResolver static-map precedent
provides:
  - Canonical model→context-window map (MODEL_CONTEXT_WINDOWS) + conservative resolver (D-04-04/06)
  - TokenBudget: CJK-aware estimateTokens, 70/20/10 computeBudgets, §2.2 distribution table, cap mapping (Pitfall 3)
  - Extended D-08 fixture: FIXED_MODEL_CONTEXT_WINDOWS, OVER_BUDGET_SECTIONS, CJK/mixed text samples
affects: [04-02 ContextCompressor, 04-04 ContextOptimizer, 04-05 StageInvocation window stamp, 04-06 contextHelper deletion re-point]

# Tech tracking
tech-stack:
  added: [] # nothing new — pure TS on the approved stack (R-9)
  patterns:
    - "Single canonical declaration (R-1): ModelContextTier.ts holds the ONLY model→window map"
    - "Caps drive degradation, never truncation (D-04-13): computeSectionCaps returns numbers the §2.4 ladder consumes"
    - "Deterministic pure-math core: no Date.now/crypto, zero model calls in optimization"

key-files:
  created:
    - src/core/context/TokenBudget.ts
    - tests/core/context/TokenBudget.test.ts
  modified:
    - src/core/context/ModelContextTier.ts
    - tests/fixtures/optimizedContext.ts

key-decisions:
  - "Assumption-delta: ModelContextTier = no-change — tier is DERIVED from the resolved window (D-04-04), no user-facing override setting invented"
  - "Unknown models resolve to conservative tiny (4096, windowKnown:false) — never assume large (D-04-06); values flagged [ASSUMED] A2..A6 behind user confirmation gates"
  - "History distribution column maps to [] (reserved-unfilled, D-04-16) — never a new PromptSection kind (R-1/R-2)"
  - "tool_result is uncapped-but-counted in totalTokens (Pitfall 3) — asserted by the OVER_BUDGET_SECTIONS totalTokens test"

patterns-established:
  - "Column→kind cap mapping is a TESTED constant (A9): SECTION_CAP_MAPPING encodes the planner's Pitfall-3 resolution"
  - "Per-section CJK ratio (>=0.3) selects divisor 3, else 4 — mixed script pays the higher-cost divisor (P4-13)"

requirements-completed: [CTX-01]

coverage:
  - id: D1
    description: "Canonical model→context-window map keyed by the five Appendix-D modelIds with a conservative resolver (known → map entry; unknown → 4096 + windowKnown:false, never large)"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: tests/core/context/TokenBudget.test.ts#resolves every canonical Appendix-D modelId to its known window
        status: pass
      - kind: unit
        ref: tests/core/context/TokenBudget.test.ts#falls back to conservative tiny (4096) with windowKnown:false for unknown models (D-04-06)
        status: pass
      - kind: unit
        ref: tests/core/context/TokenBudget.test.ts#classifyModelContext seed is byte-identical
        status: pass
    human_judgment: false
  - id: D2
    description: "TokenBudget module — CJK-aware estimateTokens (only token counter), §2.2 70/20/10 computeBudgets, per-tier distribution table, column→kind cap mapping, per-kind cap derivation (floored)"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: tests/core/context/TokenBudget.test.ts#computeBudgets (04-01 Task 2 — §2.2 70/20/10 formula)
        status: pass
      - kind: unit
        ref: tests/core/context/TokenBudget.test.ts#PER_TIER_DISTRIBUTION (04-01 Task 2 — §2.2 L444-449 verbatim)
        status: pass
      - kind: unit
        ref: tests/core/context/TokenBudget.test.ts#estimateTokens (04-01 Task 2 — D-04-10 CJK-aware heuristic)
        status: pass
      - kind: unit
        ref: tests/core/context/TokenBudget.test.ts#derives the medium User cap as 15% of the input budget
        status: pass
    human_judgment: false
  - id: D3
    description: "Extended D-08 fixture — FIXED_MODEL_CONTEXT_WINDOWS mirroring the map keys, OVER_BUDGET_SECTIONS ladder-trigger material (incl. uncapped-but-counted tool_result), CJK/English/mixed text samples"
    verification:
      - kind: unit
        ref: tests/core/context/TokenBudget.test.ts#fixture material (04-01 Task 3 — P4-15/WR-13)
        status: pass
      - kind: unit
        ref: tests/fixtures/fixtures.test.ts
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-08-12
status: complete
---

# Phase 04 Plan 01: Wave-1 Context Foundation Summary

**Canonical model→window map with a conservative unknown-model resolver, the CJK-aware token counter + §2.2 70/20/10 budget math + per-section cap table, and the extended D-08 fixture — the deterministic pure-core every later Phase-4 plan imports**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-12T05:21:35Z
- **Completed:** 2026-08-12T05:32:30Z
- **Tasks:** 3 (all `type="auto"`, tasks 1-2 TDD)
- **Files modified:** 4 (2 created, 2 extended in place)

## Accomplishments

- `MODEL_CONTEXT_WINDOWS` + `resolveModelContextWindow` extended IN PLACE in ModelContextTier.ts — five Appendix-D modelIds (`claude-haiku-4-latest: 200K`, `deepseek-chat: 64K`, `gemini-2.5-flash: 1M`, `llama3.2:3b: 4K`, `qwen2.5:7b: 4K`, values [ASSUMED] A2..A6), unlisted → `{ 4096, windowKnown: false }` (D-04-06 conservative tiny, never large). Seed `ModelContextTier`/`classifyModelContext` byte-identical (R-1).
- `TokenBudget.ts` — `estimateTokens` (migrated from contextHelper L28-30 + D-04-10 CJK rule: per-char unicode-class ratio ≥ 0.3 → divisor 3 else 4, zero-length → 0; the ONLY token counter), `computeBudgets` (§2.2 verbatim floor 70/20/10), `PER_TIER_DISTRIBUTION` (six-column table verbatim), `SECTION_CAP_MAPPING` (System→system+preferences, Tools→tool_schemas, Memory→memory, Context→context, History→reserved-unfilled D-04-16, User→user_input+task; tool_result uncapped-but-counted), `computeSectionCaps` (floored column% × inputBudget). Pure, deterministic, zero model calls — no slice/substring, no ai SDK imports (grep-gated).
- D-08 fixture extended IN PLACE (P4-15/WR-13): `FIXED_MODEL_CONTEXT_WINDOWS`, `OVER_BUDGET_SECTIONS` (medium-cap-exceeding + uncapped tool_result), `CJK_TEXT`/`ENGLISH_TEXT`/`MIXED_TEXT`. Determinism header + all pre-existing exports untouched.
- `TokenBudget.test.ts` green: 26 tests proving formula exactness, distribution rows, cap derivation per tier, estimateTokens boundaries (incl. the 0.3 edge), conservative-unknown-window, and that caps are finite degradation-drivers (never truncation).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ModelContextTier with the canonical window map + conservative resolver**
   - `8c45daa` (test — RED: resolver + suite scaffold)
   - `4960993` (feat — GREEN: map + resolver)
2. **Task 2: Create TokenBudget with the CJK-aware counter + 70/20/10 formula + per-section caps**
   - `3019594` (feat — GREEN: TokenBudget module)
3. **Task 3: Extend the D-08 fixture + write TokenBudget.test.ts**
   - `8412279` (test: fixture additions + completed suite)
   - `a156e3b` (style: prettier formatting on TokenBudget.ts + suite)

**Plan metadata:** (pending — `docs(04-01): complete …`)

_Note: Task 2's RED was authored with Task 1's suite; Task 3's cases completed the shared suite. TDD gates: RED (8c45daa, failing) → GREEN (4960993/3019594, passing) → test-completion (8412279)._

## Files Created/Modified

- `src/core/context/ModelContextTier.ts` - Extended IN PLACE: `MODEL_CONTEXT_WINDOWS` (Readonly five-key map, [ASSUMED] A2..A6) + `resolveModelContextWindow`; seed type + classifyModelContext untouched (R-1)
- `src/core/context/TokenBudget.ts` - NEW: estimateTokens / computeBudgets / PER_TIER_DISTRIBUTION / SECTION_CAP_MAPPING / computeSectionCaps — pure, deterministic
- `tests/fixtures/optimizedContext.ts` - Extended: FIXED_MODEL_CONTEXT_WINDOWS, OVER_BUDGET_SECTIONS, CJK_TEXT/ENGLISH_TEXT/MIXED_TEXT
- `tests/core/context/TokenBudget.test.ts` - NEW: 26 deterministic tests across all three tasks

## Decisions Made

- **ModelContextTier = no-change (assumption-delta):** tier is DERIVED from the resolved model window via `classifyModelContext` per-stage; ROADMAP criterion #1 "selectable" means follow-the-model, not a new user-facing override setting — a second source of truth could mismatch the actual window (cost landmine). Recorded in the plan header + this summary.
- **Unknown → tiny:** any unlisted modelId resolves to `{ 4096, windowKnown: false }` (D-04-06) — conservative by design, flagged in tests.
- **Caps are floats-floored:** `computeSectionCaps` floors column% × inputBudget so caps are integers (16_384 × 0.15 = 2457, not 2457.6) — keeps the budget math integer-deterministic for the 04-02/04-04 ladder consumers.
- **History column = reserved-unfilled (D-04-16):** maps to `[]` in SECTION_CAP_MAPPING — never a new PromptSection kind.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] computeSectionCaps returned fractional caps**
- **Found during:** Task 3 (cap-derivation assertions)
- **Issue:** `dist[column] * inputBudget` produced 2457.6 for medium User 15% × 16_384 — the §2.2 formula floors the budget, so derived caps should be integers; the plan's own behavior block expected `Math.floor(16_384 × 0.15) = 2457`
- **Fix:** `Math.floor(dist[column] * inputBudget)` inside computeSectionCaps
- **Files modified:** src/core/context/TokenBudget.ts
- **Verification:** all 26 suite tests pass; `caps.user_input === 2457`
- **Committed in:** 8412279 (Task 3 commit)

**2. [Rule 1 - Test fix] Miscounted CJK ratio in a RED-phase test comment/expectation**
- **Found during:** Task 3 run (estimateTokens boundary test failed)
- **Issue:** The Task-2 RED test asserted `estimateTokens('你好世界hello') === 4` with a "8 of 12" comment — the string is 4 CJK + 5 ASCII = 9 chars (ratio ≈ 0.44 → ceil(9/3) = 3). Implementation was correct; the test expectation was wrong
- **Fix:** Corrected expectation to 3 and the comment to "4 of 9 chars"
- **Files modified:** tests/core/context/TokenBudget.test.ts
- **Verification:** suite green; the 0.3-ratio edge remains pinned by the '你好好abcdefg' (exactly 0.3 → divisor 3) case
- **Committed in:** 8412279 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** Both fixes were correctness/test-accuracy corrections within the task scope — no scope creep, no architectural change.

## Issues Encountered

- The shared suite file was authored in Task 1's RED phase importing TokenBudget + the Task-3 fixture addition, so `pnpm typecheck` showed expected TS2307/TS2305 until Tasks 2-3 landed — mid-plan state, resolved by plan end (typecheck clean).
- Prettier flagged formatting drift in TokenBudget.ts + the test file after Task 3 — fixed in the `style` commit `a156e3b`; `prettier --check` clean on all four touched files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CTX-01's budget-math half is proven (26 deterministic tests); tier derivation + budget enforcement complete via 04-02 (compressor)/04-04 (optimizer)/04-05 (StageInvocation window stamp)/04-06 (contextHelper re-point).
- Ready for `04-02-PLAN.md` (ContextCompressor consumes computeSectionCaps + OVER_BUDGET_SECTIONS).
- Open assumption gates A2..A6 (model-window values) remain UNRESOLVED — flagged in the plan header; if a value is wrong, only the map constant + fixture change (caps scale via the same formula).

## Threat Flags

None — no new surface outside the plan's threat model: TokenBudget/ModelContextTier are pure core modules (no endpoints, no auth paths, no I/O, no schema changes at trust boundaries). T-04-01..T-04-05 dispositions hold: T-04-01 (DoS) mitigated by pinned cap math, T-04-02 (tampering) by Readonly + single declaration, T-04-03/04 accepted (pure math, no logging), T-04-05 no-op (no packages installed).

---

## Self-Check

- `src/core/context/ModelContextTier.ts` — FOUND (declarations of ModelContextTier/classifyModelContext/MODEL_CONTEXT_WINDOWS/resolveModelContextWindow each ×1)
- `src/core/context/TokenBudget.ts` — FOUND
- `tests/fixtures/optimizedContext.ts` — FOUND (FIXED_MODEL_CONTEXT_WINDOWS + OVER_BUDGET_SECTIONS + text samples exported)
- `tests/core/context/TokenBudget.test.ts` — FOUND (26 tests, green)
- Commits: `8c45daa` ✓ `4960993` ✓ `3019594` ✓ `8412279` ✓ `a156e3b` ✓
- Verification: `pnpm vitest run tests/core/context/TokenBudget.test.ts` → 26 passed; `pnpm typecheck` → clean; grep gates (no slice/substring, no @ai-sdk import) → CLEAN; full suite 66 files / 554 tests → green

## Self-Check: PASSED

---
*Phase: 04-context-adaptive-execution*
*Completed: 2026-08-12*
