---
phase: 04-context-adaptive-execution
plan: 07
subsystem: testing
tags: [phase-gate, verify-script, w1-canonicalization, requirements-reconciliation, full-suite-green, golden-rule-10]

# Dependency graph
requires:
  - phase: 04-context-adaptive-execution
    provides: the four spec-less CTX probe edges (04-01..04-06) — tiers/budgets, ladder primitives, manifest + lockstep, optimizer + compact prompts + seam, router window stamp, hook rewire + contextHelper deletion
provides:
  - verify:phase-4 gate script — the §24 chain (eslint + prettier --check + tsc --noEmit + wxt build + vitest run + isolation check), the Golden-Rule-10 seal every future Phase-4-touching change reports into
  - REQUIREMENTS.md D-04-01 CTX re-map note (CTX-02 typed input-only seam with no P4 consumer; CTX-03 minimal-mode compact selection; §28.3 namespace disambiguation) — the planning record now matches what was built
  - ROADMAP Phase-4 plan list close-out (04-01..04-07, '04-07 phase gate' row)
  - Spec W-1 canonicalizations: Appendix A compact per-role constants (D-04-11) + Appendix B chat.messageTooLong (D-04-15), byte-matching the source mirrors; CONTEXT_TOO_LARGE re-verified in C.2
  - A green full-suite seal: Phase 4 DONE per §18 — all four CTX probe edges proven by shipped suites (flagged-unverified disposition retained, never auto-dismissed)
affects: [Phase 4a/7 (CTX-02 contextUpdate/page-change consumers, conversation store), Phase 4b (trust-aware CTX-01..06 ids — §28.3 namespace), prompt-cache stability re-verification]

# Tech tracking
tech-stack:
  added: [] # nothing new — no packages installed (R-9; T-04-33 no-op)
  patterns:
    - "Phase-gate pattern (03a-05 precedent): verify:phase-N = the full §24 chain verbatim incl. the R-3 isolation check, no exact test-count assertions (P-5)"
    - "AI-07-style re-map note: §18 stays authoritative over REQUIREMENTS.md rows; scope reconciliation recorded, never a new id invented"
    - "W-1 scoped-regex canonicalization: every shipped code/string mirrors its spec slice; byte-match proven by diff against the source mirrors"

key-files:
  created: [] # no new runtime/test files — seal + docs plan only
  modified:
    - package.json
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PRODUCT_SPEC_v0_1.md

key-decisions:
  - "ROADMAP Phase-4 plan list kept wave-structured (already populated by prior wave close-outs — the plan's snapshot expected 'Plans: TBD'); the '04-07 phase gate' literal was added to the 04-07 row to satisfy the plan's own scoped verify grep (Rule 3)"
  - "W-1 canonical additions byte-match the source mirrors (compact planner/renderer system constants, messageTooLong) — verified by diff, not inspection"
  - "CONTEXT_TOO_LARGE needed no new spec line — already canonical at both the master code list (L3512) and Appendix C.2 (L5063); the W-1 gate re-verified only"

patterns-established:
  - "Phase-gate as the phase's final seal: verify:phase-N green + targeted evidence greps (deleted-module imports = 0, R-3 bundles clean, §18-required suites explicitly green) close the phase per Golden Rule 10"

requirements-completed: [CTX-01, CTX-02, CTX-03, CTX-04]

