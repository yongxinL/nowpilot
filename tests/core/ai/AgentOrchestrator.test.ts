import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AgentTurnInput,
  PlannerDecision,
  RegisteredTool,
  ToolExecutionResult,
} from '../../../src/core/ai/types';
import { PipelineError } from '../../../src/core/ai/PipelineError';
import { createAgentTurnInput } from '../../../src/core/ai/AgentTurnInput';

vi.mock('../../../src/core/ai/ProviderRouter', () => ({
  providerRouter: {
    selectProvider: vi.fn().mockResolvedValue({
      adapter: {
        providerId: 'openai',
        createLanguageModel: vi.fn(),
        validateConnection: vi.fn(),
        supportsStructuredOutput: true,
        getDefaultModelForTier: vi.fn(() => 'gpt-4o-mini'),
        getCacheStrategy: vi.fn(() => 'prefix-only' as const),
        getTelemetryMetadata: vi.fn(() => ({ provider: 'openai' })),
      },
      providerId: 'openai',
    }),
  },
}));

vi.mock('../../../src/core/ai/PlannerService', () => ({
  plannerService: {
    plan: vi.fn(),
  },
}));

vi.mock('../../../src/core/ai/ExecutorService', () => ({
  executorService: {
    execute: vi.fn(),
    attachEvidence: vi.fn(),
  },
}));

vi.mock('../../../src/core/ai/RendererService', () => ({
  rendererService: {
    synthesize: vi.fn().mockResolvedValue('Mocked renderer response'),
  },
}));

const READ_TOOL = {
  name: 'getWeather',
  description: 'Get weather for a city',
  jsonSchema: { type: 'object', properties: { city: { type: 'string' } } },
  sideEffect: 'read' as const,
  idempotency: 'not-required' as const,
  evidence: { required: false },
};

const VERIFIED_WRITE_TOOL = {
  name: 'saveNote',
  description: 'Save a note',
  jsonSchema: {},
  sideEffect: 'write' as const,
  idempotency: 'required' as const,
  evidence: {
    required: true,
    verifier: {
      type: 'schema' as const,
      check: async () => [{ checkId: 'c1', name: 'saved', passed: true }],
    },
  },
};

const FAILING_WRITE_TOOL = {
  ...VERIFIED_WRITE_TOOL,
  evidence: {
    required: true,
    verifier: {
      type: 'schema' as const,
      check: async () => [{ checkId: 'c1', name: 'saved', passed: false }],
    },
  },
};

const IRREVERSIBLE_TOOL = {
  name: 'deleteWorkspace',
  description: 'Delete the workspace',
  jsonSchema: {},
  sideEffect: 'irreversible' as const,
  idempotency: 'required' as const,
  evidence: { required: true, verifier: VERIFIED_WRITE_TOOL.evidence.verifier },
};

function toolResult(toolName: string, overrides: Partial<ToolExecutionResult> = {}): ToolExecutionResult {
  return {
    toolName,
    output: { ok: true },
    durationMs: 10,
    toolCallId: 'call-1',
    ...overrides,
  };
}

function buildAgentTurnInput(overrides?: Partial<AgentTurnInput>): AgentTurnInput {
  return createAgentTurnInput({
    providerId: 'openai',
    tier: 'FAST',
    model: 'gpt-4o-mini',
    modelContextWindow: 128000,
    userInput: 'Test message',
    ...overrides,
  });
}

