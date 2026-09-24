---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 09
subsystem: ui
tags: [sidepanel, standalone, hydration-states, d2-18, mirror-banner, d-12, d2-34, writer-election, refocus, non-optimistic, antd-skeleton, wave-5]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-08's `hydrationStatus` / `HydrationError` / `retryHydration()` — the six frozen states and the store's own retry action this plan renders"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-07's `writerState` on `useWorkspaceStore` and `MirrorBanner` with its canonical copy and keyboard-reachable action"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-06's `createWriterElection` / `ElectionOutcome` / `WorkspaceElectionErrorCode` — the promotion path a refocus request delegates to"
provides:
  - "src/components/sidepanel/SidePanelShell.tsx — hydration-status-driven conversation region (`conversationRegionContent`) and the `MirrorBanner` mount for `writerState === 'mirror'`"
  - "src/components/standalone/StandaloneShell.tsx — `MirrorBanner` mount above the routed content"
  - "src/core/workspace/WriterElection.ts — `ElectionFailureCode`, `setActiveWriterElection()`, `isWriterElectionRegistered()`, `subscribeToElectionFailure()`, `requestRefocus()`"
  - "tests/components/SidePanelShell.test.tsx (27), tests/components/StandaloneShell.test.tsx (22)"
affects: [02-10, 02-11, 02-12, 02-13, phase-15-workspace-experience]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 9770
  tasks: 2
  commits: 2
  plan_head_before: 4f712f0ebc42b975a160a189eab148327c92c8cb

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A status-driven region as a pure function: `conversationRegionContent(status, retry)` is one total switch over the frozen six-state union, so the shell cannot invent a treatment and the only input is the store's status"
    - "The registry holds a reference, not authority: the module-level pointer and the failure channel carry no writer state — authority stays a verified read-back in `elect()` plus a store projection the surface renders"
    - "Non-optimistic by construction: the banner's mount is `writerState === 'mirror'` and the click only *asks*; the click cannot change what is rendered, so neither success nor failure can be faked"
    - "Absence proven with a positive control: every activation table row is asserted, so 'no banner for five states' is always paired with 'exactly one for `mirror`'"
    - "Redaction asserted from the source of truth: the store holds a typed `hydrationError` code while the surface renders the pinned sentence only — the test asserts the code is present in the store and absent from the DOM"

key-files:
  created: []
  modified:
    - src/components/sidepanel/SidePanelShell.tsx
    - src/components/standalone/StandaloneShell.tsx
    - src/core/workspace/WriterElection.ts
    - tests/components/SidePanelShell.test.tsx
    - tests/components/StandaloneShell.test.tsx

key-decisions:
  - "The typed hydration error is never read by the shell. The plan's Task 1 says to read `hydrationStatus` 'and the typed error state', but T-02-49 forbids rendering any code, and `failed`/`recovery required` already select the treatment — so a read would exist only to be discarded. The suite supplies a real code (`IDB_MIGRATION_FAILED`) to the store and asserts it never reaches the DOM, which is the stronger form of the same requirement."
  - "`requestRefocus()` returns the declared `ElectionOutcome`, not the coordination shape. The plan's signature says `Promise<ElectionOutcome>` but describes the unregistered arm as `{ state: 'error', code: 'STORAGE_UNAVAILABLE' }`; the declared type wins and the arm is `{ kind: 'error', code: 'STORAGE_UNAVAILABLE', message: … }` — same content, no fabricated success (see Deviations, plan-text resolutions)."
  - "A `secondary` refocus outcome reports `ELECTION_TIMEOUT`. The must-have is 'a refocus that does not reach primary reports a typed election failure', and the canonical §20.11 payload has exactly two members; the non-storage one is the only honest mapping for a promotion that did not happen. The §C.2 `WORKSPACE_ELECTION_TIMEOUT` identifier is used as the log code on that path only, never as a second payload vocabulary."
  - "`subscribeToElectionFailure` delivers the code and nothing else — no outcome object, no record, no epoch. 02-10's notice row renders one pinned sentence, so a richer payload would only create a place for a diagnostic to leak."
  - "The registry's listener errors are swallowed (and logged), never re-thrown: a subscriber must not break the refocus path it observes, and the path's own outcome must stay the election's report."
  - "`ready` renders an intentionally empty region. Phase 2 ships no conversation renderer (D2-18: do not redesign the Chat interface) and the conversation list is Phase 15's, so the hydrated projection stays reachable through the store contract; the code comment records the decision so a later reader does not read it as an omission."
  - "The hydration-failure action is a `Button type=\"link\"` — a real `<button>`, so keyboard reachability needs no role/tabindex/keydown scaffolding — and the problem line is `Typography.Title level={4} type=\"danger\"` (the 16px/600 emphasis style the UI-SPEC names, error-toned per its colour table, token-only, no hard-coded hex)."
  - "One status, one treatment, no default branch: the switch covers all six members of the frozen union, so a future seventh state cannot silently inherit another's presentation."

