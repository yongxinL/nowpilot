---
phase: 01
slug: mv3-wxt-runtime-antd-shells-workspace-handoff
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-19
updated: 2026-08-20
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated from the
> 8-plan / 21-task breakdown in 01-01-PLAN.md through 01-08-PLAN.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (bump path to 4.1.11 tracked as VAI-04, not a Phase-1 action) + jsdom 25 + @testing-library/react 16 |
| **Config file** | `vitest.config.ts` (jsdom env, `globals: true`, `setupFiles: tests/setup.ts`, alias `@` -> repo root) |
| **Quick run command** | `pnpm vitest run <path>` (e.g. `pnpm vitest run tests/core/workspace`) |
| **Full suite command** | `pnpm run verify:phase-1` = `tsc --noEmit && vitest run tests/core tests/background tests/components tests/isolation` (widened by Plan 01-08 Task 2 from the pre-Phase-1 narrower glob — see Wave 0 Requirements below) |
| **Estimated runtime** | ~25-40 seconds (jsdom + ~20 test files across 8 plans; no e2e browser automation in this phase — the human-verify checkpoints in Plans 01-03/01-07/01-08 cover what automation cannot) |

---

## Sampling Rate

- **After every task commit:** Run the task's own `<automated>` verify command (scoped to the file(s) it touches)
- **After every plan (wave):** Run `pnpm run verify:phase-1` (full suite + tsc)
- **Before `/gsd-verify-work`:** Full suite must be green, both grep gates at zero, all 3 blocking human-verify checkpoints (01-03, 01-07, 01-08) approved
- **Max feedback latency:** ~40 seconds (full suite runtime, worst case)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | REQ-F05 (baseline prereq) | T-01-SC | N/A (config only) | manual+grep | `git ls-files package-lock.json; grep packageManager package.json` | ✅ existing files | ⬜ pending |
| 01-01-02 | 01 | 1 | REQ-F05 (D-10 half) | T-01-01 | migrate() throw-free on legacy payload | unit | `pnpm vitest run tests/core/theme/ThemeStore.test.ts` | ✅ extend | ⬜ pending |
| 01-01-03 | 01 | 1 | REQ-F05 (D-22 half) | T-01-02 | migrate() throw-free, no IndexedDB conflation | unit | `pnpm vitest run tests/core/workspace/WorkspaceStore.test.ts` | ✅ extend | ⬜ pending |
| 01-02-tracer | 02 | 2 | REQ-R01 | T-01-04, T-01-05 | single dispatch path, sender-aware handlers | human-check + manual smoke | load-unpacked console check (no message-port-closed errors) | N/A (manual) | ⬜ pending |
| 01-02-02 | 02 | 2 | REQ-R01 | T-01-05 | cold-start answered, idempotent init | unit | `pnpm vitest run tests/background/message-bus-cold-start.test.ts tests/background/background-router.test.ts` | ❌ Wave 0 | ⬜ pending |
| 01-03-01 | 03 | 3 | REQ-R21 | T-01-08 | least-privilege manifest | grep | `grep -A6 "permissions:" wxt.config.ts` | ✅ existing file | ⬜ pending |
| 01-03-checkpoint | 03 | 3 | REQ-R19 | — | visual non-regression after Tailwind removal | human-check | manual load-unpacked visual pass (Standalone light+dark) | N/A (manual) | ⬜ pending |
| 01-03-02 | 03 | 3 | REQ-R19 | — | Tailwind fully removed, no dead classNames left unstyled | grep + human-check (preceding) | `grep -c "tailwind\|shadcn\|@radix-ui" package.json; grep -c "framer-motion" package.json` | ✅ existing files | ⬜ pending |
| 01-03-03 | 03 | 3 | (infra, no REQ ID) | T-01-09, T-01-SC | strict:true, bounded NP-STRICT ceiling | unit + tsc | `tsc --noEmit && pnpm vitest run tests/core/strict` | ❌ Wave 0 | ⬜ pending |
| 01-04-01 | 04 | 4 | REQ-F19 (fresh-install half) | — | no demo content ships to real users | grep + tsc | `grep -c "images.unsplash.com" src/store/useExtensionStore.ts; tsc --noEmit` | ✅ existing file | ⬜ pending |
| 01-04-02 | 04 | 4 | REQ-F19 (connection-test half) | T-01-10, T-01-11 | real failures surface, no key leakage | unit | `pnpm vitest run tests/core/ai/testProviderConnection.test.ts` | ❌ Wave 0 | ⬜ pending |
| 01-04-03 | 04 | 4 | (D-22 remainder) | T-01-12 | debounced writes stay <=30/min, flush-on-unload | unit | `pnpm vitest run tests/core/storage/chromeStorageAdapter.test.ts` | ❌ Wave 0 | ⬜ pending |
| 01-05-01 | 05 | 5 | REQ-R02 | T-01-13 | real (non-vacuous) isolation gate | unit | `pnpm vitest run tests/isolation/cross-entrypoint-imports.test.ts` | ✅ rewrite | ⬜ pending |
| 01-05-02 | 05 | 5 | REQ-R04 | T-01-14 | type-only, no runtime handler | unit | `pnpm vitest run tests/core/runtime/RuntimeEnvelope.test.ts` | ✅ extend | ⬜ pending |
| 01-05-03 | 05 | 5 | REQ-R05 | T-01-15 | documented always-true stub | unit | `pnpm vitest run tests/core/workspace/WorkspaceStore.test.ts` | ✅ extend | ⬜ pending |
| 01-06-01 | 06 | 6 | REQ-F05 | T-01-16 | hydrateFromURL goes through set() | unit | `pnpm vitest run tests/core/workspace/WorkspaceRouter.test.ts tests/core/workspace/WorkspaceStore.test.ts` | ✅ rewrite/extend | ⬜ pending |
| 01-06-02 | 06 | 6 | REQ-F05 | — | rename exhaustiveness | grep | `grep -rc "FullAppPageRegistry\|FullAppPageRegistration\|fullAppPages" src/` | ✅ existing files | ⬜ pending |
| 01-06-03 | 06 | 6 | REQ-F20 | T-01-18 | gesture-safe focus-side-panel reachable | unit | `pnpm vitest run tests/core/commands/registerWorkspaceCommands.test.ts` | ❌ Wave 0 | ⬜ pending |
| 01-07-01 | 07 | 7 | REQ-F05, REQ-F12 | T-01-16 (reuse) | loading/error toast, no window.close() | unit | `pnpm vitest run tests/core/commands/registerWorkspaceCommands.test.ts` | ✅ extend | ⬜ pending |
| 01-07-02 | 07 | 7 | REQ-F05 | T-01-19 | mirror-banner/disabled-composer consistency | unit | `pnpm vitest run tests/components/MirrorBanner.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 01-07-03 | 07 | 7 | (D-10 UI half, no REQ ID) | T-01-20 | cross-surface propagation, actionable failure | unit | `pnpm vitest run tests/core/theme/ThemeSync.test.tsx` | ✅ extend | ⬜ pending |
| 01-07-checkpoint | 07 | 7 | REQ-F05, REQ-F12, REQ-F20 | T-01-21 | visual/interactive capstone (mirror, palette, theme) | human-check | manual load-unpacked 5-point pass | N/A (manual) | ⬜ pending |
| 01-08-01 | 08 | 8 | REQ-F19 | T-01-22 | 4-step, no auto-advance, real failure reporting | unit | `pnpm vitest run tests/components/OnboardingModal.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 01-08-02 | 08 | 8 | REQ-F19 | — | clean swap, widened phase gate | grep + full suite | `pnpm run verify:phase-1` | ✅ existing file | ⬜ pending |
| 01-08-checkpoint | 08 | 8 | REQ-F19 | T-01-22 | fresh-install onboarding visual/interactive pass | human-check | manual load-unpacked 4-point pass | N/A (manual) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test files/directories this phase's plans create from scratch (no pre-existing scaffold to extend) — every one of these is listed as a `<files>`/behavior block inside its owning task in 01-01 through 01-08-PLAN.md, so there is no separate Wave-0-only setup task; each is created in the same task that first needs it:

- [ ] `tests/background/message-bus-cold-start.test.ts` — Plan 01-02 Task 2
- [ ] `tests/background/background-router.test.ts` — Plan 01-02 Task 2
- [ ] `tests/core/strict/np-strict-ceiling.test.ts` — Plan 01-03 Task 3
- [ ] `tests/core/ai/testProviderConnection.test.ts` — Plan 01-04 Task 2
- [ ] `tests/core/storage/chromeStorageAdapter.test.ts` — Plan 01-04 Task 3
- [ ] `tests/core/commands/registerWorkspaceCommands.test.ts` — Plan 01-06 Task 3 (created), extended Plan 01-07 Task 1
- [ ] `tests/components/MirrorBanner.test.tsx` — Plan 01-07 Task 2
- [ ] `tests/components/OnboardingModal.test.tsx` — Plan 01-08 Task 1

Existing test files extended (not created fresh) across this phase: `tests/core/theme/ThemeStore.test.ts`, `tests/core/theme/ThemeSync.test.tsx`, `tests/core/workspace/WorkspaceStore.test.ts`, `tests/core/workspace/WorkspaceRouter.test.ts` (rewritten — its two existing assertions test literal `'app.html'` strings and must be corrected, not just extended), `tests/core/runtime/RuntimeEnvelope.test.ts`, `tests/isolation/cross-entrypoint-imports.test.ts` (rewritten — its three existing assertions grep non-existent directories and are vacuous today).

