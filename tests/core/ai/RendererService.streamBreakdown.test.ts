// tests/core/ai/RendererService.streamBreakdown.test.ts — WR-02A permanent
// real-Router regression (03-15). Reproduces VERIFICATION.md gap 2 / WR-02A
// EXACTLY: the empirical probe ran 3×recordFailure('openai','STREAM_FAILED')
// against a REAL ProviderRouter and observed isBreakerOpen === false —
// pre-fix, BREAKER_VOTES had no STREAM_FAILED entry, so voteBreaker computed
// BREAKER_VOTES[code] ?? 0 = 0 and early-returned (contrast: 3×PROVIDER_5XX
// opened the breaker). That probe was a throwaway temp test; this file
// replaces it with a permanent assertion of breaker STATE through the full
// RendererService.render flow:
//
//   - only the ai-sdk call sites are stubbed (streamText) — NEVER the Router
//     singleton; a FRESH real ProviderRouter is injected per test through the
//     hoisted holder (the getProviderRouter() call sites inside
//     RendererService get the SAME instance the tests assert on)
//   - real error classes are kept via the importOriginal spread, so
//     classifyProviderError's instanceof checks stay meaningful
//   - 3 non-stop finishes (STREAM_FAILED, 1 vote each) → breaker OPEN
//   - 3 mid-stream provider errors (classifier-mapped PROVIDER_5XX) → OPEN
//   - user aborts (AbortError) NEVER open — the isAbortError guard runs
//     before any classification/vote
//   - a clean stop never votes — the breaker stays closed
//
// A regression back to a 0-vote table fails this suite immediately.
import { APICallError, streamText } from 'ai';
import type { LanguageModel } from 'ai';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RendererService, isStreamFailedError } from '@/core/ai/RendererService';
import type { RenderInput } from '@/core/ai/RendererService';
import { ProviderRouter } from '@/core/ai/ProviderRouter';
import type { StageInvocation } from '@/core/ai/ProviderRouter';
import { getPromptCacheManager } from '@/core/ai/PromptCacheManager';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';

// Hoisted holder: the mocked getProviderRouter returns holder.current — each
// test injects a FRESH real ProviderRouter instance (never a vi.fn mock), so
// the assertion target IS the router the renderer voted on. `null as
// ProviderRouter` is a promise that beforeEach fills it before any test runs.
const { holder } = vi.hoisted(() => ({
  holder: { current: null as unknown as ProviderRouter },
}));

// Partial module mock (importOriginal spread — the real class/exports are
// preserved): stub ONLY the getProviderRouter singleton seam.
vi.mock('@/core/ai/ProviderRouter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/ai/ProviderRouter')>();
  return { ...actual, getProviderRouter: () => holder.current };
});

// 'ai' module mock: keep the real exports (APICallError's instanceof checks
// in the classifier must work), stub ONLY streamText — the renderer's single
// SDK seam (AgentOrchestrator.budget.test.ts precedent).
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

// Every render gets a fresh operationId — the router is per-test fresh, but a
// unique id keeps operation state fully isolated across renders.
let opSeq = 0;

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
    operationId: `op-stream-breakdown-${(opSeq += 1)}`,
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
  holder.current = new ProviderRouter(); // REAL router — the assertion target
  vi.clearAllMocks();
  getPromptCacheManager().reset(); // hints enabled — buildStageMessages emits providerOptions
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RendererService.render — breaker STATE on the streaming path (WR-02A, 03-15)', () => {
  it('3 non-stop finishes open the breaker — STREAM_FAILED votes 1 each (WR-02A)', async () => {
    // Threshold semantics: a SINGLE non-stop finish (length/content-filter)
    // votes 1 — not enough to open the 3-vote/60 s window.
    mockStream({ deltas: ['x'], finishReason: 'length' });
    await expect(RendererService.render(baseInput())).rejects.toSatisfy(isStreamFailedError);
    expect(holder.current.isBreakerOpen('anthropic')).toBe(false);

    // Then 3× more non-stop finishes — the third qualifying vote opens the
    // 5-minute window (the closed assertion above MUST run before this loop).
    // render() calls the stubbed streamText seam directly, so the now-open
    // breaker does not alter subsequent rejections.
    for (let i = 0; i < 3; i += 1) {
      mockStream({ deltas: ['x'], finishReason: 'length' });
      await expect(RendererService.render(baseInput())).rejects.toSatisfy(isStreamFailedError);
    }
    expect(holder.current.isBreakerOpen('anthropic')).toBe(true);
  });

  it("3 mid-stream PROVIDER_5XX failures open the breaker — the catch votes the classifier's mapped code (WR-02A)", async () => {
    // A real APICallError(500) crosses the catch → the REAL classifier maps it
    // to PROVIDER_5XX (1 vote) → the breaker opens after 3.
    for (let i = 0; i < 3; i += 1) {
      mockStream({
        streamThrows: new APICallError({
          message: 'upstream 500',
          url: 'https://fixture.example/v1/responses',
          requestBodyValues: {},
          statusCode: 500,
        }),
      });
      await expect(RendererService.render(baseInput())).rejects.toSatisfy(isStreamFailedError);
    }
    expect(holder.current.isBreakerOpen('anthropic')).toBe(true);
  });

  it('user aborts never open the breaker — the isAbortError guard runs before any vote', async () => {
    for (let i = 0; i < 3; i += 1) {
      mockStream({ streamThrows: new DOMException('aborted', 'AbortError') });
      await expect(RendererService.render(baseInput())).rejects.toSatisfy(isStreamFailedError);
    }
    // 3 aborts, zero provider votes — the breaker stays closed.
    expect(holder.current.isBreakerOpen('anthropic')).toBe(false);
  });

  it('a clean stop never votes — the breaker stays closed', async () => {
    mockStream({ deltas: ['a'], finishReason: 'stop' });

    const output = await RendererService.render(baseInput());

    expect(output).toEqual({ text: 'a', finishReason: 'stop' });
    expect(holder.current.isBreakerOpen('anthropic')).toBe(false);
  });
});
