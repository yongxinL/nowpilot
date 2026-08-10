// src/core/ai/StreamAdapter.ts — Seam 3 (AI-03): the ONLY consumer of streamText
// besides getAISDKModel/ProviderRouter. Normalizes streamText deltas into
// LLMStreamChunk {type:'text'}… then a terminal {type:'done'} | {type:'error'}.
//
// F-5/P-4: the constructed call uses the `messages[]` form — the cached [SYSTEM]
// travels as a CoreSystemMessage carrying providerOptions (e.g.
// providerOptions.anthropic.cacheControl) passed THROUGH unchanged from the
// caller (Router / createStageInvocation, 03-05). NEVER `system: string`
// (ai@4 silently drops the cache breakpoint on the string form — RESEARCH
// Pattern 3) and NEVER computes cache strategy (applyCacheHints owns strategy,
// 03-03; the Router owns application, 03-05). P-3: PromptSection is imported
// from '@/core/ai/types' (D-07 canonical home) — never a local re-declaration.
//
// Pitfall 1: maxRetries: 0 — the Router owns retries (D-17); the SDK's hidden
// default of 2 would stack a 4th retry layer and multiply cost (R-2).
// Pitfall 5: finishReason is ALWAYS awaited after the delta loop — mid-stream
// errors surface as a rejected terminal promise, so a failed stream is emitted
// as an explicit {type:'error'} chunk, NEVER a silently-truncated 'done'.
import { streamText } from 'ai';
import type { LanguageModel, ProviderMetadata } from 'ai';

import type { LLMStreamChunk, PromptSection } from '@/core/ai/types';

export interface StreamTextToLLMChunksArgs {
  model: LanguageModel;
  /**
   * §1.3 [SYSTEM: cached] — the byte-stable persona/prompt block. Typed via the
   * PromptSection contract (P-3): its text becomes the CoreSystemMessage content.
   */
  systemText: PromptSection['text'];
  /** Task text — the [CONTEXT]+[TASK]+[USER INPUT] sections joined by the Router (F-4 joinSections, 03-05). */
  taskText: string;
  /** Explicit output cap (§1.2 — 512 for the renderer; never unbounded). */
  maxTokens: number;
  /** Caller-supplied abort (surface close / user cancel) — cancels generation so no orphaned request bills. */
  abortSignal: AbortSignal;
  /**
   * F-5 pass-through: providerOptions (e.g. { anthropic: { cacheControl: { type: 'ephemeral' } } })
   * applied to the CoreSystemMessage unchanged. Supplied by the Router from applyCacheHints (03-03)
   * output — StreamAdapter never computes or invents this.
   */
  providerOptions?: ProviderMetadata;
}

/**
 * Seam 3: run streamText and normalize its deltas to LLMStreamChunk. done XOR
 * error — a terminal chunk is always emitted (never a silent mid-stream stop).
 */
export async function* streamTextToLLMChunks(
  args: StreamTextToLLMChunksArgs,
): AsyncIterable<LLMStreamChunk> {
  // F-5: messages[] form — the cached [SYSTEM] is a CoreSystemMessage carrying the
  // pass-through providerOptions; the task text is the user message. `system:` string
  // form is NEVER used (it cannot carry the anthropic cache breakpoint).
  const result = streamText({
    model: args.model,
    messages: [
      { role: 'system', content: args.systemText, providerOptions: args.providerOptions },
      { role: 'user', content: args.taskText },
    ],
    maxTokens: args.maxTokens,
    maxRetries: 0, // Pitfall 1 — the Router owns retries (D-17)
    abortSignal: args.abortSignal,
  });
  try {
    for await (const delta of result.textStream) {
      yield { type: 'text', content: delta };
    }
    // Pitfall 5: ALWAYS await the terminal member — never render un-await-verified text.
    await result.finishReason;
    yield { type: 'done', content: '' };
  } catch (e) {
    yield { type: 'error', content: e instanceof Error ? e.message : String(e) };
    // Caller's catch: debugLog(ERROR_CODES.STREAM_FAILED, …, Golden Rule 9) — the
    // UI maps this to the failed-bubble state (partial text retained + Retry).
  }
}
