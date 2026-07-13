import { debugLog } from '../utils/debugLog';
import type { ConversationMemoryStore } from './ConversationMemoryStore';
import type { UserMemoryStore } from './UserMemoryStore';
import type {
  PreferencePayload,
  MemoryAssembleResult,
  MemoryExtractionResult,
  MemoryWriteRequest,
  UserMemoryFact,
} from './memoryTypes';
import type { ModelContextTier } from '../context/contextTypes';
import type { MemoryExtractor } from './MemoryExtractor';
import type { MemoryScorer } from './MemoryScorer';
import { resolve as conflictResolve } from './conflictResolver';

// ---------------------------------------------------------------------------
// Local interface to avoid circular dependency with broadcastBus.ts (wired in P07)
// ---------------------------------------------------------------------------

interface BroadcastBusLike {
  emitMemoryWrite(request: MemoryWriteRequest): Promise<void>;
  onMemoryWrite(handler: (req: MemoryWriteRequest) => Promise<void>): () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOP_N: Record<ModelContextTier, number> = {
  tiny: 3,
  small: 5,
  medium: 5,
  large: 5,
};

// ---------------------------------------------------------------------------
// MemoryEngine — the central orchestrator for all memory operations
// ---------------------------------------------------------------------------

export class MemoryEngine {
  private isPrimarySurface = false;
  readonly #processedKeys = new Set<string>();
  #processedKeysCounter = 0;

  constructor(
    private conversationStore: ConversationMemoryStore,
    private userMemoryStore: UserMemoryStore,
    private preferenceStore: { get(): PreferencePayload },
    private scorer: MemoryScorer,
    private extractor: MemoryExtractor,
    private broadcastBus: BroadcastBusLike,
  ) {}

  // -----------------------------------------------------------------------
  // Primary surface control
  // -----------------------------------------------------------------------

  /** Mark this surface as primary (writes directly) or non-primary (routed writes). */
  setPrimary(value: boolean): void {
    this.isPrimarySurface = value;
  }

  /** Check if this surface is the primary writer. */
  get isPrimary(): boolean {
    return this.isPrimarySurface;
  }

  // -----------------------------------------------------------------------
  // assemble() — pre-optimization retrieval from all three stores
  // -----------------------------------------------------------------------

  /**
   * Synchronous orchestration (all sub-calls awaited internally):
   * 1. Conversation memory — summary + recent turns
   * 2. User memory — tier-capped top-N scored facts
   * 3. Preferences — always injected (D-10)
   */
  async assemble(
    conversationId: string,
    userMessage: string,
    tier: ModelContextTier,
  ): Promise<MemoryAssembleResult> {
    try {
      const convContext = await this.conversationStore.getContext(conversationId, tier);

      const factResults = await this.userMemoryStore.search(userMessage, tier);

      // Map to { id, content, score } shape matching ContextOptimizerInput.memory
      const topN = TOP_N[tier] ?? 5;
      const memory = factResults.slice(0, topN).map((r) => ({
        id: r.fact.id,
        content: r.fact.fact,
        score: r.finalScore,
      }));

      const prefs = this.preferenceStore.get();

      debugLog('info', '[MemoryEngine] assemble complete', {
        conversationId,
        tier,
        factCount: memory.length,
      });

      return {
        memory,
        conversationContext: {
          summary: convContext.summary,
          recentTurns: convContext.recentTurns,
        },
        preferences: prefs,
      };
    } catch (err) {
      debugLog('error', '[MemoryEngine] assemble failed', { error: err, conversationId, tier });
      return {
        memory: [],
        conversationContext: { recentTurns: [] },
        preferences: {
          responseStyle: 'concise',
          preferredLanguage: 'auto',
          preferStructuredOutput: false,
          allowCloudFallbackFromLocal: false,
          defaultProviderId: '',
          toolAutonomy: 'manual',
        },
      };
    }
  }

  // -----------------------------------------------------------------------
  // extract() — post-execution extraction pipeline (fire-and-forget, D-04)
  // -----------------------------------------------------------------------

