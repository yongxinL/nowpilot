---
phase: 05-knowledge-base-memory-minisearch-notes
plan: 01
subsystem: memory
tags: [memory, types, zod, error-codes, events, storage-registry, i18n, d3-force, wxt]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: RetrievedMemory + UserPreferences in src/core/memory/types.ts (C.1 home), UserPreferencesSchema boundary precedent
  - phase: 04b-trust-aware-context-and-receipts
    provides: harness.ts C.1 co-located Zod schema pattern (L211-251)
provides:
  - UserMemoryFact / ConversationMemory / ConversationMeta / MemoryInjection + UserPreferencesSchema in src/core/memory/types.ts (R-1 home every store plan 05-02/03/04 imports)
  - Five Phase-5 canonical error codes (MEMORY_RETRIEVAL_FAILED, MEMORY_EXTRACT_FAILED, NOTE_LINK_PARSE_FAILED, NOTE_GRAPH_FAILED, SEARCH_INDEX_REBUILD_FAILED) in errorCodes.ts + spec Appendix C.2 mirror (W-1)
  - np_conversation_meta { area: 'local' } registered in Setting.ts STORAGE_KEY_REGISTRY (Pitfall 4 closed)
  - 'note:saved' in EVENT_TYPES with NOTE_SAVE intact (Pitfall 7)
  - WorkingMemory + WORKING_MEMORY_TEMPLATE in harness.ts (C.1)
  - 23 STR.notes.* canonical keys verbatim from 05-UI-SPEC Copywriting Contract
  - verify:phase-5 gate script + d3-force@^3.0.0 dependency
affects: [05-02..08, verify-work phase 5, LLM-Wiki phase 5a, note UI phase 5]

# Tech tracking
tech-stack:
  added: [d3-force ^3.0.0]
  patterns:
    - "R-1 type home: Phase-5 memory types live in src/core/memory/types.ts; WorkingMemory in harness.ts — stores import, never re-declare"
    - "GR-4 co-located Zod boundary schema beside the type it validates (harness.ts L211-251 precedent)"
    - "W-1 spec mirror: canonical error codes mirrored line-anchored into spec Appendix C.2 at the introducing plan"

key-files:
  created: [tests/core/memory/MemoryTypes.test.ts]
  modified: [src/core/memory/types.ts, src/core/error/errorCodes.ts, .planning/PRODUCT_SPEC_v0_1.md, src/core/storage/Setting.ts, src/core/events/EventBus.ts, src/types/harness.ts, src/core/i18n/strings.ts, package.json, pnpm-lock.yaml]

key-decisions:
  - "R-1 single home: UserMemoryFact/ConversationMemory/ConversationMeta/MemoryInjection land in src/core/memory/types.ts; WorkingMemory in harness.ts (Appendix C.1) — stores 05-02/03/04 import from these, never re-declare (D-05-01)"
  - "UserPreferencesSchema (zod 3) co-located beside UserPreferences — the np_persona write gate PreferenceMemoryStore uses (GR-4, harness.ts L211-251 precedent)"
  - "Five Phase-5 canonical codes exactly (Open Q7): stores reuse STORE_READ/STORE_WRITE for idb failures; mirrored in spec Appendix C.2 (W-1 gate)"
  - "np_conversation_meta registered { area: 'local' } next to np_persona — Pitfall 4 closed so ConversationMemoryStore LRU archive/evict never silently no-ops"
  - "'note:saved' appended to EVENT_TYPES; NOTE_SAVE retained verbatim (Pitfall 7 — EventBus.test.ts stays green)"
  - "verify:phase-5 = §24 chain byte-identical to verify:phase-4b (D-05-19); no test-count assertions (P-5)"
  - "d3-force@^3.0.0 installed — approved stack §7, Package Legitimacy Audit OK, no blocking-human gate"

patterns-established:
  - "R-1 canonical type homes: Phase-5 memory types in memory/types.ts, WorkingMemory in harness.ts"
  - "GR-4 Zod boundary schema co-location for storage write gates"
  - "W-1 canonical error-code spec mirror at introducing plan"

requirements-completed: [KNW-01, KNW-03, KNW-04, KNW-05]

