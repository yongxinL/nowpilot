# NowPilot Status

This file is the append-only status record required by `AGENTS.md` Section 16.
Update only the designated current-state section or append a dated entry. Do not
rewrite or delete prior history.

## Current state

- **Current phase:** Phase 01 — Runtime, Shells, and Workspace
- **Design status:** Approved and amended by ADR-0001 (background-serialised workspace election)
- **Plan status:** Approved and amended (corrective task T13C; T14/T16/T22/T24/T25/T26/T28 amendment notes)
- **Implementation status:** T01–T13C accepted; T14–T26 implemented and verified (T25 verification task; T26 approved non-code gate); T27 blocked pending operator manual acceptance; T28 not started
- **Planning baseline branch:** `phoenix`
- **Implementation branch:** `phoenix`
- **Historical approved planning baseline commit:** `bd6ac44d6f562722c18f0d07e6910634e549c713`
- **Approved planning baseline commit:** `b2c6ef289bc1abebbeccfad81d7034ced81f4eb7`
- **Current task:** T27 blocked — manual unpacked-extension acceptance requires operator browser screenshots; T28 not started
- **Last commit:** the T27 blocker-record commit `docs(phase-01): record task 27 manual acceptance blocker` (this commit), on top of `585ae17ce3cb6255933ccebc76a963b0f5edef96` (`test(phase-01): complete build and isolation gate`)
- **Verification result:** all automated Phase 01 gates pass at `585ae17` (`pnpm run verify:phase-1` exit 0: unit 35 files / 244 tests; manifest 1/1; isolation 1/1; manifest permissions exactly `sidePanel`+`storage`; no content script). T27 cannot be completed autonomously: it requires ten real Chrome screenshots including two of the Chrome Side Panel, a browser-chrome surface that needs a user gesture to open and cannot be captured by Playwright/headful automation; placeholder or fabricated screenshots are forbidden by `AGENTS.md` Section 13 and the task's own constraints.
- **Next action:** operator performs the ten T27 manual checks per approved Phase 01 `PLAN.md` and provides `.planning/evidence/phase-01/screenshots/*.png`, then T28 acceptance preparation proceeds
- **Blockers:** T27 manual unpacked-extension acceptance requires the operator (manual visual acceptance, `AGENTS.md` Section 18.7/19); T28 cannot start until T27 evidence exists
- **Evidence path:** `.planning/evidence/phase-01/verification.txt` and `.planning/evidence/phase-01/review.md` (Task 26 sections plus the Task 27 blocker section)
- **Evidence status:** T01–T26 verified; T27 blocker recorded; T28 pending

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
- Task 17 (Theme Schemas, Ant Design Configuration, Persistence, and Live Propagation)
  executed on `phoenix` in the repository root. Implementation tier balanced. RED confirmed
  at `pnpm run test -- tests/core/theme` (exit 1; Vite import analysis failed to resolve
  `@/core/theme/themeTypes`, `@/core/theme/antdConfig`, `@/core/theme/ThemeStore`, and
  `@/core/theme/useTheme`; the 20 pre-existing files / 180 tests still passed). Created
  `src/core/theme/themeTypes.ts` (`THEME_MODES` auto/light/dark; `ThemeMode`;
  `ThemeModeSchema`; `THEME_PACKS` default/liquid-glass/claude-warm; `ThemePack`;
  `ThemePackSchema`; `DEFAULT_THEME_MODE='auto'`; `DEFAULT_THEME_PACK='default'`;
  `resolveColorScheme(mode, prefersDark)`), `src/core/theme/antdConfig.ts`
  (`NOWPILOT_SEED`, `NOWPILOT_COMPONENTS`, `NOWPILOT_PACK_OVERLAYS`, `AntdConfigInput`,
  and `getAntdConfig` composing seed → pack overlay → default/dark algorithm with
  `compactAlgorithm` appended when compact, plus `cssVar { key: 'nowpilot' }`),
  `src/core/theme/ThemeStore.ts` (`ThemePreferences`, `ThemeStore`,
  `createThemeStore(storage)` reading/writing `np_theme`/`np_theme_pack` through the T04
  `chrome.storage.sync` mapping; invalid/missing values fall back to canonical defaults and
  log `THEME_INVALID_VALUE` with a fixed key label only; write failures log and fail closed
  with `THEME_PERSIST_FAILED`; `subscribe` emits combined preferences from
  `chrome.storage.onChanged`), and `src/core/theme/useTheme.ts` (`useTheme(store, options)`
  seeding canonical defaults, reading stored preferences with an active/unmount guard, and
  returning the composed `config` plus `mode`/`pack`). Created
  `tests/core/theme/themeTypes.test.ts` (3 tests), `antdConfig.test.ts` (5 tests),
  `themeStore.test.ts` (5 tests), and `useTheme.test.tsx` (1 test). Two Low-severity
  type-only test adaptations (T17-A/T17-B) documented in `review.md`: the storage
  reject mock uses `vi.mocked(chromeStorage.sync.set).mockRejectedValueOnce(...)`
  (TS2339 from the widened `StorageAreaMock` signature), and the `useTheme` store mock
  now invokes the stored listener after `writeMode`/`writePack` so the write-only
  `listener` variable satisfies `noUnusedLocals`/`no-unused-vars`; identifiers, values,
  and assertions are unchanged and the supplied implementation is untouched.
  `pnpm exec prettier --check .` flagged only the eight new T17 files, which were
  formatted with no identifier/value/assertion change. GREEN: explicit focused path exit 0
  (4 files, 14 tests), `pnpm run test` exit 0 (24 files, 194 tests), `typecheck` exit 0,
  `lint` exit 0, `prettier --check .` exit 0; phase chain `typecheck && lint && test`
  exit 0 (24 files, 194 tests). No new storage key, error code, message type, permission,
  dependency, provider, or `DiagnosticEvent`; no `@ant-design/x`; no direct `chrome.*`
  outside the T04 adapter; theme is independent of writer election. Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 17 sections). Task commit
  `feat(phase-01): add theme schemas config store and hook`. Current task T17 accepted;
  next task T18 — per approved Phase 01 `PLAN.md`.
