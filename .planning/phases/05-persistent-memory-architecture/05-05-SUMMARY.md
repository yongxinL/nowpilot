---
phase: 05-persistent-memory-architecture
plan: 05
subsystem: memory
tags: [zustand, persist, chrome.storage.local, ai-extraction, haiku-tier, zod, generate-text, tdd]

requires:
  - phase: 05-02
    provides: memoryTypes.ts with PreferencePayload, MemoryExtractionResult, extractionResultSchema, preferenceSchema
  - phase: 05-03
    provides: UserMemoryStore, ConversationMemoryStore
  - phase: 02-07
    provides: themeStore, workspaceStore Zustand stores

provides:
  - PreferenceMemoryStore with Zustand persist + cross-store reads from ThemeStore/WorkspaceStore
  - preferenceMemoryStore plain-object API (get/set) for non-React consumers (MemoryEngine)
  - MemoryExtractor class with Haiku-tier generateText call, Zod validation, retry-once resilience
  - memoryExtractor singleton with lazy model accessor (wired in P06)
  - createMockExtractor() factory for MemoryEngine test integration

affects:
  - P06 MemoryEngine (consumes preferenceMemoryStore.get() and memoryExtractor.extract())

tech-stack:
  added: []
  patterns:
    - Zustand + persist with chrome.storage.local (matching workspaceStore.ts pattern, key np_preferences)
    - Vanilla getState() for cross-store reads to avoid React hook circular deps (Research pitfall #4)
    - Zod safeParse() for untrusted AI output validation (T-05-10 mitigation)
    - Retry-once fire-and-forget extraction pattern per D-04
    - Class + singleton with lazy model accessor (matching ContextCompressor pattern)
    - Mock factory + vi.hoisted() for test mocking (matching AgentOrchestrator.test.ts pattern)

key-files:
  created:
    - src/core/memory/PreferenceMemoryStore.ts
    - src/core/memory/MemoryExtractor.ts
    - tests/core/memory/MemoryExtractor.test.ts
  modified:
    - tests/core/memory/PreferenceMemoryStore.test.ts
    - tests/core/memory/MemoryEngine.test.ts

key-decisions:
  - "PreferenceMemoryStore reads themeMode and defaultSurface at get() call time via vanilla getState(), not at instantiation — avoids circular deps per Research pitfall #4"
  - "MemoryExtractor uses extractionResultSchema.safeParse() (not .parse()) to validate AI output — safeParse never throws, allowing the discard-and-return-empty pattern per D-04"
  - "Retry loop follows '2 attempts total, log warning on first failure, log error on second failure, always return valid result' — no fallback LLM call needed (extraction is optional per D-04)"
  - "MemoryExtractor exports createMockExtractor() factory from MemoryEngine.test.ts for P06 integration tests — following AgentOrchestrator.test.ts mock factory convention"
  - "PreferenceMemoryStore.get() validates own fields via preferenceSchema.parse() before merging external fields — ensures stored preference data integrity"

patterns-established:
  - "Pattern: Zustand store with persist + chrome.storage.local + np_ prefix key for preference storage"
  - "Pattern: AI extraction class with constructor DI (modelAccessor), retry loop, safeParse validation, debugLog logging"

requirements-completed:
  - MEM-03
  - MEM-04

coverage:
  - id: D1
    description: "PreferenceMemoryStore initializes with D-08 defaults for all 6 AI-preference fields"
    requirement: MEM-03
    verification:
      - kind: unit
        ref: "tests/core/memory/PreferenceMemoryStore.test.ts#initializes with defaults for all 6 AI-preference fields"
        status: pass
    human_judgment: false
  - id: D2
    description: "PreferenceMemoryStore.get() merges themeMode from ThemeStore and defaultSurface from WorkspaceStore per D-09"
    requirement: MEM-03
    verification:
      - kind: unit
        ref: "tests/core/memory/PreferenceMemoryStore.test.ts#get() returns PreferencePayload with themeMode read from ThemeStore.getState().mode"
        status: pass
    human_judgment: false
  - id: D3
    description: "PreferenceMemoryStore.get() output matches preferenceSchema Zod validation"
    requirement: MEM-03
    verification:
      - kind: unit
        ref: "tests/core/memory/PreferenceMemoryStore.test.ts#get() output matches preferenceSchema Zod validation"
        status: pass
    human_judgment: false
  - id: D4
    description: "MemoryExtractor.extract() calls generateText with Haiku-tier, validates against extractionResultSchema"
    requirement: MEM-04
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryExtractor.test.ts#extract with valid messages returns MemoryExtractionResult with facts array validated by extractionResultSchema"
        status: pass
    human_judgment: false
  - id: D5
    description: "MemoryExtractor.extract() returns empty facts on AI failure (never throws per D-04)"
    requirement: MEM-04
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryExtractor.test.ts#returns empty facts array when generateText throws an error (no facts, no throw per D-04)"
        status: pass
    human_judgment: false
  - id: D6
    description: "MemoryExtractor.extract() retries once on failure, returns retry results if successful"
    requirement: MEM-04
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryExtractor.test.ts#retries once on first failure — if retry succeeds, returns facts from retry"
        status: pass
    human_judgment: false
  - id: D7
    description: "MemoryExtractor discards invalid AI output silently via extractionResultSchema.safeParse()"
    requirement: MEM-04
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryExtractor.test.ts#validates AI output against extractionResultSchema and discards invalid results silently"
        status: pass
    human_judgment: false
  - id: D8
    description: "MemoryExtractor logs both success and failure via debugLog"
    requirement: MEM-04
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryExtractor.test.ts#logs success with debugLog"
        status: pass
    human_judgment: false

duration: 3 min
completed: 2026-07-13
status: complete
---

# Phase 05 Plan 05: PreferenceMemoryStore + MemoryExtractor Summary

**Zustand-persisted preference store with cross-store reads (ThemeStore + WorkspaceStore) and Haiku-tier AI extraction module with retry-once resilience and Zod output validation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-13T01:40:29Z
- **Completed:** 2026-07-13T01:44:10Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 5

## Accomplishments

- **PreferenceMemoryStore** (Zustand + persist middleware, chrome.storage.local key `np_preferences`):
  - D-08 defaults: `responseStyle='concise'`, `preferredLanguage='auto'`, `preferStructuredOutput=false`, `allowCloudFallbackFromLocal=false`, `defaultProviderId=''`, `toolAutonomy='manual'`
  - `preferenceMemoryStore.get()` merges 6 own fields + `themeMode` from ThemeStore + `defaultSurface` from WorkspaceStore per D-09
  - Vanilla `getState()` for cross-store reads — no React hooks, avoids circular deps per Research pitfall #4
  - Own fields validated via `preferenceSchema.parse()` on every `get()` call
  - Exports both `usePreferenceStore` (Zustand hook) and `preferenceMemoryStore` (plain-object API)

- **MemoryExtractor** (Haiku-tier generateText + Zod validation):
  - `EXTRACTION_PROMPT` constant instructs LLM to output JSON matching `extractionResultSchema`
  - Constructor DI with `modelAccessor` function (matching ContextCompressor pattern)
  - `extract()` calls `generateText` with Haiku-tier model, parsed via JSON.parse, validated via `extractionResultSchema.safeParse()`
  - Retry-once loop per D-04: 2 attempts total, log warning on first failure, log error on second failure
  - NEVER throws — always returns valid `MemoryExtractionResult` (empty facts on complete failure)
  - Low-temperature deterministic output (`temperature: 0`, `maxTokens: 300`)
  - Singleton `memoryExtractor` with lazy model accessor (wired in P06)
  - Threat mitigations: `safeParse()` for T-05-10 (Tampering), no-execution prompt + `maxTokens=300` for T-05-11 (Spoofing), never-blocks per D-04 for T-05-13 (DoS)

- **Mock factory for P06**: `createMockExtractor()` exported from `MemoryEngine.test.ts` following AgentOrchestrator.test.ts factory pattern

## Task Commits

Each task was committed atomically following RED→GREEN TDD cycle:

1. **Task 1 (TDD RED): PreferenceMemoryStore failing tests** - `705b53f` (test)
2. **Task 1 (TDD GREEN): PreferenceMemoryStore implementation** - `a139d98` (feat)
3. **Task 2 (TDD RED): MemoryExtractor failing tests + mock factory** - `872af6b` (test)
4. **Task 2 (TDD GREEN): MemoryExtractor implementation** - `c6ea68b` (feat)

**Plan metadata:** (committed after SUMMARY)

## Files Created/Modified

- `src/core/memory/PreferenceMemoryStore.ts` (90 lines) — Zustand store with persist, cross-store reads via vanilla getState(), PreferencePayload + { themeMode, defaultSurface } return
- `src/core/memory/MemoryExtractor.ts` (105 lines) — Class with Haiku-tier generateText call, Zod safeParse validation, retry-once loop, debugLog logging
- `tests/core/memory/PreferenceMemoryStore.test.ts` (58 lines, 6 tests) — Defaults, set/persist, cross-store reads, schema validation, compact JSON
- `tests/core/memory/MemoryExtractor.test.ts` (148 lines, 7 tests) — Valid extraction, empty on error, retry, invalid discard, debugLog success/failure, prompt content
- `tests/core/memory/MemoryEngine.test.ts` (27 lines) — Added `createMockExtractor()` factory export for P06

## Decisions Made

- PreferenceMemoryStore reads themeMode and defaultSurface at `get()` call time via vanilla `getState()` — not at instantiation — avoids circular dependency issues (Research pitfall #4)
- MemoryExtractor uses `extractionResultSchema.safeParse()` (not `.parse()`) because safeParse never throws, allowing the discard-and-return-empty pattern per D-04
- Retry loop follows "2 attempts total, log warning on first failure, log error on second failure, always return valid result" — no fallback LLM call needed
- PreferenceMemoryStore.get() validates own 6 fields via `preferenceSchema.parse()` before merging external ThemeStore/WorkspaceStore fields — ensures stored preference data integrity
- createMockExtractor() factory exported from MemoryEngine.test.ts follows AgentOrchestrator.test.ts pattern for P06 consumption

## Deviations from Plan

None - plan executed exactly as written. All tests pass with 0 deviations.

## TDD Gate Compliance

- **RED Gate:** Present — `test(05-05)` commits exist: `705b53f`, `872af6b`
- **GREEN Gate:** Present — `feat(05-05)` commits exist: `a139d98`, `c6ea68b`
- **REFACTOR:** Not needed — both implementations are clean and follow existing patterns exactly
- **Status:** All gates PASS

## Issues Encountered

- `vi.mock('ai', ...)` with top-level `const mockGenerateText` caused "Cannot access before initialization" error due to Vitest hoisting. Fixed by using `vi.hoisted()` pattern — wrapping mock variables in `vi.hoisted(() => ({ mockGenerateText: vi.fn(), mockDebugLog: vi.fn() }))` and referencing from the hoisted return.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PreferenceMemoryStore ready for `MemoryEngine.assemble()` (P06) — `preferenceMemoryStore.get()` returns compact JSON with all preference fields merged
- MemoryExtractor ready for `MemoryEngine.extract()` (P06) — `memoryExtractor.extract()` returns validated MemoryExtractionResult with retry-once resilience
- `createMockExtractor()` mock factory exported from MemoryEngine.test.ts for P06 integration tests
- Next plan: 05-06 (MemoryEngine assemble + extract orchestration)

## Self-Check: PASSED

- [x] `src/core/memory/PreferenceMemoryStore.ts` exists (90 lines)
- [x] `src/core/memory/MemoryExtractor.ts` exists (105 lines)
- [x] `tests/core/memory/PreferenceMemoryStore.test.ts` — 6 tests pass
- [x] `tests/core/memory/MemoryExtractor.test.ts` — 7 tests pass
- [x] `tests/core/memory/MemoryEngine.test.ts` — createMockExtractor() factory exported
- [x] All 51 memory tests pass
- [x] All 4 commits verified in git log
- [x] TypeScript compiles cleanly: `export class MemoryExtractor`, `extractionResultSchema.safeParse`, `export const memoryExtractor`
- [x] Exports match must_haves: PreferenceMemoryStore, preferenceMemoryStore, MemoryExtractor, memoryExtractor, EXTRACTION_PROMPT, createMockExtractor

---

*Phase: 05-persistent-memory-architecture*
*Completed: 2026-07-13*
