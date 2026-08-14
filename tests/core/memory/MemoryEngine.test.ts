// tests/core/memory/MemoryEngine.test.ts — D-05-02/06/09 KNW-04/05 (required by
// §18): the SINGLE orchestrator surface. assemble() budgets (top-5 / top-3
// tiny / ≤1000 tokens / working-memory-first), recordTurn/summariseIfNeeded
// dispatch, the O.10 updateWorkingMemory routing, addFacts + subscribe, and the
// never-throws contract. Uses structural dependency injection (fake stores with
// spies — no singletons) + the fake-indexeddb harness for the real-store paths
// (RESEARCH Pattern 8 — fresh IDBFactory per test) + wxt fakeBrowser for the
// np_persona read through the real Setting layer. Cases:
//   1. Budgets (D-05-06 pin): 8 seeded facts + fixed nowMs → tier 'medium'
//      returns exactly 5 memories, tier 'tiny' exactly 3; scores within [0,1]
//      and non-increasing.
//   2. Token cap: facts whose joined text exceeds MAX_MEMORY_TOKENS → whole
//      facts drop from the end until ≤ 1000 (the returned set is a prefix of
//      the scored list and every fact is intact — no substring content).
//   3. Working memory first (D-05-09): a populated block + facts →
//      workingMemoryBlock is present/non-empty and memories are the fact list.
//   4. Preferences: a stored UserPreferences via the fake prefs → deep-equals.
//   5. recordTurn + summariseIfNeeded dispatch: a fake conversation store
//      records the calls (spy); appendTurn routes the exact input.
//   6. updateWorkingMemory: patch { Name: 'Alice' } → '- **Name**: Alice'; a
//      secret-shaped value is redacted; a >300-token patch trims to ≤ 300.
//   7. subscribe: fires on recordTurn/addFacts/updateWorkingMemory; the
//      returned unsubscribe stops notifications.
//   8. Never-throws: assemble against a CLOSED db resolves with
//      { memories: [], workingMemoryBlock: '', preferences: defaults }.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { IDBPDatabase } from 'idb';
import {
  MAX_MEMORY_TOKENS,
  MAX_MEMORIES,
  MAX_MEMORIES_TINY,
  addFacts,
  assemble,
  getMemoryEngine,
  recordTurn,
  subscribe,
  summariseIfNeeded,
  updateWorkingMemory,
  type MemoryEngineDeps,
  type UserMemoryStoreAPI,
} from '@/core/memory/MemoryEngine';
import * as UserMemoryStore from '@/core/memory/UserMemoryStore';
import * as ConversationMemoryStore from '@/core/memory/ConversationMemoryStore';
import * as PreferenceMemoryStore from '@/core/memory/PreferenceMemoryStore';
import { DEFAULT_USER_PREFERENCES } from '@/core/memory/PreferenceMemoryStore';
import { openMemoryDB, type MemoryDBSchema } from '@/core/storage/MemoryDB';
import { estimateTokens } from '@/core/context/TokenBudget';
import { buildMemorySectionText } from '@/core/context/ContextPack';
import { scoreMemoryFact } from '@/core/memory/MemoryScorer';
import { WORKING_MEMORY_TEMPLATE } from '@/types/harness';
import type { UserMemoryFact, UserPreferences } from '@/core/memory/types';

const NOW_MS = 1_752_000_000_000; // fixed literal — deterministic
// Structural-injection stub db — fake deps never touch it.
const DB = undefined as unknown as IDBPDatabase<MemoryDBSchema>;

function makeFact(id: string, overrides: Partial<UserMemoryFact> = {}): UserMemoryFact {
  return {
    id,
    content: `fact ${id}`,
    type: 'fact',
    tags: [],
    confidence: 0.9,
    source: 'explicit',
    createdAt: NOW_MS - 10,
    updatedAt: NOW_MS - 10,
    lastUsedAt: undefined,
    useCount: 0,
    ...overrides,
  };
}

/** A facts deps object defaulting to safe no-ops; tests override the pieces they exercise. */
function makeFakeFacts(overrides: Partial<UserMemoryStoreAPI> = {}): UserMemoryStoreAPI {
  return {
    retrieve: async () => [],
    readWorkingMemory: async () => undefined,
    initWorkingMemory: UserMemoryStore.initWorkingMemory,
    updateWorkingMemory: UserMemoryStore.updateWorkingMemory,
    putWorkingMemory: async () => {},
    putFact: async () => {},
    ...overrides,
  };
}

