---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 13
subsystem: testing
tags: [verify-phase-2, path-preflight, gate-correction, d2-28, d2-29, d2-05, phase-close, manifest-gate, windows-deferrals, wave-8]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: "the `verify:phase-1` self-derived path-resolution preflight (the pattern reused in structure) and the generated-manifest gate (`tests/isolation/generated-manifest.test.ts`)"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "every live Phase 2 suite named by the corrected gate — 02-02's storage spine and migrator, 02-03's vault crypto core, 02-04's credential port, 02-05's ErrorStore and legacy migration, 02-06's workspace persistence and writer election, 02-07/02-08/02-09/02-10's store, hydration and surface wiring suites"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-11's and 02-12's two integration suites over the shared harness, and the D2-35 traceability record in 02-VALIDATION.md"
provides:
  - "package.json — corrected `verify:phase-2`: `tsc --noEmit`, the self-derived path preflight (22 declared paths), one `vitest run` over 21 explicit Phase 2 suite files plus `tests/isolation`"
  - "02-VALIDATION.md — the D2-28 gate row green, the Wave 0 gate item ticked, the sign-off block observed with `nyquist_compliant: true` (Manual-Only 400 px row still outstanding)"
  - ".planning/STATE.md — the completed-phase position/progress/metrics, the D2-29 source-conflict record with owner `Phase 3 planner`, and the D2-05 Phase 3 credential-entry inheritance record"
  - ".planning/ROADMAP.md — the Phase 3 entry's `Inherited constraints (from Phase 2 D2-26/D2-29)` and `Inherited constraints (from Phase 2 D2-05)` lines"
