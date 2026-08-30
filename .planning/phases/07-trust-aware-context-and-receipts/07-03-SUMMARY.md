---
phase: 07-trust-aware-context-and-receipts
plan: 03
subsystem: context-trust
tags: [skill-disclosure, CTX-05, progressive-disclosure, D-101, D-103, verify-gate, zero-token]

# Dependency graph
requires:
  - phase: 07-trust-aware-context-and-receipts
    plan: 01
    provides: "Trust spine: D-93 item pipeline inside assemble, C.1 trust types, adversarial prompt-injection fixtures (tests/security/prompt-injection/policy-redefinition.test.ts)"
  - phase: 07-trust-aware-context-and-receipts
    plan: 02
    provides: "CTX-06 metrics surface + CTX-04 stable-prefix golden snapshot (tests/core/context/trust/stable-prefix.snapshot.test.ts) — the suites the re-pointed gate runs"
provides:
  - "CTX-05 progressive disclosure mechanism (D-101): SkillDisclosureCandidate interface shaped against the §14.1 ISkill contract (spec 1829-1856) + renderSkillDisclosure(candidates) → { text, tokens } — ACTIVE skills render name + fullInstructions, INACTIVE skills render trigger — one-line description; irrelevant full instructions are ABSENT from the output (zero prompt tokens, ROADMAP SC#4); token count via countTokensHeuristic (the shipped accounting unit, no tokenizer library)"
  - "CTX-05 fixture proof (9 tests): N=4 candidates / M=2 active → 2 full bodies + 2 one-liners; inactive FULL_BODY_SKILL_GAMMA/DELTA markers absent from output; exact token decomposition (active bodies + one-liners + separators); input order preserved; all-active/all-inactive/empty degenerate shapes"
  - "verify:phase-7 re-pointed to the §18 canonical gate string verbatim (D-103, spec 3611): tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection — the CTX-04 snapshot diff gate + CTX-02 fixtures + CTX-05 proof + CTX-06 metrics + CTX-01/CTX-03 pipeline tests now execute in the release block (gate green: 8 files / 64 tests)"
affects: [phase-15 (RICH catalog + ISkill implementations consume the declared seam; L6 disclosure UI), phase-11 (PromptTrace/DiagnosticsSection), phase-17 (skill triggers)]

# Actuals (#2632) — pairs with the plan's `estimate` (32000 tokens) to calibrate future estimates.
actuals:
  tokens: 3449    # chars/4 over the realized diff (git diff 68ae5c3..HEAD | wc -c = 13796)
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []  # zero new packages (Package Legitimacy Audit vacuous — only the script string changed)
  patterns:
    - "Declare-now/populate-later seam (D-101): SkillDisclosureCandidate mirrors the Summarizer precedent (types.ts:46-53) — Phase 15's RICH catalog supplies real ISkill manifests; this module only renders them"
    - "{ text, tokens } renderer return shape (pack()/summarizeHistory convention) with countTokensHeuristic accounting — no tokenizer library (STACK.md)"
    - "Gate re-point precedent chain: D-68 (Phase 4) → D-78 (Phase 5) → D-92 (Phase 6) → D-103 (Phase 7) — spec 3611 verbatim, single-line package.json diff"

key-files:
  created:
    - src/core/context/trust/SkillDisclosure.ts
    - tests/core/context/trust/SkillDisclosure.test.ts
  modified:
    - package.json

key-decisions:
  - "D-101 executed: the disclosure mechanism is a standalone declare-now module shaped against the §14.1 ISkill contract — real ISkill implementations, slash commands, and the RICH catalog land Phase 15; this phase ships the contract + zero-token proof only"
  - "D-69 create-only honored: renderSkillDisclosure is NOT wired into assemble() or the live prompt (git-status assertion empty for ContextOptimizer/ContextPack/ai types) — wiring would disturb the stable sections the 07-02 golden snapshots pin"
  - "D-103 executed: verify:phase-7 re-pointed to the spec-3611 verbatim string (tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection) — the ONLY package.json edit this phase; both §18 dirs asserted populated before the gate ran (Pitfall 3 — vitest errors on empty dirs)"

