---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 01c
subsystem: scaffolding
tags: [entry-points, icons, boundary]
key-files:
  - src/entrypoints/background.ts
  - src/entrypoints/sidepanel.html
  - src/entrypoints/sidepanel/main.tsx
  - src/entrypoints/app.html
  - src/entrypoints/app/main.tsx
  - src/entrypoints/popup.html
  - src/entrypoints/popup/main.tsx
  - public/icon-16.png
  - public/icon-48.png
  - public/icon-128.png
  - src/addons/.gitkeep
metrics:
  entry_points: 4
  html_pages: 3
  placeholder_icons: 3
  build_size: "194.08 kB"
---

# Summary: Plan 01-01c — Entry Point Stubs, Icons & Addons Boundary

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | `7b1cd60` | Background SW stub, HTML pages, React mount points |
| 2    | `7b1cd60` | Placeholder icons (#1677FF) and ADDON-10 boundary |

## Deviations

- **HTML script paths**: Changed from `./main.tsx` to `./{surface}/main.tsx` to match WXT's entry point discovery convention (HTML at `entrypoints/{surface}.html`, JS at `entrypoints/{surface}/main.tsx`).
- **manifest_version warning**: WXT ignores `manifest.manifest_version` config; it's auto-detected from CLI flags (`--mv3` default).

## Self-Check: PASSED

- [x] `pnpm wxt build` succeeds — all entry points discovered
- [x] `dist/chrome-mv3/manifest.json` contains `sidepanel`, `background`, `popup` entries
- [x] background.ts uses `defineBackground` with non-async callback (no listeners)
- [x] All 3 HTML pages have `<div id="app">` and correct script references
- [x] All 3 main.tsx files use `ReactDOM.createRoot` with `React.StrictMode`
- [x] Icons exist at all 3 sizes (16, 48, 128) and are bundled
- [x] `src/addons/.gitkeep` establishes ADDON-10 boundary
