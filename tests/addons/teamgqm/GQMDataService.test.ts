import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock WriteJournal to avoid IndexedDB dependency in tests
vi.mock('../../../src/core/storage/WriteJournal', () => ({
  writeJournal: {
    begin: vi.fn().mockResolvedValue({ id: 'test-gqm-entry-id' }),
    markStepStart: vi.fn().mockResolvedValue(undefined),
    markStepComplete: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
    markStepFailed: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock IndexedDBManager with an in-memory store
const mockStoreData = new Map<string, Record<string, unknown>>();

const mockStore = {
  put: vi.fn(async (val: Record<string, unknown>) => {
    const key = (val as any).id;
    mockStoreData.set(key, val);
  }),
  get: vi.fn(async (key: string) => Promise.resolve(mockStoreData.get(key) ?? undefined)),
  getAll: vi.fn(async () => Promise.resolve(Array.from(mockStoreData.values()))),
  delete: vi.fn(async (key: string) => {
    mockStoreData.delete(key);
  }),
};

const mockGetDB = vi.fn().mockResolvedValue({
  transaction: vi.fn(() => ({
    store: mockStore,
    done: Promise.resolve(undefined),
  })),
});

vi.mock('../../../src/core/storage/IndexedDBManager', () => ({
  getDB: mockGetDB,
}));

// Mock debugLog
vi.mock('../../../src/core/utils/debugLog', () => ({
  debugLog: vi.fn(),
}));

// Import after mocks are set up
const { gqmDataService, GQMDataService } = await import('../../../src/addons/teamgqm/services/GQMDataService');
import type { Goal, Question, Metric, GQMNode } from '../../../src/addons/teamgqm/data/gqmTypes';

describe('GQMDataService', () => {
  beforeEach(() => {
    mockStoreData.clear();
    vi.clearAllMocks();
  });

  describe('createGoal', () => {
    it('creates a goal with type:goal discriminator via WriteJournal', async () => {
      const goal = await gqmDataService.createGoal({
        title: 'Improve reliability',
        description: 'Reduce system downtime',
        order: 1,
      });

      expect(goal.type).toBe('goal');
      expect(goal.id).toBeDefined();
      expect(goal.title).toBe('Improve reliability');
      expect(goal.description).toBe('Reduce system downtime');
      expect(goal.order).toBe(1);
      expect(goal.parentId).toBeNull();
      expect(goal.createdAt).toBeGreaterThan(0);
      expect(goal.updatedAt).toBeGreaterThan(0);
      expect(goal.deleted).toBeUndefined();

      // Verify WriteJournal was called with 'save-gqm-data'
      const { writeJournal } = await import('../../../src/core/storage/WriteJournal');
      expect(writeJournal.begin).toHaveBeenCalledWith('save-gqm-data', expect.any(Object), expect.any(Array));
    });
  });

  describe('createQuestion', () => {
    it('creates a question with parentId referencing goal', async () => {
      const question = await gqmDataService.createQuestion({
        title: 'How reliable is the system?',
        description: 'Measure system uptime',
        order: 1,
        parentId: 'goal-1',
      });

      expect(question.type).toBe('question');
      expect(question.id).toBeDefined();
      expect(question.parentId).toBe('goal-1');
      expect(question.title).toBe('How reliable is the system?');

      const { writeJournal } = await import('../../../src/core/storage/WriteJournal');
      expect(writeJournal.begin).toHaveBeenCalledWith('save-gqm-data', expect.any(Object), expect.any(Array));
    });
  });

  describe('createMetric', () => {
    it('creates a metric with parentId referencing question', async () => {
      const metric = await gqmDataService.createMetric({
        title: 'System uptime percentage',
        description: 'Percentage of time system is operational',
        currentValue: '99.5%',
        targetValue: '99.9%',
        unit: '%',
        order: 1,
        parentId: 'question-1',
      });

      expect(metric.type).toBe('metric');
      expect(metric.id).toBeDefined();
      expect(metric.parentId).toBe('question-1');
      expect(metric.title).toBe('System uptime percentage');
      expect(metric.currentValue).toBe('99.5%');
      expect(metric.targetValue).toBe('99.9%');
      expect(metric.unit).toBe('%');

      const { writeJournal } = await import('../../../src/core/storage/WriteJournal');
      expect(writeJournal.begin).toHaveBeenCalledWith('save-gqm-data', expect.any(Object), expect.any(Array));
    });
  });

  describe('getChildren', () => {
    it('returns all child entities for a given parent', async () => {
      // Create goal
      const goal = await gqmDataService.createGoal({ title: 'Goal 1', order: 1 });
      // Create questions under goal
      await gqmDataService.createQuestion({ title: 'Q1', order: 1, parentId: goal.id });
      await gqmDataService.createQuestion({ title: 'Q2', order: 2, parentId: goal.id });

      const children = await gqmDataService.getChildren(goal.id);

      expect(children).toHaveLength(2);
      expect(children[0].type).toBe('question');
      expect(children[1].type).toBe('question');
      // Non-existent parent returns empty
      const noChildren = await gqmDataService.getChildren('nonexistent-id');
      expect(noChildren).toHaveLength(0);
    });
  });

  describe('updateNode', () => {
    it('updates title/description and bumps updatedAt', async () => {
      const goal = await gqmDataService.createGoal({ title: 'Original title', order: 1 });

      // Wait briefly so timestamps differ
      await new Promise((r) => setTimeout(r, 10));

      await gqmDataService.updateNode(goal.id, { title: 'Updated title', description: 'Updated description' });

      const all = mockStoreData;
      const updated = all.get(goal.id) as Record<string, unknown>;

      expect(updated?.title).toBe('Updated title');
      expect(updated?.description).toBe('Updated description');
      expect(updated?.updatedAt).toBeGreaterThan(goal.updatedAt);

      const { writeJournal } = await import('../../../src/core/storage/WriteJournal');
      expect(writeJournal.begin).toHaveBeenCalledWith('save-gqm-data', expect.any(Object), expect.any(Array));
    });
  });

  describe('deleteNode', () => {
    it('soft-deletes (sets deleted flag) via WriteJournal', async () => {
      const goal = await gqmDataService.createGoal({ title: 'To be deleted', order: 1 });

      await gqmDataService.deleteNode(goal.id);

      const all = mockStoreData;
      const deleted = all.get(goal.id) as Record<string, unknown>;
      expect(deleted?.deleted).toBe(true);

      // getChildren should not return deleted items
      const children = await gqmDataService.getChildren(null as unknown as string);
      expect(children.filter((c: any) => c.id === goal.id)).toHaveLength(0);

      const { writeJournal } = await import('../../../src/core/storage/WriteJournal');
      expect(writeJournal.begin).toHaveBeenCalledWith('save-gqm-data', expect.any(Object), expect.any(Array));
    });
  });

  describe('getTree', () => {
    it('returns full Goal→Questions→Metrics hierarchy', async () => {
      // Create a goal
      const goal = await gqmDataService.createGoal({ title: 'Root Goal', order: 1 });

      // Create two questions under the goal
      const q1 = await gqmDataService.createQuestion({ title: 'Q1', order: 1, parentId: goal.id });
      const q2 = await gqmDataService.createQuestion({ title: 'Q2', order: 2, parentId: goal.id });

      // Create two metrics under Q1, one metric under Q2
      await gqmDataService.createMetric({ title: 'M1', order: 1, parentId: q1.id });
      await gqmDataService.createMetric({ title: 'M2', order: 2, parentId: q1.id });
      await gqmDataService.createMetric({ title: 'M3', order: 1, parentId: q2.id });

      const tree = await gqmDataService.getTree(goal.id);

      expect(tree.goal.id).toBe(goal.id);
      expect(tree.goal.title).toBe('Root Goal');
      expect(tree.questions).toHaveLength(2);
      expect(tree.questions[0].question.id).toBe(q1.id);
      expect(tree.questions[0].metrics).toHaveLength(2);
      expect(tree.questions[0].metrics[0].title).toBe('M1');
      expect(tree.questions[0].metrics[1].title).toBe('M2');
      expect(tree.questions[1].question.id).toBe(q2.id);
      expect(tree.questions[1].metrics).toHaveLength(1);
      expect(tree.questions[1].metrics[0].title).toBe('M3');
    });
  });
});
