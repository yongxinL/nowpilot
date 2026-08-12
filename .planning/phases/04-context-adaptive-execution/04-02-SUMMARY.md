---
phase: 04-context-adaptive-execution
plan: 02
subsystem: ai-context
tags: [section-packing, degradation-ladder, section-granularity, stability-flags, prompt-cache, deterministic]

# Dependency graph
requires:
  - phase: 04-context-adaptive-execution
    provides: TokenBudget.estimateTokens (the ONLY token counter), CACHED_KINDS/TASK_KINDS stability authority, OVER_BUDGET_SECTIONS ladder-trigger fixture
provides:
  - ContextPack.packSections — §1.3 canonical PromptSection[] packing migrated from contextHelper (D-04-08), cache-correct stability flags (F-5/T-04-09)
  - ContextCompressor — the full §2.4 8-step ladder as pure section-granular primitives with the D-04-12 real/no-op split + LADDER_STEPS tested registry
  - 26-test deterministic suite pinning ladder order, no-mid-structure-truncation (D-04-13), and history reservation (D-04-16)
affects: [04-04 ContextOptimizer (drives LADDER_STEPS), 04-05 StageInvocation window stamp, 04-06 contextHelper deletion re-point]

# Tech tracking
tech-stack:
  added: [] # nothing new — pure TS on the approved stack (R-9)
  patterns:
    - "Shared suite file authored incrementally: Task 1 owns creation, Task 2 extends with ladder cases, Task 3 completes — per-task TDD gates preserved (test commit precedes feat commit)"
    - "Uniform CompressionResult shape { sections, compressionApplied?, dropped } — every ladder step, real or no-op, returns the same shape the optimizer iterates"
    - "Honest markers: real steps set compressionApplied only when a section was actually dropped; no-op steps ALWAYS set their marker ('summarise'|'structural'|'topk') — structurally present, never dead code (Pitfall 5)"

key-files:
  created:
    - src/core/context/ContextPack.ts
    - src/core/context/ContextCompressor.ts
    - tests/core/context/ContextCompressor.test.ts
  modified: []

key-decisions:
  - "dropDebugOnly matches sourceId === 'debug' exactly — canonical system/user_input sourceIds ('system'/'user-input') can never match, so 'never touches system/user_input' holds by construction with no extra kind guards"
  - "enterMinimalMode returns MinimalModeResult extending the uniform step shape with minimalMode: true — the §2.5 section reduction (compact prompt, ≤1 safe schema) stays in the optimizer's final assembly (D-04-14)"
  - "LADDER_STEPS is a readonly 8-literal tuple including 'too-large' as the terminal registry entry — the CONTEXT_TOO_LARGE throw itself remains the optimizer's (04-04), not a compressor primitive"

patterns-established:
  - "Section-granularity invariant tested as a property: every returned section text must be byte-identical to a source section text across ALL ladder steps (D-04-13)"
  - "D-04-16 history reservation tested on both sides: no 'history' kind in packSections output nor in any compressor step output"

requirements-completed: [CTX-04]

coverage:
  - id: D1
    description: "ContextPack.packSections — §1.3 canonical order ([system, tool_schemas, user_input] minimal; full 7-kind sequence), stability flags mirroring CACHED_KINDS/TASK_KINDS exactly, canonical sourceIds, tokens === estimateTokens of each section's own text, deterministic tool-schemas join, never a joined string (F-4)"
    requirement: CTX-04
    verification:
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#emits exactly [system, tool_schemas, user_input] in that order for the minimal input
        status: pass
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#sets stable:true for cached kinds and stable:false for task kinds (CACHED_KINDS/TASK_KINDS mirror)
        status: pass
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#counts every section token via estimateTokens of its own text (no hand-authored counts)
        status: pass
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#returns sections whose text is byte-identical to the input text (never a joined string, F-4)
        status: pass
    human_judgment: false
  - id: D2
    description: "ContextCompressor — full §2.4 8-step ladder as pure section-granular primitives: dropDebugOnly + trimToolSchemas do REAL work (whole-section drops), dropSecondaryNotes/summariseOlderHistory/compressPageContext/reduceMemoryTopK are structural no-ops with markers (D-04-12 Pitfall 5), enterMinimalMode is the §2.5 marker (D-04-14); zero model calls/async, never rewrites section text (P4-8)"
    requirement: CTX-04
    verification:
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#drops only sections whose sourceId signals debug metadata and marks them dropped
        status: pass
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#keeps only tool_schemas sections matching the in-scope predicate; non-matching dropped WHOLE
        status: pass
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#summariseOlderHistory returns the input unchanged with compressionApplied "summarise"
        status: pass
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#marks the pipeline minimal without mutating any section text
        status: pass
    human_judgment: false
  - id: D3
    description: "LADDER_STEPS registry + pinned invariants — exactly the 8 D-04-12 steps in order (tested array, not a comment); section-granularity property (every returned section text byte-identical to a source section, no slice anywhere); drops report WHOLE sections; full D-08 fixture shape runs through every step uncorrupted; D-04-16 history reservation (no 'history' kind ever emitted)"
    requirement: CTX-04
    verification:
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#lists exactly the 8 D-04-12 steps in order (tested array, not a comment)
        status: pass
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#every section every step returns is byte-identical to a source section text (no slice anywhere)
        status: pass
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#runs the full deterministic D-08 fixture shape through every step without corrupting a section
        status: pass
      - kind: unit
        ref: tests/core/context/ContextCompressor.test.ts#no 'history' kind appears in any packSections output, even with every input filled
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-08-12
status: complete
---

