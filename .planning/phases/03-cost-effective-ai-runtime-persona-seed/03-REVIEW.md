---
phase: 03-cost-effective-ai-runtime-persona-seed
reviewed: 2026-08-10T23:05:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - src/core/ai/types.ts
  - src/core/ai/toolSchemas.ts
  - src/core/ai/ILLMProvider.ts
  - src/core/ai/TierResolver.ts
  - src/core/ai/ProviderRegistry.ts
  - src/core/ai/ChunkBuffer.ts
  - src/core/ai/StreamAdapter.ts
  - src/core/ai/PromptCacheAdapter.ts
  - src/core/ai/PromptCacheManager.ts
  - src/core/ai/StructuredOutput.ts
  - src/core/ai/PlannerService.ts
  - src/core/ai/ExecutorService.ts
  - src/core/ai/ProviderRouter.ts
  - src/core/ai/RendererService.ts
  - src/core/ai/AgentOrchestrator.ts
  - src/core/ai/persona/PersonaProfile.ts
  - src/core/ai/persona/personaConfig.ts
  - src/core/ai/persona/PersonaInjector.ts
  - src/core/ai/contextHelper.ts
  - src/core/ai/providers/OpenAIProvider.ts
  - src/core/ai/providers/AnthropicProvider.ts
  - src/core/ai/providers/GeminiProvider.ts
  - src/core/ai/providers/OllamaProvider.ts
  - src/core/ai/providers/OpenAICompatProvider.ts
  - src/core/context/ModelContextTier.ts
  - src/core/context/ContextProvenanceManifest.ts
  - src/core/memory/types.ts
  - src/core/error/errorCodes.ts
  - src/core/i18n/strings.ts
  - src/components/pages/useStreamingLLM.ts
  - src/components/pages/ChatPage.tsx
  - src/components/sidepanel/SidePanelShell.tsx
  - src/components/standalone/StandaloneShell.tsx
  - src/entrypoints/sidepanel/main.tsx
  - src/entrypoints/standalone/main.tsx
  - src/types/workspace.ts
  - tests/isolation/check-content-bundle.mjs
  - package.json
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-10T23:05:00Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Reviewed the full Phase-3 AI runtime delivery (plans 03-01 → 03-09): canonical types, four provider adapters + Seam-1 factory, TierResolver/ProviderRegistry, ChunkBuffer/StreamAdapter/PromptCache*, StructuredOutput/Planner/Executor, the 746-line ProviderRouter (retry/breaker/privacy/F-4/F-5), RendererService/AgentOrchestrator, persona pipeline, contextHelper, the streaming hook + ChatPage, shell gates, and both surface entrypoints' AI-runtime wiring.

The architecture is disciplined and unusually well-documented (Seam boundaries, R-1 single declarations, Golden Rule 9 debugLog discipline, F-4/F-5 section threading all check out in code). However, cross-module tracing surfaced **one critical integration bug**: the R-2 per-operation attempt budget (`ROUTER_MAX_ATTEMPTS = 3`) counts *every* stage call — including legitimate sequential planner calls in a tool loop and the final renderer resolution — so a turn that uses the medium tier's allowed `toolCap = 2` always terminates with `no_candidate` at the renderer resolution, after all work succeeded. Several documented invariants are also dead code (`recordFailure`/`markStreamedFirstToken` are never invoked by the streaming path; the per-attempt timeout aborts the shared controller so `TIMEOUT` can never be classified or retried).

## Critical Issues

### CR-01: R-2 attempt budget starves the renderer stage — allowed tool-loop turns always fail with `no_candidate`

**File:** `src/core/ai/ProviderRouter.ts:392-394` (+ `src/core/ai/AgentOrchestrator.ts:114-155`)

**Issue:** `ROUTER_MAX_ATTEMPTS = 3` is enforced as a **total per-operation call counter** (`attemptCount` counts every `recordAttempt`, including `'success'`), but the orchestrator's §1.4 tier caps permit up to `plannerCap` sequential planner invocations *plus* a final renderer stage. On the default tier (`medium`, caps 3/2, set in `useStreamingLLM.ts:45`), a turn that uses the allowed 2 tool calls consumes 3 attempts on the planner loop alone:

