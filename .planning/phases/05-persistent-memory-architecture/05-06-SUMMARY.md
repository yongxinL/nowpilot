---
phase: 05-persistent-memory-architecture
plan: 06
subsystem: memory
tags: [memory-engine, orchestration, assemble, extract, single-writer, broadcast-bus]

# Dependency graph
requires:
  - phase: 05-04
    provides: ConversationMemoryStore, UserMemoryStore
  - phase: 05-05
    provides: PreferenceMemoryStore, MemoryExtractor
  - phase: 05-03
    provides: MemoryScorer, conflictResolver
provides:
  - MemoryEngine class+singleton with assemble(), extract(), handleMemoryWrite()
  - Tier-capped pre-optimization retrieval from all three stores (3 tiny, 5 else)
  - Post-execution extraction pipeline (extract→resolve→upsert→summarize→archive→prune)
  - Single-writer routing: primary writes directly, non-primary emits BroadcastBus requests
  - Idempotency-key deduplication with 1000-entry auto-cleanup
affects:
  - P07 AgentOrchestrator integration (05-07)
  - P07 BroadcastBus memory write listener wiring

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Constructor DI with BroadcastBusLike local interface (avoids circular deps)
    - Placeholder BroadcastBus adapter for pre-P07 wiring
    - Dynamic import for MemoryDB in #getAllActiveFacts (lazy coupling)
    - #private field naming for internal state (#processedKeys)

key-files:
  created:
    - src/core/memory/MemoryEngine.ts (501 lines)
  modified:
    - tests/core/memory/MemoryEngine.test.ts

key-decisions:
  - "BroadcastBus uses local BroadcastBusLike interface to avoid circular dep with broadcastBus.ts — P07 wires the real instance"
  - "Placeholder broadcastBus singleton at module bottom logs debug messages until P07 wiring"
  - "Dynamic import of MemoryDB in #getAllActiveFacts avoids constructor-time coupling but requires proper mocking in tests"
  - "Fact cap enforcement uses MemoryDB.getAllUserFacts() rather than UserMemoryStore.search() (which caps at top-5)"

patterns-established:
  - "Pattern: #private fields for internal state tracking (#processedKeys, #processedKeysCounter)"
  - "Pattern: Primary surface gating via isPrimarySurface flag — all write paths check before proceeding"
  - "Pattern: extract() wraps entire method in try/catch — all sub-steps log but never rethrow (D-04)"

requirements-completed:
  - MEM-04
  - MEM-05
  - MEM-06
  - MEM-07

coverage:
  - id: D1
    description: "MemoryEngine.assemble() returns tier-capped facts (3 tiny, 5 else) with conversation context and preferences"
    requirement: MEM-04
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#assemble"
        status: pass
    human_judgment: false
  - id: D2
    description: "MemoryEngine.extract() runs full extract→resolve→upsert→summarize→archive→prune pipeline"
    requirement: MEM-04
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#extract"
        status: pass
    human_judgment: false
  - id: D3
    description: "Memory shared across surfaces via single-writer routing — primary writes directly, non-primary emits BroadcastBus"
    requirement: MEM-05
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#write routing"
        status: pass
    human_judgment: false
  - id: D4
    description: "Auto-summarise triggers when message count >= 12 (D-20)"
    requirement: MEM-06
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#triggers summarization when message count >= 12"
        status: pass
    human_judgment: false
  - id: D5
    description: "Memory writes single-writer via BroadcastBus (D-06/D-07) with idempotency key deduplication"
    requirement: MEM-07
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#write routing"
        status: pass
    human_judgment: false

# Metrics
duration: 5 min
completed: 2026-07-13
status: complete
---

# Phase 05 Plan 06: MemoryEngine — Central Memory Orchestrator

**MemoryEngine class+singleton with assemble() (pre-optimization retrieval) and extract() (post-execution pipeline), single-writer routing via BroadcastBus, and idempotency-key deduplication — 25 integration tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-13T01:46:46Z
- **Completed:** 2026-07-13T01:52:38Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- **MemoryEngine.assemble()** — Pre-optimization retrieval from all three stores: conversation context (summary + recent turns), tier-capped user facts (3 for tiny, 5 for small/medium/large), and always-injected preferences (D-10). Returns MemoryAssembleResult shape fed into ContextOptimizerInput.
- **MemoryEngine.extract()** — Post-execution fire-and-forget pipeline: extract facts via MemoryExtractor (Haiku-tier, D-05), conflict resolution via conflictResolver (D-16/D-17), upsert via UserMemoryStore, summarization threshold at 12 messages (D-20), archiving check at 30 min idle (D-22), fact cap enforcement at 500 (D-23) with low-confidence eviction (D-24). Retry-once on failure, never throws (D-04).
- **Single-writer routing** — `setPrimary()` controls write path: primary surface writes directly to stores (D-06), non-primary surfaces emit `MemoryWriteRequest` via BroadcastBus with idempotencyKey (D-07). `handleMemoryWrite()` processes `upsert-fact`, `update-summary`, `archive-conversation` types. `#processedKeys` Set with 1000-entry auto-cleanup prevents duplicate processing.
- **Singleton export** — `memoryEngine` singleton at module bottom with placeholder BroadcastBus adapter (P07 will wire the real broadcastBus).
- **All 76 memory tests pass** (25 new MemoryEngine tests + 51 existing across 7 test files)

