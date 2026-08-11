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

import { APICallError, streamText } from 'ai';
import type { CoreMessage, LanguageModel } from 'ai';

import {
  RENDERER_MAX_TOKENS,
  RendererService,
  isStreamFailedError,
} from '@/core/ai/RendererService';
import type { RenderInput, StreamFailedError } from '@/core/ai/RendererService';
import { CACHED_KINDS, ProviderRouter, joinSections } from '@/core/ai/ProviderRouter';
import type { StageInvocation } from '@/core/ai/ProviderRouter';
import { getPromptCacheManager } from '@/core/ai/PromptCacheManager';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';

// WR-02 (03-12): hoisted mock of the Router singleton. RendererService imports
// buildStageMessages + getProviderRouter from ProviderRouter — a WHOLE-module
// mock would break the F-5 shape, so use the importOriginal spread (real
// exports preserved) and stub ONLY getProviderRouter (ProviderRouter.test.ts
// L46-53 pattern).
const { routerMock } = vi.hoisted(() => ({
  routerMock: {
    recordFailure: vi.fn(),
    markStreamedFirstToken: vi.fn(),
    classifyProviderError: vi.fn(),
  },
}));

// WR-02A (03-15): delegate the stub to the REAL classifier — the method is
// `this`-free (reads no instance state), so the unbound reference is safe and
// the mid-stream vote test asserts the mapped code (PROVIDER_5XX), not a
// hardcoded STREAM_FAILED. vi.fn(fn) wraps the real method while keeping the
// call-recording Mock surface the WR-02 assertions rely on.
routerMock.classifyProviderError = vi.fn(new ProviderRouter().classifyProviderError);

vi.mock('@/core/ai/ProviderRouter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/ai/ProviderRouter')>();
  return { ...actual, getProviderRouter: () => routerMock };
});

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
  routerMock.recordFailure.mockClear();
  routerMock.markStreamedFirstToken.mockClear();
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

describe('RendererService.render — breaker votes + stream-freeze (WR-02, 03-12)', () => {
  // WR-02 (03-12): provider-originated failures vote the breaker through the
  // routerMock; a user abort never votes (isAbortError guard). WR-02A (03-15):
  // the mid-stream catch votes the REAL classifier's mapped code — a 500 maps
  // to PROVIDER_5XX (a 1-vote code), so the wiring assertion detects a 0-vote
  // regression again.
  it('a mid-stream provider error votes the breaker with the classifier-mapped code, and the first delta froze the operation', async () => {
    // WR-02A: throw a CLASSIFIABLE provider error (real APICallError, 500) —
    // the catch routes it through the delegated real classifier → PROVIDER_5XX
    // (1-vote). A hardcoded STREAM_FAILED/UNKNOWN would leave the breaker
    // inert (0 votes) — the mapped-code assertion pins the wiring.
    mockStream({
      streamThrows: new APICallError({
        message: 'upstream 500',
        url: 'https://fixture.example/v1/responses',
        requestBodyValues: {},
        statusCode: 500,
      }),
    });

    let caught: unknown;
    try {
      await RendererService.render(baseInput({}));
    } catch (e) {
      caught = e;
    }
    expect(isStreamFailedError(caught)).toBe(true);

    // Deltas 'Hel','lo' streamed before the throw — the first delta froze the op.
    expect(routerMock.markStreamedFirstToken).toHaveBeenCalledTimes(1);
    expect(routerMock.markStreamedFirstToken).toHaveBeenCalledWith('op-render-0001');
    // WR-02A: the catch classifies the underlying error through the real
    // classifier (once), then votes the MAPPED code — never a hardcoded
    // STREAM_FAILED double-count (03-12 intent).
    expect(routerMock.classifyProviderError).toHaveBeenCalledTimes(1);
    expect(routerMock.recordFailure).toHaveBeenCalledTimes(1);
    expect(routerMock.recordFailure).toHaveBeenCalledWith(
      'anthropic',
      'PROVIDER_5XX',
      expect.any(Error),
    );
  });

  it('the first streamed delta marks the provider frozen (never switches) — clean stop path does not vote', async () => {
    mockStream({ deltas: ['a'], finishReason: 'stop' });

    const output = await RendererService.render(baseInput({}));

    expect(output).toEqual({ text: 'a', finishReason: 'stop' });
    expect(routerMock.markStreamedFirstToken).toHaveBeenCalledTimes(1);
    expect(routerMock.markStreamedFirstToken).toHaveBeenCalledWith('op-render-0001');
    expect(routerMock.recordFailure).not.toHaveBeenCalled();
  });

  it('a user abort does NOT vote the breaker (isAbortError guard), but the first token still froze the op', async () => {
    mockStream({ streamThrows: new DOMException('aborted', 'AbortError') });

    let caught: unknown;
    try {
      await RendererService.render(baseInput({}));
    } catch (e) {
      caught = e;
    }
    expect(isStreamFailedError(caught)).toBe(true);
    // The first token legitimately streamed before the abort — freeze marked once.
    expect(routerMock.markStreamedFirstToken).toHaveBeenCalledTimes(1);
    // A user abort is NOT a provider failure — never a breaker vote (T-03-12-01).
    expect(routerMock.recordFailure).not.toHaveBeenCalled();
  });

  it('a non-stop finish (content-filter/length) votes the breaker — a provider behavior, never a user abort', async () => {
    mockStream({ deltas: ['x'], finishReason: 'length' });

    let caught: unknown;
    try {
      await RendererService.render(baseInput({}));
    } catch (e) {
      caught = e;
    }
    expect(isStreamFailedError(caught)).toBe(true);
    expect(routerMock.recordFailure).toHaveBeenCalledTimes(1);
    expect(routerMock.recordFailure).toHaveBeenCalledWith('anthropic', 'STREAM_FAILED');
  });
});
