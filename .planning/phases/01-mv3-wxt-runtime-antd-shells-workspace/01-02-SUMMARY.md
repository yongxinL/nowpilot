---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 02
subsystem: infra
tags: [wxt, mv3, srcDir, antd, ant-design-x, react, provider-root, shell, isolation-gate, hmr, csp]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-MIGRATION-INVENTORY.md (the frozen D-04 conversion map: row classifications, target paths, gate re-pointing duties and the resolved hand-off decisions H-1…H-9/OQ1…OQ7)
provides:
  - WXT as the single authoritative build/dev runtime with `srcDir: 'src'` and `@wxt-dev/module-react` as the only React integration
  - Every extension entrypoint relocated under `src/entrypoints/**`, including the content script at a WXT-discoverable path (`src/entrypoints/content/index.ts`)
  - `@` resolving to `src` identically in WXT's generated alias map, `tsconfig.json` and `vitest.config.ts`
  - `getAntdConfig({ mode, pack, compact })` — the single theme derivation point, one `XProvider` per surface, `AntdApp` + mounted `ErrorBoundary` per surface
  - `SidePanelShell` / `SidePanelRouter` and the adapted `StandaloneShell` / new `StandaloneRouter` rendering the canonical Phase-1 surface contracts
  - A green `pnpm run build:ext` producing the authorised MV3 manifest (no options keys, `connect-src 'none'`), with `.wxt/**` untracked
  - Three move-sensitive gates re-pointed and proven non-vacuous by deliberate-violation probes
  - WXT dev-mode HMR observed as a real `js-update` for a component edit
affects: [01-03, 01-04, 01-05, 01-07, 01-08, 01-09, 01-11, 01-12, 01-13]

actuals:
  tokens: 26000    # chars/4 over the realized diff (git diff -U0 <plan_head_before>..HEAD = 104,119 chars)
  tasks: 3
  commits: 3       # measured: git rev-list --count 4b0a537..HEAD
  plan_head_before: 4b0a537dc9d050a92f302107f8f2cb5afb034586

tech-stack:
  added: ["@wxt-dev/module-react@^1.2.2 (the phase's single approved dependency install; no other version changed)"]
  patterns:
    - "One provider chain per surface: XProvider > AntdApp > ErrorBoundary > shell, fed by one `getAntdConfig` call"
    - "Deferred controls are `disabled` + `data-np-backing=\"deferred\"` + tooltip — never an enabled control whose behaviour does not exist"
    - "Gates are proved by deliberate-violation probes (red against the violation, green against the clean tree) before they are trusted"
    - "Import-based isolation gates resolve specifiers against the importing file, so bare relative hops are seen exactly like `components/` paths"

key-files:
  created:
    - src/core/theme/antdConfig.ts
    - src/components/sidepanel/SidePanelShell.tsx
    - src/components/sidepanel/SidePanelRouter.tsx
    - src/components/standalone/StandaloneRouter.tsx
    - tests/components/SidePanelShell.test.tsx
    - tests/components/StandaloneShell.test.tsx
    - .output/.gitkeep
  modified:
    - wxt.config.ts
    - tsconfig.json
    - vitest.config.ts
    - .gitignore
    - package.json
    - src/entrypoints/background.ts
    - src/entrypoints/sidepanel/main.tsx
    - src/entrypoints/standalone/main.tsx
    - src/entrypoints/content/index.ts
    - src/components/standalone/StandaloneShell.tsx
    - src/core/components/ErrorBoundary.tsx
    - scripts/verify-no-tailwind.sh
    - tests/isolation/cross-entrypoint-imports.test.ts
    - tests/core/strict/np-strict-ceiling.test.ts
    - src/main.tsx (deviation: one attribute removed so `tsc --noEmit` stays green)

