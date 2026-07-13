import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProviderRouter } from '../../../../src/core/ai/router/ProviderRouter';
import type { CostTierType } from '../../../../src/core/ai/providers/providerTypes';

const mockGenerateText = vi.hoisted(() => vi.fn());
vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

// PlannerService import must come after vi.mock
import { PlannerService } from '../../../../src/core/ai/pipeline/PlannerService';

function createMockRouter(): ProviderRouter {
  return {
    selectModel: vi.fn().mockResolvedValue({
      instance: 'mock-model-instance',
      modelId: 'mock-model',
      providerId: 'mock-provider',
    }),
  } as unknown as ProviderRouter;
}

describe('PlannerService', () => {
  let service: PlannerService;
  let router: ProviderRouter;
  let abortController: AbortController;

  beforeEach(() => {
    vi.clearAllMocks();
    router = createMockRouter();
    service = new PlannerService(router);
    abortController = new AbortController();
  });

  it('calls generateText and returns a valid decision', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"action":"answer","reasoning":"User asked a question"}',
    });

    const result = await service.plan(
      'flash' as CostTierType,
      ['mock-provider'],
      'You are a helpful assistant.',
      'What time is it?',
      abortController.signal,
    );

    expect(result.action).toBe('answer');
    expect(result.reasoning).toBe('User asked a question');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-model-instance',
        temperature: 0.1,
      }),
    );
  });

  it('returns valid decision when generateText returns truncated JSON (repair)', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"action":"answer","reasoning":"truncated"',
    });

    const result = await service.plan(
      'flash' as CostTierType,
      ['mock-provider'],
      'prompt',
      'message',
      abortController.signal,
    );

    expect(result.action).toBe('answer');
    expect(result.reasoning).toBe('truncated');
  });

  it('returns fallback answer when generateText returns garbage (unparseable)', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'garbage output',
    });

    const result = await service.plan(
      'flash' as CostTierType,
      ['mock-provider'],
      'prompt',
      'message',
      abortController.signal,
    );

    expect(result.action).toBe('answer');
    expect(result.reasoning).toBe('Planner output was unparseable');
  });

  it('returns fallback answer when generateText returns invalid action enum', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"action":"invalid_action","reasoning":"test"}',
    });

    const result = await service.plan(
      'flash' as CostTierType,
      ['mock-provider'],
      'prompt',
      'message',
      abortController.signal,
    );

    expect(result.action).toBe('answer');
    expect(result.reasoning).toBe('Planner output was unparseable');
  });

  it('respects abort signal — generateText throws when aborted', async () => {
    mockGenerateText.mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

    await expect(
      service.plan(
        'flash' as CostTierType,
        ['mock-provider'],
        'prompt',
        'message',
        abortController.signal,
      ),
    ).rejects.toThrow('The operation was aborted');
  });

  it('calls router.selectModel with the correct tier and providers', async () => {
    mockGenerateText.mockResolvedValue({
      text: '{"action":"answer","reasoning":"ok"}',
    });

    await service.plan(
      'haiku' as CostTierType,
      ['provider-a', 'provider-b'],
      'prompt',
      'message',
      abortController.signal,
    );

    expect(router.selectModel).toHaveBeenCalledWith('haiku', ['provider-a', 'provider-b'], undefined);
  });

  it('passes abortSignal to generateText', async () => {
    const testSignal = abortController.signal;
    mockGenerateText.mockResolvedValue({
      text: '{"action":"answer","reasoning":"ok"}',
    });

    await service.plan(
      'flash' as CostTierType,
      ['mock-provider'],
      'prompt',
      'message',
      testSignal,
    );

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: testSignal,
      }),
    );
  });
});