- Task 18 (Standalone Page Registry, Core Registration, and Skeleton Pages) executed on
  `phoenix` in the repository root. Implementation tier economy. RED confirmed at
  `pnpm run test -- tests/core/registry` (exit 1; Vite import analysis failed to resolve
  `@/core/registry/StandalonePageRegistry` and `@/core/registry/registerCorePages`; the 24
  pre-existing files / 194 tests still passed). Created
  `src/core/registry/StandalonePageRegistry.ts` (`StandalonePageComponent`;
  `StandalonePageRegistry` with `register`/`get`/`has`/`entries`;
  `createStandalonePageRegistry()` backed by a `Map`, rejecting duplicate route ids and
  preserving registration order), `src/core/registry/registerCorePages.ts`
  (`createCorePageRegistry()` registering exactly the seven `STANDALONE_ROUTE_IDS` in
  canonical order; `CORE_PAGE_REGISTRY` singleton), and the six skeleton pages
  `src/components/standalone/pages/{ChatPage,AgentPage,NotesPage,WritePage,ToolsPage,
  DiagnosticsPage}.tsx` — each presentational and non-interactive with its canonical
  `data-testid="standalone-page-<id>"` and aria-label. Also created
  `src/components/options/OptionsPage.tsx` as a minimal skeleton
  (`data-testid="standalone-page-options"`) so the commit is atomic and green; Task 20
  replaces its body and adds `AppearanceSection.tsx` (not created here). Created
  `tests/core/registry/standalonePageRegistry.test.ts` (3 tests) and
  `registerCorePages.test.tsx` (2 tests). One Low-severity formatting pass (T18-A) applied
  only to `registerCorePages.ts` (import reflow); identifiers, values, and assertions
  unchanged. GREEN: explicit focused path exit 0 (2 files, 5 tests), `pnpm run test --
  tests/core/registry` exit 0 (26 files, 199 tests), `typecheck` exit 0, `lint` exit 0,
  `prettier --check .` exit 0; phase chain `typecheck && lint && test` exit 0 (26 files,
  199 tests). No new storage key, error code, message type, permission, dependency,
  provider, or `DiagnosticEvent`; no `@ant-design/x`; no `AppearanceSection.tsx`; no
  later-phase page logic, TeamGQM, ServiceNow, mock services, or inactive controls.
  Evidence recorded in `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 18 sections). Task commit
  `feat(phase-01): register standalone pages and skeletons`. Current task T18 accepted;
  next task T19 — per approved Phase 01 `PLAN.md`.
- Task 19 (Standalone Shell, Router, and Sider) executed on `phoenix` in the repository
  root. Implementation tier balanced. RED confirmed at `pnpm run test -- tests/components`
  (exit 1; 3 files failed with module-resolution errors for
  `@/components/standalone/StandaloneSider`, `StandaloneRouter`, and `StandaloneShell`;
  the 26 pre-existing files / 199 tests still passed). Created
  `src/components/standalone/StandaloneSider.tsx` (antd `Layout.Sider` with
  `aria-label="Workspace navigation"` and an inline `Menu` whose items come from
  `PRIMARY_STANDALONE_ROUTES` then `FOOTER_STANDALONE_ROUTES` — five primary plus two
  footer labels, no hard-coded array; `selectedKeys=[activeRoute]`; click casts the antd
  key to `StandaloneRouteId` and calls `onNavigate`),
  `src/components/standalone/StandaloneRouter.tsx` (`StandaloneRouter` renders
  `registry.get(routeId)` or `null`; `useStandaloneRoute` seeds `chat` via
  `resolveStandaloneRouteId`, reports the raw hash through `onRouteFallback` on fallback,
  applies a `focusSubscription` destination to state, and writes the hash with
  `window.history.replaceState` only — no `hashchange`/`popstate`, no history traversal),
  and `src/components/standalone/StandaloneShell.tsx` (`Layout` composing the Sider and a
  `Layout.Content` holding the routed page, wired to `useStandaloneRoute`). Created
  `tests/components/standaloneSider.test.tsx` (2 tests), `standaloneRouter.test.tsx`
  (3 tests including the `useStandaloneRoute` harness), and `standaloneShell.test.tsx`
  (2 tests). Authorised correction (T19-A): removed the unused
  `DEFAULT_STANDALONE_ROUTE_ID` import from `StandaloneRouter.tsx` that fails the pinned
  `noUnusedLocals`/eslint; all other imports and code are verbatim. Disclosed test-only
  correction (T19-B): because vitest runs without `globals: true` and the repo has no
  global `afterEach(cleanup)`, the brief's second Sider test matched two mounted Siders,
  so an explicit `afterEach(cleanup)` was added to the three component test files with
  bodies/assertions unchanged. `prettier --check .` reflowed only the new files (T19-C).
  GREEN: `pnpm run test -- tests/components` exit 0 (29 files, 206 tests), `typecheck`
  exit 0, `lint` exit 0, `prettier --check .` exit 0; phase chain
  `typecheck && lint && test` exit 0 (29 files, 206 tests). No new storage key, error
  code, message type, permission, dependency, provider, or `DiagnosticEvent`; no Side
  Panel navigation UI; no browser-history entry or traversal. Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 19 sections). Task commit
  `feat(phase-01): add standalone shell router and sider`. Current task T19 accepted;
  next task T20 — per approved Phase 01 `PLAN.md`.
- Task 20 (Options Appearance Controls) executed on `phoenix` in the repository root.
  Implementation tier balanced. RED confirmed at
  `pnpm run test -- tests/components/optionsAppearance.test.tsx` (exit 1; 1 file failed
  with a module-resolution error for `@/components/options/AppearanceSection`; the 29
  pre-existing files / 206 tests still passed). Created
  `src/components/options/AppearanceSection.tsx` (antd `Space`/`Typography.Title`/
  `Segmented`; Display mode maps `THEME_MODES` through `MODE_LABELS` = Auto/Light/Dark;
  Theme pack maps `THEME_PACKS` through `PACK_LABELS` = Default/Liquid Glass/Claude
  Warm; `onModeChange`/`onPackChange` receive the constrained `ThemeMode`/`ThemePack`)
  and replaced the skeleton body of `src/components/options/OptionsPage.tsx` with the
  brief implementation (optional `store?: ThemeStore`; defaults to
  `createThemeStore(createValidatedStorage(getChromeStorage()))`; mount effect subscribes
  and reads once behind an `active` flag and unsubscribes on cleanup; renders exactly
  `General → Card → AppearanceSection { Display mode, Theme pack }`; persists only via
  `themeStore.writeMode`/`writePack`; keeps `data-testid="standalone-page-options"` and
  `aria-label="Options"`). Created `tests/components/optionsAppearance.test.tsx`
  (3 tests: 2 AppearanceSection, 1 OptionsPage). Authorised test correction (T20-A): the
  brief's stub `read` callback inferred `{ mode: string; pack: string }` which fails the
  pinned `tsc --noEmit`, so its return was annotated `Promise<ThemePreferences>` with a
  type-only import; identifiers/values/assertions unchanged. Disclosed test-only
  correction (T20-B): because vitest runs without `globals: true` and the repo has no
  global `afterEach(cleanup)`, the three renders in the new file needed an explicit
  `afterEach(cleanup)`, with bodies/assertions unchanged. `prettier --check .` reflowed
  only the new `AppearanceSection.tsx` import (T20-C). GREEN:
  `pnpm run test -- tests/components` exit 0 (30 files, 209 tests), the T18
  `tests/core/registry/registerCorePages.test.tsx` still passes (`OptionsPage.store` is
  optional), `typecheck` exit 0, `lint` exit 0, `prettier --check .` exit 0; phase chain
  `typecheck && lint && test` exit 0 (30 files, 209 tests). No new storage key, error
  code, message type, permission, dependency, provider, or `DiagnosticEvent`; no other
  Options sections, provider dialog, or Chrome options page. Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 20 sections). Task commit
  `feat(phase-01): add options appearance controls`. Current task T20 accepted;
  next task T21 — per approved Phase 01 `PLAN.md`.

### 2026-09-20

- Task 21 (Chat-Only Side Panel Shell and Its Two Actions) executed on `phoenix` in
  the repository root. Implementation tier balanced. RED confirmed at
  `pnpm run test -- tests/components/sidePanelShell.test.tsx` (exit 1; 1 file failed
  with a module-resolution error for `@/components/sidepanel/SidePanelShell`; the 30
  pre-existing files / 209 tests still passed). Created
  `src/components/sidepanel/SidePanelShell.tsx` verbatim from the brief: an antd
  `Layout` whose `Layout.Header` holds `Typography.Text strong` "NowPilot" and a
  `Space` of exactly two `type="text"` icon buttons (`aria-label="Options"` calling
  `onNavigate('options')`; `aria-label="Switch to Full Chat"` calling
  `onNavigate('chat')`) and whose `Layout.Content` holds a
  `<section aria-label="Chat" role="region">` with `<Empty description="Start a
  conversation from a later phase." />` and a non-interactive
  `<div aria-hidden="true" data-testid="composer-placeholder" />`; exported
  `SidePanelShellProps` / `SidePanelShell` with `onNavigate(destination:
  StandaloneRouteId): void | Promise<void>`. Created
  `tests/components/sidePanelShell.test.tsx` (3 tests: Chat-only region and empty
  state with Agent/Notes/Tools/Diagnostics absent; only the Options and Switch to
  Full Chat actions invoking the canonical destinations; no textbox/send/attach
  controls). Disclosed test-only correction (T21-A): because vitest runs without
  `globals: true` and the repo has no global `afterEach(cleanup)`, an explicit
  `cleanup`/`afterEach(cleanup)` was added to the new test file, with
  bodies/identifiers/values/assertions unchanged. GREEN:
  `pnpm run test -- tests/components/sidePanelShell.test.tsx` exit 0 (31 files, 212
  tests) and `pnpm exec vitest run --project unit
  tests/components/sidePanelShell.test.tsx` exit 0 (1 file, 3 tests); `typecheck`
  exit 0, `lint` exit 0, `prettier --check .` exit 0; phase chain
  `typecheck && lint && test` exit 0 (31 files, 212 tests). No new storage key,
  error code, message type, permission, dependency, provider, or `DiagnosticEvent`;
  no interactive chat controls, model/provider selector, or Standalone admin UI. No
  `prettier` reflow was required. Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 21 sections). Task commit
  `feat(phase-01): add chat-only side panel shell and actions`. Current task T21
  accepted; next task T22 — per approved Phase 01 `PLAN.md`.
