---
phase: 03-cost-effective-ai-runtime
plan: 02
subsystem: ai-providers
tags: [provider-registry, model-discovery, openai, anthropic, google, ollama, ai-sdk]

# Dependency graph
requires:
  - phase: 03-01
    provides: providerTypes, AI SDK v4 packages, agent/extension configuration
provides:
  - ProviderRegistry class+singleton with chrome.storage.local persistence (key: np_provider_registry)
  - Capability-based ModelDiscovery utility (OpenAI /v1/models, Ollama /api/tags, Google skip)
  - 4 provider adapter factory files wrapping @ai-sdk/* (openai, anthropic, google, openai-compat)
affects:
  - Plan 03-03 (ProviderRouter) — consumes ProviderRegistry.getProvider() for model selection
  - Plan 03-05 (AgentOrchestrator pipeline) — consumes ProviderRegistry.getModelsForTier() for tier-based routing
  - Plan 03-08 (Options UI — Providers page) — consumes ProviderRegistry for provider config UI

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Class + singleton export pattern (KeymapRegistry analog)
    - Lazy AI SDK provider instance creation on first getProvider() call
    - Async initialize/persist pattern for chrome.storage.local integration
    - Capability-based model discovery with fallback chain

key-files:
  created:
    - src/core/ai/providers/ProviderRegistry.ts
    - src/core/ai/providers/modelDiscovery.ts
    - src/core/ai/providers/adapters/openaiAdapter.ts
    - src/core/ai/providers/adapters/anthropicAdapter.ts
    - src/core/ai/providers/adapters/googleAdapter.ts
    - src/core/ai/providers/adapters/openaiCompatAdapter.ts
    - tests/core/ai/providers/ProviderRegistry.test.ts
    - tests/core/ai/providers/modelDiscovery.test.ts
  modified:
    - src/core/ai/providers/providerTypes.ts (added DiscoveredModel interface)

key-decisions:
  - "API keys read from useProviderStore at adapter-creation time, NOT stored in ProviderRegistry persisted data — conforms to T-03-02-A mitigation"
  - "ModelDiscovery returns empty array on all errors (never throws) — per D-03 capability-based discovery with graceful degradation"
  - "Google provider skips discovery entirely (no public model list endpoint) — per D-03"
  - "AbortSignal.timeout(10000) for all discovery fetch calls to prevent hanging on unreachable endpoints"
  - "4 adapter files are thin pure-function wrappers — no classes, no error handling, no debugLog"

requirements-completed:
  - PROV-01
  - PROV-02
  - PROV-03
  - PROV-04
  - PROV-05
  - PROV-06
  - PROV-07

coverage:
  - id: D1
    description: "ProviderRegistry class+singleton with chrome.storage.local persistence at key np_provider_registry"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/core/ai/providers/ProviderRegistry.test.ts#registerProvider persists to chrome.storage.local under np_provider_registry key"
        status: pass
    human_judgment: false
  - id: D2
    description: "getModelsForTier returns correctly filtered ModelEntry[] sorted by provider priority"
    requirement: PROV-06
    verification:
      - kind: unit
        ref: "tests/core/ai/providers/ProviderRegistry.test.ts#getModelsForTier returns models sorted by provider priority"
        status: pass
    human_judgment: false
  - id: D3
    description: "modelDiscovery handles OpenAI-compatible /v1/models, Ollama /api/tags fallback, Google skip"
    requirement: PROV-07
    verification:
      - kind: unit
        ref: "tests/core/ai/providers/modelDiscovery.test.ts#discovers models from OpenAI-compatible /v1/models endpoint"
        status: pass
      - kind: unit
        ref: "tests/core/ai/providers/modelDiscovery.test.ts#falls back to Ollama /api/tags when /v1/models returns 404"
        status: pass
      - kind: unit
        ref: "tests/core/ai/providers/modelDiscovery.test.ts#returns empty array for Google provider (no discovery)"
        status: pass
    human_judgment: false
  - id: D4
    description: "All 4 adapter factories create valid AI SDK provider instances"
    requirement: PROV-02
    verification:
      - kind: unit
        ref: "tests/core/ai/providers/ProviderRegistry.test.ts#getProvider returns the provider config and lazy-created instance"
        status: pass
    human_judgment: false
  - id: D5
    description: "ProviderRegistry lazy-creates provider instances via correct adapter per ProviderConfig.type"
    requirement: PROV-04
    verification:
      - kind: unit
        ref: "tests/core/ai/providers/ProviderRegistry.test.ts#getProvider returns the provider config and lazy-created instance"
        status: pass
    human_judgment: false
  - id: D6
    description: "All catch blocks call debugLog (HARD-09) — verified by grep"
    requirement: PROV-05
    verification:
      - kind: unit
        ref: "bazel:grep confirms all catch blocks in ProviderRegistry.ts and modelDiscovery.ts call debugLog"
        status: pass
    human_judgment: false
  - id: D7
    description: "No barrel/index files — all imports use direct relative paths"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "bazel:ls confirms no index.ts in providers/ or adapters/"
        status: pass
    human_judgment: false

# Metrics
duration: 2 min
completed: 2026-07-12
status: complete
---

# Phase 03 Plan 02: ProviderRegistry + ModelDiscovery + Adapter Factories

**ProviderRegistry class+singleton with chrome.storage.local persistence, capability-based model discovery utility, and 4 AI SDK adapter factory files wrapping @ai-sdk/* providers**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-12T11:45:33Z
- **Completed:** 2026-07-12T11:48:24Z
- **Tasks:** 3 (2 TDD + 1 auto)
- **Files modified:** 9

## Accomplishments

- ProviderRegistry class+singleton with in-memory Map storage, lazy AI SDK provider instance creation, chrome.storage.local persistence at key `np_provider_registry`, and full CRUD (registerProvider, getProvider, getModelsForTier, listModels, listProviders, updateModel, removeProvider)
- ModelDiscovery utility with capability-based endpoint discovery: OpenAI-compatible `/v1/models`, Ollama `/api/tags` fallback on 404, Google skip, 10s AbortSignal timeout, return empty array on all errors
- 4 adapter factory files (openaiAdapter, anthropicAdapter, googleAdapter, openaiCompatAdapter) wrapping `@ai-sdk/*` providers
- All API keys read from providerStore at adapter-creation time — NOT stored in registry persisted data (T-03-02-A mitigation)
- 15 ProviderRegistry tests + 9 ModelDiscovery tests = 24 new tests, all passing
- Full existing test suite (220 tests) continues to pass

## Task Commits

1. **Task 1 (TDD RED): ProviderRegistry failing tests** - `4c1eeb4` (test)
2. **Task 1 (TDD GREEN): ProviderRegistry implementation + 4 adapter files** - `da1a0e1` (feat)
3. **Task 2 (TDD RED): ModelDiscovery failing tests** - `0564ef2` (test)
4. **Task 2 (TDD GREEN): ModelDiscovery implementation** - `28edcf1` (feat)
5. **Task 3: 4 adapter factory files** - Included in `da1a0e1` (created alongside ProviderRegistry)

## Files Created/Modified

- `src/core/ai/providers/ProviderRegistry.ts` — Class+singleton registry with persistence and lazy provider instance creation
- `src/core/ai/providers/modelDiscovery.ts` — Capability-based model discovery utility with fallback chain
- `src/core/ai/providers/providerTypes.ts` — Added `DiscoveredModel` interface
- `src/core/ai/providers/adapters/openaiAdapter.ts` — `createOpenAIAdapter` factory function
- `src/core/ai/providers/adapters/anthropicAdapter.ts` — `createAnthropicAdapter` factory function
- `src/core/ai/providers/adapters/googleAdapter.ts` — `createGoogleAdapter` factory function
- `src/core/ai/providers/adapters/openaiCompatAdapter.ts` — `createOpenAICompatAdapter` factory function with baseURL
- `tests/core/ai/providers/ProviderRegistry.test.ts` — 15 tests covering all registry operations
- `tests/core/ai/providers/modelDiscovery.test.ts` — 9 tests covering all discovery paths

## Decisions Made

- API keys read from `useProviderStore.getState()` at adapter creation time, NOT stored in ProviderRegistry persisted data (conforms to T-03-02-A threat mitigation)
- ModelDiscovery returns empty array on all errors (never throws) per D-03 capability-based discovery with graceful degradation
- Google provider skips discovery entirely — no public model list endpoint exists
- `AbortSignal.timeout(10000)` for all discovery fetch calls to prevent hanging on unreachable endpoints
- 4 adapter files are thin pure-function wrappers — no classes, no error handling, no debugLog (caller handles errors)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- ProviderRegistry and ModelDiscovery ready for Plan 03-03 (ProviderRouter with circuit breaker and tier-based selection)
- All 5 provider adapter patterns established — downstream consumers can use them directly
- 24 new tests verify all acceptance criteria

## Self-Check: PASSED

- All 9 files exist and verified
- All 5 commits verified in git log
- All 24 ProviderRegistry + ModelDiscovery tests pass
- All 220 total tests pass
- TypeScript compiles cleanly for src/core/ai/ files
- No barrel/index files in providers/ or adapters/

---

*Phase: 03-cost-effective-ai-runtime*
*Completed: 2026-07-12*
