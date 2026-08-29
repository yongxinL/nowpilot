import { describe, it, expect } from 'vitest';
import { plan, buildPlannerDecisionSchema, PLANNER_TIMEOUT_MS } from '../../../src/core/ai/PlannerService';
import { PROMPTS } from '../../../src/core/prompts';
import { FixtureProvider } from './fixtures/FixtureProvider';
import type { ILLMProvider, LLMStreamRequest } from '../../../src/core/ai/ILLMProvider';
import type { StreamEvent } from '../../../src/core/ai/types';
import {
  OPENAI_ANSWER_STREAM,
  OPENAI_ANSWER_STREAM_CRLF,
  OPENAI_ANSWER_STREAM_SPLIT,
  OPENAI_MALFORMED_STREAM,
  OPENAI_REPAIR_SUCCESS_STREAM,
  OPENAI_MISSING_TERMINATOR_STREAM,
} from './fixtures/openai-stream';

/**
 * End-to-end planner tracer (plan 03-01, Task 2): real OpenAI SSE wire bytes
 * → StreamAdapter → FixtureProvider → StructuredOutput.requestJson → a
 * zod-validated PlannerDecision.
 *
 * The fixture wire bytes are fed through the ACTUAL incremental SSE parser
 * (createStreamAdapter), so this test proves the REQ-R09 rebuild path —
 * not a mocked adapter.
 */

function plannerInput(responseScript: string[][], toolNames: readonly string[] = []) {
  const provider = new FixtureProvider(responseScript);
  return {
    input: {
      operationId: 'op-planner-tracer',
      providerId: 'openai' as const,
      model: 'gpt-4o-mini',
      prompt: 'Help me fix this incident.',
      toolNames,
      callProviderJsonMode: (p: string, s: unknown, sig?: AbortSignal) =>
        provider.requestJson(p, s, sig),
      timeoutMs: PLANNER_TIMEOUT_MS,
    },
    provider,
  };
}

/**
 * A provider whose requestJson hangs until its signal aborts — lets the
 * §1.2 planner timeout (StructuredOutput's internal deadline) fire while the
 * caller's abortSignal stays silent, and vice-versa.
 */
class HangUntilAbortProvider implements ILLMProvider {
  readonly providerId = 'openai' as const;
  async *stream(): AsyncIterable<StreamEvent> {
    return;
  }
  async requestJson(_prompt: string, _jsonSchema: unknown, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return new Promise<string>((_, reject) => {
      signal?.addEventListener(
        'abort',
        () => reject(new DOMException('aborted', 'AbortError')),
        { once: true },
      );
    });
  }
}

