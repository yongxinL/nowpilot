---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 10
subsystem: ui
tags: [sidepanel, standalone, startup-sequence, writer-election, heartbeat, refocus, antd-app-config, notifications, stable-keys, capability-notice, d2-02, d2-13, d2-17, d2-18, d-12-carry-forward, wave-6]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-08's `hydrateChatHistory()` / `hydrationError` — the D2-17 read path (database, journal recovery, migration, conversations) and the typed failure state the notices read"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-09's active-instance registry (`setActiveWriterElection`, `subscribeToElectionFailure`, `requestRefocus`) and the mounted `MirrorBanner` path this plan makes reachable"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-06's `createWriterElection` / `HEARTBEAT_MS` / `coordinationState()` and 02-07's `applyElectionOutcome` writer projection"
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: "the single-provider surface chains, the canonical string map (nine Phase-2 keys) and the Phase-1 pinned `message.config` / `notification.error({duration:0})` contract"
provides:
  - "src/entrypoints/sidepanel/main.tsx, src/entrypoints/standalone/main.tsx — `usePhase2Startup()` (hydrate → elect → register → heartbeat → teardown), `createSurfaceElection()` (every outcome applied to the writer projection), the tab-id resolvers, the pinned `<AntdApp message/notification>` configuration and the `Phase2Notices` mount"
  - "src/components/common/Phase2Notices.tsx — `Phase2Notices`, `PHASE2_NOTICE_KEYS` (the three persistent notices)"
  - "src/components/onboarding/OnboardingFlow.tsx — the `storage.credentialCapability` Alert on the credential step"
  - "tests/components/Phase2Notices.test.tsx (10), tests/components/OnboardingFlow.test.tsx (21 → 27)"
affects: [02-12, 02-13, phase-03-provider, phase-15-workspace-experience]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 9916
  tasks: 3
  commits: 3
  plan_head_before: d976a2b7354ff02d1410275bfec8d1cecff23dcf

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One startup effect per surface root, and it owns the whole phase: hydrate (the store's in-flight guard absorbs React's double-invoked mount), elect, register, heartbeat, and on teardown clear the interval, unregister and `stop()` the election so a closed surface can never be a refocus target"
    - "Every election outcome reaches the store through the election's own `coordinationState()`: the surface registers a thin wrapper whose `elect()` applies the projection, so the refocus action (through the registry) and the heartbeat report identically — no second derivation of an outcome anywhere"
    - "The heartbeat is the surface's own interval at the election's `HEARTBEAT_MS`: `startHeartbeat()`'s internal `elect()` is unobservable, so a promotion granted on the heartbeat would never reach the banner or the onboarding gate (02-07's D6)"
    - "The pinned AntD configuration is applied as `<App message={{maxCount:3,duration:5}} notification={{duration:0}}>` — v6's app-scoped configuration, which configures exactly the instances `App.useApp()` returns; module-constant config objects, because a fresh literal per render rebuilds the app-scoped API"
    - "Notices are keyed, not stacked: one constant key per failure kind, `duration: 0` on every call, and the failure payload is read for its kind and discarded — the copy is the pinned sentence and nothing else"
    - "A failure code no notice owns raises nothing: the conversation region's inline `storage.hydrationFailed` + `Retry` presentation stays the single surface for conversation-level failures"

key-files:
  created:
    - src/components/common/Phase2Notices.tsx
    - tests/components/Phase2Notices.test.tsx
  modified:
    - src/entrypoints/sidepanel/main.tsx
    - src/entrypoints/standalone/main.tsx
    - src/components/onboarding/OnboardingFlow.tsx
    - tests/components/OnboardingFlow.test.tsx

