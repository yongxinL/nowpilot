import { describe, it, expect, vi } from 'vitest';
import type { AgentTurnInput, CompletionEvidence, PlannerDecision } from '../../../src/core/ai/types';
import { PipelineError } from '../../../src/core/ai/PipelineError';
import { createAgentTurnInput } from '../../../src/core/ai/AgentTurnInput';
import {
  buildRenderingOutcomePolicy,
  enforceRenderingOutcomePolicy,
  RENDERER_EVIDENCE_CONTRADICTION,
} from '../../../src/core/ai/RenderingOutcomePolicy';
import type { RenderingPolicyInput } from '../../../src/core/ai/RenderingOutcomePolicy';

function verifiedEvidence(overrides: Partial<CompletionEvidence> = {}): CompletionEvidence {
  return {
    id: 'ev-1',
    operationId: 'op-1',
    toolCallId: 'call-1',
    toolName: 'saveNote',
    verified: true,
    verifierType: 'schema',
    checks: [{ checkId: 'c1', name: 'saved', passed: true, actualRef: 'result:call-1' }],
    verifiedAt: 100,
    durationMs: 5,
    ...overrides,
  } as CompletionEvidence;
}

function unverifiedEvidence(
  failureReason: 'postcondition_failed' | 'evidence_unavailable' | 'verification_timeout' | 'verification_error' | 'aborted',
  retryable: boolean,
  overrides: Partial<CompletionEvidence> = {},
): CompletionEvidence {
  return {
    id: 'ev-2',
    operationId: 'op-1',
    toolCallId: 'call-1',
    toolName: 'saveNote',
    verified: false,
    failureReason,
    retryable,
    verifiedAt: 100,
    durationMs: 5,
    ...overrides,
  } as CompletionEvidence;
}

function policyInput(overrides: Partial<RenderingPolicyInput> = {}): RenderingPolicyInput {
  return {
    operationId: 'op-1',
    toolCallId: 'call-1',
    toolName: 'saveNote',
    sideEffect: 'write',
    evidence: [],
    ...overrides,
  };
}

vi.mock('ai', () => {
  return {
    generateText: vi.fn(),
    streamText: vi.fn(),
    Output: {
      object: vi.fn(),
    },
    isStepCount: vi.fn(),
  };
});

vi.mock('../../../src/core/ai/ProviderRouter', () => {
  return {
    providerRouter: {
      selectProvider: vi.fn((providerId: string) => {
        if (providerId === 'openai') {
          return Promise.resolve({
            adapter: {
              providerId: 'openai' as const,
              createLanguageModel: vi.fn(),
              validateConnection: vi.fn().mockResolvedValue({ ok: true, models: ['gpt-4o-mini'] }),
              supportsStructuredOutput: true,
              getDefaultModelForTier: vi.fn().mockReturnValue('gpt-4o-mini'),
              getCacheStrategy: vi.fn().mockReturnValue('prefix-only'),
              getTelemetryMetadata: vi.fn().mockReturnValue({ provider: 'openai' }),
            },
            providerId: 'openai',
          });
        }
        return Promise.reject(
          new PipelineError(
            'PROVIDER_AUTH',
            `${providerId} is not yet configured. Only OpenAI is available in this version.`,
            { providerId },
          ),
        );
      }),
    },
  };
});

function buildAgentTurnInput(overrides?: Partial<AgentTurnInput>): AgentTurnInput {
  return createAgentTurnInput({
    providerId: 'openai',
    tier: 'FAST',
    model: 'gpt-4o-mini',
    modelContextWindow: 128000,
    userInput: 'Hello, what can you help me with?',
    ...overrides,
  });
}

