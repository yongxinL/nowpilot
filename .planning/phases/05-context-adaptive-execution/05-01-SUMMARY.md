---
phase: 05-context-adaptive-execution
plan: 01
subsystem: infra
tags: [zod, typescript, token-budget, prompt-cache, context-assembly, provenance]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: A8 PromptSection contract (src/core/ai/types.ts:95-101), ModelTierSchema z.enum pattern, UserPreferences canonical type
provides:
  - src/core/context/ModelContextTier.ts — §2.1 classifyModelContext + unwired §1.4 contextTierCaps
  - src/core/context/TokenBudget.ts — §2.2 budgets + distribution + D-71 TokenCounter seam
  - src/core/context/ContextCompressor.ts — D-75 pure strategies + summariser seam
  - src/core/context/ContextPack.ts — §1.3 canonical-order pack()
  - src/core/context/ContextProvenanceManifest.ts — §2.6 verbatim manifest + buildManifest
  - src/core/context/ContextOptimizer.ts — assemble() + §2.4 degradation ladder + D-74 predicate
  - src/core/context/types.ts — PageContext/RetrievedMemory/ToolSchemaRef supersession points
affects: [05-02 (test files), Phase 6 (PageContext canonical home), Phase 7 (CTX-01..06 context receipts), Phase 8 (RetrievedMemory canonical home), Phase 11 (PromptTrace), Phase 18 (ToolSchemaRef registry type)]

# Actuals (#2632) — pairs with the plan's `estimate` (38000) to calibrate future estimates.
actuals:
  tokens: 9277    # 37109 chars / 4 over the seven new modules (realized diff)
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Supersession-point minimal shapes (UserPreferences precedent) for PageContext/RetrievedMemory/ToolSchemaRef
    - Declare-now/populate-later seams (D-71 TokenCounter, D-75 Summarizer)
    - Returned discriminated union results, never throws (AssembleResult)
    - Manifest-derived truncation trace (truncatedSources from manifest, never raw bodies)
    - Hard-coded §1.3 canonical-order assembly via kind→index table (never alphabetical sort)

key-files:
  created:
    - src/core/context/types.ts
    - src/core/context/ModelContextTier.ts
    - src/core/context/TokenBudget.ts
    - src/core/context/ContextCompressor.ts
    - src/core/context/ContextPack.ts
    - src/core/context/ContextProvenanceManifest.ts
    - src/core/context/ContextOptimizer.ts
  modified: []

key-decisions:
  - "Q1: minimal PageContext/RetrievedMemory/ToolSchemaRef shapes live in src/core/context/types.ts (discretion-sanctioned sibling), each with a supersession-point comment"
  - "Q2: budget→section mapping locked — history lives INSIDE [CONTEXT] (the manifest has no 'history' kind)"
  - "Q3: assemble() emits only the sourced five kinds; SYSTEM/TASK recorded as by-design omission records (truncated:true, 0 tokens) in the manifest"
  - "Q4: CONTEXT_TOO_LARGE returned as the discriminated union { ok:false, code, message, totalTokens, inputBudget, minimalMode, truncatedSources } — never a throw; not added to StreamErrorCodeSchema (D-38)"
  - "Q5: §1.4 contextTierCaps helper SHIPPED unwired (zero production call sites, D-70)"
  - "Q6: workspaceId/activeSurface REQUIRED with no defaults (empty-string defaults would poison provenance records)"
  - "D-72: ContextOptimizer re-exports PromptSection from src/core/ai/types — single source of truth preserved, zero Phase-3 files edited"
  - "No barrel index.ts in src/core/context — direct path imports only (mirrors src/core/ai)"

patterns-established:
  - "Pure, UI-agnostic core modules — zero React/chrome/storage imports across all seven files"
  - "Zod schema-first cross-boundary shapes (ModelContextTierSchema, ContextProvenanceManifestSchema)"
  - "Degradation ladder with per-rung re-tallying — an ok:true context can never exceed inputBudget (roadmap SC#2)"
  - "Ladder rungs 1/2 are RESERVED no-ops (no debug/notes source in the §2.3 input; Phase-7 caller supplies them) — documented in code so the §2.4 order stays walkable verbatim"

requirements-completed: []   # infra phase — no spec-native v1 IDs (ROADMAP Phase 5 note; acceptance = §18 DONE-when + D-69..D-78)

