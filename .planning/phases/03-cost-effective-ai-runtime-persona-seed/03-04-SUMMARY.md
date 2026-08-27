---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 04
subsystem: ai-runtime
tags: [chunk-buffer, prompt-cache, fnv-1a, tool-schemas, executor, renderer, active-stream-state]

# Dependency graph
requires:
  - phase: 03
    plan: 01
    provides: A8 PromptSection shape, ILLMProvider interface + canonical StreamEvent union (D-47), ToolExecutionResult, canonical Appendix A PROMPTS, zero-tool closed-enum specialization
  - phase: 03
    plan: 02
    provides: PersonaInjector.inject (persona-first byte-stable block, RICH-R-02/D-59), DEFAULT_PERSONA, UserPreferences + np_preferences
  - phase: 02
    provides: WorkspaceStore ActiveSurface export (line 11), NP-STRICT ceiling 0
provides:
  - PromptCacheManager.buildSystemPrompt — the D-59 single system-prompt assembly point (only PersonaInjector call site, grep-verified == 1); §1.3 section order; profile-version cache key (Open Q5); §19.13 5-miss → 60 s disable
  - PromptCacheAdapter.applyCacheHints + hashStableSections (FNV-1a 32-bit) — Appendix K verbatim (anthropic ≤4 ephemeral breakpoints, gemini ≥32768 cachedContent, openai/ollama stableFirst prefix-only)
  - ChunkBuffer (Appendix J verbatim) — rAF batching + 8 kB/s → 33 ms upgrade, zero chrome.storage access (P2/D-45)
  - toolSchemas (D-46) — ToolDefinition + ToolCapabilityManifest (TOL-01) declared now, ZERO tools registered, RegisteredToolNameSchema closed-enum generation contract
  - ExecutorService.execute — closed-enum TOOL_REJECTED for every run_tool in Phase 3 (§21.6, D-38)
  - RendererService.render — 512-token default cap (DEFAULT_MAX_OUTPUT_TOKENS, override param = data not hard-coded, Open Q4), verbatim relay, abort → STREAM_ABORTED
  - ActiveStreamState (§20.6) in workerState.ts importing ActiveSurface
affects: [03-05 ProviderRegistry/TierResolver/ProviderRouter (tool registry + cache-hint consumers), 03-06 AgentOrchestrator (consumes buildSystemPrompt/execute/render), 03-07 chat wiring (ChunkBuffer UI subscription), Phase 5 ContextOptimizer (A8 section shape), Phase 8 memory (UserPreferences supersession)]

actuals:
  tokens: 13718     # chars/4 over the 13 files changed (54,871 chars)
  tasks: 3          # tasks completed
  commits: 7        # commits made (3 task + 3 additive test + 1 docs)

# Tech tracking
tech-stack:
  added: []          # no new dependencies
  patterns: [spec-Appendix verbatim implementation ("do not paraphrase"), D-59 single-choke-point prompt assembly, closed-enum zero-tool specialization (never z.enum([])), cap-as-data override param, module-level cache-disable state with injectable time]

key-files:
  created:
    - src/core/ai/ChunkBuffer.ts
    - src/core/ai/PromptCacheAdapter.ts
    - src/core/ai/PromptCacheManager.ts
    - src/core/ai/toolSchemas.ts
    - src/core/ai/ExecutorService.ts
    - src/core/ai/RendererService.ts
    - tests/core/ai/ExecutorService.test.ts
    - tests/core/ai/RendererService.test.ts
    - tests/core/ai/PromptCacheAdapter.test.ts
    - tests/core/ai/ChunkBuffer.test.ts
    - tests/core/ai/PromptCacheManager.test.ts
  modified:
    - src/core/runtime/workerState.ts
    - src/core/ai/types.ts

