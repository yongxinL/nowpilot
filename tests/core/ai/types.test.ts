import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ALLOWED_TRANSITIONS,
  AGENT_TRAJECTORY_STATES,
  type AgentTrajectoryState,
  type CompletionEvidence,
  type PermissionDecision,
  type PermissionRequest,
  type RegisteredTool,
  type ReplanContext,
  type ToolExecutionResult,
  type ToolSchemaInfo,
} from '../../../src/core/ai/types';
import { PipelineError, projectPipelineError, type PipelineErrorProjection } from '../../../src/core/ai/PipelineError';
import {
  AgentTurnOutcomeSchema,
  CompletionEvidenceSchema,
  createAgentTurnOutcome,
  AGENT_TERMINAL_STATES,
  AGENT_TURN_REASON_CODES,
  OUTCOME_WARNING_RENDERER_EVIDENCE_CONTRADICTION,
} from '../../../src/core/ai/AgentTurnOutcome';

const TEN_STATES = [
  'assembling-context',
  'planning',
  'waiting-for-permission',
  'executing',
  'verifying',
  'replanning',
  'rendering',
  'completed',
  'failed',
  'aborted',
] as const;

const D04_EXPECTED: Record<string, string[]> = {
  'assembling-context': ['planning', 'failed', 'aborted'],
  planning: ['waiting-for-permission', 'executing', 'rendering', 'failed', 'aborted'],
  'waiting-for-permission': ['executing', 'rendering', 'failed', 'aborted'],
  executing: ['verifying', 'replanning', 'rendering', 'failed', 'aborted'],
  verifying: ['replanning', 'rendering', 'failed', 'aborted'],
  replanning: ['planning', 'rendering', 'failed', 'aborted'],
  rendering: ['completed', 'failed', 'aborted'],
  completed: [],
  failed: [],
  aborted: [],
};

function minimalOutcome(overrides: Record<string, unknown> = {}): unknown {
  return {
    operationId: 'op-1',
    terminalState: 'completed',
    reasonCode: 'planner_answer',
    renderedAnswer: 'done',
    trajectory: [],
    evidence: [],
    toolResults: [],
    limits: {
      plannerCalls: 1,
      plannerCap: 3,
      plannerCapReached: false,
      toolCalls: 0,
      toolCap: 2,
      toolCapReached: false,
    },
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCost: 0.001, currency: 'USD' },
    diagnostics: { errors: [], warnings: [] },
    startedAt: 1000,
    endedAt: 2000,
    durationMs: 1000,
    ...overrides,
  };
}