# Metrics
duration: 18min
completed: 2026-08-29
status: complete
---

# Phase 5 Plan 1: Context Spine Summary

**Seven-module context layer — tier classification, CJK-aware token budgeting, §2.4 stepwise degradation ladder, §1.3 canonical packing, and a §2.6 provenance manifest on every OptimizedContext — all pure TS, strict-clean, wired through one end-to-end `assemble()` call**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-29T10:47:00Z (approx)
- **Completed:** 2026-08-29T11:03:17Z
- **Tasks:** 1
- **Files modified:** 7 created, 0 modified

## Accomplishments

- Built the complete §18 context-layer inventory — `types.ts`, `ModelContextTier.ts`, `TokenBudget.ts`, `ContextCompressor.ts`, `ContextPack.ts`, `ContextProvenanceManifest.ts`, `ContextOptimizer.ts` — with the locked D-69..D-78 semantics, all spec-verbatim.
- `ContextOptimizer.assemble(ContextOptimizerInput) → AssembleResult` traverses every layer: tier classification → budget computation → per-section token counting → §2.4 degradation ladder (re-tallying after every rung) → §1.3 canonical packing → §2.6 provenance manifest → OptimizedContext with the derived trace surface (`contextTier`/`truncated`/`truncatedSources`/`minimalMode`, D-77). Never a throw: overflow past minimal mode returns the typed `CONTEXT_TOO_LARGE` union variant (canonical §21.6 literal, `StreamErrorCodeSchema` untouched).
- The D-72 `PromptSection` re-export from `src/core/ai/types` resolves PromptCacheAdapter's spec import-target note; zero Phase-3 files modified (D-69/D-70/D-72 create-only boundary holds, git-diff-asserted).
- The six research open questions are locked as decisions in module comments (Q1 types.ts home · Q2 budget→section mapping · Q3 SYSTEM/TASK omission records · Q4 CONTEXT_TOO_LARGE union · Q5 caps helper shipped unwired · Q6 workspaceId/activeSurface required).
- Temporary runtime smoke test (20 tests, deleted before commit — behavioral tests land in 05-02) proved the spine executes: tier boundaries, budgets, distribution sums, CJK-aware counter, canonical packing, manifest omissions, compressor strategies, happy path, stepwise overflow degradation with `compressionApplied:'structural'` records, extreme-overflow terminal, and the §2.5 minimal-mode predicate.

## Task Commits

Each task was committed atomically:

1. **Task 1: Context spine — the seven §18 modules wired end-to-end** - `7e1fe86` (feat)

**Plan metadata:** no final docs commit yet in this plan (state updates are orchestrator-owned).

## Files Created/Modified

- `src/core/context/types.ts` - PageContext/RetrievedMemory/ToolSchemaRef supersession points (Phase 6/8/18 canonical homes), `CompressionType`, `Summarizer` seam (D-75)
- `src/core/context/ModelContextTier.ts` - `ModelContextTierSchema` z.enum + `classifyModelContext` §2.1 verbatim + unwired `contextTierCaps` §1.4 helper (D-70)
- `src/core/context/TokenBudget.ts` - `computeBudgets` 70/20/10 + `DISTRIBUTION` six-category table (each tier sums 100) + `budgetForCategory` + D-71 `TokenCounter` seam with CJK-density-gated `countTokensHeuristic` (0.30 threshold, code-point-aware)
- `src/core/context/ContextCompressor.ts` - D-75 pure strategies: `compressStructural` (40% body ratio), `reduceTopK`, `trimToolSchemas`, `summarizeHistory` (summarizer seam, drop-not-silence fallback)
- `src/core/context/ContextPack.ts` - `CANONICAL_SECTION_ORDER` §1.3 verbatim + `pack()` (kind→index table, throws on unknown kind, `totalTokens` tally)
- `src/core/context/ContextProvenanceManifest.ts` - §2.6 verbatim zod schema + `buildManifest` (always appends system/task omission records) + 7-entry `MANIFEST_KIND_MAP`
- `src/core/context/ContextOptimizer.ts` - `assemble()` spine: §2.3 contract, §2.4 degradation ladder, D-74 `isFeatureAllowedInMinimalMode` + `BLOCKED_IN_MINIMAL_MODE`, `AssembleResult` union, D-72 re-export, D-77 trace surface

## Decisions Made

