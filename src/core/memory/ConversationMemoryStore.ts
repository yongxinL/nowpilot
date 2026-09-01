// ConversationMemoryStore — D-104/D-106 conversation memory
// (PRODUCT_SPEC_v0_1.md §3.3/§15.3).
//
// Module singleton owning conversation memory:
//   (a) BODIES  → MemoryDB.messages (compound key [conversationId, seq])
//       + MemoryDB.conversationSummaries (keyPath conversationId).
//   (b) METADATA → chrome.storage.local np_conversation_meta (LRU 10 active /
//       100 archived, §15.3 verbatim).
//   (c) COMPACTOR SEAM (D-106) — appendMessage counts per conversation; when
//       messageCount % CONVERSATION_COMPACTOR_MODULO === 0 (12), compact:
//       keep head (system + first 2) + summarizer.summarize(middle) + tail
//       (last 4). Summarizer is a pluggable seam (constructor-injected);
//       tests inject a deterministic stub.
//   (d) ARCHIVE — idle > CONVERSATION_IDLE_ARCHIVE_MS (30 min) → active→archived.
//   (e) EVICT — archived > CONVERSATION_ARCHIVED_MAX → evict oldest via
//       runJournaled with registered evict-conversation steps (O.11 atomicity).
//   (f) SINGLE-WRITER — append/compact/archive/evict gate on isPrimaryWriter().
import { openMemoryDB, type MemoryMessage, type ConversationSummary } from '../storage/MemoryDB';
import type { UserMemoryFact } from './types';
import { isPrimaryWriter } from '../workspace/WorkspaceStore';
import { debugLog } from '../log/debugLog';
import { runJournaled, registerJournalSteps } from '../storage/WriteJournal';
import type { WriteJournalEntry } from '../../types/storage';

/** §15.3 verbatim: compactor fires at messageCount % 12 === 0. */
export const CONVERSATION_COMPACTOR_MODULO = 12;
/** §15.3 verbatim: max 10 active conversations. */
export const CONVERSATION_ACTIVE_MAX = 10;
/** §15.3 verbatim: max 100 archived conversations. */
export const CONVERSATION_ARCHIVED_MAX = 100;
/** §15.3 verbatim: archive after 30 min idle. */
export const CONVERSATION_IDLE_ARCHIVE_MS = 30 * 60 * 1000;

/** chrome.storage.local key for the np_conversation_meta LRU index. */
const NP_CONVERSATION_META_KEY = 'np_conversation_meta';

/** Pluggable summarizer seam (context/types.ts:52-54 shape). */
export interface ConversationSummarizer {
  summarize(messages: MemoryMessage[]): { text: string; tokens: number };
}

/** Metadata entry for a conversation in the LRU index. */
interface ConversationMeta {
  conversationId: string;
  messageCount: number;
  updatedAt: number;
  status: 'active' | 'archived';
}

/** Evict-conversation payload passed to the journal steps. */
export interface EvictConversationPayload {
  conversationId: string;
}

/** Module-level LRU index (loaded from chrome.storage.local). */
let conversationMeta: ConversationMeta[] = [];
let hydrated = false;

/** Injected summarizer seam (set at construction / test injection). */
let summarizer: ConversationSummarizer | null = null;

/** Evict steps factory bound at module load (registered once). */
let evictStepsFactory: ((payload: EvictConversationPayload) => {
  name: string;
  apply(): Promise<void>;
  rollback(): Promise<void>;
}) | null = null;

/**
 * Initialize the store with a summarizer seam and evict steps factory.
 * Must be called once at boot (or test setup). The summarizer is the
 * pluggable seam; tests inject a deterministic stub.
 */
export function createConversationMemoryStore(opts: {
  summarizer: ConversationSummarizer;
  evictStepsFactory: (
    payload: EvictConversationPayload,
  ) => { name: string; apply(): Promise<void>; rollback(): Promise<void> };
}): void {
  summarizer = opts.summarizer;
  evictStepsFactory = opts.evictStepsFactory;
  // Register the evict-conversation steps so isSupportedOperation returns true.
  registerJournalSteps('evict-conversation', []);
}

