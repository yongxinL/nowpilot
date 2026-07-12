---
phase: 03-cost-effective-ai-runtime
plan: 04
subsystem: router
tags: [circuit-breaker, tier-resolver, provider-router, state-machine, fallback, tdd]

# Dependency graph
requires:
  - phase: 03-02
    provides: ProviderRegistry with ProviderConfig/ModelEntry/CostTier types
  - phase: 03-03
    provides: ToolRegistry/PermissionService singleton patterns
provides:
  - CircuitBreaker class — CLOSED→OPEN→HALF_OPEN state machine per D-10
  - TierResolver class — maps CostTier to sorted (providerId, modelId) array
  - ProviderRouter class+singleton — bounded fallback chain (max 3) with circuit breaker integration per D-11
  - Retry policy — isRetryableError checks against TIMEOUT/NETWORK/PROVIDER_5XX/RATE_LIMITED per D-09
affects:
  - Phase 03-05 PromptCache (consumes ProviderRouter for model selection)
  - Phase 03-06 PlannerService (consumes providerRouter.selectModel)
  - Phase 03-07 ExecutorService (consumes providerRouter.selectModel)
  - Phase 03-08 RendererService (consumes providerRouter.selectModel)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Stateful utility class with config-driven constructor (CircuitBreaker) — matches RateLimiter pattern (PATTERNS.md item 7)
    - Pure lookup class (TierResolver) with constructor DI — matches PATTERNS.md item 6
    - Class+singleton service (ProviderRouter) with constructor DI — matches PATTERNS.md item 5
    - Bounded fallback iteration capped at 3 attempts (ProviderRouter.selectModel)
    - TDD cycle applied to both tasks (RED→GREEN commits per task)

key-files:
  created:
    - src/core/ai/router/CircuitBreaker.ts
    - src/core/ai/router/TierResolver.ts
    - src/core/ai/router/ProviderRouter.ts
    - tests/core/ai/router/CircuitBreaker.test.ts
    - tests/core/ai/router/TierResolver.test.ts
    - tests/core/ai/router/ProviderRouter.test.ts
  modified: []

key-decisions:
  - "CircuitBreaker uses config-driven constructor (Partial<CircuitBreakerConfig>) with defaults: failureThreshold=3, failureWindowMs=60000, cooldownMs=300000 — matches RateLimiter pattern"
  - "CircuitBreaker has no debugLog calls — caller (ProviderRouter) handles logging"
  - "TierResolver is a pure lookup class with no singleton — created internally by ProviderRouter or DI"
  - "ProviderRouter uses separate value imports for singleton wiring (providerRegistry, CircuitBreaker class, TierResolver class) to avoid type/vs-value import issues"
  - "Retryable error types defined as const array for type safety; isRetryableError checks both code and message fields"

patterns-established:
  - "Pattern: Router components use bounded iteration with Math.min(chain.length, 3) for fallback chain capping"
  - "Pattern: CircuitBreaker uses Date.now() for timestamps, designed for vi.useFakeTimers() testing"
  - "Pattern: ProviderRouter.selectModel returns null on exhaustion (not throw) — callers handle no-provider case"

requirements-completed:
  - PROV-06
  - PROV-07

# Coverage metadata
coverage:
  - id: D1
    description: "CircuitBreaker state machine — CLOSED→OPEN→HALF_OPEN→CLOSED/OPEN with per-provider isolation"
    requirement: PROV-06
    verification:
      - kind: unit
        ref: "tests/core/ai/router/CircuitBreaker.test.ts#CircuitBreaker"
        status: pass
    human_judgment: false

  - id: D2
    description: "Circuit opens at 3 failures/60s window, cooldown 5min, probe via HALF_OPEN"
    requirement: PROV-06
    verification:
      - kind: unit
        ref: "tests/core/ai/router/CircuitBreaker.test.ts#after 3 recordFailure calls within 60s window, isOpen returns true"
        status: pass
      - kind: unit
        ref: "tests/core/ai/router/CircuitBreaker.test.ts#after 5 minutes cooldown, isOpen returns false and transitions to HALF_OPEN"
        status: pass
      - kind: unit
        ref: "tests/core/ai/router/CircuitBreaker.test.ts#recordSuccess transitions back to CLOSED"
        status: pass
      - kind: unit
        ref: "tests/core/ai/router/CircuitBreaker.test.ts#recordFailure transitions to OPEN"
        status: pass
    human_judgment: false

  - id: D3
    description: "TierResolver maps CostTier to sorted (providerId, modelId) array by preferredProviders order"
    requirement: PROV-07
    verification:
      - kind: unit
        ref: "tests/core/ai/router/TierResolver.test.ts#resolve returns models sorted by preferredProviders order"
        status: pass
    human_judgment: false

  - id: D4
    description: "ProviderRouter bounded fallback chain (max 3), circuit breaker integration, error handling"
    requirement: PROV-07
    verification:
      - kind: unit
        ref: "tests/core/ai/router/ProviderRouter.test.ts#selectModel returns first available provider+model"
        status: pass
      - kind: unit
        ref: "tests/core/ai/router/ProviderRouter.test.ts#skips providers with open circuit breakers"
        status: pass
      - kind: unit
        ref: "tests/core/ai/router/ProviderRouter.test.ts#fallback chain capped at 3 attempts"
        status: pass
      - kind: unit
        ref: "tests/core/ai/router/ProviderRouter.test.ts#selectModel cuts chain at 3 even if tierResolver returns more"
        status: pass
    human_judgment: false

  - id: D5
    description: "Retry policy — getRetryableErrors returns known types, isRetryableError checks code/message"
    requirement: PROV-07
    verification:
      - kind: unit
        ref: "tests/core/ai/router/ProviderRouter.test.ts#getRetryableErrors returns retryable error types"
        status: pass
      - kind: unit
        ref: "tests/core/ai/router/ProviderRouter.test.ts#isRetryableError returns true for known error types"
        status: pass
    human_judgment: false