`package.json`'s `verify:phase-1` script is widened in Plan 01-08 Task 2 from `tsc --noEmit && vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme` to `tsc --noEmit && vitest run tests/core tests/background tests/components tests/isolation`, once every directory above exists — this is the last task of the last plan, ensuring the phase gate actually runs everything this phase created rather than the narrower pre-Phase-1 glob.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tailwind-removal visual non-regression (StandaloneWorkspace/WorkspaceSidebar layout, both themes) | REQ-R19 | Tailwind utility classNames degrade silently (dead no-op strings) rather than failing a build — no automated test can distinguish "styled correctly via AntD tokens" from "silently unstyled" without a rendered visual check | Plan 01-03's `checkpoint:human-verify` task: load-unpacked, open Standalone view, confirm Sider width bands, rounded-corner panel, collapse animation, and dark-mode contrast |
| Cross-surface handoff + palette + theme propagation capstone | REQ-F05, REQ-F12, REQ-F20 | Requires two live extension surfaces (Side Panel + a real browser tab) interacting via BroadcastChannel/chrome.storage.onChanged in real time — jsdom cannot simulate two separate extension contexts observing the same chrome.storage event | Plan 01-07's `checkpoint:human-verify` task: the 5-point load-unpacked pass (Cmd+K sets on both surfaces, handoff+mirror+refocus, cross-surface theme propagation within ~1s) |
| Fresh-install onboarding end-to-end | REQ-F19 | Requires clearing real chrome.storage.local and observing the modal's actual first-open trigger timing across a live extension reload, plus a real (failing, since no provider is configured) network call to prove the failure path is truthful | Plan 01-08's `checkpoint:human-verify` task: the 4-point load-unpacked pass (auto-open, 4-step no-auto-advance, real connection-failure reporting, skip-does-not-permanently-dismiss) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicitly manual-only (3 checkpoint:human-verify tasks across 01-03/01-07/01-08, each justified above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (the 3 human-verify checkpoints are each immediately preceded/followed by automated-verify tasks within the same or adjacent plan)
- [x] Wave 0 covers all MISSING references (8 new test files enumerated above, each tied to the task that creates it)
- [x] No watch-mode flags (`vitest run`, never bare `vitest`, in every automated verify command)
- [x] Feedback latency < 60s (full suite ~25-40s; no per-task command exceeds a few seconds against its scoped path)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (planner-populated; execute-phase/verify-work confirms green before flipping `status: validated`)
