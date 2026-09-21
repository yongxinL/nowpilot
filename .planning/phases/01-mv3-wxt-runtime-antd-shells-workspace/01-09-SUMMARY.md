---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 09
subsystem: onboarding
tags: [onboarding, flow-9, sa-08, typed-ports, fixture-backed-validation, provider-validation-port, credential-store-port, canonical-provider-ids, component-memory-only, sentinel-absence, single-completion-record, legacy-boolean-migration, chrome-storage-local, cross-surface-propagation, tdd, background-bundle-budget]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-04's canonical string map — `onboarding.*`, the four typed `provider.error.*` labels, the `deferred.*` copy and `format()`; 01-09 adds only four `provider.name.*` labels
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-05's theme contract (`theme.useToken()` only, no hard-coded colour) and the one-`XProvider`-per-surface chain the flow mounts inside
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-02's surface roots (`src/entrypoints/{sidepanel,standalone}/main.tsx`), the shells and the `SidePanelRouter` onboarding/Shell decision point
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-07's removal-only startup-helper pattern (an import-free module keeps the service worker lean), applied here to the store/hook split
provides:
  - "`ProviderId` + `PROVIDER_IDS` — exactly the four canonical identifiers, one source for the union and the runtime membership list; `PersistedProviderConfig` (non-secret metadata only) and `TransientCredentialInput` (`{ providerId, credential }`)"
  - "`ProviderValidationPort` / `ProviderValidationResult` / `PROVIDER_VALIDATION_ERROR_CODES` / `isValidationCancelled` — the Phase-3 port with four canonical codes plus a cancellation member that carries none"
  - "`CredentialStorePort` — the Phase-2 port as a declaration only: zero implementations, zero call sites"
  - "`createFixtureValidationPort(selector)` — six deterministic selectors (success, invalid-credential, provider-unavailable, network-unavailable, cancelled, unexpected-failure), no SDK import, no network request"
  - "`OnboardingFlow` — one shared, surface-independent four-step flow (persona preview → provider → key → validate) with one state machine and typed port/lifecycle adapters"
  - "`onboardingStateStore` — `np_onboarding`, `ONBOARDING_SCHEMA_VERSION`, `readOnboardingState`, `writeOnboardingState`, `migrateOnboardingState`, `deleteLegacyOnboardingFlag`, `migrateLegacyOnboardingFlag`, `subscribeToOnboardingState`, `shouldPresentOnboarding`"
  - "`useOnboardingGate` — the shared surface render gate (`reading` | `present` | `hidden`), split out so the store module stays React-free"
  - "Both surface roots present the flow in the surface the user opened; the background seeds no flag and no install/startup path opens a surface"
  - "The legacy `onboardingComplete` boolean is absorbed into the record and its key deleted; the per-origin `localStorage` fallback is removed from the extension build"
affects: [01-10, 01-11, 01-12, 01-13, 02, 03, 15]

actuals:
  tokens: 25031    # chars/4 over the realized diff (git diff -U0 92cdfe00..HEAD -- src tests = 100,123 chars)
  tasks: 3
  commits: 8       # measured: git rev-list --count 92cdfe00..HEAD (3 RED + 3 GREEN + 2 follow-up fixes)
  plan_head_before: 92cdfe005a8c75d5c2be062362f9df9d7fb06845

tech-stack:
  added: []
  patterns:
    - "A port is a type plus a local adapter: the flow depends on `ProviderValidationPort`, so Phase 3 replaces one constructor argument and no component changes"
    - "Cancellation is its own union member with no error code — `{ ok: false; cancelled: true }` — so a caller that reads `code` cannot compile against a cancelled attempt, and `isValidationCancelled` is the only narrowing path"
    - "Key hygiene is structural, not conventional: the in-memory field is named `credential` (never one of the recognised persisted names), it never enters a prop that crosses a context boundary, and a sentinel-absence suite asserts it is absent from storage, state, broadcasts, logs, the DOM and every accessible name"
    - "One record, one key, one migration: a boolean cannot express D-06, so the legacy flag is absorbed into the typed record and deleted rather than kept beside it"
    - "A surface gate is a hook over a store subscription: both surfaces make the same render decision from one implementation, and a completion written anywhere closes every other surface's flow without a reload"
    - "A background import must stay dependency-light: the React hook was split out of the store module so the service worker's graph grew 2.4 kB instead of 10.8 kB (measured)"
    - "A grep-shaped gate is corrected to name its exact instrument, with both the raw and the scoped reading recorded"

