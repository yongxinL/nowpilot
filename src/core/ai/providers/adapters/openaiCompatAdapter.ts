import { createOpenAI } from '@ai-sdk/openai';

export function createOpenAICompatAdapter(apiKey: string, baseURL: string) {
  return createOpenAI({ apiKey, baseURL });
}