key-decisions:
  - "The startup effect lives in each surface component (`SidePanelSurface` / `StandaloneSurface`) and the pinned AntD configuration on each root's `<AntdApp>` props: the effect is the surface's own lifecycle (like the existing command/keymap effects), while the provider chain and its configuration belong to the root."
  - "`createSurfaceElection()` wraps the election so `elect()` applies `coordinationState()` to the writer projection. Both electing paths — the shell's `requestRefocus()` (via the registry) and the heartbeat — therefore publish authoritative state; without the wrapper a refocus that promoted this surface would leave the banner mounted and the onboarding gate hidden until the next heartbeat."
  - "The heartbeat is the surface's interval, not `election.startHeartbeat()`. The module's internal timer calls an unexported `elect()` whose outcome is unobservable, so a promotion granted on a heartbeat tick would never reach `useWorkspaceStore` — exactly the gap 02-07's D6 names. Teardown still calls `election.stop()`, which is what releases the record."
  - "antd v6 exposes no `config` method on the `App.useApp()` instances (verified in `antd@6.5.2`'s `useMessage` / `useNotification`): the pinned values are applied through the `App` config props, which configure exactly those instances, and no static `message.*` / `notification.*` import is added."
  - "Each notice's copy is its `title` and there is no `description`: the canonical map pins one sentence per notice, and splitting it into a heading plus a body would invent copy §0.2 forbids. `title` is also what the shipped Alert call sites in this repo use."
  - "The degraded notice has two sources: `onBlockedOpen` (§19.10's own blocked signal, which `NowPilotDB` documents as the caller's job to surface) and the store's `IDB_OPEN_FAILED` / `IDB_UNSUPPORTED_VERSION`. The migration notice covers `IDB_MIGRATION_FAILED` **and** the `LEGACY_CHAT_MIGRATION_*` family — the store publishes the migration module's own code, so without the family a real legacy-migration failure would raise no notice and the plan's must-have would be false."
  - "The tab id is the surface's real identity, not a synthetic constant: the Side Panel is not a tab, so it uses `chrome.tabs.query({active:true,currentWindow:true})` (its host tab — the same query the Standalone's Focus Side Panel path already issues); the Standalone uses `chrome.tabs.getCurrent()` (its own tab). Both fall back to `-1` when the platform cannot answer, which still leaves the two surfaces distinct by the record's `surface` field."
  - "The election notice's action reloads the surface document (`window.location.reload()`), which re-runs the startup sequence — the retry the sentence promises — rather than `chrome.runtime.reload()`, which restarts every surface including the service worker."
  - "The notices never auto-close and never become a second error surface: a conversation-level failure code (`CHAT_HISTORY_INVALID_RECORD`, a read failure) raises nothing, because the conversation region already renders `storage.hydrationFailed` with its own `Retry`."
  - "The pinned `maxCount: 3` is applied to the message holder (the UI-SPEC's carried-forward prerequisite); the notification holder carries only the pinned `duration: 0` override, because Phase 2's notice set is three stable keys by construction and the UI-SPEC's notification override table lists no cap."