key-decisions:
  - "Executor stage canonical string is a reserved local constant in PromptCacheManager — Appendix A defines planner/renderer/memoryExtractor but no executor entry; §1.2's ExecutorService is deterministic and Phase 3 registers zero tools, so the reserved persona-free string is never sent to a model; a tool-owning phase may replace it with a canonical Appendix A entry"
  - "buildSystemPrompt returns {sections, cacheKeyHash, cacheDisabled} — the assembled PromptSection[] (not a bare string) so 03-06 can drive PromptCacheAdapter.applyCacheHints per provider; cacheDisabled flags the §19.13 window"
  - "Cache key = profile-version hash over the persona block via resolvePersona + buildPersonaBlock (the same exported helpers PersonaInjector uses) — the inject call itself stays the single call site (D-59 grep == 1) while override changes re-derive the hash with no invalidation API (Open Q5)"
  - "ToolExecutionResult gains an additive optional code?: string (types.ts) — the plan's own acceptance criterion (b) demands a typed rejection code; without it the §1.2 return contract cannot carry §21.6 TOOL_REJECTED"
  - "RendererService tracks a synchronous char counter for the cap — reading fullText (ChunkBuffer-flush-lagged) would let a fast provider stream unbounded text before the first rAF flush (bug found and fixed in-task)"
  - "§19.13 disable state is module-level with injectable `now` on recordCacheResult/isCacheDisabled for deterministic testing"

patterns-established:
  - "Spec-Appendix verbatim: ChunkBuffer (J.1), PromptCacheAdapter (K), ActiveStreamState (§20.6) copied byte-for-byte from PRODUCT_SPEC_v0_1.md including quirks (cancelAnimationFrame on setTimeout ids) — the drift guard from 03-RESEARCH Key Insight"
  - "D-59 choke-point: exactly one PersonaInjector call site in src/ (grep-assertable == 1); every stage system prompt assembles persona-first through buildSystemPrompt"
  - "Zero-tool specialization: RegisteredToolNameSchema([]) → z.never() (03-01's 'never z.enum([])' rule extended to the executor boundary); ToolRegistry starts empty"
  - "Cap-as-data: DEFAULT_MAX_OUTPUT_TOKENS is the single constant; maxOutputTokens override param on render (Open Q4 — never hard-coded in the loop)"
  - "Test-hook discipline: §19.13 module state tested with future-anchored synthetic timestamps so windows never collide with the real clock"

requirements-completed: [RICH-R-02, RICH-R-10]

