---
phase: 03a-agent-reliability-evidence
reviewed: 2026-08-01T11:45:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - src/core/ai/AgentOrchestrator.ts
  - src/core/ai/AgentTrajectoryMachine.ts
  - src/core/ai/AgentTurnOutcome.ts
  - src/core/ai/ExecutorService.ts
  - src/core/ai/PipelineError.ts
  - src/core/ai/PlannerService.ts
  - src/core/ai/ProviderRouter.ts
  - src/core/ai/RendererService.ts
  - src/core/ai/RenderingOutcomePolicy.ts
  - src/core/ai/ReplanPolicy.ts
  - src/core/ai/types.ts
  - src/core/ai/verifier/OutcomeVerifier.ts
  - src/core/ai/verifier/VerifierTypes.ts
  - src/core/context/ContextCompressor.ts
  - src/core/context/ContextOptimizer.ts
  - src/core/storage/ApiKeyStore.ts
  - src/core/storage/CryptoService.ts
  - src/core/storage/MigrationRunner.ts
  - src/core/storage/WriteJournal.ts
  - tests/core/ai/AgentOrchestrator.test.ts
  - tests/core/ai/ExecutorService.test.ts
  - tests/core/ai/integration.test.ts
  - tests/core/ai/ReplanPolicy.test.ts
  - tests/core/ai/tracer.test.ts
  - tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts
  - tests/core/ai/types.test.ts
  - tests/core/ai/verifier/OutcomeVerifier.test.ts
  - tests/core/context/ContextCompressor.test.ts
  - tests/core/context/ContextOptimizer.test.ts
  - tests/security/agent-harness.test.ts
findings:
  critical: 0
  warning: 9
  info: 7
  total: 16
status: issues_found
---

# Phase 03a: Code Review Report

**Reviewed:** 2026-08-01T11:45:00Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Reviewed the Phase 3a agent-reliability harness: `AgentOrchestrator.runTurn` state machine, trajectory machine, outcome contract, executor idempotency ledger, replan policy, rendering outcome policy, verifier, context optimizer/compressor, and the storage/journal support files, plus the full test suite (all 209 tests pass).

The overall architecture is sound and unusually well-disciplined: the strict transition allowlist, the redacted recovery observations, the bounded evidence schema, and the pure `evaluateReplan` policy are all implemented as documented, and the adversarial test suite covers the STRIDE categories well. The verified tests give genuine coverage of the happy paths and the abort/replan/cap machinery.

However, cross-module analysis surfaced several defects that the mocks hide: (1) the outcome contract mislabels a verified completion as `completion_unverified` when a cap is reached; (2) the orchestrator silently discards the caller's `modelContextWindow`; (3) the renderer never receives tool outputs, so real answers cannot reference tool results; (4) `RegisteredTool.execute` is a `null`-returning stub with no way to wire a real implementation; (5) minimal-mode can retain a dangerous tool schema; (6) the write journal silently marks unexecuted steps as completed on replay; (7) `attachEvidence` does not validate `evidence.toolCallId`; (8) `ProviderRouter.executeWithFallback` carries cross-call state and is dead code; and (9) the always-`cacheHit:false` recording guarantees the prompt-cache miss cascade disables caching in every real run.

No CRITICAL findings: no data-loss, injection, or auth-bypass defects were proven in the reviewed paths.

## Warnings

### WR-01: Verified completion mislabeled `completion_unverified` when a cap is reached

**File:** `src/core/ai/AgentOrchestrator.ts:493-528` (with `src/core/ai/ReplanPolicy.ts:72-74`)

**Issue:** In the verification path, `evaluateReplan` checks cap exhaustion (rule 4) **before** verified-success continuation (rule 5), so after the last allowed tool call of a tier (e.g., the 2nd verified write on FAST) the disposition is `render`, and the orchestrator unconditionally maps `render` to `terminalState: 'partial'` / `reasonCode: 'completion_unverified'` with the decision `{ action: 'answer', reasonCode: 'completion_unverified' }`. The tool was **verified** — the rendering policy is built from the verified evidence, so the fallback wording is not used — but the machine-readable outcome says "completion_unverified" and "partial". Downstream consumers (UI badges, telemetry, retry logic) will report a verified write as unverified. No test covers this path (the cap test uses an unverified read tool), which is why it slips through.

