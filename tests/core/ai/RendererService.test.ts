// tests/core/ai/RendererService.test.ts — renderer contract (03-06, Seam 3 +
// P-4/F-5). RendererService is ONE of the two streamText consumers (AI-SPEC
// rule: streamText lives only inside RendererService/StreamAdapter). render()
// builds its streamText call from the Router's F-5 messages[] builder
// (buildStageMessages, 03-05): the constructed call is the messages[] form with
// the CoreSystemMessage carrying providerOptions.anthropic.cacheControl — NEVER
// the `system` string form (ai@4 silently drops the cache breakpoint on it).
// Streaming honesty (T-03-06-01): a finishReason !== 'stop' or a mid-stream
// rejection throws the typed STREAM_FAILED error whose partialText is EXACTLY
// the pre-failure deltas — a failed stream is never silently returned as
// 'complete' (done XOR error, Pitfall 5). Abort honesty (T-03-06-04): the
// caller's abortSignal is threaded unchanged into the constructed call, so
// cancel stops generation — no orphaned request bills tokens.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { streamText } from 'ai';
import type { CoreMessage, LanguageModel } from 'ai';

import {
  RENDERER_MAX_TOKENS,
  RendererService,
  isStreamFailedError,
} from '@/core/ai/RendererService';
import type { RenderInput, StreamFailedError } from '@/core/ai/RendererService';
import { CACHED_KINDS, joinSections } from '@/core/ai/ProviderRouter';
import type { StageInvocation } from '@/core/ai/ProviderRouter';
import { getPromptCacheManager } from '@/core/ai/PromptCacheManager';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';

// 'ai' module mock: keep the real exports (ProviderRouter's buildStageMessages
// chain imports the SDK), stub ONLY streamText — the renderer's single SDK seam.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn(),
  };
});

const streamTextMock = vi.mocked(streamText);

const fakeModel = {
  id: 'fixture-model',
  vendor: 'fixture',
  modelId: 'claude-3-5-haiku-latest',
} as unknown as LanguageModel;

function invocationStub(overrides: Partial<StageInvocation> = {}): StageInvocation {
  return {
    providerId: 'anthropic',
    model: fakeModel,
    jsonMode: 'native',
    callProviderJsonMode: vi.fn(async () => '{}'),
    ...overrides,
  };
}

function baseInput(overrides: Partial<RenderInput> = {}): RenderInput {
  return {
    operationId: 'op-render-0001',
    context: buildOptimizedContextFixture(),
    userInput: 'Summarize the current page.',
    toolResults: [],
    abortSignal: new AbortController().signal,
    invocation: invocationStub(),
    ...overrides,
  };
}

function mockStream(
  opts: {
    deltas?: string[];
    finishReason?: string;
    finishRejects?: Error;
    streamThrows?: Error;
  } = {},
) {
  const deltas = opts.deltas ?? ['Hel', 'lo'];
  const textStream = (async function* () {
    for (const d of deltas) yield d;
    if (opts.streamThrows) throw opts.streamThrows;
  })();
  const finishReason = opts.finishRejects
    ? Promise.reject(opts.finishRejects)
    : Promise.resolve(opts.finishReason ?? 'stop');
  streamTextMock.mockReturnValue({ textStream, finishReason } as unknown as ReturnType<
    typeof streamText
  >);
}

beforeEach(() => {
  vi.clearAllMocks();
  getPromptCacheManager().reset(); // hints enabled — the F-5 fixture asserts emission
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RendererService.render — streaming honesty (done XOR error, T-03-06-01)', () => {
  it('streams deltas live via onDelta and returns the accumulated text on finishReason stop', async () => {
    mockStream({ deltas: ['Hel', 'lo'], finishReason: 'stop' });
    const onDelta = vi.fn();
    const output = await RendererService.render(baseInput({ onDelta }));

    expect(onDelta).toHaveBeenCalledTimes(2);
    expect(onDelta).toHaveBeenNthCalledWith(1, 'Hel');
    expect(onDelta).toHaveBeenNthCalledWith(2, 'lo');
    expect(output).toEqual({ text: 'Hello', finishReason: 'stop' });
  });

  it('a mid-stream rejection throws the typed STREAM_FAILED error — partial text is exactly the pre-failure deltas', async () => {
    mockStream({
      deltas: ['part'],
      streamThrows: new Error('connection reset mid-stream'),
    });
    const onDelta = vi.fn();

    let caught: unknown;
    try {
      await RendererService.render(baseInput({ onDelta }));
    } catch (e) {
      caught = e;
    }

    expect(isStreamFailedError(caught)).toBe(true);
    if (isStreamFailedError(caught)) {
      expect(caught.code).toBe('STREAM_FAILED');
      expect(caught.partialText).toBe('part'); // exactly the pre-failure deltas
    }
    expect(onDelta).toHaveBeenCalledTimes(1); // no delta past the failure point
    expect(onDelta).toHaveBeenNthCalledWith(1, 'part');
  });

  it('finishReason !== stop (length truncation) is a FAILED terminal, never a silently-truncated complete text', async () => {
    mockStream({ deltas: ['trun', 'cated'], finishReason: 'length' });
    const onDelta = vi.fn();

    let caught: unknown;
    try {
      await RendererService.render(baseInput({ onDelta }));
    } catch (e) {
      caught = e;
    }

    expect(isStreamFailedError(caught)).toBe(true);
    if (isStreamFailedError(caught)) {
      expect((caught as StreamFailedError).partialText).toBe('truncated');
    }
    // Deltas still streamed live — the FAILURE is only surfaced at the terminal.
    expect(onDelta).toHaveBeenCalledTimes(2);
  });

  it('a finishReason rejection (stream error at the terminal promise) also throws STREAM_FAILED', async () => {
    mockStream({
      deltas: ['p1', 'p2'],
      finishRejects: new Error('provider aborted the generation'),
    });

    await expect(RendererService.render(baseInput({}))).rejects.toSatisfy(isStreamFailedError);
  });
});

describe('RendererService.render — abort cancels generation (T-03-06-04)', () => {
  it('threads the caller abortSignal unchanged into the constructed streamText call', async () => {
    mockStream();
    const abort = new AbortController();
    await RendererService.render(baseInput({ abortSignal: abort.signal }));

    const args = streamTextMock.mock.calls[0][0];
    expect(args.abortSignal).toBe(abort.signal); // Appendix I rule: unchanged pass-through
  });

  it('an aborted stream never returns a complete text — it terminates in STREAM_FAILED', async () => {
    const abortError = new DOMException('aborted', 'AbortError');
    mockStream({ deltas: ['half'], streamThrows: abortError });

    let caught: unknown;
    try {
      await RendererService.render(baseInput({}));
    } catch (e) {
      caught = e;
    }
    expect(isStreamFailedError(caught)).toBe(true);
  });
});

describe('RendererService.render — F-5 call shape (messages[]+providerOptions, never the system string)', () => {
  it('constructs streamText via the Router-built messages[] — no system string key, maxRetries 0, maxTokens 512', async () => {
    mockStream();
    const fixture = buildOptimizedContextFixture();

    await RendererService.render(baseInput({ context: fixture }));

    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const args = streamTextMock.mock.calls[0][0];
    // F-5: messages[] form — `system:` must never be an object key on the call.
    expect('system' in args).toBe(false);
    expect(args.messages).toBeDefined();
    const messages = args.messages as CoreMessage[];
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    // The byte-stable persona/prompt block (03-07) is the [SYSTEM] message content.
    expect(messages[0].content).toBe(joinSections(fixture.sections, CACHED_KINDS));
    expect(messages[1]).toEqual({ role: 'user', content: expect.any(String) });
    // The anthropic cacheControl breakpoint reaches the wire on the CoreSystemMessage.
    expect((messages[0] as { providerOptions?: unknown }).providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });
    expect(args.maxRetries).toBe(0); // Pitfall 1 — the Router owns retries (D-17)
    expect(args.maxTokens).toBe(RENDERER_MAX_TOKENS); // §1.2 renderer cap
  });

  it('no providerOptions when the cache-hint cascade has paused hints (PromptCacheManager 5-miss rule)', async () => {
    mockStream();
    const manager = getPromptCacheManager();
    for (let i = 0; i < 5; i += 1) manager.recordMiss();

    await RendererService.render(baseInput({}));

    const args = streamTextMock.mock.calls[0][0];
    const messages = (args.messages ?? []) as CoreMessage[];
    expect((messages[0] as { providerOptions?: unknown }).providerOptions).toBeUndefined(); // hints paused — no payload
    expect(manager.hintsEnabled()).toBe(false);
  });

  it('uses the invocation-provided model (the Router-resolved LanguageModel) on the call', async () => {
    mockStream();
    const model = {
      id: 'resolved',
      vendor: 'fixture',
      modelId: 'gemini-2.5-flash',
    } as unknown as LanguageModel;

    await RendererService.render(
      baseInput({ invocation: invocationStub({ providerId: 'gemini', model }) }),
    );

    const args = streamTextMock.mock.calls[0][0];
    expect(args.model).toBe(model);
  });
});
