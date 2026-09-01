// WorkingMemory — D-104 Appendix O.10 working-memory block
// (PRODUCT_SPEC_v0_1.md:6596-6622), verbatim.
//
// Budget-capped (MAX_WORKING_MEMORY_TOKENS = 300), single-writer-gated,
// redacted markdown block. The type + template are canonical at @/types/harness
// (Appendix C.1, spec 4839). Redaction uses the Phase-2 redactSensitiveValue
// primitive with a documented Phase-11 swap point (Pitfall 1: TraceRedactor
// does not exist yet).
import { WORKING_MEMORY_TEMPLATE, type WorkingMemory } from '@/types/harness';
import { redactSensitiveValue } from '../security/redactSensitive';
import { isPrimaryWriter } from '../workspace/WorkspaceStore';
import { debugLog } from '../log/debugLog';

/** §3.6 verbatim: working-memory block cap = 300 tokens. */
export const MAX_WORKING_MEMORY_TOKENS = 300;

/** Token estimate — same len/4 heuristic as countTokensHeuristic. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Truncate markdown to ≤ maxTokens (rough char-based truncation). */
function truncateToTokens(md: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (md.length <= maxChars) return md;
  return md.slice(0, maxChars);
}

/** The editable fields in the working-memory template. */
type WorkingMemoryField = 'Name' | 'Role / Team' | 'Environment' | 'Preferences' | 'Long-term Goals';

const WORKING_MEMORY_FIELDS: WorkingMemoryField[] = [
  'Name',
  'Role / Team',
  'Environment',
  'Preferences',
  'Long-term Goals',
];

/**
 * Initialize a working-memory block from the §3.6 template.
 * @param resourceId — the resource this block is attached to.
 */
export function initWorkingMemory(resourceId: string): WorkingMemory {
  return {
    resourceId,
    markdown: WORKING_MEMORY_TEMPLATE,
    tokens: estimateTokens(WORKING_MEMORY_TEMPLATE),
    updatedAt: Date.now(),
  };
}

/**
 * Update a working-memory block with field replacements. Each value is
 * redacted BEFORE the markdown replace (§4.4 never store secrets). The
 * block is re-estimated and truncated to ≤ MAX_WORKING_MEMORY_TOKENS.
 * Single-writer gated: non-primary update returns cur unchanged.
 *
 * @param cur   — current working-memory block.
 * @param patch — partial field replacements (field name → value).
 */
export function updateWorkingMemory(
  cur: WorkingMemory,
  patch: Partial<Record<WorkingMemoryField, string>>,
): WorkingMemory {
  if (!isPrimaryWriter()) {
    debugLog('WORKING_MEMORY_NON_PRIMARY_SKIP', 'updateWorkingMemory skipped — non-primary surface', {
      resourceId: cur.resourceId,
    });
    return cur;
  }

  let md = cur.markdown;
  for (const field of WORKING_MEMORY_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    // Redact BEFORE the markdown replace (never store secrets — §4.4).
    // TODO(Phase 11): swap to TraceRedactor (Pitfall 1: module does not exist yet).
    const safe = redactSensitiveValue(value) as string;
    // Replace the line: "- **Field**: <value>" → "- **Field**: <safe>".
    const re = new RegExp(`(- \\*\\*${field}\\*\\*:).*`, 'g');
    md = md.replace(re, `$1 ${safe}`);
  }

  // Re-estimate + truncate to cap.
  let tokens = estimateTokens(md);
  if (tokens > MAX_WORKING_MEMORY_TOKENS) {
    md = truncateToTokens(md, MAX_WORKING_MEMORY_TOKENS);
    tokens = estimateTokens(md);
  }

  return {
    resourceId: cur.resourceId,
    markdown: md,
    tokens,
    updatedAt: Date.now(),
  };
}

// --- Test seam --------------------------------------------------------------

export const __test__ = {
  /** Expose estimateTokens for assertions. */
  estimateTokens,
  /** Expose truncateToTokens for assertions. */
  truncateToTokens,
};
