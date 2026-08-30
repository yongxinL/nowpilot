# Phase 7: Trust-Aware Context and Receipts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-30
**Phase:** 7-Trust-Aware Context and Receipts
**Areas discussed:** Trust architecture, Receipt derivation, Trust-level mapping, Injection defense scope, Injection block trigger, Stable-prefix snapshots, Progressive skill disclosure, Context-quality diagnostics, Verification gate, assemble integration (auto mode — all areas auto-selected)

---

## Trust architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Item-level ContextItem[] pipeline | Trust attaches per ContextItem before packing; applyTrustPolicy wraps untrusted (O.3 verbatim) | ✓ |
| Section-level trust attach | Extend the A8/manifest records with trust fields instead of an item intermediate | |

**User's choice:** Item-level ContextItem[] pipeline (auto-selected — recommended default)
**Notes:** `ContextOptimizer.assemble` inserts the item pipeline: sources → ContextItem[] → applyTrustPolicy → A8 PromptSection[] → manifest → receipt. `AUTHORITY_BY_TRUST` verbatim from O.3.

---

## Receipt derivation

| Option | Description | Selected |
|--------|-------------|----------|
| Additive derived receipt | Keep the §2.6 manifest verbatim (D-77); derive ContextReceiptEntry[] + original tokens | ✓ |
| Extend manifest schema | Add originalTokens/cacheEligible/omitReason directly to the Phase-5 manifest | |

**User's choice:** Additive derived receipt (auto-selected — recommended default)
**Notes:** Receipt fields absent from the manifest; additive derivation preserves the D-72/D-77 verbatim-schema locks. cacheEligible = section.stable.

---

## Trust-level mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Locked per-source mapping | SYSTEM/TOOL SCHEMAS→system, PREFERENCES/INPUT→user, MEMORY→retrieved, CONTEXT→untrusted | ✓ |
| Defer to planner | Leave trust assignment as a research/plan detail | |

**User's choice:** Locked per-source mapping (auto-selected — recommended default)
**Notes:** instructionAuthority true only for system/user; false for retrieved/untrusted. CTX-01 metadata contract.

---

## Injection defense scope

| Option | Description | Selected |
|--------|-------------|----------|
| Layers 5+6-signal+guard in Phase 7 | L5 containment + L6 disclosure signal + policy guard; L1/2/4 owned elsewhere; L3 deferred (ADR-SEC-01) | ✓ |
| Re-implement full six-layer stack | Duplicate L1/L2/L4 mechanisms in this phase | |

**User's choice:** Layers 5+6-signal+guard in Phase 7 (auto-selected — recommended default)
**Notes:** ADR-SEC-01 maps: L1=Phase 6, L2=Phase 4, L3=v0.2, L4=Phase 18/12, L5=Phase 7, L6 UI=Phase 15.

---

## Injection block trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Structural enforcement | Authority map + wrapping + typed CONTEXT_INSTRUCTION_INJECTION_BLOCKED guard; fixtures simulate attempts | ✓ |
| Content heuristics | Regex/pattern matching to spot injection directives in content | |

**User's choice:** Structural enforcement (auto-selected — recommended default)
**Notes:** No content regexes — research P7 documents labels/heuristics being subverted; structural layering is the defense.

---

## Stable-prefix snapshots

| Option | Description | Selected |
|--------|-------------|----------|
| Golden snapshot fixtures + gate as release block | Commit packed stable-prefix golden files; verify:phase-7 diff blocks release (no CI) | ✓ |
| Inline assertions only | Assert stability in-memory without golden fixtures | |

**User's choice:** Golden snapshot fixtures + gate as release block (auto-selected — recommended default)
**Notes:** No `.github/` CI exists — verify:phase-7 is the release-block gate per spec 3611. Cross-check with PromptCacheAdapter.hashStableSections.

---

## Progressive skill disclosure

| Option | Description | Selected |
|--------|-------------|----------|
| Declare-now mechanism | Disclosure registry/selector: triggers+one-liners for inactive skills, full body only for active; zero-token proof | ✓ |
| Defer entirely | Wait for Phase 15 skills | |

**User's choice:** Declare-now mechanism (auto-selected — recommended default)
**Notes:** ISkill (spec 1826) doesn't exist until Phase 15/17; Phase 7 ships the contract + fixture proof.

---

## Context-quality diagnostics

| Option | Description | Selected |
|--------|-------------|----------|
| Derived aggregate metrics | Trust-mix/truncation/compression/token-utilization aggregates, no raw text | ✓ |
| Defer to Phase 11 | No metrics surface this phase | |

**User's choice:** Derived aggregate metrics (auto-selected — recommended default)
**Notes:** Mirrors D-77 derived trace surface; Phase 11 lifts into PromptTrace.

---

## Verification gate

| Option | Description | Selected |
|--------|-------------|----------|
| Re-point verify:phase-7 | tests/core/context/trust tests/security/prompt-injection (spec 3611 verbatim, D-92 analog) | ✓ |
| Leave as-is | Keep targeting Phase 15/16 dirs | |

**User's choice:** Re-point verify:phase-7 (auto-selected — recommended default)
**Notes:** D-68/D-78/D-92 precedent followed verbatim.

---

## assemble integration

| Option | Description | Selected |
|--------|-------------|----------|
| Trust-aware assemble, no live wiring | Insert trust pipeline + original-token retention + rungs 1-2 activation; no AgentOrchestrator/chat changes | ✓ |
| Full live pipeline adoption | Wire OptimizedContext into the running chat/agent loop now | |

**User's choice:** Trust-aware assemble, no live wiring (auto-selected — recommended default)
**Notes:** D-69 create-only discipline; memoryHints doesn't exist until Phase 8, so live adoption is premature.

---

## the agent's Discretion

- File layout under `src/core/context/trust/` (barrel vs per-file).
- ContextItem/ContextReceiptEntry/TrustLevel placement (`src/types/harness.ts` vs `src/core/context/trust/types.ts`) — spec canonical-home rule points to `@/types/harness`; researcher confirms import path used by O.3.
- Exact structural "policy-redefinition attempt" signal shape.
- Disclosure mechanism as standalone module vs assemble input seam.
- L6 disclosure signal: boolean flag vs richer per-item marker.

## Deferred Ideas

- Live OptimizedContext adoption — Phase 8+ (needs memoryHints).
- PromptTrace/AITransactionLog + Diagnostics UI — Phase 11.
- Dual-LLM quarantine — v0.2 (ADR-SEC-01).
- Output screening (L4) — Phase 18/12.
- User-disclosure UI (L6) — Phase 15.
- Real skill manifests/RICH — Phase 15.
- Real MEMORY sources — Phase 8/9.
- Red-team adversarial corpus — Phase 19.