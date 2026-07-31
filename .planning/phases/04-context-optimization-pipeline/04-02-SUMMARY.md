---
phase: 04-context-optimization-pipeline
plan: 02
subsystem: ai-core
tags: [context-optimization, degradation-pipeline, minimal-mode, ai-summarization, typescript]

# Dependency graph
requires:
  - phase: 04-context-optimization-pipeline (plan 01)
    provides: ContextOptimizer.optimize() assembly + budget check seam, TokenBudget.estimateTokens, provenance helpers (recordSection/markCompression), CONTEXT_TOO_LARGE code, tier classification
provides:
  - ContextCompressor with 7 ordered degradation steps (drop-debug → drop-secondary → summarise-history → compress-page → trim-tools → reduce-memory → minimal-mode) per D-07, with stepwise budget re-check and early stop
  - AI summarization overflow path (D-06/D-08): single call via compression model provider, graceful fallback on failure (T-04-08/T-04-09)
  - ProviderRouter.getCompressionModel() — cheapest available summarization-capable provider, independent of conversation tier, null instead of throw
  - ContextOptimizer degradation loop (step 3.5): compress when over budget, CONTEXT_TOO_LARGE with token counts after all steps fail
  - Provenance compressionApplied recording (summarise/structural/topk) per D-07; minimalMode flag = tiny tier OR 'minimal-mode' step ran
affects: [04-03 cache plan (minimalMode/stepsApplied feeding cache decisions), 06-telemetry (provenance diagnostics), verifier (must_have truths D-06/D-07/D-08)]

# Tech tracking
tech-stack:
  added: []  # no new dependencies — degradation uses existing 'ai' generateText + TokenBudget heuristics
  patterns: [degradation pipeline with stepwise budget check (RESEARCH Pattern 3), private static readonly STEPS policy constant (T-04-07), module-level singleton (contextCompressor), new-section-object cloning (never mutate input), read-only stable flag (D-14)]

key-files:
  created:
    - src/core/context/ContextCompressor.ts
  modified:
    - src/core/context/ContextOptimizer.ts
    - src/core/ai/ProviderRouter.ts
    - tests/core/context/ContextOptimizer.test.ts

key-decisions:
  - "Degradation pipeline REPLACES the Plan 04-01 placeholder user-input trim: compress() is the canonical over-budget path; user_input sections are never degraded; CONTEXT_TOO_LARGE (with budget/current token counts) is thrown only when all 7 steps + AI overflow fail"
  - "minimalMode = tier === 'tiny' OR 'minimal-mode' in stepsApplied; §2.5 caps (1 tool, top-3 memory, ≤200-token system, last 1-2 turns, page dropped) are enforced only when degradation actually runs — under-budget tiny inputs keep the flag but no compression"
  - "'ai-summarisation' is appended to stepsApplied only when a compression provider is actually obtained (attempted) — unconditional recording would falsify provenance"
  - "AI summarization is a single generateText call via adapter.createLanguageModel(getDefaultModelForTier('FAST')); empty/malformed output or call errors warn and keep pre-summarization sections (T-04-09) — CONTEXT_TOO_LARGE is the fallback"

patterns-established:
  - "ContextCompressor.compress() checks the budget BEFORE each step and records every step that ran while over budget — no-op steps are still recorded, so stepsApplied is the auditable step trace per D-07"
  - "All section transforms clone-and-replace; dropped sections (debug/secondary/page) are simply absent from the provenance manifest — the manifest records final context state"

requirements-completed: [CTX-01]