coverage:
  - id: D1
    description: "verify:phase-4 script — the §24 chain (eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && node tests/isolation/check-content-bundle.mjs), mirroring verify:phase-3a (R-3 isolation non-optional, no test-count assertions)"
    requirement: CTX-04
    verification:
      - kind: other
        ref: "command: pnpm run verify:phase-4 → exit 0 (eslint, prettier, tsc, wxt build, 69 files/612 vitest tests, isolation check all green)"
        status: pass
      - kind: other
        ref: "check-content-bundle: '1 content bundle(s) + 1 background SW bundle(s) clean' (R-3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "REQUIREMENTS.md D-04-01 CTX re-map note (AI-07 style) + ROADMAP Phase-4 plan list close-out — CTX-02 typed input-only re-pack seam with NO P4 consumer (landing Phase 4a/7), CTX-03 minimal-mode compact-prompt selection not a new prompting subsystem, Phase-4 CTX ids disambiguated from §28.3; no CTX id added or renamed"
    requirement: CTX-02
    verification:
      - kind: other
        ref: "grep: 'typed input-only re-pack seam' present in REQUIREMENTS.md (1 non-comment match)"
        status: pass
      - kind: other
        ref: "grep: ROADMAP.md lists 04-01..04-07 (7 plan rows) incl. '04-07 phase gate'; §18 master order lines untouched"
        status: pass
      - kind: other
        ref: "grep: no CTX-05+ id introduced (CTX-0[5-9]|CTX-1[0-9] → 0 matches)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Spec W-1 canonicalizations — Appendix A compact per-role constants (PROMPTS.planner.compact.system / renderer.compact.system, D-04-11) + Appendix B chat.messageTooLong (D-04-15), byte-matching src/core/prompts/index.ts and src/core/i18n/strings.ts; CONTEXT_TOO_LARGE re-verified present in Appendix C.2"
    verification:
      - kind: other
        ref: "grep: compact.system literal (W-1 note L4156), messageTooLong L4172, '^CONTEXT_TOO_LARGE$' ×2 (L3512, L5063)"
        status: pass
      - kind: other
        ref: "diff: spec compact planner/renderer system + messageTooLong strings byte-identical to the source mirrors"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full-suite green seal — Phase 4 DONE per §18: §18-required tier/ladder/degradation suites green, context overflow degrades instead of failing, minimal mode marked (mcpChaining:false via capsForTier — RAG enforcement is the 5a consumer), ContextProvenanceManifest attached to every OptimizedContext; zero deleted-module imports"
    requirement: CTX-04
    verification:
      - kind: unit
        ref: "command: pnpm vitest run tests/core/context → 4 files / 77 passed (ContextOptimizer, ContextCompressor, TokenBudget, ContextProvenanceManifest)"
        status: pass
      - kind: other
        ref: "grep gate: zero src/ or tests/ imports of @/core/ai/contextHelper; src/core/ai/contextHelper.ts absent (D-04-08 deletion holds)"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-08-12
status: complete
---

# Phase 04 Plan 07: Phase-Gate Seal — verify:phase-4 + W-1 Spec Canonicalization Summary

**The Golden-Rule-10 seal for Phase 4: `verify:phase-4` (the full §24 chain with the R-3 isolation check) added to package.json and run GREEN end-to-end (69 files / 612 tests), the D-04-01 CTX re-map note recorded in REQUIREMENTS.md, the ROADMAP Phase-4 plan list closed out (04-01..04-07), and the phase's additions canonicalized into the spec (compact planner/renderer constants in Appendix A, chat.messageTooLong in Appendix B, CONTEXT_TOO_LARGE re-verified in C.2) — Phase 4 DONE per §18, all four spec-less CTX probe edges sealed by shipped suites.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-12T07:17:05Z
- **Completed:** 2026-08-12T07:24:17Z
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 4 (all docs/config — zero src/ changes, per the seal/docs/spec scope)

## Accomplishments

