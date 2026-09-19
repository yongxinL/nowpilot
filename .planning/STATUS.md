# NowPilot Status

This file is the append-only status record required by `AGENTS.md` Section 16.
Update only the designated current-state section or append a dated entry. Do not
rewrite or delete prior history.

## Current state

- **Current phase:** Phase 01 — Runtime, Shells, and Workspace
- **Design status:** Approved and amended by ADR-0001 (background-serialised workspace election)
- **Plan status:** Approved and amended (corrective task T13C; T14/T16/T22/T24/T25/T26/T28 amendment notes)
- **Implementation status:** T01–T13C accepted; T14, T15, and T16 implemented and verified; T17–T28 not started
- **Planning baseline branch:** `phoenix`
- **Implementation branch:** `phoenix`
- **Historical approved planning baseline commit:** `bd6ac44d6f562722c18f0d07e6910634e549c713`
- **Approved planning baseline commit:** `b2c6ef289bc1abebbeccfad81d7034ced81f4eb7`
- **Current task:** T16 complete; next task T17
- **Last commit:** the T16 task commit `feat(phase-01): coordinate writer handoff and mirror convergence`, on top of `1d7afcf` (`feat(phase-01): version and idempotently apply workspace mutations`)
- **Verification result:** T16 sync suite 17/17 new tests; full unit suite 180/180 (20 files); `typecheck`, `lint`, `prettier --check .`, and the phase chain `typecheck && lint && test` all exit 0. `handleHandoffPrepare` acknowledges the handoff record and fails closed otherwise; `handleHandoffAck` commits ownership through the T14 handoff/arbiter and reports committed only on success; `handleRelinquish` reports relinquished only when accepted; `start()` never writes the election record and delegates missing/invalid sidepanel recovery to the T13C client as `fallback`/`stale-recovery`.
- **Next action:** implement T17 per approved Phase 01 `PLAN.md`
- **Blockers:** None; T13, T13C, T14, T15, and T16 are accepted
- **Evidence path:** `.planning/evidence/phase-01/verification.txt` and `.planning/evidence/phase-01/review.md` (Task 14, Task 15, and Task 16 sections)
- **Evidence status:** T16 verified; self-review PASS

## History

### 2026-09-19

- Governance baseline initialised.
- Phase 01 design approved at `phases/01-runtime-shells-workspace/DESIGN.md`.
- No implementation tasks executed. No plan created. No evidence recorded.
- Phase 01 `PLAN.md` drafted using the writing-plans skill at
  `phases/01-runtime-shells-workspace/PLAN.md` (28 tasks; T01–T28). Plan is
  awaiting operator approval. No production code, worktree, branch, dependency
  install, or evidence directory was created. No commit was made.
- Operator approved the four planning interpretations: (1) closed typed
  `MESSAGE_TYPE_ALLOWED_SOURCES` registry validated at every runtime boundary;
  (2) `instanceId`/`writerType` on `WorkspaceRehydrateRequestPayload` and
  `createWorkspaceCoordinator` as the Phase 01 orchestration boundary;
  (3) single closed mutation kind `workspace.metadata.set`; (4) separate
  `unit`/`manifest`/`isolation` Vitest projects with the approved aggregate
  order. Phase 01 `PLAN.md` is approved as authoritative and the interpretations
  are recorded in `PLAN.md`. No commit was made; no implementation started.
- Phase 01 approved-plan commit recorded as `approvedPlanningBaselineCommit` =
  `bd6ac44d6f562722c18f0d07e6910634e549c713` (`docs(phase-01): approve runtime
  implementation plan`), which contains the approved `DESIGN.md` and `PLAN.md`.
  Implementation branch `phase/01-phoenix`; implementation not started; next task
  T01. No production code, worktree, branch, dependency install, or evidence was
  created. No commit was made.
- Workflow amendment (operator decision 2026-09-19): Phase 01 implementation
  occurs directly on the single sequential `phoenix` branch. The separate
  `phase/01-phoenix` implementation branch and the linked worktree are
  superseded and retained as decision history only. Branch checks now require
  the current branch to be exactly `phoenix`, a clean working tree before each
  task, `HEAD` containing the approved planning commit and the status commit
  that records `approvedPlanningBaselineCommit`, and
  `approvedPlanningBaselineCommit` remaining an ancestor of `HEAD`. Direct-branch
  safeguards added: sequential execution; one implementation agent at a time;
  parallel task execution prohibited; same repository root and branch for
  subagents; commit branch verified before and after every task; no push,
  force-push, merge, rebase, squash, amend, reset, or history rewriting;
  recovery by new corrective commit or operator-approved `git revert`. Amended
  files: `AGENTS.md`, `DESIGN.md`, `PLAN.md`, `STATUS.md`, and
  `EXECUTION_PROTOCOL.md`. Planning baseline
  `bd6ac44d6f562722c18f0d07e6910634e549c713` and governance status commit
  `937961ae720188f0e83cc93dbe726d6811f810aa` remain in history. No production
  code changed; no dependency installed; T01 not started; no commit made.
- Direct-phoenix amendment follow-up (operator decision 2026-09-19):
  `.planning/DECISIONS.md` decision 20 is marked superseded and a replacement
  decision 25 records the direct-branch model. Because `PLAN.md` changed after
  `bd6ac44d6f562722c18f0d07e6910634e549c713`, that SHA is retained as the
  historical pre-amendment approved-plan baseline; `approvedPlanningBaselineCommit`
  is pending refresh to the direct-phoenix amendment commit. Blockers: baseline
  refresh pending. No production code changed; no dependency installed; T01 not
  started; no commit made.
- Baseline refresh (2026-09-19): direct-phoenix amendment commit
  `3fb619730c8032d4aa121c5b8aa9649901b45f5f` (`docs(phase-01): adopt direct
  phoenix implementation model`) is recorded as the current
  `approvedPlanningBaselineCommit`. It contains the amended `AGENTS.md`,
  `DESIGN.md`, `PLAN.md`, `DECISIONS.md`, `STATUS.md`, and
  `EXECUTION_PROTOCOL.md`. The previous
  `bd6ac44d6f562722c18f0d07e6910634e549c713` is retained as the historical
  pre-amendment approved-plan baseline. Implementation branch `phoenix`;
  implementation status not started; current task none; next task T01;
  blockers none; evidence status not started. This baseline-refresh record is
  committed separately from the baseline commit so the pre-implementation
  gate's status-record assertion is satisfied. No production code changed; no
  dependency installed; implementation not started.
