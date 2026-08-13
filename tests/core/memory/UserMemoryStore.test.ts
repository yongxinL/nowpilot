// tests/core/memory/UserMemoryStore.test.ts — D-05-04/D-05-09 KNW-04 (required
// by §18): UserMemoryFact CRUD over the v2-migrated MemoryDB.userFacts, scored
// retrieve, and the Appendix O.10 working-memory updater. Uses the
// fake-indexeddb harness (RESEARCH Pattern 8 — fresh IDBFactory per test, from
// NotesDB.test.ts L10-14/49-59). Cases:
//   1. Migration data-carry pin (A3/Pitfall 2 regression): seed a v1 MemoryDB
//      (raw open at version 1) with 2 legacy §21.4 Fact rows → open via the
//      migrated openMemoryDB → the rows are UserMemoryFact-shaped with
//      type 'fact', tags [], updatedAt === created, useCount 0.
//   2. putFact/getFact/listFacts/deleteFact round-trips (fresh factory each).
//   3. retrieve: 3 facts scored at a fixed nowMs — returned order matches score
//      desc, scores within [0,1]; a zero-match query returns [].
//   4. Working memory (O.10): init produces the 5-line template;
//      updateWorkingMemory('Name', 'Alice') replaces the Name line and keeps
//      the other 4; a secret-shaped value is redacted in the stored markdown
//      (TraceRedactor assertion, T-05-04); a 400-token patch trims to ≤ 300
//      tokens; putWorkingMemory/readWorkingMemory round-trip through the store.
//   5. Write-never-throws: putFact against a CLOSED db resolves (no rejection —
//      debugLog fired, GR-9).
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { IDBPDatabase } from 'idb';
import {
  deleteFact,
  getFact,
  initWorkingMemory,
  listFacts,
  putFact,
  putWorkingMemory,
  readWorkingMemory,
  retrieve,
  updateWorkingMemory,
  WORKING_MEMORY_RESOURCE_ID,
} from '@/core/memory/UserMemoryStore';
import { openMemoryDB, type Fact, type MemoryDBSchema } from '@/core/storage/MemoryDB';
import { scoreMemoryFact } from '@/core/memory/MemoryScorer';
import { estimateTokens } from '@/core/context/TokenBudget';
import { WORKING_MEMORY_TEMPLATE } from '@/types/harness';
import type { UserMemoryFact } from '@/core/memory/types';

const NOW_MS = 1_752_000_000_000; // fixed literal — deterministic

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
    useCount: 0, // default-fill value — a re-upsert with defaults preserves existing
    ...overrides,
  };
}