describe('AgentOrchestrator outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a completed outcome with renderedAnswer for an answer decision', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'answer',
      reasonCode: 'direct_answer',
    } as PlannerDecision);

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(buildAgentTurnInput());

    expect(outcome.terminalState).toBe('completed');
    expect(outcome.reasonCode).toBe('planner_answer');
    expect(outcome.renderedAnswer).toBe('Mocked renderer response');
    expect(outcome.trajectory.map((t) => t.state)).toEqual([
      'assembling-context',
      'planning',
      'rendering',
      'completed',
    ]);
    expect(outcome.limits.plannerCalls).toBe(1);
    expect(outcome.abort).toBeUndefined();
  });

  it('returns the clarification question as the rendered answer without a renderer call', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { rendererService } = await import('../../../src/core/ai/RendererService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'ask_clarification',
      question: 'Could you please provide more details?',
    } as PlannerDecision);

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(buildAgentTurnInput());

    expect(outcome.terminalState).toBe('completed');
    expect(outcome.reasonCode).toBe('planner_clarification');
    expect(outcome.renderedAnswer).toBe('Could you please provide more details?');
    expect(rendererService.synthesize).not.toHaveBeenCalled();
  });

  it('cycles a read tool back through the planner and records the tool result', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { executorService } = await import('../../../src/core/ai/ExecutorService');

    (plannerService.plan as any)
      .mockResolvedValueOnce({
        action: 'run_tool',
        toolName: 'getWeather',
        input: { city: 'Tokyo' },
      } as PlannerDecision)
      .mockResolvedValueOnce({
        action: 'answer',
        reasonCode: 'weather_report',
      } as PlannerDecision);

    (executorService.execute as any).mockResolvedValue(
      toolResult('getWeather', { output: { temperature: 22 } }),
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const input = buildAgentTurnInput({ selectedToolSchemas: [READ_TOOL] });
    const outcome = await agentOrchestrator.runTurn(input);

    expect(outcome.terminalState).toBe('completed');
    expect(outcome.reasonCode).toBe('planner_answer');
    expect(plannerService.plan).toHaveBeenCalledTimes(2);
    expect(outcome.toolResults).toHaveLength(1);
    expect(outcome.limits.toolCalls).toBe(1);
    expect(outcome.trajectory.map((t) => t.state)).toEqual([
      'assembling-context',
      'planning',
      'executing',
      'planning',
      'rendering',
      'completed',
    ]);
  });

  it('returns a failed outcome with planner_failed when the planner errors', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    (plannerService.plan as any).mockRejectedValue(
      new PipelineError('PROVIDER_AUTH', 'Authentication failed.', { providerId: 'openai' }),
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(buildAgentTurnInput());

    expect(outcome.terminalState).toBe('failed');
    expect(outcome.reasonCode).toBe('planner_failed');
    expect(outcome.renderedAnswer).toBeNull();
    expect(outcome.diagnostics.errors).toContain('PROVIDER_AUTH');
  });

  it('returns a failed outcome with renderer_failed when the renderer errors', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { rendererService } = await import('../../../src/core/ai/RendererService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'answer',
      reasonCode: 'direct_answer',
    } as PlannerDecision);
    (rendererService.synthesize as any).mockRejectedValue(
      new PipelineError('PROVIDER_5XX', 'Provider failed.', {}),
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(buildAgentTurnInput());

    expect(outcome.terminalState).toBe('failed');
    expect(outcome.reasonCode).toBe('renderer_failed');
    expect(outcome.renderedAnswer).toBeNull();
  });

  it('normalizes a renderer AbortError into an aborted outcome', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { rendererService } = await import('../../../src/core/ai/RendererService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'answer',
      reasonCode: 'direct_answer',
    } as PlannerDecision);
    (rendererService.synthesize as any).mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(buildAgentTurnInput());

    expect(outcome.terminalState).toBe('aborted');
    expect(outcome.renderedAnswer).toBeNull();
  });

  it('hits the tool cap and renders a partial outcome', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { executorService } = await import('../../../src/core/ai/ExecutorService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'run_tool',
      toolName: 'getWeather',
      input: { city: 'Tokyo' },
    } as PlannerDecision);
    (executorService.execute as any).mockResolvedValue(
      toolResult('getWeather', { output: { temperature: 22 } }),
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({ selectedToolSchemas: [READ_TOOL] }),
    );

    expect(outcome.terminalState).toBe('partial');
    expect(outcome.reasonCode).toBe('tool_cap_reached');
    expect(outcome.limits.toolCapReached).toBe(true);
    expect(outcome.limits.toolCalls).toBe(2);
  });

  it('returns an aborted outcome for a pre-aborted signal without touching services', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const controller = new AbortController();
    controller.abort();

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({ abortSignal: controller.signal }),
    );

    expect(outcome.terminalState).toBe('aborted');
    expect(outcome.reasonCode).toBe('caller_aborted');
    expect(outcome.renderedAnswer).toBeNull();
    expect(outcome.abort).toMatchObject({ requested: true });
    expect(plannerService.plan).not.toHaveBeenCalled();
  });

  it('aborts at the planning boundary when the signal fires during the planner call', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { rendererService } = await import('../../../src/core/ai/RendererService');
    const controller = new AbortController();
    (plannerService.plan as any).mockImplementation(async () => {
      controller.abort();
      return { action: 'answer', reasonCode: 'direct_answer' } as PlannerDecision;
    });

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({ abortSignal: controller.signal }),
    );

    expect(outcome.terminalState).toBe('aborted');
    expect(outcome.abort?.stage).toBe('planning');
    expect(rendererService.synthesize).not.toHaveBeenCalled();
  });

  it('resumes the same validated tool decision after permission grant', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { executorService } = await import('../../../src/core/ai/ExecutorService');

    (plannerService.plan as any)
      .mockResolvedValueOnce({
        action: 'run_tool',
        toolName: 'saveNote',
        input: { title: 'hello' },
      } as PlannerDecision)
      .mockResolvedValueOnce({
        action: 'answer',
        reasonCode: 'note_saved',
      } as PlannerDecision);

    (executorService.execute as any).mockResolvedValue(
      toolResult('saveNote', { output: { id: 'n1' } }),
    );

    const permission = vi.fn().mockResolvedValue({ decision: 'granted', origin: 'user' });

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({ selectedToolSchemas: [VERIFIED_WRITE_TOOL], requestPermission: permission }),
    );

    expect(permission).toHaveBeenCalledTimes(1);
    expect(permission).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'saveNote', sideEffect: 'write' }),
    );
    expect(executorService.execute).toHaveBeenCalledTimes(1);
    expect(outcome.terminalState).toBe('completed');
    expect(outcome.limits.toolCalls).toBe(1);
  });

  it('never invokes the executor after permission denial', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { executorService } = await import('../../../src/core/ai/ExecutorService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'run_tool',
      toolName: 'saveNote',
      input: { title: 'hello' },
    } as PlannerDecision);
    const permission = vi.fn().mockResolvedValue({ decision: 'denied', origin: 'user' });

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({ selectedToolSchemas: [VERIFIED_WRITE_TOOL], requestPermission: permission }),
    );

    expect(outcome.terminalState).toBe('failed');
    expect(outcome.reasonCode).toBe('permission_denied');
    expect(executorService.execute).not.toHaveBeenCalled();
    expect(plannerService.plan).toHaveBeenCalledTimes(1);
  });

  it('finalizes a user cancellation as user_aborted without replan bypass', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { executorService } = await import('../../../src/core/ai/ExecutorService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'run_tool',
      toolName: 'saveNote',
      input: { title: 'hello' },
    } as PlannerDecision);
    const permission = vi.fn().mockResolvedValue({ decision: 'cancelled', origin: 'user' });

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({ selectedToolSchemas: [VERIFIED_WRITE_TOOL], requestPermission: permission }),
    );

    expect(outcome.terminalState).toBe('aborted');
    expect(outcome.reasonCode).toBe('user_aborted');
    expect(outcome.abort?.origin).toBe('user');
    expect(executorService.execute).not.toHaveBeenCalled();
  });

  it('finalizes a caller cancellation as caller_aborted', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'run_tool',
      toolName: 'saveNote',
      input: { title: 'hello' },
    } as PlannerDecision);
    const permission = vi.fn().mockResolvedValue({ decision: 'cancelled', origin: 'caller' });

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({ selectedToolSchemas: [VERIFIED_WRITE_TOOL], requestPermission: permission }),
    );

    expect(outcome.terminalState).toBe('aborted');
    expect(outcome.reasonCode).toBe('caller_aborted');
  });

  it('attaches verified evidence through the typed seam and continues', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { executorService } = await import('../../../src/core/ai/ExecutorService');

    (plannerService.plan as any)
      .mockResolvedValueOnce({
        action: 'run_tool',
        toolName: 'saveNote',
        input: { title: 'hello' },
      } as PlannerDecision)
      .mockResolvedValueOnce({
        action: 'answer',
        reasonCode: 'note_saved',
      } as PlannerDecision);

    (executorService.execute as any).mockResolvedValue(
      toolResult('saveNote', { output: { id: 'n1' }, toolCallId: 'call-1' }),
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({
        selectedToolSchemas: [VERIFIED_WRITE_TOOL],
        requestPermission: vi.fn().mockResolvedValue({ decision: 'granted' }),
      }),
    );

    expect(executorService.attachEvidence).toHaveBeenCalledTimes(1);
    const [callId, evidence] = (executorService.attachEvidence as any).mock.calls[0];
    expect(callId).toBe('call-1');
    expect(evidence.verified).toBe(true);
    expect(outcome.terminalState).toBe('completed');
    expect(outcome.evidence).toHaveLength(1);
    expect(outcome.evidence[0].verified).toBe(true);
    expect(outcome.evidence[0].toolCallId).toBe('call-1');
  });

  it('renders partial with the contradiction fallback when write evidence fails', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { executorService } = await import('../../../src/core/ai/ExecutorService');
    const { rendererService } = await import('../../../src/core/ai/RendererService');

    (plannerService.plan as any)
      .mockResolvedValueOnce({
        action: 'run_tool',
        toolName: 'saveNote',
        input: { title: 'hello' },
      } as PlannerDecision)
      .mockResolvedValueOnce({
        action: 'answer',
        reasonCode: 'note_saved',
      } as PlannerDecision);
    (executorService.execute as any).mockResolvedValue(
      toolResult('saveNote', { output: { id: 'n1' }, toolCallId: 'call-1' }),
    );
    (rendererService.synthesize as any).mockResolvedValue('I saved the note successfully.');

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({
        selectedToolSchemas: [FAILING_WRITE_TOOL],
        requestPermission: vi.fn().mockResolvedValue({ decision: 'granted' }),
      }),
    );

    expect(outcome.terminalState).toBe('partial');
    expect(outcome.reasonCode).toBe('completion_unverified');
    expect(outcome.diagnostics.warnings).toContain('RENDERER_EVIDENCE_CONTRADICTION');
    expect(outcome.renderedAnswer).toContain('could not confirm');
    expect(plannerService.plan).toHaveBeenCalledTimes(1);
  });

  it('makes exactly one recovery planner call with a redacted observation', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { executorService } = await import('../../../src/core/ai/ExecutorService');

    (plannerService.plan as any)
      .mockResolvedValueOnce({
        action: 'run_tool',
        toolName: 'getWeather',
        input: { city: 'Tokyo' },
      } as PlannerDecision)
      .mockResolvedValueOnce({
        action: 'answer',
        reasonCode: 'weather_report',
      } as PlannerDecision);

    (executorService.execute as any).mockRejectedValue(
      new PipelineError('PROVIDER_TIMEOUT', 'Timed out.', { effectStarted: false }),
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({ selectedToolSchemas: [READ_TOOL] }),
    );

    expect(plannerService.plan).toHaveBeenCalledTimes(2);
    const recoveryCall = (plannerService.plan as any).mock.calls[1];
    expect(recoveryCall[4]).toEqual({
      toolName: 'getWeather',
      executionStatus: 'failed',
      errorCode: 'PROVIDER_TIMEOUT',
    });
    expect(outcome.terminalState).toBe('completed');
    expect(outcome.reasonCode).toBe('planner_answer');
  });

  it('never replans after an irreversible tool failure', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { executorService } = await import('../../../src/core/ai/ExecutorService');

    (plannerService.plan as any).mockResolvedValue({
      action: 'run_tool',
      toolName: 'deleteWorkspace',
      input: {},
    } as PlannerDecision);
    (executorService.execute as any).mockRejectedValue(
      new PipelineError('PROVIDER_5XX', 'Provider failed.', {}),
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({
        selectedToolSchemas: [IRREVERSIBLE_TOOL],
        requestPermission: vi.fn().mockResolvedValue({ decision: 'granted' }),
      }),
    );

    expect(outcome.terminalState).toBe('failed');
    expect(outcome.reasonCode).toBe('tool_failed');
    expect(plannerService.plan).toHaveBeenCalledTimes(1);
  });

  it('renders partial without replanning when the effect state is unknown', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { executorService } = await import('../../../src/core/ai/ExecutorService');

    (plannerService.plan as any).mockResolvedValue({
      action: 'run_tool',
      toolName: 'getWeather',
      input: { city: 'Tokyo' },
    } as PlannerDecision);
    (executorService.execute as any).mockRejectedValue(
      new PipelineError('PROVIDER_TIMEOUT', 'Timed out.', {}),
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(
      buildAgentTurnInput({ selectedToolSchemas: [READ_TOOL] }),
    );

    expect(plannerService.plan).toHaveBeenCalledTimes(1);
    expect(outcome.terminalState).toBe('partial');
    expect(outcome.reasonCode).toBe('tool_failed');
  });

  it('runTurnText returns the same renderedAnswer as runTurn', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'answer',
      reasonCode: 'direct_answer',
    } as PlannerDecision);

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const input = buildAgentTurnInput();
    const outcome = await agentOrchestrator.runTurn(input);
    const text = await agentOrchestrator.runTurnText(input);

    expect(text).toBe(outcome.renderedAnswer);
    expect(text).toBe('Mocked renderer response');
  });
});
