---
last_mapped_commit: fa9f6508dff633ac15be7548c3cde08535e4bab5
last_mapped_at: 2026-09-20
---
# Technology Stack

**Analysis Date:** 2026-09-20

## Languages

**Primary:**

- TypeScript 5.8.3 (declared `~5.8.2` in `package.json`) - all source under `src/`, `entrypoints/`, `tests/`, and root configs. `tsconfig.json` sets `strict: true`, `target: ESNext`, `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit: true`.
- TSX (React 19 JSX) - all UI components (`src/components/**`, `entrypoints/**/main.tsx`)

**Secondary:**

- CSS (`src/index.css`) - hand-written CSS with CSS custom properties (`--np-primary`, `--np-primary-light`, `.dark` class). No CSS framework; Tailwind/shadcn/radix/framer-motion are explicitly banned and enforced by `scripts/verify-no-tailwind.sh`.
- HTML - five entry documents: `index.html`, `entrypoints/sidepanel/index.html`, `entrypoints/standalone/index.html`, `entrypoints/options/index.html`
- Bash - `scripts/verify-no-tailwind.sh` (Tailwind leakage gate)

## Runtime

**Environment:**

- Chrome/Chromium Manifest V3 extension - service worker (`entrypoints/background.ts`), Side Panel (`sidepanel.html`), Options (`options.html`), standalone tab (`standalone.html`), content script (`entrypoints/content/core.content.ts`)
- Node.js v24.21.0 (local dev machine) - no `engines` field, no `.nvmrc`/`.node-version` pin
- Browser globals used: `BroadcastChannel`, `crypto.randomUUID`, `MutationObserver`, `AbortController`, `matchMedia`, `localStorage`

**Package Manager:**

- pnpm 11.22.0 (pinned via `packageManager` in `package.json`)
- Lockfile: present (`pnpm-lock.yaml`, ~234 KB)
- `pnpm-workspace.yaml` exists only for `allowBuilds: esbuild, spawn-sync` (not a multi-package workspace)

## Frameworks

**Core:**

- React 19.2.8 + react-dom 19.2.8 - all UI surfaces (`src/main.tsx`, `entrypoints/*/main.tsx`)
- WXT 0.20.27 - MV3 extension build/framework, manifest generation (`wxt.config.ts`), entrypoint `defineBackground` / `defineContentScript` helpers
- Vite 8.2.2 - dev server on port 3000 + web-app build (`vite.config.ts`), plus WXT's internal Vite pipeline
- Ant Design (antd) 6.5.2 - primary design system; used in 45 source files (`Layout`, `Segmented`, `Modal`, `Drawer`, `Form`, `App.useApp()` etc.)
- @ant-design/x 2.9.0 - presentation components; `XProvider` in `src/components/ThemeProvider.tsx`, `Bubble` in `src/components/chat/ChatMessageItem.tsx`
- @ant-design/x-markdown 2.9.0 - `XMarkdown` in `src/core/components/PortableMarkdown.tsx` (used by `src/components/chat/ChatMessageItem.tsx`)
- Zustand 5.0.14 + `zustand/middleware/immer` (immer 11.1.18) - state stores: `src/store/useExtensionStore.ts`, `src/core/theme/ThemeStore.ts`, `src/core/workspace/WorkspaceStore.ts`

**Testing:**

- Vitest 3.2.7 - config `vitest.config.ts` (`environment: 'jsdom'`, `globals: true`)
- jsdom 25.0.1 - DOM environment
- @testing-library/react 16.3.2 - component tests (`tests/components/*.test.tsx`)
- Global mocks in `tests/setup.ts`: `chrome.storage.local`/`sync`, `localStorage`, `BroadcastChannel`, `ResizeObserver`, `matchMedia`

**Build/Dev:**

- TypeScript compiler as the only linter: `pnpm run lint` === `tsc --noEmit` (no ESLint/Prettier/Biome config files present, despite `eslint-disable` comments in source)
- `@vitejs/plugin-react` 6.1.0 - Vite React plugin
- `@types/chrome` 0.2.2, `@types/node` 22.14.0, `@types/react` 19.x, `@types/react-dom` 19.x - type packages

## Key Dependencies

**Critical:**

