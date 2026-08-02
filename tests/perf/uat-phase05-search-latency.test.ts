import { describe, it, expect } from 'vitest';
import { MiniSearchNoteIndex } from '../../src/core/notes/MiniSearchNoteIndex';
import type { Note } from '../../src/core/notes/NoteSchema';

function makeNote(i: number): Note {
  const title = `Note about ${['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa'][i % 10]} topic ${i}`;
  return {
    id: `note-${i}`,
    title,
    body: `Content for ${title}. Discusses wikilinks, memory persistence, note graph, backlinks, search indexing, and ${['alpha', 'beta', 'gamma'][i % 3]} concepts.`.repeat(3),
    tags: [`tag-${i % 5}`],
    createdAt: Date.now() - i * 1000,
    updatedAt: Date.now() - i * 500,
    version: 1,
    schemaVersion: 1,
  } as Note;
}

describe('UAT benchmark: search latency at scale', () => {
  it('search() returns in under 50ms across 1,000 notes', async () => {
    const notes = Array.from({ length: 1000 }, (_, i) => makeNote(i));
    const index = new MiniSearchNoteIndex();
    await index.rebuild(notes);

    const queries = ['alpha', 'beta', 'memory persistence', 'wikilinks', 'backlinks', 'topic 42', 'note graph'];
    const latencies: number[] = [];
    for (let q = 0; q < 100; q++) {
      const query = queries[q % queries.length];
      const t0 = performance.now();
      index.search(query);
      latencies.push(performance.now() - t0);
    }

    const max = Math.max(...latencies);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95 = [...latencies].sort((a, b) => a - b)[94];

    console.log(`\nBenchmark: 100 searches over 1,000 notes — avg ${avg.toFixed(3)}ms, p95 ${p95.toFixed(3)}ms, max ${max.toFixed(3)}ms`);
    expect(max).toBeLessThan(50);
  }, 30000);
});
