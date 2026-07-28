# Technology Stack

**Last updated:** 2026-07-28

## Languages

- **TypeScript** ~5.8 — Primary language for all source code (`.ts`/`.tsx`)
- **CSS** — Styling via Tailwind CSS v4 and custom CSS in `src/index.css`
- **HTML** — Entry point pages for extension views

## Runtime

- **Node.js** — Server runtime (via `tsx` for dev, plain Node for production)
- **Bun** — Lockfile present (`bun.lock`), package manager compatible
- **Package Manager:** pnpm (`pnpm-lock.yaml` present) and npm (`package-lock.json` present)
- **Scripts:**
  - `dev` — `tsx server.ts` (runs Express + Vite dev server)
  - `build` — `vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`
  - `start` — `node dist/server.cjs`
  - `lint` — `tsc --noEmit` (type checking only, no dedicated linter)

## Frameworks & Libraries

### Frontend

| Framework/Library | Version | Purpose |
|---|---|---|
| **React** | ^19.0.1 | UI component library |
| **React DOM** | ^19.0.1 | DOM rendering for React |
| **Ant Design (antd)** | ^6.5.2 | UI component system — buttons, modals, inputs, selects, switches, theme |
| **Ant Design X** | ^2.8.0 | AI/chat UI components (message list, sender, thought chain) |
| **Ant Design Icons** | ^6.3.2 | Icon library for UI |
| **Tailwind CSS** | ^4.1.14 | Utility-first CSS framework via `@tailwindcss/vite` plugin |
| **Framer Motion (motion)** | ^12.23.24 | Animation library |
| **Lucide React** | ^0.546.0 | Alternative icon set |

### Backend / Server

| Framework/Library | Version | Purpose |
|---|---|---|
| **Express** | ^4.21.2 | HTTP server framework |
| **Vite** | ^6.2.3 | Dev server with HMR, build tool for frontend assets |
| **esbuild** | ^0.25.0 | Backend bundler for production Node server |
| **tsx** | ^4.21.0 | TypeScript execution for Node.js in development |
| **dotenv** | ^17.2.3 | Environment variable loading |
| **Google Gen AI SDK** | ^2.4.0 | Google Gemini API client (`@google/genai`) |

### Chrome Extension

| Library | Version | Purpose |
|---|---|---|
| **WXT** | ^0.20.27 | Chrome Extension framework — manifest generation, entrypoints, build |
| **@types/chrome** | ^0.2.2 | TypeScript types for Chrome Extension APIs |

### Styling & UI Configuration

| Library | Version | Purpose |
|---|---|---|
| **PostCSS** | ^8.5.16 | CSS processing (transitive dependency via Tailwind) |
| **Autoprefixer** | ^10.4.21 | CSS vendor prefixing (dev dependency) |

## Build & Configuration

### TypeScript Configuration (`tsconfig.json`)

- **Target:** ES2022
- **Module:** ESNext with `bundler` module resolution
- **JSX:** `react-jsx`
- **Paths alias:** `@/*` maps to `./*`
- **Lib:** ES2022, DOM, DOM.Iterable
- **Strictness:** `skipLibCheck: true`, `isolatedModules: true`, `moduleDetection: force`
- **Decorators:** `experimentalDecorators: true`, `useDefineForClassFields: false`

### Vite Configuration (`vite.config.ts`)

- **Plugins:** `@vitejs/plugin-react` and `@tailwindcss/vite`
- **Path alias:** `@` → project root
- **HMR:** Configurable via `DISABLE_HMR` env var (disabled in AI Studio to prevent flickering)
- **File watching:** Disabled via `DISABLE_HMR=true` to save CPU during agent edits

### WXT Configuration (`wxt.config.ts`)

- **Manifest name:** "NowPilot - RICH Chrome Extension AI Assistant"
- **Version:** 1.0.0
- **Permissions:** `storage`, `activeTab`, `scripting`, `sidePanel`, `contextMenus`
- **Entry points:**
  - `background.ts` — Service worker
  - `content.ts` — Content script (matches `<all_urls>`)
  - `sidepanel/` — Chrome Side Panel UI
  - `standalone/` — Standalone workspace (full page)
  - `options/` — Options/settings page

### Build Output

- Frontend: `dist/assets/` (Vite build)
- Backend: `dist/server.cjs` + `dist/server.cjs.map` (esbuild bundle)
- **Production server** serves static frontend from `dist/` and handles API routes

## Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@ant-design/icons` | ^6.3.2 | Ant Design icon set |
| `@ant-design/x` | ^2.8.0 | Ant Design X — AI chat UI components |
| `@google/genai` | ^2.4.0 | Google Gemini API client SDK |
| `@tailwindcss/vite` | ^4.1.14 | Tailwind CSS Vite plugin |
| `@vitejs/plugin-react` | ^5.0.4 | React Fast Refresh for Vite |
| `antd` | ^6.5.2 | Ant Design v6 UI library |
| `dotenv` | ^17.2.3 | Loads `.env` into `process.env` |
| `express` | ^4.21.2 | HTTP server framework |
| `lucide-react` | ^0.546.0 | SVG icon component library |
| `motion` | ^12.23.24 | Animation library (Framer Motion v12) |
| `react` | ^19.0.1 | UI library |
| `react-dom` | ^19.0.1 | React DOM renderer |
| `vite` | ^6.2.3 | Build tool and dev server |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@types/chrome` | ^0.2.2 | Chrome API type definitions |
| `@types/express` | ^4.17.21 | Express type definitions |
| `@types/node` | ^22.14.0 | Node.js type definitions |
| `autoprefixer` | ^10.4.21 | CSS vendor prefixing |
| `esbuild` | ^0.25.0 | Backend bundler for Node.js |
| `tailwindcss` | ^4.1.14 | CSS utility framework |
| `tsx` | ^4.21.0 | TypeScript execution for Node |
| `typescript` | ~5.8.2 | TypeScript compiler |
| `wxt` | ^0.20.27 | Chrome Extension build framework |

## Configuration

### Environment Variables

No `.env` files present in the repository (gitignored). The application uses:

| Variable | Used In | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `server.ts` | Google Gemini API key |
| `NODE_ENV` | `server.ts` | Controls dev vs production mode |
| `DISABLE_HMR` | `vite.config.ts` | Disables Vite HMR and file watching |

### Runtime Configuration

- Config is persisted in `localStorage` under keys: `nowpilot_config`, `nowpilot_sessions`, `nowpilot_prompts`
- Default provider configuration includes 4 providers: OpenAI, Gemini, Ollama, Claude
- Each provider has configurable: API key, proxy URL, model list, enabled state

### Platform Requirements

**Development:**
- Node.js 18+ (requires ES2022 features)
- npm, pnpm, or bun package manager
- Chrome browser for extension testing

**Production:**
- Node.js 18+
- Environment variables set for AI provider API keys
- Chrome browser (for extension deployment)

---

*Stack analysis: 2026-07-28*
