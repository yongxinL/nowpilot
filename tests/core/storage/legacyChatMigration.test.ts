import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { closeDb, getDb, __test__ } from '../../../src/core/storage/NowPilotDB';
import { __test__ as migratorTest } from '../../../src/core/storage/IndexedDBMigrator';
import {
  LEGACY_CHAT_SOURCE_KEY,
  MIGRATION_ENTRY_ID,
  MIGRATION_STAGE_NAMES,
  NP_STORE_V3_FIELDS,
  NP_STORE_V3_SCHEMA_VERSION,
  projectNpStoreV3,
  runLegacyChatMigration,
  type ConversationMeta,
  type LegacyChatMigrationDeps,
} from '../../../src/core/storage/legacyChatMigration';
import {
  readAllConversations,
  readConversation,
  writeConversationWithMessages,
  type ChatSessionRecord,
  type MessageRecord,
} from '../../../src/core/storage/ChatHistoryDB';
import {
  MIGRATION_STAGE_NAMES as WRITE_JOURNAL_STAGE_NAMES,
  type JournalEntryStore,
  type WriteJournalEntry,
} from '../../../src/core/storage/WriteJournal';
import type { RecordErrorInput } from '../../../src/core/storage/ErrorStore';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';

/**
 * legacyChatMigration suite — plan 02-05 Task 3, the D2-15 case table.
 *
 * Every D2-15 case is a named case over synthetic conversations and synthetic
 * bodies only: no history; 1×1; 1×many; many; empty conversation; duplicate
 * execution; interrupted destination write; destination transaction failure;
 * destination read-back failure; source sanitisation failure; a service-worker
 * restart between EVERY journal stage (driven by stage name); already-migrated
 * destination; partially migrated installation; malformed conversation;
 * malformed message; unsupported schema version; timestamp and ordering
 * preservation; stable ids; no duplicate messages; the schema-version update;
 * the completion marker; and redacted errors and logs.
 *
 * The destination is the **real** ChatHistoryDB over `fake-indexeddb` — a
 * repository mock would make the migration cases vacuous — and the durable
 * `chrome.storage`-shaped stores are Maps, so a "restart" is a fresh
 * `runLegacyChatMigration` call against the same maps, never a module-state
 * trick. Every case resets the IndexedDB double and closes its handles
 * (RESEARCH Pitfall 8, D2-35).
 */

const SENTINEL = 'synthetic-body-DO-NOT-LEAK-migration-7f3a9c';
const BASE_TIME = 1_700_000_000_000;
const CLOCK = 1_700_000_100_000;

/** The exact allow-list, asserted against the module's own constant. */
const EXPECTED_V3_FIELDS = ['config', 'prompts', 'writeHistory', 'notes'];

// ---------------------------------------------------------------------------
// Legacy fixtures (synthetic only)
// ---------------------------------------------------------------------------

function legacyMessage(
  seq: number,
  role: 'user' | 'assistant' | 'system',
  content: string,
): Record<string, unknown> {
  return {
    id: `m_${seq}`,
    role,
    content,
    thoughtProcess: `${SENTINEL}-thought`,
    timestamp: BASE_TIME + seq * 1000,
    versions: [content],
    attachments: [{ id: `att_${seq}`, name: `${SENTINEL}-attachment` }],
  };
}

function legacySession(
  id: string,
  messages: unknown[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    title: `Conversation ${id}`,
    preview: `${SENTINEL}-preview`,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME + messages.length * 1000,
    isStarred: false,
    group: 'Today',
    messages,
    ...overrides,
  };
}

function legacyBlob(sessions: unknown[], version = 2): string {
  return JSON.stringify({
    state: {
      config: { activeProvider: 'openai', providers: {} },
      sessions,
      activeSessionId: 's_1',
      prompts: [{ id: 'p_1', title: 'Prompt' }],
      writeHistory: [{ id: 'w_1' }],
      notes: [{ id: 'n_1', title: 'Note' }],
    },
    version,
  });
}

