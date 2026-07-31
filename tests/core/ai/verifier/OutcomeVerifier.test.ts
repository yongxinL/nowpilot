import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  OutcomeVerifier,
  outcomeVerifier,
  OUTCOME_VERIFIER_TIMEOUT_MS,
  OUTCOME_VERIFIER_EVIDENCE_MISSING_DIAGNOSTIC,
} from '../../../src/core/ai/verifier/OutcomeVerifier';
import { SCHEMA_VERIFIER, type VerifierCheck, type VerifierRegistry } from '../../../src/core/ai/verifier/VerifierTypes';
import type { CompletionEvidence, RegisteredTool, ToolExecutionResult } from '../../../src/core/ai/types';

const OP_ID = 'op-verify-001';
const TOOL_CALL_ID = 'call-0001';
const TOOL_NAME = 'createNote';

function buildTool(overrides: Partial<RegisteredTool> = {}): RegisteredTool {
  return {
    name: TOOL_NAME,
    description: 'Creates a note',
    inputSchema: {},
    execute: vi.fn(async () => ({ noteId: 'note-123' })),
    sideEffect: 'write',
    idempotency: 'required',
    ...overrides,
  };
}

function buildResult(overrides: Partial<ToolExecutionResult> = {}): ToolExecutionResult {
  return {
    toolName: TOOL_NAME,
    output: { noteId: 'note-123' },
    durationMs: 12,
    toolCallId: TOOL_CALL_ID,
    ...overrides,
  };
}

function verifierOf(impl: VerifierCheck, type: VerifierRegistry['type'] = 'schema'): VerifierRegistry {
  return { type, check: impl };
}

function passingCheck(overrides: Partial<NonNullable<CompletionEvidence['checks']>[number]> = {}) {
  return {
    checkId: 'c1',
    name: 'postcondition holds',
    passed: true,
    actualRef: `note:${TOOL_CALL_ID}`,
    ...overrides,
  };
}