- **verify:phase-4 gate script** (`package.json`): `eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && node tests/isolation/check-content-bundle.mjs` — the §24 chain verbatim, mirroring verify:phase-3a (03a-05 precedent). **Ran green end-to-end**: eslint clean, prettier --check clean, tsc --noEmit clean, wxt build OK (30.4s), **69 test files / 612 tests passed**, isolation check clean ("1 content bundle(s) + 1 background SW bundle(s) clean" — R-3 held: no AI/vault tokens in content/background bundles).
- **REQUIREMENTS.md D-04-01 CTX re-map note** (AI-07 block-quote style under the CTX-01..04 rows): CTX-02 = typed input-only re-pack seam on the optimizer/runAgentTurn path with **NO consumer in P4** (page/state-change triggers land with Phase 4a/7); CTX-03 = minimal-mode compact-prompt selection, NOT a new prompting subsystem; the Phase-4 CTX ids are **DISAMBIGUATED from the spec §28.3 trust-aware CTX-01..06 namespace** (Phase 4b owns those); §18 authoritative over the rows. No CTX id added or renamed (grep-gated).
- **ROADMAP Phase-4 plan list close-out**: the wave-structured 04-01..04-07 list (already populated by prior wave close-outs) is confirmed complete; the 04-07 row now carries the `04-07 phase gate` literal so the plan's scoped verify grep matches. Success criteria + §18 master phase order untouched.
- **Spec W-1 canonicalizations** (`.planning/PRODUCT_SPEC_v0_1.md`): Appendix A gains the compact per-role constants `PROMPTS.planner.compact.system` ('Select one action: answer, run_tool, or ask_clarification. JSON only.') and `PROMPTS.renderer.compact.system` ('Answer from context only. Be concise. Do not invent facts.') beside their default siblings, mirroring `src/core/prompts/index.ts` verbatim (D-04-11) with a W-1 note documenting the ONLY-consumer (ContextOptimizer) contract; Appendix B gains `chat.messageTooLong: 'This message is too long for the selected model.'` beside contextReduced, mirroring `src/core/i18n/strings.ts` verbatim (D-04-15). Byte-match proven by diff. `CONTEXT_TOO_LARGE` re-verified already canonical in C.2 (L3512 master list + L5063 registry) — no new line needed.
- **Evidence greps**: `pnpm vitest run tests/core/context` → 4 files / 77 tests green (the §18-required suites); zero `@/core/ai/contextHelper` imports survive in src/ or tests/ (D-04-08 deletion gate holds); no exact test-count assertion anywhere in the gate (P-5).

## Task Commits

Each task was committed atomically:

1. **Task 1: verify:phase-4 script + REQUIREMENTS.md CTX re-map note + ROADMAP plan list** - `87514a5` (chore)
2. **Task 2: W-1 spec canonicalization (compact constants + messageTooLong + C.2 re-verify)** - `0374a53` (docs)
3. **Task 3: Run verify:phase-4 — full-suite green seal** - (no code change; the gate run itself — evidence captured in this SUMMARY and the state updates)

**Plan metadata:** (pending — `docs(04-07): complete phase gate plan` committed after SUMMARY creation)

## Files Created/Modified

- `package.json` - MODIFIED: `verify:phase-4` script added (the §24 chain, mirroring verify:phase-3a)
- `.planning/REQUIREMENTS.md` - MODIFIED: D-04-01 CTX re-map note (AI-07 style) under the CTX-01..04 rows; no id added/renamed
- `.planning/ROADMAP.md` - MODIFIED: 04-07 row carries the '04-07 phase gate' literal; Phase-4 plan list 04-01..04-07 already in place
- `.planning/PRODUCT_SPEC_v0_1.md` - MODIFIED: Appendix A compact per-role constants (D-04-11), Appendix B chat.messageTooLong (D-04-15), W-1 notes

## Decisions Made

