---
phase: 1
slug: project-scaffold-runtime-foundation
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
remediated: 2026-07-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | SHELL-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/` — test infrastructure and stubs for Phase 1 requirements
- [ ] Test files for CommandPalette, ThemeToggle, OnboardingWizard, cross-entrypoint isolation
- [ ] `vitest.config.ts` — Vitest configuration

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-surface theme sync | SHELL-04 | Requires two Chrome extension surfaces open simultaneously | Open Side Panel, toggle theme, verify Full App Tab reflects change |
| Command palette keyboard shortcut | SHELL-05 | Requires Chrome extension context for keyboard shortcut registration | Press Cmd+K on each surface, verify palette opens |
| No cross-entrypoint import violations | SHELL-03 | Requires build analysis | Run `npx wxt build`, verify no cross-entrypoint imports |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

## Remediation (2026-07-29)

The following gaps from the original Phase 1 validation have been remediated:

| Gap | Fix |
|-----|-----|
| `src/core/theme/antdConfig.ts` missing | Created with UI-SPEC seed tokens |
| Cross-entrypoint isolation test vacuously passing | Rewrote to check actual entrypoint dirs + meaningful isolation rules |
| `verify:phase-1` script incomplete | Added `tests/core/commands tests/isolation` |
| Missing component tests | Created ThemeToggle (3 tests) + CommandPalette (7 tests) |
| Missing shell components (architecture deviation) | Accepted — entrypoint-inlined architecture works correctly |

**Verification:** `pnpm run verify:all` — 67/67 tests pass, TypeScript compiles clean

**Approval:** verified