# Coverage metadata (#1602)
coverage:
  - id: E1
    description: "ContextCompressor applies the 7 degradation steps in strict order (drop-debug → drop-secondary → summarise-history → compress-page → trim-tools → reduce-memory → minimal-mode) with budget re-check after every step and early stop when under budget; stepsApplied records exactly the steps that ran"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#ContextCompressor degradation (9 tests) + ContextOptimizer degradation pipeline (6 tests)"
        status: pass
    human_judgment: false
  - id: E2
    description: "CONTEXT_TOO_LARGE is thrown by ContextOptimizer only after all 7 degradation steps fail to bring context under budget; userFacingMessage carries budget and current token counts; diagnostic includes tier and stepsApplied"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#throws CONTEXT_TOO_LARGE with token counts after all degradation steps fail"
        status: pass
    human_judgment: false
  - id: E3
    description: "Minimal mode (§2.5) enforced: 1 safe tool schema, top-3 memories, ≤200-token compact system prompt, last 1-2 turns with ≤200-token summary, page context dropped; minimalMode=true for tiny tier or when the step runs; AI overflow routes through ProviderRouter.getCompressionModel() (D-08) with null → CONTEXT_TOO_LARGE fallthrough"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#minimal-mode enforces the §2.5 restrictions / #enforces minimal mode for tiny tier"
        status: pass
    human_judgment: false
  - id: E4
    description: "ContextProvenanceManifest records compressionApplied values matching the steps that ran ('summarise-history'→summarise, 'compress-page'→structural, 'reduce-memory'→topk, minimal-mode across kinds); untouched sections carry no method; stable flag never modified; input sections never mutated"
    requirement: CTX-01
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#records exact compressionApplied values / #applies all seven steps in policy order"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-07-31
status: complete
---

# Phase 04 Plan 02: Degradation Pipeline Summary

**ContextCompressor with the 7 ordered degradation steps (drop-debug → drop-secondary → summarise-history → compress-page → trim-tools → reduce-memory → minimal-mode), AI summarization overflow via ProviderRouter.getCompressionModel(), and CONTEXT_TOO_LARGE — integrated into ContextOptimizer.optimize() between assembly and provenance with compressionApplied recording — so over-budget contexts degrade gracefully instead of failing (CTX-01)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-31T12:02:00Z
- **Completed:** 2026-07-31T12:08:00Z
- **Tasks:** 2 (Task 1: TDD RED+GREEN; Task 2: integration + getCompressionModel + tests)
- **Files modified:** 4 (1 created, 2 src modified, 1 test file extended)

## Accomplishments

- ContextCompressor with the exact §2.4/D-07 sequence as a `private static readonly STEPS` constant (T-04-07) — order is unmodifiable product policy
- Stepwise budget re-check (RESEARCH Pattern 3): pipeline stops at the first step that satisfies the budget; `stepsApplied` records every step that ran, in order
- All 7 steps operational: drop-debug (`debug.*` sourceIds), drop-secondary (`secondary`/`optional`), summarise-history (recent-turn preservation, ~500-char cap + `[... history summarized]` marker), compress-page (title/URL/headings structured summary, body dropped), trim-tools (dangerous-first exclusion, top-N by priority: tiny 1 / small 3 / medium 5 / large all), reduce-memory (top-K: tiny 1 / small 3 / medium 5 / large 5, skips ≤3-entry sections), minimal-mode (§2.5: ≤200-token system, compact preferences, top-3 memory, exactly 1 safe tool, last 1-2 turns ≤200 tokens, page dropped)
- AI summarization overflow (D-06/D-08): single `generateText` call (T-04-08) through `ProviderRouter.getCompressionModel()`; null provider, empty/malformed output, or call errors degrade gracefully with console warning (T-04-09) and fall through to CONTEXT_TOO_LARGE
- ProviderRouter.getCompressionModel(): iterates PROVIDER_ORDER skipping open circuit breakers, Ollama needs no key, returns first available adapter or null (never throws); selectProvider refactored onto a shared `buildAdapter` helper (behavior-preserving)
- ContextOptimizer.optimize() step 3.5: degradation loop between assembly and provenance; CONTEXT_TOO_LARGE thrown only after ALL steps fail, with budget/current token counts in userFacingMessage and `{tier, inputBudget, totalTokens, stepsApplied}` diagnostics
- Provenance: compressionApplied recorded per changed section (summarise/structural/topk derived from the steps that ran, D-07); minimalMode = tiny tier OR 'minimal-mode' step ran
- 27 tests green (12 baseline tracer + 9 compressor degradation + 6 optimizer degradation); zero new tsc errors project-wide