coverage:
  - id: D1
    description: "Phase-5 memory types (UserMemoryFact §3.4, ConversationMemory §3.3, ConversationMeta §21.3, MemoryInjection DTO) + co-located UserPreferencesSchema in src/core/memory/types.ts (R-1 home)"
    requirement: KNW-04
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryTypes.test.ts#UserPreferencesSchema (05-01 Task 1 — GR-4 boundary gate)"
        status: pass
      - kind: unit
        ref: "tests/core/memory/MemoryTypes.test.ts#Phase-5 interface shape parity (05-01 Task 1 — tsc-enforced)"
        status: pass
      - kind: other
        ref: "pnpm exec tsc --noEmit (acceptance: byte-unchanged RetrievedMemory/UserPreferences verified via git diff)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Five Phase-5 canonical error codes in errorCodes.ts + spec Appendix C.2 mirror (W-1 gate)"
    requirement: KNW-01
    verification:
      - kind: other
        ref: "grep -c '^  <CODE>: .*<CODE>$' src/core/error/errorCodes.ts == 1 per code"
        status: pass
      - kind: other
        ref: "grep -c '^<CODE>$' .planning/PRODUCT_SPEC_v0_1.md == 1 per code (Appendix C.2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "np_conversation_meta registered in Setting.ts STORAGE_KEY_REGISTRY (Pitfall 4) + 'note:saved' in EVENT_TYPES with NOTE_SAVE intact (Pitfall 7)"
    requirement: KNW-03
    verification:
      - kind: unit
        ref: "tests/core/events/EventBus.test.ts (10 tests green — NOTE_SAVE vocabulary unaffected)"
        status: pass
      - kind: other
        ref: "grep np_conversation_meta: { area: 'local' } src/core/storage/Setting.ts == 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "WorkingMemory + WORKING_MEMORY_TEMPLATE in harness.ts (C.1), 23 STR.notes.* keys verbatim, verify:phase-5 script, d3-force@^3.0.0 install"
    requirement: KNW-05
    verification:
      - kind: other
        ref: "node -e package.json assertion (verify:phase-5 chain contains 'wxt build' + 'prettier --check'; d3-force dependency present)"
        status: pass
      - kind: other
        ref: "grep spot-check deleteConfirm/saveFailed/graphEmpty values byte-equal to 05-UI-SPEC Copywriting Contract L126-153"
        status: pass
      - kind: other
        ref: "pnpm exec tsc --noEmit (harness.ts + strings.ts compile)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-13
status: complete
---

# Phase 5 Plan 1: Phase-5 Foundation — R-1 Type Homes, Canonical Codes, Registry/Event/Verify Seams Summary

**Wave-1 foundation: Phase-5 memory types + UserPreferencesSchema at the C.1 home (R-1), five canonical error codes mirrored to spec C.2 (W-1), np_conversation_meta registry row (Pitfall 4), 'note:saved' event (Pitfall 7), WorkingMemory in harness.ts, 23 STR.notes.* keys, verify:phase-5 gate, d3-force@^3 install**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-13T22:58:57Z
- **Completed:** 2026-08-13T23:06:56Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `UserMemoryFact` (§3.4), `ConversationMemory` (§3.3), `ConversationMeta` (§21.3+§15.1), `MemoryInjection` (RESEARCH Pattern 3 DTO) + co-located `UserPreferencesSchema` (zod 3) landed in `src/core/memory/types.ts` — the R-1 home every store plan (05-02/03/04) imports; `RetrievedMemory`/`UserPreferences` byte-unchanged.
- Five Phase-5 canonical codes (MEMORY_RETRIEVAL_FAILED, MEMORY_EXTRACT_FAILED, NOTE_LINK_PARSE_FAILED, NOTE_GRAPH_FAILED, SEARCH_INDEX_REBUILD_FAILED) added to `errorCodes.ts` and mirrored into spec Appendix C.2 (W-1 gate precedent); stores reuse STORE_READ/STORE_WRITE per Open Q7.
- `np_conversation_meta: { area: 'local' }` registered in `Setting.ts` STORAGE_KEY_REGISTRY — Pitfall 4 closed so 05-03's LRU archive/evict never silently no-ops.
- `'note:saved'` added to `EVENT_TYPES` with `NOTE_SAVE` retained — Pitfall 7 closed; existing EventBus.test.ts suite (10 tests) stays green.
- `WorkingMemory` + `WORKING_MEMORY_TEMPLATE` (five-line §3.6 block verbatim) landed in `harness.ts` — the O.10 updater imports them from here.
- 23 new `STR.notes.*` keys appended verbatim from the 05-UI-SPEC Copywriting Contract (Golden Rule 2); existing keys reused, no new top-level STR group.
- `verify:phase-5` script added (§24 chain byte-identical to verify:phase-4b, D-05-19) and `d3-force@^3.0.0` installed (approved stack, audit OK — resolves to 3.0.0, A4 confirmed).

