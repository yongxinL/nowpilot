---
phase: 05-context-adaptive-execution
plan: 02
subsystem: testing
tags: [typescript, vitest, token-budget, context-assembly, provenance, minimal-mode, gate-fix]

# Dependency graph
requires:
  - phase: 05-context-adaptive-execution
    provides: plan 05-01's seven context modules (ModelContextTier, TokenBudget, ContextCompressor, ContextPack, ContextProvenanceManifest, ContextOptimizer, types) — the pure TS spine this plan's tests prove
provides:
  - tests/core/context/TokenBudget.test.ts — DONE-1 proofs: §2.1 tier boundaries, §1.4 caps, §2.2 budgets/distribution, D-71 CJK heuristic
  - tests/core/context/ContextCompressor.test.ts — D-75 proofs: structural/topk/tool-trim strategies + summarizer-seam drop-not-silence + closed CompressionType
  - tests/core/context/ContextOptimizer.test.ts — DONE-2/3/4 proofs: degradation ladder, never-oversized, CONTEXT_TOO_LARGE terminal, minimal-mode predicate, manifest-on-every-context
  - package.json — verify:phase-5 re-pointed to tests/core/context (D-78; spec 3609 canonical) — GREEN for the first time
affects: [Phase 7 (CTX-01..06 consume assemble + manifest-as-receipt), Phase 11 (PromptTrace lifts the trace surface), verify-work UAT routing (coverage block)]

# Actuals (#2632) — pairs with the plan's `estimate` (26000) to calibrate future estimates.
actuals:
  tokens: 7856    # 31423 chars / 4 over the realized diff (3 test files + package.json + sourceId fix)
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Input-builder fixture pattern (makeInput overrides-merge, OutcomeVerifier precedent) for ContextOptimizerInput
    - Bidirectional type-level closed-union assertion (type extends const-array both directions) for CompressionType
    - Never-oversized fixture-matrix loop asserting provenance.totalTokens <= inputBudget across every success fixture
    - A8 schema-parse validity checks (PromptSectionSchema) on every strategy output

key-files:
  created:
    - tests/core/context/TokenBudget.test.ts
    - tests/core/context/ContextCompressor.test.ts
    - tests/core/context/ContextOptimizer.test.ts
  modified:
    - package.json (verify:phase-5 re-point, D-78)
    - src/core/context/ContextOptimizer.ts (sourceIdFor — Rule 1/2 fix)

key-decisions:
  - "Coverage (7) 'penultimate minimal mode' interpreted per D-74: minimal-mode content reductions are consumer-side (flag + typed predicate ship); the penultimate-rung observable is the terminal's minimalMode:true + tiny-tier ok:true with rung 4/5/6 observables — not hard <=3-memory/<=1-safe-tool content asserts (rungs 5/6 are fit-based halving, never safety-filtered)"
  - "sourceId content is a genuine module bug (plan 05-01 step 8 LOCKED source identity) surfaced by Task 3 tests — fixed minimally via sourceIdFor() in the documented Task-3 module-fix window, never a test weakening"

patterns-established:
  - "truncatedSources carries real source identifiers (page URL / memory ids / tool names), never section bodies (T-05-03) — sourceIdFor() in ContextOptimizer"
  - "verify:phase-5 = 'tsc --noEmit && vitest run tests/core/context' — the D-78 gate, asserted EXACTLY via node -e (T-05-04)"

requirements-completed: []   # infra phase — no spec-native v1 IDs (ROADMAP Phase 5 note); acceptance = §18 DONE-when + D-69..D-78

