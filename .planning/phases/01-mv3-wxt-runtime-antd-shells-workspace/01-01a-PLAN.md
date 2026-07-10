---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 01a
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
autonomous: true
requirements:
  - SETUP-02
  - SETUP-05
  - SETUP-06

must_haves:
  truths:
    - "package.json contains antd@^6.5.0, @ant-design/x@^2.8.0, zustand@^5.0.0, wxt@^0.20.0, react@^19.2.0 as dependencies"
    - "package.json does NOT contain tailwindcss, shadcn/ui, @radix-ui/react, framer-motion, @ant-design/x-sdk, or @ant-design/x-card"
    - "All RESEARCH.md-verified package versions are satisfied at the specified caret ranges"
  artifacts:
    - path: "package.json"
      provides: "Project manifest with verified dependency versions from RESEARCH.md"
      contains: "wxt@^0.20"
      exports: []
    - path: "pnpm-lock.yaml"
      provides: "Locked dependency tree (pnpm-generated)"
      exports: []
  key_links:
    - from: "package.json"
      to: "pnpm-lock.yaml"
      via: "pnpm install generates lock file from package.json dependency declarations"
      pattern: "pnpm install"
  prohibitions:
    - statement: "tailwindcss, shadcn/ui, @radix-ui/react, framer-motion, @ant-design/x-sdk, @ant-design/x-card in package.json"
      status: resolved
      verification: "pnpm ls --depth=0 | grep -c 'tailwindcss\\|shadcn\\|@radix-ui\\|framer-motion\\|@ant-design/x-sdk\\|@ant-design/x-card'; test $? -eq 1"
    - statement: "@ant-design/v5-patch-for-react-19 in package.json"
      status: resolved
      verification: "pnpm ls --depth=0 | grep -c 'v5-patch-for-react-19'; test $? -eq 1"
---

<objective>
Initialize the NowPilot project with the exact dependency stack verified in RESEARCH.md. Install production dependencies (WXT, React 19, Ant Design v6, Ant Design X, Zustand, Motion) and dev dependencies (TypeScript 7, Vitest, type definitions). Enforce SETUP-05 (no tailwind/shadcn) and SETUP-06 (no @ant-design/x-sdk or @ant-design/x-card).