coverage:
  - id: D1
    description: "ChunkBuffer (Appendix J verbatim) — enqueue/onFlush/flushNow/reset with rAF batching and the 8 kB/s → 33 ms upgrade rule; zero chrome.storage access (P2 write-rate prohibition, D-45)"
    requirement: "RICH-R-02"
    verification:
      - kind: unit
        ref: "tests/core/ai/ChunkBuffer.test.ts#enqueue + flushNow delivers the cumulative text to subscribers"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ChunkBuffer.test.ts#onFlush returns an unsubscribe function"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ChunkBuffer.test.ts#reset clears the pending + accumulated text"
        status: pass
      - kind: other
        ref: "grep: zero chrome.storage code access in src/core/ai/ChunkBuffer.ts (comment-filtered negative gate); tsc strict-clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "PromptCacheAdapter (Appendix K verbatim) — anthropic cache_control ephemeral on ≤4 stable sections (5th → 400), gemini cachedContent split only at stableTokens ≥ 32768 else prefix-only, openai/ollama stableFirst sort + prefix-only; hashStableSections = FNV-1a 32-bit over NUL-joined stable texts"
    requirement: "RICH-R-02"
    verification:
      - kind: unit
        ref: "tests/core/ai/PromptCacheAdapter.test.ts#marks cache_control ephemeral on at most 4 stable sections"
        status: pass
      - kind: unit
        ref: "tests/core/ai/PromptCacheAdapter.test.ts#below the minimum → inline + prefix-only (never cachedContent)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/PromptCacheAdapter.test.ts#at/above 32768 → cachedContent split"
        status: pass
      - kind: unit
        ref: "tests/core/ai/PromptCacheAdapter.test.ts#matches the FNV-1a 32-bit reference vectors (offset 2166136261, prime 16777619)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ActiveStreamState (§20.6 verbatim) added to workerState.ts — idle/preparing/streaming/waiting-for-permission/aborting/completed/failed, importing ActiveSurface from WorkspaceStore; existing BackgroundWorkerState exports unchanged; canonical events map onto it (STREAM_START→preparing/streaming, STREAM_COMPLETE→completed, STREAM_ERROR→failed, STREAM_ABORTED→aborting)"
    requirement: "RICH-R-10"
    verification:
      - kind: other
        ref: "pnpm run verify:phase-3 (tsc --noEmit strict-clean compiles the union with the ActiveSurface import)"
        status: pass
    human_judgment: true
    rationale: "Type-level deliverable — the compiler proves the union type-checks, but the event→state mapping is exercised end-to-end only when 03-06's AgentOrchestrator consumes it; verifier must classify that integration"
  - id: D4
    description: "PromptCacheManager.buildSystemPrompt — the D-59 single system-prompt assembly point: persona block prepended FIRST inside the cached [SYSTEM], byte-stable per persona; §1.3 canonical section order; cache key = profile-version hash over the persona block (Open Q5, override change re-derives without an invalidation API); §19.13 5-consecutive-miss → 60 s disable"
    requirement: "RICH-R-02"
    verification:
      - kind: unit
        ref: "tests/core/ai/PromptCacheManager.test.ts#prepends the byte-stable persona block FIRST inside [SYSTEM]"
        status: pass
      - kind: unit
        ref: "tests/core/ai/PromptCacheManager.test.ts#assembles the §1.3 canonical section order"
        status: pass
      - kind: unit
        ref: "tests/core/ai/PromptCacheManager.test.ts#re-derives the cache key when persona overrides change (Open Q5 — no invalidation API)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/PromptCacheManager.test.ts#exports CACHE_DISABLE_MISS_THRESHOLD = 5 and disables after 5 misses"
        status: pass
      - kind: other
        ref: "grep -rn \"PersonaInjector.inject\" src/ | wc -l == 1 (the D-59 invariant)"
        status: pass
    human_judgment: false
  - id: D5
    description: "toolSchemas (D-46 declare-now/populate-later) + ExecutorService — ToolDefinition/ToolCapabilityManifest declared with ZERO tools registered; RegisteredToolNameSchema closed-enum generation contract (empty → z.never(), never z.enum([])); execute() rejects every direct or test-injected run_tool with a TYPED TOOL_REJECTED result (§21.6, no invented codes)"
    requirement: "RICH-R-10"
    verification:
      - kind: unit
        ref: "tests/core/ai/ExecutorService.test.ts#(a) every run_tool is rejected while zero tools are registered"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ExecutorService.test.ts#(b) the rejection is typed — ToolRejectedResult with code TOOL_REJECTED"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ExecutorService.test.ts#(c) empty registry → schema that rejects every name (never z.enum([]))"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ExecutorService.test.ts#(c) the ToolRegistry starts EMPTY — zero tools registered in Phase 3"
        status: pass
    human_judgment: false
  - id: D6
    description: "RendererService.render — streams the final answer (fast tier, D-55) via ILLMProvider.stream canonical events into a ChunkBuffer; DEFAULT_MAX_OUTPUT_TOKENS = 512 with a per-feature override param (Open Q4 — cap is data); verbatim relay (no invented facts); abort mid-stream surfaces STREAM_ABORTED and stops"
    requirement: "RICH-R-10"
    verification:
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#(a) a stream longer than 512 tokens is truncated at the default cap"
        status: pass
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#(b) the override param lowers the cap"
        status: pass
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#(c) the streamed text equals the model output verbatim"
        status: pass
      - kind: unit
        ref: "tests/core/ai/RendererService.test.ts#(d) abort surfaces STREAM_ABORTED and stops"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-08-27
status: complete
---

# Phase 3 Plan 4: Prompt Assembly Layer (D-59) + Pipeline Stages Summary

**The D-59 single choke-point (PromptCacheManager.buildSystemPrompt — the only PersonaInjector call site in src/) with Appendix J/K verbatim ChunkBuffer + PromptCacheAdapter, the D-46 zero-tool toolSchemas/ExecutorService TOOL_REJECTED contract, the RendererService 512-token cap with per-feature override, and the §20.6 ActiveStreamState in workerState.ts**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-27T21:21:18Z
- **Completed:** 2026-08-27T21:31:39Z
- **Tasks:** 3
- **Files modified:** 13 (6 source created, 2 modified, 5 test files)

## Accomplishments

