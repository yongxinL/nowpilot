import type { ILLMProvider, LLMStreamRequest } from '../../../../src/core/ai/ILLMProvider';
import type { ProviderId, StreamEvent } from '../../../../src/core/ai/types';
import { createStreamAdapter } from '../../../../src/core/ai/StreamAdapter';

/**
 * FixtureProvider — an ILLMProvider backed by scripted wire-byte responses
 * (D-48). Each `requestJson` call consumes the NEXT scripted response, so the
 * one-shot repair loop can be driven: call 1 → malformed bytes, call 2
 * (repair prompt) → valid bytes.
 *
 * Implements `requestJson` by feeding the fixture's OpenAI SSE bytes through
 * the real StreamAdapter, so tests exercise the actual wire → adapter → text
 * path. `stream` is not used by this slice's tests (PlannerService drives
 * `requestJson` via StructuredOutput).
 */
export class FixtureProvider implements ILLMProvider {
  readonly providerId: ProviderId = 'openai';
  private readonly responseScript: string[][];
  private callIndex = 0;
  private readonly promptsSeen: string[] = [];

  constructor(responseScript: string[][]) {
    this.responseScript = responseScript;
  }

  /** All prompts received across calls — lets tests assert the repair prompt. */
  get prompts(): readonly string[] {
    return [...this.promptsSeen];
  }

  async *stream(_request: LLMStreamRequest, _signal?: AbortSignal): AsyncIterable<StreamEvent> {
    // Not exercised by the planner tracer slice (03-01); providers land in 03-03.
    throw new Error('FixtureProvider.stream not implemented — requestJson is the scripted path');
  }

  async requestJson(prompt: string, _jsonSchema: unknown, _signal?: AbortSignal): Promise<string> {
    this.promptsSeen.push(prompt);
    const wireChunks = this.responseScript[this.callIndex] ?? [];
    this.callIndex += 1;

    const adapter = createStreamAdapter('fixture-operation');
    const events: StreamEvent[] = [];
    for (const chunk of wireChunks) {
      events.push(...adapter.push(chunk));
    }
    events.push(...adapter.end());
    return eventsToText(events);
  }
}

/** Rebuild the accumulated text from canonical events; surface STREAM_ERROR. */
function eventsToText(events: StreamEvent[]): string {
  let text = '';
  for (const event of events) {
    switch (event.type) {
      case 'STREAM_DELTA':
        text += event.delta;
        break;
      case 'STREAM_ERROR':
        throw new Error(`FixtureProvider: STREAM_ERROR (${event.code}): ${event.message}`);
      case 'STREAM_ABORTED':
        throw new DOMException('Stream aborted', 'AbortError');
      default:
        break;
    }
  }
  return text;
}