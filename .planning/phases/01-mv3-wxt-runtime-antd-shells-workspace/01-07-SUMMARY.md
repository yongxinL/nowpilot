---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 07
subsystem: workspace-handoff
tags: [workspace-state, zod-strict-schema, frozen-contract, broadcastbus, handoff-protocol, request-correlation, ack-gated-success, url-bootstrap, no-persistence, writer-adapter, mirror-inactive, tdd, bundle-budget]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-06's canonical `MessageType` registry and sender guard, plus the `OperationId` helper bound into it
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-05's theme contract and 01-04's canonical string map (`workspace.handoffPending` / `standalone.openFailed`)
provides:
  - "`WorkspaceState` — the frozen §8.4 shape with `workspaceStateSchema` (strict), `createInitialWorkspaceState`, `parseWorkspaceState` and a total/deterministic/idempotent `migrateWorkspaceState`"
  - "`WORKSPACE_STATE_SCHEMA_VERSION` and the three-axis version distinction (`schemaVersion` / `version` / `updatedAt`) documented in the type"
  - "`handoff/protocol.ts` — `HandoffEnvelope` (ready / transfer / ack) on the `BroadcastBus` channel, with none of its literals *added* to `MessageType` (`HANDOFF_READY` and `HANDOFF_ACK` are absent from the registry; the pre-existing `WORKSPACE_HANDOFF` literal there is 01-06's Appendix E runtime-envelope type, a different domain — see Deviations 7); `Phase1HandoffProjection` + its strict schema; `HANDOFF_SCHEMA_VERSION` / `HANDOFF_TIMEOUT_MS` / `HANDOFF_MAX_RETRIES`"
  - "`buildHandoffUrl` / `parseHandoffUrl` — the allowlisted URL bootstrap with one typed code per rejection reason, plus `createHandoffInitiator` / `createHandoffTarget` state machines"
  - "`useWorkspaceHandoff.ts` — `createWorkspaceHandoffSource` / `createWorkspaceHandoffTarget`, surface-independent, no Chrome API, unsubscribing"
  - "`WorkspaceStore` with no persistence and only the authorised Phase-1 mutators; the inactive Phase-1 writer adapter and the frozen writer/mirror vocabulary"
  - "`deleteLegacyWorkspaceBlob()` — the stale-key removal helper, import-free so the background bundle stays lean"
  - "`WorkspaceRouter` with ack-gated success, a validated bootstrap and the Standalone options route"
  - "Removals: `WorkspaceSync.ts`, the `np_workspace_store` persist block, the prototype model-selector setters"
affects: [01-08, 01-09, 01-11, 01-12, 01-13, 02, 15]

actuals:
  tokens: 34004    # chars/4 over the realized diff (git diff -U0 2f97bff..HEAD -- src tests = 136,016 chars)
  tasks: 3
  commits: 5       # measured: git rev-list --count 2f97bff..HEAD
  plan_head_before: 2f97bffa8b6f8487c866c859397af95c37f3881b

tech-stack:
  added: []
  patterns:
    - "One shape, one strict schema, one typed failure path: `.strict()` at every boundary, bounded lengths on every string, literal-null for inert contextual objects, and a parser that never throws"
    - "A migration reads no clock and invents no write: deterministic output means migrating twice is deep-equal, and salvaging field-by-field means one bad value never discards the rest"
    - "Correlated ephemeral messaging: subscribe before opening the target, publish only after a matching ready, claim success only on a validated acknowledgement — a fire-and-forget broadcast cannot prove delivery"
    - "Identity is bootstrap-derived: the target ignores any message whose workspaceId, requestId or targetSurface differs from its own URL bootstrap (a same-origin page can publish on the channel)"
    - "Idempotency on the correlation id: a duplicate transfer is re-acknowledged but never re-applied, so a source retry can complete"
    - "Surface independence through adapters: a shared controller takes its navigation and application paths as typed parameters rather than calling Chrome, and returns a disposer the surface gives to `useEffect`"
    - "A bundle cost is a verification signal: an import-free module keeps zustand/immer out of the service worker for a one-line storage removal"

key-files:
  created:
    - src/core/workspace/WorkspaceState.ts
    - src/core/workspace/handoff/protocol.ts
    - src/core/workspace/handoff/useWorkspaceHandoff.ts
    - src/core/workspace/legacyWorkspaceBlob.ts
    - tests/core/workspace/WorkspaceState.test.ts
    - tests/core/workspace/WorkspaceHandoff.test.ts
  modified:
    - src/core/workspace/WorkspaceStore.ts
    - src/core/workspace/WorkspaceRouter.ts
    - src/components/chat/SidepanelChat.tsx (the last `WorkspaceSync` importer, rewired)
    - src/entrypoints/background.ts (startup legacy-blob deletion)
    - src/components/standalone/StandaloneShell.tsx (target lifecycle)
    - tests/core/workspace/WorkspaceRouter.test.ts
    - tests/core/workspace/WorkspaceStore.test.ts
    - .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md (own rows + one new row)
  removed:
    - src/core/workspace/WorkspaceSync.ts

