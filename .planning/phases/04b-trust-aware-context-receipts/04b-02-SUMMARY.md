---
phase: 04b-trust-aware-context-receipts
plan: 02
subsystem: context-pipeline
tags: [context, trust, freshness, ttl, exponential-decay, d-07, d-10]

# Dependency graph
requires:
  - phase: 04b-01
    provides: ContextTrustPolicy tracer singleton (assess/validate/upgrade), ContextItem contract, ContextOptimizer.optimizeFromItems() trust gating
provides:
  - Full static source-type table in ContextTrustPolicy.assess() covering all 8 D-07 source types with known-domain vs unknown-domain page heuristic
  - ContextFreshnessPolicy singleton — exponential decay freshness (D-10) with per-source TTLs, hard expiry enforcement, Infinity-TTL system sources
  - 24 fixture tests: 15 trust policy (8 types, validate, upgrade) + 9 freshness (decay math, TTL boundaries, expiresAt, mocked clock)
affects: [04b-03, 04b-04, 04b-05, 04b-06, phase-05, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static source-type table: known-domain set (context.page.current/current-url) distinguishes 0.5 vs 0.3 unknown-domain page trust — programmatic policy, not user-configurable (D-07)"
    - "Freshness: hard expiry (expiresAt passed → 0) BEFORE decay math — expired items omitted as stale, not merely scored low (D-10)"
    - "TTL resolution: most-specific sourceId prefix → kind fallback → default; deterministic, module-level readonly constants (T-04b-07 accept)"
    - "vi.useFakeTimers() + fixed system time for deterministic Date.now() decay tests"

key-files:
  created:
    - src/core/context/ContextFreshnessPolicy.ts
    - tests/core/context/ContextTrustPolicy.test.ts
    - tests/core/context/ContextFreshnessPolicy.test.ts
  modified:
    - src/core/context/ContextTrustPolicy.ts
    - tests/core/context/tracer-pipeline.test.ts

key-decisions:
  - "Known-domain page heuristic: only the standard ContextOptimizer sourceIds ('context.page.current', 'context.page.current-url') get trust 0.5; every other context.page.* sourceId is an unknown-looking domain → 0.3 (D-07), keeping the policy programmatic and fixture-pinned"
  - "TTL resolution order: sourceId prefix (persona → memory.episodic → memory.fact → context.page.cached → context.page.current → tools) beats kind fallback, so adapter-specific labels like 'tool_result'/'memory_fact' still resolve via their canonical sourceId prefixes"
  - "kind 'context' fallback maps to page.current TTL (120s) — page content is the canonical context source; page.cached (600s) is reachable only via the explicit 'context.page.cached' sourceId prefix"
  - "compute() returns 1.0 for undefined createdAt — no creation timestamp means no evidence of age, treated as fresh (D-10); negative age clamped to 0 via Math.max"

patterns-established:
  - "ContextTrustPolicy and ContextFreshnessPolicy are both pure deterministic singletons — same inputs, same outputs, no caching side-effects, no LLM dependency"
  - "Fixture builder makeItem(overrides) pattern for trust-policy items; fixed-clock (vi.setSystemTime) pattern for all time-dependent decay tests"

requirements-completed: [CTX-T01]

coverage:
  - id: D1
    description: "ContextTrustPolicy full static source-type table — all 8 D-07 types (system/persona/tool_schemas/preferences 1.0, user_input 0.9, memory 0.8, known-domain page 0.5, verified tools 0.9, unknown-domain page + unknown default 0.3), validate() no-self-assignment enforcement, upgrade() most-restrictive-wins"
    requirement: CTX-T01
    verification:
      - kind: unit
        ref: "tests/core/context/ContextTrustPolicy.test.ts#ContextTrustPolicy.assess() — full static source-type table (D-07)"
        status: pass
      - kind: unit
        ref: "tests/core/context/ContextTrustPolicy.test.ts#ContextTrustPolicy.validate() — policy-enforced, never self-assigned (D-06)"
        status: pass
      - kind: unit
        ref: "tests/core/context/ContextTrustPolicy.test.ts#ContextTrustPolicy.upgrade() — most restrictive always wins (D-09)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ContextFreshnessPolicy — exponential decay compute() with per-source TTLs: Infinity-TTL system/persona → 1.0, ageMs===ttlMs → ~0.368, hard expiry (expiresAt passed) → 0 before decay, undefined createdAt → fresh, asymptotic non-negative decay, page 0-age → 1.0, memory fact 30min/60min → ~0.6065"
    requirement: CTX-T01
    verification:
      - kind: unit
        ref: "tests/core/context/ContextFreshnessPolicy.test.ts#ContextFreshnessPolicy.compute() — exponential decay (D-10)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-01
status: complete
---

# Phase 04b Plan 02: Full Trust Table + Freshness Policy Summary

**Full D-07 static source-type table in ContextTrustPolicy (8 types incl. known-domain heuristic 0.5/0.3) + new ContextFreshnessPolicy singleton with exponential decay, per-source TTLs, and hard expiry — 24 new fixture tests, all deterministic and LLM-independent**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-01T11:03:23Z
- **Completed:** 2026-08-01T11:05:50Z
- **Tasks:** 2 (4 commits — TDD RED/GREEN pairs)
- **Files modified:** 5 (2 source, 3 test)

## Accomplishments

- **Full static source-type table (D-07):** `ContextTrustPolicy.assess()` now covers all 8 source types — system/tool_schemas/preferences/persona → `{1.0, public, system}`, user_input → `{0.9, private, user}`, memory → `{0.8, private, data}`, known-domain page → `{0.5, private, data}`, verified tool output → `{0.9, private, data}`, unknown-domain page + unknown sources → `{0.3, private, data}`. The known-vs-unknown distinction is a programmatic heuristic: only the standard ContextOptimizer sourceIds (`context.page.current`, `context.page.current-url`) are known-domain; any other `context.page.*` defaults to 0.3.
- **validate()/upgrade() retained and fixture-pinned (D-06/D-09):** `validate()` hard-rejects any item whose trust/sensitivity/authority differ from the policy verdict (self-assigned trust never accepted); `upgrade()` always returns the most restrictive sensitivity (`confidential` survives `private`, `secret` survives `public`).
- **ContextFreshnessPolicy (D-10):** new singleton with `compute(sourceId, kind, createdAt?, expiresAt?)` = `Math.exp(-ageMs/ttlMs)`. Hard expiry checked first — `expiresAt` passed → 0 (item omitted as stale, not merely scored low). TTL resolution is most-specific sourceId prefix → kind fallback → default: persona/system/tool_schemas/preferences Infinity (never decay), tool_result 60s, page.current 120s, page.cached 600s, memory.fact 1h, memory.episodic 30min, user_input/default 5min.
- **Deterministic fixture suites:** 24 tests use `makeItem()` fixture builder (trust) and `vi.useFakeTimers()` fixed clock (freshness) — no wall-clock races, `toBeCloseTo(…, 2)` for repeating-decimal decay math.

## Task Commits

Each task was committed atomically with TDD RED/GREEN pairs:

1. **Task 1: Expand ContextTrustPolicy to full static source-type table (D-07)** — `ae0f553` (test), `f9b355d` (feat)
2. **Task 2: Create ContextFreshnessPolicy with exponential decay (D-10)** — `444b9b7` (test), `3f9b153` (feat)

**Verification:** `npx vitest run tests/core/context/ContextTrustPolicy.test.ts tests/core/context/ContextFreshnessPolicy.test.ts --reporter=verbose` → 24/24 pass; `npx vitest run tests/core/context` → 109/109 pass (85 prior + 24 new, no regressions); `npx tsc --noEmit` clean.

## Files Created/Modified

- `src/core/context/ContextTrustPolicy.ts` - Expanded `assess()` to the full 8-type D-07 table; `KNOWN_PAGE_SOURCE_IDS` known-domain set (0.5 vs 0.3); persona sourceId prefix classified at system trust; validate()/upgrade() unchanged
- `src/core/context/ContextFreshnessPolicy.ts` - New: `FreshnessTTL`, `ContextFreshnessPolicy` class (compute/getTTL) + `contextFreshnessPolicy` singleton; module-level readonly TTL constants
- `tests/core/context/ContextTrustPolicy.test.ts` - New: 15 fixture tests — 10 assess() source-type cases, 2 validate() cases, 3 upgrade() cases; `makeItem()` builder
- `tests/core/context/ContextFreshnessPolicy.test.ts` - New: 9 decay tests on a fixed fake clock (Infinity TTL, exp(-1)/exp(-0.5), hard expiry, undefined createdAt, asymptotic decay, 0-age, memory fact half-life)
- `tests/core/context/tracer-pipeline.test.ts` - Ordering-test fixture updated: `context.page.alpha-url`/`other-url` items now carry trust 0.3 (policy-correct metadata for unknown domains)

## Decisions Made

- **Known-domain heuristic (D-07):** only `context.page.current` / `context.page.current-url` are known-domain → 0.5; all other `context.page.*` → 0.3. This is a programmatic policy pinned by fixtures, not user-configurable — the plan's exact instruction.
- **TTL prefix order:** `memory.episodic` before `memory.` (episodic beats generic facts); `context.page.cached` before `context.page` (cached pages beat the current-page TTL); `persona.` first so persona never decays regardless of kind.
- **Kind fallback:** `kind in TTLS` maps 'system'/'tool_schemas'/'preferences'/'user_input' to Infinity/300s and 'context' to page.current (120s); labels like `memory_fact`/`tool_result` resolve via sourceId prefix instead. Default 300s for anything else.
- **No created-timestamp → fresh:** `createdAt === undefined` returns 1.0 (D-10); negative ages clamp to 0 so decay output is always in [0, 1].

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tracer ordering-test fixture carried pre-expansion trust metadata**
- **Found during:** Task 1 GREEN (verify run)
- **Issue:** The 04b-01 tracer test `equal-trust data sections order deterministically` spread `DATA_ITEM` (trust 0.5) onto sourceIds `context.page.alpha-url`/`other-url` — under the new full D-07 table those are unknown domains assessing to 0.3, so `optimizeFromItems()` correctly rejected them with `SCHEMA_INVALID`. The policy change was intended; the fixture was stale.
- **Fix:** Overrode `trust: 0.3` on both items so the fixture carries the policy verdict for unknown-domain pages — the test still exercises exactly what it always tested (deterministic sourceId-alphabetical ordering of equal-trust items).
- **Files modified:** tests/core/context/tracer-pipeline.test.ts
- **Verification:** tracer suite 22/22 pass with the new policy; all 109 context tests pass; tsc clean.
- **Committed in:** f9b355d (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test fixture aligned with the intended D-07 policy expansion; no production logic change beyond the plan's spec).
**Impact on plan:** No scope creep, no new dependencies, no interface changes.

## Issues Encountered

- None — both tasks executed as planned. The pre-existing Phase 03 provider-SDK failures (`StreamAdapter.test.ts` 2, `ProviderAdapter.test.ts` 4) remain out of scope and untouched (documented in 04b-01-SUMMARY.md + WINDOWS.md).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **04b-03/04b-04** can call `contextTrustPolicy.assess()` as the authority for adapter-created ContextItems and `contextFreshnessPolicy.compute()` for the staleness pass — both APIs are now complete and fixture-proven; `getTTL()` prefix semantics give adapters a stable contract for choosing sourceIds.
- **04b-05** (omission receipts) can key off freshness 0 → 'stale' omission without additional policy work.
- **Threat register:** T-04b-06 (spoofed prefix) and T-04b-07 (TTL tampering) remain accepted — sourceId prefix matching is bounded, TTLs are module-level readonly constants. T-04b-08 (sensitivity downgrade) remains mitigated by the unchanged `upgrade()` path — the optimizer wiring lands in 04b-04.

---
*Phase: 04b-trust-aware-context-receipts*
*Completed: 2026-08-01*

## Self-Check: PASSED

- All 5 files present (ContextTrustPolicy.ts, ContextFreshnessPolicy.ts, ContextTrustPolicy.test.ts, ContextFreshnessPolicy.test.ts, tracer-pipeline.test.ts)
- All 4 task commits verified in git history (ae0f553, f9b355d, 444b9b7, 3f9b153)
- 24/24 new policy tests pass; 109/109 context tests pass; tsc clean
- SUMMARY.md written to the phase directory
