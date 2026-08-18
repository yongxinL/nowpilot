# Technology Stack

**Analysis Date:** 2026-08-18

## Languages

**Primary:**
- TypeScript ~5.8.2 (installed 5.8.3) - All application code: `src/`, `entrypoints/`, `tests/`

**Secondary:**
- HTML - Entry page shells: `index.html`, `entrypoints/sidepanel/index.html`, `entrypoints/options/index.html`, `entrypoints/standalone/index.html`
- CSS - Tailwind v4 utility classes + custom CSS: `src/index.css`
- JSX/TSX - React components throughout `src/components/`
- JSON - Package manifests, config, seed data

## Runtime

**Environment:**
- Node.js (dev, v24.19.0 detected) - Build tooling, tests, dev server
- Chrome/Chromium - Manifest V3 extension runtime (production target)

**Package Manager:**
- pnpm (v11.22.0 detected) - Primary (with `pnpm-workspace.yaml` and `pnpm-lock.yaml`)
- npm (v12.0.2 detected) - `package-lock.json` also present; npm scripts work with both
- Lockfile: present (`pnpm-lock.yaml`, plus `package-lock.json`)

## Frameworks

**Core:**
- WXT 0.20.27 - Browser extension framework (MV3 build, entrypoints, auto-imports). Config: `wxt.config.ts`
- React 19.2.8 + React DOM 19.2.8 - UI. `tsconfig.json` uses `jsx: react-jsx`
- Ant Design (antd) 6.6.1 - Component library (Layout, Modal, Select, Tabs, etc.)
- @ant-design/x 2.9.0 - Ant Design AI component kit (chat/markdown surfaces)
- Tailwind CSS 4.3.3 - Utility CSS via `@tailwindcss/vite` plugin
- Zustand 5.0.15 - State management with `persist` + `immer` middleware
- Immer 10.2.0 - Immutable state updates inside zustand stores

**Testing:**
- Vitest 3.2.7 - Test runner. Config: `vitest.config.ts`
- jsdom 25.0.0 - DOM environment for component/store tests
- @testing-library/react 16.0.0 - React component testing

**Build/Dev:**
- Vite 8.2.1 - Bundler/dev server (both WXT-internal and standalone `vite.config.ts`)
- WXT CLI - `wxt` (dev) and `wxt build` (extension build)
- TypeScript 5.8.3 - Type checking (`tsc --noEmit` is the `lint` script)
- @vitejs/plugin-react 6.0.5 - React Fast Refresh in Vite

## Key Dependencies

**Critical:**
- `react` / `react-dom` ^19.0.1 - UI runtime
- `wxt` ^0.20.27 - Extension build/type generation (`.wxt/wxt.d.ts`); provides `defineBackground`, `defineContentScript` utilities
- `antd` ^6.5.2 - Primary UI component library
- `zustand` ^5.0.0 - Client state + Chrome-storage persistence
- `zod` ^3.24.0 - Runtime validation (used by runtime message envelopes)

**Infrastructure:**
- `@ant-design/icons` ^6.3.2 - Icon set
- `@ant-design/x` ^2.8.0 - AI chat/markdown components
- `@ant-design/x-markdown` ^2.8.0 - Markdown rendering (vendored with katex/prism in `vite.config.ts`)
- `motion` ^12.23.24 - Animations (onboarding wizard, panels)
- `lucide-react` ^1.31.0 - Secondary icon set
- `immer` ^10.1.1 - Immutable updates
- Dev: `@types/chrome` ^0.2.2, `@types/node` ^22.14.0, `@types/react` ^19, `@types/react-dom` ^19

## Configuration

**Environment:**
- No `.env` files present; no `import.meta.env` / `process.env` usage detected
- All runtime config (AI provider API keys, endpoints, theme, language) is user-configurable state persisted to `chrome.storage.local` via the zustand `persist` middleware (`name: 'np_store'`) in `src/store/useExtensionStore.ts`
- Local AI endpoint default: `http://localhost:12380/v1` (OpenAI-compatible proxy), `http://localhost:11434` (Ollama)

**Build:**
- `wxt.config.ts` - Extension manifest, permissions, host_permissions, CSP, side panel/options UI, dev server (port 3000). `webExt.disabled: true`
- `vite.config.ts` - Standalone webapp build (manual chunks: vendor-react, vendor-icons, vendor-markdown, vendor-antx, vendor-rc, vendor-antd, vendor-motion, vendor-state)
- `tsconfig.json` - Path aliases `@/*` → `./*` and `~/*` → `./*`; `types: ["chrome", "node", "vite/client"]`; `strict: false`; includes `.wxt/wxt.d.ts`
- `vitest.config.ts` - jsdom environment, globals, setup file `tests/setup.ts`, alias `@`
- `pnpm-workspace.yaml` - `allowBuilds: esbuild, spawn-sync`
- `metadata.json` - Google AI Studio metadata (capability `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`)
- `index.html` - Standalone Vite webapp shell (`src/main.tsx`) titled "My Google AI Studio App"

## Platform Requirements

**Development:**
- Node.js (v24.19.0 in use); pnpm or npm
- Chrome for extension runtime; `vite --port 3000` webapp for browser dev
- Verify scripts: `verify:phase-1` … `verify:phase-9`, `verify:all` in `package.json` (tsc + scoped vitest runs)

**Production:**
- Chrome Web Store (MV3 extension; `dist/` symlinks to `.output/chrome-mv3`)
- No backend server, no hosting configuration, no CI config (no `.github/`)

---

*Stack analysis: 2026-08-18*
