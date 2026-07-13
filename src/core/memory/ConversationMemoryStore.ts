import { memoryDB } from '../storage/stores/MemoryDB';
import { debugLog } from '../utils/debugLog';
import type { ModelContextTier } from '../context/contextTypes';
import type { ConversationSummary } from './memoryTypes';

const TURN_COUNTS: Record<ModelContextTier, number> = {
  tiny: 2,
  small: 4,
  medium: 6,
  large: 6,
};

export class ConversationMemoryStore {
  /**
   * Get conversation context: tier-capped recent turns + optional summary.
   * Archived conversations return empty context.
   */
  async getContext(
    conversationId: string,
    tier: ModelContextTier,
  ): Promise<{ summary?: string; recentTurns: Array<{ role: string; content: string }> }> {
    try {
      const existingSummary = await memoryDB.getSummary(conversationId);

      // Exclude archived conversations
      if (existingSummary && existingSummary.state === 'archived') {
        return { recentTurns: [] };
      }

      const turnCount = TURN_COUNTS[tier] ?? 2;
      const messageCount = turnCount * 2;

      const messages = await memoryDB.getMessages(conversationId);
      const sorted = messages.sort((a, b) => a.seq - b.seq);
      const recent = sorted.slice(-messageCount).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      return {
        summary: existingSummary?.summary,
        recentTurns: recent,
      };
    } catch (err) {
      debugLog('error', '[ConversationMemoryStore] getContext failed', { error: err });
      return { recentTurns: [] };
    }
  }

  /**
   * Roll new LLM summary into the existing cumulative summary (D-19).
   * If no summary exists, creates a new one.
   */
  async summarize(
    conversationId: string,
    newMessages: Array<{ role: string; content: string }>,
    llmSummary: string,
  ): Promise<void> {
    try {
      const existing = await memoryDB.getSummary(conversationId);

      let mergedSummary: string;
      let messageCount: number;
      let created: number;
      const now = Date.now();

      if (existing) {
        mergedSummary = `${existing.summary}\n---\n${llmSummary}`;
        messageCount = existing.messageCount + newMessages.length;
        created = existing.created;
      } else {
        mergedSummary = llmSummary;
        messageCount = newMessages.length;
        created = now;
      }

      await memoryDB.putSummary({
        conversationId,
        summary: mergedSummary,
        messageCount,
        created,
        updated: now,
        state: 'active',
      });
    } catch (err) {
      debugLog('error', '[ConversationMemoryStore] summarize failed', { error: err });
    }
  }

  /**
   * Archive a conversation — set state='archived' with timestamp (D-22).
   */
  async archive(conversationId: string): Promise<void> {
    try {
      const existing = await memoryDB.getSummary(conversationId);
      if (existing) {
        await memoryDB.putSummary({
          ...existing,
          state: 'archived',
          archivedAt: Date.now(),
        });
      }
    } catch (err) {
      debugLog('error', '[ConversationMemoryStore] archive failed', { error: err });
    }
  }

  /**
   * Return count of active (non-archived) conversations.
   */
  async getActiveCount(): Promise<number> {
    try {
      const all = await memoryDB.getAllSummaries();
      return all.filter((s) => s.state === 'active').length;
    } catch (err) {
      debugLog('error', '[ConversationMemoryStore] getActiveCount failed', { error: err });
      return 0;
    }
  }

  /**
   * Return count of archived conversations.
   */
  async getArchivedCount(): Promise<number> {
    try {
      const all = await memoryDB.getAllSummaries();
      return all.filter((s) => s.state === 'archived').length;
    } catch (err) {
      debugLog('error', '[ConversationMemoryStore] getArchivedCount failed', { error: err });
      return 0;
    }
  }
}

export const conversationMemoryStore = new ConversationMemoryStore();
