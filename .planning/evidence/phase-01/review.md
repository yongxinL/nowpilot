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
