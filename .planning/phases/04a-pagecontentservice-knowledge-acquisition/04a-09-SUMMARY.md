---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 09
subsystem: testing
tags: [isolation, content-bundle, wxt, vitest, sourcemap, size-gate, zod, password-invariant]

# Dependency graph
requires:
  - phase: 04a-06
    provides: content-side extraction transport (bridge serialization, watcher)
  - phase: 04a-07
    provides: ContentScriptHost serialization + watcher wiring + mode reply (new content-side code in the bundle)
provides:
  - Single canonical content-bundle isolation gate (D-4a-23) enforcing tokens + < 50 KB sourcemap-stripped payload + D-4a-20 password invariant
  - Retired check-content-bundle.mjs name; all six verify chains end at `vitest run`
affects: [04a-10, verify-work, phase verification, future bundle-size audits]

# Tech tracking
tech-stack:
  added: [none]
  patterns:
    - "Isolation gate lives in the §24/§18-named vitest test (single enforcement point, D-4a-23)"
    - "Bundle-size assertion measures the sourcemap-stripped payload via lastIndexOf+slice (JS `$` regex cannot cross the trailing newline of an inline base64 sourcemap)"
    - "Password-omission invariant asserted at the schema boundary in tests/isolation/ (P4a-4)"

key-files:
  created: []
  modified:
    - tests/isolation/no-content-script-ui.test.ts (extended: folded walker + extended FORBIDDEN_TOKENS + stripped-size gate + password invariant)
    - tests/isolation/check-content-bundle.mjs (DELETED)
    - package.json (six verify scripts drop the trailing .mjs call)

key-decisions:
  - "Folded the retired .mjs walker into the canonical vitest test body (D-4a-23 recommended option): single enforcement point, no dual-maintenance"
  - "Size strip implemented with lastIndexOf + slice instead of a `$`-anchored regex — JS `$` without the 'm' flag matches only at end-of-input, so `.*$` silently matches nothing when the inline base64 sourcemap ends with a newline (discovered via RED test on the fresh 227 KB bundle)"
  - "TDD RED proved Pitfall 3 empirically: the raw-file size assertion failed on the clean bundle (131072 > 51200) exactly as RESEARCH documented"

patterns-established:
  - "One canonical isolation test file per phase gate; verify chains delegate to vitest instead of ad-hoc node scripts"
  - "Size gates always strip inline sourcemaps before measuring payload bytes"

