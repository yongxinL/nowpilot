/**
 * ProceduralExperience — verification + approval lifecycle (D-129, MEM-05).
 *
 * Manages the full lifecycle of procedural experience records:
 *   proposed → verified → approved/rejected
 *
 * Only approved records are visible to MemoryEngine (gating lives in
 * MemoryEngine.retrieveProceduralExperience). All mutations are single-writer
 * gated (isPrimaryWriter) and journaled via WriteJournal (crash-safe).
 *
 * Automated verification (verify): checks steps are non-empty, no empty
 * string steps, no contradictions. User approval (approve) requires
 * status='verified' first — cannot skip verification.
 *
 * UI rendering is Phase 15 — Phase 10 ships the data contract + store.
 */

import type { ProceduralExperience } from '../../types/harness';
import type { WriteJournalEntry } from '../../types/storage';
import { openMemoryDB } from '../storage/MemoryDB';
import { openWriteJournalDB } from '../storage/WriteJournalDB';
import { runJournaled, type JournalStep } from '../storage/WriteJournal';
import { isPrimaryWriter } from '../workspace/WorkspaceStore';
import { debugLog } from '../log/debugLog';

/**
 * Journal a procedural-experience mutation (MEM-05).
 * Creates a pending entry, defines the apply/rollback steps, and drives
 * them through runJournaled. Persists journal entries to WriteJournalDB.
 */
