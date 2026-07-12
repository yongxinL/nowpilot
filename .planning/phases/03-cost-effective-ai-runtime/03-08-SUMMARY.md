---
phase: 03-cost-effective-ai-runtime
plan: 08
subsystem: ai-cache
tags: [prompt-caching, cache-hints, anthropic, openai, google, ollama, djb2, tdd]

requires:
  - phase: 03-01
    provides: AI SDK packages installed (ai @ v4.3.19)
  - phase: 03-02
    provides: ProviderRegistry with provider types
  - phase: 03-03
    provides: ToolRegistry, PermissionService, fixture tools

provides:
  - PromptCacheManager class+singleton with stable section identification (system-prompt, tool-schemas, preferences, memory)
  - DJB2-based per-provider cache key generation with targeted and global invalidation
  - PromptCacheAdapter pure functions translating provider-agnostic CacheHint → per-provider providerOptions
  - Anthropic: per-message cacheControl { type: 'ephemeral' }
  - OpenAI: request-level promptCacheKey + promptCacheOptions { mode: 'auto', ttl: 3600 } + breakpoint markers
  - Gemini: per-message cachedContent wrapper
  - Ollama/unknown: no-op (messages unchanged)

affects:
  - 03-09 (PlannerService integration — applyCacheHints before generateText)
  - 03-06 integration (ExecutorService, RendererService use PromptCacheAdapter)

