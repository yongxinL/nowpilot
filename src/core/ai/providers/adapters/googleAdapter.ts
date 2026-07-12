import { createGoogle } from '@ai-sdk/google';

export function createGoogleAdapter(apiKey: string) {
  return createGoogle({ apiKey });
}