- **ROADMAP format kept wave-structured:** the plan (stale snapshot) expected 'Plans: TBD' and a compact one-line list; the wave-structured 04-01..04-07 list already existed from prior wave close-outs and matches the format every other phase uses (1, 2, 3, 3a). Kept it; added the literal the plan's verify grep demands.
- **W-1 additions proven byte-identical by diff** against `src/core/prompts/index.ts` and `src/core/i18n/strings.ts` — not by inspection — so the "single source of truth" claim is mechanical.
- **CONTEXT_TOO_LARGE re-verified, not re-added:** already canonical at two spec locations; the W-1 gate for this code is verify-only (as the plan anticipated).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ROADMAP plan list already populated — '04-07 phase gate' literal missing**
- **Found during:** Task 1 (verify grep `grep -c "04-07 phase gate"` returned 0)
- **Issue:** The plan's Task-1 action expected ROADMAP Phase 4 to still carry 'Plans: TBD' (its L224 line reference was stale) and prescribed a compact one-line plan list. The wave-structured 04-01..04-07 list was already populated by the 04-01..04-06 wave close-outs (the established format for all prior phases), but the 04-07 row read "04-07-PLAN.md — phase gate: …" — which does not contain the literal substring "04-07 phase gate" the plan's own verify command requires.
- **Fix:** Kept the wave-structured format (consistent with phases 1-3a and the acceptance criterion "Phase 4 block lists 04-01..04-07") and reworded the 04-07 row to "04-07 phase gate: verify:phase-4 script + …" so the scoped grep matches.
- **Files modified:** .planning/ROADMAP.md
- **Verification:** `grep -v "^#" .planning/ROADMAP.md | grep -c "04-07 phase gate"` → 1; 7 plan rows 04-01..04-07; §18 master order lines (2) untouched
- **Committed in:** `87514a5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3)
**Impact on plan:** Minor — a stale-line-number reconciliation with no scope creep; the plan's acceptance criteria and verify greps all pass, and the ROADMAP now matches the record.

## Issues Encountered

- None — the gate chain ran green on the first attempt (eslint, prettier, tsc, wxt build, 612 tests, isolation all passed; the wxt chunk-size warning is the known, pre-existing 3.12 MB antd chunk — not a gate failure).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 4 is DONE per §18** (Golden Rule 10 — every phase ends green): tier tests pass; context overflow degrades instead of failing; minimal mode is marked (capsForTier mcpChaining:false — RAG enforcement ships with the 5a consumer per the locked decision); ContextProvenanceManifest attaches to every OptimizedContext. The four unresolved CTX probe edges (spec-less #1110) are sealed by shipped suites with their flagged-unverified disposition retained — never auto-dismissed.
- **Ready for Phase 4a** (PageContentService) per the §18 master order — the next plan in the canonical sequence.
- **Carried-forward gates:** A2..A7 (MODEL_CONTEXT_WINDOWS values — user confirmation), Open Q1 (provider-declared window consult → revisit when Settings owns per-model windows), Open Q2 (canonical prompt constants stay unconsumed in the default path — a Phase-4.1-style decision, not §18), A8..A12 (CJK ratio, column→kind, percentages, conversationId, structured-output constants).

## Threat Flags

None — no new surface outside the plan's threat model. T-04-31 mitigated (isolation check ran INSIDE verify:phase-4 — content/background bundles clean); T-04-32 mitigated (W-1 scoped-regex verify anchored every canonical addition to its spec slice + byte-match diffs); T-04-33 no-op (zero packages installed — R-9; package.json diff is script-only).

---

## Self-Check

- `package.json` — FOUND (`verify:phase-4` = the §24 chain string)
- `.planning/REQUIREMENTS.md` — FOUND (D-04-01 note with 'typed input-only re-pack seam'; no CTX-05+ id)
- `.planning/ROADMAP.md` — FOUND (7 plan rows 04-01..04-07; '04-07 phase gate' literal; §18 order untouched)
- `.planning/PRODUCT_SPEC_v0_1.md` — FOUND (compact.system W-1 note L4156 + compact blocks L4077-4095; messageTooLong L4172; CONTEXT_TOO_LARGE ×2 L3512/L5063)
- Commits: `87514a5` ✓ `0374a53` ✓
- Verification: `pnpm run verify:phase-4` → exit 0 (eslint + prettier + tsc + wxt build + 69 files/612 vitest + isolation clean); `pnpm vitest run tests/core/context` → 4 files / 77 passed; zero `@/core/ai/contextHelper` imports in src/ AND tests/; `src/core/ai/contextHelper.ts` absent (D-04-08 deletion holds); no exact test-count assertion in the gate (P-5)
- Only untracked artifact: the pre-existing `04-PATTERNS.md` (documented precedent — left untouched, as in 04-05/04-06)

## Self-Check: PASSED

---
*Phase: 04-context-adaptive-execution*
*Completed: 2026-08-12*