1. `planOnce` #1 → `createStageInvocation` (attemptCount 0) → `plan()` → `requestJson` → `callProviderJsonMode` → `invokeJsonMode` success → `recordAttempt` (count=1).
2. `run_tool` → executor → `planOnce` #2 → attempt (count=2).
3. `run_tool` → executor → `planOnce` #3 → attempt (count=3).
4. `answer` → `finish()` → `resolveStage('renderer')` → `createStageInvocation` → **`attemptCount(3) >= ROUTER_MAX_ATTEMPTS(3)` → throws `no_candidate`**.

The renderer never runs; the turn surfaces as a provider-failure state (`failed` bubble) even though every provider call succeeded. The problem is aggravated by the structured-output repair (`StructuredOutput.ts:111` calls `callProviderJsonMode` a second time — each call is a separate counted attempt) and by the router's own one retry (D-17): a single planner call needing a repair or a retry consumes 2 attempts, so **even a 1-tool turn breaks** (2 planner attempts + 1 renderer attempt = 3, then a second planner call would be attempt 4 → blocked). The §1.4 caps (plannerCap up to 5 on `large`) are unreachable.

The intent of R-2 is that *retries don't multiply* (§1.6.1) — the budget should bound retry layers, not the total count of legitimate sequential stage invocations.

**Fix:** Track retries separately from the per-stage call ledger, or scope the budget check to retries only:

```ts
// In RouterAttemptState, distinguish legitimate stage calls from retries:
//   attempts: ProviderAttempt[]          // every SDK call (observability)
//   retryCount: number                  // only router-owned retries
// Budget check (createStageInvocation + attempt()):
//   if (this.retryCount(input.operationId) >= ROUTER_MAX_ATTEMPTS) { ... }
// recordAttempt() increments retryCount ONLY for the D-17 retried call,
// never for the first invocation of a stage or a structured-output repair.
```

## Warnings

### WR-01: `hasActiveProvider()` gate only inspects the LAST registered provider — multi-provider configs close the D-07 gate wrongly

**File:** `src/core/ai/ProviderRegistry.ts:184-189`

**Issue:** The gate reads only `this.providers.get(this.activeProviderId)`, where `activeProviderId` is "last registration wins" (`registerProvider` line 118). `runAIRuntimeInit` registers providers in the fixed order `openai → anthropic → gemini → ollama` (`main.tsx:74`). If the last-registered provider in that order is disabled (`enabled: false` from a stored envelope) or later marked `keyUnreadable`, the gate returns `false` even though an earlier provider (e.g. `openai`) is enabled and fully usable — the whole chat surface renders `STR.chat.noProvider` and is unreachable. The converse also holds via the legacy `registerActiveProvider` path: setting an active id without a registry entry makes the gate return `true` with zero usable configs.

**Fix:** The gate must be "any usable provider exists", not "the active one is usable":

```ts
hasActiveProvider(): boolean {
  for (const entry of this.providers.values()) {
    if (entry.enabled && !entry.keyUnreadable) return true;
  }
  return false;
}
```

### WR-02: `recordFailure()` and `markStreamedFirstToken()` are never called — the §1.5 circuit breaker and stream-freeze guard are dead code on the streaming path

**File:** `src/core/ai/RendererService.ts:72-117` (missing calls); `src/core/ai/ProviderRouter.ts:475-477, 521-523`

**Issue:** `ProviderRouter.recordFailure()` documents itself as "the public breaker entry for the streaming path (03-06): a mid-stream/stream failure votes the provider's breaker" — but grep confirms no production caller; `RendererService.render()` throws `STREAM_FAILED` without recording a failure, so a provider that consistently fails mid-stream never accrues breaker votes and is retried every turn. Similarly, `markStreamedFirstToken()` (the §1.5 "never switch providers after the first token" invariant) is never invoked — `hasStreamedFirstToken` stays `false` forever in production, so the `stream_frozen` guard in `createStageInvocation` can never fire. Both are tested in isolation (`ProviderRouter.test.ts`) but unwired from the only production path that needs them.

**Fix:** In `RendererService.render()`'s catch / non-`stop` finish branches, call the router:

```ts
catch (e) {
  getProviderRouter().recordFailure(input.invocation.providerId, ERROR_CODES.STREAM_FAILED, e);
  ...
}
// and after the first streamed delta:
if (!firstTokenMarked) {
  getProviderRouter().markStreamedFirstToken(input.operationId);
  firstTokenMarked = true;
}
```

### WR-03: Per-attempt timeout aborts the shared controller — `TIMEOUT` is never classified and never retried; it surfaces as a silent `idle`

