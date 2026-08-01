import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PipelineError } from '../../src/core/ai/PipelineError';
import { AgentTrajectoryMachine } from '../../src/core/ai/AgentTrajectoryMachine';
import { ExecutorService } from '../../src/core/ai/ExecutorService';
import {
  OutcomeVerifier,
  OUTCOME_VERIFIER_TIMEOUT_MS,
  outcomeVerifier,
} from '../../src/core/ai/verifier/OutcomeVerifier';
import { buildRenderingOutcomePolicy, enforceRenderingOutcomePolicy } from '../../src/core/ai/RenderingOutcomePolicy';
import { evaluateReplan } from '../../src/core/ai/ReplanPolicy';
import { createAgentTurnOutcome, AgentTurnOutcomeSchema } from '../../src/core/ai/AgentTurnOutcome';
import { createAgentTurnInput } from '../../src/core/ai/AgentTurnInput';
import type {
  AgentTurnInput,
  CompletionEvidence,
  EvidenceFailureReason,
  PlannerDecision,
  RegisteredTool,
  ToolExecutionResult,
  ToolSchemaInfo,
} from '../../src/core/ai/types';

/**
 * Phase 3a adversarial security regression suite (03a-05). Exercises the
 * completed harness across all six STRIDE categories through public APIs —
 * real policies, real verifier, real executor, and the real orchestrator
 * behind mocked provider/planner/renderer services. The suite also fences
 * Phase 8a scope: it asserts the phase does NOT expose durable governance,
 * discovery, or long-running operation contracts. Assertions target public
 * contracts (outcomes, policies, errors), never private helper names, so
 * later phases can extend implementations without weakening these bounds.
 */

const ADAPTER = {
  providerId: 'openai',
  createLanguageModel: vi.fn(),
  validateConnection: vi.fn(),
  supportsStructuredOutput: true,
  getDefaultModelForTier: vi.fn(() => 'gpt-4o-mini'),
  getCacheStrategy: vi.fn(() => 'prefix-only' as const),
  getTelemetryMetadata: vi.fn(() => ({ provider: 'openai' })),
};

vi.mock('../../src/core/ai/ProviderRouter', () => ({
  providerRouter: {
    selectProvider: vi.fn().mockResolvedValue({ adapter: ADAPTER, providerId: 'openai' }),
  },
}));

vi.mock('../../src/core/ai/PlannerService', () => ({
  plannerService: { plan: vi.fn() },
}));

// Keep the real ExecutorService class for direct ledger tests while mocking
// only the module singleton the orchestrator consumes.
vi.mock('../../src/core/ai/ExecutorService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/ai/ExecutorService')>();
  return {
    ...actual,
    executorService: { execute: vi.fn(), attachEvidence: vi.fn(), executeBatch: vi.fn() },
  };
});

