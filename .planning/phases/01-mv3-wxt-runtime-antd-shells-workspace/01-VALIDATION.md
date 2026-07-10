---
phase: 1
slug: mv3-wxt-runtime-antd-shells-workspace
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `pnpm tsc --noEmit` |
| **Full suite command** | `pnpm vitest run && pnpm tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm tsc --noEmit`
- **After every plan wave:** Run `pnpm vitest run && pnpm tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green — `pnpm vitest run && pnpm tsc --noEmit && pnpm wxt build`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | SETUP-01 | — | N/A | smoke | `pnpm wxt build` | ❌ W0 | ⬜ pending |
| {N}-01-02 | 01 | 1 | SETUP-03 | — | N/A | static | `pnpm tsc --noEmit` | ❌ W0 | ⬜ pending |
| {N}-01-03 | 01 | 1 | THEME-01 | — | N/A | unit | `vitest run tests/core/themeStore.test.ts` | ❌ W0 | ⬜ pending |
| {N}-01-04 | 01 | 1 | THEME-02 | — | N/A | integration | `vitest run tests/shell/theme.test.tsx` | ❌ W0 | ⬜ pending |
| {N}-01-05 | 01 | 1 | WRKSP-01 | — | N/A | unit | `vitest run tests/core/workspaceStore.test.ts` | ❌ W0 | ⬜ pending |
| {N}-01-06 | 01 | 1 | WRKSP-03 | — | N/A | integration | `vitest run tests/core/workspaceRouter.test.ts` | ❌ W0 | ⬜ pending |
| {N}-01-07 | 01 | 1 | HARD-05 | T-1-04 | RuntimeEnvelope validates cross-context messages | unit | `vitest run tests/core/runtimeEnvelope.test.ts` | ❌ W0 | ⬜ pending |
| {N}-01-08 | 01 | 1 | HARD-06 | T-1-05 | ErrorBoundary catches render errors and shows Result | unit | `vitest run tests/core/ErrorBoundary.test.tsx` | ❌ W0 | ⬜ pending |
| {N}-01-09 | 01 | 1 | HARD-08 | T-1-03 | Synchronous SW listener registration at module load | unit | `vitest run tests/core/background.test.ts` | ❌ W0 | ⬜ pending |
| {N}-01-10 | 01 | 1 | HARD-10 | T-1-01 | No innerHTML/dangerouslySetInnerHTML in codebase | static | `grep -r 'innerHTML\|dangerouslySetInnerHTML' src/` | ❌ W0 | ⬜ pending |
| {N}-01-11 | 01 | 1 | ADDON-10 | T-1-08 | Core never imports from addons/ | static | `grep -r "from.*addons/" src/core/` | ❌ W0 | ⬜ pending |
| {N}-01-12 | 01 | 1 | ONBD-01 | — | N/A | integration | `vitest run tests/shell/onboarding.test.tsx` | ❌ W0 | ⬜ pending |
| {N}-01-13 | 01 | 1 | CMD-01 | — | N/A | integration | `vitest run tests/shell/commandPalette.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration with jsdom environment
- [ ] `tests/setup.ts` — Vitest setup with chrome API mocks
- [ ] `tsconfig.json` — TypeScript strict mode configuration
- [ ] ESLint config — linting setup
- [ ] Prettier config — formatting setup
- [ ] `tests/core/themeStore.test.ts` — covers THEME-01
- [ ] `tests/core/workspaceStore.test.ts` — covers WRKSP-01
- [ ] `tests/core/workspaceRouter.test.ts` — covers WRKSP-03
- [ ] `tests/core/runtimeEnvelope.test.ts` — covers HARD-05
- [ ] `tests/core/ErrorBoundary.test.tsx` — covers HARD-06
- [ ] `tests/core/background.test.ts` — covers HARD-08
- [ ] `tests/shell/theme.test.tsx` — covers THEME-02
- [ ] `tests/shell/onboarding.test.tsx` — covers ONBD-01
- [ ] `tests/shell/commandPalette.test.tsx` — covers CMD-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Side panel opens in Chrome sidebar | SETUP-01 | Chrome extension UI surface — cannot simulate in jsdom | Load unpacked extension in chrome://extensions, click extension icon, verify side panel renders |
| Full App tab opens from Side Panel | SHELL-05 | chrome.tabs API — requires real Chrome | Click "Open Full App" in Side Panel, verify new tab opens with AppLayout |
| Cmd+K opens command palette in both surfaces | CMD-01 | Keyboard shortcut in Chrome — requires real browser | Press Cmd+K/Ctrl+Shift+K in Side Panel and Full App, verify command palette appears |
| Theme toggle affects both surfaces immediately | THEME-02 | Cross-surface visual verification — requires real browser | Toggle theme in Side Panel, verify Full App updates; toggle in Full App, verify Side Panel updates |
| Cross-surface workspace handoff | WRKSP-03 | Multi-surface state sync — requires real Chrome | Select conversation in Side Panel, open Full App, verify conversation and workspace state match |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