/** The three-conversation fixture: 2 + 1 + 0 messages. */
function threeConversations(): unknown[] {
  return [
    legacySession('s_1', [
      legacyMessage(0, 'user', `${SENTINEL}-one`),
      legacyMessage(1, 'assistant', `${SENTINEL}-two`),
    ]),
    legacySession('s_2', [legacyMessage(0, 'system', `${SENTINEL}-three`)]),
    legacySession('s_3', []),
  ];
}

// ---------------------------------------------------------------------------
// Harness — injected seams over durable Maps plus the real ChatHistoryDB
// ---------------------------------------------------------------------------

interface Harness {
  deps: LegacyChatMigrationDeps;
  source: Map<string, unknown>;
  index: Map<string, ConversationMeta>;
  entries: Map<string, WriteJournalEntry>;
  failures: RecordErrorInput[];
  stats: { writes: number; indexWrites: number };
}

function plainJournal(base: Map<string, WriteJournalEntry>): JournalEntryStore {
  return {
    async load(id) {
      return base.get(id);
    },
    async persist(entry) {
      base.set(entry.id, structuredClone(entry));
    },
  };
}

/** A journal that dies once, right after `stage` is marked completed. */
function crashingJournal(
  base: Map<string, WriteJournalEntry>,
  stage: string,
): JournalEntryStore {
  let crashed = false;
  return {
    async load(id) {
      return base.get(id);
    },
    async persist(entry) {
      const reached = entry.steps.find((step) => step.name === stage)?.status === 'completed';
      if (!crashed && entry.status === 'applying' && reached) {
        crashed = true;
        throw new Error('simulated service-worker stop');
      }
      base.set(entry.id, structuredClone(entry));
    },
  };
}

const cleanPort = {
  async writeConversationWithMessages(
    session: ChatSessionRecord,
    messages: readonly MessageRecord[],
  ) {
    return writeConversationWithMessages(session, messages);
  },
  readConversation,
};

function createHarness(overrides: Partial<LegacyChatMigrationDeps> = {}): Harness {
  const source = new Map<string, unknown>();
  const index = new Map<string, ConversationMeta>();
  const entries = new Map<string, WriteJournalEntry>();
  const failures: RecordErrorInput[] = [];
  const stats = { writes: 0, indexWrites: 0 };

  const deps: LegacyChatMigrationDeps = {
    readSource: async () => source.get(LEGACY_CHAT_SOURCE_KEY),
    writeSource: async (value) => {
      source.set(LEGACY_CHAT_SOURCE_KEY, value);
    },
    writeConversationIndex: async (records) => {
      stats.indexWrites += 1;
      for (const record of records) index.set(record.id, record);
    },
    recordFailure: async (input) => {
      failures.push(input);
      return { ok: true };
    },
    chatHistory: {
      async writeConversationWithMessages(session, messages) {
        stats.writes += 1;
        return writeConversationWithMessages(session, messages);
      },
      readConversation,
    },
    journal: plainJournal(entries),
    now: () => CLOCK,
    ...overrides,
  };

  return { deps, source, index, entries, failures, stats };
}

/** The stored source blob, as a parsed object (it is always serialised here). */
function storedSource(harness: Harness): Record<string, any> {
  return JSON.parse(String(harness.source.get(LEGACY_CHAT_SOURCE_KEY)));
}

function rawSource(harness: Harness): string {
  return String(harness.source.get(LEGACY_CHAT_SOURCE_KEY));
}

function entryFor(harness: Harness): WriteJournalEntry | undefined {
  return harness.entries.get(MIGRATION_ENTRY_ID);
}

function stageStatus(harness: Harness, stage: string): string | undefined {
  return entryFor(harness)?.steps.find((step) => step.name === stage)?.status;
}

async function destinationCounts(): Promise<{ sessions: number; messages: number }> {
  const db = await getDb();
  return { sessions: await db.count('sessions'), messages: await db.count('messages') };
}

beforeEach(() => {
  (globalThis as unknown as { __resetIndexedDB: () => void }).__resetIndexedDB();
  clearLogs();
  __test__.reset();
  migratorTest.resetLastMigrationResult();
});

afterEach(() => {
  closeDb();
});

// ---------------------------------------------------------------------------
// Module surface
// ---------------------------------------------------------------------------

