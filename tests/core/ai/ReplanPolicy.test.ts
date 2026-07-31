import { describe, it, expect } from 'vitest';
import { evaluateReplan, type ReplanDisposition } from '../../../src/core/ai/ReplanPolicy';
import { PipelineError, projectPipelineError, type PipelineErrorProjection } from '../../../src/core/ai/PipelineError';
import type {
  CompletionEvidence,
  PipelineErrorCode,
  ReplanContext,
  ToolExecutionResult,
} from '../../../src/core/ai/types';

const DISPOSITIONS: readonly ReplanDisposition[] = ['continue-planning', 'replan', 'render', 'terminate'];

function projection(code: PipelineErrorCode): PipelineErrorProjection {
  return projectPipelineError(new PipelineError(code, `diagnostic message for ${code}`));
}

function buildContext(overrides: Partial<ReplanContext> = {}): ReplanContext {
  return {
    operationId: 'op-replan-001',
    replanCount: 0,
    toolName: 'createNote',
    toolCallId: 'call-0001',
    sideEffect: 'write',
    priorToolResults: [],
    caps: {
      plannerCalls: 1,
      plannerCap: 5,
      plannerCapReached: false,
      toolCalls: 1,
      toolCap: 3,
      toolCapReached: false,
    },
    ...overrides,
  };
}

function buildResult(evidence?: CompletionEvidence): ToolExecutionResult {
  return {
    toolName: 'createNote',
    output: { noteId: 'note-123' },
    durationMs: 10,
    toolCallId: 'call-0001',
    evidence,
  };
}

function verifiedEvidence(): CompletionEvidence {
  return {
    id: 'ev-1',
    operationId: 'op-replan-001',
    toolCallId: 'call-0001',
    toolName: 'createNote',
    verified: true,
    verifierType: 'schema',
    checks: [{ checkId: 'c1', name: 'postcondition holds', passed: true }],
    verifiedAt: 100,
    durationMs: 5,
  };
}

function unverifiedEvidence(
  failureReason: Extract<CompletionEvidence, { verified: false }>['failureReason'],
  retryable: boolean,
): CompletionEvidence {
  return {
    id: 'ev-1',
    operationId: 'op-replan-001',
    toolCallId: 'call-0001',
    toolName: 'createNote',
    verified: false,
    failureReason,
    retryable,
    verifiedAt: 100,
    durationMs: 5,
  };
}

