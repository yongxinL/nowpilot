import { streamText } from 'ai';
import { createOpenAIAdapter } from '../core/ai/providers/openai';
import { createAnthropicAdapter } from '../core/ai/providers/anthropic';
import { createGeminiAdapter } from '../core/ai/providers/gemini';
import { createOllamaAdapter } from '../core/ai/providers/ollama';
import type { ProviderAdapter } from '../core/ai/providers/ProviderAdapter';
import type { Message, ProviderConfig, Attachment, CustomProviderId, CustomProviderDetail, CustomModelItem, ModelCapabilities } from '../types';

export interface StreamChatParams {
  messages: Message[];
  prompt: string;
  attachments?: Attachment[];
  modelId: string;
  config: ProviderConfig;
  onChunk: (chunk: string, thoughtChunk?: string) => void;
  onDone: (fullText: string, fullThought?: string) => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

function inferCapabilities(modelId: string, providerId: CustomProviderId): ModelCapabilities {
  const id = modelId.toLowerCase();

  const isTextOnly = (
    id.includes('embed') ||
    id.includes('instruct') ||
    id.startsWith('text-') ||
    id.includes('tts') ||
    id.includes('whisper') ||
    id.includes('davinci') ||
    id.includes('babbage') ||
    id.includes('curie') ||
    id.includes('moderation') ||
    id.includes('classification')
  );

  const vision = !isTextOnly;

  const tools = !isTextOnly;

  const streaming = true;

  return { vision, tools, streaming };
}

export async function fetchProviderModels(
  providerId: CustomProviderId,
  apiKey?: string,
  proxyUrl?: string
): Promise<CustomModelItem[]> {
  try {
    const url = proxyUrl ? proxyUrl.replace(/\/+$/, '') : (
      providerId === 'openai' ? 'https://api.openai.com/v1' :
      providerId === 'claude' ? 'https://api.anthropic.com' :
      providerId === 'gemini' ? 'https://generativelanguage.googleapis.com' :
      'http://localhost:11434'
    );

    let fetchedNames: string[] = [];

    if (providerId === 'gemini') {
      const resp = await fetch(`${url}/v1beta/models?key=${apiKey || ''}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.models && Array.isArray(data.models)) {
          fetchedNames = data.models
            .map((m: any) => m.name?.replace('models/', ''))
            .filter((n: string) => n);
        }
      }
    } else if (providerId === 'ollama') {
      const resp = await fetch(`${url}/api/tags`).catch(() => fetch(`${url}/v1/models`));
      if (resp?.ok) {
        const data = await resp.json();
        const list = data.models || data.data || [];
        fetchedNames = list.map((m: any) => m.name || m.id);
      }
    } else {
      const headers: Record<string, string> = {};
      if (apiKey) {
        if (providerId === 'claude') {
          headers['x-api-key'] = apiKey;
          headers['anthropic-version'] = '2023-06-01';
        } else {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
      }
      const resp = await fetch(`${url}/models`, { headers });
      if (resp.ok) {
        const data = await resp.json();
        const list = data.data || data.models || [];
        fetchedNames = list.map((m: any) => m.id || m.name);
      }
    }

    if (fetchedNames.length > 0) {
      return fetchedNames.map((name) => ({
        id: name,
        name: name,
        enabled: true,
        capabilities: inferCapabilities(name, providerId),
      }));
    }
  } catch (err) {
    console.warn('Failed to fetch provider models dynamically:', err);
  }

  const fallbacks: Record<CustomProviderId, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'o3-mini'],
    claude: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
    ollama: ['llama3.2', 'deepseek-r1:8b', 'qwen2.5-coder:7b'],
  };

  return (fallbacks[providerId] || ['default-model']).map((m, idx) => ({
    id: m,
    name: m,
    enabled: true,
    capabilities: inferCapabilities(m, providerId),
  }));
}

function findProviderForModel(modelId: string, config: ProviderConfig): { providerId: CustomProviderId; detail: CustomProviderDetail } | null {
  const keys: CustomProviderId[] = ['openai', 'claude', 'gemini', 'ollama'];
  for (const pid of keys) {
    const detail = config.providers?.[pid];
    if (detail?.enabled && detail.models?.some(m => m.id === modelId || m.name === modelId)) {
      return { providerId: pid, detail };
    }
  }
  const pid = config.activeProvider as CustomProviderId;
  const detail = config.providers?.[pid];
  if (detail) return { providerId: pid, detail };
  return null;
}

function createAdapter(providerId: CustomProviderId, detail: CustomProviderDetail): ProviderAdapter {
  const proxyUrl = detail.useCustomProxy && detail.proxyUrl ? detail.proxyUrl : undefined;
  switch (providerId) {
    case 'openai':
      return createOpenAIAdapter(detail.apiKey, proxyUrl);
    case 'claude':
      return createAnthropicAdapter(detail.apiKey);
    case 'gemini':
      return createGeminiAdapter(detail.apiKey);
    case 'ollama':
      return createOllamaAdapter(proxyUrl);
  }
}

export async function streamChatResponse({
  messages,
  prompt: _prompt,
  attachments: _attachments,
  modelId,
  config,
  onChunk,
  onDone,
  onError,
  signal,
}: StreamChatParams) {
  try {
    const providerInfo = findProviderForModel(modelId, config);
    if (!providerInfo || !providerInfo.detail.apiKey) {
      onError(new Error('No provider configured for this model. Go to Options > AI Access to set up your API key.'));
      return;
    }

    const adapter = createAdapter(providerInfo.providerId, providerInfo.detail);
    const model = adapter.createLanguageModel(modelId);

    const history = messages
      .filter(m => !(m.role === 'assistant' && m.content === '' && m.isThinking))
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    let fullText = '';
    let fullThought = '';

    const result = streamText({
      model,
      messages: [...history],
      abortSignal: signal,
      timeout: 120000,
    });

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        fullText += chunk.text;
        onChunk(chunk.text, '');
      } else if (chunk.type === 'reasoning-delta') {
        fullThought += chunk.text;
        onChunk('', chunk.text);
      } else if (chunk.type === 'error') {
        const thrown: unknown = chunk.error;
        const errMessage = typeof thrown === 'string' ? thrown : thrown instanceof Error ? thrown.message : 'Unknown stream error';
        onError(new Error(errMessage));
        return;
      }
    }

    onDone(fullText, fullThought);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    console.error('AI Stream Error:', err);
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

