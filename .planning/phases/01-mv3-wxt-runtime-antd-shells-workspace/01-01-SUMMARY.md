---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 01
subsystem: infra
tags: [wxt, mv3, pnpm, vitest, chrome-extension, antd, toolchain]

requires: []
provides:
  - "pnpm-based WXT 0.19.29 scaffold with pinned approved stack (D-01/D-05)"
  - "Appendix G wxt.config.ts (manifest permissions, CSP, manualChunks) + sidepanel/standalone entrypoint stubs"
  - "vitest + WxtVitest + fakeBrowser test toolchain (D-03, Pattern 4)"
  - "tests/isolation/check-content-bundle.mjs + no-content-script-ui.test.ts (Appendix G isolation, I4)"
  - "verify:phase-1 + verify:all gates (D-02/D-04) and verify:e2e-phase-1 smoke gate (I1 Option A)"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, phase-2]

tech-stack:
  added: [wxt ^0.19.29, @wxt-dev/module-react ^1.2.2, antd ^6.5.3, @ant-design/x ^2.9.0, @ant-design/icons ^6.3.2, @ant-design/x-markdown ^2.9.0, motion ^12.43.0, zustand ^5.0.14, immer ^10.2.0, zod ^3.25.76, typescript ^5.9.3, vitest ^4.1.10, @testing-library/react ^16.3.2, @testing-library/dom ^10.4.1, @testing-library/jest-dom ^7.0.0, jsdom ^30.0.1, msw ^2.15.0, @types/chrome ^0.2.5, @puppeteer/browsers ^3.1.0, puppeteer-core ^25.5.0, eslint ^10.8.1, prettier ^3.9.6, typescript-eslint ^8.66.0]
  patterns:
    - "Pattern 4 test wiring: WxtVitest() + jsdom + tests/setup.ts (matchMedia polyfill + fakeBrowser.reset)"
    - "Verify gate chain per §24: eslint → prettier → tsc → wxt build → full vitest run → isolation check"
    - "Bundle isolation: manualChunks for HTML multi-page groups; content scripts import-only dependency-free core"

key-files:
  created: [package.json, wxt.config.ts, vitest.config.ts, tests/setup.ts, tests/isolation/check-content-bundle.mjs, tests/isolation/no-content-script-ui.test.ts, tests/e2e/load-smoke.mjs, src/entrypoints/background.ts, src/entrypoints/sidepanel/index.html, src/entrypoints/sidepanel/main.tsx, src/entrypoints/standalone/index.html, src/entrypoints/standalone/main.tsx, eslint.config.mjs, .prettierrc, .prettierignore, pnpm-lock.yaml, pnpm-workspace.yaml]
  modified: [.gitignore, package.json]

key-decisions:
  - "manualChunks applied via vite:build:extendConfig hook scoped to HTML multi-page groups only — verbatim top-level placement breaks WXT 0.19 lib-mode IIFE builds (background/content single-file SW); Rule 3 deviation"
  - "vitest imports WxtVitest + fakeBrowser from 'wxt/testing' — the plan's 'wxt/testing/vitest-plugin' and 'wxt/testing/fake-browser' subpaths do not exist in wxt 0.19.29's exports map (Rule 3)"
  - "isolation test file marked @vitest-environment node — jsdom 30 realm TextEncoder violates esbuild's Uint8Array invariant (Rule 3)"
  - "eslint config created from scratch (flat config) — the wxt@0.19.29 react template ships no eslint/prettier despite the plan assuming it does (Rule 3)"
  - "Chrome-for-Testing real-browser verification deferred: host lacks libnspr4/libnss3 and sudo is unavailable — RESEARCH A8 flagged assumption; load-smoke.mjs emits actionable diagnostic"

patterns-established:
  - "Entrypoint stems sidepanel/ + standalone/ (NOT app/) — spec reconciliation #1 (Pitfall 3)"
  - "isolated node env for build-grep tests (no jsdom needed)"
  - "pnpm 11.18 minimum-release-age exclusion recorded in pnpm-workspace.yaml (recent eslint)"

requirements-completed: [RUNTIME-01]