/** Seed a v1 'MemoryDB' (raw open at version 1) with 2 legacy §21.4 Fact rows. */
function seedV1MemoryDB(rows: Fact[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MemoryDB', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('messages', { keyPath: ['conversationId', 'seq'] });
      db.createObjectStore('userFacts', { keyPath: 'id' });
      db.createObjectStore('conversationSummaries', { keyPath: 'conversationId' });
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('userFacts', 'readwrite');
      for (const row of rows) tx.objectStore('userFacts').put(row);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

describe('UserMemoryStore — v1→v2 migration data-carry (A3/Pitfall 2 pin)', () => {
  beforeEach(() => {
    indexedDB = new IDBFactory(); // RESEARCH Pattern 8: fresh IndexedDB per test
  });

  afterEach(() => {});

  it('carries legacy Fact rows into UserMemoryFact with default-fill', async () => {
    await seedV1MemoryDB([
      {
        id: 'legacy-1',
        content: 'prefers concise answers',
        confidence: 0.8,
        source: 'extracted',
        created: 1000,
      },
      {
        id: 'legacy-2',
        content: 'works on servicenow',
        confidence: 0.9,
        source: 'explicit',
        created: 2000,
      },
    ]);

    const db = await openMemoryDB(); // migrated open — runs the v1→v2 step
    const facts = await listFacts(db);
    expect(facts).toHaveLength(2);
    const byId = new Map(facts.map((f) => [f.id, f]));
    expect(byId.get('legacy-1')).toMatchObject({
      type: 'fact',
      tags: [],
      confidence: 0.8,
      createdAt: 1000,
      updatedAt: 1000, // updatedAt === created (default-fill)
      useCount: 0,
      lastUsedAt: undefined,
    });
    expect(byId.get('legacy-2')).toMatchObject({
      type: 'fact',
      tags: [],
      createdAt: 2000,
      updatedAt: 2000,
      useCount: 0,
    });
    expect(byId.get('legacy-1')?.content).toBe('prefers concise answers');
    db.close();
  });
});

describe('UserMemoryStore — fact CRUD round-trips', () => {
  let db: IDBPDatabase<MemoryDBSchema>;

  beforeEach(() => {
    indexedDB = new IDBFactory(); // RESEARCH Pattern 8
  });

  afterEach(() => {
    db?.close();
  });

  it('round-trips putFact/getFact/listFacts/deleteFact', async () => {
    db = await openMemoryDB();
    const fact = makeFact('f-1', { tags: ['style'], useCount: 3 });
    await putFact(db, fact);
    expect(await getFact(db, 'f-1')).toEqual(fact);
    expect((await listFacts(db)).map((f) => f.id)).toEqual(['f-1']);

    await deleteFact(db, 'f-1');
    expect(await getFact(db, 'f-1')).toBeUndefined();
    expect(await listFacts(db)).toEqual([]);
  });

  it('re-upsert preserves useCount/lastUsedAt unless the caller overrides', async () => {
    db = await openMemoryDB();
    await putFact(db, makeFact('f-1', { useCount: 5, lastUsedAt: 111 }));

    // Re-upsert with defaults (useCount 0 / lastUsedAt undefined) → keep existing.
    await putFact(db, makeFact('f-1', { content: 'updated content' }));
    const kept = await getFact(db, 'f-1');
    expect(kept?.useCount).toBe(5);
    expect(kept?.lastUsedAt).toBe(111);
    expect(kept?.content).toBe('updated content');

    // Explicit override wins.
    await putFact(db, makeFact('f-1', { content: 'again', useCount: 9, lastUsedAt: 222 }));
    const overridden = await getFact(db, 'f-1');
    expect(overridden?.useCount).toBe(9);
    expect(overridden?.lastUsedAt).toBe(222);
  });

  it('retrieve scores facts with MemoryScorer and sorts desc; zero-match returns []', async () => {
    db = await openMemoryDB();
    // f-1: full keyword match → highest. f-2: partial. f-3: no match at all.
    await putFact(
      db,
      makeFact('f-1', {
        content: 'prefers concise answers',
        tags: ['style'],
        useCount: 20,
        updatedAt: NOW_MS,
      }),
    );
    await putFact(
      db,
      makeFact('f-2', {
        content: 'works on servicenow incidents',
        tags: ['tooling'],
        useCount: 2,
        updatedAt: NOW_MS - 86_400_000,
      }),
    );
    await putFact(
      db,
      makeFact('f-3', {
        content: 'loves hiking on weekends',
        tags: ['hobby'],
        confidence: 0.4, // small confidence contribution → score > 0, still lowest
        useCount: 0,
        updatedAt: NOW_MS - 40 * 86_400_000,
      }),
    );

    const scored = await retrieve(db, 'prefers concise', NOW_MS);
    expect(scored.map((f) => f.id)).toEqual(['f-1', 'f-2', 'f-3']); // score desc

    // scores within [0,1] and strictly descending for the returned order
    const scores = scored.map((f) => scoreMemoryFact(f, ['prefers', 'concise'], NOW_MS));
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(scores[0]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBeGreaterThan(scores[2]);
    expect(scores[2]).toBe(0.4 * 0.05); // f-3: confidence contribution only
  });

  it('retrieve returns [] for a zero-match query over zero-contribution facts', async () => {
    db = await openMemoryDB();
    await putFact(
      db,
      makeFact('z-1', {
        content: 'zzzqqq unrelated',
        confidence: 0,
        useCount: 0,
        updatedAt: NOW_MS - 40 * 86_400_000,
      }),
    );
    const zero = await retrieve(db, 'aaaaa', NOW_MS);
    expect(zero).toEqual([]);
  });
});

describe('UserMemoryStore — Appendix O.10 working memory', () => {
  let db: IDBPDatabase<MemoryDBSchema>;

  beforeEach(() => {
    indexedDB = new IDBFactory(); // RESEARCH Pattern 8
  });

  afterEach(() => {
    db?.close();
  });

  it('initWorkingMemory fills the fixed 5-line template with estimateTokens', () => {
    const wm = initWorkingMemory();
    expect(wm.resourceId).toBe(WORKING_MEMORY_RESOURCE_ID);
    expect(wm.markdown).toBe(WORKING_MEMORY_TEMPLATE);
    // §3.6 "five-line template" = the 5 field lines (header + Name/Role/
    // Environment/Preferences/Long-term Goals)
    expect(wm.markdown.match(/- \*\*/g)).toHaveLength(5);
    expect(wm.tokens).toBe(estimateTokens(WORKING_MEMORY_TEMPLATE));
    expect(wm.updatedAt).toBeGreaterThan(0);
  });

  it('updateWorkingMemory replaces the Name line and keeps the other 4', () => {
    const wm = initWorkingMemory();
    const updated = updateWorkingMemory(wm, { Name: 'Alice' });
    expect(updated.markdown).toContain('- **Name**: Alice');
    expect(updated.markdown).toContain('- **Role / Team**:');
    expect(updated.markdown).toContain('- **Environment**:');
    expect(updated.markdown).toContain('- **Preferences**:');
    expect(updated.markdown).toContain('- **Long-term Goals**:');
    expect(updated.markdown.match(/- \*\*/g)).toHaveLength(5); // 5 field lines intact
  });

  it('redacts a secret-shaped value in the stored markdown (R-10, T-05-04)', () => {
    const wm = initWorkingMemory();
    const updated = updateWorkingMemory(wm, { Preferences: 'my api key is sk-live-1234567890abc' });
    expect(updated.markdown).toContain('[REDACTED]');
    expect(updated.markdown).not.toContain('sk-live-1234567890abc');
  });

  it('trims a 400-token patch to ≤ 300 tokens (the ONE sanctioned slice)', () => {
    const wm = initWorkingMemory();
    // estimateTokens ≈ chars/4 for ASCII → 400 tokens ≈ 1600 chars.
    const bigValue = 'x'.repeat(1600);
    const updated = updateWorkingMemory(wm, { 'Long-term Goals': bigValue });
    expect(updated.tokens).toBeLessThanOrEqual(300);
    expect(estimateTokens(updated.markdown)).toBeLessThanOrEqual(300);
    // the trim sliced the template tail, never a fact's content mid-structure
    expect(updated.markdown.startsWith('# User Profile')).toBe(true);
  });

  it('persists and reads back the working-memory block through userFacts (round-trip)', async () => {
    db = await openMemoryDB();
    const wm = updateWorkingMemory(initWorkingMemory(), { Name: 'Alice' });
    await putWorkingMemory(db, wm);

    const restored = await readWorkingMemory(db);
    expect(restored?.markdown).toBe(wm.markdown);
    expect(restored?.resourceId).toBe(WORKING_MEMORY_RESOURCE_ID);
    expect(restored?.tokens).toBe(estimateTokens(wm.markdown));
    expect(restored?.updatedAt).toBe(wm.updatedAt);
  });

  it('readWorkingMemory returns undefined when absent', async () => {
    db = await openMemoryDB();
    expect(await readWorkingMemory(db)).toBeUndefined();
  });
});

describe('UserMemoryStore — write-never-throws (GR-9)', () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
  });

  it('putFact against a CLOSED db resolves instead of rejecting', async () => {
    const db = await openMemoryDB();
    db.close();

    await expect(putFact(db, makeFact('f-1'))).resolves.toBeUndefined();
  });
});
