---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 12
subsystem: testing
tags: [onboarding, two-surface, d2-32, d2-33, d2-35, windows-8, writer-gate, presentation-counting, sentinel-absence, fixture-validation, keyvault-boundary, traceability, wave-7]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: "the shared onboarding store (`readOnboardingState` / `writeOnboardingState` / `subscribeToOnboardingState` / `migrateOnboardingState` / `shouldPresentOnboarding`), the shared `OnboardingFlow` with its fixture validation port and in-memory credential handling, and the surface gate split (`useOnboardingGate`)"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-11's shared harness (`createTwoSurfaceHarness`, `createLoopbackTransport`, the clock seam, `restartSurface`, `flush`, `dispose`) and Suite A"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-07's writer-gated presentation predicate (`shouldPresentOnboardingForWriter`) and the six-state writer vocabulary"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-10's startup wiring (the surface adapters Suite B mirrors), the fixture-disclosed capability statement and the pinned notice configuration"
provides:
  - "tests/integration/onboardingTwoSurface.integration.test.ts — Suite B: 22 D2-32 clause-named cases + the traceability case + the D2-33 vault-boundary case (24 cases), the per-surface presentation controller that mirrors `useOnboardingGate`, and the seven-surface sentinel scan"
  - "02-VALIDATION.md — the D2-35 clause-to-evidence mapping tables for WINDOW #5 and #8, the filled Per-Task Verification Map with observed results, and the completed Wave 0 checklist"
  - ".planning/STATE.md § Verification Deferrals — the dated Phase 2 automated-coverage outcome notes on the WINDOW #5 and #8 rows (both stay deferred)"
affects: [02-13, phase-15-workspace-experience, phase-19-release-gate]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 18726
  tasks: 2
  commits: 2
  plan_head_before: 0fff4994db49450368dd8486df12d77300b44e6c

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The per-surface presentation controller is the harness-side mirror of `useOnboardingGate`: it reads the record through the real store, subscribes through the real change-event path, and resolves its gate with the real predicate against that surface's own writer projection. A React hook cannot be mounted per simulated document in one realm (the harness deliberately keeps the module-level zustand singleton out of the two-surface model), and it re-implements no coordination — the decision is `shouldPresentOnboardingForWriter`"
    - "Presentations are counted, not inferred: each controller increments on the transition into `present`, so the suite asserts 'exactly one flow was presented' across both surfaces rather than only that completion propagated (Pitfall 10). The 'would it fail?' control is the same case asserting both surfaces read the identical incomplete record and that the record alone presents on either"
    - "The real `OnboardingFlow` is driven under the harness clock with `fireEvent` + `await act(async () => {})` and never with RTL async helpers — fake timers freeze `setTimeout` and `Date`, so `findBy*`/`waitFor` cannot advance. Step 2 resumes the provider selection through the flow's real `readOnboardingState` adapter, which avoids an rc-select dropdown interaction and is itself a production path"
    - "Absence asserted with the surface named: one `exposedSurfaces()` helper returns seven named surfaces (both workspace projections, the bus, the journal, both storage areas, the log ring buffer, the error records with evidence) and every secret-absence case runs the full scan, plus the positive controls (the sentinel still in the field, a planted occurrence the probe finds, real identities in the scanned projections)"
    - "The vault boundary is a separate describe: the real `createCredentialStorePort` over the real `createKeyVault` with an authorised test adapter (a `StorageAreaLike` over the harness map plus a synthetic install secret), so a synthetic credential round-trips there and nowhere near the flow"

key-files:
  created:
    - tests/integration/onboardingTwoSurface.integration.test.ts
  modified:
    - .planning/phases/02-storage-security-writejournal-workspace-persistence/02-VALIDATION.md
    - .planning/STATE.md

