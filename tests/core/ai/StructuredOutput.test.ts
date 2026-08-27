import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  requestJson,
  StructuredOutputError,
  STRUCTURED_OUTPUT_FAILED,
  type StructuredOutputContext,
} from '../../../src/core/ai/StructuredOutput';
import { PROMPTS } from '../../../src/core/prompts';
import { PlannerDecisionSchema } from '../../../src/core/ai/types';
import { FixtureProvider } from './fixtures/FixtureProvider';
import {
  OPENAI_ANSWER_STREAM,
  OPENAI_MALFORMED_STREAM,
  OPENAI_REPAIR_SUCCESS_STREAM,
  OPENAI_REPAIR_FAILURE_STREAM,
} from './fixtures/openai-stream';

/**
 * Appendix L contract tests (plan 03-01, Task 3):
 *   (a) valid JSON passes with NO repair
 *   (b) malformed JSON repaired EXACTLY once via PROMPTS.repairJson.system
 *   (c) double failure is terminal — STRUCTURED_OUTPUT_FAILED, retryable false
 *   (d) abort propagation — no hang, typed failure when the caller aborts
 *
 * The exactly-one-repair rule is the invariant: StructuredOutput must NEVER
 * add a second repair attempt.
 */

const TestSchema = z.object({
  action: z.literal('answer'),
  reasonCode: z.string().max(64),
});

function makeCtx(provider: FixtureProvider, abortSignal: AbortSignal = new AbortController().signal): StructuredOutputContext {
  return {
    operationId: 'op-structured-output',
    providerId: 'openai',
    model: 'gpt-4o-mini',
    timeoutMs: 5000,
    callProviderJsonMode: (p: string, s: unknown, sig?: AbortSignal) =>
      provider.requestJson(p, s, sig),
    abortSignal,
  };
}

describe('StructuredOutput.requestJson (Appendix L)', () => {
  it('(a) valid JSON first attempt passes through with NO repair', async () => {
    const provider = new FixtureProvider([OPENAI_ANSWER_STREAM]);
    const result = await requestJson(TestSchema, 'Do the thing', makeCtx(provider));
    expect(result).toEqual({ action: 'answer', reasonCode: 'direct_answer' });
    // Exactly one provider call — no repair attempt.
    expect(provider.prompts).toHaveLength(1);
    expect(provider.prompts[0]).not.toContain(PROMPTS.repairJson.system);
  });

  it('(b) malformed JSON is repaired exactly once — repair prompt carries the canonical system text + broken output', async () => {
    const provider = new FixtureProvider([OPENAI_MALFORMED_STREAM, OPENAI_REPAIR_SUCCESS_STREAM]);
    const result = await requestJson(PlannerDecisionSchema, 'Do the thing', makeCtx(provider));
    expect(result.action).toBe('ask_clarification');
    if (result.action === 'ask_clarification') {
      expect(result.question).toContain('KB article');
    }
    // Two calls total: original + exactly one repair.
    expect(provider.prompts).toHaveLength(2);
    const repairPrompt = provider.prompts[1];
    expect(repairPrompt).toContain(PROMPTS.repairJson.system);
    // The repair prompt embeds the broken JSON text (Appendix L shape).
    expect(repairPrompt).toContain('Broken:');
  });

  it('(c) double failure is terminal — STRUCTURED_OUTPUT_FAILED with retryable false', async () => {
    const provider = new FixtureProvider([OPENAI_MALFORMED_STREAM, OPENAI_REPAIR_FAILURE_STREAM]);
    const error = await requestJson(TestSchema, 'Do the thing', makeCtx(provider)).catch((e) => e);
    expect(error).toBeInstanceOf(StructuredOutputError);
    expect(error.code).toBe(STRUCTURED_OUTPUT_FAILED);
    expect(error.retryable).toBe(false);
    // Raw payload captures both failed attempts for diagnostics.
    expect(error.raw.first).toContain('reasonCode');
    expect(error.raw.second).toContain('still not valid');
    // Exactly two provider calls — NO second repair attempt (the invariant).
    expect(provider.prompts).toHaveLength(2);
  });

  it('(d) caller abort mid-attempt surfaces a typed failure without hanging', async () => {
    const ac = new AbortController();
    let providerCalls = 0;
    // A provider that never resolves on its own — only rejects when the
    // signal it was handed aborts (the Requester maps caller abort to
    // TIMEOUT per D-35; here we assert the abort propagates and no hang).
    const ctx: StructuredOutputContext = {
      operationId: 'op-abort',
      providerId: 'openai',
      model: 'gpt-4o-mini',
      timeoutMs: 5000,
      callProviderJsonMode: (_p: string, _s: unknown, signal?: AbortSignal) =>
        new Promise<string>((_resolve, reject) => {
          providerCalls += 1;
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        }),
      abortSignal: ac.signal,
    };

    const promise = requestJson(TestSchema, 'Do the thing', ctx);
    // Abort shortly after the call is in flight.
    setTimeout(() => ac.abort(), 10);
    const error = await promise.catch((e) => e);
    // Typed failure (AbortError), not a hang.
    expect(error).toBeInstanceOf(DOMException);
    expect(error.name).toBe('AbortError');
    expect(providerCalls).toBe(1);
  });
});