# Coverage metadata (#1602) — deterministic UAT routing; all deliverables auto-pass on green tests.
coverage:
  - id: D1
    description: "DONE-1 — §2.1 tier boundary fixtures verbatim, §1.4 caps table, §2.2 70/20/10 floor budgets + per-tier distribution (sums-to-100), D-71 CJK heuristic (density gate + surrogate awareness)"
    verification:
      - kind: unit
        ref: "tests/core/context/TokenBudget.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-75 — ContextCompressor strategies: structural 40% ratio, top-k first-k + k=0, in-scope tool trim, summarizer-seam replacement + drop-not-silence fallback, closed CompressionType union"
    verification:
      - kind: unit
        ref: "tests/core/context/ContextCompressor.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "DONE-2 — §2.4 stepwise degradation in order (structural/topk rung observables), never-oversized guarantee, CONTEXT_TOO_LARGE terminal RETURNED (never thrown) with content-free message"
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "DONE-3 — isFeatureAllowedInMinimalMode asserts the §2.5 blocked set verbatim (7 literals false) + allowed/unknown true; tiny tier => minimalMode always true; minimal mode is the penultimate degradation step"
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "DONE-4 — every OptimizedContext carries a §2.6-verbatim schema-parsed manifest (7 records incl. system/task omissions, Q6 fields); truncatedSources derives from manifest truncated sourceIds"
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-78 — verify:phase-5 re-pointed to tests/core/context and GREEN (was RED: 'No test files found'); exact script asserted; verify:phase-8 untouched"
    verification:
      - kind: unit
        ref: "pnpm run verify:phase-5"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-08-29
status: complete
---

# Phase 5 Plan 2: Context Layer Proofs Summary

**Three §18-required test files pinning DONE-1..4 (tier/budget/heuristic, D-75 compressor strategies, degradation ladder + CONTEXT_TOO_LARGE terminal + minimal-mode predicate + provenance manifest) over the 05-01 modules, plus the D-78 gate re-point — `verify:phase-5` GREEN for the first time**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-29T21:19:00Z (approx)
- **Completed:** 2026-08-29T21:28:00Z (approx)
- **Tasks:** 3
- **Files modified:** 5 (3 test files created, package.json + ContextOptimizer.ts modified)

## Accomplishments

- **DONE-1 pinned:** `TokenBudget.test.ts` (17 tests) — §2.1 tier boundary fixtures verbatim (4096→tiny … 200000→large), §1.4 `contextTierCaps` (1/1 · 2/1 · 3/2 · 5/3), §2.2 floor budgets (10000→{7000,2000,1000}, 4096→{2867,819,409}), per-tier distribution verbatim with sums-to-100, `budgetForCategory` floor math, and the D-71 heuristic (EN ceil(len/4), CJK ceil(len/3) at density ≥0.30, stray-CJK density gate, U+20000 = one code point, empty = 0).
- **D-75 pinned:** `ContextCompressor.test.ts` (11 tests) — structural compression (40% body ratio, URL/TITLE header preserved, tokens recomputed), top-k first-k + k=0 empty section, in-scope tool trim preserving order, summarizer-seam replacement and the drop-not-silence fallback (keeps last 2 turns, truncated:true — never silent), CompressionType closed union via a bidirectional type-level assertion plus schema rejection of a 4th literal, and A8 schema validity on every strategy output.
- **DONE-2/3/4 pinned:** `ContextOptimizer.test.ts` (12 tests) — happy-path tier/budget/§1.3-order/pack-tally, schema-parsed manifest with 7 records (5 shipped + system/task omission records) + Q6 fields, empty trace on happy path, tiny⇒minimalMode, §2.5 predicate verbatim both lists, rung-4 (structural) and rung-6 (topk) observables with real sourceIds in `truncatedSources`, penultimate minimal mode (tiny overflow → ok:true with minimalMode active; small-tier overflow → terminal with minimalMode:true), never-oversized loop over the success-fixture matrix, and the CONTEXT_TOO_LARGE terminal returned (never thrown) with a content-free message.
- **D-78 closed:** `verify:phase-5` re-pointed from the mis-pointed Phase-8/9 dirs to `"tsc --noEmit && vitest run tests/core/context"` and runs GREEN (strict-clean tsc + 40 tests) — the gate that has been RED since Phase 5 began now passes. `tests/core/memory` references in package.json: 0; verify:phase-8 script string unchanged (1 match).
- **Module-fix window exercised:** Task 3's tests surfaced a genuine module bug — manifest `sourceId` carried the manifest kind ('context'/'memory') instead of the LOCKED source identity — fixed minimally in `ContextOptimizer.ts` (see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 1: TokenBudget.test.ts — DONE-1 tier/budget/distribution/CJK heuristic proofs** - `f6aec35` (test)
2. **Task 2: ContextCompressor.test.ts — D-75 compressor strategies + summarizer-seam fallback** - `b20b935` (test)
3. **Task 3: ContextOptimizer.test.ts + D-78 verify:phase-5 re-point + sourceId module fix** - `1002cd9` (test)