key-decisions:
  - "The presentation controller mirrors the hook instead of rendering two hook instances: two React probes would share the one module-level `useWorkspaceStore`, so the writer gate would be identical for both surfaces and the two-document distinction would vanish. The controller takes the surface's own projection, exactly as the harness's per-surface projection models two documents."
  - "The flow drive resumes the provider selection from the incomplete record (`readOnboardingState` adapter) rather than opening the rc-select: under the harness's fake timers an async dropdown interaction is the one non-deterministic step, and the resume path is a real production behaviour (the post-skip record keeps the selected provider)."
  - "`status` in `02-VALIDATION.md` stays `draft` with the observed state recorded in a frontmatter comment: the file's own lifecycle (draft → validated, set by validate-phase §6) reserves `validated` for the phase-verification step, and the D2-28 gate row is still pending (02-13 owns the rewrite). `wave_0_complete: true` is set and `nyquist_compliant` stays false because not every row is green."
  - "The runtime-envelope half of the bus clause is asserted with the real `validateEnvelope`: an envelope whose payload carries the sentinel as an unexpected field is rejected by the strict per-type schema, and the onboarding path publishes zero envelopes at all."
  - "The traceability tables cite verbatim case names and the record states the coverage outcome without over-claiming: Phase 2 automated contract coverage = PASS, Phase 15 Real-Chrome acceptance = still deferred, Phase 19 release gate must fail while the observations remain open. WINDOWS #5 and #8 stay `open`; `.planning/WINDOWS.md` is untouched."