- **D-59 single choke-point proven:** `PromptCacheManager.buildSystemPrompt(stage, opts)` is the ONLY `PersonaInjector.inject` call site in `src/` (grep-verified == 1). Every stage system prompt in the phase is persona-first and byte-stable per persona (RICH-R-02/RICH-R-10) — the prompt-cache preservation invariant from §1.3. Test-asserted: persona block prepended FIRST inside the cached [SYSTEM], canonical Appendix A string follows.
- **Appendix J/K verbatim:** `ChunkBuffer` (rAF batching + 8 kB/s → 33 ms upgrade, zero chrome.storage access — P2/D-45) and `PromptCacheAdapter.applyCacheHints` (anthropic ≤4 ephemeral breakpoints — a 5th → 400, gemini cachedContent only at ≥32768 tokens — else prefix-only, openai/ollama stableFirst) copied byte-for-byte from the spec, with `hashStableSections` = FNV-1a 32-bit proven against reference vectors.
- **Open Q5 cache invalidation resolved:** the [SYSTEM] cache key is the profile-version hash over the persona block — persona-override changes re-derive the hash and emit a new byte-stable block; no explicit invalidation API. §19.13's 5-consecutive-miss → 60 s disable rule ships with `CACHE_DISABLE_MISS_THRESHOLD = 5` and `cacheDisabled` surfaced on the build result.
- **D-46 zero-tool contract:** `toolSchemas.ts` declares ToolDefinition + ToolCapabilityManifest (TOL-01) with ZERO tools registered; `RegisteredToolNameSchema` is the closed-enum generation contract (empty registry → `z.never()`, never `z.enum([])`). `ExecutorService.execute` rejects every run_tool with a **typed** `TOOL_REJECTED` result (§21.6, no invented codes).
- **RendererService 512-cap as DATA (Open Q4):** `DEFAULT_MAX_OUTPUT_TOKENS = 512` is the single cap constant; `maxOutputTokens` override param raises/lowers it per feature; output relayed verbatim (no invented facts); abort mid-stream surfaces STREAM_ABORTED and stops. The cap is enforced at delta granularity on a synchronous char counter — the flush-lagged buffer text would otherwise let a fast provider stream unbounded output.
- **§20.6 ActiveStreamState** added to `workerState.ts` (idle/preparing/streaming/waiting-for-permission/aborting/completed/failed) importing `ActiveSurface` from WorkspaceStore; the existing BackgroundWorkerState exports are untouched. The canonical stream events map onto it (STREAM_START→preparing/streaming, STREAM_COMPLETE→completed, STREAM_ERROR→failed, STREAM_ABORTED→aborting).
- **33 new tests** (93 total in the phase gate) across 5 files — ExecutorService (6), RendererService (5), PromptCacheAdapter (9), ChunkBuffer (5), PromptCacheManager (8) — all green under `pnpm run verify:phase-3` (tsc strict-clean, NP-STRICT ceiling 0 held).

## Task Commits

Each task was committed atomically:

1. **Task 1: ChunkBuffer (Appendix J) + PromptCacheAdapter (Appendix K) + ActiveStreamState (§20.6)** - `2fac38e` (feat)
2. **Task 2: PromptCacheManager (D-59 choke-point) + toolSchemas (D-46) + ExecutorService (TOOL_REJECTED)** - `8eb98ab` (feat)
3. **Task 3: RendererService — 512-token cap + no invented facts** - `f374b14` (feat)

**Additive contract tests (Rule 2 deviation, 03-02 precedent):** `051b494` (test: PromptCacheAdapter + ChunkBuffer), `117d23b` (test: PromptCacheManager)

**Plan metadata:** `pending` (committed with this SUMMARY)

## Files Created/Modified

