// TrajectoryTracker — D-62/D-63 (§28.2 AGT-01): the per-turn closed trajectory
// state machine for one agent turn.
//
// Transitions are asserted against the closed TRAJECTORY_TRANSITIONS table; an
// illegal transition throws at runtime (AGT-01), so a failure-masking state can
// never be recorded. The tracker records, never persists (D-63 — in-memory per
// turn; AITransactionLog is Phase 11). It is turn-level agent evidence and is
// deliberately distinct from ActiveStreamState (§20.6, surface-level streaming
// UI state) — do not conflate the two machines.
//
// The transition-table validator is the D-62 recommendation (RESEARCH A1): the
// C.1 AgentTrajectoryState is a flat snapshot interface (single `phase` field,
// not a per-state discriminated union), so a type-level encoding would
// restructure the locked canonical type.
import type { AgentTrajectoryPhase, AgentTrajectoryState } from '@/types/harness';

/**
 * Closed transition table (D-62, AGT-01) — which phase may legally follow
 * which. Every C.1 phase appears as a key (closed machine completeness: all 10
 * states must exist; `waiting-for-permission` has no Phase-4 trigger — the
 * permission gate is Phase 17 — but must be representable).
 *
 * AMENDED ROW (vs RESEARCH Pattern 2 / PATTERNS.md): `assembling-context`
 * ships `['planning', 'aborted']` — the `aborted` edge lets plan 04-04's
 * boundary catch exit a pre-aborted turn (aborted before any planning ever
 * ran). Research A2 framed the edge set as assumed/correctable; AGT-01 tests
 * pin the rest. Every later plan (04-02/03/04) references THIS amended table.
 */
export const TRAJECTORY_TRANSITIONS: Record<AgentTrajectoryPhase, readonly AgentTrajectoryPhase[]> = {
  'assembling-context': ['planning', 'aborted'],
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

/**
 * Per-turn trajectory tracker (D-62/63). Constructed once per runAgentTurn
 * with the turn's OperationId (Pitfall 8 correlation — never a fresh UUID);
 * `enter()` validates against the closed table and throws on illegal
 * transitions (AGT-01); `snapshot()` emits the C.1 AgentTrajectoryState.
 */
export class TrajectoryTracker {
  private state: AgentTrajectoryState;
  private visited: AgentTrajectoryPhase[];

  constructor(operationId: string) {
    this.state = {
      operationId,
      phase: 'assembling-context',
      plannerCalls: 0,
      toolCalls: 0,
      updatedAt: Date.now(),
    };
    this.visited = ['assembling-context'];
  }

  /** Current machine phase — read by the orchestrator to route legal edges. */
  get phase(): AgentTrajectoryPhase {
    return this.state.phase;
  }

  /** Assert a transition against the closed table; throws Error on illegal ones. */
  enter(next: AgentTrajectoryPhase): void {
    if (!TRAJECTORY_TRANSITIONS[this.state.phase].includes(next)) {
      throw new Error(`illegal trajectory transition: ${this.state.phase} -> ${next}`);
    }
    this.state = { ...this.state, phase: next, updatedAt: Date.now() };
    this.visited.push(next);
  }

  /** D-63: the C.1 snapshot with the turn's final counters (surfaces on the outcome). */
  snapshot(plannerCalls: number, toolCalls: number): AgentTrajectoryState {
    return { ...this.state, plannerCalls, toolCalls, updatedAt: Date.now() };
  }

  /** In-memory diagnostic: the visited phase order (AGT-01 tests; NOT part of the outcome shape). */
  get history(): readonly AgentTrajectoryPhase[] {
    return this.visited;
  }
}