# Phase 3: Cost-Effective AI Runtime (+ Persona seed) — Pattern Map (gap-closure replan)

**Mapped:** 2026-08-11
**Mode:** gap-closure replan — phase is EXECUTED; VERIFICATION.md found 5 gaps (CR-01, WR-01..WR-04) + REVIEW.md adds WR-05..WR-07. All plans MODIFY existing files.
**Files analyzed:** 8 source files + 2 entrypoints + 8 test files (all existing)
**Analogs found:** 17 / 17 — every target file IS its own analog (current implementation is the pattern to preserve/extend). No new files required except the optional WR-07 extraction target.

**Core principle for this replan:** every gap fix must preserve the file's existing contract (typed error carriers, debugLog Golden Rule 9, lazy singleton, `maxRetries: 0`, F-4/F-5 section threading, 5-state machine) and only change the *defective mechanism*. Copy the CURRENT pattern, then apply the REVIEW.md fix sketch.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/ai/ProviderRouter.ts` (CR-01, WR-03) | service (router: retry/breaker/privacy/budget) | request-response + streaming side-channel | itself (746-line current impl) | exact (self) |
| `src/core/ai/RendererService.ts` (WR-02) | service (Seam-3 streamText consumer) | streaming | itself (118-line current impl) | exact (self) |
| `src/core/ai/StructuredOutput.ts` (WR-03) | service (Appendix L requestJson) | request-response | itself (145-line current impl) | exact (self) |
| `src/core/ai/ProviderRegistry.ts` (WR-01) | store (dependency-free gate primitive) | request-response (gate predicate) | itself (217-line current impl) | exact (self) |
| `src/components/pages/ChatPage.tsx` (WR-04) | component | request-response (UI events) | itself (237-line current impl) | exact (self) |
| `src/components/pages/useStreamingLLM.ts` (WR-05) | hook (D-01 co-located) | streaming | itself (207-line current impl) | exact (self) |
| `src/core/ai/ChunkBuffer.ts` (WR-06) | utility (J.1 throttle buffer) | streaming / transform | itself (73-line current impl) | exact (self) |
| `src/entrypoints/sidepanel/main.tsx` + `src/entrypoints/standalone/main.tsx` (WR-07) | config/entrypoint (bootstrap) | batch (mount init chain) | each other (near-identical 357/352-line impls) | exact (mutual duplication) |
| `tests/core/ai/ProviderRouter.test.ts` (CR-01, WR-03 regression) | test | — | itself (645 lines, real-Router + mocked SDK) | exact (self) |
| `tests/core/ai/RendererService.test.ts` (WR-02 regression) | test | — | itself (242 lines, mockStream seam) | exact (self) |
| `tests/core/ai/StructuredOutput.test.ts` (WR-03 regression) | test | — | itself (211 lines, makeContext responder) | exact (self) |
| `tests/core/ai/ProviderRegistry.test.ts` (WR-01 regression) | test | — | itself (147 lines, freshConfig helper) | exact (self) |
| `tests/core/ai/ChunkBuffer.test.ts` (WR-06 regression) | test | — | itself (157 lines, real rAF + sleep) | exact (self) |
| `tests/components/pages/ChatPage.test.tsx` (WR-04 regression) | test | — | itself (209 lines, vi.hoisted hookMock) | exact (self) |
| `tests/components/pages/useStreamingLLM.test.tsx` (WR-05 regression) | test | — | itself (289 lines, renderHook + vi.hoisted) | exact (self) |
| `tests/core/ai/AgentOrchestrator.test.ts` (CR-01 integration seam) | test | — | itself (363 lines) — **makeResolver bypasses createStageInvocation; CR-01 regression must NOT copy this** | partial (must extend) |

---

## Pattern Assignments

### `src/core/ai/ProviderRouter.ts` (service, request-response) — CR-01 + WR-03

