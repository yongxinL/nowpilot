import { describe, it, expect, vi } from 'vitest';
import type { PlannerDecision } from '../../../src/core/ai/types';
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
  plannerService: { plan: vi.fn() },
}));

vi.mock('../../../src/core/ai/RendererService', () => ({
  rendererService: { synthesize: vi.fn() },
}));

const WEATHER_TOOL = {
  name: 'getWeather',
  description: 'Get weather for a city',
  jsonSchema: { type: 'object', properties: { city: { type: 'string' } } },
};

function buildAgentTurnInput(
  overrides?: Partial<ReturnType<typeof createAgentTurnInput>>,
): ReturnType<typeof createAgentTurnInput> {
  return createAgentTurnInput({
    providerId: 'openai',
    tier: 'FAST',
    model: 'gpt-4o-mini',
    modelContextWindow: 128000,
    selectedToolSchemas: [WEATHER_TOOL],
    ...overrides,
  });
}

describe('Pipeline Integration', () => {
  it('full pipeline: plan -> execute -> plan -> render with tool calls', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const { rendererService } = await import('../../../src/core/ai/RendererService');

    const { ExecutorService } = await import('../../../src/core/ai/ExecutorService');
    const executor = new ExecutorService();

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

    (rendererService.synthesize as any).mockResolvedValue(
      'The weather in Tokyo is 22°C and sunny.',
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const result = await agentOrchestrator.runTurn(
      buildAgentTurnInput({ userInput: 'What is the weather in Tokyo?' }),
    );

    expect(result).toBeTruthy();
    expect(result).toBe('The weather in Tokyo is 22°C and sunny.');
    expect(plannerService.plan).toHaveBeenCalledTimes(2);
  });

  it('handles unknown tool error gracefully', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    (plannerService.plan as any).mockResolvedValue({
      action: 'run_tool',
      toolName: 'nonexistent_tool',
      input: {},
    } as PlannerDecision);

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const result = await agentOrchestrator.runTurn(buildAgentTurnInput({ userInput: 'test' }));
    expect(result).toBeTruthy();
  });
});
