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

> W-13 revision: plan column corrected to actual plan IDs (01-01…01-09), waves recomputed via max(deps)+1 (final: w1=01, w2=02, w3=03+04, w4=05+06, w5=07+08, w6=09), MessageBus test path aligned to `tests/core/messaging/MessageBus.test.ts`, workerState row moved to its owning plan (01-09). All vitest commands drop the unsupported bail flag that vitest@4.1.10 rejects (BLOCKER 1).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-02-01 | 02 | 2 | RUNTIME-01 | T-1-01 | RuntimeEnvelope shape enforced at every boundary | unit | `pnpm vitest run tests/core/runtime/RuntimeEnvelope.test.ts` | ❌ w2 | ⬜ pending |
| 1-03-01 | 03 | 3 | RUNTIME-03 | T-1-03 | EventBus subscribe/emit/off + typed events | unit | `pnpm vitest run tests/core/events/EventBus.test.ts` | ❌ w3 | ⬜ pending |
| 1-03-02 | 03 | 3 | RUNTIME-04 | T-1-04 | MessageBus routes typed messages, returns ResponseEnvelope | unit | `pnpm vitest run tests/core/messaging/MessageBus.test.ts` | ❌ w3 | ⬜ pending |
| 1-04-01 | 04 | 3 | RUNTIME-01 | T-1-01 | debugLog canonical codes, never throws (Golden Rule 9) | unit | `pnpm vitest run tests/core/error/debugLog.test.ts` | ❌ w3 | ⬜ pending |
| 1-05-01 | 05 | 4 | WSPC-05 | T-1-10 | ThemeStore resolveDark + pack switch + storage onChanged sync (D-13) | unit | `pnpm vitest run tests/core/theme/ThemeStore.test.ts` | ❌ w4 | ⬜ pending |
| 1-06-01 | 06 | 4 | WSPC-01 | T-1-06 | WorkspaceStore hydrate from chrome.storage.local + URL params (M.1) | unit | `pnpm vitest run tests/core/workspace/WorkspaceStore.test.ts` | ❌ w4 | ⬜ pending |
| 1-06-02 | 06 | 4 | WSPC-02 | T-1-07 | WorkspaceRouter.openStandalone update-or-create tab dedupe (M.2, W-12) | unit | `pnpm vitest run tests/core/workspace/WorkspaceRouter.test.ts` | ❌ w4 | ⬜ pending |
| 1-06-03 | 06 | 4 | WSPC-03 | T-1-08 | WorkspaceSync heartbeat + version LWW (WORKSPACE_UPDATED, M.3) | unit | `pnpm vitest run tests/core/workspace/WorkspaceSync.test.ts` | ❌ w4 | ⬜ pending |
| 1-06-04 | 06 | 4 | RUNTIME-03 | T-1-03b | BroadcastBus cross-surface sync via fakeBrowser runtime events (M.3) | unit | `pnpm vitest run tests/core/runtime/BroadcastBus.test.ts` | ❌ w4 | ⬜ pending |
| 1-07-01 | 07 | 5 | WSPC-04 | T-1-09 | Registries register at startup; page registry drives Shell nav | unit | `pnpm vitest run tests/core/registry` | ❌ w5 | ⬜ pending |
| 1-07-02 | 07 | 5 | RUNTIME-05 | T-1-05 | Content bridge PING→PONG; MessageType whitelist (D-17) | unit | `pnpm vitest run tests/core/content/ContentScriptHost.test.ts` | ❌ w5 | ⬜ pending |
| 1-07-03 | 07 | 5 | §24 isolation | T-1-12 | No UI/antd in content script bundle (built `.output`) | build+grep | `pnpm wxt build && node tests/isolation/check-content-bundle.mjs` | ❌ w5 | ⬜ pending |
| 1-08-01 | 08 | 5 | UI-SPEC | T-1-11 | Shells/Onboarding/page skeletons render with XProvider; no innerHTML | component | `pnpm vitest run tests/components` | ❌ w5 | ⬜ pending |
| 1-09-01 | 09 | 6 | RUNTIME-02 | T-1-02 | workerState.ok/fail envelope replies (§20.5) | unit | `pnpm vitest run tests/core/runtime/workerState.test.ts` | ❌ w6 | ⬜ pending |
| 1-09-02 | 09 | 6 | WSPC-01 | T-1-06 | Entrypoint mounts: one XProvider + one ConfigProvider per surface | component | `pnpm vitest run tests/entrypoints` | ❌ w6 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Status/nyquist fields in frontmatter are owned by validate-phase (W-13) — execution plans must not flip them.*

---

## Test-Infra Creation Map (per owning plan)

| Test file / infra | Owning plan | Wave |
|-------------------|-------------|------|
| `vitest.config.ts` (WxtVitest) + `tests/setup.ts` (matchMedia polyfill + fakeBrowser reset) + dev deps install | 01-01 | 1 |
| `tests/isolation/check-content-bundle.mjs` (01-01 stub → meaningful enforcement in 01-07, W-16 token set) | 01-01 → 01-07 | 1 → 5 |
| `tests/core/runtime/{RuntimeEnvelope,OperationId}.test.ts` | 01-02 | 2 |
| `tests/core/events/EventBus.test.ts` + `tests/core/messaging/MessageBus.test.ts` | 01-03 | 3 |
| `tests/core/error/debugLog.test.ts` + `tests/components/{ErrorBoundary,PortableMarkdown,MinimalMode,FocusTrap}.test.tsx` | 01-04 | 3 |
| `tests/core/theme/{ThemePackRegistry,ThemeStore}.test.ts` | 01-05 | 4 |
| `tests/core/runtime/BroadcastBus.test.ts` + `tests/core/workspace/{WorkspaceStore,WorkspaceRouter,WorkspaceSync}.test.ts` | 01-06 | 4 |
| `tests/core/registry/{AddonRegistry,PageRegistry}.test.ts` + `tests/core/content/ContentScriptHost.test.ts` | 01-07 | 5 |
| `tests/components/{sidepanel,standalone,onboarding,cmdk}/*.test.tsx` | 01-08 | 5 |
| `tests/core/runtime/workerState.test.ts` + `tests/entrypoints/{sidepanel,standalone}.test.tsx` | 01-09 | 6 |

## Wave 0 Requirements (plan 01-01 scaffold)

- [ ] `vitest.config.ts` — WxtVitest plugin (no test files yet)
- [ ] `tests/setup.ts` — matchMedia polyfill + `fakeBrowser.reset()` per test
- [ ] Dev deps install: `pnpm add -D vitest @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom` — none installed yet
- [ ] `tests/isolation/check-content-bundle.mjs` — §24 stub (forbidden-token set completed in 01-07, W-16)

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
