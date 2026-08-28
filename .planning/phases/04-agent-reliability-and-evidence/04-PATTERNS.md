# Phase 4: Agent Reliability and Evidence - Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 11 (3 new source + 4 modified source + 2 new test targets + 1 modified test + 1 config)
**Analogs found:** 11 / 11

> **Two verified discrepancies the planner MUST act on (RESEARCH.md, HIGH confidence):**
> 1. `ToolExecutionResult.evidence` does **NOT** exist today — grep for `CompletionEvidence` across `src/` returns zero hits (verified). `src/core/ai/types.ts:122-133` must gain `evidence?: import('@/types/harness').CompletionEvidence` (spec 4339) — and `@/types/harness` must be created FIRST or the import fails to resolve.
> 2. `verify:phase-4` in `package.json:21` points at `tests/core/context` (Phase 5 territory, dir does not exist) — the gate is **RED** today. D-68 re-point is a hard prerequisite.
>
> **Strict-clean requirement:** `NP_STRICT_CEILING: 0` (`package.json:7`, enforced by `tests/core/strict/np-strict-ceiling.test.ts:78-103`). All new Phase-4 code must be strict-clean — zero `@ts-expect-error NP-STRICT` markers, never bare `@ts-ignore`. The C.1/O.2 shapes type-check cleanly against `ToolExecutionResult<unknown>` without casts (the O.1 `(r as any)` at spec 6283 is a Phase-14 coordinator, not Phase 4).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/types/harness.ts` **(NEW)** | types/model | N/A (shared types) | `src/types/storage.ts` (closed unions + spec-verbatim) + `src/types/index.ts` (interface layout) | exact |
| `src/core/ai/trajectory.ts` **(NEW)** | service (state-machine tracker) | event-driven | `src/core/runtime/workerState.ts` `ActiveStreamState` (22-42) + `src/core/ai/types.ts` `PlannerDecisionSchema` (38-50) | role-match |
| `src/core/ai/OutcomeVerifier.ts` **(NEW)** | service (verification framework) | transform (results→evidence→outcome) | `src/core/ai/ExecutorService.ts` (zero-registration + typed results) + `src/core/ai/toolSchemas.ts` `ToolRegistry` (67-83) | exact |
| `src/core/ai/AgentOrchestrator.ts` **(MODIFY)** | controller/orchestrator | event-driven (bounded loop) | itself (`runAgentTurn` 121-355, `AgentTurnOutput` 90-101, `finish` 231-280) | exact |
| `src/core/ai/types.ts` **(MODIFY)** | types | N/A | itself — additive field (mirror `src/types/storage.ts:58-61` additive `'append-chat-turn'` union member) | exact |
| `src/core/ai/RendererService.ts` **(MODIFY)** | service | streaming | itself — `RenderTermination` union (36) + `RenderResult.terminatedBy` (70) is the guard's status precedent | exact |
| `src/components/chat/useChatStreaming.ts` **(MODIFY)** | hook/component | request-response | itself — `output.reasonCode`/`output.streamedText` reads (223, 244, 252) + abort catch (258-261) | exact |
| `tests/core/ai/trajectory/**` **(NEW test dir)** | test | N/A | `tests/core/ai/persona/` (test subdir pattern) + `tests/core/ai/ExecutorService.test.ts` (pure-unit style) | role-match |
| `tests/core/ai/OutcomeVerifier.test.ts` **(NEW)** | test | N/A | `tests/core/ai/ExecutorService.test.ts` (input-builder + injected results, 18-78) | exact |
| `tests/core/ai/AgentOrchestrator.test.ts` **(MODIFY)** | test | N/A | itself — case groups (a)-(i), `seedEnv` (97-115), `planSpy` (175-177), case (b) 169-193, case (e) 241-272 | exact |
| `package.json` **(MODIFY)** | config | N/A | itself — `verify:phase-3` (line 20) is the re-point template for `verify:phase-4` (line 21) | exact |

---

## Pattern Assignments

### `src/types/harness.ts` (types/model, N/A)

**Analog:** `src/types/storage.ts` (lines 1-115) — the in-repo precedent for a canonical type home: spec-verbatim shapes + a doc comment citing the spec location; closed literal unions declared once and imported by consumers. Also `src/types/index.ts` for the plain-interface layout style.

**Canonical-home rule (D-60):** this file holds `AgentTrajectoryState`, `CompletionEvidence`, `AgentTurnOutcome` **verbatim from Appendix C.1** (spec 4849-4876). No parallel copy in `src/core/ai`. `ToolExecutionResult` stays in `@/core/ai/types` (spec 4844) — do not move it here.

**Verbatim C.1 content** (from RESEARCH Code Examples — source `.planning/PRODUCT_SPEC_v0_1.md:4849-4876`, verbatim):
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
export interface CompletionEvidence {
  toolName: string;
  operationId: string;
  postconditionId: string;   // verifier that produced this evidence (TOL-03)
  ok: boolean;
  verifiedAt: number;
  detail?: string;
}
export interface AgentTurnOutcome {
  operationId: string;
  status: 'completed' | 'partial' | 'failed' | 'aborted';
  reasonCode: string;        // cap exhaustion => 'partial', never 'completed'
  evidence: CompletionEvidence[];
  plannerCalls: number;
  toolCalls: number;
}
```
**Notes:**
- These are TS interfaces in the spec — **no Zod mandated** (RESEARCH: "Harness types are TS interfaces in the spec (no Zod mandated); follow O.2 verbatim"). The `storage.ts` zod-schema-pair convention applies only where cross-boundary runtime validation is needed; C.1 types are compile-time contracts inside the AI core.
- `@/types/harness` resolves via the `@/*` → project root alias (`tsconfig.json:22-25`, `vitest.config.ts:11-13`). Single file `src/types/harness.ts` matches the existing `src/types/` layout (`index.ts`, `storage.ts` — both flat files, no `index/` dirs).
- `status` is a **closed 4-value union** — never an open string ("make illegal states unrepresentable"). No invented statuses (D-38 / §21.6).
- The `operationId` field must be the turn's `OperationId` threaded from `input.operationId` (D-63, Pitfall 8) — `generateOperationId()` is called ONCE by the caller (`useChatStreaming.ts:170`).

---

### `src/core/ai/trajectory.ts` (service, event-driven)

**Analog:** `src/core/runtime/workerState.ts:22-42` — the existing closed-union state machine (`ActiveStreamState`). The trajectory tracker shares its "closed state set, per-state meaning" spirit but is a **different machine** (turn-level agent evidence vs surface-level streaming UI — D-62: do NOT conflate; `ActiveStreamState` is explicitly NOT the trajectory).

**Import pattern** (module conventions — `src/core/ai` uses relative imports, but the C.1 types come from the canonical home via the alias per spec 4339):
```typescript
import type { AgentTrajectoryPhase, AgentTrajectoryState } from '@/types/harness';
```

**Core pattern — transition-table validator (D-62 recommendation, RESEARCH A1):** The C.1 `AgentTrajectoryState` is a flat snapshot interface (single `phase` field, not a per-state discriminated union), so type-level encoding would restructure the locked canonical type. Use a data-driven table + runtime throw (AGT-01):
```typescript
export const TRAJECTORY_TRANSITIONS: Record<AgentTrajectoryPhase, readonly AgentTrajectoryPhase[]> = {
  'assembling-context': ['planning'],
  'planning': ['executing', 'waiting-for-permission', 'rendering', 'replanning', 'failed', 'aborted'],
  'waiting-for-permission': ['executing', 'replanning', 'failed', 'aborted'],
  'executing': ['verifying', 'replanning', 'failed', 'aborted'],
  'verifying': ['rendering', 'failed', 'aborted'],
  'replanning': ['planning', 'failed', 'aborted'],
  'rendering': ['completed', 'failed', 'aborted'],
  'completed': [],
  'failed': [],
  'aborted': [],
};

export class TrajectoryTracker {
  private state: AgentTrajectoryState;
  constructor(operationId: string) {
    this.state = { operationId, phase: 'assembling-context', plannerCalls: 0, toolCalls: 0, updatedAt: Date.now() };
  }
  enter(next: AgentTrajectoryPhase): void {
    if (!TRAJECTORY_TRANSITIONS[this.state.phase].includes(next)) {
      throw new Error(`illegal trajectory transition: ${this.state.phase} -> ${next}`); // AGT-01
    }
    this.state = { ...this.state, phase: next, updatedAt: Date.now() };
  }
  snapshot(plannerCalls: number, toolCalls: number): AgentTrajectoryState {
    return { ...this.state, plannerCalls, toolCalls, updatedAt: Date.now() };
  }
}
```
**Notes:**
- `waiting-for-permission` has **no Phase-4 trigger** (permission gate is Phase 17) but must exist in the table — the closed machine requires all 10 C.1 states (AGT-01).
- `assembling-context` is entered at turn start; no context assembly exists until Phase 5 — the state is recorded, not acted on.
- D-62 discretion: single file `src/core/ai/trajectory.ts` (RESEARCH A7 recommends this; test dir `tests/core/ai/trajectory/**` is mandatory either way). A `trajectory/` directory is allowed if the planner prefers parity with the test dir.
- The tracker records, never persists (D-63 — in-memory per turn; AITransactionLog is Phase 11).

---

### `src/core/ai/OutcomeVerifier.ts` (service, transform)

**Analog:** `src/core/ai/ExecutorService.ts` (lines 1-71) — the zero-registration + typed-result contract is the exact precedent for the zero-verifier framework (D-64). `src/core/ai/toolSchemas.ts:67-83` (`ToolRegistry`) is the registry shape for `VerifierRegistry`.

**Import pattern** (O.2 verbatim — spec 6330-6361):
```typescript
import type { CompletionEvidence, AgentTurnOutcome } from '@/types/harness';
import type { ToolExecutionResult } from './types';
```

**Core pattern — O.2 `Verifier` + `buildOutcome` verbatim** (RESEARCH Code Examples, verified spec 6330-6361):
```typescript
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

**Registry pattern — mirror `ToolRegistry` (declare-now, empty)** (`src/core/ai/toolSchemas.ts:67-83`):
```typescript
const registeredVerifiers = new Map<string, Verifier>(); // keyed by toolName
export const VerifierRegistry = {
  register(toolName: string, verifier: Verifier): void { registeredVerifiers.set(toolName, verifier); },
  unregister(toolName: string): void { registeredVerifiers.delete(toolName); },
  get(toolName: string): Verifier | undefined { return registeredVerifiers.get(toolName); },
  getAll(): Record<string, Verifier> { return Object.fromEntries(registeredVerifiers); },
};
```
**Notes:**
- Phase 4 registers ZERO verifiers (D-64) — production `buildOutcome` returns `completed` (no cap hit) with `evidence: []`. The framework is exercised by **injected fixtures only** (D-67).
- `runAgentTurn` accepts an optional `verifiers?: Record<string, Verifier>` input override for test injection — mirrors the existing `providerSecrets` input pattern (`AgentOrchestrator.ts:78`).
- `reasonCode`s (`cap_exhausted`/`postcondition_failed`/`ok`) are **descriptive literals, NOT §21.6 error codes** — do not export them as error-code constants (D-38 / RESEARCH anti-pattern).

---

### `src/core/ai/AgentOrchestrator.ts` (controller/orchestrator, event-driven)

**Analog:** itself — the Appendix I bounded loop (`runAgentTurn`, lines 121-355). All Phase-4 changes slot into existing structures:

**D-61 — evolve `AgentTurnOutput` → `AgentTurnOutcome` (additive).** Current shape at lines 90-101:
```typescript
export interface AgentTurnOutput {
  streamedText: string;
  toolResults: ToolExecutionResult<unknown>[];
  reasonCode: string;
}
```
The C.1 `AgentTurnOutcome` (operationId, status, evidence, plannerCalls, toolCalls) supersedes it **additively** — consumers keep reading `streamedText`/`reasonCode` (D-61: field addition vs composed wrapper is the planner's discretion; `useChatStreaming` must not break). Note the Phase-3 shape **dropped `operationId`** vs the spec's Appendix I (spec 5561-5566) — D-61 re-adds it from `input.operationId` (Pitfall 8).

**D-62/63 — trajectory hooks.** The tracker instantiates at loop top with `input.operationId`; enter `planning` before each `PlannerService.plan` call (line 309), `executing` before `ExecutorService.execute` (line 340), `replanning` on non-terminal failure, `verifying`+`rendering` inside `finish()` (line 231), terminal on outcome return. `snapshot(plannerCalls, toolCalls)` — the counters already exist at lines 123-124.

**D-66 — replan/terminal policy (AGT-04).** Slots into the loop after `toolResults.push(result)` (line 348):
```typescript
const identity = result.code ?? (result.error ?? 'ERROR'); // stable signal: §21.6 code first
if (!result.ok) {
  if (failureIdentities.get(result.toolName) === identity) {
    return finishTerminal('failed');                        // repeated identical failure (AGT-04)
  }
  if (replannedTools.has(result.toolName)) {
    return finishTerminal('failed');                        // replan budget consumed (≤1 per tool)
  }
  failureIdentities.set(result.toolName, identity);
  replannedTools.add(result.toolName);
  trajectory.enter('replanning');                           // next planner call = the single replan
  continue;
}
```
Identity = `toolName + ':' + (code ?? 'ERROR')` — never the raw error message alone (Pitfall 7). Retry layering stays bounded: ProviderRouter (§1.5) + AGT-04 replan + one per-stage retry, all under §1.4 caps (§1.6.1).

**D-65 — completion guard** runs in `finish()` (line 231) before the outcome is returned — "never a clean success" is unconditional:
```typescript
function guardMissingEvidence(
  results: ToolExecutionResult<unknown>[],
  verifiers: Record<string, Verifier>,
): boolean {
  return results.some((r) =>
    r.ok === true && verifiers[r.toolName] !== undefined && r.evidence === undefined,
  );
}
// In finish(): if (guardMissingEvidence(toolResults, verifiers)) {
//   status = 'partial'; reasonCode = 'missing_evidence';   // never 'completed' (AGT-02, R-8)
// }
```

**D-66/AGT-04 — abort → returned `aborted` outcome (Open Question Q1, RESEARCH A4).** The loop currently throws `DOMException('aborted', 'AbortError')` at three sites (lines 215, 256, 300). DONE-when "abort produces `aborted`" implies a **central catch at the `runAgentTurn` boundary** returning `{ status: 'aborted', streamedText: '', … }` — never invoking `persistTurn` (D-45: abort drops the partial). This is the phase's most invasive change: it rewires the throw contract `useChatStreaming.ts:258` and tests (e) rely on.

**Status mapping for existing terminal reasons** (planner's discretion — RESEARCH A3 recommendation):
| Existing reasonCode | Recommended status | Notes |
|---|---|---|
| planner answer reasonCode (e.g. `direct_answer`) | `completed` | Normal answer path |
| `ask_clarification` | `completed` | Legitimate terminal outcome — the question IS the renderer output |
| `planner_cap_reached` / `tool_cap_reached` | `partial` | Cap exhaustion → O.2 reasonCode `cap_exhausted` |
| `configuration_required` (D-54a, lines 291-297) | `failed` (recommended) | No provider request started, no output — `failed` is honest; consumers branch on reasonCode (`useChatStreaming.ts:223`) |
| repeated identical failure | `failed` | AGT-04 |
| guard (missing evidence) | `partial` | D-65 |
| abort | `aborted` | C.1 status set / DONE-when |

**Logging pattern** — keep `debugLog` (never `console.log`), existing codes `ORCHESTRATOR_PLAN`/`ORCHESTRATOR_TOOL` (lines 319, 349); add trajectory-phase debug codes in the same style.

---

### `src/core/ai/types.ts` (types, N/A)

**Analog:** itself — additive field (the `code?: string` field added by plan 03-04 at lines 127-132 is the exact precedent; same pattern as `src/types/storage.ts:58-61` additive `'append-chat-turn'` union member).

**Add to `ToolExecutionResult` (lines 122-133)** — the spec 4339 seam (RESEARCH verified it does NOT exist today):
```typescript
export interface ToolExecutionResult<T = unknown> {
  toolName: string;
  ok: boolean;
  data: T | null;
  error: string | null;
  code?: string;
  /** §28.2 AGT-02 — set for side-effecting tools (spec 4339). Canonical home: @/types/harness. */
  evidence?: import('@/types/harness').CompletionEvidence;
  durationMs: number;
}
```
**Do NOT rework `data`/`error`** to the spec's `output?`/`error?:{code,message,retryable}` shape — that breaks ExecutorService and its tests (Pitfall 5). Additive only. The other spec fields stay a Phase-18/none concern.

---

### `src/core/ai/RendererService.ts` (service, streaming)

**Analog:** itself — the `RenderTermination` closed union (line 36: `'completed' | 'aborted' | 'error' | 'cap'`) and `RenderResult.terminatedBy` (line 70) are the in-file precedent for closed terminal states; the `error?: { code, message }` conditional spread (line 212) is the shape pattern for guard metadata.

**D-65 completion guard** is an **outcome-level** check — the RESEARCH recommendation places it in the orchestrator's `finish()` (before/overriding `buildOutcome`'s status), NOT inside `render()`. The renderer's existing `terminatedBy`/`error` fields may optionally carry a guard flag, but the authoritative downgrade is on the `AgentTurnOutcome.status`. This file's modification is minimal — the guard consumes `ToolExecutionResult.evidence` (types.ts seam) + `verifiers` presence, which the orchestrator threads in.

---

### `src/components/chat/useChatStreaming.ts` (hook/component, request-response)

**Analog:** itself — the D-44 consumer contract. `output.reasonCode` read at line 223 (`configuration_required` branch), `output.streamedText` at line 244, abort catch at lines 258-261.

**Q1 change (if abort → returned `aborted` outcome):** the `runAgentTurn` call at line 209 returns an outcome instead of throwing for abort. The catch block must branch on `output.status === 'aborted'`:
```typescript
const output = await runAgentTurn({ ... });
if (output.status === 'aborted') {
  // D-45: partial dropped, nothing persisted — the stopped note was already
  // appended by handleStopGenerating (line 286). Just clear generating state.
  setIsGenerating(false);
  return;
}
```
The existing `AbortError` catch (lines 258-261) may remain as a defensive fallback for non-caller aborts, but the primary contract becomes the returned outcome. **This edit is the D-61 "costly" reversibility surface** — scope it explicitly in the plan. The `reasonCode`-branching consumers (`configuration_required` at 223, empty-answer mark at 252) stay unchanged.

---

### `tests/core/ai/trajectory/**` (test, N/A)

**Analog:** `tests/core/ai/persona/` — the existing test-subdir precedent under `tests/core/ai`; test style from `tests/core/ai/ExecutorService.test.ts` (pure unit — `describe`/`it`/`expect`, no env seeding, no providers).

**Pure state-machine tests — no chrome mocks, no fixture providers needed** (the tracker is dependency-free):
- Legal transitions pass (`assembling-context → planning → executing → verifying → rendering → completed`).
- Illegal transitions throw (`assembling-context → completed`).
- `snapshot(plannerCalls, toolCalls)` reflects counters + `updatedAt` bumps.
- Per-turn record: `operationId` matches the constructor arg (D-63).
- `waiting-for-permission` exists in the table but has no trigger (closed machine completeness, AGT-01).

**File layout:** mirror the RESEARCH-recommended module shape — if `src/core/ai/trajectory.ts` is a single file, `tests/core/ai/trajectory/TrajectoryTracker.test.ts` (or `trajectory.test.ts`) works; the `**` glob in the gate covers either.

---

### `tests/core/ai/OutcomeVerifier.test.ts` (test, N/A)

**Analog:** `tests/core/ai/ExecutorService.test.ts` (lines 18-78) — the input-builder + injected-result pattern is exactly what D-67 requires. No providers, no env seeding.

**Input-builder pattern** (mirror `executeInput`, ExecutorService.test.ts:18-26):
```typescript
function toolResult(overrides: Partial<ToolExecutionResult> = {}): ToolExecutionResult {
  return {
    toolName: 'fake_tool',
    ok: true,
    data: null,
    error: null,
    durationMs: 10,
    ...overrides,
  };
}
```

**Required cases (AGT-02/03/04, Wave 0 gaps from RESEARCH):**
- `buildOutcome` with `caps.capHit: true` → `status: 'partial'`, `reasonCode: 'cap_exhausted'` — never `completed` (AGT-03).
- Side-effecting result (`ok: true` + registered verifier) whose `verify` returns `{ok: false}` → `status: 'failed'`, `reasonCode: 'postcondition_failed'`.
- Zero verifiers + ok results → `completed`/`ok`, `evidence: []` (D-64 vacuity).
- **False-completion guard test (the AGT-02 proof, Pitfall 4):** inject `toolResult({ ok: true, toolName: 'side_effect', evidence: undefined })` + a registered verifier for `side_effect` (via `input.verifiers`) → outcome must be `partial`/guard-flagged, never `completed`.
- Evidence shape: `postconditionId` = the verifier's id; `operationId` = the input operationId.

---

### `tests/core/ai/AgentOrchestrator.test.ts` (test, N/A)

**Analog:** itself — extend the existing case-group file (cases a-i). Key structures to reuse:
- `seedEnv` (lines 97-115) + `baseInput` (117-126) — unchanged.
- `planSpy` pattern (lines 175-177): `vi.spyOn(PlannerService, 'plan').mockResolvedValue({...})` — still the only way to make the zero-tool planner emit `run_tool` (D-46).
- **NEW — executor mock for D-67 (injected replan results):** `ExecutorService` is exported as an object (`src/core/ai/ExecutorService.ts:71`) so `vi.spyOn(ExecutorService, 'execute').mockResolvedValue(toolResult({ ok: false, code: 'TOOL_REJECTED' }))` is the injection seam. No fake tools registered (D-67 forbids).

**Required modifications (RESEARCH Wave 0 + Pitfalls 2/3):**
- **Case (b) re-script (Pitfall 2):** the current `run_tool 'any_tool'` mock (line 177) repeats the SAME tool name — under AGT-04 the second execution is a repeated identical failure → terminal `failed` BEFORE `plannerCap`. Re-script with **distinct tool names per iteration** (`search_kb` then `write_note` — each fresh tool has its own replan budget) so the loop legitimately exhausts the cap → `partial`/`cap_exhausted`.
- **New cases:** repeated-identity → `failed` (same tool + same code, two executions, `vi.spyOn(ExecutorService, 'execute')` returning the same injected failure); one-replan-then-terminal (first failure enters `replanning`, second planner call answers → `completed` with the replan counted, or second identical failure → `failed`).
- **Case (e) rework (Q1):** abort assertions change from `rejects.toThrow(DOMException)` (lines 249-251, 269) to resolving with `status: 'aborted'` + `persistTurn` not called + `streamedText: ''`.
- **Status assertions on existing cases:** (a) → `status: 'completed'`; (c) → `completed` (ask_clarification mapping); (d) TOOL_REJECTED then answer → `completed`; (h) `configuration_required` → `status: 'failed'` (A3 recommendation).
- **`operationId` correlation (Pitfall 8):** assert `output.operationId === input.operationId` ('op-orchestrator' in `baseInput`).

---

### `package.json` (config, N/A)

**Analog:** itself — `verify:phase-3` (line 20) is the template.

**D-68 re-point (line 21):**
```json
"verify:phase-4": "tsc --noEmit && vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts tests/core/ai"
```
Include the whole `tests/core/ai` suite (AgentOrchestrator changes ripple through `AgentOrchestrator.test.ts` + `chat-integration.test.ts`); trajectory + OutcomeVerifier stay mandatory. Current value `tests/core/context` is Phase 5 territory — do NOT write Phase-4 tests there.

---

## Shared Patterns

### Closed status/literal unions (never open strings)
**Source:** `src/core/ai/types.ts:38-50` (`PlannerDecisionSchema` `z.discriminatedUnion('action', ...)`) + `src/types/storage.ts:86-91` (`WriteJournalEntryStatusSchema` `z.union([...])`)
**Apply to:** `AgentTurnOutcome.status` (C.1 verbatim 4-value union), `AgentTrajectoryPhase` (C.1 verbatim 10-value union), the trajectory transition table keys
```typescript
export const WriteJournalEntryStatusSchema = z.union([
  z.literal('pending'), z.literal('applying'),
  z.literal('completed'), z.literal('rolled-back'),
]);
```
Note: C.1 harness types are TS-only (no Zod mandated); the closed-union discipline is the shared principle, not the zod wrapper.

### Declare-now / populate-later registry
**Source:** `src/core/ai/toolSchemas.ts:67-83` (`ToolRegistry`) — "declare-now registry (Registry.ts pattern) — starts EMPTY"
**Apply to:** `VerifierRegistry` (D-64 — zero verifiers registered in Phase 4; Phase 18 registers real ones). Both `ToolRegistry` and `VerifierRegistry` follow the same Map-backed `register/unregister/get/getAll` shape.

### Zero-registration typed contract
**Source:** `src/core/ai/ExecutorService.ts:28-36` (`ToolRejectedResult` — `code: 'TOOL_REJECTED'` literal on the result shape, never a thrown generic Error) + `:71` (`export const ExecutorService = { execute }` — object export enables `vi.spyOn` mocking)
**Apply to:** `OutcomeVerifier` (zero-verifier vacuity), the D-67 executor-mock injection seam in AgentOrchestrator tests, the D-65 guard tests
```typescript
export interface ToolRejectedResult {
  toolName: string;
  ok: false;
  data: null;
  error: string;
  code: 'TOOL_REJECTED';
  durationMs: number;
}
```

### Abort handling — DOMException('aborted', 'AbortError')
**Source:** `src/core/ai/AgentOrchestrator.ts:215, 256, 300` (throw sites) + `src/components/chat/useChatStreaming.ts:258-261` (catch) + `tests/core/ai/AgentOrchestrator.test.ts:249-251, 269` (assertions)
**Apply to:** the Q1 abort→`aborted` outcome conversion — all three sites' throw contract and both test assertions change together. Keep the DOMException name stable for non-caller aborts (defensive catch).

### AbortSignal threading (unchanged convention)
**Source:** `RendererService.ts:99-108` (compose caller signal + internal deadline via AbortController; remove listener in `finally`) — mirrors `PlannerService` WR-02
**Apply to:** any new abort-aware code (trajectory tracker needs no signal; the orchestrator's central abort catch reads `input.abortSignal.aborted` — the loop-top check at line 300 already does this).

### Logging — debugLog, never console.log
**Source:** `src/core/ai/AgentOrchestrator.ts:319, 349` (`debugLog('ORCHESTRATOR_PLAN', ...)`, `debugLog('ORCHESTRATOR_TOOL', ...)` with `{operationId, sessionId, ...}` payload)
**Apply to:** trajectory phase entries, guard downgrades, replan/terminal decisions — same code style (SCREAMING_SNAKE code + contextual payload object). TraceRedactor handles secrets.

### Fixture-driven tests — real stages, scripted providers, injected results
**Source:** `tests/core/ai/AgentOrchestrator.test.ts:39-58` (`RecordingProvider` wrapping `FixtureProvider`), `:97-115` (`seedEnv`), `:175-177` (`planSpy`), `tests/core/ai/fixtures/FixtureProvider.ts` (scripted stream + requestJson)
**Apply to:** all new/extended AI tests. Stage services stay REAL; only the provider is a fixture (D-48) and the planner is scripted via `vi.spyOn` where the zero-tool schema cannot emit `run_tool` (D-46). Phase-4 additions: `vi.spyOn(ExecutorService, 'execute')` for injected tool results (D-67) and `input.verifiers` for injected verifiers (D-64).

### NP-STRICT ceiling 0 — strict-clean new code
**Source:** `tests/core/strict/np-strict-ceiling.test.ts:78-103` (counts `NP-STRICT-` markers across `src/`+`entrypoints/` via `git grep`, fails when live count > `package.json.NP_STRICT_CEILING`)
**Apply to:** `harness.ts`, `trajectory.ts`, `OutcomeVerifier.ts`, and all orchestrator/types edits — zero `@ts-expect-error NP-STRICT` markers, zero bare `@ts-ignore`. The C.1/O.2 shapes type-check against `ToolExecutionResult<unknown>` without casts.

### `operationId` threading (Flag C)
**Source:** `src/core/runtime/OperationId.ts:1-5` (`generateOperationId()` = `crypto.randomUUID()`, called once at `useChatStreaming.ts:170`) + `RuntimeEnvelope.ts:50` (`operationId: string` on the envelope)
**Apply to:** trajectory `operationId`, `AgentTurnOutcome.operationId`, `CompletionEvidence.operationId` — all must be `input.operationId`, never a fresh UUID (Pitfall 8).

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/core/ai/trajectory/**` (new dir) | test | N/A | No existing state-machine-tracker test dir; closest precedents are `tests/core/ai/persona/` (subdir pattern) and ExecutorService.test.ts (pure-unit style) — both covered above |
| `src/types/harness.ts` | types | N/A | No existing `@/types/harness`; `storage.ts` is the layout/verbatim precedent, C.1/O.2 content comes from RESEARCH Code Examples (spec-verbatim) |

Both are "no close match" only in the sense that they're net-new homes for spec-verbatim content; every *pattern* (closed unions, declare-now registry, test style) has a concrete in-repo analog listed above.

---

## Metadata

**Analog search scope:** `src/core/ai/` (all 22 files), `src/core/runtime/` (workerState, RuntimeEnvelope, OperationId), `src/types/` (index, storage), `src/components/chat/useChatStreaming.ts`, `tests/core/ai/` (all 22 files incl. fixtures), `tests/core/strict/np-strict-ceiling.test.ts`, `tests/setup.ts`, `package.json`
**Files scanned:** 22 (11 classified targets + 11 analog candidates)
**Pattern extraction date:** 2026-08-29

**Key verified facts (from grep + read, matching RESEARCH):**
- `AgentTurnOutput` has exactly ONE consumer: `useChatStreaming.ts` (line 209 `runAgentTurn`; reads `reasonCode` 223, `streamedText` 244, 252).
- `CompletionEvidence`/`AgentTrajectory*`/`AgentTurnOutcome`/`harness` — zero hits in `src/` (the evidence seam and canonical home do NOT exist; RESEARCH Pitfall 5 confirmed).
- `verify:phase-4` = `tests/core/context` (package.json:21) — gate RED today (D-68).
- `ExecutorService` exports as an object (`:71`) — `vi.spyOn(ExecutorService, 'execute')` is the D-67 injection seam.