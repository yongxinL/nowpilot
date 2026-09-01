/**
 * MemoryEngine procedural gating tests — MEM-05 (D-129, spec §28.4).
 *
 * Proves procedural experience records are gated by status:
 *   - proposed/rejected records are invisible to retrieveMemoryHints
 *   - approved records ARE returned
 *   - submitProceduralExperience creates records with status='proposed'
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mutable isPrimaryWriter mock.
const isPrimaryWriterMock = vi.fn(() => true);
vi.mock('../../../../src/core/workspace/WorkspaceStore', () => ({
  isPrimaryWriter: () => isPrimaryWriterMock(),
}));

import { MemoryEngine } from '../../../../src/core/memory/MemoryEngine';
import { openMemoryDB } from '../../../../src/core/storage/MemoryDB';
import { upsertFact, __test__ as factsTest } from '../../../../src/core/memory/UserMemoryStore';
import type { ProceduralExperience } from '../../../../src/types/harness';
import type { UserMemoryFact } from '../../../../src/core/memory/types';

function makeProcedural(
  overrides: Partial<ProceduralExperience> = {},
): ProceduralExperience {
  return {
    id: `pe-${Math.random().toString(36).slice(2)}`,
    title: 'Resolve ServiceNow incident',
    description: 'Steps to resolve a ServiceNow incident',
    steps: ['Identify the issue', 'Check logs', 'Apply fix', 'Verify resolution'],
    source: { kind: 'extracted' },
    confidence: 0.85,
    status: 'proposed',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

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

async function seedProcedural(record: ProceduralExperience): Promise<void> {
  const db = await openMemoryDB();
  await db.put('procedural_experiences', record);
}

describe('MemoryEngine — MEM-05: procedural experience gating (D-129)', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    (globalThis as any).__chromeStorageMap.clear();
    factsTest.reset();
    isPrimaryWriterMock.mockReturnValue(true);
  });

  it('procedural record with status=proposed is NOT returned by retrieveMemoryHints', async () => {
    const proposed = makeProcedural({ id: 'prop-1', status: 'proposed', title: 'proposed procedure' });
    await seedProcedural(proposed);

    const hints = await MemoryEngine.retrieveMemoryHints('proposed procedure');
    const proceduralIds = hints.filter((h) => h.id === 'prop-1');
    expect(proceduralIds.length).toBe(0);
  });

  it('procedural record with status=approved IS returned by retrieveMemoryHints', async () => {
    const approved = makeProcedural({ id: 'appr-1', status: 'approved', title: 'approved procedure' });
    await seedProcedural(approved);

    const hints = await MemoryEngine.retrieveMemoryHints('approved procedure');
    const proceduralIds = hints.filter((h) => h.id === 'appr-1');
    expect(proceduralIds.length).toBe(1);
  });

  it('procedural record with status=rejected is NOT returned by retrieveMemoryHints', async () => {
    const rejected = makeProcedural({ id: 'rej-1', status: 'rejected', title: 'rejected procedure' });
    await seedProcedural(rejected);

    const hints = await MemoryEngine.retrieveMemoryHints('rejected procedure');
    const proceduralIds = hints.filter((h) => h.id === 'rej-1');
    expect(proceduralIds.length).toBe(0);
  });

  it('procedural record with status=verified is NOT returned (only approved)', async () => {
    const verified = makeProcedural({ id: 'ver-1', status: 'verified', title: 'verified procedure' });
    await seedProcedural(verified);

    const hints = await MemoryEngine.retrieveMemoryHints('verified procedure');
    const proceduralIds = hints.filter((h) => h.id === 'ver-1');
    expect(proceduralIds.length).toBe(0);
  });

  it('retrieveProceduralExperience returns only approved records', async () => {
    const proposed = makeProcedural({ id: 'pe-prop', status: 'proposed' });
    const approved = makeProcedural({ id: 'pe-appr', status: 'approved' });
    const rejected = makeProcedural({ id: 'pe-rej', status: 'rejected' });
    await seedProcedural(proposed);
    await seedProcedural(approved);
    await seedProcedural(rejected);

    const results = await MemoryEngine.retrieveProceduralExperience('procedure');
    const ids = results.map((r) => r.id);
    expect(ids).toContain('pe-appr');
    expect(ids).not.toContain('pe-prop');
    expect(ids).not.toContain('pe-rej');
  });

  it('submitProceduralExperience creates record with status=proposed', async () => {
    const id = await MemoryEngine.submitProceduralExperience({
      title: 'New procedure',
      description: 'A new procedural experience',
      steps: ['Step 1', 'Step 2'],
      source: { kind: 'manual' },
      confidence: 0.8,
    });

    expect(id).toBeDefined();
    expect(id.startsWith('pe-')).toBe(true);

    // Verify it was stored with status='proposed'.
    const db = await openMemoryDB();
    const stored = await db.get('procedural_experiences', id);
    expect(stored).toBeDefined();
    expect(stored!.status).toBe('proposed');
    expect(stored!.title).toBe('New procedure');
  });

  it('mixing user facts + procedural records — both returned when procedural is approved', async () => {
    // Seed a user fact.
    await upsertFact(makeFact({ id: 'fact-1', content: 'ServiceNow incident resolution steps', tags: ['servicenow'] }));

    // Seed an approved procedural.
    const approved = makeProcedural({
      id: 'pe-mix',
      status: 'approved',
      title: 'ServiceNow incident procedure',
      description: 'How to resolve incidents',
    });
    await seedProcedural(approved);

    const hints = await MemoryEngine.retrieveMemoryHints('ServiceNow incident');
    const ids = hints.map((h) => h.id);

    // Both should be present.
    expect(ids).toContain('fact-1');
    expect(ids).toContain('pe-mix');
  });

  it('no procedural records — retrieveMemoryHints still returns user facts', async () => {
    await upsertFact(makeFact({ id: 'fact-only', content: 'javascript dev tips', tags: ['javascript'] }));

    const hints = await MemoryEngine.retrieveMemoryHints('javascript');
    const ids = hints.map((r) => r.id);
    expect(ids).toContain('fact-only');
  });
});