**Fix:** When the disposition is `render` but the current evidence is verified, map to a truthful reason — e.g., `renderAndFinish('partial', 'tool_cap_reached', ...)` — or return `continue-planning` when `lastEvidence?.verified === true` and let the loop-top cap checks produce `planner_cap_reached`/`tool_cap_reached`:

```ts
// in the disposition switch:
case 'render': {
  const last = toolResults[toolResults.length - 1];
  const verified = last?.evidence?.verified === true;
  return await renderAndFinish(
    'partial',
    verified ? 'tool_cap_reached' : 'completion_unverified',
    { action: 'answer', reasonCode: verified ? 'tier_cap_reached' : 'completion_unverified' },
    buildPolicyForRender({ toolName: tool.name, toolCallId: result.toolCallId, sideEffect: tool.sideEffect ?? 'none' }),
  );
}
```

### WR-02: Orchestrator discards the caller's explicit `modelContextWindow`

**File:** `src/core/ai/AgentOrchestrator.ts:55`

**Issue:** `buildOptimizerInput` computes `modelContextWindow: KNOWN_MODEL_WINDOWS[input.model] ?? DEFAULT_MODEL_CONTEXT_WINDOW` and ignores `input.modelContextWindow` — a required field of `AgentTurnInput`. For any model not in the 9-entry `KNOWN_MODEL_WINDOWS` table (custom Ollama models, new provider models), a caller-supplied window such as 8192 is silently replaced with 128000, so `classifyModelContext` assigns `medium` and the budget is computed for a 128K window. The resulting prompt can exceed the model's real window (provider-side failure) or waste budget. Note `ContextOptimizer.optimize` (the direct path) honors the field — the two entry points are inconsistent.

**Fix:** Use the validated caller value as the primary source:

```ts
modelContextWindow: input.modelContextWindow,
```

### WR-03: Renderer never receives tool outputs — final answers cannot reference tool results

**File:** `src/core/ai/RendererService.ts:12-29`

**Issue:** `buildMessages` assembles only the system prompt, (empty) history, and the `user_input` section. Tool execution results are never added to the renderer context, and the `PlannerDecision` answer carries no content. In the real pipeline ("plan → execute → plan → answer → render"), the renderer must describe the tool's returned data ("The weather in Tokyo is 22°C") but has no access to it — every rendered answer is generated from the raw user input alone. The integration test masks this by mocking `synthesize`. History assembly is documented as future work, but tool results are not mentioned anywhere — this is an omission, and it makes the tool-execution loop functionally inert end-to-end.

**Fix:** Include bounded tool results in the renderer messages (e.g., last N `ToolExecutionResult`s serialized), or extend the renderer contract to accept a tool-results context:

```ts
function buildMessages(
  decision: { action: 'answer'; reasonCode: string },
  optimized: OptimizedContext,
  systemPrompt?: string,
  toolResults?: ToolExecutionResult[],
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  // ...existing...
  const toolContext = (toolResults ?? [])
    .map((r) => `Tool ${r.toolName} returned: ${JSON.stringify(r.output)?.slice(0, 2000)}`)
    .join('\n');
  return [
    { role: 'system', content: prompt },
    ...history,
    ...(toolContext ? [{ role: 'assistant', content: toolContext }] : []),
    { role: 'user', content: userSection?.text ?? '' },
  ];
}
```

### WR-04: `RegisteredTool.execute` is a non-functional stub — real tools cannot run

**File:** `src/core/ai/AgentOrchestrator.ts:74-93`

**Issue:** `buildRegisteredTools` maps every selected tool to `execute: async () => null`. `ToolSchemaInfo` (the only tool carrier in `AgentTurnInput`) has no `execute` field, so there is no path to supply a real implementation. Consequences in production: every `run_tool` returns `null` output, and the default `SCHEMA_VERIFIER` (`VerifierTypes.ts:52-85`) reports "Tool returned no verifiable result." → `postcondition_failed` for every write — the entire tool loop produces no work. The phase's own tests mock `executorService.execute`, so this never surfaces.

**Fix:** Either add an optional `execute` implementation to `ToolSchemaInfo` and forward it in `buildRegisteredTools`, or explicitly document/wire the tool registry boundary that this phase expects (and fail the turn with `SCHEMA_INVALID` when a tool has no implementation, rather than silently stubbing `null`).