- `src/core/ai/ChunkBuffer.ts` - Appendix J verbatim: `createChunkBuffer` (enqueue/onFlush/flushNow/reset), rAF batching + 8 kB/s → 33 ms setTimeout upgrade; zero chrome.storage access (P2/D-45)
- `src/core/ai/PromptCacheAdapter.ts` - Appendix K verbatim: `applyCacheHints` per provider (anthropic ≤4 ephemeral breakpoints, gemini ≥32768 cachedContent else prefix-only, openai/ollama stableFirst), `hashStableSections` FNV-1a 32-bit, `ANTHROPIC_MAX_BREAKPOINTS=4`, `GEMINI_MIN_CACHED_TOKENS=32768`; consumes the A8 PromptSection from ./types
- `src/core/ai/PromptCacheManager.ts` - D-59 single choke-point: `buildSystemPrompt(stage, {prefs, persona, toolNames, task, userInput})` → {sections, cacheKeyHash, cacheDisabled}; profile-version cache key (Open Q5); §19.13 disable rule via `recordCacheResult`/`isCacheDisabled`; `CACHE_DISABLE_MISS_THRESHOLD=5`
- `src/core/ai/toolSchemas.ts` - D-46: `ToolDefinition`, `ToolCapabilityManifest` (TOL-01 fields), `RegisteredToolNameSchema` closed-enum generation contract, `ToolRegistry` (starts empty)
- `src/core/ai/ExecutorService.ts` - §1.2: `execute` narrows toolName against the closed enum, every run_tool → typed `TOOL_REJECTED` (`code` field), `TOOL_REJECTED` constant
- `src/core/ai/RendererService.ts` - §1.2/§1.3: `render` streams via ILLMProvider.stream into a ChunkBuffer, `DEFAULT_MAX_OUTPUT_TOKENS=512` + override param, verbatim relay, abort → STREAM_ABORTED; consumes canonical D-47 events, re-emits for state machines
- `src/core/runtime/workerState.ts` - ADD `ActiveStreamState` (§20.6 verbatim) importing `ActiveSurface` from WorkspaceStore; existing BackgroundWorkerState exports unchanged
- `src/core/ai/types.ts` - additive `code?: string` on `ToolExecutionResult` (typed-rejection contract, §21.6)
- `tests/core/ai/ExecutorService.test.ts` - 6 tests / 3 case groups (reject-all, typed rejection, closed-enum contract + empty registry)
- `tests/core/ai/RendererService.test.ts` - 5 tests / 4 case groups (default-cap truncation, override raises/lowers, verbatim relay, abort surfaces STREAM_ABORTED)
- `tests/core/ai/PromptCacheAdapter.test.ts` - 9 tests (breakpoint cap, gemini threshold, stableFirst ordering, FNV-1a reference vectors, NUL-join, unstable filtering)
- `tests/core/ai/ChunkBuffer.test.ts` - 5 tests (cumulative flush, unsubscribe, multi-flush accumulation, reset, empty flush)
- `tests/core/ai/PromptCacheManager.test.ts` - 8 tests (persona-first [SYSTEM], §1.3 order, byte-stability, Open Q5 re-derivation, executor stage, §19.13 disable window + hit reset + cacheDisabled surfacing)

## Decisions Made

- **Executor stage canonical string is a reserved local constant** (`EXECUTOR_SYSTEM` in PromptCacheManager): Appendix A defines planner/renderer/memoryExtractor but no executor entry; §1.2's ExecutorService is deterministic ("The LLM never executes tools directly") and Phase 3 registers zero tools, so the persona-free reserved string is never sent to a model. A tool-owning phase may promote it to a canonical Appendix A entry.
- **`buildSystemPrompt` returns the assembled `PromptSection[]`** (not a bare string) — the caller (03-06 AgentOrchestrator) drives `PromptCacheAdapter.applyCacheHints` per provider; `cacheDisabled` flags the §19.13 window so the caller skips hints.
- **Cache key computed from the exported persona helpers** (`resolvePersona` + `buildPersonaBlock`), keeping `PersonaInjector.inject` as the single call site (D-59 grep == 1) while the hash re-derives on override change — no invalidation API (Open Q5).
- **Additive `code?: string` on ToolExecutionResult** (types.ts): the plan's own acceptance criterion (b) demands a typed rejection code; the §1.2 return contract carries `TOOL_REJECTED` (§21.6). Backward compatible.
- **Cap enforced on a synchronous char counter** in RendererService: the ChunkBuffer's flush-lagged `fullText` would let a fast provider stream unbounded text before the first rAF flush (found + fixed in-task; the initial implementation read `fullText` and truncated never).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RendererService cap check read the flush-lagged buffer text**
- **Found during:** Task 3 (RendererService tests — first run: 2 truncation tests failed)
- **Issue:** The cap check read `fullText`, which only advances on ChunkBuffer flush (rAF/33 ms batching). During a fast synchronous stream every delta enqueued before the first flush, so the check never saw the accumulated text and nothing was ever truncated.
- **Fix:** Track `accumulatedChars` synchronously on each enqueue; the cap check uses `estimateCharsTokens(accumulatedChars + delta.length)` — delta-granularity truncation keeps the relay verbatim (never partially enqueues model output).
- **Files modified:** src/core/ai/RendererService.ts
- **Verification:** truncation tests (a) + (b) green; 93-test phase gate green
- **Committed in:** f374b14 (Task 3 commit)

