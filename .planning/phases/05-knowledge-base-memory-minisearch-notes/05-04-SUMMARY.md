---
phase: 05-knowledge-base-memory-minisearch-notes
plan: 04
subsystem: memory
tags: [memory, injection, budgets, persona, structured-output, zod, orchestrator]

# Dependency graph
requires:
  - phase: 05-knowledge-base-memory-minisearch-notes (05-02)
    provides: UserMemoryStore (retrieve/readWorkingMemory/O.10 updater), PreferenceMemoryStore (np_persona read), MemoryDB userFacts v2
  - phase: 05-knowledge-base-memory-minisearch-notes (05-03)
    provides: ConversationMemoryStore (appendTurn/summariseIfNeeded compactor), conversation meta Setting layer
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: PersonaInjector PipelineStage 'memoryExtractor', PROMPTS.memoryExtractor.system, requestJson (Appendix L GR-4)
provides:
  - MemoryEngine — the SINGLE surface entry for memory (D-05-02): assemble() with §3.4 budgets (top-5/top-3 tiny/≤1000 tokens/working-memory-first), recordTurn/summariseIfNeeded dispatch, O.10 updateWorkingMemory routing, addFacts, subscribe
  - MemoryExtractor — haiku-tier LLM stage (D-05-10) via PersonaInjector('memoryExtractor') + requestJson, zod .max(10) bounded, one-repair GR-4, never throws
