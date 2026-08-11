# Phase 3a: Agent Reliability and Evidence — Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 20 (9 source + 4 test-migration + 2 test-create + 2 fixture + 3 config/doc)
**Analogs found:** 17 / 20 — every MODIFY target IS its own analog (current implementation is the pattern to preserve/rewire); 3 files are spec-authoritative new modules with no in-repo analog (OutcomeVerifier, CheckpointRecorder, new test suites) — the spec Appendix O.2 / C.1 is the source pattern, plus style analogs from ExecutorService.ts/ProviderRouter.ts.

**Core principle:** this phase is a **rewire of the Phase-3 `runAgentTurn` contract** (`AgentTurnOutput` → `AgentTurnOutcome`, D-20 fence inversion) plus new reliability machinery. Every MODIFY task must preserve the file's existing contract (typed error carriers, `debugLog` Golden Rule 9, F-4 sections-in, `maxRetries: 0`, abort-name-match) and only change the *defective mechanism* (the D-20 fence, the reasonCode→status semantics, the missing `tool_result` kind, the binary hook mapping). Every NEW module is spec-verbatim (O.2 / C.1 / §1.6.1 L3) — copy, do not re-derive.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/types/harness.ts` (EXTEND) | types (R-1 canonical home) | n/a (declarations) | itself (13-line current file, header declares 3a extension) + spec C.1 verbatim | exact (self) |
| `src/core/ai/OutcomeVerifier.ts` (NEW) | service (deterministic verifier) | request-response (pure postcondition check) | spec Appendix O.2 verbatim; style analog `ExecutorService.ts` (deterministic boundary, no model calls) | spec-authoritative |
| `src/core/ai/CheckpointRecorder.ts` (NEW) | utility (opId-keyed loop-state store) | event-driven (capture/restore around tool execution) | `ProviderRouter.ts` `operations` Map lazy-init (L361, L769-786) + `WriteJournal.ts` rollback machinery (L28-33, L62-79) | partial (structural) |
| `src/core/ai/AgentOrchestrator.ts` (REWIRE) | controller (Appendix-I bounded loop) | request-response + streaming side-channel | itself (211-line current loop; TIER_CAPS; planOnce error path; finish()) | exact (self) |
| `src/core/ai/types.ts` (EXTEND) | types (`PromptSection['kind']` += `'tool_result'`) | n/a | itself (kind union L130-136; `ProviderConfigSchema` co-location L89-103) | exact (self) |
| `src/core/error/errorCodes.ts` (EXTEND) | config (canonical registry) | n/a | itself (Phase-3 block pattern L63-80) + spec C.2 harness block L5051-5053 | exact (self) |
| `src/core/ai/ProviderRouter.ts` (TOUCH) | service (router: retry/breaker/F-4 mapping) | request-response | itself (`TASK_KINDS` L73 — add `'tool_result'`) | exact (self) |
| `src/core/ai/StructuredOutput.ts` (TOUCH) | service (Appendix L requestJson) | request-response | itself (`TASK_KINDS` L41 + repair-section append L117-133 — the exact `tool_result`-append pattern) | exact (self) |
| `src/core/ai/RendererService.ts` (TOUCH) | service (Seam-3 renderer) | streaming | itself (`RenderInput` L40-54 — extend with verdict + evidence) | exact (self) |
| `src/core/ai/PlannerService.ts` (TOUCH, conditional) | service (planner) | request-response | itself (`PlanInput` L69-83 — gains feedback sections only if the seam lands there) | exact (self) |
| `src/core/ai/contextHelper.ts` (TOUCH, conditional) | utility (F-4 sections builder) | transform | itself (section-build pattern L60-85 — `tool_result` section builder source) | exact (self) |
| `src/components/pages/useStreamingLLM.ts` (UPDATE) | hook (D-01 co-located) | streaming | itself (`result.reasonCode` mapping L152-192 → `outcome.status` mapping, D-3a-19) | exact (self) |
| `tests/core/ai/AgentOrchestrator.test.ts` (MIGRATE) | test | — | itself (D-20 fence L358-362 to INVERT; shape assertions L127-132/245-250 to flip) | exact (self) |
| `tests/core/ai/AgentOrchestrator.budget.test.ts` (MIGRATE) | test | — | itself (reasonCode assertions L139-145/168-173/207-210 → status semantics) | exact (self) |
| `tests/core/ai/OutcomeVerifier.test.ts` (NEW) | test | — | `tests/fixtures/fixtures.test.ts` determinism + `tests/core/ai/ExecutorService.test.ts` pure-unit shape | partial (compose) |
| `tests/core/ai/trajectory/**` (NEW) | test | — | `tests/core/ai/AgentOrchestrator.test.ts` (vi.mock stage services + baseInput helper) | partial (compose) |
| `tests/fixtures/` (EXTEND) | test fixture | — | `tests/fixtures/optimizedContext.ts` builder + `tests/fixtures/index.ts` determinism header | exact (pattern) |
| `package.json` (MODIFY) | config (verify script) | — | `verify:phase-3` script (L21) — same §24 chain + isolation check | exact (self) |
| `.planning/REQUIREMENTS.md` (UPDATE) | doc | — | AI-07 re-map precedent row (D-3a-01) | exact (precedent) |
| `.planning/ROADMAP.md` (UPDATE) | doc | — | itself Phase 3a block (L175-189) — criterion #5 reduction | exact (self) |

