import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PromptSection } from '../../../src/core/ai/types';
import type { ProviderAdapter } from '../../../src/core/ai/providers/ProviderAdapter';
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

// ContextOptimizer only consumes getCompressionModel in this path; the
// optimizer-boundary abort test controls when cancellation arrives by
// aborting the shared controller inside the model-selection callback.
vi.mock('../../../src/core/ai/ProviderRouter', () => {
  return {
    providerRouter: {
      getCompressionModel: vi.fn(),
    },
  };
});

function buildAdapter(): ProviderAdapter {
  return {
    providerId: 'openai',
    createLanguageModel: vi.fn(),
    validateConnection: vi.fn().mockResolvedValue({ ok: true, models: ['gpt-4o-mini'] }),
    supportsStructuredOutput: true,
    getDefaultModelForTier: vi.fn().mockReturnValue('gpt-4o-mini'),
    getCacheStrategy: vi.fn().mockReturnValue('prefix-only' as const),
    getTelemetryMetadata: vi.fn().mockReturnValue({ provider: 'openai' }),
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
  return buildSection({
    kind: 'system',
    text: 'system',
    tokens,
    stable: true,
    sourceId: 'core.instructions.system',
  });
}

function userInputSection(tokens: number): PromptSection {
  return buildSection({
    kind: 'user_input',
    text: 'hello',
    tokens,
    stable: false,
    sourceId: 'interaction.user.current-turn',
  });
}

/**
 * A context that stays over budget even after all seven local degradation
 * steps: the huge user_input section is never touched by degradation, so
 * the pipeline always reaches the AI summarization overflow path.
 */
function overBudgetSections(): PromptSection[] {
  return [
    buildSection({
      kind: 'system',
      text: 's'.repeat(4000),
      tokens: 1000,
      stable: true,
    }),
    buildSection({
      kind: 'context',
      text: 'h'.repeat(5000),
      tokens: 1250,
      stable: false,
      sourceId: 'history.conversation.123',
    }),
    buildSection({
      kind: 'user_input',
      text: 'u'.repeat(40000),
      tokens: 10000,
      stable: false,
      sourceId: 'interaction.user.current-turn',
    }),
  ];
}

describe('ContextCompressor abort propagation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects with the original abort reason when the signal is aborted before compression starts', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const controller = new AbortController();
    controller.abort();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      contextCompressor.compress(overBudgetSections(), 1000, 'medium', undefined, controller.signal),
    ).rejects.toBe(controller.signal.reason);

    // An abort is never downgraded to a bounded warning / compression miss.
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('rejects with the original abort reason when the signal fires during provider selection', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const { generateText } = await import('ai');
    const mockGenerateText = generateText as ReturnType<typeof vi.fn>;
    const controller = new AbortController();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // A real compression-model provider rejects its pending selection with
    // the abort reason once the shared signal fires.
    const provider = (signal?: AbortSignal) =>
      new Promise<ProviderAdapter | null>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });

    const pending = contextCompressor.compress(
      overBudgetSections(),
      1000,
      'medium',
      provider,
      controller.signal,
    );
    controller.abort();

    await expect(pending).rejects.toBe(controller.signal.reason);
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('forwards the shared signal into generateText and rethrows the abort instead of swallowing it', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const { generateText } = await import('ai');
    const mockGenerateText = generateText as ReturnType<typeof vi.fn>;
    const controller = new AbortController();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // The AI SDK generation request rejects with the abort reason once the
    // signal it received fires.
    mockGenerateText.mockImplementation(
      (options: { abortSignal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.abortSignal?.addEventListener('abort', () => reject(options.abortSignal?.reason), {
            once: true,
          });
        }),
    );

    const provider = () => Promise.resolve(buildAdapter());
    const pending = contextCompressor.compress(
      overBudgetSections(),
      1000,
      'medium',
      provider,
      controller.signal,
    );

    // Same signal object that AgentOrchestrator.runTurn shares.
    await vi.waitFor(() => expect(mockGenerateText).toHaveBeenCalled());
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({ abortSignal: controller.signal }),
    );

    controller.abort();
    await expect(pending).rejects.toBe(controller.signal.reason);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('stops before AI summarization when the signal aborts between provider selection and generateText', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const { generateText } = await import('ai');
    const mockGenerateText = generateText as ReturnType<typeof vi.fn>;
    const controller = new AbortController();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Cancellation lands while the provider selection await is in flight:
    // the adapter resolves, but the post-await signal check must stop the
    // pipeline before any generation request starts.
    const provider = () => {
      controller.abort();
      return Promise.resolve(buildAdapter());
    };

    await expect(
      contextCompressor.compress(overBudgetSections(), 1000, 'medium', provider, controller.signal),
    ).rejects.toBe(controller.signal.reason);
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('propagates a nested compression abort through ContextOptimizer as an abort, not CONTEXT_TOO_LARGE', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const { providerRouter } = await import('../../../src/core/ai/ProviderRouter');
    const getCompressionModel = providerRouter.getCompressionModel as ReturnType<typeof vi.fn>;

    const controller = new AbortController();
    getCompressionModel.mockImplementation(() => {
      // Cancellation arrives while compression-model selection runs — the
      // nested compressor must surface it as an abort at the optimizer
      // boundary, never as CONTEXT_TOO_LARGE or a successful optimization.
      controller.abort();
      return Promise.resolve(null);
    });

    const err = await contextOptimizer
      .optimize({
        operationId: 'op-abort-nested',
        model: 'gpt-4o-mini',
        modelContextWindow: 4096, // tiny tier: user-input overflow forces the provider path
        userInput: 'c'.repeat(60000),
        conversationId: 'conv-abort-1',
        workspaceId: 'ws-abort-1',
        activeSurface: 'sidepanel',
        selectedToolSchemas: [],
        memoryHints: [],
        preferences: {},
        abortSignal: controller.signal,
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(err).toBeDefined();
    expect(err).not.toBeInstanceOf(PipelineError);
    expect((err as Error).name).toBe('AbortError');
  });

  it('keeps the seven-step degradation order when the signal never aborts', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const controller = new AbortController(); // active, never aborted
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
        text: JSON.stringify(
          Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, text: 'm'.repeat(100) })),
        ),
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

    const result = await contextCompressor.compress(sections, 1000, 'medium', undefined, controller.signal);
    expect(result.stepsApplied).toEqual([
      'drop-debug',
      'drop-secondary',
      'summarise-history',
      'compress-page',
      'trim-tools',
      'reduce-memory',
      'minimal-mode',
    ]);
    // input array and elements are never mutated
    expect(sections).toHaveLength(6);
  });

  it('records ai-summarisation and hands the shared signal to the provider callback on success', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const { generateText } = await import('ai');
    const mockGenerateText = generateText as ReturnType<typeof vi.fn>;
    mockGenerateText.mockResolvedValue({ text: 'Concise summary of the context.' });

    const controller = new AbortController(); // active, never aborted
    const provider = vi.fn().mockResolvedValue(buildAdapter());

    const result = await contextCompressor.compress(
      overBudgetSections(),
      1000,
      'medium',
      provider,
      controller.signal,
    );

    expect(result.stepsApplied).toContain('ai-summarisation');
    const summary = result.sections.find((s) => s.sourceId === 'ai.compression.summary');
    expect(summary?.text).toBe('Concise summary of the context.');
    // The compression-model provider callback receives the same signal.
    expect(provider).toHaveBeenCalledWith(controller.signal);
  });

  it('keeps the graceful fallback when summarization fails without aborting', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const { generateText } = await import('ai');
    const mockGenerateText = generateText as ReturnType<typeof vi.fn>;
    mockGenerateText.mockRejectedValue(new Error('provider exploded'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const controller = new AbortController(); // never aborted
    const provider = () => Promise.resolve(buildAdapter());
    const result = await contextCompressor.compress(
      overBudgetSections(),
      1000,
      'medium',
      provider,
      controller.signal,
    );

    // T-04-09: keep pre-summarization sections, record the attempted step,
    // and let the caller's budget check decide — no throw for a plain failure.
    expect(result.stepsApplied).toContain('ai-summarisation');
    expect(result.sections.some((s) => s.sourceId === 'ai.compression.summary')).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('keeps the graceful fallback when provider selection fails without aborting', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new AbortController(); // never aborted
    const provider = () => Promise.reject(new Error('compression model unavailable'));

    const result = await contextCompressor.compress(
      overBudgetSections(),
      1000,
      'medium',
      provider,
      controller.signal,
    );

    expect(result.stepsApplied).not.toContain('ai-summarisation');
    expect(result.sections.some((s) => s.sourceId === 'ai.compression.summary')).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
