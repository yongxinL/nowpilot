// tests/core/ai/OutcomeVerifier.test.ts — 03a-02 task 3 (AGT-02/AGT-03,
// D-3a-03/04/06/07): proves buildOutcome (Appendix O.2 verbatim + injectable
// clock, Pitfall 6) end-to-end — evidence-gated completion, fail-closed
// postcondition verdicts, cap exhaustion = partial never completed, read-only
// tool skipping, and clock determinism.
//
// Determinism (fixtures/index.ts): every buildOutcome call injects a fixed
// `now` clock — the O.2 Date.now() default is never exercised in tests, so all
// verifiedAt assertions are exact equality on FIXED_VERIFIED_AT.
import { describe, expect, it } from 'vitest';

import { buildOutcome } from '@/core/ai/OutcomeVerifier';
import type { ToolExecutionResult } from '@/core/ai/types';
import {
  FIXED_TRAJECTORY_OPERATION_ID,
  FIXED_VERIFIED_AT,
  MOCK_DANGEROUS_POSTCONDITION_ID,
  MOCK_DANGEROUS_TOOL,
  MOCK_DANGEROUS_VERIFIER,
} from '../../fixtures/trajectory';

// ---------------------------------------------------------------------------
// Local deterministic fixtures (fixed constants only — no Date.now/crypto)
// ---------------------------------------------------------------------------

/** The fixture's read-only tool — no verifier registered (D-3a-04). */
const READ_ONLY_TOOL_NAME = 'get-provider-info';

function toolResult(overrides: Partial<ToolExecutionResult> = {}): ToolExecutionResult {
  return {
    toolName: MOCK_DANGEROUS_TOOL.name,
    ok: true,
    output: { written: true },
    durationMs: 10,
    ...overrides,
  };
}

/** Fixed injectable clock — the deterministic now() every test passes. */
const fixedNow = (): number => FIXED_VERIFIED_AT;

// ---------------------------------------------------------------------------
// (a) pure-answer turn — no tools, no evidence (D-3a-04)
// ---------------------------------------------------------------------------

describe('buildOutcome — pure-answer turn (D-3a-04)', () => {
  it('a pure-answer turn (no toolResults) is completed with evidence: []', async () => {
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [],
      {},
      { plannerCalls: 1, toolCalls: 0, capHit: false },
      fixedNow,
    );
    expect(outcome).toEqual({
      operationId: FIXED_TRAJECTORY_OPERATION_ID,
      status: 'completed',
      reasonCode: 'ok',
      evidence: [],
      plannerCalls: 1,
      toolCalls: 0,
    });
  });

  it('echoes the supplied plannerCalls/toolCalls counters from caps', async () => {
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [],
      {},
      { plannerCalls: 3, toolCalls: 2, capHit: false },
      fixedNow,
    );
    expect(outcome.plannerCalls).toBe(3);
    expect(outcome.toolCalls).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// (b) side-effecting tool with ok:true verifier — completed + evidence entry
// ---------------------------------------------------------------------------

describe('buildOutcome — verified side-effecting success (AGT-02)', () => {
  it('a side-effecting tool with ok:true verdict is completed with a matching evidence entry', async () => {
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [toolResult({ ok: true })],
      { [MOCK_DANGEROUS_TOOL.name]: MOCK_DANGEROUS_VERIFIER },
      { plannerCalls: 2, toolCalls: 1, capHit: false },
      fixedNow,
    );
    expect(outcome.status).toBe('completed');
    expect(outcome.reasonCode).toBe('ok');
    expect(outcome.evidence).toHaveLength(1);
    expect(outcome.evidence[0]).toEqual({
      toolName: MOCK_DANGEROUS_TOOL.name,
      operationId: FIXED_TRAJECTORY_OPERATION_ID,
      postconditionId: MOCK_DANGEROUS_POSTCONDITION_ID,
      ok: true,
      verifiedAt: FIXED_VERIFIED_AT,
      detail: 'mock dangerous tool verified (fixture)',
    });
  });

  it('emits one evidence entry per side-effecting tool result, in execution order', async () => {
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [toolResult({ ok: true }), toolResult({ ok: true })],
      { [MOCK_DANGEROUS_TOOL.name]: MOCK_DANGEROUS_VERIFIER },
      { plannerCalls: 3, toolCalls: 2, capHit: false },
      fixedNow,
    );
    expect(outcome.status).toBe('completed');
    expect(outcome.evidence).toHaveLength(2);
    expect(outcome.evidence.map((e) => e.ok)).toEqual([true, true]);
  });
});

// ---------------------------------------------------------------------------
// (c) !ok verdict — failed + postcondition_failed (fail-closed, D-3a-06)
// ---------------------------------------------------------------------------