patterns-established:
  - "A headless component that is pure subscription: `Phase2Notices` renders `null`, subscribes to its three real sources, and re-issues the same key on every republish — so 'one notice per kind' is a property of the key, not of the component's memory."
  - "The notice contract is asserted on both halves at once: the exact configuration the component passes (key, duration, actions — captured from the app-scoped API) *and* the rendered notice DOM (one node per kind, the pinned sentence byte-equal, the action only where it belongs)."
  - "A redaction test that starts from the strongest possible claim: every rendered title is byte-equal to one of the three pinned sentences, and a synthetic payload's tokens (record id, storage key, journal stage, file path, ciphertext, three error codes) are asserted absent from the rendered notices."
  - "The blocked signal is fired for real: an older raw connection holds the database and a newer-version open blocks on it, so the §19.10 signal travels the production path (the database module's `blocked` callback) rather than a mocked subscription."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "Both surface roots run the phase's startup sequence once per mount — hydrate through the store's D2-17 read path, create this surface's writer election with its real identity, register it for refocus, apply the first election, then heartbeat — and on teardown clear the interval, unregister the instance and `stop()` the election"
    requirement: "CORE-02"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean) + `rg -n \"usePhase2Startup|setActiveWriterElection|createSurfaceElection\" src/entrypoints/{sidepanel,standalone}/main.tsx` (present in both roots; teardown clears the interval, unregisters and stops)"
        status: pass
    human_judgment: true
    rationale: "The entrypoints are not rendered by any suite (both call `createRoot` at module scope; only `openSidePanelForCurrentTab` is unit-tested), so the composition point cannot be asserted from a test. A verifier should read both roots and confirm: the effect runs once per mount with a teardown that clears the heartbeat, unregisters and stops; `setActiveWriterElection` is called after `createWriterElection`; the heartbeat drives `elect()` at `HEARTBEAT_MS`; and no storage module was added to `src/entrypoints/background.ts`."
  - id: D2
    description: "The pinned AntD configuration Phase 1 declared but never applied is live at both roots: `message` capped at 3 visible toasts with a 5 s default, and acknowledgement-requiring notifications defaulting to `duration: 0` — applied to the instances `App.useApp()` returns, with no static `message.*` / `notification.*` import anywhere"
    requirement: "CORE-02"
    verification:
      - kind: other
        ref: "`rg -n \"ANT_MESSAGE_CONFIG|ANT_NOTIFICATION_CONFIG\" src/entrypoints/{sidepanel,standalone}/main.tsx` → the two module constants declared and passed as `<AntdApp message notification>` props in both roots; `rg -n \"from 'antd'\" src/entrypoints/*/main.tsx` → `{ App as AntdApp }` only"
        status: pass
    human_judgment: true
    rationale: "The values are pinned and the wiring is source-visible, but no suite renders either root, so the application of the configuration is a reading judgement. A verifier should confirm the constants carry the pinned values (`maxCount: 3, duration: 5` / `duration: 0`), that they are module constants rather than per-render literals, and that neither entrypoint imports a static imperative API."
  - id: D3
    description: "The three persistent failure notices exist with stable keys, canonical copy and redacted content: the degraded notice (blocked signal + `IDB_OPEN_FAILED` / `IDB_UNSUPPORTED_VERSION`), the migration notice (`IDB_MIGRATION_FAILED` + the `LEGACY_CHAT_MIGRATION_*` family) and the election notice (the 02-09 failure channel) — one keyed `notification.error` per kind, `duration: 0` on every call, the `Reload` action only on the election notice, and no diagnostic token in any rendered notice"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/components/Phase2Notices.test.tsx (10 passed — 'raises one notice per source, each with its own stable key and pinned sentence', 'raises the degraded notice for the blocked-open signal' (a real blocked IndexedDB upgrade), 'raises nothing for a failure code no Phase-2 notice owns', 'updates one notice instead of stacking when the same failure repeats', 'requires acknowledgement on every notice and never auto-closes', 'gives only the election notice an action, carrying the pinned reload label', 'renders the pinned sentence only: no diagnostic token from any failure payload', 'removes every subscription on unmount: a later failure raises nothing', 'renders no markup of its own', 'reaches the notification API only through App.useApp()')"
        status: pass
    human_judgment: false
  - id: D4
    description: "The onboarding credential step renders one non-interactive `Alert type=\"info\" showIcon` carrying `storage.credentialCapability` verbatim below the fixture-marked credential field group: present on step 3 and no other step, byte-equal copy, no action/link/dismiss control, no `data-np-backing` marker, no reuse of `deferred.*` copy, and no reflection of the field's value, length or populated state; the four forbidden claim strings appear at no step"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/components/OnboardingFlow.test.tsx (27 passed — the six new cases: 'renders the capability statement on step 3 and on no other step', 'renders the approved sentence verbatim — no paraphrase, no second sentence', 'is a statement, not an affordance: no action, link or dismiss control', 'is not a DeferredNotice: no marker attribute and no deferred copy', 'never reflects the credential field: a sentinel changes nothing in the notice', 'never renders a forbidden success claim at any step')"
        status: pass
    human_judgment: false
  - id: D5
    description: "Plan verification gate: `tsc --noEmit` clean, the full repository suite green, the isolation suites unchanged, the Phase-1 no-Tailwind gate still clean after the new literals, and no forbidden claim string present in `src/`"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit (clean) && npx vitest run (56 files / 858 tests) && npx vitest run tests/isolation (4 files / 76 tests) && bash scripts/verify-no-tailwind.sh (0 utility strings) && `rg -n \"Credential stored|Provider connected|Provider validated|Provider ready\" src/` (no match)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cross-plan composition (02-07 D6 / 02-09 D6 / WINDOWS #23): the startup sequence registers the election and applies `coordinationState()` to the writer projection on every election — so the banner and the onboarding gate can finally react to an authoritative outcome — and `recoverJournal()` now has a production call site reachable from both surface roots through `hydrateChatHistory()`"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A cross-plan composition contract cannot be asserted from this plan's suites (the entrypoints are not rendered). A verifier should confirm the wrapper's `elect()` applies the election's own `coordinationState()` (not a re-derived outcome), that both the registry path and the heartbeat go through it, and that `hydrateChatHistory()` — whose 02-08 entry point owns `recoverJournal` — is what the startup sequence calls. `compactJournal()` still has no production caller: recorded as WINDOWS #25."
  - id: D7
    description: "The 400 px backstop for this plan's surfaces: the capability Alert body and the storage notifications wrap with no horizontal scroll and no mid-glyph clipping"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "the pinned strings are fixed and non-interpolated (asserted); the layout itself is unobservable in jsdom"
        status: pass
    human_judgment: true
    rationale: "jsdom cannot observe layout. `02-VALIDATION.md` § Manual-Only Verifications assigns the 400 px observation to the Phase 15 consolidated Real-Chrome acceptance cycle, so this plan must not claim it closed (the same deferral family as 02-07 D7 / 02-09 D7)."

duration: 18 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 10: Surface Startup, the Pinned Notice Configuration and the Three Persistent Failure Notices Summary

**Both surfaces now run the phase's storage spine and hold a live writer election — hydrate, elect, register, heartbeat, and publish every authoritative outcome into the writer projection — the pinned AntD notice configuration Phase 1 declared is applied at both roots, the three acknowledgement-requiring failure notices (degraded, migration, election) exist as one stable-keyed notification each with pinned copy and no diagnostics, and the onboarding credential step states the capability honestly instead of fabricating a success.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-24T02:05:00Z
- **Completed:** 2026-09-24T02:23:00Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- **The phase's runtime is live on both surfaces.** `usePhase2Startup()` runs once per mount in each surface component: `hydrateChatHistory()` (which itself initialises `np_db`, replays the journal through `recoverJournal`, runs or resumes the migration and reads the conversations), then `createWriterElection({ surface, tabId })` with the surface's real identity, `setActiveWriterElection(...)`, the first election, and a heartbeat at `HEARTBEAT_MS`. Teardown clears the interval, unregisters the instance and `stop()`s the election, which releases the record — so a closed surface can never be a refocus target.
- **The D6 composition gap is closed.** 02-07 and 02-09 both recorded that `writerState` would stay `election-pending` — no banner, no onboarding — until something applied an election outcome. `createSurfaceElection()` wraps the election so `elect()` applies `coordinationState()` to `useWorkspaceStore`: the shell's `requestRefocus()` (through the registry) and the heartbeat both publish, and the projection is the election's own canonical shape rather than a re-derivation. A promotion therefore unmounts the banner and opens the onboarding gate through state, exactly as the UI-SPEC requires.
- **The pinned AntD configuration is finally applied.** Both roots pass `message={{ maxCount: 3, duration: 5 }}` and `notification={{ duration: 0 }}` to `<AntdApp>` — antd v6's app-scoped configuration, which configures the very instances `App.useApp()` returns — as module constants, so the app-scoped API is not rebuilt on every render. No static `message.*` / `notification.*` import exists anywhere, and the background worker gained nothing.
- **The three persistent notices exist with stable keys and redacted copy.** `Phase2Notices` is headless: it subscribes to the store's typed failure state, `NowPilotDB`'s `onBlockedOpen` signal and the 02-09 election-failure channel, and issues one keyed `notification.error` per kind with `duration: 0`. The election notice alone carries the `Reload` action. The suite drives all three real sources — including a **real blocked IndexedDB upgrade** and the **production `requestRefocus()`** — and proves that a repeated failure updates one notice, that an unrecognised code raises nothing, and that a synthetic payload's record id, storage key, journal stage, file path, ciphertext and three error codes reach no rendered notice.
- **The capability notice is honest and inert.** The credential step renders one `Alert type="info" showIcon` carrying `storage.credentialCapability` verbatim below the fixture-marked field group: present on step 3 and no other step, no action/link/dismiss control, no `data-np-backing` marker, no `deferred.*` copy, and provably invariant while a sentinel sits in the field (no echo of value, length or populated state). The four forbidden claim strings are asserted absent at every step of the flow.
- **No regression.** `tsc --noEmit` clean; the full suite at 56 files / 858 tests; the isolation directory at 4 files / 76 tests; the no-Tailwind gate clean at 0 utility strings; the four forbidden claim strings absent from `src/`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Startup sequence and the pinned AntD notice configuration in both surfaces** — `8b102ede` (feat)
2. **Task 2: `Phase2Notices` — the three persistent failure notices with stable keys** — `e4bfbf64` (feat)
3. **Task 3: The credential capability notice on the onboarding credential step** — `5b657318` (feat)

**Plan metadata:** see the final `docs(02-10)` commit below

## Files Created/Modified

- `src/entrypoints/sidepanel/main.tsx` — `usePhase2Startup()` (the D2-17 read path, the registered election and its heartbeat, with the disposal guard for React's double-invoked mount), `createSurfaceElection()` (the wrapper that applies `coordinationState()` on every election), `resolveHostTabId()` (the active tab of the current window — the Side Panel's host), the pinned `ANT_MESSAGE_CONFIG` / `ANT_NOTIFICATION_CONFIG` module constants, the `<AntdApp message notification>` props, and the `Phase2Notices` mount.
- `src/entrypoints/standalone/main.tsx` — the same startup sequence for the Standalone surface, `resolveSelfTabId()` (its own tab, via `chrome.tabs.getCurrent`), the same pinned configuration and the `Phase2Notices` mount.
- `src/components/common/Phase2Notices.tsx` — `PHASE2_NOTICE_KEYS` and `Phase2Notices`: the three notice kinds, `noticeKindForCode()` (the migration family incl. `LEGACY_CHAT_MIGRATION_*`, the unavailable family, and nothing else), the stable-keyed `notification.error` calls, the election notice's `Reload` action, and the three subscriptions with their unsubscribes.
- `src/components/onboarding/OnboardingFlow.tsx` — the capability `Alert` on step 3, immediately below the fixture-marked credential field group, with the doc comment recording that it is a statement rather than a `DeferredNotice`.
- `tests/components/Phase2Notices.test.tsx` — 10 cases: the three sources, the blocked signal fired for real, the unowned-code case, the repeated-failure case, `duration: 0` plus the no-auto-close behaviour, the action-only-on-election case, the redaction case, the unmount case, the no-markup case and the API-discipline source scan.
- `tests/components/OnboardingFlow.test.tsx` — 21 → 27 cases: step-3-only presence, byte-equal copy, non-interactivity, marker/deferred absence, sentinel invariance and the forbidden-claim scan across every step (the existing in-memory credential cases unchanged).

## Decisions Made

- **The startup effect is the surface component's; the AntD configuration is the root's.** The effect is surface lifecycle (like the existing command and keymap effects) and the provider chain belongs to the root, so the pinned configuration rides on `<AntdApp>` while the wiring lives where the surface's other effects live.
- **`createSurfaceElection()` publishes every outcome.** Both electing paths — `requestRefocus()` through the registry and the heartbeat — must reach `useWorkspaceStore`, or a promotion would never become visible. The applied shape is the election's own `coordinationState()`, so nothing re-derives an outcome.
- **The heartbeat is the surface's interval, not `startHeartbeat()`.** The module's internal timer calls an unexported `elect()` whose outcome is unobservable; a heartbeat-granted promotion would never reach the store (02-07's D6 in miniature). Teardown still calls `election.stop()`, which is what releases the record.
- **antd v6 has no `config` on the hook instances.** Verified in `antd@6.5.2`: `useMessage` / `useNotification` return `{open, destroy, info, success, error, warning, loading}` with no `config`, so the pinned values are applied through the `App` config props (which configure exactly those instances) rather than the forbidden statics. The config objects are module constants so the app-scoped API is not rebuilt per render.
- **One sentence per notice, in `title`.** The canonical map pins one sentence per notice; a heading/body split would invent copy §0.2 forbids, and `title` is the v6 prop name the shipped Alert call sites already use.
- **The migration notice covers the `LEGACY_CHAT_MIGRATION_*` family.** The store publishes the migration module's own failure code (not the ErrorStore's §20.4 alias), so mapping only `IDB_MIGRATION_FAILED` would leave a real legacy-migration failure silent — the plan's must-have would have been false.
- **A code no notice owns raises nothing.** Conversation-level failures keep their inline region presentation; a notice for them would be a second, competing error surface.
- **Real surface identity.** The Side Panel is not a tab, so its identity is its host tab (the active tab of the current window — the same query the Focus Side Panel path issues); the Standalone is a tab and uses `chrome.tabs.getCurrent()`. Both fall back to `-1`, which still leaves the surfaces distinct by the record's `surface` field.
- **The election notice's action reloads the surface document.** `window.location.reload()` re-runs the startup sequence — the retry the sentence promises — rather than restarting the whole extension.
- **The notification holder carries only the pinned overrides.** `duration: 0` is applied; no cap is added, because the UI-SPEC's notification override table lists no `maxCount` and Phase 2's notice set is three stable keys by construction. The pinned `maxCount: 3` is applied to the message holder, which is where the carried-forward prerequisite names it.

## Deviations from Plan

### Task-boundary note (not a scope change)

**1. `Phase2Notices.tsx` and its mount landed in Task 2's commit, not Task 1's.**

- **Found during:** Task 1 (its `<verify>` runs `npx tsc --noEmit`, which would fail on an import of a file that does not exist yet).
- **Issue:** Task 1's `<action>` says to mount the new `Phase2Notices` component, but the component is Task 2's declared file. Creating it in Task 1's commit would attribute Task 2's artifact to the wrong commit; mounting it in Task 1's commit is impossible without the file.
- **Resolution:** Task 1's commit carries the startup sequence and the pinned configuration only; Task 2's commit carries the component, its mount in both roots (one import plus one JSX element each) and its contract suite. Every commit is self-contained and green, and the plan's outcome is unchanged.
- **Committed in:** `8b102ede` (Task 1) and `e4bfbf64` (Task 2).

### Plan-text resolutions

**A. `message.config` / `notification.config` on the `App.useApp()` instances do not exist in antd v6.** The plan names them, but `antd@6.5.2`'s hook instances expose no `config` method (only the forbidden statics do). The pinned values are applied through the `App` config props — `message={{maxCount:3,duration:5}}`, `notification={{duration:0}}` — which configure exactly the instances `App.useApp()` returns. The must-have's intent (pinned values, app-scoped instances, no statics) is satisfied; see coverage D2.

**B. The heartbeat runs on the surface's own interval.** The plan says to call the election's `startHeartbeat()`. That method's internal `elect()` reports nothing outward, so the store would miss every heartbeat-granted promotion — the exact failure 02-07's D6 exists to prevent. The surface therefore drives `elect()` itself at the election's exported `HEARTBEAT_MS`, and teardown still calls `election.stop()` to release the record.

**C. The notice copy is `title`, with no `description`.** The plan's action writes `{ key, title, description, duration: 0 }`; the canonical map pins one sentence per notice, so a description would either duplicate the title or invent copy. The pinned sentence is the title and no description is passed.

**D. The migration notice's code family.** The plan's key-link names `IDB_MIGRATION_FAILED`; the store publishes the legacy migration's own `LEGACY_CHAT_MIGRATION_*` code, so the family is mapped alongside it (see Decisions Made).

**E. The election notice's reload target.** The plan pins the label (`shell.errorReload`) and no behaviour; the action reloads the surface document, which re-runs the startup sequence.

---

**Total deviations:** 1 task-boundary note + 5 plan-text resolutions, 0 auto-fixed bugs
**Impact on plan:** No scope creep and no file outside `files_modified`. The task-boundary note keeps every commit green; the resolutions are places where the plan's prose named a mechanism that does not exist in the installed antd version (A), an API whose behaviour cannot satisfy the plan's own D6 requirement (B), or a shape the canonical copy does not have (C–E) — each resolved in favour of the phase contract and each documented above.

## Issues Encountered

- **The blocked-signal case needed a real blocked upgrade.** There is no seam to fire `onBlockedOpen` from a component test, so the suite holds a raw older IndexedDB connection and opens a newer version: the database module's own `blocked` callback fires the signal on the production path. The helper closes the holder and the requester in a `finally` so a failed assertion cannot leave a pending open behind.
- **The helper's first draft asserted the notice.** It awaited `waitFor(noticeNodes().length > 0)`, which made the unmount case fail for the wrong reason (nothing is supposed to appear there). The helper now only fires the signal and each caller asserts its own expectation — which is what lets the unmount case prove that a later blocked signal raises nothing.
- **`window.getComputedStyle` not-implemented noise in the onboarding suite is pre-existing.** It comes from AntD's modal scroll locker under jsdom and is unrelated to this plan's Alert; the suite is green (27/27).

## Known Stubs

None. Every notice kind is reachable and asserted against its real source; the capability notice renders the pinned sentence with no placeholder copy; no TODO/FIXME markers and no skipped tests were introduced. The one deliberate absence — `Phase2Notices` rendering nothing — is the component's contract (headless), asserted by its own case.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-ui-surface | `src/components/common/Phase2Notices.tsx` | A new component reads the storage layer's blocked signal (`onBlockedOpen`) and the store's typed failure state, and drives an acknowledgement-requiring notification with a real `Reload` action. It performs no read itself, interpolates nothing from the payloads, and its only interaction is a page reload — but it is the first component that both observes storage failures and offers an action, so its redaction and key-stability assertions are the load-bearing ones (T-02-51…T-02-55). |
| threat_flag: storage-startup | `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/standalone/main.tsx` | Both surface roots now run the D2-17 read path on mount (the database open, the journal replay, the migration and the conversation reads) and write an election record to `chrome.storage.session` on every heartbeat. The background worker remains a non-participant (`src/entrypoints/background.ts` is untouched and imports no storage module), and the isolation suite is in the task's verify. |

The plan's register is otherwise closed by this plan's suites: T-02-51 (migration notice truthful and content-free — the pinned string is asserted byte-equal and the diagnostic tokens absent), T-02-52 (notice content disclosure — the synthetic-payload case), T-02-53 (false capability claim — the capability notice is a statement plus the forbidden-claim scan across every step), T-02-54 (credential echo — the sentinel-invariance case), T-02-55 (notice stacking — the repeated-failure case plus `duration: 0`), T-02-56 (background contamination — no background change and the isolation suite green), T-02-SC (no install in this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-12** drives both surfaces on the shared harness: the election is now reachable and its outcome reaches the writer projection, so the single-controller clause (WINDOWS #8) can be asserted against live state rather than a fixture.
- **02-13's gate** lists all three component suites this plan touches; `tsc --noEmit`, `npx vitest run` (56 files / 858 tests), `npx vitest run tests/isolation` and `verify-no-tailwind.sh` are green as of this plan.
- **The D6 carry-forwards are closed:** 02-07's election-application requirement is satisfied (registered instance + `coordinationState()` applied on every election), and 02-02's journal entry is now half-closed with a precise record — `recoverJournal()` has a production call site reachable from both surface roots through `hydrateChatHistory()`, while `compactJournal()` still has none (WINDOWS #25, appended by this plan).
- **Phase 3** swaps the onboarding validation port and owns the provider runtime; the notices already distinguish provider-independent failures from conversation-level ones, so no Phase-2 notice claims a provider outcome.
- **Phase 15** inherits the 400 px observation for this plan's surfaces (coverage entry D7) and the conversation renderer behind the `ready` hydration state.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 6 files this plan touched exist on disk: both entrypoints, `Phase2Notices.tsx` and its suite, `OnboardingFlow.tsx` and its suite.
- All 3 task commits exist in history: `8b102ede` (Task 1), `e4bfbf64` (Task 2), `5b657318` (Task 3).
- Measured commit count at SUMMARY write time (`git rev-list --count d976a2b7..HEAD`): 3, base recorded as `plan_head_before`.
- `npx tsc --noEmit` clean; `npx vitest run` green at 56 files / 858 tests; `npx vitest run tests/isolation` green at 4 files / 76 tests; `bash scripts/verify-no-tailwind.sh` clean at 0 utility strings.
- The plan's three task verifies are green: Task 1's `tsc` + 71 tests, Task 2's 10-case notice suite, Task 3's 27-case onboarding suite.
