import type { PipelineErrorCode, PipelineErrorCategory } from './types';

const RETRYABLE_CODES: Set<PipelineErrorCode> = new Set([
  'PROVIDER_TIMEOUT',
  'PROVIDER_5XX',
  'NETWORK',
  'RATE_LIMITED',
]);

const CODE_CATEGORY: Record<PipelineErrorCode, PipelineErrorCategory> = {
  PROVIDER_AUTH: 'terminal',
  PROVIDER_TIMEOUT: 'retryable',
  PROVIDER_5XX: 'retryable',
  NETWORK: 'retryable',
  RATE_LIMITED: 'retryable',
  MODEL_UNKNOWN: 'terminal',
  SCHEMA_INVALID: 'terminal',
  NO_SUCH_TOOL: 'terminal',
  INVALID_TOOL_INPUT: 'terminal',
  TIER_CAP_REACHED: 'terminal',
  CIRCUIT_OPEN: 'retryable',
  ABORTED: 'terminal',
  CONTEXT_TOO_LARGE: 'terminal',
  // Phase 3a canonical Rev. C technical codes — all terminal. These are
  // technical diagnostics owned by PipelineError (D-12); they are NOT
  // AgentTurnReasonCode values.
  AGENT_STATE_INVALID: 'terminal',
  TOOL_POSTCONDITION_FAILED: 'terminal',
  COMPLETION_EVIDENCE_MISSING: 'terminal',
  TOOL_IDEMPOTENCY_CONFLICT: 'terminal',
  UNKNOWN: 'terminal',
};

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly category: PipelineErrorCategory;
  readonly retryable: boolean;
  readonly userFacingMessage: string;
  readonly diagnostic?: Record<string, unknown>;
  readonly timestamp: number;

  constructor(code: PipelineErrorCode, userFacingMessage: string, diagnostic?: Record<string, unknown>) {
    super(`[${code}] ${userFacingMessage}`);
    this.name = 'PipelineError';
    this.code = code;
    this.category = CODE_CATEGORY[code];
    this.retryable = this.category === 'retryable';
    this.userFacingMessage = userFacingMessage;
    this.diagnostic = diagnostic;
    this.timestamp = Date.now();
  }

  static isRetryable(error: PipelineError): boolean {
    return RETRYABLE_CODES.has(error.code);
  }
}

/**
 * Code-allowlisted public diagnostic projection (Phase 3a). Preserves the
 * technical classification (code, category, retryable, timestamp) and a
 * bounded user-facing message while deliberately dropping the raw Error
 * message, diagnostic metadata (raw input/output, arbitrary exception
 * text, secrets), and logical idempotency keys before a PipelineError
 * enters public outcome diagnostics.
 */
export interface PipelineErrorProjection {
  code: PipelineErrorCode;
  category: PipelineErrorCategory;
  retryable: boolean;
  message: string;
  timestamp: number;
}

const SAFE_MESSAGE_MAX_LENGTH = 280;

export function projectPipelineError(error: PipelineError): PipelineErrorProjection {
  const raw = error.userFacingMessage ?? `[${error.code}]`;
  const message = raw.length > SAFE_MESSAGE_MAX_LENGTH ? `${raw.slice(0, SAFE_MESSAGE_MAX_LENGTH)}…` : raw;
  return {
    code: error.code,
    category: error.category,
    retryable: error.retryable,
    message,
    timestamp: error.timestamp,
  };
}