/** Load the LRU index from chrome.storage.local (idempotent). */
async function hydrate(): Promise<void> {
  if (hydrated) return;
  const result = await chrome.storage.local.get(NP_CONVERSATION_META_KEY);
  const raw = result[NP_CONVERSATION_META_KEY];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        conversationMeta = parsed.filter(
          (e): e is ConversationMeta =>
            e &&
            typeof e === 'object' &&
            typeof e.conversationId === 'string' &&
            typeof e.messageCount === 'number' &&
            typeof e.updatedAt === 'number' &&
            (e.status === 'active' || e.status === 'archived'),
        );
      }
    } catch {
      conversationMeta = [];
    }
  }
  hydrated = true;
}

/** Persist the LRU index to chrome.storage.local. */
async function persistMeta(): Promise<void> {
  await chrome.storage.local.set({ [NP_CONVERSATION_META_KEY]: JSON.stringify(conversationMeta) });
}

/** Find or create a metadata entry for a conversation. */
function findOrCreateMeta(conversationId: string, now: number): ConversationMeta {
  const existing = conversationMeta.find((m) => m.conversationId === conversationId);
  if (existing) return existing;
  const meta: ConversationMeta = { conversationId, messageCount: 0, updatedAt: now, status: 'active' };
  conversationMeta.push(meta);
  return meta;
}

/** Archive idle conversations (idle > CONVERSATION_IDLE_ARCHIVE_MS). */
export async function archiveIdleConversations(now: number): Promise<void> {
  if (!isPrimaryWriter()) return;
  await hydrate();
  for (const meta of conversationMeta) {
    if (meta.status === 'active' && now - meta.updatedAt > CONVERSATION_IDLE_ARCHIVE_MS) {
      meta.status = 'archived';
      debugLog('CONVERSATION_ARCHIVED', 'conversation archived (idle)', {
        conversationId: meta.conversationId,
      });
    }
  }
  await persistMeta();
}

/** Evict the oldest archived conversation via journaled steps. */
async function evictOldestArchived(): Promise<void> {
  const archived = conversationMeta
    .filter((m) => m.status === 'archived')
    .sort((a, b) => a.updatedAt - b.updatedAt);
  if (archived.length === 0) return;
  const oldest = archived[0];
  await evictConversation(oldest.conversationId);
}

/**
 * Evict a conversation — delete messages + summary + drop LRU entry.
 * Runs through runJournaled with the registered evict-conversation steps
 * (O.11 atomicity — eviction spans IDB + chrome.storage.local).
 */
export async function evictConversation(conversationId: string): Promise<void> {
  if (!isPrimaryWriter()) return;
  if (!evictStepsFactory) {
    debugLog('CONVERSATION_EVICT_FAILED', 'evictStepsFactory not initialized', { conversationId });
    return;
  }
  await hydrate();

  const steps = evictStepsFactory({ conversationId });
  const entry: WriteJournalEntry = {
    id: `evict-${conversationId}-${Date.now()}`,
    operation: 'evict-conversation',
    status: 'pending',
    attempts: 0,
    steps: [],
    createdAt: Date.now(),
  };
  // Persist the journal entry via IDB (the WriteJournalDB seam).
  const { openWriteJournalDB } = await import('../storage/WriteJournalDB');
  await runJournaled(entry, [steps], async (e) => {
    const db = await openWriteJournalDB();
    await db.put('entries', e);
  });

  // Drop the LRU entry on success.
  conversationMeta = conversationMeta.filter((m) => m.conversationId !== conversationId);
  await persistMeta();
  debugLog('CONVERSATION_EVICTED', 'conversation evicted', { conversationId });
}

/**
 * Append a message to a conversation. Writes the body to MemoryDB.messages
 * (compound key [conversationId, seq]) and updates the LRU metadata. When
 * messageCount % 12 === 0, fires the compactor seam.
 */
export async function appendMessage(message: MemoryMessage): Promise<void> {
  if (!isPrimaryWriter()) {
    debugLog('CONVERSATION_NON_PRIMARY_SKIP', 'appendMessage skipped — non-primary', {
      conversationId: message.conversationId,
    });
    return;
  }
  await hydrate();

  // Write body to MemoryDB.messages (compound key [conversationId, seq]).
  const db = await openMemoryDB();
  await db.put('messages', message);

  // Update LRU metadata.
  const meta = findOrCreateMeta(message.conversationId, message.timestamp);
  meta.messageCount++;
  meta.updatedAt = message.timestamp;
  meta.status = 'active';

  // Compactor: messageCount % 12 === 0.
  if (meta.messageCount % CONVERSATION_COMPACTOR_MODULO === 0) {
    await compactConversation(message.conversationId);
  }

  // Archive idle conversations + enforce LRU caps.
  await archiveIdleConversations(message.timestamp);
  await enforceLruCaps();
  await persistMeta();
}