describe('buildOutcome — fail-closed on !ok verdict (D-3a-06)', () => {
  it('a tool whose verifier returns ok:false is failed with reasonCode postcondition_failed', async () => {
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [
        toolResult({
          ok: false,
          error: { code: 'TOOL_FAILED', message: 'boom', retryable: true },
        }),
      ],
      { [MOCK_DANGEROUS_TOOL.name]: MOCK_DANGEROUS_VERIFIER },
      { plannerCalls: 2, toolCalls: 1, capHit: false },
      fixedNow,
    );
    expect(outcome.status).toBe('failed');
    expect(outcome.reasonCode).toBe('postcondition_failed');
    expect(outcome.evidence).toHaveLength(1);
    expect(outcome.evidence[0].ok).toBe(false);
    expect(outcome.evidence[0].detail).toBe('boom');
  });

  it('a single !ok evidence fails the whole turn even if another tool verified ok', async () => {
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [toolResult({ ok: true }), toolResult({ ok: false })],
      { [MOCK_DANGEROUS_TOOL.name]: MOCK_DANGEROUS_VERIFIER },
      { plannerCalls: 2, toolCalls: 2, capHit: false },
      fixedNow,
    );
    expect(outcome.status).toBe('failed');
    expect(outcome.reasonCode).toBe('postcondition_failed');
  });
});

// ---------------------------------------------------------------------------
// (d) cap exhaustion — partial + cap_exhausted, NEVER completed (D-3a-07, AGT-03)
// ---------------------------------------------------------------------------

describe('buildOutcome — cap exhaustion (D-3a-07, AGT-03)', () => {
  it('caps.capHit is partial with reasonCode cap_exhausted even with zero side effects', async () => {
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [],
      {},
      { plannerCalls: 1, toolCalls: 0, capHit: true },
      fixedNow,
    );
    expect(outcome.status).toBe('partial');
    expect(outcome.reasonCode).toBe('cap_exhausted');
  });

  it('capHit wins over a failing side effect — partial, never failed/completed', async () => {
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [
        toolResult({
          ok: false,
          error: { code: 'TOOL_FAILED', message: 'boom', retryable: true },
        }),
      ],
      { [MOCK_DANGEROUS_TOOL.name]: MOCK_DANGEROUS_VERIFIER },
      { plannerCalls: 5, toolCalls: 1, capHit: true },
      fixedNow,
    );
    expect(outcome.status).toBe('partial');
    expect(outcome.reasonCode).toBe('cap_exhausted');
  });
});

// ---------------------------------------------------------------------------
// (e) read-only tool with no verifier — skipped, no evidence (D-3a-04)
// ---------------------------------------------------------------------------

describe('buildOutcome — read-only tools skipped (D-3a-04)', () => {
  it('a read-only tool with no verifier registered contributes no evidence', async () => {
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [toolResult({ toolName: READ_ONLY_TOOL_NAME, output: { providers: [] } })],
      {}, // no verifier keyed by the read-only toolName
      { plannerCalls: 2, toolCalls: 1, capHit: false },
      fixedNow,
    );
    expect(outcome.status).toBe('completed');
    expect(outcome.reasonCode).toBe('ok');
    expect(outcome.evidence).toEqual([]);
  });

  it('mixes skipped read-only tools with verified side-effecting tools', async () => {
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [
        toolResult({ toolName: READ_ONLY_TOOL_NAME, output: { providers: [] } }),
        toolResult({ ok: true }),
      ],
      { [MOCK_DANGEROUS_TOOL.name]: MOCK_DANGEROUS_VERIFIER },
      { plannerCalls: 2, toolCalls: 2, capHit: false },
      fixedNow,
    );
    expect(outcome.status).toBe('completed');
    expect(outcome.evidence).toHaveLength(1);
    expect(outcome.evidence[0].toolName).toBe(MOCK_DANGEROUS_TOOL.name);
  });
});

// ---------------------------------------------------------------------------
// (f) injectable clock — verifiedAt equals the injected now (Pitfall 6)
// ---------------------------------------------------------------------------

describe('buildOutcome — deterministic clock (Pitfall 6)', () => {
  it('verifiedAt comes from the injected now clock, never Date.now', async () => {
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [toolResult({ ok: true })],
      { [MOCK_DANGEROUS_TOOL.name]: MOCK_DANGEROUS_VERIFIER },
      { plannerCalls: 1, toolCalls: 1, capHit: false },
      fixedNow,
    );
    expect(outcome.evidence[0].verifiedAt).toBe(FIXED_VERIFIED_AT);
  });

  it('uses the production Date.now default when no clock is injected', async () => {
    const before = Date.now();
    const outcome = await buildOutcome(
      FIXED_TRAJECTORY_OPERATION_ID,
      [toolResult({ ok: true })],
      { [MOCK_DANGEROUS_TOOL.name]: MOCK_DANGEROUS_VERIFIER },
      { plannerCalls: 1, toolCalls: 1, capHit: false },
    );
    const after = Date.now();
    const verifiedAt = outcome.evidence[0].verifiedAt;
    expect(verifiedAt).toBeGreaterThanOrEqual(before);
    expect(verifiedAt).toBeLessThanOrEqual(after);
  });
});
