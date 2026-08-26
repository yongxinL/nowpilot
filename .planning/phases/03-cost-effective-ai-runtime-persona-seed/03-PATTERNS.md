# Phase 3: Cost-Effective AI Runtime (+ Persona seed) - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 23 (19 new `src/core/ai/*` + 3 out-of-inventory modifications + 1 test fixture dir)
**Analogs found:** 21 / 23

> **Critical dependency for ALL plan actions:** `pnpm install` first — `node_modules` is ABSENT (RESEARCH.md Environment Availability). `zod-to-json-schema@3.25.2` is the only new dependency (`pnpm add zod-to-json-schema`), pinned by Appendix L — **do NOT substitute Zod 4 `z.toJSONSchema()`** (deferred v0.2).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/ai/types.ts` | types/utility | N/A (shared types) | `src/types/storage.ts`, `src/types/index.ts` | exact |
| `src/core/ai/ILLMProvider.ts` | interface/utility | N/A | `src/services/aiProvider.ts` `StreamChatParams` (lines 3-13) | role-match |
| `src/core/ai/ProviderRegistry.ts` | registry/provider | CRUD/read | `src/core/registry/Registry.ts` + `src/store/useExtensionStore.ts` np_providers read (774-775) | role-match |
| `src/core/ai/providers/{OpenAI,Anthropic,Gemini,Ollama,OpenAICompat}Provider.ts` | provider/service | streaming | `src/services/aiProvider.ts` (fetch/auth/SSE) + `src/core/http/Requester.ts` | exact (fetch+SSE) |
| `src/core/ai/ProviderRouter.ts` | service | request-response | `src/core/http/Requester.ts` (canonical codes) + `src/services/aiProvider.ts` | role-match |
| `src/core/ai/TierResolver.ts` | utility | transform | `src/services/aiProvider.ts` model-discovery semantics (lines 38-149) | partial |
| `src/core/ai/PromptCacheManager.ts` | service | transform | `src/core/prompts/index.ts` (stub) + `src/core/theme/chromeStorageAdapter.ts` hashing | partial |
| `src/core/ai/PromptCacheAdapter.ts` | utility | transform | Appendix K verbatim (RESEARCH.md) — no close codebase analog | none |
| `src/core/ai/PlannerService.ts` | service | request-response | Appendix L repair pattern + `src/types/storage.ts` zod union | partial |
| `src/core/ai/ExecutorService.ts` | service | request-response | `src/core/registry/Registry.ts` (closed-set contract) | role-match |
| `src/core/ai/RendererService.ts` | service | streaming | `src/services/aiProvider.ts` streaming + `src/components/chat/useChatStreaming.ts` | role-match |
| `src/core/ai/AgentOrchestrator.ts` | service/orchestrator | event-driven | `src/core/storage/WriteJournal.ts` `runJournaled` (118-160) | role-match |
| `src/core/ai/StructuredOutput.ts` | utility/service | transform | Appendix L verbatim — no codebase analog | none |
| `src/core/ai/toolSchemas.ts` | registry/types | N/A | `src/core/registry/Registry.ts` (declare-now) + `src/types/storage.ts` union | role-match |
| `src/core/ai/StreamAdapter.ts` | service/adapter | streaming | `src/services/aiProvider.ts` SSE parser (424-444) — the bug being fixed | exact (negative analog) |
| `src/core/ai/ChunkBuffer.ts` | utility | streaming | Appendix J verbatim — no codebase analog | none |
| `src/core/ai/persona/PersonaProfile.ts` | model | N/A | `src/types/storage.ts` zod schema + constant | role-match |
| `src/core/ai/persona/PersonaInjector.ts` | utility | transform | Appendix N.2 verbatim — no codebase analog | none |
| `src/core/runtime/workerState.ts` **(mod)** | state | event-driven | `src/core/workspace/WorkspaceElection.ts` (state machine) + `src/core/runtime/workerState.ts` (add to it) | exact |
| `src/core/prompts/index.ts` **(mod)** | config | N/A | `src/core/prompts/index.ts` (existing stub, replace `repairJson` with canonical) | exact |
| `src/components/chat/useChatStreaming.ts` **(mod)** | hook | streaming | itself (D-44 re-point `streamChatResponse` → `AgentOrchestrator`) | exact |
| `src/types/storage.ts` **(mod)** | types | N/A | itself (additive `'append-chat-turn'` union member) | exact |
| `src/components/options/OptionsPage.tsx` **(mod)** | component | request-response | itself (D-50 endpoint-override + D-54 tier-assignment fields) | exact |
| `tests/core/ai/**` (8 files + fixtures) | test | N/A | `tests/core/ai/testProviderConnection.test.ts`, `tests/core/runtime/OperationId.test.ts` | exact |

---

## Pattern Assignments

### `src/core/ai/types.ts` (types/utility, shared types)

**Analog:** `src/types/storage.ts` (lines 14-110) + `src/types/index.ts` (lines 94-137)

Declares the canonical zod unions + interfaces for the whole `src/core/ai` module. Mirror how `storage.ts` declares a schema + inferred type pair, and how `index.ts` declares `CustomProviderId`/`ProviderConfig`/`CustomProviderDetail`.

**Shared types to declare here** (per RESEARCH structure + A8): `ProviderId`, `ModelTier`, canonical stream event union (D-47), `RouterAttemptState` (RESEARCH §1.5 lines 387-396), `ToolExecutionResult`, minimal `PromptSection` (`{kind, text, stable, tokens}` — A8 contract for Phase-5 ContextOptimizer), and minimal `UserPreferences` (`fastModel`/`balancedModel`/`personaOverrides` — Open Q2, import target for PersonaInjector).

**Zod discriminated-union pattern** (`src/types/storage.ts:82-101` — same literal-union style the PlannerDecisionSchema and canonical events use):
```typescript
export const WriteJournalOperationSchema = z.union([
  z.literal('append-memory-message'),
  z.literal('update-workspace'),
  // ... 11 members
]);
```

**PlannerDecision discriminated union** (RESEARCH §1.2, lines 372-385 — verbatim spec, zod ^4):
```typescript
export const PlannerDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('answer'), reasonCode: z.string().max(64) }),
  z.object({ action: z.literal('run_tool'), toolName: z.string().max(64), input: z.unknown() }),
  z.object({
    action: z.literal('ask_clarification'),
    question: z.string().max(200),
    options: z.array(z.string().max(60)).max(4).default([]),
  }),
]);
```

**Canonical stream event union** (D-47, maps to `ActiveStreamState`):
```typescript
// STREAM_START / STREAM_DELTA / STREAM_COMPLETE / STREAM_ERROR / STREAM_ABORTED
// All cross-boundary data uses zod (CLAUDE.md). Correlate with Phase-1 OperationId (Flag C).
```

---

### `src/core/ai/ILLMProvider.ts` (interface, N/A)

**Analog:** `src/services/aiProvider.ts:3-13` — the `StreamChatParams` interface is the existing streaming-contract shape; the new `ILLMProvider` is its type-safe successor.

**Existing interface shape to extend** (`src/services/aiProvider.ts:3-13`):
```typescript
export interface StreamChatParams {
  messages: Message[];
  prompt: string;
  config: ProviderConfig;
  onChunk: (chunk: string, thoughtChunk?: string) => void;   // ← RETIRED by D-47
  onDone: (fullText: string, fullThought?: string) => void;  // ← RETIRED by D-47
  signal?: AbortSignal;
}
```
**Discretion:** exact method surface (`stream(request, signal)` → canonical events + `requestJson` for structured output) per §1.5/§20.10 — planner's call, no invention. The old `onChunk`/`onDone` callback surface is retired (D-47); new interface returns the canonical event union, threads `AbortSignal`, and must let StreamAdapter normalize per-provider wire formats.

---

### `src/core/ai/ProviderRegistry.ts` (registry/provider, CRUD/read)

**Analog:** `src/core/registry/Registry.ts` (register/get/getAll/get pattern) + `src/store/useExtensionStore.ts` np_providers read path.

**Declarative register + sync-read registry pattern** (`src/core/registry/Registry.ts:7-23` — same register/getAll/get shape D-51 needs):
```typescript
export const SidePanelPageRegistry = {
  register(page: SidePanelPageRegistration): void { sidePanelPages.set(page.id, page); },
  getAll(): SidePanelPageRegistration[] { return Array.from(sidePanelPages.values()); },
  get(id: string): SidePanelPageRegistration | undefined { return sidePanelPages.get(id); },
};
```
**D-49 normalize-in-memory:** reads the Phase-2 object shape (`{ providers: Record<CustomProviderId, CustomProviderDetail>, openAiKey, geminiKey }` — `src/types/index.ts:114-137`) at hydrate; exposes normalized `ProviderConfig[]` at the API boundary only. **Disk stays Phase-2 object** — no migration risk.

**np_providers read path** — `src/store/useExtensionStore.ts` decrypts the encrypted np_providers blob (`chromeStorageAdapter.getItem('np_providers')` at line 775). Phase 3 consumes it via the existing EncryptedStorage read (Security V6 — no new crypto). **D-50** merges `np_endpoint_overrides` (new chrome.storage.local key) over the §10.6 ENDPOINTS defaults. **D-52** caches live-discovered models per provider in-memory.

---

### `src/core/ai/providers/{OpenAI,Anthropic,Gemini,Ollama,OpenAICompat}Provider.ts` (provider/service, streaming)

**Analog:** `src/services/aiProvider.ts` (fetch/auth/SSE) — the per-provider request build + wire-format parse to rebuild. **`src/core/http/Requester.ts` is the fetch wrapper to consume** (Don't Hand-Roll).

**Auth header patterns** (`src/services/aiProvider.ts:78-88` — per-provider auth; NOTE `claude` here = `anthropic`):
```typescript
const headers: Record<string, string> = {};
if (apiKey) {
  if (providerId === 'claude') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
}
```
- **Gemini** auth uses `key=` query param (`aiProvider.ts:54` — INTEGRATIONS.md:16) — CONCERNS.md flags key leakage; prefer header auth where provider allows; never log URLs with keys (debugLog redaction discipline).
- **Ollama** targets the OpenAI-compatible `{base}/chat/completions` (A4, endpoint `http://localhost:11434/v1` §10.6).

**Fetch via Requester** (Don't Hand-Roll row — `src/core/http/Requester.ts:52-98`):
```typescript
export async function request(url, init, opts): Promise<Response> {
  // canonical codes: RATE_LIMITED | TIMEOUT | NETWORK (RequesterError, lines 31-38)
  // AbortController threading + 25s default timeout
}
```
Map `RequesterError.code` directly onto §20.10 retryability (RATE_LIMITED/TIMEOUT/NETWORK are all in the locked table). **Each provider sets its JSON-mode flag natively** (Appendix L rule — discretion per-provider: OpenAI `response_format:{type:'json_object'}`, Gemini `responseMimeType:'application/json'`, Ollama `format:'json'`, Anthropic tool-use/forced output — A6).

---

### `src/core/ai/StreamAdapter.ts` (service/adapter, streaming)

**Analog:** `src/services/aiProvider.ts:405-446` — the SSE parser to REBUILD (negative analog: it reads only private-proxy `data.textChunk`/`data.thoughtChunk` and returns empty on real providers — the confirmed production bug).

**The buggy parser being replaced** (`src/services/aiProvider.ts:414-446`):
```typescript
let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const dataStr = line.slice(6).trim();
      if (dataStr === '[DONE]') { onDone(...); return; }
      const data = JSON.parse(dataStr);
      if (data.thoughtChunk) { ... }   // ← proxy-only field, IGNORES real wire formats
      if (data.textChunk) { ... }      // ← proxy-only field
    }
  }
}
```
**Rebuild target (D-47):** incremental `TextDecoder({stream:true})` line buffer + per-provider adapters (RESEARCH Pitfall 1 / Don't Hand-Roll). Keep the `TextDecoder({stream:true})` + CRLF + multi-byte-boundary discipline. **Missing terminator = error** (REQ-R09). Per-provider wire bytes for conformance fixtures (RESEARCH lines 437-452):
- **OpenAI:** `data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}` + `data: [DONE]`
- **Anthropic:** `event: content_block_delta` / `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}`; flow `message_start → content_block_start → content_block_delta* → ... → message_stop`; `ping` dispersed; `error` events possible
- **Gemini:** `data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}`
- **Ollama:** NDJSON (via OpenAI-compat `/v1/chat/completions` primarily, A4)

**Correlation:** reuse Phase-1 `OperationId` (`createEnvelope` → `crypto.randomUUID()`, `RuntimeEnvelope.ts:63` / `src/core/runtime/OperationId.ts`), Flag C — no new id scheme.

---

### `src/core/ai/ChunkBuffer.ts` (utility, streaming)

**No codebase analog** — implement **Appendix J verbatim** (RESEARCH line 422-426): `createChunkBuffer` with `enqueue/onFlush/flushNow/reset`, rAF batching with 8 kB/s → 33 ms upgrade rule. This buffers `STREAM_DELTA` events for React rendering (D-47). Use RESEARCH Appendix J reference; nothing to copy from existing code.

---

### `src/core/ai/ProviderRouter.ts` (service, request-response)

**Analog:** `src/core/http/Requester.ts` (canonical error codes) + `src/services/aiProvider.ts` fallback semantics. Pure decision module (§1.5/§20.10).

**Router attempt state** (RESEARCH lines 387-396 — verbatim spec):
```typescript
interface RouterAttemptState {
  operationId: string;
  attempts: ProviderAttempt[];
  hasStreamedFirstToken: boolean;
  circuitBreakerOpen: Record<ProviderId, number>; // reopen after cool-down ms
}
```

**Locked retry/fallback table** (RESEARCH lines 291-301, verbatim — map `RequesterError` codes onto it):
```text
TIMEOUT:        Retryable pre-first-token YES · CB vote 1
PROVIDER_5XX:   Retryable YES · CB vote 1
NETWORK:        Retryable YES · CB vote 1
RATE_LIMITED:   Retryable YES (jitter) · CB vote 0
AUTH:           Retryable NO · CB vote 3 (open immediately)
MODEL_UNKNOWN:  Retryable NO · CB vote 0
SCHEMA_INVALID: Retryable NO · CB vote 0
HOST_NOT_PERMITTED: Retryable NO · CB vote 0
// 3 votes within 60s → open 5 min
```
Rules (§1.5): retry once only for retryable pre-first-token; **never switch after `hasStreamedFirstToken === true`**; never silently switch local→cloud when `allowCloudFallbackFromLocal=false`. Phase 3 records attempts via `debugLog` only (AITransactionLog is Phase 11).

---

### `src/core/ai/TierResolver.ts` (utility, transform)

**Partial analog:** `src/services/aiProvider.ts` model-discovery semantics (lines 38-149) — the live model list `TierResolver` matches against (D-52). **D-53 overrides Appendix D's placeholder slugs** — ships capability tiers (`fast`/`balanced`) only, concrete slugs from `UserPreferences.fastModel`/`balancedModel` + live-discovered models. **Never invents a model name** (Appendix D rule).

**D-54/D-54a null contract:** returns `null` for an unresolved tier until BOTH `fastModel` and `balancedModel` are persisted. Caller (AgentOrchestrator) surfaces configuration-required state and starts NO provider request. Options pre-fill suggestions are UI-only, never auto-persisted.

---

### `src/core/ai/PromptCacheManager.ts` (service, transform)

**Analog (partial):** `src/core/prompts/index.ts` (the stub it assembles prompts around) + `src/core/theme/chromeStorageAdapter.ts` (hashing discipline). **This is the single choke-point for PersonaInjector (D-59).**

**Core responsibility** (RESEARCH Pattern 2, lines 241-270): `buildSystemPrompt` is the ONLY place `PersonaInjector.inject` is called. Persona block prepended FIRST inside the cached `[SYSTEM]` section, byte-stable per persona. §1.3 canonical section order: `[SYSTEM: cached, canonical]` → `[TOOL SCHEMAS]` → `[USER PREFERENCES: compact]` → `[TASK]` → `[USER INPUT]`.

**Prompt-cache invalidation** (Open Q5 / Pitfall 3): key the cached system prompt on a profile-version hash = `hashStableSections([personaBlock])` (from PromptCacheAdapter) — when `resolvePersona` output changes, the hash changes, next build emits a new byte-stable block. No explicit invalidation API.

**Discretion:** stable/unstable section tagging + 5-consecutive-miss → 60 s disable rule (§30 line 3060).

---

### `src/core/ai/PromptCacheAdapter.ts` (utility, transform)

**No codebase analog** — implement **Appendix K verbatim** (RESEARCH lines 428-435). `applyCacheHints(providerId, sections)` + `hashStableSections` (FNV-1a 32-bit over joined stable texts). Per-provider hints:
- **anthropic:** `cache_control {type:'ephemeral'}` on ≤4 stable sections (`ANTHROPIC_MAX_BREAKPOINTS` — 5th → 400, Pitfall 5)
- **gemini:** `cachedContent` split only when `stableTokens >= GEMINI_MIN_CACHED_TOKENS (32_768)`, else `prefix-only` (Pitfall 4)
- **openai/ollama/default:** stableFirst sort, prefix-only

Consumes the `PromptSection` shape declared in `src/core/ai/types.ts` (A8).

---

### `src/core/ai/StructuredOutput.ts` (utility/service, transform)

**No codebase analog** — implement **Appendix L verbatim** (RESEARCH Pattern 3, lines 272-286). `requestJson(schema, prompt, ctx)`: `zodToJsonSchema(schema)` → call provider in JSON mode → `safeParse` → **exactly one repair** using `PROMPTS.repairJson.system` → second failure throws terminal `STRUCTURED_OUTPUT_FAILED` (`retryable: false`).

**Pinned dependency:** `zod-to-json-schema@3.25.2` (Appendix L implementer note — do NOT substitute Zod 4 `z.toJSONSchema()`, deferred v0.2). `PROMPTS.repairJson.system` comes from the canonical Appendix A added to `src/core/prompts/index.ts` (the current stub's `repairJson` differs — must be replaced).

---

### `src/core/ai/toolSchemas.ts` (registry/types, N/A)

**Analog:** `src/core/registry/Registry.ts` (declare-now/populate-later pattern) + `src/types/storage.ts` (closed literal-union declaration).

**Declare-now/populate-later (D-46):** declares `ToolDefinition` shape, `ToolCapabilityManifest`, and the closed-enum generation contract — but registers **ZERO tools** in Phase 3 (real tools arrive with owning phases). Mirrors how `src/types/storage.ts:46-57` declares the full `WriteJournalOperation` union but Phase 2 only implements `update-workspace` (`WriteJournal.ts:61-67`).

**ExecutorService closed enum:** `ExecutorService` supplies a closed `z.enum` from registered tools at request time (RESEARCH lines 374-377); rejects unknown `toolName` with `TOOL_REJECTED` (§1.2, §21.6 — closed error-code set, no invented codes D-38).

---

### `src/core/ai/PlannerService.ts` (service, request-response)

**Partial analog:** the zod discriminated-union + Appendix L repair pattern. **§1.2 verbatim** (RESEARCH lines 372-385): returns a `PlannerDecision` (`answer | run_tool | ask_clarification`). Uses `fast` tier (D-55), 3 s timeout (§1.2). Appendix L `StructuredOutput.requestJson` for the JSON decision parse. **Appendix I rule: no component/hook may call PlannerService directly** — only AgentOrchestrator.

---

### `src/core/ai/ExecutorService.ts` (service, request-response)

**Role-match analog:** `src/core/registry/Registry.ts` (closed-set contract). §1.2 verbatim: validates `run_tool` input against the closed `z.enum`; unknown `toolName` → `TOOL_REJECTED` (D-46, §21.6). Since Phase 3 registers zero tools, every direct/test-injected `run_tool` is rejected. Returns `ToolExecutionResult` (declared in `types.ts`).

---

### `src/core/ai/RendererService.ts` (service, streaming)

**Role-match analog:** `src/services/aiProvider.ts` streaming + `src/components/chat/useChatStreaming.ts` (the consumer it feeds). §1.2/§1.3: renders the final answer stream; uses `fast` tier (D-55); **512-token cap default** (§1.3 note — Open Q4: per-stage `maxOutputTokens` in the prompt-config entry with an override param on `render`; keep it data, not hard-coded in the loop). "No invented facts."

---

### `src/core/ai/AgentOrchestrator.ts` (service/orchestrator, event-driven)

**Role-match analog:** `src/core/storage/WriteJournal.ts` `runJournaled` (lines 118-160) — the existing crash-safe orchestration primitive (pending→applying→completed with rollback). The orchestrator is the sequencing loop owner.

**Appendix I verbatim** (RESEARCH lines 398-420 — the ONLY module enforcing §1.4 tier caps):
```typescript
export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
  const toolResults: ToolExecutionResult<unknown>[] = [];
  let plannerCalls = 0;
  let toolCalls = 0;
  while (true) {
    if (input.abortSignal.aborted) throw new DOMException('aborted', 'AbortError');
    if (plannerCalls >= input.tier.plannerCap) return await finish('planner_cap_reached');
    plannerCalls++;
    const decision = await PlannerService.plan({ ... });
    if (decision.action === 'answer' || decision.action === 'ask_clarification') {
      return await finish(decision.action === 'answer' ? decision.reasonCode : 'ask_clarification');
    }
    if (toolCalls >= input.tier.toolCap) return await finish('tool_cap_reached');
    toolCalls++;
    const result = await ExecutorService.execute({ ... });
    toolResults.push(result);
  }
  async function finish(reasonCode: string): Promise<AgentTurnOutput> {
    /* RendererService.render → { streamedText, toolResults, reasonCode } */
  }
}
```
**D-54a:** if TierResolver returns null, surface configuration-required state and start NO provider request. **D-45:** persist completed user/assistant pair to ChatHistoryDB via WriteJournal at turn end; abort → drop partial (ChunkBuffer + memory only mid-stream — kills P2 write-rate).

---

### `src/core/ai/persona/PersonaProfile.ts` (model, N/A)

**Role-match analog:** `src/types/storage.ts` (zod schema + constant pattern). **Appendix N.1 verbatim** (RESEARCH lines 455-474, "do not paraphrase") — `PersonaProfileSchema` + `DEFAULT_PERSONA`:
```typescript
export const DEFAULT_PERSONA: PersonaProfile = {
  id: 'nowpilot-default',
  identity: {
    name: 'NowPilot',
    tagline: 'Your ServiceNow support co-pilot',
    domain: 'ServiceNow support engineering, technical troubleshooting, and knowledge management',
  },
  personalityCore: ['privacy-first', 'helpful', 'precise', 'humble'],
  behavioralDrivers: ['prefers asking clarifying questions over guessing', 'cites sources when available'],
  languageStyle: {
    tone: 'professional-warm',
    vocabulary: 'technical but accessible to support engineers',
    brevity: 'brief',
  },
  emotionalRepertoire: ['empathy', 'encouragement', 'curiosity'],
};
```
**Note:** RESEARCH warns D-57's CONTEXT summary paraphrases tagline/behavioralDrivers — **the spec Appendix N.1 block is authoritative**. Phase 3 does NOT persist the profile (`np_persona` is Phase 8, RICH-R-05) — seeded constant only.

---

### `src/core/ai/persona/PersonaInjector.ts` (utility, transform)

**No codebase analog** — implement **Appendix N.2 verbatim** (RESEARCH Pattern 2, lines 246-269). `resolvePersona` data-merge + `buildPersonaBlock` (byte-stable) + `PersonaInjector.inject` (persona-first prepend):
```typescript
export function resolvePersona(base: PersonaProfile, prefs?: UserPreferences): PersonaProfile {
  if (!prefs?.personaOverrides) return base;
  const o = prefs.personaOverrides;
  return {
    ...base,
    identity: { ...base.identity, name: o.name ?? base.identity.name },
    languageStyle: {
      ...base.languageStyle,
      tone: o.tone ?? base.languageStyle.tone,
      brevity: o.brevity ?? base.languageStyle.brevity,
    },
  };
}
export const PersonaInjector = {
  inject(stage: PipelineStage, baseSystem: string, opts?: { persona?: PersonaProfile; prefs?: UserPreferences }): string {
    const persona = resolvePersona(opts?.persona ?? DEFAULT_PERSONA, opts?.prefs);
    const block = buildPersonaBlock(persona);       // byte-stable per persona (§1.3)
    return `${block}\n\n${baseSystem}`;             // persona first (cacheable), then canonical stage string (Appendix A)
  },
};
```
**Import-target change:** Appendix N.2 imports `UserPreferences` from `@/core/memory/types` which does NOT exist — Phase 3 supplies the minimal `UserPreferences` shape in `src/core/ai/types.ts` (Open Q2) + `np_preferences` persistence. Mark it as the Phase-8/10 supersession point.

---

## Out-of-Inventory Modifications

### `src/core/runtime/workerState.ts` — ADD `ActiveStreamState` (state, event-driven)

**Analog:** `src/core/workspace/WorkspaceElection.ts` (discriminated-union state machine) + the existing `workerState.ts` (add to it). **Confirmed by research:** `ActiveStreamState` does NOT exist anywhere in `src/` today (grep zero hits) — Phase 3 MUST add it.

**§20.6 verbatim** (RESEARCH Pattern 1, lines 230-238):
```typescript
export type ActiveStreamState =
  | { state: 'idle' }
  | { state: 'preparing'; sessionId: string; operationId: string; surface: ActiveSurface }
  | { state: 'streaming'; sessionId: string; operationId: string; startedAt: number; surface: ActiveSurface }
  | { state: 'waiting-for-permission'; sessionId: string; operationId: string; toolName: string; surface: ActiveSurface }
  | { state: 'aborting'; sessionId: string; operationId: string; surface: ActiveSurface }
  | { state: 'completed'; sessionId: string; operationId: string; surface: ActiveSurface }
  | { state: 'failed'; sessionId: string; operationId: string; code: string; message: string; surface: ActiveSurface };
