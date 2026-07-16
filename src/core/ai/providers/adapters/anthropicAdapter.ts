import { createAnthropic } from '@ai-sdk/anthropic';

export function createAnthropicAdapter(apiKey: string, baseURL?: string) {
  return createAnthropic({
    apiKey,
    ...(baseURL ? { baseURL } : {})
  });
}