## Task Commits

Each task was committed atomically following TDD cycle:

1. **Task 1: MemoryEngine.assemble()** — `09df4fc` (feat)
2. **Task 2: MemoryEngine.extract()** — `e1f0ea7` (feat)
3. **Task 3: Write routing + singleton** — `8e80b31`, `e1aafe1` (feat)

**Plan metadata:** *(committed after SUMMARY)*

## Files Created/Modified

- `src/core/memory/MemoryEngine.ts` (501 lines) — Class with assemble(), extract(), handleMemoryWrite(), setPrimary(), private helpers (#extractWithRetry, #resolveAndUpsert, #checkSummarization, #checkArchiving, #enforceFactCap, #evictWithRouting, #getAllActiveFacts)
- `tests/core/memory/MemoryEngine.test.ts` — 25 tests across 3 describe blocks (8 assemble, 9 extract, 8 write routing)

## Decisions Made

- **BroadcastBus uses local `BroadcastBusLike` interface** to avoid circular dependency with `broadcastBus.ts`. The placeholder singleton logs debug messages; P07 will wire the real BroadcastBus with `onMemoryWrite` handler registration.
- **Dynamic import of MemoryDB** in `#getAllActiveFacts()` avoids constructor-time coupling but requires `vi.mock()` in test files for the dynamic import path.
- **Fact cap enforcement uses `MemoryDB.getAllUserFacts()`** rather than `UserMemoryStore.search()` (which caps at top-5 results) — for full fact enumeration needed by D-23/D-24.
- **`#processedKeys` counter-based auto-cleanup** at 1000 entries (T-05-16 mitigation) — evicts oldest entry when threshold crossed, keeping the Set bounded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `broadcastBus` singleton not exported from broadcastBus module**
- **Found during:** Task 3 (Write routing implementation)
- **Issue:** The plan's singleton import (`import { broadcastBus } from '../messaging/broadcastBus'`) fails because `broadcastBus.ts` exports `initBroadcastBus`, `onBroadcastMessage`, `WORKSPACE_UPDATED`, `BroadcastHandler` — but no `broadcastBus` singleton instance matching `BroadcastBusLike` interface
- **Fix:** Created a placeholder `BroadcastBusLike` object at module bottom with stubbed `emitMemoryWrite` and `onMemoryWrite` methods that log debug messages. P07 will replace with real wiring.
- **Files modified:** `src/core/memory/MemoryEngine.ts`
- **Verification:** `npx tsc --noEmit` passes, all 76 memory tests pass
- **Committed in:** `e1aafe1`

**2. [Rule 3 - Blocking] Mock factory missing `rebuildIndex` method**
- **Found during:** TypeScript compilation
- **Issue:** `createMockUserMemoryStore()` returned object without `rebuildIndex` method, causing TS error at `new MemoryEngine()` call sites
- **Fix:** Added `rebuildIndex: vi.fn().mockResolvedValue(undefined)` to mock factory
- **Files modified:** `tests/core/memory/MemoryEngine.test.ts`
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** `e1aafe1`

**3. [Rule 3 - Blocking] TypeScript class structural typing issue with mock factories**
- **Found during:** TypeScript compilation
- **Issue:** Mock factory objects with only public methods are not assignable to class constructor parameters in strict TypeScript (private fields make class types incompatible with plain objects)
- **Fix:** Added `as any` casts at all 3 `new MemoryEngine()` call sites in the test file
- **Files modified:** `tests/core/memory/MemoryEngine.test.ts`
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** `e1aafe1`

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All fixes necessary for compilation and runtime correctness. No scope creep. BroadcastBus placeholder will be properly wired in P07.

## Issues Encountered

- Pre-existing `IndexedDBManager.test.ts` tests fail expecting `DB_VERSION=1` (source was bumped to 2 in Plan 05-02, test not updated). Pre-existing shell test failures (`openFullApp.test.tsx`) also unrelated to this plan.
- Dynamic import of `MemoryDB` inside `#getAllActiveFacts()` requires `vi.mock('../../../src/core/storage/stores/MemoryDB')` in test setup for proper mocking — this was added and works correctly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- MemoryEngine ready for P07 (05-07 AgentOrchestrator integration)
- P07 will wire: `memoryEngine.assemble()` before `ContextOptimizer.optimize()`, `memoryEngine.extract()` in `runWithContext()` finally block
- P07 will replace placeholder BroadcastBus with real `broadcastBus.onMemoryWrite(memoryEngine.handleMemoryWrite)`
- P07 will incorporate `memoryEngine.setPrimary()` into BroadcastBus primary election

## Self-Check: PASSED

- [x] `src/core/memory/MemoryEngine.ts` exists (501 lines)
- [x] `tests/core/memory/MemoryEngine.test.ts` exists (25 tests)
- [x] `SUMMARY.md` exists
- [x] All 4 commits verified in git log (09df4fc, e1f0ea7, 8e80b31, e1aafe1)
- [x] All 76 memory tests pass
- [x] `npx tsc --noEmit` passes for MemoryEngine files

---

*Phase: 05-persistent-memory-architecture*
*Completed: 2026-07-13*
