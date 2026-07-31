import { ALLOWED_TRANSITIONS, type AgentTrajectoryState, type TrajectoryStateEntry } from './types';
import { PipelineError } from './PipelineError';

/**
 * Fire-and-forget live consumer of trajectory transitions (D-03). The
 * callback receives an immutable snapshot, cannot approve or reject the
 * transition, and its failures never fail the turn.
 */
export type TrajectoryTransitionObserver = (entry: TrajectoryStateEntry, state: AgentTrajectoryState) => void;

export interface TrajectoryTransitionMeta {
  reasonCode?: string;
  plannerCall?: number;
  toolCall?: number;
  toolName?: string;
}

function now(): number {
  return Date.now();
}

function snapshot(entry: TrajectoryStateEntry): TrajectoryStateEntry {
  return { ...entry };
}

/**
 * Operation-scoped strict trajectory state machine (D-03/D-04). Starts at
 * `assembling-context`, rejects every transition not in the explicit
 * ALLOWED_TRANSITIONS allowlist (PipelineError AGENT_STATE_INVALID),
 * finalizes timestamps when entries close, and keeps an immutable history
 * isolated per instance. One fresh machine per agent turn — never shared
 * across turns or surfaces.
 */
export class AgentTrajectoryMachine {
  private readonly entries: TrajectoryStateEntry[] = [];
  private current: TrajectoryStateEntry;
  private readonly observer?: TrajectoryTransitionObserver;
  private closed = false;

  constructor(observer?: TrajectoryTransitionObserver) {
    this.observer = observer;
    this.current = {
      state: 'assembling-context',
      enteredAt: now(),
      exitedAt: null,
      durationMs: null,
    };
    this.entries.push(this.current);
  }

  get state(): AgentTrajectoryState {
    return this.current.state;
  }

  /** Immutable snapshots of the full history — mutating them cannot corrupt internal state. */
  get history(): readonly TrajectoryStateEntry[] {
    return this.entries.map(snapshot);
  }

  /**
   * Transition to `state` if and only if ALLOWED_TRANSITIONS[from]
   * contains it. Closes the current entry with finalized timestamps, opens
   * the next, and notifies the observer inside an isolated try/catch.
   */
  transitionTo(state: AgentTrajectoryState, meta: TrajectoryTransitionMeta = {}): TrajectoryStateEntry {
    if (this.closed) {
      throw this.invalidTransition(state);
    }
    const allowed = ALLOWED_TRANSITIONS[this.current.state];
    if (!allowed.includes(state)) {
      throw this.invalidTransition(state);
    }

    this.closeCurrent();

    this.current = {
      state,
      enteredAt: now(),
      exitedAt: null,
      durationMs: null,
      ...meta,
    };
    this.entries.push(this.current);

    if (this.observer) {
      try {
        this.observer(snapshot(this.current), this.current.state);
      } catch {
        // Consumer failures are isolated — the transition already happened.
      }
    }

    return snapshot(this.current);
  }

  /**
   * Closes the final entry exactly once for the current turn. Subsequent
   * calls are no-ops; further transitions are rejected.
   */
  finalize(): void {
    if (this.closed) {
      return;
    }
    this.closeCurrent();
    this.closed = true;
  }

  private closeCurrent(): void {
    const exitedAt = now();
    this.current.exitedAt = exitedAt;
    this.current.durationMs = exitedAt - this.current.enteredAt;
  }

  private invalidTransition(state: AgentTrajectoryState): PipelineError {
    return new PipelineError(
      'AGENT_STATE_INVALID',
      `Invalid trajectory transition from "${this.current.state}" to "${state}".`,
      { from: this.current.state, to: state },
    );
  }
}