**File:** `src/core/ai/StructuredOutput.ts:80-91` + `src/core/ai/ProviderRouter.ts:493-496`

**Issue:** The per-attempt timeout (`setTimeout(() => ac.abort(), ctx.timeoutMs)`) aborts the *same* AbortController used for user/surface aborts. When the timeout fires, the SDK rejects with an `AbortError`, which `classifyProviderError` maps to `{ code: 'UNKNOWN', retryable: false }` (ProviderRouter.ts:493-496). Consequences:
1. `TIMEOUT` — explicitly listed in `RETRYABLE_CODES` (ProviderRouter.ts:166) — can never be produced, so the D-17 retry policy never fires on timeouts (the retryable case it was designed for).
2. `planOnce` sees an AbortError and rethrows it (AgentOrchestrator.ts:189); `useStreamingLLM`'s catch maps AbortError to `setState({ state: 'idle' })` (useStreamingLLM.ts:173-177) — a planner timeout is silently swallowed with **no error surface and no retry**, indistinguishable from a user cancel.

**Fix:** Separate the timeout abort from the user abort signal:

```ts
const attempt = async (secs: PromptSection[]): Promise<string> => {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  ctx.abortSignal.addEventListener('abort', onAbort);
  let timedOut = false;
  const to = setTimeout(() => { timedOut = true; ac.abort(); }, ctx.timeoutMs);
  try {
    return await ctx.callProviderJsonMode(secs, jsonSchema, ac.signal);
  } catch (e) {
    if (timedOut) throw new TimeoutError(ctx.timeoutMs); // or an error the classifier maps to TIMEOUT
    throw e;
  } finally {
    clearTimeout(to);
    ctx.abortSignal.removeEventListener('abort', onAbort);
  }
};
```

### WR-04: Retry button on any failed bubble rewrites the NEWEST message, not the failed one

**File:** `src/components/pages/ChatPage.tsx:77-85`

**Issue:** `handleRetry` always operates on `prev[prev.length - 1]` and calls `retry()` which re-sends `lastUserInputRef`. After a failure the user can send a new message (Sender is enabled — `isStreaming` is false), so an older failed bubble keeps its Retry footer (`items` renders it for every failed/offline bubble). Clicking Retry on that stale failed bubble replaces the **newest** assistant message's content with `''` + streaming and re-runs the **newest** user input — the wrong turn is retried and the current answer is wiped.

**Fix:** Track which message a retry belongs to, and only offer/execute retry on the latest assistant bubble:

```ts
const handleRetry = useCallback(() => {
  if (isStreaming) return;
  setMessages((prev) => {
    const last = prev[prev.length - 1];
    if (!last || last.role !== 'assistant') return prev;
    return [...prev.slice(0, -1), { ...last, content: '', status: 'streaming' }];
  });
  retry();
}, [isStreaming, retry]);
// Optionally: only render the footer when m is the last message:
// footer: (m.id === messages[messages.length - 1]?.id && (m.status === 'failed' || m.status === 'offline')) ? ...
```

### WR-05: `useStreamingLLM` never aborts on unmount — in-flight turns keep billing after navigation

**File:** `src/components/pages/useStreamingLLM.ts:93-108`