/** Recursively deep-freezes an input so purity violations throw or corrupt nothing. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

describe('evaluateReplan', () => {
  it('terminates before every other rule when the turn is aborted or cancelled', () => {
    expect(evaluateReplan(buildContext({ aborted: true }))).toBe('terminate');
    expect(
      evaluateReplan(
        buildContext({
          aborted: true,
          cause: projection('PROVIDER_TIMEOUT'),
          effectKnownNotStarted: true,
          replanCount: 0,
        }),
      ),
    ).toBe('terminate');
  });

  it('terminates on an ABORTED cause', () => {
    expect(evaluateReplan(buildContext({ cause: projection('ABORTED') }))).toBe('terminate');
  });

  it('gives permission/auth/schema/unknown-tool/invalid-input/idempotency failures terminal priority', () => {
    const codes: PipelineErrorCode[] = [
      'PROVIDER_AUTH',
      'SCHEMA_INVALID',
      'NO_SUCH_TOOL',
      'INVALID_TOOL_INPUT',
      'TOOL_IDEMPOTENCY_CONFLICT',
    ];
    for (const code of codes) {
      expect(evaluateReplan(buildContext({ cause: projection(code) }))).toBe('terminate');
    }
  });

  it('terminates on any failure after an irreversible tool starts or may have taken effect', () => {
    expect(
      evaluateReplan(
        buildContext({ sideEffect: 'irreversible', cause: projection('PROVIDER_TIMEOUT') }),
      ),
    ).toBe('terminate');
    expect(
      evaluateReplan(
        buildContext({
          sideEffect: 'irreversible',
          priorToolResults: [buildResult(unverifiedEvidence('postcondition_failed', false))],
        }),
      ),
    ).toBe('terminate');
  });

  it('does not block continuation after a verified irreversible tool succeeds', () => {
    expect(
      evaluateReplan(
        buildContext({
          sideEffect: 'irreversible',
          priorToolResults: [buildResult(verifiedEvidence())],
        }),
      ),
    ).toBe('continue-planning');
  });

  it('continues planning after verified success without incrementing replanCount', () => {
    expect(
      evaluateReplan(buildContext({ priorToolResults: [buildResult(verifiedEvidence())] })),
    ).toBe('continue-planning');
  });

  it('continues planning after an ordinary non-side-effecting success with no evidence', () => {
    expect(
      evaluateReplan(
        buildContext({
          sideEffect: 'read',
          priorToolResults: [buildResult(undefined)],
        }),
      ),
    ).toBe('continue-planning');
  });

  it('replans exactly once for a retryable failed-before-effect execution failure', () => {
    expect(
      evaluateReplan(
        buildContext({ cause: projection('PROVIDER_TIMEOUT'), effectKnownNotStarted: true }),
      ),
    ).toBe('replan');
  });

  it('never replays a retryable execution failure whose effect state is unknown', () => {
    expect(
      evaluateReplan(
        buildContext({ cause: projection('PROVIDER_TIMEOUT'), effectKnownNotStarted: false }),
      ),
    ).toBe('render');
    expect(
      evaluateReplan(buildContext({ cause: projection('PROVIDER_TIMEOUT') })),
    ).toBe('render');
  });

  it('replans exactly once for a retryable verification failure (verifier timeout)', () => {
    expect(
      evaluateReplan(
        buildContext({
          priorToolResults: [buildResult(unverifiedEvidence('verification_timeout', true))],
        }),
      ),
    ).toBe('replan');
  });

  it('renders instead of a second recovery pass (one-replan cap)', () => {
    expect(
      evaluateReplan(
        buildContext({
          replanCount: 1,
          cause: projection('PROVIDER_TIMEOUT'),
          effectKnownNotStarted: true,
        }),
      ),
    ).toBe('render');
    expect(
      evaluateReplan(
        buildContext({
          replanCount: 1,
          priorToolResults: [buildResult(unverifiedEvidence('verification_timeout', true))],
        }),
      ),
    ).toBe('render');
  });

  it('continues planning after a verified success even when a recovery pass already happened', () => {
    expect(
      evaluateReplan(
        buildContext({ replanCount: 1, priorToolResults: [buildResult(verifiedEvidence())] }),
      ),
    ).toBe('continue-planning');
  });

  it('renders when the planner or tool cap is reached', () => {
    expect(
      evaluateReplan(
        buildContext({
          caps: {
            plannerCalls: 5,
            plannerCap: 5,
            plannerCapReached: true,
            toolCalls: 1,
            toolCap: 3,
            toolCapReached: false,
          },
          priorToolResults: [buildResult(verifiedEvidence())],
        }),
      ),
    ).toBe('render');
    expect(
      evaluateReplan(
        buildContext({
          caps: {
            plannerCalls: 1,
            plannerCap: 5,
            plannerCapReached: false,
            toolCalls: 3,
            toolCap: 3,
            toolCapReached: true,
          },
        }),
      ),
    ).toBe('render');
  });

  it('renders partial on failed verification without retry permission', () => {
    expect(
      evaluateReplan(
        buildContext({
          priorToolResults: [buildResult(unverifiedEvidence('postcondition_failed', false))],
        }),
      ),
    ).toBe('render');
    expect(
      evaluateReplan(
        buildContext({
          priorToolResults: [buildResult(unverifiedEvidence('evidence_unavailable', false))],
        }),
      ),
    ).toBe('render');
  });

  it('renders on terminal technical failures outside the explicit terminate set', () => {
    expect(evaluateReplan(buildContext({ cause: projection('MODEL_UNKNOWN') }))).toBe('render');
    expect(evaluateReplan(buildContext({ cause: projection('TIER_CAP_REACHED') }))).toBe('render');
    expect(evaluateReplan(buildContext({ cause: projection('UNKNOWN') }))).toBe('render');
  });

  it('never returns an ambiguous disposition — every input resolves to the four-item union', () => {
    const outputs = [
      evaluateReplan(buildContext({ aborted: true })),
      evaluateReplan(buildContext({ cause: projection('PROVIDER_AUTH') })),
      evaluateReplan(buildContext({ sideEffect: 'irreversible', cause: projection('UNKNOWN') })),
      evaluateReplan(buildContext({ priorToolResults: [buildResult(verifiedEvidence())] })),
      evaluateReplan(buildContext({ cause: projection('PROVIDER_TIMEOUT'), effectKnownNotStarted: true })),
      evaluateReplan(buildContext({ cause: projection('PROVIDER_TIMEOUT') })),
      evaluateReplan(buildContext({ replanCount: 2, cause: projection('PROVIDER_TIMEOUT'), effectKnownNotStarted: true })),
      evaluateReplan(buildContext()),
    ];
    for (const output of outputs) {
      expect(DISPOSITIONS).toContain(output);
    }
    expect(new Set(outputs)).toEqual(new Set(DISPOSITIONS));
  });

  it('is pure: deep-frozen input is never mutated and repeated calls are deterministic', () => {
    const context = deepFreeze(
      buildContext({
        cause: projection('PROVIDER_TIMEOUT'),
        effectKnownNotStarted: true,
        priorToolResults: [deepFreeze(buildResult(deepFreeze(verifiedEvidence())))],
      }),
    );

    const first = evaluateReplan(context);
    const second = evaluateReplan(context);

    expect(first).toBe('replan');
    expect(second).toBe(first);
    expect(context.replanCount).toBe(0);
  });
});
