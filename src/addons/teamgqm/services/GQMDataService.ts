import { writeJournal } from '../../../core/storage/WriteJournal';
import { getDB } from '../../../core/storage/IndexedDBManager';
import { debugLog } from '../../../core/utils/debugLog';
import type { NowPilotDB } from '../../../core/storage/IndexedDBManager';
import type { IDBPDatabase } from 'idb';
import type { Goal, Question, Metric, GQMNode } from '../data/gqmTypes';

const GQM_STORE = 'gqm';

/**
 * The gqm object store is added at runtime via a future IndexedDB migration.
 * Cast to unknown first to bypass the strict NowPilotDB DBSchema typing,
 * since the schema type doesn't yet include the gqm store.
 */
type AnyDB = IDBPDatabase<Record<string, unknown>>;

export type CreateGoalInput = Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'type' | 'parentId'>;
export type CreateQuestionInput = Omit<Question, 'id' | 'createdAt' | 'updatedAt' | 'type'>;
export type CreateMetricInput = Omit<Metric, 'id' | 'createdAt' | 'updatedAt' | 'type'>;
type GQMUpdate = Partial<Pick<GQMNode, 'title' | 'description'>>;

interface GQMTree {
  goal: Goal;
  questions: Array<{
    question: Question;
    metrics: Metric[];
  }>;
}

export class GQMDataService {
  async #getGqmDB(): Promise<AnyDB> {
    return (await getDB()) as unknown as AnyDB;
  }

  async createGoal(input: CreateGoalInput): Promise<Goal> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const entity: Goal = {
      ...input,
      id,
      type: 'goal',
      createdAt: now,
      updatedAt: now,
      parentId: null,
    };

    const entry = await writeJournal.begin(
      'save-gqm-data',
      { entityId: id, type: 'goal' },
      [{ name: 'write-gqm-entity' }],
    );

    await writeJournal.markStepStart(entry.id, 0);
    try {
      const db = await this.#getGqmDB();
      const tx = db.transaction(GQM_STORE, 'readwrite');
      await tx.store.put(entity);
      await tx.done;
      await writeJournal.markStepComplete(entry.id, 0);
      await writeJournal.markCompleted(entry.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeJournal.markStepFailed(entry.id, 0, msg);
      await writeJournal.markFailed(entry.id);
      throw err;
    }
    return entity;
  }

  async createQuestion(input: CreateQuestionInput): Promise<Question> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const entity: Question = {
      ...input,
      id,
      type: 'question',
      createdAt: now,
      updatedAt: now,
    };

    const entry = await writeJournal.begin(
      'save-gqm-data',
      { entityId: id, type: 'question' },
      [{ name: 'write-gqm-entity' }],
    );

    await writeJournal.markStepStart(entry.id, 0);
    try {
      const db = await this.#getGqmDB();
      const tx = db.transaction(GQM_STORE, 'readwrite');
      await tx.store.put(entity);
      await tx.done;
      await writeJournal.markStepComplete(entry.id, 0);
      await writeJournal.markCompleted(entry.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeJournal.markStepFailed(entry.id, 0, msg);
      await writeJournal.markFailed(entry.id);
      throw err;
    }
    return entity;
  }

  async createMetric(input: CreateMetricInput): Promise<Metric> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const entity: Metric = {
      ...input,
      id,
      type: 'metric',
      createdAt: now,
      updatedAt: now,
    };

    const entry = await writeJournal.begin(
      'save-gqm-data',
      { entityId: id, type: 'metric' },
      [{ name: 'write-gqm-entity' }],
    );

    await writeJournal.markStepStart(entry.id, 0);
    try {
      const db = await this.#getGqmDB();
      const tx = db.transaction(GQM_STORE, 'readwrite');
      await tx.store.put(entity);
      await tx.done;
      await writeJournal.markStepComplete(entry.id, 0);
      await writeJournal.markCompleted(entry.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeJournal.markStepFailed(entry.id, 0, msg);
      await writeJournal.markFailed(entry.id);
      throw err;
    }
    return entity;
  }

  async getChildren(parentId: string | null): Promise<GQMNode[]> {
    const db = await this.#getGqmDB();
    const tx = db.transaction(GQM_STORE, 'readonly');
    const all = (await tx.store.getAll()) as GQMNode[];
    await tx.done;
    return all.filter((n) => n.parentId === parentId && !n.deleted);
  }

  async updateNode(id: string, updates: GQMUpdate): Promise<void> {
    const db = await this.#getGqmDB();
    const tx = db.transaction(GQM_STORE, 'readwrite');
    const existing = (await tx.store.get(id)) as GQMNode | undefined;
    if (!existing) throw new Error(`GQM node ${id} not found`);

    const updated = { ...existing, ...updates, updatedAt: Date.now() };

    const entry = await writeJournal.begin(
      'save-gqm-data',
      { entityId: id },
      [{ name: 'update-gqm-entity' }],
    );

    await writeJournal.markStepStart(entry.id, 0);
    try {
      await tx.store.put(updated);
      await tx.done;
      await writeJournal.markStepComplete(entry.id, 0);
      await writeJournal.markCompleted(entry.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeJournal.markStepFailed(entry.id, 0, msg);
      await writeJournal.markFailed(entry.id);
      throw err;
    }
  }

  async deleteNode(id: string): Promise<void> {
    const db = await this.#getGqmDB();
    const tx = db.transaction(GQM_STORE, 'readwrite');
    const existing = (await tx.store.get(id)) as GQMNode | undefined;
    if (!existing) throw new Error(`GQM node ${id} not found`);

    const updated = { ...existing, deleted: true as const, updatedAt: Date.now() };

    const entry = await writeJournal.begin(
      'save-gqm-data',
      { entityId: id },
      [{ name: 'soft-delete-gqm-entity' }],
    );

    await writeJournal.markStepStart(entry.id, 0);
    try {
      await tx.store.put(updated);
      await tx.done;
      await writeJournal.markStepComplete(entry.id, 0);
      await writeJournal.markCompleted(entry.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeJournal.markStepFailed(entry.id, 0, msg);
      await writeJournal.markFailed(entry.id);
      throw err;
    }
  }

  async getTree(goalId: string): Promise<GQMTree> {
    const db = await this.#getGqmDB();
    const tx = db.transaction(GQM_STORE, 'readonly');
    const all = (await tx.store.getAll()) as GQMNode[];
    await tx.done;

    const goal = all.find((n) => n.id === goalId && n.type === 'goal') as Goal | undefined;
    if (!goal) throw new Error(`Goal ${goalId} not found`);

    const questions = all.filter(
      (n) => n.type === 'question' && n.parentId === goalId && !n.deleted,
    ) as Question[];

    return {
      goal,
      questions: questions.map((q) => ({
        question: q,
        metrics: all.filter(
          (n) => n.type === 'metric' && n.parentId === q.id && !n.deleted,
        ) as Metric[],
      })),
    };
  }
}

export const gqmDataService = new GQMDataService();