tech-stack:
  added: []
  patterns:
    - Class+singleton with Map-based private state (#cacheKeys, #sectionHints)
    - Pure function adapter module with one function per provider family
    - Dispatcher switch routing to correct adapter based on providerType
    - DJB2 non-cryptographic hash for cache key generation
    - Monotonic counter alongside Date.now() for hash uniqueness across rapid invalidation cycles

key-files:
  created:
    - src/core/ai/cache/PromptCacheManager.ts (88 lines)
    - src/core/ai/cache/PromptCacheAdapter.ts (96 lines)
    - tests/core/ai/cache/PromptCacheManager.test.ts (120 lines, 10 tests)
    - tests/core/ai/cache/PromptCacheAdapter.test.ts (204 lines, 15 tests)
  modified: []

key-decisions:
  - "Cache key hash uses DJB2 with monotonic counter alongside Date.now() for test-robust uniqueness — plan specified Date.now() only, but test runs within a single ms make counter necessary for reliable invalidation"
  - "identifyStableSections creates one CacheHint per section-tagged message index — each tagged part gets its own hint with its index in messageIndices"
  - "OpenAI adapter returns both request-level providerOptions (promptCacheKey/cacheOptions) and per-message breakpoint markers on last cached section"
  - "Anthropic and Google adapters embed providerOptions in individual messages; OpenAI uses a mix of per-message (breakpoint) and request-level (cacheKey) options"

requirements-completed:
  - AIRN-07
  - AIRN-08

coverage:
  - id: D1
    description: "PromptCacheManager.identifyStableSections returns Map<number, CacheHint> for system-prompt, tool-schemas, preferences, memory sections only"
    requirement: AIRN-07
    verification:
      - kind: unit
        ref: "tests/core/ai/cache/PromptCacheManager.test.ts#identifyStableSections"
        status: pass
    human_judgment: false
  - id: D2
    description: "PromptCacheManager.generateCacheKey returns deterministic hash per provider; invalidateCacheKey clears it; invalidateAll clears all"
    requirement: AIRN-07
    verification:
      - kind: unit
        ref: "tests/core/ai/cache/PromptCacheManager.test.ts#generateCacheKey"
        status: pass
    human_judgment: false
  - id: D3
    description: "PromptCacheAdapter.applyAnthropicCache adds cacheControl ephemeral to marked messages"
    requirement: AIRN-08
    verification:
      - kind: unit
        ref: "tests/core/ai/cache/PromptCacheAdapter.test.ts#applyAnthropicCache"
        status: pass
    human_judgment: false
  - id: D4
    description: "PromptCacheAdapter.applyOpenAICache returns promptCacheKey, mode:auto, ttl:3600 + per-message breakpoint"
    requirement: AIRN-08
    verification:
      - kind: unit
        ref: "tests/core/ai/cache/PromptCacheAdapter.test.ts#applyOpenAICache"
        status: pass
    human_judgment: false
  - id: D5
    description: "PromptCacheAdapter.applyGoogleCache wraps cached content in providerOptions.google.cachedContent"
    requirement: AIRN-08
    verification:
      - kind: unit
        ref: "tests/core/ai/cache/PromptCacheAdapter.test.ts#applyGoogleCache"
        status: pass
    human_judgment: false
  - id: D6
    description: "PromptCacheAdapter.applyCacheHints dispatcher routes to correct adapter per providerType; Ollama/unknown returns messages unchanged"
    requirement: AIRN-08
    verification:
      - kind: unit
        ref: "tests/core/ai/cache/PromptCacheAdapter.test.ts#applyCacheHints"
        status: pass
    human_judgment: false

duration: 2 min
completed: 2026-07-12
status: complete
---

# Phase 03 Plan 08: Prompt Caching — PromptCacheManager + PromptCacheAdapter

**PromptCacheManager class+singleton with stable section identification and DJB2 cache keys, and PromptCacheAdapter pure functions translating CacheHint to per-provider providerOptions (Anthropic cacheControl, OpenAI promptCacheKey, Gemini cachedContent)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-12T12:23:53Z
- **Completed:** 2026-07-12T12:25:55Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4

## Accomplishments

- PromptCacheManager with `identifyStableSections()` that marks system-prompt, tool-schemas, preferences, and memory sections — user/assistant messages excluded per D-15
- DJB2-based `generateCacheKey()` with per-provider storage and monotonic counter for uniqueness across rapid invalidation cycles
- `invalidateCacheKey()` and `invalidateAll()` with debugLog logging per D-15
- Class export + `promptCacheManager` singleton following project pattern (EncryptedStorage analog)
- PromptCacheAdapter with 4 named-export pure functions:
  - `applyAnthropicCache` — per-message `cacheControl: { type: 'ephemeral' }` on marked messages
  - `applyOpenAICache` — request-level `promptCacheKey` + `promptCacheOptions { mode: 'auto', ttl: 3600 }` + `promptCacheBreakpoint` markers on last cached section
  - `applyGoogleCache` — per-message `cachedContent` wrapper
  - `applyCacheHints` dispatcher — routes to correct adapter, Ollama/unknown are no-op
- All 351 existing tests pass unchanged; 25 new tests across 2 test files

## Task Commits

Each task was committed atomically following RED→GREEN TDD cycle:

1. **Task 1 (TDD RED): PromptCacheManager failing test** - `1e20b78` (test)
2. **Task 1 (TDD GREEN): PromptCacheManager implementation** - `e987c7b` (feat)
3. **Task 2 (TDD RED): PromptCacheAdapter failing test** - `383dbec` (test)
4. **Task 2 (TDD GREEN): PromptCacheAdapter implementation** - `56f484c` (feat)

**Plan metadata:** (committed after SUMMARY)

## Files Created/Modified

- `src/core/ai/cache/PromptCacheManager.ts` (88 lines) — Class with private #cacheKeys Map, identifyStableSections, generateCacheKey, invalidateCacheKey, invalidateAll, simpleHash (DJB2)
- `src/core/ai/cache/PromptCacheAdapter.ts` (96 lines) — Pure functions: applyAnthropicCache, applyOpenAICache, applyGoogleCache, applyCacheHints dispatcher
- `tests/core/ai/cache/PromptCacheManager.test.ts` (120 lines, 10 tests) — Section identification, cache key generation/invalidation, singleton export
- `tests/core/ai/cache/PromptCacheAdapter.test.ts` (204 lines, 15 tests) — All adapter functions, dispatcher routing, empty hintMap, Ollama no-op

## Decisions Made

- Cache key hash uses DJB2 with monotonic counter alongside Date.now() — plan specified Date.now() only, but isolated test runs within a single ms require the counter for reliable invalidation testing
- `identifyStableSections` creates one CacheHint per section-tagged message index (not aggregating), giving each tagged section its own hint entry
- OpenAI adapter returns both request-level providerOptions (cacheKey + options) AND per-message breakpoint markers — matching AI SDK v4 OpenAI cache API requirements
- PromptCacheAdapter exports 4 separate named functions plus the dispatcher, not a class — follows the adapter pattern from PATTERNS.md

## Deviations from Plan

None - plan executed exactly as written. All tests pass with 0 deviations.

## TDD Gate Compliance

- **RED Gate:** Present — `test(03-08)` commits exist: 1e20b78, 383dbec
- **GREEN Gate:** Present — `feat(03-08)` commits exist: e987c7b, 56f484c
- **REFACTOR:** Not needed — implementation clean and minimal for both tasks
- **Status:** All gates PASS

## Issues Encountered

None - both TDD tasks executed cleanly with first-pass GREEN phase success.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PromptCacheManager and PromptCacheAdapter ready for Plan 03-09 (PlannerService integration) and downstream pipeline services (ExecutorService, RendererService)
- PlannerService will call `applyCacheHints(providerType, messages, promptCacheManager.identifyStableSections(promptParts), cacheKey)` before `generateText`/`streamText`
- Cache key invalidation integrated into ProviderRegistry change handlers (to be wired in later integration plans)
- Next plan: 03-09

## Self-Check: PASSED

- [x] `src/core/ai/cache/PromptCacheManager.ts` exists (88 lines, meets 50-line min)
- [x] `src/core/ai/cache/PromptCacheAdapter.ts` exists (96 lines, meets 40-line min)
- [x] `tests/core/ai/cache/PromptCacheManager.test.ts` exists (120 lines, 10 tests)
- [x] `tests/core/ai/cache/PromptCacheAdapter.test.ts` exists (204 lines, 15 tests)
- [x] All 4 commits verified in git log
- [x] All 25 cache tests pass
- [x] All 351 total tests pass
- [x] Exports match must_haves: PromptCacheManager, promptCacheManager, applyAnthropicCache, applyOpenAICache, applyGoogleCache, applyCacheHints

---

*Phase: 03-cost-effective-ai-runtime*
*Completed: 2026-07-12*
