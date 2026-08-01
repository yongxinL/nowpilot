import { openDB, type IDBPDatabase } from 'idb';
import { migrationRunner } from '../storage/MigrationRunner';
import {
  ConversationContextSchema,
  type ConversationContext,
  type ConversationSummary,
} from './MemoryRecord';

/**
 * D-10 tail size per model context tier: tiny=4, small=8, medium/large=12.
 * Recent messages beyond the tail are replaced by the LLM summary.
 */
const RECENT_MESSAGE_LIMITS: Record<string, number> = { tiny: 4, small: 8, medium: 12, large: 12 };

export interface MemoryMessageInput {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
}

export interface AppendMessageResult {
  shouldCompact: boolean;
  messageCount: number;
}

// ── Database connection (WriteJournal pattern: module-level cached promise) ──

let dbPromise: Promise<IDBPDatabase> | null = null;

async function openMemoryDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    await migrationRunner.migrate('NotesDB', 4);
    dbPromise = openDB('NotesDB', 4);
  }
  return dbPromise;
}

/**
 * Close this module's connection. Used by tests before deleting the DB.
 */
export async function resetConversationMemoryDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

/** Key range selecting every message of one conversation (compound key). */
function conversationRange(conversationId: string): IDBKeyRange {
  return IDBKeyRange.bound(
    [conversationId, 0],
    [conversationId, Number.MAX_SAFE_INTEGER],
  );
}

/**
 * ConversationMemoryStore — persistent summary + recent-turn memory (D-10).
 * Messages are stored in `memory_messages` (compound key [conversationId, seq]),
 * summaries in `conversation_summaries` (keyPath conversationId). The store
 * only emits the compaction SIGNAL at the 12-message boundary — LLM
 * summarization is invoked by MemoryEngine (Plan 03 scope).
 */
export class ConversationMemoryStore {
  /**
   * Conversation context for one turn: optional summary plus the tier-gated
   * tail of recent messages (D-10: head + summary + tail).
   */
  async getContext(conversationId: string, tier: string): Promise<ConversationContext> {
    const db = await openMemoryDb();

    const storedSummary = await db.get('conversation_summaries', conversationId);
    const summary = storedSummary ? (storedSummary as ConversationSummary) : null;

    const messages = await db.getAll('memory_messages', conversationRange(conversationId));
    const limit = RECENT_MESSAGE_LIMITS[tier] ?? RECENT_MESSAGE_LIMITS.small;
    const recent = messages.slice(-limit);

    return ConversationContextSchema.parse({
      summary,
      recentMessages: recent.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    });
  }

  /**
   * Append one message with auto-incrementing per-conversation seq.
   * Returns the compaction signal: shouldCompact=true when the count after
   * this append is a multiple of 12 (D-10). Never invokes the LLM itself.
   */
  async appendMessage(conversationId: string, message: MemoryMessageInput): Promise<AppendMessageResult> {
    const db = await openMemoryDb();
    const existing = await db.getAll('memory_messages', conversationRange(conversationId));
    const seq = existing.length; // auto-increment within the conversation

    await db.put('memory_messages', { conversationId, seq, ...message });
    const messageCount = seq + 1;

    return { shouldCompact: messageCount % 12 === 0, messageCount };
  }

  /** Count messages stored for one conversation. */
  async getMessageCount(conversationId: string): Promise<number> {
    const db = await openMemoryDb();
    const messages = await db.getAll('memory_messages', conversationRange(conversationId));
    return messages.length;
  }

  /** Persist an LLM-generated conversation summary (D-10, 2-3 sentences). */
  async saveSummary(summary: ConversationSummary): Promise<void> {
    const db = await openMemoryDb();
    await db.put('conversation_summaries', summary);
  }

  /**
   * All summaries for a conversation. Currently at most one (the store is
   * keyed by conversationId), but returns an array for future multi-range
   * summary support.
   */
  async getSummaries(conversationId: string): Promise<ConversationSummary[]> {
    const db = await openMemoryDb();
    const stored = await db.get('conversation_summaries', conversationId);
    return stored ? [stored as ConversationSummary] : [];
  }

  /**
   * Remove every message and summary for a conversation. Used by LRU
   * eviction (D-11) — removes oldest archived conversations first.
   */
  async evictConversation(conversationId: string): Promise<void> {
    const db = await openMemoryDb();
    const messages = await db.getAll('memory_messages', conversationRange(conversationId));
    for (const m of messages) {
      await db.delete('memory_messages', [m.conversationId, m.seq]);
    }
    await db.delete('conversation_summaries', conversationId);
  }
}