key-decisions:
  - "AntD v6 removed the `cssVar: boolean` toggle — `ThemeConfig.cssVar` is now `{ prefix?, key? }` and CSS variables are always used. `getAntdConfig` passes the pack's `{ key: 'antd' }` through instead of the plan's v5-era `cssVar: true`; the requirement (real-time switch, no remount) is met by v6's default."
  - "`resolveThemePack(pack: string): ThemePack` normalises the persisted `np_theme_pack` string to the canonical pack union, so no call site needs a cast and `getAntdConfig` keeps the plan's `pack: ThemePack` contract."
  - "The canonical Standalone Sider is rendered directly in `StandaloneShell.tsx` (AntD `Layout`/`Sider` + token-styled items) rather than by adapting `WorkspaceSidebar.tsx`, which plan `01-12` owns. `WorkspaceSidebar` is therefore unmounted; recorded in the inventory row so `01-12` decides remount-or-remove rather than inheriting a silent duplicate."
  - "The isolation gate's matrix was corrected, not weakened: `standalone -> options` is authorised by §5.4/§8.6 (the Options workspace renders inside the Standalone shell at `standalone.html?page=options`), while `options -> any surface` stays forbidden. The pattern was simultaneously tightened so bare relative sibling hops are caught."
  - "The command palette stays mounted by each surface root with no global keyboard listener; the `KeymapRegistry` binding is plan `01-08`'s task and its plan text binds at the root, so moving the palette into the shell would have created avoidable rework."
  - "`.gitignore` uses `.output/*` + `!.output/.gitkeep` so the build directory keeps a tracked sentinel while every artifact underneath stays ignored."
  - "H-6 (CSP) applied verbatim as `script-src 'self'; object-src 'self'; connect-src 'none'` and confirmed by reading the built manifest back."

patterns-established:
  - "Relocation commits carry their gate re-pointing in the same diff: a gate that targets a moved path either fails loudly or lies about its scope"
  - "Self-test blocks in gate tests carry positive controls (target directories exist, scanner read real files) so a nonexistent path can never pass vacuously"
  - "Each surface root reads `mode`/`pack` from the theme store and derives its own config, so no component mounts `ConfigProvider`"

requirements-completed: [CORE-01]