describe('AgentTurnOutcome contract', () => {
  it('accepts a comprehensive outcome carrying every D-02 field', () => {
    const verifiedEvidence: CompletionEvidence = {
      id: 'ev-1',
      operationId: 'op-1',
      toolCallId: 'tc-1',
      toolName: 'writeNote',
      verified: true,
      verifierType: 'read-after-write',
      checks: [{ checkId: 'c-1', name: 'note exists', passed: true, expected: true, actualRef: 'notes/abc' }],
      resultRef: { type: 'note', ref: 'abc' },
      verifiedAt: 1500,
      durationMs: 120,
    };
    const unverifiedEvidence: CompletionEvidence = {
      id: 'ev-2',
      operationId: 'op-1',
      toolCallId: 'tc-2',
      toolName: 'sendEmail',
      verified: false,
      failureReason: 'postcondition_failed',
      retryable: true,
      verifiedAt: 1600,
      durationMs: 80,
    };
    const outcome = minimalOutcome({
      terminalState: 'partial',
      reasonCode: 'tool_cap_reached',
      renderedAnswer: 'partial answer',
      trajectory: [
        {
          state: 'assembling-context',
          enteredAt: 1000,
          exitedAt: 1010,
          durationMs: 10,
        },
        {
          state: 'executing',
          enteredAt: 1010,
          exitedAt: null,
          durationMs: null,
          toolCall: 1,
          toolName: 'writeNote',
        },
      ],
      evidence: [verifiedEvidence, unverifiedEvidence],
      toolResults: [
        { toolName: 'writeNote', output: { ok: true }, durationMs: 120, toolCallId: 'tc-1' },
      ],
      limits: {
        plannerCalls: 3,
        plannerCap: 3,
        plannerCapReached: true,
        toolCalls: 2,
        toolCap: 2,
        toolCapReached: true,
      },
      abort: { requested: true, requestedAt: 1700, stage: 'executing', origin: 'user' },
      diagnostics: { errors: ['boom'], warnings: [OUTCOME_WARNING_RENDERER_EVIDENCE_CONTRADICTION] },
    });
    const parsed = AgentTurnOutcomeSchema.safeParse(outcome);
    expect(parsed.success).toBe(true);
  });

  it('accepts every canonical reason code', () => {
    for (const code of AGENT_TURN_REASON_CODES) {
      const overrides: Record<string, unknown> = { reasonCode: code };
      if (code === 'user_aborted' || code === 'caller_aborted') {
        overrides.terminalState = 'aborted';
        overrides.renderedAnswer = null;
      }
      const result = AgentTurnOutcomeSchema.safeParse(minimalOutcome(overrides));
      expect(result.success, `reason code ${code} should parse`).toBe(true);
    }
  });

  it('rejects an unknown reason code', () => {
    const result = AgentTurnOutcomeSchema.safeParse(minimalOutcome({ reasonCode: 'planner_invented' }));
    expect(result.success).toBe(false);
  });

  it('accepts every terminal state', () => {
    for (const state of AGENT_TERMINAL_STATES) {
      const overrides: Record<string, unknown> = { terminalState: state };
      if (state === 'aborted') {
        overrides.renderedAnswer = null;
      }
      const result = AgentTurnOutcomeSchema.safeParse(minimalOutcome(overrides));
      expect(result.success, `terminal state ${state} should parse`).toBe(true);
    }
  });

  it('rejects an unknown terminal state', () => {
    const result = AgentTurnOutcomeSchema.safeParse(minimalOutcome({ terminalState: 'crashed' }));
    expect(result.success).toBe(false);
  });

  it('rejects a missing or empty operationId', () => {
    const { operationId: _omitted, ...withoutOpId } = minimalOutcome() as { operationId: string };
    expect(AgentTurnOutcomeSchema.safeParse(withoutOpId).success).toBe(false);
    expect(AgentTurnOutcomeSchema.safeParse(minimalOutcome({ operationId: '' })).success).toBe(false);
  });

  it('rejects malformed trajectory entries', () => {
    const badState = minimalOutcome({
      trajectory: [{ state: 'bogus-state', enteredAt: 1000, exitedAt: null, durationMs: null }],
    });
    expect(AgentTurnOutcomeSchema.safeParse(badState).success).toBe(false);

    const missingState = minimalOutcome({
      trajectory: [{ enteredAt: 1000, exitedAt: null, durationMs: null }],
    });
    expect(AgentTurnOutcomeSchema.safeParse(missingState).success).toBe(false);

    const stringTimestamp = minimalOutcome({
      trajectory: [{ state: 'planning', enteredAt: '1000', exitedAt: null, durationMs: null }],
    });
    expect(AgentTurnOutcomeSchema.safeParse(stringTimestamp).success).toBe(false);
  });

  it('rejects mismatched evidence discriminators and unknown variants', () => {
    const base = {
      id: 'ev-1',
      operationId: 'op-1',
      toolCallId: 'tc-1',
      toolName: 'writeNote',
      verifiedAt: 1500,
      durationMs: 100,
    };
    const verifiedWithFailure = {
      ...base,
      verified: true,
      verifierType: 'read-after-write',
      checks: [],
      failureReason: 'aborted',
    };
    expect(CompletionEvidenceSchema.safeParse(verifiedWithFailure).success).toBe(false);

    const unknownVerifier = {
      ...base,
      verified: true,
      verifierType: 'llm-judge',
      checks: [],
    };
    expect(CompletionEvidenceSchema.safeParse(unknownVerifier).success).toBe(false);

    const unknownFailure = {
      ...base,
      verified: false,
      failureReason: 'mystery',
      retryable: false,
    };
    expect(CompletionEvidenceSchema.safeParse(unknownFailure).success).toBe(false);

    const stringDiscriminator = { ...base, verified: 'true', verifierType: 'schema', checks: [] };
    expect(CompletionEvidenceSchema.safeParse(stringDiscriminator).success).toBe(false);
  });

  it('rejects evidence checks carrying unrestricted fields', () => {
    const rawOutputCarryingCheck = {
      id: 'ev-1',
      operationId: 'op-1',
      toolCallId: 'tc-1',
      toolName: 'writeNote',
      verified: true,
      verifierType: 'tool-provided',
      checks: [
        {
          checkId: 'c-1',
          name: 'exists',
          passed: true,
          rawOutput: { secret: 'hunter2' },
        },
      ],
      verifiedAt: 1500,
      durationMs: 100,
    };
    expect(CompletionEvidenceSchema.safeParse(rawOutputCarryingCheck).success).toBe(false);
  });

  it('rejects incomplete outcome timestamps', () => {
    const { startedAt: _s, ...noStartedAt } = minimalOutcome() as { startedAt: number };
    expect(AgentTurnOutcomeSchema.safeParse(noStartedAt).success).toBe(false);

    const { endedAt: _e, ...noEndedAt } = minimalOutcome() as { endedAt: number };
    expect(AgentTurnOutcomeSchema.safeParse(noEndedAt).success).toBe(false);

    const { durationMs: _d, ...noDuration } = minimalOutcome() as { durationMs: number };
    expect(AgentTurnOutcomeSchema.safeParse(noDuration).success).toBe(false);

    const missingEvidenceTimestamp = minimalOutcome({
      evidence: [
        {
          id: 'ev-1',
          operationId: 'op-1',
          toolCallId: 'tc-1',
          toolName: 'writeNote',
          verified: true,
          verifierType: 'schema',
          checks: [],
          durationMs: 10,
        },
      ],
    });
    expect(AgentTurnOutcomeSchema.safeParse(missingEvidenceTimestamp).success).toBe(false);
  });

  it('rejects a non-null rendered answer on an aborted outcome', () => {
    const result = AgentTurnOutcomeSchema.safeParse(
      minimalOutcome({ terminalState: 'aborted', reasonCode: 'user_aborted', renderedAnswer: 'success!' }),
    );
    expect(result.success).toBe(false);
  });

  it('createAgentTurnOutcome produces a valid comprehensive outcome', () => {
    const outcome = createAgentTurnOutcome({
      operationId: 'op-1',
      terminalState: 'completed',
      reasonCode: 'completion_verified',
      renderedAnswer: 'done',
      limits: { plannerCalls: 2, toolCalls: 1, toolCapReached: false },
    });
    expect(AgentTurnOutcomeSchema.safeParse(outcome).success).toBe(true);
    expect(outcome.trajectory).toEqual([]);
    expect(outcome.diagnostics).toEqual({ errors: [], warnings: [] });
    expect(outcome.usage.currency).toBe('USD');
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
    expect(outcome.limits.plannerCap).toBeGreaterThan(0);
    expect(outcome.limits.toolCap).toBeGreaterThan(0);
  });

  it('createAgentTurnOutcome rejects an aborted outcome with a rendered answer', () => {
    expect(() =>
      createAgentTurnOutcome({
        operationId: 'op-1',
        terminalState: 'aborted',
        reasonCode: 'user_aborted',
        renderedAnswer: 'hello',
      }),
    ).toThrow();
  });

  it('exposes the bounded renderer evidence contradiction warning', () => {
    expect(OUTCOME_WARNING_RENDERER_EVIDENCE_CONTRADICTION).toBe('RENDERER_EVIDENCE_CONTRADICTION');
  });
});