describe('OutcomeVerifier', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces verified evidence with exact IDs, safe checks, result reference, timestamp, and duration for a successful required verifier', async () => {
    const captured: ToolExecutionResult[] = [];
    const verifier = verifierOf(async (result) => {
      captured.push(result);
      return [passingCheck()];
    });
    const tool = buildTool({ evidence: { required: true, verifier } });

    const evidence = await outcomeVerifier.verify(buildResult(), tool, OP_ID);

    expect(evidence.verified).toBe(true);
    expect(evidence.operationId).toBe(OP_ID);
    expect(evidence.toolCallId).toBe(TOOL_CALL_ID);
    expect(evidence.toolName).toBe(TOOL_NAME);
    expect(evidence.verifierType).toBe('schema');
    expect(evidence.checks).toHaveLength(1);
    expect(evidence.checks[0].passed).toBe(true);
    expect(evidence.resultRef).toEqual({ type: 'schema', ref: TOOL_CALL_ID });
    expect(typeof evidence.id).toBe('string');
    expect(evidence.id.length).toBeGreaterThan(0);
    expect(evidence.verifiedAt).toBeGreaterThanOrEqual(0);
    expect(evidence.durationMs).toBeGreaterThanOrEqual(0);

    // The verifier callback receives the full validated tool result, not raw output.
    expect(captured).toHaveLength(1);
    expect(captured[0].toolCallId).toBe(TOOL_CALL_ID);
    expect(captured[0].toolName).toBe(TOOL_NAME);
  });

  it('routes the verifier type from the registered descriptor into the evidence', async () => {
    const verifier = verifierOf(async () => [passingCheck()], 'read-after-write');
    const tool = buildTool({ evidence: { required: true, verifier } });

    const evidence = await outcomeVerifier.verify(buildResult(), tool, OP_ID);

    expect(evidence.verified).toBe(true);
    if (evidence.verified) {
      expect(evidence.verifierType).toBe('read-after-write');
    }
  });

  it('supplies concrete default schema checking for defined object-like results via the shared SCHEMA_VERIFIER', async () => {
    const tool = buildTool({ evidence: { required: true, verifier: SCHEMA_VERIFIER } });
    const evidence = await outcomeVerifier.verify(buildResult(), tool, OP_ID);

    expect(evidence.verified).toBe(true);
    if (evidence.verified) {
      expect(evidence.verifierType).toBe('schema');
      expect(evidence.checks.some((c) => c.passed)).toBe(true);
      // Only bounded references are stored — never the raw output payload.
      expect(JSON.stringify(evidence)).not.toContain('note-123');
    }
  });

  it('returns unverified evidence_unavailable (not verified) for a required write tool with no declared verifier, with the COMPLETION_EVIDENCE_MISSING diagnostic hook', async () => {
    const tool = buildTool({ evidence: { required: true } });

    const evidence = await outcomeVerifier.verify(buildResult(), tool, OP_ID);

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('evidence_unavailable');
      expect(evidence.retryable).toBe(false);
      expect(evidence.operationId).toBe(OP_ID);
      expect(evidence.toolCallId).toBe(TOOL_CALL_ID);
      expect(evidence.toolName).toBe(TOOL_NAME);
    }
    expect(OUTCOME_VERIFIER_EVIDENCE_MISSING_DIAGNOSTIC).toBe('COMPLETION_EVIDENCE_MISSING');
  });

  it('returns unverified evidence_unavailable for a missing toolCallId', async () => {
    const verifier = verifierOf(async () => [passingCheck()]);
    const tool = buildTool({ evidence: { required: true, verifier } });

    const evidence = await outcomeVerifier.verify(buildResult({ toolCallId: '' }), tool, OP_ID);

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('evidence_unavailable');
      expect(evidence.retryable).toBe(false);
    }
  });

  it('returns unverified postcondition_failed when a check fails', async () => {
    const verifier = verifierOf(async () => [{ checkId: 'c1', name: 'postcondition holds', passed: false, message: 'Note was not created' }]);
    const tool = buildTool({ evidence: { required: true, verifier } });

    const evidence = await outcomeVerifier.verify(buildResult(), tool, OP_ID);

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('postcondition_failed');
      expect(evidence.retryable).toBe(false);
    }
  });

  it('returns unverified verification_error when the verifier callback throws', async () => {
    const verifier = verifierOf(async () => {
      throw new Error('verifier exploded');
    });
    const tool = buildTool({ evidence: { required: true, verifier } });

    const evidence = await outcomeVerifier.verify(buildResult(), tool, OP_ID);

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('verification_error');
      expect(evidence.retryable).toBe(false);
      // No raw exception text may leak into the evidence record.
      expect(JSON.stringify(evidence)).not.toContain('exploded');
    }
  });

  it('returns unverified verification_timeout with retry permission when the verifier exceeds the five-second bound', async () => {
    vi.useFakeTimers();
    const never = new Promise<never>(() => {});
    const verifier = verifierOf(() => never);
    const tool = buildTool({ evidence: { required: true, verifier } });

    const pending = outcomeVerifier.verify(buildResult(), tool, OP_ID);
    await vi.advanceTimersByTimeAsync(OUTCOME_VERIFIER_TIMEOUT_MS + 10);
    const evidence = await pending;

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('verification_timeout');
      expect(evidence.retryable).toBe(true);
    }
  });

  it('returns unverified aborted (no retry permission) when the shared signal is already aborted', async () => {
    const verifier = verifierOf(async () => [passingCheck()]);
    const tool = buildTool({ evidence: { required: true, verifier } });
    const controller = new AbortController();
    controller.abort();

    const evidence = await outcomeVerifier.verify(buildResult(), tool, OP_ID, controller.signal);

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('aborted');
      expect(evidence.retryable).toBe(false);
    }
  });

  it('returns unverified aborted when the verifier callback throws an AbortError', async () => {
    const verifier = verifierOf(async () => {
      const err = new Error('aborted') as Error & { name: string };
      err.name = 'AbortError';
      throw err;
    });
    const tool = buildTool({ evidence: { required: true, verifier } });

    const evidence = await outcomeVerifier.verify(buildResult(), tool, OP_ID);

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('aborted');
      expect(evidence.retryable).toBe(false);
    }
  });

  it('returns unverified aborted when the signal aborts while verification is in flight', async () => {
    let release: (checks: NonNullable<CompletionEvidence['checks']>) => void = () => {};
    const deferred = new Promise<NonNullable<CompletionEvidence['checks']>>((resolve) => {
      release = resolve;
    });
    const verifier = verifierOf(() => deferred);
    const tool = buildTool({ evidence: { required: true, verifier } });
    const controller = new AbortController();

    const pending = outcomeVerifier.verify(buildResult(), tool, OP_ID, controller.signal);
    controller.abort();
    release([passingCheck()]);
    const evidence = await pending;

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('aborted');
      expect(evidence.retryable).toBe(false);
    }
  });

  it('rejects unsafe checks (unrestricted raw output fields) as verification_error', async () => {
    const verifier = verifierOf(async () => [
      {
        checkId: 'c1',
        name: 'postcondition holds',
        passed: true,
        rawOutput: { fullResponse: 'confidential tool payload' },
      },
    ] as never);
    const tool = buildTool({ evidence: { required: true, verifier } });

    const evidence = await outcomeVerifier.verify(buildResult(), tool, OP_ID);

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('verification_error');
      expect(evidence.retryable).toBe(false);
      expect(JSON.stringify(evidence)).not.toContain('confidential');
    }
  });

  it('rejects key-like strings in check fields as verification_error (redaction-safe)', async () => {
    const verifier = verifierOf(async () => [
      { checkId: 'c1', name: 'postcondition holds', passed: true, message: 'used api key sk-abc123def456ghi789' },
    ]);
    const tool = buildTool({ evidence: { required: true, verifier } });

    const evidence = await outcomeVerifier.verify(buildResult(), tool, OP_ID);

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('verification_error');
      expect(JSON.stringify(evidence)).not.toContain('sk-abc123def456ghi789');
    }
  });

  it('never grants implicit verification to side-effecting tools even when tool-provided evidence is attached and the policy is not required', async () => {
    const attached: CompletionEvidence = {
      id: 'e-provided',
      operationId: OP_ID,
      toolCallId: TOOL_CALL_ID,
      toolName: TOOL_NAME,
      verified: true,
      verifierType: 'tool-provided',
      checks: [],
      verifiedAt: 1,
      durationMs: 1,
    };
    const tool = buildTool({ sideEffect: 'write', evidence: { required: false } });

    const evidence = await outcomeVerifier.verify(buildResult({ evidence: attached }), tool, OP_ID);

    expect(evidence.verified).toBe(false);
    if (!evidence.verified) {
      expect(evidence.failureReason).toBe('evidence_unavailable');
      expect(evidence.retryable).toBe(false);
    }
  });

  it('reuses validated tool-provided evidence for a non-side-effecting result whose policy does not require a postcondition', async () => {
    const attached: CompletionEvidence = {
      id: 'e-provided',
      operationId: OP_ID,
      toolCallId: TOOL_CALL_ID,
      toolName: TOOL_NAME,
      verified: true,
      verifierType: 'tool-provided',
      checks: [],
      verifiedAt: 1,
      durationMs: 1,
    };
    const tool = buildTool({ sideEffect: 'read', evidence: { required: false } });

    const evidence = await outcomeVerifier.verify(buildResult({ evidence: attached }), tool, OP_ID);

    expect(evidence.verified).toBe(true);
    expect(evidence.toolCallId).toBe(TOOL_CALL_ID);
  });

  it('never stores raw tool output in any evidence variant', async () => {
    const verifier = verifierOf(async () => [passingCheck()]);
    const tool = buildTool({ evidence: { required: true, verifier } });
    const result = buildResult({ output: { apiKey: 'sk-super-secret-9999', body: 'full raw response text' } });

    const evidence = await outcomeVerifier.verify(result, tool, OP_ID);

    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain('sk-super-secret-9999');
    expect(serialized).not.toContain('full raw response text');
  });

  it('exports the class and the singleton named in the artifacts list', () => {
    expect(typeof OutcomeVerifier).toBe('function');
    expect(outcomeVerifier).toBeInstanceOf(OutcomeVerifier);
  });
});
