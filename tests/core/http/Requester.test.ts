// tests/core/http/Requester.test.ts — §10.7 PROXY_FETCH wrapper contract
// (RESEARCH validation map: "Requester wraps PROXY_FETCH with 25s timeout
// (fakeBrowser sendMessage)"). Uses the fakeBrowser runtime.sendMessage mock
// (BroadcastBus/MessageBus precedent — the wxt test env stubs `browser` to
// fakeBrowser, so Requester's sendMessage resolves to the mock). Cases:
// (1) success passthrough; (2) timeout with a short injected timeout → failure
// shape + debugLog (never hangs, T-2-10-02); (3) sendMessage rejection → failure
// shape, no throw, debugLog with canonical code (Golden Rule 9); (4) invalid
// method refused BEFORE sendMessage (T-2-10-01). Pure runtime logic — node env
// (01-01 Rule 3 precedent, same as MessageBus.test.ts).
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { DEFAULT_RETRIES, DEFAULT_TIMEOUT_MS, request } from '@/core/http/Requester';
import type { ProxyFetchRequest, ProxyFetchResponse } from '@/types/messages';

function makePayload(overrides: Partial<ProxyFetchRequest> = {}): ProxyFetchRequest {
  return {
    type: 'PROXY_FETCH',
    addonId: 'addon-snow',
    url: 'https://instance.service-now.com/api/now/table/incident',
    method: 'GET',
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Requester — PROXY_FETCH wrapper', () => {
  it('passes a successful ProxyFetchResponse through unchanged', async () => {
    const sendSpy = vi
      .spyOn(fakeBrowser.runtime, 'sendMessage')
      .mockResolvedValue({
        ok: true,
        status: 200,
        body: '{"result":"ok"}',
      } satisfies ProxyFetchResponse);

    const response = await request(makePayload());

    expect(response).toEqual({ ok: true, status: 200, body: '{"result":"ok"}' });
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PROXY_FETCH', addonId: 'addon-snow', method: 'GET' }),
    );
  });

  it('resolves a failure response after the timeout instead of hanging (debugLog called)', async () => {
    vi.useFakeTimers();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // sendMessage never settles → only the injected 50ms timeout can resolve.
    vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockReturnValue(new Promise(() => {}));

    const promise = request(makePayload(), { timeoutMs: 50 });
    vi.advanceTimersByTime(100);

    await expect(promise).resolves.toEqual({
      ok: false,
      status: 0,
      body: '',
      error: 'PROXY_FETCH_TIMEOUT',
    });
    expect(consoleSpy).toHaveBeenCalled(); // debugLog routed (Golden Rule 9)
  });

  it('resolves a failure-shaped response on sendMessage rejection — never throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sendSpy = vi
      .spyOn(fakeBrowser.runtime, 'sendMessage')
      .mockRejectedValue(new Error('port disconnected'));

    const response = await request(makePayload());

    expect(response).toEqual({ ok: false, status: 0, body: '', error: 'port disconnected' });
    expect(sendSpy).toHaveBeenCalledTimes(1); // no retry without retrySafe
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('refuses an invalid method before sendMessage is ever called (T-2-10-01)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sendSpy = vi.spyOn(fakeBrowser.runtime, 'sendMessage');

    const response = await request(makePayload({ method: 'TRACE' as ProxyFetchRequest['method'] }));

    expect(response.ok).toBe(false);
    expect(response.status).toBe(0);
    expect(response.error).toContain('TRACE');
    expect(sendSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled(); // debugLog routed (Golden Rule 9)
  });

  it('retries exactly once when retrySafe is set, then returns the failure (T-2-10-02)', async () => {
    const sendSpy = vi
      .spyOn(fakeBrowser.runtime, 'sendMessage')
      .mockResolvedValueOnce({
        ok: false,
        status: 0,
        body: '',
        error: 'flaky',
      } satisfies ProxyFetchResponse)
      .mockResolvedValueOnce({
        ok: false,
        status: 0,
        body: '',
        error: 'still down',
      } satisfies ProxyFetchResponse);

    const response = await request(makePayload({ retrySafe: true }));

    expect(response).toEqual({ ok: false, status: 0, body: '', error: 'still down' });
    expect(sendSpy).toHaveBeenCalledTimes(1 + DEFAULT_RETRIES); // exactly one bounded retry
  });

  it('never retries without retrySafe even when the payload is retryable (Appendix C)', async () => {
    const sendSpy = vi
      .spyOn(fakeBrowser.runtime, 'sendMessage')
      .mockResolvedValueOnce({
        ok: false,
        status: 0,
        body: '',
        error: 'flaky',
      } satisfies ProxyFetchResponse);

    const response = await request(makePayload()); // no retrySafe

    expect(response).toEqual({ ok: false, status: 0, body: '', error: 'flaky' });
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('pins the 25s timeout default (DEFAULT_TIMEOUT_MS constant, not magic numbers)', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(25_000);
  });
});
