import { describe, it, expect, vi } from 'vitest';
import type { ContextOptimizerInput } from '../../src/core/ai/types';
import type { ProviderAdapter } from '../../src/core/ai/providers/ProviderAdapter';

/**
 * Human verification test (04-UAT.md test 1): AI summarization overflow
 * success branch (D-06/D-08).
 *
 * Requires a LIVE provider. The unit-test ProviderRouter mock always
 * resolves getCompressionModel() to null, so the success path — a real
 * generateText call that brings the context under budget — is never
 * exercised by the suite. Skipped when no provider key is present.
 *
 * Provider selection (env-driven):
 *  - OPENAI_API_KEY (+ optional OPENAI_BASE_URL): OpenAI adapter at the
 *    custom endpoint; MODEL env picks the model (default gpt-4o-mini)
 *  - GEMINI_API_KEY: Gemini adapter (gemini-2.0-flash-lite)
 *  - ANTHROPIC_API_KEY: Anthropic adapter (claude-3-5-haiku-latest)
 *
 * Only the provider construction is stubbed (endpoint config is
 * environmental); the generateText call, summary section, provenance,
 * and budget re-check are the REAL live path.
 *
 * Scenario (small tier @ 8000 → 5600-token input budget):
 *  - memory: 300 hints × 4000 chars — after reduce-memory (small → top-3)
 *    ≈ 3015 tokens, still huge
 *  - tools: 12 → trim-tools (small → 3) ≈ 160 tokens
 *  - user_input: 12000 chars ≈ 3000 tokens — the ONLY section AI
 *    summarization preserves (applyAiSummary keeps user_input/task)
 *  - stable: system ≈ 22 + tools ≈ 160 + preferences ≈ 8
 *
 * After all 7 local steps: 22+160+8+3015+3000 = 6205 > 5600 → all local
 * degradation failed → single AI summarization call fires. The summary
 * replaces memory (~3015 tokens) with ~1000 tokens (observed live):
 * 22+160+8+1000+3000 ≈ 4190 ≤ 5600 → context under budget. Margin ≈ 1400
 * tokens absorbs live-model summary-length variance.
 */
const openaiKey = process.env.OPENAI_API_KEY;
const openaiBaseURL = process.env.OPENAI_BASE_URL;
const geminiKey = process.env.GEMINI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: vi.fn(actual.generateText) };
});

describe.skipIf(!(openaiKey || geminiKey || anthropicKey))(
  'Human verification: AI summarization overflow success branch',
  () => {
    it(
      'brings an over-budget small-tier context under budget with exactly one live generateText call',
      async () => {
        let adapter: ProviderAdapter;

        if (openaiKey) {
          const { createOpenAIAdapter } = await import(
            '../../src/core/ai/providers/openai'
          );
          adapter = {
            ...createOpenAIAdapter(openaiKey, openaiBaseURL),
            getDefaultModelForTier: () => openaiModel,
          };
        } else if (geminiKey) {
          const { createGeminiAdapter } = await import(
            '../../src/core/ai/providers/gemini'
          );
          adapter = createGeminiAdapter(geminiKey);
        } else {
          const { createAnthropicAdapter } = await import(
            '../../src/core/ai/providers/anthropic'
          );
          adapter = createAnthropicAdapter(anthropicKey!);
        }

        const { providerRouter } = await import('../../src/core/ai/ProviderRouter');
        vi.spyOn(providerRouter, 'getCompressionModel').mockResolvedValue(adapter);

        const { generateText } = await import('ai');
        const generateTextSpy = generateText as ReturnType<typeof vi.fn>;

        const { contextOptimizer } = await import('../../src/core/context/ContextOptimizer');

        const input: ContextOptimizerInput = {
          operationId: 'op-human-verify-1',
          model: openaiModel,
          modelContextWindow: 8000, // small → inputBudget 5600
          userInput: 'u'.repeat(12000), // ≈3000 tokens — preserved by AI summarization
          conversationId: 'conv-human-verify-1',
          workspaceId: 'ws-human-verify-1',
          activeSurface: 'sidepanel',
          selectedToolSchemas: Array.from({ length: 12 }, (_, i) => ({
            name: `tool-${i}`,
            description: 'd'.repeat(200),
          })),
          memoryHints: Array.from({ length: 300 }, (_, i) => ({
            id: `m${i}`,
            text: 'm'.repeat(4000),
          })),
          pageContext: {
            title: 'Human verification page',
            url: 'https://example.com/human-verification',
            headings: ['One', 'Two'],
            body: 'x'.repeat(30000),
          },
          preferences: { responseStyle: 'concise' },
        };

        const result = await contextOptimizer.optimize(input);

        const total = result.sections.reduce((sum, s) => sum + s.tokens, 0);

        expect(generateTextSpy).toHaveBeenCalledTimes(1);
        const summarySection = result.sections.find((s) => s.sourceId === 'ai.compression.summary');
        expect(summarySection).toBeDefined();
        expect(summarySection!.kind).toBe('context');
        expect(summarySection!.text.trim().length).toBeGreaterThan(0);
        expect(
          result.provenance.sections.some((e) => e.sourceId === 'ai.compression.summary'),
        ).toBe(true);
        expect(total).toBeLessThanOrEqual(result.inputBudget);
      },
      120_000,
    );
  },
);
