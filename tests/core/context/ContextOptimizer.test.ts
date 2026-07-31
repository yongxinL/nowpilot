import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AgentTurnInput,
  ContextOptimizerInput,
  PlannerDecision,
  OptimizedContext,
} from '../../../src/core/ai/types';
import { PipelineError } from '../../../src/core/ai/PipelineError';

vi.mock('ai', () => {
  return {
    generateText: vi.fn(),
    streamText: vi.fn(),
    Output: {
      object: vi.fn(),
    },
    isStepCount: vi.fn(() => vi.fn()),
  };
});

vi.mock('../../../src/core/ai/ProviderRouter', () => {
  return {
    providerRouter: {
      selectProvider: vi.fn().mockResolvedValue({
        adapter: {
          providerId: 'openai' as const,
          createLanguageModel: vi.fn(),
          validateConnection: vi.fn().mockResolvedValue({ ok: true, models: ['gpt-4o-mini'] }),
          supportsStructuredOutput: true,
          getDefaultModelForTier: vi.fn().mockReturnValue('gpt-4o-mini'),
          getCacheStrategy: vi.fn().mockReturnValue('prefix-only' as const),
          getTelemetryMetadata: vi.fn().mockReturnValue({ provider: 'openai' }),
        },
        providerId: 'openai',
      }),
    },
  };
});

function buildOptimizerInput(overrides?: Partial<ContextOptimizerInput>): ContextOptimizerInput {
  return {
    operationId: 'op-test-1',
    model: 'gpt-4o-mini',
    modelContextWindow: 128000,
    userInput: 'Hello world',
    conversationId: 'conv-test-1',
    workspaceId: 'ws-test-1',
    activeSurface: 'sidepanel',
    selectedToolSchemas: [],
    memoryHints: [],
    preferences: {},
    ...overrides,
  };
}

describe('ModelContextTier', () => {
  it('classifies model context windows at boundary values', async () => {
    const { classifyModelContext } = await import('../../../src/core/context/ModelContextTier');
    expect(classifyModelContext(4096)).toBe('tiny');
    expect(classifyModelContext(4097)).toBe('small');
    expect(classifyModelContext(16384)).toBe('small');
    expect(classifyModelContext(131072)).toBe('medium');
    expect(classifyModelContext(200000)).toBe('large');
  });
});

describe('TokenBudget', () => {
  it('estimates tokens for English text using /4', async () => {
    const { tokenBudget } = await import('../../../src/core/context/TokenBudget');
    expect(tokenBudget.estimateTokens('hello world')).toBe(3);
  });

  it('estimates tokens for CJK text using /3 when >50% CJK', async () => {
    const { tokenBudget } = await import('../../../src/core/context/TokenBudget');
    expect(tokenBudget.estimateTokens('你好世界')).toBe(2);
  });

  it('estimates tokens for mixed text with <50% CJK using /4 and all-ASCII using /4', async () => {
    const { tokenBudget } = await import('../../../src/core/context/TokenBudget');
    // 2 CJK + 5 ASCII = 7 chars, CJK ratio ≈ 0.29 → ceil(7/4) = 2
    expect(tokenBudget.estimateTokens('你好hello')).toBe(2);
    // All-ASCII → /4
    expect(tokenBudget.estimateTokens('abcdefghijkl')).toBe(3);
  });

  it('returns 0 tokens for empty input', async () => {
    const { tokenBudget } = await import('../../../src/core/context/TokenBudget');
    expect(tokenBudget.estimateTokens('')).toBe(0);
  });

  it('allocates exact §2.2 section budgets for all four tiers', async () => {
    const { tokenBudget } = await import('../../../src/core/context/TokenBudget');

    // tiny @ 4000
    expect(tokenBudget.allocateBudget('tiny', 4000)).toEqual({
      inputBudget: 2800,
      outputBudget: 800,
      safetyMargin: 400,
      sections: { system: 600, tools: 800, memory: 400, context: 800, history: 600, user: 800 },
    });

    // small @ 16384
    expect(tokenBudget.allocateBudget('small', 16384).sections).toEqual({
      system: Math.floor(16384 * 0.1),
      tools: Math.floor(16384 * 0.15),
      memory: Math.floor(16384 * 0.1),
      context: Math.floor(16384 * 0.25),
      history: Math.floor(16384 * 0.2),
      user: Math.floor(16384 * 0.2),
    });

    // medium @ 131072
    expect(tokenBudget.allocateBudget('medium', 131072).sections).toEqual({
      system: Math.floor(131072 * 0.08),
      tools: Math.floor(131072 * 0.12),
      memory: Math.floor(131072 * 0.1),
      context: Math.floor(131072 * 0.3),
      history: Math.floor(131072 * 0.25),
      user: Math.floor(131072 * 0.15),
    });

    // large @ 200000
    expect(tokenBudget.allocateBudget('large', 200000).sections).toEqual({
      system: Math.floor(200000 * 0.05),
      tools: Math.floor(200000 * 0.1),
      memory: Math.floor(200000 * 0.1),
      context: Math.floor(200000 * 0.35),
      history: Math.floor(200000 * 0.25),
      user: Math.floor(200000 * 0.15),
    });
  });
});