**Analog:** itself — the 746-line current implementation. Keep: typed `ProviderUnavailableError` (L264-308), `RETRYABLE_CODES` (L165-170), `BREAKER_VOTES` (L177-186), F-4 `joinSections`/`buildCallProviderJsonMode` closure, F-5 `buildStageMessages`, D-13 privacy gate (L203-210), D-16 `budgetGuard` no-op (L329), lazy `getProviderRouter()` singleton (L736-746).

**Imports pattern** (L27-46) — ai-sdk symbols used ONLY through the type surface; everything else from `@/core` aliases:
```typescript
import { APICallError, LoadAPIKeyError, NoObjectGeneratedError, generateObject, generateText, jsonSchema } from 'ai';
import type { CoreMessage, LanguageModel, ProviderMetadata } from 'ai';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import type { ErrorCode } from '@/core/error/errorCodes';
import { getAISDKModel } from '@/core/ai/ILLMProvider';
import { applyCacheHints } from '@/core/ai/PromptCacheAdapter';
import { getPromptCacheManager } from '@/core/ai/PromptCacheManager';
import { resolveTier } from '@/core/ai/TierResolver';
import type { ProviderId, PromptSection } from '@/core/ai/types';
```

**CR-01 — the DEFECTIVE pattern to fix (R-2 budget conflation).** The budget is currently a *total per-operation SDK-call counter* — `attemptCount()` counts every `recordAttempt` (including legitimate sequential planner stage calls and the final renderer resolution):

`createStageInvocation` budget gate (L392-395):
```typescript
if (this.attemptCount(input.operationId) >= ROUTER_MAX_ATTEMPTS) {
  // R-2: the non-multiplying budget is spent — terminate, never re-enter.
  throw unavailable('no_candidate', undefined, 'router attempt budget exhausted');
}
```
`buildCallProviderJsonMode`'s inner `attempt()` re-checks the same counter (L587-589):
```typescript
if (this.attemptCount(input.operationId) >= ROUTER_MAX_ATTEMPTS) {
  throw unavailable('no_candidate', cand.providerId, 'router attempt budget exhausted');
}
```
`recordAttempt` pushes to `state.attempts` on EVERY SDK call, success or failure (L691-702); `attemptCount` reads `.length` (L687-689). Result: `ROUTER_MAX_ATTEMPTS = 3` (L156) is consumed by a 2-tool medium-tier turn (3 planner calls) before the renderer stage resolves → `no_candidate`.

**CR-01 fix sketch (03-REVIEW.md CR-01):** scope the R-2 budget to *router-owned retries only*. `RouterAttemptState` (L120-125) gains a `retryCount` field separate from the observability ledger:
```typescript
// In RouterAttemptState (L120-125): add retryCount
//   attempts: ProviderAttempt[]   // every SDK call (observability — unchanged)
//   retryCount: number            // ONLY router-owned retries (D-17)
// Budget check (L392-394 + L587-589): if (retryCount >= ROUTER_MAX_ATTEMPTS) → no_candidate
// recordAttempt(): increment retryCount ONLY for the D-17 retried call (buildCallProviderJsonMode L616-619),
//   never for a stage's first invocation or a structured-output repair.
```

**WR-03 — the DEFECTIVE pattern to fix (timeout never classified).** `classifyProviderError` maps ALL AbortErrors to `{ code: 'UNKNOWN', retryable: false }` (L493-496), so the timeout abort produced by StructuredOutput.ts's `setTimeout(() => ac.abort(), ...)` can never produce `TIMEOUT` (which IS in `RETRYABLE_CODES` L165-170):
```typescript
if (isAbortError(err)) {
  // User/surface abort — not a provider failure, never retried, no breaker vote.
  return { code: 'UNKNOWN', retryable: false };
}
```
The regex fallback (L511-513) catches message-text timeouts only:
```typescript
if (/timeout|timed out|deadline exceeded/i.test(msg)) {
  return { code: 'TIMEOUT', retryable: true };
}
```
**WR-03 fix sketch (03-REVIEW.md WR-03):** once StructuredOutput throws a timeout-origin error (see its assignment below), classify it here. Pattern: add a `TimeoutError`-style check BEFORE the `isAbortError` branch — e.g. `if (err instanceof TimeoutError) return { code: 'TIMEOUT', retryable: true };` — so user aborts still land on `UNKNOWN` and timeout-origin aborts land on the retryable `TIMEOUT`.

