import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelDiscovery } from '../../../../src/core/ai/providers/modelDiscovery';

describe('ModelDiscovery', () => {
  let discovery: ModelDiscovery;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    discovery = new ModelDiscovery();

    // Mock global fetch
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('discovers models from OpenAI-compatible /v1/models endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'gpt-4o-mini' },
          { id: 'gpt-4o' },
          { id: 'gpt-4-turbo' },
        ],
      }),
    });

    const models = await discovery.discover(
      'https://api.openai.com/v1',
      'sk-test',
      'openai',
    );

    expect(models).toHaveLength(3);
    expect(models[0].modelId).toBe('gpt-4o-mini');
    expect(models[1].modelId).toBe('gpt-4o');
    expect(models[2].modelId).toBe('gpt-4-turbo');

    // Verify correct endpoint was called
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('falls back to Ollama /api/tags when /v1/models returns 404', async () => {
    // First call: /v1/models returns 404
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    // Second call: /api/tags succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'llama3.2:3b' },
          { name: 'mistral:7b' },
        ],
      }),
    });

    const models = await discovery.discover(
      'http://localhost:11434',
      '',
      'ollama',
    );

    expect(models).toHaveLength(2);
    expect(models[0].modelId).toBe('llama3.2:3b');
    expect(models[1].modelId).toBe('mistral:7b');

    // Verify fallback URL
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:11434/api/tags',
      expect.anything(),
    );
  });

  it('returns empty array when /v1/models fails with non-404 error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const models = await discovery.discover(
      'https://api.openai.com/v1',
      'sk-test',
      'openai',
    );

    expect(models).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const models = await discovery.discover(
      'https://api.openai.com/v1',
      'sk-test',
      'openai',
    );

    expect(models).toEqual([]);
  });

  it('returns empty array for Google provider (no discovery)', async () => {
    const models = await discovery.discover(
      'https://generativelanguage.googleapis.com',
      'test-key',
      'google',
    );

    expect(models).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fall back to Ollama when non-ollama provider gets 404', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const models = await discovery.discover(
      'https://custom-endpoint.com/v1',
      'test-key',
      'openai-compatible',
    );

    // Non-ollama provider: should NOT fall back
    expect(models).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes endpoint URL by stripping trailing slash', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'gpt-4o-mini' }] }),
    });

    await discovery.discover(
      'https://api.openai.com/v1/',
      'sk-test',
      'openai',
    );

    // Should have stripped the trailing slash
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.anything(),
    );
  });

  it('uses AbortSignal timeout for discovery requests', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'gpt-4o-mini' }] }),
    });

    await discovery.discover(
      'https://api.openai.com/v1',
      'sk-test',
      'openai',
    );

    const callArgs = fetchMock.mock.calls[0];
    const options = callArgs[1] as RequestInit;
    expect(options.signal).toBeDefined();
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns empty array when Ollama /api/tags also fails', async () => {
    // /v1/models returns 404
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    // /api/tags also fails
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const models = await discovery.discover(
      'http://localhost:11434',
      '',
      'ollama',
    );

    expect(models).toEqual([]);
  });
});
