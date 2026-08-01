---
phase: 04b-trust-aware-context-receipts
plan: 01
subsystem: context-pipeline
tags: [context, trust, zod, provenance, receipt, prompt-injection, tracer]

# Dependency graph
requires:
  - phase: 04-context-optimization-pipeline
    provides: ContextOptimizer.optimize(), ContextProvenanceManifest, TokenBudget, PromptCacheAdapter hashStableSections, degradation pipeline
provides:
  - ContextItem wrapper contract + ContextItemSchema Zod gate (D-01, D-09)
  - ContextTrustPolicy singleton with assess/validate/upgrade (D-06, D-07, D-09)
  - ContextOptimizer.optimizeFromItems() — trust gating, data-section delimiter wrapping, deterministic ordering, receipt generation (D-01, D-02, D-03, D-06)
  - ContextReceiptEntry receipt fields on every provenance entry (D-03, CTX-T03)
  - End-to-end tracer test proving system instruction + data section flow through the full pipeline
affects: [04b-02, 04b-03, 04b-04, 04b-05, 04b-06, phase-05, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ContextItem wrapper: PromptSection-shaped payload + trust metadata; metadata stripped by unwrapToPromptSections() before providers (D-01)"
    - "Trust is policy-enforced, never self-assigned: ContextTrustPolicy.assess() derives verdict, validate() hard-rejects mismatches (D-06)"
    - "Data sections isolated in <data-source id=\"...\" kind=\"...\"> XML delimiters, always sorted after system instructions (D-02)"
    - "Receipts per original source: originalTokens vs finalTokens, included, omissionReason, cacheEligible (D-03)"

key-files:
  created:
    - src/core/context/ContextItem.ts
    - src/core/context/ContextTrustPolicy.ts
    - tests/core/context/tracer-pipeline.test.ts
  modified:
    - src/core/ai/types.ts
    - src/core/context/ContextOptimizer.ts
    - src/core/context/ContextProvenanceManifest.ts

key-decisions:
  - "ContextItem interface lives in ai/types.ts; ContextItemSchema (z.infer) lives in context/ContextItem.ts with a compile-time drift guard; types.ts re-exports schemas so consumers import from one place (D-01)"
  - "Secret gate at schema level: ContextItemSchema .refine() rejects sensitivity:secret AND optimizeFromItems() re-validates every item (D-09, T-04b-01)"
  - "Deterministic ordering: authority rank (system→user→data), then kind order, then sourceId alphabetical — stable for prompt caching (CTX-T04/D-16)"
  - "Dropped items still get receipts: included:false + omissionReason:'budget' — omission visibility is part of the receipt contract (CTX-T03)"
  - "Tracer feedback gate applied in autonomous form (plan marked autonomous:true; project human_verify_mode=end-of-phase): end-to-end tracer verify re-run after completion, passed — no mid-flight halt"

patterns-established:
  - "unwrapToPromptSections() is the single metadata-stripping seam — PromptSection stays untouched (D-01)"
  - "recordSection() delegates to recordSectionWithReceipt() — one receipt code path"
  - "Shared runDegradation() helper — optimize() and optimizeFromItems() use the identical degradation pipeline (D-07)"

requirements-completed: [CTX-T01, CTX-T02, CTX-T03]

coverage:
  - id: D1
    description: "ContextItem wrapper contract + ContextItemSchema with 0-1 bounded trust metadata and sensitivity:secret rejection (D-09), plus unwrapToPromptSections() metadata stripping"
    requirement: CTX-T01
    verification:
      - kind: unit
        ref: "tests/core/context/tracer-pipeline.test.ts#ContextItem contract (Task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ContextTrustPolicy singleton — assess() trust table (system 1.0 / user 0.9 / memory 0.8 / page 0.5 / tools 0.9 / default 0.3), validate() D-06 enforcement, upgrade() most-restrictive sensitivity"
    requirement: CTX-T01
    verification:
      - kind: unit
        ref: "tests/core/context/tracer-pipeline.test.ts#ContextTrustPolicy (Task 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ContextOptimizer.optimizeFromItems() — per-item schema + trust validation, data-section <data-source> delimiter wrapping, system→user→data ordering, unwrapped PromptSection output"
    requirement: CTX-T02
    verification:
      - kind: integration
        ref: "tests/core/context/tracer-pipeline.test.ts#optimizeFromItems() pipeline (Task 3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Context receipts — ContextReceiptEntry fields (originalTokens, finalTokens, included, omissionReason, cacheEligible) populated on every provenance entry via recordSectionWithReceipt()"
    requirement: CTX-T03
    verification:
      - kind: integration
        ref: "tests/core/context/tracer-pipeline.test.ts#manifest sections carry ContextReceiptEntry fields"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-01
status: complete
---

# Phase 04b Plan 01: Trust-Aware Context Pipeline Tracer Summary

**ContextItem contract (Zod-gated, D-09 secret rejection) + ContextTrustPolicy singleton (D-06/D-07) + ContextOptimizer.optimizeFromItems() with data-section delimiter isolation, deterministic system→user→data ordering, and per-source context receipts — proven end-to-end by a 22-test tracer suite**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-01T10:52:33Z
- **Completed:** 2026-08-01T11:00:30Z
- **Tasks:** 3 (6 commits — TDD RED/GREEN pairs)
- **Files modified:** 6 (2 created source, 3 modified source, 1 created test)

## Accomplishments

- **ContextItem wrapper contract (D-01):** `ContextItem` interface in `ai/types.ts`, `ContextItemSchema` Zod schema in `context/ContextItem.ts` — validates well-formed items, rejects out-of-range trust, and refuses `sensitivity: 'secret'` via `.refine()` (D-09). `unwrapToPromptSections()` strips all metadata so only the `PromptSection` fields ever reach providers.
- **ContextTrustPolicy singleton (D-06/D-07):** `assess()` derives trust/sensitivity/authority from a static source-type table (system 1.0/public, user 0.9, memory 0.8, page context 0.5, tool output 0.9, unknown 0.3); `validate()` hard-rejects self-assigned metadata; static `upgrade()` keeps the most restrictive sensitivity. Deterministic and LLM-independent.
- **Trust-aware optimizer entry (D-01/D-02/D-06):** `ContextOptimizer.optimizeFromItems(ContextItem[], input)` validates every item against the schema AND the policy verdict (SCHEMA_INVALID on mismatch), wraps data-authority sections in `<data-source id="{sourceId}.{index}" kind="{kind}">` delimiters before token estimation, re-sorts system→user→data (kind order, then sourceId alphabetical), then runs the unchanged degradation pipeline on the unwrapped PromptSection[].
- **Context receipts (D-03/CTX-T03):** `recordSectionWithReceipt()` populates `originalTokens`/`finalTokens`/`included`/`cacheEligible` (CJK-aware `TokenBudget.estimateTokens()`) on every provenance entry; items dropped by degradation still get `included: false` receipts with `omissionReason: 'budget'`. `ContextProvenanceManifest.sections` is now typed `ContextReceiptEntry[]`.
- **Tracer end-to-end proof:** system instruction + data page context flow through the full pipeline — trust assessment → validation → delimiter wrapping → receipt-populated manifest → unwrapped PromptSection — with correct ordering and receipt fields.

## Task Commits

Each task was committed atomically with TDD RED/GREEN pairs:

1. **Task 1: ContextItem + ContextReceiptEntry types + Zod schemas** — `5f37749` (test), `ce12684` (feat)
2. **Task 2: ContextTrustPolicy singleton** — `ddb0e3e` (test), `ff95c4e` (feat)
3. **Task 3: optimizeFromItems + receipts + tracer test** — `1817241` (test), `4914035` (feat)

**Verification:** `npx vitest run tests/core/context/tracer-pipeline.test.ts --reporter=verbose` → 22/22 pass; `npm run verify:phase-4` → tsc clean + 85/85 context tests pass; full suite 545 pass (6 pre-existing failures, see below).

## Files Created/Modified

- `src/core/ai/types.ts` - `Sensitivity`/`InstructionAuthority`/`OmissionReason` unions, `ContextItem` + `ContextReceiptEntry` interfaces, manifest sections retyped to `ContextReceiptEntry[]`, schema re-exports
- `src/core/context/ContextItem.ts` - `ContextItemSchema` (with D-09 secret `.refine()`), `SensitivitySchema`, `InstructionAuthoritySchema`, `unwrapToPromptSections()`, compile-time drift guard
- `src/core/context/ContextTrustPolicy.ts` - `TrustAssessment`, `ContextTrustPolicy` class + `contextTrustPolicy` singleton
- `src/core/context/ContextOptimizer.ts` - `optimizeFromItems()`, shared `runDegradation()` helper (optimize() behavior unchanged)
- `src/core/context/ContextProvenanceManifest.ts` - `recordSectionWithReceipt()`, `recordSection()` delegates to it
- `tests/core/context/tracer-pipeline.test.ts` - 22 tests: contract, policy, pipeline, tracer end-to-end + backstops

## Decisions Made

- **Schema/interface split:** interface in `ai/types.ts`, schema-inferred type in `context/ContextItem.ts`, with a compile-time assignability guard; `types.ts` re-exports schema values so consumers import from one place. `PromptSection` itself stays untouched (D-01).
- **Deterministic ordering:** authority rank first (system→user→data per D-02), then kind order, then sourceId alphabetical — required by the cache-stability contract (CTX-T04/D-16) and pinned by a backstop test.
- **Delimiter id format:** `{sourceId}.{index}` with a per-source deterministic index (test-pinned as `context.page.current-url.0`), `kind` as XML attribute — matches the plan's test contract.
- **Omission receipts:** dropped items produce `included: false` + `omissionReason: 'budget'` entries so omitted sources stay visible to the user (CTX-T03).
- **Tracer gate (autonomous form):** plan is `autonomous: true` and the project uses `human_verify_mode: end-of-phase` (checkpoints.md #3309 — mid-flight human-verify halts suppressed), so the tracer feedback gate was applied as an end-to-end verify re-run after the full slice: passed (`⚡ Tracer verified end-to-end`). No mid-flight halt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] recordSection() receipt fields landed in Task 1, not Task 3**
- **Found during:** Task 1 (manifest type change)
- **Issue:** Retyping `ContextProvenanceManifest.sections` to `ContextReceiptEntry[]` broke `recordSection()` compilation — its entries lacked the four required receipt fields. The plan placed the fix in Task 3 Part A.
- **Fix:** Applied the planned defaults immediately (`originalTokens === finalTokens`, `included: true`, `cacheEligible: false`); Task 3 then extracted `recordSectionWithReceipt()` with `recordSection()` delegating — exactly the plan's Part A design.
- **Files modified:** src/core/context/ContextProvenanceManifest.ts
- **Verification:** tsc clean; all 85 context tests pass (existing tests assert individual entry fields, no exact-shape assertions broken)
- **Committed in:** ce12684 (Task 1 commit)

**2. [Rule 3 - Blocking] Test file creation moved into Task 1's TDD RED**
- **Found during:** Task 1 (tracer verify references a non-existent test file)
- **Issue:** Task 1's `<verify>` runs vitest on `tests/core/context/tracer-pipeline.test.ts`, but the plan only lists the test file under Tasks 2/3 files.
- **Fix:** Created the test file in Task 1's RED phase with the Task 1 behavior tests; Tasks 2/3 appended their blocks. This is the standard TDD flow and the file is listed in the plan-level `files_modified`.
- **Files modified:** tests/core/context/tracer-pipeline.test.ts
- **Verification:** RED (module not found) → GREEN (5/5 pass)
- **Committed in:** 5f37749 (Task 1 RED commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking — required for compilation and verification to function). No scope creep; no new dependencies.

## Issues Encountered

- **Pre-existing test failures (out of scope, documented):** `tests/core/ai/StreamAdapter.test.ts` (2) and `tests/core/ai/providers/ProviderAdapter.test.ts` (4) fail with `capturedOnChunk is not a function` / `client.chat is not a function` — Phase 03 `@ai-sdk` provider SDK API drift. Reproduced identically on pristine HEAD (1b7725a) in an isolated worktree. Zero overlap with 04b files. Already tracked in WINDOWS.md (entries 1-2) and prior phase deferred-items; logged to `04b-trust-aware-context-receipts/deferred-items.md`. Not fixed per scope boundary.
- No other issues — plan executed as written.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **04b-02** can extend the full 8-type trust table and stable-prefix contract on top of the proven `ContextTrustPolicy` + `optimizeFromItems()` seam.
- **04b-03/04b-04** can build receipt consumers (omission telemetry, cache eligibility) on the `ContextReceiptEntry` fields now populated everywhere.
- **04b-05/04b-06** can harden delimiter injection (T-04b-02/CTX-T02 exhaustive fixtures are explicitly deferred to 04b-06 per the threat register).
- **Phase 5+** source adapters migrate from raw `ContextOptimizerInput` to `ContextItem[]` via the new entry point; legacy `optimize()` remains functional until then.

---
*Phase: 04b-trust-aware-context-receipts*
*Completed: 2026-08-01*

## Self-Check: PASSED

- All 6 source/test files present (types.ts, ContextItem.ts, ContextTrustPolicy.ts, ContextOptimizer.ts, ContextProvenanceManifest.ts, tracer-pipeline.test.ts)
- All 6 task commits verified in git history (5f37749, ce12684, ddb0e3e, ff95c4e, 1817241, 4914035)
- Tracer file: 22/22 tests pass; verify:phase-4: tsc clean + 85/85 context tests pass
- SUMMARY.md + deferred-items.md written to the phase directory