patterns-established:
  - "The banner's activation table is asserted for the whole frozen vocabulary in **both** shells: `WORKSPACE_WRITER_STATES.map(...)` with the expected count, so a state that starts rendering the banner fails even though nothing in the plan enumerates it."
  - "The refocus contract is asserted at three levels in one suite: the click reaches `elect()` (the registry), the banner is still mounted and the store still says `mirror` (no optimism), and the failure channel received the canonical code (the report path)."
  - "Every state row keeps its positive control inline: 'no retry action' is asserted alongside 'exactly this treatment', so an absence can never pass because the render failed entirely."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "The Side Panel conversation region renders all six D2-18 hydration states: each has exactly one treatment, `idle`/`ready` claim nothing, `hydrating` is an AntD `Skeleton` (never an inline spinner), `empty` is the approved presentation and the only state that renders its copy, `failed`/`recovery required` render the pinned `storage.hydrationFailed` line plus a `common.retry` action wired to the store's `retryHydration`, and no status changes the header/composer/toolbar/status bar or adds a marker to the live region"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/components/SidePanelShell.test.tsx (27 passed — 'renders exactly its own treatment for each of the six statuses', 'claims nothing about stored history while idle or hydrating', 'uses the AntD Skeleton for hydrating, never an inline spinner', 'renders the pinned failure presentation and retries through the store', 'leaves the header, composer, toolbar and status bar unchanged across every status')"
        status: pass
    human_judgment: false
  - id: D2
    description: "`MirrorBanner` activation is a pure function of the store's writer state in both surfaces: absent for all five non-mirror states, exactly once for `mirror`, mounted immediately above the conversation region in the Side Panel and inside the content region above the routed content in Standalone"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/components/SidePanelShell.test.tsx + tests/components/StandaloneShell.test.tsx (49 passed — 'mounts the banner for `mirror` only, exactly once per surface' with the full `WORKSPACE_WRITER_STATES` table, plus the DOM-order assertions 'renders the banner immediately above the conversation region' / '…above the routed content')"
        status: pass
    human_judgment: false
  - id: D3
    description: "The refocus path is non-optimistic and typed: the action asks the registry, the banner stays mounted and unchanged on both success and failure, no success claim appears, a failed refocus reports its own canonical error code through `subscribeToElectionFailure`, a `secondary` outcome reports `ELECTION_TIMEOUT`, and an unregistered instance resolves a typed `STORAGE_UNAVAILABLE` error instead of a fabricated success"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/components/SidePanelShell.test.tsx — 'asks the registry to refocus and leaves the banner mounted, claiming nothing', 'keeps the banner mounted and reports through the channel when the refocus fails', 'reports ELECTION_TIMEOUT when the refocus settles as secondary', 'resolves a typed unavailable outcome when no election is registered'; tests/components/StandaloneShell.test.tsx — 'asks the registry to refocus…', 'keeps the banner mounted and reports through the channel…'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Accessibility and copy on the mounted banner: the action is keyboard-reachable (role/tabindex/focus/Enter) with the canonical `workspace.mirrorRefocusA11y` name, the banner keeps `role=\"status\"` + `aria-live=\"polite\"`, and the full canonical caption is the element's text content rather than a truncated title-only affordance"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/components/MirrorBanner.test.tsx (9 passed, unmodified) + tests/components/SidePanelShell.test.tsx — 'makes the banner action keyboard-reachable with its canonical accessible name', 'renders the full canonical caption as text content, never as a title-only affordance'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Plan verification gate: `tsc --noEmit` clean, the full suite green, the no-Tailwind gate still clean after the new source literals, and the store's typed hydration error code provably never rendered"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit (clean) && npx vitest run (54 files / 819 tests) && bash scripts/verify-no-tailwind.sh (0 Tailwind utility strings in src)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cross-plan contract: 02-10 must call `setActiveWriterElection(election)` on startup and `applyElectionOutcome(...)` on each election/heartbeat, and subscribe `Phase2Notices` to `subscribeToElectionFailure`. Until the application lands, `writerState` stays `election-pending`, so **no banner renders in either shell** and every refocus request resolves the typed `STORAGE_UNAVAILABLE` error and reports it through the channel"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A cross-plan composition contract cannot be asserted from this plan's suites: the registry's unregistered arm is proved (a typed error, never a success), but that the production sequence registers an instance before the first refocus is 02-10's wiring. A verifier should confirm 02-10 calls `setActiveWriterElection` after `createWriterElection` and clears it on teardown, that `requestRefocus` is reached from the shells (no prop chain, no shell-local flag), and that 02-10's notice path subscribes to `subscribeToElectionFailure` rather than re-deriving election outcomes."
  - id: D7
    description: "The 400 px `MirrorBanner` backstop: the bar grows rather than clipping, the caption wraps to at most two lines then ellipsizes, and the action never wraps or clips"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/components/MirrorBanner.test.tsx — 'grows instead of clipping: min-height 32px and no fixed height' (the mechanism only); the mount path that makes the banner reachable at 400 px is 02-09's (D2)"
        status: pass
    human_judgment: true
    rationale: "The mechanism is asserted, but the visual behaviour at a 400 px Side Panel width cannot be observed in jsdom. `02-VALIDATION.md` § Manual-Only Verifications assigns the observation to Phase 15's consolidated Real-Chrome acceptance cycle, so this plan must not claim it closed (the same deferral family as WINDOWS #7)."