Purpose: Every other plan depends on these packages being available. The package.json serves as the single source of truth for dependency versions.
Output: package.json with verified dependency ranges, pnpm-lock.yaml, and all node_modules present.
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
  <name>Task 1: Initialize project and install RESEARCH.md verified dependencies</name>
  <files>package.json, pnpm-lock.yaml</files>
  <read_first>01-RESEARCH.md lines 34-69 (Standard Stack — exact versions and purpose for every package), 01-RESEARCH.md lines 73-93 (Package Legitimacy Audit — all SUS flags are false positives per researcher analysis)</read_first>
  <action>
    Initialize the project in the workspace root (already a git repo):
    1. Create package.json with `"name": "nowpilot"`, `"private": true`, `"type": "module"`.
    2. Install production dependencies with pnpm at the EXACT semver ranges from RESEARCH.md Standard Stack section — `wxt@^0.20.0`, `react@^19.2.0`, `react-dom@^19.2.0`, `antd@^6.5.0`, `@ant-design/x@^2.8.0`, `@ant-design/x-markdown@^2.8.0`, `@ant-design/icons@^6.0.0`, `zustand@^5.0.0`, `motion@^12.0.0`.
    3. Install dev dependencies — `typescript@^7.0.0`, `vitest@^4.1.0`, `@types/react`, `@types/chrome`.
    4. VERIFY immediately after install: `pnpm ls` must show exact versions that satisfy the RESEARCH.md ranges (use `pnpm ls --depth=0`).
    5. Enforce SETUP-05 and SETUP-06: confirm `pnpm ls | grep -E 'tailwindcss|shadcn|@radix-ui|framer-motion|@ant-design/x-sdk|@ant-design/x-card'` returns nothing. If any of these appear, they must be removed before proceeding.
    6. Add npm scripts to package.json: `"dev": "wxt"`, `"build": "wxt build"`, `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"lint": "eslint ."`, `"format": "prettier --write ."`.
    Do NOT install `@ant-design/v5-patch-for-react-19` — antd@6 natively supports React 19 (RESEARCH.md line 691).
  </action>
  <acceptance_criteria>
    - `pnpm ls --depth=0 | grep -E 'wxt.*0\.20\.'` matches (WXT v0.20.x installed)
    - `pnpm ls --depth=0 | grep -E 'antd.*6\.5\.'` matches (AntD v6.5.x installed)
    - `pnpm ls --depth=0 | grep -E '@ant-design/x.*2\.8\.'` matches (Ant Design X v2.8.x installed)
    - `pnpm ls --depth=0 | grep -E 'zustand.*5\.0\.'` matches (Zustand v5.0.x installed)
    - `pnpm ls --depth=0 | grep -E 'react.*19\.2\.'` matches (React v19.2.x installed)
    - `pnpm ls --depth=0 | grep -c 'tailwindcss\|shadcn\|@radix-ui\|framer-motion\|@ant-design/x-sdk\|@ant-design/x-card'` outputs 0
    - `pnpm ls --depth=0 | grep -c 'v5-patch-for-react-19'` outputs 0
    - `node -e "const p = require('./package.json'); console.log(p.scripts.dev && p.scripts.build && p.scripts.test && p.scripts.typecheck ? 'OK' : 'MISSING')"` prints OK
  </acceptance_criteria>
  <verify>
    <automated>pnpm ls --depth=0 | grep -E 'wxt.*0\.20\.' && pnpm ls --depth=0 | grep -E 'antd.*6\.5\.' && pnpm ls --depth=0 | grep -E '@ant-design/x.*2\.8\.'</automated>
  </verify>
  <done>All RESEARCH.md-verified dependencies installed at correct versions; prohibited packages (tailwindcss, shadcn, @radix-ui, framer-motion, @ant-design/x-sdk, @ant-design/x-card) are absent from node_modules and package.json; npm scripts defined.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry → local node_modules | Untrusted third-party code enters the project through package installs |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-01a-SC | Tampering | npm install (all 12 packages) | high | mitigate | All packages audited via RESEARCH.md Package Legitimacy Audit (2026-07-10). Every package verified against npm registry with age, weekly downloads, and source repo. 7 `[SUS]` flags analyzed and confirmed as false positives ("too-new" heuristic on mature packages). No `[SLOP]` packages found. Package versions pinned with caret ranges in package.json. |

**Threat disposition summary:** 1 threat — 1 mitigated, 0 accepted, 0 transferred.
</threat_model>

<verification>
<automated>
# Verify all deps installed and prohibited packages absent
pnpm ls --depth=0 | grep -c 'tailwindcss\|shadcn\|@radix-ui\|framer-motion\|@ant-design/x-sdk\|@ant-design/x-card'; test $? -eq 1
pnpm ls --depth=0 | grep -c 'v5-patch-for-react-19'; test $? -eq 1
pnpm ls --depth=0 | grep -E 'wxt.*0\.20\.'
pnpm ls --depth=0 | grep -E 'antd.*6\.5\.'
</automated>
</verification>

<success_criteria>
- [ ] All RESEARCH.md-verified deps installed at correct semver ranges
- [ ] Prohibited packages (tailwindcss, shadcn, @radix-ui, framer-motion, @ant-design/x-sdk, @ant-design/x-card) absent from node_modules
- [ ] @ant-design/v5-patch-for-react-19 NOT installed
- [ ] npm scripts defined: dev, build, test, typecheck, lint, format
</success_criteria>

<output>
Create `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-01a-SUMMARY.md` when done
</output>

## Artifacts this plan produces

| Symbol | Kind | File | Purpose |
|--------|------|------|---------|
| `package.json` | config | `package.json` | Project manifest with 9 production deps + 4 dev deps + npm scripts |
| `pnpm-lock.yaml` | config | `pnpm-lock.yaml` | Locked dependency tree (pnpm-generated) |

No runtime symbols — configuration-only plan.
