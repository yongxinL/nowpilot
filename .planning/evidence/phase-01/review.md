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