describe('Trajectory contract', () => {
  it('defines exactly the ten Phase 3a states', () => {
    expect(AGENT_TRAJECTORY_STATES).toHaveLength(10);
    expect([...AGENT_TRAJECTORY_STATES].sort()).toEqual([...TEN_STATES].sort());
  });

  it('ALLOWED_TRANSITIONS matches D-04 exactly with empty terminal allowlists', () => {
    for (const state of AGENT_TRAJECTORY_STATES) {
      const actual = [...ALLOWED_TRANSITIONS[state]].sort();
      expect(actual, `allowlist for ${state}`).toEqual([...D04_EXPECTED[state]].sort());
    }
  });

  it('has no self-edges and every target is a valid state', () => {
    const validStates = new Set<string>(AGENT_TRAJECTORY_STATES);
    for (const state of AGENT_TRAJECTORY_STATES) {
      for (const target of ALLOWED_TRANSITIONS[state]) {
        expect(target, `target of ${state}`).not.toBe(state);
        expect(validStates.has(target), `target ${target} of ${state} must be a known state`).toBe(true);
      }
    }
  });

  it('typed AgentTrajectoryState accepts each of the ten states', () => {
    const state: AgentTrajectoryState = 'replanning';
    expect(ALLOWED_TRANSITIONS[state]).toBeDefined();
  });
});

