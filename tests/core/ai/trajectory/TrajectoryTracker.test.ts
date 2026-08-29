import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  TRAJECTORY_TRANSITIONS,
  TrajectoryTracker,
} from '../../../../src/core/ai/trajectory';

/**
 * TrajectoryTracker contract tests (plan 04-01, Task 2) — §18-required
 * AGT-01 closed-machine tests. Pure unit tests: no chrome mocks, no providers
 * (ExecutorService.test.ts style) — the tracker is dependency-free.
 *
 * Covers: the legal transition chain; the illegal-transition throw (AGT-01);
 * snapshot counter reflection + updatedAt bump (D-63); per-turn operationId
 * correlation; closed-machine completeness ('waiting-for-permission' has no
 * Phase-4 trigger but must exist — the permission gate is Phase 17); and the
 * in-memory history diagnostic.
 */
afterEach(() => {
  vi.useRealTimers();
});

describe('TrajectoryTracker — closed transition machine (AGT-01)', () => {
  it('a legal chain assembling-context → planning → executing → verifying → rendering → completed passes', () => {
    const tracker = new TrajectoryTracker('op-trajectory-test');

    tracker.enter('planning');
    tracker.enter('executing');
    tracker.enter('verifying');
    tracker.enter('rendering');
    tracker.enter('completed');

    expect(tracker.phase).toBe('completed');
  });

  it('an illegal transition throws the illegal-transition message (assembling-context → completed)', () => {
    const tracker = new TrajectoryTracker('op-trajectory-test');

    expect(() => tracker.enter('completed')).toThrow(
      'illegal trajectory transition: assembling-context -> completed',
    );
  });

  it('snapshot reflects the counters and bumps updatedAt (D-63)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const tracker = new TrajectoryTracker('op-trajectory-test');
    vi.setSystemTime(2_000);

    const snap = tracker.snapshot(3, 4);

    expect(snap.plannerCalls).toBe(3);
    expect(snap.toolCalls).toBe(4);
    expect(snap.updatedAt).toBe(2_000);
  });

  it('operationId matches the constructor arg — the per-turn record is correlated (D-63, Pitfall 8)', () => {
    const tracker = new TrajectoryTracker('op-orchestrator');

    const snap = tracker.snapshot(1, 0);

    expect(snap.operationId).toBe('op-orchestrator');
  });

  it("closed-machine completeness: all 10 C.1 phases exist as keys; 'waiting-for-permission' has no Phase-4 trigger", () => {
    // The closed machine requires every C.1 state representable (AGT-01) —
    // including phases no Phase-4 flow ever enters.
    expect(Object.keys(TRAJECTORY_TRANSITIONS)).toHaveLength(10);
    // 'waiting-for-permission' exists (permission gate is Phase 17) but no
    // Phase-4 loop hook enters it.
    expect(TRAJECTORY_TRANSITIONS['waiting-for-permission']).toEqual([
      'executing',
      'replanning',
      'failed',
      'aborted',
    ]);
    // AMENDED ROW: assembling-context exits to planning (normal) AND aborted
    // (plan 04-04's pre-aborted boundary catch) — 'completed' is NOT legal.
    expect(TRAJECTORY_TRANSITIONS['assembling-context']).toContain('planning');
    expect(TRAJECTORY_TRANSITIONS['assembling-context']).toContain('aborted');
    expect(TRAJECTORY_TRANSITIONS['assembling-context']).not.toContain('completed');
  });

  it('history() records the visited phase order (in-memory diagnostic, not part of the outcome shape)', () => {
    const tracker = new TrajectoryTracker('op-trajectory-test');

    tracker.enter('planning');
    tracker.enter('executing');

    expect(tracker.history).toEqual(['assembling-context', 'planning', 'executing']);
  });
});