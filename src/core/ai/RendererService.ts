// RendererService — §1.2/§1.3 renderer (spec 313-325), verbatim semantics.
//
// Converts validated context + tool output into a concise answer. Rules:
//   - Use the fast tier where available (D-55 stage-tier mapping);
//   - "Max normal output: 512 tokens unless the feature overrides" — the cap
//     is DATA (`DEFAULT_MAX_OUTPUT_TOKENS`, overridable via maxOutputTokens),
//     never hard-coded in the loop (Open Q4);
//   - "Do not invent missing tool results" — the renderer only relays model
//     output verbatim, no synthesis (no invented facts);
//   - Timeout: 5 s for normal answers (caller-bounded; render threads the
//     AbortSignal unchanged).
//
// Consumption path: the provider's ILLMProvider.stream yields canonical
// D-47 events; render enqueues STREAM_DELTA text into an Appendix J
// ChunkBuffer for UI consumption and re-emits canonical events for state
// machines (ActiveStreamState §20.6).
import type { ILLMProvider, LLMStreamRequest } from './ILLMProvider';
import type { ModelTier, StreamErrorCode, StreamEvent } from './types';
import { createChunkBuffer } from './ChunkBuffer';

/** §1.3: "Max normal output: 512 tokens unless the feature overrides." */
export const DEFAULT_MAX_OUTPUT_TOKENS = 512;

/** §1.2: "Timeout: 5 seconds for normal answers." */
export const RENDER_TIMEOUT_MS = 5_000;

/** Standard chars→tokens heuristic (roughly 4 chars/token) for the cap check. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateCharsTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export type RenderTermination = 'completed' | 'aborted' | 'error' | 'cap';

export interface RenderInput {
  /** Phase-1 OperationId correlation (Flag C). */
  operationId: string;
  /** The stream source — an ILLMProvider instance (UI contexts only, MV3). */
  provider: ILLMProvider;
  /** Resolved model for this tier (TierResolver result, 03-05/03-06). */
  model: string;
  /** D-55 stage tier — recorded metadata; never invents a model name. */
  tier: ModelTier;
  /** Assembled stage prompt (PromptCacheManager, D-59). */
  systemPrompt: string;
  /** Current user turn. */
  userInput?: string;
  abortSignal?: AbortSignal;
  /**
   * Open Q4: per-feature output cap override (default DEFAULT_MAX_OUTPUT_TOKENS).
   */
  maxOutputTokens?: number;
  /** §1.2 renderer timeout override (default RENDER_TIMEOUT_MS). */
  timeoutMs?: number;
  /** UI subscription — receives the buffered text on each ChunkBuffer flush. */
  onFlush?: (text: string) => void;
  /** Canonical-event subscription (drives ActiveStreamState §20.6). */
  onEvent?: (event: StreamEvent) => void;
}

export interface RenderResult {
  /** The model output relayed verbatim (prefix under the cap). */
  streamedText: string;
  tokenCount: number;
  maxOutputTokens: number;
  truncated: boolean;
  terminatedBy: RenderTermination;
  /** Present when terminatedBy === 'error' — canonical §21.6 code (D-38). */
  error?: { code: StreamErrorCode; message: string };
}

