// src/core/memory/ConversationMemoryStore.ts — §18 Phase-5 create-list
// (D-05-03). Per-conversation rolling summary + tiered recent turns over the
// MemoryDB substrate, with the §15.3 LRU (10 active / 100 archived, archive
// after 30 min idle, evict via the 'evict-conversation' WriteJournal op) and
// the 12-message compactor.
//
// Source lines: §3.3 ConversationMemory (L551-572 — last-N tier rules: 2
// tiny / 4 small / 6 medium|large + 12-message summarise rule + "store message
// bodies in IndexedDB only"); §15.3 LRU (L1986-1991 — 10 active / 100
// archived / evict-conversation op / 30 min idle archive / compactor head
// (system + first 2) + summary of middle + tail (last 4)); §21.3
// ConversationMeta (L3401-3419).
//
// Open Q8 resolution (05-RESEARCH L516-519): conversation META is metadata in
// chrome.storage.local via the Setting layer (`np_conversation_meta`,
// registered area:'local' in Setting.ts — 05-01, Pitfall 4 closed); message
// BODIES + summaries stay in MemoryDB IndexedDB (the §23 ADR metadata-local /
// bodies-IDB split). Meta round-trips through settingRead/settingWrite ONLY —
// never direct chrome.storage (§15.1 Pitfall 4).
//
// Single-writer (§13 line 1791): memory writes are serialized on the primary
// surface; this store is one of the three stores MemoryEngine (05-04)
// dispatches — surfaces never call it directly (D-05-02).
//
// Every catch calls debugLog with a canonical STORE_READ/STORE_WRITE code
// (Golden Rule 9, Open Q7 — stores reuse the Phase-2 codes, no new C.2 codes);
// write paths never throw (PATTERNS Shared Pattern 1). GR-9 debugLog extra
// carries only ids/counts — never message content (T-05-10); TraceRedactor is
// automatic in debugLog (R-10).
import type { IDBPDatabase } from 'idb';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { estimateTokens } from '@/core/context/TokenBudget';
import type { ModelContextTier } from '@/core/context/ModelContextTier';
import type { ConversationMemory, ConversationMeta } from '@/core/memory/types';
import {
  getConversationSummary,
  getMessagesForConversation,
  putConversationSummary,
  putMemoryMessage,
  type MemoryDBSchema,
  type MemoryMessage,
} from '@/core/storage/MemoryDB';
import { settingRead, settingWrite } from '@/core/storage/Setting';
import { persistJournalEntry } from '@/core/storage/WriteJournal';
import type { WriteJournalEntry } from '@/types/storage';

/** §15.3 — max conversations with status 'active' before the oldest is archived. */
export const ACTIVE_CONVERSATION_LIMIT = 10;
/** §15.3 — max conversations with status 'archived' before the oldest is evicted. */
export const ARCHIVED_CONVERSATION_LIMIT = 100;
/** §15.3 — archive a conversation after this much idle time (30 min). */
export const ARCHIVE_IDLE_MS = 30 * 60_000;
/** §3.3/§15.3 — the compactor runs when messageCount % 12 === 0. */
export const COMPACTOR_INTERVAL = 12;

/** §15.1 metadata key — registered area:'local' in Setting.ts (05-01, Pitfall 4 pin). */
export const NP_CONVERSATION_META_KEY = 'np_conversation_meta';

/** §3.3 last-N tier rules — the recent-turns budget per ModelContextTier. */
const TURN_LIMITS: Record<ModelContextTier, number> = {
  tiny: 2,
  small: 4,
  medium: 6,
  large: 6,
};

/** A MemoryMessage whose role is in the §3.3 lastMessages union (system excluded). */
type TurnRow = MemoryMessage & { role: 'user' | 'assistant' | 'tool' };

function isTurnRow(m: MemoryMessage): m is TurnRow {
  return m.role !== 'system';
}

function isConversationMeta(v: unknown): v is ConversationMeta {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.conversationId === 'string' &&
    (m.status === 'active' || m.status === 'archived') &&
    typeof m.messageCount === 'number' &&
    typeof m.lastAccessed === 'number' &&
    typeof m.updatedAt === 'number'
  );
}

/**
 * Inbound gate for the np_conversation_meta record (T-1-13 style). The stored
 * value is a Record<conversationId, ConversationMeta> under ONE key; a
 * malformed entry is dropped + logged (STORE_READ) and treated as absent —
 * archive/evict degrade to no-op, never throw (T-05-09).
 */
function sanitizeMetaRecord(v: unknown): Record<string, ConversationMeta> | null {
  if (typeof v !== 'object' || v === null) return {};
  const record: Record<string, ConversationMeta> = {};
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    if (isConversationMeta(value) && value.conversationId === key) {
      record[key] = value;
    } else {
      debugLog(ERROR_CODES.STORE_READ, 'malformed conversation meta entry dropped', {
        module: 'ConversationMemoryStore',
        extra: { conversationId: key },
      });
    }
  }
  return record;
}

