# Phase 3a: Agent Reliability and Evidence - Research

**Researched:** 2026-08-11
**Domain:** Agent orchestration reliability — trajectory state machine, deterministic outcome verification, checkpoint/rollback, bounded replan policy, evidence-gated completion
**Confidence:** HIGH (spec-authoritative; every decision locked in 03a-CONTEXT.md; canonical refs verified in-product in PRODUCT_SPEC_v0_1.md)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-3a-01 [spec-authoritative 4-item scope]:** Phase 3a implements spec §28.2 AGT-01..04 only. REQUIREMENTS.md is updated with an AI-07-style note: CheckpointRecorder folds into AGT-02; AGT-05 commit-confirm re-maps to Phase 8 (TOL-03). ROADMAP criterion #5 reduces to evidence/false-completion tests (which stay in 3a).
- **D-3a-02 [CHECKPOINT_RECORDER under AGT-02]:** CheckpointRecorder is delivered as part of AGT-02 (rollback machinery), not as a separate numbered requirement. No new AGT id invented.
- **D-3a-03 [deterministic verifier]:** `OutcomeVerifier.verify` is a pure postcondition check over `ToolExecutionResult` — Appendix O.2 verbatim. No model calls, no verifier PipelineStage, no extra tier cap, no persona injection. Healthy turn stays at 2 model calls (planner + renderer).
- **D-3a-04 [evidence gates tool-turns only]:** A pure-answer turn (no tools executed) is `completed` with `evidence: []`. Evidence is required only for turns that executed side-effecting tools. Matches O.2 `buildOutcome` (verifiers run only over `results`).
- **D-3a-05 [completion-gate layering]:** Verifier = verdict only (`{ok, detail}`). Orchestrator = sole terminal decision authority (`completed` | `verification_failed` | `waiting_for_permission` | `partial` | `aborted`). Renderer = display only — never independently re-verifies. One verdict, one authority, no double-verification, no renderer override.
- **D-3a-06 [fail-closed]:** Verifier throw, malformed evidence, or absent evidence for a side-effecting tool ⇒ `verification_failed` — never a silent `completed`. Safety invariant (R-8). Canonical codes: `TOOL_POSTCONDITION_FAILED`, `COMPLETION_EVIDENCE_MISSING`, `AGENT_STATE_INVALID`.
- **D-3a-07 [cap exhaustion = partial]:** `caps.capHit ⇒ status 'partial', reasonCode 'cap_exhausted'` — never `completed` (O.2 verbatim, AGT-03).
- **D-3a-08 [own module]:** `src/core/ai/CheckpointRecorder.ts` — co-located with the orchestrator, one file per responsibility (Phase-3 pattern).
- **D-3a-09 [loop-state rewind]:** Checkpoint captures the pre-tool loop state (toolResults list, plannerCalls, toolCalls, trajectory phase) keyed by `operationId`. Rollback = restore that state + discard the failed tool's result, then the failed tool is re-run once (AGT-04 interplay). **No side-effect compensation/inverse** — that is Phase 8 idempotency (TOL-05), explicitly out of scope for v0.1.
- **D-3a-10 [tier-derived trajectory cap]:** A hard trajectory-length ceiling derived from the tier caps (plannerCap + toolCap + slack, §1.4) force-terminates with a terminal reasonCode on exceed. Guards against pathological loops; deterministic and testable.
- **D-3a-11 [replan on failed tool only]:** A replan fires when a tool **execution** fails (`result.ok === false` with a retryable error). The loop re-invokes the planner **once** with the failure feedback appended — as an **F-4 sections-in `tool_result` section**, never a joined-string rebuild. Planner-side failures keep the existing `planner_failed` fallback (§1.2, no re-invocation). Replan is retry layer 2 of exactly three — never nested (R-2).
- **D-3a-12 [repeated-identical identity]:** "Repeated identical failure" = same `toolName` + same error `code` (e.g. `TOOL_REJECTED` twice, or same `{code, retryable}` tuple). After one replan, an identical failure is terminal ⇒ `verification_failed`/`partial`, never a silent success.
- **D-3a-13 [replan counts vs plannerCap]:** Each replan consumes one `plannerCalls++` slot; the tier's `plannerCap` (§1.4: tiny 1, small 2, medium 3, large 5) is the hard bound. At most one replan per failed tool; never nested.
- **D-3a-14 [render once at end]:** After a successful replan the loop continues and the final answer renders **once** at `finish()` — accumulated `toolResults` (including failure feedback) drive the renderer. Replan iterations are loop iterations, not concurrency (abort wins mid-verify/replan).
- **D-3a-15 [core seam only]:** 3a ships the trajectory `waiting-for-permission` state (already in the AGT-01 enum) + a **within-turn pause seam** in AgentOrchestrator (a stage may emit `input-required` → the turn pauses, surfaced as `waiting-for-permission` per §1.6.1-L2). **No UI, no gated tools** (3a has zero dangerous tools). Phase 8 ships the full barrier: PermissionDialog + ToolCapabilityManifest risk gating (TOL-02/03).
- **D-3a-16 [input-only seam]:** The pause seam is an optional input-only callback/signal on `runAgentTurn` (mirroring the `onStreamDelta` precedent) the hook can surface; the turn stays open, abort cancels it (abort wins mid-wait). Deterministic, testable via fixture.
- **D-3a-17 [evidence-aware renderer guard]:** Renderer receives the terminal verdict + verified evidence set; it renders honestly and never narrates a side-effecting tool as "done" without matching evidence. Orchestrator owns the terminal decision; renderer is display-only (D3).
- **D-3a-18 [return AgentTurnOutcome]:** `runAgentTurn` returns the C.1 `AgentTurnOutcome` (`{operationId, status, reasonCode, evidence, plannerCalls, toolCalls}`) — replacing the Phase-3 `AgentTurnOutput`. `streamedText` is already delivered via `onStreamDelta` → ChunkBuffer, so the output struct no longer carries it. **Documented D-20 fence inversion** (the Phase-3 addendum note at spec ~2657 is inverted by 3a).
- **D-3a-19 [honest partial mapping]:** The hook maps `AgentTurnOutcome.status` → `ChatStreamState`: `completed → completed`; `partial/failed → failed` (partial text retained + Retry); `aborted → idle`. No new UI surface in 3a (RICH stage indicators are Phase 7) — but the honest "partial = not completed" mapping is wired now.
- **D-3a-20 [types in harness.ts + Zod]:** `AgentTrajectoryState`, `AgentTurnOutcome`, and the extended `CompletionEvidence` live in `src/types/harness.ts` (extend lines 1-13 — the file header already declares 3a as the extension point; R-1). Zod-validated at the public boundary per GR-4 (fixtures exercise the schemas).

