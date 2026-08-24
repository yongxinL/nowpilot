import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { request } from '../../../src/core/http/Requester';
import { RateLimiter } from '../../../src/core/utils/RateLimiter';

/**
 * Build a fetch stub that respects the AbortSignal passed in
 * `init.signal`. Returns a Promise that rejects with a DOMException
 * carrying `name === 'AbortError'` once the signal aborts — mirroring
 * the real fetch behavior used by browsers (and the WPT contract that
 * fetch's pending promise rejects when its signal aborts).
 */
function fetchThatHonorsAbort(fetchImpl: typeof fetch = vi.fn()): typeof fetch {
  return ((url: any, init: any = {}) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal: AbortSignal | undefined = init?.signal;
      if (signal) {
        if (signal.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        );
      }
      // Forward to the underlying stub for non-abort-driven behavior.
      Promise.resolve(fetchImpl(url, init)).then(
        (r) => {
          // If abort already fired before resolution, still reject.
          if (signal?.aborted) {
            reject(new DOMException('aborted', 'AbortError'));
            return;
          }
          _resolve(r as Response);
        },
        (e) => reject(e),
      );
    });
  }) as typeof fetch;
}

describe('Requester — UI-context fetch wrapper (D-35/D-37/D-38, spec §10.7)', () => {
  let fetchStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchThatHonorsAbort(fetchStub));
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('resolves the underlying fetch response on success (no limiter → no throttling)', async () => {
    const response = new Response('ok', { status: 200 });
    fetchStub.mockResolvedValueOnce(response);

    const result = await request('https://example.com/v1/test', { method: 'GET' });

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(fetchStub).toHaveBeenCalledWith(
      'https://example.com/v1/test',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toBe(response);
  });

  it('rejects with RATE_LIMITED when an injected limiter returns false — fetch is never invoked', async () => {
    const limiter = new RateLimiter({ capacity: 0, refillPerSecond: 1 });
    let caught: any;
    try {
      await request('https://example.com/v1/test', { method: 'GET' }, { rateLimiter: limiter });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.code).toBe('RATE_LIMITED');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('consumes a token from an injected limiter on success (D-37 — limiter is wired, not bypassed)', async () => {
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 0 });
    fetchStub.mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await request('https://example.com/v1/test', { method: 'GET' }, { rateLimiter: limiter });

    expect(fetchStub).toHaveBeenCalledTimes(1);
    // Subsequent acquire on the same bucket must fail — confirms the token was consumed.
    expect(limiter.acquire()).toBe(false);
  });

  it('rejects with TIMEOUT when fetch never resolves within the default 25s window (internal abort path)', async () => {
    vi.useFakeTimers();
    // A promise that never resolves — simulates a hung fetch.
    fetchStub.mockImplementationOnce(() => new Promise<Response>(() => {}));

    // Use try/catch with awaits — vitest's expect.rejects ordering with
    // vi.advanceTimersByTimeAsync is fragile in some envs.
    let caught: any;
    const promise = request('https://example.com/v1/test', { method: 'GET' }).catch((e: unknown) => {
      caught = e;
    });

    // Advance past the 25s default — the internal setTimeout fires, aborts the
    // controller, fetchThatHonorsAbort sees the abort and rejects the fetch
    // promise with AbortError, Requester maps that to TIMEOUT.
    await vi.advanceTimersByTimeAsync(25_001);
    await promise;

    expect(caught).toBeDefined();
    expect(caught.code).toBe('TIMEOUT');
  });

  it('honors a custom timeoutMs (1000ms) — abort fires at the configured boundary, not the default 25s', async () => {
    vi.useFakeTimers();
    fetchStub.mockImplementationOnce(() => new Promise<Response>(() => {}));

    let caught: any;
    const promise = request(
      'https://example.com/v1/test',
      { method: 'GET' },
      { timeoutMs: 1000 },
    ).catch((e: unknown) => {
      caught = e;
    });

    // Advance JUST past the 1s custom boundary. The internal setTimeout
    // fires, the controller aborts, fetchThatHonorsAbort rejects the
    // fetch promise with AbortError, Requester maps to TIMEOUT.
    await vi.advanceTimersByTimeAsync(1001);
    await promise;

    expect(caught).toBeDefined();
    expect(caught.code).toBe('TIMEOUT');
    // The internal setTimeout is the 1s one — proves the override took
    // effect (the default 25s window would not have fired by 1001ms).
  });

  it('rejects with NETWORK when fetch rejects with a non-AbortError (DNS, offline, CORS, etc.)', async () => {
    fetchStub.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    let caught: any;
    try {
      await request('https://example.com/v1/test', { method: 'GET' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.code).toBe('NETWORK');
    // The underlying error message must be preserved on the RequesterError.
    expect(caught.message).toContain('Failed to fetch');
  });

  it('classifies a caller-provided AbortSignal abort as TIMEOUT (D-35 — both abort paths share one code)', async () => {
    vi.useFakeTimers();
    fetchStub.mockImplementationOnce(() => new Promise<Response>(() => {}));

    const callerController = new AbortController();
    let caught: any;
    const promise = request(
      'https://example.com/v1/test',
      { method: 'GET', signal: callerController.signal },
    ).catch((e: unknown) => {
      caught = e;
    });

    // Caller aborts BEFORE the internal 25s timeout fires.
    callerController.abort();
    await vi.advanceTimersByTimeAsync(0);
    await promise;

    expect(caught).toBeDefined();
    expect(caught.code).toBe('TIMEOUT');
  });
});
