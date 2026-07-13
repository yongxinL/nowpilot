import { memoryDB } from '../storage/stores/MemoryDB';
import { debugLog } from '../utils/debugLog';
import { miniSearchIndex } from '../search/MiniSearchIndex';
import { memoryScorer } from './MemoryScorer';
import { resolve } from './conflictResolver';
import type { UserMemoryFact, MemoryScore } from './memoryTypes';
import type { ModelContextTier } from '../context/contextTypes';
import { userMemoryFactSchema } from './memoryTypes';

const DEFAULT_SEARCH_LIMIT = 20;
const TOP_N_TIER: Record<ModelContextTier, number> = {
  tiny: 3,
  small: 5,
  medium: 5,
  large: 5,
};

/** Normalize a MemoryDB fact (with optional v2 fields) to a full UserMemoryFact. */
function normalizeFact(f: Record<string, unknown>): UserMemoryFact {
  return {
    id: f.id as string,
    fact: f.fact as string,
    category: f.category as string,
    confidence: (f.confidence as number) ?? 0,
    created: (f.created as number) ?? 0,
    updated: (f.updated as number) ?? 0,
    source: f.source as string,
    status: (f.status as 'active' | 'superseded') ?? 'active',
    tags: (f.tags as string[]) ?? [],
    useCount: (f.useCount as number) ?? 0,
    lastUsedAt: (f.lastUsedAt as number) ?? 0,
  };
}

export class UserMemoryStore {
  constructor() {
    // Populate MiniSearch from existing MemoryDB data on startup
    this.rebuildIndex().catch((err) => {
      debugLog('error', '[UserMemoryStore] constructor rebuildIndex failed', { error: err });
    });
  }

  /**
   * Two-pass retrieval per D-11:
   * Pass 1: MiniSearch narrows to top-20 candidates.
   * Pass 2: MemoryScorer 5-factor scores to top-N (3 for tiny, 5 otherwise).
   */
  async search(query: string, tier: ModelContextTier): Promise<MemoryScore[]> {
    try {
      // Pass 1: MiniSearch narrows to top-20
      const candidates = miniSearchIndex.search(query, DEFAULT_SEARCH_LIMIT);

      // Filter out superseded facts
      const activeCandidates = candidates.filter((c) => (c as Record<string, unknown>).status !== 'superseded');

      if (activeCandidates.length === 0) {
        return [];
      }

      // Pass 2: 5-factor scoring
      const scored: Array<{ fact: UserMemoryFact; finalScore: number }> = [];
      for (const candidate of activeCandidates) {
        // Build matchedTags: tags from the fact that appear in the query
        const queryWords = query.toLowerCase().split(/\s+/);
        const factTags = (candidate as Record<string, unknown>).tags as string[] | undefined;
        const matchedTags =
          factTags?.filter((tag) => queryWords.some((w) => tag.toLowerCase().includes(w))) ?? [];

        const keywordScore = candidate.score;
        const fact = normalizeFact(candidate as Record<string, unknown>);

        const finalScore = memoryScorer.score({ fact, keywordScore }, query, matchedTags);
        scored.push({ fact, finalScore });
      }

      // Tie-break and take top-N
      const sorted = memoryScorer.tieBreak(scored);
      const topN = TOP_N_TIER[tier] ?? 5;
      const top = sorted.slice(0, topN);

      return top.map((s) => ({
        fact: s.fact,
        keywordScore: s.fact.confidence, // approximate: keywordScore from miniSearch
        finalScore: s.finalScore,
      }));
    } catch (err) {
      debugLog('error', '[UserMemoryStore] search failed', { error: err });
      return [];
    }
  }

  /**
   * Upsert a fact through conflict resolution.
   * Validates against userMemoryFactSchema, checks existing active facts,
   * and applies conflictResolver to determine active/superseded status.
   */
  async upsert(fact: Partial<UserMemoryFact> & { fact: string; category: string }): Promise<void> {
    try {
      // Validate and strip unknown fields
      const validated = userMemoryFactSchema.parse(fact);

      // Fetch existing active facts
      const rawFacts = await memoryDB.getAllUserFacts();
      const existingFacts = rawFacts.filter((f) => f.status === 'active').map(normalizeFact);

      // Resolve conflicts
      const resolved = resolve(validated, existingFacts, 1);

      for (const entry of resolved) {
        if (entry.status === 'dropped') continue;

        const resolvedFact = entry.fact as UserMemoryFact;
        await memoryDB.putUserFact(resolvedFact);
        await miniSearchIndex.replaceFact(resolvedFact);
      }
    } catch (err) {
      debugLog('error', '[UserMemoryStore] upsert failed', { error: err });
      throw err;
    }
  }

  /**
   * Get a single fact by ID.
   */
  async getFact(id: string): Promise<UserMemoryFact | undefined> {
    try {
      const rawFacts = await memoryDB.getAllUserFacts();
      const found = rawFacts.find((f) => f.id === id);
      return found ? normalizeFact(found) : undefined;
    } catch (err) {
      debugLog('error', '[UserMemoryStore] getFact failed', { error: err });
      return undefined;
    }
  }

  /**
   * Rebuild MiniSearch index from all active facts in MemoryDB.
   * Called at construction time and can be called externally to sync.
   */
  async rebuildIndex(): Promise<void> {
    try {
      const rawFacts = await memoryDB.getAllUserFacts();
      const activeFacts = rawFacts.filter((f) => f.status === 'active').map(normalizeFact);
      miniSearchIndex.rebuild(activeFacts);
      debugLog('info', '[UserMemoryStore] rebuildIndex complete', { factCount: activeFacts.length });
    } catch (err) {
      debugLog('error', '[UserMemoryStore] rebuildIndex failed', { error: err });
    }
  }

  /**
   * Evict a fact: remove from MiniSearch index and soft-delete in DB.
   * For D-23/D-24 cap/pruning enforcement.
   */
  async evictFact(id: string): Promise<void> {
    try {
      const rawFacts = await memoryDB.getAllUserFacts();
      const raw = rawFacts.find((f) => f.id === id);
      if (!raw) return;
      const fact = normalizeFact(raw);

      miniSearchIndex.removeFact(id);
      await memoryDB.putUserFact({ ...fact, status: 'superseded' });
      debugLog('info', '[UserMemoryStore] evictFact complete', { id });
    } catch (err) {
      debugLog('error', '[UserMemoryStore] evictFact failed', { error: err });
    }
  }
}

export const userMemoryStore = new UserMemoryStore();
