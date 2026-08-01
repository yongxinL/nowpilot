import type { ContextItem, InstructionAuthority, PromptSection, Sensitivity } from '../ai/types';

/**
 * The policy's verdict for one (sourceId, kind) input (D-06/D-07). Trust,
 * sensitivity, and instruction authority are DERIVED from the source type —
 * never self-assigned by source adapters.
 */
export interface TrustAssessment {
  trust: number;
  sensitivity: Sensitivity;
  instructionAuthority: InstructionAuthority;
}

/** Severity order per D-09 — higher index = more restrictive. */
const SENSITIVITY_ORDER: readonly Sensitivity[] = ['public', 'private', 'confidential', 'secret'];

/**
 * Module-level singleton (D-07). The single authority on trust metadata for
 * the whole context pipeline: assess() derives the policy verdict for a
 * source, validate() hard-rejects items that disagree (D-06), and upgrade()
 * composes sensitivities with the most restrictive winning (D-09).
 *
 * Deterministic and LLM-independent — same (sourceId, kind) in, same
 * verdict out, every call, with no caching side-effects.
 */
export class ContextTrustPolicy {
  /**
   * Static source-type table per D-07 (tracer scope): system instructions,
   * user interaction, and data sources (memory, page context, tool output).
   * The full 8-type table lands in Plan 04b-02.
   */
  assess(sourceId: string, kind: PromptSection['kind']): TrustAssessment {
    // System-authored content: highest trust, public, system authority.
    if (
      kind === 'system' ||
      kind === 'tool_schemas' ||
      kind === 'preferences' ||
      sourceId.startsWith('persona.')
    ) {
      return { trust: 1.0, sensitivity: 'public', instructionAuthority: 'system' };
    }
    // Explicit user interaction.
    if (kind === 'user_input') {
      return { trust: 0.9, sensitivity: 'private', instructionAuthority: 'user' };
    }
    // Machine-produced memory content.
    if (kind === 'memory') {
      return { trust: 0.8, sensitivity: 'private', instructionAuthority: 'data' };
    }
    // Page content — untrusted, data authority.
    if (sourceId.startsWith('context.page.')) {
      return { trust: 0.5, sensitivity: 'private', instructionAuthority: 'data' };
    }
    // Tool output — data authority.
    if (sourceId.startsWith('tools.')) {
      return { trust: 0.9, sensitivity: 'private', instructionAuthority: 'data' };
    }
    // Unknown sources get the least trust (D-07 default).
    return { trust: 0.3, sensitivity: 'private', instructionAuthority: 'data' };
  }

  /**
   * D-06 enforcement: an item is valid only when its trust, sensitivity,
   * and instruction authority all match the policy verdict. Any mismatch
   * (e.g. an adapter self-assigning trust 1.0) is rejected — the optimizer
   * validates, never invents.
   */
  validate(item: ContextItem, policy: TrustAssessment): boolean {
    return (
      item.trust === policy.trust &&
      item.sensitivity === policy.sensitivity &&
      item.instructionAuthority === policy.instructionAuthority
    );
  }

  /**
   * Compose two sensitivities: the more restrictive wins (D-09 order:
   * public < private < confidential < secret).
   */
  static upgrade(current: Sensitivity, candidate: Sensitivity): Sensitivity {
    const currentRank = SENSITIVITY_ORDER.indexOf(current);
    const candidateRank = SENSITIVITY_ORDER.indexOf(candidate);
    return candidateRank > currentRank ? candidate : current;
  }
}

export const contextTrustPolicy = new ContextTrustPolicy();