### WR-05: minimal-mode can retain a dangerous tool schema

**File:** `src/core/context/ContextCompressor.ts:325-339`

**Issue:** In the `minimalMode` `tool_schemas` case, when every tool is flagged `dangerous` (or the only tool is dangerous), `safe` is empty and `kept = parsed.slice(0, 1)` — the dangerous tool survives into minimal mode. This contradicts the documented restriction ("at most one safe tool schema", §2.5) and is inconsistent with `trimTools` (line 246-275), which drops all dangerous tools and rewrites to `[]`. A single dangerous tool is additionally exempted by the `parsed.length <= 1` early return.

**Fix:** Mirror `trimTools`: when `safe.length === 0`, keep no tools:

```ts
const kept = safe.slice(0, 1);
const next = JSON.stringify(kept);
return [{ ...s, text: next, tokens: tokenBudget.estimateTokens(next) }];
```

### WR-06: Write journal silently marks unexecuted steps as completed on replay

**File:** `src/core/storage/WriteJournal.ts:143-146, 176-184, 224-233`

**Issue:** In `commitEntry`, `replayJournal`, and `repairEntry`, a step whose executor is not found in the supplied list/map is marked `status: 'completed'` without executing ("step without executor is a no-op"). On startup replay or lazy repair with an incomplete executor registry, a pending write (e.g., `export-data`, `save-note-with-links`) is recorded as completed while the operation was never applied — silent data loss with a terminal journal record that `replayJournal`/`repairEntry` will never revisit.

**Fix:** Treat a missing executor as a step failure (mark the step `failed` with `error: 'no executor registered'` and the entry `failed`), or leave the step `pending` so a later repair can pick it up:

```ts
const executor = stepExecutors.get(step.name);
if (!executor) {
  step.status = 'failed';
  step.error = `No executor registered for step "${step.name}"`;
  entry.status = 'failed';
  entry.updatedAt = Date.now();
  await db.put('entries', entry);
  continue; // or throw to abort the replay
}
await executor();
step.status = 'completed';
```

### WR-07: `attachEvidence` does not validate `evidence.toolCallId` against the recorded entry

**File:** `src/core/ai/ExecutorService.ts:262-280`

**Issue:** The T-03a-01 invariant claims "evidence.operationId and evidence.toolName exactly match the recorded entry — spoofed values throw TOOL_POSTCONDITION_FAILED and never overwrite cached evidence." Only `operationId` and `toolName` are checked — `evidence.toolCallId` is never compared with `entry.toolCallId`. Evidence claiming verification for a *different* tool call can therefore be attached to an entry and then served by every idempotent duplicate of that entry, polluting the cached-evidence seam. The security suite tests spoofed operationId/toolName but not toolCallId.

**Fix:** Add the missing check:

```ts
if (
  entry.operationId !== evidence.operationId ||
  entry.toolName !== evidence.toolName ||
  entry.toolCallId !== evidence.toolCallId
) {
  throw new PipelineError('TOOL_POSTCONDITION_FAILED', 'Evidence does not match the recorded tool call.', { toolCallId });
}
```

### WR-08: `ProviderRouter.executeWithFallback` leaks state across calls and is dead code

**File:** `src/core/ai/ProviderRouter.ts:196-247`

**Issue:** `operationStates` is keyed by `operationId` and never reset; `hasStreamedFirstToken` and `attempts` accumulate across *separate* calls that reuse an operationId. A later call on a reused operationId with `hasStreamedFirstToken === true` and `attempts.length > 1` throws `UNKNOWN` at line 215-217 **before attempting any provider** — a fresh call can fail solely due to prior calls' state. (`lastError` is a per-call local, so the throw is the generic `UNKNOWN`, not the original error.) Additionally, `executeWithFallback`/`markFirstTokenStreamed`/`hasStreamedFirstToken` have no callers anywhere in `src/` — the flawed path is shipped but unused.

**Fix:** Scope the fallback state to the call (e.g., a per-invocation state object) or reset `state.attempts`/`hasStreamedFirstToken` at the top of each call; alternatively remove the dead API until a caller exists.

### WR-09: Always-`cacheHit:false` recording guarantees the prompt-cache miss cascade disables caching in production

**File:** `src/core/ai/AgentOrchestrator.ts:116-122` (with `src/core/context/PromptCacheManager.ts:53-77`)

