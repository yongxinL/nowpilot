import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getMemoryEngine, resetMemoryEngine } from '../../../src/core/memory/MemoryEngine';
import { ConversationMemoryStore } from '../../../src/core/memory/ConversationMemoryStore';
import { UserMemoryStore, resetUserMemoryDb } from '../../../src/core/memory/UserMemoryStore';
import {
  PreferenceMemoryStore,
  resetPreferenceMemoryDb,
} from '../../../src/core/memory/PreferenceMemoryStore';
import { resetConversationMemoryDb } from '../../../src/core/memory/ConversationMemoryStore';
import { resetJournalDb, getEntriesByStatus } from '../../../src/core/storage/WriteJournal';
import { subscribe, setPrimarySurfaceId } from '../../../src/core/runtime/BroadcastBus';

/**
 * Minimal BroadcastChannel stub — BroadcastBus publishes WORKSPACE_UPDATED
 * on a BroadcastChannel; the stub delivers locally so subscription wiring
 * is observable in tests.
 */
class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  posted: unknown[] = [];
  constructor(name: string) {
    this.name = name;
  }
  postMessage(data: unknown): void {
    this.posted.push(data);
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }
  close(): void {
    this.onmessage = null;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}
vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

async function resetAllDbs(): Promise<void> {
  await Promise.all([resetUserMemoryDb(), resetConversationMemoryDb(), resetPreferenceMemoryDb()]);
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('NotesDB');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
  await resetJournalDb();
}

const MINUTE_MS = 60 * 1000;

