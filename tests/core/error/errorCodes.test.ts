import { describe, expect, it } from 'vitest';
import {
  DIAGNOSTIC_EVENTS,
  DiagnosticEventSchema,
  ERROR_CODES,
  ErrorCodeSchema,
} from '@/core/error/errorCodes';

describe('error code registry', () => {
  it('contains exactly the approved operational error codes in order', () => {
    expect(ERROR_CODES).toEqual([
      'RUNTIME_ENVELOPE_INVALID',
      'RUNTIME_SENDER_REJECTED',
      'WORKSPACE_INVALID_METADATA',
      'WORKSPACE_OWNERSHIP_AMBIGUOUS',
      'WORKSPACE_EPOCH_MISMATCH',
      'WORKSPACE_VERSION_CONFLICT',
      'WORKSPACE_STALE_MUTATION',
      'WORKSPACE_REHYDRATION_REQUIRED',
      'WORKSPACE_HANDOFF_FAILED',
      'STANDALONE_TAB_INVALID',
      'STANDALONE_OPEN_FAILED',
      'THEME_INVALID_VALUE',
      'THEME_PERSIST_FAILED',
    ]);
  });

  it('is a closed schema that rejects unknown operational codes', () => {
    expect(ErrorCodeSchema.safeParse('RUNTIME_ENVELOPE_INVALID').success).toBe(true);
    expect(ErrorCodeSchema.safeParse('NOT_A_CODE').success).toBe(false);
  });

  it('keeps diagnostic events separate from operational errors', () => {
    expect(DIAGNOSTIC_EVENTS).toEqual(['STANDALONE_ROUTE_FALLBACK']);
    expect(DiagnosticEventSchema.safeParse('STANDALONE_ROUTE_FALLBACK').success).toBe(true);
    expect(ErrorCodeSchema.safeParse('STANDALONE_ROUTE_FALLBACK').success).toBe(false);
    expect(DiagnosticEventSchema.safeParse('RUNTIME_ENVELOPE_INVALID').success).toBe(false);
  });
});
