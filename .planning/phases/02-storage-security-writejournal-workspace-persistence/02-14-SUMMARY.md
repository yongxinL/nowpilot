---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 14
subsystem: testing
tags: [gap-closure, credential-boundary-gate, stale-claim-correction, windows-25, verify-phase-1, verify-phase-2, isolation-gate, phase-1-surface]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-13's corrected `verify:phase-2` gate and self-derived path preflight, and the phase-close record this plan corrects"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "the Phase-2 credential port (`src/services/ports/credentialStorePort.ts`) and the live `KeyVault → EncryptedStorage` edge the corrected gate approves"
provides:
  - "tests/isolation/credential-boundary.test.ts — the corrected cross-phase credential-boundary gate: scope-aware, comment-stripped, import-resolution predicate over `src/`, 8 negative + 5 positive controls, the real-tree assertion and the IN-05 regression pin; collected by both `verify:phase-1` and `verify:phase-2` through the `tests/isolation` directory token"
  - "tests/services/providerValidationFixtures.test.ts — the superseded Phase-1 'declarations only' substring case restated as the post-Phase-2 Phase-1-surface invariant, with comment stripping and a non-vacuity assertion"
  - "02-13-SUMMARY.md / 02-VALIDATION.md / .planning/STATE.md — the stale `verify:phase-1` green claims corrected; the historical observation is preserved and marked superseded, not erased"
  - ".planning/WINDOWS.md row 25 — the eight-field journal-retention contract recorded, row still `open`"
affects: [phase-03-cost-effective-ai-runtime, phase-19-release-gate]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 16353
  tasks: 3
  commits: 2
  plan_head_before: 435d5f9179a519f860a6e27023f62728aa2eb8f3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A boundary gate is a pure predicate plus controls: `credentialBoundaryViolations({ files })` is a total function over in-memory `{ path, source }` entries, so eight negative controls and five positive controls exercise the same code path the real-tree assertion uses — a gate whose red state was never observed is not evidence"
    - "Taint by re-export, computed to a fixpoint over the candidate set: any module that re-exports a tainted module joins the taint set, so a barrel (`src/services/index.ts`) cannot launder a boundary import; the exact-pair `APPROVED_VAULT_EDGES` allowlist is the documented extension point Phase 3's composition root must amend deliberately"
    - "Comment stripping is mandatory in every source scan (the repository's established idiom): the IN-05 defect was a comment-blind substring rule counting a doc comment as a call site"
    - "Stale verification claims are corrected by annotation, never by erasure: the original observation, its timestamp and its root-cause commit stay in the record next to an explicit superseded marker"

key-files:
  created:
    - tests/isolation/credential-boundary.test.ts
    - .planning/phases/02-storage-security-writejournal-workspace-persistence/02-14-SUMMARY.md
  modified:
    - tests/services/providerValidationFixtures.test.ts
    - .planning/phases/02-storage-security-writejournal-workspace-persistence/02-13-SUMMARY.md
    - .planning/phases/02-storage-security-writejournal-workspace-persistence/02-VALIDATION.md
    - .planning/STATE.md
    - .planning/WINDOWS.md

key-decisions:
  - "The gate lives in `tests/isolation/` rather than turning the Phase-1 fixture suite into a repo-wide gate: both phase scripts already enumerate that directory, so one file becomes the cross-phase instrument with zero gate-script churn (no `package.json` change)."
  - "The gate resolves module specifiers and computes a transitive taint set instead of matching names: a name check alone would be evaded by `import { X } from '../../services'`, which control (g) proves is now caught."
  - "`APPROVED_VAULT_EDGES` is an exact `[importer, imported]` pair, never a directory: the single entry is the live `KeyVault → EncryptedStorage` edge; nothing is approved to import `KeyVault` because Phase 2 deliberately has no production composition root (D2-01) — Phase 3's composition root must add its edge in the commit that wires it."
  - "`collectBoundaryModules` takes the candidate file set rather than a bare reader: the rule quantifies over every module ('every module that re-exports a tainted module'), so the candidates must be enumerable (deviation 1)."
  - "The Phase-1 case's premise was restated, not satisfied by rewording the KeyVault comment: the forbidden workaround list named that option explicitly, and the corrected case is scope-aware with comment stripping plus a non-vacuity assertion."
  - "WINDOWS #25 stays `open` with the eight-field retention contract; `compactJournal()` is not wired by this plan because no Phase 2 acceptance criterion requires production compaction and wiring it now would add an unowned lifecycle call."