describe('MemoryEngine', () => {
  let engine: ReturnType<typeof getMemoryEngine>;

  beforeEach(async () => {
    resetMemoryEngine();
    // MEM-02 production wiring (Plan 03): the engine reads its surface id
    // from the entrypoint global; the BroadcastBus election elects this
    // surface as primary so writes are allowed.
    (globalThis as unknown as { __NOWPILOT_SURFACE_ID__?: string }).__NOWPILOT_SURFACE_ID__ =
      'test-surface';
    setPrimarySurfaceId('test-surface');
    engine = getMemoryEngine();
    await resetAllDbs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as unknown as { __NOWPILOT_SURFACE_ID__?: string }).__NOWPILOT_SURFACE_ID__;
    setPrimarySurfaceId(null);
  });

  it('retrieve returns conversation items, then scored user facts, then preferences — in that order (Test 1)', async () => {
    const convStore = new ConversationMemoryStore();
    const prefStore = new PreferenceMemoryStore();
    const userStore = new UserMemoryStore();

    for (let i = 1; i <= 5; i++) {
      await convStore.appendMessage('c1', { role: 'user', content: `turn ${i}`, timestamp: i });
    }
    await convStore.saveSummary({
      id: crypto.randomUUID(),
      conversationId: 'c1',
      summary: 'User decided to use theme X',
      messageRange: { start: 0, end: 4 },
      createdAt: 1000,
    });
    await userStore.upsert({
      content: 'prefers theme X',
      memoryType: 'semantic',
      tags: ['preferences'],
      sensitivity: 'private',
      source: 'explicit-user',
    });
    await prefStore.set('np_persona', { name: 'Ada', tone: 'formal' });

    const result = await engine.retrieve({ conversationId: 'c1', query: 'theme', tier: 'small' });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const sources = result.items.map((i) => i.sourceId);
    const summaryIdx = sources.findIndex((s) => s.startsWith('memory.conversation.summary.'));
    const turnIdx = sources.findIndex((s) => s.startsWith('memory.conversation.turn.'));
    const factIdx = sources.findIndex((s) => s.startsWith('memory.user.fact.'));
    const prefIdx = sources.findIndex((s) => s.startsWith('memory.preference'));

    expect(summaryIdx).toBeGreaterThanOrEqual(0);
    expect(turnIdx).toBeGreaterThan(summaryIdx);
    expect(factIdx).toBeGreaterThan(turnIdx);
    expect(prefIdx).toBeGreaterThan(factIdx);
  });

  it('tier-gates user facts: at most 3 for tiny, at most 5 for small (Test 2)', async () => {
    for (let i = 0; i < 6; i++) {
      const result = await engine.write(
        {
          content: 'theme planning notes',
          memoryType: 'semantic',
          tags: ['preferences'],
          sensitivity: 'private',
          source: 'explicit-user',
        },
        'user-action',
      );
      expect(result.success).toBe(true);
    }

    const tiny = await engine.retrieve({ conversationId: 'c1', query: 'theme', tier: 'tiny' });
    expect(tiny.success).toBe(true);
    if (!tiny.success) return;
    const tinyFacts = tiny.items.filter((i) => i.sourceId.startsWith('memory.user.fact.'));
    expect(tinyFacts.length).toBeLessThanOrEqual(3);
    expect(tinyFacts).toHaveLength(3);

    const small = await engine.retrieve({ conversationId: 'c1', query: 'theme', tier: 'small' });
    expect(small.success).toBe(true);
    if (!small.success) return;
    const smallFacts = small.items.filter((i) => i.sourceId.startsWith('memory.user.fact.'));
    expect(smallFacts.length).toBeLessThanOrEqual(5);
    expect(smallFacts).toHaveLength(5);
  });

  it('ContextItems carry the D-18 sourceId format (Test 3)', async () => {
    const convStore = new ConversationMemoryStore();
    await convStore.appendMessage('c1', { role: 'user', content: 'hello', timestamp: 1 });
    const summaryId = crypto.randomUUID();
    await convStore.saveSummary({
      id: summaryId,
      conversationId: 'c1',
      summary: 'summary text',
      messageRange: { start: 0, end: 0 },
      createdAt: 1,
    });
    await engine.write(
      {
        content: 'fact content',
        memoryType: 'semantic',
        tags: [],
        sensitivity: 'private',
        source: 'explicit-user',
      },
      'user-action',
    );

    const result = await engine.retrieve({ conversationId: 'c1', query: 'fact', tier: 'small' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const sources = result.items.map((i) => i.sourceId);

    expect(sources.some((s) => s === `memory.conversation.summary.${summaryId}`)).toBe(true);
    expect(sources.some((s) => /^memory\.conversation\.turn\.\d+$/.test(s))).toBe(true);
    expect(sources.some((s) => /^memory\.user\.fact\.[0-9a-f-]{36}$/.test(s))).toBe(true);
  });

  it('ContextItems have kind=memory, trust≥0, and inherit sensitivity from the record (Test 4)', async () => {
    await engine.write(
      {
        content: 'confidential fact',
        memoryType: 'semantic',
        tags: [],
        sensitivity: 'confidential',
        source: 'explicit-user',
      },
      'user-action',
    );

    const result = await engine.retrieve({ conversationId: 'c1', query: 'confidential', tier: 'small' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const factItem = result.items.find((i) => i.sourceId.startsWith('memory.user.fact.'));
    expect(factItem).toBeDefined();
    if (!factItem) return;
    expect(factItem.kind).toBe('memory');
    expect(factItem.trust).toBeGreaterThanOrEqual(0);
    expect(factItem.sensitivity).toBe('confidential');
    expect(factItem.instructionAuthority).toBe('data');
  });

  it('write succeeds on the primary surface; rejects with NOT_PRIMARY_SURFACE on a secondary surface (Test 5)', async () => {
    const ok = await engine.write(
      {
        content: 'primary write',
        memoryType: 'semantic',
        tags: [],
        sensitivity: 'private',
        source: 'explicit-user',
      },
      'user-action',
    );
    expect(ok.success).toBe(true);

    vi.spyOn(engine, 'isPrimarySurface').mockReturnValue(false);
    const blocked = await engine.write(
      {
        content: 'secondary write',
        memoryType: 'semantic',
        tags: [],
        sensitivity: 'private',
        source: 'explicit-user',
      },
      'user-action',
    );
    expect(blocked.success).toBe(false);
    if (!blocked.success) {
      expect(blocked.code).toBe('NOT_PRIMARY_SURFACE');
    }

    // The blocked write must not create ANY journal entry — only the
    // successful write earlier in this test left one
    expect(await getEntriesByStatus('pending')).toHaveLength(0);
    expect(await getEntriesByStatus('failed')).toHaveLength(0);
    expect(await getEntriesByStatus('completed')).toHaveLength(1);
    const userStore = new UserMemoryStore();
    const facts = await userStore.getAll();
    expect(facts.some((f) => f.content === 'secondary write')).toBe(false);
  });

  it('enforces MEM-02 via the real BroadcastBus election — a non-elected surface is rejected with NOT_PRIMARY_SURFACE', async () => {
    // beforeEach elected 'test-surface' as primary through BroadcastBus —
    // this engine instance is on the elected primary
    const ok = await engine.write(
      {
        content: 'primary write via election',
        memoryType: 'semantic',
        tags: [],
        sensitivity: 'private',
        source: 'explicit-user',
      },
      'user-action',
    );
    expect(ok.success).toBe(true);

    // a fresh engine instance on a DIFFERENT surface is read-only
    resetMemoryEngine();
    const secondary = getMemoryEngine('other-surface');
    const blocked = await secondary.write(
      {
        content: 'secondary write via election',
        memoryType: 'semantic',
        tags: [],
        sensitivity: 'private',
        source: 'explicit-user',
      },
      'user-action',
    );
    expect(blocked.success).toBe(false);
    if (!blocked.success) {
      expect(blocked.code).toBe('NOT_PRIMARY_SURFACE');
    }
    // the blocked write created no journal entry and persisted nothing
    expect(await getEntriesByStatus('pending')).toHaveLength(0);
    expect(await getEntriesByStatus('failed')).toHaveLength(0);
    const userStore = new UserMemoryStore();
    const facts = await userStore.getAll();
    expect(facts.some((f) => f.content === 'secondary write via election')).toBe(false);
  });

  it('write wraps in a WriteJournal entry with the matching operation and broadcasts WORKSPACE_UPDATED (Test 6)', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribe('WORKSPACE_UPDATED', listener);

    const result = await engine.write(
      {
        content: 'journaled fact',
        memoryType: 'semantic',
        tags: [],
        sensitivity: 'private',
        source: 'verified-state',
      },
      'user-action',
    );
    expect(result.success).toBe(true);

    unsubscribe();

    const completed = await getEntriesByStatus('completed');
    const entry = completed.find((e) => e.operation === 'update-user-memory');
    expect(entry).toBeDefined();
    if (entry) {
      expect(entry.steps.map((s) => s.name)).toContain('write-memory-record');
      expect(entry.steps.map((s) => s.name)).toContain('broadcast-workspace-update');
      expect(entry.steps.every((s) => s.status === 'completed')).toBe(true);
    }
    expect(listener).toHaveBeenCalledWith({ source: 'memory' });
  });

  it('write assigns confidence from the source via the D-07 mapping (Test 7)', async () => {
    const result = await engine.write(
      {
        content: 'inferred fact',
        memoryType: 'semantic',
        tags: [],
        sensitivity: 'private',
        source: 'inferred',
      },
      'user-action',
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    const userStore = new UserMemoryStore();
    const fact = await userStore.get(result.recordId);
    expect(fact?.confidence).toBe(0.5);
  });

  it('getPreferences returns the preference record from PreferenceMemoryStore (Test 8)', async () => {
    const prefStore = new PreferenceMemoryStore();
    await prefStore.set('np_persona', { name: 'Ada' });
    await prefStore.set('ui_theme', 'dark');

    expect(await engine.getPreferences()).toEqual({
      np_persona: { name: 'Ada' },
      ui_theme: 'dark',
    });
    expect(await engine.getPersona()).toEqual({ name: 'Ada' });
  });

  it('retrieve with no stored memory returns success with an empty items array (Test 9)', async () => {
    const result = await engine.retrieve({ conversationId: 'ghost', query: 'anything', tier: 'tiny' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.items).toEqual([]);
  });

  it('retrieve with a conversation but no facts/preferences returns only conversation items', async () => {
    const convStore = new ConversationMemoryStore();
    await convStore.appendMessage('c1', { role: 'user', content: 'hi', timestamp: 1 });
    const result = await engine.retrieve({ conversationId: 'c1', query: 'hi', tier: 'tiny' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const sources = result.items.map((i) => i.sourceId);
    expect(sources.every((s) => s.startsWith('memory.conversation.'))).toBe(true);
  });

  it('rejects AI-pipeline writes of semantic/preference memory with WRITE_BOUNDARY_VIOLATION (Test 10 / D-05)', async () => {
    const semantic = await engine.write(
      {
        content: 'ai hallucinated fact',
        memoryType: 'semantic',
        tags: [],
        sensitivity: 'private',
        source: 'inferred',
      },
      'ai-pipeline',
    );
    expect(semantic.success).toBe(false);
    if (!semantic.success) {
      expect(semantic.code).toBe('WRITE_BOUNDARY_VIOLATION');
    }

    const preference = await engine.write(
      {
        content: 'ai set preference',
        memoryType: 'preference',
        tags: [],
        sensitivity: 'private',
        source: 'explicit-user',
      },
      'ai-pipeline',
    );
    expect(preference.success).toBe(false);
    if (!preference.success) {
      expect(preference.code).toBe('WRITE_BOUNDARY_VIOLATION');
    }

    // Nothing was persisted by either rejected write
    const userStore = new UserMemoryStore();
    expect(await userStore.getAll()).toHaveLength(0);
  });

  it('retrieval is deterministic — same query and tier produce identical ContextItem[]', async () => {
    // freshness/relevance use the D-08 30-day decay against Date.now();
    // pin the clock so both retrieves run with identical time context
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    for (let i = 0; i < 4; i++) {
      await engine.write(
        {
          content: 'theme planning notes',
          memoryType: 'semantic',
          tags: ['preferences'],
          sensitivity: 'private',
          source: 'explicit-user',
        },
        'user-action',
      );
    }
    const first = await engine.retrieve({ conversationId: 'c1', query: 'theme', tier: 'small' });
    const second = await engine.retrieve({ conversationId: 'c1', query: 'theme', tier: 'small' });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(first.items).toEqual(second.items);
  });

  it('trackConversationActivity enforces max 10 active conversations (Test 11 / D-11)', async () => {
    const fixedNow = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    for (let i = 1; i <= 10; i++) {
      await engine.trackConversationActivity(`conv-${i}`);
    }
    expect(await engine.getConversationStats()).toEqual({ active: 10, archived: 0, total: 10 });

    const eleventh = await engine.trackConversationActivity('conv-11');
    const stats = await engine.getConversationStats();
    expect(stats.active).toBe(10);
    expect(stats.archived).toBe(1);
    expect(eleventh.evicted).toEqual([]);
  });

  it('trackConversationActivity evicts the oldest archived conversation beyond 100 (Test 11 / D-11)', async () => {
    const fixedNow = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    let lastEvicted: string[] = [];
    for (let i = 1; i <= 111; i++) {
      const result = await engine.trackConversationActivity(`conv-${i}`);
      if (result.evicted.length > 0) {
        lastEvicted = result.evicted;
      }
    }
    const stats = await engine.getConversationStats();
    expect(stats.active).toBe(10);
    expect(stats.archived).toBe(100);
    expect(stats.total).toBe(110);
    // oldest archived (conv-1) evicted first
    expect(lastEvicted).toEqual(['conv-1']);
  });

  it('trackConversationActivity archives idle conversations after 30 minutes (Test 12 / D-11)', async () => {
    let now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    await engine.trackConversationActivity('conv-a');
    await engine.trackConversationActivity('conv-b');
    expect(await engine.getConversationStats()).toEqual({ active: 2, archived: 0, total: 2 });

    // 31 minutes later: conv-a AND conv-b are both idle (>30 min) → both
    // archived when conv-c becomes active
    now += 31 * MINUTE_MS;
    await engine.trackConversationActivity('conv-c');
    expect(await engine.getConversationStats()).toEqual({ active: 1, archived: 2, total: 3 });

    // another 31 minutes: conv-c now idle → archived; conv-a reactivates
    now += 31 * MINUTE_MS;
    await engine.trackConversationActivity('conv-a');
    expect(await engine.getConversationStats()).toEqual({ active: 1, archived: 3, total: 4 });
  });

  it('getConversationStats reports accurate LRU state (Test 13)', async () => {
    expect(await engine.getConversationStats()).toEqual({ active: 0, archived: 0, total: 0 });
    await engine.trackConversationActivity('only-one');
    expect(await engine.getConversationStats()).toEqual({ active: 1, archived: 0, total: 1 });
  });
});