patterns-established:
  - "Pattern 1 (progressive disclosure): per-candidate render rule (active → `name:\\n<fullInstructions>`, inactive → `<trigger> — <description>`), input-order preserved (the caller owns catalog ordering — Phase 15), sections joined with the pack() '\\n\\n' separator convention"
  - "Pattern 2 (exact token decomposition): fixture lengths aligned so every rendered part folded with its trailing separator is length ≡ 0 (mod 4) — ceil-based countTokensHeuristic is then exactly additive, making the SC#4 sum-decomposition assertion exact, not coincidental"
  - "Pattern 3 (release-block gate): the re-pointed verify:phase-7 runs the CTX-04 snapshot diff + CTX-02 fixtures + CTX-05 proof + CTX-06 metrics + CTX-01/03 pipeline tests — the phase's full §18 coverage is now the gate's"

requirements-completed: [CTX-05, CTX-04]

# Coverage metadata (#1602) — one entry per shipped deliverable (both proven by passing unit suites / green gate run).
coverage:
  - id: D1
    description: "CTX-05 progressive skill disclosure (D-101): SkillDisclosureCandidate (id/name/description/trigger/fullInstructions/active, shaped against the §14.1 ISkill contract spec 1829-1856) + renderSkillDisclosure(candidates) → { text, tokens } — N candidates / M active → M full instruction bodies + (N-M) trigger+one-line descriptions; inactive full bodies ABSENT from the output (zero prompt tokens, ROADMAP SC#4); tokens via countTokensHeuristic (shipped accounting unit); standalone declare-now seam, NOT wired into assemble (D-69)"
    requirement: CTX-05
    verification:
      - kind: unit
        ref: "tests/core/context/trust/SkillDisclosure.test.ts#renderSkillDisclosure — 9 tests: active bodies verbatim, inactive FULL_BODY_SKILL_GAMMA/DELTA markers absent, one-liner shape, exact token sum decomposition, input-order preservation, all-active/all-inactive/empty degenerate shapes, determinism"
        status: pass
    human_judgment: false
  - id: D2
    description: "verify:phase-7 re-pointed to the §18 canonical gate string verbatim (D-103, spec 3611): tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection — replacing the mis-pointed Phase-15/16 targets; the CTX-04 stable-prefix snapshot diff gate, the CTX-02 adversarial fixtures, the CTX-05 zero-token proof, the CTX-06 metrics, and the CTX-01/03 pipeline tests now all execute in the release block (both §18 dirs populated before the run — Pitfall 3)"
    requirement: CTX-04
    verification:
      - kind: other
        ref: "pnpm run verify:phase-7 — tsc strict-clean + 8 test files / 64 tests passed (7 trust suites + policy-redefinition), exit 0"
        status: pass
      - kind: unit
        ref: "node -e exact-string assertion of p.scripts['verify:phase-7'] === 'tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection'"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-30
status: complete
---

# Phase 7 Plan 3: SkillDisclosure + verify:phase-7 Gate Re-point Summary