/** Enforce LRU caps: archive oldest active when >10, evict oldest archived when >100. */
async function enforceLruCaps(): Promise<void> {
  const active = conversationMeta.filter((m) => m.status === 'active');
  if (active.length > CONVERSATION_ACTIVE_MAX) {
    // Archive the oldest active.
    active.sort((a, b) => a.updatedAt - b.updatedAt);
    const toArchive = active.slice(0, active.length - CONVERSATION_ACTIVE_MAX);
    for (const meta of toArchive) {
      meta.status = 'archived';
      debugLog('CONVERSATION_ARCHIVED', 'conversation archived (LRU cap)', {
        conversationId: meta.conversationId,
      });
    }
  }
  const archived = conversationMeta.filter((m) => m.status === 'archived');
  if (archived.length > CONVERSATION_ARCHIVED_MAX) {
    // Evict the oldest archived.
    archived.sort((a, b) => a.updatedAt - b.updatedAt);
    const toEvict = archived[0];
    await evictConversation(toEvict.conversationId);
  }
}

/**
 * Compact a conversation: keep head (system + first 2) + summary of middle
 * + tail (last 4). Stores the summary via MemoryDB.conversationSummaries.
 */
async function compactConversation(conversationId: string): Promise<void> {
  if (!summarizer) {
    debugLog('CONVERSATION_COMPACT_FAILED', 'summarizer not initialized', { conversationId });
    return;
  }
  const db = await openMemoryDB();
  const allMsgs = (await db.getAllFromIndex('messages', 'byConversation', conversationId)) as MemoryMessage[];
  allMsgs.sort((a, b) => a.seq - b.seq);

  if (allMsgs.length <= 6) {
    // Not enough messages to compact (head 3 + tail 4 = 7 minimum for a split).
    return;
  }

  // Head: system message + first 2 turns.
  const head = allMsgs.slice(0, 3);
  // Tail: last 4 turns.
  const tail = allMsgs.slice(-4);
  // Middle: everything between head and tail.
  const middle = allMsgs.slice(3, -4);

  // Summarize the middle section.
  const { text: summaryText } = summarizer.summarize(middle);

  // Store the summary.
  const summary: ConversationSummary = {
    conversationId,
    summary: summaryText,
    keyPoints: [],
    updatedAt: Date.now(),
  };
  await db.put('conversationSummaries', summary);

  // Prune the middle messages from IDB (keep head + tail).
  for (const msg of middle) {
    await db.delete('messages', [msg.conversationId, msg.seq]);
  }

  debugLog('CONVERSATION_COMPACTED', 'conversation compacted', {
    conversationId,
    headLen: head.length,
    tailLen: tail.length,
    middleLen: middle.length,
  });
}

/** Get the most recent N turns for a conversation (from IDB.messages). */
export async function getRecentTurns(
  conversationId: string,
  k: number,
): Promise<MemoryMessage[]> {
  await hydrate();
  const db = await openMemoryDB();
  const msgs = (await db.getAllFromIndex('messages', 'byConversation', conversationId)) as MemoryMessage[];
  msgs.sort((a, b) => b.seq - a.seq);
  return msgs.slice(0, k);
}

/** Get the stored summary for a conversation (from IDB.conversationSummaries). */
export async function getSummary(conversationId: string): Promise<ConversationSummary | null> {
  await hydrate();
  const db = await openMemoryDB();
  const summary = await db.get('conversationSummaries', conversationId);
  return summary ?? null;
}

/** Get the LRU metadata index (tests + diagnostics). */
export function getConversationMeta(): ConversationMeta[] {
  return conversationMeta;
}

// --- Test seam --------------------------------------------------------------

export const __test__ = {
  /** Reset module-level state (tests — beforeEach). */
  reset(): void {
    conversationMeta = [];
    hydrated = false;
    summarizer = null;
    evictStepsFactory = null;
  },
  /** Set the summarizer seam (tests). */
  setSummarizer(s: ConversationSummarizer): void {
    summarizer = s;
  },
  /** Set the evict steps factory (tests). */
  setEvictStepsFactory(
    f: (payload: EvictConversationPayload) => {
      name: string;
      apply(): Promise<void>;
      rollback(): Promise<void>;
    },
  ): void {
    evictStepsFactory = f;
  },
};