key-decisions:
  - "The title of every boundary is the schema, not the caller's intent: `parseWorkspaceState` classifies `unrecognized_keys` as `unknown_field` and a bad `schemaVersion` as `unsupported_schema_version`, so a violation names itself."
  - "The migration base is a module-level state with `updatedAt: 0` and a per-process minted workspace id. Deriving `updatedAt` from `Date.now()` would have made two migrations of the same input unequal, i.e. non-deterministic."
  - "`activeProvider` / `selectedModel` accept a bounded identifier-shaped value (so a future phase can widen them) but reject a credential shape at the field's own constraint — the `openai` case parses, an `sk-…` value does not."
  - "The initiator/target state machines live in `protocol.ts` and the surface controllers in `useWorkspaceHandoff.ts`. Task 2's suite is the one that must prove ready-before-transfer, timeout, retry and the ack gate, so the machinery had to exist at Task 2's module boundary; the controllers are the thin surface-independent binding."
  - "`HandoffOpenTargetArgs` carries only `requestId` / `workspaceId` / `page`; the conversation id reaches the URL through the router's closure. The bootstrap identifier travels; the draft never does."
  - "`openStandalone` keeps its positional signature and its `{ ok: true } | { ok: false; error }` settled shape, extended with a typed `code`. That kept `src/entrypoints/sidepanel/main.tsx` compiling and unmodified — the UI's pinned copy and Retry rendering is a UI-plan concern, not the router's."
  - "The ack's failure arm is `{ ok: false; code; error }` with a required bounded `error`: the code is the recovery contract and the message is what a surface may log, with no value or payload in it."
  - "`deleteLegacyWorkspaceBlob` was extracted to an import-free module during verification. Importing the store into the background grew its graph 73.0 kB → 95.3 kB (zustand/immer); the extraction brought the graph back to 75.3 kB. `WorkspaceStore` re-exports the helper so the plan's artifact contract still holds."
  - "The Phase-1 writer contract is `PHASE1_WRITER_STATE = 'primary'` plus the frozen six-value vocabulary and `isMirrorState`. Nothing transitions out of `primary`, and the adapter's comment states it is a Phase-1 adapter reporting writability — not an election, epoch, identity, acknowledgement or demotion."
  - "`hydrateFromURL` returns the target controller's disposer, and `StandaloneShell` returns it from its mount effect. A direct open with no bootstrap is a no-op; a rejected URL logs its code only (never the parameter name or value) and applies nothing."

patterns-established:
  - "A strict-schema test asserts the exact read of the failure: `unknown_field` for an extra key, `unsupported_schema_version` for a bad version, `not_an_object` for null/string/number/array — the typed path is the contract, not just `ok: false`"
  - "A protocol suite drives inbound traffic through the `__broadcast` helper and observes outbound through a `BroadcastBus.publish` spy, so the transport seam is exercised rather than mocked away"
  - "A timeout test advances fake timers by exactly `HANDOFF_TIMEOUT_MS` per attempt and asserts the published-attempt count against `1 + HANDOFF_MAX_RETRIES` — the retry budget is pinned, not described"
  - "A source-scan case enforces the no-write rule (`grep`-equivalent over `src/**`) so a future persistence regression fails in the suite rather than in review"
  - "A lifecycle wiring between a router module and a React shell is a returned disposer, so the effect's cleanup is the controller's unsubscribe"

requirements-completed: [SP-02, FLOW-11]