describe('legacyChatMigration — the declared surface', () => {
  it('re-exports the seven D2-09 stage names from WriteJournal and keeps the v3 allow-list', () => {
    expect(MIGRATION_STAGE_NAMES).toEqual([
      'discovered',
      'validated',
      'destination-write-started',
      'destination-written',
      'destination-verified',
      'source-sanitised',
      'completed',
    ]);
    // One declaration: the re-export is the same tuple, not a copy.
    expect(MIGRATION_STAGE_NAMES).toBe(WRITE_JOURNAL_STAGE_NAMES);
    expect([...NP_STORE_V3_FIELDS]).toEqual(EXPECTED_V3_FIELDS);
    expect(NP_STORE_V3_SCHEMA_VERSION).toBe(3);
  });

  it('projects the source through an allow-list that drops every body-bearing field', () => {
    const projected = projectNpStoreV3({
      config: { a: 1 },
      sessions: [{ id: 's_1', preview: SENTINEL, messages: [{ content: SENTINEL }] }],
      activeSessionId: 's_1',
      prompts: [],
      writeHistory: [],
      notes: [],
      somethingElse: SENTINEL,
    });

    expect(Object.keys(projected).sort()).toEqual([...EXPECTED_V3_FIELDS].sort());
    expect(JSON.stringify(projected)).not.toContain(SENTINEL);
    expect(JSON.stringify(projected)).not.toContain('sessions');
    // Idempotent and total.
    expect(projectNpStoreV3(projected)).toEqual(projected);
    for (const value of [null, undefined, [], 'nonsense', 42]) {
      expect(() => projectNpStoreV3(value)).not.toThrow();
      expect(projectNpStoreV3(value)).toEqual({});
    }
  });
});

// ---------------------------------------------------------------------------
// The D2-15 case table
// ---------------------------------------------------------------------------

