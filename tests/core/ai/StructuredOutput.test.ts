// tests/core/ai/StructuredOutput.test.ts — structured-output contract (03-04,
// Appendix L + F-4). Asserts the sections-in signature (the fake
// callProviderJsonMode receives PromptSection[], never a joined string); the ONE
// repair appends a task-kind (user_input) repair section while the cached
// section TEXT stays byte-identical attempt-1 vs repair (hash-equality over
// hashStableSections — the prompt-cache stability invariant, §1.3 /
// T-03-04-02); exactly one repair max (call count = 2, T-03-04-01); the
// terminal failure carries the canonical STRUCTURED_OUTPUT_FAILED shape
// {retryable:false, raw:{first,second}} with the isStructuredOutputFailed()
// guard; per-attempt timeout + outer-abort re-parenting (Appendix L,
// T-03-04-04); Appendix L safeParse fence-strip; schema-invalid JSON (valid
// JSON, wrong shape) also repairs (Golden Rule 4 — Zod validates, never regex).
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { hashStableSections } from '@/core/ai/PromptCacheAdapter';
import { isStructuredOutputFailed, requestJson } from '@/core/ai/StructuredOutput';
import type { StructuredOutputContext } from '@/core/ai/StructuredOutput';
import { PROMPTS } from '@/core/prompts';
import type { PromptSection } from '@/core/ai/types';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';

const DecisionSchema = z.object({
  action: z.literal('answer'),
  reasonCode: z.string().max(64),
  confidence: z.number().min(0).max(1),
});

const VALID_DECISION = JSON.stringify({ action: 'answer', reasonCode: 'ok', confidence: 0.9 });

interface CallRecord {
  sections: PromptSection[];
  jsonSchema: unknown;
  signal: AbortSignal;
}

function makeContext(
  responder: (record: CallRecord) => Promise<string>,
  opts: { timeoutMs?: number; abortSignal?: AbortSignal } = {},
): { ctx: StructuredOutputContext; calls: CallRecord[] } {
  const calls: CallRecord[] = [];
  const ctx: StructuredOutputContext = {
    operationId: 'op-test-0001',
    providerId: 'openai',
    model: 'deepseek-chat',
    timeoutMs: opts.timeoutMs ?? 5_000,
    abortSignal: opts.abortSignal ?? new AbortController().signal,
    callProviderJsonMode: async (sections, jsonSchema, signal) => {
      const record: CallRecord = { sections, jsonSchema, signal };
      calls.push(record);
      return responder(record);
    },
  };
  return { ctx, calls };
}

const TASK_KINDS: ReadonlyArray<PromptSection['kind']> = ['context', 'task', 'user_input'];
const cachedTexts = (sections: PromptSection[]): string[] =>
  sections
    .filter((s) => !TASK_KINDS.includes(s.kind))
    .map((s) => s.text);

describe('requestJson — F-4 sections-in signature', () => {
  it('threads PromptSection[] through unchanged and returns the parsed decision', async () => {
    const fixture = buildOptimizedContextFixture();
    const { ctx, calls } = makeContext(async () => VALID_DECISION);

    const result = await requestJson(DecisionSchema, fixture.sections, ctx);

    expect(result).toEqual({ action: 'answer', reasonCode: 'ok', confidence: 0.9 });
    expect(calls).toHaveLength(1); // no repair on first-pass success
    expect(Array.isArray(calls[0].sections)).toBe(true);
    expect(calls[0].sections).toEqual(fixture.sections); // threaded unchanged (F-4)
  });

  it('fence-strips markdown-wrapped JSON before parsing (Appendix L safeParse)', async () => {
    const fixture = buildOptimizedContextFixture();
    const { ctx } = makeContext(async () => '```json\n' + VALID_DECISION + '\n```');

    const result = await requestJson(DecisionSchema, fixture.sections, ctx);

    expect(result).toEqual({ action: 'answer', reasonCode: 'ok', confidence: 0.9 });
  });
});