coverage:
  - id: D1
    description: "`WorkspaceState` is the frozen §8.4 shape — every D-11 field plus `version` and `updatedAt` and no other field — validated by a `.strict()` schema with bounded lengths and literal-null contextual objects."
    requirement: "SP-02"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceState.test.ts (16 cases: exact field set, safe defaults, JSON-string round trip, unknown/missing field rejection, never-throw parse, provider-key rejection)"
        status: pass
      - kind: other
        ref: "grep -n \"strict()\" src/core/workspace/WorkspaceState.ts | wc -l → 4"
        status: pass
    human_judgment: false
  - id: D2
    description: "The migration is total, deterministic and idempotent: null, {}, a legacy partial object and a primitive each migrate to a usable state without throwing; the same input is deep-equal twice; its own output is unchanged; unknown keys and invalid values are discarded."
    requirement: "SP-02"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceState.test.ts#is total … / #is deterministic … / #is idempotent … / #discards unknown keys and invalid field values …"
        status: pass
    human_judgment: false
  - id: D3
    description: "The handoff is a three-message correlated exchange on `BroadcastBus`: the transfer is published only after a matching ready, success is claimed only after a validated acknowledgement, and no handoff literal was added to `MessageType`."
    requirement: "FLOW-11"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceHandoff.test.ts (30 cases: constants, cold start ready-before-transfer, duplicate ready, ack gate, ack mismatch, failure ack, timeout+retry, bounded attempts, no-ready failure, nav failure) + tests/core/workspace/WorkspaceRouter.test.ts#publishes the transfer only after readiness …"
        status: pass
      - kind: other
        ref: "grep -c \"'HANDOFF_READY'\" src/core/runtime/RuntimeEnvelope.ts → 0; grep -c \"'HANDOFF_ACK'\" src/core/runtime/RuntimeEnvelope.ts → 0; the registry is unmodified by this plan (git diff 2f97bff..HEAD -- src/core/runtime → empty)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The URL carries only the approved bootstrap identifiers and fails closed: unknown, malformed, oversized, unsupported-version and non-canonical-surface parameters each get a distinct typed code, and no draft, credential or workspace state can reach the URL from an over-wide input."
    requirement: "FLOW-11"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceHandoff.test.ts#buildHandoffUrl produces exactly the allowed bootstrap parameter set / #never emits a draft … / #rejects an unknown parameter … / #oversized … / #unsupported schema version … / #invalid source or target surface; tests/core/workspace/WorkspaceRouter.test.ts#fails closed on an unknown parameter and applies nothing"
        status: pass
      - kind: other
        ref: "grep -rn \"composerDraft\" src/core/workspace/handoff/protocol.ts | grep -c \"searchParams\\|URLSearchParams\" → 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase 1 persists no workspace state: no persist middleware, no workspace storage key, a source scan that fails if a module names one for writing, and the stale prototype key deleted on startup by an import-free helper."
    requirement: "SP-02"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceStore.test.ts#has no persist middleware … / #writes nothing to chrome.storage when state changes / #source scan: no Phase-1 module names a workspace storage key for writing / #deletes the stale prototype workspace blob on startup"
        status: pass
      - kind: other
        ref: "grep -rn \"np_workspace\" src/ | grep -v \"np_workspace'\" | grep -vi \"legacy\" | wc -l → 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "Only the authorised Phase-1 producers are exposed as mutators; the prototype model-selector setters are gone; the Phase-1 writer adapter reports writable while claiming no election, epoch, identity, acknowledgement or demotion, and nothing transitions into `mirror`."
    requirement: "SP-02"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceStore.test.ts#exposes only the authorised Phase-1 mutators / #reports the surface writable without claiming an election / #freezes the canonical writer vocabulary and stays out of every mirror state"
        status: pass
      - kind: other
        ref: "grep -rn \"setSelectedModel\\|setActiveProvider\" src/ tests/ | wc -l → 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "Opening Standalone dedupes and focuses an existing tab (cross-window), creates exactly one when none exists, records its id, never duplicates on a repeated open, and reports typed `STANDALONE_OPEN_FAILED` / `WORKSPACE_HANDOFF_FAILED` instead of success when the open or the handshake fails."
    requirement: "FLOW-11"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceRouter.test.ts (18 cases: dedupe/focus, create-once, cross-window focus, openedStandaloneTabId, repeated-open no-duplicate, query/create lastError, ack-gated success, timeout-and-retry, bounded-attempt failure, fail-closed hydrate, foreign-workspace rejection)"
        status: pass
      - kind: other
        ref: "grep -rn \"WorkspaceSync\" src/ tests/ | wc -l → 0; test ! -f src/core/workspace/WorkspaceSync.ts → absent"
        status: pass
    human_judgment: false
  - id: D8
    description: "The handoff controllers are surface-independent: no Chrome API in `useWorkspaceHandoff.ts`, navigation and application arrive as typed adapters, and `dispose()` unsubscribes (wired into the Standalone shell's effect cleanup)."
    requirement: "FLOW-11"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceHandoff.test.ts#announces readiness on start … / #does not apply a duplicate transfer twice but still acknowledges it / #ignores a projection for a different workspace …; tests/core/workspace/WorkspaceRouter.test.ts#announces readiness for a validated handoff bootstrap …"
        status: pass
      - kind: other
        ref: "grep -n \"chrome\\.\" src/core/workspace/handoff/useWorkspaceHandoff.ts → 0"
        status: pass
    human_judgment: true
    rationale: "The suite proves the controller contracts, the store effects and the published envelopes in one realm. The real cross-surface observation — two live Chrome surfaces, a cold Standalone tab announcing readiness before the Side Panel publishes, and the pinned pending/complete/failed copy in the UI — needs a browser and the UI plans (01-08/01-12) and belongs to the phase acceptance check."

# Metrics
duration: 18min
completed: 2026-09-21
status: complete
---

# Phase 1 Plan 07: Frozen Workspace Contract, Correlated Handoff and Ack-Gated Open Summary

**The canonical §8.4 `WorkspaceState` frozen behind a strict Zod schema with a no-clock deterministic migration, a ready → transfer → acknowledgement handshake on `BroadcastBus` whose success is claimed only on a validated acknowledgement — and no workspace persistence anywhere in Phase 1**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-21T13:15:21Z
- **Completed:** 2026-09-21T13:33:25Z
- **Tasks:** 3
- **Files modified:** 14 tracked paths across 5 commits (2,850 insertions / 469 deletions), one file removed and the inventory rows reconciled

## Accomplishments