## Task Commits

Each task was committed atomically:

1. **Task 1: Land Phase-5 memory types + UserPreferencesSchema (R-1)** - `3017c79` (feat)
2. **Task 2: Phase-5 canonical codes + spec C.2 mirror + np_conversation_meta + note:saved** - `84bb1ff` (feat)
3. **Task 3: WorkingMemory + STR.notes.* keys + verify:phase-5 + d3-force install** - `ff1338b` (feat)

**Plan metadata:** `docs(05-01): complete phase-5 foundation plan` (final commit)

## Files Created/Modified

- `src/core/memory/types.ts` - Added UserMemoryFact, ConversationMemory, ConversationMeta, MemoryInjection interfaces + UserPreferencesSchema (zod 3) + zod import; existing shapes untouched
- `tests/core/memory/MemoryTypes.test.ts` - NEW: 8 tests — schema positive/negative gates (path-asserted issues) + tsc-enforced shape-parity fixtures incl. personaOverrides optionality
- `src/core/error/errorCodes.ts` - Phase-5 canonical 5-code block before UNKNOWN (Open Q7 vocabulary, W-1 mirror note)
- `.planning/PRODUCT_SPEC_v0_1.md` - Appendix C.2 Phase-5 mirror block (5 codes line-anchored)
- `src/core/storage/Setting.ts` - STORAGE_KEY_REGISTRY row `np_conversation_meta: { area: 'local' }` after np_persona
- `src/core/events/EventBus.ts` - EVENT_TYPES member `'note:saved'` after NOTE_SAVE (both literals present)
- `src/types/harness.ts` - WorkingMemory interface + WORKING_MEMORY_TEMPLATE (five-line §3.6 block verbatim) + section comment naming C.1 sources
- `src/core/i18n/strings.ts` - 23 new STR.notes.* keys verbatim from UI-SPEC Copywriting Contract
- `package.json` - `verify:phase-5` script (§24 chain) + `d3-force: ^3.0.0` dependency
- `pnpm-lock.yaml` - d3-force 3.0.0 lock entry

## Decisions Made

- **R-1 single homes:** Phase-5 memory types in `src/core/memory/types.ts`, WorkingMemory in `harness.ts` (Appendix C.1) — stores import, never re-declare (D-05-01).
- **Co-located Zod boundary schema:** `UserPreferencesSchema` sits beside `UserPreferences` (GR-4, harness.ts L211-251 precedent) — the np_persona write gate 05-04's PreferenceMemoryStore uses.
- **Closed Open Q7:** the Phase-5 code set is exactly the five canonical codes; stores reuse STORE_READ/STORE_WRITE for idb failures.
- **W-1 spec mirror:** C.2 mirror committed in the same commit as errorCodes.ts (single source of truth).
- **Pitfall 4/7 closed at the source:** np_conversation_meta registered, note:saved emitted — both verified landmines closed here, not deferred to store plans.
- **verify:phase-5 = §24 chain verbatim** (D-05-19), no test-count assertions (P-5).
- **d3-force@^3.0.0** — A4 flagged assumption confirmed: resolves to 3.0.0, dual ESM/CJS build compiles clean under WXT bundler (tsc green; full `wxt build` gate runs in later waves).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. One observation: `pnpm add d3-force@^3` reported "Already up to date" while adding `d3-force 3.0.0` — pnpm resolved the peer set without a reinstall; lockfile entry and node_modules both verified (A4 assumption confirmed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 05-02** (MemoryEngine + UserMemoryStore): imports `UserMemoryFact`, `MemoryInjection`, `WorkingMemory`, `WORKING_MEMORY_TEMPLATE` from the R-1 homes landed here.
- **Ready for 05-03** (ConversationMemoryStore): `ConversationMemory`/`ConversationMeta` shapes + `np_conversation_meta` registry row (LRU persistence contract) in place.
- **Ready for 05-04** (PreferenceMemoryStore): `UserPreferencesSchema` write gate in place; read path unchanged (D-05-18 no-regression contract).
- **Ready for 05-07/05-08** (Notes UI + graph): `'note:saved'` event + STR.notes.* keys both available; `SEARCH_INDEX_REBUILD_FAILED`/`NOTE_GRAPH_FAILED` codes available.
- **verify:phase-5** exists per D-05-19; the full gate (wxt build) completes when later waves add the §18 test files (05-08 gate task).

---
*Phase: 05-knowledge-base-memory-minisearch-notes*
*Completed: 2026-08-13*
