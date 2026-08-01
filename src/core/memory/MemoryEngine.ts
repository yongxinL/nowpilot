import { ConversationMemoryStore } from './ConversationMemoryStore';
import { UserMemoryStore, type UserFactUpsertInput } from './UserMemoryStore';
import { PreferenceMemoryStore } from './PreferenceMemoryStore';
import { getTopFacts } from './MemoryScorer';
import type { ConfidenceSource, MemoryRecord } from './MemoryRecord';
import type {
  MemoryRetrievalResult,
  MemoryStoreWriteOp,
  MemoryWriteResult,
  RetrievalOptions,
} from './types';
import { createEntry, commitEntry, getEntry } from '../storage/WriteJournal';
import { isPrimarySurface, publish } from '../runtime/BroadcastBus';
import { tokenBudget } from '../context/TokenBudget';
import type { ContextItem } from '../context/ContextItem';

/** Recency/freshness linear-decay window (matches MemoryScorer, D-08). */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** D-11 LRU retention constants. */
const MAX_ACTIVE_CONVERSATIONS = 10;
const MAX_ARCHIVED_CONVERSATIONS = 100;
const IDLE_ARCHIVE_MS = 30 * 60 * 1000;

/** Entrypoint-provided surface identity (see MemoryEngine constructor). */
function entrypointSurfaceId(): string | undefined {
  return (globalThis as { __NOWPILOT_SURFACE_ID__?: string }).__NOWPILOT_SURFACE_ID__;
}

/**
 * Write input: everything except the derived fields (id/useCount/confidence
 * and the timestamps — createdAt/updatedAt are derived by the store).
 */
export type MemoryWriteInput = Omit<
  MemoryRecord,
  'id' | 'useCount' | 'confidence' | 'createdAt' | 'updatedAt'
> & { source: ConfidenceSource };

/**
 * MemoryEngine — the single entry point for all memory operations (MEM-01,
 * MEM-02). Orchestrates the three independent stores (D-06: no cross-store
 * consolidation), enforces the D-05 AI write boundary, the MEM-02
 * single-writer gate, WriteJournal crash consistency, and produces
 * ContextItem[] for the Phase 4b context pipeline.
 *
 * Module-level singleton (ContextOptimizer/PromptCacheManager pattern).
 */
export class MemoryEngine {
  private readonly conversationStore: ConversationMemoryStore;
  private readonly userStore: UserMemoryStore;
  private readonly preferenceStore: PreferenceMemoryStore;

  /** MEM-02: the surface identity this engine instance runs on. */
  private readonly surfaceId: string;

  /** D-11 LRU state: conversationId → last activity timestamp. */
  private readonly lastActiveAt = new Map<string, number>();
  private readonly active: string[] = [];
  private readonly archived: string[] = []; // oldest first (eviction order)

  /**
   * Public constructor (PageIndexBuilder/ContextOptimizer pattern) — use
   * getMemoryEngine() for the shared singleton. `surfaceId` identifies the
   * surface this instance runs on for the MEM-02 single-writer gate; when
   * omitted it is read from the entrypoint global
   * (globalThis.__NOWPILOT_SURFACE_ID__).
   */
  constructor(surfaceId?: string) {
    const resolvedSurfaceId = surfaceId ?? entrypointSurfaceId();
    if (!resolvedSurfaceId) {
      throw new Error(
        'MemoryEngine requires surfaceId — pass to getMemoryEngine() or set globalThis.__NOWPILOT_SURFACE_ID__',
      );
    }
    this.surfaceId = resolvedSurfaceId;
    this.conversationStore = new ConversationMemoryStore();
    this.userStore = new UserMemoryStore();
    this.preferenceStore = new PreferenceMemoryStore();
  }

  /**
   * Single-writer gate (MEM-02 / T-05-05): memory writes are only allowed on
   * the primary surface elected via BroadcastBus. Reads
   * BroadcastBus.getPrimarySurfaceId() and compares with this instance's
   * surfaceId; before any election happens every surface is primary.
   */
  isPrimarySurface(): boolean {
    return isPrimarySurface(this.surfaceId);
  }

