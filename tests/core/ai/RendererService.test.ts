import { describe, it, expect } from 'vitest';
import type { ILLMProvider, LLMStreamRequest } from '../../../src/core/ai/ILLMProvider';
import type { StreamEvent } from '../../../src/core/ai/types';
import {
  render,
  DEFAULT_MAX_OUTPUT_TOKENS,
  estimateTokens,
} from '../../../src/core/ai/RendererService';

/**
 * RendererService contract tests (plan 03-04, Task 3):
 *  (a) default cap 512 enforced — a fixture stream longer than 512 tokens is truncated;
 *  (b) the override param raises/lowers the cap (Open Q4 — cap is DATA);
 *  (c) the streamed text equals the model output verbatim (no invented facts);
 *  (d) abort mid-stream surfaces STREAM_ABORTED and stops.
 *
 * The fixture provider yields canonical D-47 events directly (the wire-byte
 * → adapter path is proven by 03-01/03-03 fixtures; this slice tests the
 * renderer's consumption + capping + verbatim contract).
 */

class ScriptedStreamProvider implements ILLMProvider {
  readonly providerId = 'openai' as const;
  constructor(
    private readonly script:
      | AsyncIterable<StreamEvent>
      | ((signal?: AbortSignal) => AsyncIterable<StreamEvent>),
  ) {}
  stream(request: LLMStreamRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    return typeof this.script === 'function' ? this.script(signal) : this.script;
  }
  async requestJson(): Promise<string> {
    throw new Error('ScriptedStreamProvider.requestJson not used by RendererService tests');
  }
}

const OP = 'op-renderer-test';

function renderInput(overrides: Partial<Parameters<typeof render>[0]> = {}) {
  return {
    operationId: OP,
    provider: new ScriptedStreamProvider(async function* () {
      /* replaced per test */
    }),
    model: 'gpt-4o-mini',
    tier: 'fast' as const,
    systemPrompt: 'Answer using only the provided context.',
    ...overrides,
  };
}

function makeStream(deltaCount: number, delta: string): AsyncIterable<StreamEvent> {
  return (async function* () {
    yield { type: 'STREAM_START', operationId: OP };
    for (let i = 0; i < deltaCount; i++) {
      yield { type: 'STREAM_DELTA', operationId: OP, delta };
    }
    yield { type: 'STREAM_COMPLETE', operationId: OP, fullText: delta.repeat(deltaCount) };
  })();
}

/** 300 × 10 chars = 3000 chars ≈ 750 tokens — comfortably over the 512 cap. */
function longStream(): AsyncIterable<StreamEvent> {
  return makeStream(300, 'x'.repeat(10));
}