**Plan metadata:** SUMMARY committed separately (state updates are orchestrator-owned).

## Files Created/Modified

- `tests/core/context/TokenBudget.test.ts` - DONE-1 proofs (17 tests): tier boundaries, §1.4 caps, budgets, distribution, CJK heuristic
- `tests/core/context/ContextCompressor.test.ts` - D-75 proofs (11 tests): strategies + summarizer-seam fallback + closed CompressionType
- `tests/core/context/ContextOptimizer.test.ts` - DONE-2/3/4 proofs (12 tests): degradation ladder, terminal, minimal mode, manifest, never-oversized, pack tally
- `package.json` - verify:phase-5 re-pointed to `tsc --noEmit && vitest run tests/core/context` (D-78)
- `src/core/context/ContextOptimizer.ts` - `sourceIdFor()`: manifest records carry the LOCKED source identity (Rule 1/2 fix)

## Decisions Made

- **Coverage (7) — "penultimate minimal mode" interpreted per D-74.** The plan's prose expected ok:true + minimalMode:true with memory ≤ 3 lines and tools ≤ 1 safe tool on a non-tiny overflow fixture. D-74 locks minimal-mode CONTENT reductions as consumer-side semantics (Phase 5 ships the flag + the typed predicate); rungs 5/6 are fit-based halving (never safety-filtered, stop points follow the halving chain 100→50→25→13→7→4→2→1, so a hard ≤ 3 is unreachable); and rung 7 fires only while still over budget, so non-tiny ok:true + minimalMode:true is structurally impossible. The tests instead assert the acceptance-criteria phrase — the penultimate rung observable: (a) tiny-tier overflow → ok:true with minimalMode active + structural/topk rung observables, and (b) small-tier overflow past rungs 4/5/6 → terminal with minimalMode:true (minimal mode entered immediately before the terminal).
- **sourceId content is a genuine module bug, not a spec choice.** Plan 05-01 step 8 (LOCKED) defines sourceId as the section's source identity (CONTEXT: pageContext.url; MEMORY: hint ids; TOOL SCHEMAS: tool names); the module shipped manifest-kind sourceIds. Task 3's tests surfaced it (3 failures: `truncatedSources` = ['context']/['memory'] instead of the URL/ids) and the fix landed in the documented Task-3 module-fix window — a test is never weakened.
- No other decisions beyond the plan — Q1-Q6 semantics all held as built in 05-01.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Manifest sourceId carried the manifest kind instead of the LOCKED source identity**
- **Found during:** Task 3 (ContextOptimizer.test.ts — 3 failing assertions)
- **Issue:** `buildSourcedSections` set `record.sourceId = manifestKind`, so `truncatedSources` derived as ['context']/['memory']/['tool_schemas'] — not the page URL / memory ids / tool names the 05-01 plan's step 8 locked and this plan's coverage (6) + threat model T-05-03 require. The manifest's §2.6 purpose ("where each section came from") and the §19.3 trace both need real source identifiers.
- **Fix:** Added `sourceIdFor(kind, input)` — CONTEXT → pageContext.url (else 'context'); MEMORY → hint ids joined ','; TOOL SCHEMAS → name-sorted tool names joined ','; preferences/user_input keep their manifest kind.
- **Files modified:** `src/core/context/ContextOptimizer.ts`
- **Verification:** All 3 previously-failing tests pass; `npx vitest run tests/core/context` = 40/40; `pnpm run verify:phase-5` GREEN (tsc strict-clean)
- **Committed in:** `1002cd9` (part of the Task 3 commit)

