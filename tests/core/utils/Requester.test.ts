import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { request } from '../../../src/core/http/Requester';
import { RateLimiter } from '../../../src/core/utils/RateLimiter';

describe('Requester — UI-context fetch wrapper (D-35/D-37/D-38, spec §10.7)', () => {
  let fetchStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);
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
});