# Phase 04 Plan 02: Context Packing + Degradation Ladder Summary

**ContextPack §1.3 canonical section packing (D-04-08 migration from contextHelper) with cache-correct stability flags, plus the full §2.4 8-step degradation ladder as pure section-granular ContextCompressor primitives with a tested LADDER_STEPS registry — the building blocks ContextOptimizer (04-04) drives end-to-end**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-12T05:39:33Z
- **Completed:** 2026-08-12T05:48:34Z
- **Tasks:** 3 (all `type="auto"`, tasks 1-2 TDD)
- **Files modified:** 3 (all created)

## Accomplishments

- `ContextPack.ts` — `packSections(input)` emits `PromptSection[]` in the §1.3 canonical order (`system → tool_schemas → preferences → memory → context → task → user_input`), migrated from `contextHelper.buildOptimizedContext`'s section assembly (D-04-08). Stability flags mirror `ProviderRouter.CACHED_KINDS`/`TASK_KINDS` exactly (system/tool_schemas/preferences/memory = `stable:true`; context/task/user_input = `stable:false` — F-5 anthropic prompt-cache contract, T-04-09). Tool-schemas text is a deterministic fixed-field-order join (`name: description`, newline-joined, mirroring contextHelper), omitted when empty; optional text sections emitted only when non-empty. Every `tokens` field comes from `TokenBudget.estimateTokens` of that section's own text — the same counter the optimizer later uses for manifests, so pack tokens and manifest tokens can never diverge. Never a joined string (F-4); read-only counting (never rewrites section text).
- `ContextCompressor.ts` — the §2.4 ladder as pure section-granular functions, each returning `{ sections, compressionApplied?, dropped }`. REAL work in P4 (D-04-12): `dropDebugOnly` (matches `sourceId === 'debug'` only — canonical system/user_input sourceIds can never match) and `trimToolSchemas(sections, inScope)` (caller-supplied predicate, non-matching tool_schemas dropped WHOLE — T-04-08). STRUCTURAL NO-OPs with markers: `dropSecondaryNotes` ('structural'), `summariseOlderHistory` ('summarise'), `compressPageContext` ('structural'), `reduceMemoryTopK` ('topk') — present-but-honest until Phase 4a/5/7 data arrives (Pitfall 5). `enterMinimalMode` returns the §2.5 `minimalMode: true` marker (D-04-14; the optimizer owns the final §2.5 assembly). `LADDER_STEPS` is the tested 8-step registry: `drop-debug, drop-secondary, summarise-history, compress-page, trim-tools, reduce-topk, minimal-mode, too-large` — the 'too-large' terminal names the optimizer's CONTEXT_TOO_LARGE throw (thrown in 04-04, not here). Zero model calls/async; never slices or rewrites section text (D-04-13, P4-8).
- `ContextCompressor.test.ts` — 26 deterministic tests (no Date.now/crypto; D-08 fixture imports, no duplicated data): pack order/stability/token self-consistency; drop-debug never touches system/user_input; trim-tool-schemas whole-section drops; no-op honesty (deep-equal + marker); **section-granularity property** — every section every step returns is byte-identical to a source section text; drops report WHOLE sections; the full deterministic D-08 fixture shape runs through every step uncorrupted; D-04-16 history reservation (no 'history' kind in packSections or any compressor output).

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: Create ContextPack — §1.3 canonical packing with stability flags**
   - `531a4e3` (test — RED: §1.3 order, stability, token self-consistency cases)
   - `c892841` (feat — GREEN: ContextPack.ts)
2. **Task 2: Create ContextCompressor — the §2.4 ladder as pure section-granular primitives**
   - `af6b79b` (test — RED: drop-debug, trim-tools, no-op, minimal-mode, registry cases)
   - `c051495` (feat — GREEN: ContextCompressor.ts)
