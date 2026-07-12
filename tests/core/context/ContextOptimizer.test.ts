import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextOptimizer } from '../../../src/core/context/ContextOptimizer';
import type { ContextOptimizerInput } from '../../../src/core/context/contextTypes';
import { ContextTooLargeError } from '../../../src/core/context/contextTypes';
import { TokenEstimator } from '../../../src/core/context/TokenEstimator';
import type { ModelEntry } from '../../../src/core/ai/providers/providerTypes';

const mockGenerateText = vi.hoisted(() => vi.fn());
vi.mock('ai', () => ({ generateText: mockGenerateText }));

function createMockCompressor() {
  return {
    compressHistory: vi.fn().mockResolvedValue('Compressed summary of the conversation.'),
    compressContext: vi.fn().mockImplementation((ctx: any) => {
      if (typeof ctx === 'object') return 'Title: Test\nURL: https://example.com';
      return ctx.slice(0, 100);
    }),
  };
}

function createMockGetModelEntry(contextWindow: number = 16384) {
  const entries = new Map<string, ModelEntry>([
    ['test/test-model', {
      providerId: 'test',
      modelId: 'test-model',
      costTier: 'flash' as const,
      contextWindow,
      modalities: { text: true, image: false, toolUse: true, structuredOutput: true },
    }],
    ['test/tiny-model', {
      providerId: 'test',
      modelId: 'tiny-model',
      costTier: 'haiku' as const,
      contextWindow: 4096,
      modalities: { text: true, image: false, toolUse: false, structuredOutput: false },
    }],
    ['test/medium-model', {
      providerId: 'test',
      modelId: 'medium-model',
      costTier: 'sonnet' as const,
      contextWindow: 131072,
      modalities: { text: true, image: false, toolUse: true, structuredOutput: true },
    }],
    ['test/large-model', {
      providerId: 'test',
      modelId: 'large-model',
      costTier: 'opus' as const,
      contextWindow: 200000,
      modalities: { text: true, image: false, toolUse: true, structuredOutput: true },
    }],
  ]);
  return (providerId: string, modelId: string) => entries.get(`${providerId}/${modelId}`);
}

function createValidInput(overrides?: Partial<ContextOptimizerInput>): ContextOptimizerInput {
  return {
    operationId: 'test-op-1',
    providerId: 'test',
    modelId: 'test-model',
    modelContextWindow: 16384,
    userInput: 'Hello, how are you?',
    systemPrompt: 'You are a helpful assistant.',
    ...overrides,
  };
}