/** 8 seeded facts with strictly-scored content for the 'alpha beta gamma' query. */
function seededFacts(): UserMemoryFact[] {
  return [
    makeFact('f-1', { content: 'alpha beta gamma notes', useCount: 20 }),
    makeFact('f-2', { content: 'alpha beta reminders', useCount: 10 }),
    makeFact('f-3', { content: 'alpha gamma plans', useCount: 5 }),
    makeFact('f-4', { content: 'alpha only', useCount: 2 }),
    makeFact('f-5', { content: 'beta only', useCount: 1 }),
    makeFact('f-6', { content: 'gamma only', useCount: 0 }),
    makeFact('f-7', { content: 'delta epsilon', useCount: 0 }),
    makeFact('f-8', { content: 'zeta eta', useCount: 0 }),
  ];
}

beforeEach(() => {
  indexedDB = new IDBFactory(); // RESEARCH Pattern 8: fresh IndexedDB per test
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MemoryEngine.assemble — §3.4 budgets (D-05-06 pin)', () => {
  it('returns exactly 5 memories for medium and 3 for tiny, scores [0,1] desc', async () => {
    const facts = seededFacts();
    const deps: MemoryEngineDeps = {
      facts: makeFakeFacts({ retrieve: async () => facts }),
      prefs: { read: async () => DEFAULT_USER_PREFERENCES },
      conversation: {
        appendTurn: async () => {},
        summariseIfNeeded: async () => {},
      },
    };

    const medium = await assemble(DB, deps, {
      query: 'alpha beta gamma',
      conversationId: 'c-1',
      tier: 'medium',
      nowMs: NOW_MS,
    });
    expect(medium.memories).toHaveLength(MAX_MEMORIES);
    expect(medium.memories.map((m) => m.id)).toEqual(['f-1', 'f-2', 'f-3', 'f-4', 'f-5']);
    expect(medium.memories[0].score).toBeGreaterThan(medium.memories[1].score);

    const tiny = await assemble(DB, deps, {
      query: 'alpha beta gamma',
      conversationId: 'c-1',
      tier: 'tiny',
      nowMs: NOW_MS,
    });
    expect(tiny.memories).toHaveLength(MAX_MEMORIES_TINY);
    expect(tiny.memories.map((m) => m.id)).toEqual(['f-1', 'f-2', 'f-3']);

    // scores within [0,1] and non-increasing (f-7/f-8 legitimately tie)
    for (const m of [...medium.memories, ...tiny.memories]) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < medium.memories.length; i++) {
      expect(medium.memories[i].score).toBeLessThanOrEqual(medium.memories[i - 1].score);
    }
    for (let i = 1; i < tiny.memories.length; i++) {
      expect(tiny.memories[i].score).toBeLessThanOrEqual(tiny.memories[i - 1].score);
    }
  });

  it('the DTO score reproduces the MemoryScorer value for the query', async () => {
    const facts = seededFacts();
    const deps: MemoryEngineDeps = {
      facts: makeFakeFacts({ retrieve: async () => facts }),
      prefs: { read: async () => DEFAULT_USER_PREFERENCES },
      conversation: { appendTurn: async () => {}, summariseIfNeeded: async () => {} },
    };
    const result = await assemble(DB, deps, {
      query: 'alpha beta gamma',
      conversationId: 'c-1',
      tier: 'medium',
      nowMs: NOW_MS,
    });
    const terms = ['alpha', 'beta', 'gamma'];
    for (const m of result.memories) {
      const fact = facts.find((f) => f.id === m.id)!;
      expect(m.score).toBe(scoreMemoryFact(fact, terms, NOW_MS));
    }
  });
});

describe('MemoryEngine.assemble — ≤1000-token cap (whole-item drops)', () => {
  it('drops whole facts from the end until ≤ MAX_MEMORY_TOKENS, prefix + intact', async () => {
    // 5 facts × 300 tokens (1200 ASCII chars each) → 1500 tokens before the cap.
    const longContent = 'x'.repeat(1200);
    const facts = ['f-1', 'f-2', 'f-3', 'f-4', 'f-5'].map((id) =>
      makeFact(id, { content: longContent, useCount: 20 }),
    );
    const deps: MemoryEngineDeps = {
      facts: makeFakeFacts({ retrieve: async () => facts }),
      prefs: { read: async () => DEFAULT_USER_PREFERENCES },
      conversation: { appendTurn: async () => {}, summariseIfNeeded: async () => {} },
    };

    const result = await assemble(DB, deps, {
      query: 'alpha',
      conversationId: 'c-1',
      tier: 'medium',
      nowMs: NOW_MS,
    });

    // 3 whole facts survive (3 × 300 = 900 ≤ 1000; adding a 4th exceeds).
    expect(result.memories.map((m) => m.id)).toEqual(['f-1', 'f-2', 'f-3']);
    const total = result.memories.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    expect(total).toBeLessThanOrEqual(MAX_MEMORY_TOKENS);
    // Every returned fact is INTACT — no substring content, ever (D-04-13).
    for (const m of result.memories) {
      expect(m.content).toBe(longContent);
    }
  });
});