```
**`ActiveSurface` is imported from `src/core/workspace/WorkspaceStore.ts:11`** (`export type ActiveSurface = 'sidepanel' | 'standalone'`) — verify A7: it IS exported. The existing `workerState.ts` pattern (lines 1-5) shows the discriminated-union + getter/setter/transition pattern to mirror. Canonical events map: STREAM_START → `preparing`/`streaming`, STREAM_DELTA → accumulated (via ChunkBuffer), STREAM_COMPLETE → `completed`, STREAM_ERROR → `failed` + canonical code, STREAM_ABORTED → `aborting`. Reuse Phase-1 `OperationId` (Flag C).

---

### `src/core/prompts/index.ts` — ADD Appendix A prompts verbatim (config, N/A)

**Analog:** the existing 4-line stub (replace/expand). Current stub (`src/core/prompts/index.ts:1-4`) has `titleGen` + a **non-canonical** `repairJson`:
```typescript
export const PROMPTS = {
  titleGen: 'Generate a short title (max 6 words) ...',
  repairJson: 'The previous JSON output was malformed. Return ONLY valid JSON. Do not explain or apologize.',  // ← DIFFERS from Appendix A canonical
} as const;
```
**Research gap confirmed:** Appendix A canonical prompts (planner/renderer/memoryExtractor/conversationSummarizer/repairJson) must be added verbatim; `repairJson.system` must be REPLACED with the canonical text. Persona is NOT in the stage constants (persona-free + byte-stable, §1.3 / Appendix A spec 4153 note) — `PersonaInjector` prepends it. Stage `tier` fields (planner `fast`, renderer `balanced`) feed D-55 stage-tier mapping.

---

### `src/components/chat/useChatStreaming.ts` — re-point at AgentOrchestrator (hook, streaming)

**Analog:** itself (D-44 modify in place — do NOT create a second hook; Open Q3). Currently calls `streamChatResponse` directly at **line 75**:
```typescript
await streamChatResponse({
  messages: currentHistory,
  prompt: textToSend,
  ...
  onChunk: (textChunk, thoughtChunk) => { updateLastAssistantMessage(textChunk, thoughtChunk, false); },
  onDone: () => { updateLastAssistantMessage('', '', true); setIsGenerating(false); },
  ...
});
```
**D-44:** route `handleSend` through `AgentOrchestrator.runAgentTurn` instead. **D-47:** the `onChunk`/`onDone` callback surface is retired — consume the canonical stream events + ChunkBuffer instead. **D-45:** mid-stream chunks live in memory + ChunkBuffer (NO `updateLastAssistantMessage` per chunk — kills P2 write-rate); persist pair at turn end via WriteJournal → ChatHistoryDB; abort → drop partial. Keep `abortControllerRef` threading (lines 66, 96-103) — the AbortSignal flows into `runAgentTurn` (Appendix I aborts on it).

---

### `src/types/storage.ts` — add `'append-chat-turn'` to `WriteJournalOperation` (types, N/A)

**Analog:** itself (additive literal-union extension). Research Open Q1 recommends **Option (a)** — additively extend the 11-member union with `'append-chat-turn'` (lines 46-57) + the zod schema (lines 89-101) + register a `JournalStep` at boot (mirroring `update-workspace` wiring, `WriteJournal.ts:212-252`). Backward-compatible literal-union extension, honors D-45's letter. `ChatHistoryDB` v1 schema (lines 24-53) already fits the turn-end pair write (role `'user'|'assistant'|'system'`, metadata `Record<string, unknown>`) — **no ChatHistoryDB schema change needed**, so D-45a's stop-condition does NOT trigger.

---

### `src/components/options/OptionsPage.tsx` — D-50 endpoint-override + D-54 tier-assignment fields (component, request-response)

**Analog:** itself. **D-50:** General proxy fields write `np_endpoint_overrides` (new chrome.storage.local key merged over §10.6 ENDPOINTS defaults; `localhost:12380` never a canonical default). **D-54:** tier assignment manual, write-through to `UserPreferences.fastModel`/`balancedModel`; **first-setup pre-fill** with first-discovered model per class — **UI-only, never auto-persisted until confirmed** (D-54a). Uses `fetchProviderModels` live-discovery semantics (D-52, `src/services/aiProvider.ts:126-149`).

---

## Shared Patterns

### Zod cross-boundary validation (all new modules)
**Source:** `src/types/storage.ts:77-110` (schema + inferred type pair, CLAUDE.md cross-boundary convention)
**Apply to:** types.ts, PersonaProfile, toolSchemas, PlannerDecision, canonical stream events, UserPreferences. Every shape validated with zod ^4 (`zod: ^4.4.3` pinned). PlannerDecision + canonical events use `z.discriminatedUnion`.

### Store persistence via Zustand + immer + chromeStorageAdapter (UserPreferences store)
**Source:** `src/core/workspace/WorkspaceStore.ts:89-199` (create + persist + immer + chromeStorageAdapter + partialize + version/migrate) and `src/core/theme/chromeStorageAdapter.ts:210-255`
**Apply to:** the minimal `np_preferences` store (Open Q2). Example pattern:
```typescript
export const useUserPreferencesStore = create<...>()(
  persist(
    immer((set) => ({ ... })),
    { name: 'np_preferences', storage: createJSONStorage(() => chromeStorageAdapter), partialize: ... }
  )
);
```
Non-secrets → `chrome.storage.local`; secrets (`apiKey`) → encrypted `np_providers` (Phase 2 EncryptedStorage, never in a plain store).

### Logging — never raw console.log; use debugLog (all pipeline stages)
**Source:** `src/core/log/debugLog.ts:11-27` (`debugLog(code, message, context?)`)
**Apply to:** every stage (Planner/Executor/Renderer/AgentOrchestrator/ProviderRouter) + WriteJournal ops. Phase 3 records provider attempts via `debugLog` only (AITransactionLog is Phase 11). Redaction discipline: never log URLs with keys, never interpolate apiKey into error strings (T-01-10, `src/services/aiProvider.ts:96-115`). **`console.error` at `aiProvider.ts:453` is the anti-pattern to avoid.**

### Canonical error codes — closed §21.6 set (ProviderRouter, StructuredOutput, Executor)
**Source:** `src/core/http/Requester.ts:31-38` (`RequesterError` with canonical `code`) + §21.6 closed set
**Apply to:** ProviderRouter (retry/fallback table), StructuredOutput (`STRUCTURED_OUTPUT_FAILED`), Executor (`TOOL_REJECTED`). No invented codes (D-38).

### Fetch via Requester, never raw fetch (providers, StreamAdapter)
**Source:** `src/core/http/Requester.ts:52-98` — AbortController + timeout + rate-limiter + canonical codes
**Apply to:** all 5 provider adapters + StreamAdapter. Do NOT use raw `fetch` (the `aiProvider.ts` `buildEndpointUrl`/raw-fetch is legacy).

### Declare-now/populate-later registry (ProviderRegistry, toolSchemas, WriteJournal)
**Source:** `src/core/registry/Registry.ts:7-23` (register/get/getAll/get) + `src/core/storage/WriteJournal.ts:69-99` (declare full set, implement a subset)
**Apply to:** ProviderRegistry (D-51 declarative registration), toolSchemas (D-46 zero tools), `append-chat-turn` journal op.

### TypeScript strict-clean — NP_STRICT ceiling 0
**Source:** package.json `NP_STRICT_CEILING: 0` + STATE.md decision 17/18
**Apply to:** ALL new Phase-3 code. No new `@ts-expect-error NP-STRICT` markers. Strict mode ON (`strict: true`). Path alias `@/*` → project root.

### MV3 boundary — streams live in UI contexts only
**Source:** CLAUDE.md §5.2 / spec §0.2
**Apply to:** ProviderRegistry/AgentOrchestrator instantiate per-surface (side panel / standalone); never in background SW. `Requester` is UI-context (`src/core/http/Requester.ts:8-11` gating note).

### Turn-end journaled persist (AgentOrchestrator → ChatHistoryDB)
**Source:** `src/core/storage/WriteJournal.ts:118-160` (`runJournaled`) + `src/core/storage/ChatHistoryDB.ts` schema
**Apply to:** AgentOrchestrator completion handler (D-45). Mid-stream: memory + ChunkBuffer only (P2). Abort → drop partial.

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md / spec-Appendix reference implementations):

| File | Role | Data Flow | Reason / Source |
|------|------|-----------|-----------------|
| `src/core/ai/StructuredOutput.ts` | utility/service | transform | Appendix L verbatim (zod-to-json-schema + one-shot repair) — nothing like it exists; RESEARCH Pattern 3 lines 272-286 |
| `src/core/ai/PromptCacheAdapter.ts` | utility | transform | Appendix K verbatim (per-provider cache hints + FNV hash); RESEARCH lines 428-435 |
| `src/core/ai/ChunkBuffer.ts` | utility | streaming | Appendix J verbatim (rAF batching + 8 kB/s → 33 ms rule); RESEARCH lines 422-426 |
| `src/core/ai/persona/PersonaInjector.ts` | utility | transform | Appendix N.2 verbatim; RESEARCH Pattern 2 lines 246-269 |
| `src/core/ai/TierResolver.ts` | utility | transform | Appendix D mechanism verbatim but D-53 overrides slug approach → capability-tiers-only; matches live-discovered models (RESEARCH lines 355-359) |
| `src/core/ai/PromptCacheManager.ts` | service | transform | §1.3 + D-59 (persona choke-point); partially analog to `src/core/prompts/index.ts` stub + `chromeStorageAdapter` hashing |

These six have the **lowest codebase coverage** — the planner must lean on the spec appendices (A/D/I/J/K/L/N) as authoritative reference implementations and the RESEARCH.md code examples.

## Metadata

**Analog search scope:** `src/core/`, `src/services/`, `src/components/chat/`, `src/types/`, `src/store/`, `tests/core/`
**Files scanned:** 17 analog sources read (aiProvider, Requester, WorkspaceStore, WorkspaceElection, RuntimeEnvelope, OperationId, workerState, useChatStreaming, debugLog, Registry, WriteJournal, ChatHistoryDB, storage.ts, index.ts (types), index.ts (prompts), chromeStorageAdapter, testProviderConnection.test.ts, OperationId.test.ts)
**Pattern extraction date:** 2026-08-26
