import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { testProviderConnection } from '../../../src/services/aiProvider';

/**
 * T-01-10 + D-12: connection test surfaces real failures; never swallows
 * the error in a silent fallback model list.
 *
 * Strategy: mock `globalThis.fetch` directly. `testProviderConnection`
 * delegates the fetch internally and never calls `fetchProviderModels`,
 * so the old "fallback defaults" path is unreachable from this entry point.
 */
describe('testProviderConnection (D-12 / T-01-10 — real, error-surfacing connection test)', () => {
  // `any` here is intentional: the test mocks the full `fetch` function and
  // asserts on the resolved value. The signature varies by overload
  // (RequestInfo | URL, with/without init) and vitest's MockInstance type
  // narrows it too aggressively for our purposes.
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('resolves { ok: true, models } when fetch returns a 200 with model list', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] }),
    } as unknown as Response);

    const result = await testProviderConnection('openai', 'good-key', 'https://api.example.com/v1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.models.map((m) => m.id)).toEqual(['gpt-4o', 'gpt-4o-mini']);
    }
  });

  it('resolves { ok: false, error } (containing "401") when fetch returns 401', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Incorrect API key provided' } }),
    } as unknown as Response);

    const result = await testProviderConnection('openai', 'bad-key', 'https://api.example.com/v1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('401');
      expect(result.error).toContain('Incorrect API key provided');
      // T-01-10: the raw apiKey MUST NOT be echoed back in the error string.
      expect(result.error).not.toContain('bad-key');
    }
  });

  it('resolves { ok: false, error } (containing "500") when fetch returns 500', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    } as unknown as Response);

    const result = await testProviderConnection('claude', undefined, 'https://api.example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('500');
      expect(result.error).not.toContain('http://localhost:12380');
    }
  });

  it('resolves { ok: false, error } when fetch rejects (network throw)', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await testProviderConnection('openai', 'some-key', 'https://api.example.com/v1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Network error');
      expect(result.error).not.toContain('some-key');
    }
  });

  it('T-01-10 — does NOT echo the raw apiKey into any error string across the negative paths', async () => {
    const secretKey = 'sk-secret-DO-NOT-LEAK-XYZ123';

    // 401 with the secret key
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'unauthorized' } }),
    } as unknown as Response);
    const r401 = await testProviderConnection('openai', secretKey, 'https://api.example.com/v1');
    if (!r401.ok) expect(r401.error).not.toContain(secretKey);

    // 500 with the secret key
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);
    const r500 = await testProviderConnection('openai', secretKey, 'https://api.example.com/v1');
    if (!r500.ok) expect(r500.error).not.toContain(secretKey);

    // Network throw with the secret key
    fetchSpy.mockRejectedValueOnce(new TypeError('Network down'));
    const rNet = await testProviderConnection('openai', secretKey, 'https://api.example.com/v1');
    if (!rNet.ok) expect(rNet.error).not.toContain(secretKey);
  });

  it('resolves { ok: false, error } for gemini provider on 403 with empty error body', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => {
        throw new Error('not JSON');
      },
    } as unknown as Response);

    const result = await testProviderConnection('gemini', undefined, 'https://generativelanguage.googleapis.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('403');
    }
  });

  it('resolves { ok: true, models } for gemini provider on 200 with `models` array', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        models: [{ name: 'models/gemini-1.5-pro' }, { name: 'models/gemini-1.5-flash' }],
      }),
    } as unknown as Response);

    const result = await testProviderConnection('gemini', 'gk', 'https://generativelanguage.googleapis.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The leading "models/" prefix is stripped — that's what fetchProviderModels
      // historically produced too; the test confirms testProviderConnection
      // preserves the same shape so consumers don't need to special-case it.
      expect(result.models.map((m) => m.id).sort()).toEqual(['gemini-1.5-flash', 'gemini-1.5-pro']);
    }
  });

  it('resolves { ok: false, error } when endpoint returns 200 with empty model list', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as unknown as Response);

    const result = await testProviderConnection('openai', undefined, 'https://api.example.com/v1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/no models/i);
    }
  });
});