patterns-established:
  - "Gate-with-teeth evidence: a new gate's failure mode is observed against the real tree (a temporary import; a misspelled constant) and recorded with its exit code and printed violation line next to the restored green run."
  - "Cross-phase claim correction: a falsified verification claim flips its coverage status to `fail`, gains a dated correction block naming the root-cause commit, and points at the plan that re-observed it."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "The corrected credential-boundary gate exists and enforces the real invariant over the live `src/` tree: prohibited scopes cannot reach the port, the vault or the codec; no `src/` file imports the port outside its declaration module; no `src/` file imports the vault modules outside the single approved edge; no persisted shape declares a credential-named field; no credential-named value enters a persistence call from a prohibited scope"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "npx vitest run tests/isolation/credential-boundary.test.ts → 18 passed (8 negative controls + 5 positive controls + 5 real-tree assertions); -t 'negative controls' → 8 passed; -t 'positive controls' → 5 passed; -t 'real src/ tree' → 5 passed"
        status: pass
      - kind: other
        ref: "real-tree red observations (reverted): temporary port import in src/components/onboarding/OnboardingFlow.tsx → exit 1 printing 'BOUNDARY_MODULE_IMPORT: src/components/onboarding/OnboardingFlow.tsx -> src/services/ports/credentialStorePort.ts'; misspelled PORT_MODULE → exit 1 printing 'GATE_TARGET_MISSING: src/services/ports/credentialStorePortt.ts'"
        status: pass
    human_judgment: false
  - id: D2
    description: "`pnpm run verify:phase-1` exits 0 from the evidence SHA with the corrected gate collected (15 declared paths resolve; 59 files / 886 tests passed), replacing the red 1 failed | 867 passed observation"
    requirement: "CORE-02"
    verification:
      - kind: other
        ref: "pnpm run verify:phase-1 → exit 0 · 'verify:phase-1: 15 declared path(s) resolve' · Test Files 59 passed (59) · Tests 886 passed (886) · verify-no-tailwind clean"
        status: pass
    human_judgment: false
  - id: D3
    description: "`pnpm run verify:phase-2` exits 0 from the same SHA after `pnpm run build:ext`, with the corrected gate collected (24 declared paths resolve; 29 files / 490 tests passed)"
    requirement: "CORE-02"
    verification:
      - kind: other
        ref: "pnpm run build:ext → exit 0 (manifest.json emitted) then pnpm run verify:phase-2 → exit 0 · 'verify:phase-2: 24 declared path(s) resolve' · Test Files 29 passed (29) · Tests 490 passed (490)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No planning document still claims the pre-correction `verify:phase-1` green result is current: `coverage.D2` flips to `fail`, the correction block names commit `18d206c6` and the `KeyVault.ts:33` doc comment, the 02-13 map row's status cell is red, and `nyquist_compliant` went honestly false before the fresh runs restored it"
    requirement: "CORE-02"
    verification:
      - kind: other
        ref: "correction check (D2-scoped) over 02-13-SUMMARY.md / 02-VALIDATION.md / STATE.md / WINDOWS.md → '4 files corrected, row 25 open with the 8 required fields'"
        status: pass
    human_judgment: false
  - id: D5
    description: "WINDOWS #25 stays `open` and records the eight-field retention contract (implemented-but-unwired status, owning plan, activation condition, retention threshold, crash-safety, replay-safety, tests required before activation, Phase 19 release-gate treatment); no counter changes and no other row is touched"
    requirement: "CORE-02"
    verification:
      - kind: other
        ref: "WINDOWS.md row-25 assertions (row still open; all eight field markers present; JSON mirror valid; open_count 18 / waived_count 0 / fixed_count 7 / total_count 25 unchanged)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The human-verification residuals are recorded, not waived: the two 400 px UI backstops stay deferred to the Phase 15 consolidated Real-Chrome cycle, and the CR-01 / CR-02 operator acknowledgements remain pending this plan's final blocking-human checkpoint (nothing is acknowledged by default)"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A product-risk acknowledgement is an operator judgement, not a test result. The checkpoint's disposition has not been given at the time of this SUMMARY; a verifier must confirm the `## Operator acknowledgement (CR-01 / CR-02)` section records the operator's verbatim answer (or that the plan is still paused at that checkpoint), that no automatic-waiver language appears, and that the two 400 px backstops are still deferred to Phase 15."