---

## Pattern Assignments

### `src/types/harness.ts` (types, EXTEND) — AgentTrajectoryState / AgentTurnOutcome / extended CompletionEvidence

**Analog:** itself (13-line current file) + spec Appendix C.1 verbatim.

**Current file (entirety, lines 1-13) — the R-1 home; header ALREADY declares 3a as the extension point:**
```typescript
// src/types/harness.ts — Source: §C.1 canonical home rule (R-1, Golden Rule 2)
// Phase 1 ships the MINIMAL subset: CompletionEvidence only, the shape referenced
// by Appendix C ToolExecutionResult (evidence is set for side-effecting tools, §28.2).
// NOTE: this file will extend with the full §28.2 harness-track types (AgentTrajectoryState,
// AgentTurnOutcome, ContextItem, WorkingMemory, ...) in Phase 3a — do not relocate.
export interface CompletionEvidence {
  toolName: string;
  operationId: string;
  postconditionId: string; // verifier that produced this evidence (TOL-03)
  ok: boolean;
  verifiedAt: number;
  detail?: string;
}
```

**Spec C.1 verbatim (PRODUCT_SPEC_v0_1.md L4809-4837) — copy, do not re-derive (D-3a-20):**
```typescript
export type AgentTrajectoryPhase =
  | 'assembling-context' | 'planning' | 'waiting-for-permission'
  | 'executing' | 'verifying' | 'replanning' | 'rendering'
  | 'completed' | 'failed' | 'aborted';

export interface AgentTrajectoryState {
  operationId: string;
  phase: AgentTrajectoryPhase;
  plannerCalls: number;
  toolCalls: number;
  updatedAt: number;
}
// CompletionEvidence stays as-is (already the C.1 shape — no change needed)
export interface AgentTurnOutcome {
  operationId: string;
  status: 'completed' | 'partial' | 'failed' | 'aborted';
  reasonCode: string;        // cap exhaustion => 'partial', never 'completed'
  evidence: CompletionEvidence[];
  plannerCalls: number;
  toolCalls: number;
}
```

**Consumer import pattern (R-1: import, never re-declare)** — `src/core/ai/types.ts` L123 already does this:
```typescript
evidence?: import('@/types/harness').CompletionEvidence; // set for side-effecting tools (§28.2)
```

**Zod boundary-schema co-location precedent** — `src/core/ai/types.ts` L89-103 (`ProviderConfigSchema` co-located with its interface). The planner picks the open question (Q2) location: co-locate `AgentTrajectoryStateSchema`/`AgentTurnOutcomeSchema`/`CompletionEvidenceSchema` either inline in harness.ts or a sibling `harnessSchemas.ts` — mirror this exact pattern, zod 3 API only (`z.discriminatedUnion`, `.safeParse` — never zod-4 APIs, RESEARCH A5):
```typescript
export const ProviderConfigSchema = z.object({ id: z.enum(['openai', 'anthropic', 'gemini', 'ollama']), ... });
export type ProviderConfigInput = z.infer<typeof ProviderConfigSchema>;
```

**Planner notes:** `AgentTurnOutcome.status` union has NO `verification_failed` member (RESEARCH Open Q1) — recommended mapping: `verification_failed → status 'failed'`, `reasonCode 'verification_failed'`; `waiting_for_permission` is a trajectory phase, never a terminal outcome status.

---

### `src/core/ai/OutcomeVerifier.ts` (service, NEW) — Verifier interface + buildOutcome

**Analog:** spec Appendix O.2 verbatim (PRODUCT_SPEC_v0_1.md L6362-6393) — THE worked reference implementation; **copy verbatim, do not re-derive** (D-3a-03/05/06/07). Style analog for imports/header: `ExecutorService.ts` (deterministic boundary, no model calls, R-10-safe logging).

**The core (O.2 verbatim, spec L6363-6392):**
```typescript
// src/core/ai/OutcomeVerifier.ts
import type { CompletionEvidence, AgentTurnOutcome } from '@/types/harness';
import type { ToolExecutionResult } from './types';

export interface Verifier {
  postconditionId: string;
  verify(result: ToolExecutionResult<unknown>): Promise<{ ok: boolean; detail?: string }>;
}

export async function buildOutcome(
  operationId: string,
  results: ToolExecutionResult<unknown>[],
  verifiers: Record<string, Verifier>,   // keyed by toolName
  caps: { plannerCalls: number; toolCalls: number; capHit: boolean },
): Promise<AgentTurnOutcome> {
  const evidence: CompletionEvidence[] = [];
  for (const r of results) {
    const v = verifiers[r.toolName];
    if (!v) continue;                     // read-only tool: no postcondition required
    const outcome = await v.verify(r);
    evidence.push({ toolName: r.toolName, operationId, postconditionId: v.postconditionId,
      ok: outcome.ok, verifiedAt: Date.now(), detail: outcome.detail });
  }
  const sideEffectFailed = evidence.some(e => !e.ok);
  const status: AgentTurnOutcome['status'] =
    caps.capHit ? 'partial' : sideEffectFailed ? 'failed' : 'completed'; // AGT-03: cap = partial
  return { operationId, status,
    reasonCode: caps.capHit ? 'cap_exhausted' : sideEffectFailed ? 'postcondition_failed' : 'ok',
    evidence, plannerCalls: caps.plannerCalls, toolCalls: caps.toolCalls };
}
```