- Task 01 (pnpm and WXT Project Bootstrap) executed on `phoenix` in the repository
  root. Pre-implementation baseline gate passed (branch `phoenix`; tree clean;
  `approvedPlanningBaselineCommit` = `3fb619730c8032d4aa121c5b8aa9649901b45f5f`;
  base commit `b54b01d18d3fdbdc8faaabf0dcc3239ff420c962`). Created `package.json`
  (exact pins), `.npmrc` (`engine-strict=true`, `save-exact=true`), `wxt.config.ts`
  (permissions exactly `sidePanel` + `storage`), `tsconfig.json`,
  `src/entrypoints/background.ts`, and `public/icon/{16,32,48,128}.png`; removed
  the orphan `package-lock.json`; generated `pnpm-lock.yaml` with
  `pnpm install` (`postinstall` ran `wxt prepare`). Task 01 Step 10 focused
  verification passed (all exit 0); `pnpm run build` produced WXT 0.21.4
  chrome-mv3 output and `.output/chrome-mv3/manifest.json`. Phase 01 verification
  applicable now: none (toolchain scripts do not exist until T02). Task commit
  `5b0a2da4fb0102595a928019e33338e7c2d84a68` (`chore(phase-01): bootstrap pnpm
  WXT project`). Note: pnpm 12.4.2 auto-created an
  untracked `pnpm-workspace.yaml` during initial resolution; it is forbidden by
  Global Constraint 2 and not required (`pnpm install --frozen-lockfile` passes
  without it, lockfile hash unchanged), so it was removed and not committed.
  Current task T01 accepted; next task T02; verification recorded in
  `.planning/evidence/phase-01/verification.txt`.
