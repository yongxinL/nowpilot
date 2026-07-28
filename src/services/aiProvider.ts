import { Message, ProviderConfig, Attachment } from '../types';

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

function buildEndpointUrl(config: ProviderConfig): string {
  if (config.activeProvider === 'gemini') {
    const key = config.geminiKey || config.providers?.gemini?.apiKey || '';
    const base = config.providers?.gemini?.proxyUrl?.replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com';
    return `${base}/v1beta/models/${config.selectedModel}:streamGenerateContent?alt=sse&key=${key}`;
  }
  const baseUrl = config.openAiBaseUrl?.replace(/\/+$/, '') || 'http://localhost:12380/v1';
  return `${baseUrl}/chat/completions`;
}

export async function streamChatResponse({
  messages,
  prompt,
  attachments,
  modelId,
  config,
  onChunk,
  onDone,
  onError,
  signal,
}: StreamChatParams) {
  try {
    const endpoint = buildEndpointUrl(config);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.openAiKey ? { 'Authorization': `Bearer ${config.openAiKey}` } : {}),
      },
      body: JSON.stringify({
        messages: [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: prompt },
        ],
        model: modelId,
        stream: true,
        attachments: attachments?.map(a => ({ type: a.type, title: a.title, content: a.content })),
      }),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.error || `HTTP error ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let accumulatedThought = '';

    if (!reader) {
      throw new Error('Response stream body unavailable');
    }

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            onDone(accumulatedText, accumulatedThought);
            return;
          }

          try {
            const data = JSON.parse(dataStr);
            if (data.thoughtChunk) {
              accumulatedThought += data.thoughtChunk;
              onChunk('', data.thoughtChunk);
            }
            if (data.textChunk) {
              accumulatedText += data.textChunk;
              onChunk(data.textChunk, '');
            }
          } catch {
            // Ignore parse errors on SSE boundary
          }
        }
      }
    }

    onDone(accumulatedText, accumulatedThought);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    console.error('AI Stream Error:', err);
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export const AVAILABLE_MODELS = [
  { id: 'test', name: 'test', provider: 'openai', group: 'OpenAI', description: 'Test model' },
  { id: 'MiniCPM5-1B-OptiQ-4bit', name: 'MiniCPM5-1B-OptiQ-4bit', provider: 'openai', group: 'OpenAI', description: 'Quantized lightweight model' },
  { id: 'gemma-4-e2b-it-4bit', name: 'gemma-4-e2b-it-4bit', provider: 'openai', group: 'OpenAI', description: 'Multimodal model' },
  { id: 'Qwen3.5-9B-OptiQ-4bit', name: 'Qwen3.5-9B-OptiQ-4bit', provider: 'openai', group: 'OpenAI', description: 'Quantized reasoning model' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', group: 'Google Gemini', description: 'Fast multimodal Google AI model' },
];