describe('requestJson — one byte-stable repair (F-4, T-03-04-01/02)', () => {
  it('repairs ONCE with a user_input section while keeping cached text byte-identical', async () => {
    const fixture = buildOptimizedContextFixture();
    const broken = 'not-json {';
    let callCount = 0;
    const { ctx, calls } = makeContext(async () => {
      callCount += 1;
      return callCount === 1 ? broken : VALID_DECISION;
    });

    const result = await requestJson(DecisionSchema, fixture.sections, ctx);

    expect(result).toEqual({ action: 'answer', reasonCode: 'ok', confidence: 0.9 });
    expect(calls).toHaveLength(2); // first attempt + exactly one repair

    const firstSections = calls[0].sections;
    const secondSections = calls[1].sections;

    // hash-equality over the stable cached set — the prompt-cache invariant
    // (§1.3): attempt-1 and the repair must hash identically.
    expect(hashStableSections(firstSections)).toBe(hashStableSections(secondSections));
    expect(hashStableSections(secondSections)).toBe(hashStableSections(fixture.sections));
    // cached (non-task) section text is byte-identical — never a joined-string rebuild
    expect(cachedTexts(secondSections)).toEqual(cachedTexts(firstSections));

    // the repair APPENDS exactly one task-kind (user_input) section
    const repairSections = secondSections.filter((s) => s.sourceId === 'structured-output-repair');
    expect(repairSections).toHaveLength(1);
    const repair = repairSections[0];
    expect(repair.kind).toBe('user_input');
    expect(repair.stable).toBe(false);
    // VERBATIM Appendix L F-4 repairText — never a paraphrase, never a dropped newline
    expect(repair.text).toBe(
      `${PROMPTS.repairJson.system}\nSchema: ${JSON.stringify(calls[0].jsonSchema)}\nBroken: ${broken}`,
    );
    expect(repair.tokens).toBe(Math.ceil(repair.text.length / 4));
    // the attempt-2 section list = cached (task kinds removed) + the repair
    expect(secondSections.map((s) => s.sourceId)).toEqual([
      ...firstSections.filter((s) => !TASK_KINDS.includes(s.kind)).map((s) => s.sourceId),
      'structured-output-repair',
    ]);
  });

  it('treats schema-invalid JSON (valid JSON, wrong shape) as a failure and repairs (Golden Rule 4)', async () => {
    const fixture = buildOptimizedContextFixture();
    let callCount = 0;
    const { ctx, calls } = makeContext(async () => {
      callCount += 1;
      return callCount === 1 ? JSON.stringify({ action: 'run_tool', toolName: 42 }) : VALID_DECISION;
    });

    const result = await requestJson(DecisionSchema, fixture.sections, ctx);

    expect(result).toEqual({ action: 'answer', reasonCode: 'ok', confidence: 0.9 });
    expect(calls).toHaveLength(2); // one repair
  });

  it('never attempts a third call and throws the canonical STRUCTURED_OUTPUT_FAILED shape', async () => {
    const fixture = buildOptimizedContextFixture();
    const first = 'broken-first';
    const second = 'broken-second';
    let callCount = 0;
    const { ctx, calls } = makeContext(async () => {
      callCount += 1;
      return callCount === 1 ? first : second;
    });

    let caught: unknown;
    try {
      await requestJson(DecisionSchema, fixture.sections, ctx);
    } catch (e) {
      caught = e;
    }

    expect(calls).toHaveLength(2); // first + one repair — never a third attempt
    expect(isStructuredOutputFailed(caught)).toBe(true);
    if (isStructuredOutputFailed(caught)) {
      expect(caught.code).toBe('STRUCTURED_OUTPUT_FAILED');
      expect(caught.retryable).toBe(false);
      expect(caught.raw).toEqual({ first, second });
      expect(caught.message).toBe('STRUCTURED_OUTPUT_FAILED');
    }
  });
});

describe('requestJson — abort re-parenting (Appendix L, T-03-04-04)', () => {
  it('aborts the per-attempt call after ctx.timeoutMs', async () => {
    const fixture = buildOptimizedContextFixture();
    const { ctx } = makeContext(
      (record) =>
        new Promise<string>((_resolve, reject) => {
          record.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
      { timeoutMs: 10 },
    );

    await expect(requestJson(DecisionSchema, fixture.sections, ctx)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('re-parents the outer abortSignal into the per-attempt call', async () => {
    const fixture = buildOptimizedContextFixture();
    const outer = new AbortController();
    let sawAbortedSignal: boolean | undefined;
    const { ctx } = makeContext(
      (record) =>
        new Promise<string>((_resolve, reject) => {
          record.signal.addEventListener('abort', () => {
            sawAbortedSignal = record.signal.aborted;
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
      { abortSignal: outer.signal, timeoutMs: 5_000 },
    );

    const pending = requestJson(DecisionSchema, fixture.sections, ctx).catch((e) => e);
    outer.abort();
    const err = await pending;

    expect(sawAbortedSignal).toBe(true);
    expect(err).toMatchObject({ name: 'AbortError' });
  });
});