async function journalMutation(
  recordId: string,
  apply: () => Promise<void>,
  rollback: () => Promise<void>,
): Promise<void> {
  const entry: WriteJournalEntry = {
    id: `jr-pe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    operation: 'update-procedural-experience',
    status: 'pending',
    attempts: 0,
    steps: [],
    createdAt: Date.now(),
  };

  const steps: JournalStep[] = [
    {
      name: 'update-procedural-experience',
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
 * MEM-05: automated verification heuristic.
 * Checks:
 *   1. steps is a non-empty array
 *   2. no step is an empty string
 *   3. no contradictions (no step is the exact negation of another —
 *      simple heuristic: no step starts with "Don't" / "Do not" while
 *      another step is the same without the negation)
 *
 * @returns true if the record passes automated verification.
 */
function passesVerification(record: ProceduralExperience): boolean {
  if (record.steps.length === 0) return false;
  if (record.steps.some((s) => s.trim() === '')) return false;

  // Simple contradiction heuristic: check for "Don't X" vs "X" pairs.
  const normalizedSteps = record.steps.map((s) => s.trim().toLowerCase());
  for (const step of normalizedSteps) {
    const withoutNegation = step.replace(/^(don't|do not)\s+/i, '').trim();
    if (withoutNegation !== step && normalizedSteps.includes(withoutNegation)) {
      return false;
    }
  }

  return true;
}

/**
 * MEM-05: ProceduralExperience store — full lifecycle management.
 * Object-form namespace (ProviderRegistry/PageIndexBuilder convention).
 */
export const ProceduralExperienceStore = {
  /**
   * Create a new procedural experience record with status='proposed'.
   * Single-writer gated + journaled.
   */
  async create(
    record: Omit<ProceduralExperience, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  ): Promise<ProceduralExperience> {
    if (!isPrimaryWriter()) {
      debugLog('PROCEDURAL_EXPERIENCE_NON_PRIMARY_SKIP', 'create skipped — non-primary surface');
      throw new Error('Non-primary surface cannot create procedural experience');
    }

    const now = Date.now();
    const id = `pe-${now}-${Math.random().toString(36).slice(2, 10)}`;
    const full: ProceduralExperience = {
      ...record,
      id,
      status: 'proposed',
      createdAt: now,
      updatedAt: now,
    };

    const db = await openMemoryDB();
    await journalMutation(
      id,
      async () => {
        await db.put('procedural_experiences', full);
      },
      async () => {
        await db.delete('procedural_experiences', id);
      },
    );

    return full;
  },

  /**
   * MEM-05: automated verification.
   * Validates steps (non-empty, no contradictions). If valid, sets
   * status='verified' and verifiedAt. If invalid, leaves status='proposed'
   * and returns undefined.
   */
  async verify(id: string): Promise<ProceduralExperience | undefined> {
    if (!isPrimaryWriter()) {
      debugLog('PROCEDURAL_EXPERIENCE_NON_PRIMARY_SKIP', 'verify skipped — non-primary surface', {
        id,
      });
      return undefined;
    }

    const db = await openMemoryDB();
    const current = await db.get('procedural_experiences', id);
    if (!current) return undefined;

    if (!passesVerification(current)) {
      debugLog('PROCEDURAL_EXPERIENCE_VERIFY_FAILED', 'verification failed', { id });
      return undefined;
    }

    const updated: ProceduralExperience = {
      ...current,
      status: 'verified',
      verifiedAt: Date.now(),
      updatedAt: Date.now(),
    };

    await journalMutation(
      id,
      async () => {
        await db.put('procedural_experiences', updated);
      },
      async () => {
        await db.put('procedural_experiences', current);
      },
    );

    return updated;
  },

  /**
   * MEM-05: user approval (Phase-15 UI calls this).
   * Requires status='verified' first. Sets status='approved' and approvedAt.
   * Rejects if status !== 'verified'.
   */
  async approve(id: string): Promise<ProceduralExperience | undefined> {
    if (!isPrimaryWriter()) {
      debugLog('PROCEDURAL_EXPERIENCE_NON_PRIMARY_SKIP', 'approve skipped — non-primary surface', {
        id,
      });
      return undefined;
    }

    const db = await openMemoryDB();
    const current = await db.get('procedural_experiences', id);
    if (!current) return undefined;

    // Must be verified first — cannot skip verification.
    if (current.status !== 'verified') {
      debugLog('PROCEDURAL_EXPERIENCE_APPROVE_REJECTED', 'approve rejected — not verified', {
        id,
        currentStatus: current.status,
      });
      return undefined;
    }

    const updated: ProceduralExperience = {
      ...current,
      status: 'approved',
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    };

    await journalMutation(
      id,
      async () => {
        await db.put('procedural_experiences', updated);
      },
      async () => {
        await db.put('procedural_experiences', current);
      },
    );

    return updated;
  },

  /**
   * MEM-05: reject a procedural experience.
   * Sets status='rejected'.
   */
  async reject(id: string): Promise<ProceduralExperience | undefined> {
    if (!isPrimaryWriter()) {
      debugLog('PROCEDURAL_EXPERIENCE_NON_PRIMARY_SKIP', 'reject skipped — non-primary surface', {
        id,
      });
      return undefined;
    }

    const db = await openMemoryDB();
    const current = await db.get('procedural_experiences', id);
    if (!current) return undefined;

    const updated: ProceduralExperience = {
      ...current,
      status: 'rejected',
      updatedAt: Date.now(),
    };

    await journalMutation(
      id,
      async () => {
        await db.put('procedural_experiences', updated);
      },
      async () => {
        await db.put('procedural_experiences', current);
      },
    );

    return updated;
  },

  /**
   * Read a procedural experience by id (read-only).
   */
  async getById(id: string): Promise<ProceduralExperience | undefined> {
    const db = await openMemoryDB();
    return db.get('procedural_experiences', id);
  },

  /**
   * List procedural experiences by status.
   */
  async listByStatus(status: ProceduralExperience['status']): Promise<ProceduralExperience[]> {
    const db = await openMemoryDB();
    const all = await db.getAll('procedural_experiences');
    return all.filter((r) => r.status === status);
  },

  /**
   * Convenience: list only approved records.
   */
  async listApproved(): Promise<ProceduralExperience[]> {
    return this.listByStatus('approved');
  },

  /**
   * Hard delete a procedural experience.
   */
  async delete(id: string): Promise<void> {
    if (!isPrimaryWriter()) {
      debugLog('PROCEDURAL_EXPERIENCE_NON_PRIMARY_SKIP', 'delete skipped — non-primary surface', {
        id,
      });
      return;
    }

    const db = await openMemoryDB();
    const current = await db.get('procedural_experiences', id);
    if (!current) return;

    await journalMutation(
      id,
      async () => {
        await db.delete('procedural_experiences', id);
      },
      async () => {
        await db.put('procedural_experiences', current);
      },
    );
  },
};
