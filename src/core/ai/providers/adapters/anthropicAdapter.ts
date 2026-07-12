import { createAnthropic } from '@ai-sdk/anthropic';

export function createAnthropicAdapter(apiKey: string) {
  return createAnthropic({ apiKey });
}
