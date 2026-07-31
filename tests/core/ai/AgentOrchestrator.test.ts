import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlannerDecision } from '../../../src/core/ai/types';
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
  },
}));

vi.mock('../../../src/core/ai/RendererService', () => ({
  rendererService: {
    synthesize: vi.fn().mockResolvedValue('Mocked renderer response'),
  },
}));

function buildAgentTurnInput(): ReturnType<typeof createAgentTurnInput> {
  return createAgentTurnInput({
    providerId: 'openai',
    tier: 'FAST',
    model: 'gpt-4o-mini',
    modelContextWindow: 128000,
    userInput: 'Test message',
  });
}

describe('AgentOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns answer decision from single plan-render cycle', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'answer',
      reasonCode: 'direct_answer',
    } as PlannerDecision);

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const result = await agentOrchestrator.runTurn(buildAgentTurnInput());

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('returns ask_clarification question string', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'ask_clarification',
      question: 'Could you please provide more details?',
    } as PlannerDecision);

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const result = await agentOrchestrator.runTurn(buildAgentTurnInput());

    expect(result).toBe('Could you please provide more details?');
  });

  it('handles run_tool and cycles back to planner', async () => {
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

    (executorService.execute as any).mockResolvedValue({
      toolName: 'getWeather',
      output: { temperature: 22, condition: 'sunny' },
      durationMs: 10,
    });

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const input = buildAgentTurnInput();
    input.selectedToolSchemas = [
      { name: 'getWeather', description: 'Get weather for a city', jsonSchema: {} },
    ];
    const result = await agentOrchestrator.runTurn(input);

    expect(result).toBeTruthy();
    expect(plannerService.plan).toHaveBeenCalledTimes(2);
  });

  it('enforces tier caps — stops after planner=N steps', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { rendererService } = await import('../../../src/core/ai/RendererService');

    (plannerService.plan as any).mockResolvedValue({
      action: 'run_tool',
      toolName: 'getWeather',
      input: { city: 'Tokyo' },
    } as PlannerDecision);

    const { executorService } = await import('../../../src/core/ai/ExecutorService');
    (executorService.execute as any).mockResolvedValue({
      toolName: 'getWeather',
      output: { temperature: 22 },
      durationMs: 5,
    });

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const input = buildAgentTurnInput();
    input.selectedToolSchemas = [
      { name: 'getWeather', description: 'Get weather for a city', jsonSchema: {} },
    ];
    await agentOrchestrator.runTurn(input);

    expect(rendererService.synthesize).toHaveBeenCalled();
  });

  it('surfaces terminal errors to user', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    (plannerService.plan as any).mockRejectedValue(
      new PipelineError('PROVIDER_AUTH', 'Authentication failed.', { providerId: 'openai' }),
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const result = await agentOrchestrator.runTurn(buildAgentTurnInput());

    expect(result).toBe('Authentication failed.');
  });
});
