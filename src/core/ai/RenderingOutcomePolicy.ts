import { OUTCOME_WARNING_RENDERER_EVIDENCE_CONTRADICTION as RENDERER_EVIDENCE_CONTRADICTION } from './AgentTurnOutcome';
import type { CompletionEvidence, ToolSideEffect } from './types';

export { RENDERER_EVIDENCE_CONTRADICTION };

/**
 * Blocked render condition (D-11/T-03a-14): the evidence-constrained state
 * of the write being rendered. `none` imposes no constraint; every other
 * condition forbids completion claims and carries a deterministic fallback.
 */
export type RenderBlockedCondition = 'none' | 'no-evidence' | 'unverified' | 'failed';

/**
 * Evidence-derived rendering policy (D-11). Built by the orchestrator
 * before every render; the renderer consumes it but never derives or
 * upgrades evidence itself. Matches evidence by exact operationId and
 * toolCallId. Carries only bounded references and instruction text — never
 * raw evidence checks, tool outputs, secrets, or model-generated text.
 */
export interface RenderingOutcomePolicy {
  operationId: string;
  toolCallId: string;
  toolName: string;
  /** Verified write evidence for the exact toolCallId — completion wording allowed. */
  verifiedCompletionAllowed: boolean;
  /** Submitted-but-unverified evidence — submission-only wording with a caveat. */
  submissionWordingAllowed: boolean;
  /** No verified evidence for the claimed write — completion claims are blocked. */
  completionClaimForbidden: boolean;
  /** Safe references (toolCallIds) of verified evidence for this operation. */
  verifiedReferences: readonly string[];
  /** Safe references (toolCallIds) of unverified evidence for this operation. */
  unverifiedReferences: readonly string[];
  /** Deterministic fallback answer for the blocked condition, or null. */
  fallbackAnswer: string | null;
  /** Bounded instruction appended to the renderer prompt, or null. */
  evidenceSummary: string | null;
  blockedCondition: RenderBlockedCondition;
}

const FALLBACK_ANSWERS: Readonly<Record<Exclude<RenderBlockedCondition, 'none'>, string>> = {
  'no-evidence':
    "I was unable to complete that action — the tool result has no verification record, so I cannot claim it succeeded.",
  unverified: 'The action was submitted, but I could not verify that it completed successfully.',
  failed: 'I could not confirm that the action completed — its postcondition verification failed.',
};

function classifyEvidence(evidence: CompletionEvidence | undefined): RenderBlockedCondition {
  if (!evidence) return 'no-evidence';
  if (evidence.verified) return 'none';
  if (
    evidence.failureReason === 'evidence_unavailable' ||
    evidence.failureReason === 'verification_timeout'
  ) {
    return 'unverified';
  }
  return 'failed';
}

export interface RenderingPolicyInput {
  operationId: string;
  toolCallId: string;
  toolName: string;
  sideEffect: ToolSideEffect;
  evidence: readonly CompletionEvidence[];
}

/**
 * Pure evidence-to-policy derivation (D-11): claims are allowed only when
 * verified evidence matches the exact toolCallId + operationId of the
 * write being rendered. Read/none side effects impose no constraint.
 */
export function buildRenderingOutcomePolicy(input: RenderingPolicyInput): RenderingOutcomePolicy {
  const { operationId, toolCallId, toolName, sideEffect, evidence } = input;
  const claimsWrite = sideEffect === 'write' || sideEffect === 'irreversible';

  const exactEvidence = evidence.find(
    (e) => e.operationId === operationId && e.toolCallId === toolCallId,
  );

  const condition: RenderBlockedCondition = claimsWrite ? classifyEvidence(exactEvidence) : 'none';

  const verifiedReferences = evidence
    .filter((e) => e.operationId === operationId && e.verified)
    .map((e) => e.toolCallId);
  const unverifiedReferences = evidence
    .filter((e) => e.operationId === operationId && !e.verified)
    .map((e) => e.toolCallId);

  const verifiedCompletionAllowed = !claimsWrite || exactEvidence?.verified === true;
  const submissionWordingAllowed = claimsWrite && condition === 'unverified';
  const completionClaimForbidden = claimsWrite && condition !== 'none';

  const fallbackAnswer = completionClaimForbidden
    ? FALLBACK_ANSWERS[condition as Exclude<RenderBlockedCondition, 'none'>]
    : null;

  let evidenceSummary: string | null = null;
  if (completionClaimForbidden) {
    evidenceSummary =
      condition === 'unverified'
        ? `The tool '${toolName}' was submitted but its completion is unverified. You may only describe submission with a caveat; do not claim it completed.`
        : condition === 'no-evidence'
          ? `There is no verification record for tool '${toolName}'. Do not claim it completed.`
          : `Tool '${toolName}' failed postcondition verification. Do not claim it completed.`;
  } else if (claimsWrite) {
    evidenceSummary = `Verified evidence permits completion wording for tool '${toolName}'.`;
  }

  return {
    operationId,
    toolCallId,
    toolName,
    verifiedCompletionAllowed,
    submissionWordingAllowed,
    completionClaimForbidden,
    verifiedReferences,
    unverifiedReferences,
    fallbackAnswer,
    evidenceSummary,
    blockedCondition: condition,
  };
}

export interface EnforcementResult {
  text: string;
  contradicted: boolean;
}

/**
 * Explicit completion-claim patterns (T-03a-14). Detection is intentionally
 * narrow — only these bounded fixtures; the policy never attempts to repair
 * model text or infer new evidence.
 */
const COMPLETION_CLAIM_PATTERNS: readonly RegExp[] = [
  /\bcompleted successfully\b/i,
  /\b(?:saved|created|updated|deleted|executed|performed)\s+successfully\b/i,
  /\bsuccessfully\s+(?:saved|created|updated|deleted|executed|performed|completed)\b/i,
  /\bhas\s+been\s+(?:saved|created|updated|deleted|completed|executed)\b/i,
  /\bI\s+(?:have\s+)?(?:saved|created|updated|deleted|completed|finished)\b/i,
];

/**
 * Deterministic post-render check (T-03a-14): when the policy forbids
 * completion claims and an explicit claim pattern appears, the generated
 * text is replaced by the policy fallback and a contradiction signal is
 * exposed for orchestrator diagnostics. Evidence and outcome are never
 * mutated.
 */
export function enforceRenderingOutcomePolicy(
  generatedText: string,
  policy: RenderingOutcomePolicy,
): EnforcementResult {
  if (!policy.completionClaimForbidden) {
    return { text: generatedText, contradicted: false };
  }
  if (COMPLETION_CLAIM_PATTERNS.some((pattern) => pattern.test(generatedText))) {
    return { text: policy.fallbackAnswer ?? '', contradicted: true };
  }
  return { text: generatedText, contradicted: false };
}
