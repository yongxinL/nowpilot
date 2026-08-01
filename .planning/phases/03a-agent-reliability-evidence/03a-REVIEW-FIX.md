---
phase: 03a-agent-reliability-evidence
fixed_at: 2026-08-01T11:55:00Z
review_path: .planning/phases/03a-agent-reliability-evidence/03a-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 03a: Code Review Fix Report

**Fixed at:** 2026-08-01T11:55:00Z
**Source review:** `.planning/phases/03a-agent-reliability-evidence/03a-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (all Warning-tier; fix_scope = critical_warning)
- Fixed: 9
- Skipped: 0

## Fixed Issues

### WR-01: Verified completion mislabeled `completion_unverified` when a cap is reached

**Files modified:** `src/core/ai/AgentOrchestrator.ts`
**Commit:** 788963d
**Applied fix:** In the verification-path disposition switch, the `render` case now inspects the last tool result's evidence. When `last.evidence.verified === true` (the cap-exhaustion rule fired after a verified write), the outcome is reported truthfully as `partial` / `tool_cap_reached` with decision reason `tier_cap_reached`; the `completion_unverified` label is preserved only for genuinely unverified paths (rules 6/9). Downstream consumers (UI badges, telemetry, retry logic) no longer see a verified write reported as unverified.

### WR-02: Orchestrator discards the caller's explicit `modelContextWindow`

**Files modified:** `src/core/ai/AgentOrchestrator.ts`
**Commit:** 38c5b4b
**Applied fix:** `buildOptimizerInput` now forwards `input.modelContextWindow` (a required field of `AgentTurnInput`) as the primary source instead of substituting `KNOWN_MODEL_WINDOWS[model] ?? DEFAULT_MODEL_CONTEXT_WINDOW`. The unused `KNOWN_MODEL_WINDOWS` import and `DEFAULT_MODEL_CONTEXT_WINDOW` constant were removed. Custom models (e.g., Ollama) now get their caller-supplied window honored, matching the `ContextOptimizer.optimize` direct path.

### WR-03: Renderer never receives tool outputs — final answers cannot reference tool results

**Files modified:** `src/core/ai/RendererService.ts`, `src/core/ai/AgentOrchestrator.ts`
**Commit:** ed98533
**Applied fix:** `buildMessages` now accepts an optional `toolResults?: ToolExecutionResult[]` and injects a bounded tool-results context message (each result serialized with output truncated to 2000 chars, via the new `summarizeToolResult` helper) before the user section. `synthesize` and `stream` forward the optional `toolResults` parameter, and the orchestrator's `renderAndFinish` passes the accumulated `toolResults` array. Rendered answers can now reference tool-returned data end-to-end.

### WR-04: `RegisteredTool.execute` is a non-functional stub — real tools cannot run

**Files modified:** `src/core/ai/types.ts`, `src/core/ai/AgentOrchestrator.ts`, `tests/core/ai/AgentOrchestrator.test.ts`, `tests/core/ai/integration.test.ts`, `tests/core/context/ContextOptimizer.test.ts`, `tests/security/agent-harness.test.ts`
**Commit:** a555383
**Applied fix:** `ToolSchemaInfo` gains an optional `execute?: (input, signal) => Promise<unknown>` implementation field. `buildRegisteredTools` now requires it (consistent with the existing sideEffect/idempotency/evidence boundary) and forwards it — a tool without an implementation fails the turn with `SCHEMA_INVALID` instead of silently stubbing `async () => null`. Test fixtures across the four affected suites were updated to supply mock implementations so the registry boundary is exercised as documented.

### WR-05: minimal-mode can retain a dangerous tool schema

**Files modified:** `src/core/context/ContextCompressor.ts`
**Commit:** 4c05922
**Applied fix:** The `minimalMode` `tool_schemas` case now mirrors `trimTools`: `kept = safe.slice(0, 1)` — when every tool is dangerous, `safe` is empty and the section rewrites to `[]` rather than falling back to the first (dangerous) entry. The `parsed.length <= 1` early return was also removed so a lone dangerous tool no longer survives into minimal mode (§2.5 allows at most one *safe* tool schema).

### WR-06: Write journal silently marks unexecuted steps as completed on replay

**Files modified:** `src/core/storage/WriteJournal.ts`
**Commit:** 79c2a74
**Applied fix:** All three paths now treat a missing executor as a step failure instead of a no-op completion: `commitEntry` marks the step and entry `failed` (with `error: 'No executor registered for step "…"'`) and persists before returning; `replayJournal` and `repairEntry` throw the same error, which the existing catch block converts into a failed entry with the failed step recorded. A pending write with an incomplete executor registry is never recorded as completed, so repair can revisit it.

### WR-07: `attachEvidence` does not validate `evidence.toolCallId` against the recorded entry

**Files modified:** `src/core/ai/ExecutorService.ts`
**Commit:** fe58866
**Applied fix:** The validated cache seam now compares `entry.toolCallId` with `evidence.toolCallId` in addition to `operationId` and `toolName`. Evidence claiming verification for a different tool call throws `TOOL_POSTCONDITION_FAILED` and never overwrites cached evidence (T-03a-01 invariant now holds for the third field). Idempotent-duplicate flows still match because the entry's `toolCallId` is refreshed to each served duplicate call's ID.

### WR-08: `ProviderRouter.executeWithFallback` leaks state across calls and is dead code

**Files modified:** `src/core/ai/ProviderRouter.ts`
**Commit:** ef53fbe
**Applied fix:** The fallback state is now scoped per invocation — `executeWithFallback` creates a fresh local `OperationState` instead of reading the shared `operationStates` map keyed by `operationId`. Reusing an operationId across separate calls can no longer carry `hasStreamedFirstToken`/`attempts` into a fresh call (which previously threw `UNKNOWN` before attempting any provider). The unused `opId` local was removed; `markFirstTokenStreamed`/`hasStreamedFirstToken` keep their public contract.

### WR-09: Always-`cacheHit:false` recording guarantees the prompt-cache miss cascade disables caching in production

**Files modified:** `src/core/ai/AgentOrchestrator.ts`, `src/core/ai/providers/ProviderAdapter.ts`, `src/core/context/PromptCacheManager.ts`
**Commit:** 5edd032
**Applied fix:** `CacheResponseMetadata` gains an optional `cacheStatus?: 'hit' | 'miss' | 'unknown'` (derived from `cacheHit` when absent, preserving legacy callers). `PromptCacheManager.recordResponse` treats `cacheStatus: 'unknown'` as a health no-op — it no longer increments `missStreak`, so fabricated misses can no longer disable the cache after 5 calls. The orchestrator's `recordCacheResponse` now records `cacheStatus: 'unknown'` (adapters still do not report native cache usage), keeping the D-15 recording contract without poisoning the §19.13 cascade. `isValidMetadata` validates the new field. Verified: the "cache disabled after N consecutive misses" cascade no longer triggers in orchestrator tests.

---

_Fixed: 2026-08-01T11:55:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