- `antd` 6.5.2 + `@ant-design/x` 2.9.0 + `@ant-design/x-markdown` 2.9.0 - the entire UI layer. `src/components/ThemeProvider.tsx` currently nests `ConfigProvider` + `XProvider` with the same theme object (see CONCERNS for spec rule that each surface should mount exactly one provider).
- `zustand` 5.0.14 - all persisted app state; persistence funnel is `src/core/theme/chromeStorageAdapter.ts` (`chromeStorageAdapter` → `chrome.storage.local`, `syncStorageAdapter` → `chrome.storage.sync`), 300 ms trailing debounce.
- `zod` 4.4.3 - declared in `package.json` but **not imported anywhere in `src/` or `entrypoints/`** (only a string literal in `tests/isolation/cross-entrypoint-imports.test.ts`).
- `@ant-design/icons` 6.3.2 (33 files) and `lucide-react` 1.33.0 (`src/components/options/PromptIcon.tsx`) - icon sets.
- `motion` 12.42.2 - declared in `package.json` but **not imported anywhere in `src/`/`entrypoints/`**; motion effects are CSS classes in `src/index.css` (`.np-fade-in`, etc.).

**Infrastructure:**

- `@types/chrome` 0.2.2 - chrome API typings used by background, content, runtime, and theme sync code.
- WXT manifest config `wxt.config.ts` inlines permissions, host permissions, side panel, options page, icons, and CSP.

## Configuration

**Environment:**

- No `.env`/`.env.*` files present; no env-var driven config detected.
- Runtime config lives in `chrome.storage`: `np_store` (provider config, API keys, sessions, prompts, notes), `np_store`-adjacent `np_workspace_store`, `np_theme` + `np_theme_pack` (sync), `onboardingComplete` flag.
- `src/vite-env.d.ts` references `vite/client` and declares png/jpg/svg modules. `import.meta.env.DEV` gates the demo-mode simulator in `src/services/aiProvider.ts`.
- CSP in `wxt.config.ts` limits `connect-src` to `http://localhost:*`, `https://generativelanguage.googleapis.com`, `https://api.anthropic.com`, `https://api.openai.com`.

**Build:**

- `vite.config.ts` - multi-entry (`main`, `options`, `sidepanel`, `standalone`), alias `@` → `./src`, `manualChunks` vendor split (vendor-react, vendor-antd, vendor-antx, vendor-markdown, vendor-rc, vendor-icons, vendor-motion, vendor-state, vendor-common).
- `wxt.config.ts` - `webExt.disabled: true`, dev server port 3000; Vite chunk warning limit 1500.
- `tsconfig.json` - path aliases `@/*` and `~/*` both map to `./*` (repo root), includes `src`, `entrypoints`, `tests`, root configs, `.wxt/wxt.d.ts`.
- `vitest.config.ts` - alias `@` → repo root (`.`), which differs from the Vite alias (`@` → `./src`); tests use relative imports (`../../../src/...`).
- Build outputs: `.output/chrome-mv3/` (WXT), with `dist` symlinked to `.output/chrome-mv3`; `.wxt/` holds generated types.

**Scripts (`package.json`):**

- `dev` / `start` / `preview` - Vite web shell on `0.0.0.0:3000`
- `build` - `tsc --noEmit && vite build`
- `build:ext` / `dev:ext` - WXT extension build / dev
- `lint` - `tsc --noEmit`
- `test` - `vitest run`; `test:watch`; `test:perf` (`tests/perf`); `test:isolation` (`tests/isolation`)
- `verify:phase-1` … `verify:phase-9`, `verify:all` - composite typecheck + targeted Vitest suites + `scripts/verify-no-tailwind.sh`; several target suite directories (e.g. `tests/core/memory`, `tests/core/search`) that are not present in the current tree.

## Platform Requirements

**Development:**

- Node.js 20+ is implied by Vite 8 / WXT 0.20; verified working with Node 24.21.0.
- pnpm (package manager pinned to 11.22.0).
- Chrome/Chromium to load `.output/chrome-mv3` unpacked (WXT web-ext runner is disabled).
- `dist` symlink points at `.output/chrome-mv3` for tooling that expects `dist/`.

**Production:**

- Chrome Web Store-ready MV3 bundle produced by `pnpm run build:ext`; manifest generated from `wxt.config.ts` with permissions `['sidePanel', 'storage', 'tabs']` and host permissions limited to `*://*.service-now.com/*` and `*://support.servicenow.com/*`.
- No server component, no database, no CI/CD configuration in the repository.

---

*Stack analysis: 2026-09-20*
