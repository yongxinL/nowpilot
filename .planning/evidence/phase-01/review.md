# Phase 01 Evidence — review.md

This file records specification-compliance and code-quality reviews required by
`AGENTS.md` Sections 12–14. Reviews are appended per task; prior records are not
overwritten.

---

## Task 02 — Test, Lint, Type-Check, Formatting, and Build Configuration (2026-09-19)

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `ba7ace2427755c66914de6462b24cc1619ef6c17`
**Classification:** configuration exception (`AGENTS.md` Section 11)

### Scope reviewed

- `package.json` scripts: `typecheck`, `lint`, `format`, `format:check`, `test`,
  `test:manifest`, `test:isolation`, `verify:phase-1`, `verify:all`; `dev`,
  `postinstall`, `build` preserved.
- `vitest.config.ts`: Vitest 5 `projects` `unit` / `manifest` / `isolation`.
- `tests/setup.ts`, `tests/config/toolchain.test.ts`.
- `eslint.config.mjs`, `.prettierrc`, `.prettierignore`.
- `tsconfig.json` corrections authorised by the controller (B1, B4).

### 1. Specification-compliance review

- Exact script names present; `verify:phase-1` and `verify:all` are byte-identical
  to the required chain
  `typecheck → lint → test → build → test:manifest → test:isolation`. PASS
- `pnpm run test` runs only `--project unit` and needs no build artefacts;
  `test:manifest` / `test:isolation` select only their own projects. PASS
- Vitest `projects` only (`unit`, `manifest`, `isolation`); `unit` excludes
  `tests/build/manifest.test.ts` and `tests/build/isolation.test.ts`; exact
  include/exclude preserved. The project-level `esbuild` option was removed per
  the controller's authoritative correction (Vite 8 uses oxc). PASS
- No excluded dependency (`@eslint/js`, `globals`, formatter/test helpers) added;
  no content-script test created. PASS
- `src/entrypoints/background.ts` unmodified; no `pnpm-workspace.yaml` created. PASS
- `tsconfig.json` changes are limited to the two authorised corrections
  (`"extends": "./.wxt/tsconfig.json"`, `"jsx": "react-jsx"`); all other fields
  and `include` preserved. PASS

### 2. Code-quality review

- `tests/config/toolchain.test.ts` remains deterministic: it reads
  `package.json` and configuration files from the repository root. `root` is a
  string ending in a path separator, so `${root}package.json` and `${root}${file}`
  stay valid. PASS
- The root computation no longer relies on `new URL('../../', import.meta.url)`,
  which Vite's client transform rewrites under `environment: 'jsdom'`. PASS
- No global state mutation, no network, no filesystem writes; `existsSync` /
  `readFileSync` only. PASS
- Error handling: test fails loudly on missing configuration; no empty catches. N/A.
- Complexity is minimal; no unnecessary abstraction. PASS

### 3. Security and privacy review

- No secrets, tokens, cookies, credentials, or sensitive content committed. PASS
- `.prettierignore` and `eslint.config.mjs` ignore built output
  (`.output/**`, `.wxt/**`, `node_modules/**`, `coverage/**`). PASS
- No test writes outside the workspace. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| B1 | High (blocking) | `tsconfig.json` `extends` missing `./`; `TS6053`, all `.wxt` compilerOptions ignored; `typecheck` unusable. | Fixed: `"extends": "./.wxt/tsconfig.json"`. |
| B2 | High (blocking) | `vitest.config.ts` project-level `esbuild: { jsx: 'automatic' }` is `TS2769` under Vite 8. | Fixed: option removed; oxc default handles JSX (controller-verified). |
| B3 | High (blocking) | jsdom client transform rewrote the plan test's `new URL('../../', import.meta.url)`, so `fileURLToPath` threw `ERR_INVALID_URL_SCHEME`. | Fixed: root computed with `resolve(dirname(fileURLToPath(import.meta.url)), '../..')`. |
| B4 | High (blocking, latent) | `.wxt/tsconfig.json` sets no `jsx`; later `.tsx` typecheck would fail `TS17004`. | Fixed: `"jsx": "react-jsx"` added. |
| — | Low (info) | First post-correction `pnpm run test` hit a transient forks-worker startup timeout (63.79s). | Not a code defect; immediate retry passed 4/4. Recorded in `verification.txt`. |

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

Focused Step 8 block (all exit 0): `pnpm run test` (4 passed),
`pnpm run typecheck`, `pnpm run lint`, `pnpm exec prettier --check .`,
`pnpm run build`. Phase-applicable chain
`typecheck && lint && test` exit 0. Full command output is recorded in
`verification.txt` (Task 02 section).

### Acceptance decision

**PASS** — Task 02 meets specification-compliance, code-quality, and
security/privacy requirements after the four authorised corrections.

---

## Task 03 — Operational Error and Diagnostic Registries with `debugLog` (2026-09-19)

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `986fd64` (T02 atomic commit)
**Classification:** code task (TDD RED→GREEN)

### Scope reviewed

- `src/core/error/errorCodes.ts` (created)
- `src/core/error/debugLog.ts` (created)
- `tests/core/error/errorCodes.test.ts` (created)
- `tests/core/error/debugLog.test.ts` (created)

### 1. Specification-compliance review

- `ERROR_CODES` is exactly the 13 DESIGN.md Section 5 operational codes in the approved
  order; no code is invented, renamed, added, or reordered. PASS
- `DIAGNOSTIC_EVENTS` is exactly the single `STANDALONE_ROUTE_FALLBACK`. PASS
- `ErrorCodeSchema` and `DiagnosticEventSchema` are two separate closed `z.enum` schemas;
  there is no `ErrorCode | DiagnosticEvent` union and no arbitrary-string overload.
  Cross-rejection is asserted by the tests. PASS
- `REDACTED_CONTEXT_KEYS` is the exact approved 12-key list; redaction is key-based only,
  plus replacement of non-primitive values with `[REDACTED]`. No redaction framework was
  introduced. PASS
- Only the four task files were created; no other file changed. No dependency added
  (`zod` was already an approved direct dependency). PASS
- Focused command, phase chain, and evidence/status records match the brief. PASS

### 2. Code-quality review

- `redactContext` is total and side-effect free: sensitive keys first, then primitives
  (`string`/`number`/`boolean`/`undefined`/`null`) preserved, all other values replaced.
  `JSON.stringify` therefore never serialises an object or array. PASS
- `debugLog` always routes `record.context` through `redactContext` before serialisation;
  when context is absent it emits `context: undefined` (dropped by `JSON.stringify`), so no
  unredacted field can reach the sink. PASS
- Records are strongly typed (`ErrorLogRecord.level: 'error'` with `code`;
  `DiagnosticLogRecord.level: 'debug'` with `event`); the diagnostic record carries no
  `code` field, asserted by the test. PASS
- No catch blocks, no global mutable state, no concurrency; default sink is `console`.
  Complexity is minimal and readable. PASS
- Error handling: none required; no empty catch. N/A.

### 3. Security and privacy review

- Raw secrets/tokens/passwords are never logged: `apiKey`, `password`, and `token` are
  redacted, asserted by test. Non-primitive bodies are never serialised. PASS
- No network, storage, IndexedDB, clipboard, or filesystem access; no side effects. PASS
- No sensitive value is embedded as a literal in production code. PASS
- No raw sensitive content committed in evidence. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| B5 | Low (typing) | The brief's verbatim `sink.debug.mock.calls[0][0]` is TS2532 under the T02-pinned `noUncheckedIndexedAccess: true`. | Fixed type-only with `sink.debug.mock.calls[0]![0]`; assertion values and behaviour unchanged; tsconfig untouched. |
| — | Info | `pnpm run test -- tests/core/error` also runs the pre-existing `tests/config/toolchain.test.ts` under Vitest 5; T03-only count confirmed with explicit file paths (2 files, 7 tests). | Recorded; not a defect. |

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/error` exit 1 — module-resolution failure for
`@/core/error/errorCodes` and `@/core/error/debugLog`. GREEN: focused test exit 0
(3 files, 11 tests; T03-only 2 files, 7 tests), `pnpm run typecheck` exit 0,
`pnpm run lint` exit 0, `pnpm exec prettier --check .` exit 0, and the phase-applicable
chain `typecheck && lint && test` exit 0. Full output is recorded in
`verification.txt` (Task 03 section).

### Acceptance decision

**PASS** — Task 03 meets specification-compliance, code-quality, and security/privacy
requirements; the single Low-severity B5 typing adaptation is documented and non-behavioural.

---

## Task 04 — Storage Keys and Validated Chrome-Storage Adapter

### 1. Specification-compliance review

- Task scope: create the five T04 files and modify only `tests/setup.ts`. No other
  file touched; `background.ts`, `wxt.config.ts`, `vitest.config.ts`, `tsconfig.json`,
  `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, and `package.json` unchanged. PASS
- `STORAGE_KEYS` contains exactly the seven DESIGN.md Section 9 keys in approved order;
  each declared once (test asserts `new Set(STORAGE_KEYS).size === STORAGE_KEYS.length`). PASS
- `STORAGE_KEY_AREAS` maps exactly `local/local/session/session/session/sync/sync`;
  `storageAreaForKey` returns the mapped area. PASS
- `STORAGE_AREAS`, `StorageArea`, `StorageKey`, the Chrome-storage structural types,
  `StorageReadResult`, `ValidatedStorage`, `createValidatedStorage`, and `getChromeStorage`
  match the interfaces produced by the brief. PASS
- All reads are Zod-validated through `safeParse`; malformed or absent data fails closed
  to `{status:'invalid'}` / `{status:'missing'}` and never throws (tested). PASS
- `write` calls `schema.parse(value)` before `set`, so invalid values are rejected before
  persistence (tested). PASS
- Approved dependency only (`zod`); no new dependency. PASS
- Acceptance-criterion coverage: the two required storage test files assert key/area
  mapping, missing/valid/invalid reads, validated writes, removal, and scoped validated
  change notifications. PASS

### 2. Code-quality review

- `read` uses `safeParse` and has no throw path on malformed data. PASS
- `write` fails fast on invalid input and never reaches the area `set`. PASS
- `subscribe` filters on the exact key and its mapped area; it removes the listener on
  unsubscribe and does not leak. PASS
- Concurrency/abort: no asynchronous coordination or AbortSignal surface is in scope for
  this pure adapter; underlying area calls are awaited. N/A
- Readability and complexity are minimal; no mutable module state. PASS
- `tests/setup.ts` default mock is a fallback only; storage tests still inject their own
  mocks explicitly. PASS

### 3. Security and privacy review

- Values are never logged or persisted outside the mapped `chrome.storage` area; no raw
  content is emitted. PASS
- No network, IndexedDB, filesystem, clipboard, or host-page access; no side effects. PASS
- `getChromeStorage` throws a fixed, non-sensitive error when `chrome.storage` is absent;
  it does not read or reveal stored values. PASS
- No secret or credential is embedded in production code or evidence. PASS
- Session-area keys remain ephemeral coordination state and are not treated as durable. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| B6 | Low (typing) | The plan's `tests/helpers/chromeMock.ts` imports `StorageArea` from `@/core/storage/chromeStorage`, which the plan's adapter did not export. | Fixed type-only with an additive `export type { StorageArea, StorageKey } from './storageKeys';`; no runtime surface changed. |
| B7 | Low (typing) | The plan's object-literal generic methods (`async read<T>(key, schema)`) fail the pinned `strict`/`noUnusedParameters` check (TS6133 'T' unused; TS7006 implicit any) because generic contextual typing does not flow into object-literal methods. | All three methods given their explicit `ValidatedStorage` signatures; behaviour and values unchanged. |
| B8 | Low (typing) | The plan's `changes[key]` is optional under the pinned `noUncheckedIndexedAccess: true` (TS2532 on `change.newValue`). | Minimal non-null assertion `changes[key]!` applied inside the existing `key in changes` guard; assertions and behaviour unchanged. |
| — | Info | `pnpm run test -- tests/core/storage` also runs the pre-existing unit tests under Vitest 5; T04-only count confirmed with explicit file paths (2 files, 10 tests). | Recorded; not a defect. |

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/storage` exit 1 — module-resolution failure for
`@/core/storage/storageKeys` and `@/core/storage/chromeStorage`. GREEN: focused test
exit 0 (T04-only 2 files, 10 tests), `pnpm run typecheck` exit 0, `pnpm run lint` exit 0,
`pnpm exec prettier --check .` exit 0, and the phase-applicable chain
`typecheck && lint && test` exit 0 (5 files, 21 tests). Full output is recorded in
`verification.txt` (Task 04 section).

### Acceptance decision

**PASS** — Task 04 meets specification-compliance, code-quality, and security/privacy
requirements; the three Low-severity typing adaptations (B6–B8) are documented,
type-only, and non-behavioural.

---

## Task 05 — Canonical Standalone Route Registry

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `7a4cee0755659730c1fa7a10276555870faf42f2` (T04 atomic commit)
**Classification:** code task (TDD RED→GREEN); implementation tier economy

### Scope reviewed

- `src/core/registry/standaloneRoutes.ts` (created)
- `tests/core/registry/standaloneRoutes.test.ts` (created)

### 1. Specification-compliance review

- `STANDALONE_ROUTE_IDS` is exactly the seven DESIGN.md Section 11 identifiers in the
  approved order (`chat`, `agent`, `notes`, `write`, `tools`, `options`, `diagnostics`);
  no route is invented, renamed, added, or reordered. PASS
- `DEFAULT_STANDALONE_ROUTE_ID` is `chat`. PASS
- `PRIMARY_STANDALONE_ROUTES` is exactly Chat, Agent, Notes, Write, Tools (5) and
  `FOOTER_STANDALONE_ROUTES` is exactly Options, Diagnostics (2); placement is driven by
  the registry, not a parallel hard-coded array. PASS
- Hash representation is `#/<id>` for every route, produced by `standaloneHashRoute` and
  stored as each definition's `hash`; there is no path or query routing. PASS
- `StandaloneRouteIdSchema` is a closed `z.enum` over the id list; `teamgqm` and
  `servicenow` are absent and rejected (asserted). PASS
- Unknown or empty hashes normalise to `chat` with an explicit `fellBack: true` signal and
  no user-facing error; the module itself emits no diagnostic (T18 owns the
  `STANDALONE_ROUTE_FALLBACK` wiring). PASS
- Only the `standalone` stem is used; no `app` naming family. No React import, no page
  component, no TeamGQM/ServiceNow entry, no browser-history behaviour. PASS
- Only the two task files were created; no other file changed. No dependency added
  (`zod` was already an approved direct dependency). PASS

### 2. Code-quality review

- The module is pure and deterministic: no network, storage, IndexedDB, filesystem, DOM,
  timers, or mutable module state; a single `RegExp` literal (not `g`-flagged) is reused,
  so no lastIndex statefulness. PASS
- `STANDALONE_ROUTES` is typed `Readonly<Record<StandaloneRouteId, ...>>`, so each id is
  required and no arbitrary string key is accepted; `noUncheckedIndexedAccess` does not
  widen these explicit union-keyed properties. PASS
- `parseStandaloneRouteId` fails closed to `undefined`; `resolveStandaloneRouteId`
  composes it and returns a strongly typed discriminated result. PASS
- Error handling: none required; no catch blocks; no empty catch. N/A
- Readability and complexity are minimal; labels and ordering are declared once. PASS

### 3. Security and privacy review

- No secrets, tokens, cookies, credentials, or sensitive content in production code or
  evidence. PASS
- No data is read, logged, persisted, or transmitted; the module has no side effects. PASS
- No untrusted content is evaluated; hash input is only regex-matched and matched against
  a closed allow-list, never interpolated into markup or execution. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| D4 | Low (typing) | The brief's `const candidate = match[1]` is `string | undefined` under the T02-pinned `noUncheckedIndexedAccess: true` (RegExpExecArray is array-like), failing `.includes(candidate)` (TS2345). | Fixed type-only with `match[1]!` inside the existing `if (!match)` guard; regex and behaviour unchanged; tsconfig untouched. |
