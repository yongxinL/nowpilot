import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  AgentTurnInput,
  ContextItem,
  ContextOptimizerInput,
  PlannerDecision,
  OptimizedContext,
  PromptSection,
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
      // No AI summarization in unit tests: getCompressionModel returns null,
      // so overflow falls through to CONTEXT_TOO_LARGE (D-06, D-08).
      getCompressionModel: vi.fn().mockResolvedValue(null),
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

function buildSection(overrides: Partial<PromptSection>): PromptSection {
  return {
    kind: 'system',
    text: '',
    tokens: 0,
    stable: true,
    sourceId: 'core.instructions.system',
    ...overrides,
  };
}

function systemSection(tokens: number): PromptSection {
  return buildSection({ kind: 'system', text: 'system', tokens, stable: true, sourceId: 'core.instructions.system' });
}

function userInputSection(tokens: number): PromptSection {
  return buildSection({ kind: 'user_input', text: 'hello', tokens, stable: false, sourceId: 'interaction.user.current-turn' });
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

  it('throws CONTEXT_TOO_LARGE after full degradation when only user input overflows', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    // tiny tier: inputBudget = 2867; 20k ASCII chars ≈ 5000 tokens — user
    // input is the only degradable content and degradation never touches
    // user_input, so the pipeline exhausts all 7 steps and the optimizer
    // raises the terminal error (the Plan 04-01 placeholder user-input trim
    // was replaced by the degradation pipeline).
    const longInput = 'a'.repeat(20000);
    const err = await contextOptimizer
      .optimize(buildOptimizerInput({ modelContextWindow: 4096, userInput: longInput }))
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(err).toBeInstanceOf(PipelineError);
    const pipelineError = err as PipelineError;
    expect(pipelineError.code).toBe('CONTEXT_TOO_LARGE');
    expect(pipelineError.userFacingMessage).toMatch(/\d+ tokens/);
  });

  it('throws CONTEXT_TOO_LARGE when user input alone cannot fit the budget', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    // tiny tier: max schema-legal user input (100K chars ≈ 25K tokens)
    // exceeds the entire input budget even after all 7 degradation steps
    const hugeInput = 'b'.repeat(100000);
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
      // Explicit Phase 3a reliability metadata at the selected-tool boundary.
      selectedToolSchemas: [
        {
          name: 'search',
          description: 'Search notes',
          jsonSchema: { type: 'object' },
          execute: async () => ({ hits: [] }),
          sideEffect: 'read',
          idempotency: 'not-required',
          evidence: { required: false },
        },
      ],
    }) as AgentTurnInput;

    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const optimizeSpy = vi.spyOn(contextOptimizer, 'optimize');

    const { agentOrchestrator } = await import('../../../src/core/ai/AgentOrchestrator');
    const outcome = await agentOrchestrator.runTurn(input);

    expect(outcome.renderedAnswer).toBe('Hello! I am here to help you.');
    expect(outcome.terminalState).toBe('completed');
    expect(outcome.trajectory.map((t) => t.state)).toContain('planning');
    expect(optimizeSpy).toHaveBeenCalledTimes(1);
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  }, 10000);
});