describe('AI Pipeline Tracer', () => {
  it('should complete a full prompt -> optimize -> plan -> render cycle', async () => {
    const { generateText } = await import('ai');
    const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

    mockGenerateText
      .mockResolvedValueOnce({
        output: { action: 'answer', reasonCode: 'sufficient_info' } as PlannerDecision,
      })
      .mockResolvedValueOnce({
        text: 'Hello! I am here to help you with your questions about note-taking and knowledge management.',
      });

    const input = buildAgentTurnInput();
    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(input);

    expect(outcome.terminalState).toBe('completed');
    expect(outcome.reasonCode).toBe('planner_answer');
    expect(outcome.renderedAnswer).toBeTruthy();
    expect(outcome.renderedAnswer!.length).toBeGreaterThan(0);
    expect(outcome.renderedAnswer).toContain('Hello');
  }, 10000);

  it('should handle an answer decision returning the mocked response', async () => {
    const { generateText } = await import('ai');
    const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

    mockGenerateText
      .mockResolvedValueOnce({
        output: { action: 'answer', reasonCode: 'direct_answer' } as PlannerDecision,
      })
      .mockResolvedValueOnce({
        text: 'I can help you organize your notes and find information quickly.',
      });

    const input = buildAgentTurnInput({ userInput: 'What do you do?' });
    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(input);

    expect(outcome.renderedAnswer).toBe('I can help you organize your notes and find information quickly.');
  }, 10000);

  it('should return a failed outcome for unknown provider', async () => {
    const input = buildAgentTurnInput({ providerId: 'ollama' });
    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');

    const outcome = await agentOrchestrator.runTurn(input);
    expect(outcome.terminalState).toBe('failed');
    expect(outcome.reasonCode).toBe('pipeline_failed');
    expect(outcome.diagnostics.errors).toContain('PROVIDER_AUTH');
    expect(outcome.renderedAnswer).toBeNull();
  }, 10000);
});

