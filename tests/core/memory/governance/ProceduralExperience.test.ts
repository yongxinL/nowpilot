/**
 * ProceduralExperience.test.ts — MEM-05 verification + approval lifecycle (D-129).
 *
 * Proves the full lifecycle: create → verify → approve → listApproved.
 * Also covers: verification failure, approval without verification rejection,
 * reject, listByStatus filtering, and single-writer gating.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mutable isPrimaryWriter mock.
const isPrimaryWriterMock = vi.fn(() => true);
vi.mock('../../../../src/core/workspace/WorkspaceStore', () => ({
  isPrimaryWriter: () => isPrimaryWriterMock(),
}));

import { ProceduralExperienceStore } from '../../../../src/core/memory/ProceduralExperience';
import type { ProceduralExperience } from '../../../../src/types/harness';

function makeOverrides(
  overrides: Partial<ProceduralExperience> = {},
): Omit<ProceduralExperience, 'id' | 'createdAt' | 'updatedAt' | 'status'> {
  return {
    title: 'Resolve ServiceNow incident',
    description: 'Steps to resolve a ServiceNow incident',
    steps: ['Identify the issue', 'Check logs', 'Apply fix', 'Verify resolution'],
    source: { kind: 'extracted' },
    confidence: 0.85,
    ...overrides,
  };
}

describe('ProceduralExperienceStore — MEM-05: verification + approval lifecycle', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    isPrimaryWriterMock.mockReturnValue(true);

    // Clean up any leftover records from prior tests.
    const approved = await ProceduralExperienceStore.listApproved();
    for (const r of approved) {
      await ProceduralExperienceStore.delete(r.id);
    }
    const all = await ProceduralExperienceStore.listByStatus('proposed');
    for (const r of all) {
      await ProceduralExperienceStore.delete(r.id);
    }
    const verified = await ProceduralExperienceStore.listByStatus('verified');
    for (const r of verified) {
      await ProceduralExperienceStore.delete(r.id);
    }
    const rejected = await ProceduralExperienceStore.listByStatus('rejected');
    for (const r of rejected) {
      await ProceduralExperienceStore.delete(r.id);
    }
  });

  it('create: record inserted with status=proposed, id generated, timestamps set', async () => {
    const record = await ProceduralExperienceStore.create(makeOverrides());

    expect(record.id).toBeDefined();
    expect(record.id.startsWith('pe-')).toBe(true);
    expect(record.status).toBe('proposed');
    expect(record.createdAt).toBeGreaterThan(0);
    expect(record.updatedAt).toBeGreaterThan(0);

    // Verify it was stored.
    const stored = await ProceduralExperienceStore.getById(record.id);
    expect(stored).toBeDefined();
    expect(stored!.status).toBe('proposed');
    expect(stored!.title).toBe('Resolve ServiceNow incident');
  });

  it('verify: valid steps (non-empty, no contradictions) → status=verified, verifiedAt set', async () => {
    const created = await ProceduralExperienceStore.create(makeOverrides());
    const verified = await ProceduralExperienceStore.verify(created.id);

    expect(verified).toBeDefined();
    expect(verified!.status).toBe('verified');
    expect(verified!.verifiedAt).toBeGreaterThan(0);

    // Verify it was stored.
    const stored = await ProceduralExperienceStore.getById(created.id);
    expect(stored!.status).toBe('verified');
  });

  it('verify: invalid steps (empty array) → returns undefined, status stays proposed', async () => {
    const created = await ProceduralExperienceStore.create(makeOverrides({ steps: [] }));
    const result = await ProceduralExperienceStore.verify(created.id);

    expect(result).toBeUndefined();

    const stored = await ProceduralExperienceStore.getById(created.id);
    expect(stored!.status).toBe('proposed');
  });

  it('verify: invalid steps (empty string step) → returns undefined', async () => {
    const created = await ProceduralExperienceStore.create(
      makeOverrides({ steps: ['Valid step', ''] }),
    );
    const result = await ProceduralExperienceStore.verify(created.id);

    expect(result).toBeUndefined();
  });

  it('approve: verified record → status=approved, approvedAt set', async () => {
    const created = await ProceduralExperienceStore.create(makeOverrides());
    await ProceduralExperienceStore.verify(created.id);

    const approved = await ProceduralExperienceStore.approve(created.id);
    expect(approved).toBeDefined();
    expect(approved!.status).toBe('approved');
    expect(approved!.approvedAt).toBeGreaterThan(0);

    const stored = await ProceduralExperienceStore.getById(created.id);
    expect(stored!.status).toBe('approved');
  });

  it('approve: proposed record (not verified) → rejected, returns undefined', async () => {
    const created = await ProceduralExperienceStore.create(makeOverrides());
    const result = await ProceduralExperienceStore.approve(created.id);

    expect(result).toBeUndefined();

    const stored = await ProceduralExperienceStore.getById(created.id);
    expect(stored!.status).toBe('proposed');
  });

  it('reject: status → rejected', async () => {
    const created = await ProceduralExperienceStore.create(makeOverrides());
    const rejected = await ProceduralExperienceStore.reject(created.id);

    expect(rejected).toBeDefined();
    expect(rejected!.status).toBe('rejected');

    const stored = await ProceduralExperienceStore.getById(created.id);
    expect(stored!.status).toBe('rejected');
  });

  it('listByStatus: filters correctly for each status', async () => {
    const proposed = await ProceduralExperienceStore.create(
      makeOverrides({ title: 'Proposed procedure' }),
    );
    const toVerify = await ProceduralExperienceStore.create(
      makeOverrides({ title: 'To verify procedure' }),
    );
    const toReject = await ProceduralExperienceStore.create(
      makeOverrides({ title: 'To reject procedure' }),
    );

    await ProceduralExperienceStore.verify(toVerify.id);
    await ProceduralExperienceStore.reject(toReject.id);

    const proposedList = await ProceduralExperienceStore.listByStatus('proposed');
    const verifiedList = await ProceduralExperienceStore.listByStatus('verified');
    const rejectedList = await ProceduralExperienceStore.listByStatus('rejected');

    expect(proposedList.some((r) => r.id === proposed.id)).toBe(true);
    expect(proposedList.some((r) => r.id === toVerify.id)).toBe(false);

    expect(verifiedList.some((r) => r.id === toVerify.id)).toBe(true);
    expect(verifiedList.some((r) => r.id === proposed.id)).toBe(false);

    expect(rejectedList.some((r) => r.id === toReject.id)).toBe(true);
    expect(rejectedList.some((r) => r.id === proposed.id)).toBe(false);
  });

  it('listApproved: returns only approved records', async () => {
    const created = await ProceduralExperienceStore.create(makeOverrides());
    await ProceduralExperienceStore.verify(created.id);
    await ProceduralExperienceStore.approve(created.id);

    // Create another that stays proposed.
    await ProceduralExperienceStore.create(makeOverrides({ title: 'Stay proposed' }));

    const approved = await ProceduralExperienceStore.listApproved();
    expect(approved.length).toBe(1);
    expect(approved[0].id).toBe(created.id);
    expect(approved[0].status).toBe('approved');
  });

  it('full lifecycle: create → verify → approve → listApproved includes it', async () => {
    const created = await ProceduralExperienceStore.create(makeOverrides());
    expect(created.status).toBe('proposed');

    const verified = await ProceduralExperienceStore.verify(created.id);
    expect(verified).toBeDefined();
    expect(verified!.status).toBe('verified');

    const approved = await ProceduralExperienceStore.approve(created.id);
    expect(approved).toBeDefined();
    expect(approved!.status).toBe('approved');

    const list = await ProceduralExperienceStore.listApproved();
    expect(list.some((r) => r.id === created.id)).toBe(true);
  });

  it('non-primary: create throws when isPrimaryWriter returns false', async () => {
    isPrimaryWriterMock.mockReturnValue(false);

    await expect(ProceduralExperienceStore.create(makeOverrides())).rejects.toThrow(
      'Non-primary surface cannot create procedural experience',
    );
  });

  it('non-primary: verify is a no-op when isPrimaryWriter returns false', async () => {
    const created = await ProceduralExperienceStore.create(makeOverrides());

    isPrimaryWriterMock.mockReturnValue(false);
    const result = await ProceduralExperienceStore.verify(created.id);
    expect(result).toBeUndefined();

    // Status unchanged.
    const stored = await ProceduralExperienceStore.getById(created.id);
    expect(stored!.status).toBe('proposed');
  });

  it('non-primary: approve is a no-op when isPrimaryWriter returns false', async () => {
    const created = await ProceduralExperienceStore.create(makeOverrides());
    await ProceduralExperienceStore.verify(created.id);

    isPrimaryWriterMock.mockReturnValue(false);
    const result = await ProceduralExperienceStore.approve(created.id);
    expect(result).toBeUndefined();

    // Status unchanged.
    const stored = await ProceduralExperienceStore.getById(created.id);
    expect(stored!.status).toBe('verified');
  });
});
