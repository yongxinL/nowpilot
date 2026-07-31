# Phase 3a: Agent Reliability & Evidence - Research

**Researched:** 2026-07-31
**Domain:** Agent reliability engineering — finite state machine trajectory tracking, evidence-backed tool completion, structured outcome contracts, deterministic replanning policy
**Confidence:** HIGH

## Summary

Phase 3a is a core reliability upgrade to the existing `AgentOrchestrator.runTurn()` pipeline. It wraps the proven planner loop with a typed trajectory state machine, replaces the `Promise<string>` return type with a comprehensive `AgentTurnOutcome` contract, introduces an `OutcomeVerifier` service for evidence-backed side-effect completion, and locks in a deterministic `ReplanPolicy`. No UI changes, no new external dependencies — this is purely an architectural strengthening of the existing `src/core/ai/` module.

The existing codebase provides a solid foundation: `AgentOrchestrator.runTurn()` (lines 84-197) implements the planner loop, `PlannerService.plan()` handles dual-mode structured output, `ExecutorService.execute()` validates and times tool execution, and `RendererService.synthesize()` produces final answers. Phase 3a wraps this loop rather than replacing it, injecting trajectory state transitions at each pipeline stage, building outcome records at every exit path, and adding evidence verification after tool execution. The `PipelineError` taxonomy stays unchanged; `ReplanPolicy` is a separate pure function consumed by the orchestrator.

**Primary recommendation:** Implement the trajectory state machine as a lightweight `AgentTrajectoryMachine` class with a readonly `ALLOWED_TRANSITIONS` lookup table, accumulating immutable `TrajectoryStateEntry[]` records. Build `OutcomeVerifier` as an independently testable service. Keep `ReplanPolicy` as a pure function. Add the `runTurnText()` compatibility wrapper to avoid breaking existing consumers during migration. All new modules follow the established codebase pattern: module-level singletons, Zod v4 validation, core module isolation from `src/components/`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trajectory state machine | API / Backend | — | `AgentOrchestrator` owns the state machine internally; no browser/client involvement |
| Evidence-backed completion | API / Backend | — | `OutcomeVerifier` runs post-tool-execution in the orchestrator; evidence is pure data |
| Structured outcome assembly | API / Backend | — | `AgentTurnOutcome` is built at every exit path by the orchestrator |
| Deterministic replanning | API / Backend | — | `ReplanPolicy` is a pure function invoked by the orchestrator; no UI state |
| Idempotency enforcement | API / Backend | — | `ExecutorService` maintains an in-memory operation-scoped ledger |
| Rendering policy enforcement | API / Backend | — | `RendererService` consumes `RenderingOutcomePolicy`; policy is derived by orchestrator |
| Abort signal handling | API / Backend | — | Existing `AbortSignal` contract propagates through the pipeline |

