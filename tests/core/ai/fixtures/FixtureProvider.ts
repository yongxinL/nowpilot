import type { ILLMProvider, LLMStreamRequest } from '../../../../src/core/ai/ILLMProvider';
import type { ProviderId, StreamErrorCode, StreamEvent } from '../../../../src/core/ai/types';
import { createStreamAdapter } from '../../../../src/core/ai/StreamAdapter';

/**
 * FixtureProvider — an ILLMProvider backed by scripted wire-byte responses
 * (D-48). Each `requestJson` call consumes the NEXT scripted response, so the
 * one-shot repair loop can be driven: call 1 → malformed bytes, call 2
 * (repair prompt) → valid bytes.
 *
 * Implements `requestJson` by feeding the fixture's OpenAI SSE bytes through
 * the real StreamAdapter, so tests exercise the actual wire → adapter → text
 * path.
 *
 * Since plan 03-05, `stream` is scriptable too: a `streamScript` of canonical
 * events (delta / complete / error / abort) drives ProviderRouter fallback +
 * circuit-breaker tests, and `providerId` lets router tests model local vs
 * cloud providers. `streamCalls` counts invocations so tests can assert
 * "provider B was never called" (no-switch / skip-open-provider rules).
 */
export type FixtureStreamStep =
  | { kind: 'delta'; delta: string }
  | { kind: 'complete'; fullText: string }
  | { kind: 'error'; code: StreamErrorCode; message: string }
  | { kind: 'abort' };

export interface FixtureProviderOptions {
  /** Scripted stream() behavior (03-05 router tests). Empty → stream yields nothing. */
  streamScript?: FixtureStreamStep[];
  /** Runtime provider id (default 'openai') — lets router tests model ollama/openai etc. */
  providerId?: ProviderId;
}

export class FixtureProvider implements ILLMProvider {
  readonly providerId: ProviderId;
  private readonly responseScript: string[][];
  private readonly streamScript: FixtureStreamStep[];
  private callIndex = 0;
  private readonly promptsSeen: string[] = [];
  private _streamCalls = 0;

  constructor(responseScript: string[][] = [], opts: FixtureProviderOptions = {}) {
    this.responseScript = responseScript;
    this.streamScript = opts.streamScript ?? [];
    this.providerId = opts.providerId ?? 'openai';
  }

  /** All prompts received across calls — lets tests assert the repair prompt. */
  get prompts(): readonly string[] {
    return [...this.promptsSeen];
  }

  /** Number of stream() invocations — router tests assert fallback/skip behavior. */
  get streamCalls(): number {
    return this._streamCalls;
  }

  async *stream(request: LLMStreamRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const { operationId } = request;
    this._streamCalls += 1;
    if (signal?.aborted) {
      yield { type: 'STREAM_ABORTED', operationId };
      return;
    }
    let started = false;
    for (const step of this.streamScript) {
      if (signal?.aborted) {
        yield { type: 'STREAM_ABORTED', operationId };
        return;
      }
      switch (step.kind) {
        case 'delta':
          // STREAM_START precedes the first delta — mirrors StreamAdapter.
          if (!started) {
            yield { type: 'STREAM_START', operationId };
            started = true;
          }
          yield { type: 'STREAM_DELTA', operationId, delta: step.delta };
          break;
        case 'complete':
          if (!started) {
            yield { type: 'STREAM_START', operationId };
            started = true;
          }
          yield { type: 'STREAM_COMPLETE', operationId, fullText: step.fullText };
          return;
        case 'error':
          yield { type: 'STREAM_ERROR', operationId, code: step.code, message: step.message };
          return;
        case 'abort':
          yield { type: 'STREAM_ABORTED', operationId };
          return;
      }
    }
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