---
phase: 04b
slug: trust-aware-context-and-receipts
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-13
---

# Phase 04b — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (existing; config: `vitest.config.ts` with `jsdom-align` env, `threads` pool, `tests/setup.ts` + fakeBrowser + fake-indexeddb) |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `pnpm vitest run tests/core/context/trust tests/security/prompt-injection --bail=1` |
| **Full suite command** | `pnpm run verify:phase-4b` (new script; §24 chain form consistent with the 6 existing scripts: `eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run`) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/core/context/trust tests/security/prompt-injection --bail=1`
- **After every plan wave:** Run `pnpm run verify:phase-4b`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Task IDs filled at plan time from the phase PLAN.md files. Wave 0 stubs listed in the Wave 0 Requirements section below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (assigned at plan time) | 01 | 1 | TRUST-01 (CTX-01) | T-4b-01 / — | C.1 types verbatim: TrustLevel union, ContextItem shape with `instructionAuthority` false for retrieved, ContextReceiptEntry — Zod gates reject unknown kinds/trusts | unit | `pnpm vitest run tests/core/context/trust/TrustTypes.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 01 | 1 | TRUST-01 (CTX-02) | T-4b-02 / — | `applyTrustPolicy` (O.3 verbatim): AUTHORITY_BY_TRUST mapping; `<untrusted_data source="…">` wrap; system/user untouched | unit | `pnpm vitest run tests/core/context/trust/TrustPolicy.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 01 | 1 | TRUST-01 (CTX-02) | T-4b-03 / — | `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` raised on policy-redefinition attempt; code exists in errorCodes.ts (GR-9) | unit | `pnpm vitest run tests/core/context/trust/TrustPolicy.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 01 | 1 | TRUST-02 (CTX-02) | T-4b-04 / — | Classifier: `stripInvisibleUnicode` removes zero-width/tag-block/variation-selector; `classifyInjection` flags instruction-override shapes; determinism | unit (security dir) | `pnpm vitest run tests/security/prompt-injection/injectionScreener.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 01 | 1 | TRUST-02 (CTX-02) | T-4b-05 / — | Quarantine-not-drop: flagged item stays ContextItem, never PromptSection; receipt `included:false, omitReason:'prompt_injection'`; legit page ABOUT injection recoverable | unit | `pnpm vitest run tests/security/prompt-injection/quarantine.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 01 | 1 | TRUST-02 (CTX-02) | T-4b-06 / — | Malicious fixtures cannot alter policy or inject: authority strip renders classifier-miss inert (boundary test, not filter recall) | unit | `pnpm vitest run tests/security/prompt-injection/quarantine.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 01 | 1 | TRUST-03 (CTX-03) | T-4b-07 / — | Feed: `pageToContextItems` fills trust/relevance/freshness/sensitivity; §22.2 2,000-token structural cap marks truncated | unit | `pnpm vitest run tests/core/context/trust/contextFeed.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 01 | 1 | TRUST-03 (CTX-03) | T-4b-08 / — | Source-type gates: disabled kind excluded, receipt `included:false, omitReason:'trust_disabled'`; all-true default includes page | unit | `pnpm vitest run tests/core/context/trust/contextFeed.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 01 | 1 | TRUST-03 (CTX-03/04) | T-4b-09 / — | Receipt reconstruction contract: context section recomputed from receipt equals packed section (D-4b-11, no optimizer re-run) | unit | `pnpm vitest run tests/core/context/trust/contextReceipt.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 01 | 1 | CTX-04 (D-4b-12) | T-4b-10 / — | Stable-prefix snapshots: `[SYSTEM]` byte-identical across equivalent turns; with vs without pageContext; never contains `<untrusted_data`; wrap only in TASK_KINDS context | unit (snapshot) | `pnpm vitest run tests/core/context/trust/stablePrefix.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 01 | 1 | CTX-06 (D-4b-14) | T-4b-11 / — | Quality counters: screened/quarantined/per-trust-bucket/totalIncludedTokens, no raw text; manifest schema extended | unit | `pnpm vitest run tests/core/context/trust/qualityCounters.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 01 | 1 | CTX-05 (D-4b-13) | T-4b-12 / — | Structural seam: ContextItem carries disclosure-readiness metadata field (type-level) | unit (type-level) | `pnpm vitest run tests/core/context/trust/TrustTypes.test.ts --bail=1` | ❌ W0 | ⬜ pending |
| (assigned at plan time) | 02 | 2 | D-4b-09 | T-4b-13 / — | Hook wiring: optimizer `pageContext` + `trustPrefs` path produces a `context` section; `pageContext: undefined` path byte-identical to pre-4b | unit | `pnpm vitest run tests/core/context/ContextOptimizer.test.ts --bail=1` | ❌ extend | ⬜ pending |
| (assigned at plan time) | 02 | 2 | D-4b-07 | T-4b-14 / — | Options content-trust card: 4 Switch rows at persisted values, toggle write-through to np_trust, rollback + `STR.options.trustSaveFailed` toast, all-true fallback | component | `pnpm vitest run tests/components/OptionsPage.test.tsx --bail=1` | ❌ W0 | ⬜ pending |
| verify gate | 03 | 3 | verify:phase-4b | — | Chain + scoped dirs green | — | `pnpm run verify:phase-4b` | ❌ W0 (script) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/context/trust/TrustTypes.test.ts` — C.1 types + Zod gates + CTX-01 invariant + CTX-05 seam (new dir)
- [ ] `tests/core/context/trust/TrustPolicy.test.ts` — O.3 applyTrustPolicy + CONTEXT_INSTRUCTION_INJECTION_BLOCKED
- [ ] `tests/core/context/trust/contextFeed.test.ts` — pageToContextItems, budget cap, source gates
- [ ] `tests/core/context/trust/contextReceipt.test.ts` — receipt build + reconstruction contract
- [ ] `tests/core/context/trust/stablePrefix.test.ts` — byte-stable prefix snapshots (CTX-04)
- [ ] `tests/core/context/trust/qualityCounters.test.ts` — CTX-06 counters, no raw text
- [ ] `tests/security/prompt-injection/injectionScreener.test.ts` — classifier + unicode strip (new top-level dir `tests/security/`)
- [ ] `tests/security/prompt-injection/quarantine.test.ts` — quarantine-not-drop + malicious-fixture invariants
- [ ] `tests/components/OptionsPage.test.tsx` — content-trust card (extend or add; fakeBrowser for chrome.storage)
- [ ] `tests/core/context/ContextOptimizer.test.ts` — extend: trust-aware pageContext feed + drop-in identity with/without page
- [ ] Framework install: none — zero new packages (antd `Switch` verified in installed 6.5.3)
- [ ] `verify:phase-4b` script in package.json (§24 chain, consistent with prior phases)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All phase behaviors have automated verification. | — | The phase is core-infrastructure; the only user-facing surface (Options content-trust card) has component tests. No manual-only row. | — |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