describe('RendererService — 512-token default cap (Open Q4)', () => {
  it('(a) a stream longer than 512 tokens is truncated at the default cap', async () => {
    const result = await render(renderInput({ provider: new ScriptedStreamProvider(longStream) }));
    expect(result.truncated).toBe(true);
    expect(result.terminatedBy).toBe('cap');
    expect(result.maxOutputTokens).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(result.tokenCount).toBeLessThanOrEqual(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(result.tokenCount).toBeGreaterThan(400); // the cap engages near 512, not at the start
    // Truncation is a prefix of the model output — every char relayed is model text.
    expect(result.streamedText).toMatch(/^x+$/);
    expect(result.streamedText.length % 10).toBe(0);
  });

  it('(b) the override param lowers the cap', async () => {
    const result = await render(
      renderInput({ provider: new ScriptedStreamProvider(longStream()), maxOutputTokens: 50 }),
    );
    expect(result.truncated).toBe(true);
    expect(result.maxOutputTokens).toBe(50);
    expect(result.tokenCount).toBeLessThanOrEqual(50);
    expect(result.streamedText.length).toBeLessThan(204); // ~50 tokens ≈ 200 chars, delta-granular
  });

  it('(b) the override param raises the cap', async () => {
    // 3000 chars ≈ 750 tokens < 1000 → no truncation with the raised cap.
    const result = await render(
      renderInput({ provider: new ScriptedStreamProvider(longStream()), maxOutputTokens: 1000 }),
    );
    expect(result.truncated).toBe(false);
    expect(result.terminatedBy).toBe('completed');
    expect(result.streamedText).toBe('x'.repeat(3000));
  });
});

describe('RendererService — CR-05: no renderer-internal options in the provider request', () => {
  it('the LLMStreamRequest carries no options — {maxTokens, tier} never reach the provider body', async () => {
    let captured: LLMStreamRequest | undefined;
    const stream = (async function* (): AsyncGenerator<StreamEvent, void, unknown> {
      yield { type: 'STREAM_START', operationId: OP };
      yield { type: 'STREAM_DELTA', operationId: OP, delta: 'ok' };
      yield { type: 'STREAM_COMPLETE', operationId: OP, fullText: 'ok' };
    })();
    const provider = new ScriptedStreamProvider(stream);
    // Capture the request the renderer hands the provider.
    const origStream = provider.stream.bind(provider);
    provider.stream = (request: LLMStreamRequest, signal?: AbortSignal) => {
      captured = request;
      return origStream(request, signal);
    };

    await render(renderInput({ provider }));

    // Anthropic/Gemini validate strictly — the renderer-internal tier/maxTokens
    // options must NOT be forwarded into the provider request body.
    expect(captured).toBeDefined();
    expect(captured!.options).toBeUndefined();
  });
});

describe('RendererService — verbatim relay (no invented facts)', () => {
  it('(c) the streamed text equals the model output verbatim', async () => {
    const expected = 'Hello world — relayed exactly as the model produced it.';
    const stream = (async function* (): AsyncGenerator<StreamEvent, void, unknown> {
      yield { type: 'STREAM_START', operationId: OP };
      yield { type: 'STREAM_DELTA', operationId: OP, delta: 'Hello world — ' };
      yield { type: 'STREAM_DELTA', operationId: OP, delta: 'relayed exactly as the model produced it.' };
      yield { type: 'STREAM_COMPLETE', operationId: OP, fullText: expected };
    })();
    const result = await render(renderInput({ provider: new ScriptedStreamProvider(stream) }));
    expect(result.terminatedBy).toBe('completed');
    expect(result.truncated).toBe(false);
    expect(result.streamedText).toBe(expected);
    expect(result.tokenCount).toBe(estimateTokens(expected));
  });
});

describe('RendererService — abort mid-stream', () => {
  it('(d) abort surfaces STREAM_ABORTED and stops', async () => {
    const controller = new AbortController();
    const events: StreamEvent[] = [];
    const stream = (async function* (signal?: AbortSignal) {
      yield { type: 'STREAM_START', operationId: OP };
      for (let i = 0; i < 100; i++) {
        if (signal?.aborted) return; // co-operative generator: stop yielding
        yield { type: 'STREAM_DELTA', operationId: OP, delta: `chunk-${i} ` };
        await new Promise((r) => setTimeout(r, 5));
      }
      yield { type: 'STREAM_COMPLETE', operationId: OP, fullText: 'unreachable' };
    }) as (signal?: AbortSignal) => AsyncIterable<StreamEvent>;

    const renderPromise = render(
      renderInput({
        provider: new ScriptedStreamProvider(stream),
        abortSignal: controller.signal,
        onEvent: (e) => events.push(e),
      }),
    );

    await new Promise((r) => setTimeout(r, 30)); // let a few deltas flow
    controller.abort();

    const result = await renderPromise;
    expect(result.terminatedBy).toBe('aborted');
    expect(events.some((e) => e.type === 'STREAM_ABORTED')).toBe(true);
    // Stopped — the accumulated text is a partial prefix, not the full stream.
    expect(result.streamedText.length).toBeLessThan('chunk-99 '.length * 100);
    expect(result.streamedText).toMatch(/^chunk-\d+ /);
    expect(result.streamedText).not.toContain('unreachable');
  });
});