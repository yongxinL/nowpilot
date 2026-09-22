---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 13
subsystem: testing
tags:
  [
    banned-import-gate,
    verify-phase-1,
    gate-composition,
    path-resolution-preflight,
    real-chrome-evidence,
    phase-acceptance,
    validation-sign-off,
    success-criterion-5,
    d-07,
    d-16,
    sa-10,
    nyquist,
    t-1-65,
    t-1-66,
    t-1-67,
    t-1-68,
    t-1-69,
  ]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-02's WXT runtime and the pre-existing `tests/isolation` suites (the gate's comment-stripping helper and the vacuous-pass guard are reused)
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-08's `KeymapRegistry` (the macOS meta-key and Windows/Linux control-key cases), the Phase-1 command set and the dev-only reload gate
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-09's typed provider ports, the D-05 fixture adapter and the shared onboarding flow (manual item 1 and the failure-state gap)
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-10's D-07 legacy cleanup and its neutral notice component (manual item 5), and 01-12's `data-np-backing` convention (manual item 6)
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-11's WXT-only build — `.output/chrome-mv3` is the artifact the operator loaded unpacked and the manifest gate inspects
provides:
  - "`tests/isolation/banned-imports.test.ts` — the repo-level three-group gate for success criterion 5: unsafe HTML injection, the banned styling/primitive libraries, and the banned motion package, each as its own case, with the dependency manifest inspected separately so a declared-but-unimported banned package still fails"
  - "The approved-library non-match case: the gate can never be widened by accident into rejecting the design system's approved motion package (PATTERNS A9)"
  - "`verify:phase-1` realigned to an explicit path list (15 declared paths) covering the §24 minimum, every suite this phase added, `tests/services`, the manifest inspection and the banned-import gate, plus a self-derived path-resolution preflight"
  - "The completed `01-VALIDATION.md`: six observed real-Chrome results, the two environment-scoped sub-checks as open gaps with owners, the five success criteria mapped to evidence, a completed sign-off block and `nyquist_compliant: true`"
affects: [02, 15, 19]

actuals:
  tokens: 14800   # chars/4 over the realized diff (git diff 2792318d..HEAD = 59,305 chars)
  tasks: 3
  commits: 4      # MEASURED: git rev-list --count 2792318d50c6150db02e92c1799a5a7dd66b860e..HEAD
  plan_head_before: 2792318d50c6150db02e92c1799a5a7dd66b860e

tech-stack:
  added: []
  removed: []
  patterns:
    - "A gate over source text strips comments before matching, so prose that names a banned construct (src/index.css's Tailwind-removal note) does not trip the gate and a real usage cannot hide behind a comment"
    - "Every scan-based case asserts a non-zero scanned-item count (93 source files / 22 declared packages), so a scan whose target path stops resolving fails instead of passing vacuously (T-1-66)"
    - "A vitest path filter that stops resolving is not self-evident — vitest silently ignores an unmatched filter whenever another filter matches — so the gate derives its own declared-path list from the command string and exits 1 naming every path that does not resolve"
    - "A browser-chrome criterion is signed off only from an observed result in real Chrome; a sub-check the session could not exercise is carried as an environment-scoped open gap with an owning plan, never claimed"

key-files:
  created:
    - tests/isolation/banned-imports.test.ts
  modified:
    - package.json
    - .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-VALIDATION.md
    - .planning/WINDOWS.md
    - .planning/STATE.md

decisions:
  - "The banned-import gate is one suite with three independent group cases plus a fourth non-match case; a failure names its group (success criterion 5 names three pattern groups)"
  - "Groups 2 and 3 inspect `package.json` as well as `src/`, because a declared-but-unimported banned package is a violation with no source import to catch"
  - "`verify:phase-1` stays an explicit path list (not a bare `vitest run`) so a new suite must be added deliberately and a path that stops resolving is visible; the list is 15 paths plus the Tailwind script"
  - "The path-resolution preflight is self-derived from the gate's own command string rather than a duplicated list, so the two cannot drift apart (WINDOWS id 21)"
  - "The phase's `status: validated` transition was made by this plan after completing the sign-off block (the lifecycle comment attributes the transition to validate-phase §6; the plan is the phase-acceptance owner and the sign-off is now complete)"
  - "WINDOWS ids 9 and 15 were resolved with `windows fixed` — the ledger validator accepts only `open|waived|fixed` — with the actual observation recorded in `01-VALIDATION.md` rather than in the ledger description"
  - "The fixture failure-state half of manual item 1 is recorded as an environment-scoped open gap, not as observed: the shipped build wires `createFixtureValidationPort('success')` in both roots, so the non-success states were not reachable in the artifact the operator loaded"

