---
phase: 05-knowledge-base-memory-minisearch-notes
plan: 06
subsystem: memory, context, ai
tags: [memory-injection, context-optimizer, prompt-sections, working-memory, preferences, trust-gate, reduce-topk, hook-wiring]

# Dependency graph
requires:
  - phase: 05-knowledge-base-memory-minisearch-notes (05-04)
    provides: MemoryEngine.assemble (top-5/top-3-tiny/≤1000-token/working-memory-first budgets), MemoryInjection DTO { memories, workingMemoryBlock, preferences }
  - phase: 04-context-adaptive-execution (04-04)
    provides: ContextOptimizer.optimize with the §1.3 pack (dead preferences/memory slots) + the §2.4 degradation ladder
  - phase: 04b-trust-aware-context-and-receipts (04b-05)
    provides: TrustPrefs (np_trust) — the trustPrefs.memory gate source
provides:
  - ContextOptimizerInput.workingMemoryBlock? (additive, D-04-07 precedent)
  - ContextPack.buildMemorySectionText (working-memory FIRST + '- [score] content' lines, D-05-09) + buildPreferencesSectionText (compact JSON incl. persona overrides, D-05-08) — shared by pack AND the reduce-topk fallback
  - buildPackInput threads preferencesText + memoryText (dead slots REAL); no-memory path byte-identical
  - reduceMemoryTopK real: top-3 whole-item fallback via the shared formatter (Pitfall 5, D-04-13); optimizer ladder passes the memory source
  - useStreamingLLM: per-stage MemoryEngine.assemble (tier from the resolved StageInvocation window, Open Q3), trustPrefs.memory gate (Open Q6), persona/prefs from the store read (D-05-18), GR-3 data-only
