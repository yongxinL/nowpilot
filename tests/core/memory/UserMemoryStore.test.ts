import { describe, it, expect, beforeEach } from 'vitest';
import {
  UserMemoryStore,
  resetUserMemoryDb,
} from '../../../src/core/memory/UserMemoryStore';
import {
  PreferenceMemoryStore,
  resetPreferenceMemoryDb,
} from '../../../src/core/memory/PreferenceMemoryStore';
import { resetConversationMemoryDb } from '../../../src/core/memory/ConversationMemoryStore';
import type { MemoryRecord } from '../../../src/core/memory/MemoryRecord';

async function resetMemoryDb(): Promise<void> {
  await Promise.all([resetUserMemoryDb(), resetPreferenceMemoryDb(), resetConversationMemoryDb()]);
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('NotesDB');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('UserMemoryStore', () => {
  let store: UserMemoryStore;

  beforeEach(async () => {
    await resetMemoryDb();
    store = new UserMemoryStore();
  });

  it('upsert assigns confidence from source via D-07 mapping (Test 3)', async () => {
    const cases: Array<[string, number]> = [
      ['explicit-user', 1.0],
      ['verified-state', 0.8],
      ['previous-explicit', 0.7],
      ['inferred', 0.5],
    ];
    for (const [source, expected] of cases) {
      const result = await store.upsert({
        content: `fact from ${source}`,
        memoryType: 'semantic',
        tags: [],
        sensitivity: 'private',
        source: source as 'explicit-user',
      });
      expect(result.success).toBe(true);
      if (!result.success) continue;
      const fact = await store.get(result.recordId);
      expect(fact?.confidence).toBe(expected);
      expect(fact?.source).toBe(source);
    }
  });

  it('upsert generates a UUID id when none is provided', async () => {
    const result = await store.upsert({
      content: 'no id provided',
      memoryType: 'semantic',
      tags: [],
      sensitivity: 'private',
      source: 'explicit-user',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.recordId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    const fact = await store.get(result.recordId);
    expect(fact?.content).toBe('no id provided');
  });

  it('upsert with existing id updates the record but keeps immutable confidence (D-07)', async () => {
    const first = await store.upsert({
      content: 'v1',
      memoryType: 'semantic',
      tags: [],
      sensitivity: 'private',
      source: 'explicit-user',
    });
    expect(first.success).toBe(true);
    if (!first.success) return;
    const id = first.recordId;
    const before = await store.get(id);
    expect(before?.createdAt).toBeDefined();

    const second = await store.upsert({
      id,
      content: 'v2',
      memoryType: 'semantic',
      tags: ['updated'],
      sensitivity: 'public',
      source: 'inferred',
    });
    expect(second.success).toBe(true);

    const after = await store.get(id);
    expect(after?.content).toBe('v2');
    expect(after?.tags).toEqual(['updated']);
    // confidence is immutable — NOT re-derived from the new source
    expect(after?.confidence).toBe(1.0);
    expect(after?.createdAt).toBe(before?.createdAt);
    expect(after?.useCount).toBe(0);
  });

  it('incrementUseCount increments useCount and updates lastUsedAt, leaving confidence untouched (Test 4)', async () => {
    const result = await store.upsert({
      content: 'count me',
      memoryType: 'semantic',
      tags: [],
      sensitivity: 'private',
      source: 'verified-state',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const id = result.recordId;

    await store.incrementUseCount(id);
    const once = await store.get(id);
    expect(once?.useCount).toBe(1);
    expect(once?.confidence).toBe(0.8);
    expect(once?.lastUsedAt).toBeDefined();

    await store.incrementUseCount(id);
    const twice = await store.get(id);
    expect(twice?.useCount).toBe(2);
    expect(twice?.confidence).toBe(0.8); // D-07: confidence never modified by retrieval frequency
  });

  it('incrementUseCount throws for an unknown id', async () => {
    await expect(store.incrementUseCount('missing-id')).rejects.toThrow();
  });

  it('findByTag returns facts with the tag; getAll returns all facts (Test 5)', async () => {
    await store.upsert({
      content: 'prefers minimal UI',
      memoryType: 'semantic',
      tags: ['preferences'],
      sensitivity: 'private',
      source: 'explicit-user',
    });
    await store.upsert({
      content: 'uses vim',
      memoryType: 'semantic',
      tags: ['tools'],
      sensitivity: 'private',
      source: 'explicit-user',
    });

    const prefs = await store.findByTag('preferences');
    expect(prefs).toHaveLength(1);
    expect(prefs[0].content).toBe('prefers minimal UI');

    const all = await store.getAll();
    expect(all).toHaveLength(2);
  });

  it('remove deletes the fact', async () => {
    const result = await store.upsert({
      content: 'doomed',
      memoryType: 'semantic',
      tags: [],
      sensitivity: 'private',
      source: 'explicit-user',
    });
    if (!result.success) return;
    await store.remove(result.recordId);
    expect(await store.get(result.recordId)).toBeNull();
  });

  it('rejects invalid records with VALIDATION_ERROR at the Zod boundary (Test 7)', async () => {
    const emptyContent = await store.upsert({
      content: '',
      memoryType: 'semantic',
      tags: [],
      sensitivity: 'private',
      source: 'explicit-user',
    });
    expect(emptyContent.success).toBe(false);
    if (!emptyContent.success) {
      expect(emptyContent.code).toBe('VALIDATION_ERROR');
    }

    // user facts are always semantic — preference type rejected at boundary
    const wrongType = await store.upsert({
      content: 'preference attempt',
      memoryType: 'preference' as never,
      tags: [],
      sensitivity: 'private',
      source: 'explicit-user',
    });
    expect(wrongType.success).toBe(false);
    if (!wrongType.success) {
      expect(wrongType.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('PreferenceMemoryStore', () => {
  let prefs: PreferenceMemoryStore;
  let userStore: UserMemoryStore;

  beforeEach(async () => {
    await resetMemoryDb();
    prefs = new PreferenceMemoryStore();
    userStore = new UserMemoryStore();
  });

  it("set('np_persona', cfg) persists; get('np_persona') returns it; get('nonexistent') returns null (Test 6)", async () => {
    await prefs.set('np_persona', { name: 'Test', tone: 'casual' });
    expect(await prefs.get('np_persona')).toEqual({ name: 'Test', tone: 'casual' });
    expect(await prefs.get('nonexistent')).toBeNull();
  });

  it('stores preferences as preference-type records with explicit-user confidence 1.0', async () => {
    await prefs.set('np_persona', { tone: 'casual' });
    const raw = await userStore.getAll();
    const record = raw.find((f) => (f as unknown as MemoryRecord).memoryType === 'preference');
    expect(record).toBeDefined();
    if (!record) return;
    expect(record.confidence).toBe(1.0);
    expect(record.source).toBe('explicit-user');
    expect(record.tags).toEqual(['preference', 'np_persona']);
  });

  it('getPersona() convenience returns the np_persona config or null', async () => {
    expect(await prefs.getPersona()).toBeNull();
    await prefs.set('np_persona', { name: 'Ada', tone: 'formal' });
    expect(await prefs.getPersona()).toEqual({ name: 'Ada', tone: 'formal' });
  });

  it('getAll() returns all preferences as a key → value record', async () => {
    await prefs.set('np_persona', { tone: 'casual' });
    await prefs.set('ui_theme', 'dark');
    const all = await prefs.getAll();
    expect(all).toEqual({ np_persona: { tone: 'casual' }, ui_theme: 'dark' });
  });

  it('set() upserts by key — repeated set replaces the value without duplicating records', async () => {
    await prefs.set('np_persona', { name: 'V1' });
    await prefs.set('np_persona', { name: 'V2' });
    expect(await prefs.get('np_persona')).toEqual({ name: 'V2' });
    expect(Object.keys(await prefs.getAll())).toHaveLength(1);
  });
});