**Issue:** The only `useEffect` (line 105) wires the ChunkBuffer flush listener; there is no cleanup that calls `abortRef.current?.abort()`. In the standalone shell, switching away from the Chat page (or closing the side panel) unmounts ChatPage while `runAgentTurn` continues executing — the provider request keeps running to completion and tokens keep billing (the opposite of the documented "abort() cancels generation so no orphaned request bills tokens", and of T-03-06-04's abort-cancels-billing intent). The comment at line 115 only covers new-send supersession, not unmount.

**Fix:**

```ts
useEffect(() => {
  if (!bufferRef.current) bufferRef.current = createChunkBuffer();
  const unsubscribe = bufferRef.current.onFlush(setText);
  return () => {
    unsubscribe();
    abortRef.current?.abort(); // cancel in-flight generation on unmount
  };
}, []);
```

### WR-06: ChunkBuffer `flushNow()`/`reset()` call `cancelAnimationFrame` on a `setTimeout` id in degraded mode — stale/duplicate flushes across turns

**File:** `src/core/ai/ChunkBuffer.ts:40-46, 55-71`

**Issue:** When the 8,000 B/s throttle engages, `rafId` holds a `setTimeout` id (line 41), but `flushNow()` and `reset()` cancel it with `cancelAnimationFrame(rafId)` (lines 57, 68) — a no-op for timeout ids. The pending 33 ms timer is not cancelled, and because the callback reads the module-closure `pending`/`full` variables, it will fire *after* `reset()` and flush whatever the **next** turn has buffered (or emit a duplicate/empty flush). Cross-turn text contamination in the degraded path.

**Fix:** Track the timer kind or cancel both:

```ts
let timerIsRaf = true;
// setTimeout path: timerIsRaf = false; rafId = setTimeout(...)
// flushNow/reset:
if (rafId !== null) {
  if (timerIsRaf) cancelAnimationFrame(rafId as number);
  else clearTimeout(rafId as number);
  rafId = null;
}
```

### WR-07: ~300 lines of bootstrap/AI-runtime wiring duplicated verbatim across the two entrypoints

**File:** `src/entrypoints/sidepanel/main.tsx:74-248` and `src/entrypoints/standalone/main.tsx:68-243`

**Issue:** `AI_PROVIDER_IDS`, `runStorageBootstrap()`, `warmOpenIdbStore()`, and `runAIRuntimeInit()` are copy-pasted nearly identically across both entrypoints. Any future change (new provider id, new wiring step, changed error code) must be applied in two places; the duplication already shows drift risk (both are currently identical, but the R-3 isolation guarantees rely on them staying in lockstep).

**Fix:** Extract a shared module (e.g. `src/entrypoints/shared/aiRuntimeInit.ts`) exporting `runAIRuntimeInit(registry, vault, surface)` and the bootstrap chain; each entrypoint keeps only its mount-specific root component.

## Info

### IN-01: `streamTextToLLMChunks` (StreamAdapter) is dead code — no production callers

**File:** `src/core/ai/StreamAdapter.ts:49`

**Issue:** Grep confirms no importer of `streamTextToLLMChunks` anywhere in `src/` — the 03-03 summary's "Seam 3 consumer" claim is not realized; `RendererService` builds `streamText` directly. The module's comment block and the 03-03 SUMMARY describe a consumer boundary that does not exist in code. Either wire it (renderer consumes the adapter) or mark it `@implementation-tier` until a consumer lands.

### IN-02: `ILLMProvider.validateConfig()`/`chat()`/`getModels()` have no callers — the adapter contract is unimplemented

**File:** `src/core/ai/ILLMProvider.ts:22-29`; all five `src/core/ai/providers/*.ts`

**Issue:** `chat()` and `getModels()` are throwing stubs and `validateConfig()` is never invoked anywhere (the 03-09 wiring validates with `ProviderConfigSchema` instead). The `ILLMProvider` interface is thus a contract with two dead methods and one unused one. Acceptable as `@implementation-tier` stubs, but worth a comment on the interface documenting that no Phase-3 consumer exists, so future implementers don't assume the wiring calls `validateConfig`.

### IN-03: `PersonaInjector.inject()` has no production callers

**File:** `src/core/ai/persona/PersonaInjector.ts:53-62`

**Issue:** The hook uses `resolvePersona` + `buildPersonaBlock` directly (`useStreamingLLM.ts:128-129`); `PersonaInjector.inject` is exported and tested but never invoked. Since `contextHelper` receives a pre-built block, the injector's stage-aware composition is dormant. Fine as a Phase-5 seam, but the "persona-first prepend INSIDE the cached [SYSTEM]" claim in the 03-07 SUMMARY is not exercised on the Phase-3 path.

### IN-04: `get-provider-info` returns ALL providers, not the "Active provider" (§10.5 row 8)

**File:** `src/core/ai/ExecutorService.ts:67-72`

**Issue:** The tool's declared semantics are "Active provider + model + limits" (§10.5 row 8), but it returns `getProviderInfos()` — the full registry snapshot including disabled/unreadable entries and `resolvedBaseURL` for every provider. apiKey is correctly stripped (R-10), so this is a semantic mismatch, not a leak. Either narrow to the active provider or widen the tool description.

### IN-05: `ProviderRegistry.getProviderInfo()` (singular) is unused

**File:** `src/core/ai/ProviderRegistry.ts:169-171`

**Issue:** All production consumers use `getProviderInfos()` (plural). The singular accessor has no callers — dead export (or a future Phase-7 settings-UI consumer).

---

_Reviewed: 2026-08-10T23:05:00Z_
_Reviewer: gsd-code-reviewer agent (adversarial review)_
_Depth: standard_
