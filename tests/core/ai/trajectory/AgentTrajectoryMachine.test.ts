import { describe, it, expect } from 'vitest';
import { AgentTrajectoryMachine } from '../../../../src/core/ai/AgentTrajectoryMachine';
import {
  ALLOWED_TRANSITIONS,
  AGENT_TRAJECTORY_STATES,
  type AgentTrajectoryState,
  type TrajectoryStateEntry,
} from '../../../../src/core/ai/types';
import { PipelineError } from '../../../../src/core/ai/PipelineError';

/**
 * A legal D-04 path (excluding the target) that drives a fresh machine to
 * the requested state. Every state is reachable per the allowlist.
 */
function pathTo(state: AgentTrajectoryState): AgentTrajectoryState[] {
  const paths: Record<AgentTrajectoryState, AgentTrajectoryState[]> = {
    'assembling-context': [],
    planning: ['assembling-context'],
    'waiting-for-permission': ['assembling-context', 'planning'],
    executing: ['assembling-context', 'planning'],
    verifying: ['assembling-context', 'planning', 'executing'],
    replanning: ['assembling-context', 'planning', 'executing'],
    rendering: ['assembling-context', 'planning'],
    completed: ['assembling-context', 'planning', 'rendering'],
    failed: ['assembling-context'],
    aborted: ['assembling-context'],
  };
  return paths[state];
}

function machineAt(state: AgentTrajectoryState): AgentTrajectoryMachine {
  const machine = new AgentTrajectoryMachine();
  for (const s of pathTo(state)) {
    machine.transitionTo(s);
  }
  return machine;
}