3. **Task 3: Write ContextCompressor.test.ts — ladder order, granularity, no-op honesty**
   - `961b66e` (test: granularity invariant + history reservation completion cases)
   - `db91e0b` (style: prettier formatting on the suite)

**Plan metadata:** (pending — `docs(04-02): complete …`)

## Files Created/Modified

- `src/core/context/ContextPack.ts` - NEW: `packSections` — §1.3 order, stability flags mirroring CACHED_KINDS/TASK_KINDS, canonical sourceIds, estimateTokens counts; pure + deterministic (D-04-08)
- `src/core/context/ContextCompressor.ts` - NEW: 7 exported step primitives + `LADDER_STEPS` registry + `CompressionResult`/`MinimalModeResult`/`InScopePredicate` types
- `tests/core/context/ContextCompressor.test.ts` - NEW: 26 deterministic tests across all three tasks

## Decisions Made

- **drop-debug match = exact `sourceId === 'debug'`:** the "never touches system/user_input" invariant holds by construction — canonical system/user_input sections carry 'system'/'user-input' sourceIds and can never match the debug predicate; no extra kind guards needed.
- **enterMinimalMode = uniform step shape + flag:** returns `MinimalModeResult` (extends `CompressionResult`, adds `minimalMode: true`) so the optimizer can iterate every ladder step uniformly; the §2.5 section reduction (compact prompt, ≤1 safe tool schema, reduced non-system sections) remains the optimizer's final assembly (D-04-14).
- **Honest marker semantics:** real steps (drop-debug, trim-tools) set `compressionApplied: 'structural'` only when a section was actually dropped (undefined when nothing dropped); no-op steps always set their marker — so markers are truthful compression signals, and no-op steps are structurally present, never dead code (Pitfall 5).
- **LADDER_STEPS = readonly 8-literal tuple incl. 'too-large':** the terminal registry entry names the honest CONTEXT_TOO_LARGE terminal; the throw itself ships in 04-04 per the plan's through-line.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The opencode LSP produced persistent stale "Cannot find module '@/core/context/ContextPack'/'ContextCompressor'" + cascading implicit-any diagnostics on the test file even after the modules were created and verified green by vitest/tsc (same spurious TokenBudget.ts diagnostic appears in 04-01's files). Resolved by relying on the actual gates (`vitest run`, `tsc --noEmit`, eslint) — all clean; the LSP cache was not a build-state signal.
- Prettier flagged formatting drift on the test file after Task 3's edits — fixed in the `style` commit `db91e0b`; `prettier --check` clean on all three files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CTX-04's degradation-half is pinned: ladder order (LADDER_STEPS), section-granularity (no mid-structure truncation), real/no-op split (D-04-12), minimal-mode marker (D-04-14), and history reservation (D-04-16) are all tested invariants.
- ContextPack gives 04-04 the §1.3 pack shape with cache-correct stability flags and self-consistent tokens — the drop-in constraint (D-04-07) dependency.
- Ready for `04-04-PLAN.md` (ContextOptimizer drives LADDER_STEPS, throws CONTEXT_TOO_LARGE, owns the §2.5 final assembly + manifest stamping).
- CTX-04's probe edge (spec-less #1110 — section-granularity degradation orchestration) remains unresolved by design until the phase gate seals it.

## Threat Flags

None — no new surface outside the plan's threat model: ContextPack/ContextCompressor are pure core modules (no endpoints, no auth paths, no I/O, no schema changes at trust boundaries). T-04-06 mitigated by whole-section drops (never text slices) with the honest CONTEXT_TOO_LARGE terminal deferred to 04-04; T-04-07 accepted (markers carry no content); T-04-08 mitigated (caller-supplied predicate + whole-section drop tests); T-04-09 mitigated (stability flags pinned to CACHED_KINDS/TASK_KINDS in tests); T-04-10 no-op (no packages installed).

---

## Self-Check

- `src/core/context/ContextPack.ts` — FOUND (packSections exported, 124 lines)
- `src/core/context/ContextCompressor.ts` — FOUND (7 steps + LADDER_STEPS exported)
- `tests/core/context/ContextCompressor.test.ts` — FOUND (26 tests, green)
- Commits: `531a4e3` ✓ `c892841` ✓ `af6b79b` ✓ `c051495` ✓ `961b66e` ✓ `db91e0b` ✓
- Verification: `pnpm vitest run tests/core/context/ContextCompressor.test.ts` → 26 passed; `pnpm typecheck` → clean; eslint → clean on all three files; prettier --check → clean; grep gates (no slice/substring/replace in src/core/context, no 'history' kind in the PromptSection union, no async/ai-SDK imports in the new modules) → CLEAN; full suite 67 files / 580 tests → green (was 66/554 in 04-01)

## Self-Check: PASSED

---
*Phase: 04-context-adaptive-execution*
*Completed: 2026-08-12*
