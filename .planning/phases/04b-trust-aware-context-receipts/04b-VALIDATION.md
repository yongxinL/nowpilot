---
phase: 04b
slug: trust-aware-context-receipts
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 04b — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.0 |
| **Config file** | `vitest.config.ts` (jsdom environment, globals: true) |
| **Quick run command** | `npx vitest run tests/core/context/ContextTrustPolicy.test.ts tests/core/context/ContextItem.test.ts` |
| **Full suite command** | `npx vitest run tests/core/context tests/core/ai/ToolResultShaper.test.ts tests/core/ai/types.test.ts tests/security/injection-isolation.test.ts` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/context/ContextTrustPolicy.test.ts tests/core/context/ContextItem.test.ts`
- **After every plan wave:** Run `npx vitest run tests/core/context tests/core/ai/ToolResultShaper.test.ts`
- **Before `/gsd-verify-work`:** Full suite must be green — `npx vitest run tests/core/context tests/core/ai/ToolResultShaper.test.ts tests/core/ai/types.test.ts tests/security/injection-isolation.test.ts`
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04b-01-01 | 01 | 1 | CTX-T01 | T-04b-03 | Schema rejects sensitivity:secret; unwrap preserves PromptSection only | unit | `npx vitest run tests/core/context/tracer-pipeline.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04b-01-02 | 01 | 1 | CTX-T01 | T-04b-01 | assess() returns correct trust/sensitivity/authority; validate() rejects mismatches | unit | `npx vitest run tests/core/context/tracer-pipeline.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04b-01-03 | 01 | 1 | CTX-T02, CTX-T03 | T-04b-02, T-04b-04 | Data sections wrapped in delimiters; system→user→data ordering; receipt entries populated | unit | `npx vitest run tests/core/context/tracer-pipeline.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04b-02-01 | 02 | 2 | CTX-T01 | T-04b-06, T-04b-08 | Full 8-source-type trust table; validate() enforcement; upgrade() escalation | unit | `npx vitest run tests/core/context/ContextTrustPolicy.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04b-02-02 | 02 | 2 | — | T-04b-07 | Exponential decay formula; hard expiry returns 0; Infinity TTL returns 1.0 | unit | `npx vitest run tests/core/context/ContextFreshnessPolicy.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04b-03-01 | 03 | 2 | TOL-04 | T-04b-09, T-04b-11, T-04b-12 | Secret redaction; 32K size limit; immutable ContextItem; trust via ContextTrustPolicy | unit | `npx vitest run tests/core/ai/ToolResultShaper.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04b-04-01 | 04 | 3 | CTX-T03 | T-04b-13 | recordSectionWithReceipt(); omissionReasons from compressor; validateReceiptTotals() | unit | `npx vitest run tests/core/context/ContextProvenanceManifest.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04b-04-02 | 04 | 3 | CTX-T03 | T-04b-14, T-04b-15 | optimizeFromItems() populates receipt with omission reasons; totals cross-check; stale items tracked | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04b-05-01 | 05 | 4 | CTX-T04 | T-04b-16, T-04b-17 | Combined FNV-1a hash deterministic; per-section hashes for diagnostics; volatile sections excluded; snapshots guard | snapshot | `npx vitest run tests/core/context/stable-prefix.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04b-06-01 | 06 | 5 | CTX-T02 | T-04b-18 | Injection fixtures cannot escape delimiters; adversarial text never precedes system instructions | integration | `npx vitest run tests/security/injection-isolation.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04b-06-02 | 06 | 5 | CTX-T05 | T-04b-19, T-04b-20 | Loaded skills → system ContextItem; unloaded skills → omissionReason:policy, zero tokens | unit | `npx vitest run tests/core/context/ContextOptimizer.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/context/tracer-pipeline.test.ts` — End-to-end tracer test (system + data ContextItems through pipeline) — Wave 1, Plan 01
- [ ] `tests/core/context/ContextTrustPolicy.test.ts` — Full 8-source-type trust table fixtures + validate/upgrade tests — Wave 2, Plan 02
- [ ] `tests/core/context/ContextFreshnessPolicy.test.ts` — Exponential decay math, TTL boundaries, expiresAt enforcement — Wave 2, Plan 02
- [ ] `tests/core/ai/ToolResultShaper.test.ts` — Redaction, size limits, provenance, immutability — Wave 2, Plan 03
- [ ] `tests/core/context/ContextProvenanceManifest.test.ts` — Receipt entry fields, omission reasons, totals cross-check — Wave 3, Plan 04
- [ ] `tests/core/context/ContextOptimizer.test.ts` — Extend with trust-aware assembly, delimiter wrapping, receipt, skill disclosure tests — Waves 1, 3, 5
- [ ] `tests/core/context/stable-prefix.test.ts` — FNV-1a golden snapshots, per-section hashes, whitespace/order sensitivity — Wave 4, Plan 05
- [ ] `tests/security/injection-isolation.test.ts` — Adversarial fixture tests for prompt-injection isolation — Wave 5, Plan 06
- [ ] `tests/core/ai/types.test.ts` — ContextItem and ContextReceiptEntry type assertions — Phase gate

*Framework config: none needed — Vitest is already configured with jsdom, globals, and `tests/setup.ts`*

---

## Manual-Only Verifications

*None: all phase behaviors have automated verification. Checkpoint tasks are automated dev-agent checks, not manual-only verifications.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — automated verification commands documented; await Wave 0 test file creation during execution