- Task 02 (Test, Lint, Type-Check, Formatting, and Build Configuration) executed
  on `phoenix`. RED confirmed at `pnpm exec vitest run tests/config/toolchain.test.ts`
  (exit 1; missing scripts and config files). A first pass surfaced four blocking
  defects under the pinned toolchain (Vitest 5.0.1 / Vite 8.3.0 / jsdom 30.1.0 /
  TypeScript 5.9.3); the controller independently reproduced and ruled on each, and
  the authorised corrections were applied: (B1) `tsconfig.json` `extends` →
  `./.wxt/tsconfig.json` (TS6053); (B2) `vitest.config.ts` unit project-level
  `esbuild: { jsx: 'automatic' }` removed (TS2769; Vite 8 uses oxc); (B3)
  `tests/config/toolchain.test.ts` root now computed with
  `resolve(dirname(fileURLToPath(import.meta.url)), '../..')` so Vite's client
  transform no longer rewrites it (jsdom ERR_INVALID_URL_SCHEME); (B4)
  `tsconfig.json` gained `"jsx": "react-jsx"`. `pnpm run format` reformatted only
  `tests/config/toolchain.test.ts` and `vitest.config.ts`. Step 8 passed with all
  commands exit 0 (`test` 4/4, `typecheck`, `lint`, `prettier --check .`, `build`);
  phase chain `typecheck && lint && test` exit 0. `pnpm-workspace.yaml` remained
  absent. Evidence recorded in `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 02 sections). Task commit
  `chore(phase-01): configure test lint typecheck format and build`. Current task
  T02 accepted; next task T03.
- Task 03 (Operational Error and Diagnostic Registries with `debugLog`) executed on
  `phoenix` in the repository root. RED confirmed at
  `pnpm run test -- tests/core/error` (exit 1; "Failed to resolve import
  `@/core/error/errorCodes`" and `@/core/error/debugLog`). Created
  `src/core/error/errorCodes.ts` (exactly the 13 DESIGN.md Section 5 `ErrorCode`
  values in approved order; the single `DiagnosticEvent`
  `STANDALONE_ROUTE_FALLBACK`; two separate closed `z.enum` schemas, no union) and
  `src/core/error/debugLog.ts` (exact 12-key `REDACTED_CONTEXT_KEYS`; key-based
  redaction plus non-primitive replacement; every record passes through
  `redactContext`; no network/storage/side effects). Tests created at
  `tests/core/error/errorCodes.test.ts` (3 tests) and
  `tests/core/error/debugLog.test.ts` (4 tests). One type-only adaptation (B5):
  the verbatim `sink.debug.mock.calls[0][0]` is TS2532 under the T02-pinned
  `noUncheckedIndexedAccess: true`, so `sink.debug.mock.calls[0]![0]` was used in the
  test file; all values and assertions are unchanged and `tsconfig.json` was not
  modified. GREEN: focused test exit 0 (3 files, 11 tests; T03-only 2 files, 7
  tests), `typecheck` exit 0, `lint` exit 0, `prettier --check .` exit 0; phase
  chain `typecheck && lint && test` exit 0. Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 03 sections). Task commit
  `feat(phase-01): add error and diagnostic registries`. Current task T03 accepted;
  next task T04.
- Task 04 (Storage Keys and Validated Chrome-Storage Adapter) executed on `phoenix`
  in the repository root. RED confirmed at `pnpm run test -- tests/core/storage`
  (exit 1; "Failed to resolve import `@/core/storage/storageKeys`" and
  `@/core/storage/chromeStorage`). Created `src/core/storage/storageKeys.ts`
  (exactly the 7 DESIGN.md Section 9 keys in approved order; `STORAGE_AREAS`,
  `StorageArea`, `StorageKey`, `STORAGE_KEY_AREAS` with mapping
  local/local/session/session/session/sync/sync, `storageAreaForKey`) and
  `src/core/storage/chromeStorage.ts` (structural `ChromeStorage*` types,
  `getChromeStorage`, `StorageReadResult`, `ValidatedStorage`,
  `createValidatedStorage` with schema-validated read/write/remove/subscribe and
  fail-closed handling). Created `tests/helpers/chromeMock.ts`,
  `tests/core/storage/storageKeys.test.ts` (2 tests), and
  `tests/core/storage/chromeStorage.test.ts` (8 tests); modified `tests/setup.ts`
  to install a default `chrome.storage` mock. Three Low-severity type-only
  adaptations (B6–B8) documented in `review.md`: an additive
  `export type { StorageArea, StorageKey } from './storageKeys'` re-export,
  explicit `ValidatedStorage` method signatures on the returned object literal,
  and `changes[key]!` under the pinned `noUncheckedIndexedAccess`. GREEN: focused
  test exit 0 (2 files, 10 tests), `typecheck` exit 0, `lint` exit 0,
  `prettier --check .` exit 0; phase chain `typecheck && lint && test` exit 0
  (5 files, 21 tests). Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 04 sections). Task commit
  `feat(phase-01): add storage keys and validated storage adapter`. Current task
  T04 accepted; next task T05.
- Task 05 (Canonical Standalone Route Registry) executed on `phoenix` in the
  repository root. RED confirmed at
  `pnpm run test -- tests/core/registry/standaloneRoutes.test.ts` (exit 1; "Failed
  to resolve import `@/core/registry/standaloneRoutes`"). Created
  `src/core/registry/standaloneRoutes.ts` (exactly the 7 DESIGN.md Section 11 route
  IDs in approved order; `DEFAULT_STANDALONE_ROUTE_ID = 'chat'`; closed
  `StandaloneRouteIdSchema`; `STANDALONE_ROUTES` with labels and `#/<id>` hashes;
  `PRIMARY_STANDALONE_ROUTES` = chat, agent, notes, write, tools;
  `FOOTER_STANDALONE_ROUTES` = options, diagnostics; `standaloneHashRoute`,
  `parseStandaloneRouteId`, and `resolveStandaloneRouteId` with explicit
  `fellBack` signal; no React, page components, TeamGQM/ServiceNow, path/query
  routing, or side effects) and `tests/core/registry/standaloneRoutes.test.ts`
  (7 tests). One Low-severity type-only adaptation (D4): the brief's
  `match[1]` is `string | undefined` under the T02-pinned
  `noUncheckedIndexedAccess: true`, so `match[1]!` was used inside the existing
  `if (!match) return undefined;` guard; behaviour unchanged and `tsconfig.json`
  unmodified. GREEN: focused test exit 0 (6 files, 28 tests; T05-only 1 file, 7
  tests), `typecheck` exit 0, `lint` exit 0, `prettier --check .` exit 0; phase
  chain `typecheck && lint && test` exit 0 (6 files, 28 tests). Evidence recorded
  in `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 05 sections). Task commit
  `feat(phase-01): add canonical standalone route registry`. Current task T05
  accepted; next task T06.
- Task 06 (Workspace Types and Durable Metadata Schemas) executed on `phoenix` in
  the repository root. RED confirmed at
  `pnpm run test -- tests/core/workspace/workspaceTypes.test.ts` (exit 1; "Failed
  to resolve import `@/core/workspace/workspaceTypes`"). Created
  `src/core/workspace/workspaceTypes.ts` (exact `WORKSPACE_SCHEMA_VERSION = 1`;
  `WorkspaceWriterTypeSchema` = sidepanel | standalone; `HandoffPhaseSchema` =
  idle/prepared/acknowledged/committed; `InstanceIdSchema` string min 1;
  `createInstanceId()` via runtime `crypto.randomUUID`; `WorkspaceMetadataSchema`;
  `WorkspaceVersionRecordSchema`; `ElectionRecordSchema` (writer type, instance ID,
  epoch, committed version, handoff state, nullable target ID — DESIGN.md Section 6);
  `HandoffRecordSchema`; `StandaloneTabRecordSchema`; `WorkspaceMutationKindSchema`
  closed literal `workspace.metadata.set` per Approved Interpretation 3;
  `WorkspaceMutationSchema` (mutation ID uuid, writer instance ID, epoch, base
  version, resulting version, kind, schema-valid metadata payload);
  `createEmptyWorkspaceMetadata(now)`) and
  `tests/core/workspace/workspaceTypes.test.ts` (7 tests). No new type-level
  deviation was required. `pnpm exec prettier --check .` flagged only the T06 test
  file (final assertion line wrapping); it was formatted, values and assertions
  unchanged, and no other file was reformatted. GREEN: focused test exit 0 (7 files,
  35 tests; T06-only 1 file, 7 tests), `typecheck` exit 0, `lint` exit 0,
  `prettier --check .` exit 0; phase chain `typecheck && lint && test` exit 0
  (7 files, 35 tests). Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 06 sections). Task commit
  `feat(phase-01): add workspace types and durable metadata schemas`. Current task
  T06 accepted; next task T07 — Runtime Primitives, Payload Schemas, and
  `RuntimeEnvelope`.
- Task 07 (Runtime Primitives, Payload Schemas, and `RuntimeEnvelope`) executed on
  `phoenix` in the repository root. RED confirmed at
  `pnpm run test -- tests/core/runtime` (exit 1; module-resolution errors for
  `@/core/runtime/messageSchemas`, `@/core/runtime/OperationId`, and
  `@/core/runtime/MessageType` across the three new suites). Created
  `src/core/runtime/RuntimeSurface.ts` (exact three surfaces
  background/sidepanel/standalone; `RUNTIME_TARGETS` adds only `'*'`;
  closed `RuntimeSurfaceSchema`/`RuntimeTargetSchema`; `WorkspaceWriterSurface`),
  `src/core/runtime/OperationId.ts` (`z.string().uuid()`; `createOperationId()`
  via runtime `crypto.randomUUID`), `src/core/runtime/MessageType.ts` (the eleven
  DESIGN.md Section 5 message types in approved order; closed `MessageTypeSchema`;
  `MESSAGE_TYPE_ALLOWED_SOURCES` closed, typed, explicit for all eleven types with
  no wildcard/permissive default per Approved Interpretation 1),
  `src/core/runtime/messageSchemas.ts` (the eleven canonical type→payload schema
  names verbatim; rehydrate request carries `instanceId`/`writerType` per Approved
  Interpretation 2; standalone destinations via the T05 `StandaloneRouteIdSchema`;
  runtime error `code` via the T03 `ErrorCodeSchema`; `RUNTIME_PAYLOAD_SCHEMAS`
  maps each type exactly once; `RuntimeMessageSchema` closed discriminated union;
  single `MESSAGE_TYPES` re-export, no second list), and
  `src/core/runtime/RuntimeEnvelope.ts` (DESIGN.md Section 5 base envelope fields;
  one closed discriminated union over the eleven types; `parseRuntimeEnvelope` =
  `safeParse`, unknown type fails closed). Created
  `tests/core/runtime/runtimePrimitives.test.ts` (3 tests),
  `tests/core/runtime/messageSchemas.test.ts` (4 tests + the Step 9 registry
  completeness test), and `tests/core/runtime/runtimeEnvelope.test.ts` (5 tests).
  No type-level deviation required. `pnpm exec prettier --check .` flagged only the
  two T07 `messageSchemas` files (line wrapping); they were formatted, identifiers
  and assertions unchanged, and no other file was reformatted. GREEN: focused test
  exit 0 (10 files, 48 tests; T07-only 3 files, 13 tests), `typecheck` exit 0,
  `lint` exit 0, `prettier --check .` exit 0; phase chain
  `typecheck && lint && test` exit 0 (10 files, 48 tests). Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 07 sections). Task commit
  `feat(phase-01): add runtime envelope primitives and registries`. Current task
  T07 accepted; next task T08 — per approved Phase 01 `PLAN.md`.
- Task 08 (Sender and Envelope Boundary Validation) executed on `phoenix` in the
  repository root. Implementation tier advanced (trust boundary). RED confirmed at
  `pnpm run test -- tests/core/runtime/boundaryValidation.test.ts` (exit 1; 11
  failures, all `TypeError: ... is not a function` for `getAllowedSources`,
  `isTrustedExtensionSender`, and `validateInboundEnvelope`; the 48 pre-existing
  unit tests still passed). Appended to `src/core/runtime/RuntimeEnvelope.ts`:
  `getAllowedSources` (fails closed to `[]` for an unregistered type),
  `isSourceAllowed`, `SenderIdentity` (`id?`/`url?`), `isTrustedExtensionSender`
  (exact `extensionId` match; when `url` is present it must start with
  `chrome-extension://<extensionId>/`), `InboundValidationResult`, and
  `validateInboundEnvelope` (envelope schema first — `RUNTIME_ENVELOPE_INVALID`,
  including an unknown type string; then sender identity — `RUNTIME_SENDER_REJECTED`;
  then the closed allowed-source registry — `RUNTIME_SENDER_REJECTED` for a
  disallowed source or unregistered type; never throws; failure paths log only the
  canonical error code with a fixed `reason` label, no raw payload/sender). Created
  `tests/core/runtime/boundaryValidation.test.ts` (11 tests) including the Approved
  Interpretation 1 coverage: every `MessageType` from each allowed source accepted,
  a representative disallowed source rejected for every type that has one, and the
  completeness test that `Object.keys(MESSAGE_TYPE_ALLOWED_SOURCES).sort()` equals
  `[...MESSAGE_TYPES].sort()` with no wildcard/permissive default. `pnpm exec
  prettier --check .` flagged only the T08 test file; it was formatted, identifiers,
  message-type strings, payloads, and assertions unchanged, and no other file was
  reformatted. GREEN: focused test exit 0 (1 file, 11 tests), `typecheck` exit 0,
  `lint` exit 0, `prettier --check .` exit 0; phase chain
  `typecheck && lint && test` exit 0 (11 files, 59 tests). Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 08 sections). Task commit
  `feat(phase-01): validate runtime envelope and sender at boundaries`. Current task
  T08 accepted; next task T09 — per approved Phase 01 `PLAN.md`.
