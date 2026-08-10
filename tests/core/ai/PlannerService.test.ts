// tests/core/ai/PlannerService.test.ts — planner contract (03-04, D-05/D-19/
// F-4). plan() stays pure: it threads OptimizedContext.sections into requestJson
// (the fake callProviderJsonMode receives the fixture sections UNCHANGED — never
// a joined string, Golden Rule 3) and resolves through the one-repair cycle
// (first fail → repair → success; second fail → STRUCTURED_OUTPUT_FAILED).
// buildPlannerDecisionSchema() is the §1.2 closed discriminatedUnion: with zero
// tools the run_tool branch is OMITTED (D-05 — a stray run_tool fails the
// schema; ExecutorService independently TOOL_REJECTs it); with the D-04 builtin
// the run_tool.toolName is the closed enum (invented names rejected).
import { describe, expect, it } from 'vitest';

import { buildPlannerDecisionSchema, PlannerService } from '@/core/ai/PlannerService';
import type { PlanInput } from '@/core/ai/PlannerService';
import { isStructuredOutputFailed } from '@/core/ai/StructuredOutput';
import { BUILTIN_TOOLS } from '@/core/ai/toolSchemas';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';

const VALID_ANSWER = JSON.stringify({ action: 'answer', reasonCode: 'plan_ok' });

function baseInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    operationId: 'op-plan-0001',
    context: buildOptimizedContextFixture(),
    userInput: 'Summarize the current page.',
    abortSignal: new AbortController().signal,
    timeoutMs: 3_000,
    providerId: 'openai',
    model: 'deepseek-chat',
    callProviderJsonMode: async () => VALID_ANSWER,
    ...overrides,
  };
}

describe('PlannerService.plan (D-19 purity, F-4)', () => {
  it('threads context.sections into requestJson unchanged and returns the Zod-validated decision', async () => {
    const fixture = buildOptimizedContextFixture();
    const calls: unknown[][] = [];
    const input = baseInput({
      callProviderJsonMode: async (sections) => {
        calls.push([sections]);
        return VALID_ANSWER;
      },
    });

    const decision = await PlannerService.plan(input);

    expect(decision).toEqual({ action: 'answer', reasonCode: 'plan_ok' });
    expect(calls).toHaveLength(1);
    // F-4: the callback receives the PromptSection[] — never a joined string
    expect(calls[0][0]).toEqual(fixture.sections);
  });

  it('first-fail → exactly one repair → success', async () => {
    let callCount = 0;
    const input = baseInput({
      callProviderJsonMode: async () => {
        callCount += 1;
        return callCount === 1 ? 'not-json {' : VALID_ANSWER;
      },
    });

    const decision = await PlannerService.plan(input);

    expect(decision).toEqual({ action: 'answer', reasonCode: 'plan_ok' });
    expect(callCount).toBe(2); // exactly one repair
  });

  it('second-fail → canonical STRUCTURED_OUTPUT_FAILED (never a third attempt)', async () => {
    const input = baseInput({
      callProviderJsonMode: async () => 'broken-forever',
    });

    let caught: unknown;
    try {
      await PlannerService.plan(input);
    } catch (e) {
      caught = e;
    }

    expect(isStructuredOutputFailed(caught)).toBe(true);
    if (isStructuredOutputFailed(caught)) {
      expect(caught.retryable).toBe(false);
      expect(caught.raw.first).toBe('broken-forever');
      expect(caught.raw.second).toBe('broken-forever');
    }
  });
});

describe('buildPlannerDecisionSchema (D-05 closed union)', () => {
  it('OMITS the run_tool branch when zero tools are registered — a stray run_tool is rejected', () => {
    const schema = buildPlannerDecisionSchema([]);

    expect(schema.safeParse({ action: 'answer', reasonCode: 'ok' }).success).toBe(true);
    expect(schema.safeParse({ action: 'ask_clarification', question: 'Which note?' }).success).toBe(
      true,
    );
    expect(
      schema.safeParse({ action: 'run_tool', toolName: 'get-provider-info', input: {} }).success,
    ).toBe(false); // branch omitted — the model cannot request a tool
  });

  it('includes run_tool with a CLOSED toolName enum when tools are registered', () => {
    const schema = buildPlannerDecisionSchema(BUILTIN_TOOLS);

    expect(
      schema.safeParse({ action: 'run_tool', toolName: 'get-provider-info', input: {} }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ action: 'run_tool', toolName: 'invented-tool', input: {} }).success,
    ).toBe(false); // closed enum — invented tool names never reach the Executor
  });

  it('validates the ask_clarification branch (RICH-C-01 substrate, §17.7)', () => {
    const schema = buildPlannerDecisionSchema([]);

    const withChips = schema.safeParse({
      action: 'ask_clarification',
      question: 'Which note?',
      options: ['Note A', 'Note B'],
    });
    expect(withChips.success).toBe(true);
    if (withChips.success && withChips.data.action === 'ask_clarification') {
      expect(withChips.data.options).toEqual(['Note A', 'Note B']);
    }

    // options default to [] when omitted (RICH-C-04 chip default)
    const noChips = schema.safeParse({ action: 'ask_clarification', question: 'Which note?' });
    expect(noChips.success).toBe(true);
    if (noChips.success && noChips.data.action === 'ask_clarification') {
      expect(noChips.data.options).toEqual([]);
    }

    // at most 4 chips
    expect(
      schema.safeParse({
        action: 'ask_clarification',
        question: 'Which note?',
        options: ['1', '2', '3', '4', '5'],
      }).success,
    ).toBe(false);
  });
});
