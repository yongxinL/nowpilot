import type { CacheHint } from './cacheTypes';

/**
 * Anthropic: per-message cacheControl on marked messages.
 * Returns messages with `providerOptions.anthropic.cacheControl` set to `{ type: 'ephemeral' }`.
 */
export function applyAnthropicCache(
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }>,
  hintMap: Map<number, CacheHint>,
): Array<{ role: string; content: unknown; providerOptions?: unknown }> {
  return messages.map((msg, idx) => {
    if (!hintMap.has(idx)) return msg;
    return {
      ...msg,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' as const } },
      },
    };
  });
}

/**
 * OpenAI: request-level providerOptions with promptCacheKey and per-message breakpoint markers.
 * Returns `{ messages, providerOptions }` where providerOptions contains the cache key
 * and marked messages get a `promptCacheBreakpoint` marker.
 */
export function applyOpenAICache(
  messages: Array<{ role: string; content: string }>,
  hintMap: Map<number, CacheHint>,
  cacheKey: string,
): { messages: Array<{ role: string; content: string }>; providerOptions: Record<string, unknown> } {
  const providerOptions: Record<string, unknown> = {};
  const hasCachedSections = hintMap.size > 0;

  if (hasCachedSections) {
    providerOptions.openai = {
      promptCacheKey: cacheKey,
      promptCacheOptions: { mode: 'auto', ttl: 3600 },
    };
  }

  const messagesWithBreakpoints = messages.map((msg, idx) => {
    if (hintMap.has(idx)) {
      return { ...msg, providerOptions: { openai: { promptCacheBreakpoint: true } } };
    }
    return msg;
  });

  return { messages: messagesWithBreakpoints, providerOptions };
}

/**
 * Gemini: wraps cached message content in `providerOptions.google.cachedContent`.
 */
export function applyGoogleCache(
  messages: Array<{ role: string; content: string }>,
  hintMap: Map<number, CacheHint>,
): Array<{ role: string; content: unknown; providerOptions?: unknown }> {
  return messages.map((msg, idx) => {
    if (!hintMap.has(idx)) return msg;
    return {
      ...msg,
      providerOptions: {
        google: { cachedContent: msg.content },
      },
    };
  });
}

/**
 * Dispatcher: routes to the correct cache adapter based on provider type.
 *
 * - `anthropic` → applyAnthropicCache (per-message cacheControl)
 * - `openai` → applyOpenAICache (promptCacheKey + breakpoint markers)
 * - `google` → applyGoogleCache (cachedContent)
 * - `ollama` / unknown → no-op (returns messages unchanged)
 */
export function applyCacheHints(
  providerType: string,
  messages: Array<{ role: string; content: string }>,
  hintMap: Map<number, CacheHint>,
  cacheKey: string,
): { messages: Array<{ role: string; content: unknown }>; providerOptions?: Record<string, unknown> } {
  switch (providerType) {
    case 'anthropic':
      return { messages: applyAnthropicCache(messages, hintMap) };
    case 'openai':
      return applyOpenAICache(messages, hintMap, cacheKey);
    case 'google':
      return { messages: applyGoogleCache(messages, hintMap) };
    case 'ollama':
    default:
      // No cache support — return messages unchanged
      return { messages };
  }
}