- Task 22 (WXT Entrypoints and Background Listener Wiring) executed on `phoenix`
  in the repository root. Implementation tier advanced (context wiring and
  isolation). The brief's text was stale against the accepted T13C/T14 contracts,
  so the binding controller rulings R22.1–R22.8 were applied and disclosed.
  RED confirmed at `pnpm run test -- tests/core/runtime/backgroundRuntime.test.ts`
  (exit 1; `TypeError: createBackgroundRuntime is not a function` in all 7 new
  cases; 1 failed | 31 passed files, 7 failed | 212 passed tests). Created
  `src/entrypoints/sidepanel/{index.html,main.tsx,App.tsx}` and
  `src/entrypoints/standalone/{index.html,main.tsx,App.tsx}` (both Apps build the
  R22.3 `sendMessage` response bridge into the bus's local listeners, pass `bus`
  to `createWorkspaceElection`, pass `submitElectionRequest: election.request` to
  `createWorkspaceHandoff`, call `election.claim('initial')`, and keep the
  per-surface compact flags, `CORE_PAGE_REGISTRY`, focus subscription, and
  `STANDALONE_ROUTE_FALLBACK` diagnostic; Standalone also
  `void coordinator.announce()`). Modified `src/entrypoints/background.ts`
  (validated storage, singleton tab controller as the only `chrome.tabs` caller,
  singleton arbiter, `createBackgroundRuntime(...).start()`, R22.2 synthetic
  relinquish close recovery with no direct `np_workspace_election` write, the
  synchronously registered R22.1 election listener, and the `onInstalled`
  side-panel behaviour); appended `createBackgroundRuntime` to
  `src/core/runtime/StandaloneNavigation.ts`; and made the R22.4 additive
  `request` exposure in `src/core/workspace/WorkspaceElection.ts`. Created
  `tests/core/runtime/backgroundRuntime.test.ts` (7 brief cases plus an optional
  R22.6 real-arbiter/real-storage listener-integration case asserting literal
  `true`, exactly one `sendResponse`, `source: 'background'`, target = requester,
  and `correlationId` = request id). Two Low-severity disclosed corrections:
  T22-A a type-only `listeners[0]!`/`removed[0]!` adaptation under the pinned
  `noUncheckedIndexedAccess`, and T22-B a Prettier reflow of only
  `src/entrypoints/sidepanel/App.tsx`. GREEN: focused test exit 0 (1 file, 8
  tests); `tests/core/workspace` regression exit 0 (7 files, 104 tests); full unit
  suite 32 files, 220 tests; `typecheck` exit 0; `lint` exit 0;
  `prettier --check .` exit 0; phase chain `typecheck && lint && test` exit 0;
  `pnpm run build` exit 0 with `.output/chrome-mv3/sidepanel.html` and
  `.output/chrome-mv3/standalone.html` present. Manifest permissions unchanged
  (`sidePanel`, `storage`; no `tabs`/`activeTab`/host permission) and now includes
  `side_panel.default_path = "sidepanel.html"`; the built `background.js`
  contains no React/antd/IndexedDB/provider markers. No new dependency,
  permission, storage key, message type, error code, or `DiagnosticEvent`;
  `BroadcastBus.ts`, `WorkspaceElectionArbiter.ts`, `WorkspaceHandoff.ts`,
  `WorkspaceSync.ts`, `DESIGN.md`, `PLAN.md`, ADR-0001, `wxt.config.ts`,
  `package.json`, and `tsconfig.json` were not modified. Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 22 sections). Task commit
  `feat(phase-01): wire WXT entrypoints and background listeners`. Current task
  T22 accepted; next task T23 — per approved Phase 01 `PLAN.md`.