duration: 18 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 14: The Credential-Boundary Gate and the Honest Phase Record

**The Phase-1 substring rule that broke `verify:phase-1` is replaced by a scope-aware credential-boundary gate (`tests/isolation/credential-boundary.test.ts`, 18 cases: 8 negative + 5 positive controls + the real-tree assertion) that both phase gates collect — observed red on a real onboarding import (exit 1) and on a misspelled canonical path (exit 1), then green — and both gates were re-run from one code state at evidence SHA `23db27a3` (`verify:phase-1` exit 0 · 59 files / 886 tests; `verify:phase-2` exit 0 · 29 files / 490 tests) while the stale `verify:phase-1` claims in `02-13-SUMMARY.md`, `02-VALIDATION.md` and `STATE.md` were marked superseded and WINDOWS #25 stayed `open` with its eight-field retention contract.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-24T05:51:28Z
- **Completed:** 2026-09-24T06:09:19Z
- **Tasks:** 3 of 4 (Task 4 is the blocking-human checkpoint, returned for the operator's disposition)
- **Files modified:** 6 (2 test files + 4 planning records; the SUMMARY is the 7th)

## Completion result

1. **The corrected invariant.** No Phase-1 presentation, onboarding, fixture or content-script module reaches `CredentialStorePort`, `KeyVault` or `EncryptedStorage`; no `src/` file other than the canonical declaration module (`src/services/ports/credentialStorePort.ts`) imports the port; no `src/` file imports the vault modules outside the single approved edge (`src/core/security/KeyVault.ts → src/core/security/EncryptedStorage.ts`); no persisted-shape module declares a credential-named field; and no credential-named value is passed into a persistence call (`setItem`, `writeWorkspaceState`, `runJournaled`, `writeConversationWithMessages`, `persist`) from a prohibited scope. The gate resolves module specifiers (`./`, `@/`, `~/`) and computes a transitive taint set over re-exporting barrels, so a name check cannot be evaded — control (g) proves it.
2. **Files changed.** The list of files changed: `tests/isolation/credential-boundary.test.ts` (new, 721 lines); `tests/services/providerValidationFixtures.test.ts` (the superseded case restated); `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-13-SUMMARY.md`, `02-VALIDATION.md`, `.planning/STATE.md` (stale claims corrected); `.planning/WINDOWS.md` (row 25 enriched). No `src/` path changed — `git log 6629ef65..HEAD -- src/` and `git log 435d5f91..HEAD -- src/` both print nothing.
3. **Negative-control evidence.** The negative-control evidence is permanent: all eight are self-tests asserted to contain the named code and path: (a) presentation → port import → `PORT_IMPORT_OUTSIDE_DECLARATION`; (b) presentation → `KeyVault` → `BOUNDARY_MODULE_IMPORT`; (c) onboarding `writeWorkspaceState(state, apiKey)` → `CREDENTIAL_INTO_PERSISTENCE`; (d) `WorkspaceState` declaring `apiKey` → `CREDENTIAL_FIELD_IN_PERSISTED_SHAPE`; (e) unapproved application module → `KeyVault` → `BOUNDARY_MODULE_IMPORT`; (f) missing `PORT_MODULE` → `GATE_TARGET_MISSING`; (g) barrel re-export evasion → caught through the taint set; (h) unresolved project specifier in a prohibited scope → `UNRESOLVED_PROJECT_SPECIFIER`. Controls (a) and (f) were **additionally observed red against the real tree**, then reverted: (a) a temporary type-only port import added to `src/components/onboarding/OnboardingFlow.tsx` → `npx vitest run tests/isolation/credential-boundary.test.ts` **exit 1**, 4 failed | 14 passed, printing `BOUNDARY_MODULE_IMPORT: src/components/onboarding/OnboardingFlow.tsx -> src/services/ports/credentialStorePort.ts`; revert verified (`git status --porcelain` empty, file byte-identical), restored run 18 passed. (f) `PORT_MODULE` temporarily pointed at `credentialStorePortt.ts` → **exit 1**, 6 failed | 12 passed, printing `GATE_TARGET_MISSING: src/services/ports/credentialStorePortt.ts`; constant restored byte-identical, restored run 18 passed. Only vitest was run while the temporary import existed (it would not pass `tsc --noEmit`); the revert was verified before any typecheck.
4. **The fresh Phase 1 result.** `pnpm run verify:phase-1` → **exit 0** · `verify:phase-1: 15 declared path(s) resolve` · Test Files 59 passed (59) · Tests 886 passed (886) · `verify-no-tailwind: 0 Tailwind utility strings in src`. (The pre-correction red run was 1 failed | 57 passed files, 1 failed | 867 passed tests; the corrected gate adds 1 file and 18 tests.)
5. **The fresh Phase 2 result.** `pnpm run build:ext` → exit 0 (manifest emitted) then `pnpm run verify:phase-2` → **exit 0** · `verify:phase-2: 24 declared path(s) resolve` · Test Files 29 passed (29) · Tests 490 passed (490). No source or test edit occurred between step 3 and step 4.
6. **The evidence SHA.** `23db27a3cd2512c32f14962496b20bd52dacc7fa` — `git rev-parse HEAD` was identical immediately after step 4 and after step 5. The cumulative repository command `pnpm run verify:all` also exited 0 (61 files / 933 tests). `git diff --check` printed nothing. `git status --porcelain` showed no modified `src/` or `tests/` path (only untracked planning files). `grep -c 'CredentialStorePort' src/core/security/KeyVault.ts` returns **1** — the doc comment was not trimmed to satisfy a gate.
7. **Stale claims corrected.** The stale claims corrected by this plan: `02-13-SUMMARY.md` `coverage.D2` is now `status: fail` with the supersession recorded and a correction block after the H1; `02-VALIDATION.md`'s blockquote, 02-13 map row (status cell red) and Approval line carry the correction, and `nyquist_compliant` went honestly `false` (Task 2) before the fresh runs restored it to `true` (Task 3); `.planning/STATE.md`'s `stopped_at` (frontmatter and body) carries the corrected text. Every `verify:phase-1` line in the three files either carries a superseded marker, describes the fresh re-run, or makes no green claim.
8. **WINDOWS #25 status.** Still `open` — never production-active, fixed or waived. It now records all eight required fields: implemented-but-unwired, the future journal-retention plan as owner (02-14 explicitly does not wire it), the activation condition (an owned production lifecycle point, not a UI affordance), the retention threshold (`JOURNAL_TERMINAL_ENTRY_LIMIT` = 50 terminal entries, newest retained; non-terminal entries always retained), the crash-safety requirement (non-terminal entries survive; compaction must be interruptible because `recoverJournal` replays them), the replay-safety requirement (a compacted terminal entry is never needed for a consistent state), the tests required before activation (call-site, boundary retention, interrupted-compaction restart), and the Phase 19 release-gate treatment. Frontmatter counters unchanged (18 / 0 / 7 / 25).
9. **Human-verification residuals.** The human-verification residuals: the two 400 px UI backstops (02-VERIFICATION.md human items 1 and 2) remain **deferred to the Phase 15 consolidated Real-Chrome cycle** and are not claimed closed. The CR-01 metadata-hold trade and the CR-02 mirror-persists-on-promotion reading (human items 3 and 4) remain **pending this plan's final blocking-human checkpoint** — the operator has not answered yet at SUMMARY time, so no acknowledgement is recorded, nothing is waived, and no `acknowledged by default` language appears anywhere.
10. **The gap-closure commit SHA.** Task 1 `e94a0508` (test: the gate + the restated case) and Task 2 `23db27a3` (docs: the stale claims + WINDOWS #25). The plan-metadata commit (this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates) follows this document. Execution-start HEAD (ledger base) `435d5f91`; plan-authoring baseline was `6629ef65`.
11. **Clean-tree status.** The clean-tree status: working tree clean apart from the untracked planning artifacts (`.gsd/`, `.planning/milestone.lock`, `02-VERIFICATION.md` — the verifier's own record, deliberately left byte-unchanged and owned by re-verification); `git diff --check` clean; no `src/` path in either gap-closure commit.
12. **Final status verdict: `READY FOR PHASE 2 ACCEPTANCE`** — both phase gates exited 0 from the same SHA and every negative control passed. The alternatives were not chosen: `CORRECT` (would apply if only the records were fixed without re-observing both gates) and `BLOCKED` (would apply if either gate failed) do not describe this result. Phase 2 acceptance still carries the two open product-risk residuals pending the operator's checkpoint answer, which is why this plan does not proceed to Phase 3.

## Gate evidence

| Step | Command | Observed |
|---|---|---|
| 1 | `npx vitest run tests/isolation/credential-boundary.test.ts tests/services/providerValidationFixtures.test.ts` | exit 0 — 2 files / 36 tests passed |
| 2 | `npx vitest run tests/isolation/credential-boundary.test.ts -t 'negative controls'` | exit 0 — **8 passed** \| 10 skipped (the filter matched; a zero-case run would have been treated as failure) |
| 3 | `pnpm run verify:phase-1` | exit 0 — `verify:phase-1: 15 declared path(s) resolve`; Test Files 59 passed (59); Tests 886 passed (886); tailwind gate clean |
| 4a | `pnpm run build:ext` | exit 0 — `.output/chrome-mv3/manifest.json` emitted (727 ms) |
| 4b | `pnpm run verify:phase-2` | exit 0 — `verify:phase-2: 24 declared path(s) resolve`; Test Files 29 passed (29); Tests 490 passed (490) |
| 5 | `pnpm run verify:all` | exit 0 — `tsc --noEmit` clean; Test Files 61 passed (61); Tests 933 passed (933); `pnpm run lint` (`tsc --noEmit`) clean |
| 6 | `git diff --check` | no output |
| 7 | `git rev-parse HEAD` after steps 4 and 5 | identical — `23db27a3cd2512c32f14962496b20bd52dacc7fa`; `git status --porcelain` shows no modified `src/` or `tests/` path |
| 8 | `grep -c 'CredentialStorePort' src/core/security/KeyVault.ts` | `1` — the IN-05 doc comment is intact |
| 9 | `git log --oneline 6629ef65..HEAD -- src/` and `git log --oneline 435d5f91..HEAD -- src/` | both empty — no production change landed |

## Verification inputs for re-verification

- **Evidence SHA:** `23db27a3cd2512c32f14962496b20bd52dacc7fa` (branch `aurora`; `git rev-parse HEAD` at the moment both gates were observed).
- **Re-derive the gate:** `npx vitest run tests/isolation/credential-boundary.test.ts` → 18 passed; `-t 'negative controls'` → 8; `-t 'positive controls'` → 5; `-t 'real src/ tree'` → 5.
- **Re-derive Phase 1:** `pnpm run verify:phase-1` → exit 0 · 15 declared paths · 59 files / 886 tests.
- **Re-derive Phase 2:** `pnpm run build:ext && pnpm run verify:phase-2` → exit 0 · 24 declared paths · 29 files / 490 tests.
- **Re-derive the cumulative run:** `pnpm run verify:all` → exit 0 · 61 files / 933 tests.
- **Re-derive the record correction:** the D2-scoped correction check over the four planning files (see D4); WINDOWS row 25 open with the eight field markers; `grep -c 'CredentialStorePort' src/core/security/KeyVault.ts` = 1.
- **Deliberately unchanged:** `02-VERIFICATION.md` is the verifier's historical record of 2026-09-24T14:40Z and is owned by re-verification — this plan left it byte-unchanged, and the correction lives in this SUMMARY and in `02-VALIDATION.md`'s sign-off.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the substring rule with the credential-boundary gate, and correct the Phase-1 case it supersedes** — `e94a0508` (test)
2. **Task 2: Correct the stale verification claims and record the WINDOWS #25 retention contract** — `23db27a3` (docs)
3. **Task 3: Re-run both phase gates from one code state and write the gap-closure SUMMARY** — committed with this SUMMARY (docs)
4. **Task 4: Operator disposition of the CR-01 / CR-02 residuals** — **not executed**; the blocking-human checkpoint is returned to the operator

**Plan metadata:** the final `docs(02-14)` commit (this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates)

## Files Created/Modified

- `tests/isolation/credential-boundary.test.ts` — the corrected cross-phase gate: exported `stripComments`, `moduleSpecifiers`, `reExportSpecifiers`, `resolveSpecifier`, `callArguments`, `collectBoundaryModules`, `credentialBoundaryViolations`, the seven `VIOLATION` codes and the constants (`PORT_MODULE`, `KEY_VAULT_MODULE`, `ENCRYPTED_STORAGE_MODULE`, `BOUNDARY_SEEDS`, `PROHIBITED_SCOPES`, `APPROVED_VAULT_EDGES`, `PERSISTED_SHAPE_MODULES`, `FORBIDDEN_FIELD_NAMES`); two describes (the predicate self-test with named control groups; the real `src/` tree).
- `tests/services/providerValidationFixtures.test.ts` — header property 5 restated; `PHASE_1_CREDENTIAL_SURFACES` + a local `stripComments` added; the describe renamed to `typed ports — the credential port stays out of the Phase-1 surface` and the failing case replaced with `declares CredentialStorePort in its canonical module and imports it from no Phase-1 surface` (canonical-path existence, comment-stripped scan of the four Phase-1 surfaces, non-vacuity, provenance comment). No other case touched.
- `02-13-SUMMARY.md` — `coverage.D2` status `fail` with the supersession in `description`/`ref`; a dated correction block after the H1; the stale bullet and gate-evidence row marked superseded.
- `02-VALIDATION.md` — `nyquist_compliant` false → (after the fresh runs) true with the fresh observation in the frontmatter comment; the phase-close blockquote and Approval line corrected; the 02-13 map row red with the superseding observation; a new 02-14 row; the sign-off checklist item restored.
- `.planning/STATE.md` — `stopped_at` corrected in the frontmatter and the `## Session Continuity` body; no other key, metric row or decision bullet changed.
- `.planning/WINDOWS.md` — row 25 description enriched with the retention contract (table row and JSON mirror); `last_updated` bumped; counters unchanged; no other row touched.

## Decisions Made

- **The gate is one file in the retained `tests/isolation` directory.** Both phase scripts already carry the directory token, so the cross-phase instrument required no `package.json` change — verified by running both gates, not by assuming it.
- **Import resolution plus a re-export taint set, never a name check.** Control (g) is the proof: a barrel that re-exports the port is itself tainted, so a component importing the barrel is flagged.
- **The allowlist is an exact pair.** `APPROVED_VAULT_EDGES` holds exactly `[KeyVault.ts, EncryptedStorage.ts]`; the gate documents that Phase 3's composition root must add its edge deliberately, and Task 3's re-run is what proves the widened set still holds the invariant.
- **The Phase-1 case was restated, not silenced.** The plan's forbidden-workaround list explicitly ruled out trimming the `KeyVault.ts` comment; the corrected case asserts the scope-aware invariant and keeps the provenance (commit `18d206c6`, the doc comment, the comment-blind rule) with a pointer to the new gate.
- **WINDOWS #25 is record-only.** `compactJournal()` stays unwired; the row carries the full activation contract so the owning plan inherits it intact, and it is never marked production-active, fixed or waived.
- **The corrected check is D2-scoped (deviation 2).** The plan's literal `CORRECTION-CHECK` command tests `/status:\s*pass/` over everything after `coverage:`, which includes D1's and D3's legitimate `pass` statuses; the corrected check scopes the assertion to the D2 entry. The plan's intent — "D2 no longer says pass" — is what is verified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `collectBoundaryModules` takes the candidate file set, not a bare `read` function**

- **Found during:** Task 1 (control (g), the barrel-evasion case)
- **Issue:** The plan's stated signature `collectBoundaryModules(read)` cannot express the rule it names. "Every module that re-exports a tainted module" quantifies over *all* candidate modules, so the implementation must enumerate them — a `(path) => string | null` reader has no universe to scan. The first implementation (following the seeds' own re-exports forward) silently failed to taint a barrel that re-exports a seed, and control (g) caught it red.
- **Fix:** `collectBoundaryModules(files)` takes the input `{ path, source }` set and computes the taint set to a fixpoint: any file whose re-export resolves into the tainted set joins it, repeated until stable (so a barrel of a barrel is caught too). The predicate calls it with `input.files`. The exported name is unchanged; only the parameter shape differs.
- **Files modified:** `tests/isolation/credential-boundary.test.ts`
- **Verification:** control (g) now asserts `BOUNDARY_MODULE_IMPORT: src/components/common/Widget.tsx -> src/services/index.ts`; the full suite is 18 passed; both phase gates green from one SHA.
- **Committed in:** `e94a0508` (Task 1 commit)

**2. [Rule 1 - Bug] The plan's literal `CORRECTION-CHECK` command over-matches; the check was D2-scoped**

- **Found during:** Task 2 (running the task's `<verify>` command)
- **Issue:** The command tests `/status:\s*pass/` over `t.split('coverage:')[1]` — everything after the coverage block's opening key, which includes D1's and D3's legitimate `status: pass` entries. It therefore reports `D2 still pass` even when D2 is `fail`; the check as written cannot pass while the other, still-true entries keep their statuses.
- **Fix:** Ran the check with the D2 assertion scoped to the D2 entry (`t.split('- id: D2')[1].split('- id: D3')[0]`), keeping every other condition identical, and additionally asserted D2 is `fail` and points at `02-14-SUMMARY.md`. Result: `correction check (D2 scoped): 4 files corrected, row 25 open with the 8 required fields`. The literal command's other conditions all pass.
- **Files modified:** none (instrument correction only; the four planning files are unchanged by this fix)
- **Verification:** the D2-scoped check exits 0; `grep -n 'verify:phase-1'` over the three files returns only marked or non-claiming lines.
- **Committed in:** `23db27a3` (Task 2 commit)

**3. [Rule 1 - Bug] Two unenumerated stale/incorrect lines surfaced by the plan's own verify command**

- **Found during:** Task 2
- **Issue:** (a) `02-VALIDATION.md`'s sign-off checklist still read ``- [x] `nyquist_compliant: true` set in frontmatter`` after the flag was set `false` — a false statement, and the plan's `<fails_when>` names `nyquist still true` as a failure mode. (b) The 02-13 headline and the phase-close blockquote asserted the green result on their own lines, which the plan's textual grep assertion ("only lines that carry a superseded marker or describe the fresh re-run") would flag.
- **Fix:** (a) The checklist item was set `false`-pending in Task 2 and restored to `- [x] `nyquist_compliant: true` set in frontmatter` in Task 3 once the fresh runs earned it. (b) A short `**(superseded 2026-09-24 — …)**` marker was appended to the headline and the blockquote sentence, keeping the original text intact; Task 3 then restored `nyquist_compliant: true`.
- **Files modified:** `02-VALIDATION.md`, `02-13-SUMMARY.md`
- **Verification:** the correction check passes; `grep -n 'verify:phase-1'` over the three files returns only marked, fresh-run-describing, or non-claiming lines; `02-VALIDATION.md` ends with `nyquist_compliant: true` and the checklist item ticked.
- **Committed in:** `23db27a3` (Task 2 commit) and the Task 3 commit

**4. [Rule 1 - Bug] `PERSISTED_SHAPE_MODULES` initially pointed the store module at `store/useExtensionStore.ts`**

- **Found during:** Task 1 (first gate run)
- **Issue:** The constant was written as `join(process.cwd(), 'store', 'useExtensionStore.ts')` while the module lives at `src/store/useExtensionStore.ts`, so the real-tree assertion reported `GATE_TARGET_MISSING: store/useExtensionStore.ts` — the gate correctly failed on its own misspelling.
- **Fix:** Corrected to `join(SRC_ROOT, 'store', 'useExtensionStore.ts')` in both the constant and the fixture builder.
- **Files modified:** `tests/isolation/credential-boundary.test.ts`
- **Verification:** the real-tree assertions pass; the eight negative controls still fire.
- **Committed in:** `e94a0508` (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking signature correction, 3 instrument/record bugs) — none weakened a production boundary, none changed a `src/` file, and none added scope.
**Impact on plan:** All four were necessary for the gate to be correct or for the plan's own checks to be satisfiable; the credential invariant, the allowlist and the record corrections are exactly as the plan specifies.

**Note (bookkeeping, not a deviation):** the plan's scope fence says `.planning/ROADMAP.md` must not be modified, and the workflow also mandates `roadmap update-plan-progress 02` at plan close. That verb's only deltas are flipping the `02-14-PLAN.md` completion checkbox, the plans-count line (`14/14 plans executed + 1 gap-closure plan (02-14)`) and the progress table row (`14/14`, status `In Progress`); no plan entry was reworded, removed or added. The phase remains `In Progress` — re-verification and the operator checkpoint are still outstanding.

## Issues Encountered

- `npx vitest run … | grep` masks the vitest exit code (grep's status wins), so both red observations were re-run with output redirected to a file and `$?` captured directly before recording `exit 1`. Recorded here so the SUMMARY's exit codes are the real ones.
- The two red observations were taken while the working tree was temporarily dirty by design; both were reverted before any typecheck (`git status --porcelain` empty, restored file byte-identical to a backup) and the restored runs were green before the task commit.

## Known Stubs

None — this plan ships no source code, adds no placeholder, and wires nothing (WINDOWS #25 stays `open` by decision).

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or trust-boundary surface is introduced. The plan's changed files are two test files and planning records; `src/` is byte-unchanged.

## Self-Check: PASSED

- Files exist: `tests/isolation/credential-boundary.test.ts`, `tests/services/providerValidationFixtures.test.ts` (both committed in `e94a0508`); the four corrected planning records (committed in `23db27a3`); `02-14-SUMMARY.md` (committed in `1ec8062c`, metadata commit `5aef2dd5`).
- Commits exist: `e94a0508`, `23db27a3`, `1ec8062c`, `5aef2dd5` — all on `aurora`; no `src/` path in any of them.

## Next Phase Readiness

- The corrected gate is the cross-phase acceptance instrument and is green from one code state with both phase gates collected; `/gsd-verify-work` can re-derive every number from the evidence SHA `23db27a3`.
- Phase 3 inherits the gate's documented extension point: its composition root must add its `KeyVault` edge to `APPROVED_VAULT_EDGES` deliberately, in the commit that wires it — otherwise `verify:phase-1` and `verify:phase-2` will both fail on the new import.
- **Paused at the blocking-human checkpoint (Task 4):** the operator's disposition of CR-01 (metadata-hold trade, medium) and CR-02 (mirror-persists-on-promotion reading, low) is required before the plan's `## Operator acknowledgement (CR-01 / CR-02)` section can be written. Nothing is waived by default. The two 400 px backstops remain deferred to the Phase 15 consolidated Real-Chrome cycle; WINDOWS #5, #7, #8 and #25 all stay `open`. Do not proceed to Phase 3, do not run `/gsd-ship`, do not push.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*