affects: [05-06 (hook calls assemble → memoryHints/preferences/workingMemoryBlock), 05a (NoteTagger/NoteQA memory-upsert seam), Phase 7 (conversation-memory PROMPT injection), verify-work UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural dependency injection (deps: { facts, prefs, conversation }) — stores injected, no singletons, deterministic tests"
    - "Whole-item budget degradation: top-5 → top-3 → empty via estimateTokens cap, never a mid-structure text slice (D-04-13/D-05-06)"
    - "F-4 sections-in for the LLM stage: byte-stable system prefix + per-call user_input turns (prompt-cache stability across the one repair)"

key-files:
  created:
    - src/core/memory/MemoryEngine.ts
    - src/core/memory/MemoryExtractor.ts
    - tests/core/memory/MemoryEngine.test.ts
    - tests/core/memory/MemoryExtractor.test.ts
  modified: []

key-decisions:
  - "assemble/recordTurn/updateWorkingMemory take db as the first argument (db, deps, opts) — the plan sketch omitted db but every store API (retrieve/readWorkingMemory/putWorkingMemory) requires it; the closed-db never-throws test pins the contract"
  - "zod 3.25 .default() infers `| undefined` at the type level (runtime defaults apply) — nullish fallbacks (?? [] / ?? 0.5 / ?? 'inferred') at the mapping boundary keep the cast honest"
  - "MemoryEngine exports WORKING_MEMORY_MAX_TOKENS per the task acceptance literal; the plan-level grep MAX_WORKING_MEMORY_TOKENS is already satisfied by UserMemoryStore.ts (05-02) — single home preserved, no duplicate constant"
  - "extractMemory defaults: providerId 'anthropic' + model 'claude-haiku-4-latest' (the canonical haiku pairing, D-04-06 map key) — caller overrides via ExtractMemoryOptions"

patterns-established:
  - "MemoryEngine is the ONLY surface entry (R-4/D-05-02): surfaces call assemble/recordTurn/updateWorkingMemory, never the individual stores"
  - "Budgets live in MemoryEngine (Pitfall 5): the 05-06 optimizer's reduceMemoryTopK stays a real fallback safety net"

requirements-completed: [KNW-04, KNW-05]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "MemoryEngine single-orchestrator surface — assemble() §3.4 budgets (top-5/top-3-tiny, ≤1000-token whole-item drops, working-memory-first, preferences), recordTurn/summariseIfNeeded dispatch, O.10 updateWorkingMemory, addFacts, subscribe, never-throws contract"
    requirement: "KNW-04"
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#§3.4 budgets (D-05-06 pin)"
        status: pass
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#≤1000-token cap (whole-item drops)"
        status: pass
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#working memory first + preferences"
        status: pass
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#updateWorkingMemory (O.10 routing)"
        status: pass
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#never throws (closed db)"
        status: pass
    human_judgment: false
  - id: D2
    description: "MemoryExtractor haiku-tier LLM stage — PersonaInjector('memoryExtractor') + requestJson routing, zod .max(10) bounded schema, one-repair GR-4, MEMORY_EXTRACT_FAILED + null on failure, R-10 log hygiene"
    requirement: "KNW-05"
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryExtractor.test.ts#valid extraction with zod defaults"
        status: pass
      - kind: unit
        ref: "tests/core/memory/MemoryExtractor.test.ts#GR-4 exactly one repair"
        status: pass
      - kind: unit
        ref: "tests/core/memory/MemoryExtractor.test.ts#STRUCTURED_OUTPUT_FAILED never throws"
        status: pass
      - kind: unit
        ref: "tests/core/memory/MemoryExtractor.test.ts#PersonaInjector route pin (GR-3/D-11)"
        status: pass
      - kind: unit
        ref: "tests/core/memory/MemoryExtractor.test.ts#schema boundary caps the call (R-2)"
        status: pass
    human_judgment: false

# Metrics
duration: 8 min
completed: 2026-08-14
status: complete
---

# Phase 05 Plan 04: MemoryEngine + MemoryExtractor Summary

**MemoryEngine — the single orchestrator entry for memory (D-05-02) with §3.4 budget enforcement (top-5/top-3-tiny/≤1000 tokens/working-memory-first) over the 05-02/05-03 stores, plus the haiku-tier MemoryExtractor LLM stage (D-05-10) routing through PersonaInjector('memoryExtractor') + requestJson (GR-3/GR-4, one repair, MEMORY_EXTRACT_FAILED, never throws).**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-14T00:42:21Z
- **Completed:** 2026-08-14T00:50:50Z
- **Tasks:** 2
- **Files modified:** 4 (2 source + 2 test files)

## Accomplishments

- `MemoryEngine.assemble()` — the D-05-02 single-surface injection builder: working-memory block read FIRST via `readWorkingMemory` (D-05-09 — never crowded out by facts), facts scored via MemoryScorer (scores in [0,1], desc, re-scored so the DTO carries real scores), budgets top-5/top-3-tiny + running ≤1000-token cap with whole-item drops from the end (never a fact-content slice, D-04-13/D-05-06), preferences from np_persona; every read degrades to safe empties, never throws.
- `MemoryEngine` write surface — `recordTurn`/`summariseIfNeeded` dispatch to ConversationMemoryStore (12-message compactor seam), `updateWorkingMemory` routes through the O.10 updater (TraceRedactor redaction + ≤300-token trim happen inside — the ONE sanctioned slice), `addFacts` single-writer batch for the 5a extractor callers, `subscribe` lightweight change-notification seam (fires `{ kind, conversationId? }` on turn/facts/working-memory).
- `MemoryExtractor` — `MemoryExtractorResultSchema` (zod 3, `.max(10)` bounded, R-2) + `extractMemory(turns, opts, callProviderJsonMode)`: EVERY AI call through `PersonaInjector.inject('memoryExtractor', PROMPTS.memoryExtractor.system, { persona, prefs })` (GR-3/D-11 — the Phase-3 seeded stage), F-4 sections-in (byte-stable system prefix + per-call user_input turns so the one repair never rebuilds the cached prefix), `requestJson` with exactly ONE repair then STRUCTURED_OUTPUT_FAILED (GR-4), maps results to UserMemoryFact (created/updated = injected nowMs, usage zeroed), and NEVER throws — any provider/structure failure logs `MEMORY_EXTRACT_FAILED` with operationId only (R-10, never raw model output) and returns null (§22.1 — the save path is never blocked).
- Structural dependency injection throughout — `assemble(db, deps, opts)` with `deps = { facts: UserMemoryStoreAPI; prefs: PreferenceMemoryStoreAPI; conversation: ConversationMemoryStoreAPI }` (no singletons; real store functions in prod, spies/fakes in tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: MemoryEngine — assemble budgets + orchestration surface (D-05-02/06/09)** - `e6f677f` (feat)
2. **Task 2: MemoryExtractor — haiku-tier LLM stage via PersonaInjector + requestJson (D-05-10)** - `31a718c` (feat)

**Plan metadata:** `(docs: complete 05-04 plan)` — metadata commit made by the execute-phase orchestrator after wave merge.

## Files Created/Modified

- `src/core/memory/MemoryEngine.ts` - MAX_MEMORY_TOKENS (1000), WORKING_MEMORY_MAX_TOKENS (300), MAX_MEMORIES (5), MAX_MEMORIES_TINY (3), AssembleOptions, MemoryEngineDeps + per-store API interfaces, `assemble(db, deps, opts)` → MemoryInjection, `recordTurn`, `summariseIfNeeded`, `updateWorkingMemory`, `addFacts`, `subscribe` — all never-throw write paths (GR-9 debugLog STORE_READ/STORE_WRITE)
- `src/core/memory/MemoryExtractor.ts` - MemoryExtractorResultSchema (zod 3, `.max(10)`), MemoryExtractorResult, ExtractMemoryOptions, `extractMemory(turns, opts, callProviderJsonMode)` → UserMemoryFact[] | null
- `tests/core/memory/MemoryEngine.test.ts` - 10 tests: budgets (medium 5 / tiny 3, scores [0,1] desc), DTO-score parity with MemoryScorer, ≤1000-token whole-item drop (prefix + intact), working-memory-first, preferences deep-equals, recordTurn/summariseIfNeeded dispatch + listener fire + unsubscribe, STORE_WRITE never-throws on rejecting fakes, O.10 routing (Name line, redaction, ≤300 trim) via real store, addFacts persist + listener, closed-db safe empties
- `tests/core/memory/MemoryExtractor.test.ts` - 6 tests: valid extraction with zod defaults, GR-4 one-repair recovery (2 attempts max), STRUCTURED_OUTPUT_FAILED → null + MEMORY_EXTRACT_FAILED log, provider rejection → null, PersonaInjector route pin (stage/system/opts + F-4 section shape), schema boundary (12 memories rejected, `.max(10)` asserted)

## Decisions Made

- **db threading:** `assemble/recordTurn/updateWorkingMemory` take `db` as the first argument (`db, deps, opts`) — the plan's sketch showed `assemble(deps, opts)` but every store API (retrieve/readWorkingMemory/putWorkingMemory) requires the MemoryDB handle; the closed-db never-throws test pins this contract.
- **DTO re-scoring:** `assemble` re-scores retrieved facts via MemoryScorer with the shared `[a-z0-9]{3,}` tokenization so `RetrievedMemory.score` carries the real §3.4 value in [0,1] (the store's `retrieve` returns sorted facts without scores).
- **zod 3.25 boundary cast:** `.default()` fields infer `| undefined` at the type level despite runtime defaults — nullish fallbacks at the mapping boundary keep the type honest.
- **extractMemory defaults:** providerId 'anthropic' + model 'claude-haiku-4-latest' (canonical haiku pairing) with a documented 30s timeout; the hook (05-06) overrides per call.
- **Constant naming:** MemoryEngine exports `WORKING_MEMORY_MAX_TOKENS` (task acceptance literal); `MAX_WORKING_MEMORY_TOKENS` stays single-homed in UserMemoryStore (05-02) — both plan-level greps satisfied, no duplicate constant.
- **subscribe scope:** module-level listener Set with defensive notify (a throwing listener never breaks the engine); tests unsubscribe to avoid cross-test leakage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] assemble() signature missing the db argument**
- **Found during:** Task 1 (MemoryEngine implementation)
- **Issue:** The plan action sketched `assemble(deps, opts)` but the spec'd read steps (`facts.readWorkingMemory(db)`, `facts.retrieve(db, query, nowMs)`) require the MemoryDB handle, and the plan's own test spec ("assemble against a closed db") needs it passed in.
- **Fix:** Threaded `db: IDBPDatabase<MemoryDBSchema>` as the first argument on `assemble`/`recordTurn`/`summariseIfNeeded`/`updateWorkingMemory`/`addFacts` — the deps stay structural (store API functions), db stays an explicit runtime input.
- **Files modified:** src/core/memory/MemoryEngine.ts
- **Verification:** all 10 MemoryEngine tests green including the closed-db never-throws pin
- **Committed in:** e6f677f (Task 1 commit)

**2. [Rule 1 - Bug] zod 3.25 `.default()` type-level `| undefined` broke the UserMemoryFact mapping**
- **Found during:** Task 2 (MemoryExtractor implementation)
- **Issue:** tsc rejected the map body — `MemoryExtractorResult` infers `tags: string[] | undefined` / `confidence: number | undefined` / `source: ... | undefined` even though zod applies the defaults at parse time.
- **Fix:** Nullish fallbacks (`m.tags ?? []`, `m.confidence ?? 0.5`, `m.source ?? 'inferred'`) at the mapping boundary — runtime defaults still apply, the type is honest.
- **Files modified:** src/core/memory/MemoryExtractor.ts
- **Verification:** tsc --noEmit exit 0; all 6 MemoryExtractor tests green
- **Committed in:** 31a718c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking signature completeness, 1 type-correctness)
**Impact on plan:** Both fixes necessary for compile/type correctness; zero scope creep — no behavior beyond the plan's spec.

## Issues Encountered

None — both deviations resolved within their task commits; the plan's verification suite (MemoryEngine + MemoryExtractor + full `tests/core/memory` + `tsc --noEmit`) passed green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **05-06 (hook wiring):** `memoryEngine.assemble({ query, conversationId, tier, nowMs })` is the exact input the ContextOptimizer hook needs — `injection.memories` → `memoryHints`, `injection.workingMemoryBlock` → memory section prefix, `injection.preferences` → preferences section (D-05-07/08/09); per-tier budgeting is DONE here, `reduceMemoryTopK` stays the 05-06 fallback.
- **05a (notes→memory upsert seam):** MemoryExtractor's schema + `PROMPTS.memoryExtractor.system` + PersonaInjector('memoryExtractor') are the documented seam for NoteTagger/NoteQA memory upserts (§3.4 note, D-05) — the ONLY notes→memory direction.
- **Phase 7 (conversation memory):** `recordTurn`/`summariseIfNeeded`/ConversationMemoryStore ship fully; PROMPT injection of summary + recent turns is M2/Phase-7 wiring (A5 documented seam).

---

*Phase: 05-knowledge-base-memory-minisearch-notes*
*Completed: 2026-08-14*

## Self-Check: PASSED

- [x] `src/core/memory/MemoryEngine.ts` exists (FOUND)
- [x] `src/core/memory/MemoryExtractor.ts` exists (FOUND)
- [x] `tests/core/memory/MemoryEngine.test.ts` exists (FOUND)
- [x] `tests/core/memory/MemoryExtractor.test.ts` exists (FOUND)
- [x] Commit e6f677f exists (git log)
- [x] Commit 31a718c exists (git log)
- [x] `pnpm vitest run tests/core/memory/MemoryEngine.test.ts --bail=1` → 10 passed
- [x] `pnpm vitest run tests/core/memory/MemoryExtractor.test.ts --bail=1` → 6 passed
- [x] `pnpm vitest run tests/core/memory --bail=1` → 7 files / 67 tests passed
- [x] `pnpm exec tsc --noEmit` → exit 0
- [x] Acceptance greps: MAX_MEMORY_TOKENS / WORKING_MEMORY_MAX_TOKENS / `opts.tier === 'tiny'` + MAX_MEMORIES_TINY/MAX_MEMORIES present; no `slice(` and no `chrome.` in MemoryEngine.ts; no `throw` in extractMemory; no content field in extractor debugLog extra
