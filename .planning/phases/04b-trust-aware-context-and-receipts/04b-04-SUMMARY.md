---
phase: 04b-trust-aware-context-and-receipts
plan: 04
subsystem: security
tags: [trust, context-optimizer, prompt-injection, quarantine, stable-prefix, receipt, ctx-04]

# Dependency graph
requires:
  - phase: 04b-02
    provides: applyTrustPolicy (O.3) + classifyInjection + stripInvisibleUnicode (deterministic screener)
  - phase: 04b-03
    provides: pageToContextItems + applySourceGates (feed) + buildReceipt/TrustedFeedResult + in-place manifest receipt/counters extension
provides:
  - "ContextOptimizerInput.trustPrefs? — additive D-4b-08 seam (np_trust source-type gates passed in; output untouched)"
  - "ContextOptimizer.optimize() trust stage: pageContext → feed → classifier → quarantine → applyTrustPolicy → gates → contextText + receipt/counters stamped on EVERY return (D-4b-04/08/09, D-4b-10/11, GR-4)"
  - "CTX-04 stable-prefix snapshots (tests/core/context/trust/stablePrefix.test.ts): [SYSTEM] byte-identical with/without page, no wrap in system (F-5)"
  - "Quarantine-not-drop + malicious-fixture invariants (tests/security/prompt-injection/quarantine.test.ts, ROADMAP SC #1)"
affects:
  - 04b-05 (hook resolves page + trustPrefs and passes them in — the optimizer stays pure; TrustSettingsStore drives the gates)
  - 04b-06 (verify:phase-4b runs these suites)
  - Phase 6 (PromptInspector consumes the receipt reconstruction data, D-4b-11)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - trust stage = the D-4b-02/04/09 boundary: ContextItem[] → classifier → quarantine → policy → gates → contextText + receipt — the ONLY place trust logic runs (P4b-1)
    - ONE structured excluded: Map<string, { reason: TrustOmitReason }> accumulates both producers (prompt_injection + trust_disabled) — buildReceipt consumes it with no conversion
    - inline kindStable mirroring CACHED_KINDS (F-5, dependency-light — no ProviderRouter import in the optimizer)
    - ZEROED_COUNTERS fallback keeps the manifest schema-valid at every boundary (GR-4)

key-files:
  created:
    - tests/core/context/trust/stablePrefix.test.ts
    - tests/security/prompt-injection/quarantine.test.ts
  modified:
    - src/core/ai/types.ts (ContextOptimizerInput.trustPrefs? additive optional field)
    - src/core/context/ContextOptimizer.ts (buildTrustedContext trust stage + receipt/counters stamping + contextText threading)
    - tests/core/context/ContextOptimizer.test.ts (page-feed + drop-in + Pitfall 3 + trustPrefs.page:false cases)

key-decisions:
  - "trustPrefs.page:false (D-4b-08) → buildTrustedContext returns null → no context section + honestly EMPTY receipt (no fabricated rows) — Task 2 decision pinned by the ContextOptimizer.test.ts case"
  - "The trust stage returns null for any empty feed (no page / page disabled / empty markdown) → manifest carries receipt: [] + ZEROED_COUNTERS so the schema (GR-4) passes on EVERY return (T-4b-10)"
  - "kindStable is an inline predicate (kind === 'memory') with a CACHED_KINDS-naming comment instead of a ProviderRouter import — the optimizer stays dependency-light; the page feed is context-kind → never cache-eligible (F-5)"
  - "Multi-item ordering (TRUST-02) pinned at the stage's own pipeline primitives (pageToContextItems → applySourceGates → buildReceipt) in quarantine.test.ts — the optimizer's page feed is single-item, so the ordering guarantee is asserted where multiple items can actually flow"

