---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 07
subsystem: ui
tags: [workspace, writer-state, writer-election, mirror-banner, i18n, onboarding, single-controller, d2-32, d-12-carry-forward, wave-4]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-06's `ElectionOutcome` / `WorkspaceCoordinationState` / `coordinationState()` — the two authoritative shapes this plan projects onto the frozen writer vocabulary"
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: "the frozen writer vocabulary (`WorkspaceWriterState` / `WORKSPACE_WRITER_STATES` / `isMirrorState`), the canonical string map with `t()`/`format()`, the `np_onboarding` completion record and `useOnboardingGate`"
provides:
  - "src/core/workspace/WorkspaceStore.ts — `writerState`, `writerEpoch`, `primarySurface`, `WriterProjection`, `WriterElectionSignal`, `createInitialWriterProjection()`, `projectWriterSignal()`, `applyElectionOutcome()`, `isAuthoritativeWriter()`; removes `PHASE1_WRITER_STATE` and `isPrimaryWriter()`"
  - "src/components/common/MirrorBanner.tsx — canonical-copy rendering (`workspace.mirroringNotice` / `workspace.mirrorRefocus` / `workspace.mirrorRefocusA11y`), `minHeight: 32` bar, keyboard-reachable action"
  - "src/core/i18n/strings.ts — the nine Phase-2 keys: `workspace.mirroringNotice`, `workspace.mirrorRefocus`, `workspace.mirrorRefocusA11y`, `workspace.electionFailed`, `storage.hydrationFailed`, `storage.degraded`, `storage.migrationFailed`, `storage.credentialCapability`, `common.retry`"
  - "src/core/onboarding/onboardingStateStore.ts — `shouldPresentOnboardingForWriter()`; src/core/onboarding/useOnboardingGate.ts — the writer-state-aware gate"
  - "tests/core/workspace/WorkspaceStore.test.ts (27), tests/components/MirrorBanner.test.tsx (9), tests/core/onboarding/onboardingStateStore.test.ts (24), tests/core/i18n/strings.test.ts (17)"
affects: [02-09, 02-10, 02-11, 02-12, 02-13, phase-15-workspace-experience]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 10269
  tasks: 3
  commits: 4
  plan_head_before: 9f45e147401d8220192c7c9c177d3e932ab56470

tech-stack:
  added: []
  patterns:
    - "One pure projection per vocabulary: `projectWriterSignal(signal, previous)` maps both authoritative shapes onto the six frozen writer states, and the store action is a three-line `set` that applies it — the mapping is testable without a store and the store cannot invent a seventh state"
    - "An error is not evidence of a demotion: a failed read or a lost CAS resolves `writer-unavailable` while **keeping** the last recorded epoch and primary surface, so an error can never erase a promotion the election never acknowledged"
    - "Type-only vocabulary imports across module boundaries: the store imports 02-06's outcome types and the onboarding store imports the writer-state type with `import type`, so neither gains the other's runtime graph (no zustand/immer in the background worker's bundle)"
    - "A single predicate decides one controller: `shouldPresentOnboardingForWriter(result, writerState)` is pure and total, and the hook is a thin reader of it plus the store's `writerState` — `'hidden'` for a non-writer is resolved before the record read, never after it"
    - "Canonical copy with no inline literal: the banner's caption, visible label and accessible name all resolve through `t()`, and the suite scans the component source (comments stripped) for the retired literals and for `window.location.reload`"
    - "A growing status bar: `minHeight` (never a fixed `height`) is what lets the canonical sentence wrap at 400 px instead of clipping"

key-files:
  created: []
  modified:
    - src/core/workspace/WorkspaceStore.ts
    - src/components/common/MirrorBanner.tsx
    - src/core/i18n/strings.ts
    - src/core/onboarding/onboardingStateStore.ts
    - src/core/onboarding/useOnboardingGate.ts
    - src/entrypoints/background.ts
    - tests/core/workspace/WorkspaceStore.test.ts
    - tests/core/workspace/WorkspaceRouter.test.ts
    - tests/components/MirrorBanner.test.tsx
    - tests/core/i18n/strings.test.ts
    - tests/core/onboarding/onboardingStateStore.test.ts