affects: [phase-03-cost-effective-ai-runtime, phase-15-workspace-experience, phase-19-release-gate]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 2130
  tasks: 2
  commits: 2
  plan_head_before: 63563a66a4271e1d58b78426fd64db41ef4ddf10

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The self-derived path preflight is reused verbatim in structure from `verify:phase-1`: the script reads its own text out of `package.json`, extracts every `tests/...`/`scripts/...` token with the same regex shape, de-duplicates, and exits 1 naming every path that fails `fs.existsSync` — so a renamed, deleted or misspelled suite fails the gate instead of being silently ignored by Vitest (WINDOWS #21's silent-ignore defect)"
    - "Explicit file paths over directories for the new suites: a directory filter (`tests/core/security`) would silently widen as files are added and cannot distinguish a Phase 2 suite from a Phase 1 one; only `tests/isolation` stays a directory because it is the retained gate directory (OQ-7). The gate is `tsc` → preflight → suites, so a type error or a dead path fails before any test runs"
    - "Gate evidence is ordered by artifact dependency: `pnpm run build:ext` first (the manifest gate fails, never skips, when `.output/chrome-mv3/manifest.json` is absent), then the phase gate, then the cross-phase regression, then the independent manifest assertion"

key-files:
  created: []
  modified:
    - package.json
    - .planning/phases/02-storage-security-writejournal-workspace-persistence/02-VALIDATION.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "The corrected gate enumerates 21 explicit suite files (every live Phase 2 suite from 02-02 through 02-12, including the four phase-touched component suites) plus the `tests/isolation` directory — 22 declared paths, all resolving. The stale `tests/core/utils` token is gone and no `RateLimiter` suite exists: the deferral is corrected at the gate, not papered over with a dummy file (D2-26/D2-28)."
  - "The preflight is the `verify:phase-1` expression reused in structure rather than a new script or a shared helper module: a shared binary would have to be added to the repo and the JSON-embedded pattern is already the established shape in this project, and the plan named that pattern explicitly."
  - "`scripts/verify-no-tailwind.sh` is run as a separate stage of the phase evidence (after `verify:phase-1`, which already composes it) rather than duplicated inside `verify:phase-2` — the D2-28 script shape is `tsc` + preflight + suites, and the phase gate stays the acceptance instrument for the Phase 2 surface."
  - "`nyquist_compliant` flips true (every sampled row passed) while `status` stays `draft`: the file's own declared lifecycle reserves `validated` for `/gsd-validate-phase` §6, and the Manual-Only 400 px backstop row remains outstanding and routed to the Phase 15 consolidated Real-Chrome cycle."
  - "D2-29 is recorded on both planning surfaces it names — a STATE.md decision bullet that names the documentation follow-up owner verbatim as `Phase 3 planner`, and the Phase 3 ROADMAP entry's `Inherited constraints (from Phase 2 D2-26/D2-29)` line mapping Requester/RateLimiter to Phase 3 under `CORE-03` with D2-27's constraints. `PRODUCT_SPEC.md` is deliberately left stale (asserted by content, not by an empty diff): its §18 Phase 2 Create list still names `src/core/utils/RateLimiter.ts` and `src/core/http/Requester.ts`."
  - "The D2-05 Phase 3 credential-entry inheritance is recorded alongside it as a companion bullet and a companion ROADMAP line, so the Phase 3 inherited-constraints note is non-vacuous: transient input → real provider validation through Requester/ProviderRouter → storage through `CredentialStorePort` → transient input cleared; on validation failure no persistence and no provider-ready state."
  - "No window changes status and the Manual-Only backstop stays outstanding: `.planning/WINDOWS.md` is untouched, ids 5, 7 and 8 stay `open` (deferred to the Phase 15 cycle, Phase 19 gate must fail while open), and the built manifest assertion confirms the four authorised permissions with `connect-src 'none'`."

patterns-established:
  - "A gate correction is proved by its teeth, not by its green run: the misspelled-path observation (exit 1 naming the path) is recorded next to the restored green run, so the preflight's failure mode is evidence rather than an assertion."
  - "Phase close writes only what was observed: the Observed/Verified record names the exact commands and counts, the deferred windows and Manual-Only row stay outstanding, and the follow-up ownership (D2-29's `Phase 3 planner`) is named on the surfaces the next planner reads."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "The corrected `verify:phase-2` declares every live Phase 2 suite explicitly behind the self-derived preflight; the stale `tests/core/utils` expectation is gone, no `RateLimiter` suite exists, and no watch flag appears"
    requirement: "CORE-02"
    verification:
      - kind: other
        ref: "node -e path-resolution preflight over the script's own text → 'verify:phase-2: 22 declared path(s) resolve' (exit 0); misspelling observation → exit 1 'unresolved declared path(s): tests/core/security/KeyVaultt.test.ts'; restore → green"
        status: pass
    human_judgment: false
  - id: D2
    description: "The phase gate is green end to end after the build and no completed phase regressed: `pnpm run build:ext` → `pnpm run verify:phase-2` (25 files / 441 tests) → `pnpm run verify:phase-1` (55 files / 835 tests), the tailwind gate clean, and the built manifest carrying exactly the four authorised permissions with `connect-src 'none'` and no content_scripts key. FALSIFIED AFTER THE FACT: the truth as stated stopped holding once the review-fix commits landed — the over-broad Phase-1 substring gate counted the IN-05/IN-06 doc comment at `src/core/security/KeyVault.ts:33` as a call site, so `verify:phase-1` was observed red on re-run (02-VERIFICATION.md gap 1). Plan 02-14 replaced that rule with the scope-aware credential-boundary gate (`tests/isolation/credential-boundary.test.ts`) and re-ran both phase gates from one code state; the fresh result lives in `02-14-SUMMARY.md`."
    requirement: "CORE-02"
    verification:
      - kind: gate
        ref: "pnpm run build:ext && pnpm run verify:phase-2 && pnpm run verify:phase-1 (44 s total, exit 0) plus the manifest assertion — observed exit 0 at 02-13 execution (2026-09-24T03:08Z); SUPERSEDED: a re-run at 2026-09-24T14:40Z exited 1 on `verify:phase-1` (1 failed | 867 passed tests), citing 02-VERIFICATION.md gap 1"
        status: fail
    human_judgment: false
  - id: D3
    description: "The phase record states what was verified and what remains outstanding — D2-29 recorded on STATE.md and the ROADMAP Phase 3 entry with owner `Phase 3 planner`, D2-05 recorded alongside it, PRODUCT_SPEC left stale, windows and the Manual-Only row untouched"
    requirement: "CORE-02"
    verification:
      - kind: other
        ref: "the plan's Task 2 automated token assertion → 'D2-29 follow-up recorded with owner Phase 3 planner; PRODUCT_SPEC left stale' (exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No deferred window and no Manual-Only verification is closed by this plan: WINDOWS #5/#7/#8 stay `open`, the Manual-Only 400 px backstop row stays outstanding, and the phase record claims automated coverage only"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A deferral is an operator judgement, not a test result. A verifier should confirm `.planning/WINDOWS.md` is unmodified (ids 5, 7 and 8 still `open`), that `02-VALIDATION.md`'s Manual-Only row is still outstanding, and that nothing in this plan's record claims an observed Real-Chrome result."

duration: 6 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 13: The Corrected Phase Gate and the Phase-2 Close Summary

**`verify:phase-2` no longer names a suite that does not exist: the gate now enumerates 21 live Phase 2 suite files plus `tests/isolation` behind the reused self-derived path preflight — observed red (exit 1 naming the path) on a deliberately misspelled suite and green after restore — and the phase closes green end to end (`build:ext` → `verify:phase-2` 25 files / 441 tests → `verify:phase-1` 55 files / 835 tests, 44 s) with the D2-29 source conflict and the D2-05 Phase 3 inheritance recorded on both planning surfaces and every deferred window left open. **(superseded 2026-09-24 — see the correction block below)**

> **Correction (2026-09-24, plan 02-14): the cross-phase claim above was superseded.** The original chain *was* genuinely green when 02-13 ran — `build:ext` → `verify:phase-2` → `verify:phase-1` all exited 0 at 2026-09-24T03:08Z. A later documentation-only review-fix commit (`18d206c6`, IN-05/IN-06) added a doc comment at `src/core/security/KeyVault.ts:33` that merely *names* `CredentialStorePort`; the Phase-1 case at `tests/services/providerValidationFixtures.test.ts` was a comment-blind substring scan over `src/**`, so that prose counted as a call site and cumulative `verify:phase-1` was observed red on re-run (2026-09-24T14:40Z — `02-VERIFICATION.md` gap 1). Three planning documents repeated the stale claim; this summary keeps the historical observation and marks it superseded rather than erasing it. Plan 02-14 replaced the over-broad substring rule with the scope-aware credential-boundary gate (`tests/isolation/credential-boundary.test.ts`) and re-ran `verify:phase-1` and `verify:phase-2` from one code state. **No production credential boundary was weakened.** The fresh numbers are in `02-14-SUMMARY.md`.

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-24T03:01:52Z
- **Completed:** 2026-09-24T03:08:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- **The stale expectation is gone and the gate has teeth.** `verify:phase-2` was `tsc --noEmit && vitest run tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts` — it named `tests/core/utils`, which does not exist, and Vitest silently ignored the unmatched filter while the other filters matched. The corrected script enumerates 21 explicit Phase 2 suite files (the four security suites, the seven storage suites, workspace persistence and writer election, the store suite, both integration suites, and the four phase-touched component suites) plus the `tests/isolation` directory, preceded by the `verify:phase-1` self-derived path preflight over the script's own text. 22 declared paths resolve; no `tests/core/utils` token, no `RateLimiter` suite, no watch flag.
- **The preflight's failure mode was observed, not assumed.** Task 1 temporarily misspelled `tests/core/security/KeyVault.test.ts` → the preflight stage run alone exited 1 printing `verify:phase-2: unresolved declared path(s): tests/core/security/KeyVaultt.test.ts`; after restoring the path it exited 0 printing `verify:phase-2: 22 declared path(s) resolve`. Both observations are recorded here and in the task commit message.
- **The full gate is green after the build, in the required order.** `pnpm run build:ext` (907 ms, manifest emitted) → `pnpm run verify:phase-2` → 25 test files / 441 tests passed, exit 0 → `pnpm run verify:phase-1` → 55 files / 835 tests passed, exit 0 (the cross-phase regression: no completed phase suite broke) → `bash scripts/verify-no-tailwind.sh` → 0 Tailwind utility strings → the manifest assertion: permissions `[sidePanel, storage, tabs, unlimitedStorage]`, `extension_pages` CSP ending `connect-src 'none'`, no `content_scripts` key, no other permission drift. The whole Task 2 chain (build + both gates + assertion) took 44 s. **(superseded 2026-09-24 — see the correction block above)**
- **The phase record now matches observation.** `02-VALIDATION.md`: the 02-13 gate row is green with its observed result, the Wave 0 `verify:phase-2` item is ticked with the commit reference, the sign-off block is observed, and `nyquist_compliant` flips true (every sampled row passed) while `status` stays `draft` for `/gsd-validate-phase`; the Manual-Only 400 px backstop row stays outstanding for the Phase 15 cycle. `STATE.md`: position 13 of 13 with `Status: Phase complete — ready for verification`, frontmatter `status: verifying` and `completed_plans: 26`, the per-plan metrics row, and the D2-29/D2-05 decision bullets.
- **D2-29 and D2-05 are recorded where the next planner reads them.** `STATE.md` § Accumulated Context → Decisions carries the source conflict (PRODUCT_SPEC §18's Phase 2 Create list names Requester and RateLimiter while the Phase 2 goal and completion criteria require no outbound HTTP and the first production consumers are Phase 3), the deferral to Phase 3 under `CORE-03` per D2-26/D2-27, and the follow-up owner named verbatim as `Phase 3 planner` — with the Product Specification deliberately unedited. The ROADMAP Phase 3 entry carries `Inherited constraints (from Phase 2 D2-26/D2-29)` and the companion `Inherited constraints (from Phase 2 D2-05)` (Phase 3's credential-entry contract on both approved surfaces). The Phase 2 plan list was not edited: `git diff` on ROADMAP.md at the task commit is exactly the three inserted lines in the Phase 3 entry.
- **Nothing was closed that was not observed.** `.planning/WINDOWS.md` is byte-unchanged; ids 5, 7 and 8 stay `open` with the Phase 2 automated-coverage PASS notes from 02-12 intact; no window is marked fixed or waived; the Manual-Only 400 px backstop is still outstanding. The phase's verification claim is automated contract coverage only.

## Preflight teeth observation (Task 1)

The gate's preflight stage was run alone (extracted from the script's own ` && `-joined segments) in both states:

| State | Observed result |
|---|---|
| `tests/core/security/KeyVault.test.ts` misspelled as `KeyVaultt.test.ts` | exit 1 — stderr: `verify:phase-2: unresolved declared path(s): tests/core/security/KeyVaultt.test.ts` |
| Path restored | exit 0 — stdout: `verify:phase-2: 22 declared path(s) resolve` |

No file besides the script's own path list changed during the observation, and the final committed script differs from the pre-plan script only in that one line (`git diff` names one insertion, one deletion).

## Gate evidence (Task 2)

| Stage | Command | Observed |
|---|---|---|
| Build | `pnpm run build:ext` | exit 0 — `.output/chrome-mv3/manifest.json` emitted (907 ms) |
| Phase gate | `pnpm run verify:phase-2` | exit 0 — 22 declared paths resolve; 25 files / 441 tests passed |
| Cross-phase regression | `pnpm run verify:phase-1` | exit 0 at 02-13 execution (2026-09-24T03:08Z); superseded — re-run exited 1, see the correction block |
| Tailwind gate | `bash scripts/verify-no-tailwind.sh` | exit 0 — 0 Tailwind utility strings in `src` |
| Manifest assertion | `node -e` over the built manifest | exit 0 — `[sidePanel,storage,tabs,unlimitedStorage]`; `connect-src 'none'`; no `content_scripts` key |
| D2-29 record assertion | the plan's Task 2 `node -e` | exit 0 — "D2-29 follow-up recorded with owner Phase 3 planner; PRODUCT_SPEC left stale" |