describe('PlannerService (03-01 tracer slice)', () => {
  it('happy path: fixture wire bytes → zod-validated answer decision', async () => {
    const { input } = plannerInput([OPENAI_ANSWER_STREAM]);
    const decision = await plan(input);
    expect(decision.action).toBe('answer');
    if (decision.action === 'answer') {
      expect(decision.reasonCode).toBe('direct_answer');
    }
  });

  it('happy path with CRLF line endings (boundary discipline)', async () => {
    const { input } = plannerInput([OPENAI_ANSWER_STREAM_CRLF]);
    const decision = await plan(input);
    expect(decision.action).toBe('answer');
    if (decision.action === 'answer') {
      expect(decision.reasonCode).toBe('direct_answer');
    }
  });

  it('happy path split across deltas accumulates the full decision', async () => {
    const { input } = plannerInput([OPENAI_ANSWER_STREAM_SPLIT]);
    const decision = await plan(input);
    expect(decision.action).toBe('answer');
    if (decision.action === 'answer') {
      expect(decision.reasonCode).toBe('split_answer');
    }
  });

  it('malformed decision is repaired exactly once via PROMPTS.repairJson.system', async () => {
    // Call 1 returns malformed bytes; the repair call (call 2) returns valid.
    const { input, provider } = plannerInput([
      OPENAI_MALFORMED_STREAM,
      OPENAI_REPAIR_SUCCESS_STREAM,
    ]);
    const decision = await plan(input);
    expect(decision.action).toBe('ask_clarification');
    if (decision.action === 'ask_clarification') {
      expect(decision.question).toContain('KB article');
      expect(decision.options).toEqual(['KB001', 'KB002']);
    }
    // Exactly one repair: two provider calls total, second carries the
    // canonical repairJson.system prompt and the broken text.
    expect(provider.prompts).toHaveLength(2);
    expect(provider.prompts[1]).toContain(PROMPTS.repairJson.system);
    expect(provider.prompts[1]).toContain('Broken:');
  });

  it('missing terminator → §1.2 planner-failed fallback (REQ-R09 held at the adapter layer)', async () => {
    // The adapter still emits STREAM_ERROR for a missing terminator
    // (StreamAdapter.test.ts REQ-R09) — but per §1.2 the planner degrades to
    // a direct answer instead of surfacing the transport failure as a turn
    // error.
    const { input } = plannerInput([OPENAI_MISSING_TERMINATOR_STREAM]);
    const decision = await plan(input);
    expect(decision).toEqual({ action: 'answer', reasonCode: 'planner_failed' });
  });

  it('planner timeout → §1.2 fallback to a direct answer (planner_failed)', async () => {
    const provider = new HangUntilAbortProvider();
    const decision = await plan({
      operationId: 'op-planner-timeout',
      providerId: 'openai',
      model: 'gpt-4o-mini',
      prompt: 'Help me fix this incident.',
      toolNames: [],
      callProviderJsonMode: (p: string, s: unknown, sig?: AbortSignal) =>
        provider.requestJson(p, s, sig),
      // Tight deadline so StructuredOutput's internal timeout fires — the
      // production default is PLANNER_TIMEOUT_MS (3s, §1.2).
      timeoutMs: 30,
    });
    expect(decision).toEqual({ action: 'answer', reasonCode: 'planner_failed' });
  });

  it('both JSON attempts fail → §1.2 fallback to a direct answer (planner_failed)', async () => {
    const { input } = plannerInput([OPENAI_MALFORMED_STREAM, OPENAI_MALFORMED_STREAM]);
    const decision = await plan(input);
    expect(decision).toEqual({ action: 'answer', reasonCode: 'planner_failed' });
  });

  it('caller abort propagates — never degraded to a fallback answer', async () => {
    const provider = new HangUntilAbortProvider();
    const ac = new AbortController();
    const pending = plan({
      operationId: 'op-planner-abort',
      providerId: 'openai',
      model: 'gpt-4o-mini',
      prompt: 'Help me fix this incident.',
      toolNames: [],
      callProviderJsonMode: (p: string, s: unknown, sig?: AbortSignal) =>
        provider.requestJson(p, s, sig),
      abortSignal: ac.signal,
      timeoutMs: 10_000,
    });
    ac.abort();
    // The DOMException name is the abort signal the caller checks
    // (useChatStreaming: `err.name === 'AbortError'`); the message is 'aborted'.
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('zero-tool runtime: production schema has NO run_tool variant', () => {
    const schema = buildPlannerDecisionSchema([]);
    expect(schema.safeParse({ action: 'answer', reasonCode: 'ok' }).success).toBe(true);
    expect(
      schema.safeParse({ action: 'ask_clarification', question: 'q', options: [] }).success,
    ).toBe(true);
    // run_tool must be rejected — never construct z.enum([]), never an
    // unrestricted production toolName string.
    expect(schema.safeParse({ action: 'run_tool', toolName: 'x', input: {} }).success).toBe(false);
  });

  it('closed toolName enum when tools are registered', () => {
    const schema = buildPlannerDecisionSchema(['search_notes', 'open_page']);
    expect(
      schema.safeParse({ action: 'run_tool', toolName: 'search_notes', input: { q: 1 } }).success,
    ).toBe(true);
    // Unknown tool name is rejected — the enum is closed.
    expect(schema.safeParse({ action: 'run_tool', toolName: 'evil', input: {} }).success).toBe(
      false,
    );
    expect(schema.safeParse({ action: 'answer', reasonCode: 'ok' }).success).toBe(true);
  });

  it('canonical prompt is the Appendix A planner system string (persona-free)', () => {
    expect(PROMPTS.planner.system).toBe(
      'Select exactly one action: answer, run_tool, or ask_clarification. Return JSON only. Do not explain.',
    );
    expect(PROMPTS.repairJson.system).toBe(
      'Repair the previous output into valid JSON matching the provided schema. Return JSON only.',
    );
  });
});