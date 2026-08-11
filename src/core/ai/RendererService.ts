// src/core/ai/RendererService.ts — Source: PRODUCT_SPEC §1.2 RendererService
// (lines 303-315) + Appendix I finish() call site + AI-SPEC Seam 3 (lines
// 470-508) + 03-06 P-4/F-5. Seam 3: streamText is consumed ONLY inside
// RendererService / StreamAdapter (AI-SPEC rule). This renderer builds its
// streamText call from the Router-supplied F-5 shape — buildStageMessages
// (03-05) yields the messages[] form whose CoreSystemMessage carries the
// providerOptions.anthropic.cacheControl payload for the invocation's provider;
// the renderer NEVER writes the `system` string form (ai@4 silently drops the
// cache breakpoint on it) and NEVER computes cache strategy (03-03 owns
// strategy, 03-05 owns application, Golden Rule 3 — no prompt assembly here).
//
// Streaming honesty (Pitfall 5, T-03-06-01): finishReason is ALWAYS awaited
// after the delta loop — a mid-stream rejection OR a finishReason !== 'stop'
// (length/content-filter/...) produces a typed STREAM_FAILED throw whose
// partialText is EXACTLY the pre-failure deltas; a failed stream is never
// silently returned as a 'complete' text (done XOR error). The caller's
// abortSignal is threaded unchanged into the constructed call so cancel stops
// generation — no orphaned request bills tokens (T-03-06-04).
//
// Breaker/stream-freeze wiring (WR-02, 03-12): provider-originated failures —
// the mid-stream catch and the non-'stop' finish branch — vote the provider's
// breaker through the Router singleton (T-03-12-01); the isAbortError guard
// keeps a user abort from ever voting. The first streamed delta freezes the
// operation (exactly once per render) so the D-14/§1.5 stream_frozen guard in
// createStageInvocation is reachable (T-03-12-02).
import { streamText } from 'ai';

import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { buildStageMessages, getProviderRouter } from '@/core/ai/ProviderRouter';
import type { StageInvocation } from '@/core/ai/ProviderRouter';
import type { OptimizedContext, ToolExecutionResult } from '@/core/ai/types';

/** §1.2 — renderer output cap (512 for normal answers; never unbounded). */
export const RENDERER_MAX_TOKENS = 512;

export interface RenderInput {
  operationId: string;
  /** §2.3 shape — its sections feed the Router's F-5 messages[] builder (never joined here, Golden Rule 3). */
  context: OptimizedContext;
  /** Appendix-I verbatim call shape; the user_input PromptSection inside context.sections is the prompt source. */
  userInput: string;
  /** Appendix-I verbatim call shape; structured card/table/checklist consumption lands with the requestJson seam. */
  toolResults: ToolExecutionResult<unknown>[];
  /** Threaded unchanged into every stage call (Appendix I rule) — cancel stops generation. */
  abortSignal: AbortSignal;
  /** F-5/P-4: the Router-supplied StageInvocation bundle (03-05 createStageInvocation). */
  invocation: StageInvocation;
  /** Documented Phase-3 input-only deviation (D-20): live deltas for the hook's ChunkBuffer (03-08). */
  onDelta?: (delta: string) => void;
}

export interface RenderOutput {
  text: string;
  finishReason: string;
}

/** Typed failed-terminal carrier (T-03-06-01): partialText is exactly the pre-failure deltas. */
export interface StreamFailedError extends Error {
  code: 'STREAM_FAILED';
  partialText: string;
}

export function isStreamFailedError(err: unknown): err is StreamFailedError {
  return err instanceof Error && (err as StreamFailedError).code === 'STREAM_FAILED';
}

function streamFailed(message: string, partialText: string): StreamFailedError {
  const err = new Error(`STREAM_FAILED: ${message}`) as StreamFailedError;
  err.code = 'STREAM_FAILED';
  err.partialText = partialText;
  return err;
}

/**
 * User-abort guard (WR-02, T-03-12-01): name-match pattern (AgentOrchestrator
 * L204-211 / PATTERNS.md shared pattern) — a user abort is NOT a provider
 * failure and must never vote the breaker. DOMException does not extend Error
 * in every environment (jsdom realm), so match the canonical 'AbortError' name
 * regardless of prototype chain.
 */
function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

export const RendererService = {
  render,
};

export async function render(input: RenderInput): Promise<RenderOutput> {
  // F-5 (P-4): the messages[]+providerOptions shape comes from the Router's
  // F-5 builder for the invocation's provider — the byte-stable [SYSTEM]
  // persona block travels as the CoreSystemMessage and the anthropic
  // cacheControl breakpoint reaches the wire. Never the `system` string form.
  const built = buildStageMessages(input.invocation.providerId, input.context.sections);
  const result = streamText({
    model: input.invocation.model,
    messages: built.messages,
    maxTokens: RENDERER_MAX_TOKENS,
    maxRetries: 0, // Pitfall 1 — the Router owns retries (D-17)
    abortSignal: input.abortSignal,
  });

  let accumulated = '';
  let finishReason: string;
  let firstTokenMarked = false; // WR-02: exactly ONE freeze mark per render (D-14)
  try {
    for await (const delta of result.textStream) {
      accumulated += delta;
      input.onDelta?.(delta);
      // WR-02 (§1.5 / D-14): the first streamed token freezes the provider —
      // from here on createStageInvocation refuses to switch (stream_frozen).
      if (!firstTokenMarked) {
        getProviderRouter().markStreamedFirstToken(input.operationId);
        firstTokenMarked = true;
      }
    }
    // Pitfall 5: ALWAYS await the terminal member — never return un-await-verified text.
    finishReason = await result.finishReason;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    // WR-02 (T-03-12-01): a provider-originated mid-stream failure votes the
    // provider's breaker — a user abort (AbortError) is not a provider failure
    // and must never vote.
    if (!isAbortError(e)) {
      getProviderRouter().recordFailure(
        input.invocation.providerId,
        ERROR_CODES.STREAM_FAILED,
        err,
      );
    }
    debugLog(ERROR_CODES.STREAM_FAILED, 'renderer stream aborted mid-generation', {
      module: 'RendererService',
      error: err,
      extra: { operationId: input.operationId, partialTokens: accumulated.length },
    });
    throw streamFailed(err.message, accumulated);
  }
  if (finishReason !== 'stop') {
    // Streaming honesty: a truncated/aborted finish is a FAILED terminal, never
    // a silently-truncated 'complete' text (the UI renders the failed state).
    // WR-02 (T-03-12-01): a content-filter/length finish is a provider behavior,
    // never a user abort — it votes the breaker (no isAbortError guard needed).
    getProviderRouter().recordFailure(input.invocation.providerId, ERROR_CODES.STREAM_FAILED);
    debugLog(
      ERROR_CODES.STREAM_FAILED,
      `renderer finished with ${finishReason} — failed terminal`,
      {
        module: 'RendererService',
        extra: { operationId: input.operationId, finishReason, partialTokens: accumulated.length },
      },
    );
    throw streamFailed(`finishReason '${finishReason}' !== 'stop'`, accumulated);
  }
  return { text: accumulated, finishReason };
}
