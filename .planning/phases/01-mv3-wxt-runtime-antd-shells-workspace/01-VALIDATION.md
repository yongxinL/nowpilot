---
phase: 1
slug: mv3-wxt-runtime-antd-shells-workspace
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-10
updated: 2026-07-11
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
| {N}-01-01 | 01 | 1 | SETUP-01 | — | N/A | smoke | `pnpm wxt build` | ❌ W0 | ✅ green |
| {N}-01-02 | 01 | 1 | SETUP-03 | — | N/A | static | `pnpm tsc --noEmit` | ❌ W0 | ✅ green |
| {N}-01-03 | 01 | 1 | THEME-01 | — | N/A | unit | `vitest run tests/core/themeStore.test.ts` | ❌ W0 | ✅ green |
| {N}-01-03b | — | 1 | THEME-02, §5.5 | — | antdConfig.ts exports getAntdConfig + getXProviderConfig | unit | `vitest run tests/core/antdConfig.test.ts` | ❌ W0 | ✅ green |
| {N}-01-04 | 01 | 1 | THEME-02 | — | N/A | integration | `vitest run tests/shell/theme.test.tsx` | ❌ W0 | ✅ green |
| {N}-01-04b | — | — | THEME-04 | — | Cross-surface theme propagation via shared store | integration | `vitest run tests/shell/themePropagation.test.tsx` | — | ✅ green |
| {N}-01-05 | 01 | 1 | WRKSP-01 | — | N/A | unit | `vitest run tests/core/workspaceStore.test.ts` | ❌ W0 | ✅ green |
| {N}-01-06 | 01 | 1 | WRKSP-03 | — | N/A | integration | `vitest run tests/core/workspaceRouter.test.ts` | ❌ W0 | ✅ green |
| {N}-01-07 | 01 | 1 | HARD-05 | T-1-04 | RuntimeEnvelope validates cross-context messages | unit | `vitest run tests/core/runtimeEnvelope.test.ts` | ❌ W0 | ✅ green |
| {N}-01-08 | 01 | 1 | HARD-06 | T-1-05 | ErrorBoundary catches render errors and shows Result | unit | `vitest run tests/core/ErrorBoundary.test.tsx` | ❌ W0 | ✅ green |
| {N}-01-09 | 01 | 1 | HARD-08 | T-1-03 | Synchronous SW listener registration at module load | unit | `vitest run tests/core/background.test.ts` | ❌ W0 | ✅ green |
| {N}-01-10 | 01 | 1 | HARD-10 | T-1-01 | No innerHTML/dangerouslySetInnerHTML in codebase | static | `vitest run tests/core/no-inner-html.test.ts` | ❌ W0 | ✅ green |
| {N}-01-11 | 01 | 1 | ADDON-10 | T-1-08 | Core never imports from addons/ | static | `vitest run tests/core/no-addon-imports.test.ts` | ❌ W0 | ✅ green |
| {N}-01-11b | — | — | §0.2, SETUP-06 | — | @ant-design/x-sdk and @ant-design/x-card absent from package.json | static | `vitest run tests/core/no-prohibited-packages.test.ts` | ❌ W0 | ✅ green |
| {N}-01-11c | — | — | THEME-06 | T-1-07 | No static message/notification/Modal API usage | static | `vitest run tests/core/no-static-antd-apis.test.ts` | — | ✅ green |
| {N}-01-12 | 01 | 1 | ONBD-01 | — | N/A | integration | `vitest run tests/shell/onboarding.test.tsx` | ❌ W0 | ✅ green |
| {N}-01-12b | — | — | ONBD-03 | — | Full App surface also triggers OnboardingModal | integration | `vitest run tests/shell/onboardingFullApp.test.tsx` | — | ✅ green |
| {N}-01-13 | 01 | 1 | CMD-01 | — | N/A | integration | `vitest run tests/shell/commandPalette.test.tsx` | ❌ W0 | ✅ green |
| {N}-01-14 | — | — | SHELL-05 | — | Open Full App button → chrome.tabs.create with FULL_APP_URL | integration | `vitest run tests/shell/openFullApp.test.tsx` | — | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `vitest.config.ts` — Vitest configuration with jsdom environment
- [x] `tests/setup.ts` — Vitest setup with chrome API mocks
- [x] `tsconfig.json` — TypeScript strict mode configuration
- [x] ESLint config — linting setup
- [x] Prettier config — formatting setup
- [x] `tests/core/themeStore.test.ts` — covers THEME-01
- [x] `tests/core/antdConfig.test.ts` — covers THEME-02 + THEME-05 (getAntdConfig + getXProviderConfig)
- [x] `tests/core/workspaceStore.test.ts` — covers WRKSP-01
- [x] `tests/core/workspaceRouter.test.ts` — covers WRKSP-03
- [x] `tests/core/runtimeEnvelope.test.ts` — covers HARD-05
- [x] `tests/core/ErrorBoundary.test.tsx` — covers HARD-06
- [x] `tests/core/background.test.ts` — covers HARD-08
- [x] `tests/core/no-static-antd-apis.test.ts` — covers THEME-06 (static guard)
- [x] `tests/core/no-inner-html.test.ts` — covers HARD-10 (static guard)
- [x] `tests/core/no-addon-imports.test.ts` — covers ADDON-10 (static guard)
- [x] `tests/core/no-prohibited-packages.test.ts` — covers SETUP-05/06 (package.json guard)
- [x] `tests/shell/theme.test.tsx` — covers THEME-02
- [x] `tests/shell/themePropagation.test.tsx` — covers THEME-04 (cross-surface theme)
- [x] `tests/shell/openFullApp.test.tsx` — covers SHELL-05 (Open Full App button)
- [x] `tests/shell/onboarding.test.tsx` — covers ONBD-01
- [x] `tests/shell/onboardingFullApp.test.tsx` — covers ONBD-03 (Full App onboarding)
- [x] `tests/shell/commandPalette.test.tsx` — covers CMD-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Side panel opens in Chrome sidebar | SETUP-01 | Chrome extension UI surface — cannot simulate in jsdom | Load unpacked extension in chrome://extensions, click extension icon, verify side panel renders |
| Full App tab opens from Side Panel | SHELL-05 | chrome.tabs API — requires real Chrome | Click "Open Full App" in Side Panel, verify new tab opens with AppLayout |
| Cmd+K opens command palette in both surfaces | CMD-01 | Keyboard shortcut in Chrome — requires real browser | Press Cmd+K/Ctrl+Shift+K in Side Panel and Full App, verify command palette appears |
| Theme toggle affects both surfaces immediately | THEME-02 | Cross-surface visual verification — requires real browser | Toggle theme in Side Panel, verify Full App updates; toggle in Full App, verify Side Panel updates |
| Cross-surface workspace handoff | WRKSP-03 | Multi-surface state sync — requires real Chrome | Select conversation in Side Panel, open Full App, verify conversation and workspace state match |
| antdConfig.ts exports getAntdConfig consumed by ConfigProvider | THEME-02, §5.5 | Config structure — unit test confirms | `pnpm vitest run tests/core/antdConfig.test.ts` |
| No AntD version-mismatch console warnings | §5.5 | Visual — requires real browser | Load side panel, Full App, popup; check console for "version mismatch" or "context" warnings |
| @ant-design/x-sdk and @ant-design/x-card absent from package.json | §0.2 | Static | `grep '@ant-design/x-sdk\|@ant-design/x-card' package.json` → zero |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ approved by gsd-nyquist-auditor (Phase 1)
**Audit date:** 2026-07-11
**Audit result:** 8/8 gaps filled; 21 test files / 85 tests passing; `pnpm tsc --noEmit` clean
