// src/core/ai/CheckpointRecorder.ts — Source: D-3a-08/D-3a-09 (03a-CONTEXT) +
// §17.7.7 + Phase 8 TOL-05 boundary. Phase 3a (03a-02): the ONE-STEP rollback
// capability (D-3a-09) the orchestrator (03a-03) rewires around — an
// opId-keyed pre-tool loop-state store.
//
// D-3a-09 [loop-state rewind]: Checkpoint captures the pre-tool loop state
// (toolResults list, plannerCalls, toolCalls, trajectory phase) keyed by
// `operationId`. Rollback = restore that state + the orchestrator discards the
// failed tool's result, then the failed tool is re-run once (AGT-04 interplay).
// NO side-effect compensation/inverse — that is Phase 8 idempotency (TOL-05),
// explicitly out of scope for v0.1.
//
// §17.7.7 (C4): NO durable/session persistence — trajectory, evidence, and
// checkpoints are within-turn, in-memory only. This Map lives per
// runAgentTurn invocation and dies with it.
//
// No shared references: capture stores a structuredClone of the incoming state
// and restore returns a structuredClone of the stored snapshot, so callers can
// never mutate what was captured (T-03a-02-03, mitigate). Composes
// ProviderRouter's lazy Map pattern (L361/L769-786) + WriteJournal's
// rollback machinery (WriteJournal.ts L28-33/L62-79) at the loop-state level.
import type { ToolExecutionResult } from './types';

/**
 * D-3a-09: the pre-tool loop state captured before a side-effecting tool runs.
 * `phase` is the trajectory phase at capture time (AgentTrajectoryPhase as
 * string — the orchestrator 03a-03 feeds the C.1 value).
 */
export interface LoopState {
  toolResults: ToolExecutionResult<unknown>[];
  plannerCalls: number;
  toolCalls: number;
  phase: string;
}

export class CheckpointRecorder {
  private readonly state = new Map<string, LoopState>();

  /** Capture the pre-tool loop state keyed by operationId (deep-copied — no shared references). */
  capture(operationId: string, state: LoopState): void {
    this.state.set(operationId, structuredClone(state));
  }

  /**
   * Restore a deep-copied snapshot of the captured state for operationId.
   * Returns undefined for an operationId that was never captured.
   */
  restore(operationId: string): LoopState | undefined {
    const snapshot = this.state.get(operationId);
    return snapshot ? structuredClone(snapshot) : undefined;
  }
}