- Task 23 (Generated-Manifest Inspection) executed on `phoenix` in the repository
  root. Implementation tier balanced. RED confirmed at
  `pnpm run test -- tests/build/manifestAssertions.test.ts` (exit 1; module-resolution
  failure for `./manifestChecks`; Test Files 1 failed | 32 passed (33); Tests 220
  passed (220); the pre-existing unit tests still passed). Created
  `tests/build/manifestChecks.ts` with the exact brief interfaces `GeneratedManifest`,
  `ManifestCheckResult`, and `checkGeneratedManifest(manifest, options)`; the checker
  fails closed with explicit messages for a wrong `manifest_version`, a permission set
  other than exactly `sidePanel` + `storage`, each forbidden permission (`tabs`,
  `activeTab`, `scripting`, `alarms`, `unlimitedStorage`), non-empty
  `host_permissions`, any `content_scripts`, a wrong `side_panel.default_path`, a
  missing `action`, a missing required icon size (16/32/48/128), and a missing
  `standalone.html`. Created `tests/build/manifest.test.ts` (dedicated `manifest`
  project; parses the real `.output/chrome-mv3/manifest.json` from actual build output
  per Approved Interpretation 4) and `tests/build/manifestAssertions.test.ts` (`unit`
  project; proves checker logic only). GREEN: focused assertions test exit 0 (33 files,
  226 tests), `pnpm run build` exit 0, `pnpm run test:manifest` exit 0 (1 file, 1 test)
  against the real generated manifest — permissions exactly `["sidePanel","storage"]`,
  no `host_permissions`, no `content_scripts`, `side_panel.default_path =
  "sidepanel.html"`, `action.default_title = "NowPilot"`, icons present, and
  `standalone.html` present — so no unexpected permission or content script and the
  STOP condition did not trigger. `typecheck` exit 0; `lint` exit 0; `prettier --check
  .` exit 0 after a reflow of only the three new T23 files; and the phase chain
  `typecheck && lint && test && build && test:manifest` exit 0 under binding ruling
  D23a (no `test:isolation`, whose file is created by T24). One Low-severity disclosed
  correction: T23-A a Prettier reflow of only the three new T23 test files
  (`manifestChecks.ts`, `manifest.test.ts`, `manifestAssertions.test.ts`);
  identifiers, values, permission names, and assertions unchanged. No new dependency,
  permission, storage key, message type, or error code; `wxt.config.ts`,
  `vitest.config.ts`, source files, `DESIGN.md`, and `PLAN.md` were not modified.
  Evidence recorded in `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 23 sections). Task commit
  `test(phase-01): inspect generated manifest`. Current task T23 accepted; next task
  T24 — per approved Phase 01 `PLAN.md`.
- Task 24 (Post-Build Bundle-Isolation Inspection, amended by ADR-0001) executed on
  `phoenix` in the repository root. Implementation tier balanced. RED confirmed at
  `pnpm run test -- tests/build/isolationAssertions.test.ts` (exit 1; module-resolution
  failure for `./isolationChecks`; Test Files 1 failed | 33 passed (34); Tests 226
  passed (226); the pre-existing unit tests still passed). Created
  `tests/build/isolationChecks.ts` with the exact brief interfaces
  `collectModuleGraph(entryFile, outDir): Map<string, string>`,
  `scanForbiddenMarkers(graph, markers): string[]`, `IsolationCheckResult`, and
  `checkBundleIsolation(outDir): IsolationCheckResult`: `collectModuleGraph` drains a
  bounded, cycle-safe queue over static relative `./…js` imports; `scanForbiddenMarkers`
  reports each forbidden marker found; `checkBundleIsolation` fails closed when the
  background bundle is missing or contains a forbidden marker, when the Side Panel
  bundle is missing or contains a `standalone-page-` marker, or when any
  `content*` bundle exists. Created `tests/build/isolation.test.ts` (dedicated
  `isolation` project; scans the real `.output/chrome-mv3` graph per Approved
  Interpretation 4) and `tests/build/isolationAssertions.test.ts` (`unit` project;
  proves the checker logic only). Real result: background graph contains none of the
  ten forbidden markers; Side Panel graph contains no `standalone-page-` marker; no
  content-script bundle exists; `checkBundleIsolation` reported zero failures, so the
  marker lists were unchanged and the "real marker found" STOP condition did not
  trigger. One disclosed Low-severity required reconciliation (recorded in
  `verification.txt`): the approved T24 plan is internally inconsistent for
  `scanForbiddenMarkers` — PLAN.md line 7481 / brief line 61 asserts `['indexedDB']`
  while PLAN.md line 7569 / brief line 149 returns `${file}:${marker}`; because the
  task freezes assertions, the implementation was reconciled to return the bare
  marker (the unit test failed with "expected [ 'background.js:indexedDB' ] to deeply
  equal [ 'indexedDB' ]" before the reconciliation). Two disclosed type-only
  adaptations: T24-A removed the brief's unused `statSync` import (TS6133), and T24-B
  used `match[1]!` in `collectModuleGraph` under the pinned
  `noUncheckedIndexedAccess` (TS2345; same class as T03 B5 / T05 D4 / T09). GREEN:
  focused assertions test exit 0 (34 files, 232 tests); `pnpm run build` exit 0;
  `pnpm run test:isolation` exit 0 (1 file, 1 test); `typecheck` exit 0; `lint` exit 0;
  `prettier --check .` exit 0; and `pnpm run verify:phase-1` exit 0 (typecheck, lint,
  unit 34 files / 232 tests, build, manifest 1 file / 1 test, isolation 1 file / 1
  test). No config, source, `wxt.config.ts`, `vitest.config.ts`, `DESIGN.md`, or
  `PLAN.md` change; no new dependency, permission, storage key, message type, error
  code, or `DiagnosticEvent`. Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 24 sections). Task commit
  `test(phase-01): inspect built bundle isolation`. Current task T24 accepted; next
  task T25 — per approved Phase 01 `PLAN.md`.
- Task 25 (Cross-Module Integration Tests, amended by ADR-0001/rulings R25.1–R25.4)
  executed on `phoenix` in the repository root. Created
  `tests/integration/workspaceIntegration.test.ts` (8 tests) using the R25.1 rig: one
  in-memory bus routes `workspace.election.request` to a real
  `createWorkspaceElectionArbiter` over the shared validated storage and dispatches
  the correlated `workspace.election.response` envelope (`source:'background'`,
  `target` = request source, `correlationId` = request envelope `id`) to registered
  handlers, with other envelope types dispatched to their handlers; the real arbiter
  is wrapped in a delegating `vi.fn` so it can be asserted to have seen no election
  request. Coverage: (1) two concurrent initial claims elect exactly one writer, the
  loser returns `held` naming the winner, and the persisted record matches the winner;
  (2) the epoch increases monotonically across claim -> handoff-commit -> recovery
  (`[0,1,2]`, all distinct); (3) a handoff-commit and a fallback claim queued against
  the same epoch produce exactly one accepted response and one
  `WORKSPACE_ELECTION_REJECTED`, with exactly one new epoch; (4) a fresh
  arbiter/client over the same session storage reconstructs the same writer/epoch and
  a duplicate request with the same `requestId` and identical fingerprint returns the
  persisted authoritative record (deep-equal) with the same epoch; (5) an ordinary
  `workspace.mutation` dispatched over the bus to the coordinator returns
  `{status:'mirrored'}` while the arbiter handle call count is unchanged, the bus
  records no new election request, and the raw `np_workspace_election` object is
  reference-identical and the validated record deep-equal before/after. Plus the
  brief's mirror-ordering/gap-rehydration, workspace restart durability, and
  theme-propagation tests; the theme test also proves no `np_workspace_election`
  record exists, confirming theme propagation is independent of election. All eight
  tests passed on first run against already-implemented behaviour, so T25 is recorded
  as a verification task (brief Step 2); no assertion was weakened and no production
  file was modified. GREEN: focused verbose run exit 0 (1 file, 8 tests); full unit
  suite exit 0 (35 files, 244 tests); `typecheck` exit 0; `lint` exit 0;
  `prettier --check .` exit 0; and the full phase chain `pnpm run verify:phase-1`
  exit 0 (typecheck, lint, unit 35 files / 244 tests, build, manifest 1 file / 1 test,
  isolation 1 file / 1 test). No config, source, `wxt.config.ts`, `vitest.config.ts`,
  `DESIGN.md`, `PLAN.md`, or ADR change; no new dependency, permission, storage key,
  message type, error code, or `DiagnosticEvent`. Evidence recorded in
  `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 25 sections). Task commit
  `test(phase-01): add cross-module integration tests`. Current task T25 accepted;
  next task T26 — per approved Phase 01 `PLAN.md`.