**Header comment style to copy** — `ExecutorService.ts` L1-12 (spec-source attribution + D-3a-03 determinism statement: "zero model calls, no PipelineStage, no tier cap, no persona injection"; healthy turn stays 2 model calls).

**Determinism note (RESEARCH Pitfall 6):** O.2 uses `Date.now()` for `verifiedAt` — the plan must either inject a clock (default `() => Date.now()`), use `vi.setSystemTime` in tests, or assert evidence excluding timestamps. The fixtures determinism rule (fixtures/index.ts L1-7: never real `Date.now`) applies.

**Fail-closed (D-3a-06):** absent/malformed evidence for a side-effecting tool ⇒ the orchestrator maps to `verification_failed` — never a silent `completed`. Verifier throw propagates to the orchestrator catch (debugLog `TOOL_POSTCONDITION_FAILED`). **The verifier NEVER computes terminal status** — verdict only `{ok, detail}` (D-3a-05).

---

### `src/core/ai/CheckpointRecorder.ts` (utility, NEW) — opId-keyed loop-state capture/restore

**Analog:** `ProviderRouter.ts` `operations` Map lazy-init (L361 `private readonly operations = new Map<string, RouterAttemptState>()`; L769-786 `operationState()` lazy-init) + `WriteJournal.ts` rollback machinery (L28-33 `JournalStep.rollback`, L62-79 reverse-rollback loop). No in-repo opId-keyed recorder exists — compose the Map-keyed store pattern with the rollback semantics (loop-state rewind only, NO side-effect compensation — D-3a-09, Phase 8 TOL-05 owns compensation).

**Map-keyed store pattern (ProviderRouter.ts L769-786):**
```typescript
private operationState(operationId: string): RouterAttemptState {
  let state = this.operations.get(operationId);
  if (!state) {
    state = { operationId, attempts: [], retryCount: 0, hasStreamedFirstToken: false, circuitBreakerOpen: {} };
    this.operations.set(operationId, state);
  }
  ...
  return state;
}
```

**Rollback semantics (WriteJournal.ts L28-33 — the D-3a-09 "rollback machinery analog" from 02-CONTEXT):**
```typescript
export interface JournalStep {
  name: string;
  apply(): Promise<void>; // MUST be idempotent (safe to run twice on replay)
  rollback(): Promise<void>;
}
```

