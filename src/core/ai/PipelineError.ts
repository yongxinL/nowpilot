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
