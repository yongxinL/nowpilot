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