key-files:
  created:
    - src/services/ports/providerValidationPort.ts
    - src/services/ports/credentialStorePort.ts
    - src/services/fixtures/providerValidationFixtures.ts
    - src/components/onboarding/OnboardingFlow.tsx
    - src/core/onboarding/onboardingStateStore.ts
    - src/core/onboarding/useOnboardingGate.ts
    - tests/services/providerValidationFixtures.test.ts
    - tests/components/OnboardingFlow.test.tsx
    - tests/core/onboarding/onboardingStateStore.test.ts
  modified:
    - src/types/index.ts
    - src/core/i18n/strings.ts
    - src/entrypoints/sidepanel/main.tsx
    - src/entrypoints/standalone/main.tsx
    - src/entrypoints/background.ts
    - src/components/chat/SidepanelChat.tsx
    - src/components/sidepanel/SidePanelRouter.tsx (comment only)
    - tests/core/i18n/strings.test.ts
    - .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md

key-decisions:
  - "`PROVIDER_IDS` is a `const` tuple and `ProviderId` is derived from it, so the union and the `Select` options cannot drift — the prototype's `'claude'` spelling is not a member and gets no alias."
  - "The legacy prototype provider types stay resolvable and are marked `// LEGACY — removed with its last consumer in plan 01-11`: `aiProvider.ts` switches on `'claude'`, so renaming the legacy union would break a live importer instead of removing it."
  - "The cancellation outcome is a third union member rather than a code, because the UI-SPEC's matrix says a cancelled attempt has *no* error code and must not be readable as a success; `isValidationCancelled` makes the branch explicit."
  - "The reveal toggle is a plain `Input` with an explicit `type` toggle and a `suffix` button, not `Input.Password`: antd v6's Password wrapper hard-codes `aria-label={locale.show|hide}` on its own toggle (`node_modules/antd/es/input/Password.js`) and offers no override, and `visibilityToggle={false}` removes the ability to toggle `type` at all — the pinned `onboarding.showKey`/`hideKey` names would have been unreachable beside a framework locale default."
  - "The flow's focus target is **one control per step** (Continue on step 1, the `Select` on step 2, the credential `Input` on step 3, the primary action on step 4). Sharing one ref between a step's control and its footer button made the target order-dependent, which is why step 3's focus silently landed on the Continue button."
  - "`OnboardingState` carries `validationBacking: 'fixture' | 'provider'` rather than a boolean marker: a boolean cannot say what the alternative is, and Phase 3 flips one literal."
  - "The completion record lives under `np_onboarding` (planner assumption P5) with the legacy boolean absorbed and deleted; `writeOnboardingState` re-migrates the stored record before merging a partial, so a skip cannot erase a selected provider and an incompatible stored value is replaced rather than merged blindly."
  - "The surface render gate landed in each **entrypoint root**, not in `SidePanelRouter` (01-02's note): the shared flow is a modal presented over whichever surface the user opened, so it does not replace the router's shell branch. `SidePanelRouter`'s comment was corrected and the divergence recorded in the inventory."
  - "`useOnboardingGate` was split into its own module after measuring the service worker: with the hook in the store, `background.ts` pulled React into its import graph (75,312 B → 86,140 B); after the split the graph is 77,740 B (+2.4 kB, the record module only)."
  - "The surface roots dismiss their own flow optimistically (`onboardingDismissed`) while the record write settles: the record remains the single persisted source, and the local flag only closes this surface's presentation."

patterns-established:
  - "A new-module TDD task commits its suite against a skeleton module first, so the RED run collects and each case fails on its own assertion instead of one module-load crash (both new modules in this plan followed it)"
  - "A fixture adapter's determinism is asserted by calling it twice per selector and deep-equalising, and its network-freedom by a zero-call `fetch` spy plus a source scan for provider SDK imports"
  - "A key-hygiene suite enumerates the sentinel across six surfaces (storage, serialised store state, published broadcasts, the log buffer, rendered text, every accessible name/tooltip) rather than sampling one"
  - "A source scan strips comments before asserting, so a provenance note naming the removed path cannot trip the gate"
  - "A service-worker-facing import is measured against the pre-plan commit in a detached worktree before the change is trusted"

requirements-completed: [SA-08, FLOW-9]