### 2026-09-20

- Task 26 (Complete Build and Isolation Gate, approved non-code gate task per
  `AGENTS.md` Section 11) executed on `phoenix` in the repository root. Evidence only;
  no production, test, or config file was created or modified. Step 1: from a clean
  build (`rm -rf .output`), `pnpm run verify:phase-1` exit 0 with the exact chain
  `typecheck -> lint -> test -> build -> test:manifest -> test:isolation` (unit 35
  files / 244 tests; build WXT 0.21.4 chrome-mv3, total 858.48 kB, built in 517 ms;
  manifest 1 file / 1 test; isolation 1 file / 1 test). Step 2: the node comparison of
  `verify:phase-1` and `verify:all` exit 0 (byte-identical strings). Step 3: verbose
  runs of `test`, `test:manifest`, and `test:isolation` all exit 0 with zero skipped
  tests (each project reports `N passed (N)`; no skipped/pending/todo rows). Step 4:
  the built `manifest.json` declares exactly `permissions:["sidePanel","storage"]`,
  `side_panel.default_path:"sidepanel.html"`, and no `content_scripts` or
  `host_permissions`; `shasum -a 256` recorded for `background.js`
  (`8c24f0480d0527d9e471e7f9df141a1753b2644ca8f32423761c11964e55dec0`), `sidepanel.html`
  (`a7575eeeef4230048f394fef47e7dfa152cddce2ec09d29a261f435326d6111a`), and
  `standalone.html`
  (`545585fb974259b3ab479f41efbd19b312fc23ffabef0624ebfc378b70fec25b`). ADR-0001
  registry completeness is exercised in the aggregate unit run: `MESSAGE_TYPES` has
  exactly 13 entries including `workspace.election.request`/`workspace.election.response`
  and `ERROR_CODES` has exactly 15 entries including
  `WORKSPACE_ELECTION_REJECTED`/`WORKSPACE_ELECTION_FAILED`, with diagnostic events kept
  separate. The only build advisory is the pre-existing Vite chunk-size warning
  (`WorkspaceSync-BiFvCgGz.js` 599.29 kB); not a gate failure. Step 5: evidence appended
  to `.planning/evidence/phase-01/verification.txt` and
  `.planning/evidence/phase-01/review.md` (Task 26 sections). Task commit
  `test(phase-01): complete build and isolation gate`. Current task T26 accepted and the
  gate passed; next task T27 — per approved Phase 01 `PLAN.md`.
- Task 27 (Manual Unpacked-Extension Acceptance and Evidence) BLOCKED at
  operator handoff (2026-09-19). T27 requires ten real Chrome screenshots of the
  unpacked extension, including two of the Chrome Side Panel. The Side Panel is a
  browser-chrome surface requiring a user gesture and cannot be captured by
  Playwright/headful automation; placeholder or fabricated screenshots are
  forbidden by `AGENTS.md` Section 13 and the task's own constraints. Per
  `AGENTS.md` Section 18.7 and Section 19, execution is stopped before T27 and
  T28 is not started. All automated gates pass at commit `585ae17`
  (`pnpm run verify:phase-1` exit 0: unit 35 files / 244 tests; manifest 1/1;
  isolation 1/1; permissions exactly `sidePanel` + `storage`; no content script).
  The ten required checks and screenshot filenames are in `PLAN.md` T27 Step 2.
  No check is marked passed and no screenshot was fabricated. Operator decision
  required: perform the ten manual checks and provide the screenshots, or
  authorise a documented automated-substitute evidence approach.
  T01–T26 remain accepted; commit `585ae17` retained unchanged.