describe('ContextOptimizer', () => {
  let optimizer: ContextOptimizer;
  let tokenEstimator: TokenEstimator;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenEstimator = new TokenEstimator();
    optimizer = new ContextOptimizer(
      tokenEstimator,
      createMockCompressor(),
      createMockGetModelEntry(),
    );
  });

  describe('happy path (no overflow)', () => {
    it('returns OptimizedContext with correct fields', async () => {
      const result = await optimizer.optimize(createValidInput());
      expect(result.operationId).toBe('test-op-1');
      expect(result.tier).toBe('small');
      expect(result.inputBudget).toBe(11468);
      expect(result.outputBudget).toBe(3276);
      expect(result.safetyMargin).toBe(1640);
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.provenance).toBeDefined();
      expect(result.minimalMode).toBe(false);
    });

    it('sections are in CANONICAL_SECTION_ORDER', async () => {
      const result = await optimizer.optimize(createValidInput());
      const expectedOrder = ['system_prompt', 'task_instructions', 'workspace_context', 'memory', 'tool_schemas', 'page_context', 'conversation_history', 'user_input'];
      const actualKinds = result.sections.map((s) => s.kind);
      for (let i = 0; i < actualKinds.length - 1; i++) {
        const expectedIdx = expectedOrder.indexOf(actualKinds[i] as string);
        const nextIdx = expectedOrder.indexOf(actualKinds[i + 1] as string);
        expect(expectedIdx).toBeLessThan(nextIdx);
      }
    });

    it('provenance has kept sections', async () => {
      const result = await optimizer.optimize(createValidInput());
      expect(result.provenance.sections.length).toBeGreaterThan(0);
      for (const s of result.provenance.sections) {
        expect(['kept', 'truncated']).toContain(s.outcome);
      }
    });
  });

  describe('computeBudget (CTXT-02)', () => {
    it('4096 window → inputBudget: 2867, outputBudget: 819, safetyMargin: 410', async () => {
      const result = await optimizer.optimize(createValidInput({ modelContextWindow: 4096 }));
      expect(result.inputBudget).toBe(2867);
      expect(result.outputBudget).toBe(819);
      expect(result.safetyMargin).toBe(410);
    });

    it('16384 window → inputBudget: 11468, outputBudget: 3276, safetyMargin: 1640', async () => {
      const result = await optimizer.optimize(createValidInput({ modelContextWindow: 16384 }));
      expect(result.inputBudget).toBe(11468);
      expect(result.outputBudget).toBe(3276);
      expect(result.safetyMargin).toBe(1640);
    });

    it('131072 window → correct 70/20/10 split', async () => {
      const result = await optimizer.optimize(createValidInput({ modelContextWindow: 131072 }));
      expect(result.inputBudget).toBe(91750);
      expect(result.outputBudget).toBe(26214);
      expect(result.safetyMargin).toBe(13108);
    });
  });

  describe('tier classification (CTXT-01)', () => {
    it('4096 → tiny', async () => {
      const result = await optimizer.optimize(createValidInput({ modelContextWindow: 4096 }));
      expect(result.tier).toBe('tiny');
    });

    it('16384 → small', async () => {
      const result = await optimizer.optimize(createValidInput({ modelContextWindow: 16384 }));
      expect(result.tier).toBe('small');
    });

    it('131072 → medium', async () => {
      const result = await optimizer.optimize(createValidInput({ modelContextWindow: 131072 }));
      expect(result.tier).toBe('medium');
    });

    it('200000 → large', async () => {
      const result = await optimizer.optimize(createValidInput({ modelContextWindow: 200000 }));
      expect(result.tier).toBe('large');
    });
  });

  describe('section distribution (CTXT-03)', () => {
    it('sections include all provided content kinds', async () => {
      const result = await optimizer.optimize(
        createValidInput({
          workspaceContext: 'Working on project X',
          conversationHistory: [{ role: 'user', content: 'Hello' }],
        }),
      );
      const kinds = result.sections.map((s) => s.kind);
      expect(kinds).toContain('system_prompt');
      expect(kinds).toContain('workspace_context');
      expect(kinds).toContain('conversation_history');
      expect(kinds).toContain('user_input');
    });
  });

  describe('degradation — steps 1-2 (CTXT-05)', () => {
    it('drops debug_data sections', async () => {
      const result = await optimizer.optimize(
        createValidInput({
          modelContextWindow: 4096,
          userInput: 'Hello',
          systemPrompt: 'You are helpful.',
          debugData: { lastAction: 'test', memory: 'x'.repeat(500) },
        }),
      );
      const debugSection = result.sections.find((s) => s.kind === 'debug_data');
      expect(debugSection).toBeUndefined();
    });

    it('drops notes_metadata sections', async () => {
      const result = await optimizer.optimize(
        createValidInput({
          modelContextWindow: 4096,
          userInput: 'Hello',
          systemPrompt: 'You are helpful.',
          notes: [{ id: 'n1', content: 'x'.repeat(500) }],
        }),
      );
      const notesSection = result.sections.find((s) => s.kind === 'notes_metadata');
      expect(notesSection).toBeUndefined();
    });
  });

  describe('degradation — step 7 minimal mode (CTXT-06)', () => {
    it('tiny tier activates minimal mode', async () => {
      const result = await optimizer.optimize(
        createValidInput({
          modelContextWindow: 4096,
          userInput: 'Hello',
          systemPrompt: 'You are a helpful assistant that provides detailed information about many topics.',
          conversationHistory: [
            { role: 'user', content: 'x'.repeat(2000) },
            { role: 'assistant', content: 'y'.repeat(2000) },
          ],
          selectedToolSchemas: [{ name: 'echo', schema: {} }],
        }),
      );
      expect(result.minimalMode).toBe(true);
      expect(result.provenance.minimalMode).toBe(true);
    });

    it('non-tiny tier does not activate minimal mode by default', async () => {
      const result = await optimizer.optimize(createValidInput());
      expect(result.minimalMode).toBe(false);
    });
  });

  describe('degradation — step 8 CONTEXT_TOO_LARGE (CTXT-05)', () => {
    it('throws ContextTooLargeError when all steps fail', async () => {
      await expect(
        optimizer.optimize(
          createValidInput({
            modelContextWindow: 64,
            userInput: 'Hello',
            systemPrompt: 'You are a helpful assistant.',
            conversationHistory: Array.from({ length: 100 }, (_, i) => ({
              role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
              content: 'This is a very long conversation message that will consume a lot of tokens when we have one hundred of them in the array. '.repeat(10),
            })),
            memory: Array.from({ length: 20 }, (_, i) => ({
              id: `m${i}`,
              content: 'User prefers dark mode and likes efficient responses. '.repeat(10),
              score: 1.0 - i * 0.05,
            })),
            debugData: { key: 'x'.repeat(5000) },
            notes: Array.from({ length: 10 }, (_, i) => ({
              id: `n${i}`,
              content: 'Note with lots of content that should be dropped during degradation. '.repeat(20),
            })),
          }),
        ),
      ).rejects.toThrow(ContextTooLargeError);
    });

    it('error has estimatedTokens and budget', async () => {
      try {
        await optimizer.optimize(
          createValidInput({
            modelContextWindow: 64,
            userInput: 'Hello',
            systemPrompt: 'You are a helpful assistant.',
            conversationHistory: Array.from({ length: 100 }, (_, i) => ({
              role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
              content: 'Very long conversation to force overflow. '.repeat(50),
            })),
            debugData: { key: 'x'.repeat(5000) },
            notes: Array.from({ length: 10 }, (_, i) => ({
              id: `n${i}`,
              content: 'x'.repeat(2000),
            })),
          }),
        );
      } catch (err: any) {
        expect(err.code).toBe('CONTEXT_TOO_LARGE');
        expect(err.estimatedTokens).toBeGreaterThan(0);
        expect(err.budget).toBeGreaterThan(0);
      }
    });
  });

  describe('provenance manifest (CTXT-04)', () => {
    it('has operationId, tier, budgets, sections, degradationSteps', async () => {
      const result = await optimizer.optimize(createValidInput());
      expect(result.provenance.operationId).toBe('test-op-1');
      expect(result.provenance.tier).toBe('small');
      expect(result.provenance.sections.length).toBeGreaterThan(0);
      expect(Array.isArray(result.provenance.degradationSteps)).toBe(true);
      expect(result.provenance.createdAt).toBeGreaterThan(0);
    });

    it('dropped sections have finalTokens: 0', async () => {
      const result = await optimizer.optimize(
        createValidInput({
          modelContextWindow: 4096,
          userInput: 'Hi',
          systemPrompt: 'x'.repeat(2000),
          debugData: { key: 'x'.repeat(500) },
        }),
      );
      const dropped = result.provenance.sections.filter((s) => s.outcome === 'dropped');
      for (const s of dropped) {
        expect(s.finalTokens).toBe(0);
      }
    });
  });

  describe('Zod input validation (ASVS V5)', () => {
    it('missing userInput throws', async () => {
      await expect(
        optimizer.optimize(createValidInput({ userInput: '' } as any)),
      ).rejects.toThrow();
    });

    it('negative contextWindow throws', async () => {
      await expect(
        optimizer.optimize(createValidInput({ modelContextWindow: -1 })),
      ).rejects.toThrow();
    });
  });

  describe('singleton', () => {
    it('contextOptimizer is instanceof ContextOptimizer', async () => {
      const mod = await import('../../../src/core/context/ContextOptimizer');
      expect(mod.contextOptimizer).toBeInstanceOf(ContextOptimizer);
    });
  });
});