describe('Reliability metadata contracts', () => {
  it('RegisteredTool exposes exactly the three Phase 3a reliability fields', () => {
    const tool: RegisteredTool = {
      name: 'writeNote',
      description: 'writes a note',
      inputSchema: {},
      execute: async () => null,
      sideEffect: 'write',
      idempotency: 'required',
      evidence: {
        required: true,
        verifier: {
          type: 'read-after-write',
          check: async () => [{ checkId: 'c-1', name: 'exists', passed: true }],
        },
      },
    };
    expect(tool.sideEffect).toBe('write');
    expect(tool.idempotency).toBe('required');
    expect(tool.evidence?.verifier?.type).toBe('read-after-write');
  });

  it('excludes Phase 8a ToolCapabilityManifest fields from RegisteredTool and ToolSchemaInfo (compile-time gate)', () => {
    // Compile-time guard: each assignment only type-checks while NONE of
    // the Phase 8a manifest keys exist on the target type. If a manifest
    // field is ever added, `pnpm lint` (tsc --noEmit) fails on this file.
    type ManifestKeys =
      | 'category'
      | 'risk'
      | 'permissions'
      | 'dataScopes'
      | 'timeout'
      | 'costClass'
      | 'schemaHashes'
      | 'discovery';
    type NoManifestFields<T> = [keyof T & ManifestKeys] extends [never] ? true : false;
    const _registeredToolHasNoManifestFields: NoManifestFields<RegisteredTool> = true;
    const _schemaInfoHasNoManifestFields: NoManifestFields<ToolSchemaInfo> = true;
    expect(_registeredToolHasNoManifestFields).toBe(true);
    expect(_schemaInfoHasNoManifestFields).toBe(true);
  });

  it('ToolSchemaInfo carries the same three reliability fields as the adapter handoff', () => {
    const schemaInfo: ToolSchemaInfo = {
      name: 'writeNote',
      description: 'writes a note',
      jsonSchema: { type: 'object' },
      sideEffect: 'write',
      idempotency: 'supported',
      evidence: { required: false },
    };
    expect(schemaInfo.sideEffect).toBe('write');
    expect(schemaInfo.idempotency).toBe('supported');
    expect(schemaInfo.evidence?.required).toBe(false);
  });

  it('ToolExecutionResult references a toolCallId', () => {
    const result: ToolExecutionResult = {
      toolName: 'writeNote',
      output: { ok: true },
      durationMs: 10,
      toolCallId: 'tc-1',
    };
    expect(result.toolCallId).toBe('tc-1');
  });

  it('permission decisions cover granted, denied, and cancelled with origin attribution', () => {
    const granted: PermissionDecision = { decision: 'granted' };
    const deniedByUser: PermissionDecision = { decision: 'denied', origin: 'user' };
    const cancelledByCaller: PermissionDecision = { decision: 'cancelled', origin: 'caller' };
    expect(granted.decision).toBe('granted');
    expect(deniedByUser.origin).toBe('user');
    expect(cancelledByCaller.origin).toBe('caller');

    const request: PermissionRequest = {
      toolName: 'writeNote',
      operationId: 'op-1',
      toolCallId: 'tc-1',
      sideEffect: 'irreversible',
      reason: 'deletes the note',
    };
    expect(request.sideEffect).toBe('irreversible');
  });

  it('ReplanContext carries redacted observations without raw keys', () => {
    const context: ReplanContext = {
      operationId: 'op-1',
      replanCount: 1,
      toolName: 'writeNote',
      toolCallId: 'tc-1',
      priorToolResults: [{ toolName: 'writeNote', output: null, durationMs: 5, toolCallId: 'tc-1' }],
    };
    expect(context.replanCount).toBe(1);
    expect(context.priorToolResults).toHaveLength(1);
  });
});

