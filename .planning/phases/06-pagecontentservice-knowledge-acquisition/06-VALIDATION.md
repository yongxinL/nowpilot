---
phase: 6
slug: pagecontentservice-knowledge-acquisition
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-29
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.0.0 (jsdom environment, globals enabled) |
| **Config file** | `vitest.config.ts` (setupFiles: `./tests/setup.ts`; `@/` alias → `src/`) |
| **Quick run command** | `pnpm lint` + affected test file |
| **Full suite command** | `pnpm verify:phase-6` (after re-point per D-92) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm lint` (tsc --noEmit) + the affected test file
- **After every plan wave:** Run `pnpm verify:phase-6`
- **Before `/gsd-verify-work`:** Full suite must be green (plus `pnpm verify:all` smoke at gate)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | §18 apcLite.types.ts | — | zod schemas on every cross-boundary shape | unit | `vitest run tests/core/extraction/ApcLiteStrategy.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | §18 PageContext supersession (D-83) | — | canonical types single-source | unit | `tsc --noEmit` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | §18 DefuddleStrategy | T-P6-04 (XSS) / T-P6-05 (exfiltration) | `useAsync:false` + sync `parse()`; defuddle ≥0.9.0; no raw innerHTML | unit (spike host) | `vitest run tests/core/extraction/DefuddleStrategy.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | §18 ApcLiteStrategy | T-P6-06 (password capture) | FormControlSchema.refine password omission | unit | `vitest run tests/core/extraction/ApcLiteStrategy.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 3 | §18 PageContentService | T-P6-07 (DoS) | 2MB cap + 5s AbortController + typed CONTENT_EXTRACT_FAILED | unit/integration | `vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 3 | §18 PageContentCache | — | ephemeral, never persisted; LRU cap 20; coalescing | unit | `vitest run tests/core/extraction/PageContentService.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 4 | §18 PageIndexBuilder | — | ephemeral index, never persisted; 'topk' compression | unit | `vitest run tests/core/extraction/PageIndexBuilder.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-05-01 | 05 | 5 | §18 / §24 isolation | T-P6-03 (bundle) | built-bundle grep rejects React/AntD/defuddle/yaml/mathml-to-latex/temml/turndown | isolation | `vitest run tests/isolation/no-content-script-ui.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-05-02 | 05 | 5 | §18 verify:phase-6 (D-92) | — | gate re-point + phase-4a reconcile | gate | `pnpm verify:phase-6` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/extraction/PageContentService.test.ts` — orchestrator + timeout + typed error path
- [ ] `tests/core/extraction/DefuddleStrategy.test.ts` — real-engine detached-doc fidelity (SPIKE-P6-01 host) + Readability fallback
- [ ] `tests/core/extraction/ApcLiteStrategy.test.ts` — normalization + schema + password omission
- [ ] `tests/core/extraction/PageIndexBuilder.test.ts` — chunking rules + selectRelevant + ephemerality
- [ ] `tests/isolation/no-content-script-ui.test.ts` — built-bundle grep with non-vacuous self-test
- [ ] `tests/fixtures/` (optional) — KB-article / portal-record shaped HTML fixtures for the spike
- [ ] Dependency install: `pnpm add defuddle@^0.19 @mozilla/readability@^0.6 turndown@^7 minisearch@^7` — none installed today

*Chrome API mocks needed by cache/content tests already exist in `tests/setup.ts` (chrome.storage local/sync/session, BroadcastChannel, fake-indexeddb); a `chrome.tabs` mock for onUpdated/onRemoved will need adding if not present.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None — all phase behaviors have automated verification. | — | — | — |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending