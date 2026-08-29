import { describe, it, expect, beforeEach } from 'vitest';
import {
  route,
  RouterError,
  RETRY_TABLE,
  CIRCUIT_BREAKER_VOTES,
  CIRCUIT_BREAKER_WINDOW_MS,
  CIRCUIT_OPEN_MS,
  __test__ as routerTest,
  type ProviderRouteInput,
} from '../../../src/core/ai/ProviderRouter';
import type { StreamEvent } from '../../../src/core/ai/types';
import type { ILLMProvider, LLMStreamRequest } from '../../../src/core/ai/ILLMProvider';
import { FixtureProvider } from './fixtures/FixtureProvider';

/**
 * ProviderRouter tests (plan 03-05, Task 3 — the DONE-when 2 gate: one
 * provider down → the next enabled provider is tried).
 *
 * Case groups (plan):
 *   (a) one provider down (fixture throwing NETWORK) → next enabled provider
 *       is tried and succeeds
 *   (b) AUTH failure opens the breaker immediately (vote 3)
 *   (c) 3 NETWORK votes within 60 s → provider open, subsequent route skips it
 *   (d) no switch after first token (streaming a token then failing → NOT re-routed)
 *   (e) allowCloudFallbackFromLocal=false blocks local→cloud switch
 *   (f) the locked §20.10 table implemented verbatim (retryable + CB vote)
 *   (g) D-54a: a candidate without a resolved model is skipped, never invented
 */

function baseInput(overrides: Partial<ProviderRouteInput> = {}): ProviderRouteInput {
  return {
    operationId: 'op-test',
    tier: 'fast',
    systemPrompt: 'system',
    providerCandidates: [],
    modelForProvider: () => 'fixture-model',
    allowCloudFallbackFromLocal: true,
    ...overrides,
  };
}