- **The shape is frozen and every boundary is guarded.** `workspaceStateSchema` is `.strict()` with bounded lengths on every string, `z.null()` on the three inert contextual objects, and a credential-shape guard on `activeProvider`/`selectedModel`. `parseWorkspaceState` normalises the persisted JSON representation, never throws, and returns a code that names the violation (`unknown_field`, `unsupported_schema_version`, `not_an_object`, `invalid_shape`).
- **The migration cannot throw and cannot drift.** `migrateWorkspaceState` merges over a base that reads no clock (`updatedAt: 0`, one minted workspace id per process), stamps `schemaVersion` itself, discards unknown keys, and salvages each recognised field independently — proven deep-equal across runs and unchanged on its own output. The three-axis version story (`schemaVersion` = shape, `version` = Phase 2's write counter, `updatedAt` = staleness) is documented where the type is defined.
- **The handoff is correlated, not fire-and-forget.** The source subscribes **before** it opens the target, publishes the projection only after a matching `HANDOFF_READY`, and resolves success only on a validated `HANDOFF_ACK`; a missing ready or a missing ack is a typed recoverable failure after a bounded wait (`HANDOFF_TIMEOUT_MS` = 3000) with a bounded retry budget (`HANDOFF_MAX_RETRIES` = 2, three attempts total, asserted by test). A definitive failure ack is not retried.
- **Duplicates are idempotent on `requestId`.** The target applies a projection at most once and re-acknowledges a duplicate transfer so a source retry can complete; the initiator ignores a duplicate ready, a mismatched ack and any message whose `workspaceId`, `requestId` or `targetSurface` is not its own.
- **The URL is an identifier channel with one typed rejection path.** `buildHandoffUrl` sets each parameter explicitly from the allowlist (never spreading its input), so an over-wide caller object cannot leak a draft or a credential; `parseHandoffUrl` rejects unknown, malformed, oversized (never truncated) and unsupported-version parameters plus non-canonical surfaces, and treats an empty `conversationId` as a valid `null`.
- **Phase 1 writes no workspace state.** The persist middleware and `np_workspace_store` block are gone, `setActiveProvider`/`setSelectedModel` no longer exist, only the four authorised mutators (plus `reset`) remain, and a source-scan test fails if any Phase 1 module names a workspace key for writing. The stale prototype key is deleted on startup from an import-free module — measured to keep the background graph at 75.3 kB instead of 95.3 kB.
- **The Phase-1 writer adapter claims nothing it cannot prove.** `PHASE1_WRITER_STATE = 'primary'` with the frozen six-value vocabulary and `isMirrorState`; no code path transitions into `mirror`, and no election result, epoch, writer identity, persistence acknowledgement or demotion is fabricated.
- **Standalone opens dedupe, validate and gate.** `openStandalone` keeps the callback-style `tabs.query`/`update`/`create` shape with every `chrome.runtime.lastError` branch and cross-window focus, records `openedStandaloneTabId`, creates exactly one tab for a repeated request, and reports `STANDALONE_OPEN_FAILED` / `WORKSPACE_HANDOFF_FAILED` instead of success. `openOptions` now targets the Standalone options route rather than the removed `options.html`.

## Task Commits

Each task was committed atomically; both TDD tasks carry their RED then GREEN commit:

1. **Task 1 RED: failing canonical WorkspaceState contract suite** — `80c26d9` (test)
2. **Task 1 GREEN: frozen strict `WorkspaceState` + total migration** — `c2c1a22` (feat)
3. **Task 2 RED: failing handoff protocol and URL bootstrap suite** — `29ba753` (test)
4. **Task 2 GREEN: the ready/transfer/ack protocol** — `30d9170` (feat)
5. **Task 3: non-persisted store, ack-gated router, handoff controllers** — `17f9fe3` (feat)

**Plan metadata:** committed separately as `docs(01-07): complete … plan`.

## Files Created/Modified

- `src/core/workspace/WorkspaceState.ts` — **new**: `WORKSPACE_STATE_SCHEMA_VERSION`, the frozen `WorkspaceState` interface (D-11 + `version` + `updatedAt`), `workspaceStateSchema` (`.strict()`, bounded, `z.null()` contextual objects, credential-shape guard), `createInitialWorkspaceState()`, `parseWorkspaceState()` with typed error codes, and the total/deterministic/idempotent `migrateWorkspaceState()`.
- `src/core/workspace/handoff/protocol.ts` — **new**: `HANDOFF_CHANNEL`, `HANDOFF_SCHEMA_VERSION`, `HANDOFF_TIMEOUT_MS`, `HANDOFF_MAX_RETRIES`, `HANDOFF_MAX_VALUE_CHARS`, `HANDOFF_DRAFT_MAX_CHARS`; the three-member `HandoffEnvelope` union; the strict eight-field `Phase1HandoffProjection` + schema; `validateHandoffEnvelope`; `buildHandoffUrl` / `parseHandoffUrl`; `handoffTransport`; `createHandoffInitiator` / `createHandoffTarget`.
- `src/core/workspace/handoff/useWorkspaceHandoff.ts` — **new**: `createWorkspaceHandoffSource` (navigation via the injected `openTarget` adapter) and `createWorkspaceHandoffTarget` (application via the injected `apply` adapter). No Chrome API; `dispose()` unsubscribes.
- `src/core/workspace/legacyWorkspaceBlob.ts` — **new**: `LEGACY_WORKSPACE_STORAGE_KEY` + `deleteLegacyWorkspaceBlob()`, import-free so the service worker stays lean.
- `src/core/workspace/WorkspaceStore.ts` — the persist middleware, storage key and `workspaceMigrate` are gone; the canonical state is the store's own state; `setConversationId` accepts `null`; every mutator bumps `version` + `updatedAt`; the Phase-1 writer adapter and the frozen writer/mirror vocabulary are exported inactive; the legacy-blob helper is re-exported.
- `src/core/workspace/WorkspaceRouter.ts` — `buildHandoffUrl`/`parseHandoffUrl` replace the ad-hoc URL work; the old fire-and-forget notice publish is gone; `openStandalone` runs the source controller with the tab navigation as its adapter and calls `onSettled` once with the typed result; `openOptions` targets `standalone.html?page=options`; `hydrateFromURL` validates, hydrates and returns the target's disposer.
- `src/core/workspace/WorkspaceSync.ts` — **removed** (superseded by `handoff/protocol.ts`); its last importer, `src/components/chat/SidepanelChat.tsx`, no longer subscribes to a workspace broadcast, so no Phase-1 path mounts `MirrorBanner` (D-12). That host is removed entirely in `01-11`.
- `src/entrypoints/background.ts` — `deleteLegacyWorkspaceBlob()` runs on every wake; the file's registration-contract comment now states it as a removal-only step rather than a fourth silent registration.
- `src/components/standalone/StandaloneShell.tsx` — the mount effect returns `hydrateFromURL(...)`, so the target controller unsubscribes on unmount.
- `tests/core/workspace/WorkspaceState.test.ts` — **new**, 16 cases.
- `tests/core/workspace/WorkspaceHandoff.test.ts` — **new**, 30 cases.
- `tests/core/workspace/WorkspaceRouter.test.ts` — 10 → 18 cases.
- `tests/core/workspace/WorkspaceStore.test.ts` — 12 → 17 cases.
- `01-MIGRATION-INVENTORY.md` — nine owned rows annotated and marked `implemented`, plus a new row for `legacyWorkspaceBlob.ts`.

## Decisions Made

- **`parseWorkspaceState` classifies the failure, not just the fact.** `unrecognized_keys` → `unknown_field`; a `schemaVersion` path → `unsupported_schema_version`; a non-object → `not_an_object`; everything else `invalid_shape`. The typed path is what a caller can act on.
- **The migration base pins `updatedAt` to `0` and mints one workspace id per process.** Using `Date.now()` would have made "migrate the same input twice" unequal, contradicting the plan's determinism requirement, and a per-call UUID would have done the same for `workspaceId`.
- **`activeProvider` / `selectedModel` parse a bounded slug but reject a credential shape.** The `<behavior>` case requires `{...valid, activeProvider: 'openai'}` to parse while a provider-key-shaped value is rejected — so the constraint is a slug regex plus an explicit `sk|pk|api-key|key|token|bearer` prefix guard, not a null-only field.
- **The state machines live in `protocol.ts`, the surface controllers in `useWorkspaceHandoff.ts`.** Task 2's suite owns the cold-start, duplicate, timeout, retry and ack-gate cases, so the correlator had to exist at Task 2's module boundary; Task 3's controllers are the thin surface-independent binding the plan names, and their adapters are the only path to Chrome.
- **`openStandalone` keeps its positional signature and settled shape.** Extending the failure arm with `code` (rather than changing the union) left `src/entrypoints/sidepanel/main.tsx` compiling and unmodified — the pinned `standalone.openFailed` copy and `Retry` rendering belong to the UI plans.
- **The conversation id reaches the bootstrap through the router's closure, not through `HandoffOpenTargetArgs`.** The navigation adapter needs only the request id, workspace id and page; the draft travels exclusively through the validated ephemeral projection.
- **`deleteLegacyWorkspaceBlob` moved to an import-free module after measurement.** Importing `WorkspaceStore` into the background for a one-line removal grew the background graph 73.0 kB → 95.3 kB (zustand + immer); the extraction restored it to 75.3 kB. `WorkspaceStore` re-exports the helper, so the plan's artifact contract is unchanged.
- **`hydrateFromURL` returns a disposer instead of starting a controller with no lifecycle.** `StandaloneShell.tsx` already called it from a mount effect, so returning the target's `dispose` makes the unsubscribe a one-line change and keeps the target alive for the tab's lifetime.
- **`MirrorBanner` is left structurally unmounted by removing its only state source.** `SidepanelChat`'s `mirrored` flag can no longer become `true` (the subscription is gone), so no Phase-1 path renders the banner; removing the host file itself is `01-11`'s row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deleting `WorkspaceSync.ts` breaks its last importer and the typecheck**
- **Found during:** Task 3, removing the superseded module
- **Issue:** `src/components/chat/SidepanelChat.tsx` imported `onWorkspaceSync` and subscribed to `WORKSPACE_HANDOFF` to set its `mirrored` flag. The plan requires `grep -rn "WorkspaceSync" src/ tests/` to return zero **and** `npx tsc --noEmit` to exit 0, so the import could not survive.
- **Fix:** the import block and the subscription effect were removed, leaving a comment that records why Phase 1 mounts no mirror banner. The file's `mirror-state` render guard can no longer become true.
- **Files modified:** `src/components/chat/SidepanelChat.tsx`
- **Verification:** `grep -rn "WorkspaceSync" src/ tests/` → 0; `npx tsc --noEmit` → 0; full suite 327 passed.
- **Committed in:** `17f9fe3`

**2. [Rule 3 - Blocking] The plan's `openStandalone` never puts `conversationId` in the URL**
- **Found during:** Task 3, the create-path case asserting the approved bootstrap parameter set
- **Issue:** the navigation adapter (per the protocol's `HandoffOpenTargetArgs`) receives only `requestId`/`workspaceId`/`page`, so the conversation id never reached `buildHandoffUrl`. D-13 lists `conversationId` as an approved bootstrap identifier when available, and the URL is the only place the target can learn it before the handshake.
- **Fix:** `focusOrCreateStandaloneTab` takes the conversation id from the router's closure and passes it to `buildHandoffUrl`; the projection/draft path is untouched.
- **Files modified:** `src/core/workspace/WorkspaceRouter.ts`, `tests/core/workspace/WorkspaceRouter.test.ts`
- **Verification:** the create-path case asserts the exact parameter set including `conversationId=c1`.
- **Committed in:** `17f9fe3`

**3. [Rule 2 - Missing critical functionality] Importing the store into the service worker cost 22 kB**
- **Found during:** Task 3, measuring `pnpm run build:ext` after wiring the startup deletion
- **Issue:** the plan puts `deleteLegacyWorkspaceBlob()` in `WorkspaceStore.ts` and requires it to run on startup. Wiring it from `background.ts` pulled zustand + immer + zod into the background graph: `background.js` 73.0 kB → 95.3 kB total graph (the store's module-level `create()` is not tree-shakeable).
- **Fix:** the key constant and the removal-only helper were extracted to `src/core/workspace/legacyWorkspaceBlob.ts` (no imports); the background imports that module and `WorkspaceStore` re-exports the helper so the plan's artifact still resolves.
- **Files modified:** `src/core/workspace/legacyWorkspaceBlob.ts` (new), `src/core/workspace/WorkspaceStore.ts`, `src/entrypoints/background.ts`, `01-MIGRATION-INVENTORY.md` (new row)
- **Verification:** `pnpm run build:ext` → background graph 75.3 kB, `content-scripts/content.js` 4.88 kB unchanged; `npx vitest run` 327 passed; `bash scripts/verify-no-tailwind.sh` exit 0.
- **Committed in:** `17f9fe3`

**4. [Rule 2 - Missing critical functionality] The plan's placement of the correlator left Task 2's suite with nothing to drive**
- **Found during:** Task 2, authoring the ready/ack cases
- **Issue:** the plan puts the timeout/retry/ack-gate cases in Task 2's suite but the controllers in Task 3's file. The plan's own file split therefore had no module for Task 2's transport-level cases to exercise.
- **Fix:** the protocol state machines (`createHandoffInitiator` / `createHandoffTarget`, injectable transport and bounds) landed in `protocol.ts` at Task 2; Task 3's `useWorkspaceHandoff.ts` exports the surface controllers the plan names, bound to the BroadcastBus transport and the injected navigation/apply adapters.
- **Files modified:** `src/core/workspace/handoff/protocol.ts`, `src/core/workspace/handoff/useWorkspaceHandoff.ts`
- **Verification:** `tests/core/workspace/WorkspaceHandoff.test.ts` 30 cases green at Task 2; `useWorkspaceHandoff.ts` contains zero `chrome.` references.
- **Committed in:** `30d9170` and `17f9fe3`

**5. [Rule 2 - Missing critical functionality] The plan's file set cannot reach the target controller or the startup deletion**
- **Found during:** Task 3, wiring
- **Issue:** the target controller must be started where the Standalone URL is read (`StandaloneShell.tsx`) and the legacy blob deleted where the extension starts (`background.ts`) — neither is in the plan's `files_modified`.
- **Fix:** two minimal additive edits: `StandaloneShell`'s mount effect returns `hydrateFromURL(...)` (so the controller is disposed on unmount), and `background.ts` calls the removal-only helper and states it in its registration-contract comment. Both are recorded here and in the inventory rows.
- **Files modified:** `src/components/standalone/StandaloneShell.tsx`, `src/entrypoints/background.ts`
- **Verification:** `npx tsc --noEmit` exit 0; `tests/components/StandaloneShell.test.tsx` 11 passed; `pnpm run build:ext` succeeds; the background has no `tabs.create`/`sidePanel.open` call.
- **Committed in:** `17f9fe3`

**6. [Rule 2 - The plan's verify gates needed an instrument correction] The two new Task 2 cases that assert a projection is rejected used a wrong-workspace fixture**
- **Found during:** Task 3, first run of the extended router suite
- **Issue:** two test-local fixtures used `workspaceId: 'ws1'` against a URL bootstrap of `'ws-1'`, so the target correctly ignored the projection and the assertion failed. The code was right; the test data was not. (Recorded so the failure is not mistaken for a permissive target.)
- **Fix:** the fixtures were aligned to the bootstrap's workspace id.
- **Files modified:** `tests/core/workspace/WorkspaceRouter.test.ts`
- **Verification:** `tests/core/workspace` 81 passed.
- **Committed in:** `17f9fe3`

**7. [Rule 1 - Gate defect] The plan's "none of its literals appears in `MessageType`" acceptance cannot be literally true**
- **Found during:** Plan self-check, grepping the registry against the handoff union
- **Issue:** `MessageType` already carries `WORKSPACE_HANDOFF: 'WORKSPACE_HANDOFF'` — added by `01-06` as part of the complete Appendix E registry (15 types), with its own strict `{ workspaceId }` payload schema in `RuntimeEnvelopeValidation.ts` and a fixture in that plan's suite. The handoff protocol's transfer member necessarily uses the same literal, so the acceptance reads as a collision. `HANDOFF_READY` and `HANDOFF_ACK` are absent from the registry, and this plan adds nothing to it: `git diff 2f97bff..HEAD -- src/core/runtime` is empty.
- **Why the registry was not edited:** removing the literal would revert a landed, spec-owned decision (Appendix E) and break `01-06`'s per-type fixtures — the same class of gate correction that plan recorded for its own prototype-literal grep. The plan's intent ("do not put the handoff protocol on `MessageType`; `BroadcastBus` payloads are not runtime envelopes") is honoured: the channel union lives in `handoff/protocol.ts` and nothing was added to the registry.
- **Fix (instrument):** the gate is applied as "no handoff literal added to the registry, and both new literals absent from it". The overlap is recorded here and in the protocol module's JSDoc, and flagged for the phase acceptance review in "Next Phase Readiness".
- **Files modified:** none (documentation only)
- **Verification:** `grep -c "'HANDOFF_READY'"` → 0; `grep -c "'HANDOFF_ACK'"` → 0; `grep -c "'WORKSPACE_HANDOFF'"` → 1 (pre-existing, `01-06`); `git diff 2f97bff..HEAD -- src/core/runtime` → empty.
- **Committed in:** n/a (recorded here; the protocol module's JSDoc carries the distinction)

---

**Total deviations:** 7 (5 auto-fixed for blocking/critical reasons, 1 test-fixture correction, 1 gate-instrument correction)
**Impact on plan:** Deviations 1-5 were required for the plan's own gates (a zero-count grep, a green typecheck, a bounded retry budget, a reachable controller, a lean service worker). Deviation 7 is a verification-instrument correction with the raw and scoped readings both recorded. No dependency was added or bumped (`zod@4.4.3` untouched), no later-phase capability was implemented, no file outside this plan's ownership was changed beyond the four additive wiring edits recorded above, and the only structural departure from the plan's file list is `legacyWorkspaceBlob.ts`, which exists solely to avoid a measured 22 kB service-worker regression.

## Issues Encountered

- **`git add src/core/workspace/WorkspaceSync.ts` fails after `git rm`** — the deletion was already staged; the commit was re-issued without that pathspec (the same seam `01-05` hit).
- **A strict Zod schema cannot validate the store object directly.** Zustand keeps actions on the same object as the state, so a boundary check has to project the 14 canonical fields first; the suite does exactly that rather than loosening the schema.
- **`BroadcastBus` suppresses self-echo by instance id**, so an in-process initiator and target cannot exchange messages through `publish` alone. The suites drive inbound traffic through the `__broadcast` helper and assert outbound through the publish spy — the same instrument `01-06` used, and the reason the cold-start case is written as a ready-then-transfer ordering assertion.

## Known Stubs

None — no placeholder value, empty collection or unwired data source was introduced. The later-phase fields (`activeProvider`, `selectedModel`, `pinnedTabs`, `currentPageContext`, `selectedNotes`, `activeAddonContext`, `activeSkillRun`) are deliberately inert with no producer, which D-11 mandates rather than stubs: `composerDraft` defaults to `''` because the Phase-1 composer has no draft to hand over (an absent draft is defined as an empty one), and the target controller's `apply` adapter writes the canonical store fields rather than mock data.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: channel_acceptance | `src/core/workspace/handoff/protocol.ts` | The handoff channel is an unauthenticated `BroadcastChannel`: any same-origin extension page can publish on it. The mitigation is content validation (strict envelope + projection schemas, correlation on `requestId`, `workspaceId`/`targetSurface` matched against the URL bootstrap) plus idempotent application — asserted by tests, but the channel itself grants no identity. Recorded for the phase's security review. |
| threat_flag: draft_transit | `src/core/workspace/handoff/protocol.ts` | The composer draft travels in cleartext over `BroadcastBus` (the approved D-13 projection). It is bounded and never persisted or put in the URL, but another extension page listening on the same-origin channel could read it during the handshake window. Phase 2's election/persistence work is the place to revisit transport confidentiality if the draft ever carries sensitive text. |

## User Setup Required

None — no external service configuration, no dependency installed or bumped.

## Next Phase Readiness

- **`01-08` (palette/commands)**: `openStandalone` now returns its typed result through `onSettled`; the pinned pending/complete/failed copy (`workspace.handoffPending`, `workspace.handoffComplete`, `standalone.openFailed` + `Retry`) lives in the string map already and is a UI change, not a router change. `openOptions` opens the Standalone `?page=options` route.
- **`01-11` (prototype hosts)**: `SidepanelChat.tsx` no longer subscribes to a workspace broadcast; `MirrorBanner` is unmounted because its only state source was removed, and the host file is `01-11`'s to delete. `src/main.tsx` is the only remaining consumer of that host.
- **`01-12` (shells/pages)**: `StandaloneShell`'s mount effect now returns `hydrateFromURL(...)`'s disposer — keep that cleanup when marking page regions. The target controller is already installed by that effect.
- **`01-13` (gates)**: the instruments to extend are (a) the `src/**` no-workspace-write source scan, (b) `grep -rn "setSelectedModel\|setActiveProvider" src/ tests/` = 0, (c) `grep -rn "WorkspaceSync" src/ tests/` = 0, and (d) the handoff suite's attempt-count assertions against `1 + HANDOFF_MAX_RETRIES`. Note that a raw `np_workspace` grep needs the plan's two exclusions (`np_workspace'` and `legacy`) to reach zero.
- **Phase 2**: `WorkspaceState` is ready for durable persistence — `migrateWorkspaceState` already accepts a persisted version, `version` is a monotonic write counter, and the writer/mirror vocabulary is frozen for the election. The stale prototype key is deleted, so Phase 2 starts from a clean shelf.
- **Phase acceptance review**: three deliberate divergences are recorded — the ack failure arm carries `{ code, error }` rather than a bare code (the UI needs a message to log), the handoff URL declares its `source`/`target` surfaces as validated optional parameters so an invalid declaration fails closed rather than being silently ignored, and the `WORKSPACE_HANDOFF` literal is shared with `01-06`'s Appendix E runtime-envelope registry (different domains; see Deviations 7 — decide there whether the registry literal should eventually be renamed).
- **Requirement wording vs the Phase-1 contract**: `FLOW-11`'s §11 text reads "persist → dedupe → hydrate → WORKSPACE_HANDOFF → Side Panel mirrors". Phase 1 implements the validated dedupe → bootstrap → correlated handoff and explicitly **defers** persistence (D-14) and mirroring (D-12) to Phase 2, so the requirement is marked complete against the plan's Phase-1 scope, not against that sentence. `SP-02` is fully satisfied.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Files created (6 of 6): `src/core/workspace/WorkspaceState.ts`, `src/core/workspace/handoff/protocol.ts`, `src/core/workspace/handoff/useWorkspaceHandoff.ts`, `src/core/workspace/legacyWorkspaceBlob.ts`, `tests/core/workspace/WorkspaceState.test.ts`, `tests/core/workspace/WorkspaceHandoff.test.ts`.
- Files modified present (6 of 6): `src/core/workspace/{WorkspaceStore,WorkspaceRouter}.ts`, `src/components/chat/SidepanelChat.tsx`, `src/entrypoints/background.ts`, `src/components/standalone/StandaloneShell.tsx`, `tests/core/workspace/WorkspaceRouter.test.ts`, `tests/core/workspace/WorkspaceStore.test.ts`; removal applied: `src/core/workspace/WorkspaceSync.ts` no longer exists.
- Commits present: `80c26d9`, `c2c1a22`, `29ba753`, `30d9170`, `17f9fe3` (5 of 5, measured with `git rev-list --count 2f97bff..HEAD`).
- Fresh verification on the committed tree: `npx tsc --noEmit` exit 0; `npx vitest run` 24 files / 327 tests passed; `npx vitest run tests/core/workspace` 81 passed; `npx vitest run tests/core/workspace tests/core/theme tests/background` 164 passed; `grep -rn "np_workspace" src/ | grep -v "np_workspace'" | grep -vi "legacy" | wc -l` → 0; `grep -rn "WorkspaceSync" src/ tests/` → 0; `grep -rn "setSelectedModel\|setActiveProvider" src/ tests/` → 0; `grep -rn "composerDraft" src/core/workspace/handoff/protocol.ts | grep -c "searchParams\|URLSearchParams"` → 0; `grep -c "'HANDOFF_READY'" src/core/runtime/RuntimeEnvelope.ts` → 0 and `"'HANDOFF_ACK'"` → 0 (the `WORKSPACE_HANDOFF` overlap is Deviation 7); `git diff 2f97bff..HEAD -- src/core/runtime` → empty; `pnpm run build:ext` emits `content-scripts/content.js` 4.88 kB and a 75.3 kB background graph; `bash scripts/verify-no-tailwind.sh` exit 0.
