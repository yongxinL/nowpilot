---
phase: 04b-trust-aware-context-and-receipts
plan: 03
subsystem: security
tags: [trust, context-feed, receipt, provenance, budget, ctx-01]

# Dependency graph
requires:
  - phase: 04b-01
    provides: ContextItem/ContextReceiptEntry/TrustLevel/TrustOmitReason in harness.ts (C.1) + TrustPrefs (np_trust) + ContextItemSchema/ContextReceiptEntrySchema/TrustOmitReasonSchema Zod gates
  - phase: 04a
    provides: PageContext (url/origin/hostname/title/markdown/meta/extractedAt) from the page content service
provides:
  - "contextFeed.pageToContextItems: PageContext → trust-carrying ContextItem[] (CTX-01 metadata, §22.2 structural budget cap at conversion, deterministic freshness curve)"
  - "contextFeed.applySourceGates: D-4b-08 source-type gates via TrustPrefs with structured { reason: 'trust_disabled' } decisions"
  - "contextReceipt.buildReceipt + TrustedFeedResult: reconstruction-sufficient receipt (Pattern 2 token semantics, R-10 raw-text-free) + CTX-06 counters"
  - "ContextProvenanceManifest in-place extension: receipt: ContextReceiptEntry[] + counters (screened/quarantined/byTrust/totalIncludedTokens) + Zod schema lockstep (GR-4)"