describe('ContextCompressor degradation', () => {
  it('drop-debug removes debug sections and stops the pipeline', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const sections = [
      systemSection(10),
      buildSection({
        kind: 'context',
        text: 'verbose debug trace',
        tokens: 200,
        stable: false,
        sourceId: 'debug.verbose',
      }),
      userInputSection(5),
    ];
    const result = await contextCompressor.compress(sections, 15, 'medium');
    expect(result.sections.map((s) => s.sourceId)).not.toContain('debug.verbose');
    expect(result.sections).toHaveLength(2);
    expect(result.stepsApplied).toEqual(['drop-debug']);
  });

  it('drop-secondary removes secondary and optional sections while keeping primary', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const sections = [
      systemSection(10),
      buildSection({
        kind: 'context',
        text: 'secondary notes',
        tokens: 150,
        stable: false,
        sourceId: 'context.secondary',
      }),
      buildSection({
        kind: 'context',
        text: 'optional metadata',
        tokens: 50,
        stable: false,
        sourceId: 'context.optional',
      }),
      buildSection({
        kind: 'context',
        text: 'primary page',
        tokens: 10,
        stable: false,
        sourceId: 'context.page.current',
      }),
      userInputSection(5),
    ];
    const result = await contextCompressor.compress(sections, 30, 'medium');
    const sourceIds = result.sections.map((s) => s.sourceId);
    expect(sourceIds).not.toContain('context.secondary');
    expect(sourceIds).not.toContain('context.optional');
    expect(sourceIds).toContain('context.page.current');
    expect(result.stepsApplied).toEqual(['drop-debug', 'drop-secondary']);
  });

  it('summarise-history truncates long history, appends marker, and recalculates tokens', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const { tokenBudget } = await import('../../../src/core/context/TokenBudget');
    const longHistory = 'b'.repeat(5000);
    const sections = [
      systemSection(10),
      buildSection({
        kind: 'context',
        text: longHistory,
        tokens: 1250,
        stable: false,
        sourceId: 'history.conversation.123',
      }),
      userInputSection(5),
    ];
    const result = await contextCompressor.compress(sections, 400, 'medium');
    const history = result.sections.find((s) => s.sourceId === 'history.conversation.123')!;
    expect(history.text.length).toBeLessThanOrEqual(525); // ~500 chars + marker
    expect(history.text.endsWith('[... history summarized]')).toBe(true);
    expect(history.tokens).toBe(tokenBudget.estimateTokens(history.text));
    expect(history.tokens).toBeLessThan(1250);
    expect(result.stepsApplied).toEqual(['drop-debug', 'drop-secondary', 'summarise-history']);
  });

  it('compress-page replaces body text with a structured summary', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const { tokenBudget } = await import('../../../src/core/context/TokenBudget');
    const pageText = JSON.stringify({
      title: 'Test Page',
      url: 'https://example.com',
      headings: ['Introduction', 'Details'],
      body: 'x'.repeat(3000),
    });
    const sections = [
      systemSection(10),
      buildSection({
        kind: 'context',
        text: pageText,
        tokens: 1000,
        stable: false,
        sourceId: 'context.page.current',
      }),
      userInputSection(5),
    ];
    const result = await contextCompressor.compress(sections, 100, 'medium');
    const page = result.sections.find((s) => s.sourceId === 'context.page.current')!;
    expect(page.text).toContain('Page: Test Page');
    expect(page.text).toContain('URL: https://example.com');
    expect(page.text).toContain('Key headings: Introduction, Details');
    expect(page.text).toContain('[content compressed]');
    expect(page.tokens).toBe(tokenBudget.estimateTokens(page.text));
    expect(page.tokens).toBeLessThan(200);
    expect(result.stepsApplied).toEqual([
      'drop-debug',
      'drop-secondary',
      'summarise-history',
      'compress-page',
    ]);
  });

  it('trim-tools enforces per-tier tool caps and drops dangerous tools', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const toolSchemas = Array.from({ length: 6 }, (_, i) => ({
      name: `tool-${i}`,
      description: 'd'.repeat(150),
      dangerous: i === 5,
    }));
    const toolsText = JSON.stringify(toolSchemas);
    const sections = [
      systemSection(10),
      buildSection({
        kind: 'tool_schemas',
        text: toolsText,
        tokens: 350,
        stable: true,
        sourceId: 'tools.builtin.selected',
      }),
      userInputSection(5),
    ];
    // medium tier → cap 5 safe tools (dangerous one excluded)
    const mediumResult = await contextCompressor.compress(sections, 340, 'medium');
    const mediumTools = JSON.parse(
      mediumResult.sections.find((s) => s.kind === 'tool_schemas')!.text,
    ) as Array<{ name: string }>;
    expect(mediumTools).toHaveLength(5);
    expect(mediumTools.every((t) => t.name !== 'tool-5')).toBe(true);
    expect(mediumResult.stepsApplied).toEqual([
      'drop-debug',
      'drop-secondary',
      'summarise-history',
      'compress-page',
      'trim-tools',
    ]);
    // tiny tier → cap 1
    const tinyResult = await contextCompressor.compress(sections, 340, 'tiny');
    const tinyTools = JSON.parse(
      tinyResult.sections.find((s) => s.kind === 'tool_schemas')!.text,
    ) as Array<{ name: string }>;
    expect(tinyTools).toHaveLength(1);
  });

  it('reduce-memory keeps top-K hints per tier and skips small memory sections', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const memoryHints = Array.from({ length: 8 }, (_, i) => ({ id: `h${i}`, text: 'm'.repeat(100) }));
    const memoryText = JSON.stringify(memoryHints);
    const sections = [
      systemSection(10),
      buildSection({
        kind: 'memory',
        text: memoryText,
        tokens: 220,
        stable: false,
        sourceId: 'memory.user.facts',
      }),
      userInputSection(5),
    ];
    // small tier → top-3, preserving rank order
    const smallResult = await contextCompressor.compress(sections, 200, 'small');
    const smallMem = JSON.parse(
      smallResult.sections.find((s) => s.kind === 'memory')!.text,
    ) as Array<{ id: string }>;
    expect(smallMem).toHaveLength(3);
    expect(smallMem.map((m) => m.id)).toEqual(['h0', 'h1', 'h2']);
    expect(smallResult.stepsApplied).toEqual([
      'drop-debug',
      'drop-secondary',
      'summarise-history',
      'compress-page',
      'trim-tools',
      'reduce-memory',
    ]);
    // tiny tier → top-1
    const tinyResult = await contextCompressor.compress(sections, 200, 'tiny');
    const tinyMem = JSON.parse(
      tinyResult.sections.find((s) => s.kind === 'memory')!.text,
    ) as Array<{ id: string }>;
    expect(tinyMem).toHaveLength(1);
    // already-small memory (≤3 entries) → step skips, entries preserved
    const twoHints = JSON.stringify([
      { id: 'a', text: 'x'.repeat(100) },
      { id: 'b', text: 'y'.repeat(100) },
    ]);
    const skipResult = await contextCompressor.compress(
      [
        systemSection(10),
        buildSection({
          kind: 'memory',
          text: twoHints,
          tokens: 60,
          stable: false,
          sourceId: 'memory.user.facts',
        }),
        userInputSection(5),
      ],
      40,
      'tiny',
    );
    const skipMem = JSON.parse(
      skipResult.sections.find((s) => s.kind === 'memory')!.text,
    ) as Array<{ id: string }>;
    expect(skipMem).toHaveLength(2);
  });

  it('minimal-mode enforces the §2.5 restrictions (1 tool, top-3 memory, compact system, last turns, page dropped)', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const { tokenBudget } = await import('../../../src/core/context/TokenBudget');
    const historyText = JSON.stringify(
      Array.from({ length: 6 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `turn ${i} content`,
      })),
    );
    const preferencesText = JSON.stringify({ responseStyle: 'concise' });
    const sections = [
      buildSection({ kind: 'system', text: 's'.repeat(4000), tokens: 1000, stable: true }),
      buildSection({
        kind: 'tool_schemas',
        text: JSON.stringify(
          Array.from({ length: 4 }, (_, i) => ({ name: `tool-${i}`, description: 'd'.repeat(50) })),
        ),
        tokens: 200,
        stable: true,
        sourceId: 'tools.builtin.selected',
      }),
      buildSection({
        kind: 'preferences',
        text: preferencesText,
        tokens: 10,
        stable: true,
        sourceId: 'core.preferences.user',
      }),
      buildSection({
        kind: 'memory',
        text: JSON.stringify(Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, text: 'm'.repeat(100) }))),
        tokens: 200,
        stable: false,
        sourceId: 'memory.user.facts',
      }),
      buildSection({
        kind: 'context',
        text: historyText,
        tokens: 80,
        stable: false,
        sourceId: 'history.conversation.123',
      }),
      buildSection({
        kind: 'context',
        text: JSON.stringify({ title: 'T', url: 'https://e.com', body: 'x'.repeat(2000) }),
        tokens: 600,
        stable: false,
        sourceId: 'context.page.current',
      }),
      userInputSection(5),
    ];
    const result = await contextCompressor.compress(sections, 150, 'medium');
    const sys = result.sections.find((s) => s.kind === 'system')!;
    expect(sys.tokens).toBeLessThanOrEqual(200);
    const tools = JSON.parse(result.sections.find((s) => s.kind === 'tool_schemas')!.text) as unknown[];
    expect(tools).toHaveLength(1);
    const memory = JSON.parse(result.sections.find((s) => s.kind === 'memory')!.text) as unknown[];
    expect(memory.length).toBeLessThanOrEqual(3);
    const history = result.sections.find((s) => s.sourceId === 'history.conversation.123')!;
    const parsedHistory = JSON.parse(history.text) as unknown[];
    expect(parsedHistory.length).toBeLessThanOrEqual(2);
    expect(tokenBudget.estimateTokens(history.text)).toBeLessThanOrEqual(200);
    expect(result.sections.find((s) => s.sourceId === 'context.page.current')).toBeUndefined();
    const preferences = result.sections.find((s) => s.kind === 'preferences')!;
    expect(preferences.text).toBe(preferencesText); // already compact — untouched
    expect(result.stepsApplied[result.stepsApplied.length - 1]).toBe('minimal-mode');
  });

  it('applies all seven steps in policy order when the budget cannot be met, without mutating the input', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const sections = [
      buildSection({ kind: 'system', text: 's'.repeat(4000), tokens: 1000, stable: true }),
      buildSection({
        kind: 'tool_schemas',
        text: JSON.stringify(
          Array.from({ length: 6 }, (_, i) => ({ name: `tool-${i}`, description: 'd'.repeat(200) })),
        ),
        tokens: 350,
        stable: true,
        sourceId: 'tools.builtin.selected',
      }),
      buildSection({
        kind: 'memory',
        text: JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, text: 'm'.repeat(100) }))),
        tokens: 300,
        stable: false,
        sourceId: 'memory.user.facts',
      }),
      buildSection({
        kind: 'context',
        text: 'h'.repeat(5000),
        tokens: 1250,
        stable: false,
        sourceId: 'history.conversation.123',
      }),
      buildSection({
        kind: 'context',
        text: JSON.stringify({ title: 'T', url: 'https://e.com', body: 'x'.repeat(3000) }),
        tokens: 800,
        stable: false,
        sourceId: 'context.page.current',
      }),
      buildSection({
        kind: 'user_input',
        text: 'u'.repeat(40000),
        tokens: 10000,
        stable: false,
        sourceId: 'interaction.user.current-turn',
      }),
    ];
    const result = await contextCompressor.compress(sections, 1000, 'medium');
    expect(result.stepsApplied).toEqual([
      'drop-debug',
      'drop-secondary',
      'summarise-history',
      'compress-page',
      'trim-tools',
      'reduce-memory',
      'minimal-mode',
    ]);
    const total = result.sections.reduce((sum, s) => sum + s.tokens, 0);
    expect(total).toBeGreaterThan(1000); // still over — the caller decides CONTEXT_TOO_LARGE
    // input array and elements are never mutated
    expect(sections).toHaveLength(6);
    expect(sections.find((s) => s.kind === 'user_input')!.text).toBe('u'.repeat(40000));
  });

  it('stops early once the budget is satisfied', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const sections = [
      systemSection(10),
      buildSection({
        kind: 'context',
        text: 'debug trace',
        tokens: 100,
        stable: false,
        sourceId: 'debug.mcp',
      }),
      buildSection({
        kind: 'context',
        text: 'secondary notes',
        tokens: 50,
        stable: false,
        sourceId: 'context.secondary',
      }),
      userInputSection(5),
    ];
    const result = await contextCompressor.compress(sections, 120, 'medium');
    expect(result.stepsApplied).toEqual(['drop-debug']);
    expect(result.sections.map((s) => s.sourceId)).not.toContain('debug.mcp');
  });
});