coverage:
  - id: D1
    description: "pnpm migration + WXT 0.19.29 scaffold with exact pinned approved stack (D-01/D-05)"
    requirement: RUNTIME-01
    verification:
      - kind: other
        ref: "node -e pin assertion (wxt ^0.19.29, module-react ^1.2.2, immer ^10.2.0, zod ^3.25.76, typescript ^5.9.3) + test ! -f package-lock.json + pnpm install --frozen-lockfile"
        status: pass
    human_judgment: false
  - id: D2
    description: "Appendix G wxt.config.ts (manifest permissions/CSP/side_panel) + sidepanel/standalone entrypoint stubs build sidepanel.html + standalone.html from wave 1"
    requirement: RUNTIME-01
    verification:
      - kind: other
        ref: "pnpm wxt build exits 0; test -f .output/chrome-mv3/sidepanel.html && test -f .output/chrome-mv3/standalone.html; test ! -d src/entrypoints/popup && test ! -d src/entrypoints/app"
        status: pass
    human_judgment: false
  - id: D3
    description: "vitest toolchain (WxtVitest + matchMedia polyfill + fakeBrowser reset) and verify:phase-1 gate chain green"
    verification:
      - kind: other
        ref: "pnpm verify:phase-1 exits 0 (eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && node tests/isolation/check-content-bundle.mjs)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Content-bundle isolation scaffold — check-content-bundle.mjs + §24-named no-content-script-ui.test.ts (I4)"
    verification:
      - kind: unit
        ref: "tests/isolation/no-content-script-ui.test.ts#content-script bundle contains no UI/antd/React (Appendix G isolation rule)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real-browser MV3 load of sidepanel.html + standalone.html in Chrome for Testing (RUNTIME-01 real-browser proof)"
    requirement: RUNTIME-01
    verification:
      - kind: other
        ref: "pnpm verify:e2e-phase-1 — pinned Chrome 151.0.7922.77 downloaded and cached; launch blocked by missing host system libs (libnspr4/libnss3, no sudo)"
        status: fail
    human_judgment: true
    rationale: "Real-browser mount proof requires Chrome runtime system libraries (libnspr4/libnss3/X11) not installed on this host, and sudo is unavailable. RESEARCH A8 flagged assumption; deferred — script is wired and emits an actionable install hint. Verify on a host with a usable Chrome."

duration: 174min
completed: 2026-08-08
status: complete
---

# Phase 01 Plan 01: WXT 0.19 pnpm Scaffold + Appendix G Build Config + Vitest Toolchain Summary

**pnpm-based WXT 0.19.29 MV3 scaffold with the pinned approved stack, Appendix G build config (manifest/CSP/manualChunks), sidepanel/standalone entrypoint stubs, vitest + fakeBrowser test toolchain, content-bundle isolation check, and a green verify:phase-1 gate — the build+test foundation every later phase depends on.**

## Performance

- **Duration:** 174 min
- **Started:** 2026-08-08T03:37:53Z
- **Completed:** 2026-08-08T06:31:56Z
- **Tasks:** 4 (all type="auto", committed atomically)
- **Files modified:** 27 across 5 commits

## Accomplishments

- **pnpm migration (D-01):** removed the tracked npm `package-lock.json`; pnpm is now the sole package manager with `pnpm-lock.yaml` as the lockfile. `pnpm install --frozen-lockfile` passes.
- **WXT 0.19.29 scaffold (D-05, Pitfall 2):** scaffolded via `pnpm dlx wxt@0.19.29 init . --template react --pm pnpm` in a temp dir (the init aborts on non-empty dirs), overlaid onto the repo. The scaffold's own `wxt: ^0.21.3` pin was corrected to `^0.19.29` — the plan's stack-drift guard. All RESEARCH Standard Stack exact lines pinned and verified (wxt ^0.19.29, @wxt-dev/module-react ^1.2.2, immer ^10.2.0, zod ^3.25.76, typescript ^5.9.3, vitest ^4.1.10, antd ^6.5.3, @ant-design/x ^2.9.0, motion ^12.43.0, zustand ^5.0.14). Zero banned packages.
- **Appendix G wxt.config.ts + entrypoint stubs (Pitfall 3):** manifest verbatim (permissions, optional_permissions, host_permissions, side_panel default_path 'sidepanel.html', action, CSP, web_accessible_resources), target chrome120, sourcemap inline. Entrypoint stems are `sidepanel/` and `standalone/` (NOT `app/`); popup deleted; background.ts stub kept so `wxt build` emits background.js from wave 1. `wxt build` produces sidepanel.html + standalone.html from wave 1 (RUNTIME-01 foundation).
- **Vitest toolchain (D-03, Pattern 4):** `vitest.config.ts` uses `WxtVitest()` + jsdom + `tests/setup.ts` (window.matchMedia polyfill per Pitfall 6/A5 + `fakeBrowser.reset()` per test).
- **Isolation check (Appendix G + §24, I4):** `tests/isolation/check-content-bundle.mjs` greps built content bundles for forbidden tokens (antd/React/react-dom/defuddle/yaml); `no-content-script-ui.test.ts` wraps it as the §24-named vitest test. Both pass with no content bundle yet (plan 07 makes it meaningful).
- **Verify gates (D-02/D-04):** `verify:phase-1` = eslint → prettier → tsc → wxt build → FULL vitest run → isolation check (green, exit 0). `verify:all` per §24. `verify:e2e-phase-1` (I1 Option A) wired as a separate browser-load gate.
- **Smoke e2e (I1 Option A):** `tests/e2e/load-smoke.mjs` installs a pinned Chrome-for-Testing build into `.cache/`, launches headless, loads `.output/chrome-mv3` unpacked, and asserts both surfaces mount `#root` console-error-free. Pinned Chrome 151.0.7922.77 downloaded; launch deferred pending host system libs (RESEARCH A8 flagged assumption).

