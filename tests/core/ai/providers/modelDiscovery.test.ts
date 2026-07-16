import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelDiscovery, classifyModelTier, estimateContextWindow, estimateCapabilities } from '../../../../src/core/ai/providers/modelDiscovery';

describe('ModelDiscovery', () => {
  let discovery: ModelDiscovery;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    discovery = new ModelDiscovery();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('discovers models from OpenAI-compatible /v1/models endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        data: [
          { id: 'gpt-4o-mini' },
          { id: 'gpt-4o' },
          { id: 'gpt-4-turbo' },
        ],
      }), { status: 200 }),
    );

    const models = await discovery.discover(
      'https://api.openai.com/v1',
      'sk-test',
      'openai',
    );

    expect(models).toHaveLength(3);
    expect(models[0].modelId).toBe('gpt-4o-mini');
    expect(models[1].modelId).toBe('gpt-4o');
    expect(models[2].modelId).toBe('gpt-4-turbo');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
      }),
    );
  });

  it('falls back to Ollama /api/tags when /v1/models returns 404', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        models: [
          { name: 'llama3.2:3b' },
          { name: 'mistral:7b' },
        ],
      }), { status: 200 }),
    );

    const models = await discovery.discover(
      'http://localhost:11434',
      '',
      'ollama',
    );

    expect(models).toHaveLength(2);
    expect(models[0].modelId).toBe('llama3.2:3b');
    expect(models[1].modelId).toBe('mistral:7b');

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:11434/api/tags',
      expect.anything(),
    );
  });

  it('returns empty array when /v1/models fails with non-404 error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Server Error', { status: 500 }),
    );

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

  it('discovers models from Google /v1/models endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        models: [
          { name: 'models/gemini-2.5-flash' },
          { name: 'models/gemini-2.5-pro' },
          { name: 'models/gemini-1.5-flash' },
        ],
      }), { status: 200 }),
    );

    const models = await discovery.discover(
      'https://generativelanguage.googleapis.com/v1',
      'test-key',
      'google',
    );

    expect(models).toHaveLength(3);
    expect(models[0].modelId).toBe('gemini-2.5-flash');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('discovers models from Anthropic /v1/models endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        data: [
          { id: 'claude-3-5-sonnet-latest' },
          { id: 'claude-3-5-haiku-latest' },
        ],
      }), { status: 200 }),
    );

    const models = await discovery.discover(
      'https://api.anthropic.com/v1',
      'sk-ant-test',
      'anthropic',
    );

    expect(models).toHaveLength(2);
    expect(models[0].modelId).toBe('claude-3-5-sonnet-latest');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to Ollama when non-ollama provider gets 404', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const models = await discovery.discover(
      'https://custom-endpoint.com/v1',
      'test-key',
      'openai-compatible',
    );

    expect(models).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes endpoint URL by stripping trailing slash', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }), { status: 200 }),
    );

    await discovery.discover(
      'https://api.openai.com/v1/',
      'sk-test',
      'openai',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.anything(),
    );
  });

  it('returns empty array when Ollama /api/tags also fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const models = await discovery.discover(
      'http://localhost:11434',
      '',
      'ollama',
    );

    expect(models).toEqual([]);
  });
});

describe('classifyModelTier', () => {
  it('classifies opus-tier models', () => {
    expect(classifyModelTier('claude-3-opus')).toBe('opus');
    expect(classifyModelTier('o1-preview')).toBe('opus');
    expect(classifyModelTier('o3-mini')).toBe('opus');
  });

  it('classifies sonnet-tier models', () => {
    expect(classifyModelTier('claude-3-5-sonnet')).toBe('sonnet');
    expect(classifyModelTier('gpt-4o')).toBe('sonnet');
    expect(classifyModelTier('gemini-2.5-pro')).toBe('sonnet');
  });

  it('classifies haiku-tier models', () => {
    expect(classifyModelTier('gpt-4o-mini')).toBe('haiku');
    expect(classifyModelTier('claude-3-5-haiku')).toBe('haiku');
    expect(classifyModelTier('gemini-1.5-flash')).toBe('haiku');
  });

  it('defaults unknown models to flash', () => {
    expect(classifyModelTier('unknown-model')).toBe('flash');
    expect(classifyModelTier('custom-llm-v3')).toBe('flash');
  });
});

describe('estimateContextWindow', () => {
  it('returns proper sizes for known model families', () => {
    expect(estimateContextWindow('gemini-2.5-pro')).toBe(1048576);
    expect(estimateContextWindow('gpt-4o')).toBe(128000);
    expect(estimateContextWindow('claude-3-5-sonnet')).toBe(200000);
    expect(estimateContextWindow('llama3')).toBe(8192);
    expect(estimateContextWindow('qwen2.5')).toBe(32768);
    expect(estimateContextWindow('deepseek-v3')).toBe(128000);
  });

  it('defaults to 128000 for unknown models', () => {
    expect(estimateContextWindow('custom-model')).toBe(128000);
  });
});

describe('estimateCapabilities', () => {
  it('detects vision support', () => {
    expect(estimateCapabilities('gemini-2.5-flash').image).toBe(true);
    expect(estimateCapabilities('gpt-4o').image).toBe(true);
    expect(estimateCapabilities('claude-3-5-sonnet').image).toBe(true);
  });

  it('detects tool use support', () => {
    expect(estimateCapabilities('gpt-4o-mini').toolUse).toBe(true);
    expect(estimateCapabilities('gemini-2.5-pro').toolUse).toBe(true);
    expect(estimateCapabilities('claude-3-5-haiku').toolUse).toBe(true);
    expect(estimateCapabilities('llama3.2').toolUse).toBe(true);
    expect(estimateCapabilities('qwen2.5').toolUse).toBe(true);
    expect(estimateCapabilities('deepseek-v3').toolUse).toBe(true);
  });
});
