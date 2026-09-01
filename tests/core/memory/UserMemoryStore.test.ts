import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * UserMemoryStore — §18 required: LRU ≤500 eviction, redaction,
 * np_facts metadata ↔ MemoryDB.userFacts body consistency, single-writer gate.
 */

// Mutable isPrimaryWriter mock — tests toggle it per-case.
const isPrimaryWriterMock = vi.fn(() => true);
vi.mock('../../../src/core/workspace/WorkspaceStore', () => ({
  isPrimaryWriter: () => isPrimaryWriterMock(),
}));

import {
  upsertFact,
  getTopFacts,
  getFactCount,
  getMetadataIndex,
  __test__,
} from '../../../src/core/memory/UserMemoryStore';
import { NP_FACTS_MAX } from '../../../src/core/memory/UserMemoryStore';
import { openMemoryDB } from '../../../src/core/storage/MemoryDB';
import type { UserMemoryFact } from '../../../src/core/memory/types';

const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;

/** Build a UserMemoryFact fixture. */
function makeFact(overrides: Partial<UserMemoryFact> = {}): UserMemoryFact {
  return {
    id: `f-${Math.random().toString(36).slice(2)}`,
    content: 'ServiceNow incident resolution steps',
    type: 'fact',
    tags: ['servicenow', 'incident'],
    confidence: 0.9,
    source: 'explicit',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    useCount: 0,
    ...overrides,
  };
}

describe('UserMemoryStore — D-104/D-113', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    storageMap.clear();
    __test__.reset();
  });

  it('UPSERT → body in MemoryDB.userFacts AND metadata in np_facts chromeStorageMap', async () => {
    const fact = makeFact({ id: 'fact-1' });
    await upsertFact(fact);

    // Body persisted to IDB
    const db = await openMemoryDB();
    const stored = await db.get('userFacts', 'fact-1');
    expect(stored).toBeDefined();
    expect(stored?.content).toBe(fact.content);
    db.close();

    // Metadata in chrome.storage.local np_facts
    const raw = storageMap.get('np_facts');
    expect(raw).toBeDefined();
    const meta = JSON.parse(raw!) as Array<{ id: string }>;
    expect(meta).toHaveLength(1);
    expect(meta[0].id).toBe('fact-1');
  });

  it('REDACTION: a fact with an apiKey-shaped secret is redacted in the persisted body', async () => {
    const fact = makeFact({ id: 'fact-secret' });
    // Inject a secret-shaped field (simulating untrusted content).
    (fact as any).apiKey = 'sk-supersecret123';
    await upsertFact(fact);

    const db = await openMemoryDB();
    const stored = await db.get('userFacts', 'fact-secret');
    expect(stored).toBeDefined();
    // The persisted body must NOT contain the raw secret.
    expect((stored as any).apiKey).not.toBe('sk-supersecret123');
    // redactSensitiveValue empties secret-shaped keys.
    expect((stored as any).apiKey).toBe('');
    db.close();
  });

  it('LRU: upsert 505 facts → np_facts metadata length ≤ 500 (eviction)', async () => {
    for (let i = 0; i < NP_FACTS_MAX + 5; i++) {
      await upsertFact(makeFact({ id: `fact-${i}`, updatedAt: Date.now() + i, useCount: i }));
    }

    // Metadata index capped at 500
    expect(getFactCount()).toBeLessThanOrEqual(NP_FACTS_MAX);

    // The np_facts blob reflects the cap
    const raw = storageMap.get('np_facts');
    expect(raw).toBeDefined();
    const meta = JSON.parse(raw!) as Array<{ id: string }>;
    expect(meta.length).toBeLessThanOrEqual(NP_FACTS_MAX);

    // Lowest useCount entries (0..4) were evicted — highest survive.
    const ids = meta.map((m) => m.id);
    expect(ids).not.toContain('fact-0');
    expect(ids).toContain('fact-504');
  });

  it('TOP-K RETRIEVAL: 10 facts, getTopFacts(query,{k:5}) returns 5 in score-desc order', async () => {
    // Hold useCount/updatedAt constant so keyword scoring is the only
    // differentiator (javascript-tagged facts must outrank python ones).
    // i % 2 === 0 → 5 javascript facts (≥ k=5).
    for (let i = 0; i < 10; i++) {
      await upsertFact(
        makeFact({
          id: `fact-${i}`,
          content: `note about ${i % 2 === 0 ? 'javascript' : 'python'} development`,
          tags: [i % 2 === 0 ? 'javascript' : 'python', 'coding'],
          useCount: 5,
          updatedAt: Date.now(),
        }),
      );
    }

    const results = await getTopFacts('javascript', { k: 5 });
    expect(results).toHaveLength(5);

    // All results should be javascript-tagged (higher keyword score)
    for (const r of results) {
      expect(r.tags).toContain('javascript');
    }
  });

  it('SINGLE-WRITER: isPrimaryWriter false → upsertFact is a no-op', async () => {
    // Toggle the mutable mock to return false for this test
    isPrimaryWriterMock.mockReturnValue(false);

    const fact = makeFact({ id: 'fact-nonprimary' });
    await upsertFact(fact);

    // No metadata growth (upsert was a no-op)
    expect(getFactCount()).toBe(0);

    // Restore mock
    isPrimaryWriterMock.mockReturnValue(true);
  });

  it('METADATA CONSISTENCY: re-upsert same id updates metadata in place (no duplicate)', async () => {
    const fact = makeFact({ id: 'fact-dup', useCount: 1 });
    await upsertFact(fact);

    // Re-upsert with updated useCount
    await upsertFact({ ...fact, useCount: 10 });

    expect(getFactCount()).toBe(1);
    const entry = getMetadataIndex().find((m) => m.id === 'fact-dup');
    expect(entry?.useCount).toBe(10);
  });
});
