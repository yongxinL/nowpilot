import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProviderRouter } from '../../../../src/core/ai/router/ProviderRouter';
import type { CostTierType } from '../../../../src/core/ai/providers/providerTypes';

// Mock streamText from 'ai'
const mockStreamTextResult = vi.hoisted(() => ({ textStream: undefined as unknown as AsyncIterable<string> }));
const mockStreamText = vi.hoisted(() => vi.fn(() => mockStreamTextResult));
vi.mock('ai', () => ({
  streamText: mockStreamText,
}));

import { RendererService } from '../../../../src/core/ai/pipeline/RendererService';

async function collectEvents(
  service: RendererService,
  tier: CostTierType,
  providers: string[],
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  signal: AbortSignal,
): Promise<any[]> {
  const events: any[] = [];
  for await (const event of service.render(tier, providers, systemPrompt, messages, signal)) {
    events.push(event);
  }
  return events;
}

function createMockRouter(returnModel = true): ProviderRouter {
  return {
    selectModel: vi.fn().mockResolvedValue(
      returnModel
        ? { instance: 'mock-instance', modelId: 'flash-model', providerId: 'flash-provider' }
        : null,
    ),
  } as unknown as ProviderRouter;
}

async function* createTextStream(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('RendererService', () => {
  let service: RendererService;
  let router: ProviderRouter;
  let abortController: AbortController;

  beforeEach(() => {
    vi.clearAllMocks();
    router = createMockRouter();
    service = new RendererService(router);
    abortController = new AbortController();
    mockStreamTextResult.textStream = createTextStream([]);
  });

  it('yields text-delta events for each chunk from streamText', async () => {
    mockStreamTextResult.textStream = createTextStream(['Hello', ' ', 'World']);

    const events = await collectEvents(
      service,
      'flash' as CostTierType,
      ['provider-a'],
      'system prompt',
      [{ role: 'user', content: 'hi' }],
      abortController.signal,
    );

    const deltas = events.filter((e) => e.type === 'text-delta');
    expect(deltas).toHaveLength(3);
    expect(deltas[0].text).toBe('Hello');
    expect(deltas[1].text).toBe(' ');
    expect(deltas[2].text).toBe('World');
  });

  it('yields text-complete with full accumulated text after stream ends', async () => {
    mockStreamTextResult.textStream = createTextStream(['Hello', ' World']);

    const events = await collectEvents(
      service,
      'flash' as CostTierType,
      ['provider-a'],
      'system prompt',
      [{ role: 'user', content: 'hi' }],
      abortController.signal,
    );

    const complete = events.find((e) => e.type === 'text-complete');
    expect(complete).toBeDefined();
    expect(complete.fullText).toBe('Hello World');
  });

  it('yields error event when streamText fails', async () => {
    mockStreamText.mockReturnValueOnce({ get textStream() { throw new Error('Stream error'); } });

    const events = await collectEvents(
      service,
      'flash' as CostTierType,
      ['provider-a'],
      'prompt',
      [{ role: 'user', content: 'hi' }],
      abortController.signal,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].message).toContain('Stream error');
  });

  it('passes maxTokens: 512 to streamText', async () => {
    mockStreamTextResult.textStream = createTextStream(['ok']);

    await collectEvents(
      service,
      'flash' as CostTierType,
      ['provider-a'],
      'prompt',
      [{ role: 'user', content: 'hi' }],
      abortController.signal,
    );

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 512 }),
    );
  });

  it('passes abortSignal to streamText', async () => {
    mockStreamTextResult.textStream = createTextStream(['ok']);

    await collectEvents(
      service,
      'flash' as CostTierType,
      ['provider-a'],
      'prompt',
      [{ role: 'user', content: 'hi' }],
      abortController.signal,
    );

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({ abortSignal: abortController.signal }),
    );
  });

  it('uses flash-tier model via ProviderRouter', async () => {
    mockStreamTextResult.textStream = createTextStream(['ok']);

    await collectEvents(
      service,
      'flash' as CostTierType,
      ['provider-b'],
      'prompt',
      [{ role: 'user', content: 'hi' }],
      abortController.signal,
    );

    expect(router.selectModel).toHaveBeenCalledWith('flash', ['provider-b'], undefined, undefined);
  });

  it('yields error when no flash-tier model is available', async () => {
    const noModelRouter = createMockRouter(false);
    const localService = new RendererService(noModelRouter);

    const events = await collectEvents(
      localService,
      'flash' as CostTierType,
      ['provider-a'],
      'prompt',
      [{ role: 'user', content: 'hi' }],
      abortController.signal,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    expect(events[0].message).toContain('No flash-tier model available');
  });

  it('yields text-complete with partial text on abort (D-18 recovery)', async () => {
    // Reset mock to avoid cross-test mockImplementation leaks
    mockStreamText.mockReset();
    mockStreamText.mockImplementation(() => mockStreamTextResult);
    // Simulate AI SDK throwing AbortError on next chunk read when signal is aborted
    const gen = (async function* () {
      yield 'Partial ';
      // When the signal is aborted, AI SDK throws AbortError
      throw new DOMException('The operation was aborted', 'AbortError');
    })();

    mockStreamTextResult.textStream = gen;

    const events = await collectEvents(
      service,
      'flash' as CostTierType,
      ['provider-a'],
      'prompt',
      [{ role: 'user', content: 'hi' }],
      abortController.signal,
    );

    const complete = events.find((e) => e.type === 'text-complete');
    const errorEvent = events.find((e) => e.type === 'error');

    // With D-18 recovery, we should get partial text before the error
    expect(complete).toBeDefined();
    if (complete) expect(complete.fullText).toBe('Partial ');
  });
});
