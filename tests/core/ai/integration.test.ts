import { describe, it, expect, vi } from 'vitest';
import type { PlannerContext, PlannerDecision } from '../../../src/core/ai/types';
import { PipelineError } from '../../../src/core/ai/PipelineError';

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

    const tools: any[] = [
      {
        name: 'getWeather',
        description: 'Get weather for a city',
        inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
        execute: vi.fn().mockResolvedValue({ temperature: 22, condition: 'sunny', city: 'Tokyo' }),
      },
    ];

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const context: PlannerContext = {
      version: 1,
      userMessage: 'What is the weather in Tokyo?',
      conversationHistory: [],
      toolCallHistory: [],
      availableTools: tools as any,
      personaBehavior: { brevity: 'concise', clarificationStrategy: 'ask when uncertain', reasoningStyle: 'direct' },
    };

    const result = await agentOrchestrator.runTurn('openai', 'FAST', context);

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

    const tools: any[] = [
      {
        name: 'getWeather',
        description: 'Get weather',
        inputSchema: { type: 'object', properties: {} },
        execute: vi.fn(),
      },
    ];

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const context: PlannerContext = {
      version: 1,
      userMessage: 'test',
      conversationHistory: [],
      toolCallHistory: [],
      availableTools: tools as any,
      personaBehavior: null,
    };

    const result = await agentOrchestrator.runTurn('openai', 'FAST', context);
    expect(result).toBeTruthy();
  });
});
