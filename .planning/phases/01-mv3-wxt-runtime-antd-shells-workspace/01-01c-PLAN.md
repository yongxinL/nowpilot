---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 01c
type: execute
wave: 1
depends_on: []
files_modified:
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
autonomous: true
requirements:
  - SETUP-01

must_haves:
  truths:
    - "`pnpm wxt build` discovers all entry points (background.ts, sidepanel.html, app.html, popup.html) and bundles them without errors"
    - "Side Panel entry renders 'NowPilot Side Panel' text via ReactDOM.createRoot"
    - "Full App entry renders 'NowPilot Full App' text via ReactDOM.createRoot"
    - "Placeholder icons exist in public/ — build does not fail on missing assets"
    - "src/addons/.gitkeep confirms ADDON-10 directory boundary exists"
  artifacts:
    - path: "src/entrypoints/background.ts"
      provides: "Minimal background SW stub — defineBackground(() => {})"
      exports: ["default"]
    - path: "src/entrypoints/sidepanel.html"
      provides: "Side Panel HTML entry point (discovered by WXT)"
    - path: "src/entrypoints/sidepanel/main.tsx"
      provides: "Side Panel React mount point"
    - path: "src/entrypoints/app.html"
      provides: "Full App HTML entry point (unlisted page, discovered by WXT)"
    - path: "src/entrypoints/app/main.tsx"
      provides: "Full App React mount point"
    - path: "src/entrypoints/popup.html"
      provides: "Popup HTML entry point"
    - path: "src/entrypoints/popup/main.tsx"
      provides: "Popup React mount point"
    - path: "public/icon-16.png"
      provides: "16×16 extension icon placeholder"
    - path: "public/icon-48.png"
      provides: "48×48 extension icon placeholder"
    - path: "public/icon-128.png"
      provides: "128×128 extension icon placeholder"
  key_links:
    - from: "sidepanel.html"
      to: "sidepanel/main.tsx"
      via: "Script tag `<script type='module' src='./main.tsx'></script>` — WXT resolves the module"
    - from: "app.html"
      to: "app/main.tsx"
      via: "Script tag same pattern"
    - from: "popup.html"
      to: "popup/main.tsx"
      via: "Script tag same pattern"
    - from: "background.ts"
      to: "wxt/sandbox"
      via: "WXT auto-imports defineBackground — no explicit import needed"
  prohibitions: []
---

<objective>
Create all WXT entry point stubs so the extension has discoverable surfaces. These are minimal scaffolds — background SW with no listeners, HTML pages with div#app mount points, and React main.tsx files rendering placeholder text. Create placeholder icons and the addons/ boundary placeholder.

Purpose: WXT needs actual files at the entry point paths for `pnpm wxt build` to produce a valid extension bundle. These stubs make the project buildable; subsequent plans replace them with real implementations.
Output: 7 entry point files + 3 placeholder icons + 1 boundary placeholder. `pnpm wxt build` succeeds and produces a loadable extension.
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
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create WXT entry point stubs — background SW, HTML pages, and React mount points</name>
  <files>src/entrypoints/background.ts, src/entrypoints/sidepanel.html, src/entrypoints/sidepanel/main.tsx, src/entrypoints/app.html, src/entrypoints/app/main.tsx, src/entrypoints/popup.html, src/entrypoints/popup/main.tsx</files>
  <read_first>01-RESEARCH.md lines 149-203 (Recommended Project Structure — entrypoints/ layout), 01-PATTERNS.md lines 576-613 (Shared Pattern 1 — React mount point, Shared Pattern 2 — HTML entry point template)</read_first>
  <action>
    Create minimal entry point stubs so WXT discovers the extension surfaces:

    **background.ts** — Minimal service worker:
    - Use `defineBackground` from `wxt/sandbox` (WXT auto-imports — do NOT write an import statement)
    - `export default defineBackground(() => {});` — empty body, no listeners (Plan 01-02 adds synchronous listeners per HARD-08)
    - CRITICAL: The `main()` callback is NOT async (empty body, not even a return)

    **sidepanel.html** / **app.html** / **popup.html** — HTML entry points:
    - All three follow PATTERNS.md Shared Pattern 2:
      ```text
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>TITLE</title></head><body><div id="app"></div><script type="module" src="./main.tsx"></script></body></html>
      ```
    - sidepanel.html — title: "NowPilot - Side Panel", script: `./sidepanel/main.tsx`
    - app.html — title: "NowPilot", script: `./app/main.tsx` (unlisted page per RESEARCH.md line 708)
    - popup.html — title: "NowPilot", script: `./popup/main.tsx`

    **sidepanel/main.tsx** / **app/main.tsx** / **popup/main.tsx** — React mount points:
    - Each follows PATTERNS.md Shared Pattern 1:
      ```typescript
      import React from 'react';
      import ReactDOM from 'react-dom/client';

      ReactDOM.createRoot(document.getElementById('app')!).render(
        <React.StrictMode>
          <div>SURFACE_TEXT</div>
        </React.StrictMode>
      );
      ```
    - sidepanel/main.tsx — SURFACE_TEXT: `<h1>NowPilot Side Panel</h1>`
    - app/main.tsx — SURFACE_TEXT: `<h1>NowPilot Full App</h1>`
    - popup/main.tsx — SURFACE_TEXT: `<p>NowPilot</p><button onClick={() => chrome.sidePanel.open()}>Open Side Panel</button>`

    No App.tsx imports yet — Plan 01-04 adds the full shell with XProvider wrapping.

    After creating all files, run `pnpm wxt build` — must succeed with a valid manifest.json. WXT auto-discovers these entry points by their file paths and generates the appropriate manifest entries.
  </action>
  <acceptance_criteria>
    - `src/entrypoints/background.ts` exports `defineBackground(() => {})` with non-async callback
    - `src/entrypoints/sidepanel.html` exists with `<div id="app">` and script pointing to `./sidepanel/main.tsx`
    - `src/entrypoints/app.html` exists with `<div id="app">` and script pointing to `./app/main.tsx`
    - `src/entrypoints/popup.html` exists with `<div id="app">` and script pointing to `./popup/main.tsx`
    - All three main.tsx files use `ReactDOM.createRoot` with `React.StrictMode`
    - `pnpm wxt build` succeeds with exit code 0
    - `ls dist/manifest.json` exists (WXT-generated)
    - `grep -c 'sidepanel' dist/manifest.json` returns >= 1
    - `grep -c 'background' dist/manifest.json` returns >= 1
  </acceptance_criteria>
  <verify>
    <automated>pnpm wxt build && ls dist/manifest.json && grep -c 'sidepanel' dist/manifest.json && grep -c 'background' dist/manifest.json</automated>
  </verify>
  <done>All WXT entry points created and discovered. Extension builds successfully with auto-generated manifest.json. Side Panel, Full App, Popup, and Background SW entry points registered.</done>