**2. [Rule 2 - Missing Critical] Added PromptCacheAdapter/ChunkBuffer/PromptCacheManager contract tests**
- **Found during:** coverage classification for this SUMMARY (Task 1 + Task 2 acceptance criteria are behavioral)
- **Issue:** Task 1's criteria ("with the verbatim branch logic") and Task 2's Open Q5/§19.13 behaviors were only provable via grep/tsc — no deterministic test existed (plan inventory lists only ExecutorService/RendererService tests). The 03-02 precedent (UserPreferences.test.ts added under Rule 2) applies identically.
- **Fix:** Added `tests/core/ai/PromptCacheAdapter.test.ts` (9 tests incl. FNV-1a reference vectors), `tests/core/ai/ChunkBuffer.test.ts` (5 tests), `tests/core/ai/PromptCacheManager.test.ts` (8 tests incl. Open Q5 re-derivation + §19.13 disable window). All additive, within the gated `tests/core/ai` path.
- **Files modified:** 3 new test files
- **Verification:** 93-test phase gate green
- **Committed in:** 051b494, 117d23b (additive test commits)

**3. [Rule 3 - Blocking] D-59 grep gate matched comments, not just the call site**
- **Found during:** Task 2 verification (grep returned 4, expected 1)
- **Issue:** The plan's acceptance gate `grep -rn "PersonaInjector.inject" src/ | wc -l` == 1 matches the literal pattern in comments (incl. the quoted grep command itself) — 3 of the 4 hits were doc comments.
- **Fix:** Reworded PromptCacheManager doc comments to avoid the literal pattern (e.g. "PersonaInjector's inject function") — the sole remaining hit is the actual call site.
- **Files modified:** src/core/ai/PromptCacheManager.ts
- **Verification:** `grep -rn "PersonaInjector.inject" src/ | wc -l` == 1
- **Committed in:** 8eb98ab (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All three were required for correctness or acceptance-proof completeness. No scope creep — all shipped files match the plan's inventory plus three additive test files (Rule 2 precedent from 03-02).

## Issues Encountered

- The §19.13 disable-state tests initially failed because the module-level disable window from an earlier test overlapped the next test's synthetic timeline (and `buildSystemPrompt` uses the real clock). Resolved with future-anchored timestamps (`Date.now() + N·1e6`) so each window is self-contained and order-independent — documented in the test file.
- `ScriptedStreamProvider` needed a union constructor (bare `AsyncIterable` | generator function) to accept both script styles — a test-only type-shape fix, resolved within the task.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 03-05 (ProviderRegistry/TierResolver/ProviderRouter):** the tool registry contract (`ToolRegistry.getAll()`, zero tools) and the cache-hint consumer contract (`buildSystemPrompt` → `applyCacheHints`) are in place; ActiveStreamState is the state shape the router surface wiring will drive.
- **Ready for 03-06 (AgentOrchestrator):** the full stage pipeline is consumable — `buildSystemPrompt(stage, opts)` → per-provider `applyCacheHints` → `PlannerService.plan` → `ExecutorService.execute` (closed enum) → `RendererService.render` (cap + ChunkBuffer) with `ActiveStreamState` transitions on the canonical events. The 03-06 end-to-end test asserts the RICH-R-09 flagged assumption (persona sharing by construction via the single choke-point).
- **Ready for 03-07 (chat wiring):** `RendererService.onFlush`/`onEvent` subscriptions and `createChunkBuffer` are the UI consumption path; the `np_active_stream` recovery shape (§20.6) exists.
- **Watch item (carried from 03-01):** `pnpm run verify:phase-3` covers `tests/core/ai` + `tests/core/ai/persona` — all new test files stayed within those paths.

---

*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-27*
## Self-Check: PASSED

- All 9 source/test files + SUMMARY.md exist on disk (verified via `[ -f ]` checks)
- All 6 commits found in git log: 2fac38e (Task 1), 8eb98ab (Task 2), f374b14 (Task 3), 051b494 (PromptCacheAdapter+ChunkBuffer tests), 117d23b (PromptCacheManager tests), 323d1ee (docs)
- `pnpm run verify:phase-3` green: tsc strict-clean + 93 tests across 12 files
- D-59 invariant: `grep -rn "PersonaInjector.inject" src/ | wc -l` == 1 (sole call site in PromptCacheManager)
- Comment-filtered negative gate: zero chrome.storage code access in ChunkBuffer.ts
- No `@ts-expect-error NP-STRICT` markers in new code (NP-STRICT ceiling 0 held)
