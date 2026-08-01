/**
 * Freshness policy per D-10: exponential decay with per-source TTLs.
 *
 *   freshness = Math.exp(-ageMs / ttlMs)
 *
 * Hard expiry first: if `expiresAt` has passed, the item is stale (0) —
 * omitted entirely rather than relying on a low decay score. Sources with
 * Infinity TTL (system-authored) never decay. The policy is deterministic,
 * LLM-independent, and fixture-tested.
 *
 * TTL values below are initial policy defaults (D-10, planner-tuned): they
 * are module-level readonly constants, tuned only via code change + test
 * fixture update, never at runtime.
 */
export interface FreshnessTTL {
  ttlMs: number;
}

/** Per-source freshness TTLs (D-10). Keys are prefix/kind/default selectors. */
const TTLS: Record<string, number> = {
  'system': Infinity, // system instructions — never decays
  'tool_schemas': Infinity,
  'preferences': Infinity,
  'persona': Infinity,
  'user_input': 300_000, // 5 minutes
  'memory.fact': 3_600_000, // 1 hour
  'memory.episodic': 1_800_000, // 30 minutes
  'page.current': 120_000, // 2 minutes
  'page.cached': 600_000, // 10 minutes
  'tool_result': 60_000, // 1 minute
  'default': 300_000, // 5 minutes
};

/**
 * Module-level singleton (D-10). The single authority on turn-scoped
 * freshness: compute() returns 0..1 with hard expiry enforced before
 * exponential decay.
 */
export class ContextFreshnessPolicy {
  /**
   * Compute the freshness score for a context source.
   *
   * @param sourceId dot-separated source identifier (e.g. 'memory.user.facts')
   * @param kind    source kind (PromptSection kind or adapter-specific label)
   * @param createdAt epoch-ms creation time; undefined → assume fresh
   * @param expiresAt epoch-ms hard expiry; passed → 0 (stale, per D-10)
   */
  compute(sourceId: string, kind: string, createdAt?: number, expiresAt?: number): number {
    // Hard expiry first (D-10): an expired item is stale regardless of decay.
    if (expiresAt !== undefined && Date.now() >= expiresAt) return 0;

    const ttlMs = this.getTTL(sourceId, kind);
    // Infinity-TTL sources and items without a creation timestamp are fresh.
    if (ttlMs === Infinity || createdAt === undefined) return 1.0;

    const ageMs = Math.max(0, Date.now() - createdAt);
    return Math.exp(-ageMs / ttlMs);
  }

  /**
   * Resolve the TTL for a source: most-specific sourceId prefix first, then
   * kind fallback, then the default. Deterministic — same inputs, same TTL.
   */
  private getTTL(sourceId: string, kind: string): number {
    if (sourceId.startsWith('persona.')) return TTLS['persona'];
    if (sourceId.startsWith('memory.episodic')) return TTLS['memory.episodic'];
    if (sourceId.startsWith('memory.')) return TTLS['memory.fact'];
    if (sourceId.startsWith('context.page.cached')) return TTLS['page.cached'];
    if (sourceId.startsWith('context.page')) return TTLS['page.current'];
    if (sourceId.startsWith('tools.')) return TTLS['tool_result'];
    if (kind in TTLS) return TTLS[kind];
    return TTLS['default'];
  }
}

export const contextFreshnessPolicy = new ContextFreshnessPolicy();