Full chain wall time: 44 s (build + both gates + manifest/record assertions). No Vitest failing count, no "generated manifest not found", no "unresolved declared path(s)".

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite `verify:phase-2` with the explicit suite list and the self-derived preflight** — `417454fe` (chore)
2. **Task 2: Full gate run, phase-1 regression, and the phase record** — `fe3ca351` (docs)

**Plan metadata:** the final `docs(02-13)` commit (SUMMARY.md + the state/roadmap progress updates)

## Files Created/Modified

- `package.json` — the corrected `verify:phase-2`: `tsc --noEmit` → the self-derived path preflight → one `vitest run` over 21 explicit suite files + `tests/isolation`. The only file change in Task 1 (one line replaced).
- `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-VALIDATION.md` — the D2-28 gate row green with observed evidence, the Wave 0 gate item ticked (commit `417454fe`), the phase-close note, `nyquist_compliant: true` with the frontmatter comment rewritten to the observed 02-13 state, the sign-off block checked, and the Approval line naming the observed commands (the Manual-Only row untouched).
- `.planning/STATE.md` — `status: verifying`, the new `stopped_at` line, `completed_plans: 26`, `Status: Phase complete — ready for verification`, the `Phase 02 P13` metrics row, and the two new Phase 2 decision bullets (D2-29 and D2-05). § Verification Deferrals unchanged (the 02-12 automated-coverage notes stay; #5/#7/#8 stay deferred).
- `.planning/ROADMAP.md` — the Phase 3 entry's two inherited-constraints lines. Nothing else in the file is touched by this plan's tasks (the phase list and the Phase 2 entries are unchanged).

## Decisions Made

- **Explicit suite files, not directories, for the new suites.** A directory filter silently widens as files land and cannot distinguish a Phase 2 suite from a Phase 1 one; `tests/isolation` stays a directory only because it is the retained gate directory (OQ-7). This is also why the gate runs `tsc` and the preflight before any test.
- **The preflight is the phase-1 expression reused in structure**, not extracted into a shared script: the plan named that pattern and the duplicated one-liner is the established shape in this repo.
- **The tailwind gate stays outside `verify:phase-2`.** The D2-28 script shape is `tsc` + preflight + suites; the tailwind gate already composes into `verify:phase-1` and is run explicitly in the phase evidence, so the phase gate keeps its single purpose.
- **`nyquist_compliant: true` with `status: draft`.** All sampled rows passed (the last pending one was this plan's own gate row), so the honest value flips; the `validated` status stays reserved for `/gsd-validate-phase` per the file's declared lifecycle.
- **The D2-29 follow-up is recorded, not patched.** The canonical Product Specification is left stale on purpose and asserted by content (both paths still present in §18's Phase 2 Create list); the owner travels with the record as `Phase 3 planner`.
- **The Phase 3 inheritance is doubly recorded** (STATE bullet + ROADMAP line for D2-26/D2-29; the same for D2-05) because the Phase 3 planner reads both surfaces and a note that lives on only one of them can silently go missing.

## Deviations from Plan

None - plan executed exactly as written.

**Note (bookkeeping, not a deviation):** the plan's verification text says the Phase 2 plan list in `ROADMAP.md` is byte-unchanged, and the workflow also mandates `roadmap update-plan-progress 02` at phase close. That verb's only phase-list delta is flipping the `02-13-PLAN.md` completion checkbox (plus the plans count, the phase bullet and the progress row); no plan entry was reworded, removed or added by this plan. `PRODUCT_SPEC.md`'s §18 Phase 2 Create list is byte-unchanged, and `.planning/WINDOWS.md` is untouched.

## Issues Encountered

- `state update-progress` declined (`phase scope is unscoped, not complete`), so the completed-phase progress values were updated directly from the observed counts (frontmatter `completed_plans: 26`, the plan-count line unchanged at the phase's `13 of 13` shape) rather than by the handler. The progress bar stays at the completed-phases ratio (1 of 19), which is unchanged because Phase 2's *verification* (not its execution) is the next step.

## Known Stubs

None — this plan ships no source code and adds no placeholder.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or trust-boundary surface is introduced (the plan's changed files are a package script and planning records).

## Self-Check: PASSED

## Next Phase Readiness

- The corrected gate is the phase's acceptance instrument and is green against the live suites; `/gsd-verify-work` can run against an accurate record.
- Phase 3 inherits: Requester/RateLimiter ownership under `CORE-03` with D2-27's constraints, the credential-entry contract of D2-05, and the stale §18 Phase 2 Create list as its documentation follow-up.
- Still outstanding and explicitly deferred: WINDOWS #5, #7 and #8 (Phase 15 consolidated Real-Chrome cycle; the Phase 19 release gate must fail while open) and the Manual-Only 400 px backstop row.

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*
