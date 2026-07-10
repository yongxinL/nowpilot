---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 01b
type: execute
wave: 1
depends_on: []
files_modified:
  - wxt.config.ts
  - tsconfig.json
  - vitest.config.ts
  - eslint.config.mjs
  - .prettierrc
  - tests/setup.ts
autonomous: true
requirements:
  - SETUP-01
  - SETUP-03
  - SETUP-04
  - ADDON-10

must_haves:
  truths:
    - "wxt.config.ts declares sidepanel, app (unlisted page), popup, and background entry points with MV3 manifest permissions"
    - "`pnpm wxt build` produces a loadable extension with zero build errors and auto-generated manifest.json"
    - "`pnpm tsc --noEmit` passes with zero type errors in strict mode"
    - "ESLint flat config enforces ADDON-10 boundary (no-restricted-imports blocks core→addons imports)"
    - "Vitest boots cleanly with jsdom environment and chrome API mocks from tests/setup.ts"
  artifacts:
    - path: "wxt.config.ts"
      provides: "WXT configuration — entry points, manifest permissions (sidePanel, storage, tabs, commands), CSP"
      exports: ["default"]
    - path: "tsconfig.json"
      provides: "TypeScript strict mode + React JSX + path aliases"
    - path: "vitest.config.ts"
      provides: "Vitest with jsdom environment and tests/setup.ts"
    - path: "tests/setup.ts"
      provides: "Chrome API mocks for all chrome.* calls used in Phase 1"
    - path: "eslint.config.mjs"
      provides: "ESLint flat config — TypeScript rules, no-restricted-imports for addons/ boundary"
    - path: ".prettierrc"
      provides: "Prettier config — 2 space indent, single quotes, trailing commas"
  key_links:
    - from: "vitest.config.ts"
      to: "tests/setup.ts"
      via: "setupFiles in vitest config — provides chrome API mocks to all test files"
      pattern: "setupFiles.*setup\\.ts"
    - from: "wxt.config.ts"
      to: "src/entrypoints/"
      via: "WXT discovers entry points by convention (background.ts, sidepanel.html, app.html, popup.html)"
      pattern: "srcDir"
    - from: "eslint.config.mjs"
      to: "src/core/"
      via: "no-restricted-imports rule blocks `from '.*addons/.*'` inside src/core/"
      pattern: "no-restricted-imports"
  prohibitions: []
---

<objective>
Create WXT MV3 manifest configuration with all entry points declared and build tooling (TypeScript strict mode, ESLint, Prettier, Vitest with chrome mocks). Enforce ADDON-10 boundary via ESLint rule. Establish the directory structure that subsequent plans populate.