duration: 10 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 09: Hydration-State Conversation Region and the Mounted Mirror Banner Summary

**The phase's status contract is now user-visible: the Side Panel conversation region renders each of D2-18's six hydration states with the approved copy (a Skeleton while reading, the pinned failure line plus `Retry` on failure, and never the empty presentation before a successful empty read), and `MirrorBanner` is mounted in both shells for `writerState === 'mirror'` alone behind a refocus path that asks the election, changes nothing on click, and reports every non-primary outcome through a typed failure channel.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-24T01:26:05Z
- **Completed:** 2026-09-24T01:35:55Z
- **Tasks:** 2
- **Files modified:** 5 (0 created)

## Accomplishments

- **The six hydration states exist as renderings, not as a type.** `conversationRegionContent(status, retry)` is a total switch: `idle` and `ready` render nothing (the region claims no history it has not read), `hydrating` renders an AntD `Skeleton` filling the region, `empty` is the only state that renders `chat.empty` + `chat.emptyBody`, and `failed`/`recovery required` render `storage.hydrationFailed` with a `common.retry` action calling the store's own `retryHydration()`. The suite walks the whole state table and asserts the whole treatment per row, so every absence sits next to its positive control.
- **No false empty, no silent failure, no leaked diagnostic.** A failure renders no empty copy and no load placeholder; the region's text is exactly the pinned problem line plus the action label; and the test seeds `hydrationError: { code: 'IDB_MIGRATION_FAILED' }` into the store to prove the code is present there and absent from the DOM (T-02-46, T-02-50 and T-02-49's strongest form).
- **One surface, one treatment — the rest of the shell is untouched.** The header, composer, toolbar and status bar are captured as `outerHTML` for all six statuses and asserted byte-identical across them, and the live conversation region carries no `data-np-backing` marker in any status (a marker on a live region is a defect, Phase-1 hard rule 5).
- **The banner is a reporter of authoritative state, mounted in both shells.** `writerState === 'mirror'` is the only condition that renders it — the whole `WORKSPACE_WRITER_STATES` vocabulary is asserted, with exactly one banner for `mirror` and none for the other five — and neither shell holds a mirror flag or derives an activation rule. Placement is pinned structurally: the region's `previousElementSibling` in the Side Panel, and document order before the routed content in Standalone.
- **The refocus path cannot fake anything.** The click calls the registry's `requestRefocus()`, which delegates to the active election's `elect()`; the shell changes no local state, so the banner stays mounted and its caption unchanged and the store still reports `mirror` after a *successful* resolution — because success becomes visible only when authoritative state says `primary`. A failure (or a `secondary` outcome, i.e. a refocus that did not reach primary) reaches `subscribeToElectionFailure` with a canonical §20.11 code, and the banner never becomes a second error surface.
- **No regression.** `tsc --noEmit` clean; the full suite at 54 files / 819 tests; the no-Tailwind gate clean at 0 utility strings; `tests/core/workspace` (6 files) and `tests/isolation` (4 files) green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Conversation-region hydration states in the Side Panel shell** — `279d915c` (feat)
2. **Task 2: `MirrorBanner` mount plus the non-optimistic refocus path in both shells** — `a0dccb19` (feat)