patterns-established:
  - "Trust stage placement: between input and packSections at the top of optimize() — pure/synchronous/zero-model/zero-async/zero-chrome (module contract L31-32, Pitfall 5)"
  - "Quarantine-not-drop end-to-end: a classifier hit stays a ContextItem (receipt row included:false 'prompt_injection'), never a PromptSection — even a miss is inert after the O.3 authority strip (boundary, not filter recall — Pitfall 2)"
  - "Stable-prefix pinning: [SYSTEM] byte-identity across turns and with/without page feed, negative snapshot for the wrap marker (F-5 / Anthropic exact-prefix cache rule)"

requirements-completed: [TRUST-01, TRUST-02, TRUST-03]

coverage:
  - id: D1
    description: "ContextOptimizerInput.trustPrefs? — additive D-4b-08 optional field (inline type-only import, D-04-07 precedent); existing construction sites compile unchanged"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "pnpm exec tsc --noEmit (additive seam — all existing ContextOptimizerInput sites compile)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Trust stage inside optimize() — pageContext → pageToContextItems → classifyInjection (quarantine → excluded 'prompt_injection') → applyTrustPolicy (O.3 strip+wrap) → applySourceGates (D-4b-08 'trust_disabled', merged into ONE structured decisions map) → buildReceipt → contextText threads into ContextPackInput (context section stable:false, TASK_KINDS)"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#a page feed produces a wrapped context section (stable:false, TASK_KINDS)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Manifest carries receipt + CTX-06 counters on EVERY return (D-4b-10/11, GR-4) — real trust-stage values when a feed is packed, receipt: [] + ZEROED_COUNTERS otherwise (no-page / page-disabled paths stay schema-valid, T-4b-10)"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#pageContext:undefined stays byte-identical to the pre-4b output (drop-in regression, D-4a-06)"
        status: pass
    human_judgment: false
  - id: D4
    description: "CTX-04 stable-prefix snapshots (D-4b-12, tests/core/context/trust/stablePrefix.test.ts): [SYSTEM] byte-identical across equivalent turns AND with-vs-without page (Pitfall 1 guard, T-4b-05); negative snapshot — the wrap marker never enters the system section (F-5); positive — the wrapped context section is stable:false"
    requirement: TRUST-03
    verification:
      - kind: unit
        ref: "tests/core/context/trust/stablePrefix.test.ts#with pageContext → system section still equals the no-page baseline (Pitfall 1 guard)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Quarantine-not-drop + malicious-fixture invariants (ROADMAP SC #1, tests/security/prompt-injection/quarantine.test.ts): classifier hit → receipt row included:false 'prompt_injection', phrase absent from all sections; direct permission-grant quarantined; paraphrased miss still inert (wrapped context, no section instructs, [SYSTEM] unchanged — boundary not filter recall); TRUST-02 ordering probe; R-10 raw-text-free receipt/counters"
    requirement: TRUST-02
    verification:
      - kind: unit
        ref: "tests/security/prompt-injection/quarantine.test.ts#quarantine-not-drop (D-4b-06) — a classifier hit never becomes a PromptSection"
        status: pass
    human_judgment: false
  - id: D6
    description: "Drop-in identity regression preserved (D-4a-06): pageContext:undefined path byte-identical to pre-4b — the 04-04 PHASE3_SNAPSHOT assertion still passes untouched; trustPrefs.page:false → no context section + honest empty receipt (D-4b-08 Task 2 decision); Pitfall 3 included-row guard (receipt rows match the packed section text)"
    requirement: TRUST-03
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#Pitfall 3 guard: every receipt included:true row source text IS in the packed context section"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-08-13
status: complete
---

# Phase 04b Plan 04: Trust-Aware Optimizer Wiring Summary