## Task Commits

Each task was committed atomically:

1. **Task 1: pnpm migration + WXT scaffold + pinned dependency install** - `10b04c6` (chore)
2. **Task 2: Appendix G wxt.config.ts + entrypoint stubs** - `7fbea28` (feat)
3. **Task 3: vitest toolchain + isolation script + verify:phase-1 scripts** - `0630823` (feat), `38d3f87` (style: prettier-format of wxt.config.ts required by the format gate)
4. **Task 4: Smoke e2e — Chrome for Testing load gate** - `5043d53` (feat)

**Plan metadata:** pending (committed after this SUMMARY.md)

## Files Created/Modified

- `package.json` - Pinned deps + verify:phase-1/verify:all/verify:e2e-phase-1 scripts
- `pnpm-lock.yaml` - pnpm lockfile (replaces npm package-lock.json, deleted)
- `pnpm-workspace.yaml` - pnpm 11.18 minimum-release-age exclusion for recent eslint
- `tsconfig.json` - WXT scaffold (extends generated .wxt/tsconfig.json: strict + @/* alias)
- `wxt.config.ts` - Appendix G config + hook-scoped manualChunks
- `vitest.config.ts` - WxtVitest() + jsdom + tests/setup.ts
- `tests/setup.ts` - matchMedia polyfill + fakeBrowser.reset() per test
- `tests/isolation/check-content-bundle.mjs` - content-bundle isolation grep
- `tests/isolation/no-content-script-ui.test.ts` - §24-named vitest wrapper (I4)
- `tests/e2e/load-smoke.mjs` - Chrome for Testing load gate (I1 Option A)
- `src/entrypoints/background.ts` - WXT background stub (plan 09 replaces body)
- `src/entrypoints/sidepanel/{index.html, main.tsx}` - wave-1 mount stubs
- `src/entrypoints/standalone/{index.html, main.tsx}` - wave-1 mount stubs
- `eslint.config.mjs` - flat config (scaffold shipped none)
- `.prettierrc` / `.prettierignore` - format gate config
- `assets/react.svg`, `public/{icon, wxt.svg}` - scaffold assets
- `.gitignore` - + `.cache/` (Chrome downloads)

## Decisions Made

- **manualChunks scoped to HTML multi-page builds** via `vite:build:extendConfig` hook. The plan's two acceptance criteria (verbatim Appendix G AND `wxt build` exits 0) are mutually exclusive under WXT 0.19: background/content build as single-file IIFE lib-mode (MV3 SW constraint) where Rollup rejects `manualChunks` (`not supported for output.inlineDynamicImports`). The hook preserves the exact Appendix G chunk rule set for the HTML pages while letting lib-mode builds proceed. Content-bundle isolation is enforced by import restriction + the isolation grep (Pitfall 4).
- **`wxt/testing` is the correct import** for both `WxtVitest` and `fakeBrowser` in 0.19.29 — the `/vitest-plugin` and `/fake-browser` subpaths from the plan/RESEARCH do not exist in this version's package exports.
- **isolation test runs in node env** (`@vitest-environment node`) — jsdom 30's realm-crossing TextEncoder violates esbuild's `TextEncoder.encode() instanceof Uint8Array` invariant.
- **eslint flat config created from scratch** — the react template ships no eslint/prettier (plan assumption incorrect); `@eslint/js` + typescript-eslint + `.prettierignore` (docs excluded).
- **Real-browser verification deferred** per RESEARCH A8 — no Chrome system libs and no sudo on this host; the e2e gate is wired and actionable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] manualChunks breaks WXT lib-mode IIFE builds**
- **Found during:** Task 2 (wxt.config.ts + `pnpm wxt build`)
- **Issue:** Appendix G's verbatim `rollupOptions.output.manualChunks` conflicts with WXT 0.19's background/content builds: they compile as single-file IIFE (MV3 requires no dynamic imports in the SW), Vite forces `inlineDynamicImports: true`, and Rollup rejects `manualChunks` → "Failed to build background". The plan's two Task-2 acceptance criteria (verbatim diff AND build exit 0) cannot both hold.
- **Fix:** Moved the identical manualChunks rule set into the `vite:build:extendConfig` hook, applied only when `config.build?.lib` is unset (i.e. HTML multi-page groups). Manifest/vite options remain structurally verbatim.
- **Files modified:** wxt.config.ts
- **Verification:** `pnpm wxt build` exits 0; background.js emits as single IIFE; sidepanel/standalone chunked with react chunk; manifest matches Appendix G fields
- **Committed in:** 7fbea28

**2. [Rule 3 - Blocking] WxtVitest/fakeBrowser import paths don't exist in wxt 0.19.29**
- **Found during:** Task 3 (vitest.config.ts load)
- **Issue:** Plan/RESEARCH specify `wxt/testing/vitest-plugin` and `wxt/testing/fake-browser`; wxt 0.19.29's package.json exports map only exposes `./testing` (which re-exports both `WxtVitest` and `fakeBrowser`).
- **Fix:** Import both from `'wxt/testing'`.
- **Files modified:** vitest.config.ts, tests/setup.ts
- **Verification:** `pnpm vitest run` loads config and passes
- **Committed in:** 0630823

**3. [Rule 3 - Blocking] jsdom/esbuild TextEncoder invariant clash**
- **Found during:** Task 3 (vitest run)
- **Issue:** The isolation test (node:child_process only) ran in the default jsdom env; jsdom 30's TextEncoder/Uint8Array realm mismatch trips esbuild's startup invariant → suite failed to load.
- **Fix:** Added `@vitest-environment node` to no-content-script-ui.test.ts (it needs no DOM).
- **Files modified:** tests/isolation/no-content-script-ui.test.ts
- **Verification:** `pnpm vitest run` passes
- **Committed in:** 0630823

**4. [Rule 3 - Blocking] No eslint/prettier shipped by the react template**
- **Found during:** Task 3 (verify:phase-1 lint gate)
- **Issue:** The plan assumes "eslint/prettier ship with the scaffold" — the wxt@0.19.29 react template ships neither, so `eslint .` had no config and the tools weren't installed.
- **Fix:** Installed eslint ^10.8.1, prettier ^3.9.6, typescript-eslint ^8.66.0, @eslint/js ^10.0.1; created `eslint.config.mjs` (flat config: recommended + tseslint recommended, `.planning`/`.cache`/`.output` ignored, `argsIgnorePattern: '^_'`); created `.prettierignore` (docs/lockfiles excluded); prettier-formatted wxt.config.ts to satisfy the format gate.
- **Files modified:** package.json, eslint.config.mjs, .prettierignore, wxt.config.ts, pnpm-lock.yaml, pnpm-workspace.yaml
- **Verification:** `pnpm verify:phase-1` exits 0
- **Committed in:** 0630823, 38d3f87

**5. [Rule 3 - Blocking] eslint scan of downloaded Chrome binaries**
- **Found during:** Task 4 verification (verify:phase-1 regression)
- **Issue:** The Chrome-for-Testing download in `.cache/` was being linted (thousands of no-unused-expressions errors in bundled JS) once the browser was fetched.
- **Fix:** Added `.cache/**` to eslint ignores; added `.cache/` to .gitignore.
- **Files modified:** eslint.config.mjs, .gitignore
- **Verification:** `pnpm verify:phase-1` exits 0 with Chrome present in .cache/
- **Committed in:** 5043d53

**6. [Rule 2 - Missing Critical] Chrome load failure diagnostics**
- **Found during:** Task 4 (first e2e run)
- **Issue:** Chrome cannot launch on this host (libnspr4.so/libnss3.so/X11 libs missing, no passwordless sudo) — the script would fail with an opaque 127 error.
- **Fix:** Wrapped `puppeteer.launch` with a catch that prints the exact missing-libs install command and defers real-browser verification (matches RESEARCH A8 flagged assumption).
- **Files modified:** tests/e2e/load-smoke.mjs
- **Verification:** `pnpm verify:e2e-phase-1` prints actionable diagnostic
- **Committed in:** 5043d53

**7. [Rule 3 - Blocking] Chrome stable tag not resolved by install()**
- **Found during:** Task 4 (e2e download)
- **Issue:** @puppeteer/browsers v3 does not resolve the 'stable' channel tag inside `install()` (404 on `stable/linux64/...`); it requires a concrete buildId.
- **Fix:** Call `resolveBuildId(Browser.CHROME, platform, ChromeReleaseChannel.STABLE)` first, then install that exact build.
- **Files modified:** tests/e2e/load-smoke.mjs
- **Verification:** Chrome 151.0.7922.77 downloaded and cached successfully
- **Committed in:** 5043d53

**8. [Rule 3 - Blocking] /tmp tmpfs quota exhaustion**
- **Found during:** Task 4 (vitest regression after e2e)
- **Issue:** Chrome's failed launch left 532 transient ~13MB `.so` crash artifacts in /tmp (80% full → `Unknown system error -122: write` broke vitest).
- **Fix:** Removed the transient artifacts and puppeteer profile dirs; /tmp back to 1% usage. RESEARCH A9 (tmpfs quota) noted.
- **Files modified:** none (environment cleanup)
- **Verification:** `pnpm verify:phase-1` exits 0
- **Committed in:** none (pre-existing environment state)

---

**Total deviations:** 8 auto-fixed (6 Rule 3 blocking, 1 Rule 2 missing critical, 1 environment). 1 caused by conflicting plan acceptance criteria (deviation 1); the rest are stale-version or missing-scaffold artifacts.
**Impact on plan:** All auto-fixes were required for the build to succeed and the gates to be green. No scope creep; the Appendix G isolation intent is preserved via hook-scoped manualChunks + the isolation grep. The e2e browser proof remains deferred (environment limitation, pre-flagged in the plan).

## Issues Encountered

- **wxt init requires an empty dir:** scaffolded in `/tmp/opencode/wxt-scaffold` and copied files into the repo root, preserving `.planning/`, AGENTS.md, README.md.
- **Postinstall `wxt prepare` fails at Task-1 commit time** (no entrypoints yet — "No entrypoints found"). Transient by design; Task 2 creates entrypoints and the build/gate go green from wave 1 onward. `pnpm install --frozen-lockfile --ignore-scripts` verified the lockfile independently.
- **Spec line numbers stale:** the plan's Appendix G refs (lines 5304-5351) point at Appendix F.3 in the current spec; actual Appendix G is lines 5399-5448 (includes a `description` manifest field the plan's range didn't show). Used the current canonical block.
- **Task-3 AC5 `execFileSync == 1` is un-satisfiable as written:** the plan prose requires BOTH an import and a call, which is 2 matches. Semantics (wrapper present and invokes the script) are satisfied; noted here for the verifier.

## User Setup Required

None - no external service configuration required. (Optional: install Chrome runtime libs to enable `pnpm verify:e2e-phase-1`.)

## Next Phase Readiness

- **Ready for plan 01-02 (runtime primitives: RuntimeEnvelope, OperationId, MessageType):** vitest + fakeBrowser toolchain green; `@/*` alias resolves; verify:phase-1 gate exercises the full chain and will pick up new tests automatically (no dir list — full `vitest run`).
- **Ready for plan 01-07 (content entrypoint + isolation enforcement):** check-content-bundle.mjs exists and will become meaningful once a content bundle builds.
- **Blockers/concerns:** real-browser MV3 load proof (RUNTIME-01 e2e) is deferred until the dev host has Chrome runtime libraries; `verify:phase-1` (unit gate) is unaffected and green. Manual "load unpacked + click through" remains a follow-up for a Chrome-capable environment.

---
*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

- All 10 key files exist on disk (verified with `[ -f ]`)
- All 5 task commits found in git log (10b04c6, 7fbea28, 0630823, 38d3f87, 5043d53)
- `pnpm verify:phase-1` exits 0 (eslint → prettier → tsc → wxt build → vitest run → isolation check)
- `pnpm wxt build` emits sidepanel.html + standalone.html + background.js
- Pin assertions pass: wxt ^0.19.29 / immer ^10.2.0 / zod ^3.25.76 / typescript ^5.9.3