export async function render(input: RenderInput): Promise<RenderResult> {
  const maxOutputTokens = input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const buffer = createChunkBuffer();
  let fullText = '';
  // Chars enqueued so far, tracked synchronously — `fullText` only advances on
  // ChunkBuffer flush (rAF/33 ms batching), so the cap check must NOT read it
  // mid-stream or a fast provider would stream unbounded text before the
  // first flush ever fires.
  let accumulatedChars = 0;
  let truncated = false;
  let terminatedBy: RenderTermination = 'completed';
  let error: RenderResult['error'];

  buffer.onFlush((text) => {
    fullText = text;
    input.onFlush?.(text);
  });

  // §1.2 renderer timeout: "5 seconds for normal answers." The caller's
  // AbortSignal is composed with an internal deadline (mirrors the planner's
  // WR-02 pattern in StructuredOutput) so a provider stream that stalls —
  // connection open but no [DONE]/terminator — surfaces as a TIMEOUT error
  // instead of leaving the UI stuck in "Thinking…" forever. A caller abort
  // still terminates as 'aborted'; only the internal deadline is TIMEOUT.
  const callerSignal = input.abortSignal ?? new AbortController().signal;
  const timeoutAc = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => timeoutAc.abort();
  callerSignal.addEventListener('abort', onCallerAbort);
  const deadline = setTimeout(() => {
    timedOut = true;
    timeoutAc.abort();
  }, input.timeoutMs ?? RENDER_TIMEOUT_MS);
  const signal = timeoutAc.signal;

  const request: LLMStreamRequest = {
    operationId: input.operationId,
    providerId: input.provider.providerId,
    model: input.model,
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userInput ?? '' },
    ],
    // CR-05: renderer-internal options ({maxTokens, tier}) are NOT forwarded
    // into the provider request body — Anthropic validates strictly (unknown
    // top-level fields → 400) and Gemini validates generationConfig strictly
    // (maxTokens/tier are invalid; the key is maxOutputTokens). The §1.3 cap
    // is enforced by the client-side char counter below, which is
    // authoritative; the provider body stays provider-native.
  };

  const terminateAsError = (code: StreamErrorCode, message: string): RenderResult => {
    terminatedBy = 'error';
    error = { code, message };
    buffer.flushNow();
    return result();
  };
  const terminateAsAborted = (): RenderResult => {
    terminatedBy = 'aborted';
    buffer.flushNow();
    return result();
  };
  const timeoutMessage = (): string =>
    `renderer timed out after ${input.timeoutMs ?? RENDER_TIMEOUT_MS}ms`;

  try {
    for await (const event of input.provider.stream(request, signal)) {
      if (signal.aborted) {
        if (timedOut) return terminateAsError('TIMEOUT', timeoutMessage());
        // Caller abort — surface STREAM_ABORTED and stop (D-47).
        input.onEvent?.({ type: 'STREAM_ABORTED', operationId: input.operationId });
        return terminateAsAborted();
      }
      switch (event.type) {
        case 'STREAM_START':
          input.onEvent?.(event);
          break;
        case 'STREAM_DELTA': {
          // Cap check at delta granularity: never partially enqueue model
          // output (verbatim relay). When the next delta would exceed the
          // cap, stop — the accumulated text stays model output only.
          if (estimateCharsTokens(accumulatedChars + event.delta.length) > maxOutputTokens) {
            truncated = true;
            terminatedBy = 'cap';
            buffer.flushNow();
            return result();
          }
          input.onEvent?.(event);
          buffer.enqueue(event.delta);
          accumulatedChars += event.delta.length;
          break;
        }
        case 'STREAM_COMPLETE':
          input.onEvent?.(event);
          terminatedBy = 'completed';
          buffer.flushNow();
          return result();
        case 'STREAM_ERROR':
          input.onEvent?.(event);
          error = { code: event.code, message: event.message };
          terminatedBy = 'error';
          buffer.flushNow();
          return result();
        case 'STREAM_ABORTED':
          input.onEvent?.(event);
          if (timedOut) return terminateAsError('TIMEOUT', timeoutMessage());
          return terminateAsAborted();
      }
    }
    // Stream ended without a terminal event (e.g. provider dropped after an
    // external abort). Surface STREAM_ABORTED when the signal fired.
    if (signal.aborted) {
      if (timedOut) return terminateAsError('TIMEOUT', timeoutMessage());
      input.onEvent?.({ type: 'STREAM_ABORTED', operationId: input.operationId });
      return terminateAsAborted();
    }
    buffer.flushNow();
    return result();
  } catch (err) {
    if (timedOut) return terminateAsError('TIMEOUT', timeoutMessage());
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      input.onEvent?.({ type: 'STREAM_ABORTED', operationId: input.operationId });
      return terminateAsAborted();
    }
    throw err;
  } finally {
    clearTimeout(deadline);
    callerSignal.removeEventListener('abort', onCallerAbort);
  }

  function result(): RenderResult {
    return {
      streamedText: fullText,
      tokenCount: estimateTokens(fullText),
      maxOutputTokens,
      truncated,
      terminatedBy,
      ...(error ? { error } : {}),
    };
  }
}

export const RendererService = { render };