**The CTX-05 progressive skill disclosure mechanism (`SkillDisclosureCandidate` + `renderSkillDisclosure` — active skills render full instructions, inactive skills render only a trigger + one-line description so irrelevant full bodies consume zero prompt tokens) proven by a 9-test fixture with an exact token-decomposition assertion, plus the `verify:phase-7` gate re-pointed to the spec-3611 canonical string (D-103) and running green — 8 files / 64 tests — making the CTX-04 snapshot diff and the CTX-02 adversarial fixtures live release blocks.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-30T04:50:08Z
- **Completed:** 2026-08-30T04:54:31Z
- **Tasks:** 2 (2 auto)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- **CTX-05 progressive disclosure mechanism (D-101)** — `renderSkillDisclosure(candidates) → { text, tokens }` is a pure, deterministic renderer: ACTIVE candidates render as `name:\n<fullInstructions>`, INACTIVE candidates render as `<trigger> — <description>` (one line each), order = input order (the caller owns catalog ordering — Phase 15), sections joined with the pack() `'\n\n'` separator convention. The output carries ZERO bytes of any inactive candidate's `fullInstructions` — irrelevant full bodies consume zero prompt tokens (ROADMAP SC#4). Token accounting via `countTokensHeuristic` — the shipped accounting unit, no tokenizer library (STACK.md).
- **Declare-now seam shaped against the ISkill contract** — `SkillDisclosureCandidate` (id/name/description/trigger/fullInstructions/active) aligns to §14.1 `ISkill` (spec 1829-1856); the header documents that real ISkill implementations, slash commands, and the RICH catalog land Phase 15 (the Summarizer declare-now/populate-later precedent, types.ts:46-53). Standalone by design (D-69 create-only): NOT wired into assemble or the live prompt — the git-status assertion for ContextOptimizer/ContextPack/ai types is empty, so the 07-02 golden snapshots' stable sections stay untouched.
- **CTX-05 fixture proof (9 tests)** — N=4 candidates / M=2 active with distinct `FULL_BODY_SKILL_*` marker bodies: (a) both active bodies verbatim in output; (b) inactive GAMMA/DELTA bodies absent (markers grepped — zero tokens); (c) both inactive one-liners in the `<trigger> — <description>` shape; (d) exact token decomposition — `tokens === countTokensHeuristic(outputText) ===` sum of the rendered parts (active bodies + one-liners + separators), with fixture lengths aligned mod-4 so the ceil-based counter is exactly additive; (e) input order preserved; (f) all-inactive → one-liners only; (g) all-active → full bodies only; (h) empty array → `{ text: '', tokens: 0 }`; plus a determinism check.
- **verify:phase-7 re-pointed to the spec-3611 canonical string (D-103)** — the gate now runs `tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection` verbatim (spec 3611), replacing the mis-pointed Phase-15/16 targets (`tests/hooks tests/components tests/components/rich tests/core/intent tests/core/notes`) that had persisted since Phase 6. Both §18 dirs were confirmed populated (7 trust test files + 1 prompt-injection file) before the run — vitest errors on empty dirs rather than silently passing (Pitfall 3). The gate runs GREEN: tsc strict-clean + 8 files / 64 tests passed.
- **The phase's full release block is now the gate** — the green `pnpm run verify:phase-7` executes the CTX-04 stable-prefix snapshot diff, the CTX-02 adversarial fixtures, the CTX-05 zero-token proof, the CTX-06 metrics aggregates, and the CTX-01/CTX-03 pipeline tests in one deterministic block; `verify:all` and `verify:phase-1..6/8..19` remain untouched (the re-point is scoped, T-7-09/T-7-10 mitigated).

## Task Commits

Each task was committed atomically:

1. **Task 1: SkillDisclosure — progressive disclosure with a zero-token proof (CTX-05)** - `5b93382` (feat)
2. **Task 2: Re-point verify:phase-7 to the §18 canonical gate string and run it green (D-103)** - `1dde7de` (chore)

**Plan metadata:** SUMMARY commit follows (orchestrator-owned STATE.md/ROADMAP.md writes are skipped per sequential-executor contract).

## Files Created/Modified

- `src/core/context/trust/SkillDisclosure.ts` - `SkillDisclosureCandidate` interface (shaped to §14.1 ISkill, spec 1829-1856) + `renderSkillDisclosure` → `{ text, tokens }`; header cites D-101 + spec + the Summarizer declare-now precedent; token count via `countTokensHeuristic`
- `tests/core/context/trust/SkillDisclosure.test.ts` - 9-test CTX-05 fixture proof: active-body verbatim inclusion, inactive-body absence (zero tokens), one-liner shape, exact token sum decomposition (mod-4 aligned fixture), order preservation, all-active/all-inactive/empty degenerate shapes, determinism
- `package.json` - Single-line edit: `verify:phase-7` re-pointed to `tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection` (spec 3611 verbatim, D-103); zero dependency/other-script changes