- Task 09 (Canonical Broadcast Bus) executed on `phoenix` in the repository root.
  Implementation tier balanced. RED confirmed at
  `pnpm run test -- tests/core/runtime/broadcastBus.test.ts` (exit 1; "Failed to
  resolve import `@/core/runtime/BroadcastBus`"; the 59 pre-existing unit tests still
  passed). Created `src/core/runtime/BroadcastBus.ts` with the exact brief interfaces
  `RawMessageListener`, `BroadcastBusDependencies` (`extensionId`, `sendMessage`,
  `addMessageListener`, `removeMessageListener`), `EnvelopeHandler`, `BroadcastBus`
  (`send`, `on`), and `createBroadcastBus(deps)`. Inbound `dispatch` runs the T08
  `validateInboundEnvelope(message, sender, deps.extensionId)` boundary and returns
  before any handler when the result is not ok, so untrusted senders and malformed
  envelopes are never dispatched; `send` forwards a `RuntimeEnvelope` to the injected
  transport; `on` is keyed by the canonical `MessageType`, lazily registers one raw
  transport listener per distinct subscribed type, and removes it when its last handler
  is removed. No direct `chrome.*`, content script, `chrome.tabs`, IndexedDB, network,
  or dependency change. Created `tests/core/runtime/broadcastBus.test.ts` (5 tests:
  send via transport; deliver only the subscribed type; ignore untrusted sender; ignore
  malformed message without throwing; stop after unsubscribe). One Low-severity type-only
  adaptation (same class as T03 B5): the brief's `handler.mock.calls[0][0].type` is TS2532
  under the pinned `noUncheckedIndexedAccess: true`, so `handler.mock.calls[0]![0].type`
  was used; values and assertions unchanged and `tsconfig.json` unmodified. `pnpm exec
  prettier --check .` flagged only the two T09 files; both were formatted, identifiers,
  message-type strings, payloads, and assertions unchanged, and no other file was
  reformatted. GREEN: explicit focused path exit 0 (1 file, 5 tests), `pnpm run test`
  exit 0 (12 files, 64 tests), `typecheck` exit 0, `lint` exit 0, `prettier --check .`
  exit 0; phase chain `typecheck && lint && test` exit 0 (12 files, 64 tests). Evidence
  recorded in `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 09 sections). Task commit
  `feat(phase-01): add canonical broadcast bus`. Current task T09 accepted; next task
  T10 — per approved Phase 01 `PLAN.md`.
- Task 09 controller review (Critical) and fix. The controller found that the original
  `on` registered one raw transport listener per distinct subscribed `MessageType`, while
  each listener's `dispatch` fanned out over all listener maps; with N distinct types
  subscribed, one inbound message was dispatched N times, each matching handler fired N
  times, and invalid messages were validated/logged N times (affects T16 and T22).
  Regression test added first:
  "delivers each inbound message exactly once across multiple subscribed types" subscribes
  `standalone.open` and `standalone.focus` on one bus, asserts the transport has exactly
  one raw listener (`listeners.size === 1`), and asserts each handler fires exactly once
  for its own type and not the other. It failed against the fan-out implementation
  (`expected 2 to be 1`; 1 failed | 5 passed). Replaced
  `src/core/runtime/BroadcastBus.ts` with the controller-specified corrected
  implementation: a single lazily-created raw transport listener (`ensureListener`) and
  one `handlersByType: Map<MessageType, Set<EnvelopeHandler>>`; unsubscribe removes the
  handler, deletes an empty type entry, and removes the raw listener only when no type has
  any handler. Public interface unchanged; inbound messages still pass through the T08
  `validateInboundEnvelope` boundary exactly once before any handler. GREEN: focused
  regression run exit 0 (1 file, 6 tests), `pnpm run test` exit 0 (12 files, 65 tests),
  `typecheck` exit 0, `lint` exit 0, `prettier --check .` exit 0; phase chain
  `typecheck && lint && test` exit 0 (12 files, 65 tests). Evidence appended to
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 09 FIX sections). Corrective commit
  `fix(phase-01): deliver each broadcast message once per subscriber` (a new commit, not
  an amend). Current task T09 accepted with the fix applied; next task T10 — per approved
  Phase 01 `PLAN.md`.
- Task 10 (Standalone Navigation Request Contract) executed on `phoenix` in the
  repository root. Implementation tier balanced. RED confirmed at
  `pnpm run test -- tests/core/runtime/standaloneNavigation.test.ts` (exit 1; "Failed
  to resolve import `@/core/runtime/StandaloneNavigation`"; the 65 pre-existing unit
  tests still passed). Created `src/core/runtime/StandaloneNavigation.ts` with the exact
  brief interfaces `StandaloneNavigationOpenRequest`, `StandaloneNavigationFocusRequest`,
  `StandaloneNavigationRequest` (typed on the T05 `StandaloneRouteId`),
  `createStandaloneOpenEnvelope(destination, source)`,
  `createStandaloneFocusEnvelope(destination, source)`,
  `readStandaloneNavigationRequest(envelope)`, `openStandalone(destination, surface, bus)`,
  and `focusStandalone(destination, surface, bus)`. A single private
  `createNavigationEnvelope` schema-validates the destination via
  `StandaloneRouteIdSchema.parse` before building a `RuntimeEnvelope`; `standalone.open`
  targets `background` and `standalone.focus` targets `standalone`; only the canonical
  T09 `BroadcastBus` `send` is used (`Pick<BroadcastBus, 'send'>`). No `chrome.tabs`,
  routing strings beyond the registry, UI, handoff logic, dependency change, IndexedDB,
  network, or content script. Created
  `tests/core/runtime/standaloneNavigation.test.ts` (6 tests: both envelope builders with
  schema validity, target, source, and payload; reading both request kinds; the
  unrelated-envelope `undefined` case; both bus senders). One Low-severity type-only
  adaptation (same class as T03 B5 / T09): the brief's verbatim
  `bus.send.mock.calls[0][0].type` is TS2532/TS2493 under the pinned
  `noUncheckedIndexedAccess: true` with the untyped `vi.fn(async () => {})` args tuple, so
  the mock parameter is typed `_envelope: RuntimeEnvelope` and the index uses
  `bus.send.mock.calls[0]![0].type`; values and assertions unchanged and `tsconfig.json`
  unmodified. `pnpm exec prettier --check .` flagged only the two T10 files; both were
  formatted, identifiers, values, and assertions unchanged, and no other file was
  reformatted. GREEN: focused test exit 0 (13 files, 71 tests), `typecheck` exit 0,
  `lint` exit 0, `prettier --check .` exit 0; phase chain `typecheck && lint && test`
  exit 0 (13 files, 71 tests). Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 10 sections). Task commit
  `feat(phase-01): add standalone navigation request contract`. Current task T10 accepted;
  next task T11 — per approved Phase 01 `PLAN.md`.
- Task 11 (Singleton Standalone Tab Controller) executed on `phoenix` in the repository
  root. Implementation tier advanced (tab identity and recovery). RED confirmed at
  `pnpm run test -- tests/core/runtime/standaloneTabController.test.ts` (exit 1; 7
  failures, all `TypeError: createStandaloneTabController is not a function`; the 71
  pre-existing unit tests still passed). Appended to
  `src/core/runtime/StandaloneNavigation.ts`: the exact brief interfaces `StandaloneTabApi`
  (get/create/update/focusWindow), `StandaloneTabControllerDependencies`
  (tabs/storage/buildStandaloneUrl/sendFocus/now), `StandaloneOpenResult`
  (created|focused+tabId, or failed with STANDALONE_OPEN_FAILED|STANDALONE_TAB_INVALID),
  `StandaloneTabController` (open/handleTabRemoved/readRecord), and
  `createStandaloneTabController(deps)` with `STANDALONE_TAB_KEY = 'np_standalone_tab'`
  (T04 session area). `open` reads the stored tab ID, validates only the numeric `id` from
  the injected non-sensitive `tabs.get` (no URL/title read), and on a live tab calls
  `tabs.update({active:true})` + `tabs.focusWindow` + a T10 `standalone.focus` envelope;
  on a stale/missing tab it logs STANDALONE_TAB_INVALID, removes the record, and creates
  the entrypoint at `buildStandaloneUrl(destination)`, persisting `{ tabId, openedAt }`.
  Create failure or a missing id fails closed with STANDALONE_OPEN_FAILED.
  `handleTabRemoved` clears the record only when the stored tab ID matches (authoritative
  close recovery; `standalone.closed` not used). No direct `chrome.*`/`tabs.query`, no
  URL/title/favicon/content read, no IndexedDB/network, no dependency change. Created
  `tests/core/runtime/standaloneTabController.test.ts` (7 tests). Two Low-severity
  type-only adaptations (disclosed): the `sendFocus` mock parameter is typed
  `_envelope: RuntimeEnvelope` with `mock.calls[0]![0]` (TS2532/TS2493 under
  `noUncheckedIndexedAccess`), and the `tabs.create` mock is annotated
  `async (): Promise<{ id?: number }> => ({ id: 42 })` so the fail-closed
  `mockResolvedValueOnce({})` typechecks (TS2345); values and assertions unchanged and
  `tsconfig.json` unmodified. `pnpm exec prettier --check .` flagged only the T11 test
  file; it was formatted with values and assertions unchanged. GREEN: explicit focused
  path exit 0 (1 file, 7 tests), `pnpm run test` exit 0 (14 files, 78 tests),
  `typecheck` exit 0, `lint` exit 0, `prettier --check .` exit 0; phase chain
  `typecheck && lint && test` exit 0 (14 files, 78 tests). Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 11 sections). Task commit
  `feat(phase-01): add singleton standalone tab controller`. Current task T11 accepted;
  next task T12 — per approved Phase 01 `PLAN.md`.
- Task 12 (Workspace Metadata Store and Durable Version) executed on `phoenix` in the
  repository root. Implementation tier balanced. RED confirmed at
  `pnpm run test -- tests/core/workspace/workspaceStore.test.ts` (exit 1; Vite import
  analysis failed to resolve `@/core/workspace/WorkspaceStore`; the 78 pre-existing unit
  tests still passed). Created `src/core/workspace/WorkspaceStore.ts` with the exact brief
  interfaces `WorkspaceMetadataReadResult` (missing | valid+metadata | invalid),
  `WorkspaceStore` (readMetadata/writeMetadata/readVersion/writeVersion), and
  `createWorkspaceStore(storage: ValidatedStorage): WorkspaceStore`. `readMetadata` reads
  `np_workspace_meta` through the T04 validated adapter, returns `{status:'valid',metadata}`,
  logs `WORKSPACE_INVALID_METADATA` (fixed key label) and returns `{status:'invalid'}` for a
  malformed record, and returns `{status:'missing'}` when absent — never throwing.
  `writeMetadata` writes `np_workspace_meta` then the derived
  `{committedVersion,updatedAt}` `np_workspace_version` record. `readVersion` returns the
  committed version for a valid record, logs the canonical code and returns `0` for an
  invalid record, and returns `0` when absent. `writeVersion` writes
  `np_workspace_version`. Both keys are T04 `local`-area keys (DESIGN.md Section 9); durable
  state is metadata plus committed version only; no session value is treated as durable; no
  direct `chrome.*`, no IndexedDB/network, no new dependency. Created
  `tests/core/workspace/workspaceStore.test.ts` (4 tests). No type-only adaptation was
  required; the brief's test and implementation typechecked as written under the pinned
  `noUncheckedIndexedAccess: true`. `pnpm exec prettier --check .` flagged only the T12
  module (the `WorkspaceMetadataReadResult` union reflowed at printWidth 100); it was
  formatted with type members, identifiers, and behaviour unchanged, and no other file was
  reformatted. GREEN: explicit focused path exit 0 (1 file, 4 tests), `pnpm run test` exit 0
  (15 files, 82 tests), `typecheck` exit 0, `lint` exit 0, `prettier --check .` exit 0;
  phase chain `typecheck && lint && test` exit 0 (15 files, 82 tests). Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 12 sections). Task commit
  `feat(phase-01): persist workspace metadata and version`. Current task T12 accepted;
  next task T13 — per approved Phase 01 `PLAN.md`.
- Task 13 (Writer Election) executed on `phoenix` in the repository root. Implementation
  tier advanced (ownership correctness). RED confirmed at
  `pnpm run test -- tests/core/workspace/workspaceElection.test.ts` (exit 1; Vite import
  analysis failed to resolve `@/core/workspace/WorkspaceElection`; the 82 pre-existing
  unit tests still passed). Created `src/core/workspace/WorkspaceElection.ts` with the
  exact brief interfaces `WorkspaceElectionDependencies`
  (storage/store/writerType/instanceId/now), `ElectionReadResult`
  (missing | valid+record | invalid), `ElectionClaimResult`
  (acquired+record+recovered | held+record), `WorkspaceElection`
  (read/claim/relinquish/isWriter), and
  `createWorkspaceElection(deps: WorkspaceElectionDependencies): WorkspaceElection`.
  `read` validates `np_workspace_election` through the T04 session-area adapter, logging
  the canonical T03 `WORKSPACE_INVALID_METADATA` (fixed key label) and returning
  `invalid` for malformed state, `missing` when absent — never throwing. `isWriter`
  requires BOTH a matching `writerInstanceId` and a matching `writerType`, so identity is
  never inferred from surface type alone. `claim` returns `{status:'valid'}` records as
  `held` without writing, so a valid existing writer is NEVER displaced and a repeated
  same-instance claim is idempotently held; only a missing/invalid record triggers a
  claim that preserves the committed version via `deps.store.readVersion()`, writes a
  fresh idle epoch-0 record `{writerType, writerInstanceId, epoch:0, committedVersion,
  handoffPhase:'idle', handoffTargetInstanceId:null, updatedAt: deps.now()}`, and reports
  `recovered: true` for invalid-metadata recovery. `relinquish` removes
  `np_workspace_election` then `np_workspace_handoff` (both T04 session keys). The
  brief-supplied `isWriter` implementation was used verbatim and typechecked under the
  pinned `noUncheckedIndexedAccess: true`, so the documented STOP/BLOCKED condition did
  not trigger. No handoff transitions (T14), no mutations (T15), no background broker, no
  IndexedDB/network/new dependency, no direct `chrome.*`; owner is always a UI surface.
  Created `tests/core/workspace/workspaceElection.test.ts` (7 tests). `pnpm exec prettier
  --check .` flagged only the two T13 files; both were formatted with interface members,
  literals, and assertions unchanged, and no other file was reformatted. GREEN: explicit
  focused path exit 0 (1 file, 7 tests), `pnpm run test` exit 0 (16 files, 89 tests),
  `typecheck` exit 0, `lint` exit 0, `prettier --check .` exit 0; phase chain
  `typecheck && lint && test` exit 0 (16 files, 89 tests). Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 13 sections). Task commit
  `feat(phase-01): elect a single workspace writer`. Current task T13 accepted;
  next task T14 — per approved Phase 01 `PLAN.md`.
- Task 13 (Writer Election) implemented and committed as `7633615`
  (`feat(phase-01): elect a single workspace writer`) after T01–T12 were accepted.
  RED/GREEN focused tests (7/7), `typecheck`, `lint`, and `prettier --check .` all passed.
- Task 13 controller review FAILED with one Critical finding: `claim()` performs a
  non-atomic read-then-write (`WorkspaceElection.ts:61-71`). Two surfaces that both
  observe `missing`/`invalid` can both build and persist an election record and both
  receive `status: 'acquired'`, authorising two live writers. This meets the task's own
  STOP condition ("TWO live writers can be authorised by any code path") and conflicts
  with `DESIGN.md` Section 6 ("never two authorised writers"). Two further Important
  findings: `relinquish()` is not owner-guarded in the module (T16's planned coordinator
  guards it, but T16 is not yet implemented), and stale/invalid recovery always writes
  epoch `0` rather than a fresh epoch.
- Per `AGENTS.md` Section 2 (authoritative-document conflict), Section 18 (locked/unspecified
  architecture), and Section 19 (stop conditions), Phase 01 execution is STOPPED at T13,
  BLOCKED pending an operator decision. T14–T28 have not been started. No file has been
  modified beyond recording this blocker. Recommended resolution options are recorded in
  `.planning/evidence/phase-01/review.md` (Task 13 controller-review section).
- Note: T13's own phase evidence (`review.md`/`verification.txt`) recorded a self-review
  PASS before the controller review; that self-review is superseded by the controller
  finding and is retained for traceability only.
- Operator decision (2026-09-19): Option C selected — background-serialised
  workspace election, with a narrowly scoped architecture amendment. The
  direct multi-context election write model is recorded as superseded (retained
  as decision history in `DECISIONS.md` decision 6 and `DESIGN.md` decision 6).
  The background becomes the narrow serialisation authority for operations that
  change the elected workspace writer, while remaining not a workspace owner,
  workspace writer, ordinary mutation broker, content owner, provider/MCP
  runtime, IndexedDB owner, or long-lived source of truth.
- Planning amendment prepared (not committed, pending operator approval):
  `AGENTS.md` (Section 4 locked decision, Section 9 isolation rule),
  `.planning/architecture/ARCHITECTURE.md` (contexts, single-writer rule,
  accepted decisions), new
  `.planning/architecture/decisions/ADR-0001-background-serialised-workspace-election.md`,
  `.planning/DECISIONS.md` (ADR index; decision 6 amended; decision 26 added),
  `DESIGN.md` (Sections 2, 6, 13, 14, resolved decisions, design completeness),
  and `PLAN.md` (Global Constraint 7, Interpretation 2 amendment, new corrective
  task T13C, and amendment notes on T14/T16/T22/T24/T25/T26/T28 plus the
  dependency graph and coverage matrix). No production code was modified.
- Next steps on approval: commit the amendment as
  `docs(phase-01): serialise workspace election in background`, implement T13C,
  verify and review it, then continue to T14. Commits `7633615` and `88fbdb6`
  are retained unchanged as historical checkpoints.
- Operator approval (2026-09-19, second decision): ADR-0001 approved subject to six
  mandatory clarifications, all incorporated into the same uncommitted planning
  amendment: (1) durable `requestId` idempotency persisted inside
  `np_workspace_election` via the bounded `recentCompletedRequests` ledger
  (retention limit 32);
  (2) Chrome-style background listener returning literal `true` and using
  `sendResponse` (no Promise-returning `onMessage`); (3) exact sender/target
  restrictions and correlationId = request envelope id; (4) FIFO queue lifetime
  limited to the current service-worker lifetime with restart correctness from
  persisted state; (5) baseline refresh sequence; (6) unchanged T13 commits and a
  separate T13C corrective commit. Amended files: `AGENTS.md`,
  `ARCHITECTURE.md`, `DECISIONS.md`, `ADR-0001`, `DESIGN.md`, `PLAN.md`, and this
  `STATUS.md`. No production code was modified; the amendment remains uncommitted.
- Next actions on operator instruction: commit the amendment
  (`docs(phase-01): serialise workspace election in background`), capture its SHA,
  commit the baseline refresh (`docs(phase-01): record election amendment baseline`),
  then implement T13C. Commits `7633615` and `88fbdb6` remain unchanged.
- Operator correction (2026-09-19, third decision): the single-entry
  idempotency field did not satisfy the general duplicate-request guarantee
  (request A completing, then being replaced by B, then A retried). The retention
  policy is corrected to a bounded recent-request ledger
  `ElectionRecord.recentCompletedRequests: ElectionIdempotencyRecord[]` with a
  retention limit of exactly **32** entries, ordered oldest to newest, with
  remove-by-requestId-then-append-then-trim-to-newest-32 on completion, and
  order-independent named-field fingerprint equality (no `JSON.stringify`).
  Duplicate recognition is guaranteed only for the 32 most recently completed
  election-changing requests within the browser session; unlimited historical
  deduplication is not claimed. Amended: `ADR-0001`, `DESIGN.md`, `PLAN.md`, and
  this `STATUS.md`; `AGENTS.md`, `ARCHITECTURE.md`, and `DECISIONS.md` did not
  name the single-entry field and required no correction. No production code was
  modified; the amendment remains uncommitted. Commits `7633615` and `88fbdb6`
  remain unchanged.
- Baseline refresh (2026-09-19, ADR-0001 election amendment): the planning-compilation
  amendment commit `b2c6ef289bc1abebbeccfad81d7034ced81f4eb7`
  (`docs(phase-01): serialise workspace election in background`) is recorded as the
  current `approvedPlanningBaselineCommit`. It contains the amended `AGENTS.md`,
  `.planning/architecture/ARCHITECTURE.md`, the new
  `.planning/architecture/decisions/ADR-0001-background-serialised-workspace-election.md`,
  `.planning/DECISIONS.md`, `DESIGN.md` (ADR-0001, bounded 32-entry
  `recentCompletedRequests` idempotency ledger, listener and sender/target
  contracts), `PLAN.md` (Global Constraint 7, Interpretation 2 amendment, corrective
  task T13C, and T14/T16/T22/T24/T25/T26/T28 amendment notes), and the prior
  `STATUS.md`. The previous `3fb619730c8032d4aa121c5b8aa9649901b45f5f` is retained
  as the historical pre-amendment approved-plan baseline. Implementation branch
  `phoenix`; implementation status blocked pending the T13C correction; current
  task T13C; next action implement and verify T13C; blockers none; evidence status:
  T13 blocker recorded, T13C pending. This status record is committed separately
  from the amendment commit so the pre-implementation gate's status-record
  assertion is satisfied. No production code changed; commits `7633615` and
  `88fbdb6` remain unchanged.
- Task 13C (Corrective: Background-Serialised Workspace Election, ADR-0001) executed
  on `phoenix` in the repository root. RED confirmed before implementation on six
  suites (arbiter module unresolved; idempotency schemas, election payload schemas,
  the 13-type registry, and the 15-code registry absent; the client still wrote
  storage directly): Test Files 6 failed | 11 passed; Tests 20 failed | 84 passed.
  GREEN: `tests/core/workspace/workspaceElectionArbiter.test.ts` 41/41,
  `tests/core/workspace/workspaceElection.test.ts` 14/14, full unit suite 145/145
  (17 files), `typecheck` exit 0, `lint` exit 0, `prettier --check .` exit 0, and the
  phase chain `typecheck && lint && test` exit 0. Implemented
  `src/core/workspace/WorkspaceElectionArbiter.ts` (FIFO `ElectionSerialExecutor`;
  storage-derived idempotent arbiter with a bounded 32-entry
  `recentCompletedRequests` ledger; monotonic epochs; fail-closed persistence and
  read-back; Chrome-style `BackgroundElectionMessageListener` returning literal
  `true`) and refactored `WorkspaceElection.ts` into a read/request client that
  never writes `np_workspace_election` directly. Added error codes
  `WORKSPACE_ELECTION_REJECTED`/`WORKSPACE_ELECTION_FAILED` (ERROR_CODES 13 -> 15)
  and message types `workspace.election.request`/`workspace.election.response`
  (MESSAGE_TYPES 11 -> 13, with the allowed-source matrix and two `RuntimeEnvelope`
  arms). No new storage key, permission, dependency, `DiagnosticEvent`, IndexedDB,
  provider/MCP, or direct `chrome.*` usage. `runtimePrimitives.test.ts` was updated
  from the eleven- to the thirteen-entry closed-registry assertion (test-only
  completeness consequence, disclosed in `review.md`). T13C self-review PASS; the
  T13 Critical two-writer finding is remediated (simultaneous claims elect exactly
  one writer and the loser receives `WORKSPACE_ELECTION_REJECTED`), so corrected T13
  is accepted. Evidence recorded in `.planning/evidence/phase-01/verification.txt`
  and `.planning/evidence/phase-01/review.md` (Task 13C sections). Task commit
  `fix(phase-01): serialise workspace election through the background arbiter`.
  Current task T13C accepted; next task T14 — per approved Phase 01 `PLAN.md`.
  Commits `7633615` and `88fbdb6` remain unchanged.
- Task 14 (Prepare, Acknowledge, and Commit Handoff, amended by ADR-0001/rulings
  R14.1–R14.5) executed on `phoenix` in the repository root. RED confirmed before
  implementation: `tests/core/workspace/workspaceHandoff.test.ts` failed to resolve
  `@/core/workspace/WorkspaceHandoff` (module absent) — Test Files 1 failed | 17
  passed; Tests 145 passed; exit 1. GREEN: focused handoff suite 11/11 new tests;
  full unit suite 156/156 (18 files); `typecheck` exit 0; `lint` exit 0;
  `prettier --check .` exit 0; and the phase chain `typecheck && lint && test`
  exit 0. Implemented `src/core/workspace/WorkspaceHandoff.ts` with an injected
  `submitElectionRequest` (R14.1): `prepare` reads `np_workspace_election` and
  writes only `np_workspace_handoff` at `phase:'prepared'` (R14.2), `acknowledge`
  requires phase `'prepared'` and maps epoch/version mismatches to
  `WORKSPACE_EPOCH_MISMATCH`/`WORKSPACE_VERSION_CONFLICT`, and `commit` submits a
  fresh-`requestId` `workspace.election.request` with
  `operation:'handoff-commit'`/`expectedEpoch`/target identity, removes the handoff
  record and returns `committed` only on `accepted:true`, and otherwise fails
  closed (mapping `WORKSPACE_ELECTION_REJECTED`/`WORKSPACE_ELECTION_FAILED`, else
  `WORKSPACE_HANDOFF_FAILED`). The module never writes `np_workspace_election`;
  the arbiter remains its only writer. No new storage key, message type, error
  code, permission, dependency, or `DiagnosticEvent`; `WorkspaceElection.ts`,
  `WorkspaceElectionArbiter.ts`, `DESIGN.md`, `PLAN.md`, config, and T15+ files were
  not modified. T14 self-review PASS; evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 14 sections). Task commit
  `feat(phase-01): implement prepare acknowledge commit handoff`. Current task T14
  accepted; next task T15 — Mutation Versioning and Idempotency, per approved
  Phase 01 `PLAN.md`.
- Task 15 (Mutation Versioning and Idempotency) executed on `phoenix` in the repository
  root. Implementation tier advanced (write correctness). RED confirmed at
  `pnpm run test -- tests/core/workspace/workspaceMutations.test.ts` (exit 1; Vite import
  analysis failed to resolve `@/core/workspace/WorkspaceMutations`; the 156 pre-existing
  unit tests still passed). Created `src/core/workspace/WorkspaceMutations.ts` with the
  exact brief interfaces `MutationEngineState` (committedVersion/epoch/writerInstanceId/
  appliedMutationIds), `MutationRejectionCode` (the four canonical T03 codes
  `WORKSPACE_OWNERSHIP_AMBIGUOUS`/`WORKSPACE_EPOCH_MISMATCH`/`WORKSPACE_STALE_MUTATION`/
  `WORKSPACE_VERSION_CONFLICT`), `MutationOutcome` (applied/duplicate/rejected),
  `createMutationEngineState(input)`, `applyWorkspaceMutation(state, mutation)`,
  `CommitWorkspaceMutationDependencies` (store/now), and
  `commitWorkspaceMutation(deps, state, mutation)`. `applyWorkspaceMutation` checks
  duplicate `mutationId` first (returns `duplicate` with unchanged state, applying once),
  then rejects wrong writer, wrong epoch, stale base (`baseVersion !== committedVersion`),
  and non-monotonic resulting version (`resultingVersion !== baseVersion + 1`) with the
  canonical T03 codes, and on success advances `committedVersion = resultingVersion` and
  appends the mutation id, so version increments are strictly monotonic. Rejections log
  only the canonical code with a fixed `reason: 'mutation'` label through the redacting
  T03 `debugLog`. `commitWorkspaceMutation` returns the non-applied outcome unchanged
  before any write, so nothing is persisted unless the outcome is `applied`; only then it
  parses `WorkspaceMetadataSchema` from the payload with the resulting version and
  `deps.now()` and writes through the T12 `WorkspaceStore`. The applied-ID set is
  in-memory only (Phase 01 scope): no durable journal, no IndexedDB, no replay, no second
  mutation kind, no dependency/permission/manifest change, no direct `chrome.*`. Created
  `tests/core/workspace/workspaceMutations.test.ts` (7 tests: applied/next-version, four
  rejections, duplicate-once, and full persistence through the real T04 validated storage
  over the T04 mocked chrome storage). No type-level adaptation was required; the brief's
  production and test code typechecked as written under the pinned
  `noUncheckedIndexedAccess: true`. `pnpm exec prettier --check .` flagged only the T15
  module (import collapse at printWidth 100); it was formatted with identifiers, values,
  and codes unchanged, and no other file was reformatted. GREEN: focused test exit 0
  (19 files, 163 tests; T15-only 1 file, 7 tests), `typecheck` exit 0, `lint` exit 0,
  `prettier --check .` exit 0; phase chain `typecheck && lint && test` exit 0 (19 files,
  163 tests). Evidence recorded in `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 15 sections). Task commit
  `feat(phase-01): version and idempotently apply workspace mutations`. Current task T15
  accepted; next task T16 — per approved Phase 01 `PLAN.md`.
