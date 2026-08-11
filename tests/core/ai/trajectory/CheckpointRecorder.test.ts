// tests/core/ai/trajectory/CheckpointRecorder.test.ts — 03a-02 task 4
// (D-3a-08/D-3a-09, T-03a-02-03): proves the opId-keyed pre-tool loop-state
// store — capture/restore round-trip preserves the full LoopState, restore
// returns a deep-copied snapshot (mutating it never mutates the stored state),
// an uncaptured opId restores to undefined, and capture is keyed by
// operationId (two opIds do not collide).
//
// Determinism (fixtures/index.ts): fixed constants only — no Date.now/crypto.
import { describe, expect, it } from 'vitest';

import { CheckpointRecorder } from '@/core/ai/CheckpointRecorder';
import type { LoopState } from '@/core/ai/CheckpointRecorder';
import type { ToolExecutionResult } from '@/core/ai/types';
import { FIXED_TRAJECTORY_OPERATION_ID, MOCK_DANGEROUS_TOOL } from '../../../fixtures/trajectory';

// ---------------------------------------------------------------------------
// Local deterministic fixtures (fixed constants only — no Date.now/crypto)
// ---------------------------------------------------------------------------

function toolResult(overrides: Partial<ToolExecutionResult> = {}): ToolExecutionResult {
  return {
    toolName: MOCK_DANGEROUS_TOOL.name,
    ok: true,
    output: { written: true },
    durationMs: 10,
    ...overrides,
  };
}

function loopState(overrides: Partial<LoopState> = {}): LoopState {
  return {
    toolResults: [toolResult(), toolResult({ ok: false })],
    plannerCalls: 2,
    toolCalls: 1,
    phase: 'executing',
    ...overrides,
  };
}

const OTHER_OP_ID = 'op-other';

// ---------------------------------------------------------------------------
// capture/restore round-trip (D-3a-09)
// ---------------------------------------------------------------------------

describe('CheckpointRecorder — capture/restore round-trip (D-3a-09)', () => {
  it('restore returns the full captured LoopState (toolResults/plannerCalls/toolCalls/phase)', () => {
    const recorder = new CheckpointRecorder();
    const captured = loopState();

    recorder.capture(FIXED_TRAJECTORY_OPERATION_ID, captured);

    const restored = recorder.restore(FIXED_TRAJECTORY_OPERATION_ID);
    expect(restored).toBeDefined();
    expect(restored?.toolResults).toEqual(captured.toolResults);
    expect(restored?.toolResults).toHaveLength(2);
    expect(restored?.plannerCalls).toBe(captured.plannerCalls);
    expect(restored?.toolCalls).toBe(captured.toolCalls);
    expect(restored?.phase).toBe(captured.phase);
  });

  it('capture stores a copy — mutating the caller object after capture does not affect the stored state', () => {
    const recorder = new CheckpointRecorder();
    const captured = loopState();

    recorder.capture(FIXED_TRAJECTORY_OPERATION_ID, captured);

    captured.plannerCalls = 99;
    captured.toolResults.push(toolResult());
    captured.phase = 'rendering';

    const restored = recorder.restore(FIXED_TRAJECTORY_OPERATION_ID);
    expect(restored?.plannerCalls).toBe(2);
    expect(restored?.toolResults).toHaveLength(2);
    expect(restored?.phase).toBe('executing');
  });
});

// ---------------------------------------------------------------------------
// restore returns a deep copy — callers cannot mutate stored state (T-03a-02-03)
// ---------------------------------------------------------------------------

