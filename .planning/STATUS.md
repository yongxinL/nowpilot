# NowPilot Status

This file is the append-only status record required by `AGENTS.md` Section 16.
Update only the designated current-state section or append a dated entry. Do not
rewrite or delete prior history.

## Current state

- **Current phase:** Phase 01 — Runtime, Shells, and Workspace
- **Design status:** Approved
- **Plan status:** Approved
- **Implementation status:** In progress — T01 accepted; T02 accepted; T03 accepted; T04 accepted; T05 accepted; T06 accepted; T07 accepted; T08 accepted
- **Planning baseline branch:** `phoenix`
- **Implementation branch:** `phoenix`
- **Historical approved planning baseline commit:** `bd6ac44d6f562722c18f0d07e6910634e549c713`
- **Approved planning baseline commit:** `3fb619730c8032d4aa121c5b8aa9649901b45f5f`
- **Current task:** T08 — Sender and Envelope Boundary Validation (accepted)
- **Last commit:** T08 atomic commit `feat(phase-01): validate runtime envelope and sender at boundaries` (SHA captured post-commit in `.superpowers/sdd/PLAN/task-08-report.md`)
- **Verification result:** Pass — T08 focused test exit 0 (1 file, 11 tests), `typecheck` exit 0, `lint` exit 0, `prettier --check .` exit 0 (after formatting the T08 test file only); phase chain `typecheck && lint && test` exit 0 (11 files, 59 tests)
- **Next task:** T09 — (per approved Phase 01 `PLAN.md`)
- **Blockers:** None
- **Evidence path:** `.planning/evidence/phase-01/verification.txt` and `.planning/evidence/phase-01/review.md` (Task 08 sections)
- **Evidence status:** Task 08 verification and review recorded

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
