import { debugLog } from '../utils/debugLog';
import { getDB } from './IndexedDBManager';
import type { WriteJournalEntry, WriteJournalOperation, WriteJournalSteps } from './WriteJournalEntry';
import { validateWriteJournalEntry } from './WriteJournalEntry';
import type { ExecutionContext } from '../telemetry/types';

export class WriteJournal {
  private readonly RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days per D-06
  private readonly MAX_COMPLETED_ENTRIES = 1000; // per D-06

  async begin(
    operation: WriteJournalOperation,
    targetIds: Record<string, string>,
    steps: { name: string }[],
    execCtx?: ExecutionContext,
  ): Promise<WriteJournalEntry> {
    const id = crypto.randomUUID();
    const entry: WriteJournalEntry = {
      id,
      operation,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attempts: 0,
      targetIds,
      steps: steps.map((s) => ({ name: s.name, status: 'pending' as const })),
    };

    validateWriteJournalEntry(entry);

    // Separate transaction per D-05
    const db = await getDB();
    const tx = db.transaction('write_journal_entries', 'readwrite');
    await tx.store.put(entry);
    await tx.done;

    debugLog('debug', 'WriteJournal: entry created', { id, operation });
    execCtx?.traceCollector.onWriteJournalEvent({
      journalId: id,
      operation,
      status: 'pending',
      stepsCount: steps.length,
      recovered: false,
      timestamp: Date.now(),
    });
    return entry;
  }

  async markStepStart(entryId: string, stepIndex: number): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('write_journal_entries', 'readwrite');
    const entry = await tx.store.get(entryId);
    if (entry) {
      if (entry.status !== 'applying') {
        entry.status = 'applying';
      }
      entry.updatedAt = Date.now();
      await tx.store.put(entry);
    }
    await tx.done;
  }

  async markStepComplete(entryId: string, stepIndex: number): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('write_journal_entries', 'readwrite');
    const entry = await tx.store.get(entryId);
    if (entry) {
      entry.steps[stepIndex].status = 'completed';
      entry.attempts += 1;
      entry.updatedAt = Date.now();
      await tx.store.put(entry);
    }
    await tx.done;
  }

  async markStepFailed(entryId: string, stepIndex: number, errorMessage: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('write_journal_entries', 'readwrite');
    const entry = await tx.store.get(entryId);
    if (entry) {
      entry.steps[stepIndex].status = 'failed';
      entry.steps[stepIndex].error = errorMessage;
      entry.updatedAt = Date.now();
      await tx.store.put(entry);
    }
    await tx.done;
  }

  async markCompleted(entryId: string, execCtx?: ExecutionContext): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('write_journal_entries', 'readwrite');
    const entry = await tx.store.get(entryId);
    if (entry) {
      entry.status = 'completed';
      entry.updatedAt = Date.now();
      await tx.store.put(entry);
    }
    await tx.done;
    debugLog('debug', 'WriteJournal: entry completed', { id: entryId });
    execCtx?.traceCollector.onWriteJournalEvent({
      journalId: entryId,
      operation: (entry?.operation ?? 'update-workspace') as any,
      status: 'completed',
      stepsCount: entry?.steps.length ?? 0,
      recovered: false,
      timestamp: Date.now(),
    });
  }

  async markFailed(entryId: string, execCtx?: ExecutionContext): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('write_journal_entries', 'readwrite');
    const entry = await tx.store.get(entryId);
    if (entry) {
      entry.status = 'failed';
      entry.updatedAt = Date.now();
      await tx.store.put(entry);
    }
    await tx.done;
    debugLog('error', 'WriteJournal: entry failed', { id: entryId });
    execCtx?.traceCollector.onWriteJournalEvent({
      journalId: entryId,
      operation: (entry?.operation ?? 'update-workspace') as any,
      status: 'failed',
      stepsCount: entry?.steps.length ?? 0,
      recovered: false,
      timestamp: Date.now(),
    });
  }

  async recover(): Promise<number> {
    const db = await getDB();
    const index = db.transaction('write_journal_entries', 'readonly').store.index('by-status');

    const pendingEntries = await index.getAll('pending');
    const applyingEntries = await index.getAll('applying');
    const entries = [...pendingEntries, ...applyingEntries];

    let recoveredCount = 0;

    for (const entry of entries) {
      // D-03 idempotency: if target store already has the data, skip
      const recoveryTx = db.transaction('write_journal_entries', 'readwrite');
      const currentEntry = await recoveryTx.store.get(entry.id);
      if (!currentEntry) continue;

      if (currentEntry.status === 'completed') {
        await recoveryTx.done;
        continue;
      }

      // Check idempotency: for each targetId, check if the target store already has that key
      // If data already exists, the entry was already applied before the crash
      let alreadyApplied = false;
      for (const [_storeName, entityKey] of Object.entries(currentEntry.targetIds)) {
        try {
          const checkTx = db.transaction('write_journal_entries', 'readonly');
          const existing = await checkTx.store.get(entityKey);
          if (existing) {
            alreadyApplied = true;
          }
          await checkTx.done;
        } catch {
          // If the store doesn't exist or lookup fails, treat as not yet applied
        }
      }

      if (alreadyApplied) {
        currentEntry.status = 'completed';
        currentEntry.updatedAt = Date.now();
        await recoveryTx.store.put(currentEntry);
        await recoveryTx.done;
        continue;
      }

      // Replay: mark pending/failed steps as pending for re-execution
      let allStepsDone = true;
      for (const step of currentEntry.steps) {
        if (step.status === 'pending' || step.status === 'failed') {
          step.status = 'pending';
          currentEntry.status = 'applying';
          allStepsDone = false;
        }
      }

      if (allStepsDone) {
        currentEntry.status = 'completed';
      }

      currentEntry.updatedAt = Date.now();
      await recoveryTx.store.put(currentEntry);
      await recoveryTx.done;
      recoveredCount++;
    }

    debugLog('info', 'WriteJournal: recovery complete', { recovered: recoveredCount });
    return recoveredCount;
  }

  async prune(): Promise<number> {
    const db = await getDB();
    const tx = db.transaction('write_journal_entries', 'readwrite');
    const allEntries = await tx.store.getAll();

    // Separate completed entries
    const completedEntries = allEntries
      .filter((e) => e.status === 'completed')
      .sort((a, b) => b.createdAt - a.createdAt); // newest first

    const now = Date.now();
    const toPrune: string[] = [];

    // Prune completed entries older than retention window
    for (const entry of completedEntries) {
      if (entry.createdAt < now - this.RETENTION_MS) {
        toPrune.push(entry.id);
      }
    }

    // Prune excess completed entries beyond MAX_COMPLETED_ENTRIES
    const retainedCompleted = completedEntries.filter(
      (e) => e.createdAt >= now - this.RETENTION_MS,
    );
    if (retainedCompleted.length > this.MAX_COMPLETED_ENTRIES) {
      const excess = retainedCompleted.slice(this.MAX_COMPLETED_ENTRIES);
      for (const entry of excess) {
        if (!toPrune.includes(entry.id)) {
          toPrune.push(entry.id);
        }
      }
    }

    // Delete pruned entries
    for (const id of toPrune) {
      await tx.store.delete(id);
    }
    await tx.done;

    debugLog('debug', 'WriteJournal: prune complete', { pruned: toPrune.length });
    return toPrune.length;
  }
}

export const writeJournal = new WriteJournal();