- Task 16 (Mirror Ordering, Gap Rehydration, and Writer Coordination, amended by
  ADR-0001 and binding rulings R16.1–R16.7) executed on `phoenix` in the repository
  root. Implementation tier advanced (convergence and ownership coordination). RED
  confirmed at `pnpm run test -- tests/core/workspace/workspaceSync.test.ts` (exit 1;
  Vite import analysis failed to resolve `@/core/workspace/WorkspaceSync`; the 163
  pre-existing unit tests still passed). Created
  `src/core/workspace/WorkspaceSync.ts` with the exact brief interfaces plus the
  rulings: `MirrorState`, `MirrorDecision`, `classifyMirrorEnvelope` (current-epoch
  next-version → apply; equal → duplicate; lower → stale; other epoch → epoch; gap →
  rehydrate), `applyMirrorEnvelope` (advances state only on apply), the five canonical
  envelope builders (`createRehydrateRequestEnvelope`,
  `createRehydrateResponseEnvelope`, `createHandoffPrepareEnvelope`,
  `createHandoffAckEnvelope`, `createHandoffCommitEnvelope`), and
  `createWorkspaceCoordinator` with the exact R16.1 dependency shape `{ bus, surface,
  instanceId, storage, election, handoff, store }`. `handleRehydrateRequest` is
  writer-only and prepares the Side Panel handoff to a Standalone requester;
  `handleHandoffPrepare` calls `deps.handoff.acknowledge(epoch, baseVersion)` and fails
  closed with `WORKSPACE_HANDOFF_FAILED` unless acknowledged before sending the
  `workspace.handoff.ack` envelope (R16.3); `handleHandoffAck` keeps the local-writer
  guard and calls `deps.handoff.commit` (T14 submits the arbiter `handoff-commit`
  request), reporting committed only on success (R16.4); `handleRelinquish` calls
  `deps.election.relinquish()` only for the validated local writer and reports
  relinquished only when accepted (R16.4); ordinary `workspace.mutation` handling
  mirrors current-epoch next-version, ignores duplicate/stale/other-epoch, and requests
  rehydration on a gap without ever routing through the background arbiter. `start()`
  (R16.2) subscribes to the five runtime message types and the `np_workspace_election`
  storage subscription; the subscription never writes the record and, for a sidepanel,
  delegates recovery to the T13C client via `claim('fallback')` for `missing` and
  `claim('stale-recovery')` for `invalid`. No third `workspace.election.response`
  subscription (R16.1); no direct `np_workspace_election` write. Created
  `tests/core/workspace/workspaceSync.test.ts` (17 tests) with a real in-memory bus that
  routes `workspace.election.request` to a real `WorkspaceElectionArbiter` and
  dispatches the schema-valid `workspace.election.response` to registered handlers,
  exercising the real T13C correlation and arbiter and the real T14 handoff. GREEN:
  explicit single-file run 17/17; `pnpm run test -- tests/core/workspace/workspaceSync.test.ts`
  exit 0 (20 files, 180 tests); `typecheck` exit 0; `lint` exit 0;
  `prettier --check .` exit 0 after formatting only the two new files; phase chain
  `typecheck && lint && test` exit 0. No new message type, storage key, error code,
  permission, dependency, or `DiagnosticEvent`; no IndexedDB; only the two allowed files
  were created and only `.planning` evidence/status modified. Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 16 sections, including the orchestration
  observation). Task commit
  `feat(phase-01): coordinate writer handoff and mirror convergence`. Current task T16
  accepted; next task T17 — per approved Phase 01 `PLAN.md`.
