import { describe, it, expect, vi } from 'vitest';
import type { PlannerContext } from '../../../src/core/ai/types';
import type { ProviderAdapter } from '../../../src/core/ai/providers/ProviderAdapter';
import { PipelineError } from '../../../src/core/ai/PipelineError';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn() },
  isStepCount: vi.fn(() => vi.fn()),
}));

function createMockAdapter(overrides?: Partial<ProviderAdapter>): ProviderAdapter {
  return {
    providerId: 'openai',
    createLanguageModel: vi.fn(() => ({}) as any),
    validateConnection: vi.fn(),
    supportsStructuredOutput: true,
    getDefaultModelForTier: vi.fn(() => 'gpt-4o-mini'),
    getCacheStrategy: vi.fn((): 'prefix-only' => 'prefix-only'),
    getTelemetryMetadata: vi.fn(() => ({ provider: 'openai' })),
    ...overrides,
  };
}

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

describe('PlannerService', () => {
  it('returns answer decision when supportsStructuredOutput is true', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      output: { action: 'answer', reasonCode: 'direct_answer' },
    });

    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const adapter = createMockAdapter({ supportsStructuredOutput: true });
    const result = await plannerService.plan(adapter, 'FAST', buildMockContext());

    expect(result.action).toBe('answer');
    if (result.action === 'answer') {
      expect(result.reasonCode).toBe('direct_answer');
    }
  });

  it('returns answer decision when supportsStructuredOutput is false (fallback)', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      text: '{"action": "answer", "reasonCode": "fallback_answer"}',
    });

    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const adapter = createMockAdapter({ supportsStructuredOutput: false });
    const result = await plannerService.plan(adapter, 'FAST', buildMockContext());

    expect(result.action).toBe('answer');
  });

  it('returns run_tool decision with toolName and input', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      output: { action: 'run_tool', toolName: 'search', input: { query: 'test' } },
    });

    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const adapter = createMockAdapter({ supportsStructuredOutput: true });
    const result = await plannerService.plan(adapter, 'FAST', buildMockContext());

    expect(result.action).toBe('run_tool');
    if (result.action === 'run_tool') {
      expect(result.toolName).toBe('search');
    }
  });

  it('returns ask_clarification decision with question string', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      output: { action: 'ask_clarification', question: 'What exactly would you like to know?' },
    });

    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const adapter = createMockAdapter({ supportsStructuredOutput: true });
    const result = await plannerService.plan(adapter, 'FAST', buildMockContext());

    expect(result.action).toBe('ask_clarification');
    if (result.action === 'ask_clarification') {
      expect(result.question).toBe('What exactly would you like to know?');
    }
  });

  it('throws SCHEMA_INVALID when AI returns invalid output', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({
      text: 'not valid json at all',
    });

    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const adapter = createMockAdapter({ supportsStructuredOutput: false });

    await expect(
      plannerService.plan(adapter, 'FAST', buildMockContext()),
    ).rejects.toThrow(PipelineError);
  });

  it('respects stopWhen isStepCount(1)', async () => {
    const { generateText, isStepCount } = await import('ai');
    (isStepCount as any).mockReturnValue(vi.fn());
    (generateText as any).mockResolvedValue({
      output: { action: 'answer', reasonCode: 'test' },
    });

    const { plannerService } = await import('../../../src/core/ai/PlannerService');
    const adapter = createMockAdapter({ supportsStructuredOutput: true });
    const result = await plannerService.plan(adapter, 'FAST', buildMockContext());

    expect(isStepCount).toHaveBeenCalledWith(1);
    expect(result.action).toBe('answer');
  });
});