requirements-completed: [CAT-04, CAT-05, CAT-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Content-bundle isolation gate extended (D-4a-23): forbidden-token scan with turndown/minisearch/readability added, walker folded from retired .mjs, background-SW R-3 scan retained"
    requirement: CAT-04
    verification:
      - kind: unit
        ref: "tests/isolation/no-content-script-ui.test.ts#content-script bundle contains no UI/antd/React (Appendix G isolation rule)"
        status: pass
      - kind: unit
        ref: "tests/isolation/no-content-script-ui.test.ts#background SW contains no AI runtime or vault (R-3, Pitfall 6)"
        status: pass
    human_judgment: false
  - id: D2
    description: "< 50 KB payload size gate measuring the sourcemap-stripped bundle (Pitfall 3, ROADMAP criterion 3 / §22.1)"
    requirement: CAT-05
    verification:
      - kind: unit
        ref: "tests/isolation/no-content-script-ui.test.ts#content bundle payload stays under 50 KB (sourcemap-stripped, Pitfall 3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-4a-20 password-omission invariant asserted at the schema boundary (P4a-4): isPassword with a value rejected, bare isPassword accepted"
    verification:
      - kind: unit
        ref: "tests/isolation/no-content-script-ui.test.ts#FormControlSchema omits password values at the schema boundary (D-4a-20, P4a-4)"
        status: pass
    human_judgment: false
  - id: D4
    description: "check-content-bundle.mjs retired; all six verify scripts (verify:phase-1..4 + verify:phase-4a) end at `vitest run` with no reference to the deleted file"
    verification:
      - kind: other
        ref: "grep -rn 'check-content-bundle' package.json returns nothing; all six verify:phase chains end at `vitest run`"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-08-13
status: complete
---

# Phase 04a Plan 09: Content-Bundle Isolation Gate Extension Summary

**Single canonical isolation gate (D-4a-23): folded walker + turndown/minisearch/readability tokens + sourcemap-stripped < 50 KB payload assertion + D-4a-20 password invariant, with check-content-bundle.mjs retired and all six verify scripts rewired to `vitest run`**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-13T07:02:08Z
- **Completed:** 2026-08-13T07:13:00Z
- **Tasks:** 1 (TDD: RED + GREEN commits)
- **Files modified:** 3 (1 extended, 1 deleted, 1 config)

## Accomplishments
- Folded the retired `check-content-bundle.mjs` walker (recursive walk + `isContentBundle` + both token sets) into the canonical `no-content-script-ui.test.ts` — one enforcement point per D-4a-23, no dual-maintenance
- Extended `FORBIDDEN_TOKENS` with `turndown` / `minisearch` / `readability` (RESEARCH Pitfall 6) while keeping every Phase-1/2/3 token intact — the 04a extraction libs must never reach the content bundle
- Added the sourcemap-stripped < 50 KB payload assertion (Pitfall 3 / ROADMAP criterion 3 / §22.1): current bundle measures 27,219 bytes payload vs 227,196 raw — raw-file measurement would false-fail the clean bundle ~8.3× over the cap
- Added the D-4a-20 password-omission invariant at the schema boundary (P4a-4): `isPassword` with a value is rejected; bare `isPassword` accepted — the boundary gate never loosened
- Deleted `tests/isolation/check-content-bundle.mjs` (D-4a-23 name retirement); updated ALL SIX verify chains (`verify:phase-1`, `verify:phase-2`, `verify:phase-3`, `verify:phase-3a`, `verify:phase-4`, `verify:phase-4a`) to end at `vitest run` — the isolation gate runs inside the suite, and no script references the deleted file
- TDD RED demonstrated Pitfall 3 empirically: the raw-file size assertion failed on the clean bundle (131072 > 51200) before the strip was added

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend no-content-script-ui.test.ts (tokens + size + password invariant)** — TDD cycle:
   - `0921dac` (test — RED): extended isolation suite with folded walker, extended tokens, raw-size gate (FAILS on clean bundle: 131072 > 51200, proving Pitfall 3), password invariant
   - `aa2760a` (feat — GREEN): sourcemap-stripped payload gate, `.mjs` deletion, six verify scripts updated

**Plan metadata:** pending final docs commit

_Note: TDD task — RED test commit + GREEN implementation commit_

## Files Created/Modified
- `tests/isolation/no-content-script-ui.test.ts` - Extended from a 15-line `execFileSync` wrapper to the full canonical gate: folded walker, extended FORBIDDEN_TOKENS, sourcemap-stripped size assertion, background-SW R-3 scan, FormControlSchema invariant tests (4 tests, ~195 lines)
- `tests/isolation/check-content-bundle.mjs` - DELETED per D-4a-23 (name retired; logic folded into the vitest test)
- `package.json` - All six verify scripts: trailing `&& node tests/isolation/check-content-bundle.mjs` removed

## Decisions Made
- **Fold-in mechanics (D-4a-23 discretion):** inlined the walker + token sets as local helpers in the canonical test file rather than renaming the helper — single enforcement point, matches RESEARCH Open Q4's recommended option
- **Strip via lastIndexOf + slice, not regex:** the initial `/\n?\/\/# sourceMappingURL=data:.*$/` regex silently matched nothing on the fresh 227 KB bundle. Root cause: JS `$` without the `m` flag anchors only at end-of-input, and `.` cannot cross the trailing newline of the inline base64 sourcemap. The plan explicitly allows "regex or indexOf" — indexOf + slice is deterministic
- **TDD RED target = the raw-size failure:** the natural failing test for this gate is the naive raw measurement, which fails on the clean bundle exactly as Pitfall 3 documents — making the RED meaningful (the gate genuinely enforces)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `$`-anchored sourcemap-strip regex matched nothing on the fresh bundle**
- **Found during:** Task 1 GREEN (post-build verification)
- **Issue:** The planned `/\n?\/\/# sourceMappingURL=data:.*$/` strip returned the full 227,196-byte file (strip no-op) because JS `$` without the `m` flag only matches at end-of-input and `.*` cannot cross the trailing newline of the inline base64 sourcemap — the size test failed on a clean bundle. Earlier builds (131 KB) apparently serialized the sourcemap comment without a trailing newline, so the same regex worked; the new 227 KB build's sourcemap ends in `\n`.
- **Fix:** Replaced the regex with `text.lastIndexOf('//# sourceMappingURL=')` + `slice(0, idx)` — the plan explicitly permits "regex or indexOf". Deterministic across bundle shapes.
- **Files modified:** tests/isolation/no-content-script-ui.test.ts
- **Verification:** 4/4 isolation tests pass on the fresh build; payload measures 27,219 bytes < 51,200
- **Committed in:** aa2760a (GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was required for gate correctness — the exact failure mode Pitfall 3 warns about (false-failing the clean bundle). No scope creep; final gate matches plan intent (stripped-payload measurement).

## Issues Encountered
- None — the plan executed cleanly aside from the regex behavior documented above (which is a legitimately discovered pitfall, now commented in the test file).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The isolation gate now enforces all three invariants (tokens incl. turndown/minisearch/readability, sourcemap-stripped < 50 KB payload, password omission) plus the background-SW R-3 scan — CAT-04 and CAT-05 proven on every `vitest run`
- `check-content-bundle.mjs` fully retired; `grep -rn "check-content-bundle" package.json` returns nothing
- Ready for 04a-10 (final plan of the phase); after that the phase verification (`verify:phase-4a`) runs the whole chain green

---
*Phase: 04a-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-13*

## Self-Check: PASSED
- SUMMARY.md exists on disk ✓
- RED commit `0921dac` exists ✓
- GREEN commit `aa2760a` exists ✓
- All three behavior tests pass via `pnpm vitest run tests/isolation --bail=1` (the `-x` flag is unknown in vitest 4.1.10 — documented Rule 3 deviation) after `pnpm wxt build` ✓
- FORBIDDEN_TOKENS contains turndown/minisearch/readability + all Phase-1/2/3 tokens ✓
- Size assertion strips sourcemap before measuring (grep sourceMappingURL) ✓
- check-content-bundle.mjs no longer exists; `grep -rn "check-content-bundle" package.json` returns nothing ✓
- All six verify chains end at `vitest run` ✓
- FormControlSchema invariant tests pass ✓