describe('legacyChatMigration — the D2-15 case table', () => {
  it('no legacy history: zero migration work, no destructive change, and a completed entry', async () => {
    const harness = createHarness();

    const result = await runLegacyChatMigration(harness.deps);

    expect(result).toEqual({ ok: true, conversations: 0, sanitised: false });
    expect(harness.source.size).toBe(0);
    expect(harness.stats.writes).toBe(0);
    expect(harness.stats.indexWrites).toBe(0);
    expect(await destinationCounts()).toEqual({ sessions: 0, messages: 0 });

    const entry = entryFor(harness);
    expect(entry?.status).toBe('completed');
    expect(entry?.steps.map((step) => step.status)).toEqual(
      MIGRATION_STAGE_NAMES.map(() => 'completed'),
    );
  });

  it('one conversation with one message: the body reaches the destination and leaves the source', async () => {
    const harness = createHarness();
    harness.source.set(
      LEGACY_CHAT_SOURCE_KEY,
      legacyBlob([legacySession('s_1', [legacyMessage(0, 'user', `${SENTINEL}-only`)])]),
    );

    const result = await runLegacyChatMigration(harness.deps);

    expect(result).toEqual({ ok: true, conversations: 1, sanitised: true });
    const read = await readConversation('s_1');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.messages).toHaveLength(1);
    expect(read.messages[0].content).toBe(`${SENTINEL}-only`);
    expect(read.session.title).toBe('Conversation s_1');

    // The source is sanitised: version bumped, no body, no excerpt, no collection.
    const stored = storedSource(harness);
    expect(stored.version).toBe(NP_STORE_V3_SCHEMA_VERSION);
    expect(stored.state).not.toHaveProperty('sessions');
    expect(stored.state).not.toHaveProperty('activeSessionId');
    expect(rawSource(harness)).not.toContain(SENTINEL);
    expect(rawSource(harness)).not.toContain('preview');
    // Authorised lightweight metadata survives.
    expect(stored.state.prompts).toEqual([{ id: 'p_1', title: 'Prompt' }]);
    expect(stored.state.notes).toEqual([{ id: 'n_1', title: 'Note' }]);
    expect(stored.state.config).toEqual({ activeProvider: 'openai', providers: {} });
  });

  it('one conversation with many messages preserves integer ordering and timestamps', async () => {
    const harness = createHarness();
    const messages = [
      legacyMessage(0, 'user', `${SENTINEL}-0`),
      legacyMessage(1, 'assistant', `${SENTINEL}-1`),
      legacyMessage(2, 'user', `${SENTINEL}-2`),
      legacyMessage(3, 'assistant', `${SENTINEL}-3`),
    ];
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob([legacySession('s_1', messages)]));

    const result = await runLegacyChatMigration(harness.deps);

    expect(result.ok).toBe(true);
    const read = await readConversation('s_1');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.messages.map((message) => message.seq)).toEqual([0, 1, 2, 3]);
    expect(read.messages.map((message) => message.id)).toEqual(['m_0', 'm_1', 'm_2', 'm_3']);
    expect(read.messages.map((message) => message.timestamp)).toEqual(
      messages.map((message) => message.timestamp),
    );
    expect(read.messages.map((message) => message.content)).toEqual(
      messages.map((message) => message.content),
    );
  });

  it('many conversations migrate together with their own ids', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations()));

    const result = await runLegacyChatMigration(harness.deps);

    expect(result).toEqual({ ok: true, conversations: 3, sanitised: true });
    expect(await destinationCounts()).toEqual({ sessions: 3, messages: 3 });
    const all = await readAllConversations();
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.sessions.map((session) => session.id).sort()).toEqual(['s_1', 's_2', 's_3']);
  });

  it('an empty conversation migrates as a valid empty conversation', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob([legacySession('s_empty', [])]));

    const result = await runLegacyChatMigration(harness.deps);

    expect(result).toEqual({ ok: true, conversations: 1, sanitised: true });
    const read = await readConversation('s_empty');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.messages).toEqual([]);
    expect(harness.index.get('s_empty')).toMatchObject({
      id: 's_empty',
      status: 'active',
      messageCount: 0,
      created: BASE_TIME,
    });
  });

  it('duplicate execution performs no destructive change and creates no duplicates', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations()));

    const first = await runLegacyChatMigration(harness.deps);
    expect(first.ok).toBe(true);
    const counts = await destinationCounts();
    const sourceAfterFirst = rawSource(harness);
    const writesAfterFirst = harness.stats.writes;
    const indexWritesAfterFirst = harness.stats.indexWrites;

    const second = await runLegacyChatMigration(harness.deps);

    expect(second).toEqual({ ok: true, conversations: 0, sanitised: true });
    expect(await destinationCounts()).toEqual(counts);
    expect(rawSource(harness)).toBe(sourceAfterFirst);
    expect(harness.stats.writes).toBe(writesAfterFirst);
    expect(harness.stats.indexWrites).toBe(indexWritesAfterFirst);
    expect(entryFor(harness)?.status).toBe('completed');
  });

  it('an interrupted destination write resumes without duplicating records', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations()));

    let calls = 0;
    harness.deps.chatHistory = {
      async writeConversationWithMessages(session, messages) {
        calls += 1;
        if (calls > 1) throw new Error('simulated crash mid-write');
        return writeConversationWithMessages(session, messages);
      },
      readConversation,
    };

    const interrupted = await runLegacyChatMigration(harness.deps);

    expect(interrupted.ok).toBe(false);
    if (interrupted.ok) return;
    expect(interrupted.code).toBe('LEGACY_CHAT_MIGRATION_DESTINATION_WRITE_FAILED');
    expect(interrupted.stage).toBe('destination-written');
    expect(entryFor(harness)?.status).toBe('applying');
    expect(rawSource(harness)).toContain(SENTINEL);
    expect(await destinationCounts()).toEqual({ sessions: 1, messages: 2 });

    // A fresh run against the same durable stores finishes the migration.
    harness.deps.chatHistory = cleanPort;
    const resumed = await runLegacyChatMigration(harness.deps);

    expect(resumed).toEqual({ ok: true, conversations: 3, sanitised: true });
    expect(await destinationCounts()).toEqual({ sessions: 3, messages: 3 });
    expect(entryFor(harness)?.status).toBe('completed');
  });

  it('a destination transaction failure is typed, recorded and leaves the source intact', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations()));
    harness.deps.chatHistory = {
      async writeConversationWithMessages() {
        return { ok: false, code: 'CHAT_HISTORY_WRITE_FAILED' } as const;
      },
      readConversation,
    };

    const result = await runLegacyChatMigration(harness.deps);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('LEGACY_CHAT_MIGRATION_DESTINATION_WRITE_FAILED');
    expect(entryFor(harness)?.status).toBe('applying');
    expect(stageStatus(harness, 'destination-written')).toBe('failed');
    expect(rawSource(harness)).toContain(SENTINEL);
    expect(await destinationCounts()).toEqual({ sessions: 0, messages: 0 });
  });

  it('a destination read-back failure fails at destination-verified and leaves the source intact', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations()));
    harness.deps.chatHistory = {
      ...cleanPort,
      async readConversation() {
        return { ok: false, code: 'CHAT_HISTORY_READ_FAILED' } as const;
      },
    };

    const result = await runLegacyChatMigration(harness.deps);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('LEGACY_CHAT_MIGRATION_DESTINATION_VERIFY_FAILED');
    expect(result.stage).toBe('destination-verified');
    expect(entryFor(harness)?.status).toBe('applying');
    expect(stageStatus(harness, 'destination-written')).toBe('completed');
    expect(rawSource(harness)).toContain(SENTINEL);
    expect(await destinationCounts()).toEqual({ sessions: 3, messages: 3 });
  });

  it('a source sanitisation failure retains destination-verified and completes on retry', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations()));

    let sanitiseAttempts = 0;
    harness.deps.writeSource = async (value) => {
      sanitiseAttempts += 1;
      if (sanitiseAttempts === 1) throw new Error('simulated sanitisation failure');
      harness.source.set(LEGACY_CHAT_SOURCE_KEY, value);
    };

    const failed = await runLegacyChatMigration(harness.deps);

    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.code).toBe('LEGACY_CHAT_MIGRATION_SOURCE_SANITISE_FAILED');
    expect(failed.stage).toBe('source-sanitised');
    expect(entryFor(harness)?.status).toBe('applying');
    // The stage that matters survives: the destination is verified.
    expect(stageStatus(harness, 'destination-verified')).toBe('completed');
    expect(stageStatus(harness, 'source-sanitised')).toBe('failed');
    expect(rawSource(harness)).toContain(SENTINEL);
    const counts = await destinationCounts();

    // The retry completes the sanitisation from the existing journal entry.
    harness.deps.writeSource = async (value) => {
      harness.source.set(LEGACY_CHAT_SOURCE_KEY, value);
    };
    const retried = await runLegacyChatMigration(harness.deps);

    expect(retried).toEqual({ ok: true, conversations: 3, sanitised: true });
    expect(await destinationCounts()).toEqual(counts);
    expect(rawSource(harness)).not.toContain(SENTINEL);
    expect(storedSource(harness).version).toBe(NP_STORE_V3_SCHEMA_VERSION);
  });

  it('an already-migrated destination is not duplicated', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations()));

    // A destination that already holds the migrated conversation.
    const session: ChatSessionRecord = {
      id: 's_1',
      title: 'Conversation s_1',
      created: BASE_TIME,
      updated: BASE_TIME + 2000,
      starred: false,
    };
    const messages: MessageRecord[] = [
      {
        sessionId: 's_1',
        seq: 0,
        id: 'm_0',
        role: 'user',
        content: `${SENTINEL}-one`,
        timestamp: BASE_TIME,
      },
      {
        sessionId: 's_1',
        seq: 1,
        id: 'm_1',
        role: 'assistant',
        content: `${SENTINEL}-two`,
        timestamp: BASE_TIME + 1000,
      },
    ];
    const seeded = await writeConversationWithMessages(session, messages);
    expect(seeded.ok).toBe(true);

    const result = await runLegacyChatMigration(harness.deps);

    expect(result.ok).toBe(true);
    expect(await destinationCounts()).toEqual({ sessions: 3, messages: 3 });
    const read = await readConversation('s_1');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.messages.map((message) => message.id)).toEqual(['m_0', 'm_1']);
    expect(harness.index.get('s_1')?.title).toBe('Conversation s_1');
  });

  it('a partially migrated installation is completed without duplicates', async () => {
    const harness = createHarness();
    harness.source.set(
      LEGACY_CHAT_SOURCE_KEY,
      legacyBlob([
        legacySession('s_1', [legacyMessage(0, 'user', `${SENTINEL}-one`)]),
        legacySession('s_2', [legacyMessage(0, 'assistant', `${SENTINEL}-two`)]),
      ]),
    );

    // s_1 landed in a previous partial run; the source was never sanitised.
    const seeded = await writeConversationWithMessages(
      { id: 's_1', title: 'Conversation s_1', created: BASE_TIME, updated: BASE_TIME + 1000, starred: false },
      [
        {
          sessionId: 's_1',
          seq: 0,
          id: 'm_0',
          role: 'user',
          content: `${SENTINEL}-one`,
          timestamp: BASE_TIME,
        },
      ],
    );
    expect(seeded.ok).toBe(true);

    const result = await runLegacyChatMigration(harness.deps);

    expect(result).toEqual({ ok: true, conversations: 2, sanitised: true });
    expect(await destinationCounts()).toEqual({ sessions: 2, messages: 2 });
    expect(rawSource(harness)).not.toContain(SENTINEL);
    expect([...harness.index.keys()].sort()).toEqual(['s_1', 's_2']);
  });

  it('a malformed conversation is quarantined by safe id and blocks sanitisation', async () => {
    const harness = createHarness();
    harness.source.set(
      LEGACY_CHAT_SOURCE_KEY,
      legacyBlob([
        legacySession('s_1', [legacyMessage(0, 'user', `${SENTINEL}-one`)]),
        { id: 's_bad', title: 'No messages field' },
        'not-a-conversation',
      ]),
    );
    const before = rawSource(harness);

    const result = await runLegacyChatMigration(harness.deps);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('LEGACY_CHAT_MIGRATION_QUARANTINED_RECORDS');
    expect(result.stage).toBe('source-sanitised');
    expect(entryFor(harness)?.status).toBe('applying');
    expect(stageStatus(harness, 'destination-verified')).toBe('completed');
    // Never silently dropped, never deleted: the source is byte-identical.
    expect(rawSource(harness)).toBe(before);
    // The recoverable conversation still reached the destination.
    expect((await readConversation('s_1')).ok).toBe(true);

    const record = harness.failures.at(-1);
    expect(record?.code).toBe('IDB_MIGRATION_FAILED');
    expect(record?.context?.stage).toBe('source-sanitised');
    expect(record?.context?.quarantinedConversations).toBe(2);
    const serialised = JSON.stringify(record);
    expect(serialised).toContain('s_bad');
    expect(serialised).toContain('mig:session:2');
    expect(serialised).not.toContain(SENTINEL);
  });

  it('a malformed message is quarantined by safe id and blocks sanitisation', async () => {
    const harness = createHarness();
    harness.source.set(
      LEGACY_CHAT_SOURCE_KEY,
      legacyBlob([
        legacySession('s_1', [
          legacyMessage(0, 'user', `${SENTINEL}-ok`),
          { id: 'm_bad', role: 'wizard', content: SENTINEL, timestamp: BASE_TIME },
          { id: 'm_worse', role: 'user', timestamp: BASE_TIME },
        ]),
      ]),
    );
    const before = rawSource(harness);

    const result = await runLegacyChatMigration(harness.deps);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('LEGACY_CHAT_MIGRATION_QUARANTINED_RECORDS');
    expect(rawSource(harness)).toBe(before);
    expect(entryFor(harness)?.status).toBe('applying');

    const record = harness.failures.at(-1);
    expect(record?.context?.quarantinedMessages).toBe(2);
    const serialised = JSON.stringify(record);
    expect(serialised).toContain('s_1:1');
    expect(serialised).toContain('s_1:2');
    expect(serialised).not.toContain(SENTINEL);
    expect(serialised).not.toContain('wizard');

    // The valid message was still recovered, without duplicating anything.
    const read = await readConversation('s_1');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.messages.map((message) => message.id)).toEqual(['m_0']);
  });

  it('an unsupported schema version quarantines the record instead of guessing', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations(), 99));
    const before = rawSource(harness);

    const result = await runLegacyChatMigration(harness.deps);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('LEGACY_CHAT_MIGRATION_UNSUPPORTED_SCHEMA_VERSION');
    expect(result.stage).toBe('discovered');
    expect(entryFor(harness)?.status).toBe('applying');
    expect(rawSource(harness)).toBe(before);
    expect(harness.stats.writes).toBe(0);
    expect(harness.failures.at(-1)?.code).toBe('IDB_MIGRATION_FAILED');
  });

  it('an unrecognised source blob is never partially rewritten', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, '{not json');

    const result = await runLegacyChatMigration(harness.deps);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('LEGACY_CHAT_MIGRATION_UNSUPPORTED_SOURCE');
    expect(rawSource(harness)).toBe('{not json');
  });

  it('derives stable ids when a legacy identifier is absent', async () => {
    const harness = createHarness();
    harness.source.set(
      LEGACY_CHAT_SOURCE_KEY,
      legacyBlob([
        {
          title: 'No id here',
          messages: [{ role: 'user', content: `${SENTINEL}-anon`, timestamp: BASE_TIME }],
        },
      ]),
    );

    const result = await runLegacyChatMigration(harness.deps);

    expect(result).toEqual({ ok: true, conversations: 1, sanitised: true });
    const read = await readConversation('mig:session:0');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.messages[0].id).toBe('mig:mig:session:0:0');
    expect(read.messages[0].seq).toBe(0);
    expect(harness.index.get('mig:session:0')?.messageCount).toBe(1);
  });

  it('writes the conversation index as canonical ConversationMeta and never a body', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations()));

    const result = await runLegacyChatMigration(harness.deps);

    expect(result.ok).toBe(true);
    const meta = harness.index.get('s_1');
    expect(meta).toEqual({
      id: 's_1',
      title: 'Conversation s_1',
      status: 'active',
      created: BASE_TIME,
      lastAccessed: BASE_TIME + 2000,
      messageCount: 2,
    });
    expect(Object.keys(meta ?? {}).sort()).toEqual([
      'created',
      'id',
      'lastAccessed',
      'messageCount',
      'status',
      'title',
    ]);
    expect(JSON.stringify([...harness.index.values()])).not.toContain(SENTINEL);
    expect(JSON.stringify([...harness.index.values()])).not.toContain('preview');
  });

  it('redacts errors and logs — no body text reaches a record, a log or a journal entry', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations()));
    harness.deps.writeSource = async () => {
      throw new Error(`sanitisation failed on ${SENTINEL}`);
    };

    const result = await runLegacyChatMigration(harness.deps);
    expect(result.ok).toBe(false);

    // The journal entries, the failure records and the ring buffer are clean.
    expect(JSON.stringify([...harness.entries.values()])).not.toContain(SENTINEL);
    expect(JSON.stringify(harness.failures)).not.toContain(SENTINEL);
    expect(JSON.stringify(getRecentLogs())).not.toContain(SENTINEL);
    expect(rawSource(harness)).toContain(SENTINEL);

    for (const log of getRecentLogs()) {
      expect(log.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(log.context?.reason).not.toContain(SENTINEL);
    }
    for (const failure of harness.failures) {
      expect(failure.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Service-worker restart between every journal stage (D2-15)
// ---------------------------------------------------------------------------

describe('legacyChatMigration — restart between every journal stage', () => {
  for (const stage of MIGRATION_STAGE_NAMES) {
    it(`resumes after a service-worker stop between the ${stage} stage`, async () => {
      const harness = createHarness();
      harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations()));

      // Run 1 dies inside the journal persist that follows `stage`.
      harness.deps.journal = crashingJournal(harness.entries, stage);
      const interrupted = await runLegacyChatMigration(harness.deps);

      expect(interrupted.ok).toBe(false);
      const entry = entryFor(harness);
      expect(entry?.status).toBe('applying');
      expect(entry?.steps.find((step) => step.name === stage)?.status).toBe('completed');
      // Up to `destination-verified` the source must still hold its bodies; from
      // `source-sanitised` on, the sanitisation has already run, so the bodies
      // are gone and only the schema bump records what happened.
      const sanitisedAlready =
        MIGRATION_STAGE_NAMES.indexOf(stage) >= MIGRATION_STAGE_NAMES.indexOf('source-sanitised');
      if (sanitisedAlready) {
        expect(rawSource(harness)).not.toContain(SENTINEL);
        expect(storedSource(harness).version).toBe(NP_STORE_V3_SCHEMA_VERSION);
      } else {
        expect(rawSource(harness)).toContain(SENTINEL);
      }
      expect(harness.failures).toHaveLength(1);

      // Run 2 is a fresh run against the same durable stores.
      harness.deps.journal = plainJournal(harness.entries);
      const resumed = await runLegacyChatMigration(harness.deps);

      expect(resumed.ok).toBe(true);
      expect(entryFor(harness)?.status).toBe('completed');
      expect(entryFor(harness)?.steps.map((step) => step.status)).toEqual(
        MIGRATION_STAGE_NAMES.map(() => 'completed'),
      );
      expect(await destinationCounts()).toEqual({ sessions: 3, messages: 3 });
      expect(rawSource(harness)).not.toContain(SENTINEL);
      expect(storedSource(harness).version).toBe(NP_STORE_V3_SCHEMA_VERSION);
    });
  }
});

// ---------------------------------------------------------------------------
// After-success invariants (D2-15 closing list)
// ---------------------------------------------------------------------------

describe('legacyChatMigration — after-success invariants', () => {
  it('holds every invariant at once: destination complete, source clean, no duplicates, reads use the destination', async () => {
    const harness = createHarness();
    harness.source.set(LEGACY_CHAT_SOURCE_KEY, legacyBlob(threeConversations()));

    const result = await runLegacyChatMigration(harness.deps);
    expect(result).toEqual({ ok: true, conversations: 3, sanitised: true });

    // 1. Every expected body exists in ChatHistoryDB.
    const read = await readConversation('s_1');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.messages.map((message) => message.content)).toEqual([
      `${SENTINEL}-one`,
      `${SENTINEL}-two`,
    ]);

    // 2. No body remains in the source; the body-derived excerpt is gone.
    expect(rawSource(harness)).not.toContain(SENTINEL);
    expect(rawSource(harness)).not.toContain('preview');
    const state = storedSource(harness).state as Record<string, unknown>;
    expect(Object.keys(state).every((key) => (EXPECTED_V3_FIELDS as readonly string[]).includes(key))).toBe(true);

    // 3. No body in any journal entry, and the entry is the completion marker.
    expect(JSON.stringify([...harness.entries.values()])).not.toContain(SENTINEL);
    expect(entryFor(harness)?.status).toBe('completed');
    expect(stageStatus(harness, 'completed')).toBe('completed');

    // 4. No duplicate conversations or messages.
    const counts = await destinationCounts();
    expect(counts).toEqual({ sessions: 3, messages: 3 });
    const messages = (await getDb()).getAll('messages');
    const keys = (await messages).map((message) => `${message.sessionId}:${message.seq}`);
    expect(new Set(keys).size).toBe(keys.length);

    // 5. Authorised lightweight metadata survives, and the title is index metadata.
    expect(state.notes).toEqual([{ id: 'n_1', title: 'Note' }]);
    expect(harness.index.get('s_1')?.title).toBe('Conversation s_1');

    // 6. Re-running performs no destructive change.
    const before = rawSource(harness);
    const rerun = await runLegacyChatMigration(harness.deps);
    expect(rerun).toEqual({ ok: true, conversations: 0, sanitised: true });
    expect(rawSource(harness)).toBe(before);
    expect(await destinationCounts()).toEqual(counts);

    // 7. The destination is what a normal read uses.
    const all = await readAllConversations();
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.sessions).toHaveLength(3);
  });
});