**Existing wiring the planner must NOT break:** `markStreamedFirstToken` (L475-477) and `recordFailure` (L521-523) — both are the WR-02 consumers (see RendererService); `voteBreaker` (L710-729) with `BREAKER_VOTES` table; the one-retry D-17 loop (L609-621).

---

### `src/core/ai/RendererService.ts` (service, streaming) — WR-02

**Analog:** itself — the 118-line Seam-3 consumer. Keep: `RENDERER_MAX_TOKENS = 512` (L28), typed `StreamFailedError` carrier + `isStreamFailedError` guard + `streamFailed` factory (L52-66), `render()` building `streamText` from the Router's F-5 `buildStageMessages` (L77-84), `maxRetries: 0` (L82).

**The streaming-honesty core (L86-117) — the current pattern to preserve:**
```typescript
let accumulated = '';
let finishReason: string;
try {
  for await (const delta of result.textStream) {
    accumulated += delta;
    input.onDelta?.(delta);
  }
  // Pitfall 5: ALWAYS await the terminal member — never return un-await-verified text.
  finishReason = await result.finishReason;
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  debugLog(ERROR_CODES.STREAM_FAILED, 'renderer stream aborted mid-generation', {
    module: 'RendererService',
    error: err,
    extra: { operationId: input.operationId, partialTokens: accumulated.length },
  });
  throw streamFailed(err.message, accumulated);
}
if (finishReason !== 'stop') {
  debugLog(ERROR_CODES.STREAM_FAILED, `renderer finished with ${finishReason} — failed terminal`, {
    module: 'RendererService',
    extra: { operationId: input.operationId, finishReason, partialTokens: accumulated.length },
  });
  throw streamFailed(`finishReason '${finishReason}' !== 'stop'`, accumulated);
}
return { text: accumulated, finishReason };
```

**WR-02 — the DEFECTIVE pattern (dead-code wiring):** the catch (L95-103) and the non-`stop` finish branch (L104-116) throw `STREAM_FAILED` WITHOUT calling `getProviderRouter().recordFailure(...)`; the delta loop (L89-92) never calls `markStreamedFirstToken(...)`. So `hasStreamedFirstToken` stays `false` forever and the §1.5 breaker never votes on the only production path that needs it.

**WR-02 fix sketch (03-REVIEW.md WR-02)** — import the singleton and wire both calls (mirror the existing `debugLog` placement; note the router singleton pattern at ProviderRouter.ts L736-746):
```typescript
import { getProviderRouter } from '@/core/ai/ProviderRouter';  // + existing imports
// in the catch (before/after debugLog, L97-101):
getProviderRouter().recordFailure(input.invocation.providerId, ERROR_CODES.STREAM_FAILED, err);
// in the non-stop branch (alongside debugLog, L107-114):
getProviderRouter().recordFailure(input.invocation.providerId, ERROR_CODES.STREAM_FAILED, err);
// after the first streamed delta (inside the for-await, L89-92), with a firstTokenMarked flag:
getProviderRouter().markStreamedFirstToken(input.operationId);
```
**Planner note:** the catch also handles the user-abort case — `recordFailure` on a user abort would vote the breaker for a non-provider failure. Preserve the existing semantics: only vote when the failure is provider-originated (the REVIEW sketch calls `recordFailure` unconditionally in the catch; the planner must reconcile with `isAbortError`-style checks, using the `isAbortError` name-match pattern at ProviderRouter.ts L732-734).