key-decisions:
  - "`applyElectionOutcome` accepts `WriterElectionSignal = ElectionOutcome | WorkspaceCoordinationState`. The plan names the parameter `ElectionOutcome` but also mandates the mapping rows `solo → primary` and `election-in-progress → election-pending`, which exist only on the §20.11 coordination projection (and 02-06's handoff names `coordinationState()`); the outcome carries the epoch the projection does not, so both shapes are accepted and discriminated structurally (`'state' in signal`)."
  - "A `secondary` that is not mirroring projects to `election-pending`, not `mirror`: the plan's row is 'secondary **with mirroring** → mirror', and the frozen vocabulary has no state for a secondary that has settled into no role. 02-06 always emits `isMirroring: true`, so this arm is the honest fallback, never a claim."
  - "The writer projection is a separate axis from the canonical `WorkspaceState`: it is not part of `WorkspaceState`, adds no persist middleware and no storage key, and never bumps `version`/`updatedAt` — a coordination change is not a workspace write, and the recorded epoch is the election's `electedAt`, never a local clock."
  - "`isAuthoritativeWriter()` is a store method (the no-arg replacement for the removed `isPrimaryWriter()`) reading `get().writerState === 'primary'`; `shouldPresentOnboardingForWriter` compares `'primary'` inline instead of importing it, because a value import would give the onboarding store a runtime dependency on zustand/immer."
  - "`useOnboardingGate` resolves `hidden` for a non-writer **before** the record read, so a mirror never waits on a competing flow (T-02-40) and the three-value gate vocabulary is unchanged; `reading` is claimed only by the authoritative writer while its record read is in flight."
  - "The banner's action is a real control (`role=\"button\"`, `tabIndex={0}`, Enter/Space) rather than an `<a>` without `href`: the 02-UI-SPEC interaction contract requires it to be keyboard-reachable, and the shipped `<a>` was not focusable. The visual treatment is unchanged and no optimistic state change was added."
  - "The nine Phase-2 keys are pinned in `tests/core/i18n/strings.test.ts`'s canonical table rather than only in the component suite — that suite is the designated home for pinned *values*, and pinning there is what makes the plan's 'all nine keys resolve to the pinned sentences' assertion real."