## Task Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 (TDD RED) | ContextCompressor degradation tests | `3709e19` |
| 1 (TDD GREEN) | ContextCompressor: 7 degradation steps + AI overflow | `373cb50` |
| 2 | Degradation loop in ContextOptimizer + getCompressionModel + tests | `dcd50a4` |

**Plan metadata:** (final commit, after SUMMARY)

## Files Created/Modified

- `src/core/context/ContextCompressor.ts` - created: ContextCompressor class + contextCompressor singleton; 7 module-private step functions; keepRecentTurns/buildPageSummary/minimalHistory/truncateToTokens helpers; single-call AI summarization (buildSummarizationPrompt/applyAiSummary)
- `src/core/context/ContextOptimizer.ts` - degradation loop (step 3.5) replacing the placeholder user-input trim; CONTEXT_TOO_LARGE with token counts; deriveCompressionMethod() provenance marking; minimalMode = tiny || 'minimal-mode'
- `src/core/ai/ProviderRouter.ts` - getCompressionModel(); buildAdapter() shared helper (selectProvider refactored onto it)
- `tests/core/context/ContextOptimizer.test.ts` - 9 compressor degradation tests + 6 optimizer degradation tests; ProviderRouter mock gains getCompressionModel; trim test migrated to the degradation contract

## Decisions Made

- **Degradation replaces the placeholder trim:** the Plan 04-01 user-input trim (and its `truncated` provenance mark) is removed — compress() is the canonical over-budget path. user_input sections are never touched by degradation; a 20K-char input on tiny now exhausts all 7 steps and raises CONTEXT_TOO_LARGE instead of trimming.
- **Minimal mode flag vs caps:** `minimalMode` = tiny tier OR the step ran; the §2.5 caps are enforced only when the pipeline actually runs (an under-budget tiny input keeps the flag with no compression).
- **stepsApplied honesty for AI:** 'ai-summarisation' is recorded only when a compression provider is actually obtained, not merely because the callback exists.
- **Schema cap pins the CONTEXT_TOO_LARGE tests:** userInput is Zod-capped at 100K chars, so the terminal-error tests use exactly 100K chars (previously 200K was accidentally exercising SCHEMA_INVALID).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] trim-tools test budget arithmetic left the pipeline running into minimal-mode**
- **Found during:** Task 1 (GREEN verification)
- **Issue:** Tool JSON serialization was ~10% larger than the test's token estimate (5 kept schemas ≈ 296t → total 311 > budget 300), so the pipeline continued past trim-tools into minimal-mode and the medium-tier assertion saw 1 tool instead of 5
- **Fix:** Test-side sizing: tool descriptions 200→150 chars, budget 300→340 (margins ≈ 90t on both medium and tiny calls)
- **Files modified:** tests/core/context/ContextOptimizer.test.ts
- **Commit:** 373cb50 (GREEN)

**2. [Rule 1 - Test correctness] Both huge-input tests exercised SCHEMA_INVALID, not CONTEXT_TOO_LARGE**
- **Found during:** Task 2 verification
- **Issue:** 200K-char userInput exceeds the ContextOptimizerInputSchema 100K-char cap, so Zod rejected the input before the degradation path — the pre-existing "user input alone cannot fit" test was passing for the wrong reason (any PipelineError matched)
- **Fix:** Pinned both tests to 100K chars (schema-legal, ≈25K tokens — still far beyond the 2867-token tiny budget) so they genuinely exercise the post-degradation terminal error
- **Files modified:** tests/core/context/ContextOptimizer.test.ts
- **Commit:** dcd50a4