**The trust pipeline lands inside `ContextOptimizer.optimize()` — pageContext → feed → deterministic classifier → quarantine → O.3 authority strip → source-type gates → wrapped context section + reconstruction-sufficient receipt/CTX-06 counters stamped on every manifest return — pinned by CTX-04 stable-prefix snapshots, quarantine/malicious-fixture invariants, and a preserved drop-in identity regression.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-13T15:41:37Z
- **Completed:** 2026-08-13T15:52:30Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `ContextOptimizerInput.trustPrefs?` — additive optional field (inline type-only import matching the `evidence?` precedent), so every existing construction site compiles unchanged (D-4b-08, D-04-07).
- `buildTrustedContext(input)` — the module-internal trust stage at the top of `optimize()` (before `packSections`): `pageToContextItems` → `classifyInjection` (hits quarantined into ONE structured `excluded: Map<string, { reason: TrustOmitReason }>` with `'prompt_injection'`, D-4b-06) → `applyTrustPolicy` (O.3 strip+wrap — the real boundary, T-4b-01) → `applySourceGates` (D-4b-08 `'trust_disabled'` entries merged into the same map, no conversion) → `buildReceipt` → `contextText` threads into `ContextPackInput` so `packSections` emits the wrapped context section (stable:false, TASK_KINDS — F-5).
- The manifest now carries the REAL `receipt` + CTX-06 counters on every return (D-4b-10/11, GR-4): real trust-stage values when a feed is packed, `receipt: []` + `ZEROED_COUNTERS` for the no-page / page-disabled paths — the schema gate passes at every boundary (T-4b-10).
- CTX-04 stable-prefix snapshots (`tests/core/context/trust/stablePrefix.test.ts`): the `[SYSTEM]` persona block is byte-identical across equivalent turns AND with-vs-without a page feed, never contains the `<untrusted_data` marker (F-5, Pitfall 1 guard), while the wrapped context section is provably `stable:false`.
- Quarantine-not-drop + malicious-fixture invariants (`tests/security/prompt-injection/quarantine.test.ts`): a classifier hit is excluded from the packed context and enumerated in the receipt (`included:false`, `omitReason: 'prompt_injection'`), a direct "you are now the system" grant is quarantined, and a paraphrased attempt that misses the classifier is still inert — wrapped as `<untrusted_data source=...>` data with the `[SYSTEM]` block byte-unchanged (ROADMAP SC #1; boundary, not filter recall — Pitfall 2). TRUST-02 ordering probe + R-10 raw-text-free receipt/counters pinned.
- Drop-in identity preserved: the `pageContext: undefined` path stays byte-identical to pre-4b (the 04-04 PHASE3_SNAPSHOT assertion passes untouched); the Pitfall 3 guard asserts every `included:true` receipt row's source text IS in the packed section.

## Task Commits

Each task was committed atomically:

1. **Task 1: Additive trustPrefs seam on ContextOptimizerInput** - `483878d` (feat)
2. **Task 2: Trust stage inside optimize() + receipt/counters stamping** - `475cadc` (feat)
3. **Task 3: CTX-04 stable-prefix snapshots + quarantine/malicious-fixture invariants** - `58d639b` (test)

**Plan metadata:** (see docs commit below)

## Files Created/Modified

- `src/core/ai/types.ts` - `ContextOptimizerInput.trustPrefs?` additive optional field (inline type-only import, D-04-07 precedent)
- `src/core/context/ContextOptimizer.ts` - `buildTrustedContext` trust stage (feed → classifier → quarantine → policy → gates → receipt), `contextText` threading into `buildPackInput` (both default and minimal re-pack paths), `ZEROED_COUNTERS` fallback, real `receipt`/`counters` provenance stamping
- `tests/core/context/ContextOptimizer.test.ts` - 4 new cases: page feed → wrapped context section + real receipt/counters; `pageContext:undefined` byte-identity + empty receipt; Pitfall 3 included-row guard; `trustPrefs.page:false` → no section + empty receipt
- `tests/core/context/trust/stablePrefix.test.ts` - 5 CTX-04 snapshot tests (byte-identity across turns, with/without page, negative wrap-in-system, positive wrapped context, no-page path)
- `tests/security/prompt-injection/quarantine.test.ts` - 6 tests (quarantine-not-drop, malicious-fixture hit/miss invariants, TRUST-02 ordering probe, R-10)

## Decisions Made

- **`trustPrefs.page:false` → honest empty receipt (Task 2 decision):** when the page source is disabled via np_trust, `buildTrustedContext` returns null — no context section AND no fabricated receipt rows; the manifest carries `receipt: []` + zeroed counters. This is the plan's "record the decision honestly" resolution, pinned by the ContextOptimizer.test.ts case.
- **Trust stage returns null for ANY empty feed** (no `pageContext`, page disabled, or empty markdown → `pageToContextItems` yields `[]`), unifying the no-page byte-identity path (D-4a-06) with the disabled-source path under one fallback stamp.
- **Inline `kindStable` mirroring CACHED_KINDS:** `(kind) => kind === 'memory'` with a comment naming `ProviderRouter.CACHED_KINDS` as the single source — keeps the optimizer dependency-light (the plan explicitly rejects the ProviderRouter import) while the page feed (context-kind) is always cache-ineligible (F-5).
- **TRUST-02 ordering probe pinned at the stage's own primitives:** the optimizer's page feed is single-item, so the multi-item ordering guarantee ("no sorting, no dedup; input order in contextText and receipt") is asserted in quarantine.test.ts over `pageToContextItems → applySourceGates → buildReceipt` — the exact call sequence the stage runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Quality Gate] Prettier-normalized two 04b-04 files**
- **Found during:** Post-Task-3 verification (verify:phase-4b runs `prettier --check` in the §24 chain — 04b-03 precedent)
- **Issue:** `prettier --check` flagged `src/core/context/ContextOptimizer.ts` (helper signature collapsed) and `tests/security/prompt-injection/quarantine.test.ts` (long serialized-JSON line)
- **Fix:** `prettier --write` — formatting only, zero behavior change; tsc + eslint + all 33 tests re-verified green after
- **Files modified:** src/core/context/ContextOptimizer.ts, tests/security/prompt-injection/quarantine.test.ts
- **Verification:** `prettier --check` clean; `tsc --noEmit` exit 0; 33 tests green
- **Committed in:** `58d639b` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 style/quality-gate, §24 chain hygiene)
**Impact on plan:** No functional impact — formatting only; all behavior lands exactly as planned.

