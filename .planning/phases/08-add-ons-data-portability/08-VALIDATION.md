---
phase: 08
slug: add-ons-data-portability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | ADDON-01 | T-08-01 / — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | ADDON-02 | T-08-02 / — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | ADDON-03 | T-08-03 / — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 08-01-04 | 01 | 1 | ADDON-04 | T-08-04 / — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 08-01-05 | 01 | 1 | ADDON-05 | T-08-05 / — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 08-01-06 | 01 | 1 | ADDON-06 | T-08-06 / — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 08-01-07 | 01 | 1 | ADDON-07 | T-08-07 / — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 08-01-08 | 01 | 1 | ADDON-08 | T-08-08 / — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 08-01-09 | 01 | 1 | ADDON-09 | T-08-09 / — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 08-01-10 | 01 | 1 | DATA-01 | T-08-10 / — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 08-01-11 | 01 | 1 | DATA-02 | T-08-11 / — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/addons/AddonRegistry.test.ts` — stubs for ADDON-01
- [ ] `tests/addons/servicenow/CookieSessionStore.test.ts` — stubs for ADDON-02
- [ ] `tests/addons/servicenow/SessionAdapter.test.ts` — stubs for ADDON-02
- [ ] `tests/addons/write/writeSkills.test.ts` — stubs for ADDON-06
- [ ] `tests/core/data/exportSanitization.test.ts` — stubs for DATA-01
- [ ] `tests/core/data/importMerge.test.ts` — stubs for DATA-02
- [ ] `tests/addons/global/ResearchSkill.test.ts` — stubs for ADDON-09

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ServiceNow JSESSIONID extraction | ADDON-03 | Requires live ServiceNow instance with valid session | Log in to ServiceNow, open extension DevTools, verify JSESSIONID appears in session store |
| Data export ZIP download | DATA-01 | Chrome Downloads API interaction not mockable | Trigger export, verify ZIP downloads, inspect contents |
| Data import file chooser | DATA-02 | Chrome file picker interaction not mockable | Trigger import, select a previously exported file, verify merge results |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