async function collect(events: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

beforeEach(() => {
  routerTest.resetBreaker();
});

describe('(a) provider fallback — one provider down → next enabled provider', () => {
  it('a NETWORK-failing provider falls through to a succeeding provider (DONE-when 2)', async () => {
    const down = new FixtureProvider([], {
      streamScript: [{ kind: 'error', code: 'NETWORK', message: 'conn refused' }],
      providerId: 'openai',
    });
    const up = new FixtureProvider([], {
      streamScript: [
        { kind: 'delta', delta: 'hello' },
        { kind: 'complete', fullText: 'hello' },
      ],
      providerId: 'anthropic',
    });

    const result = await route(
      baseInput({ providerCandidates: [down, up] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providerId).toBe('anthropic');
    const events = await collect(result.events);
    expect(events.some((e) => e.type === 'STREAM_DELTA' && e.delta === 'hello')).toBe(true);
    expect(events.at(-1)?.type).toBe('STREAM_COMPLETE');
    expect(down.streamCalls).toBe(1);
    expect(up.streamCalls).toBe(1);
    // Attempt state records the failed attempt + the successful one.
    expect(result.state.attempts.map((a) => a.providerId)).toEqual(['openai', 'anthropic']);
    expect(result.state.attempts[0]?.code).toBe('NETWORK');
    expect(result.state.attempts[1]?.streamedFirstToken).toBe(true);
  });

  it('a NON-retryable failure (PROVIDER_MODEL_UNKNOWN) still falls through to the next provider', async () => {
    const unknown = new FixtureProvider([], {
      streamScript: [{ kind: 'error', code: 'PROVIDER_MODEL_UNKNOWN', message: 'model gone' }],
      providerId: 'openai',
    });
    const up = new FixtureProvider([], {
      streamScript: [{ kind: 'delta', delta: 'ok' }],
      providerId: 'gemini',
    });
    const result = await route(baseInput({ providerCandidates: [unknown, up] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providerId).toBe('gemini');
  });

  it('returns RouterError with the last failure code when all providers fail', async () => {
    const a = new FixtureProvider([], {
      streamScript: [{ kind: 'error', code: 'NETWORK', message: 'a down' }],
      providerId: 'openai',
    });
    const b = new FixtureProvider([], {
      streamScript: [{ kind: 'error', code: 'PROVIDER_5XX', message: 'b down' }],
      providerId: 'anthropic',
    });
    const result = await route(baseInput({ providerCandidates: [a, b] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(RouterError);
    expect(result.error.code).toBe('PROVIDER_5XX');
  });
});

describe('(b) AUTH opens the breaker immediately (vote 3)', () => {
  it('PROVIDER_AUTH failure opens the provider — subsequent routes skip it', async () => {
    const authA = new FixtureProvider([], {
      streamScript: [{ kind: 'error', code: 'PROVIDER_AUTH', message: 'invalid key' }],
      providerId: 'openai',
    });
    const upB = new FixtureProvider([], {
      streamScript: [{ kind: 'delta', delta: 'ok' }],
      providerId: 'anthropic',
    });

    // First route: A auth-fails (opens immediately), B succeeds.
    const r1 = await route(baseInput({ providerCandidates: [authA, upB] }));
    expect(r1.ok).toBe(true);
    expect(routerTest.isOpen('openai')).toBe(true);

    // Second route: A is open → skipped entirely; B handles the call.
    const r2 = await route(baseInput({ providerCandidates: [authA, upB] }));
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.providerId).toBe('anthropic');
    expect(authA.streamCalls).toBe(1); // only the first route called it
  });
});

describe('(c) circuit breaker — 3 votes within 60 s → open 5 min, skipped', () => {
  it('3 NETWORK votes within the window open the provider; the next route skips it', async () => {
    const flaky = new FixtureProvider([], {
      streamScript: [{ kind: 'error', code: 'NETWORK', message: 'flaky' }],
      providerId: 'openai',
    });
    const stable = new FixtureProvider([], {
      streamScript: [{ kind: 'delta', delta: 'ok' }],
      providerId: 'anthropic',
    });

    for (let i = 0; i < 3; i++) {
      const r = await route(baseInput({ providerCandidates: [flaky, stable] }));
      expect(r.ok).toBe(true);
      // Votes accumulate 1 → 2; the 3rd vote TRIPS the breaker, which resets
      // the vote list (a fresh window starts after opening).
      if (i < 2) expect(routerTest.voteCount('openai')).toBe(i + 1);
    }

    expect(routerTest.isOpen('openai')).toBe(true);

    // Subsequent route: the open provider is skipped — only B is attempted.
    const r4 = await route(baseInput({ providerCandidates: [flaky, stable] }));
    expect(r4.ok).toBe(true);
    if (!r4.ok) return;
    expect(r4.providerId).toBe('anthropic');
    expect(flaky.streamCalls).toBe(3); // the 4th route never called A
  });

  it('a single failing provider with a retryable code is retried ONCE, then errors', async () => {
    const solo = new FixtureProvider([], {
      streamScript: [{ kind: 'error', code: 'NETWORK', message: 'down' }],
      providerId: 'openai',
    });
    const result = await route(baseInput({ providerCandidates: [solo] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NETWORK');
    expect(solo.streamCalls).toBe(2); // attempt + the single retry
  });

  it('exports the locked constants', () => {
    expect(CIRCUIT_BREAKER_VOTES).toBe(3);
    expect(CIRCUIT_BREAKER_WINDOW_MS).toBe(60_000);
    expect(CIRCUIT_OPEN_MS).toBe(300_000);
  });
});

describe('(d) never switch after the first token', () => {
  it('a stream that fails AFTER streaming a token is NOT re-routed', async () => {
    const streamThenFail = new FixtureProvider([], {
      streamScript: [
        { kind: 'delta', delta: 'partial answer' },
        { kind: 'error', code: 'NETWORK', message: 'mid-stream death' },
      ],
      providerId: 'openai',
    });
    const neverCalled = new FixtureProvider([], {
      streamScript: [{ kind: 'delta', delta: 'should never stream' }],
      providerId: 'anthropic',
    });

    const result = await route(baseInput({ providerCandidates: [streamThenFail, neverCalled] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providerId).toBe('openai');
    expect(result.state.hasStreamedFirstToken).toBe(true);

    const events = await collect(result.events);
    // The error flows through to the caller from the SAME provider — no reroute.
    expect(events.some((e) => e.type === 'STREAM_DELTA')).toBe(true);
    expect(events.some((e) => e.type === 'STREAM_ERROR' && e.code === 'NETWORK')).toBe(true);
    expect(neverCalled.streamCalls).toBe(0);
  });
});

describe('(e) allowCloudFallbackFromLocal — never silently switch local→cloud', () => {
  it('blocks the local→cloud fallback when the flag is false', async () => {
    const localDown = new FixtureProvider([], {
      streamScript: [{ kind: 'error', code: 'NETWORK', message: 'local ollama down' }],
      providerId: 'ollama',
    });
    const cloudUp = new FixtureProvider([], {
      streamScript: [{ kind: 'delta', delta: 'cloud' }],
      providerId: 'openai',
    });

    // Flag false: local primary → the chain is restricted to local providers.
    const blocked = await route(
      baseInput({
        providerCandidates: [localDown, cloudUp],
        allowCloudFallbackFromLocal: false,
      }),
    );
    expect(blocked.ok).toBe(false);
    expect(cloudUp.streamCalls).toBe(0);

    // Flag true: fallback allowed.
    const allowed = await route(
      baseInput({
        providerCandidates: [localDown, cloudUp],
        allowCloudFallbackFromLocal: true,
      }),
    );
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.providerId).toBe('openai');
  });

  it('cloud primary with the flag false may still fall to a local provider (cloud→local is allowed)', async () => {
    const cloudDown = new FixtureProvider([], {
      streamScript: [{ kind: 'error', code: 'NETWORK', message: 'cloud down' }],
      providerId: 'openai',
    });
    const localUp = new FixtureProvider([], {
      streamScript: [{ kind: 'delta', delta: 'local' }],
      providerId: 'ollama',
    });
    const result = await route(
      baseInput({ providerCandidates: [cloudDown, localUp], allowCloudFallbackFromLocal: false }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providerId).toBe('ollama');
  });
});

describe('(f) §20.10 locked table verbatim', () => {
  it('every code carries the locked retryable + CB vote', () => {
    expect(RETRY_TABLE).toEqual({
      TIMEOUT: { retryable: true, cbVote: 1 },
      PROVIDER_5XX: { retryable: true, cbVote: 1 },
      NETWORK: { retryable: true, cbVote: 1 },
      RATE_LIMITED: { retryable: true, cbVote: 0 },
      PROVIDER_AUTH: { retryable: false, cbVote: 3 },
      PROVIDER_MODEL_UNKNOWN: { retryable: false, cbVote: 0 },
      SCHEMA_INVALID: { retryable: false, cbVote: 0 },
      HOST_NOT_PERMITTED: { retryable: false, cbVote: 0 },
    });
  });

  it('PROVIDER_5XX vote 1 accumulates like NETWORK (locked table)', async () => {
    const fivxx = new FixtureProvider([], {
      streamScript: [{ kind: 'error', code: 'PROVIDER_5XX', message: '500' }],
      providerId: 'openai',
    });
    const stable = new FixtureProvider([], {
      streamScript: [{ kind: 'delta', delta: 'ok' }],
      providerId: 'anthropic',
    });
    for (let i = 0; i < 3; i++) {
      await route(baseInput({ providerCandidates: [fivxx, stable] }));
    }
    expect(routerTest.isOpen('openai')).toBe(true);
  });
});

describe('(h) CR-03 — a bare STREAM_START never locks the provider', () => {
  it('an error-first stream (STREAM_START then STREAM_ERROR, zero tokens) falls back to the next candidate', async () => {
    // Mirrors the adapter's pre-fix empty/truncated stream shape: STREAM_START
    // fires on the first chunk that parses ANY line, then STREAM_ERROR. Zero
    // tokens were produced — the router must NOT lock and must fall back.
    class StartThenErrorProvider implements ILLMProvider {
      readonly providerId = 'openai' as const;
      streamCalls = 0;
      stream(request: LLMStreamRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
        const { operationId } = request;
        this.streamCalls += 1;
        return (async function* () {
          yield { type: 'STREAM_START', operationId };
          yield {
            type: 'STREAM_ERROR',
            operationId,
            code: 'NETWORK',
            message: 'stream ended without terminator',
          };
        })();
      }
      async requestJson(): Promise<string> {
        throw new Error('StartThenErrorProvider.requestJson not used');
      }
    }
    const truncated = new StartThenErrorProvider();
    const up = new FixtureProvider([], {
      streamScript: [
        { kind: 'delta', delta: 'ok' },
        { kind: 'complete', fullText: 'ok' },
      ],
      providerId: 'anthropic',
    });

    const result = await route(baseInput({ providerCandidates: [truncated, up] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The empty/truncated candidate did NOT lock — the fallback answered.
    expect(result.providerId).toBe('anthropic');
    expect(truncated.streamCalls).toBe(1);
    expect(up.streamCalls).toBe(1);
    const events = await collect(result.events);
    expect(events.some((e) => e.type === 'STREAM_DELTA' && e.delta === 'ok')).toBe(true);
  });

  it('a stream that ends with an empty completed terminator still commits (defensive branch unchanged)', async () => {
    const empty = new FixtureProvider([], {
      streamScript: [{ kind: 'complete', fullText: '' }],
      providerId: 'openai',
    });
    const neverCalled = new FixtureProvider([], {
      streamScript: [{ kind: 'delta', delta: 'should not stream' }],
      providerId: 'anthropic',
    });
    const result = await route(baseInput({ providerCandidates: [empty, neverCalled] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providerId).toBe('openai');
    expect(neverCalled.streamCalls).toBe(0);
  });
});

describe('(g) D-54a — the router never invents a model', () => {
  it('a candidate without a resolved model is skipped as PROVIDER_MODEL_UNKNOWN; no request starts', async () => {
    const noModel = new FixtureProvider([], {
      streamScript: [{ kind: 'delta', delta: 'should not stream' }],
      providerId: 'openai',
    });
    const up = new FixtureProvider([], {
      streamScript: [{ kind: 'delta', delta: 'ok' }],
      providerId: 'anthropic',
    });
    const result = await route(
      baseInput({
        providerCandidates: [noModel, up],
        modelForProvider: (pid) => (pid === 'openai' ? undefined : 'resolved-model'),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providerId).toBe('anthropic');
    expect(noModel.streamCalls).toBe(0); // no provider request started for the unresolved candidate
  });

  it('an aborted route propagates STREAM_ABORTED semantics without fallback', async () => {
    const aborting = new FixtureProvider([], {
      streamScript: [{ kind: 'abort' }],
      providerId: 'openai',
    });
    const up = new FixtureProvider([], {
      streamScript: [{ kind: 'delta', delta: 'never' }],
      providerId: 'anthropic',
    });
    const controller = new AbortController();
    controller.abort();
    const result = await route(
      baseInput({ providerCandidates: [aborting, up], abortSignal: controller.signal }),
    );
    // Pre-aborted signal → no request starts; the route reports failure.
    expect(result.ok).toBe(false);
    expect(up.streamCalls).toBe(0);
  });
});

describe('first-token deadline — a silently-open provider cannot hang the router', () => {
  /** A provider that yields STREAM_START then stalls until the signal aborts. */
  function stallProvider(): ILLMProvider {
    return {
      providerId: 'openai',
      async *stream(request: LLMStreamRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
        yield { type: 'STREAM_START', operationId: request.operationId };
        await new Promise<void>((resolve) => {
          if (signal?.aborted) resolve();
          else signal?.addEventListener('abort', () => resolve(), { once: true });
        });
        // Production providers (streamBodyEvents) surface the abort as
        // STREAM_ABORTED — mirror that so the router classifies it correctly.
        yield { type: 'STREAM_ABORTED', operationId: request.operationId };
      },
      async requestJson(): Promise<string> {
        throw new Error('not used by router timeout test');
      },
    };
  }

  it('fails with TIMEOUT after the first-token deadline instead of hanging forever', async () => {
    const result = await route(
      baseInput({ providerCandidates: [stallProvider()], firstTokenTimeoutMs: 10 }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TIMEOUT');
  });

  it('a caller abort during the probe is a caller abort, not a TIMEOUT', async () => {
    const controller = new AbortController();
    const resultP = route(
      baseInput({ providerCandidates: [stallProvider()], abortSignal: controller.signal, firstTokenTimeoutMs: 10_000 }),
    );
    setTimeout(() => controller.abort(), 5);
    const result = await resultP;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Caller abort must NOT be mislabelled as a retryable TIMEOUT (WR-02).
    expect(result.error.code).toBe('NETWORK'); // router reports 'routing aborted by caller'
  });
});