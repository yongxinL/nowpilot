import { openDB, type IDBPDatabase } from 'idb';
import { generateText } from 'ai';
import { migrationRunner } from '../storage/MigrationRunner';
import type { ProviderAdapter } from '../ai/providers/ProviderAdapter';
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

/**
 * D-10 compaction boundary: every 12th appended message triggers
 * summarization (messageCount % 12 === 0).
 */
const COMPACT_BOUNDARY = 12;

/**
 * D-10 context assembly: head = first 2 messages (establishing context).
 * The summary replaces everything between the head and the recent tail.
 */
const HEAD_MESSAGE_COUNT = 2;

/**
 * Tail kept out of the summary. compactConversation() has no tier signal
 * (it is a background operation), so it keeps the most conservative recent
 * tail (tiny=4) and summarizes the largest middle portion (D-10 agent
 * discretion within the head+summary+tail assembly formula).
 */
const COMPACT_TAIL_COUNT = 4;

/** Summary length cap (D-10: 2-3 concise sentences; LLM output is untrusted). */
const SUMMARY_MAX_CHARS = 500;

/**
 * D-10 summarization prompt. Message content is untrusted user/assistant
 * text — wrapped in a <data-source> delimiter (CTX-T02 pattern) so
 * injection content in the excerpt cannot hijack the summary instructions
 * (T-05-10).
 */
const SUMMARY_PROMPT_TEMPLATE = `Summarize the following conversation excerpt in 2-3 concise sentences.
Capture only: decisions made, goals set, user preferences stated, facts mentioned, and open tasks.
Do NOT summarize conversational filler, greetings, or small talk.

Conversation:
<data-source>
{messages}
</data-source>

Summary:`;

function roleLabel(role: 'user' | 'assistant' | 'tool'): string {
  switch (role) {
    case 'user':
      return 'User';
    case 'assistant':
      return 'Assistant';
    default:
      return 'Tool';
  }
}

/**
 * WR-06 (T-05-10): untrusted message content must never break out of the
 * <data-source> wrapper — a `</data-source>` (or a standalone `Summary:`
 * line colliding with the prompt tail) inside a message would terminate the
 * block early and inject instructions into the summarization call. Strip
 * the delimiter sequences from the excerpt so the assembled prompt contains
 * exactly one delimiter pair, making the delimiter collision-proof.
 */
function sanitizeExcerpt(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const stripped = line.replace(/<\/?data-source>/gi, '');
      return /^\s*Summary:\s*$/i.test(stripped) ? '[redacted]' : stripped;
    })
    .join('\n');
}

export interface MemoryMessageInput {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
}

export interface AppendMessageResult {
  shouldCompact: boolean;
  messageCount: number;
}

/**
 * D-10 compaction result — discriminated via `code`, never thrown for
 * operational failures (provider errors, empty output). On failure the
 * original messages are always preserved.
 */
export interface CompactConversationResult {
  success: boolean;
  error?: string;
  code?: 'EMPTY_SUMMARY' | 'PROVIDER_ERROR' | 'DELIMITER_ERROR';
  summaryId?: string;
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
 * emits the compaction SIGNAL at the 12-message boundary and generates the
 * LLM summary via compactConversation() (D-10, haiku-class tier).
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
   * this append is a multiple of 12 (D-10). Never invokes the LLM itself —
   * the caller decides when to run compactConversation() so the message
   * write is never blocked on summarization.
   *
   * WR-09: the count and the put run inside ONE readwrite transaction (key
   * cursor over [conversationId, *]) — seq assignment is atomic, so two
   * concurrent appends to the same conversation can never compute the same
   * seq and silently overwrite each other.
   */
  async appendMessage(conversationId: string, message: MemoryMessageInput): Promise<AppendMessageResult> {
    const db = await openMemoryDb();
    const tx = db.transaction('memory_messages', 'readwrite');
    const store = tx.store;

    let seq = 0;
    let cursor = await store.openCursor(conversationRange(conversationId));
    while (cursor) {
      seq++;
      cursor = await cursor.continue();
    }

    await store.put({ conversationId, seq, ...message });
    await tx.done;
    const messageCount = seq + 1;

    return { shouldCompact: messageCount % COMPACT_BOUNDARY === 0, messageCount };
  }

  /** Explicit D-10 boundary check: true when messageCount % 12 === 0 (and the conversation has messages). */
  async shouldCompact(conversationId: string): Promise<boolean> {
    const count = await this.getMessageCount(conversationId);
    return count > 0 && count % COMPACT_BOUNDARY === 0;
  }

  /**
   * D-10 LLM compaction: summarizes the middle messages (everything after
   * the 2-message head and before the 4-message tail) using the cheapest
   * available summarization tier (FAST = haiku-class) — never the
   * conversation tier. The summary is stored via saveSummary(); the
   * original messages are NEVER deleted (D-10 resilience). Failure paths
   * (empty output, provider error) return a result with `code` and leave
   * the conversation untouched — the summary is simply absent.
   */
  async compactConversation(
    conversationId: string,
    providerAdapter: ProviderAdapter,
  ): Promise<CompactConversationResult> {
    const db = await openMemoryDb();
    const messages = await db.getAll('memory_messages', conversationRange(conversationId));

    // D-10 assembly: head (first 2) + summary (middle) + tail (last 4)
    const headEnd = Math.min(HEAD_MESSAGE_COUNT, messages.length);
    const tailStart = Math.max(headEnd, messages.length - COMPACT_TAIL_COUNT);
    const middle = messages.slice(headEnd, tailStart);

    if (middle.length === 0) {
      // Nothing to summarize — treated like an empty summary, no data loss
      return { success: false, code: 'EMPTY_SUMMARY' };
    }

    const formatted = middle.map((m) => `${roleLabel(m.role)}: ${m.content}`).join('\n');
    const prompt = SUMMARY_PROMPT_TEMPLATE.replace('{messages}', sanitizeExcerpt(formatted));

    // WR-06: the sanitizer must guarantee exactly one delimiter pair — if
    // the invariant ever breaks, refuse to call the model rather than let
    // injected instructions reach it.
    const openTags = (prompt.match(/<data-source>/g) ?? []).length;
    const closeTags = (prompt.match(/<\/data-source>/g) ?? []).length;
    if (openTags !== 1 || closeTags !== 1) {
      return {
        success: false,
        code: 'DELIMITER_ERROR',
        error: 'summary prompt delimiter invariant violated',
      };
    }

    try {
      // D-10: lowest-cost tier (haiku-class), independent of the user's
      // conversation tier — summarization is a background operation.
      const modelId = providerAdapter.getDefaultModelForTier('FAST');
      const model = providerAdapter.createLanguageModel(modelId);
      const result = await generateText({ model, prompt, maxOutputTokens: 200, temperature: 0.3 });

      const summary = result?.text;
      if (typeof summary !== 'string' || summary.trim().length === 0) {
        return { success: false, code: 'EMPTY_SUMMARY' };
      }

      const summaryRecord: ConversationSummary = {
        id: crypto.randomUUID(),
        conversationId,
        summary: summary.trim().slice(0, SUMMARY_MAX_CHARS),
        messageRange: { start: headEnd, end: tailStart },
        createdAt: Date.now(),
      };
      await this.saveSummary(summaryRecord);
      return { success: true, summaryId: summaryRecord.id };
    } catch (err) {
      return {
        success: false,
        code: 'PROVIDER_ERROR',
        error: err instanceof Error ? err.message : String(err),
      };
    }
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
