---
phase: 04b-trust-aware-context-receipts
plan: 05
subsystem: context-pipeline
tags: [context, stable-prefix, fnv1a, prompt-cache, snapshot-tests]

# Dependency graph
requires:
  - phase: 04b-trust-aware-context-receipts
    plan: 01
    provides: ContextOptimizer.optimizeFromItems(), ContextItem schema gate, deterministic section ordering (D-02), receipts (D-03)
  - phase: 04-context-optimization-pipeline
    provides: hashStableSections() FNV-1a (PromptCacheAdapter), cacheMetadata contract (D-13, D-16), degradation pipeline
provides:
  - computeStablePrefix() — combined FNV-1a hash + per-section diagnostic hashes (CTX-T04, D-04)
  - cacheMetadata.perSectionHashes on OptimizedContext — drift diagnostics for the stable-prefix contract
  - First snapshot tests in the codebase (Vitest __snapshots__) guarding stable-prefix byte-stability
affects: [04b-06, phase-06 (diagnostics), prompt-cache cross-turn hit detection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stable-prefix contract: combinedHash = FNV-1a of stable section texts joined with '\\u0000' separators; perSectionHashes = one FNV-1a per stable section keyed by sourceId; volatile sections never participate (CTX-T04, D-04)"
    - "FNV-1a is NEVER reimplemented — computeStablePrefix() reuses hashStableSections() from PromptCacheAdapter; combinedHash === cacheKeyHash by construction"
    - "Snapshot guards (toMatchSnapshot) as the drift tripwire: byte-level changes (whitespace, ordering, content) in stable sections change the hash and fail the snapshot — the deliberate fix is text update + snapshot regeneration (T-04b-16, accepted)"

key-files:
  created:
    - tests/core/context/stable-prefix.test.ts
    - tests/core/context/__snapshots__/stable-prefix.test.ts.snap
  modified:
    - src/core/context/ContextOptimizer.ts
    - src/core/ai/types.ts

key-decisions:
  - "Per-section hashes integrated into existing cacheMetadata (cacheKeyHash + stableSectionCount + perSectionHashes) instead of a duplicate stablePrefix field — combinedHash IS cacheKeyHash (same FNV-1a over same stable text), per plan's agent-discretion integration option"
  - "computeStablePrefix() wired into BOTH optimize() and optimizeFromItems() final steps — one construction path, identical cacheMetadata shape from both entry points"
  - "D-02 deterministic ordering governs perSectionHashes order in optimizeFromItems() (kind group, then sourceId alphabetical) — integration test pins alphabetical order, not input order"
  - "Snapshot tests use file-based toMatchSnapshot (not inline) — first snapshots in the codebase; Vitest created __snapshots__/ automatically"
  - "Integration test added beyond the plan's 10 behavior tests: optimizeFromItems() must populate cacheMetadata.perSectionHashes (success criteria requirement)"

requirements-completed: [CTX-T04]

coverage:
  - id: SP1
    description: "computeStablePrefix() — deterministic combined FNV-1a hash of stable sections; volatile sections (user_input, memory, context, task) excluded; stableSectionCount reflects only stable:true sections"
    requirement: CTX-T04
    verification:
      - kind: unit
        ref: "tests/core/context/stable-prefix.test.ts#Tests 1-2, 10"
        status: pass
    human_judgment: false
  - id: SP2
    description: "Byte-level sensitivity — text, whitespace, and ordering changes all produce different combinedHash (FNV-1a is byte-level)"
    requirement: CTX-T04
    verification:
      - kind: unit
        ref: "tests/core/context/stable-prefix.test.ts#Tests 3-5"
        status: pass
    human_judgment: false
  - id: SP3
    description: "perSectionHashes diagnostics — length === stable section count, each entry {sourceId, hash}; identical configs produce byte-identical hashes (persona/system)"
    requirement: CTX-T04
    verification:
      - kind: unit
        ref: "tests/core/context/stable-prefix.test.ts#Tests 6, 9"
        status: pass
    human_judgment: false
  - id: SP4
    description: "Snapshot guards — combinedHash and perSectionHashes pinned by toMatchSnapshot; any accidental stable-section drift fails the suite"
    requirement: CTX-T04
    verification:
      - kind: unit
        ref: "tests/core/context/stable-prefix.test.ts#Tests 7-8 (snapshots)"
        status: pass
    human_judgment: false
  - id: SP5
    description: "optimizeFromItems() integration — cacheMetadata.perSectionHashes populated from computeStablePrefix() in the final return; cacheKeyHash remains a valid FNV-1a hex"
    requirement: CTX-T04
    verification:
      - kind: integration
        ref: "tests/core/context/stable-prefix.test.ts#optimizeFromItems() integration test"
        status: pass
    human_judgment: false

metrics:
  duration: 6 min
  completed_date: 2026-08-01
  tasks: 1
  files: 4
status: complete
---

# Phase 04b Plan 05: Stable-Prefix Contract Summary

Stable-prefix contract (CTX-T04/D-04): `computeStablePrefix()` on ContextOptimizer computes a deterministic combined FNV-1a hash of all stable sections plus per-section diagnostic hashes, wired into `cacheMetadata.perSectionHashes` in both entry points, with the codebase's first Vitest snapshot tests guarding byte-level drift.

## What Was Built

**`computeStablePrefix(sections)`** (public method on `ContextOptimizer`):
- Filters to `stable: true` sections only — volatile sections (user_input, memory, context page, task, timestamps, scores, lifecycle fields) are excluded from hash computation
- `combinedHash` = `hashStableSections(stableSections)` — the existing FNV-1a from `PromptCacheAdapter` (never reimplemented), joined with `'\u0000'` separators
- `perSectionHashes` = one single-section FNV-1a per stable section, keyed by `sourceId`, for drift diagnostics
- `stableSectionCount` = number of stable sections

**Integration:** `optimize()` and `optimizeFromItems()` both build `cacheMetadata` through `computeStablePrefix()` as the final step — `cacheKeyHash` is the same value as `combinedHash` (identical FNV-1a over identical stable text), so the combined hash is not duplicated; instead `perSectionHashes` was added to the `cacheMetadata` type in `src/core/ai/types.ts` (optional field, additive — no consumers broken).

**Tests:** `tests/core/context/stable-prefix.test.ts` — 10 behavior tests + 1 integration test, all passing. First snapshot tests in the codebase (`__snapshots__/stable-prefix.test.ts.snap`) pin `combinedHash` and `perSectionHashes` against accidental drift.

## TDD Gate Compliance

- RED gate: `f031433 test(04b-05): add failing tests for stable-prefix contract` — all 11 tests failed before implementation (computeStablePrefix missing, perSectionHashes undefined)
- GREEN gate: `4e9e247 feat(04b-05): implement stable-prefix contract in ContextOptimizer` — all 11 tests pass after implementation
- REFACTOR: none needed — implementation is minimal and clean

## Deviations from Plan

None of consequence — plan executed as written. One test-side correction during RED: the integration fixture initially carried `sensitivity: 'public'` on a user_input item, which the ContextTrustPolicy verdict (D-07: user_input → private) correctly rejected; the fixture was fixed to match the policy verdict. The integration test's expected ordering was corrected to D-02 deterministic ordering (kind group, then sourceId alphabetical) after observing the actual sort — behavior matches the plan contract, the test expectation was wrong, not the code.

## Threat Surface

No new threat flags. The threat model's two `accept` dispositions hold:
- T-04b-16 (encoding drift): FNV-1a is byte-level; snapshot tests catch drift; fix is deliberate text update + snapshot regeneration
- T-04b-17 (per-section hash disclosure): per-section hashes are irreversible FNV-1a hex, diagnostic metadata only — not security-sensitive

## Verification Results

- `npx vitest run tests/core/context/stable-prefix.test.ts --reporter=verbose` → 11/11 passed (plan verify command)
- `npx vitest run tests/core/context` → 120/120 passed (no regressions in context pipeline)
- `npx tsc --noEmit` → clean

## Self-Check

- [x] `src/core/context/ContextOptimizer.ts` modified — computeStablePrefix() + wiring (commit 4e9e247)
- [x] `tests/core/context/stable-prefix.test.ts` created (commit f031433, updated 4e9e247)
- [x] `tests/core/context/__snapshots__/stable-prefix.test.ts.snap` created (commit 4e9e247)
- [x] `src/core/ai/types.ts` modified — cacheMetadata.perSectionHashes (commit 4e9e247)

## Self-Check: PASSED