---

### `src/core/ai/StructuredOutput.ts` (service, request-response) — WR-03

**Analog:** itself — the 145-line Appendix L implementation. Keep: `StructuredOutputContext` (L38-52), `StructuredOutputFailedError` + guard (L59-70), one-repair flow (L92-124), `safeParse` fence-strip (L129-144), `TASK_KINDS` byte-stability repair-section logic (L100-111).

**The DEFECTIVE per-attempt controller (L80-91) — WR-03 root cause:**
```typescript
const attempt = async (secs: PromptSection[]): Promise<string> => {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  ctx.abortSignal.addEventListener('abort', onAbort);
  const to = setTimeout(() => ac.abort(), ctx.timeoutMs);   // ← timeout aborts the SAME controller
  try {
    return await ctx.callProviderJsonMode(secs, jsonSchema, ac.signal);
  } finally {
    clearTimeout(to);
    ctx.abortSignal.removeEventListener('abort', onAbort);
  }
};
```
When the timeout fires, the SDK rejects with `AbortError`; `classifyProviderError` maps that to `UNKNOWN` (ProviderRouter L493-496) → the D-17 retry never fires and the hook's `isAbortError` branch (useStreamingLLM L173-177) swallows it to a silent `idle`.

**WR-03 fix sketch (03-REVIEW.md WR-03)** — separate the timeout origin from the user abort:
```typescript
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
**Planner note:** `TimeoutError` must be importable by ProviderRouter's `classifyProviderError` without an import cycle (StructuredOutput currently imports NO Router symbols — only `zod`, `zod-to-json-schema`, `debugLog`, `ERROR_CODES`, `PROMPTS`, types). Prefer a small shared error (e.g. add to `src/core/error/` alongside `errorCodes.ts`) or a shape check (`err.name === 'TimeoutError'`) so the cycle stays broken.

---

### `src/core/ai/ProviderRegistry.ts` (store, gate predicate) — WR-01

**Analog:** itself — the 217-line dependency-free registry. Keep: `RegistryProviderInfo` snapshot (L27-39, apiKey-stripped), `markProviderKeyUnreadable` single-transition (L136-166), `registerProvider` sanitization (L95-124), `getProviderInfos()` (L174-176), lazy `getProviderRegistry()` singleton (L214-217).

**The DEFECTIVE gate (L184-189) — WR-01:** checks ONLY the last-registered provider:
```typescript
hasActiveProvider(): boolean {
  if (this.activeProviderId === undefined) return false;
  const entry = this.providers.get(this.activeProviderId);
  if (entry && (entry.keyUnreadable || !entry.enabled)) return false;
  return true;
}
```
`activeProviderId` is set to "last registration wins" at L118 (`this.activeProviderId = config.id;` inside `registerProvider`). `runAIRuntimeInit` registers in the fixed order openai→anthropic→gemini→ollama (sidepanel/main.tsx L74, standalone L69) — so a disabled/unreadable LAST provider closes the whole surface even when earlier providers are usable.

**WR-01 fix sketch (03-REVIEW.md WR-01)** — "any usable provider" semantics:
```typescript
hasActiveProvider(): boolean {
  for (const entry of this.providers.values()) {
    if (entry.enabled && !entry.keyUnreadable) return true;
  }
  return false;
}
```
Preserve `getActiveProvider()` (L191-193) unchanged — it stays the "last registered" accessor (used by tests L44-46). No other contract changes.

---

### `src/components/pages/ChatPage.tsx` (component, UI events) — WR-04

**Analog:** itself — the 237-line minimal chat surface. Keep: `ChatMessage` shape (L29-34), 5-state mapping effect (L90-105), `items` useMemo Bubble.List composition (L107-149), `handleSend` (L55-70), Sender (L214-230), `FAILED_PREFIX` (L42).

**The DEFECTIVE retry handler (L77-85) — WR-04:** always targets `prev[prev.length - 1]`:
```typescript
const handleRetry = useCallback(() => {
  if (isStreaming) return;
  setMessages((prev) => {
    const last = prev[prev.length - 1];
    if (!last || last.role !== 'assistant') return prev;
    return [...prev.slice(0, -1), { ...last, content: '', status: 'streaming' }];
  });
  retry();
}, [isStreaming, retry]);
```
The footer (L129-146) renders the Retry button on EVERY failed/offline bubble (`m.status === 'failed' || m.status === 'offline'`), all calling the same `handleRetry` — after a failure + new send, clicking an OLD failed bubble's Retry wipes the NEWEST assistant message and re-runs the newest input.

**WR-04 fix sketch (03-REVIEW.md WR-04):** scope retry to the latest assistant bubble only — gate the footer on `m.id === messages[messages.length - 1]?.id` inside the `items` useMemo (L129-146), OR track a per-bubble retry target. The fixed `handleRetry` shape:
```typescript
const handleRetry = useCallback(() => {
  if (isStreaming) return;
  setMessages((prev) => {
    const last = prev[prev.length - 1];
    if (!last || last.role !== 'assistant') return prev;
    return [...prev.slice(0, -1), { ...last, content: '', status: 'streaming' }];
  });
  retry();
}, [isStreaming, retry]);
// + footer: (m.id === messages[messages.length - 1]?.id && (m.status === 'failed' || m.status === 'offline')) ? (...) : undefined
```
**Planner note:** `retry()` in the hook re-sends `lastUserInputRef` with a NEW operationId (useStreamingLLM.ts L197-200) — the UI contract is "Retry only offered on the latest failed/offline assistant bubble", which matches the UI-SPEC failed-row semantics.

---

### `src/components/pages/useStreamingLLM.ts` (hook, streaming) — WR-05

**Analog:** itself — the 207-line co-located hook. Keep: 5-state machine type (L55-60), `send` path with contextHelper → StageResolver → `runAgentTurn` (L110-195), `isAbortError` name-match (L78-84), `configuredFromRegistry` (L87-91), `retry` (L197-200), `abort` (L202-204).

**The DEFECTIVE effect (L105-108) — WR-05:** no unmount cleanup:
```typescript
useEffect(() => {
  if (!bufferRef.current) bufferRef.current = createChunkBuffer();
  return bufferRef.current.onFlush(setText);
}, []);
```
The cleanup only unsubscribes the flush listener — it never calls `abortRef.current?.abort()`, so an in-flight `runAgentTurn` keeps billing after unmount (standalone: switching away from ChatPage; side panel: closing).

**WR-05 fix sketch (03-REVIEW.md WR-05):**
```typescript
useEffect(() => {
  if (!bufferRef.current) bufferRef.current = createChunkBuffer();
  const unsubscribe = bufferRef.current.onFlush(setText);
  return () => {
    unsubscribe();
    abortRef.current?.abort(); // cancel in-flight generation on unmount
  };
}, []);
```
The hook's existing abort→idle mapping (L173-177) already handles the resulting AbortError (`operationIdRef.current !== operationId` guard at L171 no-ops the superseded path).

---

### `src/core/ai/ChunkBuffer.ts` (utility, streaming transform) — WR-06

**Analog:** itself — the 73-line Appendix J.1 buffer. Keep: `ChunkBuffer` interface (L9-14), rAF `schedule()` (L22-30), byte-rate measurement (L34-39), order preservation (`full += pending`).

**The DEFECTIVE timer-kind handling (L40-46, 55-71) — WR-06:** `rafId` is used for BOTH a rAF id and a `setTimeout` id, but `flushNow()`/`reset()` cancel with `cancelAnimationFrame` regardless:
```typescript
// enqueue's throttle branch (L40-46) stores a setTimeout id in rafId:
if (byteRate > 8_000 && rafId === null) {
  rafId = setTimeout(() => { rafId = null; full += pending; pending = ''; listeners.forEach((cb) => cb(full)); }, 33) as unknown as number;
}
// flushNow (L55-63) + reset (L64-71) cancel it WRONG:
if (rafId !== null) {
  cancelAnimationFrame(rafId as number);   // no-op for a timeout id
  rafId = null;
}
```

**WR-06 fix sketch (03-REVIEW.md WR-06):**
```typescript
let timerIsRaf = true;
// setTimeout branch (L41): timerIsRaf = false; rafId = setTimeout(...) as unknown as number;
// flushNow/reset (L57/L68):
if (rafId !== null) {
  if (timerIsRaf) cancelAnimationFrame(rafId as number);
  else clearTimeout(rafId as number);
  rafId = null;
}
```
**Planner note:** a `reset()` following a pending throttle timer currently lets the closure read `pending`/`full` AFTER reset and flush the next turn's buffer (cross-turn contamination) — the regression test must assert: enqueue > 8_000 B → reset() → no stray flush after the 33 ms elapses.

---

### `src/entrypoints/sidepanel/main.tsx` + `src/entrypoints/standalone/main.tsx` (config/entrypoint, batch mount init) — WR-07

**Analog:** each other — near-identical duplication (sidepanel L74-248 vs standalone L69-243). Both define the SAME module-scope functions with only a surface-string difference:
- `AI_PROVIDER_IDS` (sidepanel L74 / standalone L69) — identical `['openai', 'anthropic', 'gemini', 'ollama'] as const`
- `runStorageBootstrap()` (sidepanel L84-143 / standalone L79-138) — byte-identical (KeyVault first-run → migrate-on-read → IDB migrator + ErrorStore)
- `warmOpenIdbStore()` (sidepanel L146-163 / standalone L141-158) — byte-identical
- `runAIRuntimeInit()` (sidepanel L179-248 / standalone L174-243) — byte-identical (vault envelope decrypt → registry register/markProviderKeyUnreadable → Router.configure baseline)
- Mount chain (sidepanel L303-357 / standalone L298-352) — identical modulo `'sidepanel'`/`'standalone'` surface strings and the router component

**WR-07 fix sketch (03-REVIEW.md WR-07):** extract `src/entrypoints/shared/aiRuntimeInit.ts` exporting `runAIRuntimeInit(registry, vault, surface)` + `runStorageBootstrap()` + `warmOpenIdbStore()` + `AI_PROVIDER_IDS`; each entrypoint keeps only its mount-specific root component. The extraction target has **no existing analog** — it is created by lifting the duplicated functions verbatim (the entrypoints' current bodies ARE the source pattern).

---

## Regression Test Patterns (per gap)

### CR-01 — the critical NEW integration test (no existing analog)
**Existing test gap (VERIFICATION.md):** "the AgentOrchestrator suite's `makeResolver` bypasses `createStageInvocation` entirely — which is exactly where CR-01 lives." The current `AgentOrchestrator.test.ts` `makeResolver` (L63-77) returns canned `stageInvocation()` bundles. The CR-01 regression MUST combine two existing patterns:
- **Real-Router + mocked-SDK** (from `ProviderRouter.test.ts`): `vi.mock('ai', ...)` keeping real error classes (L46-53), `resolveTierMock` (L58-64), `makeInput` (L85-101), `apiError` factory (L103-110).
- **Orchestrator loop with a REAL StageResolver**: replace `makeResolver` with one that wraps `router.createStageInvocation` (ProviderRouter.test.ts L381-463 pattern) so the full planner-loop → renderer-resolution interplay runs against the real budget.

Assertion targets (from the VERIFICATION reproduction): a medium-tier turn (`tier: { plannerCap: 3, toolCap: 2 }`) with 2 allowed `run_tool` decisions MUST complete with `reasonCode: 'answer'` and the renderer MUST run (renderMock called) — never `no_candidate`.

### WR-01 — extend `tests/core/ai/ProviderRegistry.test.ts`
Copy the `freshConfig` helper (L18-30) + gate suite shape (L37-86). New cases: register openai (enabled) THEN register ollama (enabled:false, e.g. via `markProviderKeyUnreadable`) → `hasActiveProvider()` still `true`; all-disabled → `false`; legacy `registerActiveProvider` with no registry entry → `false`.

### WR-02 — extend `tests/core/ai/RendererService.test.ts`
Copy the `mockStream` seam (L70-89: async-generator textStream + finishReason promise) + `baseInput` (L58-68) + `vi.mock('ai')` stub-only-streamText (L32-38). New cases: mock `getProviderRouter` (vi.mock `@/core/ai/ProviderRouter` returning `{ recordFailure: vi.fn(), markStreamedFirstToken: vi.fn() }` — the useStreamingLLM.test.tsx L45-47 pattern) and assert: mid-stream rejection → `recordFailure` called with `(invocation.providerId, 'STREAM_FAILED')`; first delta → `markStreamedFirstToken` called once; user-abort (DOMException AbortError thrown mid-stream) → `recordFailure` NOT called (per the planner's reconciliation).

### WR-03 — extend `tests/core/ai/StructuredOutput.test.ts` + `ProviderRouter.test.ts`
- StructuredOutput: copy `makeContext` (L37-55) + the abort re-parenting suite (L171-211). New case: a responder that never resolves → after `timeoutMs`, `requestJson` rejects with the TIMEOUT-origin error (not a bare AbortError) and the outer `abortSignal` still re-parents (existing L189-210 case keeps passing).
- ProviderRouter: in the `classifyProviderError` suite (L396-432), assert the timeout-origin error → `{ code: 'TIMEOUT', retryable: true }` and a user `DOMException('aborted','AbortError')` still → `{ code: 'UNKNOWN', retryable: false }`.

### WR-04 — extend `tests/components/pages/ChatPage.test.tsx`
Copy the `hookMock` vi.hoisted pattern (L50-60) + `setStream`/`forceUpdate` helpers (L62-77) + IntersectionObserver stubs (L21-41). New case: fail turn 1 (`setStream('failed')`), then send a NEW message and complete it (`setStream('completed','new answer')`), then click Retry — the OLD bubble's footer must NOT render a Retry button (gated footer) OR clicking it must not wipe the newest message.

### WR-05 — extend `tests/components/pages/useStreamingLLM.test.tsx`
Copy the vi.hoisted module mocks (L18-51) + the abort test pattern (L233-265: capture the runAgentTurn signal, then act). New case: `renderHook` → send (turn pending) → `unmount()` → captured `abortSignal.aborted === true`. The test must hold a pending turn open (the L236-245 pattern) and assert the unmount cleanup aborts it.

### WR-06 — extend `tests/core/ai/ChunkBuffer.test.ts`
Copy the `nextFrame`/`sleep` helpers (L12-19) + the byte-rate throttle suite (L110-139). New case: enqueue a > 8_000-char delta (enters setTimeout branch) → `reset()` → `await sleep(60)` → flushes remain `[]` (no stray post-reset flush); then enqueue fresh + `flushNow()` → only the fresh text (buffer usable after reset, existing L141-156 pattern).

---

## Shared Patterns

### debugLog + canonical ERROR_CODES (Golden Rule 9)
**Source:** every core file (ProviderRouter.ts L424-435, L446-458, L721-725; RendererService.ts L97-101, L107-114; StructuredOutput.ts L116-119; useStreamingLLM.ts L180-184; both entrypoints' bootstrap catches)
**Apply to:** every catch in every fix. Never an empty catch, never a new error string. Shape:
```typescript
debugLog(ERROR_CODES.STREAM_FAILED, 'human description', {
  module: 'RendererService',                       // per-file module tag
  error: err instanceof Error ? err : undefined,   // R-10: never raw bodies/keys
  extra: { operationId, ... },                     // redacted, code + module only
});
```

### Typed error carriers (code-literal + guard + factory)
**Source:** `ProviderUnavailableError` (ProviderRouter.ts L264-308), `StreamFailedError` (RendererService.ts L52-66), `StructuredOutputFailedError` (StructuredOutput.ts L59-70)
**Apply to:** the WR-03 `TimeoutError` addition. Pattern: `interface XError extends Error { code: 'X'; ... }` + `isXError(err: unknown): err is XError` + factory that casts `new Error(...) as XError`. The WR-03 fix must fit this shape so `classifyProviderError` can `instanceof`-or-shape-check it.

### Lazy singleton accessors
**Source:** `getProviderRouter()` (ProviderRouter.ts L736-746), `getProviderRegistry()` (ProviderRegistry.ts L214-217), `getPromptCacheManager()` precedent
**Apply to:** WR-02's RendererService wiring. Pattern:
```typescript
let singleton: X | null = null;
export function getX(): X {
  if (singleton === null) singleton = new X();
  return singleton;
}
```

### `isAbortError` name-match (prototype-chain agnostic)
**Source:** ProviderRouter.ts L732-734, AgentOrchestrator.ts L204-211, useStreamingLLM.ts L78-84
**Apply to:** WR-02 (distinguish user aborts from provider failures before `recordFailure`) and WR-03 (timeout-origin vs user-origin).
```typescript
function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}
```

### `vi.mock('ai')` test seam — keep real error classes, stub only the SDK call sites
**Source:** ProviderRouter.test.ts L46-53 (`generateObject`/`generateText`), RendererService.test.ts L32-38 (`streamText`)
**Apply to:** all core-ai regression tests. `await importOriginal` spreads the real module so `instanceof APICallError/NoObjectGeneratedError` still works in `classifyProviderError`.

### R-10 TraceRedactor boundary
**Source:** ProviderRouter.test.ts L551-603 (console.error capture asserts canonical codes present, secrets absent); debugLog auto-routes through TraceRedactor
**Apply to:** any new log line — assert captured logs contain the canonical code and never `sk-`/prompt bodies.

### Mount-chain bootstrap (WR-07 extraction source)
**Source:** sidepanel/main.tsx L84-248 + L303-357; standalone/main.tsx L79-243 + L298-352
**Apply to:** the new `src/entrypoints/shared/aiRuntimeInit.ts`. Every step wrapped: `try/catch` + `debugLog(canonical code, ..., { module: 'storage-bootstrap' | 'ai-runtime-init' })` + fall-through; never rejects the mount.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/entrypoints/shared/aiRuntimeInit.ts` (WR-07 target) | config/utility | batch | No shared-entrypoint module exists — the pattern is the duplicated `runStorageBootstrap`/`warmOpenIdbStore`/`runAIRuntimeInit`/`AI_PROVIDER_IDS` lifted verbatim from both main.tsx files |
| CR-01 integration regression test (new case) | test | — | No existing test exercises the REAL Router budget across planner-loop + renderer-resolution (AgentOrchestrator.test.ts `makeResolver` bypasses `createStageInvocation`); compose ProviderRouter.test.ts's real-router+mock-SDK pattern with the orchestrator loop |

---

## Metadata

**Analog search scope:** `src/core/ai/*`, `src/components/pages/*`, `src/entrypoints/{sidepanel,standalone}/*`, `tests/core/ai/**`, `tests/components/pages/**`, `tests/fixtures/*`
**Files scanned:** 10 source files (fully read) + 8 test files (fully read) + `src/core/error/errorCodes.ts` (targeted grep)
**Pattern extraction date:** 2026-08-11
**Mode note:** gap-closure — analogs are the files themselves; excerpts show CURRENT implementations so the planner writes precise MODIFY tasks (fix defective mechanism, preserve everything else).
