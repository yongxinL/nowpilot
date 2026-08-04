---
phase: 1
slug: mv3-wxt-runtime-antd-shells-workspace
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.10 (jsdom env) + WxtVitest plugin |
| **Config file** | `vitest.config.ts` (WxtVitest) + `tests/setup.ts` (matchMedia polyfill, fakeBrowser reset) |
| **Quick run command** | `pnpm vitest run tests/core/runtime tests/core/events` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~30s quick / ~2min full |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/core/runtime tests/core/events` (fast, 30s)
- **After every plan wave:** Run `pnpm vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-XX | 01 | 1 | RUNTIME-01 | T-1-01 | RuntimeEnvelope shape enforced at every boundary | unit | `pnpm vitest run tests/core/runtime/RuntimeEnvelope.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | RUNTIME-02 | T-1-02 | workerState.ok/fail envelope replies | unit | `pnpm vitest run tests/core/runtime/workerState.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | RUNTIME-03 | T-1-03 | BroadcastBus cross-surface sync via fakeBrowser runtime events | unit | `pnpm vitest run tests/core/events/EventBus.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | RUNTIME-04 | T-1-04 | MessageBus routes typed messages, returns ResponseEnvelope | unit | `pnpm vitest run tests/core/runtime/MessageBus.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | RUNTIME-05 | T-1-05 | Content bridge PING→PONG; MessageType whitelist (D-17) | unit | `pnpm vitest run tests/core/content/ContentScriptHost.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | WSPC-01 | T-1-06 | WorkspaceStore hydrate from chrome.storage.local + URL params (M.1) | unit | `pnpm vitest run tests/core/workspace/WorkspaceStore.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | WSPC-02 | T-1-07 | WorkspaceRouter.openStandalone sets openedStandaloneTabId (M.2) | unit | `pnpm vitest run tests/core/workspace/WorkspaceRouter.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | WSPC-03 | T-1-08 | WorkspaceSync heartbeat + version LWW (WORKSPACE_UPDATED) | unit | `pnpm vitest run tests/core/workspace/WorkspaceSync.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | WSPC-04 | T-1-09 | Registries register at startup; page registry drives Shell nav | unit | `pnpm vitest run tests/core/registry -x` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | WSPC-05 | T-1-10 | ThemeStore resolveDark + pack switch + storage onChanged sync (D-13) | unit | `pnpm vitest run tests/core/theme/ThemeStore.test.ts -x` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | UI-SPEC | T-1-11 | Shells/Onboarding/page skeletons render with XProvider; no innerHTML | component | `pnpm vitest run tests/components -x` | ❌ W0 | ⬜ pending |
| 1-01-XX | 01 | 1 | §24 isolation | T-1-12 | No UI/antd in content script bundle (built `.output`) | build+grep | `pnpm wxt build && node tests/isolation/check-content-bundle.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — WxtVitest plugin (no test files yet)
- [ ] `tests/setup.ts` — matchMedia polyfill + `fakeBrowser.reset()` per test
- [ ] `tests/core/runtime/RuntimeEnvelope.test.ts` — RUNTIME-01 (zod fixture per §0.3)
- [ ] `tests/core/events/EventBus.test.ts` — RUNTIME-03
- [ ] `tests/core/workspace/WorkspaceStore.test.ts` — WSPC-01
- [ ] `tests/core/theme/ThemeStore.test.ts` — WSPC-05 (spec §24 requires this exact path)
- [ ] `tests/isolation/check-content-bundle.mjs` — §24 content-bundle isolation (grep for antd/React in built content script)
- [ ] Dev deps install: `pnpm add -D vitest @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom` — none installed yet

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `chrome.sidePanel.open` user-gesture handoff | WSPC-02 | Requires real browser user gesture (crbug 1478648 — `await` before open drops gesture) | Install built extension in Chrome ≥116; open side panel; click "Open Standalone" — must open/focus tab, not duplicate |
| Light/dark auto-detection on system appearance | WSPC-05 | Requires OS appearance change | Toggle OS light/dark; both surfaces must update immediately |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
