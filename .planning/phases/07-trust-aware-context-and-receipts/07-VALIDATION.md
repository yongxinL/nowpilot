---
phase: 7
slug: trust-aware-context-and-receipts
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-30
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom env, globals enabled) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm lint && pnpm test -- tests/core/context/trust tests/security/prompt-injection` |
| **Full suite command** | `pnpm verify:phase-7` (tsc --noEmit + vitest run tests/core/context/trust tests/security/prompt-injection) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm lint` (tsc --noEmit) + the affected trust/prompt-injection test file
- **After every plan wave:** Run `pnpm verify:phase-7`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | CTX-01 | T-7-01 / — | C.1 types + trust metadata attached per source | unit | `pnpm test -- tests/core/context/trust` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 1 | CTX-02 | T-7-02 / T-7-03 | applyTrustPolicy wrap + authority strip; no content heuristics | unit + security | `pnpm test -- tests/security/prompt-injection` | ❌ W0 | ⬜ pending |
| 7-01-03 | 01 | 1 | CTX-03 | T-7-04 / — | receipt derives from verbatim manifest + original tokens + stable | unit | `pnpm test -- tests/core/context/trust` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 1 | CTX-04 | — / — | golden stable-prefix snapshots; diff blocks release via gate | unit | `pnpm test -- tests/core/context/trust` | ❌ W0 | ⬜ pending |
| 7-02-02 | 02 | 1 | CTX-06 | — / — | derived aggregate metrics; no raw text persisted | unit | `pnpm test -- tests/core/context/trust` | ❌ W0 | ⬜ pending |
| 7-03-01 | 03 | 2 | CTX-05 | — / — | progressive disclosure; inactive full instructions zero tokens | unit | `pnpm test -- tests/core/context/trust` | ❌ W0 | ⬜ pending |
| 7-03-02 | 03 | 2 | — | — / — | verify:phase-7 re-point to §18 dirs (D-103) | gate | `pnpm run verify:phase-7` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/context/trust/` — directory + trust policy/receipt test stubs (Wave 0 creates the dir; gate fails without tests)
- [ ] `tests/security/prompt-injection/` — directory + adversarial fixture test stubs
- [ ] `package.json` — `verify:phase-7` re-pointed (D-103) so Wave 1+ gates target the §18 dirs

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| L6 disclosure signal consumed by Phase-15 UI banner | CTX-02 / D-98 | Phase-15 UI not built yet — signal is a forward contract | Verify `untrustedDataPresent` flag computes true on an untrusted receipt entry in a unit test |

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