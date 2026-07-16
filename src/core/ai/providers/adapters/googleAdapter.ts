import { createGoogleGenerativeAI } from '@ai-sdk/google';

export function createGoogleAdapter(apiKey: string, baseURL?: string) {
  return createGoogleGenerativeAI({
    apiKey,
    ...(baseURL ? { baseURL } : {})
  });
}
