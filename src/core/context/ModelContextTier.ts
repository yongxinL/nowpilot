import type { ModelContextTier } from '../ai/types';

export type { ModelContextTier } from '../ai/types';

/**
 * Classify a model's context window into a tier per spec §2.1:
 * tiny ≤4K, small ≤16K, medium ≤128K, large >128K.
 */
export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096) return 'tiny';
  if (contextWindow <= 16384) return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}

/**
 * Known model → context window mappings. Unknown models fall back to
 * the default window (128000) at the call site.
 */
export const KNOWN_MODEL_WINDOWS: Record<string, number> = {
  'gpt-4o-mini': 128000,
  'gpt-4o': 128000,
  'claude-haiku-4-latest': 200000,
  'claude-sonnet-4-latest': 200000,
  'gemini-2.0-flash': 1048576,
  'gemini-2.5-pro': 2097152,
  // Ollama / small local models
  'llama3.2': 128000,
  'llama3.1': 128000,
  mistral: 32768,
};