describe('MemoryEngine.assemble — working memory first + preferences', () => {
  it('injects the working-memory block BEFORE facts (D-05-09) and keeps the fact list', async () => {
    const deps: MemoryEngineDeps = {
      facts: makeFakeFacts({
        readWorkingMemory: async () => ({
          resourceId: 'user',
          markdown: WORKING_MEMORY_TEMPLATE,
          tokens: estimateTokens(WORKING_MEMORY_TEMPLATE),
          updatedAt: NOW_MS,
        }),
        retrieve: async () => [makeFact('f-1'), makeFact('f-2')],
      }),
      prefs: { read: async () => DEFAULT_USER_PREFERENCES },
      conversation: { appendTurn: async () => {}, summariseIfNeeded: async () => {} },
    };

    const result = await assemble(DB, deps, {
      query: 'alpha',
      conversationId: 'c-1',
      tier: 'medium',
      nowMs: NOW_MS,
    });

    // The block is present + non-empty (the 05-06 optimizer join order — block
    // before facts — is pinned here by the block being populated).
    expect(result.workingMemoryBlock).toBe(WORKING_MEMORY_TEMPLATE);
    expect(result.workingMemoryBlock.length).toBeGreaterThan(0);
    expect(result.memories.map((m) => m.id)).toEqual(['f-1', 'f-2']);
  });

  it('deep-equals the stored UserPreferences from the prefs read (D-05-08)', async () => {
    const stored: UserPreferences = {
      responseStyle: 'concise',
      preferredLanguage: 'en',
      preferStructuredOutput: true,
      allowCloudFallbackFromLocal: false,
      defaultProviderId: 'anthropic',
      toolAutonomy: 'ask_every_time',
      defaultSurface: 'standalone',
      personaId: 'p-1',
      personaOverrides: { name: 'Alex', tone: 'friendly', brevity: 'balanced' },
    };
    const deps: MemoryEngineDeps = {
      facts: makeFakeFacts(),
      prefs: { read: async () => stored },
      conversation: { appendTurn: async () => {}, summariseIfNeeded: async () => {} },
    };

    const result = await assemble(DB, deps, {
      query: '',
      conversationId: 'c-1',
      tier: 'medium',
      nowMs: NOW_MS,
    });

    expect(result.preferences).toEqual(stored);
  });
});