patterns-established:
  - "One harness, two independent suites, one traceability record: Suite B imports the same `tests/harness/twoSurface.ts` Suite A uses, and both suites' case names are the join keys of the D2-35 mapping (the traceability case proves each cited name literally exists)."
  - "A clause-named case per clause with the clause text in the name (`D2-32.<n> <clause> — <assertion>`), no apostrophes in titles, so the mechanical title extraction stays exact."
  - "The two-surface secret-absence scan: seven named surfaces, the full set per case, positive controls in every scan."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "Suite B covers all 22 D2-32 clauses as one named case each over the shared harness, with the real onboarding store, the real writer-gated predicate and the real `OnboardingFlow`; the traceability case reads the suite's own source and proves exactly one named case per clause with every clause-map row citing a name that exists"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx vitest run tests/integration/onboardingTwoSurface.integration.test.ts (24 passed) and npx vitest run tests/integration (2 files / 47 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The D2-35 traceability record exists for both deferred windows: WINDOW #5 clause → handoff integration test name → production contract → CORE-02 → evidence, and the same shape for WINDOW #8; `02-VALIDATION.md`'s Per-Task Verification Map carries the owning plan/task/wave and the observed result per row, the Wave 0 checklist is ticked with evidence, and `STATE.md`'s WINDOW #5/#8 rows carry the dated automated-coverage PASS note"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "the plan's Task 2 automated assertion (both suite paths + CORE-02 present in `02-VALIDATION.md` and `STATE.md`) → 'traceability recorded in validation and state'; all 45 cited case names verified to exist in the two suites; `git diff` names no change to `.planning/WINDOWS.md`"
        status: pass
    human_judgment: false
  - id: D3
    description: "The API-key value provably stays local to the originating presentation controller: a synthetic sentinel typed into the real flow's credential field is asserted absent from all seven exposed surfaces (both workspace projections, the broadcast bus, the journal, both storage areas, the log ring buffer, the error records) in every secret-absence case, including a real error record written with the sentinel under a sensitive field name"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "tests/integration/onboardingTwoSurface.integration.test.ts — 'D2-32.15 … the sentinel stays in the field and crosses no boundary' through 'D2-32.20 … the ring buffer and a real redacted error record stay clean'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The credential boundary is exercised only through an authorised test adapter: the real port over a real KeyVault round-trips a synthetic credential (store → retrieve → delete) and the persisted envelope is ciphertext with no plaintext sentinel anywhere, while the onboarding flow stores no credential key at all"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "tests/integration/onboardingTwoSurface.integration.test.ts — 'credential boundary — a synthetic credential round-trips through the real port over a KeyVault-backed adapter and nowhere else'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Plan verification gate: `tsc --noEmit` clean, the new suite green alone and in the integration directory, the full repository suite green with no regression (57 files / 882 tests, was 56 / 858), and the plan's two task verifies green"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit (clean) && npx vitest run tests/integration/onboardingTwoSurface.integration.test.ts (24 passed) && npx vitest run tests/integration (47 passed) && npx vitest run (57 files / 882 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "WINDOWS #8 and #5 stay `open` with the deferral intact: the record states Phase 2 automated contract coverage = PASS, Phase 15 Real-Chrome acceptance = still deferred, and the Phase 19 release gate must fail while the human observation remains open; no window is marked fixed or waived"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A deferral is an operator judgement, not a test result. A verifier should confirm `.planning/WINDOWS.md` is unmodified (ids 5 and 8 still `open`), that `STATE.md`'s two rows carry the outcome note without changing the deferred status, and that neither suite claims observed Real-Chrome behaviour."
  - id: D7
    description: "Cross-plan contract: 02-13's corrected gate must enumerate both integration suites (`workspaceHandoff.integration.test.ts` and `onboardingTwoSurface.integration.test.ts`) with the self-derived path preflight and keep `tests/harness/twoSurface.ts` out of the collected paths"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A consumer contract cannot be asserted from this plan's own artifacts. A verifier should read `package.json`'s `verify:phase-2` after 02-13 and confirm both suite paths are named and the preflight fails on a misspelled path."

duration: 26 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 12: Suite B, the WINDOWS #8 Onboarding Contract and the D2-35 Traceability Summary

**The deferred WINDOWS #8 onboarding contract now has deterministic automated coverage: 22 clause-named cases drive the real onboarding store, the real writer-gated presentation predicate and the real `OnboardingFlow` across two simulated documents over the shared harness — counting presentations so "exactly one flow" fails if both surfaces present — while a seven-surface sentinel scan proves the API key stays in the field and the D2-35 mapping records both windows as automated-covered but still open.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-24T02:29:00Z
- **Completed:** 2026-09-24T02:56:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **One harness, two suites, no second coordination layer.** Suite B imports `tests/harness/twoSurface.ts` (02-11) and composes the real `readOnboardingState` / `subscribeToOnboardingState` / `writeOnboardingState` / `migrateOnboardingState`, the real `shouldPresentOnboardingForWriter`, the real `OnboardingFlow` and the real fixture validation port. The per-surface presentation controller mirrors `useOnboardingGate` — read, subscription, predicate against that surface's own writer projection — because two React hook instances would share the one module-level store and collapse the two-document distinction.
- **"Exactly one flow presented" is counted, not inferred.** Every controller increments on the transition into `present`; the clause-3 case asserts both surfaces read the identical incomplete record, that the record alone would present on either, and that the count across both surfaces is exactly one (Pitfall 10). The clause-4 case tracks the maximum concurrent presentations across a real writer takeover and proves a fresh mirror resolves `hidden` immediately, never `reading`.
- **The real flow is driven end to end under the harness clock.** Pre-seed the post-skip record (incomplete, provider selected), walk 1 → 2 → 3, type the synthetic sentinel into the credential field, fixture-validate, finish — with `fireEvent` + `act` and no RTL async helpers, because fake timers freeze `setTimeout` and `Date`. The completion lands as the canonical six-field record; the skip writes the explicit incomplete state that re-presents on the next open; the duplicate write is byte-identical.
- **Every secret-absence clause scans all seven surfaces.** One `exposedSurfaces()` helper returns both workspace projections, the broadcast bus, the journal, both storage areas, the log ring buffer and the error records; every case runs the full scan with positive controls (the sentinel still in the field, a planted occurrence the probe finds, real identities in the scanned projections). Clause 20 writes a real error record with the sentinel under a sensitive field name and proves the stored record is redacted.
- **The vault boundary is separate and real.** The D2-33 case builds the real port over the real `KeyVault` with an authorised test adapter (a `StorageAreaLike` over the harness map, a synthetic install secret) and proves store → retrieve → delete round-trips the sentinel while the persisted envelope is ciphertext only. The onboarding flow itself stores no credential key and its only port exposes `validate`.
- **The D2-35 record is mechanical.** `02-VALIDATION.md` now carries the two 22-row mapping tables (clause → verbatim case name → production contract module/symbol → CORE-02 → evidence), the Per-Task Verification Map with the owning plan/task/wave and the observed result per row, and the completed Wave 0 checklist. All 45 cited case names were verified to exist in the two suites; `.planning/WINDOWS.md` is untouched and both windows stay `open`.
- **No regression.** `tsc --noEmit` clean; Suite B alone 24 passed; the integration directory 47 passed; the full suite 57 files / 882 tests (was 56 / 858).

## Task Commits

Each task was committed atomically:

1. **Task 1: Suite B — the WINDOWS #8 onboarding contract, one named test per clause** — `8d34b67d` (test)
2. **Task 2: D2-35 traceability records for WINDOW #5 and #8** — `7dfe6b3f` (docs)

**Plan metadata:** see the final `docs(02-12)` commit below

## Files Created/Modified

- `tests/integration/onboardingTwoSurface.integration.test.ts` — the clause map (22 rows), the `createSurfacePresentation` controller, the `mountFlow` / `advanceToCredentialStep` / `completeFromCredentialStep` drivers, the seven-surface `exposedSurfaces()` scan with `expectSentinelAbsentEverywhere()`, the `createVaultOverHarnessStorage()` authorised adapter, the 22 clause cases, the traceability case and the D2-33 vault-boundary case.
- `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-VALIDATION.md` — the two D2-35 mapping tables, the filled Per-Task Verification Map (owning plan/task/wave + observed results), the Wave 0 checklist with evidence, `wave_0_complete: true`, and the frontmatter note recording why `status` stays `draft`.
- `.planning/STATE.md` — the dated outcome rows on the WINDOW #5 and #8 tables: automated coverage PASS with both suite paths, Phase 15 still deferred, Phase 19 must fail while open, both windows deferred.

## Decisions Made

- **The controller mirrors the hook rather than mounting two probes.** Two hook instances would read the one module-level `useWorkspaceStore`, so the writer gate would be identical on both surfaces; the harness models two documents with per-surface projections, and the controller consumes that projection. The decision itself is the real predicate.
- **The drive resumes the provider selection instead of opening the rc-select.** Under the harness's fake timers, an async dropdown interaction is the one non-deterministic step; the resume path (`readOnboardingState` → `setProviderId`) is real production behaviour and keeps the drive deterministic.
- **The clause-4 takeover demotes before it counts.** `harness.standalone.elect()` then `harness.sidepanel.assertStillPrimary()` then one refresh: the superseded surface learns on its own authority check (exactly the production heartbeat path), so the concurrency measure is taken at render points rather than mid-transition.
- **The bus clause adds a real-validator probe.** Zero envelopes are published by the whole onboarding path, and the real `validateEnvelope` rejects an envelope whose payload carries the sentinel as an unexpected field — the channel fails closed on the key.
- **`status` stays `draft` in `02-VALIDATION.md`.** The file's own lifecycle reserves `validated` for validate-phase §6, and the D2-28 gate row is still pending; the observed state is recorded in a frontmatter comment instead of an over-claiming status value.
- **The traceability evidence cites the phase summaries.** Every row's evidence cell names the suite's run result as recorded in `02-11-SUMMARY.md` (coverage D2/D3) or this plan's summary, so the Phase 19 release gate can follow each row to its observation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The record had to be written through `chrome.storage.local.set`, not the raw map**

- **Found during:** Task 1 (the schema-version case failed: the gate stayed `present` after a v1 record was stored)
- **Issue:** `harness.storage.local()` returns the Map *backing* the mock; writing to it directly fires no `onChanged` event, so the controller's subscription never refreshed and the case passed for the wrong reason (the record stayed `unknown`).
- **Fix:** the case writes through `chrome.storage.local.set(...)`, which is the production write path and fires the dispatcher.
- **Files modified:** `tests/integration/onboardingTwoSurface.integration.test.ts`
- **Verification:** the case now observes `unknown + incompatible` → `present` for the future record and `ok + complete` → `hidden` for the upgraded v1 record.
- **Committed in:** `8d34b67d` (Task 1)

**2. [Rule 1 - Bug] The concurrency count peaked at two mid-takeover**

- **Found during:** Task 1 (clause 4 asserted `maxConcurrentPresentations === 1` and read 2)
- **Issue:** `elect(standalone)` refreshed both gates before the superseded Side Panel had learned it was demoted, so both surfaces momentarily rendered `present`.
- **Fix:** the takeover elects raw, then the superseded surface runs its real `assertStillPrimary()` (which demotes its projection), then both gates refresh once.
- **Files modified:** `tests/integration/onboardingTwoSurface.integration.test.ts`
- **Verification:** clause 4 green with the maximum at one and the demoted surface `hidden`.
- **Committed in:** `8d34b67d` (Task 1)

**3. [Rule 1 - Bug] Two harness-shape assumptions in the new cases**

- **Found during:** Task 1 (clause 16 could not find the credential field; clause 20 asserted `length` on a result object)
- **Issue:** (a) clause 16 mounted the flow without the seeded resumed record, so step 2's Continue stayed disabled; (b) `harness.db.listErrors()` returns `{ ok, records }`, not an array.
- **Fix:** clause 16 seeds the post-skip record like every other driving case; clause 20 unwraps the result.
- **Files modified:** `tests/integration/onboardingTwoSurface.integration.test.ts`
- **Verification:** all 24 cases green.
- **Committed in:** `8d34b67d` (Task 1)

---

**Total deviations:** 3 auto-fixed (3 Rule 1, all in the plan's own new test file; 0 production files touched)
**Impact on plan:** No scope creep. Every auto-fix was a defect in the new suite found by running it, and each fix moved the suite closer to the production path (the change event, the authority check, the real store API).

## Issues Encountered

- **RTL async helpers cannot run under the harness clock.** `vi.useFakeTimers` freezes `setTimeout` and `Date`, so `findBy*`/`waitFor` cannot advance and would hang; the suite drives with `fireEvent` + `await act(async () => {})` and `flush()` instead, and avoids the rc-select dropdown entirely (see Decisions).
- **`window.getComputedStyle` not-implemented noise** comes from AntD's modal scroll locker under jsdom — pre-existing and unrelated (noted in 02-10's summary); the suite is green.
- Pre-existing untracked planning artifacts (`.gsd/`, `.planning/milestone.lock`) were left untouched — outside this plan's scope.

## Known Stubs

None. Both artifacts are exercised by the runs recorded above: the suite by its own 24-case run (alone and in the integration directory), and the traceability record by the plan's Task 2 assertion plus the mechanical check that all 45 cited case names exist. No placeholder values, no TODO/FIXME markers, no skipped or todo tests, and no unrun `<verify>`.

## Threat Flags

None — the plan's two artifacts are a test file and planning records. No production module, endpoint, permission, storage key or trust boundary is introduced. The plan's register is closed by the suite: T-02-63 (API-key disclosure — the seven-surface sentinel scan with positive controls, and the vault boundary exercised only through the direct authorised adapter), T-02-64 (competing onboarding controller — presentation gated on authoritative writer state with presentations counted across both surfaces), T-02-65 (false readiness — the fixture-backed record, the four-way distinction case and the no-request case), T-02-66 (inaccurate traceability — the mapping cites verbatim case names, all 45 verified to exist, and both windows stay open), T-02-67 (duplicate completion — the byte-identical record and the absent second presentation), T-02-SC (no install in this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-13** owns the corrected `verify:phase-2`: it must enumerate `tests/integration/workspaceHandoff.integration.test.ts` **and** `tests/integration/onboardingTwoSurface.integration.test.ts` with the self-derived path preflight, keep `tests/harness/twoSurface.ts` out of the collected paths, and replace the stale script that still names the absent `tests/core/utils` (recorded in the map as the phase's only pending row).
- **WINDOW #5 and #8 stay `open`.** The automated coverage is recorded as PASS in both the traceability tables and `STATE.md`; Phase 15 owns the Real-Chrome observation and Phase 19 must fail while any deferred verification remains open. `.planning/WINDOWS.md` is unchanged.
- **Phase 3** swaps the onboarding validation port for the real one; the suite's fixture assertions (`validationBacking: 'fixture'`, no credential key, no request) are the Phase 2 side of that boundary and will need re-pointing when the port changes.
- **Phase 15** inherits the deferred observations plus the 400 px backstops (WINDOWS #7 and the 02-10 coverage D7 row).

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- Both plan artifacts exist on disk: `tests/integration/onboardingTwoSurface.integration.test.ts`, and the two modified planning records.
- Both plan commits exist in history: `8d34b67d` (Task 1), `7dfe6b3f` (Task 2).
- Measured commit count at SUMMARY write time (`git rev-list --count 0fff4994..HEAD`): 2, base recorded as `plan_head_before`.
- `npx tsc --noEmit` clean; Suite B alone 24 passed; the integration directory 2 files / 47 passed; the full suite 57 files / 882 tests.
- The plan's Task 2 verify is green (`traceability recorded in validation and state`); all 45 cited case names exist in the two suites; `git diff` names no change to `.planning/WINDOWS.md`.
