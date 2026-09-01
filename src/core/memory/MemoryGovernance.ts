/**
 * MemoryGovernance — user lifecycle controls facade (D-128, MEM-04).
 *
 * Exposes all 9 user lifecycle controls as async functions over
 * MemoryDB.memory_records. All mutations are single-writer gated
 * (isPrimaryWriter) and journaled via WriteJournal (crash-safe).
 *
 * UI rendering is Phase 15 — Phase 10 ships the data contract + facade.
 */

import type { MemoryRecord, MemoryKind } from '../../types/harness';
import type { WriteJournalEntry } from '../../types/storage';
import { openMemoryDB } from '../storage/MemoryDB';
import { openWriteJournalDB } from '../storage/WriteJournalDB';
import { runJournaled, type JournalStep } from '../storage/WriteJournal';
import { isPrimaryWriter } from '../workspace/WorkspaceStore';
import { debugLog } from '../log/debugLog';
import { redactSensitiveValue } from '../security/redactSensitive';

/**
 * Journal a memory-record mutation (D-128 step 4).
 * Creates a pending entry, defines the apply/rollback steps, and drives
 * them through runJournaled. Persists journal entries to WriteJournalDB.
 */
async function journalMutation(
  recordId: string,
  apply: () => Promise<void>,
  rollback: () => Promise<void>,
): Promise<void> {
  const entry: WriteJournalEntry = {
    id: `jr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    operation: 'update-memory-record',
    status: 'pending',
    attempts: 0,
    steps: [],
    createdAt: Date.now(),
  };

  const steps: JournalStep[] = [
    {
      name: 'update-memory-record',
      apply,
      rollback,
    },
  ];

  const persist = async (e: WriteJournalEntry): Promise<void> => {
    const db = await openWriteJournalDB();
    await db.put('entries', e);
  };

  await runJournaled(entry, steps, persist);
}

/**
 * MEM-04: 9-control governance facade (D-128).
 * Object-form namespace (ProviderRegistry/PageIndexBuilder convention).
 */
export const MemoryGovernance = {
  /**
   * View a memory record by id (read-only).
   */
  async view(recordId: string): Promise<MemoryRecord | undefined> {
    const db = await openMemoryDB();
    return db.get('memory_records', recordId);
  },

  /**
   * Return the source metadata of a memory record (read-only).
   */
  async source(recordId: string): Promise<MemoryRecord['source'] | undefined> {
    const record = await this.view(recordId);
    return record?.source;
  },

  /**
   * Return the confidence of a memory record (read-only).
   */
  async confidence(recordId: string): Promise<number | undefined> {
    const record = await this.view(recordId);
    return record?.confidence;
  },

  /**
   * Edit a memory record — merge patch, update verifiedAt.
   * Single-writer gated + journaled.
   */
  async edit(recordId: string, patch: Partial<MemoryRecord>): Promise<void> {
    if (!isPrimaryWriter()) {
      debugLog('MEMORY_GOVERNANCE_NON_PRIMARY_SKIP', 'edit skipped — non-primary surface', {
        recordId,
      });
      return;
    }

    const db = await openMemoryDB();
    const current = await db.get('memory_records', recordId);
    if (!current) {
      debugLog('MEMORY_GOVERNANCE_EDIT_NOT_FOUND', 'record not found', { recordId });
      return;
    }

    const updated: MemoryRecord = {
      ...current,
      ...patch,
      lifecycle: {
        ...current.lifecycle,
        ...(patch.lifecycle ?? {}),
        verifiedAt: Date.now(),
      },
    };

    await journalMutation(
      recordId,
      async () => {
        await db.put('memory_records', updated);
      },
      async () => {
        await db.put('memory_records', current);
      },
    );
  },

  /**
   * Pin a memory record — set lifecycle.status = 'pinned'.
   * Single-writer gated + journaled.
   */
  async pin(recordId: string): Promise<void> {
    if (!isPrimaryWriter()) {
      debugLog('MEMORY_GOVERNANCE_NON_PRIMARY_SKIP', 'pin skipped — non-primary surface', {
        recordId,
      });
      return;
    }

    const db = await openMemoryDB();
    const current = await db.get('memory_records', recordId);
    if (!current) return;

    const updated: MemoryRecord = {
      ...current,
      lifecycle: { ...current.lifecycle, status: 'pinned' },
    };

    await journalMutation(
      recordId,
      async () => {
        await db.put('memory_records', updated);
      },
      async () => {
        await db.put('memory_records', current);
      },
    );
  },

  /**
   * Forget a memory record — soft-delete (status = 'forgotten').
   * Record still exists. Single-writer gated + journaled.
   */
  async forget(recordId: string): Promise<void> {
    if (!isPrimaryWriter()) {
      debugLog('MEMORY_GOVERNANCE_NON_PRIMARY_SKIP', 'forget skipped — non-primary surface', {
        recordId,
      });
      return;
    }

    const db = await openMemoryDB();
    const current = await db.get('memory_records', recordId);
    if (!current) return;

    const updated: MemoryRecord = {
      ...current,
      lifecycle: { ...current.lifecycle, status: 'forgotten' },
    };

    await journalMutation(
      recordId,
      async () => {
        await db.put('memory_records', updated);
      },
      async () => {
        await db.put('memory_records', current);
      },
    );
  },

  /**
   * Disable all records of a given kind — bulk forget.
   * Single-writer gated + journaled.
   */
  async disableType(kind: MemoryKind): Promise<void> {
    if (!isPrimaryWriter()) {
      debugLog('MEMORY_GOVERNANCE_NON_PRIMARY_SKIP', 'disableType skipped — non-primary surface', {
        kind,
      });
      return;
    }

    const db = await openMemoryDB();
    const all = await db.getAll('memory_records');
    const targets = all.filter((r) => r.kind === kind);

    if (targets.length === 0) return;

    const previous = [...targets];
    for (const record of targets) {
      record.lifecycle.status = 'forgotten';
    }

    await journalMutation(
      `disable-${kind}`,
      async () => {
        for (const record of targets) {
          await db.put('memory_records', record);
        }
      },
      async () => {
        for (const record of previous) {
          await db.put('memory_records', record);
        }
      },
    );
  },

  /**
   * Export memory records to JSON. Redacts records with sensitivity='secret'.
   * Read-only — no writer gate needed.
   */
  async export(filter?: (r: MemoryRecord) => boolean): Promise<string> {
    const db = await openMemoryDB();
    const all = await db.getAll('memory_records');
    const filtered = filter ? all.filter(filter) : all;

    // Redact secret records (T-10-02 mitigation).
    const redacted = filtered.map((r) => {
      if (r.sensitivity === 'secret') {
        return redactSensitiveValue(r) as MemoryRecord;
      }
      return r;
    });

    return JSON.stringify(redacted);
  },

  /**
   * Cloud-exclude a memory record — flag to exclude from any cloud sync.
   * Single-writer gated + journaled.
   */
  async cloudExclude(recordId: string): Promise<void> {
    if (!isPrimaryWriter()) {
      debugLog('MEMORY_GOVERNANCE_NON_PRIMARY_SKIP', 'cloudExclude skipped — non-primary surface', {
        recordId,
      });
      return;
    }

    const db = await openMemoryDB();
    const current = await db.get('memory_records', recordId);
    if (!current) return;

    const updated: MemoryRecord = { ...current, cloudExclude: true };

    await journalMutation(
      recordId,
      async () => {
        await db.put('memory_records', updated);
      },
      async () => {
        await db.put('memory_records', current);
      },
    );
  },
};