describe('RenderingOutcomePolicy', () => {
  it('allows verified completion wording for the exact matching toolCallId', () => {
    const policy = buildRenderingOutcomePolicy(
      policyInput({ evidence: [verifiedEvidence()] }),
    );
    expect(policy.verifiedCompletionAllowed).toBe(true);
    expect(policy.submissionWordingAllowed).toBe(false);
    expect(policy.completionClaimForbidden).toBe(false);
    expect(policy.blockedCondition).toBe('none');
    expect(policy.verifiedReferences).toEqual(['call-1']);
  });

  it('refuses completion wording when verified evidence belongs to a different toolCallId', () => {
    const policy = buildRenderingOutcomePolicy(
      policyInput({ toolCallId: 'call-2', evidence: [verifiedEvidence()] }),
    );
    expect(policy.verifiedCompletionAllowed).toBe(false);
    expect(policy.completionClaimForbidden).toBe(true);
    expect(policy.blockedCondition).toBe('no-evidence');
    expect(policy.fallbackAnswer).not.toBeNull();
  });

  it('refuses completion wording for a different operationId', () => {
    const policy = buildRenderingOutcomePolicy(
      policyInput({ operationId: 'op-2', evidence: [verifiedEvidence()] }),
    );
    expect(policy.verifiedCompletionAllowed).toBe(false);
    expect(policy.completionClaimForbidden).toBe(true);
  });

  it('permits submission-only wording with a caveat for submitted-but-unverified evidence', () => {
    const policy = buildRenderingOutcomePolicy(
      policyInput({ evidence: [unverifiedEvidence('evidence_unavailable', false)] }),
    );
    expect(policy.verifiedCompletionAllowed).toBe(false);
    expect(policy.submissionWordingAllowed).toBe(true);
    expect(policy.completionClaimForbidden).toBe(true);
    expect(policy.blockedCondition).toBe('unverified');
    expect(policy.unverifiedReferences).toEqual(['call-1']);
    expect(policy.evidenceSummary).toContain('unverified');
  });

  it('permits submission-only wording for a retryable verification timeout', () => {
    const policy = buildRenderingOutcomePolicy(
      policyInput({ evidence: [unverifiedEvidence('verification_timeout', true)] }),
    );
    expect(policy.submissionWordingAllowed).toBe(true);
    expect(policy.completionClaimForbidden).toBe(true);
  });

  it('permits no completion claim after failed verification', () => {
    for (const failureReason of ['postcondition_failed', 'verification_error', 'aborted'] as const) {
      const policy = buildRenderingOutcomePolicy(
        policyInput({ evidence: [unverifiedEvidence(failureReason, false)] }),
      );
      expect(policy.verifiedCompletionAllowed).toBe(false);
      expect(policy.submissionWordingAllowed).toBe(false);
      expect(policy.completionClaimForbidden).toBe(true);
      expect(policy.blockedCondition).toBe('failed');
      expect(policy.fallbackAnswer).not.toBeNull();
    }
  });

  it('permits no completion claim when no evidence record exists', () => {
    const policy = buildRenderingOutcomePolicy(policyInput());
    expect(policy.verifiedCompletionAllowed).toBe(false);
    expect(policy.completionClaimForbidden).toBe(true);
    expect(policy.blockedCondition).toBe('no-evidence');
    expect(policy.fallbackAnswer).not.toBeNull();
  });

  it('uses submission wording when mixed evidence verifies a different call', () => {
    const verifiedOther = verifiedEvidence({ toolCallId: 'call-2' });
    const policy = buildRenderingOutcomePolicy({
      ...policyInput(),
      evidence: [verifiedOther, unverifiedEvidence('evidence_unavailable', false)],
    });
    expect(policy.submissionWordingAllowed).toBe(true);
    expect(policy.completionClaimForbidden).toBe(true);
    expect(policy.verifiedReferences).toEqual(['call-2']);
    expect(policy.unverifiedReferences).toEqual(['call-1']);
  });

  it('imposes no constraints for read side effects', () => {
    const policy = buildRenderingOutcomePolicy(
      policyInput({ sideEffect: 'read', evidence: [] }),
    );
    expect(policy.completionClaimForbidden).toBe(false);
    expect(policy.verifiedCompletionAllowed).toBe(true);
    expect(policy.fallbackAnswer).toBeNull();
    expect(policy.evidenceSummary).toBeNull();
  });

  it('imposes no constraints for a verified read result', () => {
    const policy = buildRenderingOutcomePolicy(
      policyInput({ sideEffect: 'read', evidence: [verifiedEvidence()] }),
    );
    expect(policy.completionClaimForbidden).toBe(false);
  });

  it('enforces: replaces a forbidden completion claim with the deterministic fallback', () => {
    const policy = buildRenderingOutcomePolicy(policyInput());
    const result = enforceRenderingOutcomePolicy('I saved the note successfully.', policy);
    expect(result.contradicted).toBe(true);
    expect(result.text).toBe(policy.fallbackAnswer);
    expect(RENDERER_EVIDENCE_CONTRADICTION).toBe('RENDERER_EVIDENCE_CONTRADICTION');
  });

  it('enforces: detects the has-been claim pattern', () => {
    const policy = buildRenderingOutcomePolicy(policyInput());
    const result = enforceRenderingOutcomePolicy('Your note has been saved.', policy);
    expect(result.contradicted).toBe(true);
  });

  it('enforces: leaves safe text untouched when a claim is forbidden', () => {
    const policy = buildRenderingOutcomePolicy(policyInput());
    const result = enforceRenderingOutcomePolicy('I could not complete the action.', policy);
    expect(result.contradicted).toBe(false);
    expect(result.text).toBe('I could not complete the action.');
  });

  it('enforces: never rewrites text when the policy permits claims', () => {
    const policy = buildRenderingOutcomePolicy(
      policyInput({ evidence: [verifiedEvidence()] }),
    );
    const result = enforceRenderingOutcomePolicy('I saved the note successfully.', policy);
    expect(result.contradicted).toBe(false);
    expect(result.text).toBe('I saved the note successfully.');
  });
});