## Issues Encountered

None — the plan executed as written.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for **04b-05** (hook wiring + TrustSettingsStore): the optimizer is fully trust-aware and pure — the hook only needs to resolve the two async inputs (`WorkspaceStore.currentPageContext`, `readTrustPrefs()`) and pass `pageContext` + `trustPrefs` into `optimize()` (Golden Rule 3 — no prompt assembly in the hook; D-4b-09). The `page:false` empty-receipt decision and the `{ reason: TrustOmitReason }` decisions-map contract are now pinned by tests.
- The `DEFAULT_TRUST_PREFS` all-true fallback and `applySourceGates` contract are exercised through the optimizer — 04b-05's TrustSettingsStore (Options switches) drives the same gates.
- Verification state: `tests/core/context` + `tests/security` regression 180/180 green (12 files); `tsc --noEmit`, eslint, prettier all clean; negative greps on ContextOptimizer.ts (no `chrome.`, no text-slice, no `await`) all 0.
- 33 new/updated tests across the three required files (22 optimizer incl. 4 new trust cases, 5 stable-prefix, 6 quarantine).

---
*Phase: 04b-trust-aware-context-and-receipts*
*Completed: 2026-08-13*

## Self-Check: PASSED

- Created files verified on disk: stablePrefix.test.ts, quarantine.test.ts, SUMMARY.md — all FOUND
- Modified files verified: src/core/ai/types.ts, src/core/context/ContextOptimizer.ts, tests/core/context/ContextOptimizer.test.ts — all present with changes
- Commits verified in git log: `483878d` (feat Task 1), `475cadc` (feat Task 2), `58d639b` (test Task 3)
- Plan-level `<verification>` rerun green: ContextOptimizer.test.ts 22/22, stablePrefix 5/5, quarantine 6/6, `tsc --noEmit` exit 0, negative greps (chrome./slice/await) all 0
- Full `tests/core/context` + `tests/security` regression: 12 files / 180 tests green; eslint + prettier clean on all touched files