describe('ContextOptimizer degradation pipeline', () => {
  it('brings oversized context under budget through optimize() and records degradation provenance', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const result = await contextOptimizer.optimize(
      buildOptimizerInput({
        modelContextWindow: 16384, // small → inputBudget 11468
        selectedToolSchemas: Array.from({ length: 12 }, (_, i) => ({
          name: `tool-${i}`,
          description: 'd'.repeat(200),
        })),
        memoryHints: Array.from({ length: 500 }, (_, i) => ({ id: `m${i}`, text: 'm'.repeat(100) })),
        pageContext: { title: 'Big Page', url: 'https://example.com', body: 'x'.repeat(30000) },
      }),
    );

    const total = result.sections.reduce((sum, s) => sum + s.tokens, 0);
    expect(total).toBeLessThanOrEqual(result.inputBudget);

    const bySourceId = new Map(result.provenance.sections.map((e) => [e.sourceId, e]));
    expect(bySourceId.get('context.page.current')?.compressionApplied).toBe('structural');
    expect(bySourceId.get('memory.user.facts')?.compressionApplied).toBe('topk');
    expect(bySourceId.get('tools.builtin.selected')?.compressionApplied).toBe('structural');
    expect(bySourceId.get('core.instructions.system')?.compressionApplied).toBeUndefined();
    expect(result.minimalMode).toBe(false);
  });

  it('throws CONTEXT_TOO_LARGE with token counts after all degradation steps fail', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    // Max schema-legal input (100K chars ≈ 25K tokens) on tiny tier — far
    // beyond the 2867-token budget and degradation never touches user input.
    const hugeInput = 'b'.repeat(100000);
    const err = await contextOptimizer
      .optimize(buildOptimizerInput({ modelContextWindow: 4096, userInput: hugeInput }))
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(err).toBeInstanceOf(PipelineError);
    const pipelineError = err as PipelineError;
    expect(pipelineError.code).toBe('CONTEXT_TOO_LARGE');
    expect(pipelineError.userFacingMessage).toMatch(/\d+ tokens/);
    expect(pipelineError.diagnostic).toMatchObject({ tier: 'tiny' });
    expect((pipelineError.diagnostic?.stepsApplied as string[]).length).toBe(7);
  });

  it('enforces minimal mode for tiny tier: single tool, top-3 memories, under budget', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const result = await contextOptimizer.optimize(
      buildOptimizerInput({
        modelContextWindow: 4096, // tiny → inputBudget 2867
        selectedToolSchemas: Array.from({ length: 8 }, (_, i) => ({
          name: `tool-${i}`,
          description: 'd'.repeat(100),
        })),
        memoryHints: Array.from({ length: 120 }, (_, i) => ({ id: `m${i}`, text: 'm'.repeat(100) })),
        pageContext: { title: 'T', url: 'https://e.com', body: 'x'.repeat(2000) },
      }),
    );

    expect(result.minimalMode).toBe(true);
    const tools = JSON.parse(
      result.sections.find((s) => s.kind === 'tool_schemas')!.text,
    ) as unknown[];
    expect(tools).toHaveLength(1);
    const memory = JSON.parse(result.sections.find((s) => s.kind === 'memory')!.text) as unknown[];
    expect(memory.length).toBeLessThanOrEqual(3);
    const total = result.sections.reduce((sum, s) => sum + s.tokens, 0);
    expect(total).toBeLessThanOrEqual(result.inputBudget);
  });

  it('stops degradation early once the budget is satisfied', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const result = await contextOptimizer.optimize(
      buildOptimizerInput({
        modelContextWindow: 16384, // small → inputBudget 11468
        // Page body dominates the budget; compress-page alone resolves it,
        // so tool/memory/minimal-mode steps must never run.
        pageContext: { title: 'Big Page', url: 'https://example.com', headings: ['A'], body: 'x'.repeat(50000) },
      }),
    );

    const total = result.sections.reduce((sum, s) => sum + s.tokens, 0);
    expect(total).toBeLessThanOrEqual(result.inputBudget);

    const bySourceId = new Map(result.provenance.sections.map((e) => [e.sourceId, e]));
    expect(bySourceId.get('context.page.current')?.compressionApplied).toBe('structural');
    // Steps after compress-page never ran — untouched sections carry no method.
    expect(bySourceId.get('tools.builtin.selected')?.compressionApplied).toBeUndefined();
    expect(bySourceId.get('memory.user.facts')?.compressionApplied).toBeUndefined();
    expect(result.minimalMode).toBe(false);
  });

  it('records exact compressionApplied values matching the degradation steps that ran', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const result = await contextOptimizer.optimize(
      buildOptimizerInput({
        modelContextWindow: 4096, // tiny → inputBudget 2867; full local degradation
        selectedToolSchemas: Array.from({ length: 10 }, (_, i) => ({
          name: `tool-${i}`,
          description: 'd'.repeat(150),
        })),
        memoryHints: Array.from({ length: 130 }, (_, i) => ({ id: `m${i}`, text: 'm'.repeat(100) })),
        pageContext: { title: 'T', url: 'https://e.com', body: 'x'.repeat(4000) },
        userInput: 'query',
      }),
    );

    const total = result.sections.reduce((sum, s) => sum + s.tokens, 0);
    expect(total).toBeLessThanOrEqual(result.inputBudget);

    const bySourceId = new Map(result.provenance.sections.map((e) => [e.sourceId, e]));
    expect(bySourceId.get('context.page.current')?.compressionApplied).toBe('structural');
    expect(bySourceId.get('tools.builtin.selected')?.compressionApplied).toBe('structural');
    expect(bySourceId.get('memory.user.facts')?.compressionApplied).toBe('topk');
    // Sections never touched by degradation carry no compressionApplied value.
    expect(bySourceId.get('core.instructions.system')?.compressionApplied).toBeUndefined();
    expect(bySourceId.get('interaction.user.current-turn')?.compressionApplied).toBeUndefined();
    expect(result.minimalMode).toBe(true); // tiny tier
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 04b-04 — receipt integration: omission reasons from the compressor,
// freshness-expired item omission, totals cross-check (CTX-T03)
// ─────────────────────────────────────────────────────────────────────────────

describe('ContextOptimizer.optimizeFromItems() receipt integration (04b-04)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * ContextItem fixture with policy-correct metadata (D-06): callers must
   * override trust/sensitivity/authority when the sourceId differs from the
   * known-domain page default (D-07).
   */
  function makeContextItem(overrides: Partial<ContextItem>): ContextItem {
    return {
      kind: 'context',
      text: 'fixture text',
      tokens: 5,
      stable: false,
      sourceId: 'context.page.current-url',
      relevance: 0.8,
      freshness: 1,
      trust: 0.5,
      sensitivity: 'private',
      instructionAuthority: 'data',
      ...overrides,
    };
  }

  it('records dropped data items with included:false and the compressor omission reason', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    // Tiny tier (inputBudget 2867): the oversized system item forces full
    // degradation; minimal-mode drops the page section entirely (budget).
    const systemItem = makeContextItem({
      kind: 'system',
      text: 's'.repeat(11600), // ≈ 2900 tokens
      tokens: 2900,
      stable: true,
      sourceId: 'core.instructions.system',
      trust: 1.0,
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
    const pageItem = makeContextItem({
      text: JSON.stringify({ title: 'T', url: 'https://e.com', body: 'x'.repeat(2000) }),
      tokens: 1500,
      sourceId: 'context.page.current',
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await contextOptimizer.optimizeFromItems(
      [systemItem, pageItem],
      buildOptimizerInput({ modelContextWindow: 4096 }),
    );

    // Page dropped from the final prompt; system survives (minimal-mode caps).
    expect(result.sections.map((s) => s.sourceId)).toEqual(['core.instructions.system']);
    expect(result.provenance.sections).toHaveLength(2);

    const sys = result.provenance.sections.find((s) => s.sourceId === 'core.instructions.system')!;
    expect(sys.included).toBe(true);
    expect(sys.originalTokens).toBe(2900);

    const page = result.provenance.sections.find((s) => s.sourceId === 'context.page.current')!;
    expect(page).toMatchObject({
      included: false,
      omissionReason: 'budget',
      originalTokens: 1500,
      finalTokens: 0,
      cacheEligible: false,
    });

    // No false-positive receipt mismatch on a consistent run.
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Receipt totals do not match packed totals'),
    );
    warnSpy.mockRestore();
  });

  it('uses the compressor omission reason (policy) for policy-dropped debug items', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    // Tiny tier: oversized system item forces degradation; drop-debug removes
    // the debug section — its receipt reason must come from the compressor's
    // omissionReasons map ('policy'), not the generic budget fallback.
    const systemItem = makeContextItem({
      kind: 'system',
      text: 's'.repeat(11200), // ≈ 2800 tokens
      tokens: 2800,
      stable: true,
      sourceId: 'core.instructions.system',
      trust: 1.0,
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
    const debugItem = makeContextItem({
      text: 'verbose debug trace',
      tokens: 100,
      sourceId: 'debug.verbose',
      trust: 0.3, // unknown source verdict (D-07)
    });

    const result = await contextOptimizer.optimizeFromItems(
      [systemItem, debugItem],
      buildOptimizerInput({ modelContextWindow: 4096 }),
    );

    expect(result.sections.map((s) => s.sourceId)).toEqual(['core.instructions.system']);
    expect(result.stepsApplied).toContain('drop-debug');
    const debug = result.provenance.sections.find((s) => s.sourceId === 'debug.verbose')!;
    expect(debug).toMatchObject({
      included: false,
      omissionReason: 'policy',
      finalTokens: 0,
    });
  });

  it('records all items as included when everything fits the budget', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const systemItem = makeContextItem({
      kind: 'system',
      text: 'system',
      tokens: 5,
      stable: true,
      sourceId: 'core.instructions.system',
      trust: 1.0,
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
    const userItem = makeContextItem({
      kind: 'user_input',
      text: 'hello',
      tokens: 3,
      stable: false,
      sourceId: 'interaction.user.current-turn',
      trust: 0.9,
      instructionAuthority: 'user',
    });
    const dataItem = makeContextItem({ tokens: 5 });

    const result = await contextOptimizer.optimizeFromItems(
      [systemItem, userItem, dataItem],
      buildOptimizerInput(),
    );

    expect(result.sections).toHaveLength(3);
    expect(result.provenance.sections).toHaveLength(3);
    for (const entry of result.provenance.sections) {
      expect(entry.included).toBe(true);
      expect(entry.omissionReason).toBeUndefined();
    }
  });

  it('receipt totals cross-check passes: validateReceiptTotals(receipt, packedSections) is true', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const { validateReceiptTotals } = await import(
      '../../../src/core/context/ContextProvenanceManifest'
    );
    const systemItem = makeContextItem({
      kind: 'system',
      text: 'system',
      tokens: 5,
      stable: true,
      sourceId: 'core.instructions.system',
      trust: 1.0,
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
    const dataItem = makeContextItem({ tokens: 8 });

    const result = await contextOptimizer.optimizeFromItems(
      [systemItem, dataItem],
      buildOptimizerInput(),
    );

    // Sum of included finalTokens === sum of packed section tokens.
    expect(validateReceiptTotals(result.provenance.sections, result.sections)).toBe(true);
  });

  it('omits hard-expired items as stale via ContextFreshnessPolicy before compression', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const { contextFreshnessPolicy } = await import(
      '../../../src/core/context/ContextFreshnessPolicy'
    );
    const computeSpy = vi.spyOn(contextFreshnessPolicy, 'compute');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));

    const systemItem = makeContextItem({
      kind: 'system',
      text: 'system',
      tokens: 5,
      stable: true,
      sourceId: 'core.instructions.system',
      trust: 1.0,
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
    const staleItem = makeContextItem({
      text: 'expired cached page',
      tokens: 50,
      sourceId: 'context.page.cached',
      trust: 0.3, // unknown-domain page verdict (D-07)
      createdAt: 1,
      expiresAt: 2, // long past the fixed clock → hard expiry → freshness 0
    });

    const result = await contextOptimizer.optimizeFromItems(
      [systemItem, staleItem],
      buildOptimizerInput(),
    );

    // The stale item never reaches the final prompt…
    expect(result.sections.map((s) => s.sourceId)).toEqual(['core.instructions.system']);
    // …but its receipt entry is recorded with the 'stale' omission reason.
    const stale = result.provenance.sections.find((s) => s.sourceId === 'context.page.cached')!;
    expect(stale).toMatchObject({
      included: false,
      omissionReason: 'stale',
      originalTokens: 50,
      finalTokens: 0,
      cacheEligible: false,
    });
    expect(computeSpy).toHaveBeenCalledWith('context.page.cached', 'context', expect.anything(), 2);
    expect(computeSpy).toHaveBeenCalled();
  });

  it('rejects trust-mismatched items via ContextTrustPolicy before the receipt stage', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const { contextTrustPolicy } = await import('../../../src/core/context/ContextTrustPolicy');
    const assessSpy = vi.spyOn(contextTrustPolicy, 'assess');
    const validateSpy = vi.spyOn(contextTrustPolicy, 'validate');

    // Unknown-domain page sourceId → policy verdict 0.3; self-assigned 0.5
    // must be rejected (D-06 — trust is never self-assigned).
    const mismatched = makeContextItem({ trust: 0.5, sourceId: 'context.page.other-url' });
    await expect(
      contextOptimizer.optimizeFromItems([mismatched], buildOptimizerInput()),
    ).rejects.toMatchObject({ code: 'SCHEMA_INVALID' });

    expect(assessSpy).toHaveBeenCalledWith('context.page.other-url', 'context');
    expect(validateSpy).toHaveBeenCalled();
  });

  it('keeps the existing optimize() method working unchanged (backward compatibility)', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const result = await contextOptimizer.optimize(buildOptimizerInput());

    expect(result.tier).toBe('medium');
    expect(result.sections).toHaveLength(7);
    expect(result.sections.map((s) => s.kind)).toEqual([
      'system',
      'tool_schemas',
      'preferences',
      'memory',
      'context',
      'task',
      'user_input',
    ]);
    expect(result.minimalMode).toBe(false);
    expect(result.provenance.sections).toHaveLength(7);
    expect(result.provenance.sections.every((e) => e.included === true)).toBe(true);
  });
});
