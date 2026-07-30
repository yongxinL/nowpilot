import { describe, it, expect, vi, beforeEach } from 'vitest';
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

function buildMockContext(overrides?: Partial<PlannerContext>): PlannerContext {
  return {
    version: 1,
    userMessage: 'Test message',
    conversationHistory: [],
    toolCallHistory: [],
    availableTools: [],
    personaBehavior: { brevity: 'concise', clarificationStrategy: 'ask when uncertain', reasoningStyle: 'direct' },
    abortSignal: undefined,
    ...overrides,
  };
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
    const result = await agentOrchestrator.runTurn('openai', 'FAST', buildMockContext());

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
    const result = await agentOrchestrator.runTurn('openai', 'FAST', buildMockContext());

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
    const result = await agentOrchestrator.runTurn('openai', 'FAST', buildMockContext());

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
    await agentOrchestrator.runTurn('openai', 'FAST', buildMockContext());

    expect(rendererService.synthesize).toHaveBeenCalled();
  });

  it('surfaces terminal errors to user', async () => {
    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    (plannerService.plan as any).mockRejectedValue(
      new PipelineError('PROVIDER_AUTH', 'Authentication failed.', { providerId: 'openai' }),
    );

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const result = await agentOrchestrator.runTurn('openai', 'FAST', buildMockContext());

    expect(result).toBe('Authentication failed.');
  });
});
