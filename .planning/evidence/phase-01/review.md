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