metrics:
  duration: "21min (agent execution across two sessions; ~11 h wall-clock including the operator's real-Chrome checkpoint)"
  tasks_completed: 3
  files_changed: 5
  completed: "2026-09-22"
  status: complete
---

# Phase 1 Plan 13: Phase Gate Composition and Real-Chrome Acceptance Summary

The phase is gated end to end: a proven-teeth three-group banned-import and dependency gate, a `verify:phase-1` that runs every suite this phase built, and six operator-observed real-Chrome results that close the five success criteria.

## Performance

- **Duration:** ~21 min of agent execution across two sessions (Tasks 1–2 on 2026-09-22 09:12–09:28; Task 3 on 2026-09-22 20:36–20:40), with ~11 h wall-clock dominated by the operator's real-Chrome checkpoint
- **Tasks:** 3/3 complete (Tasks 1–2 autonomous; Task 3 the `checkpoint:human-verify` the operator approved)
- **Files changed:** 5 (`tests/isolation/banned-imports.test.ts` created; `package.json`, `01-VALIDATION.md`, `WINDOWS.md`, `STATE.md` modified)
- **Gate runtime:** `pnpm run verify:phase-1` ~30 s wall (vitest suite duration 21.6 s); quick run + typecheck 9 s

## Accomplishments

1. **Three-group banned-import and dependency gate with proven teeth** (`3b3841e7`). `tests/isolation/banned-imports.test.ts` carries one case per success-criterion-5 pattern group — unsafe HTML (`innerHTML`/`dangerouslySetInnerHTML`), the banned styling and primitive libraries (`tailwind`/`shadcn`/`@radix-ui`) and the banned motion package (`framer-motion`) — plus a fourth case asserting the approved motion v12 package is never matched. Groups 2 and 3 also read `package.json`, so a declared-but-unimported banned package fails with no source import at all. Comments are stripped before matching, every scan case asserts a non-zero scanned-item count, and the file writes nothing. Teeth observed per group before commit: each scratch violation failed its own named case (93 files / 22 packages scanned, 1 offence) and the suite returned green after deletion/restore — including the temporary `package.json` injections for groups 2 and 3.

2. **`verify:phase-1` now runs everything this phase built** (`c3f83528`). The gate is an explicit path list — typecheck; the §24 minimum (`tests/core/runtime tests/core/events tests/core/workspace tests/core/theme`); the named core-tree suites (`commands`, `input`, `onboarding`, `storage`, `strict`); the retained `tests/core`; `tests/background`; `tests/components`; `tests/isolation` (manifest inspection + the new banned-import gate); the previously ungated `tests/services`; then `scripts/verify-no-tailwind.sh`. No pre-existing path was removed or narrowed and `NP_STRICT_CEILING` is still `0`. Because vitest silently ignores an unmatched filter whenever another filter matches (observed: `npx vitest run tests/core/runtime tests/does-not-exist-xyz` → 2 files passed, exit 0), the gate gained a self-derived path-resolution preflight; it was observed failing loudly on `tests/servicez` and green after restore.

3. **Real-Chrome acceptance recorded and the phase signed off** (`3ead3655`). `01-VALIDATION.md` now carries the operator's six observed results (2026-09-22, real Chrome on macOS, profile `/tmp/nowpilot-uat-01-13`, `.output/chrome-mv3` loaded unpacked, the supplied seeding script for the credential row), the Wave 0 checklist complete, the per-task map re-verified against the gate, the five success criteria mapped to evidence, the sign-off block completed and `nyquist_compliant: true` / `wave_0_complete: true`. `WINDOWS.md` ids 9 and 15 (the manual-observation rows for items 6 and 5) were resolved; id 21 stays open for ratification.

## Verification evidence

| Check | Command | Result |
|-------|---------|--------|
| Phase gate | `pnpm run verify:phase-1` | **exit 0** — `tsc --noEmit` clean; `verify:phase-1: 15 declared path(s) resolve`; **40 test files / 513 tests passed**; `verify-no-tailwind: 0 Tailwind className strings in src/` |
| Pre-phase baseline floor | — | 18 files / 166 tests → **40 files / 513 tests** (gate grew coverage, not just its path list) |
| Banned-import suite | `npx vitest run tests/isolation/banned-imports.test.ts` | 4 passed (three group cases + approved-library non-match), each group proven failing against a deliberate violation |
| Isolation + strictness | `npx vitest run tests/isolation tests/core/strict` | 38 passed |
| Quick run + typecheck | `npx tsc --noEmit && npx vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme` | exit 0, 10 files / 172 tests, **9 s** (feedback latency < 10 s) |
| Required-path probe | `node -e "...required paths..."` | `COMPLETE` |
| Strictness ceiling | `node -e "console.log(require('./package.json').NP_STRICT_CEILING)"` | `0` |
| Manual criteria | operator, real Chrome (macOS) | six observed results recorded; two environment-scoped sub-checks carried as open gaps with owners |

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Three-group banned-import and dependency gate with proven teeth | `3b3841e7` | `tests/isolation/banned-imports.test.ts` (created) |
| 2 | Compose `verify:phase-1` so the gate runs everything this phase built | `c3f83528` | `package.json` |
| 3 | Real-Chrome evidence and phase acceptance (checkpoint approved by the operator) | `3ead3655` | `01-VALIDATION.md`, `WINDOWS.md` |
| — | Checkpoint position + gate-preflight deviation (recorded at the stop) | `7f3b06e0` | `STATE.md`, `WINDOWS.md` |

