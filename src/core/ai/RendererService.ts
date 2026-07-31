import { generateText } from 'ai';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { OptimizedContext, ModelTier, StreamEvent } from './types';
import { resolveTierModel } from './TierResolver';
import { PipelineError } from './PipelineError';
import { streamToAsyncIterable } from './StreamAdapter';
import { inject } from './persona/PersonaInjector';

const BASE_SYSTEM_PROMPT = 'You are a helpful assistant. Provide clear, concise responses.';

function buildMessages(
  decision: { action: 'answer'; reasonCode: string },
  optimized: OptimizedContext,
  systemPrompt?: string,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const prompt = systemPrompt ?? BASE_SYSTEM_PROMPT;

  // Conversation history assembly (kind: 'history') is future work in this
  // phase — no history sections are produced yet (Plan 04-02/04-03).
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  const userSection = optimized.sections.find((s) => s.kind === 'user_input');
  return [
    { role: 'system' as const, content: prompt },
    ...history,
    { role: 'user' as const, content: userSection?.text ?? '' },
  ];
}

function buildSystemPrompt(
  optimized: OptimizedContext,
  decision: { action: 'answer'; reasonCode: string },
): string {
  const systemSection = optimized.sections.find((s) => s.kind === 'system');
  return inject('renderer', [
    systemSection?.text ?? BASE_SYSTEM_PROMPT,
    `Response strategy: ${decision.reasonCode}`,
  ].join('\n'));
}

export class RendererService {
  async synthesize(
    adapter: ProviderAdapter,
    tier: ModelTier,
    decision: { action: 'answer'; reasonCode: string },
    optimized: OptimizedContext,
  ): Promise<string> {
    const { modelId } = resolveTierModel(adapter, tier);
    const model = adapter.createLanguageModel(modelId);

    const systemPrompt = buildSystemPrompt(optimized, decision);

    try {
      const { text } = await generateText({
        model,
        messages: buildMessages(decision, optimized, systemPrompt),
      });
      return text;
    } catch (err) {
      if (err instanceof PipelineError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PipelineError('ABORTED', 'Response generation was aborted.', {});
      }
      throw new PipelineError('UNKNOWN', 'Failed to generate response.', { originalError: String(err) });
    }
  }

  async stream(
    adapter: ProviderAdapter,
    tier: ModelTier,
    decision: { action: 'answer'; reasonCode: string },
    optimized: OptimizedContext,
  ): Promise<AsyncIterable<StreamEvent>> {
    const { modelId } = resolveTierModel(adapter, tier);
    const model = adapter.createLanguageModel(modelId);

    const systemPrompt = buildSystemPrompt(optimized, decision);

    return streamToAsyncIterable({
      model,
      messages: buildMessages(decision, optimized, systemPrompt),
    });
  }
}

export const rendererService = new RendererService();
