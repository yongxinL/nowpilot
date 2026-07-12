---
phase: 03-cost-effective-ai-runtime
plan: 09
subsystem: stores
tags: [provider-store, model-registry, workspace-store, background-sw, mv3, verification]

requires:
  - phase: 03-02
    provides: ProviderRegistry with ProviderConfig/ModelEntry types
  - phase: 03-04
    provides: Zustand store patterns
  - phase: 03-06
    provides: pipeline services consuming providerStore/workspaceStore
  - phase: 03-07
    provides: ProviderRouter reading workspaceStore.activeProvider
provides:
  - providerStore extended with modelEntries, providerPriority, tierAssignments fields + setters
  - Verification that workspaceStore.activeProvider is accessible with no AI imports
  - Verification that background.ts has zero AI runtime imports (MV3 restriction enforced)
affects:
  - Phase 3 pipeline services (ProviderRouter, PlannerService, ExecutorService, RendererService)
  - Phase 4 UI surfaces consuming provider configuration

tech-stack:
  added: []
  patterns:
    - Zustand store with model-registry fields alongside encrypted API key storage
    - Type-only import from providerTypes (no AI SDK dependency in store layer)
    - Verification-only tasks confirming existing architecture constraints

key-files:
  created: []
  modified:
    - src/core/stores/providerStore.ts (extended with 3 model-registry fields + 3 setters)
  verified:
    - src/core/stores/workspaceStore.ts (no changes needed)
    - src/entrypoints/background.ts (no changes needed)

key-decisions:
  - "Type-only import of ModelEntry in providerStore avoids AI SDK dependency in the store layer — stores remain framework-agnostic"
  - "New fields share the existing np_providers persistence key and EncryptedStorage adapter — no separate storage key needed"

requirements-completed:
  - PROV-01
  - PROV-02
  - PROV-03
  - PROV-04
  - PROV-05
  - PROV-06
  - PROV-07
  - AIRN-01
  - AIRN-02
  - AIRN-03
  - AIRN-04
  - AIRN-05
  - AIRN-06
  - AIRN-07
  - AIRN-08
  - AIRN-09

coverage:
  - id: D1
    description: "providerStore extended with modelEntries (ModelEntry[]), providerPriority (string[]), tierAssignments (Record<string,string>) and corresponding setters"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "src/core/stores/providerStore.ts#ProviderState interface includes modelEntries, providerPriority, tierAssignments"
        status: pass
    human_judgment: false
  - id: D2
    description: "Existing providerState fields (selectedProvider, apiKeys, setSelectedProvider, setApiKey) unchanged; EncryptedStorage persistence intact"
    verification:
      - kind: other
        ref: "all 351 tests pass (0 regressions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "workspaceStore.activeProvider field is string | null and accessible; no AI runtime imports in workspaceStore"
    verification:
      - kind: unit
        ref: "tests/core/workspaceStore.test.ts#setActiveProvider persists to chrome.storage.local"
        status: pass
    human_judgment: false
  - id: D4
    description: "background.ts has zero imports from src/core/ai/, @ai-sdk/*, or 'ai' — MV3 restriction enforced"
    verification:
      - kind: unit
        ref: "tests/core/background.test.ts#all background tests pass"
        status: pass
    human_judgment: false

duration: 2 min
completed: 2026-07-12
status: complete
---

# Phase 03 Plan 09: AI Runtime Integration with Stores

**Extend providerStore with model registry fields (modelEntries, providerPriority, tierAssignments), verify workspaceStore integration points, and enforce MV3 background SW restriction (no AI imports)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-12T12:27:00Z
- **Completed:** 2026-07-12T12:29:07Z
- **Tasks:** 3
- **Files modified:** 1 (providerStore.ts)

## Accomplishments

- **providerStore extended** with 3 model registry fields: `modelEntries` (ModelEntry[]), `providerPriority` (string[]), `tierAssignments` (Record<string,string>) — all consumed by ProviderRegistry for model list, provider priority, and tier assignments
- **New setters** (`setModelEntries`, `setProviderPriority`, `setTierAssignments`) following the existing `set()` pattern
- **Type-only import** of `ModelEntry` from `providerTypes` — no AI SDK dependency in the store layer
- **Existing fields unchanged** — `selectedProvider`, `apiKeys`, `setSelectedProvider`, `setApiKey` remain identical
- **EncryptedStorage persistence** and `np_providers` key unchanged — new fields serialize through the same encrypted JSON storage
- **workspaceStore verified** — `activeProvider` typed as `string | null`, accessible via `useWorkspaceStore.getState().activeProvider`, zero `src/core/ai/` imports
- **background.ts verified** — zero imports from `src/core/ai/`, `@ai-sdk/*`, or `'ai'`; only imports `wxt/utils/define-background` and `../core/utils/debugLog`
- **All 351 existing tests pass** with zero regressions

## Task Commits

1. **Task 1: Extend providerStore with model registry fields** - `6a922ab` (feat)
   - Added type-only ModelEntry import, 3 new fields + setters to ProviderState and store
   - Existing fields, EncryptedStorage, and np_providers key unchanged

2. **Task 2: Verify workspaceStore integration points** — no code changes needed (verified)
   - `activeProvider` is `string | null`, accessible, no AI imports, all tests pass

3. **Task 3: Verify background SW has zero AI runtime imports** — no code changes needed (verified)
   - Zero AI runtime imports found, MV3 restriction properly enforced, all tests pass

## Files Created/Modified

- `src/core/stores/providerStore.ts` (+19 lines) — Extended interface and store with model registry fields

## Decisions Made

- **Type-only import for ModelEntry:** Using `import type { ModelEntry }` in providerStore avoids any AI SDK runtime dependency in the store layer. Stores remain framework-agnostic — the ModelEntry type is needed only for the interface definition, not instantiation.
- **Shared persistence key:** New fields are stored under the existing `np_providers` key through the same EncryptedStorage adapter. This avoids creating a separate storage key for model metadata (non-sensitive data travels alongside encrypted API keys, all encrypted by EncryptedStorage).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all tasks completed cleanly with zero issues. Both verification tasks confirmed no changes needed. The single modification (providerStore) passed all 351 tests on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- providerStore now has all fields needed by ProviderRegistry for model list, provider priority, and tier assignments
- WorkspaceStore activeProvider field is ready for ProviderRouter consumption (reading to determine preferred provider chain per D-08)
- Background SW MV3 restriction verified — AI runtime code remains properly isolated from the ephemeral service worker
- Phase 03 is now complete (all 9 plans have SUMMARY.md) — ready for Phase 04

---

*Phase: 03-cost-effective-ai-runtime*
*Completed: 2026-07-12*