describe('AgentTrajectoryMachine', () => {
  it('starts at assembling-context with a single open entry', () => {
    const machine = new AgentTrajectoryMachine();
    expect(machine.state).toBe('assembling-context');
    expect(machine.history).toHaveLength(1);
    const entry = machine.history[0];
    expect(entry.state).toBe('assembling-context');
    expect(entry.exitedAt).toBeNull();
    expect(entry.durationMs).toBeNull();
  });

  it('closes the previous entry with finalized timestamps on transition', () => {
    const machine = new AgentTrajectoryMachine();
    machine.transitionTo('planning');
    const history = machine.history;
    expect(history).toHaveLength(2);
    const closed = history[0];
    expect(closed.state).toBe('assembling-context');
    expect(closed.exitedAt).not.toBeNull();
    expect(closed.durationMs).not.toBeNull();
    expect(closed.durationMs).toBe(closed.exitedAt! - closed.enteredAt);
    const open = history[1];
    expect(open.state).toBe('planning');
    expect(open.exitedAt).toBeNull();
    expect(open.durationMs).toBeNull();
  });

  it('enforces the D-04 allowlist for every state pair', () => {
    for (const from of AGENT_TRAJECTORY_STATES) {
      for (const to of AGENT_TRAJECTORY_STATES) {
        const machine = machineAt(from);
        if (ALLOWED_TRANSITIONS[from].includes(to)) {
          expect(() => machine.transitionTo(to), `${from} -> ${to} should be allowed`).not.toThrow();
        } else {
          expect(() => machine.transitionTo(to), `${from} -> ${to} should be rejected`).toThrow(PipelineError);
        }
      }
    }
  });

  it('throws AGENT_STATE_INVALID for illegal and post-terminal transitions', () => {
    const illegal = machineAt('executing');
    try {
      illegal.transitionTo('planning');
      expect.unreachable('planning -> executing -> planning must be rejected');
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError);
      expect((err as PipelineError).code).toBe('AGENT_STATE_INVALID');
    }

    const postTerminal = machineAt('completed');
    try {
      postTerminal.transitionTo('rendering');
      expect.unreachable('transitions after completed must be rejected');
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError);
      expect((err as PipelineError).code).toBe('AGENT_STATE_INVALID');
    }
  });

  it('protects all three terminal states from further transitions', () => {
    for (const terminal of ['completed', 'failed', 'aborted'] as const) {
      const machine = machineAt(terminal);
      for (const to of AGENT_TRAJECTORY_STATES) {
        expect(() => machine.transitionTo(to), `${terminal} -> ${to}`).toThrow(PipelineError);
      }
    }
  });

  it('returns immutable history snapshots that cannot corrupt internal state', () => {
    const machine = new AgentTrajectoryMachine();
    machine.transitionTo('planning');
    const first = machine.history;
    (first as TrajectoryStateEntry[])[0].enteredAt = 12345;
    (first as TrajectoryStateEntry[]).push({
      state: 'executing',
      enteredAt: 1,
      exitedAt: null,
      durationMs: null,
    });
    const second = machine.history;
    expect(second).toHaveLength(2);
    expect(second[0].enteredAt).not.toBe(12345);
    expect(second[0].exitedAt).not.toBeNull();
    expect(second[0].durationMs).not.toBeNull();
  });

  it('records optional entry metadata on transition', () => {
    const machine = new AgentTrajectoryMachine();
    machine.transitionTo('executing', { toolCall: 1, toolName: 'writeNote' });
    machine.transitionTo('verifying', { reasonCode: 'tool_completed' });
    const history = machine.history;
    expect(history[1].toolCall).toBe(1);
    expect(history[1].toolName).toBe('writeNote');
    expect(history[2].reasonCode).toBe('tool_completed');
  });

  it('invokes the observer after each successful transition with a snapshot', () => {
    const seen: AgentTrajectoryState[] = [];
    const machine = new AgentTrajectoryMachine((entry) => {
      seen.push(entry.state);
    });
    machine.transitionTo('planning');
    machine.transitionTo('executing');
    expect(seen).toEqual(['planning', 'executing']);
    expect(seen).not.toContain('assembling-context');
  });

  it('isolates a throwing observer without failing the transition', () => {
    const machine = new AgentTrajectoryMachine(() => {
      throw new Error('consumer boom');
    });
    expect(() => machine.transitionTo('planning')).not.toThrow();
    expect(machine.state).toBe('planning');
    expect(machine.history).toHaveLength(2);
  });

  it('does not let the observer mutate the internal snapshot', () => {
    const machine = new AgentTrajectoryMachine((entry) => {
      (entry as TrajectoryStateEntry).enteredAt = 1;
      entry.state = 'executing' as AgentTrajectoryState;
    });
    machine.transitionTo('planning');
    const entry = machine.history[1];
    expect(entry.enteredAt).not.toBe(1);
    expect(entry.state).toBe('planning');
  });

  it('isolates history between concurrent instances', () => {
    const a = new AgentTrajectoryMachine();
    const b = new AgentTrajectoryMachine();
    a.transitionTo('planning');
    a.transitionTo('executing');
    expect(a.state).toBe('executing');
    expect(a.history).toHaveLength(3);
    expect(b.state).toBe('assembling-context');
    expect(b.history).toHaveLength(1);
  });

  it('finalize closes the final entry exactly once', () => {
    const machine = new AgentTrajectoryMachine();
    machine.transitionTo('planning');
    machine.finalize();
    const entries = machine.history;
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.exitedAt !== null && e.durationMs !== null)).toBe(true);
    machine.finalize();
    expect(machine.history).toHaveLength(2);
  });

  it('rejects transitions after finalize', () => {
    const machine = new AgentTrajectoryMachine();
    machine.finalize();
    expect(() => machine.transitionTo('planning')).toThrow(PipelineError);
  });

  it('finalize closes a terminal entry and leaves the history immutable', () => {
    const machine = machineAt('completed');
    machine.finalize();
    const entries = machine.history;
    expect(entries.map((e) => e.state)).toEqual([
      'assembling-context',
      'planning',
      'rendering',
      'completed',
    ]);
    expect(entries.every((e) => e.exitedAt !== null)).toBe(true);
  });
});