| — | Info | `pnpm run test -- tests/core/registry/standaloneRoutes.test.ts` also runs the pre-existing unit tests under Vitest 5; T05-only count confirmed with an explicit file path (1 file, 7 tests). | Recorded; not a defect. |

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/registry/standaloneRoutes.test.ts` exit 1 —
module-resolution failure for `@/core/registry/standaloneRoutes`. GREEN: focused test
exit 0 (6 files, 28 tests; T05-only 1 file, 7 tests), `pnpm run typecheck` exit 0,
`pnpm run lint` exit 0, `pnpm exec prettier --check .` exit 0, and the phase-applicable
chain `typecheck && lint && test` exit 0 (6 files, 28 tests). Full output is recorded in
`verification.txt` (Task 05 section).

### Acceptance decision

**PASS** — Task 05 meets specification-compliance, code-quality, and security/privacy
requirements; the single Low-severity D4 typing adaptation is documented, type-only, and
non-behavioural.

---

## Task 06 — Workspace Types and Durable Metadata Schemas

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `25ac23ed3e8ffefd9561a121273ca15785e079c1` (T05 atomic commit)
**Classification:** code task (TDD RED→GREEN); implementation tier economy

### Scope reviewed

- `src/core/workspace/workspaceTypes.ts` (created)
- `tests/core/workspace/workspaceTypes.test.ts` (created)

### 1. Specification-compliance review

- `WORKSPACE_SCHEMA_VERSION` is exactly `1`; `WorkspaceMetadataSchema.schemaVersion` is
  `z.literal(WORKSPACE_SCHEMA_VERSION)`. PASS
- `WorkspaceWriterTypeSchema` is the closed enum `sidepanel | standalone`; `background`
  is rejected (asserted by test). PASS
- `HandoffPhaseSchema` is exactly `idle | prepared | acknowledged | committed`. PASS
- `InstanceIdSchema` is `z.string().min(1)`; `createInstanceId()` returns the runtime
  `crypto.randomUUID()` (test asserts uniqueness). PASS
- `ElectionRecordSchema` matches DESIGN.md Section 6 election metadata exactly: writer
  type, instance ID, epoch, committed version, handoff state, and target ID (nullable
  when idle). No field invented, renamed, added, or removed. PASS
- `WorkspaceMutationSchema` matches DESIGN.md Section 6 mutation protocol exactly:
  mutation ID (uuid), writer instance ID, epoch, base version, resulting version, type,
  and schema-valid payload (`WorkspaceMetadataSchema`). PASS
- Approved Interpretation 3: `WorkspaceMutationKindSchema` is the single closed literal
  `'workspace.metadata.set'`; the test asserts both acceptance of that exact kind and
  rejection of `'workspace.notes.set'`. No generic/arbitrary mutation name and no
  note/conversation/memory/provider/later-phase kind exists. Extending the registry
  requires a future approved design and plan. PASS
- `HandoffRecordSchema` requires `acknowledgedAt` present-or-null (tested for the null
  and absent cases); `StandaloneTabRecordSchema` rejects a negative `tabId` (tested). PASS
- `WorkspaceVersionRecordSchema`, `HandoffRecord`, `StandaloneTabRecord`,
  `WorkspaceMutation` and all named types are exported as specified by the brief. PASS
- No store, election, handoff, or mutation logic; no IndexedDB, no network. Only the two
  task files (plus evidence and STATUS) changed; no dependency added (`zod` was already
  an approved direct dependency). PASS

### 2. Code-quality review

- Schemas are fully closed; no `any`; no arbitrary-string overloads. PASS
- `createInstanceId` and `createEmptyWorkspaceMetadata` are pure and side-effect free;
  the module has no mutable state, timers, or I/O. PASS
- Numeric fields consistently use `.int().nonnegative()`, so negative and fractional
  versions/timestamps are rejected. PASS
- `crypto.randomUUID` is the runtime Web Crypto API available in extension contexts;
  no polyfill or new dependency was introduced. PASS
- Readability and complexity are minimal; canonical identifiers are declared once and
  types are derived with `z.infer`. PASS
- Error handling: none required; no catch blocks; no empty catch. N/A

### 3. Security and privacy review

- No secrets, tokens, cookies, credentials, or sensitive content in production code or
  evidence. PASS
- No data is read, logged, persisted, or transmitted; the module performs no side
  effects. PASS
- The payload schema is constrained to workspace metadata, so the single mutation kind
  cannot carry note/conversation/memory/provider content. PASS
- `InstanceIdSchema` requires a non-empty identifier but imposes no sensitive content. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Low (formatting) | `pnpm exec prettier --check .` flagged only the T06 test file (final assertion line wrapping). | Fixed by formatting the T06 test file only; values and assertions unchanged; no other file reformatted. |
| — | Info | `pnpm run test -- tests/core/workspace/workspaceTypes.test.ts` also runs the pre-existing unit tests under Vitest 5; T06-only count confirmed with an explicit file path (1 file, 7 tests). | Recorded; not a defect. |

No Critical, High, or Medium finding remains unresolved. No type-level deviation from the
brief was required: the implementation and test both typecheck under the pinned
`strict`/`noUncheckedIndexedAccess` configuration without non-null assertions.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/workspace/workspaceTypes.test.ts` exit 1 —
module-resolution failure for `@/core/workspace/workspaceTypes`. GREEN: focused test
exit 0 (7 files, 35 tests; T06-only 1 file, 7 tests), `pnpm run typecheck` exit 0,
`pnpm run lint` exit 0, `pnpm exec prettier --check .` exit 0, and the phase-applicable
chain `typecheck && lint && test` exit 0 (7 files, 35 tests). Full output is recorded in
`verification.txt` (Task 06 section).

### Acceptance decision

**PASS** — Task 06 meets specification-compliance, code-quality, and security/privacy
requirements; no type-level deviation was needed and no blocking finding remains.

---

## Task 07 — Runtime Primitives, Payload Schemas, and `RuntimeEnvelope`

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `f85718931b80e63751506b9347b4597c045bfbdd` (T06 atomic commit)
**Classification:** code task (TDD RED→GREEN); implementation tier balanced

### Scope reviewed

- `src/core/runtime/RuntimeSurface.ts` (created)
- `src/core/runtime/OperationId.ts` (created)
- `src/core/runtime/MessageType.ts` (created)
- `src/core/runtime/messageSchemas.ts` (created)
- `src/core/runtime/RuntimeEnvelope.ts` (created)
- `tests/core/runtime/runtimePrimitives.test.ts`, `tests/core/runtime/messageSchemas.test.ts`,
  `tests/core/runtime/runtimeEnvelope.test.ts` (created)

### 1. Specification-compliance review

- `RuntimeSurface` is exactly `'background' | 'sidepanel' | 'standalone'`; `content` is
  absent and rejected (asserted). `RUNTIME_TARGETS` adds only `'*'`, matching
  `RuntimeSurface | '*'`. `RuntimeSurfaceSchema` and `RuntimeTargetSchema` are closed
  `z.enum`s; `WorkspaceWriterSurface` excludes `background`. PASS
- `MessageType` is exactly the eleven DESIGN.md Section 5 strings in the approved order;
  no type is invented, renamed, added, or reordered. `MessageTypeSchema` is a closed
  `z.enum`; `workspace.unknown` is rejected (asserted). PASS
- Approved Interpretation 1: `MESSAGE_TYPE_ALLOWED_SOURCES` is the single canonical
  allowed-source registry in `src/core/runtime/MessageType.ts`, typed
  `Readonly<Record<MessageType, readonly RuntimeSurface[]>>` and explicit for all eleven
  types. There is no wildcard, permissive default, or fallback source, and no second copy.
  It is consumed only by T08/T09 (not yet implemented). PASS
- The eleven canonical type→payload-schema names in `messageSchemas.ts` match DESIGN.md
  Section 5 exactly: `WorkspaceMutationPayload`, `WorkspaceHandoffPreparePayload`,
  `WorkspaceHandoffAckPayload`, `WorkspaceHandoffCommitPayload`, `WorkspaceRelinquishPayload`,
  `WorkspaceRehydrateRequestPayload`, `WorkspaceRehydrateResponsePayload`,
  `StandaloneOpenPayload`, `StandaloneFocusPayload`, `StandaloneClosedPayload`,
  `RuntimeErrorPayload`. PASS
- Approved Interpretation 2: `WorkspaceRehydrateRequestPayload` carries `sinceVersion`,
  `instanceId`, and `writerType` (tested). `WorkspaceWriterType` is the T06 closed enum. PASS
- `StandaloneOpenPayload` / `StandaloneFocusPayload` validate `destination` with the T05
  `StandaloneRouteIdSchema`; `options` accepted and `teamgqm` rejected (tested). PASS
- `RuntimeErrorPayload.code` validates with the T03 `ErrorCodeSchema`; a valid code is
  accepted and `NOT_A_CODE` rejected (tested). PASS
- `RUNTIME_PAYLOAD_SCHEMAS` maps every `MessageType` exactly once (registry completeness
  test asserts key-set equality). `RuntimeMessageSchema` is one closed discriminated union.
  `MESSAGE_TYPES` is re-exported once from `messageSchemas.ts`; `RuntimeEnvelope.ts` imports
  payloads from that module, so there is no second message-type list. PASS
- `RuntimeEnvelopeSchema` is one closed discriminated union over the eleven types; base
  fields match DESIGN.md Section 5 exactly (`envelopeVersion: 1`, `id`, `source`, `target`,
  `timestamp`, optional `correlationId`/`electionEpoch`/`workspaceVersion`, plus per-variant
  `type`/`payload`). `parseRuntimeEnvelope` uses `safeParse`, so an unknown type or a
  payload/type mismatch fails closed with no `RUNTIME_ENVELOPE_INVALID` side effect here
  (T08 owns emitting the canonical error). PASS
- No dependency added (`zod` was already an approved direct dependency); no IndexedDB,
  network, storage, or side effect. Only the five source files, three test files, and
  evidence/STATUS changed. PASS

### 2. Code-quality review

- Both unions are genuinely closed and discriminated; unknown types cannot match a variant,
  so `safeParse` fails closed as required (tested for unknown type, payload mismatch,
  invalid target, and unexpected envelope version). PASS
- The three redaction-free modules are pure and side-effect free; no mutable module state,
  timers, I/O, or catch blocks; no empty catch. PASS
- Types are derived once (`z.infer`) and canonical registries are declared once; no
  duplication of message-type strings or payload-schema names. PASS
- `.int().nonnegative()` is applied consistently to every numeric payload/envelope field,
  so negative or fractional versions, epochs, and timestamps are rejected (tested for
  mutation epoch and rehydrate `sinceVersion`). PASS
- Readability is minimal; the `MESSAGE_TYPE_ALLOWED_SOURCES` mapping is exhaustive by type,
  so adding a type without a source list is a compile error. PASS
- Error handling: none required at this pure-schema layer; no catch blocks. N/A

### 3. Security and privacy review (assets and trust boundaries)

- Assets/boundaries: this task defines the runtime message contract and the closed
  allowed-source registry that T08/T09 will enforce at the extension-context trust
  boundary. No secrets, tokens, cookies, clipboard, passwords, prompts, or customer content
  are handled, logged, persisted, or transmitted. PASS
- Zod strips unknown extra keys rather than accepting them; no payload schema accepts
  arbitrary additional fields as meaningful. This is explicitly not sender validation:
  T08 must still validate the sender and envelope at the boundary. No such validation is
  claimed here. PASS
- No message body uses Chrome local storage; nothing is persisted in this task. Data has no
  instruction authority: page/message content is schema-validated data only and cannot
  modify policy, prompts, permissions, or code. PASS
- No side effects, so no permission-policy, idempotency, or postcondition concerns arise in
  this task. `parseRuntimeEnvelope` is read-only. PASS
- No manifest or permission change; content scripts are untouched. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Low (formatting) | `pnpm exec prettier --check .` flagged only `src/core/runtime/messageSchemas.ts` and `tests/core/runtime/messageSchemas.test.ts` (line wrapping at printWidth 100). | Fixed by formatting only those two T07 files; identifiers, message-type strings, payload-schema names, and assertions unchanged; no other file reformatted. |
| — | Info | `pnpm run test -- tests/core/runtime` also runs the pre-existing unit tests under Vitest 5; T07-only count confirmed with explicit file paths (3 files, 13 tests). | Recorded; not a defect. |