Purpose: Without wxt.config.ts, the extension has no manifest. Without tooling configs, there's no type checking, linting, or testing infrastructure.
Output: 6 config files. `pnpm wxt build` succeeds. `pnpm tsc --noEmit` passes. Vitest boots cleanly.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-RESEARCH.md
@.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-PATTERNS.md
@.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-VALIDATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create wxt.config.ts with MV3 manifest, entry points, permissions, and commands</name>
  <files>wxt.config.ts</files>
  <read_first>01-RESEARCH.md lines 149-203 (Recommended Project Structure — src/ layout with entrypoints/, core/, addons/), 01-RESEARCH.md lines 696-720 (Open Questions — manifest registration and command shortcut conflict), 01-RESEARCH.md lines 717-720 (cmd+K conflict resolution — use Cmd+Shift+K in manifest, Cmd+K in React)</read_first>
  <action>
    Create wxt.config.ts exporting `defineConfig` from `'wxt'`:
    - `srcDir: 'src'`, `outDir: 'dist'`
    - `manifest` object:
      - `name: 'NowPilot'`, `version: '0.1.0'`, `manifest_version: 3`, `description: 'Privacy-first AI assistant'`
      - `permissions: ['sidePanel', 'storage', 'tabs', 'commands']` — Phase 1 MV3 permissions
      - `host_permissions: []` — no host permissions in Phase 1 (content scripts in Phase 8)
      - `side_panel: { default_path: 'sidepanel.html' }` — toolbar icon opens side panel
      - `commands` object with key `'open-command-palette'` using `suggested_key: { default: 'Ctrl+Shift+K', mac: 'Cmd+Shift+K' }` — Cmd+K is reserved by Chrome; manifest uses Shift variant as global fallback, React handler provides in-app Cmd+K override when surface is focused (RESEARCH.md lines 717-720)
      - `web_accessible_resources` containing `{ resources: ['app.html'], matches: ['<all_urls>'] }` — Full App tab needs this
    - No CSP override — WXT sets sensible defaults

    Also create the directory structure (empty dirs so subsequent plans have target paths):
    ```
    src/entrypoints/
    src/core/stores/
    src/core/messaging/
    src/core/routing/
    src/core/commands/
    src/core/onboarding/
    src/core/registries/
    src/core/components/
    src/core/utils/
    src/core/pages/
    src/addons/               ← ADDON-10 boundary (core NEVER imports from here)
    src/components/            ← WXT auto-imports from here
    src/hooks/                 ← WXT auto-imports from here
    src/utils/                 ← WXT auto-imports from here
    src/assets/
    public/
    tests/core/
    tests/shell/
    tests/isolation/
    ```

    After creating wxt.config.ts, verify WXT can produce a manifest: `pnpm wxt build` should generate `dist/manifest.json` (may have warnings about missing entry points — those are created in Plan 01-01c).
  </action>
  <acceptance_criteria>
    - `wxt.config.ts` contains `defineConfig` with `manifest.permissions` including `'sidePanel'`, `'storage'`, `'tabs'`, `'commands'`
    - `wxt.config.ts` contains `manifest.commands['open-command-palette']` with `suggested_key` for both default and mac
    - `wxt.config.ts` contains `manifest.side_panel.default_path: 'sidepanel.html'`
    - `wxt.config.ts` contains `web_accessible_resources` with `app.html`
    - All directory paths from RESEARCH.md project structure exist (mkdir -p)

    <!-- planner-discipline-allow: innerHTML, dangerouslySetInnerHTML -->
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'sidePanel' wxt.config.ts && grep -c 'commands' wxt.config.ts && grep -c 'web_accessible_resources' wxt.config.ts</automated>
  </verify>
  <done>WXT configuration file created with MV3 manifest, permissions, commands, and web_accessible_resources. Directory structure established. ADDON-10 boundary created.</done>
</task>

<task type="auto">
  <name>Task 2: Configure TypeScript strict mode, ESLint flat config, Prettier, Vitest with chrome mocks</name>
  <files>tsconfig.json, vitest.config.ts, eslint.config.mjs, .prettierrc, tests/setup.ts</files>
  <read_first>01-RESEARCH.md lines 738-766 (Validation Architecture — test map and Wave 0 gaps), 01-PATTERNS.md lines 760-762 (eslint/prettier references), 01-VALIDATION.md lines 61-74 (Wave 0 requirements list)</read_first>
  <action>
    Create configuration files for the entire toolchain:

    1. **tsconfig.json**: Strict mode TypeScript with `"strict": true`, `"jsx": "react-jsx"`, `"moduleResolution": "bundler"`, `"target": "ESNext"`, `"module": "ESNext"`, `"skipLibCheck": true`, path aliases `"@/*"` → `"./src/*"`, includes `["src"]`. No `"allowJs"`.

    2. **vitest.config.ts**: Configure with `defineConfig` from vitest. Set `environment: "jsdom"`, `setupFiles: ["./tests/setup.ts"]`, include `["tests/**/*.test.ts", "tests/**/*.test.tsx"]`. Configure `@` path alias matching tsconfig.

    3. **eslint.config.mjs**: Use ESLint flat config format. Extend typescript-eslint recommended. Add a no-restricted-imports rule that blocks any `import ... from ".../addons/..."` pattern within `src/core/**` files (ADDON-10 enforcement). Add rule disallowing `any` type (warn level).

    4. **.prettierrc**: `{ "semi": true, "singleQuote": true, "trailingComma": "all", "tabWidth": 2, "printWidth": 100 }`.

    5. **tests/setup.ts**: Create chrome API global mocks. Mock `chrome.storage.sync.get/set/remove` (return Promises resolving to empty/undefined), `chrome.storage.session.get/set/remove` (same pattern), `chrome.storage.onChanged.addListener` (no-op, store listeners for test trigger), `chrome.runtime.getURL` (passthrough), `chrome.runtime.onInstalled.addListener` (no-op), `chrome.runtime.onMessage.addListener` (no-op), `chrome.commands.onCommand.addListener` (no-op), `chrome.tabs.query/create/update` (return empty arrays or stub tab objects), `chrome.windows.update` (no-op). Use `vi.stubGlobal('chrome', {...})` in a beforeAll block.

    After creating configs, run `pnpm tsc --noEmit` — should produce zero errors (project has no source files yet). Run `pnpm vitest run` — should find no tests but exit cleanly.
  </action>
  <acceptance_criteria>
    - `tsconfig.json` contains `"strict": true` and `"jsx": "react-jsx"`
    - `vitest.config.ts` contains `environment: "jsdom"` and `setupFiles` pointing to `tests/setup.ts`
    - `eslint.config.mjs` contains a rule blocking imports from `addons/` in `src/core/` files
    - `.prettierrc` contains `"singleQuote": true` and `"trailingComma": "all"`
    - `tests/setup.ts` mocks `chrome.storage.sync`, `chrome.storage.session`, `chrome.storage.onChanged`, `chrome.runtime`, `chrome.tabs`, `chrome.commands`
    - `pnpm tsc --noEmit` exits with code 0
    - `pnpm vitest run` exits cleanly (0 test files is OK — config must be valid)
  </acceptance_criteria>
  <verify>
    <automated>pnpm tsc --noEmit && pnpm vitest run --reporter=verbose 2>&1 | grep -c 'No test files found'</automated>
  </verify>
  <done>All tooling configs created and validated. TypeScript strict mode passes. ESLint configured with ADDON-10 boundary enforcement. Vitest with jsdom + chrome mocks boots successfully.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| WXT build pipeline → dist/ | Build tool generates manifest.json from config — misconfigured permissions could grant unintended capabilities |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|------------------|