patterns-established:
  - "A pre-election default that claims nothing: `election-pending` is the store's initial writer state, so no code path can report writability without an applied election outcome (T-02-36) — the suite asserts no default reports `primary`."
  - "Two vocabularies, one projection: 02-06's `ElectionOutcome` and §20.11's `WorkspaceCoordinationState` both land on the frozen six, and a source scan proves no Phase-1 writability shortcut survives anywhere in `src/`."
  - "A gate that is honest about its own limits: `storage.*` copy states the problem **and** the local outcome and names no record, id, code or storage key — and the string suite asserts no forbidden success claim exists in any value."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "The Phase-1 writer adapter is gone and the store reports authoritative election state in the frozen vocabulary: `election-pending` by default, every canonical coordination outcome and both election-outcome shapes mapped onto exactly one of the six states, the epoch and primary surface recorded, `isAuthoritativeWriter()` true only for `primary`, and no seventh state or Phase-1 shortcut anywhere in `src/`"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceStore.test.ts (27 passed — incl. 'maps every canonical coordination outcome onto exactly one frozen state', 'reports authority for `primary` only, across the whole frozen vocabulary' and 'leaves no Phase-1 writability shortcut anywhere in src/')"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/core/workspace (6 files / 148 tests, incl. the Phase-1 WorkspaceRouter suite)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`MirrorBanner` renders canonical copy only — the retired `Switched to Standalone.` caption and `...primary chat mode` aria-label are gone, the caption/label/accessible name resolve through `t()`, the bar is `min-height: 32px` with no fixed height, the status role and polite live region remain, and the action is a keyboard-reachable control that never reloads the page"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/components/MirrorBanner.test.tsx (9 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The nine Phase-2 canonical keys resolve to their pinned sentences verbatim, are explicitly present in the map (none resolves to its own name), reuse `shell.errorReload` rather than a second reload key, and no value carries a forbidden success claim or a credential shape"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/i18n/strings.test.ts (17 passed — 'pins the Phase-2 canonical map verbatim' plus the pre-existing exactness, hygiene and credential-shape gates)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Exactly one onboarding controller: `shouldPresentOnboardingForWriter` is pure and total over five read outcomes x six writer states, only the authoritative writer can present, every mirror-side state hides whatever the record says, the writer-state import is type-only, and the shared hook gates on the same predicate plus the store's `writerState`"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/onboarding/onboardingStateStore.test.ts (24 passed — the truth table, the type-only import scan and the hook wiring scan)"
        status: pass
      - kind: integration
        ref: "tests/components/OnboardingFlow.test.tsx (21 passed, unmodified) — the Phase-1 flow behaviour is intact"
        status: pass
    human_judgment: false
  - id: D5
    description: "Plan verification gate: `tsc --noEmit` clean, the full suite green, and the Phase-1 no-Tailwind gate still clean after the new string literals"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit (clean) && npx vitest run (54 files / 790 tests) && bash scripts/verify-no-tailwind.sh (0 Tailwind utility strings in src)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cross-plan contract: 02-09 mounts `MirrorBanner` from `writerState === 'mirror'` and 02-10 applies the election to the store — **until 02-10 wires it, no surface reports `primary`, so onboarding presents nowhere and the banner never renders**; 02-11/02-12 drive both surfaces on the shared harness"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A cross-plan consumer contract cannot be asserted from this plan's suites. A verifier should confirm 02-09's shells read `writerState` (never an event or a shell-local flag), that 02-10's startup sequence actually calls `applyElectionOutcome(election.coordinationState())` on each election/heartbeat (the composition point this plan deliberately does not own), and that 02-12's Suite B asserts one controller across two surfaces instead of re-deriving the predicate."
  - id: D7
    description: "The 400 px MirrorBanner backstop: the bar grows rather than clipping, the caption wraps to at most two lines, and the action never wraps or clips"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/components/MirrorBanner.test.tsx — 'grows instead of clipping: min-height 32px and no fixed height' (the mechanism only)"
        status: pass
    human_judgment: true
    rationale: "The mechanism (`min-height` present, no fixed `height`) is asserted, but the visual behaviour at a 400 px Side Panel width cannot be observed in jsdom. The 02-UI-SPEC marks this row as a backstop and Phase 15's consolidated Real-Chrome acceptance cycle owns the observation (the same deferral family as WINDOWS #7)."

duration: 15 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 07: Election-Backed Writer State, the Mirror Banner and One Onboarding Controller Summary

**The Phase-1 writability adapter is gone — the workspace store now reports authoritative election state in the frozen six-state vocabulary from an applied `ElectionOutcome`/coordination projection (defaulting to `election-pending`), `MirrorBanner` renders the canonical `workspace.mirroringNotice` copy on a growable bar with a keyboard-reachable action, the nine Phase-2 canonical keys are pinned verbatim, and exactly one surface can present onboarding because presentation is gated on the authoritative writer state.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-24T00:37:45Z
- **Completed:** 2026-09-24T00:52:08Z
- **Tasks:** 3
- **Files modified:** 11 (0 created)

## Accomplishments

- **Authority is now a projection, not an assertion.** `PHASE1_WRITER_STATE` and `isPrimaryWriter()` are deleted; the store carries `writerState` / `writerEpoch` / `primarySurface` and the only way to reach `primary` is `applyElectionOutcome(...)` with an authoritative signal. The default is `election-pending`, so nothing can render a mirroring decision — or claim writability — before an election resolves (T-02-36).
- **One pure mapping, two authoritative shapes.** `projectWriterSignal()` takes 02-06's `ElectionOutcome` **or** §20.11's `WorkspaceCoordinationState` and returns one of the six frozen states: `solo`/`primary` → `primary`, `secondary` (mirroring) → `mirror`, `election-in-progress` → `election-pending`, `error` → `writer-unavailable` **keeping** the last epoch and surface. `handoff-pending`/`handoff-failed` are provably unreachable from an election signal — the suite asserts the reachable set is exactly four states.
- **The banner is now a reporter, not a decoration.** `MirrorBanner` renders canonical copy only: the retired `Switched to Standalone.` caption and the `...primary chat mode` aria-label are gone from the component and from the suite's source scan, the visible label and accessible name resolve through `t()`, and the bar is `min-height: 32px` with no fixed `height` so the canonical sentence wraps at 400 px instead of clipping. The action became a real control (`role="button"`, `tabIndex={0}`, Enter/Space) — the shipped `<a>` without `href` was not focusable, which the interaction contract requires.
- **Every Phase-2 string the later plans need is in the map, verbatim.** Nine keys land in `strings.ts` with no paraphrase and no second reload key (`shell.errorReload` is reused; `onboarding.retry` stays onboarding-scoped). The canonical-map suite pins all nine and asserts no forbidden success claim (`Credential stored`, `Provider connected`, `Provider validated`, `Provider ready`, `migrated successfully`, `history restored`) exists in **any** value.
- **One controller across two surfaces is now testable.** `shouldPresentOnboardingForWriter(result, writerState)` is pure and total over five read outcomes × six writer states: only `primary` presents, every mirror-side state hides whatever the record says (T-02-38). `useOnboardingGate` reads `writerState` from the store and resolves `hidden` — never `reading` — for a non-writer, so a mirror never waits on, and never shows, a competing flow (T-02-40). The writer-state import is `import type`, so the onboarding store keeps no runtime dependency on zustand/immer (the background worker imports it).
- **No regression.** `tsc --noEmit` clean; the full suite at 54 files / 790 tests; the Phase-1 no-Tailwind gate clean at 0 utility strings.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the Phase-1 writer adapter with election-backed writer state** — `39edf9ad` (feat)
2. **Task 2: `MirrorBanner` canonical copy + the canonical string-map additions** — `f8c17c3d` (feat)
3. **Task 3: One onboarding controller — presentation gated on authoritative writer state** — `eb01ec48` (feat)
4. **Follow-up: the writer-gated hook's `'hidden'` literal vs the Phase-1 no-Tailwind gate** — `7f500d68` (fix)

**Plan metadata:** see the final `docs(02-07)` commit below

## Files Created/Modified

- `src/core/workspace/WorkspaceStore.ts` — the writer projection: `WriterElectionSignal`, `WriterProjection`, `createInitialWriterProjection()`, `projectWriterSignal()`, `applyElectionOutcome()`, `isAuthoritativeWriter()`; `PHASE1_WRITER_STATE`/`isPrimaryWriter()` removed; `reset()` restores the pre-election projection.
- `src/components/common/MirrorBanner.tsx` — `t()`-resolved caption/label/accessible name, `minHeight: 32`, the keyboard-reachable action, and a doc block that states the single activation condition.
- `src/core/i18n/strings.ts` — the nine Phase-2 keys, grouped with the comment that records which are canonical `STR` values, which promote shipped literals and which key is deliberately reused.
- `src/core/onboarding/onboardingStateStore.ts` — `shouldPresentOnboardingForWriter()` plus the type-only writer-state import.
- `src/core/onboarding/useOnboardingGate.ts` — the writer-state-aware gate (one ternary for the non-writer case, so `'hidden'` sits in the no-Tailwind gate's exempt value context).
- `src/entrypoints/background.ts` — the stale Phase-1 election TODO became the truthful surface-owned boundary note (comment only).
- `tests/core/workspace/WorkspaceStore.test.ts` — 27 cases: the projection truth table, both signal families, the epoch/surface recording, the error-keeps-authority rule, the four-state reachable set, the authority truth table and the no-Phase-1-shortcut source scan.
- `tests/core/workspace/WorkspaceRouter.test.ts` — the failed-handoff case now asserts no fabricated demotion (`writerState === 'election-pending'`) instead of the removed adapter.
- `tests/components/MirrorBanner.test.tsx` — 9 cases: canonical copy, the retired literals' absence (render + source), the visual contract, the growable bar, the keyboard path and the no-extra-text rule.
- `tests/core/i18n/strings.test.ts` — 17 cases: the nine Phase-2 keys pinned in the canonical table plus the forbidden-claim scan.
- `tests/core/onboarding/onboardingStateStore.test.ts` — 24 cases: the truth table, the type-only import scan and the hook wiring scan (all Phase-1 cases unchanged).

## Decisions Made

- **`applyElectionOutcome` accepts both authoritative shapes.** The plan names the parameter `ElectionOutcome`, but the mapping it mandates (`solo → primary`, `election-in-progress → election-pending`) exists only on §20.11's `WorkspaceCoordinationState`, and 02-06's handoff names `coordinationState()`. The outcome carries the epoch the projection does not, so `WriterElectionSignal = ElectionOutcome | WorkspaceCoordinationState` is discriminated structurally (`'state' in signal`) — every mandated row is satisfied and neither shape has to be re-derived from the other.
- **A non-mirroring `secondary` projects to `election-pending`.** The plan's row is "secondary **with mirroring** → `mirror`"; the frozen vocabulary has no state for a secondary that has settled into no role, and claiming `mirror` there would be a claim the election has not made. 02-06 always emits `isMirroring: true`, so this arm is a total fallback, not a live path.
- **The writer axis is not workspace state.** `writerState`/`writerEpoch`/`primarySurface` stay outside `WorkspaceState`, add no persist middleware and no storage key, and never bump `version`/`updatedAt`: a coordination change is not a workspace write, and the recorded epoch is the election's `electedAt` (never `Date.now()`).
- **`isAuthoritativeWriter()` is a store method; the predicate compares `'primary'` inline.** A no-arg method is the direct replacement for the removed `isPrimaryWriter()`, while the onboarding store must not import it as a value — a runtime import would drag zustand/immer into a module the background worker loads.
- **The hook resolves `hidden` before the record read.** A non-writer claims nothing at all — not even `reading` — so the three-value vocabulary survives and the mirror never waits on a competing flow. The record read and the storage subscription are unchanged.
- **The banner action is a button, not a link.** It performs an action rather than navigating; the shipped `<a>` without `href` was neither focusable nor announced as a control, and the 02-UI-SPEC interaction contract requires a keyboard-reachable real control. Visual treatment is untouched.
- **The nine keys are pinned in the canonical-map suite.** `tests/core/i18n/strings.test.ts` is the designated home for pinned *values*; pinning there is what turns the plan's "all nine keys resolve to the pinned sentences" into an assertion (see Deviations 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `WorkspaceRouter.test.ts` imported the removed `isPrimaryWriter`**
- **Found during:** Task 1 (`tsc --noEmit`)
- **Issue:** `tests/core/workspace/WorkspaceRouter.test.ts` imported `isPrimaryWriter` from the store and asserted `isPrimaryWriter()).toBe(true)` in the failed-handoff case ("leaves the Side Panel writable"). Removing the export made the whole file fail to collect — a suite outside this plan's `files_modified`.
- **Fix:** the import is gone and the case now asserts the honest equivalent — a failed handoff writes no writer state, so the projection stays at its pre-election default (`writerState === 'election-pending'`) and never becomes `mirror`. The case's intent (no fabricated demotion, no success claim) is preserved exactly.
- **Files modified:** `tests/core/workspace/WorkspaceRouter.test.ts` (import + 4 lines of assertion)
- **Verification:** `npx vitest run tests/core/workspace` → 6 files / 148 tests green; `npx tsc --noEmit` clean.
- **Committed in:** `39edf9ad` (Task 1)

**2. [Rule 2 - Missing critical] `background.ts` named the symbol this plan deletes**
- **Found during:** Task 1 (the new no-Phase-1-shortcut source scan)
- **Issue:** `src/entrypoints/background.ts`'s "later-phase TODOs" comment listed `WorkspaceStore.isPrimaryWriter() election (CAS + heartbeat)`. After the removal the note named a symbol that no longer exists, and the plan's own verification requires that "no module in `src/` references the removed Phase-1 writer adapter".
- **Fix:** the entry became the truthful boundary statement — the writer election is surface-owned and is deliberately never registered in the worker (§13, 02-10's explicit instruction). Comment only; no behaviour change.
- **Files modified:** `src/entrypoints/background.ts` (2 comment lines)
- **Verification:** the source scan in `tests/core/workspace/WorkspaceStore.test.ts` (`leaves no Phase-1 writability shortcut anywhere in src/`) passes.
- **Committed in:** `39edf9ad` (Task 1)

**3. [Rule 3 - Blocking] The plan's own acceptance criterion needed a pinning site outside `files_modified`**
- **Found during:** Task 2 (writing the string-map additions)
- **Issue:** the acceptance criterion "All nine keys resolve to the pinned sentences" has no home in the plan's declared files — `MirrorBanner.test.tsx` only renders two of the nine, and the `storage.*` keys belong to 02-10's notice path. The canonical-map suite (`tests/core/i18n/strings.test.ts`) is the designated place where pinned *values* live, and it is not in `files_modified`.
- **Fix:** the nine keys were added to that suite's canonical table, with a dedicated case that pins them verbatim, asserts none resolves to its own name, asserts `shell.errorReload` is reused rather than duplicated, and asserts no forbidden success claim exists in any value.
- **Files modified:** `tests/core/i18n/strings.test.ts` (9 table rows + 1 case)
- **Verification:** `npx vitest run tests/core/i18n/strings.test.ts` → 17 passed.
- **Committed in:** `f8c17c3d` (Task 2)

**4. [Rule 2 - Missing critical / accessibility] The banner action was not keyboard-reachable**
- **Found during:** Task 2 (the plan's `read_first` names the 02-UI-SPEC interaction contract, which requires "a real control ... keyboard-reachable")
- **Issue:** `Typography.Link` renders `<a>` with no `href` when none is passed, so the shipped action was not in the tab order and carried no control role — a user could not reach it by keyboard, and 02-09's suite asserts reachability.
- **Fix:** the action keeps its markup and visual treatment and gains `role="button"`, `tabIndex={0}` and an Enter/Space handler (`preventDefault` on Space so the surface never scrolls). No optimistic state change was added — the handler only calls `onRefocus`.
- **Files modified:** `src/components/common/MirrorBanner.tsx`
- **Verification:** `tests/components/MirrorBanner.test.tsx` — 'makes the action a real keyboard-reachable control' (role, `tabindex`, focus, Enter and Space each call back once) plus the untouched click/no-reload cases.
- **Committed in:** `f8c17c3d` (Task 2)

**5. [Rule 3 - Blocking] The writer-gated hook's `'hidden'` literal failed the Phase-1 no-Tailwind gate**
- **Found during:** the plan-level verification (`bash scripts/verify-no-tailwind.sh`)
- **Issue:** the new early `return 'hidden';` put a bare keyword literal outside any value context, which `scripts/verify-no-tailwind.sh` reports (`src/core/onboarding/useOnboardingGate.ts:51:'hidden'`). The gate is appended to `verify:phase-1`, so it is a live gate; it was **not** part of Task 3's declared `<verify>`, which is why it surfaced only at plan level.
- **Fix:** the decision is now one ternary whose literal sits in the exempt `? … : 'hidden'` context — `writerState === 'primary' ? 'reading' : 'hidden'` — with behaviour unchanged (a non-writer still resolves `hidden`, never `reading`). The suite asserts that exact clause so the shape cannot silently drift back.
- **Files modified:** `src/core/onboarding/useOnboardingGate.ts`, `tests/core/onboarding/onboardingStateStore.test.ts`
- **Verification:** `bash scripts/verify-no-tailwind.sh` → `0 Tailwind utility strings in src`; `npx tsc --noEmit` clean; the onboarding suite at 24 passed.
- **Committed in:** `7f500d68` (its own `fix` commit, because the finding came from a gate outside Task 3's verification)

### Plan-text resolutions

**A. `applyElectionOutcome`'s parameter type.** The plan writes `outcome: ElectionOutcome` but mandates mapping rows (`solo`, `election-in-progress`) that exist only on `WorkspaceCoordinationState`, and 02-06's handoff names `coordinationState()` as the input. Resolved by accepting both (`WriterElectionSignal`) rather than dropping two mandated rows or inventing a parallel union. See Decisions Made.

---

**Total deviations:** 5 auto-fixed (3 blocking, 2 missing-critical) + 1 plan-text resolution
**Impact on plan:** No scope creep and no production behaviour outside the plan's intent. Deviations 1–2 were forced by the removal the plan mandates (a stale import and a stale comment); deviation 3 was needed to make the plan's own acceptance criterion assertable; deviation 4 delivers a UI-SPEC clause the plan's `read_first` names but its `<action>` omits (and which 02-09 would otherwise have had to add from outside its file scope); deviation 5 repairs a Phase-1 gate failure found at plan level.

## Issues Encountered

- **The Phase-1 workspace-key source guard rejected a doc-comment mention.** `tests/core/workspace/WorkspaceStore.test.ts` scans every `.ts`/`.tsx` under `src/` for `np_workspace` and allows only a quoted canonical constant or a `legacy` line. The new store doc block named the key literal in prose and tripped it. The comment was reworded (no guard loosening — 02-06 had already loosened it once, and loosening it again would blunt the gate).
- **The no-Tailwind gate's value-context rule is per occurrence, not per line.** The first writer-gated hook shape looked correct to a reader but the gate reads the *match text*: a bare `'hidden'` must be preceded by a comparison operator, a union bar, a ternary `?`, a colon or a value-context name. This is why the final shape is a ternary rather than an early return; the constraint is now recorded in the code comment and pinned by the suite.
- **Two `isPrimaryWriter`-era source scans had to be reconciled, not deleted.** The store suite's key guard and the new Phase-1-shortcut scan both read `src/` line-by-line; neither strips comments, which is what forced deviation 2 (the background comment) rather than a scan exemption.

## Known Stubs

None. Every module this plan touches is wired into the path its suite exercises: the projection is driven through the store action, the banner's copy resolves through the real map, and the onboarding predicate is consumed by the real hook (asserted by a source scan). No placeholder values, no TODO/FIXME markers, no skipped tests and no unrun verification.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-interactive-control | `src/components/common/MirrorBanner.tsx` | The banner's action is now a real focusable control (`role="button"`, `tabIndex={0}`, Enter/Space) instead of a non-focusable `<a>`. It performs no I/O, calls only the parent's `onRefocus`, and adds no new trust boundary — but it is the first keyboard-reachable control this component exposes, and 02-09's refocus wiring is the path that must stay non-optimistic. |

The plan's register is otherwise closed by this plan's suites: T-02-36 (no default authority — asserted), T-02-37 (banner activation is a pure function of writer state — the mount is 02-09's, the state contract is asserted here), T-02-38 (competing flows — the predicate's truth table is asserted for every state), T-02-39 (copy leakage — no value interpolates an id, code, key or body, and no forbidden claim exists), T-02-40 (gate stuck reading — a non-writer resolves `hidden` immediately), T-02-SC (no install in this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-09** mounts `<MirrorBanner onRefocus={…} />` in both shells under `writerState === 'mirror'`. The state contract it consumes is final: the banner renders for exactly one writer state, the action carries `workspace.mirrorRefocusA11y`, and it is keyboard-reachable. Nothing in the shell may hold a shell-local mirror flag.
- **02-10 owns the composition point and must not skip it.** With the writer gate live, `writerState` stays `election-pending` until something applies an election signal — so **until 02-10's startup sequence calls `applyElectionOutcome(...)` on each election/heartbeat, no surface reports `primary`, onboarding presents nowhere, and the banner never renders.** The natural wiring is `applyElectionOutcome(election.coordinationState())` after `elect()` (and inside the heartbeat), which also carries the surface identity the epoch-bearing outcome lacks. This is recorded as coverage entry D6 for the verifier.
- **02-11** composes the real `WorkspaceStore` projection in the two-surface harness; **02-12**'s Suite B asserts the WINDOWS #8 single-controller clause against `shouldPresentOnboardingForWriter` + the hook rather than re-deriving the predicate.
- **Phase 15** inherits the 400 px banner backstop observation (coverage entry D7) and the final copy/visual treatment of the banner, which Phase 2 deliberately did not touch.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 11 modified files exist on disk; no file was created by this plan.
- All 4 plan commits exist in history: `39edf9ad` (Task 1), `f8c17c3d` (Task 2), `eb01ec48` (Task 3), `7f500d68` (gate fix).
- Measured commit count at SUMMARY write time (`git rev-list --count 9f45e147..HEAD`): 4, base recorded as `plan_head_before`.
