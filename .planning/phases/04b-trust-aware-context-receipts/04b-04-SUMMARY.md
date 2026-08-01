---
phase: 04b-trust-aware-context-receipts
plan: 04
subsystem: context-pipeline
tags: [context, receipt, omission-reasons, freshness, provenance, d-03, d-10, ctx-t03]

# Dependency graph
requires:
  - phase: 04b-trust-aware-context-receipts
    plan: 01
    provides: ContextReceiptEntry type, recordSectionWithReceipt(), optimizeFromItems() receipt loop, ContextItem schema gate (D-09)
  - phase: 04b-trust-aware-context-receipts
    plan: 02
    provides: ContextFreshnessPolicy.compute() exponential decay + hard expiry (D-10), full ContextTrustPolicy source-type table (D-07)
  - phase: 04-context-optimization-pipeline
    provides: ContextCompressor 7-step degradation pipeline, TokenBudget
provides:
  - markOmitted() + validateReceiptTotals() on ContextProvenanceManifest — excluded-source receipt entries and the packed-totals cross-check (CTX-T03, RESEARCH Pitfall 4)
  - ContextCompressor.compress() omissionReasons map — every dropped/trimmed section keyed to its omission reason (budget/policy), compressed-but-included sections excluded
  - optimizeFromItems() freshness gate — hard-expired items omitted as 'stale' before compression (D-10), with validation-before-expiry ordering (D-09 cannot be bypassed)
  - optimizeFromItems() receipt population from compressor omissionReasons + totals cross-check warning (T-04b-14 accept)