## Success criteria

All five of Phase 1's success criteria are **met**, each with evidence recorded in `01-VALIDATION.md` § Success Criteria Evidence:

1. Side panel + onboarding + `⌘K` palette on both surfaces — manual items 1–2 + `OnboardingFlow` / `CommandPalette` / `KeymapRegistry` / `SidePanelShell` suites green in the gate. *Open sub-check:* the Windows/Linux control chord (owner Phase 15 / 01-08 follow-up).
2. Standalone handoff opens once and focuses the existing tab — manual item 3 + `WorkspaceHandoff` / `WorkspaceRouter` / `StandaloneShell` suites.
3. Single-source `np_theme` propagates to both surfaces without reload; density fixed per surface — manual item 3 + `ThemeStore` / `ThemeSync` / `antdConfig` suites; `compact: true` vs `compact: false` at the two roots.
4. Synchronous background registration + envelope parsing + the four named suites — `tests/background` and the `RuntimeEnvelope` / `EventBus` / `WorkspaceStore` / `WorkspaceRouter` / `ThemeStore` suites, green in the gate.
5. `verify:phase-1` passes and the banned-import greps are zero — exit 0, 40 files / 513 tests, `verify-no-tailwind` 0, `banned-imports.test.ts` green with proven teeth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest silently ignores an unmatched path filter — the gate's misspelled-path probe could not fail**

- **Found during:** Task 2 (recorded at the checkpoint, `7f3b06e0`; WINDOWS id 21)
- **Issue:** the plan expected a deliberately misspelled path in `verify:phase-1` to fail loudly, but `npx vitest run tests/core/runtime tests/does-not-exist-xyz` reports `2 files passed, exit 0` — vitest ignores an unmatched filter whenever another filter matches. A path that stops resolving would have left the gate green.
- **Fix:** a self-derived path-resolution preflight was added to the gate (it extracts every `tests/...` and `scripts/...` token from the command string and exits 1 naming any that does not resolve). Observed failing on `tests/servicez` and green after restore.
- **Files modified:** `package.json`
- **Commit:** `c3f83528` (recorded `7f3b06e0`)

**2. [Rule 1 - Scope truthfulness] The fixture failure-state half of manual item 1 is not reachable in the shipped build**