affects: [05a (note memory upserts ride the same injection), Phase 7 (conversation-memory PROMPT injection), verify-work UAT, cache-prefix behavior (F-5/A6)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive input extension (D-04-07): ContextOptimizerInput.workingMemoryBlock? optional — existing construction sites compile unchanged"
    - "Shared section formatters (ContextPack) consumed by BOTH pack time and the compression fallback — the fallback text can never diverge from the pack format"
    - "MemoryEngine surface factory (getMemoryEngine): production store deps bound to openMemoryDB once; the hook never constructs stores inline (single-writer D-05-02)"

key-files:
  created: []
  modified:
    - src/core/ai/types.ts (ContextOptimizerInput.workingMemoryBlock?)
    - src/core/context/ContextPack.ts (buildMemorySectionText, buildPreferencesSectionText)
    - src/core/context/ContextOptimizer.ts (buildPackInput threading + ladder reduce-topk memory source)
    - src/core/context/ContextCompressor.ts (reduceMemoryTopK real)
    - src/core/memory/MemoryEngine.ts (getMemoryEngine surface factory)
    - src/components/pages/useStreamingLLM.ts (per-stage assemble + trustPrefs.memory gate + D-05-18 prefs)
    - tests/core/context/ContextOptimizer.test.ts (extended)
    - tests/components/pages/useStreamingLLM.test.tsx (MemoryEngine boundary mock + canonical pack updates)
    - tests/core/ai/persona/PersonaInjector.test.ts (canonical pack section-kind updates)

key-decisions:
  - "getMemoryEngine() singleton factory added to MemoryEngine.ts (plan Task 3 sanctioned option B): the hook imports the factory — it never constructs stores inline (D-05-02 single-writer); assemble opens the DB lazily, never-throws contract holds"
  - "The plan's 'no-memory path byte-identical' claim vs the always-on preferences slot: the plan's own code sketch threads preferencesText whenever input.preferences is truthy (D-05-08 — the dead slot becomes REAL), so the canonical Phase-5 pack includes the preferences section on the default path; the byte-identity regression now pins [SYSTEM][TOOL SCHEMAS][PREFERENCES][USER INPUT] + memory-section absence (documented deviation below)"
  - "Hook prefs/persona now read from plannerInjection.preferences (D-05-18) — readPersonaPrefs() removed from the hook; the hook test mocks the MemoryEngine boundary (assemble → empty memories + FIXED_PREFERENCES) instead of the personaConfig read"

requirements-completed: [KNW-05]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "ContextOptimizerInput.workingMemoryBlock? additive optional + ContextPack.buildMemorySectionText (working memory FIRST, '- [score] content' lines, D-05-09) + buildPreferencesSectionText (compact JSON incl. personaId/personaOverrides, D-05-08)"
    requirement: "KNW-05"
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#memoryHints + workingMemoryBlock + preferences → real stable memory (WMB first) + preferences sections"
        status: pass
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#preferences with personaId/personaOverrides → JSON.stringify includes them (D-05-08 compact JSON)"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildPackInput threads preferencesText + memoryText into the previously-dead §1.3 slots; no-memory path (empty hints + no working block) emits NO memory section — the memory-disabled gate regression pin"
    requirement: "KNW-05"
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#memoryHints [] + workingMemoryBlock undefined → NO memory section (the memory-disabled gate — regression pin)"
        status: pass
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#default path deep-equals the hardcoded snapshot (system/tool/preferences bytes; no memory section)"
        status: pass
    human_judgment: false
  - id: D3
    description: "reduceMemoryTopK real top-3 whole-item fallback (Pitfall 5/D-04-13): re-builds the memory section via the shared formatter, slice(0,3) item-level only, dropped ['memory']; backward-compat passthrough without memorySource; optimizer ladder passes the memory source"
    requirement: "KNW-05"
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#re-builds the memory section from EXACTLY the top-3 hints and reports the drop (whole items, never a substring)"
        status: pass
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#without memorySource → passthrough (backward compat, dropped [])"
        status: pass
    human_judgment: false
  - id: D4
    description: "useStreamingLLM calls MemoryEngine.assemble per stage (tier from the resolved StageInvocation window), gates memoryHints/workingMemoryBlock on trustPrefs.memory (Open Q6), derives persona/prefs from the planner injection (D-05-18) — GR-3 data-only, no prompt text"
    requirement: "KNW-05"
    verification:
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx#sends through runAgentTurn with an optimizer-built OptimizedContext (never React-assembled prompts)"
        status: pass
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx#per-stage tier divergence: planner tiny / renderer large — capsForTier receives the PLANNER tier (D-04-05, T-04-27)"
        status: pass
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx#drop-in regression: the default-path section bytes equal the canonical Phase-5 pack (D-05-08 slot REAL)"
        status: pass
    human_judgment: false

# Metrics
duration: 26 min
completed: 2026-08-14
status: complete
---

# Phase 05 Plan 06: Memory + Preferences wired into the context pipeline Summary

**The dead ContextPack preferences/memory slots become REAL: `ContextOptimizerInput.workingMemoryBlock?` (additive), `buildMemorySectionText` (working memory FIRST + '- [score] content' lines) + `buildPreferencesSectionText` (compact JSON) threaded through `buildPackInput`, `reduceMemoryTopK` realized as a top-3 whole-item fallback (Pitfall 5/D-04-13), and `useStreamingLLM` calling `MemoryEngine.assemble` per stage with the `trustPrefs.memory` gate (Open Q6) and store-derived persona/prefs (D-05-18).**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-14T02:25:21Z
- **Completed:** 2026-08-14T02:51:29Z
- **Tasks:** 3 (+1 collateral fix commit)
- **Files modified:** 9 (5 source + 3 test + 1 source factory host)

## Accomplishments

- `ContextOptimizerInput.workingMemoryBlock?` — additive optional field (D-04-07 precedent); every existing construction site compiles unchanged.
- `ContextPack.buildMemorySectionText` (working-memory block FIRST, then `- [0.87] content` fact lines — D-05-09 order pin; whole-item joins only) + `buildPreferencesSectionText` (compact JSON with deterministic key order incl. personaId/personaOverrides — D-05-08). Both shared by pack time AND the reduce-topk fallback so section text can never diverge.
- `buildPackInput` threads `preferencesText` + `memoryText` (spread only when non-empty) — the previously-dead §1.3 slots are REAL; empty hints + no working block → NO memory section (the memory-disabled gate, test-pinned).
- `reduceMemoryTopK(sections, memorySource?)` is REAL: rebuilds the memory section from `memorySource.memoryHints.slice(0, 3)` via the shared formatter (whole-item drops, D-04-13; tokens via estimateTokens, Pitfall 1); backward-compat passthrough without a memorySource; the optimizer ladder now passes the memory source.
- `useStreamingLLM`: per-stage `MemoryEngine.assemble` with the tier DERIVED from the resolved StageInvocation window (`classifyModelContext(plannerInv/rendererInv.modelContextWindow)`, T-04-22); `memoryHints`/`workingMemoryBlock` gated on `trustPrefs.memory` (Open Q6 — mirrors the 04b page gate); persona block + prefs now read from `plannerInjection.preferences` (D-05-18 store read replaces `readPersonaPrefs`); GR-3 — data only, no prompt assembly in the hook.
- `MemoryEngine.getMemoryEngine()` surface factory (plan-sanctioned option B): real store deps bound to `openMemoryDB` once — the hook never constructs stores inline (D-05-02 single-writer).
- `conversationId: 'default'` stays (A5); memory + preferences sections ride `stable:true` (F-5 contract — A6 cache-churn tradeoff documented, unchanged kinds/stability flags).

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread memory/preferences through ContextOptimizer (dead slots become real)** - `c2cc095` (feat)
2. **Task 2: Realize reduceMemoryTopK — whole-item fallback (Pitfall 5, D-04-13)** - `cf06a86` (feat)
3. **Task 3: Hook wiring — MemoryEngine.assemble per stage + trustPrefs.memory gate (GR-3)** - `91e4830` (feat)
4. **Collateral: PersonaInjector §2.3 shape tests — canonical pack now includes the REAL preferences slot** - `8a91de9` (fix)

**Plan metadata:** `(docs: complete 05-06 plan)` — metadata commit made by the execute-phase orchestrator after wave completion.

## Files Created/Modified

- `src/core/ai/types.ts` - `ContextOptimizerInput.workingMemoryBlock?: string` (additive, documented D-05-09)
- `src/core/context/ContextPack.ts` - `buildMemorySectionText({ memoryHints, workingMemoryBlock })` (WMB first, `- [score] content`, `parts.join('\n\n')`, returns undefined when empty) + `buildPreferencesSectionText(prefs)` (compact JSON); section-kind literals + stable:true emission UNCHANGED (F-5)
- `src/core/context/ContextOptimizer.ts` - `buildPackInput` threads `preferencesText`/`memoryText`; ladder `reduce-topk` passes `{ memoryHints: input.memoryHints, workingMemoryBlock: input.workingMemoryBlock }`; stamps the memory compression marker (WR-03)
- `src/core/context/ContextCompressor.ts` - `reduceMemoryTopK(sections, memorySource?)` real: top-3 whole-item rebuild via `buildMemorySectionText`, tokens via `estimateTokens`, same kind/sourceId/stable, dropped `['memory']`; passthrough when no memorySource / no memory section / unchanged text
- `src/core/memory/MemoryEngine.ts` - `getMemoryEngine()` + `MemoryEngineSurface` (lazy singleton, real store deps bound to `openMemoryDB`); imports switched to store namespaces
- `src/components/pages/useStreamingLLM.ts` - `assembleMemory(tier)` per stage via `getMemoryEngine().assemble({ query, conversationId: 'default', tier })`, `classifyModelContext` on both resolved windows, `trustPrefs.memory` gate on memoryHints/workingMemoryBlock, persona + prefs from `plannerInjection.preferences`, renderer rides its own injection's memories (preferences stage-independent)
- `tests/core/context/ContextOptimizer.test.ts` - extended: WMB-first order pin + stable/sourceId + JSON preferences section, memory-disabled no-section regression pin, persona-overrides compact JSON, reduce-topk top-3 exactness + whole-item no-substring, backward-compat passthrough, no-memory-section passthrough; drop-in snapshot updated to the canonical Phase-5 pack
- `tests/components/pages/useStreamingLLM.test.tsx` - MemoryEngine boundary mock (assemble → empty memories + FIXED_PREFERENCES); streaming-gate test re-gated on the assembly; drop-in regression pins the REAL preferences slot; no-currentPage kinds `[system, preferences, user_input]`
- `tests/core/ai/persona/PersonaInjector.test.ts` - §2.3 shape assertions updated to the canonical pack with the REAL preferences section

## Decisions Made

- **getMemoryEngine() factory (Task 3 option B):** the hook imports the factory instead of constructing stores inline — preserves the D-05-02 single-writer rule and keeps the hook thin (GR-3). MemoryEngine keeps structural DI for its own tests; the factory is the production surface seam the plan sanctioned.
- **Always-on preferences section:** the plan's code sketch threads `preferencesText` whenever `input.preferences` is truthy (D-05-08 — the dead slot becomes REAL), so the default path now carries the stable:true preferences section. The 'no-memory path byte-identical' claim is honored for the MEMORY section (empty hints + no block → no memory section) while the preferences presence is the intended Phase-5 change (documented deviation below).
- **Hook test boundary:** the personaConfig read mock was replaced by a MemoryEngine boundary mock (assemble → deterministic injection) — the hook's I/O boundary moved from the preferences read to the memory engine per the plan's rewire; the optimizer stays REAL in the tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's 'no-memory path byte-identical' claim vs the always-on preferences slot**
- **Found during:** Task 1 (test extension)
- **Issue:** The plan's own code sketch threads `preferencesText` whenever `input.preferences` is truthy, and every existing optimizer fixture (`baseInput`) always supplies `FIXED_PREFERENCES` — so the default path now emits a preferences section and the claimed byte-identity with the pre-5 snapshots (which asserted `[system, tool_schemas, user_input]`) was unachievable without contradicting D-05-08.
- **Fix:** Kept the plan's literal threading; updated the affected byte-identity expectations to the canonical Phase-5 pack: ContextOptimizer drop-in snapshot now `[system, tool_schemas, preferences, user_input]` + a memory-section-absence pin; section-granularity knownTexts includes the prefs JSON; hook drop-in regression now `[system, preferences, user_input]`; no-currentPage kinds `[system, preferences, user_input]`; PersonaInjector §2.3 shape assertions to the same canonical lists.
- **Files modified:** tests/core/context/ContextOptimizer.test.ts, tests/components/pages/useStreamingLLM.test.tsx, tests/core/ai/persona/PersonaInjector.test.ts
- **Verification:** full suite green (101 files / 916 tests)
- **Committed in:** c2cc095 (Task 1 commit) + 8a91de9 (PersonaInjector fix commit)

**2. [Rule 3 - Blocking] Hook test persona gate broke when readPersonaPrefs was removed**
- **Found during:** Task 3 (hook rewire)
- **Issue:** The plan removes `readPersonaPrefs()` from the hook (D-05-18 store read replaces it), but the hook test gated the 'goes streaming immediately' assertion on a gated `readPersonaPrefsMock` promise and derived the expected persona from that mock.
- **Fix:** Re-gated the streaming assertion on the first per-stage `MemoryEngine.assemble` call (the hook's new first async boundary after the synchronous streaming state) and mocked the MemoryEngine module boundary with a deterministic injection (`{ memories: [], workingMemoryBlock: '', preferences: FIXED_PREFERENCES }`) — the plan anticipated hook-test edits ("keep the import only where still needed").
- **Files modified:** tests/components/pages/useStreamingLLM.test.tsx
- **Verification:** `pnpm vitest run tests/components/pages --bail=1` green (4 files / 51 tests)
- **Committed in:** 91e4830 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking — both test-fixture alignments required by the plan's own instructed code changes)
**Impact on plan:** No source-behavior deviation from the plan's instructions — the production code follows the plan literally; both deviations align test expectations with the plan-instructed canonical output. No scope creep.

## Issues Encountered

- The plan's Task 3 acceptance grep `assembleMemory(` is satisfied (2 matches); `readPersonaPrefs` remains only in a comment (the import is gone). `getMemoryEngine()` required switching MemoryEngine's store imports to namespace form (`UserMemoryStore.WORKING_MEMORY_RESOURCE_ID` / `PreferenceMemoryStore.DEFAULT_USER_PREFERENCES`) — mechanical, no behavior change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **KNW-05 injection contract is wired end-to-end:** memory ≤1000 tokens / top-5 (top-3 tiny) lands in a real stable:true memory section (working memory first), preferences inject as compact JSON, the memory section is gated by the 04b trust envelope (T-05-20 mitigation, test-pinned), and reduceMemoryTopK is the real whole-item fallback behind MemoryEngine's per-tier budget (Pitfall 5 closed).
- **05a (notes→memory upsert seam):** MemoryExtractor + `MemoryEngine.addFacts` are the documented upsert seam; the injection pipeline this plan wired consumes whatever the extractor stores.
- **Phase 7 (conversation memory):** `conversationId: 'default'` stays (A5); per-conversation keying + conversation-summary PROMPT injection are the Phase-7 wiring, not touched here.
- **F-5/A6 tradeoff:** per-turn memory churn invalidates the anthropic cache prefix only when memory changes — documented; changing the stable:true memory/preferences flags requires an ADR.

---
*Phase: 05-knowledge-base-memory-minisearch-notes*
*Completed: 2026-08-14*

## Self-Check: PASSED

- [x] src/core/ai/types.ts exists (FOUND) — `workingMemoryBlock?: string;` at L162
- [x] src/core/context/ContextPack.ts exists (FOUND) — `buildMemorySectionText(` / `buildPreferencesSectionText(` / `parts.join('\n\n')` (grep ≥ 1 each)
- [x] src/core/context/ContextOptimizer.ts exists (FOUND) — both helper refs + ladder `{ memoryHints: input.memoryHints, workingMemoryBlock: input.workingMemoryBlock }`
- [x] src/core/context/ContextCompressor.ts exists (FOUND) — `memorySource.memoryHints.slice(0, 3)` + `buildMemorySectionText(`; old NO-OP marker grep = 0
- [x] src/core/memory/MemoryEngine.ts exists (FOUND) — `getMemoryEngine()` factory
- [x] src/components/pages/useStreamingLLM.ts exists (FOUND) — `assembleMemory(` = 2, `classifyModelContext(plannerInv/rendererInv.modelContextWindow)` = 1 each, `trustPrefs.memory ?` = 3, uncommented `memoryHints: [],` = 0, `You are` = 0, `join(\`\n\n\`)` = 0
- [x] tests/core/context/ContextOptimizer.test.ts exists (FOUND) — extended
- [x] tests/components/pages/useStreamingLLM.test.tsx exists (FOUND) — MemoryEngine boundary mock
- [x] tests/core/ai/persona/PersonaInjector.test.ts exists (FOUND) — canonical pack updates
- [x] Commit c2cc095 exists (git log)
- [x] Commit cf06a86 exists (git log)
- [x] Commit 91e4830 exists (git log)
- [x] Commit 8a91de9 exists (git log)
- [x] `pnpm vitest run tests/core/context --bail=1` → 10 files / 155 tests passed
- [x] `pnpm exec tsc --noEmit` → exit 0
- [x] `pnpm vitest run tests/components/pages --bail=1` → 4 files / 51 tests passed
- [x] Full suite `pnpm vitest run tests --bail=1` → 101 files / 916 tests passed
