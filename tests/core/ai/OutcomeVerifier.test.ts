import { describe, it, expect, vi } from 'vitest';
import {
  buildOutcome,
  guardMissingEvidence,
  type Verifier,
} from '../../../src/core/ai/OutcomeVerifier';
import type { ToolExecutionResult } from '../../../src/core/ai/types';

/**
 * OutcomeVerifier contract tests (plan 04-01, Task 2) — §18-required
 * AGT-02/03 Wave-0 tests. Pure unit tests, no chrome mocks, no providers
 * (ExecutorService.test.ts style): the framework is exercised with injected
 * ToolExecutionResults (D-67) and injected verifiers (D-64).
 *
 * Covers: capHit → 'partial' + 'cap_exhausted', never 'completed' (AGT-03);
 * side-effect failure → 'failed' + 'postcondition_failed'; zero-verifier
 * vacuity (D-64); the evidence shape (postconditionId = verifier id,
 * operationId = the input operationId); and the false-completion guard
 * (guardMissingEvidence — the AGT-02 proof, Pitfall 4).
 */

/** Input-builder mirroring ExecutorService.test.ts (D-67 injected-result seam). */
function toolResult(overrides: Partial<ToolExecutionResult> = {}): ToolExecutionResult {
  return {
    toolName: 'fake_tool',
    ok: true,
    data: null,
    error: null,
    durationMs: 10,
    ...overrides,
  };
}

/** A scripted postcondition verifier (D-64 injected fixture — never registered). */
function verifier(id: string, ok: boolean): Verifier {
  return {
    postconditionId: id,
    verify: vi.fn().mockResolvedValue({
      ok,
      detail: ok ? undefined : `postcondition failed for ${id}`,
    }),
  };
}

describe('buildOutcome — O.2 status/reasonCode rules (AGT-02/03)', () => {
  it('caps.capHit true → status partial + reasonCode cap_exhausted — never completed (AGT-03)', async () => {
    const outcome = await buildOutcome(
      'op-verify',
      [toolResult()],
      {},
      { plannerCalls: 3, toolCalls: 2, capHit: true },
    );

    expect(outcome.status).toBe('partial');
    expect(outcome.reasonCode).toBe('cap_exhausted');
    expect(outcome.status).not.toBe('completed');
    expect(outcome.plannerCalls).toBe(3);
    expect(outcome.toolCalls).toBe(2);
  });

  it('a registered verifier whose verify returns {ok:false} → status failed + reasonCode postcondition_failed', async () => {
    const verifiers: Record<string, Verifier> = {
      side_effect: verifier('post-write', false),
    };
    const outcome = await buildOutcome(
      'op-verify',
      [toolResult({ toolName: 'side_effect' })],
      verifiers,
      { plannerCalls: 1, toolCalls: 1, capHit: false },
    );

    expect(outcome.status).toBe('failed');
    expect(outcome.reasonCode).toBe('postcondition_failed');
  });

  it('zero verifiers + ok results → status completed + reasonCode ok + evidence [] (D-64 vacuity)', async () => {
    const outcome = await buildOutcome(
      'op-verify',
      [toolResult(), toolResult({ toolName: 'read_tool' })],
      {},
      { plannerCalls: 1, toolCalls: 2, capHit: false },
    );

    expect(outcome.status).toBe('completed');
    expect(outcome.reasonCode).toBe('ok');
    expect(outcome.evidence).toEqual([]);
    expect(outcome.operationId).toBe('op-verify');
  });

  it('evidence shape: postconditionId = the verifier id, operationId = the input operationId', async () => {
    const verifiers: Record<string, Verifier> = {
      write_note: verifier('post-write-note', true),
    };
    const outcome = await buildOutcome(
      'op-verify',
      [toolResult({ toolName: 'write_note' })],
      verifiers,
      { plannerCalls: 1, toolCalls: 1, capHit: false },
    );

    expect(outcome.evidence).toHaveLength(1);
    const ev = outcome.evidence[0];
    expect(ev).toBeDefined();
    expect(ev!.postconditionId).toBe('post-write-note');
    expect(ev!.operationId).toBe('op-verify');
    expect(ev!.toolName).toBe('write_note');
    expect(ev!.ok).toBe(true);
    expect(typeof ev!.verifiedAt).toBe('number');
  });
});

describe('guardMissingEvidence — the false-completion guard (AGT-02, Pitfall 4)', () => {
  it('returns false for an ok result that carries evidence', () => {
    const results = [
      toolResult({
        toolName: 'side_effect',
        evidence: {
          toolName: 'side_effect',
          operationId: 'op-verify',
          postconditionId: 'post-write',
          ok: true,
          verifiedAt: 1,
        },
      }),
    ];
    const verifiers: Record<string, Verifier> = { side_effect: verifier('post-write', true) };

    expect(guardMissingEvidence(results, verifiers)).toBe(false);
  });

  it('returns true for an ok result with a registered verifier but no evidence — the AGT-02 proof', () => {
    // R-8 "skips the verifier and marks a write done": ok + side-effecting
    // (verifier present) + evidence ABSENT → the guard must flag it so the
    // outcome is never a clean success.
    const results = [toolResult({ toolName: 'side_effect' })];
    const verifiers: Record<string, Verifier> = { side_effect: verifier('post-write', true) };

    expect(guardMissingEvidence(results, verifiers)).toBe(true);
  });

  it('returns false when no verifier is registered for the ok result (read-only tool)', () => {
    const results = [toolResult({ toolName: 'read_tool' })];

    expect(guardMissingEvidence(results, {})).toBe(false);
  });

  it('returns false when the result is not ok (a failure needs no evidence)', () => {
    const results = [toolResult({ toolName: 'side_effect', ok: false })];
    const verifiers: Record<string, Verifier> = { side_effect: verifier('post-write', true) };

    expect(guardMissingEvidence(results, verifiers)).toBe(false);
  });
});