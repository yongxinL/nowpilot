import { z } from 'zod';
import type { CompletionEvidenceCheck, EvidenceVerifierType, ToolExecutionResult } from '../types';

/**
 * Closed verifier-type union (D-09). VerifierTypes owns the verifier
 * descriptor contract; types.ts keeps the evidence-record field.
 */
export type CompletionVerifierType = EvidenceVerifierType;

/**
 * Strict safe-check schema (T-03a-04/T-03a-10). VerifierTypes is the
 * contract owner for safe checks: unrestricted fields (raw output,
 * secrets) are rejected outright, and bounded message length is enforced.
 * Mirrors the check shape consumed by the outcome evidence schemas.
 */
export const CompletionEvidenceCheckSchema = z
  .object({
    checkId: z.string().min(1),
    name: z.string().min(1),
    passed: z.boolean(),
    expected: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    actualRef: z.string().optional(),
    message: z.string().max(280).optional(),
  })
  .strict();

/**
 * A verifier callback receives the full validated ToolExecutionResult and
 * the shared AbortSignal — never raw transport output — and returns only
 * bounded, schema-safe checks (T-03a-10).
 */
export type VerifierCheck = (
  result: ToolExecutionResult,
  signal?: AbortSignal,
) => Promise<CompletionEvidenceCheck[]>;

/**
 * Closed registry entry (D-08/D-10): a verifier type plus its check
 * callback. The registered descriptor is the extension point — new
 * verifier kinds register here instead of branching inside the verifier.
 */
export interface VerifierRegistry {
  type: CompletionVerifierType;
  check: VerifierCheck;
}

/**
 * Concrete default schema verifier (Plan 02): bounded structural checking
 * for defined object-like results. Produces only safe references and
 * bounded messages — never the result payload.
 */
export const SCHEMA_VERIFIER: VerifierRegistry = {
  type: 'schema',
  check: async (result) => {
    const output = result.output;
    if (output === undefined || output === null) {
      return [
        {
          checkId: 'schema.defined',
          name: 'result is a defined object-like value',
          passed: false,
          message: 'Tool returned no verifiable result.',
        },
      ];
    }
    if (typeof output !== 'object' || Array.isArray(output)) {
      return [
        {
          checkId: 'schema.object-like',
          name: 'result is an object-like value',
          passed: false,
          message: 'Result is not an object-like value.',
        },
      ];
    }
    return [
      {
        checkId: 'schema.object-like',
        name: 'result is a defined object-like value',
        passed: true,
        actualRef: `result:${result.toolCallId}`,
      },
    ];
  },
};