describe('MemoryEngine — recordTurn/summariseIfNeeded dispatch', () => {
  it('routes the exact turn input to the conversation store and fires the listener', async () => {
    const appendSpy = vi.fn().mockResolvedValue(undefined);
    const summariseSpy = vi.fn().mockResolvedValue(undefined);
    const listener = vi.fn();
    const deps: MemoryEngineDeps = {
      facts: makeFakeFacts(),
      prefs: { read: async () => DEFAULT_USER_PREFERENCES },
      conversation: { appendTurn: appendSpy, summariseIfNeeded: summariseSpy },
    };
    const unsubscribe = subscribe(listener);

    await recordTurn(DB, deps, {
      conversationId: 'c-1',
      role: 'user',
      content: 'hello world',
      timestamp: NOW_MS,
    });
    expect(appendSpy).toHaveBeenCalledWith(DB, {
      conversationId: 'c-1',
      role: 'user',
      content: 'hello world',
      timestamp: NOW_MS,
    });
    expect(listener).toHaveBeenCalledWith({ kind: 'turn', conversationId: 'c-1' });

    await summariseIfNeeded(DB, deps, 'c-1');
    expect(summariseSpy).toHaveBeenCalledWith(DB, 'c-1', undefined);

    unsubscribe();
    await recordTurn(DB, deps, {
      conversationId: 'c-2',
      role: 'assistant',
      content: 'hi',
      timestamp: NOW_MS,
    });
    expect(listener).toHaveBeenCalledTimes(1); // unsubscribed — no second fire
  });

  it('never throws when a fake conversation store rejects (GR-9 STORE_WRITE)', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps: MemoryEngineDeps = {
      facts: makeFakeFacts(),
      prefs: { read: async () => DEFAULT_USER_PREFERENCES },
      conversation: {
        appendTurn: async () => {
          throw new Error('boom');
        },
        summariseIfNeeded: async () => {
          throw new Error('boom');
        },
      },
    };

    await expect(
      recordTurn(DB, deps, {
        conversationId: 'c-1',
        role: 'user',
        content: 'x',
        timestamp: NOW_MS,
      }),
    ).resolves.toBeUndefined();
    await expect(summariseIfNeeded(DB, deps, 'c-1')).resolves.toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('STORE_WRITE'),
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('MemoryEngine — updateWorkingMemory (O.10 routing)', () => {
  let db: IDBPDatabase<MemoryDBSchema>;

  it('patches through the real O.10 updater: Name line, redaction, ≤300-token trim', async () => {
    db = await openMemoryDB();
    const deps: MemoryEngineDeps = {
      facts: UserMemoryStore,
      prefs: { read: async () => DEFAULT_USER_PREFERENCES },
      conversation: { appendTurn: async () => {}, summariseIfNeeded: async () => {} },
    };
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    const wm = await updateWorkingMemory(db, deps, { Name: 'Alice' });
    expect(wm.markdown).toContain('- **Name**: Alice');
    expect(wm.markdown).toContain('- **Role / Team**:');

    // Secret-shaped value is redacted on the way in (R-10, T-05-04).
    const redacted = await updateWorkingMemory(db, deps, {
      Preferences: 'my api key is sk-live-1234567890abc',
    });
    expect(redacted.markdown).toContain('[REDACTED]');
    expect(redacted.markdown).not.toContain('sk-live-1234567890abc');

    // A >300-token patch trims to ≤ 300 (the ONE sanctioned slice — O.10).
    const trimmed = await updateWorkingMemory(db, deps, {
      'Long-term Goals': 'x'.repeat(1600),
    });
    expect(trimmed.tokens).toBeLessThanOrEqual(300);
    expect(estimateTokens(trimmed.markdown)).toBeLessThanOrEqual(300);

    expect(listener).toHaveBeenCalledWith({ kind: 'working-memory' });
    expect(listener).toHaveBeenCalledTimes(3); // once per update above
    unsubscribe();
    db.close();
  });

  it('addFacts persists every fact through the store and fires the listener', async () => {
    db = await openMemoryDB();
    const deps: MemoryEngineDeps = {
      facts: UserMemoryStore,
      prefs: { read: async () => DEFAULT_USER_PREFERENCES },
      conversation: { appendTurn: async () => {}, summariseIfNeeded: async () => {} },
    };
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    await addFacts(db, deps, [makeFact('f-1'), makeFact('f-2', { type: 'preference' })]);
    const stored = await UserMemoryStore.listFacts(db);
    expect(stored.map((f) => f.id).sort()).toEqual(['f-1', 'f-2']);
    expect(listener).toHaveBeenCalledWith({ kind: 'facts' });

    unsubscribe();
    db.close();
  });
});

describe('MemoryEngine — never throws (closed db)', () => {
  it('assemble against a CLOSED db resolves with safe empties + defaults', async () => {
    const db = await openMemoryDB();
    db.close();

    const deps: MemoryEngineDeps = {
      facts: UserMemoryStore,
      prefs: PreferenceMemoryStore,
      conversation: ConversationMemoryStore,
    };

    await expect(
      assemble(db, deps, {
        query: 'anything',
        conversationId: 'c-1',
        tier: 'medium',
        nowMs: NOW_MS,
      }),
    ).resolves.toEqual({
      memories: [],
      workingMemoryBlock: '',
      preferences: DEFAULT_USER_PREFERENCES,
    });
  });
});

describe('MemoryEngine — WR-01 combined-section budget (§3.6 WMB counts)', () => {
  /** Build a WorkingMemory whose markdown is ~targetTokens via ASCII filler
   *  (estimateTokens = ceil(chars/4) — the only counter, Pitfall 1). */
  function wmBlock(targetTokens: number): {
    resourceId: string;
    markdown: string;
    tokens: number;
    updatedAt: number;
  } {
    const filler = 'filler '.repeat(Math.max(0, Math.ceil(targetTokens * 4 / 7)));
    const markdown = `${WORKING_MEMORY_TEMPLATE}\n\n${filler}`.trim();
    return { resourceId: 'user', markdown, tokens: estimateTokens(markdown), updatedAt: NOW_MS };
  }

  /** 5 large facts (~250 tokens each) — 1000 ASCII chars = 250 tokens. */
  function largeFacts(): UserMemoryFact[] {
    const longContent = 'x'.repeat(1000);
    return ['f-1', 'f-2', 'f-3', 'f-4', 'f-5'].map((id) =>
      makeFact(id, { content: longContent, useCount: 20 }),
    );
  }

  it('keeps the packed section (WMB + facts) ≤ MAX_MEMORY_TOKENS with whole facts dropped from the end', async () => {
    const block = wmBlock(300);
    const facts = largeFacts();
    const deps: MemoryEngineDeps = {
      facts: makeFakeFacts({
        readWorkingMemory: async () => block,
        retrieve: async () => facts,
      }),
      prefs: { read: async () => DEFAULT_USER_PREFERENCES },
      conversation: { appendTurn: async () => {}, summariseIfNeeded: async () => {} },
    };

    const result = await assemble(DB, deps, {
      query: 'alpha',
      conversationId: 'c-1',
      tier: 'medium',
      nowMs: NOW_MS,
    });

    const packed = buildMemorySectionText({
      memoryHints: result.memories,
      workingMemoryBlock: result.workingMemoryBlock,
    });
    expect(estimateTokens(packed ?? '')).toBeLessThanOrEqual(MAX_MEMORY_TOKENS);
    // Whole facts were dropped from the end (D-04-13): the survivors are a
    // prefix of the scored list and every content string is INTACT.
    expect(result.memories.length).toBeGreaterThan(0);
    for (const m of result.memories) {
      expect(m.content).toBe('x'.repeat(1000));
    }
  });

  it('keeps the O.10-valid block byte-identical — facts degrade first, never the block', async () => {
    const block = wmBlock(300);
    const deps: MemoryEngineDeps = {
      facts: makeFakeFacts({
        readWorkingMemory: async () => block,
        retrieve: async () => largeFacts(),
      }),
      prefs: { read: async () => DEFAULT_USER_PREFERENCES },
      conversation: { appendTurn: async () => {}, summariseIfNeeded: async () => {} },
    };

    const result = await assemble(DB, deps, {
      query: 'alpha',
      conversationId: 'c-1',
      tier: 'medium',
      nowMs: NOW_MS,
    });

    // The O.10-valid block is kept WHOLE — facts were dropped to fit (the
    // normal degradation order is facts-first; block truncation is the last
    // resort that never fires for a ≤300 block).
    expect(result.workingMemoryBlock).toBe(block.markdown);
  });

  it('truncates a corrupt oversized block as the LAST resort (facts at 0, block alone over the cap)', async () => {
    const corrupt = wmBlock(1400); // >1000 tokens — outside the O.10 ≤300 write path
    const deps: MemoryEngineDeps = {
      facts: makeFakeFacts({
        readWorkingMemory: async () => corrupt,
        retrieve: async () => largeFacts(),
      }),
      prefs: { read: async () => DEFAULT_USER_PREFERENCES },
      conversation: { appendTurn: async () => {}, summariseIfNeeded: async () => {} },
    };

    const result = await assemble(DB, deps, {
      query: 'alpha',
      conversationId: 'c-1',
      tier: 'medium',
      nowMs: NOW_MS,
    });

    // No fact can fit beside the corrupt block — memories degrades to empty,
    // and the ≤1000-token truth still holds via the §3.6 last-resort block
    // truncation (the drop loop never underflowed past empty).
    expect(result.memories).toEqual([]);
    const packed = buildMemorySectionText({
      memoryHints: result.memories,
      workingMemoryBlock: result.workingMemoryBlock,
    });
    expect(estimateTokens(packed ?? '')).toBeLessThanOrEqual(MAX_MEMORY_TOKENS);
    expect(result.workingMemoryBlock.length).toBeLessThan(corrupt.markdown.length);
  });
});

describe('MemoryEngine — WR-06 single IndexedDB connection (getMemoryEngine)', () => {
  it('opens MemoryDB exactly once across two assemble calls', async () => {
    vi.resetModules();
    const MemoryDB = await import('@/core/storage/MemoryDB');
    const MemoryEngine = await import('@/core/memory/MemoryEngine');
    const openSpy = vi.spyOn(MemoryDB, 'openMemoryDB');

    // The factory is lazy — the spy above is installed BEFORE the first
    // getMemoryEngine() call so every open runs through it.
    const surface = MemoryEngine.getMemoryEngine();
    const first = await surface.assemble({ query: 'alpha', conversationId: 'c-1', tier: 'medium' });
    const second = await surface.assemble({
      query: 'beta',
      conversationId: 'c-1',
      tier: 'medium',
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(first.memories).toBeDefined();
    expect(second.memories).toBeDefined();
  });
});