**Plan metadata:** see the final `docs(02-09)` commit below

## Files Created/Modified

- `src/components/sidepanel/SidePanelShell.tsx` — `conversationRegionContent()` (the six-state presentation switch), the store reads (`hydrationStatus`, `retryHydration`) and the `writerState` read, the `<MirrorBanner>` mount above the conversation region, and the region's rewritten provenance comment.
- `src/components/standalone/StandaloneShell.tsx` — the `writerState` read and the `<MirrorBanner>` mount immediately above the routed content, with the activation/interaction contract recorded in the comment.
- `src/core/workspace/WriterElection.ts` — the active-instance registry: `ElectionFailureCode`, `setActiveWriterElection()`, `isWriterElectionRegistered()`, `subscribeToElectionFailure()`, `requestRefocus()` and the private `reportElectionFailure()`; a header note that the registry holds a reference and no authority.
- `tests/components/SidePanelShell.test.tsx` — 19 → 27 cases: the six-state treatment table, the no-claim cases, the Skeleton-not-Spin source pin, the failure copy plus store-retry and diagnostic-absence cases, the unchanged-shell comparison, the activation table, the three refocus levels (registry call, no optimistic hide, failure channel), the unregistered-instance arm, the keyboard path and the full-caption rule. The Phase-1 empty-state case now pins `empty` explicitly, and a file-level `afterEach` restores both stores and clears the registry.
- `tests/components/StandaloneShell.test.tsx` — 17 → 22 cases: the same activation table, the above-the-routed-content placement, the registry call with no optimistic hide, and the failure-channel case.

## Decisions Made