# Metrics
duration: 3 min
completed: 2026-07-12
status: complete
---

# Phase 03 Plan 04: ProviderRouter with Circuit Breaker, TierResolver, and Fallback Chain

**CircuitBreaker state machine (CLOSED→OPEN→HALF_OPEN), TierResolver for cost-tier model lookup, and ProviderRouter with bounded fallback chain (max 3) — all built TDD-style with 28 passing tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-12T11:56:13Z
- **Completed:** 2026-07-12T11:59:16Z
- **Tasks:** 2 (both TDD — RED→GREEN)
- **Files modified:** 9 (3 source + 3 test + 3 existing context files)

## Accomplishments

- CircuitBreaker class with full CLOSED→OPEN→HALF_OPEN→CLOSED/OPEN state machine — 3 failures/60s window opens circuit, 5 minute cooldown enables HALF_OPEN probe, per-provider isolation via Map
- TierResolver class — maps CostTier to sorted (providerId, modelId) array, prioritizes by preferredProviders order, returns empty array when no models match
- ProviderRouter class+singleton — bounded 3-attempt fallback chain, circuit breaker integration (skips open circuits), recordSuccess/recordFailure per attempt, debugLog-based error logging
- Retry policy — getRetryableErrors() returns TIMEOUT/NETWORK/PROVIDER_5XX/RATE_LIMITED, isRetryableError checks both error.code and error.message fields
- All 28 router tests pass, all 274 project tests pass (0 regressions)

## Task Commits

Each task was committed atomically following TDD RED→GREEN cycle:

1. **Task 1 (RED): CircuitBreaker failing test** - `6720dfa` (test)
2. **Task 1 (GREEN): CircuitBreaker implementation** - `cbcfab8` (feat)
3. **Task 2 (RED): TierResolver + ProviderRouter failing tests** - `aee11cb` (test)
4. **Task 2 (GREEN): TierResolver + ProviderRouter implementation** - `cd0beac` (feat)

## Files Created/Modified

- `src/core/ai/router/CircuitBreaker.ts` — Configurable state machine with per-provider isolation (101 lines)
- `src/core/ai/router/TierResolver.ts` — CostTier→(providerId, modelId) sorted lookup (33 lines)
- `src/core/ai/router/ProviderRouter.ts` — Fallback chain with circuit breaker, retry policy, singleton (88 lines)
- `tests/core/ai/router/CircuitBreaker.test.ts` — 12 tests covering all state transitions, isolation, diagnostics
- `tests/core/ai/router/TierResolver.test.ts` — 4 tests for tier matching and priority ordering
- `tests/core/ai/router/ProviderRouter.test.ts` — 12 tests for fallback chain, circuit breaker, error handling

## Decisions Made

- CircuitBreaker uses config-driven constructor with Partial<CircuitBreakerConfig> — matches RateLimiter pattern (PATTERNS.md item 7). Defaults: failureThreshold=3, failureWindowMs=60000, cooldownMs=300000
- CircuitBreaker has no debugLog calls — ProviderRouter (the caller) handles all logging with contextual { providerId, modelId, error } data
- TierResolver is a pure lookup class with constructor DI — no singleton (created by ProviderRouter internally or DI)
- ProviderRouter uses separate value imports for singleton wiring (providerRegistry, CircuitBreakerClass, TierResolverClass) to avoid TypeScript type/vs-value import issues when the same module is used both as test mock and production singleton
- Retryable errors defined as `const RETRYABLE_ERROR_TYPES = [...] as const` for type-safe narrowing in isRetryableError

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- **RED Gate:** Present — `test(03-04)` commits exist: 6720dfa, aee11cb
- **GREEN Gate:** Present — `feat(03-04)` commits exist: cbcfab8, cd0beac
- **REFACTOR:** Not needed — both implementations clean
- **Status:** All gates PASS

## Issues Encountered

- Import path depth error in test files — written as `../../../src/` instead of `../../../../src/` (tests/core/ai/router/ is 4 levels deep). Caught during RED phase before GREEN commit.
- Singleton wiring in ProviderRouter.ts initially used `import type { TierResolver }` which is erased at runtime. Fixed by adding separate value imports for singleton creation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CircuitBreaker, TierResolver, and ProviderRouter ready for PlannerService (Plan 03-06), ExecutorService (Plan 03-07), and RendererService (Plan 03-08) consumption
- providerRouter singleton wired and ready for pipeline use
- 3-attempt fallback cap and circuit breaker protection ready for production use
- Ready for Plan 03-05 (PromptCache)

## Self-Check: PASSED

- All 6 created files verified on disk
- All 4 commits verified in git log
- All 274 tests pass (45 test files, 0 regressions)
- All 28 router tests pass across 3 test files

---

*Phase: 03-cost-effective-ai-runtime*
*Completed: 2026-07-12*