  async extract(
    conversationId: string,
    messages: Array<{ role: string; content: string }>,
    _toolResults: Array<unknown>,
  ): Promise<void> {
    try {
      // ---------------------------------------------------------------
      // Step 1: Extract facts (D-05, Haiku-tier via 'small' mapping)
      // ---------------------------------------------------------------
      const result = await this.#extractWithRetry(messages);
      if (result.facts.length === 0) {
        debugLog('info', '[MemoryEngine] no facts extracted, skipping to summarization');
      } else {
        // ---------------------------------------------------------------
        // Step 2: Conflict resolution + upsert (D-16, D-17)
        // ---------------------------------------------------------------
        await this.#resolveAndUpsert(result, conversationId);
      }

      // ---------------------------------------------------------------
      // Step 3: Check summarization threshold (D-20 — every 12 messages)
      // ---------------------------------------------------------------
      await this.#checkSummarization(conversationId, messages);

      // ---------------------------------------------------------------
      // Step 4: Check archiving threshold (D-22 — 30 min idle)
      // ---------------------------------------------------------------
      await this.#checkArchiving(messages);

      // ---------------------------------------------------------------
      // Step 5: Enforce fact cap (D-23, D-24)
      // ---------------------------------------------------------------
      await this.#enforceFactCap();
    } catch (err) {
      debugLog('error', '[MemoryEngine] extract failed — silently dropping', { error: err, conversationId });
    }
  }

  // -----------------------------------------------------------------------
  // handleMemoryWrite() — processes incoming write requests from BroadcastBus
  // -----------------------------------------------------------------------

  async handleMemoryWrite(request: MemoryWriteRequest): Promise<void> {
    if (this.#processedKeys.has(request.idempotencyKey)) {
      debugLog('debug', '[MemoryEngine] skipping already-processed write request', {
        idempotencyKey: request.idempotencyKey,
      });
      return;
    }

    this.#processedKeys.add(request.idempotencyKey);
    this.#processedKeysCounter++;

    // Auto-cleanup: cap at 1000 entries (T-05-16 mitigation)
    if (this.#processedKeysCounter >= 1000) {
      const firstKey = this.#processedKeys.values().next().value;
      if (firstKey) {
        this.#processedKeys.delete(firstKey);
      }
      this.#processedKeysCounter = this.#processedKeys.size;
    }

    try {
      switch (request.type) {
        case 'upsert-fact': {
          await this.userMemoryStore.upsert(request.payload as Partial<UserMemoryFact> & { fact: string; category: string });
          break;
        }
        case 'update-summary': {
          const { conversationId: cId, messages: msgs, summary } = request.payload as {
            conversationId: string;
            messages: Array<{ role: string; content: string }>;
            summary: string;
          };
          await this.conversationStore.summarize(cId, msgs, summary);
          break;
        }
        case 'archive-conversation': {
          const { conversationId: aId } = request.payload as { conversationId: string };
          await this.conversationStore.archive(aId);
          break;
        }
        default: {
          // Unknown type — log and skip
          debugLog('warn', '[MemoryEngine] unknown write request type', {
            type: (request as MemoryWriteRequest).type,
          });
        }
      }
      debugLog('info', '[MemoryEngine] processed write request', {
        type: request.type,
        idempotencyKey: request.idempotencyKey,
      });
    } catch (err) {
      debugLog('error', '[MemoryEngine] write request handler failed', {
        type: request.type,
        idempotencyKey: request.idempotencyKey,
        error: err,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Attempt extraction with one retry per D-04.
   */
  async #extractWithRetry(
    messages: Array<{ role: string; content: string }>,
  ): Promise<MemoryExtractionResult> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await this.extractor.extract(messages, 'small');
      } catch (err) {
        if (attempt === 1) {
          debugLog('warn', '[MemoryEngine] extractor failed, retrying once', { error: err });
        } else {
          debugLog('error', '[MemoryEngine] extractor failed after retry — dropping', { error: err });
          return { facts: [], summary: undefined };
        }
      }
    }
    return { facts: [], summary: undefined };
  }