- **The typed hydration error is never read by the shell.** `failed` and `recovery required` already select the treatment, and T-02-49 forbids rendering any code — so a read would exist only to be discarded. The requirement is satisfied more strongly by asserting the code is in the store and not in the DOM.
- **`requestRefocus()` returns the declared `ElectionOutcome`.** The plan's signature says `Promise<ElectionOutcome>` while its prose describes the unregistered arm as a coordination-shaped error; the declared type wins, and the arm carries the same content (`kind: 'error'`, `code: 'STORAGE_UNAVAILABLE'`, a message) and reports through the channel exactly like an election-produced error.
- **A `secondary` outcome is reported as `ELECTION_TIMEOUT`.** "A refocus that does not reach primary reports a typed election failure" cannot be satisfied by the two-member §20.11 vocabulary any other way; the code is also logged as `WORKSPACE_ELECTION_TIMEOUT` on that one path.
- **The failure channel carries a bare code.** No outcome object, no record, no epoch — a richer payload would only give 02-10's single pinned notice sentence a place to leak a diagnostic from.
- **A listener that throws cannot break the refocus path.** `reportElectionFailure` isolates each subscriber (and logs the throw at the election-timeout code, which is already the channel's own path).
- **`ready` is deliberately an empty region.** Phase 2 ships no conversation renderer and the list is Phase 15's (D2-18: do not redesign the Chat interface); the comment records it so the blank region is not mistaken for an omission.
- **The failure action is a `Button type="link"`.** It is a real `<button>` (keyboard-reachable without role/tabindex/keydown scaffolding), it is the UI-SPEC's "inline text link / secondary action" accent instance, and the problem line is `Typography.Title level={4} type="danger"` — the 16px/600 emphasis style the UI-SPEC names, error-toned per its colour table, resolved from tokens only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The existing Phase-1 empty-state case asserted the empty presentation unconditionally**
- **Found during:** Task 1 (running the suite the plan's `<verify>` names)
- **Issue:** `tests/components/SidePanelShell.test.tsx`'s "renders the empty conversation state with zero fabricated messages" called `renderShell()` with no store setup, which is now `idle` — a status that must render neither the empty presentation nor a ready one. The old assertion was written when the shell rendered the empty state unconditionally.
- **Fix:** the case now pins `renderShellAt('empty')`, which is the *only* state in which its assertions are the correct contract, and its comment records the D2-18 rule. The anti-fabrication assertions (no `.ant-bubble`, no `.ant-skeleton`) are unchanged.
- **Files modified:** `tests/components/SidePanelShell.test.tsx`
- **Verification:** the case passes alongside the new six-state table; the same file's absence rows prove the empty copy cannot appear in the other five statuses.
- **Committed in:** `279d915c` (Task 1)

### Plan-text resolutions

**A. `requestRefocus()`'s unregistered arm shape.** The plan declares `Promise<ElectionOutcome>` but describes the arm as `{ state: 'error'; code: 'STORAGE_UNAVAILABLE' }` (the coordination shape). Implemented as the declared `ElectionOutcome` — `{ kind: 'error', code: 'STORAGE_UNAVAILABLE', message: … }` — because the signature is the typed contract and the two shapes cannot both be returned. The behaviour the clause exists for ("never a fabricated success") is asserted verbatim in the suite.

**B. A refocus that settles `secondary`.** The plan's channel vocabulary is the two §20.11 codes, and its must-have requires a report whenever a refocus "does not reach primary". `ELECTION_TIMEOUT` is the only non-storage member, so a `secondary` outcome reports it (and logs the §C.2 `WORKSPACE_ELECTION_TIMEOUT` code on that path). Recorded so the phase verifier can ratify the mapping rather than discover it.

**C. `hydrationStatus` "and the typed error state".** Task 1's action says to read both; the shell reads only the status, because the error's only possible use (rendering the code) is forbidden by the plan's own T-02-49 and the co-located UI-SPEC prohibition. The suite asserts the absence instead — a store-held code that never reaches the DOM.

**D. The failure presentation has no third string.** The 02-UI-SPEC's typography row mentions a `Typography.Text` "next step" line, but the Copywriting Contract pins only the problem line and the action label for hydration failure, and inventing a string would violate §0.2. The next step is therefore conveyed by the pinned `common.retry`  action itself.

---

**Total deviations:** 1 auto-fixed (blocking) + 4 plan-text resolutions
**Impact on plan:** No scope creep. The auto-fix was forced by the plan's own contract (the old case asserted a presentation the plan forbids for its state); the resolutions are places where the plan's prose and its typed signature/vocabulary disagreed, all resolved in favour of the declared contract and all asserted in the suite.

## Issues Encountered

- **`queryByRole('alert')` is not a valid "no second error surface" assertion on the Standalone surface.** The deferred page shell (`np-page-chat`) renders an AntD `Alert`, so the assertion was scoped to the banner element (`banner.querySelector('[role="alert"]')`) — an unscoped role query would have been a false positive that passes for the wrong reason on the Side Panel and fails for the wrong reason here.
- **Mounting the banner in a shell that a Phase-1 suite compares structurally.** The Standalone marking-discipline case pins the exact ordered list of marked elements; the banner carries no `data-np-backing`, so the list is unchanged — verified rather than assumed, since a marker on a live banner would have been the tempting mistake.
- **Store updates in component tests must be wrapped in `act`.** The first draft set the store outside `act` and produced React `act(...)` warnings from the afterEach reset of a still-mounted shell; the helpers now wrap every store write, and the suites run warning-free.

## Known Stubs

None. Every state the plan names is reachable and asserted: the six hydration treatments are driven through the real store selectors with the real string map, the banner's activation table is walked for the whole frozen vocabulary, and the refocus path exercises the production `requestRefocus()` against a structurally-real election. No placeholder values, no TODO/FIXME markers, no skipped tests and no unrun `<verify>`. (`ready`'s empty region is a documented decision, not a stub — the renderer is Phase 15's by the plan's own instruction.)

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-interactive-control | `src/components/sidepanel/SidePanelShell.tsx`, `src/components/standalone/StandaloneShell.tsx` | Both shells now render a live, focusable control that triggers cross-surface coordination (`requestRefocus()` → the election's `elect()` → a `chrome.storage.session` write). It is the first user gesture in Phase 2 that reaches an authoritative write path. It changes no local state, claims nothing on success, and reports every non-primary outcome through the typed channel — asserted in both suites. |
| threat_flag: storage-read | `src/components/sidepanel/SidePanelShell.tsx` | The Side Panel now imports `useExtensionStore`, which means a UI surface pulls in the hydration store (and, through it, the storage layer's types). The shell performs no read itself — it selects `hydrationStatus` and `retryHydration` and renders them (D2-20's boundary is intact) — but the import is the first place a surface *component* observes the hydration lifecycle, and it is the seam 02-10 drives. |

The plan's register is otherwise closed by this plan's suites: T-02-46 (empty-before-hydration — only `empty` renders the copy, asserted for the other five), T-02-47 (banner without authority — the activation table for the whole vocabulary in both shells), T-02-48 (optimistic refocus — mounted and unchanged after the click on both paths), T-02-49 (rendered diagnostics — no rendered string interpolates an id, key, stage or code, and the store-held code is asserted absent from the DOM), T-02-50 (unreachable recovery — the failure path always carries the store's own retry action), T-02-SC (no install in this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-10 owns the composition point and must not skip it.** With this plan's shells reading `writerState`, the banner renders nowhere until 02-10's startup sequence calls `applyElectionOutcome(...)` after `elect()` (and inside the heartbeat) and registers the instance with `setActiveWriterElection(election)` — clearing it on teardown. Until then every refocus request resolves the typed `STORAGE_UNAVAILABLE` error and reports it through the channel, which is the honest unregistered behaviour and is asserted.
- **02-10's notice path subscribes to `subscribeToElectionFailure`.** The payload is a bare `'ELECTION_TIMEOUT' | 'STORAGE_UNAVAILABLE'`; the notice renders the pinned `workspace.electionFailed` sentence with the `shell.errorReload` action and must not re-derive an outcome from the store.
- **02-11/02-12** drive both surfaces on the shared harness: the banner is now mounted, so the single-controller assertions (WINDOWS #8) can observe a real mirror surface instead of a fixture.
- **02-13's gate** lists all three component suites this plan touches; `tsc --noEmit`, `npx vitest run` and `verify-no-tailwind.sh` are green as of this plan.
- **Phase 15** inherits the conversation renderer for `ready` (the projection is reachable through the store; this plan renders nothing for that state by design) and the 400 px banner observation (coverage entry D7).
- **Deferred items recorded** in `deferred-items.md` (this phase): the pre-existing AntD v6 `Alert message=` deprecation on the Standalone minimum-viewport alert, and the 400 px observation's Phase-15 ownership.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 5 modified source/test files exist on disk, and this SUMMARY exists at its plan path.
- Both plan task commits exist in history: `279d915c` (Task 1), `a0dccb19` (Task 2).
- Measured commit count at SUMMARY write time (`git rev-list --count 4f712f0e..HEAD`): 2, base recorded as `plan_head_before`.
- `npx tsc --noEmit` clean; `npx vitest run` green at 54 files / 819 tests; `bash scripts/verify-no-tailwind.sh` clean at 0 utility strings.
- The three suites this plan's `<verify>` names are green: 27 + 22 + 9 = 58 passed.