All six research open questions were locked exactly as the plan specified (Q1–Q6, listed in frontmatter `key-decisions`). No additional decisions were needed beyond the plan; the two local implementation choices below were forced by TypeScript semantics, not scope:

- The D-72 re-export (`export type { PromptSection } from '../ai/types'`) needed a sibling local `import type { PromptSection }` — a re-export alone does not bind the name in the module. Both lines are type-only; the re-export remains the public import target.
- `pack()` validates section kinds upfront (see Deviations) so even a single unknown-kind section throws.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `pack()` did not throw on a single unknown-kind section**
- **Found during:** Task 1 (temporary smoke test — `pack([sec('BOGUS', 'x')])` returned instead of throwing)
- **Issue:** `Array.prototype.sort` never invokes its comparator for a 1-element array, so the in-comparator kind check never ran and a lone out-of-table section slipped through silently — violating the closed-union discipline (the plan requires a throw on any kind outside the §1.3 table).
- **Fix:** Added an upfront validation loop over all sections before sorting (kind not in `CANONICAL_INDEX` → throw with the section kind named).
- **Files modified:** `src/core/context/ContextPack.ts`
- **Verification:** smoke test `throws on unknown kind` passed after the fix; `pnpm run lint` green
- **Committed in:** `7e1fe86` (part of the task commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the plan's own closed-union discipline. No scope creep — behavior change confined to ContextPack.ts.

## Issues Encountered

- **tmpfs exhaustion (environment):** the system `/tmp` (5.9G tmpfs) filled with Node compile-cache `.so` artifacts, causing vitest `ENOSPC` on first run. Cleared the cache and re-ran with `TMPDIR` pointed at the roomy `/home` filesystem plus `NODE_DISABLE_COMPILE_CACHE=1`. Purely environmental — no code impact.
- **Re-export binding (TS2304):** `export type { PromptSection } from '../ai/types'` does not introduce a local binding; added a parallel `import type` line. Resolved inline during the task.

## Known Seams (declare-now by design — not stubs)

- `TokenCounter` (D-71): heuristic default ships; provider-native counters plug in later.
- `Summarizer` (D-75): Phase 5 never calls the LLM; `summarizeHistory` falls back to drop-older-turns recorded as truncation.
- `contextTierCaps` (D-70): exported but unwired — Appendix I/AgentOrchestrator owns enforcement; zero call sites (grep-asserted).
- Degradation ladder rungs 1–2: reserved no-ops (no debug/notes source in the §2.3 input) — the Phase-7 caller supplies those sections.
- These are all plan-locked design decisions, not missing functionality; each is documented in its module header.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **05-02 (tests):** the three §18 test files (`TokenBudget.test.ts`, `ContextCompressor.test.ts`, `ContextOptimizer.test.ts`) plus the D-78 `verify:phase-5` re-point in package.json can now pin the module behavior — the modules compile strict-clean and execute correctly (proven by the temporary smoke test).
- **Phase 7 (CTX-01..06):** consumes `assemble()` and the manifest-as-receipt; the trace surface and omission-record semantics are the CTX-03 substrate.
- **Phase 6/8/18:** replace the supersession-point shapes in place at their canonical homes.
- **Phase 11:** lifts the `contextTier`/`truncated`/`truncatedSources`/`minimalMode` trace surface into `PromptTrace`.
- **No blockers.**

---
*Phase: 05-context-adaptive-execution*
*Completed: 2026-08-29*

## Self-Check: PASSED

- [x] All seven modules exist under `src/core/context/` (exactly 7 files, no barrel index.ts)
- [x] `pnpm run lint` (tsc --noEmit) green — strict-clean across the project
- [x] Zero `NP-STRICT` markers in `src/core/context/` (grep-asserted)
- [x] D-72 re-export line present in ContextOptimizer.ts; `CONTEXT_TOO_LARGE` literal used; `StreamErrorCodeSchema` untouched (grep-asserted)
- [x] `contextTierCaps` in ModelContextTier.ts only — zero call sites in src/core/ai/ src/components/ (grep-asserted)
- [x] Zero Phase-3 files modified — `git status --porcelain src/core/ai/ src/components/` empty
- [x] Task commit `7e1fe86` exists in git history
- [x] Temporary smoke test (20 tests) passed and was deleted before commit — `tests/core/context` contains no plan-01 artifacts