  /**
   * Retrieval pipeline (D-06): conversation context → scored user facts →
   * preferences, combined in that order into ContextItem[] (Phase 4b
   * contract: relevance/freshness computed here, sensitivity inherited).
   */
  async retrieve(options: RetrievalOptions): Promise<MemoryRetrievalResult> {
    try {
      const items: ContextItem[] = [];
      const now = Date.now();

      // 1. Conversation memory: summary + tier-gated recent turns (D-10)
      const conversation = await this.conversationStore.getContext(
        options.conversationId,
        options.tier,
      );
      if (conversation.summary) {
        items.push({
          kind: 'memory',
          text: conversation.summary.summary,
          tokens: tokenBudget.estimateTokens(conversation.summary.summary),
          stable: false,
          sourceId: `memory.conversation.summary.${conversation.summary.id}`,
          relevance: 1,
          freshness: 1,
          trust: 0.9,
          sensitivity: 'public',
          instructionAuthority: 'data',
        });
      }
      conversation.recentMessages.forEach((message, index) => {
        items.push({
          kind: 'memory',
          text: message.content,
          tokens: tokenBudget.estimateTokens(message.content),
          stable: false,
          sourceId: `memory.conversation.turn.${index}`,
          relevance: 1,
          freshness: 1,
          trust: 0.9,
          sensitivity: 'private',
          instructionAuthority: 'data',
        });
      });

      // 2. User facts: D-08 scored, D-09 tier-gated (only semantic facts —
      //    preference records share the store but are not facts, D-06)
      const allRecords = await this.userStore.getAll();
      const facts = allRecords.filter((fact) => fact.memoryType === 'semantic');
      const topFacts = getTopFacts(facts, options.query, options.tier);
      for (const retrieved of topFacts) {
        const freshness = Math.max(
          0,
          Math.min(1, 1 - (now - retrieved.record.updatedAt) / THIRTY_DAYS_MS),
        );
        items.push({
          kind: 'memory',
          text: retrieved.record.content,
          tokens: tokenBudget.estimateTokens(retrieved.record.content),
          stable: false,
          sourceId: `memory.user.fact.${retrieved.record.id}`,
          relevance: retrieved.retrievalScore,
          freshness,
          trust: retrieved.record.confidence,
          sensitivity: retrieved.record.sensitivity,
          instructionAuthority: 'data',
        });
      }

      // 3. Preferences: compact JSON as a single item (persona config etc.)
      const preferences = await this.preferenceStore.getAll();
      if (Object.keys(preferences).length > 0) {
        const text = JSON.stringify(preferences);
        items.push({
          kind: 'memory',
          text,
          tokens: tokenBudget.estimateTokens(text),
          stable: false,
          sourceId: 'memory.preference',
          relevance: 0.5,
          freshness: 1,
          trust: 1.0,
          sensitivity: 'private',
          instructionAuthority: 'data',
        });
      }

      return { success: true, items };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        code: 'STORE_ERROR',
      };
    }
  }

  /**
   * Write a memory record (MEM-02 single-writer + D-05 write boundary +
   * WriteJournal crash consistency + WORKSPACE_UPDATED broadcast).
   *
   * `callerOrigin` guards the AI pipeline: AI may only write
   * working/episodic (conversation summaries); semantic facts and
   * preferences require user action (D-05 / T-05-06).
   */
  async write(
    record: MemoryWriteInput,
    callerOrigin: 'user-action' | 'ai-pipeline' | 'system' = 'user-action',
  ): Promise<MemoryWriteResult> {
    // D-05 guard — checked BEFORE the primary-surface gate so no journal
    // entry is ever created for a boundary violation
    if (
      callerOrigin === 'ai-pipeline' &&
      (record.memoryType === 'semantic' || record.memoryType === 'preference')
    ) {
      return {
        success: false,
        error: 'AI pipeline may only write working/episodic memory (conversation summaries only per D-05)',
        code: 'WRITE_BOUNDARY_VIOLATION',
      };
    }

    // MEM-02 gate — reject BEFORE any IndexedDB mutation or journal entry
    if (!this.isPrimarySurface()) {
      return {
        success: false,
        error: 'Memory writes only allowed on primary surface',
        code: 'NOT_PRIMARY_SURFACE',
      };
    }

    const operation = this.toJournalOperation(record.memoryType);
    let upsertedId: string | null = null;

    const steps: Array<{ name: string; executor: () => Promise<void> }> = [
      {
        name: 'write-memory-record',
        executor: async () => {
          // Semantic facts are stored in the user_facts store; the Zod
          // boundary (UserMemoryFactSchema) rejects non-semantic records,
          // surfacing as a failed journal step instead of silent loss.
          const result = await this.userStore.upsert(
            record as unknown as UserFactUpsertInput,
          );
          if (!result.success) {
            throw new Error(`Memory write rejected by store: ${result.error}`);
          }
          upsertedId = result.recordId;
        },
      },
      {
        name: 'broadcast-workspace-update',
        executor: async () => {
          publish('WORKSPACE_UPDATED', { source: 'memory' });
        },
      },
    ];

    try {
      const entry = await createEntry(operation, {}, steps);
      await commitEntry(entry.id, steps);

      const persisted = await getEntry(entry.id);
      if (persisted && persisted.status !== 'completed') {
        return {
          success: false,
          error: `Journal entry ${persisted.status}: memory write was not committed`,
          code: 'JOURNAL_ERROR',
        };
      }

      // Retrieval-ranking counter (D-07); confidence untouched
      if (upsertedId) {
        await this.userStore.incrementUseCount(upsertedId);
      }

      return { success: true, recordId: upsertedId ?? '' };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        code: 'DB_ERROR',
      };
    }
  }

  /** All preferences as { [key]: value } (persona config lives here). */
  async getPreferences(): Promise<Record<string, unknown>> {
    return this.preferenceStore.getAll();
  }

  /** Persona configuration (np_persona), or null when not set. */
  async getPersona(): Promise<Record<string, unknown> | null> {
    return this.preferenceStore.getPersona();
  }

  /**
   * D-11 LRU conversation tracking: max 10 active, max 100 archived,
   * idle (>30 min) conversations archived lazily on each call, oldest
   * archived evicted first via evictConversation(). Returns the ids
   * evicted in this cycle.
   */
  async trackConversationActivity(conversationId: string): Promise<{ evicted: string[] }> {
    const now = Date.now();
    const evicted: string[] = [];

    this.lastActiveAt.set(conversationId, now);

    // 1. Archive active conversations idle longer than 30 minutes
    const stillActive = this.active.filter((id) => {
      if (id === conversationId) return true;
      return now - (this.lastActiveAt.get(id) ?? 0) <= IDLE_ARCHIVE_MS;
    });
    for (const id of this.active) {
      if (!stillActive.includes(id)) {
        this.archived.push(id);
      }
    }
    this.active.length = 0;
    this.active.push(...stillActive);

    // 2. Promote the current conversation to the active set
    if (!this.active.includes(conversationId)) {
      this.active.push(conversationId);
    }

    // 3. Max 10 active — archive the oldest active (by lastActivity)
    while (this.active.length > MAX_ACTIVE_CONVERSATIONS) {
      let oldestId: string | null = null;
      let oldestAt = Number.POSITIVE_INFINITY;
      for (const id of this.active) {
        if (id === conversationId) continue;
        const at = this.lastActiveAt.get(id) ?? 0;
        if (at < oldestAt) {
          oldestAt = at;
          oldestId = id;
        }
      }
      if (oldestId === null) break;
      this.active.splice(this.active.indexOf(oldestId), 1);
      this.archived.push(oldestId);
    }

    // 4. Max 100 archived — evict the oldest archived first (D-11)
    while (this.archived.length > MAX_ARCHIVED_CONVERSATIONS) {
      const oldest = this.archived.shift();
      if (oldest === undefined) break;
      await this.conversationStore.evictConversation(oldest);
      this.lastActiveAt.delete(oldest);
      evicted.push(oldest);
    }

    return { evicted };
  }

  /** D-11 visibility: current LRU state for diagnostics. */
  async getConversationStats(): Promise<{ active: number; archived: number; total: number }> {
    return {
      active: this.active.length,
      archived: this.archived.length,
      total: this.active.length + this.archived.length,
    };
  }

  /** Memory type → WriteJournal operation (Phase 2 union). */
  private toJournalOperation(memoryType: MemoryRecord['memoryType']): MemoryStoreWriteOp {
    switch (memoryType) {
      case 'preference':
        return 'write-preference';
      case 'working':
      case 'episodic':
        return 'compact-conversation';
      case 'semantic':
      case 'procedural':
      default:
        return 'update-user-memory';
    }
  }
}

// ── Singleton (module-level, ContextOptimizer pattern) ──────────────────────

let _instance: MemoryEngine | null = null;

/**
 * Accessor for the singleton. `surfaceId` identifies the running surface
 * (MEM-02 single-writer gate); when omitted it is read from the entrypoint
 * global (globalThis.__NOWPILOT_SURFACE_ID__). The first call pins the
 * instance — resetMemoryEngine() must be used to rebind a different
 * surface.
 */
export function getMemoryEngine(surfaceId?: string): MemoryEngine {
  if (!_instance) {
    _instance = new MemoryEngine(surfaceId);
  }
  return _instance;
}

/** Reset the singleton — used by tests for isolation. */
export function resetMemoryEngine(): void {
  _instance = null;
}