affects:
  - 04b-04 (trust stage wires contextFeed + buildReceipt into ContextOptimizer; replaces the placeholder receipt/counters stamp)
  - 04b-05 (hook guard consumes pageToContextItems empty-array output; TrustSettingsStore drives the gates)
  - 04b-06 (verify:phase-4b runs these suites)
  - Phase 6 (PromptInspector consumes the receipt reconstruction data, D-4b-11)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pure-primitive module shape: type-only imports, zero async/model/storage, determinism (no Date.now/crypto)
    - structural budget cap at the feed boundary (D-04-13 no-slice rule — never inside the optimizer)
    - injectable clock for deterministic freshness decay (PromptCacheManager precedent)
    - estimateTokens as the ONLY token counter (receipt original/finalTokens parity, Don't Hand-Roll)
    - single structured decisions map shape ({ reason: TrustOmitReason }) shared by gates + receipt (no conversion)

key-files:
  created:
    - src/core/context/trust/contextFeed.ts
    - src/core/context/contextReceipt.ts
    - tests/core/context/trust/contextFeed.test.ts
    - tests/core/context/trust/contextReceipt.test.ts
    - tests/core/context/trust/qualityCounters.test.ts
  modified:
    - src/core/context/ContextProvenanceManifest.ts (in-place: receipt + counters interface + Zod schema)
    - src/core/context/ContextOptimizer.ts (placeholder receipt/counters stamp — 04b-04 replaces)
    - tests/fixtures/optimizedContext.ts (provenance builder emits receipt: [] + zeroed counters)

key-decisions:
  - "buildReceipt applies the O.3 wrap itself (single wrap site for the feed path): items arrive PRE-wrap so Pattern 2 semantics hold (originalTokens = estimateTokens(item.text) pre-wrap; finalTokens = estimateTokens(wrappedText) when included, 0 when excluded) and the reconstruction contract is byte-exact. The 04b-03 feed stamps instructionAuthority:false, so applyTrustPolicy's authority-strip wrap (04b-02) never fires on it — no double-wrap in the page-only pipeline; 04b-04 wires the stage ordering."
  - "capToBudget is exported (not module-internal): the truncated marker is not representable on ContextItem (C.1 verbatim — R-1), so the §22.2 cap contract is asserted through capToBudget directly; pageToContextItems consumes it without surfacing truncation."
  - "contextText separator = '\\n\\n' (ProviderRouter joinSections L105 convention) — the context section 04b-04 emits is byte-identical to what the receipt reconstructs (D-4b-11 / Pitfall 3)."
  - "Freshness = Open Question 4 fixed curve max(0, 1 - ageHours/24) clamped 0..1 with an injectable nowMs (absent injection → age 0 → freshness 1) — fixture-pinned, no Date.now."
  - "compression on receipt entries stays unset in 04b-03 (optional C.1 field): buildReceipt has no visibility into the feed's cap result; the trust stage (04b-04) stamps 'structural' when the feed marks truncation."

patterns-established:
  - "Feed boundary is the §22.2 enforcement point: structural paragraph/heading cap with truncated marker lives in contextFeed, never in ContextOptimizer (D-04-13 / RESEARCH Pitfall 6)"
  - "Receipt-as-reconstruction-data (D-4b-11): one ContextReceiptEntry per input item incl. excluded (D-4b-06 no-silent-drop), ids + token counts only (R-10)"
  - "One decisions map shape end-to-end: applySourceGates emits { reason: 'trust_disabled' }, the 04b-04 quarantine stage writes { reason: 'prompt_injection' } — buildReceipt consumes the same structured map with no conversion"
  - "In-place additive manifest extension (R-1/D-04-17) with Zod lockstep (GR-4) — existing manifest fields byte-identical"

requirements-completed: [TRUST-01, TRUST-03]

coverage:
  - id: D1
    description: "contextFeed.pageToContextItems — PageContext → ContextItem[] with CTX-01 metadata (trust 'retrieved', instructionAuthority:false, relevance 1, sensitivity 'none', sourceId page.url), §22.2 structural cap (PAGE_BUDGET_TOKENS 2_000, first heading + first paragraph, truncated marker), TRUST-01 empty probe (null page / empty markdown → []), determinism, Open Question 4 freshness curve"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "tests/core/context/trust/contextFeed.test.ts#pageToContextItems — CTX-01 metadata fill"
        status: pass
    human_judgment: false
  - id: D2
    description: "contextFeed.applySourceGates — D-4b-08 source-type gates: disabled kind → excluded Map with { reason: 'trust_disabled' }, enabled → included, unmapped kind → default-included, input order preserved"
    requirement: TRUST-03
    verification:
      - kind: unit
        ref: "tests/core/context/trust/contextFeed.test.ts#applySourceGates (D-4b-08 — gates at the feed boundary)"
        status: pass
    human_judgment: false
  - id: D3
    description: "contextReceipt.buildReceipt + TrustedFeedResult — D-4b-11 reconstruction contract (contextText recomputed from receipt equals packed text), Pattern 2 token semantics (originalTokens pre-wrap / finalTokens wrapped-or-0), quarantine + trust_disabled rows, R-10 raw-text-free, cache eligibility via CACHED_KINDS"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "tests/core/context/trust/contextReceipt.test.ts#D-4b-11 reconstruction contract"
        status: pass
    human_judgment: false
  - id: D4
    description: "ContextProvenanceManifest in-place extension — receipt: ContextReceiptEntry[] + counters (screened/quarantined/byTrust 5-key/totalIncludedTokens) on the interface AND the Zod schema (GR-4 lockstep); ContextOptimizer placeholder stamp + fixture sync keep tsc green at every boundary"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "tests/core/context/trust/qualityCounters.test.ts#extended ContextProvenanceManifestSchema (GR-4 lockstep — receipt + counters)"
        status: pass
    human_judgment: false
  - id: D5
    description: "CTX-06 counters — buildReceipt-derived counters carry screened/quarantined/byTrust (across ALL input items incl. excluded)/totalIncludedTokens; R-10: counters + receipt JSON never contain source bodies (T-4b-07)"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "tests/core/context/trust/qualityCounters.test.ts#R-10 — counters/receipt never carry the source body (T-4b-07)"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-08-13
status: complete
---

# Phase 04b Plan 03: Feed Conversion + Context Receipt Layer Summary

**Page-feed trust conversion (`contextFeed.pageToContextItems` with CTX-01 metadata + §22.2 structural budget cap + D-4b-08 source gates) and the reconstruction-sufficient context receipt (`contextReceipt.buildReceipt` + CTX-06 counters) with an in-place `ContextProvenanceManifest` extension, all pinned by 35 new tests and green at every tsc/vitest boundary.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-13T15:13:57Z
- **Completed:** 2026-08-13T15:30:45Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `pageToContextItems` converts a Phase-4a `PageContext` into a single trust-carrying `ContextItem` — `trust: 'retrieved'`, `instructionAuthority: false` (CTX-01 MUST-be-false stamped at conversion), `relevance: 1`, deterministic freshness from `extractedAt` via the Open Question 4 curve (injectable `nowMs`, no `Date.now`), `sensitivity: 'none'`, `sourceId: page.url`; null/undefined page and empty/whitespace markdown yield `[]` (TRUST-01 empty probe).
- `capToBudget` enforces the §22.2 2,000-token webpage budget STRUCTURALLY at the feed boundary (D-04-13 — never inside the optimizer): full text when within budget, otherwise first heading + first paragraph in document order, cut at paragraph boundaries only, `truncated: true` marker.
- `applySourceGates` (D-4b-08) excludes disabled source kinds BEFORE section conversion via `TrustPrefs` (`np_trust`), emitting the same structured `{ reason: 'trust_disabled' }` decisions map the receipt consumes with no conversion.
- `buildReceipt` + `TrustedFeedResult` ship the D-4b-11 reconstruction contract: one `ContextReceiptEntry` per input item (included AND excluded — D-4b-06 no-silent-drop), Pattern 2 token semantics (`originalTokens` pre-wrap, `finalTokens` wrapped-when-included / 0-when-excluded), R-10 raw-text-free rows, `cacheEligible` via the CACHED_KINDS-driven `kindStable` fn, and CTX-06 counters (`screened`/`quarantined`/`byTrust`/`totalIncludedTokens`). `contextText` = wrapped included items joined `\n\n` in deterministic input order.
- `ContextProvenanceManifest` extended IN PLACE (R-1/D-04-17): `receipt` + `counters` on the interface AND `ContextProvenanceManifestSchema` in lockstep (GR-4, z.record over the 5-member `TrustLevelSchema`); both surviving producers synced — `ContextOptimizer` placeholder stamp (04b-04 comment) and the fixture builder (`receipt: []` + zeroed counters) — so tsc stays green at every task boundary (04-03 precedent).
- All threat-model mitigations honored: T-4b-08 (gates at feed boundary), T-4b-07 (R-10 raw-text-free receipt/counters), T-4b-09 (additive extension + Zod gate), T-4b-01 (CTX-01 metadata + no-silent-drop enumeration).

## Task Commits

Each task was committed atomically:

1. **Task 1: contextFeed.ts — PageContext → ContextItem[] with budget cap + source gates** - `a30e9ef` (feat)
2. **Task 2: contextReceipt.ts builder + ContextProvenanceManifest in-place extension** - `d9ea4e6` (feat)

**Plan metadata:** (see docs commit below)

## Files Created/Modified

- `src/core/context/trust/contextFeed.ts` - `PAGE_BUDGET_TOKENS` (2_000), `pageToContextItems`, `capToBudget`, `applySourceGates`; CTX-01 metadata + §22.2 structural cap + D-4b-08 gates; deterministic freshness curve
- `src/core/context/contextReceipt.ts` - `TrustedFeedResult` + `buildReceipt`; O.3 wrap application, Pattern 2 token semantics, CTX-06 counters
- `src/core/context/ContextProvenanceManifest.ts` - in-place `receipt: ContextReceiptEntry[]` + `counters` interface fields and Zod schema fields (existing fields unchanged)
- `src/core/context/ContextOptimizer.ts` - placeholder `receipt: []` + zeroed counters in the provenance literal (04b-04 replaces)
- `tests/fixtures/optimizedContext.ts` - provenance builder emits `receipt: []` + zeroed counters (deterministic constants)
- `tests/core/context/trust/contextFeed.test.ts` - 14 tests (CTX-01 metadata, §22.2 cap, TRUST-01 empty probe, determinism, gates, freshness pins)
- `tests/core/context/trust/contextReceipt.test.ts` - 8 tests (reconstruction contract, quarantine/disabled rows, R-10, cache eligibility, token semantics, counters)
- `tests/core/context/trust/qualityCounters.test.ts` - 5 tests (schema positive/negative gates, counters shape, R-10)

## Decisions Made

- **buildReceipt owns the O.3 wrap (single wrap site for the feed):** items arrive PRE-wrap so Pattern 2 semantics (`originalTokens` = pre-wrap estimateTokens; `finalTokens` = wrapped) and the D-4b-11 reconstruction contract hold byte-exactly. The 04b-03 feed stamps `instructionAuthority:false`, so applyTrustPolicy's authority-strip wrap (04b-02) never fires on it — no double-wrap in the page-only pipeline; 04b-04 wires the stage ordering. This resolves the apparent tension between the RESEARCH sketch's "wrapped text present" comment and the plan's "pre-wrap" semantics: buildReceipt wraps internally, and the test's local O.3 wrap oracle (plan-local, no cross-plan import) verifies it independently.
- **capToBudget exported** (truncated marker is not representable on ContextItem — C.1 verbatim): the §22.2 cap contract is asserted through `capToBudget` directly, per the plan's "export a small marker type if a test needs the truncated flag" allowance.
- **contextText separator = `\n\n`** (ProviderRouter `joinSections` convention), so 04b-04's emitted context section is byte-identical to the receipt reconstruction.
- **compression stays unset on receipt entries in 04b-03** (optional C.1 field): buildReceipt has no visibility into the feed's cap result; the trust stage (04b-04) stamps `'structural'` when the feed marks truncation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Quality Gate] Prettier-normalized the four new 04b-03 files**
- **Found during:** Post-Task-2 verification (verify:phase-4b runs prettier --check in the §24 chain)
- **Issue:** `prettier --check` flagged 4 new files (long import lines / literal objects collapsed by prettier)
- **Fix:** `prettier --write` — formatting only, zero behavior change; tests re-verified green after
- **Files modified:** src/core/context/contextReceipt.ts, tests/core/context/trust/contextFeed.test.ts, tests/core/context/trust/contextReceipt.test.ts, tests/core/context/trust/qualityCounters.test.ts
- **Verification:** `prettier --check` clean; tsc exit 0; 27 trust tests green
- **Committed in:** `df2cabc` (style)

**2. [Rule 1 - Quality Gate] Dropped an unused `ALL_TRUE_PREFS` constant in contextReceipt.test.ts**
- **Found during:** eslint run on the touched files (§24 chain hygiene)
- **Issue:** `@typescript-eslint/no-unused-vars` error — the constant was never referenced (the disabled-gate test uses `PAGE_DISABLED_PREFS` only)
- **Fix:** Removed the declaration
- **Files modified:** tests/core/context/trust/contextReceipt.test.ts
- **Verification:** eslint clean; prettier clean; test file green
- **Committed in:** `929c849` (style)

---

**Total deviations:** 2 auto-fixed (both style/quality-gate, §24 chain hygiene)
**Impact on plan:** No functional impact — formatting/cleanup only; all behavior lands exactly as planned.

## Issues Encountered

None — the plan executed as written. (One self-corrected import-path typo — `../../fixtures` → `../../../fixtures` in the trust test directory — was caught by the failing test run before any commit and is not a deviation.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for **04b-04** (ContextOptimizer trust stage): `contextFeed` output (ContextItem[] with CTX-01 metadata + gates) feeds the classifier → quarantine → applyTrustPolicy → buildReceipt pipeline (D-4b-09); the manifest's new `receipt`/`counters` ride the SAME `OptimizedContext` the hook already returns — 04b-04 replaces the placeholder stamp with the real trust-stage output.
- The `{ reason: TrustOmitReason }` decisions map shape is the shared contract: `applySourceGates` emits `trust_disabled`, the 04b-04 quarantine stage writes `prompt_injection` — buildReceipt consumes one structured map with no conversion.
- 35 new tests (14 feed + 8 receipt + 5 counters + 8 existing manifest/optimizer suites still green) — full `tests/core/context` regression: 133 tests green; eslint + prettier clean on all touched files.

---
*Phase: 04b-trust-aware-context-and-receipts*
*Completed: 2026-08-13*

## Self-Check: PASSED

- Created files verified on disk: contextFeed.ts, contextReceipt.ts, 3 trust test files, SUMMARY.md — all FOUND
- Commits verified in git log: `a30e9ef` (feat Task 1), `d9ea4e6` (feat Task 2), `df2cabc` (style), `929c849` (style)
- Plan-level `<verification>` rerun green: contextFeed 14/14, receipt+counters 13/13, manifest 8/8, optimizer 18/18, `tsc --noEmit` exit 0
- Full `tests/core/context` regression: 9 files / 133 tests green; eslint + prettier clean on all touched files

