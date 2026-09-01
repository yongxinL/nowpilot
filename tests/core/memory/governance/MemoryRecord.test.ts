/**
 * MemoryRecord governance tests — MEM-01/02/03 (D-126/D-127, spec §28.4).
 *
 * Proves:
 *   1. MEM-01: MemoryKind union has exactly 5 values.
 *   2. MEM-02: MemoryRecord fixture has all required governance fields.
 *   3. MEM-03: resolveConflict — correction > verified > prior > inference.
 *   4. revisionChain audit trail — winner absorbs loser's id.
 *   5. computeConflictKey — same content + tags produce same key regardless of case/whitespace.
 *   6. v5 migration — memory_records + procedural_experiences stores exist; idempotent.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { MemoryRecord } from '../../../../src/types/harness';
import {
  resolveConflict,
  computeConflictKey,
  detectConflicts,
  CONFLICT_PRECEDENCE,
  sourceKindToPrecedence,
} from '../../../../src/core/memory/MemoryRecord';
import {
  openMemoryDB,
  MEMORY_DB_VERSION,
} from '../../../../src/core/storage/MemoryDB';

function makeRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: `rec-${Math.random().toString(36).slice(2)}`,
    content: 'ServiceNow incident resolution steps',
    type: 'fact',
    tags: ['servicenow', 'incident'],
    confidence: 0.9,
    source: { kind: 'extracted' },
    kind: 'semantic',
    lifecycle: { status: 'active', verifiedAt: Date.now() },
    sensitivity: 'normal',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    useCount: 0,
    ...overrides,
  };
}

describe('MEM-01: MemoryKind taxonomy', () => {
  it('CONFLICT_PRECEDENCE has exactly 4 precedence categories', () => {
    expect(CONFLICT_PRECEDENCE).toHaveLength(4);
    expect(CONFLICT_PRECEDENCE).toEqual(['correction', 'verified', 'prior', 'inference']);
  });

  it('MemoryRecord fixture accepts all 5 MemoryKind values', () => {
    const kinds = ['working', 'episodic', 'semantic', 'preference', 'procedural'] as const;
    for (const kind of kinds) {
      const rec = makeRecord({ kind });
      expect(rec.kind).toBe(kind);
    }
  });
});

describe('MEM-02: MemoryRecord governance fields', () => {
  it('fixture has all required fields', () => {
    const rec = makeRecord();
    expect(rec.source.kind).toBeDefined();
    expect(rec.confidence).toBeDefined();
    expect(rec.lifecycle.status).toBeDefined();
    expect(rec.lifecycle.verifiedAt).toBeDefined();
    expect(rec.sensitivity).toBeDefined();
  });

  it('source.kind accepts extracted | manual | imported', () => {
    for (const kind of ['extracted', 'manual', 'imported'] as const) {
      const rec = makeRecord({ source: { kind } });
      expect(rec.source.kind).toBe(kind);
    }
  });

  it('sensitivity accepts normal | personal | secret', () => {
    for (const s of ['normal', 'personal', 'secret'] as const) {
      const rec = makeRecord({ sensitivity: s });
      expect(rec.sensitivity).toBe(s);
    }
  });
});

describe('MEM-03: resolveConflict — deterministic precedence', () => {
  it('correction (manual+chain) beats verified (manual no chain)', () => {
    const correction = makeRecord({
      id: 'a',
      source: { kind: 'manual' },
      revisionChain: [{ id: 'old', replacedAt: Date.now() - 1000 }],
    });
    const verified = makeRecord({ id: 'b', source: { kind: 'manual' } });
    const winner = resolveConflict(correction, verified);
    expect(winner.id).toBe('a');
  });

  it('verified (manual) beats prior (extracted)', () => {
    const verified = makeRecord({ id: 'a', source: { kind: 'manual' } });
    const prior = makeRecord({ id: 'b', source: { kind: 'extracted' } });
    const winner = resolveConflict(verified, prior);
    expect(winner.id).toBe('a');
  });

  it('prior (extracted) beats inference (imported)', () => {
    const prior = makeRecord({ id: 'a', source: { kind: 'extracted' } });
    const inference = makeRecord({ id: 'b', source: { kind: 'imported' } });
    const winner = resolveConflict(prior, inference);
    expect(winner.id).toBe('a');
  });

  it('correction beats prior', () => {
    const correction = makeRecord({
      id: 'a',
      source: { kind: 'manual' },
      revisionChain: [{ id: 'old', replacedAt: Date.now() - 1000 }],
    });
    const prior = makeRecord({ id: 'b', source: { kind: 'extracted' } });
    const winner = resolveConflict(correction, prior);
    expect(winner.id).toBe('a');
  });

  it('correction beats inference', () => {
    const correction = makeRecord({
      id: 'a',
      source: { kind: 'manual' },
      revisionChain: [{ id: 'old', replacedAt: Date.now() - 1000 }],
    });
    const inference = makeRecord({ id: 'b', source: { kind: 'imported' } });
    const winner = resolveConflict(correction, inference);
    expect(winner.id).toBe('a');
  });

  it('verified beats inference', () => {
    const verified = makeRecord({ id: 'a', source: { kind: 'manual' } });
    const inference = makeRecord({ id: 'b', source: { kind: 'imported' } });
    const winner = resolveConflict(verified, inference);
    expect(winner.id).toBe('a');
  });

  it('tie-break by confidence when precedence equal', () => {
    const lower = makeRecord({ id: 'a', confidence: 0.5, source: { kind: 'extracted' } });
    const higher = makeRecord({ id: 'b', confidence: 0.9, source: { kind: 'extracted' } });
    const winner = resolveConflict(lower, higher);
    expect(winner.id).toBe('b');
  });

  it('tie-break by verifiedAt when precedence + confidence equal', () => {
    const older = makeRecord({
      id: 'a',
      confidence: 0.8,
      source: { kind: 'extracted' },
      lifecycle: { status: 'active', verifiedAt: 1000 },
    });
    const newer = makeRecord({
      id: 'b',
      confidence: 0.8,
      source: { kind: 'extracted' },
      lifecycle: { status: 'active', verifiedAt: 2000 },
    });
    const winner = resolveConflict(older, newer);
    expect(winner.id).toBe('b');
  });

  it('tie-break by id asc when all else equal', () => {
    const a = makeRecord({
      id: 'aaa',
      confidence: 0.8,
      source: { kind: 'extracted' },
      lifecycle: { status: 'active', verifiedAt: 1000 },
    });
    const b = makeRecord({
      id: 'bbb',
      confidence: 0.8,
      source: { kind: 'extracted' },
      lifecycle: { status: 'active', verifiedAt: 1000 },
    });
    const winner = resolveConflict(a, b);
    expect(winner.id).toBe('aaa');
  });

  it('winner absorbs loser into revisionChain', () => {
    const a = makeRecord({ id: 'winner', source: { kind: 'manual' } });
    const b = makeRecord({ id: 'loser', source: { kind: 'extracted' } });
    const winner = resolveConflict(a, b);
    expect(winner.id).toBe('winner');
    expect(winner.revisionChain).toBeDefined();
    expect(winner.revisionChain!.length).toBe(1);
    expect(winner.revisionChain![0].id).toBe('loser');
  });
});

describe('sourceKindToPrecedence mapping', () => {
  it('manual without chain → verified', () => {
    const rec = makeRecord({ source: { kind: 'manual' } });
    expect(sourceKindToPrecedence(rec)).toBe('verified');
  });

  it('manual with chain → correction', () => {
    const rec = makeRecord({
      source: { kind: 'manual' },
      revisionChain: [{ id: 'old', replacedAt: Date.now() }],
    });
    expect(sourceKindToPrecedence(rec)).toBe('correction');
  });

  it('extracted → prior', () => {
    const rec = makeRecord({ source: { kind: 'extracted' } });
    expect(sourceKindToPrecedence(rec)).toBe('prior');
  });

  it('imported → inference', () => {
    const rec = makeRecord({ source: { kind: 'imported' } });
    expect(sourceKindToPrecedence(rec)).toBe('inference');
  });
});

describe('computeConflictKey', () => {
  it('same content + tags produce same key regardless of case', () => {
    const a = makeRecord({ content: 'Hello World', tags: ['a', 'b'] });
    const b = makeRecord({ content: 'hello world', tags: ['a', 'b'] });
    expect(computeConflictKey(a)).toBe(computeConflictKey(b));
  });

  it('same content + tags produce same key regardless of whitespace', () => {
    const a = makeRecord({ content: '  hello world  ', tags: ['a', 'b'] });
    const b = makeRecord({ content: 'hello world', tags: ['a', 'b'] });
    expect(computeConflictKey(a)).toBe(computeConflictKey(b));
  });

  it('different content produces different key', () => {
    const a = makeRecord({ content: 'foo', tags: ['a'] });
    const b = makeRecord({ content: 'bar', tags: ['a'] });
    expect(computeConflictKey(a)).not.toBe(computeConflictKey(b));
  });

  it('tags are sorted in the key', () => {
    const a = makeRecord({ content: 'test', tags: ['z', 'a', 'm'] });
    const b = makeRecord({ content: 'test', tags: ['a', 'm', 'z'] });
    expect(computeConflictKey(a)).toBe(computeConflictKey(b));
  });
});

describe('detectConflicts', () => {
  it('returns pairs of records with matching conflict keys', () => {
    const a = makeRecord({ id: 'a', content: 'same content', tags: ['x'] });
    const b = makeRecord({ id: 'b', content: 'Same Content', tags: ['x'] });
    const c = makeRecord({ id: 'c', content: 'different', tags: ['y'] });
    const pairs = detectConflicts([a, b, c]);
    expect(pairs.length).toBe(1);
    expect(pairs[0][0].id).toBe('a');
    expect(pairs[0][1].id).toBe('b');
  });

  it('returns empty array when no conflicts', () => {
    const a = makeRecord({ id: 'a', content: 'foo', tags: ['x'] });
    const b = makeRecord({ id: 'b', content: 'bar', tags: ['y'] });
    const pairs = detectConflicts([a, b]);
    expect(pairs.length).toBe(0);
  });
});

describe('v5 migration — memory_records + procedural_experiences stores', () => {
  beforeEach(() => {
    (globalThis as any).__resetIndexedDB();
  });

  it('memory_records + procedural_experiences stores exist after openMemoryDB', async () => {
    const db = await openMemoryDB();
    expect(MEMORY_DB_VERSION).toBe(5);
    expect(db.objectStoreNames.contains('memory_records')).toBe(true);
    expect(db.objectStoreNames.contains('procedural_experiences')).toBe(true);
    db.close();
  });

  it('idempotent: opening the migrated DB twice does not throw or duplicate stores', async () => {
    const db1 = await openMemoryDB();
    expect(db1.objectStoreNames.contains('memory_records')).toBe(true);
    db1.close();

    const db2 = await openMemoryDB();
    expect(db2.objectStoreNames.contains('memory_records')).toBe(true);
    expect(db2.objectStoreNames.contains('procedural_experiences')).toBe(true);
    // Store count is stable (messages, userFacts, conversationSummaries, memory_records, procedural_experiences).
    expect(db2.objectStoreNames.length).toBe(5);
    db2.close();
  });
});