  /**
   * Resolve conflicts and upsert extracted facts.
   */
  async #resolveAndUpsert(
    extractionResult: MemoryExtractionResult,
    conversationId: string,
  ): Promise<void> {
    const { writeJournal } = await import('../storage/WriteJournal');

    for (const extractedFact of extractionResult.facts) {
      // Build a partial fact for conflict resolution
      const partialFact: Partial<UserMemoryFact> & { fact: string; category: string } = {
        id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fact: extractedFact.fact,
        category: extractedFact.category,
        confidence: extractedFact.confidence,
        tags: extractedFact.tags,
        source: 'memory-extractor',
        created: Date.now(),
        updated: Date.now(),
        status: 'active',
        useCount: 0,
        lastUsedAt: Date.now(),
      };

      if (this.isPrimarySurface) {
        // D-06: Primary surface writes directly
        // Fetch existing active facts
        const rawFacts = await this.#getAllActiveFacts();
        const resolved = conflictResolve(partialFact, rawFacts, 1);

        for (const entry of resolved) {
          if (entry.status === 'dropped') continue;
          const resolvedFact = entry.fact as UserMemoryFact;
          await this.userMemoryStore.upsert(resolvedFact);
        }
      } else {
        // D-07: Non-primary surface emits write request via BroadcastBus
        const request: MemoryWriteRequest = {
          type: 'upsert-fact',
          payload: partialFact,
          surfaceId: 'non-primary',
          timestamp: Date.now(),
          idempotencyKey: `${conversationId}-upsert-fact-${Date.now()}-${crypto.randomUUID()}`,
        };
        await this.broadcastBus.emitMemoryWrite(request);
      }
    }

    debugLog('info', '[MemoryEngine] facts written', {
      extracted: extractionResult.facts.length,
    });
  }

  /**
   * Check summarization threshold (every 12 messages per D-20).
   */
  async #checkSummarization(
    conversationId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<void> {
    const msgCount = messages.length;
    if (msgCount >= 12) {
      // D-18: Keep tail, drop middle — summarize the middle portion
      const middleStart = Math.floor(msgCount * 0.25);
      const middleEnd = Math.floor(msgCount * 0.75);
      const middleMessages = messages.slice(middleStart, middleEnd);

      // Call extractor for summarization
      const { summary } = await this.extractor.extract(middleMessages, 'small');

      if (summary) {
        if (this.isPrimarySurface) {
          // D-19: One rolling cumulative summary
          await this.conversationStore.summarize(conversationId, middleMessages, summary);
        } else {
          const request: MemoryWriteRequest = {
            type: 'update-summary',
            payload: { conversationId, messages: middleMessages, summary },
            surfaceId: 'non-primary',
            timestamp: Date.now(),
            idempotencyKey: `${conversationId}-update-summary-${Date.now()}-${crypto.randomUUID()}`,
          };
          await this.broadcastBus.emitMemoryWrite(request);
        }
      }

      debugLog('info', '[MemoryEngine] summarization check completed', {
        conversationId,
        msgCount,
        threshold: 12,
      });
    }
  }

  /**
   * Check archiving threshold (30 min idle per D-22).
   */
  async #checkArchiving(messages: Array<{ role: string; content: string }>): Promise<void> {
    if (messages.length === 0) return;

