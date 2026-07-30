import { describe, it, expect, vi, beforeEach } from 'vitest';

type ChunkCallback = (args: { chunk: any }) => void;
type FinishCallback = (args: { usage?: { promptTokens: number; completionTokens: number } }) => void;
type ErrorCallback = (args: { error: Error }) => void;

let capturedOnChunk: ChunkCallback | null = null;
let capturedOnFinish: FinishCallback | null = null;
let capturedOnError: ErrorCallback | null = null;

vi.mock('ai', () => ({
  streamText: vi.fn(({ onChunk, onFinish, onError }: any) => {
    capturedOnChunk = onChunk;
    capturedOnFinish = onFinish;
    capturedOnError = onError;
    return {};
  }),
}));

async function collectEvents(iterable: AsyncIterable<any>): Promise<any[]> {
  const events: any[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

describe('StreamAdapter', () => {
  beforeEach(() => {
    capturedOnChunk = null;
    capturedOnFinish = null;
    capturedOnError = null;
  });

  it('yields text-delta events for text chunks', async () => {
    const { streamToAsyncIterable } = await import('../../../src/core/ai/StreamAdapter');
    const iterable = streamToAsyncIterable({
      model: {} as any,
      messages: [{ role: 'user', content: 'hi' }],
    });

    const eventsPromise = collectEvents(iterable);

    await vi.waitFor(() => expect(capturedOnChunk).not.toBeNull());
    capturedOnChunk!({ chunk: { type: 'text-delta', textDelta: 'Hello' } });
    capturedOnFinish!({ usage: { promptTokens: 5, completionTokens: 3 } });

    const events = await eventsPromise;
    const textDeltas = events.filter((e) => e.type === 'text-delta');
    expect(textDeltas.length).toBeGreaterThanOrEqual(1);
  }, 10000);

  it('yields done event immediately when aborted', async () => {
    const ac = new AbortController();
    ac.abort();

    const { streamToAsyncIterable } = await import('../../../src/core/ai/StreamAdapter');
    const iterable = streamToAsyncIterable({
      model: {} as any,
      messages: [{ role: 'user', content: 'hi' }],
      abortSignal: ac.signal,
    });

    const events = await collectEvents(iterable);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('done');
  });

  it('yields done event with usage on stream completion', async () => {
    const { streamToAsyncIterable } = await import('../../../src/core/ai/StreamAdapter');
    const iterable = streamToAsyncIterable({
      model: {} as any,
      messages: [{ role: 'user', content: 'hi' }],
    });

    const eventsPromise = collectEvents(iterable);

    await vi.waitFor(() => expect(capturedOnFinish).not.toBeNull());
    capturedOnFinish!({ usage: { promptTokens: 10, completionTokens: 5 } });

    const events = await eventsPromise;
    const doneEvents = events.filter((e) => e.type === 'done');
    expect(doneEvents.length).toBeGreaterThanOrEqual(1);
  }, 10000);
});