vi.mock('../../src/core/ai/RendererService', () => ({
  rendererService: { synthesize: vi.fn().mockResolvedValue('Mocked renderer response') },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const READ_TOOL: ToolSchemaInfo = {
  name: 'getWeather',
  description: 'Get weather for a city',
  jsonSchema: { type: 'object', properties: { city: { type: 'string' } } },
  execute: async () => ({ temp: 22 }),
  sideEffect: 'read',
  idempotency: 'not-required',
  evidence: { required: false },
};

const WRITE_VERIFIER = {
  type: 'schema' as const,
  check: async () => [{ checkId: 'c1', name: 'saved', passed: true }],
};

const WRITE_TOOL: ToolSchemaInfo = {
  name: 'saveNote',
  description: 'Save a note',
  jsonSchema: {},
  execute: async () => ({ saved: true }),
  sideEffect: 'write',
  idempotency: 'required',
  evidence: {
    required: true,
    verifier: WRITE_VERIFIER,
  },
};

const FAILING_WRITE_TOOL: ToolSchemaInfo = {
  ...WRITE_TOOL,
  evidence: {
    required: true,
    verifier: {
      type: 'schema',
      check: async () => [{ checkId: 'c1', name: 'saved', passed: false }],
    },
  },
};

const IRREVERSIBLE_TOOL: ToolSchemaInfo = {
  name: 'deleteWorkspace',
  description: 'Delete the workspace',
  jsonSchema: {},
  execute: async () => ({ deleted: true }),
  sideEffect: 'irreversible',
  idempotency: 'required',
  evidence: { required: true, verifier: WRITE_VERIFIER },
};

/** Tool schema that omits the mandatory Phase 3a reliability metadata. */
const ROGUE_TOOL: ToolSchemaInfo = {
  name: 'rogueTool',
  description: 'Tool missing sideEffect/idempotency/evidence metadata',
  jsonSchema: {},
};

function buildTurnInput(overrides: Partial<AgentTurnInput> = {}): AgentTurnInput {
  return createAgentTurnInput({
    providerId: 'openai',
    tier: 'FAST',
    model: 'gpt-4o-mini',
    modelContextWindow: 128000,
    userInput: 'Test message',
    ...overrides,
  });
}

function toolResult(toolName: string, overrides: Partial<ToolExecutionResult> = {}): ToolExecutionResult {
  return {
    toolName,
    output: { ok: true },
    durationMs: 10,
    toolCallId: 'call-1',
    ...overrides,
  };
}

function makeVerifiedEvidence(operationId: string, toolCallId: string, toolName: string): CompletionEvidence {
  return {
    id: `ev-${operationId}-${toolCallId}`,
    operationId,
    toolCallId,
    toolName,
    verified: true,
    verifierType: 'read-after-write',
    checks: [{ checkId: 'c1', name: 'exists', passed: true }],
    verifiedAt: 1,
    durationMs: 1,
  };
}

function makeUnverifiedEvidence(
  operationId: string,
  toolCallId: string,
  toolName: string,
  failureReason: EvidenceFailureReason = 'postcondition_failed',
): CompletionEvidence {
  return {
    id: `ev-${operationId}-${toolCallId}`,
    operationId,
    toolCallId,
    toolName,
    verified: false,
    failureReason,
    retryable: false,
    verifiedAt: 1,
    durationMs: 1,
  };
}

function realTool(overrides: Partial<RegisteredTool> = {}): RegisteredTool {
  return {
    name: 'writeNote',
    description: 'Write a note',
    // Plain JSON schema: ExecutorService wraps it in z.object({}).passthrough(),
    // which rejects non-object input (INVALID_TOOL_INPUT) while accepting
    // any object shape.
    inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
    execute: vi.fn(async () => ({ saved: true })),
    sideEffect: 'write',
    idempotency: 'required',
    ...overrides,
  };
}

async function runOrchestrator(input: AgentTurnInput) {
  const { agentOrchestrator } = await import('../../src/core/ai/AgentOrchestrator');
  return agentOrchestrator.runTurn(input);
}

async function mockPlanner(decision: PlannerDecision) {
  const { plannerService } = await import('../../src/core/ai/PlannerService');
  (plannerService.plan as any).mockResolvedValue(decision);
  return plannerService;
}

async function mockExecutor() {
  const { executorService } = await import('../../src/core/ai/ExecutorService');
  return executorService as any;
}

beforeEach(async () => {
  vi.resetAllMocks();
  const { providerRouter } = await import('../../src/core/ai/ProviderRouter');
  (providerRouter.selectProvider as any).mockResolvedValue({ adapter: ADAPTER, providerId: 'openai' });
  const { rendererService } = await import('../../src/core/ai/RendererService');
  (rendererService.synthesize as any).mockResolvedValue('Mocked renderer response');
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// Spoofing (T-03a-31)
// ─────────────────────────────────────────────────────────────────────────────

describe('STRIDE — Spoofing (T-03a-31)', () => {
  it('evidence for one operation cannot validate a different operation\'s write', () => {
    const foreign = makeVerifiedEvidence('op-a', 'call-1', 'saveNote');
    const policy = buildRenderingOutcomePolicy({
      operationId: 'op-b',
      toolCallId: 'call-1',
      toolName: 'saveNote',
      sideEffect: 'write',
      evidence: [foreign],
    });

    expect(policy.verifiedCompletionAllowed).toBe(false);
    expect(policy.completionClaimForbidden).toBe(true);
    expect(policy.blockedCondition).toBe('no-evidence');
    expect(policy.verifiedReferences).not.toContain('call-1');
    expect(policy.unverifiedReferences).not.toContain('call-1');
    expect(policy.fallbackAnswer).not.toBeNull();
  });

  it('evidence for one toolCallId cannot validate a different toolCallId\'s write', () => {
    const otherCall = makeVerifiedEvidence('op-1', 'call-1', 'saveNote');
    const policy = buildRenderingOutcomePolicy({
      operationId: 'op-1',
      toolCallId: 'call-2',
      toolName: 'saveNote',
      sideEffect: 'write',
      evidence: [otherCall],
    });

    expect(policy.verifiedCompletionAllowed).toBe(false);
    expect(policy.completionClaimForbidden).toBe(true);
    expect(policy.blockedCondition).toBe('no-evidence');
  });

  it('attachEvidence rejects spoofed operationId/toolName and cannot overwrite cached evidence', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = realTool({ execute });
    const executor = new ExecutorService();

    const first = await executor.execute('writeNote', { title: 'a' }, [tool], undefined, 30_000, 'op-1');
    const evidence = makeVerifiedEvidence('op-1', first.toolCallId, 'writeNote');
    executor.attachEvidence(first.toolCallId, evidence);

    expect(() =>
      executor.attachEvidence(first.toolCallId, makeVerifiedEvidence('op-evil', first.toolCallId, 'writeNote')),
    ).toThrow(expect.objectContaining({ code: 'TOOL_POSTCONDITION_FAILED' }));
    expect(() =>
      executor.attachEvidence(first.toolCallId, makeVerifiedEvidence('op-1', first.toolCallId, 'evilTool')),
    ).toThrow(expect.objectContaining({ code: 'TOOL_POSTCONDITION_FAILED' }));

    // The completed duplicate still serves the ORIGINAL validated evidence —
    // the spoof never replaced it.
    const second = await executor.execute('writeNote', { title: 'a' }, [tool], undefined, 30_000, 'op-1');
    expect(second.evidence?.id).toBe(evidence.id);
  });

  it('an invalid trajectory transition is rejected as AGENT_STATE_INVALID, never silently accepted', () => {
    const machine = new AgentTrajectoryMachine();
    expect(() => machine.transitionTo('completed', { reasonCode: 'planner_answer' })).toThrow(
      expect.objectContaining({ code: 'AGENT_STATE_INVALID' }),
    );
    expect(machine.state).toBe('assembling-context');
  });

  it('the closed registry rejects a tool schema missing reliability metadata before any execution', async () => {
    const planner = await mockPlanner({ action: 'run_tool', toolName: 'rogueTool', input: {} });
    const executor = await mockExecutor();

    const outcome = await runOrchestrator(buildTurnInput({ selectedToolSchemas: [ROGUE_TOOL] }));

    expect(outcome.terminalState).toBe('failed');
    expect(outcome.reasonCode).toBe('pipeline_failed');
    expect(outcome.diagnostics.errors).toContain('SCHEMA_INVALID');
    expect(planner.plan).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tampering (T-03a-32)
// ─────────────────────────────────────────────────────────────────────────────

describe('STRIDE — Tampering (T-03a-32)', () => {
  it('trajectory history snapshots are immutable — mutation cannot corrupt machine state', () => {
    const machine = new AgentTrajectoryMachine();
    machine.transitionTo('planning', { plannerCall: 1 });

    const tampered = machine.history;
    (tampered[0] as any).state = 'completed';
    (tampered[1] as any).enteredAt = 0;
    (tampered[1] as any).reasonCode = 'forged';

    expect(machine.state).toBe('planning');
    const fresh = machine.history;
    expect(fresh[0].state).toBe('assembling-context');
    expect(fresh[1].enteredAt).toBeGreaterThan(0);
    expect(fresh[1].reasonCode).toBeUndefined();
  });

  it('terminal states are protected — further transitions are rejected after finalize or completion', () => {
    const finalized = new AgentTrajectoryMachine();
    finalized.transitionTo('planning');
    finalized.finalize();
    expect(() => finalized.transitionTo('rendering')).toThrow(
      expect.objectContaining({ code: 'AGENT_STATE_INVALID' }),
    );

    const completed = new AgentTrajectoryMachine();
    completed.transitionTo('planning');
    completed.transitionTo('rendering');
    completed.transitionTo('completed');
    expect(() => completed.transitionTo('planning')).toThrow(
      expect.objectContaining({ code: 'AGENT_STATE_INVALID' }),
    );
  });

  it('verifier output is schema-limited — unrestricted raw fields are discarded as verification_error', async () => {
    const tool = realTool({
      evidence: {
        required: true,
        verifier: {
          type: 'schema',
          check: async () => [
            {
              checkId: 'c1',
              name: 'holds',
              passed: true,
              rawOutput: { fullResponse: 'confidential tool payload' },
            },
          ] as never,
        },
      },
    });

    const evidence = await outcomeVerifier.verify(
      { toolName: 'writeNote', output: { saved: true }, durationMs: 1, toolCallId: 'call-1' },
      tool,
      'op-1',
    );

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('verification_error');
    }
    expect(JSON.stringify(evidence)).not.toContain('confidential');
  });

  it('the renderer contradiction policy replaces completion claims and never mutates evidence', () => {
    const evidence = makeUnverifiedEvidence('op-1', 'call-1', 'saveNote', 'postcondition_failed');
    const policy = buildRenderingOutcomePolicy({
      operationId: 'op-1',
      toolCallId: 'call-1',
      toolName: 'saveNote',
      sideEffect: 'write',
      evidence: [evidence],
    });

    expect(policy.completionClaimForbidden).toBe(true);
    const enforced = enforceRenderingOutcomePolicy('I saved the note successfully.', policy);

    expect(enforced.contradicted).toBe(true);
    expect(enforced.text).toBe(policy.fallbackAnswer);
    expect(enforced.text).toContain('could not confirm');
    // The policy derivation was not mutated by enforcement.
    expect(evidence.verified).toBe(false);
  });

  it('a renderer contradiction cannot upgrade terminal state or evidence in the real orchestrator', async () => {
    const planner = await mockPlanner({ action: 'run_tool', toolName: 'saveNote', input: { title: 'hello' } });
    const executor = await mockExecutor();
    const { rendererService } = await import('../../src/core/ai/RendererService');
    (planner.plan as any)
      .mockResolvedValueOnce({ action: 'run_tool', toolName: 'saveNote', input: { title: 'hello' } })
      .mockResolvedValueOnce({ action: 'answer', reasonCode: 'note_saved' });
    (executor.execute as any).mockResolvedValue(
      toolResult('saveNote', { output: { id: 'n1' }, toolCallId: 'call-1' }),
    );
    (rendererService.synthesize as any).mockResolvedValue('I saved the note successfully.');

    const outcome = await runOrchestrator(
      buildTurnInput({
        selectedToolSchemas: [FAILING_WRITE_TOOL],
        requestPermission: vi.fn().mockResolvedValue({ decision: 'granted' }),
      }),
    );

    expect(outcome.terminalState).toBe('partial');
    expect(outcome.reasonCode).toBe('completion_unverified');
    expect(outcome.diagnostics.warnings).toContain('RENDERER_EVIDENCE_CONTRADICTION');
    expect(outcome.renderedAnswer).toContain('could not confirm');
    expect(outcome.evidence).toHaveLength(1);
    expect(outcome.evidence[0].verified).toBe(false);
  });

  it('the outcome schema rejects a tampered aborted outcome that carries a rendered answer', () => {
    expect(() =>
      createAgentTurnOutcome({
        operationId: 'op-1',
        terminalState: 'aborted',
        reasonCode: 'caller_aborted',
        renderedAnswer: 'I did it.',
      }),
    ).toThrow();

    const valid = createAgentTurnOutcome({
      operationId: 'op-1',
      terminalState: 'completed',
      reasonCode: 'planner_answer',
      renderedAnswer: 'ok',
    });
    expect(AgentTurnOutcomeSchema.parse(valid)).toStrictEqual(valid);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Repudiation (T-03a-33)
// ─────────────────────────────────────────────────────────────────────────────

describe('STRIDE — Repudiation (T-03a-33)', () => {
  it('completed outcomes carry attributable identity, timestamps, and reason records', async () => {
    await mockPlanner({ action: 'answer', reasonCode: 'direct_answer' });

    const outcome = await runOrchestrator(buildTurnInput());

    expect(outcome.operationId.length).toBeGreaterThan(0);
    expect(outcome.reasonCode).toBe('planner_answer');
    expect(outcome.terminalState).toBe('completed');
    expect(outcome.trajectory.length).toBeGreaterThanOrEqual(3);
    for (const entry of outcome.trajectory) {
      expect(entry.enteredAt).toBeGreaterThan(0);
    }
    expect(outcome.trajectory[outcome.trajectory.length - 1].exitedAt).not.toBeNull();
    expect(outcome.startedAt).toBeGreaterThan(0);
    expect(outcome.endedAt).toBeGreaterThanOrEqual(outcome.startedAt);
    expect(outcome.limits.plannerCalls).toBe(1);
  });

  it('a user cancellation is attributed with the user origin in the abort record', async () => {
    const planner = await mockPlanner({ action: 'run_tool', toolName: 'saveNote', input: { title: 'hello' } });
    const executor = await mockExecutor();

    const outcome = await runOrchestrator(
      buildTurnInput({
        selectedToolSchemas: [WRITE_TOOL],
        requestPermission: vi.fn().mockResolvedValue({ decision: 'cancelled', origin: 'user' }),
      }),
    );

    expect(outcome.terminalState).toBe('aborted');
    expect(outcome.reasonCode).toBe('user_aborted');
    expect(outcome.abort?.origin).toBe('user');
    expect(executor.execute).not.toHaveBeenCalled();
    expect(planner.plan).toHaveBeenCalledTimes(1);
  });

  it('a caller cancellation is attributed with the caller origin in the abort record', async () => {
    await mockPlanner({ action: 'run_tool', toolName: 'saveNote', input: { title: 'hello' } });

    const outcome = await runOrchestrator(
      buildTurnInput({
        selectedToolSchemas: [WRITE_TOOL],
        requestPermission: vi.fn().mockResolvedValue({ decision: 'cancelled', origin: 'caller' }),
      }),
    );

    expect(outcome.terminalState).toBe('aborted');
    expect(outcome.reasonCode).toBe('caller_aborted');
    expect(outcome.abort?.origin).toBe('caller');
  });

  it('a permission denial terminates with an attributable reason and no execution', async () => {
    const planner = await mockPlanner({ action: 'run_tool', toolName: 'saveNote', input: { title: 'hello' } });
    const executor = await mockExecutor();

    const outcome = await runOrchestrator(
      buildTurnInput({
        selectedToolSchemas: [WRITE_TOOL],
        requestPermission: vi.fn().mockResolvedValue({ decision: 'denied', origin: 'user' }),
      }),
    );

    expect(outcome.terminalState).toBe('failed');
    expect(outcome.reasonCode).toBe('permission_denied');
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('recovery observations carry only allowlisted fields — never inputs, outputs, or ledger keys', async () => {
    const planner = await mockPlanner({ action: 'run_tool', toolName: 'getWeather', input: { city: 'Tokyo' } });
    const executor = await mockExecutor();
    (planner.plan as any)
      .mockResolvedValueOnce({ action: 'run_tool', toolName: 'getWeather', input: { city: 'Tokyo' } })
      .mockResolvedValueOnce({ action: 'answer', reasonCode: 'weather_report' });
    (executor.execute as any).mockRejectedValue(
      new PipelineError('PROVIDER_TIMEOUT', 'Timed out.', { effectStarted: false }),
    );

    const outcome = await runOrchestrator(buildTurnInput({ selectedToolSchemas: [READ_TOOL] }));

    expect(planner.plan).toHaveBeenCalledTimes(2);
    const observation = (planner.plan as any).mock.calls[1][4];
    expect(observation).toEqual({
      toolName: 'getWeather',
      executionStatus: 'failed',
      errorCode: 'PROVIDER_TIMEOUT',
    });
    const serialized = JSON.stringify(observation);
    expect(serialized).not.toContain('Tokyo');
    expect(serialized).not.toContain(';tool:');
    expect(serialized).not.toContain(';input:');
    expect(outcome.terminalState).toBe('completed');
  });

  it('diagnostics carry closed error codes only — raw error text and secrets never surface', async () => {
    const planner = await mockPlanner({ action: 'run_tool', toolName: 'getWeather', input: { city: 'Tokyo' } });
    const executor = await mockExecutor();
    (executor.execute as any).mockRejectedValue(new Error('boom sk-123456789012345678'));

    const outcome = await runOrchestrator(buildTurnInput({ selectedToolSchemas: [READ_TOOL] }));

    expect(outcome.terminalState).toBe('partial');
    expect(outcome.reasonCode).toBe('tool_failed');
    expect(outcome.diagnostics.errors).toEqual(['UNKNOWN']);
    const serialized = JSON.stringify(outcome);
    expect(serialized).not.toContain('boom');
    expect(serialized).not.toContain('sk-123456789012345678');
    expect(planner.plan).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Information disclosure (T-03a-34)
// ─────────────────────────────────────────────────────────────────────────────

describe('STRIDE — Information disclosure (T-03a-34)', () => {
  it('secret-like values in verifier check fields are discarded from stored evidence', async () => {
    const tool = realTool({
      evidence: {
        required: true,
        verifier: {
          type: 'schema',
          check: async () => [
            { checkId: 'c1', name: 'holds', passed: true, message: 'used api key sk-abc123def456ghi789' },
          ],
        },
      },
    });

    const evidence = await outcomeVerifier.verify(
      { toolName: 'writeNote', output: { saved: true }, durationMs: 1, toolCallId: 'call-1' },
      tool,
      'op-1',
    );

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('verification_error');
    }
    expect(JSON.stringify(evidence)).not.toContain('sk-abc123def456ghi789');
  });

  it('raw tool output and secrets never appear in verified evidence', async () => {
    const tool = realTool({
      evidence: { required: true, verifier: WRITE_VERIFIER },
    });

    const evidence = await outcomeVerifier.verify(
      {
        toolName: 'writeNote',
        output: { apiKey: 'sk-super-secret-9999', body: 'full raw response text' },
        durationMs: 1,
        toolCallId: 'call-1',
      },
      tool,
      'op-1',
    );

    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain('sk-super-secret-9999');
    expect(serialized).not.toContain('full raw response text');
  });

  it('the executor conflict error never exposes the raw idempotency key', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('boom after effect'));
    const tool = realTool({ execute });
    const executor = new ExecutorService();

    await expect(
      executor.execute('writeNote', { title: 'a' }, [tool], undefined, 30_000, 'op-1'),
    ).rejects.toThrow();
    try {
      await executor.execute('writeNote', { title: 'a' }, [tool], undefined, 30_000, 'op-1');
      expect.unreachable('duplicate of an unknown state must throw');
    } catch (err) {
      const serialized = JSON.stringify(err);
      expect(serialized).not.toContain(';tool:');
      expect(serialized).not.toContain(';input:');
      expect(serialized).not.toContain('boom after effect');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Denial of service (T-03a-35)
// ─────────────────────────────────────────────────────────────────────────────

describe('STRIDE — Denial of service (T-03a-35)', () => {
  it('tool and planner caps bound the planning/execution loop', async () => {
    const planner = await mockPlanner({ action: 'run_tool', toolName: 'getWeather', input: { city: 'Tokyo' } });
    const executor = await mockExecutor();
    (executor.execute as any).mockResolvedValue(toolResult('getWeather'));

    const outcome = await runOrchestrator(buildTurnInput({ selectedToolSchemas: [READ_TOOL] }));

    expect(outcome.terminalState).toBe('partial');
    expect(outcome.reasonCode).toBe('tool_cap_reached');
    expect(outcome.limits.toolCalls).toBe(2);
    expect(outcome.limits.toolCapReached).toBe(true);
    expect(outcome.limits.plannerCalls).toBeLessThanOrEqual(outcome.limits.plannerCap);
    expect(executor.execute).toHaveBeenCalledTimes(2);
    expect(planner.plan).toHaveBeenCalledTimes(3);
  });

  it('verifier timeout bounds postcondition checking to the five-second budget', async () => {
    vi.useFakeTimers();
    const never = new Promise<never>(() => {});
    const tool = realTool({
      evidence: { required: true, verifier: { type: 'schema', check: () => never } },
    });

    const pending = outcomeVerifier.verify(
      { toolName: 'writeNote', output: { saved: true }, durationMs: 1, toolCallId: 'call-1' },
      tool,
      'op-1',
    );
    await vi.advanceTimersByTimeAsync(OUTCOME_VERIFIER_TIMEOUT_MS + 10);
    const evidence = await pending;

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('verification_timeout');
      expect(evidence.retryable).toBe(true);
    }
  });

  it('trajectory observer callback failures are isolated — the transition still succeeds', () => {
    const machine = new AgentTrajectoryMachine(() => {
      throw new Error('observer exploded');
    });

    expect(() => machine.transitionTo('planning')).not.toThrow();
    expect(machine.state).toBe('planning');
  });

  it('a completed idempotent duplicate is served from the ledger and never re-executes', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = realTool({ execute });
    const executor = new ExecutorService();

    const first = await executor.execute('writeNote', { title: 'a' }, [tool], undefined, 30_000, 'op-1');
    const second = await executor.execute('writeNote', { title: 'a' }, [tool], undefined, 30_000, 'op-1');

    expect(execute).toHaveBeenCalledTimes(1);
    expect(second.output).toEqual(first.output);
    expect(second.toolCallId).not.toBe(first.toolCallId);
    expect(second.durationMs).toBe(0);
  });

  it('a pre-aborted signal aborts the turn before any service starts', async () => {
    const planner = await mockPlanner({ action: 'answer', reasonCode: 'direct_answer' });
    const executor = await mockExecutor();
    const controller = new AbortController();
    controller.abort();

    const outcome = await runOrchestrator(buildTurnInput({ abortSignal: controller.signal }));

    expect(outcome.terminalState).toBe('aborted');
    expect(outcome.reasonCode).toBe('caller_aborted');
    expect(outcome.abort).toMatchObject({ requested: true });
    expect(planner.plan).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('an abort during the permission callback stops before execution', async () => {
    const planner = await mockPlanner({ action: 'run_tool', toolName: 'saveNote', input: { title: 'hello' } });
    const executor = await mockExecutor();
    const controller = new AbortController();

    const outcome = await runOrchestrator(
      buildTurnInput({
        selectedToolSchemas: [WRITE_TOOL],
        abortSignal: controller.signal,
        requestPermission: vi.fn().mockImplementation(async () => {
          controller.abort();
          return { decision: 'granted' };
        }),
      }),
    );

    expect(outcome.terminalState).toBe('aborted');
    expect(outcome.abort?.stage).toBe('waiting-for-permission');
    expect(executor.execute).not.toHaveBeenCalled();
    expect(planner.plan).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Elevation of privilege (T-03a-36)
// ─────────────────────────────────────────────────────────────────────────────

describe('STRIDE — Elevation of privilege (T-03a-36)', () => {
  it('the executor validates tool names and input against the closed registry before executing', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = realTool({ execute });
    const executor = new ExecutorService();

    await expect(executor.execute('nonexistent_tool', {}, [tool])).rejects.toMatchObject({
      code: 'NO_SUCH_TOOL',
    });
    await expect(executor.execute('writeNote', 123, [tool])).rejects.toMatchObject({
      code: 'INVALID_TOOL_INPUT',
    });
    expect(execute).not.toHaveBeenCalled();

    const result = await executor.execute('writeNote', { title: 'valid' }, [tool], undefined, 30_000, 'op-valid');
    expect(result.toolName).toBe('writeNote');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('permission is enforced before execution and denial never bypasses via replan', async () => {
    const planner = await mockPlanner({ action: 'run_tool', toolName: 'saveNote', input: { title: 'hello' } });
    const executor = await mockExecutor();

    const outcome = await runOrchestrator(
      buildTurnInput({
        selectedToolSchemas: [WRITE_TOOL],
        requestPermission: vi.fn().mockResolvedValue({ decision: 'denied', origin: 'user' }),
      }),
    );

    expect(outcome.terminalState).toBe('failed');
    expect(outcome.reasonCode).toBe('permission_denied');
    expect(executor.execute).not.toHaveBeenCalled();
    // No recovery planner call is made for a denial — no bypass, no retry.
    expect(planner.plan).toHaveBeenCalledTimes(1);
  });

  it('an irreversible tool failure terminates — the pure policy and the orchestrator both refuse to replay', () => {
    const disposition = evaluateReplan({
      operationId: 'op-1',
      replanCount: 0,
      toolName: 'deleteWorkspace',
      sideEffect: 'irreversible',
      cause: { code: 'PROVIDER_5XX', category: 'retryable', retryable: true, message: 'provider failed', timestamp: 1 },
      priorToolResults: [],
    });
    expect(disposition).toBe('terminate');
  });

  it('the real orchestrator never replans or re-executes after an irreversible tool failure', async () => {
    const planner = await mockPlanner({ action: 'run_tool', toolName: 'deleteWorkspace', input: {} });
    const executor = await mockExecutor();
    (executor.execute as any).mockRejectedValue(new PipelineError('PROVIDER_5XX', 'Provider failed.', {}));

    const outcome = await runOrchestrator(
      buildTurnInput({
        selectedToolSchemas: [IRREVERSIBLE_TOOL],
        requestPermission: vi.fn().mockResolvedValue({ decision: 'granted' }),
      }),
    );

    expect(outcome.terminalState).toBe('failed');
    expect(outcome.reasonCode).toBe('tool_failed');
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(planner.plan).toHaveBeenCalledTimes(1);
  });

  it('an unknown-state execution is never re-executed', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('boom after effect'));
    const tool = realTool({ execute });
    const executor = new ExecutorService();

    await expect(
      executor.execute('writeNote', { title: 'a' }, [tool], undefined, 30_000, 'op-1'),
    ).rejects.toThrow();
    await expect(
      executor.execute('writeNote', { title: 'a' }, [tool], undefined, 30_000, 'op-1'),
    ).rejects.toMatchObject({ code: 'TOOL_IDEMPOTENCY_CONFLICT' });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8a scope fence (Rev. C §31.3 / must-have truth 3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 8a scope fence', () => {
  it('the public type surface exposes no manifest, discovery, persistence, or async-operation contracts', async () => {
    const aiTypes = await import('../../src/core/ai/types');
    const absentNames = [
      'ToolCapabilityManifest',
      'DiscoveryResult',
      'ActiveDiscovery',
      'PersistentIdempotencyLedger',
      'AsyncOperationContract',
    ];
    for (const name of absentNames) {
      expect((aiTypes as any)[name]).toBeUndefined();
    }
  });

  it('the executor exposes no persistence or loading API on its public surface', () => {
    const executor = new ExecutorService();
    expect((executor as any).persist).toBeUndefined();
    expect((executor as any).load).toBeUndefined();
    expect((executor as any).restore).toBeUndefined();
  });

  it('the idempotency ledger is operation-scoped and in-memory — restart and new turns re-execute', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = realTool({ execute });
    const first = new ExecutorService();

    await first.execute('writeNote', { title: 'a' }, [tool], undefined, 30_000, 'op-1');
    // A fresh service (restart) has no durable replay claim — it executes again.
    const fresh = new ExecutorService();
    await fresh.execute('writeNote', { title: 'a' }, [tool], undefined, 30_000, 'op-1');
    // A new turn (different operationId) is not deduplicated across turns.
    await first.execute('writeNote', { title: 'a' }, [tool], undefined, 30_000, 'op-2');

    expect(execute).toHaveBeenCalledTimes(3);
  });
});