coverage:
  - id: D1
    description: "`ProviderId` is exactly the four canonical identifiers, the persisted provider type carries no credential-bearing field, and `TransientCredentialInput` is exactly `{ providerId, credential }` with none of the recognised persisted-credential field names."
    requirement: "SA-08"
    verification:
      - kind: unit
        ref: "tests/services/providerValidationFixtures.test.ts#exposes exactly the four canonical provider identifiers, in order / #PersistedProviderConfig carries no credential-bearing field / #TransientCredentialInput is exactly { providerId, credential } … / #TransientCredentialInput is referenced by no persisted-store type / #keeps the prototype legacy provider types marked for plan 01-11 removal"
        status: pass
      - kind: other
        ref: "grep -rn \"'claude'\" src/services/ports src/services/fixtures → 0 (the suite asserts it as a case)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The typed ports exist as declarations: `ProviderValidationResult` over the four canonical codes plus a cancellation member with no code, and `CredentialStorePort` with zero implementations and zero call sites."
    requirement: "SA-08"
    verification:
      - kind: unit
        ref: "tests/services/providerValidationFixtures.test.ts#declares the PortValidationResult union over the four canonical codes plus cancellation / #exports CredentialStorePort as a type with no implementation and no call site"
        status: pass
      - kind: other
        ref: "grep -rn \"CredentialStorePort\" src/ --include=\"*.ts\" --include=\"*.tsx\" | grep -v \"ports/credentialStorePort.ts\" | wc -l → 0; grep -rn \"fetch(\" src/services/ports src/services/fixtures | wc -l → 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fixture adapter is deterministic and network-free: one canned result per selector, deep-equal across calls, no SDK import, no `fetch`, and an aborted signal returns the cancellation member; the sentinel credential leaves no trace in any result."
    requirement: "FLOW-9"
    verification:
      - kind: unit
        ref: "tests/services/providerValidationFixtures.test.ts#is deterministic: the same selector yields deep-equal results twice / #performs no network request: the global fetch spy records zero calls / #returns a result carrying no trace of the credential argument / #imports no provider SDK module"
        status: pass
    human_judgment: false
  - id: D4
    description: "One shared, surface-independent four-step flow: the pinned titles, the always-visible `Step N of 4` indicator, the four canonical providers behind the pinned placeholder, the fixture-reason marker on the validation step, and zero Chrome access or hard-coded colour."
    requirement: "FLOW-9"
    verification:
      - kind: unit
        ref: "tests/components/OnboardingFlow.test.tsx (21 cases: the four steps, the indicator, the option set and its canonical values, the placeholder, the fixture marker, the reveal toggle, the loading/success/failure/cancelled states, the typed label per canonical code, Escape/mask, the exits and the per-step focus)"
        status: pass
      - kind: other
        ref: "grep -rn \"chrome\\.\" src/components/onboarding/ | wc -l → 0; grep -rEn \"#[0-9a-fA-F]{3,6}\" src/components/onboarding/ | wc -l → 0; the suite renders the flow with `chrome` undefined"
        status: pass
    human_judgment: false
  - id: D5
    description: "Key hygiene: the credential exists in component memory only, is cleared on completion, cancellation, close and terminal success (kept only while Retry must re-validate it), and a synthetic sentinel is absent from storage, serialised store state, published broadcasts, the log buffer, the rendered document and every accessible name or tooltip."
    requirement: "SA-08"
    verification:
      - kind: unit
        ref: "tests/components/OnboardingFlow.test.tsx#leaks the sentinel nowhere: storage, store state, broadcasts, logs, DOM, accessible names / #never calls fetch … / #does not update state after unmount when a validation resolves late / #returns to idle with the action restored when the fixture cancels"
        status: pass
    human_judgment: false
  - id: D6
    description: "One typed non-secret completion record under `np_onboarding`: the UI-complete flag, the persona, the provider identifier, the schema version and the separate validation-backing marker; a total throw-free migration that absorbs the legacy boolean and deletes its key; an incompatible schema version yields an unknown state that presents the flow."
    requirement: "SA-08"
    verification:
      - kind: unit
        ref: "tests/core/onboarding/onboardingStateStore.test.ts (16 cases: the one-key shape, the migration + removal, the idempotent write, the no-credential record, the incompatible/garbage/failed-read unknowns, the storage-change propagation and the two source scans)"
        status: pass
      - kind: other
        ref: "grep -rn \"onboardingComplete\" src/entrypoints src/core | grep -v \"core/onboarding/onboardingStateStore.ts\" | wc -l → 0 (raw count 2, both in the store module: the constant and its provenance note)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Both surfaces present the same flow in the surface the user opened, neither imports the other, the background seeds no flag and no install or startup path creates a tab or opens the panel."
    requirement: "FLOW-9"
    verification:
      - kind: unit
        ref: "tests/core/onboarding/onboardingStateStore.test.ts#mounts the shared flow on both surfaces and never surface-to-surface"
        status: pass
      - kind: other
        ref: "grep -rn \"tabs.create\\|sidePanel.open\" src/entrypoints/background.ts | wc -l → 0; grep -n \"migrateLegacyOnboardingFlag\" src/entrypoints/background.ts → 2 (install + startup, removal-only)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Two live surfaces behaving together at acceptance: Standalone presenting the same flow when it is opened first with no redirection, the first surface staying active while the second starts no competing flow, completion in one surface closing the other's flow, and the 400 px modal-copy backstop."
    requirement: "FLOW-9"
    verification: []
    human_judgment: true
    rationale: "The suites prove the store subscription, the gate decision and the modal structure in one realm, but the real observation needs two live Chrome surfaces and a browser at 400 px. Both checks are recorded as unrun verifies in `.planning/WINDOWS.md` (ids 7 and 8) for the phase acceptance run."