**3. [Rule 1 - Plan inconsistency] compress() provider param type and 'ai-summarisation' recording**
- **Found during:** Task 1 (implementation)
- **Issue:** The action sketch types `compressionModelProvider?: () => Promise<ProviderAdapter>` and pushes 'ai-summarisation' unconditionally, but Task 2's getCompressionModel contract returns `ProviderAdapter | null` and the must_have requires provenance accuracy
- **Fix:** Typed the param `() => Promise<ProviderAdapter | null>` (consistent with the null fallthrough contract); recorded the step only when a provider was obtained
- **Files modified:** src/core/context/ContextCompressor.ts
- **Commit:** 373cb50

**4. [Rule 1 - Plan inconsistency] summarise-history marker: appended vs prepended**
- **Found during:** Task 1 (implementation)
- **Issue:** Action text says "append a truncation marker", acceptance criteria says "prepends" — contradictory
- **Fix:** Followed the action text (append `\n[... history summarized]` after the preserved recent text, which also matches "Preserve the most recent turns")
- **Files modified:** src/core/context/ContextCompressor.ts
- **Commit:** 373cb50

---

**Total deviations:** 4 auto-fixed (2 test correctness, 2 plan-internal inconsistencies resolved toward the action text / Task 2 contract)
**Impact on plan:** All auto-fixes necessary for correct, verifiable behavior. No scope creep. Threat model T-04-07/08/09/11 mitigations all implemented.

## Issues Encountered

- **Test-count mismatch with plan:** the plan's success criteria say "13 tests (7 tracer + 6 degradation)"; the actual 04-01 file carried 12 baseline tests, so the file now holds 27 (12 baseline + 9 compressor + 6 optimizer). All pass.
- **AI overflow path is implemented but not unit-tested end-to-end:** the test ProviderRouter mock returns null from getCompressionModel (deterministic no-AI), so the successful-call branch (real generateText) is only covered by type-checking and the T-04-09 fallback guards. A provider-level integration test was not in the plan's test list; flagged for the 04-03/verifier wave.
- **Pre-existing failures (out of scope, already logged in deferred-items.md):** 9 tsc errors in src/core/storage/; 6 test failures in tests/core/ai (StreamAdapter ×2, ProviderAdapter ×4 — AI SDK v7 mock shape drift). Reproduced without this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 04-03 (cache management):** ContextOptimizer.optimize() now ends with provenance + minimalMode — the PromptCacheManager slot sits after provenance; `minimalMode` and per-section `stable` flags feed eligibility decisions; compressionApplied provenance gives cache diagnostics a complete degradation trace
- **Verifier:** must_have truths D-06/D-07/D-08 are pinned by tests (step order, early stop, AI fallthrough, minimal-mode caps, provenance values)
- **Known intentional placeholders (unchanged from 04-01):** task section empty (`core.task.placeholder`); history sections not assembled by the optimizer yet (compressor handles them when present); pageContext/memoryHints no-op when absent (D-05)

## Self-Check: PASSED

- `src/core/context/ContextCompressor.ts` exists; `ContextOptimizer.ts` + `ProviderRouter.ts` contain the degradation loop and getCompressionModel (verified by tests)
- RED commit `3709e19` exists; GREEN commit `373cb50` exists; integration commit `dcd50a4` exists
- `npx vitest run tests/core/context/ContextOptimizer.test.ts` → 27/27 pass; `-t "degradation"` → 15/15 pass
- Project `pnpm exec tsc --noEmit`: 0 errors in touched files (only the 9 documented pre-existing src/core/storage/ errors remain)
- Related suites green: ProviderRouter 9/9, tracer 3/3, AgentOrchestrator 5/5, integration 2/2, PlannerService 6/6

---
*Phase: 04-context-optimization-pipeline*
*Completed: 2026-07-31*