/** Read the full meta record through the Setting layer (never chrome.storage directly). */
async function readAllMeta(): Promise<Record<string, ConversationMeta>> {
  return settingRead<Record<string, ConversationMeta>>(
    NP_CONVERSATION_META_KEY,
    sanitizeMetaRecord,
    {},
  );
}

/** Persist the full meta record through the Setting layer (serialized mutex, never throws). */
async function writeAllMeta(record: Record<string, ConversationMeta>): Promise<void> {
  await settingWrite(NP_CONVERSATION_META_KEY, record);
}

/** One conversation's meta, or undefined when absent/malformed. */
async function getMeta(conversationId: string): Promise<ConversationMeta | undefined> {
  const record = await readAllMeta();
  return record[conversationId];
}

/** Upsert one conversation's meta via the Setting round-trip (read-modify-write). */
async function putMeta(meta: ConversationMeta): Promise<void> {
  const record = await readAllMeta();
  record[meta.conversationId] = meta;
  await writeAllMeta(record);
}

/**
 * Append a turn: persist the body to MemoryDB messages (conversationId+seq
 * composite key — §21.3/§20.2 idempotency key), update the np_conversation_meta
 * record via settingWrite (read-modify-write; missing meta → fresh active
 * record), then run the summarise trigger check. seq = last seq + 1 derived
 * from the by-conversation index read; when the read fails (returns []), the
 * count falls back to the stored meta.messageCount so the compactor trigger
 * never silently resets. Write path never throws (STORE_WRITE on failure).
 */
export async function appendTurn(
  db: IDBPDatabase<MemoryDBSchema>,
  input: {
    conversationId: string;
    role: MemoryMessage['role'];
    content: string;
    timestamp: number;
  },
): Promise<void> {
  try {
    const existing = await getMeta(input.conversationId);
    const messages = await getMessagesForConversation(db, input.conversationId);
    const lastSeq = messages.length > 0 ? messages[messages.length - 1].seq : 0;
    await putMemoryMessage(db, {
      conversationId: input.conversationId,
      seq: lastSeq + 1,
      role: input.role,
      content: input.content,
      timestamp: input.timestamp,
    });
    const messageCount =
      messages.length > 0 ? messages.length + 1 : (existing?.messageCount ?? 0) + 1;
    await putMeta({
      conversationId: input.conversationId,
      status: 'active', // fresh activity always reactivates (§15.3 status flip)
      messageCount,
      lastAccessed: input.timestamp,
      updatedAt: input.timestamp,
      summary: existing?.summary,
    });
    await summariseIfNeeded(db, input.conversationId);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to append turn', {
      error: err instanceof Error ? err : undefined,
      module: 'ConversationMemoryStore',
      extra: { conversationId: input.conversationId },
    });
  }
}

/**
 * §3.3 recent turns: keep the LAST 2 (tiny) / 4 (small) / 6 (medium|large)
 * turns via the by-conversation index, mapped to { role, content, tokens,
 * timestamp } with system rows filtered OUT of lastMessages (the §3.3 role
 * union is 'user'|'assistant'|'tool'). The summary attaches from
 * conversationSummaries first, then np_conversation_meta.summary;
 * updatedAt = max(meta.updatedAt, last message timestamp). [] on read
 * failure — the injection path never crashes (T-05-11).
 */
export async function getRecentTurns(
  db: IDBPDatabase<MemoryDBSchema>,
  conversationId: string,
  tier: ModelContextTier,
): Promise<ConversationMemory> {
  try {
    const messages = await getMessagesForConversation(db, conversationId);
    const turns = messages.filter(isTurnRow);
    const keep = TURN_LIMITS[tier] ?? TURN_LIMITS.medium;
    const recent = turns.slice(-keep).map((m) => ({
      role: m.role,
      content: m.content,
      tokens: estimateTokens(m.content),
      timestamp: m.timestamp,
    }));
    const [summaryRow, meta] = await Promise.all([
      getConversationSummary(db, conversationId),
      getMeta(conversationId),
    ]);
    const summary = summaryRow?.summary ?? meta?.summary ?? '';
    return {
      conversationId,
      summary,
      summaryTokens: estimateTokens(summary),
      lastMessages: recent,
      updatedAt: Math.max(meta?.updatedAt ?? 0, messages.at(-1)?.timestamp ?? 0),
    };
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to get recent turns', {
      error: err instanceof Error ? err : undefined,
      module: 'ConversationMemoryStore',
      extra: { conversationId },
    });
    return { conversationId, summary: '', summaryTokens: 0, lastMessages: [], updatedAt: 0 };
  }
}