affects: [04b-06, phase-06 (diagnostics), phase-06a (telemetry aggregation — CTX-T06 structural prep only), phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Omission tracking in the compressor is before/after diffing per degradation step — removed sections (drop-debug/drop-secondary → policy, minimal-mode page → budget) plus rewritten sections that lost JSON entries (trim-tools/reduce-memory/minimal-mode caps → budget); summarise-history/compress-page/ai-summarisation never record (still included, just smaller)"
    - "markOmitted() duplicate-guarded per sourceId (D-17): one receipt entry per source — rewritten-but-surviving sections (e.g. trimmed tools) never get a second included:false entry"
    - "Freshness gate runs AFTER schema+trust validation but BEFORE delimiter wrapping — every item is validated (D-09 secret gate cannot be bypassed by expiring an item, T-04b-13) and originalTokens reflect the source size, not the wrapped estimate"
    - "validateReceiptTotals() warns, never throws — a receipt mismatch is a diagnostic inconsistency for Phase 6 telemetry, not a prompt failure (T-04b-14)"

key-files:
  created:
    - tests/core/context/ContextProvenanceManifest.test.ts
  modified:
    - src/core/context/ContextProvenanceManifest.ts
    - src/core/context/ContextCompressor.ts
    - src/core/context/ContextOptimizer.ts
    - tests/core/context/ContextOptimizer.test.ts

key-decisions:
  - "markOmitted() takes an explicit kind parameter (plan signature omitted it): ContextReceiptEntry.kind is required, and every caller holds the ContextItem that supplies it"
  - "Freshness pass on validated-but-unwrapped items, wrapping deferred to a separate pass — preserves originalTokens semantics for stale entries AND keeps the D-09 secret gate ahead of the expiry check"
  - "Receipt loop consults omissionReasons per sourceId with 'budget' fallback instead of a blanket map sweep — markOmitted's duplicate guard then makes a defensive sweep unnecessary (rewritten surviving sections keep their included:true entry)"
  - "Omission tracking in the compressor diffs before/after each step rather than re-deriving from sourceId patterns — it observes the actual policy steps, so the map never lies about what the pipeline did"

patterns-established:
  - "One receipt entry per source (D-17): markOmitted skips sourceIds already present in the manifest"
  - "runDegradation() propagates omissionReasons to both callers; optimize() destructures only sections/stepsApplied — the legacy path is untouched"

requirements-completed: [CTX-T03]

coverage:
  - id: D1
    description: "Receipt accounting utilities — markOmitted() records excluded sources (included:false, finalTokens:0, no totalTokens contribution, duplicate-guarded) and validateReceiptTotals() cross-checks included receipt finalTokens against packed section totals (true on match, false on any nonzero delta)"
    requirement: CTX-T03
    verification:
      - kind: unit
        ref: "tests/core/context/ContextProvenanceManifest.test.ts#markOmitted() records an excluded source with finalTokens 0 and no totalTokens contribution"
        status: pass
      - kind: unit
        ref: "tests/core/context/ContextProvenanceManifest.test.ts#validateReceiptTotals() returns true when the included receipt total equals the packed total"
        status: pass
      - kind: unit
        ref: "tests/core/context/ContextProvenanceManifest.test.ts#validateReceiptTotals() returns false when receipt totals and packed totals diverge"
        status: pass
    human_judgment: false
  - id: D2
    description: "ContextCompressor.compress() emits omissionReasons: Map<string, OmissionReason> — trim-tools drops map the tool schema sourceId to budget, compressed-but-included steps never record, and an under-budget run returns an empty map"
    requirement: CTX-T03
    verification:
      - kind: unit
        ref: "tests/core/context/ContextProvenanceManifest.test.ts#compress() omissionReasons maps the trimmed tool schema sourceId to budget"
        status: pass
      - kind: unit
        ref: "tests/core/context/ContextProvenanceManifest.test.ts#compress() omissionReasons is empty when the budget is satisfied without degradation"
        status: pass
    human_judgment: false
  - id: D3
    description: "optimizeFromItems() receipt integration — dropped data items get included:false with the compressor's omission reason, policy-dropped debug items carry 'policy', hard-expired items are omitted as 'stale' before compression, and the totals cross-check passes on consistent runs"
    requirement: CTX-T03
    verification:
      - kind: integration
        ref: "tests/core/context/ContextOptimizer.test.ts#records dropped data items with included:false and the compressor omission reason"
        status: pass
      - kind: integration
        ref: "tests/core/context/ContextOptimizer.test.ts#uses the compressor omission reason (policy) for policy-dropped debug items"
        status: pass
      - kind: integration
        ref: "tests/core/context/ContextOptimizer.test.ts#omits hard-expired items as stale via ContextFreshnessPolicy before compression"
        status: pass
      - kind: integration
        ref: "tests/core/context/ContextOptimizer.test.ts#receipt totals cross-check passes: validateReceiptTotals(receipt, packedSections) is true"
        status: pass
    human_judgment: false
  - id: D4
    description: "Regression pins — trust-mismatched items rejected with SCHEMA_INVALID before the receipt stage (ContextTrustPolicy spied), and the legacy optimize() raw-input path continues to work unchanged"
    requirement: CTX-T03
    verification:
      - kind: integration
        ref: "tests/core/context/ContextOptimizer.test.ts#rejects trust-mismatched items via ContextTrustPolicy before the receipt stage"
        status: pass
      - kind: integration
        ref: "tests/core/context/ContextOptimizer.test.ts#keeps the existing optimize() method working unchanged (backward compatibility)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-01
status: complete
---

# Phase 04b Plan 04: Receipt Validation + Omission-Reason Integration Summary

**Full receipt accounting across the degradation pipeline: `markOmitted()`/`validateReceiptTotals()` on ContextProvenanceManifest, ContextCompressor.compress() emitting an `omissionReasons` map (budget/policy per dropped or trimmed section), and optimizeFromItems() wiring omission reasons + a pre-compression freshness gate ('stale' for hard-expired items) into every receipt entry with a packed-totals cross-check**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-01T21:19:34Z
- **Completed:** 2026-08-01T21:27:00Z
- **Tasks:** 2 (4 commits — TDD RED/GREEN pairs)
- **Files modified:** 4 (3 source, 1 test created, 1 test extended)

## Accomplishments

- **Receipt accounting utilities (CTX-T03):** `markOmitted()` appends an `included:false` ContextReceiptEntry (`finalTokens: 0`, `omissionReason`, `cacheEligible: false`, `originalTokens` from the source) for items excluded BEFORE the final PromptSection[] — freshness-expired, policy-dropped, or budget-dropped sources stay visible to the user and to Phase 6 diagnostics without contributing to `totalTokens`. Duplicate-guarded per sourceId (D-17): a rewritten-but-surviving section (e.g. trimmed tools) never gains a second, contradictory entry.
- **`validateReceiptTotals()` (RESEARCH Pitfall 4):** cross-checks `sum(included.finalTokens) === sum(packedSections.tokens)`; any nonzero delta is flagged as a diagnostic bug. Wired into `optimizeFromItems()` as a warn-only guard (never throws — the prompt is still valid; Phase 6 telemetry flags the inconsistency, T-04b-14 accept).
- **Compressor omission tracking (CTX-T03):** `compress()` now returns `omissionReasons: Map<string, OmissionReason>` built by diffing before/after each degradation step — fully removed sections (`drop-debug`/`drop-secondary` → `policy`, `minimal-mode` page drop → `budget`) and rewritten sections that lost JSON entries (`trim-tools`/`reduce-memory`/`minimal-mode` caps → `budget`). Compressed-but-included steps (`summarise-history`, `compress-page`, `ai-summarisation`) never record — the item is still in the output, just smaller. Under-budget runs return an empty map.
- **optimizeFromItems() receipt integration:** the receipt loop now consumes the compressor's omission reasons (`policy` for debug/secondary drops, `budget` for minimal-mode) instead of the 04b-01 hardcoded `'budget'` fallback; a new freshness gate (D-10) marks hard-expired items (`freshness === 0`) as `'stale'` and excludes them from assembly before wrapping. Validation ordering is deliberate: schema+trust validation runs on ALL items first, so the D-09 secret gate can never be bypassed by expiring an item (T-04b-13).
- **Backward compatibility:** `optimize()` is untouched — `runDegradation()` propagates the new `omissionReasons` field while the legacy path destructures only what it needs; regression test pins the raw-input path unchanged.

## Task Commits

Each task was committed atomically with TDD RED/GREEN pairs:

1. **Task 1: Receipt validation + omission-reason emission** — `b94ed3f` (test), `848e6d1` (feat)
2. **Task 2: optimizeFromItems() receipt wiring** — `1d0ea0f` (test), `0f31fe2` (feat)

**Verification:** plan verify `npx vitest run tests/core/context/ContextProvenanceManifest.test.ts tests/core/context/ContextOptimizer.test.ts --reporter=verbose` → 41/41 pass; `npm run verify:phase-4` → tsc clean + 134/134 context tests pass; full suite 606 pass / 6 fail (pre-existing Phase 03 provider-SDK drift, see below).

## TDD Gate Compliance

- Task 1 RED gate: `b94ed3f test(04b-04): add failing receipt validation + omission-reason tests` — 5/7 failed before implementation (markOmitted/validateReceiptTotals/omissionReasons missing; 2 pre-existing behaviors passed)
- Task 1 GREEN gate: `848e6d1 feat(04b-04): add receipt validation + omission-reason tracking` — 7/7 pass
- Task 2 RED gate: `1d0ea0f test(04b-04): add failing receipt integration tests for optimizeFromItems` — 2/7 new tests failed (stale omission + policy-reason consumption); regression tests 2/5/6 passed on pre-existing 04b-01 behavior as expected
- Task 2 GREEN gate: `0f31fe2 feat(04b-04): wire omission reasons and receipt cross-check into optimizeFromItems` — 7/7 pass
- REFACTOR: none needed

## Files Created/Modified

- `src/core/context/ContextProvenanceManifest.ts` - Added `markOmitted()` (kind-carrying excluded-source entries, duplicate-guarded, no totalTokens contribution) and `validateReceiptTotals()` (included-finalTokens vs packed-tokens cross-check); `OmissionReason`/`ContextReceiptEntry` type imports
- `src/core/context/ContextCompressor.ts` - `compress()` returns `omissionReasons`; new private `trackOmissions()` diffs before/after each step (removed → policy/budget; rewritten-with-drops → budget; compressed steps never record); `countDroppedEntries()` JSON-array helper
- `src/core/context/ContextOptimizer.ts` - `optimizeFromItems()`: validation split from wrapping, freshness gate between them (manifest created earlier, `markOmitted(...,'stale',...)` for hard-expired items), receipt loop consumes `omissionReasons` with `'budget'` fallback, `validateReceiptTotals()` warn-only cross-check; `runDegradation()` propagates `omissionReasons` (under-budget path returns empty map)
- `tests/core/context/ContextProvenanceManifest.test.ts` - New: 7 tests — receipt-field population, markOmitted accounting, validateReceiptTotals true/false, markTruncated preservation, trim-tools→budget map, empty map under budget
- `tests/core/context/ContextOptimizer.test.ts` - New `optimizeFromItems() receipt integration (04b-04)` block: 7 tests — dropped-data receipt, policy-dropped debug receipt, all-included under budget, totals cross-check, stale omission (fake-timer + policy spy), trust rejection before receipts, optimize() backward compat

## Decisions Made

- **markOmitted() carries an explicit `kind` parameter** — the plan's signature (`markOmitted(manifest, sourceId, reason, originalTokens)`) omitted it, but `ContextReceiptEntry.kind` is required and every caller holds the ContextItem that supplies it. Minor, type-required deviation.
- **Freshness gate between validation and wrapping** — the plan said "call markOmitted(...) with item.tokens" without specifying which item; gating before wrapping keeps `originalTokens` faithful to the source size (the wrapped estimate would overstate it) while keeping D-09 validation ahead of expiry (T-04b-13).
- **Receipt reasons flow through the fallback loop, not a blanket map sweep** — `omissionReasons.get(sourceId) ?? 'budget'` per unmatched item gives every dropped source its correct reason; the duplicate guard in markOmitted makes a defensive sweep unnecessary since rewritten surviving sections already carry their included entry.
- **Omission tracking observes the steps, not the sourceId patterns** — diffing before/after each applied step means the map records exactly what the policy did, and stays correct if a step's filter ever changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Debug-item test fixture too small to trigger degradation**
- **Found during:** Task 2 GREEN (implementation run)
- **Issue:** The policy-dropped-debug fixture declared `tokens: 100` on a 19-char text; after delimiter wrapping the section was ~20 tokens, so `2800 + 20 = 2820 ≤ 2867` (tiny budget) — no degradation ran and the debug section survived.
- **Fix:** Enlarged the fixture text to 1200 chars (~300 tokens + wrapper ≈ 305) so the assembled total exceeds the tiny-tier budget and `drop-debug` actually runs.
- **Files modified:** tests/core/context/ContextOptimizer.test.ts
- **Verification:** test passes; suite 134/134 context tests green.
- **Committed in:** 0f31fe2 (Task 2 feat commit)

**2. [Rule 1 - Bug] Stale receipt originalTokens reflected the wrapped estimate**
- **Found during:** Task 2 GREEN (implementation run)
- **Issue:** The first freshness-gate placement ran after delimiter wrapping, so `markOmitted(..., item.tokens)` recorded the wrapped token count (23) instead of the source size (50) — the receipt lied about the source's size.
- **Fix:** Restructured `optimizeFromItems()` into validation → freshness gate → wrapping passes; stale entries now use validated-unwrapped `item.tokens`, and the D-09 gate stays ahead of expiry.
- **Files modified:** src/core/context/ContextOptimizer.ts
- **Verification:** stale test asserts `originalTokens: 50`; suite green; tsc clean.
- **Committed in:** 0f31fe2 (Task 2 feat commit)

**3. [Rule 3 - Blocking] Test asserted a non-existent public field**
- **Found during:** Task 2 GREEN (implementation run)
- **Issue:** `expect(result.stepsApplied).toContain('drop-debug')` — `stepsApplied` is not part of the `OptimizedContext` public contract.
- **Fix:** Removed the assertion; the sections-identity assertion already proves the drop occurred.
- **Files modified:** tests/core/context/ContextOptimizer.test.ts
- **Verification:** suite green.
- **Committed in:** 0f31fe2 (Task 2 feat commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs in test fixtures/ordering, 1 Rule 3 test assertion). No scope creep; no new dependencies; no production API changes beyond the plan's spec.

## Issues Encountered

- The 6 full-suite failures (`StreamAdapter.test.ts` 2, `ProviderAdapter.test.ts` 4 — `capturedOnChunk is not a function` / `client.chat is not a function`) are the pre-existing Phase 03 `@ai-sdk` provider SDK drift, reproduced on pristine HEAD in prior waves and tracked in WINDOWS.md entries 1-2. Zero overlap with 04b-04 files; untouched per scope boundary.

## Threat Surface

No new threat flags — no new network endpoints, auth paths, file access, or trust-boundary schema changes. Threat-register dispositions hold:
- T-04b-13 (secret existence leak): schema+trust validation runs on ALL items before the freshness gate — expiring an item cannot bypass the D-09 `sensitivity:secret` rejection; secret items never produce receipt entries.
- T-04b-14 (receipt totals tampering): `validateReceiptTotals()` warns on mismatch, never throws — accept per plan.
- T-04b-15 ('sensitive' omission reason): no code path calls `markOmitted` with 'sensitive' — there is no sourceId for a secret that never became a ContextItem.
- CTX-T03 prohibition (no sourceId/token counts for secret-level items): satisfied by construction — receipts only contain entries for items that passed the schema gate.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **04b-06** (delimiter injection hardening) builds on the unchanged `optimizeFromItems()` trust/validation ordering; receipt entries are now fully populated for every inclusion/omission path (budget/policy/stale).
- **Phase 6a (telemetry)** has the structural basis for CTX-T06: `omissionReasons` (compressor), `validateReceiptTotals` mismatch signals, and per-source `included`/`omissionReason`/`cacheEligible` fields are all in place — only aggregation wiring remains (plan note: CTX-T06 structural prep only).
- **Phase 5** source adapters can now rely on receipt entries being correct for freshness-expired and policy-dropped items, not just budget drops.

---

*Phase: 04b-trust-aware-context-receipts*
*Completed: 2026-08-01*

## Self-Check: PASSED

- All 4 planned files modified/created (`ContextProvenanceManifest.ts`, `ContextCompressor.ts`, `ContextOptimizer.ts`, `ContextProvenanceManifest.test.ts` created, `ContextOptimizer.test.ts` extended)
- All 4 task commits verified in git history (b94ed3f, 848e6d1, 1d0ea0f, 0f31fe2)
- Plan verify 41/41 pass; verify:phase-4: tsc clean + 134/134 context tests pass; full suite 606 pass (6 pre-existing failures unrelated)
- SUMMARY.md written to the phase directory