All capabilities live in the API / Backend tier (the extension's core layer). No Browser / Client, Frontend Server, CDN, or Database tier involvement.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `AgentOrchestrator.runTurn()` returns `AgentTurnOutcome` as the canonical API. `runTurnText()` is a deprecated compatibility wrapper.
- **D-02:** `AgentTurnOutcome` is comprehensive with 12+ fields covering terminal state, trajectory, evidence, tool results, limits, abort metadata, usage, diagnostics, and timing.
- **D-03:** Hybrid trajectory state machine — internal state machine with immutable accumulation and an optional `onTrajectoryTransition` fire-and-forget callback.
- **D-04:** Strict transition map (`ALLOWED_TRANSITIONS`) validates every state change via explicit allowlist. Terminal states have empty allowlists.
- **D-05:** `AgentTurnReasonCode` is a closed, outcome-oriented set. Technical errors remain in diagnostics.
- **D-06:** Explicit abort handling — check `AbortSignal` before/after each stage, abort transitions to `aborted` (never `failed`), stops new stages, skips rendering/verification.
- **D-07:** `TrajectoryStateEntry` records state, enteredAt, exitedAt, durationMs, optional reasonCode/plannerCall/toolCall/toolName.
- **D-08:** `RegisteredTool` extends with `sideEffect`, `evidence` (ToolEvidencePolicy), `idempotency`. Full `ToolCapabilityManifest` is Phase 8a.
- **D-09:** `CompletionEvidence` is a discriminated union: `VerifiedCompletionEvidence` and `UnverifiedCompletionEvidence`.
- **D-10:** Dedicated `OutcomeVerifier` service in `src/core/ai/verifier/`, independently testable.
- **D-11:** `AgentOrchestrator` builds `RenderingOutcomePolicy` from `CompletionEvidence` before calling `RendererService`. Renderer never decides evidence sufficiency.
- **D-12:** `ReplanPolicy` is a separate, pure, independently testable function — independent of `PipelineError`.
- **D-13:** `sideEffect: 'irreversible'` blocks replanning — classified in tool manifest, not inferred.
- **D-14:** `ReplanDisposition` is `continue-planning` | `replan` | `render` | `terminate`.
- **D-15:** One replan = one additional `PlannerService` call within the same turn. ContextOptimizer does NOT re-run. Counters do NOT reset. `replanCount` increments once.
- **D-16:** Phase 3a adds only evidence-essential fields to `RegisteredTool`. Full manifest is Phase 8a.
- **D-17:** Idempotency enforced for `idempotency: 'required'` tools via operation-scoped in-memory ledger. Cross-turn durability is Phase 8a.

### the agent's Discretion

No areas were deferred — all 17 gray areas had explicit decisions from the user.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGT-01 | Explicit trajectory states with validated transitions | §Trajectory State Machine design; ALLOWED_TRANSITIONS map; TrajectoryStateEntry contract |
| AGT-02 | Evidence-backed completion — side-effecting tools require verified CompletionEvidence; RendererService must not claim writes without matching evidence | §OutcomeVerifier design; §CompletionEvidence discriminated union; §RenderingOutcomePolicy |
| AGT-03 | Structured AgentTurnOutcome on every exit path; cap exhaustion is partial not completed; abort does not render success | §AgentTurnOutcome contract; §Exit Path Analysis |
| AGT-04 | Deterministic replanning policy — success→verify→render, retryable→one replan, permission/auth→terminal; no retry after irreversible | §ReplanPolicy design; §ReplanDisposition enum |
| TOL-03 | Postcondition verification — side-effecting tools declare a verifier; unverified transport = partial, not completed | §OutcomeVerifier design; §ToolEvidencePolicy; verifier type routing |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.8.2 (strict) | Type system, discriminated unions, `satisfies` for transition map validation | Already in project; discriminated unions are the natural fit for `CompletionEvidence` and `AgentTurnOutcome` |
| Zod | ^4.4.3 | Schema validation for new types (`AgentTurnOutcome`, `CompletionEvidence`, `ReplanDisposition`, state transitions) | Already in project; used extensively with `z.discriminatedUnion()` and `z.strictObject()` patterns |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^3.2.7 | Unit and integration tests for new modules | Already in project; use for all trajectory machine, outcome verifier, and replan policy tests |

**No new external dependencies required.** Phase 3a is a pure TypeScript implementation using the existing project stack.

**Installation:**
```bash
# No new packages to install — all dependencies already in package.json
```

## Package Legitimacy Audit

> **No new packages are installed by this phase.** All work uses the existing project dependencies (TypeScript, Zod, vitest). The new modules (`AgentTrajectoryMachine.ts`, `OutcomeVerifier.ts`, `ReplanPolicy.ts`) are pure TypeScript using standard library features and existing Zod schemas.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                          AgentTurnInput
                               │
                               ▼
              ┌────────────────────────────────────┐
              │      AgentOrchestrator.runTurn()    │
              │                                    │
              │  ┌──────────────────────────────┐  │
              │  │  AgentTrajectoryMachine      │  │
              │  │  (FSM + immutable history)   │  │
              │  └──────────────────────────────┘  │
              │                                    │
              │  assembling-context                 │
              │       │                             │
              │       ▼                             │
              │  ContextOptimizer.optimize()        │
              │       │                             │
              │  planning                           │
              │       │                             │
              │       ▼                             │
              │  PlannerService.plan()              │
              │       │                             │
              │       ├── answer ──────────────────►│
              │       ├── ask_clarification ───────►│
              │       └── run_tool                  │
              │              │                      │
              │  executing   │                      │
              │       │      │                      │
              │       ▼      ▼                      │
              │  ExecutorService.execute()          │
              │  (idempotency ledger check)         │
              │       │                             │
              │  verifying                          │
              │       │                             │
              │       ▼                             │
              │  OutcomeVerifier.verify()           │
              │       │                             │
              │       ├── verified ─────► rendering │
              │       └── unverified───► ReplanPolicy│
              │                             │       │
              │  replanning ◄───────────────┘       │
              │       │                             │
              │       ▼                             │
              │  PlannerService.plan() (recovery)   │
              │       │                             │
              │  rendering                          │
              │       │                             │
              │       ▼                             │
              │  RendererService.synthesize()       │
              │  (with RenderingOutcomePolicy)      │
              │       │                             │
              │  completed / failed / aborted       │
              │       │                             │
              │       ▼                             │
              │  AgentTurnOutcome                   │
              └────────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────────┐
              │  onTrajectoryTransition (optional)  │
              │  → Phase 6 AITransactionLog        │
              │  → Phase 7 Stage Indicators        │
              └────────────────────────────────────┘
```

### Recommended Project Structure

```
src/core/ai/
├── AgentOrchestrator.ts        # Refactored: FSM-wrapped runTurn(), runTurnText()
├── AgentTrajectoryMachine.ts   # NEW: FSM + ALLOWED_TRANSITIONS + history
├── AgentTurnOutcome.ts         # NEW: Outcome type, factory, Zod schemas
├── AgentTurnInput.ts           # Modified: add onTrajectoryTransition callback
├── OutcomeVerifier.ts          # NEW: Postcondition verification service
├── verifier/                   # NEW directory
│   ├── OutcomeVerifier.ts      # Main verifier service
│   ├── SchemaVerifier.ts       # Schema-based postcondition checks
│   ├── EnvironmentVerifier.ts  # Environment state checks
│   └── VerifierTypes.ts        # Verifier type definitions
├── ReplanPolicy.ts             # NEW: Pure function for replan decisions
├── PlannerService.ts           # Modified: accept replan context in plan()
├── ExecutorService.ts          # Modified: idempotency ledger, evidence fields
├── RendererService.ts          # Modified: RenderingOutcomePolicy parameter
├── PipelineError.ts            # UNCHANGED
├── types.ts                    # Modified: new types added
├── TierResolver.ts             # UNCHANGED
├── ChunkBuffer.ts              # UNCHANGED
├── StructuredOutput.ts         # UNCHANGED
├── StreamAdapter.ts            # UNCHANGED
└── providers/                  # UNCHANGED
```

### Pattern 1: Finite State Machine with Immutable History

**What:** A lightweight class wrapping a `Map<AgentTrajectoryState, Set<AgentTrajectoryState>>` transition allowlist. Each call to `transitionTo(nextState, metadata)` validates against the allowlist, records the exit time of the previous state, pushes an immutable `TrajectoryStateEntry` to the history array, and fires `onTransition` callback if provided. Terminal states reject all further transitions.

**When to use:** At every pipeline stage boundary in `AgentOrchestrator.runTurn()`. The FSM is owned by the orchestrator instance (operation-scoped, not module-level singleton).

**Example:**
```typescript
// Source: Standard TypeScript FSM pattern [VERIFIED: codebase analysis]
// AgentTrajectoryMachine.ts

export type AgentTrajectoryState =
  | 'assembling-context'
  | 'planning'
  | 'waiting-for-permission'
  | 'executing'
  | 'verifying'
  | 'replanning'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'aborted';

const TERMINAL_STATES: Set<AgentTrajectoryState> = new Set([
  'completed', 'failed', 'aborted',
]);

// D-04: Strict transition allowlist — every valid transition is explicit
export const ALLOWED_TRANSITIONS: Record<AgentTrajectoryState, Set<AgentTrajectoryState>> = {
  'assembling-context':    new Set(['planning', 'failed', 'aborted']),
  'planning':              new Set(['waiting-for-permission', 'executing', 'rendering', 'failed', 'aborted']),
  'waiting-for-permission': new Set(['executing', 'rendering', 'failed', 'aborted']),
  'executing':             new Set(['verifying', 'replanning', 'rendering', 'failed', 'aborted']),
  'verifying':             new Set(['replanning', 'rendering', 'failed', 'aborted']),
  'replanning':            new Set(['planning', 'rendering', 'failed', 'aborted']),
  'rendering':             new Set(['completed', 'failed', 'aborted']),
  'completed':             new Set(),
  'failed':                new Set(),
  'aborted':               new Set(),
};

export interface TrajectoryStateEntry {
  readonly state: AgentTrajectoryState;
  readonly enteredAt: number;
  readonly exitedAt: number | null;  // null until next transition
  readonly durationMs: number | null; // null until next transition
  readonly reasonCode?: string;
  readonly plannerCall?: number;
  readonly toolCall?: number;
  readonly toolName?: string;
}

export class AgentTrajectoryMachine {
  private _current: AgentTrajectoryState;
  private _history: TrajectoryStateEntry[] = [];
  private _currentEntry: TrajectoryStateEntry;

  constructor(
    initial: AgentTrajectoryState = 'assembling-context',
    private readonly onTransition?: (entry: TrajectoryStateEntry) => void,
  ) {
    this._current = initial;
    this._currentEntry = {
      state: initial,
      enteredAt: Date.now(),
      exitedAt: null,
      durationMs: null,
    };
  }

  get current(): AgentTrajectoryState {
    return this._current;
  }

  get history(): readonly TrajectoryStateEntry[] {
    return this._history;
  }

  get isTerminal(): boolean {
    return TERMINAL_STATES.has(this._current);
  }

  transitionTo(
    next: AgentTrajectoryState,
    metadata?: Partial<Omit<TrajectoryStateEntry, 'state' | 'enteredAt' | 'exitedAt' | 'durationMs'>>,
  ): void {
    if (this.isTerminal) {
      throw new Error(`AGENT_STATE_INVALID: Cannot transition from terminal state '${this._current}'`);
    }

    const allowed = ALLOWED_TRANSITIONS[this._current];
    if (!allowed.has(next)) {
      throw new Error(
        `AGENT_STATE_INVALID: Cannot transition from '${this._current}' to '${next}'`
      );
    }

    const now = Date.now();
    // Close current entry
    this._currentEntry.exitedAt = now;
    this._currentEntry.durationMs = now - this._currentEntry.enteredAt;
    this._history.push({ ...this._currentEntry });

    // Open new entry
    this._current = next;
    this._currentEntry = {
      state: next,
      enteredAt: now,
      exitedAt: null,
      durationMs: null,
      ...metadata,
    };

    // D-03: Fire-and-forget callback — consumer failure does not affect turn
    if (this.onTransition) {
      try {
        this.onTransition(this._history[this._history.length - 1]);
      } catch {
        // Swallow — D-03: callback must not cause turn failure
      }
    }
  }

  /**
   * Called when the turn ends. Finalises the current state entry
   * (exit time + duration) and returns the complete history including
   * the final resolved entry.
   */
  finalize(): TrajectoryStateEntry[] {
    const now = Date.now();
    this._currentEntry.exitedAt = now;
    this._currentEntry.durationMs = now - this._currentEntry.enteredAt;
    return [...this._history, { ...this._currentEntry }];
  }
}
```

### Pattern 2: Discriminated Union with Zod v4

**What:** Use TypeScript's discriminated union pattern with Zod v4 `z.discriminatedUnion()` for `CompletionEvidence`. The `verified` boolean field is the discriminator. `VerifiedCompletionEvidence` carries verifier type, checks, and result reference. `UnverifiedCompletionEvidence` carries failure reason and retryability.

**When to use:** Everywhere a type has clearly distinct variants with a shared discriminator field.

**Example:**
```typescript
// Source: Zod v4 discriminated union pattern [VERIFIED: codebase analysis — already used in PlannerDecisionSchema]

export interface CompletionEvidenceCheck {
  name: string;
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
  message?: string;
}

export interface VerifiedCompletionEvidence {
  verified: true;
  verifierType: 'schema' | 'environment' | 'read-after-write' | 'tool-provided';
  checks: CompletionEvidenceCheck[];
  resultRef?: string;  // CompletionResultRef for cross-referencing
}

export interface UnverifiedCompletionEvidence {
  verified: false;
  failureReason:
    | 'postcondition_failed'
    | 'evidence_unavailable'
    | 'verification_timeout'
    | 'verification_error'
    | 'aborted';
  retryable: boolean;
}

export type CompletionEvidence = VerifiedCompletionEvidence | UnverifiedCompletionEvidence;

// Zod schemas
const CompletionEvidenceCheckSchema = z.strictObject({
  name: z.string(),
  passed: z.boolean(),
  actual: z.unknown().optional(),
  expected: z.unknown().optional(),
  message: z.string().optional(),
});

export const CompletionEvidenceSchema = z.discriminatedUnion('verified', [
  z.strictObject({
    verified: z.literal(true),
    verifierType: z.enum(['schema', 'environment', 'read-after-write', 'tool-provided']),
    checks: z.array(CompletionEvidenceCheckSchema),
    resultRef: z.string().optional(),
  }),
  z.strictObject({
    verified: z.literal(false),
    failureReason: z.enum([
      'postcondition_failed',
      'evidence_unavailable',
      'verification_timeout',
      'verification_error',
      'aborted',
    ]),
    retryable: z.boolean(),
  }),
]);
```

### Pattern 3: Idempotency Ledger (In-Memory, Operation-Scoped)

**What:** A `Map<string, { status, result, evidence }>` inside `ExecutorService` keyed by a stable operation key derived from `operationId + toolName + serialized(input)`. Before executing a tool with `idempotency: 'required'`, check the ledger. If completed with `status: 'completed'`, return cached result + evidence. If `in-flight` or `failed` with unknown final state, do NOT re-execute.

**When to use:** Inside `ExecutorService.execute()`, before calling `tool.execute()`.

**Example:**
```typescript
// Source: Standard idempotency pattern [CITED: industry standard — Stripe, AWS idempotency key patterns]

interface IdempotencyEntry {
  status: 'in-flight' | 'completed' | 'failed';
  result?: unknown;
  evidence?: CompletionEvidence;
  executedAt: number;
}

export class ExecutorService {
  // D-17: Operation-scoped, in-memory — resets on SW restart (Phase 8a adds durability)
  private idempotencyLedger: Map<string, IdempotencyEntry> = new Map();

  private deriveOperationKey(
    operationId: string,
    toolName: string,
    input: unknown,
  ): string {
    const serialized = JSON.stringify(input, Object.keys(input as object).sort());
    // Simple concatenation for stable key — cryptographic hash not needed (in-memory only)
    return `${operationId}:${toolName}:${serialized}`;
  }

  async execute(
    toolName: string,
    input: unknown,
    registeredTools: RegisteredTool[],
    signal?: AbortSignal,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    operationId?: string,  // NEW: for idempotency
  ): Promise<ToolExecutionResult> {
    validateToolName(toolName, registeredTools);
    const tool = validateToolInput(toolName, input, registeredTools);

    // D-17: Idempotency gate for tools with idempotency: 'required'
    if (tool.idempotency === 'required' && operationId) {
      const key = this.deriveOperationKey(operationId, toolName, input);
      const existing = this.idempotencyLedger.get(key);
      if (existing) {
        if (existing.status === 'completed') {
          // Return prior validated result and evidence
          return {
            toolName,
            output: existing.result,
            durationMs: 0,
            evidence: existing.evidence,
          } as ToolExecutionResult;
        }
        // in-flight or failed with unknown state — do NOT re-execute
        throw new PipelineError(
          'IDEMPOTENCY_CONFLICT',
          `Tool "${toolName}" has an in-flight or unresolved prior execution.`,
          { toolName, operationId, key },
        );
      }

      // Mark as in-flight before execution
      this.idempotencyLedger.set(key, {
        status: 'in-flight',
        executedAt: Date.now(),
      });
    }

    // Existing execution logic...
    const startTime = performance.now();
    try {
      const output = await Promise.race([
        tool.execute(input, signal),
        timeout(timeoutMs),
      ]);
      const durationMs = performance.now() - startTime;
      const result = { toolName, output, durationMs };

      // Update ledger to completed (evidence populated later by OutcomeVerifier)
      if (tool.idempotency === 'required' && operationId) {
        const key = this.deriveOperationKey(operationId, toolName, input);
        this.idempotencyLedger.set(key, {
          status: 'completed',
          result: output,
          executedAt: Date.now(),
        });
      }

      return result;
    } catch (err) {
      // Mark as failed
      if (tool.idempotency === 'required' && operationId) {
        const key = this.deriveOperationKey(operationId, toolName, input);
        this.idempotencyLedger.set(key, {
          status: 'failed',
          executedAt: Date.now(),
        });
      }
      throw err;
    }
  }
}
```

### Pattern 4: Abort-Aware Pipeline Stages

**What:** Before each awaited pipeline stage, call `signal?.throwIfAborted()`. Catch `AbortError` from sub-services and normalize to a unified abort finaliser. The abort path skips rendering, verification, and returns `terminalState: 'aborted'` with abort metadata.

**When to use:** At every pipeline stage boundary in `AgentOrchestrator.runTurn()`.

**Example:**
```typescript
// Source: Standard AbortController API [VERIFIED: MDN AbortSignal docs]

// Inside AgentOrchestrator.runTurn():
async runTurn(input: AgentTurnInput): Promise<AgentTurnOutcome> {
  const { abortSignal: signal } = input;
  const machine = new AgentTrajectoryMachine('assembling-context', input.onTrajectoryTransition);

  try {
    // Stage: assembling-context
    signal?.throwIfAborted();
    const optimized = await contextOptimizer.optimize(buildOptimizerInput(input));

    // Stage: planning
    signal?.throwIfAborted();
    machine.transitionTo('planning');

    // ... planner loop ...

  } catch (error) {
    // D-06: Abort normalisation — AbortError → aborted, never failed
    if (isAbortError(error) || signal?.aborted) {
      return buildAbortedOutcome(machine, signal, input);
    }
    return buildFailedOutcome(machine, error, input);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function buildAbortedOutcome(
  machine: AgentTrajectoryMachine,
  signal?: AbortSignal,
  input?: AgentTurnInput,
): AgentTurnOutcome {
  // D-06: Transition to aborted, NOT failed
  if (!machine.isTerminal) {
    machine.transitionTo('aborted', {
      reasonCode: 'user_aborted',
    });
  }
  return {
    operationId: input?.operationId ?? '',
    terminalState: 'aborted',
    reasonCode: 'user_aborted',
    renderedAnswer: null,  // D-03: abort does not render a success answer
    trajectory: machine.finalize(),
    evidence: [],
    toolResults: [],
    limits: { /* ... */ },
    abort: {
      requested: true,
      requestedAt: Date.now(),
      stage: machine.current,
    },
    usage: { /* ... */ },
    diagnostics: { errors: [], warnings: [] },
    startedAt: /* ... */,
    endedAt: Date.now(),
    durationMs: /* ... */,
  };
}
```

### Pattern 5: ReplanPolicy as Pure Function

**What:** `ReplanPolicy` is a standalone pure function `(context: ReplanContext) => ReplanDisposition`. It is independently unit-testable — no mocks, no side effects. Called at two checkpoints: after tool execution fails, and after outcome verification completes.

**When to use:** Invoked by `AgentOrchestrator` at the two decision points (post-execute, post-verify).

**Example:**
```typescript
// Source: D-12/D-13/D-14/D-15 design decisions from CONTEXT.md [CITED: CONTEXT.md]

export type ReplanDisposition = 'continue-planning' | 'replan' | 'render' | 'terminate';

export interface ReplanContext {
  lastTool: {
    toolName: string;
    sideEffect: 'none' | 'read' | 'write' | 'irreversible';
    success: boolean;
  };
  evidence?: CompletionEvidence;
  error?: PipelineError;
  caps: {
    plannerCalls: number;
    plannerCap: number;
    plannerCapReached: boolean;
  };
  replanCount: number;
  isAborted: boolean;
}

export function evaluateReplan(context: ReplanContext): ReplanDisposition {
  // D-06: Abort terminates immediately
  if (context.isAborted) return 'terminate';

  // D-13: Irreversible tool blocks all replanning
  if (context.lastTool.sideEffect === 'irreversible') {
    return 'terminate';
  }

  // Tool succeeded → continue the loop
  if (context.lastTool.success) {
    return 'continue-planning';
  }

  // Tool failed: check if replan is available
  // D-15: One replan only — replanCount increments once
  if (context.replanCount > 0) {
    // Already replanned once — go to rendering with partial results
    return 'render';
  }

  // Check error retryability for replan eligibility
  if (context.error) {
    // D-14: retryable errors get one replan
    if (context.error.retryable) {
      return 'replan';
    }
    // Terminal errors → render with caveats
    if (context.error.category === 'terminal') {
      return 'render';
    }
  }

  // D-14: Schema/permission/auth errors are terminal
  if (context.error?.code === 'SCHEMA_INVALID' ||
      context.error?.code === 'NO_SUCH_TOOL' ||
      context.error?.code === 'INVALID_TOOL_INPUT') {
    return 'render';
  }

  // D-15: Planner cap reached → render, not replan
  if (context.caps.plannerCapReached) {
    return 'render';
  }

  // Default: render with partial results
  return 'render';
}
```

### Anti-Patterns to Avoid

- **Mutating trajectory history in place:** trajectory entries are readonly. Always push new entries; never modify existing ones. This preserves audit trail integrity for Phase 6 AITransactionLog.
- **Catching AbortError and treating as failure:** D-06 requires abort transitions to `aborted` (never `failed`). Conflating the two breaks Phase 7 cancellation UX.
- **RendererService independently deciding evidence sufficiency:** D-11 mandates the orchestrator is the gatekeeper. Renderer must render from `RenderingOutcomePolicy`, never inspect raw evidence.
- **Calling ContextOptimizer during replanning:** D-15 states ContextOptimizer does NOT re-run on replan. The optimized context from the initial call is reused.
- **Throwing from trajectory callbacks:** D-03 requires onTrajectoryTransition to be fire-and-forget. Wrap in try/catch and swallow.
- **Persisting idempotency ledger:** D-17 states idempotency is in-memory, operation-scoped only. Phase 8a adds cross-turn durability. Do not add persistence now.
- **Using `z.object({}).strict()` — Zod v4 migration:** The project already uses `z.strictObject()` (Zod v4 API). Do NOT use the deprecated `z.object().strict()` pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finite state machine | Custom transition logic with if/else chains | `AgentTrajectoryMachine` class with `ALLOWED_TRANSITIONS` lookup | The transition map is the runtime contract — if/else chains are fragile, non-exhaustive, and hide invalid paths |
| Discriminated union validation | Manual type guards for each variant | `z.discriminatedUnion('verified', [...])` | Zod v4 already supports this; manual guards risk desynchronisation from the type definition |
| Abort signal propagation | Manual AbortError checking in each pipeline stage | `signal?.throwIfAborted()` at standardized checkpoints | AbortSignal is a built-in Web API; the standard method throws the correct error type |
| Idempotency key derivation | Custom hash functions | Concatenation of `operationId:toolName:serialized(input)` | In-memory only — no crypto needed. JSON.stringify with sorted keys is deterministic |
| Tool result replay detection | Checking output equality | Operation-scoped ledger Map with status tracking | Equality checks are fragile (objects, dates). Status tracking is explicit and testable |

**Key insight:** This phase is about tightening the agent harness, not expanding it. Every new component (FSM, verifier, replan policy) is a constraint layer that limits what the existing pipeline can do. Build these as enforcement mechanisms, not as additional capabilities.

## Runtime State Inventory

> This phase is NOT a rename/refactor/migration phase. No runtime state changes are needed. New modules add state types but do not migrate existing data. The `runTurn()` return type change from `Promise<string>` to `Promise<AgentTurnOutcome>` is a compile-time contract change, not a runtime data migration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — new types are operation-scoped only | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

## Common Pitfalls

### Pitfall 1: Breaking Existing Consumers with Return Type Change

**What goes wrong:** `agentOrchestrator.runTurn()` currently returns `Promise<string>`. Changing to `Promise<AgentTurnOutcome>` without a compatibility adapter breaks every caller that destructures the string result.

**Why it happens:** The orchestrator is called from UI components (chat handlers, command dispatchers). Those callers expect `string` and may not be updated immediately.

**How to avoid:** Provide `runTurnText()` as a deprecated compatibility wrapper that calls `runTurn()` and returns `outcome.renderedAnswer ?? dispatchError(outcome.diagnostics.errors[0])`. Mark with `@deprecated` JSDoc. Existing callers use `runTurnText()` until their consuming phases complete (Phase 7).

**Warning signs:** TypeScript compilation errors in `src/components/` or `src/hooks/` after changing the return type.

### Pitfall 2: Idempotency Key Collisions

**What goes wrong:** Two different operations with different inputs produce the same idempotency key, causing false duplicate detection and skipped executions.

**Why it happens:** The key derivation (`JSON.stringify` with sorted keys) is deterministic but can produce collisions if `operationId` is reused across turns.

**How to avoid:** The `operationId` is a fresh `crypto.randomUUID()` for each turn (per `createAgentTurnInput()`), guaranteeing uniqueness. The key namespace is `operationId:toolName:serializedInput`. Since `operationId` is per-turn unique, collisions are cryptographically infeasible. Add a test verifying that two different inputs produce different keys.

**Warning signs:** Tools silently not executing when they should. Check the idempotency ledger map size vs expected executions.

### Pitfall 3: Trajectory State Leakage Across Turns

**What goes wrong:** The trajectory machine's state and history persist across multiple `runTurn()` calls on the same orchestrator singleton, mixing trajectory entries from different turns.

**Why it happens:** `AgentOrchestrator` is a module-level singleton. If the FSM is stored as an instance property that isn't reset, subsequent calls accumulate entries from previous calls.

**How to avoid:** Create a fresh `AgentTrajectoryMachine` instance at the start of each `runTurn()` call — do NOT store it as an orchestrator property. The FSM is operation-scoped, not orchestrator-scoped. The pattern: `const machine = new AgentTrajectoryMachine(...)` at the top of `runTurn()`.

**Warning signs:** Trajectory entries with disjoint operationIds appearing in the same outcome. Timeline entries with timestamps from different turns.

### Pitfall 4: Abort During Planner Loop Causing Partial State

**What goes wrong:** An abort arrives mid-planner-loop (between `plannerService.plan()` and `executorService.execute()`). The loop exits but the FSM is left in `planning` or `executing` without a clean terminal transition.

**Why it happens:** The existing `while (stepCount < caps.planner)` loop catches errors at the top level but doesn't check the signal between the plan call and the tool execution.

**How to avoid:** Check `signal?.throwIfAborted()` after every await point in the loop. Specifically: after `plannerService.plan()`, after the `switch` dispatch, after `executorService.execute()`. This matches D-06: "check before and after each awaited pipeline stage."

**Warning signs:** Trajectory history ends with a non-terminal state. `isTerminal` is `false` after `runTurn()` returns.

### Pitfall 5: Verified Evidence vs. Rendering Policy Desynchronisation

**What goes wrong:** `CompletionEvidence` says `verified: false` but `RenderingOutcomePolicy` derived by the orchestrator allows the renderer to claim write success. Or vice versa: evidence is verified but the policy blocks rendering.

**Why it happens:** The derivation of `RenderingOutcomePolicy` from `CompletionEvidence` is the orchestrator's responsibility (D-11). If the derivation logic is buggy, the policy and evidence diverge.

**How to avoid:** The derivation is a pure function from `CompletionEvidence[]` to `RenderingOutcomePolicy[].` Test it exhaustively:
- All verified evidence → policy allows evidence-constrained rendering
- Any unverified write evidence → policy blocks write-success claims
- Mix of verified reads + unverified writes → policy allows reads, blocks write claims
- Empty evidence → policy allows generic rendering without claims

**Warning signs:** Renderer output claims "I saved the note" but `CompletionEvidence` shows `verified: false`.

## Code Examples

### Complete AgentTurnOutcome Type

```typescript
// Source: D-02 design decision [CITED: CONTEXT.md §D-02]
export type AgentTerminalState = 'completed' | 'partial' | 'failed' | 'aborted';

export interface AgentTurnOutcome {
  readonly operationId: string;
  readonly terminalState: AgentTerminalState;
  readonly reasonCode: AgentTurnReasonCode;
  readonly renderedAnswer: string | null;
  readonly trajectory: readonly TrajectoryStateEntry[];
  readonly evidence: readonly CompletionEvidence[];
  readonly toolResults: readonly ToolExecutionResult[];
  readonly limits: {
    readonly plannerCalls: number;
    readonly plannerCap: number;
    readonly plannerCapReached: boolean;
    readonly toolCalls: number;
    readonly toolCap: number;
    readonly toolCapReached: boolean;
  };
  readonly abort: {
    readonly requested: boolean;
    readonly requestedAt: number | null;
    readonly stage: AgentTrajectoryState | null;
  };
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
    readonly estimatedCost: number;
    readonly currency: string;
  };
  readonly diagnostics: {
    readonly errors: readonly PipelineError[];
    readonly warnings: readonly string[];
  };
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationMs: number;
}

export type AgentTurnReasonCode =
  | 'direct_answer'
  | 'planner_terminated'
  | 'clarification_requested'
  | 'user_declined'
  | 'planner_cap_exhausted'
  | 'tool_cap_exhausted'
  | 'permission_terminated'
  | 'verification_failed'
  | 'pipeline_failure'
  | 'user_aborted';
```

### RegisteredTool Extension (Phase 3a Fields)

```typescript
// Source: D-08/D-16 design decisions [CITED: CONTEXT.md]
export type ToolSideEffect = 'none' | 'read' | 'write' | 'irreversible';
export type ToolIdempotency = 'not-required' | 'supported' | 'required';

export interface ToolEvidencePolicy {
  required: boolean;
  verifier?: 'schema' | 'environment' | 'read-after-write' | 'tool-provided';
}

export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
  // Phase 3a extensions (D-08, D-16):
  sideEffect?: ToolSideEffect;          // default: 'none'
  evidence?: ToolEvidencePolicy;        // default: { required: false }
  idempotency?: ToolIdempotency;        // default: 'not-required'
}
```

### ToolExecutionResult Extension

```typescript
// Source: Evidence-aware tool execution [CITED: CONTEXT.md §D-09]
export interface ToolExecutionResult {
  toolName: string;
  output: unknown;
  durationMs: number;
  // Phase 3a extension:
  toolCallId?: string;
  evidence?: CompletionEvidence;        // populated after OutcomeVerifier
}
```

### RenderingOutcomePolicy

```typescript
// Source: D-11 design decision [CITED: CONTEXT.md]
export interface RenderingOutcomePolicy {
  readonly canClaimWriteSuccess: boolean;
  readonly verifiedTools: readonly string[];
  readonly unverifiedTools: readonly string[];
  readonly evidenceSummary: string;  // Injected into renderer system prompt
}

export function buildRenderingOutcomePolicy(
  evidence: readonly CompletionEvidence[],
): RenderingOutcomePolicy {
  const verified = evidence.filter((e): e is VerifiedCompletionEvidence => e.verified);
  const unverified = evidence.filter((e): e is UnverifiedCompletionEvidence => !e.verified);

  // D-11: Renderer must not claim writes without matching verified evidence
  const canClaimWriteSuccess = verified.length > 0 && unverified.length === 0;

  const verifiedTools = verified.map(e => e.verifierType);
  const unverifiedTools = unverified.map(e => e.failureReason);

  const evidenceSummary = canClaimWriteSuccess
    ? `All ${verified.length} tool result(s) verified. You may reference verified results.`
    : `${unverified.length} tool result(s) could not be verified. Do not claim that write operations succeeded. Acknowledge the limitation.`;

  return { canClaimWriteSuccess, verifiedTools, unverifiedTools, evidenceSummary };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `runTurn()` returns `Promise<string>` | Returns `Promise<AgentTurnOutcome>` | Phase 3a | All consumers must migrate; `runTurnText()` provides backward compatibility |
| No trajectory tracking | `AgentTrajectoryMachine` with immutable history | Phase 3a | Enables Phase 6 transaction log and Phase 7 stage indicators |
| Tool execution returns raw output only | Returns `ToolExecutionResult` with optional `evidence` field | Phase 3a | Enables OutcomeVerifier postcondition checking |
| Renderer decides answer content freely | Renderer constrained by `RenderingOutcomePolicy` | Phase 3a | Prevents model hallucination from claiming unverified write success |
| No replanning — tool failure = error return | `ReplanPolicy` enables one bounded recovery call | Phase 3a | Improves reliability without sacrificing safety |
| `RegisteredTool` has 4 fields | Extended with `sideEffect`, `evidence`, `idempotency` | Phase 3a / 8a | Phase 3a fields are forward-compatible with Phase 8a `ToolCapabilityManifest` |

**Deprecated/outdated:**
- `runTurn()` returning `string` — deprecated in favor of `runTurnText()` compatibility wrapper. New code should consume `AgentTurnOutcome` directly.
- Raw error strings as answers — replaced by `AgentTurnOutcome.diagnostics.errors` with structured `PipelineError` objects.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All existing `AgentOrchestrator.runTurn()` callers are internal to the project and can be migrated to `runTurnText()` | Common Pitfalls #1 | **Low** — the project is in active development and all consumers are known. The `@deprecated` JSDoc + TypeScript compilation will surface every caller. |
| A2 | The `operationId` (from `crypto.randomUUID()`) provides sufficient uniqueness for the idempotency key namespace | Common Pitfalls #2 | **Low** — UUIDv4 collision probability is astronomically low. The key namespace includes toolName and serialized input as additional disambiguation. |
| A3 | `JSON.stringify(input)` with sorted keys produces deterministic output for all tool input shapes | Idempotency Pattern | **Low** — all tool inputs are plain JSON-serializable objects. Exotic types (Map, Set, Date) are not used as tool inputs in this codebase. |
| A4 | No external consumers call `agentOrchestrator.runTurn()` outside of `src/` | Common Pitfalls #1 | **Low** — verified by codebase analysis. `agentOrchestrator` is only exported from `src/core/ai/AgentOrchestrator.ts` and consumed via module imports within the project. |

## Open Questions

1. **Should `AgentTurnOutcome` be a class with methods or a plain interface?**
   - What we know: D-02 specifies a comprehensive interface with readonly fields. The codebase uses plain interfaces with Zod validation for most contracts (PlannerDecision, OptimizedContext, AgentTurnInput).
   - What's unclear: Whether helper methods (e.g., `outcome.isSuccessful()`, `outcome.hasEvidence()`) would add value or violate the readonly contract.
   - Recommendation: Start with a plain interface + Zod schema (consistent with codebase patterns). Add a `createAgentTurnOutcome()` factory function. Avoid class methods — the outcome is a data contract consumed by downstream phases, not a service.

2. **Should `OutcomeVerifier` be split into separate files (one per verifier type) or a single file with strategy dispatch?**
   - What we know: D-10 specifies `src/core/ai/verifier/` directory with independently testable service. Four verifier types exist: schema, environment, read-after-write, tool-provided.
   - What's unclear: Whether the verifier types have enough implementation complexity to warrant separate files.
   - Recommendation: Start with a single `OutcomeVerifier.ts` file with internal strategy dispatch (switch on verifier type). If any single verifier type exceeds ~50 lines, extract to a separate file under `verifier/`. The key contract is `OutcomeVerifier.verify(toolResult, policy) → CompletionEvidence` — keep this surface simple.

3. **How should `PlannerService.plan()` accept replanning context for the recovery call?**
   - What we know: D-15 says one additional `PlannerService` call with "failed/partial attempt as structured redacted observation." D-12 says `ReplanPolicy` is independent of `PipelineError`.
   - What's unclear: The exact shape of the replanning context — whether it's a separate parameter or an optional field on the existing `OptimizedContext`.
   - Recommendation: Add an optional `replanContext?: ReplanContext` parameter to `PlannerService.plan()`. The planner injects this into the system prompt as a structured observation. Keep it minimal: tool name, what was attempted, what the observed result/error was. Do NOT pass the raw `PipelineError` — redact diagnostic details.

## Environment Availability

> Phase 3a has no new external dependencies. All tools are already available from the project's existing development environment.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | TypeScript compilation, test execution | ✓ | v26.5.0 | — |
| pnpm | Package management, script execution | ✓ | 11.18.0 | — |
| TypeScript | Compilation (`tsc --noEmit`) | ✓ | ~5.8.2 (strict) | — |
| Zod | Schema validation for new types | ✓ | 4.4.3 | — |
| vitest | Unit/integration tests | ✓ | 3.2.7 | — |
| jsdom | Test environment (via vitest) | ✓ | via vitest config | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^3.2.7 |
| Config file | `./vitest.config.ts` (jsdom environment, globals enabled) |
| Quick run command | `npx vitest run tests/core/ai/trajectory tests/core/ai/verifier tests/core/ai/replan` |
| Full suite command | `pnpm test -- tests/core/ai` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGT-01 | Trajectory states emit in correct sequence; invalid transitions reject | unit | `npx vitest run tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts -t "transition"` | ❌ Wave 0 |
| AGT-01 | All 10 states transition through valid paths end-to-end | integration | `npx vitest run tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts -t "full pipeline"` | ❌ Wave 0 |
| AGT-02 | Verified tool → OutcomeVerifier returns VerifiedCompletionEvidence | unit | `npx vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts -t "verified"` | ❌ Wave 0 |
| AGT-02 | Unverified tool → OutcomeVerifier returns UnverifiedCompletionEvidence | unit | `npx vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts -t "unverified"` | ❌ Wave 0 |
| AGT-02 | RendererService does not claim writes without verified evidence | integration | `npx vitest run tests/core/ai/RenderingOutcomePolicy.test.ts -t "blocks write"` | ❌ Wave 0 |
| AGT-03 | Cap exhaustion → terminalState: 'partial', not 'completed' | integration | `npx vitest run tests/core/ai/AgentOrchestrator.test.ts -t "cap exhaustion partial"` | ❌ Wave 0 |
| AGT-03 | Abort → terminalState: 'aborted', renderedAnswer is null | integration | `npx vitest run tests/core/ai/AgentOrchestrator.test.ts -t "abort"` | ❌ Wave 0 |
| AGT-03 | Every exit path returns AgentTurnOutcome (no bare strings) | integration | `npx vitest run tests/core/ai/AgentOrchestrator.test.ts -t "returns AgentTurnOutcome"` | ❌ Wave 0 |
| AGT-04 | ReplanPolicy: success → continue-planning | unit | `npx vitest run tests/core/ai/ReplanPolicy.test.ts -t "success continues"` | ❌ Wave 0 |
| AGT-04 | ReplanPolicy: retryable error → one replan, then render | unit | `npx vitest run tests/core/ai/ReplanPolicy.test.ts -t "retryable one replan"` | ❌ Wave 0 |
| AGT-04 | ReplanPolicy: irreversible tool → terminate | unit | `npx vitest run tests/core/ai/ReplanPolicy.test.ts -t "irreversible terminates"` | ❌ Wave 0 |
| TOL-03 | Tool with sideEffect: 'write' + evidence.required → verifier called | integration | `npx vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts -t "write side effect"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/core/ai/trajectory tests/core/ai/verifier tests/core/ai/replan`
- **Per wave merge:** `pnpm test -- tests/core/ai`
- **Phase gate:** Full AI test suite green (`pnpm run verify:phase-3` extended to include new tests)

### Wave 0 Gaps

- [ ] `tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts` — covers AGT-01 (all transitions, invalid rejections, terminal lock, history immutability, callback fire-and-forget)
- [ ] `tests/core/ai/verifier/OutcomeVerifier.test.ts` — covers AGT-02, TOL-03 (verified/unverified evidence, verifier type routing, timeout handling, missing verifier)
- [ ] `tests/core/ai/ReplanPolicy.test.ts` — covers AGT-04 (all ReplanDisposition outcomes, irreversible guard, one-replan limit, abort priority, cap exhaustion)
- [ ] `tests/core/ai/RenderingOutcomePolicy.test.ts` — covers AGT-02 (policy derivation, mixed evidence handling, empty evidence)
- [ ] `tests/core/ai/AgentOrchestrator.test.ts` (extended) — covers AGT-03 (AgentTurnOutcome on every exit path, cap exhaustion, abort, runTurnText wrapper)
- [ ] `tests/core/ai/ExecutorService.test.ts` (extended) — covers idempotency ledger (duplicate detection, in-flight guard, key uniqueness)
- [ ] `tests/core/ai/types.test.ts` — Zod schema validation for AgentTurnOutcome, CompletionEvidence, ReplanDisposition
- [ ] `tests/core/ai/integration.test.ts` (extended) — full trajectory + evidence + replan integration flow

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not applicable — no user auth in this phase |
| V3 Session Management | No | Not applicable |
| V4 Access Control | No | Not applicable |
| V5 Input Validation | Yes | Zod v4 schema validation for all new types — `z.discriminatedUnion()`, `z.strictObject()`, `z.enum()`. Invalid states/transitions rejected with `AGENT_STATE_INVALID`. |
| V6 Cryptography | No | Not applicable — no crypto in this phase (idempotency uses concatenation, not hashing) |

### Known Threat Patterns for Agent Reliability Module

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Trajectory state injection — malicious code bypasses transition validation | Tampering | `ALLOWED_TRANSITIONS` is a compile-time constant with `as const satisfies` assertion; `transitionTo()` throws on invalid transition; terminal states lock all further transitions |
| Evidence spoofing — unverified tool results marked as verified | Spoofing | `CompletionEvidence` is a discriminated union on `verified: boolean`; `OutcomeVerifier` owns the verification logic; orchestrator is the only code path that can create evidence records |
| Renderer hallucination — model claims write success without evidence | Information Disclosure | `RenderingOutcomePolicy.canClaimWriteSuccess` is derived from verified evidence only; renderer constrained by policy in system prompt |
| Abort bypass — AbortSignal ignored during tool execution | Denial of Service | `signal?.throwIfAborted()` at every pipeline stage boundary; abort path skips rendering/verification; `terminalState: 'aborted'` prevents false success |
| Replan loop — attacker crafts retryable error to exhaust resources | Denial of Service | `ReplanPolicy` enforces one-replan limit; `replanCount` increments once and blocks subsequent replans; irreversible tools block all replanning |
| Idempotency bypass — duplicate execution of irreversible tool | Tampering | In-memory ledger checked before execution; `idempotency: 'required'` tools blocked on in-flight or unresolved entries |

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** (`src/core/ai/AgentOrchestrator.ts`, `PlannerService.ts`, `ExecutorService.ts`, `RendererService.ts`, `PipelineError.ts`, `types.ts`) — existing pipeline structure, error taxonomy, type patterns, module singleton pattern, Zod usage [VERIFIED: codebase review]
- **CONTEXT.md** (`.planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md`) — 17 locked decisions (D-01 through D-17) defining the exact API contracts, transition map, evidence shape, replan policy, and boundaries [VERIFIED: approved decisions]
- **Test infrastructure** (`vitest.config.ts`, `tests/setup.ts`, `tests/core/ai/*.test.ts`) — vitest with jsdom, mock patterns, shared schemas, factory functions [VERIFIED: codebase review]

### Secondary (MEDIUM confidence)
- **Zod v4 official docs** (`zod.dev`) — `z.discriminatedUnion()`, `z.strictObject()`, `z.enum()` patterns confirmed via official documentation [CITED: zod.dev]
- **MDN AbortSignal API** (`developer.mozilla.org`) — `throwIfAborted()`, `aborted` property, `AbortError` name [CITED: MDN reference — standard Web API]

### Tertiary (LOW confidence)
- **WebSearch** (general TypeScript FSM patterns, discriminated union patterns, idempotency patterns) — general design pattern knowledge, not specific to this project [ASSUMED: training knowledge + standard patterns]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all tools already in project with verified versions
- Architecture: HIGH — 17 locked decisions provide complete contract specification; existing codebase provides proven patterns
- Pitfalls: HIGH — based on codebase analysis of existing test patterns, module structure, and the specific risks of the return type change

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 — stable domain; decisions locked in CONTEXT.md are not expected to change
