import { createOpenAI } from '@ai-sdk/openai';

export function createOpenAIAdapter(apiKey: string) {
  return createOpenAI({ apiKey });
}