# Metrics
duration: 37min
completed: 2026-09-21
status: complete
---

# Phase 1 Plan 09: Fixture-Backed Onboarding Shell Summary

**One shared four-step onboarding flow behind typed ports — a deterministic six-case fixture adapter, a component-memory-only API key proven absent from storage/state/broadcasts/logs/DOM, and a single typed `np_onboarding` record whose legacy boolean is absorbed and deleted**

## Performance

- **Duration:** 37 min
- **Started:** 2026-09-21T13:54:00Z
- **Completed:** 2026-09-21T14:31:00Z
- **Tasks:** 3
- **Files modified:** 18 tracked paths across 8 commits (2,636 insertions / 126 deletions), one new canonical module beyond the plan's file list and the inventory reconciliation

## Accomplishments

- **The prototype's credential path is replaced, not ported.** `OnboardingModal.tsx` handed the API key to `useExtensionStore.updateConfig` and called a real provider endpoint; the new flow takes a typed `ProviderValidationPort`, holds the key in component state, and calls `createFixtureValidationPort(selector)` — a plain module with six canned results that imports no SDK and performs no request (proven by a zero-call `fetch` spy and a source scan). `grep -rn "fetch(" src/services/ports src/services/fixtures` is 0.
- **Every failure names the failure, never the value.** The four canonical §21.6 / Appendix C.2 codes map to the four pinned `provider.error.*` labels, cancellation is a third union member carrying **no** code, and the sentinel-absence case walks storage, serialised store state, published broadcasts, the log buffer, `document.body.textContent` and every `aria-label`/`title`/`placeholder`/`alt` in the tree.
- **One flow, both surfaces, no Chrome inside it.** `OnboardingFlow.tsx` renders the same four steps, the same state machine and the same copy for the Side Panel and Standalone; it reads no Chrome API (a case renders it with `chrome` undefined) and every colour comes from `theme.useToken()` (the `#[0-9a-fA-F]{3,6}` gate is 0, so the prototype's hard-coded `#52c41a`/`#ff4d4f` are gone).
- **The completion state is one record, and the boolean is gone.** `np_onboarding` carries the UI-complete flag, the persona, the provider identifier, the schema version and the separate `validationBacking` marker; the read is total and throw-free for `null`, strings, numbers, arrays, unknown-field objects, an incompatible version and a failed storage read, each yielding an unknown state that presents the flow. The legacy boolean is absorbed and its key deleted, and the per-origin `localStorage` fallback is removed from the extension build.
- **Nothing opens a surface automatically.** `background.ts` no longer seeds a flag on install/update; install, update and startup run the idempotent migration only, and `grep -rn "tabs.create\|sidePanel.open"` is 0.
- **The service worker stayed lean.** Splitting `useOnboardingGate` out of the store module kept React out of the background's import graph: measured against the pre-plan commit in a detached worktree, the background graph is 75,312 B → 77,740 B (+2.4 kB) instead of 86,140 B (+10.8 kB), and `content-scripts/content.js` is unchanged at 4,875 B.

## Task Commits

Each TDD task carries its RED then GREEN commit, as the plan's `tdd="true"` flags require:

1. **Task 1 RED: failing canonical provider-id, port and fixture-adapter suite** — `26b017e3` (test) — 18 collected, 9 failed
2. **Task 1 GREEN: deterministic fixture adapter and the non-secret provider types** — `1b291f8e` (feat) — 18 passed
3. **Task 2 RED: failing shared four-step onboarding flow suite** — `34f8fc42` (test) — 21 collected, 21 failed
4. **Task 2 GREEN: one shared, surface-independent four-step onboarding flow** — `a66aa09a` (feat) — 21 passed
5. **Task 3 RED: failing onboarding completion-record suite** — `b09e5bda` (test) — 15 collected, 13 failed, 2 passed
6. **Task 3 GREEN: one typed completion record mounted on both surfaces** — `08699cd5` (feat) — 16 passed
7. **Follow-up: the cancellation guard Task 2's GREEN omitted** — `144c95f8` (fix)
8. **Follow-up: `Alert`'s deprecated `message` prop** — `fb3c7f14` (fix)

**Plan metadata:** committed separately as `docs(01-09): complete … plan` (including this SUMMARY).

## Files Created/Modified

- `src/services/ports/providerValidationPort.ts` — **new**: `ProviderValidationErrorCode`, `PROVIDER_VALIDATION_ERROR_CODES`, `ProviderValidationResult` (success | coded failure | cancellation), `isValidationCancelled`, `ProviderValidationInput`, the Phase-3 `ProviderValidationPort`.
- `src/services/ports/credentialStorePort.ts` — **new**: the Phase-2 `CredentialStorePort` declaration only (no implementation, no call site).
- `src/services/fixtures/providerValidationFixtures.ts` — **new**: `FixtureValidationSelector` (six cases), the frozen canned-result map, `createFixtureValidationPort(selector)` honouring an aborted signal.
- `src/components/onboarding/OnboardingFlow.tsx` — **new**: the shared flow — typed props (`validationPort`, `surface`, `onComplete`, `onSkip`, `readOnboardingState?`, `onSwitchToFullSetup?`), one state machine, per-step focus, the always-visible announced step indicator, the masked input with a pinned-name reveal toggle, the marked fixture notices, `closable={false}`/`keyboard={false}`/`mask={{closable:false}}`.
- `src/core/onboarding/onboardingStateStore.ts` — **new**: `ONBOARDING_STORAGE_KEY`, `LEGACY_ONBOARDING_FLAG_KEY`, `ONBOARDING_SCHEMA_VERSION`, `OnboardingState`, `OnboardingReadResult`, `shouldPresentOnboarding`, `migrateOnboardingState`, `readOnboardingState`, `writeOnboardingState`, `deleteLegacyOnboardingFlag`, `migrateLegacyOnboardingFlag`, `subscribeToOnboardingState`.
- `src/core/onboarding/useOnboardingGate.ts` — **new**: the shared surface gate (`reading` | `present` | `hidden`), split out so the store module stays React-free.
- `src/types/index.ts` — `PROVIDER_IDS`/`ProviderId`, `PersistedProviderConfig`, `TransientCredentialInput`; the three prototype provider types marked `// LEGACY … plan 01-11`.
- `src/core/i18n/strings.ts` — four additive `provider.name.*` labels (and the same rows in `tests/core/i18n/strings.test.ts`'s value table).
- `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/standalone/main.tsx` — the surface gate, the fixture port and the completion/skip adapters; the Side Panel offers "Switch to Full setup" through its existing `openStandalone` path.
- `src/entrypoints/background.ts` — the legacy seeding is gone; `migrateLegacyOnboardingFlag()` runs on install, update and startup; the registration-contract comment names the migration instead of a fourth silent registration.
- `src/components/chat/SidepanelChat.tsx` — the per-origin `localStorage` fallback branch is deleted (the host itself is `01-11`'s).
- `src/components/sidepanel/SidePanelRouter.tsx` — the onboarding-branch comment corrected to point at the surface root.
- `tests/services/providerValidationFixtures.test.ts` (18), `tests/components/OnboardingFlow.test.tsx` (21), `tests/core/onboarding/onboardingStateStore.test.ts` (16) — **new**.
- `01-MIGRATION-INVENTORY.md` — thirteen rows annotated with `01-09` status notes, six rows flipped to `implemented`, one new row for `useOnboardingGate.ts`.

## Decisions Made

- **`PROVIDER_IDS` is the single source for both the union and the runtime list.** The `Select` options, the `ProviderId` type and the fixture tests all read one tuple, so the prototype's `'claude'` cannot reappear as a second spelling.
- **The legacy provider types stay resolvable and are marked, not renamed.** `aiProvider.ts` compares against `'claude'`; renaming the legacy union would have broken a live importer that `01-11` deletes. The new canonical union carries `'anthropic'` and no alias.
- **Cancellation is a third union member, not a code.** The UI-SPEC's matrix says a cancelled attempt has no error code; `{ ok: false; cancelled: true }` plus `isValidationCancelled` makes "cancelled ≠ success ≠ failure" a type-level fact.
- **The reveal toggle is a plain `Input` with an explicit `type` toggle and a `suffix` button.** antd v6's `Input.Password` hard-codes `aria-label={locale.show|hide}` on its own toggle with no override hook, and `visibilityToggle={false}` freezes `type` at `password`; the pinned `onboarding.showKey`/`hideKey` names are only reachable with an explicit control (recorded as a deviation).
- **One focus target per step.** Sharing the ref with the step footer's Continue button made the target order-dependent (React re-attaches refs per render and `useImperativeHandle` re-attaches in a later pass), which is why step 3's focus landed on the wrong control until the footer stopped claiming the ref.
- **`validationBacking: 'fixture' | 'provider'`** rather than a boolean marker: Phase 1 writes `'fixture'`, Phase 3 flips one literal, and no later phase can read Phase-1 completion as production readiness (T-1-44).
- **`writeOnboardingState` re-migrates before merging.** A skip writes `{ uiComplete: false }` and must not erase the selected provider; an incompatible stored value is replaced by the canonical shape instead of merged blindly.
- **The gate lives in the entrypoint roots, not in `SidePanelRouter`.** The flow is a modal over whichever surface the user opened, so it does not replace the router's shell branch; the router's comment was corrected and the inventory row records the divergence.
- **`useOnboardingGate` is its own module.** Measured: keeping the hook in the store put React in the background's graph (75,312 B → 86,140 B); the split brings it to 77,740 B.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A new-module suite cannot collect, so the RED half needs a skeleton**
- **Found during:** Task 1 RED (and again in Tasks 2 and 3)
- **Issue:** Vite resolves `import` at transform time, so a suite that imports a module authored in the same task fails as one module-load crash — the INVALID_RED shape plan `01-06` recorded. The plan asks for RED-then-GREEN commits on all three `tdd="true"` tasks.
- **Fix:** each RED commit carries the suite plus a skeleton module (declaration-only for the ports, wrong-value stubs for the adapters) so the suite collects and each case fails on its own assertion; the GREEN commit replaces the skeleton with the implementation. RED runs: 18 collected/9 failed, 21 collected/21 failed, 15 collected/13 failed.
- **Files modified:** the three suites and the three new modules (skeleton → implementation).
- **Committed in:** `26b017e3`, `34f8fc42`, `b09e5bda` (RED) and `1b291f8e`, `a66aa09a`, `08699cd5` (GREEN)

**2. [Rule 2 - Missing critical functionality] Task 2's GREEN commit omitted a file it depends on**
- **Found during:** Task 3, `git status` before its GREEN commit
- **Issue:** `OnboardingFlow.tsx` imports `isValidationCancelled` from the port module, but the port module's change was not staged in Task 2's GREEN commit — that commit does not typecheck on its own.
- **Fix:** a follow-up commit adds the type-predicate guard with the reason it belongs to Task 2's change set.
- **Files modified:** `src/services/ports/providerValidationPort.ts`
- **Verification:** `npx tsc --noEmit` exit 0 on the committed tree; the flow's cancellation branch and its suite case both use the guard.
- **Committed in:** `144c95f8`

**3. [Rule 2 - Missing critical functionality] The shared module's hook put React in the service worker's graph**
- **Found during:** Task 3, measuring `wxt build` after wiring `background.ts`
- **Issue:** `background.ts` imports `migrateLegacyOnboardingFlag` from the store module; with `useOnboardingGate` in that module the service worker's import graph pulled React (`_virtual_wxt-plugins` chunk 69,621 B → 80,640 B).
- **Fix:** the hook moved to `src/core/onboarding/useOnboardingGate.ts`; the store module is React-free. Measured in a detached worktree against the pre-plan commit: background graph 75,312 B → 77,740 B (the record module only), content script unchanged at 4,875 B.
- **Files modified:** `src/core/onboarding/useOnboardingGate.ts` (new), `src/core/onboarding/onboardingStateStore.ts`, both surface roots, `01-MIGRATION-INVENTORY.md` (new row)
- **Verification:** `npx wxt build` succeeds; `grep -c useState` over the background's shared chunk is 0; full suite green.
- **Committed in:** `08699cd5`

**4. [Rule 1 - Bug] antd v6 deprecated `Alert.message`**
- **Found during:** the plan-level `verify:phase-1` run, which printed `Warning: [antd: Alert] 'message' is deprecated. Please use 'title' instead.` on every render of the validation step
- **Issue:** the fixture-reason marker passed its copy through the deprecated prop, so every onboarding validation step logged a console deprecation.
- **Fix:** the marker now passes the pinned copy through `title`.
- **Files modified:** `src/components/onboarding/OnboardingFlow.tsx`
- **Verification:** the warning is gone from the suite output; 21 flow cases still pass; `npx tsc --noEmit` exit 0.
- **Committed in:** `fb3c7f14`

**5. [Rule 1 - Gate defect] Two grep-shaped gates tripped on their own provenance prose**
- **Found during:** Task 3's plan-level gates
- **Issue:** `grep -rn "tabs.create\|sidePanel.open" src/entrypoints/background.ts` returned 1 for a comment that *said* no such call exists, and the legacy-literal scan counted the background's comment naming the removed key. Plan `01-05` recorded the same class of correction.
- **Fix:** both comments were reworded to carry the same provenance without the grep-shaped token. Raw readings: `onboardingComplete` in `src/entrypoints` + `src/core` = 2 (both inside the store module — the constant and its note), scoped reading (excluding that module) = 0; the auto-open grep is 0.
- **Files modified:** `src/entrypoints/background.ts`
- **Verification:** both gates read 0 on the committed tree.
- **Committed in:** `08699cd5`

**6. [Rule 2 - The plan's own file set could not reach the mount point] The onboarding branch landed in the surface roots, not `SidePanelRouter`**
- **Found during:** Task 3, choosing the mount point
- **Issue:** plan `01-02` reserved the onboarding branch for `src/components/sidepanel/SidePanelRouter.tsx` ("adds the onboarding branch here — and only here"), but plan `01-09`'s `files_modified` lists the entrypoint roots and not the routers; mounting inside `StandaloneShell` would also have changed the shell's existing suite (the modal's markers would appear in every shell test).
- **Fix:** the gate and the flow mount in each surface root (`SidePanelSurface`/`StandaloneSurface`), the flow presents as a modal over whichever surface the user opened, and `SidePanelRouter`'s comment was corrected to describe the actual arrangement. Recorded in the inventory row for `SidePanelRouter.tsx`.
- **Files modified:** `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/standalone/main.tsx`, `src/components/sidepanel/SidePanelRouter.tsx` (comment), `01-MIGRATION-INVENTORY.md`
- **Verification:** the store suite's source-scan case asserts both roots render `OnboardingFlow` and gate on the record; 01-02's shell suites are untouched and still pass.
- **Committed in:** `08699cd5`

**7. [Rule 2 - The plan's suite needed an instrument correction] Two source scans were too coarse**
- **Found during:** Task 3, first run of the completion-record suite
- **Issue:** the per-origin-fallback scan flagged any file that mentions both `localStorage` and `onboardingComplete` (prose and unrelated `localStorage` use), and an invented "the legacy literal appears in one module" case flagged the prototype host that `01-11` still owns.
- **Fix:** the scans now strip comments first, the fallback scan looks for the two tokens in one expression, and the second scan was replaced by a real single-writer gate ("the new key is named in exactly one module") plus a surface-mount case.
- **Files modified:** `tests/core/onboarding/onboardingStateStore.test.ts`
- **Verification:** 16 cases pass on the committed tree.
- **Committed in:** `08699cd5`

---

**Total deviations:** 7 (5 auto-fixed for blocking/critical reasons, 1 gate-instrument correction, 1 mount-point correction)
**Impact on plan:** Every deviation was required for the plan's own gates to hold or for the tree to typecheck. Two structural departures are recorded for the phase acceptance review: `useOnboardingGate.ts` (a new module the plan did not list, required by a measured service-worker budget) and the mount point (the surface roots rather than `SidePanelRouter`). No dependency was added or bumped (`antd@6.5.2` untouched), no later-phase capability was implemented, and no other plan's owned file was changed beyond the two edits this plan's own action instructed (`SidepanelChat.tsx`'s fallback branch) and the two comment corrections recorded above.

## Issues Encountered

- **antd's `Input.Password` cannot carry the pinned accessible name.** Its toggle hard-codes `aria-label={locale.show|hide}` and `visibilityToggle={false}` freezes the input `type`, so the UI-SPEC's `Input.Password` requirement and the pinned show/hide names are mutually exclusive in v6. The flow uses a plain `Input` with an explicit `type` toggle and a named `suffix` button; recorded as a decision and a deviation.
- **`useImperativeHandle` re-attaches refs in a later pass than element refs.** The step-3 focus assertion failed until the footer's Continue button stopped claiming the same ref; the fix is "one focus target per step", not a timing workaround.
- **jsdom logs `Not implemented: window.getComputedStyle(elt, pseudoElt)` through `console.error`** (rc-scroll-locker), so the unmount case asserts on the absence of React's unmounted-update warning specifically rather than on `console.error` never being called.
- **The plan's own `files_modified` set could not reach the flow's mount point** (see deviation 6).

## Known Stubs

None — no placeholder value, empty collection or unwired data source was introduced. The persona step renders a marked `data-np-backing="fixture"` preview card with the `deferred.*` copy rather than a fake selector (RICH-R-03 is Phase 15), and the validation step's `Alert` carries `deferred.reasonFixture` so the fixture backing is disclosed rather than implied. `OnboardingState.persona` stays `null` in Phase 1 for the same reason, which D-06 permits.

**Broken-windows ledger:** two entries were appended for the phase acceptance review — `WINDOWS.md` id 7 (`unrun-verify`: the 400 px modal-copy backstop) and id 8 (`unrun-verify`: the two-live-surface onboarding check). No stub, skipped test, TODO or FIXME was left behind.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: local_record_readability | `src/core/onboarding/onboardingStateStore.ts` | The completion record lives in `chrome.storage.local`, which every extension page can read. It is non-secret by construction (the UI-complete flag, a persona string, a provider identifier, a version and a fixture marker), and the type has no field that can carry a credential — but a future phase adding a field here must keep that property, which the record-shape case in the suite enforces. |

## User Setup Required

None — no external service configuration, no dependency installed or bumped.

## Next Phase Readiness

- **`01-10` (credential strip)**: `TransientCredentialInput` deliberately names its in-memory field `credential`, not one of the recognised persisted names (`apiKey`, `token`, `accessToken`, `secret`), so a scan for the persisted names will not false-positive on the compliant in-memory type. The four `provider.error.*` labels are the `{error}` slot values.
- **`01-11` (prototype hosts)**: the last consumers of the legacy `onboardingComplete` Chrome-storage key are `src/components/chat/SidepanelChat.tsx` (fallback removed, host deleted there) and `src/components/OnboardingModal.tsx` (superseded by `OnboardingFlow.tsx`). Deleting both removes the last code path that writes a boolean beside the record.
- **`01-12` (shells/pages)**: `DeferredNotice` should replace the three inline `data-np-backing="fixture"` markers this plan authored in `OnboardingFlow.tsx` (persona card, credential input wrapper, validation-step `Alert`) when the shared component lands — the copy and the marker values already match the convention.
- **`01-13` (gates)**: `tests/services/` is a new test directory (planner assumption P6) — `verify:phase-1` must add it to its path list or the fixture suite will not run in the gate; the plan's own verification used the three suites explicitly. The instruments to extend are the sentinel-absence case, the `#[0-9a-fA-F]{3,6}` colour gate over `src/components/onboarding/`, the `chrome.` gate over the same path, the auto-open grep over `background.ts`, and the two source scans in the completion-record suite.
- **Phase 2**: `CredentialStorePort` is ready to implement (declaration only, zero call sites) and `OnboardingState.validationBacking` is the field to flip when credentials become securely stored; the record has no credential field to migrate.
- **Phase 3**: `ProviderValidationPort` is the swap point — replacing `createFixtureValidationPort('success')` with the real implementation is a one-line change in each surface root, and the four canonical codes are already the flow's failure vocabulary.
- **Phase acceptance review**: three items are recorded — the mount-point divergence (deviation 6), the `Input`-vs-`Input.Password` accessibility trade-off (deviation 4's decision), and the two unrun browser checks (`WINDOWS.md` ids 7 and 8).

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Files created (9 of 9): `src/services/ports/providerValidationPort.ts`, `src/services/ports/credentialStorePort.ts`, `src/services/fixtures/providerValidationFixtures.ts`, `src/components/onboarding/OnboardingFlow.tsx`, `src/core/onboarding/onboardingStateStore.ts`, `src/core/onboarding/useOnboardingGate.ts`, `tests/services/providerValidationFixtures.test.ts`, `tests/components/OnboardingFlow.test.tsx`, `tests/core/onboarding/onboardingStateStore.test.ts`.
- Files modified present (9 of 9): `src/types/index.ts`, `src/core/i18n/strings.ts`, `src/entrypoints/{sidepanel,standalone}/main.tsx`, `src/entrypoints/background.ts`, `src/components/chat/SidepanelChat.tsx`, `src/components/sidepanel/SidePanelRouter.tsx`, `tests/core/i18n/strings.test.ts`, `01-MIGRATION-INVENTORY.md`.
- Commits present: `26b017e3`, `1b291f8e`, `34f8fc42`, `a66aa09a`, `b09e5bda`, `08699cd5`, `144c95f8`, `fb3c7f14` (8 of 8, measured with `git rev-list --count 92cdfe00..HEAD`).
- Fresh verification on the committed tree: `npx tsc --noEmit` exit 0; `npx vitest run` 27 files / 384 tests passed; `npx vitest run tests/services tests/core/onboarding tests/components/OnboardingFlow.test.tsx` 55 passed; `pnpm run verify:phase-1` green (366 tests + `verify-no-tailwind` exit 0); `grep -rn "chrome\." src/components/onboarding/` → 0; `grep -rEn "#[0-9a-fA-F]{3,6}" src/components/onboarding/` → 0; `grep -rn "tabs.create\|sidePanel.open" src/entrypoints/background.ts` → 0; `grep -rn "onboardingComplete" src/entrypoints src/core | grep -v onboardingStateStore` → 0; `grep -rn "fetch(" src/services/ports src/services/fixtures` → 0; `grep -rn "CredentialStorePort" src/` outside the port file → 0; `npx wxt build` succeeds with a 77,740 B background graph and a 4,875 B content script.