/**
 * §3.3/§15.3 compactor: when messageCount % 12 === 0, split into head
 * (system row(s) + first 2 turns), tail (last 4 turns) and middle (the rest);
 * persist `opts.summarise(middle)` — or the deterministic structural default
 * `'[N messages compacted]'` when no seam is injected (the LLM summarizer
 * stage — conversationSummarizer PROMPTS entry — is the documented Phase-5a
 * seam; the core stays LLM-free and tests stay deterministic). Raw bodies are
 * RETAINED in MemoryDB (§3.3 "store message bodies in IndexedDB only" — the
 * compactor summarizes, never deletes); meta.messageCount is unchanged. The
 * summary lands in conversationSummaries AND np_conversation_meta.summary.
 * Never throws (STORE_WRITE on failure).
 */
export async function summariseIfNeeded(
  db: IDBPDatabase<MemoryDBSchema>,
  conversationId: string,
  opts?: { summarise?: (middle: readonly MemoryMessage[]) => Promise<string> },
): Promise<void> {
  try {
    const meta = await getMeta(conversationId);
    if (meta === undefined || meta.messageCount % COMPACTOR_INTERVAL !== 0) return;
    const messages = await getMessagesForConversation(db, conversationId);
    if (messages.length === 0) return;
    const turns = messages.filter(isTurnRow);
    const middle = turns.slice(2, -4); // head = system + first 2; tail = last 4
    const summary = opts?.summarise
      ? await opts.summarise(middle)
      : `[${middle.length} messages compacted]`;
    await putConversationSummary(db, {
      conversationId,
      summary,
      updatedAt: Date.now(),
    });
    meta.summary = summary;
    await putMeta(meta);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to summarise conversation', {
      error: err instanceof Error ? err : undefined,
      module: 'ConversationMemoryStore',
      extra: { conversationId },
    });
  }
}

/**
 * §15.3 idle archive: any 'active' meta whose lastAccessed is older than
 * ARCHIVE_IDLE_MS (30 min) flips to 'archived'. nowMs is injectable for
 * deterministic tests (production passes Date.now()). The db param is part of
 * the store surface (MemoryEngine dispatches uniformly) — meta lives in
 * chrome.storage, so the DB is not touched here. Never throws.
 */
export async function archiveIdleConversations(
  _db: IDBPDatabase<MemoryDBSchema>,
  nowMs: number,
): Promise<void> {
  try {
    const record = await readAllMeta();
    let changed = false;
    for (const meta of Object.values(record)) {
      if (meta.status === 'active' && nowMs - meta.lastAccessed > ARCHIVE_IDLE_MS) {
        meta.status = 'archived';
        changed = true;
      }
    }
    if (changed) await writeAllMeta(record);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to archive idle conversations', {
      error: err instanceof Error ? err : undefined,
      module: 'ConversationMemoryStore',
    });
  }
}

/**
 * §15.3 LRU limits: >10 active → archive the oldest by lastAccessed; then
 * >100 archived → evict the oldest (entry REMOVED from the meta record +
 * a WriteJournal entry with operation 'evict-conversation' — the §15.3
 * eviction audit trail; fill the WriteJournalEntry shape per WriteJournal.ts).
 * The eviction journal persists the conversationId in targetIds (the §13
 * crash-safe replay contract). Never throws — persistJournalEntry's rejection
 * (WR-03) is caught here so the write path stays silent (Golden Rule 9).
 */
export async function enforceLimits(_db: IDBPDatabase<MemoryDBSchema>): Promise<void> {
  try {
    const record = await readAllMeta();
    const metas = Object.values(record);
    const active = metas.filter((m) => m.status === 'active');
    if (active.length > ACTIVE_CONVERSATION_LIMIT) {
      active.sort((a, b) => a.lastAccessed - b.lastAccessed);
      const overflow = active.length - ACTIVE_CONVERSATION_LIMIT;
      for (let i = 0; i < overflow; i++) {
        active[i].status = 'archived';
      }
    }
    const archived = Object.values(record).filter((m) => m.status === 'archived');
    if (archived.length > ARCHIVED_CONVERSATION_LIMIT) {
      archived.sort((a, b) => a.lastAccessed - b.lastAccessed);
      const overflow = archived.length - ARCHIVED_CONVERSATION_LIMIT;
      const nowMs = Date.now();
      for (let i = 0; i < overflow; i++) {
        const evicted = archived[i];
        delete record[evicted.conversationId];
        await persistJournalEntry({
          id: `evict-conversation:${evicted.conversationId}:${nowMs}`,
          operation: 'evict-conversation',
          status: 'completed',
          createdAt: nowMs,
          updatedAt: nowMs,
          attempts: 1,
          targetIds: { conversationId: evicted.conversationId },
          steps: [],
        } satisfies WriteJournalEntry);
      }
    }
    await writeAllMeta(record);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to enforce conversation limits', {
      error: err instanceof Error ? err : undefined,
      module: 'ConversationMemoryStore',
    });
  }
}