describe('PipelineError technical codes and safe projection', () => {
  const NEW_TERMINAL_CODES = [
    'AGENT_STATE_INVALID',
    'TOOL_POSTCONDITION_FAILED',
    'COMPLETION_EVIDENCE_MISSING',
    'TOOL_IDEMPOTENCY_CONFLICT',
  ] as const;

  it('maps every new Phase 3a code to terminal', () => {
    for (const code of NEW_TERMINAL_CODES) {
      const err = new PipelineError(code, `[${code}] happened`, { toolName: 't' });
      expect(err.category, code).toBe('terminal');
      expect(err.retryable, code).toBe(false);
      expect(PipelineError.isRetryable(err), code).toBe(false);
    }
  });

  it('leaves existing retryable and terminal classifications unchanged', () => {
    expect(new PipelineError('PROVIDER_TIMEOUT', 'x').category).toBe('retryable');
    expect(new PipelineError('PROVIDER_5XX', 'x').category).toBe('retryable');
    expect(new PipelineError('NETWORK', 'x').category).toBe('retryable');
    expect(new PipelineError('RATE_LIMITED', 'x').category).toBe('retryable');
    expect(new PipelineError('CIRCUIT_OPEN', 'x').category).toBe('retryable');
    expect(new PipelineError('ABORTED', 'x').category).toBe('terminal');
    expect(new PipelineError('UNKNOWN', 'x').category).toBe('terminal');
    expect(new PipelineError('SCHEMA_INVALID', 'x').category).toBe('terminal');
  });

  it('projectPipelineError preserves technical classification only', () => {
    const err = new PipelineError('TOOL_IDEMPOTENCY_CONFLICT', 'Tool "x" has an unresolved prior execution.', {
      toolName: 'x',
      operationId: 'op-secret',
      originalError: 'stack trace with secrets',
      rawInput: { password: 'hunter2' },
      key: 'op-secret:x:{...}',
    });
    const projection: PipelineErrorProjection = projectPipelineError(err);
    expect(projection.code).toBe('TOOL_IDEMPOTENCY_CONFLICT');
    expect(projection.category).toBe('terminal');
    expect(projection.retryable).toBe(false);
    expect(projection.timestamp).toBe(err.timestamp);
    expect(projection.message).toContain('unresolved');
    expect('diagnostic' in projection).toBe(false);
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('op-secret');
    expect(serialized).not.toContain('stack trace');
  });

  it('projectPipelineError bounds the user-facing message', () => {
    const long = new PipelineError('NO_SUCH_TOOL', 'x'.repeat(5000), { toolName: 'x' });
    const projection = projectPipelineError(long);
    expect(projection.message.length).toBeLessThanOrEqual(281);
    expect(projection.message.startsWith('x'.repeat(100))).toBe(true);
  });

  it('projectPipelineError never carries the raw Error message or diagnostics', () => {
    const err = new PipelineError('AGENT_STATE_INVALID', 'invalid transition', { from: 'planning', to: 'completed' });
    const projection = projectPipelineError(err);
    expect(projection.message).toBe('invalid transition');
    expect(projection.message).not.toContain('[AGENT_STATE_INVALID] invalid transition');
    expect(JSON.stringify(projection)).not.toContain('from');
  });

  it('the closed reason-code union is a Zod enum-compatible tuple', () => {
    const schema = z.enum(AGENT_TURN_REASON_CODES);
    expect(schema.safeParse('planner_answer').success).toBe(true);
    expect(schema.safeParse('not-a-code').success).toBe(false);
  });
});