describe('ContextOptimizer', () => {
  it('produces a valid OptimizedContext from a minimal input', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const result = await contextOptimizer.optimize(buildOptimizerInput());

    expect(result.tier).toBe('medium');
    expect(result.inputBudget).toBeGreaterThan(0);
    expect(result.outputBudget).toBeGreaterThan(0);
    expect(Array.isArray(result.sections)).toBe(true);
    expect(result.sections.length).toBe(7);
    expect(result.provenance).toBeDefined();
    expect(result.provenance.sections).toHaveLength(7);
    expect(typeof result.minimalMode).toBe('boolean');
    expect(result.minimalMode).toBe(false);

    // Canonical assembly order (§1.3): system, tool_schemas, preferences,
    // memory, context, task, user_input
    expect(result.sections.map((s) => s.kind)).toEqual([
      'system',
      'tool_schemas',
      'preferences',
      'memory',
      'context',
      'task',
      'user_input',
    ]);
  });

  it('sets stable flags correctly during assembly', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const result = await contextOptimizer.optimize(
      buildOptimizerInput({
        memoryHints: [{ id: 'm1', text: 'Prefers concise answers' }],
        pageContext: { title: 'Test page', url: 'https://example.com' },
      }),
    );

    const byKind = new Map(result.sections.map((s) => [s.kind, s]));
    expect(byKind.get('system')!.stable).toBe(true);
    expect(byKind.get('tool_schemas')!.stable).toBe(true);
    expect(byKind.get('preferences')!.stable).toBe(true);
    expect(byKind.get('user_input')!.stable).toBe(false);
    expect(byKind.get('memory')!.stable).toBe(false);
    expect(byKind.get('context')!.stable).toBe(false);
  });

  it('records provenance with one entry per assembled section', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const result = await contextOptimizer.optimize(
      buildOptimizerInput({
        memoryHints: [{ id: 'm1', text: 'fact' }],
        pageContext: { url: 'https://example.com' },
        selectedToolSchemas: [{ name: 'search', description: 'Search notes', jsonSchema: {} }],
      }),
    );

    const { provenance, sections } = result;
    expect(provenance.sections).toHaveLength(sections.length);
    for (let i = 0; i < sections.length; i++) {
      expect(provenance.sections[i].kind).toBe(sections[i].kind);
      expect(provenance.sections[i].sourceId).toBe(sections[i].sourceId);
      expect(provenance.sections[i].tokens).toBe(sections[i].tokens);
      expect(provenance.sections[i].truncated).toBe(false);
    }
    expect(provenance.totalTokens).toBe(sections.reduce((sum, s) => sum + s.tokens, 0));
    expect(provenance.minimalMode).toBe(result.minimalMode);
    expect(provenance.workspaceId).toBe('ws-test-1');
    expect(provenance.activeSurface).toBe('sidepanel');
  });

  it('assembles sections unchanged and records no truncation when under budget', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const userInput = 'Hello world';
    const result = await contextOptimizer.optimize(buildOptimizerInput({ userInput }));

    expect(result.sections.find((s) => s.kind === 'user_input')!.text).toBe(userInput);
    expect(result.provenance.sections.every((e) => e.truncated === false)).toBe(true);
  });

  it('trims user input from the start when over budget and marks provenance truncated', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    // tiny tier: inputBudget = 2867; 20k ASCII chars ≈ 5000 tokens → over budget
    const longInput = 'a'.repeat(20000);
    const result = await contextOptimizer.optimize(
      buildOptimizerInput({ modelContextWindow: 4096, userInput: longInput }),
    );

    const userSection = result.sections.find((s) => s.kind === 'user_input')!;
    // Trimmed from the start: the tail (most recent) of the input is preserved.
    expect(userSection.text.length).toBeGreaterThan(0);
    expect(userSection.text.length).toBeLessThan(longInput.length);
    expect(longInput.endsWith(userSection.text)).toBe(true);

    const total = result.sections.reduce((sum, s) => sum + s.tokens, 0);
    expect(total).toBeLessThanOrEqual(result.inputBudget);

    const userEntry = result.provenance.sections.find((e) => e.sourceId === 'interaction.user.current-turn')!;
    expect(userEntry.truncated).toBe(true);
  });

  it('throws CONTEXT_TOO_LARGE when user input alone cannot fit the budget', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    // tiny tier: user input far exceeds the entire input budget even after trimming
    const hugeInput = 'b'.repeat(200000);
    await expect(
      contextOptimizer.optimize(
        buildOptimizerInput({ modelContextWindow: 4096, userInput: hugeInput }),
      ),
    ).rejects.toThrow(PipelineError);
  });
});

describe('Tracer end-to-end', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs AgentTurnInput → ContextOptimizer.optimize() → AgentOrchestrator → plan → render', async () => {
    const { generateText } = await import('ai');
    const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

    mockGenerateText
      .mockResolvedValueOnce({
        output: { action: 'answer', reasonCode: 'sufficient_info' } as PlannerDecision,
      })
      .mockResolvedValueOnce({
        text: 'Hello! I am here to help you.',
      });

    const { createAgentTurnInput } = await import('../../../src/core/ai/AgentTurnInput');
    const input = createAgentTurnInput({
      providerId: 'openai',
      tier: 'FAST',
      model: 'gpt-4o-mini',
      modelContextWindow: 128000,
      userInput: 'Hello, what can you help me with?',
      selectedToolSchemas: [
        { name: 'search', description: 'Search notes', jsonSchema: { type: 'object' } },
      ],
    }) as AgentTurnInput;

    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const optimizeSpy = vi.spyOn(contextOptimizer, 'optimize');

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const response = await agentOrchestrator.runTurn(input);

    expect(response).toBe('Hello! I am here to help you.');
    expect(optimizeSpy).toHaveBeenCalledTimes(1);
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  }, 10000);
});