</task>

<task type="auto">
  <name>Task 2: Create placeholder icons and addons boundary placeholder</name>
  <files>public/icon-16.png, public/icon-48.png, public/icon-128.png, src/addons/.gitkeep</files>
  <read_first>01-RESEARCH.md lines 149-203 (public/ directory for static assets, src/addons/ for ADDON-10 boundary), 01-PATTERNS.md lines 760-763 (public assets reference, .gitkeep placeholder)</read_first>
  <action>
    Create minimal assets and the ADDON-10 boundary placeholder:

    1. **Placeholder icons**: Create 16×16, 48×48, and 128×128 PNG files in `public/`. Use a solid-color rectangle with contrasting border — a simple colored square is sufficient. The icons must exist so `pnpm wxt build` does not fail on missing assets. WXT copies `public/` contents as-is to the extension bundle. Use a blue (#1677FF) square with white "NP" text (or similar simple placeholder — real branding comes later).

    2. **Addons boundary placeholder**: Create `src/addons/.gitkeep` — an empty file that ensures the directory exists in the repo even though it's empty in Phase 1. This directory is the ADDON-10 boundary: `src/core/` must never import from `src/addons/` (enforced by ESLint rule in Plan 01-01b).

    After creating files, verify `pnpm wxt build` still succeeds (icons exist, no missing asset errors).
  </action>
  <acceptance_criteria>
    - `ls public/icon-16.png public/icon-48.png public/icon-128.png` — all three exist
    - `ls src/addons/.gitkeep` — boundary placeholder exists
    - `pnpm wxt build` succeeds with icons bundled in dist/
    - `grep -rl "from.*addons/" src/core/` returns nothing (ADDON-10 pre-check — core dir is empty, but verify the check works)
  </acceptance_criteria>
  <verify>
    <automated>pnpm wxt build && ls public/icon-16.png public/icon-48.png public/icon-128.png && ls src/addons/.gitkeep</automated>
  </verify>
  <done>Placeholder icons created for all three sizes. WXT build bundles them correctly. ADDON-10 boundary established via src/addons/.gitkeep. Extension is loadable with all entry points discovered.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| WXT entry point files → dist/ bundle | Entry point stubs are bundled by WXT — incorrect script paths would cause runtime load failures |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|------------------|
| T-01c-ENTRY | Denial of Service | entrypoint stubs | low | accept | Entry point stubs are minimal — background.ts has no listeners (Plan 01-02 adds them), main.tsx renders only text. Build-time failure risk if path is wrong is caught by `pnpm wxt build` gate. Runtime load failure would just show empty surface — not a security issue at stub stage. |

**Threat disposition summary:** 1 threat — 1 accepted (low severity, transient), 0 mitigated, 0 transferred.
</threat_model>

<verification>
<automated>
# Full build verification — all entry points must be discovered
pnpm wxt build
ls dist/manifest.json
grep -c 'sidepanel' dist/manifest.json
grep -c 'background' dist/manifest.json
</automated>
</verification>

<success_criteria>
- [ ] `pnpm wxt build` succeeds and produces dist/manifest.json
- [ ] Manifest contains sidepanel and background entries
- [ ] All 7 entry point files exist and are discoverable by WXT
- [ ] Icons and addons boundary placeholder exist
- [ ] Extension is loadable in Chrome (manifest structure valid)
</success_criteria>

<output>
Create `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-01c-SUMMARY.md` when done
</output>

## Artifacts this plan produces

| Symbol | Kind | File | Purpose |
|--------|------|------|---------|
| `default export` (defineBackground) | function | `background.ts` | Minimal background SW stub (empty body) |
| Side Panel mount point | mount | `sidepanel/main.tsx` | ReactDOM.createRoot rendering placeholder text |
| Full App mount point | mount | `app/main.tsx` | ReactDOM.createRoot rendering placeholder text |
| Popup mount point | mount | `popup/main.tsx` | ReactDOM.createRoot with "Open Side Panel" button |
| Placeholder icons | asset | `public/icon-*.png` | 16/48/128 px extension icons (colored squares) |
| Addons boundary | placeholder | `src/addons/.gitkeep` | Empty dir ensuring ADDON-10 boundary exists |

No runtime symbols beyond mount points — all stubs are replaced by subsequent plans.
