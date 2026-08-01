import type { ContextItem, ToolExecutionResult } from './types';
import { redactSensitive } from '../security/redactSensitive';
import { contextTrustPolicy } from '../context/ContextTrustPolicy';

/**
 * Maximum character length of a shaped tool-result text before truncation
 * (TOL-04). 32,000 chars ≈ 8K tokens at the char/4 estimator — generous for
 * real tool output, bounded enough to protect the context budget.
 */
export const MAX_TOOL_RESULT_CHARS = 32_000;

/**
 * Standalone service between ExecutorService and ContextOptimizer (D-05,
 * TOL-04). Every tool result passes through shape() before re-entering the
 * context pipeline: secrets are redacted at the boundary, oversized outputs
 * are truncated, provenance is assigned from the tool name, and trust
 * metadata comes exclusively from ContextTrustPolicy (D-06 — never
 * self-assigned).
 *
 * Immutability contract (D-05): shape() never writes to the input
 * ToolExecutionResult. Strings are primitives (immutable by value); objects
 * are serialized via JSON.stringify, which only reads. A brand-new
 * ContextItem is always returned.
 */
export class ToolResultShaper {
  /**
   * Shape a validated tool execution result into a ContextItem, or null if
   * the policy verdict is 'secret' sensitivity (D-09 guard — secret items
   * must never become ContextItem instances).
   */
  shape(result: ToolExecutionResult): ContextItem | null {
    // a. Convert output to text — strings pass through, objects serialize.
    const rawText =
      typeof result.output === 'string' ? result.output : JSON.stringify(result.output);

    // b. Redact secrets FIRST — nothing else may touch the raw text
    // (T-04b-09: redaction is the first processing step).
    const redacted = redactSensitive(rawText);

    // c. Size limit (TOL-04): truncate with an explicit marker appended.
    const text =
      redacted.length > MAX_TOOL_RESULT_CHARS
        ? redacted.slice(0, MAX_TOOL_RESULT_CHARS) + '\n[truncated]'
        : redacted;

    // d. Assign provenance — dot-separated hierarchical sourceId (D-18):
    // tools.builtin.{toolName} is valid per isValidSourceId for any
    // alphanumeric/dash/underscore tool name.
    const sourceId = `tools.builtin.${result.toolName}`;

    // e. Assign trust — ContextTrustPolicy is the sole authority (D-06);
    // the policy verdict for tools.* is { trust: 0.9, sensitivity:
    // 'private', instructionAuthority: 'data' }. Tool output can never
    // self-assign trust (T-04b-12).
    const policy = contextTrustPolicy.assess(sourceId, 'context');

    // f. D-09 guard: if the policy ever classifies this source as 'secret',
    // no ContextItem is created. (With the current policy redaction already
    // replaced secrets with placeholders, so the text below carries no raw
    // secrets — this guard covers future policy classifications.)
    if (policy.sensitivity === 'secret') {
      return null;
    }

    // g. Construct the immutable ContextItem (D-05). tokens uses the
    // project-standard char/4 estimator (D-10).
    return {
      kind: 'context',
      text,
      tokens: Math.ceil(text.length / 4),
      stable: false,
      sourceId,
      relevance: 1.0,
      freshness: 1.0,
      trust: policy.trust,
      sensitivity: policy.sensitivity,
      instructionAuthority: policy.instructionAuthority,
      createdAt: Date.now(),
    };
  }
}

/** Module-level singleton (consistent with contextTrustPolicy / D-07). */
export const toolResultShaper = new ToolResultShaper();