**Issue:** `recordCacheResponse` is invoked after every successful planner and renderer call with hardcoded `{ cacheHit: false, cacheWrite: false }`. PromptCacheManager increments `missStreak` on every miss and disables the cache for 60s after 5 consecutive misses — the cache therefore disables after the first 2-3 turns and re-disables 60s after each cooldown expiry, permanently. `prepareCacheHints` then returns strategy `'disabled'`, so the D-13 cache-hint machinery never actually applies hints in the orchestrator path (visible in test output: "cache disabled for openai after 14/15/… consecutive misses"). The §19.13 "unknown cache status = miss" convention is defensible per call, but feeding every call into the cascade makes the feature self-defeating.

**Fix:** Do not feed fabricated misses into the cascade — track "unknown" responses separately (e.g., `recordResponse` with an `unknown` flag that does not increment `missStreak`), or only call `recordCacheResponse` when the adapter actually reports cache metadata.

## Info

### IN-01: Timeout timer leak and message-equality timeout detection

**File:** `src/core/ai/ExecutorService.ts:7-11, 174-177, 208`

**Issue:** `Promise.race([tool.execute(...), timeout(timeoutMs)])` never clears the timeout timer when the tool wins, keeping a 30s timer alive per call. Timeout classification relies on `err.message === 'Tool execution timed out'` — a tool that throws an error with that exact message is misclassified as `PROVIDER_TIMEOUT` (retryable). **Fix:** `clearTimeout` in a `finally` and detect timeouts via a sentinel/symbol rather than message equality.

### IN-02: `canonicalStringify` recurses without cycle detection

**File:** `src/core/ai/ExecutorService.ts:59-73`

**Issue:** A circular object in tool input causes unbounded recursion (stack overflow). Model-derived JSON cannot be circular, but direct `execute`/`executeBatch` callers can pass arbitrary values. **Fix:** add a `WeakSet`/depth guard.

### IN-03: Documented derived-key session cache is never implemented

**File:** `src/core/storage/CryptoService.ts:15-16`

**Issue:** `SESSION_CACHE_PREFIX = 'np_derived_key_'` is declared and documented ("Derived key cache prefix in chrome.storage.session") but no code ever reads or writes `chrome.storage.session` — every `encrypt`/`decrypt` re-runs 100k-iteration PBKDF2. Dead contract. **Fix:** implement the cache or remove the constant/comment.

### IN-04: Outcome schema allows contradictory terminalState/reasonCode combinations

**File:** `src/core/ai/AgentTurnOutcome.ts:201-244`

**Issue:** The schema only refines the aborted invariant. Records like `terminalState: 'failed'` with `reasonCode: 'planner_answer'`, or `completed` with `completion_unverified`, parse successfully — allowing downstream consumers to see contradictory outcome records. **Fix:** add a cross-field refine mapping reason codes to permitted terminal states.

### IN-05: AI-summarization section mislabeled `structural` in provenance

**File:** `src/core/context/ContextOptimizer.ts:212-220`

**Issue:** After AI summarization, the synthesized `ai.compression.summary` section gets `compressionApplied: 'structural'` whenever `compress-page` (or minimal mode) ran, because `deriveCompressionMethod` treats any changed non-history context section as structural. The summary is AI-generated, not structurally compressed. **Fix:** return `undefined` for `sourceId === 'ai.compression.summary'`.

### IN-06: `keepRecentTurns` can return text larger than `maxChars`

**File:** `src/core/context/ContextCompressor.ts:360-375`

**Issue:** The size check runs *after* adding each turn, so a single oversized turn is returned in full (the `?? s.text.slice(-500)` fallback only applies when nothing was dropped). `summarise-history` can therefore fail to reduce size for one huge turn. **Fix:** re-check and fall back to `slice(-maxChars)` when the kept JSON still exceeds the limit.

### IN-07: Permission-request toolCallId never matches the executed call

**File:** `src/core/ai/AgentOrchestrator.ts:389-394`

**Issue:** The permission request carries `toolCallId: crypto.randomUUID()`, but `ExecutorService.execute` generates its own independent `toolCallId`. The ID shown in the permission UI never appears in the outcome, breaking the audit trail between the permission grant and the executed call. **Fix:** generate the callId once before the permission request and pass it into `executorService.execute`.

---

_Reviewed: 2026-08-01T11:45:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
