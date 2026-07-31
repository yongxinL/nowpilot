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

  try {
    const result = (streamText as any)({
      model: options.model,
      messages: options.messages,
      tools: options.tools,
      abortSignal: options.abortSignal,
    }) as { fullStream: AsyncIterable<any> };

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case 'text-delta':
          yield { type: 'text-delta', content: chunk.text ?? '' };
          break;
        case 'tool-call':
          yield { type: 'tool-call', toolName: chunk.toolName ?? '', input: chunk.args };
          break;
        case 'tool-result':
          yield { type: 'tool-result', toolName: chunk.toolName ?? '', output: chunk.result };
          break;
        case 'finish':
          yield {
            type: 'done',
            usage: chunk.totalUsage
              ? { promptTokens: chunk.totalUsage.promptTokens, completionTokens: chunk.totalUsage.completionTokens }
              : undefined,
          };
          return;
        case 'error':
          throw new PipelineError('UNKNOWN', 'Stream error occurred.', { originalError: String(chunk.error) });
      }
    }
  } catch (err) {
    if (err instanceof PipelineError) throw err;
    throw new PipelineError('UNKNOWN', 'Stream error occurred.', { originalError: String(err) });
  }
}