### the agent's Discretion
- Exact F-4 `tool_result` section shape for the replan feedback (researcher/planner picks the section kind/ordering consistent with 03-07's sections-in pattern).
- Trajectory transition events: whether the recorder emits via a callback/simple observer or is read after the turn — either is fine as long as transitions are observable to tests (C5: illegal transition throws `AGENT_STATE_INVALID`).
- Exact tier-derived trajectory-cap formula (plannerCap + toolCap + slack constant — pick a small deterministic slack).
- `verify:phase-3a` script shape — follow the §24 pattern (eslint + prettier + tsc + wxt build + vitest run + isolation check), targeting `tests/core/ai/trajectory/**` + `tests/core/ai/OutcomeVerifier.test.ts`.

### Deferred Ideas (OUT OF SCOPE)
- **AGT-05 commit-confirm barrier UI + permission gating** — Phase 8 (TOL-02/03, PermissionDialog, ToolCapabilityManifest risk). 3a ships only the `waiting-for-permission` trajectory state + input-only pause seam (D-3a-15/16).
- **Side-effect compensation / rollback idempotency** — Phase 8 (TOL-05 idempotency keys; O.5 worked example). 3a rollback is loop-state rewind only (D-3a-09).
- **Reliability telemetry counters / durable trace** — Phase 6 (AITransactionLog + DiagnosticsPanel; parallel to the AI-04 monthly-budget deferral D-16).
- **Trajectory/checkpoint persistence + cross-session suspend/resume** — v0.2+ (explicitly out of scope for v0.1, §17.7.7).
- **RICH stage indicators / trajectory UI** — Phase 7 (RICH-03); 3a surfaces only the honest partial mapping in the hook (D-3a-19).
</user_constraints>

## Summary

Phase 3a rewires the Phase-3 `runAgentTurn` loop (Appendix I verbatim, D-20) into a reliability machine: an in-memory **trajectory state machine** (AGT-01), a **deterministic OutcomeVerifier** producing **CompletionEvidence** (AGT-02), a structured **AgentTurnOutcome** where cap exhaustion is `partial` never `completed` (AGT-03), and a **bounded non-nested replan/terminal policy** (AGT-04). It ships a minimal **CheckpointRecorder** (one-step loop-state rollback, folded into AGT-02) and the **core seam** for a commit-confirm barrier (`waiting-for-permission` trajectory state + within-turn pause callback) — the full confirmation UI defers to Phase 8 (TOL-02/03).

This is a **spec-authoritative, zero-new-dependency phase**: every shape comes verbatim from PRODUCT_SPEC_v0_1.md Appendix C.1 (types), Appendix O.2 (worked OutcomeVerifier/buildOutcome reference), §28.2 (AGT-01..04 canonical text), §1.4 (tier caps), §1.6.1 (stage events + retry layers). The only genuine engineering is the **rewire**: `AgentTurnOutput` → `AgentTurnOutcome` (D-20 fence inversion), trajectory transitions inside the loop, replan-on-tool-failure with an F-4 `tool_result` prompt section, and the checkpoint restore/re-run-once dance. No new npm packages — pure in-repo TypeScript on the existing approved stack (zod 3.25.76 already pinned).

**Primary recommendation:** Implement O.2's `buildOutcome` **verbatim** as the OutcomeVerifier core, keep the orchestrator as the sole terminal-decision authority (D-3a-05), extend `PromptSection['kind']` with a non-cached `'tool_result'` member for replan feedback (D-3a-11 — this is a **required type extension the current code lacks**), and treat the three existing `AgentOrchestrator.test.ts`/budget-test assertion families as enumerated migration deltas (shape flip, D-20 fence inversion, reasonCode→status semantics), never blanket rewrites (O3).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trajectory state machine (AGT-01) | Core AI (orchestrator) | Types (`@/types/harness`) | Loop-embedded transitions; the state type is C.1 data, the transitions are direct calls in `runAgentTurn` — no event bus (L1: StageEvent is a TYPE only, spec ~400) |
| Evidence production (AGT-02) | Core AI (OutcomeVerifier) | Types (`@/types/harness`) | Deterministic postcondition checks over `ToolExecutionResult` — zero model calls (D-3a-03); evidence shape is C.1 |
| Rollback (CheckpointRecorder) | Core AI (orchestrator co-located) | — | Loop-state rewind (toolResults/plannerCalls/toolCalls/phase) keyed by operationId; no side-effect compensation (D-3a-09) |
| Terminal decision authority (AGT-03/04) | Core AI (orchestrator) | — | D-3a-05: orchestrator maps verdict + caps + abort + replan policy onto the 4-value status union; renderer is display-only |
| Replan feedback prompt assembly | Core AI (PlannerService input path) | Core AI (types: PromptSection) | F-4 sections-in: append a `tool_result` PromptSection (stable:false), never a joined-string rebuild (D-3a-11, cache-stability) |
| Honest partial mapping (D-3a-19) | Client (useStreamingLLM) | — | Hook maps `AgentTurnOutcome.status` → `ChatStreamState`; no new UI surface in 3a (RICH stage indicators are Phase 7) |
| Commit-confirm barrier | Core AI seam only | Phase 8 (UI) | 3a ships `waiting-for-permission` state + pause callback; PermissionDialog/ToolCapabilityManifest are Phase 8 (D-3a-15/16) |

**Why this map matters:** the two classic misassignments this phase prevents are (1) letting the **renderer** independently re-verify (D-3a-05 — renderer is display-only, never re-verifies), and (2) letting the **verifier** decide terminal status (verifier = verdict only `{ok, detail}`; the orchestrator owns `completed | verification_failed | waiting_for_permission | partial | aborted`).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGT-01 | Agent-level token budget bounds a single agent run (trajectory states transition correctly) | §28.2 AGT-01 (spec ~3926): 10-state `AgentTrajectoryPhase` enum + `AgentTrajectoryState` shape (C.1 ~4810-4821); D-3a-10 trajectory cap derived from §1.4 caps (TIER_CAPS verified in `AgentOrchestrator.ts` L47-52); C5 illegal transition throws `AGENT_STATE_INVALID` (C.2 ~5051) |
| AGT-02 | CheckpointRecorder enables one-step rollback; side-effecting success requires CompletionEvidence | Appendix O.2 (spec ~6358-6393) verbatim `buildOutcome`; `CompletionEvidence` C.1 (~4822-4829); CheckpointRecorder D-3a-08/09 (loop-state rewind, own module, no compensation); evidence field already typed on `ToolExecutionResult.evidence` (`ai/types.ts` L123) |
| AGT-03 | Structured AgentTurnOutcome; cap exhaustion = `partial`, never `completed` | C.1 `AgentTurnOutcome` (~4830-4837) `{operationId, status, reasonCode, evidence, plannerCalls, toolCalls}`; O.2 L6387-6391 `caps.capHit ? 'partial' : sideEffectFailed ? 'failed' : 'completed'` + reasonCode `cap_exhausted`; D-3a-07 |
| AGT-04 | Replan bounded by tier caps, never nested; abort works cleanly | §28.2 AGT-04 (~3929); §1.6.1 L3 (exactly three retry layers — replan is layer 2, never nested); D-3a-11/12/13 (tool-failure-only trigger, repeated-identical terminal, plannerCap-bound, one replan max); O4 abort wins mid-verify/replan |
| AGT-05 | Commit-confirm barrier before irreversible actions (RE-MAPPED to Phase 8 per D-3a-01) | 3a ships only the `waiting-for-permission` trajectory state (already in AGT-01 enum) + input-only pause seam (D-3a-15/16); full barrier = Phase 8 TOL-02/03. REQUIREMENTS.md row gets an AI-07-style re-map note; ROADMAP criterion #5 reduces to evidence/false-completion tests |

**Reconciliation (from CONTEXT G0):** CheckpointRecorder folds into AGT-02 (D-3a-02); AGT-05 re-maps to Phase 8 (D-3a-01). The five REQUIREMENTS.md rows stay, but AGT-02's description gains "CheckpointRecorder enables one-step rollback" and AGT-05's row gets the re-map note — REQUIREMENTS.md update is a task in this phase.
</phase_requirements>

## Standard Stack

### Core

This phase adds **zero new dependencies**. All machinery is in-repo TypeScript on the already-approved stack. The following existing packages are *touched* (not newly installed):

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 3.25.76 (pinned `^3.25.76`) | Zod schemas at the public boundary (GR-4): `AgentTrajectoryState`/`AgentTurnOutcome`/`CompletionEvidence` boundary schemas + fixtures | Already the approved stack (§7); `ai`@4 SDK peer-depends on zod 3 (npm ls verified 3.25.76 installed) |
| vitest | 4.1.10 | Test runner (threads pool, jsdom-align env) | Existing infra; all new tests run under it |
| typescript | 5.9.3 | strict typecheck | Existing `tsc --noEmit` in verify chain |

**Version verification (npm registry, 2026-08-11):**
```bash
npm view zod version            # → 4.4.3 (LATEST — do NOT upgrade; the project pins 3.25.76, ai@4 SDK peer-depends on zod 3)
npm ls zod                      # → 3.25.76 installed
```
**⚠️ zod 4 is out (4.4.3) but the project correctly stays on 3.25.76** — the @ai-sdk/* packages peer-dep on zod ^3.23.8. The 3a boundary schemas MUST use the zod 3 API (`z.discriminatedUnion`, `.safeParse`) — no zod-4-only APIs.

### Supporting (all existing, none new)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TraceRedactor (`@/core/security/TraceRedactor`) | in-repo | R-10: evidence/details may carry sensitive values — redact on any debugLog path | Every debugLog of evidence/replan-feedback; never log raw tool bodies |
| `debugLog` + `ERROR_CODES` (`@/core/error/`) | in-repo | Golden Rule 9 canonical codes | Every catch in 3a logs via debugLog with `AGENT_STATE_INVALID`/`TOOL_POSTCONDITION_FAILED`/`COMPLETION_EVIDENCE_MISSING` (canonicalized into spec C.2 already, lines ~5051-5053) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deterministic verifier (O.2) | LLM-as-verifier | Forbidden by D-3a-03: model calls would break the 2-call/healthy-turn cost truth and add a verifier tier cap |
| Direct trajectory transition calls | Event bus / emitter | L1 (spec ~400): StageEvent is a TYPE only — the coordinator calls stages directly. An event system is explicitly NOT shipped |
| In-memory checkpoint (loop-state rewind) | Durable checkpoint store / side-effect compensation | D-3a-09 + §17.7.7: no durable suspend/resume in v0.1; compensation is Phase 8 TOL-05 |

**Installation:** NONE. `pnpm install` is not required for this phase.

## Package Legitimacy Audit

> No new packages are installed in Phase 3a — the audit is run against the only external package the phase's code touches (zod), plus a sweep of anything the replan/pause seams might tempt a planner to add.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| zod | npm | ~7 yrs (published 2026-05-04 last release) | 254M/wk | github.com/colinhacks/zod | OK | Approved (already pinned 3.25.76) |
| xstate / @xstate/core (NOT adopted) | npm | — | — | — | n/a | REMOVED from consideration — trajectory state machine is 10 hand-rolled transitions in harness.ts + orchestrator; L1 forbids a runtime event engine; a statechart library would fight the direct-call design |
| automaton / other verifier libs | npm | — | — | — | n/a | REMOVED — O.2 verbatim is ~30 lines; a library is net-negative |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Packages discovered via non-authoritative sources:** none — this phase's entire stack is already installed and verified (`[VERIFIED: npm registry]` via `npm ls`/`npm view` + the approved-stack contract in AGENTS.md §7).

## Architecture Patterns

### System Architecture Diagram

```
                    ┌────────────────────────────────────────────────────┐
                    │              runAgentTurn (AgentOrchestrator)      │
                    │  Appendix-I bounded loop, REWIRED for 3a           │
                    │                                                    │
 userInput ───────▶ │  [assembling-context] ──┐                          │
                    │                          ▼                          │
                    │  [planning] ──▶ PlannerService.plan (F-4 sections) │
                    │      │  answer/ask_clarification                   │
                    │      ▼  run_tool                                   │
                    │  [executing] ──▶ CheckpointRecorder.capture        │
                    │      │          (pre-tool loop state, opId-keyed)  │
                    │      ▼                                            │
                    │  ExecutorService.execute ──▶ ToolExecutionResult   │
                    │      │ ok:true        │ ok:false + retryable       │
                    │      ▼                ▼                            │
                    │  [verifying]     [replanning]  ◀── planner re-invoked│
                    │  OutcomeVerifier  │   once with failure feedback    │
                    │  .verify(result)  │   (F-4 tool_result section)    │
                    │  → CompletionEvidence                              │
                    │      │                │ (repeated-identical →       │
                    │      ▼                │  terminal per D-3a-12)      │
                    │  loop continues ◀────┘                             │
                    │      │                                             │
                    │      ▼                                             │
                    │  [rendering] ──▶ RendererService.render             │
                    │      │   (receives verdict + verified evidence)    │
                    │      ▼                                             │
                    │  [completed|failed|partial|aborted]                │
                    │  buildOutcome → AgentTurnOutcome                   │
                    └────────────────────────────────────────────────────┘
                       │
                       ▼
              useStreamingLLM (hook): status → ChatStreamState mapping
              (completed→completed, partial/failed→failed, aborted→idle)
```

Key flow invariants (verified against O.2 + CONTEXT):
- **Entry:** userInput → context → `runAgentTurn({operationId, tier, abortSignal, onStreamDelta, invocation, onInputRequired?})`.
- **Loop:** `planning → executing → verifying → (replanning?) → rendering → terminal`.
- **Terminal authority:** only the orchestrator computes the 4-value status; OutcomeVerifier returns verdicts (`{ok, detail}`), renderer never re-verifies (D-3a-05).
- **Abort:** `AbortError` propagates from any stage; abort wins mid-verify/mid-replan (O4). Hook maps to `idle`.

### Recommended Project Structure (deltas only — Phase 3 already established the tree)

```
src/
├── types/harness.ts              # EXTEND: AgentTrajectoryPhase, AgentTrajectoryState,
│                                 #   AgentTurnOutcome, extended CompletionEvidence (D-3a-20)
├── core/ai/
│   ├── AgentOrchestrator.ts      # REWIRE: trajectory transitions, replan-on-tool-failure,
│   │                             #   checkpoint seam, buildOutcome call, pause seam
│   ├── OutcomeVerifier.ts        # NEW: O.2 verbatim — Verifier interface + buildOutcome
│   ├── CheckpointRecorder.ts     # NEW: D-3a-08 — opId-keyed pre-tool loop-state capture/restore
│   ├── types.ts                  # EXTEND: PromptSection['kind'] += 'tool_result'; PlanInput
│   │                             #   gains feedback sections (or context extension seam)
│   └── PlannerService.ts         # TOUCH: accept replan feedback sections (F-4) if PlanInput gains them
├── core/error/errorCodes.ts      # EXTEND IN PLACE: AGENT_STATE_INVALID, TOOL_POSTCONDITION_FAILED,
│                                 #   COMPLETION_EVIDENCE_MISSING (GR-9; already canonical in spec C.2)
└── components/pages/useStreamingLLM.ts  # UPDATE: read outcome.status (D-3a-19), drop streamedText read
```

### Pattern 1: Deterministic outcome building (O.2 verbatim — copy, do not re-derive)

**What:** `buildOutcome(operationId, results, verifiers, caps) → AgentTurnOutcome`. Verifiers run only over executed tool results; read-only tools (no verifier registered) are skipped; `caps.capHit` forces `partial`/`cap_exhausted`; any `!ok` evidence forces `failed`/`postcondition_failed`.
**When to use:** exactly at orchestrator `finish()` — the single point where a turn becomes terminal. Never call `buildOutcome` in the renderer or the hook.
**Example:**
```typescript
// Source: PRODUCT_SPEC_v0_1.md Appendix O.2 (lines 6362-6393) VERBATIM
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
**Note for determinism in tests:** O.2 uses `Date.now()` for `verifiedAt`. Test fixtures must either inject a clock or assert evidence fields excluding `verifiedAt` (or use `vi.setSystemTime`). The Phase-3 determinism rule (fixtures never use real `Date.now` — `tests/fixtures/index.ts` header) applies.

### Pattern 2: Trajectory state machine with legal-transition table (AGT-01, C5)

**What:** `AgentTrajectoryPhase` (10 states, C.1) + `AgentTrajectoryState {operationId, phase, plannerCalls, toolCalls, updatedAt}`. Transitions are **direct calls** in the orchestrator loop; a legal-transition table is the single definition; an illegal transition throws `AGENT_STATE_INVALID`.
**When to use:** the orchestrator emits a transition at each loop stage boundary; the recorder (either a callback passed into `runAgentTurn` or an in-memory per-turn log read after the turn — agent's discretion) makes transitions observable to tests.
**Recommended legal transitions (from the loop shape):**

```
assembling-context → planning
planning → executing | rendering (answer/ask_clarification) | waiting-for-permission (pause seam)
executing → verifying (tool ran) | replanning (tool failed retryable)
verifying → planning (loop continues) | rendering (terminal finish)
replanning → executing (re-run once) | rendering (terminal: repeated-identical)
waiting-for-permission → planning (resumed) | aborted (abort wins)
rendering → completed | failed | partial | aborted   (terminal — no outgoing)
```

**Example (shape — the exact table lives in harness.ts or a co-located `trajectory.ts`):**
```typescript
// Source: C.1 verbatim states + D-3a-06 C5 decision (transition table = derived design)
import type { AgentTrajectoryPhase } from '@/types/harness';

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
  if (!LEGAL[from].includes(to)) {
    throw new Error(`AGENT_STATE_INVALID: ${from} -> ${to}`); // canonical code, GR-9
  }
}
```
**Note:** `partial`/`failed`/`completed`/`aborted` are terminal *outcome statuses* — the trajectory may stop at `rendering` and produce the status; whether the state machine carries terminal phases to `completed`/`failed`/`aborted` is the C5 detail the planner fixes (both readings are consistent with C.1; pick one and assert it).

### Pattern 3: Checkpoint → rollback → re-run-once (D-3a-09, AGT-04 interplay)

**What:** Before each tool execution, capture `{toolResults: [...], plannerCalls, toolCalls, phase}` keyed by `operationId`. On a retryable tool failure, restore the captured state (discarding the failed result), append failure feedback to the planner input, re-invoke the planner once, and let the loop re-run the tool. This is retry layer 2 of exactly three (L3).
**When to use:** only for tool **execution** failures with `error.retryable === true`; never for planner failures (those keep the `planner_failed` fallback, D-3a-11).
**Example (shape):**
```typescript
// Source: D-3a-08/09/11 (decisions) — CheckpointRecorder API sketch
export class CheckpointRecorder {
  private readonly state = new Map<string, LoopState>();
  capture(operationId: string, state: LoopState): void { this.state.set(operationId, { ...state }); }
  restore(operationId: string): LoopState | undefined {
    const s = this.state.get(operationId);
    return s ? { ...s } : undefined;
  }
}
// Orchestrator:
//   checkpoint.capture(opId, { toolResults: [...toolResults], plannerCalls, toolCalls, phase });
//   const result = await ExecutorService.execute({...});
//   if (!result.ok && result.error?.retryable && !replannedThisTool) {
//     const restored = checkpoint.restore(opId);        // discard failed result
//     toolResults = restored.toolResults; plannerCalls = restored.plannerCalls;
//     replannedThisTool = true;                          // D-3a-12 identity guard
//     decision = await planOnce(input, withToolResultFeedback(result)); // plannerCalls++
//   }
```

### Anti-Patterns to Avoid
- **Renderer re-verifying:** renderer must not independently check evidence and change status — it is display-only (D-3a-05). The renderer guard is: never narrate a tool as "done" without a matching `ok:true` evidence entry in the verified set it receives.
- **Nested replan:** a replan that itself triggers another replan (e.g., replan on a planner failure, or a replan inside a replan's tool failure) violates L3/R-2. Guard: one `replannedThisTool` flag per tool; planner failures never replan.
- **Durable checkpoint:** persisting trajectory/evidence/checkpoints across sessions — §17.7.7 forbids it; in-memory per-turn only (C4).
- **Replan feedback via string join:** rebuilding the planner prompt as a concatenated string breaks F-4 cache-stability — must append a `PromptSection` (kind `tool_result`, `stable: false`).
- **Silent cap completion:** letting `planner_cap_reached`/`tool_cap_reached` map to `completed` — AGT-03/D-3a-07 mandates `partial` + `cap_exhausted`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Outcome/evidence computation | A custom status calculator in the orchestrator | `OutcomeVerifier.buildOutcome` (O.2 verbatim) | The spec ships the worked implementation; hand-deriving it invites the exact AGT-03 bug (cap = completed) it forbids |
| Zod boundary schemas | Ad-hoc `as` casts on `AgentTurnOutcome` | Zod schemas + fixtures (GR-4) | Every public boundary is Zod-validated with one repair; fixtures exercise the schemas (D-3a-20) |
| Replan prompt feedback | String concatenation of failure text | F-4 `PromptSection` append (kind `tool_result`, `stable: false`) | Cache-stability: the cached [SYSTEM] stays byte-identical; a joined-string rebuild breaks the prompt-cache hash (Phase-3 proven invariant) |
| Trajectory event delivery | An event bus / emitter / observer framework | Direct calls + optional callback or post-turn read | L1: StageEvent is a TYPE only — a runtime event system is explicitly not shipped (spec ~400) |
| State machine library | xstate or similar | 10-state hand-rolled transition table | The enum + legal-transition table is ~40 lines; a statechart engine fights the direct-call design and adds a banned-class dependency risk |

**Key insight:** this phase's hardest problems are already solved **in the spec** (O.2 verbatim, C.1 shapes, §1.4 caps, §1.6.1 L3 layering). The real engineering risk is not "how to build X" but "which of the Phase-3 contracts to migrate and how" — the D-20 fence inversion (O3) and the status/reasonCode semantics are where time goes.

## Runtime State Inventory

> Phase 3a is a rewire of the Phase-3 `runAgentTurn` contract (AgentTurnOutput → AgentTurnOutcome) plus new reliability machinery. It touches runtime-consumed state in exactly one place (the hook's state mapping). All 5 categories answered explicitly per the protocol.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — trajectory, evidence, and checkpoints are within-turn, in-memory only (C4, §17.7.7). No IndexedDB/chrome.storage keys change. `np_persona`/`np_providers.*` untouched. | None |
| Live service config | **None** — no external services, no MCP, no provider config changes. ProviderRegistry/ProviderRouter unchanged (read-only usage). | None |
| OS-registered state | **None** — no systemd/pm2/launchd/WXT entrypoint changes; content scripts and background SW untouched (R-3). | None |
| Secrets/env vars | **None** — no env var names change. Evidence `detail` may carry sensitive values but is never persisted and is redacted on any debugLog path (R-10 via TraceRedactor). | None (code-level: redact before logging) |
| Build artifacts | **None** — no package renames; no egg-info/wxt-dist staleness concerns; zod stays 3.25.76. | None |

**Nothing found in category:** verified explicitly above for all 5 categories — Phase 3a has zero runtime-state migration surface; it is a pure code-contract change plus new modules.

## Common Pitfalls

### Pitfall 1: The D-20 source-invariant test inverts (and breaks CI if forgotten)
**What goes wrong:** `tests/core/ai/AgentOrchestrator.test.ts` L358-362 asserts the orchestrator source "carries zero evidence-machinery tokens" (`not.toMatch(/CompletionEvidence|OutcomeVerifier|trajectory/)`). Phase 3a's whole point is adding trajectory transitions + buildOutcome calls to that file — this test **must be inverted/removed**, or `vitest run` fails the moment the orchestrator is touched.
**Why it happens:** the D-20 fence was a Phase-3 guard against building reliability early ("never jump ahead"); 3a is the phase that was being fenced off.
**How to avoid:** enumerate the test migration explicitly in the plan (O3): flip this assertion to assert the orchestrator DOES use trajectory/evidence machinery (or drop it in favor of the new behavior tests). Do not let it silently rot.
**Warning signs:** orchestrator rewire lands, `verify:phase-3a` fails on the D-20 assertion.

### Pitfall 2: `PromptSection['kind']` has no `tool_result` member today
**What goes wrong:** D-3a-11 requires replan feedback as an F-4 sections-in `tool_result` section, but the current union is `'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input'` (`src/core/ai/types.ts` L131) and `CACHED_KINDS`/`TASK_KINDS` in `ProviderRouter.ts` (L65-73) + `StructuredOutput.ts` (L41) filter on those exact members. A `tool_result` section would be silently dropped by `joinSections` (which only maps CACHED_KINDS → system / TASK_KINDS → prompt).
**Why it happens:** the kind union was designed for §1.3 prompt sections; tool feedback is new in 3a.
**How to avoid:** (a) extend `PromptSection['kind']` with `'tool_result'`; (b) add `'tool_result'` to the **non-cached** set — it must NOT go into `CACHED_KINDS` (it's per-turn, `stable: false`, never cache-eligible); (c) decide whether it maps to provider `prompt` (add to `TASK_KINDS` in BOTH `ProviderRouter.ts` and `StructuredOutput.ts` — two copies exist!) or is handled as an orchestrator-append-only section the Router passes through. **Recommended:** add to TASK_KINDS in both files so it reaches the model as `prompt` content; `stable:false` keeps it out of `hashStableSections` (prompt-cache safe).
**Warning signs:** replan test asserts failure feedback reached the planner but the mocked planner never saw it — the section was filtered out.

### Pitfall 3: Cap exhaustion leaking to `completed` (AGT-03 regression)
**What goes wrong:** the Phase-3 loop returns `planner_cap_reached`/`tool_cap_reached` reasonCodes and the hook maps anything-not-provider_unconfigured to `completed`. Under 3a, `caps.capHit` must yield `status: 'partial'`, `reasonCode: 'cap_exhausted'` (O.2 verbatim), and the hook must surface `partial` as **failed** (partial text + Retry), never completed.
**Why it happens:** the existing hook's binary completed/not-completed logic (`useStreamingLLM.ts` L165-169) predates the 4-value status union.
**How to avoid:** centralize the status mapping in the hook exactly per D-3a-19; test `partial` explicitly with a cap-exhausted fixture.
**Warning signs:** a budget test asserts `completed` for a cap-exhausted turn.

### Pitfall 4: Nested retries / replan explosion (R-2)
**What goes wrong:** replan-on-tool-failure inside a retry layer, or replan on planner failure, or a replan whose re-run fails again and replans again — multiplying retries into N×N×N fan-out.
**Why it happens:** the three retry layers (router / replan / per-stage) look similar and a naive loop treats them as stackable.
**How to avoid:** exactly one replan per failed tool (D-3a-11/13: `plannerCalls++` bounded by `plannerCap`), repeated-identical failure (same toolName + same error code) is terminal (D-3a-12), planner failures keep the `planner_failed` fallback (never replan), and the trajectory cap (D-3a-10) force-terminates pathological loops.
**Warning signs:** a test with a persistently failing tool exceeds `plannerCap` planner calls.

### Pitfall 5: Renderer narrating unverified tool success (R-8 / AGT-02)
**What goes wrong:** the renderer describes a side-effecting tool as "done" without matching `ok:true` CompletionEvidence — exactly the false-completion the phase exists to kill.
**Why it happens:** renderer output is generated from `toolResults` alone today; evidence is a new input it must respect (D-3a-17).
**How to avoid:** pass the terminal verdict + verified evidence set into `render()`; the renderer must not claim execution without a matching evidence entry; the orchestrator remains the single verifier of truth.
**Warning signs:** a false-completion test (spec §18 DONE-when) renders "tool completed" with an empty evidence set.

### Pitfall 6: Non-deterministic tests from `Date.now()`/crypto
**What goes wrong:** O.2's `verifiedAt: Date.now()` and any `updatedAt` timestamps make equality assertions flaky; fixtures must never use real `Date.now` (determinism rule, `tests/fixtures/index.ts`).
**Why it happens:** the O.2 reference is verbatim and includes `Date.now()`.
**How to avoid:** inject a clock into `buildOutcome`/trajectory recorder (default `() => Date.now()`), or `vi.setSystemTime` in tests, or assert evidence fields excluding timestamps.
**Warning signs:** tests fail intermittently on `verifiedAt` mismatch.

### Pitfall 7: Replan feedback losing cache-stability (F-4 regression)
**What goes wrong:** if replan feedback is built as a joined string (e.g., `context.sections.map(s => s.text).join('\n') + toolResultText`), the cached [SYSTEM] byte-stability invariant breaks and the anthropic prompt cache misses.
**Why it happens:** F-4 sections-in is a Phase-3-discovered invariant that a quick "append some text" implementation violates.
**How to avoid:** always append a `PromptSection` object; never rebuild the sections array as text; reuse `contextHelper`'s section-building pattern.
**Warning signs:** a prompt-cache hash test fails after replan.

## Code Examples

Verified patterns from official sources (spec + verified in-product code):

### C.1 Canonical types (verbatim — copy into `src/types/harness.ts`)
```typescript
// Source: PRODUCT_SPEC_v0_1.md Appendix C.1 (lines 4809-4837)
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
**Important reconciliation (D-3a-05 vs C.1):** the orchestrator's decision vocabulary is `completed | verification_failed | waiting_for_permission | partial | aborted`, but the C.1 `AgentTurnOutcome.status` union is only `'completed' | 'partial' | 'failed' | 'aborted'`. The planner MUST decide the mapping — recommended: `verification_failed → status 'failed'` with `reasonCode 'verification_failed'`; `waiting_for_permission` is a *trajectory phase*, not a terminal outcome status (the turn pauses, it doesn't end). This is a genuine spec-surface gap the plan must resolve explicitly (listed in Open Questions).

### ExecutorService tool-failure shape (the replan trigger + identity)
```typescript
// Source: src/core/ai/ExecutorService.ts (L34-44, verified in-product) + ai/types.ts L118-125
// ToolExecutionResult.error = { code: string; message: string; retryable: boolean }
// Replan fires when: !result.ok && result.error?.retryable === true   (D-3a-11)
// Repeated-identical identity: same toolName + same error.code         (D-3a-12)
// TOOL_REJECTED is the Phase-3 canonical code — rejections carry retryable: false
// (so TOOL_REJECTED itself does NOT trigger replan; a retryable code does).
```

### §1.4 tier caps (the replan + trajectory-cap budget source)
```typescript
// Source: src/core/ai/AgentOrchestrator.ts L47-52 (verified in-product, spec §1.4)
const TIER_CAPS = {
  tiny:   { plannerCap: 1, toolCap: 1, mcpChaining: false },
  small:  { plannerCap: 2, toolCap: 1, mcpChaining: false },
  medium: { plannerCap: 3, toolCap: 2, mcpChaining: true },
  large:  { plannerCap: 5, toolCap: 3, mcpChaining: true },
};
// Replan budget (D-3a-13): each replan consumes plannerCalls++; plannerCap is the hard bound.
// Trajectory cap (D-3a-10): plannerCap + toolCap + slack (recommended slack: 1).
```

### Hook status mapping (D-3a-19)
```typescript
// Source: D-3a-19 + existing useStreamingLLM.ts state machine (L55-60, verified)
// ChatStreamState = idle | streaming | completed | failed | offline (each carrying operationId)
// outcome.status: 'completed' → completed
//                 'partial' | 'failed' → failed (partial text retained + Retry)
//                 'aborted' → idle
// 'provider_unconfigured' remains a failed terminal (reasonCode check stays; D-3a-19 does
// not change the provider-unconfigured UX).
```

### Error-code canonicalization (GR-9, in-place extension)
```typescript
// Source: spec Appendix C.2 harness block (L5051-5053) — ALREADY canonical in the spec;
// mirror into src/core/error/errorCodes.ts IN PLACE (D-3a-06, 03a-CONTEXT canonical refs)
// AGENT_STATE_INVALID         → trajectory illegal transition (C5)
// TOOL_POSTCONDITION_FAILED   → verifier throws / verdict !ok (fail-closed, D-3a-06)
// COMPLETION_EVIDENCE_MISSING → side-effecting tool ran with no evidence (D-3a-06)
```

### Pause seam (D-3a-16, mirrors the onStreamDelta precedent)
```typescript
// Source: D-3a-15/16 + AgentOrchestrator.ts AgentTurnInput (L68-79, verified — the
// onStreamDelta pattern this mirrors)
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
// StageEvent 'input-required' union member: spec C.1 lines 4999-5007 (TYPE only, L1).
// The turn stays open while waiting; abort cancels it (abort wins mid-wait).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AgentTurnOutput {operationId, streamedText, toolResults, reasonCode}` (Phase 3, D-20) | `AgentTurnOutcome {operationId, status, reasonCode, evidence, plannerCalls, toolCalls}` (C.1) | Phase 3a (this phase) | Hook reads `status`; streamedText travels only via `onStreamDelta`; toolResults no longer in the output struct |
| Loop reasonCodes `planner_cap_reached`/`tool_cap_reached` (Phase 3) | `status: 'partial'` + `reasonCode: 'cap_exhausted'` (O.2 verbatim, AGT-03) | Phase 3a | Cap exhaustion is honest non-completion; hook surfaces it as failed |
| Zero reliability machinery in orchestrator (D-20 fence) | Trajectory transitions + OutcomeVerifier + CheckpointRecorder + replan policy in orchestrator | Phase 3a | The D-20 source-invariant test inverts; AGT-01..04 realized |
| Side-effecting tool "done" = execution returned ok | "done" requires matching `ok:true` CompletionEvidence (AGT-02, R-8) | Phase 3a | Renderer can never narrate unverified success |
| No retry on tool failure (loop just continues) | Exactly one replan per failed tool, bounded by plannerCap, repeated-identical is terminal (AGT-04) | Phase 3a | Deterministic retry/terminal policy; no silent success |

**Deprecated/outdated:**
- **`AgentTurnOutput`**: replaced by `AgentTurnOutcome` (D-3a-18). Any Phase-3 test asserting its shape must migrate (O3 enumeration).
- **The D-20 fence comment** (spec addendum ~2657): inverted by 3a — the orchestrator now owns the reliability machinery.
- **`streamedText` in the output struct**: no longer carried; `onStreamDelta` is the only text channel.

## Assumptions Log

> All claims in this research were verified against the spec (in-product read) or the codebase (in-repo read), or are explicitly marked `[ASSUMED]` below. The phase is spec-authoritative, so the assumption surface is small.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `verification_failed` maps to `AgentTurnOutcome.status: 'failed'` (C.1 union has no `verification_failed` member) | Code Examples / Open Questions | Planner picks a different mapping (e.g., extends the union) — plan must state it explicitly; low risk, both are defensible |
| A2 | Replan feedback `tool_result` section belongs in `TASK_KINDS` (provider `prompt` side) in BOTH `ProviderRouter.ts` and `StructuredOutput.ts` | Common Pitfalls #2 | If it lands only in one file, the other silently drops the section; if it lands in CACHED_KINDS, cache-stability breaks |
| A3 | Trajectory cap formula = `plannerCap + toolCap + 1` (slack constant 1) | Architecture Patterns / Code Examples | D-3a-10 leaves the slack to discretion; any small deterministic slack is fine — pick one and test it |
| A4 | `TOOL_REJECTED` from ExecutorService carries `retryable: false`, so it does not trigger replan (only genuinely retryable codes do) | Code Examples | If a future tool returns a retryable rejection, the replan policy triggers — fine; the D-3a-12 identity still bounds it |
| A5 | zod 3.25.76 API surface (not zod 4) is used for the new boundary schemas | Standard Stack | If a planner uses a zod-4-only API, `tsc --noEmit`/tests fail against the pinned version — low risk, caught by verify |

**If this table is empty:** n/a — 5 assumptions flagged; all are small, plan-level decisions with safe defaults, none require user confirmation beyond the planner choosing the documented option.

## Open Questions

1. **C.1 status union vs D-3a-05 decision vocabulary — how does `verification_failed` surface?**
   - What we know: D-3a-05 says the orchestrator decides `completed | verification_failed | waiting_for_permission | partial | aborted`; C.1 `AgentTurnOutcome.status` is only `'completed' | 'partial' | 'failed' | 'aborted'`.
   - What's unclear: whether `verification_failed` maps to `status:'failed'` + `reasonCode:'verification_failed'` (recommended, keeps C.1 verbatim) or the outcome status union is extended.
   - Recommendation: keep C.1 verbatim; `verification_failed → status 'failed'`, `reasonCode 'verification_failed'`; `waiting_for_permission` is a trajectory phase (the turn pauses), never a terminal outcome. State this in the plan.

2. **Where do the new boundary Zod schemas live?** (`AgentTrajectoryState`/`AgentTurnOutcome`/`CompletionEvidence`)
   - What we know: D-3a-20 says types in `harness.ts` + Zod at the public boundary (GR-4).
   - What's unclear: a co-located `harness.schema.ts` vs schemas inline in `harness.ts` vs in the test fixtures only.
   - Recommendation: co-locate boundary schemas with the types (single `harness.ts` or a sibling `harnessSchemas.ts`), exercised by `tests/fixtures/` Zod fixture tests — consistent with `ProviderConfigSchema` co-located in `ai/types.ts` (Phase-3 precedent).

3. **How does the renderer receive the evidence set?** (`RenderInput` extension)
   - What we know: D-3a-17 — renderer receives terminal verdict + verified evidence; today `RenderInput` has only `toolResults` (`RendererService.ts` L40-54).
   - What's unclear: add `evidence: CompletionEvidence[]` + `verdict` to `RenderInput`, or pass the whole `AgentTurnOutcome` before it's built.
   - Recommendation: extend `RenderInput` with the verdict + evidence set (renderer stays a pure consumer; it never re-verifies).

4. **Trajectory transition observability — callback or post-turn read?**
   - What we know: agent's discretion (C5) — either is fine as long as transitions are observable to tests; the Phase-3 precedent is the `onStreamDelta` input-only callback (D-20).
   - What's unclear: callback (`onTransition?`) vs a per-turn in-memory log object the tests read after `runAgentTurn` resolves.
   - Recommendation: the callback (mirrors the proven `onStreamDelta` seam, keeps the orchestrator side-effect-free) — but post-turn read is equally valid; pick one in the plan.

## Environment Availability

> Step 2.6 executed. Phase 3a is a pure in-repo TypeScript change (no external tools/services/runtimes beyond the existing toolchain). Probes run on 2026-08-11.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build/test toolchain | ✓ | v24.18.1 | — |
| pnpm | package manager (wxt + vitest) | ✓ | 11.18.0 | npm 12.0.2 |
| wxt | extension build (`wxt build` in verify chain) | ✓ | 0.19.29 | — |
| typescript | `tsc --noEmit` | ✓ | 5.9.3 | — |
| vitest | test runner (threads pool, jsdom-align) | ✓ | 4.1.10 | — |
| zod | boundary schemas | ✓ | 3.25.76 (pinned) | — |
| eslint / prettier | verify chain | ✓ | (installed) | — |

**Missing dependencies with no fallback:** none — the entire toolchain is present and version-verified.
**Missing dependencies with fallback:** none.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in .planning/config.json — section required. The phase is heavily test-specified (§18 requires `tests/core/ai/trajectory/**` + `tests/core/ai/OutcomeVerifier.test.ts`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (pool: threads, environment: jsdom-align wrapper, setupFiles: tests/setup.ts) |
| Config file | vitest.config.ts (existing, no changes needed) |
| Quick run command | `npx vitest run tests/core/ai/OutcomeVerifier.test.ts tests/core/ai/trajectory` |
| Full suite command | `vitest run` (inside `pnpm run verify:phase-3a`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGT-01 | Trajectory states transition legally; illegal transition throws `AGENT_STATE_INVALID`; trajectory cap force-terminates | unit | `npx vitest run tests/core/ai/trajectory` | ❌ Wave 0 (new) |
| AGT-01 | Healthy turn transitions correctly (assembling→planning→rendering→completed) and stays at 2 model calls | unit | `npx vitest run tests/core/ai/trajectory` | ❌ Wave 0 |
| AGT-02 | Side-effecting tool (mock dangerous) with matching evidence → completed; absent evidence → `verification_failed`/`failed` | unit | `npx vitest run tests/core/ai/OutcomeVerifier.test.ts` | ❌ Wave 0 |
| AGT-02 | CheckpointRecorder captures/restores pre-tool loop state; rollback discards failed result | unit | `npx vitest run tests/core/ai/trajectory` | ❌ Wave 0 |
| AGT-03 | Cap exhaustion → `status:'partial'`, `reasonCode:'cap_exhausted'`, never `completed` (pure-answer turn → `completed`, `evidence: []`) | unit | `npx vitest run tests/core/ai/OutcomeVerifier.test.ts` | ❌ Wave 0 |
| AGT-03 | Hook maps partial/failed → failed ChatStreamState; aborted → idle (D-3a-19) | unit (component) | `npx vitest run tests/components` | ❌ Wave 0 (or extended in existing useStreamingLLM test if present) |
| AGT-04 | Replan fires once on retryable tool failure; repeated-identical failure terminal; never nested; plannerCalls stays under plannerCap | unit | `npx vitest run tests/core/ai/trajectory` | ❌ Wave 0 |
| AGT-04 | Abort mid-verify/mid-replan wins (AbortError propagates) | unit | `npx vitest run tests/core/ai/trajectory` | ❌ Wave 0 |
| AGT-05 (seam) | `waiting-for-permission` phase reachable via pause seam; abort cancels the wait | unit | `npx vitest run tests/core/ai/trajectory` | ❌ Wave 0 |
| (regression) | D-20 fence test inverted; AgentTurnOutput→AgentTurnOutcome shape assertions migrated in existing suites | unit | `npx vitest run tests/core/ai/AgentOrchestrator.test.ts tests/core/ai/AgentOrchestrator.budget.test.ts` | ✅ exists — MUST be migrated (O3), not blanket-rewritten |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/ai/OutcomeVerifier.test.ts tests/core/ai/trajectory -x`
- **Per wave merge:** `vitest run`
- **Phase gate:** `pnpm run verify:phase-3a` green (full suite + eslint + prettier + tsc + wxt build + isolation check) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/ai/OutcomeVerifier.test.ts` — new §18-required file (AGT-02/03)
- [ ] `tests/core/ai/trajectory/` — new §18-required directory (AGT-01/02/04/05-seam)
- [ ] `tests/fixtures/` additions — mock dangerous tool + synthetic evidence + transition-assertion helper + Zod boundary-schema fixtures (O1, D-3a-20)
- [ ] `AgentOrchestrator.test.ts` migration — AgentTurnOutput→AgentTurnOutcome shape flip, D-20 fence inversion (O3)
- [ ] `AgentOrchestrator.budget.test.ts` migration — reasonCode/status semantic updates (O3)
- [ ] `verify:phase-3a` script in package.json (§24 pattern) — eslint + prettier --check + tsc --noEmit + wxt build + vitest run + isolation check
- [ ] Existing suite green after rewire — full `tests/core/ai/**` + `tests/components/**` must pass (regression gate)

## Security Domain

> `security_enforcement: true` in .planning/config.json — section required. ASVS Level 1 baseline.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth surface in 3a) |
| V3 Session Management | no | — (no sessions; within-turn in-memory state only) |
| V4 Access Control | yes (partial) | The evidence gate is an authorization control on *side-effect completion claims*: only evidence-backed "done" is authorized (R-8). Fail-closed (D-3a-06). |
| V5 Input Validation | yes | Zod boundary schemas for `AgentTurnOutcome`/`AgentTrajectoryState`/`CompletionEvidence` at the public boundary (GR-4, D-3a-20) — mirrors the `ProviderConfigSchema` precedent (V5 in Phase 3) |
| V6 Cryptography | no | — (no new crypto; rollback is loop-state rewind, not compensated writes — no key material) |

### Known Threat Patterns for the reliability stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| False completion (tool reported done without evidence) | Spoofing | Deterministic OutcomeVerifier (zero model calls, no prompt to trick) + orchestrator sole terminal authority + renderer never re-verifies (D-3a-05/17) |
| Evidence spoofing via verifier manipulation | Tampering | Verifier is pure postcondition code keyed by `postconditionId`; no LLM path to produce evidence (D-3a-03) |
| Cap-bypass (run beyond budget) | DoS | §1.4 tier caps enforced in the loop + trajectory cap force-terminates (D-3a-10); replan bounded by plannerCap (D-3a-13) |
| Prompt-cache poisoning via replan feedback | Tampering | F-4 sections-in: `tool_result` section is `stable:false`, never enters `CACHED_KINDS`/`hashStableSections` (Pitfall #2/#7) |
| Sensitive data in evidence/details | Information Disclosure | TraceRedactor on every debugLog path (R-10); evidence is in-memory per-turn, never persisted (C4); `detail` redacted before logging |
| Prompt injection via tool output in replan feedback | Tampering | The `tool_result` section is appended from `ExecutorService`'s typed `error` object (code/message), not raw model text; tool output trust-tagging is Phase 4b (TRUST-01) — keep feedback content minimal (code + sanitized message) |

## Sources

### Primary (HIGH confidence)
- `.planning/PRODUCT_SPEC_v0_1.md` — Appendix O.2 (L6358-6393) OutcomeVerifier/buildOutcome verbatim; Appendix C.1 (L4790-4837) canonical types + type-home table; §28.2 (L3924-3929) AGT-01..04; §18 Phase 3a block (L2666-2674) + Phase-3 addendum (L2653-2664, the D-20 fence 3a inverts); §1.4 tier caps; §1.6.1 (L398-409) stage events + retry layers; Appendix C.2 (L5032-5060) harness error codes; §17.7.7 durable suspend out-of-scope. [VERIFIED: in-product read]
- `03a-CONTEXT.md` — 20 locked decisions (D-3a-01..20), scope authority (G0), canonical refs. [VERIFIED: in-product read]
- `src/core/ai/AgentOrchestrator.ts` — Appendix-I loop, TIER_CAPS, AgentTurnInput/Output shapes. [VERIFIED: in-repo read]
- `src/core/ai/ExecutorService.ts` + `src/core/ai/types.ts` — ToolExecutionResult/error shape, PromptSection kind union. [VERIFIED: in-repo read]
- `src/core/ai/ProviderRouter.ts` (L60-88) + `src/core/ai/StructuredOutput.ts` (L41, L120-147) — CACHED_KINDS/TASK_KINDS section-kind mapping (Pitfall #2). [VERIFIED: in-repo read]
- `src/types/harness.ts` — current 13-line file, header declares 3a extension point. [VERIFIED: in-repo read]
- `tests/core/ai/AgentOrchestrator.test.ts` + `.budget.test.ts` — D-20 fence test + shape assertions to migrate. [VERIFIED: in-repo read]

### Secondary (MEDIUM confidence)
- npm registry via `npm view zod version` / `npm ls zod` — zod 4.4.3 latest vs project pin 3.25.76. [VERIFIED: npm registry]
- `package.json` scripts + `vitest.config.ts` — verify chain + test env. [VERIFIED: in-repo read]

### Tertiary (LOW confidence)
- State-machine / transition-table design patterns — standard software-engineering knowledge, not fetched this session (all web providers disabled in config). [ASSUMED]
- zod 3.25 vs 4 API differences for the boundary schemas. [ASSUMED — mitigated by using only the zod-3 API surface already used in the repo (`z.discriminatedUnion`, `.safeParse`)].

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; every referenced package verified in-repo or on the registry
- Architecture: HIGH — O.2/C.1/§1.4/§1.6.1 read verbatim from the spec; the rewire targets read in-repo; the 4 open questions are plan-level picks with safe defaults
- Pitfalls: HIGH for Pitfalls 1-2 (verified in-repo: the D-20 test and the missing `tool_result` kind both exist); MEDIUM for the behavioral pitfalls (derived from the spec/decisions, standard for the domain)

**Research date:** 2026-08-11
**Valid until:** 2026-08-18 (7 days — the codebase is fast-moving; the D-20 fence and kind union could shift if earlier phases amend)