| T-01b-PERM | Elevation of Privilege | wxt.config.ts | medium | mitigate | Permissions scoped to Phase 1 minimum: `sidePanel`, `storage`, `tabs`, `commands`. No `host_permissions`. `web_accessible_resources` limited to `app.html` only. Review manifest.json output after build to confirm no unexpected permissions. |
| T-01b-ADDON | Elevation of Privilege | eslint.config.mjs | medium | mitigate | ADDON-10: ESLint `no-restricted-imports` rule blocks any import from `addons/` within `src/core/**`. Static enforcement at lint time — no runtime bypass possible. |

**Threat disposition summary:** 2 threats — 2 mitigated, 0 accepted, 0 transferred.
</threat_model>

<verification>
<automated>
# Verify configs and build
pnpm tsc --noEmit
pnpm vitest run
# eslint flat config syntax check
node -e "import('./eslint.config.mjs').then(() => console.log('OK')).catch(e => console.error(e))"
</automated>
</verification>

<success_criteria>
- [ ] `wxt.config.ts` declares all entry points with correct MV3 permissions
- [ ] `pnpm tsc --noEmit` exits 0 (strict mode, zero type errors)
- [ ] `pnpm vitest run` boots cleanly (config valid)
- [ ] ESLint flat config has ADDON-10 boundary rule
- [ ] All Wave 0 test infrastructure files exist and are valid
</success_criteria>

<output>
Create `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-01b-SUMMARY.md` when done
</output>

## Artifacts this plan produces

| Symbol | Kind | File | Purpose |
|--------|------|------|---------|
| `defineConfig` export | config | `wxt.config.ts` | WXT project configuration with MV3 manifest |
| `tsconfig.json` config | config | `tsconfig.json` | TypeScript strict mode with React JSX + bundler resolution |
| `vitest.config.ts` config | config | `vitest.config.ts` | Vitest config with jsdom env + setupFiles |
| `chromeMock` globals | mock | `tests/setup.ts` | Chrome API stubs (storage, runtime, tabs, commands, windows) for Vitest |
| `eslint.config.mjs` config | config | `eslint.config.mjs` | ESLint flat config with ADDON-10 boundary rule |
| `.prettierrc` config | config | `.prettierrc` | Prettier formatting config |

No runtime symbols — configuration-only plan.