No Critical, High, or Medium finding remains unresolved. No type-level deviation from the
brief was required: production code and tests both typecheck under the pinned
`strict`/`noUncheckedIndexedAccess` configuration without non-null assertions.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/runtime` exit 1 — module-resolution failure for all five
`@/core/runtime/*` modules across the three new suites. GREEN: focused test exit 0
(10 files, 48 tests; T07-only 3 files, 13 tests), `pnpm run typecheck` exit 0,
`pnpm run lint` exit 0, `pnpm exec prettier --check .` exit 0, and the phase-applicable
chain `typecheck && lint && test` exit 0 (10 files, 48 tests). Full output is recorded in
`verification.txt` (Task 07 section).

### Acceptance decision

**PASS** — Task 07 meets specification-compliance, code-quality, and security/privacy
requirements; the only finding is a Low-severity formatting correction and no blocking
finding remains.

---

## Task 08 — Sender and Envelope Boundary Validation

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `af65f4f2adda54bf2d6f08d2043de5edbec5bfbc` (T07 atomic commit)
**Classification:** code task (TDD RED→GREEN); implementation tier advanced (trust boundary)

### Scope reviewed

- `src/core/runtime/RuntimeEnvelope.ts` (validation exports appended; existing schema untouched)
- `tests/core/runtime/boundaryValidation.test.ts` (created)

### 1. Specification-compliance review

- Interfaces match the brief exactly: `SenderIdentity`, `isTrustedExtensionSender`,
  `getAllowedSources(type): readonly RuntimeSurface[]`,
  `isSourceAllowed(type, source): boolean`, `InboundValidationResult`, and
  `validateInboundEnvelope(input, sender, extensionId)`. PASS
- Approved Interpretation 1: the test suite covers every `MessageType` and every one of its
  allowed sources (acceptance loop), a representative disallowed source for each type that
  has one (rejection loop), and a completeness test asserting every `MessageType` has exactly
  one explicit non-empty `MESSAGE_TYPE_ALLOWED_SOURCES` entry with no wildcard/permissive
  default. `Object.keys(MESSAGE_TYPE_ALLOWED_SOURCES).sort()` equals
  `[...MESSAGE_TYPES].sort()`. PASS
- Fail-closed mapping matches the brief: an envelope that fails schema validation (including
  an unknown type string) yields `RUNTIME_ENVELOPE_INVALID`; an unregistered type or a
  disallowed source yields `RUNTIME_SENDER_REJECTED`. No path returns silent success. PASS
- `validateInboundEnvelope` parses the envelope first, then validates sender identity, then
  the source. Sender data is used only inside `isTrustedExtensionSender`, after the envelope
  contract is established; no sender field is dereferenced or logged elsewhere. PASS
- Only `src/core/runtime/RuntimeEnvelope.ts` was appended and one test file created, plus
  `.planning` evidence/STATUS; no dependency change; no manifest or permission change. PASS

### 2. Code-quality review

- Validation is small, readable, and closed: `getAllowedSources` fails closed to `[]` for an
  unregistered type, `isSourceAllowed` is a membership test, and `isTrustedExtensionSender`
  short-circuits on a missing/mismatched id and on a non-extension url scheme when a url is
  present. PASS
- `validateInboundEnvelope` never throws to callers; every failure returns a discriminated
  result and logs the canonical error code only. No catch blocks; no empty catch. PASS
- No duplication: the allowed-source map remains canonical in `MessageType.ts`; the boundary
  reads it rather than re-declaring a second list. The error codes are the T03 canonical
  `ErrorCode` values via `createErrorRecord`. PASS
- No type-level deviation was required under the pinned `strict` /
  `noUncheckedIndexedAccess` configuration; no non-null assertions were needed. PASS

### 3. Security and privacy review (assets and trust boundaries)

- Trust boundary: this task is the boundary itself. It validates the closed envelope contract
  and the sender identity before any sender-derived value is trusted. Only the extension's
  own origin (`chrome-extension://<extensionId>/`) is accepted; a foreign extension id or a
  non-extension scheme is rejected. PASS
- Fail closed: unknown message types (schema-invalid) are `RUNTIME_ENVELOPE_INVALID`;
  unregistered types that somehow reach the source check, and disallowed sources, are
  `RUNTIME_SENDER_REJECTED`. There is no wildcard, permissive default, or silent acceptance.
  PASS
- No raw content logged: failure paths log a canonical error code with only a fixed
  `reason` label (`schema` | `identity` | `source`). No sender value, envelope id, payload, or
  message body is logged, persisted, or committed. The T03 `debugLog` still applies key-based
  redaction before any sink. PASS
- Input is treated as untrusted data: `input` is typed `unknown` and schema-validated; an
  unknown type string cannot satisfy the discriminated union and fails closed. Data has no
  instruction authority. PASS
- No side effects of consequence: the module only reads registries and logs a redacted
  structured record; no network, storage, IndexedDB, or filesystem access. PASS
- Content-script isolation, manifest permissions, and password handling are unaffected. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Low (formatting) | `pnpm exec prettier --check .` flagged only `tests/core/runtime/boundaryValidation.test.ts` (line wrapping at printWidth 100). | Fixed by formatting only the T08 test file; identifiers, message-type strings, payloads, and assertions unchanged; `RuntimeEnvelope.ts` and no other file reformatted. |
| — | Info | `pnpm run test -- tests/core/runtime/boundaryValidation.test.ts` also runs the pre-existing unit tests under Vitest 5; T08-only count confirmed with an explicit path (1 file, 11 tests). | Recorded; not a defect. |

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/runtime/boundaryValidation.test.ts` exit 1 — 11 failures,
all `TypeError: ... is not a function` for the three not-yet-exported validators; the 48
pre-existing unit tests still passed. GREEN: focused test exit 0 (1 file, 11 tests),
`pnpm run typecheck` exit 0, `pnpm run lint` exit 0, `pnpm exec prettier --check .` exit 0,
and the phase-applicable chain `typecheck && lint && test` exit 0 (11 files, 59 tests). Full
output is recorded in `verification.txt` (Task 08 section).

### Acceptance decision

**PASS** — Task 08 meets specification-compliance, code-quality, and security/privacy
requirements; the only finding is a Low-severity formatting correction and no blocking
finding remains.

## Task 09 — Canonical Broadcast Bus

### 1. Specification-compliance review

- Interfaces match the brief exactly: `RawMessageListener`, `BroadcastBusDependencies`
  (`extensionId`, `sendMessage`, `addMessageListener`, `removeMessageListener`),
  `EnvelopeHandler`, `BroadcastBus` (`send`, `on`), and `createBroadcastBus(deps)`.
  PASS
- Inbound validation is central: `dispatch` calls `validateInboundEnvelope(message,
  sender, deps.extensionId)` (the T08 boundary) and returns before any handler runs when
  the result is not ok. Untrusted senders and malformed envelopes are never dispatched;
  there is no silent success. PASS
- All outgoing messages are `RuntimeEnvelope`; `on` is keyed only by the canonical
  `MessageType` closed union. No invented message types, no raw payload, and no sender
  logging. PASS
- Only `src/core/runtime/BroadcastBus.ts` and `tests/core/runtime/broadcastBus.test.ts`
  were created, plus `.planning` evidence/STATUS; no dependency, manifest, or permission
  change; no content script; no direct `chrome.*`/`chrome.tabs` reference. PASS

### 2. Code-quality review

- The bus is small and closed: `send` delegates to the injected transport; `on` lazily
  creates one raw transport listener per distinct subscribed `MessageType`, reuses it for
  additional handlers of the same type, and removes it when its last handler is removed.
  PASS
- Unsubscribe cleanup is correct: a handler is deleted from its type set, and the raw
  listener plus its map entry are removed only when every type set is empty. No leak, no
  duplicate raw listener per type. PASS
- No catch blocks; no empty catch; no global mutable state. Validation failure is a
  fail-closed early return. PASS
- One type-only adaptation: `handler.mock.calls[0][0].type` is TS2532 under the pinned
  `noUncheckedIndexedAccess`; changed to `handler.mock.calls[0]![0].type` (same class as
  T03 B5). No production assertion was added beyond the two `!` already in the brief. PASS

### 3. Security and privacy review (assets and trust boundaries)

- Trust boundary: the bus is a transport, not a validator; it delegates every inbound
  message to the T08 `validateInboundEnvelope` boundary with the injected `extensionId`
  and the raw sender before any handler runs. A foreign extension id, a non-extension URL
  scheme, a disallowed source, or a schema-invalid envelope is rejected upstream and never
  reaches a subscriber. PASS
- Fail closed: a non-ok validation result returns from `dispatch`; no wildcard,
  permissive default, or silent acceptance exists. PASS
- No raw content logged: the bus itself logs nothing; the only records are the T08
  canonical error codes with fixed reason labels emitted by `validateInboundEnvelope`.
  No sender value, envelope id, payload, or message body is logged, persisted, or
  committed. PASS
- Input is untrusted data: `RawMessageListener` receives `unknown`/`unknown`; no sender
  value is dereferenced by the bus, and data has no instruction authority. PASS
- No consequential side effects: the module only registers/removes listeners and forwards
  one envelope to an injected transport; no network, storage, IndexedDB, or filesystem
  access. Content-script isolation, manifest permissions, and password handling are
  unaffected. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Low (type-only) | The brief's `handler.mock.calls[0][0].type` is TS2532 under `noUncheckedIndexedAccess`. | Applied `handler.mock.calls[0]![0].type`; values and assertions unchanged; tsconfig.json unmodified. |
| — | Low (formatting) | `pnpm exec prettier --check .` flagged only the two new T09 files (line wrapping at printWidth 100). | Fixed by formatting only `src/core/runtime/BroadcastBus.ts` and `tests/core/runtime/broadcastBus.test.ts`; identifiers, message-type strings, payloads, and assertions unchanged; no other file reformatted. |

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/runtime/broadcastBus.test.ts` exit 1 — module-resolution
failure for `@/core/runtime/BroadcastBus`; the 59 pre-existing unit tests still passed.
GREEN: explicit focused path exit 0 (1 file, 5 tests), `pnpm run test` exit 0 (12 files,
64 tests), `pnpm run typecheck` exit 0, `pnpm run lint` exit 0,
`pnpm exec prettier --check .` exit 0, and the phase-applicable chain
`typecheck && lint && test` exit 0. Full output is recorded in `verification.txt`
(Task 09 section).

### Acceptance decision

**PASS** — Task 09 meets specification-compliance, code-quality, and security/privacy
requirements; the only findings are a Low-severity type-only assertion and a Low-severity
formatting correction, and no blocking finding remains.

## Task 09 FIX — Single Transport Listener

### Finding (Critical, from controller review)

The original `on` registered one raw transport listener per distinct subscribed
`MessageType`, while each listener's `dispatch` fanned out over all listener maps.
With N distinct types subscribed, one inbound message was dispatched N times, each
matching handler fired N times, and invalid messages were validated/logged N times.
This would break T16 (5 subscriptions) and T22. Reproduced by the controller: two
subscriptions produced two raw listeners and a matching handler fired twice.

### Resolution

Replaced `src/core/runtime/BroadcastBus.ts` with the controller-specified corrected
implementation: a single lazily-created raw transport listener (`ensureListener`) and one
`handlersByType: Map<MessageType, Set<EnvelopeHandler>>`. `on` adds a handler to its
type set; the returned unsubscribe removes the handler, deletes an empty type entry, and
removes the raw listener (setting it undefined) only when no type has any handler. The
public interface is unchanged. Each inbound message is now validated once and dispatched
once.

### Regression test

Added `delivers each inbound message exactly once across multiple subscribed types` to
`tests/core/runtime/broadcastBus.test.ts`: two distinct types (`standalone.open`,
`standalone.focus`) subscribed on one bus; asserts `listeners.size === 1`; delivers both
messages to every registered listener; asserts each handler fires exactly once for its own
type and not for the other. It fails (expected 2 to be 1, and duplicate dispatch) against
the previous fan-out implementation and passes with the fix.

### Verification evidence

RED (regression test vs. old implementation): `pnpm exec vitest run --project unit
tests/core/runtime/broadcastBus.test.ts` exit 1 — 1 failed (expected 2 to be 1) | 5
passed. GREEN: same command exit 0 (1 file, 6 tests); `pnpm run test` exit 0 (12 files,
65 tests); `pnpm run typecheck` exit 0; `pnpm run lint` exit 0;
`pnpm exec prettier --check .` exit 0; phase chain `typecheck && lint && test` exit 0.
Full output is recorded in `verification.txt` (Task 09 FIX section).

### Acceptance decision

**PASS** — The Critical fan-out defect is fixed, the regression test pins the
single-listener and once-per-subscriber behaviour, all focused and phase verification
passes, and no blocking finding remains.

## Task 10 — Standalone Navigation Request Contract

### Scope and files

Created `src/core/runtime/StandaloneNavigation.ts` and
`tests/core/runtime/standaloneNavigation.test.ts`; no other production file changed.
Interfaces produced exactly as specified: `StandaloneNavigationOpenRequest`,
`StandaloneNavigationFocusRequest`, `StandaloneNavigationRequest`,
`createStandaloneOpenEnvelope`, `createStandaloneFocusEnvelope`,
`readStandaloneNavigationRequest`, `openStandalone`, `focusStandalone`.

### Specification-compliance review

- Destination is the canonical typed `StandaloneRouteId` from the T05 registry; no raw
  routing strings are constructed and UI callers never need `chrome.tabs`.
- Envelopes use only the canonical `standalone.open` / `standalone.focus` message types
  and are schema-valid (`parseRuntimeEnvelope` succeeds in the test).
- `openStandalone` targets `background`; `focusStandalone` targets `standalone`.
- The destination is schema-validated (`StandaloneRouteIdSchema.parse`) before envelope
  creation; there are no invented destinations.
- No handoff logic; no dependency change; no IndexedDB/network; no content script.
- `openStandalone` source is `WorkspaceWriterSurface`; `focusStandalone` additionally
  accepts `'background'`, matching `MESSAGE_TYPE_ALLOWED_SOURCES` for each type.
- No blocking finding.

### Code-quality review

- `createNavigationEnvelope` is a single private helper; the four public functions are
  thin and readable. The `Pick<BroadcastBus, 'send'>` dependency keeps the module
  testable and avoids pulling the full bus interface.
- `readStandaloneNavigationRequest` narrows on the closed discriminated union and
  returns `undefined` for unrelated envelopes, so it never throws on a non-navigation
  envelope.
- Test quality: covers both envelope builders (type, target, source, payload, schema
  validity), request reading for both kinds, the unrelated-envelope negative case, and
  both bus senders via a minimal injected bus double.
- Low-severity type-only adaptation: the brief's `bus.send.mock.calls[0][0].type` is
  TS2532/TS2493 under `noUncheckedIndexedAccess: true` with the untyped
  `vi.fn(async () => {})` args tuple. The mock parameter is typed
  `_envelope: RuntimeEnvelope` and the index uses `bus.send.mock.calls[0]![0].type`
  (same class as T03 B5 / T09). Values and assertions are unchanged and `tsconfig.json`
  is unmodified.
- Low-severity formatting: `pnpm exec prettier --check .` flagged only the two T10 files;
  both were formatted with identifiers, values, and assertions unchanged, and no other
  file was reformatted.

### Security and privacy review

- No raw message, sender, payload, or destination is logged.
- No direct `chrome.*`, `chrome.tabs`, IndexedDB, network, or storage access in this
  module; it only builds validated envelopes and forwards them through the injected bus.
- No secrets or sensitive data are handled.
- No blocking finding.

### Verification evidence

RED: `pnpm run test -- tests/core/runtime/standaloneNavigation.test.ts` exit 1 — module
resolution failure for `@/core/runtime/StandaloneNavigation` (1 failed | 12 passed).
GREEN: focused run exit 0 (13 files, 71 tests); `pnpm run typecheck` exit 0;
`pnpm run lint` exit 0; `pnpm exec prettier --check .` exit 0; phase chain
`typecheck && lint && test` exit 0. Full output is recorded in `verification.txt`
(Task 10 section).

### Acceptance decision

**PASS** — Task 10 meets specification-compliance, code-quality, and security/privacy
requirements; the only findings are Low-severity type-only and formatting corrections,
and no blocking finding remains.

---

## Task 11 — Singleton Standalone Tab Controller

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `9578e5a613bf38b93ca6b9c02c4eea1ac349314f` (T10 atomic commit)
**Classification:** code task (TDD RED→GREEN); implementation tier advanced (tab identity
and recovery)

### Scope reviewed

- `src/core/runtime/StandaloneNavigation.ts` (T11 controller appended; T10 contract untouched)
- `tests/core/runtime/standaloneTabController.test.ts` (created)

### 1. Specification-compliance review

- Interfaces and types match the brief exactly: `StandaloneTabApi`
  (`get`/`create`/`update`/`focusWindow`), `StandaloneTabControllerDependencies`
  (`tabs`/`storage`/`buildStandaloneUrl`/`sendFocus`/`now`), `StandaloneOpenResult`
  (`created`/`focused` with `tabId`, or `failed` with `STANDALONE_OPEN_FAILED` /
  `STANDALONE_TAB_INVALID`), `StandaloneTabController` (`open`/`handleTabRemoved`/
  `readRecord`), and `createStandaloneTabController(deps)`. PASS
- Singleton identity is the stored Standalone tab ID in session storage:
  `STANDALONE_TAB_KEY = 'np_standalone_tab'`, which the T04 adapter maps to the
  `session` area. PASS
- `open` reads the stored ID, validates the live tab with the non-sensitive
  `tabs.get(record.tabId)` and compares only the returned `id` (no URL/title read); when
  live it calls `tabs.update(tabId, { active: true })`, `tabs.focusWindow(tabId)`, and
  forwards a schema-valid `standalone.focus` envelope (`createStandaloneFocusEnvelope`
  from T10) before returning `focused`. PASS
- Stale handling: a rejected `get` or an id-less tab clears the stored record and
  `tabs.create(buildStandaloneUrl(destination))`, then persists `{ tabId, openedAt }`.
  No duplicate tab is created while a live stored tab exists. PASS
- The controller uses only the injected `StandaloneTabApi` and contains no direct
  `chrome.*`, no `tabs.query`, and no active-page URL/title/favicon/content read. The
  `chrome.tabs` implementation is wired only in the background entrypoint (T22). PASS
- Close recovery is authoritative via stored-ID validation in `handleTabRemoved`
  (`tabs.onRemoved` is wired by T22); the non-authoritative `standalone.closed` message
  is not used. PASS
- Destination is the canonical typed `StandaloneRouteId`; no invented route, message
  type, storage key, or error code. Canonical error codes `STANDALONE_TAB_INVALID` /
  `STANDALONE_OPEN_FAILED` come from the T03 registry; the malformed-record and
  stale/create/missing-id paths log only a fixed `reason` label. PASS
- No dependency change; no IndexedDB; no network. Only `StandaloneNavigation.ts` and the
  new test file changed, plus `.planning` evidence/STATUS. PASS
- Scope note: the global "preserve committed version / never authorise two writers /
  stale-writer recovery" constraint belongs to the workspace coordinator (T12+); the tab
  controller owns singleton tab identity, and its stale-identity recovery is tested. PASS

### 2. Code-quality review

- The controller is a small closure over injected dependencies; `readRecord` is shared by
  `open` and `handleTabRemoved`, so malformed/missing/stale handling is single-sourced.
- Fail-closed handling is explicit: create failure and a missing returned id both return
  `{ status: 'failed', code: 'STANDALONE_OPEN_FAILED' }` with a canonical error record.
  Both `catch` blocks set a closed outcome and log; there are no empty catches.
- Deterministic stale recovery: an absent/rejected tab is removed before creation, so a
  later open cannot observe a partially-cleared record.
- No overlap or ambiguity with T10: the existing envelope builders and
  `openStandalone`/`focusStandalone` exports are unchanged; the controller composes the
  T10 `createStandaloneFocusEnvelope` rather than duplicating envelope logic.
- Test quality: 7 focused tests cover create-and-store, focus-and-forward (including the
  forwarded `standalone.focus` envelope and destination), stale-ID recovery, malformed
  record treated as absent, fail-closed missing id, removal of the singleton, and
  ignoring an unrelated removal. Storage is the real T04 validated adapter over the T04
  mocked chrome storage; only the tab API, URL builder, focus sender, and clock are
  injected doubles (necessary boundaries).
- No mutable module state; no timers; no I/O beyond the injected storage/tabs; no `any`.
  PASS

### 3. Security and privacy review (assets and trust boundaries)

- No URL, title, favicon, page content, prompt, clipboard, password, token, or customer
  content is read or logged. The only tab-surface observation is the returned numeric
  `id` from `tabs.get`; the stored record holds only `{ tabId, openedAt }`.
- The controller never calls `chrome.*`; the sole tab surface is the injected
  `StandaloneTabApi`, which is provided by the background context. Tab identity is
  session-scoped ephemeral state (`np_standalone_tab`), never durable.
- Failure paths log only the canonical error code plus a fixed reason label
  (`record` / `stale` / `create` / `missing-id`); no sender, page, or message body is
  logged. `debugLog` still applies key-based redaction before the sink.
- No side effects beyond the intended tab focus/create and session record write; no
  network, IndexedDB, filesystem, or content-script access. Content-script isolation,
  manifest permissions, and password handling are unaffected.
- No secrets or sensitive data embedded in production code or evidence. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Low (type-only) | The brief's `sendFocus = vi.fn(async () => undefined)` infers an empty args tuple, so `sendFocus.mock.calls[0][0]` is TS2532/TS2493 under `noUncheckedIndexedAccess`. | Mock parameter typed `_envelope: RuntimeEnvelope` and indices changed to `mock.calls[0]![0]`; assertions/values unchanged; tsconfig unmodified. |
| — | Low (type-only) | The brief's `tabs.create = vi.fn(async () => ({ id: 42 }))` infers `{ id: number }`, so `mockResolvedValueOnce({})` is TS2345. | Mock annotated `async (): Promise<{ id?: number }> => ({ id: 42 })`, matching `StandaloneTabApi.create`; the test still supplies `{}`; values/assertions unchanged. |
| — | Low (formatting) | `pnpm exec prettier --check .` flagged only the T11 test file (line wrapping at printWidth 100). | Formatted the T11 test file only; identifiers, values, and assertions unchanged; `StandaloneNavigation.ts` and no other file reformatted. |
| — | Info | `pnpm run test -- tests/core/runtime/standaloneTabController.test.ts` also runs the pre-existing unit tests under Vitest 5; T11-only count confirmed with an explicit path (1 file, 7 tests). | Recorded; not a defect. |

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/runtime/standaloneTabController.test.ts` exit 1 — 7
failures, all `TypeError: createStandaloneTabController is not a function`; the 71
pre-existing unit tests still passed. GREEN: explicit focused path exit 0 (1 file, 7
tests), `pnpm run test` exit 0 (14 files, 78 tests), `pnpm run typecheck` exit 0,
`pnpm run lint` exit 0, `pnpm exec prettier --check .` exit 0, and the phase-applicable
chain `typecheck && lint && test` exit 0. Full output is recorded in `verification.txt`
(Task 11 section).

### Acceptance decision

**PASS** — Task 11 meets specification-compliance, code-quality, and security/privacy
requirements; the only findings are two Low-severity type-only adaptations (disclosed)
and a Low-severity formatting correction, and no blocking finding remains.

## Task 12 — Workspace Metadata Store and Durable Version

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `29595fc` (T11 atomic commit)
**Classification:** code task (TDD RED→GREEN); implementation tier balanced

### Scope reviewed

- `src/core/workspace/WorkspaceStore.ts` (created)
- `tests/core/workspace/workspaceStore.test.ts` (created)

### 1. Specification-compliance review

- Interfaces and types match the brief exactly: `WorkspaceMetadataReadResult`
  (`missing` | `valid` + `metadata` | `invalid`), `WorkspaceStore`
  (`readMetadata`/`writeMetadata`/`readVersion`/`writeVersion`), and
  `createWorkspaceStore(storage: ValidatedStorage): WorkspaceStore`. PASS
- Durability matches DESIGN.md Section 9: the only keys written are `np_workspace_meta`
  and `np_workspace_version`, both mapped by the T04 `STORAGE_KEY_AREAS` to
  `chrome.storage.local`. No `session`/`sync` value is treated as durable workspace
  state, and no session value is read or written by this store. PASS
- Durable state is metadata plus the committed version only: `writeMetadata` persists the
  schema-valid metadata and a `{ committedVersion, updatedAt }` version record derived
  from it; `writeVersion` persists only the version record. No notes, conversation
  bodies, prompts, or blobs. PASS
- Fail closed: a valid read returns `valid`; an invalid record returns the canonical
  `invalid` (metadata) / `0` (version) result; an absent record returns the canonical
  `missing` (metadata) / `0` (version) result. No path throws and none reports silent
  success. PASS
- The invalid-metadata path logs the canonical T03 `WORKSPACE_INVALID_METADATA` code with
  only a fixed `key` label (`np_workspace_meta` / `np_workspace_version`); no invented
  code or message. PASS
- Canonical schemas are reused from T06 (`WorkspaceMetadataSchema`,
  `WorkspaceVersionRecordSchema`, `WorkspaceMetadata`); no duplicated or weakened
  schema. Reads and writes go through the injected T04 `ValidatedStorage`; there is no
  direct `chrome.*`, no IndexedDB, no network, no provider/MCP call, and no new
  dependency. PASS
- Only `WorkspaceStore.ts` and the one new test file changed, plus `.planning`
  evidence/STATUS. PASS

### 2. Code-quality review

- `readMetadata` is a total function over the three adapter outcomes (missing/valid/
  invalid); the `invalid` branch returns before the fall-through, so no malformed record
  can be misclassified as missing. PASS
- `readVersion` collapses both the invalid and missing cases to the safe default `0`
  (an absent committed version is legitimately version zero), while still logging the
  canonical code for the invalid case. PASS
- `writeMetadata` writes the metadata first and the version record second through the
  schema-validating adapter, so a rejected write cannot persist an unvalidated value.
  No partial-write repair or silent mutation is attempted. PASS
- No mutable module state, timers, I/O beyond the injected storage, or `any`; the returned
  object satisfies the `WorkspaceStore` interface. PASS
- Test quality: 4 focused tests cover the fresh-profile missing/zero case, the
  persist-and-read-back case with the local-area assertion (and the explicit
  `sync.set` non-call), the invalid-metadata `invalid` case, and the invalid-version
  zero fallback. Storage is the real T04 validated adapter over the T04 mocked chrome
  storage; no production code is mocked. PASS

### 3. Security and privacy review (assets and trust boundaries)

- No page content, note, memory, prompt, clipboard, password, token, API key, or customer
  content is read, logged, or persisted. The stored values are the non-sensitive
  workspace metadata (`schemaVersion`, non-negative integer `committedVersion`,
  non-negative integer `updatedAt`). PASS
- The only log records are the canonical `WORKSPACE_INVALID_METADATA` code plus a fixed
  storage-key label, passed through the T03 `debugLog` key-based redaction sink; no raw
  stored value or payload is logged. PASS
- Values are schema-validated on both read and write; malformed or tampered stored data
  is surfaced as `invalid`/`0` rather than repaired, trusted, or thrown. PASS
- Writes target the `local` area only; no secrets in `sync`/`session`, no encryption
  claim (deferred to Phase 2), no external transmission. Content-script isolation,
  manifest permissions, and password handling are unaffected. PASS
- No secrets or sensitive data embedded in production code or evidence. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Low (formatting) | `pnpm exec prettier --check .` flagged only `src/core/workspace/WorkspaceStore.ts` (the `WorkspaceMetadataReadResult` union reflowed at printWidth 100). | Formatted only the T12 module; the type members, identifiers, and behaviour are unchanged; the test file and no other file were reformatted. |

No Critical, High, Medium, or required-Low behavioural finding remains unresolved. No
type-only adaptation was required for T12; the brief's test and implementation
typechecked as written under the pinned `noUncheckedIndexedAccess: true`.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/workspace/workspaceStore.test.ts` exit 1 — Vite import
analysis failed to resolve `@/core/workspace/WorkspaceStore`; the 78 pre-existing unit
tests still passed. GREEN: explicit focused path exit 0 (1 file, 4 tests),
`pnpm run test` exit 0 (15 files, 82 tests), `pnpm run typecheck` exit 0,
`pnpm run lint` exit 0, `pnpm exec prettier --check .` exit 0, and the phase-applicable
chain `typecheck && lint && test` exit 0. Full output is recorded in `verification.txt`
(Task 12 section).

### Acceptance decision

**PASS** — Task 12 meets specification-compliance, code-quality, and security/privacy
requirements; the only finding is a Low-severity formatting correction and no blocking
finding remains.

---

## Task 13 — Writer Election

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `ba13aef` (T12 atomic commit `feat(phase-01): persist workspace metadata and version`)
**Classification:** code task (TDD RED→GREEN); implementation tier advanced (ownership correctness)

### Scope reviewed

- `src/core/workspace/WorkspaceElection.ts` (created)
- `tests/core/workspace/workspaceElection.test.ts` (created)

### 1. Specification-compliance review

- Interfaces match the brief exactly: `WorkspaceElectionDependencies`
  (`storage`/`store`/`writerType`/`instanceId`/`now`), `ElectionReadResult`
  (`missing` | `valid`+`record` | `invalid`), `ElectionClaimResult`
  (`acquired`+`record`+`recovered` | `held`+`record`), `WorkspaceElection`
  (`read`/`claim`/`relinquish`/`isWriter`), and
  `createWorkspaceElection(deps: WorkspaceElectionDependencies): WorkspaceElection`. PASS
- Single live writer: `claim` reads the election record first; when the record is
  `valid` it returns `{ status: 'held', record }` and never writes, so a valid existing
  writer is never displaced by any code path. PASS
- A first eligible surface may claim only when no valid writer exists: the record write
  happens exclusively in the `missing`/`invalid` branch. PASS
- Writer identity is never inferred from surface type alone: `isWriter` requires
  `record.writerInstanceId === deps.instanceId` AND
  `record.writerType === deps.writerType`; a same-type different-instance record is
  rejected (tested) and a different-type same-instance record is rejected by the type
  conjunct. PASS
- Session storage only for election: `np_workspace_election` is a T04 `session`-area
  key (DESIGN.md Section 9); `relinquish` also removes `np_workspace_handoff`, likewise
  session. No `local`/`sync` key is touched. PASS
- Committed version preserved on claim: `claim` reads
  `deps.store.readVersion()` (T12 durable version in `chrome.storage.local`) and stores
  it on the freshly elected record; the test seeds committedVersion 4 and asserts the
  acquired record carries 4. PASS
- Invalid election metadata fails closed and logs the canonical T03
  `WORKSPACE_INVALID_METADATA` code with only a fixed `key` label
  (`np_workspace_election`); recovery writes a fresh record and reports
  `recovered: true`. There is no silent writer pick: every acquisition returns an
  explicit record and status. PASS
- Scope boundaries: no handoff transitions (T14), no mutations (T15), no background
  broker; the owner is always a UI surface (`WorkspaceWriterType` is
  `sidepanel | standalone`). No IndexedDB, network, direct `chrome.*`, or new
  dependency. Only `WorkspaceElection.ts` and the new test file changed, plus `.planning`
  evidence/STATUS. PASS

### 2. Code-quality review

- `read` is a total function over the three adapter outcomes and never throws; the
  `invalid` branch returns before the `missing` fall-through, so malformed state cannot
  be misclassified as absent. PASS
- `claim` has a single write site guarded by the `missing`/`invalid` condition, so no
  interleaving of the validation logic can produce two live writers. Build is a small
  pure helper deriving the record from `deps` plus the preserved committed version. PASS
- `relinquish` removes both session records through the schema-validating adapter; no
  direct storage access. PASS
- No mutable module state, timers, catch blocks, empty catches, or `any`. The returned
  object satisfies the `WorkspaceElection` interface. PASS
- Test quality: 7 focused tests cover first acquisition, committed-version preservation,
  non-displacement of a valid other-instance writer, idempotent same-instance claim,
  invalid-metadata recovery, relinquish of both records, and the `isWriter` identity
  matrix (own record / undefined / other instance). Storage is the real T04 validated
  adapter over the T04 mocked chrome storage; no production code is mocked. PASS
- No type-only deviation was required: production code and test both typecheck as
  written under the pinned `strict`/`noUncheckedIndexedAccess: true`. The brief-supplied
  `isWriter` expression typechecks with no error at that line, so the documented
  STOP/BLOCKED condition did not trigger. PASS

### 3. Security and privacy review (assets and trust boundaries)

- No page content, note, memory, prompt, clipboard, password, token, API key, or
  customer content is read, logged, or persisted. The stored election record is
  non-sensitive coordination state (writer type, instance id, non-negative integer
  epoch/committed version, handoff phase, nullable target id, non-negative integer
  timestamp). PASS
- The only log record is the canonical `WORKSPACE_INVALID_METADATA` code plus a fixed
  storage-key label, passed through the T03 `debugLog` key-based redaction sink; no raw
  stored value, instance id, or payload is logged. PASS
- Ownership is explicit and fail-closed: an invalid record is never used as a writer
  identity, and a valid record held by another instance is never overwritten or
  re-elected. No wildcard, permissive default, or silent take-over exists. PASS
- Writes target the `session` area only and go through the T04 schema-validating
  adapter; no secrets in `local`/`sync`, no external transmission, no side effects
  beyond the two session keys. Content-script isolation, manifest permissions, and
  password handling are unaffected. PASS
- No secrets or sensitive data embedded in production code or evidence. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Low (formatting) | `pnpm exec prettier --check .` flagged only the two T13 files (`ElectionReadResult` union reflowed; test line wrapping at printWidth 100). | Formatted only the two T13 files; interface members, literals, and assertions unchanged; no other file reformatted. |
| — | Info | `claim`'s explicit `if (this.isWriter(current.record))` branch returns the same `held` result as its fall-through. | This is the brief-prescribed documentation of the ownership check and was kept verbatim; it introduces no second write path. Not a defect. |
| — | Info | `pnpm run test -- tests/core/workspace/workspaceElection.test.ts` also runs the pre-existing unit tests under Vitest 5; T13-only count confirmed with an explicit path (1 file, 7 tests). | Recorded; not a defect. |

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/workspace/workspaceElection.test.ts` exit 1 — Vite import
analysis failed to resolve `@/core/workspace/WorkspaceElection`; the 82 pre-existing unit
tests still passed. GREEN: explicit focused path exit 0 (1 file, 7 tests),
`pnpm run test` exit 0 (16 files, 89 tests), `pnpm run typecheck` exit 0,
`pnpm run lint` exit 0, `pnpm exec prettier --check .` exit 0, and the phase-applicable
chain `typecheck && lint && test` exit 0. Full output is recorded in `verification.txt`
(Task 13 section).

### Acceptance decision

**PASS** — Task 13 meets specification-compliance, code-quality, and security/privacy
requirements; the only finding is a Low-severity formatting correction and no blocking
finding remains. The brief's `isWriter` implementation was accepted verbatim and
typechecked under the pinned strict configuration.

## Task 13 — Controller review (BLOCKER, supersedes the self-review PASS above)

Reviewer: controller-dispatched task review; diff range `ba13aef..7633615`; verdict
**Needs fixes**; one Critical and two Important findings.

### Critical (Must Fix)

`claim()` is a non-atomic read-then-write (`src/core/workspace/WorkspaceElection.ts:61-71`).
`read()` then `storage.write()` has no compare-and-swap, claim lock, or verify-after-write
read-back. Two extension contexts (for example two Side Panels, or a Side Panel and a
Standalone) can both observe `missing`/`invalid`, both build and persist an election record,
and both return `status: 'acquired'`. This authorises two live writers.

- Meets the task's own STOP condition: "TWO live writers can be authorised by any code path".
- Conflicts with `DESIGN.md` Section 6: "never two authorised writers".
- The code is inherited verbatim from approved `PLAN.md`, so this is a plan/design conflict,
  not an implementer deviation.

### Important (Should Fix)

1. `relinquish()` (`src/core/workspace/WorkspaceElection.ts:73-76`) unconditionally removes
   `np_workspace_election` and `np_workspace_handoff`; it is not owner-guarded in the module.
   The planned T16 `handleRelinquish` guards with `isWriter`, but T16 is not yet implemented,
   so no implemented caller enforces the guard today.
2. Stale/invalid recovery always writes epoch `0` (`:69`); the brief's specification-compliance
   checklist says invalid metadata is recovered by claiming a "fresh epoch", but no prior
   epoch is derived and the test only asserts `recovered: true`.

### Recommended resolution options for the operator

- **Option A (recommended):** Record an explicit Phase 01 design decision/ADR that the
  elected single writer is best-effort under concurrent multi-context startup, because
  `chrome.storage` offers no atomic compare-and-swap and `DESIGN.md` Section 6 forbids the
  background service worker from acting as owner/broker. Keep T13 as implemented, fix the
  `relinquish` guard wording and the "fresh epoch" checklist in a plan/design note, and
  defer strict atomic election to Phase 2 (indexedDB/transactions/write journal). Effect:
  smallest change; Phase 01 ships a baseline that is not strictly race-free.
- **Option B:** Amend T13 to add a claim-token lease and a settle-then-verify read-back,
  with an interleaving test, accepting a residual narrow race. Requires new identifiers not
  present in `DESIGN.md` (claim token/lease) and an operator-approved plan amendment. Effect:
  reduces the window but does not make election strictly atomic.
- **Option C:** Introduce a background-serialised election claim. This changes a locked
  decision ("the background is not owner/broker") and requires an approved ADR plus plan
  amendment. Effect: strongest guarantee; violates a locked decision unless explicitly changed.

Per `AGENTS.md` Section 2/18/19, execution is stopped and no further task is started until the
operator decides.

## Task 13C — Corrective background-serialised election (ADR-0001) self-review (2026-09-19)

Scope: `WorkspaceElectionArbiter.ts` + arbiter suite (new); `errorCodes`, `MessageType`,
`messageSchemas`, `RuntimeEnvelope` (two discriminated-union arms only), `workspaceTypes`,
`WorkspaceElection` client, and their tests. Branch `phoenix`.

### Specification compliance

- Canonical contract followed: request/response payloads, FIFO `ElectionSerialExecutor`,
  `WorkspaceElectionArbiter`/`createWorkspaceElectionArbiter`, `BackgroundElectionMessageListener`
  factory, and the two new error codes match ADR-0001 and DESIGN.md Section 6.
- Registry growth is exactly additive: `MESSAGE_TYPES` 11 -> 13 (request sources
  `sidepanel`/`standalone`; response source `background`); `ERROR_CODES` 13 -> 15, appended after
  `THEME_PERSIST_FAILED`. No third message type, storage key, permission, dependency, or
  `DiagnosticEvent`.
- Idempotency ledger: `ElectionRecord.recentCompletedRequests` (`ElectionIdempotencyRecord[]`,
  output-required, input-tolerant via `.default([])`), retention limit exactly 32, oldest to
  newest, remove-by-`requestId` then append then `slice(-32)`, order-independent named-field
  fingerprint equality with no `JSON.stringify`, no recursive `ElectionRecord`.
- Epoch discipline verified: missing-record initial claim is the only path to epoch 0; every
  later ownership change (handoff, stale/fallback takeover, invalid recovery) is `prior + 1`;
  rejected/idempotent paths never change the epoch; invalid recovery uses the raw numeric
  `epoch` when finite/non-negative, else 1 (never a bare 0).
- Fail-closed persistence: write throw, read-back mismatch, or read throw returns
  `accepted:false` + `WORKSPACE_ELECTION_FAILED`; success is returned only after a full-record
  read-back deep-equality check; no ledger entry is recorded on failure.
- Listener: validates the T08 inbound boundary first (no response for untrusted
  sender/schema-invalid/background-originated/disallowed source), ignores non-election types,
  rejects non-`background` targets, returns literal `true`, delivers exactly one schema-valid
  response via `sendResponse` with `correlationId` = request envelope `id` and `target` =
  requesting surface, and never responds twice.
- Client: `read()`/`isWriter()` unchanged; `claim(reason)`/`relinquish()` send
  `workspace.election.request` through the injected bus and resolve the matching response by
  `correlationId`; the client never writes `np_workspace_election` directly (asserted).
  `ElectionClaimResult` gained the `{ status: 'rejected'; code }` arm. Wildcard/mis-targeted
  responses are ignored.

### Code quality

- `handle()` wraps the whole evaluation in `executor.runExclusive`; the executor tail is
  rejection-safe, so a rejected operation does not break FIFO ordering of later operations.
- Duplicate/conflict recognition is state-derived from the persisted ledger only; no in-memory
  cache, so it survives a worker restart.
- Read-back equality compares every record field and every ledger entry field directly.
- Errors and rejections are returned as data; `handle()` rejects only on truly unexpected
  programmer errors, which the listener catches into a single canonical failure response.
- Types are clean under the pinned strict toolchain (`noUncheckedIndexedAccess`); no `any`,
  no non-null assertions in production code, no empty catch blocks, no comments.

### Security and privacy

- No secret, prompt, payload, record, or sender content is logged; only canonical error codes
  with fixed labels (`key`/`reason`) pass through the redacting `debugLog`.
- No direct `chrome.*`, IndexedDB, provider/MCP, or network access in the arbiter/client.
- The arbiter is background-only; it does not own workspace content or perform ordinary
  mutations.

### Findings and dispositions

- Low/None. `runtimePrimitives.test.ts` was added to the changed set: it asserts the closed
  `MESSAGE_TYPES` list and therefore had to move from the eleven to the thirteen-entry registry
  for the closed-registry completeness invariant to hold. It is a test-only completeness
  consequence of the mandated registry growth and is disclosed here.
- Tension recorded (resolved by the binding T13C rulings R2.3/R5): DESIGN.md Section 6 mentions
  failing closed with `WORKSPACE_INVALID_METADATA` "when [a malformed ledger] cannot be
  normalised". R5 defines the permissive read schema so that a non-array ledger is an invalid
  base record, which R2.3 recovers with a fresh epoch; malformed *entries* are dropped and the
  ledger trimmed to the newest 32. The implementation follows the binding rulings; the canonical
  `WORKSPACE_INVALID_METADATA` code is still logged (with a fixed label) for an invalid base
  record. No behaviour contradicts PLAN.md/ADR-0001.
- The rulings R1-R13 were checked against PLAN.md/DESIGN.md Section 6/ADR-0001; no blocking
  contradiction was found.

### Acceptance decision

**PASS** — all T13C Step 1 obligations are covered by passing tests; `typecheck`, `lint`,
`prettier --check .`, and the phase chain all exit 0; no blocking finding remains. The T13
Critical two-writer finding is remediated: simultaneous claims produce exactly one writer and
the loser receives `WORKSPACE_ELECTION_REJECTED`. Corrected T13 is accepted; next task T14.

## Task 14 — Prepare, Acknowledge, and Commit Handoff self-review (2026-09-19)

Scope: `src/core/workspace/WorkspaceHandoff.ts` (new) and
`tests/core/workspace/workspaceHandoff.test.ts` (new), per the ADR-0001-amended T14 and binding
rulings R14.1-R14.5. Branch `phoenix`.

### Specification compliance

- Dependency shape matches R14.1: `WorkspaceHandoffDependencies` adds the injected
  `submitElectionRequest(payload): Promise<WorkspaceElectionResponsePayload>`;
  `WorkspaceElection.ts` and `WorkspaceElectionArbiter.ts` were not modified.
- `prepare`/`acknowledge` are handoff-record only (R14.2): `prepare` reads
  `np_workspace_election` via `ElectionRecordSchema`, requires this instance/type as writer,
  writes only `np_workspace_handoff` at `phase:'prepared'` with `from`/`to` identity,
  `epoch = election.epoch`, `baseVersion`, `preparedAt`, `acknowledgedAt:null`; the election
  record is untouched (asserted byte-identical). `acknowledge` checks phase then epoch
  (`WORKSPACE_EPOCH_MISMATCH`) then version (`WORKSPACE_VERSION_CONFLICT`) and writes
  `phase:'acknowledged'` plus `acknowledgedAt`, leaving the election record unchanged.
- `commit` (R14.3): requires `phase:'acknowledged'`; applies the epoch/version guards; mints a
  fresh `requestId` via `createOperationId()` and submits one `handoff-commit` request with
  `expectedEpoch`, target identity, and no `reason`; on `accepted:true` removes
  `np_workspace_handoff` and returns `committed`; on `accepted:false` maps
  `WORKSPACE_ELECTION_REJECTED`/`WORKSPACE_ELECTION_FAILED` verbatim, else
  `WORKSPACE_HANDOFF_FAILED`; a thrown submission fails closed to `WORKSPACE_HANDOFF_FAILED`.
  The arbiter owns `np_workspace_election`; this module never writes it.
- `HandoffRejectionCode` is widened exactly as R14.3 specifies (five codes). `read()` semantics
  are unchanged and every existing `HandoffRecordSchema` field is retained.
- No new storage key, message type, error code, permission, dependency, or `DiagnosticEvent`.

### Code quality

- All rejections return canonical coded data and pass through the redacting `debugLog` with
  fixed labels (`phase`, `key`); there are no empty catch blocks and every catch path fails
  closed.
- Types are clean under the pinned strict toolchain (`strict`, `noUncheckedIndexedAccess`); no
  `any`, no non-null assertions, no comments. The removed direct election write is replaced by
  a single injected transport call, keeping T14 free of background/storage-writer coupling.
- Storage-removal failure is also fail-closed (returns `WORKSPACE_HANDOFF_FAILED` rather than
  claiming `committed`), consistent with the phase invariant that success requires
  verification and the arbiter-owned record is the only source of truth.

### Security and privacy

- Only canonical error codes and fixed label keys are logged; no payload, identity, or record
  content is emitted.
- No direct `chrome.*`, IndexedDB, provider/MCP, or network access; the module is pure
  orchestration over an injected `ValidatedStorage` and election-request transport.

### Findings and dispositions

- None blocking. `tests/core/workspace/workspaceHandoff.test.ts` covers both a controlled fake
  transport (exact payload fields and rejection-code mapping) and a real
  `WorkspaceElectionArbiter` (end-to-end ownership transition to standalone at epoch 1),
  satisfying R14.4.

### Acceptance decision

**PASS** — focused handoff suite 11/11 new tests (unit project 18 files, 156 tests);
`typecheck`, `lint`, `prettier --check .`, and the phase chain `typecheck && lint && test` all
exit 0; no blocking finding remains. Next task T15.

## Task 15 — Mutation Versioning and Idempotency self-review (2026-09-19)

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `81bc563` (T14 atomic commit
`feat(phase-01): implement prepare acknowledge commit handoff`)
**Classification:** code task (TDD RED→GREEN); implementation tier advanced (write
correctness)

### Scope reviewed

- `src/core/workspace/WorkspaceMutations.ts` (created)
- `tests/core/workspace/workspaceMutations.test.ts` (created)

### 1. Specification-compliance review

- Interfaces and types match the brief exactly: `MutationEngineState`
  (`committedVersion`/`epoch`/`writerInstanceId`/`appliedMutationIds`),
  `MutationRejectionCode` (the four canonical T03 codes), `MutationOutcome`
  (`applied`+`mutation`+`state` | `duplicate`+`state` | `rejected`+`code`+`state`),
  `createMutationEngineState(input)`, `applyWorkspaceMutation(state, mutation)`,
  `CommitWorkspaceMutationDependencies` (`store`/`now`), and
  `commitWorkspaceMutation(deps, state, mutation)`. PASS
- Exactly one mutation kind: the payload is a T06 `WorkspaceMutation`, whose `kind`
  is the closed literal `workspace.metadata.set` and whose payload is
  `WorkspaceMetadataSchema`. No second or generic kind exists. PASS
- The T06 mutation contract is honoured: mutation ID, writer instance ID, epoch,
  base version, resulting version, kind, and schema-valid payload are all present and
  checked. PASS
- Rejection mapping is exactly the brief: wrong writer →
  `WORKSPACE_OWNERSHIP_AMBIGUOUS`; wrong epoch → `WORKSPACE_EPOCH_MISMATCH`; stale base
  → `WORKSPACE_STALE_MUTATION`; non-monotonic resulting version →
  `WORKSPACE_VERSION_CONFLICT`. All four are canonical T03 codes; none is invented. PASS
- Duplicate detection precedes every other check: a repeated `mutationId` returns
  `duplicate` with the unchanged state before any writer/epoch/version check, so a
  replayed mutation is applied once and never advances the version. PASS
- Monotonic versioning: the applied state sets `committedVersion = resultingVersion`
  and the check requires `resultingVersion === baseVersion + 1`; the version can only
  advance by one per accepted mutation. PASS
- Persistence is applied-only: `commitWorkspaceMutation` returns the
  `duplicate`/`rejected` outcome before calling `store.writeMetadata`, so no partial
  persistence occurs on rejection. On an applied outcome it parses
  `WorkspaceMetadataSchema` from the payload with the resulting version and `now()`,
  then writes through the T12 `WorkspaceStore` (which persists `np_workspace_meta`
  and the derived `np_workspace_version`). The test asserts
  `store.readVersion() === 1` and `readMetadata()` returns
  `{ committedVersion: 1, updatedAt: 77 }`. PASS
- Scope boundaries: the applied-ID set is in-memory only (Phase 01 scope); there is
  no durable write journal, no IndexedDB, no replay, no mutation kind beyond
  `workspace.metadata.set`. No direct `chrome.*`, no network, no provider/MCP, no
  dependency, permission, or manifest change. Only the two task files changed plus
  `.planning` evidence/STATUS. PASS

### 2. Code-quality review

- `applyWorkspaceMutation` is a pure function over the state and mutation: applied
  state is built with a new array/object (`[...state.appliedMutationIds, id]`), so the
  input state is never mutated. PASS
- Fail-closed and total: every path returns a discriminated `MutationOutcome`; the
  module never throws and never reports silent success. PASS
- Rejections are logged through the T03 `debugLog` with only a fixed
  `{ reason: 'mutation' }` label; the redacting sink means no payload, writer id, or
  record content is emitted. No catch blocks, no empty catch, no `any`. PASS
- `commitWorkspaceMutation` is a small async wrapper that composes the pure engine with
  the validated store write; it has a single early return for non-applied outcomes, so
  the persistence branch is unambiguous. PASS
- Test quality: 7 focused tests cover the applied/next-version case, each of the four
  rejections, duplicate-once semantics, and the full persist path through the real T04
  validated storage over the T04 mocked chrome storage (only `now` is injected). PASS
- No type-only adaptation was required: the brief's test and implementation both
  typecheck as written under the pinned `strict`/`noUncheckedIndexedAccess: true`.
  `pnpm exec prettier --check .` flagged only the T15 module (import collapse at
  printWidth 100); it was formatted with identifiers, values, and codes unchanged and no
  other file was reformatted. PASS

### 3. Security and privacy review (assets and trust boundaries)

- No page content, note, memory, prompt, clipboard, password, token, API key, or
  customer content is read, logged, or persisted. The mutation payload is non-sensitive
  workspace metadata (`schemaVersion`, non-negative integer `committedVersion`,
  non-negative integer `updatedAt`). PASS
- The only log records are the canonical T03 rejection codes with a fixed `reason`
  label, passed through the T03 `debugLog` key-based redaction sink; no raw mutation
  payload or identifier is logged. PASS
- Writes are schema-validated on the T04 adapter path; a rejected mutation cannot
  persist anything (no partial persistence), and an applied mutation persists only the
  metadata plus derived version in the `local` area. No secrets in `sync`/`session`, no
  external transmission. PASS
- Mutations are data only and carry no instruction authority; the engine validates
  writer identity, epoch, and version before accepting, so a stale or foreign mutation
  cannot be promoted to a durable write. Content-script isolation, manifest
  permissions, and password handling are unaffected. PASS
- No secrets or sensitive data embedded in production code or evidence. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Low (formatting) | `pnpm exec prettier --check .` flagged only `src/core/workspace/WorkspaceMutations.ts` (the three-symbol `workspaceTypes` import collapsed at printWidth 100). | Formatted only the T15 module; identifiers, values, codes, and behaviour unchanged; no other file reformatted. |
| — | Info | `pnpm run test -- tests/core/workspace/workspaceMutations.test.ts` also runs the pre-existing unit tests under Vitest 5; T15-only count confirmed with an explicit path (1 file, 7 tests). | Recorded; not a defect. |

No Critical, High, or Medium finding remains unresolved. No type-level deviation was
required for T15; the brief's production and test code typechecked as written under the
pinned `noUncheckedIndexedAccess: true`.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/workspace/workspaceMutations.test.ts` exit 1 — Vite
import analysis failed to resolve `@/core/workspace/WorkspaceMutations`; the 156
pre-existing unit tests still passed. GREEN: focused test exit 0 (19 files, 163 tests;
T15-only 1 file, 7 tests), `pnpm run typecheck` exit 0, `pnpm run lint` exit 0,
`pnpm exec prettier --check .` exit 0, and the phase-applicable chain
`typecheck && lint && test` exit 0. Full output is recorded in `verification.txt`
(Task 15 section).

### Acceptance decision

**PASS** — Task 15 meets specification-compliance, code-quality, and security/privacy
requirements; the only finding is a Low-severity formatting correction and no blocking
finding remains. Next task T16.

## Task 16 — Mirror Ordering, Gap Rehydration, and Writer Coordination self-review (2026-09-19)

### Scope reviewed

- Created `src/core/workspace/WorkspaceSync.ts` and
  `tests/core/workspace/workspaceSync.test.ts` only. No T13C/T14 source or test,
  `WorkspaceElection.ts`, `WorkspaceElectionArbiter.ts`, `WorkspaceHandoff.ts`,
  `DESIGN.md`, `PLAN.md`, config, or T17+ file was modified. Review is against the
  T16 brief (amended note), the binding rulings R16.1–R16.7, ADR-0001, and
  `DESIGN.md` Section 6.

### 1. Specification-compliance review

- **Mirror ordering (DESIGN.md Section 6).** `classifyMirrorEnvelope` applies only a
  current-epoch next-version envelope, ignores duplicates and stale versions, ignores
  a different epoch, and requests rehydration on a version gap. `applyMirrorEnvelope`
  advances the mirror state only for `apply`. PASS
- **Canonical rehydration pair.** `createRehydrateRequestEnvelope` /
  `createRehydrateResponseEnvelope` build the existing
  `workspace.rehydrate.request` / `workspace.rehydrate.response` types; the
  response carries `electionEpoch` and `workspaceVersion`. `parseRuntimeEnvelope`
  accepts both. No new message type. PASS
- **No new contracts (R16.7).** No new message type, storage key, error code,
  permission, dependency, or `DiagnosticEvent`; the coordinator returns only the
  canonical `WORKSPACE_HANDOFF_FAILED` / `WORKSPACE_INVALID_METADATA` codes already in
  the T03 registry. No IndexedDB. PASS
- **Coordinator dependency shape (R16.1).** `WorkspaceCoordinatorDependencies` is
  exactly `{ bus, surface, instanceId, storage, election, handoff, store }`, where
  `election` is the T13C request client and `handoff` is the T14 module. `WorkspaceSync`
  contains no `np_workspace_election` write and no `workspace.election.response`
  subscription; correlation stays in the T13C client and the handoff's injected
  `submitElectionRequest`. PASS
- **Handoff prepare (R16.3).** `handleHandoffPrepare` checks the target instance,
  calls `deps.handoff.acknowledge(epoch, baseVersion)`, fails closed with
  `WORKSPACE_HANDOFF_FAILED` unless the result is `acknowledged`, and only then sends
  the `workspace.handoff.ack` envelope and returns `acknowledged`. The direct test
  asserts the handoff record transitions to `phase: 'acknowledged'`. PASS
- **Handoff ack / relinquish (R16.4).** `handleHandoffAck` keeps the local-writer
  guard, calls `deps.handoff.commit(...)` (T14 submits the arbiter `handoff-commit`
  request), and returns `committed` only on success; a non-committed result maps to
  `WORKSPACE_HANDOFF_FAILED`. `handleRelinquish` calls `deps.election.relinquish()`
  only for the validated local writer and returns `relinquished` only when accepted,
  otherwise `noop`. The handshake test proves the persisted record is
  `standalone`/`st`/epoch 1; the relinquish test proves the record is removed and a
  non-writer is ignored. PASS
- **start() recovery (R16.2).** `start()` subscribes to the five runtime message types
  and the `np_workspace_election` storage subscription. The storage subscription never
  writes the record; for a sidepanel it delegates to `claim('fallback')` on `missing`
  and `claim('stale-recovery')` on `invalid`. Tests assert each reason is used and that
  a valid record reappears. PASS
- **Independently testable handlers (R16.5, Approved Interpretation 2).** Every
  handler is exposed and covered both through the bus-driven handshake and directly
  (`handleHandoffPrepare`, `handleHandoffAck`, `handleRelinquish`, `handleMutation`).
  `start()` wraps the same exposed functions thinly. PASS
- **Test redesign (R16.6).** The handshake suite uses a real in-memory bus that routes
  `workspace.election.request` to a real `WorkspaceElectionArbiter` over the same
  storage and dispatches the `workspace.election.response` (`source: 'background'`,
  `target` = request source, `correlationId` = request envelope `id`) to registered
  handlers, exercising the real T13C correlation and arbiter. The T14 handoff is wired
  to `arbiter.handle`. PASS

### 2. Code-quality review

- Correctness: the mirror decision is total over epoch/version combinations; state is
  never mutated in place. Handler results use the closed `CoordinatorStep` union; no
  unhandled case. PASS
- Concurrency/orchestration observation: `handleRehydrateRequest` and the prepare/ack
  chain are `await`ed through the bus, so the test bus is deterministic. In production
  the same chain is `void`-inferred by the bus subscription handlers (`EnvelopeHandler`
  returns `void`), matching the T09 bus contract; the coordinator does not assume
  serialised handler execution and relies on the arbiter for ownership serialisation.
  Each handler re-reads the authoritative election record before acting, so a handler
  that runs after another surface changed ownership fails closed (`noop`/`failed`)
  rather than acting on a stale in-memory view. PASS
- Error handling: no empty catch, no swallowed rejection. Handoff and relinquish
  failures are reported as canonical `CoordinatorStep` failures; recovery claims are
  fire-and-forget `void` exactly as specified. PASS
- Maintainability/readability: single orchestration module, exact interfaces from the
  brief, no duplication of the arbiter or client correlation, no speculative cleanup,
  no unrelated refactor. PASS
- Test quality: 17 tests assert real behaviour through the real arbiter/client/handoff
  and the T04 storage adapter (not mock call counts); envelope builders are validated
  with `parseRuntimeEnvelope`. PASS

### 3. Security and privacy review (assets and trust boundaries)

- No page, note, memory, upload, prompt, tool input/output, clipboard, password, token,
  API key, or customer content is read, logged, or persisted. The coordinator moves
  only non-sensitive workspace metadata and identity/version fields. PASS
- Ordinary `workspace.mutation` envelopes are mirrored or trigger a rehydrate request;
  they never route through the background election arbiter, so the single-writer
  boundary is preserved and the background stays outside ordinary mutation brokerage. PASS
- `WorkspaceSync` performs no direct `chrome.*` access and no direct
  `np_workspace_election` write; all storage goes through the T04 validated adapter and
  all election-changing operations go through the T13C client / T14 handoff to the T13C
  arbiter. PASS
- No secrets or sensitive data embedded in production code, tests, or evidence. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Low (formatting) | `pnpm exec prettier --check .` flagged the two new T16 files. | Formatted only those two files with Prettier; identifiers, message-type strings, payloads, and assertions unchanged; no other file reformatted. |
| — | Low (type-only) | `storage.write('np_workspace_election', ElectionRecordSchema, {...})` needs the schema-defaulted `recentCompletedRequests` field under the inferred output type. | Added a local `electionRecord`/`standaloneRecord`/`sidepanelRecord` test helper that includes `recentCompletedRequests: []`; production code and schemas unchanged. |
| — | Info | The brief's focused command runs the whole unit project (the positional path does not narrow the Vitest 5 project run); T16-only count confirmed with an explicit single-file path. | Recorded; not a defect. |

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/workspace/workspaceSync.test.ts` exit 1 — Vite import
analysis failed to resolve `@/core/workspace/WorkspaceSync`; the 163 pre-existing unit
tests still passed. GREEN: explicit single-file run exit 0 (1 file, 17 tests),
`pnpm run test -- tests/core/workspace/workspaceSync.test.ts` exit 0 (20 files, 180
tests), `pnpm run typecheck` exit 0, `pnpm run lint` exit 0, `pnpm exec prettier
--check .` exit 0, and the phase-applicable chain `typecheck && lint && test` exit 0.
Full output is recorded in `verification.txt` (Task 16 section).

### Acceptance decision

**PASS** — Task 16 meets specification-compliance, code-quality, and security/privacy
requirements; only Low-severity formatting/type-only test-helper corrections were
needed and no blocking finding remains. Next task T17.

---

## Task 17 — Theme Schemas, Ant Design Configuration, Persistence, and Live Propagation

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `7aa7e9683ecc17fe9f06c7679cc735c4755d2d3f` (T16 atomic commit)
**Classification:** code task (TDD RED→GREEN); implementation tier balanced

### Scope reviewed

- `src/core/theme/themeTypes.ts` (created)
- `src/core/theme/antdConfig.ts` (created)
- `src/core/theme/ThemeStore.ts` (created)
- `src/core/theme/useTheme.ts` (created)
- `tests/core/theme/themeTypes.test.ts`, `tests/core/theme/antdConfig.test.ts`,
  `tests/core/theme/themeStore.test.ts`, `tests/core/theme/useTheme.test.tsx` (created)

### 1. Specification-compliance review

- `THEME_MODES` is exactly `['auto','light','dark']`; `THEME_PACKS` is exactly
  `['default','liquid-glass','claude-warm']`; `DEFAULT_THEME_MODE='auto'` and
  `DEFAULT_THEME_PACK='default'`; `ThemeModeSchema`/`ThemePackSchema` are closed `z.enum`s
  that reject `sepia`/`solarized` (asserted). PASS
- `resolveColorScheme(mode, prefersDark)` resolves `auto` from `prefers-dark-scheme` and
  passes `light`/`dark` through unchanged (asserted for all four combinations). PASS
- `np_theme` and `np_theme_pack` are the T04 `sync`-area keys; `ThemeStore` performs all
  access through the T04 `ValidatedStorage` adapter, not `chrome.storage` directly. The
  test asserts both keys land in `chromeStorage.sync.set` and that `local.set` is never
  called. PASS
- `getAntdConfig` composes `NOWPILOT_SEED` → `NOWPILOT_PACK_OVERLAYS[pack]` → algorithm.
  Dark selects `theme.darkAlgorithm`, light selects `theme.defaultAlgorithm`, and compact
  appends `theme.compactAlgorithm` (asserted against the live antd 6.6.4 exports). The
  claude-warm `colorBgBase` and liquid-glass `colorBgContainer` overlays are asserted. PASS
- `cssVar: { key: 'nowpilot' }` and `hashed: false` enable stable CSS-variable switching
  (asserted); no `@ant-design/x` import and no provider is configured. PASS
- Invalid/missing stored values fall back to canonical defaults and log the T03 canonical
  `THEME_INVALID_VALUE` with only a fixed key label (no raw stored value). `read()` never
  throws. PASS
- `writeMode`/`writePack` write validated values through the T04 adapter and fail closed:
  a rejected `set` logs `THEME_PERSIST_FAILED` and rejects with an error carrying the same
  code (asserted). PASS
- `subscribe` combines both key subscriptions and re-emits the full combined preferences
  after a change (asserted with `vi.waitFor`); `useTheme` seeds from canonical defaults,
  performs an async read, guards post-unmount updates, and unsubscribes. PASS
- Theme is independent of writer election: no election, workspace, background, or
  mutation code is referenced. `compact` is a caller-supplied input (Side Panel true,
  Standalone false), not surface-hard-coded here. PASS
- Only the eight T17 files were created, plus `.planning` evidence/STATUS; no new storage
  key, error code, message type, permission, dependency, or `DiagnosticEvent`. PASS

### 2. Code-quality review

- Modules are small, single-purpose, and strongly typed; no `any`. `getAntdConfig` is a
  pure function; `ThemeStore` is a closure over the injected `ValidatedStorage`; `useTheme`
  is a thin React effect wrapper. PASS
- `ThemeStore.read` reads both keys before deciding so a single invalid key does not
  suppress the valid one; each fallback is independent. PASS
- Both catch blocks are non-empty: each logs the canonical code and rethrows a coded error.
  No silent failure. PASS
- `useTheme`'s effect guards every `setState` with the `active` flag and calls the returned
  unsubscribe on cleanup, so no state update occurs after unmount and no listener leaks. PASS
- No duplication of canonical identifiers: mode/pack literals, schemas, defaults, keys,
  seed, and overlays are each declared once and imported. PASS
- Two Low-severity type-only test adaptations were required (below); production code
  typechecked exactly as written under the pinned `strict`/`noUncheckedIndexedAccess`
  configuration.

### 3. Security and privacy review (assets and trust boundaries)

- No raw stored value is ever logged: `THEME_INVALID_VALUE` and `THEME_PERSIST_FAILED`
  records carry only a fixed `{ key }` label, and the T03 `debugLog` still applies
  key-based redaction. The only asserted log content is the canonical code string. PASS
- No secrets, tokens, cookies, passwords, prompts, page content, or customer data are
  read, logged, persisted, exported, or committed; theme values are closed enums and
  fixed tokens. PASS
- Persistence is limited to the two approved `sync` keys through the validated adapter;
  invalid values cannot be persisted (`write` parses before `set`). PASS
- No direct `chrome.*` access in any theme module, no IndexedDB, no network, no filesystem,
  no content script, and no host-page interaction. PASS
- Theme state has no instruction authority and cannot affect permissions, prompts, or
  code; unknown mode/pack values fail closed to canonical defaults. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| T17-A | Low (type-only) | The brief's `chromeStorage.sync.set.mockRejectedValueOnce(...)` is TS2339 because `StorageAreaMock` widens area methods to `ChromeStorageAreaLike` signatures. | Used the canonical `vi.mocked(chromeStorage.sync.set).mockRejectedValueOnce(new Error('quota'))`; identifiers, value, and all assertions unchanged. |
| T17-B | Low (type-only) | The brief's `useTheme` test mock held a write-only `listener` variable, rejected by `noUnusedLocals` (TS6133) and the repo ESLint `no-unused-vars` rule. | The mock now invokes the stored listener after updating `prefs` in `writeMode`/`writePack` (`listener?.(prefs)`), matching the real store's propagation contract. Identifiers, initial values, and assertions unchanged; the test performs no writes, so observed behaviour is unchanged. |
| — | Low (formatting) | `pnpm exec prettier --check .` was applied to the eight new T17 files after creation. | Formatted only the T17 files; identifiers, values, and assertions unchanged; no other file reformatted. |
| — | Info | The brief's focused command runs the whole unit project (the positional path does not narrow the Vitest 5 project run); T17-only count confirmed with an explicit path (4 files, 14 tests). | Recorded; not a defect. |

The two type-only adaptations are confined to the two permitted test files, were required
solely to satisfy the repo's pinned TypeScript and ESLint configuration (which the task
requires to exit 0), and do not touch the supplied implementation, assertions, or mock
values. No production code and no shared helper or configuration was modified.

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/theme` exit 1 — module-resolution failures for
`@/core/theme/themeTypes`, `@/core/theme/antdConfig`, `@/core/theme/ThemeStore`, and
`@/core/theme/useTheme`; the 20 pre-existing files (180 tests) still passed. GREEN:
explicit focused path exit 0 (4 files, 14 tests), `pnpm run test -- tests/core/theme`
exit 0 (24 files, 194 tests), `pnpm run typecheck` exit 0, `pnpm run lint` exit 0,
`pnpm exec prettier --check .` exit 0, and the phase-applicable chain
`typecheck && lint && test` exit 0 (24 files, 194 tests). Full output is recorded in
`verification.txt` (Task 17 section).

### Acceptance decision

**PASS** — Task 17 meets specification-compliance, code-quality, and security/privacy
requirements; the only findings are Low-severity type-only test adaptations and a
Low-severity formatting pass, both disclosed, and no blocking finding remains.

## Task 18 — Standalone Page Registry, Core Registration, and Skeleton Pages (2026-09-19)

**Classification:** code task (TDD RED→GREEN); implementation tier economy

### Scope reviewed

- `src/core/registry/StandalonePageRegistry.ts` (created)
- `src/core/registry/registerCorePages.ts` (created)
- `src/components/standalone/pages/{ChatPage,AgentPage,NotesPage,WritePage,ToolsPage,DiagnosticsPage}.tsx` (created)
- `src/components/options/OptionsPage.tsx` (created, minimal skeleton replaced in T20)
- `tests/core/registry/standalonePageRegistry.test.ts`,
  `tests/core/registry/registerCorePages.test.tsx` (created)

### 1. Specification-compliance review

- `createStandalonePageRegistry()` exposes exactly `register`/`get`/`has`/`entries`;
  `register` throws on a duplicate route id; `entries()` returns `{ routeId, component }`
  pairs in registration order. PASS
- `createCorePageRegistry()` registers exactly the seven `STANDALONE_ROUTE_IDS`
  (`chat`, `agent`, `notes`, `write`, `tools`, `options`, `diagnostics`) in canonical
  order, and `CORE_PAGE_REGISTRY` is the module singleton. `entries()` length equals
  `STANDALONE_ROUTE_IDS.length` (asserted). PASS
- Each skeleton page renders a `<section data-testid="standalone-page-<id>"
  aria-label="<Label>">` with the canonical label; the test renders every registry
  entry and asserts the canonical test id for all seven ids. PASS
- Primary/footer placement remains owned by `standaloneRoutes.ts`; this task does not
  duplicate or override placement. Labels match the canonical route labels. PASS
- `OptionsPage` is a minimal presentational skeleton; `AppearanceSection.tsx` was not
  created. T20 replaces the page body. This is the brief's permitted atomic-green
  option and is recorded in the task notes. PASS
- No later-phase page logic, TeamGQM, ServiceNow, mock services, inactive controls,
  dependency, permission, storage key, message type, error code, or `DiagnosticEvent`
  was added. Only the brief's allowed files were created plus `.planning` evidence/STATUS. PASS

### 2. Code-quality review

- Registry is a small closure over a `Map<StandaloneRouteId, StandalonePageComponent>`;
  no internal state escapes (`entries()` builds a fresh array). Strongly typed through
  `StandaloneRouteId` and `ComponentType`; no `any`. PASS
- Duplicate registration fails loudly with a canonical message rather than silently
  overwriting. PASS
- Skeleton pages are pure presentational functions: no state, effects, event handlers,
  or side effects; the only dependencies are `antd` `Typography`/`Empty`. PASS
- Test files are the brief's verbatim tests and cover registration/resolution, duplicate
  rejection, order preservation, complete route coverage, and per-route rendering. PASS
- One Low-severity formatting pass was required (below); no production logic changed.

### 3. Security and privacy review (assets and trust boundaries)

- No interactive controls, forms, or inputs, so no user input can be captured at this
  stage; pages hold no instruction authority. PASS
- No direct `chrome.*`, IndexedDB, network, filesystem, content-script, or host-page
  access; pages run only in extension-owned Standalone contexts. PASS
- No secrets, tokens, cookies, passwords, prompts, page content, or customer data are
  read, logged, persisted, exported, or committed. PASS
- Stable `data-testid` attributes are present solely for the T24 isolation inspection
  and expose no sensitive surface. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Low (formatting) | `pnpm exec prettier --check .` flagged only `src/core/registry/registerCorePages.ts` (long `StandalonePageRegistry` import line). | Reformatted only that new file; identifiers, values, and assertions unchanged; no other file reformatted. |
| — | Info | The brief's focused command runs the whole unit project (Vitest 5 does not narrow `--` positionals under `--project unit`); T18-only count confirmed with an explicit path (2 files, 5 tests). | Recorded; not a defect. |
| — | Info | `OptionsPage.tsx` is a minimal skeleton in this task; T20 replaces its body and adds `AppearanceSection.tsx`. | Intentional per the brief; recorded in task notes. |

The formatting change is confined to one permitted new file and does not alter
identifiers, values, assertions, or behaviour. No shared helper or configuration was
modified.

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/registry` exit 1 — module-resolution failures for
`@/core/registry/StandalonePageRegistry` and `@/core/registry/registerCorePages`; the
24 pre-existing files (194 tests) still passed. GREEN: explicit focused path exit 0
(2 files, 5 tests), `pnpm run test -- tests/core/registry` exit 0 (26 files, 199
tests), `pnpm run typecheck` exit 0, `pnpm run lint` exit 0,
`pnpm exec prettier --check .` exit 0, and the phase-applicable chain
`typecheck && lint && test` exit 0 (26 files, 199 tests). Full output is recorded in
`verification.txt` (Task 18 section).

### Acceptance decision

**PASS** — Task 18 meets specification-compliance, code-quality, and security/privacy
requirements; the only findings are a Low-severity formatting pass and informational
observations, both disclosed, and no blocking finding remains.

## Task 19 — Standalone Shell, Router, and Sider (2026-09-19)

**Classification:** code task (TDD RED→GREEN); implementation tier balanced

### Scope reviewed

- `src/components/standalone/StandaloneSider.tsx` (created)
- `src/components/standalone/StandaloneRouter.tsx` (created)
- `src/components/standalone/StandaloneShell.tsx` (created)
- `tests/components/standaloneSider.test.tsx`,
  `tests/components/standaloneRouter.test.tsx`,
  `tests/components/standaloneShell.test.tsx` (created)

### 1. Specification-compliance review

- `StandaloneSider` builds its Menu items by mapping `PRIMARY_STANDALONE_ROUTES`
  then `FOOTER_STANDALONE_ROUTES` from the T05 `standaloneRoutes.ts` registry, so
  the five primary (Chat, Agent, Notes, Write, Tools) and two footer (Options,
  Diagnostics) labels are owned by the registry, not hard-coded in the component.
  PASS
- Clicking a Menu item maps the antd key back to `StandaloneRouteId` and calls
  `onNavigate` with the route id (`onNavigate('notes')` asserted). PASS
- `StandaloneRouter` renders `registry.get(routeId)` and `null` for an
  unregistered route (both asserted). PASS
- `useStandaloneRoute` defaults to `chat` via `resolveStandaloneRouteId`, reports
  the raw hash through `onRouteFallback` on a fallback, writes the resolved hash
  with `window.history.replaceState`, applies a `focusSubscription` destination to
  route state, and exposes `navigate(routeId)`. PASS
- `StandaloneShell` composes the Sider, the routed page, and the hook; navigation
  switches the rendered page (asserted) and an unknown initial hash reports the
  fallback (asserted). PASS
- Interfaces produced exactly as specified: `StandaloneSiderProps`,
  `StandaloneRouterProps`, `UseStandaloneRouteOptions`, `StandaloneRouteController`,
  `StandaloneShellProps`, and the four value exports. PASS
- Non-goals respected: no `hashchange`/`popstate` listener, no browser-history
  traversal, no query/path routing, no hard-coded Sider array, no Side Panel
  navigation UI, no new dependency, permission, storage key, message type, error
  code, or `DiagnosticEvent`. Only the brief's six files plus `.planning`
  evidence/STATUS changed. PASS

### 2. Code-quality review

- The Sider is a small presentational component; menu items and keys derive from a
  single registry source, so labels cannot drift. `selectedKeys` reflects the
  active route, and the click handler is a single expression. PASS
- The router is a pure render helper; `useStandaloneRoute` centralises hash
  resolution, fallback reporting, focus subscription, and replaceState so the
  shell stays declarative. The antd key cast is constrained to
  `StandaloneRouteId`; no `any` is used. PASS
- `useCallback`/`useEffect` dependencies are correct: `navigate` is stable, the
  hash effect depends on `routeId`, and the focus effect depends on
  `options.focusSubscription`, unsubscribing through the returned function. PASS
- The shell consumes only the injected `StandalonePageRegistry`; there is no module
  global or window reach-through beyond `replaceState`. PASS

### 3. Security and privacy review (assets and trust boundaries)

- No user input, forms, or fields; no content-script or host-page access; the
  components run only in extension-owned Standalone contexts. PASS
- No `chrome.*`, storage, IndexedDB, network, filesystem, provider, or MCP access;
  no runtime message is sent or validated here (that boundary remains T08/T09). PASS
- No secrets, tokens, cookies, passwords, prompts, page content, or customer data
  are read, logged, persisted, exported, or committed. PASS
- The Sider carries an accessible `aria-label="Workspace navigation"`; no route
  string is constructed outside the registry (`standaloneHashRoute`). PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| T19-A | Low (plan defect) | The brief's `StandaloneRouter.tsx` import list includes unused `DEFAULT_STANDALONE_ROUTE_ID`, which fails the pinned `noUnusedLocals`/eslint. | Authorised correction: removed only that unused import; every other import and all code were transcribed verbatim. |
| T19-B | Low (test isolation) | The brief's `standaloneSider.test.tsx` renders twice in one file; because vitest runs without `globals: true` and the repo has no global `afterEach(cleanup)`, the second `getByText('Notes')` matched both mounted Siders and failed. | Added explicit `afterEach(cleanup)` to the three component test files; test bodies, identifiers, values, and assertions unchanged. |
| T19-C | Low (formatting) | `pnpm exec prettier --check .` flagged `StandaloneRouter.tsx` and the router/shell test files (line reflow). | Reformatted those new files; no identifier/value/assertion change; no other file reformatted. |

T19-A and T19-B are confined to permitted new files and do not alter contracts,
identifiers, values, or assertions. T19-C is formatting only.

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/components` exit 1 — module-resolution failures for
`@/components/standalone/StandaloneSider`, `.../StandaloneRouter`, and
`.../StandaloneShell`; the 26 pre-existing files (199 tests) still passed. GREEN:
`pnpm run test -- tests/components` exit 0 (29 files, 206 tests), `pnpm run typecheck`
exit 0, `pnpm run lint` exit 0, `pnpm exec prettier --check .` exit 0, and the
phase-applicable chain `typecheck && lint && test` exit 0 (29 files, 206 tests). Full
output is recorded in `verification.txt` (Task 19 section).

### Acceptance decision

**PASS** — Task 19 meets specification-compliance, code-quality, and security/privacy
requirements; the only findings are two Low-severity plan/test-isolation corrections
(authorised/disclosed) and one formatting pass, and no blocking finding remains.

---

## Task 20 — Options Appearance Controls (2026-09-19)

**Classification:** code task (TDD RED→GREEN); implementation tier balanced

### Scope reviewed

- `src/components/options/AppearanceSection.tsx` (created)
- `src/components/options/OptionsPage.tsx` (modified — skeleton body replaced)
- `tests/components/optionsAppearance.test.tsx` (created)

### 1. Specification-compliance review

- The Options surface renders exactly `General → Card → AppearanceSection →
  { Display mode, Theme pack }`; `AppearanceSection` owns the single
  `Appearance` heading. `Providers` and `Diagnostics` are asserted absent. PASS
- The approved display-mode options (Auto, Light, Dark) and pack options (Default,
  Liquid Glass, Claude Warm) are derived from the canonical `THEME_MODES` /
  `THEME_PACKS` arrays through label maps, not re-declared string arrays. PASS
- Mode and pack changes flow through `onModeChange` / `onPackChange`; `OptionsPage`
  updates local state and persists only via `themeStore.writeMode` /
  `themeStore.writePack`, so persistence stays in the approved `chrome.storage.sync`
  path through `ValidatedStorage`. PASS
- Interfaces produced exactly as specified: `AppearanceSectionProps` /
  `AppearanceSection`, and `OptionsPage` accepting an optional `ThemeStore` prop
  (`OptionsPageProps.store?`), so the T18 registry test that renders `<Page />`
  with no props still works. PASS
- Non-goals respected: no Providers, Models, MCP, Memory, Diagnostics, Notes,
  Persona, Import/Export, Feature-Flags, or Add-on sections; no provider dialog; no
  Chrome options page; no new dependency, permission, storage key, message type,
  error code, or `DiagnosticEvent`. Only the two created files, `OptionsPage.tsx`,
  and `.planning` evidence/STATUS changed. PASS

### 2. Code-quality review

- `AppearanceSection` is a small presentational component; the label maps are
  exhaustive `Record<ThemeMode, string>` / `Record<ThemePack, string>` values, and
  the `Segmented` key cast is constrained to `ThemeMode` / `ThemePack`; no `any`.
  PASS
- `OptionsPage` builds the default store once with a lazy `useState` initialiser,
  so `createThemeStore` is not re-created per render. The mount effect guards state
  updates with an `active` flag and returns the subscription unsubscribe in cleanup,
  preventing post-unmount updates. PASS
- The effect depends only on `themeStore`; `writeMode`/`writePack` failures are
  already structured inside `ThemeStore` (canonical `THEME_PERSIST_FAILED`) and are
  not swallowed here. PASS
- The page keeps its canonical `data-testid="standalone-page-options"` and
  `aria-label="Options"`, so the T18 registry contract is preserved. PASS

### 3. Security and privacy review (assets and trust boundaries)

- No user input beyond the two Segmented controls; no content-script or host-page
  access; the component runs only in the extension-owned Standalone context. PASS
- Only the approved `ThemeStore` is touched; no direct `chrome.*` reach-through in
  the component (the store encapsulates `ValidatedStorage`), no IndexedDB, network,
  filesystem, provider, or MCP access. PASS
- Only validated theme enums are written (`ThemeModeSchema` / `ThemePackSchema` at
  the storage boundary); no free-form value can be persisted. PASS
- No secrets, tokens, cookies, passwords, prompts, page content, or customer data
  are read, logged, persisted, exported, or committed. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| T20-A | Low (plan defect) | The brief's test stub `vi.fn(async () => ({ mode: 'auto', pack: 'default' }))` infers `{ mode: string; pack: string }` and fails the pinned `tsc --noEmit` against `ThemeStore.read(): Promise<ThemePreferences>`. | Authorised test correction: annotated the callback return as `Promise<ThemePreferences>` and added the type-only `ThemePreferences` import; identifiers, values, and assertions unchanged. |
| T20-B | Low (test isolation) | The brief's test renders three times in one file; because vitest runs without `globals: true` and the repo has no global `afterEach(cleanup)`, later `getByText` calls matched multiple mounted subtrees. | Added explicit `afterEach(cleanup)` to the new test file; test bodies, identifiers, values, and assertions unchanged. |
| T20-C | Low (formatting) | `pnpm exec prettier --check .` flagged `AppearanceSection.tsx` (multi-line import collapsed to one line). | Reformatted only the new file; no identifier/value/assertion change. |

T20-A and T20-B are confined to the permitted new test file and do not alter
contracts, identifiers, values, or assertions. T20-C is formatting only.

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/components/optionsAppearance.test.tsx` exit 1 —
module-resolution failure for `@/components/options/AppearanceSection`; the 29
pre-existing files (206 tests) still passed. GREEN: `pnpm run test -- tests/components`
exit 0 (30 files, 209 tests), `pnpm run typecheck` exit 0, `pnpm run lint` exit 0,
`pnpm exec prettier --check .` exit 0, and the phase-applicable chain
`typecheck && lint && test` exit 0 (30 files, 209 tests). The T18
`tests/core/registry/registerCorePages.test.tsx` still passes. Full output is
recorded in `verification.txt` (Task 20 section).

### Acceptance decision

**PASS** — Task 20 meets specification-compliance, code-quality, and
security/privacy requirements; the only findings are two Low-severity plan/
test-isolation corrections (authorised/disclosed) and one formatting pass, and no
blocking finding remains.

---

## Task 21 — Chat-Only Side Panel Shell and Its Two Actions (2026-09-20)

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `d3c83b7d068bd55985bc2c02c73544dd11d3357c`
**Classification:** code task; TDD RED→GREEN applied
**Implementation tier:** balanced

### Scope reviewed

- `src/components/sidepanel/SidePanelShell.tsx` (created)
- `tests/components/sidePanelShell.test.tsx` (created)
- `.planning/evidence/phase-01/verification.txt`, `.planning/evidence/phase-01/review.md`,
  `.planning/STATUS.md`

### 1. Specification-compliance review

- The Side Panel shell is Chat-only: it renders a header (`NowPilot` plus the two
  actions), a single `<section aria-label="Chat" role="region">` with a
  deterministic `Empty` state, and a non-interactive composer placeholder. No
  Agent/Notes/Write/Tools/TeamGQM/provider/diagnostics screens and no Standalone
  admin UI are present. PASS
- The produced interface matches the brief exactly:
  `interface SidePanelShellProps { onNavigate(destination: StandaloneRouteId):
  void | Promise<void> }`; both actions pass the canonical
  `StandaloneRouteId` values `'options'` and `'chat'` (`SidePanelShell.tsx:4`,
  `SidePanelShell.tsx:84`, `SidePanelShell.tsx:89`). PASS
- Exactly two actions exist ("Options", "Switch to Full Chat"); there is no text
  input, send button, attachment button, model selector, provider control,
  keyboard submit, or speculative chat state. The composer region is
  `aria-hidden` and non-interactive (no form element). PASS
- Only the two permitted files were created and only the permitted `.planning`
  records were modified; no dependency, permission, storage key, message type,
  error code, or `DiagnosticEvent` was added. PASS

### 2. Code-quality review

- Small presentational component composed from antd `Layout` / `Typography` /
  `Space` / `Button` / `Empty` with the canonical `@ant-design/icons`; no `any`,
  no unnecessary state, and the navigation callback is invoked with
  `void onNavigate(...)` so a returned promise is intentionally ignored. PASS
- Icon-only controls carry explicit `aria-label` values, and the chat region is
  exposed as a named `region`; the layout uses `minHeight: '100vh'` to fill the
  panel. PASS
- No catch blocks, no async work, and no abortable call chain are introduced by
  this task, so the Section 8 error-handling and `AbortSignal` rules do not
  apply. PASS

### 3. Security and privacy review (assets and trust boundaries)

- Runs only in the extension-owned Side Panel context; no content-script,
  host-page, background, IndexedDB, network, filesystem, provider, or MCP access. PASS
- No user input surfaces and no data are read, logged, persisted, exported, or
  committed; passwords, tokens, page content, and customer data are untouched. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| T21-A | Low (test isolation) | The brief's test file renders in three tests without a global `afterEach`; because vitest runs without `globals: true` and the repo has no global cleanup, mounted subtrees could accumulate. | Added explicit `cleanup`/`afterEach` imports and `afterEach(cleanup)` to the new test file; test bodies, identifiers, values, and assertions unchanged. |

T21-A is confined to the permitted new test file, mirrors the existing
component-test convention, and does not alter contracts, identifiers, values, or
assertions.

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/components/sidePanelShell.test.tsx` exit 1 —
module-resolution failure for `@/components/sidepanel/SidePanelShell`; the 30
pre-existing files (209 tests) still passed. GREEN:
`pnpm run test -- tests/components/sidePanelShell.test.tsx` exit 0 (31 files,
212 tests) and `pnpm exec vitest run --project unit
tests/components/sidePanelShell.test.tsx` exit 0 (1 file, 3 tests);
`pnpm run typecheck` exit 0, `pnpm run lint` exit 0, `pnpm exec prettier --check .`
exit 0, and the phase-applicable chain `typecheck && lint && test` exit 0 (31
files, 212 tests). Full output is recorded in `verification.txt` (Task 21
section).

### Acceptance decision

**PASS** — Task 21 meets specification-compliance, code-quality, and
security/privacy requirements; the only finding is one Low-severity test-isolation
addition (disclosed) and no blocking finding remains.

## Task 22 — WXT Entrypoints and Background Listener Wiring (2026-09-20)

### Scope reviewed

- `src/entrypoints/sidepanel/{index.html,main.tsx,App.tsx}`
- `src/entrypoints/standalone/{index.html,main.tsx,App.tsx}`
- `src/entrypoints/background.ts`
- `src/core/runtime/StandaloneNavigation.ts` (`createBackgroundRuntime` append)
- `src/core/workspace/WorkspaceElection.ts` (R22.4 additive `request`)
- `tests/core/runtime/backgroundRuntime.test.ts`
- `.planning/evidence/phase-01/{verification.txt,review.md}`, `.planning/STATUS.md`

Binding rulings R22.1–R22.8 were applied. The brief's stale sections were
corrected and disclosed in `verification.txt` (election listener registration,
arbiter-mediated close recovery, response bridge, `request` exposure, and App
dependency corrections).

### 1. Specification-compliance review

- Background wiring: `createValidatedStorage`, the singleton
  `createStandaloneTabController`, the singleton arbiter,
  `createBackgroundRuntime(...).start()`, the synchronously registered
  `createBackgroundElectionMessageListener`, and the `onInstalled` side-panel
  behaviour are all present inside `defineBackground`. PASS.
- ADR-0001 / R22.2: `onSingletonTabClosed` reads `np_workspace_election` with
  `ElectionRecordSchema` and, only for a valid standalone writer, submits a
  synthetic `relinquish` through the same arbiter with the record's instance ID,
  committed version, and epoch. There is no manual `storage.remove`/`write` of
  `np_workspace_election` in `background.ts`. The arbiter owns removal of both
  session keys. PASS.
- MV3 isolation: `background.ts` imports only storage, navigation, operation-id,
  arbiter, and workspace-type modules; it imports no React/antd/IndexedDB/
  provider/MCP module, and the built `background.js` contains none of those
  markers. The only `chrome.tabs` caller is the background controller. PASS.
- UI transport (R22.3): both Apps build the bus with the `sendMessage` response
  bridge that re-dispatches the resolved response into the bus's local inbound
  listeners, so the T13C client's `workspace.election.response` correlation
  works in production. `RawMessageListener` is imported from `BroadcastBus.ts`;
  that file was not modified. PASS.
- UI dependencies (R22.5): both `createWorkspaceElection` calls pass `bus`; both
  `createWorkspaceHandoff` calls pass `submitElectionRequest: election.request`;
  both effects call `election.claim('initial')`; Standalone additionally calls
  `void coordinator.announce()`. PASS.
- R22.4: only the `WorkspaceElection` interface gained a `request` member and the
  object literal now returns the existing private `request` function; `read`,
  `claim`, `relinquish`, and `isWriter` are unchanged, and the T13C/T14/T16 suites
  still pass. PASS.
- Surfaces: Side Panel uses `compact: true` and is Chat-only via
  `SidePanelShell`; Standalone uses `compact: false` and keeps
  `CORE_PAGE_REGISTRY`, the `standalone.focus` subscription, and the
  `STANDALONE_ROUTE_FALLBACK` diagnostic. PASS.
- Manifest: `pnpm run build` emits `sidepanel.html` and `standalone.html` and the
  manifest gains `side_panel.default_path`, with permissions still exactly
  `["sidePanel","storage"]` and no `tabs`/`activeTab`/host permission. PASS.
- Files: only the brief's created files, the three permitted modified source
  files, the new test file, and `.planning` evidence/status changed. No forbidden
  file was modified; no dependency, permission, storage key, message type, or
  error code was added. PASS.

### 2. Code-quality review

- `createBackgroundRuntime` reuses the T08 `validateInboundEnvelope` boundary,
  ignores `standalone.closed`, and does not throw on malformed input; the
  async close-recovery chain is fire-and-forget but only runs for the matching
  singleton tab and delegates to the arbiter. PASS.
- Both Apps factor the bridge exactly once per surface with one shared
  `rawListeners` set; there is no duplicated transport logic and no `any`. PASS.
- The election listener is registered synchronously at module evaluation and
  returns the literal `true` required by ADR-0001; response construction and
  double-response suppression are already covered by T13C. PASS.
- The `request` exposure is minimal and additive; no behaviour changed. PASS.
- No empty catch blocks; canonical error codes and structured redacting logging
  are retained in the reused modules. PASS.

### 3. Security and privacy review (assets and trust boundaries)

- Background is the only `chrome.tabs` caller and reads only the numeric tab id
  from `tabs.get`; no URL, title, favicon, or page content is read. PASS.
- The election listener validates the sender and envelope before any arbiter
  work; untrusted or invalid messages receive no response. PASS.
- No secrets, credentials, tokens, prompts, tool I/O, clipboard, page content, or
  customer data are logged, persisted, exported, or committed. The bus bridge
  passes only already-schema-validated response envelopes. PASS.
- No content script, host-page mutation, IndexedDB, network, provider, or MCP
  access is introduced. PASS.

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| T22-A | Low (test types) | The brief's Step 1 test invokes `listeners[0]`/`removed[0]`, which is TS2722 (`Cannot invoke an object which is possibly 'undefined'`) under the pinned `noUncheckedIndexedAccess: true`. | Type-only adaptation: use `listeners[0]!`/`removed[0]!`; test bodies, identifiers, values, and assertions unchanged; `tsconfig.json` unchanged. Same Low class as T03 B5 / T09 / T10 / T11. |
| T22-B | Low (format) | `prettier --check .` flagged only the new `src/entrypoints/sidepanel/App.tsx` (JSX prop wrapping). | Formatted that one file; identifiers, values, and behaviour unchanged; no other file reformatted. |

T22-A and T22-B are confined to permitted files and do not alter contracts,
identifiers, values, or assertions.

No Critical, High, or Medium finding remains unresolved.

### 5. Verification evidence

RED: `pnpm run test -- tests/core/runtime/backgroundRuntime.test.ts` exit 1 —
`createBackgroundRuntime is not a function` (7 failed | 212 passed; 1 failed file
| 31 passed). GREEN: `pnpm exec vitest run --project unit
tests/core/runtime/backgroundRuntime.test.ts` exit 0 (1 file, 8 tests); the
T13C/T14/T16 workspace regression `pnpm exec vitest run --project unit
tests/core/workspace` exit 0 (7 files, 104 tests); `pnpm run typecheck` exit 0;
`pnpm run lint` exit 0; `pnpm exec prettier --check .` exit 0; the
phase-applicable chain `typecheck && lint && test` exit 0 (32 files, 220 tests);
and `pnpm run build` exit 0 with `.output/chrome-mv3/sidepanel.html` and
`.output/chrome-mv3/standalone.html` present and a clean manifest. Full output is
recorded in `verification.txt` (Task 22 section).

### Acceptance decision

**PASS** — Task 22 meets specification-compliance, code-quality, and
security/privacy requirements; the only findings are two Low-severity test/
format additions (disclosed) and no blocking finding remains.

---

## Task 23 — Generated-Manifest Inspection

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `b9a13565ccc244200e6efae901c4e7fcbce7efac` (T22 atomic commit)
**Classification:** code task (TDD RED→GREEN); implementation tier balanced

### Scope reviewed

- `tests/build/manifestChecks.ts` (created; checker support module)
- `tests/build/manifest.test.ts` (created; runs in the `manifest` project)
- `tests/build/manifestAssertions.test.ts` (created; runs in the `unit` project)

### 1. Specification-compliance review

- `checkGeneratedManifest(manifest, options)` returns a `ManifestCheckResult`
  (`ok`, `failures`) and rejects: a wrong `manifest_version`, a permission set other
  than exactly `sidePanel` + `storage`, each of the forbidden permissions (`tabs`,
  `activeTab`, `scripting`, `alarms`, `unlimitedStorage`), non-empty
  `host_permissions`, any `content_scripts`, a wrong `side_panel.default_path`, a
  missing `action`, a missing required icon size, and a missing `standalone.html`.
  PASS
- Approved Interpretation 4: the real test runs in the dedicated `manifest` Vitest
  project after `pnpm run build`, parses `.output/chrome-mv3/manifest.json` from
  actual build output, and checks `standalone.html` in the same output directory; the
  fixture test runs in the `unit` project and proves checker logic only. No config
  unit test and no source-scan substitute is used as proof. PASS
- Real generated manifest satisfies the Phase 01 contract: permissions exactly
  `["sidePanel","storage"]`; no `host_permissions`; no `content_scripts`;
  `side_panel.default_path = "sidepanel.html"`; `action.default_title = "NowPilot"`;
  icons 16/32/48/128; `standalone.html` exists. The task STOP condition (an
  unapproved permission or a content script in the generated manifest) did not
  trigger. PASS
- Only the three allowed test files were created (plus `.planning` evidence/STATUS);
  `wxt.config.ts`, `vitest.config.ts`, source files, `DESIGN.md`, and `PLAN.md` were
  not modified. No new dependency, permission, storage key, message type, or error
  code. PASS

### 2. Code-quality review

- The checker is small, pure, and side-effect free: it reads its argument and the
  `standaloneHtmlExists` option and returns a structured result; it performs no I/O,
  no logging, and no global-state mutation. PASS
- Fail-closed assertions carry explicit, actionable messages; the exact-required-set
  comparison uses sorted arrays and a JSON comparison, independent of the forbidden
  and host-permission checks, so an unexpected permission produces a failure rather
  than passing. PASS
- No catch blocks; no empty catch; no `any`. The index signature on
  `GeneratedManifest` allows the real manifest's extra keys (`name`, `description`,
  `version`, `background`) to parse without weakening the asserted contract. PASS
- Test quality: the fixture test covers the passing case and each failure class
  (forbidden permission, wrong side-panel path, content scripts, host permissions,
  missing standalone.html); the real test fails loudly if the build output is absent
  (`missing <path>; run pnpm run build first`). PASS
- Low-severity formatting: `pnpm exec prettier --check .` flagged only the three new
  T23 files (line wrapping at printWidth 100). They were formatted with identifiers,
  literals, permission names, and assertions unchanged, and no other file was
  reformatted. PASS

### 3. Security and privacy review

- The task reads only the generated manifest and checks build-output file existence;
  it reads no page, note, memory, tool, secret, credential, token, prompt, or
  customer content. PASS
- The checker is an assertion helper, not a runtime permission grant: it cannot
  broaden permissions, and it fails closed on an unapproved permission or a content
  script. No permission or manifest change is introduced by this task. PASS
- No network, storage, IndexedDB, clipboard, or filesystem write; the only filesystem
  access is a read of build output in a test. PASS
- No sensitive value is embedded as a literal or committed in evidence. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Low (formatting) | `pnpm exec prettier --check .` flagged only the three new T23 files (line wrapping at printWidth 100). | Fixed by formatting only the three T23 files; identifiers, literals, permission names, and assertions unchanged; no other file reformatted. |
| — | Info | The brief's `manifestAssertions.test.ts` long `checkGeneratedManifest(...)` line and the checker's long template-literal lines were reflowed by Prettier; no value or assertion changed. | Recorded; not a defect. Prettier reflow is explicitly allowed by the task. |

No Critical, High, or Medium finding remains unresolved. No type-level deviation was
required: production and test code typecheck under the pinned
`strict`/`noUncheckedIndexedAccess` configuration without non-null assertions.

### 5. Verification evidence

RED: `pnpm run test -- tests/build/manifestAssertions.test.ts` exit 1 — module-
resolution failure for `./manifestChecks`; the 32 pre-existing unit files and 220
tests still passed. GREEN: focused assertions test exit 0 (33 files, 226 tests);
`pnpm run build` exit 0; `pnpm run test:manifest` exit 0 (1 file, 1 test) against the
real `.output/chrome-mv3/manifest.json`; `pnpm run typecheck` exit 0; `pnpm run lint`
exit 0; `pnpm exec prettier --check .` exit 0; and the phase-applicable chain
`typecheck && lint && test && build && test:manifest` exit 0. Full output is recorded
in `verification.txt` (Task 23 section).

### Acceptance decision

**PASS** — Task 23 meets specification-compliance, code-quality, and
security/privacy requirements; the generated manifest matches the Phase 01 contract,
the only finding is a Low-severity formatting correction, and no blocking finding
remains.

## Task 24 — Post-Build Bundle-Isolation Inspection (2026-09-20)

Branch: `phoenix`; repository root: `/Users/george.li/Documents/workspaces/nowpilot`.
Files created: `tests/build/isolationChecks.ts`, `tests/build/isolation.test.ts`,
`tests/build/isolationAssertions.test.ts`. Files modified (append-only records):
`.planning/evidence/phase-01/verification.txt`, `.planning/evidence/phase-01/review.md`,
`.planning/STATUS.md`. No config, source, `DESIGN.md`, or `PLAN.md` change.

### 1. Specification-compliance review

- Task scope is exactly the three declared files; no other file was created or
  modified. PASS
- Interfaces match the brief and the approved plan:
  `collectModuleGraph(entryFile, outDir): Map<string, string>`,
  `scanForbiddenMarkers(graph, markers): string[]`, and
  `checkBundleIsolation(outDir): IsolationCheckResult`. PASS
- The real inspection runs in the dedicated `isolation` Vitest project
  (`tests/build/isolation.test.ts`), after `pnpm run build`, and scans the actual
  built bundles under `.output/chrome-mv3/` (Approved Interpretation 4). PASS
- `tests/build/isolationAssertions.test.ts` runs in the `unit` project and proves
  the checker logic only; it is not accepted as proof of the real build. PASS
- The background graph contains none of `BACKGROUND_FORBIDDEN_MARKERS`; the Side
  Panel graph contains none of `SIDEPANEL_FORBIDDEN_MARKERS`; no content-script
  bundle exists. The real check reports zero failures. PASS
- Draining the static relative import graph is exercised against a synthetic
  multi-chunk fixture, and the checker is also exercised against synthetic React,
  Standalone-page, and content-script violations. PASS
- No dependency, permission, manifest, storage key, message type, error code, or
  `DiagnosticEvent` was added or changed; `vitest.config.ts` already lists the two
  paths used. PASS
- Marker lists were not weakened; no real marker was found. PASS
- Brief reconciliation (disclosed): the approved plan is internally inconsistent for
  `scanForbiddenMarkers` (test asserts `['indexedDB']`; implementation returns
  `${file}:${marker}`). Because the task freezes assertions, the implementation was
  reconciled to return the bare marker to satisfy the executable assertion, with the
  contradiction recorded in `verification.txt` (Task 24 section). This changes no
  marker list and no acceptance criterion. See finding M1.

### 2. Code-quality review

- Correctness: `collectModuleGraph` visits each distinct basename once (visited set),
  bounds the traversal, and terminates for cyclic and missing-file imports. PASS
- `scanForbiddenMarkers` is deterministic over the supplied marker list and returns
  the marker for each match; `checkBundleIsolation` aggregates failures and
  distinguishes a missing background/sidepanel entry from a marker hit and from a
  content-script bundle. PASS
- Failure messages name the bundle and the marker; the content-script failure names
  the offending path. PASS
- No `any`, no catch blocks, no global mutable state; the only I/O is filesystem
  reads of build output in a test helper. PASS
- Test quality: the RED failure was the intended module-resolution error; all
  pre-existing unit tests remained green throughout. PASS
- Type-only adaptation T24-A removed the brief's unused `statSync` import (TS6133 /
  `@typescript-eslint/no-unused-vars`); T24-B used `match[1]!` under the pinned
  `noUncheckedIndexedAccess` (same class as T03 B5 / T05 D4 / T09). Behaviour
  unchanged; `tsconfig.json` unmodified. PASS
- `pnpm exec prettier --check .` passed with no T24 reflow required. PASS

### 3. Security and privacy review

- The test reads only built extension artifacts; it reads no page, note, memory,
  tool, secret, credential, token, prompt, or customer content. PASS
- The checker is an assertion helper, not a runtime surface: it cannot grant
  permissions and has no side effects. It fails closed on a forbidden marker,
  a missing entry bundle, or a content script. PASS
- No network, storage, IndexedDB, clipboard, or filesystem write. PASS
- No sensitive value is embedded as a literal or committed in evidence. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| M1 | Low | The approved T24 plan is internally inconsistent: `scanForbiddenMarkers` test asserts `['indexedDB']` while the supplied implementation returns `${file}:${marker}`. | Reconciled the implementation to the frozen executable assertion (return the bare marker); marker lists unchanged; contradiction and reproduction recorded in `verification.txt`. |
| T24-A | Low (type-only) | The brief imports `statSync` in `isolationChecks.ts` but never uses it (TS6133 / `no-unused-vars`). | Removed the unused import; no behaviour change. |
| T24-B | Low (type-only) | The brief's `match[1]` is `string | undefined` under the pinned `noUncheckedIndexedAccess` (TS2345). | Used `match[1]!` inside the existing code path; non-null assertion only; no behaviour change. |
| — | Info | The standalone chunk contains `standalone-page-`, but it is not part of the background or Side Panel graph and is correctly not scanned. | Recorded; expected behaviour, not a defect. |

No Critical, High, or Medium finding remains unresolved. The one semantic deviation
(M1) is a required reconciliation of a plan defect that could not be resolved without
contradicting the frozen test assertions; it is low severity, disclosed, and does not
weaken any marker check or acceptance criterion.

### 5. Verification evidence

RED: `pnpm run test -- tests/build/isolationAssertions.test.ts` exit 1 — module-
resolution failure for `./isolationChecks`; 33 pre-existing unit files and 226 tests
still passed. GREEN: focused assertions test exit 0 (34 files, 232 tests);
`pnpm run build` exit 0; `pnpm run test:isolation` exit 0 (1 file, 1 test) against the
real `.output/chrome-mv3` build; `pnpm run typecheck` exit 0; `pnpm run lint` exit 0;
`pnpm exec prettier --check .` exit 0; and `pnpm run verify:phase-1` exit 0. Full
output is recorded in `verification.txt` (Task 24 section).

### Acceptance decision

**PASS** — Task 24 meets specification-compliance, code-quality, and
security/privacy requirements; both isolation tests pass against the real build; the
only findings are the disclosed Low-severity reconciliation and two disclosed
type-only adaptations; no blocking finding remains.

## Task 24 FIX ROUND 1 — nested-chunk traversal correction (2026-09-20)

Controller review finding (Important, correctness): the Task 24 isolation check was a
false positive for the real WXT build layout. `collectModuleGraph` resolved static
relative imports against `outDir` and keyed the visited set by `basename`, so nested
`chunks/<name>-<hash>.js` imports resolved to the wrong path, were skipped by
`existsSync`, and never entered the scanned graph. On the real build the Side Panel
graph contained only `sidepanel-5dzQBKiU.js`; its shared chunk
`WorkspaceSync-BiFvCgGz.js` was never scanned, so a forbidden marker inside a nested
chunk was a false negative. The prior Task 24 verification/review text overstated the
scanned graph.

Fix (narrow, non-weakening): `collectModuleGraph` now resolves each relative import
against the importing file's directory (`resolve(dirname(file), match[1]!)`) and tracks
visited files by resolved absolute path in a `Set<string>`, keeping `basename(file)` as
the graph key so the `Map<string, string>` interface is unchanged. `outDir` is retained
in the signature for compatibility and named `_outDir` (unused). No marker list changed;
no existing assertion changed or removed.

Covering tests added to `tests/build/isolationAssertions.test.ts` (4 new cases):
nested-directory static import traversal; no conflation of same-named files in
different directories; and `checkBundleIsolation` failure for a forbidden marker in a
nested background chunk and for a `standalone-page-` marker in a nested side panel
chunk. RED before the fix: 4 failed | 232 passed (236); GREEN after: 34 files, 236
tests passed.

Corrected real graph keys: `BACKGROUND_GRAPH = ["background.js"]`;
`SIDEPANEL_GRAPH = ["sidepanel-5dzQBKiU.js", "WorkspaceSync-BiFvCgGz.js"]`. Corrected
real result: `{ ok: true, failures: [] }` — the shared nested chunk contains no
`standalone-page-` marker, the background graph contains none of the ten forbidden
markers, and no content-script bundle exists. No marker was reported; marker lists were
not changed. All commands exit 0 (`test` 34 files / 236 tests; `build`; `test:isolation`
1 file / 1 test; `typecheck`; `lint`; `prettier --check .`; `verify:phase-1`).

Corrective commit: `fix(phase-01): follow nested chunks in bundle isolation scan`
(a new commit; FIX_BASE `a81ae96` not amended).

### Fix-round acceptance decision

**PASS** — the isolation gate now traverses the real nested WXT chunk graph, the false
negative is closed by the required non-weakening fix, all four new tests plus the
pre-existing 232 tests pass, and the full `pnpm run verify:phase-1` chain exits 0.

## Task 25 — Cross-Module Integration Tests (ADR-0001 amended) (2026-09-20)

Branch: `phoenix`; repository root: `/Users/george.li/Documents/workspaces/nowpilot`.
Files created: `tests/integration/workspaceIntegration.test.ts`. Files modified
(append-only records): `.planning/evidence/phase-01/verification.txt`,
`.planning/evidence/phase-01/review.md`, `.planning/STATUS.md`. No config, source,
`DESIGN.md`, `PLAN.md`, or ADR change. No production defect was found, so no
production file was modified.

### 1. Specification-compliance review

- Task scope is exactly the one declared test file plus the append-only evidence and
  status records; no other file was created or modified. PASS
- The test rig matches R25.1: one in-memory bus routes `workspace.election.request` to
  a real `createWorkspaceElectionArbiter` over the shared validated storage,
  dispatches the correlated `workspace.election.response` envelope
  (`source:'background'`, `target` = request source, `correlationId` = request
  envelope `id`), and dispatches other envelope types to their handlers. Clients are
  built with `createWorkspaceElection({ storage, store, bus, writerType, instanceId,
  now })` and use `claim(reason)`. PASS
- R25.2 cases are all covered: (1) concurrent initial claims elect exactly one writer
  with the loser `held` naming the winner; (2) epoch monotonicity across
  claim/handoff-commit/recovery; (3) handoff-commit versus fallback-claim exclusion
  with exactly one new epoch; (4) service-worker restart reconstruction (current
  writer/epoch and duplicate-request idempotency); (5) ordinary `workspace.mutation`
  never changes the election record/epoch and never routes through the arbiter. PASS
- The brief's mirror-ordering/gap-rehydration, workspace restart durability, and
  theme-propagation tests are present; the theme test additionally proves no election
  record is created. PASS
- Assertions were not weakened; `vi.waitFor` is used only for the asynchronous theme
  storage-change delivery. Mocked Chrome APIs only; no network/provider/IndexedDB. PASS
- No dependency, permission, manifest, storage key, message type, error code, or
  `DiagnosticEvent` was added or changed. PASS

### 2. Code-quality review

- The rig reuses the accepted T16 in-memory bus pattern; the arbiter is real and is
  only wrapped in a `vi.fn` that delegates to it, so the "arbiter saw no election
  request" assertion is direct evidence rather than a mock stub. PASS
- Concurrency cases use `Promise.all` against the arbiter's FIFO executor and assert
  outcomes rather than scheduling, so they are deterministic and not timing-flaky. PASS
- The mutation case drives the mutation through the bus to the coordinator (not by
  calling the coordinator method directly), asserts the returned step, the arbiter
  call count, the absence of a new election request, reference identity of the raw
  stored record, and deep equality of the validated record. PASS
- The restart case reuses the same Chrome storage mock with a fresh arbiter/client and
  asserts both reconstruction and duplicate idempotency. PASS
- No `any`, no catch blocks, no global mutable state, no unused imports; `typecheck`,
  `lint`, and `prettier --check .` all pass. PASS
- Test quality: all eight tests passed on first run against implemented behaviour
  (verification task per brief Step 2); no pre-existing test changed. PASS

### 3. Security and privacy review

- Tests use mocked `chrome.storage` only; no network, provider, MCP, IndexedDB,
  clipboard, or filesystem access. PASS
- No secret, credential, token, prompt, tool input/output, page, note, memory, or
  customer content is read, logged, or persisted. PASS
- The mutation case is an ordinary `workspace.metadata.set` classification and does
  not cross the election trust boundary; the arbiter remains the only election-record
  writer. PASS
- No sensitive value is embedded as a literal or committed in evidence. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Info | All eight integration tests passed on first run against already-implemented behaviour. | Recorded as a verification task per brief Step 2; no production change; tests retained. |

No Critical, High, Medium, or Low finding. No production defect was found.

### 5. Verification evidence

`pnpm exec vitest run --project unit tests/integration/workspaceIntegration.test.ts
--reporter=verbose` exit 0 (1 file, 8 tests); `pnpm run test -- tests/integration`
exit 0 (35 files, 244 tests); `pnpm run typecheck` exit 0; `pnpm run lint` exit 0;
`pnpm exec prettier --check .` exit 0; and `pnpm run verify:phase-1` exit 0 (unit
35 files / 244 tests; manifest 1 file / 1 test; isolation 1 file / 1 test). Full
output is recorded in `verification.txt` (Task 25 section).

### Acceptance decision

**PASS** — Task 25 covers every R25.2 integration case plus the brief's mirror,
restart, and theme tests without weakening any assertion; all gates exit 0; no
production defect was found and no production file was modified.

---

## Task 26 — Complete Build and Isolation Gate (2026-09-20)

**Phase:** Phase 01 — Runtime, Shells, and Workspace
**Branch:** `phoenix`
**Repository root:** /Users/george.li/Documents/workspaces/nowpilot
**Base commit:** `35ab95a4e3f51d04f190d99606de76d87577a0fe`
**Classification:** approved non-code gate task (`AGENTS.md` Section 11) — evidence only
**Depends on:** T23, T24, T25

### Scope reviewed

- The approved Step 1–5 gate in `.superpowers/sdd/PLAN/task-26-brief.md`, run from a
  clean `.output`.
- `pnpm run verify:phase-1` / `verify:all` (the full aggregate chain), the three
  verbose test runs, the built `chrome-mv3` manifest and artefacts, and the
  ADR-0001 13-type / 15-code registry completeness coverage.
- No production, test, config, manifest, or dependency file was created or modified.

### 1. Specification-compliance review

- The aggregate ran from a clean `.output` (`rm -rf .output` first) and completed
  `typecheck → lint → test → build → test:manifest → test:isolation` in exactly the
  approved order with exit status 0. PASS
- Step 2: `verify:phase-1` and `verify:all` compare byte-identically, so the
  `verify:all` alias is neither weaker nor divergent. PASS
- Step 3: `test`, `test:manifest`, and `test:isolation` were each run verbose; every
  project reports `N passed (N)` and no test row is skipped/pending/todo. PASS
- Step 4: the real built `manifest.json` declares exactly `permissions:
  ["sidePanel","storage"]` and `side_panel.default_path = sidepanel.html`, with no
  `content_scripts` and no `host_permissions`; `shasum -a 256` recorded for
  `background.js`, `sidepanel.html`, and `standalone.html`. PASS
- ADR-0001 registry completeness is covered in the aggregate unit run: 13 message
  types (including the election request/response pair) and 15 operational error codes
  (including `WORKSPACE_ELECTION_REJECTED`/`WORKSPACE_ELECTION_FAILED`), with
  diagnostic events kept separate. PASS
- Only `.planning` evidence/status files changed; the task did not touch any
  production, test, or config path and did not run T27/T28 work. PASS

### 2. Code-quality review

- No source was changed, so this gate adds no code-quality risk; it exercises the
  existing accepted suites and build end to end.
- The full unit suite is 35 files / 244 tests; manifest and isolation are 1 file /
  1 test each; all pass. The build emitted all expected entrypoints and chunks, and
  the isolation suite confirms the background stays lean, the side panel carries no
  standalone page markers, and no content-script bundle is shipped. PASS
- No `any`, no skipped test, no weakened assertion, and no test modified. PASS

### 3. Security and privacy review

- The manifest declares only the two approved permissions (`sidePanel`, `storage`),
  no host permissions, and no content script. PASS
- No secret, credential, token, prompt, tool input/output, page, note, memory, or
  customer content was read, logged, or recorded. Checksums and manifest metadata are
  non-sensitive. PASS
- `rm -rf .output` is limited to generated, git-ignored build output explicitly
  authorised by the approved brief. PASS

### 4. Findings and dispositions

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| — | Info | Build reports a Vite chunk-size warning (`WorkspaceSync-BiFvCgGz.js` 599.29 kB > 500 kB). | Pre-existing informational build advisory only; not a gate failure and outside T26 scope. Recorded for later review. |

No Critical, High, Medium, or Low finding. No gate was weakened.

### 5. Verification evidence

`rm -rf .output` then `pnpm run verify:phase-1` exit 0 (typecheck, lint, unit 35 files /
244 tests, build, manifest 1 file / 1 test, isolation 1 file / 1 test); Step 2 node
equality check exit 0; all three verbose runs exit 0 with zero skipped; manifest summary
and `shasum -a 256` checksums recorded. Full output is in `verification.txt` (Task 26
section).

### Acceptance decision

**PASS** — Task 26 completes the Phase 01 build and isolation gate from a clean
`.output`: the full chain passes in the approved order, `verify:all` is byte-identical,
no test is skipped, and the real manifest/artefacts satisfy the permission, entrypoint,
and isolation contract. No production, test, or config file was modified.

## Task 27 — Manual unpacked-extension acceptance BLOCKED (operator handoff, 2026-09-19)

T27 requires ten real Chrome screenshots taken from a manually loaded unpacked
extension (`.output/chrome-mv3` via `chrome://extensions` → Load unpacked),
including two of the Chrome Side Panel (`sidepanel-open.png`,
`sidepanel-chat-only.png`). The Chrome Side Panel (`chrome.sidePanel`) is a
browser-chrome surface that requires a user gesture to open and is not
addressable as a page; it cannot be captured by Playwright or other headful
automation. There is no approved automated substitute, and placeholder or
fabricated screenshots are forbidden by `AGENTS.md` Section 13 and by the task's
own constraints ("real screenshots only; no placeholder images").

Per `AGENTS.md` Section 18.7 (a manual visual decision cannot be determined from
approved mock-ups and acceptance criteria) and Section 19 (stop conditions),
execution is stopped before T27. T28 (acceptance preparation) is not started.

State at the stop:
- commit `585ae17ce3cb6255933ccebc76a963b0f5edef96`; branch `phoenix`; working
  tree clean.
- `pnpm run verify:phase-1` exit 0 (unit 35 files / 244 tests; manifest 1/1;
  isolation 1/1); manifest permissions exactly `sidePanel` + `storage`; no
  content script; background bundle isolation clean.
- The ten T27 manual checks and their required screenshot filenames are listed in
  `.planning/phases/01-runtime-shells-workspace/PLAN.md` Task 27 Step 2.

Operator decision required: perform the ten manual checks and provide the
screenshots, or authorise a documented automated-substitute evidence approach.
No check is marked passed; no screenshot was fabricated.
