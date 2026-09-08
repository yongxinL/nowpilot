# Phase 1 — Acceptance

## Automated Verification (T20)

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `vitest run` (18 files, 53 tests) | all pass |
| `scripts/verify-no-tailwind.sh` | pass |
| `scripts/verify-no-framer-motion.sh` | pass |
| `scripts/verify-no-dangerous-html.sh` | pass |
| `pnpm run build:ext` (WXT 0.21.4) | pass |
| `pnpm run verify:phase-1` (full gate) | **exit 0** |

Verified SHA: `db4e1319a073cc296bb1e727366fec0e6c026105`

## Manual Acceptance Checks

These require loading the extension in Chrome 120+ via `pnpm run dev:ext`. They are pending operator execution.

| # | Check | Result |
|---|---|---|
| 1 | Load extension in Chrome 120+ via `pnpm run dev:ext` | Pending |
| 2 | Click extension icon → Side Panel opens | Pending |
| 3 | Onboarding shell appears on fresh install (static intro placeholder, no persona logic, API key not persisted) | Pending |
| 4 | Theme propagation: `ThemeStore.setMode('dark')` → both surfaces re-render dark (verified via `chrome.storage.onChanged`) | Pending |
| 5 | Open Standalone view from Side Panel → workspace state transfers | Pending |
| 6 | Close and reopen Standalone → no tab duplication | Pending |
| 7 | Cmd+K opens shared command palette on both surfaces | Pending |
| 8 | Side Panel usable at 400px width | Pending |
| 9 | Standalone shows narrow-screen alert below minimum width | Pending |
| 10 | Content script bundle contains no banned imports (verified by isolation test) | **Pass** (automated) |
| 11 | Onboarding API key is cleared on close and never persisted | **Pass** (automated) |
| 12 | Major Side Panel regions match the applicable `binding-layout` references | Pending |
| 13 | Side Panel responsive behaviour takes precedence over fixed mock-up dimensions | Pending |
| 14 | Standalone shell follows the referenced navigation, header and workspace-region hierarchy | Pending |
| 15 | Placeholder content is used where functionality belongs to a later phase | Pending |
| 16 | No model selection, provider configuration, attachments, persisted history, Notes functionality, TeamGQM behaviour, AI streaming or message actions are implemented merely because they appear in a mock-up | Pending |
| 17 | All required screenshots listed in T21 exist under `.planning/evidence/phase-01/` and are referenced from `ACCEPTANCE.md` | Pending |

## Visual Evidence

Required screenshots (to be captured during manual acceptance):

| File | Status |
|---|---|
| `sidepanel-400px.png` | Pending |
| `sidepanel-empty-state.png` | Pending |
| `standalone-default.png` | Pending |
| `standalone-narrow-alert.png` | Pending |
| `command-palette-sidepanel.png` | Pending |
| `command-palette-standalone.png` | Pending |
| `onboarding-shell.png` | Pending |
| `sidepanel-under-380px.png` | Conditional (only if below-380px rendering differs from 400px) |

## Tested Viewport Widths

Pending manual acceptance.

## Requirement Coverage Matrix

| Requirement | Test / Evidence | Status |
|---|---|---|
| REQ-P01 (MV3/WXT extension) | `verify:phase-1` build gate | Pass |
| REQ-P02 (Chat-only Side Panel) | `tests/components/sidepanel/SidePanelShell.test.tsx` | Pass |
| REQ-P03 (Standalone workspace) | `tests/components/standalone/StandaloneShell.test.tsx` | Pass |
| REQ-P04 (Cross-surface continuity) | `tests/core/workspace/WorkspaceStore.test.ts`, `tests/core/workspace/WorkspaceRouter.test.ts` | Pass |
| REQ-P06 (AntD v6 + AntD X) | `tests/core/theme/ThemeStore.test.ts`, render tests | Pass |
| REQ-P07 (Content scripts extraction-only) | `tests/isolation/no-content-script-ui.test.ts` | Pass |
| REQ-Q01 (Canonical paths/identifiers) | `tsc --noEmit` | Pass |
| REQ-Q03 (Fixture tests per boundary) | `verify:phase-1` test gates | Pass |
| REQ-Q06 (Git/PLAN/RESULT/STATUS) | Manual evidence | Pending |
| REQ-UX01 (Side Panel 400px responsive) | Manual acceptance | Pending |
| REQ-UX02 (Standalone narrow alert) | Manual acceptance | Pending |
| REQ-UX03 (One XProvider per surface) | Render tests | Pass |
| REQ-UX04 (Light/dark/auto + theme packs) | `tests/core/theme/ThemeStore.test.ts` | Pass |

## Reviewer

Pending operator sign-off.

## Result

**Automated verification: PASS**
**Manual acceptance: PENDING** (requires Chrome browser)

Evidence-only commit: `8a3283a982e28361773d44df5d2cefce1de78647`