**D-3a-08/09 API shape (RESEARCH Pattern 3 — the planner's discretion on exact shape):**
```typescript
export class CheckpointRecorder {
  private readonly state = new Map<string, LoopState>();
  capture(operationId: string, state: LoopState): void { this.state.set(operationId, { ...state }); }
  restore(operationId: string): LoopState | undefined {
    const s = this.state.get(operationId);
    return s ? { ...s } : undefined;
  }
}
// LoopState = { toolResults: ToolExecutionResult<unknown>[], plannerCalls: number,
//               toolCalls: number, phase: AgentTrajectoryPhase }
// Orchestrator: capture BEFORE ExecutorService.execute; on retryable failure:
//   restore(opId) → discard failed result → append tool_result feedback → planOnce (plannerCalls++)
```

**Module conventions:** co-located in `src/core/ai/` (D-3a-08, Phase-3 one-file-per-responsibility pattern); `Map<string, LoopState>` keyed by operationId (in-memory per-turn — C4/§17.7.7, never persisted); debugLog on any error path with canonical codes.

---

### `src/core/ai/AgentOrchestrator.ts` (controller, REWIRE) — the Appendix-I loop rewired for 3a

**Analog:** itself — the 211-line current implementation IS the pattern to preserve; only the D-20-fenced parts change. **D-20 fence inversion** (03-PATTERNS/03-CONTEXT D-20; spec addendum L2657): the header comment L1-15 ("the reliability machinery ... belongs to Phase 3a and is NOT built here") is INVERTED by this phase (D-3a-18) — the file now OWNS the machinery.

**Keep verbatim (current file):**
- `TIER_CAPS` L47-52 + `capsForTier` L55-57 — the §1.4 replan budget (D-3a-13) + trajectory-cap source (D-3a-10: `plannerCap + toolCap + slack`, recommended slack 1, RESEARCH A3).
- Loop structure L107-155 (`plannerCalls`/`toolCalls` counters, cap checks at loop top L116/L126, abort check L115).
- `planOnce` error handling L175-202 — the planner-failure fallback pattern to KEEP (D-3a-11: planner failures keep `planner_failed`, NEVER replan):
```typescript
} catch (e) {
  if (isAbortError(e)) throw e;
  if (e instanceof Error && (e as { code?: string }).code === 'PROVIDER_UNAVAILABLE') throw e;
  debugLog(ERROR_CODES.PLANNER_FAILED, 'planner failed — deterministic fallback, no re-invocation', {
    module: 'AgentOrchestrator',
    error: e instanceof Error ? e : undefined,
    extra: { operationId: input.operationId },
  });
  return { action: 'answer', reasonCode: 'planner_failed' };
}
```
- `isAbortError` name-match L204-211 (the canonical shared pattern — abort wins mid-verify/replan, O4).
- `AgentTurnInput` L68-79 — **the pause seam (D-3a-15/16) extends this shape**, mirroring the existing input-only `onStreamDelta?` precedent:
```typescript
export interface AgentTurnInput {
  operationId: string;
  userInput: string;
  context: OptimizedContext;
  abortSignal: AbortSignal;
  tier: TurnCaps;
  onStreamDelta?: (delta: string) => void;           // existing Phase-3 seam
  invocation?: StageResolver;                        // existing Phase-3 seam
  onInputRequired?: (q: { roleId: string; question: string; options?: string[];
                          reason: 'clarification' | 'permission' }) => void;  // NEW 3a seam
}
```

**What changes (the rewire):**
- Return type `AgentTurnOutput` (L81-86) → `AgentTurnOutcome` (import from `@/types/harness`). `streamedText` leaves the struct (D-3a-18; text flows only via `onStreamDelta`).
- `finish()` (L137-154) → becomes the terminal decision point: trajectory → `rendering`, then `buildOutcome(operationId, toolResults, verifiers, caps)` (O.2 verbatim) with `caps.capHit = plannerCalls >= plannerCap || toolCalls >= toolCap`; map verdict+replan policy onto the 4-value status (D-3a-05 — orchestrator is SOLE terminal authority; renderer is display-only).
- Loop gains: trajectory transitions at each stage boundary (direct calls, no event bus — L1/§1.6.1: StageEvent is a TYPE only), the CheckpointRecorder capture/restore dance around `ExecutorService.execute` (L128-134), and the replan-on-retryable-tool-failure branch (D-3a-11/12/13 — `!result.ok && result.error?.retryable` → restore → append `tool_result` section → `planOnce` with `plannerCalls++` → re-run once; repeated-identical = same toolName + same error.code is terminal).

---

### `src/core/ai/types.ts` (types, EXTEND) — `PromptSection['kind']` gains `'tool_result'`

**Analog:** itself — the kind union L130-136 + the `ToolExecutionResult.evidence` import seam L123.

**The union to extend (RESEARCH Pitfall 2 — this is a REQUIRED type extension the current code lacks):**
```typescript
export interface PromptSection {
  kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input'; // ← add 'tool_result'
  text: string;
  tokens: number;
  stable: boolean;
  sourceId: string;
}
```

**Planner notes (RESEARCH Pitfall 2/7):** `'tool_result'` must be `stable: false` and must NOT enter `CACHED_KINDS` (never cache-eligible — byte-stable [SYSTEM] invariant, T-03-07-02); it SHOULD enter `TASK_KINDS` in BOTH mapping sites (ProviderRouter.ts L73 AND StructuredOutput.ts L41 — two copies exist, both must change or one silently drops the section). The section text comes from `ExecutorService`'s typed `error` object (code/message — sanitized), never raw model text (threat: prompt injection via tool output — RESEARCH Security Domain).

---

### `src/core/error/errorCodes.ts` (config, EXTEND IN PLACE) — harness block

**Analog:** itself — the Phase-3 block pattern L63-80 (comment + `CODE: 'CODE'` lines + scoped line-anchored verify). Spec C.2 harness block is ALREADY canonical (PRODUCT_SPEC L5051-5053) — mirror IN PLACE, GR-9.

**The Phase-3 block pattern to mirror (L63-80):**
```typescript
// --- AI runtime / provider / persona (Phase 3, canonical additions, 03-01 reconciliation) ---
// Canonical 13-code Phase-3 block (03-RESEARCH line 626). Every debugLog(code, …)
// in the Phase-3 AI layer uses one of these verbatim (Golden Rule 9). Canonical
// mirror: spec Appendix C.2 Phase-3 block — the scoped line-anchored verify (W-1)
// asserts each of these appears as a /^CODE$/m line inside the C.2 slice.
TOOL_REJECTED: 'TOOL_REJECTED',
...
// --- Agent harness (Phase 3a, canonical additions, 03a-CONTEXT D-3a-06) ---
AGENT_STATE_INVALID: 'AGENT_STATE_INVALID',            // trajectory illegal transition (C5)
TOOL_POSTCONDITION_FAILED: 'TOOL_POSTCONDITION_FAILED', // verifier throw / verdict !ok (fail-closed)
COMPLETION_EVIDENCE_MISSING: 'COMPLETION_EVIDENCE_MISSING', // side-effecting tool ran with no evidence
```

---

### `src/core/ai/ProviderRouter.ts` (service, TOUCH) — `TASK_KINDS` gains `'tool_result'`

**Analog:** itself. The F-4 kind-mapping block L60-88 — the `tool_result` section must reach the provider `prompt` side:
```typescript
/** Task kinds → provider `prompt` ([CONTEXT]+[TASK]+[USER INPUT]). */
export const TASK_KINDS: ReadonlyArray<PromptSection['kind']> = ['context', 'task', 'user_input']; // ← add 'tool_result'
```
`CACHED_KINDS` (L65-70) stays UNCHANGED — `tool_result` is per-turn, `stable: false`, never cache-eligible (RESEARCH Pitfall 2 recommendation: add to `TASK_KINDS` here AND in StructuredOutput.ts L41 so it reaches the model as `prompt` content while staying out of `hashStableSections`).

---

### `src/core/ai/StructuredOutput.ts` (service, TOUCH) — TASK_KINDS + the repair-section append is the `tool_result` pattern

**Analog:** itself. The one-repair section-append (L117-133) is the EXACT F-4 sections-in pattern the replan feedback must mirror (D-3a-11: append a `PromptSection`, NEVER rebuild a joined string — cache-stability, Pitfall 7):

**`TASK_KINDS` to extend (L41):**
```typescript
const TASK_KINDS: ReadonlyArray<PromptSection['kind']> = ['context', 'task', 'user_input']; // ← add 'tool_result'
```

**The append-a-section pattern to copy for `tool_result` (L122-133):**
```typescript
const repairText = `${PROMPTS.repairJson.system}
Schema: ${JSON.stringify(jsonSchema)}
Broken: ${first}`;
const cached = sections.filter((sec) => !TASK_KINDS.includes(sec.kind));
const repairSection: PromptSection = {
  kind: 'user_input',
  text: repairText,
  tokens: Math.ceil(repairText.length / 4),
  stable: false,
  sourceId: 'structured-output-repair',
};
const second = await attempt([...cached, repairSection]);
```

**Planner note:** the `tool_result` replan-feedback section follows this same shape (`kind: 'tool_result'`, `stable: false`, `tokens: estimateTokens(text)`, `sourceId` like `'tool-result-feedback'`) — appended to the EXISTING sections array, never replacing it. `estimateTokens` from contextHelper.ts L28-30 (`Math.ceil(text.length / 4)`) is the token estimator.

---

### `src/core/ai/RendererService.ts` (service, TOUCH) — evidence-aware guard (D-3a-17)

**Analog:** itself. `RenderInput` L40-54 gains the terminal verdict + verified evidence set; the renderer stays display-only and NEVER re-verifies (D-3a-05 — Pitfall 5: never narrate a side-effecting tool as "done" without a matching `ok:true` evidence entry):
```typescript
export interface RenderInput {
  operationId: string;
  context: OptimizedContext;
  userInput: string;
  toolResults: ToolExecutionResult<unknown>[];
  abortSignal: AbortSignal;
  invocation: StageInvocation;
  onDelta?: (delta: string) => void;
  // NEW 3a (D-3a-17): terminal verdict + verified evidence — display-only guard, never re-verify
  verdict?: AgentTurnOutcome['status'];
  evidence?: CompletionEvidence[];
}
```
Keep: `RENDERER_MAX_TOKENS` (L38), the `streamText` F-5 call shape (L100-107), streaming-honesty `finishReason` await (L123-124), `isAbortError` guard (L85-89), `StreamFailedError` carrier (L62-76). The guard is: tool results WITHOUT matching `ok:true` evidence render as failed/unverified, never "done".

---

### `src/components/pages/useStreamingLLM.ts` (hook, UPDATE) — honest status mapping (D-3a-19)

**Analog:** itself. The `result.reasonCode` binary mapping (L152-192) is the defective mechanism (RESEARCH Pitfall 3):

**Current mapping to replace (L152-192) — `result.reasonCode === 'provider_unconfigured'` branch + unconditional `completed`:**
```typescript
const result = await runAgentTurn({ operationId, userInput: trimmed, context,
  abortSignal: controller.signal, tier: capsForTier(context.tier),
  onStreamDelta: (delta) => bufferRef.current?.enqueue(delta), invocation });
if (operationIdRef.current !== operationId) return; // superseded by a new send
bufferRef.current?.flushNow();
if (result.reasonCode === 'provider_unconfigured') {
  setState({ state: 'failed', operationId });
  return;
}
setState({ state: 'completed', operationId });
```

**D-3a-19 mapping to install (RESEARCH Code Examples / Pitfall 3):** `outcome.status` → `ChatStreamState` (L55-60):
- `'completed'` → `{ state: 'completed', operationId }`
- `'partial' | 'failed'` → `{ state: 'failed', operationId }` (partial text retained + Retry; reasonCode check stays for `provider_unconfigured`)
- `'aborted'` → `{ state: 'idle', operationId }`

Keep: `ChatStreamState` 5-state union (L55-60), `isAbortError` name-match (L78-84), the `debugLog` catch path (L170-192), `retry()` (L197-200). The D-20 fence comment in the header (L1-19) inverts.

---

### `tests/core/ai/AgentOrchestrator.test.ts` (test, MIGRATE — O3 enumeration, never blanket-rewrite)

**Analog:** itself. **The D-20 source-invariant test MUST be inverted or the moment the orchestrator is touched, `vitest run` fails (RESEARCH Pitfall 1):**
```typescript
// L358-362 — the fence test 3a inverts:
describe('AgentOrchestrator — D-20 source invariant', () => {
  it('the orchestrator source carries zero evidence-machinery tokens (Phase 3a owns that machinery)', () => {
    const src = readFileSync(join(process.cwd(), 'src/core/ai/AgentOrchestrator.ts'), 'utf8');
    expect(src).not.toMatch(/CompletionEvidence|OutcomeVerifier|trajectory/);  // ← INVERT or drop
  });
});
```

**Enumerated migration deltas (O3):**
1. **Shape flips** — `output` assertions flip `AgentTurnOutput` → `AgentTurnOutcome`: L127-132 (`{ operationId, streamedText: 'final answer', toolResults: [], reasonCode: 'success' }` → `{ operationId, status: 'completed', reasonCode: 'ok', evidence: [], plannerCalls: 1, toolCalls: 0 }`), L245-250 (provider_unconfigured shape), L141 (`output.reasonCode` → `output.status`).
2. **reasonCode→status semantics** — `planner_cap_reached`/`tool_cap_reached` (L197, L215, L336, L354) → `status: 'partial'`, `reasonCode: 'cap_exhausted'` (O.2 verbatim, AGT-03).
3. **New behavior tests** (belong in `tests/core/ai/trajectory/**` per §18, but healthy-turn 2-model-call tests L119-155 stay HERE): keep the exact-cost assertions (planMock ×1 + renderMock ×1) as the trajectory regression — they now also assert the legal transition path `assembling-context → planning → rendering → completed`.

**Keep the suite's harness patterns for the new trajectory tests:**
- `vi.mock` stage services L37-45 (`vi.mock('@/core/ai/PlannerService', () => ({ PlannerService: { plan: vi.fn() } }))` + ExecutorService + RendererService).
- `baseInput` builder L90-100 + `makeResolver` L63-77 + `stageInvocation` L53-61 — extend with `onInputRequired` for the pause-seam test and a `verifiers` map for evidence tests.

---

### `tests/core/ai/AgentOrchestrator.budget.test.ts` (test, MIGRATE — O3)

**Analog:** itself. The `resolves.toMatchObject({ reasonCode: 'success' })` assertions (L139-145, L168-173, L207-210) gain `status: 'completed'`; the `vi.mock('ai', importOriginal)` pattern (L37-45) is the pattern the new trajectory integration tests reuse:
```typescript
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateObject: vi.fn(), generateText: vi.fn(), streamText: vi.fn() };
});
```
This suite is the proof that the rewire preserves the R-2 budget truth (retryCount stays 0 on healthy turns) — the plan must keep all three regression cases green post-rewire.

---

### `tests/core/ai/OutcomeVerifier.test.ts` (test, NEW — §18-required)

**Analog (compose):** `tests/fixtures/fixtures.test.ts` determinism shape + `tests/core/ai/ExecutorService.test.ts` pure-unit style (no provider mocks — direct function calls with fixture inputs).

**Test matrix (from RESEARCH Validation Architecture / VALIDATION.md rows 03a-02-01/02):**
- Pure-answer turn → `{ status: 'completed', evidence: [], reasonCode: 'ok' }` (D-3a-04: evidence gates tool-turns only).
- Mock dangerous tool (fixture) with matching `ok:true` evidence → `completed`.
- Absent evidence for a side-effecting tool → fail-closed (`verification_failed`/`failed`) (D-3a-06).
- Verifier throw → fail-closed, debugLog `TOOL_POSTCONDITION_FAILED`.
- `caps.capHit` → `{ status: 'partial', reasonCode: 'cap_exhausted' }` — NEVER `completed` (D-3a-07/AGT-03).
- Read-only tool (no verifier registered) → skipped, no evidence required (O.2 `if (!v) continue`).
- Determinism: either inject a clock or assert evidence excluding `verifiedAt` (Pitfall 6).

---

### `tests/core/ai/trajectory/**` (test, NEW directory — §18-required)

**Analog (compose):** `tests/core/ai/AgentOrchestrator.test.ts` (vi.mock stage services + baseInput) + the fixtures (`tests/fixtures/` additions).

**Test matrix (RESEARCH Validation Architecture):**
- Legal transitions per the table below; illegal transition throws `AGENT_STATE_INVALID` (C5).
- Healthy turn transitions `assembling-context → planning → rendering → completed` and stays at 2 model calls (AGT-01).
- CheckpointRecorder capture/restore; rollback discards the failed result (AGT-02).
- Replan fires once on retryable tool failure; repeated-identical failure (same toolName + same error.code) terminal; plannerCalls stays under plannerCap; never nested (AGT-04).
- Abort mid-verify/mid-replan wins (AbortError propagates) (O4).
- `waiting-for-permission` phase reachable via the pause seam; abort cancels the wait (AGT-05 seam, D-3a-15/16).

**Recommended legal-transition table (RESEARCH Pattern 2 — the planner fixes C5 details):**
```typescript
const LEGAL: Record<AgentTrajectoryPhase, readonly AgentTrajectoryPhase[]> = {
  'assembling-context': ['planning'],
  'planning': ['executing', 'rendering', 'waiting-for-permission'],
  'waiting-for-permission': ['planning', 'aborted'],
  'executing': ['verifying', 'replanning'],
  'verifying': ['planning', 'rendering'],
  'replanning': ['executing', 'rendering'],
  'rendering': ['completed', 'failed', 'partial', 'aborted'],
  'completed': [], 'failed': [], 'partial': [], 'aborted': [],
};
export function transitionPhase(from: AgentTrajectoryPhase, to: AgentTrajectoryPhase): void {
  if (!LEGAL[from].includes(to)) throw new Error(`AGENT_STATE_INVALID: ${from} -> ${to}`);
}
```

---

### `tests/fixtures/` (EXTEND) — trajectory/evidence fixtures (O1, D-3a-20)

**Analog:** `tests/fixtures/optimizedContext.ts` (builder-with-overrides pattern) + `tests/fixtures/index.ts` (determinism header).

**Determinism rule (fixtures/index.ts L1-7 — copy the header for the new fixture module):**
```typescript
// tests/fixtures/index.ts — D-20/D-21 deterministic typed fixture builders.
// Rules: seeded pseudo-randomness or fixed constants ONLY — never real
// crypto.getRandomValues or Date.now (determinism).
```

**Additions (O1):** a mock dangerous tool (`ToolSchemaRef`-shaped, `dangerous: true` — only the fixture toolset, never `BUILTIN_TOOLS`), synthetic `CompletionEvidence` builders, a transition-assertion helper, and Zod boundary-schema fixture tests (exercising the new harness schemas, GR-4). Follow the `buildOptimizedContextFixture(overrides)` shape: fixed constants + overrides param + deep-equal determinism (two calls with identical args deep-equal), tested in `tests/fixtures/fixtures.test.ts` style (L17-124).

---

### `package.json` (config, MODIFY) — `verify:phase-3a`

**Analog:** `verify:phase-3` (L21). Same §24 chain, added the isolation check:
```json
"verify:phase-3a": "eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && node tests/isolation/check-content-bundle.mjs"
```

---

### `.planning/REQUIREMENTS.md` + `.planning/ROADMAP.md` (docs, UPDATE) — D-3a-01 reconciliation

**Analog (precedent):** the AI-07 re-map note style. REQUIREMENTS.md AGT rows L50-54: AGT-02's description gains "CheckpointRecorder enables one-step rollback" (D-3a-02); AGT-05's row gets the Phase-8 re-map note (TOL-03, PermissionDialog). ROADMAP Phase 3a block L175-189: criterion #5 reduces to evidence/false-completion tests.

---

## Shared Patterns

### `debugLog` + canonical `ERROR_CODES` (Golden Rule 9)
**Source:** `AgentOrchestrator.ts` L191-199, `ExecutorService.ts` L34-45, `RendererService.ts` L136-141, `StructuredOutput.ts` L138-141
**Apply to:** every catch in every 3a file — verifier throw (`TOOL_POSTCONDITION_FAILED`), absent evidence (`COMPLETION_EVIDENCE_MISSING`), illegal transition (`AGENT_STATE_INVALID`), replan terminal. Never an empty catch, never a new error string. Shape:
```typescript
debugLog(ERROR_CODES.AGENT_STATE_INVALID, 'illegal trajectory transition', {
  module: 'AgentOrchestrator',                       // per-file module tag
  error: err instanceof Error ? err : undefined,     // R-10: never raw tool bodies/evidence details
  extra: { operationId, from, to },                  // redacted (R-10); evidence detail redacted before logging
});
```

### Typed error carriers (code-literal + guard + factory)
**Source:** `ProviderUnavailableError` (ProviderRouter.ts L300-316), `StreamFailedError` (RendererService.ts L62-76), `StructuredOutputFailedError` (StructuredOutput.ts L64-75)
**Apply to:** any new 3a error (e.g. an `AgentStateInvalidError` if the throw needs to carry `from`/`to` phases). Pattern: `interface XError extends Error { code: 'X'; ... }` + `isXError(err: unknown): err is XError` + a factory casting `new Error(...) as XError`.

### `isAbortError` name-match (prototype-chain agnostic)
**Source:** `AgentOrchestrator.ts` L204-211, `RendererService.ts` L85-89, `useStreamingLLM.ts` L78-84
**Apply to:** all 3a abort handling — abort wins mid-verify/mid-replan (O4); the pause seam's abort-cancels-wait.
```typescript
function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}
```

### F-4 sections-in append (never a joined-string rebuild)
**Source:** `StructuredOutput.ts` L117-133 (repair-section append); `contextHelper.ts` L60-85 (section-build pattern); `ProviderRouter.ts` `joinSections` L80-88
**Apply to:** the replan `tool_result` feedback (D-3a-11) — append a `PromptSection`, `stable: false`, never `context.sections.map(s => s.text).join('\n') + toolResultText`. Cache-stability invariant (Pitfall 7, T-03-07-02).

### Zod boundary schemas, co-located, zod-3 API only
**Source:** `src/core/ai/types.ts` L89-103 (`ProviderConfigSchema` + `z.infer`)
**Apply to:** the new harness boundary schemas (D-3a-20, GR-4) — `z.discriminatedUnion`/`.safeParse` only (never zod-4 APIs, RESEARCH A5); exercised by fixture tests.

### `vi.mock` stage services (unit tests)
**Source:** `AgentOrchestrator.test.ts` L37-45
**Apply to:** trajectory tests mocking PlannerService/ExecutorService/RendererService.
```typescript
vi.mock('@/core/ai/PlannerService', () => ({ PlannerService: { plan: vi.fn() } }));
vi.mock('@/core/ai/ExecutorService', () => ({ ExecutorService: { execute: vi.fn() } }));
vi.mock('@/core/ai/RendererService', () => ({ RendererService: { render: vi.fn() } }));
```

### `vi.mock('ai')` — keep real error classes, stub only SDK call sites
**Source:** `AgentOrchestrator.budget.test.ts` L37-45 (`importOriginal` spread)
**Apply to:** any 3a test that must exercise the real Router/classifyProviderError interplay.

### Fixture determinism rule
**Source:** `tests/fixtures/index.ts` L1-7; `tests/fixtures/optimizedContext.ts` L1-8
**Apply to:** all new trajectory/evidence fixtures — fixed constants only, never real `crypto`/`Date.now`; O.2's `verifiedAt: Date.now()` handled via injected clock or `vi.setSystemTime`.

### No event bus — StageEvent is a TYPE only (L1, §1.6.1)
**Source:** spec L4995-5007; `ProviderRouter.ts` direct-call design
**Apply to:** trajectory transitions are DIRECT calls in `runAgentTurn`; observability via an optional callback or a post-turn read (agent's discretion, C5) — never an emitter/observer framework (RESEARCH anti-pattern; xstate explicitly rejected).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/ai/OutcomeVerifier.ts` (NEW) | service | request-response | No in-repo verifier exists (D-20 fence kept it out). **The analog IS the spec:** Appendix O.2 verbatim (L6362-6393); style from ExecutorService.ts (deterministic boundary, R-10-safe logging). Planner uses RESEARCH Pattern 1 as the plan's code reference. |
| `src/core/ai/CheckpointRecorder.ts` (NEW) | utility | event-driven | No in-repo opId-keyed recorder exists. Compose: `ProviderRouter.operations` Map lazy-init (L361, L769-786) + `WriteJournal` rollback semantics (L28-33, L62-79). D-3a-08/09 shape in RESEARCH Pattern 3. |
| `tests/core/ai/OutcomeVerifier.test.ts` + `tests/core/ai/trajectory/**` (NEW) | test | — | No existing tests cover trajectory/evidence (D-20 fence). Compose: `fixtures.test.ts` determinism + `AgentOrchestrator.test.ts` vi.mock harness + the O.2/C.1 fixtures. |

---

## Metadata

**Analog search scope:** `src/core/ai/*` (16 files), `src/types/*` (harness.ts), `src/core/error/*`, `src/core/security/TraceRedactor.ts`, `src/core/storage/WriteJournal.ts`, `src/components/pages/useStreamingLLM.ts`, `tests/core/ai/*` (14 files), `tests/fixtures/*`, `tests/components/pages/*`, `package.json`, `.planning/{PRODUCT_SPEC_v0_1.md, REQUIREMENTS.md, ROADMAP.md}`, `03-PATTERNS.md`
**Files scanned:** 25 (fully read: 9 source + 4 test + 2 fixture + WriteJournal + spec slices at L2650-2699 / L4795-4859 / L4990-5019 / L5032-5071 / L6350-6409)
**Pattern extraction date:** 2026-08-11
**Mode note:** spec-authoritative rewire — MODIFY targets are their own analogs (preserve contract, change the fenced mechanism); NEW modules are spec-verbatim (O.2/C.1/§1.6.1) with in-repo style analogs. The planner must read 03a-RESEARCH.md Patterns 1-3 and the O.2/C.1 spec slices cited above before writing PLAN.md actions.
