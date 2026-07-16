import { createOpenAI } from '@ai-sdk/openai';

export function createOpenAIAdapter(apiKey: string, baseURL?: string) {
  return createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {})
  });
}
