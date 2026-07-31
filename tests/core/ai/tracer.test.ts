import { describe, it, expect, vi } from 'vitest';
import type { AgentTurnInput, PlannerDecision } from '../../../src/core/ai/types';
import { PipelineError } from '../../../src/core/ai/PipelineError';
import { createAgentTurnInput } from '../../../src/core/ai/AgentTurnInput';

vi.mock('ai', () => {
  return {
    generateText: vi.fn(),
    streamText: vi.fn(),
    Output: {
      object: vi.fn(),
    },
    isStepCount: vi.fn(),
  };
});

vi.mock('../../../src/core/ai/ProviderRouter', () => {
  return {
    providerRouter: {
      selectProvider: vi.fn((providerId: string) => {
        if (providerId === 'openai') {
          return Promise.resolve({
            adapter: {
              providerId: 'openai' as const,
              createLanguageModel: vi.fn(),
              validateConnection: vi.fn().mockResolvedValue({ ok: true, models: ['gpt-4o-mini'] }),
              supportsStructuredOutput: true,
              getDefaultModelForTier: vi.fn().mockReturnValue('gpt-4o-mini'),
              getCacheStrategy: vi.fn().mockReturnValue('prefix-only'),
              getTelemetryMetadata: vi.fn().mockReturnValue({ provider: 'openai' }),
            },
            providerId: 'openai',
          });
        }
        return Promise.reject(
          new PipelineError(
            'PROVIDER_AUTH',
            `${providerId} is not yet configured. Only OpenAI is available in this version.`,
            { providerId },
          ),
        );
      }),
    },
  };
});

function buildAgentTurnInput(overrides?: Partial<AgentTurnInput>): AgentTurnInput {
  return createAgentTurnInput({
    providerId: 'openai',
    tier: 'FAST',
    model: 'gpt-4o-mini',
    modelContextWindow: 128000,
    userInput: 'Hello, what can you help me with?',
    ...overrides,
  });
}

describe('AI Pipeline Tracer', () => {
  it('should complete a full prompt -> optimize -> plan -> render cycle', async () => {
    const { generateText } = await import('ai');
    const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

    mockGenerateText
      .mockResolvedValueOnce({
        output: { action: 'answer', reasonCode: 'sufficient_info' } as PlannerDecision,
      })
      .mockResolvedValueOnce({
        text: 'Hello! I am here to help you with your questions about note-taking and knowledge management.',
      });

    const input = buildAgentTurnInput();
    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const response = await agentOrchestrator.runTurn(input);

    expect(response).toBeTruthy();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    expect(response).toContain('Hello');
  }, 10000);

  it('should handle an answer decision returning the mocked response', async () => {
    const { generateText } = await import('ai');
    const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

    mockGenerateText
      .mockResolvedValueOnce({
        output: { action: 'answer', reasonCode: 'direct_answer' } as PlannerDecision,
      })
      .mockResolvedValueOnce({
        text: 'I can help you organize your notes and find information quickly.',
      });

    const input = buildAgentTurnInput({ userInput: 'What do you do?' });
    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const response = await agentOrchestrator.runTurn(input);

    expect(response).toBe('I can help you organize your notes and find information quickly.');
  }, 10000);

  it('should throw PipelineError for unknown provider', async () => {
    const input = buildAgentTurnInput({ providerId: 'ollama' });
    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');

    await expect(agentOrchestrator.runTurn(input)).rejects.toThrow(PipelineError);
  }, 10000);
});