describe('CheckpointRecorder — restore returns a deep copy', () => {
  it('mutating the restored snapshot does not change the stored state (top-level fields)', () => {
    const recorder = new CheckpointRecorder();
    recorder.capture(FIXED_TRAJECTORY_OPERATION_ID, loopState());

    const restored = recorder.restore(FIXED_TRAJECTORY_OPERATION_ID);
    expect(restored).toBeDefined();
    restored!.plannerCalls = 7;
    restored!.toolCalls = 9;
    restored!.phase = 'failed';
    restored!.toolResults.push(toolResult());

    const again = recorder.restore(FIXED_TRAJECTORY_OPERATION_ID);
    expect(again?.plannerCalls).toBe(2);
    expect(again?.toolCalls).toBe(1);
    expect(again?.phase).toBe('executing');
    expect(again?.toolResults).toHaveLength(2);
  });

  it('mutating a nested toolResult inside the restored snapshot does not leak into stored state', () => {
    const recorder = new CheckpointRecorder();
    recorder.capture(FIXED_TRAJECTORY_OPERATION_ID, loopState());

    const restored = recorder.restore(FIXED_TRAJECTORY_OPERATION_ID);
    expect(restored).toBeDefined();
    restored!.toolResults[0].ok = false;
    restored!.toolResults[0].output = { written: false };
    restored!.toolResults[0].error = { code: 'X', message: 'mutated', retryable: false };

    const again = recorder.restore(FIXED_TRAJECTORY_OPERATION_ID);
    expect(again?.toolResults[0].ok).toBe(true);
    expect(again?.toolResults[0].output).toEqual({ written: true });
    expect(again?.toolResults[0].error).toBeUndefined();
  });

  it('restore returns a fresh object each call — snapshots do not alias each other', () => {
    const recorder = new CheckpointRecorder();
    recorder.capture(FIXED_TRAJECTORY_OPERATION_ID, loopState());

    const first = recorder.restore(FIXED_TRAJECTORY_OPERATION_ID);
    const second = recorder.restore(FIXED_TRAJECTORY_OPERATION_ID);
    expect(first).not.toBe(second);
    expect(first?.toolResults).not.toBe(second?.toolResults);
    expect(first?.toolResults[0]).not.toBe(second?.toolResults[0]);
  });
});

// ---------------------------------------------------------------------------
// uncaptured opId -> undefined
// ---------------------------------------------------------------------------

describe('CheckpointRecorder — uncaptured opId', () => {
  it('restore of a never-captured operationId returns undefined', () => {
    const recorder = new CheckpointRecorder();
    expect(recorder.restore(FIXED_TRAJECTORY_OPERATION_ID)).toBeUndefined();
  });

  it('restore of an unrelated opId after a capture still returns undefined', () => {
    const recorder = new CheckpointRecorder();
    recorder.capture(FIXED_TRAJECTORY_OPERATION_ID, loopState());
    expect(recorder.restore(OTHER_OP_ID)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// opId key isolation (capture is keyed by operationId)
// ---------------------------------------------------------------------------

describe('CheckpointRecorder — opId key isolation', () => {
  it('capturing op-A does not affect the restore of op-B', () => {
    const recorder = new CheckpointRecorder();
    recorder.capture(FIXED_TRAJECTORY_OPERATION_ID, loopState({ phase: 'executing' }));

    expect(recorder.restore(OTHER_OP_ID)).toBeUndefined();

    recorder.capture(OTHER_OP_ID, loopState({ phase: 'verifying', plannerCalls: 5 }));

    const opA = recorder.restore(FIXED_TRAJECTORY_OPERATION_ID);
    const opB = recorder.restore(OTHER_OP_ID);

    expect(opA?.phase).toBe('executing');
    expect(opA?.plannerCalls).toBe(2);
    expect(opB?.phase).toBe('verifying');
    expect(opB?.plannerCalls).toBe(5);
  });

  it('re-capturing the same opId overwrites the prior snapshot', () => {
    const recorder = new CheckpointRecorder();
    recorder.capture(FIXED_TRAJECTORY_OPERATION_ID, loopState({ plannerCalls: 1 }));
    recorder.capture(FIXED_TRAJECTORY_OPERATION_ID, loopState({ plannerCalls: 3 }));

    expect(recorder.restore(FIXED_TRAJECTORY_OPERATION_ID)?.plannerCalls).toBe(3);
  });
});
