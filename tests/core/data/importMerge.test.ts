import { describe, it, expect } from 'vitest';

// NOTE: RED phase — mergeRecords module doesn't exist yet.
// Tests will fail with module-not-found during dynamic import, satisfying the RED gate.
// Implementation is created in Task 2 (GREEN phase).

interface MergeableRecord {
  id: string;
  updatedAt: number;
  [key: string]: unknown;
}

interface MergeSummary {
  updated: number;
  inserted: number;
  unchanged: number;
}

describe('mergeRecords — deterministic timestamp-based merge (latest-wins)', () => {
  const makeRecord = (id: string, updatedAt: number, extra?: Record<string, unknown>): MergeableRecord => ({
    id,
    updatedAt,
    ...extra,
  });

  // Dynamic import — fails with module-not-found in RED phase because
  // src/core/data/mergeRecords.ts doesn't exist yet.
  async function getMergeRecords(): Promise<{
    mergeRecords: (existing: MergeableRecord[], incoming: MergeableRecord[]) => {
      merged: MergeableRecord[];
      summary: MergeSummary;
    };
  }> {
    return await import('../../../src/core/data/mergeRecords');
  }

  it('newer updatedAt overwrites existing item (latest-wins)', async () => {
    const { mergeRecords } = await getMergeRecords();
    const existing = [makeRecord('a', 100, { name: 'old' })];
    const incoming = [makeRecord('a', 200, { name: 'new' })];

    const { merged, summary } = mergeRecords(existing, incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('new');
    expect(merged[0].updatedAt).toBe(200);
    expect(summary.updated).toBe(1);
    expect(summary.inserted).toBe(0);
    expect(summary.unchanged).toBe(0);
  });

  it('older updatedAt is ignored (existing kept)', async () => {
    const { mergeRecords } = await getMergeRecords();
    const existing = [makeRecord('a', 200, { name: 'newer' })];
    const incoming = [makeRecord('a', 100, { name: 'older' })];

    const { merged, summary } = mergeRecords(existing, incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('newer');
    expect(merged[0].updatedAt).toBe(200);
    expect(summary.updated).toBe(0);
    expect(summary.inserted).toBe(0);
    expect(summary.unchanged).toBe(1);
  });

  it('item with no matching id is inserted as new', async () => {
    const { mergeRecords } = await getMergeRecords();
    const existing = [makeRecord('a', 100)];
    const incoming = [makeRecord('b', 200)];

    const { merged, summary } = mergeRecords(existing, incoming);

    expect(merged).toHaveLength(2);
    expect(merged.find((r) => r.id === 'b')).toBeDefined();
    expect(summary.updated).toBe(0);
    expect(summary.inserted).toBe(1);
    expect(summary.unchanged).toBe(1);
  });

  it('identical updatedAt keeps existing (no overwrite)', async () => {
    const { mergeRecords } = await getMergeRecords();
    const existing = [makeRecord('a', 100, { name: 'original' })];
    const incoming = [makeRecord('a', 100, { name: 'different' })];

    const { merged, summary } = mergeRecords(existing, incoming);

    expect(merged).toHaveLength(1);
    // When timestamps are equal, existing record is kept (not overwritten)
    expect(merged[0].name).toBe('original');
    expect(summary.updated).toBe(0);
    expect(summary.inserted).toBe(0);
    expect(summary.unchanged).toBe(1);
  });

  it('merge summary returns correct counts for mixed scenario', async () => {
    const { mergeRecords } = await getMergeRecords();
    const existing = [
      makeRecord('a', 100, { name: 'old' }),
      makeRecord('b', 200, { name: 'unchanged' }),
      makeRecord('c', 300),
    ];
    const incoming = [
      makeRecord('a', 300, { name: 'updated' }),  // newer → update
      makeRecord('b', 200, { name: 'unchanged' }), // same → unchanged
      makeRecord('d', 400),                          // new → insert
    ];

    const { merged, summary } = mergeRecords(existing, incoming);

    expect(merged).toHaveLength(4);
    expect(merged.find((r) => r.id === 'a')?.name).toBe('updated');
    expect(merged.find((r) => r.id === 'b')?.name).toBe('unchanged');
    expect(merged.find((r) => r.id === 'd')).toBeDefined();
    expect(summary.updated).toBe(1);
    expect(summary.inserted).toBe(1);
    expect(summary.unchanged).toBe(2);
  });

  it('empty existing — all incoming inserted', async () => {
    const { mergeRecords } = await getMergeRecords();
    const existing: MergeableRecord[] = [];
    const incoming = [makeRecord('a', 100), makeRecord('b', 200)];

    const { merged, summary } = mergeRecords(existing, incoming);

    expect(merged).toHaveLength(2);
    expect(summary.updated).toBe(0);
    expect(summary.inserted).toBe(2);
    expect(summary.unchanged).toBe(0);
  });

  it('empty incoming — all existing unchanged', async () => {
    const { mergeRecords } = await getMergeRecords();
    const existing = [makeRecord('a', 100), makeRecord('b', 200)];
    const incoming: MergeableRecord[] = [];

    const { merged, summary } = mergeRecords(existing, incoming);

    expect(merged).toHaveLength(2);
    expect(summary.updated).toBe(0);
    expect(summary.inserted).toBe(0);
    expect(summary.unchanged).toBe(2);
  });
});