## Decisions Made

- **D-101 executed as declared** — the disclosure mechanism is a standalone declare-now module; Phase 15's RICH catalog consumes the seam additively. No real ISkill implementations, slash commands, or catalog were built (prohibition honored).
- **D-69 create-only discipline held** — `renderSkillDisclosure` is not imported anywhere in ContextOptimizer/ContextPack/ai types (git-status assertion = 0); the disclosure is proven by tests, exactly like the rest of the trust layer.
- **D-103 executed as declared** — the exact spec-3611 string, single-line package.json diff, both §18 dirs populated before the gate ran, gate green end-to-end.

## Deviations from Plan

None - plan executed exactly as written. Both locked decisions (D-101 declare-now disclosure, D-103 gate re-point) implemented as specified; all prohibitions honored (no real skills/catalog, no pipeline wiring, zero new packages, no other verify scripts touched, zero NP-STRICT markers, no invented error codes/requirement IDs, no schema/contract edits).

## Issues Encountered

- **Fixture length tuning for the exact token decomposition (expected fixture design work)** — the plan's (d) assertion requires `tokens === tokens(active bodies) + tokens(one-liners) + separators`, but `countTokensHeuristic` is ceil-based (ceil(len/4)), which is only exactly additive when part lengths align mod 4. The fixture bodies were tuned so every rendered part folded with its trailing `'\n\n'` separator is length ≡ 0 (mod 4) — the decomposition assertion is then exact, and the test header documents the discipline. No defect; the fixture is designed, not discovered.

## Known Stubs

None - every deliverable is complete: `renderSkillDisclosure` ships the full CTX-05 contract with the fixture-decomposed zero-token proof; the gate re-point is live and green. (D-69 create-only holds: nothing imports the disclosure module from components/AI runtime — by design, Phase 15's RICH catalog is the declared consumer.)

## User Setup Required

None - no external service configuration required (zero new packages, pure TypeScript phase).

## Next Phase Readiness

- **Phase 7 complete** — all six CTX requirements shipped: CTX-01/02/03 (07-01 trust spine), CTX-04/06 (07-02 metrics + golden snapshots), CTX-05 (07-03 disclosure) — and the phase's release block (`verify:phase-7`) is the exact spec-3611 gate running green (8 files / 64 tests).
- Ready for **Phase 8** (memory sources — the MEMORY items' trust mapping applies to whatever retrieval ships then).
- Ready for **Phase 11** (PromptTrace/DiagnosticsSection lifts the metrics/receipt surfaces additively).
- Ready for **Phase 15** (RICH catalog + ISkill implementations consume the SkillDisclosure seam; L6 disclosure UI; SYSTEM persona extends the golden — documented regeneration path).
- No blockers.

---
*Phase: 07-trust-aware-context-and-receipts*
*Completed: 2026-08-30*

## Self-Check: PASSED

All 3 created/modified files exist on disk (`[ -f ]` verified: SkillDisclosure.ts, SkillDisclosure.test.ts, 07-03-SUMMARY.md); both task commits (5b93382, 1dde7de) verified in `git log`. Full gate: `pnpm run verify:phase-7` — tsc strict-clean + 8 files / 64 tests passed (exit 0), covering the CTX-04 snapshot diff + CTX-02 fixtures + CTX-05 proof + CTX-06 metrics + CTX-01/03 pipeline. Zero NP-STRICT markers in `src/core/context/trust/`; single-line package.json diff (only the verify:phase-7 string); disclosure module unwired (git-status empty for ContextOptimizer/ContextPack/ai types). `.planning/STATE.md` + `.planning/config.json` remain modified in the working tree — orchestrator-owned writes, intentionally excluded from all plan commits.