- **Found during:** Task 3 (the operator's checkpoint approval and the recording rules)
- **Issue:** the checkpoint's item 1 procedure asks for the fixture validation to reach both a success and a failure state. Both surface roots hardwire `createFixtureValidationPort('success')`, so the non-success selectors are not reachable in `.output/chrome-mv3` without a source flip and rebuild.
- **Fix:** the item is recorded as observed for the panel/onboarding/masking/success behaviours, and the failure-state flip is recorded as an **environment-scoped open gap with an owner** (01-09 / Phase 3 — the real provider port replaces the fixture argument) rather than claimed as observed. The five failure/cancel selectors remain unit-covered by `tests/services/providerValidationFixtures.test.ts`.
- **Files modified:** `01-VALIDATION.md`
- **Commit:** `3ead3655`

**3. [Rule 1 - Instrument] The ledger has no `observed` status — the two manual-observation rows were resolved with `windows fixed`**

- **Found during:** Task 3 reconciliation
- **Issue:** the instruction was to move `WINDOWS.md` ids 9 and 15 to `observed`, but the ledger validator accepts only `open | waived | fixed` (`broken-windows.cjs`), and an invented status makes the ledger malformed.
- **Fix:** both rows were resolved with the CLI's only resolution verb (`gsd-tools windows fixed 9|15`, `open_count` 17 → 15, `fixed_count` 4 → 6) and the observation itself is recorded in `01-VALIDATION.md` § Manual-Only Verifications. Id 21 stays `open` for phase-acceptance ratification as instructed.
- **Files modified:** `WINDOWS.md`
- **Commit:** `3ead3655`

**4. [Rule 2 - Missing critical content] The manual table had five rows but the checkpoint has six items**

- **Found during:** Task 3
- **Issue:** `01-VALIDATION.md` § Manual-Only Verifications carried five rows; the checkpoint's item 6 (deferred/fixture marking and geometry parity, the browser-observed owner of WINDOWS id 9) had no row.
- **Fix:** a sixth row was added and all six were replaced with observed results; the plan-mandated acceptance requires six.
- **Files modified:** `01-VALIDATION.md`
- **Commit:** `3ead3655`

### Notes on plan-permitted recording choices

- The `status: validated` frontmatter transition was made by this plan on completing the sign-off block; the lifecycle comment attributes it to `/gsd-validate-phase` §6. No Wave 0 suite is absent and no success criterion is marked met while a Wave 0 suite is missing.
- The Phase-1 per-surface density claim rests on the two roots (`compact: true` / `compact: false`) plus the manual geometry-parity observation; no jsdom suite asserts the root-level flags.

### Auth gates

None — no authentication was required by this plan.

## Issues Encountered

- **The misspelled-path probe could not fail as written** (deviation 1) — resolved with the self-derived preflight, which is now part of the gate and asserted by the gate's own output (`15 declared path(s) resolve`).
- **The failure-state flip is not reachable in the shipped artifact** (deviation 2) — recorded as an open gap with an owner instead of being claimed; the plan's own rule ("record as an open gap with an owning plan id") applies.
- **The ledger vocabulary has no `observed` status** (deviation 3) — resolved with `fixed` plus the observation in the validation document.

## Known Stubs

None introduced by this plan. The phase's deferred/fixture markers (`data-np-backing`) are intentional, spec-mandated presentation and remain tracked in `WINDOWS.md` / `01-MIGRATION-INVENTORY.md`; 01-13 added only a test file, a gate script and documentation.

## Threat Flags

None. This plan adds no network endpoint, auth path, file-access pattern or schema change at a trust boundary: the banned-import suite is read-only over `src/` and `package.json`, and the gate preflight is a read-only path-existence check over the repository.

## Threat register disposition

| Threat | Disposition | Evidence |
|--------|-------------|----------|
| T-1-65 (gate composition tampering) | mitigated | Explicit 15-path list + self-derived resolution preflight; misspelled path observed failing loudly before restore (WINDOWS id 21) |
| T-1-66 (vacuous gate) | mitigated | Every scan case asserts non-zero scanned items (93 files / 22 packages); gate counts measured against the baseline (40 files / 513 tests vs 18 / 166) |
| T-1-67 (banned constructs re-entering) | mitigated | Three group cases over source + manifest, comment-stripped, each proven failing against a deliberate violation (`3b3841e7`) |
| T-1-68 (manual criteria signed off from unit tests) | mitigated | Six observed real-Chrome results recorded; the two sub-checks the session could not exercise are open gaps, not claims |
| T-1-69 (gate narrowed to reach green) | mitigated | No path removed or narrowed; `NP_STRICT_CEILING` still `0`; `verify-no-tailwind` unchanged |
| T-1-SC (installs) | mitigated | No install occurred; the gate fails on a banned package name declared in `package.json` even with no source import |

## User Setup Required

None — no environment variables, credentials or external services.

## Next Phase Readiness

- **Phase 2 (Storage, Security, WriteJournal, Workspace Persistence)** can start: `pnpm run verify:phase-1` is green, the manifest inspection and banned-import gates are inside it, and the §24 minimum path set is preserved for later `verify:phase-N` composition.
- **Carried forward for the phase acceptance review** (all open in `WINDOWS.md`, none blocking the gate): the two environment-scoped sub-checks above, the gate-preflight ratification (id 21), the `RuntimeEnvelope` spec-conformance question (id 4), the `WORKSPACE_HANDOFF` literal overlap (id 6), and the 01-10/01-11 scope and instrument deviations (ids 16–20).
- **Phase 15 / 01-08 follow-up** owns the Windows/Linux chord observation; **Phase 3** (with 01-09) owns the live provider validation path that makes the fixture failure states reachable in the browser.

## Self-Check

- `tests/isolation/banned-imports.test.ts` — FOUND
- `01-VALIDATION.md` (sign-off completed, `nyquist_compliant: true`) — FOUND
- `package.json` `verify:phase-1` (15 declared paths resolve) — FOUND
- Commits `3b3841e7`, `c3f83528`, `7f3b06e0`, `3ead3655` — FOUND in `git log`
- `pnpm run verify:phase-1` — exit 0 (40 files / 513 tests) on 2026-09-22
- `WINDOWS.md` ids 9 and 15 resolved; id 21 open — VERIFIED

## Self-Check: PASSED
