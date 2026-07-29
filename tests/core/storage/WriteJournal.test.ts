import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createEntry,
  commitEntry,
  replayJournal,
  repairEntry,
  getEntry,
  getEntriesByStatus,
  type WriteJournalEntry,
} from '../../../src/core/storage/WriteJournal';

describe('WriteJournal', () => {
  beforeEach(async () => {
    // Clear the IndexedDB database between tests
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name === 'WriteJournalDB') {
        indexedDB.deleteDatabase(db.name);
      }
    }
    vi.clearAllMocks();
  });

  const sampleSteps = [
    { name: 'update-storage', executor: vi.fn().mockResolvedValue(undefined) },
    { name: 'notify-bus', executor: vi.fn().mockResolvedValue(undefined) },
  ];

  describe('createEntry', () => {
    it('should create an entry with pending status and persist it in WriteJournalDB', async () => {
      const entry = await createEntry('update-workspace', { workspaceId: 'ws-1' }, sampleSteps);

      // Returns correct entry shape
      expect(entry).toBeDefined();
      expect(entry.id).toBeDefined();
      expect(entry.operation).toBe('update-workspace');
      expect(entry.status).toBe('pending');
      expect(entry.createdAt).toBeGreaterThan(0);
      expect(entry.updatedAt).toBeGreaterThan(0);
      expect(entry.attempts).toBe(0);
      expect(entry.targetIds).toEqual({ workspaceId: 'ws-1' });
      expect(entry.steps).toHaveLength(2);
      expect(entry.steps[0].name).toBe('update-storage');
      expect(entry.steps[0].status).toBe('pending');
      expect(entry.steps[1].name).toBe('notify-bus');
      expect(entry.steps[1].status).toBe('pending');

      // Verify it's persisted in IndexedDB
      const retrieved = await getEntry(entry.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.status).toBe('pending');
      expect(retrieved!.operation).toBe('update-workspace');
    });
  });

  describe('commitEntry', () => {
    it('should transition through pending→applying→completed and execute each step', async () => {
      const step1 = vi.fn().mockResolvedValue(undefined);
      const step2 = vi.fn().mockResolvedValue(undefined);
      const steps = [
        { name: 'step-1', executor: step1 },
        { name: 'step-2', executor: step2 },
      ];

      const entry = await createEntry('update-workspace', { workspaceId: 'ws-1' }, steps);

      // Wait for commit to complete
      await commitEntry(entry.id, steps);

      // Verify entry is now completed
      const completed = await getEntry(entry.id);
      expect(completed!.status).toBe('completed');

      // Verify steps executed in order
      expect(step1).toHaveBeenCalledOnce();
      expect(step2).toHaveBeenCalledOnce();
      // step1 should have been called before step2
      expect(step1.mock.invocationCallOrder[0]).toBeLessThan(
        step2.mock.invocationCallOrder[0],
      );

      // Verify step statuses in persisted entry
      expect(completed!.steps[0].status).toBe('completed');
      expect(completed!.steps[1].status).toBe('completed');
    });
  });

  describe('replayJournal', () => {
    it('should find a pending entry from crash and replay to completed', async () => {
      // Simulate a crash by directly writing a 'pending' entry
      const entry = await createEntry('update-workspace', { workspaceId: 'ws-1' }, sampleSteps);

      // Clear the in-memory steps registry — simulate crash recovery
      const stepExecutors = new Map<string, () => Promise<void>>();
      stepExecutors.set('update-storage', vi.fn().mockResolvedValue(undefined));
      stepExecutors.set('notify-bus', vi.fn().mockResolvedValue(undefined));

      const replayed = await replayJournal(stepExecutors);

      expect(replayed).toBe(1);

      const recovered = await getEntry(entry.id);
      expect(recovered!.status).toBe('completed');
    });

    it('should find an applying entry, increment attempts, replay, and mark completed', async () => {
      // Create an entry then set it to 'applying' to simulate crash mid-commit
      const entry = await createEntry('update-workspace', { workspaceId: 'ws-1' }, sampleSteps);

      const stepExecutors = new Map<string, () => Promise<void>>();
      stepExecutors.set('update-storage', vi.fn().mockResolvedValue(undefined));
      stepExecutors.set('notify-bus', vi.fn().mockResolvedValue(undefined));

      // Manually set to 'applying' to simulate crash during commit
      const db = await import('idb').then((idb) =>
        idb.openDB('WriteJournalDB', 1),
      );
      const rawEntry = await db.get('entries', entry.id);
      rawEntry.status = 'applying';
      rawEntry.updatedAt = Date.now();
      await db.put('entries', rawEntry);
      db.close();

      const replayed = await replayJournal(stepExecutors);

      expect(replayed).toBe(1);

      const recovered = await getEntry(entry.id);
      expect(recovered!.status).toBe('completed');
      expect(recovered!.attempts).toBeGreaterThan(0);
    });

    it('should mark entry as failed if a step throws during replay', async () => {
      const entry = await createEntry('update-workspace', { workspaceId: 'ws-1' }, sampleSteps);

      const stepExecutors = new Map<string, () => Promise<void>>();
      stepExecutors.set('update-storage', vi.fn().mockRejectedValue(new Error('Storage full')));
      stepExecutors.set('notify-bus', vi.fn().mockResolvedValue(undefined));

      const replayed = await replayJournal(stepExecutors);

      expect(replayed).toBe(1);

      const recovered = await getEntry(entry.id);
      expect(recovered!.status).toBe('failed');
      // The failed step should have an error
      const failedStep = recovered!.steps.find((s) => s.status === 'failed');
      expect(failedStep).toBeDefined();
      expect(failedStep!.error).toContain('Storage full');
    });

    it('should skip entries with terminal statuses (completed, failed, rolled-back)', async () => {
      // Create multiple entries with different statuses
      const entry1 = await createEntry('update-workspace', { id: '1' }, sampleSteps);
      const entry2 = await createEntry('update-workspace', { id: '2' }, sampleSteps);
      const entry3 = await createEntry('update-workspace', { id: '3' }, sampleSteps);

      // Manually set terminal statuses
      const db = await import('idb').then((idb) =>
        idb.openDB('WriteJournalDB', 1),
      );

      const e1 = await db.get('entries', entry1.id);
      e1.status = 'completed';
      await db.put('entries', e1);

      const e2 = await db.get('entries', entry2.id);
      e2.status = 'failed';
      await db.put('entries', e2);

      const e3 = await db.get('entries', entry3.id);
      e3.status = 'rolled-back';
      await db.put('entries', e3);

      db.close();

      const stepExecutors = new Map<string, () => Promise<void>>();
      stepExecutors.set('update-storage', vi.fn().mockResolvedValue(undefined));
      stepExecutors.set('notify-bus', vi.fn().mockResolvedValue(undefined));

      const replayed = await replayJournal(stepExecutors);

      // All three are terminal — nothing should be replayed
      expect(replayed).toBe(0);
    });
  });

  describe('repairEntry', () => {
    it('should validate step completion and fix orphaned entries', async () => {
      const entry = await createEntry('update-workspace', { workspaceId: 'ws-1' }, sampleSteps);

      const stepExecutors = new Map<string, () => Promise<void>>();
      stepExecutors.set('update-storage', vi.fn().mockResolvedValue(undefined));
      stepExecutors.set('notify-bus', vi.fn().mockResolvedValue(undefined));

      // Entry is 'pending' — repair should replay and complete it
      await repairEntry(entry.id, stepExecutors);

      const repaired = await getEntry(entry.id);
      expect(repaired!.status).toBe('completed');
    });
  });

  describe('getEntriesByStatus', () => {
    it('should return entries filtered by status', async () => {
      const entry = await createEntry('update-workspace', { id: '1' }, sampleSteps);

      const pending = await getEntriesByStatus('pending');
      expect(pending.length).toBeGreaterThanOrEqual(1);
      expect(pending.some((e) => e.id === entry.id)).toBe(true);
    });
  });
});