**2. [Scope note - test interpretation] Coverage (7) asserted per D-74 rather than the plan's literal prose**
- **Found during:** Task 3 authoring (before any test run — behavior analysis of the module's rung 5/6/7 design)
- **Issue:** The plan's coverage (7) prose ("ok:true with memory ≤ 3 lines and tools ≤ 1 safe tool") describes §2.5 content semantics that D-74 deliberately keeps consumer-side and that the module's fit-based halving cannot produce (see Decisions). Weakening the test would be forbidden; the honest assertion set is the plan's OWN acceptance-criteria phrase ("penultimate minimal mode").
- **Fix:** No code change. Coverage (7) asserts the penultimate-rung observables the module genuinely produces (tiny overflow ok:true + minimalMode, small-tier terminal minimalMode:true, structural/topk records, memory below initial count, tools ≤ 1 line).
- **Files modified:** none (test scope documented here)
- **Verification:** All 12 ContextOptimizer tests green; gate GREEN

---

**Total deviations:** 2 (1 Rule 1 bug auto-fixed, 1 documented test-interpretation scope note)
**Impact on plan:** The Rule 1 fix was required for the plan's own T-05-03 mitigation and the LOCKED 05-01 sourceId spec. The coverage-(7) interpretation keeps every assertion a genuine module behavior — no tests weakened, no scope creep (one minimal module edit in the plan's own documented fix window).

## Issues Encountered

- **Write-tool payload truncation (environment):** the first SUMMARY.md Write call exceeded the tool-call output cap and was rejected mid-payload — resolved with the incremental sentinel-write fallback (frontmatter first, then two Edit appends). No content lost.
- **No other issues** — the three test files and the sourceId fix ran green on first execution after the module fix.

## Known Stubs

None — the three test files contain no placeholders; the module fix is real implementation, not a stub. The D-75 Summarizer seam and D-71 TokenCounter seam remain declare-now design decisions (unchanged from 05-01, consumer-owned when the owning phases ship).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 5 is now fully automated:** `pnpm run verify:phase-5` GREEN (tsc strict-clean + 40 tests) — the §18 DONE-when list (tier tests pass · overflow degrades stepwise with truncatedSources · minimal mode blocks MCP chaining/LLM-Wiki RAG via the typed predicate · manifest on every OptimizedContext) is regression-pinned.
- **Phase 7 (CTX-01..06):** consumes `assemble()` and the manifest-as-receipt; the trace surface now carries real source identifiers (page URL / memory ids / tool names) ready for `PromptTrace`/receipt semantics.
- **Phase 6/8/18:** replace the supersession-point shapes in place at their canonical homes — unchanged by this plan.
- **Phase 11:** lifts the `contextTier`/`truncated`/`truncatedSources`/`minimalMode` trace surface into `PromptTrace`; the derived trace is now proven to carry sourceIds only.
- **No blockers.**

---
*Phase: 05-context-adaptive-execution*
*Completed: 2026-08-29*

## Self-Check: PASSED

- [x] All three §18 test files exist under `tests/core/context/` and pass (40/40)
- [x] `pnpm run verify:phase-5` GREEN — tsc strict-clean + `vitest run tests/core/context` (D-78 closed)
- [x] `node -e` exact-script assertion passes (`tsc --noEmit && vitest run tests/core/context`)
- [x] `grep -c "tests/core/memory" package.json` = 0 (the file's only reference, on the re-pointed line, is gone)
- [x] `grep -c "vitest run tests/core/content tests/addons tests/isolation" package.json` = 1 (verify:phase-8 untouched)
- [x] Zero `@ts-expect-error NP-STRICT` markers in all three test files (grep-asserted)
- [x] Task commits f6aec35, b20b935, 1002cd9 exist in git history
- [x] Zero deletions in the final task commit (post-commit deletion check)