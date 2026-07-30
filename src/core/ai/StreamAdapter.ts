import { streamText } from 'ai';
import type { LanguageModel } from 'ai';
import type { StreamEvent } from './types';
import { PipelineError } from './PipelineError';

export interface StreamAdapterOptions {
  model: LanguageModel;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  tools?: Record<string, unknown>;
  abortSignal?: AbortSignal;
}

export async function* streamToAsyncIterable(options: StreamAdapterOptions): AsyncIterable<StreamEvent> {
  if (options.abortSignal?.aborted) {
    yield { type: 'done' };
    return;
  }

  const eventQueue: StreamEvent[] = [];
  let resolveNext: ((value: IteratorResult<StreamEvent>) => void) | null = null;
  let streamDone = false;
  let streamError: PipelineError | null = null;

  const push = (event: StreamEvent) => {
    eventQueue.push(event);
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve({ value: eventQueue.shift()!, done: false });
    }
  };

  const nextEvent = (): Promise<IteratorResult<StreamEvent>> => {
    if (eventQueue.length > 0) {
      return Promise.resolve({ value: eventQueue.shift()!, done: false });
    }
    if (streamError) {
      return Promise.resolve({ value: { type: 'error' as const, error: streamError }, done: true });
    }
    if (streamDone) {
      return Promise.resolve({ value: undefined, done: true });
    }
    return new Promise((resolve) => {
      resolveNext = resolve;
    });
  };

  const streamPromise = (streamText as any)({
    model: options.model,
    messages: options.messages,
    tools: options.tools,
    abortSignal: options.abortSignal,
    onChunk: ({ chunk }: { chunk: any }) => {
      if (chunk.type === 'text-delta') {
        push({ type: 'text-delta', content: chunk.textDelta ?? '' });
      } else if (chunk.type === 'tool-call') {
        push({ type: 'tool-call', toolName: chunk.toolName ?? '', input: chunk.args });
      } else if (chunk.type === 'tool-result') {
        push({ type: 'tool-result', toolName: chunk.toolName ?? '', output: chunk.result });
      }
    },
    onFinish: ({ usage }: { usage?: { promptTokens: number; completionTokens: number } }) => {
      push({
        type: 'done',
        usage: usage ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens } : undefined,
      });
    },
    onError: ({ error }: { error: Error }) => {
      streamError = new PipelineError('UNKNOWN', 'Stream error occurred.', { originalError: error.message });
    },
  });

  try {
    while (true) {
      const event = await nextEvent();
      if (event.done) break;
      yield event.value as StreamEvent;
      const last = event.value as StreamEvent;
      if (last.type === 'done' || last.type === 'error') break;
    }
  } finally {
    await streamPromise;
  }
}