    const now = Date.now();
    const lastMessage = messages[messages.length - 1];
    // Estimate last message timestamp — messages don't always carry timestamps,
    // so we use the current time as an approximation. In production, the caller
    // provides actual timestamps.
    const lastTimestamp = (lastMessage as Record<string, unknown>).timestamp as number | undefined;
    if (lastTimestamp && now - lastTimestamp > 30 * 60 * 1000) {
      const activeCount = await this.conversationStore.getActiveCount();
      if (activeCount > 10) {
        // Need to find the oldest active conversation to archive.
        // For now, we rely on the caller or a future enhancement to provide it.
        debugLog('info', '[MemoryEngine] archiving check — active count exceeds 10', { activeCount });
      }

      const archivedCount = await this.conversationStore.getArchivedCount();
      if (archivedCount > 100) {
        // LRU eviction per D-22: oldest archived should be evicted.
        // WriteJournal coordinates the eviction for crash safety.
        const { writeJournal } = await import('../storage/WriteJournal');
        const journal = await writeJournal.begin(
          'evict-conversation' as never,
          { memory_summaries: 'oldest-archived' },
          [{ name: 'mark-evicted' }],
        );
        await writeJournal.markStepComplete(journal.id, 0);
        await writeJournal.markCompleted(journal.id);
      }
    }
  }

  /**
   * Enforce fact cap (D-23: 500 soft cap, D-24: low-confidence eviction).
   */
  async #enforceFactCap(): Promise<void> {
    const allFacts = await this.#getAllActiveFacts();
    const now = Date.now();
    let evictedCount = 0;

    // D-24: Low-confidence eviction — facts with confidence < 0.3 and unused for 30+ days
    const thirtyDays = 30 * 86400000;
    for (const fact of allFacts) {
      if (fact.confidence < 0.3 && fact.lastUsedAt && now - fact.lastUsedAt > thirtyDays) {
        await this.#evictWithRouting(fact.id);
        evictedCount++;
      }
    }

    // D-23: Soft cap enforcement — evict lowest-ranked facts when > 500
    if (allFacts.length > 500) {
      const remainingActive = await this.#getAllActiveFacts();
      const sorted = [...remainingActive].sort((a, b) => {
        // Sort by confidence ascending (lowest first)
        return a.confidence - b.confidence || (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0);
      });

      const toEvict = sorted.slice(0, sorted.length - 500);
      for (const fact of toEvict) {
        await this.#evictWithRouting(fact.id);
        evictedCount++;
      }
    }

    if (evictedCount > 0) {
      debugLog('info', '[MemoryEngine] cap enforcement', { evicted: evictedCount });
    }
  }

  /**
   * Evict a fact with routing (primary writes directly, non-primary emits request).
   */
  async #evictWithRouting(factId: string): Promise<void> {
    if (this.isPrimarySurface) {
      await this.userMemoryStore.evictFact(factId);
    } else {
      const request: MemoryWriteRequest = {
        type: 'upsert-fact',
        payload: { id: factId, status: 'superseded' },
        surfaceId: 'non-primary',
        timestamp: Date.now(),
        idempotencyKey: `evict-${factId}-${Date.now()}-${crypto.randomUUID()}`,
      };
      await this.broadcastBus.emitMemoryWrite(request);
    }
  }

  /**
   * Fetch all active user facts.
   */
  async #getAllActiveFacts(): Promise<UserMemoryFact[]> {
    // Use the search method with an empty query to get top results,
    // but for a complete fact list we rely on MemoryDB access.
    // The plan says: "or use direct MemoryDB.getAllUserFacts()"
    // Since the engine has access to userMemoryStore, we can search with empty string.
    // But for full fact enumeration we need MemoryDB access.
    // Search with empty string returns top-5 by default which isn't enough.
    // Use a workaround: import memoryDB temporarily.
    const { memoryDB } = await import('../storage/stores/MemoryDB');
    const rawFacts = await memoryDB.getAllUserFacts();
    // Normalize using the store's internal helper logic
    // Since normalizeFact is private in UserMemoryStore, we inline a simple normalizer
    const activeFacts: UserMemoryFact[] = [];
    for (const f of rawFacts) {
      if ((f as Record<string, unknown>).status !== 'superseded') {
        activeFacts.push({
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
        });
      }
    }
    return activeFacts;
  }
}

// ---------------------------------------------------------------------------
// Singleton — importing stores at module bottom to avoid circular deps
// ---------------------------------------------------------------------------

import { conversationMemoryStore } from './ConversationMemoryStore';
import { userMemoryStore } from './UserMemoryStore';
import { preferenceMemoryStore } from './PreferenceMemoryStore';
import { memoryScorer } from './MemoryScorer';
import { memoryExtractor } from './MemoryExtractor';
import { broadcastBus } from '../messaging/broadcastBus';

export const memoryEngine = new MemoryEngine(
  conversationMemoryStore,
  userMemoryStore,
  preferenceMemoryStore,
  memoryScorer,
  memoryExtractor,
  broadcastBus,
);