coverage:
  - id: D1
    description: "WXT is the single authoritative runtime with `srcDir: 'src'`; every entrypoint (background, sidepanel, standalone, content) lives under `src/entrypoints/**` and the content script is at a WXT-discoverable path."
    requirement: "CORE-01"
    verification:
      - kind: integration
        ref: "pnpm run build:ext && node -e \"...readFileSync('.output/chrome-mv3/manifest.json')\" (permissions/side_panel/options-key assertions)"
        status: pass
      - kind: unit
        ref: "tests/isolation/cross-entrypoint-imports.test.ts#gate target directories exist (a missing target would pass vacuously)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both surfaces render exactly one provider chain each: `XProvider` (fed by `getAntdConfig`) > `AntdApp` > mounted `ErrorBoundary` > shell, with no separately-mounted `ConfigProvider` and no global keyboard listener."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/components/SidePanelShell.test.tsx#ErrorBoundary — pinned shell error strings"
        status: pass
      - kind: unit
        ref: "tests/components/StandaloneShell.test.tsx#ErrorBoundary — pinned shell error strings on the Standalone surface"
        status: pass
      - kind: other
        ref: "grep: exactly one `<XProvider>` and one `<ErrorBoundary>` per root; zero `ConfigProvider` elements; zero `window.addEventListener` in `src/entrypoints/**`"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Side Panel shell renders the UI-SPEC surface contract: no `Layout`, no nav rail, exactly two trailing header controls, disabled+marked composer actions and send control, read-only `Auto` workflow display, status bar with the no-provider caption."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/components/SidePanelShell.test.tsx (13 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Standalone shell renders the canonical Sider Main set with the Add-ons group and account block absent (not empty), an accessible collapsed state, and the sub-1024 px Alert that hides nothing."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/components/StandaloneShell.test.tsx (11 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Three move-sensitive gates are re-pointed and proven to have teeth: Tailwind className gate, cross-entrypoint isolation gate, NP-STRICT ceiling gate."
    requirement: "CORE-01"
    verification:
      - kind: integration
        ref: "bash scripts/verify-no-tailwind.sh (violation: exit 1 naming the probe file; clean: exit 0)"
        status: pass
      - kind: unit
        ref: "tests/isolation/cross-entrypoint-imports.test.ts (violation probe: 1-2 failed; clean: 22 passed)"
        status: pass
      - kind: unit
        ref: "tests/core/strict/np-strict-ceiling.test.ts (violation probe: exit 1 'count (1) exceeds ceiling (0)'; clean: 2 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "WXT dev-mode HMR: a component edit is applied as a hot update (`js-update`) rather than a full extension reload, using `@wxt-dev/module-react` alone."
    requirement: "CORE-01"
    verification:
      - kind: manual_procedural
        ref: "pnpm run dev:ext + ws://localhost:3000 (vite-hmr) observing {\"type\":\"update\",\"updates\":[{\"type\":\"js-update\",\"path\":\"/src/components/sidepanel/SidePanelShell.tsx\"}]}"
        status: pass
    human_judgment: true
    rationale: "A headless probe proves the HMR update is emitted and accepted by the module, but the browser-side application of that update (React Fast Refresh re-rendering inside a connected Chrome with the unpacked dev extension) cannot be observed without a browser. The operator-observed browser check remains a separate acceptance item owned by the phase acceptance plan."

# Metrics
duration: 24min
completed: 2026-09-21
status: complete
---

# Phase 1 Plan 02: MV3/WXT Runtime + AntD Shells + Workspace Summary

**WXT `srcDir: 'src'` relocation with both Phase-1 surfaces rendering one provider chain each, an authorised MV3 manifest (no options keys, `connect-src 'none'`), and three move-sensitive gates proven non-vacuous**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-21T11:49:11Z
- **Completed:** 2026-09-21T12:13:00Z
- **Tasks:** 3
- **Files modified:** 34 tracked files across 3 commits (1,740 insertions / 601 deletions), plus the D-04 inventory status reconciliation

## Accomplishments

- **The extension boots end-to-end through WXT.** `wxt.config.ts` declares `srcDir: 'src'` and `modules: ['@wxt-dev/module-react']`; every entrypoint moved to `src/entrypoints/**`; `pnpm run build:ext` emits `sidepanel.html`, `standalone.html`, `background.js` and `content-scripts/content.js` — the content script is now genuinely built, which it never was before (its old path matched no WXT content glob).
- **The generated manifest is the authorised shape.** `permissions: ["sidePanel","storage","tabs"]`, `side_panel.default_path: "sidepanel.html"`, `content_security_policy.extension_pages` equal to the Phase-1 no-network value, and **no** `options_ui`/`options_page` key. A second build produces a byte-identical manifest and no duplicated entrypoint file.
- **One provider chain per surface.** Both roots are `XProvider {...getAntdConfig({mode, pack, compact})}` → `AntdApp` → `ErrorBoundary` → shell. No separately-mounted `ConfigProvider`, no global keyboard listener, and `ErrorBoundary` is mounted for the first time (it was dead code).
- **Both shells render to the written surface contracts.** The Side Panel has no `Layout`, no rail and exactly two trailing header controls, with every later-phase control `disabled` + `data-np-backing="deferred"`; the Standalone shell renders the fixed canonical Sider set with the Add-ons group and account block absent (not empty), an accessible collapsed state, and a sub-1024 px Alert that hides nothing.
- **Three gates now have teeth.** Each was proven red against a deliberate violation and green against the clean tree. Fixing them exposed two real defects the old gates concealed: the isolation pattern matched only `components/`-style paths (so it passed on the actual `chat -> standalone` import it existed to catch), and the gate matrix forbade an import §5.4/§8.6 require.
- **WXT dev-mode HMR observed, not attested.** A component edit produced `{"type":"update","updates":[{"type":"js-update","path":"/src/components/sidepanel/SidePanelShell.tsx"}]}` over the Vite HMR socket — a hot update, not a full reload, with `@wxt-dev/module-react` alone.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — the extension boots through WXT with both surfaces rendering one provider chain each** - `5718bf7` (feat)
2. **Task 2: Shell render suites for both surfaces, and the surface-isolation extension for the new shared directory** - `cf583ac` (test)
3. **Task 3: WXT dev-mode/HMR confirmation and clean-build hygiene** - `9af8f41` (chore)

**Plan metadata:** committed separately as `docs(01-02): complete … plan`.

## Files Created/Modified

- `wxt.config.ts` — `srcDir`, `modules`, `options_ui`/`options_page` deleted, CSP narrowed to `connect-src 'none'`
- `tsconfig.json` / `vitest.config.ts` — `@/*` and `~/*` → `./src/*`; vitest alias → `path.resolve(__dirname, 'src')`
- `.gitignore` — `.wxt/` added; `.output/*` + `!.output/.gitkeep`
- `package.json` — `@wxt-dev/module-react@^1.2.2` devDependency only
- `src/entrypoints/background.ts`, `src/entrypoints/sidepanel/{index.html,main.tsx}`, `src/entrypoints/standalone/{index.html,main.tsx}`, `src/entrypoints/content/index.ts` — relocated entrypoints, import depth dropped one level
- `src/core/theme/antdConfig.ts` — `getAntdConfig`, `resolveThemePack`, `ThemePack`
- `src/components/sidepanel/{SidePanelShell,SidePanelRouter}.tsx` — new Side Panel shell + the single onboarding-vs-shell routing decision point
- `src/components/standalone/{StandaloneShell,StandaloneRouter}.tsx` — canonical Sider shell + route switching (`?page=options` included)
- `src/core/components/ErrorBoundary.tsx` — pinned `shell.errorTitle` / `shell.errorBody` / `shell.errorReload`
- `scripts/verify-no-tailwind.sh` — all four greps target `src/`; honest success message
- `tests/isolation/cross-entrypoint-imports.test.ts` — re-pointed, tightened pattern, positive controls, `sidepanel/**` surface, resolved-import allowlist, dev-shell importer scan
- `tests/core/strict/np-strict-ceiling.test.ts` — git-grep and `find` fallback scoped to `src`
- `tests/components/{SidePanelShell,StandaloneShell}.test.tsx` — new render suites (13 + 11 cases)
- `.output/.gitkeep` — tracked sentinel for the build directory

## Decisions Made

- **`cssVar` is no longer a boolean in AntD v6.** `ThemeConfig.cssVar` is `{ prefix?, key? }` and CSS variables are always used, so `cssVar: true` neither type-checks nor means anything. `getAntdConfig` passes the pack's `{ key: 'antd' }` through; the requirement (real-time switch, no remount) is met by v6's default.
- **`resolveThemePack(pack: string)`** normalises the persisted `np_theme_pack` string to the canonical pack union, keeping `getAntdConfig`'s `pack: ThemePack` contract without a cast at either call site.
- **The canonical Sider lives in `StandaloneShell.tsx`.** `WorkspaceSidebar.tsx` belongs to plan `01-12`, so the shell renders its own `Layout`/`Sider` to the contract instead of adapting a file another plan owns. `WorkspaceSidebar` is now unmounted — recorded in its inventory row so `01-12` decides remount-or-remove rather than inheriting a silent duplicate implementation.
- **The isolation matrix was corrected, not weakened.** §5.4/§8.6 make the Options workspace a route *inside* the Standalone shell, so `standalone -> options` is authorised; `options -> any surface` stays forbidden. The pattern was tightened in the same change so bare relative sibling hops (`'../standalone/Foo'`) are caught, and both directions are proved by deliberate-violation probes.
- **The palette stays at the surface root with no global keyboard listener.** `01-08`'s plan text binds `KeymapRegistry` at the root; moving the palette into the shell would have forced rework two waves later.
- **H-6 applied verbatim** and confirmed by reading the built manifest back, with the confirmation recorded in the inventory's hand-off table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The cross-entrypoint isolation gate could not see the violation it existed to catch**
- **Found during:** Task 1, Step F (prove each gate has teeth)
- **Issue:** `CROSS_IMPORT_RE` was `from\s+['"][^'"]*components/(chat|standalone|options)/`. A real cross-surface import in this repository is a bare relative hop (`'../standalone/StandaloneShell'`), which contains no `components/` segment — so the gate reported zero violations on a tree that contained the very `standalone -> chat` import (`StandaloneShell.tsx -> ../chat/SidepanelChat`) it was written to prevent. The deliberate-violation probe exited 0.
- **Fix:** the pattern is now `from\s+['"][^'"]*(components/|\.\./)(chat|standalone|options)/`, shared by the shell greps and the in-process self-test from one constant so they cannot drift. Self-test cases for both spellings were added, and the probe now exits non-zero.
- **Files modified:** `tests/isolation/cross-entrypoint-imports.test.ts`
- **Verification:** `chat -> standalone` probe: exit 1 (1 failed | 16 passed), then exit 0 (17 passed).
- **Committed in:** `5718bf7` (Task 1 commit)

**2. [Rule 3 - Blocking] The adapted `StandaloneShell` broke the typecheck of the doomed Vite dev shell**
- **Found during:** Task 1, pre-commit `npx tsc --noEmit`
- **Issue:** `src/main.tsx` (the Vite browser dev shell, REMOVEd by plan `01-11`) passed `onOpenSidepanel` to `StandaloneShell`. The canonical shell has no such prop — the Sider's Options entry uses `onOpenOptions`, and `Focus Side Panel` is a palette command — so `tsc` failed with TS2322.
- **Fix:** removed the single `onOpenSidepanel` attribute from the `src/main.tsx` render call. No behavioural change: the dev shell's surface switcher lives in its own header.
- **Files modified:** `src/main.tsx`
- **Verification:** `npx tsc --noEmit` exits 0 with no `error TS`.
- **Committed in:** `5718bf7` (Task 1 commit)

**3. [Rule 2 - Spec conflict] The gate forbade an import §5.4/§8.6 require**
- **Found during:** Task 1, after wiring the Options route
- **Issue:** the gate asserted "`standalone/` contains no imports into `chat/` or `options/`", but the UI-SPEC's Options-routing paragraph requires the Options workspace to render *inside* the Standalone shell at `standalone.html?page=options`, and this plan removes the `options.html` entrypoint. Enforcing the rule as written would have made the gate fail on a correct tree.
- **Fix:** `options/` was removed from the Standalone surface's forbidden set with the reason recorded in the test and in the inventory row; the reverse direction (`options/` importing a surface) stays forbidden, and `standalone/` still may not import `chat/`.
- **Files modified:** `tests/isolation/cross-entrypoint-imports.test.ts`, `01-MIGRATION-INVENTORY.md` (row note)
- **Verification:** 22/22 isolation cases pass; the `standalone -> options` direction is still caught by the shared pattern (asserted by a self-test case).
- **Committed in:** `5718bf7` (Task 1 commit)

**4. [Rule 3 - Blocking] `WorkspaceSidebar` became unmounted**
- **Found during:** Task 1, Step D
- **Issue:** the plan's acceptance criteria require `StandaloneShell` itself to render the canonical Main set with no Add-ons group and no account block, and the shell's declared file list excludes `WorkspaceSidebar.tsx` (which plan `01-12` owns and which renders a Teams entry and an account block).
- **Fix:** the canonical Sider is rendered inside `StandaloneShell.tsx`; `WorkspaceSidebar.tsx` is left untouched and unmounted, with its inventory row updated to record that `01-12` owns its disposition (realign-and-remount, or `remove`).
- **Files modified:** `src/components/standalone/StandaloneShell.tsx`, `01-MIGRATION-INVENTORY.md` (row note)
- **Verification:** `tests/components/StandaloneShell.test.tsx` asserts exactly five Main items + the Settings entry, no avatar, no dropdown, no Teams entry.
- **Committed in:** `5718bf7` (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 bug, 2 blocking, 1 spec conflict)
**Impact on plan:** All four were required for the plan's own gates to be meaningful or for the tree to typecheck. No scope creep: no version bump, no behavioural change to any core module, no new dependency beyond the single approved install.

## Issues Encountered

- **Headless HMR needed the Vite module graph.** A `pnpm run dev:ext` probe that has not populated the dev server's module graph sees no HMR event at all — Vite has no module to invalidate. Fetching the dev-served modules first (154 modules) made the `js-update` for `SidePanelShell.tsx` observable. Recorded in the Task 3 commit body so the next person does not repeat the dead end. The browser-side application of the update remains a manual check.
- **The build now emits `content_scripts`.** Renaming the content script to a WXT-discoverable path makes it a real entrypoint: `content_scripts: [{matches: ["<all_urls>"], world: "ISOLATED", run_at: "document_idle"}]`. The plan recorded this as the expected observation and deferred the injection-scope decision to `01-03`; it is also logged in the broken-windows ledger because the threat model (T-1-10) assumed the key stayed absent.
- **antd v6 `cssVar` type change** — see Decisions. Handled without a cast or a suppression marker; `NP_STRICT_CEILING` stays `0`.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `t()` resolves to the key text for keys plan `01-04` lands (`chat.emptyBody`, `chat.noProvider`, `chat.composerPlaceholder`, `shell.errorTitle`/`shell.errorBody`/`shell.errorReload`, `a11y.*`, `standalone.minWidth`) | `src/components/sidepanel/SidePanelShell.tsx`, `src/components/standalone/StandaloneShell.tsx`, `src/core/components/ErrorBoundary.tsx` | Intentional hand-off: `01-04` owns `src/core/i18n/strings.ts` and this plan was explicitly forbidden from editing it. Both suites resolve their expectations through `t()`, so they are correct either way; the visible copy becomes canonical when `01-04` lands (wave 3). Tracked in `.planning/WINDOWS.md` (id 2). |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: content_script_registration | `.output/chrome-mv3/manifest.json` (from `src/entrypoints/content/index.ts`) | The generated manifest now carries a `content_scripts` entry matching `<all_urls>` in the ISOLATED world. The script remains extraction-only (no UI, no `fetch(`, no host-page writes) and the isolation gate re-asserts that, but the *injection scope* is new manifest surface: the threat model's T-1-10 assumed the key stayed absent until plan `01-03` decides and asserts it (H-1, operator-gated). Logged in `.planning/WINDOWS.md` (id 1). |

## User Setup Required

None — no external service configuration required. One dependency was installed (`@wxt-dev/module-react@^1.2.2`, the phase's single approved install, Package Legitimacy Audit verdict `OK`).

## Next Phase Readiness

- `01-03` can assert the manifest shape directly: the built manifest is stable, `content_scripts` is present, and `side_panel.default_path` / `permissions` / CSP are the authorised values.
- `01-04` must land the string map; until then the shells render key text for the new keys (see Known Stubs).
- `01-05` owns `ThemeStore`/`ThemeSync` single-writer work; the roots already call `useThemeSync()` and re-derive `getAntdConfig` per render, so the fix lands behind an unchanged call shape.
- `01-08` binds the palette through `KeymapRegistry` at the surface roots; both roots currently register no global keyboard listener at all.
- `01-11` owns `package.json`'s `dev`/`build` script redirect and the dev-shell deletion; `src/main.tsx` still exists and still passes `tsc` (one attribute was removed in this plan).
- `01-12` owns `WorkspaceSidebar.tsx`'s disposition and extends `tests/components/StandaloneShell.test.tsx`; the suite's marking-count assertions are deliberately exact, so a new marker will fail the count and must be updated there.
- Browser-observed HMR application (a connected Chrome with the unpacked dev extension) remains an open manual check for the phase acceptance plan.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Files created (7 of 7): `src/core/theme/antdConfig.ts`, `src/components/sidepanel/{SidePanelShell,SidePanelRouter}.tsx`, `src/components/standalone/StandaloneRouter.tsx`, `tests/components/{SidePanelShell,StandaloneShell}.test.tsx`, `.output/.gitkeep`.
- Relocated entrypoints present (6 of 6) under `src/entrypoints/**`.
- Commits present: `5718bf7`, `cf583ac`, `9af8f41` (3 of 3, measured with `git rev-list --count 4b0a537..HEAD`).
- `.wxt/**` untracked (`git ls-files .wxt` empty) and the built manifest carries no options key.
